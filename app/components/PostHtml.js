import React, { createContext, useContext, useMemo } from "react";
import RenderHTML, {
  HTMLElementModel,
  HTMLContentModel,
  TRenderEngineProvider,
  RenderHTMLConfigProvider,
  RenderHTMLSource,
  useAmbientTRenderEngine,
} from "react-native-render-html";
import { useTheme } from "../contexts/ThemeContext";

// Rendering a post body used to be one <RenderHTML> per card. Each one built
// its own render engine (compiling every tag style) and parsed the whole HTML
// again every time the card mounted - and a feed card mounts again each time
// it scrolls back into the list's window. On a very long post that was the
// Android scroll jank. Now:
//   - one engine for every post, built once per theme (PostHtmlEngineProvider,
//     mounted in contexts/index.js);
//   - parsed trees are cached by HTML string, so a remount skips parsing;
//   - a collapsed feed card only gets the start of the post
//     (truncateHtmlForPreview) - the rest was clipped away anyway.

// react-native-render-html doesn't know about <iframe> by default (it's not
// a real HTML content tag), so it has to be registered as a custom element
// and given a custom renderer that plays the embed in a WebView. PostItem
// re-exports this for other RenderHTML instances (e.g. PostScreen's comment
// renderer) that also display backend-whitelisted YouTube/SoundCloud iframes.
export const customHTMLElementModels = {
  iframe: HTMLElementModel.fromCustomModel({
    tagName: "iframe",
    contentModel: HTMLContentModel.block,
  }),
};

export const POST_HTML_CLASSES_STYLES = {
  "mention-tag": {
    color: "#22c55e",
    fontWeight: "600",
  },
};

export function getPostTagsStyles(theme, isDarkMode) {
  return {
    h1: { fontSize: 24, fontWeight: "bold", marginVertical: 12, color: theme.text },
    h2: { fontSize: 18, fontWeight: "bold", marginTop: 14, marginBottom: 8, color: theme.text },
    h3: { fontSize: 16, fontWeight: "bold", marginTop: 12, marginBottom: 6, color: theme.text },
    h4: { fontSize: 14, fontWeight: "600", marginTop: 10, marginBottom: 4, color: theme.text },
    h5: { fontSize: 13, fontWeight: "600", marginTop: 8, marginBottom: 4, color: theme.text },
    h6: { fontSize: 12, fontWeight: "600", marginTop: 8, marginBottom: 4, color: theme.subText },
    p: { marginBottom: 8, marginTop: 0, color: theme.text },
    ul: { marginVertical: 6 },
    ol: { marginVertical: 6 },
    li: { marginBottom: 4, color: theme.text },
    pre: {
      backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
      borderRadius: 6,
      padding: 12,
      marginVertical: 12,
    },
    strong: { fontWeight: "bold", color: theme.text },
    em: { fontStyle: "italic", color: theme.text },
    br: { marginBottom: 4 },
    blockquote: {
      backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
      marginVertical: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      fontStyle: "italic",
      borderRadius: 4,
    },
    hr: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginVertical: 15,
      backgroundColor: "transparent",
      height: 1,
    },
    code: {
      backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
      color: "#d63384",
      fontFamily: "monospace",
      fontSize: 14,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    a: { color: theme.primary, textDecorationLine: "underline" },
  };
}

function usePostEngineConfig() {
  const { theme, isDarkMode } = useTheme();
  const tagsStyles = useMemo(() => getPostTagsStyles(theme, isDarkMode), [theme, isDarkMode]);
  const baseStyle = useMemo(() => ({ fontSize: 16, color: theme.text }), [theme.text]);
  return { tagsStyles, baseStyle };
}

// --- Parsed-tree cache -------------------------------------------------------

const TTREE_CACHE_SIZE = 40;
const patchedEngines = new WeakSet();

// The library parses in engine.buildTTree(html) on every mount. Wrapping it on
// the shared engine instance makes a remounted card reuse the tree it built
// last time. The tree is only read while rendering, so sharing it is safe; a
// new theme builds a new engine and so a fresh cache.
function cacheEngineTrees(engine) {
  if (!engine || typeof engine.buildTTree !== "function" || patchedEngines.has(engine)) return;
  patchedEngines.add(engine);
  const original = engine.buildTTree.bind(engine);
  const cache = new Map();
  engine.buildTTree = (html, ...rest) => {
    if (typeof html !== "string" || rest.length > 0) return original(html, ...rest);
    const hit = cache.get(html);
    if (hit) {
      cache.delete(html);
      cache.set(html, hit);
      return hit;
    }
    const tree = original(html);
    cache.set(html, tree);
    if (cache.size > TTREE_CACHE_SIZE) cache.delete(cache.keys().next().value);
    return tree;
  };
}

function EngineTreeCache({ children }) {
  cacheEngineTrees(useAmbientTRenderEngine());
  return children;
}

const SharedEngineContext = createContext(false);

export function PostHtmlEngineProvider({ children }) {
  const { tagsStyles, baseStyle } = usePostEngineConfig();
  return (
    <TRenderEngineProvider
      tagsStyles={tagsStyles}
      baseStyle={baseStyle}
      classesStyles={POST_HTML_CLASSES_STYLES}
      customHTMLElementModels={customHTMLElementModels}
    >
      <EngineTreeCache>
        <SharedEngineContext.Provider value={true}>{children}</SharedEngineContext.Provider>
      </EngineTreeCache>
    </TRenderEngineProvider>
  );
}

// --- Rendering ---------------------------------------------------------------

export function PostHtml({ html, contentWidth, renderers, renderersProps }) {
  const shared = useContext(SharedEngineContext);
  const source = useMemo(() => ({ html }), [html]);
  if (shared) {
    return (
      <RenderHTMLConfigProvider renderers={renderers} renderersProps={renderersProps}>
        <RenderHTMLSource contentWidth={contentWidth} source={source} />
      </RenderHTMLConfigProvider>
    );
  }
  return (
    <FallbackPostHtml
      source={source}
      contentWidth={contentWidth}
      renderers={renderers}
      renderersProps={renderersProps}
    />
  );
}

// Only used if a post is ever rendered outside PostHtmlEngineProvider (another
// React root); same output, just without the shared engine.
function FallbackPostHtml({ source, contentWidth, renderers, renderersProps }) {
  const { tagsStyles, baseStyle } = usePostEngineConfig();
  return (
    <RenderHTML
      contentWidth={contentWidth}
      customHTMLElementModels={customHTMLElementModels}
      renderers={renderers}
      renderersProps={renderersProps}
      source={source}
      baseStyle={baseStyle}
      classesStyles={POST_HTML_CLASSES_STYLES}
      tagsStyles={tagsStyles}
    />
  );
}

// --- Collapsed preview -------------------------------------------------------

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);
// Tags that start a new line/box; they bound how tall a preview can get even
// when its text is short (many short paragraphs, images).
const BLOCK_WEIGHT = {
  p: 1, div: 1, li: 1, tr: 1, br: 1, hr: 1, blockquote: 1, pre: 1, table: 1,
  h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, iframe: 4, img: 4,
};
const TAG_NAME = /^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/;

/**
 * The start of `html`, cut on a tag or word boundary, with every tag still
 * open closed again - enough to fill the collapsed (180px) card. Scans only
 * as far as it keeps, so it costs the same for a 1 KB post and a 500 KB one.
 * Returns `html` itself when nothing had to be cut.
 */
export function truncateHtmlForPreview(html, maxTextChars, maxBlocks = 14) {
  if (!html || html.length <= maxTextChars) return html;
  const token = /<!--[\s\S]*?-->|<[^>]*>|<|[^<]+/g;
  const out = [];
  const open = [];
  let text = 0;
  let blocks = 0;
  let cut = false;
  let m;
  while ((m = token.exec(html))) {
    const tok = m[0];
    if (tok.length > 1 && tok[0] === "<") {
      const nameMatch = tok.match(TAG_NAME);
      if (!nameMatch) {
        if (!tok.startsWith("<!--")) out.push(tok);
        continue;
      }
      const name = nameMatch[1].toLowerCase();
      if (tok[1] === "/") {
        const at = open.lastIndexOf(name);
        if (at !== -1) {
          open.length = at;
          out.push(tok);
        }
        continue;
      }
      const weight = BLOCK_WEIGHT[name] || 0;
      if (weight && (text >= maxTextChars || blocks >= maxBlocks)) {
        cut = true;
        break;
      }
      blocks += weight;
      out.push(tok);
      if (!VOID_TAGS.has(name) && !tok.endsWith("/>")) open.push(name);
    } else {
      const room = maxTextChars - text;
      if (room <= 0) {
        if (tok.trim()) {
          cut = true;
          break;
        }
        continue;
      }
      if (tok.length > room) {
        let end = tok.lastIndexOf(" ", room);
        if (end < room * 0.6) end = room;
        // Don't split an entity such as "&amp;".
        const amp = tok.lastIndexOf("&", end);
        if (amp !== -1 && tok.indexOf(";", amp) >= end) end = amp;
        out.push(tok.slice(0, end) + "…");
        cut = true;
        break;
      }
      out.push(tok);
      text += tok.length;
    }
  }
  if (!cut) return html;
  for (let i = open.length - 1; i >= 0; i--) out.push(`</${open[i]}>`);
  return out.join("");
}
