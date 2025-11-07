import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  SafeAreaView,
  ImageBackground,
  RefreshControl,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "react-native-fast-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomLoading from "../../../components/CustomLoading";
import CustomRefreshControl from "../../../components/CustomRefreshControl";
import axios from "axios";
import Toast from "react-native-toast-message";
import { getSubforumPosts } from "../../../services/api/Api";
import { LinearGradient } from "expo-linear-gradient";

const CategoryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forumData, setForumData] = useState(null);
  const { categoryId } = route.params || {};

  useEffect(() => {
    if (categoryId) {
      fetchForumData();
    } else {
      console.error("CategoryScreen: categoryId is missing from route params");
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không tìm thấy thông tin chuyên mục.",
      });
      setLoading(false);
    }
  }, [categoryId]);

  const fetchForumData = async () => {
    if (!categoryId) {
      console.error("CategoryScreen: Cannot fetch - categoryId is missing");
      setLoading(false);
      return;
    }

    try {
      console.log(
        "CategoryScreen: Fetching forum data for categoryId:",
        categoryId
      );
      const response = await getSubforumPosts(categoryId);
      console.log("CategoryScreen: Response received:", response);

      if (response && response.data) {
        setForumData(response.data);
      } else {
        throw new Error("Invalid response format");
      }
      setLoading(false);
    } catch (error) {
      console.error("CategoryScreen: Error fetching forum data:", {
        error,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        categoryId,
      });

      let errorMessage =
        "Không thể tải dữ liệu diễn đàn. Vui lòng thử lại sau.";
      let shouldNavigateBack = false;

      // Check if the error message indicates subforum not found
      const errorData = error.response?.data;
      const errorMessageText = errorData?.message || error.message || "";

      if (
        error.response?.status === 500 &&
        (errorMessageText.includes("No query results for model") ||
          errorMessageText.includes("ForumSubforum"))
      ) {
        // Subforum doesn't exist in database
        errorMessage = "Chuyên mục này không tồn tại hoặc đã bị xóa.";
        shouldNavigateBack = true;
      } else if (error.response?.status === 500) {
        errorMessage = "Lỗi máy chủ. Vui lòng thử lại sau.";
      } else if (error.response?.status === 404) {
        errorMessage = "Không tìm thấy chuyên mục này.";
        shouldNavigateBack = true;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Toast.show({
        type: "error",
        text1: "Lỗi tải dữ liệu",
        text2: errorMessage,
      });

      // Navigate back if subforum doesn't exist
      if (shouldNavigateBack) {
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      }

      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchForumData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.loadingContainer, { paddingTop: insets.top }]}
      >
        <CustomLoading />
      </SafeAreaView>
    );
  }

  if (!forumData) {
    return (
      <SafeAreaView
        style={[
          { flex: 1, backgroundColor: "#fff" },
          { paddingTop: insets.top },
        ]}
      >
        <View className="flex-row items-center justify-center h-[50px] relative px-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="absolute left-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#319527" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-[#319527]">Diễn đàn</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Image
            source={require("../../../assets/sad_frog.png")}
            className="w-20 h-20"
          />
          <Text>Không thể tải dữ liệu. Vui lòng thử lại sau.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ThreadItem = ({ thread }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("PostScreen", { postId: thread?.id })}
      className="flex-row p-4 border-b border-gray-200 bg-white"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-2">
          <FastImage
            source={{ uri: thread?.author?.avatar }}
            className="w-5 h-5 rounded-full"
          />
          <Text className="text-sm text-gray-600">
            {thread?.author?.profile_name}
          </Text>
          {thread?.author?.verified ? (
            <Ionicons name="checkmark-circle" size={14} color="#319527" />
          ) : (
            <></>
          )}
          <Text className="text-sm text-gray-400">· {thread?.created_at}</Text>
        </View>
        <Text className="text-base font-medium mb-3" numberOfLines={2}>
          {thread?.title}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="chatbubble-outline" size={16} color="#666" />
              <Text className="text-sm text-gray-500">
                {thread?.reply_count}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="eye-outline" size={16} color="#666" />
              <Text className="text-sm text-gray-500">
                {thread?.view_count}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            <Text
              className="text-sm text-gray-500 w-[140px] text-right"
              numberOfLines={1}
            >
              {thread?.latest_reply?.user?.profile_name}
            </Text>
            <Text className="text-sm text-gray-400">
              · {thread?.latest_reply?.created_at}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: "#fff" }, { paddingTop: insets.top }]}
    >
      {/* Custom Header */}
      <View
        style={{
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e5e5",
          height: 50,
        }}
      >
        <View className="flex-row items-center justify-center h-[50px] relative px-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="absolute left-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#319527" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-[#319527]">Diễn đàn</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        style={{
          flex: 1,
        }}
      >
        {/* Category Header */}
        <View className="bg-white border-b border-gray-200">
          <ImageBackground
            source={{ uri: forumData.subforum.background }}
            resizeMode="cover"
          >
            <LinearGradient
              colors={["#fff", "transparent"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 3, y: 0 }}
              style={{ position: "absolute", width: "100%", height: "100%" }}
            />
            <View className="p-4">
              <Text className="text-2xl font-bold mb-2">
                {forumData.subforum.name}
              </Text>
              <Text className="text-gray-600 leading-6">
                {forumData.subforum.description}
              </Text>
            </View>
          </ImageBackground>
        </View>

        {/* Thread List Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Text className="font-medium">Tiêu đề</Text>
          <Text className="font-medium">Bài viết cuối</Text>
        </View>

        {/* Thread List */}
        {forumData.topics.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Image
              source={require("../../../assets/sad_frog.png")}
              className="w-20 h-20 mt-10 mb-3"
            />
            <Text>Chưa có bài viết nào trong chuyên mục này.</Text>
          </View>
        ) : (
          forumData.topics.map((thread) => (
            <ThreadItem key={thread.id} thread={thread} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CategoryScreen;
