# S4a-c 收尾 · 招工资金「逐笔发放」真链路与判负（`R-9-98` / `R-9-101` / `R-9-102` / `R-9-103`）

> **状态：草稿骨架（先落骨架 · 证据优先）** —— 真链路读数与判负逐处**待回填**。
> 权威：`migrations/0042_job_settle_per_submission.sql`（**未 apply**，真库零位移）
> 探针：`backend-ts/.p9s10-s4a/s4a-chain.ts` · 读数：`.p9s10-s4a/s4a-chain-<RUN>.json`
> 硬口径：一切写入只在事务内 + `ROLLBACK`；连库只从主仓 `.env.local`；**不 apply 0042**；不 commit/push。

## 0 · 结论摘要（待回填）

| 腿 | 项 | 期望 | 实取 | 判 |
|---|---|---|---|---|
| A | (a) 发布押金 = `reward × headcount` | 雇主余额 −总额 / 冻结 +总额 | | |
| A | (b) 逐笔发放两份（各一份 `reward` + 分佣） | 每份净额/费率/分佣逐笔正确 | | |
| A | (c) 发满 `headcount` ⇒ `job.status='settled'` | settled | | |
| A | (d) 同提交号重放 ⇒ 幂等重放（非冲突） | `idempotent_replay=true` 零位移 | | |
| A | (e) 余额不足 ⇒ `LEDGER_INSUFFICIENT_BALANCE` | 原码 | | |
| A | (f) 分佣守恒（`ledger_assert_commission_conservation`）不破 | Σ 出池 == Σ 分佣 | | |
| A | (g) 净写 0 自证：回滚后逐表与基线相等 | 全等 | | |
| B | 判负①：结算键不含提交号 ⇒ 第二份必判「重放」 | 变异码可应用 + 第二份 replay | | |
| C | 判负②：托管退化为单份 ⇒ 第二份报冻结不足 | `LEDGER_INSUFFICIENT_FROZEN` | | |
| D | 判负③：发满后第三份必拒 | `JOB_STATE_INVALID` | | |
| E | 判负④（缺陷修复）：重放 ⇒ 首任务奖励零新增行 | 0 新行（且钩子仍在其路径上可控） | | |

## 1 · 真链路探针（腿 A）

（待回填：夹具、逐步读数、每步断言的实取值）

## 2 · 判负（腿 B/C/D/E）

（待回填：变异点逐字、变异副本可应用性、被观测的错误码/`idempotent_replay`、复原后主仓 `sha256` 不变）

## 3 · 已定缺陷修复（`R-9-103` · 重放零写）

（待回填：修前事实、修改点、判负读数）

## 4 · 未测项与原因

（待回填）

## 5 · 硬口径自证

（待回填：净写 0 / 主仓 sha256 / 不 apply 0042 / 未碰禁改文件）
