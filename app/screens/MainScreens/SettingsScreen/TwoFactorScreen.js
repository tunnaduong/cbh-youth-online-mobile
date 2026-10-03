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
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  getTwoFactorStatus,
  setupTwoFactorTotp,
  setupTwoFactorEmail,
  sendTwoFactorEmailCode,
  confirmTwoFactor,
  disableTwoFactor,
  regenerateTwoFactorRecoveryCodes,
  forgetTwoFactorTrustedDevices,
} from "../../../services/api/Api";

const errorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

// Two-factor authentication settings: turn it on (email code or
// authenticator app), turn it off, recovery codes and remembered devices.
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
  // null | "choose" | "confirm" | "recovery" | "disable" | "regenerate"
  const [mode, setMode] = useState(null);
  const [method, setMethod] = useState("email");
  const [setup, setSetup] = useState(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getTwoFactorStatus()
      .then((res) => {
        if (cancelled) return;
        setStatus(res.data);
        // Email codes need a verified address to be sent to.
        if (!res.data.email_verified) setMethod("totp");
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = () => {
    setMode(null);
    setSetup(null);
    setPassword("");
    setCode("");
    setError("");
  };

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const request = method === "totp" ? setupTwoFactorTotp : setupTwoFactorEmail;
      const res = await request({ password });
      setSetup(res.data);
      setPassword("");
      setCode("");
      setMode("confirm");
    });

  const confirmSetup = () =>
    run(async () => {
      const res = await confirmTwoFactor({ code: code.trim() });
      setRecoveryCodes(res.data.recovery_codes || []);
      setStatus(res.data.status);
      setSetup(null);
      setCode("");
      setMode("recovery");
    });

  const cancelSetup = () => {
    // Drop the half-finished setup on the server too (nothing was enforced yet).
    disableTwoFactor().catch(() => {});
    reset();
  };

  // Turning two-factor off and replacing recovery codes both need the
  // password, or a current code for accounts without a usable password.
  const identityParams = () =>
    status.password_required ? { password } : { code: code.trim() };

  const confirmDisable = () =>
    run(async () => {
      const res = await disableTwoFactor(identityParams());
      setStatus(res.data.status);
      reset();
      Toast.show({ type: "success", text1: res.data.message });
    });

  const confirmRegenerate = () =>
    run(async () => {
      const res = await regenerateTwoFactorRecoveryCodes(identityParams());
      setRecoveryCodes(res.data.recovery_codes || []);
      setStatus(res.data.status);
      setPassword("");
      setCode("");
      setMode("recovery");
    });

  const sendEmailCode = async () => {
    try {
      const res = await sendTwoFactorEmailCode();
      Toast.show({ type: "success", text1: res.data?.message || t("twoFactor.codeSent") });
    } catch (err) {
      Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
    }
  };

  const forgetDevices = async () => {
    try {
      const res = await forgetTwoFactorTrustedDevices();
      setStatus(res.data.status);
      Toast.show({ type: "success", text1: res.data.message });
    } catch (err) {
      Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
    }
  };

  const copy = (text) => {
    Clipboard.setString(text);
    Toast.show({ type: "success", text1: t("twoFactor.copied") });
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

  const onToggle = (value) => {
    setError("");
    setPassword("");
    setCode("");
    setMode(value ? "choose" : "disable");
  };

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" },
  ];
  const cardStyle = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  const PrimaryButton = ({ title, onPress, danger, disabled }) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: danger ? "#FF3B30" : theme.primary }, (disabled || busy) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
    >
      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>{title}</Text>}
    </TouchableOpacity>
  );

  const SecondaryButton = ({ title, onPress }) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: isDarkMode ? "#374151" : "#ddd" }]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.85}
    >
      <Text style={[styles.buttonText, { color: theme.text }]}>{title}</Text>
    </TouchableOpacity>
  );

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
      {status?.method === "email" && (
        <TouchableOpacity onPress={sendEmailCode} style={styles.link}>
          <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("twoFactor.sendCodeToEmail")}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const MethodOption = ({ value, title, description, disabled }) => (
    <TouchableOpacity
      style={[styles.methodRow, disabled && { opacity: 0.5 }]}
      onPress={() => setMethod(value)}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name={method === value ? "radio-button-on" : "radio-button-off"}
        size={22}
        color={theme.primary}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: theme.text, fontSize: 16 }}>{title}</Text>
        {description ? <Text style={{ color: theme.subText, fontSize: 13, marginTop: 2 }}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
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
              <View style={cardStyle}>
                <View style={styles.toggleRow}>
                  <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]}>
                    {t("twoFactor.enable")}
                  </Text>
                  <Switch
                    value={!!status.enabled}
                    onValueChange={onToggle}
                    disabled={mode !== null}
                    trackColor={{ true: theme.primary }}
                  />
                </View>
                <Text style={[styles.description, { color: theme.subText }]}>
                  {t("twoFactor.description")}
                </Text>
              </View>

              {status.enabled && mode === null && (
                <View style={cardStyle}>
                  <Text style={[styles.row, { color: theme.text }]}>
                    {t("twoFactor.activeMethod")}:{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {status.method === "email" ? t("twoFactor.methodEmail") : t("twoFactor.methodTotp")}
                    </Text>
                    {status.method === "email" && status.email ? ` (${status.email})` : ""}
                  </Text>
                  <Text style={[styles.row, { color: theme.text }]}>
                    {t("twoFactor.recoveryRemaining")}: {status.recovery_codes_remaining}
                  </Text>
                  <TouchableOpacity onPress={() => setMode("regenerate")} style={styles.link}>
                    <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("twoFactor.regenerate")}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.row, { color: theme.text, marginTop: 8 }]}>
                    {t("twoFactor.trustedDevices")}: {status.trusted_devices}
                  </Text>
                  {status.trusted_devices > 0 && (
                    <TouchableOpacity onPress={forgetDevices} style={styles.link}>
                      <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("twoFactor.forgetDevices")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {mode === "choose" && (
                <View style={cardStyle}>
                  <MethodOption
                    value="email"
                    title={t("twoFactor.methodEmail")}
                    description={status.email_verified ? status.email : t("twoFactor.emailNotVerified")}
                    disabled={!status.email_verified}
                  />
                  <MethodOption
                    value="totp"
                    title={t("twoFactor.methodTotp")}
                    description={t("twoFactor.methodTotpDesc")}
                  />
                  {status.password_required && (
                    <TextInput
                      style={[inputStyle, { marginTop: 12 }]}
                      placeholder={t("twoFactor.currentPassword")}
                      placeholderTextColor={theme.subText}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  )}
                  <View style={styles.actions}>
                    <SecondaryButton title={t("twoFactor.cancel")} onPress={reset} />
                    <PrimaryButton title={t("twoFactor.continue")} onPress={startSetup} />
                  </View>
                </View>
              )}

              {mode === "confirm" && setup && (
                <View style={cardStyle}>
                  {setup.method === "totp" ? (
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
                        <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("twoFactor.copy")}</Text>
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
                  {setup.method === "email" && (
                    <TouchableOpacity onPress={sendEmailCode} style={styles.link}>
                      <Text style={{ color: theme.primary, fontWeight: "600" }}>{t("twoFactor.resend")}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.actions}>
                    <SecondaryButton title={t("twoFactor.cancel")} onPress={cancelSetup} />
                    <PrimaryButton title={t("twoFactor.confirmEnable")} onPress={confirmSetup} disabled={!code.trim()} />
                  </View>
                </View>
              )}

              {mode === "recovery" && (
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
                    <SecondaryButton title={t("twoFactor.copy")} onPress={() => copy(recoveryCodes.join("\n"))} />
                    <PrimaryButton
                      title={t("twoFactor.saved")}
                      onPress={() => {
                        setRecoveryCodes([]);
                        reset();
                      }}
                    />
                  </View>
                </View>
              )}

              {(mode === "disable" || mode === "regenerate") && (
                <View style={cardStyle}>
                  <Text style={[styles.description, { color: theme.subText, marginTop: 0, marginBottom: 12 }]}>
                    {mode === "disable" ? t("twoFactor.disableDesc") : t("twoFactor.regenerateDesc")}
                  </Text>
                  {identityFields}
                  <View style={styles.actions}>
                    <SecondaryButton title={t("twoFactor.cancel")} onPress={reset} />
                    <PrimaryButton
                      title={mode === "disable" ? t("twoFactor.disable") : t("twoFactor.regenerate")}
                      danger={mode === "disable"}
                      onPress={mode === "disable" ? confirmDisable : confirmRegenerate}
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

      <Toast topOffset={60} />
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
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
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
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
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
