import React, { memo } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { OVERLAY_TYPES, getStoryFont } from "./storyOverlayModel";

/**
 * Renders a story's overlay items. The exact same component is used by the
 * editor (so what you drag is what gets posted) and by the viewer, which is
 * the only way normalized coordinates stay honest.
 *
 * `hidden` renders everything at zero opacity: image stories are flattened
 * into the uploaded picture, so the viewer only needs the items to place
 * invisible tap targets over the mentions and links that are already painted
 * into the photo.
 */

/** Chip sizing is derived from the canvas so stories scale with the screen. */
const chipFontSize = (canvasWidth) => Math.round(canvasWidth * 0.042);

export const textEffectStyle = (effect, color) => {
  switch (effect) {
    case "shadow":
      return {
        textShadowColor: "rgba(0,0,0,0.55)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
      };
    case "outline":
      return {
        textShadowColor: "rgba(0,0,0,0.95)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 3,
      };
    case "neon":
      return {
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 14,
      };
    default:
      return null;
  }
};

const StoryTextItem = ({ item }) => {
  const font = getStoryFont(item.font);
  const hasBackground = item.effect === "background";

  return (
    <Text
      style={[
        {
          width: item.width,
          color: hasBackground ? "#111111" : item.color,
          fontSize: item.fontSize,
          lineHeight: item.fontSize * 1.25,
          textAlign: item.align,
        },
        font.style,
        textEffectStyle(item.effect, item.color),
        hasBackground && {
          backgroundColor: item.color,
          paddingHorizontal: item.fontSize * 0.35,
          paddingVertical: item.fontSize * 0.18,
          borderRadius: item.fontSize * 0.3,
          overflow: "hidden",
        },
      ]}
    >
      {item.text}
    </Text>
  );
};

const StoryStickerItem = ({ item }) => (
  <Text style={{ fontSize: item.width, lineHeight: item.width * 1.2 }}>{item.emoji}</Text>
);

const chipColors = (style) =>
  style === "dark"
    ? { background: "rgba(0,0,0,0.55)", text: "#FFFFFF" }
    : { background: "rgba(255,255,255,0.92)", text: "#111111" };

const StoryMentionItem = ({ item, canvasWidth }) => {
  const colors = chipColors(item.style);
  const fontSize = chipFontSize(canvasWidth);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colors.background,
          paddingHorizontal: fontSize * 0.6,
          paddingVertical: fontSize * 0.32,
          borderRadius: fontSize * 0.55,
        },
      ]}
    >
      <Text style={{ color: colors.text, fontSize, fontWeight: "700" }}>
        @{item.username}
      </Text>
    </View>
  );
};

const StoryLinkItem = ({ item, canvasWidth }) => {
  const colors = chipColors(item.style);
  const fontSize = chipFontSize(canvasWidth);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colors.background,
          paddingHorizontal: fontSize * 0.6,
          paddingVertical: fontSize * 0.32,
          borderRadius: fontSize * 0.55,
          gap: fontSize * 0.28,
        },
      ]}
    >
      <Ionicons name="link" size={fontSize} color={colors.text} />
      <Text
        numberOfLines={1}
        style={{ color: colors.text, fontSize, fontWeight: "700", maxWidth: canvasWidth * 0.6 }}
      >
        {item.label || item.url?.replace(/^https?:\/\//i, "")}
      </Text>
    </View>
  );
};

const StoryMusicItem = ({ item, canvasWidth }) => {
  const colors = chipColors(item.style);
  const fontSize = chipFontSize(canvasWidth);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colors.background,
          paddingHorizontal: fontSize * 0.5,
          paddingVertical: fontSize * 0.3,
          borderRadius: fontSize * 0.6,
          gap: fontSize * 0.35,
        },
      ]}
    >
      {item.artworkUrl ? (
        <Image
          source={{ uri: item.artworkUrl }}
          style={{ width: fontSize * 1.6, height: fontSize * 1.6, borderRadius: fontSize * 0.3 }}
        />
      ) : (
        <Ionicons name="musical-notes" size={fontSize} color={colors.text} />
      )}
      <View style={{ maxWidth: canvasWidth * 0.55 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize, fontWeight: "700" }}>
          {item.title}
        </Text>
        {!!item.artist && (
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: fontSize * 0.82, opacity: 0.75 }}>
            {item.artist}
          </Text>
        )}
      </View>
    </View>
  );
};

export const StoryOverlayItemContent = ({ item, canvasWidth }) => {
  switch (item.type) {
    case OVERLAY_TYPES.TEXT:
      return <StoryTextItem item={item} />;
    case OVERLAY_TYPES.STICKER:
      return <StoryStickerItem item={item} />;
    case OVERLAY_TYPES.MENTION:
      return <StoryMentionItem item={item} canvasWidth={canvasWidth} />;
    case OVERLAY_TYPES.LINK:
      return <StoryLinkItem item={item} canvasWidth={canvasWidth} />;
    case OVERLAY_TYPES.MUSIC:
      return <StoryMusicItem item={item} canvasWidth={canvasWidth} />;
    default:
      return null;
  }
};

const StoryOverlayLayer = ({
  items = [],
  canvasWidth,
  hidden = false,
  interactive = false,
  onPressMention,
  onPressLink,
}) => {
  if (!items.length) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={interactive ? "box-none" : "none"}
    >
      {items.map((item, index) => {
        const isTappable =
          interactive &&
          (item.type === OVERLAY_TYPES.MENTION || item.type === OVERLAY_TYPES.LINK);

        const placement = {
          position: "absolute",
          left: item.x,
          top: item.y,
          transform: [{ scale: item.scale }, { rotate: `${item.rotation}deg` }],
        };

        // The item is hidden by making its *content* transparent rather than
        // the tappable box itself: iOS skips any view with an alpha under
        // 0.01 while hit-testing, so fading the box out would silently kill
        // every mention/link tap on flattened photo stories.
        const content = (
          <View style={hidden ? styles.hiddenContent : null}>
            <StoryOverlayItemContent item={item} canvasWidth={canvasWidth} />
          </View>
        );

        if (!isTappable) {
          return (
            <View key={item.id || index} style={placement} pointerEvents="none">
              {content}
            </View>
          );
        }

        return (
          <Pressable
            key={item.id || index}
            style={placement}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={() =>
              item.type === OVERLAY_TYPES.MENTION
                ? onPressMention?.(item)
                : onPressLink?.(item)
            }
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContent: {
    opacity: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default memo(StoryOverlayLayer);
