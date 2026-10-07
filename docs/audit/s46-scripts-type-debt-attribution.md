# S46 · `scripts/**` 存量类型债「基线被推高」归因报告

> **单号**：S46（路线图 R3） · **角色**：Kong · **性质**：**严格只读归因单（零文件改动）**
> **现取时间**：2026-10-07（CST）· **runid**：`s46-20261007T002904Z` · **产物**：`backend-ts/.s46-artifacts/s46-20261007T002904Z/`

---

## §0 对锚（动笔前后一致）

| 项 | 命令 | 读数 |
|---|---|---|
| HEAD | `git log --oneline -3` | `7d530ea` (docs §5.373 派 S46) ← `0c245d3` ← `636b15b` |
| 工作树 | `git status --porcelain` | **空**（动笔前脏 0 / untracked 0） |
| 本机时间 | `date` | Wed Oct  7 08:27:15 CST 2026 |
| tsconfig 面 | `git diff 39d89b3 HEAD -- backend-ts/tsconfig.scripts.json` | **空（逐字节相同）⇒ 口径可与基线 apples-to-apples 对比** |
| tsconfig 面 | `git diff 39d89b3 HEAD -- backend-ts/tsconfig.json` | **空（逐字节相同）** |

**基线锚 rev = `39d89b3`（2026-10-02，`feat(b7): 退款单收口`）** —— 其提交信息逐字含「**tsc 79/24->77/22 零新增**」⇒ 该 rev 即册内 §13.3「22 文件 / 77 条」的**同源时点**。

**复现命令（逐字 · 本单亲跑）**：
```
cd backend-ts && npx tsc -p tsconfig.scripts.json --noEmit
```
现取 **退出码 2 / 96 条**（§1）。基线复现 = `git archive 39d89b3 backend-ts | tar -x -C /tmp/s46/base` + 链 `node_modules` ⇒ **77 条 / 22 文件**（§2）。

---

## §1 现取 96 条清单与逐文件计数

**总数 96 · 涉及 30 文件 · 错码分布 13 种**。

### 1.1 错码分布（现取 vs 基线）

| 错码 | 现取 | 基线 | Δ |
|---|---:|---:|---:|
| `TS2339` | 24 | 21 | +3 |
| `TS18046` | 21 | 16 | +5 |
| `TS2322` | 18 | 15 | +3 |
| `TS2345` | 12 | 4 | +8 |
| `TS2352` | 11 | 11 | +0 |
| `TS18047` | 2 | 2 | +0 |
| `TS2367` | 2 | 2 | +0 |
| `TS2353` | 1 | 1 | +0 |
| `TS2362` | 1 | 1 | +0 |
| `TS2363` | 1 | 1 | +0 |
| `TS2551` | 1 | 1 | +0 |
| `TS2559` | 1 | 1 | +0 |
| `TS2724` | 1 | 1 | +0 |
| **合计** | **96** | **77** | **+19** |

> **口径更正**：派单给出的 8 码分布（`TS2339 24 / TS18046 21 / TS2322 18 / TS2345 12 / TS2352 11 / TS2367 2 / TS18047 2 / TS2724 1`）**合计 = 91，非 96** —— 它**漏列 5 码**：`TS2559 1 / TS2551 1 / TS2362 1 / TS2363 1 / TS2353 1`。这 5 码**基线里也在**（各 1 条），属**既有债**、非新增。本表为完整现取。

### 1.2 逐文件计数表（30 文件 · Σ=96）

| # | 文件 | 现取 | 基线 | Δ | 备注 |
|--:|---|---:|---:|---:|---|
| 1 | `scripts/p1f-02-f2-malformed.ts` | 1 | 1 | +0 | — |
| 2 | `scripts/p2x-00-idempotency-replay-order.ts` | 1 | 1 | +0 | — |
| 3 | `scripts/p3l-00-post.ts` | 1 | 1 | +0 | — |
| 4 | `scripts/p3s1-00-db-state.ts` | 1 | 1 | +0 | — |
| 5 | `scripts/p3w-00-fold-narrow-verify.ts` | 1 | 1 | +0 | — |
| 6 | `scripts/p4z-03-keys.ts` | 1 | 1 | +0 | — |
| 7 | `scripts/p4z-05-keys-b1c.ts` | 4 | 4 | +0 | — |
| 8 | `scripts/p4z-08-keys-b1d.ts` | 6 | 6 | +0 | — |
| 9 | `scripts/p4z-a1cap-01-e2e.ts` | 3 | 3 | +0 | — |
| 10 | `scripts/p4z-a1li-01-e2e.ts` | 3 | 3 | +0 | — |
| 11 | `scripts/p4z-audjk-01-probe.ts` | 24 | 24 | +0 | — |
| 12 | `scripts/p4z-b2a-01-fixture.ts` | 2 | 2 | +0 | — |
| 13 | `scripts/p4z-b2ahttp-03-e2e.ts` | 11 | 11 | +0 | — |
| 14 | `scripts/p4z-b2b-01-patch.ts` | 3 | 3 | +0 | — |
| 15 | `scripts/p4z-b2b-02-listing.ts` | 2 | 2 | +0 | — |
| 16 | `scripts/p4z-b2c-02-probe.ts` | 3 | 3 | +0 | — |
| 17 | `scripts/p4z-b3c-02-e2e.ts` | 1 | 1 | +0 | — |
| 18 | `scripts/p4z-d1p-01-classifier-unit.ts` | 2 | 2 | +0 | — |
| 19 | `scripts/p4z-d1p-04-sweep-negative-arm.ts` | 1 | 1 | +0 | — |
| 20 | `scripts/p8-s10-invite-reward-gate.ts` | 9 | 0 | +9 | **新文件（基线不存在）** |
| 21 | `scripts/p8-s11-audit-console-gate.ts` | 1 | 0 | +1 | **新文件（基线不存在）** |
| 22 | `scripts/p8-s3-01-effective.ts` | 1 | 0 | +1 | **新文件（基线不存在）** |
| 23 | `scripts/p8-s4-01-effective.ts` | 2 | 0 | +2 | **新文件（基线不存在）** |
| 24 | `scripts/p8-s4-currency-review-gate.ts` | 2 | 0 | +2 | **新文件（基线不存在）** |
| 25 | `scripts/p8-s5-01-real-chains.ts` | 2 | 0 | +2 | **新文件（基线不存在）** |
| 26 | `scripts/p8-s6-site-text-gate.ts` | 1 | 0 | +1 | **新文件（基线不存在）** |
| 27 | `scripts/p8-s7-batt-checkin-gate.ts` | 1 | 0 | +1 | **新文件（基线不存在）** |
| 28 | `scripts/qa-p1b-01-setup.ts` | 1 | 1 | +0 | — |
| 29 | `scripts/qa-p1e-01-concurrency.ts` | 4 | 4 | +0 | — |
| 30 | `scripts/qa-p1e-05-neon-ab.ts` | 1 | 1 | +0 | — |
| | **Σ** | **96** | **77** | **+19** | |

### 1.3 96 条逐条清单（文件:行:错码 + 首行摘要）

> 完整结构化 JSON = 产物 `errors-now-96.json`（含 `col` 与 `msg` 全文）。下表为逐条（按文件、行号升序）。
**`scripts/p1f-02-f2-malformed.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 171:23 | `TS2352` | Conversion of type '{ readonly LEDGER_INSUFFICIENT_BALANCE: { readonly status: 409; readonly message: "Availab |

**`scripts/p2x-00-idempotency-replay-order.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 106:70 | `TS2339` | Property 'uid_source' does not exist on type '{ ok: true; } & UidWindow'. |

**`scripts/p3l-00-post.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 62:81 | `TS2345` | Argument of type 'unknown' is not assignable to parameter of type 'string'. |

**`scripts/p3s1-00-db-state.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 30:21 | `TS18046` | 'out.tables' is of type 'unknown'. |

**`scripts/p3w-00-fold-narrow-verify.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 115:95 | `TS2559` | Type '"THREW"' has no properties in common with type 'PropertyDescriptor'. |

**`scripts/p4z-03-keys.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 39:42 | `TS2551` | Property 'normalizeUser' does not exist on type '{ normalizeAsset: any; normalizeTask: any; normalizeBrand: an |

**`scripts/p4z-05-keys-b1c.ts`** （4 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 122:22 | `TS2352` | Conversion of type 'BrandRecord' to type 'Record<string, unknown>' may be a mistake because neither type suffi |
| 123:23 | `TS2352` | Conversion of type 'BrandRecord' to type 'Record<string, unknown>' may be a mistake because neither type suffi |
| 130:22 | `TS2352` | Conversion of type 'PrizeItemRecord' to type 'Record<string, unknown>' may be a mistake because neither type s |
| 131:23 | `TS2352` | Conversion of type 'PrizeItemRecord' to type 'Record<string, unknown>' may be a mistake because neither type s |

**`scripts/p4z-08-keys-b1d.ts`** （6 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 69:32 | `TS2352` | Conversion of type '(row: RawRow, brand?: BrandRecord \| null) => MarketOrderRecord' to type 'Mapper' may be a |
| 69:69 | `TS2352` | Conversion of type '(row: RawRow, brand?: BrandRecord \| null) => MarketOrderRecord' to type 'Mapper' may be a |
| 72:32 | `TS2352` | Conversion of type '(row: RawRow, brand?: BrandRecord \| null) => MarketTradeRecord' to type 'Mapper' may be a |
| 72:69 | `TS2352` | Conversion of type '(row: RawRow, brand?: BrandRecord \| null) => MarketTradeRecord' to type 'Mapper' may be a |
| 75:30 | `TS2352` | Conversion of type '(row: RawRow) => MarketOrderBookRow' to type 'Mapper' may be a mistake because neither typ |
| 75:68 | `TS2352` | Conversion of type '(row: RawRow) => MarketOrderBookRow' to type 'Mapper' may be a mistake because neither typ |

**`scripts/p4z-a1cap-01-e2e.ts`** （3 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 220:84 | `TS18046` | 'out.regression' is of type 'unknown'. |
| 220:147 | `TS18046` | 'out.regression' is of type 'unknown'. |
| 220:182 | `TS18046` | 'out.regression' is of type 'unknown'. |

**`scripts/p4z-a1li-01-e2e.ts`** （3 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 246:100 | `TS18046` | 'out.regression' is of type 'unknown'. |
| 246:163 | `TS18046` | 'out.regression' is of type 'unknown'. |
| 246:198 | `TS18046` | 'out.regression' is of type 'unknown'. |

**`scripts/p4z-audjk-01-probe.ts`** （24 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 192:16 | `TS2339` | Property 'job_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 192:30 | `TS2339` | Property 'job_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 193:16 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 193:30 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 194:16 | `TS2339` | Property 'sub_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 194:30 | `TS2339` | Property 'sub_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 195:30 | `TS2339` | Property 'sub_derived_p4b2a' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string;  |
| 195:52 | `TS2339` | Property 'sub_derived_p4b2a' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string;  |
| 196:25 | `TS2339` | Property 'ledger_entry_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; |
| 196:48 | `TS2339` | Property 'ledger_entry_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; |
| 197:23 | `TS2362` | The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type. |
| 197:23 | `TS18047` | 'a.account_rows' is possibly 'null'. |
| 197:40 | `TS2363` | The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type. |
| 197:40 | `TS18047` | 'b.account_rows' is possibly 'null'. |
| 199:30 | `TS2339` | Property 'job_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 199:48 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 199:66 | `TS2339` | Property 'sub_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 199:98 | `TS2339` | Property 'sub_derived_p4b2a' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string;  |
| 232:20 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 232:34 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 232:66 | `TS2339` | Property 'app_fixture' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; accoun |
| 232:82 | `TS2339` | Property 'app_fixture' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; accoun |
| 234:107 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |
| 234:121 | `TS2339` | Property 'app_total' does not exist on type '{ account_rows: {} \| null; account_sum_balance: string; account_ |

**`scripts/p4z-b2a-01-fixture.ts`** （2 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 125:9 | `TS18046` | 'ledger.created' is of type 'unknown'. |
| 144:5 | `TS18046` | 'ledger.created' is of type 'unknown'. |

**`scripts/p4z-b2ahttp-03-e2e.ts`** （11 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 29:16 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 30:14 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 31:26 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 32:25 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 33:18 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 34:23 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 35:19 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 36:18 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 37:24 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 38:23 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |
| 39:23 | `TS2322` | Type 'NeonQueryPromise<false, false, Record<string, any>[]>' is not assignable to type 'Promise<{ c: number; } |

**`scripts/p4z-b2b-01-patch.ts`** （3 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 48:1 | `TS18046` | 'log.steps' is of type 'unknown'. |
| 65:1 | `TS18046` | 'log.steps' is of type 'unknown'. |
| 108:1 | `TS18046` | 'log.steps' is of type 'unknown'. |

**`scripts/p4z-b2b-02-listing.ts`** （2 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 123:38 | `TS18046` | 'out.schema_assertions' is of type 'unknown'. |
| 134:7 | `TS18046` | 'ledger.created' is of type 'unknown'. |

**`scripts/p4z-b2c-02-probe.ts`** （3 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 221:33 | `TS2345` | Argument of type 'NeonQueryFunction<false, false>' is not assignable to parameter of type 'NeonQueryFunction<b |
| 224:41 | `TS2345` | Argument of type 'NeonQueryFunction<false, false>' is not assignable to parameter of type 'NeonQueryFunction<b |
| 230:33 | `TS2345` | Argument of type 'NeonQueryFunction<false, false>' is not assignable to parameter of type 'NeonQueryFunction<b |

**`scripts/p4z-b3c-02-e2e.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 277:52 | `TS18046` | 'results.J1_A' is of type 'unknown'. |

**`scripts/p4z-d1p-01-classifier-unit.ts`** （2 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 171:64 | `TS2367` | This comparison appears to be unintentional because the types '503' and '401' have no overlap. |
| 172:70 | `TS2367` | This comparison appears to be unintentional because the types '503' and '401' have no overlap. |

**`scripts/p4z-d1p-04-sweep-negative-arm.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 75:35 | `TS2353` | Object literal may only specify known properties, and 'code' does not exist in type '{ status: string \| numbe |

**`scripts/p8-s10-invite-reward-gate.ts`** （9 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 165:22 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:37 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:53 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:68 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:84 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:99 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:115 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 165:130 | `TS2345` | Argument of type 'string \| null' is not assignable to parameter of type 'string \| number'. |
| 312:5 | `TS2322` | Type 'number' is not assignable to type 'void'. |

**`scripts/p8-s11-audit-console-gate.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 461:5 | `TS2322` | Type 'number' is not assignable to type 'void'. |

**`scripts/p8-s3-01-effective.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 199:43 | `TS18046` | 'baseline.app_config' is of type 'unknown'. |

**`scripts/p8-s4-01-effective.ts`** （2 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 113:7 | `TS18046` | 'summary.fixture' is of type 'unknown'. |
| 114:7 | `TS18046` | 'summary.fixture' is of type 'unknown'. |

**`scripts/p8-s4-currency-review-gate.ts`** （2 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 211:83 | `TS2339` | Property 'err' does not exist on type 'ParsedReview'. |
| 211:100 | `TS2339` | Property 'err' does not exist on type 'ParsedReview'. |

**`scripts/p8-s5-01-real-chains.ts`** （2 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 184:41 | `TS18046` | 'out.migration_assert' is of type 'unknown'. |
| 186:41 | `TS18046` | 'out.migration_assert' is of type 'unknown'. |

**`scripts/p8-s6-site-text-gate.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 273:153 | `TS2339` | Property 'length' does not exist on type '{}'. |

**`scripts/p8-s7-batt-checkin-gate.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 564:5 | `TS2322` | Type 'number' is not assignable to type 'void'. |

**`scripts/qa-p1b-01-setup.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 80:5 | `TS18046` | 'lat.tx_begin_commit_ms' is of type 'unknown'. |

**`scripts/qa-p1e-01-concurrency.ts`** （4 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 97:47 | `TS2322` | Type 'bigint' is not assignable to type 'string \| number'. |
| 160:44 | `TS2322` | Type 'bigint' is not assignable to type 'string \| number'. |
| 160:56 | `TS2322` | Type 'bigint' is not assignable to type 'string \| number'. |
| 160:68 | `TS2322` | Type 'bigint' is not assignable to type 'string \| number'. |

**`scripts/qa-p1e-05-neon-ab.ts`** （1 条）

| 行:列 | 错码 | 摘要 |
|---|---|---|
| 15:10 | `TS2724` | '"./qa-p1e-lib"' has no exported member named 'accountOf'. Did you mean 'accountsOf'? |

---

## §2 与册内登记对账（22 文件 / 77 条）

**册内真源** = `docs/route-layer.spec.md` §13.3（v1.8 · 2026-10-02）+ §7-60（:1895）+ 补注㉙（:1900）。

**★ 关键事实（必须先说）**：册内 **只有计数（22 / 77）+ 两个样本行**，**没有逐文件清单**。§8.20.2-⑤（`route-layer.spec.md:2657`）逐字写着：
> ⑤ **22 文件 / 77 条的「逐条」列名清单** ｜ 本册**现取 = 计数（77 / 22）**（§13.3）；**逐条文件名 × 行号的完整枚举**未在 spec 内贴全 ⇒ **计数已实测、清单枚举 `NOT_MEASURED`**

⇒ **「与册内 22 文件清单逐文件对账」结构上不可得**（册内无清单）。本单**自行重建**该清单（`git archive 39d89b3` + 同命令现跑）作为对账基准。

### 2.1 计数对账（可对）

| 项 | 册内（§13.3） | 本单重建 @39d89b3 | 判 |
|---|---|---|---|
| 报错条数 | 77 | **77** | ✓ 逐字相符 |
| 涉及文件数 | 22 | **22** | ✓ 逐字相符 |

### 2.2 重建的 22 文件基线清单（本单现取 · 册内 `NOT_MEASURED`）

| # | 文件 | 条数 |
|--:|---|---:|
| 1 | `scripts/p1f-02-f2-malformed.ts` | 1 |
| 2 | `scripts/p2x-00-idempotency-replay-order.ts` | 1 |
| 3 | `scripts/p3l-00-post.ts` | 1 |
| 4 | `scripts/p3s1-00-db-state.ts` | 1 |
| 5 | `scripts/p3w-00-fold-narrow-verify.ts` | 1 |
| 6 | `scripts/p4z-03-keys.ts` | 1 |
| 7 | `scripts/p4z-05-keys-b1c.ts` | 4 |
| 8 | `scripts/p4z-08-keys-b1d.ts` | 6 |
| 9 | `scripts/p4z-a1cap-01-e2e.ts` | 3 |
| 10 | `scripts/p4z-a1li-01-e2e.ts` | 3 |
| 11 | `scripts/p4z-audjk-01-probe.ts` | 24 |
| 12 | `scripts/p4z-b2a-01-fixture.ts` | 2 |
| 13 | `scripts/p4z-b2ahttp-03-e2e.ts` | 11 |
| 14 | `scripts/p4z-b2b-01-patch.ts` | 3 |
| 15 | `scripts/p4z-b2b-02-listing.ts` | 2 |
| 16 | `scripts/p4z-b2c-02-probe.ts` | 3 |
| 17 | `scripts/p4z-b3c-02-e2e.ts` | 1 |
| 18 | `scripts/p4z-d1p-01-classifier-unit.ts` | 2 |
| 19 | `scripts/p4z-d1p-04-sweep-negative-arm.ts` | 1 |
| 20 | `scripts/qa-p1b-01-setup.ts` | 1 |
| 21 | `scripts/qa-p1e-01-concurrency.ts` | 4 |
| 22 | `scripts/qa-p1e-05-neon-ab.ts` | 1 |
| | **Σ 22 文件** | **77** |

### 2.3 新增文件 / 计数上升

| 类别 | 结论 |
|---|---|
| **新增了哪些文件**（基线无 → 现有） | **8 个**：`scripts/p8-s10-invite-reward-gate.ts` · `scripts/p8-s11-audit-console-gate.ts` · `scripts/p8-s3-01-effective.ts` · `scripts/p8-s4-01-effective.ts` · `scripts/p8-s4-currency-review-gate.ts` · `scripts/p8-s5-01-real-chains.ts` · `scripts/p8-s6-site-text-gate.ts` · `scripts/p8-s7-batt-checkin-gate.ts` |
| **哪些既有文件计数上升** | **0 个** —— 22 个基线文件计数**逐个不变**（Δ 全 = 0） |
| 哪些文件计数下降 | 0 个 |
| 文件是否被删 | **0 个**（`git diff --name-status 39d89b3 HEAD -- backend-ts/scripts` 无 `D`） |

> ★ **这直接推翻「top 文件即推高源」的直觉**：派单点名的 top 文件 `p4z-audjk-01-probe.ts 24` / `p4z-b2ahttp-03-e2e.ts 11` / `p4z-08-keys-b1d.ts 6` / `qa-p1e-01-concurrency.ts 4` / `p4z-05-keys-b1c.ts 4` **全都已在 77 基线之内**（24→24 / 11→11 / 6→6 / 4→4 / 4→4，Δ=0）。**它们不是推高源**。

---

## §3 推高归因表（逐笔带 rev 与错数差）

### 3.1 方法口径（写死 · 可复算）

1. **不只看总数**：对每一笔触碰 `scripts/**` 的提交，用 **`(文件, 行, 错码)` 多重集差分**（`Counter` 相减，非集合去重）定位「**哪些行的错是新出现的**」。
2. **同文件父子对比**：对每个新增文件，取**引入 rev** 与**父 rev** 各做一次 `git archive <rev> backend-ts | tar -x` + `node_modules` 软链 + **同一条 `npx tsc -p tsconfig.scripts.json --noEmit`** ⇒ 直接读出「**父=该文件不存在（0）→ 本 rev=该文件 N 条**」的差。
3. **逐批递增**：按引入 rev 的**线性祖先序**（`git merge-base --is-ancestor` 逐对验证，7 对全 **ANCESTOR-OK**），逐 rev 现跑总读数 ⇒ 得「**每批恰好加上该批新文件的条数**」。
4. **口径边界**：`tsconfig.scripts.json` / `tsconfig.json` 在锚..HEAD 间**逐字节相同**（§0）⇒ 前后可比。**临时件只写 `/tmp`**，零写仓。

### 3.2 逐笔归因（7 笔 rev · 8 个新文件 · 19 条）

| # | rev | 日期 | 提交 | 新增文件 | 新增错数 | 批前总 | 批后总 | 证据（本单亲跑） |
|--:|---|---|---|---|--:|--:|--:|---|
| 1 | `4333623` | 2026-10-02 | feat(b8-3a) | `p8-s3-01-effective.ts` | +1 | 77 | 78 | `git archive 4333623` 现跑 = **78 条 / 23 文件**；该文件 @本 rev = **1** 条 |
| 2 | `0d86ce5` | 2026-10-03 | feat(b8-4) | `p8-s4-01-effective.ts + p8-s4-currency-review-gate.ts` | +4 | 78 | 82 | `git archive 0d86ce5` 现跑 = **82 条 / 25 文件**；该文件 @本 rev = **4** 条 |
| 3 | `3a36ba5` | 2026-10-03 | feat(b8-5) | `p8-s5-01-real-chains.ts` | +2 | 82 | 84 | `git archive 3a36ba5` 现跑 = **84 条 / 26 文件**；该文件 @本 rev = **2** 条 |
| 4 | `38648c1` | 2026-10-03 | feat(p9-1) | `p8-s6-site-text-gate.ts` | +1 | 84 | 85 | `git archive 38648c1` 现跑 = **85 条 / 27 文件**；该文件 @本 rev = **1** 条 |
| 5 | `4c40b47` | 2026-10-03 | feat(p9-2) | `p8-s7-batt-checkin-gate.ts` | +1 | 85 | 86 | `git archive 4c40b47` 现跑 = **86 条 / 28 文件**；该文件 @本 rev = **1** 条 |
| 6 | `d3ae10d` | 2026-10-03 | feat(p9-5) | `p8-s10-invite-reward-gate.ts` | +9 | 86 | 95 | `git archive d3ae10d` 现跑 = **95 条 / 29 文件**；该文件 @本 rev = **9** 条 |
| 7 | `614ae53` | 2026-10-03 | feat(p8-6) | `p8-s11-audit-console-gate.ts` | +1 | 95 | 96 | `git archive 614ae53` 现跑 = **96 条 / 30 文件**；该文件 @本 rev = **1** 条 |

**对账式**（逐笔相加必须落 96）：

`77(锚 39d89b3)` + `+1(4333623)` + `+4(0d86ce5)` + `+2(3a36ba5)` + `+1(38648c1)` + `+1(4c40b47)` + `+9(d3ae10d)` + `+1(614ae53)` = **96** ✓

**每个新文件「引入时 = 现在」的条数（证明引入后无人再加错）**：

| 文件 | 引入 rev | 引入时条数 | 现在条数 | Δ |
|---|---|--:|--:|--:|
| `scripts/p8-s3-01-effective.ts` | `4333623` | 1 | 1 | +0 |
| `scripts/p8-s4-01-effective.ts` | `0d86ce5` | 2 | 2 | +0 |
| `scripts/p8-s4-currency-review-gate.ts` | `0d86ce5` | 2 | 2 | +0 |
| `scripts/p8-s5-01-real-chains.ts` | `3a36ba5` | 2 | 2 | +0 |
| `scripts/p8-s6-site-text-gate.ts` | `38648c1` | 1 | 1 | +0 |
| `scripts/p8-s7-batt-checkin-gate.ts` | `4c40b47` | 1 | 1 | +0 |
| `scripts/p8-s10-invite-reward-gate.ts` | `d3ae10d` | 9 | 9 | +0 |
| `scripts/p8-s11-audit-console-gate.ts` | `614ae53` | 1 | 1 | +0 |

**★ 归纳（这单的结论一句话）**：

> **19 条的推高** = **8 个在 2026-10-02 之后新加入的 `p8-s*` 门脚本各自「入职即带错」之和**（`p8-s10 9` + `p8-s4-currency 2` + `p8-s4-01 2` + `p8-s5-01 2` + `p8-s3-01 1` + `p8-s6 1` + `p8-s7 1` + `p8-s11 1`）。**22 个基线文件在 159 笔提交（39d89b3..614ae53）× 37 笔触碰 `scripts/**` 期间，错误条数 Δ 全 = 0** ⇒ **对既有脚本的每一次改动都守住了「新增零错」**（§13 纪律），**唯一被违反的面 = 「新增脚本」这一条**。

> **纪律判定**：§13.2-① 要求「**新增零错**」——「新增脚本 / 改动既有脚本」**两路都触发**。8 个新脚本每路都违反（新增 = 带错入职）。⇒ **判负成立**（推高 §13 基线），责任面 = 这 7 笔提交。

### 3.3 被推高面上「谁没越界」（反证 · 防误伤）

`git diff --name-status 39d89b3 HEAD -- backend-ts/scripts` ⇒ **`A` 34 个文件 / `D` 0 个**。即：锚后共**新增 34 个脚本**，其中 **26 个「新增零错」达标**（如 `p8-s1-app-config-gate.ts` / `p8-s2-fee-rebate-gate.ts` / `p8-s8-rating-timeliness-gate.ts` / `s41-00-identity-seq-collision-gate.ts` …），**仅 8 个带错**。⇒ 不得把「新增零错」整体判为失效。

---

## §4 未归因残差

**残差 = 0 条。**

| 项 | 读数 |
|---|---|
| 推高总量 | **+19**（96 − 77） |
| 已归因 | **+19**（§3.2 七笔逐笔相加 = 96） |
| **未归因残差** | **0** |

**逐条核对（(文件,行,错码) 多重集差分）**：现取 96 与基线 77 的差 = **added 19 / removed 0**，追加实现在 `added-19-new-files.json`。**19 条逐条列名 = §1.3 中 8 个 `p8-s*` 文件的全部条目**：

- `scripts/p8-s10-invite-reward-gate.ts:165:22` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:37` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:53` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:68` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:84` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:99` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:115` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:165:130` **TS2345** — Argument of type 'string | null' is not assignable to parameter of type 'string 
- `scripts/p8-s10-invite-reward-gate.ts:312:5` **TS2322** — Type 'number' is not assignable to type 'void'.
- `scripts/p8-s11-audit-console-gate.ts:461:5` **TS2322** — Type 'number' is not assignable to type 'void'.
- `scripts/p8-s3-01-effective.ts:199:43` **TS18046** — 'baseline.app_config' is of type 'unknown'.
- `scripts/p8-s4-01-effective.ts:113:7` **TS18046** — 'summary.fixture' is of type 'unknown'.
- `scripts/p8-s4-01-effective.ts:114:7` **TS18046** — 'summary.fixture' is of type 'unknown'.
- `scripts/p8-s4-currency-review-gate.ts:211:83` **TS2339** — Property 'err' does not exist on type 'ParsedReview'.
- `scripts/p8-s4-currency-review-gate.ts:211:100` **TS2339** — Property 'err' does not exist on type 'ParsedReview'.
- `scripts/p8-s5-01-real-chains.ts:184:41` **TS18046** — 'out.migration_assert' is of type 'unknown'.
- `scripts/p8-s5-01-real-chains.ts:186:41` **TS18046** — 'out.migration_assert' is of type 'unknown'.
- `scripts/p8-s6-site-text-gate.ts:273:153` **TS2339** — Property 'length' does not exist on type '{}'.
- `scripts/p8-s7-batt-checkin-gate.ts:564:5` **TS2322** — Type 'number' is not assignable to type 'void'.

> 说明：基线 22 文件中的 `scripts/p1f-02-f2-malformed.ts:171` 的 **msg 文本**在锚后变过（TS2352 的 `type` 字面量随 33 码闭集改动而变），但 **`(文件,行,错码)` 三元组不变、计数不变** ⇒ **不构成推高、不入残差**。

---

## §5 清债建议（**仅建议 · 本单不实施**）

### 5.1 先清哪三个文件（派单口径：p4z-audjk-01-probe 24）

| 优先 | 文件 | 条数 | 错码构成 | 根因（现取粗判） |
|--:|---|--:|---|---|
| 1 | `scripts/p4z-audjk-01-probe.ts` | 24 | TS2339 ×15 / TS18047 ×2 / TS2362 ×1 / TS2363 ×1 | `out.*` / `a.*` 来自 `JSON.parse` 结果（`any`→`unknown` 收敛后），未加类型窄化 |
| 2 | `scripts/p4z-b2ahttp-03-e2e.ts` | 11 | TS2322 ×11 | `NeonQueryPromise<…>` 赋给 `Promise<…>`（neon 驱动类型漂移，11 行同形） |
| 3 | `scripts/p8-s10-invite-reward-gate.ts` | 9 | TS2345 ×8（同一行 `:165` 的 8 个实参）/ TS2322 ×1 | `string | null` 传进了不收 `null` 的参数（一处调用 ×8 参数，单点可修） |
| | **合计** | **44** | | |

### 5.2 按「§13 纪律优先级」的另一序（推荐并行纳入）

| 批次 | 面 | 条数 | 理由 |
|---|---|--:|---|
| 批 A | **8 个新门脚本**（§3.2 全部） | **19** | 唯一**违反 §13「新增零错」**的面 ⇒ 先修这批可**立刻把基线拉回 77**，纪律即恢复 |
| 批 B | `p4z-audjk-01-probe.ts` + `p4z-b2ahttp-03-e2e.ts` | **35** | 存量债 top2，同形错集中（批量修效高） |
| 批 C | `p4z-05-keys-b1c.ts`(4) + `p4z-08-keys-b1d.ts`(6) + `p1f-02-f2-malformed.ts`(1) | **11** | TS2352 强制转换族，同因 |
| 批 D | 其余 17 文件 | **31** | 零散单点 |

**同形族归并（跨文件）**：`NeonQueryPromise` 族 = p4z-b2ahttp-03-e2e(11) + p4z-b2c-02-probe(3) = **14**；`JSON.parse → unknown` 属性访问族（TS2339/TS18046）= 跨 11 文件约 **40 条**；`TS2322 number→void` 族（返回值被当语句）= p8-s10:312 + p8-s11:461 + p8-s7:564 = **3**。

> **仅建议**：本单**不修一条**、**不改一行**、**不建门**、**不 commit**。清债单须走「改前/改后 `npx tsc -p tsconfig.scripts.json --noEmit` sorted diff」自证（§13.2-①）。

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 因 |
|---|---|---|
| 册内 22 文件的**逐文件清单** | `NOT_MEASURED` | 册内**本就没有**（§8.20.2-⑤ 逐字声明）；本单以重建清单替代 |
| 77 时点**逐行 msg 全文** vs 现在 | 已现取（产物 JSON 全含） | — |
| 每一笔触 `scripts/**` 提交的**逐一比对** | **未逐笔（159 笔）** | 本单改为**锚点差分（(文件,行,码) 多重集）+ 8 个引入 rev 逐 rev 现跑**；结论 = 残差 0 ⇒ **逐笔枚举对结论无增量**。**但「37 笔触碰提交各自 ±0」这一断言，本单只对「合计多集差 = 仅 8 新文件」与「8 引入 rev 逐 rev 递增恰等」两侧取证，未对中间 30 笔逐一单跑** ⇒ 该面标 **`NOT_MEASURED`** |
| 8 个新文件「**引入后到 HEAD**」之间被改但错数不变的提交（如 p8-s7 的 c0c5fde/c8ec4ef） | 已覆盖（引入时条数 = 现条数，Δ=0 ⇒ 改动零新增） | — |
| `p1f-02:171` msg 文本变更的**具体 rev** | `NOT_MEASURED`（非本单目标） | 计数与三元组不变，不影响归因 |
| 上库 / 起实例 / `npm install` / 改文件 | **一律未做**（硬口径） | 严格只读 |

---

## §7 自曝

1. **派单的两处口径我修正了**：① 派单 8 码分布合计 91（漏 5 码），非 96 —— 完整为 13 码（§1.1）；② 派单说「册内 22 文件清单」，实际**册内无清单**（§8.20.2-⑤ 自证 `NOT_MEASURED`）⇒ 我用重建清单，**不得**说成「与册内清单对账」。（§2）
2. **「top 文件 = 推高源」是错的直觉**：派单点名的 top2（`p4z-audjk-01-probe 24` / `p4z-b2ahttp-03-e2e 11`）在基线里**就是 24 / 11**（Δ=0）。**只看排行会得出完全错误的归因**——这恰是本单要防的（§2.3 ★）。
3. **我自己的方法局限**：为「逐笔 159 笔」省算力，我用了**锚点差分 + 8 引入 rev 现跑**的等价法；**「对既有脚本的 30 笔中间改动各自 ±0」是推论（由两侧端点 + tsconfig 不变 + 多集差仅 8 新文件），不是逐笔实测**。若要求逐笔硬证，须补跑 30 笔存档 —— 已标 `NOT_MEASURED`（§6）。
4. **临时件外置**：`git archive` 展开的 8 个 rev 树 + 基线树全在 `/tmp/s46/**`（`node_modules` 用软链，未复制）⇒ **零写仓**；产物只落 `backend-ts/.s46-artifacts/{RUNID}/` + 本报告。
5. **未做任何 git 写操作**（无 `stash`/`checkout`/`reset`/`add`/`commit`/`push`/`worktree`），无 `pkill -f`/`killall`，未起实例，未 `npm install`，原始输出未用 `.log`。

*（S46 · Kong · 只读 · runid `s46-20261007T002904Z`）*