import React, { useContext, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text } from "react-native";
import { AuthContext } from "./app/contexts/AuthContext";
import LoginScreen from "./app/screens/LoginScreen";
import SignupScreen from "./app/screens/SignupScreen";
import MainScreens from "./app/screens/MainScreens";
import { TailwindProvider } from "tailwindcss-react-native";
import SearchScreen from "./app/screens/MainScreens/SearchScreen";
import WelcomeScreen from "./app/screens/WelcomeScreen";
import PostScreen from "./app/screens/MainScreens/PostScreen";
import MultiContextProvider from "./app/contexts";
import ProfileScreen from "./app/screens/MainScreens/ProfileScreen";
import LottieView from "lottie-react-native";
import SplashScreen from "./app/components/SplashScreen";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import CreatePostScreen from "./app/screens/MainScreens/CreatePostScreen/CreatePostScreen";

const Stack = createStackNavigator();

// Create a separate navigator component that uses the insets
function AppNavigator() {
  const { isLoggedIn, isLoading } = useContext(AuthContext);
  const [showSplash, setShowSplash] = useState(true);
  const insets = useSafeAreaInsets(); // Now this will work properly

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <LottieView
          source={require("./app/assets/refresh.json")}
          style={{
            width: 70,
            height: 70,
          }}
          loop
          autoPlay
        />
        <Text>Đang tải...</Text>
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <NavigationContainer>
      <TailwindProvider>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              height: 50 + insets.top, // Now this will work properly
              backgroundColor: "#fff",
            },
            headerTitleContainerStyle: {
              paddingVertical: 10,
            },
          }}
        >
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
                  headerTintColor: "#319527",
                }}
                component={PostScreen}
              />
              <Stack.Screen
                name="ProfileScreen"
                options={{
                  title: "Trang cá nhân",
                  headerBackButtonDisplayMode: "minimal",
                  headerShown: false,
                }}
                component={ProfileScreen}
              />
              <Stack.Screen
                name="CreatePostScreen"
                options={{
                  title: "Tạo bài viết",
                  headerShown: false,
                  presentation: "modal",
                }}
                component={CreatePostScreen}
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
}

// Main App component with SafeAreaProvider
const App = () => {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default () => (
  <MultiContextProvider>
    <App />
  </MultiContextProvider>
);
