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
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import { tint } from "../../../components/settings/SettingsUI";

const STEPS = [
  { id: 1, titleKey: "report.step1" },
  { id: 2, titleKey: "report.step2" },
  { id: 3, titleKey: "report.step3" },
];

const VIOLATION_TYPES = [
  {
    id: "student",
    icon: "person",
    accent: "#3B82F6",
    titleKey: "report.studentViolation",
    descKey: "report.studentViolationDesc",
  },
  {
    id: "class",
    icon: "people",
    accent: "#8B5CF6",
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
                    step.id <= currentStep ? theme.primary : theme.iconBackground,
                },
                step.id === currentStep && {
                  borderWidth: 4,
                  borderColor: tint("#22C55E", isDarkMode),
                  width: 38,
                  height: 38,
                  borderRadius: 19,
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
                  color: step.id <= currentStep ? theme.text : theme.subText,
                  fontWeight: step.id === currentStep ? "700" : "500",
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
                    step.id < currentStep ? theme.primary : theme.iconBackground,
                },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function ReportScreen({ navigation, route }) {
  const initialType = route?.params?.type;
  const [selectedType, setSelectedType] = useState(
    VIOLATION_TYPES.some((type) => type.id === initialType) ? initialType : null
  );
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
      {/* Top ambient green glow */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 140,
          zIndex: 0,
        }}
        pointerEvents="none"
      />
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
              providerId="ReportStep1"
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

      <AndroidGlassBackdrop providerId="ReportStep1" style={{ flex: 1 }}>
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
              backgroundColor: tint("#F59E0B", isDarkMode),
              borderColor: isDarkMode ? "rgba(245,158,11,0.35)" : "rgba(245,158,11,0.3)",
            },
          ]}
        >
          <Ionicons
            name="alert-circle"
            size={20}
            color={isDarkMode ? "#FBBF24" : "#B45309"}
          />
          <Text
            style={[
              styles.warningText,
              { color: isDarkMode ? "#FDE68A" : "#92400E" },
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
                  selectedType === type.id ? tint(type.accent, isDarkMode) : theme.surface,
                borderColor:
                  selectedType === type.id ? type.accent : isDarkMode ? "#282B34" : "#E2E8F0",
                borderWidth: selectedType === type.id ? 1.5 : StyleSheet.hairlineWidth,
                // Android's `elevation` shadow is always rendered dark/black,
                // ignoring shadowColor. Against a dark theme background
                // that shadow shows through as a stray black smudge around
                // the card, since there's little contrast to mask it (unlike
                // light mode, where a dark shadow on a light background
                // looks like a normal drop shadow). The border already
                // gives the card definition, so just drop the shadow in
                // dark mode instead.
                              },
            ]}
            onPress={() => setSelectedType(type.id)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.cardIcon,
                {
                  backgroundColor: tint(type.accent, isDarkMode),
                },
              ]}
            >
              <Ionicons name={type.icon} size={24} color={type.accent} />
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
                size={24}
                color={type.accent}
              />
            )}
          </TouchableOpacity>
        ))}

      </Animated.ScrollView>
      </AndroidGlassBackdrop>

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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  gradientCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    padding: 22,
    marginBottom: 6,
    overflow: "hidden",
  },
  gradientTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  gradientSubtitle: { fontSize: 13, color: "#C7F5D7" },
  gradientIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.2)",
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    borderRadius: 999,
    gap: 8,
  },
  continueButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
