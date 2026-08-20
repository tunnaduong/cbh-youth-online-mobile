import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { LiquidGlassView, glassTint } from "./GlassModules";

const LiquidHeaderBackground = () => {
  const { isDarkMode } = useTheme();

  if (LiquidGlassView) {
    return (
      <LiquidGlassView variant="clear" tintColor={glassTint(isDarkMode)} style={StyleSheet.absoluteFill} />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: isDarkMode ? "rgba(30,30,30,0.85)" : "rgba(240,240,240,0.85)" },
      ]}
    />
  );
};

export default LiquidHeaderBackground;
