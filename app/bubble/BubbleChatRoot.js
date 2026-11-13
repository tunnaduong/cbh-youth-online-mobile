import React, { useCallback, useMemo, useRef } from "react";
import { Alert, Platform, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { TailwindProvider } from "tailwindcss-react-native";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import { ChatSocketProvider } from "../contexts/ChatSocketContext";
import { StatusBarProvider } from "../contexts/StatusBarContext";
import { BottomSheetProvider } from "../contexts/BottomSheetContext";
import { CallContext } from "../contexts/CallContext";
import { PostHtmlEngineProvider } from "../components/PostHtml";
import AppToast from "../components/AppToast";
import { CustomAlert, CustomAlertProvider } from "../components/CustomAlert";
import ConversationScreen from "../screens/MainScreens/ChatScreen/ConversationScreen";
import GroupInfoScreen from "../screens/MainScreens/ChatScreen/GroupInfoScreen";
import MediaGalleryScreen from "../screens/MainScreens/ChatScreen/MediaGalleryScreen";
import { collapseBubble, openAppAt } from "../services/bubble/nativeBubble";

// The second React root of the app: what the Android chat bubble hosts
// (modules/hmy-bubble BubbleActivity, registered as "BubbleChat" in index.js).
// It is the app's own ConversationScreen - every chat feature and the normal
// design - under only the providers that screen needs. No push registration,
// no incoming-call handling and no tab navigator: those stay in the main root.
// App.js does this for the main process only: dialogs (Alert.alert) are drawn
// by CustomAlertProvider on Android, so the bubble needs both as well.
if (Platform.OS === "android") {
  Alert.alert = CustomAlert.alert;
}

const Stack = createStackNavigator();

// Calls are started and answered in the main app: from the bubble the button
// just opens the app on this conversation.
const bubbleCallContext = (conversationId) => ({
  startCall: () => openAppAt(conversationId),
});

function Navigator({ conversationId }) {
  const { theme, isDarkMode } = useTheme();
  const callValue = useMemo(() => bubbleCallContext(conversationId), [conversationId]);
  const navTheme = useMemo(() => {
    const base = isDarkMode ? DarkTheme : DefaultTheme;
    return { ...base, dark: isDarkMode, colors: { ...base.colors, primary: theme.primary, background: theme.background } };
  }, [isDarkMode, theme]);

  // The chat's back button has nowhere to go in a bubble: fold the bubble.
  // Screens the bubble does not have (profiles, posts...) open in the app.
  const onUnhandledAction = useCallback(
    (action) => {
      if (action?.type === "GO_BACK" || action?.type === "POP") collapseBubble();
      else if (action?.type === "NAVIGATE" || action?.type === "PUSH") openAppAt(conversationId);
    },
    [conversationId]
  );

  return (
    <CallContext.Provider value={callValue}>
      <NavigationContainer theme={navTheme} onUnhandledAction={onUnhandledAction}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="ConversationScreen"
            component={ConversationScreen}
            initialParams={{ conversationId, inBubble: true }}
          />
          <Stack.Screen name="GroupInfoScreen" component={GroupInfoScreen} />
          <Stack.Screen name="MediaGalleryScreen" component={MediaGalleryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </CallContext.Provider>
  );
}

export default function BubbleChatRoot({ conversationId }) {
  const id = useRef(conversationId ? Number(conversationId) || conversationId : null).current;
  return (
    <TailwindProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <ThemeProvider>
              <PostHtmlEngineProvider>
                <AuthProvider>
                  <ChatSocketProvider>
                    <StatusBarProvider>
                      <BottomSheetProvider>
                        <View style={{ flex: 1 }}>{id != null && <Navigator conversationId={id} />}</View>
                      </BottomSheetProvider>
                    </StatusBarProvider>
                  </ChatSocketProvider>
                </AuthProvider>
              </PostHtmlEngineProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
        <AppToast topOffset={60} />
        <CustomAlertProvider />
      </GestureHandlerRootView>
    </TailwindProvider>
  );
}
