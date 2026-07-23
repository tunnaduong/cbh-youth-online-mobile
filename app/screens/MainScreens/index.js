import React, { useState, useEffect, useRef } from "react";
import { Dimensions, View, Platform, StyleSheet, Animated, DeviceEventEmitter, TouchableWithoutFeedback } from "react-native";
import Sidebar from "../../components/Sidebar";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import { LiquidGlassProviderAndroid } from "../../components/GlassModules";

const ScreenWrapper = ({ children, routeName }) => {
  const { theme } = useTheme();

  if (Platform.OS === 'android' && LiquidGlassProviderAndroid) {
    // Use a stable provider ID per route so Android LiquidGlassViewAndroid
    // children can resolve to the correct provider without breaking glass.
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <LiquidGlassProviderAndroid
          providerId={routeName}
          style={StyleSheet.absoluteFill}
        >
          <View style={{ flex: 1, backgroundColor: theme.background }}>
            {children}
          </View>
        </LiquidGlassProviderAndroid>
      </View>
    );
  }
  return children;
};

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

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
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Tab.Navigator
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
              <ScreenWrapper routeName="Home">
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
              <ScreenWrapper routeName="Forum">
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
              <ScreenWrapper routeName="Chat">
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
              <ScreenWrapper routeName="Notifications">
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
