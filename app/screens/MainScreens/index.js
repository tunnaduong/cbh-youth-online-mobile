import React, { useState, useEffect, useRef } from "react";
import { Dimensions, View } from "react-native";
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

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

export default function MainScreens({ navigation }) {
  const [setting, setSetting] = React.useState(false);
  const insets = useSafeAreaInsets();
  const [currentRoute, setCurrentRoute] = useState("Home");
  const tabBarHeightRef = useRef(null);
  const { chatUnreadCount, notificationUnreadCount } = useUnreadCountsContext();

  // This will be used to measure the tab bar height
  const onTabBarLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    tabBarHeightRef.current = height;
  };

  // Add navigation state listener to track current route
  useEffect(() => {
    const unsubscribe = navigation.addListener("state", (e) => {
      // Get the state of the bottom tab navigator
      const bottomTabState = e.data.state?.routes?.[0]?.state;
      if (bottomTabState) {
        const currentRouteName =
          bottomTabState.routes[bottomTabState.index].name;
        setCurrentRoute(currentRouteName);
      }
    });

    return unsubscribe;
  }, [navigation]);

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
      <View style={{ flex: 1 }}>
        <Tab.Navigator
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
            tabBarActiveTintColor: "#319527",
            tabBarInactiveTintColor: "gray",
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "bold",
            },
            // Set a consistent header height for all tabs
            headerStyle: {
              height: 50 + insets.top, // Base height + top safe area inset
            },
            headerTitleContainerStyle: {
              paddingVertical: 5, // Adjust as needed
            },
          })}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: "Trang chủ",
              headerShown: true,
              headerBackButtonMenuEnabled: false,
              headerTitle: () => {
                return (
                  <SameHeader
                    icon="search"
                    action={() => navigation.navigate("SearchScreen")}
                    havingIcon
                    setSetting={setSetting}
                  />
                );
              },
            }}
            tabBar={(props) => (
              <View onLayout={onTabBarLayout}>{props.tabBar(props)}</View>
            )}
          />
          <Tab.Screen
            name="Forum"
            component={MenuScreen}
            options={{ title: "Diễn đàn", headerShown: false }}
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
              title: "Tạo",
            }}
          />
          <Tab.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              title: "Chat",
              headerShown: false,
            }}
          />
          <Tab.Screen
            name="Notifications"
            component={NotificationScreen}
            options={{
              title: "Thông báo",
              headerShown: false,
            }}
          />
        </Tab.Navigator>
      </View>
    </SideMenu>
  );
}
