import React from "react";
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
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

const Section = ({ title, children, theme }) => (
  <View style={[styles.sectionWrapper]}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  </View>
);

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const scrollY = React.useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle(isDarkMode ? "light-content" : "dark-content", true);
      if (StatusBar.setBackgroundColor) StatusBar.setBackgroundColor(theme.background, true);
    }, [isDarkMode, theme.background])
  );

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
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.background,
            opacity: headerBgOpacity,
          }}
        />
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 64 + insets.top }}>
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} providerId="AboutScreen" onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, {
              color: theme.primary,
              flex: 1,
              textAlign: 'center',
              opacity: headerTitleOpacity,
            }]}
            numberOfLines={1}
          >
            {t("about.title")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

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
        {/* School Info */}
        <View style={styles.schoolInfo}>
          <Image
            source={require("../../../assets/school-logo-removebg.png")}
            style={[styles.schoolLogo, { resizeMode: 'contain', borderRadius: 0, backgroundColor: 'transparent' }]}
          />
          <Text style={[styles.schoolName, { color: theme.primary }]}>{t("about.schoolName")}</Text>
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.schoolDesc1")}
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.schoolDesc2")}
        </Text>

        <Section title={t("about.historyTitle")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("about.historyDesc")}
          </Text>
        </Section>

        <Section title={t("about.activitiesTitle")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("about.activitiesDesc")}
          </Text>
        </Section>

        <Section title={t("about.goalsTitle")} theme={theme}>
          <View style={styles.bulletPoints}>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • {t("about.goals1")}
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • {t("about.goals2")}
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • {t("about.goals3")}
            </Text>
          </View>
        </Section>

        {/* School Info */}
        <View style={[styles.schoolInfo, { marginTop: 40 }]}>
          <Image
            source={require("../../../assets/logo.png")}
            style={[styles.schoolLogo, { resizeMode: 'contain' }]}
          />
          <Text style={[styles.schoolName, { color: theme.primary }]}>{t("about.appName")}</Text>
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.appDesc1")}
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>
          {t("about.appDesc2")}
        </Text>

        <Section title={t("about.feature1Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("about.feature1Desc")}
          </Text>
        </Section>

        <Section title={t("about.feature2Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("about.feature2Desc")}
          </Text>
        </Section>

        <Section title={t("about.feature3Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("about.feature3Desc")}
          </Text>
        </Section>

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
  schoolName: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "justify",
    marginHorizontal: 16,
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
    fontSize: 14,
    lineHeight: 24,
  },
  copyright: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingBottom: 16,
  },
});
