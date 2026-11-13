import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import CustomLoading from "../../../../components/CustomLoading";

// Fixed height and always mounted: only its opacity changes, so the content
// height - which the load-more scroll compensation measures - never moves.
export const LOAD_MORE_HEADER_HEIGHT = 40;

export default function LoadMoreHeader({ loading }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: loading ? 1 : 0,
      duration: loading ? 180 : 220,
      useNativeDriver: true,
    }).start();
  }, [loading, opacity]);

  return (
    <View
      pointerEvents="none"
      style={{ height: LOAD_MORE_HEADER_HEIGHT, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <CustomLoading size={32} />
      </Animated.View>
    </View>
  );
}
