import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import WebViewHeader from "../../../../components/WebViewHeader";
import { parseUrlParts } from "../../../../utils/externalLink";
import {
  sessionEntryUrl,
  webViewBootScript,
  WEBVIEW_USER_AGENT_SUFFIX,
} from "../../../../utils/webSession";

// The game itself (embed, play session tracking, XP) is entirely the web
// page's job - this screen just hosts it in a WebView under a plain header
// (see WebViewHeader). ?app=true tells the web page to hide its own back
// button so there's only ever one.
export default function GamePlayScreen({ navigation, route }) {
  const { slug, name } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", theme.background);

  // Session tracking (startSession/heartbeat - what fills "Đang chơi" and
  // the leaderboard) only runs for a signed-in player, so the page opens
  // through the site's login handoff when this WebView isn't signed in as
  // the current account yet (see sessionEntryUrl). It used to set the app's
  // own token as a cookie, which made the app's entry in the logged-in
  // devices list show up as "web" whenever a game was played.
  const gameUrl = `https://www.chuyenbienhoa.com/explore/games/${slug}?app=true`;
  const [startUrl, setStartUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    sessionEntryUrl(gameUrl, parseUrlParts(gameUrl), "webview").then((url) => {
      if (!cancelled) setStartUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [gameUrl]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WebViewHeader title={name || t("games.title")} onBack={() => navigation.goBack()} />

      {startUrl ? (
        <WebView
          source={{ uri: startUrl }}
          applicationNameForUserAgent={WEBVIEW_USER_AGENT_SUFFIX}
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
          injectedJavaScriptBeforeContentLoaded={webViewBootScript({
            theme: isDarkMode ? "dark" : "light",
          })}
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
