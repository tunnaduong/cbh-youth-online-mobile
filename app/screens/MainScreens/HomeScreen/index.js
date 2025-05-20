import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Animated,
  TouchableOpacity,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getHomePosts, incrementPostView } from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { FeedContext } from "../../../contexts/FeedContext";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import FastImage from "react-native-fast-image";

const HomeScreen = ({ navigation, route }) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(2);
  const viewedPosts = React.useRef(new Set());
  const flatListRef = React.useRef(null);
  const { isLoggedIn } = useContext(AuthContext);
  const [username, setUsername] = React.useState("");
  const { feed, setFeed } = useContext(FeedContext);
  const lottieRef = useRef(null);

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
      setFeed(response.data.data); // Ensure this updates the feed with the latest votes
    } catch (error) {
      console.log("Error fetching newsfeed:", error);
      Toast.show({
        type: "error",
        text1: "Đã có lỗi xảy ra",
        text2: "Không thể tải bảng tin. Vui lòng thử lại sau.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
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
        <View
          style={{
            marginTop: 20,
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LottieView
            source={require("../../../assets/refresh.json")}
            style={{
              width: 40,
              height: 40,
            }}
            loop
            autoPlay
          />
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
        <ScrollView
          style={{
            borderBottomWidth: 10,
            borderBottomColor: "#E6E6E6",
            padding: 15,
            backgroundColor: "white",
          }}
          contentContainerStyle={{ gap: 10, paddingRight: 15 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {/* Story like Facebook component */}
          <View className="relative overflow-hidden rounded-2xl bg-gray-200 w-[100px] h-[160px] border border-[#c4c4c4]">
            <FastImage
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

  const handleScroll = (event) => {
    if (!refreshing) {
      lottieRef.current?.play(); // Play up to the calculated frame
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    setCurrentPage(2);
    viewedPosts.current = new Set(); // Reset viewed posts

    // Play the Lottie animation in a loop
    lottieRef.current?.play();

    handleFetchFeed().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    });
  };

  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

  return feed == null ? (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        flex: 1,
      }}
    >
      <LottieView
        source={require("../../../assets/refresh.json")}
        style={{
          width: 70,
          height: 70,
        }}
        loop
        autoPlay
      />
      <Text style={{ marginTop: 15 }}>Đang tải bảng tin...</Text>
    </View>
  ) : (
    <>
      <View style={{ backgroundColor: "white", flex: 1 }}>
        <AnimatedLottieView
          source={require("../../../assets/refresh.json")}
          style={{
            width: 40,
            height: 40,
            position: "absolute",
            top: 5,
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
          ref={lottieRef}
          // progress={refreshing ? undefined : lottieProgress} // Use progress only when not refreshing
          // loop={refreshing}
        />
        <FlatList
          onScroll={handleScroll}
          ref={flatListRef}
          showsVerticalScrollIndicator={false}
          data={feed}
          keyExtractor={(item, index) => `key-${item.id + "-" + index}`}
          contentContainerStyle={{
            paddingBottom: 30,
            backgroundColor: "white",
          }}
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
            <RefreshControl
              tintColor="transparent"
              colors={["transparent"]}
              style={{ backgroundColor: "transparent" }}
              refreshing={refreshing}
              onRefresh={handleRefresh}
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
