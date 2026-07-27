import React from "react";
import { Modal, View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Full-screen video player - a separate component so useVideoPlayer only ever
// mounts (and allocates a native player) while the modal is actually open.
// Shared by chat message attachments and post video attachments so there's
// one full-screen video viewer implementation in the app.
const VideoPlayerModal = ({ visible, uri, onClose }) => {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = false;
    if (uri) p.play();
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={[styles.close, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {uri && (
          <VideoView
            style={styles.player}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  close: {
    position: "absolute",
    right: 20,
    zIndex: 1,
    padding: 6,
  },
  player: {
    width: "100%",
    height: "100%",
  },
});

export default VideoPlayerModal;
