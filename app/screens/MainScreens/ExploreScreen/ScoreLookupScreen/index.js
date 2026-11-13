import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { ScoreScreen, SectionTitle, useCardStyle } from "./shared";

const EXAMS = [
  {
    route: "ScoreLookupThptScreen",
    icon: "school-outline",
    titleKey: "scoreLookup.thptTitle",
    descKey: "scoreLookup.thptDesc",
  },
  {
    route: "ScoreLookupGrade10Screen",
    icon: "ribbon-outline",
    titleKey: "scoreLookup.grade10Title",
    descKey: "scoreLookup.grade10Desc",
  },
];

// "Tra cứu điểm thi": pick which exam to look up.
export default function ScoreLookupScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const card = useCardStyle();

  return (
    <ScoreScreen navigation={navigation} title={t("scoreLookup.title")}>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: theme.subText,
          marginBottom: 16,
          marginHorizontal: 4,
        }}
      >
        {t("scoreLookup.intro")}
      </Text>

      <SectionTitle>{t("scoreLookup.ninhBinh")}</SectionTitle>
      <View style={card}>
        {EXAMS.map((exam, i) => (
          <TouchableOpacity
            key={exam.route}
            activeOpacity={0.7}
            accessibilityRole="button"
            onPress={() => navigation.navigate(exam.route)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 16,
              paddingHorizontal: 16,
              borderBottomWidth: i === EXAMS.length - 1 ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.iconBackground,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={exam.icon} size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>
                {t(exam.titleKey)}
              </Text>
              <Text style={{ fontSize: 13, color: theme.subText, marginTop: 2 }}>
                {t(exam.descKey)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 13, color: theme.subText, marginHorizontal: 4 }}>
        {t("scoreLookup.sourceNote")}
      </Text>
    </ScoreScreen>
  );
}
