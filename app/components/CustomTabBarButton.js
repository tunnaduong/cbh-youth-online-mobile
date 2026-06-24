"use client";

import { useRef, useState, useEffect } from "react";
import {
  Pressable,
  Animated,
  Easing,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const { width, height } = Dimensions.get("window");

let LiquidGlassView = null;
let isLiquidGlassSupported = false;

if (Platform.OS === 'ios') {
  try {
    const LiquidGlass = require('@callstack/liquid-glass');
    LiquidGlassView = LiquidGlass.LiquidGlassView;
    isLiquidGlassSupported = LiquidGlass.isLiquidGlassSupported;
  } catch (error) {
    console.warn("Failed to load @callstack/liquid-glass:", error);
  }
}

const CustomTabBarButton = ({ onPress }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const button1Anim = useRef(new Animated.Value(0)).current;
  const button2Anim = useRef(new Animated.Value(0)).current;
  const button3Anim = useRef(new Animated.Value(0)).current;
  const [showButtons, setShowButtons] = useState(false);
  const navigation = useNavigation();
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const { t } = useTranslation();

  // Close buttons when app goes to background
  useEffect(() => {
    return () => {
      if (showButtons) {
        animateButtonsOut();
      }
    };
  }, [showButtons]);

  const handlePress = () => {
    if (showButtons) {
      animateButtonsOut();
    } else {
      if (onPress) onPress();
      setShowButtons(true);
      animateButtonsIn();
    }
  };

  const handleDismiss = () => {
    if (showButtons) {
      animateButtonsOut();
    }
  };

  const animateButtonsIn = () => {
    Animated.parallel([
      Animated.timing(button1Anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button2Anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button3Anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 1,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButtonsOut = () => {
    Animated.parallel([
      Animated.timing(button1Anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button2Anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button3Anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 0,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => setShowButtons(false));
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const button1Style = {
    transform: [
      {
        translateY: button1Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -160],
        }),
      },
    ],
    opacity: button1Anim,
  };

  const button2Style = {
    transform: [
      {
        translateY: button2Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -80],
        }),
      },
    ],
    opacity: button2Anim,
  };

  const button3Style = {
    transform: [
      {
        translateY: button3Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -240],
        }),
      },
    ],
    opacity: button3Anim,
  };

  const renderSubButton = (buttonAnimStyle, onPress, icon, labelKey) => {
    const isRealGlass = Platform.OS === 'ios' && LiquidGlassView && isLiquidGlassSupported;
    const isIosFallback = Platform.OS === 'ios' && LiquidGlassView && !isLiquidGlassSupported;
    const content = (
      <TouchableOpacity
        style={styles.additionalButtonTouch}
        onPress={() => {
          onPress();
          handleDismiss();
        }}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={28} color={theme.primary} />
        <Text style={[styles.buttonText, { color: theme.primary }]} numberOfLines={1}>
          {t(labelKey)}
        </Text>
      </TouchableOpacity>
    );

    return (
      <Animated.View style={[styles.additionalButtonContainer, buttonAnimStyle]}>
        {isRealGlass ? (
          <LiquidGlassView
            effect="regular"
            interactive={true}
            colorScheme={isDarkMode ? 'dark' : 'light'}
            tintColor={isDarkMode ? "rgba(30, 30, 30, 0.35)" : "rgba(255, 255, 255, 0.3)"}
            style={[
              styles.additionalButtonGlass,
              {
                borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
              }
            ]}
          >
            {content}
          </LiquidGlassView>
        ) : isIosFallback ? (
          <LiquidGlassView
            effect="regular"
            interactive={false}
            colorScheme={isDarkMode ? 'dark' : 'light'}
            tintColor={isDarkMode ? "rgba(30, 30, 30, 0.35)" : "rgba(255, 255, 255, 0.3)"}
            style={[
              styles.additionalButtonGlass,
              {
                backgroundColor: isDarkMode ? "rgba(30, 30, 30, 0.74)" : "rgba(255, 255, 255, 0.74)",
                borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
              }
            ]}
          >
            {content}
          </LiquidGlassView>
        ) : (
          <View
            style={[
              styles.additionalButtonAndroid,
              {
                backgroundColor: isDarkMode ? "rgba(30, 30, 30, 0.74)" : "rgba(255, 255, 255, 0.74)",
                borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
              }
            ]}
          >
            {content}
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Modal
        visible={showButtons}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={handleDismiss}
      >
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        <View
          style={{
            position: "absolute",
            bottom: Platform.OS === 'ios' ? 24 : 12,
            right: 20,
            width: 56,
            height: 56,
          }}
          pointerEvents="box-none"
        >
          {renderSubButton(button3Style, () => navigation.navigate("CreatePostScreen"), "create-outline", "createActions.post")}
          {renderSubButton(button1Style, () => {
            Toast.show({
              type: "info",
              text1: t('createActions.development'),
            });
          }, "mic-outline", "createActions.recording")}
          {renderSubButton(button2Style, () => navigation.navigate("ReportScreen"), "document-text-outline", "createActions.report")}
        </View>
      </Modal>

      <Pressable style={styles.buttonContainer} onPress={handlePress}>
        <Animated.View
          style={[styles.iconContainer, { transform: [{ rotate }] }]}
        >
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "transparent",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <Ionicons
              name="add-circle"
              size={52}
              color={theme.primary}
              style={styles.icon}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  buttonContainer: {
    alignItems: "center",
    zIndex: 3,
    top: 0,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 35,
  },
  icon: {
    shadowColor: "#319527",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  label: {
    fontWeight: "bold",
    fontSize: 9,
    marginTop: 3,
  },
  additionalButtonContainer: {
    position: "absolute",
    width: 155,
    height: 50,
    right: 0,
  },
  additionalButtonGlass: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
    overflow: "hidden",
    borderWidth: 1,
  },
  additionalButtonAndroid: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  additionalButtonTouch: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  buttonText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    width: 95,
  },
});

export default CustomTabBarButton;
