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
import FastImage from "../FastImage";
import AdHtmlView from "./AdHtmlView";
import {
  DEFAULT_COMMENT_HTML,
  PLACEMENT_POST_COMMENTS,
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
const CARD_HORIZONTAL_MARGIN = 15;
const CARD_PADDING = 12;

const DEFAULT_COMMENT_SLIDE = {
  id: null,
  key: "default-adsterra-native-banner",
  html_code: DEFAULT_COMMENT_HTML,
  alt_text: "Sponsored content",
};

function getInitialInnerWidth() {
  const screenWidth = Dimensions.get("window").width;
  return Math.max(
    220,
    Math.min(screenWidth, CONTENT_MAX_WIDTH) - (CARD_HORIZONTAL_MARGIN + CARD_PADDING) * 2
  );
}

/**
 * Sponsored content card shown in PostScreen's comment section ("NỘI DUNG ĐƯỢC
 * TÀI TRỢ"). Lazily renders the Adsterra Native Banner HTML WebView once the
 * user scrolls to the comment section (`isVisible`), and supports admin-managed
 * overrides (HTML or image / carousel slider) via `/admin/ads` placement
 * `mobile-post-comments`.
 */
const PostCommentAd = React.memo(
  ({ navigation, isVisible = false, isFocused = true, refreshKey = 0 }) => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    const [remoteAds, setRemoteAds] = useState([]);
    const [hiddenByAdmin, setHiddenByAdmin] = useState(false);
    const [innerWidth, setInnerWidth] = useState(getInitialInnerWidth);
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
      fetchPlacementAds(PLACEMENT_POST_COMMENTS, { force: refreshKey > 0 })
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
          // Keep default Adsterra Native Banner fallback if API fails.
        });
      return () => {
        alive = false;
      };
    }, [refreshKey]);

    const slides = useMemo(() => {
      if (remoteAds.length > 0) return remoteAds;
      return [DEFAULT_COMMENT_SLIDE];
    }, [remoteAds]);

    useEffect(() => {
      if (activeIndex >= slides.length) {
        const clamped = Math.max(0, slides.length - 1);
        setActiveIndex(clamped);
        activeIndexRef.current = clamped;
      }
    }, [activeIndex, slides.length]);

    // Track impression once per remote creative when scrolled into view.
    useEffect(() => {
      if (!isVisible || hiddenByAdmin || !isFocused || !isAppActive) return;
      const current = slides[activeIndex];
      if (current?.id && !trackedImpressionsRef.current.has(current.id)) {
        trackedImpressionsRef.current.add(current.id);
        trackAd(current.id, "impression").catch(() => {});
      }
    }, [isVisible, hiddenByAdmin, isFocused, isAppActive, slides, activeIndex]);

    // Auto-advance carousel when 2+ creatives exist.
    useEffect(() => {
      if (
        !isVisible ||
        hiddenByAdmin ||
        !isFocused ||
        !isAppActive ||
        slides.length <= 1 ||
        innerWidth <= 0
      ) {
        return undefined;
      }
      const timer = setInterval(() => {
        if (isDraggingRef.current) return;
        const nextIndex = (activeIndexRef.current + 1) % slides.length;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        scrollViewRef.current?.scrollTo({
          x: nextIndex * innerWidth,
          animated: true,
        });
      }, AUTO_PLAY_MS);

      return () => clearInterval(timer);
    }, [isVisible, hiddenByAdmin, isFocused, isAppActive, slides.length, innerWidth]);

    const handleInnerLayout = useCallback((event) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0) {
        setInnerWidth((prev) => (Math.abs(prev - nextWidth) <= 1 ? prev : nextWidth));
      }
    }, []);

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
        if (innerWidth <= 0) return;
        const nextIndex = Math.max(
          0,
          Math.min(slides.length - 1, Math.round(offsetX / innerWidth))
        );
        if (nextIndex !== activeIndexRef.current) {
          activeIndexRef.current = nextIndex;
          setActiveIndex(nextIndex);
        }
      },
      [innerWidth, slides.length]
    );

    const jumpToSlide = useCallback(
      (idx) => {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
        scrollViewRef.current?.scrollTo({ x: idx * innerWidth, animated: true });
      },
      [innerWidth]
    );

    if (hiddenByAdmin) {
      return null;
    }

    const isCarousel = slides.length > 1;
    const imageHeight = Math.round(innerWidth / 2);

    const renderSlide = (slide, index) => {
      const isHtml = Boolean(slide.html_code && !slide.image_url);
      if (isHtml) {
        return (
          <View key={slide.key} style={{ width: innerWidth }}>
            <AdHtmlView
              htmlCode={slide.html_code}
              isVisible={isVisible && (!isCarousel || index === activeIndex)}
              width={innerWidth}
              height={210}
              autoHeight
              minHeight={140}
              maxHeight={560}
              onAdClick={() => {
                if (slide.id) trackAd(slide.id, "click").catch(() => {});
              }}
            />
          </View>
        );
      }

      return (
        <TouchableOpacity
          key={slide.key}
          activeOpacity={0.9}
          disabled={!slide.link_url}
          onPress={() => handlePressImageSlide(slide)}
          accessibilityRole="link"
          accessibilityLabel={slide.alt_text || slide.name || t("ads.sponsoredContent")}
          style={[
            styles.imageFrame,
            {
              width: innerWidth,
              height: imageHeight,
              borderColor: theme.border,
            },
          ]}
        >
          <FastImage
            source={{ uri: slide.image_url }}
            style={{ width: innerWidth, height: imageHeight }}
            resizeMode="cover"
            shimmer
          />
        </TouchableOpacity>
      );
    };

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.headerLabel, { color: theme.subText }]}>
            {t("ads.sponsoredContent")}
          </Text>
          <TouchableOpacity
            onPress={() => openInAppBrowser(ADS_CONTACT_URL, theme)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel={t("ads.contactAds")}
          >
            <Text style={[styles.headerLink, { color: theme.primary }]}>
              {t("ads.learnMore")}
            </Text>
          </TouchableOpacity>
        </View>

        <View onLayout={handleInnerLayout}>
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
              style={{ width: innerWidth }}
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
      </View>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: CARD_HORIZONTAL_MARGIN,
    marginTop: 14,
    marginBottom: 4,
    padding: CARD_PADDING,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  headerLink: {
    fontSize: 12,
    fontWeight: "600",
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
});

export default PostCommentAd;
