import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * Bottom sheet dùng chung cho các hộp chọn của trình chỉnh sửa giao diện hồ
 * sơ (khung, hiệu ứng, kiểu tên, màu) - bản mobile của các Modal antd bên web.
 * Nút "Áp dụng" chỉ đổi bản nháp; lưu thật nằm ở thanh lưu của màn hình.
 */
export default function ThemeSheet({ visible, title, onClose, onApply, scroll = true, children }) {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: isDarkMode ? "#1c1c1e" : "#fff", paddingBottom: insets.bottom + 12 },
          ]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.subText} />
            </TouchableOpacity>
          </View>
          <Body style={styles.body} {...(scroll ? { showsVerticalScrollIndicator: false } : null)}>
            {children}
          </Body>
          {onApply ? (
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.button, { backgroundColor: isDarkMode ? "#2c2c2e" : "#f3f4f6" }]}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onApply} style={[styles.button, { backgroundColor: theme.primary }]}>
                <Text style={[styles.buttonText, { color: "#fff" }]}>
                  {t("profileTheme.apply", "Áp dụng")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Một ô trong lưới tuỳ chọn. Tuỳ chọn chưa mở khoá vẫn chọn được để xem thử -
 * chỉ không lưu được - và mang huy hiệu khoá kèm số điểm cần.
 */
export function OptionTile({ option, selected, onPress, style, children }) {
  const { theme, isDarkMode } = useTheme();
  const locked = option && !option.unlocked;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[
        styles.tile,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? (isDarkMode ? "#1d281b" : "#e9f1e9") : "transparent",
        },
        style,
      ]}
    >
      {children}
      {locked ? (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={9} color="#fff" />
          <Text style={styles.lockText}>{option.required_points}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700" },
  body: { flexGrow: 0 },
  footer: { flexDirection: "row", gap: 10, marginTop: 14 },
  button: { flex: 1, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "600" },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 10,
    overflow: "hidden",
  },
  lock: {
    position: "absolute",
    top: 4,
    right: 4,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(17,24,39,0.75)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lockText: { color: "#fff", fontSize: 10, fontWeight: "600" },
});
