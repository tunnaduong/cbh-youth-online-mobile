import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import {
  describeUpload,
  dismissUpload,
  retryUpload,
  subscribeUploads,
} from "../services/uploadQueue";

/**
 * Floating bar for uploads running in the background (services/uploadQueue):
 * what is being posted, the current step (compressing, uploading…) with a
 * progress line, then the result. A failed post/story keeps the bar up with
 * a retry button. Mounted once, above the navigator.
 */
export default function UploadStatusBar() {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  // Re-render when the language changes; the wording comes from describeUpload.
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeUploads(setJobs), []);

  const visible = jobs.filter((job) => !job.cancelled);
  // The newest one is the one the user just started.
  const job = visible[visible.length - 1];
  const others = visible.length - 1;
  const shown = !!job;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: shown ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [shown, appear]);

  if (!job) return null;

  const { title, body } = describeUpload(job);
  const running = job.status === "running";
  const failed = job.status === "failed";
  const accent = failed ? "#e5484d" : theme.primary;
  const hasProgress = running && typeof job.progress === "number";

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 6,
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowOpacity: isDarkMode ? 0.5 : 0.15,
          },
        ]}
      >
        <View style={styles.row}>
          {running ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Ionicons name={failed ? "alert-circle" : "checkmark-circle"} size={22} color={accent} />
          )}

          <View style={styles.texts}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
              {title}
              {others > 0 ? `  +${others}` : ""}
            </Text>
            {!!body && (
              <Text numberOfLines={2} style={[styles.body, { color: failed ? accent : theme.subText }]}>
                {body}
              </Text>
            )}
          </View>

          {failed && job.canRetry && (
            <TouchableOpacity
              onPress={() => retryUpload(job.id)}
              hitSlop={8}
              style={[styles.retry, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.retryText}>{t("uploads.retry")}</Text>
            </TouchableOpacity>
          )}
          {!running && (
            <TouchableOpacity
              onPress={() => dismissUpload(job.id)}
              hitSlop={10}
              accessibilityLabel={t("uploads.dismiss")}
            >
              <Ionicons name="close" size={20} color={theme.subText} />
            </TouchableOpacity>
          )}
        </View>

        {running && (
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            {hasProgress ? (
              <View style={[styles.fill, { backgroundColor: accent, width: `${Math.round(job.progress * 100)}%` }]} />
            ) : (
              <IndeterminateFill color={accent} />
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// A step with no percentage (preparing, finishing): a sliding segment, so
// the bar still shows that something is happening.
function IndeterminateFill({ color }) {
  const slide = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(slide, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: "35%",
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.35, width] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600" },
  body: { fontSize: 12, marginTop: 2 },
  retry: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  track: { height: 3, overflow: "hidden" },
  fill: { height: 3 },
});
