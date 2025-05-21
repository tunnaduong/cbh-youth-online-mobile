import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";

export default function Success({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleReturnHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainScreens" }],
      })
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View
        style={[
          styles.headerNav,
          Platform.OS === "android"
            ? { marginTop: insets.top }
            : { height: 65, paddingVertical: 12 },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back-circle" size={25} color={"#A7A7A7"} />
        </TouchableOpacity>
        <Text style={styles.headerNavTitle}>Tạo báo cáo</Text>
      </View>

      <View style={styles.header}>
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
          <View style={[styles.stepCircle, styles.completedStep]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={[styles.stepText, styles.completedStepText]}>
            Chọn đối tượng
          </Text>
        </View>
        <View style={[styles.stepLine, styles.completedLine]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.completedStep]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={[styles.stepText, styles.completedStepText]}>
            Chi tiết vi phạm
          </Text>
        </View>
        <View style={[styles.stepLine, styles.completedLine]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.completedStep]}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </View>
          <Text style={[styles.stepText, styles.completedStepText]}>
            Xác nhận
          </Text>
        </View>
      </View>

      {/* Success Content */}
      <View style={styles.successContent}>
        <View
          style={{
            backgroundColor: "#F3FBF2",
            paddingVertical: 60,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={50} color="#fff" />
          </View>
          <Text style={styles.successText}>Gửi báo cáo thành công!</Text>
        </View>
      </View>

      {/* Return Button */}
      <TouchableOpacity style={styles.returnButton} onPress={handleReturnHome}>
        <Text style={styles.returnButtonText}>Quay về trang chủ</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#319527",
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomColor: "#ccc",
    borderBottomWidth: 0.8,
    backgroundColor: "#F2F2F2",
  },
  headerNavTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 16,
    color: "#309627",
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
  completedStep: {
    backgroundColor: "#319527",
  },
  stepText: {
    fontSize: 12,
    textAlign: "center",
  },
  completedStepText: {
    color: "#319527",
  },
  stepLine: {
    height: 1,
    flex: 0.5,
    marginHorizontal: -10,
  },
  completedLine: {
    backgroundColor: "#319527",
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
    backgroundColor: "#319527",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
  },
  returnButton: {
    backgroundColor: "#319527",
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
