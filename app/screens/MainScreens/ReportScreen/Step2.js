import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

const STEPS = [
  {
    id: 1,
    title: "Chọn đối tượng",
    subtitle: "Vui lòng chọn đối tượng bạn muốn báo cáo",
  },
  {
    id: 2,
    title: "Chi tiết vi phạm",
    subtitle: "Mô tả chi tiết về hành vi vi phạm",
  },
  {
    id: 3,
    title: "Xác nhận",
    subtitle: "Xác nhận thông tin báo cáo",
  },
];

const STUDENT_VIOLATION_TYPES = [
  "Đi học muộn",
  "Không mặc đồng phục",
  "Không làm bài tập",
  "Nói chuyện trong giờ học",
  "Vi phạm nội quy lớp học",
  "Không tham gia hoạt động tập thể",
  "Khác",
];

const CLASS_VIOLATION_TYPES = [
  "Trực nhật không tốt",
  "Nề nếp lớp kém",
  "Không đảm bảo vệ sinh",
  "Không đồng phục đồng bộ",
  "Vi phạm nội quy trường",
  "Khác",
];

const CLEANLINESS_STATUS = ["Sạch sẽ", "Tương đối sạch sẽ", "Bẩn", "Rất bẩn"];

const UNIFORM_STATUS = ["Đủ", "Tương đối đủ", "Thiếu"];

const MemoizedSuggestionItem = memo(({ item, onPress }) => (
  <TouchableOpacity style={styles.suggestionItem} onPress={() => onPress(item)}>
    <Text style={styles.suggestionText}>{item}</Text>
  </TouchableOpacity>
));

const MemoizedSelectedTag = memo(({ tag, onRemove }) => (
  <View style={styles.selectedTag}>
    <Text style={styles.selectedTagText}>{tag}</Text>
    <TouchableOpacity onPress={() => onRemove(tag)}>
      <Ionicons name="close-circle" size={18} color="#666" />
    </TouchableOpacity>
  </View>
));

export default function Step2({ navigation, route }) {
  const { violationType: selectedViolationType } = route.params;
  const [className, setClassName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reportDate, setReportDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [violationType, setViolationType] = useState("");
  const [notes, setNotes] = useState("");
  const [absences, setAbsences] = useState("");
  const [cleanliness, setCleanliness] = useState("");
  const [uniform, setUniform] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumber,
                {
                  backgroundColor: step.id <= 2 ? "#319527" : "#E5E5E5",
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  { color: step.id <= 2 ? "#fff" : "#666" },
                ]}
              >
                {step.id}
              </Text>
            </View>
            <Text
              style={[
                styles.stepText,
                { color: step.id <= 2 ? "#319527" : "#666" },
              ]}
            >
              {step.title}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: index === 0 ? "#319527" : "#E5E5E5" },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setReportDate(selectedDate);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const debouncedSearch = useCallback((callback, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(...args), delay);
    };
  }, []);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // Simulating API delay
      // await new Promise((resolve) => setTimeout(resolve, 300));

      // Mock suggestions based on query
      const mockSuggestions = [
        "Vi phạm quy định sử dụng điện thoại",
        "Vi phạm giờ giấc học tập",
        "Vi phạm nội quy phòng học",
        "Vi phạm quy định an toàn",
      ].filter((item) => item.toLowerCase().includes(query.toLowerCase()));

      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetchSuggestions = useMemo(
    () => debouncedSearch(fetchSuggestions, 300),
    [debouncedSearch, fetchSuggestions]
  );

  useEffect(() => {
    debouncedFetchSuggestions(tagInput);
  }, [tagInput, debouncedFetchSuggestions]);

  const handleAddTag = useCallback(
    (tag) => {
      if (!selectedTags.includes(tag)) {
        const newTags = [...selectedTags, tag];
        setSelectedTags(newTags);
        setTagInput("");
        setViolationType(newTags.join(", "));
      }
    },
    [selectedTags]
  );

  const handleRemoveTag = useCallback(
    (tagToRemove) => {
      const newTags = selectedTags.filter((tag) => tag !== tagToRemove);
      setSelectedTags(newTags);
      setViolationType(newTags.join(", "));
      if (newTags.length === 0) {
        setViolationType("");
      }
    },
    [selectedTags]
  );

  const renderViolationTypes = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Lỗi vi phạm</Text>
      <View style={styles.violationTypesContainer}>
        {(selectedViolationType === "class"
          ? CLASS_VIOLATION_TYPES
          : STUDENT_VIOLATION_TYPES
        ).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.violationTypeChip,
              (type === "Khác" && selectedTags.length > 0) ||
              violationType === type
                ? styles.selectedViolationType
                : null,
            ]}
            onPress={() => {
              if (type === "Khác") {
                setShowTagInput(true);
              } else {
                setViolationType(type);
                setSelectedTags([]);
              }
            }}
          >
            <Text
              style={[
                styles.violationTypeText,
                (type === "Khác" && selectedTags.length > 0) ||
                violationType === type
                  ? styles.selectedViolationTypeText
                  : null,
              ]}
            >
              {type === "Khác" && selectedTags.length > 0
                ? `Khác (${selectedTags.length})`
                : type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedTags.length > 0 && (
        <View style={styles.selectedTagsPreview}>
          {selectedTags.map((tag) => (
            <View key={tag} style={styles.selectedTagPreviewItem}>
              <Text style={styles.selectedTagPreviewText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderStudentForm = () => (
    <>
      {/* Student Name Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Họ tên học sinh</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập tên học sinh"
          value={studentName}
          onChangeText={setStudentName}
        />
      </View>

      {/* Report Date Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Thời gian báo cáo</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color="#666"
            style={styles.dateIcon}
          />
          <Text style={styles.dateText}>{formatDate(reportDate)}</Text>
        </TouchableOpacity>
      </View>

      {renderViolationTypes()}
    </>
  );

  const renderClassForm = () => (
    <>
      {/* Class Name Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Tên lớp</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập tên lớp"
          value={className}
          onChangeText={setClassName}
        />
      </View>

      {/* Report Date Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Thời gian báo cáo</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color="#666"
            style={styles.dateIcon}
          />
          <Text style={styles.dateText}>{formatDate(reportDate)}</Text>
        </TouchableOpacity>
      </View>

      {/* Absences Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Vắng</Text>
        <TextInput
          style={styles.input}
          placeholder="Điền số lượng (bỏ trống nếu đầy đủ)"
          value={absences}
          onChangeText={setAbsences}
          keyboardType="numeric"
        />
      </View>

      {/* Cleanliness Status */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Vệ sinh</Text>
        <View style={styles.violationTypesContainer}>
          {CLEANLINESS_STATUS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.violationTypeChip,
                cleanliness === status && styles.selectedViolationType,
              ]}
              onPress={() => setCleanliness(status)}
            >
              <Text
                style={[
                  styles.violationTypeText,
                  cleanliness === status && styles.selectedViolationTypeText,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Uniform Status */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Đồng phục</Text>
        <View style={styles.violationTypesContainer}>
          {UNIFORM_STATUS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.violationTypeChip,
                uniform === status && styles.selectedViolationType,
              ]}
              onPress={() => setUniform(status)}
            >
              <Text
                style={[
                  styles.violationTypeText,
                  uniform === status && styles.selectedViolationTypeText,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {renderViolationTypes()}
    </>
  );

  const TagInput = useCallback(
    () => (
      <Modal
        visible={showTagInput}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTagInput(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm vi phạm khác</Text>
              <TouchableOpacity onPress={() => setShowTagInput(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectedTagsContainer}>
              {selectedTags.map((tag) => (
                <MemoizedSelectedTag
                  key={tag}
                  tag={tag}
                  onRemove={handleRemoveTag}
                />
              ))}
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Nhập để tìm kiếm vi phạm..."
                value={tagInput}
                onChangeText={setTagInput}
                maxLength={100}
              />
              {loading && (
                <ActivityIndicator
                  style={styles.loadingIndicator}
                  color="#319527"
                />
              )}
            </View>

            {suggestions.length > 0 && (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <MemoizedSuggestionItem item={item} onPress={handleAddTag} />
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
                { opacity: tagInput.length > 0 ? 1 : 0.5 },
              ]}
              disabled={tagInput.length === 0}
              onPress={() => handleAddTag(tagInput)}
            >
              <Text style={styles.addCustomButtonText}>Thêm vi phạm mới</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ),
    [
      showTagInput,
      selectedTags,
      tagInput,
      loading,
      suggestions,
      handleAddTag,
      handleRemoveTag,
    ]
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={[
          styles.headerNav,
          Platform.OS === "android"
            ? { marginTop: insets.top }
            : { height: 65, paddingVertical: 12 },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back-circle" size={25} color={"#A7A7A7"} />
        </TouchableOpacity>
        <Text style={styles.headerNavTitle}>Tạo báo cáo</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Báo cáo vi phạm</Text>
            <Text style={styles.headerSubtitle}>
              THPT Chuyên Biên Hòa - Hà Nam
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
          <Text style={styles.contentTitle}>
            Bước 2: Điền thông tin vi phạm
          </Text>
          <Text style={styles.contentSubtitle}>
            Điền các thông tin cụ thể về vi phạm
          </Text>

          {selectedViolationType === "class"
            ? renderClassForm()
            : renderStudentForm()}

          {/* Notes Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Nhập các ghi chú (nếu có)"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={reportDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      <TagInput />

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          {
            opacity:
              selectedViolationType === "class"
                ? className && violationType
                : studentName && violationType
                ? 1
                : 0.5,
          },
        ]}
        disabled={
          selectedViolationType === "class"
            ? !className || !violationType
            : !studentName || !violationType
        }
        onPress={() => {
          navigation.navigate("Step3", {
            studentName:
              selectedViolationType === "class" ? className : studentName,
            reportDate: formatDate(reportDate),
            violationType,
            notes,
            ...(selectedViolationType === "class" && {
              absences,
              cleanliness,
              uniform,
            }),
          });
        }}
      >
        <Text style={styles.continueButtonText}>Tiếp tục</Text>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
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
  headerNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomColor: "#ccc",
    borderBottomWidth: 0.8,
    backgroundColor: "#F2F2F2",
  },
  headerNavTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 16,
    color: "#309627",
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
    color: "#000",
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
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
});
