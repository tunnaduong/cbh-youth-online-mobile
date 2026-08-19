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

export { LiquidGlassView, isGlassAvailable, AndroidGlassBackdrop };

export default { LiquidGlassView, isGlassAvailable, AndroidGlassBackdrop };
