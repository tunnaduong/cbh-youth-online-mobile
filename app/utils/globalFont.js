import { useContext, useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { Asset } from "expo-asset";
import * as Font from "expo-font";
import { requireOptionalNativeModule } from "expo-modules-core";
import { applyOtaLocalAssetsFix } from "../services/ota/patchLocalAssets";

const TextModule = require("react-native/Libraries/Text/Text");
const TextAncestorContext = require("react-native/Libraries/Text/TextAncestorContext").default;

export const INTER_FONT_SOURCES = {
  Inter_400Regular: require("../assets/fonts/inter/Inter_400Regular.ttf"),
  Inter_500Medium: require("../assets/fonts/inter/Inter_500Medium.ttf"),
  Inter_600SemiBold: require("../assets/fonts/inter/Inter_600SemiBold.ttf"),
  Inter_700Bold: require("../assets/fonts/inter/Inter_700Bold.ttf"),
  Inter_300Light: require("../assets/fonts/inter/Inter_300Light.ttf"),
  Inter_800ExtraBold: require("../assets/fonts/inter/Inter_800ExtraBold.ttf"),
  Inter_900Black: require("../assets/fonts/inter/Inter_900Black.ttf"),
  Inter_400Regular_Italic: require("../assets/fonts/inter/Inter_400Regular_Italic.ttf"),
  Inter_500Medium_Italic: require("../assets/fonts/inter/Inter_500Medium_Italic.ttf"),
  Inter_600SemiBold_Italic: require("../assets/fonts/inter/Inter_600SemiBold_Italic.ttf"),
  Inter_700Bold_Italic: require("../assets/fonts/inter/Inter_700Bold_Italic.ttf"),
  Inter_300Light_Italic: require("../assets/fonts/inter/Inter_300Light_Italic.ttf"),
  Inter_800ExtraBold_Italic: require("../assets/fonts/inter/Inter_800ExtraBold_Italic.ttf"),
  Inter_900Black_Italic: require("../assets/fonts/inter/Inter_900Black_Italic.ttf"),
};

const CORE_INTER_FAMILIES = [
  "Inter_400Regular",
  "Inter_500Medium",
  "Inter_600SemiBold",
  "Inter_700Bold",
];

const EXTRA_INTER_FAMILIES = Object.keys(INTER_FONT_SOURCES).filter(
  (family) => !CORE_INTER_FAMILIES.includes(family)
);

const INTER_FAMILIES = new Set(Object.keys(INTER_FONT_SOURCES));
const loadedInterFamilies = new Set();

const DEFAULT_SYSTEM_FAMILIES_LOWER = new Set([
  "",
  "inter",
  "system",
  "systemcondensed",
  "system-ui",
  "ui-sans-serif",
  "-apple-system",
  "blinkmacsystemfont",
  "sans-serif",
  "sans-serif-regular",
  "sans-serif-medium",
  "sans-serif-light",
  "sans-serif-thin",
  "sans-serif-condensed",
  "roboto",
  "helvetica",
  "helvetica neue",
  "arial",
  "san francisco",
  ".sf ui text",
  ".sf ui display",
  ".appleSystemUIFont",
  ".applesystemuifont",
  "segoe ui",
]);

function isSystemFontFamily(fontFamily) {
  if (!fontFamily) return true;
  if (typeof fontFamily !== "string") return false;
  const trimmed = fontFamily.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (DEFAULT_SYSTEM_FAMILIES_LOWER.has(lower)) return true;
  const primary = lower.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  if (primary && DEFAULT_SYSTEM_FAMILIES_LOWER.has(primary)) return true;
  return false;
}

export function normalizeFontWeight(weight, fontFamily) {
  if (weight == null) {
    if (typeof fontFamily === "string") {
      const lower = fontFamily.toLowerCase();
      if (lower === "sans-serif-medium") return "500";
      if (lower === "sans-serif-light" || lower === "sans-serif-thin") return "300";
    }
    return "400";
  }
  const w = String(weight).trim().toLowerCase();
  switch (w) {
    case "100":
    case "200":
    case "300":
    case "thin":
    case "extralight":
    case "ultralight":
    case "light":
      return "300";
    case "400":
    case "normal":
    case "regular":
      return "400";
    case "500":
    case "medium":
      return "500";
    case "600":
    case "semibold":
    case "demibold":
      return "600";
    case "700":
    case "bold":
      return "700";
    case "800":
    case "extrabold":
    case "ultrabold":
    case "heavy":
      return "800";
    case "900":
    case "black":
      return "900";
    default:
      return "400";
  }
}

export function getInterFontFamily(weight = "400", italic = false) {
  let target;
  switch (weight) {
    case "300":
      target = italic ? "Inter_300Light_Italic" : "Inter_300Light";
      break;
    case "500":
      target = italic ? "Inter_500Medium_Italic" : "Inter_500Medium";
      break;
    case "600":
      target = italic ? "Inter_600SemiBold_Italic" : "Inter_600SemiBold";
      break;
    case "700":
      target = italic ? "Inter_700Bold_Italic" : "Inter_700Bold";
      break;
    case "800":
      target = italic ? "Inter_800ExtraBold_Italic" : "Inter_800ExtraBold";
      break;
    case "900":
      target = italic ? "Inter_900Black_Italic" : "Inter_900Black";
      break;
    case "400":
    default:
      target = italic ? "Inter_400Regular_Italic" : "Inter_400Regular";
      break;
  }

  if (loadedInterFamilies.size === 0 || loadedInterFamilies.has(target)) {
    return target;
  }

  // If an italic or extra weight is still loading, fall back to the closest loaded core weight
  if (italic) {
    const nonItalic = getInterFontFamily(weight, false);
    if (loadedInterFamilies.has(nonItalic)) return nonItalic;
  }
  if ((weight === "800" || weight === "900") && loadedInterFamilies.has("Inter_700Bold")) {
    return "Inter_700Bold";
  }
  if (loadedInterFamilies.has("Inter_400Regular")) {
    return "Inter_400Regular";
  }
  return loadedInterFamilies.values().next().value || target;
}

// Pre-allocated style overrides so rendering allocates no extra objects on the hot path.
// On iOS (Fabric RCTFontUtils.mm), matching an italic TTF requires fontStyle: "italic"
// because RCTFontUtils skips any font where RCTGetFontStyle(fontMatch) != fontProperties.style.
// On Android, setting fontStyle: "normal" prevents fake double-oblique skewing on italic TTFs.
const OVERRIDE_STYLES = {};
for (const family of INTER_FAMILIES) {
  const isItalicFamily = family.endsWith("_Italic");
  OVERRIDE_STYLES[family] = Object.freeze({
    fontFamily: family,
    fontWeight: "normal",
    fontStyle: isItalicFamily && Platform.OS === "ios" ? "italic" : "normal",
  });
}

let interLoaded = false;
let fontLoadVersion = 0;
let loadPromise = null;
const listeners = new Set();

function notifyListeners() {
  fontLoadVersion += 1;
  const currentVersion = fontLoadVersion;
  listeners.forEach((listener) => {
    try {
      listener(currentVersion);
    } catch {}
  });
}

function getOtaAssetUrlMap() {
  const map = {};
  try {
    const ExpoUpdates = requireOptionalNativeModule("ExpoUpdates");
    if (!ExpoUpdates) return map;
    let manifest = ExpoUpdates.manifest;
    if (!manifest && ExpoUpdates.manifestString) {
      try {
        manifest = JSON.parse(ExpoUpdates.manifestString);
      } catch {}
    }
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    const localAssets = ExpoUpdates.localAssets || {};
    for (const item of assets) {
      if (!item?.url) continue;
      const cleanUrl = String(item.url).split("?")[0].split("#")[0];
      const md5 = cleanUrl.split("/").pop();
      if (md5) {
        map[md5] = {
          remoteUrl: item.url,
          localUri: (item.key && localAssets[item.key]) || localAssets[md5] || null,
        };
      }
    }
  } catch {}
  return map;
}

async function loadSingleInterFont(family, source, otaAssetMap) {
  try {
    if (Font.isLoaded(family)) {
      loadedInterFamilies.add(family);
      return true;
    }

    let fontResource = source;
    try {
      const asset = Asset.fromModule(source);
      if (asset) {
        const hash = asset.hash;
        const otaEntry = hash ? otaAssetMap[hash] : null;
        if (!asset.localUri && otaEntry?.localUri) {
          asset.localUri = otaEntry.localUri;
          asset.downloaded = true;
        }
        if (!asset.localUri && !asset.uri && otaEntry?.remoteUrl) {
          asset.uri = otaEntry.remoteUrl;
        }
        fontResource = asset;
      }
    } catch {}

    await Font.loadAsync({ [family]: fontResource });
    loadedInterFamilies.add(family);
    return true;
  } catch (err) {
    if (__DEV__) {
      console.warn(`[globalFont] Failed to load ${family}:`, err?.message || err);
    }
    return false;
  }
}

export function loadGlobalFonts() {
  if (interLoaded && loadedInterFamilies.size === INTER_FAMILIES.size) {
    return Promise.resolve(true);
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        applyOtaLocalAssetsFix();
        const otaAssetMap = getOtaAssetUrlMap();

        // 1. Load the 4 core weights first in parallel so UI updates immediately
        await Promise.allSettled(
          CORE_INTER_FAMILIES.map((family) =>
            loadSingleInterFont(family, INTER_FONT_SOURCES[family], otaAssetMap)
          )
        );

        if (loadedInterFamilies.size > 0) {
          interLoaded = true;
          notifyListeners();
        }

        // 2. Load remaining weights and italic variants in parallel
        await Promise.allSettled(
          EXTRA_INTER_FAMILIES.map((family) =>
            loadSingleInterFont(family, INTER_FONT_SOURCES[family], otaAssetMap)
          )
        );

        if (loadedInterFamilies.size > 0) {
          interLoaded = true;
          notifyListeners();
          return true;
        }

        loadPromise = null;
        return false;
      } catch (error) {
        if (__DEV__) {
          console.warn("[globalFont] Failed to load Inter fonts:", error?.message || error);
        }
        loadPromise = null;
        return false;
      }
    })();
  }
  return loadPromise;
}

export function useGlobalFontsLoaded() {
  const [version, setVersion] = useState(fontLoadVersion);

  useEffect(() => {
    if (fontLoadVersion !== version) {
      setVersion(fontLoadVersion);
    }
    if (interLoaded && loadedInterFamilies.size === INTER_FAMILIES.size) {
      return undefined;
    }
    listeners.add(setVersion);
    loadGlobalFonts();
    return () => listeners.delete(setVersion);
  }, [version]);

  return interLoaded || version > 0;
}

function resolveInterTextStyle(style, hasTextAncestor) {
  try {
    const flat = style != null ? StyleSheet.flatten(style) : null;
    const explicitFamily = flat?.fontFamily;

    // Already an explicit Inter variant (e.g. Inter_600SemiBold)
    if (explicitFamily && INTER_FAMILIES.has(explicitFamily)) {
      return [style, OVERRIDE_STYLES[explicitFamily]];
    }

    // Explicit non-system font (vector icons, StyledName custom fonts, monospace, story fonts)
    if (explicitFamily && !isSystemFontFamily(explicitFamily)) {
      return style;
    }

    const lowerFamily = typeof explicitFamily === "string" ? explicitFamily.toLowerCase() : "";
    const hasOwnWeight =
      flat?.fontWeight != null ||
      lowerFamily === "sans-serif-medium" ||
      lowerFamily === "sans-serif-light" ||
      lowerFamily === "sans-serif-thin";
    const hasOwnStyle = flat?.fontStyle != null;

    // Nested <Text> without its own font family/weight/style inherits the parent <Text>'s
    // font attributes natively on both iOS (CoreText) and Android (Spannable).
    if (hasTextAncestor && !explicitFamily && !hasOwnWeight && !hasOwnStyle) {
      return style;
    }

    const weight = normalizeFontWeight(flat?.fontWeight, explicitFamily);
    const italic = flat?.fontStyle === "italic" || flat?.fontStyle === "oblique";
    const interFamily = getInterFontFamily(weight, italic);
    const override = OVERRIDE_STYLES[interFamily];
    if (!override) return style;
    return style != null ? [style, override] : override;
  } catch {
    return style;
  }
}

function resolveInterTextInputStyle(style) {
  try {
    const flat = style != null ? StyleSheet.flatten(style) : null;
    const explicitFamily = flat?.fontFamily;

    if (explicitFamily && INTER_FAMILIES.has(explicitFamily)) {
      return [style, OVERRIDE_STYLES[explicitFamily]];
    }

    if (explicitFamily && !isSystemFontFamily(explicitFamily)) {
      return style;
    }

    const weight = normalizeFontWeight(flat?.fontWeight, explicitFamily);
    const italic = flat?.fontStyle === "italic" || flat?.fontStyle === "oblique";
    const interFamily = getInterFontFamily(weight, italic);
    const override = OVERRIDE_STYLES[interFamily];
    if (!override) return style;
    return style != null ? [style, override] : override;
  } catch {
    return style;
  }
}

let patched = false;

export function applyGlobalInterFont() {
  if (patched) return;
  patched = true;

  try {
    // 1. Patch Text BEFORE requiring TextInput so TextInput's internal Text import
    // also receives the patched InterText component.
    const OriginalText = TextModule?.default;
    if (typeof OriginalText === "function") {
      const InterText = (props) => {
        const hasTextAncestor = useContext(TextAncestorContext);
        const fontsReady = useGlobalFontsLoaded();
        if (!fontsReady || !props) {
          return OriginalText(props);
        }
        const resolvedStyle = resolveInterTextStyle(props.style, hasTextAncestor);
        if (resolvedStyle === props.style) {
          return OriginalText(props);
        }
        return OriginalText({ ...props, style: resolvedStyle });
      };

      Object.assign(InterText, OriginalText);
      InterText.displayName = "Text";
      TextModule.default = InterText;
    }

    // 2. Now require and patch TextInput
    const TextInputModule = require("react-native/Libraries/Components/TextInput/TextInput");
    const OriginalTextInput = TextInputModule?.default;
    if (typeof OriginalTextInput === "function") {
      const InterTextInput = (props) => {
        const fontsReady = useGlobalFontsLoaded();
        if (!fontsReady || !props) {
          return OriginalTextInput(props);
        }
        const resolvedStyle = resolveInterTextInputStyle(props.style);
        if (resolvedStyle === props.style) {
          return OriginalTextInput(props);
        }
        return OriginalTextInput({ ...props, style: resolvedStyle });
      };

      Object.assign(InterTextInput, OriginalTextInput);
      InterTextInput.displayName = "TextInput";
      TextInputModule.default = InterTextInput;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[globalFont] Failed to patch Text/TextInput:", error?.message || error);
    }
  }
}

applyGlobalInterFont();
