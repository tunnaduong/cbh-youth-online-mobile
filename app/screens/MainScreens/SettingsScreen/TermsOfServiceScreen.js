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

const Section = ({ title, children, theme, isDarkMode }) => (
  <View style={[styles.section, { backgroundColor: isDarkMode ? "#1f2937" : "#F2F9F2" }]}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

export default function TermsOfServiceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t("terms.headerTitle")}</Text>
        <View style={{ width: 24, height: 24 }}></View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <Text style={[styles.introText, { color: theme.text }]}>
          {t("terms.intro")}
        </Text>

        <Section title={t("terms.s1Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s1Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s1Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s2Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s2Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s2Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s2Text3")}
          </Text>
        </Section>

        <Section title={t("terms.s3Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s3Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s3Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s3Text3")}
          </Text>
        </Section>

        <Section title={t("terms.s4Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text4")}
          </Text>
        </Section>

        <Section title={t("terms.s5Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s5Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s5Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s5Text3")}
          </Text>
        </Section>

        <Section title={t("terms.s6Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s6Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s6Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s7Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s7Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s7Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s8Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s8Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s8Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s9Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Email")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Phone")}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: "justify",
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
});

