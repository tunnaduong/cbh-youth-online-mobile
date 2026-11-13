// Class timetable helpers (same model as vaolop.app and the web's
// src/lib/timetable.js): per weekday a list of blocks, each a lesson
// { type: "hoc", start, end, subject } or a break { type: "nghi", start, end,
// label }, times "HH:MM" in local time.

import { storage } from "../global/storage";

// Monday first, as Vietnamese timetables are written.
export const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
// index = JS Date#getDay() (0 = Sunday)
const DAY_BY_JS_INDEX = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const todayKey = (now = new Date()) => DAY_BY_JS_INDEX[now.getDay()];

export const toSeconds = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
};

export const fromSeconds = (sec) => {
  const s = Math.max(0, Math.min(23 * 3600 + 59 * 60, sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const pad = (n) => String(n).padStart(2, "0");

// 125 → "02:05", 3725 → "01:02:05"
export const formatDuration = (totalSeconds) => {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const sortBlocks = (blocks) =>
  (blocks || []).slice().sort((a, b) => toSeconds(a.start) - toSeconds(b.start));

// Lesson number within the day ("Tiết 3"), breaks get null.
export const withPeriodNumbers = (blocks) => {
  let n = 0;
  return sortBlocks(blocks).map((b) => ({ ...b, period: b.type === "hoc" ? ++n : null }));
};

/**
 * Where "now" falls in today's timetable.
 *   phase: "none" (no lessons today) | "before" | "in" (a block is running) |
 *          "between" (gap between two blocks) | "after"
 *   current, next: blocks (with `period`), or null
 *   elapsed: seconds since current started
 *   remaining: seconds until next starts, or until current ends when it is the
 *              last one; null when the day is over
 *   progress: 0..1 through current
 */
export function computeStatus(schedule, now = new Date()) {
  const blocks = withPeriodNumbers(schedule?.[todayKey(now)]);
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  if (!blocks.length) {
    return { phase: "none", current: null, next: null, elapsed: null, remaining: null, progress: 0, blocks };
  }

  const current = blocks.find((b) => nowSec >= toSeconds(b.start) && nowSec < toSeconds(b.end)) || null;
  const next = blocks.find((b) => toSeconds(b.start) > nowSec && b !== current) || null;

  let phase;
  if (current) phase = "in";
  else if (nowSec < toSeconds(blocks[0].start)) phase = "before";
  else if (next) phase = "between";
  else phase = "after";

  let remaining = null;
  if (next) remaining = toSeconds(next.start) - nowSec;
  else if (current) remaining = toSeconds(current.end) - nowSec;

  let elapsed = null;
  let progress = 0;
  if (current) {
    const start = toSeconds(current.start);
    const length = Math.max(1, toSeconds(current.end) - start);
    elapsed = nowSec - start;
    progress = Math.min(1, elapsed / length);
  }

  return { phase, current, next, elapsed, remaining, progress, blocks };
}

export const blockLabel = (b) => (b?.type === "nghi" ? b.label || "Ra chơi" : b?.subject || "");

// Last schedule loaded from the API, so the screen opens instantly and works
// offline.
const CACHE_KEY = "timetable_cache_v1";

export const readCachedTimetable = () => {
  try {
    const raw = storage.getString(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeCachedTimetable = (payload) => {
  try {
    storage.set(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // cache only
  }
};

/**
 * Parse pasted JSON (vaolop.app export or ours). Returns the schedule object
 * or null. The API does the real validation on save.
 */
export function parseTimetableJson(text) {
  try {
    const parsed = JSON.parse(text);
    const data = parsed && typeof parsed === "object" && parsed.data && !Array.isArray(parsed.data) ? parsed.data : parsed;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (!Object.keys(data).some((k) => DAYS.includes(k))) return null;
    const out = {};
    DAYS.forEach((d) => {
      out[d] = Array.isArray(data[d]) ? data[d] : [];
    });
    return out;
  } catch {
    return null;
  }
}
