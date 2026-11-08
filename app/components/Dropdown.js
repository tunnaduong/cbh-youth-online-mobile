import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SectionList,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import {
  LiquidGlassView,
  glassTint,
  androidGlassPerfProps,
} from "./GlassModules";
import { getSectionIcon, getSubforumIcon } from "../utils/forumUtils";

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
  modalTitle,
  headerIcon,
}) => {
  const [visible, setVisible] = useState(false);
  const [tempSelected, setTempSelected] = useState(selectedValue);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setTempSelected(selectedValue);
    }
  }, [visible, selectedValue]);

  const openModal = () => {
    setTempSelected(selectedValue);
    setVisible(true);
  };

  const closeModal = () => {
    setVisible(false);
  };

  const handleConfirm = () => {
    if (tempSelected !== undefined) {
      onValueChange(tempSelected);
    }
    setVisible(false);
  };

  // Check if we should use section list (grouped data)
  const isGrouped = useMemo(() => {
    return options.some((opt) => opt && opt.category);
  }, [options]);

  const isCategoryOrGrouped = useMemo(() => {
    if (isGrouped) return true;
    const title = (modalTitle || label || placeholder || "").toLowerCase();
    return (
      title.includes("danh mục") ||
      title.includes("chuyên mục") ||
      title.includes("category")
    );
  }, [isGrouped, modalTitle, label, placeholder]);

  const displayTitle = useMemo(() => {
    if (modalTitle) return modalTitle;
    if (label) return label;
    if (isCategoryOrGrouped)
      return t("createPost.chooseCategory", "Chọn danh mục");
    if (placeholder) return placeholder;
    return t("dropdown.selectOption", "Chọn");
  }, [modalTitle, label, isCategoryOrGrouped, placeholder, t]);

  const sections = useMemo(() => {
    if (!isGrouped) return [];

    const groups = {};
    options.forEach((opt) => {
      if (!opt) return;
      const cat = opt.category || t("common.other", "Khác");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(opt);
    });

    return Object.keys(groups).map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [options, isGrouped, t]);

  const isSelected = (item) => {
    if (!tempSelected || item == null) return false;
    if (item.value !== undefined && tempSelected.value !== undefined) {
      return item.value === tempSelected.value;
    }
    if (item.id !== undefined && tempSelected.id !== undefined) {
      return item.id === tempSelected.id;
    }
    return item.label === tempSelected.label;
  };

  const renderOptionItem = ({ item }) => {
    if (!item) return null;
    const selected = isSelected(item);

    let itemIcon = item.icon;
    if (!itemIcon && isCategoryOrGrouped) {
      itemIcon =
        (item.rawCategory || item.category ? getSectionIcon(item.rawCategory || item.category) : null) ||
        getSubforumIcon(item.label, item.rawName || item.name || item.slug || item.value);
    }

    return (
      <TouchableOpacity
        style={[
          styles.optionRow,
          selected && [
            styles.optionRowSelected,
            {
              borderColor: theme.primary,
              backgroundColor: isDarkMode
                ? "rgba(46, 125, 50, 0.18)"
                : "rgba(46, 125, 50, 0.10)",
            },
          ],
        ]}
        onPress={() => setTempSelected(item)}
        activeOpacity={0.7}
      >
        {React.isValidElement(item.icon) ? (
          <View style={styles.optionIconContainer}>{item.icon}</View>
        ) : item.iconComponent ? (
          <View style={styles.optionIconContainer}>{item.iconComponent}</View>
        ) : itemIcon ? (
          <View style={styles.optionIconContainer}>
            <Ionicons
              name={itemIcon}
              size={18}
              color={
                selected ? theme.primary : isDarkMode ? "#b0b0b0" : "#555555"
              }
            />
          </View>
        ) : null}

        <Text
          style={[
            styles.optionText,
            { color: theme.text },
            selected && styles.optionTextSelected,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>

        {selected && (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={theme.primary}
            style={styles.checkmarkIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeaderRow}>
      <Ionicons
        name={getSectionIcon(title)}
        size={17}
        color={theme.primary}
        style={{ marginRight: 8 }}
      />
      <Text style={[styles.sectionHeaderText, { color: theme.subText }]}>
        {title}
      </Text>
    </View>
  );

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const flattenedTextStyle = StyleSheet.flatten(textStyle) || {};
  const isFitContent = flattenedStyle.alignSelf === "flex-start";
  const isRightAligned = flattenedTextStyle.textAlign === "right";

  const SheetSurface = LiquidGlassView || View;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      )}
      <TouchableOpacity
        style={[
          styles.dropdown,
          { backgroundColor: theme.background, borderColor: theme.border },
          style,
        ]}
        onPress={openModal}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: isRightAligned ? "flex-end" : "flex-start",
            flex: isFitContent || isRightAligned ? 0 : 1,
            marginRight: isRightAligned ? 6 : 0,
            maxWidth: isRightAligned ? "88%" : "100%",
          }}
        >
          {leftIcon ? (
            <View style={{ marginRight: 6 }}>{leftIcon}</View>
          ) : selectedValue?.iconComponent ? (
            <View style={{ marginRight: 6 }}>{selectedValue.iconComponent}</View>
          ) : React.isValidElement(selectedValue?.icon) ? (
            <View style={{ marginRight: 6 }}>{selectedValue.icon}</View>
          ) : selectedValue?.icon && typeof selectedValue.icon === "string" ? (
            <View style={{ marginRight: 6 }}>
              <Ionicons
                name={selectedValue.icon}
                size={16}
                color={theme.primary}
              />
            </View>
          ) : isCategoryOrGrouped && selectedValue ? (
            <View style={{ marginRight: 6 }}>
              <Ionicons
                name={
                  (selectedValue.rawCategory || selectedValue.category
                    ? getSectionIcon(selectedValue.rawCategory || selectedValue.category)
                    : null) ||
                  selectedValue.icon ||
                  getSubforumIcon(selectedValue.label, selectedValue.rawName || selectedValue.name)
                }
                size={16}
                color={theme.primary}
              />
            </View>
          ) : null}
          <Text
            style={[
              styles.dropdownText,
              { color: selectedValue ? theme.text : theme.subText },
              textStyle,
              { flex: isFitContent || isRightAligned ? 0 : 1, flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {selectedValue
              ? selectedValue.label
              : placeholder || t("dropdown.selectOption", "Chọn một tùy chọn")}
          </Text>
        </View>
        <Ionicons
          name="chevron-down-outline"
          size={arrowSize}
          color={theme.subText}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          {/* Backdrop */}
          <TouchableOpacity
            style={[
              styles.backdrop,
              {
                backgroundColor: isDarkMode
                  ? "rgba(0, 0, 0, 0.65)"
                  : "rgba(0, 0, 0, 0.45)",
              },
            ]}
            activeOpacity={1}
            onPress={closeModal}
          />

          {/* Liquid Glass Bottom Sheet */}
          <SheetSurface
            tintColor={glassTint(isDarkMode)}
            borderRadius={28}
            style={[
              styles.sheet,
              {
                borderColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.14)"
                  : "rgba(0, 0, 0, 0.08)",
                backgroundColor: isDarkMode
                  ? "rgba(22, 22, 24, 0.94)"
                  : "rgba(252, 252, 254, 0.94)",
              },
            ]}
            {...androidGlassPerfProps}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View
                style={[
                  styles.dragHandle,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(255, 255, 255, 0.22)"
                      : "rgba(0, 0, 0, 0.18)",
                  },
                ]}
              />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                {isCategoryOrGrouped ? (
                  <MaterialCommunityIcons
                    name="clover"
                    size={26}
                    color={theme.primary}
                    style={{ marginRight: 10 }}
                  />
                ) : headerIcon ? (
                  <Ionicons
                    name={headerIcon}
                    size={22}
                    color={theme.primary}
                    style={{ marginRight: 10 }}
                  />
                ) : (
                  <Ionicons
                    name="options-outline"
                    size={22}
                    color={theme.primary}
                    style={{ marginRight: 10 }}
                  />
                )}
                <Text
                  style={[styles.sheetTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {displayTitle}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeModal}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
                  },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {/* Scrollable list */}
            <View style={styles.listContainer}>
              {isGrouped ? (
                <SectionList
                  sections={sections}
                  keyExtractor={(item) =>
                    String(item.value ?? item.id ?? item.label)
                  }
                  renderItem={renderOptionItem}
                  renderSectionHeader={renderSectionHeader}
                  stickySectionHeadersEnabled={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                />
              ) : (
                <FlatList
                  data={options}
                  keyExtractor={(item) =>
                    String(item.value ?? item.id ?? item.label)
                  }
                  renderItem={renderOptionItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                />
              )}
            </View>

            {/* Bottom Confirm Action */}
            <View
              style={[
                styles.bottomBar,
                { paddingBottom: Math.max(insets.bottom - 4, 14) },
              ]}
            >
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="checkmark"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.confirmButtonText}>
                  {t("dropdown.select", "Chọn")}
                </Text>
              </TouchableOpacity>
            </View>
          </SheetSurface>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: "100%",
    borderRadius: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    maxHeight: "82%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    flexShrink: 1,
    maxHeight: "100%",
  },
  listContent: {
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionRowSelected: {
    // border and background set dynamically
  },
  optionIconContainer: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  checkmarkIcon: {
    marginLeft: 8,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  confirmButton: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Dropdown;
