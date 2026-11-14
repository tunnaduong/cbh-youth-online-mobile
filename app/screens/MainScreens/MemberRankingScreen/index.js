import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMemberRanking, isRequestCanceled } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import FastImage from "../../../components/FastImage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import UserNameRow from "../../../components/profile/UserNameRow";
import StyledUsername from "../../../components/profile/StyledUsername";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";
import { tint } from "../../../components/settings/SettingsUI";

export default function MemberRankingScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);
  const headerHeight = 64 + insets.top;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const handleScroll = (event) => {
    scrollY.setValue(event.nativeEvent.contentOffset.y);
  };

  const fetchData = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      const response = await getMemberRanking(50, { signal: controller.signal }); // Get top 50
      if (controller.signal.aborted) return;
      if (response && response.data) {
        setRankingData(response.data);
      } else if (Array.isArray(response)) {
        setRankingData(response);
      }
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      console.log("Error fetching rankings:", error);
    } finally {
      if (!controller.signal.aborted) {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderTop3 = () => {
    if (rankingData.length < 3) return null;
    const [first, second, third] = rankingData;

    // One podium column: avatar (framed in the medal colour), name, points,
    // then the step with the rank number. Steps are flush with the card's
    // bottom edge, so the three columns read as a podium.
    const Place = ({ user, rank, color, avatar, stepHeight }) => (
      <TouchableOpacity
        style={styles.place}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("ProfileScreen", { username: user.username })}
      >
        {rank === 1 ? <Ionicons name="trophy" size={26} color="#F59E0B" style={{ marginBottom: 4 }} /> : null}
        <AvatarFrameWrap theme={user.profile_theme} size={avatar} style={styles.avatarWrapTop}>
          <FastImage
            source={{ uri: user.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${user.username}/avatar` }}
            style={{ width: avatar, height: avatar, borderRadius: avatar / 2, borderWidth: 3, borderColor: color }}
          />
        </AvatarFrameWrap>
        <UserNameRow
          name={user.profile_name}
          theme={user.profile_theme}
          style={[styles.nameTop, { color: theme.text, fontWeight: rank === 1 ? "800" : "600" }]}
          containerStyle={styles.nameTopRow}
        />
        <Text style={[styles.pointsTop, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>
          {t("profile.points", { count: user.total_points })}
        </Text>
        <View style={[styles.podiumStep, { height: stepHeight, backgroundColor: tint(color, isDarkMode) }]}>
          <Text style={[styles.podiumRank, { color }]}>{rank}</Text>
        </View>
      </TouchableOpacity>
    );

    return (
      <LinearGradient
        colors={isDarkMode ? ["rgba(245,158,11,0.26)", "rgba(245,158,11,0.08)"] : ["rgba(245,158,11,0.18)", "rgba(250,204,21,0.05)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.top3Container, { borderColor: isDarkMode ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.3)" }]}
      >
        <Place user={second} rank={2} color="#94A3B8" avatar={60} stepHeight={46} />
        <Place user={first} rank={1} color="#F59E0B" avatar={76} stepHeight={70} />
        <Place user={third} rank={3} color="#CD7F32" avatar={60} stepHeight={34} />
      </LinearGradient>
    );
  };

  const renderItem = ({ item, index }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.rankItem, { borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.surface }]}
        onPress={() =>
          navigation.navigate("ProfileScreen", { username: item.username })
        }
      >
        <View style={[styles.rankNumberWrap, { backgroundColor: theme.iconBackground }]}>
          <Text style={[styles.rankNumber, { color: theme.subText }]}>{index + 4}</Text>
        </View>
        <AvatarFrameWrap theme={item.profile_theme} size={44} style={styles.itemAvatarWrap}>
          <FastImage
            source={{
              uri:
                item.avatar_url ||
                `https://api.chuyenbienhoa.com/v1.0/users/${item.username}/avatar`,
            }}
            style={styles.itemAvatar}
          />
        </AvatarFrameWrap>
        <View style={styles.itemInfo}>
          <UserNameRow
            name={item.profile_name}
            theme={item.profile_theme}
            style={[styles.itemName, { color: theme.text }]}
          />
          <StyledUsername
            theme={item.profile_theme}
            username={item.username}
            style={[styles.itemUsername, { color: theme.subText }]}
            numberOfLines={1}
          />
        </View>
        <View style={[styles.pointsChip, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
          <Text style={[styles.itemPoints, { color: theme.primary }]}>{t('profile.points', { count: item.total_points })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <CustomLoading />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top ambient green glow */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 140,
          zIndex: 0,
        }}
        pointerEvents="none"
      />
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.floatingHeader}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
          <View style={{ width: 44 }}>
            <LiquidButton providerId="MemberRankingScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t('profile.ranking')}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="MemberRankingScreen" style={{ flex: 1 }}>
      <FlatList
        data={rankingData.length >= 3 ? rankingData.slice(3) : rankingData}
        keyExtractor={(item) => item.username}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === "android"}
        getItemLayout={(_data, index) => ({
          length: 76,
          offset: 76 * index,
          index,
        })}
        ListHeaderComponent={renderTop3()}
        contentContainerStyle={[styles.listContent, { paddingTop: headerHeight, paddingBottom: 20 + (insets?.bottom || 0) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            style={{ backgroundColor: "transparent" }}
          />
        }
      />
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  container: {
    flex: 1,
  },
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
  listContent: {
    paddingBottom: 20,
  },
  top3Container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 22,
    paddingHorizontal: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  place: {
    width: "32%",
    alignItems: "center",
  },
  avatarWrapTop: {
    marginBottom: 8,
  },
  nameTop: {
    fontSize: 13,
    textAlign: "center",
  },
  // Centred under the avatar; the name inside is cut with "…" if too long.
  nameTopRow: {
    maxWidth: "100%",
    marginBottom: 2,
  },
  pointsTop: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  podiumStep: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumRank: {
    fontSize: 26,
    fontWeight: "800",
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    height: 68,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankNumberWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  pointsChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 8,
  },
  itemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  itemAvatarWrap: {
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "500",
  },
  itemUsername: {
    fontSize: 13,
  },
  itemPoints: {
    fontSize: 13,
    fontWeight: "700",
  },
});
