import AsyncStorage from "@react-native-async-storage/async-storage";

// Android-only device preference for whether incoming chat messages should
// show as a floating "bubble" (see modules/expo-chat-bubbles) instead of/
// alongside a normal notification. Defaults to OFF, matching Android's own
// system-level Bubbles permission (also off by default per-app) - so our
// toggle doesn't claim to be "on" while the OS would silently ignore it.
const STORAGE_KEY = "chat_bubbles_enabled";

export const isChatBubblesEnabled = async () => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === "true";
  } catch (e) {
    return false;
  }
};

export const setChatBubblesEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch (e) {
    // Ignore - worst case the toggle doesn't persist across restarts.
  }
};
