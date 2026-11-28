import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../../contexts/ThemeContext";
import { openInAppBrowser } from "../../utils/externalLink";
import MediaShimmer from "../MediaShimmer";

const AD_BASE_URL = "https://chuyenbienhoa.com";

function buildAdDocument({ htmlCode, isDarkMode, centered, autoHeight }) {
  const textColor = isDarkMode ? "#F3F4F6" : "#111827";
  const bodyCss = centered
    ? `display:flex;justify-content:center;align-items:center;min-height:100%;`
    : `width:100%;`;

  const heightScript = autoHeight
    ? `
    (function() {
      var lastH = 0;
      function sendHeight() {
        var root = document.getElementById('ad-root');
        var h = Math.max(
          root ? Math.ceil(root.scrollHeight) : 0,
          document.body ? Math.ceil(document.body.scrollHeight) : 0
        );
        if (h > 40 && Math.abs(h - lastH) > 4 && window.ReactNativeWebView) {
          lastH = h;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
        }
      }
      window.addEventListener('load', sendHeight);
      if (typeof ResizeObserver !== 'undefined') {
        try {
          var ro = new ResizeObserver(sendHeight);
          ro.observe(document.body);
          var r = document.getElementById('ad-root');
          if (r) ro.observe(r);
        } catch (e) {}
      }
      if (typeof MutationObserver !== 'undefined') {
        try {
          var mo = new MutationObserver(sendHeight);
          mo.observe(document.body, { childList: true, subtree: true, attributes: true });
        } catch (e) {}
      }
      var ticks = 0;
      var iv = setInterval(function() {
        sendHeight();
        ticks++;
        if (ticks >= 15) clearInterval(iv);
      }, 1000);
      setTimeout(sendHeight, 300);
    })();
    `
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: transparent;
      color: ${textColor};
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body { ${bodyCss} }
    #ad-root {
      width: 100%;
      ${centered ? "display:flex;justify-content:center;align-items:center;" : ""}
    }
    img { max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body>
  <div id="ad-root">${htmlCode}</div>
  <script>
    (function() {
      var origOpen = window.open;
      window.open = function(url) {
        if (url && /^https?:\\/\\//i.test(String(url)) && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open', url: String(url) }));
          return null;
        }
        return origOpen ? origOpen.apply(window, arguments) : null;
      };
      document.addEventListener('click', function(e) {
        var el = e.target;
        while (el && el.tagName !== 'A') el = el.parentElement;
        if (el && el.href && /^https?:\\/\\//i.test(el.href) && window.ReactNativeWebView) {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open', url: el.href }));
        }
      }, true);
    })();
    ${heightScript}
  </script>
</body>
</html>`;
}

/**
 * Lazily renders an HTML/script ad creative (e.g. Adsterra 300x250 or Native
 * Banner) inside a WebView only once `isVisible` becomes true. Intercepts ad
 * clicks and opens destinations in the in-app browser instead of trapping the
 * user inside the small ad frame.
 */
const AdHtmlView = React.memo(
  ({
    htmlCode,
    isVisible = false,
    width,
    height = 250,
    autoHeight = false,
    minHeight = 140,
    maxHeight = 540,
    centered = false,
    onAdClick,
    style,
  }) => {
    const { theme, isDarkMode } = useTheme();
    const [loaded, setLoaded] = useState(false);
    const [measuredHeight, setMeasuredHeight] = useState(height);

    const html = useMemo(
      () =>
        buildAdDocument({
          htmlCode: htmlCode || "",
          isDarkMode,
          centered,
          autoHeight,
        }),
      [htmlCode, isDarkMode, centered, autoHeight]
    );

    const openAdDestination = useCallback(
      (url) => {
        if (!url || !/^https?:\/\//i.test(url)) return;
        onAdClick?.();
        openInAppBrowser(url, theme);
      },
      [onAdClick, theme]
    );

    const handleMessage = useCallback(
      (event) => {
        try {
          const msg = JSON.parse(event?.nativeEvent?.data || "{}");
          if (msg.type === "height" && autoHeight) {
            const nextH = Math.max(minHeight, Math.min(maxHeight, Number(msg.height) || height));
            setMeasuredHeight((prev) => (Math.abs(prev - nextH) > 4 ? nextH : prev));
          } else if (msg.type === "open" && msg.url) {
            openAdDestination(msg.url);
          }
        } catch {}
      },
      [autoHeight, minHeight, maxHeight, height, openAdDestination]
    );

    const handleShouldStartLoad = useCallback(
      (request) => {
        const url = String(request?.url || "");
        if (!url || url === "about:blank" || url.startsWith("data:") || url.startsWith("javascript:")) {
          return true;
        }
        // Allow initial baseUrl document load.
        if (url === AD_BASE_URL || url === `${AD_BASE_URL}/`) {
          return true;
        }
        // Allow sub-frame loads (Adsterra iframe units) unless triggered by a click.
        if (request?.isTopFrame === false) {
          return true;
        }
        if (request?.navigationType === "click") {
          openAdDestination(url);
          return false;
        }
        // On Android, `navigationType` is often "other" for link clicks on top frame.
        if (request?.isTopFrame && /^https?:\/\//i.test(url) && !url.startsWith(AD_BASE_URL)) {
          openAdDestination(url);
          return false;
        }
        return true;
      },
      [openAdDestination]
    );

    const handleOpenWindow = useCallback(
      (syntheticEvent) => {
        const targetUrl = syntheticEvent?.nativeEvent?.targetUrl;
        if (targetUrl) {
          openAdDestination(targetUrl);
        }
      },
      [openAdDestination]
    );

    const resolvedHeight = autoHeight ? measuredHeight : height;
    const containerStyle = [
      styles.container,
      {
        width: width ?? "100%",
        height: resolvedHeight,
        backgroundColor: isDarkMode ? "#1A1B20" : "#F5F6F8",
      },
      style,
    ];

    if (!isVisible) {
      return (
        <View style={containerStyle}>
          <MediaShimmer />
        </View>
      );
    }

    return (
      <View style={containerStyle}>
        {!loaded && <MediaShimmer />}
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: AD_BASE_URL }}
          style={[styles.webview, { opacity: loaded ? 1 : 0 }]}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback
          scrollEnabled={false}
          nestedScrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          setSupportMultipleWindows={false}
          onMessage={handleMessage}
          onOpenWindow={handleOpenWindow}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onLoadEnd={() => setLoaded(true)}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 10,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default AdHtmlView;
