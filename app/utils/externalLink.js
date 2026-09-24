import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

// Links typed into posts, comments and chat messages can point anywhere, so
// tapping one doesn't hand the URL straight to the system browser - it opens
// LinkSafetyScreen first, which shows the full destination and makes the user
// confirm. Mirrors the web's /link/<token> interstitial.
//
// The URL travels as base64url in the navigation params (and in the web URL on
// the other side), which keeps the encoded form identical across both apps so
// a link shared from one opens the same warning in the other. base64 rather
// than md5 because the screen has to show the user the actual address - a hash
// can't be turned back into one.

const TRUSTED_HOST_SUFFIXES = ["chuyenbienhoa.com"];
const TRUSTED_HOSTS = ["localhost", "127.0.0.1"];

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Hermes gives us neither btoa/atob nor a guaranteed TextEncoder, so UTF-8 and
// base64 are both done by hand here. Output matches the web helper byte for
// byte.
function utf8Bytes(value) {
  const bytes = [];
  for (let i = 0; i < value.length; i++) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

function utf8String(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    let code;
    let extra;
    if (byte < 0x80) {
      code = byte;
      extra = 0;
    } else if ((byte & 0xe0) === 0xc0) {
      code = byte & 0x1f;
      extra = 1;
    } else if ((byte & 0xf0) === 0xe0) {
      code = byte & 0x0f;
      extra = 2;
    } else if ((byte & 0xf8) === 0xf0) {
      code = byte & 0x07;
      extra = 3;
    } else {
      return null;
    }
    for (let j = 1; j <= extra; j++) {
      const cont = bytes[i + j];
      if (cont === undefined || (cont & 0xc0) !== 0x80) return null;
      code = (code << 6) | (cont & 0x3f);
    }
    i += extra + 1;
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function bytesToBase64Url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += BASE64_ALPHABET[b2 & 0x3f];
  }
  // base64url: "+/" become "-_" and the "=" padding is dropped, so the token is
  // safe to drop into a path segment.
  return out.replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlToBytes(token) {
  const normalized = String(token).replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < normalized.length; i++) {
    const index = BASE64_ALPHABET.indexOf(normalized[i]);
    if (index === -1) return null;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

export function isTrustedHost(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) return false;
  if (TRUSTED_HOSTS.includes(host)) return true;
  return TRUSTED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * Pulls the host, path and scheme out of an absolute http(s) URL without
 * relying on the URL class (react-native's polyfill is incomplete - it doesn't
 * parse hostname/pathname reliably).
 */
export function parseUrlParts(url) {
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(
    String(url || "").trim()
  );
  if (!match) return null;
  const [, scheme, authority, path = "", query = "", hash = ""] = match;
  // Strip any userinfo ("user:pass@") - "google.com@evil.example" is a classic
  // way of making a hostile host look like a familiar one.
  const atIndex = authority.lastIndexOf("@");
  const hostPort = atIndex === -1 ? authority : authority.slice(atIndex + 1);
  const userInfo = atIndex === -1 ? "" : authority.slice(0, atIndex);
  const hostname = hostPort.replace(/:\d+$/, "").toLowerCase();
  if (!hostname) return null;
  return {
    scheme: scheme.toLowerCase(),
    hostname,
    hostPort,
    userInfo,
    path,
    query,
    hash,
  };
}

/** True when the URL leaves CBH Youth Online and the user should be warned. */
export function isExternalUrl(url) {
  const parts = parseUrlParts(url);
  if (!parts) return false;
  return !isTrustedHost(parts.hostname);
}

export function encodeLinkToken(url) {
  return bytesToBase64Url(utf8Bytes(String(url)));
}

/** Decodes a token back to its URL, or null when it isn't a valid http(s) one. */
export function decodeLinkToken(token) {
  if (!token || typeof token !== "string") return null;
  const bytes = base64UrlToBytes(token);
  if (!bytes) return null;
  const decoded = utf8String(bytes);
  if (!decoded) return null;
  const url = decoded.trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Opens an http(s) URL in the in-app browser (SFSafariViewController on iOS,
 * Chrome Custom Tabs on Android) so the user keeps the app's context and can
 * come straight back, instead of being thrown out to Safari/Chrome.
 *
 * `theme` is the object from ThemeContext; passing it tints the browser chrome
 * to match the app. Anything that isn't http(s) - mailto:, tel:, a deep link
 * into another app - has no in-app browser to open in and is handed to the OS.
 */
export function openInAppBrowser(url, theme) {
  const raw = String(url || "").trim();
  if (!raw) return Promise.resolve();
  if (!/^https?:\/\//i.test(raw)) {
    return Linking.openURL(raw).catch(() => {});
  }
  return WebBrowser.openBrowserAsync(raw, {
    toolbarColor: theme?.headerBackground,
    secondaryToolbarColor: theme?.surface,
    controlsColor: theme?.primary,
    dismissButtonStyle: "close",
    enableBarCollapsing: true,
  }).catch(() =>
    // Custom Tabs needs a browser that supports them, and the whole module is
    // missing in Expo Go; falling back keeps the link openable either way.
    Linking.openURL(raw).catch(() => {})
  );
}

/**
 * Opens a link found in user content. Anything on our own domain (and any
 * non-http scheme we'd hand to the OS anyway) opens directly; everything else
 * goes through the warning screen.
 */
export function openExternalLink(navigation, url, theme) {
  const raw = String(url || "").trim();
  if (!raw) return;
  if (!navigation?.navigate || !isExternalUrl(raw)) {
    openInAppBrowser(raw, theme);
    return;
  }
  navigation.navigate("LinkSafetyScreen", { token: encodeLinkToken(raw) });
}
