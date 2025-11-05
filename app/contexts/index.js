import { AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { FeedProvider } from "./FeedContext";
import { StatusBarProvider } from "./StatusBarContext";

export default function MultiContextProvider({ children }) {
  return (
    <AuthProvider>
      <FeedProvider>
        <StatusBarProvider>
          <BottomSheetProvider>{children}</BottomSheetProvider>
        </StatusBarProvider>
      </FeedProvider>
    </AuthProvider>
  );
}
