import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import ReportHeader from "../../../components/ReportHeader";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const STEPS = [
  {
    id: 1,
    titleKey: "report.step1",
    subtitleKey: "report.step1Desc",
  },
  {
    id: 2,
    titleKey: "report.step2",
    subtitleKey: "report.step2Desc",
  },
  {
    id: 3,
    titleKey: "report.step3",
    subtitleKey: "report.step3Desc",
  },
];

const VIOLATION_TYPES = [
  {
    id: "student",
    icon: "person",
    titleKey: "report.studentViolation",
    descKey: "report.studentViolationDesc",
  },
  {
    id: "class",
    icon: "people",
    titleKey: "report.classViolation",
    descKey: "report.classViolationDesc",
  },
];

export default function ReportScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor: step.id === 1 ? theme.primary : (isDarkMode ? "#374151" : "#E5E5E5"),
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  { color: step.id === 1 ? "#fff" : theme.subText },
                ]}
              >
                {step.id}
              </Text>
            </View>
            <Text
              style={[
                styles.stepText,
                { color: step.id === 1 ? theme.primary : theme.subText },
              ]}
            >
              {t(step.titleKey)}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View style={[styles.stepLine, { backgroundColor: isDarkMode ? "#374151" : "#E5E5E5" }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      

      {/* Header */}
      <ReportHeader navigation={navigation} title={t('report.createReport')} />

      <View
        style={{
          backgroundColor: isDarkMode ? "#312e16" : "#FFF3CD",
          borderLeftWidth: 4,
          borderLeftColor: "#FFC107",
          padding: 12,
          marginHorizontal: 15,
          marginTop: 10,
          marginBottom: 5,
          borderRadius: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-circle-outline" size={20} color={isDarkMode ? "#FFC107" : "#856404"} />
        <Text
          style={{
            marginLeft: 10,
            color: isDarkMode ? "#fef3c7" : "#856404",
            fontSize: 14,
            flex: 1,
          }}
        >
          {t('report.previewMode')}
        </Text>
      </View>

      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('report.reportViolation')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('report.schoolName')}
          </Text>
        </View>
        <View style={styles.warningIcon}>
          <Ionicons name="warning" size={24} color="#fff" />
        </View>
      </View>

      {/* Step Indicator */}
      <StepIndicator />

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.contentTitle, { color: theme.text }]}>{t('report.step1Title')}</Text>
        <Text style={[styles.contentSubtitle, { color: theme.subText }]}>
          {t('report.step1Desc')}
        </Text>

        {/* Violation Type Cards */}
        {VIOLATION_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.border },
              selectedType === type.id && [styles.selectedCard, { backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1", borderColor: theme.primary }],
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <View style={[styles.cardIcon, { backgroundColor: isDarkMode ? "#374151" : "#F3FDF1" }]}>
              <Ionicons name={type.icon} size={24} color={theme.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{t(type.titleKey)}</Text>
              <Text style={[styles.cardDescription, { color: theme.subText }]} numberOfLines={3}>
                {t(type.descKey)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: theme.primary, opacity: selectedType ? 1 : 0.5 }]}
        disabled={!selectedType}
        onPress={() => {
          navigation.navigate("Step2", {
            violationType: selectedType,
          });
        }}
      >
        <Text style={styles.continueButtonText}>{t('report.continue')}</Text>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
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
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
  },
  warningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "600",
  },
  stepText: {
    fontSize: 12,
    textAlign: "center",
  },
  stepLine: {
    height: 1,
    flex: 0.5,
    marginHorizontal: -10,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  contentSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  card: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  selectedCard: {
    borderWidth: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    padding: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
});
