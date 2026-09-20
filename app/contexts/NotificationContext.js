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
import { resolveNotificationTarget } from '../utils/notificationRouting';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isLoggedIn } = useContext(AuthContext);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const registeredTokenRef = useRef(null);
  // Guards against handling the same tap twice: on a cold start the launching
  // tap arrives BOTH from getLastNotificationResponseAsync() and (on some
  // platforms/timings) from the live response listener, which would otherwise
  // push the same screen twice.
  const handledResponseIdRef = useRef(null);

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
  }, [isLoggedIn, expoPushToken, isRegistering]);

  // Set up notification listeners.
  //
  // Mounted exactly once, and deliberately NOT owned by the registration
  // effect above. That effect re-runs on every expoPushToken/isRegistering
  // change (both flip within the first moments of startup, as the token is
  // fetched and registered), and it used to tear these subscriptions down in
  // its cleanup - so seconds after launch the response listener was gone and
  // never re-created, since this effect didn't re-run. Tapping a notification
  // while the app was already running then did nothing at all; only cold
  // starts still worked, because those are routed by the one-shot
  // getLastNotificationResponseAsync() poll inside setupNotificationListeners
  // rather than by the live listener.
  //
  // The handlers below must stay free of component state for this to be safe:
  // with an empty dep array they capture the first render's closures.
  useEffect(() => {
    const subscriptions = setupNotificationListeners(
      handleNotificationReceived,
      handleNotificationTapped
    );

    return () => {
      removeNotificationListeners(subscriptions);
    };
  }, []);

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
  };

  const handleNotificationTapped = (response) => {
    const responseId = response?.notification?.request?.identifier;
    if (responseId && handledResponseIdRef.current === responseId) {
      console.log('[Push] Ignoring already-handled notification tap:', responseId);
      return;
    }
    handledResponseIdRef.current = responseId ?? null;

    const data = response?.notification?.request?.content?.data;
    // Left in deliberately (not gated on __DEV__): this is the only way to
    // see the actual payload a real push notification arrived with, since
    // it comes from the backend, not from anything reproducible locally.
    console.log('[Push] Notification tapped, raw data:', JSON.stringify(data));
    if (!data) return;

    // Same resolver the in-app notification bell list uses
    // (NotificationScreen/index.js) - the API now forwards the full
    // notification `data` payload (see PushNotificationService.php), so this
    // has everything that switch already knows how to route.
    const target = resolveNotificationTarget({ type: data.type, data, actor: data.actor });

    console.log('[Push] Resolved navigation target:', target);

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




