import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./HomeScreen";
import CustomTabBarButton from "../../components/CustomTabBarButton";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./MenuScreen";

const Tab = createBottomTabNavigator();

const DummyComponent = () => null;

export default function MainScreens({ navigation }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person-circle" : "person-circle-outline";
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
              />
            );
          },
        }}
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
  );
}
