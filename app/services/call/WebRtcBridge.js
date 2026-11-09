import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const WEBRTC_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body, html { margin: 0; padding: 0; background: #000; overflow: hidden; width: 100%; height: 100%; }
    video { width: 100%; height: 100%; object-fit: cover; }
    #localVideo { position: absolute; width: 100px; height: 140px; bottom: 16px; right: 16px; border-radius: 12px; z-index: 10; transform: scaleX(-1); }
  </style>
</head>
<body>
  <video id="remoteVideo" autoplay playsinline muted></video>
  <video id="localVideo" autoplay playsinline muted></video>
  <audio id="remoteAudio" autoplay playsinline></audio>
  <audio id="ringtoneAudio" loop playsinline preload="auto" src="https://chuyenbienhoa.com/sounds/ringtone.mp3"></audio>
  <script>
    const ICE_SERVERS = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp"
        ],
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ];

    let pc = null;
    let localStream = null;
    let remoteStream = null;
    let iceQueue = [];
    let pendingRemoteSdp = null;
    let audioCtx = null;
    let activeOutgoingCallId = null;
    let processedOfferSdp = null;
    let processedAnswerSdp = null;

    function postToRN(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function ensureAudioCtx() {
      try {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
      } catch (e) {}
    }

    function playIncomingChime() {
      try {
        const ringEl = document.getElementById("ringtoneAudio");
        if (ringEl) {
          ringEl.currentTime = 0;
          ringEl.volume = 1.0;
          ringEl.play().catch(() => {});
        }
      } catch (e) {}
    }

    function playOutgoingRingback() {
      try {
        ensureAudioCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(425, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
        gain.gain.setValueAtTime(0.14, now + 0.9);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.02);
      } catch (e) {}
    }

    let ringTimer = null;
    function startRingingLoop(mode) {
      stopRingingLoop();
      if (mode === "incoming") {
        playIncomingChime();
      } else {
        playOutgoingRingback();
        ringTimer = setInterval(playOutgoingRingback, 3000);
      }
    }

    function stopRingingLoop() {
      if (ringTimer) {
        clearInterval(ringTimer);
        ringTimer = null;
      }
      try {
        const ringEl = document.getElementById("ringtoneAudio");
        if (ringEl) {
          ringEl.pause();
          ringEl.currentTime = 0;
        }
      } catch (e) {}
    }

    async function acquireLocalMedia(callType) {
      ensureAudioCtx();
      if (localStream && localStream.getTracks().some(t => t.readyState === "live")) {
        return localStream;
      }
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: callType === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        const localVideo = document.getElementById("localVideo");
        if (localVideo && callType === "video") {
          localVideo.srcObject = localStream;
        }
        return localStream;
      } catch (err) {
        if (callType === "video") {
          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video: false
            });
            return localStream;
          } catch (audioErr) {}
        }
        postToRN({ type: "MEDIA_WARNING", message: err.message || "Proceeding in receive-only mode" });
        return null;
      }
    }

    function attachTracksOrTransceivers(peer, stream, callType) {
      if (stream && stream.getTracks().length > 0) {
        const existingTracks = peer.getSenders().map(s => s.track).filter(Boolean);
        stream.getTracks().forEach(track => {
          if (!existingTracks.includes(track)) {
            peer.addTrack(track, stream);
          }
        });
      } else {
        try {
          const hasAudioTransceiver = peer.getTransceivers().some(
            t => t.receiver && t.receiver.track && t.receiver.track.kind === "audio"
          );
          if (!hasAudioTransceiver) {
            peer.addTransceiver("audio", { direction: "recvonly" });
          }
          if (callType === "video") {
            const hasVideoTransceiver = peer.getTransceivers().some(
              t => t.receiver && t.receiver.track && t.receiver.track.kind === "video"
            );
            if (!hasVideoTransceiver) {
              peer.addTransceiver("video", { direction: "recvonly" });
            }
          }
        } catch (e) {}
      }
    }

    function attachRemoteStreamToElements(stream) {
      ensureAudioCtx();
      const remoteAudio = document.getElementById("remoteAudio");
      if (remoteAudio) {
        if (remoteAudio.srcObject !== stream) {
          remoteAudio.srcObject = stream;
        }
        remoteAudio.muted = false;
        remoteAudio.volume = 1.0;
        const p = remoteAudio.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            setTimeout(() => {
              try { remoteAudio.play().catch(() => {}); } catch (e) {}
            }, 300);
          });
        }
      }
      const remoteVideo = document.getElementById("remoteVideo");
      if (remoteVideo) {
        if (remoteVideo.srcObject !== stream) {
          remoteVideo.srcObject = stream;
        }
        remoteVideo.muted = true;
        try { remoteVideo.play().catch(() => {}); } catch (e) {}
      }
    }

    function createPeer() {
      if (pc) {
        try { pc.close(); } catch (e) {}
      }
      remoteStream = new MediaStream();
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          postToRN({ type: "ICE_CANDIDATE", candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        let streamToPlay = null;
        if (event.streams && event.streams[0]) {
          streamToPlay = event.streams[0];
        } else if (event.track) {
          if (!remoteStream) remoteStream = new MediaStream();
          remoteStream.addTrack(event.track);
          streamToPlay = remoteStream;
        }
        if (streamToPlay) {
          attachRemoteStreamToElements(streamToPlay);
        }
        postToRN({ type: "REMOTE_STREAM_READY" });
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        postToRN({ type: "CONNECTION_STATE_CHANGE", state: pc.connectionState });
        if (pc.connectionState === "connected") {
          const remoteAudio = document.getElementById("remoteAudio");
          if (remoteAudio && remoteAudio.srcObject) {
            try {
              remoteAudio.muted = false;
              remoteAudio.volume = 1.0;
              remoteAudio.play().catch(() => {});
            } catch (e) {}
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!pc) return;
        postToRN({ type: "ICE_STATE_CHANGE", state: pc.iceConnectionState });
      };

      return pc;
    }

    async function drainQueuedCandidates() {
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
      while (iceQueue.length > 0) {
        const c = iceQueue.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {}
      }
    }

    async function startOutgoingCall(callId, callType) {
      try {
        if (callId && activeOutgoingCallId === String(callId) && pc) {
          return;
        }
        if (callId) activeOutgoingCallId = String(callId);
        stopRingingLoop();
        const stream = await acquireLocalMedia(callType);
        const peer = createPeer();
        attachTracksOrTransceivers(peer, stream, callType);

        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video"
        });
        await peer.setLocalDescription(offer);

        postToRN({
          type: "OFFER_CREATED",
          callId,
          sdp: peer.localDescription
        });
      } catch (err) {
        postToRN({ type: "ERROR", message: err.message || "startOutgoingCall failed" });
      }
    }

    async function answerIncomingCall(callId, callType, remoteOffer) {
      try {
        stopRingingLoop();
        const stream = await acquireLocalMedia(callType);
        const peer = pc || createPeer();
        attachTracksOrTransceivers(peer, stream, callType);

        const offer = remoteOffer || pendingRemoteSdp;
        if (offer && offer.type === "offer") {
          pendingRemoteSdp = null;
          processedOfferSdp = offer.sdp || "processed";
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          await drainQueuedCandidates();

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          postToRN({
            type: "ANSWER_CREATED",
            callId,
            sdp: peer.localDescription
          });
        }
      } catch (err) {
        postToRN({ type: "ERROR", message: err.message || "answerIncomingCall failed" });
      }
    }

    async function setRemoteSdp(sdp, callType) {
      try {
        if (!sdp) return;

        if (sdp.type === "offer") {
          if (processedOfferSdp && sdp.sdp && processedOfferSdp === sdp.sdp) {
            return;
          }
          if (!pc) {
            // Queue offer until user taps Answer (or initialize if already answered)
            pendingRemoteSdp = sdp;
            return;
          }
          processedOfferSdp = sdp.sdp || "processed";
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainQueuedCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          postToRN({
            type: "ANSWER_CREATED",
            sdp: pc.localDescription
          });
          return;
        }

        if (sdp.type === "answer") {
          if (!pc) {
            pendingRemoteSdp = sdp;
            return;
          }
          if (processedAnswerSdp && sdp.sdp && processedAnswerSdp === sdp.sdp) {
            return;
          }
          if (pc.signalingState !== "have-local-offer") {
            return;
          }
          processedAnswerSdp = sdp.sdp || "processed";
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainQueuedCandidates();
        }
      } catch (err) {
        postToRN({ type: "ERROR", message: err.message || "setRemoteSdp failed" });
      }
    }

    async function addIceCandidate(candidate) {
      if (!candidate) return;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      } else {
        iceQueue.push(candidate);
      }
    }

    function setMuted(muted) {
      if (!localStream) return;
      localStream.getAudioTracks().forEach(t => {
        t.enabled = !muted;
      });
    }

    function setVideoEnabled(enabled) {
      if (!localStream) return;
      localStream.getVideoTracks().forEach(t => {
        t.enabled = enabled;
      });
    }

    function endSession() {
      stopRingingLoop();
      if (localStream) {
        localStream.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
        localStream = null;
      }
      if (pc) {
        try { pc.close(); } catch (e) {}
        pc = null;
      }
      remoteStream = null;
      iceQueue = [];
      pendingRemoteSdp = null;
      activeOutgoingCallId = null;
      processedOfferSdp = null;
      processedAnswerSdp = null;
    }

    function handleCommand(event) {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data || !data.command) return;

        switch (data.command) {
          case "START_RINGING":
            startRingingLoop(data.mode || "incoming");
            break;
          case "STOP_RINGING":
            stopRingingLoop();
            break;
          case "START_OUTGOING_CALL":
            startOutgoingCall(data.callId, data.callType || "audio");
            break;
          case "ANSWER_INCOMING_CALL":
            answerIncomingCall(data.callId, data.callType || "audio", data.remoteOffer);
            break;
          case "SET_REMOTE_SDP":
            setRemoteSdp(data.sdp, data.callType || "audio");
            break;
          case "ADD_ICE_CANDIDATE":
            addIceCandidate(data.candidate);
            break;
          case "SET_MUTED":
            setMuted(Boolean(data.muted));
            break;
          case "SET_VIDEO_ENABLED":
            setVideoEnabled(Boolean(data.enabled));
            break;
          case "END_CALL":
            endSession();
            break;
        }
      } catch (e) {}
    }

    window.addEventListener("message", handleCommand);
    document.addEventListener("message", handleCommand);
  </script>
</body>
</html>
`;

const WebRtcBridge = forwardRef(({ onMessage }, ref) => {
  const webViewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    sendMessage(command, payload = {}) {
      const msg = JSON.stringify({ command, ...payload });
      webViewRef.current?.postMessage(msg);
    },
  }));

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: WEBRTC_HTML, baseUrl: "https://chuyenbienhoa.com" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        onMessage={(event) => {
          try {
            const parsed = JSON.parse(event.nativeEvent.data);
            onMessage?.(parsed);
          } catch {}
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    bottom: -100,
    right: -100,
    zIndex: -1,
  },
});

export default WebRtcBridge;
