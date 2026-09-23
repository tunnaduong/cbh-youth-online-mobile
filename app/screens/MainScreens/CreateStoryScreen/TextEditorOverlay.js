import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Slider from "@react-native-community/slider";
import { useTranslation } from "react-i18next";
import {
  STORY_FONTS,
  STORY_TEXT_COLORS,
  TEXT_EFFECTS,
  getStoryFont,
} from "../../../components/StoryOverlays/storyOverlayModel";
import { textEffectStyle } from "../../../components/StoryOverlays/StoryOverlayLayer";

const ALIGNMENTS = ["center", "left", "right"];
const ALIGN_ICONS = { center: "text", left: "text-outline", right: "text-sharp" };

/**
 * Full-screen text composer, the same shape Instagram/Facebook use: type in
 * the middle, restyle from the bars around it, tap anywhere to commit.
 */
const TextEditorOverlay = ({ item, canvasWidth, onCancel, onDone }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(item?.text || "");
  const [color, setColor] = useState(item?.color || "#FFFFFF");
  const [font, setFont] = useState(item?.font || "classic");
  const [effect, setEffect] = useState(item?.effect || "shadow");
  const [align, setAlign] = useState(item?.align || "center");
  const [fontSize, setFontSize] = useState(item?.fontSize || Math.round(canvasWidth * 0.09));

  const fontStyle = getStoryFont(font).style;
  const hasBackground = effect === "background";

  const commit = () => {
    const trimmed = text.trim();

    if (!trimmed) {
      onCancel?.();
      return;
    }

    onDone?.({ text: trimmed, color, font, effect, align, fontSize });
  };

  const cycleEffect = () => {
    const index = TEXT_EFFECTS.indexOf(effect);
    setEffect(TEXT_EFFECTS[(index + 1) % TEXT_EFFECTS.length]);
  };

  const cycleAlign = () => {
    const index = ALIGNMENTS.indexOf(align);
    setAlign(ALIGNMENTS[(index + 1) % ALIGNMENTS.length]);
  };

  return (
    <View style={styles.container}>
      <Pressable style={StyleSheet.absoluteFill} onPress={commit} />

      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.topButton} onPress={cycleAlign}>
          <Ionicons name={ALIGN_ICONS[align]} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topButton} onPress={cycleEffect}>
          <Text style={styles.effectLabel}>{t(`story.textEffects.${effect}`)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.topButton, styles.doneButton]} onPress={commit}>
          <Text style={styles.doneLabel}>{t("story.done")}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          placeholder={t("story.textPlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.6)"
          style={[
            {
              width: canvasWidth * 0.86,
              color: hasBackground ? "#111111" : color,
              fontSize,
              lineHeight: fontSize * 1.25,
              textAlign: align,
            },
            fontStyle,
            textEffectStyle(effect, color),
            hasBackground && {
              backgroundColor: color,
              paddingHorizontal: fontSize * 0.35,
              paddingVertical: fontSize * 0.18,
              borderRadius: fontSize * 0.3,
            },
          ]}
        />
      </KeyboardAvoidingView>

      <View style={styles.sizeSliderWrapper} pointerEvents="box-none">
        <Slider
          style={styles.sizeSlider}
          minimumValue={canvasWidth * 0.04}
          maximumValue={canvasWidth * 0.2}
          value={fontSize}
          onValueChange={setFontSize}
          minimumTrackTintColor="#FFFFFF"
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbTintColor="#FFFFFF"
        />
      </View>

      <View style={styles.bottomBars} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fontRow}
          keyboardShouldPersistTaps="handled"
        >
          {STORY_FONTS.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setFont(option.id)}
              style={[styles.fontChip, font === option.id && styles.fontChipActive]}
            >
              <Text style={[styles.fontChipLabel, option.style, font === option.id && { color: "#111" }]}>
                {t(option.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorRow}
          keyboardShouldPersistTaps="handled"
        >
          {STORY_TEXT_COLORS.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setColor(option)}
              style={[
                styles.colorDot,
                { backgroundColor: option },
                color === option && styles.colorDotActive,
              ]}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 20000,
  },
  topBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  topButton: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButton: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  doneLabel: {
    color: "#111",
    fontWeight: "700",
  },
  effectLabel: {
    color: "#fff",
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeSliderWrapper: {
    position: "absolute",
    left: -70,
    top: "38%",
    width: 200,
    transform: [{ rotate: "-90deg" }],
  },
  sizeSlider: {
    width: 200,
    height: 40,
  },
  bottomBars: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    gap: 10,
  },
  fontRow: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: "center",
  },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  fontChipActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  fontChipLabel: {
    color: "#fff",
    fontSize: 14,
  },
  colorRow: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: "center",
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  colorDotActive: {
    borderColor: "#fff",
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
});

export default TextEditorOverlay;
