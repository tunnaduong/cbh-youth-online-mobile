import { AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { ChatSocketProvider } from "./ChatSocketContext";
import { FeedProvider } from "./FeedContext";
import { StatusBarProvider } from "./StatusBarContext";
import { UnreadCountsProvider } from "./UnreadCountsContext";
import { NotificationProvider } from "./NotificationContext";
import { ThemeProvider } from "./ThemeContext";
import { CallProvider } from "./CallContext";

export default function MultiContextProvider({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
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
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
