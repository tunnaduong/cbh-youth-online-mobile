import { Platform } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

let cachedHeaders = null;

// What the user called this device ("Tùng's iPhone") when the OS exposes
// it, otherwise the model.
export function getDeviceModel() {
  if (Platform.OS === "android") {
    return (Platform.constants || {}).Model || "Android";
  }
  return Platform.isPad ? "iPad" : "iPhone";
}

export function getDeviceName() {
  return Constants.deviceName || getDeviceModel();
}

/**
 * Headers sent with every API request, describing this device for the
 * "logged-in devices" list. Values are URL-encoded because HTTP headers
 * can't carry non-ASCII text (the API decodes them).
 */
export function getClientHeaders() {
  if (cachedHeaders) return cachedHeaders;

  const headers = {
    "X-Client-Platform": Platform.OS,
    "X-Device-Name": encodeURIComponent(getDeviceName()),
    "X-Device-Model": encodeURIComponent(getDeviceModel()),
  };

  if (Application.nativeApplicationVersion) {
    headers["X-Client-Version"] = encodeURIComponent(Application.nativeApplicationVersion);
  }

  cachedHeaders = headers;
  return headers;
}

// "Remember this device" token for two-factor login. One token serves every
// account signed in on this device, so it is kept across sign-outs.
const TWO_FACTOR_DEVICE_KEY = "two_factor_device_token";

export async function getTwoFactorDeviceToken() {
  try {
    return await AsyncStorage.getItem(TWO_FACTOR_DEVICE_KEY);
  } catch {
    return null;
  }
}

export async function setTwoFactorDeviceToken(token) {
  if (!token) return;
  try {
    await AsyncStorage.setItem(TWO_FACTOR_DEVICE_KEY, token);
  } catch {
    // Worst case the next login asks for the code again.
  }
}
