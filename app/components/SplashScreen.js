import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import LottieView from "lottie-react-native";
import * as NativeSplashScreen from "expo-splash-screen";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

// This is our Splash Screen component
const SplashScreen = ({ onFinish }) => {
  const animation = useRef(null);
  const { theme } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    // Hide native splash screen immediately when JS splash mounts
    NativeSplashScreen.hideAsync().catch(() => {});

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

    return () => {
      clearTimeout(timer);
      if (animation.current) {
        try {
          animation.current.reset();
        } catch (e) {
          // Ignore any errors during quick unmount
        }
      }
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
          <Text style={styles.appName.subheading}>{t('app.subtitle')}</Text>
          <Text style={styles.appName.heading}>{t('app.name')}</Text>
        </View>
        <Image
          source={require("../assets/fatties.png")}
          style={{ height: 60, width: 107, marginBottom: 60 }}
        />
      </View>
    </View>
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
    heading: { fontSize: 24.5, fontWeight: "bold", color: "#319527" },
    subheading: {
      marginTop: 20,
      fontSize: 24,
      fontWeight: "300",
      color: "#319527",
    },
  },
});

export default SplashScreen;
