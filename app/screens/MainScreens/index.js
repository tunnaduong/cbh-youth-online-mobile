import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dimensions, View, Platform, StyleSheet, Text, TouchableOpacity, Animated, PanResponder, DeviceEventEmitter, InteractionManager } from "react-native";
import * as Haptics from "expo-haptics";
import { createBottomTabNavigator, BottomTabBar } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import HomeScreen from "./HomeScreen";
import CustomTabBarButton from "../../components/CustomTabBarButton";
import SameHeader from "../../components/SameHeader";
import MenuScreen from "./ForumScreen";
import SideMenu from "@chakrahq/react-native-side-menu";
import Sidebar from "../../components/Sidebar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatScreen from "./ChatScreen";
import NotificationScreen from "./NotificationScreen";
import { useUnreadCountsContext } from "../../contexts/UnreadCountsContext";
import TabBarBadge from "../../components/TabBarBadge";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

let LiquidGlassView = null;
let LiquidGlassContainerView = null;
let isLiquidGlassSupported = false;
let AnimatedLiquidGlassView = null;

if (Platform.OS === 'ios') {
  try {
    const LiquidGlass = require('@callstack/liquid-glass');
    LiquidGlassView = LiquidGlass.LiquidGlassView;
    LiquidGlassContainerView = LiquidGlass.LiquidGlassContainerView;
    isLiquidGlassSupported = LiquidGlass.isLiquidGlassSupported;
    if (LiquidGlassView) {
      AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);
    }
  } catch (error) {
    console.warn("Failed to load @callstack/liquid-glass:", error);
  }
}

const Tab = createBottomTabNavigator();
const DummyComponent = () => null;

const TabBarBackgroundComponent = ({ currentRoute, isDarkMode, hideTabLabels, theme }) => {
  const [tabBarWidth, setTabBarWidth] = useState(Dimensions.get("window").width - 190);
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
      stiffness: 140,
      damping: 14,
      mass: 1.2,
    }).start();
  }, [currentIndicatorLeft]);

  const opacity = activeIndex === 2 ? 0 : 1;
  const isIOS = Platform.OS === "ios";

  if (isIOS && LiquidGlassView) {
    const isRealGlass = isLiquidGlassSupported;
    return (
      <LiquidGlassView
        effect="regular"
        interactive={isRealGlass}
        onLayout={onLayout}
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: isRealGlass ? "transparent" : (isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.45)"),
          borderWidth: 1,
          borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Chromatic Aberration - Red channel shift (left offset) */}
        <Animated.View
          style={{
            position: "absolute",
            width: currentIndicatorWidth,
            height: 52,
            borderRadius: 26,
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
            height: 52,
            borderRadius: 26,
            top: 0,
            left: 0.8,
            opacity: opacity * 0.35,
            transform: [{ translateX: slideAnim }],
            backgroundColor: isDarkMode ? "rgba(60, 160, 255, 0.06)" : "rgba(60, 160, 255, 0.22)",
          }}
        />
        {/* Main Glass Indicator (neutral white/dark) */}
        <Animated.View
          style={{
            position: "absolute",
            width: currentIndicatorWidth,
            height: 52,
            borderRadius: 26,
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
        borderRadius: 26,
        overflow: "hidden",
        backgroundColor: isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.45)",
        borderWidth: 1,
        borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Chromatic Aberration - Red channel shift (left offset) */}
      <Animated.View
        style={{
          position: "absolute",
          width: currentIndicatorWidth,
          height: 52,
          borderRadius: 26,
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
          height: 52,
          borderRadius: 26,
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
          height: 52,
          borderRadius: 26,
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
}) => {
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.OS === 'ios'
    ? (insets.bottom > 0 ? insets.bottom + 8 : 24)
    : (insets.bottom > 0 ? insets.bottom + 8 : 12);
  const { t } = useTranslation();
  const [tabBarWidth, setTabBarWidth] = useState(Dimensions.get("window").width - 108);
  // All three anims must use useNativeDriver:false because slideAnim is combined
  // with offsetAnim via Animated.add(), and offsetAnim/stretchAnim drive `width`
  // which is JS-only. Mixing native + JS drivers on the same node crashes Android.
  const slideAnim = useRef(new Animated.Value(0)).current;
  // stretchAnim drives the liquid-glass width morph (useNativeDriver:false required)
  const stretchAnim = useRef(new Animated.Value(0)).current;
  // offsetAnim compensates translateX so the pill stretches toward drag direction
  const offsetAnim = useRef(new Animated.Value(0)).current;

  // Stable base value for indicator width — updated via setValue, never recreated
  const indicatorWidthBase = useRef(new Animated.Value(0)).current;
  // Stable composed animated values — created once, never recreated on re-render
  const indicatorAnimatedWidth = useRef(Animated.add(indicatorWidthBase, stretchAnim)).current;
  const indicatorAnimatedTranslateX = useRef(Animated.add(slideAnim, offsetAnim)).current;

  // Drag state refs (avoid re-renders during gesture)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const lastHapticIndex = useRef(-1);
  const tabBarWidthRef = useRef(tabBarWidth);
  // Store buttonWidth at gesture-start so stretch math is consistent
  const bWidthAtGrant = useRef(0);

  const leftRouteNames = ["Home", "Forum", "Chat", "Notifications"];
  const leftRoutes = leftRouteNames.map(name => {
    const route = state.routes.find(r => r.name === name);
    const index = state.routes.indexOf(route);
    const descriptor = descriptors[route.key];
    return { route, index, descriptor };
  });

  const activeRouteName = state.routes[state.index].name;
  const activeLeftIndex = leftRouteNames.indexOf(activeRouteName);
  const activeLeftIndexRef = useRef(activeLeftIndex);

  const usableWidth = tabBarWidth - 2;
  const buttonWidth = usableWidth / 4;
  const currentIndicatorWidth = buttonWidth;
  const currentIndicatorLeft = (activeLeftIndex >= 0 ? activeLeftIndex : 0) * buttonWidth;

  // Keep refs in sync
  useEffect(() => {
    tabBarWidthRef.current = tabBarWidth;
  }, [tabBarWidth]);

  useEffect(() => {
    activeLeftIndexRef.current = activeLeftIndex;
  }, [activeLeftIndex]);

  // Keep the stable width base value in sync with layout-derived buttonWidth
  useEffect(() => {
    indicatorWidthBase.setValue(currentIndicatorWidth);
  }, [currentIndicatorWidth]);

  // Animate indicator to committed tab position (when not dragging).
  // Fire immediately (no InteractionManager delay) so the spring tracks
  // the tap right away — like Apple Music's tab indicator.
  useEffect(() => {
    if (isDragging.current) return;
    Animated.spring(slideAnim, {
      toValue: currentIndicatorLeft,
      useNativeDriver: false,
      stiffness: 300,
      damping: 28,
      mass: 0.7,
    }).start();
    // Reset stretch & offset on tab commit
    Animated.spring(stretchAnim, {
      toValue: 0,
      useNativeDriver: false,
      stiffness: 360,
      damping: 30,
      mass: 0.5,
    }).start();
    Animated.spring(offsetAnim, {
      toValue: 0,
      useNativeDriver: false,
      stiffness: 360,
      damping: 30,
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

  // Use a ref so the PanResponder (created once at mount) always calls the
  // latest version of navigate without stale closure lag
  const navigateToLeftIndexRef = useRef(null);

  // Navigate to a tab by left-route index
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

  // Keep the ref in sync with the latest callback
  useEffect(() => {
    navigateToLeftIndexRef.current = navigateToLeftIndex;
  }, [navigateToLeftIndex]);

  // PanResponder for drag-to-switch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Capture phase: parent steals gesture from child TouchableOpacity
      // when the move is clearly horizontal — fixes Android drag not working
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8
        );
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderGrant: (evt, gestureState) => {
        isDragging.current = true;
        lastHapticIndex.current = activeLeftIndexRef.current;
        bWidthAtGrant.current = (tabBarWidthRef.current - 2) / 4;
        // Stop any in-flight spring so indicator follows finger instantly
        slideAnim.stopAnimation((currentVal) => {
          dragStartX.current = currentVal;
        });
        stretchAnim.stopAnimation();
        offsetAnim.stopAnimation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt, gestureState) => {
        const bWidth = bWidthAtGrant.current;
        const rawX = dragStartX.current + gestureState.dx;
        const minX = 0;
        const maxX = bWidth * 3;

        // Rubber-band resistance at edges
        let clampedX;
        if (rawX < minX) {
          clampedX = minX + (rawX - minX) * 0.2;
        } else if (rawX > maxX) {
          clampedX = maxX + (rawX - maxX) * 0.2;
        } else {
          clampedX = rawX;
        }

        slideAnim.setValue(clampedX);

        // --- Liquid glass stretch effect ---
        // How far we've moved as a fraction of one tab width (0..1)
        const progress = Math.min(1, Math.abs(gestureState.dx) / bWidth);
        // Max extra width = 40% of buttonWidth, eased with sqrt for natural feel
        const extraStretch = bWidth * 0.4 * Math.sqrt(progress);
        stretchAnim.setValue(extraStretch);

        // Shift origin so pill grows toward the drag direction:
        //   dragging right → leading edge stays, trailing edge extends → no offset adjustment needed
        //   dragging left  → we offset left by extraStretch so the leading edge moves left
        const directionOffset = gestureState.dx < 0 ? -extraStretch : 0;
        offsetAnim.setValue(directionOffset);

        // Determine which tab the indicator center is over
        const indicatorCenter = clampedX + bWidth / 2;
        const hoveredIndex = Math.min(3, Math.max(0, Math.floor(indicatorCenter / bWidth)));

        // Haptic + navigate when crossing into a new tab zone.
        // Defer the navigate via requestAnimationFrame so it doesn't block
        // the gesture thread and cause the stretch animation to stutter.
        if (hoveredIndex !== lastHapticIndex.current) {
          lastHapticIndex.current = hoveredIndex;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          requestAnimationFrame(() => {
            navigateToLeftIndexRef.current?.(hoveredIndex);
          });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        isDragging.current = false;
        const bWidth = bWidthAtGrant.current;

        // Snap to the nearest tab
        const rawX = dragStartX.current + gestureState.dx;
        const clampedX = Math.min(bWidth * 3, Math.max(0, rawX));
        const snappedIndex = Math.min(3, Math.max(0, Math.round(clampedX / bWidth)));
        const snapTarget = snappedIndex * bWidth;

        Animated.spring(slideAnim, {
          toValue: snapTarget,
          useNativeDriver: false,
          stiffness: 280,
          damping: 26,
          mass: 0.8,
        }).start();

        // Snap stretch back to zero (liquid snaps back)
        Animated.spring(stretchAnim, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 320,
          damping: 24,
          mass: 0.6,
        }).start();
        Animated.spring(offsetAnim, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 320,
          damping: 24,
          mass: 0.6,
        }).start();

        if (snappedIndex !== activeLeftIndexRef.current) {
          navigateToLeftIndexRef.current?.(snappedIndex);
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        const bWidth = bWidthAtGrant.current || (tabBarWidthRef.current - 2) / 4;
        const snapTarget = (activeLeftIndexRef.current >= 0 ? activeLeftIndexRef.current : 0) * bWidth;
        Animated.spring(slideAnim, {
          toValue: snapTarget,
          useNativeDriver: false,
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

  // indicatorAnimatedWidth and indicatorAnimatedTranslateX are declared above
  // as stable useRef values — do not recreate them here.

  const renderButtons = () => {
    return leftRoutes.map(({ route, index, descriptor }, leftIdx) => {
      const isFocused = state.routes[state.index].key === route.key;
      const { options } = descriptor;

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
  };

  if (Platform.OS === 'ios' && LiquidGlassView && LiquidGlassContainerView && AnimatedLiquidGlassView) {
    const isRealGlass = isLiquidGlassSupported;
    const pillBg = isRealGlass ? "transparent" : (isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.45)");
    const indicatorBg = isRealGlass
      ? (isDarkMode ? "transparent" : "rgba(255, 255, 255, 0.15)")
      : (isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)");
    const indicatorBorderWidth = isRealGlass ? (isDarkMode ? 0 : 1) : 0;

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
        <LiquidGlassContainerView spacing={isRealGlass ? 12 : 0} style={[styles.iosTabBarContainer, { bottom: bottomOffset }]}>
          {/* Wrap with a View that receives panHandlers — LiquidGlassView doesn't forward touch props */}
          <View
            {...panResponder.panHandlers}
            onLayout={onLeftPillLayout}
            style={[styles.iosLeftPill, { backgroundColor: 'transparent' }]}
          >
            <LiquidGlassView
              effect="regular"
              interactive={isRealGlass}
              colorScheme={isDarkMode ? 'dark' : 'light'}
              tintColor={isDarkMode ? "rgba(30, 30, 30, 0.35)" : "rgba(255, 255, 255, 0.15)"}
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 26,
                backgroundColor: pillBg,
                borderWidth: 1,
                borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
              }}
            />
            {isRealGlass ? (
              <AnimatedLiquidGlassView
                effect="clear"
                interactive={false}
                colorScheme={isDarkMode ? 'dark' : 'light'}
                tintColor={isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.2)"}
                style={{
                  position: "absolute",
                  width: indicatorAnimatedWidth,
                  height: 50,
                  borderRadius: 25,
                  top: 0,
                  left: 0,
                  opacity,
                  transform: [{ translateX: indicatorAnimatedTranslateX }],
                  borderWidth: indicatorBorderWidth,
                  borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  backgroundColor: indicatorBg,
                }}
              />
            ) : (
              <Animated.View
                style={{
                  position: "absolute",
                  width: indicatorAnimatedWidth,
                  height: 50,
                  borderRadius: 25,
                  top: 0,
                  left: 0,
                  opacity,
                  transform: [{ translateX: indicatorAnimatedTranslateX }],
                  borderWidth: 0,
                  backgroundColor: indicatorBg,
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
            )}
            {renderButtons()}
          </View>

          <LiquidGlassView
            effect="regular"
            interactive={isRealGlass}
            colorScheme={isDarkMode ? 'dark' : 'light'}
            tintColor={isDarkMode ? "rgba(30, 30, 30, 0.35)" : "rgba(255, 255, 255, 0.15)"}
            style={[
              styles.iosRightPill,
              {
                backgroundColor: pillBg,
                borderWidth: 1,
                borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                alignItems: 'center',
                justifyContent: 'center',
              }
            ]}
          >
            <CustomTabBarButton
              onPress={() => {}}
            />
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </Animated.View>
    );
  }

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
        {/* panHandlers on the outer View fixes drag on Android (and iOS non-LiquidGlass).
            onMoveShouldSetPanResponderCapture ensures the parent can steal the gesture
            from child TouchableOpacity components during a horizontal drag. */}
        <View
          {...panResponder.panHandlers}
          onLayout={onLeftPillLayout}
          style={[
            styles.iosLeftPill,
            {
              backgroundColor: isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.45)",
              borderWidth: 1,
              borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
            }
          ]}
        >
          {/* Chromatic Aberration - Red channel shift */}
          <Animated.View
            style={{
              position: "absolute",
              width: indicatorAnimatedWidth,
              height: 50,
              borderRadius: 25,
              top: 0,
              left: -0.8,
              opacity: opacity * 0.15,
              transform: [{ translateX: indicatorAnimatedTranslateX }],
              backgroundColor: isDarkMode ? "rgba(255, 60, 60, 0.03)" : "rgba(255, 60, 60, 0.1)",
            }}
          />
          {/* Chromatic Aberration - Blue channel shift */}
          <Animated.View
            style={{
              position: "absolute",
              width: indicatorAnimatedWidth,
              height: 50,
              borderRadius: 25,
              top: 0,
              left: 0.8,
              opacity: opacity * 0.15,
              transform: [{ translateX: indicatorAnimatedTranslateX }],
              backgroundColor: isDarkMode ? "rgba(60, 160, 255, 0.03)" : "rgba(60, 160, 255, 0.1)",
            }}
          />
          {/* Main Glass Indicator */}
          <Animated.View
            style={{
              position: "absolute",
              width: indicatorAnimatedWidth,
              height: 50,
              borderRadius: 25,
              top: 0,
              left: 0,
              opacity,
              transform: [{ translateX: indicatorAnimatedTranslateX }],
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
          {renderButtons()}
        </View>

        <View
          style={[
            styles.iosRightPill,
            {
              backgroundColor: isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.45)",
              borderWidth: 1,
              borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
              alignItems: 'center',
              justifyContent: 'center',
            }
          ]}
        >
          <CustomTabBarButton
            onPress={() => {}}
          />
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
    tabBarHeightRef.current = height;
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
        toValue: visible ? 0 : 100, // Translate down by 100px to hide
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => subscription.remove();
  }, []);



  return (
    <SideMenu
      menu={<Sidebar />}
      menuPosition="left"
      isOpen={setting}
      onChange={(isOpen) => setSetting(isOpen)}
      edgeHitWidth={100}
      bounceBackOnOverdraw={false}
      disableGestures={true}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
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
              />
            );
          }}
          screenOptions={({ route }) => ({
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
              borderRadius: 26,
              height: 52,
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
              backgroundColor: theme.headerBackground,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
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
            tabBar={(props) => (
              <View onLayout={onTabBarLayout}>{props.tabBar(props)}</View>
            )}
          >
            {(props) => (
              <HomeScreen
                {...props}
                scrollTriggerRef={(triggerFn) => {
                  homeScreenScrollTriggerRef.current = triggerFn;
                }}
              />
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
              <MenuScreen
                {...props}
                scrollTriggerRef={(triggerFn) => {
                  forumScrollTriggerRef.current = triggerFn;
                }}
              />
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
              <ChatScreen
                {...props}
                scrollTriggerRef={(triggerFn) => {
                  chatScrollTriggerRef.current = triggerFn;
                }}
              />
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
              <NotificationScreen
                {...props}
                scrollTriggerRef={(triggerFn) => {
                  notificationScrollTriggerRef.current = triggerFn;
                }}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
    </SideMenu>
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
    height: 52,
    borderRadius: 26,
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
  },
  iosTabButton: {
    width: '25%',
    maxWidth: '25%',
    minWidth: '25%',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});