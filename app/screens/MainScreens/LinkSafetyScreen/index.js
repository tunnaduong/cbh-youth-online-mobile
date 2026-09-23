import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StatusBar,
  Animated,
  Share,
  Clipboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { decodeLinkToken, parseUrlParts } from "../../../utils/externalLink";

/**
 * Warning screen shown before the app hands a link from user content (post
 * bodies, comments, chat) to the system browser. The destination arrives as a
 * base64url token in route.params (see utils/externalLink) and is decoded here
 * so the user can read the real address - hostname first, since that's the only
 * part that decides whether a link is trustworthy - before choosing to go on.
 */
const LinkSafetyScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;

  // `url` is accepted as a fallback so a caller that already has a plain URL
  // (e.g. a deep link) doesn't have to encode it first.
  const url = useMemo(
    () => decodeLinkToken(route?.params?.token) || route?.params?.url || null,
    [route?.params?.token, route?.params?.url]
  );
  const parts = useMemo(() => (url ? parseUrlParts(url) : null), [url]);

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle(isDarkMode ? "light-content" : "dark-content", true);
      if (StatusBar.setBackgroundColor) {
        StatusBar.setBackgroundColor(theme.background, true);
      }
    }, [isDarkMode, theme.background])
  );

  const isInsecure = parts?.scheme === "http";
  // "xn--" means the hostname holds non-ASCII characters, which is how
  // look-alike domains are built (a Cyrillic "а" standing in for "a").
  const isPunycode = Boolean(parts?.hostname?.includes("xn--"));
  // "https://google.com@evil.example/" reads as Google but goes to evil.example.
  const hasUserInfo = Boolean(parts?.userInfo);

  const handleContinue = useCallback(() => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Toast.show({
        type: "error",
        text1: t("linkSafety.openFailed"),
        autoHide: true,
      });
    });
    // Leave the warning behind so coming back from the browser lands on the
    // post the link came from, not on this screen again.
    navigation.goBack();
  }, [url, navigation, t]);

  const handleCopy = useCallback(() => {
    if (!url) return;
    Clipboard.setString(url);
    Toast.show({ type: "success", text1: t("linkSafety.copied"), autoHide: true });
  }, [url, t]);

  const handleShare = useCallback(() => {
    if (!url) return;
    Share.share({ message: url }).catch(() => {});
  }, [url]);

  const headerHeight = 58 + insets.top;

  const Header = (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}
    >
      <View
        style={{
          paddingTop: insets.top,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          height: headerHeight,
        }}
      >
        <LiquidButton
          providerId="LinkSafetyScreen"
          size={44}
          scrollY={scrollY}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
      </View>
    </View>
  );

  if (!url || !parts) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {Header}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDarkMode ? "#4c1d1d" : "#FEE2E2",
            }}
          >
            <Ionicons name="alert-circle" size={34} color="#DC2626" />
          </View>
          <Text
            style={{
              color: theme.text,
              fontSize: 18,
              fontWeight: "700",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {t("linkSafety.invalidTitle")}
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {t("linkSafety.invalidDescription")}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 24,
              backgroundColor: theme.primary,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              {t("linkSafety.goBack")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pathAndQuery = `${parts.path}${parts.query}${parts.hash}`;

  const warnings = [
    hasUserInfo && {
      key: "userInfo",
      tone: "danger",
      text: t("linkSafety.warningUserInfo", { hostname: parts.hostname }),
    },
    isPunycode && {
      key: "punycode",
      tone: "danger",
      text: t("linkSafety.warningPunycode"),
    },
    isInsecure && {
      key: "insecure",
      tone: "warning",
      text: t("linkSafety.warningInsecure"),
    },
  ].filter(Boolean);

  const tips = [
    t("linkSafety.tipDomain"),
    t("linkSafety.tipPassword"),
    t("linkSafety.tipSensitive"),
    t("linkSafety.tipUnknownSender"),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {Header}
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDarkMode ? "#4a3a12" : "#FEF3C7",
            }}
          >
            <Ionicons name="shield-half" size={32} color="#D97706" />
          </View>
          <Text
            style={{
              color: theme.text,
              fontSize: 19,
              fontWeight: "700",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {t("linkSafety.title")}
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {t("linkSafety.subtitle")}
          </Text>
        </View>

        <View
          style={{
            marginTop: 20,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.sectionBackground,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: theme.subText,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {t("linkSafety.visitingLabel")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 8 }}>
            <Ionicons
              name="globe-outline"
              size={17}
              color={theme.subText}
              style={{ marginTop: 2, marginRight: 7 }}
            />
            <Text
              style={{
                color: theme.text,
                fontSize: 16,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {parts.hostname}
            </Text>
          </View>
          <Text
            selectable
            style={{
              color: theme.subText,
              fontSize: 12,
              lineHeight: 18,
              marginTop: 8,
            }}
          >
            <Text style={{ color: isInsecure ? "#DC2626" : theme.subText }}>
              {`${parts.scheme}://`}
            </Text>
            <Text style={{ color: theme.text, fontWeight: "600" }}>
              {parts.hostPort}
            </Text>
            {pathAndQuery === "/" ? "" : pathAndQuery}
          </Text>

          <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              onPress={handleCopy}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 7,
                paddingHorizontal: 11,
                borderRadius: 8,
                backgroundColor: theme.iconBackground,
              }}
            >
              <Ionicons name="copy-outline" size={14} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                {t("linkSafety.copyLink")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 7,
                paddingHorizontal: 11,
                borderRadius: 8,
                backgroundColor: theme.iconBackground,
              }}
            >
              <Ionicons name="share-outline" size={14} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
                {t("linkSafety.shareLink")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {warnings.map((warning) => (
          <View
            key={warning.key}
            style={{
              flexDirection: "row",
              marginTop: 10,
              borderRadius: 10,
              borderWidth: 1,
              padding: 11,
              borderColor:
                warning.tone === "danger"
                  ? isDarkMode
                    ? "#7f1d1d"
                    : "#FECACA"
                  : isDarkMode
                    ? "#78350f"
                    : "#FDE68A",
              backgroundColor:
                warning.tone === "danger"
                  ? isDarkMode
                    ? "#2b1414"
                    : "#FEF2F2"
                  : isDarkMode
                    ? "#2a2011"
                    : "#FFFBEB",
            }}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color={warning.tone === "danger" ? "#DC2626" : "#D97706"}
              style={{ marginTop: 1, marginRight: 8 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12.5,
                lineHeight: 19,
                color:
                  warning.tone === "danger"
                    ? isDarkMode
                      ? "#fca5a5"
                      : "#B91C1C"
                    : isDarkMode
                      ? "#fcd34d"
                      : "#B45309",
              }}
            >
              {warning.text}
            </Text>
          </View>
        ))}

        <Text
          style={{
            color: theme.text,
            fontSize: 14,
            fontWeight: "700",
            marginTop: 20,
          }}
        >
          {t("linkSafety.checklistTitle")}
        </Text>
        {tips.map((tip) => (
          <View key={tip} style={{ flexDirection: "row", marginTop: 8 }}>
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={theme.primary}
              style={{ marginTop: 2, marginRight: 8 }}
            />
            <Text
              style={{ flex: 1, color: theme.subText, fontSize: 13.5, lineHeight: 20 }}
            >
              {tip}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          onPress={handleContinue}
          style={{
            marginTop: 24,
            backgroundColor: theme.primary,
            borderRadius: 12,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            {t("linkSafety.continue")}
          </Text>
          <Ionicons name="open-outline" size={17} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
            {t("linkSafety.goBack")}
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: theme.subText,
            fontSize: 11.5,
            lineHeight: 18,
            textAlign: "center",
            marginTop: 16,
          }}
        >
          {t("linkSafety.reportHint")}
        </Text>
      </ScrollView>
    </View>
  );
};

export default LinkSafetyScreen;
