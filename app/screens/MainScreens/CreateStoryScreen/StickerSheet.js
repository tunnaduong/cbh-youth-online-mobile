import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import EditorSheet from "./EditorSheet";
import { STICKER_PACKS } from "../../../components/StoryOverlays/storyOverlayModel";

/**
 * Sticker tray: the interactive stickers (mention, link, music) on top, the
 * emoji packs below - the same layout Instagram uses.
 */
const StickerSheet = ({
  visible,
  onClose,
  onPickEmoji,
  onRequestMention,
  onRequestLink,
  onRequestMusic,
}) => {
  const { t } = useTranslation();
  const [activePack, setActivePack] = useState(STICKER_PACKS[0].id);

  const pack = STICKER_PACKS.find((item) => item.id === activePack) || STICKER_PACKS[0];

  const actions = [
    { id: "mention", icon: "at", label: t("story.mention"), onPress: onRequestMention },
    { id: "link", icon: "link", label: t("story.link"), onPress: onRequestLink },
    { id: "music", icon: "musical-notes", label: t("story.music"), onPress: onRequestMusic },
  ];

  return (
    <EditorSheet visible={visible} title={t("story.stickers")} onClose={onClose} heightRatio={0.66}>
      <View style={styles.actionRow}>
        {actions.map((action) => (
          <TouchableOpacity key={action.id} style={styles.actionButton} onPress={action.onPress}>
            <Ionicons name={action.icon} size={22} color="#fff" />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.packRow}
      >
        {STICKER_PACKS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setActivePack(item.id)}
            style={[styles.packChip, activePack === item.id && styles.packChipActive]}
          >
            <Text style={[styles.packLabel, activePack === item.id && styles.packLabelActive]}>
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {pack.stickers.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.emojiCell}
            onPress={() => onPickEmoji(emoji)}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </EditorSheet>
  );
};

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  actionLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  packRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 6,
    alignItems: "center",
  },
  packChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  packChipActive: {
    backgroundColor: "#fff",
  },
  packLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
  },
  packLabelActive: {
    color: "#111",
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
  },
  emojiCell: {
    width: "16.66%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 30,
  },
});

export default StickerSheet;
