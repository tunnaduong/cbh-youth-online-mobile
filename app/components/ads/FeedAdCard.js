import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import FastImage from "../FastImage";
import Verified from "../../assets/Verified";
import AdHtmlView from "./AdHtmlView";
import {
  DEFAULT_IN_FEED_HTML,
  PLACEMENT_FEED_INLINE,
  fetchPlacementAds,
} from "./adStore";
import { useTheme } from "../../contexts/ThemeContext";
import { CONTENT_MAX_WIDTH } from "../../utils/responsive";
import { trackAd } from "../../services/api/Api";
import {
  navigateToInAppRoute,
  openInAppBrowser,
  resolveInAppRoute,
} from "../../utils/externalLink";

const ADS_CONTACT_URL = "https://chuyenbienhoa.com/ads";
const AUTO_PLAY_MS = 5000;
const AD_BOX_HEIGHT = 250;

const DEFAULT_IN_FEED_SLIDE = {
  id: null,
  key: "default-adsterra-300x250",
  html_code: DEFAULT_IN_FEED_HTML,
  alt_text: "Sponsored",
};

function getInitialSlideWidth() {
  const screenWidth = Dimensions.get("window").width;
  return Math.max(260, Math.min(screenWidth, CONTENT_MAX_WIDTH));
}

/**
 * In-feed sponsored card for HomeScreen. Matches the PostItem visual shell
 * ("ĐƯỢC TÀI TRỢ" + 300x250 Adsterra / admin-managed creative + "Quảng cáo trên
 * CBH Online" verified footer). Mounts the HTML WebView lazily only once the
 * user scrolls to the card (`isVisible`), and supports carousel slider mode
 * when multiple active creatives exist for `mobile-feed-inline` in `/admin/ads`.
 */
const FeedAdCard = React.memo(
  ({ navigation, isVisible = false, refreshKey = 0, isFocused = true }) => {
    const { theme, isDarkMode } = useTheme();
    const { t } = useTranslation();

    const [remoteAds, setRemoteAds] = useState([]);
    const [hiddenByAdmin, setHiddenByAdmin] = useState(false);
    const [slideWidth, setSlideWidth] = useState(getInitialSlideWidth);
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
      let alive = true;
      fetchPlacementAds(PLACEMENT_FEED_INLINE, { force: false })
        .then(({ ads, managed }) => {
          if (!alive) return;
          if (ads.length > 0) {
            setHiddenByAdmin(false);
            setRemoteAds(ads);
            setActiveIndex(0);
            activeIndexRef.current = 0;
            scrollViewRef.current?.scrollTo({ x: 0, animated: false });
          } else if (managed) {
            setRemoteAds([]);
            setHiddenByAdmin(true);
          }
        })
        .catch(() => {
          // Keep default Adsterra fallback if API fails.
        });
      return () => {
        alive = false;
      };
    }, [refreshKey]);

    const slides = useMemo(() => {
      if (remoteAds.length > 0) return remoteAds;
      return [DEFAULT_IN_FEED_SLIDE];
    }, [remoteAds]);

    useEffect(() => {
      if (activeIndex >= slides.length) {
        const clamped = Math.max(0, slides.length - 1);
        setActiveIndex(clamped);
        activeIndexRef.current = clamped;
      }
    }, [activeIndex, slides.length]);

    // Track impression once per remote creative when card is scrolled into view.
    useEffect(() => {
      if (!isVisible || hiddenByAdmin || !isFocused || !isAppActive) return;
      const current = slides[activeIndex];
      if (current?.id && !trackedImpressionsRef.current.has(current.id)) {
        trackedImpressionsRef.current.add(current.id);
        trackAd(current.id, "impression").catch(() => {});
      }
    }, [isVisible, hiddenByAdmin, isFocused, isAppActive, slides, activeIndex]);

    // Auto-advance carousel when 2+ creatives exist and card is visible.
    useEffect(() => {
      if (
        !isVisible ||
        hiddenByAdmin ||
        !isFocused ||
        !isAppActive ||
        slides.length <= 1 ||
        slideWidth <= 0
      ) {
        return undefined;
      }
      const timer = setInterval(() => {
        if (isDraggingRef.current) return;
        const nextIndex = (activeIndexRef.current + 1) % slides.length;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        scrollViewRef.current?.scrollTo({
          x: nextIndex * slideWidth,
          animated: true,
        });
      }, AUTO_PLAY_MS);

      return () => clearInterval(timer);
    }, [isVisible, hiddenByAdmin, isFocused, isAppActive, slides.length, slideWidth]);

    const handleContainerLayout = useCallback((event) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0) {
        setSlideWidth((prev) => (Math.abs(prev - nextWidth) <= 1 ? prev : nextWidth));
      }
    }, []);

    const openAdsContact = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      openInAppBrowser(ADS_CONTACT_URL, theme);
    }, [theme]);

    const handleMorePress = useCallback(() => {
      Alert.alert(t("ads.optionsTitle"), t("ads.optionsMessage"), [
        { text: t("common.close"), style: "cancel" },
        { text: t("ads.contactAds"), onPress: openAdsContact },
      ]);
    }, [t, openAdsContact]);

    const handlePressImageSlide = useCallback(
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

    const syncIndexFromOffset = useCallback(
      (offsetX) => {
        if (slideWidth <= 0) return;
        const nextIndex = Math.max(
          0,
          Math.min(slides.length - 1, Math.round(offsetX / slideWidth))
        );
        if (nextIndex !== activeIndexRef.current) {
          activeIndexRef.current = nextIndex;
          setActiveIndex(nextIndex);
        }
      },
      [slideWidth, slides.length]
    );

    const jumpToSlide = useCallback(
      (idx) => {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
        scrollViewRef.current?.scrollTo({ x: idx * slideWidth, animated: true });
      },
      [slideWidth]
    );

    if (hiddenByAdmin) {
      return null;
    }

    const isCarousel = slides.length > 1;
    const imageBoxWidth = Math.max(240, slideWidth - 30);

    const renderSlide = (slide, index) => {
      const isHtml = Boolean(slide.html_code && !slide.image_url);
      if (isHtml) {
        return (
          <View
            key={slide.key}
            style={[styles.slideWrap, { width: slideWidth }]}
          >
            <AdHtmlView
              htmlCode={slide.html_code}
              isVisible={isVisible && (!isCarousel || index === activeIndex)}
              width={Math.min(300, imageBoxWidth)}
              height={AD_BOX_HEIGHT}
              centered
              onAdClick={() => {
                if (slide.id) trackAd(slide.id, "click").catch(() => {});
              }}
            />
          </View>
        );
      }

      return (
        <View key={slide.key} style={[styles.slideWrap, { width: slideWidth }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!slide.link_url}
            onPress={() => handlePressImageSlide(slide)}
            accessibilityRole="link"
            accessibilityLabel={slide.alt_text || slide.name || t("ads.sponsored")}
            style={[
              styles.imageFrame,
              {
                width: imageBoxWidth,
                height: AD_BOX_HEIGHT,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <FastImage
              source={{ uri: slide.image_url }}
              style={{ width: imageBoxWidth, height: AD_BOX_HEIGHT }}
              resizeMode="cover"
              shimmer
            />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View
        onLayout={handleContainerLayout}
        style={[
          styles.card,
          {
            backgroundColor: theme.background,
            borderBottomColor: isDarkMode ? "#000" : "#E6E6E6",
          },
        ]}
      >
        {/* Top header row: "ĐƯỢC TÀI TRỢ" + "..." */}
        <View style={styles.headerRow}>
          <Text style={[styles.sponsoredTitle, { color: theme.text }]}>
            {t("ads.sponsored")}
          </Text>
          <TouchableOpacity
            onPress={handleMorePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("ads.optionsTitle")}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.subText} />
          </TouchableOpacity>
        </View>

        {/* Ad creative area (300x250 Adsterra HTML or managed image / carousel) */}
        <View style={styles.mediaArea}>
          {isCarousel ? (
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                isDraggingRef.current = true;
              }}
              onMomentumScrollEnd={(e) => {
                isDraggingRef.current = false;
                syncIndexFromOffset(e.nativeEvent.contentOffset.x);
              }}
              onScrollEndDrag={(e) => {
                const vx = e.nativeEvent.velocity?.x ?? 0;
                if (Math.abs(vx) < 0.1) {
                  isDraggingRef.current = false;
                  syncIndexFromOffset(e.nativeEvent.contentOffset.x);
                }
              }}
              style={{ width: slideWidth, height: AD_BOX_HEIGHT }}
            >
              {slides.map(renderSlide)}
            </ScrollView>
          ) : (
            renderSlide(slides[0], 0)
          )}

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

        {/* Divider matching PostItem */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Footer branding row matching mockup: frog avatar + "Quảng cáo trên CBH Online" + verified */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={openAdsContact}
          accessibilityRole="link"
          accessibilityLabel={t("ads.advertiseOnCbh")}
          style={styles.footerRow}
        >
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: theme.surface,
                borderColor: theme.primary,
              },
            ]}
          >
            <FastImage
              source={require("../../assets/logo.png")}
              style={styles.avatarLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandNameWrap}>
            <Text
              numberOfLines={1}
              style={[styles.brandName, { color: theme.primary }]}
            >
              {t("ads.advertiseOnCbh")}
            </Text>
            <Verified
              width={15}
              height={15}
              fill={theme.primary}
              style={{ marginLeft: 4, flexShrink: 0 }}
            />
          </View>
          <View
            style={[
              styles.ctaPill,
              { backgroundColor: theme.iconBackground },
            ]}
          >
            <Text style={[styles.ctaPillText, { color: theme.subText }]}>
              {t("ads.learnMore")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sponsoredTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  mediaArea: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  slideWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: AD_BOX_HEIGHT,
  },
  imageFrame: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  dotsContainer: {
    marginTop: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.35)",
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 15,
    marginTop: 14,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingBottom: 14,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarLogo: {
    width: 28,
    height: 28,
  },
  brandNameWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  brandName: {
    fontSize: 14.5,
    fontWeight: "700",
    flexShrink: 1,
  },
  ctaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  ctaPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default FeedAdCard;
