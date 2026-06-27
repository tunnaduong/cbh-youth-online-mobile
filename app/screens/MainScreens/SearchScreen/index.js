import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TextInput,
  TouchableHighlight,
  ScrollView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { searchQuery } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import CustomLoading from "../../../components/CustomLoading";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";

export default function SearchScreen({ navigation }) {
  const inset = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
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
            {post.author.profile_name} • {post.created_at ? formatTime(post.created_at) : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        <View style={{ paddingTop: inset.top }}>
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <TouchableHighlight
              style={styles.backButton}
              underlayColor={isDarkMode ? "rgba(255, 255, 255, .1)" : "rgba(0, 0, 0, .05)"}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back-outline" color={theme.text} size={30} />
            </TouchableHighlight>
            <View style={[styles.searchInputContainer, { backgroundColor: isDarkMode ? "#374151" : "#DFDEDD" }]}>
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
                  <Ionicons name="close-circle" size={20} color={theme.subText} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {query.trim() && renderFilterChips()}

        <ScrollView style={styles.resultsContainer} contentContainerStyle={{ paddingBottom: inset.bottom + 16 }}>
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
                source={require("../../../assets/sad_frog.png")}
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
                            source={require("../../../assets/sad_frog.png")}
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
                                source={require("../../../assets/sad_frog.png")}
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
                      source={require("../../../assets/sad_frog.png")}
                      style={styles.noResultsImage}
                    />
                    <Text style={[styles.noResultsText, { color: theme.subText }]}>
                      {t('search.noResults', { query })}
                    </Text>
                  </View>
                )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    backgroundColor: "rgba(0, 0, 0, 0)",
    width: 40,
    height: 40,
    borderRadius: 35,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 20,
    paddingBottom: 7,
    paddingTop: 10,
    borderBottomWidth: 1,
    minHeight: 55,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 50,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === "android" ? 0 : 4,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    paddingLeft: 8,
    paddingRight: 35,
    paddingVertical: 0,
    minHeight: 30,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  clearButton: {
    padding: 5,
    position: "absolute",
    right: 5,
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
    paddingVertical: 8,
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
