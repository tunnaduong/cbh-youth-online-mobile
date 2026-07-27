import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VideoPlayerModal from "./VideoPlayerModal";

// A single reusable tile for a video attachment: a placeholder + play button
// that opens the shared full-screen VideoPlayerModal on tap, with an optional
// remove (trash) badge for picker/edit contexts. Used by the create-post
// composer, edit-post form, and the post feed/detail card so there's one
// video-attachment tile implementation instead of three.
const VideoThumbnail = ({
  uri,
  width = 130,
  height = 130,
  borderRadius = 16,
  onRemove,
  style,
}) => {
  const [previewVisible, setPreviewVisible] = useState(false);

  return (
    <View style={[{ width, height, borderRadius }, styles.wrapper, style]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setPreviewVisible(true)}
        style={[styles.tile, { borderRadius }]}
      >
        <Ionicons name="videocam" size={28} color="rgba(255,255,255,0.85)" />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      </TouchableOpacity>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <Ionicons name="trash" size={16} color="#fff" />
        </TouchableOpacity>
      )}
      <VideoPlayerModal
        visible={previewVisible}
        uri={uri}
        onClose={() => setPreviewVisible(false)}
      />
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
