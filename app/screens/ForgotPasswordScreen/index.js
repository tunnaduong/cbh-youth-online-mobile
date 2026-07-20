import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ProgressHUD from "../../components/ProgressHUD";
import { forgotPassword } from "../../services/api/Api";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import LiquidButton from "../../components/LiquidButton";

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // scrollY for LiquidButton (static screen — always show button border)
  const scrollY = new Animated.Value(60);

  const handleSendResetLink = async () => {
    if (!email) {
      Alert.alert(t("forgotPassword.failureTitle"), t("forgotPassword.missingEmail"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t("forgotPassword.invalidEmailTitle"), t("forgotPassword.invalidEmailBody"));
      return;
    }

    setLoading(true);

    try {
      const response = await forgotPassword({ email });

      if (response.data && response.data.status === "success") {
        Alert.alert(
          t("forgotPassword.successTitle"),
          t("forgotPassword.successBody") || response.data.message,
          [{ text: t("common.ok"), onPress: () => {}, style: "default" }]
        );
      } else {
        throw new Error(response.data?.message || t("common.error"));
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t("common.error");
      Alert.alert(t("forgotPassword.failureTitle"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText={t("forgotPassword.loading")} visible={loading} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Floating back button */}
            <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
              <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={theme.primary} />
              </LiquidButton>
            </View>

            {/* Scrollable content */}
            <Animated.ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + 32 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header text */}
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {t("forgotPassword.title")}
                </Text>
                <Text style={[styles.subtitle, { color: theme.subText }]}>
                  {t("forgotPassword.subtitle")}
                </Text>
              </View>

              {/* Email card */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.inputRow}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={theme.primary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="hello@example.com"
                    placeholderTextColor={theme.subText}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleSendResetLink}
                activeOpacity={0.85}
              >
                <Text style={styles.submitButtonText}>
                  {t("forgotPassword.sendLink")}
                </Text>
              </TouchableOpacity>

              {/* Back to login */}
              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                style={styles.backToLogin}
                activeOpacity={0.7}
              >
                <Text style={[styles.backToLoginText, { color: theme.primary }]}>
                  {t("forgotPassword.backToLogin")}
                </Text>
              </TouchableOpacity>
            </Animated.ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerText: {
    marginBottom: 28,
    marginTop: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  submitButton: {
    height: 52,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backToLogin: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: "500",
  },
});

export default ForgotPasswordScreen;
