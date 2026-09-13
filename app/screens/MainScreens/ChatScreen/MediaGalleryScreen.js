import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import ImageView from "react-native-image-viewing";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import formatTime from "../../../utils/formatTime";
import { getConversationMedia } from "../../../services/api/Api";
import { VideoViewerModal } from "./ConversationScreen";

// Messenger-style "Gallery": every photo/video, file, or link ever shared in
// this conversation, grouped into tabs. Mirrors the file-bubble rendering
// and image/video viewers already used inline in ConversationScreen.js, but
// as its own paginated screen instead of scrolling through the whole thread.
const TABS = [
  { key: "image", labelKey: "chatConversation.galleryPhotos", fallback: "Ảnh/Video" },
  { key: "file", labelKey: "chatConversation.galleryFiles", fallback: "Tệp" },
  { key: "link", labelKey: "chatConversation.galleryLinks", fallback: "Liên kết" },
];

const MediaGalleryScreen = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState("image");
  const [itemsByTab, setItemsByTab] = useState({ image: [], file: [], link: [] });
  const [pageByTab, setPageByTab] = useState({ image: 1, file: 1, link: 1 });
  const [lastPageByTab, setLastPageByTab] = useState({ image: 1, file: 1, link: 1 });
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [imageViewer, setImageViewer] = useState({ visible: false, uris: [], index: 0 });
  const [videoViewer, setVideoViewer] = useState({ visible: false, uri: null });

  // "image" tab actually fetches both images and videos (the API's `type`
  // filter is per-request) - request both and merge, sorted by recency,
  // since Messenger's Photos/Videos tab is a single combined grid.
  const fetchTab = useCallback(
    async (tab, page = 1) => {
      setLoading(true);
      try {
        if (tab === "image") {
          const [imagesRes, videosRes] = await Promise.all([
            getConversationMedia(conversationId, "image", page),
            getConversationMedia(conversationId, "video", page),
          ]);
          const merged = [...(imagesRes.data.data || []), ...(videosRes.data.data || [])].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          setItemsByTab((prev) => ({
            ...prev,
            image: page === 1 ? merged : [...prev.image, ...merged],
          }));
          setLastPageByTab((prev) => ({
            ...prev,
            image: Math.max(imagesRes.data.last_page, videosRes.data.last_page),
          }));
        } else {
          const res = await getConversationMedia(conversationId, tab, page);
          setItemsByTab((prev) => ({
            ...prev,
            [tab]: page === 1 ? res.data.data : [...prev[tab], ...res.data.data],
          }));
          setLastPageByTab((prev) => ({ ...prev, [tab]: res.data.last_page }));
        }
        setPageByTab((prev) => ({ ...prev, [tab]: page }));
      } catch (error) {
        Toast.show({ type: "error", text1: t("common.error"), text2: error?.message });
      } finally {
        setLoading(false);
      }
    },
    [conversationId, t]
  );

  useEffect(() => {
    if (itemsByTab[activeTab].length === 0) {
      fetchTab(activeTab, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadMore = () => {
    if (loading || pageByTab[activeTab] >= lastPageByTab[activeTab]) return;
    fetchTab(activeTab, pageByTab[activeTab] + 1);
  };

  const handleOpenFile = async (item) => {
    if (!item.file_url || downloadingId) return;
    try {
      setDownloadingId(item.message_id);
      const proposedName = item.content || item.file_url.split("/").pop() || "file";
      const safeName = proposedName.replace(/[\\/:*?"<>|]/g, "_");
      const fileUri = `${FileSystem.documentDirectory}${safeName}`;

      const existing = await FileSystem.getInfoAsync(fileUri);
      if (existing.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }
      const result = await FileSystem.downloadAsync(item.file_url, fileUri);
      if (result?.status !== 200) throw new Error(`Unexpected status ${result?.status}`);

      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({ type: "error", text1: t("common.error"), text2: t("chatConversation.shareUnavailable") });
        return;
      }
      await Sharing.shareAsync(result.uri, { dialogTitle: safeName });
    } catch (error) {
      Toast.show({ type: "error", text1: t("common.error"), text2: error?.message });
    } finally {
      setDownloadingId(null);
    }
  };

  const renderPhotoVideoItem = ({ item, index }) => {
    const isVideo = item.type === "video";
    const thumbUri = item.thumbnail_url || item.file_url;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.8}
        onPress={() => {
          if (isVideo) {
            setVideoViewer({ visible: true, uri: item.file_url });
          } else {
            const images = itemsByTab.image.filter((m) => m.type !== "video");
            const imageIndex = images.findIndex((m) => m.message_id === item.message_id);
            setImageViewer({
              visible: true,
              uris: images.map((m) => m.file_url),
              index: Math.max(0, imageIndex),
            });
          }
        }}
      >
        <Image source={{ uri: thumbUri }} style={styles.gridImage} />
        {isVideo && (
          <View style={styles.playIconOverlay}>
            <Ionicons name="play-circle" size={28} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFileItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.fileRow, { borderBottomColor: theme.border }]}
      activeOpacity={0.6}
      onPress={() => handleOpenFile(item)}
      disabled={!!downloadingId}
    >
      <View style={[styles.fileIconWrapper, { backgroundColor: theme.iconBackground }]}>
        {downloadingId === item.message_id ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Ionicons name="document-text-outline" size={22} color={theme.primary} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1} ellipsizeMode="middle">
          {item.content || t("chatConversation.attachment", "Tệp đính kèm")}
        </Text>
        <Text style={[styles.fileSub, { color: theme.subText }]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderLinkItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.fileRow, { borderBottomColor: theme.border }]}
      activeOpacity={0.6}
      onPress={() => Linking.openURL(item.url).catch(() => {})}
    >
      <View style={[styles.fileIconWrapper, { backgroundColor: theme.iconBackground }]}>
        <Ionicons name="link-outline" size={20} color={theme.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.fileName, { color: theme.primary }]} numberOfLines={1}>
          {item.url}
        </Text>
        <Text style={[styles.fileSub, { color: theme.subText }]} numberOfLines={1}>
          {item.user?.profile_name || item.user?.username} · {formatTime(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const currentItems = itemsByTab[activeTab];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSideButton}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {t("chatConversation.gallery", "Bộ sưu tập")}
        </Text>
        <View style={styles.headerSideButton} />
      </View>
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.key ? theme.primary : theme.subText },
              ]}
            >
              {t(tab.labelKey, tab.fallback)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "image" ? (
        <FlatList
          key="image-grid"
          data={currentItems}
          keyExtractor={(item, index) => `${item.message_id}-${index}`}
          renderItem={renderPhotoVideoItem}
          numColumns={3}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={!loading ? <EmptyState theme={theme} t={t} /> : null}
          ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} /> : null}
        />
      ) : (
        <FlatList
          key="single-column-list"
          data={currentItems}
          keyExtractor={(item, index) => `${item.message_id}-${index}`}
          renderItem={activeTab === "file" ? renderFileItem : renderLinkItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={!loading ? <EmptyState theme={theme} t={t} /> : null}
          ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} /> : null}
        />
      )}

      <ImageView
        images={imageViewer.uris.map((uri) => ({ uri }))}
        imageIndex={imageViewer.index}
        visible={imageViewer.visible}
        onRequestClose={() => setImageViewer({ visible: false, uris: [], index: 0 })}
      />
      {videoViewer.uri && (
        <VideoViewerModal
          visible={videoViewer.visible}
          uri={videoViewer.uri}
          onClose={() => setVideoViewer({ visible: false, uri: null })}
          insetsTop={insets.top}
        />
      )}
    </SafeAreaView>
  );
};

const EmptyState = ({ theme, t }) => (
  <View style={styles.emptyState}>
    <Ionicons name="images-outline" size={40} color={theme.subText} />
    <Text style={{ color: theme.subText, marginTop: 8 }}>
      {t("chatConversation.galleryEmpty", "Chưa có gì ở đây")}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSideButton: { width: 36, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", textAlign: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  gridItem: { width: `${100 / 3}%`, aspectRatio: 1, padding: 1 },
  gridImage: { width: "100%", height: "100%", backgroundColor: "#ddd" },
  playIconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fileIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 14, fontWeight: "500" },
  fileSub: { fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
});

export default MediaGalleryScreen;
