import React, { memo, useEffect, useMemo, useState } from "react";
import { Image } from "react-native";
import StoryOverlayLayer from "./StoryOverlayLayer";
import StoryFilterTint from "./StoryFilterTint";
import {
  denormalizeOverlayItem,
  getStoryCanvasRect,
  getStoryCanvasRectForMedia,
} from "./storyOverlayModel";

const aspectCache = new Map();

/**
 * Real width/height ratio of a story picture, so overlays can be anchored to
 * the picture rather than to an assumed 9:16 frame. Resolves through the
 * image cache the viewer has already filled, so it is effectively instant.
 */
const useMediaAspect = (uri) => {
  const [aspect, setAspect] = useState(() => (uri ? aspectCache.get(uri) ?? null : null));

  useEffect(() => {
    if (!uri) return undefined;

    if (aspectCache.has(uri)) {
      setAspect(aspectCache.get(uri));
      return undefined;
    }

    let cancelled = false;

    Image.getSize(
      uri,
      (width, height) => {
        if (!width || !height) return;
        aspectCache.set(uri, width / height);
        if (!cancelled) setAspect(width / height);
      },
      () => {}
    );

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return aspect;
};

/**
 * Story overlays as the viewer shows them: the filter tint for videos, and
 * every sticker laid out against the letterboxed media - visible on videos,
 * invisible tap targets on flattened photos.
 */
const StoryViewerOverlay = ({
  overlays,
  mediaUri,
  isVideo = false,
  viewportWidth,
  viewportHeight,
  interactive = false,
  onPressMention,
  onPressLink,
}) => {
  // Videos are uploaded untouched and letterboxed as-is, so the canvas is
  // the standard contained 9:16 frame; photos follow their real dimensions.
  const mediaAspect = useMediaAspect(!isVideo && overlays?.flattened ? mediaUri : null);

  const rect = useMemo(
    () =>
      mediaAspect
        ? getStoryCanvasRectForMedia(viewportWidth, viewportHeight, mediaAspect)
        : getStoryCanvasRect(viewportWidth, viewportHeight),
    [mediaAspect, viewportWidth, viewportHeight]
  );

  const items = useMemo(
    () => (overlays?.items || []).map((item, index) => denormalizeOverlayItem(item, rect, index)),
    [overlays, rect]
  );

  if (!overlays) return null;

  return (
    <>
      {isVideo && <StoryFilterTint filterId={overlays.filter} />}
      <StoryOverlayLayer
        items={items}
        canvasWidth={rect.width}
        hidden={Boolean(overlays.flattened)}
        interactive={interactive}
        onPressMention={onPressMention}
        onPressLink={onPressLink}
      />
    </>
  );
};

export default memo(StoryViewerOverlay);
