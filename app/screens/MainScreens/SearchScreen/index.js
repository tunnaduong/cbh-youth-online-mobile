import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TextInput,
  ScrollView,
  Platform,
  TouchableOpacity,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { searchQuery, getSearchSuggestions } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import CustomLoading from "../../../components/CustomLoading";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";
import UserNameRow from "../../../components/profile/UserNameRow";
import StyledUsername from "../../../components/profile/StyledUsername";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";
import { storage } from "../../../global/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RECENT_SEARCHES_KEY = "recent_search_queries_v1";
const MAX_RECENT_SEARCHES = 8;

export default function SearchScreen({ navigation, route }) {
  const inset = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [query, setQuery] = useState(route?.params?.initialQuery || "");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState(
    route?.params?.initialFilter || "all"
  ); // "all", "user", "post", "hashtag"
  const [hashtagTag, setHashtagTag] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestedTopics, setSuggestedTopics] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  // Load recent searches from MMKV
  useEffect(() => {
    try {
      const stored = storage.getString(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed);
        }
      }
    } catch {}
  }, []);

  // Fetch suggested topics & hashtags from server API
  useEffect(() => {
    getSearchSuggestions()
      .then((res) => {
        const topics = res?.data?.data?.topics || res?.data?.topics;
        if (Array.isArray(topics) && topics.length > 0) {
          setSuggestedTopics(topics);
        }
      })
      .catch((err) => {
        console.warn("[SearchScreen] Failed to load suggestions from server:", err?.message || err);
      });
  }, []);

  const saveRecentSearch = useCallback((searchTerm) => {
    const term = searchTerm.trim();
    if (!term || term.length < 2) return;
    try {
      setRecentSearches((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
        const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        storage.set(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {}
  }, []);

  const removeRecentSearch = useCallback((searchTerm) => {
    try {
      setRecentSearches((prev) => {
        const updated = prev.filter((item) => item !== searchTerm);
        storage.set(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {}
  }, []);

  const clearAllRecent = useCallback(() => {
    Alert.alert(
      t("search.clearRecent", "Xóa lịch sử"),
      t("search.clearRecentConfirm", "Bạn có chắc muốn xóa toàn bộ lịch sử tìm kiếm?"),
      [
        { text: t("common.cancel", "Hủy"), style: "cancel" },
        {
          text: t("search.clearRecent", "Xóa lịch sử"),
          style: "destructive",
          onPress: () => {
            setRecentSearches([]);
            storage.delete(RECENT_SEARCHES_KEY);
          },
        },
      ]
    );
  }, [t]);

  // Execute Search query with debounce
  useEffect(() => {
    const trimmed = query.trim();
    const isHashtagQuery = trimmed.startsWith("#") && trimmed.length > 1;
    const effectiveFilter = isHashtagQuery ? "hashtag" : activeFilter;
    const effectiveQuery = isHashtagQuery ? trimmed.slice(1) : trimmed;

    const delayDebounceFn = setTimeout(() => {
      if (effectiveQuery) {
        setLoading(true);
        setHasSearched(false);
        saveRecentSearch(trimmed);

        searchQuery(effectiveQuery, effectiveFilter)
          .then((res) => {
            if (effectiveFilter === "hashtag") {
              setHashtagTag(res?.data?.data?.hashtag || effectiveQuery);
              setResults({
                users: [],
                posts: Array.isArray(res?.data?.data?.posts)
                  ? res.data.data.posts
                  : [],
              });
            } else if (res?.data?.data) {
              setHashtagTag(null);
              setResults({
                users: Array.isArray(res.data.data.users)
                  ? res.data.data.users
                  : [],
                posts: Array.isArray(res.data.data.posts)
                  ? res.data.data.posts
                  : [],
              });
            } else {
              setHashtagTag(null);
              setResults({ users: [], posts: [] });
            }
            setHasSearched(true);
          })
          .catch((error) => {
            console.error("Search error:", error);
            setHashtagTag(null);
            setResults({ users: [], posts: [] });
            setHasSearched(true);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setHashtagTag(null);
        setResults({ users: [], posts: [] });
        setHasSearched(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, activeFilter, saveRecentSearch]);

  const selectFilter = (filterKey) => {
    setActiveFilter(filterKey);
  };

  const handleChipPress = (text) => {
    setQuery(text);
  };

  // Render User Result Card
  const renderUserItem = (user) => (
    <TouchableOpacity
      key={user.id}
      activeOpacity={0.75}
      style={[
        styles.userCard,
        {
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)",
          borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        },
      ]}
      onPress={() =>
        navigation.push("ProfileScreen", { username: user.username })
      }
    >
      <AvatarFrameWrap theme={user.profile_theme} size={52}>
        <FastImage
          source={{
            uri: `https://api.chuyenbienhoa.com/v1.0/users/${user.username}/avatar`,
            priority: FastImage.priority.normal,
          }}
          style={styles.userAvatar}
        />
      </AvatarFrameWrap>
      <View style={styles.userInfo}>
        <View style={styles.nameBadgeRow}>
          <UserNameRow
            name={user.profile_name || user.username}
            theme={user.profile_theme}
            verified={!!user.verified}
            verifiedColor={theme.primary}
            style={[styles.userName, { color: theme.text }]}
          />
        </View>
        <StyledUsername
          theme={user.profile_theme}
          username={user.username}
          style={[styles.userUsername, { color: theme.subText }]}
          numberOfLines={1}
        />
        {user.bio ? (
          <Text style={[styles.userBio, { color: theme.subText }]} numberOfLines={1}>
            {user.bio}
          </Text>
        ) : null}
      </View>
      <View style={[styles.arrowCircle, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
        <Ionicons name="chevron-forward" size={16} color={theme.subText} />
      </View>
    </TouchableOpacity>
  );

  // Render Post Result Card
  const renderPostItem = (post) => (
    <TouchableOpacity
      key={post.id}
      activeOpacity={0.75}
      style={[
        styles.postCard,
        {
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)",
          borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        },
      ]}
      onPress={() => navigation.navigate("PostScreen", { postId: post.id })}
    >
      <View style={styles.postBody}>
        {post.image_urls && post.image_urls.length > 0 && (
          <FastImage
            source={{ uri: post.image_urls[0] }}
            style={styles.postThumb}
            resizeMode="cover"
          />
        )}
        <View style={styles.postInfo}>
          <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={2}>
            {post.title}
          </Text>
          <View style={styles.postMetaRow}>
            {post.author ? (
              <UserNameRow
                name={post.author?.profile_name || post.author?.username}
                theme={post.author?.profile_theme}
                style={[styles.postAuthorName, { color: theme.subText }]}
              />
            ) : null}
            <Text style={[styles.postDate, { color: theme.subText }]}>
              {post.author ? " • " : ""}{post.created_at ? formatTime(post.created_at) : ""}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const filterTabs = [
    { key: "all", label: t("search.all", "Tất cả"), icon: "apps-outline" },
    { key: "user", label: t("search.users", "Người dùng"), icon: "person-outline" },
    { key: "post", label: t("search.posts", "Bài viết"), icon: "document-text-outline" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Ambient Top Glow */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.45)", "rgba(10, 40, 20, 0.15)", "transparent"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.4)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.ambientGlow, { height: inset.top + 180 }]}
        pointerEvents="none"
      />

      {/* Header with Search Bar and Segmented Filter Tabs */}
      <View style={[styles.headerContainer, { paddingTop: inset.top + 6 }]}>
        <View style={styles.topRow}>
          <LiquidButton
            providerId="SearchScreen"
            onPress={() => navigation.goBack()}
            size={40}
            borderRadius={20}
          >
            <Ionicons name="chevron-back" color={theme.text} size={22} />
          </LiquidButton>

          {/* Plain Solid Pill Input Field (Matching Filter Pill styling without liquid glass) */}
          <View
            style={[
              styles.searchInputPill,
              {
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Ionicons name="search" size={18} color={theme.primary} style={{ marginLeft: 4 }} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t("search.placeholder", "Tìm kiếm trên CYO...")}
              placeholderTextColor={theme.subText}
              onChangeText={setQuery}
              value={query}
              returnKeyType="search"
              autoCapitalize="none"
              autoFocus={!route?.params?.initialQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Pills Carousel */}
        <View style={styles.filterPillsRow}>
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                onPress={() => selectFilter(tab.key)}
                style={[
                  styles.filterPill,
                  isActive
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      }
                    : {
                        backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                      },
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? "#FFFFFF" : theme.subText}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isActive ? "#FFFFFF" : theme.subText,
                      fontWeight: isActive ? "600" : "500",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content Area */}
      <AndroidGlassBackdrop providerId="SearchScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: inset.bottom + 30,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* STATE 1: Empty Query - Show Recent Searches & Trending Topics */}
          {!query.trim() ? (
            <View style={styles.emptyDiscoverWrap}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <View style={styles.discoverSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWithIcon}>
                      <Ionicons name="time-outline" size={17} color={theme.primary} />
                      <Text style={[styles.discoverSectionTitle, { color: theme.text }]}>
                        {t("search.recentSearches", "Tìm kiếm gần đây")}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={clearAllRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[styles.clearAllText, { color: theme.subText }]}>
                        {t("search.clearRecent", "Xóa lịch sử")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recentTagsWrap}>
                    {recentSearches.map((term, idx) => (
                      <View
                        key={`recent-${idx}`}
                        style={[
                          styles.recentTagChip,
                          {
                            backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                          },
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleChipPress(term)}
                          style={styles.recentTagPressable}
                        >
                          <Ionicons name="search-outline" size={13} color={theme.subText} style={{ marginRight: 6 }} />
                          <Text style={[styles.recentTagText, { color: theme.text }]} numberOfLines={1}>
                            {term}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeRecentSearch(term)}
                          style={styles.recentTagRemove}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close" size={14} color={theme.subText} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Trending / Suggested Topics fetched from Server */}
              {suggestedTopics.length > 0 && (
                <View style={styles.discoverSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWithIcon}>
                      <Ionicons name="trending-up-outline" size={17} color={theme.primary} />
                      <Text style={[styles.discoverSectionTitle, { color: theme.text }]}>
                        {t("search.popularTopics", "Chủ đề gợi ý")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.popularTagsGrid}>
                    {suggestedTopics.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.label}-${idx}`}
                        activeOpacity={0.75}
                        onPress={() => handleChipPress(item.label?.startsWith("#") ? item.label : `#${item.label}`)}
                        style={[
                          styles.suggestedChip,
                          {
                            backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.10)" : "rgba(34, 197, 94, 0.08)",
                            borderColor: isDarkMode ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.20)",
                          },
                        ]}
                      >
                        <Ionicons name={item.icon || "pricetag-outline"} size={14} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.suggestedChipText, { color: theme.primary }]}>
                          {item.label?.startsWith("#") ? item.label : `#${item.label}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Friendly Mascot Art & Prompt */}
              <View style={styles.emptyPromptCard}>
                <Image
                  source={require("../../../assets/search-main.png")}
                  style={styles.mascotArt}
                  resizeMode="contain"
                />
                <Text style={[styles.emptyPromptTitle, { color: theme.text }]}>
                  {t("search.emptySearchTitle", "Khám phá thế giới CYO")}
                </Text>
                <Text style={[styles.emptyPromptDesc, { color: theme.subText }]}>
                  {t("search.emptySearchDesc", "Nhập tên bạn bè, chủ đề yêu thích hoặc #hashtag để bắt đầu tìm kiếm.")}
                </Text>
              </View>
            </View>
          ) : loading ? (
            /* STATE 2: Loading */
            <View style={styles.statusCenterBox}>
              <CustomLoading />
              <Text style={[styles.statusLoadingText, { color: theme.subText }]}>
                {t("search.searching", "Đang tìm kiếm...")}
              </Text>
            </View>
          ) : hasSearched && !results.users?.length && !results.posts?.length ? (
            /* STATE 3: No Results */
            <View style={styles.noResultsBox}>
              <Image
                source={require("../../../assets/search-main.png")}
                style={styles.noResultsImg}
                resizeMode="contain"
              />
              <Text style={[styles.noResultsTitle, { color: theme.text }]}>
                {t("search.noResults", { query })}
              </Text>
              <Text style={[styles.noResultsSub, { color: theme.subText }]}>
                {t("search.hint", "Thử bắt đầu bằng cách tìm kiếm người dùng, bài viết, chủ đề...")}
              </Text>
            </View>
          ) : (
            /* STATE 4: Search Results */
            <View style={styles.resultsWrap}>
              {/* User Results Section */}
              {(activeFilter === "user" || (activeFilter === "all" && results.users?.length > 0)) && (
                <View style={styles.resultSection}>
                  <View style={styles.resultSectionHeader}>
                    <View style={styles.resultHeaderLeft}>
                      <Ionicons name="people" size={17} color={theme.primary} />
                      <Text style={[styles.resultSectionTitle, { color: theme.text }]}>
                        {t("search.users", "Người dùng")}
                      </Text>
                    </View>
                    {results.users?.length > 0 && (
                      <View style={[styles.countBadge, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                        <Text style={[styles.countBadgeText, { color: theme.subText }]}>
                          {results.users.length}
                        </Text>
                      </View>
                    )}
                  </View>

                  {results.users?.length > 0 ? (
                    <View style={styles.usersList}>
                      {results.users.map(renderUserItem)}
                    </View>
                  ) : (
                    activeFilter === "user" && (
                      <View style={styles.noSectionBox}>
                        <Ionicons name="person-circle-outline" size={44} color={theme.subText} />
                        <Text style={[styles.noSectionText, { color: theme.subText }]}>
                          {t("search.noUsersForQuery", { query })}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              )}

              {/* Post Results Section */}
              {(activeFilter === "all" || activeFilter === "post" || activeFilter === "hashtag") && (
                <View style={styles.resultSection}>
                  {(activeFilter === "post" || activeFilter === "hashtag" || (activeFilter === "all" && results.posts?.length > 0)) && (
                    <>
                      <View style={styles.resultSectionHeader}>
                        <View style={styles.resultHeaderLeft}>
                          <Ionicons name={hashtagTag ? "pricetag" : "newspaper"} size={17} color={theme.primary} />
                          <Text style={[styles.resultSectionTitle, { color: theme.text }]}>
                            {hashtagTag
                              ? t("search.hashtagResultsTitle", { tag: hashtagTag })
                              : t("search.posts", "Bài viết")}
                          </Text>
                        </View>
                        {results.posts?.length > 0 && (
                          <View style={[styles.countBadge, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                            <Text style={[styles.countBadgeText, { color: theme.subText }]}>
                              {results.posts.length}
                            </Text>
                          </View>
                        )}
                      </View>

                      {results.posts?.length > 0 ? (
                        <View style={styles.postsList}>
                          {results.posts.map(renderPostItem)}
                        </View>
                      ) : (
                        (activeFilter === "post" || activeFilter === "hashtag") && (
                          <View style={styles.noSectionBox}>
                            <Ionicons name="document-outline" size={44} color={theme.subText} />
                            <Text style={[styles.noSectionText, { color: theme.subText }]}>
                              {t("search.noPostsForQuery", { query })}
                            </Text>
                          </View>
                        )
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
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
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 12,
    minHeight: 42,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: Platform.OS === "android" ? 4 : 8,
    includeFontPadding: false,
  },
  clearBtn: {
    padding: 2,
    marginLeft: 4,
  },
  filterPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  emptyDiscoverWrap: {
    paddingTop: 8,
  },
  discoverSection: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  discoverSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: "500",
  },
  recentTagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentTagChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    maxWidth: SCREEN_WIDTH * 0.45,
  },
  recentTagPressable: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  recentTagText: {
    fontSize: 13,
    fontWeight: "500",
  },
  recentTagRemove: {
    padding: 3,
    marginLeft: 4,
  },
  popularTagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestedChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyPromptCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
    paddingBottom: 20,
  },
  mascotArt: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  emptyPromptTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyPromptDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 24,
  },
  statusCenterBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  statusLoadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "500",
  },
  noResultsBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  noResultsImg: {
    width: 130,
    height: 130,
    marginBottom: 16,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  noResultsSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  resultsWrap: {
    paddingTop: 4,
  },
  resultSection: {
    marginBottom: 20,
  },
  resultSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  resultHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  usersList: {
    gap: 8,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
  },
  userUsername: {
    fontSize: 13,
    marginTop: 1,
  },
  userBio: {
    fontSize: 12,
    marginTop: 3,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  postsList: {
    gap: 8,
  },
  postCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  postBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  postThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 12,
  },
  postInfo: {
    flex: 1,
    justifyContent: "center",
  },
  postTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  postAuthorName: {
    fontSize: 12,
  },
  postDate: {
    fontSize: 12,
  },
  noSectionBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noSectionText: {
    fontSize: 13,
    textAlign: "center",
  },
});
