import React, { useRef } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import BannerWatermark from "../../../components/BannerWatermark";
import {
  View,
  Text,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";
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

export default function Success({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const scrollY = useRef(new Animated.Value(0)).current;
  // iOS: presented via presentation:"modal" as a floating card that already
  // clears the notch/status bar - adding insets.top would double-count it.
  const headerHeight = Platform.OS === "ios" ? 68 : 64 + insets.top;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

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
      {/* Floating header - same pattern as the other report steps */}
      <FloatingScreenHeader topInset={Platform.OS === "ios" ? 0 : undefined} title={t("report.createReport")} onBack={() => navigation.goBack()} scrollY={scrollY} />

      <AndroidGlassBackdrop providerId="ReportSuccess" style={{ flex: 1 }}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        // flexGrow so the success card still fills the space left on screen.
        contentContainerStyle={{ flexGrow: 1, paddingTop: headerHeight + 16, paddingBottom: 16 }}
      >
        {/* Gradient info card */}
        <LinearGradient
          colors={
            isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientCard, { marginHorizontal: 16 }]}
        >
          <BannerWatermark icon="shield-checkmark" color="#FFFFFF" size={140} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gradientTitle}>
              {t("report.reportViolation")}
            </Text>
            <Text style={styles.gradientSubtitle}>{t("report.schoolName")}</Text>
          </View>
          <View style={styles.gradientIconWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
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
            <BannerWatermark icon="ribbon" size={150} />
            <View style={[styles.haloOuter, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <View style={[styles.haloInner, { backgroundColor: isDarkMode ? "rgba(34,197,94,0.28)" : "rgba(34,197,94,0.22)" }]}>
                <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
                  <Ionicons name="checkmark" size={44} color="#fff" />
                </View>
              </View>
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>
              {t("report.submitSuccess")}
            </Text>
            <Text style={[styles.successSubtitle, { color: theme.subText }]}>
              {t("report.schoolName")}
            </Text>
            <View style={styles.badgeRow}>
              {[["shield-checkmark", "#3B82F6"], ["school", "#8B5CF6"], ["heart", "#EC4899"]].map(([icon, color]) => (
                <View key={icon} style={[styles.badge, { backgroundColor: tint(color, isDarkMode) }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </Animated.ScrollView>
      </AndroidGlassBackdrop>

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
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
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
  stepText: { fontSize: 11, textAlign: "center", fontWeight: "500" },
  stepLine: { height: 2, flex: 0.5, marginHorizontal: -8, borderRadius: 1 },
  successCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  successGradient: {
    overflow: "hidden",
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
  },
  haloOuter: { width: 150, height: 150, borderRadius: 75, alignItems: "center", justifyContent: "center" },
  haloInner: { width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center" },
  badgeRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
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
    borderRadius: 999,
    gap: 8,
  },
  returnButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
