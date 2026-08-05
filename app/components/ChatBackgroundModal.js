import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import {
  getConversationBackground,
  uploadConversationBackground,
  selectConversationBackground,
  resetConversationBackground,
} from "../services/api/Api";

// Background picker for a chat conversation (private or group — never the
// public chat, which the caller is responsible for not opening this for).
// Any participant may change it; it applies to everyone in the conversation.
const ChatBackgroundModal = ({ visible, conversationId, onClose, onBackgroundChanged }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [history, setHistory] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (visible && conversationId) {
      loadBackground();
    } else {
      setBackgroundUrl(null);
      setHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, conversationId]);

  const loadBackground = async () => {
    setLoading(true);
    try {
      const res = await getConversationBackground(conversationId);
      const data = res?.data || res;
      setBackgroundUrl(data?.background_url || null);
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (error) {
      console.error("[ChatBackgroundModal] loadBackground failed:", error?.response?.status, error?.response?.data || error?.message);
      Toast.show({ type: "error", text1: t("chatBackground.loadError", "Không thể tải hình nền cuộc trò chuyện") });
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;

    setUploading(true);
    console.log("[ChatBackgroundModal] picked asset:", JSON.stringify({
      uri: result.assets[0].uri,
      fileName: result.assets[0].fileName,
      mimeType: result.assets[0].mimeType,
      width: result.assets[0].width,
      height: result.assets[0].height,
      fileSize: result.assets[0].fileSize,
    }));
    try {
      const res = await uploadConversationBackground(conversationId, result.assets[0].uri);
      const data = res?.data || res;
      setBackgroundUrl(data?.background_url || null);
      onBackgroundChanged?.(data?.background_url || null);
      await loadBackground();
      Toast.show({ type: "success", text1: t("chatBackground.changed", "Đã đổi hình nền cuộc trò chuyện") });
    } catch (error) {
      console.error("[ChatBackgroundModal] uploadConversationBackground failed:", error?.response?.status, error?.response?.data || error?.message);
      Toast.show({ type: "error", text1: t("chatBackground.uploadError", "Không thể tải ảnh lên, vui lòng thử lại") });
    } finally {
      setUploading(false);
    }
  };

  const handleSelectHistory = async (entry) => {
    if (entry.url === backgroundUrl) return;
    setApplyingId(entry.id);
    try {
      const res = await selectConversationBackground(conversationId, entry.id);
      const data = res?.data || res;
      setBackgroundUrl(data?.background_url || null);
      onBackgroundChanged?.(data?.background_url || null);
    } catch (error) {
      console.error("[ChatBackgroundModal] selectConversationBackground failed:", error?.response?.status, error?.response?.data || error?.message);
      Toast.show({ type: "error", text1: t("chatBackground.selectError", "Không thể đổi hình nền, vui lòng thử lại") });
    } finally {
      setApplyingId(null);
    }
  };

  const handleReset = () => {
    Alert.alert(
      t("chatBackground.resetTitle", "Đặt lại hình nền mặc định?"),
      null,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatBackground.reset", "Đặt lại"),
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await resetConversationBackground(conversationId);
              setBackgroundUrl(null);
              onBackgroundChanged?.(null);
              Toast.show({ type: "success", text1: t("chatBackground.resetDone", "Đã đặt lại hình nền mặc định") });
            } catch (error) {
              console.error("[ChatBackgroundModal] resetConversationBackground failed:", error?.response?.status, error?.response?.data || error?.message);
              Toast.show({ type: "error", text1: t("chatBackground.resetError", "Không thể đặt lại hình nền, vui lòng thử lại") });
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBackground || theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t("chatBackground.title", "Hình nền đoạn chat")}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={theme.subText} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.primary} />
          ) : (
            <>
              <View style={[styles.preview, { borderColor: theme.border, backgroundColor: isDarkMode ? "#222" : "#f0f0f0" }]}>
                {backgroundUrl ? (
                  <>
                    <Image source={{ uri: backgroundUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <View
                      pointerEvents="none"
                      style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)" }]}
                    />
                  </>
                ) : (
                  <Text style={{ color: theme.subText, fontSize: 12 }}>
                    {t("chatBackground.default", "Mặc định")}
                  </Text>
                )}
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={handlePickImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  )}
                  <Text style={styles.actionButtonText}>{t("chatBackground.upload", "Tải ảnh lên")}</Text>
                </TouchableOpacity>
                {backgroundUrl && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDarkMode ? "#3a1f1f" : "#fee2e2" }]}
                    onPress={handleReset}
                    disabled={resetting}
                  >
                    {resetting ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Ionicons name="refresh-outline" size={16} color="#dc2626" />
                    )}
                    <Text style={[styles.actionButtonText, { color: "#dc2626" }]}>
                      {t("chatBackground.reset", "Đặt lại")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {history.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.historyLabel, { color: theme.subText }]}>
                    {t("chatBackground.history", "Lịch sử hình nền")}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {history.map((entry) => (
                      <TouchableOpacity
                        key={entry.id}
                        onPress={() => handleSelectHistory(entry)}
                        disabled={applyingId === entry.id}
                        style={[
                          styles.historyThumb,
                          { borderColor: entry.url === backgroundUrl ? "#22c55e" : "transparent" },
                        ]}
                      >
                        <Image source={{ uri: entry.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        {entry.url === backgroundUrl && (
                          <View style={styles.historyCheck}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "600" },
  closeButton: { padding: 4 },
  preview: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  historyLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  historyThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 8,
    borderWidth: 2,
  },
  historyCheck: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ChatBackgroundModal;
