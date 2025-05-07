import React, { useRef, useEffect, useState } from "react";
import { Animated, View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

const REFRESH_THRESHOLD = 100;

export default function CustomRefreshControl({
  scrollY,
  refreshing,
  onRefresh,
}) {
  const animationRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!scrollY) return;
    // Listen for scrollY changes and update progress
    const listener = scrollY.addListener(({ value }) => {
      // Calculate the progress, clamping it to a range between 0 and 1
      const clamped = Math.max(0, Math.min(1, value / REFRESH_THRESHOLD));
      setProgress(clamped);
    });

    return () => {
      // Clean up the listener when the component is unmounted
      scrollY.removeListener(listener);
    };
  }, [scrollY]);

  useEffect(() => {
    if (refreshing) {
      animationRef.current?.play();
    } else {
      animationRef.current?.reset();
    }
  }, [refreshing]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: scrollY
                ? scrollY.interpolate({
                    inputRange: [0, REFRESH_THRESHOLD],
                    outputRange: [-80, 0],
                    extrapolate: "clamp",
                  })
                : 0, // Default to 0 if scrollY is not available
            },
          ],
        },
      ]}
    >
      <LottieView
        ref={animationRef}
        source={require("../assets/refresh.json")}
        style={styles.lottie}
        progress={progress}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: -80,
    left: 0,
    right: 0,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  lottie: {
    width: 60,
    height: 60,
  },
});
