import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import LiquidButton from "./LiquidButton";

export default function ReportHeader({ navigation, title, rightButton }) {
  const { theme, isDarkMode } = useTheme();
  const green = isDarkMode ? "#4ADE80" : "#15803D";

  // Same look as the app's other headers: tinted round back button, big green
  // title with the sparkle.
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: theme.background,
      }}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)",
        }}
      >
        <Ionicons name="chevron-back" size={22} color={green} />
      </TouchableOpacity>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, marginRight: 8, minWidth: 0 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.3, color: green, flexShrink: 1 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ fontSize: 16, color: "#EAB308", marginLeft: 4, marginTop: -8 }}>✦</Text>
      </View>
      {rightButton && (
        <LiquidButton
          size={44}
          style={{ width: "auto", paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: theme.primary, backgroundColor: "transparent" }}
          borderRadius={22}
          onPress={rightButton.onPress}
        >
          <Text
            style={{
              color: theme.text,
              lineHeight: 20,
              fontSize: 15,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {rightButton.text}
          </Text>
        </LiquidButton>
      )}
    </View>
  );
}
