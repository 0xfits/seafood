# S50b · `B23` 修复迁移（`0044_restore_listing_deposit_leg.sql`）审计报告

- **单**：S50b（Kong · **S50 收尾单**）· 作者：Kong · 日期：2026-10-07
- **性质**：**纯转录为主**（材料已在 S50 产物 + 主计划 §5.380 内）＋ **16 门全量对照**（受控实例相位）＋ 两探针复跑 ＋ **未 apply 自证**
- **产物**：`backend-ts/.s50b-artifacts/s50b-20261007T013539Z/`（逐门 stdout/stderr/exit + 对锚 + 逐字对拍 + summary）
- **硬口径遵守**：① 只新增报告 + 产物，**未改任何代码/迁移/谱/台账/主计划** ② 只起 `5792`（唯一），**未碰 `5787/5788/5555/5191`** ③ 未用 `pkill -f`/`killall`（按精确 PID 收尾）④ 未 commit / 未 push ⑤ 未 `npm install` ⑥ 原始输出未用 `.log` ⑦ **未 apply**（`migrate apply` 一次未跑）

---

## §0 对锚（开工前）

命令与读数（`anchor/anchor.txt`）：

```
$ git log --oneline -3
c3e0724 fix(migration): S50/B23 修法 A —— 新建【未 apply】migrations/0044_restore_listing_deposit_leg.sql … + MIGRATIONS_FROZEN 42=>43 四处前推 … 状态 = pending_apply ⇒ 那 4 门 apply 前预期红；apply 需 Kevin 一句话（库=生产库）
65a6e81 docs: §5.379/v0.379 —— ★我认账第三处：output_schema 重复键 ⇒ S50 整批被拒、已整批重发
6262043 fix(probes): S49 R7 —— s5-01 期望前推转绿（67/69 => 84/84）+ s3-01 探针侧补前置但行为段 11 红不可消 ⇒ 挖出真产品缺陷 B23

$ git status --porcelain
(空)
$ git rev-parse HEAD
c3e0724406571cfb8ae0de77ddfb53bfa2e47baa
$ shasum -a 256 migrations/0044_restore_listing_deposit_leg.sql
937af17fdaf886f6e8767941aec3f2859d93a262eb1a4a062f6ab2c2600bbee6
$ wc -c migrations/0044_restore_listing_deposit_leg.sql
63895
$ ls migrations/*.sql | wc -l
43
```

**HEAD 含 `S50/B23` 那笔（`c3e0724`）✓ · 工作树干净 ✓ · `0044` sha256 `937af17f…` / 63895 B 逐字对上 ✓ · 迁移文件数 43 ✓。**

**活库对锚（只读探针 `db-anchor-probe.ts`，零写）**：

```json
{
  "schema_version_max": "0043",
  "schema_migration_count": 42,
  "fn_prosrc": { "prosrc_md5": "3737e0f8ef4f2bbfffd973f16ce47fb8",
                 "prosrc_len": 47968,            // = Postgres 字符数
                 "pos_listing_deposit": 25952,   // > 0 ⇒ listing_deposit 仍在函数体内
                 "identity_args": "payload jsonb", "ret": "jsonb" },
  "counts": { "ledger_entry": 504, "currency": 15, "currency_review_log": 0 },
  "sequences": { "ledger_entry_txid_seq": 2828, "currency_review_log_log_id_seq": 69 }
}
```

⇒ **活库仍 `schema max 0043` / `schema_migration` 42 行（`0044` 未 apply）✓**；`ledger_post_event` 函数体仍含 `listing_deposit` 恰 1 处（`pos=25952`）⇒ **B23 回归仍在线上**。

**端口开工前复核**：

```
$ lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(5787|5788|5555|5191|579[2-9])\b'
Python 56716 … TCP 127.0.0.1:5191 (LISTEN)
node   56865 … TCP [::1]:5787   (LISTEN)
node   56867 … TCP *:5788       (LISTEN)
node   61000 … TCP *:5555       (LISTEN)
```

⇒ `5787/5788/5555/5191` **四条他人端口在听（未碰）**；**`5792–5799` 全空** ⇒ 起本单唯一实例于 `5792`。

**本单实例**：`cd backend-ts && PORT=5792 npx ts-node --transpile-only src/index.ts`（PID **77171**，日志 `instance-5792.stdout.txt`）
`curl -s http://127.0.0.1:5792/health` ⇒ `{"ok":true,"db_version":"PostgreSQL 18.6 …","schema_version":"0043"}` ✓

---

## §1 逐字对拍（`0020` vs `0034` vs `0044`）

**方法**：从三份迁移里各自抽出 `ledger_post_event(payload jsonb)` 的**美元引用函数体**（delimiter 之间的逐字内容），算字节/字符/md5/`listing_deposit` 计数并做 `difflib` 逐行对拍（脚本 `funcbody-diff-0020-0034-0044.txt`）。

| 迁移 | delimiter | 函数体 bytes | 函数体 chars | 行数 | md5 | `listing_deposit` 计数 |
|---|---|---|---|---|---|---|
| `0020` | `$function$` | 51409 | 45578 | 971 | `c597a280c9492030f89010e66ae5a90d` | **0** |
| `0034` | `$fn$` | **54245** | **47966** | 1015 | `2d666475f07603b679c2d57d757f5177` | **1** |
| `0044` | `$fn$` | **54227** | **47948** | 1015 | `70dd52043dcb3254fbbf5745d0d34c3a` | **0** |

> 口径注：Postgres `length(prosrc)` 报的是**字符数**（`47968`），字节数为 `54247`；二者差 = 函数体里的多字节中文注释。`0034` 函数体 `47966` 字符 / `54245` 字节、`0044` 函数体 `47948` 字符 / `54227` 字节 ⇒ **S50 的「`0034` 47966 → `0044` 47948」是字符口径，与本单逐字符串口径一致**（本单以字节口径复核为 `54245 → 54227`）。

**`diff 0034 → 0044`（恰 11 行 diff，唯一改动 1 行）**：

```diff
@@ -543,7 +543,7 @@
     FOR v_rec IN
       SELECT t.e->>'uid' AS g_uid, t.e->>'cid' AS g_cid, t.e->>'kind' AS g_kind
         FROM jsonb_array_elements(v_entries) AS t(e)
-       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')
+       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund')
        GROUP BY 1, 2, 3
       HAVING count(*) <> 2
     LOOP
```

⇒ **字节差 = `54227 − 54245` = −18 B（= 字符 −18）· 变化恰 1 行 ✓**。函数体其余部分（含 `0034` 新增的 `op` 白名单 `'burn'` / `burn` 分支 / `total_supply` 双写 / C8 `burn` 回执）**逐字未动**。

**`diff 0020 → 0034`（89 行 diff · 这是 B23 的成因）**：`0034` 相对 `0020`
① `op` 白名单加 `'burn'`；
② 新增 `ELSIF v_op = 'burn' THEN` 分支（锁 currency → 单边负额 `ledger_norm_entry`）；
③ **hold 家族守卫 IN 列表写回 `,'listing_deposit'`**（`0020` 已删、`0034` 恢复）；
④ `mint` 双写扩为 `mint`/`burn` 双写（`total_supply ± v_amount`）；
⑤ 回执新增 `burn` 分支。

**三条结论（B23 因果链）**：
1. **`0020` 是有意删除** —— 其函数体 `listing_deposit` 计数 = **0**；头注逐字自陈「原 `…,'job_escrow_refund','listing_deposit')` → `…,'job_escrow_refund')`」。
2. **`0034` 是最后一个 `CREATE OR REPLACE` 者** ⇒ 以 `0012` 为底重建、**未继承 `0020` 的删除** ⇒ 计数回到 **1**。
3. **`0044` = 逐字重放 `0020` 的那一处删除** ⇒ 计数回到 **0**，且 `0034` 的 `burn` 等改动**全部保留**（diff 仅 1 行）。

**活库抽验**：`dump-prosrc.ts` 现取 `prosrc` 原文 = `54247` B / `47968` chars / md5 `3737e0f8ef4f2bbfffd973f16ce47fb8`（与库内 `md5(prosrc)` 逐字同）；`grep -c listing_deposit` = **1**，命中行 = `WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')`（`live-prosrc.txt:547`）⇒ **活库函数体 == `0034` 文件体（`\n` + 函数体 + `\n`）** ✓ ⇒ **回归确在线上**。

---

## §2 `0044` 全文与自检设计

- **文件**：`backend-ts/migrations/0044_restore_listing_deposit_leg.sql` · `sha256 937af17fdaf886f6e8767941aec3f2859d93a262eb1a4a062f6ab2c2600bbee6` · **63895 B**
- **【一行为】**：以 `0034` 版 `ledger_post_event(jsonb)` 为底，**仅**从 hold 家族守卫 IN 列表删除 `,'listing_deposit'`（`0034:594`）；其余函数体字节逐字不动 ⇒ **= 逐字重放 `0020` 的删除**。
- **【本迁移不做什么】**（逐字转录自文件头）：
  - 不新增/删除 kind（kind 关闭集不变）；不改任何平台账户白名单格；不改表结构/触发器/索引
  - **不写任何业务数据**（文件不含对业务表的 `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`）
  - 不改 `0001`–`0043` 任何文件（checksum 漂移 ⇒ `migrate.ts` 整链 ABORT / exit 3）
- **幂等 / 可重入**：`CREATE OR REPLACE FUNCTION` + 纯只读 `DO` 自检 ⇒ 重复应用（含独立重跑）安全。
- **自带 apply-time 自检（静态 + 只读行为，缺一不算通过）**：

| # | 自检内容 | 修前 | 修后期望 |
|---|---|---|---|
| ① | `prosrc` 里 `listing_deposit` 出现次数 | 1 | **0** |
| ② | 列表其余 4 项 + 闭合括号逐字仍在 | — | `('hold','hold_release','job_escrow','job_escrow_refund')` |
| ②b | `0034` 回归形态 `,'job_escrow_refund','listing_deposit')` **不在场** | 在场 | **不在场** |
| ③ | 同账户 2 腿守卫本体仍在 | — | `HOLD_PAIR_REQUIRED` + `HAVING count(*) <> 2` |
| ④ | `0034` 改动未被回退 | — | `op` 白名单含 `'burn'` + `total_supply - v_amount` 双写在场 |
| ⑤ | 签名/返回类型 | — | `<payload jsonb> -> jsonb` |
| ⑥ | `0019` 的 `-1` credit 白名单仍生效 | — | `listing_deposit` 放行 / `commission` 拒 / `-1` debit 拒 |

> 注：自检 ⑥ 要求「`listing_deposit` 放行」—— 这与「从 hold 守卫删 `listing_deposit`」并不矛盾：⑥ 管的是 `0019` **平台（`uid=-1`）credit 白名单**（跨账户腿的收款方 `uid=-1` 需被放行），① / ②b 管的是 `ledger_post_event` 内 **hold 家族同账户 2 腿守卫**（该守卫不应把跨账户的 `listing_deposit` 纳入）。

---

## §3 计数前推逐处

**`MIGRATIONS_FROZEN` 全仓现取**（`grep -rn "MIGRATIONS_FROZEN =" scripts/`）：

```
scripts/p8-s3-deposit-gate.ts:85:      const MIGRATIONS_FROZEN = 43;
scripts/p8-s3b-address-gate.ts:74:     const MIGRATIONS_FROZEN = 43;
scripts/p8-s4-currency-review-gate.ts:72: const MIGRATIONS_FROZEN = 43;
scripts/p8-s5-compliance-gate.ts:81:   const MIGRATIONS_FROZEN = 43;
```

| # | 文件:行 | 断言 | 常量 | 前推出处（门内注释，逐字转录） |
|---|---|---|---|---|
| 1 | `p8-s3-deposit-gate.ts:85` | `E6`（`noRefundSurface`）`migFiles.length === MIGRATIONS_FROZEN` | 42 → **43** | `★ S50 台账 B23 修法 A 门前推：迁移文件数 42 → 43（+0044_restore_listing_deposit_leg …**未 apply**）` |
| 2 | `p8-s3b-address-gate.ts:74` | `G4`（`noRefundSurface`）`migFiles.length === MIGRATIONS_FROZEN` | 42 → **43** | 同上 |
| 3 | `p8-s4-currency-review-gate.ts:72` | `H1`（`migration`）`migFiles.includes('0025…') && migFiles.length === MIGRATIONS_FROZEN` | 42 → **43** | 同上 |
| 4 | `p8-s5-compliance-gate.ts:81` | `H1`（`migration`）`migFiles.includes('0026…') && migFiles.includes('0027…') && migFiles.length === MIGRATIONS_FROZEN` | 42 → **43** | 同上 |

- **`= 42` 残留 = 0**（`grep -rn "MIGRATIONS_FROZEN = 42" scripts/` ⇒ none）✓
- **迁移文件数 = 43** ✓ ⇒ **常量 == 文件数**（4 处一致）✓
- **未删任何断言** ✓（4 处均为「改数值」，断言语义不变）

**★ 口径澄清（本单新证，重要）**：4 处的 `migFiles` 定义为 **`fs.readdirSync(backend-ts/migrations).filter(f => f.endsWith('.sql'))`**（= **迁移文件数**），**不是** `schema_migration` 行数。故该常量在此 4 门中**与库面 42 行无关**（详细后果见 §5）。

---

## §4 离线预演读数（含活库零变化自证）

> **来源**：S50 的「事务内 apply `0044` 全文 ⇒ 断言 ⇒ 末尾 `ROLLBACK`」预演（转录自主计划 §5.380）。**本单做了独立只读抽验**（见末尾）。

**预演三态**：

| 态 | 读数 |
|---|---|
| **改前**（`0034` 版函数体） | `LD016 / LEDGER_AMOUNT_INVALID · reason=HOLD_PAIR_REQUIRED`（`{cid:1, uid:970001, kind:listing_deposit, field:entries}`）· **零副作用** |
| **改后**（事务内 apply `0044`） | **`guard_error = null`（不再 LD016）** · `applied = 1` · **`owner −60000`**（`currency_create_fee` 10000 + `listing_deposit` 50000）/ **`uid=-1 +60000`（守恒）** · **4 条分录逐字**（`currency_create_fee` 两腿 + `listing_deposit` 两腿） |
| **`ROLLBACK` 后** | 活库**逐项回基线**：`prosrc` md5 回 `3737e0f8…` · `schema_migration` **42 行 / max 0043** · `ledger_entry` **504** · `currency` **15** · `currency_review_log` **0** |

**序列成本登记**（`nextval` 不回滚 ⇒ 成本非残留）：`ledger_entry_txid_seq` **2823 → 2828**（+5）· `currency_review_log_log_id_seq` **65 → 66**（+1）。

**★ 本单独立抽验（只读，复现预演 post-rollback 基线）**：

| 对拍项 | 预演 post-rollback | 本单现取 | 一致？ |
|---|---|---|---|
| `prosrc` md5 | `3737e0f8…` | `3737e0f8ef4f2bbfffd973f16ce47fb8` | ✓ |
| `schema_migration` | 42 行 / max `0043` | 42 / `0043` | ✓ |
| `ledger_entry` | 504 | 504 | ✓ |
| `currency` | 15 | 15 | ✓ |
| `currency_review_log` | 0 | 0 | ✓ |

⇒ **「预演后活库零变化」成立**（现取 == 预演前基线，逐项相同）✓。`ledger_entry_txid_seq` 现取 = `2828`（= 预演后的值，未被后续回退）——与「`nextval` 不回滚」一致。

---

## §5 探针与全量门对照

### §5.1 两探针（本单复跑，受控实例 `5792`）

| 探针 | 命令 | exit | 读数 | 定性 |
|---|---|---|---|---|
| **`s5-01`** | `npx ts-node --transpile-only scripts/p8-s5-01-real-chains.ts` | **0** | **total 84 / passed 84 / failed 0** | ✅ **仍绿（84/84）**，与 S49 前推后一致 |
| **`s3-01`** | `npx ts-node --transpile-only scripts/p8-s3-01-effective.ts` | **1** | **total 35 / passed 24 / failed 11** | 🔴 **行为段仍红（11 红全在 `behavior` 组）** |

`s3-01` 的 11 个红点逐条（全属 `S4-*` 行为段）：

```
S4-before-applied-1 · S4-before-owner-decrease · S4-before-pool-increase · S4-before-deposit-legs
S4-after-applied-1  · S4-after-owner-decrease  · S4-after-pool-increase  · S4-after-deposit-legs
S4-two-readings-differ · S4-two-readings-computable · S4-fail-closed-behavior
```

**为何属预期**：该段判据要求「改前读数」与「改后读数」**两者可计算且必须不同**（改前 `LD016`、改后 `guard_error=null`）。因 `0044` **未 apply** ⇒ 活库函数体仍是 `0034` 版 ⇒ **两次读数都在下游闸被拒**（`S4-two-readings-differ` 红）。逐条红点均带 **B23 签名**：

```
code = LD016 · message = LEDGER_AMOUNT_INVALID
detail = {"cid":"1","uid":"970001","kind":"listing_deposit","field":"entries","reason":"HOLD_PAIR_REQUIRED"}
```

⇒ **11 红 = 「`0044` 未 apply」的直接后果（属预期，非回归；探针侧零产品改动口径下不可消）**。`s3-01` 的 `defects[]` 亦逐字登记该 `LD016`。探针侧自证（零残留 **8/8**、`rollback_discipline` = 事务内 + 末尾哨兵 `ROLLBACK`）保持不变。

**并登记序列成本**（`s3-01` 现取）：`currency_review_log_log_id_seq` `66 → 69`（+3，本片造 approved 复核行）· `ledger_entry_txid_seq` `2828 → 2828`（+0，本片 apply 被下游闸拒 ⇒ 未消耗）。

`s5-01` 无红点。

### §5.2 16 门全量对照（受控实例 `5792` 相位）

**门套口径**（`docs/OPEN-ITEMS.md` §C，2026-10-05 起 = 16 门）：13 基线（`p8-s1 · s2 · s3 · s3b · s4 · s5-02 · s5 · s6 · s7 · s8 · s9 · s10 · s11`）＋ `s36-00` ＋ `p7b-03` ＋ `s41-00`。
**runner**：`run_gates_s50b.sh`（base URL 全 env 覆写为 `http://127.0.0.1:5792`；`export PORT=5792 P8S5_HTTP_MODE=after`）。**逐门 stdout/stderr/exit 见 `gates/`；summary 见 `summary.tsv`**。

| # | 门 | exit | 读数 | 判定 |
|---|---|---|---|---|
| 1 | `p8-s1-app-config` | 0 | total 24 / passed 24 / failed 0 | ✅ 绿 |
| 2 | `p8-s2-fee-rebate` | 0 | total 44 / passed 44 / failed 0 | ✅ 绿 |
| 3 | `p8-s3-deposit` | 0 | total 45 / passed 45 / failed 0 | ✅ 绿（**原预期红**） |
| 4 | `p8-s3b-address` | 0 | total 38 / passed 38 / failed 0 | ✅ 绿（**原预期红**） |
| 5 | `p8-s4-currency-review` | 0 | total 79 / passed 79 / failed 0 | ✅ 绿（**原预期红**） |
| 6 | `p8-s5-02-ownership` | 0 | total 6 / passed 6 / failed 0（mode=`after`） | ✅ 绿 |
| 7 | `p8-s5-compliance` | 0 | total 117 / passed 117 / failed 0 | ✅ 绿（**原预期红**） |
| 8 | `p8-s6-site-text` | 0 | total 64 / passed 64 / failed 0 | ✅ 绿 |
| 9 | `p8-s7-batt-checkin` | 0 | total 60 / passed 60 / failed 0（pending_apply=0 · db=8 · http=9） | ✅ 绿 |
| 10 | `p8-s8-rating-timeliness` | 0 | total 92 / passed 92 / failed 0（pending_apply=0 · db=13 · http=11） | ✅ 绿 |
| 11 | `p8-s9-bttc` | 0 | total 100 / passed 100 / failed 0（db=10） | ✅ 绿 |
| 12 | `p8-s10-invite-reward` | 0 | total 49 / passed 49 / failed 0（db=3 · http=3） | ✅ 绿 |
| 13 | `p8-s11-audit-console` | 0 | total 87 / passed 87 / failed 0（db=6 · http=6） | ✅ 绿 |
| 14 | `s36-00-identity-pk-form` | 0 | 受体 191 / 命中 30 / 基线 30 / **新增 0** GREEN | ✅ 绿 |
| 15 | `p7b-03-offline-gates` | 0 | AC 全绿（含注入 503 `LEDGER_TX_TIMEOUT` 负对照） | ✅ 绿 |
| 16 | `s41-00-identity-seq-collision` | 0 | 受体 23 / 读数 23 / **违例 0** / 基线 23 / 新增 0 / 阈值 1000 GREEN | ✅ 绿 |

**⇒ 实测 16/16 全绿（含 5 门真 HTTP 腿：`s5-02` / `s7` / `s8` / `s10` / `s11` 全绿）。**

### §5.3 ★★ 关键更正：「4 门 apply 前预期红」**经现取证伪**

**台账口径（§5.380 B / `OPEN-ITEMS` B23 行）原文**：「`MIGRATIONS_FROZEN` 常量（43）> 库（42）⇒ 那 4 道门在 apply 前会红（预期、非回归）」。

**现取结果：4 门全部 `exit 0`（绿），无一红。** 逐门红点定位 = **无红点**，各门迁移计数断言的实际读数如下：

| 门 | 断言 id | expect | **actual（文件数）** | pass |
|---|---|---|---|---|
| `p8-s3-deposit` | `E6` | 迁移文件数仍 = 43 | `43` | **True** |
| `p8-s3b-address` | `G4` | 迁移文件数仍 = 43 | `43` | **True** |
| `p8-s4-currency-review` | `H1` | 总数 = 43 | `{"count":43,"has":true}` | **True** |
| `p8-s5-compliance` | `H1` | 总数 = 43 | `{"count":43,"has":["0026…","0027…"]}` | **True** |

**根因（为何不红，证据链）**：
1. 该 4 门的计数判据右值 = **迁移文件数**（`fs.readdirSync(migrations).filter(.sql)`），**不是** `schema_migration` 行数（门内注释自陈「迁移**文件数**仍 = 43」）。
2. S50 **同时**做了两件事 —— 新增 `0044` 文件（文件数 42→43）**且**把常量前推到 43 ⇒ **文件数 == 常量 == 43** ⇒ 断言**恒真**。
3. 该 4 门是**纯离线门**（`grep -nE "src/db|readQuery|withTransaction|schema_migration"` **零命中**）⇒ **结构上观测不到库面 42 行**。故「常量 > 库行数」在此 4 门**不构成任何判据**。

⇒ **「4 门 apply 前预期红」的判断不成立**；台账该句需以「判据 = 文件数而非库行数」更正（本单未改台账/主计划，仅此报告留痕）。

### §5.4 ★ 反向风险登记（apply 后才会红的门）

库面**硬编 `schema_migration = 42 行 / max 0043`** 的门是 **`p8-s9 K5` / `p8-s10 K2` / `p8-s11 K1`**（**不**是 §5.3 那 4 门）：

| 门 | 断言 id | expect | 现取 actual | 现判定 | **apply `0044` 后** |
|---|---|---|---|---|---|
| `p8-s9-bttc` | `K5` | `schema_migration` = **42 行** · max = `0043` | `{"n":42,"mx":"0043"}` | ✅ 绿 | 🔴 **将红**（库变 43 行 / `0044`） |
| `p8-s10-invite-reward` | `K2` | 同上 | `{"n":42,"mx":"0043"}` | ✅ 绿 | 🔴 **将红** |
| `p8-s11-audit-console` | `K1` | 同上 | `{"n":42,"mx":"0043"}` | ✅ 绿 | 🔴 **将红** |

⇒ **apply `0044` 时，`p8-s9/s10/s11` 三门的库面版本断言须同批前推 `42 行/0043 → 43 行/0044`**（与 S27 当年 `41/0042 → 42/0043` 同族动作），否则 apply 后三门必红。**本单已在 §5.4 具名登记（不派单、不改门）。**

---

## §6 判负

1. **`0044` 自带 apply-time 自检（静态 + 只读行为）**：§2 表内 ①–⑥ **双向可判负** —— 若 `0044` 未真正删除 `listing_deposit`（① 期望 0）、或误删其余 4 项/闭合括号（②）、或回退了 `0034` 的 `burn` 改动（④）、或放宽了 `0019` 平台白名单（⑥），**自检必 RAISE**。
2. **门内 `selftest`（类级负对照，谓词喂错值 ⇒ 必须转红）**：本单 16 门中带 `__selftest` 的 12 门**全部通过**（逐门条数）：

   `s2 7 · s3 4 · s3b 5 · s4 9 · s5 10 · s6 7 · s7 9 · s8 12 · s9 20 · s10 8 · s11 14`（`s1`/`s36-00`/`p7b-03`/`s41-00` 的负对照以独立形实现，均绿）。

   ⇒ 「假门」风险被本批负对照逐门压住。
3. **`s3-01` 的 fail-closed 负向臂**：`S4-fail-closed-behavior` 在「下游闸拒」时**必须红** —— 本单现取红 ⇒ 负向臂在场且被触发（未空转/未伪装绿）。
4. **S50 的判负自曝（转录，S49→S50 同族）**：`0020` 时代的判负脚本用**子串替换**误命中了两行「旧值留痕」注释 ⇒ 已 `patch` 修回并与前推版备份 `diff` **逐字节相同**（主计划 §5.378 E）。★ 教训：「**子串类判据会把注释里的关键字当命中**」——本单 §1 的逐字对拍**改用美元引用函数体区间 + `difflib` 行级 diff**，规避了该类误判。

---

## §7 未做与 `NOT_MEASURED`（**上单 `not_measured` 逐条落入，不洗白**）

| # | 项 | 状态 | 依据/说明 |
|---|---|---|---|
| 1 | **`0044` 未 apply** ⇒ apply 后的**活库效果** = `NOT_MEASURED` | **未做（口径红线）** | apply 需 Kevin 一句话（**库 = 生产库**）。本单**一次未跑** `migrate apply`；§0 自证库仍 `0043 / 42 行` |
| 2 | **`0020` 头注自陈「字节差 = 17」而实测 = 18** ⇒ `0020` 该数字**不准** | **如实登记（本单未改 `0020`）** | `0020:46` 逐字：「脚本内断言：仅 1 行变化、**字节差 = 17**」；本单现取 = **18**（§1）。属 `0020` 注释数字错误，**非产品缺陷**；处置权归台账 |
| 3 | **S50 的 16 门全量未跑（截断）** | **本单已补** | §5.2 ⇒ 16/16 全绿（受控实例 `5792`）。**但 S50 当单确实未跑**，此处照录 |
| 4 | **`admin_settings_write` 面** = `NOT_MEASURED` | **未测（设计红线）** | `键级寻址线格式未冻结 ⇒ 不跑真 POST /api/admin/settings`（逐字取自 `s3-01` 的 `http_surfaces`） |
| 5 | **`currency_list` 面** = `NOT_MEASURED` | **未测（设计红线）** | `跑真 POST /api/currency/:cid/list 会永久改线上状态 ⇒ 只走事务内同路径 DB 函数`（同上） |
| 6 | **序列成本不可回滚**（`nextval` 不回退） | **登记为成本，非残留** | 预演：`txid 2823→2828`（+5）· `crl 65→66`（+1）；本单探针：`crl 66→69`（+3）· `txid ±0`。**无行落库**，序列单调前进不可逆 |
| 7 | **`0044` 的真实 apply 时序**（`migrate.ts` 逐版本跑 / checksum 链） | `NOT_MEASURED` | 未 apply ⇒ 未观测 `migrate.ts` 对 `0044` 的登记/断链行为；§2 的「不改 `0001–0043`」是**静态**保证 |
| 8 | 本单对**产品链端到端**（真 POST `/api/currency/:cid/list`） | `NOT_MEASURED` | 同 #5 红线（永久改线上状态） |

**本单硬口径复述**：未改任何代码/迁移/谱/台账/主计划（`git status` 仅新增报告 + `.s50b-artifacts/`）· 未 apply · 未 commit/push · 未 `npm install` · 未用 `pkill -f`/`killall`。

---

## §8 自曝

1. **★★ 我（Kong）现取证伪了本单派单里的「4 门 apply 前预期红」** —— 实测 4 门全绿（§5.3）。**根因是台账口径把「迁移文件数」当成了「库行数」**：那 4 门的计数判据右值是 `readdirSync(migrations)`（文件数 43），且该 4 门纯离线（不连库）⇒ 观测不到库面 42。**这属台账/主计划的表述错误，非产品缺陷**；按硬口径 ①我未改台账，仅在本报告 + §5.4 具名留痕，请 Zang/Kevin 裁定更正。
2. **★ 同时我登记了真正的「apply 后才会红」的门 = `p8-s9/s10/s11`**（库面硬编 42 行 / `0043`）—— 这与台账的预期**方向相反**。若不登记，apply 那天会误判为「新回归」。
3. **S50 的 `not_measured` 我一条未洗白**（§7 全表；含「16 门未跑」「`0020` 字节差 17≠18」「两处 HTTP 面 `NOT_MEASURED`」「序列成本」）。其中「16 门未跑」由本单补跑补齐，但**如实标注了它当单未跑**。
4. **`s3-01` 行为段 11 红在未 apply 下不可消** —— 属预期（§5.1），**我未放宽判据、未删断言、未伪造绿**。
5. **口径自曝（数字折算）**：主计划 §5.380 的「`0034` 47966 → `0044` 47948」是**字符口径**；本单以**字节口径**复核为 `54245 → 54227`（差同为 −18）。两者**不冲突**（差 = 多字节中文注释），本报告已在 §1 显式标注双口径，避免后续误读为「数字对不上」。
6. **未做而登记**：`0044` 的 apply 后活库效果、`migrate.ts` 登记时序、两处 HTTP 写面 —— 全部归 `NOT_MEASURED`（§7），**不由推测充数**。

---

## 附：本单产物清单（`backend-ts/.s50b-artifacts/s50b-20261007T013539Z/`）

| 文件 | 内容 |
|---|---|
| `anchor/anchor.txt` | git log/status/HEAD · `0044` sha256/字节 · 迁移文件数 |
| `db-anchor.json` + `.stderr.txt` | 活库只读对锚（`db-anchor-probe.ts`） |
| `dump-prosrc.ts` + `live-prosrc.txt` | 活库 `ledger_post_event` `prosrc` 原文（逐字对拍） |
| `funcbody-diff-0020-0034-0044.txt` | 三迁移函数体逐字对拍 + difflib diff（脚本 `~/.hermes/…/scratch/s50b_fnbody.py`） |
| `run_gates_s50b.sh` + `summary.tsv` | 16 门 runner 与逐门 summary |
| `gates/<gate>.{stdout.txt,stderr.txt,exit}` | 16 门逐门原始输出 + 退出码 |
| `probes/s5-01-real-chains.*` / `s3-01-effective.*` | 两探针 stdout/stderr |
| `instance-5792.stdout.txt` | 受控实例启动日志（PID 77171） |

**端口收尾**：见本单回执（`lsof` 验 `5792–5799` 全空；`5787/5788/5555/5191` 四条他人端口无恙）。
