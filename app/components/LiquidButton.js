import React from "react";
import {
  TouchableOpacity,
  View,
  Platform,
  StyleSheet,
  Animated,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
  LiquidGlassView,
  useIOSGlass,
  BlurView,
  LiquidGlassViewAndroid,
  useAndroidGlass,
  isLiquidGlassSupportedAndroid,
} from "./GlassModules";

const LiquidButton = ({
  onPress,
  children,
  style,
  size = 44,
  borderRadius,
  disabled = false,
  containerStyle,
  providerId,
  scrollY,
  alwaysBorder = false,
  backgroundColor,
}) => {
  const { theme, isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;

  // When scrollY is provided, background fades in as user scrolls (0→40px).
  // At the top, buttons with alwaysBorder still keep a subtle translucent pill.
  const startOpacity = alwaysBorder ? 0.22 : 0;
  const bgOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [startOpacity, 1],
        extrapolate: "clamp",
      })
    : 1;

  const renderGlassBackground = () => {
    if (Platform.OS === "ios") {
      if (useIOSGlass) {
        return (
          <LiquidGlassView
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: defaultRadius,
                overflow: "hidden",
              },
            ]}
            effect="clear"
            tintColor={isDarkMode ? "#111111CC" : "#F8F8F8CC"}
            interactive={false}
          />
        );
      }
      if (BlurView) {
        return (
          <BlurView
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: defaultRadius,
                overflow: "hidden",
              },
            ]}
            blurType={isDarkMode ? "dark" : "light"}
            blurAmount={10}
          />
        );
      }
    }

    // No implicit fallback providerId: most LiquidButton call sites in the
    // app don't pass one, and defaulting them to "main" silently nested a
    // "main"-id glass view inside the "main" LiquidGlassProviderAndroid
    // (e.g. ForumScreen's header button, which lives inside MainScreens'
    // "main" backdrop) — a glass view can never share its provider's own id
    // while living inside that provider's subtree; the provider's RenderNode
    // capture ends up drawing itself, recursing until the native stack
    // overflows (confirmed via on-device SIGSEGV tombstone). Only render
    // real glass when the caller explicitly opts a screen in with a
    // matching local provider.
    if (Platform.OS === "android" && useAndroidGlass && LiquidGlassViewAndroid && providerId) {
      return (
        <LiquidGlassViewAndroid
          providerId={providerId}
          interactive={isLiquidGlassSupportedAndroid}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: defaultRadius,
              overflow: "hidden",
            },
          ]}
          blurRadius={Platform.Version >= 33 ? 12 : 10}
          tint={backgroundColor ?? (isDarkMode ? "rgba(0, 0, 0, 0.3)" : "rgba(240, 240, 240, 0.2)")}
        />
      );
    }

    // Android & fallbacks: OneUI-style tinted transparent button background
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: backgroundColor ?? (isDarkMode ? "rgba(18, 18, 18, 0.85)" : "rgba(255, 255, 255, 0.75)"),
            borderRadius: defaultRadius,
          }
        ]}
      />
    );
  };

  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const buttonStyle = [
    styles.button,
    {
      width: size,
      height: size,
      borderRadius: defaultRadius,
      borderWidth: alwaysBorder ? 1 : 0,
      borderColor: alwaysBorder ? theme.primary : "transparent",
    },
    style,
  ];

  return (
    <Animated.View style={[{ transform: [{ scale: scaleValue }] }, containerStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={buttonStyle}
      >
        {/* Background fades in based on scrollY */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: defaultRadius, overflow: "hidden", opacity: bgOpacity },
          ]}
          pointerEvents="none"
        >
          {renderGlassBackground()}
        </Animated.View>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
});

export default LiquidButton;
