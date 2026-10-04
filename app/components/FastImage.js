import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import MediaShimmer from "./MediaShimmer";
import { useAuthContext } from "../contexts/AuthContext";

// Matches .../v1.0/users/<username>/avatar or /cover, with or without an
// existing query string - used below to recognize when a URL rendered
// *anywhere* in the app (chat bubbles, participant lists, search results,
// reaction "who reacted" lists, etc. - all built server-side from the raw,
// un-versioned `.../avatar` endpoint) happens to be the CURRENT user's own,
// so it can be cache-busted the same way ProfileScreen already does. Without
// this, only the one or two screens that call AuthContext's getAvatarUrl()
// directly ever saw your own freshly-changed avatar/cover - everywhere else
// kept showing whatever expo-image had cached from before the change, since
// the URL (its cache key) never changed.
const OWN_MEDIA_RE = /\/v1\.0\/users\/([^/?]+)\/(avatar|cover)(?:\?.*)?$/i;

// An image with a side known to be shorter than this - avatars, icons, which
// fill long lists - loads without a placeholder. Everything else that comes
// from the network gets one (MediaShimmer: the app's loading indicator).
const SHIMMER_MIN_SIZE = 100;

const FastImage = React.forwardRef(({ source, resizeMode, style, onLoad, onError, shimmer = false, ...props }, ref) => {
  const [settled, setSettled] = useState(false);
  const { username, avatarVersion, coverVersion } = useAuthContext();

  // map resizeMode to contentFit
  let contentFit = "cover";
  if (resizeMode) {
    if (resizeMode === "contain" || resizeMode === "cover" || resizeMode === "center") {
      contentFit = resizeMode === "center" ? "none" : resizeMode;
    } else if (resizeMode === "stretch") {
      contentFit = "fill";
    }
  }

  // FastImage might have source as { uri: '...', headers: '...', priority: '...' }
  // We can pass source directly, expo-image source supports { uri, headers, priority }
  let mappedSource = source;
  if (source && typeof source === "object" && source.uri) {
    let uri = source.uri;
    const match = uri.match(OWN_MEDIA_RE);
    if (match && match[1] === username && !/[?&]v=/.test(uri)) {
      const version = match[2] === "avatar" ? avatarVersion : coverVersion;
      if (version > 1) {
        uri += (uri.includes("?") ? "&" : "?") + `v=${version}`;
      }
    }
    mappedSource = {
      uri,
      headers: source.headers,
    };
  }

  // Support priority prop if it's in source
  const priority = (source && source.priority) ? source.priority.toLowerCase() : undefined;

  // The placeholder needs a box of its own, so the image's style moves to a
  // wrapper and the image fills it.
  const flat = StyleSheet.flatten(style) || {};
  const uri = mappedSource && typeof mappedSource === "object" ? mappedSource.uri : null;
  const remote = typeof uri === "string" && /^https?:/i.test(uri);
  const knownSmall =
    (typeof flat.width === "number" && flat.width < SHIMMER_MIN_SIZE) ||
    (typeof flat.height === "number" && flat.height < SHIMMER_MIN_SIZE);
  // Something in the style has to give the wrapper its size: a remote image
  // has none of its own before it loads.
  const hasBox =
    flat.width != null ||
    flat.height != null ||
    flat.flex != null ||
    flat.aspectRatio != null ||
    flat.position === "absolute";
  // `shimmer` forces it where the caller knows better than this check.
  const large = shimmer || (remote && !knownSmall && hasBox);

  // A recycled list row shows a different picture in the same component.
  useEffect(() => {
    setSettled(false);
  }, [uri]);

  const image = (imageStyle) => (
    <Image
      ref={ref}
      source={mappedSource}
      contentFit={contentFit}
      priority={priority}
      cachePolicy="memory-disk"
      transition={200}
      style={imageStyle}
      {...props}
      onLoad={(event) => {
        if (large) setSettled(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        if (large) setSettled(true);
        onError?.(event);
      }}
    />
  );

  if (!large || !mappedSource) {
    return image(style);
  }

  // These only mean something on an image; a View warns about them.
  const { tintColor, resizeMode: _resizeMode, objectFit: _objectFit, ...boxStyle } = flat;

  return (
    <View style={[boxStyle, { overflow: "hidden" }]}>
      {!settled && <MediaShimmer />}
      {image(tintColor ? [StyleSheet.absoluteFill, { tintColor }] : StyleSheet.absoluteFill)}
    </View>
  );
});

// Mock the static constants
FastImage.resizeMode = {
  contain: "contain",
  cover: "cover",
  stretch: "stretch",
  center: "center",
};

FastImage.priority = {
  low: "low",
  normal: "normal",
  high: "high",
};

FastImage.cacheControl = {
  immutable: "immutable",
  web: "web",
  cacheOnly: "cacheOnly",
};

export default FastImage;
