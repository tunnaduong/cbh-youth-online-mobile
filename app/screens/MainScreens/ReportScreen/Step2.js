import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import DatePicker from "react-native-date-picker";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import ReportHeader from "../../../components/ReportHeader";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const SuggestionItem = ({ item, onPress }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: theme.border }]} onPress={() => onPress(item)}>
      <Text style={[styles.suggestionText, { color: theme.text }]}>{item}</Text>
    </TouchableOpacity>
  );
};

const SelectedTag = ({ tag, onRemove }) => {
  const { theme, isDarkMode } = useTheme();
  return (
    <View style={[styles.selectedTag, { backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1", borderColor: theme.primary }]}>
      <Text style={[styles.selectedTagText, { color: theme.primary }]}>{tag}</Text>
      <TouchableOpacity onPress={() => onRemove(tag)}>
        <Ionicons name="close-circle" size={18} color={theme.subText} />
      </TouchableOpacity>
    </View>
  );
};

const TagInput = ({
  tagInput,
  onChangeText,
  selectedTags,
  onRemoveTag,
  suggestions,
  loading,
  onAddTag,
}) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  return (
    <KeyboardAvoidingView behavior={"padding"} keyboardVerticalOffset={110}>
      <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{t('report.addOtherViolation')}</Text>
        </View>

        <View style={styles.selectedTagsContainer}>
          {selectedTags.map((tag) => (
            <SelectedTag key={tag} tag={tag} onRemove={onRemoveTag} />
          ))}
        </View>

        <View style={styles.searchContainer}>
          <BottomSheetTextInput
            style={[styles.searchInput, { color: theme.text, backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: theme.border }]}
            placeholder={t('report.searchViolation')}
            placeholderTextColor={theme.subText}
            value={tagInput}
            onChangeText={onChangeText}
            maxLength={100}
          />
          {loading && (
            <ActivityIndicator style={styles.loadingIndicator} color={theme.primary} />
          )}
        </View>

        {suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <SuggestionItem item={item} onPress={onAddTag} />
            )}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={10}
          />
        )}

        <TouchableOpacity
          style={[
            styles.addCustomButton,
            { backgroundColor: theme.primary, opacity: tagInput.length > 0 ? 1 : 0.5 },
          ]}
          disabled={tagInput.length === 0}
          onPress={() => onAddTag(tagInput)}
        >
          <Text style={styles.addCustomButtonText}>{t('report.addNewViolation')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

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
  const { t } = useTranslation();
  const bottomSheetRef = useRef(null);

  const STEPS = [
    { id: 1, titleKey: "report.step1" },
    { id: 2, titleKey: "report.step2" },
    { id: 3, titleKey: "report.step3" },
  ];

  const STUDENT_VIOLATION_TYPES = t('report.studentViolationTypes', { returnObjects: true });
  const CLASS_VIOLATION_TYPES = t('report.classViolationTypes', { returnObjects: true });
  const CLEANLINESS_STATUS = t('report.cleanliness', { returnObjects: true });
  const UNIFORM_STATUS = t('report.uniformStatus', { returnObjects: true });

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor: step.id <= 2 ? theme.primary : (isDarkMode ? "#374151" : "#E5E5E5"),
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  { color: step.id <= 2 ? "#fff" : theme.subText },
                ]}
              >
                {step.id}
              </Text>
            </View>
            <Text
              style={[
                styles.stepText,
                { color: step.id <= 2 ? theme.primary : theme.subText },
              ]}
            >
              {t(step.titleKey)}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: index === 0 ? theme.primary : (isDarkMode ? "#374151" : "#E5E5E5") },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const handleDateChange = (selectedDate) => {
    setReportDate(selectedDate);
  };

  const formatDate = (date) => {
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleTextChange = (text) => {
    setTagInput(text);

    if (!text.trim()) {
      setSuggestions([]);
      return;
    }

    // Mock suggestions based on query
    const mockSuggestions = t('report.mockViolations', { returnObjects: true }).filter((item) => item.toLowerCase().includes(text.toLowerCase()));

    setSuggestions(mockSuggestions);
  };

  const handleAddTag = (tag) => {
    setSelectedTags([tag]); // Only keep one tag
    setTagInput("");
    setViolationType(tag);
    setSuggestions([]);
    bottomSheetRef.current?.close();
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags([]);
    setViolationType("");
  };

  const renderViolationTypes = () => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: theme.subText }]}>{t('report.violationType')}</Text>
      <View style={styles.violationTypesContainer}>
        {(selectedViolationType === "class"
          ? CLASS_VIOLATION_TYPES
          : STUDENT_VIOLATION_TYPES
        ).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.violationTypeChip,
              { borderColor: theme.border },
              (type === t('common.other') && selectedTags.length > 0) ||
                violationType === type
                ? [styles.selectedViolationType, { backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1", borderColor: theme.primary }]
                : null,
            ]}
            onPress={() => {
              if (type === t('common.other')) {
                handleShowTagInput();
              } else {
                setViolationType(type);
                setSelectedTags([]);
              }
            }}
          >
            <Text
              style={[
                styles.violationTypeText,
                { color: theme.subText },
                (type === t('common.other') && selectedTags.length > 0) ||
                  violationType === type
                  ? [styles.selectedViolationTypeText, { color: theme.primary }]
                  : null,
              ]}
            >
              {type === t('common.other') && selectedTags.length > 0 ? t('common.other') : type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedTags.length > 0 && (
        <View style={styles.selectedTagsPreview}>
          <View style={[styles.selectedTagPreviewItem, { backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1", borderColor: theme.primary }]}>
            <Text style={[styles.selectedTagPreviewText, { color: theme.primary }]}>{selectedTags[0]}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderDateInput = () => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: theme.subText }]}>{t('report.reportTime')}</Text>
      <View style={[styles.dateInput, { borderColor: theme.border, backgroundColor: isDarkMode ? "#1f2937" : "#fff" }]}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={theme.subText}
          style={styles.dateIcon}
        />
        <Text style={[styles.dateText, { color: theme.text }]}>{formatDate(reportDate)}</Text>
      </View>
    </View>
  );

  const renderStudentForm = () => (
    <>
      {/* Student Name Input */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>{t('report.studentName')}</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: theme.border }]}
          placeholder={t('report.studentNamePlaceholder')}
          placeholderTextColor={theme.subText}
          value={studentName}
          onChangeText={setStudentName}
        />
      </View>

      {renderDateInput()}

      {renderViolationTypes()}
    </>
  );

  const renderClassForm = () => (
    <View style={styles.formSection}>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('report.classInfo')}</Text>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>{t('report.className')}</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: theme.border }]}
          value={className}
          onChangeText={setClassName}
          placeholder={t('report.classNamePlaceholder')}
          placeholderTextColor={theme.subText}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>{t('report.absentStudents')}</Text>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: theme.border }]}
          value={absences}
          onChangeText={setAbsences}
          placeholder="0"
          placeholderTextColor={theme.subText}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>{t('report.hygiene')}</Text>
        <View style={styles.optionsContainer}>
          {CLEANLINESS_STATUS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.optionButton,
                { borderColor: theme.border },
                cleanliness === status && [styles.selectedOption, { backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1", borderColor: theme.primary }],
              ]}
              onPress={() => setCleanliness(status)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: theme.subText },
                  cleanliness === status && [styles.selectedOptionText, { color: theme.primary }],
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.subText }]}>{t('report.uniform')}</Text>
        <View style={styles.optionsContainer}>
          {UNIFORM_STATUS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.optionButton,
                { borderColor: theme.border },
                uniform === status && [styles.selectedOption, { backgroundColor: isDarkMode ? "#064e3b" : "#F3FDF1", borderColor: theme.primary }],
              ]}
              onPress={() => setUniform(status)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: theme.subText },
                  uniform === status && [styles.selectedOptionText, { color: theme.primary }],
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {renderViolationTypes()}
    </View>
  );

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

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      

      {/* Header */}
      <ReportHeader navigation={navigation} title={t('report.createReport')} />

      <ScrollView style={[styles.scrollView, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('report.reportViolation')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('report.schoolName')}
            </Text>
          </View>
          <View style={styles.warningIcon}>
            <Ionicons name="warning" size={24} color="#fff" />
          </View>
        </View>

        {/* Step Indicator */}
        <StepIndicator />

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.contentTitle, { color: theme.text }]}>
            {t('report.step2Title')}
          </Text>
          <Text style={[styles.contentSubtitle, { color: theme.subText }]}>
            {t('report.step2Subtitle')}
          </Text>

          {selectedViolationType === "class"
            ? renderClassForm()
            : renderStudentForm()}

          {/* Notes Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.subText }]}>{t('report.notes')}</Text>
            <TextInput
              style={[styles.input, styles.notesInput, { color: theme.text, backgroundColor: isDarkMode ? "#1f2937" : "#fff", borderColor: theme.border }]}
              placeholder={t('report.notesPlaceholder')}
              placeholderTextColor={theme.subText}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
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
        <Text style={styles.continueButtonText}>{t('report.continue')}</Text>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={["90%"]}
        index={-1}
        enablePanDownToClose
        keyboardBehavior="interactive"
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
        <BottomSheetView style={{ padding: 16, paddingBottom: 50 }}>
          <TagInput
            tagInput={tagInput}
            onChangeText={handleTextChange}
            selectedTags={selectedTags}
            onRemoveTag={handleRemoveTag}
            suggestions={suggestions}
            loading={loading}
            onAddTag={handleAddTag}
          />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#319527",
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
  },
  warningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "600",
  },
  stepText: {
    fontSize: 12,
    textAlign: "center",
  },
  stepLine: {
    height: 1,
    flex: 0.5,
    marginHorizontal: -10,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  contentSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    padding: 12,
  },
  dateIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#c4c4c4",
  },
  violationTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  violationTypeChip: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectedViolationType: {
    backgroundColor: "#F3FDF1",
    borderColor: "#319527",
  },
  violationTypeText: {
    fontSize: 14,
    color: "#666",
  },
  selectedViolationTypeText: {
    color: "#319527",
    fontWeight: "500",
  },
  notesInput: {
    height: 120,
    textAlignVertical: "top",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#319527",
    margin: 16,
    padding: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
  },
  loadingIndicator: {
    position: "absolute",
    right: 12,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  suggestionText: {
    fontSize: 16,
    color: "#000",
  },
  selectedTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 8,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3FDF1",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#319527",
  },
  selectedTagText: {
    fontSize: 14,
    color: "#319527",
    marginRight: 4,
  },
  addCustomButton: {
    backgroundColor: "#319527",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 16,
  },
  addCustomButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  selectedTagsPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  selectedTagPreviewItem: {
    backgroundColor: "#F3FDF1",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#319527",
  },
  selectedTagPreviewText: {
    fontSize: 14,
    color: "#319527",
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#319527",
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: "#F3FDF1",
    borderColor: "#319527",
  },
  optionText: {
    fontSize: 14,
    color: "#666",
  },
  selectedOptionText: {
    color: "#319527",
    fontWeight: "500",
  },
});
