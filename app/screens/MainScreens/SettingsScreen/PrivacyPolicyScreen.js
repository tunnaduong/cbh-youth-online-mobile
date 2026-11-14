import React, { useRef } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import BannerWatermark from "../../../components/BannerWatermark";
import { tint } from "../../../components/settings/SettingsUI";

// One icon + accent per numbered section, in reading order.
const SECTION_LOOK = [
  ["document-text", "#3B82F6"],
  ["analytics", "#8B5CF6"],
  ["share-social", "#F59E0B"],
  ["lock-closed", "#10B981"],
  ["person", "#14B8A6"],
  ["time", "#6366F1"],
  ["shield-checkmark", "#F97316"],
  ["refresh", "#EC4899"],
  ["mail", "#EF4444"],
];

const Section = ({ title, children, theme, n }) => {
  const { isDarkMode } = useTheme();
  const [icon, color] = SECTION_LOOK[(n - 1) % SECTION_LOOK.length];
  return (
    <View style={styles.sectionWrapper}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: tint(color, isDarkMode) }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        <View style={[styles.sectionNumber, { backgroundColor: tint(color, isDarkMode) }]}>
          <Text style={{ fontSize: 12, fontWeight: "800", color }}>{n}</Text>
        </View>
      </View>
      <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}>
        {children}
      </View>
    </View>
  );
};

export default function PrivacyPolicyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 10, 60],
    outputRange: [0, 0, 0],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Floating header */}
      <FloatingScreenHeader title={t("privacy.headerTitle")} onBack={() => navigation.goBack()} scrollY={scrollY} />

      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
        pointerEvents="none"
      />

      <AndroidGlassBackdrop providerId="PrivacyPolicyScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 16 }}
      >
        <LinearGradient
          colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
        >
          <BannerWatermark icon="lock-closed" size={140} />
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <Ionicons name="shield-checkmark" size={26} color={theme.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={2}>
              {t("privacy.headerTitle")}
            </Text>
          </View>
          <Text style={[styles.introText, { color: theme.subText }]}>{t("privacy.intro")}</Text>
        </LinearGradient>

        <Section n={1} title={t("privacy.s1Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text4")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s1Text5")}
          </Text>
        </Section>

        <Section n={2} title={t("privacy.s2Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text4")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text5")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s2Text6")}
          </Text>
        </Section>

        <Section n={3} title={t("privacy.s3Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s3Text4")}
          </Text>
        </Section>

        <Section n={4} title={t("privacy.s4Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s4Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s4Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s4Text3")}
          </Text>
        </Section>

        <Section n={5} title={t("privacy.s5Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s5Text4")}
          </Text>
        </Section>

        <Section n={6} title={t("privacy.s6Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s6Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s6Text2")}
          </Text>
        </Section>

        <Section n={7} title={t("privacy.s7Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s7Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s7Text2")}
          </Text>
        </Section>

        <Section n={8} title={t("privacy.s8Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s8Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s8Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s8Text3")}
          </Text>
        </Section>

        <Section n={9} title={t("privacy.s9Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Email")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("privacy.s9Phone")}
          </Text>
        </Section>
      </Animated.ScrollView>
      </AndroidGlassBackdrop>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  hero: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginRight: 14 },
  heroTitle: { flex: 1, fontSize: 20, fontWeight: "800" },
  introText: {
    fontSize: 14,
    lineHeight: 21,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 2 },
  sectionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginRight: 10 },
  sectionNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  settingSection: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 16,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
});

