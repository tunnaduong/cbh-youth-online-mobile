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
import CheckBox from "react-native-check-box";
import { signupRequest, loginWithOAuth } from "../../services/api/Api";
import { loginWithGoogle, loginWithFacebook } from "../../services/oauth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import LiquidButton from "../../components/LiquidButton";

const SignupScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useContext(AuthContext);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  // scrollY fixed at 60 so LiquidButton always shows its border
  const scrollY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then((available) => setIsAppleAuthAvailable(available))
      .catch((e) => console.log("Apple Auth Check Error:", e));
  }, []);

  const handleSignup = async () => {
    if (!agreeToTerms) {
      Alert.alert(t("signup.failureTitle"), t("signup.mustAgree"));
      return;
    }

    if (!username || !name || !email || !password || !confirmPassword) {
      Alert.alert(t("common.error"), t("signup.missingInfo"));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("signup.passwordMismatchTitle"), t("signup.passwordMismatchBody"));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t("common.error"), t("signup.passwordLength"));
      return;
    }

    setLoading(true);

    signupRequest({
      username,
      name,
      email,
      password,
    })
      .then((response) => {
        signIn(response.data.token, response.data.user);
        Alert.alert(
          t("auth.signupSuccess"),
          t("auth.signupSuccessBody"),
          [
            {
              text: t("common.ok"),
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "MainScreens" }],
                });
              },
            },
          ]
        );
      })
      .catch((error) => {
        Alert.alert(t("auth.signupError"), error.response.data.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleGoogleSignup = async () => {
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
        throw new Error(t("signup.invalidResponse"));
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t("signup.googleError");

      Alert.alert(t("signup.failureTitle"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignup = async () => {
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
        throw new Error(t("signup.invalidResponse"));
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t("signup.facebookError");

      Alert.alert(t("signup.failureTitle"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignup = async () => {
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
        throw new Error(t("signup.invalidResponse"));
      }
    } catch (error) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          t("signup.appleError");
        Alert.alert(t("signup.failureTitle"), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText={t("signup.loading")} visible={loading} />
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
              {/* Header Text */}
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {t("signup.title")}
                </Text>
                <Text style={[styles.subtitle, { color: theme.subText }]}>
                  {t("signup.subtitle")}
                </Text>
              </View>

              {/* Social buttons First */}
              {isAppleAuthAvailable && (
                <TouchableOpacity
                  style={[
                    styles.socialButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  onPress={handleAppleSignup}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-apple" size={22} color={theme.text} />
                  <Text style={[styles.socialButtonText, { color: theme.text }]}>
                    {t("signup.apple")}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={handleGoogleSignup}
                activeOpacity={0.8}
              >
                <Image
                  source={require("../../assets/google.png")}
                  style={{ width: 22, height: 22 }}
                />
                <Text style={[styles.socialButtonText, { color: theme.text }]}>
                  {t("signup.google")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={handleFacebookSignup}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-facebook" size={22} color="#1877F2" />
                <Text style={[styles.socialButtonText, { color: theme.text }]}>
                  {t("signup.facebook")}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.orText, { color: theme.subText }]}>
                  {t("signup.or")}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              {/* Inputs Card */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {/* Username */}
                <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                  <Ionicons name="at-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="john_doe"
                    placeholderTextColor={theme.subText}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>

                {/* Full Name */}
                <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                  <Ionicons name="person-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="John Doe"
                    placeholderTextColor={theme.subText}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>

                {/* Email */}
                <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="hello@example.com"
                    placeholderTextColor={theme.subText}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Password */}
                <View style={[styles.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.subText}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="password"
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

                {/* Confirm Password */}
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.subText}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    textContentType="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms Checkbox */}
              <View style={styles.checkboxContainer}>
                <CheckBox
                  isChecked={agreeToTerms}
                  onClick={() => setAgreeToTerms(!agreeToTerms)}
                  checkBoxColor={theme.primary}
                />
                <Text style={[styles.checkboxLabel, { color: theme.subText }]}>
                  {t("signup.agreePrefix")} {" "}
                  <Text
                    style={[styles.link, { color: theme.primary }]}
                    onPress={() => navigation.navigate("TermsOfServiceScreen")}
                  >
                    {t("signup.terms")}
                  </Text>
                  {" "}{t("signup.and")}{" "}
                  <Text
                    style={[styles.link, { color: theme.primary }]}
                    onPress={() => navigation.navigate("PrivacyPolicyScreen")}
                  >
                    {t("signup.privacy")}
                  </Text>
                </Text>
              </View>

              {/* Signup Button */}
              <TouchableOpacity
                style={[styles.signUpButton, { backgroundColor: theme.primary }]}
                onPress={handleSignup}
                activeOpacity={0.85}
              >
                <Text style={styles.signUpButtonText}>{t("signup.createAccount")}</Text>
              </TouchableOpacity>

              {/* Login Prompt */}
              <View style={styles.loginPrompt}>
                <Text style={[styles.loginPromptText, { color: theme.subText }]}>
                  {t("signup.hasAccount")}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={[styles.loginLink, { color: theme.primary }]}>
                    {t("signup.login")}
                  </Text>
                </TouchableOpacity>
              </View>

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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontSize: 13,
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 16,
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
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  link: {
    fontWeight: "500",
  },
  signUpButton: {
    height: 52,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  signUpButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  loginPromptText: {
    fontSize: 15,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default SignupScreen;
