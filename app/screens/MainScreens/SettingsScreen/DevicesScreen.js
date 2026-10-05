import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  RefreshControl,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { apiErrorMessage } from "../../../utils/apiMessage";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  getDeviceSessions,
  logoutDeviceSession,
  logoutOtherDeviceSessions,
} from "../../../services/api/Api";

// In the app's language (the API only answers in Vietnamese).
const errorMessage = (error) => apiErrorMessage(error);

// Old-architecture Android needs this switched on for LayoutAnimation.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LOGIN_METHODS = ["password", "google", "facebook", "apple", "passkey", "register", "app"];
const METHOD_ICONS = {
  password: "key-outline",
  google: "logo-google",
  facebook: "logo-facebook",
  apple: "logo-apple",
  passkey: "finger-print-outline",
  register: "person-add-outline",
  app: "phone-portrait-outline",
};

const formatTime = (value) => (value ? dayjs(value).format("HH:mm DD/MM/YYYY") : null);

// One line of the expanded card: icon, small label, value.
function DetailRow({ icon, label, value, theme, last }) {
  return (
    <View
      style={[
        styles.detailRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.subText} style={styles.detailIcon} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: theme.subText }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

// "Logged-in devices": every device the account is signed in on, with a way
// to sign the others out. One card per device - the basics first, the rest
// (model, version, how it logged in, times, log out) when the card is opened.
export default function DevicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const [sessions, setSessions] = useState(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getDeviceSessions();
      setSessions(res.data.sessions || []);
      setTotal(res.data.total || 0);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  };

  const platformName = (session) =>
    ({
      web: t("devices.platformWeb"),
      ios: t("devices.platformIos"),
      android: t("devices.platformAndroid"),
    })[session.platform] || null;

  // "Password · two-factor", "Google", ... - null for logins made before the
  // API recorded it.
  const methodLabel = (session) => {
    if (!LOGIN_METHODS.includes(session.login_method)) return null;
    const label = t(`devices.methods.${session.login_method}`);
    return session.login_two_factor ? `${label} · ${t("devices.withTwoFactor")}` : label;
  };

  // Asks first: a stray tap would sign that device out.
  const logoutOne = (session) => {
    if (busyId !== null || loggingOutAll) return;

    Alert.alert(t("devices.logout"), session.device_name || t("devices.unknown"), [
      { text: t("security.cancel"), style: "cancel" },
      {
        text: t("devices.logout"),
        style: "destructive",
        onPress: async () => {
          setBusyId(session.id);
          try {
            await logoutDeviceSession(session.id);
            Toast.show({ type: "success", text1: t("devices.loggedOut") });
            await load();
          } catch (err) {
            Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const logoutOthers = () => {
    Alert.alert(t("devices.logoutOthers"), t("devices.logoutOthersConfirm"), [
      { text: t("security.cancel"), style: "cancel" },
      {
        text: t("devices.logout"),
        style: "destructive",
        onPress: async () => {
          setLoggingOutAll(true);
          try {
            await logoutOtherDeviceSessions();
            Toast.show({ type: "success", text1: t("devices.loggedOutOthers") });
            await load();
          } catch (err) {
            Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
          } finally {
            setLoggingOutAll(false);
          }
        },
      },
    ]);
  };

  const others = (sessions || []).filter((session) => !session.is_current);

  const renderSession = (session) => {
    const expanded = expandedId === session.id;
    const platform = platformName(session);
    const method = methodLabel(session);
    const activity = formatTime(session.last_used_at || session.created_at);
    const summary = [
      platform && session.app_version ? `${platform} ${session.app_version}` : platform,
      activity,
    ]
      .filter(Boolean)
      .join("  •  ");

    const details = [
      session.device_model && {
        icon: "hardware-chip-outline",
        label: t("devices.model"),
        value: session.device_model,
      },
      platform && {
        icon: "apps-outline",
        label: t("devices.platform"),
        value: session.app_version
          ? `${platform} · ${t("devices.version", { version: session.app_version })}`
          : platform,
      },
      {
        icon: METHOD_ICONS[session.login_method] || "log-in-outline",
        label: t("devices.loginMethod"),
        value: method || t("devices.methods.unknown"),
      },
      {
        icon: "calendar-outline",
        label: t("devices.loggedInLabel"),
        value: formatTime(session.created_at) || "-",
      },
      {
        icon: "time-outline",
        label: t("devices.lastActiveLabel"),
        value: formatTime(session.last_used_at) || t("devices.neverActive"),
      },
    ].filter(Boolean);

    return (
      <View
        key={session.id}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggle(session.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <View style={[styles.avatar, { backgroundColor: theme.iconBackground }]}>
            <Ionicons
              name={session.platform === "web" ? "desktop-outline" : "phone-portrait-outline"}
              size={24}
              color={theme.primary}
            />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {session.device_name || t("devices.unknown")}
            </Text>
            {summary ? (
              <Text style={[styles.cardSub, { color: theme.subText }]} numberOfLines={1}>
                {summary}
              </Text>
            ) : null}
            <View style={styles.chips}>
              {session.is_current && (
                <View style={[styles.chip, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.chipText, { color: "#fff" }]}>{t("devices.thisDevice")}</Text>
                </View>
              )}
              {method && (
                <View style={[styles.chip, { backgroundColor: theme.iconBackground }]}>
                  <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                    {t(`devices.methods.${session.login_method}`)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={theme.subText} />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.cardBody}>
            <View style={[styles.details, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {details.map((row, index) => (
                <DetailRow key={row.label} {...row} theme={theme} last={index === details.length - 1} />
              ))}
            </View>

            {!session.is_current && (
              <TouchableOpacity
                style={[styles.logoutButton, busyId === session.id && { opacity: 0.6 }]}
                onPress={() => logoutOne(session)}
                disabled={busyId !== null || loggingOutAll}
                activeOpacity={0.8}
              >
                {busyId === session.id ? (
                  <ActivityIndicator color="#FF3B30" size="small" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
                    <Text style={styles.logoutText}>{t("devices.logout")}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <View style={styles.headerSide}>
            <LiquidButton size={44} scrollY={scrollY} providerId="DevicesScreen" onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t("devices.title")}
          </Animated.Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="DevicesScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            // The list starts below the floating header; without the offset
            // the spinner sits under the status bar.
            progressViewOffset={64 + insets.top}
          />
        }
      >
        <Text style={[styles.description, { color: theme.subText }]}>
          {t("devices.description")}
        </Text>

        {loadError ? (
          <Text style={{ color: theme.subText, textAlign: "center", marginTop: 24 }}>
            {t("devices.loadError")}
          </Text>
        ) : !sessions ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={[styles.count, { color: theme.subText }]}>
              {t("devices.total", { total: total || sessions.length })}
            </Text>

            {sessions.map(renderSession)}

            {total > sessions.length && (
              <Text style={[styles.description, { color: theme.subText }]}>
                {t("devices.showing", { shown: sessions.length, total })}
              </Text>
            )}

            {others.length > 0 && (
              <TouchableOpacity
                style={[styles.logoutAll, loggingOutAll && { opacity: 0.6 }]}
                onPress={logoutOthers}
                disabled={loggingOutAll}
                activeOpacity={0.85}
              >
                {loggingOutAll ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.logoutAllText}>{t("devices.logoutOthers")}</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.ScrollView>
      </AndroidGlassBackdrop>

      <Toast topOffset={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSide: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  count: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  cardSub: {
    fontSize: 13,
    marginTop: 3,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "100%",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  details: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },
  detailIcon: {
    width: 30,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  logoutText: {
    color: "#FF3B30",
    fontSize: 15,
    fontWeight: "600",
  },
  logoutAll: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  logoutAllText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
