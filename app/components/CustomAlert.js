import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// Global reference for imperative calling
export const customAlertRef = React.createRef();

export const CustomAlert = {
  alert: (title, message, buttons, options) => {
    customAlertRef.current?.alert(title, message, buttons, options);
  },
};

export const CustomAlertProvider = () => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [buttons, setButtons] = useState([]);
  const [options, setOptions] = useState({});
  const { theme, isDarkMode } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Function to trigger show animation
  const showDialog = () => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Function to trigger hide animation
  const hideDialog = (callback) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (callback) callback();
    });
  };

  // Imperative alert function
  const alert = (titleText, messageText, alertButtons, alertOptions) => {
    setTitle(titleText || "");
    setMessage(messageText || "");
    setOptions(alertOptions || {});

    const defaultButtons = [{ text: "OK", onPress: () => {} }];
    setButtons(alertButtons && alertButtons.length > 0 ? alertButtons : defaultButtons);

    showDialog();
  };

  // Assign the show functions to the global reference
  React.useEffect(() => {
    customAlertRef.current = { alert };
    return () => {
      customAlertRef.current = null;
    };
  }, []);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => {
        if (options.cancelable) {
          hideDialog(options.onDismiss);
        }
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (options.cancelable) {
            hideDialog(options.onDismiss);
          }
        }}
      >
        <View style={styles.overlay}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)", opacity: fadeAnim }]} />
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.dialogContainer,
                {
                  backgroundColor: theme.surface,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {title ? (
                <Text style={[styles.title, { color: theme.text }]}>
                  {title}
                </Text>
              ) : null}

              {message ? (
                <Text style={[styles.message, { color: theme.subText }]}>
                  {message}
                </Text>
              ) : null}

              <View style={styles.buttonContainer}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === "cancel";
                  const isDestructive = btn.style === "destructive";

                  let buttonTextColor = theme.primary;
                  if (isCancel) {
                    buttonTextColor = theme.subText;
                  } else if (isDestructive) {
                    buttonTextColor = "#FF3B30";
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.button}
                      onPress={() => {
                        hideDialog(() => {
                          if (btn.onPress) btn.onPress();
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          { color: buttonTextColor },
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    width: Dimensions.get("window").width - 56, // 28dp margins
    maxWidth: 320,
    borderRadius: 28, // MD3 Rounded corners
    padding: 24, // MD3 padding
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "left",
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "left",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginLeft: 8,
    borderRadius: 100, // MD3 pill buttons
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
});
