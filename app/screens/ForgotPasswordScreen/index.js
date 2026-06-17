import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import ProgressHUD from "../../components/ProgressHUD";
import Icon from "react-native-vector-icons/Ionicons";
import { forgotPassword } from "../../services/api/Api";
import { useTranslation } from "react-i18next";

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSendResetLink = async () => {
    if (!email) {
      Alert.alert(t("forgotPassword.failureTitle"), t("forgotPassword.missingEmail"));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t("forgotPassword.invalidEmailTitle"), t("forgotPassword.invalidEmailBody"));
      return;
    }

    setLoading(true);

    try {
      const response = await forgotPassword({ email });
      console.log("Forgot password response:", response.data);

      if (response.data && response.data.status === "success") {
        Alert.alert(
          t("forgotPassword.successTitle"),
          t("forgotPassword.successBody") || response.data.message,
          [
            {
              text: t("common.ok"),
              onPress: () => {},
              style: "default",
            },
          ]
        );
      } else {
        throw new Error(
          response.data?.message || "Đã xảy ra lỗi. Vui lòng thử lại."
        );
      }
    } catch (error) {
      console.log("Forgot password failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi. Vui lòng thử lại.";

      Alert.alert(t("forgotPassword.failureTitle"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText={t("forgotPassword.loading")} visible={loading} />
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <SafeAreaView style={styles.container}>
          <TouchableOpacity
            className="mx-6 bg-gray-400 mt-3 h-[40px] w-[40px] rounded-full items-center justify-center"
            onPress={() => {
              navigation.goBack();
            }}
            style={{
              marginTop:
                Platform.OS === "android" ? StatusBar.currentHeight + 10 : 0,
            }}
          >
            <Icon name="chevron-back-outline" color="white" size={30} />
          </TouchableOpacity>
          <ScrollView style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{t("forgotPassword.title")}</Text>
              <Text style={styles.subtitle}>{t("forgotPassword.subtitle")}</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("forgotPassword.email")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="hello@example.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSendResetLink}
              >
                <Text style={styles.submitButtonText}>{t("forgotPassword.sendLink")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  navigation.navigate("Login");
                }}
                style={styles.backToLogin}
              >
                <Text style={styles.backToLoginText}>{t("forgotPassword.backToLogin")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: "#000",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#FBFFFB",
    color: "#000",
  },
  submitButton: {
    backgroundColor: "#319527",
    height: 50,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backToLogin: {
    alignSelf: "center",
    marginTop: 8,
  },
  backToLoginText: {
    color: "#319527",
    fontSize: 14,
  },
});

export default ForgotPasswordScreen;
