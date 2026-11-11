import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActionSheetIOS,
  Animated,
  Alert,
  StyleSheet,
  TextInput,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import FastImage from "./FastImage";
import AccountSwitcher from "./AccountSwitcher";
import UserNameRow from "./profile/UserNameRow";
import StyledUsername from "./profile/StyledUsername";
import { AvatarFrameWrap } from "./profile/AvatarFrame";
import { useOwnProfileTheme } from "../utils/ownProfileTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { AndroidGlassBackdrop } from "./GlassModules";
import { openInAppBrowser } from "../utils/externalLink";

const { width } = Dimensions.get("window");
const GRID_GAP = 10;
const GRID_CARD_WIDTH = Math.floor((width - 32 - GRID_GAP) / 2);

const MenuRow = ({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
  onLongPress,
  delayLongPress,
  destructive = false,
  last = false,
  theme,
  isDarkMode = false,
}) => {
  const isDark = isDarkMode || theme?.isDark || theme?.background === "#121212";
  const defaultBg = destructive
    ? isDark
      ? "rgba(255, 59, 48, 0.2)"
      : "#FDE8E8"
    : iconBg || theme.iconBackground;
  const defaultColor = destructive
    ? "#FF3B30"
    : iconColor || theme.primary;

  return (
    <TouchableOpacity
      style={[
        styles.menuRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDark ? "#282B34" : "#F1F5F9",
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconHolder, { backgroundColor: defaultBg }]}>
        <Ionicons name={icon} size={20} color={defaultColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={[
            styles.rowTitle,
            { color: destructive ? "#FF3B30" : theme.text },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: theme.subText }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={destructive ? "#FF3B30" : theme.subText}
      />
    </TouchableOpacity>
  );
};

const MenuSection = ({ icon, title, children, theme, isDarkMode }) => {
  const childrenArray = React.Children.toArray(children).filter(Boolean);
  if (childrenArray.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      {title ? (
        <View style={styles.sectionHeaderRow}>
          {icon ? (
            <Ionicons
              name={icon}
              size={15}
              color={isDarkMode ? "#4ADE80" : "#16A34A"}
              style={{ marginRight: 6 }}
            />
          ) : null}
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? "#9CA3AF" : "#6B7280" },
            ]}
          >
            {title}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.surface,
            borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
          },
        ]}
      >
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            last: index === childrenArray.length - 1,
            theme,
            isDarkMode,
          })
        )}
      </View>
    </View>
  );
};

const Sidebar = ({
  providerId = "Profile",
  isOpen = true,
  isTab = true,
  scrollTriggerRef = null,
}) => {
  const { signOut, username, profileName, userInfo } = useContext(AuthContext);
  const ownTheme = useOwnProfileTheme(username, isTab || !!isOpen);
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const isCustomTabBar = true;

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTop);
    }
  }, [scrollTriggerRef, scrollToTop]);

  const onPressIOS = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t("settings.logoutConfirm"),
        options: [t("settings.cancel"), t("settings.logout")],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 0,
        userInterfaceStyle: isDarkMode ? "dark" : "light",
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          signOut();
        }
      }
    );
  };

  const onPressAndroid = () =>
    Alert.alert(
      t("settings.logout"),
      t("settings.logoutConfirm"),
      [
        {
          text: t("settings.yes"),
          style: "destructive",
          onPress: signOut,
        },
        {
          text: t("settings.no"),
          style: "cancel",
        },
      ],
      { cancelable: true }
    );

  const handleLogout = () => {
    Platform.OS === "ios" ? onPressIOS() : onPressAndroid();
  };

  // Utilities Shortcuts displayed as modern 2-column tiles
  const shortcuts = useMemo(() => {
    const list = [
      {
        id: "feed",
        icon: "newspaper",
        title: t("sidebar.feed", "Bảng tin"),
        subtitle: t("sidebar.community", "Cộng đồng"),
        color: "#3B82F6",
        bg: isDarkMode ? "rgba(59, 130, 246, 0.16)" : "#EFF6FF",
        onPress: () => navigation.navigate("MainScreens", { screen: "Home" }),
      },
      {
        id: "explore",
        icon: "compass",
        title: t("sidebar.explore", "Khám phá"),
        subtitle: t("sidebar.lookup", "Tra cứu & Học tập"),
        color: "#10B981",
        bg: isDarkMode ? "rgba(16, 185, 129, 0.16)" : "#ECFDF5",
        onPress: () => navigation.navigate("MainScreens", { screen: "Explore" }),
      },
      {
        id: "forum",
        icon: "people",
        title: t("navigation.forum", "Diễn đàn"),
        subtitle: t("sidebar.community", "Thảo luận"),
        color: "#6366F1",
        bg: isDarkMode ? "rgba(99, 102, 241, 0.16)" : "#EEF2FF",
        onPress: () => navigation.navigate("ForumScreen"),
      },
      {
        id: "giftShop",
        icon: "gift",
        title: t("sidebar.giftShop", "Chợ quà tặng"),
        subtitle: t("sidebar.pointWallet", "Đổi quà CYO"),
        color: "#EC4899",
        bg: isDarkMode ? "rgba(236, 72, 153, 0.16)" : "#FDF2F8",
        onPress: () => navigation.navigate("GiftShopScreen"),
      },
      {
        id: "pointWallet",
        icon: "wallet",
        title: t("sidebar.pointWallet", "Ví điểm"),
        subtitle: t("sidebar.pointWallet", "Điểm thưởng"),
        color: "#F59E0B",
        bg: isDarkMode ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7",
        onPress: () => navigation.navigate("PointWalletScreen"),
      },
      {
        id: "saved",
        icon: "bookmark",
        title: t("sidebar.saved", "Đã lưu"),
        subtitle: t("sidebar.saved", "Bài viết đã lưu"),
        color: "#8B5CF6",
        bg: isDarkMode ? "rgba(139, 92, 246, 0.16)" : "#F5F3FF",
        onPress: () => navigation.navigate("SavedPostsScreen"),
      },
      {
        id: "youthNews",
        icon: "megaphone",
        title: t("sidebar.youthUnionNews", "Tin tức Đoàn"),
        subtitle: t("sidebar.youthUnionNews", "Thông báo"),
        color: "#EF4444",
        bg: isDarkMode ? "rgba(239, 68, 68, 0.16)" : "#FEF2F2",
        onPress: () => navigation.navigate("CategoryScreen", { categoryId: 32 }),
      },
      {
        id: "ranking",
        icon: "trophy",
        title: t("sidebar.memberRanking", "Bảng xếp hạng"),
        subtitle: t("sidebar.memberRanking", "Xếp hạng"),
        color: "#EAB308",
        bg: isDarkMode ? "rgba(234, 179, 8, 0.16)" : "#FEFCE8",
        onPress: () => navigation.navigate("MemberRankingScreen"),
      },
    ];

    if (userInfo?.role === "admin") {
      list.push({
        id: "admin",
        icon: "shield-checkmark",
        title: t("sidebar.admin", "Quản trị viên"),
        subtitle: t("sidebar.admin", "Hệ thống"),
        color: "#14B8A6",
        bg: isDarkMode ? "rgba(20, 184, 166, 0.16)" : "#F0FDFA",
        onPress: () => navigation.navigate("AdminWebScreen"),
      });
    }

    return list;
  }, [t, isDarkMode, navigation, userInfo]);

  const query = searchQuery.trim().toLowerCase();

  const filteredShortcuts = useMemo(() => {
    if (!query) return shortcuts;
    return shortcuts.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query)
    );
  }, [shortcuts, query]);

  // Support rows
  const supportItems = useMemo(
    () => [
      {
        id: "about",
        icon: "information-circle-outline",
        iconColor: "#3B82F6",
        iconBg: isDarkMode ? "rgba(59, 130, 246, 0.18)" : "#EFF6FF",
        title: t("sidebar.about", "Giới thiệu"),
        onPress: () => navigation.navigate("AboutScreen"),
        onLongPress: () => navigation.navigate("EasterEggScreen"),
        delayLongPress: 500,
      },
      {
        id: "help",
        icon: "help-circle-outline",
        iconColor: "#10B981",
        iconBg: isDarkMode ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
        title: t("sidebar.help", "Trợ giúp"),
        onPress: () => openInAppBrowser("https://www.chuyenbienhoa.com/help", theme),
      },
      {
        id: "reportIssue",
        icon: "bug-outline",
        iconColor: "#EC4899",
        iconBg: isDarkMode ? "rgba(236, 72, 153, 0.18)" : "#FDF2F8",
        title: t("sidebar.reportIssue", "Báo lỗi / Góp ý"),
        onPress: () => navigation.navigate("FeedbackScreen", { source: "sidebar" }),
      },
      {
        id: "privacy",
        icon: "shield-outline",
        iconColor: "#6366F1",
        iconBg: isDarkMode ? "rgba(99, 102, 241, 0.18)" : "#EEF2FF",
        title: t("sidebar.privacy", "Quyền riêng tư"),
        onPress: () => navigation.navigate("PrivacyPolicyScreen"),
      },
      {
        id: "terms",
        icon: "document-text-outline",
        iconColor: "#64748B",
        iconBg: isDarkMode ? "rgba(100, 116, 139, 0.18)" : "#F1F5F9",
        title: t("sidebar.terms", "Điều khoản sử dụng"),
        onPress: () => navigation.navigate("TermsOfServiceScreen"),
      },
    ],
    [t, isDarkMode, navigation, theme]
  );

  const filteredSupportItems = useMemo(() => {
    if (!query) return supportItems;
    return supportItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [supportItems, query]);

  // Reports items
  const reportItems = useMemo(
    () => [
      {
        id: "studentViolation",
        icon: "alert-circle-outline",
        iconColor: "#F59E0B",
        iconBg: isDarkMode ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7",
        title: t("sidebar.studentViolation", "Vi phạm học sinh"),
        onPress: () => navigation.navigate("ReportScreen", { type: "student" }),
      },
      {
        id: "classViolation",
        icon: "warning-outline",
        iconColor: "#EF4444",
        iconBg: isDarkMode ? "rgba(239, 68, 68, 0.18)" : "#FEF2F2",
        title: t("sidebar.classViolation", "Vi phạm tập thể lớp"),
        onPress: () => navigation.navigate("ReportScreen", { type: "class" }),
      },
    ],
    [t, isDarkMode, navigation]
  );

  const filteredReportItems = useMemo(() => {
    if (!query) return reportItems;
    return reportItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [reportItems, query]);

  // Settings items
  const settingsItems = useMemo(
    () => [
      {
        id: "settings",
        icon: "settings-outline",
        iconColor: "#16A34A",
        iconBg: isDarkMode ? "rgba(34, 197, 94, 0.18)" : "#DCFCE7",
        title: t("settings.title", "Cài đặt"),
        onPress: () => navigation.navigate("Settings"),
      },
      {
        id: "logout",
        icon: "log-out-outline",
        title: t("settings.logout", "Đăng xuất"),
        destructive: true,
        onPress: handleLogout,
      },
    ],
    [t, isDarkMode, navigation, handleLogout]
  );

  const filteredSettingsItems = useMemo(() => {
    if (!query) return settingsItems;
    return settingsItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [settingsItems, query]);

  const hasAnyResults =
    filteredShortcuts.length > 0 ||
    filteredReportItems.length > 0 ||
    filteredSupportItems.length > 0 ||
    filteredSettingsItems.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AndroidGlassBackdrop providerId={providerId} style={{ flex: 1 }}>
        {/* Soft Ambient Light-Green Glow at Top */}
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.45)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.4)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.ambientGlow, { height: insets.top + 140 }]}
          pointerEvents="none"
        />

        {/* Top Header Bar matching Home, Explore, Chat, and Notification */}
        <View
          style={[
            styles.headerContainer,
            { paddingTop: insets.top + (Platform.OS === "ios" ? 4 : 8) },
          ]}
        >
          {/* Left: Cute Frog Mascot + Doodles + Title & Subtitle */}
          <TouchableOpacity
            style={styles.headerLeftGroup}
            activeOpacity={0.75}
            onPress={scrollToTop}
            accessibilityRole="button"
            accessibilityLabel={t("sidebar.menu", "Menu")}
          >
            <View style={styles.mascotWrapper}>
              <View style={styles.actionLinesWrapper}>
                <View style={[styles.actionLine, styles.actionLine1]} />
                <View style={[styles.actionLine, styles.actionLine2]} />
                <View style={[styles.actionLine, styles.actionLine3]} />
              </View>
              <FastImage
                source={require("../assets/logo.png")}
                style={styles.mascotLogo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.titleColumn}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[
                    styles.brandTitle,
                    { color: isDarkMode ? "#4ADE80" : "#15803D" },
                  ]}
                >
                  {t("sidebar.menu", "Menu")}
                </Text>
                <Text style={styles.sparkleStar}>✦</Text>
              </View>
              <Text
                style={[
                  styles.brandSubtitle,
                  { color: isDarkMode ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                {t("sidebar.subtitle", "Tài khoản & Tiện ích")}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Right: Search & Settings Shortcut Icon Buttons */}
          <View style={styles.headerRightGroup}>
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(34, 197, 94, 0.16)"
                    : "rgba(34, 197, 94, 0.12)",
                },
              ]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("SearchScreen")}
              accessibilityRole="button"
              accessibilityLabel={t("sidebar.searchPlaceholder", "Tìm kiếm")}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={isDarkMode ? "#4ADE80" : "#15803D"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(34, 197, 94, 0.16)"
                    : "rgba(34, 197, 94, 0.12)",
                },
              ]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("Settings")}
              accessibilityRole="button"
              accessibilityLabel={t("settings.title", "Cài đặt")}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={isDarkMode ? "#4ADE80" : "#15803D"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Content */}
        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: isCustomTabBar ? 110 : 80 + insets.bottom,
            },
          ]}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Quick Search Bar */}
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: isDarkMode ? "#1B1E24" : "#FFFFFF",
                  borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.subText}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder={t(
                  "sidebar.searchPlaceholder",
                  "Tìm kiếm tiện ích, cài đặt..."
                )}
                placeholderTextColor={theme.placeholder || "#9CA3AF"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={theme.subText} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Facebook-style Profile Card */}
          <TouchableOpacity
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.surface,
                borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
              },
            ]}
            onPress={() => navigation.navigate("ProfileScreen", { username })}
            activeOpacity={0.7}
          >
            <AvatarFrameWrap
              theme={ownTheme}
              size={56}
              style={{ alignSelf: "center", marginRight: 14 }}
            >
              <FastImage
                source={{
                  uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
                }}
                style={{ width: 56, height: 56, borderRadius: 28 }}
              />
            </AvatarFrameWrap>
            <View style={{ flex: 1 }}>
              <UserNameRow
                name={profileName}
                theme={ownTheme}
                variant="full"
                style={{ fontSize: 17, fontWeight: "bold", color: theme.text }}
              />
              <StyledUsername
                theme={ownTheme}
                username={username}
                variant="full"
                style={{ color: theme.subText, marginTop: 2 }}
                numberOfLines={1}
              />
              <View style={styles.viewProfileRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={15}
                  color={theme.primary}
                />
                <Text
                  style={[
                    styles.viewProfileText,
                    { color: theme.primary },
                  ]}
                >
                  {t("sidebar.viewProfile", "Xem trang cá nhân của bạn")}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </TouchableOpacity>

          {/* Account switcher card */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface,
                borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                marginBottom: 20,
              },
            ]}
          >
            <AccountSwitcher />
          </View>

          {/* If search yields no results */}
          {!hasAnyResults && (
            <View style={styles.emptySearchWrap}>
              <FastImage
                source={require("../assets/sad_frog.png")}
                style={{ width: 100, height: 100 }}
                resizeMode={FastImage.resizeMode.contain}
              />
              <Text style={[styles.emptySearchText, { color: theme.subText }]}>
                {t("sidebar.noResults", "Không tìm thấy tiện ích phù hợp")}
              </Text>
            </View>
          )}

          {/* Section: Shortcuts (2-Column Grid) */}
          {filteredShortcuts.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="grid-outline"
                  size={15}
                  color={isDarkMode ? "#4ADE80" : "#16A34A"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDarkMode ? "#9CA3AF" : "#6B7280" },
                  ]}
                >
                  {t("sidebar.shortcuts", "Lối tắt")}
                </Text>
              </View>

              <View style={styles.gridContainer}>
                {filteredShortcuts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.gridCard,
                      {
                        width: GRID_CARD_WIDTH,
                        backgroundColor: theme.surface,
                        borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                      },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.gridIconHolder,
                        { backgroundColor: item.bg },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={item.color}
                      />
                    </View>
                    <Text
                      style={[styles.gridTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text
                        style={[
                          styles.gridSubtitle,
                          { color: theme.subText },
                        ]}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Section: Reports */}
          {filteredReportItems.length > 0 && (
            <MenuSection
              icon="flag-outline"
              title={t("sidebar.reports", "Báo cáo")}
              theme={theme}
              isDarkMode={isDarkMode}
            >
              {filteredReportItems.map((item) => (
                <MenuRow
                  key={item.id}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  iconBg={item.iconBg}
                  title={item.title}
                  onPress={item.onPress}
                />
              ))}
            </MenuSection>
          )}

          {/* Section: Support */}
          {filteredSupportItems.length > 0 && (
            <MenuSection
              icon="help-buoy-outline"
              title={t("sidebar.support", "Hỗ trợ")}
              theme={theme}
              isDarkMode={isDarkMode}
            >
              {filteredSupportItems.map((item) => (
                <MenuRow
                  key={item.id}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  iconBg={item.iconBg}
                  title={item.title}
                  onPress={item.onPress}
                  onLongPress={item.onLongPress}
                  delayLongPress={item.delayLongPress}
                />
              ))}
            </MenuSection>
          )}

          {/* Section: Settings & Account */}
          {filteredSettingsItems.length > 0 && (
            <MenuSection
              icon="settings-outline"
              title={t("sidebar.settingsGroup", "Thiết lập")}
              theme={theme}
              isDarkMode={isDarkMode}
            >
              {filteredSettingsItems.map((item) => (
                <MenuRow
                  key={item.id}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  iconBg={item.iconBg}
                  title={item.title}
                  destructive={item.destructive}
                  onPress={item.onPress}
                />
              ))}
            </MenuSection>
          )}
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  mascotWrapper: {
    position: "relative",
    width: 44,
    height: 44,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  mascotLogo: {
    width: 40,
    height: 40,
  },
  actionLinesWrapper: {
    position: "absolute",
    top: -7,
    left: 11,
    width: 22,
    height: 14,
  },
  actionLine: {
    position: "absolute",
    width: 2.5,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: "#EAB308",
  },
  actionLine1: {
    top: 6,
    left: 1,
    transform: [{ rotate: "-40deg" }],
  },
  actionLine2: {
    top: 0,
    left: 8,
    transform: [{ rotate: "0deg" }],
  },
  actionLine3: {
    top: 5,
    left: 15,
    transform: [{ rotate: "35deg" }],
  },
  titleColumn: {
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sparkleStar: {
    fontSize: 16,
    color: "#EAB308",
    marginLeft: 4,
    marginTop: -8,
  },
  brandSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchRow: {
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  profileCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  viewProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  viewProfileText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  gridCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  gridIconHolder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  gridSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  iconHolder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptySearchWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptySearchText: {
    fontSize: 14,
    marginTop: 10,
  },
});

export default Sidebar;
