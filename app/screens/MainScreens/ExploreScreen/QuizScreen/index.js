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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import { startQuiz, answerQuizQuestion, getQuizLeaderboard } from "../../../../services/api/Api";

const COUNT_PRESETS = [5, 10, 20, 50, 100];
const DIFFICULTIES = ["easy", "medium", "hard"];

const QuizScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  // phase: "setup" -> "taking" -> "result"
  const [phase, setPhase] = useState("setup");
  const [count, setCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);

  const [quiz, setQuiz] = useState(null); // { quiz_set_id, topic, difficulty, question_count, questions }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: "A" }
  // { [questionId]: { is_correct, correct_answer, explanation } } - filled in
  // the instant each question is answered, see handleSelect.
  const [feedback, setFeedback] = useState({});
  const [answering, setAnswering] = useState(false);
  const [result, setResult] = useState(null); // { score, total, points, results }

  const [leaderboard, setLeaderboard] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const handleScroll = (e) => {
    scrollY.setValue(Math.max(0, e.nativeEvent.contentOffset.y));
  };

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const res = await getQuizLeaderboard("week");
          const data = res?.data || res;
          setLeaderboard((data?.leaderboard || []).slice(0, 8));
        } catch (error) {
          // Silent - nice-to-have section.
        }
      })();
    }, [])
  );

  const resolvedCount = useCustomCount
    ? Math.max(1, Math.min(100, parseInt(customCount, 10) || 0))
    : count;

  const handleStart = async () => {
    if (useCustomCount && (!customCount || resolvedCount < 1)) {
      Toast.show({
        type: "error",
        text1: t("quiz.invalidCount", "Vui lòng nhập số câu hỏi hợp lệ (1-100)"),
      });
      return;
    }

    setLoading(true);
    try {
      const res = await startQuiz(resolvedCount, difficulty);
      const data = res?.data || res;
      setQuiz(data);
      setAnswers({});
      setFeedback({});
      setCurrentIndex(0);
      setResult(null);
      setPhase("taking");
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          error?.response?.data?.message ||
          t("quiz.startError", "Không thể tạo câu hỏi lúc này, vui lòng thử lại."),
      });
    } finally {
      setLoading(false);
    }
  };

  // Grades the question the instant it's answered - no separate "submit"
  // step. Once the last question in the set is answered, the API finalizes
  // the play and returns the final score/points, so the result screen is
  // built right here from the accumulated per-question feedback.
  const handleSelect = async (questionId, letter) => {
    if (!quiz || feedback[questionId] || answering) return; // already answered / a request in flight
    setAnswering(true);
    try {
      const res = await answerQuizQuestion(quiz.quiz_set_id, questionId, letter);
      const data = res?.data || res;
      const nextAnswers = { ...answers, [questionId]: letter };
      const nextFeedback = { ...feedback, [questionId]: data };
      setAnswers(nextAnswers);
      setFeedback(nextFeedback);

      if (data.finished) {
        setResult({
          score: data.score,
          total: data.total,
          points: data.points,
          results: quiz.questions.map((q) => ({
            id: q.id,
            your_answer: nextAnswers[q.id] ?? null,
            correct_answer: nextFeedback[q.id]?.correct_answer,
            is_correct: nextFeedback[q.id]?.is_correct,
            explanation: nextFeedback[q.id]?.explanation,
          })),
        });
        setPhase("result");
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          error?.response?.data?.message ||
          t("quiz.answerError", "Không thể ghi nhận câu trả lời, vui lòng thử lại."),
      });
    } finally {
      setAnswering(false);
    }
  };

  const handleRestart = () => {
    setPhase("setup");
    setQuiz(null);
    setResult(null);
    setAnswers({});
    setFeedback({});
    setCurrentIndex(0);
  };

  const answeredCount = quiz ? Object.keys(answers).length : 0;
  const headerHeight = 58 + insets.top;

  const currentQuestion = quiz?.questions?.[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}
        pointerEvents="box-none"
      >
        <LiquidButton
          providerId="QuizScreen"
          size={44}
          scrollY={scrollY}
          alwaysBorder
          onPress={() => (phase === "setup" ? navigation.goBack() : handleRestart())}
        >
          <Ionicons name={phase === "setup" ? "chevron-back" : "close"} size={22} color={theme.primary} />
        </LiquidButton>
        <Animated.Text style={[styles.headerTitle, { color: theme.text, opacity: titleOpacity }]} numberOfLines={1}>
          {t("quiz.title", "Đố vui")}
        </Animated.Text>
        <View style={{ width: 44 }} />
      </View>

      <AndroidGlassBackdrop providerId="QuizScreen" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: headerHeight + 12, paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {phase === "setup" && (
            <>
              <Text style={[styles.subtitle, { color: theme.subText }]}>
                {t("quiz.subtitle", "Trả lời câu hỏi trắc nghiệm do AI tạo ra, thử thách kiến thức của bạn.")}
              </Text>

              <View style={[styles.card, { backgroundColor: theme.cardBackground || theme.iconBackground }]}>
                <Text style={[styles.cardLabel, { color: theme.text }]}>
                  {t("quiz.questionCount", "Số câu hỏi")}
                </Text>
                <View style={styles.chipRow}>
                  {COUNT_PRESETS.map((c) => {
                    const active = !useCustomCount && count === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => {
                          setCount(c);
                          setUseCustomCount(false);
                        }}
                        style={[
                          styles.chip,
                          { backgroundColor: active ? theme.primary : theme.iconBackground },
                        ]}
                      >
                        <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>
                          {c} {t("quiz.questionsUnit", "câu")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => setUseCustomCount(true)}
                    style={[
                      styles.chip,
                      { backgroundColor: useCustomCount ? theme.primary : theme.iconBackground },
                    ]}
                  >
                    <Text style={{ color: useCustomCount ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>
                      {t("quiz.custom", "Tùy chỉnh")}
                    </Text>
                  </TouchableOpacity>
                </View>
                {useCustomCount && (
                  <TextInput
                    value={customCount}
                    onChangeText={setCustomCount}
                    keyboardType="number-pad"
                    placeholder={t("quiz.customPlaceholder", "Nhập số câu (1-100)")}
                    placeholderTextColor={theme.subText}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}

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
                          {t(`quiz.difficulty_${d}`, d === "easy" ? "Dễ" : d === "medium" ? "Trung bình" : "Khó")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.startButton, { backgroundColor: theme.primary }]}
                  onPress={handleStart}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="sparkles" size={18} color="#fff" />
                  )}
                  <Text style={styles.startButtonText}>
                    {loading ? t("quiz.generating", "Đang tạo câu hỏi...") : t("quiz.start", "Bắt đầu")}
                  </Text>
                </TouchableOpacity>
              </View>

              {leaderboard.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="trophy" size={16} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      {t("quiz.leaderboard", "Bảng xếp hạng đố vui")}
                    </Text>
                  </View>
                  {leaderboard.map((u, i) => (
                    <View key={u.id} style={styles.leaderboardRow}>
                      <Text style={[styles.leaderboardRank, { color: theme.subText }]}>{i + 1}</Text>
                      <Image
                        source={{ uri: u.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${u.username}/avatar` }}
                        style={styles.leaderboardAvatar}
                      />
                      <Text style={[styles.leaderboardName, { color: theme.text }]} numberOfLines={1}>
                        {u.profile_name || u.username}
                      </Text>
                      <Text style={[styles.leaderboardPoints, { color: theme.primary }]}>
                        {u.points} {t("quiz.pointsUnit", "điểm")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {phase === "taking" && quiz && currentQuestion && (
            <View>
              <View style={styles.takingHeader}>
                <View>
                  <Text style={[styles.topicLabel, { color: theme.subText }]}>
                    {t("quiz.topic", "Chủ đề")}
                  </Text>
                  <Text style={[styles.topicValue, { color: theme.text }]}>{quiz.topic}</Text>
                </View>
                <Text style={[styles.answeredCount, { color: theme.subText }]}>
                  {t("quiz.answeredCount", "Đã trả lời {{answered}}/{{total}}", {
                    answered: answeredCount,
                    total: quiz.question_count,
                  })}
                </Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: theme.iconBackground }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: theme.primary, width: `${(answeredCount / quiz.question_count) * 100}%` },
                  ]}
                />
              </View>

              <View style={[styles.card, { backgroundColor: theme.cardBackground || theme.iconBackground }]}>
                <Text style={[styles.questionIndex, { color: theme.subText }]}>
                  {t("quiz.questionIndex", "Câu {{current}}/{{total}}", {
                    current: currentIndex + 1,
                    total: quiz.question_count,
                  })}
                </Text>
                <Text style={[styles.questionText, { color: theme.text }]}>{currentQuestion.question}</Text>
                <View style={{ gap: 8 }}>
                  {currentQuestion.options.map((opt) => {
                    const letter = opt.trim().charAt(0);
                    const selected = answers[currentQuestion.id] === letter;
                    const currentFeedback = feedback[currentQuestion.id];
                    const isCorrectOption = currentFeedback && letter === currentFeedback.correct_answer;
                    const isWrongSelected = currentFeedback && selected && !currentFeedback.is_correct;

                    let bg = selected ? `${theme.primary}1A` : theme.iconBackground;
                    let border = selected ? theme.primary : "transparent";
                    let textColor = selected ? theme.primary : theme.text;
                    if (currentFeedback) {
                      if (isCorrectOption) {
                        bg = `${theme.primary}1A`;
                        border = theme.primary;
                        textColor = theme.primary;
                      } else if (isWrongSelected) {
                        bg = "#e5393520";
                        border = "#e53935";
                        textColor = "#e53935";
                      } else {
                        bg = theme.iconBackground;
                        border = "transparent";
                        textColor = theme.subText;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => handleSelect(currentQuestion.id, letter)}
                        disabled={!!currentFeedback || answering}
                        style={[styles.optionRow, { backgroundColor: bg, borderColor: border }]}
                      >
                        <Text style={{ color: textColor, fontWeight: selected || isCorrectOption ? "700" : "500", fontSize: 14 }}>
                          {opt}
                          {isCorrectOption ? " ✓" : isWrongSelected ? " ✗" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {feedback[currentQuestion.id]?.explanation && (
                  <Text style={[styles.resultExplanation, { color: theme.subText, marginTop: 10 }]}>
                    {feedback[currentQuestion.id].explanation}
                  </Text>
                )}
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity
                  onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  style={[styles.navButton, { borderColor: theme.border, opacity: currentIndex === 0 ? 0.4 : 1 }]}
                >
                  <Text style={{ color: theme.text, fontWeight: "600", fontSize: 13 }}>
                    {t("quiz.prevQuestion", "Câu trước")}
                  </Text>
                </TouchableOpacity>
                {currentIndex < quiz.question_count - 1 && (
                  <TouchableOpacity
                    onPress={() => setCurrentIndex((i) => Math.min(quiz.question_count - 1, i + 1))}
                    disabled={!feedback[currentQuestion.id]}
                    style={[
                      styles.navButtonPrimary,
                      { backgroundColor: theme.primary, opacity: !feedback[currentQuestion.id] ? 0.4 : 1 },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                      {t("quiz.nextQuestion", "Câu tiếp theo")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.dotsRow}>
                {quiz.questions.map((q, i) => {
                  const isCurrent = i === currentIndex;
                  const qFeedback = feedback[q.id];
                  let dotBg = theme.iconBackground;
                  let dotBorder = "transparent";
                  let dotTextColor = theme.subText;
                  if (isCurrent) {
                    dotBg = theme.primary;
                    dotBorder = theme.primary;
                    dotTextColor = "#fff";
                  } else if (qFeedback) {
                    dotBg = qFeedback.is_correct ? `${theme.primary}1A` : "#e5393520";
                    dotBorder = qFeedback.is_correct ? theme.primary : "#e53935";
                    dotTextColor = qFeedback.is_correct ? theme.primary : "#e53935";
                  }
                  return (
                    <TouchableOpacity
                      key={q.id}
                      onPress={() => setCurrentIndex(i)}
                      style={[styles.dot, { backgroundColor: dotBg, borderColor: dotBorder }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: dotTextColor }}>{i + 1}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {phase === "result" && result && quiz && (
            <View>
              <View style={[styles.card, styles.resultCard, { backgroundColor: theme.cardBackground || theme.iconBackground }]}>
                <Text style={[styles.resultLabel, { color: theme.subText }]}>{t("quiz.result", "Kết quả")}</Text>
                <Text style={[styles.resultScore, { color: theme.primary }]}>
                  {result.score}/{result.total}
                </Text>
                {result.points != null && (
                  <Text style={[styles.resultPoints, { color: theme.text }]}>
                    {t("quiz.pointsEarned", "+{{points}} điểm", { points: result.points })}
                  </Text>
                )}
                <Text style={[styles.resultTopic, { color: theme.subText }]}>
                  {t("quiz.topicResult", "Chủ đề: {{topic}}", { topic: quiz.topic })}
                </Text>
                <TouchableOpacity
                  style={[styles.restartButton, { backgroundColor: theme.primary }]}
                  onPress={handleRestart}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.restartButtonText}>{t("quiz.restart", "Làm bài mới")}</Text>
                </TouchableOpacity>
              </View>

              {quiz.questions.map((q) => {
                const r = result.results?.find((item) => item.id === q.id);
                if (!r) return null;
                return (
                  <View
                    key={q.id}
                    style={[styles.resultQuestionCard, { backgroundColor: theme.cardBackground || theme.iconBackground }]}
                  >
                    <View style={styles.resultQuestionHeader}>
                      <Ionicons
                        name={r.is_correct ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={r.is_correct ? theme.primary : "#e53935"}
                      />
                      <Text style={[styles.resultQuestionText, { color: theme.text }]}>{q.question}</Text>
                    </View>
                    <View style={{ paddingLeft: 26 }}>
                      {q.options.map((opt) => {
                        const letter = opt.trim().charAt(0);
                        const isCorrect = letter === r.correct_answer;
                        const isYours = letter === r.your_answer;
                        return (
                          <Text
                            key={opt}
                            style={[
                              styles.resultOption,
                              {
                                color: isCorrect ? theme.primary : isYours ? "#e53935" : theme.subText,
                                fontWeight: isCorrect || isYours ? "700" : "400",
                              },
                            ]}
                          >
                            {opt}
                            {isCorrect ? " ✓" : isYours ? " ✗" : ""}
                          </Text>
                        );
                      })}
                      {r.explanation && (
                        <Text style={[styles.resultExplanation, { color: theme.subText }]}>{r.explanation}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
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
  card: { borderRadius: 16, padding: 16, marginBottom: 20 },
  cardLabel: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
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
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  leaderboardRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  leaderboardRank: { width: 20, fontSize: 13, fontWeight: "700", textAlign: "center", marginRight: 6 },
  leaderboardAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  leaderboardName: { flex: 1, fontSize: 14, fontWeight: "600" },
  leaderboardPoints: { fontSize: 13, fontWeight: "700", marginLeft: 8 },
  takingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 },
  topicLabel: { fontSize: 11 },
  topicValue: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  answeredCount: { fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 20 },
  progressFill: { height: "100%", borderRadius: 3 },
  questionIndex: { fontSize: 11, marginBottom: 8 },
  questionText: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  optionRow: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  navButton: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  navButtonPrimary: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  dotsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  resultCard: { alignItems: "center" },
  resultLabel: { fontSize: 13, marginBottom: 4 },
  resultScore: { fontSize: 34, fontWeight: "800", marginBottom: 2 },
  resultPoints: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  resultTopic: { fontSize: 13, marginBottom: 16 },
  restartButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  restartButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  resultQuestionCard: { borderRadius: 14, padding: 14, marginBottom: 12 },
  resultQuestionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  resultQuestionText: { flex: 1, fontSize: 14, fontWeight: "600" },
  resultOption: { fontSize: 13, paddingVertical: 3 },
  resultExplanation: { fontSize: 12, fontStyle: "italic", marginTop: 4 },
});

export default QuizScreen;
