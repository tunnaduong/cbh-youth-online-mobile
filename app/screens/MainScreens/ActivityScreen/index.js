import React, { useContext, useRef, useState } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  StyleSheet,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getActivities, isRequestCanceled } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import AppToast from "../../../components/AppToast";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import FastImage from "../../../components/FastImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import CustomLoading from "../../../components/CustomLoading";
import BannerWatermark from "../../../components/BannerWatermark";
import { tint } from "../../../components/settings/SettingsUI";

const ActivityItem = ({ item, navigation, theme, isDarkMode }) => {
  const { t } = useTranslation();
  const truncateText = (text, maxLength = 30) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Each kind of activity has its own icon and colour.
  const LOOK = {
    like: ["heart", "#EF4444"],
    dislike: ["heart-dislike", "#64748B"],
    comment: ["chatbubble", "#3B82F6"],
    comment_like: ["thumbs-up", "#10B981"],
    comment_dislike: ["thumbs-down", "#64748B"],
    post: ["create", "#8B5CF6"],
    share: ["share-social", "#14B8A6"],
    saved: ["bookmark", "#F59E0B"],
    follow: ["person-add", "#EC4899"],
    story_create: ["images", "#F97316"],
    story_reaction: ["heart", "#EF4444"],
    story_view: ["eye", "#6366F1"],
  };
  const [lookIcon, lookColor] = LOOK[item.type] || ["notifications", "#22C55E"];

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
      activeOpacity={0.8}
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
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 14,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
        backgroundColor: theme.surface,
      }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tint(lookColor, isDarkMode), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={lookIcon} size={20} color={lookColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>
          <Text style={{ fontWeight: "700", color: theme.text }}>{t("activity.you")}</Text> {getActivityText(item)}
        </Text>
        {item.topic && (
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", marginTop: 3, color: theme.text }}>
            {item.topic?.title}
          </Text>
        )}
        <Text style={{ fontSize: 12, marginTop: 3, color: theme.subText }}>{item.updated_at}</Text>
      </View>
      {/* Show post image */}
      {item.topic?.image_urls.length > 0 && (
        <FastImage
          source={{ uri: item.topic.image_urls[0] }}
          style={{ width: 56, height: 56, borderRadius: 14, marginLeft: 10 }}
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
          style={{ width: 56, height: 56, borderRadius: 14, marginLeft: 10 }}
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
  const { theme, isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      const response = await getActivities({ signal: controller.signal });
      if (controller.signal.aborted) return;

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
      if (isRequestCanceled(error) || controller.signal.aborted) return;
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
      if (!controller.signal.aborted) {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
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
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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
          {t("activity.loginPrompt")}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <CustomLoading size={60} />
        <Text className="mt-4" style={{ color: theme.text }}>{t("activity.loading")}</Text>
      </View>
    );
  }

  const ListHeader = () => (
    <LinearGradient
      colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 4, marginBottom: 14, padding: 16, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: isDarkMode ? "#1B472C" : "#D5EBD7", overflow: "hidden" }}
    >
      <BannerWatermark icon="time" size={130} />
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tint("#22C55E", isDarkMode), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="time" size={24} color={theme.primary} />
      </View>
      <Text style={{ flex: 1, marginLeft: 14, fontSize: 18, fontWeight: "800", color: theme.text }} numberOfLines={1}>
        {t("activity.title")}
      </Text>
    </LinearGradient>
  );

  const ListEmptyComponent = () => (
    <View className="flex-1 items-center justify-center py-10">
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: tint("#22C55E", isDarkMode), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="time-outline" size={40} color={theme.primary} />
      </View>
      <Text className="text-center mt-4" style={{ color: theme.subText }}>
        {t("activity.empty")}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating header */}
      <FloatingScreenHeader title={t("activity.title")} onBack={() => navigation.goBack()} scrollY={scrollY} />

      <AndroidGlassBackdrop providerId="ActivityScreen" style={{ flex: 1 }}>
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
          pointerEvents="none"
        />
        <FlatList
          data={activities}
          keyExtractor={(item) => `${item.type}-${item.created_timestamp}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <ActivityItem item={item} navigation={navigation} theme={theme} isDarkMode={isDarkMode} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressViewOffset={headerHeight}
            />
          }
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: headerHeight,
            paddingBottom: insets.bottom || 0,
          }}
        />
      </AndroidGlassBackdrop>
      <AppToast />
    </View>
  );
};

export default ActivityScreen;
