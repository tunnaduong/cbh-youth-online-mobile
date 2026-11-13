import { Platform } from "react-native";
import { storage } from "../global/storage";
import { batteryOptimizationApi } from "../services/bubble/nativeBubble";

const ENABLED_KEY = "battery_prompt_enabled";

/** The start-up reminder is on unless the user turned it off in Settings. */
export function isBatteryPromptEnabled() {
  try {
    return storage.getBoolean(ENABLED_KEY) ?? true;
  } catch {
    return true;
  }
}

export function setBatteryPromptEnabled(enabled) {
  try {
    storage.set(ENABLED_KEY, !!enabled);
  } catch {}
}

// Android: at every app start, while background use is not allowed yet, show the
// system "let the app run in the background" dialog (chat messages, calls and
// bubbles arrive on time). Stops by itself once allowed; Settings can switch the
// reminder off for good.
export function askIgnoreBatteryOptimizations() {
  if (Platform.OS !== "android") return;
  try {
    if (!isBatteryPromptEnabled()) return;
    const api = batteryOptimizationApi();
    if (!api || api.isIgnoring()) return;
    api.request();
  } catch {}
}
