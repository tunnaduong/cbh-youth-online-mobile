import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, BackHandler } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import WebViewHeader from "../../../../components/WebViewHeader";
import CustomLoading from "../../../../components/CustomLoading";
import { parseUrlParts } from "../../../../utils/externalLink";
import {
  sessionEntryUrl,
  appHasAccount,
  WEB_LOGIN_PAGE_MESSAGE,
  WEB_SIGNED_OUT_MESSAGE,
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

  // The page loaded signed out although the app is signed in: the handoff
  // did not take (typically right after logging in, when its code came too
  // late). Hand off again and load the page afresh, once per visit.
  const [reloadKey, setReloadKey] = useState(0);
  const forceHandoff = useRef(false);
  const retriedHandoff = useRef(false);
  const retryHandoff = useCallback(() => {
    if (retriedHandoff.current) return;
    retriedHandoff.current = true;
    forceHandoff.current = true;
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const force = forceHandoff.current;
    forceHandoff.current = false;
    setStartUrl(null);
    sessionEntryUrl(gameUrl, parseUrlParts(gameUrl), "webview", { force }).then((url) => {
      if (!cancelled) setStartUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [gameUrl, reloadKey]);

  // Same header as the gift shop / admin screens (WebAppScreen): back walks
  // back through the page first, X leaves, and there is a reload button.
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const handleBack = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  // Android's back button does the same before leaving the screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
      return () => sub.remove();
    }, [handleBack])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WebViewHeader
        title={name || t("games.title")}
        onBack={() => {
          if (!handleBack()) navigation.goBack();
        }}
        onClose={() => navigation.goBack()}
        right={
          <TouchableOpacity hitSlop={8} onPress={() => webViewRef.current?.reload()}>
            <Ionicons name="refresh" size={22} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      {startUrl ? (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: startUrl }}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
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
          onMessage={(event) => {
            const data = event.nativeEvent?.data;
            if (data !== WEB_LOGIN_PAGE_MESSAGE && data !== WEB_SIGNED_OUT_MESSAGE) return;
            // A guest plays signed out; only a signed-in app retries.
            appHasAccount().then((signedIn) => signedIn && retryHandoff());
          }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: theme.background }]}>
              <CustomLoading size={56} />
            </View>
          )}
        />
      ) : (
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <CustomLoading size={56} />
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
