import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState(null); // Add username state

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        const storedUsername = await AsyncStorage.getItem("user_info"); // Retrieve username from storage
        setIsLoggedIn(!!token);
        setUsername(JSON.parse(storedUsername).username); // Set the username if it exists
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
        setUsername, // Provide a way to update the username
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
