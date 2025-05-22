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
import { getActivities } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";

const ActivityItem = ({ item, navigation }) => {
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "like":
        return <Ionicons name="heart" size={20} color="#319527" />;
      case "dislike":
        return <Ionicons name="heart-dislike" size={20} color="#ef4444" />;
      case "comment":
        return <Ionicons name="chatbubble" size={20} color="#319527" />;
      case "comment_like":
        return <Ionicons name="thumbs-up" size={20} color="#319527" />;
      case "comment_dislike":
        return <Ionicons name="thumbs-down" size={20} color="#ef4444" />;
      case "post":
        return <Ionicons name="create" size={20} color="#319527" />;
      case "saved":
        return <Ionicons name="bookmark" size={20} color="#319527" />;
      default:
        return <Ionicons name="notifications" size={20} color="#319527" />;
    }
  };

  const getActivityText = (item) => {
    if (!item.type) {
      console.warn("Activity item missing type:", item);
      return "đã có hoạt động";
    }

    switch (item.type.toLowerCase()) {
      case "like":
        return "đã thích bài viết";
      case "dislike":
        return "không thích bài viết";
      case "comment":
        return item.content
          ? `đã bình luận: "${truncateText(item.content)}"`
          : "đã bình luận";
      case "comment_like":
        return item.comment?.content
          ? `đã thích bình luận: "${truncateText(item.comment.content)}"`
          : "đã thích bình luận";
      case "comment_dislike":
        return item.comment?.content
          ? `không thích bình luận: "${truncateText(item.comment.content)}"`
          : "không thích bình luận";
      case "post":
        return "đã đăng bài viết mới";
      case "share":
        return "đã chia sẻ bài viết";
      case "follow":
        return "đã theo dõi bạn";
      case "saved":
        return "đã lưu bài viết";
      default:
        console.warn("Unknown activity type:", item.type);
        return `đã ${item.type}`;
    }
  };

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("PostScreen", { postId: item.topic.id })
      }
      className="flex-row p-4 border-b border-gray-100"
    >
      <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
        {getActivityIcon(item.type)}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[15px] leading-5">
          <Text className="font-medium">Bạn</Text> {getActivityText(item)}
        </Text>
        <Text className="text-[15px] font-medium mt-1 text-gray-900">
          {item.topic?.title}
        </Text>
        <Text className="text-gray-500 text-[13px] mt-0.5">
          {item.updated_at}
        </Text>
      </View>
      {item.topic?.image_url && (
        <FastImage
          source={{
            uri: item.topic.image_url.startsWith("http")
              ? item.topic.image_url
              : `https://api.chuyenbienhoa.com${item.topic.image_url}`,
          }}
          className="w-[60px] h-[60px] rounded-lg ml-2"
          resizeMode={FastImage.resizeMode.cover}
        />
      )}
    </TouchableOpacity>
  );
};

const ActivityScreen = ({ navigation }) => {
  const [activities, setActivities] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn } = useContext(AuthContext);

  const fetchActivities = async () => {
    try {
      const response = await getActivities();

      if (!response?.data) {
        console.log("Invalid response structure:", response);
        Toast.show({
          type: "error",
          text1: "Đã có lỗi xảy ra",
          text2: "Không thể tải hoạt động. Vui lòng thử lại sau.",
          autoHide: true,
          visibilityTime: 5000,
          topOffset: 60,
        });
        return;
      }

      // Ensure unique activities by using a Map with composite key
      const uniqueActivities = Array.from(
        new Map(
          response.data.map((item) => [
            `${item.type}-${item.topic?.id}-${item.created_timestamp}`,
            item,
          ])
        ).values()
      );

      // Sort activities by timestamp, newest first
      const sortedActivities = uniqueActivities.sort(
        (a, b) => new Date(b.created_timestamp) - new Date(a.created_timestamp)
      );

      setActivities(sortedActivities);
    } catch (error) {
      console.log("Error fetching activities:", error);
      Toast.show({
        type: "error",
        text1: "Đã có lỗi xảy ra",
        text2: "Không thể tải hoạt động. Vui lòng thử lại sau.",
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
      fetchActivities();
    } else {
      setActivities(null);
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActivities();
    setRefreshing(false);
  };

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500 mb-4">
          Vui lòng đăng nhập để xem hoạt động
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
        <Text className="mt-4">Đang tải hoạt động...</Text>
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
        Chưa có hoạt động nào
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
          Hoạt động của bạn
        </Text>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => `${item.type}-${item.created_timestamp}`}
        renderItem={({ item }) => (
          <ActivityItem item={item} navigation={navigation} />
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

export default ActivityScreen;
