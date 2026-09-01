import React, { useEffect, useState } from "react";
import { View, StyleSheet, StatusBar, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../../contexts/ThemeContext";
import LiquidButton from "../../../../components/LiquidButton";

// The game itself (embed, play session tracking, XP) is entirely the web
// page's job - this screen just hosts it in a WebView with a floating back
// button matching EasterEggScreen's pattern. ?app=true tells the web page to
// hide its own back button so there's only ever one.
export default function GamePlayScreen({ navigation, route }) {
  const { slug } = route.params || {};
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();

  // The website reads its auth token from a cookie (auth_token, see
  // utils/cookies.js on web), completely separate from the app's own
  // AsyncStorage-based auth. Without this, the WebView always loads the
  // game page as a guest, so session tracking (startSession/heartbeat -
  // what populates "Đang chơi"/leaderboard) silently never fires for
  // anyone playing through the app. Read the app's token once up front and
  // set the matching cookie before the page's own scripts run.
  const [tokenReady, setTokenReady] = useState(false);
  const [authScript, setAuthScript] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("auth_token")
      .then((token) => {
        setAuthScript(
          token
            ? `document.cookie = "auth_token=${token}; path=/"; true;`
            : "true;"
        );
      })
      .catch(() => setAuthScript("true;"))
      .finally(() => setTokenReady(true));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
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
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: insets.top + 8, left: 16, zIndex: 10 }}
      >
        <LiquidButton size={44} providerId="GamePlayScreen" onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
      </View>

      {tokenReady ? (
        <WebView
          source={{ uri: `https://www.chuyenbienhoa.com/explore/games/${slug}?app=true` }}
          style={styles.webview}
          containerStyle={styles.webviewContainer}
          javaScriptEnabled
          domStorageEnabled
          // Not incognito, plus these two on - cookies (game state, session,
          // web login if the user signs in inside the WebView) persist across
          // app launches instead of resetting every time.
          incognito={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          // Signs the WebView into the same account as the app before the
          // page's own scripts run, so session tracking works from the app.
          injectedJavaScriptBeforeContentLoaded={authScript}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: theme.background }]}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
        />
      ) : (
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  webviewContainer: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
