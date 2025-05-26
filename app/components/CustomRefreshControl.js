import React from "react";
import { RefreshControl } from "react-native";
import CustomLoading from "./CustomLoading";

const CustomRefreshControl = ({
  refreshing,
  onRefresh,
  progressViewOffset,
}) => {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      progressViewOffset={progressViewOffset}
      tintColor="#319527"
      colors={["#319527"]}
      style={{ backgroundColor: "transparent" }}
    />
  );
};

export default CustomRefreshControl;
