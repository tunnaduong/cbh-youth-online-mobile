import React from "react";
import { View, Text, StyleSheet, Dimensions, Image } from "react-native";

export const SLIDER_WIDTH = Dimensions.get("window").width;
export const ITEM_WIDTH = SLIDER_WIDTH;

const LoginCardCarousel = ({ item, index }) => {
  return (
    <View style={styles.container} key={index}>
      <View style={styles.outer} className="items-center px-6 gap-y-8">
        <Image source={item.imgUrl} style={{ width: 230, height: 230 }} />
        <View>
          <Text className="text-xl font-bold text-center">{item.title}</Text>
          <Text className="text-base text-center text-[#858585] mt-2">
            {item.body}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 15,
    width: ITEM_WIDTH,
    flex: 1,
    justifyContent: "flex-end",
  },
  header: {
    color: "white",
    fontSize: 30,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  body: {
    color: "white",
    fontSize: 20,
    textShadowColor: "rgba(0, 0, 0, 1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  outer: {
    marginBottom: 30,
  },
});

export default LoginCardCarousel;
