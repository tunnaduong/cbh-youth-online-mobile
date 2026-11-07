import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import * as Notifications from "expo-notifications";
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

export const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const { isLoggedIn, userInfo } = useContext(AuthContext);

  const [callStatus, setCallStatus] = useState("idle"); // 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
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
    setActiveCall(null);
    setCallStatus("idle");
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsMinimized(false);
  }, [stopTimer]);

  // Subscribe to user private channel to receive incoming calls
  useEffect(() => {
    if (!isLoggedIn || !userInfo?.id) return;

    const echo = getEcho();
    if (!echo) return;

    const userChannel = echo.private(`App.Models.User.${userInfo.id}`);

    userChannel.listen(".call.initiated", (data) => {
      const call = data?.call || data?.callData || data;
      if (!call || activeCallRef.current) return;

      setActiveCall(call);
      setCallType(call.type || "audio");
      setCallStatus("ringing");
      startRingtoneVibration();
      bridgeRef.current?.sendMessage("START_INCOMING_RING");
      sendCallSignalApi(call.id, "ringing", {}).catch(() => {});

      // Auto-disconnect callee after 60s if not answered
      clearRingingTimeout();
      ringingTimeoutRef.current = setTimeout(() => {
        if (activeCallRef.current && callStatusRef.current === "ringing") {
          console.log("[CallContext] Callee 60s timeout without answer -> stop ringing");
          cleanupCallState();
        }
      }, 60000);

      // Join conversation presence channel to listen for call progression
      if (call.conversation_id) {
        joinConversationPresence(call.conversation_id, call.id);
      }
    });

    return () => {
      try {
        echo.leave(`App.Models.User.${userInfo.id}`);
      } catch (e) {}
    };
  }, [isLoggedIn, userInfo?.id]);

  // Join chat presence channel for call signals & status changes
  const joinConversationPresence = useCallback((conversationId, callId) => {
    const echo = getEcho();
    if (!echo || !conversationId) return;

    const channel = echo.join(`chat.${conversationId}`);
    conversationChannelRef.current = channel;

    channel.listen(".call.answered", (data) => {
      clearRingingTimeout();
      stopRingtoneVibration();
      bridgeRef.current?.sendMessage("STOP_RINGING");
      playCallConnectedHaptic();
      setCallStatus("connected");
      startTimer();
    });

    channel.listen(".call.rejected", () => {
      stopRingtoneVibration();
      playCallEndedHaptic();
      Toast.show({
        type: "info",
        text1: "Cuộc gọi đã bị từ chối",
        visibilityTime: 2500,
      });
      cleanupCallState();
    });

    channel.listen(".call.ended", () => {
      stopRingtoneVibration();
      playCallEndedHaptic();
      cleanupCallState();
    });

    channel.listen(".call.signaled", (data) => {
      if (data?.type === "ringing") {
        console.log("[CallContext] Callee received call and started ringing.");
        clearConnectingTimeout();
        if (callStatusRef.current === "calling") {
          setCallStatus("ringing");
          bridgeRef.current?.sendMessage("START_OUTGOING_CALL", {
            callId: activeCallRef.current?.id,
            callType: callTypeRef.current,
          });

          clearRingingTimeout();
          ringingTimeoutRef.current = setTimeout(() => {
            if (activeCallRef.current && (callStatusRef.current === "calling" || callStatusRef.current === "ringing")) {
              console.log("[CallContext] 60s timeout without answer -> auto end call");
              Toast.show({
                type: "info",
                text1: "Người nhận không trả lời",
                visibilityTime: 2500,
              });
              endCall();
            }
          }, 60000);
        }
        return;
      } else if (data?.type === "candidate") {
        bridgeRef.current?.sendMessage("ADD_ICE_CANDIDATE", { candidate: data.payload });
      } else if (data?.type === "offer") {
        pendingRemoteOfferRef.current = data.payload;
        bridgeRef.current?.sendMessage("SET_REMOTE_SDP", { sdp: data.payload });
      } else if (data?.type === "answer") {
        bridgeRef.current?.sendMessage("STOP_RINGING");
        bridgeRef.current?.sendMessage("SET_REMOTE_SDP", { sdp: data.payload });
      }
    });
  }, [cleanupCallState, startTimer]);

  // Listen for incoming call push events (from foreground/background push notification tap)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("INCOMING_CALL_PUSH", (pushData) => {
      const call = pushData?.call || pushData;
      if (!call || activeCallRef.current) return;

      setActiveCall(call);
      setCallType(call.type || "audio");
      setCallStatus("ringing");
      startRingtoneVibration();
      bridgeRef.current?.sendMessage("START_INCOMING_RING");

      // Auto-disconnect callee after 60s if not answered
      clearRingingTimeout();
      ringingTimeoutRef.current = setTimeout(() => {
        if (activeCallRef.current && callStatusRef.current === "ringing") {
          console.log("[CallContext] Callee 60s timeout without answer -> stop ringing");
          cleanupCallState();
        }
      }, 60000);

      if (call.conversation_id) {
        joinConversationPresence(call.conversation_id, call.id);
      }
    });

    return () => sub.remove();
  }, [joinConversationPresence]);

  // Check active calls when app resumes or logs in
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkActiveCalls = async () => {
      try {
        if (activeCallRef.current) return;
        const res = await getActiveCallApi();
        const call = res?.data?.call;
        if (call && (call.status === "ringing" || call.status === "accepted") && !activeCallRef.current) {
          setActiveCall(call);
          setCallType(call.type || "audio");
          setCallStatus(call.status === "accepted" ? "connected" : "ringing");
          if (call.status === "ringing") {
            startRingtoneVibration();
            bridgeRef.current?.sendMessage("START_INCOMING_RING");

      // Auto-disconnect callee after 60s if not answered
      clearRingingTimeout();
      ringingTimeoutRef.current = setTimeout(() => {
        if (activeCallRef.current && callStatusRef.current === "ringing") {
          console.log("[CallContext] Callee 60s timeout without answer -> stop ringing");
          cleanupCallState();
        }
      }, 60000);
          } else {
            startTimer();
          }
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
        echo.connector.pusher.connection.unbind("connected", handleEchoConnected);
      }
      sub.remove();
    };
  }, [isLoggedIn, joinConversationPresence, startTimer]);

  // Actions
  const startCall = useCallback(
    async (conversationId, type = "audio", participant = null) => {
      try {
        if (!conversationId) return;
        setCallType(type);
        setCallStatus("calling");

        // Synthesize temporary activeCall object for immediate UI response
        const placeholderCall = {
          conversation_id: conversationId,
          type,
          receiver: participant,
        };
        setActiveCall(placeholderCall);

        const res = await initiateCallApi(conversationId, type);
        const callData = res?.data?.call || res?.data;
        const callId = callData?.id;

        if (callId) {
          const updatedCall = { ...callData, receiver: participant || callData.receiver };
          setActiveCall(updatedCall);
          joinConversationPresence(conversationId, callId);
          // 10s connection timeout: Try connecting to callee for 10s
          clearConnectingTimeout();
          clearRingingTimeout();
          connectingTimeoutRef.current = setTimeout(() => {
            if (callStatusRef.current === "calling") {
              console.log("[CallContext] Callee unreachable after 10s.");
              Toast.show({
                type: "info",
                text1: "Không thể kết nối đến người kia",
                visibilityTime: 3000,
              });
              endCall();
            }
          }, 10000);
        }
      } catch (err) {
        console.error("[CallContext] initiateCall error:", err);
        Toast.show({
          type: "error",
          text1: "Không thể bắt đầu cuộc gọi",
          text2: err?.response?.data?.message || err?.message || "Vui lòng thử lại sau.",
        });
        cleanupCallState();
      }
    },
    [cleanupCallState, joinConversationPresence]
  );

  const answerCall = useCallback(async () => {
    clearRingingTimeout();
    bridgeRef.current?.sendMessage("STOP_RINGING");
    try {
      stopRingtoneVibration();
      const call = activeCallRef.current;
      if (!call?.id) return;

      setCallStatus("connected");
      startTimer();
      playCallConnectedHaptic();

      bridgeRef.current?.sendMessage("ANSWER_INCOMING_CALL", {
        callId: call.id,
        callType,
        remoteOffer: pendingRemoteOfferRef.current,
      });

      await answerCallApi(call.id);
    } catch (err) {
      console.error("[CallContext] answerCall error:", err);
      cleanupCallState();
    }
  }, [callType, cleanupCallState, startTimer]);

  const rejectCall = useCallback(async () => {
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
  }, [cleanupCallState]);

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
      const callId = activeCallRef.current?.id;
      if (!callId && data.type !== "ERROR") return;

      if (data.type === "OFFER_CREATED" || data.type === "ANSWER_CREATED") {
        sendCallSignalApi(callId, data.type === "OFFER_CREATED" ? "offer" : "answer", data.sdp).catch(() => {});
      } else if (data.type === "ICE_CANDIDATE" && data.candidate) {
        sendCallSignalApi(callId, "candidate", data.candidate).catch(() => {});
      } else if (data.type === "CONNECTION_STATE_CHANGE") {
        if (data.state === "connected") {
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
        visible={callStatus === "calling" || callStatus === "connected"}
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
