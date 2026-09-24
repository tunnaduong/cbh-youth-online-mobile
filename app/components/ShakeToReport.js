import React, { useContext, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import { captureScreen } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import FastImage from "./FastImage";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

// Accelerometer readings are in g. Resting magnitude is ~1g; a deliberate
// shake spikes well past 2g on every swing. Several high samples within a
// short window are required so a single knock (phone dropped on a table,
// bumped in a pocket - one or two samples at most) doesn't pop the sheet,
// and a cooldown stops one long shake firing repeatedly.
const SHAKE_THRESHOLD_G = 2.4;
const SHAKE_SAMPLES_REQUIRED = 3;
const SHAKE_WINDOW_MS = 800;
const SHAKE_COOLDOWN_MS = 2500;
const SENSOR_INTERVAL_MS = 80;

// Screens where a shake should be ignored: the form itself, and full-screen
// creation flows where the user is likely moving the phone around anyway.
const IGNORED_ROUTES = new Set(["FeedbackScreen", "CreateStory", "CreatePostScreen", "PostEditScreen"]);

/**
 * Shake-to-report: listens to the accelerometer while the app is in the
 * foreground; on a shake it screenshots whatever is on screen, then shows a
 * bottom sheet from which the user can open the feedback form with that
 * screenshot (and the current screen name) pre-attached, or switch the
 * gesture off entirely.
 *
 * Rendered once at the root, outside the navigators, and given the
 * NavigationContainer ref so it can read the current route and navigate.
 */
export default function ShakeToReport({ navigationRef }) {
  const { theme, isDarkMode, shakeToReportEnabled, setShakeToReportEnabled } = useTheme();
  const { isLoggedIn } = useContext(AuthContext);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [sheet, setSheet] = useState(null); // { screenshotUri, screenName } | null

  const peaksRef = useRef([]);
  const lastTriggerRef = useRef(0);
  const busyRef = useRef(false);
  const sheetOpenRef = useRef(false);
  const appActiveRef = useRef(AppState.currentState === "active");

  sheetOpenRef.current = sheet !== null;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appActiveRef.current = state === "active";
      // Forget half-detected shakes from before the app was backgrounded.
      if (!appActiveRef.current) peaksRef.current = [];
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!shakeToReportEnabled || !isLoggedIn) return undefined;

    let subscription = null;
    let cancelled = false;

    const handleShake = async () => {
      const route = navigationRef?.current?.getCurrentRoute?.();
      const screenName = route?.name || "";
      if (IGNORED_ROUTES.has(screenName)) return;

      busyRef.current = true;
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // Capture BEFORE the sheet is shown so the screenshot is exactly what
        // the user was looking at when the problem happened.
        let screenshotUri = null;
        try {
          screenshotUri = await captureScreen({ format: "jpg", quality: 0.7, result: "tmpfile" });
        } catch (e) {
          console.warn("[ShakeToReport] screenshot failed", e?.message || e);
        }
        if (cancelled) return;
        setSheet({ screenshotUri, screenName });
      } finally {
        busyRef.current = false;
      }
    };

    const onReading = ({ x, y, z }) => {
      if (!appActiveRef.current || busyRef.current || sheetOpenRef.current) return;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude < SHAKE_THRESHOLD_G) return;

      const now = Date.now();
      if (now - lastTriggerRef.current < SHAKE_COOLDOWN_MS) return;

      const peaks = peaksRef.current.filter((ts) => now - ts <= SHAKE_WINDOW_MS);
      peaks.push(now);
      peaksRef.current = peaks;

      if (peaks.length >= SHAKE_SAMPLES_REQUIRED) {
        peaksRef.current = [];
        lastTriggerRef.current = now;
        handleShake();
      }
    };

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
        subscription = Accelerometer.addListener(onReading);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
      peaksRef.current = [];
    };
  }, [shakeToReportEnabled, isLoggedIn, navigationRef]);

  const closeSheet = () => setSheet(null);

  const openFeedback = () => {
    const current = sheet;
    setSheet(null);
    if (!current) return;
    const navigate = () => {
      navigationRef?.current?.navigate("FeedbackScreen", {
        type: "bug",
        source: "shake",
        screenName: current.screenName,
        screenshotUri: current.screenshotUri,
      });
    };
    // iOS won't present the (modal) feedback screen while this RN Modal is
    // still animating out - give it a beat to dismiss first.
    if (Platform.OS === "ios") setTimeout(navigate, 350);
    else navigate();
  };

  const disableShake = () => {
    setShakeToReportEnabled(false);
    setSheet(null);
  };

  return (
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={closeSheet} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={closeSheet} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: isDarkMode ? "#444" : "#D1D5DB" }]} />

        <View style={styles.topRow}>
          {sheet?.screenshotUri ? (
            <FastImage source={{ uri: sheet.screenshotUri }} style={[styles.thumb, { borderColor: theme.border }]} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { borderColor: theme.border, backgroundColor: theme.iconBackground }]}>
              <Ionicons name="bug-outline" size={26} color={theme.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{t("feedback.shakeTitle")}</Text>
            <Text style={[styles.desc, { color: theme.subText }]}>
              {sheet?.screenshotUri ? t("feedback.shakeDescWithShot") : t("feedback.shakeDesc")}
            </Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={openFeedback} style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
          <Text style={styles.primaryButtonText}>{t("feedback.shakeReport")}</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} onPress={closeSheet} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonText, { color: theme.subText }]}>{t("feedback.shakeNotNow")}</Text>
        </TouchableOpacity>

        <View style={[styles.toggleRow, { borderTopColor: theme.border }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.toggleTitle, { color: theme.text }]}>{t("settings.shakeToReport")}</Text>
            <Text style={[styles.toggleHint, { color: theme.subText }]}>{t("feedback.shakeToggleHint")}</Text>
          </View>
          <Switch
            value={shakeToReportEnabled}
            onValueChange={(value) => (value ? setShakeToReportEnabled(true) : disableShake())}
            trackColor={{ true: theme.primary }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 16 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  thumb: { width: 56, height: 96, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 13, lineHeight: 18 },
  primaryButton: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { paddingVertical: 12, alignItems: "center" },
  secondaryButtonText: { fontSize: 15, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 4,
  },
  toggleTitle: { fontSize: 15, fontWeight: "600" },
  toggleHint: { fontSize: 12, marginTop: 2 },
});
