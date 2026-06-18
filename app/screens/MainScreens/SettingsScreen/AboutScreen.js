import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const Section = ({ title, children, theme, isDarkMode }) => (
  <View style={[styles.section, { backgroundColor: isDarkMode ? "#1f2937" : "#F2F9F2" }]}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t("about.title")}</Text>
        <View style={{ width: 24, height: 24 }}></View>
      </View>

      <ScrollView style={styles.content}>
        {/* School Info */}
        <View style={styles.schoolInfo}>
          <Image
            source={require("../../../assets/school-logo.jpg")}
            style={styles.schoolLogo}
          />
          <Text style={[styles.schoolName, { color: theme.primary }]}>{t("about.schoolName")}</Text>
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.schoolDesc1")}
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.schoolDesc2")}
        </Text>

        <Section title={t("about.historyTitle")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}> 
            {t("about.historyDesc")}
          </Text>
        </Section>

        <Section title={t("about.activitiesTitle")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}> 
            {t("about.activitiesDesc")}
          </Text>
        </Section>

        <Section title={t("about.goalsTitle")} theme={theme} isDarkMode={isDarkMode}>
          <View style={styles.bulletPoints}>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • {t("about.goals1")}
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • {t("about.goals2")}
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • {t("about.goals3")}
            </Text>
          </View>
        </Section>

        {/* School Info */}
        <View style={[styles.schoolInfo, { marginTop: 40 }]}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.schoolLogo}
          />
          <Text style={[styles.schoolName, { color: theme.primary }]}>{t("about.appName")}</Text>
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.appDesc1")}
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.appDesc2")}
        </Text>

        <Section title={t("about.feature1Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}> 
            {t("about.feature1Desc")}
          </Text>
        </Section>

        <Section title={t("about.feature2Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}> 
            {t("about.feature2Desc")}
          </Text>
        </Section>

        <Section title={t("about.feature3Title")} theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}> 
            {t("about.feature3Desc")}
          </Text>
        </Section>

        <Text style={[styles.copyright, { color: theme.subText }]}>
          {t("about.copyright")}
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    flex: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  schoolInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  schoolLogo: {
    width: 64,
    height: 64,
    marginBottom: 12,
    borderRadius: 35,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
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
  },
  bulletPoints: {
    marginTop: 4,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 24,
  },
  copyright: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingBottom: 16,
  },
});
