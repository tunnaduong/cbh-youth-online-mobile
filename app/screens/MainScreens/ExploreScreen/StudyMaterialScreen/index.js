import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../../components/LiquidButton";
import {
  getStudyMaterialCategories,
  getStudyMaterials,
} from "../../../../services/api/Api";

const filterOptions = [
  { key: "all", labelKey: "all" },
  { key: "free", labelKey: "free" },
  { key: "paid", labelKey: "paid" },
];

const sortOptions = [
  { key: "newest", labelKey: "newest" },
  { key: "rating", labelKey: "rating" },
  { key: "downloads", labelKey: "downloads" },
  { key: "views", labelKey: "views" },
];

const StudyMaterialScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedSort, setSelectedSort] = useState("newest");
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadCategories = useCallback(async () => {
    try {
      const response = await getStudyMaterialCategories();
      setCategories(response?.data || []);
    } catch (error) {
      console.warn("Failed to load categories", error);
    }
  }, []);

  const loadMaterials = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory) params.category_id = selectedCategory;
      if (selectedFilter === "free") params.is_free = "true";
      if (selectedFilter === "paid") params.is_free = "false";

      if (selectedSort === "rating") {
        params.sort_by = "average_rating";
        params.sort_order = "desc";
      } else if (selectedSort === "downloads") {
        params.sort_by = "download_count";
        params.sort_order = "desc";
      } else if (selectedSort === "views") {
        params.sort_by = "view_count";
        params.sort_order = "desc";
      } else {
        params.sort_by = "created_at";
        params.sort_order = "desc";
      }

      const response = await getStudyMaterials(params);
      const payload = response?.data?.data || [];
      setMaterials(payload);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("studyMaterial.loadError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedFilter, selectedSort, t]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const getCategoryLabel = (category) => {
    const rawName = (category?.name || "").toString().trim();
    const slug = (category?.slug || "").toString().trim();

    const normalize = (value) =>
      value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const candidates = [slug, rawName]
      .map((value) => normalize(value))
      .filter(Boolean);

    const directKey = candidates.find((candidate) => {
      const translated = t(`studyMaterial.categoriesList.${candidate}`, { defaultValue: "" });
      return Boolean(translated);
    });

    if (directKey) {
      return t(`studyMaterial.categoriesList.${directKey}`);
    }

    const aliasMap = {
      math: t("studyMaterial.categoriesList.mathematics"),
      "địa-lý": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "địa-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "dia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      geography: t("studyMaterial.categoriesList.geography"),
      maths: t("studyMaterial.categoriesList.mathematics"),
      mathematics: t("studyMaterial.categoriesList.mathematics"),
      toan: t("studyMaterial.categoriesList.mathematics"),
      "toan-hoc": t("studyMaterial.categoriesList.mathematics"),
      science: t("studyMaterial.categoriesList.science"),
      "khoa-hoc": t("studyMaterial.categoriesList.science"),
      literature: t("studyMaterial.categoriesList.literature"),
      "van-hoc": t("studyMaterial.categoriesList.literature"),
      "ngu-van": t("studyMaterial.categoriesList.literature"),
      "ngữ-văn": t("studyMaterial.categoriesList.literature"),
      history: t("studyMaterial.categoriesList.history"),
      "lich-su": t("studyMaterial.categoriesList.history"),
      english: t("studyMaterial.categoriesList.english"),
      "tieng-anh": t("studyMaterial.categoriesList.english"),
      "tieng-nga": t("studyMaterial.categoriesList.foreign-language"),
      "tiếng-nga": t("studyMaterial.categoriesList.foreign-language"),
      russian: t("studyMaterial.categoriesList.foreign-language"),
      geography: t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      exam: t("studyMaterial.categoriesList.exam"),
      "on-thi": t("studyMaterial.categoriesList.exam"),
      general: t("studyMaterial.categoriesList.general"),
      other: t("studyMaterial.categoriesList.other"),
      khac: t("studyMaterial.categoriesList.other"),
      khác: t("studyMaterial.categoriesList.other"),
      technology: t("studyMaterial.categoriesList.technology"),
      "cong-nghe": t("studyMaterial.categoriesList.technology"),
      physics: t("studyMaterial.categoriesList.physics"),
      "vat-ly": t("studyMaterial.categoriesList.physics"),
      chemistry: t("studyMaterial.categoriesList.chemistry"),
      "hoa-hoc": t("studyMaterial.categoriesList.chemistry"),
      biology: t("studyMaterial.categoriesList.biology"),
      "sinh-hoc": t("studyMaterial.categoriesList.biology"),
      geography: t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      "dia-ly-1": t("studyMaterial.categoriesList.geography"),
      "đia-ly-1": t("studyMaterial.categoriesList.geography"),
      "dia-ly-2": t("studyMaterial.categoriesList.geography"),
      "đia-ly-2": t("studyMaterial.categoriesList.geography"),
      "dia-ly-3": t("studyMaterial.categoriesList.geography"),
      "đia-ly-3": t("studyMaterial.categoriesList.geography"),
      "dia-ly-4": t("studyMaterial.categoriesList.geography"),
      "đia-ly-4": t("studyMaterial.categoriesList.geography"),
      "diai-ly": t("studyMaterial.categoriesList.geography"),
      "đia-lyh": t("studyMaterial.categoriesList.geography"),
      "dia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "đia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "geography-1": t("studyMaterial.categoriesList.geography"),
      "địa-lý": t("studyMaterial.categoriesList.geography"),
      "địa lý": t("studyMaterial.categoriesList.geography"),
      "dia ly": t("studyMaterial.categoriesList.geography"),
      "đia lý": t("studyMaterial.categoriesList.geography"),
      "computer-science": t("studyMaterial.categoriesList.computer-science"),
      "tin-hoc": t("studyMaterial.categoriesList.computer-science"),
      "social-science": t("studyMaterial.categoriesList.social-science"),
      "khoa-hoc-xa-hoi": t("studyMaterial.categoriesList.social-science"),
      "foreign-language": t("studyMaterial.categoriesList.foreign-language"),
      "ngoai-ngu": t("studyMaterial.categoriesList.foreign-language"),
      economics: t("studyMaterial.categoriesList.economics"),
      "kinh-te": t("studyMaterial.categoriesList.economics"),
      business: t("studyMaterial.categoriesList.business"),
      "kinh-doanh": t("studyMaterial.categoriesList.business"),
      law: t("studyMaterial.categoriesList.law"),
      "luat": t("studyMaterial.categoriesList.law"),
      medicine: t("studyMaterial.categoriesList.medicine"),
      "y-hoc": t("studyMaterial.categoriesList.medicine"),
      engineering: t("studyMaterial.categoriesList.engineering"),
      "ky-thuat": t("studyMaterial.categoriesList.engineering"),
      art: t("studyMaterial.categoriesList.art"),
      "my-thuat": t("studyMaterial.categoriesList.art"),
    };

    const normalizedName = candidates[0] || "";
    return aliasMap[normalizedName] || rawName || t("studyMaterial.categoriesList.default");
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMaterials({ refresh: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [loadMaterials]);

  const headerTitle = useMemo(() => {
    return t("exploreScreen.examDocuments") || "Chợ tài liệu";
  }, [t]);

  const renderItem = ({ item }) => {
    const priceLabel = item?.is_free || item?.price === 0
      ? t("studyMaterial.free")
      : t("studyMaterial.points", { value: item?.price || 0 });
    const ratingLabel = item?.average_rating
      ? `${item.average_rating}/5`
      : t("studyMaterial.noRating");

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("StudyMaterialDetailScreen", { materialId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: theme.primary + "15" }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>{item?.category ? getCategoryLabel(item.category) : t("studyMaterial.material")}</Text>
          </View>
          <Text style={[styles.priceText, { color: theme.primary }]}>{priceLabel}</Text>
        </View>

        <Text style={[styles.titleText, { color: theme.text }]} numberOfLines={2}>
          {item?.title || t("studyMaterial.untitled")}
        </Text>

        <Text style={[styles.descriptionText, { color: theme.subText }]} numberOfLines={3}>
          {item?.description || t("studyMaterial.noDescription")}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="star-outline" size={14} color={theme.primary} />
            <Text style={[styles.metaText, { color: theme.subText }]}>{ratingLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="download-outline" size={14} color={theme.primary} />
            <Text style={[styles.metaText, { color: theme.subText }]}>{item?.download_count || 0}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="eye-outline" size={14} color={theme.primary} />
            <Text style={[styles.metaText, { color: theme.subText }]}>{item?.view_count || 0}</Text>
          </View>
        </View>

        <View style={styles.authorRow}>
          <Ionicons name="person-circle-outline" size={18} color={theme.primary} />
          <Text style={[styles.authorText, { color: theme.subText }]}>{t("studyMaterial.byAuthor", { author: item?.author?.profile_name || item?.author?.username || t("studyMaterial.member") })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, { paddingTop: insets.top + 6, height: insets.top + 64 }]} pointerEvents="box-none">
        <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }) }]}>
          {headerTitle}
        </Animated.Text>
        <View style={styles.headerActions}>
          <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.navigate("UploadStudyMaterialScreen")}>
            <Ionicons name="cloud-upload-outline" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: 40 + insets.bottom }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMaterials({ refresh: true })} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{t("studyMaterial.heroTitle")}</Text>
          <Text style={[styles.heroText, { color: theme.subText }]}>{t("studyMaterial.heroText")}</Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.subText} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("studyMaterial.searchPlaceholder")}
            placeholderTextColor={theme.placeholder}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {filterOptions.map((filter) => {
            const active = selectedFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setSelectedFilter(filter.key)}
                style={[styles.chip, active ? { backgroundColor: theme.primary } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              >
                <Text style={[styles.chipText, active ? { color: "#fff" } : { color: theme.text }]}>{t(`studyMaterial.filters.${filter.labelKey}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.categoryRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("studyMaterial.categories")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, !selectedCategory ? { backgroundColor: theme.primary } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            >
              <Text style={[styles.categoryChipText, !selectedCategory ? { color: "#fff" } : { color: theme.text }]}>{t("studyMaterial.filters.all")}</Text>
            </TouchableOpacity>
            {categories.map((category) => {
              const active = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={[styles.categoryChip, active ? { backgroundColor: theme.primary } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                >
                  <Text style={[styles.categoryChipText, active ? { color: "#fff" } : { color: theme.text }]}>{getCategoryLabel(category)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sortRow}>
          {sortOptions.map((sort) => {
            const active = selectedSort === sort.key;
            return (
              <TouchableOpacity
                key={sort.key}
                onPress={() => setSelectedSort(sort.key)}
                style={[styles.sortChip, active ? { backgroundColor: theme.primary + "15" } : { backgroundColor: "transparent" }]}
              >
                <Text style={[styles.sortChipText, active ? { color: theme.primary } : { color: theme.subText }]}>{t(`studyMaterial.sort.${sort.labelKey}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.subText }]}>{t("studyMaterial.loading")}</Text>
          </View>
        ) : materials.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={48} color={theme.placeholder} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t("studyMaterial.emptyTitle")}</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>{t("studyMaterial.emptyText")}</Text>
          </View>
        ) : (
          <View style={styles.listWrapper}>
            {materials.map((item) => (
              <View key={item.id}>{renderItem({ item })}</View>
            ))}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  largeTitle: {
    fontSize: 30,
    fontWeight: "800",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 20,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  chipRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryRow: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  categoryChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 6,
  },
  sortChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
  },
  emptyState: {
    marginTop: 20,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
  },
  listWrapper: {
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  priceText: {
    fontSize: 13,
    fontWeight: "700",
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  authorText: {
    fontSize: 12,
  },
});

export default StudyMaterialScreen;
