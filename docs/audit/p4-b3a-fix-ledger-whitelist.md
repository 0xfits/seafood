# P4-B3a-FIX-A · 账本白名单与 `HOLD_KINDS` 手术

**单号**：Unit P4-B3a-FIX-A（Kong）
**仓库/服务**：`/Users/kevin/bistro/seafood/backend-ts` · `seafood-api` @ `:5788`（面板 sid `seafood-api`）
**run tag**：`b3afix-<YYYYMMDDThhmmss>`（见 §7 产物路径；本报告每节标注产生读数的那一次 run）
**性质**：资金口径面手术 ⇒ **最小 diff + 逐条留痕**。

---

## §0 权威口径（不自行推导，只兑现已冻结裁定）

| 依据 | 原文要点 |
| --- | --- |
| `docs/ledger.spec.md` §3.1 R31（v0.2）| 「保证金」性质被 Kevin 原文推翻 ⇒ **消耗不可退**（`docs/ledger.spec.md:79`：D7 行「保证金『冻结可退』❌ 已于 v0.2 被 Kevin 原文推翻」）|
| `docs/ledger.spec.md:12-13`（v0.3 修订说明）| ① kind 关闭集 21 → 20（删 `listing_deposit_forfeit`；**保证金在上市时即消耗**）|
| `docs/ledger.spec.md:191` | `ledger_post_event` 内联白名单原文注释：`-- v0.2 更正：移除 'listing_deposit_refund'（保证金改为消耗不可退，不存在退还 kind，见 §3.1 R31 / §19.0）` |
| `docs/data-layer.spec.md:454` **DL67**【已冻结】| 上市账务 = `currency_create_fee` + `listing_fee` + `listing_deposit`（**消耗、入 `uid = −1`**，R31）；下架无账务动作 |
| `docs/data-layer.spec.md:530` **DL88**【已冻结】| `listing_deposit` 语义：**上市即消耗**（`balance → uid −1`）、**不可退、无罚没、无退还 kind** |
| `docs/data-layer.spec.md:533` **DL91**【已冻结/待裁登记】| `hold_forfeit` 在 P3 不启用（与本次无关，仅证明「罚没」路径已冻结为不启用）|
| `src/ledger.ts:148-150` 注释 / `migrations/0003_kind_close_set_20.sql:5-8` 注释 | P1c 裁定原文：保证金在上市时即消耗、进平台收入 `uid=-1` |

**⇒ 目标态（唯一正确形态）**：`listing_deposit` = **普通消耗型 kind**（不属 hold 家族，不产生 `frozen_delta`），其去向为平台收入账户 `uid = -1`。

---

## §1 改前 vs 目标（并列；真名与真内容**现取**，未假设常量名）

### 1.1 TS 侧：`HOLD_KINDS`（**真名** = `HOLD_KINDS`，无别名）

| | 内容 |
| --- | --- |
| 位置 | `backend-ts/src/ledger.ts:173-175` |
| 改前（实测 grep 读数）| `export const HOLD_KINDS: LedgerKind[] = ['hold', 'hold_release', 'job_escrow', 'job_escrow_refund',`<br>`  'listing_deposit'];` |
| 问题 | `listing_deposit` 被当作「冻结可退」hold 家族成员 ⇒ 与 R31 / DL67 / DL88 **直接冲突**；`database.ts:1391` 亦按「`HOLD_KINDS` 内 ⇒ 2 条 `delta=-d` / `frozen_delta=+d`」实现上市入账 ⇒ 行为面把保证金记成**在冻** |
| 目标 | 5 → 4 项：`['hold', 'hold_release', 'job_escrow', 'job_escrow_refund']`（**仅删 `listing_deposit` 一项**；不改其它任何 kind）|

### 1.2 TS 侧：`-1` credit 白名单（**真名** = `PLATFORM_KIND_WHITELIST`，`:532`；目标格 = 键 `'-1'`，`:541`）

| | 内容 |
| --- | --- |
| 位置 | `backend-ts/src/ledger.ts:541`（表定义 `:532-546`；判定器 `assertPlatformAccountMutation` `:548-558`）|
| 改前（实测）| `'-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee'], debit: [] },` |
| 问题 | `-1` 的 credit **不含 `listing_deposit`** ⇒ 「消耗入 `-1`」在 TS 前置校验即被 `LEDGER_RESERVED_UID` 拒 ⇒ DL67/DL88 的分支**不可实现** |
| 目标 | `'-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit'], debit: [] },`（**只加一项**；`debit` 仍恒空；不改 `0`/`-2`/`-3` 三格）|

### 1.3 DB 侧：`-1` credit 白名单（**真身 = 函数 `ledger_assert_platform_mutation`**）

| | 内容 |
| --- | --- |
| 权威文件行 | `backend-ts/migrations/0008_platform_revenue_job_fee.sql:49`：`WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee')` |
| 库内真身（**实测** `pg_get_functiondef`）| `backend-ts/.p4-artifacts/b3afix-20260930T014132/b3afix-00-probe.json` → `fn_def.rows[0].def`，`-1` 格逐字同上（**不含 `listing_deposit`**）|
| 改前行为（**实测**）| 直调 `SELECT ledger_assert_platform_mutation(-1::bigint,'listing_deposit','credit')` ⇒ **拒**：`{"ok":false,"error":"LEDGER_RESERVED_UID","code":"LD021"}`（同产物 `probe_neg_listing_deposit_credit`）|
| 目标 | 由**新迁移 `0019`** 以 `CREATE OR REPLACE FUNCTION` **加法式**扩展同一格（照 `0008` 先例），其余每一格逐字不变 |

### 1.4 DB 侧：kind 关闭集（**真身 = CHECK 约束 `ledger_kind_enum`**，非 enum 类型）

| | 内容 |
| --- | --- |
| 改前（**实测** `pg_get_constraintdef`）| 20 值数组，含 `'listing_deposit'`；`b3afix-00-probe.json` → `kind_check.rows[0].def` |
| 目标 | **不动**（20 值、逐字不变；本单**不新增/不删除 kind**）|
| 迁移注册表 | 改前（**实测**）`schema_migration` 行数 = **17** ⇒ 新迁移应用后应为 **18** |

---

## §2 `src/ledger.ts` 手术（只此两处，diff 摘录）

**改动 A（`HOLD_KINDS`，现 `src/ledger.ts:173-178`）**

```diff
-/** §4.2 三态记账：hold 家族（同账户搬运，必须是 2 条分录）〔P1c：移除已删的 `listing_deposit_refund`〕 */
-export const HOLD_KINDS: LedgerKind[] = ['hold', 'hold_release', 'job_escrow', 'job_escrow_refund',
-  'listing_deposit'];
+/** §4.2 …〔P1c：移除已删的 `listing_deposit_refund`〕
+ *  〔P4-B3a-FIX-A：**移除 `listing_deposit`** —— 依据 `ledger.spec` R31（v0.2）/ DL67 / DL88（均【已冻结】）：…〕 */
+export const HOLD_KINDS: LedgerKind[] = ['hold', 'hold_release', 'job_escrow', 'job_escrow_refund'];
```

**改动 B（`PLATFORM_KIND_WHITELIST['-1']`，现 `src/ledger.ts:541-547`）**

```diff
-  '-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee'], debit: [] },
+  // 🆕 P4-B3a-FIX-A（R31 v0.2 / DL67 / DL88，均【已冻结】）：`-1` 的 credit 增加 `listing_deposit` …
+  '-1': { credit: ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit'], debit: [] },
```

**读数（实测）**

| 项 | 读数 | 支撑 |
| --- | --- | --- |
| `HOLD_KINDS` 现值 | `['hold','hold_release','job_escrow','job_escrow_refund']`（4 项，**不含** `listing_deposit`）| `grep -n -A6 "export const HOLD_KINDS" src/ledger.ts` → `178:export const HOLD_KINDS: LedgerKind[] = [...]` |
| 其它白名单未动 | `FROZEN_SETTLE_KINDS`（`:181-183`）、`SETTLE_PAYEE_KIND`、`-2` / `-3` / `0` 三格逐字未改 | 上 diff 仅两处 hunk |
| `LEDGER_KINDS` 关闭集 | **20 个**，顺序与 DB CHECK 逐项一致 | `node` 解析 `src/ledger.ts` → `LEDGER_KINDS n=20`（逐项见 §5 ④）|
| 类型检查 | **`tsc --noEmit` exit 0，`error TS` 计数 = 0** | `npx tsc --noEmit -p tsconfig.json`；日志 `.p4-artifacts/.tsc-b3afix.log`（0 行）|

---

## §3 `migrations/0019_listing_deposit_platform_credit.sql`（加法式白名单扩展）

**文件**：`backend-ts/migrations/0019_listing_deposit_platform_credit.sql`（新建，8760 字节应用体）
**checksum（migrate.ts 登记的前 12 位）**：`48a9a4e2d506`

| 要求 | 落点（逐条）|
| --- | --- |
| 权威口径写清、不自行推导 | 文件头 1–27 行：列 `ledger.spec` R31（v0.2）/ v0.3 修订（`:12-13`）/ `:191`、`data-layer.spec` DL67（`:454`）/ DL88（`:530`）【已冻结】，并注明「只兑现已冻结的裁定」|
| 照 `0008` 先例做加法式扩展 | `CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(...)`（`0008:38-61` 同构）；**只有 `-1` 的 credit 一格**加了 `'listing_deposit'`（`migrations/0019:60`），`0`/`-2`/`-3`/ELSE 兜底逐字不变；`-1` 的 `debit` 仍 `false` |
| 不新增/删除 kind | 本文件**不含**任何 kind 集合变更；未触碰 `ledger_kind_enum`；仅断言它**仍覆盖 20 个 kind**（`strpos` 逐值比对，`0019:150-166`）|
| 不动其它白名单 | 未触碰 `0001`–`0018` 任何字节（`0008` 的文件头纪律：改旧文件 ⇒ checksum 漂移 ⇒ 整链 ABORT/exit 3）|
| 自检**双向** | 正向 9 例（含本次新增格 + 既有 `trade_fee`/`listing_fee`/`currency_create_fee`/`job_fee` 未丢）；负向 7 例（`commission`/`purchase` 贷 `-1` 拒、`-1` 的 `listing_deposit`/`trade_fee` 借拒、`-2`/`-3` 贷 `listing_deposit` 拒、`-2` 贷 `trade_fee` 拒）|
| 幂等 / 可重入 | `CREATE OR REPLACE FUNCTION` + 纯只读 `DO` 断言；**实测**：把本文件原文经 Pool 简单查询通道**重放一次** ⇒ `re-applied OK (8760 bytes, 无报错)` |
| 禁 `DELETE`/`TRUNCATE`/`DROP` 业务数据 | 文件中无这三者对任何业务对象的使用（唯一 `DROP` 相关词仅为注释中的「不得」表述）|

---

## §4 应用迁移与注册表读数（`scripts/migrate.ts`）

| 项 | 改前（实测）| 改后（实测）|
| --- | --- | --- |
| `schema_migration` 行数 | **17** | **18** |
| 末行 | `0017_platform_config.sql` | `0019_listing_deposit_platform_credit.sql` |
| `applied_at`（末行）| — | **`2026-09-29 17:43:01.760888+00`** |
| 本次 `applied_now` | — | `[{"version":"0019","name":"…","action":"applied","checksum":"48a9a4e2d506","ms":…}]`，`ok: true`，`schema_version: "0019"`（exit 0）|

支撑：`.p4-artifacts/b3afix-20260930T014132/migrate-run.log`；重放取数 `b3afix-01-verify.json` → `steps.registry_count_and_0019`。

---

## §5 验证（逐条，禁推断）

| # | 判据 | 结论 | 实测读数（支撑）|
| --- | --- | --- | --- |
| ① | **正向**：`listing_deposit` 贷 `-1` 成功（分录落表 + 余额方向）| ⚠️ **未达成 —— 被第二处 DB 闸拦下（见 §5.1 阻塞）** | 事件 `cli:p4b3afix:<run>:pos:listing_deposit_to_platform` ⇒ `LEDGER_AMOUNT_INVALID` / `details = {cid:"1", uid:"970001", kind:"listing_deposit", field:"entries", reason:"HOLD_PAIR_REQUIRED"}`；`ledger_entry` 增量 = 0，`-1` 余额不变 |
| ①′ | 「贷 `-1`」的**白名单闸本身**已放行（TS + DB 双层）| ✅ | `ts_assert_platform_pos_listing_deposit_credit` = no-throw；`db_fn_pos_listing_deposit_credit` = no-throw（`SELECT ledger_assert_platform_mutation(-1,'listing_deposit','credit')`）|
| ② | **负对照**：不在白名单的 kind 贷 `-1` **仍拒** | ✅ 三层同时拒 | TS：`assertPlatformAccountMutation(-1,'commission','credit')` ⇒ `LEDGER_RESERVED_UID`；DB：同形状 ⇒ `LD021`；**真事件** `…:neg:commission_to_platform` ⇒ `LEDGER_RESERVED_UID`，且该键落 `ledger_entry` 行数 = **0**；`-1` 的 `listing_deposit` **借**方也仍拒（`PLATFORM_DEBIT_FORBIDDEN`）⇒ CHECK **未**被放宽为 `TRUE` |
| ③ | `HOLD_KINDS` 已不含 `listing_deposit`；`tsc --noEmit = 0` | ✅ | 见 §2 表（grep `src/ledger.ts:178`；`tsc_exit=0`、`error TS`=0）|
| ④ | kind 关闭集仍 **20**（DB CHECK 文本 + TS 逐项）| ✅ | DB：`pg_get_constraintdef` → `CHECK ((kind = ANY (ARRAY[…20× '::text'…])))`，`::text` 计数 = **20**；TS：`LEDGER_KINDS n=20` = `mint,burn,transfer,hold,hold_release,hold_forfeit,job_escrow,job_escrow_refund,job_payout,job_fee,commission,purchase,sale,purchase_refund,trade,trade_fee,listing_fee,listing_deposit,currency_create_fee,reversal`（与 DB 顺序一致）|
| ⑤ | 注册表 `schema_migration` = **18** | ✅ | §4（含 `applied_at`）|
| ⑥ | 非资金面回归 | ✅ | `/health` **200**（重启前/后各 1 次）；`/api/home` **200**（前/后）；`410` 面 **6/6 仍 410**：`POST /api/auth/register`、`/api/shard/redeem`、`/api/chest/1/open`、`/api/admin/settings/reset`、`/api/admin/task/create`、`/api/admin/task/update`（`http-410-probe.txt` + restart-http 日志）|
| ⑦ | 产物内 `grep -c 'e[y]J'` = **0** | ✅ | 5 个产物文件全部 0（`probe-run.log` / `migrate-run.log` / `b3afix-00-probe.json` / `b3afix-01-verify.json` / `verify-run.log`）|
| 增 | 附证：同账户 `delta/frozen` 两腿的 `listing_deposit` **仍可入账** | ✅（记录用）| 键 `…:pos:listing_deposit_same_account_pair` ⇒ **成功**，`txid=26`、2 条分录；user `(970001, cid 1)` `balance 1992800 → 1992799`、`frozen 4000 → 4001`；Σ(balance+frozen) 恒 `2000000`（不变）|

**Σ(balance+frozen) 对拍**：事件前后 `2000000` → `2000000`（相等）；`ledger_entry` 行数 `18 → 20`（仅上面那一例成功的同账户对照事件贡献 2 条；正向/负对照两例**零残留**）。

### §5.1 ⚠️ 阻塞（必须由上级裁定，不在本单可写面内）

**现象（实测）**：兑现 R31/DL67/DL88 所要求的「`listing_deposit` **消耗**入 `-1`」事件形状 ——
`entries:[{uid:U, cid:C, delta:-A, kind:'listing_deposit'}, {uid:-1, cid:C, delta:+A, kind:'listing_deposit'}]` ——
被 DB 侧**第二处 hold 家族白名单**拒绝：`LEDGER_AMOUNT_INVALID` / `reason=HOLD_PAIR_REQUIRED`。

**真身（实测 `pg_get_functiondef('ledger_post_event')`，def 第 525 行 / 函数体共 977 行）**：

```sql
WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')
```

该列表位于 `ledger_post_event` 的 `op = 'entries'` 分支，语义 = 「这些 kind 的**每个 (uid,cid,kind) 分组必须恰好 2 条**（同账户搬运）」⇒ 与「跨账户消耗入 `-1`」**互斥**。
源码侧同名副本（**只读取证，未改**）：`migrations/0004_ledger_post_event.sql:878`、`migrations/0005_ledger_event_root_key.sql:1010`、`migrations/0012_replay_pre_gate_before_balance_gate.sql:595`。

**为什么本单没有动它**：
1. 本单硬边界 = 只写 `src/ledger.ts`（两处）+ 新建 `0019`（**加法式**扩展 `-1` credit 白名单）+ 报告/产物；明令「**其它白名单一律不动**」。
2. 该闸在 `ledger_post_event` **函数体内**；`migrations/0008_platform_revenue_job_fee.sql:29` 记载的**既有裁定 #14 明令禁止触碰该函数体**；且 `0001`–`0018` 为冻结文件（改则 checksum 漂移 ⇒ 整链 ABORT/exit 3）。
3. 这不是「白名单放宽」而是**行为语义变更**（会让 `listing_deposit` 从「在冻可退」彻底变为「普通消耗」）⇒ 影响 `database.ts:1382-1460`（上市入账形状）与前端/接口面，属**新裁定、新单**。

**最小补救（供裁定后立即执行，一行 diff）**：新建 `0020_*.sql` 以 `CREATE OR REPLACE FUNCTION ledger_post_event(jsonb)` **原样整体复制**live 函数体，**仅**把上述 IN 列表中的 `'listing_deposit'` 删去（其余每一个字符不变）；配套把 `database.ts` 上市入账改为「user `delta=-d` + `-1` `delta=+d`，同为 `listing_deposit`」并跑正/负对照重验。
**在此之前**，本单已交付的部分（TS `HOLD_KINDS` 修正 + `-1` credit 白名单双层放行）是**必要但非充分**条件：它解开了「白名单闸」，但「入账形状闸」仍在 ⇒ **DL67/DL88 的消耗路径尚不可端到端走通**（如实登记，未把代码推断写成实测）。

---

## §6 服务重启与业务面复核

| 步骤 | 读数 |
| --- | --- |
| 面板重启 | `POST http://127.0.0.1:5555/api/restart` `{"sid":"seafood-api"}` ⇒ **200** `{"sid":"seafood-api","ok":true,"state":"running","pid":6569,"msg":"已启动"}`（**未**使用 `pkill`/`killall`）|
| 重启后 `/health` | **200**（等待 1237 ms）|
| 真 token 来源 | `backend-ts/.env.local` 的 `SECRET_KEY` 经 `src/auth.createSessionToken` 真签名（旧兜底常量未使用）；产物只落指纹 `sha256 前 12 位 = 938ce397ca14`，长度 193 |
| 业务端点（真 token）| `GET /api/user/asset/970001` **200**（`points: 1992799`）；`GET /api/shard` **200**；`GET /api/order` **200**；`GET /api/admin/me` **200** |
| 重启前/后 `410` 面 | **410**（前后各一次，未回退为 200）|

服务最终状态：**running**（`/health` 200，业务端点 200）——未留在起不来的状态。

---

## §7 产物（run-tagged · 绝对路径）

**run tag**：`b3afix-20260930T014132`
**目录**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3afix-20260930T014132/`

| 文件 | 内容 |
| --- | --- |
| `b3afix-00-probe.json` | 改前取证：注册表 17、`fn_def`（`-1` credit 真身）、`ledger_kind_enum` CHECK 文本、`-1` 贷 `listing_deposit` 被拒（LD021）|
| `probe-run.log` | 上者运行日志（含 4 条 `listing_deposit` 历史行读数）|
| `migrate-run.log` | `scripts/migrate.ts` 全量读数（17 个 skipped + `0019 applied`，`schema_version 0019`）|
| `b3afix-01-verify.json` / `verify-run.log` | §5 全部正/负对照 + TS/DB 断言 + 幂等重放 + live 函数体取证 |
| `b3afix-02-http.json` / `restart-http.log` | 重启前后 HTTP 面 + 面板重启读数 + 真 token 业务端点 |
| `http-410-probe.txt` | 5 个 `410` 写面的独立复验 |
| 脚本（`backend-ts/scripts/`）| `p4z-b3afix-00-probe.ts`、`p4z-b3afix-01-verify.ts`、`p4z-b3afix-02-restart-http.ts` |
| 类型检查日志 | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/.tsc-b3afix.log`（0 行 = 无错）|

**测试夹具**：idempotency key 一律 `cli:p4b3afix:<run>:…`（`cli:` 为 `src/ledger.ts:407` 允许前缀之一）；探针首轮用 `p4b3afix:` 前缀被 `LEDGER_IDEMPOTENCY_KEY_INVALID/PREFIX_REQUIRED` 拒 ⇒ 已按 §5.7④「先怀疑自己的探针」修正前缀后重跑。已落表夹具：`txid=26`（同账户对照事件，2 条分录）、`-1` 侧零残留。
