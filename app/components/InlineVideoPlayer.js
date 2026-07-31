import React, { useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import VideoPlayerModal from "./VideoPlayerModal";

// Facebook-style inline video tile: muted, looping autoplay driven purely by
// the `isActive` prop (the parent feed decides visibility via
// onViewableItemsChanged), with a mute toggle and a tap-to-open full-screen
// player with sound + native controls. One native player is created per
// tile (feed lists are virtualized, so only on-screen tiles pay this cost).
const InlineVideoPlayer = ({
  uri,
  width,
  height,
  borderRadius = 0,
  isActive = false,
  style,
}) => {
  const [muted, setMuted] = useState(true);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const wasActiveBeforeFullscreen = useRef(false);

  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (!player) return;
    if (isActive && !fullscreenVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, isActive, fullscreenVisible]);

  const openFullscreen = () => {
    wasActiveBeforeFullscreen.current = isActive;
    setFullscreenVisible(true);
  };

  const closeFullscreen = () => {
    setFullscreenVisible(false);
  };

  return (
    <View style={[{ width, height, borderRadius }, styles.wrapper, style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={openFullscreen}
        style={[styles.tile, { borderRadius }]}
      >
        {uri && (
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={false}
            contentFit="cover"
            pointerEvents="none"
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setMuted((m) => !m)}
        style={styles.muteButton}
        hitSlop={8}
      >
        <Ionicons
          name={muted ? "volume-mute" : "volume-high"}
          size={16}
          color="#fff"
        />
      </TouchableOpacity>
      {fullscreenVisible && (
        <VideoPlayerModal
          visible={fullscreenVisible}
          uri={uri}
          onClose={closeFullscreen}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#000",
  },
  tile: {
    flex: 1,
  },
  muteButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default InlineVideoPlayer;
