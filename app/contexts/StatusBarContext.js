import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const StatusBarContext = createContext();

export const StatusBarProvider = ({ children }) => {
  const [barStyle, setBarStyle] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState(null);

  const updateStatusBar = useCallback((style, bgColor = null) => {
    if (__DEV__) {
      console.log("[StatusBar] updateStatusBar", { style, bgColor });
    }
    setBarStyle(style);
    setBackgroundColor(bgColor);
  }, []);

  const value = useMemo(
    () => ({ barStyle, backgroundColor, updateStatusBar }),
    [barStyle, backgroundColor, updateStatusBar]
  );

  return (
    <StatusBarContext.Provider value={value}>
      {children}
    </StatusBarContext.Provider>
  );
};

export const useStatusBar = () => {
  const context = useContext(StatusBarContext);
  if (!context) {
    throw new Error("useStatusBar must be used within StatusBarProvider");
  }
  return context;
};
