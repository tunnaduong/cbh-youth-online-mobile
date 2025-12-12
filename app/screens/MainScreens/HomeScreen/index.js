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
  TouchableHighlight,
  Platform,
  AppState,
  Alert,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  getHomePosts,
  getStories,
  incrementPostView,
  resendVerificationEmail,
  reactToStory,
  removeStoryReaction,
  replyToStory,
  getStoryViewers,
  markStoryAsViewed,
  blockUser,
  reportUser,
} from "../../../services/api/Api";
import ReportModal from "../../../components/ReportModal";
import formatTime from "../../../utils/formatTime";
import PostItem from "../../../components/PostItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { FeedContext } from "../../../contexts/FeedContext";
import { useStatusBar } from "../../../contexts/StatusBarContext";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import FastImage from "react-native-fast-image";
import InstagramStories from "@birdwingo/react-native-instagram-stories";
import KeyboardSpacer from "react-native-keyboard-spacer";
import ActionSheet from "react-native-actions-sheet";

const HomeScreen = ({ navigation, route, scrollTriggerRef }) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(2);
  const viewedPosts = React.useRef(new Set());
  const flatListRef = React.useRef(null);
  const { feed, setFeed } = useContext(FeedContext);
  const lottieRef = useRef(null);
  const storyRef = useRef(null);
  const actionSheetRef = useRef(null);
  const [userStories, setUserStories] = useState([]);
  const [currentStory, setCurrentStory] = useState(null);
  const [currentStoryUser, setCurrentStoryUser] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const {
    username,
    isLoggedIn,
    emailVerifiedAt,
    userInfo,
    updateEmailVerificationStatus,
    refreshUserInfo,
    blockedUsers,
  } = useContext(AuthContext);
  const { updateStatusBar, barStyle, backgroundColor } = useStatusBar();
  const previousStatusBarStyle = useRef({
    barStyle: "dark-content",
    backgroundColor: "#ffffff",
  });
  const [verificationModalVisible, setVerificationModalVisible] =
    useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const scrollPositionRef = useRef(0);
  const isScrollingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);

  React.useEffect(() => {
    if (!isLoggedIn) {
      // Reset feed state when the user signs out
      setFeed(null);
      setRefreshing(false);
      setHasMore(true);
      setCurrentPage(2);
      viewedPosts.current = new Set();
    }
  }, [isLoggedIn]);

  // Add effect to handle refresh trigger from story creation
  useEffect(() => {
    if (route.params?.refresh) {
      fetchStories();
    }
  }, [route.params?.refresh]);

  // Handle story highlighting from notifications
  useEffect(() => {
    if (route.params?.highlightStoryId && userStories.length > 0) {
      // Find the user and story to highlight
      const storyToHighlight = route.params.highlightStoryId;
      const userWithStory = userStories.find((user) =>
        user.stories.some((story) => story.storyId === storyToHighlight)
      );
      if (userWithStory) {
        // Open the story viewer for that user
        setTimeout(() => {
          storyRef.current?.show(userWithStory.id);
        }, 500);
      }
    }
  }, [route.params?.highlightStoryId, userStories]);

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

  const handleStoryOptions = () => {
    storyRef?.current.pause(); // Pause the story timer
    actionSheetRef.current?.show();
  };

  const handleStoryShow = (userId) => {
    // Save current status bar style
    previousStatusBarStyle.current = { barStyle, backgroundColor };
    // Change to light content (white text) for dark background
    updateStatusBar("light-content", "#000000");
  };

  const handleStoryStart = async (userId, storyId) => {
    // Mark story as viewed when story starts
    if (storyId) {
      try {
        await markStoryAsViewed(storyId);
      } catch (error) {
        // Silently fail - don't show error to user
        console.error("Failed to mark story as viewed:", error);
      }
    }
  };

  const handleStoryHide = () => {
    // Restore previous status bar style
    updateStatusBar(
      previousStatusBarStyle.current.barStyle,
      previousStatusBarStyle.current.backgroundColor
    );
  };

  const dismissStoryModal = () => {
    // Method to dismiss story modal
    if (storyRef.current && typeof storyRef.current.hide === "function") {
      storyRef.current.hide();
    }
  };

  const handleReportSubmit = async (reason) => {
    try {
      if (!currentStoryUser) return;
      await reportUser({ story_id: currentStory, reported_user_id: currentStoryUser.uid || currentStoryUser.id, reason });
      Toast.show({
        type: "success",
        text1: "Đã gửi báo cáo",
        text2: "Cảm ơn bạn đã báo cáo nội dung này.",
        topOffset: 60,
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: e.message || "Không thể gửi báo cáo",
        topOffset: 60,
      });
    }
  };

  const handleBlockUser = () => {
    // Use Alert from React Native (need import, but might rely on Toast or confirming)
    // Since we are in Modal context (ActionSheet), Alert works.
    // But verify Alert is imported? No, it's not imported in snippet.
    // Assuming I'll add Alert to imports if needed, or use a custom Confirmation.
    // For now I'll just use the blockUser API directly with a simple confirmation if possible?
    // Or just call it. But blocking is destructive.
    // I'll import Alert in next chunk.
  };

  const StoryOptionsModal = () => (
    <ActionSheet
      ref={actionSheetRef}
      containerStyle={{
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
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
        <View className="flex-row items-center justify-between py-4 mx-5 border-b border-gray-300">
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
          <View className="flex-row items-center py-4 mx-5 border-b border-gray-300">
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
            setReportModalVisible(true);
          }}
        >
          <View className="flex-row items-center py-4 mx-5 border-b border-gray-300">
            <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
              <Ionicons name="warning-outline" size={23} color="#7F7F7F" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 17 }}>Báo cáo tin</Text>
              <Text className="text-gray-500 text-sm">
                Tin này chứa nội dung không phù hợp
              </Text>
            </View>
            <View style={{ marginLeft: "auto" }}>
              <Ionicons
                name="chevron-forward-outline"
                size={23}
                color="#D1D1D1"
              />
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

        <TouchableOpacity
          onPress={() => {
            actionSheetRef.current?.hide();
            Alert.alert("Chặn người dùng?", "Bạn sẽ không thấy tin của người này nữa.", [
              { text: "Hủy", style: "cancel" },
              {
                text: "Chặn", style: "destructive", onPress: async () => {
                  try {
                    if (currentStoryUser) {
                      await blockUser(currentStoryUser.id || currentStoryUser.uid);
                      Toast.show({ type: "success", text1: "Đã chặn người dùng" });
                      dismissStoryModal();
                      // Refresh stories?
                      fetchStories();
                    }
                  } catch (e) {
                    Toast.show({ type: "error", text1: "Lỗi", text2: e.message });
                  }
                }
              }
            ]);
          }}
        >
          <View className="flex-row items-center py-4 mx-5">
            <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
              <Ionicons name="ban-outline" size={23} color="#ef4444" />
            </View>
            <Text style={{ marginLeft: 12, fontSize: 17, color: "#ef4444" }}>
              Chặn người này
            </Text>
          </View>
        </TouchableOpacity>
      </View >
    </ActionSheet >
  );

  const fetchStories = async () => {
    try {
      const response = await getStories();
      if (response?.data) {
        const formattedStories = transformStoriesData(response);
        setUserStories(formattedStories);
      }
    } catch (error) {
      console.error("Error fetching stories:", error);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const transformStoriesData = (apiResponse) => {
    if (!apiResponse?.data) return [];

    let users = apiResponse.data.data;

    return users.map((user) => ({
      uid: user.id,
      id: user.username,
      name: user.name,
      avatarSource: {
        uri: `https://api.chuyenbienhoa.com/users/${user.username}/avatar`,
      },
      stories: user.stories.map((story) => ({
        id: story.id,
        storyId: story.id, // Store the actual story ID
        userId: user.id, // Store user ID
        username: user.username, // Store username
        source: {
          uri: `https://api.chuyenbienhoa.com${story.media_url}`,
        },
        duration: story.duration,
        viewers_count: story.viewers?.length || 0,
        renderFooter: () => (
          <ReplyBar
            storyId={story.id}
            userId={user.id}
            username={user.username}
            navigation={navigation}
            viewersCount={story.viewers?.length || 0}
            onDismissStory={dismissStoryModal}
          />
        ),
        date: story.created_at
          ? formatTime(story.created_at)
          : story.created_at_human,
        onStoryItemPress: () => {
          setCurrentStory(story.id);
          setCurrentStoryUser({ id: user.id, username: user.username });
        },
      })),
    }));
  };

  const EmailVerificationAlert = () => {
    if (!isLoggedIn || emailVerifiedAt) {
      return null;
    }

    return (
      <TouchableOpacity
        onPress={() => setVerificationModalVisible(true)}
        style={{
          backgroundColor: "#FFF3CD",
          borderLeftWidth: 4,
          borderLeftColor: "#FFC107",
          padding: 12,
          marginHorizontal: 15,
          marginTop: 10,
          marginBottom: 5,
          borderRadius: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-circle-outline" size={20} color="#856404" />
        <Text
          style={{
            marginLeft: 10,
            color: "#856404",
            fontSize: 14,
            flex: 1,
          }}
        >
          Vui lòng xác minh địa chỉ email để sử dụng đầy đủ các tính năng
        </Text>
        <Ionicons name="chevron-forward-outline" size={18} color="#856404" />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => {
    return (
      <>
        <EmailVerificationAlert />
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
          <TouchableHighlight
            onPress={() => navigation.navigate("CreateStory")}
            className="relative overflow-hidden rounded-2xl bg-gray-200 w-[100px] h-[160px] border border-[#c4c4c4]"
          >
            <View className="flex-1">
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
          </TouchableHighlight>
          {filteredStories.map((user) => (
            <TouchableHighlight
              key={user.id}
              onPress={() => storyRef.current?.show(user.id)}
              className="relative w-[100px] h-[160px] rounded-2xl overflow-hidden bg-gray-200 border border-[#c4c4c4]"
            >
              <View>
                {/* Story Image */}
                <Image
                  source={{ uri: user.stories[0].source.uri }}
                  style={{ width: 100, height: 160 }}
                />

                {/* Avatar */}
                <View className="absolute top-2 left-2">
                  <View className="rounded-full p-0.5 border-2 border-[#319528]">
                    <View className="w-6 h-6 rounded-full overflow-hidden">
                      <Image
                        source={{ uri: user.avatarSource.uri }}
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
                    {user.name}
                  </Text>
                </View>
              </View>
            </TouchableHighlight>
          ))}
        </ScrollView>
      </>
    );
  };

  const handleScroll = (event) => {
    // Track scroll position
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY); // Ensure non-negative
    isScrollingRef.current = false;

    // If scrolled to top during manual scroll, reset processing flag
    if (offsetY <= 10 && isProcessingRef.current && !refreshing) {
      isProcessingRef.current = false;
    }
  };

  const handleScrollBeginDrag = () => {
    isScrollingRef.current = true;
  };

  const handleRefresh = React.useCallback(() => {
    // Prevent multiple refresh calls - use ref for immediate check
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setRefreshing(true);
    setHasMore(true);
    setCurrentPage(2);
    viewedPosts.current = new Set(); // Reset viewed posts

    // Don't manually scroll - let RefreshControl handle it naturally
    // This prevents content from being pushed down

    fetchStories();

    // Refresh user info to update email verification status
    if (isLoggedIn && refreshUserInfo) {
      refreshUserInfo();
    }

    handleFetchFeed().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
        isProcessingRef.current = false;
        // Reset scroll position after refresh completes
        scrollPositionRef.current = 0;
      }, 1000);
    });
  }, [isLoggedIn, refreshUserInfo]);

  // Function to scroll to top or reload
  const scrollToTopOrReload = React.useCallback(() => {
    // Debounce: prevent rapid clicks (minimum 300ms between triggers)
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) {
      return;
    }
    lastTriggerTimeRef.current = now;

    // If already processing (refreshing or scrolling), ignore - use ref for immediate check
    if (isProcessingRef.current) {
      return;
    }

    const isAtTop = scrollPositionRef.current <= 10; // Consider 10px threshold for "at top"

    if (isAtTop) {
      // Already at top, trigger refresh (like pull-to-refresh)
      // This will set isProcessingRef to true, preventing multiple calls
      handleRefresh();
    } else {
      // Scroll to top first, then user can click again to refresh
      // Use a ref to track if we're scrolling to top
      const wasScrollingToTop = isProcessingRef.current;
      isProcessingRef.current = true;

      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: 0,
          animated: true,
        });
        // Reset processing flag after scroll animation completes
        // This allows the next click to trigger refresh
        setTimeout(() => {
          scrollPositionRef.current = 0;
          isProcessingRef.current = false;
        }, 600); // Slightly longer to ensure scroll completes
      } else {
        isProcessingRef.current = false;
      }
    }
  }, [handleRefresh]);

  // Expose scroll/reload function via ref callback
  React.useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  // Refresh user info when app comes to foreground
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && isLoggedIn && refreshUserInfo) {
        // App has come to the foreground, refresh user info to update email verification status
        refreshUserInfo();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [isLoggedIn, refreshUserInfo]);

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      Toast.show({
        type: "success",
        text1: "Thành công",
        text2:
          "Email xác minh đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      setVerificationModalVisible(false);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Đã có lỗi xảy ra",
        text2:
          error.message ||
          "Không thể gửi email xác minh. Vui lòng thử lại sau.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const ResendVerificationModal = () => {
    return (
      <Modal
        visible={verificationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setVerificationModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 20,
                  width: "85%",
                  maxWidth: 400,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 15,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "#FFF3CD",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="mail-outline" size={24} color="#FFC107" />
                  </View>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: "#333",
                      flex: 1,
                    }}
                  >
                    Xác minh Email
                  </Text>
                  <TouchableOpacity
                    onPress={() => setVerificationModalVisible(false)}
                    style={{ padding: 5 }}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text
                  style={{
                    fontSize: 15,
                    color: "#666",
                    marginBottom: 15,
                    lineHeight: 22,
                  }}
                >
                  Để sử dụng đầy đủ các tính năng như tạo bài viết, bạn cần xác
                  minh địa chỉ email của mình.
                </Text>

                {userInfo?.email && (
                  <View
                    style={{
                      backgroundColor: "#F5F5F5",
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 15,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#999",
                        marginBottom: 4,
                      }}
                    >
                      Email của bạn:
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        color: "#333",
                        fontWeight: "500",
                      }}
                    >
                      {userInfo.email}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleResendVerification}
                  disabled={resendingVerification}
                  style={{
                    backgroundColor: resendingVerification ? "#CCC" : "#319527",
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  {resendingVerification ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Gửi lại email xác minh
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setVerificationModalVisible(false)}
                  disabled={resendingVerification}
                  style={{
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#666",
                      fontSize: 15,
                    }}
                  >
                    Đóng
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

  const emojis = ["👍", "❤️", "🔥", "😆", "😮", "😢", "😡"];

  // Map emojis to reaction types
  const emojiToReactionType = {
    "👍": "like",
    "❤️": "love",
    "🔥": "like", // Fire doesn't exist in API, use like
    "😆": "haha",
    "😮": "wow",
    "😢": "sad",
    "😡": "angry",
  };

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

  const filteredFeed = useMemo(() => {
    if (!feed) return null;
    if (blockedUsers && blockedUsers.length > 0) {
      return feed.filter((post) => !blockedUsers.includes(post.user.username));
    }
    return feed;
  }, [feed, blockedUsers]);

  const filteredStories = useMemo(() => {
    if (!userStories) return [];
    if (blockedUsers && blockedUsers.length > 0) {
      return userStories.filter(
        (user) => !blockedUsers.includes(user.id) // user.id here maps to username based on transformStoriesData
      );
    }
    return userStories;
  }, [userStories, blockedUsers]);

  const ReplyBar = ({
    storyId,
    userId,
    username,
    navigation,
    viewersCount = 0,
    onDismissStory,
  }) => {
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    const [replyText, setReplyText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const isOwnStory = String(userId) === String(userInfo?.id);

    const handleEmojiPress = async (emoji) => {
      if (emoji === "add" || !storyId) return;

      const id = Date.now();
      setFloatingEmojis((prev) => [...prev, { id, emoji }]);

      // Map emoji to reaction type and send to API
      const reactionType = emojiToReactionType[emoji];
      if (reactionType) {
        try {
          await reactToStory(storyId, reactionType);
        } catch (error) {
          console.error("Error reacting to story:", error);
          Toast.show({
            type: "error",
            text1: "Lỗi",
            text2: "Không thể thả cảm xúc. Vui lòng thử lại.",
          });
        }
      }
    };

    const handleAnimationComplete = (id) => {
      setFloatingEmojis((prev) => prev.filter((emoji) => emoji.id !== id));
    };

    const handleSendReply = async () => {
      if (!replyText.trim() || !storyId || isSending) return;

      setIsSending(true);
      try {
        const response = await replyToStory(storyId, replyText.trim());
        setReplyText("");
        Toast.show({
          type: "success",
          text1: "Đã gửi",
          text2: "Tin nhắn đã được gửi đến người dùng.",
        });

        // Optionally navigate to conversation after sending reply
        if (response?.data?.conversation_id && navigation) {
          // Navigate to conversation screen to see the sent message
          navigation.navigate("ChatScreen", {
            screen: "ConversationScreen",
            params: {
              conversationId: response.data.conversation_id,
            },
          });
        }
      } catch (error) {
        console.error("Error replying to story:", error);

        // Extract error message from API response
        let errorMessage = "Không thể gửi tin nhắn. Vui lòng thử lại.";

        if (error.response?.data) {
          // Handle different error response formats
          if (error.response.data.message) {
            // Single message string
            if (typeof error.response.data.message === "string") {
              errorMessage = error.response.data.message;
            }
            // Message object (validation errors)
            else if (typeof error.response.data.message === "object") {
              const firstError = Object.values(error.response.data.message)[0];
              errorMessage = Array.isArray(firstError)
                ? firstError[0]
                : firstError;
            }
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        Toast.show({
          type: "error",
          text1: "Lỗi",
          text2: errorMessage,
          visibilityTime: 4000,
        });
      } finally {
        setIsSending(false);
      }
    };

    const handleViewCountPress = () => {
      if (navigation && storyId) {
        // Dismiss story modal first
        if (onDismissStory) {
          onDismissStory();
        }
        // Small delay to ensure modal is dismissed before navigation
        setTimeout(() => {
          navigation.navigate("StoryViewersScreen", {
            storyId: storyId,
          });
        }, 100);
      }
    };

    // If it's the user's own story, show view count instead of reply/reaction
    if (isOwnStory) {
      return (
        <SafeAreaView>
          <View style={styles.viewCountBar}>
            <TouchableOpacity
              onPress={handleViewCountPress}
              style={styles.viewCountButton}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={styles.viewCountText}>
                {viewersCount === 0 ? 0 : viewersCount - 1} {"lượt xem"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

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
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={handleSendReply}
              editable={!isSending}
            />
            <TouchableOpacity
              style={{ position: "absolute", right: 20 }}
              onPress={handleSendReply}
              disabled={!replyText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <StoryOptionsModal />
        <KeyboardSpacer />
      </View>
    );
  };

  return filteredFeed == null ? (
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
        {refreshing && (
          <View
            style={{
              position: "absolute",
              top: 5,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <LottieView
              source={require("../../../assets/refresh.json")}
              style={{
                width: 40,
                height: 40,
              }}
              ref={lottieRef}
              loop
              autoPlay
            />
          </View>
        )}
        <FlatList
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          ref={flatListRef}
          showsVerticalScrollIndicator={false}
          data={filteredFeed}
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
              onRefresh={() => {
                // When user pulls to refresh, also prevent multiple calls
                if (!isProcessingRef.current) {
                  handleRefresh();
                }
              }}
            />
          }
          ListFooterComponent={ListEndLoader}
          ListHeaderComponent={ListHeader}
        />

        <InstagramStories
          ref={storyRef}
          stories={filteredStories}
          hideAvatarList={true}
          showName={true}
          textStyle={{
            color: "#fff",
            textShadowColor: "rgba(0, 0, 0, 0.8)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 1.5,
            fontWeight: "600",
          }}
          progressColor="#a4a4a4"
          closeIconColor="#c4c4c4"
          modalAnimationDuration={300}
          storyAnimationDuration={300}
          storyAvatarSize={30}
          onMore={handleStoryOptions}
          onShow={handleStoryShow}
          onHide={handleStoryHide}
          onStoryStart={handleStoryStart}
          onStoryItemPress={(item, index) => {
            // item is the story object, find the actual story ID
            const user = userStories.find((u) =>
              u.stories.some((s) => s.id === item.id)
            );
            if (user) {
              const story = user.stories.find((s) => s.id === item.id);
              if (story) {
                setCurrentStory(story.storyId);
                setCurrentStoryUser({ id: user.uid, username: user.id });
              }
            }
          }}
          toast={<Toast topOffset={60} />}
          containerStyle={{
            transform: [{ translateY: Platform.OS === "android" ? -69 : -15 }],
          }}
        />
        <ResendVerificationModal />
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmit={handleReportSubmit}
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
  viewCountBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  viewCountButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewCountText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
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
