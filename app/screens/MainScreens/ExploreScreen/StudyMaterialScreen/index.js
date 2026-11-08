import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import {
  getStudyMaterialCategories,
  getStudyMaterials,
} from "../../../../services/api/Api";
import FastImage from "../../../../components/FastImage";
import formatTime from "../../../../utils/formatTime";

const CATEGORY_DOTS = [
  "#10B981", // emerald
  "#0EA5E9", // sky
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#F43F5E", // rose
  "#14B8A6", // teal
];

function getCategoryDotColor(name) {
  if (!name) return CATEGORY_DOTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_DOTS[hash % CATEGORY_DOTS.length];
}

function formatCount(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  return (
    (n / 1000)
      .toFixed(n < 10000 ? 1 : 0)
      .replace(".", ",")
      .replace(",0", "") + "k"
  );
}

const getPreviewUrl = (path) => {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const clean = path.replace(/^\/+/, "").replace(/^storage\//, "");
  return `https://api.chuyenbienhoa.com/storage/${clean}`;
};

const getAuthorAvatarUrl = (author) => {
  if (!author) return null;
  if (author.avatar_url) return author.avatar_url;
  if (author.username) {
    return `https://api.chuyenbienhoa.com/v1.0/users/${author.username}/avatar`;
  }
  return null;
};

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

const MaterialCardItem = ({ item, navigation, theme, isDarkMode, t, getCategoryLabel }) => {
  const [imageError, setImageError] = useState(false);
  const previewUrl = getPreviewUrl(item?.preview_path);
  const showPreview = Boolean(previewUrl) && !imageError;

  const author = item?.author || {};
  const authorName = author.profile_name || author.username || t("studyMaterial.member", "Thành viên");
  const authorAvatar = getAuthorAvatarUrl(author);

  const categoryName = item?.category ? getCategoryLabel(item.category) : null;
  const dotColor = getCategoryDotColor(item?.category?.name || item?.category?.slug || "");
  const timeText = item?.created_at ? formatTime(item.created_at) : null;

  return (
    <TouchableOpacity
      style={[
        styles.materialCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("StudyMaterialDetailScreen", { materialId: item.id })}
    >
      {/* Ảnh xem trước tài liệu */}
      <View style={[styles.previewContainer, { backgroundColor: isDarkMode ? "#15171C" : "#F3F4F6" }]}>
        {showPreview ? (
          <FastImage
            source={{ uri: previewUrl }}
            style={styles.previewImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="document-text-outline" size={44} color={theme.placeholder || "#9CA3AF"} />
          </View>
        )}

        {/* Nhãn giá / trạng thái */}
        <View style={styles.priceBadgeWrapper}>
          {item.is_purchased ? (
            <View style={[styles.priceBadge, styles.purchasedBadge]}>
              <Ionicons name="checkmark" size={12} color="#0284C7" style={{ marginRight: 2 }} />
              <Text style={styles.purchasedBadgeText}>{t("studyMaterial.purchased", "Đã mua")}</Text>
            </View>
          ) : item.is_free || item.price === 0 ? (
            <View style={[styles.priceBadge, styles.freeBadge]}>
              <Text style={[styles.freeBadgeText, { color: isDarkMode ? "#4ADE80" : "#15803D" }]}>
                {t("studyMaterial.free", "Miễn phí")}
              </Text>
            </View>
          ) : (
            <View style={[styles.priceBadge, styles.paidBadge]}>
              <Text style={[styles.paidBadgeText, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>
                {t("studyMaterial.points", { value: item.price || 0, defaultValue: `${item.price} điểm` })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Nội dung card */}
      <View style={styles.cardContent}>
        {/* Category & Time */}
        <View style={styles.categoryTimeRow}>
          {categoryName ? (
            <View style={styles.categoryItemRow}>
              <View style={[styles.categoryDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.categoryNameText, { color: theme.subText }]} numberOfLines={1}>
                {categoryName.toUpperCase()}
              </Text>
            </View>
          ) : (
            <Text style={[styles.categoryNameText, { color: theme.subText }]}>
              {t("studyMaterial.uncategorized", "CHƯA PHÂN LOẠI")}
            </Text>
          )}

          {timeText ? (
            <>
              <Text style={[styles.dotSeparator, { color: theme.subText }]}>·</Text>
              <Text style={[styles.timeAgoText, { color: theme.subText }]}>{timeText}</Text>
            </>
          ) : null}
        </View>

        {/* Title */}
        <Text style={[styles.materialTitle, { color: theme.text }]} numberOfLines={2}>
          {item?.title || t("studyMaterial.untitled", "Không có tiêu đề")}
        </Text>

        {/* Description */}
        {Boolean(item?.description) && (
          <Text style={[styles.materialDescription, { color: theme.subText }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Footer: Author & Stats */}
        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <View style={styles.authorSection}>
            {authorAvatar ? (
              <FastImage source={{ uri: authorAvatar }} style={styles.authorAvatar} />
            ) : (
              <View style={[styles.authorAvatarFallback, { backgroundColor: theme.primary + "20" }]}>
                <Text style={[styles.authorAvatarInitial, { color: theme.primary }]}>
                  {authorName[0]?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <Text style={[styles.authorNameText, { color: theme.text }]} numberOfLines={1}>
              {authorName}
            </Text>
          </View>

          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Ionicons name="download-outline" size={14} color={theme.subText} />
              <Text style={[styles.statText, { color: theme.subText }]}>
                {formatCount(item?.download_count)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={14} color={theme.subText} />
              <Text style={[styles.statText, { color: theme.subText }]}>
                {formatCount(item?.view_count)}
              </Text>
            </View>
            {Number(item?.average_rating) > 0 ? (
              <View style={styles.statItem}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={[styles.statText, { color: "#F59E0B" }]}>
                  {item.average_rating}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const StudyMaterialScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");

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


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6, height: insets.top + 64 }]} pointerEvents="box-none">
        <LiquidButton providerId="StudyMaterialScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.primary, opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }) }]}>
          {headerTitle}
        </Animated.Text>
        <View style={styles.headerActions}>
          <LiquidButton providerId="StudyMaterialScreen" size={44} scrollY={scrollY} onPress={() => navigation.navigate("UploadStudyMaterialScreen")}>
            <Ionicons name="cloud-upload-outline" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      </View>

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

      <AndroidGlassBackdrop providerId="StudyMaterialScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 70 + insets.top, paddingBottom: 40 + insets.bottom }}
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
                style={[styles.chip, active ? { backgroundColor: theme.primary, borderColor: "transparent" } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
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
              style={[styles.categoryChip, !selectedCategory ? { backgroundColor: theme.primary, borderColor: "transparent" } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            >
              <Text style={[styles.categoryChipText, !selectedCategory ? { color: "#fff" } : { color: theme.text }]}>{t("studyMaterial.filters.all")}</Text>
            </TouchableOpacity>
            {categories.map((category) => {
              const active = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={[styles.categoryChip, active ? { backgroundColor: theme.primary, borderColor: "transparent" } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
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
              <MaterialCardItem
                key={item.id}
                item={item}
                navigation={navigation}
                theme={theme}
                isDarkMode={isDarkMode}
                t={t}
                getCategoryLabel={getCategoryLabel}
              />
            ))}
          </View>
        )}
      </Animated.ScrollView>
      </AndroidGlassBackdrop>
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
    zIndex: 100,
    elevation: 10,
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
  materialCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  previewContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  priceBadgeWrapper: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  purchasedBadge: {
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.2)",
  },
  purchasedBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0284C7",
  },
  freeBadge: {
    borderWidth: 1,
    borderColor: "rgba(21, 128, 61, 0.2)",
  },
  freeBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#15803D",
  },
  paidBadge: {
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.2)",
  },
  paidBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#B45309",
  },
  cardContent: {
    padding: 14,
  },
  categoryTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryItemRow: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "60%",
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  categoryNameText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  dotSeparator: {
    marginHorizontal: 5,
    fontSize: 11,
  },
  timeAgoText: {
    fontSize: 11,
    fontWeight: "500",
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 5,
  },
  materialDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  authorSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  authorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
  },
  authorAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  authorAvatarInitial: {
    fontSize: 10,
    fontWeight: "700",
  },
  authorNameText: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
  statsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
  },
  statText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
});

export default StudyMaterialScreen;
