import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";

// Simple header component
const SimpleHeader = ({ title, theme }) => (
  <View style={[styles.simpleContainer, { backgroundColor: theme.background }]}>
    <Text style={[styles.simpleTitle, { color: theme.text }]}>{title}</Text>
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
  onLogoPress,
  theme,
  isDarkMode,
}) => (
  <View style={[
    havingBorder ? styles.containerWithBorder : styles.container,
    {
      backgroundColor: theme.headerBackground,
      borderColor: theme.border,
      borderBottomWidth: havingBorder ? StyleSheet.hairlineWidth : 0,
    }
  ]}>
    <TouchableOpacity onPress={() => setSetting((setting) => !setting)}>
      <Ionicons name={"menu-outline"} size={27} color={theme.text} />
    </TouchableOpacity>
    {havingIcon ? (
      <SafeAreaView style={{ marginTop: -4 }}>
        <TouchableOpacity
          onPress={onLogoPress}
          activeOpacity={0.7}
          style={styles.logoContainer}
        >
          <Image
            style={styles.logo}
            source={require("../assets/logo.png")}
            resizeMode="contain"
          />
          <View style={{ marginLeft: 4 }}>
            <Text style={{ color: theme.primary, fontWeight: "300" }}>
              Diễn đàn học sinh
            </Text>
            <Text style={{ color: theme.primary, fontWeight: "bold", marginTop: -2 }}>
              Chuyên Biên Hòa
            </Text>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    ) : (
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    )}

    <SafeAreaView style={{ marginTop: -4 }}>
      <TouchableOpacity onPress={action}>
        <View style={[styles.iconContainer, { backgroundColor: theme.iconBackground }]}>
          <Ionicons name={icon} size={23} color={theme.text} />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  </View>
);

// Main component that decides which header to render
const SameHeader = (props) => {
  const { theme, isDarkMode } = useTheme();

  if (props.defaultStyle) {
    return <SimpleHeader title={props.title} theme={theme} />;
  }
  return <FeatureHeader {...props} theme={theme} isDarkMode={isDarkMode} />;
};

// Extract all styles to a separate object
const styles = StyleSheet.create({
  simpleContainer: {
    paddingHorizontal: 15,
    height: 50,
    justifyContent: "center",
  },
  simpleTitle: {
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
  container: {
    width: "100%",
    height: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  containerWithBorder: {
    width: "100%",
    height: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "left",
  },
  iconContainer: {
    padding: 6,
    borderRadius: 20,
  },
});

export default SameHeader;
