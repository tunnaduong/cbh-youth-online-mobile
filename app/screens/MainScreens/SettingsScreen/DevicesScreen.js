import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
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

const errorMessage = (error) => error.response?.data?.message || error.message;

// "Logged-in devices": every device the account is signed in on, with a way
// to sign the others out.
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

  const platformLabel = (session) => {
    const label = {
      web: t("devices.platformWeb"),
      ios: t("devices.platformIos"),
      android: t("devices.platformAndroid"),
    }[session.platform];
    if (!label) return null;
    return session.app_version ? `${label} ${session.app_version}` : label;
  };

  const logoutOne = async (id) => {
    setBusyId(id);
    try {
      await logoutDeviceSession(id);
      Toast.show({ type: "success", text1: t("devices.loggedOut") });
      await load();
    } catch (err) {
      Toast.show({ type: "error", text1: t("common.error"), text2: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
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
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {sessions.map((session, index) => {
                const details = [session.device_model, platformLabel(session)].filter(Boolean).join(" · ");
                return (
                  <View
                    key={session.id}
                    style={[
                      styles.item,
                      index < sessions.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: theme.iconBackground }]}>
                      <Ionicons
                        name={session.platform === "web" ? "desktop-outline" : "phone-portrait-outline"}
                        size={20}
                        color={theme.primary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                        {session.device_name || t("devices.unknown")}
                      </Text>
                      {session.is_current && (
                        <Text style={[styles.current, { color: theme.primary }]}>
                          {t("devices.thisDevice")}
                        </Text>
                      )}
                      {details ? (
                        <Text style={[styles.itemSub, { color: theme.subText }]} numberOfLines={1}>
                          {details}
                        </Text>
                      ) : null}
                      <Text style={[styles.itemSub, { color: theme.subText }]}>
                        {session.last_used_at
                          ? t("devices.lastActive", { time: dayjs(session.last_used_at).format("HH:mm DD/MM/YYYY") })
                          : t("devices.loggedInAt", { time: dayjs(session.created_at).format("HH:mm DD/MM/YYYY") })}
                      </Text>
                    </View>
                    {!session.is_current &&
                      (busyId === session.id ? (
                        <ActivityIndicator color={theme.primary} size="small" />
                      ) : (
                        <TouchableOpacity onPress={() => logoutOne(session.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.logoutText}>{t("devices.logout")}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                );
              })}
            </View>

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
    marginBottom: 16,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  current: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  logoutText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  logoutAll: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  logoutAllText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
