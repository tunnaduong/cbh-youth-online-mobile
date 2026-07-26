import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import {
  getExpoPushToken,
  setupNotificationListeners,
  removeNotificationListeners,
  getDeviceType,
  setBadgeCount,
} from '../services/notifications/ExpoNotificationService';
import {
  registerExpoPushToken,
  unregisterExpoPushToken,
  getUnreadNotificationCount,
} from '../services/api/Api';
import { AuthContext } from './AuthContext';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isLoggedIn } = useContext(AuthContext);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const notificationListeners = useRef([]);
  const registeredTokenRef = useRef(null);

  // Register push token when user logs in
  useEffect(() => {
    console.log('[Push] registration effect', { isLoggedIn, hasToken: !!expoPushToken, isRegistering });
    if (isLoggedIn && !expoPushToken && !isRegistering) {
      registerPushToken();
    } else if (!isLoggedIn) {
      // Unregister when user logs out
      if (registeredTokenRef.current) {
        unregisterPushToken(registeredTokenRef.current);
        registeredTokenRef.current = null;
        setExpoPushToken(null);
      }
    }

    return () => {
      // Cleanup listeners
      if (notificationListeners.current.length > 0) {
        removeNotificationListeners(notificationListeners.current);
        notificationListeners.current = [];
      }
    };
  }, [isLoggedIn, expoPushToken, isRegistering]);

  // Set up notification listeners
  useEffect(() => {
    const subscriptions = setupNotificationListeners(
      handleNotificationReceived,
      handleNotificationTapped
    );
    notificationListeners.current = subscriptions;

    return () => {
      removeNotificationListeners(subscriptions);
    };
  }, [isLoggedIn]);

  // Update badge count periodically when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setBadgeCount(0);
      return;
    }

    const updateBadgeCount = async () => {
      try {
        const response = await getUnreadNotificationCount();
        if (response?.unread_count !== undefined) {
          await setBadgeCount(response.unread_count);
        }
      } catch (error) {
        console.error('Error updating badge count:', error);
      }
    };

    // Update immediately
    updateBadgeCount();

    // Update every 30 seconds
    const interval = setInterval(updateBadgeCount, 30000);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const registerPushToken = async () => {
    if (isRegistering) return;

    try {
      setIsRegistering(true);
      console.log(`[Push] Starting push token registration... (Platform=${Platform.OS})`);

      // Get Expo push token
      const token = await getExpoPushToken();
      console.log("Received push token:", token);
      if (!token) {
        console.warn('Failed to get Expo push token');
        setIsRegistering(false);
        return;
      }

      setExpoPushToken(token);
      registeredTokenRef.current = token;

      // Get device type
      const deviceType = getDeviceType();

      // Register token with backend
      try {
        console.log('Registering token with backend...', { token, deviceType });
        await registerExpoPushToken({
          expo_push_token: token,
          device_type: deviceType,
        });
        console.log('Expo push token registered successfully');
      } catch (error) {
        console.error('Error registering push token with backend:', error);
        // Don't clear token on error, might be temporary network issue
      }
    } catch (error) {
      console.error('Error registering push token:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  const unregisterPushToken = async (token) => {
    if (!token) return;

    try {
      await unregisterExpoPushToken({
        expo_push_token: token,
      });
      console.log('Expo push token unregistered successfully');
    } catch (error) {
      console.error('Error unregistering push token:', error);
    }
  };

  const handleNotificationReceived = (notification) => {
    console.log('Notification received callback fired:', notification);
    if (notification?.request?.content) {
      console.log('Notification content:', notification.request.content);
    }
    // You can add custom logic here, like updating local state
    // or showing an in-app notification
  };

  const handleNotificationTapped = (response) => {
    const data = response?.notification?.request?.content?.data;
    if (!data) return;

    const type = data.type;
    const topicId = data.topic_id ?? data.topicId;
    const postId = data.post_id ?? data.postId ?? topicId;
    const conversationId = data.conversation_id ?? data.conversationId;
    const storyId = data.story_id ?? data.storyId;

    let target = null;

    if (type === 'chat_message' && conversationId) {
      target = { screen: 'ConversationScreen', params: { conversationId } };
    } else if (type === 'story_reacted' && storyId) {
      target = { screen: 'MainScreens', params: { screen: 'Home', params: { openStoryId: storyId } } };
    } else if (type === 'story_replied' || type === 'message_reacted') {
      const messageId = data.message_id ?? data.messageId;
      target = conversationId
        ? { screen: 'ConversationScreen', params: { conversationId, highlightMessageId: messageId } }
        : { screen: 'MainScreens', params: { screen: 'Chat' } };
    } else if (type === 'payment_received' || data.url === '/wallet') {
      target = { screen: 'PointWalletScreen', params: undefined };
    } else if (postId) {
      const id = parseInt(postId, 10);
      target = { screen: 'PostScreen', params: { postId: isNaN(id) ? postId : id, item: null } };
    }

    if (target) {
      DeviceEventEmitter.emit('NAVIGATE_FROM_NOTIFICATION', target);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        isRegistering,
        registerPushToken,
        unregisterPushToken,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};




