import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { tint, glowColors, heroColors } from "../../../components/settings/SettingsUI";
import CustomLoading from "../../../components/CustomLoading";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import {
  cancelWithdrawalRequest,
  getWalletBalance,
  getWalletTransactions,
  getWithdrawalRequests,
  isRequestCanceled,
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
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(false);
  const [loadingMoreTx, setLoadingMoreTx] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef(null);
  const txAbortRef = useRef(null);
  const isFetchingTxRef = useRef(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isRefresh) setRefreshing(true);
    try {
      const [balanceResponse, transactionsResponse, withdrawalResponse] = await Promise.all([
        getWalletBalance({ signal: controller.signal }),
        getWalletTransactions({ page: 1 }, { signal: controller.signal }),
        getWithdrawalRequests({}, { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setBalance(getPayload(balanceResponse));
      const txPayload = getPayload(transactionsResponse);
      const txItems = getItems(transactionsResponse);
      setTransactions(txItems);
      setTxPage(1);
      setTxHasMore(Boolean(txPayload?.next_page_url || (txPayload?.current_page < txPayload?.last_page)));
      setWithdrawalRequests(getItems(withdrawalResponse));
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      Toast.show({
        type: "error",
        text1: t("wallet.loadErrorTitle"),
        text2: error?.response?.data?.message || t("wallet.loadErrorDefault"),
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t]);

  const loadMoreTransactions = useCallback(async () => {
    if (isFetchingTxRef.current || !txHasMore) return;
    if (txAbortRef.current) {
      txAbortRef.current.abort();
    }
    const controller = new AbortController();
    txAbortRef.current = controller;
    isFetchingTxRef.current = true;
    setLoadingMoreTx(true);

    try {
      const nextPage = txPage + 1;
      const response = await getWalletTransactions({ page: nextPage }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const txPayload = getPayload(response);
      const txItems = getItems(response);
      setTransactions((prev) => {
        const existingIds = new Set(prev.map((item) => item.id).filter(Boolean));
        return [...prev, ...txItems.filter((item) => !item.id || !existingIds.has(item.id))];
      });
      setTxPage(nextPage);
      setTxHasMore(Boolean(txPayload?.next_page_url || (txPayload?.current_page < txPayload?.last_page)));
    } catch (error) {
      if (!isRequestCanceled(error) && !controller.signal.aborted) {
        console.warn("Unable to load more wallet transactions:", error);
      }
    } finally {
      if (!controller.signal.aborted) {
        isFetchingTxRef.current = false;
        setLoadingMoreTx(false);
      }
    }
  }, [txHasMore, txPage]);

  useEffect(() => {
    loadData();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (txAbortRef.current) txAbortRef.current.abort();
    };
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
        <LiquidButton providerId="PointWalletScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()} roundedOnScroll>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: scrollY.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: "clamp" }) }]}>
          {t("wallet.title")}
        </Animated.Text>
        <LiquidButton providerId="PointWalletScreen" size={44} scrollY={scrollY} onPress={() => loadData(true)} roundedOnScroll>
          <Ionicons name="refresh-outline" size={21} color={theme.primary} />
        </LiquidButton>
      </View>

      <AndroidGlassBackdrop providerId="PointWalletScreen" style={{ flex: 1 }}>
        <LinearGradient
          colors={
            glowColors("#F59E0B", isDarkMode)
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.ambientGlow, { height: insets.top + 140 }]}
          pointerEvents="none"
        />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 90 + insets.top, paddingHorizontal: 16, paddingBottom: 36 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} colors={[theme.primary]} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={heroColors("#F59E0B", isDarkMode).colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.balanceCard, { borderColor: heroColors("#F59E0B", isDarkMode).border }]}
        >
          <View style={styles.balanceCircle} />
          <View style={styles.balanceTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.balanceLabel, { color: isDarkMode ? "#9CA3AF" : "#4B6B58" }]}>{t("wallet.currentBalance")}</Text>
              <Text style={[styles.balanceValue, { color: isDarkMode ? "#F3F4F6" : "#0F2E1E" }]}>{t("wallet.pointsValue", { value: formatNumber(balance?.points, lang) })}</Text>
              <View style={styles.balanceVndChip}>
                <Text style={styles.balanceVnd}>{t("wallet.approxVnd", { value: balance?.formatted_vnd || "0 VND" })}</Text>
              </View>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet" size={30} color="#16A34A" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.actionsRow}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]} onPress={() => navigation.navigate("DepositScreen")}>
            <View style={[styles.actionIcon, { backgroundColor: tint("#0EA5E9", isDarkMode) }]}>
              <Ionicons name="add" size={22} color="#0EA5E9" />
            </View>
            <Text style={[styles.actionText, { color: theme.text }]}>{t("wallet.deposit")}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]} onPress={() => navigation.navigate("WithdrawScreen")}>
            <View style={[styles.actionIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <Ionicons name="cash-outline" size={20} color="#22C55E" />
            </View>
            <Text style={[styles.actionText, { color: theme.text }]}>{t("wallet.withdraw")}</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle icon="swap-vertical-outline" color="#6366F1" title={t("wallet.transactionHistory")} theme={theme} isDarkMode={isDarkMode} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}>
          {transactions.length === 0 ? (
            <EmptyState text={t("wallet.emptyTransactions")} theme={theme} />
          ) : (
            transactions.map((transaction, index) => (
              <View key={transaction.id || `${transaction.created_at}-${index}`} style={[styles.transactionRow, index < transactions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9" }]}> 
                <View style={[styles.transactionIcon, { backgroundColor: tint(transaction.amount > 0 ? "#22C55E" : "#EF4444", isDarkMode) }]}> 
                  <Ionicons name={transaction.amount > 0 ? "arrow-down-outline" : "arrow-up-outline"} size={18} color={transaction.amount > 0 ? "#16A34A" : "#EF4444"} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionDescription, { color: theme.text }]} numberOfLines={2}>{transaction.description || t("wallet.defaultTransactionDescription")}</Text>
                  <Text style={[styles.dateText, { color: theme.subText }]}>{formatDate(transaction.created_at, lang)}</Text>
                </View>
                <Text style={[styles.amountText, { color: transaction.amount > 0 ? "#168348" : "#DC2626" }]}>{transaction.amount > 0 ? "+" : ""}{formatNumber(transaction.amount, lang)}</Text>
              </View>
            ))
          )}
          {txHasMore && (
            <TouchableOpacity
              onPress={loadMoreTransactions}
              disabled={loadingMoreTx}
              style={{ paddingVertical: 12, alignItems: "center" }}
            >
              {loadingMoreTx ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>
                  {t("profile.loadMorePosts", "Tải thêm")}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <SectionTitle icon="time-outline" color="#F59E0B" title={t("wallet.withdrawalRequests")} theme={theme} isDarkMode={isDarkMode} />
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}>
          {withdrawalRequests.length === 0 ? (
            <EmptyState text={t("wallet.emptyWithdrawalRequests")} theme={theme} />
          ) : (
            withdrawalRequests.map((request, index) => (
              <View key={request.id || index} style={[styles.withdrawalRow, index < withdrawalRequests.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9" }]}> 
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
      </AndroidGlassBackdrop>
    </View>
  );
}

function SectionTitle({ icon, color, title, theme, isDarkMode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={15} color={color || theme.primary} />
      <Text style={[styles.sectionTitle, { color: isDarkMode ? "#9CA3AF" : "#6B7280" }]}>{title}</Text>
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
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
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
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#16A34A",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  balanceCircle: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(34,197,94,0.10)", top: -55, right: 40 },
  balanceTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  balanceValue: { fontSize: 30, fontWeight: "800" },
  balanceVndChip: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.15)" },
  balanceVnd: { color: "#16A34A", fontSize: 12, fontWeight: "700" },
  walletIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(34,197,94,0.15)", justifyContent: "center", alignItems: "center" },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  actionButton: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15, fontWeight: "700" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, marginLeft: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  section: {
    borderRadius: 18,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
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
  cancelButton: { alignSelf: "flex-start", marginTop: 10, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(239,68,68,0.12)" },
  cancelText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14 },
});
