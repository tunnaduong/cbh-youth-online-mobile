import { useRef } from "react";
import { View, Animated, PanResponder } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SWIPE_THRESHOLD = 55;
const SWIPE_ICON_OFFSET = 44;

const SwipeableMessage = ({ children, isMyMessage, onSwipe }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      // Capture phase runs top-down BEFORE any nested touchable (e.g. the
      // video tile's mute button) gets a chance to claim the responder in
      // the bubble phase - without this, a clear horizontal swipe starting
      // on top of a nested TouchableOpacity never reached this PanResponder
      // at all, so swipe-to-reply silently did nothing on video messages.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        triggeredRef.current = false;
      },
      onPanResponderMove: (_, g) => {
        const clamped = g.dx > 0
          ? Math.min(SWIPE_THRESHOLD + 10, g.dx)
          : Math.max(-(SWIPE_THRESHOLD + 10), g.dx);
        translateX.setValue(clamped);
        if (Math.abs(clamped) >= SWIPE_THRESHOLD && !triggeredRef.current) {
          triggeredRef.current = true;
          onSwipe?.();
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      },
    })
  ).current;

  // Left icon: visible when swiping right (positive translateX)
  const leftIconOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const leftIconTranslateX = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD + 10],
    outputRange: [0, SWIPE_ICON_OFFSET + 10],
    extrapolate: "clamp",
  });

  // Right icon: visible when swiping left (negative translateX)
  const rightIconOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const rightIconTranslateX = translateX.interpolate({
    inputRange: [-(SWIPE_THRESHOLD + 10), 0],
    outputRange: [-(SWIPE_ICON_OFFSET + 10), 0],
    extrapolate: "clamp",
  });

  const iconStyle = {
    position: "absolute",
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  };

  return (
    <View style={{ overflow: "visible" }}>
      {/* Left icon — appears when swiping right */}
      <Animated.View
        style={[iconStyle, { left: 4, opacity: leftIconOpacity, transform: [{ translateX: leftIconTranslateX }] }]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-undo" size={16} color="#fff" />
      </Animated.View>
      {/* Right icon — appears when swiping left */}
      <Animated.View
        style={[iconStyle, { right: 4, opacity: rightIconOpacity, transform: [{ translateX: rightIconTranslateX }] }]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-undo" size={16} color="#fff" />
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

export { SwipeableMessage };
