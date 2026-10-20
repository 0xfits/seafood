# SPEC-NOTE · 管理员编辑他人商品（详情页入口 ＋ 编辑页提示 ＋ 编辑台账）

- **单号**：`JING-SPEC-ADMIN-EDIT`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 写、零库写、零测试改动、不 push**；后端实现单（授权扩展 + 读口 + `admin` 块 + 审计写 + 迁移 `0059`）与前端实现单（入口 / 提示 / 预填取数源）**并行在跑**。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = 5310a72`（工作区干净）
- **正典**：`docs/route-layer.spec.md` **§49.15**（v2.44 · 新路由 ⇒ 升版，头注不改写）+ `docs/data-layer.spec.md` **§40.11**（v0.41 · 新表 ⇒ 升版，头注不改写）+ `docs/design/design-system.spec.md` **§26.16**（加性续登、不升版）+ `docs/seafood.master-plan.md` **§5.443 / 版本行 v0.360**

## 1. Kevin 依据

> **Kevin 2026-10-20**：「**管理员（如 `09b0`）可以编辑他人发布的商品**」。
> **实现口径（派单给定 · 逐字转述）**：写口 `PATCH /api/listing/:listingId` 字段支 —— 本人照旧不写日志；**非本人但 `can_access_admin ∧ (is_admin ∨ permissions ∋ manage_rewards)` ⇒ 放行**并写 `listing_edit_log`（`listing_id` / `actor_uid` / `owner_uid` / `admin_edit` / `changed_fields` / `time_created`）；否则 **403 `ACTOR_NOT_ALLOWED`**；**所有字段校验与 DL60 不变**。新读口 `GET /api/listing/:listingId/edit`：本人或管理员可读，返回与 `mine` 同族 **11 键**，注册点 **110 → 111**。`/api/user` 载荷加性 `admin: { can_access_admin, is_admin, permissions[] }`。前端：详情页对本人 / 管理员显示【编辑】（管理员编辑他人时界面标「管理员编辑」一类提示）；编辑页预填统一走新读口。

**出处披露（诚实）**：Kevin 原话转引自本单派单，**原始会话未入仓** ⇒ 不伪造逐字引语；与 Kevin 原话若有出入，以 Kevin 一句话为准。

## 2. 冻结口径（按面拆）

### 2.1 接口面（route §49.15 · 零新错误码 · 一条新路由）

| 项 | 值 |
|---|---|
| 管理员判定（单一真源） | `canEditAny = adminAccess.can_access_admin === true ∧ (adminAccess.is_admin === true ∨ permissions.includes('manage_rewards'))`；`adminAccess` 一律取 token 侧 `actor.adminAccess`，**客户端不得声明** |
| 写口 | `PATCH /api/listing/:listingId` **字段支**授权扩展；闸位置**只在既有 DB 语句**（`cur.seller_uid <> $2` ⇒ `not_owner`）扩一个布尔参数，**禁止路由层另写归属判定** |
| 写口不变面 | `LISTING_EDIT_FIELDS` **6 项**（`description`/`price`/`stock`/`media_urls`/`item_type`/`item_condition`）· `title` 带值 400 `NOT_SUPPORTED` · `NO_EDITABLE_FIELD` / `BOTH_MODES` / 闭集闸 / URL 闸 / 张数闸 · **DL60**（`stock` 仅 `listed`）· 翻译只在 `description` 实变时重置 · 回执 11 键 |
| 读口 | `GET /api/listing/:listingId/edit`（两段路径，与 `mine` 单段不冲突）· 与 `mine` 同族 **11 键**同归一器（含派生 `title` / `condition`）· **零副作用**（不 +1 浏览 / 不写 `listing_view_log` / 不写 `listing_edit_log` / 不触发翻译）· `private, no-store` · 单行不收分页 |
| `/api/user` | 加性 `admin` **3 键**（`can_access_admin` / `is_admin` / `permissions[]`）；载荷 **8 → 9**；顶层 `is_admin` 保留；**不得整块搬 6 键 `AdminAccessRecord`**；`/api/admin/access` 不动 |
| 注册点 | **110 → 111**（get **49 → 50** / post 57 / put 0 / delete 3 / patch 1）；`p7b-03` 的 `AC10-2` 同批前推 |
| 错误码 | **零新增**（33 码闭集不动）：403 `AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED` · 404 `LEDGER_REF_NOT_FOUND` + `listing_not_found` |
| 判定顺序 | 401 → 404 → 403 → 400 → 409 → 200；**403 必早于任何 DB 写** |

**授权矩阵（承重）**：

| 角色 | 读编辑行 | 写字段 | 审计行 |
|---|---|---|---|
| 本人 | 200（11 键） | 200（照旧） | **0 行** |
| 管理员（非本人） | 200（11 键） | 200 | **恰 1 行** |
| 其他 | 403 | 403 | 0 行 |
| 未登录 | 401 | 401 | 0 行 |
| 行缺失 | 404 | 404 | 0 行 |
| `sold`/`delisted`/`frozen` | 200 | 409 | 0 行 |

### 2.2 数据面（data §40.11 · 迁移 `0059_listing_edit_log.sql`）

| 项 | 值 |
|---|---|
| 表 | `public.listing_edit_log`，**7 列** = 内务 PK `log_id` + `listing_id` / `actor_uid` / `owner_uid` / `admin_edit`（`boolean NOT NULL DEFAULT true`）/ `changed_fields`（`text[] NOT NULL`）/ `time_created`（`timestamptz NOT NULL DEFAULT now()`，DB 生成） |
| CHECK | ① `changed_fields <@ ARRAY['description','price','stock','media_urls','item_type','item_condition']::text[]`；② `array_position(changed_fields, NULL) IS NULL` |
| 索引 | `(listing_id, time_created DESC)` + `(actor_uid, time_created DESC)`；**零唯一索引** |
| append-only | `BEFORE UPDATE OR DELETE` 触发器无条件 `RAISE`（原生 `P0001`，不借账本码）；**不拦 `TRUNCATE` / `DISABLE TRIGGER`（同族已知边界）** |
| **零 FK** | 不对 `listing` / `users` 建 FK —— ① 审计不得被业务数据删除连坐（`trg_listing_no_delete` 可被临时 `DISABLE`，FK 会卡回收或逼 `CASCADE` 删审计）；② `users` 生命周期可能变，审计要比账号活得久；③ 本表落在已持 `listing` 行锁的同一语句里，FK 放大锁/检查面；④ 承 `listing_view_log`(0058) 零 FK 先例。**反断言 FK = 0**；代价 = 可能有悬挂 id，将来读口必须 LEFT JOIN |
| 写入 | 与 `UPDATE` **同一语句的 CTE**（同生共死）；四个条件全真才落行（非本人 ∧ 管理员 ∧ `outcome='updated'` ∧ 字段支）；任何 400/403/404/409 ⇒ **零行**；**禁 `BEGIN;…;COMMIT;`**（HTTP 单语句驱动必 `42601`） |
| 幂等 | **无幂等键**（动作日志语义）；同请求重投 = 两行 |
| `changed_fields` | 实际变更集，顺序 = `LISTING_EDIT_FIELDS` 声明序；**全同值保存 ⇒ 空数组仍落行**（管理员触碰即留痕优先；代价 = 重复保存多行） |
| 不记录 | **字段新旧值**（完整 diff = 另单）；不得声称有还原 / diff 能力 |
| 迁移 | `0059_listing_edit_log.sql`：建表 + 2 索引 + 触发器函数/触发器；**零 `ALTER` 既有表 / 零 DML / 文件内无 `BEGIN`-`COMMIT`**；尾部 `DO $$` 六项自检（列数 7 / 类型与非空 / PK 与两 CHECK / **FK = 0** / 索引 2 / 触发器 `O` / 存量行 0）；失败整迁移回滚、不写版本行 |
| 顺序 | **先 apply 后 push**（颠倒了 ⇒ 管理员编辑必 `42P01` 500）；`schema_version` **0058 → 0059**；`listing` 列数仍 **15** |

### 2.3 设计面（design §26.16）

| 项 | 值 |
|---|---|
| 可见性公式 | `isAuthenticated ∧ (isOwner ∨ canEditAny) ∧ status ∈ {draft, listed}`；`isOwner` = `detail.seller.uid === user.uID`；`canEditAny` 见 §2.1 |
| 不渲染面 | 未登录 / 普通用户（非本人）/ `sold`·`delisted`·`frozen` ⇒ **不渲染（不是置灰）** |
| 落点 | **页头行右端**（与 `item-back` 同排）；**不得进 H5 底栏四件**（§26.15.9 E #51 几何锚）、**不得进 Web 拼接胶囊**（#52）、**不得**用宽度读数定落点（#54） |
| 形态 | 文字按钮「编辑」（复用 `common.edit`，零新键）；≤767 触控 ≥44、字号 ≥12px；钩子建议 `item-detail-edit-btn` |
| 管理员提示 | 编辑页**顶部常驻提示条**（钩子 `item-admin-edit-notice`、建议键 `item.adminEditNotice`），**仅**「非 owner ∧ `canEditAny`」出现；**本人不显示**；不得写成 placeholder / toast |
| 预填 | 统一走 `GET /api/listing/:listingId/edit`（`mine` 只列本人行 ⇒ 管理员结构上取不到 = 换口的硬理由）；预填 6 项与「`NULL` 不猜补」不动；403 / 404 ⇒ **表单不渲染** |
| i18n | **+1 键** ⇒ top **131 不变** / flat **1136 → 1137** / nodes **4544 → 4548**（现取四语相等）；约 13 个测试文件计数断言按现取复算前推 |
| 判负 | design **#55–#58**（普通用户见入口 / 管理员编辑不落审计 / 本人编辑落审计 / 提示缺失或误示） |

## 3. 现取读数（2026-10-20 · HEAD `5310a72` · 工作区干净）

- 注册点 **110**（`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` 现取；get 49 / post 57 / put 0 / delete 3 / patch 1）；迁移末位 **`0058`**；两库 `schema_version` **0058**；`listing` 列数 **15**。
- 键面：`mine` **11** · 详情 **50** · feed **48**（本单**三处均不改**）。
- `PATCH` 可改字段 **6 项**（`LISTING_EDIT_FIELDS`，`listing-service.ts:519`）；归属闸落点 = `UPDATE_LISTING_DETAILS_SQL` 的 `cur.seller_uid <> $2` ⇒ `not_owner`；403 形态 = `AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`（`listing-service.ts:734`）。
- `/api/user` 载荷 **8 键**（`...UserRecord` 6 + `points` + `requires_profile_completion`，`buildUserPayload`，`index.ts:523`）；`AdminAccessRecord` **6 键**（`database.ts:7508-7532`）。
- 详情页 `*edit*` 钩子 **0 命中**；`item/:itemId/edit` 页面路由已存在（`App.jsx:111`，`PublishItemPage mode="edit"`）；编页预填源现取 = `GET /api/listing/mine`。
- i18n 四语 top **131** / flat **1136** / nodes **4544**（python walk 现取，四语逐文件相等）；`common.edit` = 「编辑」、`item.editTitle` = 「编辑闲置」在册；**「管理员编辑」提示无键**（实现单同批四语同补）。

## 3.1 同树现状披露（编制期现取 · 2026-10-20）

- **并行后端单已在同一工作树落盘、未提交**：`M backend-ts/src/{index,database,listing-service,audit-console}.ts` + `?? backend-ts/migrations/0059_listing_edit_log.sql`（132 行 · **两库未 apply**）。逐条对拍见 **route §49.15.10 / data §40.11.8**。
  - **一致**：注册点现取 **111**（get 50 / post 57 / put 0 / delete 3 / patch 1）· 读口 `GET /api/listing/:listingId/edit` 在场（**先 404 后 403**）· `$11::boolean` 管理员放行位 + `ins AS (INSERT INTO public.listing_edit_log …)` **同语句** · `changed_fields` = 逐列 `IS DISTINCT FROM` · `/api/user` `admin` 3 键（未注入时 `false/false/[]`）· 回执仍 **11 键**（`edit_log_written` 只在 DB 层内部位、未回传）。
  - **差额 4 项**：① `log_id bigserial` **等价合规**（与 IDENTITY 同义）；② `admin_edit` **无 DEFAULT 合规**（写面恒显式 `true`）；③ **索引 1 条合规**（actor 轴降为建议、不入判负）；④ **两条 CHECK 与 append-only 触发器缺失 = 必须补齐**（缺触发器则本表不构成 append-only 台账；补齐前按「非 append-only」读，**不得**宣称审计不可篡改）。
  - **未闭环**：`0059` 两库 apply；`p7b-03` 的 `AC10-2` 常量 **现取仍 110 ⇒ 该门此刻必红**（由后端单同批前推）；门套与判负实测读数。
- **前端零改动**（`frontend/**` 在 `git status` 中零条目）⇒ 详情页入口 / 编辑页提示条 / 预填换源**全未实现**，判负 #55–#58 一条未跑。
- **行为判据仍以判负为准**：以上「一致」= 代码形状对拍（只读现取），**不是**行为验收；本笔零 HTTP 实测、零库写，**不代该单声明上线**。

## 4. 挂账（本笔不定案）

1. **前端管理员布尔的第二处同式实现**：design §26.16.2 的公式与 route §49.15.2 是同一规则的两处实现（中文语义同、语言不同）⇒ 建议后端在 `admin` 块加派生布尔 `can_edit_any_listing`（一句话可改），本笔不改 Kevin 给定载荷形状。
2. **本表无读口**：管理员审核 / 运营面看不到 `listing_edit_log` 内容；要读 = 另单，且必须先解决零 FK 带来的悬挂 id（LEFT JOIN + 容忍 NULL）。
3. **无完整 diff**：本表只记「改了哪些字段」，不记新旧值；还原 / 完整 diff = 另单（加 `before`/`after` jsonb，写面放大）。
4. **管理员状态迁移**（`sold`/`delisted` 等）**不在本单**：`to_status` 支不放宽；需要 = 另裁。

## 5. 本笔边界

- **零代码 / 零迁移文件 / 零测试改动 / 零 HTTP 写 / 零库写**（本笔零 HTTP 实测）；判负 route #35–#41（7 条）+ design #55–#58（4 条）**一条未跑**；门套未跑（零源码改动）。
- **纯追加删行 0**：`git diff --numstat` 删除列 = 0（master-plan 两处均为整行前插；三册正文为文末追加）。
- `commit` 只 add 五件：`docs/route-layer.spec.md` / `docs/data-layer.spec.md` / `docs/design/design-system.spec.md` / `docs/seafood.master-plan.md` / `ops/admin-edit/SPEC-NOTE.md`；**不 push**（编制起点 `HEAD = 5310a72`）。
