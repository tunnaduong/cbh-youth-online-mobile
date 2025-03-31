import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, ActivityIndicator, Animated } from "react-native";
import { AuthProvider, AuthContext } from "./app/contexts/AuthContext";
import LoginScreen from "./app/screens/LoginScreen";
import SignupScreen from "./app/screens/SignupScreen";
import MainScreens from "./app/screens/MainScreens";
import { TailwindProvider } from "tailwindcss-react-native";
import SearchScreen from "./app/screens/MainScreens/SearchScreen";
import WelcomeScreen from "./app/screens/WelcomeScreen";
import { AnimationProvider } from "./app/contexts/AnimationContext";
import { StyleSheet } from "react-native";
import PostScreen from "./app/screens/MainScreens/PostScreen";
import SameHeader from "./app/components/SameHeader";

const Stack = createStackNavigator();

const App = () => {
  const { isLoggedIn, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#319527" />
        <Text>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <TailwindProvider>
        <Stack.Navigator>
          {isLoggedIn ? (
            <>
              <Stack.Screen
                options={{
                  title: "Trang chính",
                  headerShown: false,
                  gestureEnabled: false,
                  animation: "fade",
                }}
                name="MainScreens"
                component={MainScreens}
              />
              <Stack.Screen
                options={{
                  title: "Tìm kiếm",
                  headerShown: false,
                  gestureEnabled: false,
                  animation: "fade",
                }}
                name="SearchScreen"
                component={SearchScreen}
              />
              <Stack.Screen
                name="PostScreen"
                options={{
                  title: "Chi tiết bài viết",
                  headerBackButtonDisplayMode: "minimal",
                }}
                component={PostScreen}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Welcome"
                options={{
                  title: "Chào mừng đến với CYO",
                  headerShown: false,
                  animation: "fade",
                }}
                component={WelcomeScreen}
              />
              <Stack.Screen
                name="Login"
                options={{ title: "Đăng nhập", headerShown: false }}
                component={LoginScreen}
              />
              <Stack.Screen
                name="Signup"
                options={{ title: "Đăng ký", headerShown: false }}
                component={SignupScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </TailwindProvider>
    </NavigationContainer>
  );
};

export default () => (
  <AuthProvider>
    <AnimationProvider>
      <App />
    </AnimationProvider>
  </AuthProvider>
);
