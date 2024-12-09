import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import axiosInstance from "../../utils/axiosInstance";
import saveToken from "../../utils/saveToken";

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // Perform login
    axiosInstance
      .post("/login", {
        username: email,
        password,
      })
      .then((response) => {
        console.log("Login successful:", response.data);

        // Save the token to AsyncStorage
        // AsyncStorage.setItem("auth_token", response.data.token);
        saveToken(response.data.token);

        // Navigate to the next screen if login is successful
        navigation.navigate("Home");
      })
      .catch((error) => {
        Alert.alert("Đăng nhập thất bại", error.response.data.message);
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thanh niên Chuyên Biên Hòa Online</Text>
      <TextInput
        style={styles.input}
        placeholder="Tên người dùng hoặc email"
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
      <Button title="Đăng nhập" onPress={handleLogin} />
    </View>
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