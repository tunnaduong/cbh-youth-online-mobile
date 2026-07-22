import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { createDepositRequest, getWalletBalance } from "../../../services/api/Api";

const getPayload = (response) => response?.data ?? response ?? {};
const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

const BANK_ACCOUNT = "99421112003";
const BANK_NAME = "TPBank";

export default function DepositScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("50000");
  const [depositInfo, setDepositInfo] = useState(null);
  const [initialPoints, setInitialPoints] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

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
          Toast.show({ type: "success", text1: "Nạp tiền thành công", text2: "Điểm đã được cộng vào ví của bạn." });
          navigation.navigate("PointWalletScreen");
        }
      } catch (error) {
        // Polling is best effort; the user can use the manual refresh button.
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [depositInfo, initialPoints, navigation]);

  const handleCreate = async () => {
    const amountVnd = Number(String(amount).replace(/\D/g, ""));
    if (!amountVnd || amountVnd < 10000) {
      Toast.show({ type: "error", text1: "Số tiền chưa hợp lệ", text2: "Số tiền nạp tối thiểu là 10.000 VND." });
      return;
    }
    try {
      setSubmitting(true);
      const response = await createDepositRequest({ amount_vnd: amountVnd });
      const info = getPayload(response);
      setDepositInfo({ ...info, amount_vnd: info.amount_vnd || amountVnd });
      Toast.show({ type: "success", text1: "Đã tạo mã nạp tiền" });
    } catch (error) {
      Toast.show({ type: "error", text1: "Không thể tạo mã nạp tiền", text2: error?.response?.data?.message || "Vui lòng thử lại." });
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
        Toast.show({ type: "success", text1: "Nạp tiền thành công" });
        navigation.navigate("PointWalletScreen");
      } else {
        Toast.show({ type: "info", text1: "Chưa nhận được khoản nạp", text2: "Hãy kiểm tra lại sau ít phút." });
      }
    } catch (error) {
      Toast.show({ type: "error", text1: "Không thể kiểm tra số dư" });
    } finally {
      setChecking(false);
    }
  };

  const expectedPoints = Math.floor(Math.max(0, Number(depositInfo?.amount_vnd || amount || 0) - 1000) / 100);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Nạp tiền</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }} keyboardShouldPersistTaps="handled">
        {!depositInfo ? (
          <>
            <IntroCard theme={theme} icon="add-circle-outline" title="Nạp tiền vào ví" text="Chuyển khoản để nhận điểm vào tài khoản của bạn." />
            <View style={[styles.card, { backgroundColor: theme.cardBackground }]}> 
              <Label theme={theme} text="Số tiền muốn nạp (VND)" />
              <TextInput
                value={amount}
                onChangeText={(value) => setAmount(value.replace(/\D/g, ""))}
                keyboardType="number-pad"
                placeholder="Nhập số tiền"
                placeholderTextColor={theme.placeholder}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
              <Text style={[styles.helperText, { color: theme.subText }]}>Tối thiểu 10.000 VND. Dự kiến nhận: {formatNumber(Math.floor(Math.max(0, Number(amount || 0) - 1000) / 100))} điểm.</Text>
              <InfoBox theme={theme} text="Phí nạp là 1.000 VND. Sau khi chuyển khoản thành công, hệ thống sẽ tự động cộng điểm vào ví." />
              <PrimaryButton title="Tạo mã nạp tiền" icon="qr-code-outline" onPress={handleCreate} loading={submitting} />
            </View>
          </>
        ) : (
          <>
            <IntroCard theme={theme} icon="qr-code-outline" title="Thông tin chuyển khoản" text="Chuyển đúng số tiền và nội dung để hệ thống cộng điểm tự động." />
            <View style={[styles.card, { backgroundColor: theme.cardBackground }]}> 
              <View style={styles.amountPanel}>
                <Text style={[styles.mutedLabel, { color: theme.subText }]}>Số tiền cần chuyển</Text>
                <Text style={styles.amountValue}>{formatNumber(depositInfo.amount_vnd)} VND</Text>
                <Text style={[styles.expectedText, { color: theme.primary }]}>Nhận khoảng {formatNumber(depositInfo.expected_points || expectedPoints)} điểm</Text>
              </View>
              <Image
                source={{ uri: `https://qr.sepay.vn/img?acc=${BANK_ACCOUNT}&bank=${BANK_NAME}&amount=${depositInfo.amount_vnd}&des=${depositInfo.deposit_code}&template=compact` }}
                style={styles.qr}
              />
              <Text style={[styles.qrCaption, { color: theme.subText }]}>Quét mã QR bằng ứng dụng ngân hàng</Text>
              <TransferRow theme={theme} label="Ngân hàng" value={BANK_NAME} />
              <TransferRow theme={theme} label="Số tài khoản" value={BANK_ACCOUNT} />
              <TransferRow theme={theme} label="Chủ tài khoản" value="DUONG TUNG ANH" />
              <View style={[styles.contentPanel, { borderColor: theme.primary, backgroundColor: theme.background }]}> 
                <Text style={[styles.mutedLabel, { color: theme.subText }]}>Nội dung chuyển khoản bắt buộc</Text>
                <Text selectable style={[styles.transferCode, { color: theme.text }]}>{depositInfo.deposit_code}</Text>
              </View>
              <InfoBox theme={theme} text={`Mã có hiệu lực đến ${depositInfo.expires_at ? new Date(depositInfo.expires_at).toLocaleString("vi-VN") : "24 giờ kể từ lúc tạo"}. Hãy ghi đúng nội dung chuyển khoản.`} />
              <PrimaryButton title={checking ? "Đang kiểm tra..." : "Tôi đã chuyển khoản"} icon="refresh-outline" onPress={checkBalance} loading={checking} />
              <TouchableOpacity onPress={() => setDepositInfo(null)} style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: theme.subText }]}>Tạo mã khác</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function IntroCard({ theme, icon, title, text }) {
  return <View style={[styles.intro, { backgroundColor: theme.cardBackground }]}><View style={styles.introIcon}><Ionicons name={icon} size={26} color="#1476C6" /></View><View style={styles.introCopy}><Text style={[styles.introTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.introText, { color: theme.subText }]}>{text}</Text></View></View>;
}
function Label({ theme, text }) { return <Text style={[styles.label, { color: theme.text }]}>{text}</Text>; }
function InfoBox({ theme, text }) { return <View style={[styles.infoBox, { backgroundColor: theme.background }]}><Ionicons name="information-circle-outline" size={20} color={theme.primary} /><Text style={[styles.infoText, { color: theme.subText }]}>{text}</Text></View>; }
function TransferRow({ theme, label, value }) { return <View style={[styles.transferRow, { borderBottomColor: theme.border }]}><Text style={[styles.mutedLabel, { color: theme.subText }]}>{label}</Text><Text selectable style={[styles.transferValue, { color: theme.text }]}>{value}</Text></View>; }
function PrimaryButton({ title, icon, onPress, loading }) { return <TouchableOpacity disabled={loading} onPress={onPress} style={[styles.primaryButton, loading && { opacity: 0.65 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={20} color="#fff" />}<Text style={styles.primaryText}>{title}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  iconButton: { width: 32, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  intro: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 18, marginBottom: 14, gap: 12 },
  introIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E8F4FF", alignItems: "center", justifyContent: "center" },
  introCopy: { flex: 1 },
  introTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  introText: { fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 18, padding: 18 },
  label: { fontWeight: "700", fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, height: 52, paddingHorizontal: 14, fontSize: 17 },
  helperText: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 16 },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, marginBottom: 18 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 52, borderRadius: 13, backgroundColor: "#168348", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  amountPanel: { alignItems: "center", backgroundColor: "#EAF8EE", padding: 16, borderRadius: 14, marginBottom: 18 },
  mutedLabel: { fontSize: 12 },
  amountValue: { fontSize: 25, fontWeight: "800", color: "#168348", marginVertical: 5 },
  expectedText: { fontSize: 13, fontWeight: "700" },
  qr: { width: 220, height: 220, alignSelf: "center", marginVertical: 4 },
  qrCaption: { textAlign: "center", fontSize: 12, marginBottom: 16 },
  transferRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  transferValue: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  contentPanel: { borderWidth: 2, borderRadius: 14, padding: 14, marginTop: 16, marginBottom: 16 },
  transferCode: { fontSize: 20, fontWeight: "900", letterSpacing: 1, marginTop: 7 },
  secondaryButton: { alignItems: "center", padding: 14 },
  secondaryText: { fontWeight: "700" },
});
