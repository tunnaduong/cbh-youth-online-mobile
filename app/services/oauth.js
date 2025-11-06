import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

// Complete the auth session for proper cleanup
WebBrowser.maybeCompleteAuthSession();

// Store active requests to handle deep links manually
let activeGoogleRequest = null;
let activeFacebookRequest = null;

// OAuth configuration
const GOOGLE_CLIENT_ID =
  "464238880090-1c3s1seien4msnnmqdcu0mp10dacabik.apps.googleusercontent.com";
const FACEBOOK_CLIENT_ID = "585636393835324";

// Redirect URI - sử dụng backend callback URL cho cả Google và Facebook
const REDIRECT_URI = "https://api.chuyenbienhoa.com/v1.0/oauth/callback";

// Track active auth sessions to prevent multiple calls
let activeGoogleAuthSession = false;
let activeFacebookAuthSession = false;

// Google OAuth using Authorization Code flow with PKCE
export const loginWithGoogle = async () => {
  // Prevent multiple simultaneous calls
  if (activeGoogleAuthSession) {
    console.warn(
      "Google OAuth: Session already active, ignoring duplicate call"
    );
    throw new Error("Đang xử lý đăng nhập với Google. Vui lòng đợi...");
  }

  activeGoogleAuthSession = true;
  try {
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

    // Store request for deep link handling
    activeGoogleRequest = request;

    await request.makeAuthUrlAsync(discovery);

    // Store code verifier for manual exchange if needed
    let codeVerifier = null;
    try {
      if (request.codeVerifier) {
        codeVerifier = request.codeVerifier;
      } else if (request._codeVerifier) {
        codeVerifier = request._codeVerifier;
      } else {
        // Try common property names
        for (const prop of [
          "codeVerifier",
          "_codeVerifier",
          "verifier",
          "_verifier",
          "pkce",
          "_pkce",
        ]) {
          if (request[prop]) {
            codeVerifier = request[prop];
            break;
          }
        }
      }
    } catch (e) {
      // Code verifier not accessible, will use backend exchange
    }

    // Store code from deep link if received
    let deepLinkCode = null;

    // Set up deep link listener BEFORE promptAsync
    const deepLinkListener = Linking.addEventListener("url", (event) => {
      try {
        const urlStr = event.url;

        // Check if it's our OAuth deep link
        if (urlStr.includes("com.fatties.youth") && urlStr.includes("oauth")) {
          // Extract query parameters manually
          const queryString = urlStr.split("?")[1] || "";
          const params = new URLSearchParams(queryString);
          const code = params.get("code");
          const error = params.get("error");

          if (code) {
            deepLinkCode = code;
            WebBrowser.maybeCompleteAuthSession();
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    // Handle different result types
    if (result.type === "locked") {
      deepLinkListener.remove();
      activeGoogleRequest = null;
      throw new Error(
        "Đang có một phiên đăng nhập khác đang chạy. Vui lòng đợi hoặc thử lại sau."
      );
    }

    if (result.type === "dismiss") {
      // Wait a bit for deep link to arrive if it hasn't yet
      if (!deepLinkCode) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Check if we got code from deep link listener
      if (deepLinkCode) {
        try {
          let tokenResult;
          if (request && typeof request.exchangeCodeAsync === "function") {
            tokenResult = await request.exchangeCodeAsync(
              { code: deepLinkCode },
              discovery
            );
          } else if (codeVerifier) {
            // Exchange code via backend API (backend has client_secret)
            const { exchangeOAuthCode } = require("./api/Api");

            try {
              const exchangeResponse = await exchangeOAuthCode({
                code: deepLinkCode,
                code_verifier: codeVerifier,
                provider: "google",
              });

              if (!exchangeResponse?.access_token) {
                throw new Error("Backend did not return access_token");
              }

              // Convert to format expected by rest of code
              tokenResult = {
                accessToken: exchangeResponse.access_token,
                idToken: exchangeResponse.id_token || null,
                tokenType: exchangeResponse.token_type || "Bearer",
                expiresIn: exchangeResponse.expires_in,
              };
            } catch (error) {
              throw new Error(
                `Token exchange failed: ${error.message || "Unknown error"}`
              );
            }
          } else {
            throw new Error(
              "Cannot exchange code: exchangeCodeAsync method not available and code verifier not found. Please try again."
            );
          }

          const { accessToken, idToken } = tokenResult;

          if (accessToken) {
            // Continue with user info fetch
            const userInfoResponse = await fetch(
              `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
            );

            if (userInfoResponse.ok) {
              const userInfo = await userInfoResponse.json();

              // Clean up listener before returning
              deepLinkListener.remove();
              activeGoogleRequest = null;

              return {
                provider: "google",
                accessToken: accessToken,
                idToken: idToken || null,
                profile: userInfo,
              };
            }
          }
        } catch (e) {
          // Error processing deep link code
        }
      }

      // Clean up listener if we didn't successfully process the code
      deepLinkListener.remove();
      activeGoogleRequest = null;

      throw new Error(
        "Đăng nhập đã bị hủy hoặc có lỗi xảy ra. Vui lòng thử lại sau."
      );
    }

    if (result.type === "success" && result.params.code) {
      // Exchange authorization code for tokens
      const tokenResult = await request.exchangeCodeAsync(
        {
          code: result.params.code,
        },
        discovery
      );

      const { accessToken, idToken } = tokenResult;

      if (!accessToken) {
        throw new Error("Không thể lấy access token từ Google");
      }

      // Get user info from Google
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );

      if (!userInfoResponse.ok) {
        throw new Error("Không thể lấy thông tin người dùng từ Google");
      }

      const userInfo = await userInfoResponse.json();

      // Clean up listener before returning
      deepLinkListener.remove();
      activeGoogleRequest = null;

      return {
        provider: "google",
        accessToken: accessToken,
        idToken: idToken || null,
        profile: userInfo,
      };
    } else {
      // Clean up listener for other result types
      deepLinkListener.remove();
      activeGoogleRequest = null;
      throw new Error("Đăng nhập với Google thất bại hoặc bị hủy");
    }
  } catch (error) {
    throw error;
  } finally {
    activeGoogleAuthSession = false;
  }
};

// Facebook OAuth using Authorization Code flow
export const loginWithFacebook = async () => {
  // Prevent multiple simultaneous calls
  if (activeFacebookAuthSession) {
    console.warn(
      "Facebook OAuth: Session already active, ignoring duplicate call"
    );
    throw new Error("Đang xử lý đăng nhập với Facebook. Vui lòng đợi...");
  }

  activeFacebookAuthSession = true;
  try {
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

    // Store request for deep link handling
    activeFacebookRequest = request;

    await request.makeAuthUrlAsync(discovery);

    // Store code from deep link if received
    let deepLinkCode = null;

    // Set up deep link listener BEFORE promptAsync
    const deepLinkListener = Linking.addEventListener("url", (event) => {
      try {
        const urlStr = event.url;

        // Check if it's our OAuth deep link
        if (urlStr.includes("com.fatties.youth") && urlStr.includes("oauth")) {
          // Extract query parameters manually
          const queryString = urlStr.split("?")[1] || "";
          const params = new URLSearchParams(queryString);
          const code = params.get("code");
          const error = params.get("error");

          if (code) {
            deepLinkCode = code;
            WebBrowser.maybeCompleteAuthSession();
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    // Clean up listener
    deepLinkListener.remove();
    activeFacebookRequest = null;

    // Handle different result types
    if (result.type === "locked") {
      throw new Error(
        "Đang có một phiên đăng nhập khác đang chạy. Vui lòng đợi hoặc thử lại sau."
      );
    }

    if (result.type === "dismiss") {
      // Wait a bit for deep link to arrive if it hasn't yet
      if (!deepLinkCode) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Check if we got code from deep link listener
      if (deepLinkCode) {
        try {
          // Manually process the code
          const tokenResult = await request.exchangeCodeAsync(
            { code: deepLinkCode },
            discovery
          );

          const { accessToken } = tokenResult;
          if (accessToken) {
            // Continue with user info fetch
            const userInfoResponse = await fetch(
              `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
            );

            if (userInfoResponse.ok) {
              const userInfo = await userInfoResponse.json();
              if (!userInfo.error) {
                return {
                  provider: "facebook",
                  accessToken: accessToken,
                  idToken: null,
                  profile: userInfo,
                };
              }
            }
          }
        } catch (e) {
          // Error processing deep link code
        }
      }

      throw new Error(
        "Đăng nhập đã bị hủy hoặc có lỗi xảy ra. Vui lòng thử lại sau."
      );
    }

    if (result.type === "success" && result.params.code) {
      // Exchange authorization code for tokens
      const tokenResult = await request.exchangeCodeAsync(
        {
          code: result.params.code,
        },
        discovery
      );

      const { accessToken } = tokenResult;

      if (!accessToken) {
        throw new Error("Không thể lấy access token từ Facebook");
      }

      // Get user info from Facebook Graph API
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
      );

      if (!userInfoResponse.ok) {
        throw new Error("Không thể lấy thông tin người dùng từ Facebook");
      }

      const userInfo = await userInfoResponse.json();

      if (userInfo.error) {
        throw new Error(
          userInfo.error.message ||
            "Không thể lấy thông tin người dùng từ Facebook"
        );
      }

      return {
        provider: "facebook",
        accessToken: accessToken,
        idToken: null,
        profile: userInfo,
      };
    } else {
      throw new Error("Đăng nhập với Facebook thất bại hoặc bị hủy");
    }
  } catch (error) {
    throw error;
  } finally {
    activeFacebookAuthSession = false;
  }
};
