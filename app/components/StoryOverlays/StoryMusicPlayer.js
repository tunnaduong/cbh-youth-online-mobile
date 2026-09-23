import React, { useEffect, useRef } from "react";
import Video from "react-native-video";

/**
 * Plays the soundtrack attached to the story currently on screen.
 *
 * It is mounted once per story viewer (not per story) on purpose: every user's
 * story list stays mounted in the background, so a per-story player would have
 * several tracks playing at once.
 *
 * react-native-video happily plays a bare audio url; the view is collapsed to
 * nothing so only the sound comes through.
 */
const StoryMusicPlayer = ({ music, paused = false, volume = 1 }) => {
  const playerRef = useRef(null);
  const previewUrl = music?.previewUrl;

  useEffect(() => {
    // A new track always starts from its trim point.
    if (previewUrl && music?.startMs) {
      playerRef.current?.seek?.(music.startMs / 1000);
    }
  }, [previewUrl, music?.startMs]);

  if (!previewUrl) return null;

  return (
    <Video
      key={previewUrl}
      ref={playerRef}
      source={{ uri: previewUrl }}
      paused={paused}
      repeat
      volume={volume}
      playInBackground={false}
      ignoreSilentSwitch="ignore"
      onLoad={() => {
        if (music?.startMs) {
          playerRef.current?.seek?.(music.startMs / 1000);
        }
      }}
      onError={(error) => {
        console.warn("Story music playback failed:", error?.error?.errorString || error);
      }}
      // 1x1 rather than 0x0: a collapsed view can be skipped by the native
      // layout pass, and the player needs to exist for the audio to start.
      style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
    />
  );
};

export default StoryMusicPlayer;
