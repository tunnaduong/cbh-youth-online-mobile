import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
  useWindowDimensions,
} from "react-native";
import ActionSheet, { ScrollView } from "react-native-actions-sheet";
import { getStoryViewers } from "../services/api/Api";
import FastImage from "./FastImage";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import formatTime from "../utils/formatTime";

// Map reaction types to emojis
const reactionToEmoji = {
  "like": "👍",
  "love": "❤️",
  "haha": "😆",
  "wow": "😮",
  "sad": "😢",
  "angry": "😡",
};

const StoryViewersSheet = () => {
  const actionSheetRef = useRef(null);
  const [storyId, setStoryId] = useState(null);
  const [isOwnStory, setIsOwnStory] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const fetchAbortControllerRef = useRef(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("SHOW_STORY_VIEWERS", (payload) => {
      // Handle both old format (storyId as string) and new format (object)
      if (typeof payload === 'string') {
        setStoryId(payload);
        setIsOwnStory(false);
      } else if (typeof payload === 'object' && payload.storyId) {
        setStoryId(payload.storyId);
        setIsOwnStory(payload.isOwn ?? false);
      }
      
      // Only open sheet if it's own story
      if (typeof payload === 'object' && payload.isOwn) {
        try {
          actionSheetRef.current?.setModalVisible(true);
        } catch (e) {
          // ignore
        }
      } else if (typeof payload === 'string') {
        // Legacy support - always open for old format
        try {
          actionSheetRef.current?.setModalVisible(true);
        } catch (e) {
          // ignore
        }
      }
    });

    const sub2 = DeviceEventEmitter.addListener("STORY_CHANGED", (id) => {
      if (!id) return;
      setStoryId(id);
      setIsOwnStory(false);
      // Cancel previous fetch if in progress
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      // Reset viewers immediately when story changes
      setViewers([]);
      setLoading(false);
      // Close the sheet when story changes to prevent stale data
      try {
        actionSheetRef.current?.hide?.();
      } catch (e) {
        // ignore
      }
    });

    return () => {
      sub.remove();
      sub2.remove();
      // Cancel any pending fetch on unmount
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!storyId || !isOwnStory) return;
    
    // Cancel previous fetch
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    
    // Create new abort controller for this fetch
    fetchAbortControllerRef.current = new AbortController();
    fetchViewers(storyId, fetchAbortControllerRef.current.signal);
  }, [storyId, isOwnStory]);

  const fetchViewers = async (id, signal) => {
    try {
      setLoading(true);
      const response = await getStoryViewers(id);
      
      // Check if this fetch was cancelled
      if (signal?.aborted) {
        return;
      }
      
      if (response?.data?.data) {
        setViewers(response.data.data.viewers || []);
      }
    } catch (error) {
      // Ignore abort errors
      if (error?.name === 'AbortError') {
        return;
      }
      
      console.error("Error fetching viewers (sheet):", error);
      Toast.show({ type: "error", text1: t("common.error"), text2: t("storyViewers.loadError") });
    } finally {
      // Only update loading if not aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.viewerItem,
        {
          borderBottomColor: theme.border,
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)",
        },
      ]}
      onPress={() => {
        DeviceEventEmitter.emit("NAVIGATE_TO_PROFILE", item.username);
        actionSheetRef.current?.hide();
      }}
    >
      <FastImage source={{ uri: item.profile_picture }} style={styles.avatar} />
      <View style={styles.viewerInfo}>
        <Text style={[styles.viewerName, { color: theme.text }]}>{item.profile_name}</Text>
        {item.reactions && item.reactions.length > 0 ? (
          <View style={styles.reactionsWrap}>
            {item.reactions.slice(0, 3).map((reaction, index) => (
              <Text key={`${reaction.type}-${index}`} style={styles.reactionEmoji}>
                {reactionToEmoji[reaction.type] || "👍"}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={[styles.reactionsText, { color: theme.subText }]}>{t("storyViewers.noReactions")}</Text>
        )}
      </View>
      {item.viewed_at ? (
        <View style={styles.metaWrap}>
          <Ionicons name="time-outline" size={13} color={theme.subText} />
          <Text style={[styles.viewedAt, { color: theme.subText }]}>{formatTime(item.viewed_at || item.viewed_at_human)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const sheetBackground = theme.cardBackground || theme.sheetBackground || theme.background || (isDarkMode ? "#0b0b0b" : "#ffffff");
  const accentColor = theme.primary || "#6366f1";

  return (
    <ActionSheet
      ref={actionSheetRef}
      containerStyle={{
        backgroundColor: sheetBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
        maxHeight: windowHeight * 0.85,
      }}
      gestureEnabled
      defaultOverlayOpacity={0.45}
      onOpen={() => DeviceEventEmitter.emit("STORY_VIEWERS_SHEET_OPENED")}
      onClose={() => DeviceEventEmitter.emit("STORY_VIEWERS_SHEET_CLOSED")}
    >
      <LinearGradient
        colors={isDarkMode ? ["rgba(16, 185, 129, 0.24)", "rgba(16, 185, 129, 0.06)"] : ["rgba(16, 185, 129, 0.12)", "rgba(255,255,255,0)"]}
        style={[styles.header, { paddingTop: 6, borderBottomColor: theme.border }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.titleWrap}>
            <View style={[styles.iconBadge, { backgroundColor: accentColor }]}>
              <Ionicons name="eye-outline" size={16} color="#fff" />
            </View>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>{t("storyViewers.title")}</Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}>
                {loading ? (t("common.loading") || "Loading...") : viewers.length > 0 ? t("home.views", { count: viewers.length }) : t("storyViewers.empty")}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => actionSheetRef.current?.hide()} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: theme.subText }]}>{t("common.loading") || "Loading..."}</Text>
        </View>
      ) : viewers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)" }]}>
            <Ionicons name="eye-outline" size={48} color={theme.subText} />
          </View>
          <Text style={[styles.emptyText, { color: theme.subText }]}>{t("storyViewers.empty")}</Text>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: windowHeight * 0.85 - 100 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: (insets.bottom || 0) + 16 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {viewers.map((item, i) => (
            <React.Fragment key={item.id?.toString() || i.toString()}>
              {renderItem({ item })}
            </React.Fragment>
          ))}
        </ScrollView>
      )}
    </ActionSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dragHandle: {
    display: "none",
  },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  loadingContainer: { padding: 24, alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13 },
  emptyContainer: { padding: 28, alignItems: "center" },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: { marginTop: 4, fontSize: 14, textAlign: "center" },
  viewerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderRadius: 14,
    marginBottom: 8,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  viewerInfo: { flex: 1 },
  viewerName: { fontSize: 15, fontWeight: "700" },
  reactionsWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 4, alignItems: "center" },
  reactionEmoji: { fontSize: 20 },
  reactionsText: { marginTop: 4, fontSize: 13 },
  metaWrap: {
    alignItems: "flex-end",
    marginLeft: 8,
    maxWidth: 88,
  },
  viewedAt: { fontSize: 11, marginTop: 2, textAlign: "right" },
});

export default StoryViewersSheet;
