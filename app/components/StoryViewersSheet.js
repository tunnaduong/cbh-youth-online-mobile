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
      style={[styles.viewerItem, { borderBottomColor: theme.border }]}
      onPress={() => {
        DeviceEventEmitter.emit("NAVIGATE_TO_PROFILE", item.username);
        actionSheetRef.current?.hide();
      }}
    >
      <FastImage source={{ uri: item.profile_picture }} style={styles.avatar} />
      <View style={styles.viewerInfo}>
        <Text style={[styles.viewerName, { color: theme.text }]}>{item.profile_name}</Text>
        {item.reactions && item.reactions.length > 0 ? (
          <Text style={[styles.reactionsText, { color: theme.subText }]}>
            {item.reactions.map((r) => r.type).join(", ")}
          </Text>
        ) : null}
      </View>
      {item.viewed_at && <Text style={[styles.viewedAt, { color: theme.subText }]}>{item.viewed_at_human || item.viewed_at}</Text>}
    </TouchableOpacity>
  );

  const sheetBackground = theme.sheetBackground || theme.background || (isDarkMode ? "#0b0b0b" : "#ffffff");

  return (
    <ActionSheet
      ref={actionSheetRef}
      containerStyle={{
        backgroundColor: sheetBackground,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: "hidden",
      }}
      gestureEnabled
      defaultOverlayOpacity={0.5}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}> 
        <View style={styles.dragHandle} />
        <Text style={[styles.title, { color: theme.primary }]}>{t("storyViewers.title")}</Text>
        <TouchableOpacity onPress={() => actionSheetRef.current?.hide()}>
          <Ionicons name="close" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : viewers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="eye-outline" size={64} color={theme.subText} />
          <Text style={[styles.emptyText, { color: theme.subText }]}>{t("storyViewers.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={viewers}
          renderItem={renderItem}
          keyExtractor={(it) => it.id.toString()}
          contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 16 }}
        />
      )}
    </ActionSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  dragHandle: {
    position: "absolute",
    left: "50%",
    top: 8,
    width: 40,
    height: 4,
    marginLeft: -20,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  title: { fontSize: 16, fontWeight: "600" },
  loadingContainer: { padding: 24, alignItems: "center" },
  emptyContainer: { padding: 24, alignItems: "center" },
  emptyText: { marginTop: 12 },
  viewerItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  viewerInfo: { flex: 1 },
  viewerName: { fontSize: 16, fontWeight: "600" },
  reactionsText: { marginTop: 4, fontSize: 13 },
  viewedAt: { fontSize: 12, marginLeft: 8 },
});

export default StoryViewersSheet;
