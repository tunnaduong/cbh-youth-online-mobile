import React, { createContext, useContext, useRef, useCallback, useEffect, useMemo } from "react";
import { AppState } from "react-native";
import { getEcho, disconnectEcho, reconnectEchoIfNeeded, onEchoReconnect } from "../services/echo/echo";
import { useAuthContext } from "./AuthContext";

const ChatSocketContext = createContext(null);

const TYPING_THROTTLE_MS = 2000;

// The chat bubble is a second React root in the same JS runtime (app/bubble),
// so it mounts its own ChatSocketProvider next to the app's. They share the one
// Echo client and its channels: a channel is left, and the socket closed, only
// when the last user of it is gone.
const channelUsers = {}; // id -> number of providers that joined it
let providerCount = 0;

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
        delivered: new Set(),
        read: new Set(),
        deleted: new Set(),
        typing: new Set(),
        reacted: new Set(),
        recalled: new Set(),
        edited: new Set(),
      };
    }
    return listenersRef.current[id];
  };

  const joinChannel = useCallback((id) => {
    if (channelsRef.current[id]) return;

    const echo = getEcho();
    if (!echo) return;

    channelUsers[id] = (channelUsers[id] || 0) + 1;
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
      .listen(".message.delivered", (e) => {
        console.log("[ChatSocket] message.delivered on chat." + id, e);
        bucket.delivered.forEach((cb) => cb(e));
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
      .listen(".message.edited", (e) => {
        console.log("[ChatSocket] message.edited on chat." + id, e);
        bucket.edited.forEach((cb) => cb(e));
      })
      .listenForWhisper("typing", (data) => {
        if (!data || String(data.user_id) === String(userInfo?.id)) return;
        bucket.typing.forEach((cb) => cb(data));
      })
      .listen(".ai.typing", (e) => {
        console.log("[ChatSocket] ai.typing on chat." + id, e);
        bucket.typing.forEach((cb) => cb({ ...e, isAi: true }));
      });
  }, [userInfo?.id]);

  const leaveChannel = useCallback((id) => {
    if (!channelsRef.current[id]) return;
    channelUsers[id] = Math.max(0, (channelUsers[id] || 1) - 1);
    if (channelUsers[id] === 0) getEcho()?.leave(`chat.${id}`);
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
  const onMessageDelivered = useCallback(
    (conversationId, callback) => addListener("delivered", conversationId, callback),
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
  const onMessageEdited = useCallback(
    (conversationId, callback) => addListener("edited", conversationId, callback),
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

      channel.whisper("typing", { user_id: userInfo.id });
    },
    [userInfo?.id]
  );

  useEffect(() => {
    if (!isLoggedIn) {
      Object.keys(channelsRef.current).forEach((id) => leaveChannel(id));
      if (providerCount <= 1) disconnectEcho();
    }
  }, [isLoggedIn, leaveChannel]);

  // The OS suspends the socket while the app is backgrounded - reconnect as
  // soon as it's foregrounded again instead of waiting on pusher-js's own
  // retry timing (or, previously, nothing at all short of remounting the
  // screen), which is what made a message that arrived while backgrounded
  // only show up after leaving and re-entering the conversation.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let leftAt = 0;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        reconnectEchoIfNeeded(leftAt ? Date.now() - leftAt : 0);
        leftAt = 0;
      } else if (!leftAt) {
        leftAt = Date.now();
      }
    });
    return () => subscription.remove();
  }, [isLoggedIn]);

  // After a dropped socket comes back, every open conversation re-reads its
  // messages: a "sent" callback with a resync flag (consumers refetch on any).
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    return onEchoReconnect(() => {
      Object.keys(listenersRef.current).forEach((id) => {
        listenersRef.current[id]?.sent.forEach((cb) => cb({ resync: true, conversation_id: id }));
      });
    });
  }, [isLoggedIn]);

  useEffect(() => {
    providerCount += 1;
    return () => {
      providerCount -= 1;
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.keys(channelsRef.current).forEach((id) => leaveChannel(id));
      // The effect above already took this provider off providerCount.
      if (providerCount <= 0) disconnectEcho();
    };
  }, [leaveChannel]);

  // One object for as long as the callbacks are the same: a new one on every
  // render re-rendered every chat screen along with this provider.
  const value = useMemo(
    () => ({
      onMessageSent,
      onMessageDelivered,
      onMessageRead,
      onMessageDeleted,
      onMessageReacted,
      onMessageRecalled,
      onMessageEdited,
      onTyping,
      sendTyping,
    }),
    [
      onMessageSent,
      onMessageDelivered,
      onMessageRead,
      onMessageDeleted,
      onMessageReacted,
      onMessageRecalled,
      onMessageEdited,
      onTyping,
      sendTyping,
    ]
  );

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
