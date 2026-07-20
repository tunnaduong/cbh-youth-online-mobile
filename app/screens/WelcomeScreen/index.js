import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginCarousel from "../../components/LoginCarousel";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import AuthBackground from "../../components/AuthBackground";

const WelcomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <AuthBackground />
      <View style={styles.carouselContainer}>
        <LoginCarousel />
      </View>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate("Login")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {t("signup.login")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Signup")}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
            {t("signup.createAccount")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
  },
  actionsContainer: {
    width: "100%",
    paddingBottom: 40,
    gap: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
