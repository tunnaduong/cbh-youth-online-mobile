import { storage } from "../global/storage";

export const AI_TRANSLATE_STORAGE_KEY = "cbh_ai_translate_lang";

export const AI_TRANSLATION_LANGUAGES = [
  { code: "auto", labelKey: "settings.aiTranslateAuto", flag: "✨" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "zh", label: "简体中文 (Chinese)", flag: "🇨🇳" },
];

/**
 * Get user's configured AI translation language.
 * Defaults to "auto", which resolves to current app language (or "vi" if not one of vi/en/ru/zh).
 */
export function getAiTranslateLanguage(currentAppLang = "vi") {
  try {
    const saved = storage.getString(AI_TRANSLATE_STORAGE_KEY);
    if (!saved || saved === "auto") {
      const normalized = (currentAppLang || "vi").toLowerCase().split("-")[0];
      if (["vi", "en", "ru", "zh"].includes(normalized)) {
        return normalized;
      }
      return "vi";
    }
    if (["vi", "en", "ru", "zh"].includes(saved)) {
      return saved;
    }
    return "vi";
  } catch {
    return "vi";
  }
}

export function getAiTranslatePreference() {
  try {
    return storage.getString(AI_TRANSLATE_STORAGE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function setAiTranslatePreference(code) {
  try {
    storage.set(AI_TRANSLATE_STORAGE_KEY, code);
  } catch {}
}

export function getLanguageDisplayName(code, t) {
  if (code === "auto") {
    return t ? t("settings.aiTranslateAuto", "Tự động") : "Tự động";
  }
  const normCode = code === "zh-cn" ? "zh" : code;
  const item = AI_TRANSLATION_LANGUAGES.find((l) => l.code === normCode);
  if (!item) return code;
  const label = item.label || (item.labelKey && t ? t(item.labelKey) : normCode);
  return `${item.flag} ${label}`;
}
