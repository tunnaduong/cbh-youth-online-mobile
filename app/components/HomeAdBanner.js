import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import FastImage from "./FastImage";
import { useTheme } from "../contexts/ThemeContext";
import { CONTENT_MAX_WIDTH } from "../utils/responsive";
import { getAds, isRequestCanceled, trackAd } from "../services/api/Api";
import {
  navigateToInAppRoute,
  openInAppBrowser,
  resolveInAppRoute,
} from "../utils/externalLink";

const PLACEMENT = "mobile-home-header";
const DEFAULT_ASPECT_RATIO = 1170 / 433;
const MIN_ASPECT_RATIO = 1.4;
const MAX_ASPECT_RATIO = 4.0;
const AUTO_PLAY_MS = 5000;
const HORIZONTAL_PADDING = 15;

const DEFAULT_AD = {
  id: null,
  key: "default-seeli",
  source: require("../assets/seeli-home-banner.jpg"),
  link_url:
    "https://seeli.cam/?utm_source=cbh_youth_online&utm_campaign=seeli_ads&utm_medium=cyo_mobile_home_header",
  alt_text: "SEELI - See more. Live more.",
};

function getInitialCardWidth() {
  const screenWidth = Dimensions.get("window").width;
  return Math.max(200, Math.min(screenWidth, CONTENT_MAX_WIDTH) - HORIZONTAL_PADDING * 2);
}

/**
 * Header ad banner carousel shown on HomeScreen right below the top bar.
 * Displays the bundled SEELI creative until `/v1.0/ads?placement=mobile-home-header`
 * responds, then renders all active creatives managed in `/admin/ads` as a
 * swipeable, auto-advancing carousel slider (ordered by priority desc).
 * Hides cleanly if the placement is managed on the server with zero active ads.
 */
const HomeAdBanner = React.memo(({ navigation, refreshKey = 0, isFocused = true }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [remoteAds, setRemoteAds] = useState([]);
  const [failedKeys, setFailedKeys] = useState({});
  const [hiddenByAdmin, setHiddenByAdmin] = useState(false);
  const [cardWidth, setCardWidth] = useState(getInitialCardWidth);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === "active");

  const scrollViewRef = useRef(null);
  const isDraggingRef = useRef(false);
  const activeIndexRef = useRef(0);
  const trackedImpressionsRef = useRef(new Set());

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getAds(PLACEMENT, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const payload = res?.data;
        const rawList = Array.isArray(payload) ? payload : payload?.data || [];
        const validList = rawList
          .filter((item) => item && typeof item.image_url === "string" && item.image_url.trim())
          .map((item, idx) => ({
            ...item,
            key: item.id != null ? `ad-${item.id}` : `ad-idx-${idx}`,
          }));

        if (validList.length > 0) {
          setHiddenByAdmin(false);
          setFailedKeys({});
          setRemoteAds(validList);
          setActiveIndex(0);
          activeIndexRef.current = 0;
          scrollViewRef.current?.scrollTo({ x: 0, animated: false });
        } else if (res?.headers?.["x-placement-managed"] === "1") {
          setRemoteAds([]);
          setHiddenByAdmin(true);
        }
      })
      .catch((error) => {
        if (isRequestCanceled(error)) return;
        // Keep the current/bundled creative when the ad endpoint is unavailable.
      });

    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  const slides = useMemo(() => {
    const liveRemote = remoteAds.filter((item) => !failedKeys[item.key]);
    if (liveRemote.length > 0) {
      return liveRemote;
    }
    return [DEFAULT_AD];
  }, [remoteAds, failedKeys]);

  // Keep activeIndex in bounds when the slide count shrinks.
  useEffect(() => {
    if (activeIndex >= slides.length) {
      const clamped = Math.max(0, slides.length - 1);
      setActiveIndex(clamped);
      activeIndexRef.current = clamped;
      scrollViewRef.current?.scrollTo({ x: clamped * cardWidth, animated: false });
    }
  }, [activeIndex, slides.length, cardWidth]);

  // Track impression once per remote creative when its slide becomes visible.
  useEffect(() => {
    if (hiddenByAdmin || !isFocused || !isAppActive) return;
    const current = slides[activeIndex];
    if (current?.id && !trackedImpressionsRef.current.has(current.id)) {
      trackedImpressionsRef.current.add(current.id);
      trackAd(current.id, "impression").catch(() => {});
    }
  }, [activeIndex, slides, hiddenByAdmin, isFocused, isAppActive]);

  // Auto-advance carousel when multiple slides exist and screen is active.
  useEffect(() => {
    if (hiddenByAdmin || !isFocused || !isAppActive || slides.length <= 1 || cardWidth <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (isDraggingRef.current) return;
      const nextIndex = (activeIndexRef.current + 1) % slides.length;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * cardWidth,
        animated: true,
      });
    }, AUTO_PLAY_MS);

    return () => clearInterval(timer);
  }, [hiddenByAdmin, isFocused, isAppActive, slides.length, cardWidth]);

  const handleContainerLayout = useCallback((event) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0) {
      setCardWidth((prev) => {
        if (Math.abs(prev - nextWidth) <= 1) return prev;
        return nextWidth;
      });
    }
  }, []);

  const handlePressSlide = useCallback(
    (slide) => {
      const linkUrl = slide?.link_url;
      if (!linkUrl) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (slide?.id) {
        trackAd(slide.id, "click").catch(() => {});
      }
      const inAppRoute = navigation ? resolveInAppRoute(linkUrl) : null;
      if (inAppRoute) {
        navigateToInAppRoute(navigation, inAppRoute);
        return;
      }
      openInAppBrowser(linkUrl, theme);
    },
    [navigation, theme]
  );

  const handleFirstSlideLoad = useCallback((event, isFirstRemote) => {
    if (!isFirstRemote) return;
    const width = event?.source?.width;
    const height = event?.source?.height;
    if (width > 0 && height > 0) {
      const nextRatio = Math.min(
        MAX_ASPECT_RATIO,
        Math.max(MIN_ASPECT_RATIO, width / height)
      );
      setAspectRatio(nextRatio);
    }
  }, []);

  const handleSlideError = useCallback((slideKey) => {
    if (!slideKey || slideKey === DEFAULT_AD.key) return;
    setFailedKeys((prev) => (prev[slideKey] ? prev : { ...prev, [slideKey]: true }));
  }, []);

  const syncIndexFromOffset = useCallback(
    (offsetX) => {
      if (cardWidth <= 0) return;
      const nextIndex = Math.max(
        0,
        Math.min(slides.length - 1, Math.round(offsetX / cardWidth))
      );
      if (nextIndex !== activeIndexRef.current) {
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      }
    },
    [cardWidth, slides.length]
  );

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event) => {
      isDraggingRef.current = false;
      syncIndexFromOffset(event.nativeEvent.contentOffset.x);
    },
    [syncIndexFromOffset]
  );

  const handleScrollEndDrag = useCallback(
    (event) => {
      const velocityX = event.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(velocityX) < 0.1) {
        isDraggingRef.current = false;
        syncIndexFromOffset(event.nativeEvent.contentOffset.x);
      }
    },
    [syncIndexFromOffset]
  );

  const jumpToSlide = useCallback(
    (index) => {
      if (index < 0 || index >= slides.length) return;
      activeIndexRef.current = index;
      setActiveIndex(index);
      scrollViewRef.current?.scrollTo({
        x: index * cardWidth,
        animated: true,
      });
    },
    [cardWidth, slides.length]
  );

  if (hiddenByAdmin) {
    return null;
  }

  const bannerHeight = Math.round(cardWidth / aspectRatio);
  const isCarousel = slides.length > 1;

  const renderSlide = (slide, index) => {
    const isRemote = Boolean(slide.image_url);
    const source = isRemote ? { uri: slide.image_url } : slide.source;
    const label =
      slide.alt_text ||
      slide.name ||
      t("home.adBannerLabel");

    return (
      <TouchableOpacity
        key={slide.key}
        activeOpacity={0.9}
        disabled={!slide.link_url}
        onPress={() => handlePressSlide(slide)}
        accessibilityRole="link"
        accessibilityLabel={
          isCarousel
            ? `${label} (${t("home.adSlide", { index: index + 1, total: slides.length })})`
            : label
        }
        style={{ width: cardWidth, height: bannerHeight }}
      >
        <FastImage
          source={source}
          style={{ width: cardWidth, height: bannerHeight }}
          resizeMode="cover"
          shimmer={isRemote}
          onLoad={(e) => handleFirstSlideLoad(e, isRemote && index === 0)}
          onError={() => handleSlideError(slide.key)}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View
        onLayout={handleContainerLayout}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        {isCarousel ? (
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScrollBeginDrag={handleScrollBeginDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onScrollEndDrag={handleScrollEndDrag}
            style={{ width: cardWidth, height: bannerHeight }}
          >
            {slides.map(renderSlide)}
          </ScrollView>
        ) : (
          renderSlide(slides[0], 0)
        )}

        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{t("home.adBadge")}</Text>
        </View>

        {isCarousel ? (
          <View style={styles.dotsContainer}>
            {slides.map((slide, idx) => {
              const active = idx === activeIndex;
              return (
                <TouchableOpacity
                  key={slide.key}
                  onPress={() => jumpToSlide(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.adSlide", {
                    index: idx + 1,
                    total: slides.length,
                  })}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.dot,
                    active ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 6,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
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
  dotsContainer: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.38)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 14,
    backgroundColor: "#fff",
  },
  dotInactive: {
    width: 5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
});

export default HomeAdBanner;
