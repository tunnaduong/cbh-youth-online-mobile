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
export default function WebViewHeader({ title, onBack, onClose, right }) {
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
      {/* Both sides share one width so the title stays centred. */}
      <View style={[styles.side, onClose && styles.sideWide]}>
        <TouchableOpacity onPress={onBack} style={styles.button} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.primary} />
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.button} hitSlop={8}>
            <Ionicons name="close" size={26} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.title, { color: theme.primary }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right, onClose && styles.sideWide]}>{right}</View>
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
  side: { width: 44, height: 44, flexDirection: "row", alignItems: "center" },
  sideWide: { width: 88 },
  right: { justifyContent: "flex-end" },
  button: { width: 44, height: 44, justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
});
