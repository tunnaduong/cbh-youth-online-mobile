import { AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { FeedProvider } from "./FeedContext";
import { StatusBarProvider } from "./StatusBarContext";
import { UnreadCountsProvider } from "./UnreadCountsContext";
import { NotificationProvider } from "./NotificationContext";

export default function MultiContextProvider({ children }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <FeedProvider>
          <StatusBarProvider>
            <UnreadCountsProvider>
              <BottomSheetProvider>{children}</BottomSheetProvider>
            </UnreadCountsProvider>
          </StatusBarProvider>
        </FeedProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
