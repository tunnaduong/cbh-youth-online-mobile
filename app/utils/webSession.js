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

// Every CBH site with an /auth/set-token page that redeems the code. They all
// share one auth_token cookie on .chuyenbienhoa.com, so a handoff through any
// of them signs the user in on all of them.
const WEB_HOSTS = [
  "chuyenbienhoa.com",
  "www.chuyenbienhoa.com",
  "giftshop.chuyenbienhoa.com",
];
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


/**
 * Script for a react-native-webview's injectedJavaScriptBeforeContentLoaded
 * that makes a CBH web page behave as part of the app:
 *
 * - App mode: sets the sessionStorage flag the sites read (alongside
 *   ?app=true) to hide their sign-out, splash and "get the app" prompts -
 *   set on every load so it survives in-site navigation.
 * - Theme: writes `theme` ("light"/"dark") to the keys the main site and the
 *   gift shop read their theme from, before their own scripts run, so they
 *   follow the app's appearance setting.
 * - Login: signs the page in as `token`, the app's current login. Unlike the
 *   in-app browser, the app can run script in its own WebViews, so they get
 *   the token directly - and since this runs on every load with whatever
 *   account is active, switching accounts in the app switches the web too.
 *   It writes the auth_token cookie shared by every *.chuyenbienhoa.com site
 *   and, when that changed what the cookie said, reloads once so the server
 *   render sees the new login as well. A sessionStorage guard stops a cookie
 *   the browser refuses from turning that into a reload loop.
 */
export function webViewBootScript({ token, theme }) {
  return `(function () {
  try {
    if (!/(^|\\.)chuyenbienhoa\\.com$/.test(location.hostname)) return;
    try {
      sessionStorage.setItem("cbh_app_mode", "1");
      localStorage.setItem("theme", ${JSON.stringify(theme)});
      localStorage.setItem("giftshop_theme", ${JSON.stringify(theme)});
    } catch (e) {}

    var token = ${JSON.stringify(token || "")};
    if (!token) return;
    var current = document.cookie.match(/(?:^|; )auth_token=[^;]*/g) || [];
    if (current.length === 1 && current[0].replace(/^(; )?auth_token=/, "") === token) return;

    // A host-only auth_token (left by an older login flow) would sit next to
    // the shared one and the site could read either - drop it first.
    document.cookie = "auth_token=; path=/; max-age=0";
    document.cookie = "auth_token=" + token + "; path=/; domain=.chuyenbienhoa.com; max-age=2592000; samesite=lax; secure";
    try {
      // The main site caches the signed-in user and token here as well.
      if (localStorage.getItem("TOKEN") !== token) localStorage.removeItem("CURRENT_USER");
      localStorage.setItem("TOKEN", token);
    } catch (e) {}

    if (sessionStorage.getItem("cbh_app_token_reload") !== token) {
      sessionStorage.setItem("cbh_app_token_reload", token);
      location.reload();
    }
  } catch (e) {}
})();
true;`;
}
