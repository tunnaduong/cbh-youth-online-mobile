import { AuthProvider } from "./AuthContext";
import { BottomSheetProvider } from "./BottomSheetContext";
import { FeedProvider } from "./FeedContext";

export default function MultiContextProvider({ children }) {
  return (
    <AuthProvider>
      <FeedProvider>
        <BottomSheetProvider>{children}</BottomSheetProvider>
      </FeedProvider>
    </AuthProvider>
  );
}
