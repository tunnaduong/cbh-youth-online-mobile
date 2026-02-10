import React, { useContext, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, Platform, StatusBar } from "react-native";
import { AuthContext } from "./app/contexts/AuthContext";
import { useStatusBar } from "./app/contexts/StatusBarContext";
import LoginScreen from "./app/screens/LoginScreen";
import SignupScreen from "./app/screens/SignupScreen";
import ForgotPasswordScreen from "./app/screens/ForgotPasswordScreen";
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
import CreatePostScreen from "./app/screens/MainScreens/CreatePostScreen";
import PostEditScreen from "./app/screens/MainScreens/PostEditScreen";
import Toast from "react-native-toast-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import EditProfileScreen from "./app/screens/MainScreens/EditProfileScreen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import ProfileDetailScreen from "./app/screens/MainScreens/ProfileDetailScreen";
import ReportNavigator from "./app/screens/MainScreens/ReportScreen/ReportNavigator";
import SettingsScreen from "./app/screens/MainScreens/SettingsScreen";
import AboutScreen from "./app/screens/MainScreens/SettingsScreen/AboutScreen";
import TermsOfServiceScreen from "./app/screens/MainScreens/SettingsScreen/TermsOfServiceScreen";
import PrivacyPolicyScreen from "./app/screens/MainScreens/SettingsScreen/PrivacyPolicyScreen";
import SavedPostsScreen from "./app/screens/MainScreens/SavedPostsScreen";
import ActivityScreen from "./app/screens/MainScreens/ActivityScreen";
import LikedPostsScreen from "./app/screens/MainScreens/LikedPostsScreen";
import CreateStoryScreen from "./app/screens/MainScreens/CreateStoryScreen";
import CategoryScreen from "./app/screens/MainScreens/ForumScreen/CategoryScreen";
import ConversationScreen from "./app/screens/MainScreens/ChatScreen/ConversationScreen";
import NewConversationScreen from "./app/screens/MainScreens/ChatScreen/NewConversationScreen";
import ExploreScreen from "./app/screens/MainScreens/ExploreScreen";
import StoryViewersScreen from "./app/screens/MainScreens/StoryViewersScreen";
import ArchiveScreen from "./app/screens/MainScreens/ArchiveScreen";
import MemberRankingScreen from "./app/screens/MainScreens/MemberRankingScreen";

import SecurityScreen from "./app/screens/MainScreens/SettingsScreen/SecurityScreen";
import NotificationSettingsScreen from "./app/screens/MainScreens/SettingsScreen/NotificationSettingsScreen";
import BlockedUsersScreen from "./app/screens/MainScreens/SettingsScreen/BlockedUsersScreen";

import { useTheme } from "./app/contexts/ThemeContext";

const Stack = createStackNavigator();

// Main App component
const App = () => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isLoading } = useContext(AuthContext);
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}>
        <LottieView
          source={require("./app/assets/refresh.json")}
          style={{
            width: 70,
            height: 70,
          }}
          loop
          autoPlay
        />
        <Text style={{ color: theme.text }}>Đang tải...</Text>
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={Platform.OS === "android" ? theme.headerBackground : "transparent"}
        translucent={Platform.OS === "android"}
      />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              height: 50 + insets.top,
              backgroundColor: theme.headerBackground,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
              shadowOffset: { height: 0, width: 0 },
            },
            headerTitleStyle: {
              color: theme.text,
            },
            headerTintColor: theme.primary,
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
                  headerTintColor: theme.primary,
                  headerStyle: {
                    height: 50 + insets.top,
                    backgroundColor: theme.headerBackground,
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 0,
                    shadowOffset: { height: 0, width: 0 },
                  },
                  headerTitleStyle: {
                    color: theme.text,
                  }
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
              <Stack.Screen
                name="PostEditScreen"
                options={{
                  title: "Chỉnh sửa bài viết",
                  headerShown: false,
                  presentation: "modal",
                }}
                component={PostEditScreen}
              />
              <Stack.Screen
                name="EditProfileScreen"
                options={{
                  title: "Chỉnh sửa trang cá nhân",
                  headerShown: false,
                  presentation:
                    Platform.OS === "android" ? "transparentModal" : "modal",
                  gestureEnabled: true,
                  animation: "slide_from_bottom",
                }}
                component={EditProfileScreen}
              />
              <Stack.Screen
                name="ProfileDetailScreen"
                component={ProfileDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ReportScreen"
                component={ReportNavigator}
                options={{
                  headerShown: false,
                  presentation: "modal",
                }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="AboutScreen"
                component={AboutScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="TermsOfServiceScreen"
                component={TermsOfServiceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="PrivacyPolicyScreen"
                component={PrivacyPolicyScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="SecurityScreen"
                component={SecurityScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="BlockedUsersScreen"
                component={BlockedUsersScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="NotificationSettingsScreen"
                component={NotificationSettingsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="SavedPostsScreen"
                component={SavedPostsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ActivityScreen"
                component={ActivityScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="LikedPostsScreen"
                component={LikedPostsScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="CreateStory"
                options={{
                  headerShown: false,
                  presentation: "transparentModal",
                  animation: "slide_from_bottom",
                  gestureEnabled: false,
                }}
                component={CreateStoryScreen}
              />
              <Stack.Screen
                name="CategoryScreen"
                component={CategoryScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="MemberRankingScreen"
                component={MemberRankingScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ConversationScreen"
                component={ConversationScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="NewConversationScreen"
                options={{
                  headerShown: false,
                  presentation: "transparentModal",
                  animation: "slide_from_bottom",
                  gestureEnabled: false,
                }}
                component={NewConversationScreen}
              />
              <Stack.Screen
                name="ExploreScreen"
                component={ExploreScreen}
                options={{
                  title: "Khám phá",
                  headerBackButtonDisplayMode: "minimal",
                  headerTintColor: theme.primary,
                  headerStyle: {
                    height: 50 + insets.top,
                    backgroundColor: theme.headerBackground,
                    borderBottomWidth: 0,
                    shadowOffset: { height: 0, width: 0 },
                    elevation: 0,
                  },
                }}
              />
              <Stack.Screen
                name="StoryViewersScreen"
                component={StoryViewersScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="ArchiveScreen"
                component={ArchiveScreen}
                options={{
                  headerShown: false,
                }}
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
              <Stack.Screen
                name="ForgotPassword"
                options={{ title: "Quên mật khẩu", headerShown: false }}
                component={ForgotPasswordScreen}
              />
              <Stack.Screen
                name="TermsOfServiceScreen"
                component={TermsOfServiceScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="PrivacyPolicyScreen"
                component={PrivacyPolicyScreen}
                options={{
                  headerShown: false,
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default () => (
  <TailwindProvider>
    <GestureHandlerRootView>
      <MultiContextProvider>
        <SafeAreaProvider>
          <KeyboardProvider>
            <App />
          </KeyboardProvider>
        </SafeAreaProvider>
      </MultiContextProvider>
      <Toast topOffset={60} />
    </GestureHandlerRootView>
  </TailwindProvider>
);
