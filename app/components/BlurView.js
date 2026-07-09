import React from "react";
import { StyleSheet, View, Platform, useColorScheme } from "react-native";
import { BlurView as NativeBlurView, LiquidGlassView } from "@sbaiahmed1/react-native-blur";
import { useTheme } from "../contexts/ThemeContext";

/**
 * A standard, performant BlurView wrapper component.
 * Features:
 * - absolute positioning with overflow: 'hidden'
 * - borderRadius: 30 (customizable via style prop)
 * - blurType: matching current theme (light or dark)
 * - max blurAmount: 14 (capped on Android for performance)
 * - Uses LiquidGlassView on iOS for premium glassy / liquid glass effect
 * - Uses NativeBlurView on Android with custom theme-based overlayColor
 * - Solves Android corner clipping ("square box" bug) using collapsable={false} and passing borderRadius directly to native view
 * - Optimized downsampling (factor of 2) on Android to prevent pixelated blockiness while maintaining high scroll performance
 */
export const BlurView = ({
  style,
  blurType,
  blurAmount = 14,
  blurRounds = 2,
  overlayColor,
  downsampleFactor,
  children,
  pointerEvents = "none",
  ...props
}) => {
  // Safe theme detection
  const systemScheme = useColorScheme();
  let isDark = systemScheme === "dark";
  try {
    const { isDarkMode } = useTheme();
    isDark = isDarkMode;
  } catch (e) {
    // Fallback if rendered outside ThemeProvider
  }

  const resolvedBlurType = blurType ?? (isDark ? "dark" : "light");

  // Determine dynamic overlay color for Android following the current theme
  const resolvedOverlayColor = overlayColor ?? (isDark 
    ? "rgba(18, 18, 18, 0.6)" 
    : "rgba(255, 255, 255, 0.45)"
  );

  // Extract borderRadius from style if present, default to 30
  const flatStyle = StyleSheet.flatten(style) || {};
  const borderRadius = flatStyle.borderRadius ?? 30;

  // Cap blurAmount to a maximum of 14 for scroll performance (especially on Android)
  const cappedBlurAmount = Math.min(Math.max(0, blurAmount), 14);

  // Android-specific performance optimizations
  const androidDownsample = downsampleFactor ?? 1; // Downsample factor of 1 completely disables downscaling to eliminate pixelation
  const androidBlurRounds = Math.min(blurRounds, 2);

  const renderContent = () => {
    if (Platform.OS === "ios") {
      // Use LiquidGlassView on iOS for the premium glassy/liquid glass effect
      return (
        <LiquidGlassView
          glassType="regular"
          glassTintColor={isDark ? "#1e1e1e" : "#ffffff"}
          glassOpacity={isDark ? 0.35 : 0.15}
          isInteractive={true}
          style={[styles.blurView, { borderRadius }]}
          {...props}
        />
      );
    }

    // Android: Use optimized NativeBlurView
    return (
      <NativeBlurView
        style={[styles.blurView, { borderRadius }]}
        blurType={resolvedBlurType}
        blurAmount={cappedBlurAmount}
        blurRounds={androidBlurRounds}
        downsampleFactor={androidDownsample}
        overlayColor={resolvedOverlayColor}
        {...props}
      />
    );
  };

  return (
    <View
      style={[styles.container, style, { borderRadius }]}
      pointerEvents={pointerEvents}
      collapsable={false}
    >
      {renderContent()}
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
  },
  blurView: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});

export default BlurView;
