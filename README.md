# 简校园 Simple University

一款精简版「PU口袋校园」客户端（React Native / Expo），去除广告与大部分无关功能，只保留课程社团场景里真正用得上的核心能力，并为 iOS / Android 双端做了现代化的界面与动效优化。

> 开源地址：<https://github.com/xiguac/simpleuniversity>

## 功能

| 功能 | 说明 |
| --- | --- |
| 登录 | 选学校 → 学号密码登录；可勾选"记住学校、账号与密码"，敏感信息存于系统安全存储（iOS Keychain / Android Keystore）加密保存 |
| 活动 | 活动列表、活动详情（时间/地点/参与对象/发布人/简介）、报名与取消 |
| 部落 | 我的部落列表、部落详情、部落内活动一键跳转 |
| 我的活动 | 已报名/参与记录，可与详情页互通 |
| 身份码 | 10 秒自动刷新的加密二维码，进入页面自动调亮屏幕、离开恢复 |
| 我的 | 头像、实践学分、诚信度、开源地址直达 |

## 双端体验

- **iOS 26 Liquid Glass**：底部 Tab 栏使用官方 `expo-glass-effect`（`GlassContainer` + `GlassView` + `isInteractive` + `glassEffectStyle` 原生形变动画）实现真液态玻璃，切换时玻璃流动；导航头部为透明玻璃，内容从下划过。低版本 iOS 自动降级，不闪退。
- **过渡动画**：全部页面由 `@react-navigation/native-stack`（react-native-screens）原生驱动，动画不占用 JS 线程，长列表下依旧流畅。
- **启动屏**：纯色无闪屏，品牌色与页面底色一致，Android 12+ 亦无白块。
- **记住登录**：勾选后学校/学号/密码加密保存在本地，下次打开自动填充；取消勾选即清除。

## 身份码

登录接口返回的 `baseUserInfo.id / username` 会随登录数据一并保存在本地（`user_data`）。身份码页面读取这两个字段拼出明文 `xyhui://user/{id}/{时间戳}/{username}`，经 DES 加密生成二维码，每 10 秒刷新一次时间戳，防止二维码被盗用。

该逻辑不依赖任何平台设备能力，iOS / Android / Web 行为完全一致。

## 目录结构

```
App.js                     # 导航（native-stack + 底部 Tab）、登录态、液态玻璃头部
src/api/puApi.js           # 接口层（活动/部落 10 个接口 + 请求头）
src/context/AuthContext.js # 登录态 / 401 自动登出
src/context/ActivityOverlayContext.js
src/screens/               # Login / Activity / QR(身份码) / Profile(我的) / 部落 / 详情
src/LiquidGlassTabBarV2.js # 液态玻璃底部 Tab 栏（官方 expo-glass-effect 模式）
android/  app.json         # 本地与 Expo 配置
.github/workflows/         # Android APK / iOS 构建流水线
```

## 运行

**Expo Go（开发调试）**

```bash
npm install
npx expo start    # 手机同网段用 Expo Go 扫码
```

**Android APK**

```bash
npx expo prebuild --platform android --clean          # 首次
cd android && ./gradlew assembleRelease
# 产物： android/app/build/outputs/apk/release/app-release.apk
```

**iOS**：`npx expo run:ios`（需 Xcode 26 及以上才能完整编译 Liquid Glass）。

## 技术栈

Expo SDK 57 · React Native 0.86 · React 19 · @react-navigation v7（native-stack）· expo-glass-effect · expo-secure-store · expo-brightness · react-native-qrcode-svg · crypto-js

## 免责声明

本项目仅用于个人学习与课程/社团场景的信息查询，报名与取消报名操作请以官方渠道为准；所有登录凭据只保存在用户设备本地，项目不搭载任何数据收集/统计组件。
