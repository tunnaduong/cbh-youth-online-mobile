import React, { useContext, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getLikedPosts } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";

const PostItem = ({ item, navigation }) => {
  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("PostScreen", { postId: item.topic.id })
      }
      className="flex-row p-4 border-b border-gray-100"
    >
      <FastImage
        source={{
          uri:
            item.topic.image_urls.length > 0
              ? item.topic.image_urls[0]
              : `https://api.chuyenbienhoa.com/users/${item.topic.author.username}/avatar`,
        }}
        className="w-[80px] h-[80px] rounded-lg mr-3"
        resizeMode={FastImage.resizeMode.cover}
      />
      <View className="flex-1">
        <Text
          className="text-[15px] font-medium text-gray-900 leading-5"
          numberOfLines={2}
        >
          {item.topic.title}
        </Text>
        <View className="flex-row items-center mt-1">
          <Text className="text-[13px] text-gray-500">
            {item.topic.author.profile_name}
          </Text>
          <Text className="text-gray-400 mx-1">•</Text>
          <Text className="text-[13px] text-gray-500">{item.updated_at}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const LikedPostsScreen = ({ navigation }) => {
  const [posts, setPosts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn } = useContext(AuthContext);

  const fetchLikedPosts = async () => {
    try {
      const response = await getLikedPosts();

      if (!response?.data) {
        console.log("Invalid response structure:", response);
        Toast.show({
          type: "error",
          text1: "Đã có lỗi xảy ra",
          text2: "Không thể tải bài viết đã thích. Vui lòng thử lại sau.",
          autoHide: true,
          visibilityTime: 5000,
          topOffset: 60,
        });
        return;
      }

      // Sort posts by timestamp, newest first
      const sortedPosts = response.data.sort(
        (a, b) => new Date(b.created_timestamp) - new Date(a.created_timestamp)
      );

      setPosts(sortedPosts);
    } catch (error) {
      console.log("Error fetching liked posts:", error);
      Toast.show({
        type: "error",
        text1: "Đã có lỗi xảy ra",
        text2: "Không thể tải bài viết đã thích. Vui lòng thử lại sau.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isLoggedIn) {
      setIsLoading(true);
      fetchLikedPosts();
    } else {
      setPosts(null);
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLikedPosts();
    setRefreshing(false);
  };

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500 mb-4">
          Vui lòng đăng nhập để xem bài viết đã thích
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <LottieView
          source={require("../../../assets/refresh.json")}
          style={{ width: 70, height: 70 }}
          loop
          autoPlay
        />
        <Text className="mt-4">Đang tải bài viết đã thích...</Text>
      </View>
    );
  }

  const ListEmptyComponent = () => (
    <View className="flex-1 items-center justify-center py-10">
      <FastImage
        source={require("../../../assets/sad_frog.png")}
        style={{ width: 130, height: 130 }}
        resizeMode={FastImage.resizeMode.contain}
      />
      <Text className="text-gray-500 text-center mt-4">
        Bạn chưa thích bài viết nào
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View
        style={{
          backgroundColor: "#fff",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#f0f0f0",
          height: 50,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: "absolute",
            left: 16,
            zIndex: 1,
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: "#319527",
            flex: 1,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          Bài viết đã thích
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => `${item.topic.id}`}
        renderItem={({ item }) => (
          <PostItem item={item} navigation={navigation} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={{
          flexGrow: 1,
        }}
      />
      <Toast />
    </SafeAreaView>
  );
};

export default LikedPostsScreen;
