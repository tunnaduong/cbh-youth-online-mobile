import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme, Platform } from "react-native";
import { storage } from "../global/storage";

// react-native-liquid-glassmorphism itself falls back to a plain translucent
// view (no real blur) below Android 12/API 31 - there's no working glass
// effect to opt into there, just a worse-looking imitation of one, so the
// toggle is forced off and locked rather than letting the user turn on
// something that won't actually render as glass.
export const isLiquidGlassUnsupportedAndroid =
  Platform.OS === "android" && Platform.Version < 31;

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

  // Read saved theme SYNCHRONOUSLY on first render (MMKV is sync)
  // so there is no flash of wrong background color
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = storage.getString("theme");
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
    // "system" or no saved value → follow device theme
    return systemColorScheme === "dark";
  });

  const [useSystemTheme, setUseSystemTheme] = useState(() => {
    const savedTheme = storage.getString("theme");
    return !savedTheme || savedTheme === "system";
  });

  const [hideTabLabels, setHideTabLabelsState] = useState(() => {
    return storage.getBoolean("hideTabLabels") ?? false;
  });

  const [autoplayVideos, setAutoplayVideosState] = useState(() => {
    return storage.getBoolean("autoplayVideos") ?? false;
  });

  // Liquid glass is on by default - this is the "turn it off" escape hatch
  // for whoever wants the flatter, cheaper tinted look everywhere instead
  // (same tint style Android used before the glass migration), on both
  // platforms.
  const [liquidGlassEnabled, setLiquidGlassEnabledState] = useState(() => {
    if (isLiquidGlassUnsupportedAndroid) return false;
    return storage.getBoolean("liquidGlassEnabled") ?? true;
  });

  useEffect(() => {
    if (useSystemTheme) {
      setIsDarkMode(systemColorScheme === "dark");
    }
  }, [systemColorScheme, useSystemTheme]);

  const setThemeMode = (mode) => {
    if (mode === "system") {
      setUseSystemTheme(true);
      setIsDarkMode(systemColorScheme === "dark");
    } else {
      setUseSystemTheme(false);
      setIsDarkMode(mode === "dark");
    }
    storage.set("theme", mode);
  };

  const setHideTabLabels = (value) => {
    setHideTabLabelsState(value);
    storage.set("hideTabLabels", value);
  };

  const setAutoplayVideos = (value) => {
    setAutoplayVideosState(value);
    storage.set("autoplayVideos", value);
  };

  const setLiquidGlassEnabled = (value) => {
    if (isLiquidGlassUnsupportedAndroid) return;
    setLiquidGlassEnabledState(value);
    storage.set("liquidGlassEnabled", value);
  };

  const theme = isDarkMode ? colors.dark : colors.light;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        theme,
        setThemeMode,
        useSystemTheme,
        setUseSystemTheme,
        hideTabLabels,
        setHideTabLabels,
        autoplayVideos,
        setAutoplayVideos,
        liquidGlassEnabled,
        setLiquidGlassEnabled,
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
