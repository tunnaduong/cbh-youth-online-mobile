import React from "react";
import { Platform, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// ---------------------------------------------------------------------------
// react-native-liquid-glassmorphism - single cross-platform glass component.
// Replaces the old per-platform stack (@callstack/liquid-glass +
// @sbaiahmed1/react-native-blur on iOS, liquid-glass-kit on Android). The
// library handles OS-version tiering internally:
//   iOS 26+   -> native UIGlassEffect
//   iOS 15-25 -> UIBlurEffect frosted fallback (no separate BlurView needed)
//   Android 33+ -> AGSL refraction shader
//   Android 31-32 -> blur + tint (no refraction)
//   Android <31 -> translucent tint only
// so there is no more JS-side OS-version branching for the glass itself -
// every call site just renders <LiquidGlassView>.
//
// It also has no "provider" concept (unlike liquid-glass-kit's
// LiquidGlassProvider/providerId pairing) - each <LiquidGlassView> captures
// its own backdrop independently, so AndroidGlassBackdrop below is kept only
// as a passthrough for the ~30 existing call sites that still wrap screen
// content in it.
// ---------------------------------------------------------------------------
let RealLiquidGlassView = null;
let isGlassAvailable = false;

try {
  const Lib = require("react-native-liquid-glassmorphism");
  RealLiquidGlassView = Lib.LiquidGlassView;
  isGlassAvailable = !!RealLiquidGlassView;
  console.log(`[GlassModules] react-native-liquid-glassmorphism loaded: ${isGlassAvailable} (platform=${Platform.OS})`);
} catch (error) {
  console.warn("Failed to load react-native-liquid-glassmorphism:", error);
  console.log("[GlassModules] react-native-liquid-glassmorphism: NOT available");
}

// Settings' "Liquid glass effect" toggle (default on) reads/writes here, so
// this one component is the only place that needs to know about it - every
// call site across the app just keeps rendering <LiquidGlassView ...> with
// whatever tintColor/style/borderRadius/children it already passes, and
// gets the flat tinted look (the same style Android used before this
// library existed) instead of real glass when the user turns it off,
// without any of those call sites branching on the setting themselves.
// Every call site already passes tintColor as the intended surface color,
// so reusing it as a flat backgroundColor here is a faithful "glass off"
// look, not an approximation cobbled together separately per screen.
const GatedLiquidGlassView = ({
  tintColor,
  style,
  borderRadius,
  children,
  ...rest
}) => {
  const { liquidGlassEnabled } = useTheme();

  if (liquidGlassEnabled) {
    return (
      <RealLiquidGlassView
        tintColor={tintColor}
        style={style}
        borderRadius={borderRadius}
        {...rest}
      >
        {children}
      </RealLiquidGlassView>
    );
  }

  return (
    <View style={[style, { borderRadius, backgroundColor: tintColor }]}>
      {children}
    </View>
  );
};

// Only wrap when the native module actually loaded - staying `null`
// otherwise preserves every call site's own existing fallback branch for
// "library unavailable on this device," which is a different case from
// "available but the user turned it off" (handled inside the wrapper
// above) and already has its own bespoke fallback styling per call site.
const LiquidGlassView = isGlassAvailable ? GatedLiquidGlassView : null;

// Passthrough - the new library needs no ancestor provider. Kept so existing
// <AndroidGlassBackdrop providerId="X" style={{flex:1}}> call sites across
// the app keep compiling unchanged; `style` still needs to land on a real
// View (most callers rely on it for flex:1 layout), `providerId` is simply
// unused now.
const AndroidGlassBackdrop = ({ style, children }) => (
  <View style={style}>{children}</View>
);

// "regular" glass with no explicit tintColor renders with the library's own
// default hue, which reads too light/washed-out in dark mode. Every call
// site should pass this so the glass tints dark in dark mode and light in
// light mode instead of always trending white.
const glassTint = (isDarkMode) =>
  isDarkMode ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)";

// On Android 13+ the library renders its full AGSL refraction shader every
// single frame for every mounted <LiquidGlassView> - capture backdrop -> GPU
// blur -> refraction, regardless of whether anyone is touching it. With
// `intensity`/`thickness` left at their defaults (60 / 1) everywhere, the nav
// pill + FAB alone run two full live shader passes at once, which is the
// main source of the reported Android lag. `intensity` scales the blur
// radius and `thickness` scales the refraction lens depth on Android only
// (both are no-ops on iOS, where the OS manages the real glass material), so
// dialing both down keeps the glass look while cutting the per-frame GPU
// cost. iOS is untouched since its cost is owned by the OS compositor, not us.
//
// Pinned back to 1.0.0 (from 1.2.1) - even after tuning every new-in-1.1.0+
// knob (blurRadius, rim, specular, edgeReflectionStrength all dropped/off),
// 1.2.1 still ran more per-frame shader work than the plain 1.0.0 build did
// at its own defaults. Only intensity/thickness exist as props on 1.0.0 -
// blurRadius/rim/specular/edgeReflectionStrength don't exist on this version
// at all, so they're removed here rather than passed as dead props.
const androidGlassPerfProps =
  Platform.OS === "android" ? { intensity: 7, thickness: 0.4 } : {};

export {
  LiquidGlassView,
  isGlassAvailable,
  AndroidGlassBackdrop,
  glassTint,
  androidGlassPerfProps,
};

export default {
  LiquidGlassView,
  isGlassAvailable,
  AndroidGlassBackdrop,
  glassTint,
  androidGlassPerfProps,
};
