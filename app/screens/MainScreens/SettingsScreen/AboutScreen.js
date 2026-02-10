import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";

const Section = ({ title, children, theme, isDarkMode }) => (
  <View style={[styles.section, { backgroundColor: isDarkMode ? "#1f2937" : "#F2F9F2" }]}>
    <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Giới thiệu</Text>
        <View style={{ width: 24, height: 24 }}></View>
      </View>

      <ScrollView style={styles.content}>
        {/* School Info */}
        <View style={styles.schoolInfo}>
          <Image
            source={require("../../../assets/school-logo.jpg")}
            style={styles.schoolLogo}
          />
          <Text style={[styles.schoolName, { color: theme.primary }]}>Trường THPT Chuyên Biên Hòa</Text>
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          Trường THPT Chuyên Biên Hòa, tỉnh Ninh Bình, với truyền thống hơn 60
          năm xây dựng và phát triển, là ngọn cờ đầu đào tạo mũi nhọn và phát
          triển toàn diện học sinh.
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>
          Trường tự hào với nhiều giải thưởng, thành tích xuất sắc và mô hình
          giáo dục hiện đại, tích hợp các kỹ năng sống.
        </Text>

        <Section title="Lịch sử Thành tích" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Thành lập năm 1959, trường cấp III đầu tiên của Hà Nam cũ. Đạt nhiều
            Huân chương Lao động và Độc lập cao quý. Nổi bật với hơn 60 giải HSG
            quốc gia năm 2023-2024.
          </Text>
        </Section>

        <Section title="Hoạt động ngoại khóa" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Hơn 20 câu lạc bộ đa dạng: Nhảy, MC, Tin học, STEM... Phát triển kỹ
            năng mềm và sáng tạo cho học sinh. Môi trường học tập thân thiện,
            năng động và sáng tạo.
          </Text>
        </Section>

        <Section title="Mục tiêu giáo dục" theme={theme} isDarkMode={isDarkMode}>
          <View style={styles.bulletPoints}>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • Phát triển toàn diện về trí tuệ, kỹ năng và nhân cách.
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
              • Tạo đam mê học tập và khám phá cho học sinh.
            </Text>
            <Text style={[styles.bulletPoint, { color: theme.text }]}>
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
          <Text style={[styles.schoolName, { color: theme.primary }]}>Ứng dụng CBH Youth Online</Text>
        </View>

        <Text style={[styles.description, { color: theme.text }]}>
          CBH Youth Online là một ứng dụng giúp học sinh và giáo viên của Trường
          THPT Chuyên Biên Hòa có thể trao đổi và học tập một cách dễ dàng và
          hiệu quả.
        </Text>

        <Text style={[styles.description, { color: theme.text }]}>
          Thuộc quản lý của học sinh/cựu học sinh, hoạt động độc lập với đội ngũ
          riêng, không trực thuộc quản lý của nhà trường.
        </Text>

        <Section title="Không bao giờ bỏ lỡ thông tin" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Cập nhật thông tin mới nhất về sự kiện trường và CLB. Chia sẻ kiến
            thức, tài liệu học tập, kinh nghiệm từ các thế hệ.
          </Text>
        </Section>

        <Section title="Giải pháp mới dành cho xung kích" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Gửi báo cáo vi phạm tập thể lớp và cá nhân một cách dễ dàng, ngay
            trên thiết bị di động mà không cần giấy tờ sổ sách.
          </Text>
        </Section>

        <Section title="Và còn nhiều tính năng khác..." theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Hãy tự mình khám phá nhé! Chúc bạn có một trải nghiệm thú vị.
          </Text>
        </Section>

        <Text style={[styles.copyright, { color: theme.subText }]}>
          © 2025 Công ty TNHH Giải pháp Giáo dục Fatties Software - Được phát
          triển bởi học sinh, dành cho học sinh.
        </Text>
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
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
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "justify",
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bulletPoints: {
    marginTop: 4,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 24,
  },
  copyright: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingBottom: 16,
  },
});
