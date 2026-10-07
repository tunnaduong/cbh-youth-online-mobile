import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  RoundedRect,
  SweepGradient,
  rrect,
  rect,
  vec,
} from "@shopify/react-native-skia";
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { normalizeTheme, themeColors, withAlpha } from "../../utils/profileTheme";

const GOLD = ["#b45309", "#fde68a", "#d97706", "#fef3c7", "#b45309"];

/**
 * Khung trang trí quanh thẻ/ảnh bìa trang cá nhân (kiểu Profile Frame của
 * Discord). Phủ kín View cha (`position: relative`), bo góc theo `radius`.
 *
 *   glow - viền màu chính, phát sáng vào trong
 *   gold - viền vàng chuyển sắc, 4 góc có hoa văn
 *   neon - viền gradient màu theme xoay vòng
 */
export default function ProfileFrame({ theme, radius = 0 }) {
  const normalized = normalizeTheme(theme);
  const frame = normalized?.profile_frame || "none";
  const [size, setSize] = useState(null);

  if (frame === "none") return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {size ? (
        <Canvas style={{ width: size.width, height: size.height }}>
          {frame === "glow" ? (
            <Glow size={size} radius={radius} colors={themeColors(normalized)} />
          ) : frame === "gold" ? (
            <Gold size={size} radius={radius} />
          ) : (
            <Neon size={size} radius={radius} colors={themeColors(normalized)} />
          )}
        </Canvas>
      ) : null}
    </View>
  );
}

function Glow({ size, radius, colors: [primary, accent] }) {
  const { width, height } = size;
  const clip = rrect(rect(0, 0, width, height), radius, radius);
  return (
    <Group clip={clip}>
      {/* Soft glow bleeding inwards from the edge */}
      <RoundedRect x={0} y={0} width={width} height={height} r={radius} style="stroke" strokeWidth={44} color={withAlpha(accent, 0.33)}>
        <BlurMask blur={16} style="normal" />
      </RoundedRect>
      <RoundedRect x={0} y={0} width={width} height={height} r={radius} style="stroke" strokeWidth={22} color={withAlpha(primary, 0.6)}>
        <BlurMask blur={8} style="normal" />
      </RoundedRect>
      <RoundedRect x={1} y={1} width={width - 2} height={height - 2} r={Math.max(0, radius - 1)} style="stroke" strokeWidth={2} color={primary} />
    </Group>
  );
}

function Gold({ size, radius }) {
  const { width, height } = size;
  const inset = 2.5;
  const ornament = 12;
  const corners = [
    [4 + ornament / 2, 4 + ornament / 2],
    [width - 4 - ornament / 2, 4 + ornament / 2],
    [4 + ornament / 2, height - 4 - ornament / 2],
    [width - 4 - ornament / 2, height - 4 - ornament / 2],
  ];
  return (
    <>
      <RoundedRect
        x={inset}
        y={inset}
        width={width - inset * 2}
        height={height - inset * 2}
        r={Math.max(0, radius - inset)}
        style="stroke"
        strokeWidth={5}
      >
        <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={GOLD} />
      </RoundedRect>
      {corners.map(([cx, cy], index) => (
        <Group key={index} origin={vec(cx, cy)} transform={[{ rotate: Math.PI / 4 }]}>
          <RoundedRect x={cx - ornament / 2} y={cy - ornament / 2} width={ornament} height={ornament} r={1}>
            <LinearGradient start={vec(cx - ornament / 2, cy - ornament / 2)} end={vec(cx + ornament / 2, cy + ornament / 2)} colors={["#f59e0b", "#fde68a"]} />
          </RoundedRect>
          <RoundedRect x={cx - ornament / 2} y={cy - ornament / 2} width={ornament} height={ornament} r={1} style="stroke" strokeWidth={2} color="#fde68a" />
        </Group>
      ))}
    </>
  );
}

function Neon({ size, radius, colors: [primary, accent] }) {
  const { width, height } = size;
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    rotation.value = withRepeat(withTiming(Math.PI * 2, { duration: 5000, easing: Easing.linear }), -1);
    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation]);

  const center = vec(width / 2, height / 2);
  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);

  return (
    <RoundedRect
      x={1.5}
      y={1.5}
      width={width - 3}
      height={height - 3}
      r={Math.max(0, radius - 1.5)}
      style="stroke"
      strokeWidth={3}
    >
      <SweepGradient
        c={center}
        origin={center}
        transform={transform}
        colors={[primary, accent, "#ffffff", primary, accent, primary]}
      />
    </RoundedRect>
  );
}
