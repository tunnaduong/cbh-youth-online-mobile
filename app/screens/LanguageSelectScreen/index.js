import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getLocales } from "expo-localization";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { changeLanguage } from "../../i18n";
import LiquidButton from "../../components/LiquidButton";
import AuthBackground from "../../components/AuthBackground";
import { AndroidGlassBackdrop } from "../../components/GlassModules";

// Every entry's `label` is the language's OWN name written in itself
// (native scripts users recognize on sight), never run through t() -
// this screen exists precisely because no language has been chosen yet,
// so translating these would just show them in whatever 'vi' fallback
// happens to be active.
const LANGUAGES = [
  { code: "vi", flag: "🇻🇳", label: "Tiếng Việt" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
];

// The rest of this screen's copy (title + continue button), one per
// language, shown live as soon as a language is tapped - instead of
// stacking every language's translation on screen at once ("Choose your
// language · Выберите язык" / "Tiếp tục · Continue"), which read as
// cluttered and only got more so as more languages were added.
const SCREEN_TEXT = {
  vi: { title: "Chọn ngôn ngữ", continueText: "Tiếp tục" },
  en: { title: "Choose your language", continueText: "Continue" },
  ru: { title: "Выберите язык", continueText: "Продолжить" },
};

// Best-effort guess from the device's own locale list, falling back to
// Vietnamese (the app's own fallbackLng) if none of the device's
// preferred languages are supported.
const guessInitialLanguage = () => {
  try {
    const deviceCodes = getLocales().map((l) => l.languageCode);
    const match = deviceCodes.find((code) => LANGUAGES.some((l) => l.code === code));
    return match || "vi";
  } catch (e) {
    return "vi";
  }
};

const LanguageSelectScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(guessInitialLanguage());
  const screenText = SCREEN_TEXT[selected] || SCREEN_TEXT.vi;

  const handleContinue = async () => {
    await changeLanguage(selected);
    navigation.replace("FirstLaunchSettings");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AuthBackground />
      <AndroidGlassBackdrop providerId="LanguageSelectScreen" style={{ flex: 1 }}>
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
                styles.globeBadge,
                { backgroundColor: theme.iconBackground },
              ]}
            >
              <Ionicons name="globe-outline" size={30} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {screenText.title}
            </Text>
          </View>

          {/* Language options card */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {LANGUAGES.map((lang, index) => {
              const isSelected = selected === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => setSelected(lang.code)}
                  activeOpacity={0.7}
                  style={[
                    styles.optionRow,
                    index < LANGUAGES.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {lang.label}
                  </Text>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    {isSelected && (
                      <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Spacer pushes the button to the bottom, matching the login
              screen's vertically-balanced layout */}
          <View style={{ flex: 1 }} />

          <LiquidButton
            providerId="LanguageSelectScreen"
            onPress={handleContinue}
            forceNoGlass
            backgroundColor={theme.primary}
            style={styles.continueButtonContent}
            containerStyle={{ width: "100%" }}
          >
            <Text style={styles.continueButtonText}>{screenText.continueText}</Text>
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
  globeBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    height: 64,
  },
  flag: {
    fontSize: 26,
    marginRight: 14,
  },
  optionLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
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

export default LanguageSelectScreen;
