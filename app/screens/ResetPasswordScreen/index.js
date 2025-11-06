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
import { forgotPasswordVerify } from "../../services/api/Api";

const ResetPasswordScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.email || "");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleResetPassword = async () => {
    if (!email || !token || !password || !confirmPassword) {
      Alert.alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Email không hợp lệ", "Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Mật khẩu không khớp", "Vui lòng nhập lại mật khẩu");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Mật khẩu phải dài ít nhất 6 ký tự");
      return;
    }

    setLoading(true);

    try {
      const response = await forgotPasswordVerify({
        email,
        token,
        password,
        password_confirmation: confirmPassword,
      });
      console.log("Reset password response:", response.data);

      if (response.data && response.data.status === "success") {
        Alert.alert(
          "Thành công",
          response.data.message || "Mật khẩu đã được reset thành công.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.navigate("Login");
              },
            },
          ]
        );
      } else {
        throw new Error(
          response.data?.message || "Đã xảy ra lỗi. Vui lòng thử lại."
        );
      }
    } catch (error) {
      console.log("Reset password failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi. Vui lòng thử lại.";

      Alert.alert("Reset mật khẩu thất bại", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText="Đang reset mật khẩu..." visible={loading} />
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
              <Text style={styles.title}>Đặt lại mật khẩu</Text>
              <Text style={styles.subtitle}>
                Nhập token từ email và mật khẩu mới của bạn
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Địa chỉ Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="hello@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Token</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập token từ email"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mật khẩu mới</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Icon
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={24}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Xác nhận mật khẩu</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    textContentType="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Icon
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={24}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetPassword}
              >
                <Text style={styles.resetButtonText}>Đặt lại mật khẩu</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  navigation.navigate("Login");
                }}
                style={styles.backToLogin}
              >
                <Text style={styles.backToLoginText}>Quay lại đăng nhập</Text>
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
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  resetButton: {
    backgroundColor: "#319527",
    height: 50,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  resetButtonText: {
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

export default ResetPasswordScreen;
