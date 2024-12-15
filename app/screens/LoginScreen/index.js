import React, { useState, useContext, useRef } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import axiosInstance from "../../utils/axiosInstance";
import saveToken from "../../utils/saveToken";
import saveUserInfo from "../../utils/saveUserInfo";
import { AuthContext } from "../../contexts/AuthContext";
import ProgressHUD from "../../components/ProgressHUD";

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setIsLoggedIn } = useContext(AuthContext);
  const passwordInputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    axiosInstance
      .post("/login", {
        username: email,
        password,
      })
      .then((response) => {
        console.log("Login successful:", response.data);
        saveToken(response.data.token);
        saveUserInfo(response.data.user);
        setIsLoggedIn(true);
      })
      .catch((error) => {
        Alert.alert("Đăng nhập thất bại", error.response.data.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <>
      <ProgressHUD loadText="Đang đăng nhập..." visible={loading} />
      <View style={styles.container}>
        <Text style={styles.title}>Thanh niên Chuyên Biên Hòa Online</Text>
        <TextInput
          style={styles.input}
          placeholder="Tên người dùng hoặc email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => {
            // Focus the password input when "Enter" is pressed on the email input
            passwordInputRef.current.focus();
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          ref={passwordInputRef}
        />
        <Button title="Đăng nhập" onPress={handleLogin} />
        <Button
          title="Đăng ký"
          onPress={() => {
            navigation.navigate("Signup");
          }}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
});

export default LoginScreen;
