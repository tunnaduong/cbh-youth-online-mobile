import React, { useRef } from "react";
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
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";

const { width } = Dimensions.get("window");
const cardSize = (width - 48) / 3; // 4 columns with padding

const featureCards = [
  {
    id: 1,
    key: "examDocuments",
    icon: "book-outline",
  },
  {
    id: 2,
    key: "scoreLookup",
    icon: "search-outline",
  },
  {
    id: 3,
    key: "findUniversities",
    icon: "location-outline",
  },
  {
    id: 4,
    key: "printing",
    icon: "print-outline",
  },
  {
    id: 5,
    key: "trivia",
    icon: "help-circle-outline",
  },
  {
    id: 6,
    key: "game",
    icon: "game-controller-outline",
  },
];

const ExploreScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = insets.top + 64;

  const handleCardPress = (card) => {
    if (card.key === "examDocuments") {
      navigation.navigate("StudyMaterialScreen");
      return;
    }

    Toast.show({
      type: "info",
      text1: t("exploreScreen.underDevelopment"),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top + 6, height: headerHeight }]}
        pointerEvents="box-none"
      >
        <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[
            styles.headerTitle,
            {
              color: theme.text,
              opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }),
            },
          ]}
        >
          {t("sidebar.explore")}
        </Animated.Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section with Greeting and Image */}
        <View style={styles.topSection}>
          <View style={styles.greetingContainer}>
            <Text style={[styles.greetingText, { color: theme.text }]}>{t("exploreScreen.greeting")}</Text>
            <Text style={styles.highlightText}>{t("exploreScreen.question")}</Text>
          </View>
          <View style={styles.imageContainer}>
            <Image
              source={require("../../../assets/student_girl.png")}
              style={styles.girlImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Bottom Section with Feature Grid */}
        <View style={[styles.bottomSection, { paddingBottom: 40 + insets.bottom }]}>
          <View style={styles.gridContainer}>
            {featureCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[styles.card, { backgroundColor: theme.cardBackground }]}
                onPress={() => handleCardPress(card)}
                activeOpacity={0.7}
              >
                <View style={styles.cardIconContainer}>
                  <Ionicons
                    name={card.icon}
                    size={32}
                    color={theme.primary}
                    style={styles.cardIcon}
                  />
                </View>
                <Text style={[styles.cardText, { color: theme.text }]} numberOfLines={2}>
                  {t(`exploreScreen.${card.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    minHeight: 200,
  },
  greetingContainer: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 10,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 32,
  },
  highlightText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  imageContainer: {
    width: 150,
    height: 180,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  girlImage: {
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: cardSize,
    height: cardSize,
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardIconContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIcon: {},
  cardText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },
});

export default ExploreScreen;
