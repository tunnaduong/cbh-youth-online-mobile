import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { RINGTONE_OPPO_BASE64 } from "../../assets/sounds/ringtoneOppoBase64";

const buildWebRtcHtml = (base64Audio) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background:transparent;margin:0;padding:0;">
  <audio id="remoteAudio" autoplay playsinline></audio>
  <audio id="ringtoneAudio" loop playsinline preload="auto" src="data:audio/mp3;base64,${base64Audio}"></audio>
  <script>
    const DEFAULT_ICE_SERVERS = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];

    let pc = null;
    let localStream = null;
    let remoteStream = null;
    let audioCtx = null;
    let ringOscillator = null;
    let ringInterval = null;
    let activeOscillators = [];
    let iceServers = DEFAULT_ICE_SERVERS.slice();
    let queuedCandidates = [];
    let pendingRemoteSdp = null;
    let currentCallId = null;
    let currentCallType = 'audio';
    let offerCreatedForCallId = null;
    let processedOfferSdp = null;
    let processedAnswerSdp = null;

    function sendToNative(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function initAudioContext() {
      try {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(function(){});
        }
      } catch(e) {}
    }

    function stopTones() {
      const ringAudio = document.getElementById('ringtoneAudio');
      if (ringAudio) {
        try {
          ringAudio.pause();
          ringAudio.currentTime = 0;
        } catch(e) {}
      }
      if (ringInterval) {
        clearInterval(ringInterval);
        ringInterval = null;
      }
      if (ringOscillator) {
        try { ringOscillator.stop(); ringOscillator.disconnect(); } catch(e){}
        ringOscillator = null;
      }
      if (activeOscillators && activeOscillators.length > 0) {
        activeOscillators.forEach(function(osc) {
          try { osc.stop(); osc.disconnect(); } catch(e){}
        });
        activeOscillators = [];
      }
    }

    function playTone(freq1, freq2, duration, type) {
      type = type || 'sine';
      try {
        initAudioContext();
        if (!audioCtx) return;
        const osc1 = audioCtx.createOscillator();
        const osc2 = freq2 ? audioCtx.createOscillator() : null;
        const gain = audioCtx.createGain();

        osc1.type = type;
        osc1.frequency.value = freq1;
        if (osc2) {
          osc2.type = type;
          osc2.frequency.value = freq2;
          osc2.connect(gain);
        }
        osc1.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.start(now);
        if (osc2) osc2.start(now);
        osc1.stop(now + duration);
        if (osc2) osc2.stop(now + duration);

        activeOscillators.push(osc1);
        if (osc2) activeOscillators.push(osc2);
        osc1.onended = function() {
          activeOscillators = activeOscillators.filter(function(o) { return o !== osc1; });
        };
        if (osc2) {
          osc2.onended = function() {
            activeOscillators = activeOscillators.filter(function(o) { return o !== osc2; });
          };
        }
      } catch(e) {
        console.warn('Tone error:', e);
      }
    }

    function startOutgoingRing() {
      stopTones();
      playTone(440, 480, 1.8);
      ringInterval = setInterval(function() {
        playTone(440, 480, 1.8);
      }, 4000);
    }

    function startIncomingRing() {
      stopTones();
      const ringAudio = document.getElementById('ringtoneAudio');
      if (ringAudio) {
        ringAudio.currentTime = 0;
        ringAudio.volume = 1.0;
        const playPromise = ringAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(function(err) {
            console.warn('Ringtone audio play error:', err);
          });
        }
      }
    }

    function playConnectedTone() {
      stopTones();
      playTone(660, 880, 0.4);
    }

    function playEndTone() {
      stopTones();
      playTone(425, null, 0.25);
      setTimeout(function() { playTone(425, null, 0.25); }, 350);
      setTimeout(function() { playTone(425, null, 0.35); }, 700);
    }

    async function acquireLocalMedia(callType) {
      initAudioContext();
      if (localStream && localStream.getTracks().some(function(t) { return t.readyState === 'live'; })) {
        return localStream;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        sendToNative({ type: 'MEDIA_WARNING', message: 'mediaDevices unavailable, using recvonly fallback' });
        return null;
      }
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: callType === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return localStream;
      } catch (err) {
        if (callType === 'video') {
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
        sendToNative({ type: 'MEDIA_WARNING', message: err.message || 'getUserMedia failed, using recvonly' });
        return null;
      }
    }

    function attachTracksOrTransceivers(peer, stream, callType) {
      if (stream && stream.getTracks().length > 0) {
        const existingTracks = peer.getSenders().map(function(s) { return s.track; }).filter(Boolean);
        stream.getTracks().forEach(function(track) {
          if (existingTracks.indexOf(track) === -1) {
            peer.addTrack(track, stream);
          }
        });
      } else {
        try {
          const hasAudio = peer.getTransceivers().some(function(t) {
            return t.receiver && t.receiver.track && t.receiver.track.kind === 'audio';
          });
          if (!hasAudio) {
            peer.addTransceiver('audio', { direction: 'recvonly' });
          }
          if (callType === 'video') {
            const hasVideo = peer.getTransceivers().some(function(t) {
              return t.receiver && t.receiver.track && t.receiver.track.kind === 'video';
            });
            if (!hasVideo) {
              peer.addTransceiver('video', { direction: 'recvonly' });
            }
          }
        } catch(e) {}
      }
    }

    async function drainQueuedCandidates() {
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
      while (queuedCandidates.length > 0) {
        const candidate = queuedCandidates.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch(e) {
          console.warn('drain candidate error', e);
        }
      }
    }

    function createPeerConnection(callId) {
      if (pc) {
        try { pc.close(); } catch(e){}
      }
      remoteStream = new MediaStream();
      pc = new RTCPeerConnection({ iceServers: iceServers });

      pc.onicecandidate = function(event) {
        if (event.candidate) {
          sendToNative({ type: 'ICE_CANDIDATE', candidate: event.candidate, callId: callId || currentCallId });
        }
      };

      pc.ontrack = function(event) {
        stopTones();
        initAudioContext();
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio) {
          if (event.streams && event.streams[0]) {
            remoteAudio.srcObject = event.streams[0];
          } else if (event.track) {
            if (!remoteStream) remoteStream = new MediaStream();
            remoteStream.addTrack(event.track);
            remoteAudio.srcObject = remoteStream;
          }
          remoteAudio.muted = false;
          remoteAudio.volume = 1.0;
          const p = remoteAudio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(function() {
              setTimeout(function() {
                try { remoteAudio.play().catch(function(){}); } catch(e){}
              }, 300);
            });
          }
        }
        sendToNative({ type: 'REMOTE_STREAM_READY' });
      };

      pc.onconnectionstatechange = function() {
        if (!pc) return;
        sendToNative({ type: 'CONNECTION_STATE_CHANGE', state: pc.connectionState });
        if (pc.connectionState === 'connected') {
          playConnectedTone();
          const remoteAudio = document.getElementById('remoteAudio');
          if (remoteAudio && remoteAudio.srcObject) {
            try {
              remoteAudio.muted = false;
              remoteAudio.volume = 1.0;
              remoteAudio.play().catch(function(){});
            } catch(e) {}
          }
        }
      };

      return pc;
    }

    window.handleNativeMessage = async function(msg) {
      try {
        const parsed = JSON.parse(msg);
        const action = parsed.action;
        const payload = parsed.payload || {};

        if (action === 'SET_ICE_SERVERS') {
          if (Array.isArray(payload) && payload.length > 0) {
            const merged = payload.slice();
            const hasTurn = merged.some(function(s) {
              return JSON.stringify(s.urls || '').indexOf('turn:') !== -1;
            });
            if (!hasTurn) {
              merged.push(DEFAULT_ICE_SERVERS[DEFAULT_ICE_SERVERS.length - 1]);
            }
            iceServers = merged;
          }
        }

        else if (action === 'STOP_RINGING') {
          stopTones();
        }

        else if (action === 'START_OUTGOING_RING') {
          initAudioContext();
          startOutgoingRing();
        }

        else if (action === 'START_INCOMING_RING') {
          initAudioContext();
          startIncomingRing();
        }

        else if (action === 'START_OUTGOING_CALL') {
          stopTones();
          initAudioContext();
          const callId = payload.callId;
          const callType = payload.callType || 'audio';
          if (callId && offerCreatedForCallId === String(callId) && pc) {
            return;
          }
          currentCallId = callId;
          currentCallType = callType;
          if (callId) offerCreatedForCallId = String(callId);

          const stream = await acquireLocalMedia(callType);
          const peer = createPeerConnection(callId);
          attachTracksOrTransceivers(peer, stream, callType);

          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video'
          });
          await peer.setLocalDescription(offer);
          sendToNative({ type: 'OFFER_CREATED', sdp: peer.localDescription, callId: callId });
        }

        else if (action === 'ANSWER_INCOMING_CALL') {
          stopTones();
          initAudioContext();
          const callId = payload.callId;
          const callType = payload.callType || 'audio';
          const remoteOffer = payload.remoteOffer;
          currentCallId = callId;
          currentCallType = callType;

          const offerToUse = remoteOffer || pendingRemoteSdp;
          const stream = await acquireLocalMedia(callType);
          const peer = pc || createPeerConnection(callId);
          attachTracksOrTransceivers(peer, stream, callType);

          if (offerToUse && offerToUse.type === 'offer') {
            pendingRemoteSdp = null;
            processedOfferSdp = offerToUse.sdp || 'processed';
            await peer.setRemoteDescription(new RTCSessionDescription(offerToUse));
            await drainQueuedCandidates();
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            sendToNative({ type: 'ANSWER_CREATED', sdp: peer.localDescription, callId: callId });
          }
        }

        else if (action === 'SET_REMOTE_SDP') {
          stopTones();
          const sdp = payload.sdp;
          const callId = payload.callId || currentCallId;
          const callType = payload.callType || currentCallType || 'audio';
          if (!sdp) return;

          if (sdp.type === 'offer') {
            if (processedOfferSdp && sdp.sdp && processedOfferSdp === sdp.sdp) {
              return;
            }
            if (!pc) {
              pendingRemoteSdp = sdp;
              return;
            }
            processedOfferSdp = sdp.sdp || 'processed';
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainQueuedCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendToNative({ type: 'ANSWER_CREATED', sdp: pc.localDescription, callId: callId });
            return;
          }

          if (sdp.type === 'answer') {
            if (!pc) {
              pendingRemoteSdp = sdp;
              return;
            }
            if (processedAnswerSdp && sdp.sdp && processedAnswerSdp === sdp.sdp) {
              return;
            }
            if (pc.signalingState !== 'have-local-offer') {
              return;
            }
            processedAnswerSdp = sdp.sdp || 'processed';
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainQueuedCandidates();
          }
        }

        else if (action === 'ADD_ICE_CANDIDATE') {
          const candidate = payload.candidate;
          if (candidate) {
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch(e) {
                console.warn('addIceCandidate error', e);
              }
            } else {
              queuedCandidates.push(candidate);
            }
          }
        }

        else if (action === 'SET_MUTED') {
          const muted = Boolean(payload.muted);
          if (localStream) {
            localStream.getAudioTracks().forEach(function(track) { track.enabled = !muted; });
          }
        }

        else if (action === 'END_CALL') {
          stopTones();
          playEndTone();
          queuedCandidates = [];
          pendingRemoteSdp = null;
          currentCallId = null;
          offerCreatedForCallId = null;
          processedOfferSdp = null;
          processedAnswerSdp = null;
          if (localStream) {
            localStream.getTracks().forEach(function(t) { try { t.stop(); } catch(e){} });
            localStream = null;
          }
          if (pc) {
            try { pc.close(); } catch(e){}
            pc = null;
          }
          remoteStream = null;
        }
      } catch (err) {
        console.error('WebRTC bridge error:', err);
        sendToNative({ type: 'ERROR', message: err.message });
      }
    };
  </script>
</body>
</html>
`;

export const WebRtcBridge = forwardRef(({ onMessage }, ref) => {
  const webViewRef = useRef(null);

  const htmlSource = useMemo(() => {
    return {
      html: buildWebRtcHtml(RINGTONE_OPPO_BASE64),
      baseUrl: "https://chuyenbienhoa.com",
    };
  }, []);

  useImperativeHandle(ref, () => ({
    sendMessage: (action, payload = {}) => {
      if (webViewRef.current) {
        const json = JSON.stringify({ action, payload });
        webViewRef.current.injectJavaScript(
          `if (window.handleNativeMessage) { window.handleNativeMessage(${JSON.stringify(json)}); } true;`
        );
      }
    },
  }));

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.warn("[WebRtcBridge] Parse error:", e);
    }
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={htmlSource}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        androidLayerType="hardware"
        mediaCapturePermissionGrantType="grant"
        onMessage={handleMessage}
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
    zIndex: -999,
  },
});
