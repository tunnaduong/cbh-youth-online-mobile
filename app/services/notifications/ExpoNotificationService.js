import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getExpoProjectId() {
  return (
    Constants.expoConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.manifest?.extra?.eas?.projectId ||
    null
  );
}

/**
 * Request notification permissions
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
export async function requestNotificationPermissions() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "CBH Online",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#319527",
      });
    }

    // Check if running on physical device (simulators/emulators can't receive push notifications)
    // For Expo, we'll just try to get permissions and let it fail gracefully if on simulator
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    console.log("Notification permission status:", {
      existingStatus,
      finalStatus,
    });

    if (finalStatus !== "granted") {
      console.warn("Failed to get push token for push notification!");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
}

/**
 * Get Expo push token
 * @returns {Promise<string|null>} Expo push token or null if failed
 */
export async function getExpoPushToken() {
  try {
    if (!Constants.isDevice) {
      console.warn("Push notifications require a physical device.");
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn(
        "Expo projectId is missing from app config. Add expo.projectId to app.json."
      );
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || "172eec8c-8c58-453c-a375-258412496e09",
    });

    console.log("Expo push token response:", tokenData);

    if (!tokenData?.data) {
      console.error("Expo push token response missing data:", tokenData);
      return null;
    }

    console.log("Expo push token obtained:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("Error getting Expo push token:", error);
    return null;
  }
}

/**
 * Get device type (ios or android)
 * @returns {string|null}
 */
export function getDeviceType() {
  if (Platform.OS === "ios") {
    return "ios";
  } else if (Platform.OS === "android") {
    return "android";
  }
  return null;
}

/**
 * Set up notification listeners
 * @param {Function} onNotificationReceived - Callback when notification is received
 * @param {Function} onNotificationTapped - Callback when notification is tapped
 * @returns {Array} Array of subscription objects to remove listeners
 */
export function setupNotificationListeners(
  onNotificationReceived,
  onNotificationTapped
) {
  const subscriptions = [];

  // Listener for notifications received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("Notification received:", notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    }
  );

  // Listener for when user taps on notification
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response);
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });

  subscriptions.push(receivedSubscription, responseSubscription);

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        console.log("Initial notification response:", response);
        if (onNotificationTapped) {
          onNotificationTapped(response);
        }
      } else {
        console.log("No initial notification response on startup.");
      }
    })
    .catch((error) => {
      console.error("Error getting last notification response:", error);
    });

  return subscriptions;
}

/**
 * Remove notification listeners
 * @param {Array} subscriptions - Array of subscription objects
 */
export function removeNotificationListeners(subscriptions) {
  subscriptions.forEach((subscription) => {
    if (subscription && typeof subscription.remove === "function") {
      subscription.remove();
    }
  });
}

/**
 * Get notification badge count
 * @returns {Promise<number>}
 */
export async function getBadgeCount() {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error("Error getting badge count:", error);
    return 0;
  }
}

/**
 * Set notification badge count
 * @param {number} count - Badge count
 */
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("Error setting badge count:", error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error("Error clearing notifications:", error);
  }
}

/**
 * Schedule a local notification (for testing or local reminders)
 * @param {Object} notification - Notification object with title, body, data, etc.
 * @param {Object} trigger - Trigger object (seconds, date, etc.)
 * @returns {Promise<string>} Notification identifier
 */
export async function scheduleLocalNotification(notification, trigger) {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: notification,
      trigger: trigger,
    });
  } catch (error) {
    console.error("Error scheduling notification:", error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 * @param {string} notificationId - Notification identifier
 */
export async function cancelScheduledNotification(notificationId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error("Error canceling notification:", error);
  }
}
