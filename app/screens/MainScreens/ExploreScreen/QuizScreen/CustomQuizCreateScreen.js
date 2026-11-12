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
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import SegmentedControl from "../../../../components/SegmentedControl";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import { createCustomQuiz } from "../../../../services/api/Api";
import { apiErrorMessage } from "../../../../utils/apiMessage";

const DIFFICULTIES = ["easy", "medium", "hard"];
const MAX_TITLE_LENGTH = 150;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["docx", "txt", "pdf"];

const getExtension = (name = "") => {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

function quizAnswerMarkParser(input) {
  "worklet";
  const ranges = [];
  const regexp = /\*\*([^\n*]+?)\*\*/g;
  let match;
  while ((match = regexp.exec(input)) !== null) {
    ranges.push({ start: match.index, length: 2, type: "syntax" });
    ranges.push({ start: match.index + 2, length: match[1].length, type: "bold" });
    ranges.push({ start: match.index + 2 + match[1].length, length: 2, type: "syntax" });
  }
  return ranges;
}

const CustomQuizCreateScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();
  const contentInputRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState("form");
  const [mode, setMode] = useState("text"); // "text" | "file"
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentSelection, setContentSelection] = useState({ start: 0, end: 0 });
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdQuiz, setCreatedQuiz] = useState(null);

  const markSelectionAsCorrect = () => {
    const { start, end } = contentSelection;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const next = `${before}**${selected}**${after}`;
    setContent(next);
    const cursor = selected ? start + selected.length + 4 : start + 2;
    setContentSelection({ start: cursor, end: cursor });
    contentInputRef.current?.focus();
  };

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

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
      // Silent
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
        formData.append("content_text", content);
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
          apiErrorMessage(error, t("customQuiz.createError", "Không thể tạo bộ đề tùy chỉnh, vui lòng thử lại.")),
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
      {/* Floating Transparent Header */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 8,
            paddingTop: insets.top,
            height: 64 + insets.top,
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "600",
              color: theme.primary,
              opacity: headerTitleOpacity,
            }}
          >
            {t("customQuiz.title", "Tạo bộ đề tùy chỉnh")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* Atmospheric Top Gradient */}
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

      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={64 + insets.top}
        >
          <Animated.ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingTop: 64 + insets.top,
              paddingBottom: insets.bottom + 32,
            }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            keyboardShouldPersistTaps="handled"
          >
            {step === "form" && (
              <>
                <Text style={[styles.description, { color: theme.subText }]}>
                  {t("customQuiz.subtitle")}
                </Text>

                <View style={{ marginBottom: 16 }}>
                  <SegmentedControl
                    value={mode}
                    onChange={setMode}
                    segments={[
                      { key: "text", label: t("customQuiz.modeText", "Nhập văn bản") },
                      { key: "file", label: t("customQuiz.modeFile", "Tải file lên") },
                    ]}
                  />
                </View>

                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>
                    {t("customQuiz.titleLabel", "Tiêu đề")}
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t("customQuiz.titlePlaceholder", "Tiêu đề (không bắt buộc)")}
                    placeholderTextColor={theme.subText}
                    maxLength={MAX_TITLE_LENGTH}
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  />

                  <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 18 }]}>
                    {t("quiz.difficulty", "Độ khó")}
                  </Text>
                  <SegmentedControl
                    value={difficulty}
                    onChange={setDifficulty}
                    segments={DIFFICULTIES.map((d) => ({
                      key: d,
                      label: t(
                        `quiz.difficulty_${d}`,
                        d === "easy" ? "Dễ" : d === "medium" ? "Trung bình" : "Khó"
                      ),
                    }))}
                  />

                  {mode === "text" ? (
                    <>
                      <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 18 }]}>
                        {t("customQuiz.contentLabel", "Nội dung câu hỏi")}
                      </Text>
                      <Text style={[styles.helpText, { color: theme.subText }]}>
                        {t("customQuiz.textHelp")}
                      </Text>

                      <View style={[styles.editorWrapper, { borderColor: theme.border }]}>
                        <View style={[styles.toolbar, { backgroundColor: theme.iconBackground }]}>
                          <TouchableOpacity
                            onPress={markSelectionAsCorrect}
                            style={styles.markCorrectButton}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color={theme.primary} />
                            <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>
                              {t("customQuiz.markCorrect", "Đánh dấu đáp án đúng")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <MarkdownTextInput
                          ref={contentInputRef}
                          value={content}
                          onChangeText={setContent}
                          selection={contentSelection}
                          onSelectionChange={(e) => setContentSelection(e.nativeEvent.selection)}
                          parser={quizAnswerMarkParser}
                          markdownStyle={{ syntax: { color: theme.subText } }}
                          placeholder={t("customQuiz.editorPlaceholder")}
                          placeholderTextColor={theme.subText}
                          multiline
                          textAlignVertical="top"
                          style={[styles.editorInput, { color: theme.text, backgroundColor: theme.background }]}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 18 }]}>
                        {t("customQuiz.fileLabel", "File câu hỏi")}
                      </Text>
                      <TouchableOpacity
                        onPress={pickDocument}
                        activeOpacity={0.8}
                        style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.background }]}
                      >
                        <Ionicons
                          name={selectedFile ? "checkmark-circle-outline" : "cloud-upload-outline"}
                          size={24}
                          color={theme.primary}
                        />
                        <Text style={[styles.uploadText, { color: theme.text }]} numberOfLines={1}>
                          {selectedFile ? selectedFile.name : t("customQuiz.chooseFile", "Chọn file (.docx, .txt, .pdf)")}
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.helpText, { color: theme.subText }]}>
                        {t("customQuiz.fileHelp")}
                      </Text>
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: 20 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="sparkles" size={18} color="#fff" />
                    )}
                    <Text style={styles.primaryButtonText}>
                      {submitting
                        ? t("customQuiz.creating", "Đang tạo bộ đề...")
                        : t("customQuiz.create", "Tạo bộ đề")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === "success" && createdQuiz && (
              <View
                style={[
                  styles.card,
                  styles.resultCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Ionicons name="checkmark-circle" size={44} color={theme.primary} />
                <Text style={[styles.resultTitle, { color: theme.text }]}>
                  {t("customQuiz.successTitle", "Đã tạo bộ đề thành công!")}
                </Text>
                <Text style={[styles.resultTopic, { color: theme.subText }]}>
                  {createdQuiz.topic}
                </Text>
                <Text style={[styles.resultMeta, { color: theme.subText }]}>
                  {t("customQuiz.questionCountResult", "{{count}} câu hỏi · Độ khó: {{difficulty}}", {
                    count: createdQuiz.question_count,
                    difficulty: t(
                      `quiz.difficulty_${
                        ["easy", "hard"].includes(createdQuiz.difficulty) ? createdQuiz.difficulty : "medium"
                      }`
                    ),
                  })}
                </Text>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.primary, width: "100%", marginTop: 24 }]}
                  onPress={handlePlay}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>{t("customQuiz.playNow", "Chơi ngay")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    { borderColor: theme.border, width: "100%", backgroundColor: theme.background },
                  ]}
                  onPress={() => handleShare(createdQuiz.quiz_set_id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={18} color={theme.text} />
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    {t("customQuiz.shareQuiz", "Chia sẻ bộ đề")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  helpText: { fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 12 },
  editorWrapper: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  toolbar: { paddingHorizontal: 12, paddingVertical: 10 },
  markCorrectButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  editorInput: { minHeight: 200, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 20 },
  uploadBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  uploadText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    padding: 14,
  },
  primaryButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  secondaryButtonText: { fontWeight: "bold", fontSize: 15 },
  resultCard: { alignItems: "center", paddingVertical: 24 },
  resultTitle: { fontSize: 18, fontWeight: "800", marginTop: 12 },
  resultTopic: { fontSize: 15, fontWeight: "600", marginTop: 6 },
  resultMeta: { fontSize: 13, marginTop: 4 },
});

export default CustomQuizCreateScreen;
