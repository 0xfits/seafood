# P9⑤ 邀请奖励改版 · 实现【收尾单 A（自证 + 回填）】· 审计报告

> 角色：**Kong**（实现）。仓库：`/Users/kevin/bistro/seafood`（**本单不 commit / 不 push**）。
> 权威口径：`docs/commission.spec.md` **v0.4 §19**（业务口径 / `C-2` / 裁定 `R-9-48`..`R-9-66`）
> + `docs/data-layer.spec.md` **v0.26 §34**（键面 / 库面 / 载体 / 迁移内容契约）
> + `docs/route-layer.spec.md` **v2.19 §31**（读写口 / 权限键 / 注册点 / 错误面 / 真生效）
> + `docs/ledger.spec.md` **§5.1 / R40 / R101 / R103**。
> 本收尾单（自证 + 回填）建立在：① 三迁移真跑三 PASS（`0035`/`0036`/`0037`）；
> ② `commission.ts` 计算核心（**+430 / −28**）；③ `database.ts` §6.2 两腿代码 + `0038` 建（上单完成）。
> 本单**只补自证与回填**：新增 `0038` 真跑自证 + 两腿事务内真跑读数 + 报告逐节回填；**不做接线**、**不 apply**。

---

## 0. 本单锚与范围

| 项 | 现取 | 读数 |
|---|---|---|
| 开工对锚 `git log --oneline -1` | `terminal` | `71d67ab docs(p9-5): §5.269/v0.269 —— P9⑤ 续跑（§6.2 两腿代码 + 0038 建）+ 我现取坐实 R103 并终审 R-9-66（准 −1 debit 首开但严格限定）+ 并派收尾单与规范回写单` |
| 三迁移文件 | `wc -l` | `0035_fee_rate_range_extend.sql` = 127 行；`0036_commission_policy_p9_5.sql` = 103 行；`0037_commission_conservation_m0.sql` = 199 行（**均在盘、未 apply**） |
| `0038` 文件 | `read_file` | `0038_kind_close_set_24.sql` = 259 行 / 15,993 B（**在盘、未 apply**） |
| `commission.ts` 改动面 | `git diff --numstat` | `458 / ?`（`+430 / −28` 计算核心；本单未改） |
| DB `schema_version`（只读探针） | `.p9s5-ro/probe.ts` / `.p9s5-impl/p9s5-ro-survey.ts` | `0034`（`schema_migration` = **33 行 / max `0034`**；`users` = 56 行） |
| 关键现取 | 只读侦察 | `ledger_kind_enum` = **23 值**（不含新 kind）；`ledger_kind_ok('invite_first_task_reward')` = **false**；`-1` 账户 `cid=1` 余额 = `167483` |
| **不 apply 任何迁移** / **不接线**（本单硬边界） | — | — |

> 侦察原始输出：`backend-ts/.p9s5-impl/p9s5-survey-20261003T081451Z.json`（探针 `p9s5-ro-survey.ts`，只读；**不入 `scripts/`**）。

---

## 1. 三迁移结构面（`0035` / `0036` / `0037`）

> 依据：`commission.spec §19.6 抬头 / §19.11`（`R-9-48`/`R-9-49`/`R-9-51`/`R-9-52`）+ `data-layer.spec §34.6`。

### 1.1 `0035_fee_rate_range_extend.sql`（费率载体 = 变体 Ⅰ · `R-9-48`）

- **做什么**：`ALTER TABLE public.commission_policy DROP CONSTRAINT IF EXISTS commission_policy_fee_rate_rng;` → `ADD CONSTRAINT commission_policy_fee_rate_rng CHECK (fee_rate_bp BETWEEN 100 AND 10000);`
- **语义**：`fee_rate_bp` 由「平台抽成（1%–5%）」改 **「进池比例」**（`1000` = 10%）。
- **自检**（`R-9-24` 真跑）：D.1 约束指纹现取对拍（`CHECK (((fee_rate_bp >= 100) AND (fee_rate_bp <= 10000)))`）；D.2 三项行为探针（`1000` 可入 / `99` 拒 `23514` / `10001` 拒 `23514`）+ 边界正例（`100` / `10000` 可入）——**子事务 + 哨兵回滚 ⇒ 零残留**。
- **硬边界**：不改 `0001`–`0034` 任何字节；不改 `ledger_post_event`；不新增错误码（闭集 33）/ kind；不新增政策行（`0036` 的活）。

### 1.2 `0036_commission_policy_p9_5.sql`（新政策行 · `R-9-53`/`R-9-58`/`R-9-60`）

- **做什么**：单条 `INSERT … SELECT 1000, 6, ARRAY[2600,1700,700,2600,1700,700]::smallint[], now(), -1 WHERE NOT EXISTS (SELECT 1 FROM public.commission_policy WHERE fee_rate_bp = 1000 AND levels = 6);`（**幂等**）。
- **口径**：权重 = 对称 `{2600,1700,700,2600,1700,700}`（序 `[U1,U2,U3,D1,D2,D3]`，`Σ = 10000`）；`created_by = -1`（平台保留 id）；`levels` 语义勘误 = 「有效层数（含下 3）」；域 `1..10` 容 6 ⇒ **无需扩 CHECK**。
- **自检**（`R-9-24`）：D.1 新行恰 1（`fee_rate_bp=1000 ∧ levels=6`）；D.2 `weights_bp` 恰 6 项 ∧ `Σ=10000` ∧ 逐项相符；D.3 历史 3 行逐字未动（`fee=100 ∧ levels=10 ∧ 10 项权重` 行数 = 3）；D.4 表行数 `3 → 4` ∧ `created_by=0` 种子仍在。
- **硬边界**：不改 `0001`–`0035`；**不 UPDATE / 不 DELETE**（append-only 触发器拒）；不碰约束（域扩 = `0035`）。

### 1.3 `0037_commission_conservation_m0.sql`（DB `Σ` 断言 = 变体 Ⅰ · `R-9-51`+`R-9-52`）

- **做什么**：`CREATE OR REPLACE FUNCTION public.ledger_assert_commission_conservation()` —— 在**原「相关行」闸之前**新增「`M = 0`（无合格受益人）豁免」分支：`IF NEW.kind = 'job_fee' AND NEW.uid = -1 AND NEW.delta > 0 THEN … RETURN NULL`（可检索标记 `p9s5_m0_exemption`）；**`0011` 版函数体逐字保留**（含 F3「事件闭合」判据）。
- **★ 播种源勘误（`R-9-64`）**：现取 `pg_proc.prosrc` == **`0011:81-145`** 版（**非 `0007:317-354`** 原文）——`0011`（P2 质检修复单 · F3）已用 `CREATE OR REPLACE` 改写过该函数。照 `0007` 原文抽源会静默回退 F3 修复 ⇒ **本迁移播种源 = `0011` 逐字**。
- **自检**（`R-9-24`）：D.1 新函数 + `0011` 版原形状逐字在场（`v_closed` / `event_closed` / `ORDER BY e2.txid DESC` / `IF v_pool_in <> v_paid_out THEN` / `COMMISSION_SPLIT_SUM_MISMATCH` / `LEDGER_RECONCILE_MISMATCH`）；D.2 新 `M=0` 豁免分支在场；D.3 触发器形态未变（`DEFERRABLE INITIALLY DEFERRED` 约束触发器、启用）；D.4 ★ **`ledger_post_event` 函数体 `prosrc` 逐字未动对拍**（`md5 = 3737e0f8ef4f2bbfffd973f16ce47fb8` / `len = 47968`）。
- **硬边界**：不重建触发器（`CREATE OR REPLACE FUNCTION` 保 OID ⇒ 既有 `trg_ledger_entry_commission_conservation` 自动指向新体）；不新增错误码；断言仍只读。
- **诚实边界**：现取 `planJobSettlement`（`M=0`）录 `fee_credit_uid = -1`（`R-9-52`）⇒ 该事件**不产生任何 `-2` 行** ⇒ 原断言本就（触发闸 `uid=-2` 不命中）返回 `NULL`；本分支是**显式化 / 防御性**（把 `-1` 入池行明确记为「设计内 `M=0` 归宿」），**不放宽任何真判负**。

---

## 2. 四项读数（`R-9-24` 真跑自证 · 单事务 + 末尾 `ROLLBACK`）

> 原始输出：`backend-ts/.p9s5-impl/r9-24-20261003T075833Z.json`（探针 `r9-24-realrun.ts`，**不入 `scripts/`**）。
> 每迁移四读数：① 无错执行；② 回滚后新对象不在；③ `schema_migration` 无新行；④ 目标对象逐字复原。

| `version` | ① 无错 | ② 新对象不在（回滚后） | ③ `schema_migration` 无新行 | ④ 目标对象复原 | 事务内后态（关键） |
|---|---|---|---|---|---|
| `0035` | ✅ `true` | ✅ `true`（`fee_rng` 回退含 `500`、不含 `10000`） | ✅ `true`（行数 33→33 / `max` `0034`→`0034`） | ✅ `true` | `post_fee_rng_def = CHECK (((fee_rate_bp >= 100) AND (fee_rate_bp <= 10000)))` |
| `0036` | ✅ `true` | ✅ `true`（`policy_count` 回 3、无 `|1000|6|` 行、`fee_rng` 回退） | ✅ `true` | ✅ `true` | `post_policy_count = 4`（3 历史 + 1 新） |
| `0037` | ✅ `true` | ✅ `true`（`conservation_md5` 回 `27ddc76b842594cb6ee8673c171e6526`） | ✅ `true` | ✅ `true` | `post_conservation_md5 = 3a6dca5e38189a1020dcaade22dd2401` ∧ `post_conservation_has_m0 = true` |

**共同不变量**：`post_event_md5 = 3737e0f8ef4f2bbfffd973f16ce47fb8` / `len = 47968`（三迁移均**未动 `ledger_post_event`**，裁定 #14）；`conservation_trigger = O/true/true/true`（启用 / `DEFERRABLE` / `INITIALLY DEFERRED` / 约束触发器）；`new_relations_added = 0`（三迁移均零新表）。`0036` 的准入前提 = `0035`（`fee_rate_bp=1000 ∉ 100..500`）⇒ 真跑同事务先跑 `0035`。

### 2.2 `0038_kind_close_set_24.sql` 四项读数（★ 本单新增自证）

> 原始输出：`backend-ts/.p9s5-impl/r9-24-0038-20261003T081606Z.json`（探针 `r9-24-0038-realrun.ts`，**不入 `scripts/`**）。手法：单事务 `BEGIN; <0038 全文>; ROLLBACK;`（**禁 `COMMIT`**）。

| 项 | 读数 |
|---|---|
| 文件指纹 | `migrations/0038_kind_close_set_24.sql` = 259 行 / **15,993 B**（`Buffer.byteLength` utf8） |
| ① 无错执行 | ✅ `true`（`exec_err = null`；文件内两段 `DO` 自检 + `ledger_assert_platform_mutation` 正负自检全过） |
| ② 回滚后新对象不在 | ✅ `true`：`ledger_kind_enum` 回 **23 值**（def 不含 `invite_first_task_reward`）；`ledger_kind_ok` 回 `md5 = dbed013e538614b141df866e770b9519 / len 447`；`ledger_assert_platform_mutation` 回 `md5 = 3df7bb9e794c1c7858b2775d0edad7ed / len 1520` |
| ③ `schema_migration` 无新行 | ✅ `true`：行数 `33 → 33` / `max` `0034 → 0034` |
| ④ 目标对象逐字复原 | ✅ `true`：enum def / 两函数 `md5`+`len` / `ledger_entry`(359) / `batt_account`(2) / `batt_entry`(2) / `users`(56) 全等 `before`；`new_relations_added = 0`（`base_tables 34 → 34`） |
| 事务内后态（关键） | `post_kind_enum_def` = **24 值**（末位 `invite_first_task_reward`）；`post_kind_ok_md5 = fbf01eb42a967bdb0f52ae704038dff9 / len 479`；`post_assert_md5 = 4b43b44c84bb3fce96af8777ac39f0dd / len 1718` |

**行为面自检（事务内 · `0038` 生效态）**：

| 探针 | 期望 | 现取 |
|---|---|---|
| `ledger_kind_ok('invite_first_task_reward')` | `true` | ✅ `true` |
| 24 值逐字逐真（`bad_count`）/ 闭集外 / 空串 / 幻造 | `0` / `false` / `false` / `false` | ✅ `0` / `false` / `false` / `false` |
| `ledger_kind_ok('invite_first_task_reward', true)`（冻结族第二支） | `false`（新 kind **不属**冻结族） | ✅ `false` |
| `ledger_kind_ok('job_payout', true)`（冻结族既有成员抽查） | `true` | ✅ `true` |
| `ledger_assert_platform_mutation(-1,'invite_first_task_reward','debit')` | **放行**（`R-9-66` 白名单内 · `-1` 首次开 debit） | ✅ `ok=true` |
| `ledger_assert_platform_mutation(-1,'job_fee','debit')`（★ 活体负对照） | 必红 `PLATFORM_DEBIT_FORBIDDEN` | ✅ `LD021` `LEDGER_RESERVED_UID` / `reason = PLATFORM_DEBIT_FORBIDDEN` |
| `ledger_assert_platform_mutation(-1,'bttc_mint_fee','debit')`（负对照②） | 必红 `PLATFORM_DEBIT_FORBIDDEN` | ✅ `LD021` / `PLATFORM_DEBIT_FORBIDDEN` |
| `ledger_assert_platform_mutation(-1,'invite_first_task_reward','credit')` | 必红 `PLATFORM_CREDIT_KIND_FORBIDDEN`（credit 八格未被顺带放宽） | ✅ `LD021` / `PLATFORM_CREDIT_KIND_FORBIDDEN` |
| `ledger_assert_platform_mutation(-2 / -3,'invite_first_task_reward','credit')` | 必红（其它平台格不得被顺带放宽） | ✅ `LD021` / `PLATFORM_CREDIT_KIND_FORBIDDEN` |
| `ledger_assert_platform_mutation(-1,'trade_fee','credit')` | 放行（八格未丢 · 抽查） | ✅ `ok=true` |

> 口径勘误登记：任务述 `R-9-66` 写「白名单外 `−1` debit 仍必红 `PLATFORM_CREDIT_KIND_FORBIDDEN`」；**代码事实 = `p_dir='debit'` ⇒ `PLATFORM_DEBIT_FORBIDDEN`**（`0004:417` 的 `CASE`）。本报告以**代码事实**为准（`debit → PLATFORM_DEBIT_FORBIDDEN`；`credit → PLATFORM_CREDIT_KIND_FORBIDDEN`），两向皆闭集内。

---

## 3. 计算核心改动面（`commission.ts` · +430 / −28）

> `tsc -p tsconfig.json --noEmit` = **0**。改动均为**纯增量 / 语义保留**。**本单未改 `commission.ts`。**

| 落点 | 现取行 | 性质 |
|---|---|---|
| `getDownChain(worker, 3, ex)` | `:358-405` | **新增** 只读下行递归 CTE（`R-9-50` 变体 Ⅰ · 零新表 · 走 `idx_referral_parent`） |
| `splitPoolTwoLevel(pool, layers)` | `:635-690` | **新增** 两级最大余数法（层间 `(r DESC, L DESC)` → 层内均分 `(r DESC, uid ASC)`；`Σ x == pool` 构造性，`R-9-54`） |
| `buildCommissionRoster(worker, up, down, policy, caps)` | `:895-962` | **新增** 以 Worker 为中心「上 3 ∪ 下 3」名单组装 + 结构性剔除 Worker + 双层上限截断留痕（`R-9-55`/`R-9-56`） |
| `planJobSettlement` 重写 | `:978-1063` | 订正 `M = roster.M`（存在层数 `0..6`，`R-9-46` 勘误）；`M=0 ⇒ fee_credit_uid = -1`（`R-9-52`）；`up` 只取 3 层；`assertReferralChainInvariants` 扩「名单含 Worker」 |
| `assertReferralChainInvariants` 扩 | `:441-482` | 新增 `down_chain` / `roster_uids` 入参 ⇒ 名单含 Worker ⇒ `500 LEDGER_RECONCILE_MISMATCH` + `reason = COMMISSION_CHAIN_ASSERTION_VIOLATED`（`R-9-56`） |
| `splitPool` 成两级入口 | `:699-708` | 重载：`Amount[]` ⇒ 一级（原语保留）；`PoolLayer[]` ⇒ 两级 |
| `SettlementPlan` 增 4 必填字段 | `:750-758` | `down_depth` / `down_truncated` / `roster_size` / `truncation`（重放路径 `:1531-1536` 亦显式占位） |
| `CommissionLayer` 增 3 可选字段 | `:723-729` | `direction` / `distance` / `layer_share`（重放路径不填 = `undefined`） |
| `COMMISSION_CAP_LAYER_DEFAULT = 64` / `COMMISSION_CAP_TOTAL_DEFAULT = 384` | `:847-848` | 名单上限（`R-9-55`） |

---

## 4. `§6.2` 两条一次性奖励（`database.ts`）

> 权威：`commission.spec §19.5⑦` + `R-9-57` + `R-9-65`/`R-9-66`；`data-layer.spec §34.3`。代码面已落（上单），本单**真跑自证**。

### 4.1 配置面（现取确认）

| 锚 | 现取 | 读数 |
|---|---|---|
| 键名（`B3`） | `database.ts:74` | `invite_reward_policy`（`APP_CONFIG_LEGAL_KEYS` 9 键之一） |
| 字段闭集 | `database.ts:201-203` | `INVITE_REWARD_POLICY_FIELD_TYPES = { signupBatt, firstTaskUsd, rewardLevels }`（3 字段） |
| 域 | `database.ts:200-203` | 三者皆 `POSITIVE_INT` |
| 默认常量 | `database.ts:383-385` | `INVITE_REWARD_POLICY_DEFAULTS = { signupBatt: 30, firstTaskUsd: 10, rewardLevels: 6 }`（本续跑单新增） |
| 解析器 | `database.ts:390-401` | `resolveInviteRewardPolicy(raw)`：**逐字段** fail-closed 回默认；`source = 'config'`（有行）｜`'constant'`（无行） |

### 4.2 代码面改动（本单/续跑单 · `database.ts` §6.2 两腿 + `ledger.ts` 三处编码）

| # | 落点 | 现取行 | 性质 |
|---|---|---|---|
| 1 | `INVITE_REWARD_POLICY_DEFAULTS`（30 / 10 / 6）+ `resolveInviteRewardPolicy` | `database.ts:383-401` | **新增** 常量 + 逐字段 fail-closed 解析器 |
| 2 | 幂等键前缀常量 | `database.ts:403-406` | **新增** `INVITE_FIRST_TASK_KEY_PREFIX = 'biz:invite:firsttask:'` / `INVITE_SIGNUP_KEY_PREFIX = 'biz:invite:signup:'` |
| 3 | 注册腿 `grantSignupInviteBatt(uid, ex?)` | `database.ts:4648-4696` | **新增**：单语句 CTE（`prior` 幂等闸 + `cur`/`target` 封顶 `BATT_CAP_HARD_MAX=100` + `batt_account` upsert + `batt_entry`），**batt 面零 kind**；返回 `granted\|replayed\|capped` |
| 4 | 首任务腿 `settleInviteFirstTaskReward(input)` | `database.ts:4707-4768` | **新增**：判 `job.worker_uid` + `referral.parent_uid`（`depth=1`）⇒ 组 entries（`-1` 出 `-(perLeg×N)` + 每受益人 `+perLeg`）⇒ **唯一写入面 `postEvent`**（`R-9-65`）；返回 `posted\|replayed\|skipped_no_worker\|skipped_no_recipient` |
| 5 | 注册点接线（既有） | `database.ts:2140` | `findOrCreateUserByEvm` 新户分支调 `grantSignupInviteBatt(user.uID)`（**已接线**，见 §6） |
| 6 | `LEDGER_KINDS` 23 → 24 | `ledger.ts:168-177` | **新增第 24 值** `invite_first_task_reward`（末位追加，不改前 23 次序） |
| 7 | `PLATFORM_KIND_WHITELIST['-1'].debit` | `ledger.ts:583` | `[]` ⇒ `['invite_first_task_reward']`（★ **首次给 `-1` 开 `debit`** · `R-9-66`） |
| 8 | `ledger.ts` 改动面 | `git diff` | `+14 / −1`（仅注释 + 上述两处编码） |

> **三处编码同集**（`R-9-40` 一族）：DB `ledger_kind_enum` CHECK（`0038`）+ DB `ledger_kind_ok`（`0038`）+ TS `LEDGER_KINDS`（`ledger.ts:168`）—— 本单真跑取证见 §2.2 / §4.4。

### 4.3 注册腿真跑（`grantSignupInviteBatt` · 事务内注入 `ex`）

> 原始输出：`backend-ts/.p9s5-impl/p9s5-impl-realrun-20261003T082015Z.json`（探针 `p9s5-impl-realrun.ts`）。
> 手法：**同一事务内先跑 `0038` 全文** → 建 fixture（users / `referral_bind` / 预置 `batt_account` / 策略键 `INSERT`）→ 调 `DatabaseService.grantSignupInviteBatt(uid, tx)` → 末尾 `ROLLBACK`。**禁 `UPDATE app_config`**（策略键一律事务内 `INSERT`）。

| 用例 | 输入 | `outcome` | `batt` | `grantedBatt` | `source` | `batt_entry`（reason / key） |
|---|---|---|---|---|---|---|
| G1 建行 | uid `990011`（无 batt 行） | `granted` | 30 | **+30** | `constant` | 1 行 `invite_signup` / `biz:invite:signup:990011`（`delta=30 batt_after=30`） |
| G2 重放 | 同 `990011` 再调 | `replayed` | 30 | **0** | `constant` | **零新增**（仍 1 行） |
| G3 封顶 | uid `990012`（预置 `batt=90`） | `capped` | 100 | **+10** | `constant` | 1 行 `invite_signup` / `biz:invite:signup:990012`（`delta=10 batt_after=100` · **丢弃 20**） |
| G4 满封顶 | uid `990013`（预置 `batt=100`） | `capped` | 100 | **0** | `constant` | **零行**（`after==cur` ⇒ 不产 `batt_entry`） |
| G5 config 源 | uid `990014` + 事务内 `INSERT` `invite_reward_policy={"signupBatt":40,…}` | `granted` | 40 | **+40** | **`config`** | 1 行 `invite_signup` / `biz:invite:signup:990014` |

**读断**：① 建行 `+signupBatt`（默认 30）✅；② 同键重放**零新增 / 零副作用**（`prior` 在场 ⇒ 整条语句不产行）✅；③ 已有 batt ⇒ `+30` 且**封顶 `BATT_CAP_HARD_MAX=100`**（G3 丢弃 20、G4 丢弃 30 且不产流水行）✅；④ 配置源生效（`source=config`，值取自事务内 `INSERT` 的策略行）✅；⑤ ⚠️**不得 `UPDATE app_config`** —— 已守（仅 `INSERT`）。

### 4.4 首任务腿真跑（`-1` 出账 + 受益人 + 负对照）

> ★ **方法级 `ex` 注入缺口（诚实边界）**：`settleInviteFirstTaskReward` **不接收 `ex`**；其写路径 = 高层 `postEvent` ⇒ `callLedgerFnOnce` 走**自有连接**（`ledger.ts:1040-1057`，driver `pool` = 只读池）—— 单语句自带隐式事务（`R55`/`R57`/`CR29`），**不参与调用方事务**。⇒ **迁移未 apply 时，该方法无法加入「含未提交 `0038`」的本事务**（其连接看不到未提交的 `0038`）。
> **故账本腿以「方法写入面等价」在**同事务内真跑**：以其**逐字同形的 `ledger_post_event($1::jsonb)` payload**（镜像 `database.ts:4744-4761`：`op='entries'`、`ref_type='job'`、`ref_id=jobId`、每条 entry 含 `uid/cid/delta/frozen_delta/kind/ref_type/ref_id/memo`、`request_fingerprint = sha256('invite.first_task|<job>|<worker>|<parent>|<perLeg>')`、键 `biz:invite:firsttask:<worker_uid>`）真跑。**同一 DB 函数、同一 payload 形状 ⇒ 非第二套写入面**。

**（A）账本腿真跑（事务内 `ledger_post_event`）**

| 用例 | 键 | 受益人（N） | 事件内分录读数 | `idempotent_replay` |
|---|---|---|---|---|
| S1 有上级 | `biz:invite:firsttask:990001` | 本人 `990001` + 直接上级 `990002`（N=2） | `-1` **−20** / `990001` **+10** / `990002` **+10**（`ref = job:9900002`；`event_root_key = biz:invite:firsttask:990001`；行数 `0 → 3`） | `false` |
| S2 重放 | 同 S1 同 payload | — | **零新增**（`3 → 3`） | **`true`** |
| S3 无上级 | `biz:invite:firsttask:990003` | 只本人 `990003`（N=1） | `-1` **−10** / `990003` **+10**（行数 `0 → 2`） | `false` |

⇒ ① `-1` 减 `−(perLeg × N)`（N=2 ⇒ **出 20$**；N=1 ⇒ **出 10$**）✅；② 每受益人 `+perLeg`（本人 + 直接上级各 **10$**）✅；③ 同键重放**零新增**✅；④ **无上级 ⇒ 只发本人、平台不吞**（N=1）✅；⑤ **平台 uid `-1` 走 `debit` 放行**（`R-9-66` 白名单内）✅。

**（B）负对照（白名单外 `-1` mutation ⇒ 必红 · 平衡事件以越过 `Σ=0` 闸）**

| 用例 | 分录（kind） | 现取 |
|---|---|---|
| N1 `-1` debit 非白名单（`job_fee`） | `-1:-10 / 990001:+10` | ✅ 红 `LD021 LEDGER_RESERVED_UID` / `reason = PLATFORM_DEBIT_FORBIDDEN` |
| N2 `-1` debit 白名单外（`trade_fee`） | `-1:-10 / 990001:+10` | ✅ 红 `LD021` / `PLATFORM_DEBIT_FORBIDDEN` |
| N3 `-1` credit 非白名单（`commission`） | `-1:+10 / 990001:-10` | ✅ 红 `LD021` / `PLATFORM_CREDIT_KIND_FORBIDDEN` |

**（C）方法级边界取证（`settleInviteFirstTaskReward` 真跑两次）**

| 调用面 | 现取 | 读断 |
|---|---|---|
| **事务内**调用（本事务已跑 `0038`，未提交） | ❌ `LEDGER_UNKNOWN_KIND`（`details = {kind:'invite_first_task_reward'}`） | **方法写连接不共享本事务** ⇒ 看不到未提交的 `0038` ⇒ 被 DB 23 值闭集拦 |
| **原生**（事务外）调用 | ❌ `LEDGER_UNKNOWN_KIND`（同上） | 方法读/解析腿（`job.worker_uid` / `referral.parent_uid`）真跑；**写腿被未 apply 的 DB kind 闸拦**（`LD023` · **零写入**） |
| 方法**成功面**返回（`outcome='posted'\|'replayed'`、`recipientUids`、`totalUsdFromPlatform`） | **`NOT_MEASURED`** | 见 §9 #6：需 (a) `0038` apply 或 (b) 给方法补 `ex` 注入（与 `grantSignupInviteBatt` 对齐）—— 二者均**不属本单**（本单**不 apply**、**不接线**、**只补自证**） |

**（D）零残渣（末尾 `ROLLBACK` 后表级读数）**

| 表 | before | after | 判 |
|---|---|---|---|
| `batt_account` | 2 | 2 | ✅ |
| `batt_entry` | 2 | 2 | ✅ |
| `ledger_entry` | 359 | 359 | ✅ |
| `account` | 39 | 39 | ✅ |
| `users` | 56 | 56 | ✅ |

⇒ `rollback_clean = true`（`before == after` 逐字）；`exec_err = null`（事务正体无错）。**另**：`precondition.{db_kind_ok_new=false, schema_version='0034'}` 坐实**未 apply**。

### 4.5 「首个」判定与幂等键形态（方案 · 已落码）

- **「首个」判定**：以 **`biz:invite:firsttask:<worker_uid>`** 为幂等键（只由**不可变** `worker_uid` 派生）——「首个」= **首个提交该键的结算动作**；同键重放 = `idempotent_replay`（`R106`：按成功处理、**不双发**）。**不新增「首任务」状态列 / 不查历史** ⇒ 幂等约束 + `ledger_entry` 唯一键即载体。
- **幂等键形态**：
  - 注册腿 = `biz:invite:signup:<uid>`（`batt_entry.idempotency_key` 唯一）；`prior` 在场 ⇒ 整条语句零副作用。
  - 首任务腿 = `biz:invite:firsttask:<worker_uid>`（`ledger_entry` 根键 `event_root_key`）；`request_fingerprint = sha256('invite.first_task|job|worker|parent|perLeg')`（同业务事实 ⇒ 同指纹 ⇒ 重放不退化成 409）。
- **受益人集合**：`referral.parent_uid`（`child_uid` 唯一 ⇒ **直接上级 = `depth = 1`**）；**无上级 / 上级=本人 ⇒ 只发本人**（`R-9-57`，平台不吞）。
- **写入面**：注册腿 = batt 面（零 kind）；首任务腿 = **唯一写入面 `ledger_post_event`**（经 `postEvent`）—— **不新造第二套写入面**（`commission.spec §19.0`）。

---

## 5. `R-9-65` / `R-9-66` · 首任务腿资金来源与 kind（★ 已终审）

> **裁定 `R-9-65`（Kong 预设 → 已终审）**：首任务 `10$` 两腿资金来源 = **`uid = −1`（平台收入账户）出账**；需求 §6.2②「邀请双方发放 10$ 积分」= 平台负责发放（与 §6.3「平台不抽成」**不冲突** —— 后者指**任务奖励分配**口径）。
> **裁定 `R-9-66`（Zang 终审）**：**准 `−1` debit 首开，但严格限定** —— 白名单**仅** `invite_first_task_reward` **一项**；白名单外 `−1` debit **仍必红**（`PLATFORM_DEBIT_FORBIDDEN`）；`R103` 的「运维提取」**留白不变**、**后台不得提供提取按钮**。

### 5.1 现取：`LEDGER_KINDS` **24** 值全表（`ledger.ts:168-177` · 本续跑单已扩）

`mint`, `burn`, `transfer`, `hold`, `hold_release`, `hold_forfeit`, `job_escrow`, `job_escrow_refund`, `job_payout`, `job_fee`, `commission`, `purchase`, `sale`, `purchase_refund`, `trade`, `trade_fee`, `listing_fee`, `listing_deposit`, `currency_create_fee`, `reversal`, `checkin_makeup_fee`, `bttc_mint_fee`, `bttc_burn_fee`, **`invite_first_task_reward`** ⇒ **恰 24**（末位追加，前 23 次序未动）。

### 5.2 现取：`PLATFORM_KIND_WHITELIST`（`ledger.ts:553-583` · 本续跑单已改）

| uid | credit | debit |
|---|---|---|
| `0` | `mint`, `transfer`, `reversal` | `transfer`, `burn`, `reversal` |
| `-1` | `trade_fee`, `listing_fee`, `currency_create_fee`, `job_fee`, `listing_deposit`, `checkin_makeup_fee`, `bttc_mint_fee`, `bttc_burn_fee` | **`['invite_first_task_reward']`**（★ **首次开 `debit`** · `R-9-66` 唯一例外） |
| `-2` | `job_fee` | `commission` |
| `-3` | `hold_forfeit` | `hold_forfeit`, `transfer` |

⇒ `-1` 现 **debit 恰 1 值**（`invite_first_task_reward`）；DB 侧逐格同步见 `0038` 的 `ledger_assert_platform_mutation`（§2.2 行为面已证 `-1` debit 白名单内放行 ⇄ 白名单外必红）。

### 5.3 现取：P9② 签到 `+30 batt` 的做法（不涉 kind）

`database.ts:4420-4439`：`batt_account`（`INSERT … ON CONFLICT (uid) DO UPDATE`）+ `batt_entry`（幂等键）—— **batt 面零 kind**（batt 不入 `ledger_entry`）⇒ **注册 30 batt 腿无需任何 kind**（本单 G1–G5 已证）。

### 5.4 结论与代价

**现取比对（逐值）**：`-1`（平台收入）**原无任何 `debit` kind**；全 23 值中**无**「平台收入账户出账 / 平台发放一次性奖励」语义的 kind —— `job_fee`（入池，`-2` credit）、`commission`（池出账，`-2` debit ← 受益人）、`job_payout`（雇主冻结 → 打工人）、`transfer`（`R101` 禁平台账户用）、`mint`（币 owner 铸币）**均不符**（语义 + 白名单双不符）⇒ 按 `R-9-65`/`R-9-66` **新增 `invite_first_task_reward`（23 → 24）**。

**方案（沿 `R-9-14` 先例 · `0028` / `0032` 逐字手法）**：① **kind 闭集 23 → 24**（三处同集：DB CHECK + `ledger_kind_ok` + TS `LEDGER_KINDS`）；② **`−1` 白名单 `debit` +1**（TS `PLATFORM_KIND_WHITELIST['-1'].debit` + DB `ledger_assert_platform_mutation`）；③ **`0038_kind_close_set_24.sql`**（已建 · **不 apply** · 自带 `R-9-24` 真跑自证，见 §2.2）。

**代价 / 风险（逐条）**：
- ⚠️ **`−1` `debit` 首开**破 `R103`「只进不出」的强不变式 ⇒ **已由 `R-9-66` 严格限定**（白名单仅 1 项；白名单外必红；运维提取留白）。
- ⚠️ **`−1` 余额须足够**（出账 `−(perLeg × N)$`；余额不足 ⇒ 余额闸拒，奖励 fail-soft 丢失、下次结算重试）。现取 `-1` 余额 = `167483`。
- ⚠️ **三处编码必须同集**（DB CHECK / `ledger_kind_ok` / TS `LEDGER_KINDS`；任一处漏 ⇒ DB 与 TS 分叉）—— 本单 §2.2 证 DB 两处同集、§4.4 证写路径放行。
- ⚠️ `ledger.spec §5.1 / R40` 要求「新增 kind 必须走 migration + 回写 spec §5.1 登记」⇒ **规范册回写不属本单**（`docs/*.spec.md` 禁改；归**规范回写单**）。

---

## 6. `index.ts` / 接线点登记（`route-layer.spec §31`）

> **结论**：**注册腿已接线**（上单落码，现取确认）；**首任务腿未接线**（本单**不做接线**）。

### 6.1 注册腿（**已接线** · 现取）

| 段 | 现取 | 读数 |
|---|---|---|
| HTTP 注册路由 | `index.ts:433` | `POST /api/auth/verify`（钱包签名登录即注册）；旧 `POST /api/auth/register` ⇒ **410 弃用**（`index.ts:420`） |
| 业务入口 | `index.ts:456` → `database.ts:2129` | `DatabaseService.findOrCreateUserByEvm(evm)` |
| 「仅首次」载体 | `database.ts:2133-2143` | `if (!user) { user = await this.createUserByEvm(...) }` ⇒ 该分支**仅新用户命中** |
| 奖励调用点 | `database.ts:2140` | `await this.grantSignupInviteBatt(user.uID).catch(…)` ⇒ **注册腿已接入**（失败不阻断注册、记 `console.warn` · `§4.3` 诚实边界） |

### 6.2 首任务腿（**未接线** · 接线点登记）

| 项 | 现取 | 读数 |
|---|---|---|
| 结算 HTTP 路由 | `index.ts:2398` | `POST /api/job/:jobId/review`（`approved !== false` ⇒ `settleJob`） |
| 结算业务入口 | `job-funds-service.ts:218-235` | `settleJob` → `dispatchJobEvent` |
| 原子结算落点 | `database.ts:3349-3381` | `DatabaseService.reviewJobSubmission`（`job_post_event(op='settle')` + 结论位**同一语句** · `R4` 原子） |
| **首任务奖励接线点（应落未落）** | — | 应在 `reviewJobSubmission` 结算成功后（或 `settleJob` 成功分支）调 `settleInviteFirstTaskReward({ jobIdRaw })` —— **本单未接** |
| **未接线原因** | — | ① 本单硬边界「**只补自证与回填，不做接线**」；② `0038` **未 apply** ⇒ 接线亦**不可跑通**（写必被 DB 23 值闭集拦，§4.4-C 已证）；③ 接线点语义（幂等键 / 失败容错 / 是否与结算同事务）归**实现单**裁定 |

> 归口：首任务腿接线 = **独立「实现 / 接线」单**（`route-layer §31.7` 真生效四段）；本报告仅**登记**，不落码。

---

## 7. `scripts/p2w-00-p2fix-verify.ts` `SettlementPlan` 字段同步

> `SettlementPlan` 本续跑单新增 4 **必填**字段（`down_depth` / `down_truncated` / `roster_size` / `truncation`，`commission.ts:750-758`）⇒ 该脚本内**手工组装的「修前形态」`SettlementPlan`** 需同步，否则 `tsc` 报缺字段。

| 项 | 现取 | 读数 |
|---|---|---|
| 新增 import | `p2w-00-p2fix-verify.ts:62` | `COMMISSION_CAP_LAYER_DEFAULT`, `COMMISSION_CAP_TOTAL_DEFAULT`（`from '../src/commission'`） |
| 补 4 字段 | `p2w-00-p2fix-verify.ts:310-314` | `down_depth: 0`、`down_truncated: false`、`roster_size: M`、`truncation: { cap_layer: COMMISSION_CAP_LAYER_DEFAULT, cap_total: COMMISSION_CAP_TOTAL_DEFAULT, dropped_total: 0, dropped_by_layer: {}, truncated: false }` |
| 语义 | — | 判负对照 = 「修前形态」：下行 / 名单 / 截断在旧形态下**均不存在** ⇒ 显式**占位**（`0` / `false` / 空截断），不改该对照的判负语义 |
| `tsc -p tsconfig.json --noEmit` | — | **0**（本续跑单已验） |
| 改版后复绿 | — | **不属本单**（门改版归 P9⑤ 实现单 · `R-9-59`）⇒ 见 §9 #5 |

---

## 8. 软 / 硬边界（本单）

| # | 边界 | 遵守情况 |
|---|---|---|
| 1 | **不 apply 任何迁移** | 遵守 —— `0035`–`0038` 仅真跑（事务 + `ROLLBACK`）；`schema_version` 仍 `0034` |
| 2 | 不改已 apply 迁移文件（`0001`–`0034`）**字节** | 遵守（沿 `R-9-49`） |
| 3 | 错误码闭集 **33 不动**；`R107` 错误形状统一 | 遵守（`0038` 不增删码；负对照读 `LD021` 既有码） |
| 4 | 不碰 `docs/*.spec.md` / `docs/seafood.master-plan.md` / `docs/qa/**` | 遵守（只写 `docs/audit/p9-s5-invite-reward.md`） |
| 5 | **不 `git add/commit/push`**；不 `npm install` | 遵守 |
| 6 | 不碰 / 不打印 `.env*`；禁 `pkill -f` / `killall`；不启停 `5787`/`5788` | 遵守 |
| 7 | 库面写一律**事务内 + 末尾 `ROLLBACK`** | 遵守（`0038` 探针 + 两腿探针均单事务 + `ROLLBACK`；残渣表级零） |
| 8 | **严禁 UPDATE `app_config`**（策略键事务内 `INSERT`） | 遵守（G5 仅 `INSERT`） |
| 9 | 探针**不入 `backend-ts/scripts/`**（放 `backend-ts/.p9s5-impl/`）；原始输出不用 `.log` 后缀 | 遵守（`.p9s5-impl/*.ts`；输出 `*.json`） |
| 10 | **不做接线**（本单只补自证与回填） | 遵守（§6.2 仅登记接线点） |

---

## 9. `NOT_MEASURED` 清单（禁填 0 / 空）

| # | 未测项 | 原因（禁填 0 / 空） |
|---|---|---|
| 1 | 三迁移 + `0038` **apply 后**政策行生效 / DB 断言新分支**真库**读数 | **未 apply** ⇒ 政策行未生效、`0038` 的 kind 闭集 / `-1` debit 白名单 / 断言分支未在活体生效 ⇒ `NOT_MEASURED`（归 apply 单） |
| 2 | `invite_reward_policy` **落行**读数 | `app_config` 现仅 `system_settings` 一 key（活体 1 行，未落策略行）⇒ 走代码面兜底（`source='constant'`）⇒ `NOT_MEASURED`（本单 G5 以事务内 `INSERT` 证 config 源，但**未落活体**） |
| 3 | 真生效四段（后台写 / 库内落值 / 业务读口 / 行为随之）HTTP 实跑 | 归实现单 + 质检单（`route-layer §31.7`）⇒ `NOT_MEASURED`（本单未启停 `5787`/`5788`） |
| 4 | 首任务腿在**真实结算动作**（`reviewJobSubmission`）下的端到端触发读数 | ① 首任务腿**未接线**（§6.2）；② `0038` 未 apply ⇒ 端到端不可跑通 ⇒ `NOT_MEASURED`（归实现 / 接线单） |
| 5 | `p8-s2-fee-rebate-gate.ts` 改版后复绿 | 门改版归 P9⑤ 实现单（`R-9-59`）；**本单未改门** ⇒ `NOT_MEASURED` |
| 6 | `settleInviteFirstTaskReward` 的**方法级成功面**返回（`outcome='posted'\|'replayed'`、`recipientUids`、`totalUsdFromPlatform`） | 方法**不接收 `ex`** ⇒ 写路径 `postEvent` 走**自有连接**（`ledger.ts:1040-1057`），**不参与调用方事务**；未 apply `0038` ⇒ 其连接看不到未提交的 kind 闭集 ⇒ 事务内/原生调用皆 `LEDGER_UNKNOWN_KIND`（§4.4-C 已证）。要方法级成功面需 **(a)** `0038` apply，或 **(b)** 给方法补 `ex` 注入（与 `grantSignupInviteBatt` 对齐）—— 均**不属本单**（不 apply / 不接线 / 只补自证）⇒ `NOT_MEASURED`。**账本腿**已以方法写入面等价 payload 在同事务内真跑（§4.4-A/B，含负对照） |
| 7 | `−1` 余额不足时的 fail-soft 路径（奖励丢失 → 下次结算重试） | 需构造 `−1` 余额 < `perLeg×N` 的活体态；本单未改 `−1` 余额、未测该分支 ⇒ `NOT_MEASURED`（归实现 / 质检单） |

---

## 10. 本单自证（行数 / 字节 / 占位归零）

| 项 | 现取方式 | 读数 |
|---|---|---|
| 报告行数 / 字节 | `wc -l -c` | **337 行 / 34,273 B** |
| 遗留占位标记（四字母占位词） | 全文搜索 | **0 命中** |
| 连续双下划线（两枚 `_`） | 全文搜索 | **0 命中** |
| 探针产物（`.p9s5-impl/`） | `ls -1` | `p9s5-ro-survey.ts`（只读侦察）；`r9-24-0038-realrun.ts` → `r9-24-0038-20261003T081606Z.json`；`p9s5-impl-realrun.ts` → `p9s5-impl-realrun-20261003T082015Z.json`；另 `p9s5-survey-20261003T081451Z.json` |
| 原始输出后缀 | — | 全部 `.json`（**无 `.log`**） |

---

## 11. P9⑤ 最后收尾（接线点 + 四段真链路 + 判负 `NC1`/`NC2` + 新门 `p8-s10` + 硬门全量）

> ★ **本节为追加**（§0–§10 逐字未改写）。自证：追加**前**本文件 = `ed67b3d8107ac1bb5893796ae750286c` / **34,273 B** / **337 行**；追加**后**取**前 34,273 B** 前缀 md5 = 同上（对拍见 §11.7）。
> 本单 = **P9⑤ 最后收尾单**（Kong）。仓库 `/Users/kevin/bistro/seafood`（**不 commit / 不 push**）。锚 `git log -1` = `7c614c1`。
> **不 apply / 不重 apply**（迁移已 apply：`schema_version` **0038** / `schema_migration` **37 行** / 基础表 **34**）。
> 硬边界沿 §8：只写本文件；库面写一律**事务内 + 末尾 `ROLLBACK`**；受控实例仅 **5796/5797**。

### 11.1 首任务腿接线点（现取 · 已接线）

| 段 | 现取 | 读数 |
|---|---|---|
| 接线函数 | `job-funds-service.ts:271-280` | `settleFirstTaskRewardBestEffort(payload, ex)` |
| **触发闸** | `job-funds-service.ts:275` | `if (payload.op !== 'settle') return;` ⇒ **仅结算 `op='settle'` 才发**（其它 op 直接返回） |
| 写入调用 + 失败不阻断 | `job-funds-service.ts:276-279` | `DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: payload.job_id }, ex).catch(e => console.warn('[P9⑤] invite first-task reward skipped:', …))` ⇒ **奖励为尽力而为的后续事件，失败不阻断结算** |
| 调用点①（无 reviewer 分支） | `job-funds-service.ts:296-297` | `jobPostEvent(payload, ex)` 后即调 `settleFirstTaskRewardBestEffort(payload, ex)` |
| 调用点②（reviewer 分支） | `job-funds-service.ts:311-312` | `reviewJobSubmission(...)` 成功后调 `settleFirstTaskRewardBestEffort(payload, ex)`（在 `return` 前） |
| `ex` 透传 | `job-funds-service.ts:273` | 生产默认 `undefined` ⇒ 各走自有连接；探针/接线后同事务注入 `ex` ⇒ 可同事务触发（`R-9-68`） |

> 注册腿接线点（`database.ts:2140` · `findOrCreateUserByEvm` 新户分支 → `grantSignupInviteBatt` · `.catch`）见 §6.1，本单未改。

### 11.2 `C-14` 四段真链路逐段读数（★ 本单真跑）

> 探针 `backend-ts/.p9s5-impl/c14-realchain.ts`（**不入 `scripts/`**）；原始输出 `backend-ts/.p9s5-final/c14-realchain-*.json`。
> 手法：**单事务内 + 末尾 `ROLLBACK`**（禁 `COMMIT`）；`ex` 注入同一事务。**前置**：`schema_version=0038` · `db_kind_ok('invite_first_task_reward')=true` · `commission_policy` **4 行**。

**表级零残渣（事务前 ⇄ 后，逐字相等）**：`batt_account 2/2` · `batt_entry 2/2` · `ledger_entry 359/359` · `account 39/39` · `users 56/56` ⇒ `rollback_clean = true` · `exec_err = null`。

| 段 | 链路 | 现取读数 |
|---|---|---|
| **①注册真路径** | `findOrCreateUserByEvm`（建户分支）→ `grantSignupInviteBatt` | 新 uid `971214`：`+30 batt`（`batt_entry` 1 行 · `delta=30 · batt_after=30 · reason=invite_signup · key=biz:invite:signup:971214`）；**二次调用同 uid** ⇒ 建户分支不命中（`batt=30` / 行数仍 **1**）；奖励腿重放 ⇒ `outcome=replayed` / 行数 **1**（零新增） |
| **②首任务腿（方法级 · `ex` 注入）** | `settleInviteFirstTaskReward({jobIdRaw}, tx)` | `N2`（990001 有直接上级 990002）：`outcome=posted` · `recipients=[990001,990002]` · `totalUsdFromPlatform=20` · 分录 `-1:-20 / 990001:+10 / 990002:+10`（`ref=job:76`）；**重放** ⇒ `replayed` `3→3`（零新增）；`N1`（990003 无上级）：`posted` · `[990003]` · `10` · 分录 `-1:-10 / 990003:+10`（**平台不吞**） |
| **③接线后经结算路径** ★ | `settleJob({jobIdRaw,reviewerUid}, tx)` → `dispatchJobEvent` → `settleFirstTaskRewardBestEffort(payload, ex)` | job `78`：`settle ok=true` · `job_status=settled` · `settle_txid=1076`；奖励事件**随结算落地**：`reward_rows 0→3`（`-1:-20 / 990004:+10 / 990005:+10` · `ref=job:78` · `event_root_key=biz:invite:firsttask:990004`）；**结算重放** ⇒ `replay` `3→3`（奖励**零新增**） |
| **④负对照** | 白名单外 `-1` mutation（平衡事件越过 `Σ=0` 闸） | `-1` debit 非白名单（`job_fee`）⇒ 红 `LD021` / `LEDGER_RESERVED_UID` / `PLATFORM_DEBIT_FORBIDDEN`；`-1` credit 新 kind（`invite_first_task_reward`）⇒ 红 `LD021` / `PLATFORM_CREDIT_KIND_FORBIDDEN`（credit 八格**未被顺带放宽**） |

⇒ 读断：注册腿 +30 生效且幂等 √；首任务腿双方 `+10`（`-1` 出 `−(perLeg×N)`）√；**段③经真实结算路径触达**（非绕过 `settleJob`）√；同键重放零新增 √；白名单外必红 √；零残渣 √。

### 11.3 库面判负 `NC1` / `NC2`（★ 本单真跑 · 仓外副本 + 复原 + `cmp`）

> 探针 `backend-ts/.p9s5-impl/negctl-db.ts`（不入 `scripts/`）；原始输出 `backend-ts/.p9s5-final/negctl-db.out`。主仓文件**只读**。
> 主仓 `0038` 指纹：`md5=e85d9e49394d98560dc318e1166d11c26e094330464825499d3db48aa64b36fd` / **15,993 B**。

| 判负 | 手法（仓外副本） | 变异后读数（必红） | 复原读数（回绿） |
|---|---|---|---|
| **`NC1`** 去 `-1` debit 白名单 | 副本 `0038`：`ELSE p_kind IN ('invite_first_task_reward') END` → `ELSE false END`（1 处）+ 去自检正例（1 处）；`mut_md5=e3811f5ec411d22f192e7e4800fe53f26e8b0e9cd2bf7056c322f2c48b9c8249` ≠ 主仓 | `ledger_assert_platform_mutation(-1,'invite_first_task_reward','debit')` ⇒ 红 `LD021` / `LEDGER_RESERVED_UID` / `PLATFORM_DEBIT_FORBIDDEN`（`exec_err=null`） | 跑主仓 `0038` ⇒ `ok=true`（放行回绿） |
| **`NC2`** 去幂等键（双发闸） | 同业务事实**同键** vs **换键** | 同键首发 `replay=false`/`rows=3`；**同键重放** `replay=true`/`rows=3`（零新增）；**换键** `replay=false`/`rows=6` ⇒ `double_issue_when_key_changes=true` | —— |

**主仓零写入 `cmp`**：`repo_unchanged_after_all=true` · `restore_copy_equals_repo=true` · `mutated_differs_from_repo=true` ⇒ 变异/复原均在**仓外副本**，主仓字节零改动 √。

### 11.4 新门 `p8-s10-invite-reward-gate.ts` 读数（★ 本单修 2 处 ⇒ 全绿）

> 门文件 `backend-ts/scripts/p8-s10-invite-reward-gate.ts`（A–H 静态面零 DB/网络 + K 库面/HTTP leg）。

**修法登记（2 处 · 均为「夹具/口径」修正，非弱化判据）**：

| # | 落点 | 修前 ⇒ 修后 | 依据 |
|---|---|---|---|
| 1 | K 段 6 处 `referral_bind` 夹具（`:352-357`） | 参数序传反 ⇒ 改为**签名语义 `(child_uid, parent_uid)`**；**且**绑定顺序须**自上而下 / 由根向外**：上行 **U3→U2→U1**、下行 **D1→D2→D3** | ★ 诊断坐实：DB `referral_bind` 强制协议 **`BIND_PARENT_BEFORE_DESCENDANTS`** —— child **已有后代**时不得再绑其父（否则抛 `LD016` / `reason=REFERRAL_BIND_WOULD_STALE_DEPTH`）；故**仅对调参数序不足**，须同时按拓扑序绑定。**K6 判据 `M=6` / Σ / 距离加权原样未动** |
| 2 | K8 HTTP 腿 token（`:435`） | `createSessionToken({uID:9600001})`（事务内**未提交**夹具 uid）⇒ `createSessionToken({uID:11})`（活体既有用户） | `requireActor` 按 token uid **查库解析** ⇒ 未提交夹具 uid 解析失败 ⇒ `401`；取活体 uid（与 `p8-s8` 同锚） |

**带受控实例读数**（`P8S10_BASE=http://127.0.0.1:5797`）：

| 项 | 读数 |
|---|---|
| 汇总 | **`total=49 passed=49 failed=0`** · `pending_apply=0` · `db=3` · `http=3` · **exit 0** |
| `K1`/`K2` 结构面 | 活体 `ledger_kind_enum` = **24**（含 `invite_first_task_reward`）· `schema_migration` = **37** / `max=0038` |
| `K3` 注册腿 | 新户 `granted` `+30`（1 行）· 同键重放 `replayed` 零新增 |
| `K4` 首任务腿 | `posted` · `recipients=[9600001,9600002]` · `perLegUsd=10` · `totalUsdFromPlatform=20` · 分录 `-1:-20 / 9600001:+10 / 9600002:+10` · 重放 `replayed` 零新增 |
| `K5` 白名单判负 | 白名单外 `-1` debit ⇒ 红 `LD021`/`LEDGER_RESERVED_UID`/`PLATFORM_DEBIT_FORBIDDEN`；白名单内 `invite_first_task_reward` ⇒ 放行 |
| `K6` 结算计划（`M=6`） | `M=6` · `fee=10000`（policy 34 `fee_rate_bp=1000`）· `Σ layers x == fee` · 距离加权 `U1>U2>U3`（`2600/1700/700`）· `fee_credit_uid=-2` |
| `K7` `M=0` 兜底 | `M=0` · `no_referrer=true` · `fee_credit_uid="-1"` · `layers=0` |
| `K8` 真 HTTP | `GET /api/role-names` ⇒ **200** · `GET /api/batt` 无 token ⇒ **401** ⇄ 有 token ⇒ **200** |

> 产物：带实例 `.p8s10-artifacts/p8s10-20261003T084918Z/gate.json`（49/49）· 离线 `.p8s10-artifacts/p8s10-20261003T085046Z/gate.json`（48/49，红 `K8` HTTP 类）。

### 11.5 硬门全量 + 双读数（退出码**管道外捕获**）

| 门 | 读数 | 退出码 |
|---|---|---|
| `tsc -p tsconfig.json --noEmit` | **0 行**（无诊断） | `0` |
| 前端 `npm run build` | `index-Dhi94bbn.js` 399.50 kB | `0` |
| 前端 `npm run test:unit` | **31 files / 276 passed** | `0` |
| 离线套件 `p4z-tr1a-01-offline-tests.ts` | **126/126** | `0` |
| `p8-s1` … `p8-s6`（离线） | **24 / 41 / 45 / 38 / 79 / 117 / 64** 全绿 | 全 `0` |
| `p8-s7` 带实例 ⇄ 离线 | **59/59** ⇄ **59/56/3**（红 `G8/G9/G10` = HTTP 类） | `0` ⇄ `1` |
| `p8-s8` 带实例 ⇄ 离线 | **92/92** ⇄ **92/89/3**（红 `H5/H6/H7` = HTTP 类） | `0` ⇄ `1` |
| `p8-s9` 带实例 ⇄ 离线 | **100/100** ⇄ **100/100/0**（无 HTTP leg） | `0` ⇄ `0` |
| `p8-s10` 带实例 ⇄ 离线 | **49/49** ⇄ **49/48/1**（红 `K8` = HTTP 类） | `0` ⇄ `1` |
| 注册点（逐 verb） | **87** = `get 36 / post 48 / put 0 / patch 1 / delete 2` | — |

> **离线双读数登记（沿 `R-9-26`）**：`p8-s7/s8/s9/s10` 的 HTTP leg 需**受控实例在场**；实例**不在场**时该 leg 逐条转红（`fetch failed`），**均为 HTTP 类、非判据缺陷** —— 上表「离线」列即为其登记值（`R-9-26` 运行前置）。
> **注册点独立复核**：`grep -nE "^[ \t]*app\.(get|post|put|patch|delete)\(" src/index.ts` = **87**；唯一近似命中 `src/index.ts:790`（JSDoc 注释行 `* 置位说明：… app.get('/api/user/ledger' …`）**不匹配**行首形 ⇒ **已被排除**（注释行不计数）。

### 11.6 未测项更新（对 §9 的订正 · 禁填 0/空）

| 原 §9 # | 原状态 | 本单更新 |
|---|---|---|
| #1 三迁移 + `0038` **apply 后**政策行 / DB 断言新分支**真库**读数 | `NOT_MEASURED` | **已消除**：迁移已 apply（`schema_version 0038` / 迁移 37）；政策行 **4 行**生效；kind 闭集 / `-1` debit 白名单 / 断言分支均**活体生效**（`p8-s10 K1/K2/K5` + `NC1`） |
| #2 `invite_reward_policy` **落行**读数 | `NOT_MEASURED` | 仍 `NOT_MEASURED`：`app_config` 未落策略行 ⇒ 走常量兜底（`source='constant'`）；本单 K3/K4 读数即 `constant` 源 |
| #3 真生效四段 HTTP 实跑 | `NOT_MEASURED` | **部分消除**：**段③经结算路径**已在**事务内**（`ex` 注入）真跑（§11.2）；**HTTP 端到端**（后台写 → 实例 → 业务读口）未跑（未启停 `5787`/`5788`）⇒ 仍 `NOT_MEASURED` |
| #4 首任务腿在**真实结算动作**下的端到端触发 | `NOT_MEASURED` | **已消除**：首任务腿**已接线**（§11.1）；`settleJob` 路径真跑见 §11.2 段③ |
| #5 `p8-s2` 改版后复绿 | `NOT_MEASURED` | **已消除**：`p8-s2` = **41/41** 绿（离线） |
| #6 `settleInviteFirstTaskReward` **方法级成功面**返回 | `NOT_MEASURED` | **已消除**：方法补 `ex` 注入（`R-9-68`）后返回 `outcome=posted\|replayed` · `recipientUids` · `totalUsdFromPlatform` · `perLegUsd`（§11.2 段② / §11.4 `K4`） |
| #7 `-1` 余额不足时的 fail-soft 路径 | `NOT_MEASURED` | 仍 `NOT_MEASURED`：未构造 `-1` 余额 < `perLeg×N` 的活体态 |

> **新增未测项**：① **生产 HTTP 端到端**（真实实例 `5787`/`5788` + 后台写 → 读口）—— 本单受控实例仅 `5796/5797`，且不启停 `5787/5788` ⇒ `NOT_MEASURED`；② `-1` 余额不足 fail-soft（同 #7）。

### 11.7 本单自证（追加完整性）

| 项 | 现取方式 | 读数 |
|---|---|---|
| 追加**前**全文 md5 / 字节 / 行 | `md5 -q` / `wc -c` / `wc -l` | `ed67b3d8107ac1bb5893796ae750286c` / **34,273 B** / **337 行** |
| 追加**后**取**前 34,273 B** 前缀 md5 | `head -c 34273 … \| md5 -q` | **同上** ⇒ §0–§10 逐字未改写 |
| 追加**后**全文行数 / 字节 | `wc -l` / `wc -c` | **455 行 / 47,052 B**（新增 §11 = 118 行） |

> 原始输出（本单）：`tsc.out` · `fe-build.out` · `fe-unit.out` · `offline-126.out` · `c14-realchain*.json` · `negctl-db.out` · `inst-p8-s7/8/9/10.out` · `off-p8-s7/8/9/10.out` · `off-p8-s1..s6.out`（均在 `backend-ts/.p9s5-final/`，后缀 `.out` / `.json`，**无 `.log`**）。
