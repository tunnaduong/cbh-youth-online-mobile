import { Skia, ImageFormat } from "@shopify/react-native-skia";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Story colour filters.
 *
 * Each filter is a list of primitive colour operations. From that single
 * source we derive:
 *   - a 4x5 colour matrix, used to bake the filter into picked photos with
 *     Skia (React Native's own `filter` style prop is behind a feature flag on
 *     iOS, so it cannot be relied on for what the user actually sees);
 *   - a CSS `filter` string for the web viewer;
 *   - an optional tint overlay, which is the only thing that can be layered
 *     live over a playing video, both in the editor and in the viewer.
 *
 * Filters without a tint are hidden when the story is a video, so we never
 * promise a look we cannot deliver.
 */

const LUM_R = 0.213;
const LUM_G = 0.715;
const LUM_B = 0.072;

const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Multiply two 4x5 colour matrices (a applied after b). */
const multiply = (a, b) => {
  const out = new Array(20).fill(0);

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      let sum = 0;

      for (let k = 0; k < 4; k += 1) {
        sum += a[row * 5 + k] * b[k * 5 + col];
      }

      if (col === 4) {
        sum += a[row * 5 + 4];
      }

      out[row * 5 + col] = sum;
    }
  }

  return out;
};

const saturateMatrix = (s) => [
  LUM_R + (1 - LUM_R) * s, LUM_G - LUM_G * s, LUM_B - LUM_B * s, 0, 0,
  LUM_R - LUM_R * s, LUM_G + (1 - LUM_G) * s, LUM_B - LUM_B * s, 0, 0,
  LUM_R - LUM_R * s, LUM_G - LUM_G * s, LUM_B + (1 - LUM_B) * s, 0, 0,
  0, 0, 0, 1, 0,
];

const brightnessMatrix = (b) => [
  b, 0, 0, 0, 0,
  0, b, 0, 0, 0,
  0, 0, b, 0, 0,
  0, 0, 0, 1, 0,
];

const contrastMatrix = (c) => {
  const t = (1 - c) / 2;

  return [
    c, 0, 0, 0, t,
    0, c, 0, 0, t,
    0, 0, c, 0, t,
    0, 0, 0, 1, 0,
  ];
};

const sepiaMatrix = (amount) => {
  const a = Math.max(0, Math.min(1, amount));

  return [
    0.393 + 0.607 * (1 - a), 0.769 - 0.769 * (1 - a), 0.189 - 0.189 * (1 - a), 0, 0,
    0.349 - 0.349 * (1 - a), 0.686 + 0.314 * (1 - a), 0.168 - 0.168 * (1 - a), 0, 0,
    0.272 - 0.272 * (1 - a), 0.534 - 0.534 * (1 - a), 0.131 + 0.869 * (1 - a), 0, 0,
    0, 0, 0, 1, 0,
  ];
};

/** Additive colour shift, used for the warm/cool grades. */
const offsetMatrix = (r, g, b) => [
  1, 0, 0, 0, r,
  0, 1, 0, 0, g,
  0, 0, 1, 0, b,
  0, 0, 0, 1, 0,
];

const opMatrix = (op) => {
  switch (op.type) {
    case "saturate":
      return saturateMatrix(op.value);
    case "grayscale":
      return saturateMatrix(1 - op.value);
    case "brightness":
      return brightnessMatrix(op.value);
    case "contrast":
      return contrastMatrix(op.value);
    case "sepia":
      return sepiaMatrix(op.value);
    case "offset":
      return offsetMatrix(op.r || 0, op.g || 0, op.b || 0);
    default:
      return IDENTITY;
  }
};

const opCss = (op) => {
  switch (op.type) {
    case "saturate":
      return `saturate(${op.value})`;
    case "grayscale":
      return `grayscale(${op.value})`;
    case "brightness":
      return `brightness(${op.value})`;
    case "contrast":
      return `contrast(${op.value})`;
    case "sepia":
      return `sepia(${op.value})`;
    default:
      // `offset` has no CSS equivalent; the tint overlay covers it on the web.
      return null;
  }
};

const buildFilter = ({ id, labelKey, ops = [], tint = null }) => ({
  id,
  labelKey,
  ops,
  tint,
  matrix: ops.length ? ops.reduce((acc, op) => multiply(opMatrix(op), acc), IDENTITY) : null,
  css: ops.map(opCss).filter(Boolean).join(" ") || "none",
});

export const STORY_FILTERS = [
  buildFilter({ id: "none", labelKey: "story.filters.none" }),
  buildFilter({
    id: "vivid",
    labelKey: "story.filters.vivid",
    ops: [
      { type: "saturate", value: 1.45 },
      { type: "contrast", value: 1.12 },
    ],
  }),
  buildFilter({
    id: "mono",
    labelKey: "story.filters.mono",
    ops: [
      { type: "grayscale", value: 1 },
      { type: "contrast", value: 1.12 },
    ],
  }),
  buildFilter({
    id: "noir",
    labelKey: "story.filters.noir",
    ops: [
      { type: "grayscale", value: 1 },
      { type: "contrast", value: 1.45 },
      { type: "brightness", value: 0.92 },
    ],
  }),
  buildFilter({
    id: "warm",
    labelKey: "story.filters.warm",
    ops: [
      { type: "saturate", value: 1.15 },
      { type: "offset", r: 0.06, g: 0.02, b: -0.04 },
    ],
    tint: { colors: ["rgba(255,147,41,0.22)", "rgba(255,196,84,0.12)"] },
  }),
  buildFilter({
    id: "cool",
    labelKey: "story.filters.cool",
    ops: [
      { type: "saturate", value: 1.1 },
      { type: "offset", r: -0.04, g: 0, b: 0.08 },
    ],
    tint: { colors: ["rgba(41,121,255,0.2)", "rgba(0,212,255,0.12)"] },
  }),
  buildFilter({
    id: "fade",
    labelKey: "story.filters.fade",
    ops: [
      { type: "saturate", value: 0.78 },
      { type: "contrast", value: 0.88 },
      { type: "brightness", value: 1.06 },
    ],
    tint: { colors: ["rgba(255,255,255,0.16)", "rgba(255,244,230,0.12)"] },
  }),
  buildFilter({
    id: "retro",
    labelKey: "story.filters.retro",
    ops: [
      { type: "sepia", value: 0.4 },
      { type: "contrast", value: 1.08 },
      { type: "saturate", value: 1.1 },
    ],
    tint: { colors: ["rgba(173,116,60,0.22)", "rgba(255,214,148,0.14)"] },
  }),
  buildFilter({
    id: "dusk",
    labelKey: "story.filters.dusk",
    ops: [
      { type: "saturate", value: 1.2 },
      { type: "brightness", value: 0.95 },
      { type: "offset", r: 0.05, g: -0.01, b: 0.06 },
    ],
    tint: { colors: ["rgba(255,88,132,0.2)", "rgba(88,60,180,0.24)"] },
  }),
];

export const getStoryFilter = (id) =>
  STORY_FILTERS.find((filter) => filter.id === id) || STORY_FILTERS[0];

/** Filters that can be shown over a playing video (tint-only approximation). */
export const VIDEO_STORY_FILTERS = STORY_FILTERS.filter(
  (filter) => filter.id === "none" || filter.tint
);

const MAX_BAKE_EDGE = 1600;

/**
 * Burn a filter into a photo with an offscreen Skia surface and return the new
 * file's uri. Baking beats snapshotting a filtered view: react-native-view-shot
 * has no say in how GPU-composited effects are flattened, so this keeps what
 * gets uploaded identical to what the editor showed.
 *
 * Returns the original uri when there is nothing to do, or when Skia fails -
 * an unfiltered story is a much better outcome than a failed post.
 */
export const bakeFilterIntoImage = async (uri, filterId) => {
  const filter = getStoryFilter(filterId);

  if (!uri || !filter?.matrix) return uri;

  try {
    const data = await Skia.Data.fromURI(uri);
    const image = Skia.Image.MakeImageFromEncoded(data);

    if (!image) return uri;

    const sourceWidth = image.width();
    const sourceHeight = image.height();
    const scale = Math.min(1, MAX_BAKE_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const surface = Skia.Surface.MakeOffscreen(width, height);

    if (!surface) return uri;

    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(filter.matrix));

    canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, sourceWidth, sourceHeight),
      Skia.XYWHRect(0, 0, width, height),
      paint
    );

    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);

    if (!base64) return uri;

    const target = `${FileSystem.cacheDirectory}story-filter-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(target, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return target;
  } catch (error) {
    console.warn("Failed to bake story filter:", error?.message || error);
    return uri;
  }
};
