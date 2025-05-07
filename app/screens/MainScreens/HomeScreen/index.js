import React, { useCallback, useContext, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  Animated,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getHomePosts, incrementPostView } from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { FeedContext } from "../../../contexts/FeedContext";
import CustomRefreshControl from "../../../components/CustomRefreshControl";

const HomeScreen = ({ navigation, route }) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(2);
  const viewedPosts = React.useRef(new Set());
  const flatListRef = React.useRef(null);
  const { isLoggedIn } = useContext(AuthContext);
  const [username, setUsername] = React.useState("");
  const { feed, setFeed } = useContext(FeedContext);
  const scrollY = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!isLoggedIn) {
      // Reset feed state when the user signs out
      setFeed(null);
      setRefreshing(false);
      setHasMore(true);
      setCurrentPage(2);
      viewedPosts.current = new Set();
    }

    async function fetchUserInfo() {
      const userInfo = await AsyncStorage.getItem("user_info");
      if (userInfo) {
        const parsedUserInfo = JSON.parse(userInfo);
        setUsername(parsedUserInfo.username);
      }
    }

    fetchUserInfo();
  }, [isLoggedIn]);

  const handleFetchFeed = async (page = 1) => {
    try {
      const response = await getHomePosts(page);
      setFeed(response.data.data);
    } catch (error) {
      console.error("Error fetching newsfeed:", error);
    } finally {
      setLoading(false); // ❗ End initial loading
      setRefreshing(false); // ❗ End pull-to-refresh
    }
  };

  React.useEffect(() => {
    handleFetchFeed();
  }, []);

  const onEndReached = () => {
    if (!hasMore) return;

    getHomePosts(currentPage).then((response) => {
      if (response.data.data.length === 0) {
        setHasMore(false);
        return;
      }
      setFeed((prevData) => {
        return [...prevData, ...response.data.data];
      });
      setCurrentPage((prevPage) => prevPage + 1);
    });
  };

  const ListEndLoader = () => {
    if (hasMore) {
      return (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator />
        </View>
      );
    }
  };

  const handleExpandPost = (index) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated: false,
      });
    }
  };

  const handleVoteUpdate = (postId, newVotes) => {
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, votes: newVotes } : post
      )
    );
  };

  const handleSaveUpdate = (postId, savedStatus) => {
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, saved: savedStatus } : post
      )
    );
  };

  const handleViewableItemsChanged = ({ viewableItems }) => {
    viewableItems.forEach((viewableItem) => {
      const postId = viewableItem.item.id;

      if (!viewedPosts.current.has(postId)) {
        viewedPosts.current.add(postId); // Mark as viewed
        increasePostView(postId); // Call API
      }
    });
  };

  const increasePostView = async (postId) => {
    try {
      await incrementPostView(postId);
    } catch (error) {
      console.error("Failed to increase view:", error);
    }
  };

  const stories = [
    {
      id: 1,
      title: "CBH Youth Online",
      image: require("../../../assets/story.jpg"), // local image
      avatar: "https://api.chuyenbienhoa.com/v1.0/users/Admin/avatar",
    },
    {
      id: 2,
      title: "Hoàng Phát",
      image: "https://picsum.photos/100/160", // remote image
      avatar: "https://api.chuyenbienhoa.com/v1.0/users/hoangphat/avatar",
    },
    {
      id: 3,
      title: "Dương Tùng Anh",
      image: "https://picsum.photos/id/10/100/160", // remote image
      avatar: "https://api.chuyenbienhoa.com/v1.0/users/tunna/avatar",
    },
  ];

  const ListHeader = () => {
    return (
      <>
        <CustomRefreshControl refreshing={refreshing} />
        <ScrollView
          style={{
            borderBottomWidth: 10,
            borderBottomColor: "#E6E6E6",
            padding: 15,
          }}
          contentContainerStyle={{ gap: 10, paddingRight: 15 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {/* Story like Facebook component */}
          <View className="relative overflow-hidden rounded-2xl bg-gray-200 w-[100px] h-[160px] border border-[#c4c4c4]">
            <Image
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={{ width: 100, height: 115 }}
            />
            <View className="absolute bottom-0 left-0 right-0 bg-[#fafafa] pt-6 pb-2 text-center">
              <Text className="text-[13px] font-medium text-center">
                Tạo tin
              </Text>
            </View>
            <View className="absolute bottom-[28px] left-[31px] bg-[#fafafa] rounded-full">
              <Ionicons name="add-circle" size={40} color={"#319527"} />
            </View>
          </View>
          {stories.map((story) => (
            <View
              key={story.id}
              className="relative w-[100px] h-[160px] rounded-2xl overflow-hidden bg-gray-200 border border-[#c4c4c4]"
            >
              {/* Story Image */}
              {typeof story.image === "string" ? (
                <Image
                  source={{ uri: story.image }}
                  style={{ width: 100, height: 160 }}
                />
              ) : (
                <Image
                  source={story.image}
                  style={{ width: 100, height: 160 }}
                />
              )}

              {/* Avatar */}
              <View className="absolute top-2 left-2">
                <View className="rounded-full p-0.5 border-2 border-[#319528]">
                  <View className="w-6 h-6 rounded-full overflow-hidden">
                    <Image
                      source={{ uri: story.avatar }}
                      style={{ width: 24, height: 24 }}
                    />
                  </View>
                </View>
              </View>

              {/* Gradient + Title */}
              <View className="absolute bottom-0 left-0 right-0 h-14 justify-end">
                <LinearGradient
                  colors={["black", "transparent"]}
                  start={{ x: 0.5, y: 1 }}
                  end={{ x: 0.5, y: 0 }}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: 130,
                    bottom: -90,
                  }}
                />
                <Text
                  numberOfLines={2}
                  className="text-[13px] font-semibold text-white p-1.5"
                  style={{
                    textShadowColor: "rgba(0, 0, 0, 0.8)",
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 2,
                  }}
                >
                  {story.title}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </>
    );
  };

  return feed == null ? (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        flex: 1,
      }}
    >
      <ActivityIndicator size={"large"} color="#636568" />
      <Text style={{ marginTop: 15 }}>Đang tải bảng tin...</Text>
    </View>
  ) : (
    <>
      <View style={{ backgroundColor: "white", flex: 1 }}>
        <Animated.FlatList
          ref={flatListRef}
          showsVerticalScrollIndicator={false}
          data={feed}
          keyExtractor={(item, index) => `key-${item.id + "-" + index}`}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item, index }) => (
            <PostItem
              item={item}
              onExpand={() => handleExpandPost(index)}
              onVoteUpdate={handleVoteUpdate}
              onSaveUpdate={handleSaveUpdate}
              navigation={navigation}
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          refreshControl={
            <CustomRefreshControl
              scrollY={scrollY}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                handleFetchFeed();
                setHasMore(true);
                setCurrentPage(2);
                viewedPosts.current = new Set(); // Reset viewed posts
              }}
            />
          }
          ListFooterComponent={ListEndLoader}
          ListHeaderComponent={ListHeader}
        />
      </View>
    </>
  );
};

export default HomeScreen;
