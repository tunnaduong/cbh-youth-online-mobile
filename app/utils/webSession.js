import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../services/api/axiosInstance";
import { storage } from "../global/storage";

// The in-app browser (SFSafariViewController / Chrome Custom Tabs) keeps its
// own cookie jar that the app has no way to write into, so a user signed in
// here would otherwise land on the web site signed out. Instead, before
// opening one of our web pages we ask the API for a single-use code and send
// the browser through the web's /auth/set-token page, which swaps the code for
// a session and then continues on to the page that was asked for.
//
// A code rather than the token itself, because the URL ends up in browser
// history (on Android, Chrome's - synced to the user's Google account).

const WEB_HOSTS = ["chuyenbienhoa.com", "www.chuyenbienhoa.com"];
const HANDOFF_TIMEOUT_MS = 4000;

// Each redeemed code mints a new web token, so only hand off once per app
// login rather than on every link tap. Remembers which token was handed off
// (just its tail - enough to tell accounts apart) so signing in as someone
// else, or switching accounts, hands off again.
const HANDED_OFF_KEY = "web_session_handed_off";

const tokenFingerprint = (token) => token.slice(-16);

/**
 * Returns the URL to open for `url` (`parts` being its parseUrlParts result):
 * our /auth/set-token handoff page when it points at the CBH web site and this
 * app login hasn't been handed off yet, otherwise `url` unchanged. Never
 * throws - any failure just opens the plain URL.
 */
export async function withWebSession(url, parts) {
  try {
    if (!parts || parts.scheme !== "https" || parts.userInfo) return url;
    if (!WEB_HOSTS.includes(parts.hostname)) return url;
    // Already on the handoff page (e.g. a shared OAuth link) - leave it be.
    if (parts.path.startsWith("/auth/")) return url;

    const token = await AsyncStorage.getItem("auth_token");
    if (!token) return url;
    if (storage.getString(HANDED_OFF_KEY) === tokenFingerprint(token)) return url;

    const response = await axiosInstance.post("/v1.0/web-session/handoff", null, {
      timeout: HANDOFF_TIMEOUT_MS,
    });
    const code = response?.data?.code;
    if (!code) return url;

    storage.set(HANDED_OFF_KEY, tokenFingerprint(token));
    const returnPath = `${parts.path || "/"}${parts.query}${parts.hash}`;
    return (
      `https://${parts.hostPort}/auth/set-token` +
      `?code=${encodeURIComponent(code)}&return=${encodeURIComponent(returnPath)}`
    );
  } catch {
    return url;
  }
}

