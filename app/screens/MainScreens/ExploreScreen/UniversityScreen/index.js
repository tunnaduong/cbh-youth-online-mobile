import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Modal,
  FlatList,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import {
  getUniversityOptions,
  getUniversities,
  searchUniversities,
} from "../../../../services/api/Api";

const SCORE_OPTIONS = [
  { label: "Dưới 15", value: "0,15" },
  { label: "15 – 18", value: "15,18" },
  { label: "18 – 20", value: "18,20" },
  { label: "20 – 22", value: "20,22" },
  { label: "22 – 24", value: "22,24" },
  { label: "Trên 24", value: "24,30" },
];

// Searchable picker modal - reused for city/major/type/subjectComposition,
// all of which are flat string lists returned by the backend.
const PickerModal = ({ visible, title, options, selectedIndex, onSelect, onClose, theme, isDarkMode }) => {
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
        <TouchableOpacity activeOpacity={1} style={[styles.pickerModal, { backgroundColor: theme.cardBackground }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
          <Text style={[styles.pickerTitle, { color: theme.text }]}>{title}</Text>
          <View style={[styles.pickerSearchBar, { backgroundColor: theme.iconBackground }]}>
            <Ionicons name="search" size={16} color={theme.subText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm kiếm..."
              placeholderTextColor={theme.subText}
              style={[styles.pickerSearchInput, { color: theme.text }]}
            />
          </View>
          {selectedIndex != null && (
            <TouchableOpacity
              style={styles.pickerClearRow}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
            >
              <Ionicons name="close-circle" size={16} color={theme.primary} />
              <Text style={[styles.pickerClearText, { color: theme.primary }]}>Bỏ chọn</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.index)}
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.pickerEmpty, { color: theme.subText }]}>Không tìm thấy kết quả</Text>
            }
            renderItem={({ item }) => {
              const active = item.index === selectedIndex;
              return (
                <TouchableOpacity
                  style={[styles.pickerOption, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    onSelect(item.index);
                    onClose();
                  }}
                >
                  <Text style={[styles.pickerOptionText, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "400" }]}>
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const FilterField = ({ label, placeholder, theme, onPress }) => (
  <TouchableOpacity
    style={[styles.filterField, { backgroundColor: theme.iconBackground }]}
    onPress={onPress}
  >
    <Text
      style={[styles.filterFieldText, { color: label ? theme.text : theme.subText }]}
      numberOfLines={1}
    >
      {label || placeholder}
    </Text>
    <Ionicons name="chevron-down" size={16} color={theme.subText} />
  </TouchableOpacity>
);

const TypeTag = ({ type, theme }) => {
  const color = type === "Công lập" ? "#2563EB" : type === "Dân lập" ? theme.primary : theme.subText;
  return (
    <View style={[styles.tag, { backgroundColor: color + "1A" }]}>
      <Text style={[styles.tagText, { color }]}>{type}</Text>
    </View>
  );
};

function UniversityCard({ uni, theme, isDarkMode }) {
  const [expanded, setExpanded] = useState(false);
  const majors = uni.universityMajors || [];
  const visibleMajors = expanded ? majors : majors.slice(0, 4);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: theme.primary + "1A" }]}>
          <Ionicons name="school-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {uni.name}
            {uni.acronym ? ` (${uni.acronym})` : ""}
          </Text>
          <View style={styles.tagRow}>
            {uni.universityCode && (
              <View style={[styles.tag, { backgroundColor: "#F59E0B1A" }]}>
                <Text style={[styles.tagText, { color: "#B45309" }]}>Mã: {uni.universityCode}</Text>
              </View>
            )}
            {uni.type && <TypeTag type={uni.type} theme={theme} />}
            {(uni.city || []).map((c) => (
              <View key={c} style={[styles.tag, { backgroundColor: theme.iconBackground }]}>
                <Text style={[styles.tagText, { color: theme.subText }]}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {uni.address ? (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={13} color={theme.subText} style={{ marginTop: 1 }} />
          <Text style={[styles.infoText, { color: theme.subText }]}>{uni.address}</Text>
        </View>
      ) : null}
      {uni.phone ? (
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={13} color={theme.subText} />
          <Text style={[styles.infoText, { color: theme.subText }]}>{uni.phone}</Text>
        </View>
      ) : null}
      {uni.website ? (
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => Linking.openURL(uni.website.startsWith("http") ? uni.website : `https://${uni.website}`)}
        >
          <Ionicons name="globe-outline" size={13} color={theme.subText} />
          <Text style={[styles.infoText, { color: theme.primary }]} numberOfLines={1}>
            {uni.website}
          </Text>
        </TouchableOpacity>
      ) : null}

      {majors.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={[styles.majorsLabel, { color: theme.subText }]}>NGÀNH ĐÀO TẠO</Text>
          {visibleMajors.map((m, i) => {
            const years = Object.entries(m.scores || {}).sort(([a], [b]) => Number(b) - Number(a));
            return (
              <View key={i} style={[styles.majorRow, { borderTopColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.majorName, { color: theme.text }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.majorCode, { color: theme.subText }]}>{m.code}</Text>
                </View>
                {years.length > 0 && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.majorScore, { color: "#EA580C" }]}>{years[0][1]}</Text>
                    <Text style={[styles.majorCode, { color: theme.subText }]}>{years[0][0]}</Text>
                  </View>
                )}
              </View>
            );
          })}
          {majors.length > 4 && (
            <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(!expanded)}>
              <Text style={[styles.expandBtnText, { color: theme.primary }]}>
                {expanded ? "Thu gọn" : `Xem thêm ${majors.length - 4} ngành`}
              </Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={13} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {(uni.urls || []).length > 0 && (
        <View style={{ marginTop: 10, gap: 4 }}>
          {uni.urls.map((u, i) => (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(u)}>
              <Text style={[styles.urlLink, { color: theme.primary }]} numberOfLines={1}>
                {i === 0 ? "Xem trang tuyển sinh →" : `Trang tuyển sinh ${i + 1} →`}
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
  const titleOpacity = scrollY.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: "clamp" });
  const handleScroll = (e) => scrollY.setValue(Math.max(0, e.nativeEvent.contentOffset.y));

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

  const headerHeight = 58 + insets.top;

  const pickerConfig = {
    city: { title: "TP / Tỉnh", options: options.city, selected: cityIdx, onSelect: setCityIdx },
    type: { title: "Loại hình", options: options.type, selected: typeIdx, onSelect: setTypeIdx },
    major: { title: "Ngành học", options: options.major, selected: majorIdx, onSelect: setMajorIdx },
    subject: { title: "Khối thi", options: options.subjectComposition, selected: subjectIdx, onSelect: setSubjectIdx },
  }[activePicker];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]} pointerEvents="box-none">
        <LiquidButton providerId="UniversityScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: titleOpacity }]} numberOfLines={1}>
          {t("universities.title", "Tìm trường ĐH-CĐ")}
        </Animated.Text>
        <View style={{ width: 44 }} />
      </View>

      <AndroidGlassBackdrop providerId="UniversityScreen" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: headerHeight + 12, paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            Tra cứu thông tin trường và điểm chuẩn tuyển sinh.
          </Text>

          {/* Tabs */}
          <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
            {[
              { key: "filter", icon: "options-outline", label: "Bộ lọc" },
              { key: "search", icon: "search-outline", label: "Tìm theo tên" },
            ].map((tItem) => {
              const active = tab === tItem.key;
              return (
                <TouchableOpacity
                  key={tItem.key}
                  onPress={() => setTab(tItem.key)}
                  style={[styles.tabBtn, active && { borderBottomColor: theme.primary }]}
                >
                  <Ionicons name={tItem.icon} size={14} color={active ? theme.primary : theme.subText} />
                  <Text style={[styles.tabBtnText, { color: active ? theme.primary : theme.subText }]}>
                    {tItem.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === "filter" ? (
            <View style={{ marginTop: 16 }}>
              {optionsLoading ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <View style={styles.filterGrid}>
                    <FilterField
                      label={cityIdx != null ? options.city[cityIdx] : null}
                      placeholder="TP / Tỉnh"
                      theme={theme}
                      onPress={() => setActivePicker("city")}
                    />
                    <FilterField
                      label={typeIdx != null ? options.type[typeIdx] : null}
                      placeholder="Loại hình"
                      theme={theme}
                      onPress={() => setActivePicker("type")}
                    />
                    <FilterField
                      label={majorIdx != null ? options.major[majorIdx] : null}
                      placeholder="Ngành học"
                      theme={theme}
                      onPress={() => setActivePicker("major")}
                    />
                    <FilterField
                      label={subjectIdx != null ? options.subjectComposition[subjectIdx] : null}
                      placeholder="Khối thi"
                      theme={theme}
                      onPress={() => setActivePicker("subject")}
                    />
                  </View>

                  <Text style={[styles.scoreLabel, { color: theme.text }]}>Điểm chuẩn</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {SCORE_OPTIONS.map((o) => {
                      const active = scoreValue === o.value;
                      return (
                        <TouchableOpacity
                          key={o.value}
                          onPress={() => setScoreValue(active ? null : o.value)}
                          style={[
                            styles.chip,
                            { backgroundColor: active ? theme.primary : theme.iconBackground, marginRight: 8 },
                          ]}
                        >
                          <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>
                            {o.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.searchButton, { backgroundColor: theme.primary }]}
                    onPress={handleFilterSearch}
                  >
                    <Ionicons name="search" size={16} color="#fff" />
                    <Text style={styles.searchButtonText}>Tìm kiếm</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ marginTop: 20 }}>
                {loading ? (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                ) : searched && universities.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.subText }]}>Không tìm thấy trường nào phù hợp</Text>
                ) : universities.length > 0 ? (
                  <>
                    <Text style={[styles.resultCount, { color: theme.subText }]}>
                      Tìm thấy <Text style={{ fontWeight: "700", color: theme.text }}>{universities.length}</Text> trường · Trang {currentPage}/{maxPage}
                    </Text>
                    {universities.map((uni, i) => (
                      <UniversityCard key={uni.universityCode ?? i} uni={uni} theme={theme} isDarkMode={isDarkMode} />
                    ))}
                    {maxPage > 1 && (
                      <View style={styles.pagination}>
                        <TouchableOpacity
                          disabled={currentPage <= 1}
                          onPress={() => handlePage(currentPage - 1)}
                          style={[styles.pageBtn, { backgroundColor: theme.iconBackground, opacity: currentPage <= 1 ? 0.4 : 1 }]}
                        >
                          <Ionicons name="chevron-back" size={16} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.pageIndicator, { color: theme.text }]}>
                          Trang {currentPage} / {maxPage}
                        </Text>
                        <TouchableOpacity
                          disabled={currentPage >= maxPage}
                          onPress={() => handlePage(currentPage + 1)}
                          style={[styles.pageBtn, { backgroundColor: theme.iconBackground, opacity: currentPage >= maxPage ? 0.4 : 1 }]}
                        >
                          <Ionicons name="chevron-forward" size={16} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  !searched && (
                    <View style={styles.placeholderBox}>
                      <Ionicons name="school-outline" size={44} color={theme.subText} />
                      <Text style={[styles.placeholderText, { color: theme.subText }]}>
                        Chọn bộ lọc rồi nhấn Tìm kiếm
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <View style={{ position: "relative", zIndex: 10 }}>
                <View style={[styles.searchBar, { backgroundColor: theme.iconBackground }]}>
                  <Ionicons name="search" size={16} color={theme.subText} />
                  <TextInput
                    value={nameQuery}
                    onChangeText={handleNameInput}
                    onSubmitEditing={() => handleNameSearch()}
                    placeholder="Nhập tên hoặc mã trường..."
                    placeholderTextColor={theme.subText}
                    style={[styles.searchInput, { color: theme.text }]}
                  />
                  {suggestLoading && <ActivityIndicator size="small" color={theme.primary} />}
                </View>
                {suggestions.length > 0 && (
                  <View style={[styles.suggestBox, { backgroundColor: theme.cardBackground, borderColor: theme.border }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
                    {suggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.suggestRow, { borderBottomColor: theme.border }]}
                        onPress={() => {
                          setNameQuery(s.name);
                          setSuggestions([]);
                          handleNameSearch(s.name);
                        }}
                      >
                        <Text style={[styles.suggestText, { color: theme.text }]} numberOfLines={1}>
                          {s.name}
                          {s.universityCode ? <Text style={{ color: theme.subText, fontSize: 12 }}> ({s.universityCode})</Text> : null}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: theme.primary, marginTop: 12 }]}
                disabled={!nameQuery.trim() || nameLoading}
                onPress={() => handleNameSearch()}
              >
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.searchButtonText}>Tìm</Text>
              </TouchableOpacity>

              <View style={{ marginTop: 20 }}>
                {nameLoading ? (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                ) : nameSearched && nameResults.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.subText }]}>Không tìm thấy trường nào</Text>
                ) : nameResults.length > 0 ? (
                  <>
                    <Text style={[styles.resultCount, { color: theme.subText }]}>
                      Tìm thấy <Text style={{ fontWeight: "700", color: theme.text }}>{nameResults.length}</Text> trường
                    </Text>
                    {nameResults.map((uni, i) => (
                      <UniversityCard key={uni.universityCode ?? i} uni={uni} theme={theme} isDarkMode={isDarkMode} />
                    ))}
                  </>
                ) : (
                  !nameSearched && (
                    <View style={styles.placeholderBox}>
                      <Ionicons name="search-outline" size={44} color={theme.subText} />
                      <Text style={[styles.placeholderText, { color: theme.subText }]}>
                        Nhập tên hoặc mã trường để tìm kiếm
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          )}

          {generalInfo.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={[styles.generalInfoTitle, { color: theme.text }]}>Quy chế tuyển sinh đại học</Text>
              <View style={[styles.generalInfoBox, { backgroundColor: theme.cardBackground }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
                {generalInfo.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.generalInfoRow, i < generalInfo.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
                    onPress={() => item.url && Linking.openURL(item.url)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.generalInfoItemTitle, { color: theme.text }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {item.publishDate && (
                        <Text style={[styles.generalInfoDate, { color: theme.subText }]}>{item.publishDate}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.subText} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
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
        />
      )}
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
  subtitle: { fontSize: 13, marginBottom: 14 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  filterGrid: { gap: 10, marginBottom: 4 },
  filterField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  filterFieldText: { fontSize: 14, flex: 1, marginRight: 8 },
  scoreLabel: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 13,
  },
  searchButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyText: { textAlign: "center", marginTop: 30, fontSize: 13 },
  resultCount: { fontSize: 13, marginBottom: 10 },
  placeholderBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
  placeholderText: { fontSize: 13 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },
  pageBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pageIndicator: { fontSize: 13, fontWeight: "600" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  suggestBox: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  suggestRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  suggestText: { fontSize: 14 },
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", gap: 10, marginBottom: 10 },
  cardIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6, lineHeight: 19 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  infoText: { fontSize: 12, flex: 1, lineHeight: 17 },
  majorsLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  majorRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: 1 },
  majorName: { fontSize: 12.5, lineHeight: 17 },
  majorCode: { fontSize: 11 },
  majorScore: { fontSize: 14, fontWeight: "800" },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  expandBtnText: { fontSize: 12, fontWeight: "600" },
  urlLink: { fontSize: 12, fontWeight: "600" },
  generalInfoTitle: { fontSize: 16, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  generalInfoBox: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  generalInfoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
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
    borderRadius: 16,
    padding: 16,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  pickerSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickerSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  pickerClearRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  pickerClearText: { fontSize: 13, fontWeight: "600" },
  pickerEmpty: { textAlign: "center", paddingVertical: 20, fontSize: 13 },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  pickerOptionText: { fontSize: 14, flex: 1, marginRight: 8 },
});

export default UniversityScreen;
