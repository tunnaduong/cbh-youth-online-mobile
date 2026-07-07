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
  Platform,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

// ─── Optional liquid-glass on Android ──────────────────────────────────────
let LiquidGlassProviderAndroid = null;
let LiquidGlassViewAndroid = null;
if (Platform.OS === 'android') {
  try {
    const LiquidGlassKit = require('liquid-glass-kit');
    LiquidGlassProviderAndroid = LiquidGlassKit.LiquidGlassProvider;
    LiquidGlassViewAndroid = LiquidGlassKit.LiquidGlassView;
  } catch (_) {}
}

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

  // ─── Android liquid-glass dialog ───────────────────────────────────────────
  const isAndroid33 = Platform.OS === 'android' && Platform.Version >= 33;
  const useGlass = Platform.OS === 'android' && LiquidGlassViewAndroid && LiquidGlassProviderAndroid;

  const dialogContent = (
    <>
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
              style={[
                styles.button,
                useGlass && {
                  backgroundColor: isDarkMode
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
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
    </>
  );

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
                styles.dialogWrapper,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              {useGlass ? (
                // Android: render LiquidGlassView as the dialog surface
                // Wrap in a provider so it can sample the blurred background
                <LiquidGlassProviderAndroid style={StyleSheet.absoluteFill}>
                  <LiquidGlassViewAndroid
                    blurRadius={isAndroid33 ? 6 : 20}
                    refractionAmount={isAndroid33 ? 18 : 0}
                    refractionHeight={isAndroid33 ? 10 : 0}
                    chromaticAberration={isAndroid33 ? 0.25 : 0}
                    highlightAlpha={isAndroid33 ? 0.5 : 0.25}
                    tint={isDarkMode ? "rgba(30, 30, 30, 0.55)" : "rgba(255, 255, 255, 0.45)"}
                    style={[
                      styles.dialogContainer,
                      {
                        backgroundColor: isDarkMode
                          ? "rgba(28, 28, 32, 0.82)"
                          : "rgba(255, 255, 255, 0.72)",
                        borderWidth: 1,
                        borderColor: isDarkMode
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.07)",
                      },
                    ]}
                  >
                    {dialogContent}
                  </LiquidGlassViewAndroid>
                </LiquidGlassProviderAndroid>
              ) : (
                // iOS / fallback: original surface colour
                <View
                  style={[
                    styles.dialogContainer,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  {dialogContent}
                </View>
              )}
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
  // Wrapper carries the scale animation; inner surface is either glass or plain
  dialogWrapper: {
    width: Dimensions.get("window").width - 56,
    maxWidth: 320,
  },
  dialogContainer: {
    width: "100%",
    borderRadius: 28,   // MD3 Rounded corners
    padding: 24,        // MD3 padding
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    overflow: "hidden",
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
    borderRadius: 100,  // MD3 pill buttons
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
});
