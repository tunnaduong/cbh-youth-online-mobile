import React, { createContext, useState } from "react";

// Create a Context
export const FeedContext = createContext(null);

// Context Provider
export function FeedProvider({ children }) {
  const [feed, setFeed] = useState(null);

  return (
    <FeedContext.Provider value={{ feed, setFeed }}>
      {children}
    </FeedContext.Provider>
  );
}
