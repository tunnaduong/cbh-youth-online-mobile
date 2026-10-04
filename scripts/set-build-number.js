// Writes one build number into app.json for both platforms
// (ios.buildNumber, android.versionCode). Used by the GitHub workflows, where
// the number is the workflow's run number:
//   node scripts/set-build-number.js 890
// Edits the two values in place so the rest of the file keeps its formatting.
const fs = require("fs");
const path = require("path");

const number = Number(process.argv[2] || process.env.BUILD_NUMBER);
if (!Number.isInteger(number) || number <= 0) {
  console.error("Usage: node scripts/set-build-number.js <positive integer>");
  process.exit(1);
}

const file = path.join(__dirname, "..", "app.json");
const before = fs.readFileSync(file, "utf8");
const after = before
  .replace(/("buildNumber"\s*:\s*)"\d+"/, `$1"${number}"`)
  .replace(/("versionCode"\s*:\s*)\d+/, `$1${number}`);

// Fail loudly rather than build with a stale number.
const config = JSON.parse(after).expo;
if (config.ios.buildNumber !== String(number) || config.android.versionCode !== number) {
  console.error("Could not set the build number in app.json");
  process.exit(1);
}

fs.writeFileSync(file, after);
console.log(`Build number set to ${number}`);
