# 变更：升级 Expo SDK 54 并优化拉取体验

## 为什么
当前项目基于 Expo SDK 50，需要升级到 SDK 54 以获取兼容性修复与平台支持更新，并借此机会补足近一年拉取的进度与阈值输入反馈。

## 变更内容
- 升级 Expo SDK 到 54，并同步更新相关 React/React Native/Expo 依赖与配置。
- 适配 SDK 54 兼容性变更（如 Expo 配置、模块版本、运行时行为）。
- 优化近一年拉取流程：展示拉取进度、失败时保留上次成功缓存并明确提示。
- 增强阈值输入校验：非法输入时提示并回退到上次有效值。

## 影响
- 受影响规范：`specs/attendance-hours/spec.md`
- 受影响代码：`package.json`，`app.json`，`App.tsx`，`src/lib/attendance.ts`，以及可能的 Expo 配置与脚本
