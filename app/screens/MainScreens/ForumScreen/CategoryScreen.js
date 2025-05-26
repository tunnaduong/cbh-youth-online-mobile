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
  const { categoryId } = route.params;

  useEffect(() => {
    fetchForumData();
  }, []);

  const fetchForumData = async () => {
    try {
      const response = await getSubforumPosts(categoryId);
      setForumData(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching forum data:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi tải dữ liệu",
        text2: "Không thể tải dữ liệu diễn đàn. Vui lòng thử lại sau.",
      });
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
      <SafeAreaView style={styles.loadingContainer}>
        <CustomLoading />
      </SafeAreaView>
    );
  }

  if (!forumData) {
    return (
      <SafeAreaView className="flex-1 bg-white">
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
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
        className="flex-1"
        refreshControl={
          <CustomRefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
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
