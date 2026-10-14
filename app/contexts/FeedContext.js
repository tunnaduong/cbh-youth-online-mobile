import React, { createContext, useMemo, useState } from "react";

// Create a Context
export const FeedContext = createContext(null);

// Context Provider
export function FeedProvider({ children }) {
  const [feed, setFeed] = useState(null);
  const [recentPostsProfile, setRecentPostsProfile] = useState(null);
  // The home feed's tab (personalized / latest / following / youth-news).
  // Kept here, not in HomeScreen: the stack is reset after posting, editing
  // or reporting, which mounts a new HomeScreen - it must come back on the
  // tab the user had chosen, not on "For you".
  const [feedMode, setFeedMode] = useState("personalized");

  // Rebuilt only when the data changes (the setters never do).
  const value = useMemo(
    () => ({ feed, setFeed, recentPostsProfile, setRecentPostsProfile, feedMode, setFeedMode }),
    [feed, recentPostsProfile, feedMode]
  );

  return (
    <FeedContext.Provider value={value}>
      {children}
    </FeedContext.Provider>
  );
}
