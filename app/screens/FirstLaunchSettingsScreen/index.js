import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import LiquidButton from "../../components/LiquidButton";
import AuthBackground from "../../components/AuthBackground";
import { AndroidGlassBackdrop } from "../../components/GlassModules";

// Shown once, right after LanguageSelectScreen, for a signed-out user who's
// never been through onboarding - lets them pick autoplay/liquid-glass up
// front (with a plain-language description of what each does, including the
// low-end-device tradeoff for liquid glass) instead of only discovering
// these exist buried in Settings later. Both already persist via
// useTheme()'s setAutoplayVideos/setLiquidGlassEnabled (MMKV), same as
// toggling them from Settings - nothing new to wire up for that.
const FirstLaunchSettingsScreen = ({ navigation }) => {
  const { theme, autoplayVideos, setAutoplayVideos, liquidGlassEnabled, setLiquidGlassEnabled } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    navigation.replace("Welcome");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AuthBackground />
      <AndroidGlassBackdrop providerId="FirstLaunchSettingsScreen" style={{ flex: 1 }}>
        <View
          style={[
            styles.content,
            { paddingTop: Math.max(insets.top + 60, 96), paddingBottom: insets.bottom + 32 },
          ]}
        >
          {/* Header */}
          <View style={styles.headerText}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.iconBackground },
              ]}
            >
              <Ionicons name="options-outline" size={30} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {t("firstLaunchSettings.title")}
            </Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>
              {t("firstLaunchSettings.subtitle")}
            </Text>
          </View>

          {/* Settings card */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={[styles.optionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
              <View style={styles.optionHeaderRow}>
                <View style={[styles.optionIcon, { backgroundColor: theme.iconBackground }]}>
                  <Ionicons name="play-circle-outline" size={20} color={theme.primary} />
                </View>
                <Text style={[styles.optionLabel, { color: theme.text }]}>
                  {t("settings.autoplayVideos")}
                </Text>
                <Switch
                  value={autoplayVideos}
                  onValueChange={setAutoplayVideos}
                  trackColor={{ true: theme.primary }}
                />
              </View>
              <Text style={[styles.optionDescription, { color: theme.subText }]}>
                {t("firstLaunchSettings.autoplayDescription")}
              </Text>
            </View>

            <View style={styles.optionRow}>
              <View style={styles.optionHeaderRow}>
                <View style={[styles.optionIcon, { backgroundColor: theme.iconBackground }]}>
                  <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
                </View>
                <Text style={[styles.optionLabel, { color: theme.text }]}>
                  {t("settings.liquidGlassEffect")}
                </Text>
                <Switch
                  value={liquidGlassEnabled}
                  onValueChange={setLiquidGlassEnabled}
                  trackColor={{ true: theme.primary }}
                />
              </View>
              <Text style={[styles.optionDescription, { color: theme.subText }]}>
                {t("firstLaunchSettings.liquidGlassDescription")}
              </Text>
            </View>
          </View>

          {/* Spacer pushes the button to the bottom, matching the login
              screen's vertically-balanced layout */}
          <View style={{ flex: 1 }} />

          <LiquidButton
            providerId="FirstLaunchSettingsScreen"
            onPress={handleContinue}
            forceNoGlass
            backgroundColor={theme.primary}
            style={styles.continueButtonContent}
            containerStyle={{ width: "100%" }}
          >
            <Text style={styles.continueButtonText}>{t("firstLaunchSettings.continue")}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </LiquidButton>
        </View>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerText: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  optionRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  optionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginLeft: 46,
  },
  continueButtonContent: {
    flexDirection: "row",
    height: 60,
    borderRadius: 38,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default FirstLaunchSettingsScreen;
