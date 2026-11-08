import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import LottieView from "lottie-react-native";
import * as NativeSplashScreen from "expo-splash-screen";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { getActiveIconDisplay } from "../utils/appIcons";

// This is our Splash Screen component
const SplashScreen = ({ onFinish }) => {
  const animation = useRef(null);
  const { theme, launcherIconKey, customAppIconUri } = useTheme();
  const { t } = useTranslation();

  const isDefaultIcon = !launcherIconKey || launcherIconKey === "default";
  const activeIcon = getActiveIconDisplay(launcherIconKey, customAppIconUri);

  useEffect(() => {
    // Hide native splash screen immediately when JS splash mounts
    NativeSplashScreen.hideAsync().catch(() => {});

    // Start the animation when component mounts
    if (animation.current && isDefaultIcon) {
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
  }, [isDefaultIcon]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.animationContainer}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          {isDefaultIcon ? (
            <LottieView
              ref={animation}
              source={require("../assets/splash.json")}
              style={styles.animation}
              autoPlay={false}
              loop={false}
            />
          ) : (
            <View style={styles.iconSplashWrap}>
              <Image
                source={activeIcon.source}
                style={styles.iconSplashImage}
                resizeMode="contain"
              />
            </View>
          )}
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
  iconSplashWrap: {
    width: 140,
    height: 140,
    borderRadius: 32,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  iconSplashImage: {
    width: "100%",
    height: "100%",
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
