import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  Clipboard,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import ImageView from "react-native-image-viewing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import {
  LiquidGlassView,
  glassTint,
  androidGlassPerfProps,
} from "../../../components/GlassModules";
import { openExternalLink } from "../../../utils/externalLink";
import formatTime from "../../../utils/formatTime";
import { getConversationMedia } from "../../../services/api/Api";
import { downloadMediaToLibrary } from "../../../utils/mediaDownload";
import { VideoViewerModal } from "./ConversationScreen";
import ForwardMessageModal from "../../../components/ForwardMessageModal";

// Messenger-style "Gallery": every photo/video, file, or link ever shared in
// this conversation, grouped into tabs. Mirrors the file-bubble rendering
// and image/video viewers already used inline in ConversationScreen.js, but
// as its own paginated screen instead of scrolling through the whole thread.
//
// The tab switcher is a floating glass pill pinned to the bottom of the
// screen, deliberately built to the same spec as the app's main bottom nav
// (MainScreens/index.js CustomTabBar): same 49pt height, 24.5 radius, same
// surface/border/indicator colors, same sliding indicator. It is scoped to
// this screen only and has no "+" button - there is nothing to create here.
const TABS = [
  {
    key: "image",
    labelKey: "chatConversation.galleryPhotos",
    fallback: "Ảnh/Video",
    icon: "images-outline",
    iconFocused: "images",
  },
  {
    key: "file",
    labelKey: "chatConversation.galleryFiles",
    fallback: "Tệp",
    icon: "document-text-outline",
    iconFocused: "document-text",
  },
  {
    key: "link",
    labelKey: "chatConversation.galleryLinks",
    fallback: "Liên kết",
    icon: "link-outline",
    iconFocused: "link",
  },
];

const NAV_HEIGHT = 49;
const NAV_RADIUS = 24.5;

// Bottom nav pill - mirrors CustomTabBar's structure so the two read as the
// same control. Kept local to this file because it is gallery-only.
const GalleryTabBar = ({ tabs, activeTab, onSelect, t }) => {
  const { theme, isDarkMode, hideTabLabels } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [pillWidth, setPillWidth] = useState(Dimensions.get("window").width - 40);

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));
  const buttonWidth = pillWidth / Math.max(1, tabs.length);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeIndex * buttonWidth,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, buttonWidth]);

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 8 : 16;
  const surface = isDarkMode ? "rgba(18, 18, 18, 0.72)" : "rgba(255, 255, 255, 0.72)";
  const border = isDarkMode ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.07)";
  const indicator = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const inactiveColor = isDarkMode ? "#A0A0A0" : "gray";
  const NavGlassWrapper = LiquidGlassView ?? View;

  return (
    <View style={[styles.navWrap, { bottom: bottomOffset }]}>
      <NavGlassWrapper
        {...(LiquidGlassView
          ? {
              variant: "clear",
              interactive: true,
              tintColor: glassTint(isDarkMode),
              borderRadius: NAV_RADIUS,
              ...androidGlassPerfProps,
            }
          : {})}
        renderToHardwareTextureAndroid
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== pillWidth) setPillWidth(w);
        }}
        style={[
          styles.navPill,
          {
            backgroundColor: LiquidGlassView ? "transparent" : surface,
            borderColor: border,
          },
          // Android's elevation shadow renders black and ignores borderRadius
          // clipping, poking a square corner past the pill in dark mode.
          isDarkMode && { elevation: 0, shadowOpacity: 0 },
        ]}
      >
        <Animated.View
          renderToHardwareTextureAndroid
          style={{
            position: "absolute",
            width: buttonWidth,
            height: NAV_HEIGHT,
            borderRadius: NAV_RADIUS,
            top: 0,
            left: 0,
            backgroundColor: indicator,
            transform: [{ translateX: slideAnim }],
          }}
        />
        {tabs.map((tab) => {
          const focused = tab.key === activeTab;
          const color = focused ? theme.primary : inactiveColor;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.navButton}
              onPress={() => onSelect(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={focused ? tab.iconFocused : tab.icon} size={22} color={color} />
              {!hideTabLabels && (
                <Text style={[styles.navLabel, { color }]} numberOfLines={1}>
                  {t(tab.labelKey, tab.fallback)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </NavGlassWrapper>
    </View>
  );
};

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
  const [imageViewer, setImageViewer] = useState({ visible: false, items: [], index: 0 });
  const [videoViewer, setVideoViewer] = useState({ visible: false, item: null });
  const [forwardModal, setForwardModal] = useState({ visible: false, message: null });

  // Drives the header back button's appear/disappear glass, the same way
  // every other secondary screen in the app does it (LiquidButton reads the
  // value directly and hard-switches its glass surface past the threshold).
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );
  // Reset to the top-of-scroll (no glass) look whenever the tab changes -
  // each tab has its own list, so the shared scrollY would otherwise keep a
  // stale offset from the tab you just left.
  useEffect(() => {
    scrollY.setValue(0);
  }, [activeTab]);

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

  // Downloads to a scratch cache file and hands it to the OS share sheet -
  // used for both "Share" (any file type) and, for files specifically, is
  // the same flow the row's tap already did (the share sheet itself offers
  // "Save to Files"/"Save to library", so a separate raw-download action
  // would just duplicate it without adding anything).
  const shareRemoteFile = async (url, proposedName) => {
    const safeName = (proposedName || url.split("/").pop() || "file").replace(/[\\/:*?"<>|]/g, "_");
    const fileUri = `${FileSystem.cacheDirectory}${safeName}`;
    const existing = await FileSystem.getInfoAsync(fileUri);
    if (existing.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
    const result = await FileSystem.downloadAsync(url, fileUri);
    if (result?.status !== 200) throw new Error(`Unexpected status ${result?.status}`);
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error(t("chatConversation.shareUnavailable"));
    }
    await Sharing.shareAsync(result.uri, { dialogTitle: safeName });
  };

  const handleOpenFile = async (item) => {
    if (!item.file_url || downloadingId) return;
    try {
      setDownloadingId(item.message_id);
      await shareRemoteFile(item.file_url, item.content);
    } catch (error) {
      Toast.show({ type: "error", text1: t("common.error"), text2: error?.message });
    } finally {
      setDownloadingId(null);
    }
  };

  // "Share" here means forwarding within the app (like a message's own
  // Forward action), not the OS share sheet - Save above already covers
  // getting the file out to another app.
  const handleShareMedia = (item) => {
    if (!item?.message_id) return;
    setForwardModal({ visible: true, message: { id: item.message_id } });
  };

  const handleSaveMedia = async (item) => {
    if (!item?.file_url) return;
    try {
      await downloadMediaToLibrary(item.file_url, item.type);
      Toast.show({ type: "success", text1: t("chatConversation.downloadSuccess", "Đã lưu vào thư viện") });
    } catch (error) {
      const message = error?.message === "PERMISSION_DENIED"
        ? t("chatConversation.downloadPermissionDenied", "Cần quyền truy cập thư viện ảnh để tải xuống")
        : t("chatConversation.downloadError", "Không thể tải xuống, vui lòng thử lại");
      Toast.show({ type: "error", text1: message });
    }
  };

  const showFileOptions = (item) => {
    const options = [
      t("chatConversation.openFile", "Mở tệp"),
      t("chatConversation.share", "Chia sẻ"),
      t("common.cancel"),
    ];
    const cancelButtonIndex = 2;
    const run = (index) => {
      if (index === 0) handleOpenFile(item);
      else if (index === 1) setForwardModal({ visible: true, message: { id: item.message_id } });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, run);
    } else {
      Alert.alert(item.content || t("chatConversation.attachment", "Tệp đính kèm"), null, [
        { text: options[0], onPress: () => run(0) },
        { text: options[1], onPress: () => run(1) },
        { text: options[2], style: "cancel" },
      ]);
    }
  };

  const showLinkOptions = (item) => {
    const options = [
      t("chatConversation.openLink", "Mở liên kết"),
      t("chatConversation.copyLink", "Sao chép liên kết"),
      t("chatConversation.share", "Chia sẻ"),
      t("common.cancel"),
    ];
    const cancelButtonIndex = 3;
    const run = (index) => {
      if (index === 0) {
        openExternalLink(navigation, item.url, theme);
      } else if (index === 1) {
        Clipboard.setString(item.url);
        Toast.show({ type: "success", text1: t("chatConversation.copied", "Đã sao chép") });
      } else if (index === 2) {
        setForwardModal({ visible: true, message: { id: item.message_id } });
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, run);
    } else {
      Alert.alert(item.url, null, [
        { text: options[0], onPress: () => run(0) },
        { text: options[1], onPress: () => run(1) },
        { text: options[2], onPress: () => run(2) },
        { text: options[3], style: "cancel" },
      ]);
    }
  };

  // Long-press on a grid tile - same Share (forward)/Save actions as the
  // viewer's own action bar, without needing to open it first.
  const showMediaOptions = (item) => {
    const options = [
      t("chatConversation.share", "Chia sẻ"),
      t("chatConversation.download", "Tải xuống"),
      t("common.cancel"),
    ];
    const cancelButtonIndex = 2;
    const run = (index) => {
      if (index === 0) handleShareMedia(item);
      else if (index === 1) handleSaveMedia(item);
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex }, run);
    } else {
      Alert.alert(null, null, [
        { text: options[0], onPress: () => run(0) },
        { text: options[1], onPress: () => run(1) },
        { text: options[2], style: "cancel" },
      ]);
    }
  };

  const renderPhotoVideoItem = ({ item }) => {
    const isVideo = item.type === "video";
    const thumbUri = item.thumbnail_url || item.file_url;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.8}
        onPress={() => {
          if (isVideo) {
            setVideoViewer({ visible: true, item });
          } else {
            const images = itemsByTab.image.filter((m) => m.type !== "video");
            const imageIndex = images.findIndex((m) => m.message_id === item.message_id);
            setImageViewer({ visible: true, items: images, index: Math.max(0, imageIndex) });
          }
        }}
        onLongPress={() => showMediaOptions(item)}
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
      onLongPress={() => showFileOptions(item)}
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
      onPress={() => openExternalLink(navigation, item.url, theme)}
      onLongPress={() => showLinkOptions(item)}
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

  // react-native-image-viewing's default header positions its close button
  // with RN's own <SafeAreaView>, which is an iOS-only no-op - on Android it
  // applies no top inset at all, so the button sits right under (behind) the
  // status bar. Same fix ConversationScreen.js's own image viewer already uses.
  const ImageViewerHeader = () => (
    <View style={{ paddingTop: insets.top + 8, paddingRight: 12, alignItems: "flex-end" }}>
      <TouchableOpacity
        onPress={() => setImageViewer({ visible: false, items: [], index: 0 })}
        style={styles.imageViewerCloseButton}
        hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // Footer for the image lightbox: sender/time for whichever image is
  // currently showing, plus share/save - closes over imageViewer.items
  // since react-native-image-viewing only gives us the index.
  const ImageViewerFooter = ({ imageIndex }) => {
    const item = imageViewer.items[imageIndex];
    if (!item) return null;
    return (
      <MediaActionBar
        item={item}
        theme={theme}
        insetsBottom={insets.bottom}
        onShare={() => handleShareMedia(item)}
        onSave={() => handleSaveMedia(item)}
      />
    );
  };

  // Content clears the floating header at the top and the floating nav pill
  // at the bottom - both are overlays now, so the list has to pad itself.
  const listContentStyle = {
    paddingTop: 64 + insets.top,
    paddingBottom: (insets.bottom > 0 ? insets.bottom + 8 : 16) + NAV_HEIGHT + 16,
  };

  const sharedListProps = {
    data: currentItems,
    keyExtractor: (item, index) => `${item.message_id}-${index}`,
    onEndReached: loadMore,
    onEndReachedThreshold: 0.5,
    onScroll,
    scrollEventThrottle: 16,
    showsVerticalScrollIndicator: false,
    contentContainerStyle: listContentStyle,
    ListEmptyComponent: !loading ? <EmptyState theme={theme} t={t} /> : null,
    ListFooterComponent: loading ? (
      <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} />
    ) : null,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header - transparent at the top of the scroll, the back
          button grows its own glass once the list moves under it. */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.headerRow, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <View style={{ width: 44 }}>
            <LiquidButton
              size={44}
              scrollY={scrollY}
              providerId="MediaGalleryScreen"
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.text, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t("chatConversation.gallery", "Bộ sưu tập")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {activeTab === "image" ? (
        <Animated.FlatList
          key="image-grid"
          {...sharedListProps}
          renderItem={renderPhotoVideoItem}
          numColumns={3}
        />
      ) : (
        <Animated.FlatList
          key="single-column-list"
          {...sharedListProps}
          renderItem={activeTab === "file" ? renderFileItem : renderLinkItem}
        />
      )}

      <GalleryTabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} t={t} />

      <ImageView
        images={imageViewer.items.map((m) => ({ uri: m.file_url }))}
        imageIndex={imageViewer.index}
        visible={imageViewer.visible}
        onRequestClose={() => setImageViewer({ visible: false, items: [], index: 0 })}
        HeaderComponent={ImageViewerHeader}
        FooterComponent={ImageViewerFooter}
      />
      {videoViewer.item && (
        <VideoViewerModal
          visible={videoViewer.visible}
          uri={videoViewer.item.file_url}
          onClose={() => setVideoViewer({ visible: false, item: null })}
          insetsTop={insets.top}
          footer={
            <MediaActionBar
              item={videoViewer.item}
              theme={theme}
              insetsBottom={insets.bottom}
              onShare={() => handleShareMedia(videoViewer.item)}
              onSave={() => handleSaveMedia(videoViewer.item)}
            />
          }
        />
      )}

      <ForwardMessageModal
        visible={forwardModal.visible}
        message={forwardModal.message}
        onClose={() => setForwardModal({ visible: false, message: null })}
      />
    </View>
  );
};

// Sender/time + share/save bar shown at the bottom of the photo/video viewer.
const MediaActionBar = ({ item, theme, insetsBottom, onShare, onSave }) => (
  <View style={[styles.mediaActionBar, { paddingBottom: insetsBottom + 12 }]}>
    <View style={styles.mediaActionBarInfo}>
      <Text style={styles.mediaActionBarSender} numberOfLines={1}>
        {item.user?.profile_name || item.user?.username}
      </Text>
      <Text style={styles.mediaActionBarTime}>{formatTime(item.created_at)}</Text>
    </View>
    <View style={styles.mediaActionBarButtons}>
      <TouchableOpacity onPress={onSave} style={styles.mediaActionBarButton} hitSlop={8}>
        <Ionicons name="download-outline" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onShare} style={styles.mediaActionBarButton} hitSlop={8}>
        <Ionicons name="share-outline" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>
);

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
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", textAlign: "center" },
  navWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 99,
  },
  navPill: {
    flex: 1,
    height: NAV_HEIGHT,
    borderRadius: NAV_RADIUS,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  navButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navLabel: { fontSize: 9, fontWeight: "bold", marginTop: 2 },
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
  mediaActionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  mediaActionBarInfo: { flex: 1, minWidth: 0, marginRight: 12 },
  mediaActionBarSender: { color: "#fff", fontSize: 13, fontWeight: "600" },
  mediaActionBarTime: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  mediaActionBarButtons: { flexDirection: "row", gap: 20 },
  mediaActionBarButton: { padding: 4 },
  imageViewerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MediaGalleryScreen;
