import React from "react";
import { Platform, View } from "react-native";

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
let LiquidGlassView = null;
let isGlassAvailable = false;

try {
  const Lib = require("react-native-liquid-glassmorphism");
  LiquidGlassView = Lib.LiquidGlassView;
  isGlassAvailable = !!LiquidGlassView;
  console.log(`[GlassModules] react-native-liquid-glassmorphism loaded: ${isGlassAvailable} (platform=${Platform.OS})`);
} catch (error) {
  console.warn("Failed to load react-native-liquid-glassmorphism:", error);
  console.log("[GlassModules] react-native-liquid-glassmorphism: NOT available");
}

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
// blurRadius (dp) overrides whatever `intensity` would otherwise derive for
// the blur pass specifically - explicit 0 on Android means no blur pass at
// all. Left unset on iOS (the `{}` in androidGlassPerfProps below), so iOS
// keeps deriving its blur from `intensity` as before - there's no separate
// "default" blurRadius to set it back to, unset IS the default.
//
// rim/specular both default to true as of 1.1.0+ (they didn't exist as
// controllable props in 1.0.0, so upgrading turned them on for free) - each
// is its own extra optical stage the AGSL shader computes per pixel, every
// frame, on top of refraction/tint/blur: `rim` is the bright Fresnel glass
// edge, `specular` is the moving sheen + specular hotspot. Neither is
// optional extra draw calls, they're more math inside the same per-frame
// pass, so turning both off is a real, direct reduction in per-frame GPU
// cost - dropped for the same reason intensity/thickness/blurRadius are
// already tuned down here.
//
// refraction={false} was tried here too (docs describe it as just dialing
// the lens ~1.35x weaker, not off) but in practice on-device it reads as
// losing the glass look entirely, not just a subtler lens - left at its
// default (true).
// edgeReflectionStrength (default 1) is a separate per-frame shader stage
// too - the mirrored "echo" band reflected back at the top/bottom rim -
// independent of thickness/refraction, so zeroing it drops that stage's
// per-pixel cost without touching the actual lens depth or the glass look
// itself (the library's own docs frame 0 as "calm the reflection while
// keeping a deep lens," not "turn off glass").
const androidGlassPerfProps =
  Platform.OS === "android"
    ? { intensity: 17, thickness: 0.4, blurRadius: 0, rim: false, specular: false, edgeReflectionStrength: 0 }
    : {};

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
