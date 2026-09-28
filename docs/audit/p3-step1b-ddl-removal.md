# P3 第一步 b · 摘除第二条运行时 DDL 路径（ensureLegacyTableNames）

> 本单为**接手单**：上一任在 provider 端停摆被弃（见 §7），代码面已冻结，本单只补缺 —— 类级断言 + 正对照 + 报告全文回填 + 机读件。**未 commit / 未 git add / 未 push**。

- **执行**：Kong（实现者）
- **本单 run tag**：`20260928-123558` · 2026-09-28 CST
- **上一任 run tag**：`20260928-085717`（其产物保留未覆盖；其自报机读件 `p3s1b-20260928-085717.json` 经核**不存在**，见 §7）
- **仓库**：`/Users/kevin/bistro/seafood`，后端 `backend-ts/`（TypeScript + Neon PostgreSQL 18.6）
- **机读读数（真实存在）**：`backend-ts/.p3s1-artifacts/p3s1b-20260928-123558.json`（27,724 B，本报告头部指向的即此文件）
- **类级断言脚本**：`backend-ts/scripts/p3s1b-01-class-assert-runtime-ddl.ts`
- **代码面**：`backend-ts/src/**` 由上一任完成并已入 `375c5b8`；**本单未改 src 下任何文件**（新写 src 文件数 = 0）

## 0. 开工锚点

| 项 | 值 |
|---|---|
| 首次读取 HEAD（2026-09-28T12:35:58+08:00） | `37c368d70c3557d8a1c0c0408333c7f558b85862` · `37c368d master-plan v0.37: 5.32 P3 数据层规范 v0.1 终审（C1-C9 九项裁定）+ 5.33 两条库级发现` |
| 实现开工 HEAD（≈12:37） | `375c5b8ea9eeea0e6c30395200060db95841742b` · `375c5b8 P3 Step 1b: 摘掉第二条运行时 DDL 路径 ensureLegacyTableNames（代码面 + catalog 读数）` |
| 收尾 HEAD（12:41:45） | `065e28dad50cd4ed5a0a042c48bdc116fa64b206` · `065e28d ledger.spec v0.12: R79 就地扩写并拍板 …` |
| 期间他方提交 | 3 笔：`375c5b8`（入库上一任产物）、`065e28d`（他方在制 `docs/ledger.spec.md` v0.12）、`cd6bc8a master-plan v0.38`（12:43 后出现，他方）—— 均非本单所为 |
| 并发写入观测（12:42:38 / 12:42:45） | `docs/data-layer.spec.md` 与 `docs/qa/lang-shell-dbccd89-verify.md` 在**本单窗口内**被他方会话改写（mtime 12:42:38 / 12:42:45）。本单的写入路径**可穷举**且仅为本文件、`backend-ts/scripts/p3s1b-01-class-assert-runtime-ddl.ts`、`backend-ts/.p3s1-artifacts/**`（三处 mtime 分别为 12:43:01 / 12:37:56 / 12:38–12:42），**未指向**上述他方文件；归属他方，如实登记。 |
| `git status --porcelain`（首次读取） | ` M backend-ts/src/database.ts`；` M docs/ledger.spec.md`；`?? backend-ts/.p3s1-artifacts/p3s1-getmatrix-20260928-085717-{g1,g2}.json`；`?? …/p3s1b-catalog-20260928-085717-{pre,mid,post}.json`；`?? backend-ts/scripts/p3s1b-00-catalog-state.ts`；`?? docs/audit/p3-step1b-ddl-removal.md`；`?? docs/data-layer.spec.md`；`?? docs/qa/{45c27d8-lang-path,lang-prefix-normalize,lang-shell-dbccd89-verify,lang-shell-regression}.md`；`?? docs/versions/{data-layer.spec.v0.1,ledger.spec.v0.11}.md` |
| `git status --porcelain`（收尾） | 同上，仅 ` M backend-ts/src/database.ts` 与 ` M docs/ledger.spec.md` 两条已被他方提交吸收（375c5b8 / 065e28d）；本单新增未跟踪项 `?? backend-ts/scripts/p3s1b-01-class-assert-runtime-ddl.ts`、`?? …/p3s1b-classassert-20260928-123558-repo.json`、`?? …/p3s1b-catalog-20260928-123558-{pre,mid,post}.json`、`?? …/p3s1-getmatrix-20260928-123558-{g1,g2}.json`、`?? …/p3s1b-20260928-123558.json` |
| 上一单基线 | `4e978e3 P3 Step 1: 摘掉运行时 DDL，库回到 == 0012` |
| 本次改动面 | 仅 3 类路径：`backend-ts/scripts/p3s1b-01-class-assert-runtime-ddl.ts`（新）、`backend-ts/.p3s1-artifacts/**`（新 run tag）、`docs/audit/p3-step1b-ddl-removal.md`（回填）。`backend-ts/src/**`、`frontend/**`、`docs/data-layer.spec.md`、`docs/ledger.spec.md`、`docs/versions/**`、`docs/qa/**` **一律未写** |

## 1. 静态定位与摘除

### 1.1 定位（上一任开工前，行号为当时 HEAD 实测）

- 模块级变量：`backend-ts/src/database.ts:57 let legacyTableEnsurePromise: Promise<void> | null = null;`
- 定义：`backend-ts/src/database.ts:239 const ensureLegacyTableNames = async () => {`（IIFE 记忆化 promise，体内 `DO $$ … $$` 含两处条件 `ALTER TABLE … RENAME TO`）
- 调用点：4 处，**全在读方法**：`listBrands`(:1046)、`listTasks`(:1197)、`getTask`(:1226)、`getBrandById`(:1466)

### 1.2 摘除结果（本单复核，读数取自落盘 commit）

| 项 | 值 |
|---|---|
| 改动文件 | `backend-ts/src/database.ts`（单文件，无夹带） |
| `git show --numstat 375c5b8 -- backend-ts/src/database.ts` | `0	34`（+0 / −34） |
| 摘除内容 | 模块级 `let legacyTableEnsurePromise`（1 行）+ `ensureLegacyTableNames` 定义体（含两处条件 `ALTER TABLE … RENAME TO`）+ 4 处读方法调用 |
| grep 计数（`src/` 全量，`-o` 计数） | `ensureLegacyTableNames` = **0**；`legacyTableEnsurePromise` = **0**；`ensureSupportSchema` = **0**；`RENAME TO` = **0**；`to_regclass` = **0** |
| 类级 union grep（独立第二实现） | 原始命中 **8**，**加词界后 = 0** —— 8 条全为 `src/commission.ts` 的标识符 `truncated`（`chain_truncated` 等），系 ad-hoc grep 的 `TRUNCATE` 未加词界所致的**过宽假命中**；扫描器的 `(?<![\w.])TRUNCATE\b` 正确排除（详见 §6） |

## 2. ★ 类级断言：「请求路径上的 schema 变更语句」

> 立项唯一理由：上一轮的失败形态是**只 grep 那两个已知函数名**，漏掉同族第二处 DDL。本项**先枚举类，再对全集断言**。

### 2.1 枚举的类与扫描式

**类的定义**：运行期发生的 schema 变更语句。枚举 **25 类**（C01–C25），覆盖派单点名的 10 条 + 同族扩展 15 条：

| 类 | 语句型 | 类 | 语句型 |
|---|---|---|---|
| C01 | `CREATE TABLE` | C14/C15 | `CREATE/DROP SCHEMA` |
| C02 | `CREATE INDEX` | C16/C17 | `CREATE/DROP TRIGGER` |
| C03 | `CREATE [OR REPLACE] FUNCTION` | C18 | `CREATE/ALTER/DROP SEQUENCE` |
| C04 | `ALTER TABLE` | C19 | `CREATE/ALTER/DROP TYPE` |
| C05 | `DROP TABLE` | C20 | `CREATE/ALTER/DROP VIEW` |
| C06 | `DROP INDEX` | C21 | `CREATE EXTENSION` |
| C07 | `TRUNCATE` | C22 | `CREATE/ALTER/DROP POLICY` |
| C08 | `DO $$`（plpgsql 匿名块，模式 `\bdo\s+\$`，避免 `do {}` 假命中） | C23 | `ADD CONSTRAINT` / `ALTER COLUMN` |
| C09 | `RENAME TO` | C24 | `COMMENT ON` |
| C10 | `to_regclass` | C25 | `GRANT` / `REVOKE` |
| C11–C13 | `ALTER INDEX` / `ALTER FUNCTION|PROCEDURE` / `DROP FUNCTION|PROCEDURE` | | |

**扫描面（全量遍历，非抽样）**：

| 面 | 路径 | 文件数 | 定性 |
|---|---|---|---|
| request | `backend-ts/src/**/*.ts` | **8** | 请求路径：`tsconfig.json` 的 `rootDir=./src`、`main=dist/index.js` ⇒ 进 API 进程 |
| non-request | `backend-ts/scripts/**/*.ts` | 96 | `tsconfig.scripts.json`（noEmit），工具脚本不入 bundle |
| non-request | `backend-ts/migrations/**/*.sql` | 12 | 迁移文书（SQL 文件，非运行期代码） |
| 合计 | | **116** | |

**判定规则**（按命中所在词法状态的字符级状态机，非行级正则猜测）：`comment`（`//` / `/* */`）→ **允许集**（纯注释行）；`string`（`'…'` / `"…"` / `` `…` ``）→ 位于请求路径即 **「应为 0 的集」**；`code`（裸标识符/散文）→ 单列登记（不可执行的 DDL 候选，不计入「应为 0 的集」）。

### 2.2 全量命中清单

- **请求路径（src/ 8 文件）：命中总数 = 0**（25 类逐类皆 0；`should_be_zero = 0`、`allowed_comment = 0`、`bare_code = 0`）。
- **非请求路径：命中总数 = 254**（全部落入允许集）。
- 请求路径源码指纹（扫描时刻）：`sha256 = fc1045a0f39979ae8ac4f64b3dadf685d0cc3bb7848d48a037b978805f3ab8c3`（对 8 个 src 文件「路径+内容 sha256+字节数」排序后取 sha256）。

分类计数表（仅列命中 > 0 的类；全集计数表见机读件 `class_enumeration`）：

| 类 | 语句型 | 命中总 | 请求路径 | 应为 0 的集 | 非请求(允许) |
|---|---|---|---|---|---|
| C03 | CREATE [OR REPLACE] FUNCTION | 53 | 0 | 0 | 53 |
| C04 | ALTER TABLE | 56 | 0 | 0 | 56 |
| C24 | COMMENT ON | 29 | 0 | 0 | 29 |
| C08 | DO $$ | 21 | 0 | 0 | 21 |
| C01 | CREATE TABLE | 13 | 0 | 0 | 13 |
| C02 | CREATE INDEX | 13 | 0 | 0 | 13 |
| C10 | to_regclass | 9 | 0 | 0 | 9 |
| C05 | DROP TABLE | 7 | 0 | 0 | 7 |
| C16 / C17 | CREATE / DROP TRIGGER | 7 / 7 | 0 | 0 | 7 / 7 |
| C09 | RENAME TO | 6 | 0 | 0 | 6 |
| C07 | TRUNCATE | 5 | 0 | 0 | 5 |
| C19 | CREATE/ALTER/DROP TYPE | 4 | 0 | 0 | 4 |
| C23 | ADD CONSTRAINT / ALTER COLUMN | 4 | 0 | 0 | 4 |
| C25 | GRANT / REVOKE | 4 | 0 | 0 | 4 |
| C15 | DROP SCHEMA | 3 | 0 | 0 | 3 |
| C06 / C11 / C14 / C18 / C20 / C21 / C22 / C12 / C13 | — | 2 / 2 / 2 / 2 / 1 / 1 / 1 / 1 / 1 | 0 | 0 | 同类值 |
| **合计** | | **254** | **0** | **0** | **254** |

允许集的两个显式说明：① `migrations/*.sql` 的 DDL 是迁移文书（如 `0006_user_to_users.sql:75 EXECUTE 'ALTER TABLE public."user" RENAME TO users'`，正是被摘掉那段 DDL 的**上游出处**）；② `scripts/*.ts` 的 DDL 是非请求路径工具脚本/探针（如 `probe-tx.ts`、`verify-db-layer.ts`、`p3s1-02-drop-lazy-tables.ts`）。③ 夹具自我引用：扫描器自身的类名/正则表落在 `scripts/p3s1b-01-…ts`，被计入允许集（非违规）。

### 2.3 允许集 / 应为 0 的集，与正对照

**断言**：请求路径上「运行期 schema 变更语句」（应为 0 的集）== 0 ⇒ **PASS**（`expected_zero_set_size = 0`，脚本退出码 **0**）。

**正对照（尺子必须证明会响）** —— 注入物**只存在于 scratch 副本**，被检仓库内**未注入、未临时改动任何文件**：

- 固定副本：`/Users/kevin/.hermes/profiles/zang/cache/scratch/step1b-takeover/probe-copy/src/`（由 `cp -R src/.` 复制；复制前后 `src/database.ts` 的 sha256 双向核对一致：`b40e94ad419664c85279aba3099dfed1e60d5c4b12c44323e5300ca1a8db6b01`）。
- 注入文件：`probe-copy/src/__p3s1b_probe_injected.ts`，含 5 条**非注释** SQL 字符串 + 1 行注释内 DDL：

```
await pool.query('ALTER TABLE foo_old RENAME TO foo_new;');   // 预期 C04 + C09
await pool.query('CREATE TABLE probe_tbl (id int);');         // 预期 C01
await pool.query(`SELECT to_regclass('public.gift') AS r`);   // 预期 C10
await pool.query('DROP INDEX IF EXISTS probe_idx;');          // 预期 C06
// 注释行内的 DDL 必须落入「允许集」： ALTER TABLE commented_only RENAME TO nope;
```

| 读数 | 扫描根 | 请求路径命中 | 应为 0 的集 | 允许集(注释) | 断言 | 退出码 |
|---|---|---|---|---|---|---|
| 正对照 | `scratch/probe-copy` | 7（C01+C04+C09+C10+C06 各计） | **5** | 2 | **FAIL**（尺子响了） | **3** |
| 真仓 | `backend-ts` | 0 | **0** | 0 | **PASS** | **0** |

正对照逐条命中：`C01 src/__p3s1b_probe_injected.ts:7:21`、`C04 :6:21`、`C06 :9:21`、`C09 :6:41`、`C10 :8:28`（状态皆为 `string`）；`C04 :10` 与 `C09 :10` 因落在 `//` 注释内而归入允许集。⇒ 扫描器**会响**（不漏报），且对真仓 0 命中（不过宽；见 §6 的 `truncated` 反证）。

## 3. 重载与读数窗口

| 项 | 值 |
|---|---|
| restart 命令 | `curl -s -X POST http://127.0.0.1:5555/api/restart -H 'Content-Type: application/json' -d '{"sid":"seafood-api"}'` |
| restart 响应 | `{"sid":"seafood-api","ok":true,"state":"running","pid":60008,"msg":"已启动"}` |
| 重载前 pid | **74889**，`lstart = Mon Sep 28 08:58:27 2026`（`node … ts-node src/index.ts`，LISTEN :5788） |
| 重载后 pid | 面板回读 **60008**；实际 LISTEN 进程 **60022**，`lstart = Mon Sep 28 12:39:46 2026` |
| health（重载前） | http **200**，`db_version = PostgreSQL 18.6`，`schema_version = 0012` |
| health（重载后） | http **200**，`schema_version = 0012`（就绪轮询 2 次即 200） |

**catalog 三快照（本单 run tag，未覆盖上一任同类读数）**：

| 快照 | 产物 | table_count | 表集==EXPECTED | schema_version | schema_migration 行 | users 行 | 索引数 | 指纹(前16) |
|---|---|---|---|---|---|---|---|---|
| pre（重载前） | `p3s1b-catalog-20260928-123558-pre.json` | 8 | true | 0012 | 12 | 411 | 24 | `ffb357d4ed68c933` |
| mid（重载后、GET 前） | `…-mid.json` | 8 | true | 0012 | 12 | 411 | 24 | `ffb357d4ed68c933` |
| post（GET 后） | `…-post.json` | 8 | true | 0012 | 12 | 411 | 24 | `ffb357d4ed68c933` |

**逐项 diff（pre / mid / post，非「折叠成一致」）**：

| 字段 | pre | mid | post | 变化 |
|---|---|---|---|---|
| table_count | 8 | 8 | 8 | 无 |
| table_set_matches_expected | true | true | true | 无 |
| schema_version | 0012 | 0012 | 0012 | 无 |
| schema_migration_rows | 12 | 12 | 12 | 无 |
| users_rows | 411 | 411 | 411 | 无 |
| index_count | 24 | 24 | 24 | 无 |
| catalog_counts | pg_class 37 / pg_attribute 187 / pg_index 24 / pg_constraint 101 / pg_proc_public 33 | 同左 | 同左 | 无 |
| table_row_counts | account 283 / commission_policy 19 / currency 100 / ledger_entry 2145 / ledger_owner 4 / referral 216 / schema_migration 12 / users 411 | 同左 | 同左 | 无 |
| indexes（24 条，逐条） | 全等（含 `users.idx_users_evm_lower`、`ledger_entry.ledger_reversal_of_uniq`、`commission_policy.commission_policy_effective_uniq` 等） | 全等 | 全等 | 无 |
| catalog 指纹（全量） | `ffb357d4ed68c933dc2656670e8921ec01f67c0bcc0ed28dbe18795786a1eb97` | 同左 | 同左 | 无 |

**差异面 = 空**（所有字段逐项相同；见机读件 `catalog.item_by_item_diff_pre_mid_post` 与 `diff_all_fields_unchanged: true`）。

**列 / 约束 / 函数的逐项口径（不折叠）**：快照未逐条落盘 `pg_attribute` / `pg_constraint` / `pg_proc` 元组，改由两个读数覆盖：① `catalog_counts` 逐项相等（187 / 101 / 33）；② 上述指纹是对 `{tables, indexes, row_counts, pg_class, pg_attribute, pg_index, pg_constraint, pg_proc(proname, prokind, md5(prosrc))}` 全量元组取的 sha256 —— **指纹相等 ⇒ 列/约束/函数（含 prosrc md5）逐条相等**（构造性等价）。

**跨窗口连续性**：上一任的 `085717-{pre,mid,post}` 与本质 `123558-{pre,mid,post}` 共 **6 份快照的 catalog 指纹完全相同**（`ffb357d4…6a1eb97`），即自 08:57 至 12:41 跨两次重载，catalog 逐字节稳定。

**GET 路由矩阵**：`g1`/`g2` 各 9 条 GET，状态直方图均为 `{"500":9}`；上一任 `085717-g1` 同为 `{"500":9}`（9 条全 500 为既有现象、非本单引入）。GET 前（mid）与 GET 后（post）表数均 **8**、指纹不变。

## 4. 重跑「读不再写」

**本节只作弱判据登记，不作成立宣称。**

表数不变对『条件空转的 DDL』是盲的（gift/journey 不存在时那两处 RENAME 空转、不改表数 —— 上一轮我正是因此得到半个假证）。故 B 只记『未发现回归』，**真正的判据是 A**。

- 未发现回归：GET 9 条 × 2 轮前后，table_count 恒为 8、表集逐一等于 EXPECTED、指纹与 catalog_counts 不变；GET 后 `schema_version` 仍 0012、`schema_migration` 仍 12 行、`users` 仍 411 行。
- 因此**不得**把本节读成「证明读不再写成立」；该命题的判据是 §2 的类级断言（请求路径上运行期 schema 变更语句 == 0）。

## 5. 交付物与边界

**本单新写（仅这 3 类路径）**：

1. `backend-ts/scripts/p3s1b-01-class-assert-runtime-ddl.ts` —— 类级断言 + 正对照扫描器（只读 fs，25 类，退出码 0/3/2）。
2. `backend-ts/.p3s1-artifacts/`（新 run tag `20260928-123558`）：
   `p3s1b-classassert-20260928-123558-repo.json`、`p3s1b-catalog-20260928-123558-{pre,mid,post}.json`、`p3s1-getmatrix-20260928-123558-{g1,g2}.json`、`p3s1b-20260928-123558.json`（机读件，27,724 B）。
3. `docs/audit/p3-step1b-ddl-removal.md`（本文件，全文回填）。

**上游复用的既有件（未覆盖、未重写）**：`backend-ts/scripts/p3s1b-00-catalog-state.ts`、`backend-ts/scripts/p3s1-01-get-matrix.ts`、`085717` run tag 的 5 份读数。

**明确未碰**：`backend-ts/src/**`（0 文件）、`frontend/**`、`docs/data-layer.spec.md`、`docs/ledger.spec.md`、`docs/versions/**`、`docs/qa/**`。**未 commit / 未 git add / 未 push**；未使用 `git reset` / `checkout --` / `stash` / `clean`。

## 6. 夹具与陷阱

1. **正对照夹具**：`scratch/step1b-takeover/probe-copy/`（由 `cp -R src/.` 得来，交付前 sha256 双向核对一致）+ 注入文件 `__p3s1b_probe_injected.ts`。注入物**只存在于 scratch**；被检仓库内无任何注入或临时改动。所有 scratch 中间件均在仓外，不污染工作区。
2. **`truncated` 假命中陷阱**：ad-hoc `grep -rniE "…|TRUNCATE|…" src/` 报 8 条，全为 `src/commission.ts` 的标识符 `truncated`/`chain_truncated`；`TRUNCATE` 无词界时命中，加 `\b` 后归 0。这是**探针过宽**，非真命中 —— 扫描器用 `(?<![\w.])TRUNCATE\b` + 词法状态机规避。
3. **`DO $$` 的过宽风险**：JS 的 `do {} while` 会误伤。扫描模式定为 `\bdo\s+\$`（`DO` 后必须紧跟 `$`），杜绝 `do {` 假命中。
4. **ctrl 面板 pid ≠ LISTEN pid**：面板回读 `60008`（spawn 壳），实际 LISTEN 为 `60022`（ts-node 再 exec）。读数一律以 `lsof -nP -iTCP:5788 -sTCP:LISTEN` 的实际进程为准。
5. **`tsc --noEmit` 是窄口径**：`tsconfig.json` 的 `include` 仅 `["src/**/*"]` ⇒ 该读数只覆盖 `src/`，**不等于「全仓类型检查通过」**。`tsc -p tsconfig.scripts.json` 是另一口径。
6. **快照不存明细**：catalog 快照只落 `catalog_counts` + 指纹，未落 `pg_attribute/pg_constraint/pg_proc` 明细 ⇒ 明细等价性由指纹（全量元组 sha256）承载，已在 §3 显式说明，未折叠成「一致」。
7. **保留字**：`0006_user_to_users.sql` 与 `users` 表涉及的保留字 `"user"`，本轮仅作为**被检文本**出现，未对被检库执行任何针对保留字对象的探针；扫描为纯文本，不触发该风险。
8. **纪律遵守**：未用 `timeout`/`gtimeout`（本机不存在）；退出码在命令后**立即** `RC=$?` 捕获，未用管道尾命令退出码当判据；产物逐个 `ls -la` 自证存在。清理仅按精确 PID（本单未起任何后台常驻进程，无进程待清）。

## 7. 失败与作废

**上一任（dead）状态**：**provider 端停摆**被弃（`waiting for model response 453.6s`、17 calls），**非代码错**。其已完成产物已由派单方入库 `375c5b8`：`backend-ts/src/database.ts` 的摘除（−34 行）、`p3s1b-catalog-20260928-085717-{pre,mid,post}.json`、`p3s1-getmatrix-20260928-085717-{g1,g2}.json`、`backend-ts/scripts/p3s1b-00-catalog-state.ts`。其报告自报的机读件 `backend-ts/.p3s1-artifacts/p3s1b-20260928-085717.json` **经核不存在**（目录内无此文件）—— 已在本报告头部指向真实存在的 `p3s1b-20260928-123558.json`。

**本单接手的差量**：① 类级断言（25 类、全集断言、正对照）；② 报告 §0–§7 全文回填（骨架 56 行 → 全文 220 行，骨架里的占位标记——中括号包「待回填」三字——已全部替换为实测读数，现存计数 = 0）；③ 机读件 `p3s1b-20260928-123558.json`；④ 按补单要求加跑 `npx tsc --noEmit` 与 catalog 逐项 diff。

**本单内部作废读数**：

- **作废 1（计数 bug，已修）**：`p3s1b-01` 首版把两个非请求面的文件数合并计数，`scan_surfaces` 里 `scripts` 与 `migrations` 都显示 108（实为 96 与 12）。属**我新写脚本的显示层 bug**，与断言无关（request 面 8 文件、命中 0 不受影响）；已修 `filesBySurfaceId` 后重跑，真仓读数以修正版为准（`request-src=8 / nonreq-scripts=96 / nonreq-migrations=12`）。
- **作废 2（探针过宽，非真命中）**：§1.2 的类级 union grep「8 条命中」**作废**——经逐条核对全为 `truncated` 标识符，加词界后为 0（§6.2）。
- **作废 3（口径差异，如实登记）**：补单与派单 brief 记 `tsconfig.scripts.json` 暴露「15 个真错」，本单**实测 9**（exit 2，首条 `p1f-02-f2-malformed.ts(171,23) TS2352`）。二者差异原因未知、不假设；该残差**不属本单范围**，未修。
- **未实测项（不用 0/空数组占位）**：见机读件 `not_measured`（`read_no_longer_writes__runtime_proof` = NOT_MEASURED；`full_repo_typecheck` = NOT_MEASURED）。

**结论**：类级断言 **PASS**（请求路径应为 0 的集 = 0，正对照 5 命中/退出码 3 证明尺子会响）；代码面 `src/` 无命中、无本单改动；catalog 前后逐项无差异。本报告占位标记计数（中括号包「待回填」三字）= **0**。
