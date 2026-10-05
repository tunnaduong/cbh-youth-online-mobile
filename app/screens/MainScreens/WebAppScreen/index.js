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
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import WebViewHeader from "../../../components/WebViewHeader";
import CustomLoading from "../../../components/CustomLoading";
import { openInAppBrowser, parseUrlParts } from "../../../utils/externalLink";
import {
  sessionEntryUrl,
  isWebLoginUrl,
  WEB_LOGIN_PAGE_MESSAGE,
  webViewBootScript,
  WEBVIEW_USER_AGENT_SUFFIX,
} from "../../../utils/webSession";

// One screen hosting a CBH web app in a WebView, signed in as the app's
// current account through a session of its own (see sessionEntryUrl) and
// following its theme (see webViewBootScript). Registered once per site in
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

  // Where the WebView starts: homeUrl, or the site's /auth/set-token first
  // when this WebView isn't signed in as the current account yet. Null while
  // that's being worked out.
  const [startUrl, setStartUrl] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumping this remounts the WebView back at homeUrl.
  const [reloadKey, setReloadKey] = useState(0);

  // A page to open instead of the home page (`route.params.url`, e.g. from a
  // notification) - only when it is on this site. Used until the user asks
  // for the home page; a new url in the params is a new request.
  const requestedUrl = route.params?.url;
  const [useRequestedUrl, setUseRequestedUrl] = useState(true);
  const firstRequestedUrl = useRef(true);
  useEffect(() => {
    // Not on mount: the screen is already loading this url, and a remount
    // here asked the API for a second handoff code for nothing.
    if (firstRequestedUrl.current) {
      firstRequestedUrl.current = false;
      return;
    }
    setUseRequestedUrl(true);
    setReloadKey((key) => key + 1);
  }, [requestedUrl]);
  const entryUrl = (() => {
    if (!useRequestedUrl || typeof requestedUrl !== "string") return site.homeUrl;
    const host = requestedUrl.match(/^https:\/\/([^/?#]+)/i)?.[1]?.toLowerCase();
    if (!host || !site.hosts.includes(host)) return site.homeUrl;
    // Same app mode as the home page.
    return /[?&]app=true/.test(requestedUrl)
      ? requestedUrl
      : requestedUrl + (requestedUrl.includes("?") ? "&" : "?") + "app=true";
  })();

  // The page showed a login form although the app is signed in: the handoff
  // did not take (seen on the first visit right after logging in - the code
  // came too late, so the page was opened signed out). Hand off again and
  // start over, once per visit so a page that really needs a login can show
  // its form.
  const forceHandoff = useRef(false);
  const retriedHandoff = useRef(false);
  const retryHandoff = useCallback(() => {
    if (retriedHandoff.current) return false;
    retriedHandoff.current = true;
    forceHandoff.current = true;
    setBlockedUrl(null);
    setLoadFailed(false);
    setCanGoBack(false);
    setReloadKey((key) => key + 1);
    return true;
  }, []);

  // Worked out again on every remount (home button, theme change); once the
  // WebView is signed in it's just homeUrl.
  useEffect(() => {
    let cancelled = false;
    const force = forceHandoff.current;
    forceHandoff.current = false;
    setStartUrl(null);
    sessionEntryUrl(entryUrl, parseUrlParts(entryUrl), "webview", { force }).then((url) => {
      if (!cancelled) setStartUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [entryUrl, reloadKey, isDarkMode]);

  const goHome = useCallback(() => {
    setUseRequestedUrl(false);
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
      // Sent to a login page (the gift shop sends signed-out visitors to the
      // main site's): sign the WebView in instead.
      if (isWebLoginUrl(parts) && retryHandoff()) return false;

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
    [site, theme, retryHandoff]
  );

  const renderLoading = () => (
    <View style={[styles.overlay, { backgroundColor: theme.background }]}>
      <CustomLoading size={56} />
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
        {startUrl ? (
          <WebView
            // Keyed on the theme as well, so a change of appearance gets a
            // fresh page that matches it.
            key={`${reloadKey}-${isDarkMode}`}
            ref={webViewRef}
            source={{ uri: startUrl }}
            applicationNameForUserAgent={WEBVIEW_USER_AGENT_SUFFIX}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            incognito={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={webViewBootScript({
              theme: isDarkMode ? "dark" : "light",
            })}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            // Android: target="_blank" / window.open load here instead of a
            // new window, so they go through the check above too.
            setSupportMultipleWindows={false}
            onNavigationStateChange={(state) => {
              if (isWebLoginUrl(parseUrlParts(state.url)) && retryHandoff()) return;
              setCanGoBack(state.canGoBack);
            }}
            onMessage={(event) => {
              if (event.nativeEvent?.data === WEB_LOGIN_PAGE_MESSAGE) retryHandoff();
            }}
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
