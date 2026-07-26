import React, { createContext, useCallback, useContext, useState } from "react";

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

  return (
    <StatusBarContext.Provider
      value={{
        barStyle,
        backgroundColor,
        updateStatusBar,
      }}
    >
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
