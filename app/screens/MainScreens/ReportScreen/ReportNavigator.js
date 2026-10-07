import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import ReportScreen from "./index";
import Step2 from "./Step2";
import Step3 from "./Step3";
import Success from "./Success";

const ReportStack = createStackNavigator();

export default function ReportNavigator({ route }) {
  return (
    <ReportStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      {/* The sidebar opens this flow as "student" or "class" violation:
          hand that to Step1 so the matching card starts selected. */}
      <ReportStack.Screen
        name="Step1"
        component={ReportScreen}
        initialParams={{ type: route?.params?.type }}
      />
      <ReportStack.Screen name="Step2" component={Step2} />
      <ReportStack.Screen name="Step3" component={Step3} />
      <ReportStack.Screen name="Success" component={Success} />
    </ReportStack.Navigator>
  );
}
