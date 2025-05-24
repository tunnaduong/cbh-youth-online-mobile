import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

export const useCurrentRoute = () => {
  const [currentRoute, setCurrentRoute] = useState("Home");
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener("state", (e) => {
      // Get the state of the bottom tab navigator
      const bottomTabState = e.data.state?.routes?.[0]?.state;
      if (bottomTabState) {
        const currentRouteName =
          bottomTabState.routes[bottomTabState.index].name;
        setCurrentRoute(currentRouteName);
      }
    });

    return unsubscribe;
  }, [navigation]);

  return currentRoute;
};
