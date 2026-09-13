import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

// Shared by ReplyPreviewBubble (inside a bubble, showing what a message
// replied to) and ReplyComposerBar (above the input, showing what's about to
// be replied to) - same content, different chrome around it.
export const getReplyContentDisplay = (replyTo, t) => {
  switch (replyTo?.type) {
    case "image":
      return {
        icon: "image",
        label: t("chatConversation.replyPhoto", "Hình ảnh"),
        showThumb: true,
      };
    case "video":
      // No thumbnail frame is available on the reply_to payload (no
      // metadata field there, unlike full video messages), so this always
      // falls back to the icon.
      return {
        icon: "videocam",
        label: t("chatConversation.replyVideo", "Video"),
        showThumb: false,
      };
    case "file":
      return {
        icon: "document-text",
        label: t("chatConversation.replyFile", "Tệp đính kèm"),
        showThumb: false,
      };
    default:
      return { icon: null, label: replyTo?.content || "", showThumb: false };
  }
};

// "X đã trả lời tin nhắn của Y", with pronoun substitution for replying to
// yourself / someone replying to their own earlier message.
export const getReplyLabel = (item, currentUsername, t) => {
  const replyTo = item?.reply_to;
  if (!replyTo) return "";

  const replierIsMe = item.is_myself;
  const replierName = replierIsMe
    ? t("chatConversation.you", "Bạn")
    : item.sender?.profile_name || item.sender?.username || "";

  const repliedToSelf =
    replyTo.sender?.id != null &&
    item.sender?.id != null &&
    replyTo.sender.id === item.sender.id;

  if (repliedToSelf) {
    return replierIsMe
      ? t("chatConversation.repliedToOwnMessage", "Bạn đã trả lời tin nhắn của chính bạn")
      : t("chatConversation.repliedToTheirOwnMessage", "{{name}} đã trả lời tin nhắn của chính họ", {
          name: replierName,
        });
  }

  const targetIsMe = !replierIsMe && replyTo.sender?.username === currentUsername;
  const targetName = targetIsMe
    ? t("chatConversation.you", "Bạn").toLowerCase()
    : replyTo.sender?.profile_name || replyTo.sender?.username || "";

  return t("chatConversation.repliedToMessage", "{{replier}} đã trả lời tin nhắn của {{target}}", {
    replier: replierName,
    target: targetName,
  });
};

const ReplyPreviewBubble = ({ item, currentUsername, onPress }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const replyTo = item?.reply_to;
  if (!replyTo) return null;

  const { icon, label, showThumb } = getReplyContentDisplay(replyTo, t);
  const isMyself = item.is_myself;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: isMyself
            ? isDarkMode
              ? "rgba(0,0,0,0.18)"
              : "rgba(0,0,0,0.06)"
            : isDarkMode
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.04)",
          borderLeftColor: theme.primary,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.replyLabel,
          { color: isMyself ? (isDarkMode ? "#a7f3d0" : "#4b5563") : theme.subText },
        ]}
      >
        {getReplyLabel(item, currentUsername, t)}
      </Text>
      <View style={styles.contentRow}>
        {showThumb && replyTo.file_url ? (
          <Image source={{ uri: replyTo.file_url }} style={styles.thumb} />
        ) : (
          icon && <Ionicons name={icon} size={13} color={theme.subText} style={styles.icon} />
        )}
        <Text
          numberOfLines={1}
          style={[
            styles.contentText,
            { color: isMyself ? (isDarkMode ? "#ecfdf5" : "#111") : theme.text },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    opacity: 0.85,
    borderRadius: 8,
    borderLeftWidth: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  replyLabel: {
    fontSize: 11,
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
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 6,
  },
  contentText: {
    fontSize: 13,
    flexShrink: 1,
  },
});

export default ReplyPreviewBubble;
