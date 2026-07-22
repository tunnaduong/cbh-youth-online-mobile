import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { searchQuery } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import CustomLoading from "../../../components/CustomLoading";
import LiquidButton from "../../../components/LiquidButton";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";

export default function SearchScreen({ navigation }) {
  const inset = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "user", "post"

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        setLoading(true);
        setHasSearched(false);
        searchQuery(query, activeFilter)
          .then((res) => {
            if (res?.data?.data) {
              const searchData = {
                users: Array.isArray(res.data.data.users)
                  ? res.data.data.users
                  : [],
                posts: Array.isArray(res.data.data.posts)
                  ? res.data.data.posts
                  : [],
              };
              setResults(searchData);
            } else {
              setResults({ users: [], posts: [] });
            }
            setHasSearched(true);
          })
          .catch((error) => {
            console.error("Search error:", error);
            setResults({ users: [], posts: [] });
            setHasSearched(true);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setResults({ users: [], posts: [] });
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, activeFilter]); // Add activeFilter to dependencies

  const renderUserItem = (user) => (
    <TouchableOpacity
      key={user.id}
      style={[styles.userItem, { borderBottomColor: theme.border }]}
      onPress={() =>
        navigation.push("ProfileScreen", { username: user.username })
      }
    >
      <FastImage
        source={{
          uri: `https://api.chuyenbienhoa.com/v1.0/users/${user.username}/avatar`,
          priority: FastImage.priority.normal,
        }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
          {user.profile_name}
        </Text>
        <Text style={[styles.userUsername, { color: theme.subText }]} numberOfLines={1}>
          @{user.username}
        </Text>
        {user.bio && (
          <Text style={[styles.userBio, { color: theme.subText }]} numberOfLines={1}>
            {user.bio}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPostItem = (post) => (
    <TouchableOpacity
      key={post.id}
      style={[styles.postItem, { borderBottomColor: theme.border }]}
      onPress={() => navigation.navigate("PostScreen", { postId: post.id })}
    >
      {post.image_urls && post.image_urls.length > 0 && (
        <FastImage
          source={{
            uri: post.image_urls[0],
          }}
          style={styles.postImage}
        />
      )}
      <View style={styles.postContent}>
        <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.postMeta}>
          <Text style={[styles.postAuthor, { color: theme.subText }]}>
            {post.author.profile_name} • {post.created_at ? formatTime(post.created_at) : ""}{post.is_edited ? ` (${t('post.edited')})` : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const renderFilterChips = () => (
    <View style={[styles.filterContainer, { borderBottomColor: theme.border }]}>
      <TouchableOpacity
        style={[
          styles.filterChip,
          { backgroundColor: isDarkMode ? "#374151" : "#f0f0f0" },
          activeFilter === "all" && { backgroundColor: theme.primary },
        ]}
        onPress={() => setActiveFilter("all")}
      >
        <Text
          style={[
            styles.filterText,
            { color: theme.subText },
            activeFilter === "all" && styles.activeFilterText,
          ]}
        >
          {t('search.all')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          { backgroundColor: isDarkMode ? "#374151" : "#f0f0f0" },
          activeFilter === "user" && { backgroundColor: theme.primary },
        ]}
        onPress={() => setActiveFilter("user")}
      >
        <Text
          style={[
            styles.filterText,
            { color: theme.subText },
            activeFilter === "user" && styles.activeFilterText,
          ]}
        >
          {t('search.users')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          { backgroundColor: isDarkMode ? "#374151" : "#f0f0f0" },
          activeFilter === "post" && { backgroundColor: theme.primary },
        ]}
        onPress={() => setActiveFilter("post")}
      >
        <Text
          style={[
            styles.filterText,
            { color: theme.subText },
            activeFilter === "post" && styles.activeFilterText,
          ]}
        >
          {t('search.posts')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Animated.View
        style={[
          styles.headerShell,
          {
            paddingTop: inset.top,
            borderBottomColor: isHeaderElevated ? theme.border : "transparent",
            borderBottomWidth: isHeaderElevated ? 1 : 0,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.headerBackdrop,
            {
              opacity: headerBgOpacity,
              backgroundColor: isDarkMode ? "rgba(12, 12, 12, 0.72)" : "rgba(255, 255, 255, 0.76)",
            },
          ]}
        />

        <View style={styles.topBar}>
          <LiquidButton
            providerId="SearchScreen"
            onPress={() => navigation.goBack()}
            scrollY={scrollY}
            alwaysBorder
            size={36}
            style={{ marginLeft: 10 }}
            borderRadius={18}
          >
            <Ionicons name="chevron-back-outline" color={theme.text} size={22} />
          </LiquidButton>
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
                borderWidth: 1,
              },
            ]}
          >
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t('search.placeholder')}
              placeholderTextColor={theme.subText}
              onChangeText={setQuery}
              value={query}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setQuery("")}
              >
                <Ionicons name="close-circle" size={16} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ opacity: isHeaderElevated ? 0 : 1 }} pointerEvents={isHeaderElevated ? "none" : "auto"}>
          {renderFilterChips()}
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={{ paddingTop: 110 + inset.top, paddingBottom: inset.bottom + 16 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (event) => setIsHeaderElevated(event.nativeEvent.contentOffset.y > 4),
          }
        )}
        scrollEventThrottle={16}
      >
          {!query.trim() ? (
            <View style={styles.searchImage}>
              <Image
                source={require("../../../assets/search-main.png")}
                style={styles.image}
              />
              <Text style={[styles.searchPlaceholder, { color: theme.subText }]}>
                {t('search.hint')}
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.centerContainer}>
              <CustomLoading />
              <Text style={[styles.loadingText, { color: theme.subText }]}>{t('search.searching')}</Text>
            </View>
          ) : hasSearched &&
            !results.users?.length &&
            !results.posts?.length ? (
            <View style={styles.noResults}>
              <Image
                source={require("../../../assets/search-main.png")}
                style={styles.noResultsImage}
              />
              <Text style={[styles.noResultsText, { color: theme.subText }]}>
                {t('search.noResults', { query })}
              </Text>
            </View>
          ) : (
            <>
              {(activeFilter === "user" ||
                (activeFilter === "all" && results.users?.length > 0)) && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.primary }]}>
                      {t('search.users')}{" "}
                      {results.users?.length > 0 && `(${results.users.length})`}
                    </Text>
                    {results.users?.length > 0
                      ? results.users.map(renderUserItem)
                      : activeFilter === "user" && (
                        <View style={styles.sectionNoResults}>
                          <Image
                            source={require("../../../assets/search-main.png")}
                            style={styles.sectionNoResultsImage}
                          />
                          <Text style={[styles.sectionNoResultsText, { color: theme.subText }]}>
                            {t('search.noUsersForQuery', { query })}
                          </Text>
                        </View>
                      )}
                  </View>
                )}
              {(activeFilter === "all" || activeFilter === "post") && (
                <View style={styles.section}>
                  {(activeFilter === "post" ||
                    (activeFilter === "all" && results.posts?.length > 0)) && (
                      <>
                        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
                          {t('search.posts')}{" "}
                          {results.posts?.length > 0 &&
                            `(${results.posts.length})`}
                        </Text>
                        {results.posts?.length > 0
                          ? results.posts.map(renderPostItem)
                          : activeFilter === "post" && (
                            <View style={styles.sectionNoResults}>
                              <Image
                                source={require("../../../assets/search-main.png")}
                                style={styles.sectionNoResultsImage}
                              />
                              <Text style={[styles.sectionNoResultsText, { color: theme.subText }]}>
                                {t('search.noPostsForQuery', { query })}
                              </Text>
                            </View>
                          )}
                      </>
                    )}
                </View>
              )}
              {activeFilter === "all" &&
                !results.users?.length &&
                !results.posts?.length && (
                  <View style={styles.noResults}>
                    <Image
                      source={require("../../../assets/search-main.png")}
                      style={styles.noResultsImage}
                    />
                    <Text style={[styles.noResultsText, { color: theme.subText }]}>
                      {t('search.noResults', { query })}
                    </Text>
                  </View>
                )}
            </>
          )}
        </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
  headerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingBottom: 6,
    paddingTop: 6,
    minHeight: 46,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "android" ? 0 : 2,
    minHeight: 34,
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingLeft: 4,
    paddingRight: 28,
    paddingVertical: 0,
    minHeight: 26,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  clearButton: {
    padding: 3,
    position: "absolute",
    right: 4,
  },
  loadingIndicator: {
    paddingRight: 10,
  },
  searchImage: {
    height: Dimensions.get("window").height * 0.5,
    margin: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 200,
    height: 200,
    resizeMode: "contain",
  },
  searchPlaceholder: {
    textAlign: "center",
    fontSize: 16,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  section: {
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userItem: {
    flexDirection: "row",
    marginHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userUsername: {
    fontSize: 14,
  },
  userBio: {
    fontSize: 14,
    marginTop: 2,
  },
  postItem: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 16,
    paddingVertical: 10,
  },
  postContent: {
    flex: 1,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  postMeta: {
    flexDirection: "row",
    marginTop: 4,
  },
  postAuthor: {
    fontSize: 14,
  },
  postImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  noResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  noResultsImage: {
    width: 100,
    height: 100,
    resizeMode: "contain",
  },
  noResultsText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 14,
  },
  activeFilterText: {
    color: "#fff",
    fontWeight: "500",
  },
  sectionNoResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  sectionNoResultsImage: {
    width: 70,
    height: 70,
    resizeMode: "contain",
  },
  sectionNoResultsText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
