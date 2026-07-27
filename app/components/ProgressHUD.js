import LottieView from "lottie-react-native";
import React from "react";
import { View, Text, Modal, StyleSheet } from "react-native";

// `progress` (0-100) is optional - when provided (e.g. tracking a large video
// upload via onUploadProgress) a bar + percentage render under the spinner
// instead of leaving the user staring at an indeterminate spinner for a
// potentially long, large-file upload. Omit it for the plain spinner HUD.
const ProgressHUD = ({ visible, loadText, noBackground = false, progress = null }) => {
  const hasProgress = typeof progress === "number" && !Number.isNaN(progress);
  const clampedProgress = hasProgress ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => null}
      visible={visible}
      transparent={true}
    >
      <View style={[styles.container, !noBackground && styles.background]}>
        <View style={styles.hud}>
          {/* <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" /> */}
          <LottieView
            source={require("../assets/refresh.json")}
            style={{
              width: 50,
              height: 50,
            }}
            loop
            autoPlay
          />
          <Text style={styles.text}>{loadText}</Text>
          {hasProgress && (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${clampedProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(clampedProgress)}%</Text>
            </>
          )}
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
    minWidth: 160,
  },
  text: {
    color: "white",
    marginTop: 10,
    textAlign: "center",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  progressText: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ProgressHUD;
