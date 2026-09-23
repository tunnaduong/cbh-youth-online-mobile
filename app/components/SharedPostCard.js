import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "./FastImage";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Compact preview of a forum post: used both in the share sheet (so the sender
 * sees what they're about to send) and inside a chat bubble (so the recipient
 * sees the post instead of a bare link).
 *
 * @param {object} props
 * @param {object} props.topic - { id, title, url, excerpt, thumbnail, author_name, author_avatar }
 * @param {boolean} [props.compact] - tighter layout, for chat bubbles
 * @param {() => void} [props.onPress]
 */
const SharedPostCard = ({ topic, compact = false, onPress }) => {
  const { theme, isDarkMode } = useTheme();

  if (!topic) return null;

  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
    >
      {topic.thumbnail ? (
        <FastImage
          source={{ uri: topic.thumbnail }}
          style={[styles.thumbnail, compact && styles.thumbnailCompact]}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={2}
        >
          {topic.title || "(Chưa có tiêu đề)"}
        </Text>
        {topic.excerpt ? (
          <Text
            style={[styles.excerpt, { color: theme.subText }]}
            numberOfLines={compact ? 2 : 3}
          >
            {topic.excerpt}
          </Text>
        ) : null}
        <View style={styles.authorRow}>
          {topic.author_avatar ? (
            <FastImage
              source={{ uri: topic.author_avatar }}
              style={styles.authorAvatar}
            />
          ) : (
            <View
              style={[
                styles.authorAvatar,
                styles.authorAvatarFallback,
                { backgroundColor: theme.border },
              ]}
            >
              <Ionicons name="person" size={10} color={theme.subText} />
            </View>
          )}
          <Text
            style={[styles.authorName, { color: theme.subText }]}
            numberOfLines={1}
          >
            {topic.author_name}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}>
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    minWidth: 200,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: 140 },
  thumbnailCompact: { height: 110 },
  body: { paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontSize: 15, fontWeight: "600" },
  excerpt: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  authorRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  authorAvatar: { width: 16, height: 16, borderRadius: 8, marginRight: 6 },
  authorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  authorName: { fontSize: 12, flexShrink: 1 },
});

export default SharedPostCard;
