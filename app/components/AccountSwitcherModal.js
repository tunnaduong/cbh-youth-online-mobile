import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ActionSheet from "react-native-actions-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { SavedAccountList } from "./AccountSwitcher";

export default function AccountSwitcherModal({ visible, onClose, currentUserId }) {
  const actionSheetRef = useRef(null);
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useEffect(() => {
    if (visible) {
      actionSheetRef.current?.show();
    } else {
      actionSheetRef.current?.hide();
    }
  }, [visible]);

  const sheetBg = isDarkMode ? "#14161C" : "#F4F6F9";
  const cardBg = isDarkMode ? "#1E212B" : "#FFFFFF";
  const cardBorder = isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)";
  const handleColor = isDarkMode ? "rgba(255, 255, 255, 0.22)" : "rgba(15, 23, 42, 0.16)";

  return (
    <ActionSheet
      ref={actionSheetRef}
      onClose={onClose}
      gestureEnabled={true}
      defaultOverlayOpacity={isDarkMode ? 0.65 : 0.45}
      indicatorStyle={{ width: 0, height: 0, margin: 0, backgroundColor: "transparent" }}
      containerStyle={{
        backgroundColor: sheetBg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: 0,
        borderColor: isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
      }}
    >
      <View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: sheetBg,
            paddingBottom: Math.max(insets.bottom + 16, 28),
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handlePill, { backgroundColor: handleColor }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {t("sidebar.switchAccount", "Chuyển tài khoản")}
          </Text>
          <TouchableOpacity
            onPress={() => {
              actionSheetRef.current?.hide();
              onClose?.();
            }}
            style={[
              styles.closeButton,
              {
                backgroundColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(15, 23, 42, 0.06)",
              },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={theme.subText} />
          </TouchableOpacity>
        </View>

        {/* Grouped account card (Instagram / Threads iOS 26 style) */}
        <View
          style={[
            styles.accountCard,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
        >
          <SavedAccountList
            excludeUserId={currentUserId}
            showCurrent={true}
            onClose={() => {
              actionSheetRef.current?.hide();
              onClose?.();
            }}
            onSwitched={() => {
              actionSheetRef.current?.hide();
              onClose?.();
            }}
            showAdd={true}
          />
        </View>
      </View>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: 10,
  },
  handlePill: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
