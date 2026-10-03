import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// Long enough for a slow connection; after that the placeholder just stays
// still instead of animating forever behind media that already loaded.
const PULSES = 8;

/**
 * Pulsing placeholder for the box of an image or video that is still
 * loading, instead of an empty or black rectangle. Fills its parent by
 * default (put it behind the media); pass `style` to size it yourself.
 *
 *   dark - for spots that are dark in both themes (video tiles)
 */
export default function MediaShimmer({ style, dark = false }) {
  const { isDarkMode } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
      { iterations: PULSES }
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: dark || isDarkMode ? "#2f3540" : "#dfe5ea", opacity },
        style,
      ]}
    />
  );
}
