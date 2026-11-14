import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useAuthContext } from "../../../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import {
  createStudyMaterial,
  getStudyMaterialCategories,
  uploadFile,
} from "../../../../services/api/Api";

// Study materials can be up to 100MB - the default upload timeout isn't
// enough headroom for a file that size on a normal mobile connection.
import BannerWatermark from "../../../../components/BannerWatermark";
import { tint } from "../../../../components/settings/SettingsUI";

const MATERIAL_UPLOAD_TIMEOUT = 300000;

const CATEGORY_DOTS = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B", "#F43F5E", "#14B8A6"];
const dotFor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_DOTS[h % CATEGORY_DOTS.length];
};

// Field label with a tinted round icon, as on the other revamped forms.
const FieldLabel = ({ icon, color, text, theme, isDarkMode }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tint(color, isDarkMode), alignItems: "center", justifyContent: "center", marginRight: 8 }}>
      <Ionicons name={icon} size={15} color={color} />
    </View>
    <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, flex: 1 }}>{text}</Text>
  </View>
);

const UploadStudyMaterialScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { userInfo } = useAuthContext();
  const { t, i18n } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("0");
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const getCategoryLabel = (category) => {
    const rawName = (category?.name || "").toString().trim();
    const slug = (category?.slug || "").toString().trim();

    const normalize = (value) =>
      value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const candidates = [slug, rawName]
      .map((value) => normalize(value))
      .filter(Boolean);

    const directKey = candidates.find((candidate) => {
      const translated = t(`studyMaterial.categoriesList.${candidate}`, { defaultValue: "" });
      return Boolean(translated);
    });

    if (directKey) {
      return t(`studyMaterial.categoriesList.${directKey}`);
    }

    const aliasMap = {
      math: t("studyMaterial.categoriesList.mathematics"),
      "địa-lý": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "địa-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "dia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      geography: t("studyMaterial.categoriesList.geography"),
      maths: t("studyMaterial.categoriesList.mathematics"),
      mathematics: t("studyMaterial.categoriesList.mathematics"),
      toan: t("studyMaterial.categoriesList.mathematics"),
      "toan-hoc": t("studyMaterial.categoriesList.mathematics"),
      science: t("studyMaterial.categoriesList.science"),
      "khoa-hoc": t("studyMaterial.categoriesList.science"),
      literature: t("studyMaterial.categoriesList.literature"),
      "van-hoc": t("studyMaterial.categoriesList.literature"),
      "ngu-van": t("studyMaterial.categoriesList.literature"),
      "ngữ-văn": t("studyMaterial.categoriesList.literature"),
      history: t("studyMaterial.categoriesList.history"),
      "lich-su": t("studyMaterial.categoriesList.history"),
      english: t("studyMaterial.categoriesList.english"),
      "tieng-anh": t("studyMaterial.categoriesList.english"),
      "tieng-nga": t("studyMaterial.categoriesList.foreign-language"),
      "tiếng-nga": t("studyMaterial.categoriesList.foreign-language"),
      russian: t("studyMaterial.categoriesList.foreign-language"),
      geography: t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      "dia-ly-1": t("studyMaterial.categoriesList.geography"),
      "đia-ly-1": t("studyMaterial.categoriesList.geography"),
      "dia-ly-2": t("studyMaterial.categoriesList.geography"),
      "đia-ly-2": t("studyMaterial.categoriesList.geography"),
      "dia-ly-3": t("studyMaterial.categoriesList.geography"),
      "đia-ly-3": t("studyMaterial.categoriesList.geography"),
      "dia-ly-4": t("studyMaterial.categoriesList.geography"),
      "đia-ly-4": t("studyMaterial.categoriesList.geography"),
      "diai-ly": t("studyMaterial.categoriesList.geography"),
      "đia-lyh": t("studyMaterial.categoriesList.geography"),
      "dia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "đia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "geography-1": t("studyMaterial.categoriesList.geography"),
      "địa-lý": t("studyMaterial.categoriesList.geography"),
      "địa lý": t("studyMaterial.categoriesList.geography"),
      "dia ly": t("studyMaterial.categoriesList.geography"),
      "đia lý": t("studyMaterial.categoriesList.geography"),
      exam: t("studyMaterial.categoriesList.exam"),
      "on-thi": t("studyMaterial.categoriesList.exam"),
      general: t("studyMaterial.categoriesList.general"),
      other: t("studyMaterial.categoriesList.other"),
      khac: t("studyMaterial.categoriesList.other"),
      khác: t("studyMaterial.categoriesList.other"),
      technology: t("studyMaterial.categoriesList.technology"),
      "cong-nghe": t("studyMaterial.categoriesList.technology"),
      physics: t("studyMaterial.categoriesList.physics"),
      "vat-ly": t("studyMaterial.categoriesList.physics"),
      chemistry: t("studyMaterial.categoriesList.chemistry"),
      "hoa-hoc": t("studyMaterial.categoriesList.chemistry"),
      biology: t("studyMaterial.categoriesList.biology"),
      "sinh-hoc": t("studyMaterial.categoriesList.biology"),
      geography: t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "computer-science": t("studyMaterial.categoriesList.computer-science"),
      "tin-hoc": t("studyMaterial.categoriesList.computer-science"),
      "social-science": t("studyMaterial.categoriesList.social-science"),
      "khoa-hoc-xa-hoi": t("studyMaterial.categoriesList.social-science"),
      "foreign-language": t("studyMaterial.categoriesList.foreign-language"),
      "ngoai-ngu": t("studyMaterial.categoriesList.foreign-language"),
      economics: t("studyMaterial.categoriesList.economics"),
      "kinh-te": t("studyMaterial.categoriesList.economics"),
      business: t("studyMaterial.categoriesList.business"),
      "kinh-doanh": t("studyMaterial.categoriesList.business"),
      law: t("studyMaterial.categoriesList.law"),
      "luat": t("studyMaterial.categoriesList.law"),
      medicine: t("studyMaterial.categoriesList.medicine"),
      "y-hoc": t("studyMaterial.categoriesList.medicine"),
      engineering: t("studyMaterial.categoriesList.engineering"),
      "ky-thuat": t("studyMaterial.categoriesList.engineering"),
      art: t("studyMaterial.categoriesList.art"),
      "my-thuat": t("studyMaterial.categoriesList.art"),
    };

    const normalizedName = candidates[0] || "";
    return aliasMap[normalizedName] || rawName || t("studyMaterial.categoriesList.default");
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await getStudyMaterialCategories();
      setCategories(response?.data || []);
    } catch (error) {
      console.warn("Failed to load study material categories", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB, must match backend FileUploadController max:102400
      if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
        Toast.show({
          type: "error",
          text1: t("studyMaterial.fileTooLarge"),
          text2: t("studyMaterial.fileTooLargeDetail"),
        });
        return;
      }

      setSelectedDocument(asset);
      Toast.show({
        type: "success",
        text1: t("studyMaterial.fileSelected"),
        text2: asset.name || t("studyMaterial.readyToPublish"),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("studyMaterial.fileSelectError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
      });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Toast.show({ type: "error", text1: t("studyMaterial.titleRequired") });
      return;
    }

    if (!selectedDocument) {
      Toast.show({ type: "error", text1: t("studyMaterial.fileRequired") });
      return;
    }

    if (!isFree && (!price || Number(price) < 1)) {
      Toast.show({ type: "error", text1: t("studyMaterial.priceRequired") });
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("uid", userInfo?.id || userInfo?.user_id || 0);
      formData.append("file", {
        uri: selectedDocument.uri,
        name: selectedDocument.name || "study-material.pdf",
        type: selectedDocument.mimeType || "application/octet-stream",
      });

      const uploadResponse = await uploadFile(formData, {
        timeout: MATERIAL_UPLOAD_TIMEOUT,
      });
      const fileId = uploadResponse?.data?.id;

      if (!fileId) {
        throw new Error(t("studyMaterial.uploadIdMissing"));
      }

      await createStudyMaterial({
        title: title.trim(),
        description: description.trim() || null,
        category_id: selectedCategoryId || null,
        file_id: fileId,
        price: isFree ? 0 : Number(price || 0),
        is_free: isFree,
        preview_content: previewContent.trim() || null,
        status: "published",
      });

      Toast.show({
        type: "success",
        text1: t("studyMaterial.publishSuccess"),
        text2: t("studyMaterial.publishSuccessHint"),
      });
      navigation.goBack();
    } catch (error) {
      const isFileTooLarge = error?.response?.status === 422 && error?.response?.data?.errors?.file;
      Toast.show({
        type: "error",
        text1: isFileTooLarge ? t("studyMaterial.fileTooLarge") : t("studyMaterial.publishError"),
        text2: isFileTooLarge
          ? t("studyMaterial.fileTooLargeDetail")
          : error?.response?.data?.message || error?.message || t("studyMaterial.tryAgain"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6, height: insets.top + 64 }]} pointerEvents="box-none">
        <LiquidButton providerId="UploadStudyMaterialScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[
            styles.headerTitle,
            {
              color: theme.primary,
              opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }),
            },
          ]}
        >
          {t("studyMaterial.uploadTitle")}
        </Animated.Text>
        <View style={styles.headerSpacer} />
      </View>

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

      <AndroidGlassBackdrop providerId="UploadStudyMaterialScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
        >
          <BannerWatermark icon="cloud-upload" size={130} />
          <View style={[styles.heroIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
            <Ionicons name="documents" size={24} color={theme.primary} />
          </View>
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{t("studyMaterial.uploadHeroTitle")}</Text>
            <Text style={[styles.heroText, { color: theme.subText }]}>{t("studyMaterial.uploadHeroText")}</Text>
          </View>
        </LinearGradient>

        <View style={styles.formGroup}>
          <FieldLabel icon="text" color="#3B82F6" text={t("studyMaterial.titleLabel")} theme={theme} isDarkMode={isDarkMode} />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("studyMaterial.titlePlaceholder")}
            placeholderTextColor={theme.placeholder}
            style={[styles.input, { color: theme.text, borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.surface }]}
          />
        </View>

        <View style={styles.formGroup}>
          <FieldLabel icon="reorder-three" color="#8B5CF6" text={t("studyMaterial.descriptionLabel")} theme={theme} isDarkMode={isDarkMode} />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("studyMaterial.descriptionPlaceholder")}
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.text, borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.surface }]}
          />
        </View>

        <View style={styles.formGroup}>
          <FieldLabel icon="pricetags" color="#F59E0B" text={t("studyMaterial.categories")} theme={theme} isDarkMode={isDarkMode} />
          {loadingCategories ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.chipRow}>
              {categories.map((category) => {
                const active = selectedCategoryId === category.id;
                const dot = dotFor(category?.name || category?.slug || "");
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.categoryChip,
                      active
                        ? { backgroundColor: tint(dot, isDarkMode), borderColor: dot }
                        : { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" },
                    ]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: dot }]} />
                    <Text numberOfLines={1} style={[styles.categoryChipText, { color: theme.text }]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <FieldLabel icon="attach" color="#10B981" text={t("studyMaterial.fileLabel")} theme={theme} isDarkMode={isDarkMode} />
          <TouchableOpacity
            onPress={pickDocument}
            activeOpacity={0.8}
            style={[
              styles.uploadBox,
              selectedDocument
                ? { borderColor: theme.primary, backgroundColor: tint("#22C55E", isDarkMode), borderStyle: "solid" }
                : { borderColor: isDarkMode ? "#3A3F4A" : "#CBD5E1", backgroundColor: theme.surface },
            ]}
          >
            <View style={[styles.uploadIcon, { backgroundColor: tint(selectedDocument ? "#22C55E" : "#3B82F6", isDarkMode) }]}>
              <Ionicons
                name={selectedDocument ? "checkmark-circle" : "cloud-upload"}
                size={26}
                color={selectedDocument ? theme.primary : "#3B82F6"}
              />
            </View>
            <Text style={[styles.uploadText, { color: theme.text }]} numberOfLines={2}>
              {selectedDocument ? selectedDocument.name : t("studyMaterial.chooseFile")}
            </Text>
            <Text style={[styles.uploadHint, { color: theme.subText }]}>
              {selectedDocument ? t("studyMaterial.readyToPublish") : t("studyMaterial.fileTypes")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <FieldLabel icon="eye" color="#0EA5E9" text={t("studyMaterial.previewContentLabel")} theme={theme} isDarkMode={isDarkMode} />
          <TextInput
            value={previewContent}
            onChangeText={setPreviewContent}
            placeholder={t("studyMaterial.previewContentPlaceholder")}
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.text, borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.surface }]}
          />
        </View>

        <View style={[styles.optionCard, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}> 
          <View style={styles.optionRow}>
            <View style={[styles.optionIcon, { backgroundColor: tint("#10B981", isDarkMode) }]}>
              <Ionicons name="gift" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>{t("studyMaterial.freeMaterial")}</Text>
              <Text style={[styles.optionText, { color: theme.subText }]}>{t("studyMaterial.freeMaterialHint")}</Text>
            </View>
            <Switch
              value={isFree}
              onValueChange={setIsFree}
              trackColor={{ true: theme.primary }}
            />
          </View>

          {!isFree ? (
            <View style={{ marginTop: 12 }}>
              <FieldLabel icon="wallet" color="#F59E0B" text={t("studyMaterial.priceLabel")} theme={theme} isDarkMode={isDarkMode} />
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder={t("studyMaterial.pricePlaceholder")}
                placeholderTextColor={theme.placeholder}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.surface }]}
              />
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text style={styles.submitButtonText}>{t("studyMaterial.publish")}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 110,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  uploadHint: {
    fontSize: 12,
    marginTop: 4,
  },
  optionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
  optionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  optionText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  submitButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default UploadStudyMaterialScreen;
