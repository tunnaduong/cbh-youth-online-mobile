import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import FastImage from "./FastImage";
import { getConversations, forwardMessage } from "../services/api/Api";

const GROUP_AVATAR = require("../assets/chat.jpg");

const getConversationDisplay = (conversation) => {
  if (conversation.type === "group") {
    return { name: conversation.name, avatarUrl: null, isGroup: true };
  }
  const participant = conversation.participants?.[0];
  return {
    name: participant?.profile_name || participant?.username || "",
    avatarUrl: participant?.avatar_url || null,
    isGroup: false,
  };
};

const ForwardMessageModal = ({ visible, message, onClose }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds([]);
    setLoading(true);
    getConversations()
      .then((res) => setConversations(res.data || []))
      .catch(() => {
        Toast.show({
          type: "error",
          text1: t("chatConversation.loadConversationsFailed", "Không thể tải danh sách trò chuyện"),
        });
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!message || selectedIds.length === 0 || sending) return;
    setSending(true);
    try {
      await forwardMessage(message.id, { conversationIds: selectedIds });
      Toast.show({
        type: "success",
        text1: t("chatConversation.forwarded", "Đã chuyển tiếp tin nhắn"),
      });
      onClose?.();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("chatConversation.forwardFailed", "Chuyển tiếp thất bại"),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t("chatConversation.forward", "Chuyển tiếp")}
          </Text>
          <TouchableOpacity
            onPress={handleSend}
            style={styles.headerButton}
            disabled={selectedIds.length === 0 || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text
                style={[
                  styles.sendText,
                  {
                    color:
                      selectedIds.length === 0 ? theme.placeholder : theme.primary,
                  },
                ]}
              >
                {t("chatConversation.send", "Gửi")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const { name, avatarUrl, isGroup } = getConversationDisplay(item);
              const selected = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.6}
                  onPress={() => toggleSelect(item.id)}
                >
                  {isGroup ? (
                    <Image source={GROUP_AVATAR} style={styles.avatar} />
                  ) : avatarUrl ? (
                    <FastImage source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.border }]}>
                      <Ionicons name="person" size={20} color={theme.subText} />
                    </View>
                  )}
                  <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={selected ? theme.primary : theme.border}
                  />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { minWidth: 44 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  sendText: { fontSize: 16, fontWeight: "600", textAlign: "right" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  rowName: { flex: 1, fontSize: 16, fontWeight: "500" },
});

export default ForwardMessageModal;
