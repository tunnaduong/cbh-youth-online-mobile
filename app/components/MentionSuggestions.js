import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

  const containerStyle = {
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
  };

  if (loading && suggestions.length === 0) {
    return (
      <View style={[containerStyle, { paddingVertical: 14, alignItems: "center" }]}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
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
  // Per-instance cache: query string → result array. Lives for the component's
  // lifetime so repeated keystrokes return instantly without a second API call.
  const cacheRef = useRef(new Map());

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
      setLoading(false);
      return;
    }

    // Serve from cache immediately so the list appears without any delay
    if (cacheRef.current.has(mentionQuery)) {
      setSuggestions(cacheRef.current.get(mentionQuery));
      return;
    }

    // Show the popup spinner immediately — before the debounce fires
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchSuggestions(mentionQuery);
        const results = res?.data?.suggestions ?? res?.suggestions ?? [];
        cacheRef.current.set(mentionQuery, results);
        setSuggestions(results);
      } catch (error) {
        // Silently swallowing this made a real failure (auth, network,
        // validation) indistinguishable from "no matches" - log it so a
        // broken mention lookup shows up in adb logcat / Metro instead of
        // just quietly doing nothing.
        console.warn("[MentionSuggestions] fetchSuggestions failed:", error?.response?.status, error?.response?.data || error?.message);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 120);
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
    loading,
    onSelectMention: handleSelect,
    hasSuggestions: suggestions.length > 0 || loading,
  };
};

export default MentionSuggestions;
