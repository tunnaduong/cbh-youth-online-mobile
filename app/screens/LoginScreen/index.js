import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { AuthContext } from "../../contexts/AuthContext";
import ProgressHUD from "../../components/ProgressHUD";
import Icon from "react-native-vector-icons/Ionicons";
import { loginRequest, loginWithOAuth } from "../../services/api/Api";
import { loginWithGoogle, loginWithFacebook } from "../../services/oauth";
import * as AppleAuthentication from "expo-apple-authentication";

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then((available) => {
      console.log("Apple Auth Available:", available);
      setIsAppleAuthAvailable(available);
    }).catch((e) => console.log("Apple Auth Check Error:", e));
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);

    try {
      const response = await loginRequest({ username: email, password });

      // Save token and user info
      signIn(response.data.token, response.data.user);
    } catch (error) {
      // Show an error message to the user
      Alert.alert(
        "Đăng nhập thất bại",
        error.message || "Đã xảy ra lỗi. Vui lòng thử lại."
      );
    } finally {
      setLoading(false); // Ensure loading stops even if there's an error
    }
  };

  const handleGoogleLogin = async () => {
    // Prevent multiple clicks
    if (loading) {
      console.log("Google OAuth: Already processing, ignoring duplicate click");
      return;
    }

    setLoading(true);
    try {
      console.log("Starting Google OAuth login...");
      const oauthResult = await loginWithGoogle();

      console.log("Google OAuth result received:", {
        provider: oauthResult.provider,
        hasAccessToken: !!oauthResult.accessToken,
        hasIdToken: !!oauthResult.idToken,
        hasProfile: !!oauthResult.profile,
      });

      console.log("Calling backend API with OAuth data...");
      const response = await loginWithOAuth({
        provider: oauthResult.provider,
        accessToken: oauthResult.accessToken,
        idToken: oauthResult.idToken,
        profile: oauthResult.profile,
      });

      console.log("Backend API response:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });

      if (response.data && response.data.token) {
        console.log("OAuth login successful, signing in user...");
        signIn(response.data.token, response.data.user);
      } else {
        console.error(
          "Backend response missing token or user data:",
          response.data
        );
        throw new Error("Phản hồi từ server không hợp lệ");
      }
    } catch (error) {
      console.error("Google OAuth login failed - Full error:", {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        responseHeaders: error.response?.headers,
        stack: error.stack,
        error: error,
      });

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi khi đăng nhập với Google. Vui lòng thử lại.";

      Alert.alert("Đăng nhập thất bại", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    // Prevent multiple clicks
    if (loading) {
      console.log(
        "Facebook OAuth: Already processing, ignoring duplicate click"
      );
      return;
    }

    setLoading(true);
    try {
      console.log("Starting Facebook OAuth login...");
      const oauthResult = await loginWithFacebook();

      console.log("Facebook OAuth result received:", {
        provider: oauthResult.provider,
        hasAccessToken: !!oauthResult.accessToken,
        hasIdToken: !!oauthResult.idToken,
        hasProfile: !!oauthResult.profile,
      });

      console.log("Calling backend API with OAuth data...");
      const response = await loginWithOAuth({
        provider: oauthResult.provider,
        accessToken: oauthResult.accessToken,
        idToken: oauthResult.idToken,
        profile: oauthResult.profile,
      });

      console.log("Backend API response:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });

      if (response.data && response.data.token) {
        console.log("OAuth login successful, signing in user...");
        signIn(response.data.token, response.data.user);
      } else {
        console.error(
          "Backend response missing token or user data:",
          response.data
        );
        throw new Error("Phản hồi từ server không hợp lệ");
      }
    } catch (error) {
      console.error("Facebook OAuth login failed - Full error:", {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        responseHeaders: error.response?.headers,
        stack: error.stack,
        error: error,
      });

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Đã xảy ra lỗi khi đăng nhập với Facebook. Vui lòng thử lại.";

      Alert.alert("Đăng nhập thất bại", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const response = await loginWithOAuth({
        provider: "apple",
        idToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email,
        fullName: credential.fullName,
        user: credential.user,
      });

      if (response.data && response.data.token) {
        signIn(response.data.token, response.data.user);
      } else {
        throw new Error("Phản hồi từ server không hợp lệ");
      }
    } catch (error) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User canceled, do nothing
      } else {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Đã xảy ra lỗi khi đăng nhập với Apple. Vui lòng thử lại.";
        Alert.alert("Đăng nhập thất bại", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressHUD loadText="Đang đăng nhập..." visible={loading} />
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
              <Text style={styles.title}>Đăng nhập</Text>
              <Text style={styles.subtitle}>
                Chào mừng bạn trở lại ứng dụng
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tên người dùng hoặc email</Text>
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
                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={() => navigation.navigate("ForgotPassword")}
                >
                  <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
              >
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 16,
                }}
              >
                <View style={styles.line} />
                <Text style={styles.orText}>hoặc đăng nhập bằng</Text>
                <View style={styles.line} />
              </View>

              {isAppleAuthAvailable && (
                <TouchableOpacity
                  style={styles.appleButton}
                  onPress={handleAppleLogin}
                >
                  <Icon name="logo-apple" size={24} color="#000" />
                  <Text style={styles.appleButtonText}>Tiếp tục với Apple</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
              >
                <Image
                  source={require("../../assets/google.png")}
                  style={{ width: 24, height: 24 }}
                />
                <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.facebookButton}
                onPress={handleFacebookLogin}
              >
                <Icon name="logo-facebook" size={24} color="#1877F2" />
                <Text style={styles.facebookButtonText}>
                  Tiếp tục với Facebook
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  navigation.navigate("Signup");
                }}
              >
                <Text className="mt-1 text-center text-base text-[#319527] font-semibold">
                  Tạo tài khoản mới
                </Text>
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
  forgotPassword: {
    alignSelf: "flex-end",
  },
  forgotPasswordText: {
    color: "#319527",
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: "#319527",
    height: 50,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  orText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    paddingHorizontal: 16,
  },
  googleButton: {
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
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
  },
  appleButton: {
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
  appleButtonText: {
    fontSize: 16,
    color: "#666",
  },
});

export default LoginScreen;
