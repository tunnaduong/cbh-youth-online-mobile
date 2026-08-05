import React, { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
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
const ActiveVideoTile = ({ uri, borderRadius, onOpenFullscreen, interactive }) => {
  const [muted, setMuted] = useState(true);
  const isFocused = useIsFocused();

  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = true;
    p.muted = true;
    if (uri) p.play();
  });

  useEffect(() => {
    console.debug("[InlineVideoPlayer] player changed", { uri, player });
    return () => {
      if (!player) return;
      try {
        if (typeof player.playing !== "undefined" ? player.playing === true : false) {
          if (typeof player.pause === "function") {
            player.pause();
            console.debug("[InlineVideoPlayer] paused player during cleanup", { uri });
          }
        }
      } catch (e) {
        console.warn("[InlineVideoPlayer] error pausing player during cleanup", e);
      }
      try {
        if (typeof player.release === "function") {
          player.release();
          console.debug("[InlineVideoPlayer] released player during cleanup", { uri });
        }
      } catch (e) {
        console.warn("[InlineVideoPlayer] error releasing player during cleanup", e);
      }
    };
  }, [player, uri]);

  // local key to force VideoView to remount when the `player` reference changes
  const [playerKey, setPlayerKey] = useState(0);
  useEffect(() => {
    setPlayerKey((k) => k + 1);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    player.muted = muted;
  }, [player, muted]);

  // Pause the player when the screen loses focus to avoid autoplay across screens
  useEffect(() => {
    if (!player || typeof player !== "object") return;
    if (!isFocused) {
      try {
        if (typeof player.pause === "function") player.pause();
      } catch (e) {
        console.warn("InlineVideoPlayer: failed to pause player on blur", e);
      }
    }
  }, [isFocused, player]);

  // A TouchableOpacity covering the whole tile claims the touch responder
  // the instant a touch starts, which blocks any ancestor gesture handling
  // (chat's swipe-to-reply PanResponder, long-press-for-reactions) from ever
  // seeing the touch - only the feed (PostItem) actually needs this tile's
  // own tap-to-fullscreen, since it has no competing ancestor gestures.
  // Chat passes interactive={false} to fall back to a plain View so touches
  // pass through to the message bubble's own tap/long-press/swipe handling.
  const Tile = interactive ? TouchableOpacity : View;
  const tileProps = interactive
    ? { activeOpacity: 1, onPress: onOpenFullscreen }
    : {};

  return (
    <>
      <Tile style={[styles.tile, { borderRadius }]} {...tileProps}>
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
      </Tile>
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
  // Feed posts (PostItem) have no competing ancestor gesture, so the tile's
  // own tap-to-fullscreen is the only way to open it - keep that on by
  // default. Chat messages already have a bubble-level tap/long-press/swipe
  // stack that a nested touchable here would block; pass interactive={false}
  // there to let those handle taps instead (see ConversationScreen.js).
  interactive = true,
}) => {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const isFocused = useIsFocused();

  const showActivePlayer = isActive && !fullscreenVisible && isFocused;

  return (
    <View style={[{ width, height, borderRadius }, styles.wrapper, style]}>
      {showActivePlayer ? (
        <ActiveVideoTile
          uri={uri}
          borderRadius={borderRadius}
          onOpenFullscreen={() => setFullscreenVisible(true)}
          interactive={interactive}
        />
      ) : (
        <VideoThumbnail
          uri={uri}
          width={width}
          height={height}
          borderRadius={borderRadius}
        />
      )}
      {interactive && fullscreenVisible && (
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
