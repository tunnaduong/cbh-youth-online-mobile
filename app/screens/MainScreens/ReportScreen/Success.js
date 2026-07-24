import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";
import LiquidButton from "../../../components/LiquidButton";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";

const STEPS = [
  { id: 1, titleKey: "report.step1" },
  { id: 2, titleKey: "report.step2" },
  { id: 3, titleKey: "report.step3" },
];

export default function Success({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");

  const handleReturnHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainScreens" }],
      })
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            height: insets.top + 64,
          },
        ]}
      >
        <View style={{ width: 44 }}>
          <LiquidButton
            size={44}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
        </View>
        <Text
          style={[styles.headerTitle, { color: theme.primary }]}
          numberOfLines={1}
        >
          {t("report.createReport")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        {/* Gradient info card */}
        <LinearGradient
          colors={
            isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCard, { marginHorizontal: 16 }]}
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

        {/* All-completed step indicator */}
        <View style={[styles.stepContainer, { paddingHorizontal: 16 }]}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <View style={styles.stepItem}>
                <View
                  style={[styles.stepNumber, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
                <Text style={[styles.stepText, { color: theme.primary }]}>
                  {t(step.titleKey)}
                </Text>
              </View>
              {index < STEPS.length - 1 && (
                <View
                  style={[styles.stepLine, { backgroundColor: theme.primary }]}
                />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Success content */}
        <View style={[styles.successCard, { marginHorizontal: 16 }]}>
          <LinearGradient
            colors={
              isDarkMode ? ["#0F261D", "#173C2B"] : ["#F0FDF4", "#DCFCE7"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successGradient}
          >
            <View
              style={[
                styles.checkCircle,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons name="checkmark" size={44} color="#fff" />
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>
              {t("report.submitSuccess")}
            </Text>
            <Text style={[styles.successSubtitle, { color: theme.subText }]}>
              {t("report.schoolName")}
            </Text>
          </LinearGradient>
        </View>
      </View>

      {/* Return button */}
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
          style={[styles.returnButton, { backgroundColor: theme.primary }]}
          onPress={handleReturnHome}
        >
          <Ionicons name="home-outline" size={20} color="#fff" />
          <Text style={styles.returnButtonText}>{t("report.backToHome")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  body: { flex: 1, paddingTop: 16 },
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
  stepText: { fontSize: 11, textAlign: "center", fontWeight: "500" },
  stepLine: { height: 2, flex: 0.5, marginHorizontal: -8, borderRadius: 1 },
  successCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  successGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  successSubtitle: { fontSize: 14, textAlign: "center" },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  returnButton: {
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
  returnButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
