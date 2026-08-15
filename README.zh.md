# dsh-offpeak

> DeepSeek Harness 错峰省钱助手 —— 高峰/错峰计价感知、延迟队列与省钱账本，深度集成 DSH Web 界面。

[English](README.md) | [简体中文](README.zh.md)

![License](https://img.shields.io/github/license/dsh-offpeak/dsh-offpeak)
![CI](https://img.shields.io/github/actions/workflow/status/dsh-offpeak/dsh-offpeak/ci.yml?branch=main)
![Release](https://img.shields.io/github/v/release/dsh-offpeak/dsh-offpeak)
![npm](https://img.shields.io/npm/v/dsh-offpeak)
![Downloads](https://img.shields.io/npm/dm/dsh-offpeak)

## 为什么需要它

DeepSeek API 按 UTC 时段分两档计价：

| 时段 | UTC 时间 | 价格 |
| --- | --- | --- |
| **高峰** | 08:30 – 16:30 | 基础价 × `peakMultiplier`（官方默认 **2 倍**） |
| **错峰** | 16:30 – 次日 08:30 | 基础价（1 倍） |

这意味着每一个**不着急的 token** 都能省 **50%**，同时还能避开高峰期的排队拥堵。`dsh-offpeak` 让时段一目了然，支持你（和你的 Agent）把耗时任务延迟到错峰执行，并诚实地记录这样做估算省下的每一分钱。

> ⚠️ **价格会变。** 默认价格与倍率以官方计价页为准（编写时取值），所有数字都可在设置中修改，请保持与官方同步。

## 功能特性

- **实时计价浮标**（输入框下方）——当前时段、×倍率、距下次切换倒计时、当前有效价格、今日节省；悬停查看完整面板。
- **模型工具**——`offpeak_status` / `offpeak_estimate` / `offpeak_defer` / `offpeak_queue`，让 Agent 自己会算账、会排队。
- **斜杠命令**——`/offpeak` 查看状态摘要，`/defer <任务>` 把任务暂存到队列。
- **错峰队列**——JSON 持久化、原子写入、损坏文件自动隔离；设置页或工具均可管理。
- **省钱账本**——追加式 JSONL 记录估算与暂存，含今日/累计统计与 7 天图表。
- **完全可配置**——价格、倍率、显示货币（USD/CNY）、显示时区，全部即时生效。
- **中英双语**，UI 基于官方 `--dsw-alias-*` 主题令牌，深色/浅色自适应。

## 安装

需要 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 配置（Node.js ≥ 22.19）：

```sh
dsh plugin --profile web add dsh-offpeak
```

或从 Git 仓库安装：

```sh
dsh plugin --profile web add "github:dsh-offpeak/dsh-offpeak"
```

安装后重启 `dsh --profile web`。插件会出现在 **设置 → 插件 → 错峰助手**；浮标显示在输入框下方。

> 数据存放在 `$DSH_HOME/offpeak/`（默认 `~/.dsh/offpeak/`）：`queue.json` + `ledger.jsonl`。卸载插件不会删除你的队列与账本文件。

## 使用

### 人类用户

- `/offpeak` —— 在对话中查看一次状态摘要。
- `/defer <任务描述>` —— 把任务加入队列（例如 `/defer 跑一遍完整回归测试`）。
- 悬停浮标查看价格与节省；打开 **设置 → 错峰助手** 查看完整面板。

### Agent（模型工具）

工具自动注册，模型会在相关场景主动调用：

| 工具 | 用途 |
| --- | --- |
| `offpeak_status` | 当前时段、倍率、倒计时、价格、节省、队列统计 |
| `offpeak_estimate` | 现在跑 vs 错峰跑的成本对比（会写入账本） |
| `offpeak_defer` | 入队任务，可附带 token 估算 |
| `offpeak_queue` | 查看、取消、清理队列 |

## 设置参考

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| 启用 | `true` | 显示浮标并启用队列与账本 |
| 显示货币 | `USD` | `USD` 或 `CNY`（使用 USD→CNY 汇率换算） |
| 输入/缓存命中/输出价格 | `0.28 / 0.028 / 0.42` | 基础（错峰）价格，USD / 1M tokens |
| 高峰倍率 | `2` | 高峰时段的价格倍率 |
| 显示时区 | `480`（UTC+8） | UTC 偏移分钟数，仅用于展示切换时间 |
| 记录时段切换 | `true` | 时段切换时向账本追加一条状态记录 |

## 开发

```sh
pnpm install          # 安装依赖
pnpm run check        # typecheck + test + lint + build（与 CI 等价）
pnpm run test:watch   # 测试迭代
```

目录结构：

```
src/
  pricing.ts     纯计价引擎（时段数学、成本估算）—— host 与浏览器共用
  contract.ts    线契约：settings/queue/ledger 类型、zod 编解码、Typert 调用描述
  store.ts       持久化队列 + 账本（原子写入、损坏隔离）
  runtime.ts     OffpeakRuntime —— `offpeak` Typert Remote 服务
  tools.ts       模型工具（offpeak_status/estimate/defer/queue）
  commands.ts    斜杠命令（/offpeak、/defer）
  index.ts       host 插件入口
  client/        浏览器端：状态浮标、设置面板、中英文案、样式
tests/           单元测试（计价边界、存储可靠性）
```

构建产物：`lib/index.js`（host ESM）、`lib/client.js`（浏览器包，由 `/plugins/dsh-offpeak/client.js` 提供）、`lib/types/`（类型声明）。

## 架构

- **单一事实来源**：`src/pricing.ts` 是零依赖纯函数；同一份代码在 host 运行、也打进浏览器包，所有界面天然一致。
- **严格线契约**：host 与 client 共享 zod 编解码与 Typert 调用描述（`src/contract.ts`），每次 Remote 调用都在线路上校验。
- **设置即时生效**：`offpeak` 设置命名空间 `applies: 'live'`，工具、命令、UI 读取同一解析值。
- **故障安全存储**：损坏文件自动隔离（不崩溃、不静默返回垃圾数据）；写入原子化（tmp + rename）。

## 路线图

- [ ] 错峰调度：时段切换时用全新 headless 会话自动执行队列任务
- [ ] 错峰感知的模型路由（贵模型只在错峰时段使用）
- [ ] 预算上限 + 超支告警
- [ ] 每周省钱报告
- [ ] 一键同步官方价格

## 安全

安装插件即运行第三方代码。本插件只在 `$DSH_HOME/offpeak/` 下写入，不读取其他任何位置，也不发起任何网络请求。漏洞报告请见 [SECURITY.md](SECURITY.md)。

## 协议

[MIT](LICENSE) © dsh-offpeak contributors。与 DeepSeek 无关联。
