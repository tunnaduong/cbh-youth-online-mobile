import AsyncStorage from "@react-native-async-storage/async-storage";

// Android-only device preference for whether incoming chat messages should
// show as a floating "bubble" (see modules/expo-chat-bubbles) instead of/
// alongside a normal notification. Defaults to on.
const STORAGE_KEY = "chat_bubbles_enabled";

export const isChatBubblesEnabled = async () => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === null ? true : value === "true";
  } catch (e) {
    return true;
  }
};

export const setChatBubblesEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch (e) {
    // Ignore - worst case the toggle doesn't persist across restarts.
  }
};
