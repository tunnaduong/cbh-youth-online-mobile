import React, { useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  Linking,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../../../contexts/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import FastImage from "../../../components/FastImage";
import { ScrollView } from "react-native";
import Dropdown from "../../../components/Dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as Application from "expo-application";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../../../i18n";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

const SettingItem = ({
  icon,
  title,
  onPress,
  onLongPress,
  delayLongPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
  theme,
}) => (
  <TouchableOpacity
    style={[
      styles.settingItem,
      lastItem && styles.lastSettingItem,
      { borderBottomColor: theme.border },
    ]}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={delayLongPress}
    disabled={isSwitch}
    activeOpacity={0.7}
  >
    <View style={styles.settingItemLeft}>
      <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <Text style={[styles.settingItemText, { color: theme.text }]}>{title}</Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ true: theme.primary }}
      />
    ) : value ? (
      <View style={styles.settingItemRight}>
        <Text style={[styles.settingValueText, { color: theme.subText }]}>{value}</Text>
        {chevron && <Ionicons name="chevron-forward" size={18} color={theme.subText} />}
      </View>
    ) : (
      chevron && <Ionicons name="chevron-forward" size={18} color={theme.subText} />
    )}
  </TouchableOpacity>
);

const SettingSection = ({ title, children, theme }) => {
  const childrenArray = React.Children.toArray(children);
  return (
    <View style={styles.sectionWrapper}>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
      <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            lastItem: index === childrenArray.length - 1,
            theme,
          })
        )}
      </View>
    </View>
  );
};

export default function SettingsScreen({ navigation }) {
  const { userInfo } = useContext(AuthContext);
  const { isDarkMode, theme, setThemeMode, useSystemTheme, hideTabLabels, setHideTabLabels } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle(isDarkMode ? "light-content" : "dark-content", true);
      if (StatusBar.setBackgroundColor) StatusBar.setBackgroundColor(theme.background, true);
    }, [isDarkMode, theme.background])
  );

  if (!userInfo) return null;

  const languageCode = i18n.language?.split("-")[0] || "vi";
  const currentLanguage = languageCode === "ru" ? "ru" : languageCode === "en" ? "en" : "vi";
  const currentThemeLabel = useSystemTheme
    ? t("settings.auto")
    : isDarkMode
    ? t("settings.dark")
    : t("settings.light");

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
          colors={isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          {/* Decorative circles */}
          <View style={styles.gradientCircle1} />
          <View style={styles.gradientCircle2} />

          <View style={{ flex: 1, zIndex: 1 }}>
            <View style={styles.gradientBadge}>
              <Image source={require("../../../assets/logo.png")} style={styles.gradientBadgeLogo} />
              <Text style={styles.gradientBadgeText}>CBH Online</Text>
            </View>
            <Text style={styles.gradientTitle}>{t("settings.greeting", { name: userInfo.profile_name })}</Text>
            <Text style={styles.gradientSubtitle}>{t("settings.subtitle")}</Text>
          </View>
          <View style={[styles.gradientIconWrap, { zIndex: 1 }]}>
            <Ionicons name="settings" size={26} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}
          onPress={() => navigation.navigate("ProfileScreen", { username: userInfo.username })}
          activeOpacity={0.8}
        >
          <FastImage
            source={{ uri: `https://api.chuyenbienhoa.com/v1.0/users/${userInfo.username}/avatar` }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>{userInfo.profile_name}</Text>
            <Text style={[styles.profileUsername, { color: theme.subText }]}>@{userInfo.username}</Text>
          </View>
          <View style={[styles.profileChevronWrap, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
            <Ionicons name="chevron-forward" size={18} color={theme.subText} />
          </View>
        </TouchableOpacity>

        {/* Account Section */}
        <SettingSection title={t("settings.account")} theme={theme}>
          <SettingItem
            icon="person-outline"
            title={t("settings.editProfile")}
            onPress={() => navigation.navigate("ProfileDetailScreen", { username: userInfo.username })}
          />
          <SettingItem
            icon="lock-closed-outline"
            title={t("settings.security")}
            onPress={() => navigation.navigate("SecurityScreen")}
          />
          <SettingItem
            icon="notifications-outline"
            title={t("settings.notifications")}
            onPress={() => navigation.navigate("NotificationSettingsScreen")}
          />
        </SettingSection>

        {/* App Section */}
        <SettingSection title={t("settings.application")} theme={theme}>
          {/* Theme dropdown */}
          <View style={[styles.dropdownRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
                <Ionicons name="moon-outline" size={20} color={theme.primary} />
              </View>
              <Text style={[styles.settingItemText, { color: theme.text }]}>{t("settings.theme")}</Text>
            </View>
            <Dropdown
              options={[
                { label: t("settings.auto"), value: "system" },
                { label: t("settings.light"), value: "light" },
                { label: t("settings.dark"), value: "dark" },
              ]}
              selectedValue={{
                label: currentThemeLabel,
                value: useSystemTheme ? "system" : isDarkMode ? "dark" : "light",
              }}
              onValueChange={(item) => setThemeMode(item.value)}
              style={{ borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0, borderRadius: 0, backgroundColor: "transparent" }}
              containerStyle={{ marginVertical: 0, minWidth: 100 }}
              textStyle={{ color: theme.subText, fontSize: 15, textAlign: "right" }}
            />
          </View>

          {/* Language dropdown */}
          <View style={[styles.dropdownRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
                <Ionicons name="language-outline" size={20} color={theme.primary} />
              </View>
              <Text style={[styles.settingItemText, { color: theme.text }]}>{t("settings.language")}</Text>
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
              containerStyle={{ marginVertical: 0, minWidth: 120 }}
              textStyle={{ color: theme.subText, fontSize: 15, textAlign: "right" }}
            />
          </View>

          <SettingItem
            icon="ban-outline"
            title={t("settings.blockedUsers")}
            onPress={() => navigation.navigate("BlockedUsersScreen")}
          />
          <SettingItem
            icon="information-circle-outline"
            title={t("settings.about")}
            onPress={() => navigation.navigate("AboutScreen")}
            onLongPress={() => navigation.navigate("EasterEggScreen")}
            delayLongPress={3000}
          />
        </SettingSection>

        {/* Version & Social */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            const lines = [
              "Diễn đàn hs Chuyên Biên Hòa là sân chơi của chuyên Nga :)))",
              "1 trong 2 người tạo ra là chuyên Nga K60",
              "Quản lý page chính Nga K67",
              "Developer chăm chỉ Nga K67 :))",
              "Phát triển Discord Nga K68",
              "Thank you Dương Tùng Anh",
              "Mãi mãi là chuyên Nga!!",
              "Em yêu chuyên Nga",
              "Cảm ơn bạn đã dùng app",
              "Chúc bạn có trải nghiệm thật tuyệt vời và đáng nhớ",
              "Chúc bạn có một ngày vui vẻ!",
              "Cảm ơn bạn đã sử dụng app",
              "Test app là 1 cách để đóng góp cho dự án",
              "Cảm ơn bạn A lớp sử giấu tên đã test ở iOS nhé! Thank you >3",
              "Mãi yêu a Tùng Anh",
            ];
            Toast.show({
              type: "success",
              text1: "Lời nhắn từ nhà phát triển app",
              text2: lines[Math.floor(Math.random() * lines.length)],
              visibilityTime: 3000,
            });
          }}
        >
          <Text style={[styles.versionText, { color: theme.subText }]}>
            {t("settings.version", {
              appVersion: Application.nativeApplicationVersion,
              buildVersion: Application.nativeBuildVersion,
            })}
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
            <FontAwesome name="discord" size={22} color="#5865F2" />
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
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  gradientCircle1: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -40,
    right: 60,
  },
  gradientCircle2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -30,
    right: -10,
  },
  gradientBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
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
    fontWeight: "600",
    color: "#C7F5D7",
    letterSpacing: 0.3,
  },
  gradientTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  gradientSubtitle: { fontSize: 13, color: "rgba(199,245,215,0.85)", lineHeight: 18 },
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
  // Profile card
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 3,
  },
  profileUsername: {
    fontSize: 14,
  },
  profileChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  // Section
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  settingSection: {
    borderRadius: 16,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  settingItemText: {
    fontSize: 16,
    marginLeft: 12,
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
