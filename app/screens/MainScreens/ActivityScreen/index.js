import React, { useContext, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getActivities } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
      case "follow":
        return <Ionicons name="person" size={20} color="#319527" />;
      case "story_create":
        return (
          <Image
            source={require("../../../assets/story.png")}
            style={{ width: 20, height: 20 }}
          />
        );
      case "story_reaction":
        return <Ionicons name="heart" size={20} color="#319527" />;
      case "story_view":
        return <Ionicons name="eye" size={20} color="#319527" />;
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
        return `đã theo dõi ${item.following?.profile_name}`;
      case "saved":
        return "đã lưu bài viết";
      case "story_create":
        return "đã đăng tin mới";
      case "story_reaction":
        return `đã thích tin của ${item.story?.author?.profile_name}`;
      case "story_view":
        return `đã xem tin của ${item.story?.author?.profile_name}`;
      default:
        console.warn("Unknown activity type:", item.type);
        return `đã ${item.type}`;
    }
  };

  return (
    <TouchableOpacity
      onPress={() => {
        if (item.type === "follow") {
          navigation.navigate("ProfileScreen", {
            username: item.following.username,
          });
        } else if (item.type === "story_create") {
        } else if (item.type === "story_reaction") {
        } else if (item.type === "story_view") {
        } else {
          navigation.navigate("PostScreen", { postId: item.topic.id });
        }
      }}
      className="flex-row p-4 border-b border-gray-100"
    >
      <View className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
        {getActivityIcon(item.type)}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[15px] leading-5">
          <Text className="font-medium">Bạn</Text> {getActivityText(item)}
        </Text>
        {item.topic && (
          <Text className="text-[15px] font-medium mt-1 text-gray-900">
            {item.topic?.title}
          </Text>
        )}
        <Text className="text-gray-500 text-[13px] mt-0.5">
          {item.updated_at}
        </Text>
      </View>
      {/* Show post image */}
      {item.topic?.image_urls.length > 0 && (
        <FastImage
          source={{
            uri: item.topic.image_urls[0],
          }}
          className="w-[60px] h-[60px] rounded-lg ml-2"
          resizeMode={FastImage.resizeMode.cover}
        />
      )}
      {/* Show story image */}
      {item.story?.media_url && (
        <FastImage
          source={{
            uri: item.story.media_url.startsWith("http")
              ? item.story.media_url
              : `https://api.chuyenbienhoa.com${item.story.media_url}`,
          }}
          className="w-[60px] h-[60px] rounded-lg ml-2"
          resizeMode={FastImage.resizeMode.cover}
        />
      )}
    </TouchableOpacity>
  );
};

const ActivityScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#f0f0f0",
          height: 50,
          backgroundColor: "#fff",
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
        <View style={{ width: 24, height: 24 }}></View>
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
