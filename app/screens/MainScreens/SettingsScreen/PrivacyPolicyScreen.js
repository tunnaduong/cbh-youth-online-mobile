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

export default function PrivacyPolicyScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chính sách bảo mật</Text>
        <View className="w-6 h-6"></View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.introText}>
          Diễn đàn học sinh Chuyên Biên Hòa cam kết bảo vệ quyền riêng tư và
          thông tin cá nhân của tất cả thành viên tham gia. Chính sách bảo mật
          này nhằm giải thích rõ cách chúng tôi thu thập, sử dụng, lưu trữ và
          bảo vệ dữ liệu của bạn khi truy cập và sử dụng diễn đàn.
        </Text>

        <Section title="1. Thông tin chúng tôi thu thập">
          <Text style={styles.sectionText}>
            Khi bạn sử dụng diễn đàn, chúng tôi có thể thu thập các loại thông
            tin sau:
          </Text>
          <Text style={styles.sectionText}>
            • Thông tin tài khoản: bao gồm tên đăng nhập, mật khẩu, địa chỉ
            email, số điện thoại (nếu bạn cung cấp).
          </Text>
          <Text style={styles.sectionText}>
            • Thông tin cá nhân: như họ tên, trường lớp, năm học, ảnh đại diện
            hoặc các dữ liệu mà bạn chủ động chia sẻ trong hồ sơ cá nhân.
          </Text>
          <Text style={styles.sectionText}>
            • Dữ liệu hoạt động: lịch sử bài viết, bình luận, lượt thích, báo
            cáo vi phạm, tin nhắn riêng tư giữa các thành viên.
          </Text>
          <Text style={styles.sectionText}>
            • Thông tin kỹ thuật: địa chỉ IP, loại thiết bị, hệ điều hành,
            trình duyệt, cookies và dữ liệu nhật ký truy cập.
          </Text>
        </Section>

        <Section title="2. Mục đích sử dụng thông tin">
          <Text style={styles.sectionText}>
            Thông tin cá nhân của bạn được sử dụng cho các mục đích sau:
          </Text>
          <Text style={styles.sectionText}>
            • Cung cấp và duy trì dịch vụ của diễn đàn.
          </Text>
          <Text style={styles.sectionText}>
            • Hỗ trợ xác minh danh tính, quản lý tài khoản, khôi phục mật khẩu.
          </Text>
          <Text style={styles.sectionText}>
            • Cải thiện trải nghiệm người dùng, đề xuất nội dung phù hợp.
          </Text>
          <Text style={styles.sectionText}>
            • Duy trì an ninh, phát hiện và ngăn chặn hành vi gian lận, spam hoặc
            vi phạm quy định.
          </Text>
          <Text style={styles.sectionText}>
            • Liên hệ khi cần thiết (thông báo hệ thống, phản hồi yêu cầu hỗ
            trợ, cập nhật quy định).
          </Text>
        </Section>

        <Section title="3. Chia sẻ thông tin">
          <Text style={styles.sectionText}>
            Chúng tôi không bán hoặc trao đổi thông tin cá nhân của bạn cho bên
            thứ ba vì mục đích thương mại. Tuy nhiên, thông tin có thể được chia
            sẻ trong các trường hợp sau:
          </Text>
          <Text style={styles.sectionText}>
            • Theo yêu cầu pháp luật, cơ quan chức năng, hoặc khi có lệnh từ cơ
            quan có thẩm quyền.
          </Text>
          <Text style={styles.sectionText}>
            • Khi cần bảo vệ quyền lợi hợp pháp của Diễn đàn, thành viên khác
            hoặc cộng đồng.
          </Text>
          <Text style={styles.sectionText}>
            • Với các đối tác kỹ thuật (ví dụ: dịch vụ lưu trữ, bảo mật, phân
            tích dữ liệu) nhằm duy trì hoạt động của diễn đàn.
          </Text>
        </Section>

        <Section title="4. Lưu trữ và bảo mật thông tin">
          <Text style={styles.sectionText}>
            • Dữ liệu của bạn được lưu trữ trên hệ thống máy chủ có các biện
            pháp bảo mật kỹ thuật như tường lửa, mã hóa và kiểm soát truy cập.
          </Text>
          <Text style={styles.sectionText}>
            • Mật khẩu của bạn được lưu trữ dưới dạng mã hóa, không ai – kể cả
            quản trị viên – có thể xem trực tiếp.
          </Text>
          <Text style={styles.sectionText}>
            • Mặc dù chúng tôi nỗ lực bảo mật, nhưng không có hệ thống nào an
            toàn tuyệt đối. Người dùng cần tự bảo vệ thông tin tài khoản của mình
            bằng cách giữ kín mật khẩu và thoát khỏi tài khoản sau khi sử dụng.
          </Text>
        </Section>

        <Section title="5. Quyền của người dùng">
          <Text style={styles.sectionText}>Bạn có quyền:</Text>
          <Text style={styles.sectionText}>
            • Xem, chỉnh sửa, cập nhật thông tin cá nhân trong hồ sơ.
          </Text>
          <Text style={styles.sectionText}>
            • Yêu cầu xóa tài khoản hoặc dữ liệu cá nhân khỏi hệ thống (trừ các
            dữ liệu cần lưu giữ để tuân thủ pháp luật hoặc xử lý tranh chấp).
          </Text>
          <Text style={styles.sectionText}>
            • Quyết định mức độ công khai thông tin trên diễn đàn (ví dụ: ai có
            thể xem hồ sơ, bài viết, tin nhắn).
          </Text>
        </Section>

        <Section title="6. Cookie và công nghệ theo dõi">
          <Text style={styles.sectionText}>
            • Diễn đàn có thể sử dụng cookie để lưu thông tin đăng nhập, ghi nhớ
            tùy chọn và phân tích hành vi người dùng.
          </Text>
          <Text style={styles.sectionText}>
            • Bạn có thể tắt cookie trong trình duyệt, nhưng điều này có thể làm
            giảm trải nghiệm sử dụng.
          </Text>
        </Section>

        <Section title="7. Chính sách dành cho trẻ vị thành niên">
          <Text style={styles.sectionText}>
            • Diễn đàn hướng đến học sinh trung học phổ thông, vì vậy chúng tôi
            đặc biệt lưu ý đến quyền riêng tư của người dưới 18 tuổi.
          </Text>
          <Text style={styles.sectionText}>
            • Phụ huynh hoặc giáo viên có thể liên hệ để yêu cầu hỗ trợ quản lý
            tài khoản học sinh nếu cần.
          </Text>
        </Section>

        <Section title="8. Thay đổi chính sách">
          <Text style={styles.sectionText}>
            • Chính sách này có thể được cập nhật bất kỳ lúc nào nhằm phù hợp
            với sự thay đổi của pháp luật, công nghệ hoặc hoạt động của diễn đàn.
          </Text>
          <Text style={styles.sectionText}>
            • Mọi thay đổi quan trọng sẽ được thông báo trên trang chủ hoặc qua
            email trước khi áp dụng.
          </Text>
          <Text style={styles.sectionText}>
            • Khi tiếp tục sử dụng diễn đàn sau khi chính sách được cập nhật, bạn
            được coi là đã đồng ý với các điều khoản mới.
          </Text>
        </Section>

        <Section title="9. Liên hệ">
          <Text style={styles.sectionText}>
            Nếu có thắc mắc hoặc yêu cầu liên quan đến quyền riêng tư, vui lòng
            liên hệ:
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

