import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Application from "expo-application";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import FastImage from "../../../components/FastImage";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import { submitFeedback, uploadFile } from "../../../services/api/Api";

const API_HOST = "https://api.chuyenbienhoa.com";
const MAX_IMAGES = 4;
const MIN_LENGTH = 10;

const TYPES = [
  { value: "bug", icon: "bug-outline", labelKey: "feedback.typeBug", descKey: "feedback.typeBugDesc", placeholderKey: "feedback.placeholderBug" },
  { value: "suggestion", icon: "bulb-outline", labelKey: "feedback.typeSuggestion", descKey: "feedback.typeSuggestionDesc", placeholderKey: "feedback.placeholderSuggestion" },
  { value: "other", icon: "chatbubble-ellipses-outline", labelKey: "feedback.typeOther", descKey: "feedback.typeOtherDesc", placeholderKey: "feedback.placeholderOther" },
];

// Attached to every report so a bug can be traced to a device/build without
// asking the reporter follow-up questions.
function deviceInfo() {
  const c = Platform.constants || {};
  const model = Platform.OS === "android" ? [c.Brand, c.Model].filter(Boolean).join(" ") : c.systemName || "iOS";
  return `${model} | ${Platform.OS} ${Platform.Version} | build ${Application.nativeBuildVersion ?? "?"}`.slice(0, 255);
}

// The upload endpoint builds its URL from APP_URL (the main site), but the
// files live on the API host - keep only the /storage/... part.
function toApiStorageUrl(path) {
  const storagePath = String(path).replace(/^https?:\/\/[^/]+/, "");
  return `${API_HOST}${storagePath.startsWith("/") ? "" : "/"}${storagePath}`;
}

export default function FeedbackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");

  const [type, setType] = useState(route?.params?.type || "bug");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [images, setImages] = useState([]); // local URIs
  const [submitting, setSubmitting] = useState(false);

  const inputBg = isDarkMode ? "#2A2A2A" : "#F3F4F6";
  const activeType = TYPES.find((x) => x.value === type) || TYPES[0];

  const close = () => {
    if (!content.trim() && images.length === 0) {
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
      for (const uri of images) {
        try {
          imageUrls.push(await uploadImage(uri));
        } catch (e) {
          throw new Error(t("feedback.uploadError"));
        }
      }

      await submitFeedback({
        type,
        content: content.trim(),
        image_urls: imageUrls,
        contact_email: email.trim() || undefined,
        platform: Platform.OS === "ios" ? "ios" : "android",
        app_version: Application.nativeApplicationVersion || undefined,
        device_info: deviceInfo(),
        page_url: route?.params?.source || undefined,
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
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "android" ? insets.top + 8 : 14, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={close} hitSlop={10} disabled={submitting}>
          <Ionicons name="close" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {t("feedback.title")}
        </Text>
        <TouchableOpacity onPress={handleSubmit} disabled={submitting} hitSlop={10}>
          {submitting ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={[styles.headerAction, { color: theme.primary }]}>{t("feedback.submit")}</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: theme.subText }]}>{t("feedback.subtitle")}</Text>

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
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? (isDarkMode ? "#1f3320" : "#EEF7ED") : theme.surface,
                  },
                ]}
              >
                <Ionicons name={item.icon} size={22} color={active ? theme.primary : theme.subText} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.typeTitle, { color: theme.text }]}>{t(item.labelKey)}</Text>
                  <Text style={[styles.typeDesc, { color: theme.subText }]}>{t(item.descKey)}</Text>
                </View>
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={active ? theme.primary : theme.subText}
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

          <Text style={[styles.label, { color: theme.text }]}>{t("feedback.imagesLabel", { max: MAX_IMAGES })}</Text>
          <View style={styles.imageRow}>
            {images.map((uri, idx) => (
              <View key={uri} style={styles.imageWrap}>
                <FastImage source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", marginHorizontal: 12 },
  headerAction: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 14, marginBottom: 8 },
  label: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  typeTitle: { fontSize: 15, fontWeight: "600" },
  typeDesc: { fontSize: 12, marginTop: 2 },
  textArea: { minHeight: 140, borderRadius: 12, padding: 12, fontSize: 15 },
  counter: { fontSize: 11, textAlign: "right", marginTop: 4 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageWrap: { width: 76, height: 76, borderRadius: 10, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  removeImage: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 2,
  },
  addImage: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8, fontSize: 15 },
  note: { fontSize: 12, marginTop: 12 },
  submit: { marginTop: 20, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
