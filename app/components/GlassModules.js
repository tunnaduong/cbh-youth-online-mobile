import { Animated, Platform } from "react-native";

// ---------------------------------------------------------------------------
// iOS: @sbaiahmed1/react-native-blur
//
// LiquidGlassView automatically renders true iOS 26+ liquid glass and falls
// back to a real blur on iOS < 26. LiquidGlassContainer renders a native
// UIGlassContainerEffect on iOS 26+ and a plain View otherwise. So we simply
// use these components for every iOS build and the library picks the right
// effect per OS version.
// ---------------------------------------------------------------------------
let BlurView = null;
let LiquidGlassView = null;
let LiquidGlassContainer = null;
let AnimatedLiquidGlassView = null;
let AnimatedBlurView = null;

const iosMajorVersion = Platform.OS === "ios" ? parseInt(Platform.Version, 10) : 0;
const shouldUseIOSGlass = Platform.OS === "ios" && iosMajorVersion >= 26;

if (Platform.OS === "ios" && shouldUseIOSGlass) {
  try {
    const Lib = require("@sbaiahmed1/react-native-blur");
    BlurView = Lib.BlurView;
    LiquidGlassView = Lib.LiquidGlassView;
    LiquidGlassContainer = Lib.LiquidGlassContainer;
    if (LiquidGlassView) {
      AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);
    }
    if (BlurView) {
      AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
    }
    if (__DEV__) {
      console.log(
        `[GlassModules] iOS Liquid Glass: ${!!LiquidGlassView && !!LiquidGlassContainer ? "SUPPORTED" : "NOT supported"} ` +
        `(iOS ${iosMajorVersion}, requires 26+; @sbaiahmed1/react-native-blur loaded: ${!!Lib})`
      );
    }
  } catch (error) {
    console.warn("Failed to load @sbaiahmed1/react-native-blur:", error);
    if (__DEV__) {
      console.log(`[GlassModules] iOS Liquid Glass: NOT supported (iOS ${iosMajorVersion}, @sbaiahmed1/react-native-blur failed to load)`);
    }
  }
} else if (Platform.OS === "ios") {
  try {
    const Lib = require("@sbaiahmed1/react-native-blur");
    BlurView = Lib.BlurView;
    if (BlurView) {
      AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
    }
    if (__DEV__) {
      console.log(
        `[GlassModules] iOS Liquid Glass: NOT supported (iOS ${iosMajorVersion}, requires 26+; ` +
        `using BlurView fallback, loaded: ${!!BlurView})`
      );
    }
  } catch (error) {
    console.warn("Failed to load @sbaiahmed1/react-native-blur:", error);
    if (__DEV__) {
      console.log(`[GlassModules] iOS Liquid Glass: NOT supported (iOS ${iosMajorVersion}, @sbaiahmed1/react-native-blur failed to load)`);
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
};
