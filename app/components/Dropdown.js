import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SectionList,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const Dropdown = ({
  options = [],
  selectedValue,
  onValueChange,
  label,
  placeholder,
  style,
  leftIcon,
  arrowSize = 20,
  textStyle,
  containerStyle,
}) => {
  const [visible, setVisible] = useState(false);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const handleSelect = (value) => {
    onValueChange(value);
    setVisible(false);
  };

  // Check if we should use section list (grouped data)
  const isGrouped = useMemo(() => {
    return options.some((opt) => opt.category);
  }, [options]);

  const sections = useMemo(() => {
    if (!isGrouped) return [];

    const groups = {};
    options.forEach((opt) => {
      const cat = opt.category || t("common.other");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(opt);
    });

    return Object.keys(groups).map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [options, isGrouped]);

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const isFitContent = flattenedStyle.alignSelf === 'flex-start';

  const renderAndroidDialog = () => {
    const dialogTitle = label || placeholder || t("dropdown.selectOption");
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.androidOverlay}>
          <View style={[styles.androidDialog, { backgroundColor: isDarkMode ? "#2b2d31" : "#ffffff" }]}>
            <Text style={[styles.androidTitle, { color: theme.text }]}>{dialogTitle}</Text>
            
            <ScrollView
              style={styles.androidOptionsContainer}
              showsVerticalScrollIndicator={true}
            >
              {options.map((item) => {
                const isSelected = selectedValue?.value === item.value;
                // Strip emoji flags from labels for Android native feel
                const cleanLabel = item.label.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, "").trim();
                
                return (
                  <TouchableOpacity
                    key={item.value?.toString() || Math.random().toString()}
                    style={styles.androidOptionRow}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.androidRadioOuter,
                      { borderColor: isSelected ? theme.primary : theme.subText }
                    ]}>
                      {isSelected && (
                        <View style={[styles.androidRadioInner, { backgroundColor: theme.primary }]} />
                      )}
                    </View>
                    <Text style={[
                      styles.androidOptionText,
                      { 
                        color: theme.text,
                        fontWeight: isSelected ? "bold" : "normal"
                      }
                    ]}>
                      {cleanLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.androidActions}>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={styles.androidCancelButton}
              >
                <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 14 }}>
                  {t("common.cancel") || "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: theme.background, borderColor: theme.border }, style]}
        onPress={() => setVisible(true)}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: isFitContent ? 0 : 1 }}>
          {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
          <Text
            style={[styles.dropdownText, { color: selectedValue ? theme.text : theme.subText }, textStyle, { flex: isFitContent ? 0 : 1 }]}
            numberOfLines={1}
          >
            {selectedValue
              ? selectedValue.label
              : placeholder || t("dropdown.selectOption")}
          </Text>
        </View>
        <Ionicons
          name="chevron-down-outline"
          size={arrowSize}
          color={theme.subText}
        />
      </TouchableOpacity>

      {Platform.OS === "android" ? renderAndroidDialog() : (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={() => setVisible(false)}
        >
          <TouchableOpacity
            style={[styles.overlay, { backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" }]}
            onPress={() => setVisible(false)}
            activeOpacity={1}
          >
            <View style={[styles.modal, { backgroundColor: theme.cardBackground }, isGrouped && { maxHeight: "70%" }]}>
              {isGrouped ? (
                <SectionList
                  sections={sections}
                  keyExtractor={(item) => item.id?.toString() || item.value?.toString() || Math.random().toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.optionGrouped}
                      onPress={() => handleSelect(item)}
                    >
                      <Text style={[styles.optionText, { color: theme.text }]}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  renderSectionHeader={({ section: { title } }) => (
                    <View style={[styles.sectionHeader, { backgroundColor: theme.cardBackground }]}>
                      <Text style={[styles.sectionHeaderText, { color: theme.subText }]}>{title}</Text>
                    </View>
                  )}
                  stickySectionHeadersEnabled={false}
                />
              ) : (
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.id?.toString() || item.value?.toString() || Math.random().toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.option, { borderBottomColor: theme.border }]}
                      onPress={() => handleSelect(item)}
                    >
                      <Text style={[styles.optionText, { color: theme.text }]}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    marginBottom: 5,
    fontSize: 16,
  },
  dropdown: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownText: {
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modal: {
    borderRadius: 12,
    paddingVertical: 10,
    maxHeight: "60%", // Limit height
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  optionGrouped: {
    paddingVertical: 12,
    paddingHorizontal: 20, // More indent for grouped items
  },
  optionText: {
    fontSize: 16,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 5,
  },
  sectionHeaderText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  androidOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  androidDialog: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 24,
  },
  androidTitle: {
    fontSize: 24,
    fontWeight: "500",
    marginBottom: 16,
    lineHeight: 32,
  },
  androidOptionsContainer: {
    marginVertical: 8,
    maxHeight: 280,
  },
  androidOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  androidRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  androidRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  androidOptionText: {
    flex: 1,
    fontSize: 16,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  androidActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  androidCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default Dropdown;
