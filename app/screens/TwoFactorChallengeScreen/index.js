import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "../../utils/apiMessage";
import { AuthContext } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import ProgressHUD from "../../components/ProgressHUD";
import AuthBackground from "../../components/AuthBackground";
import AuthButton from "../../components/AuthButton";
import LiquidButton from "../../components/LiquidButton";
import {
  verifyTwoFactorLogin,
  resendTwoFactorLoginCode,
  startLoginApproval,
  getLoginApprovalStatus,
} from "../../services/api/Api";
import {
  getDeviceName,
  getTwoFactorDeviceToken,
  setTwoFactorDeviceToken,
} from "../../utils/deviceInfo";

// Second step of a login for accounts with two-factor on: the password (or
// Google/Facebook/Apple) step passed, and the API wants a code before it
// issues a token. `route.params.challenge` is that API response.
const TwoFactorChallengeScreen = ({ navigation, route }) => {
  const challenge = route.params?.challenge || {};
  const { signIn } = useContext(AuthContext);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // An account can have several methods on. `methods` lists them (older API
  // responses only name one); the user picks which code to enter.
  const methods = challenge.methods?.length ? challenge.methods : [challenge.method];
  const [method, setMethod] = useState(challenge.method);
  // The API only emails a code up front when email is the method it offers
  // first, so picking email later has to send one.
  const [emailSent, setEmailSent] = useState(
    challenge.method === "email" && challenge.email_sent !== false
  );

  const isEmail = method === "email";

  // "device": approve this login on a device that is already logged in. This
  // screen shows a number; the other device shows three and the user picks
  // this one. `useRecovery` switches to typing a recovery code instead.
  const [useRecovery, setUseRecovery] = useState(false);
  const isDevice = method === "device" && !useRecovery;
  // { status: "starting" | "pending" | "denied" | "expired" | "error", number, message }
  const [approval, setApproval] = useState(null);
  const rememberRef = useRef(rememberDevice);
  rememberRef.current = rememberDevice;

  const startApproval = async () => {
    setApproval({ status: "starting" });
    try {
      const response = await startLoginApproval({ challenge_token: challenge.challenge_token });
      setApproval({ status: "pending", number: response.data.number });
    } catch (error) {
      const message = apiErrorMessage(error, t("common.error"));
      if (error.response?.data?.challenge_expired) {
        handleExpired(message);
      } else {
        setApproval({ status: "error", message });
      }
    }
  };

  // Ask as soon as the method is shown.
  useEffect(() => {
    if (isDevice && approval === null) startApproval();
  }, [isDevice]);

  // Wait for the answer from the other device.
  useEffect(() => {
    if (!isDevice || approval?.status !== "pending") return undefined;
    let stopped = false;

    const timer = setInterval(async () => {
      try {
        const response = await getLoginApprovalStatus({
          challenge_token: challenge.challenge_token,
          remember_device: rememberRef.current,
          device_name: getDeviceName(),
          device_token: (await getTwoFactorDeviceToken()) || undefined,
        });
        if (stopped) return;

        const data = response?.data;
        if (data?.status === "approved" && data.token && data.user) {
          stopped = true;
          clearInterval(timer);
          await setTwoFactorDeviceToken(data.device_token);
          signIn(data.token, data.user);
        } else if (data?.status === "denied" || data?.status === "expired") {
          setApproval((current) => ({ ...current, status: data.status }));
        }
      } catch (error) {
        if (stopped) return;
        if (error.response?.data?.challenge_expired) {
          stopped = true;
          clearInterval(timer);
          handleExpired(apiErrorMessage(error, t("common.error")));
        }
        // Anything else (a network blip): keep waiting, the next poll retries.
      }
    }, 2500);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [isDevice, approval?.status]);

  // Expired or out of attempts: the only way forward is logging in again.
  const handleExpired = (message) => {
    Alert.alert(t("auth.loginError"), message, [
      { text: t("common.ok", "OK"), onPress: () => navigation.goBack() },
    ]);
  };

  const handleVerify = async () => {
    if (!code.trim() || loading) return;

    setLoading(true);
    try {
      const response = await verifyTwoFactorLogin({
        challenge_token: challenge.challenge_token,
        code: code.trim(),
        method: method && method !== "device" ? method : undefined,
        remember_device: rememberDevice,
        device_name: getDeviceName(),
        device_token: (await getTwoFactorDeviceToken()) || undefined,
      });

      const data = response?.data;
      if (!data?.token || !data?.user) {
        throw new Error(t("auth.invalidServerResponse"));
      }

      await setTwoFactorDeviceToken(data.device_token);

      if (typeof data.recovery_codes_remaining === "number") {
        Alert.alert(
          t("twoFactor.title"),
          t("twoFactor.recoveryUsed", { remaining: data.recovery_codes_remaining })
        );
      }

      signIn(data.token, data.user);
    } catch (error) {
      const data = error.response?.data;
      const message = apiErrorMessage(error, t("common.error"));
      if (data?.challenge_expired) {
        handleExpired(message);
      } else {
        Alert.alert(t("auth.loginError"), message);
      }
    } finally {
      setLoading(false);
    }
  };

  // `silent` is the automatic first send when the user switches to email:
  // the subtitle already says where the code went, so no extra alert.
  const handleResend = async (silent = false) => {
    if (resending) return;

    setResending(true);
    try {
      const response = await resendTwoFactorLoginCode({
        challenge_token: challenge.challenge_token,
      });
      setEmailSent(true);
      if (!silent) {
        Alert.alert(t("twoFactor.title"), t("twoFactor.codeSent"));
      }
    } catch (error) {
      const data = error.response?.data;
      const message = apiErrorMessage(error, t("common.error"));
      if (data?.challenge_expired) {
        handleExpired(message);
      } else {
        Alert.alert(t("common.error"), message);
      }
    } finally {
      setResending(false);
    }
  };

  const chooseMethod = (next) => {
    if (next === method || loading) return;
    setMethod(next);
    setUseRecovery(false);
    setCode("");
    if (next === "email" && !emailSent) handleResend(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AuthBackground />
      <ProgressHUD loadText={t("twoFactor.verifying")} visible={loading} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
            <LiquidButton size={44} onPress={() => navigation.goBack()} containerStyle={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>

            <View style={styles.content}>
              <Text style={[styles.title, { color: theme.text }]}>
                {t("twoFactor.title")}
              </Text>
              {methods.length > 1 && (
                <View style={[styles.methodTabs, { borderColor: theme.border }]}>
                  {methods.map((item) => {
                    const selected = item === method;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.methodTab, selected && { backgroundColor: theme.primary }]}
                        onPress={() => chooseMethod(item)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.methodTabText, { color: selected ? "#fff" : theme.text }]}
                          numberOfLines={1}
                        >
                          {item === "email"
                            ? t("twoFactor.methodEmail")
                            : item === "device"
                              ? t("twoFactor.methodDeviceShort")
                              : t("twoFactor.methodTotp")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Text style={[styles.subtitle, { color: theme.subText }]}>
                {isDevice
                  ? t("twoFactor.challengeDevice")
                  : method === "device"
                    ? t("twoFactor.challengeRecovery")
                    : isEmail
                      ? t("twoFactor.challengeEmail", { email: challenge.email || "email" })
                      : t("twoFactor.challengeTotp")}
              </Text>

              {isDevice && (
                <View style={[styles.approvalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {approval?.status === "pending" ? (
                    <>
                      <Text style={[styles.approvalNumber, { color: theme.primary }]}>
                        {approval.number}
                      </Text>
                      <View style={styles.approvalWaiting}>
                        <ActivityIndicator size="small" color={theme.subText} />
                        <Text style={[styles.approvalText, { color: theme.subText }]}>
                          {t("twoFactor.approvalWaiting")}
                        </Text>
                      </View>
                    </>
                  ) : approval?.status === "denied" || approval?.status === "expired" || approval?.status === "error" ? (
                    <>
                      <Ionicons name="close-circle-outline" size={40} color="#FF3B30" />
                      <Text style={[styles.approvalText, { color: theme.text, marginTop: 8 }]}>
                        {approval.status === "denied"
                          ? t("twoFactor.approvalDenied")
                          : approval.status === "expired"
                            ? t("twoFactor.approvalExpired")
                            : approval.message}
                      </Text>
                      <TouchableOpacity style={styles.linkButton} onPress={startApproval} activeOpacity={0.7}>
                        <Text style={[styles.linkText, { color: theme.primary }]}>
                          {t("twoFactor.approvalRetry")}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <ActivityIndicator color={theme.primary} />
                  )}
                </View>
              )}

              {!isDevice && (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={21}
                  color={theme.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("twoFactor.code")}
                  placeholderTextColor={theme.subText}
                  value={code}
                  onChangeText={setCode}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
              </View>
              )}

              <View style={styles.rememberRow}>
                <Text style={[styles.rememberText, { color: theme.text }]}>
                  {t("twoFactor.rememberDevice")}
                </Text>
                <Switch
                  value={rememberDevice}
                  onValueChange={setRememberDevice}
                  trackColor={{ true: theme.primary }}
                />
              </View>

              {!isDevice && (
              <AuthButton
                style={styles.verifyButton}
                onPress={handleVerify}
                disabled={!code.trim()}
              >
                <Text style={styles.verifyButtonText}>{t("twoFactor.verify")}</Text>
              </AuthButton>
              )}

              {isEmail && (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => handleResend()}
                  disabled={resending}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.linkText, { color: theme.primary }, resending && { opacity: 0.5 }]}>
                    {t("twoFactor.resend")}
                  </Text>
                </TouchableOpacity>
              )}

              {method === "device" ? (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => {
                    setCode("");
                    setUseRecovery((value) => !value);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.linkText, { color: theme.primary }]}>
                    {useRecovery ? t("twoFactor.approvalBack") : t("twoFactor.useRecoveryCode")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.hint, { color: theme.subText }]}>
                  {t("twoFactor.recoveryHint")}
                </Text>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 60,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  methodTabs: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 3,
    marginTop: 16,
  },
  methodTab: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 22,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    height: 60,
  },
  approvalCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 18,
    minHeight: 150,
  },
  approvalNumber: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: 4,
  },
  approvalWaiting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  approvalText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  rememberText: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  verifyButton: {
    height: 52,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
});

export default TwoFactorChallengeScreen;
