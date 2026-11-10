import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getLanguageDisplayName } from "../utils/aiTranslation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Ultra-fancy AI translation animation effect wrapper.
 * Features:
 * - Dynamic holographic aurora shimmer sweep
 * - Laser neural scanner line
 * - Constellation of floating, pulsing, rotating sparkle stars
 * - Frosted glassmorphic AI translation status capsule
 * - Cosmic sparkle burst & spring reveal on completion
 * - Dissipating magical emerald highlighter sheen
 */
export default function AiTranslateEffect({
  isTranslating,
  isTranslated,
  targetLang = "vi",
  theme,
  isDarkMode,
  t,
  children,
}) {
  // Animated values
  const shimmerTranslate = useRef(new Animated.Value(-1)).current;
  const laserY = useRef(new Animated.Value(0)).current;
  const auraPulse = useRef(new Animated.Value(0)).current;
  const sparkleRotate = useRef(new Animated.Value(0)).current;
  const sparkleScale = useRef(new Animated.Value(0.7)).current;
  const sparkleFloatY = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // Reveal animations
  const revealScale = useRef(new Animated.Value(1)).current;
  const revealOpacity = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const highlightSheen = useRef(new Animated.Value(0)).current;

  // Container height for laser sweep
  const [containerHeight, setContainerHeight] = React.useState(120);

  // Continuous animation loops while translating
  useEffect(() => {
    let shimmerLoop = null;
    let laserLoop = null;
    let auraLoop = null;
    let sparkleRotateLoop = null;
    let sparklePulseLoop = null;
    let sparkleFloatLoop = null;
    let dotsLoop = null;

    if (isTranslating) {
      // Shimmer sweep loop
      shimmerTranslate.setValue(-1);
      shimmerLoop = Animated.loop(
        Animated.timing(shimmerTranslate, {
          toValue: 1,
          duration: 1700,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      shimmerLoop.start();

      // Laser scan loop (sweeping vertically back & forth)
      laserY.setValue(0);
      laserLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserY, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(laserY, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      laserLoop.start();

      // Aurora glow pulse loop
      auraLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(auraPulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(auraPulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      auraLoop.start();

      // Sparkle rotation loop
      sparkleRotateLoop = Animated.loop(
        Animated.timing(sparkleRotate, {
          toValue: 1,
          duration: 3500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      sparkleRotateLoop.start();

      // Sparkle scale pulse
      sparklePulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleScale, {
            toValue: 1.25,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(sparkleScale, {
            toValue: 0.7,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      sparklePulseLoop.start();

      // Sparkle float Y
      sparkleFloatLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleFloatY, {
            toValue: -8,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(sparkleFloatY, {
            toValue: 6,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      sparkleFloatLoop.start();

      // Dots wave animation
      dotsLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(dot1, { toValue: 0.3, duration: 250, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 250, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 250, useNativeDriver: true }),
        ])
      );
      dotsLoop.start();
    } else {
      shimmerTranslate.setValue(-1);
      laserY.setValue(0);
      auraPulse.setValue(0);
      sparkleRotate.setValue(0);
    }

    return () => {
      shimmerLoop?.stop();
      laserLoop?.stop();
      auraLoop?.stop();
      sparkleRotateLoop?.stop();
      sparklePulseLoop?.stop();
      sparkleFloatLoop?.stop();
      dotsLoop?.stop();
    };
  }, [isTranslating]);

  // Trigger cosmic sparkle burst & magic reveal when isTranslated becomes true
  const prevTranslatedRef = useRef(isTranslated);
  useEffect(() => {
    if (!prevTranslatedRef.current && isTranslated) {
      // Flash burst
      flashAnim.setValue(0.9);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Text scale spring & reveal
      revealScale.setValue(0.95);
      revealOpacity.setValue(0.4);
      Animated.parallel([
        Animated.spring(revealScale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(revealOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      // Magic emerald highlight sheen fade out
      highlightSheen.setValue(1);
      Animated.timing(highlightSheen, {
        toValue: 0,
        duration: 1300,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else if (prevTranslatedRef.current && !isTranslated) {
      // Revert to original smooth cross-fade
      revealOpacity.setValue(0.5);
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
    prevTranslatedRef.current = isTranslated;
  }, [isTranslated]);

  // Interpolations
  const shimmerTranslateX = shimmerTranslate.interpolate({
    inputRange: [-1, 1],
    outputRange: [-SCREEN_WIDTH * 0.9, SCREEN_WIDTH * 0.9],
  });

  const laserTranslateY = laserY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(containerHeight - 10, 40)],
  });

  const spin = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const reverseSpin = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const auraOpacity = auraPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });

  const auraScale = auraPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.99, 1.01],
  });

  return (
    <View
      style={styles.outerContainer}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setContainerHeight(h);
      }}
    >
      {/* Aurora Breathing Aura (active while translating) */}
      {isTranslating && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.auraBorder,
            {
              opacity: auraOpacity,
              transform: [{ scale: auraScale }],
              borderColor: isDarkMode ? "#10B981" : "#059669",
            },
          ]}
        />
      )}

      {/* Main Content with Reveal Spring */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: isTranslating ? 0.45 : revealOpacity,
            transform: [{ scale: revealScale }],
          },
        ]}
      >
        {children}
      </Animated.View>

      {/* Magic Highlighter Sheen Fade (when translation first reveals) */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.highlightSheen,
          {
            opacity: highlightSheen,
            backgroundColor: isDarkMode
              ? "rgba(16, 185, 129, 0.22)"
              : "rgba(52, 211, 153, 0.18)",
          },
        ]}
      />

      {/* Shimmer Wave Sweep (active while translating) */}
      {isTranslating && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.overflowHidden]}>
          <Animated.View
            style={[
              styles.shimmerContainer,
              {
                transform: [{ translateX: shimmerTranslateX }, { rotate: "22deg" }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(16, 185, 129, 0)",
                "rgba(16, 185, 129, 0.2)",
                "rgba(6, 182, 212, 0.45)",
                "rgba(139, 92, 246, 0.35)",
                "rgba(16, 185, 129, 0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </View>
      )}

      {/* Laser Neural Scanner Beam (active while translating) */}
      {isTranslating && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.overflowHidden]}>
          <Animated.View
            style={[
              styles.laserBeam,
              {
                transform: [{ translateY: laserTranslateY }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(16, 185, 129, 0)",
                "rgba(16, 185, 129, 0.8)",
                "#06B6D4",
                "rgba(139, 92, 246, 0.8)",
                "rgba(16, 185, 129, 0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.laserGradient}
            />
          </Animated.View>
        </View>
      )}

      {/* Floating Constellation of AI Sparkles (active while translating) */}
      {isTranslating && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.overflowHidden]}>
          {/* Sparkle 1: Top-Left */}
          <Animated.View
            style={[
              styles.sparkleItem,
              {
                top: 4,
                left: 12,
                transform: [
                  { rotate: spin },
                  { scale: sparkleScale },
                  { translateY: sparkleFloatY },
                ],
              },
            ]}
          >
            <Ionicons name="sparkles" size={17} color="#10B981" />
          </Animated.View>

          {/* Sparkle 2: Top-Right */}
          <Animated.View
            style={[
              styles.sparkleItem,
              {
                top: 6,
                right: 14,
                transform: [
                  { rotate: reverseSpin },
                  { scale: sparkleScale },
                ],
              },
            ]}
          >
            <Ionicons name="sparkles" size={15} color="#06B6D4" />
          </Animated.View>

          {/* Sparkle 3: Bottom-Left */}
          <Animated.View
            style={[
              styles.sparkleItem,
              {
                bottom: 8,
                left: 18,
                transform: [
                  { rotate: spin },
                  { scale: sparkleScale },
                ],
              },
            ]}
          >
            <Ionicons name="sparkles" size={14} color="#A855F7" />
          </Animated.View>

          {/* Sparkle 4: Bottom-Right */}
          <Animated.View
            style={[
              styles.sparkleItem,
              {
                bottom: 6,
                right: 18,
                transform: [
                  { rotate: reverseSpin },
                  { scale: sparkleScale },
                  { translateY: sparkleFloatY },
                ],
              },
            ]}
          >
            <Ionicons name="star" size={13} color="#FBBF24" />
          </Animated.View>
        </View>
      )}

      {/* Floating Glassmorphic AI Status Capsule */}
      {isTranslating && (
        <View pointerEvents="none" style={styles.statusCapsuleWrapper}>
          <LinearGradient
            colors={
              isDarkMode
                ? ["rgba(15, 23, 42, 0.95)", "rgba(6, 78, 59, 0.92)"]
                : ["rgba(255, 255, 255, 0.97)", "rgba(236, 253, 245, 0.96)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.statusCapsule,
              {
                borderColor: isDarkMode
                  ? "rgba(52, 211, 153, 0.5)"
                  : "rgba(16, 185, 129, 0.4)",
              },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sparkles" size={15} color="#10B981" />
            </Animated.View>
            <Text
              style={[
                styles.statusCapsuleText,
                { color: isDarkMode ? "#F0FDF4" : "#065F46" },
              ]}
              numberOfLines={1}
            >
              {t
                ? t("post.translating", "Đang dịch bằng Yoyo AI...")
                : "Đang dịch bằng Yoyo AI..."}
            </Text>
            {/* Animated bouncing dots */}
            <View style={styles.dotsRow}>
              <Animated.View
                style={[styles.dot, { opacity: dot1, backgroundColor: "#10B981" }]}
              />
              <Animated.View
                style={[styles.dot, { opacity: dot2, backgroundColor: "#06B6D4" }]}
              />
              <Animated.View
                style={[styles.dot, { opacity: dot3, backgroundColor: "#8B5CF6" }]}
              />
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Flash Wave Burst (on completion) */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.flashBurst,
          {
            opacity: flashAnim,
          },
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0)",
            "rgba(52, 211, 153, 0.6)",
            "rgba(255, 255, 255, 0.8)",
            "rgba(6, 182, 212, 0.6)",
            "rgba(255, 255, 255, 0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "relative",
    borderRadius: 10,
  },
  contentWrapper: {
    position: "relative",
  },
  overflowHidden: {
    overflow: "hidden",
    borderRadius: 10,
  },
  auraBorder: {
    borderRadius: 10,
    borderWidth: 1.5,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  highlightSheen: {
    borderRadius: 8,
  },
  shimmerContainer: {
    position: "absolute",
    top: -SCREEN_WIDTH * 0.3,
    bottom: -SCREEN_WIDTH * 0.3,
    width: SCREEN_WIDTH * 0.55,
  },
  shimmerGradient: {
    flex: 1,
  },
  laserBeam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2.5,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  laserGradient: {
    flex: 1,
    height: 2.5,
  },
  sparkleItem: {
    position: "absolute",
    zIndex: 10,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  statusCapsuleWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    paddingHorizontal: 16,
  },
  statusCapsule: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: "92%",
  },
  statusCapsuleText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
    marginRight: 6,
    letterSpacing: -0.2,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 2,
  },
  dot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    marginHorizontal: 1.5,
  },
  flashBurst: {
    borderRadius: 10,
    zIndex: 25,
  },
});
