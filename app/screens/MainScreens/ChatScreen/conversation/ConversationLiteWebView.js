import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import CustomLoading from "../../../../components/CustomLoading";
import ConversationHeader from "./ConversationHeader";
import { openInAppBrowser, parseUrlParts } from "../../../../utils/externalLink";
import {
  sessionEntryUrl,
  webViewBootScript,
  WEBVIEW_USER_AGENT_SUFFIX,
} from "../../../../utils/webSession";

export default function ConversationLiteWebView({
  conversationId,
  initialConversation,
  navigation,
  insets,
  onCall,
}) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const webViewRef = useRef(null);

  // Initial header states from props
  const otherParticipant =
    initialConversation?.type !== "group"
      ? initialConversation?.participants?.[0]
      : null;

  const [headerTitle, setHeaderTitle] = useState(
    initialConversation?.display_name ||
      initialConversation?.name ||
      otherParticipant?.profile_name ||
      otherParticipant?.username ||
      "Chat"
  );

  const [headerUsername, setHeaderUsername] = useState(
    otherParticipant?.username || null
  );

  const [headerAvatarUrl, setHeaderAvatarUrl] = useState(
    initialConversation?.display_avatar_url ||
      initialConversation?.avatar_url ||
      otherParticipant?.avatar_url ||
      null
  );

  const [headerTheme, setHeaderTheme] = useState(
    otherParticipant?.profile_theme || null
  );

  // Authenticated WebView start URL
  const [startUrl, setStartUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const targetUrl = `https://chuyenbienhoa.com/chat?chat_lite=true&conversationId=${conversationId}`;
    const parts = parseUrlParts(targetUrl);

    sessionEntryUrl(targetUrl, parts, "webview")
      .then((url) => {
        if (!cancelled) {
          setStartUrl(url);
        }
      })
      .catch((err) => {
        console.warn("[ConversationLiteWebView] sessionEntryUrl error:", err);
        if (!cancelled) {
          setStartUrl(targetUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Handle bidirectional bridge messages from the Webview
  const handleMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (!data || !data.type) return;

        switch (data.type) {
          case "CONVERSATION_UPDATE": {
            const conv = data.conversation;
            if (conv) {
              if (conv.display_name || conv.name) {
                setHeaderTitle(conv.display_name || conv.name);
              }
              if (conv.username) {
                setHeaderUsername(conv.username);
              }
              if (conv.display_avatar_url || conv.avatar_url) {
                setHeaderAvatarUrl(conv.display_avatar_url || conv.avatar_url);
              }
              if (conv.profile_theme) {
                setHeaderTheme(conv.profile_theme);
              }
            }
            break;
          }

          case "OPEN_PROFILE": {
            if (data.username) {
              navigation.push("ProfileDetailScreen", { username: data.username });
            }
            break;
          }

          case "OPEN_URL": {
            if (data.url) {
              openInAppBrowser(data.url);
            }
            break;
          }

          case "START_CALL": {
            if (onCall) {
              onCall();
            } else {
              Alert.alert(
                t("chatConversation.call", "Cuộc gọi"),
                t("chatConversation.callNotice", "Tính năng gọi điện đang được kết nối.")
              );
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.warn("[ConversationLiteWebView] onMessage error:", err);
      }
    },
    [navigation, onCall, t]
  );

  // Restrict WebView navigation: only allow remaining on /chat
  const handleShouldStartLoadWithRequest = useCallback(
    (request) => {
      const url = request.url;
      if (!url) return false;

      // Allow initial load and set-token handoff
      if (
        url.includes("/chat") ||
        url.includes("/auth/set-token") ||
        url.includes("about:blank")
      ) {
        return true;
      }

      // Check if clicking on user profile (e.g. https://chuyenbienhoa.com/@username)
      const profileMatch = url.match(/^https?:\/\/[^/]+\/@?([a-zA-Z0-9_.-]+)\/?$/);
      if (profileMatch && profileMatch[1]) {
        const username = profileMatch[1];
        if (!["forum", "explore", "wallet", "settings", "composer", "admin"].includes(username)) {
          navigation.push("ProfileDetailScreen", { username });
          return false;
        }
      }

      // Any other link -> open via native in-app browser
      openInAppBrowser(url);
      return false;
    },
    [navigation]
  );

  const handlePressTitle = useCallback(() => {
    if (headerUsername) {
      navigation.push("ProfileDetailScreen", { username: headerUsername });
    }
  }, [headerUsername, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Native Top Header Bar */}
      <ConversationHeader
        insetsTop={insets.top}
        title={headerTitle}
        username={headerUsername}
        avatarUrl={headerAvatarUrl}
        profileTheme={headerTheme}
        onBack={() => navigation.goBack()}
        onPressTitle={handlePressTitle}
        onCall={onCall}
        hasCustomBackground={false}
      />

      {/* Fullscreen Chat WebView */}
      <View style={styles.webWrapper}>
        {startUrl ? (
          <WebView
            ref={webViewRef}
            source={{ uri: startUrl }}
            style={styles.webView}
            injectedJavaScriptBeforeContentLoaded={webViewBootScript({ theme })}
            applicationNameForUserAgent={WEBVIEW_USER_AGENT_SUFFIX}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <CustomLoading size="medium" />
              </View>
            )}
            allowsBackForwardNavigationGestures={false}
            bounces={false}
            overScrollMode="never"
          />
        ) : (
          <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
            <CustomLoading size="medium" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webWrapper: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
