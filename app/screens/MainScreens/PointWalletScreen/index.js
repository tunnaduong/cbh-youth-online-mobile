import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import CustomLoading from "../../../components/CustomLoading";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import {
  cancelWithdrawalRequest,
  getWalletBalance,
  getWalletTransactions,
  getWithdrawalRequests,
} from "../../../services/api/Api";

const getPayload = (response) => response?.data ?? response ?? {};
const getItems = (response) => {
  const payload = getPayload(response);
  return Array.isArray(payload) ? payload : payload?.data || [];
};

const statusColors = {
  pending: "#D97706",
  approved: "#15803D",
  completed: "#15803D",
  rejected: "#DC2626",
  cancelled: "#6B7280",
};

const localeMap = { vi: "vi-VN", en: "en-US", ru: "ru-RU" };

const formatNumber = (value, lang) =>
  Number(value || 0).toLocaleString(localeMap[lang] || "vi-VN");
const formatDate = (value, lang) => {
  if (!value) return "";
  return new Date(value).toLocaleString(localeMap[lang] || "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function PointWalletScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "vi";
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [balanceResponse, transactionsResponse, withdrawalResponse] = await Promise.all([
        getWalletBalance(),
        getWalletTransactions(),
        getWithdrawalRequests(),
      ]);
      setBalance(getPayload(balanceResponse));
      setTransactions(getItems(transactionsResponse));
      setWithdrawalRequests(getItems(withdrawalResponse));
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("wallet.loadErrorTitle"),
        text2: error?.response?.data?.message || t("wallet.loadErrorDefault"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = (request) => {
    Alert.alert(
      t("wallet.cancelConfirmTitle"),
      t("wallet.cancelConfirmMessage"),
      [
        { text: t("wallet.no"), style: "cancel" },
        {
          text: t("wallet.cancelRequest"),
          style: "destructive",
          onPress: async () => {
            setCancellingId(request.id);
            try {
              await cancelWithdrawalRequest(request.id);
              Toast.show({ type: "success", text1: t("wallet.cancelSuccess") });
              loadData(true);
            } catch (error) {
              Toast.show({
                type: "error",
                text1: t("wallet.cancelErrorTitle"),
                text2: error?.response?.data?.message || t("wallet.tryAgain"),
              });
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}> 
        <CustomLoading />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 74 }]} pointerEvents="box-none">
        <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()} roundedOnScroll>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: scrollY.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: "clamp" }) }]}> 
          {t("wallet.title")}
        </Animated.Text>
        <LiquidButton size={44} scrollY={scrollY} onPress={() => loadData(true)} roundedOnScroll>
          <Ionicons name="refresh-outline" size={21} color={theme.primary} />
        </LiquidButton>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 90 + insets.top, paddingHorizontal: 16, paddingBottom: 36 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} colors={[theme.primary]} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>{t("wallet.currentBalance")}</Text>
              <Text style={styles.balanceValue}>{t("wallet.pointsValue", { value: formatNumber(balance?.points, lang) })}</Text>
              <Text style={styles.balanceVnd}>{t("wallet.approxVnd", { value: balance?.formatted_vnd || "0 VND" })}</Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={36} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: isDarkMode ? "rgba(20,118,198,0.16)" : "#E8F4FF" }]} onPress={() => navigation.navigate("DepositScreen")}>
            <Ionicons name="add-circle-outline" size={20} color="#1476C6" />
            <Text style={[styles.actionText, { color: "#1476C6" }]}>{t("wallet.deposit")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: isDarkMode ? "rgba(22,131,72,0.16)" : "#EAF8EE" }]} onPress={() => navigation.navigate("WithdrawScreen")}>
            <Ionicons name="cash-outline" size={20} color="#168348" />
            <Text style={[styles.actionText, { color: "#168348" }]}>{t("wallet.withdraw")}</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle icon="swap-vertical-outline" title={t("wallet.transactionHistory")} theme={theme} />
        <View style={[styles.section, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }]}> 
          {transactions.length === 0 ? (
            <EmptyState text={t("wallet.emptyTransactions")} theme={theme} />
          ) : (
            transactions.map((transaction, index) => (
              <View key={transaction.id || `${transaction.created_at}-${index}`} style={[styles.transactionRow, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "#FFFFFF" }, index < transactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}> 
                <View style={[styles.transactionIcon, { backgroundColor: transaction.amount > 0 ? "#EAF8EE" : "#FEF0F0" }]}> 
                  <Ionicons name={transaction.amount > 0 ? "arrow-down-outline" : "arrow-up-outline"} size={18} color={transaction.amount > 0 ? "#168348" : "#DC2626"} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionDescription, { color: theme.text }]} numberOfLines={2}>{transaction.description || t("wallet.defaultTransactionDescription")}</Text>
                  <Text style={[styles.dateText, { color: theme.subText }]}>{formatDate(transaction.created_at, lang)}</Text>
                </View>
                <Text style={[styles.amountText, { color: transaction.amount > 0 ? "#168348" : "#DC2626" }]}>{transaction.amount > 0 ? "+" : ""}{formatNumber(transaction.amount, lang)}</Text>
              </View>
            ))
          )}
        </View>

        <SectionTitle icon="time-outline" title={t("wallet.withdrawalRequests")} theme={theme} />
        <View style={[styles.section, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }]}> 
          {withdrawalRequests.length === 0 ? (
            <EmptyState text={t("wallet.emptyWithdrawalRequests")} theme={theme} />
          ) : (
            withdrawalRequests.map((request, index) => (
              <View key={request.id || index} style={[styles.withdrawalRow, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "#FFFFFF" }, index < withdrawalRequests.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}> 
                <View style={styles.withdrawalHeader}>
                  <Text style={[styles.withdrawalAmount, { color: theme.text }]}>{t("wallet.withdrawAmount", { value: formatNumber(request.amount, lang) })}</Text>
                  <Text style={{ color: statusColors[request.status] || theme.subText, fontWeight: "700", fontSize: 12 }}>{t(`wallet.status.${request.status}`, { defaultValue: request.status })}</Text>
                </View>
                <Text style={[styles.dateText, { color: theme.subText }]}>{formatDate(request.created_at, lang)}</Text>
                {request.status === "pending" && (
                  <TouchableOpacity disabled={cancellingId === request.id} onPress={() => handleCancel(request)} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>{cancellingId === request.id ? t("wallet.cancelling") : t("wallet.cancelOrder")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function SectionTitle({ icon, title, theme }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

function EmptyState({ text, theme }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={28} color={theme.subText} />
      <Text style={[styles.emptyText, { color: theme.subText }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  largeTitle: { fontSize: 28, fontWeight: "800", marginBottom: 14 },
  balanceCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  balanceTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "#C7F5D7", fontSize: 14, marginBottom: 6 },
  balanceValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  balanceVnd: { color: "#C7F5D7", fontSize: 14, marginTop: 5 },
  walletIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.16)", justifyContent: "center", alignItems: "center" },
  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  actionButton: { flex: 1, minHeight: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionText: { fontSize: 15, fontWeight: "700" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  section: {
    borderRadius: 18,
    marginBottom: 22,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  transactionRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  transactionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  transactionInfo: { flex: 1 },
  transactionDescription: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  dateText: { fontSize: 12, marginTop: 4 },
  amountText: { fontSize: 15, fontWeight: "800" },
  withdrawalRow: { padding: 14 },
  withdrawalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  withdrawalAmount: { fontSize: 15, fontWeight: "700", flex: 1 },
  cancelButton: { alignSelf: "flex-start", marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#FEF0F0" },
  cancelText: { color: "#DC2626", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14 },
});
