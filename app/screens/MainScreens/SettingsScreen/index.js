import {
  bubbleChatAvailable,
  isBubbleChatEnabled,
  setBubbleChatEnabled,
  bubblesAllowedBySystem,
  openBubbleSystemSettings,
} from "../../../services/bubble/nativeBubble";
import React, { useContext, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  Linking,
  Alert,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons, FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../../../contexts/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { ScrollView } from "react-native";
import Dropdown from "../../../components/Dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as Application from "expo-application";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../../../i18n";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { isDevModeEnabled, setDevModeEnabled } from "../../../utils/devConsole";
import { getRunningUpdateInfo } from "../../../services/ota/otaService";
import { batteryOptimizationApi } from "../../../services/bubble/nativeBubble";
import { isBatteryPromptEnabled, setBatteryPromptEnabled } from "../../../utils/batteryOptimization";
import { SettingItem, SettingSection, SettingTile, SectionHeader, ACCENT, tint } from "../../../components/settings/SettingsUI";
import { getAiTranslatePreference, setAiTranslatePreference } from "../../../utils/aiTranslation";

export default function SettingsScreen({ navigation }) {
  const { userInfo } = useContext(AuthContext);
  const [runningUpdate, setRunningUpdate] = React.useState(() => getRunningUpdateInfo());
  const { isDarkMode, theme, setThemeMode, useSystemTheme, hideTabLabels, setHideTabLabels, autoplayVideos, setAutoplayVideos, liquidGlassEnabled, setLiquidGlassEnabled, shakeToReportEnabled, setShakeToReportEnabled } = useTheme();
  const insets = useSafeAreaInsets();
  // Android 11+ only (system bubbles); hidden elsewhere and on old builds.
  const [bubbleChatOn, setBubbleChatOn] = useState(() => bubbleChatAvailable && isBubbleChatEnabled());
  const toggleBubbleChat = (on) => {
    if (on && !bubblesAllowedBySystem()) {
      Toast.show({ type: "info", text1: t("settings.bubbleChat"), text2: t("settings.bubbleChatSystemOff"), topOffset: 60 });
      openBubbleSystemSettings();
    }
    setBubbleChatEnabled(on);
    setBubbleChatOn(on);
  };
  const { t, i18n } = useTranslation();

  // Android background use (battery optimisation): status + the start-up reminder.
  const batteryApi = batteryOptimizationApi();
  const [batteryIgnoring, setBatteryIgnoring] = useState(() => (batteryApi ? batteryApi.isIgnoring() : true));
  const [batteryRemind, setBatteryRemind] = useState(() => isBatteryPromptEnabled());
  const toggleBatteryRemind = (on) => {
    if (on) {
      setBatteryPromptEnabled(true);
      setBatteryRemind(true);
      return;
    }
    // Switching the reminder off: say what is lost first.
    Alert.alert(t("settings.batteryWarnTitle"), t("settings.batteryWarnBody"), [
      {
        text: t("security.cancel"),
        style: "cancel",
      },
      {
        text: t("settings.batteryWarnConfirm"),
        style: "destructive",
        onPress: () => {
          setBatteryPromptEnabled(false);
          setBatteryRemind(false);
        },
      },
    ]);
  };

  // Tapping the version text 5 times within 3s toggles on the hidden
  // developer debug console (persistent - re-checked whenever this screen
  // gains focus, since it can also be turned off from inside that screen).
  const DEV_MODE_TAPS = 5;
  const [devMode, setDevMode] = React.useState(false);
  const versionTapCountRef = useRef(0);
  const versionTapTimerRef = useRef(null);

  useFocusEffect(
    React.useCallback(() => {
      setDevMode(isDevModeEnabled());
      setRunningUpdate(getRunningUpdateInfo());
      // Back from the system dialog / settings: show the new state.
      if (batteryApi) setBatteryIgnoring(batteryApi.isIgnoring());
    }, [])
  );

  const handleVersionTap = () => {
    if (isDevModeEnabled()) return;

    versionTapCountRef.current += 1;
    clearTimeout(versionTapTimerRef.current);
    versionTapTimerRef.current = setTimeout(() => {
      versionTapCountRef.current = 0;
    }, 3000);

    const count = versionTapCountRef.current;
    if (count >= DEV_MODE_TAPS) {
      versionTapCountRef.current = 0;
      clearTimeout(versionTapTimerRef.current);
      setDevModeEnabled(true).then(() => {
        setDevMode(true);
        Toast.show({
          type: "success",
          text1: t("devConsole.enabledToastTitle"),
          text2: t("devConsole.enabledToastDesc"),
          visibilityTime: 3000,
        });
      });
    } else if (count >= DEV_MODE_TAPS - 2) {
      const remaining = DEV_MODE_TAPS - count;
      Toast.show({
        type: "info",
        text1: t("devConsole.stepsRemaining", { count: remaining }),
        visibilityTime: 1800,
      });
    }
  };

  if (!userInfo) return null;

  const languageCode = i18n.language?.split("-")[0] || "vi";
  const [aiTranslatePref, setAiTranslatePref] = React.useState(() => getAiTranslatePreference());

  const aiTranslateOptions = [
    { label: `✨ ${t("settings.aiTranslateAuto", "Tự động")}`, value: "auto" },
    { label: "🇻🇳 Tiếng Việt", value: "vi" },
    { label: "🇬🇧 English", value: "en" },
    { label: "🇷🇺 Русский", value: "ru" },
    { label: "🇨🇳 简体中文", value: "zh" },
  ];

  const currentAiTranslateOption = aiTranslateOptions.find((o) => o.value === aiTranslatePref) || aiTranslateOptions[0];
  const currentLanguage = languageCode === "ru" ? "ru" : languageCode === "en" ? "en" : "vi";

  const currentThemeIcon = useSystemTheme ? (
    <MaterialCommunityIcons name="theme-light-dark" size={18} color="#10B981" />
  ) : isDarkMode ? (
    <MaterialCommunityIcons name="weather-night" size={18} color="#8B5CF6" />
  ) : (
    <MaterialCommunityIcons name="weather-sunny" size={18} color="#F59E0B" />
  );

  const currentThemeLabel = useSystemTheme
    ? t("settings.auto")
    : isDarkMode
    ? t("settings.dark")
    : t("settings.light");

  const themeOptions = [
    {
      label: t("settings.auto"),
      value: "system",
      icon: <MaterialCommunityIcons name="theme-light-dark" size={20} color="#10B981" />,
    },
    {
      label: t("settings.light"),
      value: "light",
      icon: <MaterialCommunityIcons name="weather-sunny" size={20} color="#F59E0B" />,
    },
    {
      label: t("settings.dark"),
      value: "dark",
      icon: <MaterialCommunityIcons name="weather-night" size={20} color="#8B5CF6" />,
    },
  ];

  const scrollY = useRef(new Animated.Value(0)).current;

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View
        style={[styles.header, { paddingTop: insets.top, paddingBottom: 8, height: 58 + insets.top }]}
        pointerEvents="box-none"
      >
        <LiquidButton size={44} scrollY={scrollY} providerId="SettingsScreen" onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>

        <Animated.Text
          style={[styles.headerTitle, { color: theme.primary, opacity: titleOpacity }]}
          numberOfLines={1}
        >
          {t("settings.title")}
        </Animated.Text>

        {/* Spacer to balance back button */}
        <View style={{ width: 44 }} />
      </View>

      <AndroidGlassBackdrop providerId="SettingsScreen" style={{ flex: 1 }}>
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
          pointerEvents="none"
        />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: 58 + insets.top, paddingBottom: insets.bottom + 32 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient info card */}
        <LinearGradient
          colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
        >
          {/* Decorative circles */}
          <View style={styles.gradientCircle1} />
          <View style={styles.gradientCircle2} />

          <View style={{ flex: 1, zIndex: 1 }}>
            <View style={styles.gradientBadge}>
              <Image source={require("../../../assets/logo.png")} style={styles.gradientBadgeLogo} />
              <Text style={styles.gradientBadgeText}>CBH Online</Text>
            </View>
            <Text style={[styles.gradientTitle, { color: isDarkMode ? "#F3F4F6" : "#0F2E1E" }]} numberOfLines={2}>
              {t("settings.greeting", { name: userInfo.profile_name })}
            </Text>
            <Text style={[styles.gradientSubtitle, { color: isDarkMode ? "#9CA3AF" : "#4B6B58" }]}>{t("settings.subtitle")}</Text>
          </View>
          <View style={[styles.gradientAvatarRing, { zIndex: 1 }]}>
            <Image
              source={{ uri: `https://api.chuyenbienhoa.com/v1.0/users/${userInfo.username}/avatar` }}
              style={styles.gradientAvatar}
            />
            <View style={styles.gradientAvatarBadge}>
              <Ionicons name="settings" size={11} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>

        {/* Account: shortcut tiles */}
        <SectionHeader icon="person-circle-outline" color={ACCENT.profile} title={t("settings.account")} />
        <View style={styles.tilesGrid}>
          <SettingTile
            icon="person"
            color={ACCENT.profile}
            title={t("settings.editProfile")}
            theme={theme}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate("ProfileDetailScreen", { username: userInfo.username })}
          />
          <SettingTile
            icon="color-palette"
            color={ACCENT.profileTheme}
            title={t("profileTheme.title", "Giao diện hồ sơ")}
            theme={theme}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate("ProfileCustomizerScreen")}
          />
          <SettingTile
            icon="lock-closed"
            color={ACCENT.security}
            title={t("settings.security")}
            theme={theme}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate("SecurityScreen")}
          />
          <SettingTile
            icon="notifications"
            color={ACCENT.notifications}
            title={t("settings.notifications")}
            theme={theme}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate("NotificationSettingsScreen")}
          />
          <SettingTile
            icon="school"
            color={ACCENT.verification}
            title={t("settings.studentVerification", "Xác minh học sinh")}
            theme={theme}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate("StudentVerificationScreen")}
          />
          <SettingTile
            icon="ban"
            color={ACCENT.blocked}
            title={t("settings.blockedUsers")}
            theme={theme}
            isDarkMode={isDarkMode}
            onPress={() => navigation.navigate("BlockedUsersScreen")}
          />
        </View>

        {/* Appearance */}
        <SettingSection icon="color-wand-outline" color={ACCENT.theme} title={t("settings.groupAppearance")} theme={theme} isDarkMode={isDarkMode}>
          {/* Theme dropdown */}
          <View style={[styles.dropdownRow, { borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9" }]}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingItemIcon, { backgroundColor: tint(ACCENT.theme, isDarkMode) }]}>
                <Ionicons name="color-palette-outline" size={20} color={ACCENT.theme} />
              </View>
              <Text style={[styles.settingItemText, { color: theme.text, marginLeft: 12 }]}>{t("settings.theme")}</Text>
            </View>
            <Dropdown
              options={themeOptions}
              selectedValue={{
                label: currentThemeLabel,
                value: useSystemTheme ? "system" : isDarkMode ? "dark" : "light",
                icon: currentThemeIcon,
              }}
              onValueChange={(item) => setThemeMode(item.value)}
              style={{ borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0, borderRadius: 0, backgroundColor: "transparent" }}
              containerStyle={{ marginVertical: 0, alignItems: "flex-end" }}
              textStyle={{ color: theme.subText, fontSize: 15, textAlign: "right" }}
              modalTitle={t("settings.theme")}
            />
          </View>

          <SettingItem
            icon="apps-outline"
            title={t("settings.appIcon", "Biểu tượng ứng dụng")}
            onPress={() => navigation.navigate("AppIconScreen")}
          />
          <SettingItem
            icon="sparkles-outline"
            title={t("settings.liquidGlassEffect")}
            isSwitch
            value={liquidGlassEnabled}
            onPress={setLiquidGlassEnabled}
          />
        </SettingSection>

        {/* Language and content */}
        <SettingSection icon="globe-outline" color={ACCENT.language} title={t("settings.groupLanguage")} theme={theme} isDarkMode={isDarkMode}>
          {/* Language dropdown */}
          <View style={[styles.dropdownRow, { borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9" }]}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingItemIcon, { backgroundColor: tint(ACCENT.language, isDarkMode) }]}>
                <Ionicons name="language-outline" size={20} color={ACCENT.language} />
              </View>
              <Text style={[styles.settingItemText, { color: theme.text, marginLeft: 12 }]}>{t("settings.language")}</Text>
            </View>
            <Dropdown
              options={[
                { label: `🇻🇳 ${t("settings.vietnamese")}`, value: "vi" },
                { label: `🇬🇧 ${t("settings.english")}`, value: "en" },
                { label: `🇷🇺 ${t("settings.russian")}`, value: "ru" },
              ]}
              selectedValue={{
                label:
                  currentLanguage === "ru"
                    ? `🇷🇺 ${t("settings.russian")}`
                    : currentLanguage === "en"
                    ? `🇬🇧 ${t("settings.english")}`
                    : `🇻🇳 ${t("settings.vietnamese")}`,
                value: currentLanguage,
              }}
              onValueChange={(item) => changeLanguage(item.value)}
              style={{ borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0, borderRadius: 0, backgroundColor: "transparent" }}
              containerStyle={{ marginVertical: 0, alignItems: "flex-end" }}
              textStyle={{ color: theme.subText, fontSize: 15, textAlign: "right" }}
            />
          </View>

          {/* AI Translation Language dropdown */}
          <View style={[styles.dropdownRow, { borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9", justifyContent: "space-between" }]}>
            <View style={[styles.settingItemLeft, { minWidth: 0, marginRight: 8 }]}>
              <View style={[styles.settingItemIcon, { backgroundColor: tint(ACCENT.aiTranslate, isDarkMode) }]}>
                <Ionicons name="sparkles-outline" size={20} color={ACCENT.aiTranslate} />
              </View>
              <Text style={[styles.settingItemText, { color: theme.text, marginLeft: 12 }]} numberOfLines={2}>
                {t("settings.aiTranslate")}
              </Text>
            </View>
            <Dropdown
              options={aiTranslateOptions}
              selectedValue={currentAiTranslateOption}
              onValueChange={(item) => {
                setAiTranslatePref(item.value);
                setAiTranslatePreference(item.value);
                Toast.show({
                  type: "success",
                  text1: t("settings.aiTranslate"),
                  text2: item.label,
                  visibilityTime: 2000,
                });
              }}
              style={{ borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0, borderRadius: 0, backgroundColor: "transparent", maxWidth: "100%" }}
              containerStyle={{ marginVertical: 0, alignItems: "flex-end", flexShrink: 1, maxWidth: "46%" }}
              textStyle={{ color: theme.subText, fontSize: 15, textAlign: "right" }}
              modalTitle={t("settings.aiTranslate")}
            />
          </View>

          <SettingItem
            icon="play-circle-outline"
            color={ACCENT.autoplay}
            title={t("settings.autoplayVideos")}
            isSwitch
            value={autoplayVideos}
            onPress={setAutoplayVideos}
          />
        </SettingSection>

        {/* Chat and background use (Android only; the section hides itself when empty) */}
        <SettingSection icon="chatbubbles-outline" color={ACCENT.bubble} title={t("settings.groupNotifications")} theme={theme} isDarkMode={isDarkMode}>
          {bubbleChatAvailable && (
            <SettingItem
              icon="chatbubble-ellipses-outline"
              color={ACCENT.bubble}
              title={t("settings.bubbleChat")}
              subtitle={t("settings.bubbleChatDesc")}
              isSwitch
              value={bubbleChatOn}
              onPress={toggleBubbleChat}
            />
          )}
          {batteryApi && (
            <SettingItem
              icon="battery-charging-outline"
              color={ACCENT.battery}
              title={t("settings.batteryBackground")}
              subtitle={batteryIgnoring ? t("settings.batteryBackgroundOn") : t("settings.batteryBackgroundOff")}
              chevron={!batteryIgnoring}
              onPress={() => {
                if (!batteryIgnoring) batteryApi.request();
              }}
            />
          )}
          {batteryApi && (
            <SettingItem
              icon="alarm-outline"
              color={ACCENT.remind}
              title={t("settings.batteryRemind")}
              subtitle={t("settings.batteryRemindDesc")}
              isSwitch
              value={batteryRemind}
              onPress={toggleBatteryRemind}
            />
          )}
        </SettingSection>

        {/* App */}
        <SettingSection icon="apps-outline" color={ACCENT.about} title={t("settings.groupApp")} theme={theme} isDarkMode={isDarkMode}>
          <SettingItem
            icon="phone-portrait-outline"
            color={ACCENT.shake}
            title={t("settings.shakeToReport")}
            isSwitch
            value={shakeToReportEnabled}
            onPress={setShakeToReportEnabled}
          />
          <SettingItem
            icon="cloud-download-outline"
            color={ACCENT.updates}
            title={t("settings.appUpdates", "Cập nhật ứng dụng")}
            value={
              runningUpdate.isOtaActive && runningUpdate.activeBuildNumber
                ? `(OTA Version: Build ${runningUpdate.activeBuildNumber})`
                : undefined
            }
            onPress={() => navigation.navigate("AppUpdatesScreen")}
          />
          <SettingItem
            icon="information-circle-outline"
            color={ACCENT.about}
            title={t("settings.about")}
            onPress={() => navigation.navigate("AboutScreen")}
            onLongPress={() => navigation.navigate("EasterEggScreen")}
            delayLongPress={500}
          />
          {devMode && (
            <SettingItem
              icon="terminal-outline"
              color={ACCENT.debug}
              title={t("settings.debugConsole")}
              onPress={() => navigation.navigate("DevConsoleScreen")}
              lastItem
            />
          )}
        </SettingSection>

        {/* Version & Social */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleVersionTap}
        >
          <Text style={[styles.versionText, { color: theme.subText }]}>
            {t("settings.version", {
              appVersion: Application.nativeApplicationVersion,
              buildVersion: Application.nativeBuildVersion,
            })}
            {runningUpdate.isOtaActive && runningUpdate.activeBuildNumber
              ? ` (OTA Version: Build ${runningUpdate.activeBuildNumber})`
              : ""}
          </Text>
        </TouchableOpacity>

        <View style={styles.socialContainer}>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://github.com/tunnaduong/cbh-youth-online-mobile")}
            style={[styles.socialButton, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
          >
            <Ionicons name="logo-github" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://facebook.com/CBHYouthOnline")}
            style={[styles.socialButton, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
          >
            <Ionicons name="logo-facebook" size={22} color="#1877F2" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://discord.chuyenbienhoa.com/")}
            style={[styles.socialButton, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
          >
            <FontAwesome6 name="discord" size={22} color="#5865F2" />
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Floating transparent header
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  gradientCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  gradientCircle1: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(34,197,94,0.10)",
    top: -40,
    right: 60,
  },
  gradientCircle2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(245,158,11,0.10)",
    bottom: -30,
    right: -10,
  },
  gradientBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
    gap: 4,
  },
  gradientBadgeLogo: {
    width: 13,
    height: 13,
    borderRadius: 3,
  },
  gradientBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
    letterSpacing: 0.3,
  },
  gradientTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  gradientSubtitle: { fontSize: 13, lineHeight: 18 },
  gradientAvatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: "#22C55E",
    padding: 2,
    marginLeft: 12,
  },
  gradientAvatar: { width: "100%", height: "100%", borderRadius: 28, backgroundColor: "#D1D5DB" },
  gradientAvatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  gradientIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  // Section
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  tileSubtitle: { fontSize: 11, fontWeight: "500" },
  settingSection: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  settingItemText: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  settingItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingValueText: {
    fontSize: 15,
  },
  // Dropdown row (theme/language) — custom layout so dropdown aligns right
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  versionText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
