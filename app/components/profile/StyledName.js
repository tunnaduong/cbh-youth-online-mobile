import React from "react";
import { StyleSheet, Text, UIManager, View } from "react-native";
import * as Application from "expo-application";
import { LinearGradient } from "expo-linear-gradient";
import { getNameEffect, normalizeTheme } from "../../utils/profileTheme";
import { useNameFont } from "../../utils/nameFonts";

// A real gradient across the name needs the text as a mask over a gradient:
// `@react-native-masked-view/masked-view`. Optional on purpose - JavaScript
// can reach a binary built before the package was added (an update over the
// air), where using its view would show nothing. Builds are numbered by the
// CI run (see INFO.md), and FIRST_BUILD_WITH_MASKED_VIEW is the first one
// that contains it; without it names fall back to one colour per letter.
const FIRST_BUILD_WITH_MASKED_VIEW = 908;
let MaskedView = null;
try {
  MaskedView = require("@react-native-masked-view/masked-view").default;
} catch {
  MaskedView = null;
}
const maskedViewAvailable = () => {
  if (!MaskedView) return false;
  try {
    if (UIManager.hasViewManagerConfig?.("RNCMaskedView")) return true;
  } catch {}
  return Number(Application.nativeBuildVersion) >= FIRST_BUILD_WITH_MASKED_VIEW;
};

// Emoji keep their own colours, which a mask would flatten into the gradient.
const HAS_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * Tên hiển thị theo kiểu tên (phông + hiệu ứng) trong theme của người dùng.
 * Không có theme thì là một <Text> bình thường.
 *
 * Props:
 *   theme   - `theme`/`profile_theme` của người dùng từ API, hoặc null
 *   variant - "full": phông + hiệu ứng (trang cá nhân, xem trước)
 *             "compact": phông + hiệu ứng ở dạng một <Text> duy nhất (bài
 *             viết, bình luận, danh sách, chat) - chuyển màu theo từng chữ,
 *             viền chữ/hoạt hình dùng màu + bóng chữ.
 *   style, numberOfLines, ...rest - như <Text>
 *
 * "compact" luôn là một <Text>, lồng được trong <Text> khác. "full" với hiệu
 * ứng viền chữ/hoạt hình là một <View> (nhiều lớp chữ chồng lên nhau) - đặt
 * nó đứng riêng, không lồng trong <Text>.
 *
 * Every effect is drawn with plain <Text> only. An earlier version painted
 * gradients and outlines with react-native-svg text, which draws any glyph it
 * can't turn into a path (some letters with diacritics depending on the font,
 * every emoji) in plain black - so part of a name, typically its second
 * word, came out black. Text never has that problem, wraps and aligns like
 * any other name, and shows emoji as emoji.
 */
const StyledName = ({ theme, variant = "full", style, numberOfLines, children, ...rest }) => {
  const normalized = normalizeTheme(theme);
  const font = useNameFont(normalized?.name_font);

  if (!normalized) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {children}
      </Text>
    );
  }

  const flat = StyleSheet.flatten(style) || {};
  const fontSize = flat.fontSize || 14;
  // Custom fonts already carry their weight; asking iOS for a bold variant of
  // a single-weight family makes it fall back to the system font.
  const fontStyle = font
    ? {
        fontFamily: font.family,
        fontWeight: "normal",
        fontSize: fontSize * font.scale,
        ...(flat.lineHeight ? { lineHeight: flat.lineHeight * font.scale } : null),
        ...(font.letterSpacing ? { letterSpacing: font.letterSpacing } : null),
      }
    : null;
  // Both variants show the effect. "compact" (posts, comments, lists) only
  // uses the forms that are a single <Text>, so it can still sit inside
  // another <Text>; "full" may use the layered forms below.
  const effect = getNameEffect(normalized, fontSize);
  const full = variant === "full";
  const textStyle = [style, fontStyle, effect?.style];
  const name = nameText(children);

  // A gradient across the whole name (full variant, when the build has the
  // masked view and the name has no emoji)...
  if (effect?.gradient && name !== null && full && !HAS_EMOJI.test(name) && maskedViewAvailable()) {
    return (
      <MaskedGradientName
        textStyle={textStyle}
        stops={gradientStops(effect.gradient)}
        numberOfLines={numberOfLines}
        {...rest}
      >
        {name}
      </MaskedGradientName>
    );
  }

  // ...otherwise letter by letter: each one gets its colour along the
  // gradient. (Only for a plain string - anything else keeps the effect's
  // single fallback colour.)
  if (effect?.gradient && name !== null) {
    return (
      <Text style={textStyle} numberOfLines={numberOfLines} {...rest}>
        {gradientSpans(name, effect.gradient)}
      </Text>
    );
  }

  if ((effect?.outline || effect?.toon) && name !== null && full) {
    return (
      <LayeredName
        textStyle={textStyle}
        fontSize={fontSize * (font?.scale || 1)}
        fill={effect.outline ? effect.outline.fill : effect.toon.fill}
        stroke={effect.outline ? effect.outline.stroke : effect.toon.outline}
        // "toon" sits on a hard drop shadow in the outline colour.
        drop={effect.toon ? fontSize * 0.09 : 0}
        numberOfLines={numberOfLines}
        {...rest}
      >
        {name}
      </LayeredName>
    );
  }

  return (
    <Text style={textStyle} numberOfLines={numberOfLines} {...rest}>
      {children}
    </Text>
  );
};

/** The name as one string, or null when the children are something else. */
function nameText(children) {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children) && children.every((c) => typeof c === "string" || typeof c === "number")) {
    return children.join("");
  }
  return null;
}

// Code points that belong to the letter before them: combining marks (a
// Vietnamese name typed as base letter + accents), variation selectors,
// emoji skin tones.
const isCombining = (cp) =>
  (cp >= 0x0300 && cp <= 0x036f) ||
  (cp >= 0x1ab0 && cp <= 0x1aff) ||
  (cp >= 0x1dc0 && cp <= 0x1dff) ||
  (cp >= 0x20d0 && cp <= 0x20ff) ||
  (cp >= 0xfe00 && cp <= 0xfe0f) ||
  (cp >= 0xfe20 && cp <= 0xfe2f) ||
  (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
  cp === 0x20e3;
const ZWJ = 0x200d;
const isRegionalIndicator = (cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

/**
 * Split into what a reader sees as one character each, so a colour change
 * never lands between a letter and its accent or inside an emoji.
 */
export function splitGraphemes(text) {
  const clusters = [];
  let joinNext = false;

  for (const char of Array.from(text)) {
    const cp = char.codePointAt(0);
    const last = clusters.length - 1;
    const previous = last >= 0 ? clusters[last] : null;
    // A flag is two regional indicators.
    const completesFlag =
      previous !== null &&
      isRegionalIndicator(cp) &&
      Array.from(previous).length === 1 &&
      isRegionalIndicator(previous.codePointAt(0));

    if (previous !== null && (joinNext || isCombining(cp) || cp === ZWJ || completesFlag)) {
      clusters[last] = previous + char;
    } else {
      clusters.push(char);
    }
    joinNext = cp === ZWJ;
  }

  return clusters;
}

const channelsOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The colour at `position` (0..1) along a list of evenly spaced stops. */
export function colorAlong(stops, position) {
  if (stops.length === 1) return stops[0];
  const scaled = Math.min(Math.max(position, 0), 1) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const ratio = scaled - index;
  const from = channelsOf(stops[index]);
  const to = channelsOf(stops[index + 1]);
  return (
    "#" +
    from
      .map((c, i) => Math.round(c + (to[i] - c) * ratio))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Two colours fade a -> b -> a (as the web's moving gradient does); a longer
// list (rainbow) is spread evenly across the name.
const gradientStops = (gradient) =>
  gradient.length === 2 ? [gradient[0], gradient[1], gradient[0]] : gradient;

/**
 * The name as a mask over a left-to-right gradient: every colour of the
 * gradient shows however short the name is. The hidden copy inside gives
 * the gradient the name's own size, so the mask (laid out in that same box)
 * wraps and truncates identically.
 */
function MaskedGradientName({ textStyle, stops, numberOfLines, children, ...rest }) {
  return (
    <MaskedView
      style={styles.layered}
      maskElement={
        <Text
          style={[textStyle, { color: "#000", textShadowColor: "transparent" }]}
          numberOfLines={numberOfLines}
        >
          {children}
        </Text>
      }
      {...rest}
    >
      <LinearGradient colors={stops} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}>
        <Text style={[textStyle, { opacity: 0 }]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

function gradientSpans(name, gradient) {
  const stops = gradientStops(gradient);
  const clusters = splitGraphemes(name);
  // Spaces take no step of the gradient, so short words still show its range.
  const inked = clusters.filter((cluster) => cluster.trim() !== "").length;
  let step = 0;

  return clusters.map((cluster, index) => {
    if (cluster.trim() === "") return cluster;
    const color = colorAlong(stops, inked > 1 ? step / (inked - 1) : 0);
    step += 1;
    return (
      <Text key={index} style={{ color }}>
        {cluster}
      </Text>
    );
  });
}

// Directions the outline copies are shifted in: a ring around the text.
const RING = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];

/**
 * A name with a border (and optionally a hard drop shadow): the same text
 * stacked - copies in the border colour shifted in a ring, the fill on top.
 * The copies are positioned over the visible text's own box, so they wrap
 * and truncate exactly like it.
 */
function LayeredName({ textStyle, fontSize, fill, stroke, drop, numberOfLines, children, ...rest }) {
  const width = Math.max(1, fontSize * 0.06);
  const copy = (dx, dy, key) => (
    <Text
      key={key}
      // Decoration only: screen readers read the top layer once.
      accessible={false}
      importantForAccessibility="no"
      style={[
        textStyle,
        styles.layer,
        { color: stroke, textShadowColor: "transparent", left: dx, right: -dx, top: dy },
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );

  return (
    <View style={styles.layered} {...rest}>
      {drop > 0 && RING.map(([x, y], index) => copy(x * width, y * width + drop, `drop-${index}`))}
      {RING.map(([x, y], index) => copy(x * width, y * width, `ring-${index}`))}
      <Text
        style={[textStyle, { color: fill, textShadowColor: "transparent" }]}
        numberOfLines={numberOfLines}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Lets a long name shrink inside a row instead of pushing past it.
  layered: { flexShrink: 1, maxWidth: "100%" },
  layer: { position: "absolute" },
});

export default StyledName;
