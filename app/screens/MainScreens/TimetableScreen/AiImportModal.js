import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import { tint, glowColors } from "../../../components/settings/SettingsUI";
import { apiErrorMessage } from "../../../utils/apiMessage";
import { aiImportTimetable } from "../../../services/api/Api";
import { readTimetableClass, writeTimetableClass, normalizeClassName, isValidClassName } from "../../../utils/timetable";

// "Nhập bằng AI": type / paste the timetable in any words, or pick a photo of
// it, and the API's model turns it into blocks. The result only fills the
// editor - the user checks it and saves as usual.
export default function AiImportModal({ visible, onClose, current, onResult }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null); // { uri }
  // Saved with the timetable settings, so it is asked once.
  const [className, setClassName] = useState(() => readTimetableClass());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (fromCamera) => {
    setError("");
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t("timetable.ai.permission"));
      return;
    }
    const options = { mediaTypes: ["images"], quality: 1 };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    // Always a JPEG (HEIC is not read by the model) and small enough to send
    // quickly while the text stays legible.
    const asset = result.assets[0];
    const resized = await ImageManipulator.manipulateAsync(
      asset.uri,
      asset.width > 2600 ? [{ resize: { width: 2600 } }] : [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    setPhoto({ uri: resized.uri });
  };

  const submit = async () => {
    if (busy || (!text.trim() && !photo)) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      if (text.trim()) form.append("text", text.trim());
      if (photo) form.append("image", { uri: photo.uri, name: "timetable.jpg", type: "image/jpeg" });
      if (current) form.append("current", JSON.stringify(current));
      if (className) form.append("class_name", className);
      const res = await aiImportTimetable(form);
      onResult(res.data.data, res.data.note || "");
      setText("");
      setPhoto(null);
    } catch (err) {
      // No JSON from our API (gateway timeout page, connection cut): the photo
      // read took too long. Show the status so a report can be traced.
      const status = err?.response?.status;
      const fromApi = typeof err?.response?.data?.message === "string";
      if (!fromApi && (status >= 500 || err?.code === "ECONNABORTED")) {
        setError(t("timetable.ai.tooSlow", { code: status || "timeout" }));
      } else {
        setError(apiErrorMessage(err, t("timetable.ai.failed")));
      }
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={close}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Top ambient green glow */}
        <LinearGradient
          colors={
            glowColors("#8B5CF6", isDarkMode)
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 160,
            zIndex: 0,
          }}
          pointerEvents="none"
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: Platform.OS === "android" ? insets.top + 8 : 12,
            paddingBottom: 8,
            zIndex: 1,
          }}
        >
          <TouchableOpacity
            onPress={close}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("timetable.close")}
            style={{ width: 44, height: 44, justifyContent: "center" }}
          >
            <Ionicons name="close" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600", color: theme.primary }} numberOfLines={1}>
            {t("timetable.ai.title")}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={{ fontSize: 14, lineHeight: 20, color: theme.subText, marginBottom: 16, marginHorizontal: 4 }}>
            {t("timetable.ai.intro")}
          </Text>

          <View
            style={{
              backgroundColor: theme.surface,
              borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: 20,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{t("timetable.ai.classLabel")}</Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: theme.subText, marginBottom: 8 }}>{t("timetable.ai.classHint")}</Text>
            <TextInput
              value={className}
              onChangeText={(v) => {
                const next = normalizeClassName(v);
                setClassName(next);
                writeTimetableClass(next);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              placeholder={t("timetable.ai.classPlaceholder")}
              placeholderTextColor={theme.subText}
              style={{
                height: 46,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: className && !isValidClassName(className) ? "#FF3B30" : theme.border,
                borderRadius: 14,
                paddingHorizontal: 12,
                fontSize: 16,
                color: theme.text,
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)",
                marginBottom: className && !isValidClassName(className) ? 4 : 16,
              }}
            />
            {className && !isValidClassName(className) ? (
              <Text style={{ color: "#FF3B30", fontSize: 13, marginBottom: 16 }}>{t("timetable.ai.classInvalid")}</Text>
            ) : null}

            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginBottom: 8 }}>{t("timetable.ai.textLabel")}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={4000}
              placeholder={t("timetable.ai.placeholder")}
              placeholderTextColor={theme.subText}
              textAlignVertical="top"
              style={{
                minHeight: 160,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.border,
                borderRadius: 14,
                padding: 12,
                fontSize: 15,
                color: theme.text,
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)",
              }}
            />

            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 16, marginBottom: 8 }}>
              {t("timetable.ai.photoLabel")}
            </Text>
            {photo ? (
              <View style={{ alignSelf: "flex-start" }}>
                <Image source={{ uri: photo.uri }} style={{ width: 104, height: 104, borderRadius: 14 }} />
                <TouchableOpacity
                  onPress={() => setPhoto(null)}
                  accessibilityLabel={t("timetable.ai.removePhoto")}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  [true, "camera-outline", t("timetable.ai.takePhoto")],
                  [false, "image-outline", t("timetable.ai.choosePhoto")],
                ].map(([camera, icon, label]) => (
                  <TouchableOpacity
                    key={icon}
                    onPress={() => pick(camera)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.border,
                      backgroundColor: tint("#22C55E", isDarkMode),
                    }}
                  >
                    <Ionicons name={icon} size={22} color={theme.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text, marginTop: 4 }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {error ? <Text style={{ color: "#FF3B30", fontSize: 14, lineHeight: 20, marginTop: 12 }}>{error}</Text> : null}

            <TouchableOpacity
              onPress={submit}
              activeOpacity={0.85}
              disabled={busy || (!text.trim() && !photo)}
              accessibilityRole="button"
              style={{
                marginTop: 18,
                backgroundColor: theme.primary,
                borderRadius: 999,
                padding: 15,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: busy || (!text.trim() && !photo) ? 0.6 : 1,
              }}
            >
              {busy ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>{t("timetable.ai.reading")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>{t("timetable.ai.submit")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: theme.subText, marginHorizontal: 4, lineHeight: 18 }}>{t("timetable.ai.hint")}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
