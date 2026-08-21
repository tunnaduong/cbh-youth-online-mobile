import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import VideoPlayerModal from "./VideoPlayerModal";

// A single reusable tile for a video attachment: a real first-frame
// thumbnail (extracted via the native video decoder - no player is ever
// mounted here, so there's no chance of it playing in the background) with
// a play button that opens the shared full-screen VideoPlayerModal on tap,
// plus an optional remove (trash) badge for picker/edit contexts. Used by
// the create-post composer, edit-post form, and the post feed/detail card
// so there's one video-attachment tile implementation instead of three.
const VideoThumbnail = ({
  uri,
  width = 130,
  height = 130,
  borderRadius = 16,
  onRemove,
  style,
  // Fires once the poster image reports its natural pixel size - lets a
  // caller size the tile to the video's real aspect ratio instead of
  // forcing a fixed box (which either crops or letterboxes it). No-op by
  // default so existing callers are unaffected.
  onLoad = () => {},
}) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [thumbnailUri, setThumbnailUri] = useState(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setThumbnailUri(null);
    setThumbnailFailed(false);
    if (!uri) return undefined;

    VideoThumbnails.getThumbnailAsync(uri, { time: 0 })
      .then((result) => {
        if (!cancelled) setThumbnailUri(result.uri);
      })
      .catch(() => {
        if (!cancelled) setThumbnailFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <View style={[{ width, height, borderRadius }, styles.wrapper, style]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setPreviewVisible(true)}
        style={[styles.tile, { borderRadius }]}
      >
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={(e) => {
              const size = e?.nativeEvent?.source;
              if (size?.width && size?.height) onLoad({ width: size.width, height: size.height });
            }}
          />
        ) : thumbnailFailed ? (
          <Ionicons name="videocam" size={28} color="rgba(255,255,255,0.85)" />
        ) : (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
        )}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      </TouchableOpacity>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <Ionicons name="trash" size={16} color="#fff" />
        </TouchableOpacity>
      )}
      {/* Only mount the modal (and the player it creates) once the user has
          actually tapped to open it - useVideoPlayer's setup calls .play()
          as soon as it's created, and Modal keeps its children mounted in
          the tree even while visible={false}, so rendering this
          unconditionally would start real playback in the background the
          instant every tile in a list/feed appears. */}
      {previewVisible && (
        <VideoPlayerModal
          visible={previewVisible}
          uri={uri}
          onClose={() => setPreviewVisible(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    overflow: "hidden",
  },
  tile: {
    flex: 1,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    padding: 6,
  },
});

export default VideoThumbnail;
