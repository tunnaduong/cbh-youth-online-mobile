import React, { useContext, useRef, useState } from "react";
import BannerWatermark from "../../../components/BannerWatermark";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Application from "expo-application";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import FastImage from "../../../components/FastImage";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { ACCENT, tint } from "../../../components/settings/SettingsUI";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import { submitFeedback, uploadFile } from "../../../services/api/Api";
import { getRunningUpdateInfo } from "../../../services/ota/otaService";

const API_HOST = "https://api.chuyenbienhoa.com";
const MAX_IMAGES = 4;
const MIN_LENGTH = 10;

const TYPES = [
  { value: "bug", icon: "bug-outline", color: "#EF4444", labelKey: "feedback.typeBug", descKey: "feedback.typeBugDesc", placeholderKey: "feedback.placeholderBug" },
  { value: "suggestion", icon: "bulb-outline", color: "#F59E0B", labelKey: "feedback.typeSuggestion", descKey: "feedback.typeSuggestionDesc", placeholderKey: "feedback.placeholderSuggestion" },
  { value: "other", icon: "chatbubble-ellipses-outline", color: "#3B82F6", labelKey: "feedback.typeOther", descKey: "feedback.typeOtherDesc", placeholderKey: "feedback.placeholderOther" },
];

function getOtaVersionString() {
  try {
    const info = getRunningUpdateInfo();
    if (info.isOtaActive && info.activeBuildNumber) {
      return `Build ${info.activeBuildNumber} (${info.activeChannel || "ota"})`;
    }
    return "embedded";
  } catch {
    return "embedded";
  }
}

// Attached to every report so a bug can be traced to a device/build without
// asking the reporter follow-up questions.
function deviceInfo(otaVersion) {
  const c = Platform.constants || {};
  const model = Platform.OS === "android" ? [c.Brand, c.Model].filter(Boolean).join(" ") : c.systemName || "iOS";
  return `${model} | ${Platform.OS} ${Platform.Version} | build ${Application.nativeBuildVersion ?? "?"} | ota ${otaVersion || "none"}`.slice(0, 255);
}

// Where in the app the report was started from. Kept as a pseudo-URL so the
// admin page can tell the screen (shake reports) apart from the entry point
// (sidebar / long-press), e.g. "app://PostScreen?via=shake".
function pageUrl(source, screenName) {
  if (!source && !screenName) return undefined;
  const base = `app://${screenName || ""}`;
  return source ? `${base}?via=${source}` : base;
}

// The upload endpoint builds its URL from APP_URL (the main site), but the
// files live on the API host - keep only the /storage/... part.
function toApiStorageUrl(path) {
  const storagePath = String(path).replace(/^https?:\/\/[^/]+/, "");
  return `${API_HOST}${storagePath.startsWith("/") ? "" : "/"}${storagePath}`;
}

export default function FeedbackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  // Presented as a modal: on iOS the sheet already sits below the status bar.
  const topInset = Platform.OS === "android" ? insets.top : 0;
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");

  // Shake-to-report hands over a screenshot of the screen the user was on
  // (see components/ShakeToReport.js) - it's pre-attached like a picked image
  // and can be removed the same way.
  const shakeScreenshot = route?.params?.source === "shake" ? route?.params?.screenshotUri : null;
  const screenName = route?.params?.screenName || null;

  const [type, setType] = useState(route?.params?.type || "bug");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [images, setImages] = useState(() => (shakeScreenshot ? [shakeScreenshot] : [])); // local URIs
  const [submitting, setSubmitting] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(-1);

  const inputBg = isDarkMode ? "#2A2A2A" : "#F3F4F6";
  const activeType = TYPES.find((x) => x.value === type) || TYPES[0];

  const close = () => {
    const onlyAutoScreenshot = images.length === 1 && images[0] === shakeScreenshot;
    if (!content.trim() && (images.length === 0 || onlyAutoScreenshot)) {
      navigation.goBack();
      return;
    }
    Alert.alert(t("feedback.discardTitle"), t("feedback.discardMessage"), [
      { text: t("feedback.keepEditing"), style: "cancel" },
      { text: t("feedback.discard"), style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 0.7,
      });
      if (!result.canceled) {
        setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
      }
    } catch (e) {
      Toast.show({ type: "error", text1: t("feedback.uploadError") });
    }
  };

  const uploadImage = async (uri) => {
    const ext = (uri.split(".").pop() || "jpg").toLowerCase();
    const formData = new FormData();
    formData.append("uid", userInfo.id);
    formData.append("file", {
      uri,
      name: `feedback.${ext}`,
      type: ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg",
    });
    const res = await uploadFile(formData);
    return toApiStorageUrl(res.data.path);
  };

  const handleSubmit = async () => {
    if (content.trim().length < MIN_LENGTH) {
      Toast.show({ type: "error", text1: t("feedback.tooShort", { min: MIN_LENGTH }) });
      return;
    }

    setSubmitting(true);
    try {
      const imageUrls = [];
      for (let i = 0; i < images.length; i++) {
        setUploadingIndex(i);
        try {
          imageUrls.push(await uploadImage(images[i]));
        } catch (e) {
          throw new Error(t("feedback.uploadError"));
        }
      }
      setUploadingIndex(-1);

      const otaVersion = getOtaVersionString();
      await submitFeedback({
        type,
        content: content.trim(),
        image_urls: imageUrls,
        contact_email: email.trim() || undefined,
        platform: Platform.OS === "ios" ? "ios" : "android",
        app_version: Application.nativeApplicationVersion || undefined,
        ota_version: otaVersion,
        device_info: deviceInfo(otaVersion),
        // Admin sees this as "where it happened": app://<screen>?via=<source>
        page_url: pageUrl(route?.params?.source, screenName),
      });

      Toast.show({ type: "success", text1: t("feedback.success"), text2: t("feedback.successDesc") });
      navigation.goBack();
    } catch (err) {
      const errors = err?.response?.data?.errors;
      const first = errors && Object.values(errors)[0]?.[0];
      Toast.show({
        type: "error",
        text1:
          first ||
          (err?.response?.status === 429
            ? t("feedback.rateLimited")
            : err?.response?.data?.message || err?.message || t("feedback.error")),
      });
    } finally {
      setSubmitting(false);
      setUploadingIndex(-1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header: glass buttons appear once content scrolls under it */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.header, { paddingTop: topInset, height: 64 + topInset }]}>
          <LiquidButton size={44} scrollY={scrollY} providerId="FeedbackScreen" onPress={close} disabled={submitting}>
            <Ionicons name="close" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t("feedback.title")}
          </Animated.Text>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            providerId="FeedbackScreen"
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.headerActionButton}
          >
            {submitting ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={[styles.headerAction, { color: theme.primary }]}>{t("feedback.submit")}</Text>
            )}
          </LiquidButton>
        </View>
      </View>

      <AndroidGlassBackdrop providerId="FeedbackScreen" style={{ flex: 1 }}>
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
          pointerEvents="none"
        />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.ScrollView
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          contentContainerStyle={{ padding: 16, paddingTop: 64 + topInset, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
          >
            <BannerWatermark icon="chatbubbles" color="#22C55E" size={130} />
            <View style={{ flex: 1, zIndex: 1 }}>
              <Text style={[styles.heroTitle, { color: isDarkMode ? "#F3F4F6" : "#0F2E1E" }]}>{t("feedback.title")}</Text>
              <Text style={[styles.heroSubtitle, { color: isDarkMode ? "#9CA3AF" : "#4B6B58" }]}>{t("feedback.subtitle")}</Text>
            </View>
            <View style={[styles.heroIcon, { backgroundColor: tint("#EF4444", isDarkMode) }]}>
              <Ionicons name="bug" size={26} color="#EF4444" />
            </View>
          </LinearGradient>

          {shakeScreenshot && images.includes(shakeScreenshot) && (
            <View style={[styles.shakeBanner, { backgroundColor: tint(ACCENT.profile, isDarkMode), borderColor: "transparent" }]}>
              <Ionicons name="camera-outline" size={18} color={ACCENT.profile} />
              <Text style={[styles.shakeBannerText, { color: theme.text }]}>
                {screenName ? t("feedback.shakeAttachedWithScreen", { screen: screenName }) : t("feedback.shakeAttached")}
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: theme.text }]}>{t("feedback.typeLabel")}</Text>
          {TYPES.map((item) => {
            const active = item.value === type;
            return (
              <TouchableOpacity
                key={item.value}
                activeOpacity={0.7}
                onPress={() => setType(item.value)}
                style={[
                  styles.typeCard,
                  {
                    borderColor: active ? item.color : isDarkMode ? "#282B34" : "#E2E8F0",
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                    backgroundColor: active ? tint(item.color, isDarkMode) : theme.surface,
                  },
                ]}
              >
                <View style={[styles.typeIcon, { backgroundColor: tint(item.color, isDarkMode) }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.typeTitle, { color: theme.text }]}>{t(item.labelKey)}</Text>
                  <Text style={[styles.typeDesc, { color: theme.subText }]}>{t(item.descKey)}</Text>
                </View>
                <Ionicons
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={active ? item.color : theme.subText}
                />
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.label, { color: theme.text }]}>{t("feedback.contentLabel")}</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={t(activeType.placeholderKey)}
            placeholderTextColor={theme.subText}
            multiline
            maxLength={5000}
            textAlignVertical="top"
            style={[styles.textArea, { backgroundColor: inputBg, color: theme.text }]}
          />
          <Text style={[styles.counter, { color: theme.subText }]}>{content.length}/5000</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 8 }}>
            <Text style={[styles.label, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>
              {t("feedback.imagesLabel", "Ảnh chụp màn hình (tùy chọn, tối đa {{max}})", { max: MAX_IMAGES })}
            </Text>
            {submitting && images.length > 0 && uploadingIndex >= 0 && (
              <Text style={{ fontSize: 12, lineHeight: 16, color: theme.primary, fontWeight: "500" }}>
                {t("feedback.uploadingImageProgress", "Đang tải ảnh ({{current}}/{{total}})...", {
                  current: uploadingIndex + 1,
                  total: images.length,
                })}
              </Text>
            )}
          </View>
          <View style={styles.imageRow}>
            {images.map((uri, idx) => (
              <View key={uri} style={styles.imageWrap}>
                <FastImage source={{ uri }} style={styles.image} />
                {submitting && (
                  <View style={styles.imageLoadingOverlay}>
                    {uploadingIndex === idx ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : uploadingIndex > idx ? (
                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    ) : (
                      <View style={styles.pendingDot} />
                    )}
                  </View>
                )}
                {!submitting && (
                  <TouchableOpacity
                    style={styles.removeImage}
                    onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {!submitting && images.length < MAX_IMAGES && (
              <TouchableOpacity
                onPress={pickImages}
                style={[styles.addImage, { borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={22} color={theme.subText} />
                <Text style={{ color: theme.subText, fontSize: 11, marginTop: 4 }}>{t("feedback.addImage")}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.label, { color: theme.text }]}>{t("feedback.emailLabel")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("feedback.emailPlaceholder")}
            placeholderTextColor={theme.subText}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={255}
            style={[styles.input, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Text style={[styles.note, { color: theme.subText }]}>{t("feedback.deviceNote")}</Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
            style={[styles.submit, { backgroundColor: theme.primary, opacity: submitting ? 0.6 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t("feedback.submit")}</Text>
            )}
          </TouchableOpacity>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600", marginHorizontal: 12 },
  headerActionButton: { width: "auto", minWidth: 64, paddingHorizontal: 14 },
  headerAction: { fontSize: 15, fontWeight: "700" },
  subtitle: { fontSize: 14, marginBottom: 8 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    overflow: "hidden",
  },
  heroCircle: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(34,197,94,0.10)",
    top: -45,
    right: 50,
  },
  heroTitle: { fontSize: 19, fontWeight: "800", marginBottom: 4 },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  heroIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginLeft: 12, zIndex: 1 },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  shakeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  shakeBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  typeTitle: { fontSize: 15, fontWeight: "600" },
  typeDesc: { fontSize: 12, marginTop: 2 },
  textArea: { minHeight: 140, borderRadius: 16, padding: 14, fontSize: 15 },
  counter: { fontSize: 11, textAlign: "right", marginTop: 4 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageWrap: { width: 76, height: 76, borderRadius: 14, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  removeImage: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 2,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  addImage: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 13 : 9, fontSize: 15 },
  note: { fontSize: 12, marginTop: 12 },
  submit: { marginTop: 20, borderRadius: 999, paddingVertical: 15, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
