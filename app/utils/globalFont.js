import { useContext, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import * as Font from "expo-font";

const TextModule = require("react-native/Libraries/Text/Text");
const TextAncestorContext = require("react-native/Libraries/Text/TextAncestorContext").default;
const TextInputModule = require("react-native/Libraries/Components/TextInput/TextInput");

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

const INTER_FONT_ENTRIES = Object.entries(INTER_FONT_SOURCES);
const INTER_FAMILIES = new Set(Object.keys(INTER_FONT_SOURCES));

const DEFAULT_SYSTEM_FAMILIES = new Set([
  "",
  "Inter",
  "System",
  "system-ui",
  "ui-sans-serif",
  "-apple-system",
  "sans-serif",
  "sans-serif-regular",
  "sans-serif-medium",
  "sans-serif-light",
  "sans-serif-thin",
  "Roboto",
]);

function isSystemFontFamily(fontFamily) {
  if (!fontFamily) return true;
  if (DEFAULT_SYSTEM_FAMILIES.has(fontFamily)) return true;
  if (
    typeof fontFamily === "string" &&
    (fontFamily.startsWith("Roboto,") || fontFamily.startsWith("system-ui,"))
  ) {
    return true;
  }
  return false;
}

export function normalizeFontWeight(weight, fontFamily) {
  if (weight == null) {
    if (fontFamily === "sans-serif-medium") return "500";
    if (fontFamily === "sans-serif-light" || fontFamily === "sans-serif-thin") return "300";
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
  switch (weight) {
    case "300":
      return italic ? "Inter_300Light_Italic" : "Inter_300Light";
    case "500":
      return italic ? "Inter_500Medium_Italic" : "Inter_500Medium";
    case "600":
      return italic ? "Inter_600SemiBold_Italic" : "Inter_600SemiBold";
    case "700":
      return italic ? "Inter_700Bold_Italic" : "Inter_700Bold";
    case "800":
      return italic ? "Inter_800ExtraBold_Italic" : "Inter_800ExtraBold";
    case "900":
      return italic ? "Inter_900Black_Italic" : "Inter_900Black";
    case "400":
    default:
      return italic ? "Inter_400Regular_Italic" : "Inter_400Regular";
  }
}

// Pre-allocated style overrides so rendering allocates no extra objects on the hot path.
// Custom fonts registered via expo-font carry their own weight/italic in the TTF file;
// resetting fontWeight and fontStyle to "normal" prevents iOS and Android from falling
// back to the system font or synthesizing fake bold/italic.
const OVERRIDE_STYLES = {};
for (const family of INTER_FAMILIES) {
  OVERRIDE_STYLES[family] = Object.freeze({
    fontFamily: family,
    fontWeight: "normal",
    fontStyle: "normal",
  });
}

let interLoaded = false;
let loadPromise = null;
const listeners = new Set();

export function loadGlobalFonts() {
  if (interLoaded) return Promise.resolve(true);
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        for (let i = 0; i < INTER_FONT_ENTRIES.length; i++) {
          const [family, source] = INTER_FONT_ENTRIES[i];
          await Font.loadAsync({ [family]: source });
        }
        interLoaded = true;
        listeners.forEach((listener) => {
          try {
            listener(true);
          } catch {}
        });
        return true;
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
  const [loaded, setLoaded] = useState(interLoaded);

  useEffect(() => {
    if (interLoaded) {
      if (!loaded) setLoaded(true);
      return undefined;
    }
    listeners.add(setLoaded);
    loadGlobalFonts();
    return () => listeners.delete(setLoaded);
  }, [loaded]);

  return loaded;
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

    const hasOwnWeight =
      flat?.fontWeight != null ||
      explicitFamily === "sans-serif-medium" ||
      explicitFamily === "sans-serif-light" ||
      explicitFamily === "sans-serif-thin";
    const hasOwnStyle = flat?.fontStyle != null;

    // Nested <Text> without its own font family/weight/style inherits the parent <Text>'s
    // font attributes natively on both iOS (CoreText) and Android (Spannable).
    if (hasTextAncestor && !explicitFamily && !hasOwnWeight && !hasOwnStyle) {
      return style;
    }

    const weight = normalizeFontWeight(flat?.fontWeight, explicitFamily);
    const italic = flat?.fontStyle === "italic";
    const interFamily = getInterFontFamily(weight, italic);
    const override = OVERRIDE_STYLES[interFamily];
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
    const italic = flat?.fontStyle === "italic";
    const interFamily = getInterFontFamily(weight, italic);
    const override = OVERRIDE_STYLES[interFamily];
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
    const OriginalText = TextModule?.default;
    if (typeof OriginalText === "function") {
      const InterText = (props) => {
        const hasTextAncestor = useContext(TextAncestorContext);
        if (!interLoaded || !props) {
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

    const OriginalTextInput = TextInputModule?.default;
    if (typeof OriginalTextInput === "function") {
      const InterTextInput = (props) => {
        if (!interLoaded || !props) {
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
