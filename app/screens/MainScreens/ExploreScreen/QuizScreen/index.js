import React, { useRef, useState } from "react";
import FastImage from "../../../../components/FastImage";
import Svg, { Circle, G } from "react-native-svg";
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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import LiquidButton from "../../../../components/LiquidButton";
import SegmentedControl from "../../../../components/SegmentedControl";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import UserNameRow from "../../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../../components/profile/AvatarFrame";
import { apiErrorMessage } from "../../../../utils/apiMessage";
import BannerWatermark from "../../../../components/BannerWatermark";
import { tint } from "../../../../components/settings/SettingsUI";
import {
  startQuiz,
  answerQuizQuestion,
  getQuizLeaderboard,
  getQuizTopics,
  joinQuiz,
  restartQuiz,
} from "../../../../services/api/Api";

const COUNT_PRESETS = [5, 10, 20, 50];
const MAX_COUNT = 50;
const DIFFICULTIES = ["easy", "medium", "hard"];
const GRADES = ["10", "11", "12"];
// Matches QuizController::RANDOM_TOPIC / OTHER_TOPIC on the backend exactly
const RANDOM_TOPIC = "Ngẫu nhiên";
const OTHER_TOPIC = "Khác";

const FieldLabel = ({ icon, color, title, theme, isDarkMode, style }) => (
  <View style={[{ flexDirection: "row", alignItems: "center", marginBottom: 10 }, style]}>
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tint(color, isDarkMode), alignItems: "center", justifyContent: "center", marginRight: 8 }}>
      <Ionicons name={icon} size={15} color={color} />
    </View>
    <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, flex: 1 }}>{title}</Text>
  </View>
);

const QuizScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();
  const sharedQuizId = route?.params?.sharedQuizId;

  // phase: "setup" -> "taking" -> "result"
  const [phase, setPhase] = useState("setup");
  const [joiningShared, setJoiningShared] = useState(!!sharedQuizId);
  const [count, setCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [grade, setGrade] = useState("10");
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(RANDOM_TOPIC);
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const [quiz, setQuiz] = useState(null); // { quiz_set_id, topic, difficulty, question_count, questions }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: "A" }
  const [feedback, setFeedback] = useState({});
  const [answering, setAnswering] = useState(false);
  const [result, setResult] = useState(null); // { score, total, points, results }
  const [pendingResult, setPendingResult] = useState(null);

  const [leaderboard, setLeaderboard] = useState([]);

  React.useEffect(() => {
    const controller = new AbortController();
    getQuizTopics({ signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const data = res?.data || res;
        setTopics(data?.topics || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Opened via a shared quiz link
  React.useEffect(() => {
    if (!sharedQuizId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await joinQuiz(sharedQuizId);
        const data = res?.data || res;
        if (cancelled) return;

        if (data.status === "completed") {
          setQuiz(data);
          setResult(data.result);
          setPhase("result");
        } else {
          setQuiz(data);
          setAnswers(data.answered || {});
          setFeedback({});
          setCurrentIndex(0);
          setResult(null);
          setPendingResult(null);
          setPhase("taking");
        }
      } catch (error) {
        Toast.show({
          type: "error",
          text1:
            apiErrorMessage(error, t("quiz.joinError", "Không thể tham gia bài đố vui này.")),
        });
      } finally {
        if (!cancelled) setJoiningShared(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sharedQuizId]);

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

  const TOPIC_TRANSLATION_KEYS = {
    "Toán học": "mathematics",
    "Vật lý": "physics",
    "Hóa học": "chemistry",
    "Sinh học": "biology",
    "Ngữ văn": "literature",
    "Lịch sử": "history",
    "Địa lý": "geography",
    "Tiếng Anh": "english",
    "Tiếng Nga": "foreign-language",
    "Tin học": "computer-science",
  };
  const getTopicLabel = (tp) => {
    if (tp === RANDOM_TOPIC) return t("quiz.randomTopic", RANDOM_TOPIC);
    if (tp === OTHER_TOPIC) return t("quiz.otherTopic", OTHER_TOPIC);
    if (tp === "Tổng hợp nhiều chủ đề") return t("quiz.mixedTopics", tp);
    const key = TOPIC_TRANSLATION_KEYS[tp];
    return key ? t(`studyMaterial.categoriesList.${key}`) : tp;
  };

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  useFocusEffect(
    React.useCallback(() => {
      const controller = new AbortController();
      (async () => {
        try {
          const res = await getQuizLeaderboard("week", { signal: controller.signal });
          if (controller.signal.aborted) return;
          const data = res?.data || res;
          setLeaderboard((data?.leaderboard || []).slice(0, 8));
        } catch (error) {
          // Silent
        }
      })();
      return () => controller.abort();
    }, [])
  );

  const resolvedCount = useCustomCount
    ? Math.max(1, Math.min(MAX_COUNT, parseInt(customCount, 10) || 0))
    : count;

  const handleStart = async () => {
    if (useCustomCount && (!customCount || resolvedCount < 1)) {
      Toast.show({
        type: "error",
        text1: t("quiz.invalidCount", "Vui lòng nhập số câu hỏi hợp lệ (1-{{max}})", {
          max: MAX_COUNT,
        }),
      });
      return;
    }
    if (topic === OTHER_TOPIC && !customTopic.trim()) {
      Toast.show({
        type: "error",
        text1: t("quiz.invalidCustomTopic", "Vui lòng nhập chủ đề bạn muốn"),
      });
      return;
    }

    setLoading(true);
    try {
      const res = await startQuiz(
        resolvedCount,
        difficulty,
        topic,
        grade,
        topic === OTHER_TOPIC ? customTopic.trim() : undefined
      );
      const data = res?.data || res;
      setQuiz(data);
      setAnswers({});
      setFeedback({});
      setCurrentIndex(0);
      setResult(null);
      setPendingResult(null);
      setPhase("taking");
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          apiErrorMessage(error, t("quiz.startError", "Không thể tạo câu hỏi lúc này, vui lòng thử lại.")),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (questionId, letter) => {
    if (!quiz || feedback[questionId] || answering) return;
    setAnswering(true);
    try {
      const res = await answerQuizQuestion(quiz.quiz_set_id, questionId, letter);
      const data = res?.data || res;
      const nextAnswers = { ...answers, [questionId]: letter };
      const nextFeedback = { ...feedback, [questionId]: data };
      setAnswers(nextAnswers);
      setFeedback(nextFeedback);

      if (data.finished) {
        setPendingResult({
          score: data.score,
          total: data.total,
          points: data.points,
          results: (quiz.questions || []).map((q) => ({
            id: q.id,
            your_answer: nextAnswers[q.id] ?? null,
            correct_answer: nextFeedback[q.id]?.correct_answer,
            is_correct: nextFeedback[q.id]?.is_correct,
            explanation: nextFeedback[q.id]?.explanation,
          })),
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          apiErrorMessage(error, t("quiz.answerError", "Không thể ghi nhận câu trả lời, vui lòng thử lại.")),
      });
    } finally {
      setAnswering(false);
    }
  };

  const handleViewResult = () => {
    if (!pendingResult) return;
    setResult(pendingResult);
    setPhase("result");
  };

  const handleRestart = () => {
    setPhase("setup");
    setQuiz(null);
    setResult(null);
    setPendingResult(null);
    setAnswers({});
    setFeedback({});
    setCurrentIndex(0);
  };

  const [retrying, setRetrying] = useState(false);
  const handleRetrySame = async () => {
    if (!quiz?.quiz_set_id || retrying) return;
    setRetrying(true);
    try {
      const res = await restartQuiz(quiz.quiz_set_id);
      const data = res?.data || res;
      setQuiz(data);
      setAnswers({});
      setFeedback({});
      setCurrentIndex(0);
      setResult(null);
      setPendingResult(null);
      setPhase("taking");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: apiErrorMessage(error, t("quiz.restartError", "Không thể làm lại bài đố vui này.")),
      });
    } finally {
      setRetrying(false);
    }
  };

  const answeredCount = quiz ? Object.keys(answers).length : 0;
  const currentQuestion = quiz?.questions?.[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating Transparent Header adhering to design system */}
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
            <LiquidButton
              size={44}
              scrollY={scrollY}
              onPress={() => (phase === "setup" ? navigation.goBack() : handleRestart())}
            >
              <Ionicons name={phase === "setup" ? "chevron-back" : "close"} size={24} color={theme.primary} />
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
            {t("quiz.title", "Đố vui")}
          </Animated.Text>
          <View style={{ width: 44 }}>
            {quiz?.quiz_set_id && (phase === "taking" || phase === "result") && (
              <LiquidButton
                size={44}
                scrollY={scrollY}
                onPress={() => handleShare(quiz.quiz_set_id)}
              >
                <Ionicons name="share-outline" size={20} color={theme.primary} />
              </LiquidButton>
            )}
          </View>
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
        {joiningShared ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: insets.top + 64 }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
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
          >
            {phase === "setup" && (
              <>
                <LinearGradient
                  colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.hero, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
                >
                  <BannerWatermark icon="bulb" size={140} />
                  <View style={[styles.heroIcon, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
                    <Ionicons name="bulb" size={24} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>
                      {t("exploreScreen.trivia")}
                    </Text>
                    <Text style={[styles.heroText, { color: theme.subText }]}>
                      {t("quiz.subtitle", "Trả lời câu hỏi trắc nghiệm do AI tạo ra, thử thách kiến thức của bạn.")}
                    </Text>
                  </View>
                </LinearGradient>

                {/* Setup Card */}
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}>
                  <FieldLabel icon="list" color="#3B82F6" title={t("quiz.questionCount", "Số câu hỏi")} theme={theme} isDarkMode={isDarkMode} />
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
                          activeOpacity={0.8}
                          style={[
                            styles.chip,
                            { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : isDarkMode ? "#282B34" : "#E2E8F0" },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.chipText, { color: active ? "#fff" : theme.text }]}
                          >
                            {c} {t("quiz.questionsUnit", "câu")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      onPress={() => setUseCustomCount(true)}
                      activeOpacity={0.8}
                      style={[
                        styles.chip,
                        { backgroundColor: useCustomCount ? theme.primary : theme.surface, borderColor: useCustomCount ? theme.primary : isDarkMode ? "#282B34" : "#E2E8F0" },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.chipText, { color: useCustomCount ? "#fff" : theme.text }]}
                      >
                        {t("quiz.custom", "Tùy chỉnh")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {useCustomCount && (
                    <TextInput
                      value={customCount}
                      onChangeText={setCustomCount}
                      keyboardType="number-pad"
                      placeholder={t("quiz.customPlaceholder", "Nhập số câu (1-{{max}})", { max: MAX_COUNT })}
                      placeholderTextColor={theme.subText}
                      style={[
                        styles.input,
                        { color: theme.text, borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.background },
                      ]}
                    />
                  )}

                  <FieldLabel icon="bookmark" color="#8B5CF6" title={t("quiz.topicLabel", "Chủ đề")} theme={theme} isDarkMode={isDarkMode} style={{ marginTop: 18 }} />
                  <View style={styles.chipRow}>
                    {[RANDOM_TOPIC, ...topics, OTHER_TOPIC].map((tp) => {
                      const active = topic === tp;
                      return (
                        <TouchableOpacity
                          key={tp}
                          onPress={() => setTopic(tp)}
                          activeOpacity={0.8}
                          style={[
                            styles.chip,
                            { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : isDarkMode ? "#282B34" : "#E2E8F0" },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.chipText, { color: active ? "#fff" : theme.text }]}
                          >
                            {getTopicLabel(tp)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {topic === OTHER_TOPIC && (
                    <TextInput
                      value={customTopic}
                      onChangeText={setCustomTopic}
                      placeholder={t(
                        "quiz.customTopicPlaceholder",
                        "Nhập chủ đề bạn muốn (VD: Bóng đá, Âm nhạc...)"
                      )}
                      placeholderTextColor={theme.subText}
                      maxLength={256}
                      style={[
                        styles.input,
                        { color: theme.text, borderColor: isDarkMode ? "#282B34" : "#E2E8F0", backgroundColor: theme.background },
                      ]}
                    />
                  )}

                  <FieldLabel icon="school" color="#F59E0B" title={t("quiz.gradeLabel", "Lớp")} theme={theme} isDarkMode={isDarkMode} style={{ marginTop: 18 }} />
                  <View style={styles.chipRow}>
                    {GRADES.map((g) => {
                      const active = grade === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          onPress={() => setGrade(g)}
                          activeOpacity={0.8}
                          style={[
                            styles.chip,
                            { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : isDarkMode ? "#282B34" : "#E2E8F0" },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.chipText, { color: active ? "#fff" : theme.text }]}
                          >
                            {t(`quiz.grade_${g}`, `Lớp ${g}`)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <FieldLabel icon="speedometer" color="#EF4444" title={t("quiz.difficulty", "Độ khó")} theme={theme} isDarkMode={isDarkMode} style={{ marginTop: 18 }} />
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

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: 20 }]}
                    onPress={handleStart}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="sparkles" size={18} color="#fff" />
                    )}
                    <Text style={styles.primaryButtonText}>
                      {loading ? t("quiz.generating", "Đang tạo câu hỏi...") : t("quiz.start", "Bắt đầu")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Quiz Shortcut Card */}
                <TouchableOpacity
                  style={[
                    styles.customQuizCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("CustomQuizCreateScreen")}
                >
                  <View style={[styles.customQuizIcon, { backgroundColor: tint("#EC4899", isDarkMode) }]}>
                    <Ionicons name="create" size={20} color="#EC4899" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.customQuizTitle, { color: theme.text }]}>
                      {t("customQuiz.entryTitle", "Tạo bộ đề tùy chỉnh")}
                    </Text>
                    <Text style={[styles.customQuizSubtitle, { color: theme.subText }]} numberOfLines={1}>
                      {t("customQuiz.entrySubtitle", "Tự soạn câu hỏi từ văn bản hoặc file .docx/.txt/.pdf")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.subText} />
                </TouchableOpacity>

                {/* Leaderboard Section */}
                {leaderboard.length > 0 && (
                  <View style={styles.sectionWrap}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 4 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: tint("#F59E0B", isDarkMode), alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                        <Ionicons name="trophy" size={14} color="#F59E0B" />
                      </View>
                      <Text style={[styles.sectionTitle, { color: theme.subText, marginBottom: 0, marginLeft: 0 }]}>
                        {t("quiz.leaderboard", "Bảng xếp hạng đố vui")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.cardGroup,
                        { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" },
                      ]}
                    >
                      {leaderboard.map((u, i, arr) => (
                        <TouchableOpacity
                          key={u.id || i}
                          activeOpacity={0.7}
                          onPress={() => navigation.navigate("ProfileScreen", { username: u.username })}
                          style={[
                            styles.rowItem,
                            i < arr.length - 1 && {
                              borderBottomColor: theme.border,
                              borderBottomWidth: StyleSheet.hairlineWidth,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.rankHolder,
                              i === 0 && styles.rank1,
                              i === 1 && styles.rank2,
                              i === 2 && styles.rank3,
                            ]}
                          >
                            <Text
                              style={[
                                styles.rankNum,
                                i < 3 ? { color: "#fff", fontWeight: "800" } : { color: theme.subText },
                              ]}
                            >
                              {i + 1}
                            </Text>
                          </View>
                          <AvatarFrameWrap theme={u.profile_theme} size={36} style={{ marginRight: 12 }}>
                            <FastImage
                              source={{
                                uri:
                                  u.avatar_url ||
                                  `https://api.chuyenbienhoa.com/v1.0/users/${u.username}/avatar`,
                              }}
                              style={styles.avatar}
                            />
                          </AvatarFrameWrap>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <UserNameRow
                              name={u.profile_name || u.username}
                              theme={u.profile_theme}
                              style={{ fontSize: 15, fontWeight: "600", color: theme.text }}
                            />
                          </View>
                          <Text style={[styles.xpText, { color: theme.primary }]}>
                            {u.points} {t("quiz.pointsUnit", "điểm")}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
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
                    <Text style={[styles.topicValue, { color: theme.text }]}>
                      {getTopicLabel(quiz.topic)}
                    </Text>
                  </View>
                  <Text style={[styles.answeredCount, { color: theme.subText }]}>
                    {t("quiz.answeredCount", "Đã trả lời {{answered}}/{{total}}", {
                      answered: answeredCount,
                      total: quiz.question_count,
                    })}
                  </Text>
                </View>

                {/* Progress bar */}
                <View style={[styles.progressTrack, { backgroundColor: theme.iconBackground }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${Math.round((answeredCount / quiz.question_count) * 100)}%`,
                      },
                    ]}
                  />
                </View>

                {/* Question Card */}
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}>
                  <Text style={[styles.questionIndex, { color: theme.primary }]}>
                    {t("quiz.questionIndex", "Câu {{current}}/{{total}}", {
                      current: currentIndex + 1,
                      total: quiz.question_count,
                    })}
                  </Text>
                  <Text style={[styles.questionText, { color: theme.text }]}>
                    {currentQuestion.question}
                  </Text>
                  <View style={{ gap: 10 }}>
                    {currentQuestion.options.map((opt) => {
                      const letter = opt.trim().charAt(0);
                      const selected = answers[currentQuestion.id] === letter;
                      const currentFeedback = feedback[currentQuestion.id];
                      const isCorrectOption =
                        currentFeedback && letter === currentFeedback.correct_answer;
                      const isWrongSelected =
                        currentFeedback && selected && !currentFeedback.is_correct;

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

                      const optionText = opt.trim().replace(/^[A-Za-z]\s*[.)-]\s*/, "");
                      const badgeFilled = selected || isCorrectOption || isWrongSelected;

                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => handleSelect(currentQuestion.id, letter)}
                          disabled={!!currentFeedback || answering}
                          activeOpacity={0.7}
                          style={[styles.optionRow, { backgroundColor: bg, borderColor: border }]}
                        >
                          <View
                            style={[
                              styles.optionBadge,
                              {
                                backgroundColor: badgeFilled ? textColor : "transparent",
                                borderColor: badgeFilled ? textColor : theme.subText,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionBadgeText,
                                { color: badgeFilled ? "#fff" : theme.subText },
                              ]}
                            >
                              {letter}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.optionText,
                              { color: textColor, fontWeight: selected || isCorrectOption ? "700" : "500" },
                            ]}
                          >
                            {optionText}
                          </Text>
                          {isCorrectOption && (
                            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                          )}
                          {isWrongSelected && (
                            <Ionicons name="close-circle" size={20} color="#e53935" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {feedback[currentQuestion.id]?.explanation && (
                    <View
                      style={[
                        styles.explanationBox,
                        { backgroundColor: theme.iconBackground, borderColor: theme.border },
                      ]}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.primary} style={{ marginTop: 1 }} />
                      <Text style={[styles.explanationText, { color: theme.subText }]}>
                        {feedback[currentQuestion.id].explanation}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Navigation Row */}
                <View style={styles.navRow}>
                  <TouchableOpacity
                    onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                    style={[
                      styles.navButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderWidth: 1,
                        opacity: currentIndex === 0 ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>
                      {t("quiz.prevQuestion", "Câu trước")}
                    </Text>
                  </TouchableOpacity>
                  {currentIndex < quiz.question_count - 1 ? (
                    <TouchableOpacity
                      onPress={() => setCurrentIndex((i) => Math.min(quiz.question_count - 1, i + 1))}
                      disabled={!feedback[currentQuestion.id]}
                      style={[
                        styles.navButtonPrimary,
                        { backgroundColor: theme.primary, opacity: !feedback[currentQuestion.id] ? 0.4 : 1 },
                      ]}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
                        {t("quiz.nextQuestion", "Câu tiếp theo")}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={handleViewResult}
                      disabled={!pendingResult}
                      style={[
                        styles.navButtonPrimary,
                        { backgroundColor: theme.primary, opacity: !pendingResult ? 0.4 : 1 },
                      ]}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
                        {t("quiz.viewResult", "Xem kết quả")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dots indicator row */}
                <View style={styles.dotsRow}>
                  {(quiz.questions || []).map((q, i) => {
                    const isCurrent = i === currentIndex;
                    const qFeedback = feedback[q.id];
                    let dotBg = theme.surface;
                    let dotBorder = theme.border;
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
                        style={[
                          styles.dot,
                          { backgroundColor: dotBg, borderColor: dotBorder },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: dotTextColor }}>{i + 1}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {phase === "result" && result && quiz && (() => {
              const score = Math.max(0, Number(result.score) || 0);
              const total = Math.max(1, Number(result.total) || 1);
              const wrong = Math.max(0, total - score);
              const percent = Math.round((score / total) * 100);
              const correctRatio = score / total;
              const wrongRatio = wrong / total;
              const size = 144;
              const strokeWidth = 9;
              const center = size / 2;
              const radius = (size - strokeWidth) / 2;
              const circumference = 2 * Math.PI * radius;
              const correctColor = theme.primary || "#319527";
              const wrongColor = "#ef4444";
              const trackColor = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
              const gap = Math.min(8, (circumference * Math.min(correctRatio, wrongRatio)) / 3);
              const correctLength = Math.max(1, correctRatio * circumference - gap);
              const wrongLength = Math.max(1, wrongRatio * circumference - gap);

              return (
                <View>
                  <View
                    style={[
                      styles.card,
                      styles.resultCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.resultLabel, { color: theme.subText }]}>
                      {t("quiz.result", "Kết quả")}
                    </Text>
                    <View style={styles.resultRingWrapper}>
                      <Svg width={size} height={size}>
                        <Circle
                          cx={center}
                          cy={center}
                          r={radius}
                          stroke={trackColor}
                          strokeWidth={strokeWidth}
                          fill="none"
                        />
                        <G rotation="-90" origin={`${center}, ${center}`}>
                          {score === total ? (
                            <Circle
                              cx={center}
                              cy={center}
                              r={radius}
                              stroke={correctColor}
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${circumference} ${circumference}`}
                              fill="none"
                            />
                          ) : score === 0 ? (
                            <Circle
                              cx={center}
                              cy={center}
                              r={radius}
                              stroke={wrongColor}
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${circumference} ${circumference}`}
                              fill="none"
                            />
                          ) : (
                            <>
                              <Circle
                                cx={center}
                                cy={center}
                                r={radius}
                                stroke={correctColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${correctLength} ${circumference}`}
                                strokeDashoffset={0}
                                strokeLinecap="round"
                                fill="none"
                              />
                              <Circle
                                cx={center}
                                cy={center}
                                r={radius}
                                stroke={wrongColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${wrongLength} ${circumference}`}
                                strokeDashoffset={-(correctRatio * circumference)}
                                strokeLinecap="round"
                                fill="none"
                              />
                            </>
                          )}
                        </G>
                      </Svg>
                      <View style={styles.resultRingCenter}>
                        <Text style={[styles.resultScore, { color: percent >= 50 ? correctColor : wrongColor }]}>
                          {score}/{total}
                        </Text>
                        <Text style={[styles.resultPercent, { color: theme.subText }]}>
                          {percent}%
                        </Text>
                        {total > 0 && (
                          <View style={styles.resultBreakdownRow}>
                            <Text style={[styles.resultBreakdownText, { color: correctColor }]}>
                              ✓ {score}
                            </Text>
                            {wrong > 0 && (
                              <Text style={[styles.resultBreakdownText, { color: wrongColor }]}>
                                ✗ {wrong}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    {result.points != null && (
                      <View style={[styles.pointsBadge, { backgroundColor: `${theme.primary}1A` }]}>
                        <Ionicons name="sparkles" size={14} color={theme.primary} />
                        <Text style={[styles.resultPoints, { color: theme.primary }]}>
                          {t("quiz.pointsEarned", "+{{points}} điểm", { points: result.points })}
                        </Text>
                      </View>
                    )}

                    <Text style={[styles.resultTopic, { color: theme.subText }]}>
                      {t("quiz.topicResult", "Chủ đề: {{topic}}", { topic: getTopicLabel(quiz.topic) })}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.actionButtonHalf,
                          {
                            borderColor: theme.border,
                            borderWidth: 1,
                            backgroundColor: theme.background,
                            opacity: retrying ? 0.6 : 1,
                          },
                        ]}
                        onPress={handleRetrySame}
                        disabled={retrying}
                        activeOpacity={0.8}
                      >
                        {retrying ? (
                          <ActivityIndicator size="small" color={theme.text} />
                        ) : (
                          <Ionicons name="refresh" size={16} color={theme.text} />
                        )}
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>
                          {t("quiz.retrySame", "Làm lại bài này")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButtonHalf, { backgroundColor: theme.primary }]}
                        onPress={handleRestart}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="sparkles" size={16} color="#fff" />
                        <Text style={[styles.actionButtonText, { color: "#fff" }]}>
                          {t("quiz.restart", "Làm bài mới")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={[styles.sectionTitle, { color: theme.subText, marginTop: 12 }]}>
                    {t("quiz.reviewQuestions", "Chi tiết câu hỏi")}
                  </Text>

                  {(quiz.questions || []).map((q) => {
                    const r = result.results?.find((item) => item.id === q.id);
                    if (!r) return null;
                    return (
                      <View
                        key={q.id}
                        style={[
                          styles.card,
                          styles.resultQuestionCard,
                          { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                      >
                        <View style={styles.resultQuestionHeader}>
                          <Ionicons
                            name={r.is_correct ? "checkmark-circle" : "close-circle"}
                            size={20}
                            color={r.is_correct ? theme.primary : "#e53935"}
                          />
                          <Text style={[styles.resultQuestionText, { color: theme.text }]}>
                            {q.question}
                          </Text>
                        </View>
                        <View style={{ paddingLeft: 28, gap: 4 }}>
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
                            <View
                              style={[
                                styles.explanationBox,
                                { backgroundColor: theme.iconBackground, borderColor: theme.border, marginTop: 6 },
                              ]}
                            >
                              <Text style={[styles.explanationText, { color: theme.subText }]}>
                                {r.explanation}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </Animated.ScrollView>
        )}
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
  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 18, fontWeight: "800" },
  heroText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  chipText: { fontSize: 13, fontWeight: "600", includeFontPadding: false, paddingRight: 1 },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    marginTop: 10,
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    padding: 14,
  },
  primaryButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  customQuizCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 14,
    marginBottom: 20,
  },
  customQuizIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  customQuizTitle: { fontSize: 15, fontWeight: "600" },
  customQuizSubtitle: { fontSize: 12, marginTop: 2 },
  sectionWrap: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardGroup: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  rankHolder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rank1: { backgroundColor: "#EAB308" },
  rank2: { backgroundColor: "#94A3B8" },
  rank3: { backgroundColor: "#D97706" },
  rankNum: { fontSize: 12, textAlign: "center" },
  xpText: { fontSize: 14, fontWeight: "700", marginLeft: 8 },
  takingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
    marginHorizontal: 4,
  },
  topicLabel: { fontSize: 11, fontWeight: "500", textTransform: "uppercase" },
  topicValue: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  answeredCount: { fontSize: 13 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 16 },
  progressFill: { height: "100%", borderRadius: 3 },
  questionIndex: { fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" },
  questionText: { fontSize: 16, fontWeight: "700", lineHeight: 22, marginBottom: 16 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBadgeText: { fontSize: 13, fontWeight: "700" },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  explanationBox: {
    flexDirection: "row",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  explanationText: { flex: 1, fontSize: 13, lineHeight: 18 },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 16 },
  navButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonPrimary: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultCard: { alignItems: "center", paddingVertical: 20 },
  resultLabel: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  resultRingWrapper: {
    width: 144,
    height: 144,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    position: "relative",
  },
  resultRingCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  resultScore: { fontSize: 32, fontWeight: "800" },
  resultPercent: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  resultBreakdownRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  resultBreakdownText: { fontSize: 12, fontWeight: "700" },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  resultPoints: { fontSize: 13, fontWeight: "700" },
  resultTopic: { fontSize: 13, marginBottom: 14 },
  actionButtonHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 12,
  },
  actionButtonText: { fontSize: 14, fontWeight: "bold" },
  resultQuestionCard: { padding: 14, marginBottom: 12 },
  resultQuestionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  resultQuestionText: { flex: 1, fontSize: 15, fontWeight: "600", lineHeight: 20 },
  resultOption: { fontSize: 13, paddingVertical: 2 },
});

export default QuizScreen;
