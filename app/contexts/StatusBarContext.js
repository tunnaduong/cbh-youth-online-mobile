import React, { createContext, useContext, useState } from "react";

const StatusBarContext = createContext();

export const StatusBarProvider = ({ children }) => {
  const [barStyle, setBarStyle] = useState("dark-content");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  const updateStatusBar = (style, bgColor = "#ffffff") => {
    setBarStyle(style);
    setBackgroundColor(bgColor);
  };

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
