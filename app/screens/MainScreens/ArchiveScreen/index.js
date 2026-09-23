import React, { useState, useEffect, useContext, useRef } from "react";
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
import { getStoryArchive, getArchivedPosts } from "../../../services/api/Api";
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
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import StoryOverlayLayer from "../../../components/StoryOverlays/StoryOverlayLayer";
import StoryFilterTint from "../../../components/StoryOverlays/StoryFilterTint";
import StoryMusicPlayer from "../../../components/StoryOverlays/StoryMusicPlayer";
import {
  denormalizeOverlayItem,
  getStoryCanvasRect,
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
  const [selectedStories, setSelectedStories] = useState(null);
  const [activeArchiveStoryId, setActiveArchiveStoryId] = useState(null);
  const [isArchiveStoryPaused, setIsArchiveStoryPaused] = useState(false);
  const storyRef = React.useRef(null);
  const username = route.params?.username || currentUsername;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  // The tab bar sits inside the floating header, so content has to clear both.
  const titleBarHeight = 64 + insets.top;
  const headerHeight = titleBarHeight + TAB_BAR_HEIGHT;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
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
    fetchArchivedPosts();
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
    try {
      setLoading(true);
      const response = await getStoryArchive();
      if (response?.data?.data) {
        setArchiveData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching archive:", error);
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('archive.loadError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedPosts = async () => {
    try {
      setPostsLoading(true);
      const response = await getArchivedPosts();
      const posts = response?.data?.data;
      setArchivedPosts(Array.isArray(posts) ? posts : []);
    } catch (error) {
      console.error("Error fetching archived posts:", error);
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('archive.loadPostsError'),
      });
    } finally {
      setPostsLoading(false);
    }
  };

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
        const overlayRect = getStoryCanvasRect(width, SCREEN_HEIGHT);
        const overlayItems = (overlays?.items || []).map((item, itemIndex) =>
          denormalizeOverlayItem(item, overlayRect, itemIndex)
        );
        const overlayLayer = (
          <>
            {isVideoStory && <StoryFilterTint filterId={overlays?.filter} />}
            <StoryOverlayLayer
              items={overlayItems}
              canvasWidth={overlayRect.width}
              hidden={Boolean(overlays?.flattened)}
            />
          </>
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
                backgroundColor: "rgba(0,0,0,0.5)",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 20,
              }}
            >
              <Ionicons name="eye" size={20} color="#fff" />
              <Text style={{ color: "white", marginLeft: 8, fontWeight: 'bold' }}>
                {t('archive.viewersCount', { count: story.viewers_count })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ padding: 10 }}>
              <Ionicons name="heart" size={24} color={story.user_has_liked ? "#ff3b30" : "#fff"} />
            </TouchableOpacity>
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
            <Ionicons name="eye-outline" size={12} color={theme.subText} />
            <Text style={styles.storyStatText}>{story.viewers_count}</Text>
          </View>
          <View style={styles.storyStats}>
            <Ionicons name="heart-outline" size={12} color={theme.subText} />
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
        <Text style={[styles.dateTitle, { color: theme.text }]}>{formatDateHeader(dateGroup.date)}</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.floatingHeader}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: titleBarHeight }}>
          <View style={{ width: 44 }}>
            <LiquidButton providerId="ArchiveScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t('archive.title')}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flexDirection: "row", height: TAB_BAR_HEIGHT, paddingHorizontal: 16 }}>
          {[
            { key: "posts", label: t('archive.tabPosts') },
            { key: "stories", label: t('archive.tabStories') },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? theme.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isActive ? "700" : "500",
                    color: isActive ? theme.primary : theme.subText,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <AndroidGlassBackdrop providerId="ArchiveScreen" style={{ flex: 1 }}>
        {activeTab === "posts" ? (
          postsLoading ? (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background, paddingTop: headerHeight }]}>
              <ActivityIndicator size="large" color="#319527" />
            </View>
          ) : archivedPosts.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: theme.background, paddingTop: headerHeight }]}>
              <Ionicons name="document-text-outline" size={64} color={theme.placeholder} />
              <Text style={[styles.emptyText, { color: theme.subText }]}>{t('archive.emptyPosts')}</Text>
            </View>
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
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              ListHeaderComponent={
                <View style={[styles.privacyNotice, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={theme.subText} />
                  <Text style={[styles.privacyText, { color: theme.subText }]}>
                    {t('archive.postsPrivacyNotice')}
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 16 }}
            />
          )
        ) : loading ? (
          <View style={[styles.loadingContainer, { backgroundColor: theme.background, paddingTop: headerHeight }]}>
            <ActivityIndicator size="large" color="#319527" />
          </View>
        ) : archiveData.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.background, paddingTop: headerHeight }]}>
            <Ionicons name="archive-outline" size={64} color={theme.placeholder} />
            <Text style={[styles.emptyText, { color: theme.subText }]}>{t('archive.empty')}</Text>
          </View>
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
              <View style={[styles.privacyNotice, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.subText} />
                <Text style={[styles.privacyText, { color: theme.subText }]}>
                  {t('archive.privacyNotice')}
                </Text>
              </View>
            }
            contentContainerStyle={[styles.listContent, { paddingTop: headerHeight, paddingBottom: insets.bottom + 16 }]}
          />
        )}
      </AndroidGlassBackdrop>

      {selectedStories && (
        <InstagramStories
          ref={storyRef}
          stories={[selectedStories]}
          hideAvatarList={true}
          showName={false}
          statusBarTranslucent={Platform.OS === "android"}
          textStyle={{
            color: "#fff",
            textShadowColor: "rgba(0, 0, 0, 0.8)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 1.5,
            fontWeight: "600",
          }}
          progressColor="#a4a4a4"
          closeIconColor="#c4c4c4"
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    gap: 6,
  },
  privacyText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
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
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  storiesGrid: {
    gap: 8,
  },
  storyItem: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
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
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  storyStatText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
  },
});

export default ArchiveScreen;
