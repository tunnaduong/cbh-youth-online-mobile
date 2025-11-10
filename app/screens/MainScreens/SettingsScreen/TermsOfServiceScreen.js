import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

export default function TermsOfServiceScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Điều khoản sử dụng</Text>
        <View className="w-6 h-6"></View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.introText}>
          Chào mừng bạn đến với Diễn đàn học sinh Chuyên Biên Hòa. Khi truy cập
          và sử dụng diễn đàn, bạn đồng ý tuân thủ các điều khoản dưới đây. Xin
          vui lòng đọc kỹ trước khi sử dụng dịch vụ.
        </Text>

        <Section title="1. Chấp nhận điều khoản">
          <Text style={styles.sectionText}>
            Việc đăng ký tài khoản hoặc sử dụng diễn đàn đồng nghĩa với việc bạn
            đã đọc, hiểu và đồng ý tuân thủ Điều khoản này.
          </Text>
          <Text style={styles.sectionText}>
            Nếu bạn không đồng ý, vui lòng không sử dụng diễn đàn.
          </Text>
        </Section>

        <Section title="2. Đăng ký và sử dụng tài khoản">
          <Text style={styles.sectionText}>
            • Bạn cần cung cấp thông tin chính xác khi đăng ký tài khoản.
          </Text>
          <Text style={styles.sectionText}>
            • Bạn chịu trách nhiệm bảo mật mật khẩu và hoạt động trên tài khoản
            của mình.
          </Text>
          <Text style={styles.sectionText}>
            • Không được sử dụng tài khoản của người khác hoặc chia sẻ tài khoản
            cho nhiều người.
          </Text>
        </Section>

        <Section title="3. Nội dung do thành viên đăng tải">
          <Text style={styles.sectionText}>
            • Bạn giữ quyền sở hữu đối với nội dung mình tạo (bài viết, bình
            luận, hình ảnh, tài liệu).
          </Text>
          <Text style={styles.sectionText}>
            • Bằng việc đăng tải, bạn đồng ý cho phép diễn đàn lưu trữ, hiển thị
            và chia sẻ nội dung này trong phạm vi cộng đồng.
          </Text>
          <Text style={styles.sectionText}>
            • Bạn không được đăng tải nội dung vi phạm pháp luật, nội dung phản
            cảm, bạo lực, thù ghét, quấy rối, hoặc vi phạm bản quyền.
          </Text>
        </Section>

        <Section title="4. Quy tắc ứng xử">
          <Text style={styles.sectionText}>
            • Tôn trọng thành viên khác, không công kích cá nhân, không gây chia
            rẽ.
          </Text>
          <Text style={styles.sectionText}>
            • Không spam, quảng cáo, hoặc phát tán virus, mã độc.
          </Text>
          <Text style={styles.sectionText}>
            • Không mạo danh giáo viên, học sinh khác hoặc Ban quản trị.
          </Text>
          <Text style={styles.sectionText}>
            • Thảo luận, chia sẻ mang tính xây dựng, phù hợp với văn hóa học
            đường.
          </Text>
        </Section>

        <Section title="5. Quyền và trách nhiệm của diễn đàn">
          <Text style={styles.sectionText}>
            • Ban quản trị có quyền kiểm duyệt, chỉnh sửa, xóa bài viết, khóa
            hoặc xóa tài khoản nếu phát hiện vi phạm.
          </Text>
          <Text style={styles.sectionText}>
            • Diễn đàn không chịu trách nhiệm đối với nội dung do thành viên đăng
            tải, nhưng sẽ phối hợp xử lý nếu có khiếu nại.
          </Text>
          <Text style={styles.sectionText}>
            • Chúng tôi có thể tạm ngưng hoặc chấm dứt dịch vụ bất kỳ lúc nào vì
            lý do bảo trì, kỹ thuật hoặc pháp luật.
          </Text>
        </Section>

        <Section title="6. Bảo mật và quyền riêng tư">
          <Text style={styles.sectionText}>
            • Việc thu thập và sử dụng dữ liệu cá nhân của bạn được quy định tại
            Chính sách bảo mật.
          </Text>
          <Text style={styles.sectionText}>
            • Khi sử dụng diễn đàn, bạn đồng ý rằng dữ liệu có thể được xử lý theo
            chính sách đó.
          </Text>
        </Section>

        <Section title="7. Trách nhiệm pháp lý">
          <Text style={styles.sectionText}>
            • Bạn tự chịu trách nhiệm về nội dung mình đăng và hành vi của mình
            trên diễn đàn.
          </Text>
          <Text style={styles.sectionText}>
            • Bạn đồng ý bồi thường cho diễn đàn và các bên liên quan nếu hành vi
            của bạn gây thiệt hại, vi phạm pháp luật hoặc quyền lợi người khác.
          </Text>
        </Section>

        <Section title="8. Sửa đổi điều khoản">
          <Text style={styles.sectionText}>
            • Điều khoản này có thể được thay đổi, cập nhật bất kỳ lúc nào.
          </Text>
          <Text style={styles.sectionText}>
            • Thông báo sẽ được đăng công khai, và việc tiếp tục sử dụng diễn đàn
            đồng nghĩa với việc bạn chấp nhận điều khoản mới.
          </Text>
        </Section>

        <Section title="9. Liên hệ">
          <Text style={styles.sectionText}>
            Nếu có câu hỏi hoặc yêu cầu liên quan đến Điều khoản sử dụng, vui
            lòng liên hệ:
          </Text>
          <Text style={styles.sectionText}>
            Ban quản trị Diễn đàn học sinh Chuyên Biên Hòa
          </Text>
          <Text style={styles.sectionText}>Email: hotro@chuyenbienhoa.com</Text>
          <Text style={styles.sectionText}>Hotline: 0365520031</Text>
        </Section>
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
  introText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 20,
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
    marginBottom: 8,
  },
});

