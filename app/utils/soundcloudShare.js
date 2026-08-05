/**
 * SoundCloud share URL utilities.
 *
 * Mirrors youtubeShare.js, but for SoundCloud track/set (playlist) URLs
 * shared from the SoundCloud app, e.g.:
 *   https://soundcloud.com/artist/track-name
 *   https://soundcloud.com/artist/sets/playlist-name
 *
 * Unlike YouTube, SoundCloud's own widget iframe
 * (https://w.soundcloud.com/player/?url=...) is already a complete player
 * page - there's no need for a buildYouTubePlayerHtml-style custom HTML
 * wrapper loaded through an IFrame Player API.
 */

export const isSoundCloudUrl = (text) => {
  if (!text || typeof text !== "string") return false;
  return /soundcloud\.com/.test(text);
};

// Matches SoundCloud track and set (playlist) URLs. Returns the full URL
// string (not just an ID - SoundCloud's widget embed needs the whole URL),
// or null if none found.
export const extractSoundCloudUrl = (text) => {
  if (!text) return null;
  const match = text.match(
    /(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w-]+\/(?:sets\/)?[\w-]+/i
  );
  return match ? match[0] : null;
};

// Builds the iframe HTML that plays a SoundCloud track/set via SoundCloud's
// own widget player - no custom renderer support needed beyond loading the
// src URL as-is (see PostItem.js's YouTubeIframeRenderer SoundCloud branch).
export const buildSoundCloudEmbed = (trackUrl) => {
  return `<iframe width="100%" height="166" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true"></iframe>`;
};

// Returns { trackUrl, embedHtml } if the text contains a recognizable
// SoundCloud URL, otherwise null.
export const parseSoundCloudShare = (text) => {
  if (!isSoundCloudUrl(text)) return null;
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : text;
  const trackUrl = extractSoundCloudUrl(url);
  if (!trackUrl) return null;
  return { trackUrl, embedHtml: buildSoundCloudEmbed(trackUrl), url: trackUrl };
};

// Finds the first bare (not already inside an <iframe ...>) SoundCloud link
// in free-form post text and swaps it for the <iframe> tag PostItem's
// YouTubeIframeRenderer (SoundCloud branch) knows how to play - the "paste a
// soundcloud.com link into a post and it auto-embeds" behavior. Text with no
// SoundCloud link, or one that's already wrapped in an iframe, is returned
// unchanged.
export const autoEmbedSoundCloudLinks = (text) => {
  if (!text || typeof text !== "string" || /<iframe[\s>]/i.test(text)) {
    return text;
  }
  const urlMatch = text.match(
    /https?:\/\/[^\s<>"']*soundcloud\.com\/[^\s<>"']*/i
  );
  if (!urlMatch) return text;
  const trackUrl = extractSoundCloudUrl(urlMatch[0]);
  if (!trackUrl) return text;
  return text.slice(0, urlMatch.index) +
    buildSoundCloudEmbed(trackUrl) +
    text.slice(urlMatch.index + urlMatch[0].length);
};

// For content already saved by the backend (e.g. someone else's post) that
// contains a bare SoundCloud link but was never run through
// autoEmbedSoundCloudLinks at creation time: appends the playable <iframe>
// below the existing content instead of touching the link text itself. Used
// at render time in PostItem, so it never mutates what's actually stored
// server-side.
export const appendSoundCloudEmbedBelow = (html) => {
  if (!html || typeof html !== "string" || /<iframe[\s>]/i.test(html)) {
    return html;
  }
  const urlMatch = html.match(
    /https?:\/\/[^\s<>"']*soundcloud\.com\/[^\s<>"']*/i
  );
  if (!urlMatch) return html;
  const trackUrl = extractSoundCloudUrl(urlMatch[0]);
  if (!trackUrl) return html;
  return html + buildSoundCloudEmbed(trackUrl);
};
