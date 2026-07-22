import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import {
  getStudyMaterialCategories,
  getStudyMaterials,
} from "../../../../services/api/Api";

const filterOptions = [
  { key: "all", label: "Tất cả" },
  { key: "free", label: "Miễn phí" },
  { key: "paid", label: "Có phí" },
];

const sortOptions = [
  { key: "newest", label: "Mới nhất" },
  { key: "rating", label: "Đánh giá" },
  { key: "downloads", label: "Tải nhiều" },
  { key: "views", label: "Xem nhiều" },
];

const StudyMaterialScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedSort, setSelectedSort] = useState("newest");

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
        text1: "Không tải được danh sách tài liệu",
        text2: error?.message || "Vui lòng thử lại",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedFilter, selectedSort]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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
      ? "Miễn phí"
      : `${item?.price || 0} điểm`;
    const ratingLabel = item?.average_rating ? `${item.average_rating}/5` : "Chưa có đánh giá";

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("StudyMaterialDetailScreen", { materialId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: theme.primary + "15" }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>{item?.category?.name || "Tài liệu"}</Text>
          </View>
          <Text style={[styles.priceText, { color: theme.primary }]}>{priceLabel}</Text>
        </View>

        <Text style={[styles.titleText, { color: theme.text }]} numberOfLines={2}>
          {item?.title || "Tiêu đề tài liệu"}
        </Text>

        <Text style={[styles.descriptionText, { color: theme.subText }]} numberOfLines={3}>
          {item?.description || "Không có mô tả"}
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
          <Text style={[styles.authorText, { color: theme.subText }]}>Bởi {item?.author?.profile_name || item?.author?.username || "Thành viên"}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 8}]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMaterials({ refresh: true })} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        <View style={styles.heroCard}>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Khám phá tài liệu ôn thi</Text>
          <Text style={[styles.heroText, { color: theme.subText }]}>Tìm tài liệu mới, được đánh giá bởi cộng đồng và tải ngay trên ứng dụng.</Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={theme.subText} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm tài liệu, chủ đề..."
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
                <Text style={[styles.chipText, active ? { color: "#fff" } : { color: theme.text }]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.categoryRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Danh mục</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, !selectedCategory ? { backgroundColor: theme.primary } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            >
              <Text style={[styles.categoryChipText, !selectedCategory ? { color: "#fff" } : { color: theme.text }]}>Tất cả</Text>
            </TouchableOpacity>
            {categories.map((category) => {
              const active = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={[styles.categoryChip, active ? { backgroundColor: theme.primary } : { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                >
                  <Text style={[styles.categoryChipText, active ? { color: "#fff" } : { color: theme.text }]}>{category.name}</Text>
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
                <Text style={[styles.sortChipText, active ? { color: theme.primary } : { color: theme.subText }]}>{sort.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.subText }]}>Đang tải tài liệu...</Text>
          </View>
        ) : materials.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={48} color={theme.placeholder} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Chưa có tài liệu phù hợp</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</Text>
          </View>
        ) : (
          <View style={styles.listWrapper}>
            {materials.map((item) => (
              <View key={item.id}>{renderItem({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 12,
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
  scrollView: {
    flex: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#F6FFF2",
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
    borderColor: "#E5E5E5",
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
