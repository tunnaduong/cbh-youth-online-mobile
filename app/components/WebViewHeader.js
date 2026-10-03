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
export default function WebViewHeader({ title, onBack, right }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          height: 56 + insets.top,
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <TouchableOpacity onPress={onBack} style={styles.side} hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={theme.primary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: theme.primary }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { width: 44, height: 44, justifyContent: "center" },
  right: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
});
