import React, { useState } from "react";
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
import ReportHeader from "../../../components/ReportHeader";

const STEPS = [
  {
    id: 1,
    title: "Chọn đối tượng",
    subtitle: "Vui lòng chọn đối tượng bạn muốn báo cáo",
  },
  {
    id: 2,
    title: "Chi tiết vi phạm",
    subtitle: "Mô tả chi tiết về hành vi vi phạm",
  },
  {
    id: 3,
    title: "Xác nhận",
    subtitle: "Xác nhận thông tin báo cáo",
  },
];

const VIOLATION_TYPES = [
  {
    id: "student",
    icon: "person",
    title: "Vi phạm học sinh",
    description:
      "Báo cáo các vi phạm của cá nhân học sinh như: đi học muộn, vi phạm nội quy...",
  },
  {
    id: "class",
    icon: "people",
    title: "Vi phạm tập thể lớp",
    description:
      "Báo cáo các vi phạm liên quan đến toàn bộ lớp học như: trực nhật không tốt, nề nếp lớp...",
  },
];

export default function ReportScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);
  const insets = useSafeAreaInsets();

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor: step.id === 1 ? "#319527" : "#E5E5E5",
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  { color: step.id === 1 ? "#fff" : "#666" },
                ]}
              >
                {step.id}
              </Text>
            </View>
            <Text
              style={[
                styles.stepText,
                { color: step.id === 1 ? "#319527" : "#666" },
              ]}
            >
              {step.title}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View style={[styles.stepLine, { backgroundColor: "#E5E5E5" }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <ReportHeader navigation={navigation} title="Tạo báo cáo" />

      <View
        style={{
          backgroundColor: "#FFF3CD",
          borderLeftWidth: 4,
          borderLeftColor: "#FFC107",
          padding: 12,
          marginHorizontal: 15,
          marginTop: 10,
          marginBottom: 5,
          borderRadius: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-circle-outline" size={20} color="#856404" />
        <Text
          style={{
            marginLeft: 10,
            color: "#856404",
            fontSize: 14,
            flex: 1,
          }}
        >
          Chức năng đang ở chế độ xem trước. Khi nào hệ thống được cập nhật, bạn
          sẽ có thể sử dụng chức năng này.
        </Text>
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

      {/* Step Indicator */}
      <StepIndicator />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.contentTitle}>Bước 1: Chọn đối tượng báo cáo</Text>
        <Text style={styles.contentSubtitle}>
          Vui lòng chọn đối tượng bạn muốn báo cáo
        </Text>

        {/* Violation Type Cards */}
        {VIOLATION_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.card,
              selectedType === type.id && styles.selectedCard,
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={type.icon} size={24} color="#319527" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{type.title}</Text>
              <Text style={styles.cardDescription} numberOfLines={3}>
                {type.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { opacity: selectedType ? 1 : 0.5 }]}
        disabled={!selectedType}
        onPress={() => {
          navigation.navigate("Step2", {
            violationType: selectedType,
          });
        }}
      >
        <Text style={styles.continueButtonText}>Tiếp tục</Text>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
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
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "600",
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
  content: {
    flex: 1,
    padding: 16,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  contentSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  card: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  selectedCard: {
    backgroundColor: "#F3FDF1",
    borderColor: "#319527",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3FDF1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#319527",
    margin: 16,
    padding: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
});
