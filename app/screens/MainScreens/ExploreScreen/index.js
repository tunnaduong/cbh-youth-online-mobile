import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const cardSize = (width - 48) / 3; // 4 columns with padding

const featureCards = [
  {
    id: 1,
    title: "Tài liệu ôn thi",
    icon: "book-outline",
  },
  {
    id: 2,
    title: "Tra cứu điểm thi",
    icon: "search-outline",
  },
  {
    id: 3,
    title: "Tìm trường ĐH-CĐ",
    icon: "location-outline",
  },
  {
    id: 4,
    title: "In ấn tài liệu",
    icon: "print-outline",
  },
  {
    id: 5,
    title: "Đố vui",
    icon: "help-circle-outline",
  },
  {
    id: 6,
    title: "Game",
    icon: "game-controller-outline",
  },
];

const ExploreScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const handleCardPress = (card) => {
    Toast.show({
      type: "info",
      text1: "Tính năng đang được phát triển",
    });
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section with Greeting and Image */}
        <View style={styles.topSection}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingText}>Chào bạn, hôm nay bạn muốn </Text>
            <Text style={styles.highlightText}>làm gì...?</Text>
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
        <View style={styles.bottomSection}>
          <View style={styles.gridContainer}>
            {featureCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={styles.card}
                onPress={() => handleCardPress(card)}
                activeOpacity={0.7}
              >
                <View style={styles.cardIconContainer}>
                  <Ionicons
                    name={card.icon}
                    size={32}
                    color="#319527"
                    style={styles.cardIcon}
                  />
                </View>
                <Text style={styles.cardText} numberOfLines={2}>
                  {card.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
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
    color: "#333333",
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
    backgroundColor: "#FFFFFF",
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
    color: "#333333",
    textAlign: "center",
    marginTop: 4,
  },
});

export default ExploreScreen;
