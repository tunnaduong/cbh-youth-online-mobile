import React from "react";
import { Image } from "expo-image";

const FastImage = React.forwardRef(({ source, resizeMode, style, ...props }, ref) => {
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
    mappedSource = {
      uri: source.uri,
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
