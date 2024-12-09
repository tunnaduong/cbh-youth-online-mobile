import AsyncStorage from "@react-native-async-storage/async-storage";

// Function to save the token in AsyncStorage
const saveToken = async (token) => {
  try {
    await AsyncStorage.setItem("auth_token", token);
  } catch (error) {
    console.error("Error saving token to AsyncStorage:", error);
  }
};

export default saveToken;
