import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState(null); // Add username state
  const [profileName, setProfileName] = useState(null); // Add profile name state
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        const storedUsername = await AsyncStorage.getItem("user_info"); // Retrieve username from storage

        setIsLoggedIn(!!token);

        if (storedUsername) {
          const parsedUserInfo = JSON.parse(storedUsername);
          setUsername(parsedUserInfo.username || null); // Set the username if it exists
          setProfileName(parsedUserInfo.profile_name || null); // Set the profile name if it exists
          setUserInfo(parsedUserInfo); // Set the user info if it exists
        } else {
          setUsername(null);
          setProfileName(null);
          setUserInfo(null);
        }
      } catch (error) {
        console.error("Error checking login status", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        isLoading,
        username,
        setUsername,
        profileName,
        userInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
