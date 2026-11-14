import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import { tint } from "../../../components/settings/SettingsUI";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { apiErrorMessage } from "../../../utils/apiMessage";
import { resetTimetable, saveTimetable } from "../../../services/api/Api";
import {
  DAYS,
  fromSeconds,
  parseTimetableJson,
  readCachedTimetable,
  sortBlocks,
  todayKey,
  toSeconds,
  writeCachedTimetable,
} from "../../../utils/timetable";
import AiImportModal from "./AiImportModal";

const LESSON_MINUTES = 45;
const GAP_MINUTES = 5;

const cloneSchedule = (data) => {
  const out = {};
  DAYS.forEach((d) => {
    out[d] = (data?.[d] || []).map((b) => ({ ...b }));
  });
  return out;
};

// Edit the account's timetable day by day (vaolop.app's config page): lessons
// and breaks with start/end times, plus import / export of the JSON through
// the clipboard. Saved to the API on "Lưu".
export default function TimetableEditScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const initial = useMemo(() => cloneSchedule(readCachedTimetable()?.data), []);
  // The sample schedule's subjects mean nothing for this class, so the AI only
  // gets the current schedule once it is the user's own.
  const startedFromDemo = useMemo(() => !!readCachedTimetable()?.is_demo, []);
  const [draft, setDraft] = useState(initial);
  const [day, setDay] = useState(() => todayKey());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // { index, field: "start" | "end", value: Date }
  const [picker, setPicker] = useState(null);
  const leavingRef = useRef(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNote, setAiNote] = useState("");

  const blocks = draft[day] || [];

  const update = (fn) => {
    setDraft((prev) => {
      const next = cloneSchedule(prev);
      fn(next);
      return next;
    });
    setDirty(true);
    setError("");
  };

  // Ask before throwing away unsaved edits.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!dirty || leavingRef.current) return;
      e.preventDefault();
      Alert.alert(t("timetable.discardTitle"), t("timetable.discardMessage"), [
        { text: t("timetable.keepEditing"), style: "cancel" },
        { text: t("timetable.discard"), style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty, t]);

  const addBlock = (type) => {
    update((d) => {
      const list = sortBlocks(d[day]);
      const last = list[list.length - 1];
      const start = last ? toSeconds(last.end) + (type === "hoc" ? GAP_MINUTES * 60 : 0) : 7 * 3600;
      const length = (type === "hoc" ? LESSON_MINUTES : 20) * 60;
      const block =
        type === "hoc"
          ? { type: "hoc", start: fromSeconds(start), end: fromSeconds(start + length), subject: "" }
          : { type: "nghi", start: fromSeconds(start), end: fromSeconds(start + length), label: t("timetable.breakDefault") };
      d[day] = [...list, block];
    });
  };

  const setType = (index, type) =>
    update((d) => {
      const b = d[day][index];
      b.type = type;
      if (type === "nghi" && !b.label) b.label = t("timetable.breakDefault");
      if (type === "hoc" && b.subject === undefined) b.subject = "";
    });

  const openPicker = (index, field) => {
    const sec = toSeconds(blocks[index][field]);
    const value = new Date();
    value.setHours(Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), 0, 0);
    setPicker({ index, field, value });
  };

  const applyTime = (date, target = picker) => {
    if (!target || !date) return;
    const value = fromSeconds(date.getHours() * 3600 + date.getMinutes() * 60);
    const { index, field } = target;
    update((d) => {
      const b = d[day][index];
      const length = toSeconds(b.end) - toSeconds(b.start);
      b[field] = value;
      // Moving the start keeps the block's length, as people usually shift a whole period.
      if (field === "start" && length > 0) b.end = fromSeconds(toSeconds(value) + length);
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await saveTimetable(draft);
      writeCachedTimetable(res.data);
      setDraft(cloneSchedule(res.data.data));
      setDirty(false);
      Toast.show({ type: "success", text1: t("timetable.saved") });
      leavingRef.current = true;
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err, t("timetable.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const restoreDemo = () => {
    Alert.alert(t("timetable.restoreTitle"), t("timetable.restoreMessage"), [
      { text: t("timetable.cancel"), style: "cancel" },
      {
        text: t("timetable.restore"),
        style: "destructive",
        onPress: async () => {
          try {
            const res = await resetTimetable();
            writeCachedTimetable(res.data);
            setDraft(cloneSchedule(res.data.data));
            setDirty(false);
            Toast.show({ type: "success", text1: t("timetable.restored") });
          } catch (err) {
            Toast.show({ type: "error", text1: t("common.error"), text2: apiErrorMessage(err) });
          }
        },
      },
    ]);
  };

  const clearDay = () => {
    Alert.alert(t("timetable.clearDayTitle", { day: t(`timetable.dayLong.${day}`) }), t("timetable.clearDayMessage"), [
      { text: t("timetable.cancel"), style: "cancel" },
      { text: t("timetable.clear"), style: "destructive", onPress: () => update((d) => (d[day] = [])) },
    ]);
  };

  const exportJson = async () => {
    await Clipboard.setStringAsync(JSON.stringify(draft, null, 2));
    Toast.show({ type: "success", text1: t("timetable.exported"), text2: t("timetable.exportedHint") });
  };

  const importJson = async () => {
    const parsed = parseTimetableJson(await Clipboard.getStringAsync());
    if (!parsed) {
      Toast.show({ type: "error", text1: t("timetable.importInvalid"), text2: t("timetable.importHint") });
      return;
    }
    Alert.alert(t("timetable.importTitle"), t("timetable.importMessage"), [
      { text: t("timetable.cancel"), style: "cancel" },
      {
        text: t("timetable.import"),
        onPress: () => {
          setDraft(cloneSchedule(parsed));
          setDirty(true);
          Toast.show({ type: "info", text1: t("timetable.imported") });
        },
      },
    ]);
  };

  const applyAi = (data, note) => {
    setDraft(cloneSchedule(data));
    setDirty(true);
    setError("");
    setAiNote(note);
    setAiOpen(false);
    // Jump to the first day the AI filled in.
    const firstDay = DAYS.find((d) => (data?.[d] || []).length);
    if (firstDay && !(data?.[day] || []).length) setDay(firstDay);
    Toast.show({ type: "success", text1: t("timetable.ai.applied"), text2: t("timetable.ai.appliedHint") });
  };

  const card = {
    backgroundColor: theme.surface,
    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
  };
  const chip = (active) => ({
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: active ? theme.primary : theme.iconBackground,
  });
  const timeButton = {
    flex: 1,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDarkMode ? "#282B34" : "#CBD5E1",
    borderRadius: 12,
    backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    alignItems: "center",
    justifyContent: "center",
  };
  const outlineRow = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: isDarkMode ? "#1B472C" : "#A7F3D0",
    backgroundColor: isDarkMode ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.08)",
    borderRadius: 999,
    paddingVertical: 12,
    flex: 1,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Top ambient green glow */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 160,
          zIndex: 0,
        }}
        pointerEvents="none"
      />
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
          <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()} accessibilityLabel={t("timetable.close")}>
            <Ionicons name="close" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text
            numberOfLines={1}
            style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600", color: theme.primary, opacity: headerTitleOpacity, marginHorizontal: 12 }}
          >
            {t("timetable.editTitle")}
          </Animated.Text>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            disabled={saving}
            onPress={save}
            style={{ width: "auto", minWidth: 64, paddingHorizontal: 14 }}
            accessibilityLabel={t("timetable.save")}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary }}>{t("timetable.save")}</Text>
            )}
          </LiquidButton>
        </View>
      </View>

      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          <Text style={{ fontSize: 14, lineHeight: 20, color: theme.subText, marginBottom: 12, marginHorizontal: 4 }}>
            {t("timetable.editIntro")}
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setAiOpen(true)}
            accessibilityRole="button"
            style={[
              card,
              {
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderColor: isDarkMode ? "#1B472C" : "#D5EBD7",
                backgroundColor: isDarkMode ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.06)",
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: tint("#22C55E", isDarkMode),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="sparkles" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>{t("timetable.ai.title")}</Text>
              <Text style={{ fontSize: 13, color: theme.subText, marginTop: 2 }}>{t("timetable.ai.cardHint")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </TouchableOpacity>

          {aiNote ? (
            <View style={{ flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, borderColor: theme.primary, marginBottom: 12 }}>
              <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.text }}>{aiNote}</Text>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12, paddingHorizontal: 2 }}>
            {DAYS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDay(d)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: d === day }}
                style={chip(d === day)}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: d === day ? "#fff" : theme.text }}>
                  {t(`timetable.dayShort.${d}`)} · {(draft[d] || []).length}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {error ? <Text style={{ color: "#FF3B30", fontSize: 14, lineHeight: 20, marginBottom: 12 }}>{error}</Text> : null}

          {blocks.length === 0 ? (
            <View style={[card, { padding: 16, alignItems: "center" }]}>
              <Ionicons name="calendar-outline" size={40} color={theme.subText} />
              <Text style={{ color: theme.subText, marginTop: 8 }}>{t("timetable.emptyDay")}</Text>
            </View>
          ) : null}

          {blocks.map((b, index) => (
            <View key={index} style={[card, { padding: 12 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {[
                  ["hoc", t("timetable.typeLesson")],
                  ["nghi", t("timetable.typeBreak")],
                ].map(([type, label]) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setType(index, type)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: b.type === type }}
                    style={chip(b.type === type)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: b.type === type ? "#fff" : theme.text }}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => update((d) => d[day].splice(index, 1))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("timetable.removeRow")}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={timeButton} onPress={() => openPicker(index, "start")} accessibilityLabel={t("timetable.start")}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text, fontVariant: ["tabular-nums"] }}>{b.start}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color={theme.subText} />
                <TouchableOpacity style={timeButton} onPress={() => openPicker(index, "end")} accessibilityLabel={t("timetable.end")}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text, fontVariant: ["tabular-nums"] }}>{b.end}</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                value={b.type === "nghi" ? b.label || "" : b.subject || ""}
                onChangeText={(v) =>
                  update((d) => {
                    if (b.type === "nghi") d[day][index].label = v;
                    else d[day][index].subject = v;
                  })
                }
                placeholder={b.type === "nghi" ? t("timetable.breakDefault") : t("timetable.subjectPlaceholder")}
                placeholderTextColor={theme.subText}
                maxLength={60}
                style={{
                  marginTop: 10,
                  height: 44,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  fontSize: 15,
                  color: theme.text,
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)",
                }}
              />
            </View>
          ))}

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
            <TouchableOpacity style={outlineRow} activeOpacity={0.7} onPress={() => addBlock("hoc")}>
              <Ionicons name="add" size={18} color={theme.primary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>{t("timetable.addLesson")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={outlineRow} activeOpacity={0.7} onPress={() => addBlock("nghi")}>
              <Ionicons name="cafe-outline" size={18} color={theme.primary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>{t("timetable.addBreak")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: theme.subText, marginBottom: 8, marginLeft: 4 }}>
            {t("timetable.more")}
          </Text>
          <View style={card}>
            <ActionRow icon="copy-outline" label={t("timetable.export")} hint={t("timetable.exportHint")} onPress={exportJson} />
            <ActionRow icon="clipboard-outline" label={t("timetable.importFromClipboard")} hint={t("timetable.importHint")} onPress={importJson} />
            <ActionRow icon="refresh-outline" label={t("timetable.restoreDemo")} onPress={restoreDemo} />
            <ActionRow icon="trash-outline" label={t("timetable.clearDay")} onPress={clearDay} destructive last />
          </View>
        </Animated.ScrollView>
      </AndroidGlassBackdrop>

      <AiImportModal visible={aiOpen} onClose={() => setAiOpen(false)} current={startedFromDemo && !dirty ? null : draft} onResult={applyAi} />

      {picker && Platform.OS === "android" ? (
        <DateTimePicker
          value={picker.value}
          mode="time"
          is24Hour
          onChange={(event, date) => {
            const p = picker;
            setPicker(null);
            if (event.type === "set" && date) applyTime(date, p);
          }}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setPicker(null)}
            style={{ flex: 1, backgroundColor: isDarkMode ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          >
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 12 }}>
                <TouchableOpacity onPress={() => setPicker(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary }}>{t("timetable.done")}</Text>
                </TouchableOpacity>
              </View>
              {picker ? (
                <DateTimePicker
                  value={picker.value}
                  mode="time"
                  display="spinner"
                  locale="vi-VN"
                  is24Hour
                  themeVariant={isDarkMode ? "dark" : "light"}
                  onChange={(event, date) => {
                    if (!date) return;
                    setPicker((p) => (p ? { ...p, value: date } : p));
                    applyTime(date);
                  }}
                />
              ) : null}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );
}

function ActionRow({ icon, label, hint, onPress, destructive, last }) {
  const { theme, isDarkMode } = useTheme();
  const color = destructive ? "#FF3B30" : theme.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint(color, isDarkMode), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 16, color: destructive ? "#FF3B30" : theme.text }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 13, color: theme.subText, marginTop: 2 }}>{hint}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
