import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giới thiệu</Text>
        <View className="w-6 h-6"></View>
      </View>

      <ScrollView style={styles.content}>
        {/* School Info */}
        <View style={styles.schoolInfo}>
          <Image
            source={require("../../../assets/school-logo.jpg")}
            style={styles.schoolLogo}
          />
          <Text style={styles.schoolName}>Trường THPT Chuyên Biên Hòa</Text>
        </View>

        <Text style={styles.description}>
          Trường THPT Chuyên Biên Hòa, tỉnh Hà Nam, với truyền thống hơn 60 năm
          xây dựng và phát triển, là ngọn cờ đầu đào tạo mũi nhọn và phát triển
          toàn diện học sinh.
        </Text>

        <Text style={styles.description}>
          Trường tự hào với nhiều giải thưởng, thành tích xuất sắc và mô hình
          giáo dục hiện đại, tích hợp các kỹ năng sống.
        </Text>

        <Section title="Lịch sử Thành tích">
          <Text style={styles.sectionText}>
            Thành lập năm 1959, trường cấp III đầu tiên của Hà Nam. Đạt nhiều
            Huân chương Lao động và Độc lập cao quý. Nổi bật với hơn 60 giải HSG
            quốc gia năm 2023-2024.
          </Text>
        </Section>

        <Section title="Hoạt động ngoại khóa">
          <Text style={styles.sectionText}>
            Hơn 20 câu lạc bộ đa dạng: Nhảy, MC, Tin học, STEM... Phát triển kỹ
            năng mềm và sáng tạo cho học sinh. Môi trường học tập thân thiện,
            năng động và sáng tạo.
          </Text>
        </Section>

        <Section title="Mục tiêu giáo dục">
          <View style={styles.bulletPoints}>
            <Text style={styles.bulletPoint}>
              • Phát triển toàn diện về trí tuệ, kỹ năng và nhân cách.
            </Text>
            <Text style={styles.bulletPoint}>
              • Tạo đam mê học tập và khám phá cho học sinh.
            </Text>
            <Text style={styles.bulletPoint}>
              • Xây dựng nền tảng vững chắc cho tương lai học sinh
            </Text>
          </View>
        </Section>

        {/* School Info */}
        <View style={[styles.schoolInfo, { marginTop: 40 }]}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.schoolLogo}
          />
          <Text style={styles.schoolName}>Ứng dụng CBH Youth Online</Text>
        </View>

        <Text style={styles.description}>
          CBH Youth Online là một ứng dụng giúp học sinh và giáo viên của Trường
          THPT Chuyên Biên Hòa có thể trao đổi và học tập một cách dễ dàng và
          hiệu quả.
        </Text>

        <Text style={styles.description}>
          Thuộc quản lý của học sinh/cựu học sinh, hoạt động độc lập với đội ngũ
          riêng, không trực thuộc quản lý của nhà trường.
        </Text>

        <Section title="Không bao giờ bỏ lỡ thông tin">
          <Text style={styles.sectionText}>
            Cập nhật thông tin mới nhất về sự kiện trường và CLB. Chia sẻ kiến
            thức, tài liệu học tập, kinh nghiệm từ các thế hệ.
          </Text>
        </Section>

        <Section title="Giải pháp mới dành cho xung kích">
          <Text style={styles.sectionText}>
            Gửi báo cáo vi phạm tập thể lớp và cá nhân một cách dễ dàng, ngay
            trên thiết bị di động mà không cần giấy tờ sổ sách.
          </Text>
        </Section>

        <Section title="Và còn nhiều tính năng khác...">
          <Text style={styles.sectionText}>
            Hãy tự mình khám phá nhé! Chúc bạn có một trải nghiệm thú vị.
          </Text>
        </Section>

        <Text style={styles.copyright}>
          © 2025 Công ty Cổ phần Giải pháp Giáo dục Fatties Software - Được phát
          triển bởi học sinh, dành cho học sinh.
        </Text>
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  schoolInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  schoolLogo: {
    width: 64,
    height: 64,
    marginBottom: 12,
    borderRadius: 35,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "justify",
  },
  section: {
    backgroundColor: "#F2F9F2",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#319527",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  bulletPoints: {
    marginTop: 4,
  },
  bulletPoint: {
    fontSize: 14,
    color: "#333",
    lineHeight: 24,
  },
  copyright: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingBottom: 16,
  },
});
