import LottieView from "lottie-react-native";

export default function CustomLoading({ size = 70 }) {
  return (
    <LottieView
      source={require("../assets/refresh.json")}
      style={{
        width: size,
        height: size,
      }}
      loop
      autoPlay
    />
  );
}
