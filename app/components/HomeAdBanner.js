import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import FastImage from "./FastImage";
import { useTheme } from "../contexts/ThemeContext";
import { getAds, isRequestCanceled, trackAd } from "../services/api/Api";
import {
  navigateToInAppRoute,
  openInAppBrowser,
  resolveInAppRoute,
} from "../utils/externalLink";

const PLACEMENT = "mobile-home-header";
const DEFAULT_ASPECT_RATIO = 1170 / 433;
const MIN_ASPECT_RATIO = 1.2;
const MAX_ASPECT_RATIO = 4.5;

const DEFAULT_AD = {
  id: null,
  source: require("../assets/seeli-home-banner.jpg"),
  link_url:
    "https://seeli.cam/?utm_source=cbh_youth_online&utm_campaign=seeli_ads&utm_medium=cyo_mobile_home_header",
  alt_text: "SEELI - See more. Live more.",
};

function pickCreative(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const topPriority = Math.max(...list.map((item) => item?.priority || 0));
  const best = list.filter((item) => (item?.priority || 0) === topPriority);
  return best[Math.floor(Math.random() * best.length)] || null;
}

/**
 * Header ad banner shown on HomeScreen right below the top bar.
 * Displays the bundled SEELI creative immediately and upgrades to any live
 * creative configured for the `mobile-home-header` placement on `/v1.0/ads`.
 */
const HomeAdBanner = React.memo(({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [remoteAd, setRemoteAd] = useState(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const trackedImpressionIdRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    getAds(PLACEMENT, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const payload = res?.data;
        const list = Array.isArray(payload) ? payload : payload?.data || [];
        const picked = pickCreative(list);
        if (picked?.image_url) {
          setRemoteFailed(false);
          setRemoteAd(picked);
          if (picked.id && trackedImpressionIdRef.current !== picked.id) {
            trackedImpressionIdRef.current = picked.id;
            trackAd(picked.id, "impression").catch(() => {});
          }
        }
      })
      .catch((error) => {
        if (isRequestCanceled(error)) return;
        // Keep the bundled creative when the ad endpoint is unavailable.
      });

    return () => {
      controller.abort();
    };
  }, []);

  const activeRemote = remoteAd && !remoteFailed ? remoteAd : null;
  const imageSource = activeRemote
    ? { uri: activeRemote.image_url }
    : DEFAULT_AD.source;
  const linkUrl = activeRemote ? activeRemote.link_url : DEFAULT_AD.link_url;
  const accessibilityLabel =
    activeRemote?.alt_text ||
    activeRemote?.name ||
    DEFAULT_AD.alt_text ||
    t("home.adBannerLabel");

  const handlePress = useCallback(() => {
    if (!linkUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (activeRemote?.id) {
      trackAd(activeRemote.id, "click").catch(() => {});
    }
    const inAppRoute = navigation ? resolveInAppRoute(linkUrl) : null;
    if (inAppRoute) {
      navigateToInAppRoute(navigation, inAppRoute);
      return;
    }
    openInAppBrowser(linkUrl, theme);
  }, [activeRemote?.id, linkUrl, navigation, theme]);

  const handleLoad = useCallback(
    (event) => {
      if (!activeRemote) return;
      const width = event?.source?.width;
      const height = event?.source?.height;
      if (width > 0 && height > 0) {
        const nextRatio = Math.min(
          MAX_ASPECT_RATIO,
          Math.max(MIN_ASPECT_RATIO, width / height)
        );
        setAspectRatio(nextRatio);
      }
    },
    [activeRemote]
  );

  const handleError = useCallback(() => {
    if (activeRemote) {
      setRemoteFailed(true);
      setAspectRatio(DEFAULT_ASPECT_RATIO);
    }
  }, [activeRemote]);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!linkUrl}
        onPress={handlePress}
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <FastImage
          source={imageSource}
          style={[styles.image, { aspectRatio }]}
          resizeMode="cover"
          shimmer={Boolean(activeRemote)}
          onLoad={handleLoad}
          onError={handleError}
        />
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{t("home.adBadge")}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 15,
    paddingTop: 4,
    paddingBottom: 6,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: "100%",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});

export default HomeAdBanner;
