import { useEffect, useState } from "react";
import * as Font from "expo-font";

/**
 * Phông chữ cho tên hiển thị (kiểu Display Name Styles của Discord) - bản
 * mobile của src/lib/nameFonts.js bên web. Cùng các Google Font đó (đều có
 * bộ ký tự tiếng Việt), đóng gói sẵn trong app/assets/fonts/name.
 *
 * Font chỉ được nạp khi một tên dùng nó thực sự hiển thị (useNameFont), nên
 * không làm chậm lúc mở app. Key phải khớp ProfileThemeService::NAME_FONTS
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
  const font = NAME_FONTS[key];
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

  if (!font?.family || !ready) return null;
  return { family: font.family, scale: font.scale || 1, letterSpacing: font.letterSpacing };
}
