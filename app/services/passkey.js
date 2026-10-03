import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import * as Api from "./api/ApiByAxios";

// Same deep link scheme the OAuth flow uses (services/oauth.js).
const APP_SCHEME = "com.fatties.youth";
const WEB_URL = "https://chuyenbienhoa.com";

/**
 * Log in with a passkey: fingerprint / face / screen lock, nothing to type
 * and no two-factor step.
 *
 * The app has no native passkey module, so the prompt runs on the web site
 * in the system's auth browser (which supports passkeys). To keep the token
 * out of that browser, this works like OAuth's PKCE:
 *   1. the app makes a random secret and sends only its sha256 to the page;
 *   2. the page verifies the passkey with the API and gets a one-time code,
 *      which it hands back through the app's deep link;
 *   3. the app exchanges the code plus the secret for the login.
 * A code intercepted by another app is useless without the secret.
 *
 * Resolves to the API's login payload ({ token, user }), or null when the
 * user closed the browser.
 */
export async function loginWithPasskey() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verifier = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const appChallenge = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier
  );

  // In the fragment, so it is never sent to (or logged by) the web server.
  const url = `${WEB_URL}/auth/passkey#app_challenge=${appChallenge}&scheme=${encodeURIComponent(APP_SCHEME)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, `${APP_SCHEME}://passkey`);

  if (result.type !== "success" || !result.url) {
    return null;
  }

  const match = result.url.match(/[?&]code=([^&#]+)/);
  if (!match) {
    throw new Error("Missing passkey code");
  }

  const response = await Api.postRequest("/v1.0/login/passkey/redeem", {
    code: decodeURIComponent(match[1]),
    verifier,
  });

  return response.data;
}
