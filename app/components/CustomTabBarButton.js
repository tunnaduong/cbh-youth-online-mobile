"use client";

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Pressable,
  Animated,
  Easing,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
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
  useAndroidGlass,
} from "./GlassModules";

const { width, height } = Dimensions.get("window");

// Height of each sub-button row
const BTN_HEIGHT = 50;
// Gap between rows
const BTN_GAP = Platform.OS === 'ios' ? 16 : 8;
// Total height of 3-button column
const COL_HEIGHT = BTN_HEIGHT * 3 + BTN_GAP * 2;

// When `showButton` is false the component renders only the create menu (no
// visible "+" button) and is opened imperatively via its ref — used when the
// trigger is a native center tab in the tab bar rather than a floating button.
const CustomTabBarButton = forwardRef(({ onPress, bottomOffset = 0, currentRoute, showButton = true }, ref) => {
  const rotation = useRef(new Animated.Value(0)).current;
  // Single value drives the whole column: 0 = hidden (below anchor), 1 = visible
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [showButtons, setShowButtons] = useState(false);
  const navigation = useNavigation();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const isRealGlass = useIOSGlass;

  // Drive the open animation from a mount effect so the menu view is actually
  // mounted before we animate it in (starting the animation in the same tick
  // as setShowButtons raced the mount and left the menu stuck half-faded).
  useEffect(() => {
    if (showButtons) {
      menuAnim.setValue(0);
      rotation.setValue(0);
      Animated.parallel([
        Animated.timing(menuAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showButtons]);

  // Fixed-duration timing (not spring) so the completion callback that unmounts
  // the menu always fires — an unsettled spring left the overlay stuck open.
  const animateOut = () => {
    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setShowButtons(false);
    });
  };

  const handlePress = () => {
    if (showButtons) {
      animateOut();
    } else {
      if (onPress) onPress();
      setShowButtons(true);
    }
  };

  const handleDismiss = () => {
    if (showButtons) animateOut();
  };

  // Imperative API for the menu-only mode (native center tab triggers it).
  useImperativeHandle(ref, () => ({
    open: () => {
      if (!showButtons) setShowButtons(true);
    },
    close: () => {
      if (showButtons) animateOut();
    },
  }), [showButtons]);

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
              effect="regular"
              tintColor={isDarkMode ? "#1E1E1E73" : "#FFFFFF66"}
              interactive={false}
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
              },
              // Android's `elevation` shadow always renders dark/black and
              // ignores borderRadius clipping, poking a square corner out
              // past this pill's rounded edge against the dark background.
              isDarkMode && { elevation: 0, shadowOpacity: 0 },
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
      // This button now floats independently above the native system tab bar
      // (no more custom iosRightPill wrapper), so it needs its own glass
      // background rather than relying on a parent glass pill.
      return (
        <Pressable style={styles.buttonContainer} onPress={handlePress}>
          <LiquidGlassView
            effect="regular"
            tintColor={isDarkMode ? "#1E1E1E59" : "#FFFFFF40"}
            interactive={true}
            style={styles.iconCircle}
          >
            <Animated.View style={[styles.iconContainer, { transform: [{ rotate }] }]}>
              {circleContent}
            </Animated.View>
          </LiquidGlassView>
        </Pressable>
      );
    }

    if (Platform.OS === "android" && useAndroidGlass) {
      // This button now floats independently above the native system tab bar
      // (no more custom iosRightPill wrapper), so it needs its own glass
      // background rather than relying on a parent glass pill.
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
                  borderWidth: 1.0,
                  borderColor: isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
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
              // Android fallback (no Liquid Glass): match the solid pill tint used
              // by the create-button subtabs (pillBg/pillBorder above) instead of
              // the near-transparent primary tint, which made the button invisible
              // against busy backgrounds. iOS fallback is left untouched.
              backgroundColor: Platform.OS === 'android' ? pillBg : fallbackTint,
              borderWidth: 1.0,
              borderColor: Platform.OS === 'android' ? pillBorder : fallbackBorderTint,
            }
          ]}>
            {circleContent}
          </View>
        </Animated.View>
      </Pressable>
    );
  };

  // Menu-only (center-tab) mode anchors the column centered above the tab bar;
  // floating-button mode keeps it right-aligned above the "+" button.
  const anchorPlacement = showButton
    ? {
        bottom: Platform.OS === 'ios'
          ? (bottomOffset > 0 ? bottomOffset + 8 + 53 + 16 : 24 + 53 + 16)
          : (bottomOffset > 0 ? bottomOffset + 8 + 53 + 16 : 12 + 53 + 16),
        right: 20,
        width: 160,
        alignItems: 'flex-end',
      }
    : {
        bottom: (bottomOffset > 0 ? bottomOffset : (Platform.OS === 'ios' ? 24 : 12)) + 8,
        left: 0,
        right: 0,
        alignItems: 'center',
      };

  const menuContents = (
    <>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleDismiss} />
      <Animated.View
        style={{
          position: "absolute",
          ...anchorPlacement,
          opacity: menuOpacity,
          transform: [{ translateY: menuTranslateY }],
        }}
        pointerEvents="box-none"
      >
        {renderMenu()}
      </Animated.View>
    </>
  );

  // Menu-only mode: render the menu as an in-tree full-screen overlay rather
  // than a Modal. A Modal is a separate native window — LiquidGlassView can't
  // sample the app content behind it (so it falls back to flat), and touch
  // routing across the modal boundary froze the screen on the New Architecture.
  // An in-tree overlay keeps real liquid glass and normal touch handling.
  if (!showButton) {
    if (!showButtons) return null;
    return (
      <View style={styles.menuOverlay} pointerEvents="box-none">
        {menuContents}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showButtons && (
        <View style={styles.menuOverlay} pointerEvents="box-none">
          {menuContents}
        </View>
      )}
      {renderButton()}
    </View>
  );
});

const styles = StyleSheet.create({
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 200,
  },
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