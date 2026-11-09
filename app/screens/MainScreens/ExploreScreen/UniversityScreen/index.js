import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Modal,
  FlatList,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import SegmentedControl from "../../../../components/SegmentedControl";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import { openInAppBrowser } from "../../../../utils/externalLink";
import {
  getUniversityOptions,
  getUniversities,
  searchUniversities,
} from "../../../../services/api/Api";

const SCORE_OPTIONS = [
  { labelKey: "scoreBelow15", fallback: "Dưới 15", value: "0,15" },
  { labelKey: "score15to18", fallback: "15 – 18", value: "15,18" },
  { labelKey: "score18to20", fallback: "18 – 20", value: "18,20" },
  { labelKey: "score20to22", fallback: "20 – 22", value: "20,22" },
  { labelKey: "score22to24", fallback: "22 – 24", value: "22,24" },
  { labelKey: "scoreAbove24", fallback: "Trên 24", value: "24,30" },
];

const FILTER_ICONS = {
  city: "location-outline",
  type: "business-outline",
  major: "school-outline",
  subject: "book-outline",
};

// Searchable picker modal - reused for city/major/type/subjectComposition
const PickerModal = ({
  visible,
  title,
  options = [],
  selectedIndex,
  onSelect,
  onClose,
  theme,
  isDarkMode,
  t,
}) => {
  const [query, setQuery] = useState("");
  const filtered = options
    .map((label, index) => ({ label, index }))
    .filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.pickerModal,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.subText} />
            </TouchableOpacity>
          </View>

          <View style={[styles.pickerSearchBar, { backgroundColor: theme.iconBackground }]}>
            <Ionicons name="search" size={16} color={theme.subText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("universities.pickerSearchPlaceholder", "Tìm kiếm...")}
              placeholderTextColor={theme.subText}
              style={[styles.pickerSearchInput, { color: theme.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {Boolean(query) && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={16} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>

          {selectedIndex != null && (
            <TouchableOpacity
              style={styles.pickerClearRow}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color={theme.primary} />
              <Text style={[styles.pickerClearText, { color: theme.primary }]}>
                {t("universities.clearSelection", "Bỏ chọn")}
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.index)}
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.pickerEmpty, { color: theme.subText }]}>
                {t("universities.pickerNoResults", "Không tìm thấy kết quả")}
              </Text>
            }
            renderItem={({ item }) => {
              const active = item.index === selectedIndex;
              return (
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    {
                      borderBottomColor: theme.border,
                      backgroundColor: active
                        ? isDarkMode
                          ? "rgba(76, 175, 80, 0.15)"
                          : "#EEF7ED"
                        : "transparent",
                    },
                  ]}
                  onPress={() => {
                    onSelect(item.index);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      {
                        color: active ? theme.primary : theme.text,
                        fontWeight: active ? "700" : "400",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// Filter row in the grouped settings-style card
const FilterField = ({ icon, label, placeholder, theme, onPress, isLast, t }) => (
  <TouchableOpacity style={styles.filterRow} onPress={onPress} activeOpacity={0.65}>
    <View style={styles.filterRowLeft}>
      <View style={[styles.filterIconHolder, { backgroundColor: theme.iconBackground }]}>
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <Text style={[styles.filterRowLabel, { color: theme.text }]} numberOfLines={1}>
        {placeholder}
      </Text>
    </View>
    <View style={styles.filterRowValue}>
      <Text
        style={[
          styles.filterRowValueText,
          { color: label ? theme.primary : theme.subText, fontWeight: label ? "600" : "400" },
        ]}
        numberOfLines={1}
      >
        {label || t("universities.filterAll", "Tất cả")}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={theme.subText} />
    </View>
    {!isLast && <View style={[styles.filterRowSeparator, { backgroundColor: theme.border }]} />}
  </TouchableOpacity>
);

const TypeTag = ({ type, theme, isDarkMode }) => {
  const isPublic = type === "Công lập";
  const bg = isPublic
    ? isDarkMode
      ? "rgba(37, 99, 235, 0.20)"
      : "#EFF6FF"
    : isDarkMode
    ? "rgba(76, 175, 80, 0.20)"
    : "#F0FDF4";
  const color = isPublic ? "#2563EB" : theme.primary;

  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color }]}>{type}</Text>
    </View>
  );
};

function UniversityCard({ uni, theme, isDarkMode, t }) {
  const [expanded, setExpanded] = useState(false);
  const majors = uni.universityMajors || [];
  const visibleMajors = expanded ? majors : majors.slice(0, 4);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIconWrap,
            { backgroundColor: isDarkMode ? "rgba(76, 175, 80, 0.15)" : "#E8F8EA" },
          ]}
        >
          <Ionicons name="school" size={20} color={theme.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {uni.name}
            {uni.acronym ? ` (${uni.acronym})` : ""}
          </Text>
          <View style={styles.tagRow}>
            {uni.universityCode ? (
              <View
                style={[
                  styles.tag,
                  {
                    backgroundColor: isDarkMode ? "rgba(245, 158, 11, 0.20)" : "#FEF3C7",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: isDarkMode ? "#FBBF24" : "#B45309" },
                  ]}
                >
                  {t("universities.code", "Mã")}: {uni.universityCode}
                </Text>
              </View>
            ) : null}
            {uni.type ? <TypeTag type={uni.type} theme={theme} isDarkMode={isDarkMode} /> : null}
            {(uni.city || []).map((c) => (
              <View key={c} style={[styles.tag, { backgroundColor: theme.iconBackground }]}>
                <Text style={[styles.tagText, { color: theme.subText }]}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Info details */}
      <View style={styles.infoSection}>
        {uni.address ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={theme.subText} style={{ marginTop: 2 }} />
            <Text style={[styles.infoText, { color: theme.subText }]}>{uni.address}</Text>
          </View>
        ) : null}
        {uni.phone ? (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color={theme.subText} />
            <Text style={[styles.infoText, { color: theme.subText }]}>{uni.phone}</Text>
          </View>
        ) : null}
        {uni.website ? (
          <TouchableOpacity
            style={styles.infoRow}
            activeOpacity={0.7}
            onPress={() =>
              openInAppBrowser(
                uni.website.startsWith("http") ? uni.website : `https://${uni.website}`,
                theme
              )
            }
          >
            <Ionicons name="globe-outline" size={14} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.primary, fontWeight: "500" }]} numberOfLines={1}>
              {uni.website}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Majors */}
      {majors.length > 0 && (
        <View style={styles.majorsBox}>
          <Text style={[styles.majorsLabel, { color: theme.subText }]}>
            {t("universities.majorsLabel", "NGÀNH ĐÀO TẠO")}
          </Text>
          <View
            style={[
              styles.majorsContainer,
              { backgroundColor: theme.iconBackground },
            ]}
          >
            {visibleMajors.map((m, i) => {
              const years = Object.entries(m.scores || {}).sort(([a], [b]) => Number(b) - Number(a));
              return (
                <View
                  key={i}
                  style={[
                    styles.majorRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.majorName, { color: theme.text }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={[styles.majorCode, { color: theme.subText }]}>{m.code}</Text>
                  </View>
                  {years.length > 0 && (
                    <View style={styles.scoreContainer}>
                      <View
                        style={[
                          styles.scoreBadge,
                          {
                            backgroundColor: isDarkMode ? "rgba(234, 88, 12, 0.20)" : "#FFEDD5",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.majorScore,
                            { color: isDarkMode ? "#FB923C" : "#EA580C" },
                          ]}
                        >
                          {years[0][1]}
                        </Text>
                      </View>
                      <Text style={[styles.majorYear, { color: theme.subText }]}>{years[0][0]}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {majors.length > 4 && (
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setExpanded(!expanded)}
              activeOpacity={0.7}
            >
              <Text style={[styles.expandBtnText, { color: theme.primary }]}>
                {expanded
                  ? t("universities.collapse", "Thu gọn")
                  : `${t("universities.showMore", "Xem thêm")} ${majors.length - 4} ${t(
                      "universities.moreMajorsSuffix",
                      "ngành"
                    )}`}
              </Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Admission URLs */}
      {(uni.urls || []).length > 0 && (
        <View style={styles.linksRow}>
          {uni.urls.map((u, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.admissionLinkBtn, { backgroundColor: `${theme.primary}12` }]}
              onPress={() => openInAppBrowser(u, theme)}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-forward-circle-outline" size={16} color={theme.primary} />
              <Text style={[styles.urlLink, { color: theme.primary }]} numberOfLines={1}>
                {i === 0
                  ? t("universities.admissionLink", "Xem trang tuyển sinh →")
                  : t("universities.admissionLinkN", "Trang tuyển sinh {{n}} →", { n: i + 1 })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const UniversityScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();

  const [tab, setTab] = useState("filter"); // "filter" | "search"

  const [options, setOptions] = useState({ city: [], major: [], type: [], subjectComposition: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [generalInfo, setGeneralInfo] = useState([]);

  const [cityIdx, setCityIdx] = useState(null);
  const [typeIdx, setTypeIdx] = useState(null);
  const [majorIdx, setMajorIdx] = useState(null);
  const [subjectIdx, setSubjectIdx] = useState(null);
  const [scoreValue, setScoreValue] = useState(null);

  const [activePicker, setActivePicker] = useState(null); // "city" | "type" | "major" | "subject"

  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPage, setMaxPage] = useState(1);

  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [nameResults, setNameResults] = useState([]);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSearched, setNameSearched] = useState(false);
  const suggestTimer = useRef(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    getUniversityOptions()
      .then((res) => {
        const d = res?.data || res;
        if (d?.city?.length > 0) setOptions(d);
        if (d?.generalInfo?.length > 0) setGeneralInfo(d.generalInfo);
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, []);

  const fetchUniversities = useCallback(
    async (page = 1) => {
      const params = { offset: String(page) };
      if (cityIdx !== null) params.city = String(cityIdx);
      if (typeIdx !== null) params.type = String(typeIdx);
      if (majorIdx !== null) params.major = String(majorIdx);
      if (subjectIdx !== null) params.subjectComposition = String(subjectIdx);
      if (scoreValue) params.score = scoreValue;

      setLoading(true);
      setSearched(true);
      try {
        const res = await getUniversities(params);
        const data = res?.data || res;
        setUniversities(data?.universities ?? []);
        setCurrentPage(data?.currentPage ?? page);
        setMaxPage(data?.maxPage ?? 1);
      } catch {
        setUniversities([]);
      } finally {
        setLoading(false);
      }
    },
    [cityIdx, typeIdx, majorIdx, subjectIdx, scoreValue]
  );

  const handleFilterSearch = () => {
    setCurrentPage(1);
    fetchUniversities(1);
  };

  const handlePage = (p) => {
    if (p < 1 || p > maxPage) return;
    setCurrentPage(p);
    fetchUniversities(p);
  };

  const handleNameInput = (q) => {
    setNameQuery(q);
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await searchUniversities(q, true);
        const data = res?.data || res;
        setSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
  };

  const handleNameSearch = async (q = nameQuery) => {
    if (!q.trim()) return;
    setSuggestions([]);
    setNameLoading(true);
    setNameSearched(true);
    try {
      const res = await searchUniversities(q);
      const data = res?.data || res;
      setNameResults(Array.isArray(data) ? data : []);
    } catch {
      setNameResults([]);
    } finally {
      setNameLoading(false);
    }
  };

  const pickerConfig = activePicker
    ? {
        city: {
          title: t("universities.cityPlaceholder", "TP / Tỉnh"),
          options: options.city,
          selected: cityIdx,
          onSelect: setCityIdx,
        },
        type: {
          title: t("universities.typePlaceholder", "Loại hình"),
          options: options.type,
          selected: typeIdx,
          onSelect: setTypeIdx,
        },
        major: {
          title: t("universities.majorPlaceholder", "Ngành học"),
          options: options.major,
          selected: majorIdx,
          onSelect: setMajorIdx,
        },
        subject: {
          title: t("universities.subjectPlaceholder", "Khối thi"),
          options: options.subjectComposition,
          selected: subjectIdx,
          onSelect: setSubjectIdx,
        },
      }[activePicker]
    : null;

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
            {t("universities.title", "Tìm trường ĐH-CĐ")}
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
        <Animated.ScrollView
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
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            {t("universities.subtitle", "Tra cứu thông tin trường và điểm chuẩn tuyển sinh.")}
          </Text>

          {/* Mode switch - SegmentedControl */}
          <SegmentedControl
            style={{ marginBottom: 16 }}
            value={tab}
            onChange={setTab}
            segments={[
              { key: "filter", icon: "options-outline", label: t("universities.tabFilter", "Bộ lọc") },
              { key: "search", icon: "search-outline", label: t("universities.tabSearch", "Tìm theo tên") },
            ]}
          />

          {tab === "filter" ? (
            <View>
              {optionsLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : (
                <>
                  <View
                    style={[
                      styles.filterCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <FilterField
                      icon={FILTER_ICONS.city}
                      label={cityIdx != null ? options.city[cityIdx] : null}
                      placeholder={t("universities.cityPlaceholder", "TP / Tỉnh")}
                      theme={theme}
                      onPress={() => setActivePicker("city")}
                      t={t}
                    />
                    <FilterField
                      icon={FILTER_ICONS.type}
                      label={typeIdx != null ? options.type[typeIdx] : null}
                      placeholder={t("universities.typePlaceholder", "Loại hình")}
                      theme={theme}
                      onPress={() => setActivePicker("type")}
                      t={t}
                    />
                    <FilterField
                      icon={FILTER_ICONS.major}
                      label={majorIdx != null ? options.major[majorIdx] : null}
                      placeholder={t("universities.majorPlaceholder", "Ngành học")}
                      theme={theme}
                      onPress={() => setActivePicker("major")}
                      t={t}
                    />
                    <FilterField
                      icon={FILTER_ICONS.subject}
                      label={subjectIdx != null ? options.subjectComposition[subjectIdx] : null}
                      placeholder={t("universities.subjectPlaceholder", "Khối thi")}
                      theme={theme}
                      onPress={() => setActivePicker("subject")}
                      isLast
                      t={t}
                    />
                  </View>

                  <Text style={[styles.sectionHeading, { color: theme.subText }]}>
                    {t("universities.scoreLabel", "Điểm chuẩn")}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
                    style={{ marginBottom: 16 }}
                  >
                    {SCORE_OPTIONS.map((o) => {
                      const active = scoreValue === o.value;
                      return (
                        <TouchableOpacity
                          key={o.value}
                          onPress={() => setScoreValue(active ? null : o.value)}
                          activeOpacity={0.8}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: active ? theme.primary : theme.iconBackground,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? "#fff" : theme.text,
                              fontWeight: "600",
                              fontSize: 13,
                              lineHeight: 18,
                            }}
                          >
                            {t(`universities.${o.labelKey}`, o.fallback)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.searchButton, { backgroundColor: theme.primary }]}
                    onPress={handleFilterSearch}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="search" size={17} color="#fff" />
                    <Text style={styles.searchButtonText}>{t("universities.searchButton", "Tìm kiếm")}</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ marginTop: 20 }}>
                {loading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                ) : searched && universities.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <Ionicons name="search-outline" size={44} color={theme.subText} />
                    <Text style={[styles.emptyText, { color: theme.subText }]}>
                      {t("universities.resultsEmpty", "Không tìm thấy trường nào phù hợp")}
                    </Text>
                  </View>
                ) : universities.length > 0 ? (
                  <>
                    <View style={styles.resultsHeader}>
                      <Text style={[styles.resultCount, { color: theme.subText }]}>
                        {t("universities.resultsFound", "Tìm thấy")}{" "}
                        <Text style={{ fontWeight: "700", color: theme.text }}>{universities.length}</Text>{" "}
                        {t("universities.schoolsUnit", "trường")}
                      </Text>
                      {maxPage > 1 && (
                        <Text style={[styles.pageIndicatorPill, { color: theme.subText }]}>
                          {t("universities.pageLabel", "Trang")} {currentPage}/{maxPage}
                        </Text>
                      )}
                    </View>
                    {universities.map((uni, i) => (
                      <UniversityCard
                        key={uni.universityCode ?? i}
                        uni={uni}
                        theme={theme}
                        isDarkMode={isDarkMode}
                        t={t}
                      />
                    ))}
                    {maxPage > 1 && (
                      <View style={styles.pagination}>
                        <TouchableOpacity
                          disabled={currentPage <= 1}
                          onPress={() => handlePage(currentPage - 1)}
                          style={[
                            styles.pageBtn,
                            {
                              backgroundColor: theme.iconBackground,
                              opacity: currentPage <= 1 ? 0.4 : 1,
                            },
                          ]}
                        >
                          <Ionicons name="chevron-back" size={16} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.pageIndicator, { color: theme.text }]}>
                          {t("universities.pageLabel", "Trang")} {currentPage} / {maxPage}
                        </Text>
                        <TouchableOpacity
                          disabled={currentPage >= maxPage}
                          onPress={() => handlePage(currentPage + 1)}
                          style={[
                            styles.pageBtn,
                            {
                              backgroundColor: theme.iconBackground,
                              opacity: currentPage >= maxPage ? 0.4 : 1,
                            },
                          ]}
                        >
                          <Ionicons name="chevron-forward" size={16} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  !searched && (
                    <View style={styles.placeholderBox}>
                      <View
                        style={[
                          styles.placeholderIconWrap,
                          { backgroundColor: theme.iconBackground },
                        ]}
                      >
                        <Ionicons name="school-outline" size={36} color={theme.primary} />
                      </View>
                      <Text style={[styles.placeholderText, { color: theme.subText }]}>
                        {t("universities.filterPlaceholder", "Chọn bộ lọc rồi nhấn Tìm kiếm")}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          ) : (
            <View>
              {/* Search by name box */}
              <View style={{ position: "relative", zIndex: 10 }}>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Ionicons name="search-outline" size={18} color={theme.subText} />
                  <TextInput
                    value={nameQuery}
                    onChangeText={handleNameInput}
                    onSubmitEditing={() => handleNameSearch()}
                    placeholder={t("universities.namePlaceholder", "Nhập tên hoặc mã trường...")}
                    placeholderTextColor={theme.subText}
                    style={[styles.searchInput, { color: theme.text }]}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {suggestLoading && (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 6 }} />
                  )}
                  {Boolean(nameQuery) && (
                    <TouchableOpacity
                      onPress={() => handleNameInput("")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={theme.subText} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Autocomplete suggestions */}
                {suggestions.length > 0 && (
                  <View
                    style={[
                      styles.suggestBox,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    {suggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.suggestRow,
                          i < suggestions.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: theme.border,
                          },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setNameQuery(s.name);
                          setSuggestions([]);
                          handleNameSearch(s.name);
                        }}
                      >
                        <Ionicons
                          name="school-outline"
                          size={15}
                          color={theme.primary}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.suggestText, { color: theme.text }]} numberOfLines={1}>
                          {s.name}
                          {s.universityCode ? (
                            <Text style={{ color: theme.subText, fontSize: 12 }}>
                              {" "}
                              ({s.universityCode})
                            </Text>
                          ) : null}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.searchButton,
                  {
                    backgroundColor: theme.primary,
                    marginTop: 12,
                    opacity: !nameQuery.trim() || nameLoading ? 0.6 : 1,
                  },
                ]}
                disabled={!nameQuery.trim() || nameLoading}
                onPress={() => handleNameSearch()}
                activeOpacity={0.85}
              >
                <Ionicons name="search" size={17} color="#fff" />
                <Text style={styles.searchButtonText}>{t("universities.find", "Tìm")}</Text>
              </TouchableOpacity>

              <View style={{ marginTop: 20 }}>
                {nameLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                ) : nameSearched && nameResults.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <Ionicons name="search-outline" size={44} color={theme.subText} />
                    <Text style={[styles.emptyText, { color: theme.subText }]}>
                      {t("universities.nameResultsEmpty", "Không tìm thấy trường nào")}
                    </Text>
                  </View>
                ) : nameResults.length > 0 ? (
                  <>
                    <View style={styles.resultsHeader}>
                      <Text style={[styles.resultCount, { color: theme.subText }]}>
                        {t("universities.resultsFound", "Tìm thấy")}{" "}
                        <Text style={{ fontWeight: "700", color: theme.text }}>{nameResults.length}</Text>{" "}
                        {t("universities.schoolsUnit", "trường")}
                      </Text>
                    </View>
                    {nameResults.map((uni, i) => (
                      <UniversityCard
                        key={uni.universityCode ?? i}
                        uni={uni}
                        theme={theme}
                        isDarkMode={isDarkMode}
                        t={t}
                      />
                    ))}
                  </>
                ) : (
                  !nameSearched && (
                    <View style={styles.placeholderBox}>
                      <View
                        style={[
                          styles.placeholderIconWrap,
                          { backgroundColor: theme.iconBackground },
                        ]}
                      >
                        <Ionicons name="search-outline" size={36} color={theme.primary} />
                      </View>
                      <Text style={[styles.placeholderText, { color: theme.subText }]}>
                        {t("universities.namePlaceholderEmpty", "Nhập tên hoặc mã trường để tìm kiếm")}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          )}

          {/* Admission Regulations & General Info */}
          {generalInfo.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={[styles.sectionHeading, { color: theme.subText, marginBottom: 10 }]}>
                {t("universities.generalInfoTitle", "Quy chế tuyển sinh đại học")}
              </Text>
              <View
                style={[
                  styles.generalInfoBox,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                {generalInfo.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.7}
                    style={[
                      styles.generalInfoRow,
                      i < generalInfo.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border,
                      },
                    ]}
                    onPress={() => item.url && openInAppBrowser(item.url, theme)}
                  >
                    <View
                      style={[
                        styles.generalInfoIconWrap,
                        { backgroundColor: `${theme.primary}15` },
                      ]}
                    >
                      <Ionicons name="document-text-outline" size={18} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.generalInfoItemTitle, { color: theme.text }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {item.publishDate ? (
                        <Text style={[styles.generalInfoDate, { color: theme.subText }]}>
                          {item.publishDate}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.subText} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Animated.ScrollView>
      </AndroidGlassBackdrop>

      {pickerConfig && (
        <PickerModal
          visible={!!activePicker}
          title={pickerConfig.title}
          options={pickerConfig.options}
          selectedIndex={pickerConfig.selected}
          onSelect={pickerConfig.onSelect}
          onClose={() => setActivePicker(null)}
          theme={theme}
          isDarkMode={isDarkMode}
          t={t}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  filterCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 52,
  },
  filterRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  filterIconHolder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRowLabel: { fontSize: 14, fontWeight: "500" },
  filterRowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    marginLeft: 8,
  },
  filterRowValueText: { fontSize: 14, flexShrink: 1, textAlign: "right" },
  filterRowSeparator: {
    position: "absolute",
    left: 54,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    height: 48,
  },
  searchButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  loadingBox: { paddingVertical: 24, alignItems: "center" },
  emptyStateBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { textAlign: "center", fontSize: 13, lineHeight: 18 },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginHorizontal: 4,
  },
  resultCount: { fontSize: 13 },
  pageIndicatorPill: { fontSize: 12, fontWeight: "600" },
  placeholderBox: { alignItems: "center", paddingVertical: 44, gap: 12 },
  placeholderIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { fontSize: 13, textAlign: "center" },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
    paddingBottom: 8,
  },
  pageBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  pageIndicator: { fontSize: 13, fontWeight: "600" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, padding: 0 },
  suggestBox: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    borderRadius: 14,
    overflow: "hidden",
    zIndex: 20,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestText: { fontSize: 14, flex: 1 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", gap: 12, marginBottom: 10 },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6, lineHeight: 21 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: "600" },
  infoSection: { marginTop: 4, gap: 5 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  infoText: { fontSize: 12.5, flex: 1, lineHeight: 18 },
  majorsBox: { marginTop: 12 },
  majorsLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
  majorsContainer: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  majorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  majorName: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  majorCode: { fontSize: 11, marginTop: 1 },
  scoreContainer: { alignItems: "flex-end", gap: 1 },
  scoreBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  majorScore: { fontSize: 13, fontWeight: "800" },
  majorYear: { fontSize: 10 },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, alignSelf: "flex-start" },
  expandBtnText: { fontSize: 12, fontWeight: "600" },
  linksRow: { marginTop: 12, gap: 6 },
  admissionLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  urlLink: { fontSize: 12.5, fontWeight: "600" },
  generalInfoBox: {
    borderRadius: 16,
    overflow: "hidden",
  },
  generalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  generalInfoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  generalInfoItemTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  generalInfoDate: { fontSize: 11, marginTop: 3 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  pickerModal: {
    borderRadius: 20,
    padding: 18,
    maxHeight: "75%",
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700" },
  pickerSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  pickerSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  pickerClearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pickerClearText: { fontSize: 13, fontWeight: "600" },
  pickerEmpty: { textAlign: "center", paddingVertical: 20, fontSize: 13 },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerOptionText: { fontSize: 14, flex: 1, marginRight: 8 },
});

export default UniversityScreen;
