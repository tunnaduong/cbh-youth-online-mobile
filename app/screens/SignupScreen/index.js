import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
  Platform,
  StatusBar,
} from "react-native";
import { AuthContext } from "../../contexts/AuthContext";
import ProgressHUD from "../../components/ProgressHUD";
import Icon from "react-native-vector-icons/Ionicons";
import CheckBox from "react-native-check-box";
import { signupRequest, loginWithOAuth } from "../../services/api/Api";
import { loginWithGoogle, loginWithFacebook } from "../../services/oauth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";

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

  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then((available) => {
      console.log("Apple Auth Available:", available);
      setIsAppleAuthAvailable(available);
    }).catch((e) => console.log("Apple Auth Check Error:", e));
  }, []);

  const handleSignup = async () => {
    if (!agreeToTerms) {
      Alert.alert(t("signup.failureTitle"), t("signup.mustAgree"));
      return;
    }

    if (
      username === "" ||
      name === "" ||
      email === "" ||
      password === "" ||
      confirmPassword === ""
    ) {
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
    if (loading) {
      return;
    }

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
    // Prevent multiple clicks
    if (loading) {
      return;
    }

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
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User canceled, do nothing
      } else {
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          className="mx-6 bg-gray-400 mt-3 h-[40px] w-[40px] rounded-full items-center justify-center"
          onPress={() => {
            navigation.goBack();
          }}
          style={{
            marginTop:
              Platform.OS === "android" ? StatusBar.currentHeight + 10 : 0,
          }}
        >
          <Icon name="chevron-back-outline" color="white" size={30} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>{t("signup.title")}</Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}>{t("signup.subtitle")}</Text>
            </View>

            <View style={styles.form}>

              {isAppleAuthAvailable && (
                <TouchableOpacity
                  style={[styles.appleButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                  onPress={handleAppleSignup}
                >
                  <Icon name="logo-apple" size={24} color={theme.text} />
                  <Text style={[styles.appleButtonText, { color: theme.text }]}>{t("signup.apple")}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={handleGoogleSignup}
              >
                <Image
                  source={require("../../assets/google.png")}
                  style={{ width: 24, height: 24 }}
                />
                <Text style={[styles.googleButtonText, { color: theme.text }]}>{t("signup.google")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.facebookButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={handleFacebookSignup}
              >
                <Icon name="logo-facebook" size={24} color="#1877F2" />
                <Text style={[styles.facebookButtonText, { color: theme.text }]}>
                  {t("signup.facebook")}
                </Text>
              </TouchableOpacity>

              <View style={styles.orContainer}>
                <View style={[styles.orLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.orText, { color: theme.subText }]}>{t("signup.or")}</Text>
                <View style={[styles.orLine, { backgroundColor: theme.border }]} />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>{t("signup.username")}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                  placeholder="john_doe"
                  placeholderTextColor={theme.subText}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>{t("signup.fullName")}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                  placeholder="John Doe"
                  placeholderTextColor={theme.subText}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>{t("signup.email")}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                  placeholder="hello@example.com"
                  placeholderTextColor={theme.subText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>{t("signup.password")}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.subText}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Icon
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={24}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>{t("signup.confirmPassword")}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.subText}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    textContentType="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Icon
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={24}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.checkboxContainer}>
                <CheckBox
                  isChecked={agreeToTerms}
                  onClick={() => {
                    setAgreeToTerms(!agreeToTerms);
                  }}
                  checkBoxColor="#319527"
                />
                <Text style={[styles.checkboxLabel, { color: theme.subText }]}>
                  {t("signup.agreePrefix")} {" "}
                  <Text
                    style={styles.link}
                    onPress={() => navigation.navigate("TermsOfServiceScreen")}
                  >
                    {t("signup.terms")}
                  </Text>{" "}
                  {" "}{t("signup.and")}{" "}
                  <Text
                    style={styles.link}
                    onPress={() => navigation.navigate("PrivacyPolicyScreen")}
                  >
                    {t("signup.privacy")}
                  </Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.signUpButton}
                onPress={handleSignup}
              >
                <Text style={styles.signUpButtonText}>{t("signup.createAccount")}</Text>
              </TouchableOpacity>



              <View style={styles.loginPrompt}>
                <Text style={[styles.loginPromptText, { color: theme.subText }]}>{t("signup.hasAccount")}</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.loginLink}>{t("signup.login")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: "#000",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#FBFFFB",
    color: "#000",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  link: {
    color: "#319527",
  },
  signUpButton: {
    backgroundColor: "#319527",
    height: 50,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  signUpButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  orText: {
    paddingHorizontal: 16,
    color: "#666",
    fontSize: 14,
  },
  googleButton: {
    marginTop: -5,
    height: 48,
    borderRadius: 38,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleButtonText: {
    fontSize: 16,
    color: "#666",
  },
  facebookButton: {
    marginTop: -5,
    height: 48,
    borderRadius: 38,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  facebookButtonText: {
    fontSize: 16,
    color: "#666",
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  loginPromptText: {
    fontSize: 14,
    color: "#666",
  },
  loginLink: {
    fontSize: 14,
    color: "#319527",
    fontWeight: "600",
  },
  appleButton: {
    height: 48,
    borderRadius: 38,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  appleButtonText: {
    fontSize: 16,
    color: "#666",
  },
});

export default SignupScreen;
