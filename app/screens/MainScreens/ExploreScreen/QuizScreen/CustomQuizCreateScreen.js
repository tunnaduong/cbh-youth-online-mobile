import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import { createCustomQuiz } from "../../../../services/api/Api";

const DIFFICULTIES = ["easy", "medium", "hard"];
const MAX_TITLE_LENGTH = 150;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, must match backend QuizController::custom max:10240
const ALLOWED_EXTENSIONS = ["docx", "txt", "pdf"];
const COLOR_SWATCHES = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa"];

const getExtension = (name = "") => {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const CustomQuizCreateScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const richText = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // step: "form" -> "success"
  const [step, setStep] = useState("form");
  const [mode, setMode] = useState("text"); // "text" | "file"
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdQuiz, setCreatedQuiz] = useState(null); // { quiz_set_id, topic, difficulty, question_count }

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const handleScroll = (e) => {
    scrollY.setValue(Math.max(0, e.nativeEvent.contentOffset.y));
  };

  const headerHeight = 58 + insets.top;

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "application/pdf",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const ext = getExtension(asset.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        Toast.show({
          type: "error",
          text1: t("customQuiz.invalidFileType", "Chỉ hỗ trợ file .docx, .txt hoặc .pdf"),
        });
        return;
      }
      if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
        Toast.show({
          type: "error",
          text1: t("customQuiz.fileTooLarge", "File tối đa 10MB"),
        });
        return;
      }

      setSelectedFile(asset);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("customQuiz.fileSelectError", "Không thể chọn file, vui lòng thử lại."),
      });
    }
  };

  const handleShare = async (quizSetId) => {
    if (!quizSetId) return;
    try {
      await Share.share({
        message: t("quiz.shareMessage", "Cùng thử sức với bài đố vui này nhé! {{link}}", {
          link: `https://chuyenbienhoa.com/explore/quiz?shared=${quizSetId}`,
        }),
      });
    } catch (error) {
      // Silent - sharing is best-effort.
    }
  };

  const handleSubmit = async () => {
    if (mode === "file" && !selectedFile) {
      Toast.show({
        type: "error",
        text1: t("customQuiz.fileRequired", "Vui lòng chọn file trước khi tạo bộ đề."),
      });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (title.trim()) formData.append("title", title.trim());
      formData.append("difficulty", difficulty);

      if (mode === "text") {
        const html = await richText.current?.getContentHtml();
        formData.append("content_html", html || "");
      } else {
        formData.append("file", {
          uri: selectedFile.uri,
          name: selectedFile.name || `custom-quiz.${getExtension(selectedFile.name) || "pdf"}`,
          type:
            selectedFile.mimeType ||
            (getExtension(selectedFile.name) === "pdf"
              ? "application/pdf"
              : getExtension(selectedFile.name) === "txt"
              ? "text/plain"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        });
      }

      const res = await createCustomQuiz(formData);
      const data = res?.data || res;
      setCreatedQuiz(data);
      setStep("success");
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          error?.response?.data?.message ||
          t("customQuiz.createError", "Không thể tạo bộ đề tùy chỉnh, vui lòng thử lại."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlay = () => {
    if (!createdQuiz?.quiz_set_id) return;
    navigation.replace("QuizScreen", { sharedQuizId: createdQuiz.quiz_set_id });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}
        pointerEvents="box-none"
      >
        <LiquidButton
          providerId="CustomQuizCreateScreen"
          size={44}
          scrollY={scrollY}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[styles.headerTitle, { color: theme.text, opacity: titleOpacity }]}
          numberOfLines={1}
        >
          {t("customQuiz.title", "Tạo bộ đề tùy chỉnh")}
        </Animated.Text>
        <View style={{ width: 44 }} />
      </View>

      <AndroidGlassBackdrop providerId="CustomQuizCreateScreen" style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: headerHeight + 12,
              paddingHorizontal: 16,
              paddingBottom: 40 + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {step === "form" && (
              <>
                <Text style={[styles.subtitle, { color: theme.subText }]}>
                  {t(
                    "customQuiz.subtitle",
                    "Tự soạn bộ câu hỏi trắc nghiệm của riêng bạn từ văn bản hoặc file có sẵn."
                  )}
                </Text>

                <View style={styles.chipRow}>
                  <TouchableOpacity
                    onPress={() => setMode("text")}
                    style={[
                      styles.modeChip,
                      { backgroundColor: mode === "text" ? theme.primary : theme.iconBackground },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={mode === "text" ? "#fff" : theme.text}
                    />
                    <Text
                      style={{
                        color: mode === "text" ? "#fff" : theme.text,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {t("customQuiz.modeText", "Nhập văn bản")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMode("file")}
                    style={[
                      styles.modeChip,
                      { backgroundColor: mode === "file" ? theme.primary : theme.iconBackground },
                    ]}
                  >
                    <Ionicons
                      name="document-attach-outline"
                      size={16}
                      color={mode === "file" ? "#fff" : theme.text}
                    />
                    <Text
                      style={{
                        color: mode === "file" ? "#fff" : theme.text,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {t("customQuiz.modeFile", "Tải file lên")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, { backgroundColor: theme.cardBackground || theme.iconBackground }]}>
                  <Text style={[styles.cardLabel, { color: theme.text }]}>
                    {t("customQuiz.titleLabel", "Tiêu đề")}
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t("customQuiz.titlePlaceholder", "Tiêu đề (không bắt buộc)")}
                    placeholderTextColor={theme.subText}
                    maxLength={MAX_TITLE_LENGTH}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />

                  <Text style={[styles.cardLabel, { color: theme.text, marginTop: 16 }]}>
                    {t("quiz.difficulty", "Độ khó")}
                  </Text>
                  <View style={styles.chipRow}>
                    {DIFFICULTIES.map((d) => {
                      const active = difficulty === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setDifficulty(d)}
                          style={[
                            styles.chip,
                            { backgroundColor: active ? theme.primary : theme.iconBackground },
                          ]}
                        >
                          <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>
                            {t(
                              `quiz.difficulty_${d}`,
                              d === "easy" ? "Dễ" : d === "medium" ? "Trung bình" : "Khó"
                            )}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {mode === "text" ? (
                    <>
                      <Text style={[styles.cardLabel, { color: theme.text, marginTop: 16 }]}>
                        {t("customQuiz.contentLabel", "Nội dung câu hỏi")}
                      </Text>
                      <Text style={[styles.helpText, { color: theme.subText }]}>
                        {t(
                          "customQuiz.textHelp",
                          "Đánh số câu hỏi (Câu 1:, Câu 2:...), các phương án A/B/C/D, và đánh dấu ĐÚNG DUY NHẤT một phương án đúng bằng in đậm, gạch chân hoặc tô màu. Có thể thêm dòng \"Giải thích:\" sau mỗi câu. Bộ phân tích AI khá linh hoạt với định dạng chưa chuẩn, nhưng mỗi câu cần đúng một đáp án được đánh dấu rõ ràng, nếu không câu đó sẽ bị bỏ qua. Chỉ hỗ trợ trắc nghiệm (không hỗ trợ tự luận/điền khuyết). Tối thiểu 2 phương án mỗi câu, các phương án còn thiếu sẽ được tự động bổ sung."
                        )}
                      </Text>

                      <View style={[styles.editorWrapper, { borderColor: theme.border }]}>
                        <RichToolbar
                          editor={richText}
                          selectedIconTint={theme.primary}
                          iconTint={theme.text}
                          style={[styles.toolbar, { backgroundColor: theme.iconBackground }]}
                          actions={[actions.setBold, actions.setUnderline, actions.undo, actions.redo]}
                        />
                        <View style={styles.colorRow}>
                          {COLOR_SWATCHES.map((color) => (
                            <TouchableOpacity
                              key={color}
                              onPress={() => richText.current?.setForeColor(color)}
                              style={[styles.colorSwatch, { backgroundColor: color }]}
                            />
                          ))}
                        </View>
                        <RichEditor
                          ref={richText}
                          placeholder={t(
                            "customQuiz.editorPlaceholder",
                            "Câu 1: Thủ đô của Việt Nam là gì?\nA. Hà Nội\nB. Hồ Chí Minh\nC. Đà Nẵng\nD. Huế\nGiải thích: Hà Nội là thủ đô..."
                          )}
                          initialHeight={220}
                          editorStyle={{
                            backgroundColor: theme.background,
                            color: theme.text,
                            placeholderColor: theme.subText,
                          }}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.cardLabel, { color: theme.text, marginTop: 16 }]}>
                        {t("customQuiz.fileLabel", "File câu hỏi")}
                      </Text>
                      <TouchableOpacity
                        onPress={pickDocument}
                        style={[styles.uploadBox, { borderColor: theme.border }]}
                      >
                        <Ionicons
                          name={selectedFile ? "checkmark-circle-outline" : "cloud-upload-outline"}
                          size={22}
                          color={theme.primary}
                        />
                        <Text style={[styles.uploadText, { color: theme.text }]} numberOfLines={1}>
                          {selectedFile ? selectedFile.name : t("customQuiz.chooseFile", "Chọn file (.docx, .txt, .pdf)")}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.helpText, { color: theme.subText }]}>
                        {t(
                          "customQuiz.fileHelp",
                          "• .docx giữ nguyên định dạng in đậm/gạch chân/màu chữ.\n• .txt cần tự đánh dấu đáp án đúng bằng **in đậm** hoặc <u>gạch chân</u> vì văn bản thuần không có định dạng thật.\n• .pdf sẽ mất định dạng khi trích xuất, nên cần ghi rõ đáp án bằng chữ, ví dụ \"Đáp án: B\" cho mỗi câu."
                        )}
                      </Text>
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.startButton, { backgroundColor: theme.primary }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="sparkles" size={18} color="#fff" />
                    )}
                    <Text style={styles.startButtonText}>
                      {submitting
                        ? t("customQuiz.creating", "Đang tạo bộ đề...")
                        : t("customQuiz.create", "Tạo bộ đề")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === "success" && createdQuiz && (
              <View style={[styles.card, styles.resultCard, { backgroundColor: theme.cardBackground || theme.iconBackground }]}>
                <Ionicons name="checkmark-circle" size={40} color={theme.primary} />
                <Text style={[styles.resultTitle, { color: theme.text }]}>
                  {t("customQuiz.successTitle", "Đã tạo bộ đề thành công!")}
                </Text>
                <Text style={[styles.resultTopic, { color: theme.subText }]}>
                  {createdQuiz.topic}
                </Text>
                <Text style={[styles.resultMeta, { color: theme.subText }]}>
                  {t("customQuiz.questionCountResult", "{{count}} câu hỏi · Độ khó: {{difficulty}}", {
                    count: createdQuiz.question_count,
                    difficulty:
                      createdQuiz.difficulty === "easy"
                        ? "Dễ"
                        : createdQuiz.difficulty === "hard"
                        ? "Khó"
                        : "Trung bình",
                  })}
                </Text>

                <TouchableOpacity
                  style={[styles.startButton, { backgroundColor: theme.primary, marginTop: 20 }]}
                  onPress={handlePlay}
                >
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.startButtonText}>{t("customQuiz.playNow", "Chơi ngay")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareButton, { borderColor: theme.border }]}
                  onPress={() => handleShare(createdQuiz.quiz_set_id)}
                >
                  <Ionicons name="share-outline" size={18} color={theme.text} />
                  <Text style={[styles.shareButtonText, { color: theme.text }]}>
                    {t("customQuiz.shareQuiz", "Chia sẻ bộ đề")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 13, marginBottom: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  card: { borderRadius: 16, padding: 16, marginBottom: 20 },
  cardLabel: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  helpText: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 12 },
  editorWrapper: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  toolbar: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  colorRow: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12 },
  uploadBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  uploadText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 20,
  },
  startButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  shareButtonText: { fontWeight: "700", fontSize: 14 },
  resultCard: { alignItems: "center" },
  resultTitle: { fontSize: 17, fontWeight: "800", marginTop: 10 },
  resultTopic: { fontSize: 14, fontWeight: "600", marginTop: 6 },
  resultMeta: { fontSize: 13, marginTop: 4 },
});

export default CustomQuizCreateScreen;
