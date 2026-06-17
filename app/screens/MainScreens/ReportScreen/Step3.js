import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import ReportHeader from "../../../components/ReportHeader";
import { useTheme } from "../../../contexts/ThemeContext";

import { useTranslation } from "react-i18next";

export default function Step3({ navigation, route }) {
  const {
    studentName,
    reportDate,
    violationType,
    notes,
    absences,
    cleanliness,
    uniform,
  } = route.params;
  const insets = useSafeAreaInsets();
  const isClassViolation = Boolean(cleanliness || uniform);
  const { userInfo } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();

  const { t } = useTranslation();

  const STEPS = [
    { id: 1, titleKey: "report.step1" },
    { id: 2, titleKey: "report.step2" },
    { id: 3, titleKey: "report.step3" },
  ];

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor: theme.primary,
                },
              ]}
            >
              <Text style={[styles.stepNumberText, { color: "#fff" }]}>
                {step.id}
              </Text>
            </View>
            <Text style={[styles.stepText, { color: theme.primary }]}>
              {t(step.titleKey)}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View style={[styles.stepLine, { backgroundColor: theme.primary }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const InfoItem = ({ label, value }) => (
    <View style={styles.infoItem}>
      <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );

  const renderStudentInfo = () => (
    <>
      <InfoItem label={t('report.studentName')} value={studentName} />
      <InfoItem label={t('report.reportTime')} value={reportDate} />
      <InfoItem label={t('report.reporter')} value={userInfo.profile_name} />
      <InfoItem label={t('report.violationType')} value={violationType || t('report.notSelected')} />
    </>
  );

  const renderClassInfo = () => (
    <>
      <InfoItem label={t('report.className')} value={studentName} />
      <InfoItem label={t('report.reportTime')} value={reportDate} />
      <InfoItem label={t('report.reporter')} value={userInfo.profile_name} />
      <InfoItem label={t('report.absent')} value={absences || "0"} />
      <InfoItem label={t('report.hygiene')} value={cleanliness} />
      <InfoItem label={t('report.uniform')} value={uniform} />
      <InfoItem label={t('report.violationType')} value={violationType || t('report.notSelected')} />
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

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
          {t('report.confirmDiscard')}
        </Text>
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: theme.background }]}>
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
          <Text style={[styles.contentTitle, { color: theme.text }]}>{t('report.step3Title')}</Text>
          <Text style={[styles.contentSubtitle, { color: theme.subText }]}>
            {t('report.step3Subtitle')}
          </Text>

          <View style={[styles.confirmationCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            {isClassViolation ? renderClassInfo() : renderStudentInfo()}
            <View style={styles.notesContainer}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>{t('report.notes')}</Text>
              <Text style={[styles.notesText, { color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#F5F5F5" }]}>
                {notes || t('report.noNotes')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: theme.primary }]}
        onPress={() => {
          // TODO: Implement submit logic
          navigation.reset({
            index: 0,
            routes: [{ name: "Success" }],
          });
        }}
      >
        <Text style={styles.submitButtonText}>{t('report.submit')}</Text>
        <Ionicons name="send" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
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
  confirmationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  notesContainer: {
    marginTop: 8,
  },
  notesText: {
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    minHeight: 100,
  },
  submitButton: {
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
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
});
