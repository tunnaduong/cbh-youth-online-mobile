import React, { useEffect, useRef } from "react";
import { SafeAreaView, StyleSheet, View, Text, Image } from "react-native";
import LottieView from "lottie-react-native";

// This is our Splash Screen component
const SplashScreen = ({ onFinish }) => {
  const animation = useRef(null);

  useEffect(() => {
    // Start the animation when component mounts
    if (animation.current) {
      animation.current.play();
    }

    // Set a timeout to finish the splash screen (typically 2-3 seconds)
    const timer = setTimeout(() => {
      if (onFinish) {
        onFinish();
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.animationContainer}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <LottieView
            ref={animation}
            source={require("../assets/splash.json")}
            style={styles.animation}
            autoPlay={false}
            loop={false}
          />
          <Text style={styles.appName}>CBH Youth Online</Text>
        </View>
        <Image
          source={require("../assets/fatties.png")}
          style={{ height: 60, width: 107, marginBottom: 20 }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white", // Duolingo green color
    justifyContent: "center",
    alignItems: "center",
  },
  animationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  animation: {
    width: 200,
    height: 200,
  },
  appName: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: "bold",
    color: "#319527",
  },
});

export default SplashScreen;
