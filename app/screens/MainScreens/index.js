import React, { useState, useEffect, useRef } from "react";
import { Dimensions, View, Platform, StyleSheet, Text, TouchableOpacity, Animated } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
  const [tabBarWidth, setTabBarWidth] = useState(Dimensions.get("window").width - 90);
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
  const usableWidth = tabBarWidth - 20;
  const buttonWidth = usableWidth / 5;
  const indicatorWidth = 55;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex * buttonWidth,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [activeIndex, buttonWidth]);

  const opacity = activeIndex === 2 ? 0 : 1;

  return (
    <View
      onLayout={onLayout}
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 30,
        overflow: "hidden",
        backgroundColor: isDarkMode ? "rgba(0,0,0,0.74)" : "rgba(255,255,255,0.74)",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: indicatorWidth,
          height: hideTabLabels ? 42 : 50,
          borderRadius: 20,
          top: hideTabLabels ? 9 : 5,
          left: 10 + (buttonWidth - indicatorWidth) / 2,
          opacity,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.05)",
          borderWidth: 1,
          borderColor: isDarkMode ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.08)",
          shadowColor: isDarkMode ? "#fff" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.25 : 0.12,
          shadowRadius: 5,
          elevation: 2,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.35)", "rgba(255, 255, 255, 0.05)", "transparent"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={{
            position: "absolute",
            top: 1,
            left: 3,
            right: 3,
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.4)",
          }}
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
                      borderRadius: 20,
                      paddingVertical: 5,
                      paddingHorizontal: 12,
                      minWidth: 55,
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
              bottom: Platform.OS === 'ios' ? 15 : 5,
              left: 45,
              right: 45,
              elevation: 10,
              borderRadius: 30,
              height: 60,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 5 },
              shadowRadius: 15,
              paddingBottom: 0,
              paddingHorizontal: 10,
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
              fontSize: 10, // Font size for labels
              fontWeight: "bold",
              marginBottom: 5, // Space between icon and label
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
