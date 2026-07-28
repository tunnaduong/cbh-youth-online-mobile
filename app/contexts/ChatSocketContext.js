import React, { createContext, useContext, useRef, useCallback, useEffect } from "react";
import { getEcho, disconnectEcho } from "../services/echo/echo";
import { useAuthContext } from "./AuthContext";

const ChatSocketContext = createContext(null);

const TYPING_THROTTLE_MS = 2000;

/**
 * Manages one Reverb presence-channel subscription per conversation id, shared across
 * screens (ChatScreen's conversation list and ConversationScreen's open thread can both
 * be mounted at once in the navigation stack, so channels are ref-counted rather than
 * torn down as soon as one consumer unmounts).
 */
export const ChatSocketProvider = ({ children }) => {
  const { isLoggedIn, userInfo } = useAuthContext();
  const channelsRef = useRef({}); // id -> Echo presence channel
  const listenersRef = useRef({}); // id -> { sent: Set, read: Set, deleted: Set, typing: Set }
  const refCountRef = useRef({}); // id -> number of active listeners
  const typingLastSentRef = useRef({}); // id -> timestamp of last "typing" whisper sent

  const ensureBucket = (id) => {
    if (!listenersRef.current[id]) {
      listenersRef.current[id] = {
        sent: new Set(),
        read: new Set(),
        deleted: new Set(),
        typing: new Set(),
        reacted: new Set(),
        recalled: new Set(),
      };
    }
    return listenersRef.current[id];
  };

  const joinChannel = useCallback((id) => {
    if (channelsRef.current[id]) return;

    const echo = getEcho();
    if (!echo) return;

    const bucket = ensureBucket(id);
    console.log("[ChatSocket] joining chat." + id);
    channelsRef.current[id] = echo
      .join(`chat.${id}`)
      .here((members) => console.log("[ChatSocket] joined chat." + id, members))
      .error((error) => console.log("[ChatSocket] join FAILED chat." + id, JSON.stringify(error)))
      .listen(".message.sent", (e) => {
        console.log("[ChatSocket] message.sent on chat." + id, e);
        bucket.sent.forEach((cb) => cb(e));
      })
      .listen(".message.read", (e) => {
        console.log("[ChatSocket] message.read on chat." + id, e);
        bucket.read.forEach((cb) => cb(e));
      })
      .listen(".message.deleted", (e) => {
        console.log("[ChatSocket] message.deleted on chat." + id, e);
        bucket.deleted.forEach((cb) => cb(e));
      })
      .listen(".message.reacted", (e) => {
        console.log("[ChatSocket] message.reacted on chat." + id, e);
        bucket.reacted.forEach((cb) => cb(e));
      })
      .listen(".message.recalled", (e) => {
        console.log("[ChatSocket] message.recalled on chat." + id, e);
        bucket.recalled.forEach((cb) => cb(e));
      })
      .listenForWhisper("typing", (data) => {
        if (!data || String(data.user_id) === String(userInfo?.id)) return;
        bucket.typing.forEach((cb) => cb(data));
      });
  }, [userInfo?.id]);

  const leaveChannel = useCallback((id) => {
    if (!channelsRef.current[id]) return;
    getEcho()?.leave(`chat.${id}`);
    delete channelsRef.current[id];
    delete listenersRef.current[id];
    delete refCountRef.current[id];
    delete typingLastSentRef.current[id];
  }, []);

  const addListener = useCallback(
    (kind, conversationId, callback) => {
      if (!conversationId || typeof callback !== "function") return () => {};
      const id = String(conversationId);

      refCountRef.current[id] = (refCountRef.current[id] || 0) + 1;
      joinChannel(id);
      ensureBucket(id)[kind].add(callback);

      return () => {
        listenersRef.current[id]?.[kind]?.delete(callback);
        refCountRef.current[id] = Math.max(0, (refCountRef.current[id] || 1) - 1);
        if (refCountRef.current[id] === 0) {
          leaveChannel(id);
        }
      };
    },
    [joinChannel, leaveChannel]
  );

  const onMessageSent = useCallback(
    (conversationId, callback) => addListener("sent", conversationId, callback),
    [addListener]
  );
  const onMessageRead = useCallback(
    (conversationId, callback) => addListener("read", conversationId, callback),
    [addListener]
  );
  const onMessageDeleted = useCallback(
    (conversationId, callback) => addListener("deleted", conversationId, callback),
    [addListener]
  );
  const onTyping = useCallback(
    (conversationId, callback) => addListener("typing", conversationId, callback),
    [addListener]
  );
  const onMessageReacted = useCallback(
    (conversationId, callback) => addListener("reacted", conversationId, callback),
    [addListener]
  );
  const onMessageRecalled = useCallback(
    (conversationId, callback) => addListener("recalled", conversationId, callback),
    [addListener]
  );

  const sendTyping = useCallback(
    (conversationId) => {
      if (!conversationId || !userInfo?.id) return;

      const id = String(conversationId);
      const channel = channelsRef.current[id];
      if (!channel) return;

      const now = Date.now();
      const lastSent = typingLastSentRef.current[id] || 0;
      if (now - lastSent < TYPING_THROTTLE_MS) return;
      typingLastSentRef.current[id] = now;

      channel.whisper("typing", {
        user_id: userInfo.id,
        name: userInfo.profile_name || userInfo.username,
      });
    },
    [userInfo?.id, userInfo?.profile_name, userInfo?.username]
  );

  useEffect(() => {
    if (!isLoggedIn) {
      Object.keys(channelsRef.current).forEach((id) => leaveChannel(id));
      disconnectEcho();
    }
  }, [isLoggedIn, leaveChannel]);

  useEffect(() => {
    return () => {
      Object.keys(channelsRef.current).forEach((id) => leaveChannel(id));
      disconnectEcho();
    };
  }, [leaveChannel]);

  const value = {
    onMessageSent,
    onMessageRead,
    onMessageDeleted,
    onMessageReacted,
    onMessageRecalled,
    onTyping,
    sendTyping,
  };

  return (
    <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>
  );
};

export const useChatSocket = () => {
  const context = useContext(ChatSocketContext);
  if (!context) {
    throw new Error("useChatSocket must be used within a ChatSocketProvider");
  }
  return context;
};
