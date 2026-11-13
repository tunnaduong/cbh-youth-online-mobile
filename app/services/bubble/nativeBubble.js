import { Platform } from "react-native";
import NativeModule from "../../../modules/hmy-bubble";
import { storage } from "../../global/storage";

/**
 * Android chat bubbles (modules/hmy-bubble): a new chat message becomes a system
 * bubble (Android 11+) that opens the app's own chat screen in a floating
 * window. Every function is a safe no-op on iOS, on Android below 11 and on a
 * binary built before the module existed.
 */
const Native = Platform.OS === "android" ? NativeModule : null;

export const BUBBLE_ENABLED_KEY = "bubbleChatEnabled";

const safe = (fn, fallback = undefined) => {
  try {
    return fn();
  } catch (e) {
    console.warn("[nativeBubble]", e?.message);
    return fallback;
  }
};

/** Bubbles exist from Android 11 (API 30). */
export const bubbleChatAvailable =
  !!Native && Platform.OS === "android" && Number(Platform.Version) >= 30;

export function isBubbleChatEnabled() {
  try {
    return storage.getBoolean(BUBBLE_ENABLED_KEY) ?? false;
  } catch {
    return false;
  }
}

export function setBubbleChatEnabled(enabled) {
  try {
    storage.set(BUBBLE_ENABLED_KEY, !!enabled);
  } catch {}
  if (bubbleChatAvailable) safe(() => Native.setEnabled(!!enabled));
}

/** The system lets this app bubble (app-wide switch in system settings). */
export function bubblesAllowedBySystem() {
  return bubbleChatAvailable ? safe(() => Native.areBubblesAllowed(), false) : false;
}

export function openBubbleSystemSettings() {
  if (bubbleChatAvailable) safe(() => Native.openBubbleSettings());
}

export function setNativeBubbleSession(apiBase, token) {
  if (!bubbleChatAvailable || !apiBase || !token) return;
  safe(() => Native.setSession(String(apiBase), String(token)));
}

export function clearNativeBubbleSession() {
  if (bubbleChatAvailable) safe(() => Native.clearSession());
}

/** Re-applies the saved preference to the native side (app start). */
export function syncBubbleChatEnabled() {
  if (bubbleChatAvailable) safe(() => Native.setEnabled(isBubbleChatEnabled()));
}

/** The user is reading this conversation in the app: drop its bubble. */
export function dismissBubble(conversationId) {
  if (bubbleChatAvailable && conversationId != null) {
    safe(() => Native.dismiss(String(conversationId)));
  }
}

/** Inside the bubble window: fold the bubble back. */
export function collapseBubble() {
  if (bubbleChatAvailable) safe(() => Native.collapse());
}

/** Inside the bubble window: open the main app on a conversation. */
export function openAppAt(conversationId) {
  if (bubbleChatAvailable) safe(() => Native.openApp(String(conversationId)));
}

/** Opens this conversation as an expanded bubble (the "Open in bubble" menu item). */
export async function openChatInBubble(conversationId, title, avatarUrl) {
  if (!bubbleChatAvailable || conversationId == null) return false;
  try {
    return !!(await Native.openBubble(String(conversationId), String(title || ""), avatarUrl || null));
  } catch (e) {
    console.warn("[nativeBubble]", e?.message);
    return false;
  }
}

/** The menu item shows only when the feature can work: Android 11+, switched on. */
export function canOfferOpenInBubble() {
  return bubbleChatAvailable && isBubbleChatEnabled();
}

/** Battery-optimisation helpers (same native module); null when unavailable. */
export function batteryOptimizationApi() {
  if (!Native || typeof Native.requestIgnoreBatteryOptimizations !== "function") return null;
  return {
    isIgnoring: () => safe(() => Native.isIgnoringBatteryOptimizations(), true),
    request: () => safe(() => Native.requestIgnoreBatteryOptimizations()),
  };
}
