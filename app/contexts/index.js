import React, { useContext } from "react";
import { AuthContext, AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { ChatSocketProvider } from "./ChatSocketContext";
import { FeedProvider } from "./FeedContext";
import { StatusBarProvider } from "./StatusBarContext";
import { UnreadCountsProvider } from "./UnreadCountsContext";
import { NotificationProvider } from "./NotificationContext";
import { ThemeProvider } from "./ThemeContext";

// Remounts its subtree whenever the active account changes (see
// AuthContext.switchAccount), so every per-account context and the whole
// navigation tree start from scratch for the new user without a native reload.
function SessionScope({ children }) {
  const { sessionKey } = useContext(AuthContext);
  return <React.Fragment key={sessionKey}>{children}</React.Fragment>;
}

export default function MultiContextProvider({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SessionScope>
          <ChatSocketProvider>
            <NotificationProvider>
              <FeedProvider>
                <StatusBarProvider>
                  <UnreadCountsProvider>
                    <BottomSheetProvider>{children}</BottomSheetProvider>
                  </UnreadCountsProvider>
                </StatusBarProvider>
              </FeedProvider>
            </NotificationProvider>
          </ChatSocketProvider>
        </SessionScope>
      </AuthProvider>
    </ThemeProvider>
  );
}
