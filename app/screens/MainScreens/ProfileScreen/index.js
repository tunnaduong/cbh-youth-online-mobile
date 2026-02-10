import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import CustomLoading from "../../../components/CustomLoading";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  followUser,
  getProfile,
  unfollowUser,
  blockUser,
  reportUser,
} from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedContext } from "../../../contexts/FeedContext";
import FastImage from "react-native-fast-image";
import Verified from "../../../assets/Verified";
import ReportModal from "../../../components/ReportModal";
import { Alert, ActionSheetIOS, Platform } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

const ProfileScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const { username, profileName, blockUser: blockUserInContext } = React.useContext(AuthContext);
  const userId = route?.params?.username; // Default to current user if no ID passed
  const [refreshing, setRefreshing] = React.useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const { recentPostsProfile, setRecentPostsProfile } = useContext(FeedContext);
  const isCurrentUser = userId === username;
  const [activeTab, setActiveTab] = useState("posts");
  const [followed, setFollowed] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      // Fetch updated data for the profile when the screen comes into focus
      fetchUserData(userId);
    }, [userId])
  );

  useEffect(() => {
    if (userData?.followers) {
      const isFollowed = userData.followers.some(
        (follower) => follower.username === username
      );
      setFollowed(!isFollowed);
    }
  }, [userData?.followers, username]);

  const handleFollowUserOnTab = async (user) => {
    try {
      if (user.isFollowed) {
        // Unfollow the user
        await unfollowUser(user.username); // Call the API to unfollow
        // not fetch here, cause we want to show the unfollowed state. the followers field should have isFollowed = false
        setUserData((prevData) => {
          const updatedData = {
            ...prevData,
            following: prevData.following.map((following) =>
              following.username === user.username
                ? { ...following, isFollowed: false }
                : following
            ),
            followers: prevData.followers.map((follower) =>
              follower.username === user.username
                ? { ...follower, isFollowed: false }
                : follower
            ),
          };

          // Update stats only if this is the current user's profile
          if (isCurrentUser) {
            updatedData.stats = {
              ...prevData.stats,
              following: prevData.stats.following - 1, // Decrement count
            };
          }

          return updatedData;
        });
      } else {
        // Follow the user
        await followUser(user.username); // Call the API to follow
        fetchUserData(userId); // Refresh user data
      }
    } catch (error) {
      console.error(
        "Error toggling follow state:",
        error.response?.data || error.message
      );
    }
  };

  const handleFollow = async (userId) => {
    try {
      if (!followed) {
        // Unfollow the user
        await unfollowUser(userId); // Call the API to unfollow
        setFollowed(false);

        // Remove the current user from the followers list and decrement followers count
        setUserData((prevData) => ({
          ...prevData,
          followers: prevData.followers.filter(
            (follower) => follower.username !== username
          ),
          stats: {
            ...prevData.stats,
            followers: prevData.stats.followers - 1, // Decrement followers count
          },
        }));
      } else {
        // Follow the user
        await followUser(userId); // Call the API to follow
        setFollowed(true);

        // Add the current user to the followers list and increment followers count
        setUserData((prevData) => ({
          ...prevData,
          followers: [
            ...prevData.followers,
            {
              username: username,
              profile_name: profileName, // Replace with the current user's profile name
              profile_picture: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`, // Replace with the current user's profile picture
            },
          ],
          stats: {
            ...prevData.stats,
            followers: prevData.stats.followers + 1, // Increment followers count
          },
        }));
      }
    } catch (error) {
      // console.error("Error toggling follow state:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (route.params?.post) {
        console.log("Post updated:", route.params.post);

        setRecentPostsProfile((prevPosts) =>
          prevPosts.map((post) =>
            post.id === route.params.postId ? route.params.post : post
          )
        );

        // Clear the parameters to avoid re-triggering
        navigation.setParams({ post: null, postId: null });
      }
    }, [route.params?.post, route.params?.postId])
  );



  const confirmBlock = () => {
    Alert.alert(
      "Chặn người dùng?",
      "Bạn sẽ không còn thấy bài viết của người này nữa.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chặn",
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(userData.id);
              await blockUserInContext(userData.username);
              Alert.alert("Đã chặn", "Người dùng đã bị chặn thành công.", [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } catch (e) {
              const errorMessage = e.response?.data?.message || e.message || "Không thể chặn người dùng này";
              Alert.alert("Lỗi", errorMessage);
            }
          }
        }
      ]
    );
  };

  const showOptions = () => {
    const options = ["Báo cáo", "Chặn người dùng", "Hủy"];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 2;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
          userInterfaceStyle: isDarkMode ? "dark" : "light",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) setReportModalVisible(true);
          else if (buttonIndex === 1) confirmBlock();
        }
      );
    } else {
      Alert.alert(
        "Tùy chọn",
        null,
        [
          { text: "Báo cáo", onPress: () => setReportModalVisible(true) },
          { text: "Chặn người dùng", onPress: confirmBlock, style: "destructive" },
          { text: "Hủy", style: "cancel" },
        ]
      );
    }
  };

  const handleReportSubmit = async (reason) => {
    try {
      await reportUser({ reported_user_id: userData.id, reason });
      Alert.alert("Cảm ơn", "Báo cáo của bạn đã được gửi. Chúng tôi sẽ xem xét trong thời gian sớm nhất.");
    } catch (e) {
      const errorMessage = e.response?.data?.message || e.message || "Không thể gửi báo cáo";
      Alert.alert("Lỗi", errorMessage);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);

    fetchUserData(userId).finally(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    });
  };

  // Fetch user data from API
  const fetchUserData = async (userId) => {
    try {
      const response = await getProfile(userId);
      setUserData(response.data);
      setRecentPostsProfile(response.data.recent_posts);
      // Check if the current user is in the followers list
      const isFollowed = response.data.followers.some(
        (follower) => follower.username === username
      );
      setFollowed(!isFollowed);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData(userId);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <CustomLoading />
      </SafeAreaView>
    );
  }

  const handleVoteUpdate = (postId, newVotes) => {
    // Update votes in both recentPostsProfile state and userData state
    setRecentPostsProfile((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, votes: newVotes } : post
      )
    );
  };

  const handleSaveUpdate = (postId, savedStatus) => {
    setRecentPostsProfile((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, saved: savedStatus } : post
      )
    );
  };

  // Render user connection item
  const renderUserItem = (user) => (
    <TouchableOpacity
      key={user.id}
      style={[styles.userItem, { borderBottomColor: theme.border }]}
      onPress={() => {
        navigation.push("ProfileScreen", {
          username: user.username,
        });
      }}
    >
      <Image source={{ uri: user.profile_picture }} style={styles.userAvatar} />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
          {user.profile_name}
        </Text>
        <Text style={[styles.userUsername, { color: theme.subText }]} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      {/* if is current user then hide the follow btn */}
      {user.username !== username && (
        <TouchableOpacity
          style={[
            styles.followButton,
            user.isFollowed
              ? { backgroundColor: isDarkMode ? "#374151" : "#E5E7EB" }
              : { backgroundColor: theme.primary },
          ]}
          onPress={() => handleFollowUserOnTab(user)}
        >
          <Text
            style={[
              styles.followButtonText,
              user.isFollowed ? { color: theme.text } : { color: "#FFF" },
            ]}
          >
            {user.isFollowed ? "Đang theo dõi" : "Theo dõi"}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "posts":
        return (
          <>
            {recentPostsProfile?.length === 0 ? (
              <View>
                <Image
                  source={require("../../../assets/sad_frog.png")}
                  style={{
                    height: 90,
                    width: 90,
                    alignSelf: "center",
                    marginTop: 20,
                  }}
                />
                <Text style={{ textAlign: "center", fontWeight: "300", color: theme.subText, marginTop: 8 }}>
                  Chưa có bài viết nào...
                </Text>
              </View>
            ) : (
              recentPostsProfile?.map((post) => (
                <PostItem
                  key={`post-${post.id}`}
                  item={post}
                  navigation={navigation}
                  onVoteUpdate={handleVoteUpdate}
                  onSaveUpdate={handleSaveUpdate}
                  screenName={"ProfileScreen"}
                />
              ))
            )}
          </>
        );

      case "following":
        return (
          <View style={styles.connectionsList}>
            {userData?.following?.length === 0 ? (
              <View>
                <Image
                  source={require("../../../assets/sad_frog.png")}
                  style={{
                    height: 90,
                    width: 90,
                    alignSelf: "center",
                    marginTop: 20,
                  }}
                />
                <Text style={{ textAlign: "center", fontWeight: "300", color: theme.subText, marginTop: 8 }}>
                  Chưa theo dõi ai cả...
                </Text>
              </View>
            ) : (
              userData.following.map((user) => renderUserItem(user))
            )}
          </View>
        );

      case "followers":
        return (
          <View style={styles.connectionsList}>
            {userData?.followers?.length === 0 ? (
              <View>
                <Image
                  source={require("../../../assets/sad_frog.png")}
                  style={{
                    height: 90,
                    width: 90,
                    alignSelf: "center",
                    marginTop: 20,
                  }}
                />
                <Text style={{ textAlign: "center", fontWeight: "300", color: theme.subText, marginTop: 8 }}>
                  Chưa có người theo dõi nào...
                </Text>
              </View>
            ) : (
              userData.followers.map((user) => renderUserItem(user))
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View
          style={[styles.header, { height: 50, borderBottomColor: theme.border }]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setHeaderHeight(height);
          }}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {isCurrentUser ? "Trang cá nhân" : userData?.profile.profile_name}
          </Text>
          {isCurrentUser ? (
            <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
              <Ionicons name="settings-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }}></View>
          )}
          {!isCurrentUser && (
            <TouchableOpacity onPress={showOptions} style={{ position: 'absolute', right: 16 }}>
              <Ionicons name="ellipsis-vertical" size={24} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmit={handleReportSubmit}
        />
        <CustomLoading
          size={50}
          style={{
            position: "absolute",
            zIndex: -1,
            alignSelf: "center",
            top: headerHeight + insets.top + 10,
          }}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ backgroundColor: theme.background }}
          refreshControl={
            <RefreshControl
              tintColor="transparent"
              colors={["transparent"]}
              style={{ backgroundColor: "transparent" }}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {/* Cover photo */}
          <View
            style={{
              height: 170,
              backgroundColor: isDarkMode ? "#374151" : "#d1d1d1",
              borderRadius: 15,
              margin: 16,
            }}
          />

          <View
            style={{
              position: "relative",
              top: -35,
              left: 30,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              width: "55%",
            }}
          >
            <View style={{ position: "relative", backgroundColor: theme.background, borderRadius: 999 }}>
              <FastImage
                source={{
                  uri: userData?.profile?.profile_picture,
                }}
                style={[styles.avatar, { borderColor: theme.background }]}
              />
              {/* Online status */}
              {userData?.stats?.is_online ? (
                <View style={{ backgroundColor: theme.background, borderRadius: 999, width: 20, height: 20, position: "absolute", bottom: 0, right: 0, marginRight: 12, marginBottom: 12, justifyContent: "center", alignItems: "center" }}>
                  <View style={{ width: 14, height: 14, backgroundColor: "#16a34a", borderRadius: 999 }}></View>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {userData?.profile?.profile_name}
                {userData?.profile?.verified && (
                  <View>
                    <Verified
                      width={23}
                      height={23}
                      color={theme.primary}
                      style={{ marginBottom: -5 }}
                    />
                  </View>
                )}
              </Text>
              <Text style={[styles.username, { color: theme.subText }]} numberOfLines={1}>
                @{userData?.username}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: -20 }}>
            {isCurrentUser ? (
              <TouchableOpacity
                onPress={() => navigation.navigate("EditProfileScreen")}
                style={{ backgroundColor: "transparent", borderWidth: 1.5, padding: 12, borderColor: theme.primary, borderRadius: 999, marginHorizontal: 16 }}
              >
                <Text style={{ textAlign: "center", fontWeight: "600", color: theme.primary }}>
                  Chỉnh sửa trang cá nhân
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: -20, paddingHorizontal: 16, flexDirection: "row", gap: 8 }}>
                {followed ? (
                  <TouchableOpacity
                    onPress={() => handleFollow(userId)}
                    style={{ backgroundColor: theme.primary, height: 44, borderRadius: 999, justifyContent: "center", alignItems: "center", flexDirection: "row", flex: 1 }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={"white"} />
                    <Text style={{ textAlign: "center", fontWeight: "600", marginLeft: 4, color: "white" }}>
                      Theo dõi
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleFollow(userId)}
                    style={{ backgroundColor: "transparent", height: 44, borderWidth: 1.5, borderColor: theme.primary, borderRadius: 999, justifyContent: "center", alignItems: "center", flex: 1 }}
                  >
                    <Text style={{ textAlign: "center", fontWeight: "600", color: theme.primary }}>
                      Đã theo dõi
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("ConversationScreen", {
                      isNewConversation: true,
                      selectedUser: {
                        id: userData?.id,
                        profile_name: userData?.profile?.profile_name,
                        avatar_url: userData?.profile?.profile_picture,
                        username: userData?.username,
                      },
                    })
                  }
                  style={{ backgroundColor: isDarkMode ? "#374151" : "#f3f4f6", height: 44, borderRadius: 999, justifyContent: "center", alignItems: "center", flexDirection: "row", flex: 1 }}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color={theme.text}
                  />
                  <Text style={{ textAlign: "center", fontWeight: "600", marginLeft: 4, color: theme.text }}>
                    Nhắn tin
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: isDarkMode ? "#1f2937" : "#f5f5f5", padding: 16, borderRadius: 12 }}>
            <Text style={{ fontWeight: "600", fontSize: 18, color: theme.text }}>Thông tin cá nhân</Text>
            {userData?.profile?.bio && (
              <Text style={{ color: theme.subText, fontSize: 14, marginTop: 8, marginBottom: 12 }}>
                {userData?.profile?.bio}
              </Text>
            )}
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="school-outline" size={16} color={theme.subText} />
                <Text style={{ fontSize: 14, color: theme.text }}>
                  {userData?.profile?.class_name ? `Lớp ${userData?.profile?.class_name}` : "Lớp chưa cập nhật"}
                </Text>
              </View>
              {userData?.profile?.location && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="location-outline" size={16} color={theme.subText} />
                  <Text style={{ fontSize: 14, color: theme.text }}>{userData?.profile?.location}</Text>
                </View>
              )}
              {userData?.profile?.birthday && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="gift-outline" size={16} color={theme.subText} />
                  <Text style={{ fontSize: 14, color: theme.text }}>
                    Sinh vào {userData?.profile?.birthday}
                  </Text>
                </View>
              )}
              {userData?.profile?.joined_at && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="calendar-outline" size={16} color={theme.subText} />
                  <Text style={{ fontSize: 14, color: theme.text }}>
                    Đã tham gia {userData?.profile?.joined_at}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={{ position: "absolute", bottom: 20, right: 16 }}
              onPress={() =>
                navigation.navigate("ProfileDetailScreen", {
                  username: userData?.username,
                })
              }
            >
              <Text style={{ color: theme.primary }}>Xem chi tiết</Text>
              <View
                style={{
                  height: 1,
                  width: "100%",
                  backgroundColor: theme.primary,
                  marginTop: 1,
                }}
              />
            </TouchableOpacity>
          </View>

          <View
            style={{
              borderTopColor: theme.border,
              borderTopWidth: 1,
              marginVertical: 20,
              marginHorizontal: 16,
            }}
          />

          {/* User stats and tabs */}
          <View style={{ marginHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TouchableOpacity
              style={[
                { gap: 2, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.2, borderColor: "transparent" },
                activeTab === "posts" && { backgroundColor: isDarkMode ? "#1e2e1c" : "#C7F0C2", borderColor: theme.primary }
              ]}
              onPress={() => setActiveTab("posts")}
            >
              <Text style={{ fontWeight: "600", fontSize: 11, color: theme.text }}>Bài viết</Text>
              <Text style={{ fontWeight: "800", fontSize: 18, color: theme.text }}>
                {userData?.stats?.posts}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                { gap: 2, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.2, borderColor: "transparent" },
                activeTab === "following" && { backgroundColor: isDarkMode ? "#1e2e1c" : "#C7F0C2", borderColor: theme.primary }
              ]}
              onPress={() => setActiveTab("following")}
            >
              <Text style={{ fontWeight: "600", fontSize: 11, color: theme.text }}>Đang t.dõi</Text>
              <Text style={{ fontWeight: "800", fontSize: 18, color: theme.text }}>
                {userData?.stats?.following}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                { gap: 2, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.2, borderColor: "transparent" },
                activeTab === "followers" && { backgroundColor: isDarkMode ? "#1e2e1c" : "#C7F0C2", borderColor: theme.primary }
              ]}
              onPress={() => setActiveTab("followers")}
            >
              <Text style={{ fontWeight: "600", fontSize: 11, color: theme.text }}>Người t.dõi</Text>
              <Text style={{ fontWeight: "800", fontSize: 18, color: theme.text }}>
                {userData?.stats?.followers}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ gap: 2, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontWeight: "600", fontSize: 11, color: theme.text }}>Thích</Text>
              <Text style={{ fontWeight: "800", fontSize: 18, color: theme.text }}>
                {userData?.stats?.total_likes_count}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ gap: 2, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontWeight: "600", fontSize: 11, color: theme.text }}>Điểm</Text>
              <Text style={{ fontWeight: "800", fontSize: 18, color: theme.text }}>
                {userData?.stats?.activity_points}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              borderTopColor: isDarkMode ? "#111827" : "#ECECEC",
              borderTopWidth: 10,
              marginTop: 20,
            }}
          />

          {/* Tab content */}
          {renderTabContent()}

          {isCurrentUser && (
            <View style={[styles.section, { borderTopColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Hoạt động của bạn</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SavedPostsScreen")}
                style={[styles.option, { borderBottomColor: theme.border }]}
              >
                <Ionicons name="bookmark-outline" size={22} color={theme.text} />
                <Text style={[styles.optionText, { color: theme.text }]}>Bài viết đã lưu</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={theme.subText}
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("LikedPostsScreen")}
                style={[styles.option, { borderBottomColor: theme.border }]}
              >
                <Ionicons name="heart-outline" size={22} color={theme.text} />
                <Text style={[styles.optionText, { color: theme.text }]}>Bài viết đã thích</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={theme.subText}
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("ActivityScreen")}
                style={[styles.option, { borderBottomColor: theme.border }]}
              >
                <Ionicons name="time-outline" size={22} color={theme.text} />
                <Text style={[styles.optionText, { color: theme.text }]}>Lịch sử hoạt động</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={theme.subText}
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("ArchiveScreen", { username: username })
                }
                style={[styles.option, { borderBottomColor: theme.border }]}
              >
                <Ionicons name="archive-outline" size={22} color={theme.text} />
                <Text style={[styles.optionText, { color: theme.text }]}>Kho lưu trữ</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={theme.subText}
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView >
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    maxWidth: "85%",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },
  username: {
    fontSize: 16,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginTop: 100,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  editProfileButton: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editProfileText: {
    fontWeight: "600",
  },
  section: {
    marginTop: 25,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  optionArrow: {
    marginLeft: "auto",
  },
  logoutButton: {
    marginHorizontal: 16,
    marginVertical: 30,
    paddingVertical: 12,
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    alignItems: "center",
  },
  logoutText: {
    fontWeight: "600",
    color: "#fff",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userUsername: {
    fontSize: 14,
  },
  followButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  followButtonText: {
    fontWeight: "600",
    fontSize: 12,
  },
  emptyMessage: {
    textAlign: "center",
    marginTop: 40,
    marginBottom: 40,
    fontSize: 16,
  },
});

export default ProfileScreen;
