# P1g · 第一步 · `"user"` 表完整引用清单（先落盘再动）

生成时间：2026-09-27 · 生成者：Kong（实现者）
方法：`grep -rn` 全仓扫描 + `scripts/p1g-00-inventory.ts` / `.p1g-artifacts/p1g-01-probe2.ts` 真库目录查询
原始输出：`.p1g-artifacts/p1g-00-inventory.txt`、`.p1g-artifacts/p1g-01-probe2.txt`

---

## 0. 结论摘要（先看这个）

| 项 | 实测结论 |
|---|---|
| 指向 `public."user"` 的 **FK** | **0 条**。`pg_constraint contype='f'` 且 `confrelid = public.user` ⇒ 空集 |
| 视图引用 | 0 |
| RLS 策略 | 0（`relrowsecurity = false`） |
| 非内部触发器 | 0 |
| **PL/pgSQL 函数体引用 `"user"`** | **0 条**（`prosrc LIKE '%"user"%'` ⇒ 空集；`prosrc ~* '\yuser\y'` 唯一命中是 `ledger_payload_amount` 里一句英文注释 `amount (user decimal, R72)`，**不是表引用**）⇒ **0004/0005 函数体无需 `CREATE OR REPLACE`** |
| `src/**` 真表引用 | **17 处**，全部在 `src/database.ts`，**均已带引号** |
| `src/**` 裸写法 | **0 处** |
| `scripts/**` 真表引用 | 5 个文件 6 行（其中 4 个文件是**冻结质检资产，按硬约束不得修改**） |
| `frontend/**` 真表引用 | **0 处**（命中的全是 `/api/user` 路由与 `localStorage` 键，同名不同物） |
| `docs/**` 引用 | 6 个文件 26 行（只交清单给 Jing，本单不改） |

> ### ⚠️ 必须纠正的一条预查结论
> 预查以为「有关联 FK 需要一并改表名」。**实测：没有任何 FK 指向 `public."user"`。**
> `pg_constraint contype='f'` 扫出的 4 条（`account_userId_fkey` / `invitation_inviterId_fkey` / `member_userId_fkey` / `session_userId_fkey`）全部指向 **`neon_auth."user"`** —— 那是 **Neon Auth 的另一个 schema 下的另一张表**，与 D11 无关，**本单绝不触碰**。
> 加 schema 限定的复核查询（`dns.nspname='public' AND dst.relname IN ('user','users')`）返回 **0 行**（`.p1g-artifacts/p1g-01-probe2.txt` §fk_from_public_schema_only）。

---

## 1. DB 侧（真库目录，只读查询）

数据库：Neon `neondb` · `public` schema · 迁移至 `0005`。

### 1.1 表本体
- `pg_class`：`relname='user'`, `relkind='r'`（普通表）
- 行数：`SELECT count(*) FROM "user"` = **0**
- 列（6 列，全部 snake_case 小写）：`uid bigint IDENTITY(BY DEFAULT) / evm text / bio text / is_admin boolean / time_reg timestamptz / time_login_last timestamptz`
  - 注：`src/database.ts` 里的 SQL 写的是 `"uID"` / `"EVM"`（legacy 列名），**在本库不存在** ⇒ 这是一处**既存**（pre-existing）失配，与本单无关，本单不改列名。

### 1.2 FK 约束（出边 / 入边）
- 指向 `public."user"`：**无**
- `public."user"` 指向别处：**无**
- 需要区分的同名物：`neon_auth."user"` 被 4 条 FK 指向（`account.userId` / `invitation.inviterId` / `member.userId` / `session.userId`，全在 `neon_auth` schema）⇒ **不动**。

### 1.3 关联对象（需随表改名，全部在 `public` schema）
| 类别 | 现状名 | 备注 |
|---|---|---|
| PK 约束 + 其索引 | `user_pk`（`PRIMARY KEY (uid)`，`indisprimary`） | `ALTER TABLE RENAME CONSTRAINT` 会同时改名底层索引 |
| UNIQUE 约束 + 其索引 | `user_evm_uniq`（`UNIQUE (evm)`） | 同上 |
| CHECK 约束 | `user_evm_fmt`（`evm ~ '^0x[0-9a-f]{40}$'`） | |
| CHECK 约束 | `user_uid_positive`（`uid > 0`，R98） | |
| NOT NULL 约束 | `user_uid_not_null` / `user_evm_not_null` / `user_bio_not_null` / `user_is_admin_not_null` / `user_time_reg_not_null` / `user_time_login_last_not_null` | PG 18 已把 NOT NULL 编目为约束（`contype='n'`） |
| 独立索引 | `idx_user_evm_lower`（`ON public."user" USING btree (lower(evm))`） | 非约束支撑索引，须显式 `ALTER INDEX RENAME` |
| 序列 | `user_uid_seq`（identity，`pg_depend deptype='i'`） | PG **不会**随表改名自动改序列名 ⇒ 须显式改名 |
| 行类型 | `public."user"`（`deptype='i'`，自动） | 随表名自动变 |
| TOAST | `pg_toast.pg_toast_24750` | 随表自动 |

### 1.4 视图 / 物化视图
- `pg_class relkind IN ('v','m')` 且 `pg_get_viewdef ~ '"user"'` ⇒ **0 行**

### 1.5 RLS
- `pg_policies` 中 `tablename IN ('user','users')` ⇒ **0 行**
- `relrowsecurity = false`，`relforcerowsecurity = false`

### 1.6 触发器
- `pg_trigger` 且 `tgrelid = public.user` ⇒ **0 行**（仅有 8 条 `tgisinternal=true` 的 FK 内部触发器，且它们的宿主是 `neon_auth."user"`，不是 public 表）
- 注：本库的守卫触发器（append-only / account 守卫）在 `ledger_entry` / `account` 上，与 `user` 表无关。

### 1.7 PL/pgSQL 函数体
```
prosrc LIKE '%"user"%'          ⇒ 0 行
prosrc ~* '\yuser\y'            ⇒ 1 行：ledger_payload_amount(jsonb,integer,text,text)
                                  命中片段: 'note','exactly one of amount (user decimal, R72) / amount_units ...'
                                  ⇒ 英文注释，非表引用 ⇒ 无需 CREATE OR REPLACE
```
⇒ **0004 / 0005 的函数体对 `"user"` 零引用，本单不需要重发任何函数。**

### 1.8 权限
`information_schema.role_table_grants` 对 `public.user`：`neondb_owner` 持有 SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER。改名**不改变** owner 与权限（OID 不变）。

### 1.9 保留字陷阱 · 改名前基线实测
```
quoted=0  bare=1     （同一时刻：SELECT count(*) FROM "user" = 0 ；SELECT count(*) FROM user = 1）
```

---

## 2. 代码侧（逐文件逐行分类）

### 2.1 `backend-ts/src/` —— 真表引用（全部为 **17 处**，全在 `database.ts`，**全部已带引号**）

| # | 行 | 形态 | 分类 |
|---|---|---|---|
| 1 | `src/database.ts:405` | `ALTER TABLE IF EXISTS "user" ADD COLUMN ... "bio"` | 真表引用（DDL） |
| 2 | `src/database.ts:406` | `ALTER TABLE IF EXISTS "user" ADD COLUMN ... "is_admin"` | 真表引用（DDL） |
| 3 | `src/database.ts:407` | `ALTER TABLE IF EXISTS "user" ADD COLUMN ... "time_login_last"` | 真表引用（DDL） |
| 4 | `src/database.ts:411` | `FROM "user"`（MAX(uID) 回填 CTE） | 真表引用（SELECT） |
| 5 | `src/database.ts:422` | `FROM "user"`（missing CTE） | 真表引用（SELECT） |
| 6 | `src/database.ts:425` | `UPDATE "user" AS u SET "uID" = ...` | 真表引用（UPDATE） |
| 7 | `src/database.ts:518` | `CREATE INDEX IF NOT EXISTS idx_user_uid ON "user" ("uID")` | 真表引用（DDL） |
| 8 | `src/database.ts:519` | `CREATE INDEX IF NOT EXISTS idx_user_evm_lower ON "user" (LOWER("EVM"))` | 真表引用（DDL） |
| 9 | `src/database.ts:1015` | `FROM "user"`（`getNextUserId`） | 真表引用（SELECT） |
| 10 | `src/database.ts:1130` | `FROM "user" AS u`（`getAllUsers`） | 真表引用（SELECT） |
| 11 | `src/database.ts:1146` | `FROM "user" AS u`（`getUserById`） | 真表引用（SELECT） |
| 12 | `src/database.ts:1160` | `FROM "user" AS u`（`getUserByEvm`） | 真表引用（SELECT） |
| 13 | `src/database.ts:1174` | `INSERT INTO "user" AS u (...)` （`createUserByEvm`） | 真表引用（INSERT） |
| 14 | `src/database.ts:1185` | `UPDATE "user" AS u SET "time_login_last"` （`touchUserLogin`） | 真表引用（UPDATE） |
| 15 | `src/database.ts:1213` | `UPDATE "user" AS u SET "bio"/"is_admin"` （`updateUserProfile`） | 真表引用（UPDATE） |
| 16 | `src/database.ts:1646` | `JOIN "user" AS u`（`listPendingVerification`） | 真表引用（JOIN） |
| 17 | `src/database.ts:1688` | `JOIN "user" AS u`（`countPendingVerification`） | 真表引用（JOIN） |

合计：DML 12 处（FROM×7 / UPDATE×3 / INSERT×1 / JOIN×2 —— 行 411/422/1015/1130/1146/1160 = FROM 6 处，加 425/1185/1213 = UPDATE 3 处，`INSERT INTO` 1 处，`JOIN` 2 处 = 12）+ DDL 5 处（ALTER×3 / CREATE INDEX×2）= **17 处**。
> 与 Zang 预查的「11 处」有出入：预查只数了 DML 形态中的一部分。**以本实测 17 处为准**（`grep -rc '"user"' src/*.ts` ⇒ `src/database.ts:17`，其余 6 个 src 文件 = 0）。

### 2.2 `backend-ts/src/index.ts` —— `user` 字样 75 行，**真表引用 0 处**

逐行分类（`grep -n 'user' src/index.ts`，75 行，全部归入下列 5 类，**无一为表引用**）：
- **变量/形参名**：`const user = ...`（104/239/828…）、`actor.user`（333/351/390/395/425/439/482/489/519/528/539/562/576/594/612/626/640/658/676…）、`user: UserRecord`（87）、`[task, user]`（1024/1662）
- **方法名**（`DatabaseService.*User*`）：`findOrCreateUserByEvm`（239）、`getUserAsset`（163/240/395/528…）、`updateUserProfile`（351）、`updateUserAdminStatus`（828）、`getAllUsers`（949）、`listPrizeItemsByUser` / `listTaskProgressByUser` / `listShardHoldingsByUser` / `listShardTransfersByUser` / `listOrdersByUser` / `listClaimedPrizeIdsByUser` / `ensureTaskProgressForUserTask`（425/439/562/576/626/390/489）
- **HTTP 路由字符串**（6 处）：`/api/user`（188、328）、`/api/user/profile`（341）、`/api/user/asset/:uID`（364）、`/api/admin/user/update`（818）—— **同名不同物，不得改**
- **本地变量/字段**：`userID`（171-172）、`users`（765/769/950/953/966）、`updatedUser`（351）、`user_ids`（786/787）、`user_points`（410/532/548）、`user_count`（1712/1731）
- **日志/错误文案**：`'Error loading current user:'`（336）、`'Failed to load user'`（337）、`'Error updating user profile:'`、`'Failed to update user'`、`'Error loading user list:'`、`'Failed to load users'`、`'Invalid user ID'`、`'Get user asset error:'`、`'Error loading user orders:'` 等

### 2.3 `backend-ts/scripts/` —— 真表引用 6 行 / 5 文件

| 文件:行 | 内容 | 分类 | 本单处置 |
|---|---|---|---|
| `scripts/purge-test-data.ts:43` | `type Counts = { ...; "user": number }` | TS 类型键名（非 SQL） | **改**（键名 → `users`） |
| `scripts/purge-test-data.ts:56` | `UNION ALL SELECT 'user', count(*)::text FROM "user"` | **真表引用** | **改** |
| `scripts/inspect-schema.ts:49` | `UNION ALL SELECT 'user', count(*)::int FROM "user"` | **真表引用** | **改** |
| `scripts/p1e-05-inventory.ts:13` | 注释里的 `` `user` `` / `"user"` | 说明文字 | ⛔ 冻结资产，不改 |
| `scripts/p1e-05-inventory.ts:25` | `(SELECT count(*) FROM "user") AS user_rows` | **真表引用** | ⛔ 冻结资产（`p1e-*`），不改 |
| `scripts/qa-p1b-00-env.ts:49` | `UNION ALL SELECT 'user', count(*) FROM "user"` | **真表引用** | ⛔ 冻结资产（`qa-p1b-*`），不改 |
| `scripts/qa-p1e-00-baseline.ts:45` | `UNION ALL SELECT '"user"', count(*)::text FROM "user"` | **真表引用** | ⛔ 冻结资产（`qa-p1e-*`），不改 |
| `scripts/p1c-06-post-verify.ts:36` | `UNION ALL SELECT 'user', count(*)::text FROM "user"` | **真表引用** | ⛔ 冻结资产（`p1c-*`），不改 |

> **硬约束冲突的显式披露**：派单同时要求「`grep` 真表引用零残留」与「不得改 `qa-p1e-*` / `qa-p1b-*` / `p1c-*` / `p1e-*`」。这四个文件是**已归档的质检取证资产**，其中 `"user"` 是**当时的历史读数证据**（例如 `qa-p1e-00-baseline.ts` 故意把字面量写成 `'"user"'` 以自证引号写法）。本单**判定：冻结资产优先**，不动它们；「零残留」的 grep **作用域 = `src/**` + 非冻结 `scripts/**`**，冻结资产单列并说明。这 4 个文件若日后重跑会因表已改名而失败 —— 属预期（它们是历史快照，不是活路径）。

### 2.4 `frontend/` —— 真表引用 **0 处**
- `localStorage.getItem('user')` / `setItem('user', ...)`：**3 处**（`frontend/src/auth.js` 等）—— 浏览器本地存储**键名**，与 DB 表名同名不同物 ⇒ **不得改**
- `/api/user`、`/api/user/asset/${uID}`、`/api/user/stats`、`/api/user/all`、`/api/user/profile`：**15 处**（`frontend/src/admin-utils.js:78/88/89`、`frontend/src/auth.js:142/153` 等）—— HTTP 路由 ⇒ **不得改**
- `frontend/src` 内 `FROM user` / `INSERT INTO user` / `UPDATE "user"` 等裸/引号表引用：**0 处**

---

## 3. docs 侧（只交清单，本单不改 —— 给 Jing）

`grep -rn '"user"' docs/` ⇒ 6 文件 26 行。逐行定性见下（`应改成 users` 一栏是给 Jing 的建议，非本单执行项）。

| # | 文件:行 | 该行在说什么 | 建议 |
|---|---|---|---|
| 1 | `docs/seafood.master-plan.md:112` | D11 决策原文：「`user` 表重命名为 `users`」 | 改：决策已落地 ⇒ 补一句「已于 migration 0006 执行」；文中的 `"user"` 17 处/`'user'`/裸 `user` 措辞同步 |
| 2 | `docs/seafood.master-plan.md:123` | R21：legacy `"user"."uID"` 类型收敛推迟 | 改：`"user"."uID"` → `"users".uid`（表已改名；列名是 `uid` 非 `"uID"`） |
| 3 | `docs/seafood.master-plan.md:325` | **硬1：引用 `user` 表必须写成 `"user"`** | **改（高优先）**：改名后 `users` **不是保留字**，原硬1 规则**失效**；应改为「业务身份表 = `public.users`；`FROM user` 裸写法仍会被解析成 `current_user`，但**已不再能碰对任何业务表**」 |
| 4 | `docs/ledger.spec.md:216` | R21 legacy `"user"."uID"` 为 text 列 / 类型分叉 | 改：→ `"users".uid`（现为 `bigint`，类型分叉已由 0002 消除，宜标注） |
| 5 | `docs/ledger.spec.md:667` | 「legacy `"user"."uID"` 由自增分配」 | 改：→ `"users".uid` |
| 6 | `docs/ledger.spec.md:675` | R98 附注：与 legacy `"user"."uID"` 自增兼容 | 改：→ `"users".uid` |
| 7 | `docs/ledger.spec.md:789` | §决策表 8：legacy `"user"."uID"` 类型收敛 | 改：→ `"users".uid` |
| 8 | `docs/ledger.spec.md:815` | §未实测 5：`"user"` 建表语句在仓库不存在 | 改：`"users"`；且建表语句现由 `migrations/0002` 提供 |
| 9 | `docs/ledger.spec.md:852` | R21 行摘录（同 #4） | 改：同 #4 |
| 10-15 | `docs/versions/ledger.spec.v0.2.md:210 / 661 / 669 / 780 / 806 / 843` | 与 #4-#9 一一对应（v0.2 历史版本） | **可选**：历史版本快照，建议**保留原样**并加一行「表已改名 `users`，见 0006」；或按 Jing 的版本策略统一 |
| 16-21 | `docs/versions/ledger.spec.v0.1.md:207 / 656 / 664 / 740 / 766 / 803` | 与上同理（v0.1 历史版本） | **可选**：同上 |
| 22 | `docs/qa/p1-ledger-concurrency.md:54` | 冻结 JSON 读数：`{"t":"user","n":"0"}` | **不改**（历史取证读数，改了就是篡改证据）；可在文首加一句「该读数为改名前快照」 |
| 23 | `docs/qa/p0-acceptance.md:175` | 「探针…统一用 `"user"` 表」 | **不改**（历史）；建议加改名注记 |
| 24 | `docs/qa/p0-acceptance.md:186` | `baseline "user" count = 0`（原样引用的探针 stdout） | **不改**（历史 stdout） |
| 25 | `docs/qa/p0-acceptance.md:217` | 「`"user"` 表最终行数 = 基线 0」 | **不改**（历史） |
| 26 | `docs/qa/p0-acceptance.md:247` | 冻结 JSON：`"public_base_tables": [..., "user"]` | **不改**（历史读数） |

**给 Jing 的一句话**：活的文档是 `docs/seafood.master-plan.md`（尤其 **:325 硬1 规则必须改写**）与 `docs/ledger.spec.md`（R21/R98/§16 相关行）；`docs/versions/**` 是版本快照、`docs/qa/**` 是取证读数，二者建议只加注不改写。

---

## 4. 本单「要改」的清单（据上表收敛）

**代码（真表引用，共 18 处）**
- `backend-ts/src/database.ts`：行 405 / 406 / 407 / 411 / 422 / 425 / 518 / 519 / 1015 / 1130 / 1146 / 1160 / 1174 / 1185 / 1213 / 1646 / 1688 —— `"user"` → `"users"`（17 处）
- `backend-ts/scripts/purge-test-data.ts`：行 56 的 SQL 表名 + 行 43/58/65 的 TS 键名 `"user"` → `users`（1 处真表引用）
- `backend-ts/scripts/inspect-schema.ts`：行 49 `"user"` → `"users"`（1 处真表引用）

**DB（migration 0006）**
- `ALTER TABLE public."user" RENAME TO users`（幂等守卫）
- 约束 `user_pk` / `user_evm_uniq` / `user_evm_fmt` / `user_uid_positive` / `user_*_not_null`(×6) → `users_*`
- 索引 `idx_user_evm_lower` → `idx_users_evm_lower`（PK/UNIQUE 索引随约束改名）
- 序列 `user_uid_seq` → `users_uid_seq`
- FK：**无**（0 条）⇒ 无事可做，但迁移内仍写一条**断言**：若存在指向 `public.user` 的 FK 则报错中止（防未来漂移）
- PL/pgSQL 函数体：**无**（0 条）⇒ 无事可做

**不改**：`localStorage` 键 `'user'`、`/api/user*` 路由、所有变量名/方法名、`src/index.ts` 全文、`frontend/**`、`docs/**`、`0001`–`0005`、`schema_migration`、冻结质检资产（`qa-p1e-*` / `qa-p1b-*` / `p1c-*` / `p1e-*` / `p1f-*` / `p1j-read.ts`）。
