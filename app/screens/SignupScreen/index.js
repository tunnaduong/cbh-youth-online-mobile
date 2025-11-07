import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
  Platform,
  StatusBar,
} from "react-native";
import { AuthContext } from "../../contexts/AuthContext";
import saveToken from "../../utils/saveToken";
import saveUserInfo from "../../utils/saveUserInfo";
import ProgressHUD from "../../components/ProgressHUD";
import Icon from "react-native-vector-icons/Ionicons";
import CheckBox from "react-native-check-box";
import { signupRequest, loginWithOAuth } from "../../services/api/Api";
import { loginWithGoogle, loginWithFacebook } from "../../services/oauth";

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setIsLoggedIn } = useContext(AuthContext);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleSignup = async () => {
    if (!agreeToTerms) {
      Alert.alert(
        "Vui lòng đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư"
      );
      return;
    }

    if (
      username === "" ||
      name === "" ||
      email === "" ||
      password === "" ||
      confirmPassword === ""
    ) {
      Alert.alert("Vui lòng điền đầy đủ thông tin");
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

    signupRequest({
      username,
      name,
      email,
      password,
    })
      .then((response) => {
        Alert.alert(
          "Đăng ký thành công!",
          "Chúc mừng bạn đã đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản."
        );
        saveToken(response.data.token);
        saveUserInfo(response.data.user);
        setIsLoggedIn(true);
      })
      .catch((error) => {
        Alert.alert("Đăng ký thất bại", error.response.data.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleGoogleSignup = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      const oauthResult = await loginWithGoogle();

      const response = await loginWithOAuth({
        provider: oauthResult.provider,
        accessToken: oauthResult.accessToken,
        idToken: oauthResult.idToken,
        profile: oauthResult.profile,
      });

      if (response.data && response.data.token) {
        saveToken(response.data.token);
        saveUserInfo(response.data.user);
        setIsLoggedIn(true);
      } else {
        throw new Error("Phản hồi từ server không hợp lệ");
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi khi đăng ký với Google. Vui lòng thử lại.";

      Alert.alert("Đăng ký thất bại", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignup = async () => {
    // Prevent multiple clicks
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      const oauthResult = await loginWithFacebook();

      const response = await loginWithOAuth({
        provider: oauthResult.provider,
        accessToken: oauthResult.accessToken,
        idToken: oauthResult.idToken,
        profile: oauthResult.profile,
      });

      if (response.data && response.data.token) {
        saveToken(response.data.token);
        saveUserInfo(response.data.user);
        setIsLoggedIn(true);
      } else {
        throw new Error("Phản hồi từ server không hợp lệ");
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi khi đăng ký với Facebook. Vui lòng thử lại.";

      Alert.alert("Đăng ký thất bại", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText="Đang đăng ký..." visible={loading} />
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Đăng ký</Text>
              <Text style={styles.subtitle}>Tạo một tài khoản để tiếp tục</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tên đăng nhập</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john_doe"
                  placeholderTextColor="#999"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Họ và tên</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Địa chỉ Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="hello@example.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••••••"
                    placeholderTextColor="#999"
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
                    placeholderTextColor="#999"
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

              <View style={styles.checkboxContainer}>
                <CheckBox
                  isChecked={agreeToTerms}
                  onClick={() => {
                    setAgreeToTerms(!agreeToTerms);
                  }}
                  checkBoxColor="#319527"
                />
                <Text style={styles.checkboxLabel}>
                  Tôi đồng ý với{" "}
                  <Text style={styles.link}>Điều khoản sử dụng</Text> và{" "}
                  <Text style={styles.link}>Chính sách quyền riêng tư</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.signUpButton}
                onPress={handleSignup}
              >
                <Text style={styles.signUpButtonText}>Tạo tài khoản</Text>
              </TouchableOpacity>

              <View style={styles.orContainer}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>hoặc đăng ký bằng</Text>
                <View style={styles.orLine} />
              </View>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignup}
              >
                <Image
                  source={require("../../assets/google.png")}
                  style={{ width: 24, height: 24 }}
                />
                <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.facebookButton}
                onPress={handleFacebookSignup}
              >
                <Icon name="logo-facebook" size={24} color="#1877F2" />
                <Text style={styles.facebookButtonText}>
                  Tiếp tục với Facebook
                </Text>
              </TouchableOpacity>

              <View style={styles.loginPrompt}>
                <Text style={styles.loginPromptText}>Đã có tài khoản?</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.loginLink}>Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
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
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  link: {
    color: "#319527",
  },
  signUpButton: {
    backgroundColor: "#319527",
    height: 50,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  signUpButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  orText: {
    paddingHorizontal: 16,
    color: "#666",
    fontSize: 14,
  },
  googleButton: {
    height: 48,
    borderRadius: 38,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleButtonText: {
    fontSize: 16,
    color: "#666",
  },
  facebookButton: {
    marginTop: -5,
    height: 48,
    borderRadius: 38,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  facebookButtonText: {
    fontSize: 16,
    color: "#666",
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  loginPromptText: {
    fontSize: 14,
    color: "#666",
  },
  loginLink: {
    fontSize: 14,
    color: "#319527",
    fontWeight: "600",
  },
});

export default SignupScreen;
