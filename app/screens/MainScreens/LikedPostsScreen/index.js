import React, { useContext, useRef, useState } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import BannerWatermark from "../../../components/BannerWatermark";
import { tint } from "../../../components/settings/SettingsUI";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import { getLikedPosts, isRequestCanceled } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import AppToast from "../../../components/AppToast";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import FastImage from "../../../components/FastImage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import UserNameRow from "../../../components/profile/UserNameRow";

const PostItem = ({ item, navigation, theme, isDarkMode }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate("PostScreen", { postId: item.topic.id })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 96,
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 12,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
        backgroundColor: theme.surface,
      }}
    >
      <FastImage
        source={{
          uri:
            item.topic.image_urls.length > 0
              ? item.topic.image_urls[0]
              : `https://api.chuyenbienhoa.com/users/${item.topic.author.username}/avatar`,
        }}
        style={{ width: 72, height: 72, borderRadius: 16 }}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", lineHeight: 20, color: theme.text }}>
          {item.topic.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          {/* profile_theme is shown when the API sends it for this list. */}
          <UserNameRow
            name={item.topic.author.profile_name}
            theme={item.topic.anonymous ? null : item.topic.author.profile_theme}
            style={{ fontSize: 12, color: theme.subText }}
          >
            <Text style={{ color: theme.subText, marginHorizontal: 4, flexShrink: 0 }}>•</Text>
            <Text style={{ fontSize: 12, color: theme.subText, flexShrink: 0 }}>{item.updated_at}</Text>
          </UserNameRow>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: tint("#EF4444", isDarkMode) }}>
            <Ionicons name="heart" size={11} color="#EF4444" />
          </View>
          {item.topic.image_urls.length > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: tint("#3B82F6", isDarkMode) }}>
              <Ionicons name="images" size={11} color="#3B82F6" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#3B82F6" }}>{item.topic.image_urls.length}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const LikedPostsScreen = ({ navigation }) => {
  const [posts, setPosts] = useState(null);
  const gradual = useGradualList(posts, 15);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn } = useContext(AuthContext);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);
  const headerHeight = 58 + insets.top;

  const [showScrollTop, setShowScrollTop] = useState(false);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const handleScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollY.setValue(y);
    setShowScrollTop(y > 300);
  };

  const fetchLikedPosts = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      const response = await getLikedPosts({ signal: controller.signal });
      if (controller.signal.aborted) return;

      if (!response?.data) {
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

      const sortedPosts = response.data.sort(
        (a, b) => new Date(b.created_timestamp) - new Date(a.created_timestamp)
      );

      setPosts(sortedPosts);
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('likedPosts.loadError'),
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
      fetchLikedPosts();
    } else {
      setPosts(null);
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
    await fetchLikedPosts();
    setRefreshing(false);
  };

  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <FloatingScreenHeader onBack={() => navigation.goBack()} scrollY={scrollY} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.subText }}>{t('likedPosts.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <FloatingScreenHeader onBack={() => navigation.goBack()} scrollY={scrollY} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ marginTop: 16, color: theme.text }}>{t('likedPosts.loading')}</Text>
        </View>
      </View>
    );
  }

  const ListHeader = () => (
    <LinearGradient
      colors={isDarkMode ? ["rgba(239,68,68,0.26)", "rgba(239,68,68,0.08)"] : ["rgba(239,68,68,0.16)", "rgba(244,63,94,0.05)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 4, marginBottom: 14, padding: 16, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: isDarkMode ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.28)", overflow: "hidden" }}
    >
      <BannerWatermark icon="heart" color="#EF4444" size={130} />
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tint("#EF4444", isDarkMode), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="heart" size={24} color="#EF4444" />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text }} numberOfLines={1}>{t("likedPosts.title")}</Text>
      </View>
      <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: tint("#EF4444", isDarkMode) }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#EF4444" }}>{posts?.length ?? 0}</Text>
      </View>
    </LinearGradient>
  );

  const ListEmptyComponent = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: tint("#EF4444", isDarkMode), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="heart-outline" size={40} color="#EF4444" />
      </View>
      <Text style={{ textAlign: "center", marginTop: 16, color: theme.subText }}>{t("likedPosts.empty")}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating header */}
      <FloatingScreenHeader title={t('likedPosts.title')} onBack={() => navigation.goBack()} scrollY={scrollY} />

      <AndroidGlassBackdrop providerId="LikedPostsScreen" style={{ flex: 1 }}>
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
          ref={flatListRef}
          data={gradual.visible}
          keyExtractor={(item) => `${item.topic.id}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          getItemLayout={(_data, index) => ({
            length: 106,
            offset: 106 * index,
            index,
          })}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <PostItem item={item} navigation={navigation} theme={theme} isDarkMode={isDarkMode} />
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
          ListFooterComponent={
            gradual.hasMore || gradual.loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : null
          }
          onEndReached={gradual.onEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: headerHeight,
            paddingBottom: insets.bottom + 16,
          }}
        />
      </AndroidGlassBackdrop>

      {/* Scroll to top float button */}
      {showScrollTop && (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, right: 20, zIndex: 20 }}>
          <LiquidButton
            providerId="LikedPostsScreenScrollTop"
            size={44}
            scrollY={scrollY}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Ionicons name="chevron-up" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      )}

      <AppToast />
    </View>
  );
};

export default LikedPostsScreen;
