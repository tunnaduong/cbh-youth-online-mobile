import { useWindowDimensions } from "react-native";

// Above this, a device counts as a tablet/large screen (iPad, Android
// tablets, unfolded foldables) rather than a phone - matches the common
// 600dp breakpoint Android's own large-screen guidance uses.
const TABLET_BREAKPOINT = 600;

// Feed posts, post detail and chat bubbles read like a normal document, not
// a phone screen - past this width they're capped and centered instead of
// stretching into an uncomfortably wide single line/collage on a tablet or
// unfolded foldable. Phones (the overwhelmingly common case) never reach
// this width, so nothing changes for them.
export const CONTENT_MAX_WIDTH = 680;

/**
 * Reactive replacement for the old `Dimensions.get("window").width` calls
 * scattered around the app: those read the size once at module load, so on
 * a tablet or foldable they never reacted to rotation or unfold/fold. This
 * uses `useWindowDimensions`, which re-renders on both, and also exposes
 * `contentWidth`, the width content should actually render at once capped
 * and centered on a large screen.
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_BREAKPOINT;
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);

  return { width, height, isTablet, isLargeScreen: isTablet, contentWidth };
}
