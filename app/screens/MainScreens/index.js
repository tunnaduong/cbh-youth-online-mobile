import React, { useState, useEffect, useRef } from "react";
import { Dimensions, View, Platform, StyleSheet, Text, TouchableOpacity, Animated, DeviceEventEmitter } from "react-native";
import { createBottomTabNavigator, BottomTabBar } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./HomeScreen";
import CustomTabBarButton from "../../components/CustomTabBarButton";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./ForumScreen";
import SideMenu from "@chakrahq/react-native-side-menu";
import Sidebar from "../../components/Sidebar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatScreen from "./ChatScreen";
import NotificationScreen from "./NotificationScreen";
import { useUnreadCountsContext } from "../../contexts/UnreadCountsContext";
import TabBarBadge from "../../components/TabBarBadge";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

const TabBarBackgroundComponent = ({ currentRoute, isDarkMode, hideTabLabels, theme }) => {
  const [tabBarWidth, setTabBarWidth] = useState(Dimensions.get("window").width - 110);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const onLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width) {
      setTabBarWidth(width);
    }
  };

  const getRouteIndex = (routeName) => {
    switch (routeName) {
      case "Home": return 0;
      case "Forum": return 1;
      case "Create": return 2;
      case "Chat": return 3;
      case "Notifications": return 4;
      default: return 0;
    }
  };

  const activeIndex = getRouteIndex(currentRoute);
  const usableWidth = tabBarWidth - 16;
  const buttonWidth = usableWidth / 5;
  const indicatorWidth = buttonWidth;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex * buttonWidth,
      useNativeDriver: true,
      stiffness: 140,
      damping: 14,
      mass: 1.2,
    }).start();
  }, [activeIndex, buttonWidth]);

  const opacity = activeIndex === 2 ? 0 : 1;

  return (
    <View
      onLayout={onLayout}
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 26,
        overflow: "hidden",
        backgroundColor: isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.72)",
        borderWidth: 1,
        borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Chromatic Aberration - Red channel shift (left offset) */}
      <Animated.View
        style={{
          position: "absolute",
          width: indicatorWidth,
          height: 52,
          borderRadius: 26,
          top: 0,
          left: 7.2,
          opacity: opacity * 0.35,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(255, 60, 60, 0.06)" : "rgba(255, 60, 60, 0.22)",
        }}
      />
      {/* Chromatic Aberration - Blue channel shift (right offset) */}
      <Animated.View
        style={{
          position: "absolute",
          width: indicatorWidth,
          height: 52,
          borderRadius: 26,
          top: 0,
          left: 8.8,
          opacity: opacity * 0.35,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(60, 160, 255, 0.06)" : "rgba(60, 160, 255, 0.22)",
        }}
      />
      {/* Main Glass Indicator (neutral white/dark) */}
      <Animated.View
        style={{
          position: "absolute",
          width: indicatorWidth,
          height: 52,
          borderRadius: 26,
          top: 0,
          left: 8,
          opacity,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)",
          shadowColor: isDarkMode ? "#fff" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.3 : 0.15,
          shadowRadius: 6,
          elevation: 3,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={[
            isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.5)",
            isDarkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.15)",
            "transparent"
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

export default function MainScreens({ navigation: stackNavigation }) {
  const [setting, setSetting] = React.useState(false);
  const insets = useSafeAreaInsets();
  const [currentRoute, setCurrentRoute] = useState("Home");
  const tabBarHeightRef = useRef(null);
  const { chatUnreadCount, notificationUnreadCount } = useUnreadCountsContext();
  const tabNavigatorRef = useRef(null);
  const homeScreenScrollTriggerRef = useRef(null);
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const { t } = useTranslation();

  // Function to trigger scroll to top or reload in HomeScreen
  const triggerHomeScrollOrReload = () => {
    // Trigger the action using a timestamp param
    // The HomeScreen will listen for this param change
    if (homeScreenScrollTriggerRef.current) {
      homeScreenScrollTriggerRef.current(Date.now());
    }
  };

  // This will be used to measure the tab bar height
  const onTabBarLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    tabBarHeightRef.current = height;
  };

  // Add navigation state listener to track current route
  useEffect(() => {
    const unsubscribe = stackNavigation.addListener("state", (e) => {
      // Get the state of the bottom tab navigator
      const bottomTabState = e.data.state?.routes?.[0]?.state;
      if (bottomTabState) {
        const currentRouteName =
          bottomTabState.routes[bottomTabState.index].name;
        setCurrentRoute(currentRouteName);
      }
    });

    return unsubscribe;
  }, [stackNavigation]);

  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  // Listen for scroll events to auto hide/show tab bar
  useEffect(() => {
    let isVisible = true;
    const subscription = DeviceEventEmitter.addListener("SET_TABBAR_VISIBLE", (visible) => {
      if (visible === isVisible) return;
      isVisible = visible;
      Animated.timing(tabBarTranslateY, {
        toValue: visible ? 0 : 100, // Translate down by 100px to hide
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Reset tab bar visibility to true when switching tabs
    DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
  }, [currentRoute]);

  return (
    <SideMenu
      menu={<Sidebar />}
      menuPosition="left"
      isOpen={setting}
      onChange={(isOpen) => setSetting(isOpen)}
      edgeHitWidth={100}
      bounceBackOnOverdraw={false}
      disableGestures={currentRoute !== "Home"}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Tab.Navigator
          ref={tabNavigatorRef}
          tabBar={(props) => (
            <Animated.View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                transform: [{ translateY: tabBarTranslateY }],
                zIndex: 99,
              }}
            >
              <BottomTabBar {...props} />
            </Animated.View>
          )}
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              let badgeCount = null;

              if (route.name === "Home") {
                iconName = focused ? "home" : "home-outline";
              } else if (route.name === "Forum") {
                iconName = focused ? "people" : "people-outline";
              } else if (route.name === "Notifications") {
                iconName = focused ? "notifications" : "notifications-outline";
                badgeCount = notificationUnreadCount;
              } else if (route.name === "Chat") {
                iconName = focused ? "chatbubble" : "chatbubble-outline";
                badgeCount = chatUnreadCount;
              }

              return (
                <View style={{ position: "relative" }}>
                  <Ionicons name={iconName} size={size} color={color} />
                  {badgeCount !== null && <TabBarBadge count={badgeCount} />}
                </View>
              );
            },
            tabBarShowLabel: !hideTabLabels,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: isDarkMode ? "#A0A0A0" : "gray",
            tabBarButton: (props) => {
              if (route.name === "Create") {
                return props.children;
              }
              const { children, style, onPress, onLongPress } = props;
              return (
                <TouchableOpacity
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={[
                    style,
                    {
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                      paddingVertical: 3,
                      paddingHorizontal: 10,
                      minWidth: 46,
                    }}
                  >
                    {children}
                  </View>
                </TouchableOpacity>
              );
            },
            tabBarStyle: {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 12 : 5,
              left: 55,
              right: 55,
              elevation: 10,
              borderRadius: 26,
              height: 52,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              paddingBottom: 0,
              paddingHorizontal: 8,
            },
            tabBarBackground: () => (
              <TabBarBackgroundComponent
                currentRoute={currentRoute}
                isDarkMode={isDarkMode}
                hideTabLabels={hideTabLabels}
                theme={theme}
              />
            ),
            tabBarLabelStyle: {
              fontSize: 9, // Font size for labels
              fontWeight: "bold",
              marginBottom: 3, // Space between icon and label
            },
            headerShadowVisible: false,
            headerTitleAlign: "center",
            headerTitleContainerStyle: {
              marginHorizontal: 0,
              paddingHorizontal: 0,
              width: Dimensions.get("window").width,
              alignItems: "center",
            },
            // Set a consistent header height for all tabs
            headerStyle: {
              height: 50 + insets.top, // Base height + top safe area inset
              backgroundColor: theme.headerBackground,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
          })}
        >
          <Tab.Screen
            name="Home"
            options={{
              title: t('navigation.home'),
              headerShown: true,
              headerBackButtonMenuEnabled: false,
              headerTitle: () => (
                <View style={{ width: Dimensions.get("window").width }}>
                  <SameHeader
                    icon="search"
                    action={() => stackNavigation.navigate("SearchScreen")}
                    havingIcon
                    setSetting={setSetting}
                    onLogoPress={triggerHomeScrollOrReload}
                  />
                </View>
              ),
            }}
            listeners={{
              tabPress: (e) => {
                // Check if already on Home tab using the tracked currentRoute state
                // This should be reliable since it's updated via navigation state listener
                if (currentRoute === "Home") {
                  // Prevent default navigation since we're already on Home
                  e.preventDefault();
                  // Trigger scroll to top or reload
                  triggerHomeScrollOrReload();
                }
              },
            }}
            tabBar={(props) => (
              <View onLayout={onTabBarLayout}>{props.tabBar(props)}</View>
            )}
          >
            {(props) => (
              <HomeScreen
                {...props}
                scrollTriggerRef={(triggerFn) => {
                  homeScreenScrollTriggerRef.current = triggerFn;
                }}
              />
            )}
          </Tab.Screen>
          <Tab.Screen
            name="Forum"
            component={MenuScreen}
            options={{ title: t('navigation.forum'), headerShown: false }}
          />
          <Tab.Screen
            name="Create"
            component={DummyComponent} // Use the dummy component
            options={{
              tabBarIconStyle: {
                display: "none",
              },
              tabBarLabelStyle: {
                top: 2,
                fontWeight: "bold",
              },
              tabBarButton: (props) => (
                <CustomTabBarButton
                  {...props}
                  onPress={() => {
                    // Perform any action you want here
                    // console.log("Custom button pressed");
                  }}
                />
              ),
              title: t('navigation.create'),
            }}
          />
          <Tab.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              title: t('navigation.chat'),
              headerShown: false,
            }}
          />
          <Tab.Screen
            name="Notifications"
            component={NotificationScreen}
            options={{
              title: t('navigation.notifications'),
              headerShown: false,
            }}
          />
        </Tab.Navigator>
      </View>
    </SideMenu>
  );
}
