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
<body style="background:transparent;margin:0;padding:0;overflow:hidden;">
  <video id="remoteVideoAudio" autoplay playsinline style="position:fixed;top:-1000px;left:-1000px;width:2px;height:2px;opacity:0.01;pointer-events:none;"></video>
  <audio id="ringtoneAudio" loop playsinline preload="auto" src="data:audio/mp3;base64,${base64Audio}"></audio>
  <script>
    const DEFAULT_ICE_SERVERS = [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    let pc = null;
    let localStream = null;
    let remoteStream = null;
    let audioCtx = null;
    let remoteGainNode = null;
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
    let isMutedState = false;
    let isSpeakerState = false;
    // true = the direct connection carries the voice; false = use the HTTP relay
    let webrtcAudioReceiving = true;
    let transportDownSeconds = 0;
    let lastRelayAseq = 0;
    let recentRelayChunkKeys = [];
    let lastInboundBytes = 0;
    let statsInterval = null;
    let captureProcessor = null;
    let captureSource = null;
    let captureGainSilent = null;
    let nextRelayPlayTime = 0;
    let commandQueue = Promise.resolve();

    function filterDeadIceServers(list) {
      if (!Array.isArray(list)) return DEFAULT_ICE_SERVERS.slice();
      const filtered = list.filter(function(item) {
        if (!item || !item.urls) return false;
        const s = JSON.stringify(item.urls);
        return s.indexOf('openrelay.metered.ca') === -1;
      });
      return filtered.length > 0 ? filtered : DEFAULT_ICE_SERVERS.slice();
    }

    function enhanceSdpOpus(sdpStr) {
      if (!sdpStr || typeof sdpStr !== 'string') return sdpStr;
      return sdpStr.replace(/a=fmtp:111 (.*)/g, function(match, params) {
        let next = params;
        if (next.indexOf('useinbandfec=') === -1) next += ';useinbandfec=1';
        if (next.indexOf('maxaveragebitrate=') === -1) next += ';maxaveragebitrate=64000';
        return 'a=fmtp:111 ' + next;
      });
    }

    function serializeSdp(desc) {
      if (!desc) return null;
      return {
        type: desc.type,
        sdp: enhanceSdpOpus(desc.sdp)
      };
    }

    function serializeCandidate(cand) {
      if (!cand) return null;
      const inner = (cand.candidate && typeof cand.candidate === 'object') ? cand.candidate : cand;
      return {
        candidate: inner.candidate,
        sdpMid: inner.sdpMid != null ? inner.sdpMid : null,
        sdpMLineIndex: inner.sdpMLineIndex != null ? inner.sdpMLineIndex : null,
        usernameFragment: inner.usernameFragment != null ? inner.usernameFragment : null
      };
    }

    function sendToNative(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function initAudioContext() {
      try {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
          }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(function(){});
        }
        if (audioCtx && !remoteGainNode) {
          remoteGainNode = audioCtx.createGain();
          remoteGainNode.gain.value = 1;
          remoteGainNode.connect(audioCtx.destination);
        }
      } catch(e) {}
    }

    // G.711 mu-law encode/decode for ultra-lightweight 8kHz voice fallback relay
    function linearToUlaw(sample) {
      const BIAS = 0x84;
      const CLIP = 32635;
      let sign = (sample >> 8) & 0x80;
      if (sign !== 0) sample = -sample;
      if (sample > CLIP) sample = CLIP;
      sample = sample + BIAS;
      let exponent = 7;
      for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
      let mantissa = (sample >> (exponent + 3)) & 0x0F;
      return (~(sign | (exponent << 4) | mantissa)) & 0xFF;
    }

    function ulawToLinear(uVal) {
      uVal = (~uVal) & 0xFF;
      let t = ((uVal & 0x0F) << 3) + 0x84;
      t <<= ((uVal & 0x70) >> 4);
      return (uVal & 0x80) ? (0x84 - t) : (t - 0x84);
    }

    function startAudioFallbackCapture(stream, callId) {
      stopAudioFallbackCapture();
      if (!stream || stream.getAudioTracks().length === 0) return;
      try {
        initAudioContext();
        if (!audioCtx) return;
        const inRate = audioCtx.sampleRate || 48000;
        const outRate = 8000;
        captureSource = audioCtx.createMediaStreamSource(stream);
        captureProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
        captureGainSilent = audioCtx.createGain();
        captureGainSilent.gain.value = 0;

        let sampleBuf = [];
        let bufSumSq = 0;
        let lastSentAt = 0;

        captureProcessor.onaudioprocess = function(e) {
          if (isMutedState || webrtcAudioReceiving || !currentCallId) {
            sampleBuf = [];
            bufSumSq = 0;
            return;
          }
          const input = e.inputBuffer.getChannelData(0);
          const ratio = inRate / outRate;
          for (let i = 0; i < input.length; i += ratio) {
            // Average the source samples behind each 8 kHz sample: taking one
            // in six without filtering folds high frequencies back as noise.
            const from = Math.floor(i);
            const to = Math.min(input.length, Math.max(from + 1, Math.floor(i + ratio)));
            let acc = 0;
            for (let k = from; k < to; k++) acc += input[k];
            const s = acc / (to - from);
            bufSumSq += s * s;
            const pcm16 = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
            sampleBuf.push(linearToUlaw(pcm16));
          }

          const now = Date.now();
          if (sampleBuf.length >= 2000 && (now - lastSentAt) >= 220) {
            lastSentAt = now;
            const chunkBytes = sampleBuf.splice(0, sampleBuf.length);
            // Skip transmitting total silence to save bandwidth
            const rms = Math.sqrt(bufSumSq / Math.max(1, chunkBytes.length));
            bufSumSq = 0;
            if (rms < 0.002) return;
            let binary = '';
            for (let j = 0; j < chunkBytes.length; j++) {
              binary += String.fromCharCode(chunkBytes[j]);
            }
            sendToNative({
              type: 'AUDIO_CHUNK',
              callId: callId || currentCallId,
              chunk: btoa(binary),
              sampleRate: outRate
            });
          }
        };

        captureSource.connect(captureProcessor);
        captureProcessor.connect(captureGainSilent);
        captureGainSilent.connect(audioCtx.destination);
      } catch (e) {}
    }

    function stopAudioFallbackCapture() {
      if (captureProcessor) {
        try { captureProcessor.disconnect(); captureProcessor.onaudioprocess = null; } catch(e){}
        captureProcessor = null;
      }
      if (captureSource) {
        try { captureSource.disconnect(); } catch(e){}
        captureSource = null;
      }
      if (captureGainSilent) {
        try { captureGainSilent.disconnect(); } catch(e){}
        captureGainSilent = null;
      }
    }

    function playIncomingAudioChunk(payload) {
      if (webrtcAudioReceiving || !payload) return;
      const b64 = typeof payload === 'string' ? payload : (payload.d || payload.chunk);
      if (!b64) return;

      // One chunk reaches us up to three times (user channel, conversation
      // channel, HTTP poll). Play it once, and never one older than the last.
      const seq = Number(payload && payload.aseq) || 0;
      if (seq) {
        if (seq <= lastRelayAseq) return;
        lastRelayAseq = seq;
      }
      const key = b64.length + ':' + b64.slice(0, 32) + ':' + b64.slice(-32);
      if (recentRelayChunkKeys.indexOf(key) !== -1) return;
      recentRelayChunkKeys.push(key);
      if (recentRelayChunkKeys.length > 64) recentRelayChunkKeys.shift();

      const sr = (payload && payload.sr) || (payload && payload.sampleRate) || 8000;
      try {
        initAudioContext();
        if (!audioCtx) return;
        const bin = atob(b64);
        const len = bin.length;
        if (len === 0) return;
        const audioBuffer = audioCtx.createBuffer(1, len, sr);
        const channel = audioBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
          channel[i] = ulawToLinear(bin.charCodeAt(i)) / 32768.0;
        }
        const now = audioCtx.currentTime;
        let startAt = nextRelayPlayTime;
        if (startAt < now + 0.02) {
          // Queue ran dry: wait a little so the next chunks, which arrive
          // unevenly over HTTP, play back to back instead of with gaps.
          startAt = now + 0.18;
        } else if (startAt > now + 1.2) {
          // More than a second queued: drop this chunk to catch up, rather
          // than letting the delay grow or playing it over the queued audio.
          return;
        }
        const src = audioCtx.createBufferSource();
        src.buffer = audioBuffer;
        src.connect(remoteGainNode || audioCtx.destination);
        src.start(startAt);
        nextRelayPlayTime = startAt + audioBuffer.duration;
      } catch (e) {}
    }

    // The remote voice plays through ONE element. It used to go to an <audio>,
    // this <video> and a WebAudio graph at once; each output has its own delay,
    // so the voice came out doubled and echoing. The <video playsinline> is the
    // one kept because iOS WKWebView plays a remote stream reliably through it.
    function attachRemoteStreamToOutputs(stream) {
      if (!stream) return;
      const el = document.getElementById('remoteVideoAudio');
      if (!el) return;
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.muted = false;
      el.volume = 1.0;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function() {
          setTimeout(function() {
            try { el.play().catch(function(){}); } catch(e){}
          }, 250);
        });
      }
    }

    function applyTransportState(packetsFlowing) {
      if (!pc) return;
      const connected =
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed';
      if (connected || packetsFlowing) {
        transportDownSeconds = 0;
      } else {
        transportDownSeconds += 1;
      }
      // The HTTP relay (8 kHz, a quarter of a second per chunk, noticeably
      // delayed) is only used once the connection has been down for 3 seconds
      // in a row - not at every call start or short network blip.
      const useRelay = transportDownSeconds >= 3;
      webrtcAudioReceiving = !useRelay;

      // The microphone tap for the relay runs only while the relay is in use.
      if (useRelay) {
        initAudioContext();
        if (!captureProcessor && localStream) {
          startAudioFallbackCapture(localStream, currentCallId);
        }
      } else if (captureProcessor) {
        stopAudioFallbackCapture();
      }
    }

    function startStatsMonitor() {
      stopStatsMonitor();
      lastInboundBytes = 0;
      transportDownSeconds = 0;
      webrtcAudioReceiving = true;
      statsInterval = setInterval(function() {
        if (!pc) return;
        const el = document.getElementById('remoteVideoAudio');
        if (el && el.paused && el.srcObject) {
          try { el.play().catch(function(){}); } catch(e){}
        }
        if (typeof pc.getStats === 'function') {
          pc.getStats(null).then(function(stats) {
            let currentBytes = 0;
            stats.forEach(function(report) {
              if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.mediaType === 'audio')) {
                currentBytes += (report.bytesReceived || 0);
              }
            });
            const flowing = currentBytes > lastInboundBytes;
            lastInboundBytes = currentBytes;
            applyTransportState(flowing);
          }).catch(function() { applyTransportState(false); });
        } else {
          applyTransportState(false);
        }
      }, 1000);
    }

    function stopStatsMonitor() {
      if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
      }
      webrtcAudioReceiving = true;
      transportDownSeconds = 0;
      lastInboundBytes = 0;
    }

    // Keep the camera from using the whole uplink: on a weak connection an
    // uncapped video stream delays the audio packets queued behind it.
    function limitVideoBitrate(peer) {
      try {
        peer.getSenders().forEach(function(sender) {
          if (!sender.track || sender.track.kind !== 'video') return;
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) return;
          params.encodings[0].maxBitrate = 600000;
          sender.setParameters(params).catch(function(){});
        });
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
      } catch(e) {}
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
          playPromise.catch(function() {});
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
        localStream.getAudioTracks().forEach(function(t) { t.enabled = !isMutedState; });
        return localStream;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        sendToNative({ type: 'MEDIA_WARNING', message: 'mediaDevices unavailable, using recvonly fallback' });
        return null;
      }
      const attempts = [
        {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: callType === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false
        },
        {
          audio: true,
          video: callType === 'video'
        },
        {
          audio: true,
          video: false
        }
      ];
      for (let i = 0; i < attempts.length; i++) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia(attempts[i]);
          if (localStream) {
            localStream.getAudioTracks().forEach(function(t) { t.enabled = !isMutedState; });
            return localStream;
          }
        } catch (err) {}
      }
      sendToNative({ type: 'MEDIA_WARNING', message: 'getUserMedia failed, using recvonly' });
      return null;
    }

    function attachTracksOrTransceivers(peer, stream, callType) {
      if (stream && stream.getTracks().length > 0) {
        const existingTracks = peer.getSenders().map(function(s) { return s.track; }).filter(Boolean);
        stream.getTracks().forEach(function(track) {
          track.enabled = track.kind === 'audio' ? !isMutedState : true;
          if (existingTracks.indexOf(track) === -1) {
            peer.addTrack(track, stream);
          }
        });
        try {
          peer.getTransceivers().forEach(function(t) {
            if (t.sender && t.sender.track && t.direction !== 'sendrecv') {
              t.direction = 'sendrecv';
            }
          });
        } catch(e) {}
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
          const norm = serializeCandidate(candidate);
          if (norm && norm.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(norm));
          }
        } catch(e) {}
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
          sendToNative({
            type: 'ICE_CANDIDATE',
            candidate: serializeCandidate(event.candidate),
            callId: callId || currentCallId
          });
        }
      };

      pc.ontrack = function(event) {
        stopTones();
        // Ask for the smallest playout buffer the network allows (the browser
        // still grows it when packets arrive unevenly).
        try {
          if (event.receiver) {
            if ('jitterBufferTarget' in event.receiver) {
              event.receiver.jitterBufferTarget = 0;
            } else if ('playoutDelayHint' in event.receiver) {
              event.receiver.playoutDelayHint = 0;
            }
          }
        } catch(e) {}
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach(function(t) {
            if (remoteStream.getTracks().indexOf(t) === -1) {
              remoteStream.addTrack(t);
            }
          });
        } else if (event.track) {
          if (remoteStream.getTracks().indexOf(event.track) === -1) {
            remoteStream.addTrack(event.track);
          }
        }
        attachRemoteStreamToOutputs(remoteStream);
        sendToNative({ type: 'REMOTE_STREAM_READY' });
      };

      pc.onconnectionstatechange = function() {
        if (!pc) return;
        sendToNative({ type: 'CONNECTION_STATE_CHANGE', state: pc.connectionState });
        if (pc.connectionState === 'connected') {
          transportDownSeconds = 0;
          webrtcAudioReceiving = true;
          playConnectedTone();
          attachRemoteStreamToOutputs(remoteStream);
        } else if (pc.connectionState === 'failed') {
          transportDownSeconds = 3;
          webrtcAudioReceiving = false;
        }
      };

      startStatsMonitor();
      return pc;
    }

    async function processNativeMessage(msg) {
      try {
        initAudioContext();
        const parsed = JSON.parse(msg);
        const action = parsed.action;
        const payload = parsed.payload || {};

        if (action === 'SET_ICE_SERVERS') {
          iceServers = filterDeadIceServers(payload);
        }

        else if (action === 'STOP_RINGING') {
          stopTones();
        }

        else if (action === 'START_OUTGOING_RING') {
          startOutgoingRing();
        }

        else if (action === 'START_INCOMING_RING') {
          startIncomingRing();
        }

        else if (action === 'START_OUTGOING_CALL') {
          stopTones();
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
          offer.sdp = enhanceSdpOpus(offer.sdp);
          await peer.setLocalDescription(offer);
          limitVideoBitrate(peer);
          sendToNative({
            type: 'OFFER_CREATED',
            sdp: serializeSdp(peer.localDescription),
            callId: callId
          });
        }

        else if (action === 'ANSWER_INCOMING_CALL') {
          stopTones();
          const callId = payload.callId;
          const callType = payload.callType || 'audio';
          const remoteOffer = payload.remoteOffer;
          currentCallId = callId;
          currentCallType = callType;

          const stream = await acquireLocalMedia(callType);
          const peer = pc || createPeerConnection(callId);
          attachTracksOrTransceivers(peer, stream, callType);

          const offerToUse = remoteOffer || pendingRemoteSdp;
          if (offerToUse && offerToUse.type === 'offer') {
            pendingRemoteSdp = null;
            processedOfferSdp = offerToUse.sdp || 'processed';
            await peer.setRemoteDescription(new RTCSessionDescription(offerToUse));
            await drainQueuedCandidates();
            const answer = await peer.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: callType === 'video'
            });
            answer.sdp = enhanceSdpOpus(answer.sdp);
            await peer.setLocalDescription(answer);
            limitVideoBitrate(peer);
            sendToNative({
              type: 'ANSWER_CREATED',
              sdp: serializeSdp(peer.localDescription),
              callId: callId
            });
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
            const stream = await acquireLocalMedia(callType);
            attachTracksOrTransceivers(pc, stream, callType);

            processedOfferSdp = sdp.sdp || 'processed';
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainQueuedCandidates();

            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: callType === 'video'
            });
            answer.sdp = enhanceSdpOpus(answer.sdp);
            await pc.setLocalDescription(answer);
            limitVideoBitrate(pc);
            sendToNative({
              type: 'ANSWER_CREATED',
              sdp: serializeSdp(pc.localDescription),
              callId: callId
            });
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
          const candidate = payload.candidate || payload;
          if (candidate) {
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                const norm = serializeCandidate(candidate);
                if (norm && norm.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(norm));
                }
              } catch(e) {}
            } else {
              queuedCandidates.push(candidate);
            }
          }
        }

        else if (action === 'PLAY_AUDIO_CHUNK') {
          playIncomingAudioChunk(payload);
        }

        else if (action === 'SET_MUTED') {
          isMutedState = Boolean(payload.muted);
          if (localStream) {
            localStream.getAudioTracks().forEach(function(track) { track.enabled = !isMutedState; });
          }
        }

        else if (action === 'SET_SPEAKER') {
          isSpeakerState = Boolean(payload.enabled);
          if (remoteStream) {
            attachRemoteStreamToOutputs(remoteStream);
          }
        }

        else if (action === 'END_CALL') {
          stopTones();
          stopStatsMonitor();
          stopAudioFallbackCapture();
          playEndTone();
          queuedCandidates = [];
          pendingRemoteSdp = null;
          currentCallId = null;
          offerCreatedForCallId = null;
          processedOfferSdp = null;
          processedAnswerSdp = null;
          isMutedState = false;
          isSpeakerState = false;
          nextRelayPlayTime = 0;
          lastRelayAseq = 0;
          recentRelayChunkKeys = [];
          try {
            const el = document.getElementById('remoteVideoAudio');
            if (el) el.srcObject = null;
          } catch(e) {}
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
        sendToNative({ type: 'ERROR', message: err.message });
      }
    }

    window.handleNativeMessage = function(msg) {
      commandQueue = commandQueue.then(function() {
        return processNativeMessage(msg);
      }).catch(function() {});
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
    width: 2,
    height: 2,
    opacity: 0.02,
    bottom: 0,
    right: 0,
    zIndex: -999,
  },
});
