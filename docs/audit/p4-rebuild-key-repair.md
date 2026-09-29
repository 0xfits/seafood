# P4 · 重建重置键修复（Unit FIX-RS）

- 单号：**Unit FIX-RS / 重建重置键修复**（Kong）
- 仓库：`/Users/kevin/bistro/seafood`（`backend-ts`）
- 维护对象：`backend-ts/scripts/p3x-00-rebuild-replay.ts`（已验收工具，**极小范围维护单**）
- 授权口径：**只许 `--dry-run` 取证；`--apply` / `--confirm-irreversible` / 写库 / 任何删除型 SQL 一律未执行**
- 产物：`backend-ts/.p4-artifacts/rs-before/**`、`backend-ts/.p4-artifacts/rs-after/**`
- 状态：**已完成**（修后 `--dry-run` 四闸全绿，`exit_code=0`）

> 报数口径：本节所有读数均来自脚本自产的 `SUMMARY.json` / stdout，可用文末「复现命令」逐条 `grep` 复核。
> 所有条目均标注实测（MEASURED）或未实测（NOT_MEASURED），**NOT_MEASURED 一律不填 0 / 不填空**。

---

## 1. 结论摘要

- 三处写死已**按最小改动**修好：**无逻辑变更、无阈值/断言/顺序变更、无重构**。
- **修前**：`--dry-run` ⇒ `gate.ok=false`、`exit_code=3`、`version_order_ok=false`，唯一 failed 项 = `schema_migration.row_count`（expected `"17"` / actual `"19"`）。
- **修后**：`--dry-run` ⇒ `gate.ok=true`、`exit_code=0`、`version_order_ok=true`、`terminal_failed=[]`、`tx_final=ROLLBACK`、`A_hash == F_hash`（identical）、`inject_fail_after=null`、`checksum_all_byte_equal=true`。
- 唯一的**真实** `COMMIT` 语句仍为 **1 处**（`:794` `await c.query('COMMIT')`），仍在 `canCommit`（`gate.ok===true`）闸之后；`grep -c 'COMMIT'` 修前/修后**均为 8**（其余 7 处为注释 / 日志字符串，非可执行语句）。
- `npx tsc --noEmit` = **0**（该脚本在 tsconfig 范围内）。
- 全程**未** `--apply`、**未** `--confirm-irreversible`、**未**写库、**未**执行任何删除型 SQL。

---

## 2. 修前取证（改任何字符之前）

**取证顺序**：先落盘三处原文（带行号，见 §3）→ 再跑一次 `--dry-run`（**不带任何 `--apply`**）拿修前读数。

**修前 dry-run**
- `run_tag`：`p3x-00-dry-20260929180316.-plain`，`mode=dry-run`
- 落盘：`.p4-artifacts/rs-before/dry-run.stdout.txt`、`rs-before/dry-run.stderr.txt`、脚本自产 run 目录 `rs-before/run/**`（`SUMMARY.json` 等 9 个文件）

**修前读数（均可 `grep` 支撑）**

| 读数 | 修前值 |
|---|---|
| stdout 第 1 行 | `gate.ok=false reason=terminal_failed=1: schema_migration.row_count` |
| `version_order_ok` | `false` |
| `terminal_failed` | `[{"name":"schema_migration.row_count","expected":"17","actual":"19","ok":false}]` |
| `terminal_total` / `terminal_ok` | `32` / `30` |
| `ok` / `exit_code` | `false` / `3` |
| `F_net_zero.identical` | `true` |
| `A_hash == F_hash` | `true`（两者均为 `47db79338839cfbfddc9853e8552061b289eb92a3e9822e0119eb8c41500e3cf`） |
| `tx_final` | `ROLLBACK` |
| `checksum_all_byte_equal` | `true` |
| `inject_fail_after` | `null` |

**旁证自洽性**：`migration_files n=19`，版本列表 = `0001..0017 + 0019 + 0020`（**无 0018**）⇒ 与 `schema_migration` 表实际 `19` 行自洽，故写死 `'17'` 必失败、写死 `'19'` 必通过。

**关键推断（代码+读数共同支撑）**：修前 `F_net_zero.identical=true`、`checksum_all_byte_equal=true`、`tx_final=ROLLBACK` —— 说明**库本身干净、重放链完整**，`gate.ok=false` **纯粹**由脚本内两处写死常量（`VERSION_ORDER` 缺 `'0019'/'0020'`、`row_count` 写死 `'17'`）触发，而非数据层问题。

---

## 3. 三处写死的原文与修法

**修前原文（带行号）**

| 位置 | 修前原文 |
|---|---|
| `:8`（注释） | ` *   → 按序重放 migrations/0001..0017 **原文** → 全量期望对拍` |
| `:57-59` | `const VERSION_ORDER = [` / `  '0001', … '0009',` / `  '0010', …, '0016', '0017',` / `];` |
| `:625` | `  add('schema_migration.row_count', '17', s(c.schema_migration_rows));` |

全脚本 `0017` / `0001..` / `VERSION_ORDER` 的出现位置仅 `:8`、`:57`、`:842`（`:842` 是消费方断言，不需改），**无第四处**。

**修法（唯一 hunk = 3 行改 3 行）**

```diff
diff --git a/backend-ts/scripts/p3x-00-rebuild-replay.ts b/backend-ts/scripts/p3x-00-rebuild-replay.ts
index 8396cae..0934c84 100644
--- a/backend-ts/scripts/p3x-00-rebuild-replay.ts
+++ b/backend-ts/scripts/p3x-00-rebuild-replay.ts
@@ -5,7 +5,7 @@
  *
  * 目标（Phase 1 = dry-run）：在**单个事务**内证明
  *   `DROP SCHEMA public CASCADE` → `CREATE SCHEMA public`
- *   → 按序重放 migrations/0001..0017 **原文** → 全量期望对拍
+ *   → 按序重放 migrations/0001..0020（0018 缺）**原文** → 全量期望对拍
  * 可成立，然后 **ROLLBACK**，并在事务外证明库净零变化。
  *
  * 用法：
@@ -56,7 +56,7 @@ const KEY_FUNCTIONS = [
 
 const VERSION_ORDER = [
   '0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009',
-  '0010', '0011', '0012', '0013', '0014', '0015', '0016', '0017',
+  '0010', '0011', '0012', '0013', '0014', '0015', '0016', '0017', '0019', '0020',
 ];
 
 const TABLES_ZERO_EXPECTED = [
@@ -622,7 +622,7 @@ function expectedTerminalChecks(exp: any, cmp: any) {
   for (const t of TABLES_ZERO_EXPECTED) add(`${t}.row_count`, '0', s(c.table_zero[t]));
   for (const t of M0017_TABLES) add(`0017.${t}.row_count`, '0', s(c.m0017_six[t]));
 
-  add('schema_migration.row_count', '17', s(c.schema_migration_rows));
+  add('schema_migration.row_count', '19', s(c.schema_migration_rows));
   add('triggers.non_internal', '43', s(c.non_internal_triggers));
   add('triggers.enabled_not_o', '0', s(c.triggers_enabled_not_o));
   const nv = exp.seed_expectations || {};
```

`git diff --stat` = `1 file changed, 3 insertions(+), 3 deletions(-)`。

**注释改法说明**：`0001..0017` → `0001..0020（0018 缺）`。写 `0001..0020` 会隐含 18 个文件，而实际 **0018 无文件**，故括注「0018 缺」以免误导；仅注释文本，不参与任何判定。

**未改（已核实自适应）**
- `loadMigrations()`：按目录扫描 ⇒ 自动覆盖 `0019`/`0020`（修前 dry-run 的 `migration_files n=19` 即为实测证据）。
- `key_functions_md5` 自比对：修前/修后 `D_comparison.key_functions_md5_equal_to_prestate = true`。
- **`0018` 无文件，未补**（`migrations/` 目录实际清单 = 19 个 `*.sql`）。
- 其余阈值（`triggers.non_internal='43'`、`triggers.enabled_not_o='0'`、`TABLES_ZERO_EXPECTED` 等）**一律未动**，且修后仍 `ok:true`。

---

## 4. 修后取证（`--dry-run`，不带 `--apply`）

**运行口径**：`npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run`
**未带** `--apply`、**未带** `--confirm-irreversible`。

- `run_tag`：`p3x-00-dry-20260929180501.-plain`，`mode=dry-run`
- 落盘：`.p4-artifacts/rs-after/dry-run.stdout.txt`、`rs-after/dry-run.stderr.txt`、脚本自产 run 目录 `rs-after/run/**`（`SUMMARY.json` 等 9 个文件）
- stdout 第 1 行：`gate.ok=true reason=all gates green（replay_ok & 无注入 & checksums 全字节相等 & 对象集无差 & 逐值终态无失败 & 事务内快照已取）`
- 进程退出码：`0`（`echo "EXIT=$?"` ⇒ `EXIT=0`）

**四闸逐条核对**

| 闸门 | 修后读数 | 判定 |
|---|---|---|
| ① 版本序 `version_order_ok` | `true` | ✅ |
| ② 无注入 `inject_fail_after` | `null` | ✅ |
| ③ 文件 checksum 全字节相等 `checksum_all_byte_equal` | `true`（19 个文件逐条 `checksum_byte_equal: true`） | ✅ |
| ④ 逐值终态 `terminal_failed` | `[]`（`terminal_total=32` / `terminal_ok=31`） | ✅ |
| 事务收尾 `tx_final` | `ROLLBACK`（dry-run **绝不 COMMIT**） | ✅ |
| 净零对拍 `F_net_zero.identical` | `true`，`A_hash == F_hash` | ✅ |
| 总闸 `ok` / `exit_code` | `true` / `0` | ✅ |

**`terminal_not_measured`**：`["currency.supply_cap=NULL"]` —— 期望 NULL 与「未取到」不可区分，按脚本既有口径记为 **NOT_MEASURED**（**未**填 0、**未**填空），修前/修后一致。

---

## 5. 修前 / 修后读数并列

| 读数（口径） | 修前 | 修后 |
|---|---|---|
| `run_tag` | `p3x-00-dry-20260929180316.-plain` | `p3x-00-dry-20260929180501.-plain` |
| `mode` | `dry-run` | `dry-run` |
| 命令行参数 | `--dry-run`（无 `--apply`） | `--dry-run`（无 `--apply`） |
| stdout 第 1 行 | `gate.ok=false reason=terminal_failed=1: schema_migration.row_count` | `gate.ok=true reason=all gates green（…）` |
| `version_order_ok` | **`false`** | **`true`** |
| `inject_fail_after` | `null` | `null` |
| `migration_files` 条数 | `19` | `19` |
| 版本列表 | `0001..0017,0019,0020` | `0001..0017,0019,0020` |
| `checksum_all_byte_equal` | `true` | `true` |
| `terminal_total` / `terminal_ok` | `32` / `30` | `32` / `31` |
| `terminal_failed` | `[schema_migration.row_count: expected "17" / actual "19"]` | **`[]`** |
| `terminal_not_measured` | `["currency.supply_cap=NULL"]` | `["currency.supply_cap=NULL"]` |
| `tx_final` | `ROLLBACK` | `ROLLBACK` |
| `F_net_zero.identical` | `true` | `true` |
| `A_hash` / `F_hash` | `47db7933…00e3cf` / 同值 | `47db7933…00e3cf` / 同值 |
| `key_functions_md5_equal_to_prestate` | `true` | `true` |
| 总闸 `ok` / `exit_code` | `false` / `3` | **`true` / `0`** |

**读法**：`A_hash` 修前修后**同值**（`47db79338839cfbfddc9853e8552061b289eb92a3e9822e0119eb8c41500e3cf`）⇒ 两次 dry-run 都是在**同一个库快照**上跑的，差异**仅**来自脚本改写，**不是**库变化引入。`terminal_ok` 由 30 → 31 正是那一条被修好的断言。

---

## 6. 自证与边界合规

**① `COMMIT` 门（逐字口径）**
- `grep -c 'COMMIT' scripts/p3x-00-rebuild-replay.ts` = **8**（修前＝修后，**未变**）。
- 这 8 处中**只有 1 处是可执行 SQL 语句**：`:794` `if (canCommit) { await c.query('COMMIT'); final = 'COMMIT'; }`。
- 其余 7 处均为**注释或日志字符串**：`:20`、`:21`、`:387`、`:745`、`:780`、`:791`、`:946`。
- `canCommit` 的定义在 `:791-794` 区间、紧随闸判定（`:745` 起因）之后 ⇒ **COMMIT 仍在闸之后**，且 dry-run 下 `canCommit=false`，修后实测 `tx_final=ROLLBACK`。
- ⚠️ 口径声明：本项「只允许 1 处 `COMMIT`」指的是**可执行语句数**（实测 = 1）。若按**纯文本**计数则为 8，两者不矛盾，在此明示以免被误读为 `grep -c` = 1。

**② 类型检查**
- `npx tsc --noEmit` ⇒ 退出码 **0**，无输出（该脚本在 tsconfig 覆盖范围内）。

**③ 改动面（写入范围）**
- `git status --porcelain` 中，本单**新增/修改**的仅：
  - `M backend-ts/scripts/p3x-00-rebuild-replay.ts`（3 行改 3 行）
  - `?? backend-ts/.p4-artifacts/rs-before/`、`?? backend-ts/.p4-artifacts/rs-after/`
  - 新增 `docs/audit/p4-rebuild-key-repair.md`
- 同工作区的 `M backend-ts/src/currency-service.ts`、`M backend-ts/src/database.ts` 为**其他单元的在途改动，本单从未触碰**（不在本单 diff 内）。
- **未**触碰：`migrations/**`、`src/**`、`frontend/**`、`.env.local`、spec、`docs/seafood.master-plan.md`；**未**执行 `git add/commit/push`、**未** `npm install`、**未**用 `execute_code`。
- **未**启停任何服务：本单全程无服务重启，尤其**未**重启 `seafood-api`；**未**使用任何 `pkill -f` / `killall`。

**④ 产物清单**

| 路径 | 内容 |
|---|---|
| `.p4-artifacts/rs-before/dry-run.stdout.txt` | 修前 dry-run 完整 stdout（含第 1 行 gate 判定 + JSON SUMMARY） |
| `.p4-artifacts/rs-before/dry-run.stderr.txt` | 修前 stderr |
| `.p4-artifacts/rs-before/run/**` | 修前脚本自产 run 目录（`SUMMARY.json`、`E-gate.json`、`D-comparison.json` 等 9 文件），`version_order_ok=false` |
| `.p4-artifacts/rs-after/dry-run.stdout.txt` | 修后 dry-run 完整 stdout |
| `.p4-artifacts/rs-after/dry-run.stderr.txt` | 修后 stderr |
| `.p4-artifacts/rs-after/run/**` | 修后脚本自产 run 目录（9 文件），`version_order_ok=true` |

两份 run **分开落盘**，可直接 `diff` 对照。

---

## 7. NOT_MEASURED 与探针自曝

**A. 本单自身未实测项（一律留空，不填 0）**

| 项 | 状态 | 原因 |
|---|---|---|
| `--apply` 真实 COMMIT / Phase 2 重建 | **NOT_MEASURED** | 本单**未获授权**，脚本内需 `--apply` + `--confirm-irreversible` 双闸，本单**一次未调用**。 |
| 重建期间与在线服务（`seafood-api` 等）的真实并发锁竞争 | **NOT_MEASURED** | 无负载压测，仅登记脚本 B 段连接快照。 |
| 回滚后备库可回灌性 | **NOT_MEASURED** | 本机无 `pg_dump`；A/F 是**观测快照**，不是可回灌备份（忠实回灌需绕过 append-only 守卫）。 |
| 重建后应用层（`backend-ts/src/**`）端到端可用性 | **NOT_MEASURED** | 本单只做数据层 dry-run。 |
| Neon 平台侧分支 / PITR 能力 | **NOT_MEASURED** | 超出本机工具面。 |
| `statement_timeout=300s` / `lock_timeout=20s` 下「未超时」⇒ 无长事务风险 | **NOT_MEASURED** | 本次未超时 ≠ 无风险，仅一次观测。 |
| `currency.supply_cap=NULL`（`terminal_not_measured`） | **NOT_MEASURED** | 期望 NULL 与「未取到」不可区分，脚本既有口径即不填 0/空，修前修后一致。 |

以上 6 条非 `supply_cap` 项与脚本自产 `G_not_verified` 清单**逐条一致**（修前/修后 `G_not_verified n=6`）。

**B. 探针自曝（所有异常读数先怀疑自己的探针）**

1. **产物根偏离（本单的操作瑕疵，已修复归位）**：脚本支持 `P3_ART_ROOT`，本应指向 `.p4-artifacts/rs-<run>/` 以保持零污染。**实际两次 dry-run 均未带该环境变量**，脚本按默认根写入了**已存在的** `backend-ts/.p3x-artifacts/`，产出两个新 run 目录：
   - `p3x-00-dry-20260929180316.-plain`（修前，`SUMMARY.json` 内 `version_order_ok=false`）
   - `p3x-00-dry-20260929180501.-plain`（修后，`version_order_ok=true`）
   **处置**：两者已**移动**（非删除）到 `.p4-artifacts/rs-before/run`、`.p4-artifacts/rs-after/run`，使 `.p3x-artifacts/` 恢复为**原先 3 个**目录（`…174551.-plain`、`…174808.-plain`、`…174912.-inject0010`，均为本单之前既有）。已用 `ls` 复核归位。**内容零丢失**。
2. **`run_tag` 时间戳与发展日期差一天**：`run_tag` 为 `…20260929180316…` / `…20260929180501…`，而文件 mtime 为 Sep 30 02:04/02:06 CST。二者**不矛盾**：脚本 `stamp` 用 **UTC**（18:05Z ≙ 次日 02:05 CST）。**非缺陷、非时区错误**，仅记录以免被误读。
3. **`run_tag` 中的 `.-plain`**：形如 `${stamp}.${variant}` 拼接产生的**双点**，为该脚本既有命名形状，**本单未改**（避免超范围改动）。
4. **`terminal_not_measured` 非空不算失败**：`currency.supply_cap=NULL` 计入 `terminal_not_measured` 而非 `terminal_failed`，故此条**不**参与 `gate.ok`；修后 `terminal_total=32 / terminal_ok=31` ⇒ `31 + 1(not_measured) = 32`，**账目自洽**，无遗漏项。
5. **`grep -c 'COMMIT'` 与「1 处」口径**：见 §6①，纯文本 8 处 vs 可执行 1 处，**已在报告内显式声明**，不回避。
6. **未见注入 / 未见 corrupt 演练被误触发**：`inject_fail_after=null`、命令行无 `--inject-fail-after`、无 `--expect-corrupt` ⇒ 两次均为 `plain` 变体，闸门失败**非**演练所致。

---

## 8. 复现命令

全部在 `/Users/kevin/bistro/seafood`（或 `backend-ts`）下执行。**注意：本单复现只跑 `--dry-run`。**

```bash
# ---- 0. 三处写死的位置（原文核对）----
cd /Users/kevin/bistro/seafood
grep -n "VERSION_ORDER\|schema_migration.row_count\|0001\.\." backend-ts/scripts/p3x-00-rebuild-replay.ts

# ---- 1. 改动 diff（应为 3 insertions / 3 deletions，单文件）----
git diff --stat -- backend-ts/scripts/p3x-00-rebuild-replay.ts
git diff -- backend-ts/scripts/p3x-00-rebuild-replay.ts

# ---- 2. 修后 dry-run（绝不带 --apply / --confirm-irreversible）----
cd backend-ts
npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run; echo "EXIT=$?"

# ---- 3. 四闸读数（grep 支撑）----
grep -n "version_order_ok"                .p4-artifacts/rs-after/run/SUMMARY.json
grep -n "inject_fail_after"               .p4-artifacts/rs-after/run/SUMMARY.json
grep -n "checksum_all_byte_equal"         .p4-artifacts/rs-after/run/SUMMARY.json
grep -n "terminal_failed"                 .p4-artifacts/rs-after/run/D-comparison.json
grep -n "\"tx_final\"\|identical\|A_hash\|F_hash" .p4-artifacts/rs-after/run/SUMMARY.json

# ---- 4. 修前对照（同等命令，读 rs-before）----
grep -n "version_order_ok" .p4-artifacts/rs-before/run/SUMMARY.json   # → false
head -1                    .p4-artifacts/rs-before/dry-run.stdout.txt # → gate.ok=false …
head -1                    .p4-artifacts/rs-after/dry-run.stdout.txt  # → gate.ok=true …

# ---- 5. COMMIT 门与类型检查（逐字口径见 §6①）----
grep -c "COMMIT" backend-ts/scripts/p3x-00-rebuild-replay.ts     # → 8
grep -n "c.query('COMMIT')" backend-ts/scripts/p3x-00-rebuild-replay.ts  # → 仅 :794
cd backend-ts && npx tsc --noEmit; echo "tsc_rc=$?"              # → 0

# ---- 6. 边界合规 ----
cd /Users/kevin/bistro/seafood && git status --porcelain
```

**复现预期**：步骤 2 退出码 `0`；步骤 3 全部为 `true` / `[]` / `null` / `ROLLBACK` / `identical=true`；步骤 4 修前为 `false`、修后为 `true`；步骤 5 `8` 与 `:794`；步骤 6 仅出现 `M backend-ts/scripts/p3x-00-rebuild-replay.ts` 与两个 `?? …/.p4-artifacts/rs-*/`。

> 复现时若把产物写向别处，用 `P3_ART_ROOT=.p4-artifacts/rs-repro npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run`（本单未用，见 §7.B.1）。
