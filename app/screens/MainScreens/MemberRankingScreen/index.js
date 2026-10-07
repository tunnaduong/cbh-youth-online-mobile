import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMemberRanking } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import FastImage from "../../../components/FastImage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import UserNameRow from "../../../components/profile/UserNameRow";
import StyledUsername from "../../../components/profile/StyledUsername";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";

export default function MemberRankingScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
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
    try {
      const response = await getMemberRanking(50); // Get top 50
      if (response && response.data) {
        setRankingData(response.data);
      } else if (Array.isArray(response)) {
        setRankingData(response);
      }
    } catch (error) {
      console.log("Error fetching rankings:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderTop3 = () => {
    if (rankingData.length < 3) return null;
    const [first, second, third] = rankingData;

    return (
      <View style={[styles.top3Container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Second Place */}
        <TouchableOpacity
          style={[styles.top3Item, { marginTop: 40 }]}
          onPress={() =>
            navigation.navigate("ProfileScreen", { username: second.username })
          }
        >
          <View style={[styles.rankBadge2, { borderColor: theme.background }]}>
            <Text style={styles.rankText}>2</Text>
          </View>
          <AvatarFrameWrap theme={second.profile_theme} size={60} style={styles.avatarWrapTop}>
            <FastImage
              source={{
                uri:
                  second.avatar_url ||
                  `https://api.chuyenbienhoa.com/v1.0/users/${second.username}/avatar`,
              }}
              style={styles.avatarTop2}
            />
          </AvatarFrameWrap>
          <UserNameRow
            name={second.profile_name}
            theme={second.profile_theme}
            style={[styles.nameTop, { color: theme.text }]}
            containerStyle={styles.nameTopRow}
          />
          <Text style={[styles.pointsTop, { color: theme.primary }]}>{t('profile.points', { count: second.total_points })}</Text>
        </TouchableOpacity>

        {/* First Place */}
        <TouchableOpacity
          style={styles.top3Item}
          onPress={() =>
            navigation.navigate("ProfileScreen", { username: first.username })
          }
        >
          <View style={styles.crownContainer}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
          </View>
          <AvatarFrameWrap theme={first.profile_theme} size={80} style={styles.avatarWrapTop}>
            <FastImage
              source={{
                uri:
                  first.avatar_url ||
                  `https://api.chuyenbienhoa.com/v1.0/users/${first.username}/avatar`,
              }}
              style={styles.avatarTop1}
            />
          </AvatarFrameWrap>
          <View style={[styles.rankBadge1, { borderColor: theme.background }]}>
            <Text style={styles.rankText}>1</Text>
          </View>
          <UserNameRow
            name={first.profile_name}
            theme={first.profile_theme}
            style={[styles.nameTop, { fontWeight: "bold", fontSize: 16, color: theme.text }]}
            containerStyle={[styles.nameTopRow, { marginTop: 18 }]}
          />
          <Text style={[styles.pointsTop, { color: theme.primary }]}>{t('profile.points', { count: first.total_points })}</Text>
        </TouchableOpacity>

        {/* Third Place */}
        <TouchableOpacity
          style={[styles.top3Item, { marginTop: 40 }]}
          onPress={() =>
            navigation.navigate("ProfileScreen", { username: third.username })
          }
        >
          <View style={[styles.rankBadge3, { borderColor: theme.background }]}>
            <Text style={styles.rankText}>3</Text>
          </View>
          <AvatarFrameWrap theme={third.profile_theme} size={60} style={styles.avatarWrapTop}>
            <FastImage
              source={{
                uri:
                  third.avatar_url ||
                  `https://api.chuyenbienhoa.com/v1.0/users/${third.username}/avatar`,
              }}
              style={styles.avatarTop2}
            />
          </AvatarFrameWrap>
          <UserNameRow
            name={third.profile_name}
            theme={third.profile_theme}
            style={[styles.nameTop, { color: theme.text }]}
            containerStyle={styles.nameTopRow}
          />
          <Text style={[styles.pointsTop, { color: theme.primary }]}>{t('profile.points', { count: third.total_points })}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    if (index < 3) return null; // Skip top 3, handled separately

    return (
      <TouchableOpacity
        style={[styles.rankItem, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}
        onPress={() =>
          navigation.navigate("ProfileScreen", { username: item.username })
        }
      >
        <Text style={[styles.rankNumber, { color: theme.subText }]}>#{index + 1}</Text>
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
        <Text style={[styles.itemPoints, { color: theme.primary }]}>{t('profile.points', { count: item.total_points })}</Text>
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
        data={rankingData}
        keyExtractor={(item) => item.username}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
    justifyContent: "space-around",
    paddingVertical: 28,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  top3Item: {
    alignItems: "center",
    width: "30%",
  },
  avatarTop1: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  avatarTop2: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#C0C0C0",
  },
  avatarWrapTop: {
    marginBottom: 8,
  },
  nameTop: {
    fontSize: 14,
    textAlign: "center",
  },
  // Centred under the avatar; the name inside is cut with "…" if too long.
  nameTopRow: {
    maxWidth: "100%",
    marginBottom: 2,
  },
  pointsTop: {
    fontSize: 13,
    fontWeight: "bold",
  },
  crownContainer: {
    position: "absolute",
    top: -28,
    zIndex: 1,
  },
  rankBadge1: {
    position: "absolute",
    bottom: 45,
    backgroundColor: "#FFD700",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  rankBadge2: {
    position: "absolute",
    top: -10,
    zIndex: 1,
    backgroundColor: "#C0C0C0",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  rankBadge3: {
    position: "absolute",
    top: -10,
    zIndex: 1,
    backgroundColor: "#CD7F32",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  rankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rankNumber: {
    width: 40,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginRight: 10,
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
    fontSize: 15,
    fontWeight: "bold",
  },
});
