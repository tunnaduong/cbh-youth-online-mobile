import React, { useContext, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getActivities } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "../../../components/FastImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

const ActivityItem = ({ item, navigation, theme }) => {
  const { t } = useTranslation();
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
      return t("activity.unknown");
    }

    switch (item.type.toLowerCase()) {
      case "like":
        return t("activity.likedPost");
      case "dislike":
        return t("activity.dislikedPost");
      case "comment":
        return item.content
          ? `${t("activity.commented")}: "${truncateText(item.content)}"`
          : t("activity.commented");
      case "comment_like":
        return item.comment?.content
          ? `${t("activity.likedComment")}: "${truncateText(item.comment.content)}"`
          : t("activity.likedComment");
      case "comment_dislike":
        return item.comment?.content
          ? `${t("activity.dislikedComment")}: "${truncateText(item.comment.content)}"`
          : t("activity.dislikedComment");
      case "post":
        return t("activity.createdPost");
      case "share":
        return t("activity.sharedPost");
      case "follow":
        return `${t("activity.followed")} ${item.following?.profile_name}`;
      case "saved":
        return t("activity.savedPost");
      case "story_create":
        return t("activity.createdStory");
      case "story_reaction":
        return `${t("activity.likedStory")} ${item.story?.author?.profile_name}`;
      case "story_view":
        return `${t("activity.viewedStory")} ${item.story?.author?.profile_name}`;
      default:
        console.warn("Unknown activity type:", item.type);
        return `${item.type}`;
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
      className="flex-row p-4"
      style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
    >
      <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: theme.iconBackground }}>
        {getActivityIcon(item.type)}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[15px] leading-5" style={{ color: theme.text }}>
          <Text className="font-medium" style={{ color: theme.text }}>Bạn</Text> {getActivityText(item)}
        </Text>
        {item.topic && (
          <Text className="text-[15px] font-medium mt-1" style={{ color: theme.text }}>
            {item.topic?.title}
          </Text>
        )}
        <Text className="text-[13px] mt-0.5" style={{ color: theme.subText }}>
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
  const { t } = useTranslation();
  const { theme } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 64 + insets.top;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const fetchActivities = async () => {
    try {
      const response = await getActivities();

      if (!response?.data) {
        console.log("Invalid response structure:", response);
        Toast.show({
          type: "error",
          text1: t('common.error'),
          text2: t('activity.loadError'),
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
        text1: t('common.error'),
        text2: t('activity.loadError'),
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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <Text className="mb-4" style={{ color: theme.subText }}>
          Vui lòng đăng nhập để xem hoạt động
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text className="mt-4" style={{ color: theme.text }}>Đang tải hoạt động...</Text>
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
        Chưa có hoạt động nào
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
          <View style={{ width: 44 }}>
            <LiquidButton providerId="ActivityScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={{ fontSize: 18, fontWeight: "600", color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity }}
            numberOfLines={1}
          >
            Hoạt động của bạn
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="ActivityScreen" style={{ flex: 1 }}>
        <FlatList
          data={activities}
          keyExtractor={(item) => `${item.type}-${item.created_timestamp}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <ActivityItem item={item} navigation={navigation} theme={theme} />
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
            paddingTop: headerHeight,
            paddingBottom: insets.bottom || 0,
          }}
        />
      </AndroidGlassBackdrop>
      <Toast />
    </View>
  );
};

export default ActivityScreen;
