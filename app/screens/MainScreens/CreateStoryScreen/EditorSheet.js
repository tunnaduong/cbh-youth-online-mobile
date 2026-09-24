import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Keyboard,
  Platform,
  useWindowDimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Dark bottom sheet shared by the story editor's pickers.
 *
 * Deliberately a plain absolutely-positioned view rather than a native modal:
 * the editor already renders inside a screen with its own gesture handlers,
 * and stacking native modals on top of it is what has historically frozen the
 * story flows on iOS. For the same reason the keyboard is tracked by hand -
 * KeyboardAvoidingView measures from the window and cannot place a layer that
 * is itself absolutely positioned.
 */
const EditorSheet = ({ visible, title, onClose, children, heightRatio = 0.62 }) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return undefined;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) =>
      setKeyboardHeight(event.endCoordinates?.height || 0)
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  if (!visible) return null;

  // Never let the sheet run past the top of the screen or under the keyboard.
  const availableHeight = windowHeight - keyboardHeight - insets.top - 12;
  const sheetHeight = Math.max(220, Math.min(windowHeight * heightRatio, availableHeight));

  return (
    <View style={styles.wrapper}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            marginBottom: keyboardHeight,
            paddingBottom: keyboardHeight ? 12 : insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {children}
      </View>
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
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
