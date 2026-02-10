import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { storage } from "../global/storage";

const ThemeContext = createContext();

export const colors = {
  light: {
    background: "#ffffff",
    surface: "#ffffff",
    sectionBackground: "#FAFAFA",
    text: "#000000",
    subText: "#666666",
    primary: "#319527",
    border: "#E5E5E5",
    headerBackground: "#ffffff",
    iconBackground: "#F1F1F1",
    tabBarBackground: "#ffffff",
    cardBackground: "#ffffff",
    placeholder: "#A0A0A0",
  },
  dark: {
    background: "#121212",
    surface: "#1e1e1e",
    sectionBackground: "#1e1e1e",
    text: "#ffffff",
    subText: "#A0A0A0",
    primary: "#4CAF50",
    border: "#2C2C2C",
    headerBackground: "#1e1e1e",
    iconBackground: "#2C2C2C",
    tabBarBackground: "#1e1e1e",
    cardBackground: "#1e1e1e",
    placeholder: "#666666",
  },
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [useSystemTheme, setUseSystemTheme] = useState(false);

  useEffect(() => {
    const savedTheme = storage.getString("theme");
    if (savedTheme) {
      setIsDarkMode(savedTheme === "dark");
      setUseSystemTheme(false);
    } else {
      setIsDarkMode(systemColorScheme === "dark");
      setUseSystemTheme(true);
    }
  }, []);

  useEffect(() => {
    if (useSystemTheme) {
      setIsDarkMode(systemColorScheme === "dark");
    }
  }, [systemColorScheme, useSystemTheme]);

  const toggleTheme = (value) => {
    setIsDarkMode(value);
    setUseSystemTheme(false);
    storage.set("theme", value ? "dark" : "light");
  };

  const theme = isDarkMode ? colors.dark : colors.light;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        theme,
        toggleTheme,
        useSystemTheme,
        setUseSystemTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
