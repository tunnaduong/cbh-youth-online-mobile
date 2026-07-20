import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";

const Section = ({ title, children, theme }) => (
  <View style={styles.sectionWrapper}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  </View>
);

export default function TermsOfServiceScreen({ navigation }) {
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
            <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
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
            {t("terms.headerTitle")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

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
        <Text style={[styles.introText, { color: theme.text }]}>
          {t("terms.intro")}
        </Text>

        <Section title={t("terms.s1Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s1Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s1Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s2Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s2Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s2Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s2Text3")}
          </Text>
        </Section>

        <Section title={t("terms.s3Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s3Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s3Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s3Text3")}
          </Text>
        </Section>

        <Section title={t("terms.s4Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text3")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s4Text4")}
          </Text>
        </Section>

        <Section title={t("terms.s5Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s5Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s5Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s5Text3")}
          </Text>
        </Section>

        <Section title={t("terms.s6Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s6Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s6Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s7Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s7Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s7Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s8Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s8Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s8Text2")}
          </Text>
        </Section>

        <Section title={t("terms.s9Title")} theme={theme}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Text1")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Text2")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Email")}
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            {t("terms.s9Phone")}
          </Text>
        </Section>
      </Animated.ScrollView>
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
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 16,
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
    marginBottom: 8,
  },
});

