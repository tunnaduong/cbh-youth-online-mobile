import axiosInstance from "../services/api/axiosInstance";

// The Expo push token this device registered with the API for the account
// that is active now (set by NotificationContext when it registers).
//
// Kept here, outside React, because it has to be given back at the one
// moment React state is about to be thrown away: just before the account is
// left. The old code unregistered it from an effect that ran after the
// sign-out - by then the request carried no login, the API ignored it, and
// the account that had been left kept pushing to this phone.
let registeredPushToken = null;

export function rememberPushToken(token) {
  registeredPushToken = token || null;
}

export function currentPushToken() {
  return registeredPushToken;
}

/**
 * Stop the API pushing to this device for the active account. Call it while
 * that account's token is still the one being sent: before logging out,
 * switching to another saved account, or adding one. Best effort - never
 * blocks what the user asked for.
 */
export async function releasePushToken() {
  const token = registeredPushToken;
  registeredPushToken = null;
  if (!token) return;

  try {
    await axiosInstance.delete("/v1.0/notifications/expo/unregister", {
      data: { expo_push_token: token },
      timeout: 5000,
    });
  } catch {}
}
