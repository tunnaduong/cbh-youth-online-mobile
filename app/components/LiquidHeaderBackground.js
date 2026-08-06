import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
  LiquidGlassView,
  LiquidGlassViewAndroid,
  isLiquidGlassSupportedAndroid,
  useIOSGlassSupport,
  BlurView,
  androidGlassTint,
} from "./GlassModules";

const LiquidHeaderBackground = ({ providerId }) => {
  const { isDarkMode } = useTheme();
  const iosGlass = useIOSGlassSupport();

  if (Platform.OS === 'ios') {
    if (iosGlass) {
      return (
        <LiquidGlassView
          style={StyleSheet.absoluteFill}
          effect="clear"
          tintColor={isDarkMode ? "#111111CC" : "#F8F8F8CC"}
        />
      );
    }
    if (BlurView) {
      // iOS < 26 has no real Liquid Glass, so the plain blur reads as too
      // transparent/washed out on its own - stack a theme tint on top to
      // match the tinted look Android and iOS 26+ glass already have.
      return (
        <View style={StyleSheet.absoluteFill}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType={isDarkMode ? "dark" : "light"}
            blurAmount={10}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDarkMode ? "rgba(17,17,17,0.55)" : "rgba(248,248,248,0.55)" },
            ]}
          />
        </View>
      );
    }
    return (
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.85)' : 'rgba(240,240,240,0.85)' }
        ]} 
      />
    );
  }

  // Android
  if (isLiquidGlassSupportedAndroid && LiquidGlassViewAndroid) {
    return (
      <LiquidGlassViewAndroid
        providerId={providerId || "default"}
        style={StyleSheet.absoluteFill}
        blurRadius={10}
        refractionAmount={20}
        refractionHeight={12}
        tint={androidGlassTint(isDarkMode)}
      />
    );
  }

  return (
    <View 
      style={[
        StyleSheet.absoluteFill, 
        { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.7)' : 'rgba(240,240,240,0.7)' }
      ]} 
    />
  );
};

export default LiquidHeaderBackground;
