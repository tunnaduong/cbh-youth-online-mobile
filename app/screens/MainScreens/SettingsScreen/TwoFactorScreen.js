import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ActivityIndicator,
  Switch,
  Linking,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";
import AppToast from "../../../components/AppToast";
import { apiErrorMessage } from "../../../utils/apiMessage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  getTwoFactorStatus,
  setupTwoFactorTotp,
  setupTwoFactorEmail,
  setupTwoFactorDevice,
  sendTwoFactorEmailCode,
  confirmTwoFactor,
  disableTwoFactor,
  regenerateTwoFactorRecoveryCodes,
  forgetTwoFactorTrustedDevices,
  setTwoFactorSocialLogin,
} from "../../../services/api/Api";

// Every method can be on at the same time; at login the user picks one.
const METHODS = ["email", "totp", "device"];

const RECOVERY_FILE_NAME = "cbh-youth-online-recovery-codes.txt";

// In the app's language (the API only answers in Vietnamese).
const errorMessage = (error, fallback) => apiErrorMessage(error, fallback);

// These live at module level on purpose: defined inside the screen they
// would be new component types on every render, so each keystroke or state
// change remounted every button (losing press feedback).
const PrimaryButton = ({ title, onPress, danger, disabled, busy, theme }) => (
  <TouchableOpacity
    style={[styles.button, { backgroundColor: danger ? "#FF3B30" : theme.primary }, (disabled || busy) && { opacity: 0.6 }]}
    onPress={onPress}
    disabled={disabled || busy}
    activeOpacity={0.85}
  >
    {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>{title}</Text>}
  </TouchableOpacity>
);

const SecondaryButton = ({ title, onPress, busy, theme, isDarkMode }) => (
  <TouchableOpacity
    style={[styles.button, { backgroundColor: isDarkMode ? "#374151" : "#ddd" }, busy && { opacity: 0.6 }]}
    onPress={onPress}
    disabled={busy}
    activeOpacity={0.85}
  >
    <Text style={[styles.buttonText, { color: theme.text }]}>{title}</Text>
  </TouchableOpacity>
);

// Two-factor authentication settings: one switch per method (email code,
// authenticator app), recovery codes and remembered devices.
export default function TwoFactorScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);
  // The step in progress, if any:
  //   { type: "setup" | "confirm" | "disable", method }
  //   { type: "recovery" } | { type: "regenerate" }
  const [flow, setFlow] = useState(null);
  const [setup, setSetup] = useState(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [forgettingDevices, setForgettingDevices] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getTwoFactorStatus()
      .then((res) => {
        if (!cancelled) setStatus(res.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledMethods = status?.methods || [];
  const isOn = (method) => enabledMethods.includes(method);
  const methodLabel = (method) =>
    method === "email"
      ? t("twoFactor.methodEmail")
      : method === "device"
        ? t("twoFactor.methodDevice")
        : t("twoFactor.methodTotp");

  const reset = () => {
    setFlow(null);
    setSetup(null);
    setPassword("");
    setCode("");
    setError("");
  };

  // Resolves to whether the action went through.
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (err) {
      setError(errorMessage(err, t("common.error")));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startSetup = (method) =>
    run(async () => {
      // Approving on a logged-in device has no code to confirm: the password
      // was the proof, so it is on as soon as the API answers.
      if (method === "device") {
        const res = await setupTwoFactorDevice({ password });
        setStatus(res.data.status);
        setPassword("");
        if (res.data.recovery_codes?.length) {
          setRecoveryCodes(res.data.recovery_codes);
          setFlow({ type: "recovery" });
        } else {
          reset();
          Toast.show({ type: "success", text1: t("twoFactor.methodEnabled") });
        }
        return;
      }

      const request = method === "totp" ? setupTwoFactorTotp : setupTwoFactorEmail;
      const res = await request({ password });
      setSetup(res.data);
      setPassword("");
      setCode("");
      setFlow({ type: "confirm", method });
    });

  const confirmSetup = () => {
    if (!code.trim() || busy) return;

    return run(async () => {
      const res = await confirmTwoFactor({ method: flow.method, code: code.trim() });
      setStatus(res.data.status);
      setSetup(null);
      setCode("");

      // Recovery codes only come with the first method; adding another one
      // keeps the codes the user already has.
      if (res.data.recovery_codes?.length) {
        setRecoveryCodes(res.data.recovery_codes);
        setFlow({ type: "recovery" });
      } else {
        reset();
        Toast.show({ type: "success", text1: t("twoFactor.methodEnabled") });
      }
    });
  };

  // Drop the half-finished setup on the server too (nothing was enforced
  // yet). Awaited, with the controls locked meanwhile: if the user started a
  // new setup straight away, this request could land after it and wipe it.
  const cancelSetup = async (method) => {
    setBusy(true);
    try {
      await disableTwoFactor({ method });
    } catch {
      // A leftover unconfirmed setup is harmless and is replaced by the next one.
    } finally {
      setBusy(false);
    }
    reset();
  };

  // Turning a method off and replacing recovery codes both need the
  // password, or a current code for accounts without a usable password.
  const identityParams = () =>
    status.password_required ? { password } : { code: code.trim() };

  // The confirm button stays off until its field has something in it, so an
  // empty submit can't come back as a "wrong password" error.
  const identityFilled = status?.password_required ? !!password : !!code.trim();

  const confirmDisable = () =>
    run(async () => {
      const res = await disableTwoFactor({ method: flow.method, ...identityParams() });
      setStatus(res.data.status);
      reset();
      Toast.show({ type: "success", text1: t("twoFactor.methodDisabled") });
    });

  const confirmRegenerate = () =>
    run(async () => {
      const res = await regenerateTwoFactorRecoveryCodes(identityParams());
      setRecoveryCodes(res.data.recovery_codes || []);
      setStatus(res.data.status);
      setPassword("");
      setCode("");
      setFlow({ type: "recovery" });
    });

  // sendingCode / forgettingDevices keep a double tap from firing the
  // request twice (the second "send code" would only hit the resend cooldown
  // and show an error right after the success toast).
  const sendEmailCode = async () => {
    if (sendingCode) return;
    setSendingCode(true);
    try {
      const res = await sendTwoFactorEmailCode();
      Toast.show({ type: "success", text1: t("twoFactor.codeSent") });
    } catch (err) {
      Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
    } finally {
      setSendingCode(false);
    }
  };

  // Whether Google/Facebook/Apple logins skip the second step. The switch
  // flips at once and goes back if the API refuses.
  const [savingSocial, setSavingSocial] = useState(false);
  const toggleSocialLogin = async (skip) => {
    if (savingSocial) return;
    setSavingSocial(true);
    const before = status;
    setStatus({ ...status, skip_social_login: skip });
    try {
      const res = await setTwoFactorSocialLogin(skip);
      setStatus(res.data.status);
      Toast.show({
        type: "success",
        text1: t(skip ? "twoFactor.socialSkipOn" : "twoFactor.socialSkipOff"),
      });
    } catch (err) {
      setStatus(before);
      Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
    } finally {
      setSavingSocial(false);
    }
  };

  const forgetDevices = async () => {
    if (forgettingDevices) return;
    setForgettingDevices(true);
    try {
      const res = await forgetTwoFactorTrustedDevices();
      setStatus(res.data.status);
      Toast.show({ type: "success", text1: t("twoFactor.devicesForgotten") });
    } catch (err) {
      Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
    } finally {
      setForgettingDevices(false);
    }
  };

  const copy = (text) => {
    Clipboard.setString(text);
    Toast.show({ type: "success", text1: t("twoFactor.copied") });
  };

  // "Download" on a phone: write the codes to a .txt and open the share
  // sheet, where the user saves it to Files / Drive or sends it to
  // themselves. The temporary copy is removed afterwards.
  const downloadRecoveryCodes = async () => {
    const uri = `${FileSystem.cacheDirectory}${RECOVERY_FILE_NAME}`;
    const text = [
      t("twoFactor.recoveryFileTitle"),
      t("twoFactor.recoveryFileNote"),
      "",
      ...recoveryCodes,
      "",
    ].join("\r\n");

    try {
      await FileSystem.writeAsStringAsync(uri, text);
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("sharing unavailable");
      }
      await Sharing.shareAsync(uri, {
        mimeType: "text/plain",
        UTI: "public.plain-text",
        dialogTitle: RECOVERY_FILE_NAME,
      });
    } catch {
      Toast.show({ type: "error", text1: t("twoFactor.downloadError") });
    } finally {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  };

  // The authenticator app is usually on this same phone, so instead of a QR
  // code (nothing here could scan it) hand it the otpauth:// link directly.
  const openAuthenticator = async () => {
    try {
      await Linking.openURL(setup.otpauth_url);
    } catch {
      Toast.show({ type: "info", text1: t("twoFactor.noAuthenticator") });
    }
  };

  // A switch shows where the user is heading with that method, not just
  // what is saved (a controlled Switch whose value doesn't follow the flip
  // snaps back under the finger), and flipping it back cancels the step.
  const switchValue = (method) => {
    if (flow?.method === method) return flow.type !== "disable";
    return isOn(method);
  };

  const onToggle = (method) => {
    if (busy) return;

    if (flow?.method === method) {
      if (flow.type === "confirm") {
        cancelSetup(method);
      } else {
        reset();
      }
      return;
    }

    setError("");
    setPassword("");
    setCode("");

    if (isOn(method)) {
      setFlow({ type: "disable", method });
    } else if (status.password_required) {
      setFlow({ type: "setup", method });
    } else {
      // Nothing to ask first: go straight to the code step. If that fails
      // (e.g. the resend cooldown) the switch goes back off, with the error
      // left on screen.
      setFlow({ type: "setup", method });
      startSetup(method).then((started) => {
        if (!started) setFlow(null);
      });
    }
  };

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" },
  ];
  const cardStyle = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  const linkTextStyle = { color: theme.primary, fontWeight: "600" };

  const identityFields = status?.password_required ? (
    <TextInput
      style={inputStyle}
      placeholder={t("twoFactor.currentPassword")}
      placeholderTextColor={theme.subText}
      secureTextEntry
      value={password}
      onChangeText={setPassword}
    />
  ) : (
    <>
      <TextInput
        style={inputStyle}
        placeholder={t("twoFactor.codeOrRecovery")}
        placeholderTextColor={theme.subText}
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
      />
      {isOn("email") && (
        <TouchableOpacity
          onPress={sendEmailCode}
          disabled={sendingCode}
          style={[styles.link, sendingCode && { opacity: 0.5 }]}
        >
          <Text style={linkTextStyle}>{t("twoFactor.sendCodeToEmail")}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <View style={styles.headerSide}>
            <LiquidButton size={44} scrollY={scrollY} providerId="TwoFactorScreen" onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t("twoFactor.title")}
          </Animated.Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="TwoFactorScreen" style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <Text style={{ color: theme.subText, textAlign: "center", marginTop: 24 }}>
              {t("twoFactor.loadError")}
            </Text>
          ) : !status ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              <Text style={[styles.intro, { color: theme.subText }]}>
                {t("twoFactor.multiDescription")}
              </Text>

              <View style={[cardStyle, styles.methodsCard]}>
                {METHODS.map((method, index) => {
                  const needsVerifiedEmail =
                    method === "email" && !status.email_verified && !isOn("email");
                  // One step at a time: the other switch waits until this one is done.
                  const blocked = flow !== null && flow.method !== method;
                  const hint = needsVerifiedEmail
                    ? t("twoFactor.emailNotVerified")
                    : method === "email"
                      ? status.email || t("twoFactor.methodEmailDesc")
                      : method === "device"
                        ? t("twoFactor.methodDeviceDesc")
                        : t("twoFactor.methodTotpDesc");

                  return (
                    <View
                      key={method}
                      style={[
                        styles.methodRow,
                        index < METHODS.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.border,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>
                          {methodLabel(method)}
                        </Text>
                        <Text style={[styles.methodHint, { color: theme.subText }]}>{hint}</Text>
                      </View>
                      <Switch
                        value={switchValue(method)}
                        onValueChange={() => onToggle(method)}
                        disabled={busy || blocked || needsVerifiedEmail}
                        trackColor={{ true: theme.primary }}
                      />
                    </View>
                  );
                })}
              </View>

              {flow?.type === "setup" && status.password_required && (
                <View style={cardStyle}>
                  <Text style={[styles.description, { color: theme.subText, marginTop: 0, marginBottom: 12 }]}>
                    {t("twoFactor.enterPassword", { method: methodLabel(flow.method) })}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    placeholder={t("twoFactor.currentPassword")}
                    placeholderTextColor={theme.subText}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                  <View style={styles.actions}>
                    <SecondaryButton theme={theme} busy={busy} isDarkMode={isDarkMode} title={t("twoFactor.cancel")} onPress={reset} />
                    <PrimaryButton
                      theme={theme}
                      busy={busy}
                      title={t("twoFactor.continue")}
                      onPress={() => startSetup(flow.method)}
                      disabled={!password}
                    />
                  </View>
                </View>
              )}

              {flow?.type === "confirm" && setup && (
                <View style={cardStyle}>
                  {flow.method === "totp" ? (
                    <>
                      <Text style={[styles.description, { color: theme.subText, marginTop: 0 }]}>
                        {t("twoFactor.totpInstructions")}
                      </Text>
                      <TouchableOpacity
                        style={[styles.button, styles.fullButton, { backgroundColor: theme.primary }]}
                        onPress={openAuthenticator}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.buttonText}>{t("twoFactor.openAuthenticator")}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.row, { color: theme.subText }]}>{t("twoFactor.secretKey")}</Text>
                      <Text selectable style={[styles.secret, { color: theme.text }]}>
                        {setup.secret}
                      </Text>
                      <TouchableOpacity onPress={() => copy(setup.secret)} style={styles.link}>
                        <Text style={linkTextStyle}>{t("twoFactor.copy")}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={[styles.description, { color: theme.subText, marginTop: 0 }]}>
                      {t("twoFactor.emailSent", { email: setup.email })}
                    </Text>
                  )}
                  <TextInput
                    style={[inputStyle, { marginTop: 12 }]}
                    placeholder={t("twoFactor.codePlaceholder")}
                    placeholderTextColor={theme.subText}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={7}
                  />
                  {flow.method === "email" && (
                    <TouchableOpacity
                      onPress={sendEmailCode}
                      disabled={sendingCode}
                      style={[styles.link, sendingCode && { opacity: 0.5 }]}
                    >
                      <Text style={linkTextStyle}>{t("twoFactor.resend")}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.actions}>
                    <SecondaryButton
                      theme={theme}
                      busy={busy}
                      isDarkMode={isDarkMode}
                      title={t("twoFactor.cancel")}
                      onPress={() => cancelSetup(flow.method)}
                    />
                    <PrimaryButton
                      theme={theme}
                      busy={busy}
                      title={t("twoFactor.confirmMethod")}
                      onPress={confirmSetup}
                      disabled={!code.trim()}
                    />
                  </View>
                </View>
              )}

              {flow?.type === "recovery" && (
                <View style={cardStyle}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{t("twoFactor.recoveryTitle")}</Text>
                  <Text style={[styles.description, { color: theme.subText }]}>{t("twoFactor.recoveryDesc")}</Text>
                  <View style={[styles.codes, { backgroundColor: theme.iconBackground }]}>
                    {recoveryCodes.map((item) => (
                      <Text key={item} selectable style={[styles.codeItem, { color: theme.text }]}>
                        {item}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.actions}>
                    <SecondaryButton
                      theme={theme}
                      busy={busy}
                      isDarkMode={isDarkMode}
                      title={t("twoFactor.copy")}
                      onPress={() => copy(recoveryCodes.join("\n"))}
                    />
                    <SecondaryButton
                      theme={theme}
                      busy={busy}
                      isDarkMode={isDarkMode}
                      title={t("twoFactor.download")}
                      onPress={downloadRecoveryCodes}
                    />
                  </View>
                  <View style={styles.actions}>
                    <PrimaryButton
                      theme={theme}
                      busy={busy}
                      title={t("twoFactor.saved")}
                      onPress={() => {
                        setRecoveryCodes([]);
                        reset();
                      }}
                    />
                  </View>
                </View>
              )}

              {(flow?.type === "disable" || flow?.type === "regenerate") && (
                <View style={cardStyle}>
                  <Text style={[styles.description, { color: theme.subText, marginTop: 0, marginBottom: 12 }]}>
                    {flow.type === "regenerate"
                      ? t("twoFactor.regenerateDesc")
                      : t(
                          enabledMethods.length > 1
                            ? "twoFactor.disableMethodKeep"
                            : "twoFactor.disableMethodLast",
                          { method: methodLabel(flow.method) }
                        )}
                  </Text>
                  {identityFields}
                  <View style={styles.actions}>
                    <SecondaryButton theme={theme} busy={busy} isDarkMode={isDarkMode} title={t("twoFactor.cancel")} onPress={reset} />
                    <PrimaryButton
                      theme={theme}
                      busy={busy}
                      title={flow.type === "disable" ? t("twoFactor.disableMethod") : t("twoFactor.regenerate")}
                      danger={flow.type === "disable"}
                      onPress={flow.type === "disable" ? confirmDisable : confirmRegenerate}
                      disabled={!identityFilled}
                    />
                  </View>
                </View>
              )}

              {status.enabled && flow === null && (
                <View style={cardStyle}>
                  <Text style={[styles.row, { color: theme.text }]}>
                    {t("twoFactor.recoveryRemaining")}: {status.recovery_codes_remaining}
                  </Text>
                  <TouchableOpacity onPress={() => setFlow({ type: "regenerate" })} style={styles.link}>
                    <Text style={linkTextStyle}>{t("twoFactor.regenerate")}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.row, { color: theme.text, marginTop: 8 }]}>
                    {t("twoFactor.trustedDevices")}: {status.trusted_devices}
                  </Text>
                  {status.trusted_devices > 0 && (
                    <TouchableOpacity
                      onPress={forgetDevices}
                      disabled={forgettingDevices}
                      style={[styles.link, forgettingDevices && { opacity: 0.5 }]}
                    >
                      <Text style={linkTextStyle}>{t("twoFactor.forgetDevices")}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={[styles.methodRow, { marginTop: 12 }]}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={[styles.row, { color: theme.text }]}>
                        {t("twoFactor.skipSocialLogin")}
                      </Text>
                      <Text style={[styles.methodHint, { color: theme.subText }]}>
                        {t("twoFactor.skipSocialLoginDesc")}
                      </Text>
                    </View>
                    <Switch
                      value={status.skip_social_login !== false}
                      onValueChange={toggleSocialLogin}
                      disabled={savingSocial}
                      trackColor={{ true: theme.primary }}
                    />
                  </View>
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      </AndroidGlassBackdrop>

      <AppToast topOffset={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSide: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  methodsCard: {
    paddingVertical: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  methodHint: {
    fontSize: 13,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  row: {
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  input: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fullButton: {
    flex: 0,
    marginVertical: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    textAlign: "center",
  },
  secret: {
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 4,
  },
  codes: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  codeItem: {
    width: "50%",
    fontSize: 15,
    paddingVertical: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center",
  },
});
