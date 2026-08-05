const { withAndroidManifest } = require("@expo/config-plugins");

// Android "bubbles" (floating chat heads) require the target Activity to
// declare itself resizable and embeddable, so the OS is allowed to render
// it inside the small bubble window instead of only full-screen. Nothing
// else about bubbles can be configured through app.json alone - the actual
// notification (channel + shortcut + BubbleMetadata) is posted natively,
// see modules/expo-chat-bubbles. This plugin only prepares the manifest.
const withChatBubbles = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application?.[0];
    if (!application) return config;

    const mainActivity = application.activity?.find(
      (activity) => activity.$["android:name"] === ".MainActivity"
    );
    if (!mainActivity) return config;

    mainActivity.$["android:resizeableActivity"] = "true";
    mainActivity.$["android:allowEmbedded"] = "true";

    return config;
  });
};

module.exports = withChatBubbles;
