import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";

// ---------------------------------------------------------------------------
// One look for every bottom sheet (iOS 26 / Threads style): a soft solid
// surface with 28pt top corners, a hairline edge, a 40x5 grabber, a dimmed
// backdrop, grouped cards inside, and a centred title with a small close
// circle. The sheets (BottomSheetContext's @gorhom sheet, the
// react-native-actions-sheet ones, PostItem's options) take their colours and
// numbers from here so they cannot drift apart again.
//
// Solid on purpose: sheets live in their own native window / overlay, and a
// glass view inside one bleeds the screen (and tab bar) behind it on iOS 26.
// ---------------------------------------------------------------------------

export const SHEET_RADIUS = 28;
export const CARD_RADIUS = 20;

// Spring used when a sheet slides in, for the sheets whose library lets us set it.
export const SHEET_SPRING = { damping: 28, stiffness: 260, mass: 0.9 };

export const getSheetTokens = (isDarkMode) => ({
  radius: SHEET_RADIUS,
  cardRadius: CARD_RADIUS,
  sheetBg: isDarkMode ? "#14161C" : "#F4F6F9",
  sheetBorder: isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)",
  cardBg: isDarkMode ? "#1E212B" : "#FFFFFF",
  cardBorder: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)",
  divider: isDarkMode ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.06)",
  handle: isDarkMode ? "rgba(255, 255, 255, 0.22)" : "rgba(15, 23, 42, 0.16)",
  closeBg: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)",
  overlayOpacity: isDarkMode ? 0.65 : 0.45,
});

export const useSheetTokens = () => {
  const { isDarkMode } = useTheme();
  return React.useMemo(() => getSheetTokens(isDarkMode), [isDarkMode]);
};

// Style for the sheet surface itself (the `containerStyle` of an
// ActionSheet / `backgroundStyle` of a gorhom sheet).
export const sheetSurfaceStyle = (tokens, extra) => ({
  backgroundColor: tokens.sheetBg,
  borderTopLeftRadius: tokens.radius,
  borderTopRightRadius: tokens.radius,
  borderWidth: StyleSheet.hairlineWidth,
  borderBottomWidth: 0,
  borderColor: tokens.sheetBorder,
  overflow: "hidden",
  ...extra,
});

// Props for react-native-actions-sheet so every one of them looks alike.
export const actionSheetProps = (tokens, extraContainerStyle) => ({
  defaultOverlayOpacity: tokens.overlayOpacity,
  containerStyle: sheetSurfaceStyle(tokens, extraContainerStyle),
  indicatorStyle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
    backgroundColor: tokens.handle,
  },
});

// A grouped card (the rounded white panel on the soft sheet surface).
export const SheetCard = ({ tokens, style, children }) => (
  <View
    style={[
      {
        backgroundColor: tokens.cardBg,
        borderColor: tokens.cardBorder,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: tokens.cardRadius,
        overflow: "hidden",
      },
      style,
    ]}
  >
    {children}
  </View>
);

// Centred title with a close circle on the right (and a spacer on the left
// so the title stays centred).
export const SheetHeader = ({ title, onClose, tokens }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={[styles.close, { backgroundColor: tokens.closeBg }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={theme.subText} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
  },
  headerSide: { width: 32 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
