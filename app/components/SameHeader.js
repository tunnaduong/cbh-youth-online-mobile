import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

const SameHeader = ({
  title,
  icon,
  action,
  havingBorder,
  havingIcon,
  defaultStyle,
}) => {
  if (defaultStyle) {
    // Default bar
    return (
      <View className="bg-white">
        <View>
          <Text className="text-center font-medium text-lg flex-1">
            {title}
          </Text>
        </View>
      </View>
    );
  } else {
    // Feed
    return (
      <View>
        <View
          style={
            havingBorder
              ? {
                  width: "100%",
                  height: "100%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "white",
                  borderBottomWidth: 0.2,
                  borderColor: "rgba(0,0,0,0.2)",
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: 0,
                  },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 7,
                }
              : {
                  width: "100%",
                  height: "100%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "white",
                }
          }
        >
          {havingIcon ? (
            <SafeAreaView>
              <TouchableOpacity
              //  style={{ marginTop: statusBarHeight }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    // marginLeft: 10,
                    // marginTop: 1.8,
                    // opacity: animatedOpacity,
                  }}
                >
                  <Image
                    style={{ width: 35, height: 35, marginBottom: 5 }}
                    source={require("../assets/logo.png")}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
            </SafeAreaView>
          ) : (
            <Text
              style={{
                fontSize: 25,
                fontWeight: "bold",
                textAlign: "left",
                // marginLeft: 15,
                marginTop: 5,
                // opacity: animatedOpacity,
              }}
            >
              {title}
            </Text>
          )}
          <SafeAreaView>
            <TouchableOpacity
              onPress={action}
              // style={{ marginTop: statusBarHeight }}
            >
              <View
                style={{
                  // marginRight: 13,
                  backgroundColor: "rgba(0,0,0,0.10)",
                  padding: 5,
                  paddingLeft: 6,
                  paddingRight: 6,
                  borderRadius: 100,
                  marginBottom: 5,
                  // opacity: animatedOpacity,
                }}
              >
                <Ionicons name={icon} size={23} color={"black"} />
              </View>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    );
  }
};

export default SameHeader;
