import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
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

export default function PrivacyPolicyScreen({ navigation }) {
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
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Chính sách bảo mật</Text>
        <View style={{ width: 24, height: 24 }}></View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={[styles.introText, { color: theme.text }]}>
          Diễn đàn học sinh Chuyên Biên Hòa cam kết bảo vệ quyền riêng tư và
          thông tin cá nhân của tất cả thành viên tham gia. Chính sách bảo mật
          này nhằm giải thích rõ cách chúng tôi thu thập, sử dụng, lưu trữ và
          bảo vệ dữ liệu của bạn khi truy cập và sử dụng diễn đàn.
        </Text>

        <Section title="1. Thông tin chúng tôi thu thập" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Khi bạn sử dụng diễn đàn, chúng tôi có thể thu thập các loại thông
            tin sau:
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Thông tin tài khoản: bao gồm tên đăng nhập, mật khẩu, địa chỉ
            email, số điện thoại (nếu bạn cung cấp).
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Thông tin cá nhân: như họ tên, trường lớp, năm học, ảnh đại diện
            hoặc các dữ liệu mà bạn chủ động chia sẻ trong hồ sơ cá nhân.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Dữ liệu hoạt động: lịch sử bài viết, bình luận, lượt thích, báo
            cáo vi phạm, tin nhắn riêng tư giữa các thành viên.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Thông tin kỹ thuật: địa chỉ IP, loại thiết bị, hệ điều hành,
            trình duyệt, cookies và dữ liệu nhật ký truy cập.
          </Text>
        </Section>

        <Section title="2. Mục đích sử dụng thông tin" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Thông tin cá nhân của bạn được sử dụng cho các mục đích sau:
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Cung cấp và duy trì dịch vụ của diễn đàn.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Hỗ trợ xác minh danh tính, quản lý tài khoản, khôi phục mật khẩu.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Cải thiện trải nghiệm người dùng, đề xuất nội dung phù hợp.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Duy trì an ninh, phát hiện và ngăn chặn hành vi gian lận, spam hoặc
            vi phạm quy định.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Liên hệ khi cần thiết (thông báo hệ thống, phản hồi yêu cầu hỗ
            trợ, cập nhật quy định).
          </Text>
        </Section>

        <Section title="3. Chia sẻ thông tin" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Chúng tôi không bán hoặc trao đổi thông tin cá nhân của bạn cho bên
            thứ ba vì mục đích thương mại. Tuy nhiên, thông tin có thể được chia
            sẻ trong các trường hợp sau:
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Theo yêu cầu pháp luật, cơ quan chức năng, hoặc khi có lệnh từ cơ
            quan có thẩm quyền.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Khi cần bảo vệ quyền lợi hợp pháp của Diễn đàn, thành viên khác
            hoặc cộng đồng.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Với các đối tác kỹ thuật (ví dụ: dịch vụ lưu trữ, bảo mật, phân
            tích dữ liệu) nhằm duy trì hoạt động của diễn đàn.
          </Text>
        </Section>

        <Section title="4. Lưu trữ và bảo mật thông tin" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Dữ liệu của bạn được lưu trữ trên hệ thống máy chủ có các biện
            pháp bảo mật kỹ thuật như tường lửa, mã hóa và kiểm soát truy cập.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Mật khẩu của bạn được lưu trữ dưới dạng mã hóa, không ai – kể cả
            quản trị viên – có thể xem trực tiếp.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Mặc dù chúng tôi nỗ lực bảo mật, nhưng không có hệ thống nào an
            toàn tuyệt đối. Người dùng cần tự bảo vệ thông tin tài khoản của mình
            bằng cách giữ kín mật khẩu và thoát khỏi tài khoản sau khi sử dụng.
          </Text>
        </Section>

        <Section title="5. Quyền của người dùng" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>Bạn có quyền:</Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Xem, chỉnh sửa, cập nhật thông tin cá nhân trong hồ sơ.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Yêu cầu xóa tài khoản hoặc dữ liệu cá nhân khỏi hệ thống (trừ các
            dữ liệu cần lưu giữ để tuân thủ pháp luật hoặc xử lý tranh chấp).
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Quyết định mức độ công khai thông tin trên diễn đàn (ví dụ: ai có
            thể xem hồ sơ, bài viết, tin nhắn).
          </Text>
        </Section>

        <Section title="6. Cookie và công nghệ theo dõi" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Diễn đàn có thể sử dụng cookie để lưu thông tin đăng nhập, ghi nhớ
            tùy chọn và phân tích hành vi người dùng.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Bạn có thể tắt cookie trong trình duyệt, nhưng điều này có thể làm
            giảm trải nghiệm sử dụng.
          </Text>
        </Section>

        <Section title="7. Chính sách dành cho trẻ vị thành niên" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Diễn đàn hướng đến học sinh trung học phổ thông, vì vậy chúng tôi
            đặc biệt lưu ý đến quyền riêng tư của người dưới 18 tuổi.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Phụ huynh hoặc giáo viên có thể liên hệ để yêu cầu hỗ trợ quản lý
            tài khoản học sinh nếu cần.
          </Text>
        </Section>

        <Section title="8. Thay đổi chính sách" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Chính sách này có thể được cập nhật bất kỳ lúc nào nhằm phù hợp
            với sự thay đổi của pháp luật, công nghệ hoặc hoạt động của diễn đàn.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Mọi thay đổi quan trọng sẽ được thông báo trên trang chủ hoặc qua
            email trước khi áp dụng.
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            • Khi tiếp tục sử dụng diễn đàn sau khi chính sách được cập nhật, bạn
            được coi là đã đồng ý với các điều khoản mới.
          </Text>
        </Section>

        <Section title="9. Liên hệ" theme={theme} isDarkMode={isDarkMode}>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Nếu có thắc mắc hoặc yêu cầu liên quan đến quyền riêng tư, vui lòng
            liên hệ:
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>
            Ban quản trị Diễn đàn học sinh Chuyên Biên Hòa
          </Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>Email: hotro@chuyenbienhoa.com</Text>
          <Text style={[styles.sectionText, { color: theme.text }]}>Hotline: 0365520031</Text>
        </Section>
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
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
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
    marginBottom: 8,
  },
});

