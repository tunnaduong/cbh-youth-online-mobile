"use client";

import { useRef, useState, useEffect } from "react";
import {
  Pressable,
  Animated,
  Easing,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";

const { width, height } = Dimensions.get("window");

const CustomTabBarButton = ({ onPress }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const button1Anim = useRef(new Animated.Value(0)).current;
  const button2Anim = useRef(new Animated.Value(0)).current;
  const button3Anim = useRef(new Animated.Value(0)).current;
  const [showButtons, setShowButtons] = useState(false);
  const navigation = useNavigation();

  // Close buttons when app goes to background
  useEffect(() => {
    return () => {
      if (showButtons) {
        animateButtonsOut();
      }
    };
  }, [showButtons]);

  const handlePress = () => {
    if (showButtons) {
      animateButtonsOut();
    } else {
      onPress();
      setShowButtons(true);
      animateButtonsIn();
    }
  };

  const handleDismiss = () => {
    if (showButtons) {
      animateButtonsOut();
    }
  };

  const animateButtonsIn = () => {
    Animated.parallel([
      Animated.timing(button1Anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button2Anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button3Anim, {
        // Add this animation
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 1,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButtonsOut = () => {
    Animated.parallel([
      Animated.timing(button1Anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button2Anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(button3Anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 0,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => setShowButtons(false));
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const button1Style = {
    transform: [
      {
        translateY: button1Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -160], // Move "Tạo bài viết" further up
        }),
      },
    ],
    opacity: button1Anim,
  };

  const button2Style = {
    transform: [
      {
        translateY: button2Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -80], // Move "Tạo báo cáo" less far up
        }),
      },
    ],
    opacity: button2Anim,
  };

  const button3Style = {
    transform: [
      {
        translateY: button3Anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -240], // Move third button even further up
        }),
      },
    ],
    opacity: button3Anim,
  };

  return (
    <View style={styles.container}>
      {/* Full-screen transparent overlay to capture taps outside */}
      {showButtons && (
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={styles.dismissOverlay} />
        </TouchableWithoutFeedback>
      )}

      {showButtons && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.additionalButton, button3Style]}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => navigation.navigate("CreatePostScreen")}
            >
              <Ionicons name="create-outline" size={35} color={"#319527"} />
              <Text style={styles.buttonText}>Tạo bài viết</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.additionalButton, button1Style]}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() =>
                Toast.show({
                  type: "info",
                  text1: "Tính năng đang được phát triển",
                })
              }
            >
              <Ionicons name="mic-outline" size={35} color={"#319527"} />
              <Text
                style={[
                  styles.buttonText,
                  { textAlign: "left", marginLeft: 10 },
                ]}
              >
                Tạo ghi âm
              </Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[styles.additionalButton, button2Style]}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => navigation.navigate("ReportScreen")}
            >
              <Ionicons
                name="document-text-outline"
                size={35}
                color={"#319527"}
              />
              <Text style={styles.buttonText}>Tạo báo cáo</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
      <Pressable style={styles.buttonContainer} onPress={handlePress}>
        <Animated.View
          style={[styles.iconContainer, { transform: [{ rotate }] }]}
        >
          <Ionicons
            name="add-circle"
            size={60}
            color={"#319527"}
            style={styles.icon}
          />
        </Animated.View>
        <Text style={styles.label}>Tạo</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  dismissOverlay: {
    position: "absolute",
    top: -height, // Position it to cover the entire screen
    left: -width / 2,
    width: width * 2, // Make it extra wide to ensure coverage
    height: height * 2, // Make it extra tall to ensure coverage
    backgroundColor: "transparent", // Transparent but will capture touches
    zIndex: 1, // Above regular content but below the buttons
  },
  overlay: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2, // Above the dismissOverlay
  },
  buttonContainer: {
    top: -30,
    alignItems: "center",
    zIndex: 3, // Above everything else
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 35,
  },
  icon: {
    shadowColor: "#319527",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  label: {
    fontWeight: "bold",
    color: "#858585",
    fontSize: 10,
    marginTop: 3,
  },
  additionalButton: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 40,
    padding: 10,
    marginHorizontal: 10,
    width: 155,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    marginLeft: 5,
    fontSize: 16,
    color: "#319527",
    textAlign: "center",
    width: 90,
  },
});

export default CustomTabBarButton;
