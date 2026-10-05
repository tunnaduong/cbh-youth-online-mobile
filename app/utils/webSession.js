import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../services/api/axiosInstance";
import * as Application from "expo-application";
import { storage } from "../global/storage";

// Signs CBH web pages opened from the app in as the app's current account -
// and keeps them from staying signed in as anyone else.
//
// The app can't write cookies into the in-app browser (SFSafariViewController
// / Chrome Custom Tabs), and its own WebViews keep a separate cookie store
// too. So before opening one of our pages it asks the API for a single-use
// code and sends the page through the site's /auth/set-token, which swaps the
// code for a session of its own and continues to the page asked for. A code
// rather than a token, because the URL ends up in browser history (on
// Android, Chrome's - synced to the user's Google account). A session of its
// own rather than the app's token, so the logged-in devices list shows the
// browser/WebView as its own entry instead of the app's entry flipping to
// "web" whenever a page makes a request.
//
// When the app has no signed-in account (signed out, or "add account"), the
// next page goes through /auth/set-token?logout=1 instead, which drops the
// web session (and revokes it if the app had handed it over).

// Every CBH site with an /auth/set-token page. They all share one auth_token
// cookie on .chuyenbienhoa.com, so a handoff through any of them signs the
// user in on all of them.
const WEB_HOSTS = [
  "chuyenbienhoa.com",
  "www.chuyenbienhoa.com",
  "giftshop.chuyenbienhoa.com",
];
// How long to wait for the code. The in-app browser opens the page signed out
// rather than keep the user waiting; a WebView screen shows its own spinner
// meanwhile and is useless signed out, so it waits longer (the first request
// after a login competes with everything else the app loads then).
const HANDOFF_TIMEOUT_MS = { browser: 4000, webview: 15000 };

// Each redeemed code mints a new web token, so only hand off once per app
// login rather than on every page. Remembers which token was handed off
// (just its tail - enough to tell accounts apart) so signing in as someone
// else, or switching accounts, hands off again. One key per cookie store:
// the in-app browser and the app's WebViews don't share cookies.
const HANDED_OFF_KEYS = {
  browser: "web_session_handed_off",
  webview: "webview_session_handed_off",
};

// Kept across a sign-out (AuthContext): they are what tells the next page
// opened in that store to sign out first.
export const WEB_SESSION_KEYS = Object.values(HANDED_OFF_KEYS);

const tokenFingerprint = (token) => token.slice(-16);

/**
 * Returns the URL to open for `url` (`parts` being its parseUrlParts result)
 * in the given cookie store (`"browser"` or `"webview"`): the site's
 * /auth/set-token handoff when that store isn't signed in as the current
 * account yet, its ?logout=1 when the app has no account but the store may
 * still hold a session, otherwise `url` unchanged. Never throws - any failure
 * just opens the plain URL.
 *
 * `force`: hand off even though this store is remembered as signed in - for
 * when the page turned out not to be (see isWebLoginUrl).
 */
export async function sessionEntryUrl(url, parts, store = "browser", { force = false } = {}) {
  try {
    if (!parts || parts.scheme !== "https" || parts.userInfo) return url;
    if (!WEB_HOSTS.includes(parts.hostname)) return url;
    // Already on the handoff page (e.g. a shared OAuth link) - leave it be.
    if (parts.path.startsWith("/auth/")) return url;

    const key = HANDED_OFF_KEYS[store] || HANDED_OFF_KEYS.browser;
    const handedOff = storage.getString(key);
    const returnPath = encodeURIComponent(`${parts.path || "/"}${parts.query}${parts.hash}`);
    const setTokenUrl = `https://${parts.hostPort}/auth/set-token`;
    const token = await AsyncStorage.getItem("auth_token");

    if (!token) {
      if (!handedOff) return url;
      storage.delete(key);
      return `${setTokenUrl}?logout=1&return=${returnPath}`;
    }
    if (!force && handedOff === tokenFingerprint(token)) return url;

    let code = null;
    try {
      const response = await axiosInstance.post("/v1.0/web-session/handoff", null, {
        timeout: HANDOFF_TIMEOUT_MS[store] || HANDOFF_TIMEOUT_MS.browser,
      });
      code = response?.data?.code || null;
    } catch {}

    if (!code) {
      // No code (offline, API down). If this store was signed in as another
      // account, sign it out rather than open the page as that account;
      // otherwise just open the page signed out.
      if (!handedOff) return url;
      storage.delete(key);
      return `${setTokenUrl}?logout=1&return=${returnPath}`;
    }

    storage.set(key, tokenFingerprint(token));
    return `${setTokenUrl}?code=${encodeURIComponent(code)}&return=${returnPath}`;
  } catch {
    return url;
  }
}

// The main site's login page: a page load that ends there is a signed-out
// visitor (the gift shop sends its own there too).
const LOGIN_PATH = /^\/login\/?$/;
// Login pages as the page itself sees them. /admin/login is also passed
// through for a moment by a signed-in admin, so the page only reports it
// after staying there (see webViewBootScript).
const LOGIN_PAGE_PATH = /^\/(admin\/)?login\/?$/;

/**
 * Is this one of our sites' login pages? A WebView of a signed-in app that
 * lands there was not signed in by the handoff (the code never arrived, or
 * the page lost its session): the screen hands off again instead of showing
 * a login form to someone who is already logged in.
 */
export function isWebLoginUrl(parts) {
  return (
    !!parts &&
    parts.scheme === "https" &&
    WEB_HOSTS.includes(parts.hostname) &&
    LOGIN_PATH.test(parts.path || "")
  );
}

// What a page posts to the WebView when it finds itself on a login page (see
// webViewBootScript): the sites move there without loading a new page, which
// the WebView's own navigation events do not always report.
export const WEB_LOGIN_PAGE_MESSAGE = "cbh:login-page";

// What a page posts when it has loaded without a session cookie. Pages that
// work signed out too (a game) never show a login form, so this is how the
// app learns that the handoff did not take there.
export const WEB_SIGNED_OUT_MESSAGE = "cbh:signed-out";

/** Is the app signed in? (Only then is a signed-out page worth a retry.) */
export async function appHasAccount() {
  try {
    return !!(await AsyncStorage.getItem("auth_token"));
  } catch {
    return false;
  }
}

/** sessionEntryUrl for the in-app browser. */
export function withWebSession(url, parts) {
  return sessionEntryUrl(url, parts, "browser");
}

// Appended to the user agent of the app's WebViews (applicationNameForUserAgent)
// so the sites can tell the WebView apart - the devices list labels its
// session "WebView trong ứng dụng CBH Youth". The "(+url)" part follows
// OpenStreetMap's tile policy, which wants a User-Agent that names the app
// and how to reach it - the gift shop's map loads its tiles from OSM.
export const WEBVIEW_USER_AGENT_SUFFIX = `CBHYouthApp/${
  Application.nativeApplicationVersion || "0"
} (+https://chuyenbienhoa.com)`;

/**
 * Script for a react-native-webview's injectedJavaScriptBeforeContentLoaded
 * that makes a CBH web page behave as part of the app. Runs on every load,
 * before the page's own scripts:
 *
 * - App mode: sets the sessionStorage flag the sites read (alongside
 *   ?app=true) to hide their sign-out, splash and "get the app" prompts.
 * - Theme: writes `theme` ("light"/"dark") to the keys the main site and the
 *   gift shop read their theme from, so they follow the app's appearance.
 * - Drops a host-only auth_token: older app versions put the app's own token
 *   there; the real web session is the shared .chuyenbienhoa.com cookie that
 *   /auth/set-token sets (see sessionEntryUrl).
 * - Tells the app when the page ends up on a login form (see isWebLoginUrl)
 *   or has loaded without a session (WEB_SIGNED_OUT_MESSAGE).
 */
export function webViewBootScript({ theme }) {
  return `(function () {
  try {
    if (!/(^|\\.)chuyenbienhoa\\.com$/.test(location.hostname)) return;
    document.cookie = "auth_token=; path=/; max-age=0";
    sessionStorage.setItem("cbh_app_mode", "1");
    localStorage.setItem("theme", ${JSON.stringify(theme)});
    localStorage.setItem("giftshop_theme", ${JSON.stringify(theme)});
  } catch (e) {}
  try {
    var told = false;
    var seen = 0;
    var loginPath = new RegExp(${JSON.stringify(LOGIN_PAGE_PATH.source)});
    setInterval(function () {
      if (told || !window.ReactNativeWebView) return;
      // Still there after a second: not just passing through.
      seen = loginPath.test(location.pathname) ? seen + 1 : 0;
      if (seen >= 3) {
        told = true;
        window.ReactNativeWebView.postMessage(${JSON.stringify(WEB_LOGIN_PAGE_MESSAGE)});
      }
    }, 400);
    // Once the page has settled. Not on /auth/ pages: /auth/set-token is
    // where the session gets set.
    setTimeout(function () {
      if (!window.ReactNativeWebView || location.pathname.indexOf("/auth/") === 0) return;
      if (("; " + document.cookie).indexOf("; auth_token=") === -1) {
        window.ReactNativeWebView.postMessage(${JSON.stringify(WEB_SIGNED_OUT_MESSAGE)});
      }
    }, 1500);
  } catch (e) {}
})();
true;`;
}
