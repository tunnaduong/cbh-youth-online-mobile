import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { searchUserSuggestions } from "../services/api/Api";

// Controlled multi-select user picker with debounced name/username search,
// used for "create group" and "add members" flows.
//
// Props:
//   selected               – array of selected user objects { id, username, profile_name, avatar_url }
//   onChange               – called with the new selected array
//   excludeConversationId  – optional, skips users already in that group
//   placeholder
const UserMultiSelectPicker = ({ selected, onChange, excludeConversationId, placeholder }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${excludeConversationId || ""}:${trimmed}`;
    if (cacheRef.current.has(cacheKey)) {
      setSuggestions(cacheRef.current.get(cacheKey));
      return;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchUserSuggestions(trimmed, excludeConversationId);
        const results = res?.data?.suggestions ?? [];
        cacheRef.current.set(cacheKey, results);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, excludeConversationId]);

  const isSelected = (id) => selected.some((u) => u.id === id);

  const toggleUser = (user) => {
    if (isSelected(user.id)) {
      onChange(selected.filter((u) => u.id !== user.id));
    } else {
      onChange([...selected, user]);
      setQuery("");
      setSuggestions([]);
    }
  };

  const removeSelected = (id) => onChange(selected.filter((u) => u.id !== id));

  return (
    <View>
      {selected.length > 0 && (
        <View style={styles.chipRow}>
          {selected.map((u) => (
            <View
              key={u.id}
              style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Image
                source={{
                  uri: u.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${u.username}/avatar`,
                }}
                style={styles.chipAvatar}
              />
              <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                {u.profile_name || u.username}
              </Text>
              <TouchableOpacity
                onPress={() => removeSelected(u.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={theme.subText} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.subText} style={{ marginLeft: 12 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={placeholder || t("chat.searchUserPlaceholder")}
          placeholderTextColor={theme.placeholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 12 }} />}
      </View>

      {query.trim().length > 0 && (
        <View style={[styles.suggestionsBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
          {!loading && suggestions.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.subText }]}>{t("chat.noUserFound")}</Text>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="always"
              scrollEnabled={false}
              renderItem={({ item }) => {
                const picked = isSelected(item.id);
                return (
                  <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => toggleUser(item)}>
                    <Image
                      source={{
                        uri:
                          item.avatar_url ||
                          `https://api.chuyenbienhoa.com/v1.0/users/${item.username}/avatar`,
                      }}
                      style={styles.rowAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                        {item.profile_name || item.username}
                      </Text>
                      <Text style={[styles.rowHandle, { color: theme.subText }]} numberOfLines={1}>
                        @{item.username}
                      </Text>
                    </View>
                    <Ionicons
                      name={picked ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={picked ? theme.primary : theme.border}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
    maxWidth: 180,
    gap: 6,
  },
  chipAvatar: { width: 22, height: 22, borderRadius: 11 },
  chipText: { fontSize: 13, fontWeight: "500", flexShrink: 1 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingHorizontal: 10 },
  suggestionsBox: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyText: { textAlign: "center", paddingVertical: 16, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  rowAvatar: { width: 38, height: 38, borderRadius: 19 },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowHandle: { fontSize: 12, marginTop: 1 },
});

export default UserMultiSelectPicker;
