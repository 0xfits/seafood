# 8⑥ 审计台 · 统一读口（`p8-s6-audit-console`）

> **单性质**：批 8 第 6 片（8⑥）**审计台**（非规范单）· 作者角色 = **Kong（实现 · 工匠）**。
> **本报告覆盖**：8⑥ **全片** = 后端统一读口（`GET /api/admin/audit/:table`）+ 前端 `AuditConsolePage` + 四语文案 +
> 类级门 `p8-s11` + **判负收尾（回填点）**。首版 = **实现第一步**（原对锚 `ccf722c`）。
> **权威口径**：`docs/route-layer.spec.md` **v2.21 §32**（13+ 子节 + **§32.14 终审裁定落位表**）
> + `docs/data-layer.spec.md` **v0.28 §35**。**凡与裁定冲突处，一律以 §32.14 逐字为准**。
> **本单边界**：**不 apply 迁移**（Zang 统一 apply）· **不改 `docs/*.spec.md` / `docs/seafood.master-plan.md` / `docs/qa/**`** ·
> **零新增错误码**（闭集 **33 不动**）· **只读**（不动任何 `append-only` 面）· **不 commit / 不 push** ·
> 库面写**一律事务内 + 末尾 `ROLLBACK`** · 探针**不入 `backend-ts/scripts/`**（落 `backend-ts/.p8s6-impl/`）。
> **对锚**：开工 = **`a2cdb04`**（8⑥ 续跑 · 门 `p8-s11` 带实例 87/87）；回填时 `git log -1` = **`d212e80`**（并行单 **doc-only**：`docs/seafood.master-plan.md` **+26/−0**）——HEAD 中途前推，**本单产文件不受其影响**。
> **产出计数 · 后端**：新增 **3**（`0039` 迁移 + `audit-console.ts` + `points-adjust-reasons.ts`）；改动 **4**
> （`database.ts` +15/−0 · `index.ts` +42/−0 · `admin-utils.js` +1/−0 · `p8-s2-fee-rebate-gate.ts` +22/−2）。
> **产出计数 · 前端 / 门**：新增 `frontend/src/pages/admin/AuditConsolePage.jsx` + 路由 `dashboard/audit-console`（`App.jsx`）
> + `adminNav.auditConsole*`（`AdminLayout.jsx`）+ 四语 `auditConsole` 命名空间（`locales/*.json`）+ 类级门
> `scripts/p8-s11-audit-console-gate.ts` + i18n 单测订正（`i18n-batch-b4a/b4b/b5`）。

---

## 0. 执行摘要（先说结论）

| # | 项 | 结论 | 证据 |
|--:|---|---|---|
| ① | **迁移 `0039_admin_audit_console.sql`** | ✅ 已建（纯 DML 种子 · **闭集 11 → 12** · 自带 12 自检）· `R-9-24` 真跑自证**四项读数全 `true`** | §1 / §2 |
| ② | **统一读口 `GET /api/admin/audit/:table`** | ✅ 已实现（14 面白名单闭集 · 非白名单 `400` · 五类过滤**逐表显式映射** · keyset 分页 50/100 · 鉴权 `manage_audit` · 零新增码 · `R107`）| §3 / §4 / §5 |
| ③ | **原因码常量集（`R-9-76`）** | ✅ 已落（`POINTS_ADJUST_REASONS` 恰 7 值 · 语义域非错误码 · 历史 4 行不回填）· C3 四条件①②④现取可证、③本单落 | §6 |
| ④ | **报告** | ✅ 本文件（占位归零） | 全文 |
| — | **注册点** | **`87 → 88`**（`get 36 → 37` · `+1`；`post 48 / put 0 / patch 1 / delete 2` 未动）· 门 `p8-s2` 已前推并**复绿 44/44** | §3.4 / §7 |
| — | **`tsc`** | `tsc -p tsconfig.json --noEmit` = **0** | §7 |
| ⑤ | **前端 `AuditConsolePage` + 路由 + 四语** | ✅ 已建（14 面切换 · 五类过滤 · keyset 分页 · 只读；`ProtectedRoute requiredPermission="manage_audit"`）· 门 `W4/W5/W6` 绿 | §7 / §9 |
| ⑥ | **类级门 `p8-s11`** | ✅ **带受控实例 87/87**（`db=6 http=6`）；静态面 A–J · W · L **全绿**（含 21 项自证负对照 · id 后缀 `selftest`） | §7.1 |
| ⑦ | **判负（JN）收尾** | ✅ **4 处**（去白名单 / 去「不适用参数」闸 / 去枚举原因码闸 / 去 `manage_audit` 鉴权）逐处转红 · 复原回绿 · 主仓零写入 | §11 |

---

## 1. 迁移结构面（`0039_admin_audit_console.sql` · **不 apply**）

**文件指纹**：`wc -l` = **155**（内容 156 行 · 末行无尾换行）· **9,803 B**（utf8）· `md5` = **`9909252a73ec5801d83a82f631ad9290`**。

| 面 | 内容（逐字 · 依据） |
|---|---|
| **性质** | **纯 DML 种子**（形态**逐字沿** `0022_admin_permission_seed.sql`）· 无 `BEGIN/COMMIT` · 无 `DO/EXECUTE` 动态 DDL · 无 `TRUNCATE/DELETE` |
| **① `admin_permission`** | `INSERT ('manage_audit', '审计台查看') ON CONFLICT DO NOTHING` ⇒ 闭集 **11 → 12**（依据 `R-9-75`） |
| **② `admin_role_permission`** | `INSERT ('super_admin','manage_audit') ON CONFLICT DO NOTHING` ⇒ `super_admin` = 全权限内置角色 ⇒ 新增键**默认同给**（否则「超管看不到审计台」= 语义回归） |
| **结构面** | **零**：不建/改任何表/列/约束/索引/函数/触发器 ⇒ **基表仍 34** |
| **库侧闭集同步面** | **无** —— 现取 `admin_permission.permission_key` **无 CHECK / 无枚举**（仅 `PK` + `NOT NULL` · `0017:103-107`）⇒ 「若库侧有 CHECK/枚举则同步」**条件不成立**；`0039` 自检含该**负断言**（`contype ∈ {c,e}` 计数必须 = 0） |
| **自检（apply-time · 不通过 ⇒ 整迁移回滚）** | ① `admin_permission` = **12**；② `manage_audit` **在场**；③ **旧 11 值逐字未动**；④ 闭集**恰 12**（多键判负）；⑤ `super_admin` = **12** 且含新键；⑥ 无悬挂 FK；⑦ 基表 = **34** 不变；⑧ `permission_key` 无 CHECK/枚举；⑨ 不新增任何 `ledger*` 表 |
| **`0022` 自检覆盖口径** | `0022` apply-time 自检断言 `admin_permission = 11` **在重建链 `0022` 时点运行**（此时确为 11 · 成立）；`0039` 在其**之后**推到 12。**`0022` 文件字节未改**（`0001`–`0038` 一字未动） |
| **只读衔接** | 不碰任何 `append-only` 面；不写 `ledger_entry`/`account`（`§32.10`） |

---

## 2. `R-9-24` 真跑自证 · 四项读数（单事务 `BEGIN;<0039 全文>;ROLLBACK;` · **禁 `COMMIT`**）

> 原始输出：`backend-ts/.p8s6-impl/r9-24-0039-20261003T094444Z.json`
> 探针：`backend-ts/.p8s6-impl/r9-24-0039-realrun.ts`（**不入 `scripts/`**）
> 手法：整迁移文件在**单事务**内真跑（含文件内 `DO` 自检）⇒ 抛哨兵 ⇒ `ROLLBACK`。

| 项 | 读数 |
|---|---|
| 文件 | `migrations/0039_admin_audit_console.sql` · **9,803 B** / 156 行 |
| **① 无错执行** | ✅ **`true`**（`exec_err = null`；文件内 9 项 `DO` 自检全过） |
| **② 回滚后新对象不在** | ✅ **`true`**：`admin_permission` 回 **11**（`has_manage_audit = 0`）；`super_admin` 回 **11**（`super_admin_has_manage_audit = 0`） |
| **③ `schema_migration` 无新行** | ✅ **`true`**：行数 `37 → 37` / `max` `0038 → 0038` |
| **④ 目标对象逐字复原** | ✅ **`true`**：`admin_permission` 键集 md5 `bb965f6c35b1d909abf1562d4c0832d9` 前后全等；`base_tables 34 → 34`；`triggers 54 → 54`；`ap_checks 0 → 0` |
| **事务内后态（关键）** | `post_ap_n = 12` ∧ `post_has_manage_audit = 1` ∧ `post_super_admin_n = 12` ∧ 旧 11 值 `missing = 0` ∧ `new_present = 1` ∧ `post_base_tables = 34` |
| `new_relations_added` | **0**（零新表） |

**只读现取锚（开工点 · `conn-probe.ts`）**：`schema_migration` = **37 / max 0038**；`public` 基表 = **34**；非内部触发器 = **54**；
`admin_permission` = **11**（键集 md5 `bb965f6c35b1d909abf1562d4c0832d9`）；`super_admin` 权限 = **11**；`admin_role_permission` = **15**。

---

## 3. 统一读口设计面（`GET /api/admin/audit/:table`）

### 3.1 落点

| 面 | 落点 | 说明 |
|---|---|---|
| 白名单 + 校验 + SQL 生成 | **`backend-ts/src/audit-console.ts`**（新增 · **314 行** / 15,334 B / md5 `686d84cfbbaf7c538ce1a8d1425f2640`） | 14 面**结构化映射** `AUDIT_TABLES` + `parseAuditRequest` + `buildAuditSql` + `buildAuditView` |
| DB 取数口 | **`DatabaseService.readAuditPage(text, params)`**（`database.ts` 新增 · 静态方法） | **唯一取数口** = `runSql` 执行**由 `buildAuditSql` 生成**的参数化语句（本方法**不自拼** SQL） |
| 路由 | **`src/index.ts:2809`** `app.get('/api/admin/audit/:table', …)` | 闸 = `requireAdmin(req, res, 'manage_audit')` |

### 3.2 「禁拼 SQL 字符串」的落地（`R-9-74`）

- 14 面**逐表映射** = `audit-console.ts` `AUDIT_TABLES` **显式常量表**（列名 = **白名单映射内的字面量**）；
- 请求**只提供值**（`:table` / 过滤值 / `limit` / `cursor`），**绝不进 SQL 标识符位**；`:table` **先查白名单**（miss ⇒ `400`）；
- `buildAuditSql` 的 `text` 中表名 / 列名**一律取自映射**；过滤值**只进 `$n` 参数位**（`::bigint` / `::timestamptz` / 文本）；
- 多列 OR 匹配（如 `target` = `[seller_uid, buyer_uid]`）用同占位符复用，不拼接用户输入。

### 3.3 路径 / 参数 / 响应（`R-9-74`/`R-9-78`/`R-9-79`）

| 面 | 口径 |
|---|---|
| 路径 | **`GET /api/admin/audit/:table`**（`R-9-79` 已批准） |
| 鉴权 | **`manage_audit`**（`R-9-75` 新增键 · 闭集 11 → 12；`requireAdmin` 既有出口） · 读口**不带 `ops:` 幂等键**（读口无副作用） |
| 表名 | **白名单闭集 14 面**（`R-9-74`/`R-9-77`）；**非白名单 ⇒ `400`**（原候选 `404` 作废）；`app_config` **已裁出** |
| 过滤参数（名） | `actor` · `target` · `action` · 时间窗 `from`·`to`（半开 `[from,to)`） · 关联 id `refId` |
| `limit` | **默认 50 / 上限 100**（`>100` ⇒ `400 LIMIT_OUT_OF_RANGE`；`<1` / 非整数亦 `400`） |
| 游标 | **keyset 双键** `(timeColumn DESC, <pk> DESC)` · **不透明**（`base64url(JSON{t,pk})`）；非法 ⇒ `400 CURSOR_INVALID` |
| 不适用参数 | **`400 PARAM_NOT_APPLICABLE`** + `details.supportedFilters`（该表**支持的过滤维度** · 参数名清单）（`R-9-78` 变体 B） |
| `data` 键集 | `{ table, rows[], nextCursor, capabilities }`（§32.7(a) 候选逐字）；`capabilities = { filters, limit }`（=`R-9-78` 认可的能力面加强） |
| 错误形状 | **`R107`** `{ error: { code, message, i18n_key, details } }`（经 `sendVerbError` 出口）· `details` 只放非敏感上下文（`field`/`reason`/`limit`/`supportedFilters`），**不含** SQL / 约束名 / 裸表列名 / 连接串 |
| 错误码 | **零新增** ⇒ 一切 `400` 借既有 **`LEDGER_AMOUNT_INVALID`（`#17`）**（账本闭集 **33 不动**） |
| 只读 | 仅 `SELECT`（§32.10）；不动任何 `append-only` 留痕面；不新造第二写入面 |

### 3.4 注册点（`+1`）

| verb | 现取（改前） | 改后 | 增量 |
|---|---|---|---|
| `get` | 36 | **37** | **+1** |
| `post` / `put` / `patch` / `delete` | 48 / 0 / 1 / 2 | 48 / 0 / 1 / 2 | 0 |
| **合计（口径 = `^app\.(get\|post\|put\|patch\|delete)\(` · 排除注释行 `index.ts:790`）** | **87** | **88** | **+1** |

---

## 4. 逐表过滤映射（14 行 · `actor`/`target`/`action`/时间窗/关联 id · §32.3 逐表落码）

> 映射 = `audit-console.ts` `AUDIT_TABLES`（**结构化白名单**）；列名数组 = **OR 匹配**；「无」= `null` ⇒ **参数不适用 ⇒ `400`**。
> 时间窗列统一参数名 `from`/`to`；关联 id 统一参数名 `refId`（§32.3(b)(c)）。

| # | 表（`public.`） | `actor` | `target` | `action` | 时间列 | `refId`（关联 id） | 排序键（keyset） | 支持维度 |
|--:|---|---|---|---|---|---|---|---|
| 1 | `admin_ops_audit_log` | `actor_uid` | `target_uid` | `action`(恒 `points_adjust`) + `op` + `result` | `time_created` | `cid` | `(time_created DESC, log_id DESC)` | actor,target,action,from,to,refId |
| 2 | `admin_refund_audit_log` | `actor_uid` | `seller_uid`,`buyer_uid` | 无 | `time_created` | `order_id` | `(time_created DESC, log_id DESC)` | actor,target,from,to,refId |
| 3 | `ledger_entry` | 无（`uid`=分录归属人） | 无 | 无 | `time_created` | `ref_id` | `(time_created DESC, txid DESC)` | from,to,refId |
| 4 | `currency_review_log` | `actor_uid` | `cid` | 无 | `time_created` | `cid` | `(time_created DESC, log_id DESC)` | actor,target,from,to,refId |
| 5 | `currency_status_log` | `actor_uid` | `cid` | `from_status`,`to_status` | `time_created` | `cid` | `(time_created DESC, log_id DESC)` | actor,target,action,from,to,refId |
| 6 | `listing_review_log` | `actor_uid` | `listing_id` | 无 | `time_created` | `listing_id` | `(time_created DESC, log_id DESC)` | actor,target,from,to,refId |
| 7 | `job_arbitration_log` | `actor_uid` | `job_id` | 无 | `time_created` | `job_id` | `(time_created DESC, log_id DESC)` | actor,target,from,to,refId |
| 8 | `batt_entry` | 无（`uid`=电量归属人） | 无 | 无 | `time_created` | `ref_id` | `(time_created DESC, txid DESC)` | from,to,refId |
| 9 | `checkin_log` | 无（系统奖励） | 无 | 无 | `time_created` | 无 | `(time_created DESC, log_id DESC)` | from,to |
| 10 | `checkin_makeup_log` | 无（本人补签） | 无 | 无 | `time_created` | `cid` | `(time_created DESC, log_id DESC)` | from,to,refId |
| 11 | `rating` | `rater_uid` | `ratee_uid`,`target_id` | `direction` | `time_created` | `target_id` | `(time_created DESC, rating_id DESC)` | actor,target,action,from,to,refId |
| 12 | `listing_order_event` | `actor_uid` | `order_id` | `event_type`,`from_status`,`to_status` | `time_created` | `ref_id`,`order_id` | `(time_created DESC, event_id DESC)` | actor,target,action,from,to,refId |
| 13 | `referral` | 无（child/parent 语义二选） | `child_uid`,`parent_uid` | 无 | **`bound_at`**（★ 无 `time_created`） | 无 | `(bound_at DESC, child_uid DESC)` | target,from,to |
| 14 | `commission_policy` | `created_by` | 无（全局策略） | 无 | `time_created` | 无 | `(time_created DESC, policy_id DESC)` | actor,from,to |

**逐表排序键（keyset · `R-9-79`）小结**：**13 面**用 `time_created`；★ **唯一无 `time_created` 的有效表 = `referral` ⇒ `bound_at`**（`app_config` 已裁出 · 不涉及）。PK 逐表：`log_id`（8 面）/ `txid`（`ledger_entry`·`batt_entry`）/ `rating_id` / `event_id` / `child_uid` / `policy_id`。

**`app_config` 出（`R-9-77`）**：不在 `AUDIT_TABLES` ⇒ `GET /api/admin/audit/app_config` ⇒ **`400 AUDIT_TABLE_NOT_FOUND`**（探针实证 · §5）。

---

## 5. 读口真跑冒烟（只读 · `audit-read-smoke.ts` + `filter-pos.ts`）

> 原始输出：`backend-ts/.p8s6-impl/audit-read-smoke-20261003T094719Z.json` · `filter-pos.ts`（stdout）
> **说明〔回填〕**：本节 = **只读真跑**（`DatabaseService.readAuditPage` 走生产同一取数口 · 不启停 5787/5788）。
> HTTP 层**已由类级门 `p8-s11` 的 `K10` 以受控实例（`127.0.0.1:5797`）覆盖**：无 token `401` / 持 `manage_audit` `200` /
> `app_config` `400 AUDIT_TABLE_NOT_FOUND` / 不适用参数 `400`（含 `supportedFilters`）/ `limit=101` `400` / 非白名单 `400`
> （artifact `.p8s11-artifacts/p8s11-20261003T095850Z/gate.json` · 带实例 **87/87**）—— **取代首版「HTTP 层未测」**。

### 5.1 白名单 + 14 面逐表取数

| 项 | 读数 |
|---|---|
| 白名单闭集 | **14** · 与 §32.2 逐字 14 面**集合相等 = `true`** · `has_app_config = false` |
| 逐表真跑（默认 `limit=50` · `rows` 读数） | `admin_ops_audit_log` **4**（=★历史 4 行）· `admin_refund_audit_log` **7** · `ledger_entry` **50**（`has_next=true` · 表 359 行）· `currency_review_log` **0** · `currency_status_log` **7** · `listing_review_log` **0** · `job_arbitration_log` **0** · `batt_entry` **2** · `checkin_log` **2** · `checkin_makeup_log` **2** · `rating` **0** · `listing_order_event` **0** · `referral` **2** · `commission_policy` **4** —— **14/14 `ok=true`（零执行异常）** |

### 5.2 负路径（全部 `400` · `R107` · 借 `LEDGER_AMOUNT_INVALID`）

| 用例 | HTTP | `code` | `details` |
|---|--:|---|---|
| `app_config`（已裁出） | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'table', reason:'AUDIT_TABLE_NOT_FOUND'}` |
| `made_up_table`（非白名单） | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'table', reason:'AUDIT_TABLE_NOT_FOUND'}` |
| `ledger_entry?actor=1`（该表无 actor 列） | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'actor', reason:'PARAM_NOT_APPLICABLE', supportedFilters:['from','to','refId']}` |
| `ledger_entry?limit=101` | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'limit', reason:'LIMIT_OUT_OF_RANGE', max:100, min:1}` |
| `ledger_entry?cursor=not-a-cursor` | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'cursor', reason:'CURSOR_INVALID'}` |
| `ledger_entry?from=not-a-date` | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'from', reason:'INVALID_TIMESTAMP'}` |
| `ledger_entry?refId=abc` | 400 | `LEDGER_AMOUNT_INVALID` | `{field:'refId', reason:'NOT_DECIMAL_INTEGER'}` |
| 缺省 `limit` | — | — | **`default=50`** ✅ |

### 5.3 keyset 分页（`ledger_entry` · limit=5 两页）

| 项 | 读数 |
|---|---|
| 第 1 页 `txid` | `[736, 735, 734, 733, 366]`（`page1_has_next=true`） |
| 第 2 页 `txid` | `[364, 363, 362, 361, 360]` |
| 两页重叠 | **`[]`**（无重叠） |
| 降序 | **`descending_page1 = true`** |

### 5.4 过滤面正向真跑（**非假过滤**）

| 用例 | 期望 | 现取 |
|---|---|---|
| `admin_ops_audit_log?action=points_adjust` | 命中全部（恒值列） | **4 行** |
| `admin_ops_audit_log?action=<哨兵串>`（原生值为连续双下划线包裹 · 见原始输出） | 0 | **0 行** |
| `ledger_entry?from=2999` / `?to=2000` | 0 / 0 | **0 / 0** |
| `referral?target=<child_uid>` | ≥1 且逐行 `child_uid ∨ parent_uid` 命中 | **1 行 · all_match=true** |
| `commission_policy?actor=<created_by>` | 逐行 `created_by` 命中 | **1 行 · all_match=true** |
| `ledger_entry?refId=<ref_id>` | 逐行 `ref_id` 命中 | **16 行 · all_match=true** |

---

## 6. C3③ 原因码常量集（`R-9-76`）+ C3 四条件逐条读数

### 6.1 原因码常量集（本单落）

| 面 | 内容 |
|---|---|
| 常量集 | **`backend-ts/src/points-adjust-reasons.ts`**（新增 · 44 行 / 2,589 B / md5 `30c1c42d29ba0f2349628b695378b92d`） |
| 值（恰 7 · 语义域 · **非错误码**） | `MANUAL_CORRECTION` / `CUSTOMER_COMPENSATION` / `PROMOTION_BONUS` / `PENALTY_DEDUCTION` / `BUG_COMPENSATION` / `MIGRATION_ADJUSTMENT` / `OTHER` |
| 校验落点（★口径切换点） | `src/index.ts` `POST /api/admin/points/adjust`：既有「非空」闸**之后**追加 `isPointsAdjustReason(reason)` 闸 ⇒ 集合外 ⇒ **`400 LEDGER_AMOUNT_INVALID` + `{field:'reason', reason:'REASON_CODE_NOT_IN_ENUM', allowed_reasons:[…]}`**（`R107`） |
| **历史 4 行兼容** | `admin_ops_audit_log` 现取 **恰 4 行**（探针实读）；**不回填 / 不改写**（`R-9-76` 逐字）；读侧原样展示 |
| **错误码闭集** | **33 不动**（`grep -cE '^\| *[0-9]+ *\| ?`LEDGER_' docs/ledger.spec.md` = **33** 复取）—— 原因码 = **语义域**，非错误码 |
| 探针读数 | `count=7` · `accepts_valid(MANUAL_CORRECTION)=true` · `rejects_bogus/empty/自由文本 = false` |

### 6.2 C3 四条件（`master-plan:716` `C3` 逐字）· 现取读数

| # | C3 条件（逐字） | 现取锚 | 读数 | 结论 |
|--:|---|---|---|---|
| **①** | **仅 `$`（`cid=1`）** | `src/index.ts:2106` `resolveAdminOpsKey(req, actor.session.uID, 'points_adjust', \`${uID}:1\`)`；路由 body 仅 `uID`/`amount`/`reason`（**无 `cid` 入参**）；`0023:166` `v_cid := COALESCE((payload->>'cid')::bigint, 1)` | 请求面**无 cid 可传**；服务端**硬编码 `1`** | ✅ **满足** |
| **②** | **`ops:` 前缀幂等键** | `src/admin-service.ts:39` `ADMIN_KEY_PREFIX='ops:'`；`:76-78` 强校验前缀（缺 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`；前缀不符 ⇒ `400 …PREFIX_REQUIRED`）；`index.ts:2106` 调用点 | 缺键 / 前缀不符均 `400`（既有码） | ✅ **满足** |
| **③** | **必填原因码** | **本单落**：`src/index.ts`（`isPointsAdjustReason` 闸）+ `points-adjust-reasons.ts` | 由「自由文本（仅非空）」**收严为枚举原因码**（7 值）；历史 4 行不回填 | ✅ **满足**（`R-9-76` 采 (b)） |
| **④** | **必经 `ledger_post_event` ⇒ 禁直 `UPDATE account`** | `0023:248` `v_ledger := public.ledger_post_event(v_envelope)`；函数**只** `INSERT admin_ops_audit_log`（`:219` 拒绝留痕 / `:260` 成功行）；**零** `UPDATE …account` | 唯一资金写路径 = `ledger_post_event` | ✅ **满足** |

> **结论（写死）**：**①②③④ 全部满足**（③ 由本单落 · `R-9-76`）。

---

## 7. 门 / 编译 / 冻结面（复绿读数 · 回填点）

### 7.1 类级门 `p8-s11`（审计台统一读口 · 87 检查）

| 项 | 读数 |
|---|---|
| **带受控实例**（`P8S11_BASE=127.0.0.1:5797`） | ✅ **`total=87 passed=87 failed=0`**（`db=6 http=6`）· artifact `.p8s11-artifacts/p8s11-20261003T095850Z/gate.json` |
| **本单离线复测**（无实例 · 连库 · 本树 `a2cdb04`） | **`total=87 passed=86 failed=1`** —— 唯一红 = **`K10`**（HTTP leg · `fetch failed`：离线无受控实例）· `K1–K9` 全绿（`db=6`）· artifact `.p8s11-artifacts/p8s11-20261003T100424Z/gate.json` + 原始输出 `.p8s6-impl/p8s11-offline-retest.out` |
| 静态面（A–J + W 页接线 + L 四语/禁漏） | **全绿**（含 21 项自证负对照 · id 后缀 `selftest` · **逐条转红自证**） |

### 7.2 硬门

| 项 | 读数 | 出处 |
|---|---|---|
| `tsc -p tsconfig.json --noEmit`（后端） | ✅ **exit 0**（本单复跑 · 0 错） | 本单 `/ 复取` |
| 前端 `vite build` | ✅ **exit 0**（1796 模块 · 仅既存 dynamic-import 警告） | `.p8s6-impl/fe-build.out` |
| 前端单测 | ✅ **276 passed (276)** / 31 files | `.p8s6-impl/fe-unit.out`（★ 见 7.3） |
| `P6-TR-1a` 离线套件 | ✅ **126/126** | `.p4-artifacts/p6tr1a-20261003T095920Z/offline-tests.json` |
| 门 `p8-s2`（注册点前推） | ✅ **`44/44`** | `.p8s2-artifacts/p8s2-gate-20261003T094839Z/gate.json` |
| 注册点实测 | **88**（`get 37 / post 48 / put 0 / patch 1 / delete 2`） | 本单 `p8-s11` 复取 |
| 错误码闭集 | **33 不动** | `docs/ledger.spec.md` |
| i18n 基线（回填点） | `top=119 / flat=1035 / nodes=4140 / adminNav=30`（四语各 `auditConsole` 33 键） | 门 `L1/L2/L6` + `i18n-batch-b4a/b4b` 期望值 |

### 7.3 受并行单在途影响登记（**不得据此改判据 / 判缺陷**）

- **`D1`** = `frontend/src/auth.js`（`git status = M` · `git diff --numstat` 现取 **+45/−1** · mtime **`18:04:33`**）——**在途变化中**；晚于 `fe-unit.out`（`17:59:12`）
  ⇒ 上表 **276** 系 D1 落盘**之前**读数；前端单测（含 `auth.test.js`）**可能受 D1 在途影响** ⇒ 归**质检单**，本单**不据此改判**。
- **`D2`** = `backend-ts/migrations/0040_backfill_signup_batt.sql`（`git status = ??` **未跟踪** · 16,868 B · mtime **`18:06:02`**）——
  ★ **本单离线复测（`18:04:41`）时尚未落盘**，复测**后**（`18:06:02`）方现于工作树；属**迁移面在途**，8⑥ 各判据**不读 `0040`**（门只读 `0039` · `K1` 取 `schema_migration = 38 · max 0039`）⇒ **无影响**。
- 本单**未跑** `s1..s10` 全量门（避免混入 D1/D2 在途改动）· **只补 `p8-s11` 离线读数**（§7.1）——全量归**质检单**。

---

## 8. 三处编码同集（`R-9-75`）+ 迁移（逐处出处）

| 处 | 落点 | 读数 |
|---|---|---|
| ① 后端闭集 | `backend-ts/src/database.ts:16-31` `ALL_ADMIN_PERMISSIONS` | **+1** `'manage_audit'` ⇒ 恰 **12** |
| ② 前端硬编码 | `frontend/src/admin-utils.js` 离线兜底列表 | **+1** `'manage_audit'` ⇒ 恰 **12** |
| ③ 库侧迁移 | `backend-ts/migrations/0039_admin_audit_console.sql` | `admin_permission` 11 → 12 + `super_admin` 赋权（**apply 由 Zang**） |
| ④ 门相等断言 | `p8-s2-fee-rebate-gate.ts` `A10`–`A12`（`permClosedSet`） | 门闭集 == 前端闭集（**44/44 绿**） |

---

## 9. `NOT_MEASURED` 收敛（回填点 · **9 项 → 7 已测 / 2 保留原因**）

> **收敛口径**：能测的已测（给读数 + 出处）；不能测的**保留原因**（禁填 0 / 空）。

| # | 项 | 回填结论（读数 / 原因） |
|--:|---|---|
| 1 | **读口 HTTP 实跑**（14 面 / 分页 / 五类过滤 / `401` 鉴权） | ✅ **已测**：门 `p8-s11` `K10` 受控实例真 HTTP —— 无 token **`401`** / 持 `manage_audit` **`200`** / `app_config` **`400 AUDIT_TABLE_NOT_FOUND`** / 不适用参数 **`400`**（+`supportedFilters`）/ `limit=101` **`400`** / 非白名单 **`400`**（artifact `p8s11-20261003T095850Z/gate.json` · 带实例 87/87）。离线路由下 `K10` 转红（无实例）→ 已登记 §7.1 |
| 2 | **`0039` apply 后的库侧读数** | ✅ **已测**：门 `K1` `schema_migration = 38 · max 0039`；`K2` `admin_permission = 12` 含 `manage_audit`；`K3` `super_admin = 12`；`K4` 基表 `34`；`K5` 14 面 append-only 触发器在场 |
| 3 | **`schema_migration = 0039` 行 / 迁移数 `37 → 38`** | ✅ **已测**：`K1` 现取 `count = 38 / max(version) = 0039` |
| 4 | **前端 `AuditConsolePage`**（14 面切换 + 五类过滤 + 分页 + `adminNav`） | ✅ **已建**：`frontend/src/pages/admin/AuditConsolePage.jsx`（9,871 B）+ 路由 `dashboard/audit-console`（`App.jsx` · `ProtectedRoute requiredPermission="manage_audit"`）—— 门 `W4/W5/W6` 绿 |
| 5 | **四语文案「值」**（`auditConsole` 命名空间 + `adminNav`） | ✅ **已写**：四语 `auditConsole` 各 **33 键** + `adminNav.auditConsole`/`auditConsoleDesc`（+2 键/语）—— 门 `L1/L2` 绿；`en`/`vn` **零 CJK**（`L3`）；值非空（`L5`） |
| 6 | **i18n 计数前推**（`top 118 → 119` 等） | ✅ **已前推**：`top = 119 / flat = 1035 / nodes = 4140 / adminNav = 30`（本单四语复取；门 `L1/L2/L6` 作用域 `140 = (33+2)×4`） |
| 7 | **六类禁漏扫描门**（四语新增键值正则 + 负对照） | ✅ **已落**：门 `L4`（新增用户可见文案逐值六类扫描 = **0 命中**）+ `L7`（注入 §章节号 / 表名 / 接口路径 / 状态码 / 裸键 / 机读码 ⇒ 扫描**逐条转红**自负对照） |
| 8 | **`txid` 作为独立过滤参数** | ⛔ **保留**（`NOT_MEASURED` · 原因 = **设计选择**）：§32.3(c) `txid` = 可作 `refId` 或独立参数 · 本片取「**不独立**」⇒ `txid` 仅作 `ledger_entry`/`batt_entry` 的 `pk`（keyset 副键）；如需独立参数 ⇒ **后续单另立** |
| 9 | **迁移 `0039` 的 checksum / `migrate.ts` 整链重放** | ⛔ **保留**（`NOT_MEASURED` · 原因 = **不 apply**）：本单 / 工匠单**不 apply 迁移** ⇒ 迁移器整链归 **apply 执行方（Zang）**；`R-9-24` 已以**事务内真跑**覆盖「文件语法 + 9 项 `DO` 自检」（§2） |

---

## 10. 只读自证 / 纪律自证

- **库面写**：一切写库均在**单事务 + 末尾 `ROLLBACK`**（`0039` 真跑 · §2）；`readAuditPage` / 探针读面**仅 `SELECT`**。
- **只读衔接（§32.10）**：审计台**不出现任何写 14 面的语句**；不新造汇总表 / 宽表 / 物化写入第二真源（`C9`）。
- **未碰**：`docs/*.spec.md` · `docs/seafood.master-plan.md` · `docs/qa/**`（`git status` 对拍 = 空）；`migrations/0001`–`0038`（**一字未动**）；`app_config`（**未 UPDATE**）。
- **未做**：`git add/commit/push`（禁）· `npm install`（禁）· 启停 5787/5788（禁）· `pkill -f`/`killall`（禁）· 打印 `.env*`（禁）。
- **探针落点**：`backend-ts/.p8s6-impl/`（**不入 `scripts/`**）；原始输出**不用 `.log` 后缀**（`.json` / stdout）。
- **改动清单（`git diff --numstat`）**：`p8-s2-fee-rebate-gate.ts` +22/−2 · `database.ts` +15/−0 · `index.ts` +42/−0 · `admin-utils.js` +1/−0；新增 `0039_admin_audit_console.sql` / `audit-console.ts` / `points-adjust-reasons.ts`。
- **报告自证（回填点）**：`wc -l` = **333** 行 · `wc -c` = **32025** B（utf8）；**全文“连续双下划线”（U+005F ×2）出现 = 0**（无未填占位 / 无残留；`action` 哨兵串以「连续双下划线包裹」描述 · 原值见 §5.4 原始输出）· **整行占位符** = 0。
- **判负自证（本单核心）**：4 处判负**逐处转红** · 复原**回绿**（唯一残留红 = 离线无实例的 `K10`）· 主仓 **零写入**（`cmp` 三文件全等 · §11）。

---

## 11. 判负收尾（judge-negative · **仓外沙箱** · 主仓零写入）

> **手法**：本单**不写主仓 `src/**`**。步骤 = ① 仓外**全树副本**（`/Users/kevin/bistro/.p8s6-jn-sandbox` · `rsync --exclude node_modules/.git/dist/.*-artifacts/.env*` + `node_modules` 软链）⇒ ② 在副本内**注入缺陷** ⇒ ③ 跑门（读副本 `REPO_ROOT`）⇒ 期望红点 ⇒ ④ 副本内**复原** ⇒ ⑤ 复跑回绿 ⇒ ⑥ `cmp` 副本↔主仓 + 造前/造后主仓指纹，证**主仓零写入**。
> **判据**：门 `p8-s11` 离线基线 = `total=87 passed=86 failed=1`（唯一红 = `K10` 无实例）。下表「红点」= **注入后新增红**（`K10` 基线恒红，不计入）。
> **原始输出**：`.p8s6-jn-sandbox/{M_a_whitelist_off,M_b_inapplicable_off,M_c_enum_reason_off,M_d_auth_off,restore_after}.out` · 汇总 `.p8s6-jn-sandbox/judge_negative_summary.json` · 行为探针 `.p8s6-jn-sandbox/backend-ts/jn-probe.ts`（**均在仓外**）。

| # | 注入缺陷（仓外副本） | 期望红点 | 实际红点（`passed/failed`） | 复原后回绿 | 主仓 `cmp` |
|--:|---|---|---|---|---|
| **a** | **去表名白名单闸**（删 `AUDIT_TABLES[table]` 未命中 ⇒ `400 AUDIT_TABLE_NOT_FOUND`）⇒ 改 `AUDIT_TABLES[table] \|\| AUDIT_TABLES.ledger_entry` | `C1/C2/C3`（非白名单不再 `400`） | ✅ **`C1,C2,C3,H2`**（`passed 82/failed 5`） | ✅ 复原 ⇒ `86/1` | ✅ 全等 |
| **b** | ★ **去「不适用参数」闸**（删 `400 PARAM_NOT_APPLICABLE` 循环 · `R-9-78`） | `D1/D2/D5`（不适用参数**静默放行**） | ✅ **`D1,D2,D5`**（`passed 83/failed 4`） | ✅ 复原 ⇒ `86/1` | ✅ 全等 |
| **c** | **去枚举原因码闸**（删 `index.ts` `if(!isPointsAdjustReason(reason))…`） | `K9`（切换点接线消失） | ✅ **`K9`**（`passed 85/failed 2`） | ✅ 复原 ⇒ `86/1` | ✅ 全等 |
| **d** | **去 `manage_audit` 鉴权**（`requireAdmin(req,res,'manage_audit')` ⇒ `requireAdmin(req,res)`） | `I5`（路由闸丢失） | ✅ **`I5`**（`passed 85/failed 2`） | ✅ 复原 ⇒ `86/1` | ✅ 全等 |

### 11.1 ★ 关键空格 · 「静默返回全表」= 假绿陷阱（注入 `b` 的行为实证）

> 探针直接调**被变异模块**的 `parseAuditRequest` + `buildAuditSql`（未走门谓词，防「门与实现同错」）：

| 用例 | 基线（正确） | 注入 `b` 后（缺陷） |
|---|---|---|
| `ledger_entry?actor=1` | `ok=false · reason=PARAM_NOT_APPLICABLE` | ⚠️ **`ok=true · hasWhere=false`** ⇒ `SELECT * FROM public.ledger_entry ORDER BY time_created DESC, txid DESC LIMIT $1::int`（**无 WHERE ⇒ 静默返回全表**） |
| `checkin_log?refId=1` | `ok=false · reason=PARAM_NOT_APPLICABLE` | ⚠️ **`ok=true · hasWhere=false`** ⇒ `SELECT * FROM public.checkin_log …`（**静默返回全表**） |

⇒ **`R-9-78` 核心风险（不适用参数静默放行 = 越权/误读全表）可被门 `D1/D2/D5` 揪住** · 探针**非假过滤**。

### 11.2 注入 `a` 的行为实证（白名单失效 · `app_config` 泄漏）

- `app_config`（**本应裁出**）：基线 `400 AUDIT_TABLE_NOT_FOUND` ⇒ 注入后 ⚠️ **`ok=true`** ⇒ `SELECT * FROM public.app_config …`（**`R-9-77` 裁出的表被读回**）。
- `made_up_table`：基线 `400 AUDIT_TABLE_NOT_FOUND` ⇒ 注入后 ⚠️ **`ok=true`** ⇒ `SELECT * FROM public.made_up_table …`（**任意外部表名直达 SQL 标识符位 · 白名单闸失效**）。

### 11.3 主仓零写入自证（`cmp`）

| 文件 | 造前主仓 == 造后主仓 | 复原后副本 == 主仓 |
|---|---|---|
| `backend-ts/src/audit-console.ts` | ✅ `true` | ✅ `true` |
| `backend-ts/src/index.ts` | ✅ `true` | ✅ `true` |
| `backend-ts/scripts/p8-s11-audit-console-gate.ts` | ✅ `true` | ✅ `true` |

⇒ 4 处判负全程在**仓外副本**进行，**主仓 `backend-ts/src/**` 一字未动**（`cmp` 全等 · 主仓 `git status` 无新增/变化）。
