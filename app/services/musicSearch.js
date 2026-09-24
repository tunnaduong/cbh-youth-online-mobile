/**
 * Soundtrack search for stories.
 *
 * Backed by Apple's public iTunes Search API: it needs no key, and every hit
 * comes with a 30 second preview stream we are allowed to play. Only that
 * preview url is ever stored on a story - we never host or redistribute the
 * audio ourselves.
 */

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

/** How much of the preview plays with a story. */
export const STORY_MUSIC_CLIP_MS = 15000;

/** Ask iTunes for a larger cover than the 100px default it returns. */
const upscaleArtwork = (url) =>
  typeof url === "string" ? url.replace(/\/\d+x\d+bb\./, "/300x300bb.") : null;

/**
 * @param {string} term       What the user typed.
 * @param {object} [options]
 * @param {string} [options.country] Storefront to search (affects catalogue).
 * @param {number} [options.limit]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<{trackId: string, title: string, artist: string, artworkUrl: string|null, previewUrl: string, durationMs: number}>>}
 */
export const searchMusicTracks = async (term, options = {}) => {
  const query = String(term || "").trim();

  if (query.length < 2) return [];

  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: String(options.limit || 25),
    country: options.country || "VN",
  });

  const response = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`, {
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`iTunes search failed with status ${response.status}`);
  }

  const payload = await response.json();

  return (payload?.results || [])
    .filter((track) => Boolean(track?.previewUrl))
    .map((track) => ({
      trackId: String(track.trackId ?? track.collectionId ?? track.previewUrl),
      title: track.trackName || "",
      artist: track.artistName || "",
      artworkUrl: upscaleArtwork(track.artworkUrl100 || track.artworkUrl60),
      previewUrl: track.previewUrl,
      durationMs: Number(track.trackTimeMillis) || 0,
    }));
};

/** Shape a picked track into the payload the API stores on a story. */
export const toStoryMusicPayload = (track) => ({
  provider: "itunes",
  track_id: track.trackId ? String(track.trackId) : null,
  title: track.title || "",
  artist: track.artist || "",
  artwork_url: track.artworkUrl || null,
  preview_url: track.previewUrl,
  start_ms: Math.max(0, Math.round(track.startMs || 0)),
  duration_ms: Math.round(track.durationMs || STORY_MUSIC_CLIP_MS),
});
