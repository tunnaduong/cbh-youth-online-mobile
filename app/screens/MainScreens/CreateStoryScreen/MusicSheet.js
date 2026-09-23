import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Slider from "@react-native-community/slider";
import Video from "react-native-video";
import { useTranslation } from "react-i18next";
import EditorSheet from "./EditorSheet";
import { searchMusicTracks, STORY_MUSIC_CLIP_MS } from "../../../services/musicSearch";

/**
 * Music picker: search a track, hear the preview, pick the 15 seconds that
 * play with the story.
 */
const MusicSheet = ({ visible, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [startMs, setStartMs] = useState(0);
  const previewRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setTerm("");
      setResults([]);
      setSelected(null);
      setStartMs(0);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    const query = term.trim();

    if (!visible || query.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const tracks = await searchMusicTracks(query);
        if (!cancelled) setResults(tracks);
      } catch (searchError) {
        if (!cancelled) {
          setResults([]);
          setError(t("story.musicSearchError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, visible, t]);

  const previewLengthMs = selected?.durationMs
    ? Math.min(selected.durationMs, 30000)
    : 30000;
  const maxStartMs = Math.max(0, previewLengthMs - STORY_MUSIC_CLIP_MS);

  const handleConfirm = () => {
    if (!selected) return;

    onSelect({
      ...selected,
      startMs: Math.round(startMs),
      durationMs: STORY_MUSIC_CLIP_MS,
    });
  };

  return (
    <EditorSheet visible={visible} title={t("story.musicTitle")} onClose={onClose} heightRatio={0.7}>
      {selected ? (
        <View style={styles.trimBody}>
          <View style={styles.selectedRow}>
            {!!selected.artworkUrl && (
              <Image source={{ uri: selected.artworkUrl }} style={styles.artworkLarge} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {selected.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {selected.artist}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.changeButton}>
              <Text style={styles.changeLabel}>{t("story.musicChange")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.trimHint}>
            {t("story.musicTrimHint", {
              start: Math.round(startMs / 1000),
              length: STORY_MUSIC_CLIP_MS / 1000,
            })}
          </Text>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={maxStartMs}
            value={startMs}
            onValueChange={setStartMs}
            onSlidingComplete={(value) => {
              previewRef.current?.seek?.(value / 1000);
            }}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#fff"
          />

          <TouchableOpacity style={styles.submit} onPress={handleConfirm}>
            <Text style={styles.submitLabel}>{t("story.addSticker")}</Text>
          </TouchableOpacity>

          <Video
            ref={previewRef}
            source={{ uri: selected.previewUrl }}
            paused={false}
            repeat
            ignoreSilentSwitch="ignore"
            onLoad={() => previewRef.current?.seek?.(startMs / 1000)}
            style={styles.hiddenPlayer}
          />
        </View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder={t("story.musicPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.45)"
              autoCorrect={false}
              autoFocus
              style={styles.searchInput}
            />
            {loading && <ActivityIndicator color="#fff" size="small" />}
          </View>

          <FlatList
            data={results}
            style={{ flex: 1 }}
            keyExtractor={(item) => String(item.trackId)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>
                  {error || (term.trim().length >= 2 ? t("story.musicNoResults") : t("story.musicHint"))}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setSelected(item);
                  setStartMs(0);
                }}
              >
                {item.artworkUrl ? (
                  <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
                ) : (
                  <View style={[styles.artwork, styles.artworkFallback]}>
                    <Ionicons name="musical-notes" size={18} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </EditorSheet>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    // Padding rather than a fixed row height: a TextInput sized by its
    // parent renders its text against the bottom edge on iOS.
    paddingVertical: 12,
    margin: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  artwork: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  artworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  artworkLarge: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  title: {
    color: "#fff",
    fontWeight: "600",
  },
  artist: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  empty: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 24,
  },
  trimBody: {
    paddingHorizontal: 16,
    gap: 12,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  changeLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  trimHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  submit: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  submitLabel: {
    color: "#111",
    fontWeight: "700",
    fontSize: 15,
  },
  hiddenPlayer: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default MusicSheet;
