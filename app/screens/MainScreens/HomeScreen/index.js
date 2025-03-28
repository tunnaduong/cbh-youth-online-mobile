import React, { useContext } from "react";
import { View, Text, StyleSheet, Button, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "../../../contexts/AuthContext";
import { AnimationContext } from "../../../contexts/AnimationContext";

const HomeScreen = () => {
  const { setIsLoggedIn } = useContext(AuthContext);
  const { animatedValue, overlayValue } = useContext(AnimationContext);

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      setIsLoggedIn(false);
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: animatedValue }]}>
      <Text style={styles.title}>Welcome to the Home Screen</Text>
      <Button title="Đăng xuất" onPress={handleLogout} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

export default HomeScreen;
