import React from "react";
import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";
import { LogBox } from "react-native";
import StartupErrorScreen from "./app/components/StartupErrorScreen";

// Prevent the native splash screen from hiding automatically
SplashScreen.preventAutoHideAsync().catch(() => {});

// A fatal JS error at launch is handed to expo-updates' ErrorRecovery, which -
// with no older update to fall back to - aborts the app (SIGABRT on its own
// queue, the original message lost). That is how the app crashed on launch on
// iOS 15. Fatal errors are caught here instead and shown on screen, so the
// app stays open and the message can be read and reported. This covers any
// fatal JS error at any time - at launch or later while the app is in use -
// and any component that throws while rendering. A crash inside native code
// never reaches JS and still closes the app.
let fatalError = null;
const fatalListeners = new Set();
const showFatal = (error) => {
  if (fatalError) return;
  fatalError = error instanceof Error ? error : new Error(String(error));
  SplashScreen.hideAsync().catch(() => {});
  fatalListeners.forEach((listener) => listener(fatalError));
};

// Release builds only: in development the red error screen is more useful.
const previousHandler = global.ErrorUtils?.getGlobalHandler?.();
global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  if (isFatal && !__DEV__) {
    showFatal(error);
    return;
  }
  previousHandler?.(error, isFatal);
});

// require, not import: imports are hoisted above the handler above, and an
// error thrown while the app's modules load must land in this try.
let App = null;
try {
  // Reanimated first: when it fails to start, libraries that load it lazily
  // (Skia's ReanimatedProxy) replace its error with "react-native-reanimated
  // is not installed!" - loading it here shows the real one.
  require("react-native-reanimated");
  require("./app/i18n");
  App = require("./App").default;

  const {
    configureReanimatedLogger,
    ReanimatedLogLevel,
  } = require("react-native-reanimated");
  configureReanimatedLogger({
    level: ReanimatedLogLevel.error,
    strict: false, // Reanimated runs in strict mode by default
  });
} catch (error) {
  showFatal(error);
}

LogBox.ignoreLogs([
  "Warning: Invalid prop `style` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.",
]);

// Render errors (a component throwing while mounting) end here too.
class RootErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    showFatal(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Root() {
  const [error, setError] = React.useState(fatalError);

  React.useEffect(() => {
    fatalListeners.add(setError);
    if (fatalError) setError(fatalError);
    return () => fatalListeners.delete(setError);
  }, []);

  if (error || !App) {
    return <StartupErrorScreen error={error || fatalError} />;
  }
  return (
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
