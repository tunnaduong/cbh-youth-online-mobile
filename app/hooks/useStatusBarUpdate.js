import { useEffect, useRef } from "react";
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

  useEffect(() => {
    // Set initial status bar style
    updateStatusBar(initialStyle, initialBgColor);

    return () => {
      // Reset to default when component unmounts
      updateStatusBar("dark-content", "#ffffff");
    };
  }, []);

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

  useEffect(() => {
    updateStatusBar(style, bgColor);

    return () => {
      // Reset to default when component unmounts
      updateStatusBar("dark-content", "#ffffff");
    };
  }, [style, bgColor, updateStatusBar]);
};
