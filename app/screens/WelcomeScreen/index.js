import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginCarousel from "../../components/LoginCarousel";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import AuthBackground from "../../components/AuthBackground";
import AuthButton from "../../components/AuthButton";

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
        <AuthButton
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.primaryButtonText}>
            {t("signup.login")}
          </Text>
        </AuthButton>
        <AuthButton
          variant="secondary"
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Signup")}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
            {t("signup.createAccount")}
          </Text>
        </AuthButton>
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
    // A full button now (AuthButton), so it needs air below the main one.
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
