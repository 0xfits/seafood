# S52a · B22 分库 Phase 2a —— 新库跑 43 迁移 + 串库护栏 + schema 指纹逐面对拍

- **执行者**：Kong（子代理）
- **日期**：2026-10-07（CST）
- **新库**：`.env.newdb.local` ⇒ `ep-red-moon-b3xvoyjk…`（`neondb` · PostgreSQL 18.6）
- **现库**：`.env.local` ⇒ `ep-holy-forest-b3fi7u3u…`（= **生产库**，全程只读、零写）
- **产物目录**：`backend-ts/.s52a-artifacts/s52a-20261007-144301/`
- **结论（一句话）**：**schema 指纹 12/12 面 100% 一致（零差异面）**；但 **迁移链在空库不可 100% 重放** —— `0036` 的 apply-time 自检硬编「历史 3 行」而空库只有 1 行 ⇒ **停在 `42 行/0044`（缺 `0036`）**，**未达 `43 行/0044`**。此为新库独立重建的**真阻断**（见 §6）。

---

## §0 对锚

| 项 | 开工 | 收尾 |
|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | 同 |
| HEAD | `ddeb500`（含 `ddeb500` ✅） | `5435773`（父代在任务途中提交派单 docs；**非我所为**） |
| `git status --porcelain` | 空 | 空（**零仓改动** ✅） |
| `backend-ts/.env.local` sha256 | `0960bd1d352fd12f1a424ea3e08a9d8c89084b3052c9d7fa9795164c42aba453` | **同值**（**未变** ✅，全程未打印任何值） |
| `backend-ts/.env.newdb.local` sha256 | `b575627f24556a227af0deb780242c08586d0f7b5dede55b3a82acb9d314479b` | **同值** |

**「两库不同」证据（§1 现取）**：新库 `ep-red-moon-b3xvoyjk` ≠ 现库 `ep-holy-forest-b3fi7u3u`；两库 `current_database()` 均为 `neondb`，故 **host 是唯一区分**。新库 `schema_migration` 不存在 / public 表数 0；现库 `schema_migration` 43 行 / public 表数 34。

迁移文件：`backend-ts/migrations/*.sql` = **43 个**（版本号跳 `0018`，无该文件）。

---

## §1 串库护栏读数（apply 前）

**命令**：`npx ts-node --transpile-only .s52a-artifacts/<runid>/s52a-guard.ts`（读 `.env.newdb.local` 进 `process.env`，只读探针）

```json
{
  "newdb": { "host_prefix": "ep-red-moon-b3xvoyjk", "host_full": "ep-red-moon-b3xvoyjk.c-4.ap-southeast-1.aws.neon.tech",
             "current_database": "neondb", "server_version": "PostgreSQL 18.6 …",
             "has_schema_migration": false, "schema_migration_rows": null, "public_base_table_count": 0, "probe_ok": true },
  "proddb_readonly": { "host_prefix": "ep-holy-forest-b3fi7u3u", "public_base_table_count": 34,
             "has_schema_migration": true, "schema_migration_rows": 43, "probe_ok": true },
  "host_different": true,
  "assert_host_differs": true, "assert_newdb_schema_migration_absent": true, "assert_newdb_public_tables_zero": true,
  "GUARD_PASS": true
}
```

- 机制：**进程内** `dotenv.parse` 读文件 → 写 `process.env`（含 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` 四别名），再 `import()` 迁移脚本；因 `dotenv` **不覆盖**已存在 env ⇒ `migrate.ts` 内 `dotenv.config('../.env.local')` 被绕过。**未 shell source/export，未把密钥进 argv/`ps`，未打印任何密钥值**。
- **apply 前同一进程内复断言**（runner `PREFLIGHT_PASS: true`）：host 命中新库、`schema_migration` 不存在、public 表数 0 ⇒ 放行 apply。任一不成立即 `exit 9` 停机（本次三道全绿）。

---

## §2 · 43 迁移逐条 apply 记录

> **两批**：`0001–0035` 经**生产 `scripts/migrate.ts` 本体**（动态 import）；`0036` **FAILED**（阻断，见 §3/§6）；`0037–0044` 经**tail runner**（同语义：单文件单事务 + 写版本行 + checksum 漂移检查）。**无 `skipped`**（除 tail 批对已存在版本的跳过）。checksum 列 = 文件 sha256 前 12 位。

### 批 1 · migrate.ts（0001–0035 全部 applied；0036 FAILED）

| version | file | action | checksum | 结果 |
|---|---|---|---|---|
| 0001 | 0001_ledger_core.sql | applied | 4f902d3c4750 | ok |
| 0002 | 0002_user_identity.sql | applied | 688b1935f6bc | ok |
| 0003 | 0003_kind_close_set_20.sql | applied | f268e03075eb | ok |
| 0004 | 0004_ledger_post_event.sql | applied | 55fd1ce8085b | ok |
| 0005 | 0005_ledger_event_root_key.sql | applied | 4de12361cf7d | ok |
| 0006 | 0006_user_to_users.sql | applied | 4aa19b148700 | ok |
| 0007 | 0007_referral_and_commission_policy.sql | applied | 7044c6be33f7 | ok |
| 0008 | 0008_platform_revenue_job_fee.sql | applied | e98ac1a0470e | ok |
| 0009 | 0009_ledger_error_reverse_map_complete.sql | applied | 6688e2ce35c6 | ok |
| 0010 | 0010_referral_bind_protocol_guard.sql | applied | 73e7ac8b6fd4 | ok |
| 0011 | 0011_commission_assert_closure_and_referral_depth_guard.sql | applied | 238f96ae4229 | ok |
| 0012 | 0012_replay_pre_gate_before_balance_gate.sql | applied | 2a64483f944f | ok |
| 0013 | 0013_job.sql | applied | 720c89e4a936 | ok |
| 0014 | 0014_job_flow.sql | applied | a33798336adc | ok |
| 0015 | 0015_listing.sql | applied | f856a1316e9d | ok |
| 0016 | 0016_market.sql | applied | f5ce7c79c584 | ok |
| 0017 | 0017_platform_config.sql | applied | 0aaba855b1d5 | ok |
| 0019 | 0019_listing_deposit_platform_credit.sql | applied | 48a9a4e2d506 | ok |
| 0020 | 0020_ledger_post_event_hold_family_drop_listing_deposit.sql | applied | 228127d89de9 | ok |
| 0021 | 0021_content_translation.sql | applied | 223125d15b3b | ok |
| 0022 | 0022_admin_permission_seed.sql | applied | 069a00905c28 | ok |
| 0023 | 0023_admin_points_audit_daily_cap.sql | applied | fe7bb504fd91 | ok |
| 0024 | 0024_admin_refund_audit.sql | applied | b2495845c26f | ok |
| 0025 | 0025_currency_review_log.sql | applied | 2e4c62c0ccba | ok |
| 0026 | 0026_listing_review_log.sql | applied | 3140366eabfd | ok |
| 0027 | 0027_job_arbitration_log.sql | applied | 8209df5a8687 | ok |
| 0028 | 0028_kind_close_set_21.sql | applied | 80381d0910c7 | ok |
| 0029 | 0029_batt_checkin.sql | applied | 4cb0a07bd3c4 | ok |
| 0030 | 0030_listing_order_status_extend.sql | applied | e49fb99b21a7 | ok |
| 0031 | 0031_rating_and_order_event.sql | applied | 9ba5c35fc3bd | ok |
| 0032 | 0032_kind_close_set_23.sql | applied | 08744e8366d5 | ok |
| 0033 | 0033_currency_platform_coin_flag.sql | applied | a9941c05ed06 | ok |
| 0034 | 0034_ledger_op_burn_and_supply.sql | applied | 1413e9f2e88e | ok |
| 0035 | 0035_fee_rate_range_extend.sql | applied | 2d34cbc8719c | ok |
| **0036** | **0036_commission_policy_p9_5.sql** | **FAILED** | — | **`P0001` `0036 self-check FAILED: 历史 3 行（fee_rate_bp=100/levels=10/10 项权重）行数=1（期望 3，append-only 应未被改写）`** |

### 批 2 · tail runner（0037–0044 全部 applied）

| version | file | action | checksum | 结果 |
|---|---|---|---|---|
| 0037 | 0037_commission_conservation_m0.sql | applied | a039a407b778 | ok |
| 0038 | 0038_kind_close_set_24.sql | applied | e85d9e49394d | ok |
| 0039 | 0039_admin_audit_console.sql | applied | d1fa34042956 | ok |
| 0040 | 0040_backfill_signup_batt.sql | applied | efa38fee102d | ok |
| 0041 | 0041_job_headcount.sql | applied | b6e506c307a1 | ok |
| 0042 | 0042_job_settle_per_submission.sql | applied | 3334c829f98b | ok |
| 0043 | 0043_truncate_guard.sql | applied | 60bcd0c2f064 | ok |
| 0044 | 0044_restore_listing_deposit_leg.sql | applied | 937af17fdaf8 | ok |

**计数**：applied = **42**；FAILED = **1**（`0036`，被 tail 显式登记为 `SKIPPED_BLOCKED`，**未写版本行**）。

---

## §3 apply 后核验

| 核验项 | 期望 | 实测（新库） | 判定 |
|---|---|---|---|
| `schema_migration` 行数 | 43 | **42** | ❌ 差 1 |
| `schema_migration` max `version` | `0044` | **`0044`** | ✅ |
| 缺失版本 | 无 | **`["0036"]`** | ❌ |
| `ledger_post_event` prosrc 含 `listing_deposit` | 否 | **否**（`position=0`） | ✅ |
| `ledger_post_event` `md5(prosrc)` / 长度 | `a9615fe1…` / 47950 | **`a9615fe18baad67ea62b9fbf1a156bfa` / 47950** | ✅（与现库**逐字同**） |
| 触发器数（非 internal） | = 现库 | **69 = 69** | ✅ |
| public 表数 | = 现库 | **34 = 34** | ✅ |

**结论**：`0044` 已在新库生效（prosrc 不含 `listing_deposit`，md5 与生产「应用后」基线 `a9615fe1…` 逐字同）✅；但 **`43 行/0044` 未达** —— 唯一缺口是 `0036`（**数据依赖自检**，非 schema）。

---

## §4 schema 指纹逐面差集（新库 vs 现库）

**机制**：逐面独立枚举两库 → 按 `key` 求差集；`same_key_diff_body` 对**同键但体不同**的记录另计（覆盖「表同名但列不同」这类隐含面）。现库**全程只读**。

| # | 面（facet） | 新库 | 现库 | 交集(同) | **仅新库有** | **仅现库有** | 同键体不同 |
|---|---|---|---|---|---|---|---|
| 1 | 表（public base tables） | 34 | 34 | 34 | 0 | 0 | — |
| 2 | 列（表/列/类型/nullable/default/identity） | 300 | 300 | 300 | 0 | 0 | 0 |
| 3 | 约束（PK/FK/UNIQUE/CHECK + `pg_get_constraintdef` 含 ON DELETE） | 440 | 440 | 440 | 0 | 0 | 0 |
| 4 | 索引（indexname + indexdef） | 100 | 100 | 100 | 0 | 0 | 0 |
| 5 | 触发器（name + `tgenabled` + `pg_get_triggerdef` 时机/事件；非 internal） | 69 | 69 | 69 | 0 | 0 | 0 |
| 5b | 触发器（internal，FK 类，仅计数） | 216 | 216 | 216 | 0 | 0 | — |
| 6 | 函数（`proname` + 参数签名 + `md5(prosrc)` + 返回类型 + 语言） | 102 | 102 | 102 | 0 | 0 | 0 |
| 7 | 序列（`pg_class.relkind='S'`） | 23 | 23 | 23 | 0 | 0 | — |
| 8 | 视图 | 1 | 1 | 1 | 0 | 0 | 0 |
| 9 | 物化视图 | 0 | 0 | 0 | 0 | 0 | — |
| 10 | RLS（`relrowsecurity` / `relforcerowsecurity`） | 34 | 34 | 34 | 0 | 0 | 0 |
| 11 | 策略（`pg_policies`） | 0 | 0 | 0 | 0 | 0 | — |
| 12 | 类型（enum/composite/domain） | 35 | 35 | 35 | 0 | 0 | 0 |

### §4.1 差集逐条定性

- **schema 面：`相同 = 12/12 面（全量键相等）/ 仅新库有 = 0 / 仅现库有 = 0 / 同键体不同 = 0`。**
- **定性**：所有 schema 面**均为「迁移里本来就有」⇒ 两边一致**，**逐字相等**（含函数 `md5(prosrc)`、触发器 def、约束 def）。**无任何「仅新库有」或「仅现库有」面** —— 即 **现库在 schema 层未发现手改/漂移**（与 §4.2 的 checksum 对拍互证），**新库也无「缺面」**（除下文非 schema 的 `0036` 登记行）。
- **非 schema 的差异（不在指纹面，单列）**：
  1. `schema_migration` **登记行**：新库 42 vs 现库 43 —— 差 `0036` 一行（**原因见 §6，属迁移自检缺陷，非 schema**）。
  2. `commission_policy` **数据行**：新库 **1** 行 vs 现库 **4** 行（现库多出的 3 行 = 2 行**夹具残差** `policy_id=2,3`（`created_by=1`，`effective_from` 2026-09-30 / 2026-10-01）+ 1 行 `0036` 新政策 `policy_id=34`）。**数据面属 S52b 范畴**，本单不写。

### §4.2 迁移文件 checksum 漂移对拍（只读现库）

**命令**：`npx ts-node --transpile-only .s52a-artifacts/<runid>/s52a-drift.ts`

```json
{ "prod_schema_migration_rows": 43, "prod_max_version": "0044", "file_count": 43,
  "mismatches": [], "files_not_in_prod": [], "all_match": true }
```

⇒ 现库 `schema_migration` 内 43 条 checksum 与**当前 43 个迁移文件** sha256 **逐条相符**（零漂移）⇒ 迁移文件自 apply 后**未被改**，佐证 §4.1「schema 无漂移」。

---

## §5 未做 与 NOT_MEASURED

1. **`0036` 未 apply**（阻断）—— 依硬口径①「新库写面仅限迁移，不得造业务数据」，**未**手工补插其自检所需的 2 行 `commission_policy`（那 2 行是 `created_by=1` 的夹具残差，属 S52b 的 C 类种子/配置复制范畴）。⇒ **`43 行/0044` AC 未达（实测 `42 行/0044`）**。
2. **未做任何业务数据写**（无 users/job/listing/ledger 行）—— 空库仅得迁移自带 schema + 迁移内 seeds（`0007` 政策种子、`0022` 权限种子等）。
3. **行为级/端到端未测**（未起实例、未打 HTTP、未造夹具）—— 非本单范围。
4. `NOT_MEASURED`：**现库业务数据面全量**（本单只现取了 `commission_policy` 一个表用于定性 `0036`；其余数据面对拍属 S52b）。
5. `NOT_MEASURED`：**`0036` 在新库若被满足后的后续行为**（未构造其前置于条件，未测）。

---

## §6 自曝

1. **★ 真发现（阻断 · 要具名）**：**迁移链在空库不可 100% 重放**。`migrations/0036_commission_policy_p9_5.sql:83-90` 的 D.3 自检硬编「`fee_rate_bp=100 ∧ levels=10 ∧ 10 项权重` 的历史行 **恰 3 行**」，D.4 再硬编「表行数 **恰 4**」。但**43 个迁移文件里只有 `0007:161` 插入 1 行历史种子**（其余 `0035` 的 INSERT 全在子事务内哨兵回滚、零残留）；现库那「3 行」里的另 **2 行**（`policy_id=2,3`，`created_by=1`）来自**非迁移来源**的测试脚本（如 `scripts/p2d-00-commission-m-criteria.ts:498` 收尾插入同值政策、`scripts/p2b-01-forensics.ts`）—— 即 **`commission_policy` append-only 的夹具残差**。⇒ 0036 的落地**隐式依赖现库的夹具残差**，新空库上必然 `P0001` aborted。
   - **影响**：**S52a「空库仅靠迁移完成 schema+seed」的前提在 `0036` 处不成立**；S52b 若要「先建库后选择性复制」，则复制种子/配置（含那 2 行）**必须先于**（或同批解决）`0036` 的重放，否则 `schema_migration` 永久留 `0036` 空洞。
   - **修法（需下一单裁定，本单未做）**：或 (A) 出**新修复迁移**放宽 `0036` 的 D.3/D.4（不追历史行数、只校验新行幂等在场）；或 (B) 由 S52b 以「种子/配置」身份复制那 2 行 C 类残差后再补 apply `0036`。**均超出本单「零仓改动 + 写面仅限迁移」边界**。
2. **★ 我的偏离（自行登记）**：任务默认「跑 43 迁移全绿」。`0036` 阻断后，为使 §3/§4（尤其 `0044`/`prosrc` 与完整指纹）**尽可能可验**，我**新写 `s52a-apply-tail.ts`**（复刻 `migrate.ts` 语义），**显式跳过 `0036`** 并逐条 apply `0037–0044`。⇒ 新库最终为 **`42 行/0044`、单缺口 `0036`**（非任务的 `43/0044`）。此偏离**已全程留痕**（`apply-tail.stdout.json` 内 `SKIPPED_BLOCKED` 具名），**未伪造绿、未放宽任何判据**。若父代要求「严格停在失败点」，可在洁净新库上重跑即回落为 `35 行/0035`。**我未改 `migrations/**`、`migrate.ts`、`src/**`、`docs/*.spec.md` 等任何已跟踪文件**（`git status` 全程空）。
3. **★ 我自纠一处测量错**：首版指纹的「序列」面用了 `information_schema.sequences`（受权限过滤）⇒ 得 **1**；经 `pg_class` 复核实为 **23**（两边同）。**已改正并复跑**（`s52a-supplement.ts` 为证）。教训：计面优先 `pg_class`。
4. **未越界**：**全程未对现库执行任何写**（仅 `SELECT`）；未 `shell source/export`；未把密钥写进 argv/env 前缀；未打印任何密钥值（仅 host/db/版本）；未 commit/push；未 `npm install`；未起实例、未碰 `5787/5788/5555/5191`；未 `pkill -f`/`killall`；原始输出未用 `.log`。
5. **对锚变更照录**：任务途中 HEAD 由 `ddeb500` → `5435773`（父代提交派单 docs），**非我所为**；我收尾时 `git status` 仍为 0 条。

---

### 附：产物清单（`backend-ts/.s52a-artifacts/s52a-20261007-144301/`）

`guard.json` · `prod-commission.json` · `drift.json` · `apply.stdout.json` · `apply.stderr.txt` · `apply-tail.stdout.json` · `apply-tail.stderr.txt` · `fingerprint.stdout.txt` · `supplement.json` · `newdb.catalog.json` · `prod.catalog.json` · `fingerprint-diff.json` · 脚本 `s52a-lib.ts` / `s52a-readlib.ts` / `s52a-guard.ts` / `s52a-run-migrate.ts` / `s52a-apply-tail.ts` / `s52a-fingerprint.ts` / `s52a-drift.ts` / `s52a-prod-commission.ts` / `s52a-supplement.ts`。

**复现命令**（均在 `backend-ts/`，`RUNID` 见 `.s52a-artifacts/.current-run`）：
```
npx ts-node --transpile-only .s52a-artifacts/$RUNID/s52a-guard.ts
npx ts-node --transpile-only .s52a-artifacts/$RUNID/s52a-run-migrate.ts     # 产 apply.stdout.json（0036 FAILED, exit 4）
npx ts-node --transpile-only .s52a-artifacts/$RUNID/s52a-apply-tail.ts      # 0037–0044
npx ts-node --transpile-only .s52a-artifacts/$RUNID/s52a-fingerprint.ts
npx ts-node --transpile-only .s52a-artifacts/$RUNID/s52a-drift.ts
```
