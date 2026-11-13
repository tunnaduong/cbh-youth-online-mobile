import React, { useRef } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import LiquidButton from "../../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";

// Floating-header scaffold shared by the score lookup screens (design system
// "Screen scaffold").
export function ScoreScreen({ navigation, title, children }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 8,
            paddingTop: insets.top,
            height: 64 + insets.top,
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton
              size={44}
              scrollY={scrollY}
              onPress={() => navigation.goBack()}
              accessibilityLabel={t("scoreLookup.back")}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "600",
              color: theme.primary,
              opacity: headerTitleOpacity,
            }}
          >
            {title}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingTop: 64 + insets.top,
            paddingBottom: insets.bottom + 24,
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {children}
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
}

export function useCardStyle() {
  const { theme } = useTheme();
  return {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  };
}

export function SectionTitle({ children }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: theme.subText,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled }) {
  const { theme } = useTheme();
  const off = busy || disabled;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      style={{
        backgroundColor: theme.primary,
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
        opacity: off ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// One "label ... value" line inside a result card.
export function ScoreRow({ label, value, hint, last, strong }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 16, color: theme.text }} numberOfLines={2}>
          {label}
        </Text>
        {hint ? (
          <Text style={{ fontSize: 13, color: theme.subText, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: strong ? 20 : 17,
          fontWeight: strong ? "800" : "700",
          color: strong ? theme.primary : theme.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export const showValue = (v) =>
  v === null || v === undefined || v === "" ? "—" : String(v);
