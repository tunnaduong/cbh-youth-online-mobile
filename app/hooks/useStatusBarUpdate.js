import { useCallback, useRef } from "react";
import { Platform, StatusBar } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useStatusBar } from "../contexts/StatusBarContext";

// Applies the native StatusBar call directly, in addition to updating
// StatusBarContext. Android can otherwise show a stale bar after a
// navigation transition: the context update only reaches the native
// module once App.js re-renders and its resync effect runs, and when
// several screens focus/blur in quick succession (e.g. popping back
// through two screens at once), that effect can end up reading a value
// that no longer matches what this screen actually needs. Calling the
// native API here, synchronously on focus, makes this screen's status
// bar correct regardless of that downstream timing.
const applyStatusBarNow = (style, bgColor) => {
  if (Platform.OS !== "android" || !style) return;
  StatusBar.setBarStyle(style, true);
  if (bgColor) StatusBar.setBackgroundColor(bgColor, true);
};

/**
 * Hook to automatically update status bar based on scroll position
 * Useful for screens with images or gradients at the top
 *
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Scroll position threshold (default: 50)
 * @param {string} options.scrolledStyle - Status bar style when scrolled (default: "dark-content")
 * @param {string} options.initialStyle - Status bar style when at top (default: "light-content")
 * @param {string} options.scrolledBgColor - Background color when scrolled (default: "#ffffff")
 * @param {string} options.initialBgColor - Background color when at top (default: "#000000")
 * @returns {Object} - { onScroll, scrollViewRef }
 */
export const useStatusBarUpdate = ({
  threshold = 50,
  scrolledStyle = "dark-content",
  initialStyle = "light-content",
  scrolledBgColor = "#ffffff",
  initialBgColor = "#000000",
} = {}) => {
  const { updateStatusBar } = useStatusBar();
  const scrollViewRef = useRef(null);
  const isScrolled = useRef(false);

  // Use focus/blur (not mount/unmount) so re-entering an already-mounted
  // stack screen (e.g. navigating back) reliably re-applies its status bar
  // style. React Navigation guarantees blur-then-focus ordering, unlike
  // React's mount/unmount effect timing which can interleave unpredictably
  // when screens are kept alive underneath the stack.
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log("[StatusBar] useStatusBarUpdate focus", { initialStyle, initialBgColor });
      }
      isScrolled.current = false;
      updateStatusBar(initialStyle, initialBgColor);
      applyStatusBarNow(initialStyle, initialBgColor);

      return () => {
        if (__DEV__) {
          console.log("[StatusBar] useStatusBarUpdate blur, resetting");
        }
        updateStatusBar(null, null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialStyle, initialBgColor, updateStatusBar])
  );

  const handleScroll = (event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldBeScrolled = scrollY > threshold;

    if (shouldBeScrolled !== isScrolled.current) {
      isScrolled.current = shouldBeScrolled;
      const nextStyle = shouldBeScrolled ? scrolledStyle : initialStyle;
      const nextBgColor = shouldBeScrolled ? scrolledBgColor : initialBgColor;
      updateStatusBar(nextStyle, nextBgColor);
      applyStatusBarNow(nextStyle, nextBgColor);
    }
  };

  return {
    onScroll: handleScroll,
    scrollViewRef,
  };
};

/**
 * Simple hook to set status bar style directly
 * Useful for screens with fixed backgrounds
 *
 * @param {string} style - Status bar style ("light-content" | "dark-content" | "default")
 * @param {string} bgColor - Background color (default: "#ffffff")
 */
export const useStatusBarStyle = (
  style = "dark-content",
  bgColor = "#ffffff"
) => {
  const { updateStatusBar } = useStatusBar();

  // Use focus/blur instead of mount/unmount: stack screens stay mounted
  // underneath the active one, so a mount-only effect never re-fires when
  // navigating back to this screen, and its unmount cleanup can race with
  // the newly focused screen's mount effect, leaving the wrong style applied.
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log("[StatusBar] useStatusBarStyle focus", { style, bgColor });
      }
      updateStatusBar(style, bgColor);
      applyStatusBarNow(style, bgColor);

      return () => {
        if (__DEV__) {
          console.log("[StatusBar] useStatusBarStyle blur, resetting");
        }
        updateStatusBar(null, null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [style, bgColor, updateStatusBar])
  );
};
