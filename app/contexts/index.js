import { AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { FeedProvider } from "./FeedContext";
import { StatusBarProvider } from "./StatusBarContext";
import { UnreadCountsProvider } from "./UnreadCountsContext";

export default function MultiContextProvider({ children }) {
  return (
    <AuthProvider>
      <FeedProvider>
        <StatusBarProvider>
          <UnreadCountsProvider>
            <BottomSheetProvider>{children}</BottomSheetProvider>
          </UnreadCountsProvider>
        </StatusBarProvider>
      </FeedProvider>
    </AuthProvider>
  );
}
