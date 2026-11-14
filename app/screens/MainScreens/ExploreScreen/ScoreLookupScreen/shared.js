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
import { LinearGradient } from "expo-linear-gradient";
import BannerWatermark from "../../../../components/BannerWatermark";
import { tint } from "../../../../components/settings/SettingsUI";

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
  const { theme, isDarkMode } = useTheme();
  return {
    backgroundColor: theme.surface,
    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
  };
}

// Green banner at the top of every score screen: icon holder, title, text and
// a faint illustration of the subject behind them.
export function Hero({ icon, title, text, watermark }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <LinearGradient
      colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDarkMode ? "#1B472C" : "#D5EBD7",
        padding: 16,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <BannerWatermark icon={watermark || icon} size={140} />
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: tint("#22C55E", isDarkMode),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={theme.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }} numberOfLines={2}>
          {title}
        </Text>
        {text ? (
          <Text style={{ fontSize: 13, lineHeight: 18, color: theme.subText, marginTop: 2 }}>{text}</Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

// Field label with a tinted round icon.
export function FieldLabel({ icon, color, children, style }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", marginBottom: 10 }, style]}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: tint(color, isDarkMode),
          alignItems: "center",
          justifyContent: "center",
          marginRight: 8,
        }}
      >
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, flex: 1 }}>{children}</Text>
    </View>
  );
}

export function useInputStyle() {
  const { theme, isDarkMode } = useTheme();
  return {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDarkMode ? "#3A3F4A" : "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.background,
  };
}

export function SectionTitle({ children, icon, color }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 4 }}>
      {icon ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: tint(color || "#22C55E", isDarkMode),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <Ionicons name={icon} size={14} color={color || "#22C55E"} />
        </View>
      ) : null}
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: theme.subText,
          flex: 1,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, icon = "search" }) {
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
        borderRadius: 999,
        padding: 14,
        alignItems: "center",
        opacity: off ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Colour of a 10-point score: green good, amber so-so, red weak.
export const scoreColor = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  if (Number.isNaN(n)) return null;
  return n >= 8 ? "#22C55E" : n >= 5 ? "#F59E0B" : "#EF4444";
};

// One "label ... value" line inside a result card. The value sits in a pill
// tinted by how good the score is.
export function ScoreRow({ label, value, hint, last, strong, icon, color }) {
  const { theme, isDarkMode } = useTheme();
  const accent = scoreColor(value) || theme.subText;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9",
      }}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: tint(color || "#3B82F6", isDarkMode),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={icon} size={18} color={color || "#3B82F6"} />
        </View>
      ) : null}
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }} numberOfLines={2}>
          {label}
        </Text>
        {hint ? (
          <Text style={{ fontSize: 12, color: theme.subText, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      <View
        style={{
          minWidth: 56,
          alignItems: "center",
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 5,
          backgroundColor: tint(accent === theme.subText ? "#64748B" : accent, isDarkMode),
        }}
      >
        <Text style={{ fontSize: strong ? 18 : 16, fontWeight: "800", color: accent }}>{value}</Text>
      </View>
    </View>
  );
}

export const showValue = (v) =>
  v === null || v === undefined || v === "" ? "—" : String(v);
