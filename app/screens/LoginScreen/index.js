import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../contexts/AuthContext";
import ProgressHUD from "../../components/ProgressHUD";
import { Ionicons } from "@expo/vector-icons";
import { loginRequest, loginWithOAuth } from "../../services/api/Api";
import { loginWithGoogle, loginWithFacebook } from "../../services/oauth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../components/LiquidButton";

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  // scrollY fixed at 60 so LiquidButton always shows its border (static screen)
  const scrollY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then((available) => setIsAppleAuthAvailable(available))
      .catch((e) => console.log("Apple Auth Check Error:", e));
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("common.error"), t("auth.fillAllFields"));
      return;
    }

    setLoading(true);
    try {
      const response = await loginRequest({ username: email, password });
      if (!response?.data?.token || !response?.data?.user) {
        throw new Error(t("auth.invalidServerResponse"));
      }
      signIn(response.data.token, response.data.user);
    } catch (error) {
      let errorMessage = error.message || t("common.error");
      if (
        errorMessage &&
        (errorMessage.toLowerCase().includes("bcrypt") ||
          errorMessage.toLowerCase().includes("algorithm"))
      ) {
        errorMessage = t("auth.passwordResetRequired", {
          defaultValue:
            errorMessage +
            "\n\n" +
            t("auth.tryForgotPassword", {
              defaultValue: "Vui lòng thử dùng 'Quên mật khẩu' để đặt lại mật khẩu.",
            }),
        });
      }
      Alert.alert(t("auth.loginError"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const oauthResult = await loginWithGoogle();
      const response = await loginWithOAuth({
        provider: oauthResult.provider,
        accessToken: oauthResult.accessToken,
        idToken: oauthResult.idToken,
        profile: oauthResult.profile,
      });
      if (response.data && response.data.token) {
        signIn(response.data.token, response.data.user);
      } else {
        throw new Error(t("auth.invalidServerResponse"));
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t("auth.googleLoginError");
      Alert.alert(t("auth.loginError"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const oauthResult = await loginWithFacebook();
      const response = await loginWithOAuth({
        provider: oauthResult.provider,
        accessToken: oauthResult.accessToken,
        idToken: oauthResult.idToken,
        profile: oauthResult.profile,
      });
      if (response.data && response.data.token) {
        signIn(response.data.token, response.data.user);
      } else {
        throw new Error(t("auth.invalidServerResponse"));
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t("auth.facebookLoginError");
      Alert.alert(t("auth.loginError"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const response = await loginWithOAuth({
        provider: "apple",
        idToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email,
        fullName: credential.fullName,
        user: credential.user,
      });
      if (response.data && response.data.token) {
        signIn(response.data.token, response.data.user);
      } else {
        throw new Error(t("auth.invalidServerResponse"));
      }
    } catch (error) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          t("auth.appleLoginError");
        Alert.alert(t("auth.loginError"), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText={t("auth.loggingIn")} visible={loading} />
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

            <Animated.ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + 32 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {t("auth.login")}
                </Text>
                <Text style={[styles.subtitle, { color: theme.subText }]}>
                  {t("auth.welcome")}
                </Text>
              </View>

              {/* Credentials card */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {/* Username / Email row */}
                <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                  <Ionicons
                    name="person-outline"
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
                    autoComplete="username"
                    textContentType="username"
                    importantForAutofill="yes"
                  />
                </View>

                {/* Password row */}
                <View style={styles.inputRow}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.primary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.subText}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="current-password"
                    importantForAutofill="yes"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate("ForgotPassword")}
                activeOpacity={0.7}
              >
                <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                  {t("auth.forgotPasswordLink")}
                </Text>
              </TouchableOpacity>

              {/* Login button */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: theme.primary }]}
                onPress={handleLogin}
                activeOpacity={0.85}
              >
                <Text style={styles.loginButtonText}>{t("auth.login")}</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.orText, { color: theme.subText }]}>
                  {t("auth.orLoginWith")}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              {/* Social buttons */}
              {isAppleAuthAvailable && (
                <TouchableOpacity
                  style={[
                    styles.socialButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  onPress={handleAppleLogin}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-apple" size={22} color={theme.text} />
                  <Text style={[styles.socialButtonText, { color: theme.text }]}>
                    {t("auth.continueWithApple")}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={handleGoogleLogin}
                activeOpacity={0.8}
              >
                <Image
                  source={require("../../assets/google.png")}
                  style={{ width: 22, height: 22 }}
                />
                <Text style={[styles.socialButtonText, { color: theme.text }]}>
                  {t("auth.continueWithGoogle")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={handleFacebookLogin}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-facebook" size={22} color="#1877F2" />
                <Text style={[styles.socialButtonText, { color: theme.text }]}>
                  {t("auth.continueWithFacebook")}
                </Text>
              </TouchableOpacity>

              {/* Sign up */}
              <TouchableOpacity
                onPress={() => navigation.navigate("Signup")}
                style={styles.signupLink}
                activeOpacity={0.7}
              >
                <Text style={[styles.signupText, { color: theme.primary }]}>
                  {t("auth.createAccount")}
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
    marginBottom: 12,
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
  forgotPassword: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loginButton: {
    height: 52,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontSize: 13,
    paddingHorizontal: 12,
  },
  socialButton: {
    height: 52,
    borderRadius: 38,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  signupLink: {
    alignSelf: "center",
    marginTop: 4,
    paddingVertical: 8,
  },
  signupText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default LoginScreen;
