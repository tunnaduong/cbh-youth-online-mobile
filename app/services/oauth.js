import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

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

    // Log the authorization URL that will be opened
    const authUrl = await request.makeAuthUrlAsync(discovery);
    console.log("Google OAuth: Authorization URL:", authUrl);

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    console.log("Google OAuth promptAsync result:", {
      type: result.type,
      params: result.params,
      errorCode: result.errorCode,
      error: result.error,
    });

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
        console.error("Google OAuth: No access token received", tokenResult);
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
        console.error("Google OAuth: Failed to get user info", {
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
      console.error("Google OAuth: Failed or cancelled", {
        type: result.type,
        params: result.params,
        errorCode: result.errorCode,
        error: result.error,
      });
      throw new Error("Đăng nhập với Google thất bại hoặc bị hủy");
    }
  } catch (error) {
    console.error("Google OAuth: Error details:", {
      message: error.message,
      stack: error.stack,
      error: error,
    });
    throw error;
  } finally {
    activeGoogleAuthSession = false;
  }
};

// Facebook OAuth using Implicit flow (Token response)
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
      responseType: AuthSession.ResponseType.Token,
      redirectUri: REDIRECT_URI,
      usePKCE: false,
    });

    // Log the authorization URL that will be opened
    const authUrl = await request.makeAuthUrlAsync(discovery);
    console.log("Facebook OAuth: Authorization URL:", authUrl);

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    console.log("Facebook OAuth promptAsync result:", {
      type: result.type,
      params: result.params,
      errorCode: result.errorCode,
      error: result.error,
    });

    if (result.type === "success") {
      const { access_token } = result.params;

      console.log("Facebook OAuth: Received access token:", !!access_token);

      if (!access_token) {
        console.error(
          "Facebook OAuth: No access token in params",
          result.params
        );
        throw new Error("Không thể lấy access token từ Facebook");
      }

      // Get user info from Facebook Graph API
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${access_token}`
      );

      console.log(
        "Facebook OAuth: User info response status:",
        userInfoResponse.status
      );

      const userInfo = await userInfoResponse.json();

      if (userInfo.error) {
        console.error("Facebook OAuth: API error", userInfo.error);
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
        accessToken: access_token,
        idToken: null,
        profile: userInfo,
      };
    } else {
      console.error("Facebook OAuth: Failed or cancelled", {
        type: result.type,
        params: result.params,
        errorCode: result.errorCode,
        error: result.error,
      });
      throw new Error("Đăng nhập với Facebook thất bại hoặc bị hủy");
    }
  } catch (error) {
    console.error("Facebook OAuth: Error details:", {
      message: error.message,
      stack: error.stack,
      error: error,
    });
    throw error;
  } finally {
    activeFacebookAuthSession = false;
  }
};
