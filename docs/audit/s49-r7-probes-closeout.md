# S49（Kong）· 路线图 `R7` 收口：两个独立探针 —— `s5-01` **转绿** / `s3-01` **探针前置已补齐但行为段被产品侧闸阻断（报回）**

- **单号**：S49（角色：Kong）· **模式**：两探针各自「事务内写 + 末尾 `ROLLBACK`」；**零产品改动**（只改这两个探针）
- **runid**：`s49-20261007T011004Z`
- **产物目录**：`backend-ts/.s49-artifacts/s49-20261007T011004Z/`（`**/.*-artifacts/` 已 gitignore）
- **本单改动（`git diff --stat`）**：仅 `backend-ts/scripts/p8-s5-01-real-chains.ts`（+73/-? ）· `backend-ts/scripts/p8-s3-01-effective.ts`（+110/-? ）——**`backend-ts/src/**` / `migrations/**` / `frontend/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md` 零改动**。
- **结论先行**：
  - **`s5-01` ✅ 转绿**：`exit 1 · 67/69` → **`exit 0 · 84/84`**。**期望前推**（纳入 `0043_truncate_guard.sql` 新增的 **15 枚** `*_no_truncate` `BEFORE TRUNCATE` 守卫），**期望集只增不减**、**逐条出处**（迁移文件行 + 建表迁移:行 + `pg_trigger` 现取）。判负 84→82（红 2，恰为新增项）→ 复原 84/84。
  - **`s3-01` ⚠️ 探针侧前置已补齐，但行为段红点未消除 —— 真因是产品侧**：`listCurrencyWithDeposit` 的 `apply` CTE 有 **C2 审核闸**（缺 approved `currency_review_log` ⇒ `applied=0`），**此层已属探针前置**（本单已构造）；**但越过该层后**，同路径函数被**下游账本闸**逐字拒绝：**`LD016 / LEDGER_AMOUNT_INVALID · reason=HOLD_PAIR_REQUIRED`**（`ledger_post_event` 的 hold 家族「同账户 2 腿」守卫），因 `LIST_CURRENCY_WITH_DEPOSIT_SQL` 的 `listing_deposit` 是**跨账户**腿（owner −N → `uid=-1` +N）。
  - **该下游闸是产品侧回归**：迁移 `0020`（本仓 P4-B3a 修复）已把 `'listing_deposit'` 从 hold 家族列表删除（`0020:573` = `('hold','hold_release','job_escrow','job_escrow_refund')`）；**更晚的迁移 `0034`（P1f）重建 `ledger_post_event` 时又把它加回**（`0034:46` CREATE OR REPLACE + `0034:594` 含 `,'listing_deposit'`）⇒ live 函数体 = `0034` 版 ⇒ 任何含跨账户 `listing_deposit` 的账本事件必被拒。
  - ⇒ 在**零产品改动**口径下，`s3-01` 行为段**不可转绿**（除非改 `migrations/**` 或 `src/**`）。按派单【任务 2 兜底】「**若某前置…不可构造 ⇒ 停下报回并给出方案选项**」办理：**§2.4 报回 + 三个方案选项**；红点**逐条保留**（未放宽判据 / 未删断言）。

---

## §0 对锚（开工前现取）

| 项 | 现取读数 | 命令 |
|---|---|---|
| HEAD | `78c25d0` `chore: S48 B22 决策材料 … + R7 定性…` | `git log --oneline -3` |
| 分支 | `main` | `git branch --show-current` |
| tracked 改动（T0） | **0**（`git status --porcelain` 空） | `git status --porcelain` |
| DB 现取 | `schema_version=0043` · `schema_migration 42 行`（`0001`…`0043`，含 `0020`/`0034`） | 只读探针 `roq.cjs` |
| 连库口径 | **进程内** dotenv（`backend-ts/.env.local`，绝对路径）；**未** shell `source`/`export`；**未**打印任何密钥 | `roq.cjs` / 两探针 `import '../src/env'` |
| 端口 | 本单**未起任何实例**（两探针均一次性 `ts-node` 进程，无监听）。开工后 `lsof` 仅见**既有**监听 `5191/5787/5788/5555`（**非本单所起，未触碰**） | `lsof -nP -iTCP -sTCP:LISTEN` |

★ 纪律：未 `pkill -f` / `killall`；未 commit / push；未 `npm install`；原始输出未落 `.log`（落 `.s49-artifacts/<runid>/*.stdout|.stderr|.json|.txt`）。

---

## §1 `s5-01` 前推期望（逐条出处 + `pg_trigger` 现取）

### §1.1 改前读数（现取）

- 命令：`cd backend-ts && npx ts-node --transpile-only scripts/p8-s5-01-real-chains.ts`
- `exit 1 · total=69 passed=67 failed=2`
- 红点（逐条）：`S1.listing_review_log.append_only` · `S1.job_arbitration_log.append_only`
- 原始 expect ⇄ actual（`0043` 已应用 ⇒ 现盘多 1 枚 `*_no_truncate`）：两表同形
  - `expect=["trg_listing_review_log_append_only:27"]` ⇄ `actual=["trg_listing_review_log_append_only:27","trg_listing_review_log_no_truncate:34"]`
  - `expect=["trg_job_arbitration_log_append_only:27"]` ⇄ `actual=["trg_job_arbitration_log_append_only:27","trg_job_arbitration_log_no_truncate:34"]`
- 定性：**探针「期望触发器集合」冻结面滞后**（`0043` 后未前推）⇒ **非产品缺陷**；前推 = **加严**（把 TRUNCATE 守卫纳入期望）。

### §1.2 前推后的期望（**只增不减**，旧值留痕）

| 检查 ID | 改前 expect（旧值留痕） | 改后 expect（只**追加** 1 项，既有项**一字不动**） |
|---|---|---|
| `S1.listing_review_log.append_only` | `["trg_listing_review_log_append_only:27"]` | `["trg_listing_review_log_append_only:27","trg_listing_review_log_no_truncate:34"]` |
| `S1.job_arbitration_log.append_only` | `["trg_job_arbitration_log_append_only:27"]` | `["trg_job_arbitration_log_append_only:27","trg_job_arbitration_log_no_truncate:34"]` |

- `tgtype` 位说明：`BEFORE`=2 · `TRUNCATE`=32 ⇒ **statement 级 = 2+32 = 34**（无 `ROW` 位 1；`0043` 用 `FOR EACH STATEMENT`，见 `0043:38-40`）。
- 代码内**逐条带注释**：触发器名 / `0043` 出处行 / 建表迁移:行 / 旧值留痕（见 `p8-s5-01-real-chains.ts` §①）。

### §1.3 `0043` 冻结面 **15 枚**逐条出处 ⇄ `pg_trigger` 现取（新增只读段 `section1b_truncate_guards`）

出处三口径：**表** :: **触发器名** :: **建表迁移:行**（`0043:16-32` 头注）· **`0043` 中 `CREATE TRIGGER` 行**（现读文件动态定位）· **库面 `pg_trigger` 现取**。全部 15 枚 **`tgenabled='O'`（启用）** / `tgtype=34` / `BEFORE ∧ TRUNCATE ∧ statement`。

| # | 表 | 触发器名 | 建表迁移:行 | `0043` CREATE TRIGGER 行 | `pg_trigger` tgenabled | tgtype | 守卫函数 |
|--:|---|---|---|--:|:--:|--:|---|
| 1 | `ledger_entry` | `trg_ledger_entry_no_truncate` | `0001:125` | `159` | `O` | 34 | `ledger_entry_no_truncate` |
| 2 | `referral` | `trg_referral_no_truncate` | `0007:75` | `164` | `O` | 34 | `referral_no_truncate` |
| 3 | `commission_policy` | `trg_commission_policy_no_truncate` | `0007:110` | `169` | `O` | 34 | `commission_policy_no_truncate` |
| 4 | `market_trade` | `trg_market_trade_no_truncate` | `0016:359` | `174` | `O` | 34 | `market_trade_no_truncate` |
| 5 | `currency_status_log` | `trg_currency_status_log_no_truncate` | `0017:237` | `179` | `O` | 34 | `currency_status_log_no_truncate` |
| 6 | `admin_ops_audit_log` | `trg_admin_ops_audit_log_no_truncate` | `0023:125` | `184` | `O` | 34 | `admin_ops_audit_log_no_truncate` |
| 7 | `admin_refund_audit_log` | `trg_admin_refund_audit_log_no_truncate` | `0024:100` | `189` | `O` | 34 | `admin_refund_audit_log_no_truncate` |
| 8 | `currency_review_log` | `trg_currency_review_log_no_truncate` | `0025:90` | `194` | `O` | 34 | `currency_review_log_no_truncate` |
| 9 | `listing_review_log` | `trg_listing_review_log_no_truncate` | `0026:95` | `199` | `O` | 34 | `listing_review_log_no_truncate` |
| 10 | `job_arbitration_log` | `trg_job_arbitration_log_no_truncate` | `0027:99` | `204` | `O` | 34 | `job_arbitration_log_no_truncate` |
| 11 | `batt_entry` | `trg_batt_entry_no_truncate` | `0029:256` | `209` | `O` | 34 | `batt_entry_no_truncate` |
| 12 | `checkin_log` | `trg_checkin_log_no_truncate` | `0029:261` | `214` | `O` | 34 | `checkin_log_no_truncate` |
| 13 | `checkin_makeup_log` | `trg_checkin_makeup_log_no_truncate` | `0029:266` | `219` | `O` | 34 | `checkin_makeup_log_no_truncate` |
| 14 | `rating` | `trg_rating_no_truncate` | `0031:171` | `224` | `O` | 34 | `rating_no_truncate` |
| 15 | `listing_order_event` | `trg_listing_order_event_no_truncate` | `0031:176` | `229` | `O` | 34 | `listing_order_event_no_truncate` |

- **现取（`pg_trigger` 独立复取，见 `roq.out`）**：`trg_%_no_truncate` 共 **15 行**，逐行 `tgenabled='O'` · `tgtype=34` · `(tgtype & 1)=0`（statement 级）；与上表**逐条一致**。
- **四表读数（现取）**：
  - `listing_review_log` → `[trg_listing_review_log_append_only:27, trg_listing_review_log_no_truncate:34]`
  - `job_arbitration_log` → `[trg_job_arbitration_log_append_only:27, trg_job_arbitration_log_no_truncate:34]`
- 段内新增 **15 条** check（每表 1 条，`group='truncateGuard'`）：断言「迁移文件有对应 `CREATE TRIGGER` 行（行号逐条相符）∧ 库内 `present ∧ tgenabled='O' ∧ tgtype=34 ∧ 函数名=<table>_no_truncate`」。

### §1.4 改后读数

- `exit 0 · total=84 passed=84 failed=0`（**分母 69→84 ↑**，红点 **2→0**）。
- 产物：`.p8s5-artifacts/p8s5-20261007T011856Z/real-chains.json`（副本 `after-s5-01.real-chains.json` / `final-s5-01.real-chains.json`）。

---

## §2 `s3-01` 补前置 + 零残留自证（**并报回：行为段被产品侧闸阻断**）

### §2.1 改前读数（现取）

- 命令：`cd backend-ts && npx ts-node --transpile-only scripts/p8-s3-01-effective.ts`
- `exit 1 · total=34 passed=23 failed=11`，11 红**全在 `behavior` 段**（逐条见 §3）。
- 原始读数（逐字）：`fixture={owner_uid:"970001", owner_balance_baseline:"1627271"}` · `4_before.list_reply={cur_found:1, applied:0, cur_status:"draft"}` · `owner_decrease=0` · `pool_increase=0` · `ledger_legs=[]`。
- **现取定位（本单新证）**：`cur_found=1` 说明币在库、`applied=0` 说明 `apply` CTE **不产行** ⇒ 命中 `apply` 内建谓词（`src/database.ts` 的 `LIST_CURRENCY_WITH_DEPOSIT_SQL`）：
  - **C2 审核闸**：`EXISTS (SELECT 1 FROM public.currency_review_log r WHERE r.cid=$1 AND r.result='approved')`（`LIST_CURRENCY_WITH_DEPOSIT_SQL` @ `:645-651`）——新造 `draft` 币**无** approved 台账行 ⇒ 不产行。
  - ⇒ 派单定性「缺 `account_guard` 可满足的前置」**不完全**：真因第一层是 **C2 审核闸（缺 approved `currency_review_log`）**，与 `account_guard` 无关（已出资账户 `970001` 现成、`S0-owner-funded` 恒绿）。

### §2.2 前置构造（**事务内造数 + 断言 + 末尾 `ROLLBACK`**）

在 `p8-s3-01-effective.ts` 内新增（**不改判据、不删断言**）：

1. `pickAdmin(tx)`：现取一名 `users.is_admin=true` 的 uid（审核台账 `actor_uid` 有 FK → `users(uid)`，**不得发明**）。现取 = **`1`**。
2. `approveDraft(tx, cid, adminUid, tag)`：**事务内 raw INSERT** 一行 `currency_review_log(result='approved')`。
   - **为何不用同路径 verb `DatabaseService.currencyReviewPostEvent`**：其 `approved` 分支会把 `currency.status` **推成 `listed`**（`p8-s4-01-effective.ts` A6/A8 现证），而本片 `apply` 的前置是 `status='draft'`；⇒ 只能 raw INSERT 以**保持 draft**。`currency_review_log` 的 append-only 守卫（`0025`）仅拦 `UPDATE/DELETE`，**不拦 INSERT**。
   - 已出资账户（`pickOwner`：cid=1 最大余额正 uid = **`970001`**，余额 `1627271`）与 `draft` 币（`insertDraft` 三个 cid `925000001/2/3`）**沿用既有构造**。
3. `listGuarded(tx, input)`：把 `runListSamePath` 包进 **`SAVEPOINT`**；若下游守卫抛错 ⇒ `ROLLBACK TO SAVEPOINT`（保全外层事务）并把**逐字守卫回执**记回 reply 的 `guard_error`（**不吞错、不改 `applied` 真值**）。

### §2.3 现取读数：**前置满足后仍被下游账本闸拒**（★ 报回核心）

改后 `4_before` / `4_after` 的 `guard_error` **逐字相同**：

```json
{"code":"LD016","message":"LEDGER_AMOUNT_INVALID",
 "detail":"{\"cid\": \"1\", \"uid\": \"970001\", \"kind\": \"listing_deposit\", \"field\": \"entries\", \"reason\": \"HOLD_PAIR_REQUIRED\"}"}
```

- 直接复取定位（throwaway `exp-ledger.ts`，事务内 + ROLLBACK）：
  - **仅 fee 两腿**（`currency_create_fee`，owner/−1）⇒ **`ok:true`**（4 段中 2 段成立）。
  - **仅 deposit 两腿**（`listing_deposit`，owner/−1 跨账户）⇒ **`LD016 / HOLD_PAIR_REQUIRED`**。
  - **完整 4 腿** ⇒ 同 **`LD016 / HOLD_PAIR_REQUIRED`**。
- `where`：`PL/pgSQL function ledger_post_event(jsonb) line 551 at PERFORM`（live `prosrc` 第 547 行的 hold 家族 IN 列表含 `'listing_deposit'`）。
- ⇒ **`listing_deposit` 被当作「同账户 2 腿 hold 家族」**（要求 `(uid,cid,kind)` 各恰 2 条），而 `LIST_CURRENCY_WITH_DEPOSIT_SQL` 的 `listing_deposit` 是 **owner ⇒ `uid=-1`** 的**跨账户消耗**（DL67/DL88/R31）⇒ 该组各只有 **1 条** ⇒ 恒拒。

### §2.4 ★ 报回：下游闸是**产品侧回归**（`0034` 撤销了 `0020`）——给出方案选项

**证据链（现取，逐条）**：

| 面 | 现取 | 说明 |
|---|---|---|
| live `ledger_post_event.prosrc` | 第 **547** 行 `WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')` | 含 `'listing_deposit'` |
| `0034_ledger_op_burn_and_supply.sql` | `:46` `CREATE OR REPLACE FUNCTION ledger_post_event(payload jsonb) RETURNS jsonb`；`:594` 列表**含** `,'listing_deposit'` | **最后**重建该函数者（`0034` 之后无重建） |
| `0020_…_drop_listing_deposit.sql` | `:54` `CREATE OR REPLACE FUNCTION public.ledger_post_event`；`:573` 列表 = `('hold','hold_release','job_escrow','job_escrow_refund')`（**无** `listing_deposit`）；`:25-26` 明写「**唯一**差异 = 删除 `,'listing_deposit'`」 | 0020 的**有意**修复 |
| 其他重建者 | `0004:437` · `0005:495` · `0012:77`（均在 `0020` 之前） | — |

⇒ **`0034`（P1f，晚于 `0020`）在重建 `ledger_post_event` 时未继承 `0020` 的删改，把 `'listing_deposit'` 又写回 hold 家族** ⇒ 现盘 `POST /api/currency/:cid/list`（含非零保证金）**恒被 `LD016/HOLD_PAIR_REQUIRED` 拒**（且 `$3=0` 亦不可行：两腿 `0/0` 会命中 `BOTH_ZERO`）。此前**无任何门覆盖该路径**（`p8-s4-01` / `p8-s4-currency-review-gate` 均**不**走到 `listing_deposit` 分录；`p4z-b3b-03-legs.ts` 曾证 4 腿跨账户成立——那是在 `0020` 生效、`0034` 未至时的读数）。

**⇒ 在派单「零产品改动」口径下，`s3-01` 行为段 11 红不可消除**（改 `migrations/**` 或 `src/**` 均超口径）。**按【任务 2 兜底】停下报回，方案选项（供 Zang 决策，**本单均未执行**）**：

- **方案 A（推荐 · 最小产品改动）**：新增迁移 `0044_ledger_post_event_hold_family_rebind.sql`，**逐字**重建 `ledger_post_event`，**唯一**差异 = 从 hold 家族列表删除 `,'listing_deposit'`（= **重放 `0020` 的改动到 `0034` 之后的函数体**）。风险：中（函数体须逐字取自 live `pg_get_functiondef` 并 md5 自证，同 `0020` 手法）；影响面：仅恢复 `listing_deposit` 跨账户消耗 legality（与 DL67/DL88 一致）。
- **方案 B（次选 · 只把 `s3-01` ④ 行为段拆出）**：把 `s3-01` 的 ④「行为随之」段迁为**新单**，明确登记其**被产品侧闸阻断**，在本片把该段标 `NOT_MEASURED`（**注意**：这会**放宽**本片判据 ⇒ **须派单方明文授权**，本单**未**做）。
- **方案 C（只读态）**：维持现状（红点保留），把本片标为「**已知产品缺陷 `0040/0043` 之外的 R7-c**」并转 `OPEN-ITEMS`；`s5-01` 单独收绿。

### §2.5 零残留自证（含**序列成本显式登记**）

改后仍**全部通过**（`group='rollback'`，8/8 绿）——本片新增前置 3 行 approved 台账**必逐字节复原**：

| 检查 | 读数 | 含义 |
|---|---|---|
| `ROLLBACK-app_config-identical` | pass | 写键段零外泄 |
| `ROLLBACK-currency-digest-identical` | pass | 3 个 `draft` 币行未落库 |
| `ROLLBACK-ledger-digest-identical` | pass | 分录（0 行）未落库 |
| `ROLLBACK-account-digest-identical` | pass | 余额/冻结未变 |
| `ROLLBACK-status-log-identical` | pass | `currency_status_log` 未增行 |
| **`ROLLBACK-review-log-identical`（本单新增）** | **pass** | **`currency_review_log` 行数/最大 `log_id` 与基线一致（0 行 / `null`）** |
| `ROLLBACK-timestamps-not-advanced` | pass | 时间戳未前移 |
| `ROLLBACK-no-commit` | pass | 走 `ROLLBACK`（无 COMMIT） |

**序列成本（★ `nextval` 不回滚 ⇒ 显式登记，非「残留」）**（现取 `sequence_cost`）：

```json
{"currency_review_log_log_id_seq":{"before":"52","after":"55","delta":3,"inserted_rows_this_run":3},
 "ledger_entry_txid_seq":{"before":"2802","after":"2802","delta":0}}
```

- `currency_review_log_log_id_seq`：本跑 3 次 raw INSERT（三 draft 各 1 行）⇒ 序列 **52 → 55（Δ=3）**，**无行落库**（`ROLLBACK-review-log-identical` 绿）。
- `ledger_entry_txid_seq`：**Δ=0**（本跑下游闸拒 ⇒ 分录未产生）。

---

## §3 两门读数「改前 / 改后」对照

| 门 | 改前 | 改后 | 目标 | 判定 |
|---|---|---|---|---|
| `p8-s5-01-real-chains` | `exit 1 · 67/69`（红 2：`S1.listing_review_log.append_only` · `S1.job_arbitration_log.append_only`） | **`exit 0 · 84/84`**（红 0，分母 69→84 ↑） | 全绿 | ✅ **达成** |
| `p8-s3-01-effective` | `exit 1 · 23/34`（红 11，全 `behavior`） | `exit 1 · 24/35`（红 **仍 11**，分母 34→35 ↑ ⇒ **未放宽/未删断言**） | 全绿 | ⚠️ **未达成 —— 被产品侧闸阻断（§2.4 报回）** |

- `s3-01` 改后红点逐条（与改前**逐字相同**，**未**删/未放宽）：`S4-before-applied-1` · `S4-before-owner-decrease` · `S4-before-pool-increase` · `S4-before-deposit-legs` · `S4-after-applied-1` · `S4-after-owner-decrease` · `S4-after-pool-increase` · `S4-after-deposit-legs` · `S4-two-readings-differ` · `S4-two-readings-computable` · `S4-fail-closed-behavior`。
- `s3-01` **新增**（分母 ↑ +1）：`ROLLBACK-review-log-identical`（**pass**）。
- `s3-01` 新增**非判据**登记（不改红绿）：`out.segment.5_downstream_guard_probe` + 顶层 `defects[0]`（`id=S49-S3-01-DOWNSTREAM-LEDGER-GUARD`）+ 顶层 `sequence_cost`。

---

## §4 判负

### §4.1 `s5-01`：把新增期望项反向拿掉 ⇒ 必红；复原 ⇒ 回绿

- 手法：`node .s49-artifacts/<runid>/negctl.js revert`（仅把两处 expect 的**新增项** `, 'trg_*_no_truncate:34'` 拿掉，回落旧值）⇒ 跑 ⇒ **`exit 1 · 84 · passed 82 · failed 2`**，`failed_ids = [S1.listing_review_log.append_only, S1.job_arbitration_log.append_only]`（**恰为新增期望项**）。
- `node negctl.js restore` ⇒ 跑 ⇒ **`exit 0 · 84/84`**。
- 收尾核对：复原后 `diff -q <备份(前推版)> scripts/p8-s5-01-real-chains.ts` = **IDENTICAL**（`negctl` 曾误改两行「旧值留痕」注释文本，已修回，见 §6.3）。
- 逐字读数：`.s49-artifacts/<runid>/{negctl-s5-01.stdout, restored-s5-01.stdout}`。

### §4.2 `s3-01`：判负不可达成（原因见 §2.4）

- 改后红点**逐字保留**（§3 列出）；本单**未**放宽判据、**未**删断言、**未**为凑绿改动任何 `expect`。
- 反向自证（**已做**）：把「已通过审核台账」这一步前置**去掉**（即改前态）⇒ `applied=0`（11 红）；**加上** ⇒ `applied` 仍被下游闸拒（11 红）——**两态红数相同**，证明红点**不**由探针前置决定，而由**产品侧闸**决定（这正是本单报回的依据）。

---

## §5 `NOT_MEASURED`（数不出来就写 `NOT_MEASURED`，不估）

| 项 | 原因 |
|---|---|
| `s3-01` ④ 行为段「上市的 `listing_deposit` 消耗额」的**真值读数** | 被**产品侧闸** `HOLD_PAIR_REQUIRED` 阻断（§2.4）⇒ 在零产品改动口径下**不可测** |
| `POST /api/currency/:cid/list` 的 **HTTP 写面**真链路 | 与上同因；且跑真 POST 会永久改线上状态（沿用本片既有 `NOT_MEASURED`） |
| 生产环境该路径是否**曾有**成功上市（真币） | 无写审计/业务痕迹可读（库内 `currency` 无 `is_platform_coin=false` 且带 `listed_at` 的**真**自建币可辨）；未做代码考古 |
| `0034` 回归的**引入时点**（哪次 commit 起 live 被回归） | 本单只做「live ⇄ 迁移文件」现取比对（§2.4 已给 `0034:46/594` vs `0020:54/573`）；**未**做 git blame 逐个提交考古 |
| `s5-01` 除这 2 表外**其余 13 表**「探针是否也应各自断言」 | 本单只把 `0043` 的 15 枚**逐条纳入新只读段的期望**（已 15/15 绿）；是否再逐表加「append_only 集合」检查属**下一片**范围 |

---

## §6 自曝

1. **`s3-01` 未转绿（未达成派单 AC2）**：本单**如实报回**——红点根因是**产品侧** `ledger_post_event` 的 hold 家族回归（`0034` 撤销 `0020`），**非**探针可修。**未**放宽判据 / 未删断言 / 未伪造绿。
2. **探针改动面**：仅 `p8-s5-01-real-chains.ts`、`p8-s3-01-effective.ts`（`git status --porcelain` 两项 `M`；**零** `M` 于 `src/**`/`migrations/**`/`frontend/**`/`docs/*.spec.md`/`docs/OPEN-ITEMS.md`/`docs/seafood.master-plan.md`）。产物目录 `.s49-artifacts/` 与探针自身的 `.p8s5-artifacts/`/`.p8s3-artifacts/` 均在 gitignore 内（`git status` 无 `??`）。
3. **判负自曝（`negctl` 误改注释，已修）**：`negctl.js` 用「子串替换」做前推/复原，**误命中**两处「旧值留痕」注释文本（注释里也含被替换的子串）⇒ 复原后注释一度显示新值。已 `patch` 修回；`diff -q` 与「前推版备份」**逐字节相同**（§4.1）。**教训**：负对照脚本**勿**对「会出现在注释中的字面量」做全局子串替换。
4. **`s5-01` 分母 69→84（+15）**：新增 15 条 `truncateGuard` 检查（`0043` 15 枚逐条）。**未**删任何既有检查（分母**只增不减**）。
5. **throwaway 实验（临时文件，均在产物目录、有意只读或事务内 ROLLBACK）**：`exp-s3-precond.ts`（首版 `LEDGER_AMOUNT_INVALID` 因 idempotency_key 缺前缀、次版定位 C2 审核闸 + HOLD_PAIR_REQUIRED）、`exp-ledger.ts`（逐例独立事务探账本闸，首跑遇 idempotency 前缀闸、改 `biz:` 前缀后取真因）、`roq.cjs`（只读现取）。**均已随产物留存**，**不**影响两探针。
6. **`roq.cjs` 早期排序陷阱**：`ORDER BY balance DESC` 命中 `balance::text` **别名** ⇒ 字典序（`"990" > "1627271"`）。**该行读数作废**（正确 owner = `970001`/`1627271`，与探针 `pickOwner` 一致——其显式限定 `a.balance`，无此陷阱）。已如实登记，非库缺陷。
7. **端口**：本单**未起任何实例**（两探针为一次性进程）。开工后 `lsof` 仅见**既有** `5191/5787/5788/5555`（**非本单**所起，未触碰、未 `pkill`）。无「本单端口待释放」。
8. **未 commit / 未 push / 未 `npm install`**；原始输出未用 `.log`。

---

## §7 产物清单（`backend-ts/.s49-artifacts/s49-20261007T011004Z/`）

- 读数：`before-s5-01.{stdout,stderr}` · `after-s5-01.stdout` · `final-s5-01.{stdout,real-chains.json}` · `after-s5-01.real-chains.json` · `before-s3-01.{stdout,stderr}` · `after-s3-01.{stdout,stderr,effective.json}` · `negctl-s5-01.stdout` · `restored-s5-01.stdout`
- 现场取证（throwaway，事务内/只读）：`exp-s3-precond.{ts,out}` · `exp-ledger.{ts,out}` · `roq.{cjs,out}` · `negctl.js` · `_bk_fwd_s5.ts`
- tsc 口径：`tsc-noemit.txt`（0 行/exit 0）· `tsc-scripts.txt`（**77** 行，与册内基线逐字相符；本两探针 **0** 错）
- 探针自身产物：`.p8s5-artifacts/p8s5-20261007T011856Z/real-chains.json` · `.p8s3-artifacts/p8s3-effective-20261007T012120Z/effective.json`
