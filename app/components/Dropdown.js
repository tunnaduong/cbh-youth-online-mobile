import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getSubforums } from "../services/api/Api";

const Dropdown = ({
  options,
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

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.dropdown, style]}
        onPress={() => setVisible(true)}
      >
        {leftIcon ?? null}
        <Text style={[styles.dropdownText, textStyle]} numberOfLines={1}>
          {selectedValue
            ? selectedValue.label
            : placeholder || "Chọn một tùy chọn"}
        </Text>
        <Ionicons
          name="chevron-down-outline"
          size={arrowSize}
          color={"#1B1B1B"}
        />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.modal}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleSelect(item)}
                >
                  <Text>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
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
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    maxHeight: "50%",
  },
  option: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
});

export default Dropdown;
