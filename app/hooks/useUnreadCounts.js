import { useState, useEffect, useCallback, useContext } from "react";
import { AppState } from "react-native";
import {
  getConversations,
  getUnreadNotificationCount,
} from "../services/api/Api";
import { AuthContext } from "../contexts/AuthContext";

export const useUnreadCounts = () => {
  const { isLoggedIn } = useContext(AuthContext);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const fetchChatUnreadCount = useCallback(async () => {
    if (!isLoggedIn) {
      setChatUnreadCount(0);
      return;
    }

    try {
      const response = await getConversations();
      if (response?.data) {
        // Calculate total unread messages from all conversations
        // Filter out the public chat group "Tán gẫu linh tinh" from unread count
        const totalUnread = response.data
          .filter(
            (conversation) =>
              !(
                conversation.type === "group" &&
                conversation.name === "Tán gẫu linh tinh"
              )
          )
          .reduce(
            (total, conversation) => total + (conversation.unread_count || 0),
            0
          );
        setChatUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error("Error fetching chat unread count:", error);
    }
  }, [isLoggedIn]);

  const fetchNotificationUnreadCount = useCallback(async () => {
    if (!isLoggedIn) {
      setNotificationUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadNotificationCount();
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
      fetchAllCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAllCounts]);

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
