import { useState, useEffect } from "react";
import { View, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTheme } from "../../../../contexts/ThemeContext";
import { styles } from "./styles";

// Full-screen video player - a separate component so useVideoPlayer only ever
// mounts (and allocates a native player) while the modal is actually open.
export const VideoViewerModal = ({ visible, uri, onClose, insetsTop, footer }) => {
  const { autoplayVideos } = useTheme();
  const isFocused = useIsFocused();
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = false;
    if (uri && autoplayVideos) p.play();
  });

  useEffect(() => {
    if (!player || typeof player !== "object") return;
    if (!isFocused) {
      try {
        if (typeof player.pause === "function") player.pause();
      } catch (e) {
        console.warn("VideoViewerModal: failed to pause player on blur", e);
      }
    }
  }, [isFocused, player]);

  useEffect(() => {
    console.log("[VideoViewerModal] player mounted/changed", { uri, player });
    return () => {
      if (!player) return;
      try {
        if (typeof player.playing !== "undefined" ? player.playing === true : false) {
          if (typeof player.pause === "function") {
            player.pause();
            console.log("[VideoViewerModal] paused player during cleanup", { uri });
          }
        }
      } catch (e) {
        console.warn("[VideoViewerModal] error pausing player during cleanup", e);
      }
      try {
        if (typeof player.release === "function") {
          player.release();
          console.log("[VideoViewerModal] released player during cleanup", { uri });
        }
      } catch (e) {
        console.warn("[VideoViewerModal] error releasing player during cleanup", e);
      }
    };
  }, [player, uri]);

  // remount the VideoView if the player reference changes to avoid
  // referencing a native player that was already released
  const [playerKey, setPlayerKey] = useState(0);
  useEffect(() => {
    setPlayerKey((k) => k + 1);
  }, [player]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoViewerBackdrop}>
        <TouchableOpacity
          style={[styles.videoViewerClose, { top: insetsTop + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {player && typeof player === "object" ? (
          <VideoView
            key={playerKey}
            style={styles.videoViewerPlayer}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        ) : null}
        {/* Optional overlay (currently just the Gallery's sender/time +
            share/save/jump-to-message bar) - undefined everywhere else, so
            existing callers are unaffected. */}
        {footer}
      </View>
    </Modal>
  );
};

