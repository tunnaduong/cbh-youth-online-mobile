import React, { useState, useEffect, useRef, memo, useCallback, useContext, useMemo } from "react";
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
import { AndroidGlassBackdrop } from "../../components/GlassModules";
import LiquidTabBar from "../../components/LiquidTabBar";
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
const TAB_ROUTES = ["Home", "Explore", "Chat", "Notifications", "Profile"];

// Rendered as its own top-level component (not via Tab.Navigator's `tabBar`
// render prop) and driven directly by MainScreens' own `currentRoute` state
// and navigation.
const CustomTabBar = memo(({ activeRouteName, onTabPress, onHomeLongPress, onProfileLongPress, chatUnreadCount, notificationUnreadCount, avatarUrl, username }) => {
  const { isDarkMode } = useTheme();
  const ownTheme = useOwnProfileTheme(username);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 4 : 16;
  const avatarBg = isDarkMode ? "rgba(22, 22, 26, 0.86)" : "rgba(255, 255, 255, 0.86)";

  // LiquidTabBar draws the glass capsule, the draggable selection pill and
  // the tabs; this only describes each tab's icon. `render` is called for
  // both looks (focused / not) because the bar cross-fades them as the pill
  // passes over - so the icon must not depend on which route is current.
  const items = useMemo(
    () =>
      TAB_ROUTES.map((name) => {
        const icons = ANDROID_ICON_MAP[name];
        return {
          key: name,
          label: t(`navigation.${name.toLowerCase()}`),
          badge:
            name === "Chat" ? chatUnreadCount : name === "Notifications" ? notificationUnreadCount : 0,
          onLongPress:
            name === "Home" ? onHomeLongPress : name === "Profile" ? onProfileLongPress : undefined,
          render: ({ focused, color }) => {
            if (name === "Profile") {
              if (!avatarUrl) {
                return <Ionicons name={focused ? "person" : "person-outline"} size={25} color={color} />;
              }
              return (
                <AvatarFrameWrap theme={ownTheme} size={28} style={{ alignItems: "center", justifyContent: "center" }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      borderWidth: focused ? 2 : 1,
                      borderColor: focused ? color : isDarkMode ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.14)",
                      overflow: "hidden",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: avatarBg,
                    }}
                  >
                    <FastImage source={{ uri: avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                  </View>
                </AvatarFrameWrap>
              );
            }
            return (
              <Ionicons
                name={focused ? icons?.focused : icons?.outline}
                size={name === "Chat" ? 24 : 25}
                color={color}
              />
            );
          },
        };
      }),
    [t, chatUnreadCount, notificationUnreadCount, onHomeLongPress, onProfileLongPress, avatarUrl, ownTheme, isDarkMode, avatarBg]
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", bottom: bottomOffset, left: 20, right: 20, zIndex: 99 }}
    >
      <LiquidTabBar
        items={items}
        activeKey={activeRouteName}
        onSelect={onTabPress}
        height={TAB_BAR_HEIGHT}
        radius={TAB_BAR_RADIUS}
        inset={TAB_BAR_INSET}
      />
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
