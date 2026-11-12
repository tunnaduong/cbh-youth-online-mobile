import React, { useState, useEffect, useRef, memo, useCallback, useContext } from "react";
import { Dimensions, View, Platform, StyleSheet, Animated, Easing, DeviceEventEmitter, TouchableWithoutFeedback, TouchableOpacity, Text } from "react-native";
import Sidebar from "../../components/Sidebar";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import HomeScreen from "./HomeScreen";
import SameHeader from "../../components/SameHeader";
import ExploreScreen from "./ExploreScreen";
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
import { markAllNotificationsAsRead } from "../../services/api/Api";
import AccountSwitcherModal from "../../components/AccountSwitcherModal";
import { NativeEventEmitter, NativeModules } from "react-native";

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
  Explore: { focused: "compass", outline: "compass-outline" },
  Chat: { focused: "chatbubble", outline: "chatbubble-outline" },
  Notifications: { focused: "notifications", outline: "notifications-outline" },
};

const TAB_BAR_HEIGHT = 58;
const TAB_BAR_RADIUS = 29;
const TAB_BAR_INSET = 5;
const TAB_PILL_HEIGHT = TAB_BAR_HEIGHT - TAB_BAR_INSET * 2;
const TAB_PILL_RADIUS = TAB_PILL_HEIGHT / 2;
const TAB_ROUTES = ["Home", "Explore", "Chat", "Notifications", "Profile"];
const IS_IOS_26_PLUS = Platform.OS === "ios" && parseInt(Platform.Version, 10) >= 26;

// Rendered as its own top-level component (not via Tab.Navigator's `tabBar`
// render prop) and driven directly by MainScreens' own `currentRoute` state
// and navigation.
const CustomTabBar = memo(({ activeRouteName, onTabPress, onHomeLongPress, onProfileLongPress, chatUnreadCount, notificationUnreadCount, avatarUrl, username }) => {
  const { isDarkMode, liquidGlassEnabled } = useTheme();
  const ownTheme = useOwnProfileTheme(username);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const hasMeasuredRef = useRef(false);
  const [pillWidth, setPillWidth] = useState(Dimensions.get("window").width - 40);

  const routes = TAB_ROUTES.map((name) => ({
    name,
    label: t(`navigation.${name.toLowerCase()}`),
  }));
  const activeIndex = Math.max(0, routes.findIndex((r) => r.name === activeRouteName));

  const innerTrackWidth = Math.max(0, pillWidth - TAB_BAR_INSET * 2);
  const slotWidth = innerTrackWidth / routes.length;
  const indicatorTarget = activeIndex * slotWidth;

  useEffect(() => {
    if (!hasMeasuredRef.current) {
      slideAnim.setValue(indicatorTarget);
      hasMeasuredRef.current = true;
      return;
    }
    Animated.spring(slideAnim, {
      toValue: indicatorTarget,
      damping: 24,
      stiffness: 280,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [indicatorTarget, slideAnim]);

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 4 : 16;
  const surface = isDarkMode ? "rgba(22, 22, 26, 0.86)" : "rgba(255, 255, 255, 0.86)";
  const border = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.07)";
  const indicatorColor = isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.075)";
  const activeColor = isDarkMode ? "#FFFFFF" : "#111827";
  const inactiveColor = isDarkMode ? "rgba(255, 255, 255, 0.72)" : "rgba(17, 24, 39, 0.78)";

  // The pill's real content (sliding indicator + tab buttons) must be actual
  // React children of <LiquidGlassView> - not siblings drawn over an
  // absoluteFill glass layer - both so the library composites them crisply on
  // top and so `interactive` (the touch-following specular iOS 26 liquid glass)
  // has real touches to react to.
  const NavGlassWrapper = LiquidGlassView ?? View;
  const flatGlass = !!LiquidGlassView && !liquidGlassEnabled;
  const useNativeIos26Glass = IS_IOS_26_PLUS && !!LiquidGlassView && liquidGlassEnabled;
  const tabGlassTint = useNativeIos26Glass
    ? isDarkMode
      ? "rgba(18, 18, 22, 0.28)"
      : "rgba(255, 255, 255, 0.22)"
    : glassTint(isDarkMode);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 20,
        right: 20,
        zIndex: 99,
      }}
    >
      <NavGlassWrapper
        {...(LiquidGlassView
          ? {
              variant: "regular",
              interactive: true,
              tintColor: tabGlassTint,
              borderRadius: TAB_BAR_RADIUS,
              ...androidGlassPerfProps,
            }
          : {})}
        renderToHardwareTextureAndroid
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== pillWidth) setPillWidth(w);
        }}
        style={[
          {
            height: TAB_BAR_HEIGHT,
            borderRadius: TAB_BAR_RADIUS,
            paddingHorizontal: TAB_BAR_INSET,
            backgroundColor: LiquidGlassView ? "transparent" : surface,
            borderWidth: useNativeIos26Glass ? 0 : 1,
            borderColor: border,
            flexDirection: "row",
            alignItems: "center",
            elevation: 10,
            shadowColor: "#000",
            shadowOpacity: isDarkMode ? 0.32 : 0.12,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 16,
            overflow: useNativeIos26Glass ? "visible" : "hidden",
          },
          // Android's `elevation` shadow always renders dark/black and ignores
          // borderRadius clipping, poking a square corner out past this pill's
          // rounded edge against the dark theme background.
          ((Platform.OS === "android" && isDarkMode) || flatGlass) && {
            elevation: 0,
            shadowOpacity: 0,
          },
        ]}
      >
        {/* Inset sliding capsule pill behind the active tab (iOS 26 / Threads / Instagram style) */}
        {slotWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            renderToHardwareTextureAndroid
            style={{
              position: "absolute",
              width: slotWidth,
              height: TAB_PILL_HEIGHT,
              borderRadius: TAB_PILL_RADIUS,
              top: TAB_BAR_INSET,
              left: TAB_BAR_INSET,
              transform: [{ translateX: slideAnim }],
              backgroundColor: indicatorColor,
            }}
          />
        )}

        {routes.map((route) => {
          const focused = route.name === activeRouteName;
          const color = focused ? activeColor : inactiveColor;
          const isProfile = route.name === "Profile";
          const icons = ANDROID_ICON_MAP[route.name];
          const iconName = focused ? icons?.focused : icons?.outline;
          const badge =
            route.name === "Chat"
              ? chatUnreadCount
              : route.name === "Notifications"
              ? notificationUnreadCount
              : 0;

          return (
            <TouchableOpacity
              key={route.name}
              style={{
                flex: 1,
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => onTabPress(route.name)}
              onLongPress={
                route.name === "Home"
                  ? onHomeLongPress
                  : isProfile
                  ? onProfileLongPress
                  : undefined
              }
              delayLongPress={450}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={route.label}
            >
              {isProfile ? (
                avatarUrl ? (
                  <AvatarFrameWrap
                    theme={ownTheme}
                    size={28}
                    style={{ alignItems: "center", justifyContent: "center" }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderWidth: focused ? 2 : 1,
                        borderColor: focused
                          ? activeColor
                          : isDarkMode
                          ? "rgba(255, 255, 255, 0.25)"
                          : "rgba(0, 0, 0, 0.14)",
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: surface,
                      }}
                    >
                      <FastImage
                        source={{ uri: avatarUrl }}
                        style={{ width: 28, height: 28, borderRadius: 14 }}
                      />
                    </View>
                  </AvatarFrameWrap>
                ) : (
                  <Ionicons
                    name={focused ? "person" : "person-outline"}
                    size={25}
                    color={color}
                  />
                )
              ) : (
                <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons
                    name={iconName}
                    size={route.name === "Chat" ? 24 : 25}
                    color={color}
                  />
                  {badge > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        top: -5,
                        right: -9,
                        backgroundColor: "#FF3B30",
                        borderRadius: 9,
                        minWidth: 17,
                        height: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 3.5,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? "#1E1E24" : "#FFFFFF",
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 9.5,
                          fontWeight: "700",
                          lineHeight: 12,
                        }}
                      >
                        {badge > 99 ? "99+" : badge}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </NavGlassWrapper>
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
  // CustomTabBar (built with LiquidGlassView pill) is used on Android, iPad,
  // and iOS to guarantee long-press events (Home -> Report, Profile -> Account Switcher)
  // and maintain a consistent liquid glass UI across all platforms.
  const isCustomTabBar = true;
  const [currentRoute, setCurrentRoute] = useState("Home");

  // Opens the forum screen from the HomeScreen top-left button
  const openForum = useCallback(() => {
    stackNavigation.navigate("ForumScreen");
  }, [stackNavigation]);

  const { chatUnreadCount, notificationUnreadCount, setNotificationUnreadCount } = useUnreadCountsContext();
  const { username, userInfo, getAvatarUrl } = useContext(AuthContext);
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const avatarUrl = username && getAvatarUrl ? getAvatarUrl(username) : null;
  const homeScreenScrollTriggerRef = useRef(null);
  const exploreScrollTriggerRef = useRef(null);
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

  const triggerExploreScrollOrReload = () => {
    if (exploreScrollTriggerRef.current) {
      exploreScrollTriggerRef.current(Date.now());
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
    Explore: triggerExploreScrollOrReload,
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

  const openAccountSwitcher = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAccountSwitcherVisible(true);
  }, []);

  // Native iOS 26+ tab bar long press listener from Swift native module
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const { CBHTabBarLongPressManager } = NativeModules;
    if (!CBHTabBarLongPressManager) return;

    const eventEmitter = new NativeEventEmitter(CBHTabBarLongPressManager);
    const subscription = eventEmitter.addListener("onTabBarLongPress", (event) => {
      if (event?.routeName === "Home" || event?.index === 0) {
        openFeedback();
      } else if (event?.routeName === "Profile" || event?.index === 4) {
        openAccountSwitcher();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [openFeedback, openAccountSwitcher]);

  const handleAndroidTabPress = (routeName) => {
    if (routeName === "Notifications") {
      setNotificationUnreadCount(0);
      markAllNotificationsAsRead().catch(() => {});
    }
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

  const setHomeScreenScrollTrigger = useCallback((triggerFn) => {
    homeScreenScrollTriggerRef.current = triggerFn;
  }, []);
  const setExploreScrollTrigger = useCallback((triggerFn) => {
    exploreScrollTriggerRef.current = triggerFn;
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
        <HomeScreen {...props} scrollTriggerRef={setHomeScreenScrollTrigger} />
      </AndroidGlassBackdrop>
    </ScreenWrapper>
  ), [setHomeScreenScrollTrigger]);

  const renderExploreScreen = useCallback((props) => (
    <ScreenWrapper>
      <ExploreScreen {...props} isTab={true} scrollTriggerRef={setExploreScrollTrigger} />
    </ScreenWrapper>
  ), [setExploreScrollTrigger]);

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
              headerShown: false,
              tabBarIcon: tabIcon("house.fill", "house", "home"),
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
            name="Explore"
            options={{
              title: t('navigation.explore', 'Khám phá'),
              headerShown: false,
              tabBarIcon: tabIcon("safari.fill", "safari", "explore"),
            }}
            listeners={{
              tabPress: () => {
                if (currentRoute === "Explore") {
                  triggerExploreScrollOrReload();
                }
              },
            }}
          >
            {renderExploreScreen}
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
                setNotificationUnreadCount(0);
                markAllNotificationsAsRead().catch(() => {});
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
          onProfileLongPress={openAccountSwitcher}
          avatarUrl={avatarUrl}
          username={username}
        />
      )}

      <AccountSwitcherModal
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
        currentUserId={userInfo?.id}
      />
    </View>
  );
}
