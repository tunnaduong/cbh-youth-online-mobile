import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
  LiquidGlassView,
  LiquidGlassViewAndroid,
  isLiquidGlassSupportedAndroid,
  useIOSGlass,
  BlurView,
} from "./GlassModules";

const LiquidHeaderBackground = ({ providerId }) => {
  const { isDarkMode } = useTheme();

  if (Platform.OS === 'ios') {
    if (useIOSGlass) {
      return (
        <LiquidGlassView
          style={StyleSheet.absoluteFill}
          effect="clear"
          tintColor={isDarkMode ? "#111111CC" : "#F8F8F8CC"}
        />
      );
    }
    if (BlurView) {
      return (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={isDarkMode ? "dark" : "light"}
          blurAmount={10}
        />
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
        tint={isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(240,240,240,0.3)"}
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
