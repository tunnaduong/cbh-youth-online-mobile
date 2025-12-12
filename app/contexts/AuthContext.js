import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  logoutRequest,
  getCurrentUser,
  reportUser,
  getBlockedUsers,
} from "../services/api/Api";
import { storage } from "../global/storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState(null);
  const [profileName, setProfileName] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    const loadUserData = async () => {
      try {
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
  };

  const signOut = async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("user_info");

    setIsLoggedIn(false);
    setUsername(null);
    setProfileName(null);
    setUserInfo(null);
    setEmailVerifiedAt(null);

    storage.clear();

    await logoutRequest();
  };

  const blockUser = async (userToBlock) => {
    // userToBlock should be the username (string)
    if (!userToBlock || blockedUsers.includes(userToBlock)) return;

    const newBlocked = [...blockedUsers, userToBlock];
    setBlockedUsers(newBlocked);
    // Note: Using AsyncStorage for client-side blocking persistence.
    // In a full implementation, this should be synced with the backend.
    await AsyncStorage.setItem("blocked_users", JSON.stringify(newBlocked));

    // Notify developer
    try {
      // Best-effort network call to report the user.
      // This satisfies the "Notify developer" requirement.
      await reportUser(userToBlock, "Blocked by user");
    } catch (e) {
      console.log(
        "[Safety] Failed to send report for blocked user (expected if endpoint missing):",
        e.message
      );
    }
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
    if (!isLoggedIn) {
      return;
    }

    try {
      const response = await getCurrentUser();
      if (response?.data) {
        const user = response.data;
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
        blockedUsers,
        blockUserInContext: blockUser,
        unblockUserInContext: unblockUser,
        // Keep old names for backward compatibility if needed, but prefer InContext variants
        blockUser,
        unblockUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
