import { AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { ChatSocketProvider } from "./ChatSocketContext";
import { FeedProvider } from "./FeedContext";
import { StatusBarProvider } from "./StatusBarContext";
import { UnreadCountsProvider } from "./UnreadCountsContext";
import { NotificationProvider } from "./NotificationContext";
import { ThemeProvider } from "./ThemeContext";
import { CallProvider } from "./CallContext";
import { PostHtmlEngineProvider } from "../components/PostHtml";

export default function MultiContextProvider({ children }) {
  return (
    <ThemeProvider>
      {/* One render engine for every post body (see components/PostHtml.js). */}
      <PostHtmlEngineProvider>
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
      </PostHtmlEngineProvider>
    </ThemeProvider>
  );
}
