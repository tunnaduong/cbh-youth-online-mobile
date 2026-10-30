import React, { useState, useEffect, useRef, memo, useCallback, useContext } from "react";
import { Dimensions, View, Platform, StyleSheet, Animated, Easing, DeviceEventEmitter, TouchableWithoutFeedback, TouchableOpacity, Text } from "react-native";
import Sidebar from "../../components/Sidebar";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import HomeScreen from "./HomeScreen";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./ForumScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatScreen from "./ChatScreen";
import NotificationScreen from "./NotificationScreen";
import ProfileScreen from "./ProfileScreen";
import FastImage from "../../components/FastImage";
import { AvatarFrameWrap } from "../../components/profile/AvatarFrame";
import { useOwnProfileTheme } from "../../utils/ownProfileTheme";
import { AuthContext } from "../../contexts/AuthContext";
import { useUnreadCountsContext } from "../../contexts/UnreadCountsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { LiquidGlassView, AndroidGlassBackdrop, glassTint, androidGlassPerfProps } from "../../components/GlassModules";

const ScreenWrapper = ({ children }) => {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {children}
    </View>
  );
};

const Tab = createBottomTabNavigator();

const ANDROID_ICON_MAP = {
  Home: { focused: "home", outline: "home-outline" },
  Forum: { focused: "people", outline: "people-outline" },
  Chat: { focused: "chatbubble", outline: "chatbubble-outline" },
  Notifications: { focused: "notifications", outline: "notifications-outline" },
};

// Rendered as its own top-level component (not via Tab.Navigator's `tabBar`
// render prop) and driven directly by MainScreens' own `currentRoute` state
// and navigation.
const CustomTabBar = memo(({ activeRouteName, onTabPress, onHomeLongPress, chatUnreadCount, notificationUnreadCount, avatarUrl, username }) => {
  const { theme, isDarkMode, hideTabLabels, liquidGlassEnabled } = useTheme();
  const ownTheme = useOwnProfileTheme(username);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [pillWidth, setPillWidth] = useState(Dimensions.get("window").width - 108);

  const LEFT_ROUTES = ["Home", "Forum", "Chat", "Notifications"];
  const leftRoutes = LEFT_ROUTES.map((name) => ({
    name,
    label: t(`navigation.${name.toLowerCase()}`),
  }));
  const activeLeftIndex = leftRoutes.findIndex((r) => r.name === activeRouteName);

  const buttonWidth = pillWidth / Math.max(1, leftRoutes.length);
  const indicatorTarget = (activeLeftIndex >= 0 ? activeLeftIndex : 0) * buttonWidth;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: indicatorTarget,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [indicatorTarget]);

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 8 : 16;
  const surface = isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.72)";
  const border = isDarkMode ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.07)";
  const indicator = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const activeColor = theme.primary;
  const inactiveColor = isDarkMode ? "#A0A0A0" : "gray";
  const isProfileFocused = activeRouteName === "Profile";
  const opacity = activeLeftIndex >= 0 ? 1 : 0;

  // The pill's real content (sliding indicator + tab buttons, or the "Tôi"
  // avatar/icon) must be actual React children of <LiquidGlassView> - not siblings
  // drawn over an absoluteFill glass layer - both so the library composites
  // them crisply on top instead of also sweeping them into its captured-and-
  // blurred backdrop, and so `interactive` (the touch-following specular
  // "dynamic" glass look) has real touches to react to.
  const NavGlassWrapper = LiquidGlassView ?? View;
  // Glass off: the wrapper becomes a plain flat View, and an elevation
  // shadow on a View clipped by its parent shows through as a dark smudge
  // inside the circle/pill, so no shadow in that mode.
  const flatGlass = !!LiquidGlassView && !liquidGlassEnabled;

  return (
    <View style={{ position: "absolute", bottom: bottomOffset, left: 20, right: 20, flexDirection: "row", alignItems: "center", zIndex: 99 }}>
      {/* Left pill: main tabs */}
      <NavGlassWrapper
        {...(LiquidGlassView ? { variant: "clear", interactive: true, tintColor: glassTint(isDarkMode), borderRadius: 24.5, ...androidGlassPerfProps } : {})}
        renderToHardwareTextureAndroid
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== pillWidth) setPillWidth(w);
        }}
        style={[{
          flex: 1, height: 49, borderRadius: 24.5, marginRight: 12,
          backgroundColor: LiquidGlassView ? "transparent" : surface,
          borderWidth: 1, borderColor: border,
          flexDirection: "row", alignItems: "center",
          elevation: 8, shadowColor: "#000", shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
          overflow: "hidden",
        },
        // Android's `elevation` shadow always renders dark/black and ignores
        // borderRadius clipping, poking a square corner out past this pill's
        // rounded edge against the dark theme background.
        (isDarkMode || flatGlass) && { elevation: 0, shadowOpacity: 0 }]}
      >
        <Animated.View
          renderToHardwareTextureAndroid
          style={{
            position: "absolute", width: buttonWidth, height: 49,
            borderRadius: 24.5, top: 0, left: 0,
            opacity, transform: [{ translateX: slideAnim }],
            backgroundColor: indicator,
          }}
        />
        {leftRoutes.map((route) => {
          const focused = route.name === activeRouteName;
          const color = focused ? activeColor : inactiveColor;
          const icons = ANDROID_ICON_MAP[route.name];
          const iconName = focused ? icons?.focused : icons?.outline;
          const badge = route.name === "Chat" ? chatUnreadCount : (route.name === "Notifications" ? notificationUnreadCount : 0);
          const label = route.label;

          return (
            <TouchableOpacity
              key={route.name}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 }}
              onPress={() => onTabPress(route.name)}
              onLongPress={route.name === "Home" ? onHomeLongPress : undefined}
              delayLongPress={450}
              activeOpacity={0.8}
            >
              <View style={{ position: "relative" }}>
                <Ionicons name={iconName} size={22} color={color} />
                {badge > 0 && (
                  <View style={{
                    position: "absolute", top: -4, right: -8,
                    backgroundColor: "red", borderRadius: 8,
                    minWidth: 14, height: 14, alignItems: "center",
                    justifyContent: "center", paddingHorizontal: 2,
                  }}>
                    <Text style={{ color: "white", fontSize: 9, fontWeight: "bold" }}>
                      {badge > 99 ? "99+" : badge}
                    </Text>
                  </View>
                )}
              </View>
              {!hideTabLabels && (
                <Text style={{ fontSize: 9, color, fontWeight: "bold", marginTop: 2 }}>{label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </NavGlassWrapper>

      {/* Right pill: Me ("Tôi") button */}
      <TouchableOpacity
        onPress={() => onTabPress("Profile")}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: isProfileFocused }}
        accessibilityLabel={t("navigation.profile")}
        style={[{
          width: 53, height: 53, borderRadius: 26.5,
          overflow: "visible",
        },
        isDarkMode && { elevation: 0, shadowOpacity: 0 }]}
      >
        <NavGlassWrapper
          {...(LiquidGlassView ? { variant: "clear", interactive: true, tintColor: glassTint(isDarkMode), borderRadius: 26.5, ...androidGlassPerfProps } : {})}
          style={[{
            width: 53, height: 53, borderRadius: 26.5,
            backgroundColor: LiquidGlassView ? "transparent" : surface,
            borderWidth: 1, borderColor: border,
            alignItems: "center", justifyContent: "center",
            elevation: 8, shadowColor: "#000", shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
            overflow: "visible",
          },
          flatGlass && { elevation: 0, shadowOpacity: 0 }]}
        >
          {isProfileFocused && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: indicator, borderRadius: 26.5 }]}
            />
          )}
          {avatarUrl ? (
            <AvatarFrameWrap
              theme={ownTheme}
              size={42}
              style={{ alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  borderWidth: isProfileFocused ? 2 : 1,
                  borderColor: isProfileFocused ? activeColor : border,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: surface,
                }}
              >
                <FastImage
                  source={{ uri: avatarUrl }}
                  style={{ width: 42, height: 42, borderRadius: 21 }}
                />
              </View>
            </AvatarFrameWrap>
          ) : (
            <Ionicons
              name={isProfileFocused ? "person-circle" : "person-circle-outline"}
              size={42}
              color={isProfileFocused ? activeColor : inactiveColor}
            />
          )}
        </NavGlassWrapper>
      </TouchableOpacity>
    </View>
  );
});

// Returns a tabBarIcon function using SF Symbols on iOS and Material Symbols
// on Android — the native tab bar renders these natively, no icon library needed.
const tabIcon = (sfFilled, sfOutline, materialName) => ({ focused }) =>
  Platform.select({
    ios: { type: "sfSymbol", name: focused ? sfFilled : sfOutline },
    android: { type: "materialSymbol", name: materialName },
  });

// Defined outside MainScreens so its identity is stable across re-renders.
// Re-mounting it would remount the entire Tab.Navigator, causing tab-switch lag.
// react-native-liquid-glassmorphism needs no ancestor provider (each
// LiquidGlassView captures its own backdrop), so this is now a passthrough.
const TabWrapper = ({ children }) => children;

export default function MainScreens({ navigation: stackNavigation }) {
  const insets = useSafeAreaInsets();
  // iOS 26+ keeps react-navigation's native system tab bar (real native
  // UIGlassEffect with the OS's own scroll-collapse behavior, which
  // react-native-liquid-glassmorphism has no equivalent for). Android and
  // iOS < 26 use this app's own custom pill-style bar instead. iPad is
  // excluded from the native-tab-bar path regardless of OS version - on
  // iPadOS's regular-width size class, the system tab bar renders as a
  // plain top bar instead of the floating bottom pill it uses on iPhone
  // (react-navigation/UIKit's own adaptive behavior for wide layouts), so
  // iPad always gets this app's own bar to keep it floating at the bottom
  // like Android and iPhone.
  const isCustomTabBar = Platform.OS === "android" || Platform.isPad || (Platform.OS === "ios" && parseInt(Platform.Version, 10) < 26);
  const [currentRoute, setCurrentRoute] = useState("Home");

  // Opens the full-screen sidebar ("Tôi" / Menu tab) like Facebook
  const openSidebar = useCallback(() => {
    stackNavigation.navigate("MainScreens", { screen: "Profile" });
  }, [stackNavigation]);

  const { chatUnreadCount, notificationUnreadCount } = useUnreadCountsContext();
  const { username, getAvatarUrl } = useContext(AuthContext);
  const avatarUrl = username && getAvatarUrl ? getAvatarUrl(username) : null;
  const homeScreenScrollTriggerRef = useRef(null);
  const forumScrollTriggerRef = useRef(null);
  const chatScrollTriggerRef = useRef(null);
  const notificationScrollTriggerRef = useRef(null);
  const profileScrollTriggerRef = useRef(null);
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const { t } = useTranslation();

  const triggerHomeScrollOrReload = () => {
    if (homeScreenScrollTriggerRef.current) {
      homeScreenScrollTriggerRef.current(Date.now());
    }
  };

  const triggerForumScrollOrReload = () => {
    if (forumScrollTriggerRef.current) {
      forumScrollTriggerRef.current(Date.now());
    }
  };

  const triggerChatScrollOrReload = () => {
    if (chatScrollTriggerRef.current) {
      chatScrollTriggerRef.current(Date.now());
    }
  };

  const triggerNotificationScrollOrReload = () => {
    if (notificationScrollTriggerRef.current) {
      notificationScrollTriggerRef.current(Date.now());
    }
  };

  const triggerProfileScrollOrReload = () => {
    if (profileScrollTriggerRef.current) {
      profileScrollTriggerRef.current(Date.now());
    }
  };

  // Re-tapping the already-active tab scrolls/reloads it instead of
  // navigating (mirrors each Tab.Screen's own `listeners.tabPress` above),
  // since this tab bar is a standalone sibling rather than react-navigation's
  // tabBar render prop and so no longer emits its tabPress events.
  const TAB_RELOAD_TRIGGERS = {
    Home: triggerHomeScrollOrReload,
    Forum: triggerForumScrollOrReload,
    Chat: triggerChatScrollOrReload,
    Notifications: triggerNotificationScrollOrReload,
    Profile: triggerProfileScrollOrReload,
  };
  // Long-pressing the Home button (tab bar or header logo) opens the
  // feedback form - a quick way to report a bug from anywhere.
  const openFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stackNavigation.navigate("FeedbackScreen", { source: "home_long_press" });
  }, [stackNavigation]);

  const handleAndroidTabPress = (routeName) => {
    if (currentRoute === routeName) {
      TAB_RELOAD_TRIGGERS[routeName]?.();
    } else {
      stackNavigation.navigate("MainScreens", { screen: routeName });
    }
  };

  // Add navigation state listener to track current route
  useEffect(() => {
    const unsubscribe = stackNavigation.addListener("state", (e) => {
      const bottomTabState = e.data.state?.routes?.[0]?.state;
      if (bottomTabState) {
        const currentRouteName =
          bottomTabState.routes[bottomTabState.index].name;
        setCurrentRoute(currentRouteName);
      }
    });

    return unsubscribe;
  }, [stackNavigation]);

  const setHomeScrollTrigger = useCallback((triggerFn) => {
    homeScreenScrollTriggerRef.current = triggerFn;
  }, []);
  const setForumScrollTrigger = useCallback((triggerFn) => {
    forumScrollTriggerRef.current = triggerFn;
  }, []);
  const setChatScrollTrigger = useCallback((triggerFn) => {
    chatScrollTriggerRef.current = triggerFn;
  }, []);
  const setNotificationScrollTrigger = useCallback((triggerFn) => {
    notificationScrollTriggerRef.current = triggerFn;
  }, []);
  const setProfileScrollTrigger = useCallback((triggerFn) => {
    profileScrollTriggerRef.current = triggerFn;
  }, []);

  const renderHomeScreen = useCallback((props) => (
    <ScreenWrapper>
      <AndroidGlassBackdrop providerId="Home" style={{ flex: 1 }}>
        <HomeScreen {...props} scrollTriggerRef={setHomeScrollTrigger} />
      </AndroidGlassBackdrop>
    </ScreenWrapper>
  ), [setHomeScrollTrigger]);

  const renderForumScreen = useCallback((props) => (
    <ScreenWrapper>
      <MenuScreen {...props} scrollTriggerRef={setForumScrollTrigger} />
    </ScreenWrapper>
  ), [setForumScrollTrigger]);

  const renderChatScreen = useCallback((props) => (
    <ScreenWrapper>
      <ChatScreen {...props} scrollTriggerRef={setChatScrollTrigger} />
    </ScreenWrapper>
  ), [setChatScrollTrigger]);

  const renderNotificationScreen = useCallback((props) => (
    <ScreenWrapper>
      <NotificationScreen {...props} scrollTriggerRef={setNotificationScrollTrigger} />
    </ScreenWrapper>
  ), [setNotificationScrollTrigger]);

  const renderProfileScreen = useCallback((props) => (
    <ScreenWrapper>
      <AndroidGlassBackdrop providerId="Profile" style={{ flex: 1 }}>
        <Sidebar {...props} isTab scrollTriggerRef={setProfileScrollTrigger} />
      </AndroidGlassBackdrop>
    </ScreenWrapper>
  ), [setProfileScrollTrigger]);

  return (
    <View style={{ flex: 1 }}>
      <TabWrapper>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Tab.Navigator
          // The custom tab bar chrome (Android, and iOS < 26) is rendered
          // separately below as CustomTabBar, a plain sibling in this same
          // return - not through this render prop. iOS 26+ leaves tabBar
          // undefined so react-navigation renders its own native system tab
          // bar (real UIGlassEffect + native scroll-collapse).
          tabBar={isCustomTabBar ? () => null : undefined}
          screenOptions={{
            lazy: true,
            unmountOnBlur: false,
            tabBarShowLabel: !hideTabLabels,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: isDarkMode ? "#EBEBF5" : "#1C1C1E",
            // iOS 15+ native tab bar minimize: shrinks the bar when scrolling
            // down and expands on scroll up (Threads-style), driven natively
            // by each screen's scroll view.
            tabBarMinimizeBehavior: 'onScrollDown',
            headerShadowVisible: false,
            headerTitleAlign: "center",
            headerTitleContainerStyle: {
              marginHorizontal: 0,
              paddingHorizontal: 0,
              width: Dimensions.get("window").width,
              alignItems: "center",
            },
            headerStyle: {
              height: 50 + insets.top,
              backgroundColor: "transparent",
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTransparent: true,
          }}
        >
          <Tab.Screen
            name="Home"
            options={{
              title: t('navigation.home'),
              headerShown: true,
              headerBackButtonMenuEnabled: false,
              tabBarIcon: tabIcon("house.fill", "house", "home"),
              headerTitle: () => (
                <View style={{ width: Dimensions.get("window").width }}>
                  <SameHeader
                    icon="search"
                    action={() => stackNavigation.navigate("SearchScreen")}
                    havingIcon
                    setSetting={openSidebar}
                    onLogoPress={triggerHomeScrollOrReload}
                    onLogoLongPress={openFeedback}
                    providerId="Home"
                  />
                </View>
              ),
            }}
            listeners={{
              tabPress: () => {
                // No preventDefault: native tab bars don't support it. Re-tapping
                // the already-active tab doesn't navigate, so just scroll/reload.
                if (currentRoute === "Home") {
                  triggerHomeScrollOrReload();
                }
              },
            }}
          >
            {renderHomeScreen}
          </Tab.Screen>

          <Tab.Screen
            name="Forum"
            options={{
              title: t('navigation.forum'),
              headerShown: false,
              tabBarIcon: tabIcon("person.2.fill", "person.2", "group"),
            }}
            listeners={{
              tabPress: () => {
                if (currentRoute === "Forum") {
                  triggerForumScrollOrReload();
                }
              },
            }}
          >
            {renderForumScreen}
          </Tab.Screen>

          <Tab.Screen
            name="Chat"
            options={{
              title: t('navigation.chat'),
              headerShown: false,
              tabBarIcon: tabIcon("bubble.left.fill", "bubble.left", "chat_bubble"),
              tabBarBadge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
            }}
            listeners={{
              tabPress: () => {
                if (currentRoute === "Chat") {
                  triggerChatScrollOrReload();
                }
              },
            }}
          >
            {renderChatScreen}
          </Tab.Screen>

          <Tab.Screen
            name="Notifications"
            options={{
              title: t('navigation.notifications'),
              headerShown: false,
              tabBarIcon: tabIcon("bell.fill", "bell", "notifications"),
              tabBarBadge: notificationUnreadCount > 0 ? notificationUnreadCount : undefined,
            }}
            listeners={{
              tabPress: () => {
                if (currentRoute === "Notifications") {
                  triggerNotificationScrollOrReload();
                }
              },
            }}
          >
            {renderNotificationScreen}
          </Tab.Screen>

          <Tab.Screen
            name="Profile"
            options={{
              title: t('navigation.profile'),
              headerShown: false,
              tabBarIcon: tabIcon("person.crop.circle.fill", "person.crop.circle", "person"),
            }}
            listeners={{
              tabPress: () => {
                if (currentRoute === "Profile") {
                  triggerProfileScrollOrReload();
                }
              },
            }}
          >
            {renderProfileScreen}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
      </TabWrapper>

      {isCustomTabBar && (
        <CustomTabBar
          activeRouteName={currentRoute}
          chatUnreadCount={chatUnreadCount}
          notificationUnreadCount={notificationUnreadCount}
          onTabPress={handleAndroidTabPress}
          onHomeLongPress={openFeedback}
          avatarUrl={avatarUrl}
          username={username}
        />
      )}
    </View>
  );
}
