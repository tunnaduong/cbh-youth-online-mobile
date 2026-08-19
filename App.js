import React, { useContext, useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, Platform, Alert, StatusBar, Linking, DeviceEventEmitter } from "react-native";
import { CustomAlert, CustomAlertProvider } from "./app/components/CustomAlert";
import { AuthContext } from "./app/contexts/AuthContext";
import i18n from "./app/i18n";

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
import { joinGroupViaInvite } from "./app/services/api/Api";
import EditProfileScreen from "./app/screens/MainScreens/EditProfileScreen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import ProfileDetailScreen from "./app/screens/MainScreens/ProfileDetailScreen";
import ReportNavigator from "./app/screens/MainScreens/ReportScreen/ReportNavigator";
import SettingsScreen from "./app/screens/MainScreens/SettingsScreen";
import AboutScreen from "./app/screens/MainScreens/SettingsScreen/AboutScreen";
import EasterEggScreen from "./app/screens/MainScreens/SettingsScreen/EasterEggScreen";
import TermsOfServiceScreen from "./app/screens/MainScreens/SettingsScreen/TermsOfServiceScreen";
import PrivacyPolicyScreen from "./app/screens/MainScreens/SettingsScreen/PrivacyPolicyScreen";
import SavedPostsScreen from "./app/screens/MainScreens/SavedPostsScreen";
import ActivityScreen from "./app/screens/MainScreens/ActivityScreen";
import LikedPostsScreen from "./app/screens/MainScreens/LikedPostsScreen";
import CreateStoryScreen from "./app/screens/MainScreens/CreateStoryScreen";
import CategoryScreen from "./app/screens/MainScreens/ForumScreen/CategoryScreen";
import ConversationScreen from "./app/screens/MainScreens/ChatScreen/ConversationScreen";
import NewConversationScreen from "./app/screens/MainScreens/ChatScreen/NewConversationScreen";
import CreateGroupScreen from "./app/screens/MainScreens/ChatScreen/CreateGroupScreen";
import GroupInfoScreen from "./app/screens/MainScreens/ChatScreen/GroupInfoScreen";
import AddGroupMembersScreen from "./app/screens/MainScreens/ChatScreen/AddGroupMembersScreen";
import ExploreScreen from "./app/screens/MainScreens/ExploreScreen";
import StudyMaterialScreen from "./app/screens/MainScreens/ExploreScreen/StudyMaterialScreen";
import StudyMaterialDetailScreen from "./app/screens/MainScreens/ExploreScreen/StudyMaterialDetailScreen";
import UploadStudyMaterialScreen from "./app/screens/MainScreens/ExploreScreen/UploadStudyMaterialScreen";
import GamesScreen from "./app/screens/MainScreens/ExploreScreen/GamesScreen";
import GamePlayScreen from "./app/screens/MainScreens/ExploreScreen/GamesScreen/GamePlayScreen";
import QuizScreen from "./app/screens/MainScreens/ExploreScreen/QuizScreen";
import UniversityScreen from "./app/screens/MainScreens/ExploreScreen/UniversityScreen";
import CustomQuizCreateScreen from "./app/screens/MainScreens/ExploreScreen/QuizScreen/CustomQuizCreateScreen";
import StoryViewersScreen from "./app/screens/MainScreens/StoryViewersScreen";
import ArchiveScreen from "./app/screens/MainScreens/ArchiveScreen";
import MemberRankingScreen from "./app/screens/MainScreens/MemberRankingScreen";
import PointWalletScreen from "./app/screens/MainScreens/PointWalletScreen";
import DepositScreen from "./app/screens/MainScreens/PointWalletScreen/DepositScreen";
import WithdrawScreen from "./app/screens/MainScreens/PointWalletScreen/WithdrawScreen";

import SecurityScreen from "./app/screens/MainScreens/SettingsScreen/SecurityScreen";
import NotificationSettingsScreen from "./app/screens/MainScreens/SettingsScreen/NotificationSettingsScreen";
import BlockedUsersScreen from "./app/screens/MainScreens/SettingsScreen/BlockedUsersScreen";

import { useTheme } from "./app/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useShareIntent } from "expo-share-intent";
import { parseYouTubeShare } from "./app/utils/youtubeShare";
import { initDevConsole } from "./app/utils/devConsole";
import DevConsoleScreen from "./app/screens/MainScreens/SettingsScreen/DevConsoleScreen";

// Patches console.log/warn/error as early as possible so nothing logged
// during app startup is missed if dev mode is already enabled from a
// previous session.
initDevConsole();

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
        if (firstSegment === "post" || firstSegment === "story" || firstSegment === "group" || firstSegment === "quiz" || firstSegment === "game") {
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

      // An Android "intent://" URI puts our own first path segment (post/
      // story/group/quiz/game) where a real URL would put the host, e.g.
      // "intent://quiz/56#Intent;scheme=com.fatties.youth;...;end" parses
      // above as host="quiz", pathSegment="56" - the customSchemeMatch
      // branch above never runs for these since they don't match a plain
      // "scheme://host/path" shape. Re-fold host back into pathSegment the
      // same way that branch does, or every check below that expects
      // pathSegment to start with "quiz/" etc. misses and this silently
      // falls through to the bare-ID story-link branch instead (e.g. a
      // shared quiz link opening the wrong content).
      if (
        (scheme === "com.fatties.youth" || scheme === "exp+cbh-youth-online-mobile") &&
        (host === "post" || host === "story" || host === "group" || host === "quiz" || host === "game")
      ) {
        pathSegment = `${host}/${pathSegment}`;
        host = "";
      }
    }

    console.log("[DeepLink] parsed fields", { scheme, host, pathSegment, query, original: url });

    const params = parseSearchParams(query);
    const storyIdFromQuery = params.storyId || params.story_id;
    if (storyIdFromQuery) return routeToStory(storyIdFromQuery);
    const sharedQuizId = params.shared || params.quizSetId;
    if (sharedQuizId && (pathSegment === "explore/quiz" || pathSegment === "quiz")) {
      return { screen: "QuizScreen", params: { sharedQuizId } };
    }

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
      if (pathSegment.startsWith("group/")) {
        const token = pathSegment.slice(6).split("?")[0];
        if (token) return { screen: "GroupJoin", params: { token } };
      }
      if (pathSegment.startsWith("quiz/")) {
        const quizSetId = pathSegment.slice(5).split("?")[0];
        if (quizSetId) return { screen: "QuizScreen", params: { sharedQuizId: quizSetId } };
      }
      if (pathSegment.startsWith("game/")) {
        const slug = pathSegment.slice(5).split("?")[0];
        if (slug) return { screen: "GamePlayScreen", params: { slug } };
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
      if (pathSegment.startsWith("explore/quiz") && sharedQuizId) {
        return { screen: "QuizScreen", params: { sharedQuizId } };
      }
      // Universal-link redirect target used by the web "open in app" button
      // (see src/app/open/[type]/[value]/route.js) as well as a bare /group/
      // path in case that's ever shared directly.
      if (pathSegment.startsWith("open/group/") || pathSegment.startsWith("group/")) {
        const token = pathSegment.replace(/^open\//, "").slice(6).split("?")[0];
        if (token) return { screen: "GroupJoin", params: { token } };
      }
      if (pathSegment.startsWith("open/quiz/")) {
        const quizSetId = pathSegment.slice(10).split("?")[0];
        if (quizSetId) return { screen: "QuizScreen", params: { sharedQuizId: quizSetId } };
      }
      if (pathSegment.startsWith("open/game/")) {
        const slug = pathSegment.slice(10).split("?")[0];
        if (slug) return { screen: "GamePlayScreen", params: { slug } };
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
  const { barStyle, backgroundColor: statusBarColor } = useStatusBar();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isLoading } = useContext(AuthContext);
  const { shareIntent, resetShareIntent } = useShareIntent();
  const [showSplash, setShowSplash] = useState(true);
  // i18n.init() reads the saved language from AsyncStorage asynchronously, so
  // i18n.language is undefined for a brief window after app start. Screens
  // that fetch and format data (e.g. story/post timestamps) as soon as they
  // mount can race ahead of that, causing formatTime to fall back to "vi"
  // (its default when language is unknown) even when the user has English
  // selected. Gating first render on this avoids that race.
  const [i18nReady, setI18nReady] = useState(i18n.isInitialized);
  useEffect(() => {
    if (i18n.isInitialized) {
      setI18nReady(true);
      return;
    }
    const handleInitialized = () => setI18nReady(true);
    i18n.on("initialized", handleInitialized);
    return () => i18n.off("initialized", handleInitialized);
  }, []);
  const navigationRef = useRef(null);
  const pendingDeepLinkQueue = useRef([]);

  // These screens fetch their data once in a mount-only effect keyed off
  // their own local state, not off route.params changes. navigate() to a
  // screen name already in the stack doesn't remount it - it just merges the
  // new params into the existing instance - so e.g. opening a link to post B
  // while post A's PostScreen is still on the stack silently updated params
  // that nothing re-read, and the screen kept showing post A. push() always
  // mounts a fresh instance, so the new target's data actually loads. (Same
  // fix as ProfileScreen's Message button - see ConversationScreen history.)
  // MainScreens/PointWalletScreen aren't in this list: MainScreens is the
  // persistent tab container and its story deep-link effect already re-runs
  // off route.params changes, so re-pushing it would stack a duplicate tab
  // bar on top of itself instead of reusing the singleton.
  const DEEP_LINK_TARGETS_NEEDING_FRESH_SCREEN = ["PostScreen", "ConversationScreen"];

  const navigateToDeepLinkTarget = (target) => {
    if (!target || !navigationRef.current) return;

    // Group invite links aren't a real registered screen - joining is an async API
    // call, so resolve the conversation id first and only then push the thread.
    if (target.screen === "GroupJoin") {
      const { token } = target.params || {};
      if (!token) return;
      joinGroupViaInvite(token)
        .then((res) => {
          const joinedConversationId = res?.data?.conversation_id;
          if (!joinedConversationId || !navigationRef.current) return;
          navigationRef.current.dispatch({
            type: "PUSH",
            payload: { name: "ConversationScreen", params: { conversationId: joinedConversationId } },
          });
        })
        .catch((error) => {
          console.warn("[DeepLink] failed to join group via invite", error?.response?.data || error?.message);
          Toast.show({
            type: "error",
            text1: i18n.t("chatConversation.inviteLinkError", "Không thể tham gia nhóm qua lời mời."),
          });
        });
      return;
    }

    // The container ref only implements the base NavigationHelpers surface
    // (navigate/goBack/reset/dispatch, no `.push`) - `.push` only exists on
    // the `navigation` prop a stack screen receives, which is why calling
    // navigationRef.current.push(...) threw "not a function". Dispatching a
    // stack PUSH action directly (what StackActions.push() builds under the
    // hood) is the container-ref equivalent, with no extra dependency needed.
    if (DEEP_LINK_TARGETS_NEEDING_FRESH_SCREEN.includes(target.screen)) {
      navigationRef.current.dispatch({
        type: "PUSH",
        payload: { name: target.screen, params: target.params },
      });
    } else {
      navigationRef.current.navigate(target.screen, target.params);
    }
  };

  const enqueueDeepLinkTarget = (target) => {
    if (!target) return;
    pendingDeepLinkQueue.current.push(target);
  };

  const flushPendingDeepLinks = () => {
    if (!isLoggedIn || !navigationRef.current) return;

    while (pendingDeepLinkQueue.current.length > 0) {
      const nextTarget = pendingDeepLinkQueue.current.shift();
      if (nextTarget) {
        navigateToDeepLinkTarget(nextTarget);
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
        navigateToDeepLinkTarget(target);
      } else {
        enqueueDeepLinkTarget(target);
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  // Handle incoming YouTube / YouTube Music shares.
  // expo-share-intent populates shareIntent when the OS delivers a share to
  // our app (Android ACTION_SEND or iOS Share Extension). If the shared text
  // contains a YouTube URL we extract the video ID, build the embed HTML and
  // open CreatePostScreen with it pre-filled.
  useEffect(() => {
    if (!shareIntent || !shareIntent.text) return;
    const text = shareIntent.text;
    const ytShare = parseYouTubeShare(text);
    if (!ytShare) return;

    resetShareIntent();

    const navigate = () => {
      if (!navigationRef.current) return;
      navigationRef.current.navigate("CreatePostScreen", {
        initialContent: ytShare.embedHtml,
        initialTitle: "",
      });
    };

    if (isLoggedIn && navigationRef.current) {
      navigate();
    } else {
      // Wait until the user is logged in and navigation is mounted
      const checkInterval = setInterval(() => {
        if (isLoggedIn && navigationRef.current) {
          clearInterval(checkInterval);
          navigate();
        }
      }, 300);
      setTimeout(() => clearInterval(checkInterval), 30000);
    }
  }, [shareIntent, isLoggedIn]);

  // Navigate (or queue for later) when a push notification is tapped
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('NAVIGATE_FROM_NOTIFICATION', (target) => {
      console.log('[Push] App.js received NAVIGATE_FROM_NOTIFICATION', {
        target,
        isLoggedIn,
        hasNavigationRef: !!navigationRef.current,
      });
      if (!target) return;
      if (isLoggedIn && navigationRef.current) {
        navigateToDeepLinkTarget(target);
      } else {
        enqueueDeepLinkTarget(target);
      }
    });
    return () => sub.remove();
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

  const effectiveBarStyle = barStyle || (isDarkMode ? "light-content" : "dark-content");
  const effectiveStatusBarColor = statusBarColor || "transparent";

  // handleNavigationStateChange is handed to NavigationContainer, which may
  // cache the callback via its own ref-sync effect and invoke a render-old
  // closure when a navigation event fires in the same tick (observed on
  // Android: onStateChange applied a stale barStyle from before a theme
  // toggle had been picked up). Mutating a ref during render — safe, since it
  // doesn't trigger a re-render or read stale state — guarantees the resync
  // handler always sees the latest computed value regardless of when it's
  // actually invoked.
  const latestStatusBarRef = useRef({ effectiveBarStyle, effectiveStatusBarColor });
  latestStatusBarRef.current = { effectiveBarStyle, effectiveStatusBarColor };

  // Observability only, both platforms: logs whenever the computed status bar
  // value changes so iOS behavior can be compared against Android in Metro
  // logs. Does not call any native StatusBar API — iOS relies entirely on the
  // declarative <StatusBar> below, which historically doesn't suffer the
  // native "drift" that necessitates Android's imperative resync further down.
  useEffect(() => {
    if (__DEV__) {
      console.log("[StatusBar] computed value changed", {
        platform: Platform.OS,
        isDarkMode,
        effectiveBarStyle,
        effectiveStatusBarColor,
      });
    }
  }, [effectiveBarStyle, effectiveStatusBarColor, isDarkMode]);

  // Android only: the declarative <StatusBar> below only re-issues its native
  // call when these computed values actually change. Most screens (e.g.
  // Settings, About) never touch StatusBarContext at all, so navigating
  // between them keeps the same computed value — but the native bar can
  // still visually drift after a screen transition (icons revert to the
  // wrong color and stay stuck until the app restarts). Re-applying on every
  // navigation state change forces Android to resync regardless of whether
  // the JS-computed value changed.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (__DEV__) {
      console.log("[StatusBar] App effect resync", { effectiveBarStyle, effectiveStatusBarColor });
    }
    StatusBar.setBarStyle(effectiveBarStyle, true);
    StatusBar.setBackgroundColor(effectiveStatusBarColor, true);
  }, [effectiveBarStyle, effectiveStatusBarColor]);

  const handleNavigationStateChange = () => {
    if (Platform.OS !== "android") return;
    const { effectiveBarStyle: latestBarStyle, effectiveStatusBarColor: latestColor } =
      latestStatusBarRef.current;
    if (__DEV__) {
      console.log("[StatusBar] onStateChange resync", {
        route: navigationRef.current?.getCurrentRoute?.()?.name,
        effectiveBarStyle: latestBarStyle,
        effectiveStatusBarColor: latestColor,
      });
    }
    StatusBar.setBarStyle(latestBarStyle, true);
    StatusBar.setBackgroundColor(latestColor, true);
  };

  if (showSplash || !i18nReady) {
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
        barStyle={effectiveBarStyle}
        backgroundColor={effectiveStatusBarColor}
        translucent={true}
        animated={true}
      />
      <NavigationContainer
        ref={navigationRef}
        onReady={handleNavigationReady}
        onStateChange={handleNavigationStateChange}
      >
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
                name="EasterEggScreen"
                component={EasterEggScreen}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="DevConsoleScreen"
                component={DevConsoleScreen}
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
                name="PointWalletScreen"
                component={PointWalletScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="DepositScreen"
                component={DepositScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="WithdrawScreen"
                component={WithdrawScreen}
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
                name="CreateGroupScreen"
                options={{
                  headerShown: false,
                  presentation: "transparentModal",
                  animation: "slide_from_bottom",
                  gestureEnabled: false,
                }}
                component={CreateGroupScreen}
              />
              <Stack.Screen
                name="GroupInfoScreen"
                component={GroupInfoScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="AddGroupMembersScreen"
                options={{
                  headerShown: false,
                  presentation: "modal",
                }}
                component={AddGroupMembersScreen}
              />
              <Stack.Screen
                name="ExploreScreen"
                component={ExploreScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GamesScreen"
                component={GamesScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GamePlayScreen"
                component={GamePlayScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="QuizScreen"
                component={QuizScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="CustomQuizCreateScreen"
                component={CustomQuizCreateScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="UniversityScreen"
                component={UniversityScreen}
                options={{ headerShown: false }}
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
