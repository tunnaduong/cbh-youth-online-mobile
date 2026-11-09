import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, DeviceEventEmitter, Platform, PermissionsAndroid } from "react-native";
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
  const callTypeRef = useRef("audio");

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
    clearConnectingTimeout();
    clearRingingTimeout();
    clearRingingRetryTimers();
    ringingAckReceivedRef.current = false;
    offerStartedForCallRef.current = null;
    bridgeRef.current?.sendMessage("STOP_RINGING");
    pendingRemoteOfferRef.current = null;
    stopTimer();
    stopRingtoneVibration();
    bridgeRef.current?.sendMessage("END_CALL");
    if (conversationChannelRef.current) {
      try {
        const echo = getEcho();
        if (echo && activeCallRef.current?.conversation_id) {
          echo.leave(`chat.${activeCallRef.current.conversation_id}`);
        }
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
    if (
      callStatusRef.current === "calling" ||
      callStatusRef.current === "ringingOutward"
    ) {
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

  // Shared event handlers for both user private channel and conversation presence channel
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

      playCallConnectedHaptic();
      callStatusRef.current = "connected";
      setCallStatus("connected");
      startTimer();
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

      if (data?.type === "ringing") {
        console.log("[CallContext] Callee received call and started ringing.");
        ringingAckReceivedRef.current = true;
        if (callStatusRef.current === "calling") {
          startOutgoingRingingPhase();
        }
        return;
      } else if (data?.type === "candidate") {
        bridgeRef.current?.sendMessage("ADD_ICE_CANDIDATE", {
          candidate: data.payload,
        });
      } else if (data?.type === "offer") {
        pendingRemoteOfferRef.current = data.payload;
        bridgeRef.current?.sendMessage("SET_REMOTE_SDP", {
          sdp: data.payload,
          callId: data.call_id || current.id,
          callType: callTypeRef.current,
        });
      } else if (data?.type === "answer") {
        bridgeRef.current?.sendMessage("STOP_RINGING");
        bridgeRef.current?.sendMessage("SET_REMOTE_SDP", {
          sdp: data.payload,
          callId: data.call_id || current.id,
          callType: callTypeRef.current,
        });
      }
    },
    [userInfo?.id, startOutgoingRingingPhase]
  );

  // Join chat presence channel for call signals & status changes
  const joinConversationPresence = useCallback(
    (conversationId) => {
      const echo = getEcho();
      if (!echo || !conversationId) return;

      const channel = echo.join(`chat.${conversationId}`);
      conversationChannelRef.current = channel;

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

      activeCallRef.current = call;
      setActiveCall(call);
      callTypeRef.current = call.type || "audio";
      setCallType(call.type || "audio");
      callStatusRef.current = "ringing";
      setCallStatus("ringing");
      startRingtoneVibration();
      bridgeRef.current?.sendMessage("START_INCOMING_RING");
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
    scheduleRingingRetries,
    clearRingingTimeout,
    cleanupCallState,
    joinConversationPresence,
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
      // Loophole mode: incoming call UI and ringtone play, but pressing call/answer exits
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

        activeCallRef.current = call;
        setActiveCall(call);
        callTypeRef.current = call.type || "audio";
        setCallType(call.type || "audio");
        callStatusRef.current = "ringing";
        setCallStatus("ringing");
        startRingtoneVibration();
        bridgeRef.current?.sendMessage("START_INCOMING_RING");
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

        if (call.conversation_id) {
          joinConversationPresence(call.conversation_id, call.id);
        }
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
  }, [
    answerCall,
    joinConversationPresence,
    rejectCall,
    scheduleRingingRetries,
    clearRingingTimeout,
    cleanupCallState,
  ]);

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
          activeCallRef.current = call;
          setActiveCall(call);
          callTypeRef.current = call.type || "audio";
          setCallType(call.type || "audio");
          callStatusRef.current = "ringing";
          setCallStatus("ringing");
          startRingtoneVibration();
          bridgeRef.current?.sendMessage("START_INCOMING_RING");
          scheduleRingingRetries(call.id);

          clearRingingTimeout();
          ringingTimeoutRef.current = setTimeout(() => {
            if (activeCallRef.current && callStatusRef.current === "ringing") {
              console.log(
                "[CallContext] Callee 60s timeout without answer -> stop ringing"
              );
              cleanupCallState();
            }
          }, 60000);

          if (call.conversation_id) {
            joinConversationPresence(call.conversation_id, call.id);
          }
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
  }, [
    isLoggedIn,
    userInfo?.id,
    scheduleRingingRetries,
    clearRingingTimeout,
    cleanupCallState,
    joinConversationPresence,
  ]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      bridgeRef.current?.sendMessage("SET_MUTED", { muted: next });
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
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
      } else if (data.type === "CONNECTION_STATE_CHANGE") {
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
