import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import ReportScreen from "./index";
import Step2 from "./Step2";
import Step3 from "./Step3";

const ReportStack = createStackNavigator();

export default function ReportNavigator() {
  return (
    <ReportStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      <ReportStack.Screen name="Step1" component={ReportScreen} />
      <ReportStack.Screen name="Step2" component={Step2} />
      <ReportStack.Screen name="Step3" component={Step3} />
    </ReportStack.Navigator>
  );
}
