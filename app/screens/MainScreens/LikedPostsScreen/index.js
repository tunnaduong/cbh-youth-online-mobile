import React, { useContext, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import { getLikedPosts } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "../../../components/FastImage";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../../contexts/ThemeContext";
const PostItem = ({ item, navigation, theme }) => {
  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("PostScreen", { postId: item.topic.id })
      }
      className="flex-row p-4"
      style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
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
          className="text-[15px] font-medium leading-5"
          style={{ color: theme.text }}
          numberOfLines={2}
        >
          {item.topic.title}
        </Text>
        <View className="flex-row items-center mt-1">
          <Text className="text-[13px]" style={{ color: theme.subText }}>
            {item.topic.author.profile_name}
          </Text>
          <Text className="mx-1" style={{ color: theme.subText }}>•</Text>
          <Text className="text-[13px]" style={{ color: theme.subText }}>{item.updated_at}</Text>
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();
  const fetchLikedPosts = async () => {
    try {
      const response = await getLikedPosts();

      if (!response?.data) {
        console.log("Invalid response structure:", response);
        Toast.show({
          type: "error",
          text1: t('common.error'),
          text2: t('likedPosts.loadError'),
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
        text1: t('common.error'),
        text2: t('likedPosts.loadError'),
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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <Text className="mb-4" style={{ color: theme.subText }}>
          {t('likedPosts.loginPrompt')}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <LottieView
          source={require("../../../assets/refresh.json")}
          style={{ width: 70, height: 70 }}
          loop
          autoPlay
        />
        <Text className="mt-4" style={{ color: theme.text }}>{t('likedPosts.loading')}</Text>
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
      <Text className="text-center mt-4" style={{ color: theme.subText }}>
        {t('likedPosts.empty')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
      <View
        style={{
          backgroundColor: theme.headerBackground,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
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
          {t('likedPosts.title')}
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => `${item.topic.id}`}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => (
          <PostItem item={item} navigation={navigation} theme={theme} />
        )}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            style={{ backgroundColor: "transparent" }}
          />
        }
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: insets.bottom + 16,
        }}
      />
      <Toast />
    </SafeAreaView>
  );
};

export default LikedPostsScreen;
