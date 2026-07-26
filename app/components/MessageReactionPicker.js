import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

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
  onClose,
}) => {
  const { theme, isDarkMode } = useTheme();

  if (!visible || !anchor) return null;

  let left = anchor.x;
  if (anchor.alignRight) {
    left = anchor.x - PICKER_WIDTH;
  }
  left = Math.max(8, Math.min(left, SCREEN_WIDTH - PICKER_WIDTH - 8));

  const top = Math.max(insetsSafeTop, anchor.y);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.picker,
                {
                  left,
                  top,
                  backgroundColor: isDarkMode ? "#262626" : "#ffffff",
                  shadowColor: "#000",
                },
              ]}
            >
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const insetsSafeTop = 60;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  picker: {
    position: "absolute",
    width: PICKER_WIDTH,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
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
});

export default MessageReactionPicker;
