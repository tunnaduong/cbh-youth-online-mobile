import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

// Plain, always-visible header for screens that host a web page. The newer
// floating glass buttons + fading title key off a native ScrollView's
// position, which a WebView doesn't report - and web pages bring their own
// sticky headers that would slide under a floating bar - so these screens
// keep a solid bar the page sits below.
//
// `onBack` is the page-level back (walks back through the site where the
// screen supports it); `onClose`, when given, adds an X next to it that
// leaves the screen straight away, however deep into the site you are.
// Round green-tinted icon button for the header's right side (reload,
// fullscreen...), the same as the back button.
export function WebHeaderButton({ icon, onPress, label, disabled }) {
  const { isDarkMode } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" },
      ]}
    >
      <Ionicons name={icon} size={20} color={isDarkMode ? "#4ADE80" : "#15803D"} />
    </TouchableOpacity>
  );
}

export default function WebViewHeader({ title, onBack, onClose, right }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const green = isDarkMode ? "#4ADE80" : "#15803D";

  // Same look as the app's other headers (tinted round buttons, green title
  // with the sparkle) on a solid bar that never floats or fades. Layout:
  // [back] [title ........] [actions] [close] - the close button sits with the
  // other actions so the title keeps the room.
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: 60 + insets.top,
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        style={[
          styles.button,
          { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" },
        ]}
        hitSlop={6}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={22} color={green} />
      </TouchableOpacity>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: green }]} numberOfLines={1}>
          {title}
        </Text>
        {title ? <Text style={styles.sparkle}>✦</Text> : null}
      </View>
      <View style={styles.right}>
        {right}
        {onClose ? <WebHeaderButton icon="close" onPress={onClose} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  button: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, marginRight: 8, minWidth: 0 },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
  sparkle: { fontSize: 14, color: "#EAB308", marginLeft: 4, marginTop: -6 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
