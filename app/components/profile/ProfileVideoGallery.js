import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { getUserVideos } from "../../services/api/Api";

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
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (nextPage) => {
      if (!username) return;
      const id = ++requestId.current;
      const first = nextPage === 1;
      if (first) setLoading(true);
      else setLoadingMore(true);
      setError(false);

      try {
        const response = await getUserVideos(username, nextPage, PAGE_SIZE);
        if (id !== requestId.current) return;
        const items = Array.isArray(response.data?.data) ? response.data.data : [];
        setVideos((previous) => (first ? items : [...previous, ...items]));
        setTotal(Number(response.data?.total) || 0);
        setPage(nextPage);
        setHasMore(Boolean(response.data?.has_more));
      } catch (e) {
        if (id !== requestId.current) return;
        if (first) {
          setVideos([]);
          setError(true);
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [username]
  );

  useEffect(() => {
    if (active && username && page === 0 && !loading && !error) fetchPage(1);
  }, [active, username, page, loading, error, fetchPage]);

  const reload = useCallback(() => fetchPage(1), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) fetchPage(page + 1);
  }, [loading, loadingMore, hasMore, page, fetchPage]);

  return {
    videos,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
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
 * Full-screen Video Viewer for profile videos.
 */
export function ProfileVideoViewer({ videos = [], index = 0, visible, onClose, onOpenPost }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { autoplayVideos } = useTheme();

  const currentVideo = videos[index] || null;
  const videoUri = currentVideo?.url || null;

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    if (videoUri && autoplayVideos) p.play();
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
    return () => {
      if (!player) return;
      try {
        if (typeof player.pause === "function") player.pause();
        if (typeof player.release === "function") player.release();
      } catch {}
    };
  }, [player, videoUri]);

  if (!visible || !currentVideo) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        {/* Top Header */}
        <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.viewerCount}>
            {index + 1} / {videos.length}
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

        {/* Video Area */}
        <View style={styles.videoWrapper}>
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

        {/* Bottom Footer */}
        <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 12 }]}>
          {currentVideo.post_title ? (
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
  videoWrapper: {
    flex: 1,
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
