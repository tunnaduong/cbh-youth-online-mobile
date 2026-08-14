import React from "react";
import { Animated, Platform, DeviceEventEmitter } from "react-native";

const GLASS_READY_EVENT = '__iosGlassReady';

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

// On a genuinely fresh cold start (first launch right after install) on
// iOS 26+, this require() can run before the @callstack/liquid-glass
// native/Fabric component has finished registering, so LiquidGlassView
// comes back undefined and useIOSGlass below gets stuck at false for the
// rest of this process's lifetime - the nav bar then renders through the
// plain/opaque fallback until the app is fully restarted (a new process
// re-runs this module from scratch and the native module is warm by
// then). Wrapping the attempt in a function that can be re-run lets a
// couple of short delayed retries recover from that race within the SAME
// launch, instead of only self-correcting on a manual restart.
const loadIOSGlass = () => {
  if (!(Platform.OS === "ios" && shouldUseIOSGlass)) return false;
  try {
    const Lib = require("@callstack/liquid-glass");
    LiquidGlassView = Lib.LiquidGlassView;
    LiquidGlassContainer = Lib.LiquidGlassContainerView;
    if (LiquidGlassView) {
      AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);
    }
    const ok = !!LiquidGlassView && !!LiquidGlassContainer;
    if (__DEV__) {
      console.log(
        `[GlassModules] iOS Liquid Glass: ${ok ? "SUPPORTED" : "NOT supported"} ` +
        `(iOS ${iosMajorVersion}, requires 26+; @callstack/liquid-glass isLiquidGlassSupported: ${!!Lib.isLiquidGlassSupported})`
      );
    }
    return ok;
  } catch (error) {
    console.warn("Failed to load @callstack/liquid-glass:", error);
    if (__DEV__) {
      console.log(`[GlassModules] iOS Liquid Glass: NOT supported (iOS ${iosMajorVersion}, @callstack/liquid-glass failed to load)`);
    }
    return false;
  }
};

loadIOSGlass();

if (Platform.OS === "ios" && shouldUseIOSGlass && !(LiquidGlassView && LiquidGlassContainer)) {
  [300, 1000].forEach((delay) => {
    setTimeout(() => {
      if (LiquidGlassView && LiquidGlassContainer) return; // already recovered
      if (loadIOSGlass()) {
        useIOSGlass = true;
        DeviceEventEmitter.emit(GLASS_READY_EVENT);
        if (__DEV__) {
          console.log(`[GlassModules] iOS Liquid Glass recovered on retry after ${delay}ms`);
        }
      }
    }, delay);
  });
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
// This app only wants liquid-glass-kit's real SHADER (API 33+) and BLUR
// (API 31-32) tiers. The library's own isLiquidGlassSupported() reports
// "supported" all the way down to API 21 via its SCRIM tier — a deliberately
// subtle translucent scrim, not a real glass render — which was silently
// routing API 30 and below (including Android 9) into the "glass supported"
// branch with only that weak scrim/fallback tint showing, instead of our own
// fallback UI. BLUR (API 31-32) uses a real RenderEffect blur + saturation
// with a clipped shape, so it's a legitimate glass render worth enabling.
const shouldUseAndroidGlass = Platform.OS === "android" && androidApiLevel >= 31;

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
        `(API ${androidApiLevel}, requires 31+; liquid-glass-kit loaded: ${!!LiquidGlassViewAndroid})`
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
//
// NOTE: this is a mutable let. Export consumers get a value snapshot at module
// load time. Use the useIOSGlassSupport() hook inside components so they
// re-render if the 300 ms / 1000 ms retry fires and sets this to true.
let useIOSGlass = shouldUseIOSGlass && !!LiquidGlassView && !!LiquidGlassContainer;

// Hook that returns the current iOS glass support flag and re-renders the
// calling component when the delayed retry succeeds.
const useIOSGlassSupport = () => {
  const [supported, setSupported] = React.useState(useIOSGlass);
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // Subscribe before the synchronous check so we never miss an event that
    // fires between render and this effect body.
    const sub = DeviceEventEmitter.addListener(GLASS_READY_EVENT, () => {
      setSupported(true);
    });
    // The retry may have already completed between the initial useState() call
    // and when this effect ran — pick up that case now.
    if (useIOSGlass) setSupported(true);
    return () => sub.remove();
  }, []);
  return supported;
};
const useAndroidGlass = Platform.OS === "android" && !!LiquidGlassViewAndroid && !!isLiquidGlassSupportedAndroid;

// Shared black/white tint for every Android liquid-glass surface, so the
// glass shader always reads a dark tint in dark mode / light tint in light
// mode instead of rendering untinted (which looks washed-out/glassy with no
// grounding against busy content behind it). Centralized here instead of
// each call site hand-picking its own rgba value, which had drifted to
// visibly different opacities (0.15 to 0.6) across the app.
const androidGlassTint = (isDarkMode) =>
  isDarkMode ? "rgba(0, 0, 0, 0.74)" : "rgba(255, 255, 255, 0.74)";

// Wraps `children` (the backdrop content) in a local Android LiquidGlassProvider
// keyed by `providerId`, on Android when glass is available; plain passthrough
// otherwise. Callers still need to render their own LiquidGlassView(Android)
// glass elements as JSX SIBLINGS of this wrapper (never inside it) — nesting a
// glass view inside the provider it samples recurses the native RenderNode
// capture into itself, which is what crashes the app.
const AndroidGlassBackdrop = ({ providerId, style, children }) => {
  const isGlassProvider = Platform.OS === "android" && useAndroidGlass && !!LiquidGlassProviderAndroid;

  // Mount/unmount tracing for the dev console - lets us confirm each tab's
  // glass provider actually (un)mounts when navigating away/back instead of
  // silently staying alive (stale render) or never mounting at all.
  React.useEffect(() => {
    if (__DEV__) {
      console.log(`[GlassModules] AndroidGlassBackdrop MOUNT   providerId="${providerId}" (glass=${isGlassProvider})`);
    }
    return () => {
      if (__DEV__) {
        console.log(`[GlassModules] AndroidGlassBackdrop UNMOUNT providerId="${providerId}" (glass=${isGlassProvider})`);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  if (isGlassProvider) {
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
  useIOSGlassSupport,
  useAndroidGlass,
  AndroidGlassBackdrop,
  androidGlassTint,
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
  useIOSGlassSupport,
  useAndroidGlass,
  AndroidGlassBackdrop,
  androidGlassTint,
};
