import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { useTheme } from "../../../contexts/ThemeContext";
import { createDepositRequest, getWalletBalance } from "../../../services/api/Api";

const getPayload = (response) => response?.data ?? response ?? {};
const localeMap = { vi: "vi-VN", en: "en-US", ru: "ru-RU" };
const formatNumber = (value, lang) =>
  Number(value || 0).toLocaleString(localeMap[lang] || "vi-VN");

const BANK_ACCOUNT = "99421112003";
const BANK_NAME = "TPBank";

export default function DepositScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "vi";
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("50000");
  const [depositInfo, setDepositInfo] = useState(null);
  const [initialPoints, setInitialPoints] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadInitialBalance = useCallback(async () => {
    try {
      const response = await getWalletBalance();
      setInitialPoints(Number(getPayload(response)?.points || 0));
    } catch (error) {
      setInitialPoints(0);
    }
  }, []);

  useEffect(() => {
    loadInitialBalance();
  }, [loadInitialBalance]);

  useEffect(() => {
    if (!depositInfo || initialPoints === null) return undefined;
    const interval = setInterval(async () => {
      try {
        const response = await getWalletBalance();
        const currentPoints = Number(getPayload(response)?.points || 0);
        if (currentPoints > initialPoints) {
          setDepositInfo(null);
          Toast.show({ type: "success", text1: t("wallet.depositScreen.depositSuccessTitle"), text2: t("wallet.depositScreen.depositSuccessMessage") });
          navigation.navigate("PointWalletScreen");
        }
      } catch (error) {
        // Polling is best effort; the user can use the manual refresh button.
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [depositInfo, initialPoints, navigation, t]);

  const handleCreate = async () => {
    const amountVnd = Number(String(amount).replace(/\D/g, ""));
    if (!amountVnd || amountVnd < 10000) {
      Toast.show({ type: "error", text1: t("wallet.depositScreen.invalidAmountTitle"), text2: t("wallet.depositScreen.invalidAmountMessage") });
      return;
    }
    try {
      setSubmitting(true);
      const response = await createDepositRequest({ amount_vnd: amountVnd });
      const info = getPayload(response);
      setDepositInfo({ ...info, amount_vnd: info.amount_vnd || amountVnd });
      Toast.show({ type: "success", text1: t("wallet.depositScreen.createSuccess") });
    } catch (error) {
      Toast.show({ type: "error", text1: t("wallet.depositScreen.createErrorTitle"), text2: error?.response?.data?.message || t("wallet.depositScreen.createErrorDefault") });
    } finally {
      setSubmitting(false);
    }
  };

  const checkBalance = async () => {
    setChecking(true);
    try {
      const response = await getWalletBalance();
      const currentPoints = Number(getPayload(response)?.points || 0);
      if (initialPoints !== null && currentPoints > initialPoints) {
        setDepositInfo(null);
        Toast.show({ type: "success", text1: t("wallet.depositScreen.depositSuccessTitle") });
        navigation.navigate("PointWalletScreen");
      } else {
        Toast.show({ type: "info", text1: t("wallet.depositScreen.notReceivedTitle"), text2: t("wallet.depositScreen.notReceivedMessage") });
      }
    } catch (error) {
      Toast.show({ type: "error", text1: t("wallet.depositScreen.checkErrorTitle") });
    } finally {
      setChecking(false);
    }
  };

  const expectedPoints = Math.floor(Math.max(0, Number(depositInfo?.amount_vnd || amount || 0) - 1000) / 100);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 74, backgroundColor: "transparent" }]} pointerEvents="box-none">
        <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()} roundedOnScroll>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: scrollY.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: "clamp" }) }]}> 
          {t("wallet.depositScreen.title")}
        </Animated.Text>
        <View style={{ width: 44 }} />
      </View>
      <Animated.ScrollView contentContainerStyle={{ paddingTop: 78 + insets.top, paddingHorizontal: 16, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled" onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16}>
        {!depositInfo ? (
          <>
            <IntroCard theme={theme} isDarkMode={isDarkMode} icon="add-circle-outline" title={t("wallet.depositScreen.introTitle")} text={t("wallet.depositScreen.introText")} />
            <View style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }]}> 
              <Label theme={theme} text={t("wallet.depositScreen.amountLabel")} />
              <TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder={t("wallet.depositScreen.amountPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
              <Text style={[styles.helperText, { color: theme.subText }]}> 
                {t("wallet.depositScreen.helperText", { value: formatNumber(Math.floor(Math.max(0, Number(amount || 0) - 1000) / 100), lang) })}
              </Text>
              <InfoBox theme={theme} isDarkMode={isDarkMode} text={t("wallet.depositScreen.feeInfo")} />
              <PrimaryButton title={t("wallet.depositScreen.createCode")} icon="qr-code-outline" onPress={handleCreate} loading={submitting} />
            </View>
          </>
        ) : (
          <>
            <IntroCard theme={theme} isDarkMode={isDarkMode} icon="qr-code-outline" title={t("wallet.depositScreen.transferInfoTitle")} text={t("wallet.depositScreen.transferInfoText")} />
            <View style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }]}> 
              <LinearGradient colors={isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.amountPanel}>
                <Text style={[styles.mutedLabel, { color: "#C7F5D7" }]}>{t("wallet.depositScreen.amountToTransfer")}</Text>
                <Text style={styles.amountValue}>{formatNumber(depositInfo.amount_vnd, lang)} VND</Text>
                <Text style={[styles.expectedText, { color: "#FFFFFF" }]}> {t("wallet.depositScreen.expectedPoints", { value: formatNumber(depositInfo.expected_points || expectedPoints, lang) })}</Text>
              </LinearGradient>
              <View style={[styles.qrBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#FFFFFF" }]}> 
                <Image source={{ uri: `https://qr.sepay.vn/img?acc=${BANK_ACCOUNT}&bank=${BANK_NAME}&amount=${depositInfo.amount_vnd}&des=${depositInfo.deposit_code}&template=compact` }} style={styles.qr} />
              </View>
              <Text style={[styles.qrCaption, { color: theme.subText }]}>{t("wallet.depositScreen.qrCaption")}</Text>
              <TransferRow theme={theme} label={t("wallet.depositScreen.bankLabel")} value={BANK_NAME} />
              <TransferRow theme={theme} label={t("wallet.depositScreen.accountNumberLabel")} value={BANK_ACCOUNT} />
              <TransferRow theme={theme} label={t("wallet.depositScreen.accountHolderLabel")} value={t("wallet.depositScreen.accountHolderValue")} />
              <View style={[styles.contentPanel, { borderColor: theme.primary, backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#FFFFFF" }]}> 
                <Text style={[styles.mutedLabel, { color: theme.subText }]}>{t("wallet.depositScreen.transferContentLabel")}</Text>
                <Text selectable style={[styles.transferCode, { color: theme.text }]}>{depositInfo.deposit_code}</Text>
              </View>
              <InfoBox theme={theme} isDarkMode={isDarkMode} text={t("wallet.depositScreen.expiryNotice", { value: depositInfo.expires_at ? new Date(depositInfo.expires_at).toLocaleString(localeMap[lang] || "vi-VN") : t("wallet.depositScreen.expiryFallback") })} />
              <PrimaryButton title={checking ? t("wallet.depositScreen.checking") : t("wallet.depositScreen.confirmTransfer")} icon="refresh-outline" onPress={checkBalance} loading={checking} />
              <TouchableOpacity onPress={() => setDepositInfo(null)} style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: theme.subText }]}>{t("wallet.depositScreen.createAnotherCode")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

function IntroCard({ theme, isDarkMode, icon, title, text }) {
  return (
    <View style={[styles.intro, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }]}> 
      <View style={styles.introIcon}><Ionicons name={icon} size={26} color="#1476C6" /></View>
      <View style={styles.introCopy}><Text style={[styles.introTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.introText, { color: theme.subText }]}>{text}</Text></View>
    </View>
  );
}
function Label({ theme, text }) { return <Text style={[styles.label, { color: theme.text }]}>{text}</Text>; }
function InfoBox({ theme, isDarkMode, text }) { return <View style={[styles.infoBox, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC" }]}><Ionicons name="information-circle-outline" size={20} color={theme.primary} /><Text style={[styles.infoText, { color: theme.subText }]}>{text}</Text></View>; }
function TransferRow({ theme, label, value }) { return <View style={[styles.transferRow, { borderBottomColor: theme.border }]}><Text style={[styles.mutedLabel, { color: theme.subText }]}>{label}</Text><Text selectable style={[styles.transferValue, { color: theme.text }]}>{value}</Text></View>; }
function PrimaryButton({ title, icon, onPress, loading }) { return <TouchableOpacity disabled={loading} onPress={onPress} style={[styles.primaryButton, loading && { opacity: 0.65 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={20} color="#fff" />}<Text style={styles.primaryText}>{title}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  largeTitle: { fontSize: 28, fontWeight: "800", marginBottom: 12 },
  intro: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, marginBottom: 14, gap: 12, borderWidth: 1, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  introIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E8F4FF", alignItems: "center", justifyContent: "center" },
  introCopy: { flex: 1 },
  introTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  introText: { fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 20, padding: 18, borderWidth: 1, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  label: { fontWeight: "700", fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  helperText: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 16 },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, marginBottom: 18 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 52, borderRadius: 13, backgroundColor: "#168348", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  amountPanel: { alignItems: "center", padding: 16, borderRadius: 14, marginBottom: 18 },
  mutedLabel: { fontSize: 12 },
  amountValue: { fontSize: 25, fontWeight: "800", color: "#FFFFFF", marginVertical: 5 },
  expectedText: { fontSize: 13, fontWeight: "700" },
  qrBox: { paddingVertical: 8, borderRadius: 16, marginBottom: 8 },
  qr: { width: 220, height: 220, alignSelf: "center", marginVertical: 4 },
  qrCaption: { textAlign: "center", fontSize: 12, marginBottom: 16 },
  transferRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  transferValue: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  contentPanel: { borderWidth: 2, borderRadius: 14, padding: 14, marginTop: 16, marginBottom: 16 },
  transferCode: { fontSize: 20, fontWeight: "900", letterSpacing: 1, marginTop: 7 },
  secondaryButton: { alignItems: "center", padding: 14 },
  secondaryText: { fontWeight: "700" },
});
