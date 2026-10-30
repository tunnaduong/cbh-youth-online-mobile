import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActionSheetIOS,
  Animated,
  Alert,
  StyleSheet,
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
import LiquidButton from "./LiquidButton";
import { AndroidGlassBackdrop } from "./GlassModules";
import { openInAppBrowser } from "../utils/externalLink";

const MenuRow = ({
  icon,
  title,
  subtitle,
  onPress,
  onLongPress,
  delayLongPress,
  destructive = false,
  last = false,
  theme,
}) => (
  <TouchableOpacity
    style={[
      styles.menuRow,
      !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    ]}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={delayLongPress}
    activeOpacity={0.7}
  >
    <View
      style={[
        styles.iconHolder,
        {
          backgroundColor: destructive
            ? theme.isDarkMode
              ? "rgba(255,59,48,0.15)"
              : "#FDE8E8"
            : theme.iconBackground,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? "#FF3B30" : theme.primary}
      />
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

const MenuSection = ({ title, children, theme }) => {
  const childrenArray = React.Children.toArray(children).filter(Boolean);
  if (childrenArray.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.subText }]}>
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            last: index === childrenArray.length - 1,
            theme,
          })
        )}
      </View>
    </View>
  );
};

const Sidebar = ({ providerId = "Profile", isOpen = true, isTab = true, scrollTriggerRef = null }) => {
  const { signOut, username, profileName, userInfo } = useContext(AuthContext);
  const ownTheme = useOwnProfileTheme(username, isTab || !!isOpen);
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isCustomTabBar = Platform.OS === "android" || Platform.isPad || (Platform.OS === "ios" && parseInt(Platform.Version, 10) < 26);

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      });
    }
  }, [scrollTriggerRef]);

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

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating transparent header with fading title and liquid settings button */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 8,
            paddingTop: insets.top,
            height: 64 + insets.top,
          }}
        >
          {/* 44px spacer on left to balance right button */}
          <View style={{ width: 44 }} />

          {/* Title fades out as content scrolls under header */}
          <Animated.Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "600",
              color: theme.primary,
              opacity: headerTitleOpacity,
            }}
          >
            {t("sidebar.menu", t("navigation.profile"))}
          </Animated.Text>

          {/* Quick Settings LiquidButton on top-right */}
          <LiquidButton
            size={44}
            scrollY={scrollY}
            providerId={providerId}
            onPress={() => navigation.navigate("Settings")}
            accessibilityLabel={t("settings.title")}
          >
            <Ionicons name="settings-outline" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      </View>

      <AndroidGlassBackdrop providerId={providerId} style={{ flex: 1 }}>
        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 64 + insets.top,
            paddingBottom: isCustomTabBar ? 110 : 80 + insets.bottom,
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Facebook-style Profile Card */}
          <TouchableOpacity
            style={[
              styles.profileCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
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
              <Text
                style={{
                  fontSize: 13,
                  color: theme.primary,
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                {t("sidebar.viewProfile")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </TouchableOpacity>

          {/* Account switcher card */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                marginBottom: 20,
              },
            ]}
          >
            <AccountSwitcher />
          </View>

          {/* Section: Utilities */}
          <MenuSection title={t("sidebar.utilities")} theme={theme}>
            <MenuRow
              icon="newspaper-outline"
              title={t("sidebar.feed")}
              onPress={() => navigation.navigate("MainScreens", { screen: "Home" })}
            />
            <MenuRow
              icon="people-outline"
              title={t("navigation.forum")}
              onPress={() => navigation.navigate("MainScreens", { screen: "Forum" })}
            />
            <MenuRow
              icon="gift-outline"
              title={t("sidebar.giftShop")}
              onPress={() => navigation.navigate("GiftShopScreen")}
            />
            <MenuRow
              icon="wallet-outline"
              title={t("sidebar.pointWallet")}
              onPress={() => navigation.navigate("PointWalletScreen")}
            />
            <MenuRow
              icon="compass-outline"
              title={t("sidebar.explore")}
              onPress={() => navigation.navigate("ExploreScreen")}
            />
            <MenuRow
              icon="bookmark-outline"
              title={t("sidebar.saved")}
              onPress={() => navigation.navigate("SavedPostsScreen")}
            />
            <MenuRow
              icon="megaphone-outline"
              title={t("sidebar.youthUnionNews")}
              onPress={() => navigation.navigate("CategoryScreen", { categoryId: 32 })}
            />
            <MenuRow
              icon="trophy-outline"
              title={t("sidebar.memberRanking")}
              onPress={() => navigation.navigate("MemberRankingScreen")}
            />
            {userInfo?.role === "admin" && (
              <MenuRow
                icon="shield-checkmark-outline"
                title={t("sidebar.admin")}
                onPress={() => navigation.navigate("AdminWebScreen")}
              />
            )}
          </MenuSection>

          {/* Section: Reports */}
          <MenuSection title={t("sidebar.reports")} theme={theme}>
            <MenuRow
              icon="alert-circle-outline"
              title={t("sidebar.studentViolation")}
              onPress={() => navigation.navigate("ReportScreen", { type: "student" })}
            />
            <MenuRow
              icon="warning-outline"
              title={t("sidebar.classViolation")}
              onPress={() => navigation.navigate("ReportScreen", { type: "class" })}
            />
          </MenuSection>

          {/* Section: Support */}
          <MenuSection title={t("sidebar.support")} theme={theme}>
            <MenuRow
              icon="information-circle-outline"
              title={t("sidebar.about")}
              onPress={() => navigation.navigate("AboutScreen")}
              onLongPress={() => navigation.navigate("EasterEggScreen")}
              delayLongPress={500}
            />
            <MenuRow
              icon="help-circle-outline"
              title={t("sidebar.help")}
              onPress={() => openInAppBrowser("https://www.chuyenbienhoa.com/help", theme)}
            />
            <MenuRow
              icon="bug-outline"
              title={t("sidebar.reportIssue")}
              onPress={() => navigation.navigate("FeedbackScreen", { source: "sidebar" })}
            />
            <MenuRow
              icon="shield-outline"
              title={t("sidebar.privacy")}
              onPress={() => navigation.navigate("PrivacyPolicyScreen")}
            />
            <MenuRow
              icon="document-text-outline"
              title={t("sidebar.terms")}
              onPress={() => navigation.navigate("TermsOfServiceScreen")}
            />
          </MenuSection>

          {/* Section: Settings & Account */}
          <MenuSection title={t("sidebar.settingsGroup")} theme={theme}>
            <MenuRow
              icon="settings-outline"
              title={t("settings.title")}
              onPress={() => navigation.navigate("Settings")}
            />
            <MenuRow
              icon="log-out-outline"
              title={t("settings.logout")}
              destructive
              onPress={handleLogout}
            />
          </MenuSection>
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  iconHolder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default Sidebar;
