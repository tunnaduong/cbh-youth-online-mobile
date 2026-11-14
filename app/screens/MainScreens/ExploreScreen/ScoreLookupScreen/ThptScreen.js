import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import CustomLoading from "../../../../components/CustomLoading";
import { apiErrorMessage } from "../../../../utils/apiMessage";
import {
  getExamScoreCaptcha,
  getExamScoreConfig,
  isRequestCanceled,
  searchExamScore,
} from "../../../../services/api/Api";
import { tint } from "../../../../components/settings/SettingsUI";
import {
  FieldLabel,
  Hero,
  PrimaryButton,
  ScoreRow,
  ScoreScreen,
  SectionTitle,
  showValue,
  useCardStyle,
  useInputStyle,
} from "./shared";

const SOURCE = "ninh-binh";

// Thi tốt nghiệp THPT - Sở GD&ĐT Ninh Bình (tracuudiemnb.ninhbinh.edu.vn, via
// the API). The site wants a captcha with every lookup: we show its image and
// the user types it, exactly like on the web page.
export default function ScoreLookupThptScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();
  const inputStyle = useInputStyle();

  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [captcha, setCaptcha] = useState(null); // { id, svg }
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [sbd, setSbd] = useState("");
  const [answer, setAnswer] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const abortRef = useRef(null);
  const captchaAbortRef = useRef(null);
  const answerInputRef = useRef(null);

  const loadCaptcha = useCallback(async () => {
    captchaAbortRef.current?.abort();
    const controller = new AbortController();
    captchaAbortRef.current = controller;
    setCaptchaLoading(true);
    setAnswer("");
    try {
      const res = await getExamScoreCaptcha(SOURCE, { signal: controller.signal });
      if (!controller.signal.aborted) setCaptcha(res.data);
    } catch (err) {
      if (isRequestCanceled(err) || controller.signal.aborted) return;
      setCaptcha(null);
    } finally {
      if (!controller.signal.aborted) setCaptchaLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadError(false);
    try {
      const res = await getExamScoreConfig(SOURCE, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setConfig(res.data);
      const opensAt = res.data?.start_time ? new Date(res.data.start_time) : null;
      if (!opensAt || opensAt <= new Date()) loadCaptcha();
    } catch (err) {
      if (isRequestCanceled(err) || controller.signal.aborted) return;
      setLoadError(true);
    }
  }, [loadCaptcha]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
      captchaAbortRef.current?.abort();
    };
  }, [load]);

  const submit = async () => {
    const code = sbd.trim();
    const typed = answer.trim();
    if (!code || !typed || !captcha || searching) return;
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const res = await searchExamScore(SOURCE, {
        so_bao_danh: code,
        captcha_id: captcha.id,
        captcha_answer: typed,
      });
      setResult(res.data);
    } catch (err) {
      const reason = err?.response?.data?.reason;
      setError(
        reason === "captcha"
          ? apiErrorMessage(err, t("scoreLookup.captchaWrong"))
          : reason === "not_found"
          ? apiErrorMessage(err, t("scoreLookup.notFound"))
          : apiErrorMessage(err, t("scoreLookup.failed"))
      );
      if (reason === "captcha") setTimeout(() => answerInputRef.current?.focus(), 300);
    } finally {
      setSearching(false);
      // Each captcha is good for one lookup; the site hands out a new one too.
      loadCaptcha();
    }
  };

  const opensAt = config?.start_time ? new Date(config.start_time) : null;
  const pending = opensAt && opensAt > new Date();

  let body;
  if (loadError) {
    body = (
      <View style={{ alignItems: "center", marginTop: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tint("#EF4444", isDarkMode), alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Ionicons name="cloud-offline" size={26} color="#EF4444" />
        </View>
        <Text style={{ color: theme.subText, textAlign: "center" }}>{t("scoreLookup.loadError")}</Text>
        <TouchableOpacity
          onPress={load}
          activeOpacity={0.7}
          style={{
            marginTop: 12,
            backgroundColor: tint("#22C55E", isDarkMode),
            borderRadius: 999,
            paddingHorizontal: 22,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: theme.primary, fontWeight: "700" }}>{t("scoreLookup.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!config) {
    body = (
      <View style={{ alignItems: "center", marginTop: 48 }}>
        <CustomLoading size={60} />
      </View>
    );
  } else if (pending) {
    body = (
      <View style={[card, { padding: 20, alignItems: "center" }]}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tint("#F59E0B", isDarkMode), alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="time" size={36} color="#F59E0B" />
        </View>
        <Text style={{ color: theme.subText, marginTop: 12, textAlign: "center", lineHeight: 20 }}>
          {t("scoreLookup.notOpenYet", {
            date: opensAt.toLocaleString(),
          })}
        </Text>
      </View>
    );
  } else {
    body = (
      <>
        <View style={[card, { padding: 16 }]}>
          <FieldLabel icon="id-card" color="#3B82F6">{t("scoreLookup.sbd")}</FieldLabel>
          <TextInput
            value={sbd}
            onChangeText={(v) => setSbd(v.toUpperCase())}
            placeholder={t("scoreLookup.sbdPlaceholder")}
            placeholderTextColor={theme.subText}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => answerInputRef.current?.focus()}
            maxLength={32}
            style={inputStyle}
          />

          <FieldLabel icon="shield-checkmark" color="#10B981" style={{ marginTop: 18 }}>{t("scoreLookup.captcha")}</FieldLabel>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              ref={answerInputRef}
              value={answer}
              onChangeText={(v) => setAnswer(v.toUpperCase())}
              placeholder={t("scoreLookup.captchaPlaceholder")}
              placeholderTextColor={theme.subText}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="search"
              onSubmitEditing={submit}
              style={[inputStyle, { flex: 1, letterSpacing: 3, fontWeight: "700" }]}
            />
            <View
              style={{
                width: 132,
                height: 48,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDarkMode ? "#3A3F4A" : "#CBD5E1",
                alignItems: "center",
                justifyContent: "center",
                // The captcha is drawn on its own light background, so it reads
                // the same in dark mode.
                backgroundColor: "#f1f5f9",
              }}
            >
              {captchaLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : captcha?.svg ? (
                <SvgXml xml={captcha.svg} width={132} height={33} />
              ) : (
                <Ionicons name="alert-circle-outline" size={22} color="#FF3B30" />
              )}
            </View>
            <TouchableOpacity
              onPress={loadCaptcha}
              disabled={captchaLoading}
              accessibilityRole="button"
              accessibilityLabel={t("scoreLookup.refreshCaptcha")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: tint("#22C55E", isDarkMode),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="refresh" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12, borderRadius: 14, padding: 10, backgroundColor: tint("#EF4444", isDarkMode) }}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={{ flex: 1, color: "#EF4444", fontSize: 14, lineHeight: 20 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 16 }}>
            <PrimaryButton
              label={t("scoreLookup.search")}
              onPress={submit}
              busy={searching}
              disabled={!sbd.trim() || !answer.trim() || !captcha}
            />
          </View>
        </View>

        {result ? <ThptResult result={result} /> : null}
      </>
    );
  }

  return (
    <ScoreScreen navigation={navigation} title={t("scoreLookup.thptTitle")}>
      <Hero
        icon="school"
        title={t("scoreLookup.thptTitle")}
        text={[config?.title, config?.school_year].filter(Boolean).join(" · ") || t("scoreLookup.thptDesc")}
      />
      {body}
    </ScoreScreen>
  );
}

const SUBJECT_ICONS = ["book", "calculator", "language", "flask", "leaf", "globe", "library", "color-palette"];
const SUBJECT_COLORS = ["#3B82F6", "#EF4444", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899", "#14B8A6", "#6366F1"];

function ThptResult({ result }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();
  const subjects = result.subjects || [];

  return (
    <>
      <SectionTitle icon="ribbon" color="#F59E0B">
        {t("scoreLookup.resultFor", { sbd: result.so_bao_danh })}
      </SectionTitle>
      <View style={card}>
        {subjects.length ? (
          subjects.map((s, i) => (
            <ScoreRow
              key={`${s.name}-${i}`}
              label={s.name}
              value={showValue(s.score)}
              icon={SUBJECT_ICONS[i % SUBJECT_ICONS.length]}
              color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
              last={i === subjects.length - 1}
            />
          ))
        ) : (
          // Not in "Môn: điểm" form - show the text as the site does.
          <Text style={{ padding: 16, fontSize: 15, fontWeight: "500", color: theme.text, lineHeight: 22 }}>
            {showValue(result.diem_thi)}
          </Text>
        )}
      </View>
      {result.ghi_chu ? (
        <View style={{ flexDirection: "row", gap: 8, borderRadius: 16, padding: 12, backgroundColor: tint("#3B82F6", isDarkMode) }}>
          <Ionicons name="information-circle" size={18} color="#3B82F6" />
          <Text style={{ flex: 1, fontSize: 13, fontStyle: "italic", color: theme.subText, lineHeight: 18 }}>
            {result.ghi_chu}
          </Text>
        </View>
      ) : null}
    </>
  );
}
