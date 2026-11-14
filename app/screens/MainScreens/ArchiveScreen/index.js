import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import StoryPlayerHeader from "../../../components/StoryOverlays/StoryPlayerHeader";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getStoryArchive, getArchivedPosts, isRequestCanceled } from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";
import FastImage from "../../../components/FastImage";
import { DeviceEventEmitter } from "react-native";
import StoryViewersSheet from "../../../components/StoryViewersSheet";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import InstagramStories from "@birdwingo/react-native-instagram-stories";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import formatTime from "../../../utils/formatTime";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBar } from "../../../contexts/StatusBarContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import CustomLoading from "../../../components/CustomLoading";
import HomeStyleHeader from "../../../components/HomeStyleHeader";
import BannerWatermark from "../../../components/BannerWatermark";
import { tint } from "../../../components/settings/SettingsUI";
import StoryViewerOverlay from "../../../components/StoryOverlays/StoryViewerOverlay";
import StoryMusicPlayer from "../../../components/StoryOverlays/StoryMusicPlayer";
import {
  parseStoryMusic,
  parseStoryOverlays,
} from "../../../components/StoryOverlays/storyOverlayModel";

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STORY_SIZE = (width - 48) / 3; // 3 columns with padding
const TAB_BAR_HEIGHT = 46;

const ArchiveScreen = ({ route, navigation }) => {
  const { username: currentUsername } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("posts");
  const [archiveData, setArchiveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archivedPosts, setArchivedPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [postsLoadMoreError, setPostsLoadMoreError] = useState(false);
  const [selectedStories, setSelectedStories] = useState(null);
  const postsPageRef = useRef(1);
  const postsHasMoreRef = useRef(true);
  const isFetchingPostsRef = useRef(false);
  const archiveAbortRef = useRef(null);
  const postsAbortRef = useRef(null);

  // The story viewer is black: light status bar icons while it is open,
  // whatever the theme; back to the theme's own when it closes.
  const { updateStatusBar } = useStatusBar();
  useEffect(() => {
    if (!selectedStories) return undefined;
    updateStatusBar("light-content", "#000000");
    return () => updateStatusBar(null, null);
  }, [selectedStories, updateStatusBar]);
  const [activeArchiveStoryId, setActiveArchiveStoryId] = useState(null);
  const [isArchiveStoryPaused, setIsArchiveStoryPaused] = useState(false);
  const storyRef = React.useRef(null);
  const username = route.params?.username || currentUsername;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const titleBarHeight = 0;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  // Fills the status bar area once content scrolls under it.
  const statusBarBgOpacity = scrollY.interpolate({
    inputRange: [0, 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const formatDateHeader = (dateStr) => {
    if (!dateStr) return "";
    const d = dayjs(dateStr);
    if (!d.isValid()) return dateStr;

    const today = dayjs().startOf("day");
    const yesterday = dayjs().subtract(1, "day").startOf("day");
    const itemDate = d.startOf("day");

    if (itemDate.isSame(today)) {
      return t("chatConversation.today");
    } else if (itemDate.isSame(yesterday)) {
      return t("chatConversation.yesterday");
    } else {
      return d.format("DD/MM/YYYY");
    }
  };

  useEffect(() => {
    fetchArchive();
    fetchArchivedPosts(1);
    return () => {
      if (archiveAbortRef.current) archiveAbortRef.current.abort();
      if (postsAbortRef.current) postsAbortRef.current.abort();
    };
  }, []);

  const resolveStoryMediaUrl = (story) => {
    const candidates = [
      story?.media_url,
      story?.thumbnail_url,
      story?.thumbnail,
      story?.thumb_url,
      story?.preview_url,
      story?.file_url,
      story?.image_url,
      story?.media?.url,
      story?.media?.thumbnail,
      story?.image?.url,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        const normalized = candidate.trim();
        if (/^https?:\/\//i.test(normalized)) {
          return normalized;
        }
        if (normalized.startsWith("/")) {
          return `https://api.chuyenbienhoa.com${normalized}`;
        }
        return `https://api.chuyenbienhoa.com/${normalized.replace(/^\/+/, "")}`;
      }
    }

    return null;
  };

  const normalizeAssetUrl = (url) => {
    if (typeof url !== "string" || !url.trim()) return null;
    const normalized = url.trim();
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith("/")) return `https://api.chuyenbienhoa.com${normalized}`;
    return `https://api.chuyenbienhoa.com/${normalized.replace(/^\/+/, "")}`;
  };

  // For video stories the backend renders a proper first-frame thumbnail
  // (video_first_frame_url) - prefer that over the raw video file, which an
  // <Image>/<FastImage> can't decode as a static preview.
  const resolveStoryThumbnailUrl = (story) => {
    const storyType = String(story?.type || story?.media_type || "").toLowerCase();
    if (storyType === "video" && story?.video_first_frame_url) {
      return normalizeAssetUrl(story.video_first_frame_url);
    }
    return resolveStoryMediaUrl(story);
  };

  const fetchArchive = async () => {
    if (archiveAbortRef.current) {
      archiveAbortRef.current.abort();
    }
    const controller = new AbortController();
    archiveAbortRef.current = controller;

    try {
      setLoading(true);
      const response = await getStoryArchive({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response?.data?.data) {
        setArchiveData(response.data.data);
      }
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      console.error("Error fetching archive:", error);
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('archive.loadError'),
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const fetchArchivedPosts = useCallback(async (pageToLoad = 1) => {
    const isFirstPage = pageToLoad === 1;
    if (!isFirstPage && (isFetchingPostsRef.current || !postsHasMoreRef.current)) return;

    if (postsAbortRef.current) {
      postsAbortRef.current.abort();
    }
    const controller = new AbortController();
    postsAbortRef.current = controller;
    isFetchingPostsRef.current = true;
    setPostsLoadMoreError(false);

    try {
      if (isFirstPage) {
        setPostsLoading(true);
      } else {
        setLoadingMorePosts(true);
      }
      const response = await getArchivedPosts(pageToLoad, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const posts = Array.isArray(response?.data?.data) ? response.data.data : [];
      const more = Boolean(
        response?.data?.has_more ??
          response?.data?.next_page_url ??
          (response?.data?.current_page < response?.data?.last_page) ??
          (posts.length >= 10)
      );
      setArchivedPosts((prev) => {
        if (isFirstPage) return posts;
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...posts.filter((p) => !existingIds.has(p.id))];
      });
      postsPageRef.current = pageToLoad;
      postsHasMoreRef.current = more;
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      console.error("Error fetching archived posts:", error);
      if (!isFirstPage) {
        setPostsLoadMoreError(true);
      } else {
        Toast.show({
          type: "error",
          text1: t('common.error'),
          text2: t('archive.loadPostsError'),
        });
      }
    } finally {
      if (!controller.signal.aborted) {
        isFetchingPostsRef.current = false;
        setPostsLoading(false);
        setLoadingMorePosts(false);
      }
    }
  }, [t]);

  const handleLoadMorePosts = useCallback(() => {
    if (isFetchingPostsRef.current || !postsHasMoreRef.current || postsLoadMoreError) return;
    fetchArchivedPosts(postsPageRef.current + 1);
  }, [fetchArchivedPosts, postsLoadMoreError]);

  // PostItem performs the restore call itself; this only drops the row once
  // the post is no longer archived.
  const handleArchiveChange = (postId, archived) => {
    if (!archived) {
      setArchivedPosts((prev) => prev.filter((post) => post.id !== postId));
    }
  };

  const getStoryPlaceholderUri = () => {
    return "https://placehold.co/1080x1920/111827/ffffff.png?text=Story";
  };

  const shadeHex = (hex, percent) => {
    try {
      let h = hex.replace('#', '').trim();
      if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
      }
      const num = parseInt(h, 16);
      let r = (num >> 16) + Math.round(255 * (percent / 100));
      let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
      let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) {
      return hex;
    }
  };

  const normalizeGradientColors = (story) => {
    if (!story) return ['#0f172a'];
    if (Array.isArray(story.gradient_colors) && story.gradient_colors.length > 0) {
      return story.gradient_colors.map((c) => String(c));
    }
    if (story.background_color) {
      try {
        const parsed = JSON.parse(story.background_color);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((c) => String(c));
        if (typeof parsed === 'string') return [String(parsed)];
      } catch {
        if (typeof story.background_color === 'string' && story.background_color.trim()) {
          return [story.background_color.trim()];
        }
      }
    }
    return ['#0f172a'];
  };

  /** Soundtrack of the archived story currently on screen, if it has one. */
  const activeArchiveMusic = React.useMemo(() => {
    if (!selectedStories || !activeArchiveStoryId) return null;

    const story = selectedStories.stories?.find(
      (item) => String(item.id) === String(activeArchiveStoryId)
    );

    return story?.music || null;
  }, [selectedStories, activeArchiveStoryId]);

  useEffect(() => {
    if (!selectedStories || !activeArchiveMusic) {
      setIsArchiveStoryPaused(false);
      return undefined;
    }

    // Follow the viewer's own pause state (long-press) so the music stops too.
    const interval = setInterval(() => {
      try {
        setIsArchiveStoryPaused(Boolean(storyRef.current?.isPaused?.()));
      } catch (error) {
        // ignore - the modal may already be gone
      }
    }, 300);

    return () => clearInterval(interval);
  }, [selectedStories, activeArchiveMusic]);

  const transformStoriesForViewer = (stories) => {
    return {
      uid: "archive",
      id: "archive",
      name: t('archive.title'),
      avatarSource: {
        uri: `https://api.chuyenbienhoa.com/users/${username}/avatar`,
      },
      stories: stories.map((story) => {
        const mediaUrl = resolveStoryMediaUrl(story);
        const storyType = String(story?.type || story?.media_type || "").toLowerCase();
        const isVideoStory = Boolean(mediaUrl) && (
          storyType === "video" ||
          /\.(mp4|mov|m4v|avi)$/i.test(mediaUrl)
        );
        // A text story has no media at all - it's rendered from its own
        // background/text fields, not from source.uri (which just falls back
        // to a generic placeholder image the library still mounts underneath).
        const isTextStory = !mediaUrl && !isVideoStory;
        const textContent = (story.text_content || story.content || '').trim();
        const gradientColorsRaw = normalizeGradientColors(story);
        const gradientColors = gradientColorsRaw.length > 1
          ? gradientColorsRaw
          : [gradientColorsRaw[0], shadeHex(gradientColorsRaw[0], -12)];

        const overlays = parseStoryOverlays(story.overlays);
        const storyMusic = parseStoryMusic(story.music);
        const overlayLayer = (
          <StoryViewerOverlay
            overlays={overlays}
            mediaUri={mediaUrl}
            isVideo={isVideoStory}
            viewportWidth={width}
            viewportHeight={SCREEN_HEIGHT}
          />
        );

        return {
        id: story.id,
        storyId: story.id,
        source: {
          uri: mediaUrl || getStoryPlaceholderUri(),
        },
        duration: 10,
        mediaType: isVideoStory ? "video" : undefined,
        media_type: isVideoStory ? "video" : storyType || "image",
        is_muted: story.is_muted || false,
        date: formatTime(story.created_at || story.created_at_human),
        music: storyMusic,
        // Keep a photo up for as long as its soundtrack, like the feed does.
        animationDuration: !isVideoStory && storyMusic ? 15000 : undefined,
        renderContent: isTextStory
          ? () => (
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  width: "100%",
                  height: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 30,
                }}
              >
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 24,
                    fontWeight: "600",
                    textAlign: "center",
                    fontStyle: story.font_style || "normal",
                    textShadowColor: "rgba(0, 0, 0, 0.3)",
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 3,
                    includeFontPadding: false,
                  }}
                >
                  {textContent}
                </Text>
                {overlayLayer}
              </LinearGradient>
            )
          : () => overlayLayer,
        renderFooter: () => (
          <View
            style={{
              position: "absolute",
              bottom: 20,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              zIndex: 9999,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => {
                // Only show viewers for stories that belong to the current user
                if (username === currentUsername) {
                  setTimeout(() => {
                    DeviceEventEmitter.emit("SHOW_STORY_VIEWERS", { storyId: story.id, isOwn: true });
                  }, 100);
                }
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.42)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
              }}
            >
              <Ionicons name="eye" size={18} color="#fff" />
              <Text style={{ color: "white", marginLeft: 8, fontWeight: 'bold' }}>
                {t('archive.viewersCount', { count: story.viewers_count })}
              </Text>
            </TouchableOpacity>

            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.42)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="heart" size={22} color={story.user_has_liked ? "#ff3b30" : "#fff"} />
            </View>
          </View>
        ),
        };
      }),
    };
  };

  const handleStoryPress = (stories, startIndex) => {
    const transformedStories = transformStoriesForViewer(stories);
    setSelectedStories(transformedStories);
    setTimeout(() => {
      storyRef.current?.show("archive", startIndex);
    }, 100);
  };

  const renderStoryItem = ({ item: story, index }) => {
    const isExpired = story.is_expired;

    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => handleStoryPress([story], 0)}
      >
        {(() => {
          const mediaUri = resolveStoryThumbnailUrl(story);
          if (mediaUri) {
            return (
              <FastImage
                source={{ uri: mediaUri }}
                style={[styles.storyImage, { backgroundColor: theme.surface }]}
              />
            );
          }

          // Render a styled thumbnail for text-only web stories
          const gradientColorsRaw = normalizeGradientColors(story);
          const finalColors = gradientColorsRaw.length > 1 ? gradientColorsRaw : [gradientColorsRaw[0], shadeHex(gradientColorsRaw[0], -12)];

          const previewText = (story.text_content || story.content || '').trim();

          return (
            <LinearGradient
              colors={finalColors}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.storyImage, { justifyContent: 'center', alignItems: 'center' }]}
            >
              <Text numberOfLines={3} style={{ color: '#fff', fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 }}>
                {previewText || 'Story'}
              </Text>
            </LinearGradient>
          );
        })()}
        {isExpired && (
          <View style={styles.expiredOverlay}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.storyInfo}>
          <View style={styles.storyStats}>
            <Ionicons name="eye" size={12} color="#fff" />
            <Text style={styles.storyStatText}>{story.viewers_count}</Text>
          </View>
          <View style={styles.storyStats}>
            <Ionicons name="heart" size={12} color="#F87171" />
            <Text style={styles.storyStatText}>{story.reactions_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDateSection = ({ item: dateGroup }) => {
    const stories = dateGroup.stories || [];

    return (
      <View style={styles.dateSection}>
        <View style={styles.dateRow}>
          <View style={[styles.dateIcon, { backgroundColor: tint("#F59E0B", isDarkMode) }]}>
            <Ionicons name="calendar" size={14} color="#F59E0B" />
          </View>
          <Text style={[styles.dateTitle, { color: theme.text }]}>{formatDateHeader(dateGroup.date)}</Text>
        </View>
        <FlatList
          data={stories}
          renderItem={renderStoryItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.storiesGrid}
        />
      </View>
    );
  };

  // The Posts / Stories tabs are the first thing in the content, not part of
  // the floating header: in the header they stayed on screen over the posts
  // while scrolling. Here they scroll away with the list like the rest of the
  // page.
  const tabBar = (
    <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", borderRadius: 999, padding: 3, backgroundColor: theme.iconBackground }}>
        {[
          { key: "posts", label: t('archive.tabPosts'), icon: "document-text" },
          { key: "stories", label: t('archive.tabStories'), icon: "images" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              activeOpacity={0.8}
              onPress={() => {
                // The other tab's list starts at the top.
                scrollY.setValue(0);
                setActiveTab(tab.key);
              }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: isActive ? theme.background : "transparent",
              }}
            >
              <Ionicons name={tab.icon} size={16} color={isActive ? theme.primary : theme.subText} />
              <Text style={{ fontSize: 14, fontWeight: isActive ? "700" : "500", color: isActive ? theme.text : theme.subText }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
  const homeHeader = (
    <View style={{ paddingTop: insets.top + (Platform.OS === "ios" ? 4 : 8) }}>
      <HomeStyleHeader title={t("archive.title")} onBack={() => navigation.goBack()} />
    </View>
  );
  // Archive hero + privacy note, shown above both lists.
  const privacyBanner = (text) => (
    <LinearGradient
      colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.privacyNotice, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
    >
      <BannerWatermark icon="archive" size={110} />
      <View style={[styles.privacyIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
        <Ionicons name="lock-closed" size={18} color={theme.primary} />
      </View>
      <Text style={[styles.privacyText, { color: theme.subText }]}>{text}</Text>
    </LinearGradient>
  );
  // Loading / empty states keep the tabs on top so the other tab stays reachable.
  const renderState = (containerStyle, children) => (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {homeHeader}
      {tabBar}
      <View style={[containerStyle, { backgroundColor: theme.background }]}>{children}</View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AndroidGlassBackdrop providerId="ArchiveScreen" style={{ flex: 1 }}>
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
          pointerEvents="none"
        />
        {activeTab === "posts" ? (
          postsLoading ? (
            renderState(styles.loadingContainer, (<>
              <CustomLoading size={60} />
            </>))
          ) : archivedPosts.length === 0 ? (
            renderState(styles.emptyContainer, (<>
              <View style={[styles.emptyIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
                <Ionicons name="document-text" size={40} color={theme.primary} />
              </View>
              <Text style={[styles.emptyText, { color: theme.subText }]}>{t('archive.emptyPosts')}</Text>
            </>))
          ) : (
            <FlatList
              data={archivedPosts}
              renderItem={({ item }) => (
                <PostItem
                  navigation={navigation}
                  item={item}
                  screenName="ArchiveScreen"
                  onArchiveChange={handleArchiveChange}
                />
              )}
              keyExtractor={(item) => String(item.id)}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS === 'android'}
              onEndReached={handleLoadMorePosts}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMorePosts ? (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                ) : postsLoadMoreError ? (
                  <TouchableOpacity
                    onPress={() => fetchArchivedPosts(postsPageRef.current + 1)}
                    style={{ paddingVertical: 16, alignItems: "center" }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>
                      {t("common.retry", "Thử lại")}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
              ListHeaderComponent={
                <>
                  {homeHeader}
                  {tabBar}
                  {privacyBanner(t('archive.postsPrivacyNotice'))}
                </>
              }
              contentContainerStyle={{ paddingTop: titleBarHeight, paddingBottom: insets.bottom + 16 }}
            />
          )
        ) : loading ? (
          renderState(styles.loadingContainer, (<>
            <CustomLoading size={60} />
          </>))
        ) : archiveData.length === 0 ? (
          renderState(styles.emptyContainer, (<>
            <View style={[styles.emptyIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <Ionicons name="archive" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.emptyText, { color: theme.subText }]}>{t('archive.empty')}</Text>
          </>))
        ) : (
          <FlatList
            data={archiveData}
            renderItem={renderDateSection}
            keyExtractor={(item) => item.date}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            ListHeaderComponent={
              <>
                {homeHeader}
                {tabBar}
                {privacyBanner(t('archive.privacyNotice'))}
              </>
            }
            contentContainerStyle={[styles.listContent, { paddingTop: titleBarHeight, paddingBottom: insets.bottom + 16 }]}
          />
        )}
      </AndroidGlassBackdrop>

      {selectedStories && (
        <InstagramStories
          ref={storyRef}
          stories={[selectedStories]}
          hideAvatarList={true}
          showName={false}
          // Below the status bar / island on every iPhone (see HomeScreen).
          progressContainerStyle={{ top: Platform.OS === "ios" ? insets.top + 8 : 16 }}
          headerContainerStyle={{ top: Platform.OS === "ios" ? insets.top + 24 : 32 }}
          backgroundColor="#000000"
          mediaContainerStyle={{ backgroundColor: "#000000" }}
          // Letterbox the 9:16 frame so archived stories show exactly what
          // was composed, overlays included.
          imageProps={{ resizeMode: "contain" }}
          videoProps={{ resizeMode: "contain" }}
          statusBarTranslucent={Platform.OS === "android"}
          textStyle={{
            color: "#fff",
            textShadowColor: "rgba(0, 0, 0, 0.8)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 1.5,
            fontWeight: "600",
          }}
          progressColor="rgba(255,255,255,0.35)"
          progressActiveColor="#ffffff"
          closeIconColor="#c4c4c4"
          // Same player chrome as the Home feed: author pill + round buttons,
          // and a soft scrim behind the top and bottom controls.
          renderStoryHeader={({ avatarSource, name, date, onClose }) => (
            <StoryPlayerHeader avatarSource={avatarSource} name={name} date={date} onClose={onClose} />
          )}
          imageOverlayView={
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <LinearGradient
                colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)"]}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150 }}
              />
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
                style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 140 }}
              />
            </View>
          }
          modalAnimationDuration={300}
          storyAnimationDuration={300}
          onHide={() => {
            setSelectedStories(null);
            setActiveArchiveStoryId(null);
          }}
          onStoryStart={(userId, storyId) => setActiveArchiveStoryId(storyId)}
          onSwipeUp={(userId, storyId) => {
            if (username !== currentUsername) return;
            DeviceEventEmitter.emit("SHOW_STORY_VIEWERS", { storyId, isOwn: true });
          }}
        />
      )}

      <StoryMusicPlayer
        music={activeArchiveMusic}
        paused={!selectedStories || isArchiveStoryPaused}
      />

      <StoryViewersSheet />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    gap: 12,
  },
  privacyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  privacyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  dateIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 8 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
  },
  listContent: {
    paddingVertical: 16,
  },
  dateSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  storiesGrid: {
    gap: 8,
  },
  storyItem: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  storyImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  storyPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  expiredOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  storyInfo: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    gap: 8,
  },
  storyStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  storyStatText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
  },
});

export default ArchiveScreen;
