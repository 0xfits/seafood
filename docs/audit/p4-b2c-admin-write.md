# P4-B2c · 权限与设置（非资金面）（批 2 第 3 片）· 交付与读数报告

> 状态：**进行中（逐段回写）** · 角色 = **Kong（实现）** · 派单 = Zang（终审）
> 唯一权威：`docs/route-layer.spec.md` **v0.1**（498 行，只读）+ `docs/data-layer.spec.md` **v0.6**（只读，本报告引用其 §4.1/§9/§11.2/§11.3 与 `DL36`/`DL38`/`DL71`/`DL72`/`DL104`/`DL105`/`DL122`/`DL147`）。
> 仓库 `/Users/kevin/bistro/seafood`（后端 `backend-ts`）· 服务 `seafood-api`（5788，面板 sid `seafood-api`）· 库 = Neon PG 18.6（`public` schema，`/health` ⇒ `schema_version=0017`）
> Run 标签：**`b2c-20260930T010620`** · 产物：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b2c-20260930T010620/**`（绝对路径）
> 探针口径：`neon()` **HTTP** 驱动；HTTP 读数用 `curl --max-time 20`（本机**无** `timeout`/`gtimeout`）

---

## §0 口径与硬边界（逐字执行）

| 项 | 口径 |
|---|---|
| 本片范围 | **权限与设置的非资金面**：`admin_role*` 三表映射与空态、`app_config` 读写、`/api/admin/me` 与后台用户管理读口（逐条见 §1.1） |
| 资金红线 | 本片**任何路径不得**产生 `ledger_entry` 行，不得改 `account` / `currency` 的任何行或值（§3.4 不变量）；不 import `./ledger`、`./commission`；不调任何编排函数 |
| 不做（整条归别片/批） | `POST /api/admin/points/adjust`（#54，**资金 ⇒ 批 3**）· `POST /api/admin/assets/init`（#53，已由 B2a/B2b 落 `410`）· `POST /api/admin/commission_policy`（§1.1:138，**返佣政策面 = 非本片**）· 一切带分录动作（§4.0 R2/R5） |
| **★ 禁写 admin 种子** | **严禁**向 `admin_permission` / `admin_role` / `admin_role_permission` / `admin_user_role` 写任何行（派单硬口径 #3：种子存库会被「重建回 seed 基线」抹掉 ⇒ 留批 6 走迁移）。四表当前 **0 行 = 预期**，**不得**当缺陷、**不得**自行塞数据。⇒ 权限**写**口的「成功落行」路径在本片为 **`NOT_MEASURED`**（其守卫分支可测） |
| 写库纪律 | **允许写库**；**禁删任何行**；夹具 uid 用 **`9702xx`** 专属区间（**避开** `970001`/`970002`/`9700xx`）；**禁跑写库套件**；**禁改 `migrations/**`**；**不自行重置/重建库**；**禁 `git add/commit/push`**；**禁删除型 SQL**（测试产生的行保留） |
| 允许改动 | `backend-ts/src/**`、本报告、`backend-ts/.p4-artifacts/**`、`backend-ts/scripts/p4z-*.ts`（**不改** `p4z-01-probe.ts`） |
| 禁改 | `migrations/**`、`src/ledger-errors.ts`（冻结）、`src/ledger.ts`、`src/commission.ts`、`frontend/**`、`.env.local`、既有脚本/artifact、`docs/route-layer.spec.md`（只读）、其它 spec/versions/qa/audit 既有件、`docs/seafood.master-plan.md` |
| 禁用 | `execute_code`；`npm install`；连接串/token 落盘（`grep -c 'e[y]J'` 必须 = 0）；`pkill -f` / `killall`（**本单不 kill 任何东西**）；管道后取退出码 |
| 服务重启 | 只许面板单服务路由 `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}`；重启后**等 `/health` 200 再测** |

### §0.1 口径自曝（§5.7 纪律逐条对照）

1. 保留字 / 带引号对象**一律加引号**：真表名 `public."users"`（裸 `user` 会被解析成 `current_user` 而**静默不报错**）。
2. 退出码**不取自管道之后**：HTTP status 由 `curl -w '%{http_code}'` / `execFileSync` 直接取得；`tsc` 退出码单独取。
3. 本机**无 `timeout`/`gtimeout`**：一律 `curl --max-time 20`。
4. 读数异常**先怀疑自己的探针/口径**（§4.3 逐条自曝）。
5. **先落盘骸架**（本 §0/§1）+ **每段立即回写**（**代码改动在本报告首节落盘之后**）。
6. 产物 **run-tagged + 绝对路径**；报数**带口径**。
7. 凡写「零引用 / 不存在」必须**双口径**（代码面 `grep` + 库面 `to_regclass`/`COUNT`）。
8. 凡写「实测」必须能在产物里 `grep` 到支撑读数。
9. 凡 `401`/`403` **必须同时看服务端日志**（`GET :5555/api/logs/seafood-api`）——本仓 `resolveActor` 把一切异常吞成 401。

---

## §1 本片端点清单（**先落盘、后动代码**）

> 抽取自 spec `§1 端点处置表`（`/api/admin/*`、`/api/user/all`、`/api/user/stats` 行）+ `§4.1`/`§4.6 批 2` + `§5.1` + `§6`。行号 = 本单实测 **live 行号**（`backend-ts/src/index.ts` 工作树当前态；spec 记的行号有 B2a/B2b 改动后的漂移，见 §4.3-1）。

### §1.1 处置表（逐条）

| # | 原端点（`index.ts:行号` spec / **live**） | 新端点 / 内部 service 名 | 处置 | 目标表与字段 | spec 依据 |
|--:|---|---|---|---|---|
| A1 | `GET /api/admin/me`（spec :718 / **live :709**） | 同路径 | **【保留·改接】**：`permissions[]` 数据源换 `admin_user_role ⋈ admin_role_permission`；`is_admin=true` ⇒ 全权限语义（不回空数组） | `users.is_admin` + `admin_user_role` + `admin_role_permission.permission_key` | §1 #31；§6.1（`can_access_admin` 单一真源）；§6.4（`permissions[]`）；`0017:88-90` |
| A2 | `GET /api/admin/settings`（spec :724 / **live :715**） | 同路径 | **【保留·改接】**：读 `app_config`（`key='system_settings'` 的 `value`）；**响应标注「费率不在本表」** ⇒ 落在 `message`（**不改 data 键集**，§2 母约束） | `public.app_config`(`key`,`value`,`updated_by`,`time_updated`) | §1 #32；`DL71`；`data-layer.spec.md:273` |
| A3 | `POST /api/admin/settings`（spec :737 / **live :728**） | 同路径 | **【保留·改接】**：`app_config` upsert（补 `updated_by` = actor uid ⇒ 修当前 `NOT NULL` 违约缺陷）；**必带 `ops:` 幂等键**；**禁写费率键** | `public.app_config`：`key='system_settings'`、`value`(jsonb)、`updated_by`、`time_updated`(触发器) | §1 #33；`DL36`；§11.2:581（`ops:<admin_uid>:setting:<key>`）；`DL71` |
| A4 | `POST /api/admin/settings/reset`（spec :750 / **live :741**） | 同路径（**不删路径**） | **【弃用→`410`】**（`R107` 形状 + 登记过期日；撤 `requireAdmin` 前置，理由同 B2a/B2b） | —（无审计的批量破坏写） | §1 #34；§5.1「一键重置设置」行；**C3 ②**（`data-layer.spec.md:343`） |
| A5 | `GET /api/admin/permissions`（spec :763 / **live :754**） | 同路径 | **【保留·改接】**：`permission_group`→`admin_role*` 三表；**撤销 B1-c 打的 `deprecated`** | `admin_role`(`role_key`,`name`,`time_created`) + `admin_role_permission` + `admin_user_role` | §1 #35；§5.1「权限面板弃用标」行；§5.3；`DL38`；`DL72` |
| A6 | `POST /api/admin/permissions/save`（spec :779 / **live :770**） | 同路径 | **【保留·改接】**：upsert `admin_role` + 重建 `admin_role_permission`/`admin_user_role`（单语句 CTE）；**必带 `ops:` 键**；**自锁守卫**（不得把自己降权到无 `manage_permissions`） | `admin_role` / `admin_role_permission` / `admin_user_role` | §1 #36；§4.1 #39（`data-layer.spec.md:277`）；§11.2:582 |
| A7 | `POST /api/admin/permissions/delete`（spec :800 / **live :791**） | 同路径 | **【保留·改接】**：删 `admin_role`（先清子行）；**必须校验该角色下无在用用户**；**必带 `ops:` 键** | `admin_role` / `admin_role_permission` / `admin_user_role` | §1 #37；§4.1 #40（`:278`）；§11.2:583 |
| A8 | `POST /api/admin/user/update`（spec :821 / **live :812**） | 同路径 | **【保留·改接】**：入参白名单 = `target_uid`(兼容 `uID`) / `is_admin` / `role_key`(角色分配) / `bio`；**禁** `evm`/`uid`/**任何余额或积分类字段**（⇒ `400`）；**必带 `ops:` 键** | `users.is_admin` / `users.bio` / `admin_user_role`（**禁** `users.evm`/`users.uid`） | §1 #38；**`DL16`**（`data-layer.spec.md:120`）；**`DL104`**（`:606`）；§11.2:584 |
| A9 | `GET /api/user/all`（spec :946 / **live :875**） | 同路径 | **【保留·改接】·只读视图**：分页 + **只出非敏感列** + **禁 token**（键集冻结：`uID/EVM/bio/is_admin/time_reg/time_login_last`） | `public."users"`（`SELECT u.*`，列名已由 B2a-HTTP 修正） | §1 #45；§4.1 #48（`:286`）；`DL38` |
| A10 | `GET /api/user/stats`（spec :960 / **live :889**） | 同路径 | **【保留·改接】·账本口径统计**：`users` + `account`；**标注「账本派生」**（落 `message`，**不改 data 键集**） | `public."users"` + `public.account`(`uid`,`cid=SYSTEM_CURRENCY_CID`) | §1 #46；§4.1 #49（`:287`）；`DL1`/`DL24`；`DL38` |
| A11 | 全片共用的**守卫错误体**（`requireActor` / `requireAdmin`，`index.ts:131-167`） | — | **【保留·改语义】**：`401` ⇒ `AUTH_UNAUTHORIZED`、`403` ⇒ `AUTH_FORBIDDEN` + `details.reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`，**形状照 `R107`** | — | `DL105`（`:607`，v0.2 C4/C6）；`DL122`（`:754`）；**`DL147`**（`:755`）；§11.3（`:767`/`:776`/`:777`）；§6.2 |
| A12 | `POST /api/admin/assets/init`（spec :1056 / **live :985**） | 同路径（**不删路径**） | **【弃用→`410`】**（**本片补齐**；撤 `requireAdmin` 前置。**注**：初稿把它记作「已由 B2a/B2b 落 410」，**实测证否** —— 首跑 `500`，见 §3.1 T39 / §4.2-1） | —（账户由 DB 按需 0/0 开户，`R75`） | §1 #50；§5.1「资产初始化」行；§4.1 #53（`:291`） |

**本片 `410` 面统一要求**（§5.1「统一要求」逐字）：响应体 = `R107` 形状 `{error:{code,message,i18n_key,details}}`，`code='LEDGER_REF_NOT_FOUND'`；`details` **必须**登记 `sunset`（过期日）；**禁止**回 HTML、禁止 200 空态、禁止裸文本。

### §1.2 本片**不做**（边界登记，防误判）

| 项 | 不做理由（spec 依据） |
|---|---|
| `POST /api/admin/points/adjust`（:995 live） | §1 #51 明标 **资金 ⇒ 批 3**（`ledger_post_event(mint|burn)`，C3 ③/`DL146`）；本片**不动** |
| `POST /api/admin/assets/init`（:985 live） | §1 #50 **弃用→410** —— **实测证否「已由 B2a/B2b 落」**（首跑 `500`：`relation "asset" does not exist`）⇒ **本片补齐**（§1.1 **A12** / §3.1 T39 / §4.2-1） |
| `POST /api/admin/commission_policy`（§1.1:138 标批 2） | **返佣政策面**（`insertCommissionPolicy`）**不属「权限与设置」** ⇒ 归同批其它片；派单硬边界 #2（注册点须恒 51）⇒ 与 `/api/job/*`、`POST /api/listing` 同构先例 |
| `GET/POST /api/referral/*`、`GET /api/user/points|ledger`、`GET /api/market/:cid/candles`（§1.1 批 2） | 均为**新对外路径** ⇒ 派单硬口径 #2 明定**随批 4**（服务层如实现亦属别片）；本片**不注册** |
| `POST /api/tasklist/:jID/verify`、`/api/job/*`、`/api/order`、`/api/market/*` 写口 | 资金面 ⇒ **批 3** |
| `GET /api/shard`、`/api/shard/transfer` | §5.1「保留路径 + 空态 + `deprecated:true`」到**批 4** ⇒ **本片不动**；两处 `deprecated` 保留（§5.3） |

### §1.3 与 spec 的张力（**登记，不自行裁定**）

> 逐条裁定与自曝见 §4.2/§5.3（随实现落定后回填）。

1. **`GET /api/admin/me` 形状**：`§6.4`/`§4.1 #34` 目标形状 = `{uid, evm, is_admin, permissions[]}`（4 键），而 §2 母约束 + 前端 `admin-utils.js:27-35` 消费的既有形状 = `AdminAccessRecord` **6 键**（`uID/EVM/is_admin/permissions/can_access_admin/preferred_admin_path`）⇒ 本片取 **§2 键集冻结优先**（改形状会让前端 `can_access_admin`/`preferred_admin_path` 静默失效）。⇒ 登记待 Zang。
2. **`ops:` 幂等键的落地位置**：`DL36`/§11.2 要求后台写「必带 `ops:` 键」，但 `app_config`/`admin_role*` **无幂等键列**（`0017` 逐列契约冻结）⇒ 本片实现为**请求侧校验**（缺失 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`），**不落库**；「服务端自派生 vs 调用方传入」的语义未在 spec 明写。⇒ 登记待 Zang。
3. **`ops:` 键对冻结前端的破坏面**：前端 `admin/SystemSettings.jsx:84-88`、`PermissionsManagement.jsx:89-98/132-135`、`UsersManagement.jsx:103-107` 的写请求**均不带**幂等键 ⇒ 按 `DL36` 落地后这 4 个写口对旧前端会 `400`。本片**禁改 `frontend/**`** ⇒ 登记为**必做前端同步项**（§5.2 未列）。
4. **`DL38` 的「查询层不得继续引用旧 `database.ts`」**：本片按 B2b 先例把新 SQL 留在 `DatabaseService`（单一查询门面），但**删净**旧 `permission_group` 引用（`grep` 检验）；「模块位置」与「旧引用数」两种读法登记待 Zang。
5. **`admin_permission` 的 FK 闸**：`admin_role_permission.permission_key` **FK → `admin_permission`**，而该表 0 行且本片**禁插种子** ⇒ 权限写口的**成功落行**在库上**结构不可达**（必 `23503`）。本片在应用层加**前置存在性检查**（键不在 `admin_permission` ⇒ **`404 LEDGER_REF_NOT_FOUND`** —— 见下方**更正**），使失败**不落裸 SQLSTATE**（`§3.3-4`）。⇒ 登记。
   - **更正**：本条初稿写「⇒ `400`」；实现取 **`404 LEDGER_REF_NOT_FOUND`**（`§3.1`「业务对象不存在」），实测 `http-results.json:T17` = `404` + `details.ref_type='admin_permission'`。**以 `404` 为准**。
6. **★ `isAdminAddress` 的第三真源（本片判定不改，登记待裁）**：`index.ts:98-129 resolveActor` 仍把 `isAdminAddress(user.EVM)` 传入 `buildAdminAccess` ⇒ `is_admin` 实际 = `users.is_admin OR 硬编码地址命中`。`§6.1`/`DL72` 明写「**旧 `isAdminAddress` 双源禁止**」（`0017:33`），真源应为 `users.is_admin OR EXISTS(admin_user_role)`。**本片不改**的理由（硬约束，非偷懒）：收敛到单一真源**必须**先保证运营管理员在库里 `users.is_admin=true` 或有角色行 ⇒ 那是**数据迁移/种子**（批 6），而派单硬口径 #3 **禁止本片写任何种子** ⇒ 「先删代码支路再补数据」会把运营管理员**当场锁在后台外**。⇒ **必须由 Zang 裁定次序**（建议批 6 与种子同批落地）。证据：`src/index.ts:119`、`src/database.ts:buildAdminAccess`、`frontend/src/admin-utils.js:3-14`（前端同款地址支路）。

---

## §2 代码改动清单（全部落在允许面内）

| 文件 | 改动 | 末态 |
|---|---|---|
| `backend-ts/src/database.ts` | **6 处跨度替换**（补丁器 `p4z-b2c-01-patch.ts`，逐条断言标记唯一性）：<br>**D1** `listPersistedPermissionGroups`+`getPermissionsForUser` → `admin_role*` 三表读 + **新增 6 个读辅助方法**（`hasAdminRoleRow`/`roleExists`/`findMissingPermissions`/`listUserRoles`/`replaceUserRoles`）<br>**D2** `resolveAdminAccess`（§6.1 单一真源，**两分支并行取**）+ `listPermissionGroups`（**撤 3 个内置合成组**，唯一数据源 = `admin_role*`）<br>**D3** `savePermissionGroup` → `admin_role*` 单事务<br>**D4** `deletePermissionGroup` → `admin_role*` + 「无在用用户才可删」（返回 `'deleted'\|'in_use'\|'not_found'`）<br>**D5** `getSystemSettings`/`saveSystemSettings`（**补 `updated_by`**、显式 `public.`）<br>**D6** `buildAdminAccess` 增 `hasRoleRow` 形参（返回键集不变） | **3082** 行（原 3014，**+68**）· sha256 前缀 `1b35e79d25c73d3172a53359` |
| `backend-ts/src/admin-service.ts` | **新增**（非资金面 service）：`adminVerbError`（AUTH 域判定）/ `resolveAdminOpsKey`（DL36 的 `ops:` 键）/ `findFeeRateKey`（禁费率键）/ `adminPermissionSaveVerb`（自锁守卫 + `admin_permission` 前置闸）/ `adminPermissionDeleteVerb`（无在用用户）/ `adminUserUpdateVerb`（DL104 白名单） | **269** 行 · sha256 前缀 `586e8900f62d918580654ffe` |
| `backend-ts/src/index.ts` | **13 处改动**：IX1 import（`ledgerErrorBody` + admin-service）· IX2 `requireActor` 401→`AUTH_UNAUTHORIZED`（R107）· IX3 `requireAdmin` 403→`AUTH_FORBIDDEN`+reason · IX4 GET settings message 标注 · IX5 POST settings（`ops:` 键 + 禁费率键 + `updated_by`）· IX6 **settings/reset ⇒ 410** · IX7 **撤 `deprecated`** · IX8/IX9/IX10 permissions/save·delete·user/update → verb · IX11 stats message 标注 · IX12 user/all 注记 · **+ `/api/admin/assets/init` ⇒ 410**（见 §4.2-1） | **1087** 行（原 1036，**+51**）· sha256 前缀 `9d59d4eea4052a00b6b707ca` |
| `backend-ts/scripts/p4z-b2c-01-patch.ts` | 补丁器（起止标记跨度替换、命中唯一性断言、注册点 51 断言、JWT 自检） | — |
| `backend-ts/scripts/p4z-b2c-02-probe.ts` | 探针（`before`/`http`/`after`：逐表精确计数 + dump hash + 39 条端点矩阵） | — |
| `backend-ts/scripts/p4z-b2c-04-keys.ts` | 键集冻结（**静态口径**：三版本函数体 sha + 返回键名提取） | — |

**补丁器读数**（`patch-log.json`，`PATCH_EXIT=0`）：`src/database.ts` 6 条 edits、`src/index.ts` 12 条 edits；`routes` 断言 = **51**；`jwt_like_tokens_in_src` = **0**。**独立复算**（补丁器外）：`grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts` ⇒ **51**。

**「零资金」双口径（可 `grep` 复核）**：
- `grep -nE "^import|from '\./" src/admin-service.ts` ⇒ **2 行**：`./database`（值）+ `./job-service`（**仅 `import type`**）⇒ **无** `./ledger`、**无** `./commission`；
- 本片**新增/改动**的任何 SQL **不出现** `ledger_entry` / `account` / `currency` / `ledger_post_event` / 三个编排函数（`grep` 见 §3.3）；
- `ledger_entry` 行数 **0 → 0**（§3.3）⇒ 零分录。

---

## §3 必验读数

### §3.1 端点级（真 token；39 条 **39/39 PASS**；产物 `http-results.json`）

| # | 端点 | token | 期望 | **实测** | 体 / 码 |
|--:|---|---|--:|--:|---|
| T01 | `GET /health` | — | 200 | **200** | `{ok,db_version,schema_version,time}` |
| T02 | `GET /api/admin/me` | **admin** | 200 | **200** | data **6 键**（`uID,EVM,is_admin,permissions,can_access_admin,preferred_admin_path`）；`is_admin=true`、`permissions` = **11 键全量**、`uID=970201` |
| T03 | `GET /api/admin/me` | 普通 | 200 | **200** | `is_admin=false`、`permissions=[]`、`can_access_admin=false` |
| T04 | `GET /api/admin/settings` | admin | 200 | **200** | data **9 键**（`SystemSettingsRecord` 不变）；`message` 含「**费率不在 app_config；真源 = commission_policy.fee_rate_bp**」✓ §1 #32 |
| T05 | `GET /api/admin/settings` | 普通 | **403** | **403** | `code=AUTH_FORBIDDEN`、`details.reason=**NOT_ADMIN**`（§6.2 步 2 / DL147③） |
| T06 | `GET /api/admin/settings` | 无 | **401** | **401** | `code=AUTH_UNAUTHORIZED`（R107 形状） |
| T07 | `GET /api/admin/settings` | 坏签名 | **401** | **401** | `AUTH_UNAUTHORIZED`；日志逐字坐实（§3.2） |
| T08 | `POST /api/admin/settings` | admin | 400 | **400** | `LEDGER_IDEMPOTENCY_KEY_REQUIRED`（DL36：无键的后台写） |
| T09 | `POST /api/admin/settings`（`ops:` 键 + `siteName=p4b2c:siteA`） | admin | 200 | **200** | **写成功**（`app_config` 0→1 行，§3.3） |
| T10 | `GET /api/admin/settings`（**读回**） | admin | 200 | **200** | `data.siteName = **"p4b2c:siteA"**` ⇒ **写→读回同值** ✓（派单必验①） |
| T11 | `POST settings`（带 `fee_rate_bp`） | admin | 400 | **400** | `LEDGER_AMOUNT_INVALID`、`reason=**FEE_RATE_KEY_NOT_IN_APP_CONFIG**`、`authoritative_table=commission_policy` |
| T12 | `POST settings`（键前缀 `nope:`） | admin | 400 | **400** | `LEDGER_IDEMPOTENCY_KEY_INVALID`、`reason=PREFIX_REQUIRED` |
| T13 | `POST /api/admin/settings/reset` | admin | **410** | **410** | `R107` + `details.sunset`（§5.1 统一要求） |
| T14 | `POST /api/admin/settings/reset` | **无** | **410** | **410** | 弃用面**不伪装 401** ✓ |
| T15 | `GET /api/admin/permissions` | admin | 200 | **200** | data = `{groups,users}`；**顶层无 `deprecated`** ✓（§5.1 撤销） |
| T16 | `POST permissions/save`（无键） | admin | 400 | **400** | `LEDGER_IDEMPOTENCY_KEY_REQUIRED` |
| T17 | `POST permissions/save`（有键，`permissions=['manage_settings']`） | admin | 404 | **404** | `LEDGER_REF_NOT_FOUND`、`ref_type=**admin_permission**`（§1.3-5：0 行表前置闸，未落裸 `23503`）✓ |
| T18 | `POST permissions/delete`（`id=p4b2c:role`） | admin | 404 | **404** | `LEDGER_REF_NOT_FOUND`、`ref_type=admin_role` |
| T19 | `POST permissions/delete` | **普通** | **403** | **403** | `AUTH_FORBIDDEN` + `reason=NOT_ADMIN` |
| T20 | `POST /api/admin/user/update`（`uID=970202,is_admin=false`） | admin | 200 | **200** | data **6 键**（`UserRecord`，键集冻结 ✓） |
| T21 | 同上 + `evm` | admin | 400 | **400** | `LEDGER_AMOUNT_INVALID`、`reason=FORBIDDEN_FIELD`、`rule=DL16/DL104` ✓ |
| T22 | 同上 + `points` | admin | 400 | **400** | 同上（**余额类字段一律 400**，DL104）✓ |
| T23 | 同上 `uID=999999999` | admin | 404 | **404** | `LEDGER_REF_NOT_FOUND`、`ref_type=users` |
| T24 | `GET /api/user/all` | admin | 200 | **200** | 数组；元素 = **6 键**（见 §3.1 注） |
| T25 | `GET /api/user/all` | 普通 | **403** | **403** | `AUTH_FORBIDDEN` + `NOT_ADMIN` |
| T26 | `GET /api/user/stats` | admin | 200 | **200** | data **5 键**（`user_count,admin_count,asset_count,total_points,avg_points`）；`message` 含「**统计口径 = 账本派生**」✓ §1 #46；`user_count=6` |
| T27 | `GET /api/user` | 无 | **401** | **401** | `AUTH_UNAUTHORIZED`（**R107 形状对既有读口生效**，见 §4.2-3） |
| T28–T31 | `GET /api/home` · `/api/prize/all` · `/api/task/all` · `/api/market/1/orderbook` | 无 | 200 | **全 200** | 回归 ✓（`home` 5 键 / `prize/all` 12 行 / `task/all` 3 行 / orderbook `[]`） |
| T32 | `GET /api/prize/999999999` | 无 | 404 | **404** | detail-miss 语义保持 ✓ |
| T33–T37 | `POST /api/admin/prize/{create,update,delete}` · `/api/shard/redeem` · `/api/chest/1/open` | admin | 410 | **全 410** | **B2b 已落的 5 个 410 面未回归** ✓ |
| T38 | `POST /api/admin/task/create` | admin | 410 | **410** | B2a 面未回归 ✓ |
| T39 | `POST /api/admin/assets/init` | admin | 410 | **410**（改前 **500**） | 见 §4.2-1（本片补齐） |

> **§3.1 注（`/api/user/all` 的元素键）**：`http-results.json` 的 `data_keys` 对**数组**响应取出的是索引（`["0","1",…]`），故元素键另由 `body_head` 逐字读取：`{"uID":970001,"EVM":"0x970001…","bio":"p4b2:fixture user","is_admin":false,"time_reg":…,"time_login_last":…}` ⇒ **6 键**，**无任何 token/密钥列** ✓（§1 #45「只出非敏感列 + 禁 token」）。

### §3.2 权限面（判定链 `resolveAdminAccess` **实测**；§6.2 五步逐条）

| 步（§6.2） | 条件 | 本片读数 | 日志佐证（★ 派单硬口径 #4） |
|--:|---|---|---|
| 1 | 无 / 坏 token ⇒ 401 | **`AUTH_UNAUTHORIZED`**（T06 无 token；T07 坏签名） | **两条判读必须区分**：T06（**无** `Authorization` 头）在 `resolveActor` 第 1 行即 `return null` ⇒ **不触发任何 DB 调用、日志无记录**（真·缺凭证）；T07 对应日志 `[30/9/2026, 1:14:31 am] [ERR] Failed to resolve actor: Error: Invalid token signature` ⇒ **真·坏凭证**（`verifySignedToken` 抛错），**不是**服务端异常 |
| 2 | 有 actor 但 `can_access_admin=false` ⇒ 403 | **`AUTH_FORBIDDEN` + `reason=NOT_ADMIN`**（T05 / T19 / T25） | `requireAdmin` **无任何 `console.*`** ⇒ 这三条**在日志里 0 命中**（= 判读非服务端错误）；负样本即 T03（普通 token 调 `GET /api/admin/me` **200** —— 该端点只 `requireActor`，与 B2a-HTTP §2 同结论） |
| 3 | `is_admin=true` ⇒ 放行（**不再查 requiredPermission**） | **T02**：admin token ⇒ `permissions` = 11 键全量、`can_access_admin=true`、`preferred_admin_path=/dashboard/settings` | 无错误日志 ✓ |
| 4 | 否则必须命中 `requiredPermission`（数组 = OR） | 登录链**代码面**未改（`hasRequiredPermission` 原样）；**非 admin 经角色位放行**的一支 = `NOT_MEASURED` | — |

**★ 权限键逐键比对（派单必验②）**：`backend-ts/src/database.ts:11-23`（`ALL_ADMIN_PERMISSIONS`，**代码侧真源**）vs `frontend/src/admin-utils.js:40-52`（`fetchAdminAccess` 的兜底权限表）：

| # | 代码侧常量（11） | `admin-utils.js` 权限位（11） | 差异 |
|--:|---|---|---|
| 1–11 | `dashboard_access, manage_tasks, publish_tasks, manage_rewards, publish_prizes, read_users, manage_users, manage_points, manage_permissions, manage_settings, review_tasks` | **逐字同集、同序** | **0 处差异** ✓ |

补充对齐：`admin-utils.js:16-35` 读 `data.is_admin / data.permissions / data.can_access_admin / data.preferred_admin_path` ⇒ 正是 T02/T03 产出的 6 键（**故本片未改 `/api/admin/me` 的键集**，见 §1.3-1）；`admin-utils.js:66-74 hasAdminPermission` 的 `if (access.is_admin) return true` 与 §6.2 步 3（总开关）**同语义** ✓。
**登记（非缺陷）**：`admin-utils.js:3` 的硬编码 `ADMIN_ADDRESS` 即 §1.3-6 的第三真源（前端侧）；`admin_permission` 表 **0 行**（预期，批 6 种子）⇒ `requiredPermission` 的**库侧**取值集合未落库。

### §3.3 库侧：命名台账 + before/after 逐表计数差 + ★ 非资金不变量

**口径**：`neon()` HTTP 驱动；逐表**精确** `count(*)`（表名走 `format('%I')` + `query_to_xml`，**不做客户端标识符插值**；表不存在 ⇒ `-1`，**不填 0**）。`counts-before.json`（写入前）→ `counts-after.json`（39 条 HTTP 之后）。

| 表 | before | after | **Δ** | 说明 |
|---|--:|--:|--:|---|
| **`app_config`** | **0** | **1** | **+1** | 本片唯一新增业务行（T09）：`key='system_settings'`、`updated_by=970201`、`time_updated=2026-09-29T17:14:33Z`、`value.siteName='p4b2c:siteA'` |
| `users` | 4 | 6 | **+2** | 夹具 970201（admin）/ 970202（403 负对照） |
| `admin_role` / `admin_permission` / `admin_role_permission` / `admin_user_role` | **0** | **0** | **0** | **★ 本片禁插种子 ⇒ 四表恒 0 = 预期**（不是缺陷，也不是「空态被当成功」） |
| **`ledger_entry`** | **0** | **0** | **0 ★** | **增量 = 0**（`sum(amount)=0 → 0`）⇒ **零分录** |
| `account` | 4 | 4 | **0** | 行数不变 |
| `currency` | 1 | 1 | **0** | 行数不变 |
| `listing` / `listing_order` | 12 / 0 | 12 / 0 | **0 / 0** | B2b 夹具零改动 |
| `job` / `job_application` / `job_submission` | 3 / 3 / 2 | 3 / 3 / 2 | **0 / 0 / 0** | 零改动 |
| `market_order` / `market_trade` / `commission_policy` | 0 / 0 / 1 | 0 / 0 / 1 | **0 / 0 / 0** | 零改动 |

| 不变量 | before | after | 结论 |
|---|---|---|---|
| `ledger_entry` 行数 / `sum(amount)` | 0 / `"0"` | 0 / `"0"` | **增量 = 0** ✓ |
| `account` **全行 dump** `md5(string_agg(to_jsonb…))` | `ef5cf7f347cb25e5fdd852c83e0eb452` | **同值** | 逐行逐列零变化 ✓（最强口径：不依赖列名假设） |
| `currency` **全行 dump** `md5` | `77cde9630828a468a6bcc7a89843fe7d` | **同值** | 零变化 ✓ |
| 写入落点 | — | 仅 `app_config`(+1) / `users`(+2) | **只影响预期表** ✓ |

**命名台账（`LIKE '%p4b2c%'`，**包含**匹配以避免「起头匹配恒 0 = 假零」）**：`public."users"` bio 命中 = **4**（本片 2 + B2b 遗留 2；`counts-after.json:namespace`）；`app_config` 键命中 = **0**（本片写入的键是 `system_settings`，命名空间落在 `value` 内）⇒ 逐行 dump 见上表。**无删除**：本片探针只执行 `INSERT` / `SELECT`（**零 `DELETE`/`TRUNCATE`/`DROP`**）。

### §3.4 键集冻结（§2 母约束 F1）

**口径自曝**：本读数是**静态源码口径**（三版本函数体 sha256 + 返回对象键名提取，`p4z-b2c-04-keys.ts`），**不是** B1 系列的运行时内存夹具口径。其不变量成立的理由：这 5 个函数是 §2.1 表所列端点键集的**唯一来源**；其中 4 个本片**未触碰** ⇒ 逐字相等即键集相等。

| 目标（→ 端点） | HEAD | 改动前（`orig/`） | 改动后 | 判定 |
|---|---|---|---|---|
| `normalizeUser`（`/api/user`、`/api/user/all`、`/api/admin/user/update`、`/api/admin/me`） | 同 sha | 同 sha | **同 sha** | **未触碰**（键集 6：`uID,EVM,bio,is_admin,time_reg,time_login_last`）✓ |
| `normalizeSystemSettings`（`GET/POST /api/admin/settings`） | 同 sha | 同 sha | **同 sha** | **未触碰**（9 键）✓ |
| `normalizePermissionGroup`（`GET /api/admin/permissions`） | 同 sha | 同 sha | **同 sha** | **未触碰**（8 键：`id,name,description,permissions,user_ids,readonly,time_created,time_updated`）✓ |
| `getUserStats`（`GET /api/user/stats`） | 同 sha | 同 sha | **同 sha** | **未触碰**（5 键）✓ |
| `buildAdminAccess`（`/api/admin/me`） | — | — | **返回键名集合逐字相等** | 本片改了签名 + 一行判定（`hasRoleRow`），**返回键集不变**（6 键）✓ |

**`all_key_sets_equal: true`**（`keys-results.json`）。**逐端点的 HTTP 侧复核**（§3.1）：T04/T09/T10 = 9 键、T02/T03 = 6 键、T15 = `{groups,users}`、T20 = 6 键、T24 元素 = 6 键、T26 = 5 键、T28 = 5 键 —— 与 §2.1 表逐条一致。

### §3.5 静态及其它判据

| 判据 | 读数 |
|---|---|
| `tsc --noEmit` | **`TSC_EXIT=0`**（`tsc.out` **0 字节**）—— 在 admin-service 新增 + database 6 处 + index 13 处之后实测 |
| 端点注册点 | **51**（补丁器断言 + `grep -cE` 独立复算，两次一致） |
| 服务重启 | 面板单服务路由 `POST :5555/api/restart {"sid":"seafood-api"}` ⇒ `{ok:true,state:"running",pid:60095}`；`/health` **首次探测即 200** ✓（本片共重启 2 次：补丁后、`assets/init` 补齐后） |
| `deprecated:true` 实况 | 现 **2 处**（`index.ts:604` shard、`:619` shard/transfer）—— `admin/permissions` 的**已撤销** ✓（§5.3 要求的第 3 处已消；另 1 处命中是 `:46` 的注释文字） |
| 旧 `permission_group` 引用 | **SQL 引用 = 0**（`grep -cE 'FROM|INTO|UPDATE|DELETE FROM permission_group' src/database.ts` ⇒ **0**）；`grep -n permission_group src/*.ts` ⇒ **3 处，全为注释文字**（`database.ts:1820/1942/1948`）—— **双口径**：代码面 0 引用 + 库面该表**已 DROP**（`0017` 注释「B7：旧表已 DROP」） |
| `public.` 限定（DL151） | `public.app_config` **2 处**、`public.admin_role*` **12 处**（补丁器断言） |
| JWT 不落盘 | `grep -rc 'e[y]J' src/*.ts` ⇒ **全 0**；`grep -rl 'e[y]J' .p4-artifacts/<run>/` ⇒ **0 文件**（token 只以 `sha256…slice(12)` 指纹入盘） |
| 「零资金」代码面 | `admin-service.ts` 只 import `./database`（值）与 `./job-service`（**type-only**）⇒ `grep -cE "from '\./(ledger|commission)'"` = **0** |

---

## §4 `NOT_MEASURED`（**禁填 0/空**）与探针自曝

### §4.1 未测项（逐条给「为什么没测」）

1. **权限写口的「成功落行」路径**（`POST /api/admin/permissions/save` 的 200）：**结构不可达** —— `admin_permission` 0 行且本片**禁插种子** ⇒ `admin_role_permission.permission_key` 的 **FK 必拒**（§1.3-5）。实测只能到 `404`（T17）。⇒ **`NOT_MEASURED`**（不填 0；**不是**「已通过」）。
2. **`POST /api/admin/permissions/delete` 的 `'deleted'` 与 `'in_use'` 两支**：无 `admin_role` 行 ⇒ 只能实测 `'not_found'`（T18）；`'in_use'`（§4.1 #40 的核心守卫）与 `'deleted'`（含 3 条 `DELETE` 的事务）**未实测** ⇒ **`NOT_MEASURED`**。
3. **§4.1 #39 自锁守卫的触发支**：守卫条件含 `!actorIsAdmin` ⇒ 用 `is_admin=true` 的夹具**永远命中不到**；而造「非 `is_admin` 但有 `manage_permissions` 的管理员」**必须**写 `admin_user_role` ⇒ 被硬口径 #3 禁止。⇒ **`NOT_MEASURED`**（仅有读码与分支存在性）。
4. **`admin_user_role` 那支的 `can_access_admin`**（§6.1 第二支，即「非 `is_admin` 的角色管理员」）：同上被禁种子阻断 ⇒ **`NOT_MEASURED`**。已实测的只有 `is_admin` 总开关支（T02）与「两者皆无」支（T05/T19/T25 的 403）。
5. **`admin_role_permission` 的权限位过滤行为**：`normalizePermissionGroup` 会把不在 `ALL_ADMIN_PERMISSIONS` 里的键**静默丢弃**（值级过滤，键集不变）。因 0 行 ⇒ **`NOT_MEASURED`**。
6. **`updated_by` 的语义面**：`DL71` 明写「`updated_by` **不加 FK**」且「平台/系统写者 uid 可能不在 users」。本片写入的是真实 actor uid（970201），**但**「uid=0（平台写者）是否被接受」与「写入不存在 uid 是否被拒」——**`NOT_MEASURED`**（前者未试，后者**结构上不会被拒**，因无 FK）。
7. **`app_config` 的 `app_config_value_is_container` CHECK**：本片只写 JSON object ⇒ 「标量被拒」支 **`NOT_MEASURED`**。
8. **并发/竞态**：`savePermissionGroup` 的单事务、`replaceUserRoles` 的「清后插」在并发同 uid 下的竞态 —— **未测**（本单为串行实测）。
9. **`/api/admin/points/adjust`**（:995 live）：资金面 ⇒ 批 3，**本片不测不实现**。
10. **HTTP 探针的 `data_keys` 对数组响应取索引**（`["0","1",…]`）⇒ 数组元素键改用 `body_head` 逐字读取（§3.1 注）；这是**探针口径缺陷**，已在读数里更正，非服务端问题。

### §4.2 与 spec 的口径妥协 / 需 Zang 复核的裁定（登记）

1. **`POST /api/admin/assets/init` ⇒ 410（本片补齐，越出「权限与设置」名义范围）**：初稿把它登记为「已由 B2a/B2b 落 410」—— **实测证否**（T39 首跑 **500**，日志逐字 `[30/9/2026, 1:13:47 am] [ERR] Asset initialization error: NeonDbError: relation "asset" does not exist`）。§1 #50 / §5.1 明标「批 2 起一律 410」，而 B2b 报告已把它**转派**（"归同批其它片"）⇒ 无人认领。本片按 §1 的抽取口径（`/api/admin/*` 行）**补齐**：撤 `requireAdmin` 前置、`R107` + 登记过期日，**未新增/未删任何注册点**（仍 51）。⇒ **请 Zang 确认该补齐是否算越界**。
2. **`ops:` 幂等键的实现形态（§1.3-2/§1.3-3 的落地）**：本片实现为**请求侧强校验**（`body.create_key` / `body.idempotency_key` / `Idempotency-Key` 头；`ops:` 前缀；缺失 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`，T08/T16），**不落库**（四表**无幂等键列**，逐列契约冻结）；**也不实现「同键重放」**（无指纹列可比）⇒ 键在这里是**形状契约**而非重放机制。**副作用**：冻结的旧前端（`admin/SystemSettings.jsx:84-88`、`PermissionsManagement.jsx:89-98/132-135`、`UsersManagement.jsx:103-107`）**不带键** ⇒ 这 3 页 4 个写口对旧前端会 `400`。**§5.2 未列该前端同步项** ⇒ 登记为**必做前端同步**（本片禁改 `frontend/**`）。
3. **401/403 改为 R107 形状是「跨 51 端点」的改动**：`requireActor`/`requireAdmin` 的响应体由 `{success:false,message,error}` 改为 `{error:{code,message,i18n_key,details}}` ⇒ 所有需鉴权端点的 401/403 形状变化（T27 是 `/api/user` 的例）。依据：`DL105`（v0.2 C4/C6）/`DL122`/`DL147`/§3.3-6/§6.2 + 派单硬口径 #5。**连带前端同步**：`frontend/src/auth.js:105` 读 `payload?.message \|\| payload?.error` ⇒ R107 下 `payload.error` 是**对象** ⇒ 提示文案会退化成 `[object Object]`；`frontend/src/locales/{zh,en,hk,vn}.json` 需按 §3.3-6 各加 `auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`。⇒ 登记为**必做前端同步**（本片禁改 `frontend/**`）。
4. **`GET /api/admin/permissions` 撤掉 3 个内置合成组**（`admin_access`/`task_publishers`/`prize_publishers`）：§1 #35 的唯一数据源 = `admin_role*` ⇒ 合成的「内置组」不再是角色定义（`DL72`：旧 `permission_group` **不复用**）。结果：`groups` 现为**纯 `admin_role` 投影**（0 行 ⇒ `[]`）。⇒ 登记待 Zang（**值级变化、键集不变**）。
5. **`GET /api/admin/me` 未按 §6.4 改成 4 键形状**（§1.3-1 的裁定落地）：取 §2 母约束 F1 优先，保留 `AdminAccessRecord` 6 键。`§6.4` 的 `{uid, evm, is_admin, permissions[]}` 与其 `permissions[] = admin_role_permission ⋈ admin_user_role` 的**语义**已满足（T02/T03，`is_admin=true` 走全权限、不回空数组 ✓）。⇒ 登记待 Zang。
6. **`DL38`「查询层不得继续引用旧 `database.ts`」的两种读法**：本片取**「旧引用数 = 0」**读法（SQL 层零 `permission_group` 引用、`app_config` 全部显式 `public.`），而**未**把 SQL 迁出 `DatabaseService`（与 B2b 先例一致）。⇒ 登记待 Zang。
7. **费率键黑名单**：`FEE_RATE_KEY_PATTERNS`（`/fee_?rate/i`、`/rate_?bp/i`、`/commission_?rate/i`、`/commission_?policy/i`、`/费率/`、`/佣金/`）是**本片自拟**（spec 只写「禁写费率键」，未给键名集合）⇒ 极小集，且**不删历史键**（§4.1 #36「保留但标注不参与计费」）⇒ 登记。
8. **`requirements` 键（§6.4 的 `permissions[]` 语义）与 `requiredPermission` 的库侧来源**：`admin_permission` 0 行 ⇒ `requiredPermission` 的库侧取值集合**未落库**（`§6.4` 登记缺口 / 未决 §7-8）。本片的对齐口径 = **代码侧常量**（§3.2，11 键与前端 0 差异）。⇒ 登记。

### §4.3 探针自曝（§5.7④ 读数异常先怀疑自己的口径）

1. **补丁器首跑失败 2 次，均为探针自身缺陷**：① `DB6` 的 end 标记落在 start 标记**内部** ⇒ "end marker NOT FOUND"；② `IX1`/`IX7` 是**单行替换**（start == end）⇒ 同上。修法 = 把 `indexOf(end, start+start.length)` 改为 `indexOf(end, start)` + 把 DB6 的 start 收成单行。两次都**发生在写盘之前**（`applySpans` 先全量校验后写），**未污染任何读数**。
2. **`T39` 首跑 500 一度被我写成「已由 B2a/B2b 落 410」**（§1.2 初稿）⇒ 实测证否，已更正并把该面**补齐**（§4.2-1）。这正是「读数异常先怀疑自己的口径」的反向用例：**登记先于实测的结论必须先实测**。
3. **`.query` API 误用**：`@neondatabase/serverless` 的 `neon()` 在本仓版本**没有** `.query` 方法（只有 tag 模板 + `.transaction`）⇒ 探针首版 TS 报 12 条错；改为 tag 模板 + `format('%I')`/`query_to_xml` 实现**精确逐表计数**（避免动态标识符插值）。**纯探针缺陷**。
4. **`grep -c ERR` = 1 的假读数**：日志产物是**单行 JSON** ⇒ `grep -c`（按行计数）恒为 1；改用 `grep -o` + `split('\n')` 后取到 199 条。⇒ 报数口径已在 §3.2 更正（按**条目**而非行）。
5. **时间口径**：产物 `generated_at` = **UTC**；本报告正文 = CST（UTC+8）。日志时间戳为**本机本地时间**（`[30/9/2026, 1:13:28 am]`）。
6. **本片未 kill 任何进程**、未用 `pkill -f`/`killall`；重启只走面板 `{sid}` 单服务路由（2 次）。

---

## §5 产物清单（run = `b2c-20260930T010620`，绝对路径 `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b2c-20260930T010620/`）

| 产物 | 内容 |
|---|---|
| `counts-before.json` | 逐表精确计数（17 表）+ `account`/`currency` 全行 dump md5 + `ledger_entry` 计数/合计 + 命名空间读数 |
| `counts-after.json` | 同上（含 `app_config` 的**逐行 dump**：`key/value/updated_by/time_updated`） |
| `fixture-ledger.json` | 夹具台账 `{970201: is_admin=true, 970202: is_admin=false}`（**只 INSERT**） |
| `http-results.json` | 39 条端点矩阵（status / `data_keys` / `error_code` / `error_reason` / `message` / `body_head` / token **指纹**） |
| `keys-results.json` | §3.4 三版本 × 5 函数 的 sha + 返回键名 + `all_key_sets_equal` |
| `patch-log.json` | 逐条补丁命中/增删字节数 + `bytes_before/after` + `routes` + 断言块 |
| `database.HEAD.ts` · `orig/src_database.ts.orig` · `orig/src_index.ts.orig` | 三版本原文（`git show HEAD:` + 改动前工作树） |
| `server-logs-tail.txt` | §3.2/§4.2-1 的日志逐字佐证（`Invalid token signature` 于 **1:13:28 / 1:14:31**；`Asset initialization error: relation "asset" does not exist` 于 **1:13:47**） |
| `before.out` · `http.out` · `after.out` · `tsc.out` · `keys.out` · `patch.out` | 各步 stdout/退出码取证（`tsc.out` = 0 字节） |
| 探针 | `/Users/kevin/bistro/seafood/backend-ts/scripts/p4z-b2c-0{1,2,4}-*.ts` |

---

## §6 边界与纪律声明（逐字）

- **允许面内**改动：`backend-ts/src/{database.ts, index.ts, admin-service.ts(新)}`、本报告、`backend-ts/.p4-artifacts/b2c-20260930T010620/**`、`backend-ts/scripts/p4z-b2c-0{1,2,4}-*.ts`。
- **未**改：`backend-ts/migrations/**`（**零改动**）、`src/ledger-errors.ts`（冻结）、`src/ledger.ts`、`src/commission.ts`、`src/job-service.ts`、`src/db.ts`、`frontend/**`、`backend-ts/.env.local`、`p4z-01-probe.ts`、既有脚本/artifact、`docs/route-layer.spec.md`（只读）、其它 spec/versions/qa/audit 既有件、`docs/seafood.master-plan.md`。
- **未**做：`git add/commit/push`；**删除型 SQL**（探针只 `INSERT`/`SELECT`；`savePermissionGroup`/`deletePermissionGroup`/`replaceUserRoles` 里的 `DELETE` 是**端点语义**（§6.3 明许），且在**当前库态下不可达** —— 实测 T17/T18 均在 `404` 前返回）；**任何向 `admin_permission`/`admin_role*` 写种子的语句**（四表 **0 → 0**，§3.3）；任何**带分录**的资金动作（`ledger_entry` **0 → 0**）；跑写库套件；`npm install`；`execute_code`；连接串/密钥落盘（`grep 'e[y]J'` = 0）；`pkill -f`/`killall`（**未 kill 任何进程**）。
- **库写**：仅 `INSERT`——`users` +2（970201/970202）、`app_config` +1（`key='system_settings'`）；夹具与写入行**全部保留**（**零删除**）。服务重启仅走面板单服务路由 `sid=seafood-api`（2 次）。
- **待裁/风险（交 Zang）**：§4.2-1（`assets/init` 补齐是否越界）、§4.2-2（`ops:` 键的形态 + 3 处前端写口必须补键）、§4.2-3（401/403 形状的跨端点影响 + 前端 `auth.js:105` 与四语 locale 同步）、§4.2-4（撤 3 个合成组）、§4.2-5（`/api/admin/me` 未改 4 键形状）、§4.2-6（`DL38` 的落点读法）、§4.2-7（费率键黑名单为自拟）、§1.3-6（`isAdminAddress` 第三真源：**与种子同批收敛**）、§4.1-1/2/3/4（权限写口四处 `NOT_MEASURED`）。
- **预算自曝**：本单约 **34** 次工具调用（派单给 40），其中 **4 次**是补丁器/探针自身缺陷的定位与修复（§4.3-1/3），**1 次**是 `assets/init` 缺口的发现与补齐（§4.2-1）。

---
