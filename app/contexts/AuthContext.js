import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  logoutRequest,
  getCurrentUser,
  getBlockedUsers,
} from "../services/api/Api";
import { storage } from "../global/storage";
import axiosInstance, { setSessionExpiredHandler } from "../services/api/axiosInstance";
import { getEcho } from "../services/echo/echo";
import i18n from "../i18n";
import { useSessionReset } from "./SessionContext";
import { WEB_SESSION_KEYS } from "../utils/webSession";
import { releasePushToken } from "../utils/pushToken";
import {
  getSavedAccounts,
  upsertSavedAccount,
  removeSavedAccount,
} from "../utils/savedAccounts";

// Wipes per-account MMKV caches (chat, feed...) while keeping per-DEVICE
// display preferences - theme/autoplay/liquid-glass/tab-labels should survive
// a sign-out or account switch exactly like they survive an app update.
const clearSessionCaches = () => {
  const preserved = {};
  if (storage.contains("theme")) preserved.theme = storage.getString("theme");
  if (storage.contains("hideTabLabels")) preserved.hideTabLabels = storage.getBoolean("hideTabLabels");
  if (storage.contains("autoplayVideos")) preserved.autoplayVideos = storage.getBoolean("autoplayVideos");
  if (storage.contains("liquidGlassEnabled")) preserved.liquidGlassEnabled = storage.getBoolean("liquidGlassEnabled");
  if (storage.contains("shakeToReportEnabled")) preserved.shakeToReportEnabled = storage.getBoolean("shakeToReportEnabled");
  // Which login the WebViews / in-app browser were signed in with (see
  // utils/webSession.js). Wiping these made the app forget that they hold a
  // session at all, so after a sign-out they stayed signed in as the old
  // account; kept, the next page opened there goes through the site's
  // sign-out first.
  WEB_SESSION_KEYS.forEach((key) => {
    if (storage.contains(key)) preserved[key] = storage.getString(key);
  });

  storage.clearAll();

  for (const [key, value] of Object.entries(preserved)) {
    if (value !== undefined) storage.set(key, value);
  }
};

export const AuthContext = createContext();

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Remounts the whole provider tree (see SessionContext) so every context -
  // chat socket, push registration, feed caches, navigation - boots fresh for
  // the newly active account, the same way a cold start would.
  const restartSession = useSessionReset();
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState(null);
  const [profileName, setProfileName] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  // Incremented when current user updates their avatar → busts expo-image cache
  const [avatarVersion, setAvatarVersion] = useState(1);
  // Incremented when current user updates their cover photo → busts expo-image cache
  const [coverVersion, setCoverVersion] = useState(1);

  // Persisted so the cache-bust survives an app restart - without this, a
  // fresh cold start resets the in-memory version to 1, the avatar/cover
  // image component requests the bare (un-versioned) URL again, and its own
  // disk cache happily serves back the stale image it fetched the very
  // first time that bare URL was ever requested (before the update), even
  // though the server and the web client both already have the new image.
  const bumpAvatarVersion = () => {
    setAvatarVersion((v) => {
      const next = v + 1;
      storage.set("avatar_version", next);
      return next;
    });
  };
  const bumpCoverVersion = () => {
    setCoverVersion((v) => {
      const next = v + 1;
      storage.set("cover_version", next);
      return next;
    });
  };

  // Helper to build an avatar URL with cache-busting for the current user
  const getAvatarUrl = (uname) => {
    const base = `https://api.chuyenbienhoa.com/v1.0/users/${uname}/avatar`;
    // Only bust cache for the currently logged-in user
    if (uname === username && avatarVersion > 1) {
      return `${base}?v=${avatarVersion}`;
    }
    return base;
  };

  // Helper to build a cover photo URL with cache-busting for the current user
  const getCoverUrl = (uname) => {
    const base = `https://api.chuyenbienhoa.com/v1.0/users/${uname}/cover`;
    // Only bust cache for the currently logged-in user
    if (uname === username && coverVersion > 1) {
      return `${base}?v=${coverVersion}`;
    }
    return base;
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedAvatarVersion = storage.getNumber("avatar_version");
        if (storedAvatarVersion) setAvatarVersion(storedAvatarVersion);
        const storedCoverVersion = storage.getNumber("cover_version");
        if (storedCoverVersion) setCoverVersion(storedCoverVersion);

        const token = await AsyncStorage.getItem("auth_token");
        const storedUserInfo = await AsyncStorage.getItem("user_info");
        // const storedBlockedUsers = await AsyncStorage.getItem("blocked_users"); // Legacy

        setIsLoggedIn(!!token);

        if (storedUserInfo) {
          const parsed = JSON.parse(storedUserInfo);
          setUsername(parsed.username || null);
          setProfileName(parsed.profile_name || null);
          setUserInfo(parsed);
          setEmailVerifiedAt(parsed.email_verified_at || null);
        } else {
          setUsername(null);
          setProfileName(null);
          setUserInfo(null);
          setEmailVerifiedAt(null);
        }

        // Sync Blocked Users from API if logged in
        if (token) {
          try {
            const response = await getBlockedUsers();
            if (response?.data) {
              // Assuming API returns list of user objects with 'username' field
              const blockedUsernames = response.data.map(u => u.username);
              console.log("Synced blocked users from API:", blockedUsernames);
              setBlockedUsers(blockedUsernames);
              await AsyncStorage.setItem("blocked_users", JSON.stringify(blockedUsernames));
            }
          } catch (apiError) {
            console.error("Failed to sync blocked users from API:", apiError);
            // Fallback to local storage if API fails
            const storedBlockedUsers = await AsyncStorage.getItem("blocked_users");
            if (storedBlockedUsers) {
              setBlockedUsers(JSON.parse(storedBlockedUsers));
            }
          }

          try {
            await refreshUserInfo();
          } catch (refreshError) {
            console.error("Failed to refresh current user info:", refreshError);
          }
        } else {
          // Not logged in, clear or blocked users irrelevant
          setBlockedUsers([]);
        }

      } catch (e) {
        console.error("Failed to load user data:", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const signIn = async (token, user) => {
    await AsyncStorage.setItem("auth_token", token);
    await AsyncStorage.setItem("user_info", JSON.stringify(user));

    setIsLoggedIn(true);
    setUsername(user.username || null);
    setProfileName(user.profile_name || null);
    setUserInfo(user);
    setEmailVerifiedAt(user.email_verified_at || null);

    // Fetch blocked users on sign in
    try {
      const response = await getBlockedUsers();
      if (response?.data) {
        const blockedUsernames = response.data.map(u => u.username);
        setBlockedUsers(blockedUsernames);
        await AsyncStorage.setItem("blocked_users", JSON.stringify(blockedUsernames));
      }
    } catch (e) {
      console.error("Error fetching blocked users on login:", e);
    }

    try {
      const currentUserResponse = await getCurrentUser();
      if (currentUserResponse?.data) {
        const user = currentUserResponse.data;
        setUsername(user.username || null);
        setProfileName(user.profile_name || null);
        setUserInfo(user);
        setEmailVerifiedAt(user.email_verified_at || null);
        await AsyncStorage.setItem("user_info", JSON.stringify(user));
      }
    } catch (e) {
      console.error("Error fetching current user profile on login:", e);
    }
  };

  // Clears the active session locally (the account stays in saved accounts).
  const clearLocalSession = async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("user_info");

    setIsLoggedIn(false);
    setUsername(null);
    setProfileName(null);
    setUserInfo(null);
    setEmailVerifiedAt(null);
    setBlockedUsers([]);

    clearSessionCaches();
  };

  const signOut = async () => {
    // While the token still works: this phone must stop getting the
    // account's push notifications (see utils/pushToken.js).
    await releasePushToken();

    // Call logout API first (while token is still available) then clear local state
    try {
      await logoutRequest();
    } catch (e) {
      console.error("Logout API call failed (proceeding with local sign-out):", e.message);
    }

    // Forget this account on the device; fall back to another signed-in one if any
    const remaining = userInfo?.id ? await removeSavedAccount(userInfo.id) : await getSavedAccounts();
    for (const account of remaining) {
      try {
        await switchAccount(account, { leavePrevious: false });
        return;
      } catch {
        // That session was revoked too - try the next one
      }
    }

    await clearLocalSession();
  };

  // Throws "SESSION_EXPIRED" (and forgets the account) if its token was revoked.
  // Ends the web sessions the active account handed to the app's WebViews and
  // in-app browser, while its token is still the one being sent. Leaving the
  // account (switching, adding another) must not leave those signed in as it:
  // their cookie stops working now, and the next page opened there is signed
  // in as whoever is active then (see utils/webSession.js). The account itself
  // stays signed in on the device. Best effort - never blocks the switch.
  const endHandedOverWebSessions = async () => {
    try {
      await axiosInstance.post("/v1.0/web-session/revoke", null, { timeout: 5000 });
    } catch {}
  };

  // `leavePrevious: false` when the account being left is already logged out
  // or revoked (sign-out falling back to another saved account): its token
  // is dead, the API has ended everything itself, and a request with it
  // would only be answered 401 - which reads as "session expired".
  const switchAccount = async (account, { leavePrevious = true } = {}) => {
    const previousToken = await AsyncStorage.getItem("auth_token");
    if (leavePrevious && previousToken && previousToken !== account.token) {
      // The account stays signed in on the device, but while it is not the
      // active one this phone gets none of its pushes and its web sessions
      // are ended.
      await releasePushToken();
      await endHandedOverWebSessions();
    }
    await AsyncStorage.setItem("auth_token", account.token);
    let freshUser = account.user;
    try {
      const response = await getCurrentUser();
      if (response?.data) freshUser = response.data;
    } catch (e) {
      if (e?.response?.status === 401) {
        await removeSavedAccount(account.user.id);
        if (previousToken) await AsyncStorage.setItem("auth_token", previousToken);
        else await AsyncStorage.removeItem("auth_token");
        throw new Error("SESSION_EXPIRED");
      }
      // Offline etc. - switch anyway with the cached snapshot
    }
    await AsyncStorage.setItem("user_info", JSON.stringify(freshUser));
    await AsyncStorage.removeItem("blocked_users");
    clearSessionCaches();
    restartSession();
  };

  // The API no longer accepts the active account's token - it was logged out
  // from the logged-in devices list on another device (or its password was
  // reset). Forget that account on this device and fall back to another
  // signed-in one, or the login screen - the same as a sign-out, minus the
  // logout call (the token is already gone).
  const handlingRevokeRef = useRef(false);
  const handleSessionRevoked = async (revokedToken) => {
    if (handlingRevokeRef.current) return;
    handlingRevokeRef.current = true;
    try {
      if ((await AsyncStorage.getItem("auth_token")) !== revokedToken) return;

      const saved = await getSavedAccounts();
      const revoked = saved.find((account) => account.token === revokedToken);
      let remaining = saved;
      if (revoked) {
        remaining = await removeSavedAccount(revoked.user.id);
      } else if (userInfo?.id) {
        remaining = await removeSavedAccount(userInfo.id);
      }

      Toast.show({ type: "error", text1: i18n.t("sidebar.sessionExpired") });

      for (const account of remaining) {
        try {
          await switchAccount(account, { leavePrevious: false });
          return;
        } catch {
          // That session was revoked too - try the next one
        }
      }
      await clearLocalSession();
    } finally {
      handlingRevokeRef.current = false;
    }
  };

  // Always the latest closure, so the long-lived listeners below don't act
  // on a stale userInfo.
  const handleSessionRevokedRef = useRef(handleSessionRevoked);
  handleSessionRevokedRef.current = handleSessionRevoked;

  // Any API call rejected with "Unauthenticated." for the active token (see
  // axiosInstance) ends the session.
  useEffect(() => {
    setSessionExpiredHandler((token) => handleSessionRevokedRef.current(token));
    return () => setSessionExpiredHandler(null);
  }, []);

  // Instant: the API broadcasts "session.revoked" on the user's private
  // channel when logins are revoked from the devices list. A Sanctum token's
  // id is the number before "|", so the app can tell whether it's one of them.
  useEffect(() => {
    if (!isLoggedIn || !userInfo?.id) return undefined;
    let channel = null;
    try {
      channel = getEcho().private(`App.Models.User.${userInfo.id}`);
      channel.listen(".session.revoked", async (event) => {
        const token = await AsyncStorage.getItem("auth_token");
        const tokenId = parseInt(String(token || "").split("|")[0], 10);
        const revokedIds = Array.isArray(event?.token_ids) ? event.token_ids.map(Number) : [];
        if (token && revokedIds.includes(tokenId)) {
          handleSessionRevokedRef.current(token);
        }
      });
    } catch (e) {
      console.warn("[Auth] session.revoked listener failed:", e?.message || e);
    }
    return () => {
      try {
        channel?.stopListening(".session.revoked");
      } catch {}
    };
  }, [isLoggedIn, userInfo?.id]);

  // Fallback for a missed broadcast (socket down while in the background):
  // check the session when the app comes back to the foreground - a revoked
  // token answers 401 and the handler above takes over.
  useEffect(() => {
    let lastCheck = 0;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      AsyncStorage.getItem("auth_token").then((token) => {
        if (token) getCurrentUser().catch(() => {});
      });
    });
    return () => subscription.remove();
  }, []);

  // Keeps the current account signed in (saved) and shows the login screens.
  const addAccount = async () => {
    await releasePushToken();
    await endHandedOverWebSessions();
    await clearLocalSession();
  };

  // Remember every signed-in account on this device for the account switcher
  useEffect(() => {
    if (!userInfo?.id) return;
    AsyncStorage.getItem("auth_token").then((token) => {
      if (token) upsertSavedAccount(token, userInfo);
    });
  }, [userInfo?.id, userInfo?.username, userInfo?.profile_name]);

  const blockUser = async (userToBlock) => {
    // userToBlock should be the username (string)
    if (!userToBlock || blockedUsers.includes(userToBlock)) return;

    const newBlocked = [...blockedUsers, userToBlock];
    setBlockedUsers(newBlocked);
    // Local mirror of the server-side block list (synced from
    // GET /users/blocked on launch/sign-in). Callers must hit the block API
    // themselves with the user's numeric id - this only updates the cache
    // used for client-side filtering.
    await AsyncStorage.setItem("blocked_users", JSON.stringify(newBlocked));
  };

  const unblockUser = async (userToUnblock) => {
    console.log("AuthContext unblockUser:", userToUnblock);
    console.log("Current blockedUsers:", blockedUsers);
    const newBlocked = blockedUsers.filter((u) => u !== userToUnblock);
    console.log("New blockedUsers:", newBlocked);
    setBlockedUsers(newBlocked);
    await AsyncStorage.setItem("blocked_users", JSON.stringify(newBlocked));
  };

  const updateEmailVerificationStatus = (emailVerifiedAt) => {
    setEmailVerifiedAt(emailVerifiedAt);
    if (userInfo) {
      const updatedUserInfo = {
        ...userInfo,
        email_verified_at: emailVerifiedAt,
      };
      setUserInfo(updatedUserInfo);
      AsyncStorage.setItem("user_info", JSON.stringify(updatedUserInfo));
    }
  };

  const refreshUserInfo = async () => {
    const token = await AsyncStorage.getItem("auth_token");
    if (!token) {
      return;
    }

    try {
      const response = await getCurrentUser();
      if (response?.data) {
        const user = response.data;
        setIsLoggedIn(true);
        setUsername(user.username || null);
        setProfileName(user.profile_name || null);
        setUserInfo(user);
        setEmailVerifiedAt(user.email_verified_at || null);
        await AsyncStorage.setItem("user_info", JSON.stringify(user));
      }
    } catch (error) {
      console.error("Failed to refresh user info:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        username,
        profileName,
        setUserInfo,
        userInfo,
        emailVerifiedAt,
        updateEmailVerificationStatus,
        refreshUserInfo,
        signIn,
        signOut,
        switchAccount,
        addAccount,
        blockedUsers,
        blockUserInContext: blockUser,
        unblockUserInContext: unblockUser,
        // Keep old names for backward compatibility if needed, but prefer InContext variants
        blockUser,
        unblockUser,
        // Avatar cache busting
        avatarVersion,
        bumpAvatarVersion,
        getAvatarUrl,
        // Cover photo cache busting
        coverVersion,
        bumpCoverVersion,
        getCoverUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
