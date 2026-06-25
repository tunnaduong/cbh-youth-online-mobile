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
let LiquidGlassContainerView = null;
let isLiquidGlassSupported = false;

if (Platform.OS === 'ios') {
  try {
    const LiquidGlass = require('@callstack/liquid-glass');
    LiquidGlassView = LiquidGlass.LiquidGlassView;
    LiquidGlassContainerView = LiquidGlass.LiquidGlassContainerView;
    isLiquidGlassSupported = LiquidGlass.isLiquidGlassSupported;
  } catch (error) {
    console.warn("Failed to load @callstack/liquid-glass:", error);
  }
}

// Height of each sub-button row
const BTN_HEIGHT = 50;
// Gap between rows
const BTN_GAP = 8;
// Total height of 3-button column
const COL_HEIGHT = BTN_HEIGHT * 3 + BTN_GAP * 2;

const CustomTabBarButton = ({ onPress, bottomOffset = 0 }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  // Single value drives the whole column: 0 = hidden (below anchor), 1 = visible
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [showButtons, setShowButtons] = useState(false);
  const navigation = useNavigation();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const isRealGlass = Platform.OS === 'ios' && LiquidGlassView && LiquidGlassContainerView && isLiquidGlassSupported;
  const isIosFallback = Platform.OS === 'ios' && LiquidGlassView && !isLiquidGlassSupported;

  useEffect(() => {
    return () => {
      if (showButtons) animateOut();
    };
  }, [showButtons]);

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(menuAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 280,
        damping: 24,
        mass: 0.8,
      }),
      Animated.timing(rotation, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(menuAnim, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 320,
        damping: 28,
        mass: 0.7,
      }),
      Animated.timing(rotation, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => setShowButtons(false));
  };

  const handlePress = () => {
    if (showButtons) {
      animateOut();
    } else {
      if (onPress) onPress();
      setShowButtons(true);
      animateIn();
    }
  };

  const handleDismiss = () => {
    if (showButtons) animateOut();
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  // Column slides up from anchor position and fades in
  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COL_HEIGHT + 16, 0], // starts just below anchor, slides up
  });

  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 1],
  });

  // Pill background
  const pillBg = isDarkMode
    ? "rgba(28, 28, 30, 0.82)"
    : "rgba(255, 255, 255, 0.82)";
  const pillBorder = isDarkMode
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(0, 0, 0, 0.06)";

  const renderButtonContent = (icon, labelKey, onBtnPress) => (
    <TouchableOpacity
      style={styles.rowTouch}
      onPress={() => {
        onBtnPress();
        handleDismiss();
      }}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
        <Ionicons name={icon} size={22} color={theme.primary} />
      </View>
      <Text style={[styles.rowText, { color: isDarkMode ? "#F0F0F0" : "#1C1C1E" }]} numberOfLines={1}>
        {t(labelKey)}
      </Text>
    </TouchableOpacity>
  );

  const menuButtons = [
    { icon: "create-outline", labelKey: "createActions.post", onPress: () => navigation.navigate("CreatePostScreen") },
    { icon: "mic-outline", labelKey: "createActions.recording", onPress: () => Toast.show({ type: "info", text1: t('createActions.development') }) },
    { icon: "document-text-outline", labelKey: "createActions.report", onPress: () => navigation.navigate("ReportScreen") },
  ];

  const renderMenu = () => {
    if (isRealGlass) {
      return (
        <LiquidGlassContainerView
          spacing={10}
          style={styles.glassContainer}
        >
          {menuButtons.map((btn, i) => (
            <LiquidGlassView
              key={i}
              effect="regular"
              interactive={true}
              colorScheme={isDarkMode ? 'dark' : 'light'}
              tintColor={isDarkMode ? "rgba(30, 30, 30, 0.4)" : "rgba(255, 255, 255, 0.25)"}
              style={styles.glassRow}
            >
              {renderButtonContent(btn.icon, btn.labelKey, btn.onPress)}
            </LiquidGlassView>
          ))}
        </LiquidGlassContainerView>
      );
    }

    if (isIosFallback) {
      return (
        <View style={styles.columnContainer}>
          {menuButtons.map((btn, i) => (
            <LiquidGlassView
              key={i}
              effect="regular"
              interactive={false}
              colorScheme={isDarkMode ? 'dark' : 'light'}
              tintColor={isDarkMode ? "rgba(30, 30, 30, 0.4)" : "rgba(255, 255, 255, 0.25)"}
              style={[
                styles.pillRow,
                {
                  backgroundColor: isDarkMode ? "rgba(36, 36, 38, 0.82)" : "rgba(255, 255, 255, 0.82)",
                  borderColor: pillBorder,
                  marginBottom: i < menuButtons.length - 1 ? BTN_GAP : 0,
                }
              ]}
            >
              {renderButtonContent(btn.icon, btn.labelKey, btn.onPress)}
            </LiquidGlassView>
          ))}
        </View>
      );
    }

    // Android / no glass
    return (
      <View style={styles.columnContainer}>
        {menuButtons.map((btn, i) => (
          <View
            key={i}
            style={[
              styles.pillRow,
              {
                backgroundColor: pillBg,
                borderColor: pillBorder,
                marginBottom: i < menuButtons.length - 1 ? BTN_GAP : 0,
                elevation: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
              }
            ]}
          >
            {renderButtonContent(btn.icon, btn.labelKey, btn.onPress)}
          </View>
        ))}
      </View>
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

        {/* Anchor positioned at same location as right pill */}
        <Animated.View
          style={{
            position: "absolute",
            bottom: Platform.OS === 'ios'
              ? (bottomOffset > 0 ? bottomOffset + 8 + 56 + 16 : 24 + 56 + 16)
              : (bottomOffset > 0 ? bottomOffset + 8 + 56 + 16 : 12 + 56 + 16),
            right: 20,
            width: 160,
            alignItems: 'flex-end',
            opacity: menuOpacity,
            transform: [{ translateY: menuTranslateY }],
          }}
          pointerEvents="box-none"
        >
          {renderMenu()}
        </Animated.View>
      </Modal>

      <Pressable style={styles.buttonContainer} onPress={handlePress}>
        <Animated.View style={[styles.iconContainer, { transform: [{ rotate }] }]}>
          <View style={styles.iconCircle}>
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
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  iconContainer: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 28,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    shadowColor: "#319527",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  // Real glass: LiquidGlassContainerView wraps all rows (connected morphing)
  glassContainer: {
    width: 160,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  glassRow: {
    width: 160,
    height: BTN_HEIGHT,
    borderRadius: BTN_HEIGHT / 2,
    overflow: 'hidden',
  },
  // Fallback / Android: manual column
  columnContainer: {
    width: 160,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  pillRow: {
    width: 160,
    height: BTN_HEIGHT,
    borderRadius: BTN_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
  },
  rowTouch: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rowText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});

export default CustomTabBarButton;