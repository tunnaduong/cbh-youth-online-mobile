import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dimensions, View, Platform, StyleSheet, Text, TouchableOpacity, Animated, PanResponder, DeviceEventEmitter, InteractionManager, TouchableWithoutFeedback } from "react-native";
import Sidebar from "../../components/Sidebar";
import * as Haptics from "expo-haptics";
import { createBottomTabNavigator, BottomTabBar } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./HomeScreen";
import CustomTabBarButton from "../../components/CustomTabBarButton";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./ForumScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatScreen from "./ChatScreen";
import NotificationScreen from "./NotificationScreen";
import { useUnreadCountsContext } from "../../contexts/UnreadCountsContext";
import TabBarBadge from "../../components/TabBarBadge";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

import {
  LiquidGlassView,
  LiquidGlassContainer,
  LiquidGlassProviderAndroid,
  useIOSGlass,
} from "../../components/GlassModules";

// NativeBlurView: raw blur from the already-linked iOS library.
// Only used on iOS < 26 (where useIOSGlass is false) as the pill background.
// Imported defensively — null if the library isn't linked or named differently.
let NativeBlurView = null;
try {
  NativeBlurView = require("@sbaiahmed1/react-native-blur").BlurView;
} catch (e) {
  // library not linked — fallback renders flat color instead
}


const ScreenWrapper = ({ children, routeName }) => {
  const { theme } = useTheme();

  if (Platform.OS === 'android' && LiquidGlassProviderAndroid) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <LiquidGlassProviderAndroid providerId={routeName} style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: theme.background }}>
            {children}
          </View>
        </LiquidGlassProviderAndroid>
      </View>
    );
  }
  return children;
};

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

const TabBarBackgroundComponent = ({ currentRoute, isDarkMode, hideTabLabels, theme }) => {
  const [tabBarWidth, setTabBarWidth] = useState(Dimensions.get("window").width - 190);
  const [glassProviderId, setGlassProviderId] = useState(currentRoute);
  const [glassKey, setGlassKey] = useState(0);

  useEffect(() => {
    setGlassProviderId(currentRoute);
    setGlassKey(prev => prev + 1);
  }, [currentRoute]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const onLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width) {
      setTabBarWidth(width);
    }
  };

  const getRouteIndex = (routeName) => {
    switch (routeName) {
      case "Home": return 0;
      case "Forum": return 1;
      case "Create": return 2;
      case "Chat": return 3;
      case "Notifications": return 4;
      default: return 0;
    }
  };

  const activeIndex = getRouteIndex(currentRoute);
  const usableWidth = tabBarWidth;
  const buttonWidth = usableWidth / 5;

  const getIndicatorWidth = (index, bWidth) => {
    return bWidth;
  };

  const getIndicatorLeft = (index, bWidth) => {
    return index * bWidth;
  };

  const currentIndicatorWidth = getIndicatorWidth(activeIndex, buttonWidth);
  const currentIndicatorLeft = getIndicatorLeft(activeIndex, buttonWidth);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentIndicatorLeft,
      useNativeDriver: true,
      stiffness: 400,
      damping: 35,
      mass: 0.5,
    }).start();
  }, [currentIndicatorLeft]);

  const opacity = activeIndex === 2 ? 0 : 1;

  // Android: OneUI-style transparent tint for surrounding (tab background only)
  if (Platform.OS === 'android') {
    // OneUI-style tinted transparent surface
    const androidSurface = isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.72)";
    const androidBorder = isDarkMode ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.07)";
    const androidIndicator = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";

    return (
      <View
        onLayout={onLayout}
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 24.5,
          overflow: "hidden",
          backgroundColor: androidSurface,
          borderWidth: 1.0,
          borderColor: androidBorder,
        }}
      >
        {/* Active indicator */}
        <Animated.View
          style={{
            position: "absolute",
            width: currentIndicatorWidth,
            height: 49,
            borderRadius: 24.5,
            top: 0,
            left: 0,
            opacity,
            transform: [{ translateX: slideAnim }],
            backgroundColor: androidIndicator,
          }}
        />
      </View>
    );
  }

  const isIOS = Platform.OS === "ios";

  if (isIOS && useIOSGlass) {
    const isRealGlass = useIOSGlass;
    return (
      <LiquidGlassView
        glassType="clear"
        glassTintColor={isDarkMode ? "#1E1E1E59" : "#FFFFFF26"}
        glassOpacity={1}
        isInteractive={isRealGlass}
        onLayout={onLayout}
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 24.5,
          overflow: "hidden",
          backgroundColor: isRealGlass ? "transparent" : (isDarkMode ? "rgba(30, 30, 30, 0.8)" : "rgba(240, 240, 240, 0.75)"),
          borderWidth: 1.0,
          borderColor: isDarkMode ? `${theme.primary}25` : `${theme.primary}18`,
        }}
      >
        {/* Chromatic Aberration - Red channel shift (left offset) */}
        <Animated.View
          style={{
            position: "absolute",
            width: currentIndicatorWidth,
            height: 49,
            borderRadius: 24.5,
            top: 0,
            left: -0.8,
            opacity: opacity * 0.35,
            transform: [{ translateX: slideAnim }],
            backgroundColor: isDarkMode ? "rgba(255, 60, 60, 0.06)" : "rgba(255, 60, 60, 0.22)",
          }}
        />
        {/* Chromatic Aberration - Blue channel shift (right offset) */}
        <Animated.View
          style={{
            position: "absolute",
            width: currentIndicatorWidth,
            height: 49,
            borderRadius: 24.5,
            top: 0,
            left: 0.8,
            opacity: opacity * 0.35,
            transform: [{ translateX: slideAnim }],
            backgroundColor: isDarkMode ? "rgba(60, 160, 255, 0.06)" : "rgba(60, 160, 255, 0.22)",
          }}
        />
        {/* Main Glass Indicator - sits on top of outer LiquidGlassView glass layer */}
        <Animated.View
          style={{
            position: "absolute",
            width: currentIndicatorWidth,
            height: 49,
            borderRadius: 24.5,
            top: 0,
            left: 0,
            opacity,
            transform: [{ translateX: slideAnim }],
            backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)",
            shadowColor: isDarkMode ? "#fff" : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.3 : 0.15,
            shadowRadius: 6,
            elevation: 3,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={[
              isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.5)",
              isDarkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.15)",
              "transparent"
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </LiquidGlassView>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24.5,
        overflow: "hidden",
        backgroundColor: isDarkMode ? `${theme.primary}16` : `${theme.primary}10`,
        borderWidth: 1.0,
        borderColor: isDarkMode ? `${theme.primary}33` : `${theme.primary}22`,
      }}
    >
      {/* Chromatic Aberration - Red channel shift (left offset) */}
      <Animated.View
        style={{
          position: "absolute",
          width: currentIndicatorWidth,
          height: 49,
          borderRadius: 24.5,
          top: 0,
          left: -0.8,
          opacity: opacity * 0.15,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(255, 60, 60, 0.03)" : "rgba(255, 60, 60, 0.1)",
        }}
      />
      {/* Chromatic Aberration - Blue channel shift (right offset) */}
      <Animated.View
        style={{
          position: "absolute",
          width: currentIndicatorWidth,
          height: 49,
          borderRadius: 24.5,
          top: 0,
          left: 0.8,
          opacity: opacity * 0.15,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(60, 160, 255, 0.03)" : "rgba(60, 160, 255, 0.1)",
        }}
      />
      {/* Main Glass Indicator (neutral white/dark) */}
      <Animated.View
        style={{
          position: "absolute",
          width: currentIndicatorWidth,
          height: 49,
          borderRadius: 24.5,
          top: 0,
          left: 0,
          opacity,
          transform: [{ translateX: slideAnim }],
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)",
          shadowColor: isDarkMode ? "#fff" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.3 : 0.15,
          shadowRadius: 6,
          elevation: 3,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={[
            isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.5)",
            isDarkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.15)",
            "transparent"
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

const CustomTabBar = ({
  state,
  descriptors,
  navigation,
  chatUnreadCount,
  notificationUnreadCount,
  triggerHomeScrollOrReload,
  triggerForumScrollOrReload,
  triggerChatScrollOrReload,
  triggerNotificationScrollOrReload,
  tabBarTranslateY,
  onLayout,
}) => {
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.OS === 'ios'
    ? (insets.bottom > 0 ? insets.bottom + 8 : 24)
    : (insets.bottom > 0 ? insets.bottom + 8 : 16);
  const { t } = useTranslation();
  const [tabBarWidth, setTabBarWidth] = useState(Dimensions.get("window").width - 108);

  const nativeSlideAnim = useRef(new Animated.Value(0)).current;
  const jsSlideAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = jsSlideAnim;

  const stretchAnim = useRef(new Animated.Value(0)).current;
  const offsetAnim = useRef(new Animated.Value(0)).current;

  const indicatorWidthBase = useRef(new Animated.Value(0)).current;
  const indicatorAnimatedWidth = useRef(Animated.add(indicatorWidthBase, stretchAnim)).current;
  const indicatorDragOffset = useRef(offsetAnim).current;
  const indicatorAnimatedTranslateX = useRef(jsSlideAnim).current;

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const lastHapticIndex = useRef(-1);
  const tabBarWidthRef = useRef(tabBarWidth);
  const bWidthAtGrant = useRef(0);

  const leftRouteNames = ["Home", "Forum", "Chat", "Notifications"];
  const leftRoutes = React.useMemo(() => {
    return state.routes
      .filter((route) => leftRouteNames.includes(route.name))
      .map((route) => ({
        route,
        index: state.routes.indexOf(route),
        descriptor: descriptors[route.key],
      }));
  }, [state.routes, descriptors]);

  const activeRouteName = state.routes[state.index]?.name;
  const activeLeftIndex = leftRoutes.findIndex(({ route }) => route.name === activeRouteName);
  const activeLeftIndexRef = useRef(activeLeftIndex);

  const usableWidth = tabBarWidth;
  const buttonWidth = usableWidth / Math.max(1, leftRoutes.length);
  const currentIndicatorWidth = buttonWidth;
  const currentIndicatorLeft = (activeLeftIndex >= 0 ? activeLeftIndex : 0) * buttonWidth;

  useEffect(() => {
    tabBarWidthRef.current = tabBarWidth;
  }, [tabBarWidth]);

  useEffect(() => {
    activeLeftIndexRef.current = activeLeftIndex;
  }, [activeLeftIndex]);

  useEffect(() => {
    indicatorWidthBase.setValue(currentIndicatorWidth);
  }, [currentIndicatorWidth]);

  useEffect(() => {
    if (isDragging.current) return;
    Animated.timing(nativeSlideAnim, {
      toValue: currentIndicatorLeft,
      duration: 280,
      useNativeDriver: true,
    }).start();
    jsSlideAnim.setValue(currentIndicatorLeft);
    Animated.spring(stretchAnim, {
      toValue: 0,
      useNativeDriver: false,
      stiffness: 400,
      damping: 35,
      mass: 0.5,
    }).start();
    Animated.spring(offsetAnim, {
      toValue: 0,
      useNativeDriver: false,
      stiffness: 400,
      damping: 35,
      mass: 0.5,
    }).start();
  }, [currentIndicatorLeft]);

  const onLeftPillLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width) {
      setTabBarWidth(width);
      tabBarWidthRef.current = width;
    }
  };

  const navigateToLeftIndexRef = useRef(null);

  const navigateToLeftIndex = useCallback((leftIdx) => {
    const target = leftRoutes[leftIdx];
    if (!target) return;
    const { route } = target;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }, [leftRoutes, navigation]);

  useEffect(() => {
    navigateToLeftIndexRef.current = navigateToLeftIndex;
  }, [navigateToLeftIndex]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false, 
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false, 
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => false,
      onPanResponderGrant: (evt, gestureState) => {
        isDragging.current = true;
        DeviceEventEmitter.emit("SET_FEED_SCROLL_ENABLED", false);
        lastHapticIndex.current = activeLeftIndexRef.current;
        bWidthAtGrant.current = (tabBarWidthRef.current - 2) / 4;
        slideAnim.stopAnimation((currentVal) => {
          dragStartX.current = currentVal;
        });
        nativeSlideAnim.stopAnimation();
        stretchAnim.stopAnimation();
        offsetAnim.stopAnimation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt, gestureState) => {
        const bWidth = bWidthAtGrant.current;
        const rawX = dragStartX.current + gestureState.dx;
        const minX = 0;
        const maxX = bWidth * 3;

        let clampedX;
        if (rawX < minX) {
          clampedX = minX + (rawX - minX) * 0.2;
        } else if (rawX > maxX) {
          clampedX = maxX + (rawX - maxX) * 0.2;
        } else {
          clampedX = rawX;
        }

        slideAnim.setValue(clampedX);
        Animated.timing(nativeSlideAnim, {
          toValue: clampedX,
          duration: 0,
          useNativeDriver: true,
        }).start();

        const extraStretch = 0;
        stretchAnim.setValue(extraStretch);

        const directionOffset = gestureState.dx < 0 ? -extraStretch : 0;
        offsetAnim.setValue(directionOffset);

        const indicatorCenter = clampedX + bWidth / 2;
        const hoveredIndex = Math.min(3, Math.max(0, Math.floor(indicatorCenter / bWidth)));

        if (hoveredIndex !== lastHapticIndex.current) {
          lastHapticIndex.current = hoveredIndex;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        isDragging.current = false;
        DeviceEventEmitter.emit("SET_FEED_SCROLL_ENABLED", true);
        const bWidth = bWidthAtGrant.current;

        const rawX = dragStartX.current + gestureState.dx;
        const clampedX = Math.min(bWidth * 3, Math.max(0, rawX));
        const snappedIndex = Math.min(3, Math.max(0, Math.round(clampedX / bWidth)));
        const snapTarget = snappedIndex * bWidth;

        Animated.spring(slideAnim, {
          toValue: snapTarget,
          useNativeDriver: false,
          stiffness: 280,
          damping: 30,
          mass: 0.6,
        }).start();
        Animated.spring(nativeSlideAnim, {
          toValue: snapTarget,
          useNativeDriver: true,
          stiffness: 280,
          damping: 30,
          mass: 0.6,
        }).start();

        Animated.spring(stretchAnim, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 400,
          damping: 34,
          mass: 0.5,
        }).start();
        Animated.spring(offsetAnim, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 400,
          damping: 34,
          mass: 0.5,
        }).start();

        if (snappedIndex !== activeLeftIndexRef.current) {
          navigateToLeftIndexRef.current?.(snappedIndex);
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        DeviceEventEmitter.emit("SET_FEED_SCROLL_ENABLED", true);
        const bWidth = bWidthAtGrant.current || (tabBarWidthRef.current - 2) / 4;
        const snapTarget = (activeLeftIndexRef.current >= 0 ? activeLeftIndexRef.current : 0) * bWidth;
        Animated.spring(slideAnim, {
          toValue: snapTarget,
          useNativeDriver: false,
          stiffness: 200,
          damping: 20,
        }).start();
        Animated.spring(nativeSlideAnim, {
          toValue: snapTarget,
          useNativeDriver: true,
          stiffness: 200,
          damping: 20,
        }).start();
        Animated.spring(stretchAnim, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 260,
          damping: 22,
        }).start();
        Animated.spring(offsetAnim, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 260,
          damping: 22,
        }).start();
      },
    })
  ).current;

  const opacity = activeRouteName === "Create" ? 0 : 1;
  const fallbackSurfaceTint = isDarkMode ? `${theme.primary}16` : `${theme.primary}10`;
  const fallbackBorderTint = isDarkMode ? `${theme.primary}33` : `${theme.primary}22`;
  const fallbackIndicatorTint = isDarkMode ? `${theme.primary}18` : `${theme.primary}12`;
  const androidFallbackSurfaceTint = isDarkMode ? "rgba(18, 18, 18, 0.78)" : "rgba(255, 255, 255, 0.78)";
  const androidFallbackBorderTint = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";

  const renderButtons = useCallback(() => {
    return leftRoutes.map(({ route, index, descriptor }, leftIdx) => {
      if (!route) return null;
      const isFocused = state.routes[state.index]?.key === route.key;
      const options = descriptor?.options || {};

      const onPress = () => {
        if (isDragging.current) return;
        if (isFocused) {
          if (route.name === "Home") triggerHomeScrollOrReload();
          else if (route.name === "Forum") triggerForumScrollOrReload();
          else if (route.name === "Chat") triggerChatScrollOrReload();
          else if (route.name === "Notifications") triggerNotificationScrollOrReload();
          return;
        }
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      };

      let iconName;
      let badgeCount = null;
      if (route.name === "Home") {
        iconName = isFocused ? "home" : "home-outline";
      } else if (route.name === "Forum") {
        iconName = isFocused ? "people" : "people-outline";
      } else if (route.name === "Chat") {
        iconName = isFocused ? "chatbubble" : "chatbubble-outline";
        badgeCount = chatUnreadCount;
      } else if (route.name === "Notifications") {
        iconName = isFocused ? "notifications" : "notifications-outline";
        badgeCount = notificationUnreadCount;
      }

      const tintColor = isFocused
        ? theme.primary
        : (isDarkMode ? "#A0A0A0" : "gray");

      return (
        <TouchableOpacity
          key={route.key}
          onPress={onPress}
          style={styles.iosTabButton}
          activeOpacity={0.8}
        >
          <View style={styles.iosTabButtonInner}>
            <View style={{ position: "relative" }}>
              <Ionicons name={iconName} size={24} color={tintColor} />
              {badgeCount !== null && <TabBarBadge count={badgeCount} />}
            </View>
            {!hideTabLabels && (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.iosTabLabel,
                  {
                    color: tintColor,
                    fontWeight: isFocused ? "bold" : "normal",
                  },
                ]}
              >
                {options.title || route.name}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    });
  }, [leftRoutes, state.routes, state.index, isDarkMode, hideTabLabels, theme, navigation,
      triggerHomeScrollOrReload, triggerForumScrollOrReload, triggerChatScrollOrReload, triggerNotificationScrollOrReload]);

  if (Platform.OS === 'android') {
    // OneUI-style: transparent surface with tint, no liquid glass for surrounding components
    const androidSurface = isDarkMode ? "rgba(18, 18, 18, 0.80)" : "rgba(255, 255, 255, 0.80)";
    const androidBorder = isDarkMode ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.07)";
    const androidIndicatorBg = isDarkMode ? "rgba(255, 255, 255, 0.13)" : "rgba(0, 0, 0, 0.08)";

    return (
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: tabBarTranslateY }],
          zIndex: 99,
        }}
      >
        <View style={[styles.iosTabBarContainer, { bottom: bottomOffset }]}>
          {/* Left pill - OneUI tint style */}
          <View
            {...panResponder.panHandlers}
            onLayout={onLeftPillLayout}
            style={[styles.iosLeftPill, { backgroundColor: 'transparent' }]}
          >
            {/* Tinted transparent background */}
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 24.5,
                backgroundColor: androidSurface,
                borderWidth: 1.0,
                borderColor: androidBorder,
              }}
            />
            {/* Active tab indicator */}
            <Animated.View
              style={{
                position: "absolute",
                top: 1,
                left: 0,
                transform: [{ translateX: nativeSlideAnim }],
              }}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  width: indicatorAnimatedWidth,
                  height: 47,
                  borderRadius: 23.5,
                  backgroundColor: androidIndicatorBg,
                  opacity,
                  transform: [{ translateX: indicatorDragOffset }],
                }}
              />
            </Animated.View>
            {renderButtons()}
          </View>

          {/* Right pill (create button) - OneUI tint style */}
          <View style={styles.iosRightPill}>
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 26.5,
                backgroundColor: androidSurface,
                borderWidth: 1.0,
                borderColor: androidBorder,
              }}
            />
            <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
              <CustomTabBarButton
                onPress={() => {}}
                bottomOffset={bottomOffset}
                currentRoute={activeRouteName}
              />
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  if (Platform.OS === 'ios' && useIOSGlass) {
    const isRealGlass = useIOSGlass;
    const pillBg = isDarkMode ? "rgba(30, 30, 30, 0.8)" : "rgba(240, 240, 240, 0.75)";
    const indicatorBg = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.45)";

    return (
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: tabBarTranslateY }],
          zIndex: 99,
        }}
      >
        <LiquidGlassContainer spacing={12} style={[styles.iosTabBarContainer, { bottom: bottomOffset }]}>
          <View
            {...panResponder.panHandlers}
            onLayout={onLeftPillLayout}
            style={[styles.iosLeftPill, { backgroundColor: 'transparent' }]}
          >
            <LiquidGlassView
              glassType="clear"
              glassTintColor={isDarkMode ? "#1E1E1E59" : "#FFFFFF26"}
              glassOpacity={1}
              isInteractive={isRealGlass}
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 24.5,
                backgroundColor: isRealGlass ? "transparent" : pillBg,
                borderWidth: 1.0,
                borderColor: isDarkMode ? `${theme.primary}25` : `${theme.primary}18`,
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                top: 1,
                left: 0,
                transform: [{ translateX: nativeSlideAnim }],
              }}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  width: indicatorAnimatedWidth,
                  height: 47,
                  borderRadius: 23.5,
                  backgroundColor: indicatorBg,
                  opacity,
                  shadowColor: isDarkMode ? "#fff" : "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDarkMode ? 0.3 : 0.15,
                  shadowRadius: 6,
                  elevation: 3,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[
                    isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.5)",
                    isDarkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.15)",
                    "transparent"
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </Animated.View>
            {renderButtons()}
          </View>

          <LiquidGlassView
            glassType="clear"
            glassTintColor={isDarkMode ? "#1E1E1E59" : "#FFFFFF26"}
            glassOpacity={1}
            isInteractive={isRealGlass}
            style={[
              styles.iosRightPill,
              {
                backgroundColor: isRealGlass ? "transparent" : pillBg,
                borderWidth: 1.0,
                borderColor: isDarkMode ? `${theme.primary}25` : `${theme.primary}18`,
              }
            ]}
          >
            <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
              <CustomTabBarButton
                onPress={() => {}}
                bottomOffset={bottomOffset}
                currentRoute={activeRouteName}
              />
            </View>
          </LiquidGlassView>
        </LiquidGlassContainer>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      onLayout={onLayout}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        transform: [{ translateY: tabBarTranslateY }],
        zIndex: 99,
      }}
    >
      <View style={[styles.iosTabBarContainer, { bottom: bottomOffset }]}>
        <View
          {...panResponder.panHandlers}
          onLayout={onLeftPillLayout}
          style={styles.iosLeftPill}
        >
          <View
            collapsable={false}
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 24.5,
              overflow: "hidden",
              backgroundColor: Platform.OS === 'android'
                ? androidFallbackSurfaceTint
                : ((Platform.OS === "ios" && NativeBlurView) ? "transparent" : fallbackSurfaceTint),
              borderWidth: 1.0,
              borderColor: Platform.OS === 'android' ? androidFallbackBorderTint : fallbackBorderTint,
            }}
          >
            {Platform.OS === "ios" && NativeBlurView && (
              <NativeBlurView
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: 24.5,
                  overflow: "hidden",
                  zIndex: -1,
                  elevation: -1,
                }}
                blurType={isDarkMode ? "dark" : "light"}
                blurAmount={14}
              />
            )}
          </View>
          <View
            pointerEvents="box-none"
            style={{ ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center' }}
          >
            <Animated.View
              style={{
                position: "absolute",
                top: 1,
                left: 0,
                transform: [{ translateX: nativeSlideAnim }],
              }}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  width: indicatorAnimatedWidth,
                  height: 47,
                  borderRadius: 23.5,
                  top: 0,
                  left: -0.8,
                  opacity: opacity * 0.15,
                  transform: [{ translateX: indicatorDragOffset }],
                  backgroundColor: isDarkMode ? "rgba(255, 60, 60, 0.03)" : "rgba(255, 60, 60, 0.1)",
                }}
              />
              <Animated.View
                style={{
                  position: "absolute",
                  width: indicatorAnimatedWidth,
                  height: 47,
                  borderRadius: 23.5,
                  top: 0,
                  left: 0.8,
                  opacity: opacity * 0.15,
                  transform: [{ translateX: indicatorDragOffset }],
                  backgroundColor: isDarkMode ? "rgba(60, 160, 255, 0.03)" : "rgba(60, 160, 255, 0.1)",
                }}
              />
              <Animated.View
                style={{
                  width: indicatorAnimatedWidth,
                  height: 47,
                  borderRadius: 23.5,
                  opacity,
                  transform: [{ translateX: indicatorDragOffset }],
                  backgroundColor: fallbackIndicatorTint,
                  shadowColor: isDarkMode ? "#fff" : "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDarkMode ? 0.3 : 0.15,
                  shadowRadius: 6,
                  elevation: 3,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[
                    isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.5)",
                    isDarkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.15)",
                    "transparent"
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </Animated.View>
            {renderButtons()}
          </View>
        </View>

        <View style={styles.iosRightPill}>
          <View
            collapsable={false}
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 26.5,
              overflow: "hidden",
              backgroundColor: Platform.OS === 'android'
                ? androidFallbackSurfaceTint
                : ((Platform.OS === "ios" && NativeBlurView) ? "transparent" : fallbackSurfaceTint),
              borderWidth: 1.0,
              borderColor: Platform.OS === 'android' ? androidFallbackBorderTint : fallbackBorderTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {Platform.OS === "ios" && NativeBlurView && (
              <NativeBlurView
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: 26.5,
                  overflow: "hidden",
                  zIndex: -1,
                  elevation: -1,
                }}
                blurType={isDarkMode ? "dark" : "light"}
                blurAmount={14}
              />
            )}
            <View
              pointerEvents="box-none"
              style={
                Platform.OS === "ios" && NativeBlurView
                  ? { ...StyleSheet.absoluteFillObject, zIndex: 1, elevation: 1, alignItems: 'center', justifyContent: 'center' }
                  : { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }
              }
            >
              <CustomTabBarButton
                onPress={() => {}}
                bottomOffset={bottomOffset}
                currentRoute={activeRouteName}
              />
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};


export default function MainScreens({ navigation: stackNavigation }) {
  const [setting, setSetting] = React.useState(false);
  const insets = useSafeAreaInsets();
  const [currentRoute, setCurrentRoute] = useState("Home");
  const tabBarHeightRef = useRef(null);
  const tabBarHeightForHide = useRef(100);
  const drawerTranslateX = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(drawerTranslateX, {
      toValue: setting ? 0 : -Dimensions.get('window').width,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    Animated.timing(backdropOpacity, {
      toValue: setting ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [setting, drawerTranslateX, backdropOpacity]);

  const { chatUnreadCount, notificationUnreadCount } = useUnreadCountsContext();
  const tabNavigatorRef = useRef(null);
  const homeScreenScrollTriggerRef = useRef(null);
  const forumScrollTriggerRef = useRef(null);
  const chatScrollTriggerRef = useRef(null);
  const notificationScrollTriggerRef = useRef(null);
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const { t } = useTranslation();

  // Function to trigger scroll to top or reload in HomeScreen
  const triggerHomeScrollOrReload = () => {
    if (homeScreenScrollTriggerRef.current) {
      homeScreenScrollTriggerRef.current(Date.now());
    }
  };

  const triggerForumScrollOrReload = () => {
    if (forumScrollTriggerRef.current) {
      forumScrollTriggerRef.current(Date.now());
    }
  };

  const triggerChatScrollOrReload = () => {
    if (chatScrollTriggerRef.current) {
      chatScrollTriggerRef.current(Date.now());
    }
  };

  const triggerNotificationScrollOrReload = () => {
    if (notificationScrollTriggerRef.current) {
      notificationScrollTriggerRef.current(Date.now());
    }
  };

  // This will be used to measure the tab bar height
  const onTabBarLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      tabBarHeightRef.current = height;
      // +16 buffer to ensure the pill fully exits the screen on Android
      // when system navbar is transparent (edge-to-edge), insets.bottom can be 28-48px
      tabBarHeightForHide.current = height + 16;
    }
  };

  // Add navigation state listener to track current route
  useEffect(() => {
    const unsubscribe = stackNavigation.addListener("state", (e) => {
      // Get the state of the bottom tab navigator
      const bottomTabState = e.data.state?.routes?.[0]?.state;
      if (bottomTabState) {
        const currentRouteName =
          bottomTabState.routes[bottomTabState.index].name;
        setCurrentRoute(currentRouteName);
      }
    });

    return unsubscribe;
  }, [stackNavigation]);

  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  // Listen for scroll events to auto hide/show tab bar
  useEffect(() => {
    let isVisible = true;
    const subscription = DeviceEventEmitter.addListener("SET_TABBAR_VISIBLE", (visible) => {
      if (visible === isVisible) return;
      isVisible = visible;
      Animated.timing(tabBarTranslateY, {
        // Use measured height instead of hardcoded 100px.
        // On Android with transparent system navbar (edge-to-edge), the tab bar
        // height includes insets.bottom which can exceed 100px, leaving a visible sliver.
        toValue: visible ? 0 : tabBarHeightForHide.current,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => subscription.remove();
  }, []);



  return (
    <View style={{ flex: 1 }}>
      {(() => {
        const navContent = (
          <Tab.Navigator
          ref={tabNavigatorRef}
          tabBar={(props) => {
            return (
              <CustomTabBar
                {...props}
                chatUnreadCount={chatUnreadCount}
                notificationUnreadCount={notificationUnreadCount}
                triggerHomeScrollOrReload={triggerHomeScrollOrReload}
                triggerForumScrollOrReload={triggerForumScrollOrReload}
                triggerChatScrollOrReload={triggerChatScrollOrReload}
                triggerNotificationScrollOrReload={triggerNotificationScrollOrReload}
                tabBarTranslateY={tabBarTranslateY}
                onLayout={onTabBarLayout}
              />
            );
          }}
          screenOptions={({ route }) => ({
            // Android: tắt animation mặc định của bottom tabs (fade JS-driven gây giật)
            // Tab content switch là tức thì — indicator animation trên tab bar vẫn chạy mượt
            animation: Platform.OS === 'android' ? 'none' : 'shift',
            // Tránh re-render toàn bộ scene khi chuyển tab
            lazy: true,
            // Giữ các screen đã mount (không unmount khi rời tab)
            unmountOnBlur: false,
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              let badgeCount = null;

              if (route.name === "Home") {
                iconName = focused ? "home" : "home-outline";
              } else if (route.name === "Forum") {
                iconName = focused ? "people" : "people-outline";
              } else if (route.name === "Notifications") {
                iconName = focused ? "notifications" : "notifications-outline";
                badgeCount = notificationUnreadCount;
              } else if (route.name === "Chat") {
                iconName = focused ? "chatbubble" : "chatbubble-outline";
                badgeCount = chatUnreadCount;
              }

              return (
                <View style={{ position: "relative" }}>
                  <Ionicons name={iconName} size={size} color={color} />
                  {badgeCount !== null && <TabBarBadge count={badgeCount} />}
                </View>
              );
            },
            tabBarShowLabel: !hideTabLabels,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: isDarkMode ? "#A0A0A0" : "gray",
            tabBarButton: (props) => {
              if (route.name === "Create") {
                return props.children;
              }
              const { children, style, onPress, onLongPress } = props;
              return (
                <TouchableOpacity
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={[
                    style,
                    {
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 16,
                      paddingVertical: 3,
                      paddingHorizontal: 10,
                      minWidth: 46,
                    }}
                  >
                    {children}
                  </View>
                </TouchableOpacity>
              );
            },
            tabBarStyle: {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 12 : 5,
              left: 95,
              right: 95,
              elevation: 10,
              borderRadius: 24.5,
              height: 49,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              paddingBottom: 0,
              paddingHorizontal: 8,
            },
            tabBarBackground: () => (
              <TabBarBackgroundComponent
                currentRoute={currentRoute}
                isDarkMode={isDarkMode}
                hideTabLabels={hideTabLabels}
                theme={theme}
              />
            ),
            tabBarLabelStyle: {
              fontSize: 9, // Font size for labels
              fontWeight: "bold",
              marginBottom: 3, // Space between icon and label
            },
            headerShadowVisible: false,
            headerTitleAlign: "center",
            headerTitleContainerStyle: {
              marginHorizontal: 0,
              paddingHorizontal: 0,
              width: Dimensions.get("window").width,
              alignItems: "center",
            },
            // Set a consistent header height for all tabs
            headerStyle: {
              height: 50 + insets.top, // Base height + top safe area inset
              backgroundColor: "transparent",
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTransparent: true,
          })}
        >
          <Tab.Screen
            name="Home"
            options={{
              title: t('navigation.home'),
              headerShown: true,
              headerBackButtonMenuEnabled: false,
              headerTitle: () => (
                <View style={{ width: Dimensions.get("window").width }}>
                  <SameHeader
                    icon="search"
                    action={() => stackNavigation.navigate("SearchScreen")}
                    havingIcon
                    setSetting={setSetting}
                    onLogoPress={triggerHomeScrollOrReload}
                    providerId="Home"
                  />
                </View>
              ),
            }}
            listeners={{
              tabPress: (e) => {
                // Check if already on Home tab using the tracked currentRoute state
                // This should be reliable since it's updated via navigation state listener
                if (currentRoute === "Home") {
                  // Prevent default navigation since we're already on Home
                  e.preventDefault();
                  // Trigger scroll to top or reload
                  triggerHomeScrollOrReload();
                }
              },
            }}
          >
            {(props) => (
              <ScreenWrapper routeName="Home">
                <HomeScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    homeScreenScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen
            name="Forum"
            options={{ title: t('navigation.forum'), headerShown: false }}
            listeners={{
              tabPress: (e) => {
                if (currentRoute === "Forum") {
                  e.preventDefault();
                  triggerForumScrollOrReload();
                }
              },
            }}
          >
            {(props) => (
              <ScreenWrapper routeName="Forum">
                <MenuScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    forumScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen
            name="Create"
            component={DummyComponent} // Use the dummy component
            options={{
              tabBarIconStyle: {
                display: "none",
              },
              tabBarLabelStyle: {
                top: 2,
                fontWeight: "bold",
              },
              tabBarButton: (props) => (
                <CustomTabBarButton
                  {...props}
                  currentRoute={currentRoute}
                  onPress={() => {
                    // Perform any action you want here
                    // console.log("Custom button pressed");
                  }}
                />
              ),
              title: t('navigation.create'),
            }}
          />
          <Tab.Screen
            name="Chat"
            options={{
              title: t('navigation.chat'),
              headerShown: false,
            }}
            listeners={{
              tabPress: (e) => {
                if (currentRoute === "Chat") {
                  e.preventDefault();
                  triggerChatScrollOrReload();
                }
              },
            }}
          >
            {(props) => (
              <ScreenWrapper routeName="Chat">
                <ChatScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    chatScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen
            name="Notifications"
            options={{
              title: t('navigation.notifications'),
              headerShown: false,
            }}
            listeners={{
              tabPress: (e) => {
                if (currentRoute === "Notifications") {
                  e.preventDefault();
                  triggerNotificationScrollOrReload();
                }
              },
            }}
          >
            {(props) => (
              <ScreenWrapper routeName="Notifications">
                <NotificationScreen
                  {...props}
                  scrollTriggerRef={(triggerFn) => {
                    notificationScrollTriggerRef.current = triggerFn;
                  }}
                />
              </ScreenWrapper>
            )}
          </Tab.Screen>
        </Tab.Navigator>
        );
        return <View style={{ flex: 1, backgroundColor: theme.background }}>{navContent}</View>;
      })()}
      
      {/* Overlay Backdrop */}
      <TouchableWithoutFeedback onPress={() => setSetting(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, opacity: backdropOpacity }]} pointerEvents={setting ? "auto" : "none"} />
      </TouchableWithoutFeedback>

      {/* Floating Sidebar Content */}
      <Animated.View style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        width: Dimensions.get('window').width * 0.75,
        zIndex: 101,
        transform: [{ translateX: drawerTranslateX }]
      }}>
        <Sidebar providerId={currentRoute} isOpen={setting} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iosTabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'transparent',
    zIndex: 99,
  },
  iosLeftPill: {
    flex: 1,
    height: 49,
    borderRadius: 24.5,
    position: 'relative',
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  iosTabButton: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  iosTabButtonInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosTabLabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  iosRightPill: {
    width: 53,
    height: 53,
    borderRadius: 26.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
});