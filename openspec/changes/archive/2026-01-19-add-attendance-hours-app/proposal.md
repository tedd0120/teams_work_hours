# 变更：构建 Teams 工时统计 iOS App（React Native/Expo）

## 为什么
需要在 Windows 环境下通过 Expo Go 预览 iOS，复刻 Notebook 中的工时数据获取与计算逻辑，提供可视化查询与汇总。

## 变更内容
- 实现打卡数据 API 拉取（含 Authorization、emCode），按指定月份与下月合并后过滤。
- 严格复刻数据清洗、工时与有效工作日计算规则。
- 提供设置区、月份选择、查询/刷新、指标仪表盘与明细列表（含异常高亮）。
- 使用本地存储持久化 emCode 与 Authorization。

## 影响
- 受影响规范：attendance-hours
- 受影响代码：新增 React Native (Expo) 应用代码与配置（目录待定）
