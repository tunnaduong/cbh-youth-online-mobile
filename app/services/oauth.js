import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

// Complete the auth session for proper cleanup
WebBrowser.maybeCompleteAuthSession();

// OAuth configuration
const GOOGLE_CLIENT_ID =
  "464238880090-1c3s1seien4msnnmqdcu0mp10dacabik.apps.googleusercontent.com";
const FACEBOOK_CLIENT_ID = "585636393835324";

// Redirect URI - sử dụng backend callback URL
const REDIRECT_URI = "https://api.chuyenbienhoa.com/v1.0/oauth/callback";

// Google OAuth using Authorization Code flow with PKCE
export const loginWithGoogle = async () => {
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

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

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

      return {
        provider: "google",
        accessToken: accessToken,
        idToken: idToken || null,
        profile: userInfo,
      };
    } else {
      throw new Error("Đăng nhập với Google thất bại hoặc bị hủy");
    }
  } catch (error) {
    throw error;
  }
};

// Facebook OAuth using Implicit flow (Token response)
export const loginWithFacebook = async () => {
  try {
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

    const result = await request.promptAsync(discovery, {
      useProxy: false,
      showInRecents: true,
    });

    if (result.type === "success") {
      const { access_token } = result.params;

      if (!access_token) {
        throw new Error("Không thể lấy access token từ Facebook");
      }

      // Get user info from Facebook Graph API
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${access_token}`
      );
      const userInfo = await userInfoResponse.json();

      if (userInfo.error) {
        throw new Error(
          userInfo.error.message ||
            "Không thể lấy thông tin người dùng từ Facebook"
        );
      }

      return {
        provider: "facebook",
        accessToken: access_token,
        idToken: null,
        profile: userInfo,
      };
    } else {
      throw new Error("Đăng nhập với Facebook thất bại hoặc bị hủy");
    }
  } catch (error) {
    throw error;
  }
};
