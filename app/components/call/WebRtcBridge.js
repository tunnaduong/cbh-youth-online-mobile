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
    let pc = null;
    let localStream = null;
    let audioCtx = null;
    let ringOscillator = null;
    let ringInterval = null;
    let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    let queuedCandidates = [];
    let pendingRemoteSdp = null;

    function sendToNative(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function initAudioContext() {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
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
    }

    function playTone(freq1, freq2, duration, type = 'sine') {
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
      } catch(e) {
        console.warn('Tone error:', e);
      }
    }

    function startOutgoingRing() {
      stopTones();
      playTone(440, 480, 1.8);
      ringInterval = setInterval(() => {
        playTone(440, 480, 1.8);
      }, 4000);
    }

    function startIncomingRing() {
      stopTones();
      const ringAudio = document.getElementById('ringtoneAudio');
      if (ringAudio) {
        ringAudio.currentTime = 0;
        const playPromise = ringAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(function(err) {
            console.warn('Ringtone audio play error, falling back to melodic tone', err);
            playTone(520, 650, 1.2);
            ringInterval = setInterval(() => {
              playTone(520, 650, 1.2);
            }, 3000);
          });
        }
      } else {
        playTone(520, 650, 1.2);
        ringInterval = setInterval(() => {
          playTone(520, 650, 1.2);
        }, 3000);
      }
    }

    function playConnectedTone() {
      stopTones();
      playTone(660, 880, 0.4);
    }

    function playEndTone() {
      stopTones();
      playTone(425, null, 0.25);
      setTimeout(() => playTone(425, null, 0.25), 350);
      setTimeout(() => playTone(425, null, 0.35), 700);
    }

    async function acquireLocalMedia(callType) {
      if (localStream) return localStream;
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
    }

    async function drainQueuedCandidates() {
      if (!pc || !pc.remoteDescription) return;
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
      pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendToNative({ type: 'ICE_CANDIDATE', candidate: event.candidate, callId });
        }
      };

      pc.ontrack = (event) => {
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio) {
          if (event.streams && event.streams[0]) {
            remoteAudio.srcObject = event.streams[0];
          } else {
            remoteAudio.srcObject = new MediaStream([event.track]);
          }
          remoteAudio.play().catch(e => console.warn('Remote play error', e));
        }
        sendToNative({ type: 'REMOTE_STREAM_READY' });
      };

      pc.onconnectionstatechange = () => {
        sendToNative({ type: 'CONNECTION_STATE_CHANGE', state: pc.connectionState });
        if (pc.connectionState === 'connected') {
          playConnectedTone();
        }
      };

      return pc;
    }

    window.handleNativeMessage = async function(msg) {
      try {
        const { action, payload } = JSON.parse(msg);

        if (action === 'SET_ICE_SERVERS') {
          if (Array.isArray(payload)) iceServers = payload;
        }

        else if (action === 'START_OUTGOING_CALL') {
          initAudioContext();
          startOutgoingRing();
          queuedCandidates = [];
          pendingRemoteSdp = null;
          const { callId, callType } = payload;
          const stream = await acquireLocalMedia(callType);
          const peer = createPeerConnection(callId);
          stream.getTracks().forEach(track => peer.addTrack(track, stream));

          const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
          await peer.setLocalDescription(offer);
          sendToNative({ type: 'OFFER_CREATED', sdp: offer, callId });
        }

        else if (action === 'START_INCOMING_RING') {
          initAudioContext();
          startIncomingRing();
        }

        else if (action === 'ANSWER_INCOMING_CALL') {
          stopTones();
          const { callId, callType, remoteOffer } = payload;
          const offerToUse = remoteOffer || pendingRemoteSdp;
          const stream = await acquireLocalMedia(callType);
          const peer = createPeerConnection(callId);
          stream.getTracks().forEach(track => peer.addTrack(track, stream));

          if (offerToUse) {
            await peer.setRemoteDescription(new RTCSessionDescription(offerToUse));
            await drainQueuedCandidates();
          }
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendToNative({ type: 'ANSWER_CREATED', sdp: answer, callId });
        }

        else if (action === 'SET_REMOTE_SDP') {
          const { sdp } = payload;
          pendingRemoteSdp = sdp;
          if (pc && sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainQueuedCandidates();
          }
        }

        else if (action === 'ADD_ICE_CANDIDATE') {
          const { candidate } = payload;
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
          const { muted } = payload;
          if (localStream) {
            localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
          }
        }

        else if (action === 'END_CALL') {
          stopTones();
          playEndTone();
          queuedCandidates = [];
          pendingRemoteSdp = null;
          if (localStream) {
            localStream.getTracks().forEach(t => { try { t.stop(); } catch(e){} });
            localStream = null;
          }
          if (pc) {
            try { pc.close(); } catch(e){}
            pc = null;
          }
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
    return { html: buildWebRtcHtml(RINGTONE_OPPO_BASE64) };
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
