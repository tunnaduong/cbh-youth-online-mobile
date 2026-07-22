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
  scrollY,
  alwaysBorder = false,
  backgroundColor,
}) => {
  const { theme, isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;

  const visibleBorderColor = isDarkMode
    ? "rgba(255,255,255,0.28)"
    : "rgba(17,24,39,0.22)";
  const transparentBorderColor = "transparent";

  // When scrollY is provided, background fades in as user scrolls (0→40px).
  // At the top the button appears label-only (no visible pill/circle).
  const bgOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;

  const borderColor = alwaysBorder
    ? visibleBorderColor
    : scrollY
      ? scrollY.interpolate({
          inputRange: [0, 40],
          outputRange: [transparentBorderColor, visibleBorderColor],
          extrapolate: "clamp",
        })
      : transparentBorderColor;
  const staticBorderColor = alwaysBorder ? visibleBorderColor : transparentBorderColor;

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
                borderWidth: 1,
                borderColor: staticBorderColor,
              },
            ]}
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
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: defaultRadius,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: staticBorderColor,
              },
            ]}
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
            backgroundColor: backgroundColor ?? (isDarkMode ? "rgba(18, 18, 18, 0.85)" : "rgba(255, 255, 255, 0.75)"),
            borderRadius: defaultRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: staticBorderColor,
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
      borderWidth: 1,
      borderColor: alwaysBorder ? visibleBorderColor : transparentBorderColor,
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
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: defaultRadius,
                borderWidth: 1,
                borderColor,
              },
            ]}
          />
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
