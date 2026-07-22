import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import {
  createStudyMaterial,
  getStudyMaterialCategories,
  uploadFile,
} from "../../../../services/api/Api";

const UploadStudyMaterialScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { userInfo } = useAuthContext();

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
        text1: "Đã chọn tài liệu",
        text2: asset.name || "Bạn có thể đăng ngay",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Không thể chọn tài liệu",
        text2: error?.message || "Vui lòng thử lại",
      });
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Toast.show({ type: "error", text1: "Vui lòng nhập tiêu đề tài liệu" });
      return;
    }

    if (!selectedDocument) {
      Toast.show({ type: "error", text1: "Vui lòng chọn một tệp tài liệu" });
      return;
    }

    if (!isFree && (!price || Number(price) < 1)) {
      Toast.show({ type: "error", text1: "Vui lòng nhập giá điểm hợp lệ" });
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
        throw new Error("Không nhận được ID tệp sau khi upload");
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
        text1: "Đăng tài liệu thành công",
        text2: "Tài liệu của bạn đã được chia sẻ với cộng đồng",
      });
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Đăng tài liệu thất bại",
        text2: error?.message || "Vui lòng thử lại",
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
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Đăng tài liệu mới</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
          <Text style={[styles.heroTitle, { color: theme.text }]}>Chia sẻ tài liệu học tập</Text>
          <Text style={[styles.heroText, { color: theme.subText }]}>Đăng tài liệu, chọn danh mục và quyết định miễn phí hay bán bằng điểm.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Tiêu đề tài liệu</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Tổng hợp công thức Toán 12"
            placeholderTextColor={theme.placeholder}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Mô tả ngắn</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Giới thiệu tài liệu, đối tượng học, nội dung chính..."
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Danh mục</Text>
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
                      active ? { backgroundColor: theme.primary } : { backgroundColor: theme.cardBackground, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, active ? { color: "#fff" } : { color: theme.text }]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Tệp tài liệu</Text>
          <TouchableOpacity
            onPress={pickDocument}
            style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={theme.primary} />
            <Text style={[styles.uploadText, { color: theme.text }]}>
              {selectedDocument ? selectedDocument.name : "Chọn tệp từ máy"}
            </Text>
            <Text style={[styles.uploadHint, { color: theme.subText }]}>.pdf, .doc, .docx, .txt, .xlsx, .xls</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Nội dung xem trước</Text>
          <TextInput
            value={previewContent}
            onChangeText={setPreviewContent}
            placeholder="Nhập một đoạn nội dung nổi bật để người dùng xem trước..."
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          />
        </View>

        <View style={[styles.optionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
          <View style={styles.optionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>Tài liệu miễn phí</Text>
              <Text style={[styles.optionText, { color: theme.subText }]}>Nếu bật, người dùng có thể tải không mất điểm.</Text>
            </View>
            <Switch value={isFree} onValueChange={setIsFree} thumbColor={theme.primary} />
          </View>

          {!isFree ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.label, { color: theme.text }]}>Giá điểm</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="Ví dụ: 50"
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
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Đăng tài liệu ngay</Text>}
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
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
