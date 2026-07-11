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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import {
  LiquidGlassView,
  LiquidGlassContainer,
  LiquidGlassViewAndroid,
  isLiquidGlassSupportedAndroid,
  useIOSGlass,
} from "./GlassModules";

const { width, height } = Dimensions.get("window");

// Height of each sub-button row
const BTN_HEIGHT = 50;
// Gap between rows
const BTN_GAP = Platform.OS === 'ios' ? 16 : 8;
// Total height of 3-button column
const COL_HEIGHT = BTN_HEIGHT * 3 + BTN_GAP * 2;

const CustomTabBarButton = ({ onPress, bottomOffset = 0, currentRoute }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  // Single value drives the whole column: 0 = hidden (below anchor), 1 = visible
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [showButtons, setShowButtons] = useState(false);
  const navigation = useNavigation();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const isRealGlass = useIOSGlass;

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
      Animated.spring(rotation, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 280,
        damping: 24,
        mass: 0.8,
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
      Animated.spring(rotation, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 320,
        damping: 28,
        mass: 0.7,
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
    ? "rgba(18, 18, 18, 0.78)"
    : "rgba(255, 255, 255, 0.78)";
  const pillBorder = isDarkMode
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.08)";
  const fallbackTint = isDarkMode ? `${theme.primary}16` : `${theme.primary}12`;
  const fallbackBorderTint = isDarkMode ? `${theme.primary}33` : `${theme.primary}22`;

  const dynamicElevation = menuAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 4],
  });

  const dynamicShadowOpacity = menuAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 0.15],
  });

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
    if (Platform.OS === "ios" && isRealGlass) {
      return (
        <LiquidGlassContainer
          spacing={BTN_GAP}
          style={styles.glassContainer}
        >
          {menuButtons.map((btn, i) => (
            <LiquidGlassView
              key={i}
              glassType="clear"
              glassTintColor={isDarkMode ? "#111111DD" : "#F8F8F8DD"}
              glassOpacity={1}
              isInteractive={true}
              style={[
                styles.glassRow,
                {
                  marginBottom: i < menuButtons.length - 1 ? BTN_GAP : 0,
                  borderWidth: 0.5,
                  borderColor: isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                  shadowColor: isDarkMode ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.2)",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 1,
                  shadowRadius: 16,
                  elevation: 10,
                }
              ]}
            >
              {renderButtonContent(btn.icon, btn.labelKey, btn.onPress)}
            </LiquidGlassView>
          ))}
        </LiquidGlassContainer>
      );
    }

    return (
      <View style={styles.columnContainer}>
        {menuButtons.map((btn, i) => (
          <Animated.View
            key={i}
            style={[
              styles.pillRow,
              {
                backgroundColor: pillBg,
                borderColor: pillBorder,
                marginBottom: i < menuButtons.length - 1 ? BTN_GAP : 0,
                elevation: dynamicElevation,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: dynamicShadowOpacity,
                shadowRadius: 6,
              }
            ]}
          >
            {renderButtonContent(btn.icon, btn.labelKey, btn.onPress)}
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderButton = () => {
    const circleContent = (
      <MaterialCommunityIcons
        name="plus"
        size={38}
        color={theme.primary}
        style={styles.icon}
      />
    );

    if (Platform.OS === "ios" && isRealGlass) {
      // No nested LiquidGlassView here on purpose: this button already sits
      // inside the parent's iosRightPill <LiquidGlassView> in index.js.
      // Stacking a second glass layer on top doesn't merge with it (glass
      // can't sample glass) and reads as a separate, disconnected blob
      // instead of part of the floating tab bar.
      return (
        <Pressable style={styles.buttonContainer} onPress={handlePress}>
          <Animated.View style={[styles.iconContainer, { transform: [{ rotate }] }]}>
            {circleContent}
          </Animated.View>
        </Pressable>
      );
    }

    if (Platform.OS === "android" && isLiquidGlassSupportedAndroid && LiquidGlassViewAndroid) {
      const isAndroid33 = Platform.Version >= 33;
      const btnGlassProps = isAndroid33 ? {
        blurRadius: 12,
        refractionAmount: 40,
        refractionHeight: 18,
        chromaticAberration: 0.2,
        highlightAlpha: 0.25,
        tint: isDarkMode ? "rgba(0, 0, 0, 0.3)" : "rgba(240, 240, 240, 0.2)",
      } : {
        blurRadius: 10,
        refractionAmount: 0,
        refractionHeight: 0,
        chromaticAberration: 0,
        highlightAlpha: 0.18,
        tint: isDarkMode ? "rgba(0, 0, 0, 0.25)" : "rgba(240, 240, 240, 0.15)",
      };

      return (
        <Pressable style={styles.buttonContainer} onPress={handlePress}>
          <Animated.View style={[styles.iconContainer, { transform: [{ rotate }] }]}>
            <LiquidGlassViewAndroid
              providerId={currentRoute}
              interactive={isLiquidGlassSupportedAndroid}
              {...btnGlassProps}
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isLiquidGlassSupportedAndroid ? "transparent" : fallbackTint,
                  borderWidth: 1.0,
                  borderColor: isDarkMode ? fallbackBorderTint : fallbackBorderTint,
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                }
              ]}
            >
              {circleContent}
            </LiquidGlassViewAndroid>
          </Animated.View>
        </Pressable>
      );
    }

    return (
      <Pressable style={styles.buttonContainer} onPress={handlePress}>
        <Animated.View style={[styles.iconContainer, { transform: [{ rotate }] }]}>
          <View style={[
            styles.iconCircle,
            {
              backgroundColor: fallbackTint,
              borderWidth: 1.0,
              borderColor: fallbackBorderTint,
            }
          ]}>
            {circleContent}
          </View>
        </Animated.View>
      </Pressable>
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
              ? (bottomOffset > 0 ? bottomOffset + 8 + 53 + 16 : 24 + 53 + 16)
              : (bottomOffset > 0 ? bottomOffset + 8 + 53 + 16 : 12 + 53 + 16),
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

      {renderButton()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 53,
    height: 53,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainer: {
    width: 53,
    height: 53,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    // Add shadow to Pressable wrapper to prevent Ionicons layout shifts on iOS
    shadowColor: "#319527",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    transform: [
      { translateX: Platform.OS === 'ios' ? 0 : 0 }
    ]
  },
  iconContainer: {
    width: 53,
    height: 53,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 26.5,
  },
  iconCircle: {
    width: 53,
    height: 53,
    borderRadius: 26.5,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {},
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