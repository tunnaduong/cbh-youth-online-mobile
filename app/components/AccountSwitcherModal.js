import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import ActionSheet from "react-native-actions-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SheetCard, SheetHeader, actionSheetProps, useSheetTokens } from "./SheetShell";
import { SavedAccountList } from "./AccountSwitcher";

export default function AccountSwitcherModal({ visible, onClose, currentUserId }) {
  const actionSheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const tokens = useSheetTokens();

  useEffect(() => {
    if (visible) {
      actionSheetRef.current?.show();
    } else {
      actionSheetRef.current?.hide();
    }
  }, [visible]);

  const close = () => {
    actionSheetRef.current?.hide();
    onClose?.();
  };

  return (
    <ActionSheet
      ref={actionSheetRef}
      onClose={onClose}
      gestureEnabled={true}
      {...actionSheetProps(tokens)}
    >
      <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
        <SheetHeader title={t("sidebar.switchAccount", "Chuyển tài khoản")} onClose={close} tokens={tokens} />

        {/* Grouped account card (Instagram / Threads iOS 26 style) */}
        <SheetCard tokens={tokens}>
          <SavedAccountList
            excludeUserId={currentUserId}
            showCurrent={true}
            onClose={close}
            onSwitched={close}
            showAdd={true}
          />
        </SheetCard>
      </View>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    paddingTop: 10,
    paddingHorizontal: 16,
  },
});
