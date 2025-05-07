import { AuthProvider } from "./AuthContext";
import { FeedProvider } from "./FeedContext";

export default function MultiContextProvider({ children }) {
  return (
    <AuthProvider>
      <FeedProvider>{children}</FeedProvider>
    </AuthProvider>
  );
}
