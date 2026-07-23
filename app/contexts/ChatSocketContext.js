import React, { createContext, useContext, useRef, useCallback, useEffect } from "react";
import { getEcho, disconnectEcho } from "../services/echo/echo";
import { useAuthContext } from "./AuthContext";

const ChatSocketContext = createContext(null);

/**
 * Manages one Reverb presence-channel subscription per conversation id, shared across
 * screens (ChatScreen's conversation list and ConversationScreen's open thread can both
 * be mounted at once in the navigation stack, so channels are ref-counted rather than
 * torn down as soon as one consumer unmounts).
 */
export const ChatSocketProvider = ({ children }) => {
  const { isLoggedIn } = useAuthContext();
  const channelsRef = useRef({}); // id -> Echo presence channel
  const listenersRef = useRef({}); // id -> { sent: Set, read: Set, deleted: Set }
  const refCountRef = useRef({}); // id -> number of active listeners

  const ensureBucket = (id) => {
    if (!listenersRef.current[id]) {
      listenersRef.current[id] = { sent: new Set(), read: new Set(), deleted: new Set() };
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
      });
  }, []);

  const leaveChannel = useCallback((id) => {
    if (!channelsRef.current[id]) return;
    getEcho()?.leave(`chat.${id}`);
    delete channelsRef.current[id];
    delete listenersRef.current[id];
    delete refCountRef.current[id];
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

  const value = { onMessageSent, onMessageRead, onMessageDeleted };

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
