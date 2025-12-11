import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logoutRequest, getCurrentUser } from "../services/api/Api";
import { storage } from "../global/storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState(null);
  const [profileName, setProfileName] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        const storedUserInfo = await AsyncStorage.getItem("user_info");

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
