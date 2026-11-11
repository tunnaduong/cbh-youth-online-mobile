import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, DeviceEventEmitter } from "react-native";
import ActionSheet from "react-native-actions-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { SavedAccountList } from "./AccountSwitcher";
import { LiquidGlassView, glassTint, androidGlassPerfProps } from "./GlassModules";

export default function AccountSwitcherModal({ visible, onClose, currentUserId }) {
  const actionSheetRef = useRef(null);
  const { theme, isDarkMode, liquidGlassEnabled } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (visible) {
      actionSheetRef.current?.show();
    } else {
      actionSheetRef.current?.hide();
    }
  }, [visible]);

  const SheetWrapper = (liquidGlassEnabled && LiquidGlassView) ? LiquidGlassView : View;
  const glassProps = (liquidGlassEnabled && LiquidGlassView)
    ? {
        variant: "clear",
        tintColor: glassTint(isDarkMode),
        borderRadius: 24,
        ...androidGlassPerfProps,
      }
    : {};

  return (
    <ActionSheet
      ref={actionSheetRef}
      onClose={onClose}
      gestureEnabled={true}
      indicatorStyle={{ backgroundColor: theme.subText, width: 40 }}
      containerStyle={{
        backgroundColor: "transparent",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
      }}
    >
      <SheetWrapper
        {...glassProps}
        style={[
          styles.sheetContainer,
          {
            backgroundColor: (liquidGlassEnabled && LiquidGlassView)
              ? "transparent"
              : isDarkMode
              ? "#181A20"
              : "#FFFFFF",
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconCircle, { backgroundColor: theme.iconBackground }]}>
              <Ionicons name="swap-horizontal" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {t("sidebar.switchAccount", "Chuyển tài khoản")}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={24} color={theme.subText} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingBottom: 24 }}>
          <SavedAccountList
            excludeUserId={currentUserId}
            onSwitched={() => {
              actionSheetRef.current?.hide();
              onClose?.();
            }}
            showAdd={true}
          />
        </View>
      </SheetWrapper>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150, 150, 150, 0.2)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
});
