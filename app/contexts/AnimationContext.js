import React, { createContext } from "react";
import { Animated } from "react-native";

export const AnimationContext = createContext();

export function AnimationProvider({ children }) {
  const animatedValue = new Animated.Value(1); // Initialize Animated.Value
  const overlayValue = new Animated.Value(0); // Another Animated.Value

  return (
    <AnimationContext.Provider value={{ animatedValue, overlayValue }}>
      {children}
    </AnimationContext.Provider>
  );
}
