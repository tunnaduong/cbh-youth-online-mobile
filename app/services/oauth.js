import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

// Complete the auth session for proper cleanup
WebBrowser.maybeCompleteAuthSession();

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
    throw new Error("Đang xử lý đăng nhập với Google. Vui lòng đợi...");
  }

  activeGoogleAuthSession = true;
  try {
    console.log("Google OAuth: Using redirect URI:", REDIRECT_URI);
    console.log("Google OAuth: Client ID (Android):", GOOGLE_CLIENT_ID);

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

    await request.makeAuthUrlAsync(discovery);

    // Store code verifier for manual exchange if needed
    // Try to access code verifier from request (may not be directly accessible)
    let codeVerifier = null;
    try {
      // AuthRequest may store code verifier internally
      // Try to access it if available
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

    // Store code and state from deep link if received
    let deepLinkCode = null;
    let deepLinkState = null;

    // Set up deep link listener BEFORE promptAsync
    const deepLinkListener = Linking.addEventListener("url", (event) => {
      console.log("Google OAuth: Deep link received:", event.url);
      try {
        // Parse deep link manually to handle both formats
        // Format: com.fatties.youth:oauth?code=... or com.fatties.youth://oauth?code=...
        const urlStr = event.url;

        // Check if it's our OAuth deep link
        if (urlStr.includes("com.fatties.youth") && urlStr.includes("oauth")) {
          // Extract query parameters manually
          const queryString = urlStr.split("?")[1] || "";
          const params = new URLSearchParams(queryString);
          const code = params.get("code");
          const state = params.get("state");
          const error = params.get("error");

          console.log("Google OAuth: Parsed deep link:", {
            code: !!code,
            state: !!state,
            error,
            fullUrl: urlStr,
          });

          // Accept code regardless of provider in deep link
          // We know this is Google OAuth from context (we're in loginWithGoogle function)
          if (code) {
            deepLinkCode = code;
            deepLinkState = state;
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
      // Clean up listener
      deepLinkListener.remove();
      throw new Error(
        "Đang có một phiên đăng nhập khác đang chạy. Vui lòng đợi hoặc thử lại sau."
      );
    }

    if (result.type === "dismiss") {
      console.log(
        "Google OAuth: promptAsync returned dismiss, checking for deep link code..."
      );

      // Wait a bit for deep link to arrive if it hasn't yet
      if (!deepLinkCode) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Check if we got code from deep link listener
      // We're in Google OAuth context, so any code received is for Google
      if (deepLinkCode) {
        try {
          // Check if request still has exchangeCodeAsync method
          console.log("Google OAuth: Request object check:", {
            hasRequest: !!request,
            requestType: typeof request,
            hasExchangeCodeAsync:
              typeof request?.exchangeCodeAsync === "function",
            requestMethods: request
              ? Object.getOwnPropertyNames(Object.getPrototypeOf(request))
              : [],
            requestKeys: request ? Object.keys(request) : [],
            hasCodeVerifier: !!codeVerifier,
          });

          // Try to exchange code
          // When using deep link with backend redirect, prefer backend exchange to avoid state mismatch
          // The backend exchange uses code_verifier which doesn't require state verification
          let tokenResult;
          if (codeVerifier) {
            // Exchange code via backend API (backend has client_secret)
            // This avoids state mismatch issues when redirecting through backend
            console.log("Google OAuth: Exchanging code via backend API...");
            console.log(
              "Google OAuth: Code verifier:",
              codeVerifier ? "present" : "missing"
            );
            const { exchangeOAuthCode } = require("./api/Api");

            try {
              const exchangeResponse = await exchangeOAuthCode({
                code: deepLinkCode,
                code_verifier: codeVerifier,
                provider: "google",
              });

              console.log(
                "Google OAuth: Backend exchange response:",
                exchangeResponse
              );
              console.log(
                "Google OAuth: Response keys:",
                Object.keys(exchangeResponse || {})
              );
              console.log("Google OAuth: Token exchange successful:", {
                hasAccessToken: !!exchangeResponse?.access_token,
                hasIdToken: !!exchangeResponse?.id_token,
                tokenType: exchangeResponse?.token_type,
                expiresIn: exchangeResponse?.expires_in,
                fullResponse: exchangeResponse,
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
              console.log("Google OAuth: Token exchange failed:", error);
              console.log("Google OAuth: Error details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
              });
              throw new Error(
                `Token exchange failed: ${error.message || "Unknown error"}`
              );
            }
          } else if (
            request &&
            typeof request.exchangeCodeAsync === "function"
          ) {
            // Fallback: try using exchangeCodeAsync with state if available
            // This may fail with state mismatch when redirecting through backend
            try {
              const exchangeParams = { code: deepLinkCode };
              if (deepLinkState) {
                exchangeParams.state = deepLinkState;
              }
              tokenResult = await request.exchangeCodeAsync(
                exchangeParams,
                discovery
              );
            } catch (exchangeError) {
              // If exchange fails due to state mismatch, throw a clearer error
              if (
                exchangeError.message?.includes("state") ||
                exchangeError.code === "state_mismatch"
              ) {
                throw new Error(
                  "Không thể xác thực đăng nhập. Vui lòng thử lại. (State verification failed)"
                );
              }
              throw exchangeError;
            }
          } else {
            throw new Error(
              "Cannot exchange code: code verifier not found and exchangeCodeAsync method not available. Please try again."
            );
          }

          console.log("Google OAuth: Token exchange result:", {
            hasAccessToken: !!tokenResult.accessToken,
            hasIdToken: !!tokenResult.idToken,
            tokenType: tokenResult.tokenType,
            expiresIn: tokenResult.expiresIn,
          });

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

              return {
                provider: "google",
                accessToken: accessToken,
                idToken: idToken || null,
                profile: userInfo,
              };
            }
          }
        } catch (e) {
          console.log("Google OAuth: Error processing deep link code:", e);
        }
      }

      // Clean up listener if we didn't successfully process the code
      deepLinkListener.remove();

      console.log(
        "Google OAuth: User dismissed or webview closed unexpectedly"
      );
      console.log("Google OAuth: This might be due to:");
      console.log("1. Redirect URI not configured in Google Cloud Console");
      console.log("2. User closed the browser/webview");
      throw new Error(
        "Đăng nhập đã bị hủy hoặc có lỗi xảy ra. Vui lòng thử lại sau."
      );
    }

    if (result.type === "success" && result.params.code) {
      console.log("Google OAuth: Received authorization code");

      // Exchange authorization code for tokens
      const tokenResult = await request.exchangeCodeAsync(
        {
          code: result.params.code,
        },
        discovery
      );

      console.log("Google OAuth: Token exchange result:", {
        hasAccessToken: !!tokenResult.accessToken,
        hasIdToken: !!tokenResult.idToken,
        tokenType: tokenResult.tokenType,
        expiresIn: tokenResult.expiresIn,
      });

      const { accessToken, idToken } = tokenResult;

      if (!accessToken) {
        throw new Error("Không thể lấy access token từ Google");
      }

      // Get user info from Google
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );

      console.log(
        "Google OAuth: User info response status:",
        userInfoResponse.status
      );

      if (!userInfoResponse.ok) {
        throw new Error("Không thể lấy thông tin người dùng từ Google");
      }

      const userInfo = await userInfoResponse.json();
      console.log("Google OAuth: User info received:", {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
      });

      // Clean up listener before returning
      deepLinkListener.remove();

      return {
        provider: "google",
        accessToken: accessToken,
        idToken: idToken || null,
        profile: userInfo,
      };
    } else {
      // Clean up listener for other result types
      deepLinkListener.remove();
      console.log("Google OAuth: Failed or cancelled", {
        type: result.type,
        params: result.params,
        errorCode: result.errorCode,
        error: result.error,
      });
      throw new Error("Đăng nhập với Google thất bại hoặc bị hủy");
    }
  } catch (error) {
    throw error;
  } finally {
    activeGoogleAuthSession = false;
  }
};

// Facebook OAuth using Authorization Code flow (giống Google)
// Chuyển từ Implicit flow vì fragment (#) không được gửi đến server
export const loginWithFacebook = async () => {
  // Prevent multiple simultaneous calls
  if (activeFacebookAuthSession) {
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

    await request.makeAuthUrlAsync(discovery);

    // Store code verifier for manual exchange if needed
    // Try to access code verifier from request (may not be directly accessible)
    let codeVerifier = null;
    try {
      // AuthRequest may store code verifier internally
      // Try to access it if available
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
    let deepLinkProvider = null;

    // Set up deep link listener BEFORE promptAsync
    const deepLinkListener = Linking.addEventListener("url", (event) => {
      try {
        // Parse deep link manually to handle both formats
        // Format: com.fatties.youth:oauth?code=... or com.fatties.youth://oauth?code=...
        const urlStr = event.url;

        // Check if it's our OAuth deep link
        if (urlStr.includes("com.fatties.youth") && urlStr.includes("oauth")) {
          // Extract query parameters manually
          const queryString = urlStr.split("?")[1] || "";
          const params = new URLSearchParams(queryString);
          const code = params.get("code");

          // Accept code regardless of provider in deep link
          // We know this is Facebook OAuth from context (we're in loginWithFacebook function)
          if (code) {
            deepLinkCode = code;
            deepLinkProvider = "facebook"; // Force to facebook since we're in Facebook OAuth flow
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
      // Clean up listener
      deepLinkListener.remove();
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
      // We're in Facebook OAuth context, so any code received is for Facebook
      if (deepLinkCode) {
        try {
          // Try to exchange code - request should still be valid
          // The request object should still have exchangeCodeAsync after promptAsync
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
                provider: "facebook",
              });

              if (!exchangeResponse?.access_token) {
                throw new Error("Backend did not return access_token");
              }

              // Convert to format expected by rest of code
              tokenResult = {
                accessToken: exchangeResponse.access_token,
                idToken: null,
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

          const { accessToken } = tokenResult;
          if (accessToken) {
            // Continue with user info fetch
            const userInfoResponse = await fetch(
              `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
            );

            if (userInfoResponse.ok) {
              const userInfo = await userInfoResponse.json();
              if (!userInfo.error) {
                // Clean up listener before returning
                deepLinkListener.remove();

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

      // Clean up listener if we didn't successfully process the code
      deepLinkListener.remove();

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
