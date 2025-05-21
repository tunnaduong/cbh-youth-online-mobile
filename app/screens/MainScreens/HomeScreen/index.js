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
  Pressable,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  Switch,
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
import InstagramStories from "@birdwingo/react-native-instagram-stories";
import KeyboardSpacer from "react-native-keyboard-spacer";
import ActionSheet from "react-native-actions-sheet";

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
  const storyRef = useRef(null);
  const actionSheetRef = useRef(null);

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

  const handleStoryOptions = () => {
    storyRef?.current.pause(); // Pause the story timer
    actionSheetRef.current?.show();
  };

  const StoryOptionsModal = () => (
    <ActionSheet
      zIndex={999999}
      ref={actionSheetRef}
      containerStyle={{
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        paddingBottom: 30,
      }}
      indicatorStyle={{
        width: 30,
        height: 4,
        backgroundColor: "#404040",
        marginTop: 10,
      }}
      onClose={() => {
        storyRef?.current.resume(); // Resume story timer when sheet closes
      }}
      gestureEnabled={true}
    >
      <View className="py-2">
        <View className="flex-row items-center justify-between py-4 mx-5 border-b border-gray-100">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
              <Ionicons
                name="notifications-outline"
                size={23}
                color="#7F7F7F"
              />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 17 }}>Nhận tin của người này</Text>
              <Text className="text-gray-500 text-sm">
                Bật hoặc tắt tin mới của người này
              </Text>
            </View>
          </View>
          <Switch
            value={false}
            onValueChange={(value) => {
              actionSheetRef.current?.hide();
              Toast.show({
                type: "info",
                text1: value ? "Đã bật thông báo" : "Đã tắt thông báo",
                text2: value
                  ? "Bạn sẽ nhận được thông báo từ người này"
                  : "Bạn sẽ không nhận được thông báo từ người này",
              });
            }}
            trackColor={{ false: "#767577", true: "#319527" }}
          />
        </View>

        <TouchableOpacity
          onPress={() => {
            actionSheetRef.current?.hide();
            Toast.show({
              type: "info",
              text1: "Chia sẻ",
              text2: "Đã sao chép liên kết.",
            });
          }}
        >
          <View className="flex-row items-center py-4 mx-5 border-b border-gray-100">
            <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
              <Ionicons name="link-outline" size={23} color="#7F7F7F" />
            </View>
            <Text style={{ marginLeft: 12, fontSize: 17 }}>
              Sao chép liên kết để chia sẻ
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            actionSheetRef.current?.hide();
            Toast.show({
              type: "info",
              text1: "Đã gửi báo cáo!",
              text2: "Cảm ơn bạn đã báo cáo nội dung này.",
            });
          }}
        >
          <View className="flex-row items-center py-4 mx-5 border-b border-gray-100">
            <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
              <Ionicons name="warning-outline" size={23} color="#7F7F7F" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 17 }}>Báo cáo tin</Text>
              <Text className="text-gray-500 text-sm">
                Tin này chứa nội dung không phù hợp
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            actionSheetRef.current?.hide();
            Toast.show({
              type: "info",
              text1: "Bỏ theo dõi",
              text2: "Bạn đã bỏ theo dõi người này.",
            });
          }}
        >
          <View className="flex-row items-center py-4 mx-5">
            <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
              <Ionicons name="close-outline" size={23} />
            </View>
            <Text style={{ marginLeft: 12, fontSize: 17 }}>
              Bỏ theo dõi người này
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ActionSheet>
  );

  const StoryHeader = () => {
    return (
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <FastImage
            source={{
              uri: "https://api.chuyenbienhoa.com/v1.0/users/Admin/avatar",
            }}
            style={{
              width: 35,
              height: 35,
              borderRadius: 40,
              borderWidth: 1.5,
              borderColor: "#fff",
            }}
          />
          <Text
            className="text-white text-sm font-semibold"
            style={{
              textShadowColor: "rgba(0, 0, 0, 0.8)",
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 1.5,
            }}
          >
            CBH Youth Online
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={handleStoryOptions}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#c4c4c4" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => storyRef?.current.hide()}>
            <Ionicons name="close" size={24} color="#c4c4c4" />
          </TouchableOpacity>
        </View>
        <StoryOptionsModal />
        <Toast topOffset={-30} />
      </View>
    );
  };

  const storiesData = [
    {
      id: "Admin",
      name: "CBH Youth Online",
      avatarSource: {
        uri: "https://api.chuyenbienhoa.com/v1.0/users/Admin/avatar",
      }, // not shown, optional
      renderStoryHeader: () => <StoryHeader />,
      stories: [
        {
          id: "story1",
          source: {
            uri: "https://api.chuyenbienhoa.com/storage/images/1747810245_story.jpg",
          },
          renderFooter: () => <ReplyBar />,
        },
        {
          id: "story2",
          source: {
            uri: "https://api.chuyenbienhoa.com/storage/images/1747817059_Facebook post identity (1).jpg",
          },
          renderFooter: () => <ReplyBar />,
        },
      ],
    },
    {
      id: "customUser2",
      name: "Custom Name 2",
      avatarSource: { uri: "https://picsum.photos/200/200" }, // not shown, optional
      stories: [
        {
          id: "story1",
          source: { uri: "https://picsum.photos/600/800" },
        },
        {
          id: "story2",
          source: { uri: "https://picsum.photos/500/700" },
        },
      ],
    },
  ];

  const handleOpenStory = () => {
    storyRef.current?.show("Admin");
    // actionSheetRef.current?.show();
  };

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
            <TouchableOpacity key={story.id} onPress={handleOpenStory}>
              <View className="relative w-[100px] h-[160px] rounded-2xl overflow-hidden bg-gray-200 border border-[#c4c4c4]">
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
            </TouchableOpacity>
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

  const emojis = ["👍", "❤️", "🔥", "😆", "😮", "😢", "😡"];

  const FloatingEmoji = ({ emoji, onComplete }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const randomX = (Math.random() - 0.5) * 150; // Increased random range for wider spread

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -300, // Increased travel distance
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: randomX,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        onComplete();
      });
    }, []);

    return (
      <Animated.Text
        style={{
          position: "absolute",
          fontSize: 80, // Increased font size
          left: "50%",
          bottom: 200,
          marginLeft: -40, // Half of the emoji's approximate width
          transform: [{ translateY }, { translateX }, { scale }],
        }}
      >
        {emoji}
      </Animated.Text>
    );
  };

  const ReplyBar = () => {
    const [floatingEmojis, setFloatingEmojis] = useState([]);

    const handleEmojiPress = (emoji) => {
      if (emoji === "add") return;

      const id = Date.now();
      setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    };

    const handleAnimationComplete = (id) => {
      setFloatingEmojis((prev) => prev.filter((emoji) => emoji.id !== id));
    };

    return (
      <View style={{ flex: 1 }}>
        {floatingEmojis.map(({ id, emoji }) => (
          <FloatingEmoji
            key={id}
            emoji={emoji}
            onComplete={() => handleAnimationComplete(id)}
          />
        ))}
        <SafeAreaView>
          <View className="flex-row items-center gap-2 justify-center">
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => handleEmojiPress(emoji)}
              >
                <Text className="text-[40px]">{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.replyBar}>
            <TextInput
              placeholder="Chia sẻ cảm nghĩ của bạn..."
              placeholderTextColor="#aaa"
              style={styles.input}
            />
            <TouchableOpacity style={{ position: "absolute", right: 20 }}>
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <KeyboardSpacer />
      </View>
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

        <InstagramStories
          ref={storyRef}
          stories={storiesData}
          hideAvatarList={true}
          showName={false}
          textStyle={{
            color: "#fff",
            textShadowColor: "rgba(0, 0, 0, 0.8)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 1.5,
            fontWeight: "600",
          }}
          imageStyles={{
            marginTop: -20, // 👈 move image up by 20px
          }}
          progressColor="#c4c4c4"
          progressActiveColor="#319527"
          closeIconColor="#c4c4c4"
          modalAnimationDuration={300}
          storyAnimationDuration={300}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    height: 45,
    backgroundColor: "#666666",
    borderRadius: 25,
    paddingHorizontal: 15,
    color: "#A7A7A7",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    paddingVertical: 10,
  },
});

export default HomeScreen;
