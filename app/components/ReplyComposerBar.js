import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { getReplyContentDisplay } from "./ReplyPreviewBubble";

// Shown above the message input while composing a reply. `replyingTo` is
// { id, content, type, file_url, sender }.
const ReplyComposerBar = ({ replyingTo, currentUsername, onCancel }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  if (!replyingTo) return null;

  const { icon, label, showThumb } = getReplyContentDisplay(replyingTo, t);
  const isSelf = replyingTo.sender?.username === currentUsername;
  const targetName = isSelf
    ? t("chatConversation.replyingToSelf", "chính bạn")
    : replyingTo.sender?.profile_name || replyingTo.sender?.username || "";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#1a1a1a" : "#f0f0f0", borderTopColor: theme.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.primary }]} numberOfLines={1}>
          {t("chatConversation.replyingTo", "Đang trả lời tin nhắn của {{name}}", {
            name: targetName,
          })}
        </Text>
        <View style={styles.contentRow}>
          {showThumb && replyingTo.file_url ? (
            <Image source={{ uri: replyingTo.file_url }} style={styles.thumb} />
          ) : (
            icon && <Ionicons name={icon} size={13} color={theme.subText} style={styles.icon} />
          )}
          <Text style={[styles.content, { color: theme.subText }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={10} style={styles.closeButton}>
        <Ionicons name="close" size={18} color={theme.subText} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  icon: {
    marginRight: 4,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginRight: 6,
  },
  content: {
    fontSize: 13,
    flexShrink: 1,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default ReplyComposerBar;
