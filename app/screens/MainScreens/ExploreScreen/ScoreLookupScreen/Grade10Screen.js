import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { apiErrorMessage } from "../../../../utils/apiMessage";
import { isRequestCanceled, searchGrade10Score } from "../../../../services/api/Api";
import {
  PrimaryButton,
  ScoreRow,
  ScoreScreen,
  SectionTitle,
  showValue,
  useCardStyle,
} from "./shared";

// Thi vào lớp 10 Ninh Bình (data from diemthininhbinh-ten.vercel.app, via the
// API). No captcha; the first two digits of the SBD are the school code.
export default function ScoreLookupGrade10Screen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();

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
      <Text style={{ fontSize: 14, lineHeight: 20, color: theme.subText, marginBottom: 16, marginHorizontal: 4 }}>
        {t("scoreLookup.grade10Intro")}
      </Text>

      <View style={[card, { padding: 16 }]}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginBottom: 8 }}>
          {t("scoreLookup.sbd")}
        </Text>
        <TextInput
          value={sbd}
          onChangeText={(v) => setSbd(v.replace(/\D/g, ""))}
          placeholder={t("scoreLookup.grade10Placeholder")}
          placeholderTextColor={theme.subText}
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="search"
          onSubmitEditing={submit}
          style={{
            height: 44,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            fontSize: 16,
            color: theme.text,
          }}
        />
        {error ? (
          <Text style={{ color: "#FF3B30", fontSize: 14, lineHeight: 20, marginTop: 12 }}>{error}</Text>
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
  unlikely: { icon: "close-circle", color: "#FF3B30", key: "scoreLookup.chanceUnlikely" },
};

function Grade10Result({ result }) {
  const { theme } = useTheme();
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
      <SectionTitle>{t("scoreLookup.resultFor", { sbd: result.sbd })}</SectionTitle>
      <View style={[card, { padding: 16 }]}>
        <Text style={{ fontSize: 13, color: theme.subText }}>{t("scoreLookup.school")}</Text>
        <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text, marginTop: 2 }}>
          {result.school_name}
        </Text>
        <View style={{ flexDirection: "row", marginTop: 16, gap: 12 }}>
          <Stat label={t("scoreLookup.total")} value={showValue(result.tong)} accent />
          <Stat
            label={t("scoreLookup.rank")}
            value={result.xep_hang ? `#${result.xep_hang}` : "—"}
            hint={result.tong_so ? t("scoreLookup.ofTotal", { total: result.tong_so }) : undefined}
          />
          <Stat label={t("scoreLookup.quota")} value={showValue(result.chi_tieu)} />
        </View>
        {percentile !== null ? (
          <Text style={{ fontSize: 13, color: theme.subText, marginTop: 12 }}>
            {t("scoreLookup.percentile", { percent: percentile })}
          </Text>
        ) : null}
      </View>

      {chance ? (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            borderWidth: 1,
            borderRadius: 12,
            padding: 10,
            borderColor: chance.color,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <Ionicons name={chance.icon} size={18} color={chance.color} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.text }}>
            {t(chance.key, { rank: result.xep_hang, quota: result.chi_tieu })}
          </Text>
        </View>
      ) : null}

      <SectionTitle>{t("scoreLookup.subjects")}</SectionTitle>
      <View style={card}>
        <ScoreRow label={t("scoreLookup.literature")} value={showValue(result.van)} hint={rankHint(result.hang_van)} />
        <ScoreRow label={t("scoreLookup.math")} value={showValue(result.toan)} hint={rankHint(result.hang_toan)} />
        <ScoreRow
          label={t("scoreLookup.foreignLanguage")}
          value={showValue(result.ngoai_ngu)}
          hint={rankHint(result.hang_nn)}
          last
        />
      </View>
      <Text style={{ fontSize: 13, color: theme.subText, marginHorizontal: 4 }}>
        {t("scoreLookup.grade10Disclaimer")}
      </Text>
    </>
  );
}

function Stat({ label, value, hint, accent }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.iconBackground,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 12, color: theme.subText }} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ fontSize: 20, fontWeight: "800", color: accent ? theme.primary : theme.text, marginTop: 2 }}
        numberOfLines={1}
      >
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
