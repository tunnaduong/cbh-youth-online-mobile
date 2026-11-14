import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FastImage from "../../../../components/FastImage";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import UserNameRow from "../../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../../components/profile/AvatarFrame";
import BannerWatermark from "../../../../components/BannerWatermark";
import { tint } from "../../../../components/settings/SettingsUI";
import { getGames, getRandomGame, getGameNowPlaying, getGameLeaderboard, isRequestCanceled } from "../../../../services/api/Api";

// Category values are backend-defined (English) - only these get translated;
// game names/descriptions are never translated.
const CATEGORY_KEYS = [
  "all",
  "arcade",
  "puzzle",
  "racing",
  "adventure",
  "shooting",
  "sports",
  "other",
];

const CARD_GAP = 12;

// Section title with a tinted round icon.
const SectionTitle = ({ icon, color, title, theme, isDarkMode }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 4 }}>
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: tint(color, isDarkMode), alignItems: "center", justifyContent: "center", marginRight: 8 }}>
      <Ionicons name={icon} size={14} color={color} />
    </View>
    <Text style={{ fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: theme.subText, flex: 1 }}>{title}</Text>
  </View>
);
const GAMES_PAGE_SIZE = 16;

const GameCard = React.memo(({ game, width, t, onPress, theme, rank, badge, isDarkMode }) => (
  <TouchableOpacity
    style={{ width, marginBottom: 16 }}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <View
      style={[
        styles.cardImageWrap,
        {
          backgroundColor: theme.iconBackground,
          borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {rank != null && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>{rank}</Text>
        </View>
      )}
      {badge && (
        <View style={[styles.newBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.newBadgeText}>{badge}</Text>
        </View>
      )}
      <FastImage shimmer source={{ uri: game.image_url }} style={styles.cardImage} resizeMode="cover" />
    </View>
    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
      {game.name}
    </Text>
    <View style={[styles.categoryPill, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
      <Text style={[styles.categoryPillText, { color: theme.primary }]}>
        {t(`games.category_${game.category}`, game.category)}
      </Text>
    </View>
  </TouchableOpacity>
));

const GamesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [allGames, setAllGames] = useState([]);
  const [visibleCount, setVisibleCount] = useState(GAMES_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [mostPlayed, setMostPlayed] = useState([]);
  const [newest, setNewest] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [rolling, setRolling] = useState(false);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const cardWidth = 150;

  // Mobile app only ever shows games playable on mobile - pc-only games are
  // never listed here at all.
  const filterMobileCompatible = (list) =>
    (list || []).filter((g) => g.platform !== "pc");

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (activeCategory !== "all") params.category = activeCategory;
      const res = await getGames(params, { signal });
      if (signal?.aborted) return;
      const data = res?.data || res;
      const filtered = filterMobileCompatible(data.games);
      setAllGames(filtered);
      setVisibleCount(GAMES_PAGE_SIZE);
      setMostPlayed(filterMobileCompatible(data.most_played));
      setNewest(filterMobileCompatible(data.newest));
    } catch (error) {
      if (isRequestCanceled(error) || signal?.aborted) return;
      Toast.show({ type: "error", text1: t("games.loadError", "Không thể tải danh sách game") });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [search, activeCategory, t]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => load(controller.signal), 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await getGameNowPlaying({ signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = res?.data || res;
        setNowPlaying(data?.playing || []);
      } catch (error) {
        // Silent - nice-to-have section
      }
    })();
    (async () => {
      try {
        const res = await getGameLeaderboard("week", { signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = res?.data || res;
        setLeaderboard((data?.leaderboard || []).slice(0, 8));
      } catch (error) {
        // Silent - same as above
      }
    })();
    return () => controller.abort();
  }, []);

  const handleRandom = useCallback(async () => {
    setRolling(true);
    try {
      const res = await getRandomGame("mobile");
      const game = res?.data || res;
      navigation.navigate("GamePlayScreen", { slug: game.slug, name: game.name });
    } catch (error) {
      Toast.show({ type: "error", text1: t("games.randomError", "Không tìm được game phù hợp") });
    } finally {
      setRolling(false);
    }
  }, [navigation, t]);

  const openGame = useCallback((game) => {
    navigation.navigate("GamePlayScreen", { slug: game.slug, name: game.name });
  }, [navigation]);

  const displayedGames = useMemo(
    () => (loading ? [] : allGames.slice(0, visibleCount)),
    [allGames, visibleCount, loading]
  );

  const hasMoreGames = !loading && visibleCount < allGames.length;

  const handleLoadMoreGames = useCallback(() => {
    if (loading || loadingMoreRef.current || visibleCount >= allGames.length) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + GAMES_PAGE_SIZE, allGames.length));
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }, 60);
  }, [loading, visibleCount, allGames.length]);

  const renderGameItem = useCallback(
    ({ item: g }) => (
      <View style={{ width: "48%" }}>
        <GameCard game={g} width="100%" t={t} theme={theme} isDarkMode={isDarkMode} onPress={() => openGame(g)} />
      </View>
    ),
    [t, theme, isDarkMode, openGame]
  );

  const keyExtractor = useCallback((item, index) => String(item?.id ?? item?.slug ?? index), []);

  const listHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: 16 }}>
        <LinearGradient
          colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
        >
          <BannerWatermark icon="game-controller" size={140} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.heroIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <Ionicons name="game-controller" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{t("games.title", "Game")}</Text>
              <Text style={[styles.heroText, { color: theme.subText }]}>
                {t("games.subtitle", "Chơi game trực tiếp trên ứng dụng - Miễn phí, không cần tải về!")}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.randomButton, { backgroundColor: theme.primary }]}
            onPress={handleRandom}
            disabled={rolling}
            activeOpacity={0.85}
          >
            {rolling ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="shuffle" size={18} color="#fff" />}
            <Text style={styles.randomButtonText}>{t("games.random", "Game ngẫu nhiên")}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Now Playing Section */}
        {nowPlaying.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle icon="pulse" color="#10B981" title={t("games.nowPlaying", "Đang chơi")} theme={theme} isDarkMode={isDarkMode} />
            <View
              style={[
                styles.cardGroup,
                { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" },
              ]}
            >
              {nowPlaying.slice(0, 8).map((p, i, arr) => (
                <View
                  key={`${p.user_id}-${i}`}
                  style={[
                    styles.rowItem,
                    i < arr.length - 1 && { borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9", borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <AvatarFrameWrap theme={p.profile_theme} size={36} style={{ marginRight: 12 }}>
                    <FastImage
                      source={{ uri: p.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${p.username}/avatar` }}
                      style={styles.avatar}
                    />
                  </AvatarFrameWrap>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <UserNameRow
                      name={p.profile_name || p.username}
                      theme={p.profile_theme}
                      style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
                    />
                    <Text style={[styles.subRowText, { color: theme.subText }]} numberOfLines={1}>
                      {t("games.isPlaying", "đang chơi")} {p.game_name}
                    </Text>
                  </View>
                  <View style={[styles.liveDot, { backgroundColor: theme.primary }]} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Leaderboard Section */}
        {leaderboard.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle icon="trophy" color="#F59E0B" title={t("games.leaderboard", "Bảng xếp hạng XP")} theme={theme} isDarkMode={isDarkMode} />
            <View
              style={[
                styles.cardGroup,
                { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" },
              ]}
            >
              {leaderboard.map((u, i, arr) => (
                <TouchableOpacity
                  key={u.id || i}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("ProfileScreen", { username: u.username })}
                  style={[
                    styles.rowItem,
                    i < arr.length - 1 && { borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9", borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View
                    style={[
                      styles.rankHolder,
                      i === 0 && styles.rank1,
                      i === 1 && styles.rank2,
                      i === 2 && styles.rank3,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankNum,
                        i < 3 ? { color: "#fff", fontWeight: "800" } : { color: theme.subText },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <AvatarFrameWrap theme={u.profile_theme} size={36} style={{ marginRight: 12 }}>
                    <FastImage
                      source={{ uri: u.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${u.username}/avatar` }}
                      style={styles.avatar}
                    />
                  </AvatarFrameWrap>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <UserNameRow
                      name={u.profile_name || u.username}
                      theme={u.profile_theme}
                      style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
                    />
                  </View>
                  <Text style={[styles.xpText, { color: theme.primary }]}>{u.xp} XP</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Most Played Carousel */}
        {mostPlayed.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle icon="flame" color="#EF4444" title={t("games.mostPlayed", "Game được chơi nhiều nhất")} theme={theme} isDarkMode={isDarkMode} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {mostPlayed.map((g, i) => (
                <View key={g.id} style={{ marginRight: CARD_GAP }}>
                  <GameCard
                    game={g}
                    width={cardWidth}
                    t={t}
                    theme={theme}
                    isDarkMode={isDarkMode}
                    rank={i + 1}
                    onPress={() => openGame(g)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Newest Games Carousel */}
        {newest.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle icon="sparkles" color="#3B82F6" title={t("games.newest", "Game mới cập nhật")} theme={theme} isDarkMode={isDarkMode} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {newest.map((g) => (
                <View key={g.id} style={{ marginRight: CARD_GAP }}>
                  <GameCard
                    game={g}
                    width={cardWidth}
                    t={t}
                    theme={theme}
                    isDarkMode={isDarkMode}
                    badge={g.is_new ? t("games.newBadge", "MỚI") : null}
                    onPress={() => openGame(g)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filter & Search Section */}
        <View style={styles.sectionWrap}>
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: theme.surface,
                borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={theme.subText} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("games.searchPlaceholder", "Tìm kiếm game...")}
              placeholderTextColor={theme.subText}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {Boolean(search) && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>

          <SectionTitle icon="apps" color="#8B5CF6" title={t("games.byCategory", "Game theo thể loại")} theme={theme} isDarkMode={isDarkMode} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, paddingRight: 24, gap: 8 }}
            style={{ marginBottom: 16 }}
          >
            {CATEGORY_KEYS.map((cat) => {
              const active = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.8}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.primary : theme.surface,
                      borderColor: active ? theme.primary : isDarkMode ? "#282B34" : "#E2E8F0",
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? "#fff" : theme.text,
                      fontWeight: "600",
                      fontSize: 13,
                      includeFontPadding: false,
                      paddingRight: 1,
                    }}
                  >
                    {t(`games.category_${cat}`, cat === "all" ? "Tất cả" : cat)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    ),
    [
      theme,
      t,
      handleRandom,
      rolling,
      nowPlaying,
      leaderboard,
      navigation,
      mostPlayed,
      cardWidth,
      openGame,
      newest,
      search,
      activeCategory,
      isDarkMode,
    ]
  );

  const listEmpty = useMemo(
    () => (
      <View style={{ paddingHorizontal: 16 }}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24, width: "100%" }} />
        ) : (
          <Text style={[styles.emptyText, { color: theme.subText }]}>
            {t("games.empty", "Không tìm thấy game nào.")}
          </Text>
        )}
      </View>
    ),
    [loading, theme.primary, theme.subText, t]
  );

  const listFooter = useMemo(
    () =>
      hasMoreGames || loadingMore ? (
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : null,
    [hasMoreGames, loadingMore, theme.primary]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating Transparent Header adhering to design system */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 8,
            paddingTop: insets.top,
            height: 64 + insets.top,
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "600",
              color: theme.primary,
              opacity: headerTitleOpacity,
            }}
          >
            {t("games.title", "Game")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* Atmospheric subtle top gradient */}
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

      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <Animated.FlatList
          data={displayedGames}
          numColumns={2}
          keyExtractor={keyExtractor}
          renderItem={renderGameItem}
          columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 16 }}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          onEndReached={handleLoadMoreGames}
          onEndReachedThreshold={0.4}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: 64 + insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
        />
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  hero: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 24,
    overflow: "hidden",
  },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 18, fontWeight: "800" },
  heroText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  randomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    padding: 13,
    marginTop: 16,
  },
  randomButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  sectionWrap: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardGroup: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  subRowText: {
    fontSize: 12,
    marginTop: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  rankHolder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rank1: { backgroundColor: "#EAB308" },
  rank2: { backgroundColor: "#94A3B8" },
  rank3: { backgroundColor: "#D97706" },
  rankNum: { fontSize: 12, textAlign: "center" },
  xpText: { fontSize: 14, fontWeight: "700", marginLeft: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    padding: 0,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardImageWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 18,
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: "100%" },
  rankBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  newBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  newBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  cardTitle: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  categoryPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  categoryPillText: { fontSize: 11, fontWeight: "700", lineHeight: 15 },
  emptyText: { textAlign: "center", width: "100%", marginTop: 30, fontSize: 14 },
});

export default GamesScreen;
