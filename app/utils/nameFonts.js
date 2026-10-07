import { useEffect, useState } from "react";
import * as Font from "expo-font";
import axiosInstance from "../services/api/axiosInstance";

/**
 * Phông chữ cho tên hiển thị (kiểu Display Name Styles của Discord) - bản
 * mobile của src/lib/nameFonts.js bên web. Cùng các Google Font đó (đều có
 * bộ ký tự tiếng Việt), đóng gói sẵn trong app/assets/fonts/name.
 *
 * Font chỉ được nạp khi một tên dùng nó thực sự hiển thị (useNameFont), nên
 * không làm chậm lúc mở app. Key phải khớp ProfileThemeService::OPTIONS['name_font']
 * phía API. `scale` bù cho font vẽ nhỏ hơn cỡ chữ (VT323).
 */
export const NAME_FONTS = {
  default: { labelKey: "default" },
  condensed: { family: "Oswald_600SemiBold", source: require("../assets/fonts/name/Oswald_600SemiBold.ttf") },
  script: { family: "DancingScript_700Bold", source: require("../assets/fonts/name/DancingScript_700Bold.ttf") },
  bubbly: { family: "Grandstander_800ExtraBold", source: require("../assets/fonts/name/Grandstander_800ExtraBold.ttf") },
  modern: { family: "Lexend_600SemiBold", source: require("../assets/fonts/name/Lexend_600SemiBold.ttf") },
  gothic: { family: "GrenzeGotisch_700Bold", source: require("../assets/fonts/name/GrenzeGotisch_700Bold.ttf") },
  pixel: { family: "VT323_400Regular", source: require("../assets/fonts/name/VT323_400Regular.ttf"), scale: 1.25 },
  spooky: { family: "ProtestGuerrilla_400Regular", source: require("../assets/fonts/name/ProtestGuerrilla_400Regular.ttf") },
  comic: { family: "Bangers_400Regular", source: require("../assets/fonts/name/Bangers_400Regular.ttf"), letterSpacing: 0.5 },
  tech: { family: "Tektur_700Bold", source: require("../assets/fonts/name/Tektur_700Bold.ttf") },
  heavy: { family: "Bungee_400Regular", source: require("../assets/fonts/name/Bungee_400Regular.ttf") },
  handwritten: { family: "PatrickHand_400Regular", source: require("../assets/fonts/name/PatrickHand_400Regular.ttf") },
};

/**
 * Fonts the API hosts (GET /v1.0/name-fonts): every `name_font` key that
 * isn't bundled above. The list is fetched once per app run; a font's file
 * is downloaded (and cached by expo-font) only when a name using it is
 * shown, so new fonts added on the server work without an app update.
 */
let serverFonts = null; // key -> { family, source }
let serverFontsPromise = null;

function loadServerFontList() {
  if (!serverFontsPromise) {
    serverFontsPromise = axiosInstance
      .get("/v1.0/name-fonts")
      .then((response) => {
        serverFonts = {};
        (response.data?.fonts || []).forEach((font) => {
          if (font?.key && font?.url) {
            // Font family names can't contain spaces on Android.
            serverFonts[font.key] = {
              family: `srv_${font.key}`,
              source: { uri: font.url },
              label: font.label,
            };
          }
        });
        return serverFonts;
      })
      .catch(() => {
        // Try again the next time a name needs it.
        serverFontsPromise = null;
        return {};
      });
  }
  return serverFontsPromise;
}

const loading = new Map(); // family -> Promise

function loadFont(font) {
  if (!font?.family) return Promise.resolve(true);
  if (Font.isLoaded(font.family)) return Promise.resolve(true);
  if (!loading.has(font.family)) {
    loading.set(
      font.family,
      Font.loadAsync({ [font.family]: font.source })
        .then(() => true)
        .catch((error) => {
          console.warn("[nameFonts] failed to load", font.family, error?.message);
          loading.delete(font.family);
          return false;
        })
    );
  }
  return loading.get(font.family);
}

/**
 * Font của một key kiểu tên: { family, scale, letterSpacing } khi đã nạp
 * xong, null với "default"/key lạ hoặc khi đang nạp (tên hiện bằng font hệ
 * thống trong lúc chờ, rồi tự đổi).
 */
export function useNameFont(key) {
  const bundled = NAME_FONTS[key];
  const needsServer = !!key && key !== "default" && !bundled;
  // Re-render once the server list has arrived.
  const [, setListVersion] = useState(0);

  useEffect(() => {
    if (!needsServer || serverFonts) return undefined;
    let cancelled = false;
    loadServerFontList().then(() => {
      if (!cancelled) setListVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [needsServer]);

  const font = bundled || (needsServer ? serverFonts?.[key] : undefined);
  const [ready, setReady] = useState(() => !font?.family || Font.isLoaded(font.family));

  useEffect(() => {
    if (!font?.family) {
      setReady(true);
      return undefined;
    }
    if (Font.isLoaded(font.family)) {
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    setReady(false);
    loadFont(font).then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [font]);

  // isLoaded() as well as `ready`: a server font can appear between renders
  // (when the list arrives) before the effect above has reset `ready`.
  if (!font?.family || !ready || !Font.isLoaded(font.family)) return null;
  return { family: font.family, scale: font.scale || 1, letterSpacing: font.letterSpacing };
}
