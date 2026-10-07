import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { getEcho } from "../services/echo/echo";
import { getLoginApprovals, respondLoginApproval } from "../services/api/Api";

const isApprovalNotification = (notification) =>
  notification?.request?.content?.data?.type === "login_approval";

/**
 * Two-factor by approval (method "device"): when someone is logging in to
 * this account elsewhere and waits for an OK, this device - already logged
 * in - shows the request: which device, and three numbers. Picking the
 * number shown on the device logging in approves it; "not me" denies it.
 *
 * It learns about a request from the realtime event, from the push
 * notification, and by asking the API when the app comes to the foreground.
 * Mounted once, above the navigator; renders nothing while logged out or
 * when nothing is waiting.
 */
export default function LoginApprovalPrompt() {
  const { isLoggedIn, userInfo } = useContext(AuthContext);
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [approvals, setApprovals] = useState([]);
  // Requests the user chose to leave for later: not shown again by a refresh.
  const snoozed = useRef(new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await getLoginApprovals();
      setApprovals(response.data?.approvals || []);
    } catch {
      // Not worth interrupting anything: the next trigger asks again.
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !userInfo?.id) {
      setApprovals([]);
      snoozed.current = new Set();
      return undefined;
    }

    // On every start of the app, not only when a notification says so: a
    // login waiting for an answer is a security matter, so it is shown as
    // soon as the app opens. Asked again a moment later, for a cold start
    // where the first request went out before the network was up.
    refresh();
    const retry = setTimeout(refresh, 2500);

    // Opened by tapping the notification while the app was closed: that tap
    // happened before the listener below existed, so read it here.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (isApprovalNotification(response?.notification)) {
          snoozed.current = new Set();
          refresh();
        }
      })
      .catch(() => {});

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    // Push: shown while the app is open, or tapped to open it.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (isApprovalNotification(notification)) refresh();
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isApprovalNotification(response?.notification)) {
        snoozed.current = new Set();
        refresh();
      }
    });

    let channel = null;
    try {
      channel = getEcho().private(`App.Models.User.${userInfo.id}`);
      channel.listen(".login.approval", refresh);
    } catch (e) {
      console.warn("[LoginApproval] realtime listener failed:", e?.message || e);
    }

    return () => {
      clearTimeout(retry);
      appState.remove();
      received.remove();
      tapped.remove();
      try {
        channel?.stopListening(".login.approval");
      } catch {}
    };
  }, [isLoggedIn, userInfo?.id, refresh]);

  const waiting = approvals.filter((item) => !snoozed.current.has(item.id));
  const current = waiting[0];

  const answer = async (approve, number) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await respondLoginApproval(current.id, { approve, number });
      Toast.show({
        type: approve ? "success" : "info",
        text1: approve ? t("twoFactor.promptApproved") : t("twoFactor.promptDenied"),
      });
    } catch (error) {
      // 422 = the number didn't match (the API denied the request);
      // 404 = it was answered elsewhere or timed out.
      Toast.show({
        type: "error",
        text1:
          error.response?.status === 422
            ? t("twoFactor.promptWrongNumber")
            : error.response?.status === 404
              ? t("twoFactor.promptExpired")
              : t("common.error"),
      });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const later = () => {
    if (!current) return;
    snoozed.current.add(current.id);
    // New array, so the list above is filtered again.
    setApprovals((list) => [...list]);
  };

  if (!current) return null;

  const platform = {
    web: t("devices.platformWeb"),
    ios: t("devices.platformIos"),
    android: t("devices.platformAndroid"),
  }[current.platform];
  const device = [current.device_name, current.device_model, platform].filter(Boolean).join(" · ");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={later} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: theme.iconBackground }]}>
            <Ionicons name="shield-checkmark-outline" size={26} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{t("twoFactor.promptTitle")}</Text>
          <Text style={[styles.body, { color: theme.subText }]}>{t("twoFactor.promptBody")}</Text>

          <View style={[styles.details, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Detail label={t("twoFactor.promptDevice")} value={device || t("devices.unknown")} theme={theme} />
            {!!current.ip && <Detail label={t("twoFactor.promptIp")} value={current.ip} theme={theme} />}
            <Detail
              label={t("twoFactor.promptTime")}
              value={dayjs(current.created_at).format("HH:mm DD/MM/YYYY")}
              theme={theme}
              last
            />
          </View>

          <View style={styles.numbers}>
            {(current.numbers || []).map((number) => (
              <TouchableOpacity
                key={number}
                style={[styles.number, { borderColor: theme.primary }, busy && { opacity: 0.5 }]}
                onPress={() => answer(true, number)}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={[styles.numberText, { color: theme.primary }]}>{number}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {busy && <ActivityIndicator color={theme.primary} style={{ marginBottom: 8 }} />}

          <TouchableOpacity
            style={[styles.deny, busy && { opacity: 0.5 }]}
            onPress={() => answer(false)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.denyText}>{t("twoFactor.promptDeny")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.later} onPress={later} disabled={busy}>
            <Text style={{ color: theme.subText, fontWeight: "600" }}>{t("twoFactor.promptLater")}</Text>
          </TouchableOpacity>

          {waiting.length > 1 && (
            <Text style={[styles.more, { color: theme.subText }]}>
              {t("twoFactor.promptMore", { more: waiting.length - 1 })}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value, theme, last }) {
  return (
    <View
      style={[
        styles.detail,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <Text style={[styles.detailLabel, { color: theme.subText }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: "center",
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 6, marginBottom: 14 },
  details: {
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  detail: { paddingVertical: 10 },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 15, fontWeight: "500", marginTop: 2 },
  numbers: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 10,
    marginBottom: 14,
  },
  number: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  numberText: { fontSize: 26, fontWeight: "800" },
  deny: {
    alignSelf: "stretch",
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  denyText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  later: { padding: 12 },
  more: { fontSize: 12, marginTop: 2 },
});
