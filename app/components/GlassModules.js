import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

// ---------------------------------------------------------------------------
// iOS below 26 has no system liquid glass, and the library's fallback there is
// a plain frosted UIBlurEffect. With "Liquid glass effect" on, those versions
// get this instead: an expo-blur system material (Gaussian blur, drawn by the
// OS compositor - no per-frame work in JS) under a light tint, a soft
// highlight from the top and a hairline bright edge, which is what makes a
// blurred panel read as glass. Nothing in it animates, so scrolling stays
// smooth. iOS 26+ keeps the real UIGlassEffect, Android keeps its shader.
//
// expo-blur is loaded in a try block and its native view is looked up first:
// JS that reaches a build made before the package was added keeps the
// library's fallback instead of crashing on a missing view.
// ---------------------------------------------------------------------------
let BlurView = null;
if (Platform.OS === "ios" && parseInt(Platform.Version, 10) < 26) {
  try {
    const hasNativeView = !!globalThis.expo?.getViewConfig?.("ExpoBlur", "ExpoBlurView");
    if (hasNativeView) {
      BlurView = require("expo-blur").BlurView;
    }
  } catch (error) {
    BlurView = null;
  }
}

const BlurGlassView = ({ tintColor, style, borderRadius, children }) => {
  const { isDarkMode } = useTheme();
  const flat = StyleSheet.flatten(style) || {};
  const radius = borderRadius ?? flat.borderRadius ?? 0;
  // The default glass tint is tuned for real glass; over a blur it would
  // double up with the material's own tint, so it is thinned here. A custom
  // tint (a LiquidButton's own colour) is the surface the caller asked for.
  const isDefaultTint = tintColor == null || tintColor === glassTint(isDarkMode);
  const overlay = isDefaultTint
    ? isDarkMode ? "rgba(22, 22, 24, 0.30)" : "rgba(255, 255, 255, 0.24)"
    : tintColor;

  return (
    <View
      style={[
        style,
        { overflow: "hidden", backgroundColor: "transparent" },
        borderRadius != null && { borderRadius },
      ]}
    >
      <BlurView
        pointerEvents="none"
        intensity={isDarkMode ? 60 : 70}
        tint={isDarkMode ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      <LinearGradient
        pointerEvents="none"
        colors={
          isDarkMode
            ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0)"]
            : ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"]
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)",
          },
        ]}
      />
      {children}
    </View>
  );
};

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
  const { liquidGlassEnabled, isDarkMode } = useTheme();

  if (liquidGlassEnabled && BlurView) {
    return (
      <BlurGlassView tintColor={tintColor} style={style} borderRadius={borderRadius}>
        {children}
      </BlurGlassView>
    );
  }

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

  // `borderRadius` is an optional prop: most call sites never pass it and put
  // the radius in `style` instead. Spreading it unconditionally wrote
  // `borderRadius: undefined` *after* `style`, which in RN's style merge
  // overrides the style's own radius and squares the view off - that's what
  // put a hard-cornered box behind the round "+" tab button whenever the
  // Liquid glass setting was turned off. Only override when actually given.
  // Without the blur behind it, glassTint's 0.4 alpha reads as a see-through
  // smear rather than a surface. Swap the default glass tint for a mostly
  // opaque panel (One UI-style frosted surface); custom tints such as a
  // LiquidButton's own backgroundColor are kept as given.
  const fallbackColor =
    tintColor == null || tintColor === glassTint(isDarkMode)
      ? flatSurface(isDarkMode)
      : tintColor;

  return (
    <View
      style={[
        style,
        { backgroundColor: fallbackColor },
        borderRadius != null && { borderRadius },
      ]}
    >
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

// Flat surface used in place of glassTint when the user turns Liquid glass
// off. There is no blur in that mode, so it has to be nearly opaque to read
// as a panel - close to One UI's frosted bars/drawers.
const flatSurface = (isDarkMode) =>
  isDarkMode ? "rgba(24, 24, 26, 0.9)" : "rgba(250, 250, 252, 0.9)";

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
  flatSurface,
  androidGlassPerfProps,
};

export default {
  LiquidGlassView,
  isGlassAvailable,
  AndroidGlassBackdrop,
  glassTint,
  flatSurface,
  androidGlassPerfProps,
};
