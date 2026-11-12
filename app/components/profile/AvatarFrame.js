import React, { useEffect } from "react";
import { View } from "react-native";
import { Canvas, Circle, LinearGradient, SweepGradient, vec } from "@shopify/react-native-skia";
import Svg, { Circle as SvgCircle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { getAvatarFrame } from "../../utils/profileTheme";

// The ring overflows the avatar by 4% on each side and is 12% of its radius
// thick - same proportions as the web's AvatarFrame.
const OVERFLOW = 0.04;
const THICKNESS = 0.12;

// An uploaded frame is drawn at this multiple of the avatar's size: the
// avatar fills the middle 80% of the image (same as the web).
const IMAGE_SCALE = 1.25;

/**
 * Khung trang trí quanh avatar. Đặt trong một View `position: relative` có
 * kích thước đúng bằng avatar (dùng AvatarFrameWrap cho tiện) - khung tràn ra
 * ngoài một chút, nên View cha không được `overflow: hidden`.
 *
 * Props:
 *   theme - `theme`/`profile_theme` của người dùng từ API, hoặc null
 *   size  - đường kính avatar
 */
const AvatarFrame = React.memo(function AvatarFrame({ theme, size, staticPreview = false }) {
  const frame = getAvatarFrame(theme);
  if (!frame || !size) return null;
  if (frame.image) return <ImageFrame uri={frame.image} size={size} />;
  return <Ring frame={frame} size={size} staticPreview={staticPreview} />;
});

export default AvatarFrame;

function ImageFrame({ uri, size }) {
  const outer = size * IMAGE_SCALE;
  const offset = (size - outer) / 2;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: offset, top: offset, width: outer, height: outer }}>
      <Image
        source={{ uri }}
        style={{ width: outer, height: outer }}
        contentFit="contain"
        // Decoration: a screen reader reads the name next to it.
        accessible={false}
      />
    </View>
  );
}

function Ring({ frame, size, staticPreview }) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  // Only spin on hero/medium avatars (> 52px) when not in staticPreview mode.
  // Avoids spawning dozens of concurrent Reanimated loops + Skia GPU surfaces
  // in chat/notification/comment/milestone lists.
  const spin = Boolean(frame.animated && !reduceMotion && !staticPreview && size > 52);
  const useLightweightSvg = !frame.sweep || size <= 52 || staticPreview;

  useEffect(() => {
    if (!spin) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return undefined;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1);
    return () => cancelAnimation(rotation);
  }, [spin, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const outer = size * (1 + OVERFLOW * 2);
  const center = outer / 2;
  const strokeWidth = center * THICKNESS;
  const colors = frame.colors || ["#319527", "#4ade80"];

  if (useLightweightSvg) {
    const stopCount = Math.max(2, colors.length);
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -size * OVERFLOW,
          top: -size * OVERFLOW,
          width: outer,
          height: outer,
        }}
      >
        <Svg width={outer} height={outer}>
          <Defs>
            <SvgLinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              {colors.map((c, idx) => (
                <Stop
                  key={idx}
                  offset={`${Math.round((idx / (stopCount - 1)) * 100)}%`}
                  stopColor={c}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <SvgCircle
            cx={center}
            cy={center}
            r={Math.max(1, center - strokeWidth / 2)}
            stroke="url(#ringGrad)"
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: -size * OVERFLOW,
          top: -size * OVERFLOW,
          width: outer,
          height: outer,
        },
        animatedStyle,
      ]}
    >
      <Canvas style={{ width: outer, height: outer }}>
        <Circle cx={center} cy={center} r={center - strokeWidth / 2} style="stroke" strokeWidth={strokeWidth}>
          {frame.sweep ? (
            <SweepGradient c={vec(center, center)} colors={frame.colors} />
          ) : (
            <LinearGradient start={vec(0, 0)} end={vec(outer, outer)} colors={frame.colors} />
          )}
        </Circle>
      </Canvas>
    </Animated.View>
  );
}

/**
 * Bọc một avatar có sẵn để vẽ khung bên ngoài nó.
 *
 * Props:
 *   theme - `theme`/`profile_theme` của người dùng, hoặc null
 *   size  - đường kính avatar
 *   style - style bố cục (margin...) - đặt ở đây thay vì trên avatar để
 *           khung ôm đúng avatar
 */
export const AvatarFrameWrap = React.memo(function AvatarFrameWrap({ theme, size, style, staticPreview = false, children }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      {children}
      <AvatarFrame theme={theme} size={size} staticPreview={staticPreview} />
    </View>
  );
});
