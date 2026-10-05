import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import CustomLoading from "../CustomLoading";
import RenderHTML from "react-native-render-html";
import { MarkdownIt } from "react-native-markdown-display";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import { previewPostMarkdown } from "../../services/api/Api";
import { linkifyMentionsInHtml } from "../../utils/mentionRender";
import { customHTMLElementModels, YouTubeIframeRenderer } from "../PostItem";

// Tab content for the editor's "Preview". The HTML comes from the server's
// own Markdown pipeline (the same one that renders a published post), so what
// shows here - mentions, embeds, stripped HTML - is what readers will get.
//
// If the server can't answer (an older backend without the preview endpoint,
// no connection, a timeout) the Markdown is rendered on the device instead,
// flagged as approximate: it covers the same syntax, but can't resolve
// @mentions against real accounts.
//
// The last result is kept at module level: flipping Write -> Preview ->
// Write -> Preview without touching the text shouldn't hit the network twice.
let lastResult = { markdown: null, data: null };

const localMarkdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
// Same embed whitelist the server keeps (YouTube / Vimeo / SoundCloud iframes).
const IFRAME_RE = /<iframe[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi;
const ALLOWED_IFRAME = /^(https?:)?\/\/((www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)|w\.soundcloud\.com)\//;

const renderLocally = (markdown) => {
  // The server drops raw HTML from the body (keeping only the whitelisted
  // iframes, appended after it); do the same instead of showing it as text.
  const withoutHtml = markdown.replace(IFRAME_RE, "").replace(/<\/?[a-zA-Z][^>]*>/g, "");
  let html = localMarkdown.render(withoutHtml);
  (markdown.match(IFRAME_RE) || []).forEach((tag) => {
    const src = /src="([^"]+)"/i.exec(tag)?.[1] || "";
    if (ALLOWED_IFRAME.test(src)) html += tag;
  });
  return html;
};

// Bounded: a hung server shouldn't keep the author staring at a spinner.
const PREVIEW_TIMEOUT_MS = 8000;

const PostPreview = ({ markdown, horizontalPadding = 16 }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const cached = lastResult.markdown === markdown ? lastResult.data : null;
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(!cached && markdown.trim() !== "");
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (markdown.trim() === "") {
      setData(null);
      setLoading(false);
      return;
    }
    if (lastResult.markdown === markdown && lastResult.data) {
      setData(lastResult.data);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    try {
      const response = await previewPostMarkdown(markdown, { timeout: PREVIEW_TIMEOUT_MS });
      if (requestId !== requestRef.current) return;
      const result = {
        html: response?.data?.html ?? "",
        mentions: new Set((response?.data?.mentions ?? []).map((m) => String(m.username).toLowerCase())),
        approximate: false,
      };
      lastResult = { markdown, data: result };
      setData(result);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.log("Post preview unavailable from server, rendering locally:", error?.response?.status || error?.message);
      try {
        // Not cached: once the backend has the endpoint, the next preview
        // should use it instead of this approximation.
        setData({ html: renderLocally(markdown), mentions: new Set(), approximate: true });
      } catch (renderError) {
        setFailed(true);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [markdown]);

  useEffect(() => {
    load();
    // A newer request (or unmount) invalidates whatever is still in flight.
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const source = useMemo(
    () => ({ html: data ? linkifyMentionsInHtml(data.html, data.mentions) : "" }),
    [data],
  );

  if (markdown.trim() === "") {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center" }}>
        <Text style={{ color: theme.subText, fontSize: 15 }}>{t("createPost.previewEmpty")}</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 4 }}>
      {loading && !data ? (
        <CustomLoading size={48} style={{ alignSelf: "center", marginTop: 24 }} />
      ) : failed && !data ? (
        <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
          <Text style={{ color: theme.subText, fontSize: 14 }}>{t("createPost.previewError")}</Text>
          <TouchableOpacity
            onPress={load}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.primary,
            }}
          >
            <Text style={{ color: theme.primary, fontWeight: "700" }}>{t("createPost.previewRetry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        data && (
          <>
          {data.approximate && (
            <Text style={{ color: theme.subText, fontSize: 12, marginBottom: 12 }}>
              {t("createPost.previewApprox")}
            </Text>
          )}
          <RenderHTML
            contentWidth={width - horizontalPadding * 2}
            source={source}
            customHTMLElementModels={customHTMLElementModels}
            renderers={{ iframe: YouTubeIframeRenderer }}
            // It's a preview: a tapped link shouldn't whisk the author away
            // from a half-written post.
            renderersProps={{ a: { onPress: () => {} } }}
            baseStyle={{ fontSize: 16, color: theme.text }}
            classesStyles={{ "mention-tag": { color: "#22c55e", fontWeight: "600" } }}
            tagsStyles={{
              h1: { fontSize: 24, fontWeight: "bold", marginVertical: 12, color: theme.text },
              h2: { fontSize: 20, fontWeight: "bold", marginTop: 14, marginBottom: 8, color: theme.text },
              h3: { fontSize: 18, fontWeight: "bold", marginTop: 12, marginBottom: 6, color: theme.text },
              h4: { fontSize: 16, fontWeight: "600", marginTop: 10, marginBottom: 4, color: theme.text },
              p: { marginTop: 0, marginBottom: 8, color: theme.text },
              ul: { marginVertical: 6 },
              ol: { marginVertical: 6 },
              li: { marginBottom: 4, color: theme.text },
              strong: { fontWeight: "bold", color: theme.text },
              em: { fontStyle: "italic", color: theme.text },
              pre: {
                backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
                borderRadius: 6,
                padding: 12,
                marginVertical: 12,
              },
              code: {
                backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
                color: "#d63384",
                fontFamily: "monospace",
                fontSize: 14,
                paddingHorizontal: 4,
                borderRadius: 4,
              },
              blockquote: {
                backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
                borderLeftWidth: 4,
                borderLeftColor: theme.primary,
                marginVertical: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 4,
              },
              hr: { borderTopWidth: 1, borderTopColor: theme.border, marginVertical: 15, height: 1 },
              a: { color: theme.primary, textDecorationLine: "underline" },
            }}
          />
          </>
        )
      )}
    </View>
  );
};

export default PostPreview;
