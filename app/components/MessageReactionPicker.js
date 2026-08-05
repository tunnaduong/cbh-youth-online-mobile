import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

// Matches the reaction types the backend accepts (like,love,haha,wow,sad,angry).
export const REACTION_EMOJIS = [
  { type: "like", emoji: "👍" },
  { type: "love", emoji: "❤️" },
  { type: "haha", emoji: "😆" },
  { type: "wow", emoji: "😮" },
  { type: "sad", emoji: "😢" },
  { type: "angry", emoji: "😡" },
];

export const REACTION_EMOJI_BY_TYPE = REACTION_EMOJIS.reduce((acc, r) => {
  acc[r.type] = r.emoji;
  return acc;
}, {});

const SCREEN_WIDTH = Dimensions.get("window").width;
const PICKER_WIDTH = 280;

const MessageReactionPicker = ({
  visible,
  anchor, // { x, y, alignRight }
  myReactions, // array of reaction types I've added, e.g. ["love", "love", "haha"]
  onSelect,
  onRemoveAll,
  onReply,
  onForward,
  onCopy,
  onDownload,
  onEdit,
  onRecall,
  onViewSeenBy,
  onClose,
}) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  if (!visible || !anchor) return null;

  let left = anchor.x;
  if (anchor.alignRight) {
    left = anchor.x - PICKER_WIDTH;
  }
  left = Math.max(8, Math.min(left, SCREEN_WIDTH - PICKER_WIDTH - 8));

  const top = Math.max(insetsSafeTop, anchor.y);

  // Count per type in my reactions
  const myReactionCounts = (myReactions || []).reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const hasAnyMyReaction = (myReactions || []).length > 0;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.pickerContainer,
              {
                left,
                top,
                backgroundColor: isDarkMode ? "#262626" : "#ffffff",
                shadowColor: "#000",
              },
            ]}
          >
            <View style={styles.emojiRow}>
              {REACTION_EMOJIS.map(({ type, emoji }) => {
                const myCount = myReactionCounts[type] || 0;
                return (
                  <TouchableOpacity
                    key={type}
                    style={styles.emojiButton}
                    onPress={() => onSelect(type)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                    {myCount > 0 && (
                      <View
                        style={[
                          styles.myCountBadge,
                          { backgroundColor: theme.primary },
                        ]}
                      >
                        <Text style={styles.myCountText}>{myCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.emojiButton,
                  styles.removeButton,
                  { borderColor: theme.border },
                ]}
                onPress={onRemoveAll}
                activeOpacity={0.6}
                disabled={!hasAnyMyReaction}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={hasAnyMyReaction ? theme.subText : theme.placeholder}
                />
              </TouchableOpacity>
            </View>
            {onCopy && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onCopy}
                activeOpacity={0.6}
              >
                <Ionicons name="copy-outline" size={18} color={theme.text} />
                <Text style={[styles.replyText, { color: theme.text }]}>
                  {t("chatConversation.copy", "Sao chép")}
                </Text>
              </TouchableOpacity>
            )}
            {onReply && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onReply}
                activeOpacity={0.6}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={theme.text} />
                <Text style={[styles.replyText, { color: theme.text }]}>
                  {t("chatConversation.reply", "Trả lời")}
                </Text>
              </TouchableOpacity>
            )}
            {onForward && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onForward}
                activeOpacity={0.6}
              >
                <Ionicons name="arrow-redo-outline" size={18} color={theme.text} />
                <Text style={[styles.replyText, { color: theme.text }]}>
                  {t("chatConversation.forward", "Chuyển tiếp")}
                </Text>
              </TouchableOpacity>
            )}
            {onDownload && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onDownload}
                activeOpacity={0.6}
              >
                <Ionicons name="download-outline" size={18} color={theme.text} />
                <Text style={[styles.replyText, { color: theme.text }]}>
                  {t("chatConversation.download", "Tải xuống")}
                </Text>
              </TouchableOpacity>
            )}
            {onViewSeenBy && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onViewSeenBy}
                activeOpacity={0.6}
              >
                <Ionicons name="eye-outline" size={18} color={theme.text} />
                <Text style={[styles.replyText, { color: theme.text }]}>
                  {t("chatConversation.viewSeenBy", "Lượt xem")}
                </Text>
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onEdit}
                activeOpacity={0.6}
              >
                <Ionicons name="pencil-outline" size={18} color={theme.text} />
                <Text style={[styles.replyText, { color: theme.text }]}>
                  {t("chatConversation.editMessage", "Chỉnh sửa")}
                </Text>
              </TouchableOpacity>
            )}
            {onRecall && (
              <TouchableOpacity
                style={[styles.replyRow, { borderTopColor: theme.border }]}
                onPress={onRecall}
                activeOpacity={0.6}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={[styles.replyText, { color: "#ef4444" }]}>
                  {t("chatConversation.recall", "Thu hồi")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
};

const insetsSafeTop = 60;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 20,
  },
  pickerContainer: {
    position: "absolute",
    width: PICKER_WIDTH,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  emojiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emojiButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 22,
  },
  myCountBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  myCountText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  removeButton: {
    borderWidth: 1,
  },
  replyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyText: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 10,
  },
});

export default MessageReactionPicker;
