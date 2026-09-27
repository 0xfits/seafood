# P1g 验收报告 · D11（`public."user"` → `public.users`）+ 一次性测试数据清零

> 作者：Kong（实现者） · 仓库：`/Users/kevin/bistro/seafood` · 后端：`backend-ts`
> 迁移号：`0006` · 起始 `schema_version=0005` → 终态 `0006`
> 全部原始输出在 `backend-ts/.p1g-artifacts/`（下称「本目录」）

## 0. 状态总览（全绿）

| 步骤 | 内容 | 结果 |
|---|---|---|
| 1 | 引用清单先落盘 `impact-inventory.md` | ✅ |
| 2 | `0006_user_to_users.sql` + 应用两次 | ✅ 一次 applied / 二次 6 条全 `skipped` |
| 3 | 代码真表引用改动（18 处） | ✅ |
| 4 | `tsc --noEmit` / `ledger-smoke` / `ledger-smoke-db` / grep | ✅ 0 error / 29-0 / 11-0 / 0 残留 |
| 5 | `purge-test-data.ts` 扩展 + 判负自证 + `--apply` | ✅ |
| 6 | 清零后复核 / 面板 / health | ✅ 判据 0、cid=1 自洽、平台 4 行未动、16/16、`/health` 200 + `0006` |

---

## 1. 第一步：引用清单（先落盘再动）

**交付**：本目录 `impact-inventory.md`（DB 侧 / `src` / `scripts` / `frontend` / `docs` 五区，逐文件逐行）
**原始证据**：`p1g-00-inventory.txt`、`p1g-01-probe2.txt`（探针脚本 `probe-00-inventory.ts` / `probe-01-probe2.ts`）

### 1.1 三条必须写清的实测修正

| # | 预查说法 | 实测 | 处理 |
|---|---|---|---|
| A | 「有 FK 指向该表，需一并改表名」 | **0 条**。`pg_constraint contype='f' AND confrelid = public.user` ⇒ 空集。裸按表名扫出的 4 条（`account_userId_fkey` / `invitation_inviterId_fkey` / `member_userId_fkey` / `session_userId_fkey`）**全部指向 `neon_auth."user"`** —— Neon Auth 的另一张表，与 D11 无关 | **绝不触碰 `neon_auth."user"`**；迁移内改为写一条**前置断言**（若将来出现指向 `public."user"` 的 FK 则中止） |
| B | 「`src/database.ts` 有 11 处表引用」 | **17 处**（`grep -rc '"user"' src/*.ts` ⇒ `database.ts:17`，其余 src 文件 0）。其中 DML 12 处、DDL 5 处，**全部已带引号** | 按 17 处改 |
| C | 「0004/0005 的函数体可能有引用，要 `CREATE OR REPLACE`」 | **0 条**。`pg_proc.prosrc LIKE '%"user"%'` ⇒ 空集；`prosrc ~* '\yuser\y'` 唯一命中是 `ledger_payload_amount` 里一句英文注释 `amount (user decimal, R72)` | **不需要重发任何函数** |

### 1.2 DB 侧关联对象（改名清单）
`user_pk`(PK) / `user_evm_uniq`(UNIQUE) / `user_evm_fmt`,`user_uid_positive`(CHECK) / `user_*_not_null`×6(NOT NULL, PG18 已编目) / `idx_user_evm_lower`(独立索引) / `user_uid_seq`(identity 序列) / 行类型 `"user"` / TOAST。
视图 0、RLS 0、非内部触发器 0、FK 0、函数体 0、行数 0。

---

## 2. 第二步：迁移 `0006_user_to_users.sql`

**文件**：`backend-ts/migrations/0006_user_to_users.sql`（新增，`0001`–`0005` 一字未改）

### 2.1 内容
1. **前置断言**：`pg_constraint contype='f' AND confrelid = public."user"` 若有行 ⇒ `RAISE EXCEPTION` 中止
2. `ALTER TABLE public."user" RENAME TO users`（`pg_class` 存在性守卫，幂等）
3. 约束改名 `user_*` → `users_*`（循环 `pg_constraint`，全部走 `EXECUTE` 动态 SQL）
   —— 改 PK / UNIQUE 约束名**连带改其底层索引名**（PostgreSQL 语义）
4. `idx_user_evm_lower` → `idx_users_evm_lower`
5. `user_uid_seq` → `users_uid_seq`（PG **不会**随表改名自动改 identity 序列名）
6. **后置校验**：旧名不在 / 新名在 / `user_*` 约束零残留 / 旧索引与旧序列零残留

`migrate.ts` 本身已保证「单文件单事务」，本文件内不再自带 `BEGIN/COMMIT`。

### 2.2 应用结果（原始输出 `p1g-migrate-1.json` / `p1g-migrate-2.json`）

**第一次**（`.p1g-artifacts/p1g-migrate-1.json`，`exit=0`，stderr 空）：
```
0001 skipped already applied, checksum match
0002 skipped already applied, checksum match
0003 skipped already applied, checksum match
0004 skipped already applied, checksum match
0005 skipped already applied, checksum match
0006 applied checksum=4aa19b148700  ms=2798
schema_version = "0006"
public_base_tables = ["account","currency","ledger_entry","ledger_owner","schema_migration","users"]   count=6
```

**第二次**（`.p1g-artifacts/p1g-migrate-2.json`，`exit=0`，stderr 空）——**幂等达成**：
```
ok = True
0001 skipped already applied, checksum match
0002 skipped already applied, checksum match
0003 skipped already applied, checksum match
0004 skipped already applied, checksum match
0005 skipped already applied, checksum match
0006 skipped already applied, checksum match
schema_version = 0006
tables = ['account','currency','ledger_entry','ledger_owner','schema_migration','users']
```
⇒ **`0001`–`0006` 全 `skipped` + `checksum match`**。

---

## 3. 第三步：代码真表引用改动（共 18 处）

| 文件 | 处数 | 改动 |
|---|---|---|
| `backend-ts/src/database.ts` | 17 | `"user"` → `"users"`（行 405/406/407/411/422/425/518/519/1015/1130/1146/1160/1174/1185/1213/1646/1688） |
| `backend-ts/scripts/purge-test-data.ts` | 1 | SQL 表名 `"user"` → `"users"`（+ TS 计数键名 `"user"` → `users`） |
| `backend-ts/scripts/inspect-schema.ts` | 1 | 行 49 SQL 表名 `"user"` → `"users"`（并把该行显示标签 `'user'` → `'users'`，标签是名字而非表引用，一并纠正以免误读） |

**合计 18 处真表引用**（`src` 17 + 非冻结 `scripts` 2，其中 purge 的 TS 键名另计）。

### 3.1 明确**未改**（同名不同物，改了即对外行为破坏）
- `src/index.ts` 全文（`user` 字样 75 行，**真表引用 0**）：变量名 / 方法名 `*User*` / 字符串 `'Failed to load user'` 等 / **路由 `/api/user`、`/api/user/profile`、`/api/user/asset/:uID`、`/api/admin/user/update`（6 处）**
- `frontend/**`：`localStorage.getItem('user')` / `setItem('user',…)`（**3 处**）、`/api/user*`（**15 处**）
- `src/database.ts` 中 `user_ids` / `user_count` 等**列名与 TS 字段名**

---

## 4. 第四步：清零**前**验收（原始输出全在本目录）

### 4.1 `npx tsc --noEmit`
```
$ npx tsc --noEmit
tsc_exit=0
--- tsc output (empty=clean) ---
--- line count ---
0
```
⇒ **0 error**（输出 0 行）。原始文件 `p1g-tsc.txt`。

### 4.2 `scripts/ledger-smoke.ts`（对外 API 回归）
```
$ npx ts-node --transpile-only scripts/ledger-smoke.ts ; echo $?
smoke_exit=0
"passed": 29, "failed": 0
```
⇒ **29 passed / 0 failed**，退出码 0。原始文件 `p1g-smoke-api-after-rename.txt`（含 29 条用例明细）。

### 4.3 `scripts/ledger-smoke-db.ts`（D10 DB 函数版）
```
$ npx ts-node --transpile-only scripts/ledger-smoke-db.ts ; echo $?
smoke_db_exit=0
summary: { "passed": 11, "failed": 0 }
```
⇒ 全通过（11/11）。原始文件 `p1g-smoke-db-after-rename.txt`。

### 4.4 改后 grep：真表引用零残留（原始输出 `p1g-grep.txt`）
```
### [1] 产品代码 src/**  （期望 0）
$ grep -rn '"user"' src/
--> grep exit=1            ← 0 命中

### [2] 产品代码 scripts/**（排除冻结质检资产）  （期望 0）
$ grep -rn '"user"' scripts/ --exclude='p1c-*.ts' --exclude='p1e-*.ts' --exclude='p1f-*.ts' --exclude='qa-p1b-*.ts' --exclude='qa-p1e-*.ts' --exclude='p1j-read.ts'
--> grep exit=1            ← 0 命中

### [4] frontend/** 真表引用  （期望 0）
$ grep -rniE 'FROM +"user"|FROM user|INSERT INTO user|UPDATE user ' frontend/src
--> grep exit=1            ← 0 命中

### [3] 冻结质检资产（硬约束禁止修改，其 '"user"' 是历史取证读数）
scripts/p1c-06-post-verify.ts:36:    UNION ALL SELECT 'user', count(*)::text FROM "user"
scripts/p1e-05-inventory.ts:13: * 注意：`user` 表必须写成 `"user"`（…）
scripts/p1e-05-inventory.ts:25:            (SELECT count(*) FROM "user") AS user_rows`))[0];
scripts/qa-p1b-00-env.ts:49:      UNION ALL SELECT 'user', count(*) FROM "user"
scripts/qa-p1e-00-baseline.ts:45:      UNION ALL SELECT '"user"', count(*)::text FROM "user" ORDER BY 1`);

### [6] 改名后新名引用
src/database.ts 含 "users" 的行数 = 17   ← 与改前 17 处一一对应

### [7] 裸写法（无引号 FROM/JOIN/UPDATE/INSERT INTO user）
src/database.ts:1201:      console.warn('Failed to update user login time:', error);   ← 英文文案，非 SQL
src/index.ts:835:    sendError(res, 400, … 'Failed to update user');              ← 英文文案，非 SQL
```
**结论**：产品代码（`src/**` + 非冻结 `scripts/**` + `frontend/**`）**真表引用零残留**；[7] 的两条是英文提示文案（`Failed to update user …`），**不是 SQL 表引用**，逐字分类在 `impact-inventory.md §2.2`。

**冻结资产说明（硬约束冲突的显式披露）**：派单同时要求「零残留」与「不得改 `qa-p1e-*` / `qa-p1b-*` / `p1c-*` / `p1e-*`」。上表 [3] 的 4 个文件是**已归档的质检取证资产**，其中 `"user"` 是**当时的历史读数证据**（`qa-p1e-00-baseline.ts` 还故意把字面量写成 `'"user"'` 以自证引号写法）。**本单判定：冻结资产优先**，不动；这 4 个文件若日后重跑会因表已改名而失败 —— 属预期（历史快照，非活路径）。

### 4.5 改名后物理核对（原始输出 `p1g-03-postrename.txt`）
```
### public_base_tables (6)
account / currency / ledger_entry / ledger_owner / schema_migration / users

### old_name_gone_in_information_schema      → {"n":"0"}
### new_name_present_in_information_schema  → {"n":"1"}
### count_users                             → {"n":"0"}      ← SELECT count(*) FROM "users"
### objects_named_like_user (5)
{"relkind":"S","relname":"users_uid_seq"}
{"relkind":"i","relname":"idx_users_evm_lower"}
{"relkind":"i","relname":"users_evm_uniq"}
{"relkind":"i","relname":"users_pk"}
{"relkind":"r","relname":"users"}

### constraints_on_users (10)
users_pk(PK) / users_evm_uniq(UNIQUE) / users_evm_fmt(CHECK) / users_uid_positive(CHECK)
users_uid_not_null / users_evm_not_null / users_bio_not_null / users_is_admin_not_null
users_time_reg_not_null / users_time_login_last_not_null

### indexes_on_users (3)
users_pk (unique,primary) / users_evm_uniq (unique) / idx_users_evm_lower
  def: CREATE INDEX idx_users_evm_lower ON public.users USING btree (lower(evm))

### sequence_of_users → {"attname":"uid","attidentity":"d","seq":"public.users_uid_seq"}

### columns_of_users (6, 列名一字未改)
uid bigint / evm text / bio text / is_admin boolean / time_reg timestamptz / time_login_last timestamptz

### fk_into_public_users (0)
### neon_auth_untouched (2)
{"table_schema":"neon_auth","table_name":"user"}      ← 未被触碰
{"table_schema":"public","table_name":"users"}
### funcs_prosrc_quoted_user (0)
```
**关联对象名字已全部随表名变更**：表 / PK / UNIQUE / CHECK / NOT NULL×6 / 独立索引 / 序列 ⇒ 旧前缀 `user_*` 在 `public` schema **零残留**。

### 4.6 保留字陷阱 · 改后实测（**必须如实陈述的那条事实**）
```
### trap_post_rename
{"quoted_users":"0","bare_user":"1"}
     ↑ SELECT count(*) FROM "users" = 0（真值）
     ↑ SELECT count(*) FROM user   = 1（**依旧**被解析成 current_user）

### old_quoted_form → {"error":"relation \"user\" does not exist","code":"42P01"}
### new_bare_form   → {"result":"OK (unquoted users works — not a reserved word)"}
```
**结论（逐字按派单口径）**：改名**没有**消除 `user` 关键字的这个行为 —— 改完之后 `SELECT count(*) FROM user` **依旧**静默返回 `current_user` 的 1 行。**消除的是事故类别**：项目「正确的那名字」（`users`）现在**不是保留字**（裸 `users` 直接可用的实测见上），所以「写对」无歧义；而写错时（`FROM "user"` / `FROM user`）**没有同名表可被「碰对」**，`42P01` 立刻暴露。**本单不主张「陷阱已被消除」。**

---

## 5. 第五步：测试数据一次性清零

### 5.1 `purge-test-data.ts` 的扩展（本单改动）
1. **币种前缀集**：2 个 → **10 个**，且**大小写不敏感**（`ILIKE` + JS 侧 `toLowerCase().startsWith`，两实现同源同义）
   ```
   SYMBOL_PREFIXES = ['qa1b','smk','p1e','p1f','p1g','p1h','p1i','p1j','p1k','qae']
   SYMBOL_PRED = (symbol ILIKE 'qa1b%' OR … OR symbol ILIKE 'qae%')
   ```
   实测必要性：P1f 的 symbol 是**大写**（`P1FMUJFARFL` / `P1HMUJFTUJL` / `P1KGIAOA`…）——大小写不敏感是必需的，不是保险。
2. **恢复 `cid=1` 自洽（Zang §5.9）**：删除流水后，在同一事务内
   ```
   UPDATE currency c SET total_supply = Σ(mint) − Σ(burn)   （只改 total_supply 一列）
   ```
   逐 cid 计算；提交前 + 提交后各取一次对照；若仍有 cid 不自洽 ⇒ **事务内抛错回滚**。
   口径**有出处**：`docs/ledger.spec.md` §11 判据 4 / R9 / R24 / R25（`total_supply == Σ(mint.delta) − Σ(burn 的绝对额) + Σ(冲正对 mint/burn 的净调整)`）。
3. **新增事务内硬断言**（红线的机器化）：
   - 删除前平台账户必须恰 4 行且 `balance=0 frozen=0`，否则抛错
   - `cid=1` 币行必须恰 1 行，否则抛错
   - 删除后平台账户仍恰 4 行且 `balance=0 frozen=0`，否则抛错
   - 删除后 `cid=1` 币行仍在，且报告改前/改后全列（证明只 `total_supply` 变了）
4. **`0/-1/-2/-3` 与 `cid=1` 硬红线、预测集越界中止（exit 3）、falsify floor 与 `--apply` 互斥（exit 4）、触发器 `tgenabled='O'` 前后取证** —— 全部原样保留。

### 5.2 自证判负机制（清零前演练，原始输出 `p1g-falsify-dryrun.txt` / `p1g-falsify-apply.txt`）
```
A) $ PURGE_FALSIFY_FLOOR=0 npx ts-node --transpile-only scripts/purge-test-data.ts ; echo $?
   退出码 = 3            ← 必须中止
   assert_pass = False
   assert_forbidden_hits = ["account uid=0（平台保留 uid）被列入待删",
                            "ledger_owner uid=0（平台保留 uid）被列入待删",
                            "待删 account 含 uid <= 0 的行"]
   stdout 尾行 = "ABORT: 待删集合超出预测集 / 命中硬红线，未做任何删除。"
   ⇒ 下界一放宽就命中平台账户，断言**真的能红**，且**未做任何删除**

B) $ PURGE_FALSIFY_FLOOR=0 npx ts-node --transpile-only scripts/purge-test-data.ts --apply ; echo $?
   退出码 = 4            ← 必须拒绝
   stdout = "ABORT: PURGE_FALSIFY_FLOOR 仅允许 dry-run（判负演练），不得与 --apply 同时使用。"
   ⇒ 放宽预测集下 `--apply` 被硬拒
```

### 5.3 dry-run 计划（原始输出 `p1g-purge-dryrun.json`）
```
mode = "DRY-RUN"
counts_before = {ledger_entry:1643, account:201, currency:90, ledger_owner:4, schema_migration:6, users:0}
planned_deletions = {ledger_entry:1643, account:197, currency:89, ledger_owner:0}
currency_cids(89) = cid 10..93（全部非 cid=1 的自建/测试币）
assert_out_of_predicate = []            ← 无越界
assert_forbidden_hits   = []            ← 未命中红线
observed_test_cid_entries_with_platform_uid = []   ← 测试 cid 内无平台 uid 流水
assert_pass = true
```
**覆盖性核对**：`currency` 共 90 行，`cid=1` 之外 **89 行全部命中 10 前缀预测集**（`planned currency = 89`），即**无遗漏的测试币**。

### 5.4 真实清零（原始输出 `p1g-purge-apply.json` / `.err`）
```
$ npx ts-node --transpile-only scripts/purge-test-data.ts --apply ; echo $?
purge_apply_exit = 0            stderr 为空

deleted  = {ledger_entry:1643, account:197, currency:89, ledger_owner:0}
expected = {ledger_entry:1643, account:197, currency:89, ledger_owner:0}     ← 完全一致
```
**清零前后行数读数**

| 表 | 清零前 | 清零后 | 变化 |
|---|---|---|---|
| `ledger_entry` | 1643 | **0** | −1643 |
| `account` | 201 | **4** | −197 |
| `currency` | 90 | **1** | −89 |
| `ledger_owner` | 4 | **4** | 0（未触碰） |
| `schema_migration` | 6 | **6** | 0（未触碰） |
| `users` | 0 | **0** | 0（未触碰） |

**触发器**
```
trigger_state_before        = [account/trg_account_guard/O, ledger_entry/trg_ledger_entry_append_only/O]
trigger_state_disabled_in_tx= 同上但 tgenabled='D'（事务内临时禁用，已取证）
trigger_state_reenabled_in_tx = [account/trg_account_guard/O, ledger_entry/trg_ledger_entry_append_only/O]
triggers_all_enabled_after  = True
```
**平台账户（删除后、提交前，事务内取证）**
```
[{-1,cid1,0,0},{-2,cid1,0,0},{-3,cid1,0,0},{0,cid1,0,0}]    ← 4 行原样，balance=0 frozen=0
survivors_after_delete_in_tx = [{−1,cid1},{−2,cid1},{−3,cid1},{0,cid1}]   ← 保留集只剩平台 4 行
```

### 5.5 `cid=1` total_supply 恢复自洽（改前 / 改后逐 cid 读数）

**改前（本单开工基线，`probe-02-baseline.txt`）** —— 与 Zang 定位的成因一致（P1c 清零删了 cid=1 上 `uid≥900000` 的 `$` 流水但没同步计数器）：
```
cid=1 symbol=$ total_supply=12800  Σmint=7200  Σburn=0  drift=+5600
```
**清零前一刻（`--apply` 的 dry-run + 事务外读数，`p1g-purge-apply.json` §supply_audit_before_any_change；期间跑过冒烟，故数值更大、**差值仍是 5600**）**：
```
cid=1 symbol=$ total_supply=14000  Σmint=8400  Σburn=0  residue_entry_count=224  drift=+5600
```
**事务内、删除之后、重整之前**：
```
cid=1 total_supply=14000  Σmint=0  Σburn=0  residue_entry_count=0  consistent_target=0
```
**`reconcile_updated_rows`（本次唯一被 UPDATE 的行）**：
```
[{"cid":"1","symbol":"$","total_supply_before":"14000","total_supply_after":"0"}]
```
**事务内重整之后**：`cid=1 total_supply=0  Σmint=0  Σburn=0  consistent_target=0` ✅
**提交之后**：`supply_audit_after_commit = [{cid:1, symbol:$, total_supply:0, Σmint:0, Σburn:0, consistent_target:0}]`，`supply_all_consistent_after_commit = True` ✅
**`cid=1` 全列改前 / 改后对照（证明只动了 `total_supply`）**：
```
before = {"cid":"1","symbol":"$","total_supply":"14000","supply_cap":null}
after  = {"cid":"1","symbol":"$","total_supply":"0","supply_cap":null,"status":"listed","owner_uid":"0","decimals":"0"}
```
⇒ 币行 `cid=1` **行本身保留**，`symbol=$ / name=平台积分 / supply_cap=NULL / status=listed / owner_uid=0 / decimals=0` 全部未动，**只有 `total_supply` 从 14000 → 0**（Zang §5.9 明示授权的唯一例外）；`time_updated` 等其余列**未改**（UPDATE 语句只写 `SET total_supply = …`）。

> ### 事实陈述（不是问题）
> **平台系统币 `$`（cid=1）当前 `total_supply = 0`** —— 即**当前无流通量**。成因：cid=1 上**全部** `$` 流水都属于测试账户 `uid≥900000`（清零后 `ledger_entry` 里 cid=1 的残留分录数 = **0**），故其自洽值（`Σmint − Σburn`）就是 0。平台账户 4 行仍完好（`balance=0 frozen=0`），`$` 仍为 `listed`、`supply_cap=NULL`（平台可无限铸），随时可再铸。

---

## 6. 第六步：清零后复核（只读，原始输出 `p1g-04-postpurge.txt`）

### 6.1 §11 判据
```
### judgement_1_rowcount      → {"n":"0"}        ✅ 判据 1 = 0 行
### judgement_8_hits_raw      → (0 rows)         ✅ 判据 8 口径 A = 0 行
### judgement_8_hits_excl_mint_burn → (0 rows)   ✅ 判据 8 口径 B = 0 行
### judgement_8_rowcounts     → {"raw_n":"0","excl_n":"0"}
```
（对照：清零前 判据1 = 0 行 / 判据8 口径A = 19 行 / 口径B = 0 行 —— 口径 A 的 19 行全部是 `ref_type='currency'|'system'` 的 mint 组，属**规范允许的铸币单边**，随测试币一起消失。）

### 6.2 `cid=1` 自洽
```
### cid1_reconcile_check → {"cid":"1","symbol":"$","total_supply":"0","sum_mint":"0","sum_burn":"0",
                            "sum_mint_minus_burn":"0","cid1_consistent":"true","residue_entry_count":"0"}
### all_cids_consistent  → {"inconsistent_cids":"0"}
```
⇒ `total_supply (0)` **==** 该 cid 残留 `Σ(mint) − Σ(burn) (0)` ✅

### 6.3 平台账户 `0/-1/-2/-3` 未动
```
### platform_accounts (4)
{-3,cid1,balance 0,frozen 0} {-2,cid1,0,0} {-1,cid1,0,0} {0,cid1,0,0}
### any_nonzero_balance → (0 rows)          ← 全库没有任何非零余额行
### ledger_owner_untouched (4)              ← 0/-1/-2/-3 平台 owner 登记原样
{-3,platform,罚没账户} {-2,platform,佣金池} {-1,platform,手续费归集账户} {0,platform,平台主体}
```

### 6.4 基表 / 迁移 / 触发器
```
### public_base_tables (6): account, currency, ledger_entry, ledger_owner, schema_migration, users
### public_base_table_count → {"n":"6"}         ← 仍是 6 张
### base_table_named_users  → {"table_name":"users"}   ← 其中一张名为 users
### row_counts: account=4 currency=1 ledger_entry=0 ledger_owner=4 schema_migration=6 users=0
### schema_version → {"version":"0006"}
### trigger_state: account/trg_account_guard → 'O' ; ledger_entry/trg_ledger_entry_append_only → 'O'
### objects_named_like_user (5): users / users_pk / users_evm_uniq / idx_users_evm_lower / users_uid_seq
```

### 6.5 面板 / health（原始输出 `p1g-05-panel-health.txt`）
```
===== 面板（5555）=====
panel_services_total = 16
panel_running        = 16
panel_running/total  = 16/16
（jiazu-api 3100 / jiazu 5199 / xiai-api 5191 / shu 5164 / feicui-api 5196 / feicui-web 5195 /
  xiai 5163 / jinli-api 5778 / jinli 5777 / seafood-api 5788 / seafood 5787 / cat 5701 /
  aranya-api 5181 / liwu-proxy 3020 / liwu-web 5175 / liwu-app 5176 —— 全部 state=running, portOpen=True）

===== /health 5788 (seafood-api) =====
{"ok":true,"db_version":"PostgreSQL 18.6 …","schema_version":"0006","time":"2026-09-27T07:14:21.525Z"}
HTTP_STATUS=200                       ✅ 200 且 schema_version=0006

===== / 5787 (seafood web) =====
HTTP_STATUS=200
```
**本单未停/未启/未重启任何面板托管服务**（尤其 5777/5778/5787/5788），未执行 `pm2 restart bistro-ctrl`，未使用 `pkill -f` / `killall`。

---

## 7. 诚实边界 · 未验证项 · 已知约束

1. **`user` 关键字陷阱未被消除**（见 §4.6）。改名只是让「正确的名字」不再是保留字；`FROM user` 仍静默返回 `current_user` 的 1 行。**不得**对外表述为「陷阱已消除」。
2. **`/api/user*` 路由改后未做端到端复测**：`seafood-api`（5788，pid 20334，`ts-node src/index.ts`）是**面板托管的常驻进程**，本单**禁止重启**，因此它跑的仍是**改名前的已加载代码**。改名后的 `src/database.ts` 只在下一次重启后才生效。`ledger-smoke.ts` 的 29 条断言走的是**直接 import 服务层**（非 HTTP），所以「对外 API 零破坏」这条**已实测**；而 `/api/user`、`/api/user/profile`、`/api/user/asset/:uID` 走 HTTP 的路径**未在改名后的进程里实测**。
3. **`ensureSupportSchema()` 里的既存失配（与本单无关，未修）**：`src/database.ts` 对该表的 SQL 用 `"uID"` / `"EVM"`（legacy 列名），而本库实际列名是 `uid` / `evm`；同函数内的 `CREATE INDEX … ON asset ("uID")` 引用的 `asset` 表在本库**不存在**。⇒ 该函数在本库**本来就会失败**（pre-existing），改名**未使其变好也未变坏**。本单按派单只改表名、**未改列名**。
4. **`total_supply` 自洽公式的简化项**：本单用 `Σmint − Σburn`（spec §11 判据 4 的主项），**未实现**判据 4 里的「＋Σ(冲正对 mint/burn 的净调整)」项。对本单终态**无影响**（清零后 `ledger_entry` 全表 0 行，所有项都是 0，故 cid=1 的答案为 0 与公式无关）；但若将来在**有流水**的库上复用该重整逻辑，必须补上冲正项（追 `reversal_of_txid`）。**已实测**：清零前 84 个非 cid=1 币中有 5 个存在 **−1** 的既存 drift（cid 67/74/75/77/87），说明该库历史上确实出现过与「纯 Σmint−Σburn」不吻合的写入 —— 这 5 个币已被清零删除，未单独深挖。
5. **冻结质检资产仍含 `"user"`**（4 文件 5 行，见 §4.4 [3]）——**按硬约束未修改**；若日后重跑这些探针会失败，属预期。
6. **`docs/**` 未改动**（按派单由 Jing 另轮同步，清单见 §8）。
7. **基线数值与派单所载略有出入**：派单记 `cid=1` 基线 `total_supply=10400 vs Σmint=4800`；本单开工实测为 `12800 vs 7200`（期间已有其它轮次的铸币）——**差值同为 5600**，成因判断不受影响。
8. 未 commit / 未 push（按硬约束）。

---

## 8. 交回 Jing 的 docs 同步清单

`grep -rn '"user"' docs/` ⇒ **6 文件 26 行**。**本单不改任何 docs 文件。**

### 8.1 活文档（**建议改**，优先级从高到低）
| 文件:行 | 现状说的 | 建议 |
|---|---|---|
| `docs/seafood.master-plan.md:325` | **硬1「引用 `user` 表必须写成 `"user"`」** | **最高优先**：改名后该规则**已失效**（`users` 不是保留字）。应改写为「业务身份表 = `public.users`；`FROM user` 裸写法仍会被解析成 `current_user`，但**已不再能碰对任何业务表**」 |
| `docs/seafood.master-plan.md:112` | D11 决策原文（含「`"user"` 17 处 / `'user'` / 裸 `user` 逐一改」） | 补「已于 migration `0006` 执行」；实测处数 = **17**（`src/database.ts`）+ `scripts` 2 处真表引用 |
| `docs/seafood.master-plan.md:123` | R21 legacy `"user"."uID"`（text）类型收敛推迟 | `"user"."uID"` → `"users".uid`（实际列名是 **`uid`**，且 0002 已收敛为 **bigint**） |
| `docs/ledger.spec.md:216` | R21 `"user"."uID"` 是 text / 类型分叉 | 同上 |
| `docs/ledger.spec.md:667` | 「legacy `"user"."uID"` 由自增分配」 | → `"users".uid` |
| `docs/ledger.spec.md:675` | R98 附注：与 legacy `"user"."uID"` 自增兼容 | → `"users".uid` |
| `docs/ledger.spec.md:789` | §决策表 8：legacy `"user"."uID"` 类型收敛 | → `"users".uid` |
| `docs/ledger.spec.md:815` | §未实测 5：「`"user"` 建表语句在仓库里不存在」 | → `"users"`；且建表语句**现由 `migrations/0002_user_identity.sql` 提供** |
| `docs/ledger.spec.md:852` | R21 行摘录（同 :216） | → `"users".uid` |

### 8.2 历史版本快照（**建议只加注、不改写**，或按 Jing 的版本策略统一）
- `docs/versions/ledger.spec.v0.2.md`：`210 / 661 / 669 / 780 / 806 / 843`（6 行）
- `docs/versions/ledger.spec.v0.1.md`：`207 / 656 / 664 / 740 / 766 / 803`（6 行）
- 建议加一行「表已于 migration `0006` 改名 `users`」，逐字保留原读数。

### 8.3 取证读数（**强烈建议不改**，改了就是篡改证据）
- `docs/qa/p1-ledger-concurrency.md:54` — 冻结 JSON 读数 `{"t":"user","n":"0"}`
- `docs/qa/p0-acceptance.md:175` — 「探针…统一用 `"user"` 表」
- `docs/qa/p0-acceptance.md:186` — `baseline "user" count = 0`（探针 stdout 原样引用）
- `docs/qa/p0-acceptance.md:217` — 「`"user"` 表最终行数 = 基线 0」
- `docs/qa/p0-acceptance.md:247` — 冻结 JSON `"public_base_tables": [..., "user"]`
  → 这 5 行建议**原样保留**，仅在文首加一句「该读数为 migration `0006` **改名前**快照」。

---

## 9. 交付物清单

| 路径 | 说明 |
|---|---|
| `backend-ts/migrations/0006_user_to_users.sql` | **新增**迁移（唯一新增的 migration） |
| `backend-ts/src/database.ts` | 改（17 处 `"user"` → `"users"`） |
| `backend-ts/scripts/inspect-schema.ts` | 改（1 处表引用 + 标签） |
| `backend-ts/scripts/purge-test-data.ts` | 改（前缀集 10 个 + 大小写不敏感；cid 自洽重整；事务内平台/币行硬断言） |
| `backend-ts/.p1g-artifacts/impact-inventory.md` | 第一步引用清单 |
| `backend-ts/.p1g-artifacts/p1g-acceptance.md` | 本文件 |
| `backend-ts/.p1g-artifacts/p1g-00-inventory.txt`、`p1g-01-probe2.txt`、`p1g-02-baseline.txt`、`p1g-03-postrename.txt`、`p1g-04-postpurge.txt` | 真库读数原始输出 |
| `backend-ts/.p1g-artifacts/p1g-migrate-1.json` / `p1g-migrate-2.json`（+ `.err`） | 迁移应用两次原始输出 |
| `backend-ts/.p1g-artifacts/p1g-tsc.txt` | `tsc --noEmit` 原始输出（0 行） |
| `backend-ts/.p1g-artifacts/p1g-smoke-api-after-rename.txt`、`p1g-smoke-db-after-rename.txt` | 清零前冒烟原始输出（29/0、11/0） |
| `backend-ts/.p1g-artifacts/p1g-grep.txt` | 改后 grep 残留原始输出 |
| `backend-ts/.p1g-artifacts/p1g-falsify-dryrun.txt`、`p1g-falsify-apply.txt` | 判负自证原始输出（exit 3 / exit 4） |
| `backend-ts/.p1g-artifacts/p1g-purge-dryrun.json`、`p1g-purge-apply.json`（+ `.err`） | 清零 dry-run 与真实清零原始输出 |
| `backend-ts/.p1g-artifacts/p1g-05-panel-health.txt` | 面板 16/16 + `/health` 原始输出 |
| `backend-ts/.p1g-artifacts/probe-0{0,1,2,3,4}-*.ts` | 只读探针脚本（00 inventory / 01 probe2 / 02 baseline / 03 postrename / 04 postpurge） |

`git status --porcelain`：
```
 M backend-ts/scripts/inspect-schema.ts
 M backend-ts/scripts/purge-test-data.ts
 M backend-ts/src/database.ts
?? backend-ts/.p1g-artifacts/
?? backend-ts/migrations/0006_user_to_users.sql
```
（未 commit / 未 push。`0001`–`0005`、`schema_migration`、`docs/**`、`frontend/**`、冻结质检资产、`.p1f-artifacts/**` 全部未被触碰。）

### 未修改（逐条对账硬约束）
- ❌ 未改 `0001`–`0005`（`migrate-2` 的 5 条 `checksum match` 即证据）
- ❌ 未投 `schema_migration`（6 行，`0001`–`0006` 均在，`applied_at` 前 5 条与开工时逐字一致）；未运行 `p1i-forget-migration.ts`
- ❌ 未改质检资产 `qa-p1e-*.ts` / `qa-p1b-*.ts` / `p1c-*.ts` / `p1e-*.ts` / `p1f-*.ts` / `p1j-read.ts`
- ❌ 未改 `.p1f-artifacts/` 已有文件
- ❌ 未改 `docs/**`、`frontend/**`
- ❌ 未停/未重启任何面板托管服务；未 `pm2 restart bistro-ctrl`；未使用 `pkill -f` / `killall`
- ❌ 未 commit / 未 push
- ✅ 清零阶段未新建测试数据；清零后**未再跑冒烟**
