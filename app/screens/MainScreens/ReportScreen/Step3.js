import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";

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

export default function Step3({ navigation, route }) {
  const {
    studentName,
    reportDate,
    violationType,
    notes,
    absences,
    cleanliness,
    uniform,
  } = route.params;
  const insets = useSafeAreaInsets();
  const isClassViolation = Boolean(cleanliness || uniform);
  const { userInfo } = useContext(AuthContext);

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor: "#319527",
                },
              ]}
            >
              <Text style={[styles.stepNumberText, { color: "#fff" }]}>
                {step.id}
              </Text>
            </View>
            <Text style={[styles.stepText, { color: "#319527" }]}>
              {step.title}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View style={[styles.stepLine, { backgroundColor: "#319527" }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const InfoItem = ({ label, value }) => (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const renderStudentInfo = () => (
    <>
      <InfoItem label="Họ tên học sinh" value={studentName} />
      <InfoItem label="Thời gian báo cáo" value={reportDate} />
      <InfoItem label="Xung kích báo cáo" value={userInfo.profile_name} />
      <InfoItem label="Lỗi vi phạm" value={violationType || "Chưa chọn"} />
    </>
  );

  const renderClassInfo = () => (
    <>
      <InfoItem label="Tên lớp" value={studentName} />
      <InfoItem label="Thời gian báo cáo" value={reportDate} />
      <InfoItem label="Xung kích báo cáo" value={userInfo.profile_name} />
      <InfoItem label="Vắng" value={absences || "0"} />
      <InfoItem label="Vệ sinh" value={cleanliness} />
      <InfoItem label="Đồng phục" value={uniform} />
      <InfoItem label="Lỗi vi phạm" value={violationType || "Chưa chọn"} />
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

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

      <ScrollView style={styles.scrollView}>
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
          <Text style={styles.contentTitle}>Bước 3: Xác nhận thông tin</Text>
          <Text style={styles.contentSubtitle}>
            Vui lòng kiểm tra lại thông tin trước khi gửi báo cáo
          </Text>

          <View style={styles.confirmationCard}>
            {isClassViolation ? renderClassInfo() : renderStudentInfo()}
            <View style={styles.notesContainer}>
              <Text style={styles.infoLabel}>Ghi chú</Text>
              <Text style={styles.notesText}>
                {notes || "Không có ghi chú"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={() => {
          // TODO: Implement submit logic
          navigation.reset({
            index: 0,
            routes: [{ name: "Success" }],
          });
        }}
      >
        <Text style={styles.submitButtonText}>Gửi báo cáo</Text>
        <Ionicons name="send" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
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
  confirmationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  infoItem: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  notesContainer: {
    marginTop: 8,
  },
  notesText: {
    fontSize: 16,
    color: "#000",
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    minHeight: 100,
  },
  submitButton: {
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
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
});
