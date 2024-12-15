import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, ActivityIndicator } from "react-native";
import { AuthProvider, AuthContext } from "./app/contexts/AuthContext";
import LoginScreen from "./app/screens/LoginScreen";
import HomeScreen from "./app/screens/MainScreens/HomeScreen";
import SignupScreen from "./app/screens/SignupScreen";
import MainScreens from "./app/screens/MainScreens";

const Stack = createStackNavigator();

const App = () => {
  const { isLoggedIn, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#319527" />
        <Text>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isLoggedIn ? (
          <>
            <Stack.Screen
              options={{
                title: "Trang chính",
                headerShown: false,
                gestureEnabled: false,
                animation: "none",
              }}
              name="MainScreens"
              component={MainScreens}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);
