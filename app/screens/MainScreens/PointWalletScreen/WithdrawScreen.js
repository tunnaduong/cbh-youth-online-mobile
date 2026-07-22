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
import { useTheme } from "../../../contexts/ThemeContext";
import { getWalletBalance, requestWithdrawal } from "../../../services/api/Api";

const getPayload = (response) => response?.data ?? response ?? {};
const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

export default function WithdrawScreen({ navigation }) {
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
      Toast.show({ type: "error", text1: "Không thể tải số dư", text2: "Vui lòng thử lại sau." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const handleSubmit = async () => {
    const withdrawalAmount = Number(String(amount).replace(/\D/g, ""));
    if (withdrawalAmount < 500) {
      Toast.show({ type: "error", text1: "Số điểm chưa hợp lệ", text2: "Số điểm tối thiểu để rút là 500 điểm." });
      return;
    }
    if (withdrawalAmount > Number(balance?.points || 0)) {
      Toast.show({ type: "error", text1: "Số điểm không đủ", text2: "Vui lòng nhập số điểm nhỏ hơn số dư hiện tại." });
      return;
    }
    if (!bankAccount.trim() || !bankName.trim() || !accountHolder.trim()) {
      Toast.show({ type: "error", text1: "Thiếu thông tin nhận tiền", text2: "Vui lòng điền đủ thông tin ngân hàng." });
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
      Toast.show({ type: "success", text1: "Đã gửi yêu cầu rút tiền", text2: "Vui lòng chờ quản trị viên duyệt." });
      navigation.navigate("PointWalletScreen");
    } catch (error) {
      Toast.show({ type: "error", text1: "Gửi yêu cầu thất bại", text2: error?.response?.data?.message || "Vui lòng thử lại." });
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel="Quay lại"><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Rút tiền</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.balanceCard, { backgroundColor: "#EAF8EE" }]}> 
          <View style={styles.balanceIcon}><Ionicons name="wallet-outline" size={24} color="#168348" /></View>
          <View style={styles.balanceCopy}><Text style={[styles.muted, { color: theme.subText }]}>Số dư hiện tại</Text><Text style={styles.balanceValue}>{formatNumber(balance?.points)} điểm</Text><Text style={[styles.muted, { color: theme.subText }]}>≈ {formatNumber(balance?.vnd)} VND</Text></View>
        </View>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}> 
          <Text style={[styles.title, { color: theme.text }]}>Yêu cầu rút tiền</Text>
          <Text style={[styles.description, { color: theme.subText }]}>Điểm sẽ được tạm giữ cho đến khi yêu cầu được duyệt.</Text>
          <Label theme={theme} text="Số điểm muốn rút" />
          <TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="Tối thiểu 500" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Text style={[styles.helper, { color: theme.subText }]}>Quy đổi khoảng {formatNumber(estimatedVnd)} VND {requestedAmount >= 500 ? `(sau phí xử lý theo chính sách)` : ""}</Text>
          <Label theme={theme} text="Số tài khoản ngân hàng" />
          <TextInput value={bankAccount} onChangeText={setBankAccount} keyboardType="number-pad" placeholder="Nhập số tài khoản" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Label theme={theme} text="Tên ngân hàng" />
          <TextInput value={bankName} onChangeText={setBankName} placeholder="VD: Vietcombank, TPBank" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <Label theme={theme} text="Tên chủ tài khoản" />
          <TextInput value={accountHolder} onChangeText={setAccountHolder} autoCapitalize="characters" placeholder="NGUYEN VAN A" placeholderTextColor={theme.placeholder} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
          <View style={[styles.notice, { backgroundColor: theme.background }]}><Ionicons name="information-circle-outline" size={20} color="#D97706" /><Text style={[styles.noticeText, { color: theme.subText }]}>Mức rút tối thiểu là 500 điểm. Chỉ có thể rút điểm từ doanh thu bán tài liệu theo chính sách của hệ thống.</Text></View>
          <TouchableOpacity disabled={submitting} onPress={handleSubmit} style={[styles.submit, submitting && { opacity: 0.65 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send-outline" size={20} color="#fff" />}<Text style={styles.submitText}>{submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancel}><Text style={[styles.cancelText, { color: theme.subText }]}>Hủy</Text></TouchableOpacity>
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
