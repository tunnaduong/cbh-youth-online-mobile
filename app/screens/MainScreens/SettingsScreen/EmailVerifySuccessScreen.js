import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { verifyEmail } from "../../../services/api/Api";
import useStatusBarStyle from "../../../hooks/useStatusBarStyle";

export default function EmailVerifySuccessScreen({ navigation, route }) {
  const { token } = route.params || {};
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { updateEmailVerificationStatus } = useContext(AuthContext);

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage(t("emailVerifySuccess.invalidLink"));
      return;
    }

    verifyEmail(token)
      .then((res) => {
        const verifiedAt = res?.data?.email_verified_at || new Date().toISOString();
        updateEmailVerificationStatus(verifiedAt);
        setStatus("success");
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          t("emailVerifySuccess.errorDefault");
        setStatus("error");
        setErrorMessage(msg);
      });
  }, [token]);

  const handleGoHome = () => {
    navigation.reset({ index: 0, routes: [{ name: "MainScreens" }] });
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <View style={[styles.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          {isLoading && (
            <>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.subText }]}>
                {t("emailVerifySuccess.verifying")}
              </Text>
            </>
          )}

          {isSuccess && (
            <Animated.View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity, transform: [{ scale }] }]}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primary + "1A" }]}>
                <Ionicons name="checkmark-circle" size={64} color={theme.primary} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>
                {t("emailVerifySuccess.title")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}>
                {t("emailVerifySuccess.subtitle")}
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                activeOpacity={0.85}
                onPress={handleGoHome}
              >
                <Text style={styles.buttonText}>{t("emailVerifySuccess.goHome")}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {status === "error" && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: "#FF3B3020" }]}>
                <Ionicons name="close-circle" size={64} color="#FF3B30" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>
                {t("emailVerifySuccess.errorTitle")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}>
                {errorMessage || t("emailVerifySuccess.errorDefault")}
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                activeOpacity={0.85}
                onPress={handleGoHome}
              >
                <Text style={styles.buttonText}>{t("emailVerifySuccess.goHome")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "500",
  },
  card: {
    width: "100%",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
    alignItems: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
  },
  button: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
});
