import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SectionList,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

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
}) => {
  const [visible, setVisible] = useState(false);

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
      const cat = opt.category || "Khác";
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

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.dropdown, style]}
        onPress={() => setVisible(true)}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: isFitContent ? 0 : 1 }}>
          {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
          <Text
            style={[styles.dropdownText, textStyle, { flex: isFitContent ? 0 : 1 }]}
            numberOfLines={1}
          >
            {selectedValue
              ? selectedValue.label
              : placeholder || "Chọn một tùy chọn"}
          </Text>
        </View>
        <Ionicons
          name="chevron-down-outline"
          size={arrowSize}
          color={"#1B1B1B"}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setVisible(false)}
          activeOpacity={1}
        >
          <View style={[styles.modal, isGrouped && { maxHeight: "70%" }]}>
            {isGrouped ? (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.value.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionGrouped}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={styles.optionText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
                renderSectionHeader={({ section: { title } }) => (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                  </View>
                )}
                stickySectionHeadersEnabled={false}
              />
            ) : (
              <FlatList
                data={options}
                keyExtractor={(item) => item.value ? item.value.toString() : Math.random().toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={styles.optionText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
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
    color: "#333",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ECECEC",
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownText: {
    fontSize: 16,
    color: "#666666",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modal: {
    backgroundColor: "#fff",
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
    borderBottomColor: "#f0f0f0",
  },
  optionGrouped: {
    paddingVertical: 12,
    paddingHorizontal: 20, // More indent for grouped items
    // borderBottomWidth: 1,
    // borderBottomColor: "#f5f5f5",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    // borderBottomWidth: 1,
    // borderBottomColor: "#f0f0f0",
    marginTop: 5,
  },
  sectionHeaderText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
    textTransform: "uppercase",
  },
});

export default Dropdown;
