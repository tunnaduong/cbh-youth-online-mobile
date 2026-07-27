const { withMainActivity } = require("@expo/config-plugins");

// android:launchMode="singleTask" (set by React Native/Expo by default) means
// a second intent delivered to an already-running app - e.g. tapping a push
// notification while the app is open, or any deep link opened while already
// running - goes to onNewIntent(), not a fresh onCreate(). MainActivity
// doesn't override onNewIntent by default, so getIntent() keeps returning the
// ORIGINAL launch intent forever, and nothing (expo-notifications' tap
// detection included) ever sees the new one: a first ("cold start")
// notification tap works, but a second tap while the app is already running
// does nothing at all - not even reaching JS. setIntent() is what makes the
// new intent visible to getIntent() and to any native module reading it on
// resume.
//
// This is a config plugin (not a hand-edit of android/) because this is an
// Expo prebuild/CNG project - android/ is regenerated from scratch on
// `expo prebuild`, so a direct edit there would be silently wiped out.
const withOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    const src = config.modResults.contents;

    if (src.includes("override fun onNewIntent")) {
      return config; // Already patched.
    }

    if (config.modResults.language === "kt") {
      config.modResults.contents = src
        .replace(
          /import android\.os\.Bundle/,
          "import android.content.Intent\nimport android.os.Bundle",
        )
        .replace(
          /(override fun onCreate\(savedInstanceState: Bundle\?\) \{[\s\S]*?\n  \}\n)/,
          `$1
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`,
        );
    } else {
      // Java fallback, in case this project's MainActivity is ever
      // generated as Java instead of Kotlin.
      config.modResults.contents = src
        .replace(
          /import android\.os\.Bundle;/,
          "import android.content.Intent;\nimport android.os.Bundle;",
        )
        .replace(
          /(protected void onCreate\(Bundle savedInstanceState\) \{[\s\S]*?\n  \}\n)/,
          `$1
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
  }
`,
        );
    }

    return config;
  });
};

module.exports = withOnNewIntent;
