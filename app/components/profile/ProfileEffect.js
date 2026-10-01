import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { normalizeTheme, themeColors } from "../../utils/profileTheme";

// Fixed (not random) spots so every viewer sees the same pattern - same table
// as the web's ProfileEffect. [x%, y%]
const SPOTS = [
  [8, 18], [22, 62], [35, 12], [48, 44], [61, 76], [73, 24], [86, 58],
  [14, 84], [29, 36], [42, 90], [55, 8], [68, 50], [80, 88], [93, 30],
  [5, 46], [18, 6], [39, 70], [52, 26], [64, 94], [77, 40], [90, 12],
];

// Discord plays a profile effect briefly each time the profile is opened.
const PLAY_MS = 6000;

/**
 * Hiệu ứng động phủ lên ảnh bìa/thẻ trang cá nhân (kiểu Profile Effect của
 * Discord). Phủ kín View cha (`position: relative; overflow: hidden`). Chạy
 * khoảng 6 giây rồi mờ dần; đổi `replayKey` để chạy lại (trình chỉnh sửa dùng
 * khi đổi hiệu ứng). Tắt hẳn khi bật Giảm chuyển động trong cài đặt máy.
 */
export default function ProfileEffect({ theme, replayKey }) {
  const normalized = normalizeTheme(theme);
  const effect = normalized?.profile_effect || "none";
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState(null);
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    opacity.value = withDelay(PLAY_MS, withTiming(0, { duration: 1000 }));
    return () => cancelAnimation(opacity);
  }, [effect, replayKey, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (effect === "none" || reduceMotion) return null;

  const [primary, accent] = themeColors(normalized);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, fadeStyle]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {size ? (
        <View key={replayKey ?? effect} style={StyleSheet.absoluteFill}>
          {effect === "sparkles" &&
            SPOTS.map(([x, y], i) => (
              <Sparkle
                key={i}
                left={(x / 100) * size.width}
                top={(y / 100) * size.height}
                delay={(i % 7) * 350}
                color={i % 3 === 0 ? "#fde68a" : "#ffffff"}
                fontSize={10 + (i % 4) * 4}
              />
            ))}

          {effect === "hearts" &&
            SPOTS.slice(0, 14).map(([x], i) => (
              <Heart
                key={i}
                left={(x / 100) * size.width}
                bottom={0}
                delay={(i % 7) * 500}
                duration={(3 + (i % 3)) * 1000}
                color={i % 2 ? "#f472b6" : "#fb7185"}
                fontSize={12 + (i % 3) * 6}
              />
            ))}

          {effect === "snow" &&
            SPOTS.map(([x], i) => (
              <Snowflake
                key={i}
                left={(x / 100) * size.width}
                fall={Math.max(size.height, 200) + 20}
                delay={(i % 7) * 400}
                duration={(3.5 + (i % 4) * 0.7) * 1000}
                size={3 + (i % 3) * 2}
              />
            ))}

          {effect === "aurora" && (
            <>
              <AuroraBand size={size} color={primary} top={-0.5} heightRatio={1.2} opacity={0.7} reverse={false} />
              <AuroraBand size={size} color={accent} top={-0.33} heightRatio={1} opacity={0.6} reverse />
              {SPOTS.slice(0, 10).map(([x, y], i) => (
                <Sparkle
                  key={i}
                  left={(x / 100) * size.width}
                  top={(y / 100) * size.height}
                  delay={i * 300}
                  color="#ffffff"
                  fontSize={9}
                />
              ))}
            </>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

function Sparkle({ left, top, delay, color, fontSize }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1)
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  // 0 -> 0.5 -> 1 : invisible & small -> visible & full size -> invisible
  const style = useAnimatedStyle(() => {
    const peak = 1 - Math.abs(progress.value * 2 - 1);
    return {
      opacity: peak,
      transform: [{ scale: 0.4 + 0.6 * peak }, { rotate: `${progress.value * 180}deg` }],
    };
  });

  return (
    <Animated.Text
      style={[
        styles.glyph,
        { left, top, color, fontSize, textShadowColor: color, textShadowRadius: 6 },
        style,
      ]}
    >
      ✦
    </Animated.Text>
  );
}

function Heart({ left, bottom, delay, duration, color, fontSize }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1)
    );
    return () => cancelAnimation(progress);
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
      transform: [{ translateY: -240 * p }, { scale: 0.6 + 0.5 * p }],
    };
  });

  return (
    <Animated.Text style={[styles.glyph, { left, bottom, color, fontSize }, style]}>
      ♥
    </Animated.Text>
  );
}

function Snowflake({ left, fall, delay, duration, size }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1));
    return () => cancelAnimation(progress);
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.1 ? p / 0.1 : 1 - 0.8 * ((p - 0.1) / 0.9),
      transform: [{ translateX: 24 * p }, { translateY: fall * p }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.snow,
        { left, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

function AuroraBand({ size, color, top, heightRatio, opacity, reverse }) {
  const progress = useSharedValue(reverse ? 1 : 0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(reverse ? 0 : 1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(reverse ? 1 : 0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    return () => cancelAnimation(progress);
  }, [reverse, progress]);

  const width = size.width * 1.5;
  const height = size.height * heightRatio;

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (progress.value * 0.24 - 0.12) * width },
      { scaleY: 1 + 0.2 * progress.value },
    ],
  }));

  const radius = Math.max(width, height) / 2;

  return (
    <Animated.View
      style={[
        { position: "absolute", left: -size.width * 0.25, top: size.height * top, width, height, opacity },
        style,
      ]}
    >
      <Canvas style={{ width, height }}>
        <Circle cx={width / 2} cy={height / 2} r={radius}>
          <RadialGradient c={vec(width / 2, height / 2)} r={radius} colors={[color, `${color}00`]} />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  glyph: { position: "absolute" },
  snow: {
    position: "absolute",
    top: -12,
    backgroundColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
