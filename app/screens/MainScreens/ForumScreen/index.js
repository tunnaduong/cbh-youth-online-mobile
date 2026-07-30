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
  Animated,
  FlatList,
  Dimensions,
  DeviceEventEmitter,
  Platform,
} from "react-native";
import FastImage from "../../../components/FastImage";
import { AuthContext } from "../../../contexts/AuthContext";
import { getForumCategories } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";
import { getCategoryName } from "../../../utils/forumUtils";
import { storage } from "../../../global/storage";
import LiquidButton from "../../../components/LiquidButton";

const { width } = Dimensions.get("window");


const ForumSection = ({ section, navigation, theme, isDarkMode, t }) => (
  <TouchableOpacity
    onPress={() => navigation.navigate("CategoryScreen", { categoryId: section.id })}
    activeOpacity={0.9}
    style={[
      styles.sectionBox,
      {
        borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
      },
    ]}
  >
    <ImageBackground
      source={{ uri: "https://www.chuyenbienhoa.com/images/" + section.background_image }}
      resizeMode="cover"
      style={styles.sectionBackground}
      imageStyle={styles.sectionBackgroundImage}
    >
      <LinearGradient
        colors={[theme.background, "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 3, y: 0 }}
        style={{ position: "absolute", width: "150%", height: "400%", transform: [{rotate: '-35deg'}, {translateY: -150}] }}
      />
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{getCategoryName(section.name, t)}</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.subText }]}>
              {section.post_count} {t('forum.posts').toLowerCase()} · {section.comment_count} {t('forum.comments').toLowerCase()}
            </Text>
          </View>
          <View style={[styles.sectionBadge, { backgroundColor: isDarkMode ? "rgba(49,149,39,0.16)" : "rgba(49,149,39,0.1)" }]}> 
            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
          </View>
        </View>

        <View style={[styles.latestBox, { backgroundColor: isDarkMode ? "rgba(49,149,39,0.1)" : "rgba(49,149,39,0.06)" }]}> 
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
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState(1);
  const { username } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forumSections, setForumSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef(null);
  const tabScrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
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

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY);
    scrollY.setValue(offsetY);

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
        scrollRef.scrollTo({ y: 0, animated: true });
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

      const response = await getForumCategories();
      const categoriesData = response?.data;
      if (Array.isArray(categoriesData) && categoriesData.length > 0) {
        setCategories(categoriesData);
        storage.set("cached_forum", JSON.stringify(categoriesData));
      }
      setLoading(false);
      setTimeout(() => setRefreshing(false), 1000);
    } catch (error) {
      console.log(error);
      setLoading(false);
      setTimeout(() => setRefreshing(false), 1000);
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
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]} pointerEvents="box-none">
          <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('forum.title')}</Text>
          <LiquidButton size={40} scrollY={scrollY} onPress={() => navigation.navigate("ProfileScreen", { username })} style={{ padding: 2 }}>
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={styles.avatar}
            />
          </LiquidButton>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background, paddingTop: headerHeight }}
        >
          <CustomLoading />
          <Text style={{ marginTop: 15, color: theme.text }}>{t('forum.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating header */}
      <View style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent", backgroundColor: "transparent" }]} pointerEvents="box-none">
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('forum.title')}</Text>
        <View style={styles.headerActions}>
          <LiquidButton size={40} scrollY={scrollY} onPress={() => navigation.navigate("MemberRankingScreen")}>
            <Ionicons name="trophy-outline" size={22} color={theme.primary} />
          </LiquidButton>
          <LiquidButton size={40} scrollY={scrollY} onPress={() => navigation.navigate("ProfileScreen", { username })} style={{ padding: 2 }}>
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={styles.avatar}
            />
          </LiquidButton>
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
        {categories.map((cat, index) => (
          <TouchableOpacity
            key={`cat-${cat.id}`}
            onPress={() => handleActiveCategory(cat.id, index)}
            style={[
              styles.tab,
              { backgroundColor: isDarkMode ? "#1e2e1c" : "#F3FDF1" },
              activeCategory === cat.id && (isDarkMode ? { backgroundColor: "#2e4e2a" } : styles.tabActive),
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.text },
                activeCategory === cat.id && styles.tabTextActive,
              ]}
            >
              {getCategoryName(cat.name, t)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        ref={flatListRef}
        data={categories}
        extraData={{ t, theme, isDarkMode }}
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
          <ScrollView
            style={{ flex: 1, width, backgroundColor: theme.background }}
            contentContainerStyle={{
              backgroundColor: "transparent",
              paddingHorizontal: 16,
              paddingBottom: 110 + insets.bottom,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const offsetY = e.nativeEvent.contentOffset.y;
              if (item.id === activeCategory) {
                scrollPositionRef.current = Math.max(0, offsetY);
              }
              handleScroll(e);
            }}
            ref={(ref) => { if (ref) innerScrollRefs.current[item.id] = ref; }}
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
          >
            {item.subforums.map((section) => (
              <ForumSection
                key={section.id}
                section={section}
                navigation={navigation}
                theme={theme}
                isDarkMode={isDarkMode}
                t={t}
              />
            ))}
          </ScrollView>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    borderRadius: 8,
    marginRight: 7,
    height: 35,
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#C7F0C2",
  },
  tabText: {
    fontWeight: "500",
    fontSize: 15,
  },
  tabTextActive: {
    color: "#319527",
    fontWeight: "bold",
  },
  sectionBox: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginRight: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  sectionBackground: {
    padding: 14,
    width: "105%",
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
    marginRight: 14
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
