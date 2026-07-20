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
}) => {
  const { theme, isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;

  const renderGlassBackground = () => {
    if (Platform.OS === "ios") {
      if (useIOSGlass) {
        return (
          <LiquidGlassView
            style={[StyleSheet.absoluteFill, { borderRadius: defaultRadius, overflow: "hidden" }]}
            glassType="clear"
            glassTintColor={isDarkMode ? "#111111CC" : "#F8F8F8CC"}
            glassOpacity={1}
            isInteractive={false}
          />
        );
      }
      if (BlurView) {
        return (
          <BlurView
            style={[StyleSheet.absoluteFill, { borderRadius: defaultRadius, overflow: "hidden" }]}
            blurType={isDarkMode ? "dark" : "light"}
            blurAmount={10}
          />
        );
      }
    }

    // Android & fallbacks: OneUI-style tinted transparent button background
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
            borderRadius: defaultRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)",
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

  return (
    <Animated.View style={[{ transform: [{ scale: scaleValue }] }, containerStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: defaultRadius,
          },
          style,
        ]}
      >
        {renderGlassBackground()}
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
