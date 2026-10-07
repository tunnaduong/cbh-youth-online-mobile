import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import ThemeSheet from "./ThemeSheet";

const PRESETS = [
  "#319527", "#22d3ee", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#14b8a6", "#64748b",
];

const HUE_STOPS = ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function hexToHsv(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

export function hsvToHex({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return (
    "#" +
    [f(5), f(3), f(1)]
      .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** A drag area reporting the touch position as 0-1 fractions of its size. */
function useDrag(onMove) {
  const size = useRef({ width: 1, height: 1 });
  const handler = useRef(onMove);
  handler.current = onMove;

  const responder = useMemo(() => {
    const report = (e) => {
      const { locationX, locationY } = e.nativeEvent;
      handler.current(
        clamp(locationX / size.current.width, 0, 1),
        clamp(locationY / size.current.height, 0, 1)
      );
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: report,
      onPanResponderMove: report,
    });
  }, []);

  const onLayout = (e) => {
    size.current = e.nativeEvent.layout;
  };

  return { ...responder.panHandlers, onLayout };
}

/**
 * Bảng chọn màu: ô bão hoà/độ sáng, thanh sắc độ, màu gợi ý và ô nhập mã hex.
 * Không có độ trong suốt (giống `disabledAlpha` bên web).
 */
export default function ColorPicker({ value, onChange }) {
  const { theme, isDarkMode } = useTheme();
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);
  const lastEmitted = useRef(value);

  // Follow outside changes (e.g. a preset picked elsewhere) without fighting
  // the drag: a value we emitted ourselves doesn't reset the hue.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setHsv(hexToHsv(value));
      lastEmitted.current = value;
    }
    setHexText(value);
  }, [value]);

  const emit = (next) => {
    setHsv(next);
    const hex = hsvToHex(next);
    lastEmitted.current = hex;
    setHexText(hex);
    onChange(hex);
  };

  const squareDrag = useDrag((x, y) => emit({ ...hsv, s: x, v: 1 - y }));
  const hueDrag = useDrag((x) => emit({ ...hsv, h: Math.min(x * 360, 359.9) }));
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <View>
      <View style={[styles.square, { backgroundColor: hueColor }]} {...squareDrag}>
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={["#ffffff", "#ffffff00"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={["#00000000", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              backgroundColor: value,
            },
          ]}
        />
      </View>

      <View style={styles.hueBar} {...hueDrag}>
        <LinearGradient
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          colors={HUE_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <View
          pointerEvents="none"
          style={[styles.thumb, styles.hueThumb, { left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }]}
        />
      </View>

      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset}
            onPress={() => emit(hexToHsv(preset))}
            style={[
              styles.preset,
              { backgroundColor: preset, borderColor: preset === value ? theme.text : "transparent" },
            ]}
          />
        ))}
      </View>

      <View style={styles.hexRow}>
        <View style={[styles.swatch, { backgroundColor: value, borderColor: theme.border }]} />
        <TextInput
          value={hexText}
          onChangeText={(text) => {
            const next = text.startsWith("#") ? text : `#${text}`;
            setHexText(next);
            if (/^#[0-9a-f]{6}$/i.test(next)) emit(hexToHsv(next.toLowerCase()));
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          style={[
            styles.hexInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: isDarkMode ? "#2c2c2e" : "#f9fafb" },
          ]}
        />
      </View>
    </View>
  );
}

/** ColorPicker trong một bottom sheet có nút Huỷ / Áp dụng. */
export function ColorPickerSheet({ visible, title, value, onApply, onClose }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <ThemeSheet
      visible={visible}
      title={title}
      scroll={false}
      onClose={onClose}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <ColorPicker value={draft} onChange={setDraft} />
    </ThemeSheet>
  );
}

/** Ô màu bấm vào để mở ColorPickerSheet; nét đứt khi chưa chọn màu. */
export function ColorSwatchButton({ color, fallback, label, onPress, style }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.swatchButton,
        color
          ? { backgroundColor: color, borderColor: theme.border, borderStyle: "solid" }
          : { backgroundColor: fallback, borderColor: theme.subText, borderStyle: "dashed", opacity: 0.4 },
        style,
      ]}
    >
      {!color ? <Text style={styles.swatchHint}>{t("profileTheme.notSet", "Chưa chọn")}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  square: { height: 180, borderRadius: 12, overflow: "hidden" },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  hueBar: { height: 16, borderRadius: 999, marginTop: 18, marginHorizontal: 4 },
  hueThumb: { top: "50%" },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18, justifyContent: "center" },
  preset: { width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  hexRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  swatch: { width: 40, height: 40, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  hexInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  swatchButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchHint: { fontSize: 11, color: "#fff", fontWeight: "600" },
});
