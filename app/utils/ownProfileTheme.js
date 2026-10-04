import { useEffect, useState } from "react";
import { storage } from "../global/storage";
import { getProfile } from "../services/api/Api";

/**
 * The signed-in user's own profile appearance (avatar frame, name style),
 * for places that show "you" outside the profile screen - the sidebar.
 *
 * The login payload doesn't carry it, so it is read from the profile
 * endpoint and kept in MMKV per username: the last known appearance shows at
 * once on the next start, and the appearance editor writes here when it
 * saves, so the sidebar follows without another request.
 */
const key = (username) => `own_profile_theme:${username}`;
// Opening the sidebar asks again at most this often.
const REFRESH_EVERY_MS = 60 * 1000;

const listeners = new Set();
const lastFetch = {};

const read = (username) => {
  if (!username) return null;
  try {
    const raw = storage.getString(key(username));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Called by the appearance editor after a save (null = back to default). */
export function setOwnProfileTheme(username, theme) {
  if (!username) return;
  storage.set(key(username), JSON.stringify(theme || null));
  listeners.forEach((listener) => listener(username));
}

/**
 * @param {string} username  the signed-in user
 * @param {boolean} active   true while the place showing it is on screen;
 *                           each time it becomes true the theme is refreshed
 *                           (at most once a minute)
 * @returns the theme object the API returns as `profile.theme`, or null
 */
export function useOwnProfileTheme(username, active = true) {
  const [theme, setTheme] = useState(() => read(username));

  useEffect(() => {
    setTheme(read(username));
    const listener = (changed) => {
      if (changed === username) setTheme(read(username));
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, [username]);

  useEffect(() => {
    if (!username || !active) return;
    if (Date.now() - (lastFetch[username] || 0) < REFRESH_EVERY_MS) return;
    lastFetch[username] = Date.now();

    getProfile(username)
      .then((response) => setOwnProfileTheme(username, response.data?.profile?.theme || null))
      .catch(() => {
        // Keep showing the cached appearance; try again on the next open.
        lastFetch[username] = 0;
      });
  }, [username, active]);

  return theme;
}
