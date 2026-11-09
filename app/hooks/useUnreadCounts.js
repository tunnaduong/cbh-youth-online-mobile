import { useState, useEffect, useCallback, useContext, useRef } from "react";
import { AppState } from "react-native";
import {
  getConversations,
  getUnreadNotificationCount,
  isRequestCanceled,
} from "../services/api/Api";
import { AuthContext } from "../contexts/AuthContext";
import { useChatSocket } from "../contexts/ChatSocketContext";
import { storage } from "../mmkv";

export const useUnreadCounts = () => {
  const { isLoggedIn, userInfo } = useContext(AuthContext);
  const { onMessageSent, onMessageRead, onMessageDeleted } = useChatSocket();
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [conversationIdsKey, setConversationIdsKey] = useState("");
  const chatAbortRef = useRef(null);
  const notifAbortRef = useRef(null);

  const fetchChatUnreadCount = useCallback(async () => {
    if (!isLoggedIn) {
      setChatUnreadCount(0);
      setConversationIdsKey("");
      return;
    }

    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const response = await getConversations({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response?.data && Array.isArray(response.data)) {
        if (userInfo?.username) {
          storage.set(
            `conversations_${userInfo.username}`,
            JSON.stringify(response.data)
          );
        }
        const idsKey = response.data.map((c) => c.id).join(",");
        setConversationIdsKey((prev) => (prev === idsKey ? prev : idsKey));

        // Calculate total unread messages from all conversations
        // Filter out the public chat group "Tán gẫu linh tinh" from unread count
        const totalUnread = response.data
          .filter(
            (conversation) =>
              !(
                conversation.type === "group" &&
                conversation.name?.trim().normalize("NFC").toLowerCase() === "tán gẫu linh tinh"
              )
          )
          .reduce(
            (total, conversation) => total + (conversation.unread_count || 0),
            0
          );
        setChatUnreadCount(totalUnread);
      }
    } catch (error) {
      if (isRequestCanceled(error)) return;
      console.error("Error fetching chat unread count:", error);
    }
  }, [isLoggedIn, userInfo?.username]);

  const fetchNotificationUnreadCount = useCallback(async () => {
    if (!isLoggedIn) {
      setNotificationUnreadCount(0);
      return;
    }

    if (notifAbortRef.current) {
      notifAbortRef.current.abort();
    }
    const controller = new AbortController();
    notifAbortRef.current = controller;

    try {
      const response = await getUnreadNotificationCount({
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      // Handle different response formats: response.unread_count or response.data.unread_count
      const unreadCount =
        response?.unread_count !== undefined
          ? response.unread_count
          : response?.data?.unread_count !== undefined
          ? response.data.unread_count
          : undefined;

      if (unreadCount !== undefined) {
        setNotificationUnreadCount(unreadCount);
      }
    } catch (error) {
      if (isRequestCanceled(error)) return;
      console.error("Error fetching notification unread count:", error);
    }
  }, [isLoggedIn]);

  const fetchAllCounts = useCallback(() => {
    fetchChatUnreadCount();
    fetchNotificationUnreadCount();
  }, [fetchChatUnreadCount, fetchNotificationUnreadCount]);

  // Fetch counts on mount and when login status changes
  useEffect(() => {
    // Fetch immediately on mount
    fetchAllCounts();

    // Set up polling every 30 seconds
    const interval = setInterval(() => {
      // Not while the app is in the background: the effect below refreshes
      // the moment it comes back.
      if (AppState.currentState === "active") fetchAllCounts();
    }, 30000);

    return () => {
      clearInterval(interval);
      chatAbortRef.current?.abort();
      notifAbortRef.current?.abort();
    };
  }, [fetchAllCounts]);

  // Real-time socket subscription for chat unread count & MMKV cache even when ChatScreen is unmounted
  const fetchChatUnreadCountRef = useRef(fetchChatUnreadCount);
  useEffect(() => {
    fetchChatUnreadCountRef.current = fetchChatUnreadCount;
  }, [fetchChatUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn || !conversationIdsKey) return undefined;
    const ids = conversationIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) return undefined;

    let refreshTimer = null;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        fetchChatUnreadCountRef.current?.();
      }, 400);
    };

    const unsubscribers = ids.flatMap((id) => [
      onMessageSent(id, scheduleRefresh),
      onMessageRead(id, scheduleRefresh),
      onMessageDeleted(id, scheduleRefresh),
    ]);

    return () => {
      clearTimeout(refreshTimer);
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [isLoggedIn, conversationIdsKey, onMessageSent, onMessageRead, onMessageDeleted]);

  // Refresh counts when app comes to foreground (after being in background)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && isLoggedIn) {
        // App has come to the foreground, refresh counts immediately
        fetchAllCounts();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [fetchAllCounts, isLoggedIn]);

  // Function to manually set notification unread count (useful for syncing from local state)
  const setNotificationUnreadCountManually = useCallback((count) => {
    setNotificationUnreadCount(count);
  }, []);

  return {
    chatUnreadCount,
    notificationUnreadCount,
    refreshChatCount: fetchChatUnreadCount,
    refreshNotificationCount: fetchNotificationUnreadCount,
    refreshAllCounts: fetchAllCounts,
    setNotificationUnreadCount: setNotificationUnreadCountManually,
  };
};
