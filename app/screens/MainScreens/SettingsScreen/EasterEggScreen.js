import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";

export default function EasterEggScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();

  useFocusEffect(
    React.useCallback(() => {
      // Transparent status bar so the egg's WebView content renders edge-to-edge
      // underneath it instead of behind an opaque theme-coloured strip.
      StatusBar.setBarStyle("light-content", true);
      if (StatusBar.setTranslucent) StatusBar.setTranslucent(true);
      if (StatusBar.setBackgroundColor) StatusBar.setBackgroundColor("transparent", true);

      return () => {
        StatusBar.setBarStyle(isDarkMode ? "light-content" : "dark-content", true);
        if (StatusBar.setTranslucent) StatusBar.setTranslucent(false);
        if (StatusBar.setBackgroundColor) StatusBar.setBackgroundColor(theme.background, true);
      };
    }, [isDarkMode, theme.background])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating back button */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
        }}
      >
        <LiquidButton size={44} providerId="EasterEggScreen" onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
      </View>

      <WebView
        source={{ uri: "https://chuyenbienhoa.com/egg" }}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
  },
});
