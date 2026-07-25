import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiquidButton from "../../../components/LiquidButton";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";

const STEPS = [
  { id: 1, titleKey: "report.step1" },
  { id: 2, titleKey: "report.step2" },
  { id: 3, titleKey: "report.step3" },
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

export default function ReportScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  // iOS: this screen is presented via presentation:"modal", which renders
  // as a floating card (not full-bleed like Android), so it already clears
  // the notch/status bar on its own — adding the full device insets.top
  // double-counts the offset.
  const headerHeight = Platform.OS === "ios" ? 68 : 64 + insets.top;

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View
        pointerEvents="box-none"
        style={[styles.floatingHeader, { height: headerHeight }]}
      >
        <View
          style={{
            paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8,
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
          paddingBottom: 16,
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
            {t("report.previewMode")}
          </Text>
        </View>

        {/* Gradient info card */}
        <LinearGradient
          colors={
            isDarkMode
              ? ["#173C2B", "#0F261D"]
              : ["#2BAA5C", "#1A874A"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.gradientTitle}>
              {t("report.reportViolation")}
            </Text>
            <Text style={styles.gradientSubtitle}>
              {t("report.schoolName")}
            </Text>
          </View>
          <View style={styles.gradientIconWrap}>
            <Ionicons name="warning" size={28} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Step indicator */}
        <StepIndicator
          currentStep={1}
          theme={theme}
          isDarkMode={isDarkMode}
          t={t}
        />

        <Text style={[styles.contentTitle, { color: theme.text }]}>
          {t("report.step1Title")}
        </Text>
        <Text style={[styles.contentSubtitle, { color: theme.subText }]}>
          {t("report.step1Desc")}
        </Text>

        {VIOLATION_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.card,
              {
                backgroundColor:
                  selectedType === type.id
                    ? isDarkMode
                      ? "#1a3d28"
                      : "#E8F8E5"
                    : isDarkMode
                    ? "rgba(255,255,255,0.04)"
                    : "#FFFFFF",
                borderColor:
                  selectedType === type.id ? theme.primary : theme.border,
                borderWidth: selectedType === type.id ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedType(type.id)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.cardIcon,
                {
                  backgroundColor: isDarkMode ? "#374151" : "#F3FDF1",
                },
              ]}
            >
              <Ionicons name={type.icon} size={24} color={theme.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {t(type.titleKey)}
              </Text>
              <Text
                style={[styles.cardDescription, { color: theme.subText }]}
                numberOfLines={3}
              >
                {t(type.descKey)}
              </Text>
            </View>
            {selectedType === type.id && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={theme.primary}
              />
            )}
          </TouchableOpacity>
        ))}

      </Animated.ScrollView>

      {/* Continue button — fixed at bottom */}
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
          style={[
            styles.continueButton,
            {
              backgroundColor: theme.primary,
              opacity: selectedType ? 1 : 0.5,
            },
          ]}
          disabled={!selectedType}
          onPress={() =>
            navigation.navigate("Step2", { violationType: selectedType })
          }
        >
          <Text style={styles.continueButtonText}>{t("report.continue")}</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cardDescription: { fontSize: 13, lineHeight: 19 },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  continueButton: {
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
  continueButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
