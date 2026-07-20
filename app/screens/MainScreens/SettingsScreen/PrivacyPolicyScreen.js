import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";

const Section = ({ title, children, theme }) => (
  <View style={styles.sectionWrapper}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  </View>
);

export default function PrivacyPolicyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <LiquidButton size={40} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </LiquidButton>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t("privacy.headerTitle")}</Text>
        <View style={{ width: 40 }}></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <Text style={[styles.introText, { color: theme.text }]}>
          {t("privacy.intro")}
        </Text>

        <Section title={t("privacy.s1Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text4")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text5")}
          </Text>
        </Section>

        <Section title={t("privacy.s2Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text4")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text5")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text6")}
          </Text>
        </Section>

        <Section title={t("privacy.s3Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text4")}
          </Text>
        </Section>

        <Section title={t("privacy.s4Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s4Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s4Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s4Text3")}
          </Text>
        </Section>

        <Section title={t("privacy.s5Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text4")}
          </Text>
        </Section>

        <Section title={t("privacy.s6Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s6Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s6Text2")}
          </Text>
        </Section>

        <Section title={t("privacy.s7Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s7Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s7Text2")}
          </Text>
        </Section>

        <Section title={t("privacy.s8Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s8Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s8Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s8Text3")}
          </Text>
        </Section>

        <Section title={t("privacy.s9Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Email")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Phone")}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 16,
    textAlign: "justify",
    marginHorizontal: 16,
  },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  settingSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 16,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
});

