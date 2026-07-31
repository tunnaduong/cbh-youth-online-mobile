import React from "react";
import { Modal, View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";

// Full-screen video player - a separate component so useVideoPlayer only ever
// mounts (and allocates a native player) while the modal is actually open.
// Shared by chat message attachments and post video attachments so there's
// one full-screen video viewer implementation in the app.
const VideoPlayerModal = ({ visible, uri, onClose }) => {
  const insets = useSafeAreaInsets();
  const { autoplayVideos } = useTheme();
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = false;
    if (uri && autoplayVideos) p.play();
  });

  const isFocused = useIsFocused();
  // Pause player when containing screen loses focus
  React.useEffect(() => {
    if (!player || typeof player !== "object") return;
    if (!isFocused) {
      try {
        if (typeof player.pause === "function") player.pause();
      } catch (e) {
        console.warn("VideoPlayerModal: failed to pause player on blur", e);
      }
    }
  }, [isFocused, player]);

  // ensure the VideoView remounts if the underlying player reference changes
  const [playerKey, setPlayerKey] = React.useState(0);
  React.useEffect(() => {
    setPlayerKey((k) => k + 1);
  }, [player]);

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
        {player && typeof player === "object" ? (
          <VideoView
            key={playerKey}
            style={styles.player}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        ) : null}
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
