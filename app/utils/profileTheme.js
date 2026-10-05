/**
 * Tuỳ chỉnh giao diện trang cá nhân (kiểu Discord Nitro) - bản mobile của
 * src/lib/profileTheme.js bên web.
 *
 * API trả `profile.theme` (trang cá nhân) / `profile_theme` (tác giả bài viết,
 * bình luận, chat, xếp hạng, thông báo) = null (giao diện mặc định) hoặc:
 *   { primary_color, accent_color, banner_color, name_font, name_effect,
 *     name_colors, avatar_frame, profile_effect, profile_frame,
 *     name_icon, name_icon_emoji, username_style }
 * Danh sách key hợp lệ và quyền mở khoá nằm ở App\Services\ProfileThemeService
 * phía API - thêm key mới phải thêm ở cả API, web và đây (font: nameFonts.js).
 */

export const DEFAULT_PRIMARY = "#319527";
export const DEFAULT_ACCENT = "#22d3ee";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Cách vẽ từng khung avatar (xem AvatarFrame):
 *   colors   - các điểm màu của viền; không có thì lấy màu theme người dùng
 *   sweep    - true: gradient xoay quanh tâm (conic), false: chéo 135°
 *   animated - viền xoay chậm
 */
export const AVATAR_FRAMES = {
  theme: { sweep: false },
  trainee: { colors: ["#9ca3af", "#f3f4f6", "#9ca3af"], sweep: false },
  active: { colors: ["#2563eb", "#38bdf8", "#a5f3fc", "#38bdf8", "#2563eb"], sweep: true },
  distinguished: {
    colors: ["#b45309", "#fbbf24", "#fef3c7", "#f59e0b", "#b45309", "#fde68a", "#b45309"],
    sweep: true,
  },
  veteran: {
    colors: ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#d946ef", "#ef4444"],
    sweep: true,
    animated: true,
  },
};

const color = (value, fallback) =>
  typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;

/** Chuẩn hoá theme từ API; trả null nếu người dùng không có theme. */
export function normalizeTheme(theme) {
  if (!theme || typeof theme !== "object") return null;

  return {
    // null = không dùng màu giao diện (trang cá nhân giữ nguyên như cũ).
    primary_color: color(theme.primary_color, null),
    accent_color: color(theme.accent_color, null),
    banner_color: color(theme.banner_color, null),
    // Second colour of each of the three above (1500-point tier): when set,
    // that colour is drawn as a gradient. Null = solid.
    primary_color_2: color(theme.primary_color_2, null),
    accent_color_2: color(theme.accent_color_2, null),
    banner_color_2: color(theme.banner_color_2, null),
    name_font: theme.name_font || "default",
    name_effect: theme.name_effect || "none",
    name_colors: [
      color(theme.name_colors?.[0], DEFAULT_PRIMARY),
      color(theme.name_colors?.[1], DEFAULT_ACCENT),
    ],
    avatar_frame: theme.avatar_frame || "none",
    profile_effect: theme.profile_effect || "none",
    profile_frame: theme.profile_frame || "none",
    // Pro Max (2000 points). Older API responses have none of the three.
    // name_icon_emoji is the glyph of name_icon, sent by the API so the app
    // keeps no table of its own.
    name_icon: typeof theme.name_icon === "string" && theme.name_icon ? theme.name_icon : "none",
    name_icon_emoji:
      typeof theme.name_icon_emoji === "string" && theme.name_icon_emoji ? theme.name_icon_emoji : null,
    username_style: theme.username_style === "name" ? "name" : "default",
  };
}

/** Trộn một màu hex với đen/trắng: ratio > 0 làm sáng, < 0 làm tối. */
export function shade(hex, ratio) {
  const target = ratio > 0 ? 255 : 0;
  const amount = Math.abs(ratio);
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (
    "#" +
    channels
      .map((c) => Math.round(c + (target - c) * amount))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Thêm độ trong suốt (0-1) vào màu hex #rrggbb -> #rrggbbaa. */
export function withAlpha(hex, alpha) {
  const value = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return hex + value.toString(16).padStart(2, "0");
}

/** true nếu người dùng đã chọn màu giao diện (Profile Theme). */
export function hasThemeColors(theme) {
  const normalized = normalizeTheme(theme);
  return !!(normalized && (normalized.primary_color || normalized.accent_color));
}

/** [màu chính, màu phụ], lấy màu mặc định cho màu chưa chọn. */
export function themeColors(theme) {
  return [theme?.primary_color || DEFAULT_PRIMARY, theme?.accent_color || DEFAULT_ACCENT];
}

/**
 * Every colour stop of the theme gradient, in order: primary (+ its second
 * colour), accent (+ its second colour). Two stops without gradient colours.
 */
export function themeStops(theme) {
  const [primary, accent] = themeColors(theme);
  return [primary, theme?.primary_color_2, accent, theme?.accent_color_2].filter(Boolean);
}

/**
 * Nền ảnh bìa khi người dùng chưa có ảnh bìa: màu ảnh bìa (Banner Color) nếu
 * đã chọn, nếu không thì gradient màu giao diện, nếu không nữa thì null.
 * Trả { color } hoặc { colors } (cho LinearGradient).
 */
export function getBannerFill(theme) {
  const normalized = normalizeTheme(theme);
  if (!normalized) return null;
  if (normalized.banner_color && normalized.banner_color_2) {
    return { colors: [normalized.banner_color, normalized.banner_color_2] };
  }
  if (normalized.banner_color) return { color: normalized.banner_color };
  if (hasThemeColors(normalized)) return { colors: themeStops(normalized) };
  return null;
}

/**
 * Lớp phủ màu theme cho thẻ trang cá nhân (kiểu Profile Theme của Discord):
 * 2 màu bán trong suốt cho LinearGradient phủ lên nền sẵn có, hoặc null.
 */
export function getSurfaceColors(theme) {
  if (!hasThemeColors(theme)) return null;
  return themeStops(normalizeTheme(theme)).map((stop) => withAlpha(stop, 0.2));
}

/**
 * Hiệu ứng tên hiển thị (kiểu Display Name Styles của Discord). RN không có
 * background-clip:text hay text-stroke, nên:
 *   { style }            - làm được bằng style của <Text> (solid, pop, neon)
 *   { gradient: [a, b] } - StyledName vẽ chữ chuyển màu bằng SVG
 *   { toon: {...} }      - StyledName vẽ viền chữ bằng SVG
 *   { outline: {...} }   - StyledName vẽ viền chữ (màu tự chọn) bằng SVG
 * Trả null nếu không có hiệu ứng.
 */
// Same stops as the web's rainbow name effect.
const RAINBOW_COLORS = ["#ff4d4d", "#ff9f1a", "#ffe600", "#2ed573", "#1e90ff", "#a55eea"];

export function getNameEffect(theme, fontSize = 16) {
  const normalized = normalizeTheme(theme);
  if (!normalized) return null;

  const [first, second] = normalized.name_colors;

  switch (normalized.name_effect) {
    case "solid":
      return { style: { color: first } };
    case "gradient":
      return { style: { color: first }, gradient: [first, second] };
    case "rainbow":
      // Static here (the web animates it): the SVG text has no animation.
      return { style: { color: RAINBOW_COLORS[0] }, gradient: RAINBOW_COLORS };
    case "outline":
      // Text colour = first colour, border = second colour.
      return { style: { color: first }, outline: { fill: first, stroke: second } };
    case "neon":
      return {
        style: {
          color: shade(first, 0.55),
          textShadowColor: first,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: Math.max(6, fontSize * 0.45),
        },
      };
    case "toon": {
      const outline = shade(first, -0.6);
      return {
        style: {
          color: first,
          textShadowColor: outline,
          textShadowOffset: { width: 0, height: Math.max(1, fontSize * 0.09) },
          textShadowRadius: 0.01,
        },
        toon: { fill: first, outline },
      };
    }
    case "pop": {
      const offset = Math.max(1, fontSize * 0.07);
      return {
        style: {
          color: first,
          textShadowColor: shade(first, -0.45),
          textShadowOffset: { width: offset, height: offset },
          textShadowRadius: 0.01,
        },
      };
    }
    default:
      return null;
  }
}

/** Cấu hình khung avatar đã gắn màu, hoặc null nếu không có khung. */
export function getAvatarFrame(theme) {
  const normalized = normalizeTheme(theme);
  if (!normalized) return null;

  const frame = AVATAR_FRAMES[normalized.avatar_frame];
  if (!frame) return null;

  return {
    colors: frame.colors || themeColors(normalized),
    sweep: !!frame.sweep,
    animated: !!frame.animated,
  };
}

/**
 * The glyph shown right after the user's name (Pro Max), or null. Always the
 * API's `name_icon_emoji` - a key the app has no glyph for shows nothing.
 */
export function getNameIcon(theme) {
  const normalized = normalizeTheme(theme);
  if (!normalized || normalized.name_icon === "none") return null;
  return normalized.name_icon_emoji;
}

/** true when the @username is drawn with the name's font and effect. */
export function usernameFollowsName(theme) {
  return normalizeTheme(theme)?.username_style === "name";
}
