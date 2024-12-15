import React from "react";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./HomeScreen";

// Screen components
function SettingsScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Settings Screen</Text>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Profile Screen</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function MainScreens() {
  const CustomTabBarButton = ({ children, onPress }) => (
    <Pressable
      style={{
        top: -27,
        justifyContent: "center",
        alignItems: "center",
      }}
      onPress={onPress}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 35,
          backgroundColor: "#fff",
        }}
      >
        <Ionicons
          name="add-circle"
          size={60}
          color={"#319527"}
          style={{
            shadowColor: "#319527",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
          }}
        />
        {children}
      </View>
    </Pressable>
  );

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
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ProfileScreen}
        options={{
          title: "Chat",
        }}
      />
      <Tab.Screen
        name="Create"
        component={ProfileScreen}
        options={{
          tabBarIconStyle: {
            display: "none",
          },
          tabBarLabelStyle: {
            top: 2,
            fontWeight: "bold",
          },
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
          title: "Tạo",
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={ProfileScreen}
        options={{
          title: "Thông báo",
        }}
      />
      <Tab.Screen name="Menu" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
