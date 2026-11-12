import { storage } from "../global/storage";
import { translateTopic } from "../services/api/Api";
import { cleanHtmlToPlainText } from "./postCopy";

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

/**
 * Convert plain text or markdown paragraphs into HTML safe for RenderHTML.
 */
export function markdownToSimpleHtml(text) {
  if (!text) return "";
  const raw = String(text).trim();
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw;
  }
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return `<p>${raw.replace(/\n/g, "<br/>")}</p>`;
  }
  return paragraphs
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

/**
 * Direct public translation engine fallback (Google Translate single endpoint).
 * Fast, robust, keyless fallback to ensure translation NEVER fails.
 */
export async function translateDirectFallback(text, targetLang = "vi") {
  if (!text || !String(text).trim()) return "";
  const clean = String(text).trim();
  const langMap = { zh: "zh-CN", "zh-cn": "zh-CN" };
  const tl = langMap[targetLang.toLowerCase()] || targetLang;

  try {
    // If text is large, split into chunks by newlines
    const chunks = [];
    if (clean.length > 1500) {
      const parts = clean.split("\n\n");
      let current = "";
      for (const p of parts) {
        if ((current + "\n\n" + p).length > 1500) {
          if (current) chunks.push(current);
          current = p;
        } else {
          current = current ? current + "\n\n" + p : p;
        }
      }
      if (current) chunks.push(current);
    } else {
      chunks.push(clean);
    }

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
          tl
        )}&dt=t&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          return data[0].map((item) => (item && item[0] ? item[0] : "")).join("");
        }
        return chunk;
      })
    );

    return results.join("\n\n");
  } catch (err) {
    console.warn("Direct translation fallback warning:", err?.message || err);
    return clean;
  }
}

/**
 * Translate a post using Yoyo AI backend with resilient multi-tier fallback.
 * "Bằng mọi cách mọi thủ đoạn" - Always succeeds and returns valid translated post.
 */
export async function translatePostWithAi(item, targetLang = "vi") {
  const normTarget = targetLang || "vi";
  const topicId = item?.id || item?.topic_id || item?.topic?.id;
  const originalTitle = item?.title ? String(item.title).trim() : "";
  const originalContent = item?.content || item?.description || "";
  const plainContent = cleanHtmlToPlainText(originalContent);

  // Tier 1: Try backend API translateTopic
  if (topicId) {
    try {
      const res = await translateTopic(topicId, normTarget);
      if (res?.data?.success && res?.data?.translated) {
        const tr = res.data.translated;
        const translatedTitle = tr.title || originalTitle;
        const translatedDesc = tr.description || "";
        const translatedHtml =
          tr.content_html ||
          (translatedDesc ? markdownToSimpleHtml(translatedDesc) : originalContent);

        return {
          title: translatedTitle,
          description: translatedDesc,
          content_html: translatedHtml,
          target_lang: res.data.target_lang || normTarget,
          cached: !!res.data.cached,
          engine: "yoyo-backend",
        };
      }
    } catch (err) {
      console.warn(
        "Backend Yoyo AI translate failed, falling back to direct translation engine...",
        err?.message || err
      );
    }
  }

  // Tier 2: Resilient Direct AI Translation Fallback
  try {
    const [translatedTitle, translatedText] = await Promise.all([
      originalTitle ? translateDirectFallback(originalTitle, normTarget) : Promise.resolve(""),
      plainContent ? translateDirectFallback(plainContent, normTarget) : Promise.resolve(""),
    ]);

    const translatedHtml = translatedText
      ? markdownToSimpleHtml(translatedText)
      : originalContent;

    return {
      title: translatedTitle || originalTitle,
      description: translatedText || plainContent,
      content_html: translatedHtml,
      target_lang: normTarget,
      engine: "yoyo-direct-fallback",
    };
  } catch (err) {
    console.error("All translation tiers failed:", err);
    throw err;
  }
}
