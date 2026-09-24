import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

// iOS UISegmentedControl, rebuilt in JS so it themes with the app and works
// identically on Android: a recessed track with a raised thumb that slides
// between segments. Used anywhere a small set of mutually-exclusive modes
// used to be a row of underlined text tabs.
//
// Deliberately not @react-native-segmented-control/segmented-control: that
// one is iOS-only (Android gets a JS reimplementation anyway), can't carry
// icons alongside labels, and won't take the app's own theme colors.
const SegmentedControl = ({
  segments,
  value,
  onChange,
  style,
  // Compact drops the icons and tightens the height - for places where the
  // control sits inline next to other controls rather than on its own row.
  compact = false,
}) => {
  const { theme, isDarkMode } = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(0, segments.findIndex((s) => s.key === value));
  const count = Math.max(1, segments.length);
  // The track pads itself by PADDING on each side; the thumb lives inside
  // that padded box, so every segment is (track - 2*PADDING) / count wide.
  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / count : 0;

  useEffect(() => {
    if (segmentWidth <= 0) return;
    Animated.timing(slide, {
      toValue: activeIndex * segmentWidth,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth]);

  const height = compact ? 32 : 36;
  const trackBg = isDarkMode ? "rgba(118, 118, 128, 0.24)" : "rgba(118, 118, 128, 0.12)";
  const thumbBg = isDarkMode ? "#636366" : "#FFFFFF";

  return (
    <View
      style={[styles.track, { height, backgroundColor: trackBg }, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && w !== trackWidth) setTrackWidth(w);
      }}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              height: height - PADDING * 2,
              backgroundColor: thumbBg,
              transform: [{ translateX: slide }],
            },
            // The thumb's separation from the track is a soft drop shadow on
            // iOS. Android's elevation renders as a hard black rectangle that
            // ignores the rounded corners, so it gets a border instead.
            Platform.OS === "android"
              ? { borderWidth: StyleSheet.hairlineWidth, borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.04)" }
              : {
                  shadowColor: "#000",
                  shadowOpacity: isDarkMode ? 0.3 : 0.12,
                  shadowOffset: { width: 0, height: 1 },
                  shadowRadius: 3,
                },
          ]}
        />
      )}

      {segments.map((segment) => {
        const active = segment.key === value;
        const color = active ? theme.text : theme.subText;
        return (
          <TouchableOpacity
            key={segment.key}
            style={styles.segment}
            activeOpacity={0.7}
            onPress={() => onChange(segment.key)}
          >
            {segment.icon && !compact && (
              <Ionicons name={segment.icon} size={14} color={color} style={{ marginRight: 5 }} />
            )}
            <Text
              style={[styles.label, { color, fontWeight: active ? "600" : "500" }]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const PADDING = 2;

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9,
    padding: PADDING,
  },
  thumb: {
    position: "absolute",
    left: PADDING,
    top: PADDING,
    borderRadius: 7,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  label: { fontSize: 13 },
});

export default SegmentedControl;
