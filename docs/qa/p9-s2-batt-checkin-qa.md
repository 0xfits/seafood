# P9② 终审质检（Neng · 被检面 `4c40b47`）· batt 电量 + 签到 / 补签

- **被检面（钉死）**：`4c40b47d1cf6ecfcdc75c0ca1a1162a7af70497d`（本地未推）
- **质检方**：Neng（独立重取；不采信交付方 / 派单方转引；探针 / 夹具自写）
- **固定副本**：`git worktree add --detach <scratch>/qaP9s2 4c40b47` + 软链 node_modules（前后端）+ `.env.local`；收尾 `worktree remove --force`
- **硬约束**：库面写一律事务内 + 末尾 `ROLLBACK`；严禁 UPDATE `app_config`（策略键事务内 INSERT）；严禁 apply 迁移；仅写 `docs/qa/**` 与本单产物；不 `git add/commit/push`；不 `npm install`；不碰 / 不打印 `.env*`；禁 `pkill -f`/`killall`；不启停 `5787`/`5788`；探针不得放进 `backend-ts/scripts/`；原始输出不用 `.log` 后缀。

---

## 0. 开工锚（现取）

- **本单 `git log -1` 现取**：`ab5cc148feb6e6c30feae9e45e0cb31e057f923c`（= HEAD）
- **被检面钉**：`4c40b47d1cf6ecfcdc75c0ca1a1162a7af70497d`
- **祖先核**：`git merge-base --is-ancestor 4c40b47 HEAD` ⇒ **真（exit 0）** ⇒ pin 仍在 `main` 历史。
- **漂移登记**：`4c40b47..HEAD` = **2 提交**（`f447d04` · `ab5cc14`）；`git diff --stat 4c40b47 HEAD` = **仅 `docs/seafood.master-plan.md`（+48 行）**；**无** `backend-ts/**` 代码 / 迁移 / 报告 / 前端漂移 ⇒ **pin 仍是被检面**，本单以 pin 为准。
- **`git status --porcelain` 首读数**：**1 `M` + 126 `??` = 127 行**；逐条归因见 §10。
- **被检面 4 件冻结件核（`git show --stat 4c40b47` + `git cat-file -e` 现取）**：
  - `docs/versions/data-layer.spec.v0.20.md` ⇒ **在场**（blob `20b60ca51ecaa3b03fd4289258c84b42704eeda4`）
  - `docs/audit/data-layer-v0.20-delta.md` ⇒ **在场**（blob `7a1b586b68d6e4f04ac57a4ab4ec8ae1d29a0b0f`）
  - `docs/versions/route-layer.spec.v2.13.md` ⇒ **在场**（blob `c4a09bf07a6f76d68bc0d5696f22369edd1aad31`）
  - `docs/audit/route-layer-v2.13-delta.md` ⇒ **在场**（blob `f7a0c0300cc5ff98d28ceb0198f28f4f94212059`）
  - ⇒ **4 件冻结件全含于 `4c40b47`**（与提交信息「冻结件 v0.20/v2.13 快照与 delta 补入库」一致）。

---

## 1. L0 现取：四新表 / 约束 / 索引 / 触发器 · kind 闭集 · 白名单

> 手法：本单自写只读探针 `backend-ts/.p9s2qa-closeout/l0-schema.ts`（连生产库只读）。产物 `l0-schema.out`。

### 1.1 四新表列集（活体 · 逐字）

| 表 | 列集（`information_schema.columns`，按序） |
|---|---|
| `batt_account` | `uid, batt, time_created, time_updated` |
| `batt_entry` | `txid, uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo, time_created` |
| `checkin_log` | `log_id, uid, checkin_day, streak_day, reward_batt, time_created` |
| `checkin_makeup_log` | `log_id, uid, makeup_day, target_day, cost_usd, restored_streak_day, cid, result, txid, idempotency_key, request_fingerprint, memo, time_created` |

### 1.2 约束 / 索引 / 触发器（活体）

- **关键 CHECK（逐字）**：`batt_account_range = CHECK ((batt >= 0) AND (batt <= 100))` · `batt_entry_after_guard = CHECK ((batt_after >= 0) AND (batt_after <= 100))` · `batt_entry_move_guard = CHECK (delta <> 0)` · `checkin_log_streak_rng = CHECK ((streak_day >= 1) AND (streak_day <= 7))` · `checkin_log_reward_ck = CHECK (reward_batt > 0)` · `checkin_makeup_log_result_ck = CHECK (result = ANY (ARRAY['applied','rejected_daily_limit','rejected_insufficient_balance','rejected_target_invalid']))`。
- **UNIQUE**：`batt_entry_idem_uniq (idempotency_key)` · `checkin_log_day_uniq (uid, checkin_day)` · `checkin_makeup_log_day_uniq (uid, makeup_day)` · `checkin_makeup_log_idem_uniq (idempotency_key, result)`。
- **FK**：四表 `uid → users(uid)`；`checkin_makeup_log.cid → currency(cid)`。
- **具名索引 3 枚（活体）**：`idx_batt_entry_uid_time` · `idx_checkin_log_uid_day` · `idx_checkin_makeup_log_uid_day`。
- **触发器 4 枚（活体定义逐字）**：`trg_batt_account_touch_updated`（`BEFORE UPDATE` · `batt_account_touch_updated()`）+ 三表各一枚 `BEFORE DELETE OR UPDATE` append-only（`trg_batt_entry_append_only` / `trg_checkin_log_append_only` / `trg_checkin_makeup_log_append_only`）⇒ **恰 1 touch + 3 append-only**。

### 1.3 `ledger_kind_enum`（活体）

- 值数 = **21**；**末位 = `checkin_makeup_fee`**（`has_new = true`）；前 20 值与冻结集逐字一致（`mint…reversal`）。

### 1.4 `ledger_kind_ok` / 1.5 `ledger_assert_platform_mutation`（活体）

- `ledger_kind_ok`（`pronargs=2`）：`position('checkin_makeup_fee' in prosrc) > 0` ⇒ **true**，`src_len = 410`。
- `ledger_assert_platform_mutation`：`checkin_makeup_fee` ⇒ **true**（`−1` credit 白名单含新值）。
- **盘面**：`schema_migration` `max = 0029` / **28 行**；`public` BASE TABLE = **32**；`to_regclass` 四表全非空。

---

## 2. L2 四段真链路独立重取（自写探针 + 反向判负）

> 手法：本单自写 `backend-ts/.p9s2qa-closeout/l2-realchain.ts`（`withTransaction` 内 + 哨兵 `ROLLBACK`；夹具自选「无 batt/checkin/makeup 行的干净用户」）。产物 `l2-realchain-<RUN>.json`。
> **读数：`total=13 passed=13 failed=0`（EXIT 0）**；四段全部单事务内真跑、末尾 `ROLLBACK`（生产零净写）。

| # | 段 | 逐字读数 |
|---|---|---|
| `L2-A1` | 首签 | `inserted` · `streakDay=1` · `rewardBatt=30` · `batt=30` |
| `L2-A2` | 幂等 | 同键重放 / 同日异键 ⇒ 均 `replayed`（服务层拒，不新增行） |
| `L2-A3` | 第 7 天 | 前 6 日 streak=6 ⇒ `inserted` · `streakDay=7` · `rewardBatt=60` · `batt=60` |
| `L2-A4` | 封顶丢弃 | `batt=90` 签到 ⇒ `rewardBatt=30` · `creditedBatt=10` · `batt=100` |
| `L2-B1` | 补签 applied | `applied` · `costUsd=100` · 回执 `txid ≠ null` |
| `L2-B2` | 账本腿 | `uid=-1` `delta=100` · `kind=checkin_makeup_fee` · `cid=1`（不真 burn） |
| `L2-B3` | 对称扣 + 不 burn | 补签者 `delta=-100` 同 kind；`currency(1).total_supply: 2200276 → 2200276`（不变） |
| `L2-B4` | 不补发 | `batt_entry` 行数 / `batt_account.batt` 前后不变 |
| `L2-B5` | 幂等 / 日限 | 同键重放 ⇒ `replayed`；同日异键第二笔 ⇒ `rejected_daily_limit` |
| `L2-C1` | 前置拦（落点 A） | `batt=0 < 9` ⇒ `batt_below_threshold`；`batt=9` ⇒ `applied` |
| `L2-C2` | 二次判（落点 B） | 报名后耗到 `batt=5 < 9` ⇒ `accept` 拒（`batt_below_threshold`）+ 整体回滚：`job` 仍 `open` · `batt` 仍 `5` |
| `L2-C3` | 正常扣费 | `accepted` · `workerBattAfter=0` · `batt_entry` `delta=-9` · `reason=task_cost` |
| `L2-D1` | 日界 | SQL `(now() AT TIME ZONE 'UTC')::date = 2026-10-03` == node `toISOString` |

### 2.1 ★「无行 ⇒ NULL」负对照（`C-15`）

> 手法：自写 `backend-ts/.p9s2qa-closeout/c15-norow.ts`（对**无 `batt_account` 行**的 uid 取两种形态）。产物 `c15-norow.out`。

| 形态 | 表达式 | 读数 | 判读 |
|---|---|---|---|
| **内层（缺陷形）** | `(SELECT COALESCE(b.batt,0) FROM batt_account b WHERE b.uid=… )` | **`null`** | `COALESCE` 在标量子查询**内部**只兜列值 NULL，**不兜「无行」** ⇒ 整子查询 `null` |
| **外层（正解形）** | `COALESCE((SELECT b.batt FROM batt_account b WHERE b.uid=… ),0)` | **`0`** | 外层 `COALESCE` 兜「无行」 |
| 派生比较·内层 | `(<内层>) < 9` | **`null`** | `NULL < 9 = NULL`（非 TRUE）⇒ 判决落 `ELSE` |
| 派生比较·外层 | `(<外层>) < 9` | **`true`** | 正解 |

⇒ **`C-15` 负对照成立**：坐实 `C1` 根因（代码形态 A 读到错值 `NULL`）。

---

## 3. L3 同族自判：`COALESCE` 包在标量子查询内

> 手法：静态扫面被检面 `backend-ts/src/**`（正则 `(SELECT COALESCE(` / `COALESCE((SELECT`）。

- **旧内层缺陷形态**（`(SELECT COALESCE(b.batt`）：**0 处**（`C1` 已全修）。
- **新外层正解形态**（`COALESCE((SELECT b.batt`）：**5 处**，逐行 `database.ts:3608` · `:3637` · `:3700` · `:4229` · `:4335`（`applyToJob` 前置拦 2 + `acceptJobApplication` 门 1 + `getBatt` 读口 1 + `checkin` 写口 1）。
- **全 `src` 面 `(SELECT COALESCE(` 命中 = 15**：除上列 5 处外层正解外，余 10 处全在 `commission.ts`（`(SELECT COALESCE(sum(delta),0) … FROM ev …)`）—— 系**聚合** `COALESCE(sum())`（`sum` 恒返回一行，不存在「无行」语义）⇒ **非同族**。
- **结论**：全 `src` 面**无同族残留**（旧内层形态 0）。

---

## 4. L4 `R-9-23` 钳制独立复核

> 手法：本单自写 `backend-ts/.p9s2qa-closeout/l4-r923.ts`（`withTransaction` 内 **INSERT** 策略键 + 哨兵 `ROLLBACK`；驱动**真实服务层方法** `checkin` / `applyToJob` / `acceptJobApplication` 经 `sqlFor(ex)` 事务内注入）。产物 `l4-r923-<RUN>.json`。
> **读数：`total=12 passed=12 failed=0`（EXIT 0）**；夹具 uid = **1**（隔离用户，事务内建 + 回滚）。

**事务内 INSERT 策略键**（`app_config` · `ON CONFLICT (key) DO UPDATE`；**非 UPDATE `app_config`**）：
- `batt_policy = {taskCostBatt:9, capBatt:200, floorBatt:0, acceptThresholdBatt:9}`
- `checkin_policy = {baseRewardBatt:30, streakCapDays:10, streakDay7RewardBatt:60, makeupCostUsd:100, makeupDailyLimit:1}`

| 检查 | 逐字读数 |
|---|---|
| `L4-a` / `L4-b`（纯 resolver，`AV4` 域未破） | 入 `capBatt=200` ⇒ 生效 **100**；入 `streakCapDays=10` ⇒ 生效 **7**；二者 `source = "config"` ⇒ **域校验仍在入口放行任意正整数、钳制只在读生效值**（不破 `AV4`） |
| `L4-c` | `floorBatt=150 > capBatt=100` ⇒ floor 生效 **100**（`floor ∈ [0,capBatt]`） |
| `L4-1` | 事务内读回原始 `capBatt = 200`（`getAppConfigValueByKey`）⇒ 生效 **100** |
| `L4-2` | 事务内读回原始 `streakCapDays = 10` ⇒ 生效 **7** |
| `L4-3` | 读口 `GET /api/batt` ⇒ `capBatt=100` · `floorBatt=0` · `source="config"` |
| `L4-4` | 读口 `GET /api/checkin` ⇒ `streakCapDays=7` |
| `L4-5` | **签到写路径不 23514**：`batt=95` 种子 ⇒ `inserted` · `batt:95→100`（封顶丢弃）· `streakDay=7`（钳到 7）· `creditedBatt=5` · `err=null` |
| `L4-6` | **消耗写路径不 23514**：`applyToJob` ⇒ `applied`；`acceptJobApplication` ⇒ `accepted` · `workerBattAfter=91`（100 扣 9）· `err=null` |
| `L4-7` | **反事实判负①**：`batt_after=125` 直插 ⇒ **`23514`**（DB 兜底 CHECK 为荷载） |
| `L4-8` | **反事实判负②**：`streak_day=8` 直插 ⇒ **`23514`** |
| `L4-9` | **零净写终证**：`ROLLBACK` 后 `app_config 1 / policy 0 / batt_account 2 / checkin_log 2` 与基线**逐项相同** |

⇒ **`R-9-23` 钳制独立坐实**：即便 `capBatt=200` / `streakCapDays=10` 在册，生效值恒为 **100 / 7**，签到与消耗两条写路径**均不出现 `23514`**；反事实（未钳制值直插）**必红 `23514`**，证明钳制为荷载、DB CHECK 为兜底。

---

## 5. L1 硬门（本单复跑 · 退出码管道外捕获）

> 手法：`cmd; rc=$?`（管道外捕获）。全部离线段（不含受控实例）。

| 门 | 命令 | 读数 | 退出码 |
|---|---|---|---|
| `tsc` | `npx tsc -p tsconfig.json` | 0 行 | **0** |
| 离线套件 | `scripts/p4z-tr1a-01-offline-tests.ts` | `total=126 passed=126 failed=0` | **0** |
| 前端 `build` | `frontend` `npm run build` | `index-CAasue3y.js 388.42 kB` · `✓ built in 1.67s` | **0** |
| 前端 `test:unit` | `frontend` `npm run test:unit` | `Test Files 31 passed (31)` · `Tests 276 passed (276)` | **0** |
| `p8-s1` | `p8-s1-app-config-gate.ts` | 24/24 | **0** |
| `p8-s2` | `p8-s2-fee-rebate-gate.ts` | 41/41 | **0** |
| `p8-s3` | `p8-s3-deposit-gate.ts` | 45/45 | **0** |
| `p8-s3b` | `p8-s3b-address-gate.ts` | 38/38 | **0** |
| `p8-s4` | `p8-s4-currency-review-gate.ts` | 79/79 | **0** |
| `p8-s5` | `p8-s5-compliance-gate.ts` | 117/117 | **0** |
| `p8-s6` | `p8-s6-site-text-gate.ts` | 64/64 | **0** |
| **`p8-s7`（离线 · 无实例）** | `p8-s7-batt-checkin-gate.ts` | `total=56 passed=53 failed=3` · 红 **`G8`·`G9`·`G10`**（全 HTTP 类：`{"status":-1}` / `fetch failed`）· `pending_apply=0` · `db=7` | **1** |

- **合计（离线）**：`24+41+45+38+79+117+64+53 = 461` 绿 / `464`；唯一红 = `p8-s7` 3 条 **HTTP 类**（无实例在听 ⇒ 环境差异，**非判据退化**；**未改判据放宽、未标 `SKIPPED` 假绿**）。
- **注册点 = 80 逐 verb（现取）**：`get 34 / post 43 / put 0 / patch 1 / delete 2`（和 = 80）。
- **★ 探针不得放进门的扫面根（本单自报教训）**：`p8-s7` 的 D 组「无第四处」穷举**扫面根 = `backend-ts/src` · `backend-ts/migrations` · `backend-ts/scripts` · `frontend/src` · `docs`**（排除 `node_modules`/`dist`/`.git`/`*artifacts`）。上一轮质检时曾将**探针落在 `backend-ts/scripts/`** ⇒ 被扫面根命中，产生 **6 条误红**；**将探针移出扫面根后，`p8-s7` 离线读数还原为 `53/56`**（红 3 = HTTP 类）。⇒ **纪律：一切探针 / 夹具一律落在 `backend-ts/scripts/` 之外**（本单全部落在 `backend-ts/.p9s2qa-closeout/`）。当前仓内 `backend-ts/scripts/p8-s5-00-recon{,2,3}.ts` 为**他单遗留探针残件**（非本单），登记为**扫面根风险**（见 §10）。
- **`p8-s7` 双读数（`R-9-26`）**：
  - **带实例 `5797` 在听 ⇒ `total 56 / passed 56 / failed 0`**（`pending_apply=[]` · `db=7` · `http=9`）——**承报告 §17/§18（上一轮质检产物 `backend-ts/.p9s2-artifacts` / `.p9s2c-closeout`），本单**未独立重取**；原因：带实例腿含 `POST /api/checkin` / `POST /api/checkin/makeup`（**真写生产库**）⇒ 触硬口径④「严禁任何生产库真写」；且本单⑧要求 `5796-5799` 收尾**空**。**本单已独立重取离线读数**（上表 `53/56`）。
  - **离线（无实例）⇒ `total 56 / passed 53 / failed 3`**（本单独立重取，见上表）。

---

## 6. L5 库面（只读）：`schema_migration` checksum 双对拍 + 零净写终证

> 手法：本单自写 `backend-ts/.p9s2qa-closeout/l5-checksum.ts`（只读）。产物 `l5-checksum.out` · `l5-final.out`。checksum 算法 = `migrate.ts` 所载 `crypto.createHash('sha256').update(sql,'utf8')`（= 文件 UTF-8 字节 sha256，与 `shasum -a 256` 同）。

- **全量对拍**：已应用 **28 行** == 迁移文件 **28 个**；`version` 逐一 ↔ 文件 sha256 ⇒ **`mismatch = 0`**。
- **本单点名两行（逐字）**：

| 版本 | 文件 | DB `checksum` | 文件 `sha256` | 一致 |
|---|---|---|---|---|
| `0028` | `0028_kind_close_set_21.sql` | `80381d0910c779006365642df4b8f975316d945dc3d9e6b5f106bd34971abd85` | 同左（`shasum -a 256` 复核同） | **√** |
| `0029` | `0029_batt_checkin.sql` | `4cb0a07bd3c4078c8a739e8a343129fdcd89ba74b44bb3748fe8a9cd985bc49b` | 同左（`shasum -a 256` 复核同） | **√** |

- **零净写终证（全单探针跑完后现取）**：`schema_migration 28` · `app_config 1` · `batt_account 2` · `batt_entry 2` · `checkin_log 2` · `checkin_makeup_log 2` · `job(job_id ≥ 990000) 0` ⇒ **与开工基线逐项相同**（本单 `0028`/`0029` 既未改也未重 apply ⇒ checksum 恒等；新增 `0029` 行名 = `0029_batt_checkin.sql`，`applied` 沿用上一轮）。

---

## 7. L6 报告核 + 冻结件

> 手法：对被检面报告 `docs/audit/p9-s2-batt-checkin.md` 现取 + 抽 5 条对拍 + 锚点核对。

- **报告统计（现取）**：**363 行** · **41,404 字节** · **占位符（连续两下划线）命中 = 0**（占位归零）——**逐项符合**。
- **锚点核对（现取存在）**：
  - `## 14. 三处真缺陷（真链路查出 · 静态门 A–G 全漏 · 已最小修）` ⇒ 存在（:251）
  - `## 15. C1 定位结论（六中间量读数 + 三假设逐条排除 + 根因 + 最小修法）` ⇒ 存在（:263）
  - `## 17. 门 · 复跑读数（带实例 vs 离线双读数）` ⇒ 存在（:312）
  - `## 19. pending_apply[] = 0 + 两项边界登记` ⇒ 存在（:349）

### 7.1 抽 5 条对拍（现取逐条，对报告陈述逐字核）

| # | 报告处 | 报告陈述 | 本单现取 | 一致 |
|---|---|---|---|---|
| 1 | §14（三缺陷·#1） | `checkin` 引用改 `streak_day`；`grep -c "checkin_makeup'" = 0`；`RETURNING log_id, result, txid, restored_streak_day` | `checkin_makeup'` 命中 = **0**；`streak_day FROM ins_log` 命中 3 处（`:4349`/`:4358`/`:4451`）；`RETURNING log_id, result, txid, restored_streak_day` 在 `:4445` | **√** |
| 2 | §15.4（C1 修法） | 外层形态全修 **5 处**、旧内层形态 **0 处** | `COALESCE((SELECT b.batt` = **5**（`:3608`/`:3637`/`:3700`/`:4229`/`:4335`）；`(SELECT COALESCE(b.batt` = **0** | **√** |
| 3 | §0/§17（注册点） | 80 逐 verb `get 34 / post 43 / put 0 / patch 1 / delete 2` | 现取同（和 = 80） | **√** |
| 4 | §3.1（`R-9-21` 三处编码） | `LEDGER_KINDS` = 21 值末位 `checkin_makeup_fee` | `LEDGER_KINDS` 计 **21**，`last = checkin_makeup_fee`（`:157` 起，`:164` 末位） | **√** |
| 5 | §18（冻结键集） | `GET /api/batt` 6 键 `batt/capBatt/floorBatt/acceptThresholdBatt/canAccept/updated_at` | `index.ts:1194` 起 `sendSuccess` 逐字 6 键 | **√** |

### 7.2 冻结件核（`git show --stat 4c40b47` 现取）

- **`4c40b47` 含 4 件冻结件**（`docs/versions/data-layer.spec.v0.20.md` · `docs/audit/data-layer-v0.20-delta.md` · `docs/versions/route-layer.spec.v2.13.md` · `docs/audit/route-layer-v2.13-delta.md`）⇒ **全在场**（blob 见 §0）。
- 报告 §0–§20 结构与分支计数逐条对拍一致（报告 363/41404/占位 0）。

---

## 8. L7 面核：四语键集 · 六类泄漏 · 错误码闭集

> 手法：被检面 `frontend` 现取，运行既有面核脚本（`node scripts/p6-tr2-i18n-locales.mjs` · `node scripts/p4z-i18nviol-global.mjs`）。

### 8.1 四语键集相等

- `p6-tr2-i18n-locales.mjs` 现取：`zh/en/hk/vn` 各 **`top=114` / `flat=953`**；键集相等 **PASS**（四文件拍平键数取值集合 = `{953}`）。
- 本单独立复核（Python 递归叶计数）：四语 `top=114` · 叶键（`leaves`）= `953`，**四语相等**；新命名空间 `battCard` / `checkinPanel` 四语**俱在**。

### 8.2 六类泄漏 = 0

- `p4z-i18nviol-global.mjs` 现取 **总判 PASS**：
  - ① 全量 locale 面：作用域命中节点数 **`3812`**（键 953 × 语 4）· **裸命中 = 0** · 显式豁免登记 9 条（逐条列名）。
  - ① `en`/`vn` 残留中文（豁免外） = **0**。
  - ② 全量页面源文件面：扫描 70 文件 · 用户可见文案节点 42 · **裸命中 = 0**。
  - ③ 残余发现（类级现取）：形态命中 **0** 处；类级残余（活体）= **0** 条。
  - ⇒ **locale 裸命中 0 + 源面裸命中 0 + en/vn CJK 0 + 类级残余 0**。
- **如实登记（非判据红）**：脚本子面③「硬编码中文文案字面量」扫出 1 处命中 `pages/jobs/JobDetailPage.jsx:238`（`[SQL/事务] … SELECT 列集**不含** …`）——**经逐字核**：该串位于 `{/* … */}` **JSX 注释块**内（`:236-240`），**非用户可见面**，且 `JobDetailPage.jsx` **不在 `4c40b47` 写集**（`git show --stat` 未含）⇒ **非本单引入、非用户可见、不影响「六类泄漏 = 0」**；脚本自身总判亦 PASS。登记于此以不静默放水。

### 8.3 错误码闭集 = 33（未动）

- 被检面 `backend-ts/src`：`grep -rhoE "LD0[0-9][0-9]" src | sort -u | wc -l` = **33**（`LD001…LD033`，连续无缺号）；与主仓 `src` 现取**同 33** ⇒ **本单零新增 / 零删除错误码**。

---

## 9. L8 未测项 + verdict

### 9.1 未测项（逐项原因 · 禁填 0/空）

| # | 未测项 | 原因 |
|---|---|---|
| 1 | `p8-s7` **带实例真 HTTP 56/56**（无 token 401 ⇄ 有 token 200 + 公开面 200） | 带实例腿含 `POST /api/checkin` / `POST /api/checkin/makeup` = **真写生产库** ⇒ 触硬口径④；且本单⑧要求 `5796-5799` 收尾空。⇒ **未在本单独立重取**（承报告 §17/§18 上一轮读数 56/56）。 |
| 2 | 4 新口**真 HTTP** 响应体逐字（无 token `401` / 有 token `200` / 补签 `409` 三类拒绝的 body） | 同上（需受控实例 + 真跑，含真写）⇒ 未跑；静态面（冻结键集 / `sendInfraMapped` 四标签 / `requireActor` 全闸）已由 `p8-s7` A–F + 报告核验。 |
| 3 | 前端电量卡 / 签到区**浏览器实渲染**与四语切换目视 | 需真实浏览器 + 受控实例；本单只跑 `build` + `test:unit`（276）+ 面核脚本（键集 / 泄漏），**非**该组件实渲染断言。 |
| 4 | 冒顶丢弃 / 断签清零 / `≤1/日` 补签上限的**运行期行为**（跨真时钟） | 本单已用**真事务**覆盖单次行为（`L2-A4` 封顶丢弃 · `L2-B5` 日限 · `L2-C2` 回滚）；**跨日**运行行为依赖真时钟推进 ⇒ 未测。 |
| 5 | `0028`/`0029` **重 apply** 或迁移漂移行为 | 硬口径⑤「不得 apply 迁移」；且 checksum 双对拍已证 DB↔文件恒等（§6）⇒ 无需也不许重 apply。 |

### 9.2 verdict

- **`R-9-23` 钳制（①）**：**PASS**（独立坐实生效 100/7；签到 + 消耗写路径不 `23514`；反事实必红）。
- **前端腿（②）**：**PASS**（`build` exit 0 · `test:unit` 276/276 exit 0）。
- **L5 库面（③）**：**PASS**（28/28 checksum 双对拍；`0028`/`0029` 逐字一致；零净写终证恒等）。
- **L6 报告核（④）**：**PASS**（363 行 / 41,404 B / 占位 0；四锚点在；抽 5 条全对拍；`4c40b47` 含 4 件冻结件）。
- **L7 面核（⑤）**：**PASS**（四语 `top 114` / `flat 953` 相等；六类泄漏 0；错误码闭集 33 未动）。
- **L8**：**PASS（1 项如实登记为未独立重取：`p8-s7` 带实例 56/56，原因见 §9.1-1）**。
- **总判**：**实质面全绿**；唯一非绿 = `p8-s7` **离线** 3 条 HTTP 类（环境差异，非判据退化；双读数之一）。**被检面 `4c40b47` 保真（§10 blob 对拍 0 不符）**。

---

## 10. 收尾：副本 blob 对拍 + worktree 移除 + 端口 + 首尾 git status

### 10.1 被检面保真（blob 对拍）

- **副本 = pin worktree** `qaP9s2` @ `4c40b47`（`git rev-parse HEAD` = `4c40b47d1c…`）。
- **逐文件 blob 对拍**：对 `4c40b47` 改动集**全部 29 个文件**，`git hash-object <副本文件>` == `git rev-parse 4c40b47:<path>` ⇒ **不符计数 = 0**。
- **4 件冻结件**另行逐字对拍 ⇒ 4/4 **SAME**（blob 见 §0）。

### 10.2 worktree 移除（★ 先逐副本查脏）

- **查脏（移除前）**：副本 `git status --porcelain` = **仅 `??`（未跟踪产物 / node_modules 软链 / `run-backend-gates.sh`）**，**` M` = 0**（无 tracked 改动）⇒ **被检面未被污染，不触发「脏 ⇒ 停手」**。本单自身产物（`frontend-build.out` / `frontend-testunit.out`）已先拷回主仓 `backend-ts/.p9s2qa-closeout/` 再移除。
- `git worktree remove --force <scratch>/qaP9s2` ⇒ **RC 0**，副本消失。

### 10.3 端口

- `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` ⇒ **空**（RC 1，与派单方复核一致；本单**全程未起实例**）。
- `lsof -nP -iTCP:5787-5788 -sTCP:LISTEN` ⇒ 仍 `5787`（PID `30475`）/ `5788`（PID `65096`）**恒等**（全程未启停）。

### 10.4 剩余 worktree（仅登记）

- `/Users/kevin/bistro/seafood`（`ab5cc14` `[main]`）
- `<scratch>/p7d-neg`（`f0bd336` detached）· `<scratch>/qa-p7a-09362ad`（`09362ad`）· `<scratch>/qa-p7a-final`（`ae46297`）· `<scratch>/qa-p7b`（`39d89b3`）—— 均**非本单**，仅登记不动。

### 10.5 末次 `git status --porcelain`（逐条归因）

- **读数**：**135 行 = 1 `M` + 134 `??`**（首读数 127 行 = 1 `M` + 126 `??`；**Δ = +8 `??`**）。
- **1 `M`**：`backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json` —— **前置遗留（非本单）**。
- **本单新增 `??`（+8，逐条）**：`backend-ts/.p9s2qa-closeout/`（本单探针 / 产物目录）+ 7 个**硬门复跑新 run 目录**：`backend-ts/.p4-artifacts/p6tr1a-20261003T031957Z/`（离线套件）· `.p8s1-artifacts/p8s1-20261003T032003Z/` · `.p8s2-artifacts/p8s2-gate-20261003T032003Z/` · `.p8s3-artifacts/p8s3-20261003T032004Z/` · `.p8s3b-artifacts/p8s3b-20261003T032005Z/` · `.p8s4-artifacts/p8s4-20261003T032005Z/` · `.p8s5-artifacts/p8s5-20261003T032006Z/`（`p8s6`/`p8s7` 新产物落在**已整目录未跟踪**的父目录内 ⇒ 不另计行）。
- **其余 `??`（前置遗留，非本单）**：各 `.p4-artifacts/**` · `.p6tr1a/**`… 历史 run 目录 · `.p9s2qa-artifacts/` · `.p9s2-artifacts/` · `.p9s2-apply/` · `.p9s2c-apply/` · `.p9s2c-closeout/` · `.p9s1qa-artifacts/` · `docs/qa/p9-s2-batt-checkin-qa.md`（本单回填对象，骨架**开工前已 untracked**）。
- **★ 扫面根风险登记（非本单）**：`backend-ts/scripts/p8-s5-00-recon.ts` · `p8-s5-00-recon2.ts` · `p8-s5-00-recon3.ts` —— 他单遗留探针**落在 `backend-ts/scripts/`（= `p8-s7` 扫面根）**；本单 `p8-s7` 离线复跑 `53/56` 未见由此产生的多余误红（当前内容不命中扫面正则），但**形态上属扫面根污染**，建议后续移出。
- **本单未产生 `backend-ts/scripts/**` 任何条目**（全部探针 / 夹具落在 `.p9s2qa-closeout/`）。

### 10.6 硬口径自证

- **未改被检件**（代码 / 报告 / 迁移逐字未动；仅新增 `docs/qa/**` 与本单产物）· **未 `git add/commit/push`** · **未 `npm install`** · **未碰 / 未打印 `.env*`** · **未 `pkill -f` / `killall`** · **未启停 `5787`/`5788`** · **库面写一律事务内 + `ROLLBACK`** · **未 UPDATE `app_config`**（策略键事务内 **INSERT**）· **未 apply 迁移** · **探针未落 `scripts/`** · **原始输出无 `.log` 后缀** · **错误码闭集 33 未动**。
