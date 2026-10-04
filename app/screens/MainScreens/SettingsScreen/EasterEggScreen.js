import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import WebViewHeader from "../../../components/WebViewHeader";

export default function EasterEggScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", theme.background);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WebViewHeader onBack={() => navigation.goBack()} />
      <WebView
        source={{ uri: "https://chuyenbienhoa.com/egg" }}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}
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
