import React from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { LiquidGlassView } from "./GlassModules";

const LiquidButton = ({
  onPress,
  children,
  style,
  size = 44,
  borderRadius,
  disabled = false,
  containerStyle,
  scrollY,
  backgroundColor,
}) => {
  const { isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;

  // When scrollY is provided, background fades in as user scrolls (0→40px).
  const bgOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;

  // react-native-liquid-glassmorphism handles iOS/Android and every OS-version
  // tier internally (real glass, blur fallback, or plain tint - whichever the
  // device supports), so there's no more platform branching here at all.
  const renderGlassBackground = () => {
    if (LiquidGlassView) {
      return (
        <LiquidGlassView
          variant="clear"
          tintColor={backgroundColor}
          borderRadius={defaultRadius}
          style={StyleSheet.absoluteFill}
        />
      );
    }

    // Library failed to load: OneUI-style tinted transparent fallback.
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
      borderWidth: 0,
      borderColor: "transparent",
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
