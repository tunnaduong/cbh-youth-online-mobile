import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Image,
  TextInput,
  TouchableHighlight,
  ScrollView,
  Platform,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { searchQuery } from "../../../services/api/Api";
import FastImage from "react-native-fast-image";
import CustomLoading from "../../../components/CustomLoading";

export default function SearchScreen({ navigation }) {
  const inset = useSafeAreaInsets();
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
      style={styles.userItem}
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
        <Text style={styles.userName} numberOfLines={1}>
          {user.profile_name}
        </Text>
        <Text style={styles.userUsername} numberOfLines={1}>
          @{user.username}
        </Text>
        {user.bio && (
          <Text style={styles.userBio} numberOfLines={1}>
            {user.bio}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPostItem = (post) => (
    <TouchableOpacity
      key={post.id}
      style={styles.postItem}
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
        <Text style={styles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>
            {post.author.profile_name} • {post.created_at}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[
          styles.filterChip,
          activeFilter === "all" && styles.activeFilterChip,
        ]}
        onPress={() => setActiveFilter("all")}
      >
        <Text
          style={[
            styles.filterText,
            activeFilter === "all" && styles.activeFilterText,
          ]}
        >
          Tất cả
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          activeFilter === "user" && styles.activeFilterChip,
        ]}
        onPress={() => setActiveFilter("user")}
      >
        <Text
          style={[
            styles.filterText,
            activeFilter === "user" && styles.activeFilterText,
          ]}
        >
          Người dùng
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          activeFilter === "post" && styles.activeFilterChip,
        ]}
        onPress={() => setActiveFilter("post")}
      >
        <Text
          style={[
            styles.filterText,
            activeFilter === "post" && styles.activeFilterText,
          ]}
        >
          Bài viết
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        <View style={{ paddingTop: inset.top }}>
          <View style={styles.topBar}>
            <TouchableHighlight
              style={styles.backButton}
              underlayColor="rgba(0, 0, 0, .15)"
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back-outline" color="black" size={30} />
            </TouchableHighlight>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm trên CYO"
                placeholderTextColor="#999"
                onChangeText={setQuery}
                value={query}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setQuery("")}
                >
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {query.trim() && renderFilterChips()}

        <ScrollView style={styles.resultsContainer}>
          {!query.trim() ? (
            <View style={styles.searchImage}>
              <Image
                source={require("../../../assets/search-main.png")}
                style={styles.image}
              />
              <Text style={styles.searchPlaceholder}>
                Thử bắt đầu bằng cách tìm kiếm người dùng, bài viết, loa lớn...
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.centerContainer}>
              <CustomLoading />
              <Text style={styles.loadingText}>Đang tìm kiếm...</Text>
            </View>
          ) : hasSearched &&
            !results.users?.length &&
            !results.posts?.length ? (
            <View style={styles.noResults}>
              <Image
                source={require("../../../assets/sad_frog.png")}
                style={styles.noResultsImage}
              />
              <Text style={styles.noResultsText}>
                Không tìm thấy kết quả nào cho "{query}"
              </Text>
            </View>
          ) : (
            <>
              {(activeFilter === "user" ||
                (activeFilter === "all" && results.users?.length > 0)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Người dùng{" "}
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
                          <Text style={styles.sectionNoResultsText}>
                            Không tìm thấy người dùng nào cho "{query}"
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
                      <Text style={styles.sectionTitle}>
                        Bài viết{" "}
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
                              <Text style={styles.sectionNoResultsText}>
                                Không tìm thấy bài viết nào cho "{query}"
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
                    <Text style={styles.noResultsText}>
                      Không tìm thấy kết quả nào cho "{query}"
                    </Text>
                  </View>
                )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
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
    borderBottomColor: "#DFDEDD",
    minHeight: 55,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DFDEDD",
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
    minHeight: 40,
    includeFontPadding: false,
    textAlignVertical: "center",
    color: "#000",
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
    color: "gray",
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
    color: "#319527",
  },
  userItem: {
    flexDirection: "row",
    marginHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
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
    color: "#666",
  },
  userBio: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  postItem: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderBottomColor: "#f0f0f0",
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
    color: "#666",
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
    color: "#666",
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
    color: "#666",
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  activeFilterChip: {
    backgroundColor: "#319527",
  },
  filterText: {
    fontSize: 14,
    color: "#666",
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
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
});
