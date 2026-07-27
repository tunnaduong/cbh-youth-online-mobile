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

      const uploadResponse = await uploadFile(formData);
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
      Toast.show({
        type: "error",
        text1: t("studyMaterial.publishError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
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
              color: theme.text,
              opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }),
            },
          ]}
        >
          {t("studyMaterial.uploadTitle")}
        </Animated.Text>
        <View style={styles.headerSpacer} />
      </View>

      <AndroidGlassBackdrop providerId="UploadStudyMaterialScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <View style={[styles.heroIcon, { backgroundColor: theme.primary + "15" }]}> 
            <Ionicons name="documents-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{t("studyMaterial.uploadHeroTitle")}</Text>
            <Text style={[styles.heroText, { color: theme.subText }]}>{t("studyMaterial.uploadHeroText")}</Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>{t("studyMaterial.titleLabel")}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("studyMaterial.titlePlaceholder")}
            placeholderTextColor={theme.placeholder}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>{t("studyMaterial.descriptionLabel")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("studyMaterial.descriptionPlaceholder")}
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>{t("studyMaterial.categories")}</Text>
          {loadingCategories ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.chipRow}>
              {categories.map((category) => {
                const active = selectedCategoryId === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    style={[
                      styles.categoryChip,
                      active ? { backgroundColor: theme.primary, borderColor: "transparent" } : { backgroundColor: theme.cardBackground, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, active ? { color: "#fff" } : { color: theme.text }]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>{t("studyMaterial.fileLabel")}</Text>
          <TouchableOpacity
            onPress={pickDocument}
            style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <View style={[styles.uploadIcon, { backgroundColor: theme.primary + "15" }]}> 
              <Ionicons name={selectedDocument ? "checkmark-circle-outline" : "cloud-upload-outline"} size={24} color={theme.primary} />
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
          <Text style={[styles.label, { color: theme.text }]}>{t("studyMaterial.previewContentLabel")}</Text>
          <TextInput
            value={previewContent}
            onChangeText={setPreviewContent}
            placeholder={t("studyMaterial.previewContentPlaceholder")}
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          />
        </View>

        <View style={[styles.optionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <View style={styles.optionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>{t("studyMaterial.freeMaterial")}</Text>
              <Text style={[styles.optionText, { color: theme.subText }]}>{t("studyMaterial.freeMaterialHint")}</Text>
            </View>
            <Switch
              value={isFree}
              onValueChange={setIsFree}
              thumbColor={isFree ? theme.primary : "#9CA3AF"}
              trackColor={{ false: "#D1D5DB", true: theme.primary + "55" }}
            />
          </View>

          {!isFree ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: theme.text }]}>{t("studyMaterial.priceLabel")}</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder={t("studyMaterial.pricePlaceholder")}
                placeholderTextColor={theme.placeholder}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
              />
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>{t("studyMaterial.publish")}</Text>}
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
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
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
  optionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
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
    borderRadius: 16,
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
