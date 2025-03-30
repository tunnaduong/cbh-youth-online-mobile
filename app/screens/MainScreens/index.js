import React from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./HomeScreen";
import CustomTabBarButton from "../../components/CustomTabBarButton";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./MenuScreen";
import SideMenu from "@chakrahq/react-native-side-menu";
import Sidebar from "../../components/Sidebar";
import { AnimationContext } from "../../contexts/AnimationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();
const { height } = Dimensions.get("window");

const DummyComponent = () => null;

export default function MainScreens({ navigation }) {
  const [setting, setSetting] = React.useState(false);

  // This will be used to measure the tab bar height
  const onTabBarLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    tabBarHeightRef.current = height;
  };

  return (
    <SideMenu
      menu={<Sidebar />}
      menuPosition="left"
      isOpen={setting}
      onChange={(isOpen) => setSetting(isOpen)}
      edgeHitWidth={100}
      bounceBackOnOverdraw={false}
    >
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === "Home") {
                iconName = focused ? "home" : "home-outline";
              } else if (route.name === "Menu") {
                iconName = focused ? "menu" : "menu-outline";
              } else if (route.name === "Notifications") {
                iconName = focused ? "notifications" : "notifications-outline";
              } else if (route.name === "Chat") {
                iconName = focused ? "chatbubble" : "chatbubble-outline";
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: "#319527",
            tabBarInactiveTintColor: "gray",
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "bold",
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
            name="Chat"
            component={DummyComponent}
            options={{
              title: "Chat",
            }}
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
            name="Notifications"
            component={DummyComponent}
            options={{
              title: "Thông báo",
            }}
          />
          <Tab.Screen name="Menu" component={MenuScreen} />
        </Tab.Navigator>
      </View>
    </SideMenu>
  );
}
