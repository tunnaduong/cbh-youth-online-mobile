import React, { useState, useContext } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import axiosInstance from "../../utils/axiosInstance";
import { AuthContext } from "../../contexts/AuthContext";
import saveToken from "../../utils/saveToken";
import saveUserInfo from "../../utils/saveUserInfo";
import ProgressHUD from "../../components/ProgressHUD";

const SignupScreen = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setIsLoggedIn } = useContext(AuthContext);

  const handleSignup = () => {
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

    axiosInstance
      .post("/register", {
        username,
        name,
        email,
        password,
      })
      .then((response) => {
        console.log("Register successful:", response.data);
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

  return (
    <>
      <ProgressHUD loadText="Đang đăng ký..." visible={loading} />
      <View style={styles.container}>
        <Text style={styles.title}>Thanh niên Chuyên Biên Hòa Online</Text>
        <TextInput
          style={styles.input}
          placeholder="Tên đăng nhập"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Họ và tên"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Xác nhận mật khẩu"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Button title="Đăng ký" onPress={handleSignup} />
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

export default SignupScreen;
