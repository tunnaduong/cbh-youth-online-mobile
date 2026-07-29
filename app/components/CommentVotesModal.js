import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import FastImage from "./FastImage";
import ActionSheet from "react-native-actions-sheet";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCommentVotes } from "../services/api/Api";

const getAvatarUri = (vote) => {
  if (vote.avatar_url) return vote.avatar_url;
  if (vote.username) return `https://api.chuyenbienhoa.com/v1.0/users/${vote.username}/avatar`;
  return null;
};

const getInitials = (name) =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

// Response shape: { comment_id, comment, votes: [...] }
const extractVotes = (res) => {
  const body = res?.data ?? res;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.votes)) return body.votes;
  if (Array.isArray(body?.data)) return body.data;
  return [];
};

export default function CommentVotesModal({ visible, onClose, commentId, commentPreview, navigation }) {
  const actionSheetRef = useRef(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (visible) actionSheetRef.current?.show();
  }, [visible]);

  useEffect(() => {
    if (!visible || !commentId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setVotes([]);
    getCommentVotes(commentId)
      .then((res) => {
        if (active) setVotes(extractVotes(res));
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || err?.message || t("commentVoteModal.loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [visible, commentId]);

  const renderItem = ({ item }) => {
    const profileName = item.profile_name || item.username || t("voteModal.defaultUser");
    const avatarUri = getAvatarUri(item);
    const isUpvote = Number(item.vote_value) === 1;

    return (
      <Pressable
        onPress={() => {
          if (navigation && item.username) {
            onClose();
            navigation.navigate("ProfileScreen", { username: item.username });
          }
        }}
        style={[styles.voteItem, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
      >
        <View style={[styles.avatarContainer, { backgroundColor: theme.iconBackground }]}>
          {avatarUri ? (
            <FastImage source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarFallback, { color: theme.text }]}>{getInitials(profileName)}</Text>
          )}
        </View>
        <View style={styles.voteContent}>
          <View style={styles.voteHeader}>
            <Text style={[styles.voteName, { color: theme.text }]} numberOfLines={1}>
              {profileName}
            </Text>
            <View style={[styles.voteTag, isUpvote ? styles.upvoteTag : styles.downvoteTag]}>
              <Text style={[styles.voteTagText, isUpvote ? styles.upvoteTagText : styles.downvoteTagText]}>
                {isUpvote ? t("voteModal.upvote") : t("voteModal.downvote")}
              </Text>
            </View>
          </View>
          <Text style={[styles.voteUsername, { color: theme.subText }]}>@{item.username}</Text>
        </View>
      </Pressable>
    );
  };

  const preview = typeof commentPreview === "string" ? commentPreview.trim() : "";

  return (
    <ActionSheet
      ref={actionSheetRef}
      gestureEnabled
      defaultOverlayOpacity={0.45}
      onClose={onClose}
      containerStyle={[styles.sheetContainer, { backgroundColor: theme.cardBackground }]}
    >
      <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>{t("commentVoteModal.title")}</Text>
            {!!preview && (
              <Text style={[styles.subtitle, { color: theme.subText }]} numberOfLines={1}>
                {preview}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => actionSheetRef.current?.hide()} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: theme.primary }]}>{t("common.close")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}40` }]}>
            <Text style={[styles.summaryText, { color: theme.primary }]}>{t("voteModal.voteCount", { count: votes.length })}</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}40` }]}>
            <Text style={[styles.summaryText, { color: theme.primary }]}>{t("voteModal.score", { value: votes.reduce((s, v) => s + Number(v.vote_value || 0), 0) })}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorWrapper}>
            <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
          </View>
        ) : votes.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <Text style={[styles.emptyText, { color: theme.subText }]}>{t("commentVoteModal.empty")}</Text>
          </View>
        ) : (
          <FlatList
            data={votes}
            keyExtractor={(item, i) => item.user_id?.toString() || item.username || String(i)}
            renderItem={renderItem}
            style={[styles.list, { maxHeight: windowHeight * 0.68 }]}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  modalContainer: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  closeButton: { paddingVertical: 6, paddingHorizontal: 10 },
  closeButtonText: { fontSize: 15, fontWeight: "700" },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  summaryPill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  summaryText: { fontSize: 13, fontWeight: "700" },
  loadingWrapper: { minHeight: 180, justifyContent: "center", alignItems: "center" },
  errorWrapper: { minHeight: 120, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 15, textAlign: "center" },
  emptyWrapper: { minHeight: 120, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15 },
  list: { width: "100%" },
  listContent: { paddingBottom: 8 },
  voteItem: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: { fontSize: 16, fontWeight: "700" },
  voteContent: { flex: 1 },
  voteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  voteName: { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  voteUsername: { fontSize: 13 },
  voteTag: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1 },
  voteTagText: { fontSize: 11, fontWeight: "700" },
  upvoteTag: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
  downvoteTag: { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
  upvoteTagText: { color: "#15803d" },
  downvoteTagText: { color: "#b91c1c" },
});
