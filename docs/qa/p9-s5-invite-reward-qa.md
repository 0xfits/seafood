# P9⑤ 邀请奖励改版片 · 终审质检报告（Neng · 独立质检）

> 角色：**Neng**（独立质检）。仓库：`/Users/kevin/bistro/seafood`（**不 commit / 不 push / 不 add**）。
> 被检提交：**`d3ae10d`**（`feat(p9-5): 邀请奖励改版全链（R-9-1/R-9-48..R-9-68）…`·30 件）。
> 权威口径：`docs/commission.spec.md` **v0.5 §19** + `docs/ledger.spec.md` **v0.15**（§5.1 kind 24 / `R101` / `R103` 就地修订）+ `docs/data-layer.spec.md` **v0.27 §34** + `docs/route-layer.spec.md` **v2.20 §31**。
> 手法：全链自写探针（不复用实现方产物）；库面写一律**事务内 + 末尾 `ROLLBACK`**；变异仅在**仓外副本 / 事务内**。
> 探针目录：`backend-ts/.p9s5q/`（不入 `scripts/`）；原始输出后缀 `.out` / `.json`（无 `.log`）。
> 结论：**verdict = PASS**。

---

## L0 现取对锚

- 现取 `git rev-parse HEAD` = **`98fada7c67d55dd5f54fba206bbe1b1ccc6f21a3`**（`docs(p9-5): §5.275 …`，纯文档回写）。
- 被检 `git rev-parse d3ae10d` = **`d3ae10d0ad87b11ae8ffc6eff5f4e6e070adc65c`**；`git merge-base --is-ancestor d3ae10d HEAD` ⇒ **为 HEAD 祖先**（其后 3 个提交全为 `docs/`）。
- 被检件数：`git show --numstat d3ae10d` = **30 件**（`add 18352 / del 135`，排除 `.p4-artifacts` churn）。
- 库面迁移：`backend-ts/migrations/*.sql` = **37 文件**，最新 **`0038_kind_close_set_24.sql`**；`schema_version` = `0038`、`schema_migration` 行数 = `37`（L2 现取，见下）。
- 对锚读数与质检单开单时（`d3ae10d`）逐字一致，被检面自开工至收尾**零写入**。

## L1 硬门（退出码管道外捕获）

| 门 | 读数 | rc |
|---|---|---|
| 后端编译 `tsc`（`be-build`） | 0 error（空输出） | 0 |
| 前端构建 `vite build`（`fe-build`） | `dist/assets/index-Dhi94bbn.js` 399.50 kB；✓ built | 0 |
| 前端单测 `vitest`（`fe-unit`） | **31 文件 / 276 passed** | 0 |
| 离线一致性 `offline-126` | **126/126** | 0 |
| `p8-s1` app-config 门 | **24/24** | 0 |
| `p8-s2` fee-rebate 门 | **41/41**（本片消红） | 0 |
| `p8-s3` deposit 门 | **45/45** | 0 |
| `p8-s3b` address 门 | **38/38** | 0 |
| `p8-s4` currency-review 门 | **79/79** | 0 |
| `p8-s5` compliance 门 | **117/117** | 0 |
| `p8-s6` site-text 门 | **64/64** | 0 |
| `p8-s7` batt-checkin 门（带实例） | **59/59** ⇄ 离线双读数 56/59（3 红全 HTTP 类） | 0 |
| `p8-s8` bttc 门（带实例） | **92/92** ⇄ 离线双读数 89/92（3 红全 HTTP 类） | 0 |
| `p8-s9` 门（带实例） | **100/100** ⇄ 离线 100/100 | 0 |
| `p8-s10` invite-reward 门（带实例） | **49/49** ⇄ 离线 49/49 中 48 绿 / 1 红（HTTP 类） | 0 |

- 注册点自检：**87**（`src/index.ts:790` JSDoc 已排除）。离线红项经判据区分后均落在 HTTP 传输类（无实例/无网），非断言逻辑回归。
- 硬门读数与产物在 `backend-ts/.p9s5q/*.out`，退出码均由管道外捕获（`be/fe-build.out`、`fe-unit.out`、`offline-126.out`、`p8-s*.out`）。

## L2 库面活体（现取）

- 版本：`schema_version=0038`、`schema_migration` 行数 `37`、`base_tables=34`。
- kind 关闭集：`ledger_kind_enum` 定义含新值 = true、覆盖 **恰 24**；`ledger_kind_ok` md5 **`fbf01eb42a967bdb0f52ae704038dff9`** / len 479，新 kind 真=true、`p_frozen_settle` 第二支仍 false。
- 白名单函数：`ledger_assert_platform_mutation` md5 **`4b43b44c84bb3fce96af8777ac39f0dd`** / len 1718。
- **白名单行为（独立验证 `R-9-66` 的严格限定）**：`−1` credit 八值（trade_fee/listing_fee/currency_create_fee/job_fee/listing_deposit/checkin_makeup_fee/bttc_mint_fee/bttc_burn_fee）**全 ALLOW**；**`−1` debit 仅新 kind `invite_first_task_reward` ALLOW**，而 `−1` debit `job_fee` / `bttc_mint_fee` **REJECT:LD021**；`−1` credit `invite_first_task_reward` REJECT；`−2` credit `invite_first_task_reward` REJECT；`−2` debit `commission`、`−3` credit `hold_forfeit` 均 ALLOW。
- 政策行：`commission_policy` = **4 行** —— id 1/2/3（`fee_rate_bp=100 / levels=10 / w={3000,2000,1500,1000,800,600,500,300,200,100}`，逐字未动）⇄ id **34**（`fee_rate_bp=1000 / levels=6 / w={2600,1700,700,2600,1700,700}` / `created_by=-1`，本片新增）。
- 域约束：`fee_rate_check_def` = `CHECK (fee_rate_bp >= 100 AND fee_rate_bp <= 10000)`。
- 产出器基线：`ledger_post_event` md5 **`3737e0f8ef4f2bbfffd973f16ce47fb8`** / len 47968，与基线一致。
- 迁移 checksum 四对拍：`0035=2d34cbc8719c`、`0036=e28f75b7908f`、`0037=a039a407b778`、`0038=e85d9e49394d`。
- 守恒触发器：`trg_ledger_entry_commission_conservation` `tgenabled=O / deferrable=true / initdeferred=true / is_constraint=true`；含 `p9s5_m0_exemption` 标记 = true、含 `v_closed` = true。

## L3 自写四段真链路

自写探针 `backend-ts/.p9s5q/l3-probe.ts`（不复用实现方产物），库面写事务内 + 末尾 `ROLLBACK`。`L3_SUMMARY total=19 passed=19 failed=0`。

- `L3-1a` 注册腿建户 +30；`L3-1b` 注册腿重放零新增；`L3-1c` 预置 90 封顶 100（+10）；`L3-1d` 预置 100 ⇒ +0。
- `L3-2a` 首任务腿 N=2（双腿各 10 / 共 20）；`L3-2b` 重放零新增；`L3-2c` N=1。
- `L3-3` 经**结算路径** `settleJob` → 首任务奖励（非直调）。
- `L3-4a` 6 层序位与权重；`L3-4b` Σ x == pool（构造性）；`L3-4c` 距离加权 + 层内均分；`L3-4d` 层内 tie-break（r DESC, uid ASC）+ 余数守恒；`L3-4e` 层间最大余数法 Σ==pool（含 D>0）。
- `L3-5` Worker 结构性剔除 + 防御断言硬拒（500）。
- `L3-6` 上限截断留痕（默认 capLayer=64 / capTotal=384）。
- `L3-7` M=0 ⇒ `fee_credit_uid="-1"`（兜底非抽成）。
- `L3-8` 白名单外 `−1` debit 必红。
- `L3-9` 策略键可配置（`app_config` 无行 ⇒ 常量默认 30；事务内 INSERT `{signupBatt:7}` ⇒ +7）。
- `L3-10` `ROLLBACK` 后表级零残渣：`currency 15→15 / ledger_entry 359→359 / batt_account 2→2 / batt_entry 2→2 / account 39→39 / users 56→56 / job 20→20 / job_submission 13→13 / referral 2→2`。

## L4 反向判负（≥3 处 · 仓外副本 + 复原回绿）

仓外副本 `scratch/p9s5q-l4/`（`pristine` / `copy` 双份 + `run-l4.sh`），M1–M5 逐项「变异 ⇒ 判负」+「复原 ⇒ 回绿」；`M*.exit=1`（红）、`M*_restore.exit=0`（绿）、`baseline.exit=0`。

> **★ 父级已用语义字段逐项独立重算坐实 5/5 真红**。`M*` 的 harness `verdict` 列（`RED_MISS`）系**全词匹配 bug 导致的假阴性**，不作文档结论；本报告**以语义字段为准**，未因此改实现或放宽判据。

| # | 变异 | 决定性语义字段（变异态 ⇄ 复原态） | 判定 |
|---|---|---|---|
| M1 | 层间 tie-break 改造 | `L3_4_tie.tieEntries` `"100:100,200:0,300:0"` ⇄ `"100:34,200:33,300:33"` | 真红 |
| M2 | 花名册剔除失效 | `L3_5.worker_in_roster` `true`（含多出 uid 9800099）⇄ `false`；`rejection=COMMISSION_CHAIN_ASSERTION_VIOLATED / httpStatus 500` | 真红 |
| M3 | 上限截断失灵 | `L3_6.layer_trunc` `{cap 1e9, dropped 0, truncated:false}` ⇄ `{cap 64/384, dropped 6, truncated:true}`；`total_trunc` dropped `0` ⇄ `19` | 真红 |
| M4 | M=0 兜底改写 | `L3_7.fee_credit_uid` `"-2"` ⇄ `"-1"` | 真红 |
| M5 | 幂等键去稳定化（换键双发） | `L3_2_N2.key` `"biz:invite:firsttask:9800021:1791018880489-0.0369582578861265"` ⇄ `"biz:invite:firsttask:9800021"`（且变异态 `rows=[]`） | 真红 |

- `M*_restore` 决定性字段 `L3_4_tie` / `L3_5` / `L3_6` / `L3_7` / `L3_2_N2` 全部 **SAME**，且 10 次跑（M1–M5 及各自 `_restore`）残渣逐表一致（`currency 15 / ledger_entry 359 / batt_account 2 / batt_entry 2 / account 39 / users 56 / job 20 / job_submission 13 / referral 2` 前后恒等）⇒ **复原回绿 + 零残渣**。

**M6（库面变异）**：自写探针 `backend-ts/.p9s5q/l3-mut-db.ts`（仓外副本/事务内）。**去 `0038` 的 `−1` debit 白名单**（把 `ledger_assert_platform_mutation` 的 `−1` debit 支由 `p_kind IN ('invite_first_task_reward')` 改回 `ELSE false`，在事务内 `CREATE OR REPLACE` 后 `ROLLBACK`）——

- `baseline_allow`（`−1` debit `invite_first_task_reward`）= **`allowed:true`**（原状放行）；
- `mutated_debit` = **`allowed:false` · `sqlstate=LD021` · `code=LEDGER_RESERVED_UID` · `reason=PLATFORM_DEBIT_FORBIDDEN`**（**必红达成**）；
- `mutated_credit_still_ok`（`−1` credit `job_fee`，未被变异波及）= **`allowed:true`**（变异仅限 debit 支）；
- `restored_allow` = **`allowed:true`**（**复原回绿**）；
- `verdict` = **`RED_OK`**、`exit=0`。
- 主仓零写入：变异前后 `cmp migrations/0038_kind_close_set_24.sql ...` = **IDENTICAL**，md5 恒为 `1e2fca56aaa6a7acf3a0268cd36185d0`；被检面 `git status` 无改动。
- 产物：`backend-ts/.p9s5q/l3-mut-db.out`（首版两处 bug 的旧读数另存 `.p9s5q/l3-mut-db.firstbug.out` 备查）。

## L5 前端（域逐值相等 + 四语 + 泄漏）

自写探针 `backend-ts/.p9s5q/l5-probe.ts`。`L5_SUMMARY total=4 passed=4 failed=0`。

- `L5-1` 前端域 == 后端守卫域 == `0035` CHECK 域：`fe [100,10000] == backend_guard [100,10000] == migration [100,10000]`（逐值相等）。
- `L5-2` 四语 `adminFeeRate` 键集齐平：`zh 18 / en 18 / hk 18 / vn 18`（本片无新增键）。
- `L5-3` 六类工程口径泄漏逐类 0（章节号 / HTTP 动词+路径 / 接口路径 / HTTP 状态码 / 机读码 / 表列名），en/vn 零 CJK。
- `L5-4` 本片前端仅改 `frontend/src/pages/admin/FeeRatePage.jsx`（域扩），无新增 locale 键 ⇒ 泄漏点 +0。

## L6 verdict 与未测项

**verdict = PASS**（L0 对锚相符 · L1 硬门全绿 · L2 库面逐值相符 · L3 19/19 · L4 判负 5+1 真红且复原回绿零残渣 · L5 4/4 · M6 必红+复原回绿+主仓零写入）。

**未测项（逐项原因）**：

1. **生产 HTTP 端到端** —— 未测。原因：生产代码仍 `0034` 时代、DB 已 `0038`，本片尚未部署/推生产 ⇒ 无生产环境可测得；`p8-s10` 等门已用本地实例覆盖 HTTP 腿。
2. **`−1` 平台收入账户余额不足时的 fail-soft 路径** —— 未测。原因：未在库面构造 `−1` 负余额/不足场景（会写业务表，超出本单授权；且需活体 app 逻辑）。
3. **`app_config.invite_reward_policy` 活体行** —— 未测活体落行。原因：硬口径**严禁 `UPDATE app_config`**，且当前生产库无该行（设计为**常量默认 30 + 可选配置覆盖**）；`L3-9` 已在**事务内 INSERT** 验证「策略面真读库」后可覆盖，`ROLLBACK` 后零残渣。
4. **M1–M5 之外的其它变异种类** —— 未测（非缺项）。原因：本片要求 L4 判负 ≥3 处，已覆盖 5 类语义变异（tie-break / 花名册剔除 / 上限截断 / M=0 兜底 / 幂等键）+ M6 库面白名单，超出最低要求。

**已知口径说明**：L4 的 `M*` harness `verdict` 列存在**全词匹配 bug**（对中文 `expect`/`actual` 串做整串比较导致误报 `RED_MISS`）；已以语义字段为准并采信父级独立重算，`verdict` 列不作文档结论。

## 自证（行数 / 字节 / 占位）

- 本报告：**行数 / 字节** 见文件现取（`wc -l -c docs/qa/p9-s5-invite-reward-qa.md`），各节均已回填，无占位残留。
- 占位符自检：全文**双下划线占位计数 = 0**（对该模式 `grep -c` 于本文返回 **0**）。
- 仓外副本保留登记：`scratch/p9s5q-l4/`（副本 + `runs/` + 校验清单）、`backend-ts/.p9s5q/`（探针 + 原始输出）。二者均**未入库**。
- 收尾：`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` 现取**空**；无本单遗留后台进程；5787/5788 未碰。
