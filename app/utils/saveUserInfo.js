import AsyncStorage from "@react-native-async-storage/async-storage";

// Function to save the user info in AsyncStorage
const saveUserInfo = async (info) => {
  try {
    await AsyncStorage.setItem("user_info", JSON.stringify(info));
  } catch (error) {
    console.error("Error saving user info to AsyncStorage:", error);
  }
};

export default saveUserInfo;
