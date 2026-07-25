import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DatePicker from "react-native-date-picker";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import LiquidButton from "../../../components/LiquidButton";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";

const STEPS = [
  { id: 1, titleKey: "report.step1" },
  { id: 2, titleKey: "report.step2" },
  { id: 3, titleKey: "report.step3" },
];

function StepIndicator({ currentStep, theme, isDarkMode, t }) {
  return (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor:
                    step.id <= currentStep
                      ? theme.primary
                      : isDarkMode
                      ? "#374151"
                      : "#E5E5E5",
                },
              ]}
            >
              {step.id < currentStep ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.stepNumberText,
                    {
                      color:
                        step.id <= currentStep ? "#fff" : theme.subText,
                    },
                  ]}
                >
                  {step.id}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepText,
                {
                  color:
                    step.id <= currentStep ? theme.primary : theme.subText,
                },
              ]}
            >
              {t(step.titleKey)}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    step.id < currentStep
                      ? theme.primary
                      : isDarkMode
                      ? "#374151"
                      : "#E5E5E5",
                },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function SuggestionItem({ item, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
      onPress={() => onPress(item)}
    >
      <Text style={[styles.suggestionText, { color: theme.text }]}>{item}</Text>
    </TouchableOpacity>
  );
}

function SelectedTag({ tag, onRemove, theme, isDarkMode }) {
  return (
    <View
      style={[
        styles.selectedTag,
        {
          backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1",
          borderColor: theme.primary,
        },
      ]}
    >
      <Text style={[styles.selectedTagText, { color: theme.primary }]}>
        {tag}
      </Text>
      <TouchableOpacity onPress={() => onRemove(tag)}>
        <Ionicons name="close-circle" size={18} color={theme.subText} />
      </TouchableOpacity>
    </View>
  );
}

export default function Step2({ navigation, route }) {
  const { violationType: selectedViolationType } = route.params;
  const [className, setClassName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reportDate, setReportDate] = useState(new Date());
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const [violationType, setViolationType] = useState("");
  const [notes, setNotes] = useState("");
  const [absences, setAbsences] = useState("");
  const [cleanliness, setCleanliness] = useState("");
  const [uniform, setUniform] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");
  const { t } = useTranslation();
  const bottomSheetRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 64 + insets.top;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const STUDENT_VIOLATION_TYPES = t("report.studentViolationTypes", {
    returnObjects: true,
  });
  const CLASS_VIOLATION_TYPES = t("report.classViolationTypes", {
    returnObjects: true,
  });
  const CLEANLINESS_STATUS = t("report.cleanliness", { returnObjects: true });
  const UNIFORM_STATUS = t("report.uniformStatus", { returnObjects: true });

  const formatDate = (date) =>
    date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleTextChange = (text) => {
    setTagInput(text);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    const mockSuggestions = t("report.mockViolations", {
      returnObjects: true,
    }).filter((item) => item.toLowerCase().includes(text.toLowerCase()));
    setSuggestions(mockSuggestions);
  };

  const handleAddTag = (tag) => {
    setSelectedTags([tag]);
    setTagInput("");
    setViolationType(tag);
    setSuggestions([]);
    bottomSheetRef.current?.close();
  };

  const handleRemoveTag = () => {
    setSelectedTags([]);
    setViolationType("");
  };

  const handleShowTagInput = () => {
    bottomSheetRef.current?.snapToIndex(0);
  };

  const handleSubmit = () => {
    navigation.navigate("Step3", {
      studentName: selectedViolationType === "class" ? className : studentName,
      reportDate: formatDate(reportDate),
      violationType: selectedTags[0] || violationType,
      notes,
      absences: absences || "0",
      cleanliness,
      uniform,
    });
  };

  const isFormValid = () => {
    if (selectedViolationType === "class") {
      return Boolean(className && violationType && cleanliness && uniform);
    }
    return Boolean(studentName && violationType);
  };

  const renderViolationTypes = () => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: theme.subText }]}>
        {t("report.violationType")}
      </Text>
      <View style={styles.chipsRow}>
        {(selectedViolationType === "class"
          ? CLASS_VIOLATION_TYPES
          : STUDENT_VIOLATION_TYPES
        ).map((type) => {
          const isOtherSelected =
            type === t("common.other") && selectedTags.length > 0;
          const isSelected = isOtherSelected || violationType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? isDarkMode
                      ? "#064e3b"
                      : "#F3FDF1"
                    : isDarkMode
                    ? "rgba(255,255,255,0.06)"
                    : "#F1F5F9",
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => {
                if (type === t("common.other")) {
                  handleShowTagInput();
                } else {
                  setViolationType(type);
                  setSelectedTags([]);
                }
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? theme.primary : theme.subText },
                  isSelected && { fontWeight: "600" },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedTags.length > 0 && (
        <View style={styles.selectedTagsPreview}>
          <SelectedTag
            tag={selectedTags[0]}
            onRemove={handleRemoveTag}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </View>
      )}
    </View>
  );

  const renderStudentForm = () => (
    <>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>
          {t("report.studentName")}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#fff",
              borderColor: theme.border,
            },
          ]}
          placeholder={t("report.studentNamePlaceholder")}
          placeholderTextColor={theme.subText}
          value={studentName}
          onChangeText={setStudentName}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>
          {t("report.reportTime")}
        </Text>
        <TouchableOpacity
          style={[
            styles.dateInput,
            {
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#fff",
              borderColor: theme.border,
            },
          ]}
          onPress={() => setOpenDatePicker(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={theme.subText}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formatDate(reportDate)}
          </Text>
        </TouchableOpacity>
        <DatePicker
          modal
          open={openDatePicker}
          date={reportDate}
          onConfirm={(date) => {
            setOpenDatePicker(false);
            setReportDate(date);
          }}
          onCancel={() => setOpenDatePicker(false)}
        />
      </View>

      {renderViolationTypes()}
    </>
  );

  const renderClassForm = () => (
    <>
      <View style={[styles.sectionCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "#F8FAFC", borderColor: theme.border }]}>
        <Text style={[styles.sectionCardTitle, { color: theme.primary }]}>
          {t("report.classInfo")}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.subText }]}>
            {t("report.className")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#fff",
                borderColor: theme.border,
              },
            ]}
            value={className}
            onChangeText={setClassName}
            placeholder={t("report.classNamePlaceholder")}
            placeholderTextColor={theme.subText}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.subText }]}>
            {t("report.absentStudents")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#fff",
                borderColor: theme.border,
              },
            ]}
            value={absences}
            onChangeText={setAbsences}
            placeholder="0"
            placeholderTextColor={theme.subText}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.subText }]}>
            {t("report.hygiene")}
          </Text>
          <View style={styles.chipsRow}>
            {CLEANLINESS_STATUS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      cleanliness === status
                        ? isDarkMode
                          ? "#064e3b"
                          : "#F3FDF1"
                        : isDarkMode
                        ? "rgba(255,255,255,0.06)"
                        : "#F1F5F9",
                    borderColor:
                      cleanliness === status ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setCleanliness(status)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        cleanliness === status ? theme.primary : theme.subText,
                    },
                    cleanliness === status && { fontWeight: "600" },
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.subText }]}>
            {t("report.uniform")}
          </Text>
          <View style={styles.chipsRow}>
            {UNIFORM_STATUS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      uniform === status
                        ? isDarkMode
                          ? "#064e3b"
                          : "#F3FDF1"
                        : isDarkMode
                        ? "rgba(255,255,255,0.06)"
                        : "#F1F5F9",
                    borderColor:
                      uniform === status ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setUniform(status)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        uniform === status ? theme.primary : theme.subText,
                    },
                    uniform === status && { fontWeight: "600" },
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {renderViolationTypes()}
    </>
  );

  return (
    <>
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior="padding"
    >
      {/* Floating header */}
      <View
        pointerEvents="box-none"
        style={[styles.floatingHeader, { height: headerHeight }]}
      >
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 8,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton
              size={44}
              scrollY={scrollY}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: titleOpacity }]}
            numberOfLines={1}
          >
            {t("report.createReport")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingHorizontal: 16,
          paddingBottom: 24 + (insets.bottom || 0),
        }}
      >


        {/* Gradient info card */}
        <LinearGradient
          colors={
            isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.gradientTitle}>
              {t("report.reportViolation")}
            </Text>
            <Text style={styles.gradientSubtitle}>{t("report.schoolName")}</Text>
          </View>
          <View style={styles.gradientIconWrap}>
            <Ionicons name="warning" size={28} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Step indicator */}
        <StepIndicator
          currentStep={2}
          theme={theme}
          isDarkMode={isDarkMode}
          t={t}
        />

        <Text style={[styles.contentTitle, { color: theme.text }]}>
          {t("report.step2Title")}
        </Text>
        <Text style={[styles.contentSubtitle, { color: theme.subText }]}>
          {t("report.step2Subtitle")}
        </Text>

        {selectedViolationType === "class"
          ? renderClassForm()
          : renderStudentForm()}

        {/* Notes */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.subText }]}>
            {t("report.notes")}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.notesInput,
              {
                color: theme.text,
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#fff",
                borderColor: theme.border,
              },
            ]}
            placeholder={t("report.notesPlaceholder")}
            placeholderTextColor={theme.subText}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>
      </Animated.ScrollView>

      {/* Continue button */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: 16 + (insets.bottom || 0),
            backgroundColor: theme.background,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: theme.primary,
              opacity: isFormValid() ? 1 : 0.5,
            },
          ]}
          disabled={!isFormValid()}
          onPress={handleSubmit}
        >
          <Text style={styles.continueButtonText}>{t("report.continue")}</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>

      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={["90%"]}
        enableDynamicSizing={false}
        index={-1}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{ backgroundColor: theme.cardBackground }}
        handleIndicatorStyle={{ backgroundColor: theme.border }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            pressBehavior="close"
          />
        )}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheetContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {t("report.addOtherViolation")}
            </Text>

            <View style={styles.selectedTagsContainer}>
              {selectedTags.map((tag) => (
                <SelectedTag
                  key={tag}
                  tag={tag}
                  onRemove={handleRemoveTag}
                  theme={theme}
                  isDarkMode={isDarkMode}
                />
              ))}
            </View>

            <View style={styles.searchContainer}>
              <BottomSheetTextInput
                style={[
                  styles.searchInput,
                  {
                    color: theme.text,
                    backgroundColor: isDarkMode ? "#1f2937" : "#fff",
                    borderColor: theme.border,
                  },
                ]}
                placeholder={t("report.searchViolation")}
                placeholderTextColor={theme.subText}
                value={tagInput}
                onChangeText={handleTextChange}
                maxLength={100}
              />
              {loading && (
                <ActivityIndicator
                  style={styles.loadingIndicator}
                  color={theme.primary}
                />
              )}
            </View>

            {suggestions.length > 0 && (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <SuggestionItem
                    item={item}
                    onPress={handleAddTag}
                    theme={theme}
                  />
                )}
                style={styles.suggestionsList}
                scrollEnabled={false}
                keyboardShouldPersistTaps="handled"
              />
            )}

            <TouchableOpacity
              style={[
                styles.addCustomButton,
                {
                  backgroundColor: theme.primary,
                  opacity: tagInput.length > 0 ? 1 : 0.5,
                },
              ]}
              disabled={tagInput.length === 0}
              onPress={() => handleAddTag(tagInput)}
            >
              <Text style={styles.addCustomButtonText}>
                {t("report.addNewViolation")}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  gradientCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    padding: 20,
    marginBottom: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  gradientTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  gradientSubtitle: { fontSize: 13, color: "#C7F5D7" },
  gradientIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
  },
  stepItem: { alignItems: "center", flex: 1 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepNumberText: { fontSize: 14, fontWeight: "700" },
  stepText: { fontSize: 11, textAlign: "center", fontWeight: "500" },
  stepLine: { height: 2, flex: 0.5, marginHorizontal: -8, borderRadius: 1 },
  contentTitle: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  contentSubtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionCardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  inputContainer: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
  },
  dateText: { fontSize: 15 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 13 },
  selectedTagsPreview: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 },
  notesInput: { height: 110, textAlignVertical: "top" },
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 30,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  continueButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sheetContent: { borderRadius: 20, padding: 4 },
  sheetTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  selectedTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 8,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 4,
  },
  selectedTagText: { fontSize: 14 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  loadingIndicator: { position: "absolute", right: 12 },
  suggestionsList: {},
  suggestionItem: { padding: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { fontSize: 15 },
  addCustomButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  addCustomButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
