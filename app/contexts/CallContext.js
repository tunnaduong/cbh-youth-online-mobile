import { askIgnoreBatteryOptimizationsOnce } from "../utils/batteryOptimization";
import {
  setNativeBubbleSession,
  clearNativeBubbleSession,
  syncBubbleChatEnabled,
} from "../services/bubble/nativeBubble";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState, DeviceEventEmitter, Platform, PermissionsAndroid } from "react-native";
import { Camera } from "expo-camera";
import { AuthContext } from "./AuthContext";
import { getEcho } from "../services/echo/echo";
import {
  initiateCall as initiateCallApi,
  answerCall as answerCallApi,
  rejectCall as rejectCallApi,
  endCall as endCallApi,
  sendCallSignal as sendCallSignalApi,
  getIceServers as getIceServersApi,
  getActiveCall as getActiveCallApi,
} from "../services/call/callService";
import {
  startRingtoneVibration,
  stopRingtoneVibration,
  playCallConnectedHaptic,
  playCallEndedHaptic,
} from "../utils/callSounds";
import { WebRtcBridge } from "../components/call/WebRtcBridge";
import IncomingCallModal from "../components/call/IncomingCallModal";
import ActiveCallModal from "../components/call/ActiveCallModal";
import Toast from "react-native-toast-message";
import { CALL_FEATURES_ENABLED } from "../services/call/callConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../services/api/axiosInstance";
import { storage } from "../global/storage";
import i18n from "../i18n";
import { rememberVoipToken } from "../utils/pushToken";
import {
  nativeCallUiAvailable,
  ringsThroughCallKit,
  setNativeCallSession,
  clearNativeCallSession,
  reportIncomingCallToOs,
  dismissOsIncomingCall,
  markAnsweredInApp,
  osCallEnded,
  getVoipToken,
  consumePendingCallActions,
  addCallActionListener,
  addVoipTokenListener,
  canUseFullScreenIntent,
  openFullScreenIntentSettings,
} from "../services/call/nativeCallUi";
import { registerVoipPushToken } from "../services/api/Api";

export const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

async function ensureNativeCallPermissions(type = "audio") {
  try {
    if (Platform.OS === "android") {
      const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (type === "video") {
        perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
      await PermissionsAndroid.requestMultiple(perms);
    } else {
      await Camera.requestMicrophonePermissionsAsync();
      if (type === "video") {
        await Camera.requestCameraPermissionsAsync();
      }
    }
  } catch (err) {
    console.warn("[CallContext] Native permission request warning:", err?.message);
  }
}

export const CallProvider = ({ children }) => {
  const { isLoggedIn, userInfo } = useContext(AuthContext);

  const [callStatus, setCallStatus] = useState("idle"); // 'idle' | 'calling' | 'ringing' | 'ringingOutward' | 'connected' | 'ended'
  const [callType, setCallType] = useState("audio"); // 'audio' | 'video'
  const [activeCall, setActiveCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const bridgeRef = useRef(null);
  // Whether the bridge's peer connection is up (slows the HTTP poll down)
  const transportConnectedRef = useRef(false);
  const timerRef = useRef(null);
  const activeCallRef = useRef(null);
  const conversationChannelRef = useRef(null);
  const pendingRemoteOfferRef = useRef(null);
  const callStatusRef = useRef("idle");
  const ringingTimeoutRef = useRef(null);
  const connectingTimeoutRef = useRef(null);
  const ringingRetryTimersRef = useRef([]);
  const ringingAckReceivedRef = useRef(false);
  const offerStartedForCallRef = useRef(null);
  const sdpChunksBufferRef = useRef({});
  const processedSignalSeqRef = useRef(0);
  const processedAudioSeqRef = useRef(0);
  const processedCandidatesSetRef = useRef(new Set());
  const callTypeRef = useRef("audio");
  // iOS: answered in CallKit while the app was in the background / locked -
  // the WebView can only use the microphone once the app is in front.
  const pendingOsAnswerRef = useRef(null);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  const clearConnectingTimeout = useCallback(() => {
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }
  }, []);

  const clearRingingTimeout = useCallback(() => {
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
  }, []);

  const clearRingingRetryTimers = useCallback(() => {
    ringingRetryTimersRef.current.forEach((t) => clearTimeout(t));
    ringingRetryTimersRef.current = [];
  }, []);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Fetch STUN/TURN ICE servers on mount
  useEffect(() => {
    if (!isLoggedIn) return;
    getIceServersApi()
      .then((res) => {
        const servers = res?.data?.ice_servers || res?.data;
        if (Array.isArray(servers)) {
          bridgeRef.current?.sendMessage("SET_ICE_SERVERS", servers);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // Duration timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);
  }, []);

  // Cleanup helper
  const cleanupCallState = useCallback(() => {
    if (activeCallRef.current?.id != null) {
      osCallEnded(activeCallRef.current.id);
    }
    pendingOsAnswerRef.current = null;
    clearConnectingTimeout();
    clearRingingTimeout();
    clearRingingRetryTimers();
    ringingAckReceivedRef.current = false;
    offerStartedForCallRef.current = null;
    sdpChunksBufferRef.current = {};
    processedSignalSeqRef.current = 0;
    processedAudioSeqRef.current = 0;
    processedCandidatesSetRef.current = new Set();
    bridgeRef.current?.sendMessage("STOP_RINGING");
    pendingRemoteOfferRef.current = null;
    stopTimer();
    stopRingtoneVibration();
    bridgeRef.current?.sendMessage("END_CALL");
    if (conversationChannelRef.current) {
      try {
        conversationChannelRef.current
          .stopListening(".call.answered")
          .stopListening(".call.rejected")
          .stopListening(".call.ended")
          .stopListening(".call.signaled");
      } catch (e) {}
      conversationChannelRef.current = null;
    }
    activeCallRef.current = null;
    setActiveCall(null);
    callStatusRef.current = "idle";
    setCallStatus("idle");
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsMinimized(false);
  }, [
    clearConnectingTimeout,
    clearRingingTimeout,
    clearRingingRetryTimers,
    stopTimer,
  ]);

  const endCall = useCallback(async () => {
    try {
      stopRingtoneVibration();
      playCallEndedHaptic();
      const call = activeCallRef.current;
      cleanupCallState();
      if (call?.id) {
        await endCallApi(call.id);
      }
    } catch (err) {
      console.warn("[CallContext] endCall error:", err);
    }
  }, [cleanupCallState]);

  const startOutgoingRingingPhase = useCallback(() => {
    clearConnectingTimeout();
    if (callStatusRef.current === "calling") {
      callStatusRef.current = "ringingOutward";
      setCallStatus("ringingOutward");
      bridgeRef.current?.sendMessage("START_OUTGOING_RING");

      clearRingingTimeout();
      ringingTimeoutRef.current = setTimeout(() => {
        if (
          activeCallRef.current &&
          (callStatusRef.current === "calling" ||
            callStatusRef.current === "ringing" ||
            callStatusRef.current === "ringingOutward")
        ) {
          console.log(
            "[CallContext] 60s ringing timeout without answer -> auto end call"
          );
          Toast.show({
            type: "info",
            text1: "Người nhận không trả lời",
            visibilityTime: 2500,
          });
          endCall();
        }
      }, 60000);
    }
  }, [clearConnectingTimeout, clearRingingTimeout, endCall]);

  // Shared event handlers for both user private channel, conversation presence channel, and HTTP sync
  const handleCallAnsweredEvent = useCallback(
    (data) => {
      const callData = data?.call || data;
      const current = activeCallRef.current;
      if (!current) return;
      if (
        current.id &&
        callData?.id &&
        String(current.id) !== String(callData.id)
      ) {
        return;
      }

      clearConnectingTimeout();
      clearRingingTimeout();
      clearRingingRetryTimers();
      stopRingtoneVibration();
      bridgeRef.current?.sendMessage("STOP_RINGING");

      const isCaller =
        Boolean(
          userInfo?.id &&
            (String(current.caller?.id) === String(userInfo.id) ||
              String(current.caller_id) === String(userInfo.id) ||
              String(callData?.caller?.id) === String(userInfo.id))
        ) || Boolean(!current.caller && current.receiver);

      if (isCaller) {
        const callId = callData?.id || current.id;
        if (callId && offerStartedForCallRef.current !== String(callId)) {
          offerStartedForCallRef.current = String(callId);
          bridgeRef.current?.sendMessage("START_OUTGOING_CALL", {
            callId,
            callType: callTypeRef.current,
          });
        }
      }

      if (callStatusRef.current !== "connected") {
        playCallConnectedHaptic();
        callStatusRef.current = "connected";
        setCallStatus("connected");
        startTimer();
      }
    },
    [
      userInfo?.id,
      clearConnectingTimeout,
      clearRingingTimeout,
      clearRingingRetryTimers,
      startTimer,
    ]
  );

  const handleCallRejectedEvent = useCallback(
    (data) => {
      const current = activeCallRef.current;
      if (!current) return;
      if (
        current.id &&
        data?.call_id &&
        String(current.id) !== String(data.call_id)
      ) {
        return;
      }
      stopRingtoneVibration();
      playCallEndedHaptic();
      Toast.show({
        type: "info",
        text1:
          data?.reason === "busy"
            ? "Người nhận hiện đang bận"
            : "Cuộc gọi đã bị từ chối",
        visibilityTime: 2500,
      });
      cleanupCallState();
    },
    [cleanupCallState]
  );

  const handleCallEndedEvent = useCallback(
    (data) => {
      const callData = data?.call;
      const current = activeCallRef.current;
      if (!current) return;
      if (
        current.id &&
        callData?.id &&
        String(current.id) !== String(callData.id)
      ) {
        return;
      }
      stopRingtoneVibration();
      playCallEndedHaptic();
      cleanupCallState();
    },
    [cleanupCallState]
  );

  const handleCallSignaledEvent = useCallback(
    (data) => {
      const current = activeCallRef.current;
      if (!current) return;
      if (
        current.id &&
        data?.call_id &&
        String(current.id) !== String(data.call_id)
      ) {
        return;
      }
      if (
        data?.conversation_id &&
        current.conversation_id &&
        String(data.conversation_id) !== String(current.conversation_id)
      ) {
        return;
      }
      if (
        userInfo?.id &&
        data?.sender_id &&
        String(data.sender_id) === String(userInfo.id)
      ) {
        return;
      }

      let type = data?.type;
      let payload = data?.payload;

      if (type === "sdp_chunk" && payload) {
        const {
          chunk_group_id,
          chunk_index,
          total_chunks,
          original_type,
          chunk,
        } = payload;
        if (!chunk_group_id || typeof chunk_index !== "number") return;
        if (!sdpChunksBufferRef.current[chunk_group_id]) {
          sdpChunksBufferRef.current[chunk_group_id] = {
            total: total_chunks,
            parts: {},
          };
        }
        sdpChunksBufferRef.current[chunk_group_id].parts[chunk_index] = chunk;
        const group = sdpChunksBufferRef.current[chunk_group_id];
        if (Object.keys(group.parts).length < group.total) {
          return;
        }
        try {
          let fullJson = "";
          for (let i = 0; i < group.total; i++) {
            fullJson += group.parts[i] || "";
          }
          delete sdpChunksBufferRef.current[chunk_group_id];
          type = original_type;
          payload = JSON.parse(fullJson);
        } catch (e) {
          return;
        }
      }

      if (type === "ringing") {
        console.log("[CallContext] Callee received call and started ringing.");
        ringingAckReceivedRef.current = true;
        if (callStatusRef.current === "calling") {
          startOutgoingRingingPhase();
        }
        return;
      } else if (type === "candidate") {
        if (!payload || !payload.candidate) return;
        const candKey = payload.candidate;
        if (processedCandidatesSetRef.current.has(candKey)) return;
        processedCandidatesSetRef.current.add(candKey);
        bridgeRef.current?.sendMessage("ADD_ICE_CANDIDATE", {
          candidate: payload,
        });
      } else if (type === "offer") {
        pendingRemoteOfferRef.current = payload;
        bridgeRef.current?.sendMessage("SET_REMOTE_SDP", {
          sdp: payload,
          callId: data?.call_id || current.id,
          callType: callTypeRef.current,
        });
      } else if (type === "answer") {
        bridgeRef.current?.sendMessage("STOP_RINGING");
        bridgeRef.current?.sendMessage("SET_REMOTE_SDP", {
          sdp: payload,
          callId: data?.call_id || current.id,
          callType: callTypeRef.current,
        });
      } else if (type === "audio_chunk" && payload) {
        bridgeRef.current?.sendMessage("PLAY_AUDIO_CHUNK", payload);
      }
    },
    [userInfo?.id, startOutgoingRingingPhase]
  );

  // Continuous HTTP signal & call state sync while a call is active
  // (guarantees 100% signal delivery even if WebSocket drops or SDP exceeds Reverb limits)
  useEffect(() => {
    if (!isLoggedIn || callStatus === "idle") return;

    let cancelled = false;
    const syncCallSignals = async () => {
      const cur = activeCallRef.current;
      if (!cur?.id || cancelled) return;

      try {
        const res = await getActiveCallApi(cur.id);
        if (cancelled) return;
        const remoteCall = res?.data?.call;
        const signals = res?.data?.signals;
        const audioChunks = res?.data?.audio_chunks;

        if (Array.isArray(signals)) {
          for (const sig of signals) {
            if (sig.seq && sig.seq > processedSignalSeqRef.current) {
              processedSignalSeqRef.current = sig.seq;
            }
            if (String(sig.sender_id) !== String(userInfo?.id)) {
              handleCallSignaledEvent(sig);
            }
          }
        }

        if (Array.isArray(audioChunks)) {
          for (const chunk of audioChunks) {
            if (chunk.aseq && chunk.aseq <= processedAudioSeqRef.current) {
              continue;
            }
            if (chunk.aseq) {
              processedAudioSeqRef.current = chunk.aseq;
            }
            if (String(chunk.sender_id) !== String(userInfo?.id) && chunk.payload) {
              // aseq lets the bridge drop a chunk it already played from the socket
              bridgeRef.current?.sendMessage(
                "PLAY_AUDIO_CHUNK",
                typeof chunk.payload === "object"
                  ? { ...chunk.payload, aseq: chunk.aseq }
                  : chunk.payload
              );
            }
          }
        }

        if (remoteCall && String(remoteCall.id) === String(cur.id)) {
          if (
            remoteCall.status === "accepted" &&
            String(remoteCall.caller?.id) === String(userInfo?.id)
          ) {
            handleCallAnsweredEvent({ call: remoteCall });
          } else if (
            remoteCall.status === "rejected" ||
            remoteCall.status === "busy"
          ) {
            handleCallRejectedEvent({
              call_id: remoteCall.id,
              reason: remoteCall.end_reason || remoteCall.status,
            });
          } else if (
            remoteCall.status === "ended" ||
            remoteCall.status === "cancelled" ||
            remoteCall.status === "missed"
          ) {
            handleCallEndedEvent({ call: remoteCall });
          }
        }
      } catch {}
    };

    // Poll fast while the call is being set up or runs on the relay; once the
    // direct connection is up the poll only watches for the call ending, so it
    // slows down and stops competing with the audio for the connection.
    let timer = null;
    const loop = async () => {
      await syncCallSignals();
      if (cancelled) return;
      const settled =
        callStatusRef.current === "connected" && transportConnectedRef.current;
      timer = setTimeout(loop, settled ? 5000 : 1200);
    };
    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    isLoggedIn,
    callStatus,
    activeCall?.id,
    userInfo?.id,
    handleCallSignaledEvent,
    handleCallAnsweredEvent,
    handleCallRejectedEvent,
    handleCallEndedEvent,
  ]);

  // Join chat presence channel for call signals & status changes
  const joinConversationPresence = useCallback(
    (conversationId) => {
      const echo = getEcho();
      if (!echo || !conversationId) return;

      const channel = echo.join(`chat.${conversationId}`);
      conversationChannelRef.current = channel;

      try {
        channel
          .stopListening(".call.answered")
          .stopListening(".call.rejected")
          .stopListening(".call.ended")
          .stopListening(".call.signaled");
      } catch (e) {}

      channel
        .listen(".call.answered", handleCallAnsweredEvent)
        .listen(".call.rejected", handleCallRejectedEvent)
        .listen(".call.ended", handleCallEndedEvent)
        .listen(".call.signaled", handleCallSignaledEvent);
    },
    [
      handleCallAnsweredEvent,
      handleCallRejectedEvent,
      handleCallEndedEvent,
      handleCallSignaledEvent,
    ]
  );

  const scheduleRingingRetries = useCallback(
    (callId) => {
      if (!callId) return;
      sendCallSignalApi(callId, "ringing", {}).catch(() => {});
      clearRingingRetryTimers();
      ringingRetryTimersRef.current = [
        setTimeout(() => {
          if (
            callStatusRef.current === "ringing" &&
            String(activeCallRef.current?.id) === String(callId)
          ) {
            sendCallSignalApi(callId, "ringing", {}).catch(() => {});
          }
        }, 1500),
        setTimeout(() => {
          if (
            callStatusRef.current === "ringing" &&
            String(activeCallRef.current?.id) === String(callId)
          ) {
            sendCallSignalApi(callId, "ringing", {}).catch(() => {});
          }
        }, 3500),
      ];
    },
    [clearRingingRetryTimers]
  );

  // In-app ringing (JS ringtone + IncomingCallModal) - or, where the OS shows
  // its own call UI, hand the ringing to it so the phone doesn't ring twice:
  // - iOS: CallKit rings (a no-op when the VoIP push already reported it);
  // - Android: the full-screen call notification rings while the app is in
  //   the background; once the app is in front JS rings and drops it.
  const startLocalRinging = useCallback((call) => {
    if (ringsThroughCallKit) {
      reportIncomingCallToOs(call);
      return;
    }
    if (nativeCallUiAvailable && AppState.currentState !== "active") return;
    startRingtoneVibration();
    bridgeRef.current?.sendMessage("START_INCOMING_RING");
    dismissOsIncomingCall(call.id);
  }, []);

  const beginIncomingRinging = useCallback(
    (call) => {
      processedSignalSeqRef.current = 0;
      activeCallRef.current = call;
      setActiveCall(call);
      callTypeRef.current = call.type || "audio";
      setCallType(call.type || "audio");
      callStatusRef.current = "ringing";
      setCallStatus("ringing");
      startLocalRinging(call);
      scheduleRingingRetries(call.id);

      // Auto-disconnect callee after 60s if not answered
      clearRingingTimeout();
      ringingTimeoutRef.current = setTimeout(() => {
        if (activeCallRef.current && callStatusRef.current === "ringing") {
          console.log(
            "[CallContext] Callee 60s timeout without answer -> stop ringing"
          );
          cleanupCallState();
        }
      }, 60000);

      // Join conversation presence channel to listen for call progression
      if (call.conversation_id) {
        joinConversationPresence(call.conversation_id, call.id);
      }
    },
    [
      startLocalRinging,
      scheduleRingingRetries,
      clearRingingTimeout,
      cleanupCallState,
      joinConversationPresence,
    ]
  );

  // Subscribe to user private channel to receive incoming calls and direct signaling
  useEffect(() => {
    if (!isLoggedIn || !userInfo?.id) return;

    const echo = getEcho();
    if (!echo) return;

    const userChannel = echo.private(`App.Models.User.${userInfo.id}`);

    const handleIncoming = (data) => {
      const call = data?.call || data?.callData || data;
      if (!call) return;
      if (
        userInfo?.id &&
        (String(call.caller?.id) === String(userInfo.id) ||
          String(call.caller_id) === String(userInfo.id))
      ) {
        return;
      }
      if (activeCallRef.current) {
        if (String(activeCallRef.current?.id) !== String(call.id)) {
          rejectCallApi(call.id, "busy").catch(() => {});
        }
        return;
      }

      if (!CALL_FEATURES_ENABLED) {
        console.log(
          "[CallContext] In demo/prod mode: suppressing incoming call auto-popup from socket broadcast."
        );
        return;
      }

      beginIncomingRinging(call);
    };

    userChannel
      .listen(".call.initiated", handleIncoming)
      .listen(".call.answered", handleCallAnsweredEvent)
      .listen(".call.rejected", handleCallRejectedEvent)
      .listen(".call.ended", handleCallEndedEvent)
      .listen(".call.signaled", handleCallSignaledEvent);

    return () => {
      try {
        userChannel
          .stopListening(".call.initiated")
          .stopListening(".call.answered")
          .stopListening(".call.rejected")
          .stopListening(".call.ended")
          .stopListening(".call.signaled");
      } catch (e) {}
    };
  }, [
    isLoggedIn,
    userInfo?.id,
    beginIncomingRinging,
    handleCallAnsweredEvent,
    handleCallRejectedEvent,
    handleCallEndedEvent,
    handleCallSignaledEvent,
  ]);

  // Actions
  const startCall = useCallback(
    async (conversationId, type = "audio", participant = null) => {
      if (!CALL_FEATURES_ENABLED) {
        Toast.show({
          type: "info",
          text1: "Tính năng gọi đang trong giai đoạn thử nghiệm",
          visibilityTime: 2500,
        });
        return;
      }
      try {
        if (!conversationId) return;

        await ensureNativeCallPermissions(type);

        ringingAckReceivedRef.current = false;
        offerStartedForCallRef.current = null;
        processedSignalSeqRef.current = 0;
        callTypeRef.current = type;
        setCallType(type);
        callStatusRef.current = "calling";
        setCallStatus("calling");

        // Synthesize temporary activeCall object for immediate UI response
        const placeholderCall = {
          conversation_id: conversationId,
          type,
          caller: userInfo
            ? {
                id: userInfo.id,
                username: userInfo.username,
                profile_name: userInfo.profile_name || userInfo.username,
              }
            : null,
          receiver: participant,
        };
        activeCallRef.current = placeholderCall;
        setActiveCall(placeholderCall);
        joinConversationPresence(conversationId);

        // 10s connection timeout: If backend/server or callee cannot connect within 10s
        clearConnectingTimeout();
        clearRingingTimeout();
        connectingTimeoutRef.current = setTimeout(() => {
          if (callStatusRef.current === "calling") {
            console.log(
              "[CallContext] Callee unreachable / server connect timeout after 10s."
            );
            Toast.show({
              type: "info",
              text1: "Không thể kết nối đến người kia",
              visibilityTime: 3000,
            });
            endCall();
          }
        }, 10000);

        const res = await initiateCallApi(conversationId, type);
        const callData = res?.data?.call || res?.data;
        const callId = callData?.id;

        if (callId) {
          const updatedCall = {
            ...callData,
            receiver: participant || callData.receiver,
          };
          activeCallRef.current = updatedCall;
          setActiveCall(updatedCall);
          joinConversationPresence(conversationId, callId);

          if (ringingAckReceivedRef.current) {
            startOutgoingRingingPhase();
          }
        }
      } catch (err) {
        console.error("[CallContext] initiateCall error:", err);
        Toast.show({
          type: "error",
          text1: "Không thể bắt đầu cuộc gọi",
          text2:
            err?.response?.data?.message ||
            err?.message ||
            "Vui lòng thử lại sau.",
        });
        cleanupCallState();
      }
    },
    [
      userInfo,
      clearConnectingTimeout,
      clearRingingTimeout,
      joinConversationPresence,
      startOutgoingRingingPhase,
      endCall,
      cleanupCallState,
    ]
  );

  const answerCall = useCallback(async () => {
    clearRingingTimeout();
    clearRingingRetryTimers();
    bridgeRef.current?.sendMessage("STOP_RINGING");
    stopRingtoneVibration();

    if (!CALL_FEATURES_ENABLED) {
      playCallEndedHaptic();
      const call = activeCallRef.current;
      cleanupCallState();
      if (call?.id) {
        try {
          await answerCallApi(call.id);
          await endCallApi(call.id);
        } catch {}
      }
      return;
    }

    try {
      const call = activeCallRef.current;
      if (!call?.id) return;
      if (callStatusRef.current !== "ringing") return;
      pendingOsAnswerRef.current = null;
      // CallKit / the call notification only ring; the call itself runs here.
      markAnsweredInApp(call.id);
      dismissOsIncomingCall(call.id);

      await ensureNativeCallPermissions(call.type || callTypeRef.current);

      callStatusRef.current = "connected";
      setCallStatus("connected");
      startTimer();
      playCallConnectedHaptic();

      bridgeRef.current?.sendMessage("ANSWER_INCOMING_CALL", {
        callId: call.id,
        callType: call.type || callTypeRef.current,
        remoteOffer: pendingRemoteOfferRef.current,
      });

      await answerCallApi(call.id);
    } catch (err) {
      console.error("[CallContext] answerCall error:", err);
      cleanupCallState();
    }
  }, [
    clearRingingTimeout,
    clearRingingRetryTimers,
    cleanupCallState,
    startTimer,
  ]);

  const rejectCall = useCallback(async () => {
    clearRingingTimeout();
    clearRingingRetryTimers();
    bridgeRef.current?.sendMessage("STOP_RINGING");
    try {
      stopRingtoneVibration();
      playCallEndedHaptic();
      const call = activeCallRef.current;
      cleanupCallState();
      if (call?.id) {
        await rejectCallApi(call.id, "rejected");
      }
    } catch (err) {
      console.warn("[CallContext] rejectCall error:", err);
    }
  }, [clearRingingTimeout, clearRingingRetryTimers, cleanupCallState]);

  // Listen for incoming call push events (from foreground/background push notification tap)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "INCOMING_CALL_PUSH",
      (pushData) => {
        const call = pushData?.call || pushData;
        if (!call || activeCallRef.current) return;
        beginIncomingRinging(call);
      }
    );

    const subAnswer = DeviceEventEmitter.addListener(
      "INCOMING_CALL_ANSWER_ACTION",
      () => {
        answerCall();
      }
    );

    const subDecline = DeviceEventEmitter.addListener(
      "INCOMING_CALL_DECLINE_ACTION",
      () => {
        rejectCall();
      }
    );

    return () => {
      sub.remove();
      subAnswer.remove();
      subDecline.remove();
    };
  }, [answerCall, rejectCall, beginIncomingRinging]);

  // Check active calls when app resumes or logs in
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkActiveCalls = async () => {
      try {
        if (!CALL_FEATURES_ENABLED) return;
        if (activeCallRef.current) return;
        const res = await getActiveCallApi();
        const call = res?.data?.call;
        if (
          call &&
          call.status === "ringing" &&
          !activeCallRef.current &&
          String(call.caller?.id) !== String(userInfo?.id)
        ) {
          beginIncomingRinging(call);
        }
      } catch (e) {}
    };

    checkActiveCalls();

    const echo = getEcho();
    const handleEchoConnected = () => {
      console.log("[CallContext] Echo socket reconnected -> checkActiveCalls");
      checkActiveCalls();
    };

    if (echo?.connector?.pusher?.connection) {
      echo.connector.pusher.connection.bind("connected", handleEchoConnected);
    }

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkActiveCalls();
      }
    });

    return () => {
      if (echo?.connector?.pusher?.connection) {
        echo.connector.pusher.connection.unbind(
          "connected",
          handleEchoConnected
        );
      }
      sub.remove();
    };
  }, [isLoggedIn, userInfo?.id, beginIncomingRinging]);

  // ---- Operating system call UI (CallKit / Android full-screen call) ----

  // Coming back to the app while a call rings or was answered in the OS UI.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      const call = activeCallRef.current;
      if (!call) return;
      if (
        pendingOsAnswerRef.current != null &&
        String(pendingOsAnswerRef.current) === String(call.id)
      ) {
        pendingOsAnswerRef.current = null;
        answerCall();
        return;
      }
      // Android: the notification rang while the app was away; now the app
      // is in front, ring here instead.
      if (
        nativeCallUiAvailable &&
        !ringsThroughCallKit &&
        callStatusRef.current === "ringing"
      ) {
        startLocalRinging(call);
      }
    });
    return () => sub.remove();
  }, [answerCall, startLocalRinging]);

  // What the user did in the OS call UI.
  const handleOsCallAction = useCallback(
    ({ action, call }) => {
      if (!CALL_FEATURES_ENABLED || !call?.id) return;
      const current = activeCallRef.current;
      const isCurrent = current && String(current.id) === String(call.id);

      if (action === "show" || action === "answer") {
        if (!current) {
          beginIncomingRinging(call);
        } else if (!isCurrent) {
          return; // already in another call
        }
        if (action === "answer" && callStatusRef.current === "ringing") {
          if (AppState.currentState === "active") {
            answerCall();
          } else {
            // iOS answered on the lock screen: join once the app is opened.
            pendingOsAnswerRef.current = call.id;
            stopRingtoneVibration();
            bridgeRef.current?.sendMessage("STOP_RINGING");
          }
        }
        return;
      }

      if (!isCurrent) return;
      if (action === "decline" || action === "cancelled") {
        // Declined in the OS UI: the native side already told the API.
        stopRingtoneVibration();
        cleanupCallState();
      } else if (action === "end") {
        endCall();
      }
    },
    [beginIncomingRinging, answerCall, cleanupCallState, endCall]
  );

  useEffect(() => {
    if (!nativeCallUiAvailable || !isLoggedIn) return;
    const sub = addCallActionListener(handleOsCallAction);
    // Actions taken before this listener existed (app started by the call).
    consumePendingCallActions().forEach(handleOsCallAction);
    return () => sub.remove();
  }, [isLoggedIn, handleOsCallAction]);

  // First login on Android: one-time battery optimisation prompt.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const timer = setTimeout(askIgnoreBatteryOptimizationsOnce, 4000);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // The native side declines calls itself (lock screen, app not running), so
  // it needs the API address and the signed-in account's token.
  useEffect(() => {
    if (!isLoggedIn) {
      clearNativeCallSession();
      clearNativeBubbleSession();
      return;
    }
    // Chat bubbles read the messages natively, so they need the same access.
    AsyncStorage.getItem("auth_token").then((token) => {
      if (token) setNativeBubbleSession(axiosInstance.defaults.baseURL, token);
    });
    syncBubbleChatEnabled();
    if (!nativeCallUiAvailable) return;
    let cancelled = false;
    AsyncStorage.getItem("auth_token").then((token) => {
      if (!cancelled && token) {
        setNativeCallSession(axiosInstance.defaults.baseURL, token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userInfo?.id]);

  // iOS: register this device's VoIP push token, which is what lets the API
  // ring a call through CallKit while the app is in the background or killed.
  useEffect(() => {
    if (!ringsThroughCallKit || !isLoggedIn || !userInfo?.id) return;
    let lastSent = null;
    const send = (token) => {
      if (!token || token === lastSent) return;
      lastSent = token;
      registerVoipPushToken({ voip_token: token })
        .then(() => rememberVoipToken(token))
        .catch((e) => {
          lastSent = null;
          console.warn("[CallContext] VoIP token registration failed:", e?.message);
        });
    };
    send(getVoipToken());
    const sub = addVoipTokenListener(send);
    return () => sub.remove();
  }, [isLoggedIn, userInfo?.id]);

  // Android 14+: showing a call full screen needs a permission the user may
  // have to grant in Settings. Ask once.
  useEffect(() => {
    if (!nativeCallUiAvailable || Platform.OS !== "android" || !isLoggedIn) return;
    if (canUseFullScreenIntent()) return;
    const key = "call_fullscreen_prompted";
    try {
      if (storage.getBoolean(key)) return;
      storage.set(key, true);
    } catch {}
    const t = i18n.t.bind(i18n);
    Alert.alert(t("call.fullScreenPermissionTitle"), t("call.fullScreenPermissionBody"), [
      { text: t("call.fullScreenPermissionLater"), style: "cancel" },
      { text: t("call.fullScreenPermissionOpen"), onPress: openFullScreenIntentSettings },
    ]);
  }, [isLoggedIn]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      bridgeRef.current?.sendMessage("SET_MUTED", { muted: next });
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      bridgeRef.current?.sendMessage("SET_SPEAKER", { enabled: next });
      return next;
    });
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Handle messages received from WebRtcBridge (WebView)
  const handleBridgeMessage = useCallback(
    (data) => {
      const callId = data?.callId || activeCallRef.current?.id;
      if (!callId && data.type !== "ERROR" && data.type !== "MEDIA_WARNING") {
        return;
      }

      if (data.type === "OFFER_CREATED" || data.type === "ANSWER_CREATED") {
        sendCallSignalApi(
          callId,
          data.type === "OFFER_CREATED" ? "offer" : "answer",
          data.sdp
        ).catch(() => {});
      } else if (data.type === "ICE_CANDIDATE" && data.candidate) {
        sendCallSignalApi(callId, "candidate", data.candidate).catch(() => {});
      } else if (data.type === "AUDIO_CHUNK" && data.chunk) {
        sendCallSignalApi(callId, "audio_chunk", {
          d: data.chunk,
          sr: data.sampleRate || 8000,
        }).catch(() => {});
      } else if (data.type === "CONNECTION_STATE_CHANGE") {
        transportConnectedRef.current = data.state === "connected";
        if (data.state === "connected") {
          callStatusRef.current = "connected";
          setCallStatus("connected");
          startTimer();
        } else if (data.state === "failed" || data.state === "disconnected") {
          console.warn("[CallContext] WebRTC state:", data.state);
        }
      }
    },
    [startTimer]
  );

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        activeCall,
        isMuted,
        isSpeakerOn,
        isMinimized,
        callDuration,
        startCall,
        answerCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleMinimize,
      }}
    >
      {children}

      {/* Hidden WebRTC engine executing media & peer connections */}
      <WebRtcBridge ref={bridgeRef} onMessage={handleBridgeMessage} />

      {/* Incoming Call Dialog Overlay */}
      <IncomingCallModal
        visible={callStatus === "ringing"}
        call={activeCall}
        onAnswer={answerCall}
        onReject={rejectCall}
      />

      {/* Active Call Full-Screen / Minimized Pill Overlay */}
      <ActiveCallModal
        visible={
          callStatus === "calling" ||
          callStatus === "ringingOutward" ||
          callStatus === "connected"
        }
        call={activeCall}
        callStatus={callStatus}
        callDuration={callDuration}
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        isMinimized={isMinimized}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onToggleMinimize={toggleMinimize}
        onEndCall={endCall}
      />
    </CallContext.Provider>
  );
};
