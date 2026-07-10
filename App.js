import React, { useContext, useState, useRef, useEffect } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, Platform, Alert, StatusBar, Linking } from "react-native";
import { getPostDetail, getStories } from "./app/services/api/Api";
import { CustomAlert, CustomAlertProvider } from "./app/components/CustomAlert";
import { AuthContext } from "./app/contexts/AuthContext";
import CustomLoading from "./app/components/CustomLoading";

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
import { useTranslation } from "react-i18next";

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();

const isBrowserIntentUrl = (url) => /^https?:\/\//i.test(url);

const parseDeepLink = (url) => {
  if (!url) return null;
  try {
    // Handle custom scheme: com.fatties.youth://story/ID or com.fatties.youth://post/ID
    const schemePrefix = "com.fatties.youth://";
    if (url.startsWith(schemePrefix)) {
      const rest = url.substring(schemePrefix.length);
      const [host, param] = rest.split("/");
      if ((host === "story" || host === "stories") && param) {
        return { type: "story", storyId: String(param) };
      }
      if ((host === "post" || host === "posts") && param) {
        const match = param.match(/^(\d+)/);
        const postId = match ? match[1] : param;
        return { type: "post", postId: String(postId) };
      }
      return null;
    }

    // Handle web URLs: https://(www.)chuyenbienhoa.com/...
    const webPattern = /^https?:\/\/(www\.)?chuyenbienhoa\.com/i;
    if (webPattern.test(url)) {
      const urlObj = new URL(url);

      // Query param: ?storyId=123
      const storyId = urlObj.searchParams.get("storyId");
      if (storyId) return { type: "story", storyId: String(storyId) };

      // Query param: ?postId=123 or ?id=123
      const postIdParam = urlObj.searchParams.get("postId") || urlObj.searchParams.get("id");
      if (postIdParam) return { type: "post", postId: String(postIdParam) };

      // Path: /{username}/posts/{id}-{slug} or /{username}/posts/{id}
      const pathMatch = urlObj.pathname.match(/\/[^\/]+\/posts\/(\d+)/);
      if (pathMatch) return { type: "post", postId: String(pathMatch[1]) };
    }
  } catch (error) {
    console.error("Failed to parse deep link URL:", error);
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
  const [showBrowserIntentLoading, setShowBrowserIntentLoading] = useState(false);

  const pendingDeepLinkQueueRef = useRef([]);
  const isDeepLinkProcessingRef = useRef(false);
  const isLoggedInRef = useRef(isLoggedIn);
  const isLoadingRef = useRef(isLoading);
  const browserIntentLoadingTimeoutRef = useRef(null);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (browserIntentLoadingTimeoutRef.current) {
        clearTimeout(browserIntentLoadingTimeoutRef.current);
      }
    };
  }, []);

  const hideBrowserIntentLoading = () => {
    if (browserIntentLoadingTimeoutRef.current) {
      clearTimeout(browserIntentLoadingTimeoutRef.current);
    }

    browserIntentLoadingTimeoutRef.current = setTimeout(() => {
      setShowBrowserIntentLoading(false);
    }, 900);
  };

  const executeDeepLinkAction = async (action, showLoading = false) => {
    if (!action) return;

    if (showLoading) {
      setShowBrowserIntentLoading(true);
    }

    try {
      if (action.type === "post") {
        const { postId } = action;
        try {
          const response = await getPostDetail(postId);
          if (response?.data?.post) {
            if (navigationRef.isReady()) {
              navigationRef.navigate("PostScreen", { postId: postId });
            } else {
              setTimeout(() => {
                if (navigationRef.isReady()) {
                  navigationRef.navigate("PostScreen", { postId: postId });
                }
              }, 500);
            }
          } else {
            Alert.alert("Lỗi", "Không tìm thấy bài viết hoặc bạn không có quyền xem bài viết này.");
          }
        } catch (err) {
          console.error("Deep link: failed to fetch post detail:", err);
          Alert.alert("Lỗi", "Không tìm thấy bài viết hoặc bạn không có quyền xem bài viết này.");
        }
      } else if (action.type === "story") {
        const { storyId } = action;
        try {
          const response = await getStories();
          let found = false;
          if (response?.data?.data) {
            found = response.data.data.some(u => 
              u.stories && u.stories.some(s => String(s.id) === String(storyId))
            );
          }
          
          if (found) {
            if (navigationRef.isReady()) {
              navigationRef.navigate("MainScreens", {
                screen: "Home",
                params: {
                  highlightStoryId: storyId
                }
              });
            } else {
              setTimeout(() => {
                if (navigationRef.isReady()) {
                  navigationRef.navigate("MainScreens", {
                    screen: "Home",
                    params: {
                      highlightStoryId: storyId
                    }
                  });
                }
              }, 500);
            }
          } else {
            Alert.alert("Lỗi", "Không tìm thấy tin hoặc bạn không có quyền xem tin này.");
          }
        } catch (err) {
          console.error("Deep link: failed to fetch stories:", err);
          Alert.alert("Lỗi", "Không thể tải tin. Vui lòng thử lại sau.");
        }
      }
    } catch (e) {
      console.error("Error executing deep link action:", e);
    } finally {
      if (showLoading) {
        hideBrowserIntentLoading();
      }
    }
  };

  const processQueuedDeepLinks = () => {
    if (isDeepLinkProcessingRef.current || isLoadingRef.current || !isLoggedInRef.current) {
      return;
    }

    const nextItem = pendingDeepLinkQueueRef.current.shift();
    if (!nextItem) {
      return;
    }

    isDeepLinkProcessingRef.current = true;
    const { action, showLoading } = nextItem;

    setTimeout(() => {
      executeDeepLinkAction(action, showLoading).finally(() => {
        isDeepLinkProcessingRef.current = false;
        processQueuedDeepLinks();
      });
    }, 1000);
  };

  const handleUrl = (url) => {
    console.log("Deep Link URL intercepted:", url);
    const parsed = parseDeepLink(url);
    if (!parsed) return;

    const shouldShowBrowserLoading = isBrowserIntentUrl(url);

    if (isLoadingRef.current) {
      pendingDeepLinkQueueRef.current.push({ action: parsed, showLoading: shouldShowBrowserLoading });
      return;
    }

    if (!isLoggedInRef.current) {
      pendingDeepLinkQueueRef.current.push({ action: parsed, showLoading: shouldShowBrowserLoading });
      Toast.show({
        type: "info",
        text1: t("auth.loginRequiredTitle"),
        text2: t("auth.loginRequiredMessage"),
        topOffset: 60,
      });
      return;
    }

    pendingDeepLinkQueueRef.current.push({ action: parsed, showLoading: shouldShowBrowserLoading });
    processQueuedDeepLinks();
  };

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleUrl(url);
        }
      })
      .catch((err) => console.error("Error getting initial URL:", err));

    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url) {
        handleUrl(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      processQueuedDeepLinks();
    }
  }, [isLoading, isLoggedIn]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (showBrowserIntentLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background, paddingHorizontal: 24 }}>
        <CustomLoading size={180} />
        <Text style={{ color: theme.text, fontSize: 16, marginTop: 16, textAlign: "center" }}>
          Đang tải nội dung...
        </Text>
      </View>
    );
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
      <NavigationContainer ref={navigationRef}>
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
                  headerBackButtonDisplayMode: "minimal",
                  headerTintColor: theme.primary,
                  headerStyle: {
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
                  headerBackButtonDisplayMode: "minimal",
                  headerTintColor: theme.primary,
                  headerStyle: {
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
