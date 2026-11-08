import React, { useRef, useEffect } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";

const { width } = Dimensions.get("window");
// 3 columns: paddingHorizontal 16 on each side (32), plus 8px gap between each card (8 * 2 = 16)
const CARD_GAP = 8;
const cardWidth = Math.floor((width - 32 - CARD_GAP * 2) / 3);

const FEATURE_CARDS = [
  {
    id: "examDocuments",
    titleKey: "exploreScreen.examDocuments",
    descKey: "exploreScreen.examDocumentsDesc",
    defaultTitle: "Chợ tài liệu",
    defaultDesc: "Tài liệu học tập, đề thi, sách và nhiều hơn nữa",
    icon: "book",
    watermarkIcon: "book-outline",
    color: "#22C55E",
    lightBg: "#F0FAF2",
    lightBorder: "#D8F3DC",
    darkBg: "#12251A",
    darkBorder: "#1B3C29",
    route: "StudyMaterialScreen",
  },
  {
    id: "scoreLookup",
    titleKey: "exploreScreen.scoreLookup",
    descKey: "exploreScreen.scoreLookupDesc",
    defaultTitle: "Tra cứu điểm thi",
    defaultDesc: "Tra cứu điểm thi nhanh chóng, chính xác",
    icon: "search",
    watermarkIcon: "document-text-outline",
    color: "#3B82F6",
    lightBg: "#EFF6FF",
    lightBorder: "#DBEAFE",
    darkBg: "#112038",
    darkBorder: "#193155",
    route: null,
  },
  {
    id: "findUniversities",
    titleKey: "exploreScreen.findUniversities",
    descKey: "exploreScreen.findUniversitiesDesc",
    defaultTitle: "Tìm trường ĐH-CĐ",
    defaultDesc: "Khám phá các trường Đại học, Cao đẳng",
    icon: "location",
    watermarkIcon: "business-outline",
    color: "#F59E0B",
    lightBg: "#FFFBEB",
    lightBorder: "#FEF3C7",
    darkBg: "#282011",
    darkBorder: "#3E3117",
    route: "UniversityScreen",
  },
  {
    id: "printing",
    titleKey: "exploreScreen.printing",
    descKey: "exploreScreen.printingDesc",
    defaultTitle: "In ấn tài liệu",
    defaultDesc: "In tài liệu, bài tập, đồ án... tiện lợi",
    icon: "print",
    watermarkIcon: "print-outline",
    color: "#8B5CF6",
    lightBg: "#F5F3FF",
    lightBorder: "#EDE9FE",
    darkBg: "#201833",
    darkBorder: "#332552",
    route: null,
  },
  {
    id: "trivia",
    titleKey: "exploreScreen.trivia",
    descKey: "exploreScreen.triviaDesc",
    defaultTitle: "Đố vui",
    defaultDesc: "Thử thách kiến thức, nhận quà hấp dẫn",
    icon: "help",
    watermarkIcon: "bulb-outline",
    color: "#EC4899",
    lightBg: "#FDF2F8",
    lightBorder: "#FCE7F3",
    darkBg: "#291522",
    darkBorder: "#411D35",
    route: "QuizScreen",
  },
  {
    id: "game",
    titleKey: "exploreScreen.game",
    descKey: "exploreScreen.gameDesc",
    defaultTitle: "Game",
    defaultDesc: "Giải trí, thư giãn sau giờ học",
    icon: "game-controller",
    watermarkIcon: "game-controller-outline",
    color: "#10B981",
    lightBg: "#ECFDF5",
    lightBorder: "#D1FAE5",
    darkBg: "#10261E",
    darkBorder: "#173D2F",
    route: "GamesScreen",
  },
];

const ExploreScreen = ({ navigation, isTab = false, scrollTriggerRef }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle("light-content", "transparent");
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(() => {
        scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
      });
    }
  }, [scrollTriggerRef]);

  const handleCardPress = (card) => {
    if (card.route) {
      navigation.navigate(card.route);
      return;
    }

    Toast.show({
      type: "info",
      text1: t("exploreScreen.underDevelopment", "Tính năng đang được phát triển"),
    });
  };

  const headerBgColors = isDarkMode
    ? ["#0F2D1B", "#15472A"]
    : ["#14532D", "#15803D"];

  const COLLAPSE_DISTANCE = 42;
  const EXTRA_TOP = 120;
  const headerInitialHeight = insets.top + (isTab ? 112 : 108);

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [0, -COLLAPSE_DISTANCE],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE * 0.75],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AndroidGlassBackdrop providerId="ExploreScreen" style={{ flex: 1 }}>
        {/* Sticky Header with School Silhouette & Search Bar */}
        <Animated.View
          style={[
            styles.stickyHeaderContainer,
            {
              top: -EXTRA_TOP,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={isDarkMode ? ["rgba(20, 83, 45, 0.45)", "rgba(15, 23, 42, 0)"] : ["#E8F8EA", "rgba(240, 253, 244, 0.4)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.headerGradient,
              {
                paddingTop: EXTRA_TOP + insets.top + (isTab ? 10 : 6),
                paddingBottom: 14,
              },
            ]}
          >

            {/* Header Title Row - smoothly collapses on scroll */}
            <Animated.View
              style={[
                styles.headerTitleRow,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              <Text style={[styles.headerTitleText, { color: theme.text }]}>
                {t("sidebar.explore", "Khám phá")}
              </Text>
              <Text style={{ fontSize: 16, color: "#EAB308", marginLeft: 6 }}>✦</Text>
            </Animated.View>

            {/* Search Bar - remains sticky at the top when scrolling */}
            <View style={styles.searchRow}>
              {!isTab && (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.stickyBackButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate("SearchScreen")}
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
                    flex: 1,
                  },
                ]}
              >
                <Ionicons
                  name="search"
                  size={19}
                  color={isDarkMode ? "#9CA3AF" : "#6B7280"}
                  style={styles.searchIcon}
                />
                <Text
                  style={[
                    styles.searchPlaceholder,
                    { color: isDarkMode ? "#9CA3AF" : "#9CA3AF" },
                  ]}
                  numberOfLines={1}
                >
                  {t(
                    "exploreScreen.searchPlaceholder",
                    "Tìm kiếm trên diễn đàn..."
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerInitialHeight,
              paddingBottom: isTab ? 140 : 60 + insets.bottom,
            },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >

          {/* Welcome / Hero Banner */}
          <View style={styles.heroOuterContainer}>
            <LinearGradient
              colors={
                isDarkMode
                  ? ["#133321", "#0E2418"]
                  : ["#EAF8EC", "#E0F5E3"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.heroCard,
                {
                  borderColor: isDarkMode ? "#1B472C" : "#D5EBD7",
                },
              ]}
            >
              {/* Left Column: Greeting + Highlighted Text */}
              <View style={styles.heroTextColumn}>
                <Text
                  style={[
                    styles.heroGreetingText,
                    { color: isDarkMode ? "#F3F4F6" : "#0F2E1E" },
                  ]}
                >
                  {t("exploreScreen.greeting", "Chào bạn, hôm nay\nbạn muốn ")}
                </Text>

                <View style={styles.heroQuestionContainer}>
                  <Text style={styles.heroQuestionText}>
                    {t("exploreScreen.question", "làm gì...?")}
                  </Text>
                  {/* Decorative underline doodles */}
                  <View style={styles.doodleRow}>
                    <View
                      style={[
                        styles.doodleLine,
                        { backgroundColor: "#F59E0B", width: 56 },
                      ]}
                    />
                    <View
                      style={[
                        styles.doodleLine,
                        { backgroundColor: "#22C55E", width: 34, marginLeft: 3 },
                      ]}
                    />
                  </View>
                </View>

                <Text
                  style={[
                    styles.heroSubtitleText,
                    { color: isDarkMode ? "#9CA3AF" : "#4B5563" },
                  ]}
                >
                  {t(
                    "exploreScreen.heroSubtitle",
                    "Khám phá các tính năng, kết nối với cộng đồng và tận hưởng trải nghiệm tuyệt vời trên CBH Online!"
                  )}
                </Text>
              </View>

              {/* Right Column: Girl Illustration with Decorative Accents */}
              <View style={styles.heroImageColumn}>
                {/* Soft glow halo behind the student */}
                <View
                  style={[
                    styles.heroHalo,
                    {
                      backgroundColor: isDarkMode
                        ? "rgba(34, 197, 94, 0.12)"
                        : "#DCFCE7",
                    },
                  ]}
                />
                {/* Floating crown & sparkle doodles */}
                <Text style={styles.sparkleDoodle}>✦</Text>
                <Text style={styles.plusDoodle}>+</Text>
                <Ionicons
                  name="sparkles"
                  size={16}
                  color="#22C55E"
                  style={styles.crownDoodle}
                />
                <Image
                  source={require("../../../assets/student_girl.png")}
                  style={styles.heroGirlImage}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          </View>

          {/* 6 Feature Cards Grid */}
          <View style={styles.gridContainer}>
            {FEATURE_CARDS.map((card) => {
              const bg = isDarkMode ? card.darkBg : card.lightBg;
              const border = isDarkMode ? card.darkBorder : card.lightBorder;

              return (
                <TouchableOpacity
                  key={card.id}
                  style={[
                    styles.featureCard,
                    {
                      width: cardWidth,
                      backgroundColor: bg,
                      borderColor: border,
                    },
                  ]}
                  onPress={() => handleCardPress(card)}
                  activeOpacity={0.75}
                >
                  {/* Faint Background Watermark Illustration */}
                  <View style={styles.cardWatermarkWrapper}>
                    <Ionicons
                      name={card.watermarkIcon}
                      size={54}
                      color={card.color}
                      style={{ opacity: isDarkMode ? 0.07 : 0.09 }}
                    />
                  </View>

                  {/* Top Colored Icon Badge */}
                  <View
                    style={[
                      styles.cardIconBadge,
                      { backgroundColor: card.color },
                    ]}
                  >
                    <Ionicons name={card.icon} size={22} color="#FFFFFF" />
                  </View>

                  {/* Title & Description */}
                  <View style={styles.cardContent}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: isDarkMode ? "#F9FAFB" : "#111827" },
                      ]}
                      numberOfLines={2}
                    >
                      {t(card.titleKey, card.defaultTitle)}
                    </Text>
                    <Text
                      style={[
                        styles.cardDesc,
                        { color: isDarkMode ? "#9CA3AF" : "#6B7280" },
                      ]}
                      numberOfLines={3}
                    >
                      {t(card.descKey, card.defaultDesc)}
                    </Text>
                  </View>

                  {/* Bottom Circular Forward Button */}
                  <View
                    style={[
                      styles.cardArrowCircle,
                      { backgroundColor: card.color },
                    ]}
                  >
                    <Ionicons
                      name="arrow-forward"
                      size={12}
                      color="#FFFFFF"
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stickyHeaderContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingHorizontal: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    position: "relative",
    overflow: "hidden",
  },
  headerWatermark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    height: 34,
  },
  headerTitleText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stickyBackButton: {
    marginRight: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 14.5,
    flex: 1,
  },
  heroOuterContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  heroTextColumn: {
    flex: 1,
    paddingRight: 8,
    zIndex: 2,
  },
  heroGreetingText: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 25,
  },
  heroQuestionContainer: {
    marginTop: 2,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  heroQuestionText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#16A34A",
  },
  doodleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  doodleLine: {
    height: 3.5,
    borderRadius: 2,
  },
  heroSubtitleText: {
    fontSize: 11.5,
    lineHeight: 15.5,
    marginTop: 4,
  },
  heroImageColumn: {
    width: 125,
    height: 165,
    position: "relative",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  heroHalo: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 62.5,
    bottom: 5,
    right: 0,
    opacity: 0.85,
  },
  heroGirlImage: {
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
  sparkleDoodle: {
    position: "absolute",
    top: 32,
    left: 2,
    fontSize: 15,
    color: "#22C55E",
    fontWeight: "800",
  },
  plusDoodle: {
    position: "absolute",
    bottom: 24,
    left: 8,
    fontSize: 18,
    color: "#22C55E",
    fontWeight: "900",
  },
  crownDoodle: {
    position: "absolute",
    top: 6,
    left: 46,
    zIndex: 2,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 14,
  },
  featureCard: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  cardWatermarkWrapper: {
    position: "absolute",
    right: -8,
    bottom: -6,
    pointerEvents: "none",
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    marginTop: 6,
    flex: 1,
  },
  cardTitle: {
    fontSize: 12.8,
    fontWeight: "700",
    lineHeight: 16,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 9.8,
    lineHeight: 13.5,
  },
  cardArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
});

export default ExploreScreen;
