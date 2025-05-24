import React, { useContext, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getSavedPosts } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";

const SavedPostItem = ({ item, navigation, onOptionsPress }) => (
  <TouchableOpacity
    onPress={() => navigation.navigate("PostScreen", { postId: item.topic.id })}
    className="flex-row p-4 border-b border-gray-100"
  >
    <FastImage
      source={{
        uri:
          item.topic.image_urls.length > 0
            ? item.topic.image_urls[0]
            : `https://api.chuyenbienhoa.com/users/${item.topic.author.username}/avatar`,
      }}
      className="w-[70px] h-[70px] rounded-lg"
      resizeMode={FastImage.resizeMode.cover}
    />
    <View className="flex-1 ml-3 pr-2">
      <Text numberOfLines={2} className="text-[15px] font-medium leading-5">
        {item.topic.title}
      </Text>
      <View className="flex-row items-center mt-1">
        {item.topic.image_urls.length > 0 && (
          <>
            <Text className="text-gray-500 text-[13px]">
              Đăng {item.topic.image_urls?.length || 1} ảnh
            </Text>
            <Text className="text-gray-500 text-[13px] mx-1">•</Text>
          </>
        )}
        <Text className="text-gray-500 text-[13px]">
          {item.topic.author.profile_name}
        </Text>
      </View>
      <Text className="text-gray-500 text-[13px] mt-0.5">
        Lưu {item.created_at}
      </Text>
    </View>
    <TouchableOpacity
      onPress={() => onOptionsPress(item)}
      className="px-2 py-1"
    >
      <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
    </TouchableOpacity>
  </TouchableOpacity>
);

const SavedPostsScreen = ({ navigation }) => {
  const [savedPosts, setSavedPosts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { isLoggedIn } = useContext(AuthContext);

  const fetchSavedPosts = async () => {
    try {
      const response = await getSavedPosts();

      if (!response?.data) {
        console.log("Invalid response structure:", response);
        Toast.show({
          type: "error",
          text1: "Đã có lỗi xảy ra",
          text2: "Định dạng dữ liệu không hợp lệ. Vui lòng thử lại sau.",
          autoHide: true,
          visibilityTime: 5000,
          topOffset: 60,
        });
        return;
      }

      setSavedPosts(response.data);
    } catch (error) {
      console.log("Error fetching saved posts:", error);
      Toast.show({
        type: "error",
        text1: "Đã có lỗi xảy ra",
        text2: "Không thể tải bài viết đã lưu. Vui lòng thử lại sau.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    }
  };

  React.useEffect(() => {
    if (isLoggedIn) {
      fetchSavedPosts();
    } else {
      setSavedPosts(null);
    }
  }, [isLoggedIn]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSavedPosts().finally(() => {
      setRefreshing(false);
    });
  };

  const handleOptionsPress = (item) => {
    // TODO: Show options modal/sheet for the post
    console.log("Options pressed for post:", item.id);
  };

  const ListHeader = () => (
    <View className="px-4 py-3 border-b border-gray-100">
      <Text className="text-[17px] font-medium">Đã lưu gần đây</Text>
    </View>
  );

  const ListEmptyComponent = () => (
    <View className="flex-1 items-center justify-center py-10">
      <Image
        source={require("../../../assets/sad_frog.png")}
        style={{ width: 130, height: 130 }}
      />
      <Text className="text-gray-500 text-center mt-4">
        Bạn chưa lưu bài viết nào
      </Text>
    </View>
  );

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500 mb-4">
          Vui lòng đăng nhập để xem bài viết đã lưu
        </Text>
      </View>
    );
  }

  if (savedPosts === null) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <LottieView
          source={require("../../../assets/refresh.json")}
          style={{
            width: 70,
            height: 70,
          }}
          loop
          autoPlay
        />
        <Text className="mt-4">Đang tải bài viết đã lưu...</Text>
      </View>
    );
  }

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
          Bài viết đã lưu
        </Text>
      </View>

      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <SavedPostItem
            item={item}
            navigation={navigation}
            onOptionsPress={handleOptionsPress}
          />
        )}
        ListHeaderComponent={ListHeader}
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

export default SavedPostsScreen;
