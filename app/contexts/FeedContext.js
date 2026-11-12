import React, { createContext, useMemo, useRef, useState } from "react";

// Create a Context
export const FeedContext = createContext(null);
export const FeedActionsContext = createContext(null);

// Context Provider
export function FeedProvider({ children }) {
  const [feed, setFeed] = useState(null);
  const [recentPostsProfile, setRecentPostsProfile] = useState(null);
  // The home feed's tab (personalized / latest / following / youth-news).
  // Kept here, not in HomeScreen: the stack is reset after posting, editing
  // or reporting, which mounts a new HomeScreen - it must come back on the
  // tab the user had chosen, not on "For you".
  const [feedMode, setFeedMode] = useState("personalized");

  const feedRef = useRef(feed);
  feedRef.current = feed;

  // Stable actions object that never changes identity when feed/recentPostsProfile
  // arrays update, preventing PostItem context consumers from re-rendering on
  // every pagination/vote/save update.
  const actionsValue = useMemo(
    () => ({ setFeed, setRecentPostsProfile, setFeedMode, feedRef }),
    []
  );

  // Rebuilt only when the data changes (the setters never do).
  const value = useMemo(
    () => ({ feed, setFeed, recentPostsProfile, setRecentPostsProfile, feedMode, setFeedMode, feedRef }),
    [feed, recentPostsProfile, feedMode]
  );

  return (
    <FeedActionsContext.Provider value={actionsValue}>
      <FeedContext.Provider value={value}>
        {children}
      </FeedContext.Provider>
    </FeedActionsContext.Provider>
  );
}
