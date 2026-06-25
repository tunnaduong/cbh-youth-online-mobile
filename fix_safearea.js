const fs = require('fs');
const files = [
    "app/screens/MainScreens/ActivityScreen/index.js",
    "app/screens/MainScreens/ExploreScreen/index.js",
    "app/screens/MainScreens/ForumScreen/CategoryScreen.js",
    "app/screens/MainScreens/ForumScreen/index.js",
    "app/screens/MainScreens/ProfileDetailScreen/index.js",
    "app/screens/MainScreens/ReportScreen/Step2.js",
    "app/screens/MainScreens/ReportScreen/Step3.js",
    "app/screens/MainScreens/ReportScreen/Success.js",
    "app/screens/MainScreens/ReportScreen/index.js",
    "app/screens/MainScreens/SettingsScreen/AboutScreen.js",
    "app/screens/MainScreens/SettingsScreen/BlockedUsersScreen.js",
    "app/screens/MainScreens/SettingsScreen/NotificationSettingsScreen.js",
    "app/screens/MainScreens/SettingsScreen/PrivacyPolicyScreen.js",
    "app/screens/MainScreens/SettingsScreen/SecurityScreen.js",
    "app/screens/MainScreens/SettingsScreen/TermsOfServiceScreen.js",
    "app/screens/MainScreens/SettingsScreen/index.js"
];

files.forEach(f => {
    let path = `/home/masterlegendpvp/cbh-youth-online-mobile/${f}`;
    if (fs.existsSync(path)) {
        let content = fs.readFileSync(path, 'utf8');
        content = content.replace(/<SafeAreaView/g, '<View');
        content = content.replace(/<\/SafeAreaView>/g, '</View>');
        fs.writeFileSync(path, content);
        console.log("Fixed", f);
    }
});
