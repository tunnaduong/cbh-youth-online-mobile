import React, { useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import LiquidButton from "../../../components/LiquidButton";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";

const STEPS = [
  { id: 1, titleKey: "report.step1" },
  { id: 2, titleKey: "report.step2" },
  { id: 3, titleKey: "report.step3" },
];

function StepIndicator({ currentStep, theme, isDarkMode, t }) {
  return (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor:
                    step.id <= currentStep
                      ? theme.primary
                      : isDarkMode
                      ? "#374151"
                      : "#E5E5E5",
                },
              ]}
            >
              {step.id < currentStep ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.stepNumberText,
                    {
                      color:
                        step.id <= currentStep ? "#fff" : theme.subText,
                    },
                  ]}
                >
                  {step.id}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepText,
                {
                  color:
                    step.id <= currentStep ? theme.primary : theme.subText,
                },
              ]}
            >
              {t(step.titleKey)}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    step.id < currentStep
                      ? theme.primary
                      : isDarkMode
                      ? "#374151"
                      : "#E5E5E5",
                },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function InfoRow({ label, value, theme, isDarkMode, last }) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

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
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 64 + insets.top;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  if (!userInfo) return null;

  const infoRows = isClassViolation
    ? [
        { label: t("report.className"), value: studentName },
        { label: t("report.reportTime"), value: reportDate },
        { label: t("report.reporter"), value: userInfo.profile_name },
        { label: t("report.absent"), value: absences || "0" },
        { label: t("report.hygiene"), value: cleanliness },
        { label: t("report.uniform"), value: uniform },
        {
          label: t("report.violationType"),
          value: violationType || t("report.notSelected"),
        },
      ]
    : [
        { label: t("report.studentName"), value: studentName },
        { label: t("report.reportTime"), value: reportDate },
        { label: t("report.reporter"), value: userInfo.profile_name },
        {
          label: t("report.violationType"),
          value: violationType || t("report.notSelected"),
        },
      ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View
        pointerEvents="box-none"
        style={[styles.floatingHeader, { height: headerHeight }]}
      >
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 8,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton
              size={44}
              scrollY={scrollY}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: titleOpacity }]}
            numberOfLines={1}
          >
            {t("report.createReport")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingHorizontal: 16,
          paddingBottom: 100 + (insets.bottom || 0),
        }}
      >
        {/* Warning banner */}
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor: isDarkMode
                ? "rgba(255,193,7,0.18)"
                : "rgba(255,193,7,0.10)",
              borderLeftColor: "#FFC107",
            },
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={isDarkMode ? "#FFC107" : "#856404"}
          />
          <Text
            style={[
              styles.warningText,
              { color: isDarkMode ? "#fef3c7" : "#856404" },
            ]}
          >
            {t("report.confirmDiscard")}
          </Text>
        </View>

        {/* Gradient info card */}
        <LinearGradient
          colors={
            isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.gradientTitle}>
              {t("report.reportViolation")}
            </Text>
            <Text style={styles.gradientSubtitle}>{t("report.schoolName")}</Text>
          </View>
          <View style={styles.gradientIconWrap}>
            <Ionicons name="warning" size={28} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Step indicator */}
        <StepIndicator
          currentStep={3}
          theme={theme}
          isDarkMode={isDarkMode}
          t={t}
        />

        <Text style={[styles.contentTitle, { color: theme.text }]}>
          {t("report.step3Title")}
        </Text>
        <Text style={[styles.contentSubtitle, { color: theme.subText }]}>
          {t("report.step3Subtitle")}
        </Text>

        {/* Confirmation card */}
        <View
          style={[
            styles.confirmCard,
            {
              backgroundColor: isDarkMode
                ? "rgba(255,255,255,0.04)"
                : "#F8FAFC",
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.confirmCardHeader}>
            <Ionicons name="document-text-outline" size={18} color={theme.primary} />
            <Text style={[styles.confirmCardTitle, { color: theme.primary }]}>
              {isClassViolation
                ? t("report.classViolation")
                : t("report.studentViolation")}
            </Text>
          </View>

          {infoRows.map((row, index) => (
            <InfoRow
              key={row.label}
              label={row.label}
              value={row.value}
              theme={theme}
              isDarkMode={isDarkMode}
              last={index === infoRows.length - 1}
            />
          ))}
        </View>

        {/* Notes card */}
        <View
          style={[
            styles.notesCard,
            {
              backgroundColor: isDarkMode
                ? "rgba(255,255,255,0.04)"
                : "#F8FAFC",
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.confirmCardHeader}>
            <Ionicons name="create-outline" size={18} color={theme.primary} />
            <Text style={[styles.confirmCardTitle, { color: theme.primary }]}>
              {t("report.notes")}
            </Text>
          </View>
          <Text
            style={[
              styles.notesText,
              {
                color: notes ? theme.text : theme.subText,
                backgroundColor: isDarkMode
                  ? "rgba(255,255,255,0.06)"
                  : "#FFFFFF",
                borderColor: theme.border,
              },
            ]}
          >
            {notes || t("report.noNotes")}
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Submit button */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: 16 + (insets.bottom || 0),
            backgroundColor: theme.background,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: "Success" }] })
          }
        >
          <Text style={styles.submitButtonText}>{t("report.submit")}</Text>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  gradientCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    padding: 20,
    marginBottom: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  gradientTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  gradientSubtitle: { fontSize: 13, color: "#C7F5D7" },
  gradientIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepNumberText: { fontSize: 14, fontWeight: "700" },
  stepText: { fontSize: 11, textAlign: "center", fontWeight: "500" },
  stepLine: { height: 2, flex: 0.5, marginHorizontal: -8, borderRadius: 1 },
  contentTitle: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  contentSubtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  confirmCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  confirmCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  confirmCardTitle: { fontSize: 14, fontWeight: "700" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  infoLabel: { fontSize: 13, flex: 0.45 },
  infoValue: { fontSize: 14, fontWeight: "600", flex: 0.55, textAlign: "right" },
  notesCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 21,
    padding: 14,
    minHeight: 80,
    borderRadius: 10,
    margin: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 30,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
