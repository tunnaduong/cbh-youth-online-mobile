import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import CustomLoading from "../../../components/CustomLoading";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import { getTimetable, isRequestCanceled } from "../../../services/api/Api";
import {
  DAYS,
  blockLabel,
  computeStatus,
  formatDuration,
  readCachedTimetable,
  todayKey,
  withPeriodNumbers,
  writeCachedTimetable,
} from "../../../utils/timetable";

const pad = (n) => String(n).padStart(2, "0");

// "Thời khóa biểu": the live countdown of vaolop.app (current period, time
// gone, next period, time left) plus the week's schedule. Editing happens in
// TimetableEditScreen; the schedule is stored on the account (web shares it).
export default function TimetableScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const [payload, setPayload] = useState(() => readCachedTimetable());
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState(() => todayKey());
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await getTimetable({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setPayload(res.data);
      writeCachedTimetable(res.data);
      setLoadError(false);
    } catch (err) {
      if (isRequestCanceled(err) || controller.signal.aborted) return;
      setLoadError(true);
    }
  }, []);

  // Reload on focus so a save in the editor shows up straight away.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => abortRef.current?.abort();
    }, [load])
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const schedule = payload?.data;
  const status = schedule ? computeStatus(schedule, now) : null;
  const today = todayKey(now);
  const dayBlocks = schedule ? withPeriodNumbers(schedule[day]) : [];

  const card = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  };
  const sectionTitle = {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.subText,
    marginBottom: 8,
    marginLeft: 4,
  };

  const statusText = () => {
    if (!status) return "";
    const c = status.current;
    switch (status.phase) {
      case "in":
        return c.type === "nghi"
          ? blockLabel(c)
          : t("timetable.nowLesson", { period: c.period, subject: c.subject });
      case "before":
        return t("timetable.beforeSchool");
      case "between":
        // A long gap is the lunch break between the morning and afternoon sessions.
        return status.remaining > 20 * 60 ? t("timetable.midBreak") : t("timetable.between");
      case "after":
        return t("timetable.afterSchool");
      default:
        return t("timetable.noLessonsToday");
    }
  };

  const nextText = () => {
    if (!status) return "—";
    if (status.next) {
      return status.next.type === "nghi"
        ? blockLabel(status.next)
        : t("timetable.periodSubject", { period: status.next.period, subject: status.next.subject });
    }
    if (status.current) {
      return status.current.type === "nghi" ? t("timetable.breakEnds") : t("timetable.lessonEnds");
    }
    return t("timetable.doneToday");
  };

  const inLesson = status?.phase === "in" && status.current.type === "hoc";
  const pillColors = inLesson
    ? { bg: isDarkMode ? "#1f3320" : "#EEF7ED", fg: theme.primary }
    : status?.phase === "in"
    ? { bg: isDarkMode ? "#3a2f12" : "#FEF3C7", fg: isDarkMode ? "#FBBF24" : "#B45309" }
    : { bg: theme.iconBackground, fg: theme.subText };

  let body;
  if (!payload && loadError) {
    body = (
      <View style={{ alignItems: "center", marginTop: 24 }}>
        <Text style={{ color: theme.subText }}>{t("timetable.loadError")}</Text>
        <TouchableOpacity
          onPress={load}
          activeOpacity={0.7}
          style={{ marginTop: 12, borderWidth: 1, borderColor: theme.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}
        >
          <Text style={{ color: theme.primary, fontWeight: "700" }}>{t("timetable.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!payload) {
    body = (
      <View style={{ alignItems: "center", marginTop: 48 }}>
        <CustomLoading size={60} />
      </View>
    );
  } else {
    body = (
      <>
        {payload.is_demo ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate("TimetableEditScreen")}
            style={{
              flexDirection: "row",
              gap: 8,
              borderWidth: 1,
              borderRadius: 12,
              padding: 10,
              borderColor: theme.primary,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.text }}>{t("timetable.demoNotice")}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Live clock + where we are in the day */}
        <View style={[card, { padding: 16, alignItems: "center" }]}>
          <Text style={{ fontSize: 44, fontWeight: "800", color: theme.text, fontVariant: ["tabular-nums"] }}>
            {`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`}
          </Text>
          <Text style={{ fontSize: 14, color: theme.subText, marginTop: 2 }}>{t(`timetable.dayLong.${today}`)}</Text>
          <View
            style={{
              marginTop: 14,
              backgroundColor: pillColors.bg,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              maxWidth: "100%",
            }}
          >
            <Text style={{ color: pillColors.fg, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
              {statusText()}
            </Text>
          </View>
          {status?.current ? (
            <View style={{ alignSelf: "stretch", marginTop: 14 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.iconBackground, overflow: "hidden" }}>
                <View style={{ width: `${Math.round(status.progress * 100)}%`, height: 6, backgroundColor: pillColors.fg }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: theme.subText }}>{status.current.start}</Text>
                <Text style={{ fontSize: 12, color: theme.subText }}>{status.current.end}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={card}>
          <InfoRow label={t("timetable.elapsed")} value={status?.elapsed != null ? formatDuration(status.elapsed) : "--:--"} big />
          <InfoRow label={t("timetable.next")} value={nextText()} />
          <InfoRow
            label={status?.next ? t("timetable.remainingNext") : t("timetable.remaining")}
            value={status?.remaining != null ? formatDuration(status.remaining) : "--:--"}
            big
            last
          />
        </View>

        <Text style={sectionTitle}>{t("timetable.week")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 12, paddingHorizontal: 2 }}
        >
          {DAYS.map((d) => {
            const active = d === day;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDay(d)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? theme.primary : theme.iconBackground,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : theme.text }}>
                  {t(`timetable.dayShort.${d}`)}
                  {d === today ? " •" : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={card}>
          {dayBlocks.length ? (
            dayBlocks.map((b, i) => {
              const running = day === today && status?.current && b.start === status.current.start && b.end === status.current.end;
              return (
                <View
                  key={`${b.start}-${i}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: i === dayBlocks.length - 1 ? 0 : StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                    backgroundColor: running ? (isDarkMode ? "#1f3320" : "#EEF7ED") : "transparent",
                  }}
                >
                  <View style={{ width: 56 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, fontVariant: ["tabular-nums"] }}>{b.start}</Text>
                    <Text style={{ fontSize: 12, color: theme.subText, fontVariant: ["tabular-nums"] }}>{b.end}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: b.type === "hoc" ? "500" : "400",
                        color: b.type === "hoc" ? theme.text : theme.subText,
                        fontStyle: b.type === "nghi" ? "italic" : "normal",
                      }}
                      numberOfLines={1}
                    >
                      {blockLabel(b)}
                    </Text>
                    {b.period ? (
                      <Text style={{ fontSize: 12, color: theme.subText }}>{t("timetable.period", { period: b.period })}</Text>
                    ) : null}
                  </View>
                  {running ? (
                    <View style={{ backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{t("timetable.now")}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={{ padding: 16, color: theme.subText, textAlign: "center" }}>{t("timetable.emptyDay")}</Text>
          )}
        </View>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 8,
            paddingTop: insets.top,
            height: 64 + insets.top,
          }}
        >
          <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()} accessibilityLabel={t("timetable.back")}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "600",
              color: theme.primary,
              opacity: headerTitleOpacity,
              marginHorizontal: 12,
            }}
          >
            {t("timetable.title")}
          </Animated.Text>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            disabled={!payload}
            onPress={() => navigation.navigate("TimetableEditScreen")}
            style={{ width: "auto", minWidth: 64, paddingHorizontal: 14 }}
            accessibilityLabel={t("timetable.edit")}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: payload ? theme.primary : theme.subText }}>
              {t("timetable.edit")}
            </Text>
          </LiquidButton>
        </View>
      </View>

      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} progressViewOffset={64 + insets.top} />
          }
        >
          {body}
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
}

function InfoRow({ label, value, big, last }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      }}
    >
      <Text style={{ fontSize: 13, color: theme.subText }}>{label}</Text>
      <Text
        style={{
          fontSize: big ? 28 : 17,
          fontWeight: big ? "800" : "600",
          color: theme.text,
          marginTop: 2,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}
