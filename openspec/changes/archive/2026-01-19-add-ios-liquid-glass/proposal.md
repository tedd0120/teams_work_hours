# 变更：iOS Liquid Glass 风格与暗夜模式适配

## 为什么
需要让应用视觉更贴合 iOS 新风格，并在 iOS 系统暗夜模式下自动切换深色主题。

## 变更内容
- 使用 `expo-blur` 模拟 Liquid Glass 视觉效果并应用到整体界面。
- iOS 端跟随系统暗夜模式切换主题；非 iOS 平台保持现有浅色风格。

## 影响
- 受影响规范：attendance-hours
- 受影响代码：应用主题样式、背景层与组件皮肤
