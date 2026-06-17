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
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import formatTime from "../../../utils/formatTime";

const getCategoryName = (name, t) => {
  if (!name) return name;
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const keyMap = {
    "thông báo": "announcements",
    "thông báo chung": "generalAnnouncements",
    "chung": "general",
    "đoàn - hội": "unionAssociation",
    "đoàn-hội": "unionAssociation",
    "học tập": "academics",
    "sự kiện": "events",
    "câu lạc bộ": "clubs",
    "góc chia sẻ": "sharingCorner",
    "tán gẫu": "casual",
    "tán gẫu linh tinh": "casual",
    "hỏi đáp": "qa",
    "góp ý": "feedback",
    "ý kiến & đóng góp": "feedback",
    "ý kiến đóng góp": "feedback",
    "thảo luận": "discussion",
    "báo cáo": "reports",
    "phản hồi về diễn đàn": "forumFeedback",
    "phản hồi diễn đàn": "forumFeedback",
    "nội quy": "rules",
    "nội quy diễn đàn": "forumRules",
    "tin tức": "news",
    "giải trí": "entertainment",
    "tài liệu": "documents",
    "tài liệu học tập": "academicDocuments",
    "tâm sự": "confessions",
    "chuyện của trường": "schoolStories",
    "hoạt động ngoại khóa": "extracurricular",
    "hỗ trợ kỹ thuật": "technicalSupport"
  };
  const key = keyMap[normalized];
  if (key) {
    const translated = t(`forumCategories.${key}`);
    if (translated !== `forumCategories.${key}`) {
      return translated;
    }
  }
  return name;
};

const CategoryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
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
        text1: t("common.error"),
        text2: t("forum.categoryNotFound"),
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
        t("forum.loadError");
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
        errorMessage = t("forum.categoryDeleted");
        shouldNavigateBack = true;
      } else if (error.response?.status === 500) {
        errorMessage = t("forum.serverError");
      } else if (error.response?.status === 404) {
        errorMessage = t("forum.categoryNotFound2");
        shouldNavigateBack = true;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Toast.show({
        type: "error",
        text1: t("forum.loadDataError"),
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
        style={[styles.loadingContainer, { paddingTop: insets.top, backgroundColor: theme.background }]}
      >
        <CustomLoading />
      </SafeAreaView>
    );
  }

  if (!forumData) {
    return (
      <SafeAreaView
        style={[
          { flex: 1, backgroundColor: theme.background },
          { paddingTop: insets.top },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", height: 50, position: "relative", paddingHorizontal: 16, backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ position: "absolute", left: 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.primary }}>{t('forum.title')}</Text>
        </View>
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <Image
            source={require("../../../assets/sad_frog.png")}
            style={{ width: 80, height: 80 }}
          />
          <Text style={{ color: theme.subText }}>{t('forum.loadError')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ThreadItem = ({ thread }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("PostScreen", { postId: thread?.id })}
      style={{
        flexDirection: "row",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.cardBackground,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <FastImage
            source={{ uri: thread?.author?.avatar }}
            style={{ width: 20, height: 20, borderRadius: 10 }}
          />
          <Text style={{ fontSize: 14, color: theme.text }}>
            {thread?.author?.profile_name}
          </Text>
          {thread?.author?.verified ? (
            <Ionicons name="checkmark-circle" size={14} color={theme.primary} />
          ) : (
            <></>
          )}
          <Text style={{ fontSize: 14, color: theme.subText }}>· {thread?.created_at ? formatTime(thread?.created_at) : ""}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: "500", marginBottom: 12, color: theme.text }} numberOfLines={2}>
          {thread?.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={16} color={theme.subText} />
              <Text style={{ fontSize: 14, color: theme.subText }}>
                {thread?.reply_count}+
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="eye-outline" size={16} color={theme.subText} />
              <Text style={{ fontSize: 14, color: theme.subText }}>
                {thread?.view_count}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text
              style={{ fontSize: 14, color: theme.subText, width: 140, textAlign: "right" }}
              numberOfLines={1}
            >
              {thread?.latest_reply?.user?.profile_name}
            </Text>
            <Text style={{ fontSize: 14, color: theme.subText }}>
              · {thread?.latest_reply?.created_at ? formatTime(thread?.latest_reply?.created_at) : ""}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.background }, { paddingTop: insets.top }]}
    >
      {/* Custom Header */}
      <View
        style={{
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          height: 50,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", height: 50, position: "relative", paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ position: "absolute", left: 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.primary }}>{t('forum.title')}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        style={{
          flex: 1,
          backgroundColor: theme.background,
        }}
      >
        {/* Category Header */}
        <View style={{ backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <ImageBackground
            source={{ uri: forumData.subforum.background }}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[theme.background, "transparent"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 3, y: 0 }}
              style={{ position: "absolute", width: "100%", height: "100%" }}
            />
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 8, color: theme.text }}>
                {getCategoryName(forumData.subforum.name, t)}
              </Text>
              <Text style={{ color: theme.subText, lineHeight: 24 }}>
                {forumData.subforum.description}
              </Text>
            </View>
          </ImageBackground>
        </View>

        {/* Thread List Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isDarkMode ? "#1e2e1c" : "#F3FDF1", borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ fontWeight: "500", color: theme.text }}>{t('forum.threadTitle')}</Text>
          <Text style={{ fontWeight: "500", color: theme.text }}>{t('forum.lastPost')}</Text>
        </View>

        {/* Thread List */}
        {forumData.topics.length === 0 ? (
          <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
            <Image
              source={require("../../../assets/sad_frog.png")}
              style={{ width: 80, height: 80, marginTop: 40, marginBottom: 12 }}
            />
            <Text style={{ color: theme.subText }}>{t('forum.noPostsInCategory')}</Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CategoryScreen;
