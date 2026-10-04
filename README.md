# CBH Youth Online (Mobile)

CBH Youth Online (CYO) là ứng dụng di động dành cho học sinh THPT Chuyên Biên Hòa nhằm kết nối cộng đồng, cập nhật thông tin trường lớp, quản lý hoạt động Đoàn – Hội và cung cấp các tiện ích học tập. Ứng dụng được xây dựng bằng React Native/Expo, tối ưu cho trải nghiệm tiếng Việt (hỗ trợ thêm tiếng Anh và tiếng Nga) với hệ thống xác thực đa phương thức, bảng tin tương tác, stories, chat thời gian thực, báo cáo vi phạm và thông báo đẩy.

Ứng dụng là một phần của hệ sinh thái CBH Youth Online, dùng chung backend và tài khoản với:
- [cbh-youth-online-api](https://github.com/tunnaduong/cbh-youth-online-api) – Laravel API (`https://api.chuyenbienhoa.com`).
- [cbh-youth-online-next-js](https://github.com/tunnaduong/cbh-youth-online-next-js) – website chính (`https://chuyenbienhoa.com`, gồm trang quản trị `/admin`).
- [cbh-youth-online-gift-shop](https://github.com/tunnaduong/cbh-youth-online-gift-shop) – cửa hàng quà tặng (`https://giftshop.chuyenbienhoa.com`).

## Tính năng nổi bật
- **Onboarding & xác thực**: Màn hình chào mừng, chọn ngôn ngữ (vi/en/ru), thiết lập lần đầu, đăng nhập/đăng ký truyền thống, quên mật khẩu, xác minh email, đăng nhập OAuth (Google/Facebook), Apple và chuyển đổi nhiều tài khoản.
- **Bảng tin động**: Newsfeed vô hạn, upvote/downvote kèm danh sách người vote, bình luận có nhắc tên, lưu bài, chia sẻ/chuyển tiếp, chỉnh sửa và tạo bài mới (ảnh, video, YouTube/SoundCloud), thẻ xem trước cho link dán vào.
- **Stories & đa phương tiện**: Stories kiểu Instagram (xem, tạo kèm chữ/nhãn dán/nhạc, phản ứng emoji, trả lời, xem lượt xem, lưu trữ).
- **Chat & thông báo**: Chat 1-1 và nhóm thời gian thực (Laravel Echo + Reverb), thả cảm xúc, trả lời, chuyển tiếp, thư viện ảnh/video, hình nền chat, link mời nhóm; số badge chưa đọc, thông báo đẩy Expo tích hợp backend.
- **Diễn đàn & báo cáo**: Điều hướng Side Menu tới diễn đàn, danh mục, tin tức Đoàn, báo cáo vi phạm nhiều bước; màn hình Báo lỗi / Góp ý và lắc điện thoại để báo lỗi kèm ảnh chụp màn hình.
- **Khám phá nội dung**: Trang Explore (trò chơi, quiz, thông tin trường đại học, tài liệu học tập), tìm kiếm, danh sách bài viết đã thích, đã lưu, lịch sử hoạt động.
- **Điểm & cửa hàng**: Ví điểm (nạp/rút), tặng điểm, xếp hạng thành viên; Cửa hàng quà tặng mở ngay trong ứng dụng (WebView, đã đăng nhập sẵn, chỉ ở trong tên miền cửa hàng).
- **Thiết lập cá nhân**: Trang cá nhân, chỉnh sửa hồ sơ, tùy biến hồ sơ kiểu Discord (khung avatar, kiểu tên, hiệu ứng), giao diện sáng/tối/liquid glass, ngôn ngữ, bảo mật (xác thực 2 yếu tố bằng mã email hoặc ứng dụng xác thực, danh sách thiết bị đã đăng nhập), chặn người dùng, xác minh học sinh, Điều khoản và Chính sách riêng tư nội bộ.
- **Quản trị**: Mục Quản trị viên trong Sidebar (chỉ hiện với tài khoản admin) mở trang `/admin` của web trong ứng dụng.

## Ngăn xếp công nghệ
- **Runtime**: React Native 0.83 + Expo SDK 55 (React 19), dev client (`expo-dev-client`) cho thiết bị thật, có liquid glass cho supported devices.
- **Điều hướng**: React Navigation 8 (Stack + Bottom Tabs) + Drawer tùy biến (`@chakrahq/react-native-side-menu`).
- **State & ngữ cảnh**: React Context API (`Auth`, `Theme`, `Feed`, `StatusBar`, `UnreadCounts`, `Notification`, `ChatSocket`, `BottomSheet`, `Session`, `Animation`) kết hợp AsyncStorage và MMKV.
- **UI/UX**: `tailwindcss-react-native`, `react-native-paper`, `react-native-vector-icons`, Lottie, LinearGradient, liquid glass, ActionSheet tùy biến.
- **Đa ngôn ngữ**: `i18next` + `react-i18next` (vi, en, ru).
- **Đa phương tiện**: `expo-image-picker`, `expo-camera`, `expo-image`, `expo-video`, `react-native-video`, `@birdwingo/react-native-instagram-stories`, `react-native-webview`.
- **Thông báo & thiết bị**: `expo-notifications`, `expo-updates`, `expo-auth-session`, `react-native-keyboard-controller`.
- **Giao tiếp backend**: Axios instance với interceptor, upload multipart, realtime qua `laravel-echo` + `pusher-js` (Reverb), patch-package cho các thư viện bên thứ ba.
- **Build & phát hành**: EAS Build/Submit (`eas.json`), hỗ trợ profile `development`, `preview`, `production`.

## Cấu trúc thư mục chính
| Đường dẫn | Mô tả |
| --- | --- |
| `App.js`, `index.js` | Entry point Expo, bọc `TailwindProvider`, `GestureHandlerRootView`, safe area, các Context; khai báo toàn bộ màn hình và xử lý deep link. |
| `app/assets/` | Logo, hình onboarding, ảnh splash, animation Lottie (`refresh.json`, `splash.json`), SVG chứng thực. |
| `app/components/` | Thành phần tái sử dụng: `PostItem`, `Sidebar`, `LiquidButton`, `WebViewHeader`, `LinkPreviewCard`, `ShakeToReport`, `SplashScreen`, v.v. |
| `app/contexts/` | Toàn bộ Providers (Auth, Theme, Feed, Notification, ChatSocket, BottomSheet, StatusBar, UnreadCounts, Session, Animation) + `index.js` gộp. |
| `app/i18n/` | Cấu hình i18next và bản dịch `locales/vi.json`, `en.json`, `ru.json`. |
| `app/screens/` | Tổ chức theo module: `Login`, `Signup`, `MainScreens` (Home, Forum, Chat, Notifications, Search, Report, Feedback, Explore, PointWallet, Settings, Profile, WebAppScreen cho cửa hàng/quản trị...). |
| `app/services/api/` | Axios instance, helper (GET/POST/PUT/DELETE, FormData) và toàn bộ endpoints (`Api.js`). |
| `app/services/notifications/` | `ExpoNotificationService` cấu hình handler, xin quyền, đăng ký token, badge. |
| `app/services/echo/` | Client Laravel Echo kết nối Reverb cho chat thời gian thực. |
| `app/services/oauth.js` | Luồng OAuth PKCE cho Google/Facebook (qua backend `exchangeOAuthCode`). |
| `app/hooks/` | Hook tùy chỉnh như `useUnreadCounts`, `useCurrentRoute`, `useStatusBarUpdate`. |
| `app/global/storage.js` | Instance MMKV cho cache/tùy chọn cục bộ. |
| `app/utils/` | Hàm tiện ích: `formatTime`, `slugify`, lưu token/thông tin, mở link (`externalLink`), đăng nhập web từ app (`webSession`), bố cục màn hình lớn (`responsive`). |
| `android/`, `ios/` | Dự án native, **không nằm trong git**: được tạo bằng `npx expo prebuild` từ `app.json` + các config plugin (xem "Tạo dự án native"). |
| `plugins/withNativeTweaks.js` | Config plugin chứa các chỉnh sửa native trước đây sửa tay (deployment target của Pods, `resizeableActivity`, keystore ký APK). |
| `keystores/debug.keystore` | Keystore dùng để ký APK ở CI, được plugin chép vào `android/app` sau mỗi lần prebuild để chữ ký không đổi. |
| `patches/` | File patch cho `patch-package` nhằm vá thư viện (stories, markdown, snap carousel, html-entities, react-native-screens, gradle plugin); file `*.patch.old` không còn dùng. |

## Luồng chức năng trọng tâm
### 1. Xác thực & lưu trữ phiên
- `AuthContext` giữ `auth_token`, `user_info` trong AsyncStorage và xoá sạch khi đăng xuất (đồng thời gọi API `/logout`).
- Hỗ trợ xác minh email và cập nhật `email_verified_at`.
- OAuth sử dụng `expo-auth-session` (PKCE) + backend `/v1.0/oauth/*` để đổi code sang token.

### 2. Bảng tin & stories
- `HomeScreen` lấy feed (`/v1.0/topics`), phân trang vô hạn, tự tăng view khi item hiển thị ≥ 50%.
- Stories tiêu chuẩn Instagram: `@birdwingo/react-native-instagram-stories`, reaction emoji (map sang API `stories/:id/react`), reply chuyển nhanh sang chat, xem người xem.
- Hộp thoại nhắc xác minh email, refresh Lottie, trigger scroll-to-top khi bấm logo.

### 2b. Đăng bài, tin và tệp ở chế độ nền
- Khi đăng/sửa bài viết hoặc đăng tin, màn hình soạn đóng ngay; việc nén ảnh/video, tải lên và tạo nội dung chạy nền qua `app/services/uploadQueue.js`.
- Thanh trạng thái nổi (`UploadStatusBar`) hiển thị từng bước: đang nén ảnh/video, đang tải lên kèm phần trăm, kết quả; nếu lỗi có nút **Thử lại**.
- Android có thông báo tiến trình trong khay thông báo; iOS chỉ báo kết quả khi app không ở màn hình. Tải lên tiếp tục khi app ở nền chừng nào hệ điều hành còn giữ tiến trình (không tiếp tục nếu app bị tắt hẳn).

### 3. Chat & thông báo
- `ChatScreen` + `ConversationScreen` tiêu thụ API `/chat/*`, nhận tin nhắn thời gian thực qua `ChatSocketContext` (Echo/Reverb); hook `useUnreadCounts` polling mỗi 30s & khi app foreground.
- `NotificationContext` đăng ký Expo push token, đồng bộ backend (`/notifications/expo/*`), badge count và listener khi nhận/tap thông báo.

### 4. Điều hướng & module
- `MainScreens` gộp tab Home / Forum / Create / Chat / Notifications, hỗ trợ Side Menu để mở `Sidebar`.
- Stack bổ sung: tạo/sửa bài, chỉnh sửa hồ sơ, cài đặt, báo cáo nhiều bước (`ReportNavigator`), Story viewers, Explore, Archive, ví điểm.

### 5. Web trong ứng dụng
- Link tới website CBH mở bằng trình duyệt trong app (`openInAppBrowser`); lần đầu sau khi đăng nhập, app lấy mã dùng một lần từ API và mở qua `/auth/set-token` để web đăng nhập sẵn cùng tài khoản. Khi đã đăng xuất khỏi app hoặc chuyển tài khoản, phiên web cũ bị xoá/thay thế ở lần mở trang tiếp theo.
- Cửa hàng quà tặng và trang quản trị chạy trong `WebAppScreen` (WebView): có phiên đăng nhập riêng theo tài khoản hiện tại (kể cả khi chuyển tài khoản), hiển thị là "WebView trong ứng dụng CBH Youth" trong danh sách thiết bị đăng nhập, theo giao diện sáng/tối của app và mở với `?app=true` để web ẩn nút đăng xuất, màn chờ và banner tải app. Cửa hàng chỉ được ở trong tên miền của nó.

## Thiết lập môi trường
### Yêu cầu
- Node.js >= 20.19 & npm (khuyến nghị dùng `nvm`).
- Expo CLI dùng qua `npx expo`; EAS CLI có sẵn trong devDependencies (`npx eas`) hoặc cài `npm install -g eas-cli`.
- Watchman (macOS), Git.
- Android Studio + SDK/NDK + JDK 17 cho build Android.
- Xcode 16+ & CocoaPods cho build iOS (chạy trên macOS, iOS deployment target 15.1).
- Thiết bị thật để thử thông báo đẩy và OAuth sâu.

### Các bước cài đặt
```bash
git clone https://github.com/tunnaduong/cbh-youth-online-mobile.git
cd cbh-youth-online-mobile
npm install
# patch-package chạy tự động trong postinstall, xem thư mục patches/ nếu cần chỉnh sửa
```

### Cấu hình bắt buộc
1. **API Base URL** (`app/services/api/axiosInstance.js`): hiện cố định `baseURL: "https://api.chuyenbienhoa.com/"` (timeout 30s); thay đổi khi cần trỏ tới môi trường dev/staging. Các URL web (`chuyenbienhoa.com`, `giftshop.chuyenbienhoa.com`) nằm trong `app/utils/externalLink.js`, `app/utils/webSession.js` và `app/screens/MainScreens/WebAppScreen`.
2. **OAuth** (`app/services/oauth.js`):
   - Thay `GOOGLE_CLIENT_ID`, `FACEBOOK_CLIENT_ID`, `REDIRECT_URI` bằng thông tin của bạn.
   - Đảm bảo backend whitelists redirect URI và hỗ trợ endpoint `/v1.0/oauth/callback`.
3. **Expo Notifications** (`app/services/notifications/ExpoNotificationService.js`):
   - Cập nhật `projectId` cho dự án của bạn (`app.json -> expo.projectId` và `extra.eas.projectId`).
   - Thiết lập credential (Android FCM server key, Apple Push Key) trong Expo/EAS Dashboard.
4. **Biểu tượng & Splash**:
   - Tài nguyên trong `app/assets/`; icon/splash native được prebuild tạo ra từ `app.json`.
   - Nếu đổi logo, chỉ cần cập nhật `app.json` rồi prebuild lại.
5. **Expo Updates & EAS**:
   - Kiểm tra `eas.json` để đồng bộ profile (`development`, `preview` → channel `preview`, `production` → channel `production`).
   - `appVersionSource` là `local`: tự tăng `version` trong `app.json` trước khi build. Với CI trên GitHub (`build-android.yml`, `build-ios.yml`), build number (`ios.buildNumber`, `android.versionCode`) được đặt bằng **số lần chạy của workflow** (run #N → build N); các bản build chỉ sửa `app.json` trong bản checkout của CI, không commit; số đó chỉ được commit vào `app.json` khi merge vào `main` (workflow `build-number.yml`, `chore: build number N [skip ci]`).
   - Đăng nhập `eas login` trước khi chạy build.
6. **Phiên bản thư viện cố định**: `package.json -> expo.install.exclude` giữ nguyên `react-native-screens`, `react-native-gesture-handler`, `react-native-keyboard-controller`; không để `expo install --fix` nâng các gói này.

## Scripts & lệnh thường dùng
| Lệnh | Mô tả |
| --- | --- |
| `npm run start` | `expo start --dev-client`: khởi chạy Metro bundler cho Dev Client. |
| `npm run android` | `expo run:android`: build Dev Client/bare Android (cần Android Studio). |
| `npm run ios` | `expo run:ios`: build Dev Client/bare iOS (chỉ trên macOS). |
| `npm run web` | Chạy bản web (Expo Web) phục vụ kiểm tra nhanh UI. |
| `npx expo start --clear` | Làm sạch cache Metro khi gặp lỗi bundler. |
| `eas build --profile production --platform android` | Tạo build production (APK/AAB) qua EAS. |

> **Lưu ý**: Dev Client yêu cầu đã cài app build từ `expo run:*` hoặc `eas build --profile development --local`.

### Tạo dự án native (prebuild)
`android/` và `ios/` không được commit. Tạo lại khi cần build native trên máy:

```bash
npm install
npx expo prebuild --platform android   # tạo android/
npx expo prebuild --platform ios       # tạo ios/ và chạy pod install (chỉ trên macOS)
npm run android                        # hoặc: npm run ios
```

- `expo run:android` / `expo run:ios` tự chạy prebuild nếu thư mục native chưa có.
- Sau khi thêm/bỏ thư viện native hoặc sửa `app.json`/plugin: `npx expo prebuild --clean` (xoá và tạo lại hai thư mục).
- **Không sửa tay** trong `android/` hay `ios/`: lần prebuild sau sẽ mất. Đưa thay đổi vào `app.json` hoặc `plugins/withNativeTweaks.js`.
- CI (`.github/workflows/build-android.yml`, `build-ios.yml`, `simu.yml`) tự chạy `npx expo prebuild --no-install` sau `npm ci`.


## Quy ước mã nguồn & kiến trúc
- **Styling**: ưu tiên `tailwindcss-react-native` (`className`) kết hợp StyleSheet khi cần hiệu năng cao hoặc animation; màu lấy từ `useTheme()` để hỗ trợ sáng/tối.
- **Chuỗi hiển thị**: mọi chữ trên giao diện dùng `t()` của i18next và phải có đủ trong cả `vi.json`, `en.json`, `ru.json`.
- **Header**: màn hình native dùng header nổi (`LiquidButton` + tiêu đề mờ dần khi cuộn); màn hình chứa trang web dùng `WebViewHeader` (thanh cố định, nút quay lại thường).
- **Trạng thái**: logic chia nhỏ vào Context + Hooks; tránh gọi API trực tiếp trong component nếu đã có service/hook tương ứng.
- **Gọi API**: dùng `app/services/api/Api.js`; mọi endpoint đều trả về `axiosInstance` promise. Giữ thông báo lỗi thân thiện tiếng Việt như hiện có.
- **Lưu trữ**: AsyncStorage cho token (`auth_token`) và `user_info`, MMKV (`app/global/storage.js`) cho cache/tùy chọn tốc độ cao.
- **Link ngoài**: mở link http(s) qua `openExternalLink` / `openInAppBrowser` (`app/utils/externalLink.js`) thay vì gọi `Linking.openURL` trực tiếp.
- **Patch thư viện**: mọi chỉnh sửa bên thứ ba phải ghi lại ở `patches/` và chạy `npx patch-package <tên>` sau khi sửa `node_modules`.
- **Thông báo & badge**: chỉ đăng ký push token khi `AuthContext.isLoggedIn === true`; đảm bảo xoá token khi logout để tránh thông báo nhầm.

## API & dữ liệu backend
`app/services/api/Api.js` định nghĩa toàn bộ endpoints REST (đều bắt đầu `/v1.0/`):
- **Auth**: login/logout, register, email verify/resend, quên mật khẩu, mã chuyển phiên đăng nhập sang web (`web-session/handoff`, gọi trong `app/utils/webSession.js`).
- **Bài viết**: topics CRUD, vote, save/unsave, increment view.
- **Stories**: danh sách, tạo (multipart), xóa, react, reply, viewers, archive.
- **Chat**: conversations (1-1 và nhóm), messages, reactions, search user, tạo cuộc trò chuyện, link mời nhóm.
- **Thông báo**: danh sách, đánh dấu đã đọc, badge count, đăng ký Expo token.
- **Diễn đàn & tìm kiếm**: categories, subforums, search global.
- **Hồ sơ**: lấy/sửa profile, tùy biến giao diện hồ sơ, follow/unfollow, hoạt động người dùng.
- **Điểm**: ví điểm, nạp/rút, tặng điểm, xếp hạng thành viên.
- **Góp ý**: gửi báo lỗi / góp ý kèm ảnh (`submitFeedback`).
- **Report**: APIs liên quan nằm trong `ReportScreen` (báo cáo vi phạm, bước 2/3, thành công).

Luôn đồng bộ response shape với backend (`response.data` hoặc `response.data.data`). Khi thêm endpoint mới, bổ sung helper tương ứng để giữ code thống nhất.

## Thông báo đẩy & OAuth
- **Push notifications**:
  - Phải yêu cầu quyền (`requestNotificationPermissions`) trước khi gọi `Notifications.getExpoPushTokenAsync`.
  - Expo push token và `device_type` được gửi tới backend để liên kết tài khoản.
  - Badge count đồng bộ liên tục (polling 30s) và reset khi logout.
  - Thử nghiệm trên thiết bị thật; simulator không nhận FCM/APNs.
- **OAuth**:
  - Dùng Authorization Code + PKCE, deep link dạng `com.fatties.youth://oauth`.
  - `exchangeOAuthCode` gọi backend để đổi code -> token; backend phải lưu `code_verifier`.
  - Nếu thay đổi scheme/bundleId, cập nhật cả cấu hình deep link phía backend rồi prebuild lại (file native được tạo từ `app.json`).

## Kiểm thử & đảm bảo chất lượng
Hiện dự án chưa có test tự động; khuyến nghị thực hiện thủ công các kịch bản sau trước khi phát hành:
- Đăng nhập/đăng xuất (email + OAuth), thử sai mật khẩu, reset password.
- Xác minh email và tạo bài viết/story sau khi verified.
- Vòng đời stories: tạo → xem → thả cảm xúc → trả lời → xem danh sách người xem → xoá.
- Push notification: đăng nhập trên thiết bị thật, gửi thông báo từ backend, kiểm tra badge và deep link.
- Chat: tạo hội thoại mới, gửi tin nhắn, kiểm tra unread badge.
- Báo cáo: hoàn thành flow Step1 → Step2 → Step3 → Success, xem lịch sử; gửi Báo lỗi / Góp ý và thử lắc điện thoại để báo lỗi.
- Lưu bài, thích bài, hoạt động, explore, tìm kiếm.
- Cửa hàng quà tặng / Quản trị viên từ Sidebar: mở ra đã đăng nhập, đúng giao diện sáng/tối, chuyển tài khoản rồi mở lại vẫn đúng tài khoản.
- Kiểm tra giao diện trên iPad/máy tính bảng và màn hình gập.

Sau khi chỉnh sửa mã, chạy `npm run start` để đảm bảo Metro build thành công và xem console warning (React Native coi warning là dấu hiệu regressions).

## Khắc phục sự cố thường gặp
- **Metro bundler treo**: xoá `.expo`, `node_modules`, chạy `npm install`, sau đó `expo start --clear`.
- **Lỗi Android Gradle**: mở Android Studio, đồng bộ Gradle, đảm bảo JDK 17 và đã cài SDK Build-Tools mà dự án yêu cầu.
- **`react-native-reanimated` không load**: chắc chắn plugin đã nằm cuối trong `babel.config.js`.
- **Push token null**: kiểm tra quyền thông báo, `projectId`, và chạy trên thiết bị thật.
- **OAuth bị `state mismatch`**: xác nhận redirect URI khớp, backend trả về code đúng và không sửa `code_verifier`.

## Đóng góp
1. Nhánh mặc định là **`dhphuc`**: nếu không có yêu cầu khác, phát triển và push lên `dhphuc`, sau đó mở PR vào `main`.
2. Đặt tên nhánh theo chuẩn `feature/<tên>`, `bugfix/<tên>`; commit theo chuẩn conventional commits (`feat(...)`, `fix(...)`).
3. Chạy `npm run start` để kiểm tra nhanh; nếu chỉnh sửa thư viện bên thứ ba, cập nhật `patches/`.
4. Viết mô tả PR bằng tiếng Việt (hoặc song ngữ) kèm checklist test thủ công.

## Giấy phép
Dự án nội bộ, giấy phép sẽ được cập nhật sau khi có quyết định chính thức từ CBH Youth Online.
