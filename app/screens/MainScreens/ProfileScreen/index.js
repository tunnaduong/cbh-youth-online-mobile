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
} from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedContext } from "../../../contexts/FeedContext";
import FastImage from "react-native-fast-image";
import Verified from "../../../assets/Verified";

const ProfileScreen = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const { username, profileName } = React.useContext(AuthContext);
  const userId = route?.params?.username; // Default to current user if no ID passed
  const [refreshing, setRefreshing] = React.useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const { recentPostsProfile, setRecentPostsProfile } = useContext(FeedContext);
  const isCurrentUser = userId === username;
  const [activeTab, setActiveTab] = useState("posts");
  const [followed, setFollowed] = useState(false);

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
      <SafeAreaView style={styles.loadingContainer}>
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
      style={styles.userItem}
      onPress={() => {
        navigation.push("ProfileScreen", {
          username: user.username,
        });
      }}
    >
      <Image source={{ uri: user.profile_picture }} style={styles.userAvatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.profile_name}
        </Text>
        <Text style={styles.userUsername} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      {/* if is current user then hide the follow btn */}
      {user.username !== username && (
        <TouchableOpacity
          style={[
            styles.followButton,
            user.isFollowed
              ? { backgroundColor: "#E5E7EB" }
              : { backgroundColor: "#319527" },
          ]}
          onPress={() => handleFollowUserOnTab(user)}
        >
          <Text
            style={[
              styles.followButtonText,
              user.isFollowed ? { color: "#000" } : { color: "#FFF" },
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
                <Text className="text-center font-light text-gray-500 mt-2">
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
                <Text className="text-center font-light text-gray-500 mt-2">
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
                <Text className="text-center font-light text-gray-500 mt-2">
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
      <SafeAreaView style={styles.container}>
        <View
          style={[styles.header, { height: 50 }]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setHeaderHeight(height);
          }}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#319527" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isCurrentUser ? "Trang cá nhân" : userData?.profile.profile_name}
          </Text>
          {isCurrentUser ? (
            <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
              <Ionicons name="settings-outline" size={24} color="#319527" />
            </TouchableOpacity>
          ) : (
            <View className="w-[24px]"></View>
          )}
        </View>
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
          contentContainerStyle={{ backgroundColor: "#fff" }}
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
              backgroundColor: "#d1d1d1",
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
            <View className="relative bg-white rounded-full">
              <FastImage
                source={{
                  uri: userData?.profile?.profile_picture,
                }}
                style={styles.avatar}
              />
              {/* Online status */}
              {userData?.stats?.is_online ? (
                <View className="bg-white rounded-full w-5 h-5 absolute bottom-0 right-0 mr-3 mb-3 justify-center items-center">
                  <View className="w-[14px] h-[14px] bg-green-600 rounded-full"></View>
                </View>
              ) : (
                <></>
              )}
            </View>
            <View>
              <Text style={styles.name} numberOfLines={2}>
                {userData?.profile?.profile_name}
                {userData?.profile?.verified && (
                  <View>
                    <Verified
                      width={23}
                      height={23}
                      color={"#319527"}
                      style={{ marginBottom: -5 }}
                    />
                  </View>
                )}
              </Text>
              <Text style={styles.username} numberOfLines={1}>
                @{userData?.username}
              </Text>
            </View>
          </View>

          <View className="-mt-5">
            {isCurrentUser ? (
              <TouchableOpacity
                onPress={() => navigation.navigate("EditProfileScreen")}
                className="bg-white border-[1.5px] p-3 border-green-600 rounded-full mx-4"
              >
                <Text className="text-center font-semibold">
                  Chỉnh sửa trang cá nhân
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="-mt-5 px-4 flex-row gap-2">
                {followed ? (
                  <TouchableOpacity
                    onPress={() => handleFollow(userId)}
                    className="bg-[#319528] h-11 rounded-full justify-center items-center flex-row flex-1"
                  >
                    <Ionicons name="add-circle-outline" size={20} color={"white"} />
                    <Text className="text-center font-semibold ml-1 text-white">
                      Theo dõi
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleFollow(userId)}
                    className="bg-white h-11 border-[1.5px] border-green-600 rounded-full justify-center items-center flex-1"
                  >
                    <Text className="text-center font-semibold text-[#319528]">
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
                  className="bg-gray-100 h-11 rounded-full justify-center items-center flex-row flex-1"
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color="black"
                  />
                  <Text className="text-center font-semibold ml-1 text-black">
                    Nhắn tin
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View className="mx-4 mt-3 bg-neutral-100 p-4 rounded-xl">
            <Text className="font-semibold text-lg">Thông tin cá nhân</Text>
            {userData?.profile?.bio && (
              <Text className="text-gray-600 text-sm mt-2 mb-3">
                {userData?.profile?.bio}
              </Text>
            )}
            <View className="gap-0.5">
              {userData?.profile?.class_name ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="school-outline" size={16} />
                  <Text className="text-sm">
                    Lớp {userData?.profile?.class_name}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="school-outline" size={16} />
                  <Text className="text-sm">Lớp chưa cập nhật</Text>
                </View>
              )}
              {userData?.profile?.location ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={16} />
                  <Text className="text-sm">{userData?.profile?.location}</Text>
                </View>
              ) : (
                <></>
              )}
              {userData?.profile?.birthday ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="gift-outline" size={16} />
                  <Text className="text-sm">
                    Sinh vào {userData?.profile?.birthday}
                  </Text>
                </View>
              ) : (
                <></>
              )}
              {userData?.profile?.joined_at ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} />
                  <Text className="text-sm">
                    Đã tham gia {userData?.profile?.joined_at}
                  </Text>
                </View>
              ) : (
                <></>
              )}
            </View>
            <TouchableOpacity
              className="absolute bottom-[20px] right-[16px]"
              onPress={() =>
                navigation.navigate("ProfileDetailScreen", {
                  username: userData?.username,
                })
              }
            >
              <Text>Xem chi tiết</Text>
              <View
                style={{
                  height: 0,
                  width: "100%",
                  borderTopColor: "black",
                  borderTopWidth: 1,
                }}
              />
            </TouchableOpacity>
          </View>

          <View
            style={{
              borderTopColor: "#ECECEC",
              borderTopWidth: 1,
              marginVertical: 20,
              marginHorizontal: 16,
            }}
          />

          {/* User stats and tabs */}
          <View className="mx-4 flex-row items-center justify-between">
            <TouchableOpacity
              className={`gap-1 justify-center items-center px-[8px] py-[4px] rounded-xl border-[1.2px] ${activeTab === "posts"
                ? "bg-[#C7F0C2] border-[#2D8824]"
                : "border-transparent"
                }`}
              onPress={() => setActiveTab("posts")}
            >
              <Text className="font-semibold text-xs">Bài viết</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.posts}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`gap-1 justify-center items-center px-[8px] py-[4px] rounded-xl border-[1.2px] ${activeTab === "following"
                ? "bg-[#C7F0C2] border-[#2D8824]"
                : "border-transparent"
                }`}
              onPress={() => setActiveTab("following")}
            >
              <Text className="font-semibold text-xs">Đang t.dõi</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.following}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`gap-1 justify-center items-center px-[8px] py-[4px] rounded-xl border-[1.2px] ${activeTab === "followers"
                ? "bg-[#C7F0C2] border-[#2D8824]"
                : "border-transparent"
                }`}
              onPress={() => setActiveTab("followers")}
            >
              <Text className="font-semibold text-xs">Người t.dõi</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.followers}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="gap-1 justify-center items-center px-[8px] py-[4px]">
              <Text className="font-semibold text-xs">Thích</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.total_likes_count}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="gap-1 justify-center items-center px-[8px] py-[4px]">
              <Text className="font-semibold text-xs">Điểm</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.activity_points}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              borderTopColor: "#ECECEC",
              borderTopWidth: 10,
              marginTop: 20,
            }}
          />

          {/* Tab content */}
          {renderTabContent()}

          {isCurrentUser && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hoạt động của bạn</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SavedPostsScreen")}
                style={styles.option}
              >
                <Ionicons name="bookmark-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Bài viết đã lưu</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#999"
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("LikedPostsScreen")}
                style={styles.option}
              >
                <Ionicons name="heart-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Bài viết đã thích</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#999"
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("ActivityScreen")}
                style={styles.option}
              >
                <Ionicons name="time-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Lịch sử hoạt động</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#999"
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("ArchiveScreen", { username: username })
                }
                style={styles.option}
              >
                <Ionicons name="archive-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Kho lưu trữ</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#999"
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    position: "relative",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
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
    borderColor: "#fff",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },
  username: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: "#333",
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
    borderColor: "#f0f0f0",
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
    color: "#666",
    marginTop: 4,
  },
  editProfileButton: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    alignItems: "center",
  },
  editProfileText: {
    fontWeight: "600",
    color: "#333",
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
    borderBottomColor: "#f0f0f0",
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
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userUsername: {
    fontSize: 14,
    color: "#666",
  },
  followButton: {
    backgroundColor: "#319527",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  followButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  emptyMessage: {
    textAlign: "center",
    marginTop: 40,
    marginBottom: 40,
    color: "#888",
    fontSize: 16,
  },
});

export default ProfileScreen;
