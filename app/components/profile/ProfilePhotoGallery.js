import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ImageView from "react-native-image-viewing";
import { useTranslation } from "react-i18next";
import FastImage from "../FastImage";
import MediaShimmer from "../MediaShimmer";
import { useTheme } from "../../contexts/ThemeContext";
import { getUserPhotos } from "../../services/api/Api";

/**
 * The photo gallery of a profile - the mobile side of the web's
 * ProfilePhotoGallery ("Thư viện ảnh"): every image of the user's posts,
 * newest post first, from GET /v1.0/users/{username}/photos (paged; the API
 * applies the same visibility rules as the posts list).
 *
 * ProfileScreen is one FlatList whose rows change with the active tab, so the
 * gallery is not a list of its own: this file gives that screen the data
 * (`useProfilePhotos`), the rows (`photoRows` + `PhotoGridRow`) and the
 * full-screen viewer (`ProfilePhotoViewer`).
 */

const PAGE_SIZE = 30;
export const PHOTO_COLUMNS = 3;
// Placeholder tiles shown while the first page loads (two rows).
const SKELETON_TILES = PHOTO_COLUMNS * 2;
const GAP = 6;

/**
 * @param {string} username  whose photos
 * @param {boolean} active   true once the gallery is on screen; the first
 *                           page is only fetched then (most visits to a
 *                           profile never open it)
 */
export function useProfilePhotos(username, active) {
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  // Answers of an older request (another profile, a refresh that overtook
  // it) are dropped.
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
        const response = await getUserPhotos(username, nextPage, PAGE_SIZE);
        if (id !== requestId.current) return;
        const items = Array.isArray(response.data?.data) ? response.data.data : [];
        setPhotos((previous) => (first ? items : [...previous, ...items]));
        setTotal(Number(response.data?.total) || 0);
        setPage(nextPage);
        setHasMore(Boolean(response.data?.has_more));
      } catch (e) {
        if (id !== requestId.current) return;
        // A failed "load more" keeps what is already on screen.
        if (first) {
          setPhotos([]);
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

  return { photos, total, hasMore, loading, loadingMore, error, loaded: page > 0, reload, loadMore };
}

/**
 * The gallery as FlatList rows of PHOTO_COLUMNS tiles. While the first page
 * loads the rows hold placeholders instead.
 */
export function photoRows(photos, loading) {
  if (loading && photos.length === 0) {
    return Array.from({ length: SKELETON_TILES / PHOTO_COLUMNS }, (_, index) => ({
      id: `photo-skeleton-${index}`,
      skeleton: true,
    }));
  }

  const rows = [];
  for (let start = 0; start < photos.length; start += PHOTO_COLUMNS) {
    rows.push({
      id: `photo-row-${start}`,
      start,
      photos: photos.slice(start, start + PHOTO_COLUMNS),
    });
  }
  return rows;
}

/** One row of the grid. `onPress(index)` gets the photo's index in the gallery. */
export function PhotoGridRow({ row, onPress }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const tileStyle = [styles.tile, { borderColor: theme.border, backgroundColor: theme.iconBackground }];

  if (row.skeleton) {
    return (
      <View style={styles.row}>
        {Array.from({ length: PHOTO_COLUMNS }, (_, index) => (
          <View key={index} style={tileStyle}>
            <MediaShimmer />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {row.photos.map((photo, index) => (
        <TouchableOpacity
          key={`${photo.post_id}-${photo.id}`}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={photo.post_title || t("profile.photoLabel")}
          onPress={() => onPress(row.start + index)}
          style={tileStyle}
        >
          {/* `shimmer`: the tile is sized by aspect ratio, not by a fixed size. */}
          <FastImage source={{ uri: photo.url }} style={styles.image} resizeMode="cover" shimmer />
        </TouchableOpacity>
      ))}
      {/* Keep the tiles of a short last row the same size as the others. */}
      {Array.from({ length: PHOTO_COLUMNS - row.photos.length }, (_, index) => (
        <View key={`gap-${index}`} style={styles.filler} />
      ))}
    </View>
  );
}

/**
 * Full-screen viewer over the gallery's photos (react-native-image-viewing,
 * as on the post screen), with the post each photo comes from.
 *
 * Props:
 *   photos, index, visible, onClose
 *   onOpenPost(photo) - "View post" under the photo
 */
export function ProfilePhotoViewer({ photos, index, visible, onClose, onOpenPost }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const images = React.useMemo(() => photos.map((photo) => ({ uri: photo.url })), [photos]);

  return (
    <ImageView
      images={images}
      imageIndex={Math.min(Math.max(index, 0), Math.max(images.length - 1, 0))}
      visible={visible && images.length > 0}
      onRequestClose={onClose}
      HeaderComponent={({ imageIndex }) => (
        <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.viewerCount}>
            {imageIndex + 1} / {images.length}
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
      )}
      FooterComponent={({ imageIndex }) => {
        const photo = photos[imageIndex];
        if (!photo?.post_id) return null;
        return (
          <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 12 }]}>
            {photo.post_title ? (
              <Text style={styles.viewerTitle} numberOfLines={2}>
                {photo.post_title}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              onPress={() => onOpenPost?.(photo)}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={styles.viewerPostButton}
            >
              <Text style={styles.viewerPostText}>{t("profile.viewPost")}</Text>
            </TouchableOpacity>
          </View>
        );
      }}
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
  // Badges over a photo: the same in both themes.
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
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
