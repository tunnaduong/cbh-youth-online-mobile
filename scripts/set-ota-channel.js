// Sets the OTA update channel in app.json (updates.requestHeaders["expo-channel-name"])
// Usage: node scripts/set-ota-channel.js [production|preview]
const fs = require("fs");
const path = require("path");

let channel = process.argv[2];
if (!channel) {
  const branch = process.env.GITHUB_REF_NAME || "";
  channel = branch === "main" ? "production" : "preview";
}

if (channel !== "preview" && channel !== "production") {
  console.error("Usage: node scripts/set-ota-channel.js <production|preview>");
  process.exit(1);
}

const file = path.join(__dirname, "..", "app.json");
const before = fs.readFileSync(file, "utf8");

let after;
if (/"expo-channel-name"\s*:\s*"[^"]*"/.test(before)) {
  after = before.replace(/("expo-channel-name"\s*:\s*)"[^"]*"/, `$1"${channel}"`);
} else {
  const appJson = JSON.parse(before);
  if (!appJson.expo) appJson.expo = {};
  if (!appJson.expo.updates) appJson.expo.updates = {};
  if (!appJson.expo.updates.requestHeaders) appJson.expo.updates.requestHeaders = {};
  appJson.expo.updates.requestHeaders["expo-channel-name"] = channel;
  after = JSON.stringify(appJson, null, 2) + "\n";
}

// Verify update succeeded
const parsed = JSON.parse(after);
if (parsed?.expo?.updates?.requestHeaders?.["expo-channel-name"] !== channel) {
  console.error(`Failed to set channel ${channel} in app.json`);
  process.exit(1);
}

fs.writeFileSync(file, after);
console.log(`OTA channel set to ${channel} in app.json`);
