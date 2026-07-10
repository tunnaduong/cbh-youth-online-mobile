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

if (Platform.OS === "ios") {
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
  } catch (error) {
    console.warn("Failed to load @sbaiahmed1/react-native-blur:", error);
  }
}

// ---------------------------------------------------------------------------
// Android: liquid-glass-kit (unchanged)
// ---------------------------------------------------------------------------
let LiquidGlassProviderAndroid = null;
let LiquidGlassViewAndroid = null;
let isLiquidGlassSupportedAndroid = false;
let AnimatedLiquidGlassViewAndroid = null;

if (Platform.OS === "android") {
  try {
    const LiquidGlassKit = require("liquid-glass-kit");
    LiquidGlassProviderAndroid = LiquidGlassKit.LiquidGlassProvider;
    LiquidGlassViewAndroid = LiquidGlassKit.LiquidGlassView;
    isLiquidGlassSupportedAndroid = LiquidGlassKit.isLiquidGlassSupported;
    if (LiquidGlassViewAndroid) {
      AnimatedLiquidGlassViewAndroid = Animated.createAnimatedComponent(LiquidGlassViewAndroid);
    }
  } catch (error) {
    console.warn("Failed to load liquid-glass-kit:", error);
  }
}

// True when the iOS glass components are available (iOS build linked correctly).
const useIOSGlass = Platform.OS === "ios" && !!LiquidGlassView && !!LiquidGlassContainer;
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
