import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// Inline suggestion list rendered above the input bar.
// Props:
//   suggestions  – array of { id, username, profile_name, avatar_url }
//   onSelect     – called with the selected user object
//   loading      – show a subtle placeholder while fetching
const MentionSuggestions = ({ suggestions, onSelect, loading }) => {
  const { theme, isDarkMode } = useTheme();

  if (!loading && (!suggestions || suggestions.length === 0)) return null;

  return (
    <View
      style={{
        maxHeight: 200,
        borderRadius: 12,
        overflow: "hidden",
        marginHorizontal: 20,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: isDarkMode
          ? "rgba(30,30,30,0.97)"
          : "rgba(255,255,255,0.97)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      <FlatList
        data={suggestions}
        keyExtractor={(item) => String(item.id)}
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
            <Image
              source={{
                uri:
                  item.avatar_url ||
                  `https://api.chuyenbienhoa.com/v1.0/users/${item.username}/avatar`,
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                marginRight: 10,
                backgroundColor: theme.iconBackground,
              }}
            />
            <View>
              <Text style={{ fontWeight: "600", color: theme.text, fontSize: 14 }}>
                {item.profile_name || item.username}
              </Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>
                @{item.username}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

// useMentionInput – manages the @mention trigger, fetches suggestions, and
// inserts the chosen username back into the text.
//
// Usage:
//   const { mentionProps, SuggestionList } = useMentionInput({
//     value, onChange, fetchSuggestions
//   });
//   // Spread mentionProps onto your <CommentBar onChangeText / value / ...>
//   // Render <SuggestionList /> above the input.
export const useMentionInput = ({ value, onChange, fetchSuggestions }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null = not in mention mode
  const debounceRef = useRef(null);

  // Detect if cursor is inside an @mention query
  const handleChangeText = useCallback(
    (text) => {
      onChange(text);

      // Find the last @ that is not followed by a space
      const atIndex = text.lastIndexOf("@");
      if (atIndex === -1) {
        setMentionQuery(null);
        setSuggestions([]);
        return;
      }
      const afterAt = text.slice(atIndex + 1);
      // Stop if there's a space after the @ (mention already completed)
      if (/\s/.test(afterAt)) {
        setMentionQuery(null);
        setSuggestions([]);
        return;
      }
      setMentionQuery(afterAt);
    },
    [onChange]
  );

  useEffect(() => {
    if (mentionQuery === null || mentionQuery === "") {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchSuggestions(mentionQuery);
        setSuggestions(res?.data?.suggestions ?? res?.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 100);
    return () => clearTimeout(debounceRef.current);
  }, [mentionQuery, fetchSuggestions]);

  const handleSelect = useCallback(
    (user) => {
      // Replace the partial @query with @username + space
      const atIndex = value.lastIndexOf("@");
      const newText = value.slice(0, atIndex) + `@${user.username} `;
      onChange(newText);
      setMentionQuery(null);
      setSuggestions([]);
    },
    [value, onChange]
  );

  return {
    mentionProps: { onChangeText: handleChangeText },
    suggestions,
    onSelectMention: handleSelect,
    hasSuggestions: suggestions.length > 0 || loading,
  };
};

export default MentionSuggestions;
