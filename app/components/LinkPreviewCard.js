import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "./FastImage";
import { useTheme } from "../contexts/ThemeContext";
import { fetchLinkPreview, getCachedLinkPreview } from "../utils/linkPreview";
import { openExternalLink } from "../utils/externalLink";

/**
 * Facebook-style card for a link pasted into a post or chat message: the
 * page's Open Graph image, site, title and description. Posts and profiles on
 * chuyenbienhoa.com open their in-app screen; anything else goes through the
 * link-safety screen (see openExternalLink). Renders nothing until the preview
 * has loaded, and nothing at all when the page has no usable metadata.
 *
 * @param {object} props
 * @param {string} props.url
 * @param {boolean} [props.compact] - fixed width + smaller image, for chat bubbles
 * @param {object} [props.style]
 */
const LinkPreviewCard = ({ url, compact = false, style }) => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [preview, setPreview] = useState(() => getCachedLinkPreview(url));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImageFailed(false);
    const cached = getCachedLinkPreview(url);
    setPreview(cached);
    if (cached === undefined && url) {
      fetchLinkPreview(url).then((result) => {
        if (!cancelled) setPreview(result);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!preview) return null;

  const handlePress = () => openExternalLink(navigation, url, theme);
  const cardColors = {
    backgroundColor: isDarkMode ? "#1E1E1E" : "#F3F4F6",
    borderColor: theme.border,
  };

  if (preview.kind === "profile") {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          styles.profileCard,
          cardColors,
          compact && styles.compact,
          pressed && styles.pressed,
          style,
        ]}
      >
        {preview.avatar ? (
          <FastImage source={{ uri: preview.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.iconFallback, { backgroundColor: theme.border }]}>
            <Ionicons name="person" size={22} color={theme.subText} />
          </View>
        )}
        <View style={styles.profileBody}>
          <View style={styles.nameRow}>
            <Text style={[styles.title, styles.shrink, { color: theme.text }]} numberOfLines={1}>
              {preview.title}
            </Text>
            {preview.verified ? (
              <Ionicons name="checkmark-circle" size={14} color="#3b82f6" style={styles.verified} />
            ) : null}
          </View>
          <Text style={[styles.site, { color: theme.subText }]} numberOfLines={1}>
            @{preview.username} · {preview.siteName}
          </Text>
          {preview.description ? (
            <Text style={[styles.description, { color: theme.subText }]} numberOfLines={2}>
              {preview.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const showImage = Boolean(preview.image) && !imageFailed;
  const siteLabel =
    preview.kind === "post" && preview.authorName
      ? `${preview.siteName} · ${preview.authorName}`
      : preview.siteName;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        cardColors,
        compact && styles.compact,
        pressed && styles.pressed,
        style,
      ]}
    >
      {showImage ? (
        <FastImage
          source={{ uri: preview.image }}
          style={[styles.image, compact && styles.imageCompact, { backgroundColor: theme.border }]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View style={[styles.body, !showImage && styles.bodyRow]}>
        {!showImage ? (
          <View style={[styles.iconBox, styles.iconFallback, { backgroundColor: theme.border }]}>
            {preview.icon ? (
              <FastImage source={{ uri: preview.icon }} style={styles.icon} />
            ) : (
              <Ionicons name="link" size={20} color={theme.subText} />
            )}
          </View>
        ) : null}
        <View style={styles.shrink}>
          <Text style={[styles.site, { color: theme.subText }]} numberOfLines={1}>
            {String(siteLabel || "").toUpperCase()}
          </Text>
          {preview.title ? (
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {preview.title}
            </Text>
          ) : null}
          {preview.description ? (
            <Text style={[styles.description, { color: theme.subText }]} numberOfLines={2}>
              {preview.description}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  compact: { width: 240 },
  pressed: { opacity: 0.8 },
  image: { width: "100%", aspectRatio: 1.91 },
  imageCompact: { aspectRatio: undefined, height: 126 },
  body: { paddingHorizontal: 12, paddingVertical: 10 },
  bodyRow: { flexDirection: "row", alignItems: "center" },
  shrink: { flexShrink: 1, flexGrow: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  icon: { width: 24, height: 24 },
  iconFallback: { alignItems: "center", justifyContent: "center" },
  site: { fontSize: 12, marginBottom: 2 },
  title: { fontSize: 15, fontWeight: "600" },
  description: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  profileBody: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  verified: { marginLeft: 4 },
});

export default LinkPreviewCard;
