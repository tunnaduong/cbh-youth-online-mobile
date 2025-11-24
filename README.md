# CBH Youth Online (Mobile)

CBH Youth Online (CYO) là ứng dụng di động dành cho học sinh THPT Chuyên Biên Hòa nhằm kết nối cộng đồng, cập nhật thông tin trường lớp, quản lý hoạt động Đoàn – Hội và cung cấp các tiện ích học tập. Ứng dụng được xây dựng bằng React Native/Expo, tối ưu cho trải nghiệm tiếng Việt với hệ thống xác thực đa phương thức, bảng tin tương tác, stories, chat riêng tư, báo cáo vi phạm và thông báo đẩy thời gian thực.

## Tính năng nổi bật
- **Onboarding & xác thực**: Màn hình chào mừng, đăng nhập/đăng ký truyền thống, quên mật khẩu, xác minh email và đăng nhập OAuth (Google/Facebook).
- **Bảng tin động**: Newsfeed vô hạn, theo dõi bài viết, upvote/downvote, lưu bài, xem chi tiết, chỉnh sửa và tạo bài mới.
- **Stories & đa phương tiện**: Stories kiểu Instagram (xem, tạo, phản ứng emoji, trả lời, xem lượt xem, lưu trữ).
- **Chat & thông báo**: Hộp thư riêng, tạo cuộc trò chuyện mới, số badge chưa đọc, thông báo đẩy Expo tích hợp backend.
- **Diễn đàn & báo cáo**: Điều hướng Side Menu tới diễn đàn, danh mục, báo cáo nhiều bước, lưu trữ báo cáo thành công.
- **Khám phá nội dung**: Trang Explore, tìm kiếm nâng cao, danh sách bài viết đã thích, đã lưu, lịch sử hoạt động.
- **Thiết lập cá nhân**: Trang cá nhân, chỉnh sửa hồ sơ, trang thông tin, Điều khoản và Chính sách riêng tư nội bộ.

## Ngăn xếp công nghệ
- **Runtime**: React Native 0.79 + Expo SDK 53, dev client (`expo-dev-client`) cho thiết bị thật.
- **Điều hướng**: React Navigation Stack + Bottom Tabs + Drawer tùy biến (`@chakrahq/react-native-side-menu`).
- **State & ngữ cảnh**: React Context API (`Auth`, `Feed`, `StatusBar`, `UnreadCounts`, `Notification`, `BottomSheet`) kết hợp AsyncStorage và MMKV.
- **UI/UX**: `tailwindcss-react-native`, `react-native-vector-icons`, Lottie, LinearGradient, ActionSheet tùy biến.
- **Đa phương tiện**: `expo-image-picker`, `expo-camera`, `react-native-fast-image`, `react-native-instagram-stories`, `react-native-video`.
- **Thông báo & thiết bị**: `expo-notifications`, `expo-updates`, `expo-auth-session`, `react-native-keyboard-controller`.
- **Giao tiếp backend**: Axios instance với interceptor, upload multipart, patch-package cho các thư viện bên thứ ba.
- **Build & phát hành**: EAS Build/Submit (`eas.json`), hỗ trợ profile `development`, `preview`, `production`.

## Cấu trúc thư mục chính
| Đường dẫn | Mô tả |
| --- | --- |
| `App.js`, `index.js` | Entry point Expo, bọc `TailwindProvider`, `GestureHandlerRootView`, saf earea và các Context. |
| `app/assets/` | Logo, hình onboarding, ảnh splash, animation Lottie (`refresh.json`, `splash.json`), SVG chứng thực. |
| `app/components/` | Thành phần tái sử dụng: `PostItem`, `CustomTabBarButton`, `Sidebar`, `SplashScreen`, `TabBarBadge`, v.v. |
| `app/contexts/` | Toàn bộ Providers (Auth, Feed, Notification, BottomSheet, StatusBar, UnreadCounts) + `index.js` gộp. |
| `app/screens/` | Tổ chức theo module: `Login`, `Signup`, `MainScreens` (Home, Forum, Chat, Notifications, Search, Report, Stories, Explore, Settings, Profile...). |
| `app/services/api/` | Axios instance, helper (GET/POST/PUT/DELETE, FormData) và toàn bộ endpoints (`Api.js`). |
| `app/services/notifications/` | `ExpoNotificationService` cấu hình handler, xin quyền, đăng ký token, badge. |
| `app/services/oauth.js` | Luồng OAuth PKCE cho Google/Facebook (qua backend `exchangeOAuthCode`). |
| `app/hooks/` | Hook tùy chỉnh như `useUnreadCounts`, `useCurrentRoute`, `useStatusBarUpdate`. |
| `app/utils/` | Hàm tiện ích: `formatTime`, `slugify`, lưu token/thông tin. |
| `android/`, `ios/` | Dự án native cho build bare/Dev Client, cấu hình icon/splash riêng. |
| `patches/` | File patch cho `patch-package` nhằm vá thư viện (stories, keyboard spacer, markdown, snap carousel). |

## Luồng chức năng trọng tâm
### 1. Xác thực & lưu trữ phiên
- `AuthContext` giữ `auth_token`, `user_info` trong AsyncStorage và xoá sạch khi đăng xuất (đồng thời gọi API `/logout`).
- Hỗ trợ xác minh email và cập nhật `email_verified_at`.
- OAuth sử dụng `expo-auth-session` (PKCE) + backend `/v1.0/oauth/*` để đổi code sang token.

### 2. Bảng tin & stories
- `HomeScreen` lấy feed (`/v1.0/topics`), phân trang vô hạn, tự tăng view khi item hiển thị ≥ 50%.
- Stories tiêu chuẩn Instagram: `@birdwingo/react-native-instagram-stories`, reaction emoji (map sang API `stories/:id/react`), reply chuyển nhanh sang chat, xem người xem.
- Hộp thoại nhắc xác minh email, refresh Lottie, trigger scroll-to-top khi bấm logo.

### 3. Chat & thông báo
- `ChatScreen` + `ConversationScreen` tiêu thụ API `/chat/*`, hook `useUnreadCounts` polling mỗi 30s & khi app foreground.
- `NotificationContext` đăng ký Expo push token, đồng bộ backend (`/notifications/expo/*`), badge count và listener khi nhận/tap thông báo.

### 4. Điều hướng & module
- `MainScreens` gộp tab Home / Forum / Create / Chat / Notifications, hỗ trợ Side Menu để mở `Sidebar`.
- Stack bổ sung: tạo/sửa bài, chỉnh sửa hồ sơ, cài đặt, báo cáo nhiều bước (`ReportNavigator`), Story viewers, Explore, Archive.

## Thiết lập môi trường
### Yêu cầu
- Node.js >= 18 & npm 10 (khuyến nghị dùng `nvm`).
- Expo CLI (`npm install -g expo-cli`) & EAS CLI (`npm install -g eas-cli`).
- Watchman (macOS), Git.
- Android Studio + SDK/NDK + JDK 17 cho build Android.
- Xcode 15+ & CocoaPods cho build iOS (chạy trên macOS).
- Thiết bị thật để thử thông báo đẩy và OAuth sâu.

### Các bước cài đặt
```bash
git clone <repo-url> cbh-youth-online
cd cbh-youth-online
npm install
# patch-package chạy tự động trong postinstall, xem thư mục patches/ nếu cần chỉnh sửa
```

### Cấu hình bắt buộc
1. **API Base URL** (`app/services/api/axiosInstance.js`): thay đổi `baseURL` cho môi trường dev/staging/production. Bạn có thể tách ra env riêng:
   ```js
   const axiosInstance = axios.create({
     baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.chuyenbienhoa.com/",
     timeout: 10000,
   });
   ```
   và khai báo biến trong `app.config.js`/`app.json`.
2. **OAuth** (`app/services/oauth.js`):
   - Thay `GOOGLE_CLIENT_ID`, `FACEBOOK_CLIENT_ID`, `REDIRECT_URI` bằng thông tin của bạn.
   - Đảm bảo backend whitelists redirect URI và hỗ trợ endpoint `/v1.0/oauth/callback`.
3. **Expo Notifications** (`app/services/notifications/ExpoNotificationService.js`):
   - Cập nhật `projectId` cho dự án của bạn (`app.json -> extra.eas.projectId`).
   - Thiết lập credential (Android FCM server key, Apple Push Key) trong Expo/EAS Dashboard.
4. **Biểu tượng & Splash**:
   - Tài nguyên trong `app/assets/` + `android/`, `ios/Images.xcassets`.
   - Nếu đổi logo, cập nhật cả `app.json`, `android/app/src/main/res`, `ios` asset catalog.
5. **Expo Updates & EAS**:
   - Kiểm tra `eas.json` để đồng bộ profile.
   - Đăng nhập `eas login` trước khi chạy build.

## Scripts & lệnh thường dùng
| Lệnh | Mô tả |
| --- | --- |
| `npm run start` | `expo start --dev-client`: khởi chạy Metro bundler cho Dev Client. |
| `npm run android` | `expo run:android`: build Dev Client/bare Android (cần Android Studio). |
| `npm run ios` | `expo run:ios`: build Dev Client/bare iOS (chỉ trên macOS). |
| `npm run web` | Chạy bản web (Expo Web) phục vụ kiểm tra nhanh UI. |
| `npx expo start --clear` | Làm sạch cache Metro khi gặp lỗi bundler. |
| `eas build --profile production --platform android` | Tạo build production (APK/AAB) qua EAS. |

> **Lưu ý**: Dev Client yêu cầu đã cài app build từ `expo run:*` hoặc `eas build --profile development --local`. Không chạy `expo prebuild --clean` trừ khi thật sự cần và đã sao lưu.

## Quy ước mã nguồn & kiến trúc
- **Styling**: ưu tiên `tailwindcss-react-native` (`className`) kết hợp StyleSheet khi cần hiệu năng cao hoặc animation.
- **Trạng thái**: logic chia nhỏ vào Context + Hooks; tránh gọi API trực tiếp trong component nếu đã có service/hook tương ứng.
- **Gọi API**: dùng `app/services/api/Api.js`; mọi endpoint đều trả về `axiosInstance` promise. Giữ thông báo lỗi thân thiện tiếng Việt như hiện có.
- **Lưu trữ**: AsyncStorage cho token nhẹ, MMKV (`app/global/storage.js`) cho cache tốc độ cao.
- **Patch thư viện**: mọi chỉnh sửa bên thứ ba phải ghi lại ở `patches/` và chạy `npx patch-package <tên>` sau khi sửa `node_modules`.
- **Thông báo & badge**: chỉ đăng ký push token khi `AuthContext.isLoggedIn === true`; đảm bảo xoá token khi logout để tránh thông báo nhầm.

## API & dữ liệu backend
`app/services/api/Api.js` định nghĩa toàn bộ endpoints REST (đều bắt đầu `/v1.0/`):
- **Auth**: login/logout, register, email verify/resend, quên mật khẩu.
- **Bài viết**: topics CRUD, vote, save/unsave, increment view.
- **Stories**: danh sách, tạo (multipart), xóa, react, reply, viewers, archive.
- **Chat**: conversations, messages, search user, tạo cuộc trò chuyện.
- **Thông báo**: danh sách, đánh dấu đã đọc, badge count, đăng ký Expo token.
- **Diễn đàn & tìm kiếm**: categories, subforums, search global.
- **Hồ sơ**: lấy/sửa profile, follow/unfollow, hoạt động người dùng.
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
  - Nếu thay đổi scheme/bundleId, cập nhật cả cấu hình deep link phía backend và file native (`android/app/src/main/AndroidManifest.xml`, `ios/*/Info.plist`).

## Kiểm thử & đảm bảo chất lượng
Hiện dự án chưa có test tự động; khuyến nghị thực hiện thủ công các kịch bản sau trước khi phát hành:
- Đăng nhập/đăng xuất (email + OAuth), thử sai mật khẩu, reset password.
- Xác minh email và tạo bài viết/story sau khi verified.
- Vòng đời stories: tạo → xem → thả cảm xúc → trả lời → xem danh sách người xem → xoá.
- Push notification: đăng nhập trên thiết bị thật, gửi thông báo từ backend, kiểm tra badge và deep link.
- Chat: tạo hội thoại mới, gửi tin nhắn, kiểm tra unread badge.
- Báo cáo: hoàn thành flow Step1 → Step2 → Step3 → Success, xem lịch sử.
- Lưu bài, thích bài, hoạt động, explore, tìm kiếm.

Sau khi chỉnh sửa mã, chạy `npm run start` để đảm bảo Metro build thành công và xem console warning (React Native coi warning là dấu hiệu regressions).

## Khắc phục sự cố thường gặp
- **Metro bundler treo**: xoá `.expo`, `node_modules`, chạy `npm install`, sau đó `expo start --clear`.
- **Lỗi Android Gradle**: mở Android Studio, đồng bộ Gradle, đảm bảo JDK 17, cập nhật SDK Build-Tools 34.
- **`react-native-reanimated` không load**: chắc chắn plugin đã nằm cuối trong `babel.config.js`.
- **Push token null**: kiểm tra quyền thông báo, `projectId`, và chạy trên thiết bị thật.
- **OAuth bị `state mismatch`**: xác nhận redirect URI khớp, backend trả về code đúng và không sửa `code_verifier`.

## Đóng góp
1. Fork/branch từ `main`.
2. Đặt tên nhánh theo chuẩn `feature/<tên>`, `bugfix/<tên>`.
3. Chạy `npm run start` để kiểm tra nhanh; nếu chỉnh sửa thư viện bên thứ ba, cập nhật `patches/`.
4. Viết mô tả PR bằng tiếng Việt (hoặc song ngữ) kèm checklist test thủ công.

## Giấy phép
Dự án nội bộ, giấy phép sẽ được cập nhật sau khi có quyết định chính thức từ CBH Youth Online.
