import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

// Simple header component
const SimpleHeader = ({ title }) => (
  <View style={styles.simpleContainer}>
    <Text style={styles.simpleTitle}>{title}</Text>
  </View>
);

// Feature-rich header component
const FeatureHeader = ({
  title,
  icon,
  action,
  havingBorder = false,
  havingIcon = false,
  setSetting,
}) => (
  <View>
    <View style={havingBorder ? styles.containerWithBorder : styles.container}>
      <TouchableOpacity onPress={() => setSetting((setting) => !setting)}>
        <Ionicons name={"menu"} size={27} color="black" />
      </TouchableOpacity>
      {havingIcon ? (
        <SafeAreaView className="-mt-1">
          <View style={styles.logoContainer}>
            <Image
              style={styles.logo}
              source={require("../assets/logo.png")}
              resizeMode="contain"
            />
            <View className="ml-1">
              <Text className="text-[#319527]">Thanh niên</Text>
              <Text className="font-bold -mt-1 text-[#319527]">
                Chuyên Biên Hòa Online
              </Text>
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}

      <SafeAreaView className="-mt-1">
        <TouchableOpacity onPress={action}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={23} color="black" />
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  </View>
);

// Main component that decides which header to render
const SameHeader = (props) => {
  if (props.defaultStyle) {
    return <SimpleHeader title={props.title} />;
  }
  return <FeatureHeader {...props} />;
};

// Extract all styles to a separate object
const styles = {
  simpleContainer: {
    backgroundColor: "white",
  },
  simpleTitle: {
    textAlign: "center",
    fontWeight: "500",
    fontSize: 18,
    flex: 1,
  },
  container: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
  },
  containerWithBorder: {
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
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 35,
    height: 35,
  },
  title: {
    fontSize: 25,
    fontWeight: "bold",
    textAlign: "left",
    marginTop: 5,
  },
  iconContainer: {
    backgroundColor: "rgba(0,0,0,0.10)",
    padding: 5,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 100,
  },
};

export default SameHeader;
