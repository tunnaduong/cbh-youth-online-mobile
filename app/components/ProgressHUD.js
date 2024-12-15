import React from "react";
import { View, Text, Modal, ActivityIndicator, StyleSheet } from "react-native";

const ProgressHUD = ({ visible, loadText, noBackground = false }) => {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => null}
      visible={visible}
      transparent={true}
    >
      <View style={[styles.container, !noBackground && styles.background]}>
        <View style={styles.hud}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
          <Text style={styles.text}>{loadText}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  background: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  hud: {
    borderRadius: 10,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
  },
  text: {
    color: "white",
    marginTop: 10,
  },
});

export default ProgressHUD;
