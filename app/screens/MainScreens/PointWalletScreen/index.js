import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
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
import { useTheme } from "../../../contexts/ThemeContext";
import {
  cancelWithdrawalRequest,
  getWalletBalance,
  getWalletTransactions,
  getWithdrawalRequests,
} from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";

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
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [balanceResponse, transactionsResponse, withdrawalResponse] =
        await Promise.all([
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
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={t("wallet.backLabel")}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t("wallet.title")}</Text>
        <TouchableOpacity
          accessibilityLabel={t("wallet.refreshLabel")}
          onPress={() => loadData(true)}
          style={styles.backButton}
        >
          <Ionicons name="refresh-outline" size={23} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={theme.primary}
          />
        }
      >
        <LinearGradient
          colors={isDarkMode ? ["#17643D", "#124B32"] : ["#24A45A", "#14834B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceTopRow}>
            <View>
              <Text style={styles.balanceLabel}>{t("wallet.currentBalance")}</Text>
              <Text style={styles.balanceValue}>
                {t("wallet.pointsValue", { value: formatNumber(balance?.points, lang) })}
              </Text>
              <Text style={styles.balanceVnd}>
                {t("wallet.approxVnd", { value: balance?.formatted_vnd || "0 VND" })}
              </Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={38} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.balanceDivider} />
          <Text style={styles.minimumText}>
            {t("wallet.minWithdrawal", {
              points: formatNumber(balance?.min_withdrawal_points, lang),
              vnd: balance?.min_withdrawal_vnd
                ? t("wallet.minWithdrawalVnd", { value: formatNumber(balance.min_withdrawal_vnd, lang) })
                : "",
            })}
          </Text>
        </LinearGradient>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#E8F4FF" }]}
            onPress={() => navigation.navigate("DepositScreen")}
          >
            <Ionicons name="add-circle-outline" size={22} color="#1476C6" />
            <Text style={[styles.actionText, { color: "#1476C6" }]}>{t("wallet.deposit")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#EAF8EE" }]}
            onPress={() => navigation.navigate("WithdrawScreen")}
          >
            <Ionicons name="cash-outline" size={22} color="#168348" />
            <Text style={[styles.actionText, { color: "#168348" }]}>{t("wallet.withdraw")}</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle icon="swap-vertical-outline" title={t("wallet.transactionHistory")} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          {transactions.length === 0 ? (
            <EmptyState text={t("wallet.emptyTransactions")} theme={theme} />
          ) : (
            transactions.map((transaction, index) => (
              <View
                key={transaction.id || `${transaction.created_at}-${index}`}
                style={[
                  styles.transactionRow,
                  index < transactions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={[styles.transactionIcon, { backgroundColor: transaction.amount > 0 ? "#EAF8EE" : "#FEF0F0" }]}>
                  <Ionicons
                    name={transaction.amount > 0 ? "arrow-down-outline" : "arrow-up-outline"}
                    size={18}
                    color={transaction.amount > 0 ? "#168348" : "#DC2626"}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionDescription, { color: theme.text }]} numberOfLines={2}>
                    {transaction.description || t("wallet.defaultTransactionDescription")}
                  </Text>
                  <Text style={[styles.dateText, { color: theme.subText }]}>
                    {formatDate(transaction.created_at, lang)}
                  </Text>
                </View>
                <Text style={[styles.amountText, { color: transaction.amount > 0 ? "#168348" : "#DC2626" }]}>
                  {transaction.amount > 0 ? "+" : ""}{formatNumber(transaction.amount, lang)}
                </Text>
              </View>
            ))
          )}
        </View>

        <SectionTitle icon="time-outline" title={t("wallet.withdrawalRequests")} theme={theme} />
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          {withdrawalRequests.length === 0 ? (
            <EmptyState text={t("wallet.emptyWithdrawalRequests")} theme={theme} />
          ) : (
            withdrawalRequests.map((request, index) => (
              <View
                key={request.id || index}
                style={[
                  styles.withdrawalRow,
                  index < withdrawalRequests.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.withdrawalHeader}>
                  <Text style={[styles.withdrawalAmount, { color: theme.text }]}>
                    {t("wallet.withdrawAmount", { value: formatNumber(request.amount, lang) })}
                  </Text>
                  <Text style={{ color: statusColors[request.status] || theme.subText, fontWeight: "700", fontSize: 12 }}>
                    {t(`wallet.status.${request.status}`, { defaultValue: request.status })}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: theme.subText }]}>{formatDate(request.created_at, lang)}</Text>
                {request.status === "pending" && (
                  <TouchableOpacity
                    disabled={cancellingId === request.id}
                    onPress={() => handleCancel(request)}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelText}>
                      {cancellingId === request.id ? t("wallet.cancelling") : t("wallet.cancelOrder")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  balanceCard: { borderRadius: 22, padding: 20, marginBottom: 16 },
  balanceTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "#C7F5D7", fontSize: 14, marginBottom: 6 },
  balanceValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  balanceVnd: { color: "#C7F5D7", fontSize: 14, marginTop: 5 },
  walletIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.17)", justifyContent: "center", alignItems: "center" },
  balanceDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginVertical: 18 },
  minimumText: { color: "#C7F5D7", fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  actionButton: { flex: 1, minHeight: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionText: { fontSize: 15, fontWeight: "700" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  section: { borderRadius: 16, marginBottom: 22, overflow: "hidden" },
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
