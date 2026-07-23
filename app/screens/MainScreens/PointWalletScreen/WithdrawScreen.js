import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import { getWalletBalance, requestWithdrawal } from "../../../services/api/Api";

const getPayload = (response) => response?.data ?? response ?? {};
const localeMap = { vi: "vi-VN", en: "en-US", ru: "ru-RU" };
const formatNumber = (value, lang) =>
  Number(value || 0).toLocaleString(localeMap[lang] || "vi-VN");

export default function WithdrawScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "vi";
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("500");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel={t("wallet.backLabel")}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t("wallet.withdrawScreen.title")}</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.balanceCard, { backgroundColor: "#EAF8EE" }]}>
          <View style={styles.balanceIcon}><Ionicons name="wallet-outline" size={24} color="#168348" /></View>
          <View style={styles.balanceCopy}>
            <Text style={[styles.muted, { color: theme.subText }]}>{t("wallet.withdrawScreen.currentBalance")}</Text>
            <Text style={styles.balanceValue}>{t("wallet.pointsValue", { value: formatNumber(balance?.points, lang) })}</Text>
            <Text style={[styles.muted, { color: theme.subText }]}>{t("wallet.approxVnd", { value: `${formatNumber(balance?.vnd, lang)} VND` })}</Text>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.title, { color: theme.text }]}>{t("wallet.withdrawScreen.formTitle")}</Text>
          <Text style={[styles.description, { color: theme.subText }]}>{t("wallet.withdrawScreen.formDescription")}</Text>
          <Label theme={theme} text={t("wallet.withdrawScreen.amountLabel")} />
          <TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder={t("wallet.withdrawScreen.amountPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Text style={[styles.helper, { color: theme.subText }]}>
            {t("wallet.withdrawScreen.conversionHelper", {
              value: formatNumber(estimatedVnd, lang),
              note: requestedAmount >= 500 ? t("wallet.withdrawScreen.conversionNote") : "",
            })}
          </Text>
          <Label theme={theme} text={t("wallet.withdrawScreen.bankAccountLabel")} />
          <TextInput value={bankAccount} onChangeText={setBankAccount} keyboardType="number-pad" placeholder={t("wallet.withdrawScreen.bankAccountPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Label theme={theme} text={t("wallet.withdrawScreen.bankNameLabel")} />
          <TextInput value={bankName} onChangeText={setBankName} placeholder={t("wallet.withdrawScreen.bankNamePlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Label theme={theme} text={t("wallet.withdrawScreen.accountHolderLabel")} />
          <TextInput value={accountHolder} onChangeText={setAccountHolder} autoCapitalize="characters" placeholder={t("wallet.withdrawScreen.accountHolderPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <View style={[styles.notice, { backgroundColor: theme.background }]}><Ionicons name="information-circle-outline" size={20} color="#D97706" /><Text style={[styles.noticeText, { color: theme.subText }]}>{t("wallet.withdrawScreen.notice")}</Text></View>
          <TouchableOpacity disabled={submitting} onPress={handleSubmit} style={[styles.submit, submitting && { opacity: 0.65 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send-outline" size={20} color="#fff" />}<Text style={styles.submitText}>{submitting ? t("wallet.withdrawScreen.submitting") : t("wallet.withdrawScreen.submit")}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}><Text style={[styles.cancelText, { color: theme.subText }]}>{t("wallet.withdrawScreen.cancel")}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ theme, text }) { return <Text style={[styles.label, { color: theme.text }]}>{text}</Text>; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  iconButton: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  balanceCard: { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  balanceIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#D5F1DE", alignItems: "center", justifyContent: "center" },
  balanceCopy: { flex: 1 },
  muted: { fontSize: 13 },
  balanceValue: { color: "#168348", fontSize: 24, fontWeight: "800", marginVertical: 2 },
  card: { borderRadius: 18, padding: 18 },
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
