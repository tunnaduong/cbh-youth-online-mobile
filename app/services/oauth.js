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

    // Store request for deep link handling
    activeGoogleRequest = request;

    // Log the authorization URL that will be opened
    const authUrl = await request.makeAuthUrlAsync(discovery);
    console.log("Google OAuth: Authorization URL:", authUrl);

    // Store code from deep link if received
    let deepLinkCode = null;

    // Set up deep link listener BEFORE promptAsync
    const deepLinkListener = Linking.addEventListener("url", (event) => {
      console.log("Google OAuth: Deep link received:", event.url);
      try {
        // Handle both formats: com.fatties.youth:oauth and com.fatties.youth://oauth
        // Android browser may strip trailing slashes, so we need to handle both
        let urlStr = event.url;
        if (urlStr.startsWith("com.fatties.youth://")) {
          urlStr = urlStr.replace("com.fatties.youth://", "https://");
        } else if (urlStr.startsWith("com.fatties.youth:")) {
          urlStr = urlStr.replace("com.fatties.youth:", "https://");
        }

        const url = new URL(urlStr);
        if (url.pathname === "/oauth" || url.pathname === "oauth") {
          const code = url.searchParams.get("code");
          const provider = url.searchParams.get("provider");
          const error = url.searchParams.get("error");

          console.log("Google OAuth: Parsed deep link:", {
            code: !!code,
            provider,
            error,
            pathname: url.pathname,
          });

          // Accept code regardless of provider in deep link
          // We know this is Google OAuth from context (we're in loginWithGoogle function)
          if (code) {
            console.log(
              "Google OAuth: Storing code from deep link for processing..."
            );
            deepLinkCode = code;
            WebBrowser.maybeCompleteAuthSession();
          }
        }
      } catch (e) {
        console.log("Google OAuth: Error parsing deep link:", e);
      }
    });

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    // Clean up listener
    deepLinkListener.remove();
    activeGoogleRequest = null;

    console.log("Google OAuth promptAsync result:", {
      type: result.type,
      params: result.params,
      errorCode: result.errorCode,
      error: result.error,
    });

    // Handle different result types
    if (result.type === "locked") {
      console.log("Google OAuth: Session is locked");
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
        console.log("Google OAuth: Found code from deep link, processing...");
        try {
          // Manually process the code
          const tokenResult = await request.exchangeCodeAsync(
            { code: deepLinkCode },
            discovery
          );

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

            console.log(
              "Google OAuth: User info response status:",
              userInfoResponse.status
            );

            if (userInfoResponse.ok) {
              const userInfo = await userInfoResponse.json();
              console.log("Google OAuth: User info received:", {
                id: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
              });

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
        console.log("Google OAuth: No access token received", tokenResult);
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
        const errorText = await userInfoResponse.text();
        console.log("Google OAuth: Failed to get user info", {
          status: userInfoResponse.status,
          statusText: userInfoResponse.statusText,
          error: errorText,
        });
        throw new Error("Không thể lấy thông tin người dùng từ Google");
      }

      const userInfo = await userInfoResponse.json();
      console.log("Google OAuth: User info received:", {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
      });

      return {
        provider: "google",
        accessToken: accessToken,
        idToken: idToken || null,
        profile: userInfo,
      };
    } else {
      console.log("Google OAuth: Failed or cancelled", {
        type: result.type,
        params: result.params,
        errorCode: result.errorCode,
        error: result.error,
      });
      throw new Error("Đăng nhập với Google thất bại hoặc bị hủy");
    }
  } catch (error) {
    console.log("Google OAuth: Error details:", {
      message: error.message,
      stack: error.stack,
      error: error,
    });
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
    console.warn(
      "Facebook OAuth: Session already active, ignoring duplicate call"
    );
    throw new Error("Đang xử lý đăng nhập với Facebook. Vui lòng đợi...");
  }

  activeFacebookAuthSession = true;
  try {
    console.log("Facebook OAuth: Using redirect URI:", REDIRECT_URI);
    console.log("Facebook OAuth: Client ID:", FACEBOOK_CLIENT_ID);

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

    // Log the authorization URL that will be opened
    const authUrl = await request.makeAuthUrlAsync(discovery);
    console.log("Facebook OAuth: Authorization URL:", authUrl);

    console.log("Facebook OAuth: About to call promptAsync...");
    console.log("Facebook OAuth: Request config:", {
      clientId: FACEBOOK_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      responseType: "code",
      usePKCE: true,
    });

    // Store code from deep link if received
    let deepLinkCode = null;
    let deepLinkProvider = null;

    // Set up deep link listener BEFORE promptAsync
    const deepLinkListener = Linking.addEventListener("url", (event) => {
      console.log("Facebook OAuth: Deep link received:", event.url);
      try {
        // Handle both formats: com.fatties.youth:oauth and com.fatties.youth://oauth
        // Android browser may strip trailing slashes, so we need to handle both
        let urlStr = event.url;
        if (urlStr.startsWith("com.fatties.youth://")) {
          urlStr = urlStr.replace("com.fatties.youth://", "https://");
        } else if (urlStr.startsWith("com.fatties.youth:")) {
          urlStr = urlStr.replace("com.fatties.youth:", "https://");
        }

        const url = new URL(urlStr);
        if (url.pathname === "/oauth" || url.pathname === "oauth") {
          const code = url.searchParams.get("code");
          const provider = url.searchParams.get("provider");
          const error = url.searchParams.get("error");

          console.log("Facebook OAuth: Parsed deep link:", {
            code: !!code,
            provider,
            error,
            pathname: url.pathname,
          });

          // Accept code regardless of provider in deep link
          // We know this is Facebook OAuth from context (we're in loginWithFacebook function)
          if (code) {
            console.log(
              "Facebook OAuth: Storing code from deep link for processing..."
            );
            deepLinkCode = code;
            deepLinkProvider = "facebook"; // Force to facebook since we're in Facebook OAuth flow
            WebBrowser.maybeCompleteAuthSession();
          }
        }
      } catch (e) {
        console.log("Facebook OAuth: Error parsing deep link:", e);
      }
    });

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    // Clean up listener
    deepLinkListener.remove();
    activeFacebookRequest = null;

    console.log("Facebook OAuth promptAsync result:", {
      type: result.type,
      params: result.params,
      errorCode: result.errorCode,
      error: result.error,
      url: result.url,
    });

    // Handle different result types
    if (result.type === "locked") {
      console.log("Facebook OAuth: Session is locked");
      throw new Error(
        "Đang có một phiên đăng nhập khác đang chạy. Vui lòng đợi hoặc thử lại sau."
      );
    }

    if (result.type === "dismiss") {
      console.log(
        "Facebook OAuth: promptAsync returned dismiss, checking for deep link code..."
      );

      // Wait a bit for deep link to arrive if it hasn't yet
      if (!deepLinkCode) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Check if we got code from deep link listener
      // We're in Facebook OAuth context, so any code received is for Facebook
      if (deepLinkCode) {
        console.log("Facebook OAuth: Found code from deep link, processing...");
        try {
          // Manually process the code
          const tokenResult = await request.exchangeCodeAsync(
            { code: deepLinkCode },
            discovery
          );

          console.log("Facebook OAuth: Token exchange result:", {
            hasAccessToken: !!tokenResult.accessToken,
            tokenType: tokenResult.tokenType,
            expiresIn: tokenResult.expiresIn,
          });

          const { accessToken } = tokenResult;
          if (accessToken) {
            // Continue with user info fetch
            const userInfoResponse = await fetch(
              `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
            );

            console.log(
              "Facebook OAuth: User info response status:",
              userInfoResponse.status
            );

            if (userInfoResponse.ok) {
              const userInfo = await userInfoResponse.json();
              if (!userInfo.error) {
                console.log("Facebook OAuth: User info received:", {
                  id: userInfo.id,
                  email: userInfo.email,
                  name: userInfo.name,
                });

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
          console.log("Facebook OAuth: Error processing deep link code:", e);
        }
      }

      console.log(
        "Facebook OAuth: User dismissed or webview closed unexpectedly"
      );
      console.log("Facebook OAuth: This might be due to:");
      console.log("1. Redirect URI not configured in Facebook App Settings");
      console.log(
        "2. Facebook not accepting Authorization Code flow for mobile"
      );
      console.log("3. User closed the browser/webview");
      throw new Error(
        "Đăng nhập đã bị hủy hoặc có lỗi xảy ra. Vui lòng thử lại sau."
      );
    }

    if (result.type === "success" && result.params.code) {
      console.log("Facebook OAuth: Received authorization code");

      // Exchange authorization code for tokens
      const tokenResult = await request.exchangeCodeAsync(
        {
          code: result.params.code,
        },
        discovery
      );

      console.log("Facebook OAuth: Token exchange result:", {
        hasAccessToken: !!tokenResult.accessToken,
        tokenType: tokenResult.tokenType,
        expiresIn: tokenResult.expiresIn,
      });

      const { accessToken } = tokenResult;

      if (!accessToken) {
        console.log("Facebook OAuth: No access token received", tokenResult);
        throw new Error("Không thể lấy access token từ Facebook");
      }

      // Get user info from Facebook Graph API
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
      );

      console.log(
        "Facebook OAuth: User info response status:",
        userInfoResponse.status
      );

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.log("Facebook OAuth: Failed to get user info", {
          status: userInfoResponse.status,
          statusText: userInfoResponse.statusText,
          error: errorText,
        });
        throw new Error("Không thể lấy thông tin người dùng từ Facebook");
      }

      const userInfo = await userInfoResponse.json();

      if (userInfo.error) {
        console.log("Facebook OAuth: API error", userInfo.error);
        throw new Error(
          userInfo.error.message ||
            "Không thể lấy thông tin người dùng từ Facebook"
        );
      }

      console.log("Facebook OAuth: User info received:", {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
      });

      return {
        provider: "facebook",
        accessToken: accessToken,
        idToken: null,
        profile: userInfo,
      };
    } else {
      console.log("Facebook OAuth: Failed or cancelled", {
        type: result.type,
        params: result.params,
        errorCode: result.errorCode,
        error: result.error,
      });
      throw new Error("Đăng nhập với Facebook thất bại hoặc bị hủy");
    }
  } catch (error) {
    console.log("Facebook OAuth: Error details:", {
      message: error.message,
      stack: error.stack,
      error: error,
    });
    throw error;
  } finally {
    activeFacebookAuthSession = false;
  }
};
