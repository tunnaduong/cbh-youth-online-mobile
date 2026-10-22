import React from "react";
import { View } from "react-native";
import { useTheme } from "../../../../contexts/ThemeContext";
import FastImage from "../../../../components/FastImage";
import { TypingDots } from "./TypingDots";

// "Typing..." row under the last message: up to three avatars (people or
// Yoyo AI) and the bouncing dots. `typingUsers` is keyed by user id.
const TypingIndicator = ({ typingUsers, participants }) => {
  const { theme } = useTheme();
  const entries = Object.values(typingUsers);
  if (entries.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingTop: 4,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {entries.slice(0, 3).map((entry, i) => {
          const participant = entry.isAi
            ? null
            : participants?.find((p) => String(p.id) === String(entry.userId));
          const avatarUrl = entry.isAi ? entry.avatarUrl : participant?.avatar_url;
          return (
            <FastImage
              key={entry.userId}
              source={{ uri: avatarUrl }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.background,
                marginLeft: i === 0 ? 0 : -6,
                backgroundColor: theme.border,
              }}
            />
          );
        })}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.iconBackground,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <TypingDots color={theme.subText} />
      </View>
    </View>
  );
};

export default React.memo(TypingIndicator);
