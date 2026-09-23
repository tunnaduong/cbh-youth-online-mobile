import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

/**
 * Dark bottom sheet shared by the story editor's pickers.
 *
 * Deliberately a plain absolutely-positioned view rather than a native modal:
 * the editor already renders inside a screen with its own gesture handlers,
 * and stacking native modals on top of it is what has historically frozen the
 * story flows on iOS.
 */
const EditorSheet = ({ visible, title, onClose, children, height = "62%" }) => {
  if (!visible) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardWrapper}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { height }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 30000,
  },
  keyboardWrapper: {
    justifyContent: "flex-end",
    flex: 1,
  },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default EditorSheet;
