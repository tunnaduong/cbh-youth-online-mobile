import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import EditorSheet from "./EditorSheet";
import FastImage from "../../../components/FastImage";
import { searchQuery } from "../../../services/api/Api";

const avatarUri = (username) =>
  `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`;

/** Picks the user a mention sticker points at. */
const MentionSheet = ({ visible, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTerm("");
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const query = term.trim().replace(/^@/, "");

    if (!visible || query.length < 1) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await searchQuery(query, "users");
        const users = response?.data?.data || response?.data || [];

        if (!cancelled) {
          setResults(Array.isArray(users) ? users : []);
        }
      } catch (error) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, visible]);

  return (
    <EditorSheet visible={visible} title={t("story.mentionTitle")} onClose={onClose}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder={t("story.mentionPlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.45)"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          style={styles.searchInput}
        />
        {loading && <ActivityIndicator color="#fff" size="small" />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id ?? item.username)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && term.trim().length > 0 ? (
            <Text style={styles.empty}>{t("story.mentionNoResults")}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => onSelect({ id: item.id, username: item.username })}
          >
            <FastImage source={{ uri: avatarUri(item.username) }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.profile_name || item.username}
              </Text>
              <Text style={styles.username} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </EditorSheet>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  name: {
    color: "#fff",
    fontWeight: "600",
  },
  username: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  empty: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 24,
  },
});

export default MentionSheet;
