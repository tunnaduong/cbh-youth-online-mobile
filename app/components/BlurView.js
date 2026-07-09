import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { BlurView as NativeBlurView } from "@sbaiahmed1/react-native-blur";

/**
 * A standard, performant BlurView wrapper component.
 * Features:
 * - absolute positioning with overflow: 'hidden'
 * - borderRadius: 30
 * - blurType: 'light' default
 * - max blurAmount: 14 (strictly capped to ensure optimal rendering speed)
 * - Optimized styling and property configurations for Android scroll performance
 */
export const BlurView = ({
  style,
  blurType = "light",
  blurAmount = 14,
  blurRounds = 2,
  overlayColor,
  downsampleFactor,
  children,
  pointerEvents = "none",
  ...props
}) => {
  // Cap blurAmount to a maximum of 14 for scroll performance (especially on Android)
  const cappedBlurAmount = Math.min(Math.max(0, blurAmount), 14);

  // Android-specific performance optimizations
  const androidDownsample = downsampleFactor ?? 8;
  const androidBlurRounds = Math.min(blurRounds, 2);

  return (
    <View
      style={[styles.container, style]}
      pointerEvents={pointerEvents}
    >
      <NativeBlurView
        style={styles.blurView}
        blurType={blurType}
        blurAmount={cappedBlurAmount}
        blurRounds={Platform.OS === "android" ? androidBlurRounds : blurRounds}
        downsampleFactor={Platform.OS === "android" ? androidDownsample : undefined}
        overlayColor={overlayColor}
        {...props}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderRadius: 30,
  },
  blurView: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default BlurView;
