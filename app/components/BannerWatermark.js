import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

// Faint illustration behind a banner's content, shaped like what the banner is
// about (a school, a wallet, a calendar...) with a couple of sparkle doodles -
// the look of the Explore cards. Put it as the first child of a banner that has
// `overflow: "hidden"`; `color` defaults to the brand green.
export default function BannerWatermark({ icon, color = "#22C55E", size = 120, left = false, style }) {
  const { isDarkMode } = useTheme();
  const side = left ? { left: -size * 0.12 } : { right: -size * 0.12 };
  const faint = color === "#FFFFFF" ? 0.14 : isDarkMode ? 0.1 : 0.13;
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: -size * 0.14, width: size, height: size, ...side }, style]}>
      <Ionicons
        name={icon}
        size={size}
        color={color}
        style={{ opacity: faint, transform: [{ rotate: left ? "12deg" : "-12deg" }] }}
      />
      <Text style={{ position: "absolute", top: size * 0.12, left: -size * 0.08, fontSize: 14, color, opacity: faint * 3 }}>✦</Text>
      <Ionicons name="sparkles" size={14} color={color} style={{ position: "absolute", bottom: size * 0.12, left: size * 0.02, opacity: faint * 3 }} />
    </View>
  );
}
