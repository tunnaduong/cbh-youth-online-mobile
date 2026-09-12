import React, { useCallback, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// Local, static command list — no server round-trip needed like @mentions.
export const AI_COMMANDS = [
  { command: "/ai", label: "/ai", description: "Hỏi CYO AI về tin nhắn này" },
  { command: "/summary", label: "/summary", description: "Tóm tắt cuộc trò chuyện gần đây" },
];

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
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <Text style={{ fontWeight: "700", color: theme.primary, fontSize: 14, marginRight: 8 }}>
              {item.label}
            </Text>
            <Text style={{ color: theme.subText, fontSize: 13, flexShrink: 1 }}>
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
  const [suggestions, setSuggestions] = useState([]);

  const handleChangeText = useCallback(
    (text) => {
      onChange(text);

      if (!text.startsWith("/") || /\s/.test(text)) {
        setSuggestions([]);
        return;
      }

      const query = text.slice(1).toLowerCase();
      const matches = AI_COMMANDS.filter((c) => c.command.slice(1).startsWith(query));
      setSuggestions(matches);
    },
    [onChange]
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
