# P4-B3a-FIX-A2 · `ledger_post_event` 函数体形状手术（裁定 #14 单次解禁）

- **单号**：Unit P4-B3a-FIX-A2（Kong 派单；执行者 zang 子代理）
- **仓库**：`/Users/kevin/bistro/seafood`（后端 `backend-ts`）
- **服务**：`seafood-api` @ `5788`（面板 sid `seafood-api`，控制面板 `:5555`）
- **产物 run**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3afix2-20260930T014937/`（run-tagged）
- **状态**：**已完成**（全文回写完毕；下单时先落盘骸架，逐段回写）

> 记法：凡标「实测」者，本节均给出**可 `grep` 到的读数文件 + 命令**；未取到的读数一律写 `NOT_MEASURED`（**不填 0 / 不填空**）。
> 探针自曝见 §9：本轮有 2 处探针自身缺陷（`H2` 退化、`H2c` 被 TS 侧前置闸拦），均已修正后重跑，原始读数保留在产物里。

---

## 0. 摘要（TL;DR）

| # | 项 | 读数 | 证据文件 |
|---|---|---|---|
| 1 | 改前 live 函数原文落盘 | `md5=e784a586…293002`，45722 B / 977 行，IN 列表在**第 520 行** | `.p4-artifacts/b3afix2-20260930T014937/pre-ledger_post_event.def.sql` |
| 2 | 改后 live 函数原文落盘 | `md5=57fdc800…031f55`，45704 B / 977 行（**-18 B**） | 同目录 `post-ledger_post_event.def.sql` |
| 3 | 改前/改后**逐字 diff** | **仅 1 行变化**（`diff -u` 输出 1 处 @@），只删掉 `,'listing_deposit'` | 同目录 `fn-def.diff`、`fn-def.pre-post.diff` |
| 4 | 新迁移 | `backend-ts/migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql`（60667 B，sha256 `228127d89de9…`） | `migrate-apply.out.json` |
| 5 | 迁移注册表 | **18 → 19** 行；`schema_version=0020`，`action=applied`，3080 ms | `migrate-apply.out.json` |
| 6 | 正向（跨账户消耗入 `-1`） | **成功**：`txid 28/29`，用户 `balance -1`、`uid=-1 balance +1`，`frozen_delta` 两条皆 **0** | `b3afix2-02-verify.json` → `I_…readback` |
| 7 | 负向（其余 hold 家族 kind 仍须恰 2 条同账户腿） | **3/3 拒**，`LEDGER_AMOUNT_INVALID / reason=HOLD_PAIR_REQUIRED` | `b3afix2-02-verify.json` → `H2a/H2b/H2c` |
| 8 | 负向（`commission` 贷 `-1`、`listing_deposit` 借 `-1`、`-2`/`-3` 各一例） | **全部拒**（`LEDGER_RESERVED_UID` / DB 直调 `LD021`） | 同上 → `H5–H9c` |
| 9 | kind 关闭集 | **仍 20**（DB `::text` 计数 20；TS `LEDGER_KINDS` 20；集合逐值相等） | 同上 → `C_kind_close_set_20` |
| 10 | 幂等 | 同键重投 ⇒ 同一 `txid 30`，`second_entry_added=0`；`0020` 原样重放 ⇒ 函数 `md5` 不变 | 同上 → `G_*`、`J_*` |
| 11 | `tsc --noEmit` | **exit 0**（0 行输出，0 error） | `.p4-artifacts/…/tsc-noEmit.log`（0 行） |
| 12 | 非资金面 | `/health` 200、`/api/home` 200、已落 `410` 面仍 **410**（改前/改后各一次）；`tsc` 见上 | `b3afix2-05-http.json` |
| 13 | 服务收尾 | 面板 `POST /api/restart {sid:seafood-api}` `ok:true` → `/health` 200（2750 ms）→ 真 token 业务端点 200 | `b3afix2-05-http.json` |
| 14 | 资金不变量 | 正向形状 `Σ(balance+frozen)` 变化量 = **0**（纯转移，含 `-1` 负余额） | `verify2-tty.log` → `F2_…` |
| 15 | 产物无凭据泄漏 | 全产物 `grep -rc 'e[y]J'` = **0** | §7 |

---

## 1. 本次为何解禁（裁定 #14 原文引述）

### 1.1 派单授权原文（逐字引述）

> **本单获得「裁定 #14 —— 禁触 `ledger_post_event` 函数体」的【单次解禁】**，**仅限**：新建 `migrations/0020_*.sql`，里面 `CREATE OR REPLACE FUNCTION ledger_post_event(...)` **仅仅从那个 IN 列表里删掉 `'listing_deposit'`**，**其余一字不动**（函数体其它逻辑、其它 kind、参数、返回类型、幂等、断言全部保持）。**依据**：R31/DL67/DL88（已冻结）**要求**跨账户消耗形状；函数体现写着已被推翻的口径；解禁的代价 = 永久不可达的**静默欠款**。

### 1.2 为什么「不解禁就付不出合规的上市入账」

- 权威口径（**已冻结，本单只兑现、不自行推导**）：
  `docs/ledger.spec.md` **R31（v0.2，`:79`）** 保证金 = **消耗不可退**；v0.3 修订说明（`:12-13`、`:191`）保证金**在上市时即消耗**；
  `docs/data-layer.spec.md` **DL67（`:454`）** 上市账务含 `listing_deposit`（**消耗、入 `uid = −1`**）、**DL88（`:530`）** `listing_deposit` **上市即消耗**（`balance → uid −1`）、**不可退、无罚没、无退还 kind**。
- 该口径要求的是**跨账户消耗**：用户 `balance` 减、`uid = -1` 的 `balance` 增。
- 但 `ledger_post_event` 函数体内**第二处** hold 家族列表（live 原文**第 520 行**，改前逐字）：
  `WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')`
  它要求该 kind 的每个 `(uid,cid,kind)` 组**恰好 2 条腿**（`HAVING count(*) <> 2` ⇒ `LEDGER_AMOUNT_INVALID / reason=HOLD_PAIR_REQUIRED`）= **同账户搬运**，与「跨账户消耗入 `-1`」**互斥**。
- 前置三块已落：`0003`（kind 关闭集 20）、`0019`（`-1` 的 `credit` 白名单接纳 `listing_deposit`，已应用）、`src/ledger.ts` 的 `HOLD_KINDS` 已收成 4 项。**唯一剩下的阻塞就是这张列表**。
- 若不改：任何合规的上市入账都会被拒 ⇒ 该分支在 DB 侧**永久不可达**，而 spec 已冻结其存在 ⇒ 即「永久不可达的**静默欠款**」。这正是解禁的代价与理由。

---

## 2. 改前取证（先落盘再改，不靠任何转述）

### 2.1 live 函数原文落盘（产物）

| 项 | 值 |
|---|---|
| 取法 | `SELECT pg_get_functiondef('public.ledger_post_event'::regproc)`（探针 `scripts/p4z-b3afix2-00-probe.ts`，只读） |
| 落盘 | `.p4-artifacts/b3afix2-20260930T014937/pre-ledger_post_event.def.sql` |
| md5 | `e784a58681ae971bcd97f3043f293002` |
| 体量 | 45722 字节 / 977 行（`fn_meta.len` / `fn_meta.line_count`） |
| oid | `172218` |
| `prosrc` md5 | `d94dd902697dfe60aba409d808c6d63a`（45598 B） |
| 注册表 | **18** 行（`schema_migration`） |

### 2.2 IN 列表的准确行号与上下文（改前，live）

行号由脚本按 `pg_get_functiondef` 原文逐行扫描得出（**非转述**），产物 `pre-probe.json` → `hold_family_in_list_lines` / `in_list_context_pm3`：

```
517|    FOR v_rec IN
518|      SELECT t.e->>'uid' AS g_uid, t.e->>'cid' AS g_cid, t.e->>'kind' AS g_kind
519|        FROM jsonb_array_elements(v_entries) AS t(e)
520|       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')
521|       GROUP BY 1, 2, 3
522|      HAVING count(*) <> 2
523|    LOOP
524|      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
525|        'field', 'entries', 'reason', 'HOLD_PAIR_REQUIRED',
526|        'uid', v_rec.g_uid, 'cid', v_rec.g_cid, 'kind', v_rec.g_kind));
527|    END LOOP;
528|  END IF;
```

- 全函数体中 `listing_deposit` **只出现 1 次**（就在第 520 行）；`job_escrow_refund` 也只出现 1 次 ⇒ 该列表在函数内**唯一**。
- 该 `FOR` 循环位于 `ELSE  -- op = 'entries'` 分支（第 403 行开）内，`END IF;` 在第 528 行闭合 ⇒ **对 `op='entries'` 恒执行**（不受 op 链影响）。
- 紧随其后的第 547 行才是 `EVENT_NOT_BALANCED`（净额闸）⇒ 配对闸**先于**净额闸。

### 2.3 源码副本（**只读引用，本单未改**）

同一条 IN 列表在迁移源码里另有 3 份副本，本单一律**不动**（改它们 ⇒ checksum 漂移 ⇒ `scripts/migrate.ts` 整链 ABORT/exit 3）：

| 文件 | 行 |
|---|---|
| `migrations/0004_ledger_post_event.sql` | `878` |
| `migrations/0005_ledger_event_root_key.sql` | `1010` |
| `migrations/0012_replay_pre_gate_before_balance_gate.sql` | `595` |

⇒ **仅 DB 内函数体（经新迁移 `0020`）被改**；历史迁移文件保持原样（这也是「行为改变只允许落在新迁移」的既有先例）。

---

## 3. `0020` 迁移

### 3.1 文件要素

| 项 | 值 |
|---|---|
| 路径 | `backend-ts/migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql` |
| 大小 | **60667** 字节 |
| 语句 | ① `CREATE OR REPLACE FUNCTION public.ledger_post_event(payload jsonb) RETURNS jsonb`（函数体 = live 原文**逐字**，仅删 18 字节）② 一个纯只读 `DO $$ … $$;` 自检块 |
| sha256（`migrate.ts` 存入注册表） | `228127d89de90a0d187aff8c2cd12b18aad94130faca7e804f5dd23c1d9cfc4d` |
| 生成方式 | `scripts/p4z-b3afix2-01-gen-0020.ts` 从**改前 live 原文**派生（脚本内 4 道断言，见 §3.3） |
| 幂等/可重入 | `CREATE OR REPLACE FUNCTION` 天然幂等；`DO` 自检纯只读。**实测**：原样重放本文件（走 `Pool` 简单查询＝与 `migrate.ts` 同通道）后 live 函数 md5 不变（`J_migration_0020_reapply_idempotent`：`re_applied_bytes=53025`，`def_md5_after_reapply=57fdc800…031f55`） |
| 禁令合规 | 文件内**不含** `DELETE` / `TRUNCATE` / `DROP` 对业务对象的任何使用；不写任何业务表；不新增/删除 kind |

### 3.2 本次**唯一**改动（逐字，改前 → 改后）

```
-       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')
+       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund')
```
删掉的 token = `,'listing_deposit'` = **18 字节**（45722 → 45704）。行号仍为 520，总行数仍 977。

### 3.3 生成器内断言（防「顺手改别处」）

`p4z-b3afix2-01-gen-0020.ts` 在写文件前逐条断言，任一失败即 `FATAL` 不落盘：
1. 改前函数体中 IN 列表整串 `('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')` 出现次数 **== 1**，且 `listing_deposit` 全函数出现次数 **== 1**（证伪派单前提即报错）；
2. 字节差 **== 18**；
3. 逐行比对：**恰 1 行**变化（`CHANGED_LINES` 长度 2 = 一增一删）；
4. **dollar-quote 内文本 == `prosrc` 自证**：`md5(dollar-quote 内文本) == live md5(prosrc)` → 生成前实测相等（`d94dd902…d63a` == `d94dd902…d63a`，长度皆 45598）⇒ 迁移内那条第 ④ 项 md5 断言不是假检。

产物：`.p4-artifacts/b3afix2-20260930T014937/gen-0020-report.json`。

> 首次生成曾失败于 `LENGTH_DELTA_MISMATCH 45722 -> 45704`——是我把 `len(",'listing_deposit'")` 误写为 17（真值 18）。修正后重生成。**该断言拦住的正是「我以为的删改与实际的删改不一致」这类事故**。

### 3.4 迁移应用（`scripts/migrate.ts`）

命令：`npx ts-node --transpile-only scripts/migrate.ts`（输出落盘 `migrate-apply.out.json`）
- `EXIT=0`、`ok=true`、`schema_version=0020`、`schema_migration_rows=19`
- `applied_now` 中 `0020`：`action=applied`、`checksum=228127d89de9`、`ms=3080`；`0001–0017`、`0019` 全部 `skipped / already applied, checksum match`（**无 checksum 漂移**）
- `public_base_table_count=21`（与改前一致；本迁移不动表结构）
- 注：**首次**应用尝试 `EXIT=4`，`message="syntax error at or near \"DO\""`、`code=42601`。原因是我按 `pg_get_functiondef` 原文落盘，而该输出**不带结尾分号**，后接 `DO` 即解析失败；补一个 `;` 后成功。**失败尝试已回滚，注册表未留痕**（`schema_version` 当时仍是 `0019`）。

---

## 4. 验证（必验读数，禁推断）

全部读数来自 `scripts/p4z-b3afix2-02-verify.ts`（一次运行一个 JSON），产物：
`b3afix2-02-verify.json`（末次运行）+ `verify-tty.log`（run#1）+ `verify2-tty.log`（run#2）+ `verify3-tty.log`（run#3，**末次，`FAILED_STEPS []`**）。

### ① 改前/改后 `pg_get_functiondef` 逐字 diff

```
$ diff -u pre-ledger_post_event.def.sql post-ledger_post_event.def.sql
@@ -517,7 +517,7 @@
     FOR v_rec IN
       SELECT t.e->>'uid' AS g_uid, t.e->>'cid' AS g_cid, t.e->>'kind' AS g_kind
         FROM jsonb_array_elements(v_entries) AS t(e)
-       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')
+       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund')
        GROUP BY 1, 2, 3
       HAVING count(*) <> 2
     LOOP
```
- **只有这一个 hunk**；`pre-probe.json` 与 `post-probe.json` 的 `fn_meta`：`len 45722 → 45704`、`line_count 977 → 977`、`md5 e784a586… → 57fdc800…`。
- 改后 `listing_deposit` 在函数体中出现位置读数 `ld_in_body = 0`（`B_fn_shape`）；`HOLD_PAIR_REQUIRED`（`pair_hint_pos=24474`）与 `HAVING count(*) <> 2`（`having_pos=24333`）**仍在**；签名 `payload jsonb` / 返回 `jsonb` **未变**；`obj_description`（函数注释）**逐字未变**（仍为 P1f 版），见 `B_fn_shape.comment`。

### ② 正向：真事件「`listing_deposit` 从用户 `balance` 消耗 → 贷 `-1` `balance`」

`F_event_pos_listing_deposit_cross_account` + `I_positive_event_entries_readback`（**实测**，夹具前缀 `p4b3afix2:`）：

| 行 | txid | uid | cid | delta | frozen_delta | balance_after | frozen_after | kind |
|---|---|---|---|---|---|---|---|---|
| 1 | 28 | `970001` | 1 | **-1** | **0** | 1992798 | 4001 | `listing_deposit` |
| 2 | 29 | **`-1`** | 1 | **+1** | **0** | 3201 | 0 | `listing_deposit` |

- 分录形态 = **恰好 2 条**：改用户 `balance` 与 `-1` `balance`；**`frozen` 零变动**（两条 `frozen_delta=0`，且 `sum(frozen_delta) for event = 0`）。
- 事件根键：`cli:p4b3afix2:b3afix2-20260930T014937:pos:listing_deposit_cross_account`（`event_root_key` 归属正确，第二腿为 `…#2`）。
- **改前本形状必拒**（前一单已实测 `HOLD_PAIR_REQUIRED`）；本单改后**成功**。

### ③ 负向（逐条）

| 代号 | 用例 | 期望 | 实测（code / reason） | 判 |
|---|---|---|---|---|
| H2a | `hold` + `job_escrow` 各 1 腿（同账户同币种） | 拒 | `LEDGER_AMOUNT_INVALID` / `HOLD_PAIR_REQUIRED`（details: uid 970001 / cid 1 / kind **job_escrow**） | ✅ |
| H2b | `hold` 同 kind、两腿**不同 cid**（1 与 10） | 拒 | `LEDGER_AMOUNT_INVALID` / `HOLD_PAIR_REQUIRED`（cid **10**） | ✅ |
| H2c | `hold` 同 `(uid,cid,kind)` 组 **3 腿**（>2，net=0） | 拒 | `LEDGER_AMOUNT_INVALID` / `HOLD_PAIR_REQUIRED` | ✅ |
| H4 | **正向对照**：`hold` 同账户**恰 2 腿**（`-1` / `frozen +1`） | 放行 | 成功（`txid 34`，2 分录） | ✅ |
| H5 | `commission` 贷 `-1` | 拒 | `LEDGER_RESERVED_UID` / `PLATFORM_CREDIT_KIND_FORBIDDEN` | ✅ |
| H6 | `listing_deposit` **借** `-1` | 拒 | `LEDGER_RESERVED_UID` / `PLATFORM_DEBIT_FORBIDDEN` | ✅ |
| H7 | `listing_deposit` 贷 `-2` | 拒 | `LEDGER_RESERVED_UID` / `PLATFORM_CREDIT_KIND_FORBIDDEN` | ✅ |
| H8 | `listing_deposit` 贷 `-3` | 拒 | `LEDGER_RESERVED_UID` / `PLATFORM_CREDIT_KIND_FORBIDDEN` | ✅ |
| H9/H9b/H9c | DB 直调 `ledger_assert_platform_mutation`：`-1` debit / `-2` credit / `-3` credit | 拒 | `LD021`（`LEDGER_RESERVED_UID`）×3 | ✅ |
| H9d | DB 直调 `-1` credit `listing_deposit` | 放行 | no-throw（`0019` 未被回退） | ✅ |
| H1 | `hold` **单腿**（净额非 0） | 拒 | `LEDGER_AMOUNT_INVALID` / `EVENT_NOT_BALANCED` | ✅（**但非配对闸**，见 §9-2） |

- **所有负例均未落库**：`I_positive_event_entries_readback.negative_key_row_counts` = 全 0（8 个负例键逐个 `count=0`，读数原文见该 JSON 字段）。
- H2a/H2b/H2c 的 `reason` 是**配对闸本体**（`HOLD_PAIR_REQUIRED`）而非「顺带被别的闸拦掉」⇒ 「其它 hold 家族 kind 仍要求**恰好 2 条同账户同币种腿**」在本单实测成立（缺一腿、错币种、多一腿三向都验了）。
- H4 是**守卫正向侧**的活体证据：不是「守卫被整段删掉」，而是「只把 `listing_deposit` 从名单里拿掉」。

### ④ kind 关闭集仍 20（DB `::text` 计数 + TS 对照）

`C_kind_close_set_20`（**实测**）：
```
db_text_occurrences=20   db_kind_count=20   ts_kind_count=20   sets_equal=true   db_only=[]   ts_only=[]
```
- DB 口径 = `pg_get_constraintdef('ledger_kind_enum')` 中 `::text` 出现次数（= 枚举项数）；
- TS 口径 = `src/ledger.ts` 的 `LEDGER_KINDS`（20 项）；
- 两者**集合逐值相等**（排序后 JSON 相等）。
- 同轮另测 `HOLD_KINDS` = `['hold','hold_release','job_escrow','job_escrow_refund']`（**4 项**，不含 `listing_deposit`），与 `src/ledger.ts:178` 一致。

### ⑤ `schema_migration` = **19**

`A_registry_count_19`：`count=19`，`versions=[0001…0017, 0019, 0020]`（`0018` 从未存在，非本单所致），末行 = `0020_ledger_post_event_hold_family_drop_listing_deposit.sql`。

### ⑥ 幂等：同键重投 ⇒ replay、**不产生第二条分录**

`G_idem_first_post` / `G_idem_second_post_replay`（**实测**）：两次返回 **同一 `txid 30`**；第二次前后 `ledger_entry` 计数 `entries_before_second=30`、`entries_after=30` ⇒ `second_entry_added=0`。
另：`0020` 文件原样重放后 live 函数 md5 不变（见 §3.1）。

### ⑦ `tsc --noEmit` = 0

`npx tsc --noEmit` ⇒ **`TSC_EXIT=0`**，日志 `.p4-artifacts/b3afix2-20260930T014937/tsc-noEmit.log` **0 行**（退出码直取，未经管道）。

### ⑧ 非资金面：`/health`·`/api/home` 200、已落 `410` 面仍 `410`

`b3afix2-05-http.json.results`（重启前 → 重启后）：

| 端点 | 改/重启前 | 重启后 |
|---|---|---|
| `GET /health` | **200**（`{"ok":true,"db_version":"PostgreSQL 18.6 …"}`） | **200** |
| `GET /api/home` | **200**（`{"success":true,…}`） | **200** |
| `POST /api/auth/register`（已落 `410` 面） | **410** | **410** |

### ⑨ 产物内 `grep -c 'e[y]J'` = 0

见 §7（全产物 + 报告 + 迁移文件 + 脚本统一 grep）。

### ⑩ 资金不变量：正向事件的 `Σ(balance+frozen)` 变化量 = 0

`F2_sigma_invariant_around_positive_event`（**实测**，run#2 = 该事件**真实执行**的那一次，原文在 `verify2-tty.log`）：
```
sigma_before=2000000  sigma_after=2000000  sigma_delta=0
user_before={b:1992796,f:4002}  user_after={b:1992795,f:4002}
m1_before  ={b:3202,   f:0}     m1_after  ={b:3203,   f:0}
txid=36  entry_count=2  per_entry=[{uid:970001,delta:-1,frozen_delta:0},{uid:-1,delta:1,frozen_delta:0}]
```
- 用户 `-1`、`-1` 账户 `+1`，含**负余额账户参与**，全局 `Σ(balance+frozen)` **零变动** ⇒ 纯转移、无铸造/销毁泄漏。
- 末次运行（run#3）该键已存在 ⇒ 走重放，`σ` 前后同为 `2000000`（`entries` 未新增），两轮读数一致。

---

## 5. 只读检查：`backend-ts/scripts/p3x-00-rebuild-replay.ts`（**本单未改，归 Zang 另派**）

结论：**该脚本对「迁移文件数」的自适应是部分的** —— 重放循环自适应，但**期望值有两处写死**（其中一处会**直接把 gate 打成 false、挡住 `--apply` 的 COMMIT**）。

| 位置 | 现状 | 是否自适应 | 需要改成 |
|---|---|---|---|
| `:8`（文件头注释） | 「按序重放 migrations/0001..**0017** 原文」 | 注释 | 「0001..**0020**（无 0018）」 |
| `:57–60` `VERSION_ORDER` | 写死 `['0001'…'0017']`（**无 0019、无 0020**） | **否** | 追加 `'0019','0020'`（`0018` 无文件）。用于 `:842 summary.version_order_ok = JSON.stringify(files…)===JSON.stringify(VERSION_ORDER)`；实测该标志**只入产物、不进 gate**（`grep version_order_ok` 仅 2 处：定义 + 赋值），但它是「版本序漂移」的唯一信号，现在是 **false** |
| `:625` | `add('schema_migration.row_count', '17', …)` | **否** | 改 `'19'`（注册表现为 18，`0019` 落库后就已**恒定 FAIL**；`0020` 后为 19） |
| `:262` `loadMigrations()` | `readdirSync(MIG_DIR).filter(*.sql).sort()` | **是** | 无需改（重放/checksum 对拍随目录自适应） |
| `:452/:927` `key_functions_md5` | 事务内快照 vs 事务前状态**自比** | **是** | 无需改：只要两侧跑同一批文件，函数体变更不会造成假失败 |
| `:751/:770–786` gate 耦合 | `checksums_all_byte_equal`、`object_diffs_empty`、`terminal_failed_empty` ⇒ `gate.ok` ⇒ `canCommit` | — | ⇒ **`:625` 那一条会经 `terminal_failed` 归零 `gate.ok`**，使 `--apply --confirm-irreversible` **无法 COMMIT**。这是「必须改 `:625`」的硬理由，不只是文档不一致 |

建议最小改动（**本单不做**）：`:59` 行尾追加 `'0019', '0020'`；`:625` 的 `'17'` → `'19'`；`:8` 注释同步。另注意 `0018` 在文件系统里**不存在**，`VERSION_ORDER` 保持「文件系统实际存在的版本」即可（不要补 `'0018'`，否则 `version_order_ok` 反而恒 false）。

---

## 6. 收尾：面板单服务重启 + 真 token 业务端点

`b3afix2-05-http.json`（**实测**，全程只走面板 `{sid}` 路由，**未用** `pkill`/`killall`）：

1. `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` ⇒ `{"sid":"seafood-api","ok":true,"state":"running","pid":21659,"msg":"已启动"}`
2. 等 `/health`：**200**，等待 **2750 ms**（`post_restart_health.status_200=true`）
3. 面板 `GET /api/status`：`seafood-api` = `{"running":true,"state":"running","stopping":false,"portOpen":true,"occupier":null,"error":null,"port":5788,"pid":21659}`
4. `lsof -nP -iTCP:5788 -sTCP:LISTEN` ⇒ `node 21673 kevin … TCP *:5788 (LISTEN)`（真实监听，非「假绿」）
5. 真 token（`.env.local` 的 `SECRET_KEY` 经 `src/auth.createSessionToken` 签，**只落指纹** `sha256[:12]=2b789b25f154`，len 193）业务端点：
   - `GET /api/user/asset/970001` ⇒ **200**（`{"success":true,…"points":1992795…}`）
   - `GET /api/shard` ⇒ **200**（`{"success":true,"data":[],"deprecated":true}`）
   - `GET /api/order` ⇒ **200**（`{"success":true,"data":[]}`）
6. 重启前后 `/health`·`/api/home`·`410` 面读数见 §4-⑧。**服务未留在起不来的状态**。

---

## 7. 硬边界自查

| 边界 | 事实 |
|---|---|
| 只写允许路径 | 新建 `backend-ts/migrations/0020_….sql`；`docs/audit/p4-b3a-fix2-ledger-post-event-shape.md`；`backend-ts/.p4-artifacts/b3afix2-20260930T014937/**`；`backend-ts/scripts/p4z-b3afix2-0{0,1,2,3,4,5}-*.ts`（6 个新文件） |
| **未**触碰 | `src/**`（含 `ledger.ts`/`database.ts`）、`0001–0019` 迁移、`frontend/**`、`backend-ts/.env.local`、任何 spec（`docs/**` 只读）、`docs/seafood.master-plan.md`、`scripts/p3x-00-rebuild-replay.ts`（仅只读）、其它既有脚本/artifact。**本单唯一代码变更 = 新建那一个迁移文件** |
| 禁用项 | 无 `git add/commit/push`；无删除型 SQL（`DELETE`/`TRUNCATE`/`DROP` 业务对象）；未新增/删除 kind；未动 `-1` 的 `debit`、未动 `-2`/`-3` 白名单；无 `npm install`；未用 Hermes `execute_code` |
| 进程 | 未执行 `pkill -f` / `killall`；重启仅走面板 `{sid}`；未停/未重启任何不属于本单的服务 |
| `grep -rc 'e[y]J'` 全产物 | **0**（含 pre/post 函数原文、全部 JSON、全部日志、报告、迁移文件、6 个脚本）——token 只以 `sha256[:12]` 指纹落盘 |
| 报数口径 | 每个数字都给出「取法 + 文件」，见 §4 各条 |

---

## 8. NOT_MEASURED 与遗留

- `NOT_MEASURED`：**HTTP 层**跑「`listing_deposit` 消费入 `-1`」端到端（即经 Express 路由落库）——本单只做到 **TS `ledger.postEvent` + DB 函数** 层。原因：派单未要求该面，且对应业务路由（上市入账）的形状同步归 **FIX-B**（`src/database.ts:1382-1460`）——**本单禁触 `src/**`**。
- `NOT_MEASURED`：`ledger_entry` 在「`-1` 账户经 `listing_deposit` 取得正余额」后的**退款/罚没**路径——spec 冻结「不可退、无罚没、无退还 kind」⇒ 该路径**不应存在**；本单未构造（无对应 kind 可构造）。
- 遗留（不属本单）：§5 的 `p3x-00-rebuild-replay.ts:59` / `:625` / `:8` 三处写死期望值未改，**`--apply` 路径当前会被 `:625` 挡住**（需 Zang 另派）。
- 遗留（不属本单）：`src/database.ts:1382-1460` 的上市入账形状（FIX-B）。
- 数据痕迹（可清理）：本单在**测试库**写入 `listing_deposit` 事件 3 组（`txid 28/29`、`30/31`、`36/37`）与 1 组 `hold` 对照（`txid 34/35`），全部以 `cli:p4b3afix2:<RUN>:` 前缀标记；另有 run#1 的一次「同账户 2 腿 `hold`」（见 §9-1）。`ledger_entry` 计数 20 → 30。

---

## 9. 探针自曝

1. **run#1 的「跨账户两腿 `hold`」负例退化**：我原以为正 uid 账户有多个，取「第二个不同 uid 的账户」当第二腿。实测该库**只有 1 个正 uid 账户**（`970001 / cid 1`；其余为 `-1/-2/-3/0`），`fixture_other_account` 回落到夹具自身 ⇒ 该用例变成「**同账户 2 腿**」= 守卫的**合法对**，于是**被放行**（`FAIL`）。该次 `FAIL` 已如实保留在 `verify-tty.log`。修正：负例改成 H2a/H2b/H2c 三向（缺腿 / 错币种 / 多腿），并在本报告 §4-③ 只引用修正后的读数。
2. **H2c 首版被 TS 侧前置闸拦掉**：首版用 `(-1,0)/(0,+1)/(+1,0)` 三腿，实测返回 `EVENT_NOT_BALANCED` 而非配对闸。排查结论：`src/ledger.ts:810-830` 的 `assertBalanced`（TS 侧）在调用 DB **之前**就按 `Σ(delta+frozen_delta) ≠ 0` 抛 `LEDGER_AMOUNT_INVALID / EVENT_NOT_BALANCED`，且其 `details` 字段形状与 DB 侧第 547 行**逐字同形**（`field/reason/delta_sum/frozen_delta_sum/net_sum`）⇒ 只看报错**无法区分**是 TS 还是 DB 拦的。故把三腿改成 net=0 且无零腿的纯 delta 形状，才直达 DB 配对闸（末次 `HOLD_PAIR_REQUIRED`）。**H1 也属同一情形**（单腿 ⇒ 先被 TS 拦），报告 §4-③ 已标注「非配对闸」。
   - 反向印证：我把 live 的配对查询原文套在「3 条同组」的规范化分录上直接跑（`p4z-b3afix2-04-holdpair-probe.ts`，只读）⇒ `[{"g_uid":"970001","g_cid":"1","g_kind":"hold","n":3}]`，证该查询对 `count>2` 确实命中；「2 条同组」⇒ `[]`；「两种 kind 各 1 条」⇒ 2 组各 `n=1`。读数落盘 `b3afix2-04-holdpair-probe.json`。
3. **`pg_get_functiondef` 不带结尾分号**：首版 `0020` 直接拼原文后接 `DO` ⇒ `42601 near "DO"`（migrate `EXIT=4`）。已补 `;` 并重跑；失败尝试回滚、注册表无痕。**这正是「照抄 pg 输出」的已知坑**，此处留证以免后人复踩。
4. **`md5(prosrc)` 断言的前提是被自证的**：迁移内第 ④ 项用了硬编码 `prosrc` md5。若「dollar-quote 内文本 == `prosrc`」不成立，这条断言就是**假检**。生成器在**写文件前**用 live 读数核对（`prosrc_md5 == md5(提取文本)`、长度皆 45598，实测相等）才注入该 md5 ⇒ 断言有效。
5. **`H2b` 用到 `cid=10`**（另一轮测试遗留的 `listed` 币种 `P4B3A013647`）——只是为了构造「同 kind 两腿但不同 cid」的形状；该事件在配对闸即被拒，**未落库、未动余额**。
6. **读数范围**：全部 DB 读数走 Neon HTTP（`DATABASE_URL`）与 `Pool`（`DATABASE_URL_UNPOOLED`）；`migrate.ts` 与 `J` 步用后者（事务语义）。签名/注释等「未变」类结论取自 `pg_get_functiondef`（签名、返回类型）与 `obj_description`（注释）**现取读数**，非源码推断。
