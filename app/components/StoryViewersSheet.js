import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
} from "react-native";
import ActionSheet from "react-native-actions-sheet";
import { getStoryViewers } from "../services/api/Api";
import FastImage from "./FastImage";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

const StoryViewersSheet = () => {
  const actionSheetRef = useRef(null);
  const [storyId, setStoryId] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("SHOW_STORY_VIEWERS", (id) => {
      setStoryId(id);
      try {
        actionSheetRef.current?.setModalVisible(true);
      } catch (e) {
        // ignore
      }
    });

    const sub2 = DeviceEventEmitter.addListener("STORY_CHANGED", (id) => {
      if (!id) return;
      setStoryId(id);
      // If sheet is visible, refresh viewers for the new story
      try {
        // Some ActionSheet implementations expose visible state; we'll optimistically fetch
        fetchViewers(id);
      } catch (e) {
        // ignore
      }
    });

    return () => {
      sub.remove();
      sub2.remove();
    };
  }, []);

  useEffect(() => {
    if (!storyId) return;
    fetchViewers(storyId);
  }, [storyId]);

  const fetchViewers = async (id) => {
    try {
      setLoading(true);
      const response = await getStoryViewers(id);
      if (response?.data?.data) {
        setViewers(response.data.data.viewers || []);
      }
    } catch (error) {
      console.error("Error fetching viewers (sheet):", error);
      Toast.show({ type: "error", text1: t("common.error"), text2: t("storyViewers.loadError") });
    } finally {
      setLoading(false);
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
              <View key={`${reaction.type}-${index}`} style={[styles.reactionChip, { backgroundColor: isDarkMode ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.08)" }]}>
                <Text style={[styles.reactionChipText, { color: theme.primary }]}>{reaction.type}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.reactionsText, { color: theme.subText }]}>{t("storyViewers.empty")}</Text>
        )}
      </View>
      {item.viewed_at ? (
        <View style={styles.metaWrap}>
          <Ionicons name="time-outline" size={13} color={theme.subText} />
          <Text style={[styles.viewedAt, { color: theme.subText }]}>{item.viewed_at_human || item.viewed_at}</Text>
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
      }}
      gestureEnabled
      defaultOverlayOpacity={0.45}
      onOpen={() => DeviceEventEmitter.emit("STORY_VIEWERS_SHEET_OPENED")}
      onClose={() => DeviceEventEmitter.emit("STORY_VIEWERS_SHEET_CLOSED")}
    >
      <LinearGradient
        colors={isDarkMode ? ["rgba(99,102,241,0.24)", "rgba(99,102,241,0.06)"] : ["rgba(99,102,241,0.12)", "rgba(255,255,255,0)"]}
        style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}
      >
        <View style={styles.dragHandle} />
        <View style={styles.headerContent}>
          <View style={styles.titleWrap}>
            <View style={[styles.iconBadge, { backgroundColor: accentColor }]}>
              <Ionicons name="eye-outline" size={16} color="#fff" />
            </View>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>{t("storyViewers.title")}</Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}> 
                {loading ? (t("common.loading") || "Loading...") : viewers.length > 0 ? `${viewers.length} ${t("home.views", { count: viewers.length })}` : t("storyViewers.empty")}
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
        <FlatList
          data={viewers}
          renderItem={renderItem}
          keyExtractor={(it) => it.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: (insets.bottom || 0) + 16 }}
          showsVerticalScrollIndicator={false}
        />
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
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: 10,
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
  reactionsWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 6 },
  reactionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reactionChipText: { fontSize: 12, fontWeight: "600" },
  reactionsText: { marginTop: 4, fontSize: 13 },
  metaWrap: {
    alignItems: "flex-end",
    marginLeft: 8,
    maxWidth: 88,
  },
  viewedAt: { fontSize: 11, marginTop: 2, textAlign: "right" },
});

export default StoryViewersSheet;
