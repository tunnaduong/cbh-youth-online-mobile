import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import i18n from "../i18n";

// Complete the auth session for proper cleanup
WebBrowser.maybeCompleteAuthSession();

// OAuth configuration
const GOOGLE_CLIENT_ID =
  "464238880090-1c3s1seien4msnnmqdcu0mp10dacabik.apps.googleusercontent.com";
const FACEBOOK_CLIENT_ID = "585636393835324";

// Redirect URI - backend callback URL for both Google and Facebook
const REDIRECT_URI = "https://api.chuyenbienhoa.com/v1.0/oauth/callback";

// App's deep link scheme for receiving OAuth callbacks
const APP_SCHEME = "com.fatties.youth";

// Track active auth sessions to prevent multiple calls
let activeGoogleAuthSession = false;
let activeFacebookAuthSession = false;

/**
 * Wait for a deep link matching our OAuth callback.
 * Returns a Promise that resolves with { code, state } when the deep link arrives,
 * or rejects after `timeoutMs` milliseconds.
 *
 * On iOS, when the redirect goes through the backend and then redirects to the
 * app's custom scheme, promptAsync() returns "dismiss". The deep link arrives
 * shortly after via Linking. We use a proper Promise here to avoid the race
 * condition of a fixed setTimeout.
 */
function waitForOAuthDeepLink(provider, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let subscription = null;
    let timer = null;

    const cleanup = () => {
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const onUrl = (event) => {
      if (settled) return;
      try {
        const urlStr = event.url;
        // Match our app's OAuth deep link
        if (urlStr.includes(APP_SCHEME) && urlStr.includes("oauth")) {
          const queryString = urlStr.split("?")[1] || "";
          const params = new URLSearchParams(queryString);
          const code = params.get("code");
          const state = params.get("state");
          const error = params.get("error");

          if (error) {
            settled = true;
            cleanup();
            reject(new Error(error));
            return;
          }

          if (code) {
            settled = true;
            cleanup();
            resolve({ code, state });
            return;
          }
        }
      } catch (e) {
        // Ignore parse errors, keep waiting
      }
    };

    // Also check if there's already a pending URL (iOS may have it queued)
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && !settled) {
        onUrl({ url: initialUrl });
      }
    }).catch(() => {});

    subscription = Linking.addEventListener("url", onUrl);

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("OAuth deep link timeout"));
      }
    }, timeoutMs);
  });
}

/**
 * Exchange an OAuth authorization code for tokens via the backend.
 */
async function exchangeCodeViaBackend(code, codeVerifier, provider) {
  const { exchangeOAuthCode } = require("./api/Api");
  const exchangeResponse = await exchangeOAuthCode({
    code,
    code_verifier: codeVerifier,
    provider,
  });

  if (!exchangeResponse?.access_token) {
    throw new Error("Backend did not return access_token");
  }

  return {
    accessToken: exchangeResponse.access_token,
    idToken: exchangeResponse.id_token || null,
    tokenType: exchangeResponse.token_type || "Bearer",
    expiresIn: exchangeResponse.expires_in,
  };
}

// Google OAuth using Authorization Code flow with PKCE
export const loginWithGoogle = async () => {
  if (activeGoogleAuthSession) {
    throw new Error(i18n.t("auth.googleProcessing"));
  }

  activeGoogleAuthSession = true;
  try {
    console.log("Google OAuth: Starting with redirect URI:", REDIRECT_URI);

    const discovery = {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    };

    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: REDIRECT_URI,
      usePKCE: true,
    });

    // makeAuthUrlAsync triggers ensureCodeIsSetupAsync which populates codeVerifier
    await request.makeAuthUrlAsync(discovery);

    const codeVerifier = request.codeVerifier || null;
    console.log("Google OAuth: codeVerifier present:", !!codeVerifier);

    if (!codeVerifier) {
      throw new Error(
        "PKCE code verifier not available. Cannot securely exchange code."
      );
    }

    // On iOS the backend redirect → custom scheme means promptAsync returns "dismiss".
    // We start the deep link listener BEFORE promptAsync so we never miss it.
    const deepLinkPromise = waitForOAuthDeepLink("google", 10000);

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: Platform.OS === "android",
    });

    console.log("Google OAuth: promptAsync result type:", result.type);

    if (result.type === "locked") {
      throw new Error(i18n.t("auth.sessionInProgress"));
    }

    // "success" path: redirect URI matched directly (rare when using backend redirect URI,
    // but handle it for completeness / Android cases)
    if (result.type === "success" && result.params?.code) {
      console.log("Google OAuth: Got code via success result");
      const tokenResult = await exchangeCodeViaBackend(
        result.params.code,
        codeVerifier,
        "google"
      );
      const userInfo = await fetchGoogleUserInfo(tokenResult.accessToken);
      return {
        provider: "google",
        accessToken: tokenResult.accessToken,
        idToken: tokenResult.idToken,
        profile: userInfo,
      };
    }

    // "dismiss" path (iOS main path): browser closed, wait for deep link
    if (result.type === "dismiss" || result.type === "cancel") {
      console.log(
        "Google OAuth: Browser dismissed, waiting for deep link callback..."
      );
      let deepLinkResult;
      try {
        deepLinkResult = await deepLinkPromise;
      } catch (e) {
        // Deep link timed out or errored — user likely cancelled
        console.log("Google OAuth: Deep link wait failed:", e.message);
        throw new Error(i18n.t("auth.loginCancelled"));
      }

      console.log("Google OAuth: Deep link received, exchanging code...");
      const tokenResult = await exchangeCodeViaBackend(
        deepLinkResult.code,
        codeVerifier,
        "google"
      );
      const userInfo = await fetchGoogleUserInfo(tokenResult.accessToken);
      return {
        provider: "google",
        accessToken: tokenResult.accessToken,
        idToken: tokenResult.idToken,
        profile: userInfo,
      };
    }

    // error or other result type
    throw new Error(i18n.t("auth.googleFailed"));
  } catch (error) {
    throw error;
  } finally {
    activeGoogleAuthSession = false;
  }
};

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
  );
  if (!response.ok) {
    throw new Error(i18n.t("auth.googleUserInfoError"));
  }
  return response.json();
}

// Facebook OAuth using Authorization Code flow
export const loginWithFacebook = async () => {
  if (activeFacebookAuthSession) {
    throw new Error(i18n.t("auth.facebookProcessing"));
  }

  activeFacebookAuthSession = true;
  try {
    console.log("Facebook OAuth: Starting with redirect URI:", REDIRECT_URI);

    const discovery = {
      authorizationEndpoint: "https://www.facebook.com/v18.0/dialog/oauth",
      tokenEndpoint: "https://graph.facebook.com/v18.0/oauth/access_token",
    };

    const request = new AuthSession.AuthRequest({
      clientId: FACEBOOK_CLIENT_ID,
      scopes: ["public_profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: REDIRECT_URI,
      usePKCE: true,
    });

    // makeAuthUrlAsync triggers ensureCodeIsSetupAsync which populates codeVerifier
    await request.makeAuthUrlAsync(discovery);

    const codeVerifier = request.codeVerifier || null;
    console.log("Facebook OAuth: codeVerifier present:", !!codeVerifier);

    if (!codeVerifier) {
      throw new Error(
        "PKCE code verifier not available. Cannot securely exchange code."
      );
    }

    // Start deep link listener before promptAsync to avoid race condition on iOS
    const deepLinkPromise = waitForOAuthDeepLink("facebook", 10000);

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: Platform.OS === "android",
    });

    console.log("Facebook OAuth: promptAsync result type:", result.type);

    if (result.type === "locked") {
      throw new Error(i18n.t("auth.sessionInProgress"));
    }

    // "success" path
    if (result.type === "success" && result.params?.code) {
      console.log("Facebook OAuth: Got code via success result");
      const tokenResult = await exchangeCodeViaBackend(
        result.params.code,
        codeVerifier,
        "facebook"
      );
      const userInfo = await fetchFacebookUserInfo(tokenResult.accessToken);
      return {
        provider: "facebook",
        accessToken: tokenResult.accessToken,
        idToken: null,
        profile: userInfo,
      };
    }

    // "dismiss" path (iOS main path)
    if (result.type === "dismiss" || result.type === "cancel") {
      console.log(
        "Facebook OAuth: Browser dismissed, waiting for deep link callback..."
      );
      let deepLinkResult;
      try {
        deepLinkResult = await deepLinkPromise;
      } catch (e) {
        console.log("Facebook OAuth: Deep link wait failed:", e.message);
        throw new Error(i18n.t("auth.loginCancelled"));
      }

      console.log("Facebook OAuth: Deep link received, exchanging code...");
      const tokenResult = await exchangeCodeViaBackend(
        deepLinkResult.code,
        codeVerifier,
        "facebook"
      );
      const userInfo = await fetchFacebookUserInfo(tokenResult.accessToken);
      return {
        provider: "facebook",
        accessToken: tokenResult.accessToken,
        idToken: null,
        profile: userInfo,
      };
    }

    // error or other result type
    throw new Error(i18n.t("auth.facebookFailed"));
  } catch (error) {
    throw error;
  } finally {
    activeFacebookAuthSession = false;
  }
};

async function fetchFacebookUserInfo(accessToken) {
  const response = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
  );
  if (!response.ok) {
    throw new Error(i18n.t("auth.facebookUserInfoError"));
  }
  const userInfo = await response.json();
  if (userInfo.error) {
    throw new Error(
      userInfo.error.message || i18n.t("auth.facebookUserInfoError")
    );
  }
  return userInfo;
}
