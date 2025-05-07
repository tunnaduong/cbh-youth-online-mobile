import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import LoginCarousel from "../../components/LoginCarousel";

const WelcomeScreen = ({ navigation }) => {
  const handleGetStarted = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.container} className="gap-y-8">
      <View className="items-center flex-1 gap-y-8 justify-end">
        <LoginCarousel />
      </View>
      <View className="w-full gap-y-8 justify-end flex-1 pb-10">
        <TouchableOpacity
          className="w-full bg-[#319527] p-3.5 rounded-full"
          onPress={handleGetStarted}
        >
          <Text
            style={styles.buttonText}
            className="text-center text-white text-base font-semibold"
          >
            Đăng nhập
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate("Signup");
          }}
        >
          <Text className="text-center text-base text-[#319527] font-semibold">
            Tạo tài khoản mới
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
});
