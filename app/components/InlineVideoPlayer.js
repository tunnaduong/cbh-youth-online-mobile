import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import VideoPlayerModal from "./VideoPlayerModal";
import VideoThumbnail from "./VideoThumbnail";

// The real native player - only ever mounted for the single tile that's
// currently "active" (autoplaying), so at most one expo-video player exists
// across the whole feed at a time. Every other tile stays a static
// VideoThumbnail with no player at all.
//
// This is deliberate, not an optimization: mounting a player per video tile
// (even paused/off-screen ones) in a virtualized FlatList caused native
// crashes ("Cannot use shared object that was already released") as
// FlatList recycled rows and released players out from under VideoViews
// that still referenced them. Fully mounting/unmounting this subtree when
// `isActive` flips (instead of keeping one player alive and toggling
// play/pause) mirrors VideoThumbnail/VideoPlayerModal's existing pattern in
// this codebase of never keeping a player mounted longer than it's needed.
const ActiveVideoTile = ({ uri, borderRadius, onOpenFullscreen }) => {
  const [muted, setMuted] = useState(true);

  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = true;
    p.muted = true;
    if (uri) p.play();
  });

  // local key to force VideoView to remount when the `player` reference changes
  const [playerKey, setPlayerKey] = useState(0);
  useEffect(() => {
    setPlayerKey((k) => k + 1);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    player.muted = muted;
  }, [player, muted]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onOpenFullscreen}
        style={[styles.tile, { borderRadius }]}
      >
        {player && typeof player === "object" ? (
          <VideoView
            key={playerKey}
            style={StyleSheet.absoluteFill}
            player={player}
            nativeControls={false}
            contentFit="cover"
            pointerEvents="none"
          />
        ) : null}
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
    </>
  );
};

// Facebook-style inline video tile: the parent feed decides which single
// post is on-screen (via onViewableItemsChanged) and passes `isActive`
// accordingly. Tapping opens a full-screen player with sound + controls.
const InlineVideoPlayer = ({
  uri,
  width,
  height,
  borderRadius = 0,
  isActive = false,
  style,
}) => {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  const showActivePlayer = isActive && !fullscreenVisible;

  return (
    <View style={[{ width, height, borderRadius }, styles.wrapper, style]}>
      {showActivePlayer ? (
        <ActiveVideoTile
          uri={uri}
          borderRadius={borderRadius}
          onOpenFullscreen={() => setFullscreenVisible(true)}
        />
      ) : (
        <VideoThumbnail
          uri={uri}
          width={width}
          height={height}
          borderRadius={borderRadius}
        />
      )}
      {fullscreenVisible && (
        <VideoPlayerModal
          visible={fullscreenVisible}
          uri={uri}
          onClose={() => setFullscreenVisible(false)}
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
