# Teams 工时统计 App

本项目为 React Native (Expo) 应用，复刻 Notebook 中的 Teams 打卡数据获取与工时计算逻辑。

## 环境与启动

1. 安装依赖：
   - `npm install`
2. 启动开发服务器：
   - `npm run start`
3. 使用 Expo Go 扫码预览（iOS）。

如在 Windows 上遇到 `node:sea` 相关目录创建失败，可手动执行：
- `npm run patch:expo`
然后重新运行 `npm run start`。

## Web 预览说明

浏览器环境会触发 CORS 限制，需启动本地代理：

1. 启动代理：
   - `npm run proxy`
2. 启动 Expo：
   - `npm run start`
3. 在 Expo 控制台选择 `w` 打开 Web。

## 使用说明

- 在“设置”区输入 `emCode` 与 `Authorization`，系统会自动保存。
- 通过月份左右按钮选择查询月份，点击“查询 / 刷新”拉取数据。
- 仅当所选月份与下月两次请求均成功时更新页面数据。

## 指标与异常说明

- 平均工时：`总有效工时 / 有效工作日`，保留 2 位小数；当有效工作日为 0 时显示“异常”。
- 工时不足：非假期且 `工时 <= 10.5` 的记录以橙色高亮。
- 缺卡：非假期且上/下班时间缺失或无法解析的记录以红色高亮（优先级高于工时不足）。

## 测试

运行单元测试：
- `npm run test`
