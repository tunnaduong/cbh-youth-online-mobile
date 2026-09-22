import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  getStudentVerificationStatus,
  submitStudentVerification,
  uploadStudentVerificationPhoto,
} from "../../../services/api/Api";

// Mirrors the web's Settings > "Xác minh học sinh CBH" tab
// (SettingsClient.js), including the same four states: verified, pending,
// rejected (resubmittable) and not-yet-submitted.
const DISCOUNT_LABEL = "10%";

const StatusBanner = ({ icon, iconColor, tint, border, title, children, theme }) => (
  <View style={[styles.banner, { backgroundColor: tint, borderColor: border }]}>
    <Ionicons name={icon} size={22} color={iconColor} style={{ marginTop: 1 }} />
    <View style={{ flex: 1 }}>
      <Text style={[styles.bannerTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  </View>
);

const PhotoPicker = ({ label, hint, uri, onPick, icon, theme }) => (
  <View style={{ flex: 1 }}>
    <Text style={[styles.inputLabel, { color: theme.text }]}>
      {label} <Text style={{ color: "#ef4444" }}>*</Text>
    </Text>
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPick}
      style={[styles.dropzone, { borderColor: uri ? theme.primary : theme.border }]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 14 }}>
          <Ionicons name={icon} size={30} color={theme.subText} />
          <Text style={[styles.dropzoneText, { color: theme.subText }]}>Chạm để chọn ảnh</Text>
          <Text style={[styles.dropzoneHint, { color: theme.subText }]}>{hint}</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
);

export default function StudentVerificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { userInfo } = useContext(AuthContext);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [cardUri, setCardUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const fetchStatus = async () => {
    try {
      const response = await getStudentVerificationStatus();
      setStatus(response.data);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: "Không thể tải trạng thái xác minh.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const pickImage = async (setUri) => {
    const { status: permission } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission !== "granted") {
      Alert.alert(t("common.error"), "Vui lòng cho phép truy cập thư viện ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!selfieUri || !cardUri) {
      Toast.show({ type: "error", text1: "Vui lòng chọn cả ảnh selfie và thẻ học sinh." });
      return;
    }

    setSubmitting(true);
    try {
      const [selfieUrl, cardUrl] = await Promise.all([
        uploadStudentVerificationPhoto(selfieUri, userInfo?.id),
        uploadStudentVerificationPhoto(cardUri, userInfo?.id),
      ]);

      if (!selfieUrl || !cardUrl) {
        throw new Error("Tải ảnh lên thất bại. Vui lòng thử lại.");
      }

      await submitStudentVerification({ selfie_url: selfieUrl, student_card_url: cardUrl });

      Toast.show({
        type: "success",
        text1: "Gửi yêu cầu xác minh thành công!",
        text2: "Admin sẽ xét duyệt trong vòng 24 giờ.",
      });

      setSelfieUri(null);
      setCardUri(null);
      await fetchStatus();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Gửi yêu cầu thất bại. Vui lòng thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const verification = status?.verification;
  const canSubmit = selfieUri && cardUri && !submitting;

  const renderBody = () => {
    if (loading) {
      return (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    if (status?.is_verified) {
      return (
        <StatusBanner
          icon="checkmark-circle"
          iconColor="#22c55e"
          tint={isDarkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4"}
          border={isDarkMode ? "rgba(34,197,94,0.3)" : "#bbf7d0"}
          title="Tài khoản đã được xác minh học sinh"
          theme={theme}
        >
          <Text style={[styles.bannerBody, { color: theme.subText }]}>
            Bạn đang được hưởng giảm giá {DISCOUNT_LABEL} tại Gift Shop.
            {status.verified_at
              ? `\nXác minh từ: ${new Date(status.verified_at).toLocaleDateString("vi-VN")}`
              : ""}
          </Text>
        </StatusBanner>
      );
    }

    if (verification?.status === "pending") {
      return (
        <StatusBanner
          icon="time"
          iconColor="#eab308"
          tint={isDarkMode ? "rgba(234,179,8,0.12)" : "#fefce8"}
          border={isDarkMode ? "rgba(234,179,8,0.3)" : "#fef08a"}
          title="Đang chờ xét duyệt"
          theme={theme}
        >
          <Text style={[styles.bannerBody, { color: theme.subText }]}>
            Yêu cầu của bạn đã được gửi và đang được xem xét. Vui lòng đợi admin duyệt trong 24 giờ.
          </Text>
        </StatusBanner>
      );
    }

    return (
      <View style={{ gap: 20 }}>
        {verification?.status === "rejected" && (
          <StatusBanner
            icon="close-circle"
            iconColor="#ef4444"
            tint={isDarkMode ? "rgba(239,68,68,0.12)" : "#fef2f2"}
            border={isDarkMode ? "rgba(239,68,68,0.3)" : "#fecaca"}
            title="Yêu cầu đã bị từ chối"
            theme={theme}
          >
            {verification.rejection_reason ? (
              <Text style={[styles.bannerBody, { color: theme.subText }]}>
                Lý do: {verification.rejection_reason}
              </Text>
            ) : null}
            <Text style={[styles.bannerBody, { color: theme.subText }]}>
              Bạn có thể gửi lại yêu cầu bên dưới.
            </Text>
          </StatusBanner>
        )}

        <View style={{ flexDirection: "row", gap: 12 }}>
          <PhotoPicker
            label="Ảnh selfie cầm thẻ"
            hint="Chụp rõ mặt và thẻ học sinh"
            icon="school-outline"
            uri={selfieUri}
            onPick={() => pickImage(setSelfieUri)}
            theme={theme}
          />
          <PhotoPicker
            label="Ảnh thẻ học sinh"
            hint="Chụp rõ thông tin trên thẻ"
            icon="card-outline"
            uri={cardUri}
            onPick={() => pickImage(setCardUri)}
            theme={theme}
          />
        </View>

        <View
          style={[
            styles.noteBox,
            {
              backgroundColor: isDarkMode ? "rgba(59,130,246,0.12)" : "#eff6ff",
              borderColor: isDarkMode ? "rgba(59,130,246,0.3)" : "#bfdbfe",
            },
          ]}
        >
          <Text style={[styles.noteTitle, { color: theme.text }]}>Lưu ý khi chụp ảnh:</Text>
          {[
            "Ảnh selfie: Chụp rõ mặt cùng thẻ học sinh Chuyên Biên Hòa",
            "Thẻ học sinh: Chụp rõ tên, lớp, năm học trên thẻ",
            "Ảnh phải rõ nét, không bị mờ hay che khuất",
          ].map((line) => (
            <Text key={line} style={[styles.noteLine, { color: theme.subText }]}>
              {"•"} {line}
            </Text>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[
            styles.submitButton,
            { backgroundColor: canSubmit ? theme.primary : theme.border },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Gửi yêu cầu xác minh</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View
          style={{
            paddingTop: insets.top,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 64 + insets.top,
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton
              size={44}
              scrollY={scrollY}
              providerId="StudentVerificationScreen"
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[
              styles.headerTitle,
              { color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity },
            ]}
            numberOfLines={1}
          >
            Xác minh học sinh
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="StudentVerificationScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          contentContainerStyle={{
            paddingTop: 64 + insets.top,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
          }}
        >
          <Text style={[styles.title, { color: theme.text }]}>Xác minh học sinh CBH</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            Xác minh tài khoản học sinh để nhận giảm giá {DISCOUNT_LABEL} tại Gift Shop. Admin sẽ xét
            duyệt trong vòng 24 giờ.
          </Text>

          {renderBody()}
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  banner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  bannerBody: { fontSize: 13, lineHeight: 19 },
  inputLabel: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  preview: { width: "100%", height: 104, borderRadius: 10 },
  dropzoneText: { fontSize: 13, marginTop: 8 },
  dropzoneHint: { fontSize: 11, marginTop: 2, textAlign: "center" },
  noteBox: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  noteTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  noteLine: { fontSize: 13, lineHeight: 20 },
  submitButton: {
    height: 52,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
