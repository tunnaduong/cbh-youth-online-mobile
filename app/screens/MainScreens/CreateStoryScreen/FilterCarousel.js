import React, { memo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  useImage,
} from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STORY_FILTERS, VIDEO_STORY_FILTERS } from "../../../components/StoryOverlays/storyFilters";

const THUMB_SIZE = 54;

/**
 * Filter picker. Photo stories preview the real thing - the thumbnail is the
 * picked picture run through the same colour matrix that gets baked in on
 * share. Video stories only list the filters that have a tint, because that is
 * all that can actually be layered over a playing video.
 */
const FilterThumbnail = ({ uri, filter }) => {
  const image = useImage(uri);

  if (!image) {
    return (
      <View style={[styles.thumb, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
    );
  }

  // Photos are graded with the colour matrix alone (the tint is only the
  // video stand-in), so the thumbnail shows exactly that.
  return (
    <View style={styles.thumb}>
      <Canvas style={{ width: THUMB_SIZE, height: THUMB_SIZE }}>
        <SkiaImage image={image} x={0} y={0} width={THUMB_SIZE} height={THUMB_SIZE} fit="cover">
          {filter.matrix && <ColorMatrix matrix={filter.matrix} />}
        </SkiaImage>
      </Canvas>
    </View>
  );
};

const FilterCarousel = ({ mediaUri, isVideo, selectedFilter, onSelect }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const filters = isVideo ? VIDEO_STORY_FILTERS : STORY_FILTERS;

  return (
    // Sits above the home indicator so the filter names are never clipped.
    <View
      style={[styles.container, { paddingBottom: insets.bottom + 10 }]}
      pointerEvents="box-none"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {filters.map((filter) => {
          const active = filter.id === selectedFilter;

          return (
            <TouchableOpacity
              key={filter.id}
              onPress={() => onSelect(filter.id)}
              style={styles.item}
              activeOpacity={0.8}
            >
              <View style={[styles.thumbFrame, active && styles.thumbFrameActive]}>
                {isVideo || !mediaUri ? (
                  <View style={[styles.thumb, { backgroundColor: "#333" }]}>
                    {!!filter.tint && (
                      <LinearGradient
                        colors={filter.tint.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                  </View>
                ) : (
                  <FilterThumbnail uri={mediaUri} filter={filter} />
                )}
              </View>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {t(filter.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  row: {
    paddingHorizontal: 12,
    gap: 12,
  },
  item: {
    alignItems: "center",
    width: THUMB_SIZE + 10,
  },
  thumbFrame: {
    padding: 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbFrameActive: {
    borderColor: "#fff",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: "hidden",
  },
  label: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  labelActive: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default memo(FilterCarousel);
