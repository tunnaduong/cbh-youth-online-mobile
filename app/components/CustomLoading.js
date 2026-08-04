import { View } from "react-native";
import LottieView from "lottie-react-native";
import { useTheme } from "../contexts/ThemeContext";

// showBackdrop wraps the spin icon in a circular card with a soft shadow,
// matching Facebook/Instagram's pull-to-refresh indicator - off by default
// since CustomLoading also doubles as the app's plain inline/full-page
// loading spinner elsewhere, which never had a disc behind it.
export default function CustomLoading({ size = 70, style, showBackdrop = false }) {
  const { theme, isDarkMode } = useTheme();

  if (!showBackdrop) {
    return (
      <LottieView
        source={require("../assets/refresh.json")}
        style={[{ width: size, height: size }, style]}
        loop
        autoPlay
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.surface,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.4 : 0.15,
          shadowRadius: 4,
          elevation: 4,
        },
        style,
      ]}
    >
      <LottieView
        source={require("../assets/refresh.json")}
        style={{ width: size * 0.75, height: size * 0.75 }}
        loop
        autoPlay
      />
    </View>
  );
}
