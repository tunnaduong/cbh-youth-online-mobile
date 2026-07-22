import React, { useContext, useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, Platform, Alert, StatusBar, Linking } from "react-native";
import { CustomAlert, CustomAlertProvider } from "./app/components/CustomAlert";
import { AuthContext } from "./app/contexts/AuthContext";

if (Platform.OS === "android") {
  Alert.alert = CustomAlert.alert;
}
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
import LiquidHeaderBackground from "./app/components/LiquidHeaderBackground";
import LiquidButton from "./app/components/LiquidButton";
import Ionicons from "react-native-vector-icons/Ionicons";

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
import StudyMaterialScreen from "./app/screens/MainScreens/ExploreScreen/StudyMaterialScreen";
import StudyMaterialDetailScreen from "./app/screens/MainScreens/ExploreScreen/StudyMaterialDetailScreen";
import UploadStudyMaterialScreen from "./app/screens/MainScreens/ExploreScreen/UploadStudyMaterialScreen";
import StoryViewersScreen from "./app/screens/MainScreens/StoryViewersScreen";
import ArchiveScreen from "./app/screens/MainScreens/ArchiveScreen";
import MemberRankingScreen from "./app/screens/MainScreens/MemberRankingScreen";

import SecurityScreen from "./app/screens/MainScreens/SettingsScreen/SecurityScreen";
import NotificationSettingsScreen from "./app/screens/MainScreens/SettingsScreen/NotificationSettingsScreen";
import BlockedUsersScreen from "./app/screens/MainScreens/SettingsScreen/BlockedUsersScreen";

import { useTheme } from "./app/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const Stack = createStackNavigator();

/**
 * Parse a custom-scheme deep link and return navigation target.
 * Supported formats:
 *   com.fatties.youth://post/<postId>          → PostScreen
 *   com.fatties.youth://post/<postId>-<slug>   → PostScreen
 *   com.fatties.youth://story/<storyId>        → HomeScreen (storyId param)
 */
const parseDeepLink = (url) => {
  if (!url) return null;

  const routeToStory = (storyId) => {
    if (!storyId) return null;
    return {
      screen: "MainScreens",
      params: {
        screen: "Home",
        params: { openStoryId: storyId },
      },
    };
  };

  const parseSearchParams = (query) => {
    const params = {};
    if (!query) return params;
    const queryString = query.replace(/^\?/, "").split("#")[0];
    queryString.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });
    return params;
  };

  const normalizeIntentUrl = (urlString) => {
    let normalized = urlString;
    const intentIndex = normalized.indexOf("#Intent");
    if (intentIndex >= 0) {
      normalized = normalized.slice(0, intentIndex);
    }
    return normalized;
  };

  try {
    let scheme = "";
    let host = "";
    let pathSegment = "";
    let query = "";

    const normalizedUrl = normalizeIntentUrl(url);
    console.log("[DeepLink] normalize input", normalizedUrl);

    const customSchemeMatch = normalizedUrl.match(/^([a-zA-Z0-9+.-]+):\/\/([^/?#]+)(?:\/([^?#]*))?(?:\?([^#]*))?$/);

    if (customSchemeMatch) {
      scheme = customSchemeMatch[1];
      const firstSegment = customSchemeMatch[2].split("?")[0];
      const restPath = customSchemeMatch[3] || "";
      const queryPart = customSchemeMatch[4] || "";

      if (scheme === "com.fatties.youth" || scheme === "exp+cbh-youth-online-mobile") {
        if (firstSegment === "post" || firstSegment === "story") {
          pathSegment = `${firstSegment}/${restPath}`.replace(/^\//, "");
          host = "";
        } else {
          host = firstSegment;
          pathSegment = restPath;
        }
      } else {
        host = firstSegment;
        pathSegment = restPath;
      }

      query = queryPart ? `?${queryPart}` : "";
    } else {
      try {
        const parsedUrl = new URL(normalizedUrl);
        scheme = parsedUrl.protocol.replace(":", "");
        host = parsedUrl.hostname;
        pathSegment = parsedUrl.pathname.replace(/^\//, "");
        query = parsedUrl.search;
      } catch (e) {
        console.warn("[DeepLink] failed to parse URL", normalizedUrl, e);
      }
    }

    if (scheme === "intent") {
      const intentMatch = url.match(/scheme=([^;]+)/);
      if (intentMatch) {
        scheme = intentMatch[1];
      }
    }

    console.log("[DeepLink] parsed fields", { scheme, host, pathSegment, query, original: url });

    const params = parseSearchParams(query);
    const storyIdFromQuery = params.storyId || params.story_id;
    if (storyIdFromQuery) return routeToStory(storyIdFromQuery);

    if (scheme === "com.fatties.youth" || scheme === "exp+cbh-youth-online-mobile") {
      if (pathSegment.startsWith("post/")) {
        const postSlug = pathSegment.slice(5).split("?")[0];
        const postId = parseInt(postSlug.split("-")[0], 10);
        if (!isNaN(postId)) {
          return { screen: "PostScreen", params: { postId, item: null } };
        }
        return { screen: "PostScreen", params: { postId: null, item: null, slug: postSlug } };
      }
      if (pathSegment.startsWith("story/")) {
        const storyId = pathSegment.slice(6).split("?")[0];
        return routeToStory(storyId);
      }
      if (pathSegment && !pathSegment.includes("/")) {
        const storyId = pathSegment;
        return routeToStory(storyId);
      }
    }

    if ((scheme === "https" || scheme === "http") && (host === "chuyenbienhoa.com" || host === "www.chuyenbienhoa.com")) {
      if (pathSegment.startsWith("post/")) {
        const postId = parseInt(pathSegment.slice(5).split("-")[0], 10);
        if (!isNaN(postId)) return { screen: "PostScreen", params: { postId, item: null } };
      }
      if (pathSegment.startsWith("story/")) {
        const storyId = pathSegment.slice(6).split("?")[0];
        return routeToStory(storyId);
      }
    }
  } catch (e) {
    console.warn("[DeepLink] parse error:", e);
  }
  return null;
};

// Main App component
const App = () => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isLoading } = useContext(AuthContext);
  const [showSplash, setShowSplash] = useState(true);
  const navigationRef = useRef(null);
  const pendingDeepLinkQueue = useRef([]);

  const enqueueDeepLinkTarget = (target) => {
    if (!target) return;
    pendingDeepLinkQueue.current.push(target);
  };

  const flushPendingDeepLinks = () => {
    if (!isLoggedIn || !navigationRef.current) return;

    while (pendingDeepLinkQueue.current.length > 0) {
      const nextTarget = pendingDeepLinkQueue.current.shift();
      if (nextTarget) {
        navigationRef.current.navigate(nextTarget.screen, nextTarget.params);
      }
    }
  };

  // Handle deep links (custom scheme: com.fatties.youth://post/<id> or story/<id>)
  useEffect(() => {
    // App opened from a cold start via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("[DeepLink] getInitialURL", url);
        const target = parseDeepLink(url);
        console.log("[DeepLink] parsed initial target", target);
        if (target) {
          enqueueDeepLinkTarget(target);
          flushPendingDeepLinks();
        }
      }
    });

    // App brought to foreground via deep link while already running
    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("[DeepLink] Linking event url", url);
      const target = parseDeepLink(url);
      console.log("[DeepLink] parsed event target", target);
      if (!target) return;

      if (isLoggedIn && navigationRef.current) {
        navigationRef.current.navigate(target.screen, target.params);
      } else {
        enqueueDeepLinkTarget(target);
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  // Once nav is ready + user is logged in, flush the pending deep links
  const handleNavigationReady = () => {
    flushPendingDeepLinks();
  };

  // Also flush when user logs in after app was already open (e.g. opened link while logged out)
  useEffect(() => {
    if (isLoggedIn) {
      // Small delay to ensure navigator is fully mounted after login
      setTimeout(() => {
        flushPendingDeepLinks();
      }, 500);
    }
  }, [isLoggedIn]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

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
        <Text style={{ color: theme.text }}>{t('home.loading')}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent={true}
        animated={true}
      />
      <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
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
                  title: t('post.details'),
                  headerBackTitleVisible: false,
                  headerTransparent: true,
                  headerLeft: (props) => (
                    <LiquidButton size={40} providerId="PostScreen" onPress={props.onPress} containerStyle={{ marginLeft: Platform.OS === 'ios' ? 0 : 16 }}>
                      <Ionicons name="arrow-back" size={22} color={theme.text} />
                    </LiquidButton>
                  ),
                  headerStyle: {
                    backgroundColor: "transparent",
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 0,
                    shadowOffset: { height: 0, width: 0 },
                  },
                  headerTitleStyle: {
                    color: theme.text,
                    textShadowColor: isDarkMode ? '#000' : '#FFF',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
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
                  presentation: "modal",
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
                  title: t('sidebar.explore'),
                  headerBackTitleVisible: false,
                  headerTransparent: true,
                  headerLeft: (props) => (
                    <LiquidButton size={40} providerId="ExploreScreen" onPress={props.onPress} containerStyle={{ marginLeft: Platform.OS === 'ios' ? 0 : 16 }}>
                      <Ionicons name="arrow-back" size={22} color={theme.text} />
                    </LiquidButton>
                  ),
                  headerStyle: {
                    backgroundColor: "transparent",
                    borderBottomWidth: 0,
                    shadowOffset: { height: 0, width: 0 },
                    elevation: 0,
                  },
                  headerTitleStyle: {
                    color: theme.text,
                    textShadowColor: isDarkMode ? '#000' : '#FFF',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }
                }}
              />
              <Stack.Screen
                name="StudyMaterialScreen"
                component={StudyMaterialScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="StudyMaterialDetailScreen"
                component={StudyMaterialDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="UploadStudyMaterialScreen"
                component={UploadStudyMaterialScreen}
                options={{ headerShown: false }}
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
      <CustomAlertProvider />
    </>
  );
};

export default () => (
  <TailwindProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
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
