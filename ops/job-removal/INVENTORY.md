# job（悬赏）领域下线 · 清单（INVENTORY）

> 依据：Kevin 2026-10-21 裁定 —— job 体系弃用，**连表 DROP**（不备份）；`/bounty/:id` 页面移除；`/task` 列表页改造为 campaign 任务列表。
> 数据来源：dev 库实时目录 dump（`inventory-raw.json`，schema 顶 0069）+ 源码 grep。

## 1. 数据库对象（dev 实测）

| 类别 | 数量 | 明细 |
|---|---|---|
| 表 | 4 | `job`(45 行) · `job_application`(19) · `job_submission`(40) · `job_arbitration_log`(0) |
| 索引 | 20 | 全部随表 DROP |
| 触发器 | 13 | 同上 |
| 函数 | 19 | `job_post_event` / `job_settle_plan` + 5 组状态机与守卫族（迁移后实测 job 命名函数 17→0，余 2 为非 job 命名引用） |
| 外键 | 10 | 3 条子表→`job`；其余出边→`users` / `currency`，随表消失 |
| 视图 | 0 | 无 job 命名视图，无其它表带 `job` 列，无依赖视图 |

**ledger 安全**：`ledger_entry` 对 job 只有字符串字面量（`'job'`、`job_escrow*` kind），无 FK/CASCADE 关联 ⇒ DROP 不影响历史流水；`job_escrow` / `job_payout` / `job_fee` 三个 kind **保留在闭集**（历史账目仍可读）。

## 2. 源码面删除

| 面 | 处理 |
|---|---|
| `src/job-service.ts` · `src/job-funds-service.ts` | 整文件删除 |
| `src/database.ts` | 删 31 个 job 方法 + 4 个接口 + 2 个 normalizer + 2 段常量 SQL；`submitRating` 目标闭集收敛为 `{listing}`；`getTimeliness` 去 job 轴 CTE（4 个历史键保留 null） |
| `src/index.ts` | 删 **21 条**路由（4 GET task 读 / 2 POST task 写 / 3 POST admin task / 3 pending-verification / 7 job 主体 / 2 arbitration）；`/api/home` task 腿 → `tasks: []`；`/api/timeliness` job 腿保留 null 键 |
| 共享助手 | 抽到 `src/verb-shape.ts`（`ledgerErrorBody`/`sendGone`/`sendVerbError`/`VerbOk/VerbErr`），10 个模块回接 |
| `compliance-review-service` / `audit-console` / `translate-service` | 去掉 job 仲裁半、`job_arbitration_log` 白名单、`job` 翻译实体 |
| 注册点 | **130 → 109**（get 49 / post 53 / patch 4 / delete 3） |

## 3. 无效探针／门退场

- 删除 `ops/job/**`（旧 project-gate 断言 regs=128，已随路由删除失效）。
- 删除 8 个直接 `require('../src/job-service')` 的脚本：`p4z-audjk-01-probe`、`p4z-b2a-01-fixture`、`p4z-b2c-01-patch`、`p4z-b3c-02-e2e`、`p4z-b3c-03-chain`、`p4z-tr1a-01-offline-tests`、`p8-s10-invite-reward-gate`、`p8-s7-batt-checkin-gate`。
- 其余 `p4z-*` 仅在注释/HTTP 路径中提及，保留。

## 4. 前端面

见 `docs` 之外的前端改动（`TaskPage` 重写为 campaign 列表、`/bounty/:id` 与 `/task/new` 路由删除、6 个 job 组件与 5 个测试文件 `git rm`）。
