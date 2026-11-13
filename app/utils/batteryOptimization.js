import { Platform } from "react-native";
import { storage } from "../global/storage";
import { batteryOptimizationApi } from "../services/bubble/nativeBubble";

const ASKED_KEY = "battery_optimization_asked";

// Android: after the first successful login, ask once to let the app run in the
// background (chat messages, calls and bubbles arrive on time). The flag is set
// before the dialog opens, so declining it never brings it back.
export function askIgnoreBatteryOptimizationsOnce() {
  if (Platform.OS !== "android") return;
  try {
    if (storage.getBoolean(ASKED_KEY)) return;
    const api = batteryOptimizationApi();
    if (!api) return;
    storage.set(ASKED_KEY, true);
    if (api.isIgnoring()) return;
    api.request();
  } catch {}
}
