import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Share,
  Clipboard,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import FastImage from "./FastImage";
import UserMultiSelectPicker from "./UserMultiSelectPicker";
import { getConversations, sharePostToChat } from "../services/api/Api";
import { generatePostSlug } from "../utils/slugify";

const GROUP_AVATAR = require("../assets/chat.jpg");

const MAX_TARGETS = 20;

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

const buildPostUrl = (post) => {
  const author = post?.anonymous ? "anonymous" : post?.author?.username;
  return `https://chuyenbienhoa.com/${author}/posts/${generatePostSlug(
    post?.id,
    post?.title
  )}?source=share`;
};

/**
 * "Chia sẻ bài viết" sheet: send the post to friends as a quick chat message,
 * or hand the link to the OS share intent (iOS/Android) for other apps.
 */
const SharePostModal = ({ visible, post, onClose }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  // People found via search who aren't an existing conversation yet.
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds([]);
    setSelectedUsers([]);
    setNote("");
    setLoading(true);
    getConversations()
      .then((res) => setConversations(res.data || []))
      .catch(() => {
        Toast.show({
          type: "error",
          text1: t(
            "chatConversation.loadConversationsFailed",
            "Không thể tải danh sách trò chuyện"
          ),
        });
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const totalSelected = selectedIds.length + selectedUsers.length;

  const handleSend = async () => {
    if (!post || totalSelected === 0 || sending) return;
    if (totalSelected > MAX_TARGETS) {
      Toast.show({
        type: "error",
        text1: t("sharePost.tooMany", "Chỉ có thể chia sẻ tới tối đa 20 nơi"),
      });
      return;
    }

    setSending(true);
    try {
      const res = await sharePostToChat(post.id, {
        conversationIds: selectedIds,
        userIds: selectedUsers.map((u) => u.id),
        note: note.trim() || null,
      });

      const results = res?.data?.results;
      const failed = Array.isArray(results)
        ? results.filter((r) => r.status !== "sent")
        : [];

      if (Array.isArray(results) && failed.length === results.length) {
        Toast.show({
          type: "error",
          text1: failed[0]?.error || t("sharePost.failed", "Chia sẻ thất bại"),
        });
        return;
      }

      Toast.show({
        type: "success",
        text1: t("sharePost.sent", "Đã chia sẻ bài viết"),
      });
      onClose?.();
    } catch (e) {
      Toast.show({
        type: "error",
        text1:
          e?.response?.data?.message ||
          t("sharePost.failed", "Chia sẻ thất bại"),
      });
    } finally {
      setSending(false);
    }
  };

  // The OS share sheet - "chia sẻ đến ứng dụng khác".
  const handleNativeShare = async () => {
    if (!post) return;
    try {
      await Share.share({ message: buildPostUrl(post) });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleCopyLink = async () => {
    if (!post) return;
    Clipboard.setString(buildPostUrl(post));
    Toast.show({
      type: "success",
      text1: t("sharePost.copied", "Đã sao chép liên kết"),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={["top", "bottom"]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t("sharePost.title", "Chia sẻ bài viết")}
          </Text>
          <TouchableOpacity
            onPress={handleSend}
            style={styles.headerButton}
            disabled={totalSelected === 0 || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text
                style={[
                  styles.sendText,
                  {
                    color:
                      totalSelected === 0 ? theme.placeholder : theme.primary,
                  },
                ]}
              >
                {t("chatConversation.send", "Gửi")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Option 2: hand the link to other apps via the OS share intent. */}
        <View style={[styles.externalRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.externalButton, { backgroundColor: theme.iconBackground }]}
            onPress={handleNativeShare}
          >
            <Ionicons name="share-outline" size={20} color={theme.text} />
            <Text style={[styles.externalLabel, { color: theme.text }]}>
              {t("sharePost.toOtherApps", "Ứng dụng khác")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.externalButton, { backgroundColor: theme.iconBackground }]}
            onPress={handleCopyLink}
          >
            <Ionicons name="link-outline" size={20} color={theme.text} />
            <Text style={[styles.externalLabel, { color: theme.text }]}>
              {t("sharePost.copyLink", "Sao chép liên kết")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Option 1: quick message to friends. */}
        <View style={styles.searchWrapper}>
          <Text style={[styles.sectionLabel, { color: theme.subText }]}>
            {t("sharePost.viaMessage", "Gửi qua tin nhắn")}
          </Text>
          <UserMultiSelectPicker
            selected={selectedUsers}
            onChange={setSelectedUsers}
            placeholder={t("sharePost.searchPeople", "Tìm người để chia sẻ...")}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
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
                    <View
                      style={[
                        styles.avatar,
                        styles.avatarFallback,
                        { backgroundColor: theme.border },
                      ]}
                    >
                      <Ionicons name="person" size={20} color={theme.subText} />
                    </View>
                  )}
                  <Text
                    style={[styles.rowName, { color: theme.text }]}
                    numberOfLines={1}
                  >
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

        <View
          style={[
            styles.noteWrapper,
            { borderTopColor: theme.border, paddingBottom: insets.bottom ? 8 : 12 },
          ]}
        >
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            placeholder={t("sharePost.notePlaceholder", "Thêm lời nhắn...")}
            placeholderTextColor={theme.placeholder}
            style={[
              styles.noteInput,
              {
                backgroundColor: theme.iconBackground,
                color: theme.text,
              },
            ]}
          />
        </View>
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
  externalRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  externalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  externalLabel: { fontSize: 15, fontWeight: "500" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  searchWrapper: { paddingTop: 12 },
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
  noteWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noteInput: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
});

export default SharePostModal;
