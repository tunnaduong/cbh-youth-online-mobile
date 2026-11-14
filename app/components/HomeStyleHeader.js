import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

// The top header of the Home feed, for the story screens: round green-tinted
// back button, big green title with the yellow sparkle and a grey subtitle. It
// sits at the top of the page content and scrolls away with it, exactly like
// Home's. Add `insets.top` padding around it.
export default function HomeStyleHeader({ title, subtitle, onBack, right, icon = "chevron-back", dark, disabled, compact }) {
  const { isDarkMode: themeDark } = useTheme();
  // `dark`: over a black screen (the story editor) - always the dark palette.
  const isDarkMode = dark ? true : themeDark;
  const { t } = useTranslation();
  const green = isDarkMode ? "#4ADE80" : "#15803D";
  return (
    <View style={[styles.row, compact && { paddingBottom: 0 }]}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" },
        ]}
        activeOpacity={0.7}
        onPress={onBack}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t("common.back", "Quay lại")}
      >
        <Ionicons name={icon} size={icon === "close" ? 24 : 22} color={green} />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.title, { color: green }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.sparkle}>✦</Text>
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: isDarkMode ? "#9CA3AF" : "#6B7280" }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14 },
  button: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
  sparkle: { fontSize: 16, color: "#EAB308", marginLeft: 4, marginTop: -8 },
  subtitle: { fontSize: 12.5, fontWeight: "500", marginTop: 1 },
});
