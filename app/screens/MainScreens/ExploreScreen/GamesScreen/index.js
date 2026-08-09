import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import { getGames, getRandomGame } from "../../../../services/api/Api";

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

const GameCard = ({ game, width, t, onPress, theme, rank, badge }) => (
  <TouchableOpacity
    style={{ width, marginBottom: 16 }}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <View style={[styles.cardImageWrap, { backgroundColor: theme.iconBackground }]}>
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
      <Image source={{ uri: game.image_url }} style={styles.cardImage} resizeMode="cover" />
    </View>
    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
      {game.name}
    </Text>
    <View style={[styles.categoryPill, { backgroundColor: theme.iconBackground }]}>
      <Text style={[styles.categoryPillText, { color: theme.primary }]}>
        {t(`games.category_${game.category}`, game.category)}
      </Text>
    </View>
  </TouchableOpacity>
);

const GamesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [allGames, setAllGames] = useState([]);
  const [mostPlayed, setMostPlayed] = useState([]);
  const [newest, setNewest] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [rolling, setRolling] = useState(false);

  const cardWidth = 150;

  // Mobile app only ever shows games playable on mobile - pc-only games are
  // never listed here at all (unlike the web version, which lists everything
  // and shows an "unsupported" notice per-game instead).
  const filterMobileCompatible = (list) =>
    (list || []).filter((g) => g.platform !== "pc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (activeCategory !== "all") params.category = activeCategory;
      const res = await getGames(params);
      const data = res?.data || res;
      setAllGames(filterMobileCompatible(data.games));
      setMostPlayed(filterMobileCompatible(data.most_played));
      setNewest(filterMobileCompatible(data.newest));
    } catch (error) {
      Toast.show({ type: "error", text1: t("games.loadError", "Không thể tải danh sách game") });
    } finally {
      setLoading(false);
    }
  }, [search, activeCategory, t]);

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleRandom = async () => {
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
  };

  const openGame = (game) => {
    navigation.navigate("GamePlayScreen", { slug: game.slug, name: game.name });
  };

  const headerHeight = 58 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}
        pointerEvents="box-none"
      >
        <LiquidButton providerId="GamesScreen" size={44} alwaysBorder onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </LiquidButton>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("games.title", "Game")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <AndroidGlassBackdrop providerId="GamesScreen" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: headerHeight + 12, paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            {t("games.subtitle", "Chơi game trực tiếp trên ứng dụng - Miễn phí, không cần tải về!")}
          </Text>

          <TouchableOpacity
            style={[styles.randomButton, { backgroundColor: theme.primary }]}
            onPress={handleRandom}
            disabled={rolling}
          >
            {rolling ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="shuffle" size={18} color="#fff" />
            )}
            <Text style={styles.randomButtonText}>{t("games.random", "Game ngẫu nhiên")}</Text>
          </TouchableOpacity>

          {mostPlayed.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={16} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t("games.mostPlayed", "Game được chơi nhiều nhất")}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {mostPlayed.map((g, i) => (
                  <View key={g.id} style={{ marginRight: CARD_GAP }}>
                    <GameCard game={g} width={cardWidth} t={t} theme={theme} rank={i + 1} onPress={() => openGame(g)} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {newest.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles" size={16} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t("games.newest", "Game mới cập nhật")}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {newest.map((g) => (
                  <View key={g.id} style={{ marginRight: CARD_GAP }}>
                    <GameCard
                      game={g}
                      width={cardWidth}
                      t={t}
                      theme={theme}
                      badge={g.is_new ? t("games.newBadge", "MỚI") : null}
                      onPress={() => openGame(g)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <View style={[styles.searchBar, { backgroundColor: theme.iconBackground }]}>
              <Ionicons name="search" size={16} color={theme.subText} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("games.searchPlaceholder", "Tìm kiếm game...")}
                placeholderTextColor={theme.subText}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            <Text style={[styles.sectionTitleStandalone, { color: theme.text }]}>
              {t("games.byCategory", "Game theo thể loại")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CATEGORY_KEYS.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.primary : theme.iconBackground,
                        marginRight: 8,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>
                      {t(`games.category_${cat}`, cat === "all" ? "Tất cả" : cat)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.grid}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 30, width: "100%" }} />
            ) : allGames.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                {t("games.empty", "Không tìm thấy game nào.")}
              </Text>
            ) : (
              allGames.map((g) => (
                <View key={g.id} style={{ width: "48%" }}>
                  <GameCard game={g} width="100%" t={t} theme={theme} onPress={() => openGame(g)} />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 13, marginBottom: 16 },
  randomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    marginBottom: 20,
  },
  randomButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionTitleStandalone: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cardImageWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  cardTitle: { fontSize: 13, fontWeight: "700", marginTop: 6 },
  categoryPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  categoryPillText: { fontSize: 11, fontWeight: "600" },
  emptyText: { textAlign: "center", width: "100%", marginTop: 30 },
});

export default GamesScreen;
