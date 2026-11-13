// Writes the time of the commit being built (epoch ms) into app.json as
// extra.commitTime. The app compares it with the commit time of an OTA update
// (sent when the update is published): an update whose commit is not newer than
// the running bundle's is the same code and must not be offered. The bundle
// build time cannot tell this - a base APK upgraded to the latest build
// finishes after the OTA of the same commit and used to look older.
//   node scripts/set-commit-time.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const seconds = Number(execSync("git log -1 --format=%ct").toString().trim());
if (!Number.isInteger(seconds) || seconds <= 0) {
  console.error("Could not read the commit time");
  process.exit(1);
}
const ms = seconds * 1000;

const file = path.join(__dirname, "..", "app.json");
const before = fs.readFileSync(file, "utf8");
let after;
if (/"commitTime"\s*:\s*\d+/.test(before)) {
  after = before.replace(/("commitTime"\s*:\s*)\d+/, `$1${ms}`);
} else {
  after = before.replace(/("minNativeBuild"\s*:\s*\d+)/, `$1,\n      "commitTime": ${ms}`);
}
if (JSON.parse(after).expo.extra.commitTime !== ms) {
  console.error("Could not set commitTime in app.json");
  process.exit(1);
}
fs.writeFileSync(file, after);
console.log(`commitTime set to ${ms}`);
