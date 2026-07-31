import React, { useContext, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import { getSavedPosts } from "../../../services/api/Api";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import Ionicons from "react-native-vector-icons/Ionicons";
import FastImage from "../../../components/FastImage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import formatTime from "../../../utils/formatTime";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

const SavedPostItem = ({ item, navigation, onOptionsPress, t, theme }) => (
  <TouchableOpacity
    onPress={() => navigation.navigate("PostScreen", { postId: item.topic.id })}
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
      className="w-[70px] h-[70px] rounded-lg"
      resizeMode={FastImage.resizeMode.cover}
    />
    <View className="flex-1 ml-3 pr-2">
      <Text numberOfLines={2} className="text-[15px] font-medium leading-5" style={{ color: theme.text }}>
        {item.topic.title}
      </Text>
      <View className="flex-row items-center mt-1">
        {item.topic.image_urls.length > 0 && (
          <>
            <Text className="text-[13px]" style={{ color: theme.subText }}>
              {t("savedPosts.postedPhotos", { count: item.topic.image_urls?.length || 1 })}
            </Text>
            <Text className="text-[13px] mx-1" style={{ color: theme.subText }}>•</Text>
          </>
        )}
        <Text className="text-[13px]" style={{ color: theme.subText }}>
          {item.topic.author.profile_name}
        </Text>
      </View>
      <Text className="text-[13px] mt-0.5" style={{ color: theme.subText }}>
        {t("savedPosts.savedTime", { time: item.created_at ? formatTime(item.created_at) : "" })}
      </Text>
    </View>
    <TouchableOpacity
      onPress={() => onOptionsPress(item)}
      className="px-2 py-1"
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={theme.subText} />
    </TouchableOpacity>
  </TouchableOpacity>
);

const SavedPostsScreen = ({ navigation }) => {
  const [savedPosts, setSavedPosts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { isLoggedIn } = useContext(AuthContext);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const headerHeight = 58 + insets.top;

  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollY.setValue(y);
    setShowScrollTop(y > 300);
  };

  const fetchSavedPosts = async () => {
    try {
      const response = await getSavedPosts();

      if (!response?.data) {
        Toast.show({
          type: "error",
          text1: t('common.error'),
          text2: t('savedPosts.invalidData'),
          autoHide: true,
          visibilityTime: 5000,
          topOffset: 60,
        });
        return;
      }

      setSavedPosts(response.data);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('savedPosts.loadError'),
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
    console.log("Options pressed for post:", item.id);
  };

  const ListHeader = () => (
    <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text className="text-[17px] font-medium" style={{ color: theme.text }}>{t("savedPosts.recentlySaved")}</Text>
    </View>
  );

  const ListEmptyComponent = () => (
    <View className="flex-1 items-center justify-center py-10">
      <Image
        source={require("../../../assets/sad_frog.png")}
        style={{ width: 130, height: 130 }}
      />
      <Text className="text-center mt-4" style={{ color: theme.subText }}>
        {t('savedPosts.empty')}
      </Text>
    </View>
  );

  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Floating header */}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
            <LiquidButton providerId="SavedPostsScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.subText }}>{t('savedPosts.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

  if (savedPosts === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Floating header */}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
            <LiquidButton providerId="SavedPostsScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
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
          <Text style={{ marginTop: 16, color: theme.text }}>{t('savedPosts.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
          <View style={{ width: 44 }}>
            <LiquidButton providerId="SavedPostsScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Text
            style={{ fontSize: 18, fontWeight: "600", color: theme.primary, flex: 1, textAlign: "center" }}
            numberOfLines={1}
          >
            {t('savedPosts.title')}
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="SavedPostsScreen" style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={savedPosts}
          extraData={t}
          keyExtractor={(item) => item.id.toString()}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <SavedPostItem
              item={item}
              navigation={navigation}
              onOptionsPress={handleOptionsPress}
              t={t}
              theme={theme}
            />
          )}
          ListHeaderComponent={ListHeader}
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
            providerId="SavedPostsScreenScrollTop"
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

export default SavedPostsScreen;
