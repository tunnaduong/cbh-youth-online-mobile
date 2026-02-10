import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  RefreshControl,
  Animated,
  FlatList,
  Dimensions,
  StatusBar,
} from "react-native";
import FastImage from "react-native-fast-image";
import { AuthContext } from "../../../contexts/AuthContext";
import { getForumCategories } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../../contexts/ThemeContext";

const { width } = Dimensions.get("window");

const ForumSection = ({ section, navigation, theme, isDarkMode }) => (
  <View style={[styles.sectionBox, { borderColor: theme.primary, backgroundColor: theme.cardBackground, shadowColor: isDarkMode ? "#000" : theme.primary }]}>
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("CategoryScreen", { categoryId: section.id })
      }
    >
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{section.name}</Text>
      <View style={styles.sectionStats}>
        <Text style={[styles.statText, { color: theme.text }]}>
          Bài viết: <Text style={[styles.statBold, { color: theme.text }]}>{section.post_count}</Text>
        </Text>
        <Text style={[styles.statText, { color: theme.text }]}>
          Bình luận:{" "}
          <Text style={[styles.statBold, { color: theme.text }]}>{section.comment_count}</Text>
        </Text>
      </View>
    </TouchableOpacity>
    <View style={[styles.latestBox, { backgroundColor: isDarkMode ? "#1e2e1c" : "#F3FDF1" }]}>
      {section.latest_post ? (
        <>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("PostScreen", {
                postId: section.latest_post.id,
              })
            }
          >
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={[styles.latestLabel, { color: theme.subText }]}>Mới nhất</Text>
              <Text style={[styles.latestTime, { color: theme.subText }]}>
                {section.latest_post.created_at}
              </Text>
            </View>
            <Text style={[styles.latestContent, { color: theme.text }]}>
              <Text style={[styles.latestAuthor, { color: theme.primary }]}>
                {section.latest_post.user.name}:
              </Text>{" "}
              {section.latest_post.title}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[styles.latestLabel, { color: theme.subText }]}>Chưa có bài viết mới</Text>
      )}
    </View>
  </View>
);

export default function ForumScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [activeCategory, setActiveCategory] = useState(1);
  const { username } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forumSections, setForumSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const lottieRef = useRef(null);
  const flatListRef = useRef(null);
  const tabScrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);
  const insets = useSafeAreaInsets();

  const handleTabScroll = (index) => {
    const tabWidth = 180;
    const scrollPosition = Math.max(0, (index + 1) * tabWidth - width);
    tabScrollViewRef.current?.scrollTo({ x: scrollPosition, animated: true });
  };

  const handleScroll = (event) => {
    if (!refreshing) {
      lottieRef.current?.play();
    }
  };

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
      const response = await getForumCategories();
      setCategories(response.data);
      setLoading(false);
    } catch (error) {
      console.log(error);
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
      <SafeAreaView
        style={[
          { flex: 1, backgroundColor: theme.background },
          { paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>Diễn đàn</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProfileScreen", { username })}
          >
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={[styles.avatar, { borderColor: theme.border }]}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}
        >
          <CustomLoading />
          <Text style={{ marginTop: 15, color: theme.text }}>Đang tải diễn đàn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.background }, { paddingTop: insets.top }]}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Diễn đàn</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("MemberRankingScreen")}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="trophy-outline" size={26} color={theme.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("ProfileScreen", { username })}
        >
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
            }}
            style={[styles.avatar, { borderColor: theme.border }]}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.background }]}>
        <ScrollView
          ref={tabScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
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
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <AnimatedLottieView
        source={require("../../../assets/refresh.json")}
        style={{
          width: 40,
          height: 40,
          position: "absolute",
          zIndex: 0,
          alignSelf: "center",
          top: 50 + insets.top + 10 + 45,
        }}
        ref={lottieRef}
      />

      <FlatList
        ref={flatListRef}
        data={categories}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
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
        renderItem={({ item }) => (
          <View style={{ width, backgroundColor: theme.background }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                backgroundColor: theme.background,
                paddingHorizontal: 16,
                paddingBottom: 20,
                paddingTop: 5,
              }}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="transparent"
                  colors={["transparent"]}
                  style={{ backgroundColor: "transparent" }}
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
                />
              ))}
            </ScrollView>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    height: 50,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
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
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 6,
  },
  sectionStats: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 18,
  },
  statText: {
    fontSize: 14,
  },
  statBold: {
    fontWeight: "bold",
  },
  latestBox: {
    borderRadius: 6,
    padding: 8,
    marginTop: 2,
  },
  latestLabel: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 2,
  },
  latestContent: {
    fontSize: 14,
    marginBottom: 2,
  },
  latestAuthor: {
    fontWeight: "bold",
  },
  latestTime: {
    fontSize: 12,
    marginLeft: "auto",
  },
});
