import React, { createContext, useMemo, useState } from "react";

// Create a Context
export const FeedContext = createContext(null);

// Context Provider
export function FeedProvider({ children }) {
  const [feed, setFeed] = useState(null);
  const [recentPostsProfile, setRecentPostsProfile] = useState(null);

  // Rebuilt only when the data changes (the setters never do).
  const value = useMemo(
    () => ({ feed, setFeed, recentPostsProfile, setRecentPostsProfile }),
    [feed, recentPostsProfile]
  );

  return (
    <FeedContext.Provider value={value}>
      {children}
    </FeedContext.Provider>
  );
}
