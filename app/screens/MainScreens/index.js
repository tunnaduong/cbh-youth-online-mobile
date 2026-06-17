import React, { useState, useEffect, useRef } from "react";
import { Dimensions, View, Platform, StyleSheet } from "react-native";
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

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

export default function MainScreens({ navigation: stackNavigation }) {
  const [setting, setSetting] = React.useState(false);
  const insets = useSafeAreaInsets();
  const [currentRoute, setCurrentRoute] = useState("Home");
  const tabBarHeightRef = useRef(null);
  const { chatUnreadCount, notificationUnreadCount } = useUnreadCountsContext();
  const tabNavigatorRef = useRef(null);
  const homeScreenScrollTriggerRef = useRef(null);
  const { theme, isDarkMode } = useTheme();
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
      <View style={{ flex: 1, backgroundColor: theme.background, paddingBottom: 80 }}>
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
            tabBarShowLabel: false,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: isDarkMode ? "#A0A0A0" : "gray",
            tabBarStyle: {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 25 : 15,
              left: 20,
              right: 20,
              elevation: 10,
              borderRadius: 30,
              height: 55,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 5 },
              shadowRadius: 15,
              paddingBottom: 0,
              paddingHorizontal: 5,
            },
            tabBarBackground: () => (
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: 30,
                  overflow: 'hidden',
                  backgroundColor: isDarkMode ? 'rgba(0,0,0,0.74)' : 'rgba(255,255,255,0.74)',
                }}
              />
            ),
            tabBarLabelStyle: {
              fontSize: 8, // Even smaller font size
              fontWeight: "bold",
              marginTop: 2, // Move text closer to icon
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
