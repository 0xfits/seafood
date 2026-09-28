# P3 平台配置柱 `0017_platform_config.sql` — 独立质检报告（Neng）

> **被检件**：`backend-ts/migrations/0017_platform_config.sql`
> **现取指纹（我本次自测）**：**31026 B** / sha256 `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd`（`split('\n').length=455` ⇒ **454 内容行 + 末尾换行**）
> **库**：Neon（PG `18.6`）· 驱动 `@neondatabase/serverless` + `ws` · 所有 SQL 限定 `public.`
> **run tag**：`run-04-20260928T131329Z`（我本次现跑；**未引用任何他人读数**；上一单 `deleg_090ebe45` 因服务商 402 掐断，其 `probe.js` 我未引用其输出）
> **reuse-free 说明**：读数来源 = 我自建探针 `neng17-probe-run04.js`（前身 `probe.js` 仅作结构参考，**其文件读数为零引用**；run-01/02/03 为我自己的中间 run，run-02/03 因夹具缺陷被弃用，见 §7）
> **口径**：`NOT_MEASURED` 不填 0 / 空数组占位。**只写** `docs/qa/p3-0017-platform-review.md` + scratch 目录。

---

## §0 verdict

# verdict = 可用

**理由（一句话）**：6 张新表逐列与 §6.6（`DL71`/`DL72`/`DL73`）**逐项相等**、约束/索引/FK/触发器全对拍、6 个 FK **全为 `NO ACTION`（无 `CASCADE`）**、`app_config` 无 `privacy` / 无余额列（`DL3`）、权限三态真值表 **3/3 符合**、`currency_status_log` append-only **UPDATE/DELETE 双拒（`P0001` 逐字）且合法 INSERT 成功**、`app_config` 守卫五项全对、FK 无级联删除行为**双向对拍**、判负自证 **GREEN→RED→RESTORE 逐字节回绿**、迁移 **17/17 `skipped` exit 0**、冻结面 **`git diff` 零改动**、四编排函数指纹**未变**。三条预登记张力**全部成立且已登记**（属规范澄清事项，非交付缺陷）。

- **判定项数**：**43 项**（§1 表）— 通过 **43 / 43**。
- **未验证项数**：**15 项**（§6，枚举到边界）。
- **不建议拦截**：本条「可用」= 数据层交付物可用；路由层单（`GET /api/admin/settings` 等）不在本柱范围（见 §6-1）。

---

## §1 逐项判定表（43 项 → 期望 → 实测 → 判定）

| # | 项 | 期望 | 实测（run-04） | 判定 |
|---|---|---|---|---|
| C1 | `schema_version` | `0017` | `0017` | ✅ |
| C2 | registry 行数 | 17 | `17` | ✅ |
| C3 | `public` 基表数 | 21 | `21` | ✅ |
| C4 | `app_config` 逐列（名/序/类型/nullable/default） | key/text/NN无默认 · value/jsonb/NN · updated_by/bigint/NN · time_updated/timestamptz/NN/`now()` | 逐字相符（序 1..4） | ✅ |
| C5 | `admin_role` 逐列 | role_key/text PK · name/text 可空 · time_created/tstz/NN/`now()` | 相符 | ✅ |
| C6 | `admin_permission` 逐列 | permission_key/text PK · name/text 可空 | 相符 | ✅ |
| C7 | `admin_role_permission` 逐列 | role_key/text NN · permission_key/text NN | 相符 | ✅ |
| C8 | `admin_user_role` 逐列 | uid/bigint NN · role_key/text NN | 相符 | ✅ |
| C9 | `currency_status_log` 逐列 + `is_identity` | log_id/bigint **is_identity=YES** `BY DEFAULT` · cid NN · from_status NN · to_status NN · actor_uid NN · memo 可空 · time_created NN/`now()` | 逐字相符；`log_id is_identity=YES / identity_generation=BY DEFAULT` | ✅ |
| C10 | PK 数 | 6 | 6（`*_pk`） | ✅ |
| C11 | FK 数 + 逐条 `pg_get_constraintdef` | 6（users×2 / currency×1 / admin_role×2 / admin_permission×1） | 6，逐条相符 | ✅ |
| **C12** | **6 个 FK 删除行为非 CASCADE** | 全 `NO ACTION` | `confdeltype='a'` ×6（见 §4） | ✅ |
| C13 | 索引 `indexdef` | 恰 6（各表 PK 自带） | 恰 6，全 `CREATE UNIQUE INDEX …_pk … btree`；**无额外索引** | ✅ |
| C14 | 触发器 `tgenabled` | 7 个全 `O` | 7/7 `O`；全库非 `O` = **0** | ✅ |
| C15 | `currency_status_log` append-only 触发器覆盖 | UPDATE + DELETE | `tgtype=27`，`fires_update=true, fires_delete=true` | ✅ |
| C16 | `app_config` **无 `privacy` 列** | 0 | `app_config_privacy_col_count=0` | ✅ |
| C17 | `app_config` **无任何余额列**（`DL3`） | 0（`%balance%`/`%amount%`/`%fee%`） | `app_config_balance_like_cols=[]` | ✅ |
| C18 | `app_config` FK 数 = 0（张力①反断言） | 0 | 0 | ✅ |
| C19 | registry `checksum` == 现文件 sha256 | 相等 | `0aaba855…1fcd` == `0aaba855…1fcd` ⇒ `true` | ✅ |
| P1 | 权限三态①is_admin=true 无角色行 | 可进 | `can_access_admin=true`（uid 990801） | ✅ |
| P2 | 三态②is_admin=false 有角色行 | 可进 | `can_access_admin=true`（uid 990802） | ✅ |
| P3 | 三态③两者皆无 | 不可进 | `can_access_admin=false`（uid 990803） | ✅ |
| P4 | 角色→权限联查 | 得「可进 + 具体权限」 | `{uid:990802, role_key:neng17:ops, permission_key:neng17:read:settings}` | ✅ |
| A1 | `currency_status_log` 合法 INSERT（对照） | 成功 | `rejected=false, log_id=9` | ✅ |
| A2 | `UPDATE` 必拒 | 拒 | `P0001` `currency_status_log is append-only: UPDATE forbidden (log_id=9)` | ✅ |
| A3 | `DELETE` 必拒 | 拒 | `P0001` `currency_status_log is append-only: DELETE forbidden (log_id=9)` | ✅ |
| A4 | 旁路 `DISABLE TRIGGER USER`（事务内，ROLLBACK） | 诚实边界：可绕 | `disable_ok=true`，UPDATE `rowCount=1`（**可绕**，非「绝对不可变」） | ✅ |
| G1 | `app_config.key` 重复 | `23505` | `23505` `…unique constraint "app_config_pk"` | ✅ |
| G2 | `value` NULL | 拒 | `23502` `null value in column "value" … not-null constraint` | ✅ |
| G3 | 裸标量 `'128'::jsonb`（`DL3`） | 拒 | `23514` `…check constraint "app_config_value_is_container"` | ✅ |
| G4 | `key` 不可变（`UPDATE key`） | 拒 | `P0001` `immutable key column: public.app_config.key cannot change (neng17:cfg -> neng17:renamed)` | ✅ |
| G5 | `time_updated` 由触发器刷新（`R5`） | 存 `now()` | 客户端传 `2000-01-01T00:00:00Z` ⇒ 存 `2026-09-28 13:18:01.247774+00`（== `now()`） | ✅ |
| G6 | `DELETE` 自建行（口径③） | 成功 | `rejected=false, rowCount=1` | ✅ |
| F1 | 删**被引用** `admin_role` | 必失败 | `23503` `…constraint "admin_user_role_role_fk" on table "admin_user_role"` | ✅ |
| F2 | 删**未被引用** `admin_role` | 成功 | `rejected=false, rowCount=1` | ✅ |
| D1 | `currency` 表触发器清单（定向） | 0 个或与日志无关 | `currency_trigger_count=0`；`currency_triggers=[]` | ✅ |
| D2 | 库内有无函数写 `currency_status_log` | 无 DB 层强制 | `functions_writing_csl=[]` | ✅ |
| X1 | 判负自证（scratch 破件 + 真库 RED/RESTORE） | 尺子会响 + 回绿 | GREEN `P0001` / RED `rowCount=1`（**必红**）/ RESTORE `P0001`；`trg_after='O'`；`sha_main_equal=true` | ✅ |
| X2 | 判负前冲突行核查 | 全属本人命名空间 | `foreign_rows_present` 全 `0`；`currency_status_log_total=0`；`neng_users=0` | ✅ |
| M1 | 迁移幂等自跑 | 17/17 `skipped` exit 0 | **17/17 `skipped` / `MIGRATE_EXIT=0` / `public_base_table_count=21`** | ✅ |
| M2 | 冻结面零改动（`git diff --stat`） | 空 | `git status --porcelain` 空、`git diff --stat` 空（`src`/`migrations`/`frontend`/`docs/*.spec.md`/`versions`/`master-plan` 全空） | ✅ |
| M3 | 四编排函数指纹未变（`DL142`） | 未变 | `ledger_post_event` 51429/`d94dd902…`、`job_post_event` 13594/`0cedbb9e…`、`listing_post_event` 17858/`0e187c20…`、`market_post_event` 30194/`74841611…` | ✅ |
| M4 | `users` 表未被 ALTER（`DL72`） | 6 列含 `is_admin` | `uid,evm,bio,is_admin,time_reg,time_login_last`（`is_admin boolean NN DEFAULT false`） | ✅ |

**合计：43/43 ✅**

---

## §2 逐列契约对拍明细（§6.6 / `DL71`–`DL73`）

| 表 | 列（序 → 名:类型:nullable:default:identity） | 对 spec |
|---|---|---|
| `app_config` (4) | 1 `key:text:NN:-:-` · 2 `value:jsonb:NN:-:-` · 3 `updated_by:bigint:NN:-:-` · 4 `time_updated:timestamptz:NN:now():-` | ✅ 与 `DL71` 逐字 |
| `admin_role` (3) | 1 `role_key:text:NN:-:-` · 2 `name:text:Y:-:-` · 3 `time_created:timestamptz:NN:now():-` | ✅ 与 `DL72` |
| `admin_permission` (2) | 1 `permission_key:text:NN:-:-` · 2 `name:text:Y:-:-` | ✅ |
| `admin_role_permission` (2) | 1 `role_key:text:NN` · 2 `permission_key:text:NN` | ✅ |
| `admin_user_role` (2) | 1 `uid:bigint:NN` · 2 `role_key:text:NN` | ✅ |
| `currency_status_log` (7) | 1 `log_id:bigint:NN:-,is_identity=YES(BY DEFAULT)` · 2 `cid:bigint:NN` · 3 `from_status:text:NN` · 4 `to_status:text:NN` · 5 `actor_uid:bigint:NN` · 6 `memo:text:Y` · 7 `time_created:timestamptz:NN:now()` | ✅ 与 `DL73` |

**约束全清单（`pg_constraint` 现取）**：
- CHECK：`app_config_value_is_container` = `CHECK (jsonb_typeof(value) = ANY (ARRAY['object','array']))`（`DL3` 禁存余额）。
- PK：`app_config_pk(key)` / `admin_role_pk(role_key)` / `admin_permission_pk(permission_key)` / `admin_role_permission_pk(role_key,permission_key)` / `admin_user_role_pk(uid,role_key)` / `currency_status_log_pk(log_id)`。
- FK：见 §4。
- NOT NULL 约束 21 条（PG 18 显式建 `contype='n'`），逐列与上表 nullable 一致。
- 无 `UNIQUE`（除 PK 自带）、无 `EXCLUDE`、无 `CREATE DOMAIN`。

---

## §3 权限单一真源（三态真值表，我独立构造）

**口径（本柱无判定函数，遵 brief 不自创接口；用独立只读 SQL）**：
```sql
SELECT (u.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid)) AS can_access_admin
  FROM public.users u WHERE u.uid = $1;
```
夹具（事务内 `ROLLBACK`，**零残留**）：uid `990801`/`990802`/`990803`，角色键前缀 `neng17:`（`neng17:ops` / `neng17:read:settings`）。

| 组 | 夹具 | `can_access_admin`（实测） | 判定 |
|---|---|---|---|
| ① | uid 990801 `is_admin=true`，**无** `admin_user_role` 行 | `true` | ✅ 可进 |
| ② | uid 990802 `is_admin=false`，**有** `admin_user_role(uid,role_key)='neng17:ops'` | `true` | ✅ 可进 |
| ③ | uid 990803 `is_admin=false`，**无** `admin_user_role` 行 | `false` | ✅ 不可进 |

**角色→权限联查（②的可进 + 具体权限）**：
```
{uid:990802, role_key:'neng17:ops', permission_key:'neng17:read:settings', can_access_admin:true}
```
⇒ 「可进」由 `is_admin OR ∃role` 单源判定；「具体权限」由 `admin_user_role ⋈ admin_role_permission ⋈ admin_permission` 得出。**两关均可由数据层查询复现。**

---

## §4 append-only / 守卫矩阵 + FK 删除行为（头号读数）

### §4.1 `currency_status_log`（append-only）
| 用例 | SQLSTATE | message（逐字） | 判定 |
|---|---|---|---|
| 合法 INSERT（对照，证明尺子不滥杀） | — | `rejected=false, log_id=9` | ✅ 成功 |
| `UPDATE … SET memo='x'` | **`P0001`** | `currency_status_log is append-only: UPDATE forbidden (log_id=9)` | ✅ 拒 |
| `DELETE FROM … WHERE log_id=9` | **`P0001`** | `currency_status_log is append-only: DELETE forbidden (log_id=9)` | ✅ 拒 |
| 旁路：同事务 `ALTER TABLE … DISABLE TRIGGER USER` → `UPDATE` → `ROLLBACK` | — | `disable_ok=true`，UPDATE `rowCount=1`（**成功绕过**） | ✅ 与文件头诚实边界一致 |

`csl_all_triggers = [trg_currency_status_log_append_only (O, BEFORE DELETE OR UPDATE)]`（仅此一个，无其它守卫）。

### §4.2 守卫矩阵（`app_config` / `admin_*`）
| 表 | PK 列不可变 | `time_updated` 刷新 | DELETE | 实测 |
|---|---|---|---|---|
| `app_config` | ✅ `trg_app_config_key_immutable('key')` `O` | ✅ `trg_app_config_touch_updated` `O` | **允许** | G4 `P0001` / G5 刷新为 `now()` / G6 成功 |
| `admin_role` | ✅ `(''role_key'')` | n/a（无该列） | **允许** | C14；§5.2 删角色行为 |
| `admin_permission` | ✅ `('permission_key')` | n/a | **允许** | C14 |
| `admin_role_permission` | ✅ `('role_key','permission_key')` | n/a | **允许** | C14 |
| `admin_user_role` | ✅ `('uid','role_key')` | n/a | **允许**（撤销分配） | C14 |

### §4.3 FK 删除行为（**特别确认非 CASCADE**）
| 约束名 | 定义（`pg_get_constraintdef`） | `confdeltype` | 删除行为 |
|---|---|---|---|
| `admin_role_permission_role_fk` | `FOREIGN KEY (role_key) REFERENCES admin_role(role_key)` | `a` | NO ACTION |
| `admin_role_permission_perm_fk` | `FOREIGN KEY (permission_key) REFERENCES admin_permission(permission_key)` | `a` | NO ACTION |
| `admin_user_role_uid_fk` | `FOREIGN KEY (uid) REFERENCES users(uid)` | `a` | NO ACTION |
| `admin_user_role_role_fk` | `FOREIGN KEY (role_key) REFERENCES admin_role(role_key)` | `a` | NO ACTION |
| `currency_status_log_cid_fk` | `FOREIGN KEY (cid) REFERENCES currency(cid)` | `a` | NO ACTION |
| `currency_status_log_actor_fk` | `FOREIGN KEY (actor_uid) REFERENCES users(uid)` | `a` | NO ACTION |

**⇒ 6/6 `NO ACTION`，`CASCADE` 数 = 0。**

| 用例 | 实测 | 判定 |
|---|---|---|
| 删被引用 `admin_role('neng17:ref')`（有 `admin_user_role` 行） | `23503` `update or delete on table "admin_role" violates foreign key constraint "admin_user_role_role_fk" on table "admin_user_role"`；`detail`：`Key (role_key)=(neng17:ref) is still referenced from table "admin_user_role".` | ✅ 必失败 |
| 删未引用 `admin_role('neng17:free')` | `rejected=false, rowCount=1` | ✅ 成功 |

---

## §5 定向项（与 `0016` `C2` 同族；**只读 + 自有夹具**）

**命题**：核「`currency.status` 变更 ↔ `currency_status_log` 写入」的一致性由谁保证。

**只读读数（`run-04-…-directed.json`）**：
| 读数 | 实测 |
|---|---|
| `currency` 表触发器清单 | `[]`（`currency_trigger_count=0`） |
| 触发器函数体提及 `currency_status_log` | `[]` |
| 全库函数写 `currency_status_log` | `functions_writing_csl=[]` |
| `currency_status_log` 触发器 | 仅 `trg_currency_status_log_append_only (O)` |
| `currency.status` 分布（只读，**未改**） | `draft=15` / `listed=86` |
| `currency_status_log` 当前行数 | `0` |

**结论（我的判断）**：DB 层**不强制写日志** —— `currency` 上 0 触发器、库内无任何函数写 `currency_status_log`。⇒ 「冻结/解冻必须写审计」是**路由层硬约束**（spec §10.1 行 `POST /api/admin/currency/:cid/status` 要求「必须写 `currency_status_log`」，`DL73`/`R29`），**数据层不兜底**。**自曝风险**：若路由层漏写，DB 不会报错 ⇒ 需在路由单补判负用例（见 §6-3）。存量 `currency` 行 `status` **未改动**（仅 `GROUP BY` 只读）。

---

## §6 未验证清单（枚举到边界）

1. **路由层未接（端到端未测）** —— `GET /api/admin/settings`（#35）/ `GET /api/admin/permissions`（#38）/ `POST /api/admin/currency/:cid/status` 的借码 / HTTP 状态 / 幂等键 `ops:<uid>:currency_status:<cid>:<to_status>` **全部未测**（`src/**` 本柱不改）。
2. **权限判定在 API 层的收敛未测** —— 旧 `permission_group` / `isAdminAddress` 双源的**代码层收敛**属路由单；本柱只验证了**数据层查询口径**。
3. **`currency.status` 与日志的一致性仅证明「DB 不强制度」** —— 即 §5 证明「DB 不写入/不强制」；路由层**是否真写日志**未测（需路由单判负用例）。触发器的存在也不排除「路由先改 status 后写 log 失败」的中间态。
4. **`from_status`/`to_status` 取值面未加 CHECK** —— 是否受 `R28` 状态机约束（白名单）**未测**（§6.6/`DL73` 未列白名单）。
5. **`app_config.updated_by` FK 边界未跨层验证** —— 张力①下不加 FK；「平台 uid 不在 `users` 时仍可写」**仅由无 FK 推断**，未做跨层验证。
6. **并发 / 竞态未测** —— 同键并发 INSERT 的竞态、`admin_user_role` 并发分配未做并发探针（PK 唯一约束在 DB 层兜底，但未实测竞态）。
7. **`name` / `memo` 空串（`""`）的数据质量未加业务约束** —— 逐列照 spec 的可空文本，依赖路由层校验（未测）。
8. **`TRUNCATE` 旁路 = `NOT_MEASURED`** —— 遵硬边界**禁 TRUNCATE 既有表**，故仅测 `DISABLE TRIGGER USER` 旁路（已测，可绕）；`TRUNCATE` 对 append-only 的绕过**未实测**。
9. **`app_config.value` 为数组（`[]`）的合法性未单测** —— CHECK 允许（`jsonb_typeof IN ('object','array')`），逻辑同 object，未单独触达。
10. **`admin_role_permission` 的 DELETE 允许性未单测** —— 口径同 `admin_user_role`（允许），未逐条实测。
11. **`DL151`（跨 schema 裸表名）静态扫描未做** —— `src/**` 未改，不适用；本柱自有 SQL 全部限定 `public.`。
12. **权限三态真值表与路由层实现逐字一致性未测** —— 数据层口径已证，路由实现是否逐字照抄未测。
13. **真实冻结/解冻流程产生的 `currency_status_log` 行未测** —— 现有读数行数 `0`；我夹具插入的行属自造（已回滚）。
14. **`DL75` 三件套缺失的端到端影响未测** —— 张力②裁「逐列优先」；缺 `create_key`/`ledger_event_keys` 的幂等重放场景（`DL149`）**未测**（本柱无账本事件）。
15. **触发器 owner / 权限面（`pg_trigger` 之外的 ACL、`SECURITY DEFINER`）未测** —— 只核了 `tgenabled`；谓词函数的调用权限未测。

---

## §7 判负自证（尺子会响 + 逐字节回绿）+ 夹具缺陷留痕

### §7.1 判负自证读数（`run-04-…-falsify.json`）
| 步骤 | 手法 | 实测 | 判定 |
|---|---|---|---|
| 破件（scratch 副本） | 删 `CREATE TRIGGER trg_currency_status_log_append_only …` 块 | 主件 sha `0aaba855…1fcd`（31026 B）vs 破件 `00840de6…4aa56`（30891 B）⇒ `differs=true` | ✅ 改动只落 scratch |
| GREEN（破坏前） | `UPDATE` | `P0001` `… UPDATE forbidden (log_id=10)` | ✅ 尺子正常 |
| RED（去触发器后，同事务） | `DROP TRIGGER` → `UPDATE` | `rejected=false, rowCount=1` ⇒ **用例必红** | ✅ |
| RESTORE | `ROLLBACK TO SAVEPOINT` → `UPDATE` | 又被拒 `P0001` | ✅ 逐字节回绿 |
| 触发器终态 | `SELECT tgenabled` | `O` | ✅ 无残留 DISABLE/DROP |
| 主工作区文件 | sha 前后 | `sha_before == sha_after == 0aaba855…1fcd` ⇒ `sha_main_equal=true` | ✅ 主件未被碰 |
| 冲突行核查（恢复前） | 4 项非本命名空间计数 | 全 `0`；`currency_status_log_total=0`；`neng_users=0` | ✅ **一致，无立停条件** |

### §7.2 我自己的探针缺陷留痕（纪律①）
- **run-01**：`contract` FAIL — 探针误用 `schema_migration.filename`（实为 `name`）⇒ 已改正。
- **run-02 / run-03**：夹具 `users.evm='neng17:fixture'` 被既有 `users_evm_fmt` CHECK（`evm ~ '^0x[0-9a-f]{40}$'`）拒（`23514`）；且**期望失败语句后未设 SAVEPOINT** ⇒ 事务进入 `25P02`（aborted）污染后续用例。**根因 = 探针设计缺陷，非交付件缺陷**。⇒ 改正：① evm 用 `0x`+uid 补齐 40 hex；② 每条期望失败语句前 `SAVEPOINT`、捕获后 `ROLLBACK TO SAVEPOINT`。
- **run-04 = 最终有效 run**（8/8 phase OK）；run-02/03 读数**已弃用**（保留在盘上作留痕，报告不引用）。
- **诚实声明**：`users_evm_fmt` / `users_uid_positive` 是**既有 DB 约束**（不在 `0001`–`0017` 任一迁移文件里），非本柱产物；它间接证明本柱夹具受既有约束保护。

---

## §8 迁移与冻结面（`DL142` / `DL47`）

| 项 | 实测 | 判定 |
|---|---|---|
| `npx ts-node --transpile-only scripts/migrate.ts` | `MIGRATE_EXIT=0`；`"ok": true`；**17 行全 `action:"skipped"`（reason: already applied, checksum match）`；`public_base_table_count=21` | ✅ |
| registry `checksum` vs 现文件 sha256 | 相等（`0aaba855…1fcd`） | ✅ |
| `git status --porcelain` | **空**（无未跟踪/已改） | ✅ |
| `git diff --stat` | **空** | ✅ |
| `0001`–`0016` / `backend-ts/src/**` / `frontend/**` / `docs/*.spec.md` / `docs/versions/**` / `docs/seafood.master-plan.md` | `git diff --name-only` **全空** | ✅ 零改动 |
| 四编排函数指纹 | 见 §1-M3，**逐字节未变** | ✅ |
| `users` 表 | 6 列（含 `is_admin`），**未 ALTER** | ✅ |
| `candle_view` | 未变（未测其定义，登记：`NOT_MEASURED`，本柱不涉） | — |

---

## §9 上游三条预登记张力 —— 我的独立判断

**依据：`docs/audit/p3-platform-0017.md` §6（我现读 202 行）逐条独立复核。**

| 张力 | 上游处置 | **我的判断** | 理由 |
|---|---|---|---|
| ① `DL71`（只给列、未提 FK） vs `DL78`（新表 uid 列一律 FK `users(uid)`）⇒ `app_config.updated_by` | 逐列照 `DL71`，**不加 FK**；加反断言 | **成立（有风险但可接受）** | `DL71` 是**逐列 DDL 提案**（比 `DL78` 泛化句更具体，与 §6.6 逐列契约同源）；`updated_by` 语义从属「平台/系统写者」，其 uid 可能不在 `users`。**风险**：无法阻止脏 `updated_by`；可用路由层校验或后续补 FK 收敛。⇒ **建议 Jing 在 spec 明写 `updated_by` 是否算 `DL78` 的「uid 列」**（否则后继实现方会各执一词）。**成立。** |
| ② `DL75` 三件套（`create_key` + `ledger_event_keys` + `time_created`/`time_updated`） vs §6.6 逐列契约（6 表均未列 `create_key`/`ledger_event_keys`） | 与 `0016` 缺口 E 同口径：**逐列契约优先 + 反断言 + 登记** | **成立（我赞成此口径，但 spec 必须澄清）** | 逐列契约是**显式列清单**，`DL75` 是**通用规约**；两者冲突时显式优先，且本柱**无账本事件**（`DL75②` `ledger_event_keys` 无落点）、`create_key` 对配置/引用表无幂等语义（`DL99` 亦指「业务表」）。反断言保证「未列的列不存在」，防止实现方私自扩列。**但**：`DL75` 标注为「**必建项**」（C8 裁定），若基线要求全覆盖，则 §6.6 需显式豁免这 6 张表。⇒ **建议 Jing 在 §6.7 或 §6.6 加豁免句**。**成立。** |
| ③ `DL76` 可变/不可变清单未列 `app_config` / `admin_*` ⇒ 守卫归属（DELETE 允许 / PK 不可变） | `currency_status_log` append-only；`app_config`/`admin_*` 可变、DELETE 允许、PK 列不可变 | **成立** | `DL76` 明列 `currency_status_log` 为 append-only（本柱已实现）；`app_config`/`admin_*`**不在** 不可变清单 ⇒ 默认可变，且 `DL79` 的禁 DELETE 限定「**业务行**」（配置/引用表非业务行）。PK 列不可变 + `time_updated` 刷新符合 `DL75③`/`R5`。**风险低**：`app_config` 若被误清空可重插，但费率真源本就在 `commission_policy`（`DL71` 明示），`app_config` 非资金真值 ⇒ 可接受。**成立。** |

**另**：上游 §5.1 自曝的「探针 `rows.length` 断言缺陷，改 `rowCount`」我**独立复现了同类陷阱**（见 §7.2 `25P02`）——属探针层缺陷，**不影响交付件判定**。我已在探针中用 `tryExec`（`SAVEPOINT` 隔离）根治。

---

## §10 库侧副作用登记

- **迁移对象本身（交付物）**：`public.app_config` / `admin_role` / `admin_permission` / `admin_role_permission` / `admin_user_role` / `currency_status_log` + 3 守卫函数 + 7 触发器 + `schema_migration` 第 17 行。
- **本次质检夹具残留 = 0（现取 `run-04-…-residual.json`）**：`neng_admin_user_role=0 / neng_admin_role=0 / neng_app_config=0 / neng_csl=0 / neng_users=0`；全库非 `O` 触发器 = `0`。所有 DML/DDL 在**单一事务内并整体 `ROLLBACK`**（含 `DROP TRIGGER`、`DISABLE TRIGGER USER`）。
- **未动**：既有 15 张基表结构与数据（含 `users`、`currency` —— `currency.status` 仅 `GROUP BY` 只读）；`ledger_post_event` 与三编排函数；`candle_view`。
- **禁写面零改动**：`git status --porcelain` 空；`backend-ts/**`、`migrations/**`、`frontend/**`、`docs/audit/**`、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/p3-00{13,14,15,16}-*.md` 全未被碰。
- **无** `commit` / `git add` / `push`；**无**常驻 server；**无** `pkill` / `killall`；**无** `DROP TABLE` / `TRUNCATE` / `ALTER` 既有表（仅事务内 `DROP TRIGGER` + `DISABLE TRIGGER USER`，均 `ROLLBACK`）。

---

## §11 盘上产物（run-tagged）

scratch 目录 `/Users/kevin/.hermes/profiles/zang/cache/scratch/p3-0017-review/`：
- 探针：`neng17-probe-run04.js`（最终有效，19.8 KB）、`neng17-probe-run01.js`（中间版，留痕）
- 读数：`run-04-20260928T131329Z-{contract,truth-table,currency-log,appconfig,fk-delete,falsify,directed,residual}.json`
- 日志：`run04.log`（8/8 OK）、`run-04-migrate.log`（17 skipped / exit 0）
- 破件：`runs/run-04-20260928T131329Z-broken-0017.sql`（30891 B）
- 弃用留痕：`run-02-*` / `run-03-*`（夹具缺陷，见 §7.2）
- 本报告：`docs/qa/p3-0017-platform-review.md`
