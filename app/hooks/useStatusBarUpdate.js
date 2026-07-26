import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useStatusBar } from "../contexts/StatusBarContext";

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
      updateStatusBar(
        shouldBeScrolled ? scrolledStyle : initialStyle,
        shouldBeScrolled ? scrolledBgColor : initialBgColor
      );
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
