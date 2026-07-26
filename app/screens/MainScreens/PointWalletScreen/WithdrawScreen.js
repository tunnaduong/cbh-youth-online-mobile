import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
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
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import { getWalletBalance, requestWithdrawal } from "../../../services/api/Api";

const getPayload = (response) => response?.data ?? response ?? {};
const localeMap = { vi: "vi-VN", en: "en-US", ru: "ru-RU" };
const formatNumber = (value, lang) =>
  Number(value || 0).toLocaleString(localeMap[lang] || "vi-VN");

export default function WithdrawScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "vi";
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("500");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadBalance = useCallback(async () => {
    try {
      const response = await getWalletBalance();
      setBalance(getPayload(response));
    } catch (error) {
      Toast.show({ type: "error", text1: t("wallet.withdrawScreen.loadBalanceErrorTitle"), text2: t("wallet.withdrawScreen.loadBalanceErrorDefault") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const handleSubmit = async () => {
    const withdrawalAmount = Number(String(amount).replace(/\D/g, ""));
    if (withdrawalAmount < 500) {
      Toast.show({ type: "error", text1: t("wallet.withdrawScreen.invalidAmountTitle"), text2: t("wallet.withdrawScreen.invalidAmountMessage") });
      return;
    }
    if (withdrawalAmount > Number(balance?.points || 0)) {
      Toast.show({ type: "error", text1: t("wallet.withdrawScreen.insufficientTitle"), text2: t("wallet.withdrawScreen.insufficientMessage") });
      return;
    }
    if (!bankAccount.trim() || !bankName.trim() || !accountHolder.trim()) {
      Toast.show({ type: "error", text1: t("wallet.withdrawScreen.missingInfoTitle"), text2: t("wallet.withdrawScreen.missingInfoMessage") });
      return;
    }
    try {
      setSubmitting(true);
      await requestWithdrawal({
        amount: withdrawalAmount,
        bank_account: bankAccount.trim(),
        bank_name: bankName.trim(),
        account_holder: accountHolder.trim().toUpperCase(),
      });
      Toast.show({ type: "success", text1: t("wallet.withdrawScreen.submitSuccessTitle"), text2: t("wallet.withdrawScreen.submitSuccessMessage") });
      navigation.navigate("PointWalletScreen");
    } catch (error) {
      Toast.show({ type: "error", text1: t("wallet.withdrawScreen.submitErrorTitle"), text2: error?.response?.data?.message || t("wallet.withdrawScreen.submitErrorDefault") });
    } finally {
      setSubmitting(false);
    }
  };

  const requestedAmount = Number(String(amount || 0).replace(/\D/g, ""));
  const estimatedVnd = requestedAmount * 100;

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 74, backgroundColor: "transparent" }]} pointerEvents="box-none">
        <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()} roundedOnScroll>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: scrollY.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: "clamp" }) }]}> 
          {t("wallet.withdrawScreen.title")}
        </Animated.Text>
        <View style={{ width: 44 }} />
      </View>
      <Animated.ScrollView contentContainerStyle={{ paddingTop: 78 + insets.top, paddingHorizontal: 16, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled" onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16}>
        <LinearGradient colors={isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balanceCard, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
          <View style={styles.balanceIcon}><Ionicons name="wallet-outline" size={24} color="#FFFFFF" /></View>
          <View style={styles.balanceCopy}>
            <Text style={[styles.muted, { color: "#C7F5D7" }]}>{t("wallet.withdrawScreen.currentBalance")}</Text>
            <Text style={styles.balanceValue}>{t("wallet.pointsValue", { value: formatNumber(balance?.points, lang) })}</Text>
            <Text style={[styles.muted, { color: "#C7F5D7" }]}>{t("wallet.approxVnd", { value: `${formatNumber(balance?.vnd, lang)} VND` })}</Text>
          </View>
        </LinearGradient>
        <View style={[styles.card, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
          <Text style={[styles.title, { color: theme.text }]}>{t("wallet.withdrawScreen.formTitle")}</Text>
          <Text style={[styles.description, { color: theme.subText }]}>{t("wallet.withdrawScreen.formDescription")}</Text>
          <Label theme={theme} text={t("wallet.withdrawScreen.amountLabel")} />
          <TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder={t("wallet.withdrawScreen.amountPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Text style={[styles.helper, { color: theme.subText }]}> 
            {t("wallet.withdrawScreen.conversionHelper", { value: formatNumber(estimatedVnd, lang), note: requestedAmount >= 500 ? t("wallet.withdrawScreen.conversionNote") : "" })}
          </Text>
          <Label theme={theme} text={t("wallet.withdrawScreen.bankAccountLabel")} />
          <TextInput value={bankAccount} onChangeText={setBankAccount} keyboardType="number-pad" placeholder={t("wallet.withdrawScreen.bankAccountPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Label theme={theme} text={t("wallet.withdrawScreen.bankNameLabel")} />
          <TextInput value={bankName} onChangeText={setBankName} placeholder={t("wallet.withdrawScreen.bankNamePlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Label theme={theme} text={t("wallet.withdrawScreen.accountHolderLabel")} />
          <TextInput value={accountHolder} onChangeText={setAccountHolder} autoCapitalize="characters" placeholder={t("wallet.withdrawScreen.accountHolderPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <View style={[styles.notice, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC" }]}><Ionicons name="information-circle-outline" size={20} color="#D97706" /><Text style={[styles.noticeText, { color: theme.subText }]}>{t("wallet.withdrawScreen.notice")}</Text></View>
          <TouchableOpacity disabled={submitting} onPress={handleSubmit} style={[styles.submit, submitting && { opacity: 0.65 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send-outline" size={20} color="#fff" />}<Text style={styles.submitText}>{submitting ? t("wallet.withdrawScreen.submitting") : t("wallet.withdrawScreen.submit")}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}><Text style={[styles.cancelText, { color: theme.subText }]}>{t("wallet.withdrawScreen.cancel")}</Text></TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ theme, text }) { return <Text style={[styles.label, { color: theme.text }]}>{text}</Text>; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  largeTitle: { fontSize: 28, fontWeight: "800", marginBottom: 12 },
  balanceCard: { borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14, shadowColor: "#0F172A", shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  balanceIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  balanceCopy: { flex: 1 },
  muted: { fontSize: 13 },
  balanceValue: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginVertical: 2 },
  card: { borderRadius: 20, padding: 18, borderWidth: 1, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 5 },
  description: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  helper: { fontSize: 12, marginTop: 7 },
  notice: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, marginTop: 20, marginBottom: 18 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  submit: { minHeight: 52, borderRadius: 13, backgroundColor: "#168348", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancel: { alignItems: "center", padding: 14 },
  cancelText: { fontWeight: "700" },
});
