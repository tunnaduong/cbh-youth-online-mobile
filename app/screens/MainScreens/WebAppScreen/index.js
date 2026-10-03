import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import WebViewHeader from "../../../components/WebViewHeader";
import { openInAppBrowser, parseUrlParts } from "../../../utils/externalLink";
import { webViewBootScript } from "../../../utils/webSession";

// One screen hosting a CBH web app in a WebView, signed in as the app's
// current account and following its theme (see webViewBootScript). Registered once per site in
// App.js with `initialParams={{ site }}`.
//
// `lockToSite`: the gift shop must never leave its own domain - a navigation
// anywhere else is cancelled and replaced by a page leading back to the shop's
// home. Admin is looser: other sites just open in the in-app browser.
const SITES = {
  giftshop: {
    titleKey: "sidebar.giftShop",
    // ?app=true puts the shop in app mode: it hides sign-out and the links
    // that would lead off to other sites.
    homeUrl: "https://giftshop.chuyenbienhoa.com/?app=true",
    hosts: ["giftshop.chuyenbienhoa.com"],
    lockToSite: true,
  },
  admin: {
    titleKey: "sidebar.admin",
    homeUrl: "https://www.chuyenbienhoa.com/admin?app=true",
    hosts: ["chuyenbienhoa.com", "www.chuyenbienhoa.com"],
    lockToSite: false,
  },
};

export default function WebAppScreen({ navigation, route }) {
  const site = SITES[route.params?.site] || SITES.giftshop;
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", theme.background);
  const { t } = useTranslation();
  const webViewRef = useRef(null);

  const [token, setToken] = useState(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumping this remounts the WebView back at homeUrl.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem("auth_token")
      .then(setToken)
      .catch(() => {})
      .finally(() => setTokenReady(true));
  }, []);

  const goHome = useCallback(() => {
    setBlockedUrl(null);
    setLoadFailed(false);
    setCanGoBack(false);
    setReloadKey((key) => key + 1);
  }, []);

  const handleBack = useCallback(() => {
    if (blockedUrl) {
      // The blocked navigation never happened, so the page underneath is
      // still the last one on the site.
      setBlockedUrl(null);
      return true;
    }
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, [blockedUrl, canGoBack]);

  // Android's back button walks back through the site before leaving it.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
      return () => sub.remove();
    }, [handleBack])
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request) => {
      // iOS asks about iframes too (embeds, payment widgets) - only the page
      // itself is kept on the site.
      if (request.isTopFrame === false) return true;
      const url = request.url || "";
      if (url.startsWith("about:")) return true;

      const parts = parseUrlParts(url);
      const onSite =
        parts && parts.scheme === "https" && site.hosts.includes(parts.hostname);
      if (onSite) return true;

      if (site.lockToSite) {
        setBlockedUrl(url);
      } else {
        openInAppBrowser(url, theme);
      }
      return false;
    },
    [site, theme]
  );

  const renderLoading = () => (
    <View style={[styles.overlay, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WebViewHeader
        title={t(site.titleKey)}
        onBack={() => {
          if (!handleBack()) navigation.goBack();
        }}
        onClose={() => navigation.goBack()}
        right={
          <TouchableOpacity
            hitSlop={8}
            onPress={() => {
              if (blockedUrl || loadFailed) goHome();
              else webViewRef.current?.reload();
            }}
          >
            <Ionicons name="refresh" size={22} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.body}>
        {tokenReady ? (
          <WebView
            // Keyed on the token and theme as well, so a different account
            // or appearance always gets a fresh page that matches it.
            key={`${reloadKey}-${token || ""}-${isDarkMode}`}
            ref={webViewRef}
            source={{ uri: site.homeUrl }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={webViewBootScript({
              token,
              theme: isDarkMode ? "dark" : "light",
            })}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            // Android: target="_blank" / window.open load here instead of a
            // new window, so they go through the check above too.
            setSupportMultipleWindows={false}
            onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
            onError={() => setLoadFailed(true)}
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            allowsInlineMediaPlayback
            startInLoadingState
            renderLoading={renderLoading}
          />
        ) : (
          renderLoading()
        )}

        {blockedUrl ? (
          <View style={[styles.overlay, styles.message, { backgroundColor: theme.background }]}>
            <Ionicons name="lock-closed-outline" size={56} color={theme.primary} />
            <Text style={[styles.messageTitle, { color: theme.text }]}>
              {t("webApp.leftSiteTitle")}
            </Text>
            <Text style={[styles.messageBody, { color: theme.subText }]}>
              {t("webApp.leftSiteMessage")}
            </Text>
            <Text style={[styles.messageUrl, { color: theme.subText }]} numberOfLines={2}>
              {blockedUrl}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={goHome}
            >
              <Text style={styles.buttonText}>{t("webApp.backToShopHome")}</Text>
            </TouchableOpacity>
          </View>
        ) : loadFailed ? (
          <View style={[styles.overlay, styles.message, { backgroundColor: theme.background }]}>
            <Ionicons name="cloud-offline-outline" size={56} color={theme.subText} />
            <Text style={[styles.messageTitle, { color: theme.text }]}>
              {t("webApp.loadErrorTitle")}
            </Text>
            <Text style={[styles.messageBody, { color: theme.subText }]}>
              {t("webApp.loadErrorMessage")}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={goHome}
            >
              <Text style={styles.buttonText}>{t("webApp.retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  message: { paddingHorizontal: 32, gap: 12 },
  messageTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  messageBody: { fontSize: 15, textAlign: "center", lineHeight: 21 },
  messageUrl: { fontSize: 13, textAlign: "center" },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
