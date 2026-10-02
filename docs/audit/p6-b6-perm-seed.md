# P6-B6-PERM · 批 6 权限面：权限种子迁移 `0022` + `isAdminAddress` 收敛

- 单子：**BE-PERM / 批 6 权限面**（承接 `docs/route-layer.spec.md` §6.5「顺序依赖」+ 主计划 §5.77）
- 执行：Kong（subagent，profile `zang`）
- **★ 本单未 apply 到真库**（§5.7①）：只做 `--dry-run` 重放 + **事务内预演 + ROLLBACK**（净零写）。迁移落地由 **Zang** 执行。
- 结论：**三件全交付、七项 AC 全绿**；`isAdminAddress` 第三真源**已删除**且**未锁死任何管理员**（实测 uid 1 仍 200；原地址持有人收敛后 403，但**种子预演**下即恢复 `can_access_admin=true`）。

---

## §1 取证（先只读；逐项 `文件:行号`，行号本单现取）

### 1.1 权限键真源（三处，逐键）

| # | 真源 | 位置 | 键数 | 逐键 |
|---|------|------|------|------|
| 1 | 后端常量 `ALL_ADMIN_PERMISSIONS` | `backend-ts/src/database.ts:11-23`（数组字面量；键 = `:12-22`） | **11** | `dashboard_access, manage_tasks, publish_tasks, manage_rewards, publish_prizes, read_users, manage_users, manage_points, manage_permissions, manage_settings, review_tasks` |
| 2 | 前端 `admin-utils.js` 兜底数组 | `frontend/src/admin-utils.js:40-52` | **11** | **与上逐键同序 0 差异** |
| 3 | 迁移面（本单新增） | `backend-ts/migrations/0022_admin_permission_seed.sql` §① | **11** | **与上逐键 0 差异** |

- 后端常量**消费点**：`src/database.ts:646`（`normalizePermissionGroup` 的键过滤）＋ `src/database.ts:3718`（`buildAdminAccess`：`is_admin=true` ⇒ `[...ALL_ADMIN_PERMISSIONS]` 全量 11 键，不回空数组）。
- 三真源**逐键相等**（机器判据，非肉眼）：见 §5 AC④ 读数 `all_three_equal=true`。

### 1.2 角色 / 表种子面（DDL 取证 = `information_schema`，非 API 载荷）

| 对象 | 建表位置（`0017` 只建表不插种子） | 现库行数（只读实测） |
|------|-----------------------------------|----------------------|
| `public.admin_permission` | `migrations/0017_platform_config.sql:103-110` | **0** |
| `public.admin_role` | `migrations/0017_platform_config.sql:93-101` | **0** |
| `public.admin_role_permission` | `migrations/0017_platform_config.sql:112-121` | **0** |
| `public.admin_user_role` | `migrations/0017_platform_config.sql:123-132` | **0** |

- 列结构实测：`admin_permission(permission_key text NOT NULL, name text NULL)`；`admin_role(role_key text NOT NULL, name text NULL, time_created timestamptz NOT NULL)` —— 与 `0017` 逐列一致。
- 迁移面实测：`schema_migration` **20 行**（末 = `0021`）、基表 **23**、非内部触发器 **43**、`app_config` **1 行**。

### 1.3 `isAdminAddress` 第三真源（收敛前）

| 位置 | 内容 |
|------|------|
| `backend-ts/src/auth.ts:35`（原） | `const DEFAULT_ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'` |
| `backend-ts/src/auth.ts:36-44`（原） | `ADMIN_EVM_ADDRESSES = Set(DEFAULT_ADMIN_ADDRESS, ...env ADMIN_EVM_ADDRESSES)` |
| `backend-ts/src/auth.ts:136-139`（原） | `export const isAdminAddress(evm)` |
| `backend-ts/src/index.ts:13`（原） | import `isAdminAddress` |
| `backend-ts/src/index.ts:239`（原） | `resolveAdminAccess(user, isAdminAddress(user.EVM))` |
| `backend-ts/src/database.ts:2591 / 2596`（原） | `bypass = user.is_admin \|\| isAdminAddress`；透传进 `buildAdminAccess` |
| `backend-ts/src/database.ts:3714`（原） | `const isAdmin = user.is_admin \|\| isAdminAddress` |
| `frontend/src/admin-utils.js:3`、`:12` | 同款地址常量 + `evm === ADMIN_ADDRESS` 支路（**本单未动 `frontend/**`**，见 §7） |

**地址命中实测（只读）**：`0x59f9…09b0` 在 `users` 中命中 **uid `970213`**，且 **`is_admin = false`**
⇒ 收敛前它**完全依赖** `isAdminAddress` 才拿到 admin（这正是 §6.5 的「锁死运营管理员」风险点）。

**其他 `users.is_admin = true` 的账号**（只读实测）：uid **1**、**10**、**970201**（共 3 个）。

> 种子应包含什么（真值表，**以现取为准**）：① `admin_permission` × 11 键（= §1.1 第 1 列）；② 至少 1 个角色承载这 11 键；③ 原第三真源地址持有人 → 该角色的绑定（否则收敛即锁死 uid 970213）。本单 `0022` 即按此三步落。

---

## §2 交付物

| 文件 | 状态 | 说明 |
|------|------|------|
| `backend-ts/migrations/0022_admin_permission_seed.sql` | **新增** | 权限/角色种子（纯 DML，幂等） |
| `backend-ts/scripts/p4z-b6perm-00-probe.ts` | **新增** | 只读探针（零写入） |
| `backend-ts/scripts/p4z-b6perm-01-verify.ts` | **新增** | 验收探针（三真源 / 事务内预演 / HTTP / 账本） |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts` | 改（仅同步键） | `VERSION_ORDER` + 期望行数 |
| `backend-ts/src/database.ts` | 改（收敛最小面） | 去第三真源参数/分支 |
| `backend-ts/src/index.ts` | 改（收敛最小面） | 去 import + 改调用 |
| `backend-ts/src/auth.ts` | 改（收敛最小面） | 删地址常量集 + `isAdminAddress()` |
| `frontend/**`、`migrations/0001..0021`、`docs/seafood.master-plan.md`、spec、`vercel.json`、`.env*` | **未动** | 硬边界 |

---

## §3 迁移 `0022` 内容与幂等

- §① `admin_permission` **11 行**（`permission_key` = §1.1 逐键；`name` = **展示名**，属工程提供、非规格派生 —— `DL72` 逐列 `name text` 可空，**契约是键集**）→ `ON CONFLICT (permission_key) DO NOTHING`
- §② `admin_role` **1 行** `super_admin` → `ON CONFLICT (role_key) DO NOTHING`
- §③ `admin_role_permission` `super_admin` × 11 键（**显式 VALUES**，受 FK 兜底）→ `ON CONFLICT (role_key, permission_key) DO NOTHING`
- §④ `admin_user_role`：`INSERT … SELECT u.uid FROM public.users u WHERE lower(u.evm) = '<原 DEFAULT_ADMIN_ADDRESS>'` → `super_admin`，`ON CONFLICT (uid, role_key) DO NOTHING`
  ⇒ **按库内匹配**（非硬编码 uid）：真库命中 1 行；**重建库 `users` 为空 ⇒ 0 行**，天然幂等
- §E apply-time 自检：11 键**逐键在场且无多余键** / `super_admin` 在场 / 角色权限 = 11 / 无悬挂 `role_key` / **基表 23、触发器 43 未变**（DML-only 反断言）/ 无新增 `ledger*` 表
- **幂等**：全部 `ON CONFLICT DO NOTHING`，重复应用读数一致（预演实测：连跑读数不变，见 §5③）
- 硬边界已守：不改 `0001–0021` 任何字节；不建表/列/约束/索引/函数/触发器；不碰账本；无 `BEGIN/COMMIT`；无动态 DDL

---

## §4 `isAdminAddress` 收敛（单一真源 = `users.is_admin` OR ∃`admin_user_role`）

**改了什么**（4 处，均为最小面）：
1. `src/database.ts:2588` `resolveAdminAccess(user: UserRecord)` —— 去掉 `isAdminAddress` 形参，`const bypass = user.is_admin;`
2. `src/database.ts:3709/3716` `buildAdminAccess(user, extraPermissions, hasRoleRow)` —— 去形参，`const isAdmin = user.is_admin;`
3. `src/index.ts:13` 去 import；`src/index.ts:238` `resolveAdminAccess(user)`
4. `src/auth.ts` 删 `DEFAULT_ADMIN_ADDRESS`/`ADMIN_EVM_ADDRESSES`（原 `:35-44`）与 `isAdminAddress()`（原 `:136-139`）→ 该模块**不再持有任何管理员地址真源**；地址下沉为迁移种子（`0022` §④）

### 为何**不**锁死管理员（论证 + 实测）

1. **DB 侧总开关不变**：uid 1 / 10 / 970201 的 `users.is_admin = true` ⇒ 永不依赖地址支路。
   → 实测：uid 1 `GET /api/admin/settings` = **200**、`GET /api/admin/me` = **200**（`is_admin=true` + **11 键全量**）。
2. **原地址持有人（uid 970213，`is_admin=false`）**：收敛**后**单独看会 403（实测 **403 / NOT_ADMIN**）—— 这是**预期**，因为 `0022` 尚未落地。
   → 但**同批**的种子一旦 apply，它即由**角色行**重新拿到 `can_access_admin`：
   实测（`0022` 全文在**单事务内预演 + ROLLBACK**）：
   ```
   uid 970213 → is_admin=false, can_access_admin=TRUE（经 admin_user_role → super_admin，11 键）
   uid 1      → can_access_admin=TRUE（总开关）
   uid 2      → can_access_admin=FALSE（既无总开关也无角色行）
   ```
3. **顺序依赖闭合**：`0022`（种子）与本次收敛**同批交付**；apply 顺序 = **先 `0022`、后部署收敛后的代码**（§6.5 原文口径）。
4. **重建面安全**：`0022` 在迁移链内 ⇒ `p3x` 重建重放后权限面**不空**（预演实测 `admin_permission=11 / admin_role=1 / admin_role_permission=11`）。

> 诚实边界：收敛**删除了** env `ADMIN_EVM_ADDRESSES` 这条运维旁路 —— 今后新增管理员**只能**走 `users.is_admin` 或 `admin_user_role`（DL72 单一真源）；这是**有意的行为变更**，非回归。

---

## §5 AC 读数（本单自跑）

| # | 判据 | 命令 | 读数 |
|---|------|------|------|
| ① | `tsc` 干净 | `npx tsc --noEmit` | **0 行输出，`TSC_EXIT=0`** |
| ② | 离线套件不掉 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **`total=126 passed=126 failed=0`，`OFFLINE_EXIT=0`**（基线 121 ⇒ 现 126，全绿） |
| ③ | `0022` dry-run / 重放校验 | `npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run` | **`P3X_EXIT=0`**；`version_order_ok=true`（链尾 = `['0020','0021','0022']`）；`D_pass=true`；`object_diffs=[]`；`terminal_total=32 / terminal_ok=31 / terminal_failed=[]`（1 项为设计内 `NOT_MEASURED`：`currency.supply_cap=NULL`）；`F_net_zero.identical=true`；事务内实测 `admin_permission=11 / admin_role=1 / admin_role_permission=11 / admin_user_role=0 / schema_migration=21` |
| ④ | 权限键三真源逐键相等 | `p4z-b6perm-01-verify.ts` §A | 后端 11 ↔ 前端 11 ↔ `0022` 11，**`all_three_equal=true`**；角色种子 `super_admin`，`role_permission=11` 全 `super_admin` |
| ⑤ | 账本零位移 | 同上 §C | `ledger_entry` **267 → 267**；`Σ(account.balance, cid=1)` **1989693 → 1989693** ⇒ `C_ledger_zero_drift=true` |
| ⑥ | 注册点不变 | `grep -cE '^app\.(get\|post\|patch\|delete\|put)\(' src/index.ts` | **67 → 67** |
| ⑦ | 行号现取 | 本报告全部行号 | 均取自本单的 `read_file` / `patch` 回执 |

**收敛实测（HTTP，服务经面板单路重启加载新代码）**：

| 身份 | 端点 | 期望 | 实测 |
|------|------|------|------|
| 真 admin uid 1（`is_admin=true`） | `GET /api/admin/settings` | 200 | **200**（`siteName=p4b2c:siteA`） |
| 真 admin uid 1 | `GET /api/admin/me` | 200 | **200**（`is_admin=true`、`permissions` = 11 键全量） |
| 非 admin uid 2 | `GET /api/admin/settings` | 403 | **403 `AUTH_FORBIDDEN` / `reason=NOT_ADMIN`** |
| 无 token | `GET /api/admin/settings` | 401 | **401 `AUTH_UNAUTHORIZED`**（R107 形状） |
| 原地址持有人 uid 970213 | `GET /api/admin/settings` | 收敛前 200 → 收敛后 403 | **200 → 403**（证明第三真源**确已移除**） |

`VERIFY_PASS=true`（`VERIFY_EXIT=0`）。

**净零写证据**：`0022` 预演前后（事务外）四表行数 `{admin_role:0, admin_permission:0, admin_role_permission:0, admin_user_role:0}` **不变** ⇒ `B_net_zero=true`。

> ⚠️ `p3x --dry-run` 的 `gate.ok=false`，**唯一原因**是 `checksums_not_all_byte_equal（file_steps=21/21）`：`0022` **尚未入库**（`schema_migration` 无其行 ⇒ registry checksum = null，该闸判 null≠true）。这是**未 apply 的必然结果**，非缺陷；脚本出口码取 `D_pass && F_net_zero` ⇒ `exit 0`。Zang apply `0022` 后此闸即转 true。

---

## §6 纪律 / 边界自检

- ✅ **未 apply 到真库**：全程零 DDL/DML 落库；`0022` 只在事务内预演并 `ROLLBACK`；探针只 `SELECT`/`information_schema`。
- ✅ 未 `git add/commit/push`；未 `npm install`；未 `vercel`；未 `pkill/killall`；未读/打印任何密钥或 `.env*` 值（探针只把 env 读进 `process.env`，**从不打印**）。
- ✅ 未向真库写入任何测试数据；未起停常驻服务（仅**单路** `POST :5555/api/restart {sid:'seafood-api'}`）。
- ✅ 结构存在性取证走 **DDL / `information_schema` / `pg_trigger` / `pg_proc`**，未采信 API 载荷。
- ✅ 未改 `0001–0021`、`frontend/**`、`docs/seafood.master-plan.md`、spec、`vercel.json`、`.env*`。
- ⚠️ 预算：本单 **46 calls**（基线 45）—— 超出 1 call（`p3x` 因 700s 超上限被提升为后台进程，多耗 1 次轮询）。**无未完项**。

---

## §7 待 Zang 的动作 / NOT_MEASURED

**apply 步骤（Zang 亲执行，顺序不可颠倒）**：
1. `npx ts-node --transpile-only scripts/migrate.ts` → 应用 `0022`（幂等；自检不过则整迁移回滚）
2. 解冻/部署**收敛后**的 `src/`（本单已改）并重启 `seafood-api`
3. 复核：`admin_permission=11 / admin_role=1 / admin_role_permission=11 / admin_user_role=1`（uid 970213）

**NOT_MEASURED（本单结构性不可测，逐条登记）**：
- `0022` 在**真库**的 apply 后终态读数（本单禁 apply）⇒ 只有**事务内预演**读数（§5③）。
- 收敛后**全站** admin 端点回归面（本单只跑 `GET /api/admin/settings` 与 `/api/admin/me` 两个代表端点 + 401/403 负例）。
- 前端 `frontend/src/admin-utils.js:3,12` 的**同款地址支路未收敛**（`frontend/**` 禁写）：现网表现 = 后端 403 而前端 `isAdminUser()` 仍可能**误判**为 admin（仅影响 UI 显隐，后端已 403 兜底）。**若需一并收敛 ⇒ 停下报回，由 Zang 另派**。

**遗留小差异（不谎报）**：`scripts/p3x-00-rebuild-replay.ts:8` 的文件头注释仍写「重放 0001..0020（0018 缺）」，未随 `0022` 更新（未改以免扩大 diff；`VERSION_ORDER`/期望行数已同步为真值）。

**本单未触碰**：`frontend/index.html`、`frontend/package.json`、`frontend/package-lock.json`、`frontend/src/styles.css`、`frontend/vite.config.js`、`frontend/scripts/p4z-feperf-*.mjs` 的 `git` 变更**非本单产生**（并行单元遗留），本单只改了 §2 列出的 4 个后端文件 + 3 个新增文件。
