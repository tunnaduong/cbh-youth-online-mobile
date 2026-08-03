/**
 * YouTube / YouTube Music share URL utilities.
 *
 * Handles the full set of URLs emitted by the YouTube and YouTube Music apps
 * when the user taps "Share":
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://music.youtube.com/watch?v=VIDEO_ID
 *   https://youtube.com/shorts/VIDEO_ID
 */

export const isYouTubeUrl = (text) => {
  if (!text || typeof text !== "string") return false;
  return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/.test(text);
};

export const extractYouTubeId = (url) => {
  if (!url) return null;
  // Covers watch?v=, youtu.be/, embed/, shorts/
  const match = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

// Builds the iframe HTML that the post renderer's custom iframe renderer
// (PostItem.js YouTubeIframeRenderer) already knows how to play.
export const buildYouTubeEmbed = (videoId) => {
  return `<iframe width="100%" height="315" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
};

// Same IFrame-Player-API-backed HTML page as PostItem.js's
// YouTubeIframeRenderer (host/baseUrl both youtube-nocookie.com, same-origin
// per PR #1086's fix for error 152) - kept byte-for-byte identical so a
// preview WebView here behaves exactly like the player shown once the post
// is published, instead of hitting the youtube.com/embed page directly.
export const buildYouTubePlayerHtml = (videoId) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;}#player{position:absolute;top:0;left:0;width:100%;height:100%;}</style>
</head>
<body>
<div id="player"></div>
<script>
  function post(type, data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data || {} }));
    }
  }
  window.onerror = function (message, source, lineno, colno) {
    post('jserror', { message: message, source: source, lineno: lineno, colno: colno });
  };
  post('boot', {});
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  function onYouTubeIframeAPIReady() {
    post('apiready', {});
    new YT.Player('player', {
      videoId: '${videoId}',
      host: 'https://www.youtube-nocookie.com',
      playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: function () { post('ready', {}); },
        onError: function (e) { post('error', { code: e.data }); },
        onStateChange: function (e) { post('statechange', { state: e.data }); }
      }
    });
  }
</script>
</body>
</html>`;

// Returns { videoId, embedHtml } if the text contains a recognizable YouTube
// URL, otherwise null.
export const parseYouTubeShare = (text) => {
  if (!isYouTubeUrl(text)) return null;
  // The shared text may be "Song title – YouTube\nhttps://youtu.be/abc" so
  // scan for the first URL-like token.
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : text;
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  return { videoId, embedHtml: buildYouTubeEmbed(videoId), url };
};

// Finds the first bare (not already inside an <iframe ...>) YouTube link in
// free-form post text and swaps it for the <iframe> tag PostItem's
// YouTubeIframeRenderer knows how to play - the "paste a youtube.com/youtu.be
// link into a post and it auto-embeds" behavior. Text with no YouTube link,
// or one that's already wrapped in an iframe, is returned unchanged.
export const autoEmbedYouTubeLinks = (text) => {
  if (!text || typeof text !== "string" || /<iframe[\s>]/i.test(text)) {
    return text;
  }
  const urlMatch = text.match(/https?:\/\/[^\s<>"']*(?:youtube\.com|youtu\.be)[^\s<>"']*/i);
  if (!urlMatch) return text;
  const videoId = extractYouTubeId(urlMatch[0]);
  if (!videoId) return text;
  return text.slice(0, urlMatch.index) +
    buildYouTubeEmbed(videoId) +
    text.slice(urlMatch.index + urlMatch[0].length);
};

// For content already saved by the backend (e.g. someone else's post) that
// contains a bare YouTube link but was never run through autoEmbedYouTubeLinks
// at creation time: appends the playable <iframe> below the existing content
// instead of touching the link text itself. Used at render time in PostItem,
// so it never mutates what's actually stored server-side.
export const appendYouTubeEmbedBelow = (html) => {
  if (!html || typeof html !== "string" || /<iframe[\s>]/i.test(html)) {
    return html;
  }
  const urlMatch = html.match(/https?:\/\/[^\s<>"']*(?:youtube\.com|youtu\.be)[^\s<>"']*/i);
  if (!urlMatch) return html;
  const videoId = extractYouTubeId(urlMatch[0]);
  if (!videoId) return html;
  return html + buildYouTubeEmbed(videoId);
};
