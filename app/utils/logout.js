import AsyncStorage from "@react-native-async-storage/async-storage";

const logout = async () => {
  try {
    await AsyncStorage.removeItem("auth_token");
    // Add any other logout logic here, e.g., navigating to the login screen
    console.log("User logged out successfully");
  } catch (error) {
    console.error("Error logging out:", error);
  }
};

export default logout;
