# INFO — CBH Youth Online — Mobile

> **For AI agents.** Project map for agents working in this repo: how it connects to the sibling repos, features, structure, setup, conventions and recent work. Humans: see `README.md`. Keep this file current - add to **Recent work** and update other sections whenever you change the repo.

- **Default branch: `dhphuc`** - work, commit and push there unless the user names another branch; it reaches `main` through a PR.

Expo / React Native app for **CBH Youth Online (CYO)**, the student forum and social network of THPT Chuyên Biên Hòa (Hà Nam). Store name "CBH Online", bundle/package `com.fatties.youth`.

This README is written so a new contributor — human or AI agent — can pick the repo up cold: what the app does, how it is laid out, how to run it, the conventions to follow, and what changed recently.

---

## 1. The CBH system (sibling repos)

| Repo (local path) | What it is | Talks to |
| --- | --- | --- |
| `cbh-youth-online-mobile` (this) | Expo app (iOS/Android) | API over HTTPS + Reverb websockets |
| [cbh-youth-online-api](https://github.com/tunnaduong/cbh-youth-online-api) | Laravel API — `https://api.chuyenbienhoa.com/v1.0/...`, Sanctum bearer tokens, Reverb (chat/realtime) | DB, push, mail |
| [cbh-youth-online-next-js](https://github.com/tunnaduong/cbh-youth-online-next-js) | Next.js web site — `https://chuyenbienhoa.com` (+ `/admin` dashboard) | API |
| [cbh-youth-online-gift-shop](https://github.com/tunnaduong/cbh-youth-online-gift-shop) | Next.js gift shop — `https://giftshop.chuyenbienhoa.com` | API |

How they connect:
- **Auth**: the app stores its Sanctum token in AsyncStorage (`auth_token`) and sends `Authorization: Bearer` (see `app/services/api/axiosInstance.js`). The web sites share one `auth_token` cookie on `.chuyenbienhoa.com`.
- **App → web login**:
  - In-app browser (`openInAppBrowser`, SFSafariViewController / Custom Tabs): a one-time code from `POST /v1.0/web-session/handoff`, opened as `https://<site>/auth/set-token?code=…&return=…`; the site redeems it at `POST /v1.0/web-session/redeem`. Done once per app login (`app/utils/webSession.js` → `withWebSession`).
  - App-owned WebViews: `webViewBootScript` injects the cookie for the current account before each load (plus app mode + theme, below).
- **App mode**: web pages opened by the app get `?app=true` and a `sessionStorage.cbh_app_mode` flag; the sites then hide sign-out, splash, "get the app" banners and off-site links.
- **Deep links**: scheme `com.fatties.youth://` (`post/<id>`, `story/<id>`, `group/<token>`, `oauth`) and universal links on `chuyenbienhoa.com` / `www.chuyenbienhoa.com` (`app.json` `associatedDomains` / intent filters). Routing lives in `App.js` (`navigateToDeepLinkTarget`); in-content CBH links open native screens via `resolveInAppRoute` in `app/utils/externalLink.js`.

---

## 2. Features

- **Onboarding & auth**: welcome carousel, language select (vi/en/ru), first-launch settings, login/signup, forgot password, email verification, Google/Facebook OAuth (PKCE, `app/services/oauth.js`), Apple sign-in, multi-account switcher (`AccountSwitcher`, `utils/savedAccounts.js`).
- **Feed & posts**: infinite home feed, create/edit post (rich text, images, video upload, YouTube/SoundCloud share), votes with voter lists, comments with mentions and slash commands, saved/liked posts, share/forward, OG link preview cards (`LinkPreviewCard`, `utils/linkPreview.js`), link-safety interstitial for external URLs (`LinkSafetyScreen`).
- **Forum**: categories/subforums (`ForumScreen`, `CategoryScreen`), Youth Union news category.
- **Stories**: Instagram-style stories (create with overlays/music, react, reply, viewers sheet, archive).
- **Chat**: 1-1 and group conversations, realtime via Laravel Echo + Reverb (`ChatSocketContext`, `services/echo`), typing, reactions, replies, forwarding, media gallery, chat backgrounds, group info / invites.
- **Notifications**: Expo push (`services/notifications/ExpoNotificationService.js`, `NotificationContext`), unread badges (`UnreadCountsContext`), tap routing (`utils/notificationRouting.js`).
- **Profile**: profile/detail screens, edit profile, Discord-style customization (avatar frames, name fonts/effects, profile effects; `ProfileCustomizerScreen`, `components/profile`, `utils/profileTheme.js`), points milestones, member ranking.
- **Points**: point wallet, deposit/withdraw, gift points (`GiftPointsModal`).
- **Explore**: games (web, in WebView), quizzes + custom quizzes, universities, study materials (view/upload).
- **Reports & feedback**: multi-step student/class violation reports (`ReportScreen/ReportNavigator`), bug report / feedback screen, shake-to-report with screenshot (`ShakeToReport`).
- **Web apps in the app**: sidebar entries **Gift shop** (everyone) and **Admin** (only `userInfo.role === "admin"`), both `WebAppScreen` (see §5).
- **Settings**: theme (light/dark/system, liquid glass toggle, video autoplay), language, security, blocked users, notification settings, student verification, about, terms/privacy, dev console, easter egg (long-press About).
- **Other**: share-intent (`expo-share-intent`), OTA updates (`expo-updates`, channels `preview`/`production`), responsive layout for tablets/foldables (`utils/responsive.js`), in-process "cold restart" (`SessionContext`).

---

## 3. Project structure

```
App.js                     Root: providers, navigation stacks (logged-in + auth), deep-link handling, screen registry
index.js                   Expo entry
app.json / eas.json        Expo config (version, icons, plugins, deep links) / EAS build profiles
patches/                   patch-package patches (applied on npm install); *.patch.old are retired
android/, ios/             Native projects (dev client / bare builds)
app/
  assets/                  Icons (seasonal + iOS 26 variants), splash, Lottie, fonts
  components/              Shared UI
    Sidebar.js             Drawer menu (Utilities / Settings / Support sections)
    PostItem.js            Feed post card (largest component)
    LiquidButton.js        Floating glass button used by native screen headers
    GlassModules.js        Liquid-glass wrappers + AndroidGlassBackdrop
    WebViewHeader.js       Plain solid header for WebView screens
    profile/               Profile customization pieces
    StoryOverlays/         Story text/sticker/music overlays
  contexts/                Auth, Theme, Feed, Notification, ChatSocket, UnreadCounts, BottomSheet, StatusBar, Session, Animation
  global/storage.js        MMKV instance (fast local cache / prefs)
  hooks/                   useStatusBarUpdate/useStatusBarStyle, useUnreadCounts, useCurrentRoute
  i18n/                    i18next setup + locales/en.json, vi.json, ru.json
  screens/
    WelcomeScreen, LanguageSelectScreen, FirstLaunchSettingsScreen, LoginScreen, SignupScreen, ForgotPasswordScreen, TwoFactorChallengeScreen
    MainScreens/
      index.js             Bottom tabs: Home, Forum, Create, Chat, Notifications
      HomeScreen, ForumScreen, PostScreen, CreatePostScreen, PostEditScreen, CreateStoryScreen
      ChatScreen/          Conversation list, ConversationScreen, groups, MediaGalleryScreen
      ProfileScreen, ProfileDetailScreen, EditProfileScreen, ProfileCustomizerScreen
      ExploreScreen/       Games, Quiz, University, StudyMaterial*, Upload
      ReportScreen/        Step1-3 + Success (own stack)
      SettingsScreen/      Settings + sub-screens (About, Security, TwoFactor, Devices, Privacy, EasterEgg, DevConsole, ...)
      PointWalletScreen/   Wallet, Deposit, Withdraw
      WebAppScreen/        Gift shop / Admin WebView host
      FeedbackScreen, LinkSafetyScreen, MemberRankingScreen, NotificationScreen, SearchScreen, ...
  services/
    api/                   axiosInstance (base URL + token interceptor), ApiByAxios helpers, Api.js endpoints
    echo/                  Laravel Echo / Pusher-protocol client for Reverb
    notifications/         Expo push registration + handlers
    oauth.js, musicSearch.js
  utils/
    externalLink.js        URL parsing, trusted hosts, in-app routes, openInAppBrowser, link-safety tokens
    webSession.js          App→web login handoff (withWebSession) + webViewBootScript
    responsive.js          Tablet/large-screen layout helpers
    deviceInfo.js          Device headers sent to the API + remembered two-factor device token
    ...                    formatting, mentions, media download, chat helpers, saved accounts
```

---

## 4. Setup, run, build

Requirements: Node 18+ / npm, EAS CLI (devDependency `eas-cli`), Android Studio + JDK 17 for Android, Xcode + CocoaPods (macOS) for iOS. Push and OAuth need a real device.

```bash
npm install            # postinstall runs patch-package (patches/)
npm start              # expo start --dev-client  (needs an installed dev-client build)
npm run android        # expo run:android  (build + install dev client locally)
npm run ios            # expo run:ios
```

EAS (`eas.json`, `appVersionSource: local` — bump `app.json` version / buildNumber yourself):
```bash
eas build --profile development --platform ios|android   # dev client, internal
eas build --profile preview --platform android            # internal APK, channel "preview"
eas build --profile production --platform ios|android     # AAB / IPA, channel "production"
eas submit --profile production
```

Config points:
- API base URL: `app/services/api/axiosInstance.js` (`https://api.chuyenbienhoa.com/`).
- OAuth client ids / redirect: `app/services/oauth.js`.
- Expo project id: `app.json` → `expo.projectId`.
- `package.json` `expo.install.exclude` pins react-native-screens / gesture-handler / keyboard-controller — don't let `expo install --fix` bump them.

There are no automated tests; verify on device. Quick syntax check for a file:
`node -e "require('@babel/core').transformFileSync('<file>',{presets:['babel-preset-expo']})"`.

---

## 5. Conventions

- **Strings**: every user-facing string goes through i18next (`useTranslation`, `t("section.key")`) with keys added to **all three** of `app/i18n/locales/en.json`, `vi.json`, `ru.json`. When editing those files, insert keys textually — re-serializing the JSON reformats unrelated one-line blocks.
- **Theme**: colors come from `useTheme()` (`theme.primary/text/subText/background/surface/border`, `isDarkMode`, `liquidGlassEnabled`). No hard-coded palette except brand accents already in use.
- **Headers**:
  - Native screens: floating header — `LiquidButton` (pass `scrollY`) + title that fades on scroll, content in an `Animated.ScrollView` with top padding, wrapped in `AndroidGlassBackdrop` (see `PrivacyPolicyScreen`, `FeedbackScreen`, `ReportScreen`).
  - WebView screens (gift shop, admin, games, easter egg): `WebViewHeader` (solid, always visible, plain back button). Don't put floating glass over web content.
- **Status bar**: `useStatusBarStyle(style, bgColor)` on focus.
- **Storage**: auth token + `user_info` in AsyncStorage (`auth_token` is read by the axios interceptor); prefs/caches (theme, avatar versions, handoff flag) in MMKV (`app/global/storage.js`).
- **Navigation**: register new screens in `App.js` (logged-in stack); use `push` for screens that load data once on mount (Post/Profile) so a new target gets a fresh instance.
- **External links**: route through `openExternalLink` / `openInAppBrowser` (`utils/externalLink.js`), never `Linking.openURL` directly for http(s).
- **WebViews of CBH sites**: use `WebAppScreen` (add a `SITES` entry + a `Stack.Screen` with `initialParams={{ site }}`). It injects `webViewBootScript({ token, theme })`, and `lockToSite` keeps a WebView on its domain (blocked navigations show a "back to home" page).
- **Git**: work on branch `dhphuc` (PRs to `main`). Commit messages: conventional commits in English, e.g. `fix(forum): …`, `feat(sidebar): …`. Comments explain *why*, matching the surrounding density.

---

## 6. Recent work (newest first, as of 2026-10)

- **Review fixes** (not run): `FastImage` only tracks loading for images big enough to show the shimmer (avatars in long lists no longer re-render on load); the fallback forum entry in `PostEditScreen` translates its category header; holding a gradient chip in `ProfileCustomizerScreen` removes that second colour (`profileTheme.gradientCleared` / `gradientClearHint`).

- **Media is compressed on the device before upload** (not run): the API no longer compresses uploads. `app/utils/mediaCompression.js`: photos via `expo-image-manipulator` (1470px wide, quality 85); videos via **`react-native-compressor`, loaded optionally** (720p H.264, 4.7 Mbps) - the package is NOT installed yet: run `npx expo install react-native-compressor` and make a new native build, until then videos are uploaded as they are. On iOS the pickers already export 720p H.264 (`videoExportPreset`). Wired into create/edit post (HUD shows "Đang nén ảnh..." / "Đang nén video i/n..."), chat video messages (info toast) and video stories. Chat/comment photos were already re-encoded at quality 0.85.

- **Post media: photos + videos as one block** (`PostItem.js`, not run): when a post has both, the videos now continue the photo collage edge to edge with square corners and a 3px gap (one video = full width 16:9; two = side by side; three or more scroll sideways at half width), instead of small rounded cards in a padded strip below it.

- **Passkey login, server fonts, gradient colours, story styles, loading placeholders, category headers** (not run; needs the API's `main` and the web's `/auth/passkey` page from web PR 32):
  - **Passkey login** (`app/services/passkey.js`, button on `LoginScreen`): no native passkey module - the prompt runs on `chuyenbienhoa.com/auth/passkey` in the system auth browser (`WebBrowser.openAuthSessionAsync`), PKCE-style: the app keeps a random secret, sends its sha256 in the URL fragment, gets a one-time code back through `com.fatties.youth://passkey?code=…` and redeems it with the secret (`POST /v1.0/login/passkey/redeem`). A passkey login skips two-factor. Uses `expo-crypto` (comes with `expo-auth-session`; not listed in `package.json`). Passkeys are created/removed on the web: Security → "Passkey" opens the web settings in the in-app browser.
  - **Server-hosted name fonts**: `useNameFont` falls back to `GET /v1.0/name-fonts` (fetched once per run) for keys not bundled in `NAME_FONTS` and loads the `.ttf` from its URL with `Font.loadAsync`, so `flex`, `grotesk` and the other premium fonts need no bundled files and no app update. Their labels come from the editor option (`option.label`).
  - **Gradient theme colours (1500 points)**: `primary_color_2` / `accent_color_2` / `banner_color_2` in `normalizeTheme`; `themeStops()` feeds the banner/surface gradients; the customizer shows a "Màu chuyển sắc" chip under each colour (locked below the tier, from `editor.color_gradient`).
  - **Stories**: `transformStoriesData` keeps the author's `profile_theme` as `profileTheme`; the tray shows the author's avatar frame in place of the plain ring when one is picked (unchanged ring otherwise) and their name font; the viewer header and `StoryViewersSheet` show frame + styled name.
  - **Loading placeholders**: `components/MediaShimmer.js` (pulsing box). `FastImage` shows it behind images with a fixed size of at least 100x100 until they load (smaller ones, e.g. avatars, are untouched); also behind the post image collage, `VideoThumbnail` and `InlineVideoPlayer` instead of flat/black boxes. Full-screen viewers stay black.
  - **Create/edit post**: the category dropdown's group headers (`category`, e.g. "Thông báo", "Học tập") are now translated like the item labels.
- **Name style: 2 effects, new 1500-point tier, translated tier names** (not run; the font note at the end of this entry is superseded by the entry above): effects `rainbow` (static multi-stop gradient here; the web animates it) and `outline` (text colour = `name_colors[0]`, border = `name_colors[1]`) in `getNameEffect` + `StyledName`'s SVG path; the customizer hides the colour swatches for rainbow and shows two for outline. New tier `premium` (1500 points) in `PointsMilestones` and the ProfileScreen milestones sheet. **Tier names now come from i18n** (`memberTiers.<id>` in en/vi/ru, API name as fallback) instead of the API's Vietnamese-only names. **Fonts `flex` (Google Sans Flex) and `grotesk` (Space Grotesk) have labels but no bundled `.ttf` yet**, so they render in the system font on mobile: add static single-weight files to `app/assets/fonts/name` and uncomment the two lines in `app/utils/nameFonts.js`.

- **2FA: several methods at once + recovery-code file** (not run): `TwoFactorScreen` now has one switch per method (email code, authenticator app); both can be on, and adding a second method keeps the existing recovery codes. Recovery codes can be saved as a `.txt` through the share sheet (`expo-file-system/legacy` + `expo-sharing`; the temporary file is deleted afterwards). `TwoFactorChallengeScreen` shows a method picker when the challenge lists more than one (`methods`) and sends the email code on first pick (`email_sent`). Needs the matching API change.

- **2FA settings switch fixes** (`SettingsScreen/TwoFactorScreen.js`; from code review, not run): the switch now follows the step in progress (on while setting up, off while confirming turn-off) and flipping it back cancels that step - before, its value never changed, so it snapped back under the finger and then locked. Cancelling a setup waits for the server before the controls unlock. `PrimaryButton` / `SecondaryButton` / `MethodOption` moved to module level so they are no longer remounted on every render. Also: confirm buttons stay off until their password/code field is filled; "send code" and "forget devices" ignore double taps; `DevicesScreen` asks before logging a device out and its pull-to-refresh spinner is offset below the floating header.

- **Two-factor login, logged-in devices, account-switch fixes** (branch `feat/two-factor-auth`, cut from `dhphuc`; written on a machine without Node: **not run yet**). Needs the API branch of the same name.
  - **Login**: `loginRequest` / `loginWithOAuth` send the remembered `device_token`; when the API answers `two_factor_required`, `LoginScreen` and `SignupScreen` navigate to `TwoFactorChallengeScreen` (auth stack), which verifies the code and calls `signIn`.
  - **Security settings**: the old "under development" row now opens `SettingsScreen/TwoFactorScreen.js` (switch, email code or authenticator app, recovery codes, remembered devices). Authenticator setup shows the key and an "open authenticator app" button (`otpauth://` link) instead of a QR code. New `SettingsScreen/DevicesScreen.js` lists logged-in devices with log-out actions.
  - **Device headers**: `app/utils/deviceInfo.js` builds `X-Client-Platform`, `X-Client-Version`, `X-Device-Name`, `X-Device-Model` (URL-encoded), added in the axios request interceptor; it also stores the remembered-device token in AsyncStorage (`two_factor_device_token`). iOS model is only "iPhone"/"iPad" (no `expo-device`).
  - **Account switch** (reported: crash on opening chat and lag after switching; cause not confirmed without a device): `SafeAreaProvider` and `KeyboardProvider` moved outside the keyed `MultiContextProvider` in `App.js`, and the conversation list cache key is now `conversations_<username>` (`ChatScreen/index.js`, `NewConversationScreen.js`). Not addressed yet: `cached_feed` / `cached_notifications` / `cached_forum` are still un-keyed, and the push token stays registered to the previous account.
  - i18n: new `twoFactor.*` and `devices.*` sections in en/vi/ru.

- **WebView close button**: `WebViewHeader` takes `onClose`; gift shop / admin show an X beside the back arrow. Back walks back through the site, X leaves the screen at once.
- **Forum on tablets**: section cards used a 105%-wide background with a fixed 14px correction that only lined up on phones. They're now 100% wide, capped at the feed's max width, and use `useResponsiveLayout` for width (`ForumScreen`).
- **Media gallery**: compact centered tab pill sized to its 3 tabs.
- **Report flow**: Success step now uses the floating header like steps 1-3.
- **WebView screens**: `WebViewHeader` replaces the floating glass button on gift shop / admin / games / easter egg.
- **Gift shop & admin in the app**: new sidebar entries, `WebAppScreen` signs the WebView in as the current account (follows account switches), syncs the app's light/dark theme (`theme` / `giftshop_theme` localStorage keys), and sets app mode. The gift shop is locked to `giftshop.chuyenbienhoa.com`; admin opens other sites in the in-app browser.
- **App → web sign-in** via one-time handoff codes for the in-app browser (main site + gift shop); depends on the API `web-session` endpoints and each site's `/auth/set-token` page.
- **Headers**: floating scroll-aware headers on newer screens; profile effect flicker fix.
- **Profile**: Discord-style profile customization ported from web; points milestones; opaque surfaces when glass is off.
- **Links**: OG preview cards for pasted links; CBH post/profile links open in-app.
- **Chat/posts**: comment input growth, multi-image download.
- **Platform**: iOS 15 launch crash fix (pod deployment targets), large-screen (tablet/foldable) support.
