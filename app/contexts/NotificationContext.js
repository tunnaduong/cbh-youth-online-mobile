import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
    if (isLoggedIn) {
      registerPushToken();
    } else {
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
  }, [isLoggedIn]);

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

      // Get Expo push token
      const token = await getExpoPushToken();
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
    console.log('Notification received:', notification);
    // You can add custom logic here, like updating local state
    // or showing an in-app notification
  };

  const handleNotificationTapped = (response) => {
    console.log('Notification tapped:', response);
    const data = response.notification.request.content.data;

    // Handle navigation based on notification data
    // This will be handled by the navigation system
    // You can emit an event or use a navigation service here
    if (data?.type === 'chat_message' && data?.conversation_id) {
      // Navigate to chat conversation
      // Navigation will be handled by the app's navigation system
    } else if (data?.type === 'notification' && data?.url) {
      // Navigate to notification or specific content
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

