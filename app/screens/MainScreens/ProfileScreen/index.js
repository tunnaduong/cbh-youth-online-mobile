import React, { useState, useEffect, useCallback } from "react";
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
import { getProfile } from "../../../services/api/Api";
import PostItem from "../../../components/PostItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ProfileScreen = ({ route, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const { username } = React.useContext(AuthContext);
  const userId = route?.params?.username || username; // Default to current user if no ID passed
  const [refreshing, setRefreshing] = React.useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const [recentPosts, setRecentPosts] = useState([]);
  const isCurrentUser = userId === username;

  useFocusEffect(
    useCallback(() => {
      if (route.params?.post) {
        setRecentPosts((prevPosts) =>
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
      setRecentPosts(response.data.recent_posts);
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
    // Update votes in both recentPosts state and userData state
    setRecentPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, votes: newVotes } : post
      )
    );
  };

  const handleSaveUpdate = (postId, savedStatus) => {
    setRecentPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, saved: savedStatus } : post
      )
    );
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View
          style={styles.header}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setHeaderHeight(height);
          }}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#319527" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trang cá nhân</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={24} color="#319527" />
          </TouchableOpacity>
        </View>
        <CustomLoading
          size={50}
          style={{
            position: "absolute",
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
              <Image
                source={{ uri: userData?.profile?.profile_picture }}
                style={styles.avatar}
              />
              <View className="absolute bottom-0 right-0 mr-3 mb-3 w-5 h-5 bg-green-600 rounded-full border-[3px] border-white"></View>
            </View>
            <View>
              <Text style={styles.name} numberOfLines={2}>
                {userData?.profile?.profile_name}
              </Text>
              <Text style={styles.username} numberOfLines={1}>
                @{userData?.username}
              </Text>
            </View>
          </View>

          {isCurrentUser ? (
            <TouchableOpacity className="-mt-5 bg-white border-[1.5px] p-3 border-green-600 rounded-full mx-4">
              <Text className="text-center font-semibold">
                Chỉnh sửa trang cá nhân
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity className="-mt-5 bg-[#319528] p-3 rounded-full mx-4 justify-center items-center flex-row">
              <Ionicons name="add-circle-outline" size={20} color={"white"} />
              <Text className="text-center font-semibold ml-1 text-white">
                Theo dõi
              </Text>
            </TouchableOpacity>
          )}

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
                  <Text className="text-sm">Hà Nam, Việt Nam</Text>
                </View>
              ) : (
                <></>
              )}
              {userData?.profile?.birthday ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="gift-outline" size={16} />
                  <Text className="text-sm">Sinh vào 21 Tháng 11 2003</Text>
                </View>
              ) : (
                <></>
              )}
              {userData?.profile?.joined_at ? (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} />
                  <Text className="text-sm">Đã tham gia Tháng 11 2024</Text>
                </View>
              ) : (
                <></>
              )}
            </View>
            <TouchableOpacity className="absolute bottom-[20px] right-[16px]">
              <Text>Xem chi tiết</Text>
              <View
                style={{
                  height: 0,
                  width: 78,
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

          <View className="mx-4 flex-row items-center justify-between">
            <TouchableOpacity className="gap-1 justify-center items-center bg-[#C7F0C2] px-[8px] py-[4px] rounded-xl border-[1.2px] border-[#2D8824]">
              <Text className="font-semibold text-xs">Bài viết</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.posts}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="gap-1 justify-center items-center bg-white px-[8px] py-[4px]">
              <Text className="font-semibold text-xs">Đang t.dõi</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.following}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="gap-1 justify-center items-center bg-white px-[8px] py-[4px]">
              <Text className="font-semibold text-xs">Người t.dõi</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.followers}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="gap-1 justify-center items-center bg-white px-[8px] py-[4px]">
              <Text className="font-semibold text-xs">Thích</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.total_likes_count}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="gap-1 justify-center items-center bg-white px-[8px] py-[4px]">
              <Text className="font-semibold text-xs">Điểm</Text>
              <Text className="font-extrabold text-lg">
                {userData?.stats?.activity_points}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recent posts */}
          {/* Loop from state using map */}
          {recentPosts.length === 0 && (
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
          )}

          <View
            style={{
              borderTopColor: "#ECECEC",
              borderTopWidth: 10,
              marginTop: 20,
            }}
          />

          {recentPosts.map((post) => (
            <PostItem
              key={`post-${post.id}`}
              item={post}
              navigation={navigation}
              onVoteUpdate={handleVoteUpdate}
              onSaveUpdate={handleSaveUpdate}
              screenName={"ProfileScreen"}
            />
          ))}

          {isCurrentUser && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hoạt động của bạn</Text>
              <TouchableOpacity style={styles.option}>
                <Ionicons name="bookmark-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Bài viết đã lưu</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#999"
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.option}>
                <Ionicons name="heart-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Bài viết đã thích</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#999"
                  style={styles.optionArrow}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.option}>
                <Ionicons name="time-outline" size={22} color="#333" />
                <Text style={styles.optionText}>Lịch sử hoạt động</Text>
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
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: "50%",
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
});

export default ProfileScreen;
