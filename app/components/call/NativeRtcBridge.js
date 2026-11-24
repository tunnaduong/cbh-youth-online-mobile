import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { WebRtcBridge as ToneBridge } from "./WebRtcBridge";

/**
 * Native WebRTC engine (react-native-webrtc). Same sendMessage(action, payload)
 * / onMessage contract as the WebView bridge, so CallContext barely changes.
 * The hidden WebView bridge is kept only for ringtones/tones (never for RTC).
 */

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const TONE_ACTIONS = new Set([
  "START_OUTGOING_RING",
  "START_INCOMING_RING",
  "STOP_RINGING",
]);

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS = {
  facingMode: "user",
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

export const NativeRtcBridge = forwardRef(({ onMessage }, ref) => {
  const toneRef = useRef(null);
  const s = useRef({
    pc: null,
    local: null,
    remote: null,
    ice: DEFAULT_ICE_SERVERS,
    queued: [],
    pendingSdp: null,
    callId: null,
    callType: "audio",
    offerFor: null,
    processedOffer: null,
    processedAnswer: null,
    queue: Promise.resolve(),
  }).current;

  const emit = (data) => {
    try {
      onMessage && onMessage(data);
    } catch {}
  };

  const serializeSdp = (d) => (d ? { type: d.type, sdp: d.sdp } : null);

  const tuneSenders = (pc) => {
    pc.getSenders().forEach(async (sender) => {
      try {
        if (!sender.track || !sender.getParameters) return;
        const params = sender.getParameters();
        if (!params.encodings || !params.encodings.length) {
          params.encodings = [{}];
        }
        if (sender.track.kind === "video") {
          params.encodings[0].maxBitrate = 1500000;
          params.encodings[0].maxFramerate = 30;
          params.degradationPreference = "maintain-framerate";
        } else {
          params.encodings[0].maxBitrate = 40000;
        }
        await sender.setParameters(params);
      } catch (e) {
        // best-effort tuning only
      }
    });
  };

  const acquireMedia = async (callType) => {
    if (s.local && s.local.getTracks().some((t) => t.readyState === "live")) {
      return s.local;
    }
    try {
      s.local = await mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: callType === "video" ? VIDEO_CONSTRAINTS : false,
      });
    } catch (err) {
      if (callType === "video") {
        try {
          s.local = await mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
            video: { facingMode: "user", width: 640, height: 480 },
          });
        } catch {
          try {
            s.local = await mediaDevices.getUserMedia({
              audio: AUDIO_CONSTRAINTS,
              video: false,
            });
          } catch (e2) {
            emit({ type: "MEDIA_WARNING", message: e2?.message });
            return null;
          }
        }
      } else {
        emit({ type: "MEDIA_WARNING", message: err?.message });
        return null;
      }
    }
    emit({ type: "LOCAL_STREAM", stream: s.local });
    return s.local;
  };

  const attach = (pc, stream, callType) => {
    if (stream && stream.getTracks().length) {
      const existing = pc.getSenders().map((x) => x.track);
      stream.getTracks().forEach((t) => {
        if (!existing.includes(t)) pc.addTrack(t, stream);
      });
    } else {
      try {
        pc.addTransceiver("audio", { direction: "recvonly" });
        if (callType === "video") {
          pc.addTransceiver("video", { direction: "recvonly" });
        }
      } catch {}
    }
  };

  const drain = async () => {
    const pc = s.pc;
    if (!pc || !pc.remoteDescription) return;
    while (s.queued.length) {
      const c = s.queued.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {}
    }
  };

  const createPc = (callId) => {
    if (s.pc) {
      try {
        s.pc.close();
      } catch {}
    }
    const pc = new RTCPeerConnection({
      iceServers: s.ice,
      bundlePolicy: "max-bundle",
    });
    s.remote = new MediaStream();
    pc.addEventListener("icecandidate", (e) => {
      if (e.candidate) {
        emit({
          type: "ICE_CANDIDATE",
          candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate,
          callId: callId || s.callId,
        });
      }
    });
    pc.addEventListener("track", (e) => {
      toneRef.current?.sendMessage("STOP_RINGING");
      if (e.track && !s.remote.getTracks().includes(e.track)) {
        s.remote.addTrack(e.track);
      }
      // New object each time so React re-renders when the video track arrives
      // after the audio track.
      emit({
        type: "REMOTE_STREAM_READY",
        stream: new MediaStream(s.remote.getTracks()),
      });
    });
    pc.addEventListener("connectionstatechange", () => {
      emit({ type: "CONNECTION_STATE_CHANGE", state: pc.connectionState });
      if (pc.connectionState === "connected") tuneSenders(pc);
    });
    s.pc = pc;
    return pc;
  };

  const process = async (action, payload) => {
    try {
      if (action === "SET_ICE_SERVERS") {
        if (Array.isArray(payload) && payload.length) {
          const merged = payload.slice();
          const hasTurn = merged.some((x) =>
            JSON.stringify(x.urls || "").includes("turn:")
          );
          if (!hasTurn) merged.push(DEFAULT_ICE_SERVERS.at(-1));
          s.ice = merged;
        }
      } else if (action === "START_OUTGOING_CALL") {
        const { callId, callType = "audio" } = payload;
        if (callId && s.offerFor === String(callId) && s.pc) return;
        s.callId = callId;
        s.callType = callType;
        if (callId) s.offerFor = String(callId);
        InCallManager.start({ media: callType === "video" ? "video" : "audio" });
        if (callType === "video") InCallManager.setForceSpeakerphoneOn(true);
        const stream = await acquireMedia(callType);
        const pc = createPc(callId);
        attach(pc, stream, callType);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video",
        });
        await pc.setLocalDescription(offer);
        emit({
          type: "OFFER_CREATED",
          sdp: serializeSdp(pc.localDescription),
          callId,
        });
      } else if (action === "ANSWER_INCOMING_CALL") {
        const { callId, callType = "audio", remoteOffer } = payload;
        s.callId = callId;
        s.callType = callType;
        InCallManager.start({ media: callType === "video" ? "video" : "audio" });
        if (callType === "video") InCallManager.setForceSpeakerphoneOn(true);
        const stream = await acquireMedia(callType);
        const pc = s.pc || createPc(callId);
        attach(pc, stream, callType);
        const offer = remoteOffer || s.pendingSdp;
        if (offer && offer.type === "offer") {
          s.pendingSdp = null;
          s.processedOffer = offer.sdp || "processed";
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await drain();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emit({
            type: "ANSWER_CREATED",
            sdp: serializeSdp(pc.localDescription),
            callId,
          });
        }
      } else if (action === "SET_REMOTE_SDP") {
        const sdp = payload.sdp;
        const callId = payload.callId || s.callId;
        if (!sdp) return;
        if (sdp.type === "offer") {
          if (s.processedOffer && sdp.sdp === s.processedOffer) return;
          if (!s.pc) {
            s.pendingSdp = sdp;
            return;
          }
          s.processedOffer = sdp.sdp || "processed";
          await s.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drain();
          const answer = await s.pc.createAnswer();
          await s.pc.setLocalDescription(answer);
          emit({
            type: "ANSWER_CREATED",
            sdp: serializeSdp(s.pc.localDescription),
            callId,
          });
        } else if (sdp.type === "answer") {
          if (!s.pc) {
            s.pendingSdp = sdp;
            return;
          }
          if (s.processedAnswer && sdp.sdp === s.processedAnswer) return;
          if (s.pc.signalingState !== "have-local-offer") return;
          s.processedAnswer = sdp.sdp || "processed";
          await s.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drain();
        }
      } else if (action === "ADD_ICE_CANDIDATE") {
        const c = payload.candidate;
        if (!c) return;
        if (s.pc && s.pc.remoteDescription) {
          try {
            await s.pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        } else {
          s.queued.push(c);
        }
      } else if (action === "SET_MUTED") {
        s.local?.getAudioTracks().forEach((t) => (t.enabled = !payload.muted));
      } else if (action === "SET_VIDEO_ENABLED") {
        s.local?.getVideoTracks().forEach((t) => (t.enabled = !!payload.enabled));
      } else if (action === "SWITCH_CAMERA") {
        const track = s.local?.getVideoTracks()[0];
        if (track && track._switchCamera) track._switchCamera();
      } else if (action === "SET_SPEAKER") {
        InCallManager.setForceSpeakerphoneOn(!!(payload.enabled ?? payload.on));
      } else if (action === "END_CALL") {
        s.queued = [];
        s.pendingSdp = null;
        s.callId = null;
        s.offerFor = null;
        s.processedOffer = null;
        s.processedAnswer = null;
        if (s.local) {
          s.local.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
          s.local = null;
        }
        if (s.pc) {
          try {
            s.pc.close();
          } catch {}
          s.pc = null;
        }
        s.remote = null;
        try {
          InCallManager.stop();
        } catch {}
        emit({ type: "LOCAL_STREAM", stream: null });
        emit({ type: "REMOTE_STREAM_READY", stream: null });
      }
    } catch (err) {
      emit({ type: "ERROR", message: err?.message });
    }
  };

  useImperativeHandle(ref, () => ({
    sendMessage: (action, payload = {}) => {
      if (TONE_ACTIONS.has(action) || action === "END_CALL") {
        toneRef.current?.sendMessage(action, payload);
      }
      if (TONE_ACTIONS.has(action)) return;
      s.queue = s.queue.then(() => process(action, payload));
    },
  }));

  return <ToneBridge ref={toneRef} onMessage={() => {}} />;
});
