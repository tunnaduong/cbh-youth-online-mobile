import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { tint } from "../../../../components/settings/SettingsUI";
import { Hero, ScoreScreen, SectionTitle, useCardStyle } from "./shared";

const EXAMS = [
  {
    route: "ScoreLookupThptScreen",
    icon: "school",
    color: "#3B82F6",
    titleKey: "scoreLookup.thptTitle",
    descKey: "scoreLookup.thptDesc",
  },
  {
    route: "ScoreLookupGrade10Screen",
    icon: "ribbon",
    color: "#F59E0B",
    titleKey: "scoreLookup.grade10Title",
    descKey: "scoreLookup.grade10Desc",
  },
];

// "Tra cứu điểm thi": pick which exam to look up.
export default function ScoreLookupScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();

  return (
    <ScoreScreen navigation={navigation} title={t("scoreLookup.title")}>
      <Hero icon="stats-chart" watermark="ribbon" title={t("scoreLookup.title")} text={t("scoreLookup.intro")} />

      <SectionTitle icon="location" color="#EF4444">
        {t("scoreLookup.ninhBinh")}
      </SectionTitle>
      {EXAMS.map((exam) => (
        <TouchableOpacity
          key={exam.route}
          activeOpacity={0.75}
          accessibilityRole="button"
          onPress={() => navigation.navigate(exam.route)}
          style={[card, { flexDirection: "row", alignItems: "center", padding: 16, marginBottom: 12 }]}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: tint(exam.color, isDarkMode),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={exam.icon} size={26} color={exam.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>{t(exam.titleKey)}</Text>
            <Text style={{ fontSize: 13, color: theme.subText, marginTop: 2, lineHeight: 18 }}>{t(exam.descKey)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        </TouchableOpacity>
      ))}

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          borderRadius: 16,
          padding: 12,
          marginTop: 4,
          backgroundColor: tint("#3B82F6", isDarkMode),
        }}
      >
        <Ionicons name="information-circle" size={18} color="#3B82F6" />
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.subText }}>
          {t("scoreLookup.sourceNote")}
        </Text>
      </View>
    </ScoreScreen>
  );
}
