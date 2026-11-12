import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "react-i18next";
import MediaShimmer from "../MediaShimmer";
import { useTheme } from "../../contexts/ThemeContext";
import { getUserVideos, isRequestCanceled } from "../../services/api/Api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_SIZE = 30;
export const VIDEO_COLUMNS = 3;
const SKELETON_TILES = VIDEO_COLUMNS * 2;
const GAP = 6;

/**
 * Hook to load paginated videos for a user's profile.
 */
export function useProfileVideos(username, active) {
  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const requestId = useRef(0);
  const isFetchingRef = useRef(false);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);
  const abortControllerRef = useRef(null);

  const fetchPage = useCallback(
    async (nextPage) => {
      if (!username) return;
      const first = nextPage === 1;
      if (!first && isFetchingRef.current) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const id = ++requestId.current;
      isFetchingRef.current = true;
      if (first) {
        setLoading(true);
        setError(false);
      } else {
        setLoadingMore(true);
      }
      setLoadMoreError(false);

      try {
        const response = await getUserVideos(username, nextPage, PAGE_SIZE, {
          signal: controller.signal,
        });
        if (id !== requestId.current || controller.signal.aborted) return;
        const items = Array.isArray(response.data?.data) ? response.data.data : [];
        const more = Boolean(response.data?.has_more);
        setVideos((previous) => {
          if (first) return items;
          const existingKeys = new Set(previous.map((v) => `${v.post_id}-${v.id}`));
          return [...previous, ...items.filter((v) => !existingKeys.has(`${v.post_id}-${v.id}`))];
        });
        setTotal(Number(response.data?.total) || 0);
        pageRef.current = nextPage;
        hasMoreRef.current = more;
        setPage(nextPage);
        setHasMore(more);
      } catch (e) {
        if (isRequestCanceled(e) || controller.signal.aborted || id !== requestId.current) return;
        if (first) {
          setVideos([]);
          setError(true);
        } else {
          setLoadMoreError(true);
        }
      } finally {
        if (id === requestId.current && !controller.signal.aborted) {
          isFetchingRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [username]
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isFetchingRef.current = false;
    };
  }, [username]);

  useEffect(() => {
    if (active && username && page === 0 && !loading && !error) fetchPage(1);
  }, [active, username, page, loading, error, fetchPage]);

  const reload = useCallback(() => fetchPage(1), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!isFetchingRef.current && hasMoreRef.current) {
      fetchPage(pageRef.current + 1);
    }
  }, [fetchPage]);

  return {
    videos,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMoreError,
    loaded: page > 0,
    reload,
    loadMore,
  };
}

/**
 * Group videos into flatlist rows of VIDEO_COLUMNS.
 */
export function videoRows(videos, loading) {
  if (loading && videos.length === 0) {
    return Array.from({ length: SKELETON_TILES / VIDEO_COLUMNS }, (_, index) => ({
      id: `video-skeleton-${index}`,
      skeleton: true,
    }));
  }

  const rows = [];
  for (let start = 0; start < videos.length; start += VIDEO_COLUMNS) {
    rows.push({
      id: `video-row-${start}`,
      start,
      videos: videos.slice(start, start + VIDEO_COLUMNS),
    });
  }
  return rows;
}

/**
 * Individual video thumbnail tile.
 */
function VideoTile({ video, onPress, theme, t }) {
  const [thumbnailUri, setThumbnailUri] = useState(null);
  const [thumbLoading, setThumbLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!video?.url) {
      setThumbLoading(false);
      return;
    }

    setThumbLoading(true);
    VideoThumbnails.getThumbnailAsync(video.url, { time: 0 })
      .then((res) => {
        if (!cancelled) {
          setThumbnailUri(res.uri);
          setThumbLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setThumbLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [video?.url]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={video.post_title || t("profile.videoLabel")}
      onPress={onPress}
      style={[
        styles.tile,
        {
          borderColor: theme.border,
          backgroundColor: theme.iconBackground,
        },
      ]}
    >
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.image} resizeMode="cover" />
      ) : thumbLoading ? (
        <MediaShimmer />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="videocam-outline" size={24} color={theme.subText} />
        </View>
      )}

      {/* Play Icon Badge Overlay */}
      <View style={styles.playOverlay}>
        <View style={styles.playBadge}>
          <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Grid row component for videos.
 */
export function VideoGridRow({ row, onPress }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const tileStyle = [
    styles.tile,
    { borderColor: theme.border, backgroundColor: theme.iconBackground },
  ];

  if (row.skeleton) {
    return (
      <View style={styles.row}>
        {Array.from({ length: VIDEO_COLUMNS }, (_, index) => (
          <View key={index} style={tileStyle}>
            <MediaShimmer />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {row.videos.map((video, index) => (
        <VideoTile
          key={`${video.post_id}-${video.id}`}
          video={video}
          theme={theme}
          t={t}
          onPress={() => onPress(row.start + index)}
        />
      ))}
      {Array.from({ length: VIDEO_COLUMNS - row.videos.length }, (_, index) => (
        <View key={`gap-${index}`} style={styles.filler} />
      ))}
    </View>
  );
}

/**
 * Individual full-screen slide for a video with playback lifecycle.
 */
function VideoSlide({ video, isActive, autoplayVideos }) {
  const player = useVideoPlayer(video?.url || null, (p) => {
    p.loop = false;
    if (isActive && video?.url && autoplayVideos) p.play();
  });

  const [loadingVideo, setLoadingVideo] = useState(true);

  useEffect(() => {
    if (!player || typeof player.addListener !== "function") return;
    setLoadingVideo(player.status === "loading" || player.status === "idle");
    const sub = player.addListener("statusChange", ({ status }) =>
      setLoadingVideo(status === "loading")
    );
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    try {
      if (isActive && autoplayVideos) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [isActive, player, autoplayVideos]);

  useEffect(() => {
    return () => {
      try {
        if (player) {
          player.pause();
          player.release();
        }
      } catch {}
    };
  }, [player]);

  return (
    <View style={styles.slide}>
      {player && (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      )}
      {loadingVideo && (
        <View style={styles.spinnerWrapper} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

/**
 * Full-screen swipeable video viewer modal.
 */
function ProfileVideoViewerModal({ videos = [], initialIndex = 0, onClose, onOpenPost }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { autoplayVideos } = useTheme();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef(null);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      if (typeof idx === "number") {
        setCurrentIndex(idx);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const currentVideo = videos[currentIndex] || videos[initialIndex] || null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        {/* Top Header */}
        <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.viewerCount}>
            {currentIndex + 1} / {videos.length}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={styles.viewerButton}
            hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Swipeable Video FlatList (like photos) */}
        <View style={styles.carouselWrapper}>
          <FlatList
            ref={flatListRef}
            data={videos}
            keyExtractor={(item) => String(item.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * i,
              index: i,
            })}
            onScrollToIndexFailed={() => {}}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item, index }) => (
              <VideoSlide
                video={item}
                isActive={index === currentIndex}
                autoplayVideos={autoplayVideos}
              />
            )}
          />
        </View>

        {/* Bottom Footer */}
        <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 12 }]}>
          {currentVideo?.post_title ? (
            <Text style={styles.viewerTitle} numberOfLines={2}>
              {currentVideo.post_title}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity
            onPress={() => onOpenPost?.(currentVideo)}
            activeOpacity={0.75}
            accessibilityRole="button"
            style={styles.viewerPostButton}
          >
            <Text style={styles.viewerPostText}>{t("profile.viewPost")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Full-screen Video Viewer for profile videos with swipe support.
 */
export function ProfileVideoViewer({ videos = [], index = 0, visible, onClose, onOpenPost }) {
  if (!visible || !videos[index]) return null;

  return (
    <ProfileVideoViewerModal
      videos={videos}
      initialIndex={index}
      onClose={onClose}
      onOpenPost={onOpenPost}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: GAP, marginHorizontal: 16, marginBottom: GAP },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  filler: { flex: 1 },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  playBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "space-between",
  },
  carouselWrapper: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  spinnerWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 10,
  },
  viewerCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  viewerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 10,
  },
  viewerTitle: { flex: 1, color: "#fff", fontSize: 14, lineHeight: 20 },
  viewerPostButton: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fff",
  },
  viewerPostText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
