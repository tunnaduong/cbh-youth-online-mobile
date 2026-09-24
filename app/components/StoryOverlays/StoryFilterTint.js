import React from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getStoryFilter } from "./storyFilters";

/**
 * The tint half of a story filter, layered over the media.
 *
 * Photos get the real colour matrix baked in with Skia, but a playing video
 * cannot be run through one on the fly, so video stories (in the editor and in
 * the viewer alike) get this gradient approximation instead. Filters that have
 * no tint are simply not offered for videos.
 */
const StoryFilterTint = ({ filterId }) => {
  const filter = getStoryFilter(filterId);

  if (!filter?.tint) return null;

  return (
    <LinearGradient
      colors={filter.tint.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
};

export default StoryFilterTint;
