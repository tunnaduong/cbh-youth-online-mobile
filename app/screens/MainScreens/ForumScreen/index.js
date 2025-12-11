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
} from "react-native";
import FastImage from "react-native-fast-image";
import { AuthContext } from "../../../contexts/AuthContext";
import { getForumCategories } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

const { width } = Dimensions.get("window");

const ForumSection = ({ section, navigation }) => (
  <View style={styles.sectionBox}>
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("CategoryScreen", { categoryId: section.id })
      }
    >
      <Text style={styles.sectionTitle}>{section.name}</Text>
      <View style={styles.sectionStats}>
        <Text style={styles.statText}>
          Bài viết: <Text style={styles.statBold}>{section.post_count}</Text>
        </Text>
        <Text style={styles.statText}>
          Bình luận:{" "}
          <Text style={styles.statBold}>{section.comment_count}</Text>
        </Text>
      </View>
    </TouchableOpacity>
    <View style={styles.latestBox}>
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
              <Text style={styles.latestLabel}>Mới nhất</Text>
              <Text style={styles.latestTime}>
                {section.latest_post.created_at}
              </Text>
            </View>
            <Text style={styles.latestContent}>
              <Text style={styles.latestAuthor}>
                {section.latest_post.user.name}:
              </Text>{" "}
              {section.latest_post.title}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.latestLabel}>Chưa có bài viết mới</Text>
      )}
    </View>
  </View>
);

export default function ForumScreen({ navigation }) {
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
    const tabWidth = 180; // Approximate width of each tab
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
          { flex: 1, backgroundColor: "#fff" },
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Diễn đàn</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProfileScreen", { username })}
          >
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <CustomLoading />
          <Text style={{ marginTop: 15 }}>Đang tải diễn đàn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: "#fff" }, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Diễn đàn</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("MemberRankingScreen")}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="trophy-outline" size={26} color="#319527" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("ProfileScreen", { username })}
        >
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
            }}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
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
                activeCategory === cat.id && styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
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
              // Sync tab scroll while dragging
              const offsetX = event.nativeEvent.contentOffset.x;
              const index = offsetX / width;
              handleTabScroll(index);
            },
          }
        )}
        onMomentumScrollEnd={handlePageChange}
        keyExtractor={(item) => `category-${item.id}`}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                backgroundColor: "white",
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
    color: "#319527",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fff",
  },
  tabContainer: {
    height: 45,
    marginTop: 10,
    // marginBottom: 10,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F3FDF1",
    marginRight: 7,
    height: 35,
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#C7F0C2",
  },
  tabText: {
    color: "#222",
    fontWeight: "500",
    fontSize: 15,
  },
  tabTextActive: {
    color: "#319527",
    fontWeight: "bold",
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: "#319527",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#319527",
    marginBottom: 6,
  },
  sectionStats: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 18,
  },
  statText: {
    fontSize: 14,
    color: "#222",
  },
  statBold: {
    fontWeight: "bold",
    color: "#222",
  },
  latestBox: {
    backgroundColor: "#F3FDF1",
    borderRadius: 6,
    padding: 8,
    marginTop: 2,
  },
  latestLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "bold",
    marginBottom: 2,
  },
  latestContent: {
    fontSize: 14,
    color: "#222",
    marginBottom: 2,
  },
  latestAuthor: {
    fontWeight: "bold",
    color: "#319527",
  },
  latestTime: {
    fontSize: 12,
    color: "#888",
    marginLeft: "auto",
  },
});
