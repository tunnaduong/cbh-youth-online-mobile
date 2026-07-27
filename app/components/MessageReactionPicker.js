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
  currentReaction,
  onSelect,
  onRemove,
  onReply,
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

  // Deliberately not RN's <Modal>: on Android a Modal opens a separate native
  // window, which can trip the keyboard controller's resize/frame listeners
  // and shove the conversation's keyboard-aware content upward even though no
  // text input is involved. Rendering as a plain in-tree overlay (a sibling
  // absolutely positioned above everything else) avoids that entirely.
  return (
    <TouchableWithoutFeedback onPress={onClose}>
      {/* box-none here would let taps outside the picker fall through to
          whatever's underneath (the message list) instead of just closing
          the picker - the backdrop needs to swallow the touch itself. */}
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
              {REACTION_EMOJIS.map(({ type, emoji }) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.emojiButton,
                    currentReaction === type && {
                      backgroundColor: isDarkMode
                        ? "rgba(76,175,80,0.25)"
                        : "rgba(49,149,39,0.15)",
                    },
                  ]}
                  onPress={() => onSelect(type)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.emojiButton,
                  styles.removeButton,
                  { borderColor: theme.border },
                ]}
                onPress={onRemove}
                activeOpacity={0.6}
                disabled={!currentReaction}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={currentReaction ? theme.subText : theme.placeholder}
                />
              </TouchableOpacity>
            </View>
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
