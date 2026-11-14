import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { apiErrorMessage } from "../../../../utils/apiMessage";
import { isRequestCanceled, searchGrade10Score } from "../../../../services/api/Api";
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

// Thi vào lớp 10 Ninh Bình (data from diemthininhbinh-ten.vercel.app, via the
// API). No captcha; the first two digits of the SBD are the school code.
export default function ScoreLookupGrade10Screen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();
  const inputStyle = useInputStyle();

  const [sbd, setSbd] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const valid = /^\d{6,10}$/.test(sbd.trim());

  const submit = async () => {
    if (!valid || searching) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const res = await searchGrade10Score(sbd.trim(), { signal: controller.signal });
      setResult(res.data);
    } catch (err) {
      if (isRequestCanceled(err)) return;
      setError(
        err?.response?.data?.reason === "not_found"
          ? apiErrorMessage(err, t("scoreLookup.notFound"))
          : apiErrorMessage(err, t("scoreLookup.failed"))
      );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };

  return (
    <ScoreScreen navigation={navigation} title={t("scoreLookup.grade10Title")}>
      <Hero icon="ribbon" watermark="trophy" title={t("scoreLookup.grade10Title")} text={t("scoreLookup.grade10Intro")} />

      <View style={[card, { padding: 16 }]}>
        <FieldLabel icon="id-card" color="#F59E0B">{t("scoreLookup.sbd")}</FieldLabel>
        <TextInput
          value={sbd}
          onChangeText={(v) => setSbd(v.replace(/\D/g, ""))}
          placeholder={t("scoreLookup.grade10Placeholder")}
          placeholderTextColor={theme.subText}
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="search"
          onSubmitEditing={submit}
          style={inputStyle}
        />
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
            disabled={!valid}
          />
        </View>
      </View>

      {result ? <Grade10Result result={result} /> : null}
    </ScoreScreen>
  );
}

const CHANCE = {
  likely: { icon: "checkmark-circle", color: "#22C55E", key: "scoreLookup.chanceLikely" },
  borderline: { icon: "alert-circle", color: "#F59E0B", key: "scoreLookup.chanceBorderline" },
  unlikely: { icon: "close-circle", color: "#EF4444", key: "scoreLookup.chanceUnlikely" },
};

function Grade10Result({ result }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();

  const rankHint = (rank) =>
    rank !== null && rank !== undefined && rank !== ""
      ? t("scoreLookup.rankInSchool", { rank })
      : undefined;
  const chance = CHANCE[result.chance];
  const percentile =
    result.xep_hang && result.tong_so
      ? Math.round((1 - (result.xep_hang - 1) / result.tong_so) * 100)
      : null;

  return (
    <>
      <SectionTitle icon="ribbon" color="#F59E0B">
        {t("scoreLookup.resultFor", { sbd: result.sbd })}
      </SectionTitle>
      <View style={[card, { padding: 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tint("#3B82F6", isDarkMode), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="school" size={22} color="#3B82F6" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 12, color: theme.subText }}>{t("scoreLookup.school")}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginTop: 1 }}>
              {result.school_name}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: 16, gap: 10 }}>
          <Stat label={t("scoreLookup.total")} value={showValue(result.tong)} color="#22C55E" icon="star" />
          <Stat
            label={t("scoreLookup.rank")}
            value={result.xep_hang ? `#${result.xep_hang}` : "—"}
            hint={result.tong_so ? t("scoreLookup.ofTotal", { total: result.tong_so }) : undefined}
            color="#F59E0B"
            icon="podium"
          />
          <Stat label={t("scoreLookup.quota")} value={showValue(result.chi_tieu)} color="#8B5CF6" icon="people" />
        </View>
        {percentile !== null ? (
          <View style={{ marginTop: 14 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.iconBackground, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(4, Math.min(100, percentile))}%`, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
            </View>
            <Text style={{ fontSize: 13, color: theme.subText, marginTop: 8 }}>
              {t("scoreLookup.percentile", { percent: percentile })}
            </Text>
          </View>
        ) : null}
      </View>

      {chance ? (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            borderRadius: 16,
            padding: 12,
            backgroundColor: tint(chance.color, isDarkMode),
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <Ionicons name={chance.icon} size={22} color={chance.color} />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600", color: theme.text }}>
            {t(chance.key, { rank: result.xep_hang, quota: result.chi_tieu })}
          </Text>
        </View>
      ) : null}

      <SectionTitle icon="book" color="#8B5CF6">{t("scoreLookup.subjects")}</SectionTitle>
      <View style={card}>
        <ScoreRow
          icon="book"
          color="#EC4899"
          label={t("scoreLookup.literature")}
          value={showValue(result.van)}
          hint={rankHint(result.hang_van)}
        />
        <ScoreRow
          icon="calculator"
          color="#EF4444"
          label={t("scoreLookup.math")}
          value={showValue(result.toan)}
          hint={rankHint(result.hang_toan)}
        />
        <ScoreRow
          icon="language"
          color="#3B82F6"
          label={t("scoreLookup.foreignLanguage")}
          value={showValue(result.ngoai_ngu)}
          hint={rankHint(result.hang_nn)}
          last
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8, borderRadius: 16, padding: 12, backgroundColor: tint("#3B82F6", isDarkMode) }}>
        <Ionicons name="information-circle" size={18} color="#3B82F6" />
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.subText }}>
          {t("scoreLookup.grade10Disclaimer")}
        </Text>
      </View>
    </>
  );
}

function Stat({ label, value, hint, color, icon }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint(color, isDarkMode),
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ fontSize: 12, color: theme.subText, marginTop: 4 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color, marginTop: 2 }} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 11, color: theme.subText }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
