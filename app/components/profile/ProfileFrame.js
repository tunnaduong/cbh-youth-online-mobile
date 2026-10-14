import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  BlurMask,
  Canvas,
  Group,
  Image as SkiaImage,
  LinearGradient,
  RoundedRect,
  SweepGradient,
  rrect,
  rect,
  useImage,
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
 *   custom - ảnh người dùng tự tải lên (profile_frame_url), vẽ kiểu nine-slice
 */
export default function ProfileFrame({ theme, radius = 0 }) {
  const normalized = normalizeTheme(theme);
  const frame = normalized?.profile_frame || "none";
  const [size, setSize] = useState(null);

  if (frame === "none") return null;
  // No image (removed, or an API that sends none): no frame.
  if (frame === "custom" && !normalized.profile_frame_url) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {!size ? null : frame === "custom" ? (
        <CustomFrame size={size} uri={normalized.profile_frame_url} />
      ) : (
        <Canvas style={{ width: size.width, height: size.height }}>
          {frame === "glow" ? (
            <Glow size={size} radius={radius} colors={themeColors(normalized)} />
          ) : frame === "gold" ? (
            <Gold size={size} radius={radius} />
          ) : (
            <Neon size={size} radius={radius} colors={themeColors(normalized)} />
          )}
        </Canvas>
      )}
    </View>
  );
}

// Part of each side of an uploaded frame that is border art (the API's
// CustomFrameService uses the same number), and the border's thickness on
// screen as a part of the box's smaller side - same as the web.
const SLICE = 0.25;
const THICKNESS = 0.14;

/**
 * The member's own image as a nine-slice border: the four corners keep
 * their shape, the four edges stretch, and the middle of the image is never
 * drawn - so it fits a cover of any shape without covering it.
 */
function CustomFrame({ size, uri }) {
  const image = useImage(uri);
  if (!image) return null;

  const { width, height } = size;
  const iw = image.width();
  const ih = image.height();
  const sw = iw * SLICE;
  const sh = ih * SLICE;
  const t = Math.min(Math.max(Math.min(width, height) * THICKNESS, 6), 40, width / 2, height / 2);

  // [source x, y, width, height] -> [destination x, y, width, height]
  const pieces = [
    [0, 0, sw, sh, 0, 0, t, t],
    [iw - sw, 0, sw, sh, width - t, 0, t, t],
    [0, ih - sh, sw, sh, 0, height - t, t, t],
    [iw - sw, ih - sh, sw, sh, width - t, height - t, t, t],
    [sw, 0, iw - 2 * sw, sh, t, 0, width - 2 * t, t],
    [sw, ih - sh, iw - 2 * sw, sh, t, height - t, width - 2 * t, t],
    [0, sh, sw, ih - 2 * sh, 0, t, t, height - 2 * t],
    [iw - sw, sh, sw, ih - 2 * sh, width - t, t, t, height - 2 * t],
  ].filter((piece) => piece[6] > 0 && piece[7] > 0);

  return (
    <Canvas style={{ width, height }}>
      {pieces.map(([sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight], index) => {
        // The whole image, scaled so this piece lands on its destination,
        // and clipped to it.
        const scaleX = dWidth / sWidth;
        const scaleY = dHeight / sHeight;
        return (
          <Group key={index} clip={rect(dx, dy, dWidth, dHeight)}>
            <SkiaImage
              image={image}
              x={dx - sx * scaleX}
              y={dy - sy * scaleY}
              width={iw * scaleX}
              height={ih * scaleY}
              fit="fill"
            />
          </Group>
        );
      })}
    </Canvas>
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
