import { getPostDetail, getProfile } from "../services/api/Api";
import { isYouTubeUrl } from "./youtubeShare";
import { isSoundCloudUrl } from "./soundcloudShare";
import { parseUrlParts, resolveInAppRoute } from "./externalLink";

// Builds the data behind LinkPreviewCard - the Facebook-style card shown under
// a pasted link. Posts and profiles on chuyenbienhoa.com are read from our own
// API (richer than the page's meta tags, and respects what the viewer is
// allowed to see); any other site is fetched and its Open Graph tags parsed.
// Native fetch has no CORS, so that can happen right here on the device.

const URL_REGEX = /https?:\/\/[^\s<>"']+/i;
const HREF_REGEX = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
// Sentence punctuation typed right after a link isn't part of it.
const TRAILING_PUNCTUATION = /[.,!?;:\]}>»"']+$/;

const FETCH_TIMEOUT_MS = 8000;
// Only the <head> matters; stop parsing past this much of a page that never
// closes it.
const MAX_HTML_CHARS = 300000;
const MAX_CACHE_ENTRIES = 200;
// Generic browser user agents often get a cookie wall or a JS shell instead of
// the meta tags; sites serve their share tags to link-unfurling bots.
const USER_AGENT =
  "Mozilla/5.0 (compatible; CBHYouthOnlineBot/1.0; +https://chuyenbienhoa.com) facebookexternalhit/1.1";

const pending = new Map(); // url -> Promise<preview | null>
const resolved = new Map(); // url -> preview | null

function cleanUrl(url) {
  let out = String(url || "").trim();
  for (;;) {
    const stripped = out.replace(TRAILING_PUNCTUATION, "");
    if (stripped !== out) {
      out = stripped;
      continue;
    }
    // A closing paren belongs to the URL when it balances one inside it
    // (wikipedia.org/wiki/Foo_(bar)), and to the sentence otherwise.
    if (out.endsWith(")") && (out.match(/\(/g) || []).length < (out.match(/\)/g) || []).length) {
      out = out.slice(0, -1);
      continue;
    }
    return out;
  }
}

function isPreviewable(url) {
  if (!parseUrlParts(url)) return false;
  // Hashtag links in post bodies are searches, not something to preview.
  if (/[?&]type=hashtag(&|$)/.test(url)) return false;
  // These already get an inline player instead of a card.
  return !isYouTubeUrl(url) && !isSoundCloudUrl(url);
}

/** First link in plain text (chat messages) worth previewing, or null. */
export function findPreviewableUrl(text) {
  const source = String(text || "");
  const regex = new RegExp(URL_REGEX.source, "gi");
  let match;
  while ((match = regex.exec(source)) !== null) {
    const url = cleanUrl(match[0]);
    if (isPreviewable(url)) return url;
  }
  return null;
}

/** First link in rendered post HTML worth previewing, or null. */
export function findPreviewableUrlInHtml(html) {
  const source = String(html || "");
  // An embedded player (YouTube/SoundCloud iframe) already shows the link.
  if (/<iframe[\s>]/i.test(source)) return null;
  HREF_REGEX.lastIndex = 0;
  let match;
  while ((match = HREF_REGEX.exec(source)) !== null) {
    const url = cleanUrl(decodeEntities(match[1]));
    if (isPreviewable(url)) return url;
  }
  return findPreviewableUrl(decodeEntities(source.replace(/<[^>]*>/g, " ")));
}

/** A preview already fetched this session (null = no card), or undefined. */
export function getCachedLinkPreview(url) {
  return resolved.get(cleanUrl(url));
}

/** Resolves to the preview for a link, or null when there's nothing to show. */
export function fetchLinkPreview(url) {
  const key = cleanUrl(url);
  if (resolved.has(key)) return Promise.resolve(resolved.get(key));
  if (pending.has(key)) return pending.get(key);

  const promise = loadPreview(key)
    .catch(() => null)
    .then((preview) => {
      pending.delete(key);
      resolved.set(key, preview);
      if (resolved.size > MAX_CACHE_ENTRIES) {
        resolved.delete(resolved.keys().next().value);
      }
      return preview;
    });
  pending.set(key, promise);
  return promise;
}

async function loadPreview(url) {
  const route = resolveInAppRoute(url);
  if (route?.type === "post") {
    const preview = await loadPostPreview(url, route).catch(() => null);
    if (preview) return preview;
  } else if (route?.type === "profile") {
    const preview = await loadProfilePreview(url, route).catch(() => null);
    if (preview) return preview;
  }
  return loadOpenGraphPreview(url);
}

async function loadPostPreview(url, route) {
  const response = await getPostDetail(route.params.postId);
  const post = response?.data?.post;
  if (!post) return null;
  const image =
    post.image_thumbnail_urls?.[0] ||
    post.image_urls?.[0] ||
    post.video_thumbnail_urls?.[0] ||
    null;
  return {
    kind: "post",
    url,
    route,
    siteName: "CBH Youth Online",
    title: post.title || "",
    description: excerpt(stripHtml(post.content), 160),
    image,
    authorName: post.anonymous ? null : post.author?.profile_name || post.author?.username || null,
  };
}

async function loadProfilePreview(url, route) {
  const response = await getProfile(route.params.username);
  const user = response?.data;
  if (!user?.username) return null;
  return {
    kind: "profile",
    url,
    route,
    siteName: "CBH Youth Online",
    title: user.profile?.profile_name || user.username,
    username: user.username,
    description: excerpt(user.profile?.bio || "", 120),
    avatar: user.profile?.profile_picture || null,
    verified: Boolean(user.profile?.verified),
  };
}

async function loadOpenGraphPreview(url) {
  const parts = parseUrlParts(url);
  if (!parts) return null;

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  let html;
  let finalUrl = url;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "User-Agent": USER_AGENT,
      },
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    finalUrl = response.url || url;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.startsWith("image/")) {
      return {
        kind: "external",
        url,
        siteName: parts.hostname.replace(/^www\./, ""),
        title: decodeSegmentSafe(parts.path.split("/").pop() || parts.hostname),
        description: "",
        image: finalUrl,
      };
    }
    if (contentType && !contentType.includes("html")) return null;
    html = await response.text();
  } finally {
    if (timer) clearTimeout(timer);
  }

  const headEnd = html.search(/<\/head>/i);
  const head = html.slice(0, headEnd > 0 ? headEnd : MAX_HTML_CHARS);
  const meta = parseMetaTags(head);

  const title =
    meta["og:title"] ||
    meta["twitter:title"] ||
    decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] || "").trim());
  const description =
    meta["og:description"] || meta["twitter:description"] || meta.description || "";
  const image = resolveUrl(
    meta["og:image:secure_url"] ||
      meta["og:image"] ||
      meta["og:image:url"] ||
      meta["twitter:image"] ||
      meta["twitter:image:src"] ||
      findLinkHref(head, /(^|\s)image_src(\s|$)/i),
    finalUrl
  );
  if (!title && !description && !image) return null;

  const finalParts = parseUrlParts(finalUrl) || parts;
  return {
    kind: "external",
    url,
    siteName: meta["og:site_name"] || finalParts.hostname.replace(/^www\./, ""),
    title: excerpt(title, 200),
    description: excerpt(description, 200),
    image,
    icon:
      resolveUrl(
        findLinkHref(head, /(^|\s)apple-touch-icon(\s|$)/i) ||
          findLinkHref(head, /(^|\s)icon(\s|$)/i),
        finalUrl
      ) || `${finalParts.scheme}://${finalParts.hostPort}/favicon.ico`,
  };
}

const ATTRIBUTE_REGEX = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function parseAttributes(tag) {
  const attributes = {};
  ATTRIBUTE_REGEX.lastIndex = 0;
  let match;
  while ((match = ATTRIBUTE_REGEX.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function parseMetaTags(head) {
  const meta = {};
  const tagRegex = /<meta\b[^>]*>/gi;
  let match;
  while ((match = tagRegex.exec(head)) !== null) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.property || attributes.name || attributes.itemprop || "").toLowerCase();
    const content = attributes.content;
    // First one wins - pages list the primary image before the alternates.
    if (key && content && !(key in meta)) {
      meta[key] = decodeEntities(content).trim();
    }
  }
  return meta;
}

function findLinkHref(head, relPattern) {
  const tagRegex = /<link\b[^>]*>/gi;
  let match;
  while ((match = tagRegex.exec(head)) !== null) {
    const attributes = parseAttributes(match[0]);
    if (attributes.href && relPattern.test(attributes.rel || "")) {
      return decodeEntities(attributes.href);
    }
  }
  return null;
}

function resolveUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = parseUrlParts(baseUrl);
  if (!base) return null;
  if (raw.startsWith("//")) return `${base.scheme}:${raw}`;
  const origin = `${base.scheme}://${base.hostPort}`;
  if (raw.startsWith("/")) return origin + raw;
  const directory = base.path.replace(/[^/]*$/, "") || "/";
  return origin + directory + raw;
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(value) {
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      } catch {
        return entity;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function decodeSegmentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripHtml(html) {
  return decodeEntities(String(html || "").replace(/<[^>]*>/g, " "));
}

function excerpt(text, maxLength) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1).trimEnd()}…` : flat;
}
