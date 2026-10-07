import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import CustomLoading from "./CustomLoading";
import { useTheme } from "../contexts/ThemeContext";

// Boxes smaller than this (avatars, icons, list thumbnails) only get the
// tinted background: a spinner squeezed into them is noise.
const MIN_BOX_FOR_LOADER = 72;

// Some call sites keep the placeholder mounted behind media that has loaded
// (a video tile). The animation stops after this long so it doesn't keep
// running where nobody can see it.
const LOADER_MAX_MS = 12000;

/**
 * Placeholder for the box of an image, video or embed that is still
 * loading, instead of an empty or black rectangle: a tinted background with
 * the app's own loading indicator (CustomLoading, assets/refresh.json) in
 * the middle. Fills its parent by default (put it behind the media); pass
 * `style` to size it yourself.
 *
 *   dark - for spots that are dark in both themes (video tiles)
 */
export default function MediaShimmer({ style, dark = false }) {
  const { isDarkMode } = useTheme();
  const [box, setBox] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), LOADER_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  const smaller = box ? Math.min(box.width, box.height) : 0;
  const showLoader = !expired && smaller >= MIN_BOX_FOR_LOADER;
  // Scales with the box, between a list thumbnail and a full-width photo.
  const size = Math.max(32, Math.min(56, Math.round(smaller * 0.3)));

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (!box || box.width !== width || box.height !== height) setBox({ width, height });
      }}
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: dark || isDarkMode ? "#2f3540" : "#dfe5ea" },
        style,
      ]}
    >
      {showLoader && <CustomLoading size={size} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
