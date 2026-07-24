import React, { useState, useEffect, useRef, memo } from "react";
import { Dimensions, View, Platform, StyleSheet, Animated, Easing, DeviceEventEmitter, TouchableWithoutFeedback, TouchableOpacity, Text } from "react-native";
import Sidebar from "../../components/Sidebar";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "./HomeScreen";
import CustomTabBarButton from "../../components/CustomTabBarButton";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./ForumScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatScreen from "./ChatScreen";
import NotificationScreen from "./NotificationScreen";
import { useUnreadCountsContext } from "../../contexts/UnreadCountsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import {
  LiquidGlassProviderAndroid,
  LiquidGlassViewAndroid,
  useAndroidGlass,
  isLiquidGlassSupportedAndroid,
} from "../../components/GlassModules";

const ScreenWrapper = ({ children }) => {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {children}
    </View>
  );
};

const TabWrapper = ({ children }) => {
  if (Platform.OS === "android" && LiquidGlassProviderAndroid) {
    return (
      <LiquidGlassProviderAndroid providerId="main" style={{ flex: 1 }}>
        {children}
      </LiquidGlassProviderAndroid>
    );
  }
  return children;
};

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

const ANDROID_ICON_MAP = {
  Home: { focused: "home", outline: "home-outline" },
  Forum: { focused: "people", outline: "people-outline" },
  Chat: { focused: "chatbubble", outline: "chatbubble-outline" },
  Notifications: { focused: "notifications", outline: "notifications-outline" },
};

const AndroidTabBar = memo(({ state, descriptors, navigation, chatUnreadCount, notificationUnreadCount, stackNavigation }) => {
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [pillWidth, setPillWidth] = useState(Dimensions.get("window").width - 108);

  const LEFT_ROUTES = ["Home", "Forum", "Chat", "Notifications"];
  const leftRoutes = state.routes.filter((r) => LEFT_ROUTES.includes(r.name));
  const activeRouteName = state.routes[state.index]?.name;
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
  const opacity = activeRouteName === "Create" ? 0 : 1;

  const glassProps = Platform.Version >= 33 ? {
    blurRadius: 12,
    refractionAmount: 40,
    refractionHeight: 18,
    chromaticAberration: 0.2,
    highlightAlpha: 0.25,
    tint: isDarkMode ? "rgba(0, 0, 0, 0.3)" : "rgba(240, 240, 240, 0.2)",
  } : {
    blurRadius: 10,
    refractionAmount: 0,
    refractionHeight: 0,
    chromaticAberration: 0,
    highlightAlpha: 0.18,
    tint: isDarkMode ? "rgba(0, 0, 0, 0.25)" : "rgba(240, 240, 240, 0.15)",
  };

  const PillBackground = ({ style }) => (
    <View style={[StyleSheet.absoluteFill, {
      borderRadius: 24.5, overflow: "hidden",
      backgroundColor: useAndroidGlass ? "transparent" : surface,
      borderWidth: 1, borderColor: border,
    }, style]}>
      {useAndroidGlass && LiquidGlassViewAndroid && (
        <LiquidGlassViewAndroid
          providerId="main"
          interactive={isLiquidGlassSupportedAndroid}
          {...glassProps}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );

  return (
    <View style={{ position: "absolute", bottom: bottomOffset, left: 20, right: 20, flexDirection: "row", alignItems: "center", zIndex: 99 }}>
      {/* Left pill: main tabs */}
      <View
        renderToHardwareTextureAndroid
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== pillWidth) setPillWidth(w);
        }}
        style={{
          flex: 1, height: 49, borderRadius: 24.5, marginRight: 12,
          backgroundColor: "transparent",
          flexDirection: "row", alignItems: "center",
          elevation: 8, shadowColor: "#000", shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
          overflow: "hidden",
        }}
      >
        <PillBackground />
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
          const label = descriptors[route.key]?.options?.title || route.name;

          return (
            <TouchableOpacity
              key={route.key}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
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
      </View>

      {/* Right pill: create button */}
      <TouchableOpacity
        onPress={() => stackNavigation.navigate("CreatePostScreen")}
        activeOpacity={0.8}
        style={{
          width: 53, height: 53, borderRadius: 26.5,
          backgroundColor: "transparent",
          elevation: 8, alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
          overflow: "hidden",
        }}
      >
        <PillBackground style={{ borderRadius: 26.5 }} />
        <Ionicons name="add" size={28} color={activeColor} />
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

// Approximate content height of the native bottom tab bar (excludes the
// safe-area bottom inset, which the OS adds on top of this). Used to anchor
// the create menu just above the tab bar — react-navigation v8's native
// bottom tabs don't yet expose a reliable useBottomTabBarHeight() for this.
const NATIVE_TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

export default function MainScreens({ navigation: stackNavigation }) {
  const [setting, setSetting] = useState(false);
  const insets = useSafeAreaInsets();
  const [currentRoute, setCurrentRoute] = useState("Home");
  const drawerTranslateX = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(drawerTranslateX, {
      toValue: setting ? 0 : -Dimensions.get('window').width,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(backdropOpacity, {
      toValue: setting ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [setting, drawerTranslateX, backdropOpacity]);

  const { chatUnreadCount, notificationUnreadCount } = useUnreadCountsContext();
  const createMenuRef = useRef(null);
  const homeScreenScrollTriggerRef = useRef(null);
  const forumScrollTriggerRef = useRef(null);
  const chatScrollTriggerRef = useRef(null);
  const notificationScrollTriggerRef = useRef(null);
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


  const createButtonBottomOffset = insets.bottom + NATIVE_TAB_BAR_CONTENT_HEIGHT + 8;

  return (
    <View style={{ flex: 1 }}>
      <TabWrapper>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Tab.Navigator
          tabBar={Platform.OS === "android" ? (props) => (
            <AndroidTabBar
              {...props}
              chatUnreadCount={chatUnreadCount}
              notificationUnreadCount={notificationUnreadCount}
              stackNavigation={stackNavigation}
            />
          ) : undefined}
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
                    setSetting={setSetting}
                    onLogoPress={triggerHomeScrollOrReload}
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
            {(props) => (
              <ScreenWrapper>
                <HomeScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    homeScreenScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
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
            {(props) => (
              <ScreenWrapper>
                <MenuScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    forumScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Create"
            component={DummyComponent}
            options={{
              title: t('navigation.create'),
              headerShown: false,
              tabBarIcon: tabIcon("plus", "plus", "add"),
              // Native tab bars don't allow preventDefault on tabPress; this
              // stops the tab from ever being selected so tapping just opens
              // the create menu instead of navigating to the dummy screen.
              tabBarSelectionEnabled: false,
            }}
            listeners={{
              tabPress: () => {
                stackNavigation.navigate("CreatePostScreen")
              },
            }}
          />

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
            {(props) => (
              <ScreenWrapper>
                <ChatScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    chatScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
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
            {(props) => (
              <ScreenWrapper>
                <NotificationScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    notificationScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
      </TabWrapper>

      {/* Create menu. The "+" lives in the native center tab ("Tạo"); tapping
          it opens this glass menu via the ref instead of navigating. */}
      <CustomTabBarButton
        ref={createMenuRef}
        showButton={false}
        bottomOffset={createButtonBottomOffset}
        currentRoute={currentRoute}
      />

      {/* Overlay Backdrop */}
      <TouchableWithoutFeedback onPress={() => setSetting(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, opacity: backdropOpacity }]} pointerEvents={setting ? "auto" : "none"} />
      </TouchableWithoutFeedback>

      {/* Floating Sidebar Content */}
      <Animated.View style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        width: Dimensions.get('window').width * 0.75,
        zIndex: 101,
        transform: [{ translateX: drawerTranslateX }]
      }}>
        <Sidebar providerId={currentRoute} isOpen={setting} />
      </Animated.View>
    </View>
  );
}
