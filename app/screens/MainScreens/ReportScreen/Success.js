import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";
import ReportHeader from "../../../components/ReportHeader";
import { useTheme } from "../../../contexts/ThemeContext";

export default function Success({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();

  const handleReturnHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainScreens" }],
      })
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <ReportHeader navigation={navigation} title="Tạo báo cáo" />

      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Báo cáo vi phạm</Text>
          <Text style={styles.headerSubtitle}>
            THPT Chuyên Biên Hòa - Hà Nam
          </Text>
        </View>
        <View style={styles.warningIcon}>
          <Ionicons name="warning" size={24} color="#fff" />
        </View>
      </View>

      {/* Steps Indicator */}
      <View style={styles.stepsContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={[styles.stepText, { color: theme.primary }]}>
            Chọn đối tượng
          </Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: theme.primary }]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={[styles.stepText, { color: theme.primary }]}>
            Chi tiết vi phạm
          </Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: theme.primary }]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={[styles.stepText, { color: theme.primary }]}>
            Xác nhận
          </Text>
        </View>
      </View>

      {/* Success Content */}
      <View style={styles.successContent}>
        <View
          style={{
            backgroundColor: isDarkMode ? "#064e3b" : "#F3FBF2",
            paddingVertical: 60,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={50} color="#fff" />
          </View>
          <Text style={[styles.successText, { color: theme.text }]}>Gửi báo cáo thành công!</Text>
        </View>
      </View>

      {/* Return Button */}
      <TouchableOpacity style={[styles.returnButton, { backgroundColor: theme.primary }]} onPress={handleReturnHome}>
        <Text style={styles.returnButtonText}>Quay về trang chủ</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
  },
  warningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepText: {
    fontSize: 12,
    textAlign: "center",
  },
  stepLine: {
    height: 1,
    flex: 0.5,
    marginHorizontal: -10,
  },
  successContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  returnButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  returnButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
