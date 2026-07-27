import React from "react";
import { Animated, Platform } from "react-native";

// ---------------------------------------------------------------------------
// iOS: @callstack/liquid-glass for the real iOS 26+ UIGlassEffect
// (LiquidGlassView / LiquidGlassContainerView), @sbaiahmed1/react-native-blur
// for the plain BlurView fallback used on iOS < 26 where there is no glass
// effect to render at all.
// ---------------------------------------------------------------------------
let BlurView = null;
let LiquidGlassView = null;
let LiquidGlassContainer = null;
let AnimatedLiquidGlassView = null;
let AnimatedBlurView = null;

const iosMajorVersion = Platform.OS === "ios" ? parseInt(Platform.Version, 10) : 0;
const shouldUseIOSGlass = Platform.OS === "ios" && iosMajorVersion >= 26;

console.log(iosMajorVersion)

if (Platform.OS === "ios" && shouldUseIOSGlass) {
  try {
    const Lib = require("@callstack/liquid-glass");
    LiquidGlassView = Lib.LiquidGlassView;
    LiquidGlassContainer = Lib.LiquidGlassContainerView;
    if (LiquidGlassView) {
      AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);
    }
    if (__DEV__) {
      console.log(
        `[GlassModules] iOS Liquid Glass: ${!!LiquidGlassView && !!LiquidGlassContainer ? "SUPPORTED" : "NOT supported"} ` +
        `(iOS ${iosMajorVersion}, requires 26+; @callstack/liquid-glass isLiquidGlassSupported: ${!!Lib.isLiquidGlassSupported})`
      );
    }
  } catch (error) {
    console.warn("Failed to load @callstack/liquid-glass:", error);
    if (__DEV__) {
      console.log(`[GlassModules] iOS Liquid Glass: NOT supported (iOS ${iosMajorVersion}, @callstack/liquid-glass failed to load)`);
    }
  }
}

if (Platform.OS === "ios") {
  try {
    const BlurLib = require("@sbaiahmed1/react-native-blur");
    BlurView = BlurLib.BlurView;
    if (BlurView) {
      AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
    }
    if (__DEV__) {
      console.log(
        `[GlassModules] iOS BlurView fallback (< 26): loaded: ${!!BlurView}`
      );
    }
  } catch (error) {
    console.warn("Failed to load @sbaiahmed1/react-native-blur:", error);
    if (__DEV__) {
      console.log(`[GlassModules] iOS BlurView fallback (< 26): @sbaiahmed1/react-native-blur failed to load`);
    }
  }
}

// ---------------------------------------------------------------------------
// Android: liquid-glass-kit (unchanged)
// ---------------------------------------------------------------------------
let LiquidGlassProviderAndroid = null;
let LiquidGlassViewAndroid = null;
let isLiquidGlassSupportedAndroid = false;
let AnimatedLiquidGlassViewAndroid = null;

const androidApiLevel = Platform.OS === "android" ? Platform.Version : 0;
// This app only wants liquid-glass-kit's real SHADER tier (API 33+). The
// library's own isLiquidGlassSupported() reports "supported" all the way
// down to API 21 via its SCRIM tier — a deliberately subtle translucent
// scrim, not a real glass render — which was silently routing API 32 and
// below (including Android 9) into the "glass supported" branch with only
// that weak scrim/fallback tint showing, instead of our own fallback UI.
const shouldUseAndroidGlass = Platform.OS === "android" && androidApiLevel >= 33;

if (Platform.OS === "android") {
  try {
    const LiquidGlassKit = require("liquid-glass-kit");
    LiquidGlassProviderAndroid = LiquidGlassKit.LiquidGlassProvider;
    LiquidGlassViewAndroid = LiquidGlassKit.LiquidGlassView;
    isLiquidGlassSupportedAndroid = shouldUseAndroidGlass;
    if (LiquidGlassViewAndroid) {
      AnimatedLiquidGlassViewAndroid = Animated.createAnimatedComponent(LiquidGlassViewAndroid);
    }
    if (__DEV__) {
      console.log(
        `[GlassModules] Android Liquid Glass: ${isLiquidGlassSupportedAndroid ? "SUPPORTED" : "NOT supported"} ` +
        `(API ${androidApiLevel}, requires 33+; liquid-glass-kit loaded: ${!!LiquidGlassViewAndroid})`
      );
    }
  } catch (error) {
    console.warn("Failed to load liquid-glass-kit:", error);
    if (__DEV__) {
      console.log(`[GlassModules] Android Liquid Glass: NOT supported (API ${androidApiLevel}, liquid-glass-kit failed to load)`);
    }
  }
}

// True when the iOS glass components are available (iOS build linked correctly)
// AND the OS actually supports real Liquid Glass (iOS 26+). Below that, the
// library's LiquidGlassView silently falls back to a plain BlurView subview
// that does NOT respect the parent's borderRadius/overflow clipping — that's
// what caused the square nav bar corners on iOS 18. So on iOS < 26 we report
// useIOSGlass as false and let call sites use BlurView directly instead,
// wrapped in a View that actually clips it.
const useIOSGlass = shouldUseIOSGlass && !!LiquidGlassView && !!LiquidGlassContainer;
const useAndroidGlass = Platform.OS === "android" && !!LiquidGlassViewAndroid && !!isLiquidGlassSupportedAndroid;

// Wraps `children` (the backdrop content) in a local Android LiquidGlassProvider
// keyed by `providerId`, on Android when glass is available; plain passthrough
// otherwise. Callers still need to render their own LiquidGlassView(Android)
// glass elements as JSX SIBLINGS of this wrapper (never inside it) — nesting a
// glass view inside the provider it samples recurses the native RenderNode
// capture into itself, which is what crashes the app.
const AndroidGlassBackdrop = ({ providerId, style, children }) => {
  if (Platform.OS === "android" && useAndroidGlass && LiquidGlassProviderAndroid) {
    return (
      <LiquidGlassProviderAndroid providerId={providerId} style={style}>
        {children}
      </LiquidGlassProviderAndroid>
    );
  }
  return children;
};

export {
  BlurView,
  LiquidGlassView,
  LiquidGlassContainer,
  AnimatedLiquidGlassView,
  AnimatedBlurView,
  LiquidGlassProviderAndroid,
  LiquidGlassViewAndroid,
  isLiquidGlassSupportedAndroid,
  AnimatedLiquidGlassViewAndroid,
  useIOSGlass,
  useAndroidGlass,
  AndroidGlassBackdrop,
};

export default {
  BlurView,
  LiquidGlassView,
  LiquidGlassContainer,
  AnimatedLiquidGlassView,
  AnimatedBlurView,
  LiquidGlassProviderAndroid,
  LiquidGlassViewAndroid,
  isLiquidGlassSupportedAndroid,
  AnimatedLiquidGlassViewAndroid,
  useIOSGlass,
  useAndroidGlass,
  AndroidGlassBackdrop,
};
