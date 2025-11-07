import React, { createContext, useContext } from "react";
import { useUnreadCounts } from "../hooks/useUnreadCounts";

const UnreadCountsContext = createContext(null);

export const UnreadCountsProvider = ({ children }) => {
  const unreadCounts = useUnreadCounts();

  return (
    <UnreadCountsContext.Provider value={unreadCounts}>
      {children}
    </UnreadCountsContext.Provider>
  );
};

export const useUnreadCountsContext = () => {
  const context = useContext(UnreadCountsContext);
  if (!context) {
    throw new Error(
      "useUnreadCountsContext must be used within UnreadCountsProvider"
    );
  }
  return context;
};

