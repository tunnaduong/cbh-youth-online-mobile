import React, { useContext, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import { getLikedPosts } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "../../../components/FastImage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

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
  const { theme, isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
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
    try {
      const response = await getLikedPosts();

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
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
            <LiquidButton providerId="LikedPostsScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.subText }}>{t('likedPosts.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
            <LiquidButton providerId="LikedPostsScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LottieView
            source={require("../../../assets/refresh.json")}
            style={{ width: 70, height: 70 }}
            loop
            autoPlay
          />
          <Text style={{ marginTop: 16, color: theme.text }}>{t('likedPosts.loading')}</Text>
        </View>
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
          <View style={{ width: 44 }}>
            <LiquidButton providerId="LikedPostsScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={{ fontSize: 18, fontWeight: "600", color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity }}
            numberOfLines={1}
          >
            {t('likedPosts.title')}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="LikedPostsScreen" style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => `${item.topic.id}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
            alwaysBorder
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Ionicons name="chevron-up" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      )}

      <Toast />
    </View>
  );
};

export default LikedPostsScreen;
