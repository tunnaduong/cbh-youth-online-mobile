import { Platform } from "react-native";

/**
 * Stories are authored and rendered on a 9:16 canvas. Every overlay (text,
 * sticker, mention, link, music chip) is stored normalized against that canvas
 * - x/width against its width, y against its height - so the editor, the
 * mobile viewer and the web viewer can all lay the same story out at whatever
 * size they happen to have.
 */
export const STORY_ASPECT_RATIO = 9 / 16;

export const OVERLAY_TYPES = {
  TEXT: "text",
  STICKER: "sticker",
  MENTION: "mention",
  LINK: "link",
  MUSIC: "music",
};

/**
 * Fonts available to story text. Kept to families that ship with both
 * platforms so a story authored on iOS still renders on Android.
 */
export const STORY_FONTS = [
  {
    id: "classic",
    labelKey: "story.fonts.classic",
    style: { fontWeight: "800" },
    css: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  {
    id: "modern",
    labelKey: "story.fonts.modern",
    style: Platform.select({
      ios: { fontFamily: "AvenirNext-Bold" },
      android: { fontFamily: "sans-serif-condensed", fontWeight: "700" },
      default: { fontWeight: "700" },
    }),
    css: "'Avenir Next', 'Helvetica Neue', sans-serif",
  },
  {
    id: "typewriter",
    labelKey: "story.fonts.typewriter",
    style: Platform.select({
      ios: { fontFamily: "Courier New", fontWeight: "700" },
      android: { fontFamily: "monospace", fontWeight: "700" },
      default: { fontFamily: "monospace" },
    }),
    css: "'Courier New', monospace",
  },
  {
    id: "serif",
    labelKey: "story.fonts.serif",
    style: Platform.select({
      ios: { fontFamily: "Georgia", fontWeight: "700" },
      android: { fontFamily: "serif", fontWeight: "700" },
      default: { fontFamily: "serif" },
    }),
    css: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "handwriting",
    labelKey: "story.fonts.handwriting",
    style: Platform.select({
      ios: { fontFamily: "SnellRoundhand-Black" },
      android: { fontFamily: "cursive" },
      default: { fontStyle: "italic" },
    }),
    css: "'Snell Roundhand', 'Segoe Script', cursive",
  },
];

export const getStoryFont = (id) =>
  STORY_FONTS.find((font) => font.id === id) || STORY_FONTS[0];

/** Text decoration presets, mirroring Instagram's "Aa" style toggle. */
export const TEXT_EFFECTS = ["none", "shadow", "outline", "background", "neon"];

export const STORY_TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#00C7BE",
  "#0A84FF",
  "#5E5CE6",
  "#FF2D55",
  "#A2845E",
  "#8E8E93",
];

/**
 * Emoji sticker packs shown in the sticker sheet. Emoji keeps stickers
 * weightless (no assets to ship or host) while still covering what people
 * actually reach for.
 */
export const STICKER_PACKS = [
  {
    id: "smileys",
    labelKey: "story.stickerPacks.smileys",
    stickers: ["😀", "😂", "🥰", "😎", "🤩", "😭", "😱", "🥳", "😴", "🤔", "😇", "🤯", "😅", "🙃", "😍", "🤗"],
  },
  {
    id: "love",
    labelKey: "story.stickerPacks.love",
    stickers: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💘", "💕", "💞", "💌", "😻", "🌹", "💐"],
  },
  {
    id: "fun",
    labelKey: "story.stickerPacks.fun",
    stickers: ["🔥", "✨", "🎉", "🎊", "🎈", "🎁", "🏆", "⭐️", "🌟", "💯", "👏", "🙌", "🤝", "👍", "✌️", "🤙"],
  },
  {
    id: "school",
    labelKey: "story.stickerPacks.school",
    stickers: ["📚", "✏️", "📝", "🎓", "🏫", "🧠", "💡", "⏰", "📅", "🔬", "🧪", "🗓️", "📖", "🖊️", "📐", "🎒"],
  },
  {
    id: "nature",
    labelKey: "story.stickerPacks.nature",
    stickers: ["🌸", "🌺", "🌻", "🌈", "☀️", "🌙", "⛅️", "❄️", "🌊", "🍀", "🌴", "🍁", "🐶", "🐱", "🦋", "🌵"],
  },
];

/**
 * Fit the whole 9:16 story canvas inside a viewport, letterboxing it the way
 * the viewer shows the media itself (`resizeMode: "contain"`). Overlays are
 * positioned against the returned rect, so what the author placed on the
 * canvas is exactly what every viewer sees - nothing is cropped away at the
 * edges on tall phones.
 */
export const getStoryCanvasRect = (viewportWidth, viewportHeight) => {
  let width = viewportWidth;
  let height = viewportWidth / STORY_ASPECT_RATIO;

  if (height > viewportHeight) {
    height = viewportHeight;
    width = viewportHeight * STORY_ASPECT_RATIO;
  }

  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
  };
};

/**
 * Contain-fit variant, used by the editor where the whole 9:16 canvas has to
 * stay visible instead of being cropped.
 */
export const getContainedCanvasSize = (availableWidth, availableHeight) => {
  const idealHeight = availableWidth / STORY_ASPECT_RATIO;

  if (availableHeight <= 0 || idealHeight <= availableHeight) {
    return { width: availableWidth, height: idealHeight };
  }

  return { width: availableHeight * STORY_ASPECT_RATIO, height: availableHeight };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Editor item (absolute px on the 9:16 canvas) -> stored item (normalized).
 */
export const normalizeOverlayItem = (item, canvasWidth, canvasHeight) => {
  const base = {
    type: item.type,
    x: clamp(item.x / canvasWidth, -1, 2),
    y: clamp(item.y / canvasHeight, -1, 2),
    scale: clamp(toNumber(item.scale, 1), 0.1, 8),
    rotation: clamp(toNumber(item.rotation, 0), -360, 360),
    width: clamp(toNumber(item.width, canvasWidth * 0.8) / canvasWidth, 0.05, 2),
  };

  switch (item.type) {
    case OVERLAY_TYPES.TEXT:
      return {
        ...base,
        text: item.text,
        color: item.color,
        font: item.font,
        effect: item.effect,
        align: item.align,
        fontSize: clamp(toNumber(item.fontSize, 28) / canvasWidth, 0.01, 0.4),
      };
    case OVERLAY_TYPES.STICKER:
      return { ...base, emoji: item.emoji };
    case OVERLAY_TYPES.MENTION:
      return {
        ...base,
        username: item.username,
        user_id: item.userId ?? item.user_id ?? null,
        style: item.style || "light",
      };
    case OVERLAY_TYPES.LINK:
      return { ...base, url: item.url, label: item.label || "", style: item.style || "light" };
    case OVERLAY_TYPES.MUSIC:
      return {
        ...base,
        title: item.title || "",
        artist: item.artist || "",
        artwork_url: item.artworkUrl || item.artwork_url || null,
        style: item.style || "light",
      };
    default:
      return base;
  }
};

/**
 * Stored item (normalized) -> render item (absolute px inside `rect`).
 */
export const denormalizeOverlayItem = (item, rect, index = 0) => {
  const width = rect.width;
  const height = rect.height;

  const base = {
    id: item.id || `${item.type}_${index}`,
    type: item.type,
    x: rect.x + toNumber(item.x, 0.5) * width,
    y: rect.y + toNumber(item.y, 0.5) * height,
    scale: toNumber(item.scale, 1),
    rotation: toNumber(item.rotation, 0),
    width: toNumber(item.width, 0.8) * width,
  };

  switch (item.type) {
    case OVERLAY_TYPES.TEXT:
      return {
        ...base,
        text: item.text || "",
        color: item.color || "#FFFFFF",
        font: item.font || "classic",
        effect: item.effect || "none",
        align: item.align || "center",
        fontSize: toNumber(item.fontSize, 0.08) * width,
      };
    case OVERLAY_TYPES.STICKER:
      return { ...base, emoji: item.emoji || "" };
    case OVERLAY_TYPES.MENTION:
      return {
        ...base,
        username: item.username || "",
        userId: item.user_id ?? item.userId ?? null,
        style: item.style || "light",
      };
    case OVERLAY_TYPES.LINK:
      return { ...base, url: item.url || "", label: item.label || "", style: item.style || "light" };
    case OVERLAY_TYPES.MUSIC:
      return {
        ...base,
        title: item.title || "",
        artist: item.artist || "",
        artworkUrl: item.artwork_url || item.artworkUrl || null,
        style: item.style || "light",
      };
    default:
      return base;
  }
};

/**
 * Parse whatever the API returned for a story's `overlays` column - it can
 * arrive as an object (JSON column) or as a string (older rows / form posts).
 */
export const parseStoryOverlays = (raw) => {
  if (!raw) return null;

  let payload = raw;

  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  if (!payload || typeof payload !== "object") return null;

  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    version: payload.version || 1,
    flattened: Boolean(payload.flattened),
    filter: payload.filter || "none",
    items,
  };
};

export const parseStoryMusic = (raw) => {
  if (!raw) return null;

  let payload = raw;

  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  if (!payload || typeof payload !== "object" || !payload.preview_url) return null;

  return {
    provider: payload.provider || "itunes",
    trackId: payload.track_id ?? payload.trackId ?? null,
    title: payload.title || "",
    artist: payload.artist || "",
    artworkUrl: payload.artwork_url || payload.artworkUrl || null,
    previewUrl: payload.preview_url || payload.previewUrl,
    startMs: toNumber(payload.start_ms ?? payload.startMs, 0),
    durationMs: toNumber(payload.duration_ms ?? payload.durationMs, 0),
  };
};
