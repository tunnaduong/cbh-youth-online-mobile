import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Alert,
  Clipboard,
} from "react-native";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import LiquidButton from "../../../components/LiquidButton";
import {
  getLogs,
  clearLogs,
  subscribeDevConsole,
  setDevModeEnabled,
} from "../../../utils/devConsole";

const FILTERS = ["all", "warning", "error", "glass"];

const LEVEL_COLORS = {
  log: "#6b7280",
  warning: "#f59e0b",
  error: "#ef4444",
};

export default function DevConsoleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [logs, setLogs] = useState(getLogs());
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const unsubscribe = subscribeDevConsole(setLogs);
    return unsubscribe;
  }, []);

  const filteredLogs =
    filter === "all"
      ? logs
      : filter === "glass"
      // "glass" isn't a log level - it's a message-prefix filter for the
      // [GlassModules] mount/unmount/support traces, so they're easy to
      // isolate from the rest of the app's console noise.
      ? logs.filter((l) => l.message.startsWith("[GlassModules]"))
      : logs.filter((l) => l.level === filter);

  const handleCopyLog = useCallback((item) => {
    Clipboard.setString(`[${item.level.toUpperCase()}] ${new Date(item.timestamp).toLocaleString()}\n${item.message}`);
    Toast.show({ type: "success", text1: t("devConsole.copied"), visibilityTime: 1500 });
  }, [t]);

  const handleCopyAll = useCallback(() => {
    if (filteredLogs.length === 0) return;
    const text = filteredLogs
      .map((item) => `[${item.level.toUpperCase()}] ${new Date(item.timestamp).toLocaleString()}\n${item.message}`)
      .join("\n\n");
    Clipboard.setString(text);
    Toast.show({ type: "success", text1: t("devConsole.copiedAll"), visibilityTime: 1500 });
  }, [filteredLogs, t]);

  const handleClear = useCallback(() => {
    Alert.alert(t("devConsole.clearLogsTitle"), t("devConsole.clearLogsDesc"), [
      { text: t("profile.cancel"), style: "cancel" },
      { text: t("devConsole.clear"), style: "destructive", onPress: clearLogs },
    ]);
  }, [t]);

  const handleTurnOff = useCallback(() => {
    Alert.alert(t("devConsole.turnOffTitle"), t("devConsole.turnOffDesc"), [
      { text: t("profile.cancel"), style: "cancel" },
      {
        text: t("devConsole.turnOff"),
        style: "destructive",
        onPress: async () => {
          await setDevModeEnabled(false);
          navigation.goBack();
        },
      },
    ]);
  }, [t, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header: glass buttons appear once the log list scrolls under it */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8, height: 64 + insets.top }}>
          <LiquidButton size={44} scrollY={scrollY} providerId="DevConsoleScreen" onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity }]} numberOfLines={1}>
            {t("devConsole.title")}
          </Animated.Text>
          <LiquidButton size={44} scrollY={scrollY} providerId="DevConsoleScreen" onPress={handleCopyAll}>
            <Ionicons name="copy-outline" size={20} color={theme.text} />
          </LiquidButton>
          <LiquidButton size={44} scrollY={scrollY} providerId="DevConsoleScreen" onPress={handleClear}>
            <Ionicons name="trash-outline" size={22} color={theme.text} />
          </LiquidButton>
        </View>
      </View>

      <AndroidGlassBackdrop providerId="DevConsoleScreen" style={{ flex: 1 }}>
        <Animated.FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 64 + insets.top }}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === f ? theme.primary : theme.iconBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: filter === f ? "#fff" : theme.text, fontSize: 13, fontWeight: "600" }}>
                    {t(`devConsole.filter_${f}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="terminal-outline" size={40} color={theme.subText} />
              <Text style={{ color: theme.subText, marginTop: 8, textAlign: "center" }}>
                {t("devConsole.noLogs")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.logRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <View style={styles.logHeaderRow}>
                <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLORS[item.level] || LEVEL_COLORS.log }]}>
                  <Text style={styles.levelBadgeText}>{item.level.toUpperCase()}</Text>
                </View>
                <Text style={[styles.logTime, { color: theme.subText, flex: 1 }]}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
                <TouchableOpacity onPress={() => handleCopyLog(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="copy-outline" size={16} color={theme.subText} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.logMessage, { color: theme.text }]} selectable>
                {item.message}
              </Text>
            </View>
          )}
        />
      </AndroidGlassBackdrop>

      <TouchableOpacity
        style={[styles.turnOffButton, { backgroundColor: "#ef4444", marginBottom: insets.bottom + 12 }]}
        onPress={handleTurnOff}
      >
        <Ionicons name="power-outline" size={18} color="#fff" />
        <Text style={styles.turnOffButtonText}>{t("devConsole.turnOffDevMode")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
  logRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  logHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  logTime: { fontSize: 11 },
  logMessage: { fontSize: 13, fontFamily: "monospace" },
  turnOffButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  turnOffButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
