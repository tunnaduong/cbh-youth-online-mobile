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
