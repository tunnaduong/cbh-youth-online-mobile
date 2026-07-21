# iOS Deep Linking Setup Guide

## ✅ What Has Been Completed

### 1. Created Apple App Site Association File
- **File**: `apple-app-site-association` (in project root)
- **Purpose**: This file must be deployed to your web server at: `https://chuyenbienhoa.com/.well-known/apple-app-site-association`
- **Current Content**: Configured with placeholder `TEAM_ID` that you need to replace with your actual Apple Developer Team ID

### 2. Updated Info.plist
- Added `NSUserActivityTypes` to support universal links
- Added `NSAppLinksUsageDescription` for user permission clarity
- Custom scheme `com.fatties.youth` already registered

### 3. Updated app.json  
- Added `associatedDomains` configuration for universal links
- Added `NSUserActivityTypes` to infoPlist
- Configured with your domain: `applinks:chuyenbienhoa.com`

### 4. Enhanced AppDelegate.swift
- Added proper deep link handling for both custom schemes and universal links
- Routes all deep links through React Native's linking system
- Handles:
  - Custom scheme: `com.fatties.youth://story/{id}` and `com.fatties.youth://post/{slug}`
  - Universal links: `https://chuyenbienhoa.com/story/{id}` and `https://chuyenbienhoa.com/post/{slug}`

---

## 📋 What You Still Need to Do

### Step 1: Deploy apple-app-site-association to Your Web Server
1. Take the `apple-app-site-association` file from your project root
2. Upload it to your web server at: `https://chuyenbienhoa.com/.well-known/apple-app-site-association`
3. Ensure the file is served with MIME type `application/json`
4. Verify it's accessible: Visit `https://chuyenbienhoa.com/.well-known/apple-app-site-association` in a browser

**IMPORTANT**: Replace `TEAM_ID` in the file with your actual Apple Developer Team ID before uploading!

### Step 2: Update the apple-app-site-association File with Your Team ID
1. Get your Apple Developer Team ID from Apple Developer Console
2. Replace `TEAM_ID` in `apple-app-site-association` file with your actual ID (e.g., `ABC123XYZ9.com.fatties.youth`)
3. The final appID should look like: `ABC123XYZ9.com.fatties.youth`

### Step 3: Enable Associated Domains in Xcode
1. Open your Xcode project: `ios/CBHOnline.xcodeproj`
2. Select the `CBHOnline` target
3. Go to **Signing & Capabilities**
4. Click **+ Capability** and add **Associated Domains**
5. Add the domain: `applinks:chuyenbienhoa.com`

### Step 4: Enable the Capability in Your Apple Developer Profile
1. Go to [developer.apple.com](https://developer.apple.com)
2. In Certificates, Identifiers & Profiles → Identifiers
3. Select your app identifier (`com.fatties.youth`)
4. Enable **Associated Domains** capability
5. Regenerate your provisioning profile

### Step 5: Test on a Real iPhone Device
1. Build and deploy to a real iPhone (not simulator)
2. Open Xcode and check the device logs for any SSL certificate issues
3. Test deep links by:
   - Opening Safari and navigating to `https://chuyenbienhoa.com/story/123`
   - Tapping on a story link in the web app
   - Try the custom scheme: `com.fatties.youth://story/123`

### Step 6: Verify Your React Native Deep Linking Handler
Your mobile app's React Native code should already be handling these links. Verify in your navigation:
- When a deep link comes in, it should parse the path
- Route to the correct screen based on:
  - `story/{id}` → Story detail screen
  - `post/{slug}` → Post detail screen

---

## 🔗 Deep Link URL Formats

### Custom Scheme (Always Works)
```
com.fatties.youth://story/123
com.fatties.youth://post/awesome-post
com.fatties.youth://oauth
```

### Universal Links (iOS 9+)
```
https://chuyenbienhoa.com/story/123
https://chuyenbienhoa.com/post/awesome-post
```

---

## 🚨 Troubleshooting

### "App not opening from links"
- Verify `apple-app-site-association` is deployed at the correct path
- Check that it's served as `application/json` (not `text/plain`)
- Make sure TEAM_ID is replaced with your actual Apple Team ID
- Ensure domain matches what's in your provisioning profile

### "SSL certificate error"
- Check Xcode device logs (`Window > Devices and Simulators > Device > View Device Logs`)
- Ensure your web server's SSL certificate is valid
- Try on WiFi with a different network if issues persist

### "Only works on simulator, not on real device"
- Real device validation is stricter for universal links
- Must use real iPhone device to test (not simulator)
- Ensure provisioning profile has Associated Domains capability

### "Custom scheme works but universal links don't"
- Verify the domain in `applinks:chuyenbienhoa.com` is correct
- Check that `apple-app-site-association` is at the right URL
- Wait 24-48 hours for iOS to refresh its cache (clear app data to force refresh)

---

## 📱 Testing Checklist

- [ ] `apple-app-site-association` file deployed to `https://chuyenbienhoa.com/.well-known/apple-app-site-association`
- [ ] File verified accessible from browser
- [ ] TEAM_ID replaced with actual Apple Developer Team ID
- [ ] Associated Domains capability enabled in Xcode
- [ ] Associated Domains capability enabled in Apple Developer profile
- [ ] New provisioning profile generated with Associated Domains
- [ ] App rebuilt with updated provisioning profile
- [ ] Tested on real iPhone device (not simulator)
- [ ] Custom scheme links work: `com.fatties.youth://story/123`
- [ ] Universal links work: `https://chuyenbienhoa.com/story/123`
