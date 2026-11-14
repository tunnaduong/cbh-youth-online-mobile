import React from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import BannerWatermark from "../../../components/BannerWatermark";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

import { SettingSection as Section } from "../../../components/settings/SettingsUI";

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const scrollY = React.useRef(new Animated.Value(0)).current;

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
      <FloatingScreenHeader title={t("about.title")} onBack={() => navigation.goBack()} scrollY={scrollY} />

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

      <AndroidGlassBackdrop providerId="AboutScreen" style={{ flex: 1 }}>
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
        {/* School hero card */}
        <LinearGradient
          colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
        >
          <BannerWatermark icon="school" color="#22C55E" size={130} />
          <View style={[styles.heroLogoWrap, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#FFFFFF" }]}>
            <Image
              source={require("../../../assets/school-logo-removebg.png")}
              style={styles.heroLogo}
            />
          </View>
          <Text style={[styles.schoolName, { color: isDarkMode ? "#F3F4F6" : "#0F2E1E" }]}>{t("about.schoolName")}</Text>
          <Text style={[styles.heroDesc, { color: isDarkMode ? "#9CA3AF" : "#4B6B58" }]}>{t("about.schoolDesc1")}</Text>
        </LinearGradient>

        <Text style={[styles.description, { color: theme.subText }]}>
          {t("about.schoolDesc2")}
        </Text>

        <Section icon="time-outline" color="#F59E0B" title={t("about.historyTitle")} theme={theme}>
          <View style={styles.sectionBody}>
            <Text style={[styles.sectionText, { color: theme.text }]}>
              {t("about.historyDesc")}
            </Text>
          </View>
        </Section>

        <Section icon="color-palette-outline" color="#EC4899" title={t("about.activitiesTitle")} theme={theme}>
          <View style={styles.sectionBody}>
            <Text style={[styles.sectionText, { color: theme.text }]}>
              {t("about.activitiesDesc")}
            </Text>
          </View>
        </Section>

        <Section icon="flag-outline" color="#3B82F6" title={t("about.goalsTitle")} theme={theme}>
          <View style={styles.sectionBody}>
            {["about.goals1", "about.goals2", "about.goals3"].map((key) => (
              <View key={key} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: "#3B82F6" }]} />
                <Text style={[styles.bulletPoint, { color: theme.text }]}>{t(key)}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* App hero card */}
        <LinearGradient
          colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7", marginTop: 8 }]}
        >
          <BannerWatermark icon="phone-portrait" color="#22C55E" size={130} style={{ top: 34 }} />
          <View style={[styles.heroLogoWrap, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "#FFFFFF" }]}>
            <Image
              source={require("../../../assets/logo.png")}
              style={[styles.heroLogo, { borderRadius: 14 }]}
            />
          </View>
          <Text style={[styles.schoolName, { color: isDarkMode ? "#F3F4F6" : "#0F2E1E" }]}>{t("about.appName")}</Text>
          <Text style={[styles.heroDesc, { color: isDarkMode ? "#9CA3AF" : "#4B6B58" }]}>{t("about.appDesc1")}</Text>
        </LinearGradient>

        <Text style={[styles.description, { color: theme.subText }]}>
          {t("about.appDesc2")}
        </Text>

        <Section icon="sparkles-outline" color="#8B5CF6" title={t("about.feature1Title")} theme={theme}>
          <View style={styles.sectionBody}>
            <Text style={[styles.sectionText, { color: theme.text }]}>
              {t("about.feature1Desc")}
            </Text>
          </View>
        </Section>

        <Section icon="chatbubbles-outline" color="#10B981" title={t("about.feature2Title")} theme={theme}>
          <View style={styles.sectionBody}>
            <Text style={[styles.sectionText, { color: theme.text }]}>
              {t("about.feature2Desc")}
            </Text>
          </View>
        </Section>

        <Section icon="rocket-outline" color="#F97316" title={t("about.feature3Title")} theme={theme}>
          <View style={styles.sectionBody}>
            <Text style={[styles.sectionText, { color: theme.text }]}>
              {t("about.feature3Desc")}
            </Text>
          </View>
        </Section>

        {/* Third-party credits: kept apart from the app's own content */}
        <View style={[styles.creditsDivider, { backgroundColor: isDarkMode ? "#282B34" : "#E2E8F0" }]} />
        <View style={styles.creditsBox}>
          <View style={styles.creditsHeader}>
            <Ionicons name="musical-notes-outline" size={13} color={theme.subText} style={{ marginRight: 5 }} />
            <Text style={[styles.creditsTitle, { color: theme.subText }]}>
              {t("about.soundLicenseTitle", "Bản quyền âm thanh")}
            </Text>
          </View>
          <Text style={[styles.creditsText, { color: theme.subText }]}>
            {t(
              "about.soundLicenseDesc",
              "Nhạc chuông cuộc gọi được trích xuất từ âm báo thức (Alarm Ringtone) của OPPO. Bản quyền âm thanh thuộc sở hữu của Guangdong OPPO Mobile Telecommunications Corp., Ltd. Được sử dụng cho mục đích cộng đồng phi thương mại."
            )}
          </Text>
        </View>

        <Text style={[styles.copyright, { color: theme.subText }]}>
          {t("about.copyright")}
        </Text>
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
  schoolInfo: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 16,
  },
  schoolLogo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 20,
  },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 8,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    overflow: "hidden",
  },
  heroCircle: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(34,197,94,0.10)",
    top: -50,
    right: -30,
  },
  heroLogoWrap: {
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  heroLogo: {
    width: 68,
    height: 68,
    resizeMode: "contain",
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  schoolName: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 22,
    textAlign: "center",
    marginHorizontal: 24,
  },
  sectionBody: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
    marginRight: 10,
  },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  settingSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 16,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bulletPoints: {
    marginTop: 4,
  },
  bulletPoint: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  creditsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 32,
    marginTop: 12,
    marginBottom: 16,
  },
  creditsBox: {
    marginHorizontal: 24,
  },
  creditsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  creditsTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  creditsText: {
    fontSize: 11,
    lineHeight: 16,
  },
  copyright: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingBottom: 16,
  },
});
