import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useTheme } from "../contexts/ThemeContext";
import { LiquidGlassView, androidGlassPerfProps, glassTint } from "./GlassModules";

// ---------------------------------------------------------------------------
// LiquidTabBar - the glass capsule behind the main bottom bar and the chat
// gallery switcher, with an iOS 26-style "liquid" selection pill:
//   - the pill can be grabbed anywhere on the bar and dragged; it follows the
//     finger, rubber-bands past the ends and springs to the nearest tab;
//   - it stretches along the drag with speed and squashes across it, and grows
//     a little while held (the lens lifting off the glass);
//   - the icons under it swell and swap to their active look as it passes, and
//     their neighbours are nudged aside, as if the glass displaced them.
// Everything animated runs on the UI thread (Reanimated shared values) so it
// stays smooth on Android, where the glass behind it is already a per-frame
// shader - which is also why the pill is plain Views and never a second glass
// view. Taps and long-presses still go to the buttons: the pan only activates
// after a horizontal move.
// ---------------------------------------------------------------------------

const IS_IOS_26_PLUS = Platform.OS === "ios" && parseInt(Platform.Version, 10) >= 26;
const SPRING = { damping: 17, stiffness: 230, mass: 0.8 };
const PRESS_SPRING = { damping: 14, stiffness: 260, mass: 0.6 };

const clamp = (v, lo, hi) => {
  "worklet";
  return Math.min(hi, Math.max(lo, v));
};

// Past either end the pill follows the finger at a third of the distance.
const rubberBand = (v, lo, hi) => {
  "worklet";
  if (v < lo) return lo - (lo - v) * 0.33;
  if (v > hi) return hi + (v - hi) * 0.33;
  return v;
};

const TabItem = memo(
  ({
    item,
    index,
    slot,
    x,
    pressed,
    inactiveColor,
    activeColor,
    badgeBorderColor,
    reduceMotion,
    onPress,
  }) => {
    const proximity = useAnimatedStyle(() => {
      const d = Math.abs(x.value - index * slot.value);
      const p = slot.value > 0 ? clamp(1 - d / slot.value, 0, 1) : 0;
      return { opacity: 1 - p };
    });
    const activeLayer = useAnimatedStyle(() => {
      const d = Math.abs(x.value - index * slot.value);
      const p = slot.value > 0 ? clamp(1 - d / slot.value, 0, 1) : 0;
      return { opacity: p };
    });
    const wrapper = useAnimatedStyle(() => {
      const signed = index * slot.value - x.value;
      const d = Math.abs(signed);
      const s = slot.value || 1;
      const p = clamp(1 - d / s, 0, 1);
      if (reduceMotion) return { transform: [{ scale: 1 }] };
      // Swell under the lens, nudge neighbours away from it while it is held.
      const swell = 1 + 0.14 * p * pressed.value;
      const near = clamp(1 - d / (s * 1.6), 0, 1) * (1 - p);
      const nudge = Math.sign(signed) * 2.5 * near * pressed.value;
      return { transform: [{ translateX: nudge }, { scale: swell }] };
    });

    const badge = item.badge || 0;
    return (
      <TouchableOpacity
        style={styles.button}
        onPress={() => onPress(item.key)}
        onLongPress={item.onLongPress}
        delayLongPress={450}
        activeOpacity={0.75}
        accessibilityRole="tab"
        accessibilityState={{ selected: !!item.focused }}
        accessibilityLabel={item.label}
      >
        <Animated.View style={[styles.iconWrap, wrapper]}>
          <Animated.View style={proximity}>
            {item.render({ focused: false, color: inactiveColor })}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconWrap, activeLayer]}>
            {item.render({ focused: true, color: activeColor })}
          </Animated.View>
          {badge > 0 && (
            <View style={[styles.badge, { borderColor: badgeBorderColor }]}>
              <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  }
);

const LiquidTabBar = ({
  items,
  activeKey,
  onSelect,
  height = 58,
  radius = height / 2,
  inset = 5,
  width,
  style,
}) => {
  const { isDarkMode, liquidGlassEnabled } = useTheme();
  const count = items.length;
  const activeIndex = Math.max(0, items.findIndex((i) => i.key === activeKey));
  const pillHeight = height - inset * 2;

  const [track, setTrack] = useState({ w: 0, h: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const slotPx = count > 0 ? track.w / count : 0;
  const slot = useSharedValue(0);
  const x = useSharedValue(0);
  const pressed = useSharedValue(0);
  const vel = useSharedValue(0);
  const startX = useSharedValue(0);
  const lastIdx = useSharedValue(activeIndex);
  const dragging = useSharedValue(0);
  const measured = useRef(false);

  const flatGlass = !!LiquidGlassView && !liquidGlassEnabled;
  const useNativeIos26Glass = IS_IOS_26_PLUS && !!LiquidGlassView && liquidGlassEnabled;
  // The bar clips its children unless it is the native iOS 26 glass; a clipped
  // bar must not let the held pill grow past the inset.
  const maxGrow = useNativeIos26Glass ? 0.12 : Math.min(0.12, (inset - 1) / pillHeight);
  const stretchOn = !reduceMotion;

  const surface = isDarkMode ? "rgba(22, 22, 26, 0.86)" : "rgba(255, 255, 255, 0.86)";
  const border = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.07)";
  const indicatorColor = isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.075)";
  const heldFill = isDarkMode ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.55)";
  const heldRim = isDarkMode ? "rgba(255, 255, 255, 0.42)" : "rgba(255, 255, 255, 0.95)";
  const activeColor = isDarkMode ? "#FFFFFF" : "#111827";
  const inactiveColor = isDarkMode ? "rgba(255, 255, 255, 0.72)" : "rgba(17, 24, 39, 0.78)";
  const tabGlassTint = useNativeIos26Glass
    ? isDarkMode
      ? "rgba(18, 18, 22, 0.28)"
      : "rgba(255, 255, 255, 0.22)"
    : glassTint(isDarkMode);

  // Keep the shared slot width and position in step with layout / navigation.
  useEffect(() => {
    slot.value = slotPx;
    if (slotPx <= 0) return;
    const target = activeIndex * slotPx;
    if (!measured.current) {
      measured.current = true;
      x.value = target;
    } else if (!dragging.value) {
      x.value = reduceMotion ? withTiming(target, { duration: 160 }) : withSpring(target, SPRING);
    }
    lastIdx.value = activeIndex;
  }, [slotPx, activeIndex, reduceMotion, slot, x, dragging, lastIdx]);

  const tick = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);
  const grab = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);
  const choose = useCallback(
    (index) => {
      const item = items[index];
      if (item && item.key !== activeKey) onSelect(item.key);
    },
    [items, activeKey, onSelect]
  );

  const pan = usePanGesture({
    // Horizontal moves only, so vertical scrolls above the bar and taps on the
    // buttons are untouched.
    activeOffsetX: [-7, 7],
    failOffsetY: [-24, 24],
    onBegin: (e) => {
      "worklet";
      const s = slot.value;
      if (s <= 0) return;
      // Pressing on the pill itself makes the lens "grab" right away.
      if (e.x >= x.value && e.x <= x.value + s) {
        pressed.value = withSpring(1, PRESS_SPRING);
        scheduleOnRN(grab);
      }
    },
    onActivate: (e) => {
      "worklet";
      const s = slot.value;
      if (s <= 0) return;
      dragging.value = 1;
      // Dragging from elsewhere on the bar: the pill jumps under the finger.
      const inside = e.x >= x.value && e.x <= x.value + s;
      if (!inside) {
        const target = clamp(e.x - s / 2, 0, s * (count - 1));
        x.value = withSpring(target, SPRING);
        pressed.value = withSpring(1, PRESS_SPRING);
        scheduleOnRN(grab);
        startX.value = target - 0;
      } else {
        startX.value = x.value;
      }
      lastIdx.value = Math.round(startX.value / s);
    },
    onUpdate: (e) => {
      "worklet";
      const s = slot.value;
      if (s <= 0) return;
      const max = s * (count - 1);
      const next = rubberBand(startX.value + e.translationX, 0, max);
      x.value = next;
      vel.value = e.velocityX;
      const idx = clamp(Math.round(next / s), 0, count - 1);
      if (idx !== lastIdx.value) {
        lastIdx.value = idx;
        scheduleOnRN(tick);
      }
    },
    onDeactivate: (e) => {
      "worklet";
      const s = slot.value;
      if (s <= 0) return;
      dragging.value = 0;
      // Land where the flick would carry the pill, not just where it is.
      const projected = x.value + e.velocityX * 0.1;
      const idx = clamp(Math.round(projected / s), 0, count - 1);
      x.value = withSpring(idx * s, { ...SPRING, velocity: e.velocityX });
      vel.value = withTiming(0, { duration: 380 });
      scheduleOnRN(choose, idx);
    },
    onFinalize: () => {
      "worklet";
      pressed.value = withSpring(0, PRESS_SPRING);
    },
  });

  const pillStyle = useAnimatedStyle(() => {
    const s = slot.value;
    const absV = Math.abs(vel.value);
    const stretch = stretchOn ? clamp(absV / 3600, 0, 0.24) : 0;
    const grow = stretchOn ? maxGrow * pressed.value : 0;
    const sx = 1 + stretch + grow;
    const sy = 1 - stretch * 0.34 + grow;
    // Scale is about the centre, so shift by half the extra width to keep the
    // trailing edge where it was and let the leading edge stretch.
    const dir = vel.value >= 0 ? 1 : -1;
    const lead = dir * (sx - 1) * s * 0.5;
    return {
      width: s,
      opacity: s > 0 ? 1 : 0,
      transform: [{ translateX: x.value + lead }, { scaleX: sx }, { scaleY: sy }],
    };
  });
  const heldStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const NavGlassWrapper = LiquidGlassView ?? View;

  return (
    <NavGlassWrapper
      {...(LiquidGlassView
        ? {
            variant: "regular",
            interactive: true,
            tintColor: tabGlassTint,
            borderRadius: radius,
            ...androidGlassPerfProps,
          }
        : {})}
      renderToHardwareTextureAndroid
      style={[
        {
          height,
          width,
          borderRadius: radius,
          paddingHorizontal: inset,
          backgroundColor: LiquidGlassView ? "transparent" : surface,
          borderWidth: useNativeIos26Glass ? 0 : 1,
          borderColor: border,
          flexDirection: "row",
          alignItems: "center",
          elevation: 10,
          shadowColor: "#000",
          shadowOpacity: isDarkMode ? 0.32 : 0.12,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16,
          overflow: useNativeIos26Glass ? "visible" : "hidden",
        },
        // Android's elevation shadow is always black and ignores the radius.
        ((Platform.OS === "android" && isDarkMode) || flatGlass) && {
          elevation: 0,
          shadowOpacity: 0,
        },
        style,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            if (w !== track.w || h !== track.h) setTrack({ w, h });
          }}
        >
          {slotPx > 0 && (
            <Animated.View
              pointerEvents="none"
              renderToHardwareTextureAndroid
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: (track.h - pillHeight) / 2,
                  height: pillHeight,
                  borderRadius: pillHeight / 2,
                  backgroundColor: indicatorColor,
                },
                pillStyle,
              ]}
            >
              {/* The held lens: brighter body and a light-catching rim. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: pillHeight / 2,
                    backgroundColor: heldFill,
                    borderWidth: 1,
                    borderColor: heldRim,
                  },
                  heldStyle,
                ]}
              />
            </Animated.View>
          )}
          {items.map((item, index) => (
            <TabItem
              key={item.key}
              item={{ ...item, focused: item.key === activeKey }}
              index={index}
              slot={slot}
              x={x}
              pressed={pressed}
              inactiveColor={inactiveColor}
              activeColor={activeColor}
              badgeBorderColor={isDarkMode ? "#1E1E24" : "#FFFFFF"}
              reduceMotion={reduceMotion}
              onPress={onSelect}
            />
          ))}
        </View>
      </GestureDetector>
    </NavGlassWrapper>
  );
};

const styles = StyleSheet.create({
  track: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    backgroundColor: "#FF3B30",
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3.5,
    borderWidth: 1.5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "700",
    lineHeight: 12,
  },
});

export default memo(LiquidTabBar);
