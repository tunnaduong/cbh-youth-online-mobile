import React, { createContext, useContext, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import * as Font from "expo-font";

const TextModule = require("react-native/Libraries/Text/Text");
const TextAncestorContext = require("react-native/Libraries/Text/TextAncestorContext").default;
const TextInputModule = require("react-native/Libraries/Components/TextInput/TextInput");

export const INTER_FONT_SOURCES = {
  Inter_300Light: require("../assets/fonts/inter/Inter_300Light.ttf"),
  Inter_300Light_Italic: require("../assets/fonts/inter/Inter_300Light_Italic.ttf"),
  Inter_400Regular: require("../assets/fonts/inter/Inter_400Regular.ttf"),
  Inter_400Regular_Italic: require("../assets/fonts/inter/Inter_400Regular_Italic.ttf"),
  Inter_500Medium: require("../assets/fonts/inter/Inter_500Medium.ttf"),
  Inter_500Medium_Italic: require("../assets/fonts/inter/Inter_500Medium_Italic.ttf"),
  Inter_600SemiBold: require("../assets/fonts/inter/Inter_600SemiBold.ttf"),
  Inter_600SemiBold_Italic: require("../assets/fonts/inter/Inter_600SemiBold_Italic.ttf"),
  Inter_700Bold: require("../assets/fonts/inter/Inter_700Bold.ttf"),
  Inter_700Bold_Italic: require("../assets/fonts/inter/Inter_700Bold_Italic.ttf"),
  Inter_800ExtraBold: require("../assets/fonts/inter/Inter_800ExtraBold.ttf"),
  Inter_800ExtraBold_Italic: require("../assets/fonts/inter/Inter_800ExtraBold_Italic.ttf"),
  Inter_900Black: require("../assets/fonts/inter/Inter_900Black.ttf"),
  Inter_900Black_Italic: require("../assets/fonts/inter/Inter_900Black_Italic.ttf"),
};

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
  if (typeof fontFamily === "string" && (fontFamily.startsWith("Roboto,") || fontFamily.startsWith("system-ui,"))) {
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

// Pre-allocated style overrides and context states so rendering allocates no
// extra objects on the hot path.
// Custom fonts registered via expo-font on Android are stored under
// Typeface.NORMAL, so fontWeight/fontStyle must be reset to "normal" to
// prevent Android from falling back to Roboto or synthesizing fake bold.
const OVERRIDE_STYLES = {};
for (const family of INTER_FAMILIES) {
  OVERRIDE_STYLES[family] = Object.freeze({
    fontFamily: family,
    fontWeight: "normal",
    fontStyle: "normal",
  });
}

const DEFAULT_FONT_STATE = Object.freeze({ customFont: false, weight: "400", italic: false });
const CUSTOM_FONT_STATE = Object.freeze({ customFont: true, weight: "400", italic: false });
const FONT_STATES = {};
for (const weight of ["300", "400", "500", "600", "700", "800", "900"]) {
  FONT_STATES[`${weight}_normal`] = Object.freeze({ customFont: false, weight, italic: false });
  FONT_STATES[`${weight}_italic`] = Object.freeze({ customFont: false, weight, italic: true });
}

const ParentFontStateContext = createContext(DEFAULT_FONT_STATE);

let interLoaded = false;
let loadPromise = null;
const listeners = new Set();

function checkInterLoaded() {
  if (interLoaded) return true;
  try {
    if (Font.isLoaded("Inter_400Regular")) {
      interLoaded = true;
      return true;
    }
  } catch {}
  return false;
}

export function loadGlobalFonts() {
  if (checkInterLoaded()) return Promise.resolve(true);
  if (!loadPromise) {
    loadPromise = Font.loadAsync(INTER_FONT_SOURCES)
      .then(() => {
        interLoaded = true;
        listeners.forEach((listener) => listener(true));
        return true;
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn("[globalFont] Failed to load Inter fonts:", error?.message || error);
        }
        loadPromise = null;
        return false;
      });
  }
  return loadPromise;
}

export function useGlobalFontsLoaded() {
  const [loaded, setLoaded] = useState(checkInterLoaded);

  useEffect(() => {
    if (checkInterLoaded()) {
      if (!loaded) setLoaded(true);
      return undefined;
    }
    listeners.add(setLoaded);
    loadGlobalFonts();
    return () => listeners.delete(setLoaded);
  }, [loaded]);

  return loaded;
}

function mayContainElementChildren(children) {
  if (children == null || typeof children !== "object") return false;
  if (Array.isArray(children) && children.length <= 3) {
    for (let i = 0; i < children.length; i++) {
      if (children[i] != null && typeof children[i] === "object") {
        return true;
      }
    }
    return false;
  }
  return true;
}

let patched = false;

export function applyGlobalInterFont() {
  if (patched) return;
  patched = true;

  const OriginalText = TextModule.default;
  const OriginalTextInput = TextInputModule.default;

  if (OriginalText) {
    const InterText = ({ ref, style, children, ...restProps }) => {
      const hasTextAncestor = useContext(TextAncestorContext);
      const parentState = useContext(ParentFontStateContext);

      if (!checkInterLoaded()) {
        return (
          <OriginalText {...restProps} style={style} ref={ref}>
            {children}
          </OriginalText>
        );
      }

      const flat = style != null ? StyleSheet.flatten(style) : null;
      const explicitFamily = flat?.fontFamily;

      // Already an explicit Inter variant (e.g. Inter_600SemiBold)
      if (explicitFamily && INTER_FAMILIES.has(explicitFamily)) {
        return (
          <OriginalText {...restProps} style={[style, OVERRIDE_STYLES[explicitFamily]]} ref={ref}>
            {children}
          </OriginalText>
        );
      }

      // Explicit non-system font (vector icons, StyledName custom fonts, monospace, story fonts)
      if (explicitFamily && !isSystemFontFamily(explicitFamily)) {
        const element = (
          <OriginalText {...restProps} style={style} ref={ref}>
            {children}
          </OriginalText>
        );
        if (mayContainElementChildren(children) && !parentState.customFont) {
          return (
            <ParentFontStateContext.Provider value={CUSTOM_FONT_STATE}>
              {element}
            </ParentFontStateContext.Provider>
          );
        }
        return element;
      }

      // Inside a parent <Text> that uses a custom/monospace font: inherit it
      if (hasTextAncestor && parentState.customFont && !explicitFamily) {
        return (
          <OriginalText {...restProps} style={style} ref={ref}>
            {children}
          </OriginalText>
        );
      }

      const hasOwnWeight = flat?.fontWeight != null || explicitFamily === "sans-serif-medium" || explicitFamily === "sans-serif-light" || explicitFamily === "sans-serif-thin";
      const hasOwnStyle = flat?.fontStyle != null;

      const weight = hasOwnWeight
        ? normalizeFontWeight(flat?.fontWeight, explicitFamily)
        : hasTextAncestor
        ? parentState.weight
        : "400";
      const italic = hasOwnStyle
        ? flat.fontStyle === "italic"
        : hasTextAncestor
        ? parentState.italic
        : false;

      const interFamily = getInterFontFamily(weight, italic);
      const resolvedStyle = style != null ? [style, OVERRIDE_STYLES[interFamily]] : OVERRIDE_STYLES[interFamily];

      const element = (
        <OriginalText {...restProps} style={resolvedStyle} ref={ref}>
          {children}
        </OriginalText>
      );

      if (mayContainElementChildren(children)) {
        const nextState = FONT_STATES[`${weight}_${italic ? "italic" : "normal"}`] || DEFAULT_FONT_STATE;
        if (nextState !== parentState) {
          return (
            <ParentFontStateContext.Provider value={nextState}>
              {element}
            </ParentFontStateContext.Provider>
          );
        }
      }

      return element;
    };

    Object.assign(InterText, OriginalText);
    InterText.displayName = "Text";
    TextModule.default = InterText;
  }

  if (OriginalTextInput) {
    const InterTextInput = ({ ref, style, ...restProps }) => {
      if (!checkInterLoaded()) {
        return <OriginalTextInput {...restProps} style={style} ref={ref} />;
      }

      const flat = style != null ? StyleSheet.flatten(style) : null;
      const explicitFamily = flat?.fontFamily;

      if (explicitFamily && INTER_FAMILIES.has(explicitFamily)) {
        return (
          <OriginalTextInput
            {...restProps}
            style={[style, OVERRIDE_STYLES[explicitFamily]]}
            ref={ref}
          />
        );
      }

      if (explicitFamily && !isSystemFontFamily(explicitFamily)) {
        return <OriginalTextInput {...restProps} style={style} ref={ref} />;
      }

      const weight = normalizeFontWeight(flat?.fontWeight, explicitFamily);
      const italic = flat?.fontStyle === "italic";
      const interFamily = getInterFontFamily(weight, italic);
      const resolvedStyle = style != null ? [style, OVERRIDE_STYLES[interFamily]] : OVERRIDE_STYLES[interFamily];

      return <OriginalTextInput {...restProps} style={resolvedStyle} ref={ref} />;
    };

    Object.assign(InterTextInput, OriginalTextInput);
    InterTextInput.displayName = "TextInput";
    TextInputModule.default = InterTextInput;
  }
}

// Apply component patches and start loading Inter fonts immediately on import.
applyGlobalInterFont();
loadGlobalFonts();
