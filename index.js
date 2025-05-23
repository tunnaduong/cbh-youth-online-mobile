import { registerRootComponent } from "expo";

import App from "./App";

import { LogBox } from "react-native";

import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.error,
  strict: false, // Reanimated runs in strict mode by default
});

LogBox.ignoreLogs([
  "Warning: Invalid prop `style` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.",
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
