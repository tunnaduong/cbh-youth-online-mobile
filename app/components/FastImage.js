import React from "react";
import { Image } from "expo-image";
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

const FastImage = React.forwardRef(({ source, resizeMode, style, ...props }, ref) => {
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

  return (
    <Image
      ref={ref}
      source={mappedSource}
      contentFit={contentFit}
      priority={priority}
      cachePolicy="memory-disk"
      transition={200}
      style={style}
      {...props}
    />
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
