import React, { useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import Toast, { BaseToast } from "react-native-toast-message";
import { ThemeContext, colors } from "../contexts/ThemeContext";
import { storage } from "../global/storage";

const ACCENTS = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };

/**
 * The app's toast host: `react-native-toast-message` drawn in the app's
 * light or dark theme (the library's own toasts are always white).
 *
 * Mount THIS instead of the library's <Toast /> wherever a toast host is
 * needed; showing a toast stays `Toast.show(...)` from the library.
 *
 * It also works outside ThemeProvider (the root host in App.js sits above
 * it): there it reads the saved theme setting and the system scheme itself.
 */
export default function AppToast(props) {
  const context = useContext(ThemeContext);
  const systemScheme = useColorScheme();

  // Only used without a provider: follow the setting when it changes.
  const [savedTheme, setSavedTheme] = useState(() => storage.getString("theme"));
  useEffect(() => {
    if (context) return undefined;
    const listener = storage.addOnValueChangedListener?.((key) => {
      if (key === "theme") setSavedTheme(storage.getString("theme"));
    });
    return () => listener?.remove?.();
  }, [context]);

  const isDark = context
    ? !!context.isDarkMode
    : savedTheme === "dark" || (savedTheme !== "light" && systemScheme === "dark");
  const palette = context?.theme || (isDark ? colors.dark : colors.light);

  const config = useMemo(() => {
    const themed = (type) => (toastProps) => (
      <BaseToast
        {...toastProps}
        style={{
          borderLeftColor: ACCENTS[type],
          backgroundColor: palette.surface,
          borderColor: palette.border,
          // Tall enough for two lines of detail.
          height: undefined,
          minHeight: 60,
          paddingVertical: 8,
        }}
        contentContainerStyle={{ paddingHorizontal: 14 }}
        text1Style={{ fontSize: 15, fontWeight: "600", color: palette.text }}
        text2Style={{ fontSize: 13, color: palette.subText }}
        text1NumberOfLines={2}
        text2NumberOfLines={3}
      />
    );

    return { success: themed("success"), error: themed("error"), info: themed("info") };
  }, [palette]);

  return <Toast {...props} config={config} />;
}
