import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
  FlatList,
  DeviceEventEmitter,
  Platform,
} from "react-native";
import FastImage from "../../../components/FastImage";
import { AuthContext } from "../../../contexts/AuthContext";
import { getForumCategories, isRequestCanceled } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";
import { getCategoryName } from "../../../utils/forumUtils";
import { storage } from "../../../global/storage";
import { useResponsiveLayout, CONTENT_MAX_WIDTH } from "../../../utils/responsive";


// The veil over a section's picture, in the card's own background colour:
// fully solid over the left half (the text sits on plain background, as in
// the original design), then fading out to the bare picture at the
// right edge - which keeps a 45% tint of that colour (dark or light with the
// theme), never the bare picture. (The same colour at falling opacities - fading to plain
// "transparent" would pass through grey.)
const sectionVeil = (background) => {
  const hex = /^#[0-9a-fA-F]{6}$/.test(background) ? background : "#121212";
  return [`${hex}FF`, `${hex}FF`, `${hex}B3`, `${hex}73`];
};

const ForumSection = ({ section, navigation, theme, isDarkMode, t }) => (
  <TouchableOpacity
    onPress={() => navigation.navigate("CategoryScreen", { categoryId: section.id })}
    activeOpacity={0.88}
    style={[
      styles.sectionBox,
      {
        borderColor: theme.border,
        backgroundColor: theme.surface,
      },
    ]}
  >
    <ImageBackground
      source={{ uri: "https://www.chuyenbienhoa.com/images/" + section.background_image }}
      resizeMode="cover"
      style={styles.sectionBackground}
      imageStyle={styles.sectionBackgroundImage}
    >
      {/* The section's picture fills the whole card (cover); this veil keeps
          the text readable. It covers exactly the card at any width: solid
          on the left, fading out diagonally to the bare picture on the right. */}
      <LinearGradient
        colors={sectionVeil(theme.surface || theme.background)}
        locations={[0, 0.45, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.35 }}
        style={StyleSheet.absoluteFill}
      />
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{getCategoryName(section.name, t)}</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.subText }]}>
              {section.post_count} {t('forum.posts').toLowerCase()} · {section.comment_count} {t('forum.comments').toLowerCase()}
            </Text>
          </View>
          <View style={[styles.sectionBadge, { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" }]}> 
            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
          </View>
        </View>

        <View style={[styles.latestBox, { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.12)" : "rgba(34, 197, 94, 0.08)" }]}> 
          {section.latest_post ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("PostScreen", { postId: section.latest_post.id })}
              activeOpacity={0.8}
            >
              <View style={styles.latestMetaRow}>
                <Text style={[styles.latestLabel, { color: theme.primary }]}>{t('forum.latest')}</Text>
                <Text style={[styles.latestTime, { color: theme.subText }]}> 
                  {section.latest_post.created_at ? formatTime(section.latest_post.created_at) : ""}
                </Text>
              </View>
              <Text style={[styles.latestContent, { color: theme.text }]} numberOfLines={2}> 
                <Text style={[styles.latestAuthor, { color: theme.primary }]}> 
                  {section.latest_post.user.name}:
                </Text>{" "}
                {section.latest_post.title}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.latestLabel, { color: theme.subText }]}>{t('forum.noNewPosts')}</Text>
          )}
        </View>
    </ImageBackground>
  </TouchableOpacity>
)

export default function ForumScreen({ navigation, scrollTriggerRef }) {
  const { theme, isDarkMode } = useTheme();
  // Reactive, unlike a module-level Dimensions read: the category pager's
  // pages are exactly this wide, so on an iPad rotated or resized in split
  // view a stale width left every page (and its section cards) offset.
  const { width } = useResponsiveLayout();
  const { t } = useTranslation();
  // One object per real change: a new one on every render made the list
  // re-render all of its rows each time anything on this screen changed.
  const listExtraData = React.useMemo(() => ({ t, theme, isDarkMode }), [t, theme, isDarkMode]);
  const [activeCategory, setActiveCategory] = useState(1);
  const { username } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forumSections, setForumSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef(null);
  const tabScrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const insets = useSafeAreaInsets();
  const headerHeight = 58 + insets.top;

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "SET_FEED_SCROLL_ENABLED",
      (enabled) => {
        setScrollEnabled(enabled);
      }
    );
    return () => subscription.remove();
  }, []);

  const handleTabScroll = (index) => {
    const tabWidth = 180;
    const scrollPosition = Math.max(0, (index + 1) * tabWidth - width);
    tabScrollViewRef.current?.scrollTo({ x: scrollPosition, animated: true });
  };

  const lastScrollYRef = useRef(0);
  const scrollPositionRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  const innerScrollRefs = useRef({});
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY);

    lastScrollYRef.current = offsetY;
  };

  const scrollToTopOrReload = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) return;
    lastTriggerTimeRef.current = now;

    if (isProcessingRef.current) return;

    const isAtTop = scrollPositionRef.current <= 10;

    if (isAtTop) {
      isProcessingRef.current = true;
      setRefreshing(true);
      fetchForumData();
      setTimeout(() => {
        setRefreshing(false);
        isProcessingRef.current = false;
        scrollPositionRef.current = 0;
      }, 1000);
    } else {
      isProcessingRef.current = true;
      const scrollRef = innerScrollRefs.current[activeCategory];
      if (scrollRef) {
        if (typeof scrollRef.scrollToOffset === "function") {
          scrollRef.scrollToOffset({ offset: 0, animated: true });
        } else if (typeof scrollRef.scrollTo === "function") {
          scrollRef.scrollTo({ y: 0, animated: true });
        }
      }
      setTimeout(() => {
        scrollPositionRef.current = 0;
        isProcessingRef.current = false;
      }, 600);
    }
  }, [activeCategory]);

  React.useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  useEffect(() => {
    if (categories.length > 0) {
      const selectedCategory = categories.find(
        (cat) => cat.id === activeCategory
      );
      setForumSections(
        selectedCategory ? selectedCategory.subforums : categories[0].subforums
      );
    }
  }, [categories, activeCategory]);

  const fetchForumData = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      const cachedStr = storage.getString("cached_forum");
      if (cachedStr) {
        try {
          const parsed = JSON.parse(cachedStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
            setLoading(false);
            setRefreshing(true);
          }
        } catch(e) {}
      }

      const response = await getForumCategories({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const categoriesData = response?.data;
      if (Array.isArray(categoriesData) && categoriesData.length > 0) {
        setCategories(categoriesData);
        storage.set("cached_forum", JSON.stringify(categoriesData));
      }
      setLoading(false);
      setTimeout(() => setRefreshing(false), 1000);
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      console.log(error);
      setLoading(false);
      setTimeout(() => setRefreshing(false), 1000);
    } finally {
      if (!controller.signal.aborted) {
        isFetchingRef.current = false;
      }
    }
  };

  const handleActiveCategory = (categoryId, index) => {
    setActiveCategory(categoryId);
    const selectedCategory = categories.find((cat) => cat.id === categoryId);
    setForumSections(selectedCategory.subforums);
    flatListRef.current?.scrollToIndex({ index, animated: true });
    handleTabScroll(index);
  };

  const handlePageChange = (event) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const category = categories[newIndex];
    if (category) {
      setActiveCategory(category.id);
      setForumSections(category.subforums);
      handleTabScroll(newIndex);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchForumData();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  useEffect(() => {
    fetchForumData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Soft Ambient Light-Green Glow at Top */}
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.ambientGlow, { height: insets.top + 140 }]}
          pointerEvents="none"
        />

        <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]} pointerEvents="box-none">
          <View style={styles.headerLeft}>
            {navigation?.canGoBack?.() && (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginRight: 8, padding: 4 }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("common.back", "Back")}
              >
                <Ionicons name="chevron-back" size={26} color={theme.primary} />
              </TouchableOpacity>
            )}
            <Text style={[styles.headerTitle, { color: theme.primary }]} numberOfLines={1}>
              {t('forum.title')}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate("MemberRankingScreen")}
              accessibilityRole="button"
              accessibilityLabel={t("sidebar.memberRanking")}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(34, 197, 94, 0.16)"
                    : "rgba(34, 197, 94, 0.12)",
                },
              ]}
            >
              <Ionicons
                name="trophy-outline"
                size={20}
                color={isDarkMode ? "#4ADE80" : "#15803D"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("CreatePostScreen")}
              accessibilityRole="button"
              accessibilityLabel={t("createPost.title")}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(34, 197, 94, 0.16)"
                    : "rgba(34, 197, 94, 0.12)",
                },
              ]}
            >
              <Ionicons
                name="add"
                size={22}
                color={isDarkMode ? "#4ADE80" : "#15803D"}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}
        >
          <CustomLoading />
          <Text style={{ marginTop: 15, color: theme.text }}>{t('forum.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Soft Ambient Light-Green Glow at Top */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.ambientGlow, { height: insets.top + 140 }]}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent" }]} pointerEvents="box-none">
        <View style={styles.headerLeft}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginRight: 8, padding: 4 }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("common.back", "Back")}
            >
              <Ionicons name="chevron-back" size={26} color={theme.primary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: theme.primary }]} numberOfLines={1}>
            {t('forum.title')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("MemberRankingScreen")}
            accessibilityRole="button"
            accessibilityLabel={t("sidebar.memberRanking")}
            style={[
              styles.headerIconButton,
              {
                backgroundColor: isDarkMode
                  ? "rgba(34, 197, 94, 0.16)"
                  : "rgba(34, 197, 94, 0.12)",
              },
            ]}
          >
            <Ionicons
              name="trophy-outline"
              size={20}
              color={isDarkMode ? "#4ADE80" : "#15803D"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("CreatePostScreen")}
            accessibilityRole="button"
            accessibilityLabel={t("createPost.title")}
            style={[
              styles.headerIconButton,
              {
                backgroundColor: isDarkMode
                  ? "rgba(34, 197, 94, 0.16)"
                  : "rgba(34, 197, 94, 0.12)",
              },
            ]}
          >
            <Ionicons
              name="add"
              size={22}
              color={isDarkMode ? "#4ADE80" : "#15803D"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={tabScrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContent}
        scrollEnabled={scrollEnabled}
        style={[styles.tabContainer, { backgroundColor: "transparent" }]}
      >
        {categories.map((cat, index) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={`cat-${cat.id}`}
              onPress={() => handleActiveCategory(cat.id, index)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: theme.primary, borderColor: "transparent" }
                  : { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  active
                    ? { color: "#ffffff", fontWeight: "700" }
                    : { color: theme.text, fontWeight: "500" },
                ]}
              >
                {getCategoryName(cat.name, t)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {refreshing && (
        <View
          style={{
            position: "absolute",
            top: headerHeight + styles.tabContainer.height + 15,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <CustomLoading size={44} showBackdrop />
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={categories}
        extraData={listExtraData}
        horizontal
        pagingEnabled
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        style={{ backgroundColor: theme.background }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: (event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const index = offsetX / width;
              handleTabScroll(index);
            },
          }
        )}
        onMomentumScrollEnd={handlePageChange}
        keyExtractor={(item) => `category-${item.id}`}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 50));
          wait.then(() => {
            flatListRef.current?.scrollToOffset({
              offset: width * info.index,
              animated: false,
            });
          });
        }}
        renderItem={({ item }) => (
          <FlatList
            ref={(ref) => { if (ref) innerScrollRefs.current[item.id] = ref; }}
            data={item.subforums || []}
            keyExtractor={(section) => `subforum-${section.id}`}
            style={{ flex: 1, width, backgroundColor: theme.background }}
            contentContainerStyle={{
              backgroundColor: "transparent",
              // Capped and centered on large screens like the feed: stretched
              // across a tablet, each card's cover image was cropped down to
              // a thin slice and its corner fade no longer lined up with it.
              width: "100%",
              maxWidth: CONTENT_MAX_WIDTH + 32,
              alignSelf: "center",
              paddingHorizontal: 16,
              paddingBottom: 110 + insets.bottom,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === "android"}
            onScroll={(e) => {
              const offsetY = e.nativeEvent.contentOffset.y;
              if (item.id === activeCategory) {
                scrollPositionRef.current = Math.max(0, offsetY);
              }
              handleScroll(e);
            }}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="transparent"
                colors={["transparent"]}
                progressBackgroundColor="transparent"
                style={{ backgroundColor: theme.background }}
                progressViewOffset={-1000}
              />
            }
            renderItem={({ item: section }) => (
              <ForumSection
                section={section}
                navigation={navigation}
                theme={theme}
                isDarkMode={isDarkMode}
                t={t}
              />
            )}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tabContainer: {
    height: 45,
    marginTop: 10,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: 8,
    height: 36,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabText: {
    fontSize: 14,
  },
  sectionBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  // Was width "105%" with a fixed marginRight: 14 on the content to pull it
  // back in - the overflow is 5% of the card, which only matched 14px on a
  // phone; on wider screens the image and the chevron/latest box drifted
  // further off the right edge. Plain full width with symmetric padding.
  sectionBackground: {
    padding: 14,
    // No `width` here. ImageBackground copies this style's width onto its
    // picture, and a percentage on that absolutely positioned picture is
    // measured against the box INSIDE the padding - so "100%" left the
    // picture 28 short of the card's right edge on every device (the reason
    // for the old "105%"). Without it the picture is pinned to all four
    // edges; the card still stretches to the full width by itself.
    alignSelf: "stretch",
    borderRadius: 16,
    overflow: "hidden",
  },
  sectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  latestBox: {
    borderRadius: 12,
    padding: 10,
  },
  latestMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  latestLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  latestContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  latestAuthor: {
    fontWeight: "700",
  },
  latestTime: {
    fontSize: 12,
  },
});
