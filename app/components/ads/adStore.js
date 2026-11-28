import { getAds } from "../../services/api/Api";

export const PLACEMENT_FEED_INLINE = "mobile-feed-inline";
export const PLACEMENT_POST_COMMENTS = "mobile-post-comments";

export const DEFAULT_IN_FEED_HTML = `<script>
  atOptions = {
    'key' : 'ddebc5ab971d5273d0fb5a79cbbfe198',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/ddebc5ab971d5273d0fb5a79cbbfe198/invoke.js"></script>`;

export const DEFAULT_COMMENT_HTML = `<script async="async" data-cfasync="false" src="https://pl32171519.profitableratecpmnetwork.com/d75e1be3578406d08612b5cc3623fa29/invoke.js"></script>
<div id="container-d75e1be3578406d08612b5cc3623fa29"></div>`;

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();
const inflight = new Map();

function normalizeAds(payload) {
  const raw = Array.isArray(payload) ? payload : payload?.data || [];
  return raw
    .filter(
      (item) =>
        item &&
        ((typeof item.image_url === "string" && item.image_url.trim()) ||
          (typeof item.html_code === "string" && item.html_code.trim()))
    )
    .map((item, idx) => ({
      ...item,
      key: item.id != null ? `ad-${item.id}` : `ad-idx-${idx}`,
    }));
}

export function invalidatePlacementAds(placement) {
  if (placement) {
    cache.delete(placement);
  } else {
    cache.clear();
  }
}

/**
 * Fetches live creatives for a placement, sharing one in-flight request across
 * all cards mounted on the same screen and caching briefly so scrolling past
 * multiple in-feed slots doesn't hammer `/v1.0/ads`.
 */
export function fetchPlacementAds(placement, { force = false } = {}) {
  const now = Date.now();
  const cached = cache.get(placement);
  if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cached.result);
  }

  if (!force && inflight.has(placement)) {
    return inflight.get(placement);
  }

  const req = getAds(placement)
    .then((res) => {
      const ads = normalizeAds(res?.data);
      const managed = res?.headers?.["x-placement-managed"] === "1";
      const result = { ads, managed };
      cache.set(placement, { result, fetchedAt: Date.now() });
      return result;
    })
    .finally(() => {
      inflight.delete(placement);
    });

  inflight.set(placement, req);
  return req;
}
