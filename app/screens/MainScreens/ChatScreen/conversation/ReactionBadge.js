import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REACTION_EMOJI_BY_TYPE } from "../../../../components/MessageReactionPicker";
import { styles } from "./styles";

// Reactions row under a message bubble - split out of MessageRow (below) so
// a reaction change only re-renders this small badge, not the whole bubble.
const ReactionBadge = React.memo(({ item, theme, isDarkMode, handlersRef, isLastRealMessage }) => {
  if (typeof item.id !== "number") return null;

  const reactions = item.reactions;
  const hasReactions = reactions && reactions.total > 0;

  // For my messages: row anchored at bottom-left → [...] [👍]
  // For theirs: row anchored at bottom-right → [👍] [...]
  const rowAnchor = item.is_myself ? { left: -6 } : { right: -6 };

  const bgColor = isDarkMode ? "#262626" : "#ffffff";

  // Top 2 emojis by count for the pill
  const topTwo = hasReactions
    ? [...reactions.summary]
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map((s) => REACTION_EMOJI_BY_TYPE[s.type] || "👍")
    : [];

  // Like Messenger/Zalo: the quick-react icon doesn't sit under every bubble -
  // only the conversation's last real message keeps it visible. Reacting to
  // an older message still works via long-press on the bubble itself
  // (handlersRef.current.openReactionPicker, wired in MessageRow's Pressable
  // onLongPress), which is independent of this button.
  const dotsBtn = isLastRealMessage ? (
    <TouchableOpacity
      key="dots"
      onPress={(evt) => handlersRef.current.openReactionPicker(item, evt)}
      style={[
        styles.reactionIconBtn,
        { backgroundColor: bgColor, borderColor: theme.border },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Ionicons name="happy-outline" size={13} color={theme.subText} />
    </TouchableOpacity>
  ) : null;

  const pill = hasReactions ? (
    <TouchableOpacity
      key="pill"
      onPress={() => handlersRef.current.setReactionModal({ visible: true, reactions })}
      style={[
        styles.reactionPillBadge,
        { backgroundColor: bgColor, borderColor: theme.border },
      ]}
    >
      <Text style={styles.reactionPillEmoji}>{topTwo.join("")}</Text>
      <Text style={[styles.reactionPillCount, { color: theme.subText }]}>
        {reactions.total}
      </Text>
    </TouchableOpacity>
  ) : null;

  if (!dotsBtn && !pill) return null;

  // Mine: [...] [pill?]  anchored at left
  // Theirs: [pill?] [...]  anchored at right
  const children = item.is_myself ? [dotsBtn, pill] : [pill, dotsBtn];

  return (
    <View style={[styles.reactionBadgeRow, rowAnchor]}>
      {children}
    </View>
  );
});

export { ReactionBadge };
