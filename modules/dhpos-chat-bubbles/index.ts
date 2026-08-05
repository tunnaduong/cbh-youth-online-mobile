import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type ShowBubbleOptions = {
  conversationId: string;
  title: string;
  message: string;
  avatarUrl?: string | null;
};

// Android only - Bubbles (floating chat heads) are an Android-specific OS
// feature with no iOS equivalent. On iOS (and if the native module isn't
// present for any reason) this silently no-ops instead of throwing, so call
// sites don't need to guard every call with a platform check themselves.
let NativeChatBubbles: { showBubble(options: ShowBubbleOptions): void } | null = null;
if (Platform.OS === "android") {
  try {
    NativeChatBubbles = requireNativeModule("ExpoChatBubbles");
  } catch (e) {
    console.warn("[ChatBubbles] native module not available:", e);
  }
}

export function showChatBubble(options: ShowBubbleOptions): void {
  if (Platform.OS !== "android" || !NativeChatBubbles) return;
  try {
    NativeChatBubbles.showBubble(options);
  } catch (e) {
    console.warn("[ChatBubbles] showBubble failed:", e);
  }
}
