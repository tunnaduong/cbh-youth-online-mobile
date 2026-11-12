import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Platform,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  ImageBackground,
  RefreshControl,
  Animated,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "../../../components/FastImage";
import UserNameRow from "../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import CustomLoading from "../../../components/CustomLoading";
import CustomRefreshControl from "../../../components/CustomRefreshControl";
import axios from "axios";
import Toast from "react-native-toast-message";
import { getSubforumPosts, isRequestCanceled } from "../../../services/api/Api";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import formatTime from "../../../utils/formatTime";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

import { getCategoryName, getCategoryDescription } from "../../../utils/forumUtils";

const SubforumHeader = ({ navigation, title, theme, scrollY, headerTitleOpacity, insets, categoryId, createLabel }) => (
  <View pointerEvents="box-none" style={styles.floatingHeader}>
    <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 64 + insets.top }}>
      <View style={{ width: 44 }}>
        <LiquidButton providerId="CategoryScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
      </View>
      <Animated.Text
        style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity ?? 1 }]}
        numberOfLines={1}
      >
        {title}
      </Animated.Text>
      <View style={{ width: 44, alignItems: "flex-end" }}>
        <LiquidButton
          providerId="CategoryScreen"
          size={44}
          scrollY={scrollY}
          accessibilityLabel={createLabel}
          onPress={() => navigation.navigate("CreatePostScreen", { categoryId })}
        >
          <Ionicons name="add" size={24} color={theme.primary} />
        </LiquidButton>
      </View>
    </View>
  </View>
);

const ThreadItem = React.memo(({ thread, lastItem, navigation, theme, t }) => (
  <TouchableOpacity
    onPress={() => navigation.navigate("PostScreen", { postId: thread?.id })}
    style={[
      styles.threadRow,
      {
        borderBottomWidth: lastItem ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      },
    ]}
  >
    <View style={styles.threadContentRow}>
      <View style={styles.threadMetaRow}>
        <AvatarFrameWrap theme={thread?.author?.profile_theme} size={20} style={{ marginRight: 8 }}>
          <FastImage
            source={{ uri: thread?.author?.avatar }}
            style={[styles.avatar, { marginRight: 0 }]}
          />
        </AvatarFrameWrap>
        <UserNameRow
          name={thread?.author?.profile_name}
          theme={thread?.author?.profile_theme}
          verified={!!thread?.author?.verified}
          verifiedSize={14}
          verifiedColor={theme.primary}
          style={[styles.metaName, { color: theme.text }]}
          containerStyle={{ flex: 1 }}
        >
          <Text style={[styles.metaDate, { color: theme.subText }]} numberOfLines={1}>
            {" · "}{thread?.created_at ? formatTime(thread?.created_at) : ""}{thread?.is_edited ? ` (${t('post.edited')})` : ""}
          </Text>
        </UserNameRow>
      </View>
      <View style={styles.threadRight}>
        <Text style={[styles.threadLatestName, { color: theme.subText }]} numberOfLines={1}>
          {thread?.latest_reply?.user?.profile_name}
        </Text>
        <Text style={[styles.threadLatestTime, { color: theme.subText }]} numberOfLines={1}>
          · {thread?.latest_reply?.created_at ? formatTime(thread?.latest_reply?.created_at) : ""}
        </Text>
      </View>
    </View>
    <Text style={[styles.threadTitle, { color: theme.text }]} numberOfLines={2} ellipsizeMode="tail">
      {thread?.title}
    </Text>
    <View style={styles.threadStatsRow}>
      <View style={styles.threadStatsGroup}>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble-outline" size={16} color={theme.subText} />
          <Text style={[styles.statText, { color: theme.subText }]}>{thread?.reply_count}+</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="eye-outline" size={16} color={theme.subText} />
          <Text style={[styles.statText, { color: theme.subText }]}>{thread?.view_count}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
));

const CategoryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forumData, setForumData] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const { categoryId } = route.params || {};
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 64 + insets.top;
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const handleScroll = (event) => {
    scrollY.setValue(event.nativeEvent.contentOffset.y);
  };

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
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isFetchingRef.current = false;
    };
  }, [categoryId]);

  const fetchForumData = async () => {
    if (!categoryId) {
      console.error("CategoryScreen: Cannot fetch - categoryId is missing");
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      const response = await getSubforumPosts(categoryId, { signal: controller.signal });
      if (controller.signal.aborted) return;

      if (response && response.data) {
        setForumData(response.data);
      } else {
        throw new Error("Invalid response format");
      }
      setLoading(false);
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
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
    } finally {
      if (!controller.signal.aborted) {
        isFetchingRef.current = false;
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchForumData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <SubforumHeader navigation={navigation} title={t('forum.title')} theme={theme} scrollY={scrollY} insets={insets} categoryId={categoryId} createLabel={t("createPost.title")} />
        <View style={[styles.loadingContainer, { backgroundColor: theme.background, paddingTop: headerHeight }]}>
          <CustomLoading />
        </View>
      </View>
    );
  }

  if (!forumData) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <SubforumHeader navigation={navigation} title={t('forum.title')} theme={theme} scrollY={scrollY} insets={insets} categoryId={categoryId} createLabel={t("createPost.title")} />
        <View style={[styles.loadingContainer, { backgroundColor: theme.background, paddingTop: headerHeight }]}>
          <Image
            source={require("../../../assets/sad_frog.png")}
            style={{ width: 80, height: 80 }}
          />
          <Text style={{ color: theme.subText }}>{t('forum.loadError')}</Text>
        </View>
      </View>
    );
  }

  const descriptionText = getCategoryDescription(forumData.subforum.description, t);
  const isDescriptionLong = descriptionText.length > 120;

  const renderCategoryBanner = () => (
    <View style={{ backgroundColor: "transparent", borderBottomWidth: 1, borderBottomColor: theme.border, overflow: "hidden" }}>
      <ImageBackground
        source={{ uri: forumData.subforum.background }}
        resizeMode="cover"
        style={{ width: "100%", justifyContent: "center" }}
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
          <Text
            style={{ color: theme.subText, lineHeight: 22 }}
            numberOfLines={descExpanded ? undefined : 3}
          >
            {descriptionText}
          </Text>
          {isDescriptionLong && (
            <TouchableOpacity
              onPress={() => setDescExpanded((prev) => !prev)}
              style={{ marginTop: 6, alignSelf: "flex-start" }}
              hitSlop={8}
            >
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>
                {descExpanded ? t("common.collapse", "Thu gọn") : t("common.showMore", "Xem thêm")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ImageBackground>
    </View>
  );

  const renderListHeader = () => (
    <>
      {renderCategoryBanner()}
      {forumData.topics.length > 0 && (
        <View style={styles.threadListWrapper}>
          <View style={[styles.threadListHeader, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
            <Text style={{ fontWeight: "600", fontSize: 13, color: theme.subText }}>{t('forum.threadTitle')}</Text>
            <Text style={{ fontWeight: "600", fontSize: 13, color: theme.subText }}>{t('forum.lastPost')}</Text>
          </View>
        </View>
      )}
    </>
  );

  const renderThreadItem = ({ item, index }) => {
    const isFirst = index === 0;
    const isLast = index === forumData.topics.length - 1;
    return (
      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderTopWidth: isFirst ? StyleSheet.hairlineWidth : 0,
          borderTopLeftRadius: isFirst ? 16 : 0,
          borderTopRightRadius: isFirst ? 16 : 0,
          borderBottomLeftRadius: isLast ? 16 : 0,
          borderBottomRightRadius: isLast ? 16 : 0,
          overflow: "hidden",
        }}
      >
        <ThreadItem thread={item} lastItem={isLast} navigation={navigation} theme={theme} t={t} />
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
      <Image
        source={require("../../../assets/sad_frog.png")}
        style={{ width: 80, height: 80, marginTop: 40, marginBottom: 12 }}
      />
      <Text style={{ color: theme.subText }}>{t('forum.noPostsInCategory')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SubforumHeader
        navigation={navigation}
        title={t('forum.title')}
        theme={theme}
        scrollY={scrollY}
        headerTitleOpacity={headerTitleOpacity}
        insets={insets}
        categoryId={categoryId}
        createLabel={t("createPost.title")}
      />

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

      <AndroidGlassBackdrop providerId="CategoryScreen" style={{ flex: 1 }}>
        <FlatList
          data={forumData.topics}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderThreadItem}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyComponent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          style={{
            flex: 1,
            backgroundColor: theme.background,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 16 }}
        />
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  threadListWrapper: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  threadListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  threadListCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  threadRow: {
    padding: 16,
  },
  threadContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  threadRight: {
    width: 120,
    alignItems: "flex-end",
    minWidth: 0,
  },
  threadMetaRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  metaText: {
    fontSize: 14,
    marginRight: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  // Author line: the name truncates, the date after it never does.
  metaName: {
    fontSize: 14,
  },
  metaDate: {
    fontSize: 14,
    flexShrink: 0,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 12,
    minWidth: 0,
  },
  threadStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  threadStatsGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    marginLeft: 4,
  },
  threadLatestContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  threadLatestName: {
    fontSize: 14,
    textAlign: "right",
    minWidth: 0,
  },
  threadLatestTime: {
    fontSize: 14,
    textAlign: "right",
    minWidth: 0,
  },
});

export default CategoryScreen;
