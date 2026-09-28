# P3 平台配置柱 `0017_platform_config.sql` — 交付与应用报告（Kong）

> **状态**：✅ 完成（5 项全交）
> **作者**：Kong（实现方）· **单号**：`0017_platform_config.sql` · **2026-09-28**
> **权威口径**：`docs/data-layer.spec.md` **v0.5**（md5 `ed8e2a1f19c86b39db880533ee1cbae8`，开工时现取，与 brief 逐字一致）§6.6（`DL71`/`DL72`/`DL73`）+ §6.1 编号表 `0017` 行 + §6.7（`DL74`–`DL80`）+ §7.2 + §8（`DL93`–`DL100`）+ `DL20`/`DL46`–`DL48`/`DL138`/`DL151`；`docs/ledger.spec.md` v0.12：`R29`/`R75`/`R79`/`R103`。
> 库：Neon（PG 18.6）；驱动 `@neondatabase/serverless` + `ws`；**所有 SQL 显式限定 `public.`**（`DL151`）。迁移入口：`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts`。
> **读数口径（纪律②）**：行数/字节/sha256 一律**现取**；增删行数用 `git diff --numstat`（**含空白行**）；未跑到的字段一律 `NOT_MEASURED`，**不填 0 / 空数组占位**。**run tag** = `20260928T111727Z`（artifact 文件名内嵌，同名拒写）。

---

## §0 逐项判定表（5 项）

| # | 项 | status | 头号读数 |
|---|---|---|---|
| 1 | `backend-ts/migrations/0017_platform_config.sql` 新建 + apply-time 自检 | ✅ DONE | 454 行 / **31026 B** / sha256 `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd`；apply-time 自检 30+ 断言全过 |
| 2 | 应用（干净 + 二次 skipped） | ✅ DONE | apply `exit 0`（`0017` **applied**，1592 ms）；rerun **17/17 `skipped`**、`exit 0`；`schema_version=0017` |
| 3 | 只读探针 `p3p-*` + run-tagged 读数 | ✅ DONE | `scripts/p3p-{lib,00-state,01-post,02-cases,03-falsify}.ts`；`.p3p-artifacts/` **5 份 + 1 scratch 目录** |
| 4 | 行为用例（≥6，实交 **24 条**）+ 判负自证 | ✅ DONE | 用例 **29/29 PASS**（含 5 条夹具/收尾）；判负自证 **14/14 PASS**（GREEN→RED→RESTORE） |
| 5 | 本报告 | ✅ DONE | `docs/audit/p3-platform-0017.md` |
| ★ | 受限小项（三处更正/登记注） | ✅ DONE | `git diff --numstat`：`p3-listing-0015.md` **11 / 0**；`p3-market-0016.md` **8 / 0**（均含空白行；**只增不删**） |

---

## §1 交付物清单（现取）

| # | 产物 | 现状 | 状态 |
|---|---|---|---|
| 1 | `backend-ts/migrations/0017_platform_config.sql` | 454 行 / 31026 B / sha256 `0aaba855…1fcd` | ✅ |
| 2 | 应用 | `schema_version=**0017**` / registry **17 行** / 基表 **15 → 21** | ✅ |
| 3 | 探针 + 读数 | `.p3p-artifacts/`：`-state-pre.json`、`-post-fingerprint.json`、`-cases.json`、`-falsify.json`、`-ledger_post_event.prosrc.sql`（51429 B）+ `scratch-20260928T111727Z/` | ✅ |
| 4 | 行为用例 / 判负自证 | 用例 29/29；自证 14/14 | ✅ |
| 5 | 本报告 | `docs/audit/p3-platform-0017.md` | ✅ |
| ★ | 受限小项 | 见 §9 | ✅ |

---

## §2 迁移前基线（现取；artifact `.p3p-artifacts/p3p-20260928T111727Z-state-pre.json`）

| 项 | 读数 | 与 brief 真值 |
|---|---|---|
| `schema_version` | **0016** | 一致 |
| `schema_migration` 行数 | **16** | 一致 |
| `public` 基表数 | **15**（`account, commission_policy, currency, job, job_application, job_submission, ledger_entry, ledger_owner, listing, listing_order, market_order, market_trade, referral, schema_migration, users`） | 一致 |
| `public` 视图 | `candle_view`（1） | 一致 |
| 6 张新表存在性 | `app_config`/`admin_role`/`admin_permission`/`admin_role_permission`/`admin_user_role`/`currency_status_log` **全 `false`** | 一致（纯新建） |
| `referral` / `commission_policy` | 均 **`true`** | 一致 |
| `ledger_post_event` 指纹 | **51429 B / md5 `d94dd902697dfe60aba409d808c6d63a`** | 一致（`DL142` 基准） |
| 三编排函数指纹 | `job_post_event` 13594/`0cedbb9ea60dcbda28e3ef3dafdd119b`；`listing_post_event` 17858/`0e187c20b56d45202d83978c8a02b31d`；`market_post_event` 30194/`74841611252726e1cc0f57cb46ea6c6d` | 现取（作自检基准） |
| `users` 列（6） | `uid`/`evm`/`bio`/`is_admin boolean NOT NULL DEFAULT false`/`time_reg`/`time_login_last` | 一致（`DL72` 总开关**已存在** ⇒ 本单**不改 `users`**） |
| append-only 先例 | `trg_referral_append_only`/`trg_commission_policy_append_only`/`trg_ledger_entry_append_only` 均 `tgenabled=O` | 一致 |

---

## §3 迁移后指纹（现取；artifact `…-post-fingerprint.json`）

| 项 | 迁移前 | 迁移后 |
|---|---|---|
| `schema_version` | 0016 | **0017** |
| `schema_migration` 行数 | 16 | **17**（第 17 行 = `0017` / `0017_platform_config.sql` / checksum `0aaba855b1d5eb4c69b6b2c880b225df2053af7353f7c7b290f233006cbb1fcd` / applied_at `2026-09-28 11:18:43.757394+00`） |
| `public` 基表数 | 15 | **21**（+6：`app_config` / `admin_role` / `admin_permission` / `admin_role_permission` / `admin_user_role` / `currency_status_log`） |
| `public` 视图 | `candle_view` | `candle_view`（**未变**） |
| `ledger_post_event` | 51429 B / `d94dd902…` | **51429 B / `d94dd902…`（未变）** |
| 三编排函数 | 见 §2 | **逐字节未变**（同上 md5/字节） |
| **registry.checksum == 文件 sha256** | — | ✅ `0aaba855b1d5eb4c…` **零漂移** |

**迁移前 → 后**：表数 **15 → 21**；`ledger_post_event` 字节数 + md5 **未变**（`DL142`）；`candle_view` 未变；无既有表被 `ALTER`/`DROP`/`TRUNCATE`。

---

## §4 逐列契约对拍（§6.6 / `DL71`–`DL73`）

**6 张新表逐列（现取，迁移后）**：

| 表 | 列（序） | PK | CHECK/约束 | FK | 索引 | 触发器（`tgenabled`） |
|---|---|---|---|---|---|---|
| `app_config` | `key`(text) / `value`(jsonb NOT NULL) / `updated_by`(bigint NOT NULL) / `time_updated`(timestamptz NOT NULL DEFAULT now()) | `app_config_pk(key)` | `app_config_value_is_container` = `CHECK (jsonb_typeof(value) IN ('object','array'))` | **0**（张力①） | `app_config_pk`（唯一） | `trg_app_config_key_immutable` `O` / `trg_app_config_touch_updated` `O` |
| `admin_role` | `role_key`(text PK) / `name`(text 可空) / `time_created`(timestamptz NOT NULL DEFAULT now()) | `admin_role_pk(role_key)` | — | 0 | `admin_role_pk` | `trg_admin_role_key_immutable` `O` |
| `admin_permission` | `permission_key`(text PK) / `name`(text 可空) | `admin_permission_pk(permission_key)` | — | 0 | `admin_permission_pk` | `trg_admin_permission_key_immutable` `O` |
| `admin_role_permission` | `role_key`(text NOT NULL) / `permission_key`(text NOT NULL) | `…_pk(role_key,permission_key)` | — | → `admin_role(role_key)`、→ `admin_permission(permission_key)` ×2 | `admin_role_permission_pk` | `trg_admin_role_permission_key_immutable` `O` |
| `admin_user_role` | `uid`(bigint NOT NULL) / `role_key`(text NOT NULL) | `admin_user_role_pk(uid,role_key)` | — | → `users(uid)`、→ `admin_role(role_key)` ×2 | `admin_user_role_pk` | `trg_admin_user_role_key_immutable` `O` |
| `currency_status_log` | `log_id`(bigint IDENTITY PK) / `cid`(bigint NOT NULL) / `from_status`(text NOT NULL) / `to_status`(text NOT NULL) / `actor_uid`(bigint NOT NULL) / `memo`(text 可空) / `time_created`(timestamptz NOT NULL DEFAULT now()) | `currency_status_log_pk(log_id)` | — | → `currency(cid)`、→ `users(uid)` ×2 | `currency_status_log_pk` | `trg_currency_status_log_append_only` `O`（`BEFORE UPDATE OR DELETE`） |

**汇总对拍（逐条与 §6.6 断言）**：
- 列数：4 / 3 / 2 / 2 / 2 / 7 —— 与 `DL71`/`DL72`/`DL73` 逐列清单**一致**（§6.6 未列的 `create_key`/`ledger_event_keys`/`time_updated` **反断言为不存在**，见 §6 张力②）。
- **`app_config` 无 `privacy` 列** ✅（反断言）。
- PK ×6、**FK 总数 = 6**（→`users` ×2 / →`currency` ×1 / →`admin_role` ×2 / →`admin_permission` ×1）、**`app_config` FK = 0**（张力①）、**对 `ledger_entry` 的 FK = 0**（`R21`/`DL78`）。
- 自有索引**恰好 6**（全为 PK 自带）；**无额外索引**（`DL74`；§6.6 无索引清单）。
- 触发器 **7 个全 `O`**；`currency_status_log` 的 append-only 触发器 `tgtype & 16 ≠ 0 AND & 8 ≠ 0`（覆盖 UPDATE 与 DELETE，`DL73`）。
- 新函数指纹：`platform_config_key_immutable` 417 B / `42f8a656…`；`platform_config_touch_updated` 54 B / `02cd283c…`；`currency_status_log_append_only` 131 B / `0e5750a7…`。
- **未建任何账本类对象**：自检断言 `ledger_post_event` 与三编排函数指纹**未变**、无 `ledger*` 新表。

---

## §5 行为用例 + 判负自证

### §5.1 行为用例（**29/29 PASS**；artifact `…-cases.json`）
**全程在单一事务内并整体 `ROLLBACK` ⇒ 库侧零残留**（见 §8）。夹具：uid `990701–990704`（窗口 `9907xx`）、角色键前缀 `p3p:`、配置键前缀 `cli:kong17-`（**未复用** 9903xx/9904xx/9905xx/9906xx）。

| 组 | 用例 | 期望 | 实测原始读数 | 判定 |
|---|---|---|---|---|
| 权限单一真源 | C1 `is_admin=true` 且无角色行 | 可进 | `can_access_admin = true`（uid 990701） | ✅ |
| | C2 `is_admin=false` 但有角色行 | 可进 | `can_access_admin = true`（uid 990702，`admin_user_role` 有 `p3p:ops`） | ✅ |
| | C3 两者皆无 | 不可进 | `can_access_admin = false`（uid 990703） | ✅ |
| `currency_status_log` | C4 合法 INSERT | 成功（对照，尺子不滥杀） | `rejected=false,rowCount=1`（log_id 返回） | ✅ |
| | C5 `UPDATE` | 必拒 | `P0001` `currency_status_log is append-only: UPDATE forbidden (log_id=4)` | ✅ |
| | C6 `DELETE` | 必拒 | `P0001` `… DELETE forbidden (log_id=4)` | ✅ |
| `app_config` | C7 合法 object 值 INSERT | 成功 | `rejected=false,rowCount=1` | ✅ |
| | C8 `key` 重复 | `23505` | `23505` `duplicate key value violates unique constraint "app_config_pk"` | ✅ |
| | C9 `value` 非 jsonb | 拒 | `22P02` `invalid input syntax for type json` | ✅ |
| | C10 `value` NULL | 拒 | `23502` `null value in column "value" … not-null constraint` | ✅ |
| | C11 裸标量余额值（`'128'::jsonb`） | 拒（`DL3` 禁存余额） | `23514` `… violates check constraint "app_config_value_is_container"` | ✅ |
| 守卫矩阵 | C12 `app_config.key` 改 | 拒 | `P0001` `immutable key column: public.app_config.key cannot change (cli:kong17-demo -> cli:kong17-renamed)` | ✅ |
| | C13 非键列 `value` 改 | 成功 | `rejected=false,rowCount=1` | ✅ |
| | C14 `admin_role.role_key` 改 | 拒 | `P0001` `… public.admin_role.role_key cannot change (p3p:ops -> p3p:renamed)` | ✅ |
| | C15 `admin_permission.permission_key` 改 | 拒 | `P0001` `… public.admin_permission.permission_key cannot change` | ✅ |
| | C16 `admin_role_permission` PK 对改 | 拒 | `P0001` `… public.admin_role_permission.role_key cannot change` | ✅ |
| | C17 `admin_user_role` PK 对改 | 拒 | `P0001` `… public.admin_user_role.role_key cannot change` | ✅ |
| | C18 `admin_user_role` DELETE | 允许（撤销分配） | `rejected=false,rowCount=1` | ✅ |
| 边界 | C19 `cid=999999` | `23503` | `23503` `… violates foreign key constraint "currency_status_log_cid_fk"` | ✅ |
| | C20 指向不存在角色 | `23503` | `23503` `… "admin_role_permission_role_fk"` | ✅ |
| | C21 `uid=999999` | `23503` | `23503` `… "admin_user_role_uid_fk"` | ✅ |
| | C22 `admin_role` 重复 PK | `23505` | `23505` `… "admin_role_pk"` | ✅ |
| | C23 `admin_role_permission` 重复 PK 对 | `23505` | `23505` `… "admin_role_permission_pk"` | ✅ |
| | C24 空 `name`（`""`） | 逐列照 spec（`name` 可空）⇒ 允许 | `rejected=false`（**登记为数据质量项**，见 §7） | ✅ |

> **口径（权限单一真源，数据层可验证、不自创接口）**：
> `SELECT (u.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid)) AS can_access_admin FROM public.users u WHERE u.uid = :uid;`
> 三态（C1/C2/C3）逐条实测。本迁移**未** `CREATE FUNCTION`（遵 brief「不得自创接口」）。

> **自曝一处探针自身缺陷（纪律①④）**：首跑 C7/C13/C18 与 A-RED/B-RED 报 FAIL —— 根因 = 我的断言用了 `rows.length`，而**无 `RETURNING` 的 DML 该值恒为 0**（其 `rejected=false` 已证明语句成功）。已把断言改为 `rowCount`（`p3p-lib.rawRes`），复跑后 5 项全绿。属**探针断言口径缺陷**，非交付件缺陷；改正留痕见 artifact（同名拒写 ⇒ 旧文件已删除后重写）。

### §5.2 判负自证（**14/14 PASS**；artifact `…-falsify.json`）
手法 = ① 在 **scratch 副本**里删掉结构性保证的创建块（证明改动**只落 scratch**）；② 真库侧**同一事务内** `DROP TRIGGER → 跑用例（绿变红）→ ROLLBACK TO SAVEPOINT`（触发器逐字节恢复）。

| 场景 | 步骤 | 实测 | 判定 |
|---|---|---|---|
| scratch 破件 | N1/N2 两破件与原件 sha256 **不同**（各删一处）；N3 两破件互不同 | `shaA=0aaba855…`；`shaB1` / `shaB2` 各异 | ✅ |
| A（append-only） | A-GREEN 破坏前 UPDATE | `P0001` `… UPDATE forbidden (log_id=3)`（尺子正常） | ✅ |
| | A-RED 去触发器后 UPDATE | `rejected=false,rowCount=1`（**UPDATE 成功 ⇒ 用例必红**） | ✅ |
| | A-RESTORE 回滚触发器后 UPDATE | 又被拒 `P0001`（**逐字节回绿**） | ✅ |
| B（key 不可变） | B-GREEN 破坏前改 `app_config.key` | `P0001` `immutable key column…` | ✅ |
| | B-RED 去触发器后改 key | `rejected=false,rowCount=1`（**改 key 成功 ⇒ 用例必红**） | ✅ |
| | B-RESTORE 回滚后改 key | 又被拒 `P0001`（**逐字节回绿**） | ✅ |
| 收尾 | N4 本柱触发器全 `O`（无残留 DISABLE/DROP） | `non_enabled=0` | ✅ |
| | N5 主工作区迁移文件 sha256 **前后相等** | `before == after == 0aaba855…` | ✅ |
| | N6 冲突行全属本单命名空间（`foreign_rows_present=[]`） | `all_empty=true`（4 项计数全 `0`） | ✅ |
| | N7/N8 回滚后 `currency_status_log` / `app_config` 无本单夹具行 | 均 `0` | ✅ |

---

## §6 已登记张力 / 缺口 / 工程口径（**不发明、不静默跳过**）

1. **张力① `DL71`（只给列、未提 FK） vs `DL78`（新表 uid 列一律 FK `users(uid)`）** ⇒ `app_config.updated_by` 是否算「uid 列」有歧义。**处置 = 逐列照 `DL71` 先落、不加 FK**（依据：平台/系统写者的 uid 可能不在 `users`；`DL78` 是泛化句）。apply-time **反断言**：`app_config` FK 数 = 0。**⇒ 留 Zang 裁定。**
2. **张力② `DL75` 三件套（`create_key` + `ledger_event_keys` + `time_created`/`time_updated`） vs §6.6 逐列契约**（6 表列清单均未列 `create_key`/`ledger_event_keys`）⇒ 与 `0016` 缺口 E **同口径**：**逐列契约优先**，**加 apply-time 反断言**（上表 18 组合）并在本报告登记。**⇒ 待 Jing 在 spec 澄清。**
3. **张力③ `DL76` 的可变/不可变清单未列 `app_config` / `admin_*`** ⇒ 本迁移工程口径（**依据 = 表用途 + `DL79` 文义**）：
   - `currency_status_log` = **append-only**（`DL73`/`DL76` 明列）—— **不**把后台配置表建成 append-only（遵 brief）。
   - `app_config` = **可变配置表**（非 append-only）：PK `key` 不可变 + `time_updated` 自动刷新；DELETE **允许**（`DL71` 的「不得删键」是**存量费率键的数据迁移纪律**，非全表 DELETE 禁令）。
   - `admin_*` = **可变引用表**：PK 列不可变 + DELETE **允许**（撤销角色/权限分配是合法业务操作；`DL79` 的禁 DELETE 针对**业务行**）。
   - **禁 DELETE 的守卫**落在 `currency_status_log`（C6 实测拒），满足 brief「DELETE 业务行（`DL79`）必拒」。
4. **缺口④ §6.6 未列索引清单** ⇒ 逐字照办：**只**建约束自带索引（PK ×6），**不擅自增**（`DL74`）。`currency_status_log` 的 FK 列（`cid`/`actor_uid`）与审计读口**无索引** ⇒ 登记缺点（合规读口建议 `(cid, time_created)`，但 §6.6 无清单 ⇒ 本迁不增）。
5. **工程口径⑤（类型细目）**：`DL72`/`DL73` 把 `time_created` 写作裸列 ⇒ 本迁移按全库通例落 `timestamptz NOT NULL DEFAULT now()`（`DL75③`/`R5`）；`from_status`/`to_status`/`cid`/`actor_uid`/`log_id` 落 NOT NULL；`name`/`memo` 保持 spec 字面的**可空文本**（C24 实测 `""` 被接受，登记数据质量项）。
6. **`DL3` 禁存余额的实现口径**：`CHECK (jsonb_typeof(value) IN ('object','array'))` —— 拒**裸标量**（数字/字符串/bool/null）（C11 实测 `23514`）。**诚实边界**：对象内嵌数字仍可绕过 ⇒ **护栏非证明**；余额真值仍在 `account.balance`（`DL2`/`DL3`）。
7. **`DL138`「重建」措辞**：本库 9 张懒表已于 `D19` `DROP`、**无旧表可比对** ⇒ 本迁移是**纯新建**（非「改表现」），逐列新建即可。

---

## §7 未验证清单（枚举到边界）

1. **路由层未接** —— 本单**不接路由**（`src/**` 未改，遵硬边界）。`GET /api/admin/settings`（#35）/`GET /api/admin/permissions`（#38）与 `POST /api/admin/currency/:cid/status` 的**端到端行为**（借码/HTTP 状态/`ops:<uid>:currency_status:<cid>:<to_status>` 键）**未测**。
2. **`currency_status_log` 与真实币种状态机的联动未测** —— 本迁移只建表 + append-only；`from_status`/`to_status` 的取值面（是否受 `R28` 状态机约束）**未加 CHECK**（§6.6/`DL73` 未列白名单）⇒ **未验证**（登记缺口 ④ 同族）。
3. **`can_access_admin` 的 API 侧收敛未测** —— 旧 `permission_group`/`isAdminAddress` 双源的**代码层收敛**属路由单，`src/**` 未改 ⇒ 未验证。
4. **`app_config` 费率键的存量语义未测** —— 本库**无历史费率键**（表为新建、空）⇒ `DL71` 的「保留并标注不参与计费」**无对象可核**（N/A）。
5. **`app_config.updated_by` FK 边界** —— 张力①未裁前按 `DL71` 无 FK；「平台 uid 不在 `users` 时仍可写」**仅由 CHECK/无 FK 推断**，未做跨层验证。
6. **并发/串行化未测** —— 6 张表均无 `pg_advisory_xact_lock` 类需求（非撮合/非资金）；连并发 INSERT 同键的竞态**未测**（`app_config`/`admin_*` 的 PK 唯一约束在 DB 层兜底，未做并发探针）。
7. **`name`/`memo` 空串的数据质量** —— C24 实测 `""` 被接受（逐列照 spec 的可空文本）；**业务约束未加** ⇒ 依赖路由层校验（未验证）。
8. **护栏旁路** —— `TRUNCATE` / `DISABLE TRIGGER USER` 可绕 append-only 与 PK 不可变（同 `DL65`/commission.spec §2.2 诚实边界）；**未做**超管旁路探针。
9. **未做的边界项**（明确枚举）：`value` 为**数组**（`[]`）的合法性未单测（CHECK 允许，逻辑同 object）；`admin_role_permission` 的 DELETE 允许性未单测（口径同 C18，未逐条）；跨 schema 裸表名的 **`DL151` 静态扫描**（`src/**` 未改故不适用）。

---

## §8 库侧副作用登记

- **迁移对象本身**（交付物）：`public.app_config`、`public.admin_role`、`public.admin_permission`、`public.admin_role_permission`、`public.admin_user_role`、`public.currency_status_log` + 3 个守卫函数 + 7 个触发器 + `schema_migration` 第 17 行。
- **探针夹具残留 = 0**：`p3p-02` 与 `p3p-03` 的**全部** DML/DDL 在**单一事务内并整体 `ROLLBACK`**；收尾现取 `foreign_rows = {admin_user_role:0, admin_role:0, app_config:0, currency_status_log:0}`（`all_empty=true`）、`currency_status_log`/`app_config` 无本单夹具行。**故无「无法删除的 append-only 残留」**。
- **未动**：既有 15 张基表的结构与数据；`users` 表（`DL72` 总开关沿用）；`ledger_post_event` 与三编排函数（指纹未变）；`candle_view`。
- **禁写面零改动**（`git status --porcelain` 现取）：仅 `M docs/audit/p3-listing-0015.md`、`M docs/audit/p3-market-0016.md`（受限小项）+ 新增 `0017_platform_config.sql`、`scripts/p3p-*.ts`、`.p3p-artifacts/`、本报告。**`migrations/0001`–`0016`、`src/**`、`frontend/**`、`docs/*.spec.md`、`docs/qa/**` 零改动。**
- **无 `commit` / `git add` / `push`；无常驻 server；无 `pkill`/`killall`；无 `DROP`/`TRUNCATE`/`ALTER` 既有表。**

---

## §9 受限小项（三处更正/登记注；**原文逐字保留，只增不删**）

| 文件 | 内容 | `git diff --numstat`（含空白行） |
|---|---|---|
| `docs/audit/p3-market-0016.md` | **`C1` 更正注**（`TAKER_NOT_A_PARTY` 覆盖表述作废：探针 `p3m-02-cases.ts` L387 `SpareIds.spareId` 硬编码 `'0'` ⇒ 函数 L697–701 闸零用例触达；补测读数引用）+ **`C2` 登记注**（裸 `UPDATE amount_filled` 与账户 `frozen` 的 **20** 对账缺口；排除后判据 5 `390 == 390`；护栏边界不重修） | **8 / 0** |
| `docs/audit/p3-listing-0015.md` | **同族三处假命题更正注**（§0 表行 / 时间线行 / 「为什么」行——「任何成功退款抛 `55000`」均指向 §2b 唯一有效口径；已被字节级 v2 体证伪） | **11 / 0** |

---

## §10 结论

`0017_platform_config.sql` = **纯新增 6 表 + 3 函数 + 7 触发器**，逐列照 §6.6（`DL71`/`DL72`/`DL73`）；**干净应用**（`exit 0`）后 **17/17 `skipped`**、`schema_version=0017`、基表 **15 → 21**、`ledger_post_event` 指纹**未变**；**行为用例 29/29** + **判负自证 14/14**；三处张力已登记待裁。**盘上产物 = 唯一主交付。**
