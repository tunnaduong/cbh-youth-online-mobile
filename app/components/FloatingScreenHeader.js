import React from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import LiquidButton from "./LiquidButton";

// The app's screen header: the Home/Forum look (green-tinted round back button,
// big green title with the yellow sparkle) with the floating behaviour of the
// older native headers kept intact:
//   - it is absolutely positioned over the content (give the scroll view
//     `paddingTop: 64 + insets.top`, as before);
//   - the title fades out as the content scrolls;
//   - the back button is the green tint at the top, and turns into the glass
//     surface once the content has scrolled under it (LiquidButton's rule).
// `scrollY` is the screen's Animated.Value. `right` is any node for the right
// side (a LiquidButton with the same scrollY, a text action...).
export default function FloatingScreenHeader({
  title,
  onBack,
  scrollY,
  right,
  icon = "chevron-back",
  backLabel,
  hideBack = false,
  // Screens presented as an iOS modal sheet already start below the notch: pass 0.
  topInset,
}) {
  const insets = useSafeAreaInsets();
  const top = topInset ?? insets.top;
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const green = isDarkMode ? "#4ADE80" : "#15803D";

  const titleOpacity = scrollY
    ? scrollY.interpolate({ inputRange: [0, 10, 50], outputRange: [1, 1, 0], extrapolate: "clamp" })
    : 1;
  // The tint is only for the resting state; the glass takes over when scrolled.
  const tintOpacity = scrollY
    ? scrollY.interpolate({ inputRange: [0, 20], outputRange: [1, 0], extrapolate: "clamp" })
    : 1;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.row, { paddingTop: top, height: 64 + top }]}>
        {hideBack ? null : (
          <View style={styles.backSlot}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tint,
                {
                  backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)",
                  opacity: tintOpacity,
                },
              ]}
            />
            <LiquidButton
              size={44}
              scrollY={scrollY}
              onPress={onBack}
              accessibilityLabel={backLabel || t("common.back", "Quay lại")}
            >
              <Ionicons name={icon} size={22} color={green} />
            </LiquidButton>
          </View>
        )}
        {title ? (
          <Animated.View style={[styles.titleRow, hideBack && { marginLeft: 0 }, { opacity: titleOpacity }]} pointerEvents="none">
            <Text style={[styles.title, { color: green }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.sparkle}>✦</Text>
          </Animated.View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.rightSlot}>{right || null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  backSlot: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tint: { position: "absolute", width: 40, height: 40, borderRadius: 20 },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, marginRight: 8, minWidth: 0 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
  sparkle: { fontSize: 16, color: "#EAB308", marginLeft: 4, marginTop: -8 },
  rightSlot: { minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
});
