import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
import UserNameRow from "../../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../../components/profile/AvatarFrame";
import {
  getStudyMaterialCategories,
  getStudyMaterials,
  isRequestCanceled,
} from "../../../../services/api/Api";
import FastImage from "../../../../components/FastImage";
import formatTime from "../../../../utils/formatTime";
import BannerWatermark from "../../../../components/BannerWatermark";
import { tint } from "../../../../components/settings/SettingsUI";

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
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("StudyMaterialDetailScreen", { materialId: item.id })}
    >
      {/* Document preview container */}
      <View style={[styles.previewContainer, { backgroundColor: theme.iconBackground }]}>
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

        {/* Price / status badge */}
        <View style={styles.priceBadgeWrapper}>
          {item.is_purchased ? (
            <View style={[styles.priceBadge, styles.purchasedBadge, { backgroundColor: isDarkMode ? "#0c2838" : "#E0F2FE" }]}>
              <Ionicons name="checkmark" size={12} color="#0284C7" style={{ marginRight: 2 }} />
              <Text style={styles.purchasedBadgeText}>{t("studyMaterial.purchased", "Đã mua")}</Text>
            </View>
          ) : item.is_free || item.price === 0 ? (
            <View style={[styles.priceBadge, styles.freeBadge, { backgroundColor: isDarkMode ? "#122818" : "#DCFCE7" }]}>
              <Text style={[styles.freeBadgeText, { color: isDarkMode ? "#4ADE80" : "#15803D" }]}>
                {t("studyMaterial.free", "Miễn phí")}
              </Text>
            </View>
          ) : (
            <View style={[styles.priceBadge, styles.paidBadge, { backgroundColor: isDarkMode ? "#2e1e08" : "#FEF3C7" }]}>
              <Text style={[styles.paidBadgeText, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>
                {t("studyMaterial.points", { value: item.price || 0, defaultValue: `${item.price} điểm` })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Card Content */}
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
            <AvatarFrameWrap theme={author.profile_theme} size={24} style={{ marginRight: 6 }}>
              {authorAvatar ? (
                <FastImage source={{ uri: authorAvatar }} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorAvatarFallback, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.authorAvatarInitial, { color: theme.primary }]}>
                    {authorName[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
            </AvatarFrameWrap>
            <View style={{ flex: 1, minWidth: 0 }}>
              <UserNameRow
                name={authorName}
                theme={author.profile_theme}
                style={{ fontSize: 13, fontWeight: "600", color: theme.text }}
              />
            </View>
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
                <Text style={[styles.statText, { color: "#F59E0B", fontWeight: "700" }]}>
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
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedSort, setSelectedSort] = useState("newest");
  const scrollY = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const isFetchingRef = useRef(false);
  const materialsAbortRef = useRef(null);
  const categoriesAbortRef = useRef(null);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const loadCategories = useCallback(async () => {
    if (categoriesAbortRef.current) {
      categoriesAbortRef.current.abort();
    }
    const controller = new AbortController();
    categoriesAbortRef.current = controller;

    try {
      const response = await getStudyMaterialCategories({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setCategories(response?.data || []);
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      console.warn("Failed to load categories", error);
    }
  }, []);

  const loadMaterials = useCallback(
    async ({ refresh = false, pageToLoad = 1 } = {}) => {
      const isFirstPage = pageToLoad === 1;
      if (!isFirstPage && (isFetchingRef.current || !hasMoreRef.current)) return;

      if (materialsAbortRef.current) {
        materialsAbortRef.current.abort();
      }
      const controller = new AbortController();
      materialsAbortRef.current = controller;
      isFetchingRef.current = true;
      setLoadMoreError(false);

      try {
        if (isFirstPage) {
          if (refresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }
        } else {
          setLoadingMore(true);
        }

        const params = { page: pageToLoad };
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

        const response = await getStudyMaterials(params, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const payload = Array.isArray(response?.data?.data) ? response.data.data : [];
        const currentPage = Number(response?.data?.current_page) || pageToLoad;
        const lastPage = Number(response?.data?.last_page) || 1;
        const more = Boolean(response?.data?.next_page_url || currentPage < lastPage);

        setMaterials((prev) => {
          if (isFirstPage) return payload;
          const existingIds = new Set(prev.map((m) => m.id));
          return [...prev, ...payload.filter((m) => !existingIds.has(m.id))];
        });
        pageRef.current = currentPage;
        hasMoreRef.current = more;
      } catch (error) {
        if (isRequestCanceled(error) || controller.signal.aborted) return;
        if (!isFirstPage) {
          setLoadMoreError(true);
        } else {
          Toast.show({
            type: "error",
            text1: t("studyMaterial.loadError"),
            text2: error?.message || t("studyMaterial.tryAgain"),
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          isFetchingRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [search, selectedCategory, selectedFilter, selectedSort, t]
  );

  const handleLoadMore = useCallback(() => {
    if (isFetchingRef.current || !hasMoreRef.current || loadMoreError) return;
    loadMaterials({ pageToLoad: pageRef.current + 1 });
  }, [loadMaterials, loadMoreError]);

  useEffect(() => {
    loadCategories();
    return () => {
      if (categoriesAbortRef.current) categoriesAbortRef.current.abort();
      if (materialsAbortRef.current) materialsAbortRef.current.abort();
    };
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
      history: t("studyMaterial.categoriesList.history"),
      "lich-su": t("studyMaterial.categoriesList.history"),
      english: t("studyMaterial.categoriesList.english"),
      "tieng-anh": t("studyMaterial.categoriesList.english"),
      "tieng-nga": t("studyMaterial.categoriesList.foreign-language"),
      russian: t("studyMaterial.categoriesList.foreign-language"),
      exam: t("studyMaterial.categoriesList.exam"),
      "on-thi": t("studyMaterial.categoriesList.exam"),
      general: t("studyMaterial.categoriesList.general"),
      other: t("studyMaterial.categoriesList.other"),
      technology: t("studyMaterial.categoriesList.technology"),
      "cong-nghe": t("studyMaterial.categoriesList.technology"),
      physics: t("studyMaterial.categoriesList.physics"),
      "vat-ly": t("studyMaterial.categoriesList.physics"),
      chemistry: t("studyMaterial.categoriesList.chemistry"),
      "hoa-hoc": t("studyMaterial.categoriesList.chemistry"),
      biology: t("studyMaterial.categoriesList.biology"),
      "sinh-hoc": t("studyMaterial.categoriesList.biology"),
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
      luat: t("studyMaterial.categoriesList.law"),
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
      {/* Floating Transparent Header */}
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
            {headerTitle}
          </Animated.Text>
          <View style={{ width: 44 }}>
            <LiquidButton
              size={44}
              scrollY={scrollY}
              onPress={() => navigation.navigate("UploadStudyMaterialScreen")}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={theme.primary} />
            </LiquidButton>
          </View>
        </View>
      </View>

      {/* Atmospheric Top Gradient */}
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
          data={loading ? [] : materials}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <MaterialCardItem
              item={item}
              navigation={navigation}
              theme={theme}
              isDarkMode={isDarkMode}
              t={t}
              getCategoryLabel={getCategoryLabel}
            />
          )}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 64 + insets.top,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadMaterials({ refresh: true, pageToLoad: 1 })}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListHeaderComponent={
            <>
              {/* Hero banner */}
              <LinearGradient
                colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
              >
                <BannerWatermark icon="library" size={130} />
                <View style={[styles.heroIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
                  <Ionicons name="library" size={24} color={theme.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{headerTitle}</Text>
                  <Text style={[styles.heroText, { color: theme.subText }]}>
                    {t("studyMaterial.heroText", "Khám phá, chia sẻ tài liệu học tập chất lượng từ cộng đồng.")}
                  </Text>
                </View>
              </LinearGradient>

              {/* Search box */}
              <View
                style={[
                  styles.searchBox,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={theme.subText} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("studyMaterial.searchPlaceholder", "Tìm kiếm tài liệu...")}
                  placeholderTextColor={theme.subText}
                  style={[styles.searchInput, { color: theme.text }]}
                />
                {Boolean(search) && (
                  <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={theme.subText} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Price / Type Filters */}
              <View style={styles.sectionWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 4, paddingRight: 24, gap: 8 }}
                >
                  {filterOptions.map((filter) => {
                    const active = selectedFilter === filter.key;
                    return (
                      <TouchableOpacity
                        key={filter.key}
                        onPress={() => setSelectedFilter(filter.key)}
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
                          style={[styles.chipText, { color: active ? "#fff" : theme.text }]}
                        >
                          {t(`studyMaterial.filters.${filter.labelKey}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Categories Row */}
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionTitle, { color: theme.subText }]}>
                  {t("studyMaterial.categories", "Danh mục")}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 4, paddingRight: 24, gap: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(null)}
                    activeOpacity={0.8}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: !selectedCategory ? theme.primary : theme.surface,
                        borderColor: !selectedCategory ? theme.primary : isDarkMode ? "#282B34" : "#E2E8F0",
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.chipText, { color: !selectedCategory ? "#fff" : theme.text }]}
                    >
                      {t("studyMaterial.filters.all", "Tất cả")}
                    </Text>
                  </TouchableOpacity>
                  {categories.map((category) => {
                    const active = selectedCategory === category.id;
                    const dot = getCategoryDotColor(category?.name || category?.slug || "");
                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => setSelectedCategory(category.id)}
                        activeOpacity={0.8}
                        style={[
                          styles.chip,
                          styles.chipRow,
                          {
                            backgroundColor: active ? tint(dot, isDarkMode) : theme.surface,
                            borderColor: active ? dot : isDarkMode ? "#282B34" : "#E2E8F0",
                          },
                        ]}
                      >
                        <View style={[styles.chipDot, { backgroundColor: dot }]} />
                        <Text
                          numberOfLines={1}
                          style={[styles.chipText, { color: theme.text }]}
                        >
                          {getCategoryLabel(category)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Sort: segmented control */}
              <View style={[styles.sortRow, { backgroundColor: theme.iconBackground }]}>
                {sortOptions.map((sort) => {
                  const active = selectedSort === sort.key;
                  return (
                    <TouchableOpacity
                      key={sort.key}
                      onPress={() => setSelectedSort(sort.key)}
                      activeOpacity={0.8}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={[styles.sortChip, active && { backgroundColor: theme.background }]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.sortChipText, { color: active ? theme.text : theme.subText }]}
                      >
                        {t(`studyMaterial.sort.${sort.labelKey}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.subText }]}>{t("studyMaterial.loading")}</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="library-outline" size={48} color={theme.placeholder} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>{t("studyMaterial.emptyTitle")}</Text>
                <Text style={[styles.emptyText, { color: theme.subText }]}>{t("studyMaterial.emptyText")}</Text>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : loadMoreError ? (
              <TouchableOpacity
                onPress={() => loadMaterials({ pageToLoad: pageRef.current + 1 })}
                style={{ paddingVertical: 16, alignItems: "center" }}
              >
                <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>
                  {t("common.retry", "Thử lại")}
                </Text>
              </TouchableOpacity>
            ) : null
          }
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 18, fontWeight: "800" },
  heroText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
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
  sectionWrap: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  // No fixed lineHeight and a little spare width: in a horizontal ScrollView
  // the tight box clipped the last letter ("Vật lý", "Địa lý").
  chipText: {
    fontWeight: "600",
    fontSize: 13,
    includeFontPadding: false,
    paddingRight: 1,
  },
  sortRow: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    marginBottom: 16,
  },
  sortChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 4,
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
    marginTop: 4,
  },
  materialCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
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
    top: 10,
    right: 10,
    zIndex: 2,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  purchasedBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 132, 199, 0.3)",
  },
  purchasedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7",
  },
  freeBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(21, 128, 61, 0.3)",
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  paidBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(180, 83, 9, 0.3)",
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
    marginRight: 6,
  },
  categoryNameText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  dotSeparator: {
    marginHorizontal: 6,
    fontSize: 11,
  },
  timeAgoText: {
    fontSize: 11,
    fontWeight: "500",
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 6,
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  authorSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  authorAvatarInitial: {
    fontSize: 10,
    fontWeight: "700",
  },
  statsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export default StudyMaterialScreen;
