import React, { useEffect, useState } from "react";
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
  roundedOnScroll = false,
}) => {
  const { theme, isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!scrollY) return undefined;

    const listenerId = scrollY.addListener(({ value }) => {
      setIsScrolled(value >= 24);
    });

    return () => scrollY.removeListener(listenerId);
  }, [scrollY]);

  const bgOpacity = scrollY
    ? isScrolled
      ? 1
      : 0
    : 1;
  const effectiveRadius = roundedOnScroll ? (isScrolled ? defaultRadius : 0) : defaultRadius;

  const renderGlassBackground = () => {
    if (Platform.OS === "ios") {
      if (useIOSGlass) {
        return (
          <LiquidGlassView
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: effectiveRadius,
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
                borderRadius: effectiveRadius,
                overflow: "hidden",
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
            borderRadius: effectiveRadius,
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
      borderRadius: effectiveRadius,
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
            { borderRadius: effectiveRadius, overflow: "hidden", opacity: bgOpacity },
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
