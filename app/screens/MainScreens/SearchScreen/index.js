import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Image,
  TextInput,
  TouchableHighlight,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function SearchScreen({ navigation }) {
  return (
    <SafeAreaView
      style={{
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 5 : 0,
      }}
    >
      <View style={styles.topBar}>
        <TouchableHighlight
          style={styles.backButton}
          underlayColor="rgba(0, 0, 0, .15)"
          onPress={() => {
            navigation.goBack();
          }}
        >
          <Ionicons name="chevron-back-outline" color="black" size={30} />
        </TouchableHighlight>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "#DFDEDD",
            borderRadius: 50,
            paddingLeft: 13,
            paddingVertical: Platform.OS === "android" ? 0 : 8,
          }}
        >
          <TextInput
            style={{
              fontSize: 17,
            }}
            placeholder={"Tìm kiếm trên CYO"}
            // onChangeText={onChangeText}
            // value={value}
            // onKeyPress={onKeyPress}
            autoFocus
          ></TextInput>
        </View>
      </View>
      <ScrollView>
        <View style={styles.searchImage}>
          <Image
            source={require("../../../assets/search-main.png")}
            style={styles.image}
          />
          <Text style={{ textAlign: "center", fontSize: 16, color: "gray" }}>
            Thử bắt đầu bằng cách tìm kiếm người dùng, bài viết, loa lớn...
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    backgroundColor: "rgba(0, 0, 0, 0)",
    width: 40,
    height: 40,
    borderRadius: 35,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 20,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#DFDEDD",
    paddingTop: 10,
    marginTop: -5,
  },
  searchImage: {
    height: Dimensions.get("window").height * 0.5,
    margin: 30,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 200,
    height: 200,
    resizeMode: "contain",
  },
});
