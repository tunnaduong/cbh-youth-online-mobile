import React, { useCallback, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

// Local, static command list — no server round-trip needed like @mentions.
// Descriptions come from app strings (chatConversation.aiCommands.*) so they
// localize like the rest of the app instead of being hardcoded Vietnamese.
export function getAiCommands(t) {
  return [
    { command: "/ai", label: "/ai", description: t("chatConversation.aiCommands.ai") },
    { command: "/summary", label: "/summary", description: t("chatConversation.aiCommands.summary") },
    { command: "/help", label: "/help", description: t("chatConversation.aiCommands.help") },
  ];
}

// Inline command palette rendered above the input bar, mirroring
// MentionSuggestions' layout/positioning conventions.
const SlashCommandSuggestions = ({ suggestions, onSelect }) => {
  const { theme, isDarkMode } = useTheme();

  if (!suggestions || suggestions.length === 0) return null;

  const containerStyle = {
    maxHeight: 160,
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: isDarkMode ? "rgba(30,30,30,0.97)" : "rgba(255,255,255,0.97)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  };

  return (
    <View style={containerStyle}>
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.command}
        keyboardShouldPersistTaps="always"
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            {/* Blue (not theme.primary green) so it reads as visually distinct from the @mention picker */}
            <Text style={{ fontWeight: "700", color: isDarkMode ? "#93c5fd" : "#1d4ed8", fontSize: 14 }}>
              {item.label}
            </Text>
            <Text style={{ color: theme.subText, fontSize: 12 }}>
              {item.description}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

// useSlashCommandInput – shows the palette whenever the composer content
// starts with "/" (and nothing else yet distinguishes a full command),
// and lets a selection replace the leading token with "<command> ".
export const useSlashCommandInput = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState([]);

  const handleChangeText = useCallback(
    (text) => {
      onChange(text);

      if (!text.startsWith("/") || /\s/.test(text)) {
        setSuggestions([]);
        return;
      }

      const query = text.slice(1).toLowerCase();
      const matches = getAiCommands(t).filter((c) => c.command.slice(1).startsWith(query));
      setSuggestions(matches);
    },
    [onChange, t]
  );

  const handleSelect = useCallback(
    (item) => {
      onChange(`${item.command} `);
      setSuggestions([]);
    },
    [onChange]
  );

  return {
    slashProps: { onChangeText: handleChangeText },
    suggestions,
    onSelectCommand: handleSelect,
    hasSuggestions: suggestions.length > 0,
  };
};

export default SlashCommandSuggestions;
