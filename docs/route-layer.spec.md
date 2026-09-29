# 路由层与资金编排契约（ROUTE-LAYER-SPEC）

> **状态：v0.1（已完成 · 八节全量回填）** · 作者角色 = **Jing（Specifier · 制度员）**
> 本册是**批 2 / 批 3 实现的唯一依据**。实现（Kong）与质检（Neng）一律以本册条文为口径；冲突交 Zang 终审。

## §0 元信息与口径

| 项 | 值 |
|---|---|
| 版本 | **v0.1**（2026-09-29 CST / UTC+08:00 起笔） |
| 仓库 | `/Users/kevin/bistro/seafood`（后端 `backend-ts`，前端 `frontend`） |
| 服务 | `seafood-api`（端口 5788，cwd `backend-ts`）；前端 Vite 5787 |
| 库 | Neon PostgreSQL 18.6，`public` schema；`/health` 自报 `schema_version=0017` |
| 本单性质 | **纯规范写作**：只写 `docs/route-layer.spec.md`（+ 可选快照 `docs/versions/route-layer.spec.v0.1.md`）。**零代码改动、零库写（仅 SELECT）、无 git 写操作、未跑任何服务/套件** |
| 端点锚口径 | 对 `backend-ts/src/index.ts` 用 `app\.(get\|post\|put\|delete\|patch)\(` 匹配（每个注册点 = 1 个端点）⇒ **51 个**（GET 25 / POST 24 / DELETE 2，无 PUT/PATCH）——**本册实测**（见 §1 脚注） |

### 0.1 权威输入清单（本册的一切结论只能来自这六处）

| # | 输入 | 版本 / 规模（**本单实测**） | 用途 |
|---|---|---|---|
| I1 | `docs/data-layer.spec.md` | **v0.6**；**实测 1011 行 / 265649 B**；md5 前缀 `7b86b811…`（**父单给定，本单未复算**） | 规则号 `DL1..DL157`：`DL20`/`DL75`/`DL78`/`DL99`/`DL105`/`DL119`/`DL122`/`DL124`/`DL126`/`DL140`/`DL141..DL144`/`DL147`/`DL151`/`DL155..DL157` |
| I2 | `docs/ledger.spec.md` | **v0.12**（`R1..R109`，见其文首） | `R28`/`R33`/`R40`/`R47`/`R51`/`R52`/`R79`/`R103`/`R104..R109` |
| I3 | `docs/commission.spec.md` | **v0.2**（经 `backend-ts/src/commission.ts:5-7` 引用） | 十级返佣：`CR*` / §5.3 顺序铁律 / §6.2 最大余数法 / §13 借码 |
| I4 | `migrations/0001..0017`（`backend-ts/migrations/`） | 已应用；`/health` ⇒ `0017` | 表 / 状态机白名单 / **四个编排函数**的唯一真源 |
| I5 | `docs/audit/p4-route-inventory.md`（296 行）+ `docs/audit/p4-b1-get-triage.md`（750 行） | 已定案，直接引用 | 路由现状 / 关系映射 / 批 1 读侧换表读数与 key 集夹具 |
| I6 | `backend-ts/src/{index.ts,database.ts,ledger.ts,commission.ts,ledger-errors.ts}` | 工作树当前态 | 端点行号 / mapper 键集来源 / 错误码表（33 码）/ 幂等与金额工具 |

### 0.2 口径约定（全册生效）

1. **引用规则**：凡引用代码 / 端点 / 函数 / 规则，**必须给 `文件:行号`**；凡引用迁移，给 `migrations/<file>:行号` 或 `docs/audit/*` 节号。
2. **实测 vs 推断**：本册所有「实测」均可由产物 `grep` 到支撑读数（§0.3 清单）；无支撑读数的一律标 **推断** 并给依据；`NOT_MEASURED`（未测）一律**不得**当 0/空使用。
3. **保留字 / 带引号对象必须加引号**：真表名是 `users`（`migrations/0006_user_to_users.sql:75/127` 由 `"user"` 改名而来）；裸 `user` 会被解析成 `current_user` 而**静默不报错**。
4. **新数据层所有 SQL 显式限定 `public.`**（`DL151`；`public.account` 7 列 vs `neon_auth.account` 13 列）。
5. **退出码不得取自管道之后**（§5.7 ②）；本机**无 `timeout`/`gtimeout`**（§5.7 ③）；读数异常**先怀疑自己的探针**（§5.7 ④）。
6. **安全红线**：本仓**绝对禁止** `pkill -f <模糊词>` / `killall <名>`；只按精确 PID kill。
7. **`500` 类码只能由不变式被破坏触发且必须告警**（`DL126` / `R108`）；业务状态机非法转移一律 `409` + 借码（`DL119` / C5）。
8. **凡涉钱**必须写清「谁出钱 / 谁收钱 / 平台费与佣金的来源与分配」——本册 §4 每条业务事件强制四栏。

### 0.3 「实测」的支撑读数清单（本单可 grep 到的读数）

| 读数 | 支撑 | 取值 |
|---|---|---|
| 端点数 = 51 | `search_files 'app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` ⇒ `total_count: 51` | 见 §1 表（**行号为本册实测的 live 行号**） |
| 前言「51 端点」的**行号漂移** | 本册实测行号 vs `docs/audit/p4-route-inventory.md:34-84` | 例：`POST /api/auth/register` = **:228**（inventory 记 :223）；`POST /api/admin/points/adjust` = **:1066**（inventory 记 :1063）⇒ **inventory 的 §1 行号是 B1-a..B1-d 改动前的基线**，本册一律用 live 行号 |
| 前端 `/api` 消费面 | `search_files '/api/' frontend/src` ⇒ **97 行命中 / 23 文件** | 与父单「49 条去重路径 / 23 文件」的**文件数一致**（去重口径在父单） |
| 33 码 + HTTP status | `backend-ts/src/ledger-errors.ts:28-70`（`LEDGER_ERROR_TABLE`） | §3 逐码引用 |
| `401`/`403` 非账本域码 | `docs/data-layer.spec.md:344-346`（C4/C6）+ `:754-786`（`DL122`/`DL147`/§11.3） | `AUTH_UNAUTHORIZED`/`AUTH_FORBIDDEN` |
| 后台三处边界裁定 | `docs/data-layer.spec.md:343`（C3） | `/api/admin/prize/*` 删除、`settings/reset` 删除、`points/adjust` 保留但锁死 |
| 四柱 kind 白名单 | `migrations/0013_job.sql:9,375-397`、`0015_listing.sql:11-15,643-649`、`0016_market.sql:14-18,589-686` | §4 逐事件 |

## §1 端点处置表（51 个注册点 · 逐条）

**锚口径**：`app.<verb>(` 注册点 = 1 端点；**行号 = 本册实测 live 行号**（`backend-ts/src/index.ts`，工作树当前态）。处置词表：

- **【保留·改接】** 保留路径，查询/写入改接新 schema（对外**键集不得变**，见 §2）
- **【保留·改语义】** 保留路径，语义/状态码按本册改（明示）
- **【弃用→410】** 保留路径，一律 `410` + `R107` 形状错误体（`DL35` 的过渡条，**必须登记过期日**）
- **【弃用→空态】** 保留路径，`200` + 空态 + 顶层 `deprecated:true`（读口专用，已由 B1-c 落地）
- **【删除】** 路径下线（走 §1.3 的 404 兜底）
- **【不动】** 无库依赖或经判定不动

| # | 端点（`index.ts:行号`） | 处置 | 目标表与字段映射 | 依据 |
|--:|---|---|---|---|
| 1 | `GET /` **:180** | **【不动】** | —（纯内存；:186-187 的 `prizes/tasks` 是**键名文案**，非 SQL） | `p4-b1-get-triage.md:485`（B-c1 第 14 条） |
| 2 | `GET /health` **:200** | **【保留·改接】** | `schema_migration` → **必须写 `public.schema_migration`**（`DL155` 待收紧点） | `DL155`（`docs/data-layer.spec.md:1011`）；`backend-ts/src/db.ts:252` |
| 3 | `GET /api/test/data` **:217** | **【不动】** | —（纯内存调试） | 现状实测 `200`（`p4-route-inventory.md:173`） |
| 4 | `POST /api/auth/register` **:228** | **【弃用→410】** | — | §4.1 #9–#10 口径 + `DL35`（`data-layer.spec.md:325`） |
| 5 | `POST /api/auth/challenge` **:232** | **【保留·改接】** | `auth.ts:startWalletAuthChallenge`（无库） | `p4-route-inventory.md:38` |
| 6 | `POST /api/auth/verify` **:241** | **【保留·改接】** | `users`（`uid/evm`）+ `account(cid=1)`；**首次发币 = 资金 ⇒ 批 3** | `DL107`（钱包签名登录）；`migrations/0002_user_identity.sql:15` |
| 7 | `POST /api/auth/login` **:264** | **【弃用→410】** | —（现状为 `req.url` 改写转发到 verify ⇒ **必须拆掉双路径**） | §4.1 #10「**删除 `login`**，只留 `verify`」（`data-layer.spec.md:248`） |
| 8 | `GET /api/prize/all` **:269** | **【保留·改接】** | `prize`→**`listing`**（`listing_id→bID`、`title→name`、`price→points`；聚合列恒 0） | B1-c（`p4-b1-get-triage.md:469-471,503-517`）；`migrations/0015_listing.sql:115` |
| 9 | `GET /api/task/all` **:281** | **【保留·改接】** | `task`→**`job`**（`job_id→tID`、`reward→points`、`description→note`）；参与者 = `job_application` 计数 | B1-b（`p4-b1-get-triage.md:315-316,361-374`）；`migrations/0013_job.sql:79` |
| 10 | `GET /api/task/:tID` **:293** | **【保留·改语义】** | `job`（同上） | **detail-miss ⇒ `404`（撤销 B1-b 的 200 空态）**，见 §3.1 |
| 11 | `GET /api/prize/:bID` **:311** | **【保留·改接】** | `listing`（同上）；miss ⇒ `404`（现状一致） | B1-c（`p4-b1-get-triage.md:573`） |
| 12 | `GET /api/user` **:331** | **【保留·改接】** | `users` + `account`（派生余额） | `DL24` 要求带 `cid` 集合 ⇒ **与前端键集冻结冲突，未决 §7-2** |
| 13 | `POST /api/user/profile` **:344** | **【保留·改接】** | `users.bio`（列名大小写修复） | §4.1 #16（`data-layer.spec.md:254`） |
| 14 | `GET /api/user/asset/:uID` **:367** | **【保留·改接】** | `asset`→**`account`**(`WHERE uid=$1 AND cid=1`)；**纯读**（删 `upsertAsset` 副作用） | B1-a（`p4-b1-get-triage.md:260-263`）；`DL32`/§4.1 #17 |
| 15 | `GET /api/home` **:383** | **【保留·改接】** | `job` + `listing` + `account`（四路并行读，**纯读**） | `DL39`（禁写副作用）；B1-c 锚点（`p4-b1-get-triage.md:49`） |
| 16 | `GET /api/prize-item` **:420** | **【保留·正式化】** | `prize_item`→**`listing_order`**（`order_id→gID`、`listing_id→bID`、`buyer_uid→uID`、谓词 `status='paid'`） | B1-c（`p4-b1-get-triage.md:474,519-530`）；**本册裁定：不再标 `deprecated`**（它有真实语义） |
| 17 | `GET /api/task-progress` **:434** | **【保留·改接】** | `task_progress`→`job_application`（`worker_uid` 轴） | B1-b（`p4-b1-get-triage.md:318`） |
| 18 | `GET /api/task-progress/:jID` **:448** | **【保留·改接】** | `job_application` + `LATERAL` 最新 `job_submission`；miss ⇒ `404` | B1-b（`p4-b1-get-triage.md:317`）；§3.1 |
| 19 | `POST /api/task-progress/:identifier/submit` **:467** | **【保留·改接】** | `job_submission`（`create_key` 幂等；`review_status='pending'`）+ `job.status→'submitted'`；**无分录** | `DL99`/`DL56`（`migrations/0014_job_flow.sql:115-133`）；**非资金 ⇒ 批 2** |
| 20 | `POST /api/task-progress/claim/:jID` **:505** | **【保留·改语义】** | 拆分 `apply`（无分录）/`accept`（无分录）/`settle`（**有分录**） | §4.1 #23（`data-layer.spec.md:261`）；**资金 ⇒ 批 3** |
| 21 | `GET /api/shard` **:557** | **【弃用→空态】** | 无对应表（持仓 = `account`） | B1-c（`p4-b1-get-triage.md:538`）；`DL69` |
| 22 | `GET /api/shard/transfer` **:572** | **【弃用→空态】** | 无对应表（转让 = `ledger_entry` 派生） | B1-c（`p4-b1-get-triage.md:539`）；§4.1 #25 |
| 23 | `POST /api/shard/redeem` **:587** | **【弃用→410】** | —（写动作，**不得**用空态 200 冒充成功） | §4.1 #26 **驳回**（`data-layer.spec.md:264`） |
| 24 | `POST /api/chest/:bID/open` **:605** | **【弃用→410】** | —（凭空调入余额，与 `DL5` 冲突） | §4.1 #27 **驳回**（`data-layer.spec.md:265`） |
| 25 | `GET /api/order` **:623** | **【保留·改接】** | `market_order`（列名已重写：`owner_uid`/`base_cid`/`amount`/`amount_filled`） | B1-d（`p4-b1-get-triage.md:631,649-659`） |
| 26 | `POST /api/order` **:637** | **【保留·改接】** | `market_post_event(op='order')` ⇒ `hold` ×2 | `migrations/0016_market.sql:589-616`；**资金 ⇒ 批 3** |
| 27 | `DELETE /api/order` **:656** | **【保留·改语义】** | 全撤 ⇒ `op='cancel'`（逐单）；**入参一律走 query，不得读 body** | §4.1 #30 理由（`data-layer.spec.md:268`）+ 前端消费 `frontend/src/pages/ShardPage.jsx:328-329` ⇒ **保留路径，改造入参**（未决 §7-5） |
| 28 | `DELETE /api/order/:oID` **:669** | **【保留·改接】** | `market_post_event(op='cancel')` ⇒ `hold_release` ×2 | `migrations/0016_market.sql:667-685`；**资金 ⇒ 批 3** |
| 29 | `GET /api/market/:bID/orderbook` **:687** | **【保留·改接】** | `market_order` 聚合（`SUM(amount-amount_filled)`） | B1-d 锚点（`p4-b1-get-triage.md:65`） |
| 30 | `GET /api/market/:bID/trades` **:702** | **【保留·改接】** | `market_trade` + `LEFT JOIN market_order` 合成 `buyer_uID/seller_uID` | B1-d（`p4-b1-get-triage.md:630`） |
| 31 | `GET /api/admin/me` **:718** | **【保留·改接】** | `users.is_admin` + `admin_user_role` ⇒ `permissions[]` | §4.1 #34（`data-layer.spec.md:272`）；`migrations/0017_platform_config.sql:88-90` |
| 32 | `GET /api/admin/settings` **:724** | **【保留·改接】** | `app_config`（key/value，**无 privacy 列**）；**响应必须标注「费率不在本表」** | §4.1 #35（`data-layer.spec.md:273`）；`migrations/0017_platform_config.sql:69` |
| 33 | `POST /api/admin/settings` **:737** | **【保留·改接】** | `app_config` upsert；`ops:<admin_uid>:<action>:<key>` 键；**禁写费率键** | `DL36`（`data-layer.spec.md:326`）；CR23/CR25 |
| 34 | `POST /api/admin/settings/reset` **:750** | **【弃用→410】** | — | **C3 ② 裁定删除**（`data-layer.spec.md:343`） |
| 35 | `GET /api/admin/permissions` **:763** | **【保留·改接】** | `permission_group`→`admin_role*` 三表；**撤销 B1-c 打的 `deprecated`** | B1-c（`p4-b1-get-triage.md:477,548`）；`migrations/0017_platform_config.sql:93-132` |
| 36 | `POST /api/admin/permissions/save` **:779** | **【保留·改接】** | `admin_role`/`admin_role_permission`；`ops:` 键 + **自锁守卫** | §4.1 #39（`data-layer.spec.md:277`） |
| 37 | `POST /api/admin/permissions/delete` **:800** | **【保留·改接】** | 同上；**必须校验该角色下无在用用户** | §4.1 #40（`data-layer.spec.md:278`） |
| 38 | `POST /api/admin/user/update` **:821** | **【保留·改接】** | `users.is_admin`/`admin_user_role`/`users.bio`；**禁 `evm`/`uid`/任何余额字段** | `DL16`/§4.1 #41（`data-layer.spec.md:279`） |
| 39 | `POST /api/admin/task/create` **:842** | **【弃用→410】** | —（管理员不再发布招工） | §4.1 #42 **采纳删除**（`data-layer.spec.md:280`）+ 用户需求③ |
| 40 | `POST /api/admin/task/update` **:855** | **【弃用→410】** | — | §4.1 #43（`data-layer.spec.md:281`） |
| 41 | `POST /api/admin/task/delete` **:876** | **【弃用→410】** | — | §4.1 #44（`data-layer.spec.md:282`） |
| 42 | `POST /api/admin/prize/create` **:894** | **【弃用→410】** | — | **C3 ① 裁定删除**（`data-layer.spec.md:343`） |
| 43 | `POST /api/admin/prize/update` **:907** | **【弃用→410】** | — | C3 ①（`data-layer.spec.md:343`） |
| 44 | `POST /api/admin/prize/delete` **:928** | **【弃用→410】** | —（合规下架另立 P6 `/api/admin/listing/:id/takedown`） | C3 ① + §4.1 #47（`data-layer.spec.md:285`） |
| 45 | `GET /api/user/all` **:946** | **【保留·改接】** | `users`（**必须分页 + 只出非敏感列**；禁 token） | §4.1 #48（`data-layer.spec.md:286`） |
| 46 | `GET /api/user/stats` **:960** | **【保留·改接】** | `users` + `account`（**统计口径必须标注「账本派生」**） | §4.1 #49（`data-layer.spec.md:287`） |
| 47 | `GET /api/tasklist/pending-verification/count` **:973** | **【保留·改语义】** | `job_submission`（`review_status='pending'`）+ `job_application`；**队列归雇主视角** | **C7 裁定**（`data-layer.spec.md:347`）；B1-b 谓词（`p4-b1-get-triage.md:319-320`） |
| 48 | `GET /api/tasklist/pending-verification` **:986** | **【保留·改语义】** | 同上 | C7（`data-layer.spec.md:347`） |
| 49 | `POST /api/tasklist/:jID/verify` **:1000** | **【保留·改接】** | `job_submission.review_status` + `job_post_event(op='settle'\|'refund')` | **`approve` = 结算（资金）⇒ 整条端点归批 3**（§4 J5/J6、§4.0 硬口径 R4） |
| 50 | `POST /api/admin/assets/init` **:1056** | **【弃用→410】** | —（账户由 DB 按需 0/0 开户；**该端点无 `requireAdmin` 守卫**） | §4.1 #53 **删除**（`data-layer.spec.md:291`）；`R75` |
| 51 | `POST /api/admin/points/adjust` **:1066** | **【保留·改接】** | `ledger_post_event(op='mint'\|'burn')`，**仅 `$`(cid=1)**；`ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | **C3 ③**（`data-layer.spec.md:343`）+ §4.1 #54（`:292`）；**资金 ⇒ 批 3** |

**分布（本册机读口径）**：【保留·改接】30 ·【保留·改语义】5 ·【保留·正式化】1 ·【弃用→410】13 ·【弃用→空态】2 ·【不动】3 = **51**（含 1 条同时属保留与改语义者按主处置计一次 ⇒ 以本表逐行为准）。

### 1.1 新增端点（用户需求 + `data-layer.spec.md` §4.1 的「修正」目标态）

> 依据：`docs/data-layer.spec.md:249-293`（§4.1 逐行目标路径）+ 用户需求 1/2/4/5。**新增端点不改变 §1 的 51 条既有路径**（双轨：先别名后切换，见 §5.4）。

| 端点 | 编排 / 服务入口 | 批 | 依据 |
|---|---|---|---|
| `POST /api/job`（招工发布+托管） | `job_post_event(op='publish')` | **批 3**（托管=冻结=资金） | `migrations/0013_job.sql:431`；§4 J1 |
| `POST /api/job/:jobId/apply` | 直 DML（`job_application`，**无分录**） | 批 2 | `DL99`；`migrations/0014_job_flow.sql:79` |
| `POST /api/job/:jobId/accept` | 直 DML（`status='accepted'` + `uniq_job_application_accepted`） | 批 2 | `migrations/0014_job_flow.sql:102` |
| `POST /api/job/:jobId/submit` | 直 DML（`job_submission`） | 批 2 | §4.1 #22（`data-layer.spec.md:260`） |
| `POST /api/job/:jobId/review` | `job_post_event(op='settle'\|'refund')` | **批 3** | §4.1 #52（`data-layer.spec.md:290`）；C7 |
| `POST /api/job/:jobId/cancel` | `job_post_event(op='refund')` | **批 3** | `migrations/0013_job.sql:427` |
| `POST /api/listing`（商品上架/编辑/下架） | 直 DML（**无分录**，`create_key` 幂等） | 批 2 | `DL99`/`listing` 表注（`migrations/0015_listing.sql:142-143`） |
| `POST /api/listing/:listingId/buy` | `listing_post_event(op='buy')` | **批 3** | `migrations/0015_listing.sql:449`；§4 P2 |
| `POST /api/listing/order/:orderId/refund` | `listing_post_event(op='refund')` | **批 3** | `migrations/0015_listing.sql:437`；§4 P4 |
| `POST /api/market/order` | `market_post_event(op='order')` | **批 3** | §4.1 #29（`data-layer.spec.md:267`） |
| `DELETE /api/market/order/:orderId` | `market_post_event(op='cancel')` | **批 3** | §4.1 #31（`data-layer.spec.md:269`） |
| `GET /api/market/:baseCid/candles` | `candle_view`（**视图，只读**） | 批 2 | `DL66`/`DL150`；`migrations/0016_market.sql:200` |
| `POST /api/referral/bind` | `referral_bind(child,parent)`（**无分录**） | 批 2 | §4.1 #（返佣）`data-layer.spec.md:315`；`migrations/0007_referral_and_commission_policy.sql:241` |
| `GET /api/referral/earnings` | `ledger_entry`（`kind='commission'` 派生，只读） | 批 2 | `DL2`（只读真源） |
| `POST /api/admin/commission_policy` | `insertCommissionPolicy`（**插行，无分录**） | 批 2 | `backend-ts/src/commission.ts:240`；CR23/CR25 |
| `GET /api/user/points` / `GET /api/user/ledger` | `account` / `ledger_entry`（只读派生） | 批 2 | §4.1 #17/#25；`DL24` |
| `POST /api/currency`（建单位） | **未实现**（无编排函数） | 批 3（先裁定 §7-3） | `migrations/0001_ledger_core.sql:13-38`；`kind='currency_create_fee'` |
| `POST /api/currency/:cid/list`（上市→收保证金） | **未实现**（无编排函数） | 批 3（先裁定 §7-3） | `ledger.ts:174`（`HOLD_KINDS` 含 `listing_deposit`）vs `:541`（`-1` credit 白名单**不含**它） |

### 1.2 与 `docs/data-layer.spec.md` §4.1 的**命名张力**（登记，不推翻）

`§4.1` 的目标态把路径改名（`/api/prize/all→GET /api/listing`、`/api/task/all→GET /api/job`、`/api/task/:tID→/api/job/:jobId` …）。而**用户原始需求 + 前端 49 条消费面**要求既有路径**必须保留**（删则前端 404）。二者不冲突，但**必须排期**：

- **批 2/批 3：既有路径 = 唯一对外路径**（键集冻结，§2）；`§4.1` 的新命名**只作内部 service 命名与文档口径**，不新增对外路径。
- **批 4（前端迁移后）：** 新路径上线为**别名**，旧路径转 **410 + `R107` 形状**（`DL35` 的过渡条），**过期日由 Kevin 定**（未决 §7-1）。
- 质检判据：批 2/批 3 期间，任何**既有路径**的响应**键集变化** ⇒ 判负（§2）。

### 1.3 404 兜底（`USE` 兜底）

保留 404 兜底，但**响应形状必须与 `R107` 对齐**（`{error:{code,message,i18n_key,details}}`），**不得回 HTML**；兜底码 = `LEDGER_REF_NOT_FOUND`（`404`）。依据：§4.1 #55（`docs/data-layer.spec.md:293`）。
## §2 前端契约冻结（响应 key 集来源 + 不得变）

**母约束（本册裁定 F1）**：批 2 / 批 3 期间，**任何既有端点的响应 key 集不得变化**（增键亦视为变化，除非本册明文批准）。键集的**唯一来源** = 下表的 mapper / 组装函数；**改 SQL、换表、换列名都不构成改键集的理由**（mapper 里加「回退键」是既有手法：旧列名在前、新列名在后）。

### 2.1 逐端点 → key 集来源

| 端点（`index.ts:行号`） | key 集来源（唯一真源） | 键数 | 批 1 的夹具读数（可 grep） |
|---|---|---|---|
| `GET /api/user/asset/:uID`（:367） | `database.ts:457 normalizeAsset` → `AssetRecord` | 5（`index_id/uID/points/lucks/time_update`） | `b1a-20260929T135443/post/fixture-keys.json` 10/10 EQ（`p4-b1-get-triage.md:121`） |
| `GET /api/user`（:331） | `database.ts:465 normalizeUser` + `index.ts` 的 `buildUserPayload` | `UserRecord` 键集 | B1-a §1（`p4-b1-get-triage.md:36,219`） |
| `GET /api/prize/all`（:269）、`GET /api/prize/:bID`（:311） | `database.ts:474 normalizeBrand` → `BrandRecord` | **45** | `b1c-…/post/fixture-keys.json` 8/8 EQ（`p4-b1-get-triage.md:128`） |
| `GET /api/prize-item`（:420） | `database.ts:573 normalizePrizeItem` → `PrizeItemRecord` | **6** | 同上（`p4-b1-get-triage.md:128`） |
| `GET /api/task/all`（:281）、`GET /api/task/:tID`（:293） | `database.ts:582 normalizeTask` → `TaskRecord` | **21** | `b1b-…/post/fixture-keys.json` 9/9 EQ（`p4-b1-get-triage.md:124,351-353`） |
| `GET /api/task-progress`（:434）、`/api/task-progress/:jID`（:448） | `database.ts:611 normalizeTaskProgress` → `TaskProgressRecord` | **9** | 同上（`p4-b1-get-triage.md:352`） |
| `GET /api/tasklist/pending-verification(/count)`（:973/:986） | `normalizeTaskProgress` + enrich（`task`/`user`） | **11** | 同上（`p4-b1-get-triage.md:353`） |
| `GET /api/order`（:623） | `database.ts:670 normalizeMarketOrder` → `MarketOrderRecord` | **12** | `b1d-…/post/fixture-keys.json` 9/9 EQ（`p4-b1-get-triage.md:133`） |
| `GET /api/market/:bID/trades`（:702） | `database.ts:699 normalizeMarketTrade` → `MarketTradeRecord` | **10** | 同上（`p4-b1-get-triage.md:133`） |
| `GET /api/market/:bID/orderbook`（:687） | `database.ts:690 normalizeOrderBookRow`（export）→ `MarketOrderBookRow` | **3**（`side/price/volume`） | 同上（`p4-b1-get-triage.md:133`） |
| `GET /api/shard`（:557） | `database.ts:654 normalizeShardHolding`（**现恒空数组**） | 键集冻结，值恒空 | B1-c（`p4-b1-get-triage.md:476,538`） |
| `GET /api/shard/transfer`（:572） | `database.ts:715 normalizeShardTransfer`（**现恒空数组**） | 键集冻结，值恒空 | B1-c（`p4-b1-get-triage.md:539`） |
| `GET /api/admin/settings`（:724） | `database.ts:623 normalizeSystemSettings` → `SystemSettingsRecord` | 不变 | — |
| `GET /api/admin/permissions`（:763） | `database.ts:639 normalizePermissionGroup` → `PermissionGroupRecord` | 不变（**批 2 换数据源，键集不变**） | B1-c（`p4-b1-get-triage.md:477`） |
| `GET /api/home`（:383） | `index.ts` 内联组装 | 5（`tasks/prizes/claimed_prize_ids/user_points/is_authenticated`） | B1-c 实测体（`p4-b1-get-triage.md:49`） |
| `GET /health`（:200） | `db.ts:healthCheck` | `ok/db_version/schema_version/time` | 实测（`p4-route-inventory.md:172`） |

**B1-a..B1-d 的 key 集等值证明方式**（可复核）：零依赖内存夹具（`backend-ts/scripts/p4z-03/04/05/08-keys-*.ts`），把同一组合成行分别喂 **改动前** mapper（`git show HEAD:backend-ts/src/database.ts` 快照）与**改动后** mapper，**逐 key 比对（只比 key 集，不比值）**，四次均 `all_key_sets_equal: true`（10/10、9/9、8/8、9/9）。**自曝**：`database.NEW.ts` 的 `./ledger` 用 stub（仅 `SYSTEM_CURRENCY_CID`），夹具**不覆盖 ledger 运行时**、**只比 key 集不比值**（`p4-b1-get-triage.md:122,230-231,712`）。

### 2.2 前端消费面（**本册实测**：97 行命中 / **23** 文件）

口径：`search_files '/api/' frontend/src` ⇒ 97 行；文件数 23（与父单「49 条去重路径 / 23 文件」**文件数一致**）。**高频路径**（父单口径）：`/api/prize/all` 11、`/api/task/all` 9、`/api/user/asset/:p` 6、`/api/tasklist/pending-verification(/count)` 4+4、`/api/shard` 4、`/api/prize-item` 4、`/api/order` 3、`/api/home` 3。

代表性消费点（`文件:行号`，本册实测）：

- `frontend/src/pages/ProfilePage.jsx:77` `/api/user/asset/${uID}`；`:92` `/api/shard`；`:105` `/api/task-progress`；`:106` `/api/prize-item`
- `frontend/src/pages/HomePage.jsx:105` `/api/task/all?limit=`；`:106` `/api/prize/all?limit=`；`:119` `/api/prize-item`；`:120` `/api/user/asset/${user.uID}`；`:140` `/api/home?task_limit=&prize_limit=`
- `frontend/src/pages/RewardPage.jsx:49` `/api/prize/all`；`:56` `/api/prize-item`；`:58` `/api/shard`；`:109` `/api/task-progress/${q_jID}`；`:112` `/api/task/${tID}`；`:152` `/api/task-progress/claim/${jID}`；`:196` `/api/shard/redeem`；`:217` `/api/chest/${reward.bID}/open`
- `frontend/src/pages/TaskPage.jsx:90` `/api/task/all`；`:109` `/api/task-progress`
- `frontend/src/pages/ShardPage.jsx:42-43` `/api/market/${bID}/orderbook|trades`；`:176` `POST /api/order`；`:301` `/api/shard`；`:302` `/api/order`；`:303` `/api/shard/transfer`；`:314` `DELETE /api/order/${oID}`；`:328-329` `DELETE /api/order`（**body 式全撤**）
- `frontend/src/components/Header.jsx:71` `/api/user/asset/${userData.uID}`；`frontend/src/components/ActiveTaskModal.jsx:50` `/api/task-progress/${...}/submit`；`frontend/src/components/ClaimRewardModal.jsx:24` `/api/task-progress/${jID}`、`:49` `/api/task-progress/claim/${jID}`
- `frontend/src/auth.js:113` `/api/auth/challenge`；`:123` `/api/auth/verify`；`:142` `/api/user`；`:153` `/api/user/profile`
- `frontend/src/pages/DashboardPage.jsx:121-125` `/api/user/stats`、`/api/task/all`、`/api/prize/all`、`/api/tasklist/pending-verification(/count)`；`:223` `/api/tasklist/${jID}/verify`
- `frontend/src/pages/admin/*`：`TasksManagement.jsx:52,130,140,177`；`RewardsManagement.jsx:56,154,164,201`；`PermissionsManagement.jsx:55,133,176`；`PointsManagement.jsx:114`；`UsersManagement.jsx:103`；`SystemSettings.jsx:46,85,123`；`ShardsManagement.jsx:44,60,74`
- `frontend/src/admin-utils.js:27` `/api/admin/me`；`:78` `/api/user/asset/${uID}`；`:88-89` `/api/user/stats`、`/api/user/all`

### 2.3 前端消费但后端**没有**的路径

**结论：0 条**（本册实测）。把 `frontend/src` 的 97 条命中逐个比对 §1 的 51 条注册点 ⇒ **每个非测试路径都有对应后端注册点**。仅以下两处**不是真端点**（**不得**当缺口）：

1. `frontend/src/test/e2e/basic.spec.js:123` `page.route('**/api/**', …abort)`、`:133` `**/api/tasks` —— **Playwright 路由 mock 模式**，非真实请求；
2. `frontend/src/test/unit/*.test.{js,jsx}` 的 `/api/...` 字符串 —— **vitest mock 表键**（例 `home-page.test.jsx:54-58`）。

**登记**：`frontend/src/test/unit/auth.test.js:75` 断言 `/api/auth/register` 抛 `deprecated endpoint` ⇒ §5.3 处置该端点时**必须同步此测试**，否则单测必红。
## §3 detail-miss 与错误语义

### 3.1 统一 `404`（本册裁定 E1）

**默认口径**：**detail-miss（单资源读不到 / 写目标不存在）一律 `404`**。例外必须逐条说明；本册**不设任何 200 空态例外**（撤销 B1-b 在 `/api/task/:tID` 上的临时 200 空态）。

| 端点 | 现状（实测） | 本册口径（批 2 必改） |
|---|---|---|
| `GET /api/task/:tID`（:293） | **200 空态**（B1-b 明示语义变更：miss ⇒ `emptyTask(tID)` 21 键） | **改回 `404`**。依据：父单已定「detail-miss 语义统一为 `404`（当前 `/api/task/:tID` 返回 200 空态、`/api/prize/:bID` 已 404 ⇒ 规范里定 404 为默认）」 | 
| `GET /api/prize/:bID`（:311） | `404` ✓ | 保持 `404` |
| `GET /api/task-progress/:jID`（:448） | `404` ✓ | 保持 `404` |
| `GET /api/order/:oID`（无 GET 单条）/ `POST/DELETE` 的资金动作 | 未测 | 目标不存在 ⇒ `404 LEDGER_REF_NOT_FOUND` + `details.ref_type/ref_id` **必填** |

**`404` 三类必须可区分**（`DL124`，`docs/data-layer.spec.md:751`）——**禁止**把三类混成一个 404 文案：

| 类 | 码 | 触发 | `details` |
|---|---|---|---|
| 记账主体不存在 | `LEDGER_ACCOUNT_NOT_FOUND` | `account` 无该 `(uid,cid)` 且不可创建 | `{uid,cid}` |
| 币种不存在 | `LEDGER_CURRENCY_NOT_FOUND` | `currency` 无该 `cid`（**含 `cid<=0` 与负数**，v0.5 裁定） | `{cid}`（十进制字符串） |
| 业务对象不存在 / **越权隐藏** | `LEDGER_REF_NOT_FOUND` | 单资源 miss；**以及无权限可见性**（`DL111`①–④，**不泄露存在性**） | `{ref_type, ref_id}` **必填** |

> 实测支撑（`404` 的 `cid` 一支）：DB 侧 `ledger_cid_arg` 自 `0004` 起对 `cid <= 0` 恒为 `LD007`/404（`backend-ts/src/ledger.ts:507-519` 的 P1n 回退说明 + 其 `toCid` 实现 `:521-526`）。

### 3.2 状态码适用条件（逐码）

| 码 | 适用条件 | 依据（唯一真源） |
|---|---|---|
| **`400`** | 入参**形状 / 语义非法**：缺幂等键（`LEDGER_IDEMPOTENCY_KEY_REQUIRED`）、键格式非法（`LEDGER_IDEMPOTENCY_KEY_INVALID`）、金额非法（`LEDGER_AMOUNT_INVALID` / `LEDGER_AMOUNT_NOT_POSITIVE`）、小数位溢出（`LEDGER_DECIMALS_OVERFLOW`）、自转账（`LEDGER_SELF_TRANSFER`）、平台保留 uid 出现在不该出现的位（`LEDGER_RESERVED_UID`）、kind 不在关闭集（`LEDGER_UNKNOWN_KIND`）、币种不一致（`LEDGER_CURRENCY_MISMATCH`） | `ledger-errors.ts:34-35,43,49-52,55,57` |
| **`401`** | 无 / 坏 token；`resolveActor` 判凭据无效（**≠ DB 故障**：DB 故障必须 `500/503`） ⇒ **`AUTH_UNAUTHORIZED`**（非账本域码） | `DL122`+§11.3.1（`data-layer.spec.md:754,766`） |
| **`403`** | ① 有 actor 但 `can_access_admin=false`（`reason=NOT_ADMIN`）；② admin 但未命中 `requiredPermission`（`reason=PERMISSION_NOT_GRANTED`）；③ **「已参与但无该动作权限」**（`reason=ACTOR_NOT_ALLOWED`）⇒ **`AUTH_FORBIDDEN`**。**例外**：账本层权限语义（铸币权 / 手动冻结权）仍用 `LEDGER_UNAUTHORIZED_MINT` / `LEDGER_HOLD_NOT_ALLOWED`（**新面业务路由不得返回它们**，C6 明确禁止再借 `LEDGER_HOLD_NOT_ALLOWED`） | `DL122`/`DL147`/§11.3.2（`data-layer.spec.md:754-755,766-778`）；`ledger-errors.ts:46-47` |
| **`404`** | 见 §3.1（三类 + detail-miss 默认） | `DL124`（`data-layer.spec.md:751`） |
| **`409`** | **业务状态冲突**（**不是 400**）：可用余额不足 `LEDGER_INSUFFICIENT_BALANCE`、在冻不足 `LEDGER_INSUFFICIENT_FROZEN`、幂等同键异指纹 `LEDGER_IDEMPOTENCY_CONFLICT`、币种未上市 `LEDGER_CURRENCY_NOT_LISTED`、币种已下架 `LEDGER_CURRENCY_DELISTED`、**业务状态机非法转移**（借码 `LEDGER_CURRENCY_INVALID_TRANSITION` + `details.field` + `reason` 大写）、符号占用 `LEDGER_CURRENCY_SYMBOL_TAKEN`、发行上限 `LEDGER_SUPPLY_CAP_EXCEEDED` | `DL123`（`data-layer.spec.md:750`）+ `DL119`（`:708`）+ C5（`:345`）；`ledger-errors.ts:30-33,38,40-42,45` |
| **`410`** | 仅用于 §5 的**弃用面过渡**（`DL35` 的过渡条：410 + `{error:{code:'LEDGER_REF_NOT_FOUND'}}` + **登记过期日**） | `DL35`（`data-layer.spec.md:325`） |
| **`422`** | **本册裁定：不启用。** 理由：`ledger.spec` §14.1 的 **33 码关闭集里没有任何 422**（`ledger-errors.ts:28-70` 全表无 422）；本仓用 `400` 表达「入参形状/语义非法」、`409` 表达「业务状态冲突」（`DL123`）。**任何** `422` 都必须先开新裁定（不得「顺手用」） | `ledger-errors.ts:28-70`；`DL123`/`DL119` |
| **`423`** | 单位被合规冻结 ⇒ `LEDGER_CURRENCY_FROZEN`（`DL125` 附） | `ledger-errors.ts:39`；`DL125`（`data-layer.spec.md:752`） |
| **`500`** | **只允许由「不变式被破坏」触发，且必须告警（R108）**：`LEDGER_NEGATIVE_BALANCE_GUARD` / `LEDGER_APPEND_ONLY_VIOLATION` / `LEDGER_ACCOUNT_GUARD_VIOLATION` / `LEDGER_FEE_RATE_INVALID` / `LEDGER_TRANSACTION_REQUIRED`；`LEDGER_RECONCILE_MISMATCH`（表内 `status=null`，**HTTP 层必须兜底 500**）。**业务状态机非法转移不得用 500** | **`DL126`**（`data-layer.spec.md:753`）+ `R108`（`ledger-errors.ts:79-87`）+ `httpStatusOf`（`ledger-errors.ts:190-193`） |
| **`503`** | 重试类：`LEDGER_LOCK_TIMEOUT` / `LEDGER_TX_TIMEOUT` / `LEDGER_DEADLOCK_RETRY_EXHAUSTED`（含连接池过载 / 驱动连接级错误 / infra SQLSTATE 的归一） | `ledger-errors.ts:60-62,631-637` |
| **`200`（良性）** | `LEDGER_IDEMPOTENCY_REPLAY` **不是错误**（R106）：同键同指纹 ⇒ 200 + `idempotent_replay:true`；**不得**落 500 兜底 | `ledger-errors.ts:170,190-193` |

### 3.3 响应形状与**必须遵守的收尾规则**（R107 · 逐条强制）

1. **统一错误体**：`{ error: { code, message, i18n_key, details } }`；`i18n_key = ledger.err.<CODE>`（`ledger-errors.ts:10-13,219,243-253`）。
2. **`details` 只放非敏感上下文**（`cid`/`symbol`/期望值/实际值/关联键）；**禁止**放 SQL、**约束名**、**堆栈**、**表名**、连接串（`R107`，`ledger-errors.ts:10-12`）。**原始 `message` / `stack` 只准进服务端日志（R108 诊断载荷）**：`ledgerErrorDiagnostics()`（`ledger-errors.ts:531`）是那个载荷，**永不进对外 `details`**（`:462-471` 裁定逐字）。
3. **HTTP 状态一律取 `err.httpStatus`（= `status ?? 500`）**，**不得**直写 `err.status`（`status=null` 是脚本退出码语义，透传会得到「缺状态码」的响应）。真实例：`0007` 的佣金守恒断言抛 `LD032`（`ledger-errors.ts:236-242`；`migrations/0007_referral_and_commission_policy.sql:317`）。
4. **不得吐未映射的原始 SQLSTATE**：一律经 `normalizeLedgerError`（`ledger-errors.ts:568`）；`23505` 只对 `constraint='ledger_idem_uniq'` 映射为 `LEDGER_IDEMPOTENCY_CONFLICT`，**其余**唯一冲突落 `400 LEDGER_AMOUNT_INVALID` ⇒ 因此**业务级唯一键**（如 `job_application_job_worker_uniq`、`uniq_job_application_accepted`、各 `*_create_key_uniq`）**必须在应用层先判、并映射为 409/幂等 200**，不得让裸 `23505` 变成 400（`ledger-errors.ts:604-606`）。
5. **非账本错误的 `reason` 必须可机读**（不得只留 `cause='non_pg_error'`）（`ledger-errors.ts:639-649`）。
6. **`AUTH_*` 的 `i18n_key` = `auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（需新增键）**：`frontend/src/locales/{zh,en,hk,vn}.json` 现**无任何 auth/error 键**（实测 0 命中）⇒ 前端四语 locale 必须各加两条（`data-layer.spec.md:769`）。
7. **`AUTH_*` 不得与 `LEDGER_*` 混用**：33 码关闭集**不增不减**（`DL147④`）。
## §4 资金编排契约（**本规范的核心**）

### 4.0 硬口径（批 2 / 批 3 一律遵守）

| # | 规则 | 依据 |
|---|---|---|
| **R1** | **一切资金动作必须走账本**：**禁止**任何 `INSERT/UPDATE` 写 `account.balance` / `account.frozen`；**唯一**写路径 = `SELECT ledger_post_event($1::jsonb)`（一个业务事件 = **一条语句** = 一个隐式事务） | `DL1`/`DL5`/`DL20`；`backend-ts/src/ledger.ts:866-890`（§5b 写路径） |
| **R2** | **业务行 + 分录必须同一事务**：有分录的业务动作**必须**经**业务编排函数**（`job_post_event` / `listing_post_event` / `market_post_event`）——函数内「锁业务行（主键升序）→ 派生分录 → 调 `ledger_post_event` → 回写引用列」，**不改** `ledger_post_event` 函数体 | `DL20` + C1 四条硬约束（`data-layer.spec.md:341`）；`DL141`–`DL144` |
| **R3** | **无分录的写不得借账本幂等**（邀请绑定 / 商品发布 / 纯状态迁移）：其幂等靠**业务侧** `create_key text NOT NULL UNIQUE` + 业务状态机，**绝不**写一条 `ledger_entry` 占位 | **`DL99`**（`data-layer.spec.md:559`） |
| **R4** | **「审核通过 → 发放」必须原子**：`approve` 与**发放**（`job_payout`+`job_fee`+`commission`）**必须**在 `job_post_event(op='settle')` 的**同一条语句**内完成。**批 2 不得交付任何 approve 路径**（否则 = 状态落了 `approved`、钱没出 = **静默欠款**）。结论：`/api/tasklist/:jID/verify`（:1000）与 `POST /api/job/:jobId/review` **整条归批 3**；批 2 的 `reject` 分支若实现，**必须**同样经 `op='refund'`（`job_escrow_refund`）在同一语句内退托管 | 父单定案③ + `DL20`；`migrations/0013_job.sql:617-634,650-687` |
| **R5** | **批 2 只做非资金写入与状态机**：一切余额/冻结变动（`job_escrow`/`job_payout`/`job_fee`/`commission`/`purchase`/`sale`/`purchase_refund`/`hold`/`hold_release`/`trade`/`trade_fee`/`mint`/`burn`/`listing_fee`/`listing_deposit`/`currency_create_fee`）留批 3 | 父单定案③ |
| **R6** | **编排函数自派生幂等键，调用方不得自造**（`DL95`）；**创建类**动作多一个调用方传入的 `create_key`（`cli:` 前缀，`DL94`）。同键同指纹 ⇒ **200 重放**（`idempotent_replay:true`，**不重写业务行**、**不追加 `ledger_event_keys` 项**）；同键异指纹 ⇒ **409** | `DL93`/`DL94`/`DL95`/`DL143`/`DL144`/`DL149`；`commission.ts:117-120` |
| **R7** | **事件级 kind 白名单是硬闸**：每个 op 只允许上表列出的 kind，越界 = **`LEDGER_ACCOUNT_GUARD_VIOLATION`（500，defect，必须告警）** —— 例如 `job` 的 `publish` 只许 `job_escrow`（`migrations/0013_job.sql:637-645`） | `DL84`；`migrations/0013_job.sql:638-644` |

### 4.1 关闭集（**不得扩展**；改集合必须走 migration + 回写 spec）

| 集合 | 取值 | 真源 |
|---|---|---|
| **kind（恰好 20）** | `mint` `burn` `transfer` `hold` `hold_release` `hold_forfeit` `job_escrow` `job_escrow_refund` `job_payout` `job_fee` `commission` `purchase` `sale` `purchase_refund` `trade` `trade_fee` `listing_fee` `listing_deposit` `currency_create_fee` `reversal` | `backend-ts/src/ledger.ts:153-160`（`LEDGER_KINDS`）；`migrations/0003_kind_close_set_20.sql:65-66`；`R40` |
| **ref_type（恰好 8）** | `job` `listing` `listing_order` `market_order` `market_trade` `currency` `commission_payout` `system` | `ledger.ts:164-167`；`migrations/0001_ledger_core.sql:84-86`（`ledger_ref_type_enum`） |
| **平台保留 uid** | `0` 平台主体（`$` 铸币源）· `-1` 手续费归集（**只进不出**，`R103`）· `-2` 佣金池（唯一入口 `job_fee`、唯一出口 `commission`）· `-3` 罚没 | `ledger.ts:128-137`；`migrations/0001_ledger_core.sql:96-107`（`ledger_owner`） |
| **hold 家族（同账户 2 条）** | `hold` `hold_release` `job_escrow` `job_escrow_refund` `listing_deposit` | `ledger.ts:174-175`（`HOLD_KINDS`） |
| **冻结可直接结算给对方的 kind** | `job_payout` `purchase` `trade` `hold_forfeit` | `ledger.ts:178-180`（`FROZEN_SETTLE_KINDS`） |
| **`-1` 可 credit 的 kind** | `trade_fee` `listing_fee` `currency_create_fee` `job_fee`（**`debit` 恒空**） | `ledger.ts:541`；`migrations/0008_platform_revenue_job_fee.sql:49` |
| **`-2` 的进出** | credit：`job_fee`；debit：`commission` | `ledger.ts:542` |

### 4.2 业务事件总表（触发端点 → 编排函数 → kind → 必需字段 → 幂等键 → 失败/回滚 → 期望码）

> 「期望码」只列**主要**码；完整逐路由码面见 `docs/data-layer.spec.md:719-742`（§11.2）。

| # | 事件 | 触发端点 | 编排函数 / 入口 | 事件 kind（**必须在 §4.1 关闭集内**） | 必需字段 | 幂等键 | 失败 / 回滚语义 | 期望码 | 批 |
|---|---|---|---|---|---|---|---|---|---|
| **J1** | 招工发布 + 托管 | `POST /api/job` | `job_post_event(op='publish')`（`0013:431`） | `job_escrow` **×2** | `create_key`(`cli:`)、`employer_uid`、`cid`、`reward`、`title?`、`description?`、`request_fingerprint` | **create_key** = `job.create_key`（UNIQUE）；**事件根键** = `biz:job:escrow:<job_id>`（函数派生，`0013:555`） | 单语句隐式事务：业务行 + 2 条分录**同生同灭**；任何闸失败 ⇒ 整事件回滚（**不留孤儿 job 行**） | `400` LD005/LD016/LD017/LD022；`404` LD007/LD023；`409` LD001/LD008（未上市，`0013:562-565`）/LD011/LD003 | 批 3 |
| **J2** | 申请报名 | `POST /api/job/:jobId/apply` | **直 DML**（无分录，R3） | **无** | `job_id`、`worker_uid`、`create_key`(`cli:`) | `job_application.create_key`（UNIQUE）+ `UNIQUE(job_id,worker_uid)`（`0014:91`） | 单语句事务；`job.status<>'open'` ⇒ 拒 | `409` LD011 + `not_open_job`/`self_application_not_allowed`；同键 ⇒ 200 重放；**异键同人** ⇒ `409` LD003 + `application_already_exists`（**不得**让裸 `23505` 落 400） | 批 2 |
| **J3** | 雇主选定打工人 | `POST /api/job/:jobId/accept` | **直 DML** | **无** | `job_id`、`application_id`、`actor=employer` | 业务侧：`job_application.status` 状态机 + **部分唯一索引** `uniq_job_application_accepted`（`0014:102`） | 单语句事务；并发「同时选定」由部分唯一索引**结构性**挡 | `403` `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`（非雇主）；`409` LD011 + `JOB_STATE_INVALID`/`application_already_accepted` | 批 2 |
| **J4** | 提交交付物 | `POST /api/job/:jobId/submit` | **直 DML** | **无** | `job_id`、`worker_uid`、`deliverable`、`create_key`(`cli:`) | `job_submission.create_key`（UNIQUE）（`0014:127`） | 单语句事务；`job.status` → `submitted` | `403` `AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`（非打工人）；`409` LD011 + `not_job_worker` | 批 2 |
| **J5** | **审核通过 → 发放 + 手续费 + 10 级返佣** | `POST /api/tasklist/:jID/verify`（:1000）/ `POST /api/job/:jobId/review` | `job_post_event(op='settle')`（`0013:591-592,632-633`） | `job_payout` **×2** + `job_fee` **×2**（`fee>0` 时）+ `commission` **×2N**（每层减方 `-2` / 增方受益人；`x_L=0` 的层**不建分录**） | `job_id`、`request_fingerprint`；（`gross` = `job.reward`，`worker_uid` 必须已选定） | **事件根键** = `biz:job:settle:<job_id>`（`= commission.ts:119 jobSettleKey`，**只由 job_id 派生**） | 单语句：`job_payout`→`job_fee`→`commission` 全在同一事件；**任一失败 ⇒ 全部回滚**（**不存在「状态 settled 但没发放」**）；重放 ⇒ 不重写业务行 | `409` LD002（在冻不足）/LD011 + `JOB_STATE_INVALID`；`500` LD032（**佣金守恒断言**，见 §4.4-R2）/LD030 | 批 3 |
| **J6** | 拒绝 / 取消 → 退托管 | `POST /api/job/:jobId/cancel` / `review(reject)` | `job_post_event(op='refund')`（`0013:583-589,624-630`） | `job_escrow_refund` **×2** | `job_id`、`to_status ∈ {cancelled, rejected}` | `biz:job:refund:<job_id>` | 单语句回滚；`escrow_txid IS NULL` ⇒ **拒**（防凭空退款，`0013:618-623`） | `400` LD016 + `not_a_refund_target`；`409` LD011 + `JOB_STATE_INVALID`/`job_escrow_missing` | 批 3 |
| **P1** | 商品上架 / 编辑 / 下架 | `POST /api/listing`（+ 编辑/下架同路径） | **直 DML**（`DL99`：无分录） | **无** | `seller_uid`、`cid`、`price`、`stock`、`title`、`create_key`(`cli:`) | `listing.create_key`（UNIQUE）（`0015:131`） | 单语句事务；状态机 `draft→listed→{delisted,frozen}→listed`（`delisted` 终态） | `409` LD011 + `listing_state_invalid`；`400` LD016/LD017 | 批 2 |
| **P2** | 商品下单（付款即交付） | `POST /api/listing/:listingId/buy` | `listing_post_event(op='buy')`（`0015:449`） | `purchase` **×1** + `sale` **×1**（**恰好两条**，`DL85`） | `create_key`(`cli:`)、`listing_id`、`buyer_uid`、`quantity`、`request_fingerprint` | **create_key** = `listing_order.create_key`；**事件根键** = `biz:listing:buy:<order_id>`（`0015:624`） | 单语句：`listing` 行锁 → `listing_order` 落行 → 2 条分录 → 回写 `pay_txid`；**超卖靠行锁 + `stock>=0` CHECK** | `409` LD001 + `listing_stock_insufficient`/LD008 + `listing_not_listed`/LD011；`400` LD019 + `self_purchase_not_allowed`/LD018/LD020；`404` LD023 + `listing_not_found` | 批 3 |
| **P3** | 交付 | （无独立端点） | — | — | — | — | 「付款即交付」：`listing_order.status` 由 `buy` 事件置 `paid` 并回写 `pay_txid` | — | — |
| **P4** | 退款 | `POST /api/listing/order/:orderId/refund` | `listing_post_event(op='refund')`（`0015:661-726`） | `purchase_refund` **×2** | `order_id` | `biz:listing:refund:<order_id>`（`0015:667`） | 单语句；`status<>'paid'` / `pay_txid IS NULL` ⇒ 拒；**库存不回滚**（`DL62` 未定 ⇒ 不发明，未决 §7-7） | `409` LD001/LD011 + `order_not_refundable`/`order_pay_missing`；`404` LD023 | 批 3 |
| **M1** | 交易所挂单 | `POST /api/market/order` / `POST /api/order`（:637） | `market_post_event(op='order')`（`0016:393`） | **`hold` ×2**（同 uid 同 cid） | 买单：`create_key`(`cli:`)、`owner_uid`、`side='buy'`、`base_cid`、`quote_cid`、`price`、`amount`；卖单同（`side='sell'`） | **create_key 即事件根键**（`cli:<uuid>`，`0016:545`） | 单语句；冻结额 = 买单 `amount×price` / 卖单 `amount`；`quote_cid` **恒 1**；base≠quote；`currency` 必须 `listed`（`0016:560-565`） | `400` LD016（`QUOTE_CID_MUST_BE_ONE`/`BASE_QUOTE_CID_EQUAL`）/LD017/LD022；`404` LD007；`409` LD001/LD008 | 批 3 |
| **M2** | 撤单 | `DELETE /api/market/order/:orderId` / `DELETE /api/order/:oID`（:669）/ `DELETE /api/order`（:656，入参走 query） | `market_post_event(op='cancel')`（`0016:618-685`） | **`hold_release` ×2** | `order_id` | `biz:market:cancel:<order_id>`（`0016:625`） | 单语句；释放剩余在冻额（`(amount−amount_filled)×price` / `amount−amount_filled`）；`≤0` ⇒ 拒；状态 `open/partial → cancelled` | `409` LD011 + `MARKET_ORDER_STATE_INVALID`/`market_order_nothing_to_release`；`404` LD023 + `order_not_found` | 批 3 |
| **M3** | 撮合成交 | （撮合服务调用；批 3 新端点） | `market_post_event(op='trade')`（`0016:687-...`） | **`trade` ×4** + **`trade_fee` ×2**（`fee=0` ⇒ 只 4 条） | `buy_order_id`、`sell_order_id`、`taker_order_id`、`amount`、`price`、`fee?` | `biz:market:trade:<taker_order_id>:<fill_no>`（`0016:382`） | 6 条分录同一事件；**成交价必须等于买单限价**（否则拒，`0016:58-63`）；`amount_filled` 单调且 `≤ amount` | `400` LD016 + `TAKER_NOT_A_PARTY`/`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`；`409` LD001/LD002 | 批 3 |
| **C1** | 自定义积分创建 | `POST /api/currency` | **未实现**（无编排函数） | （设计：`currency_create_fee` → `-1`） | `symbol`、`name`、`decimals`、`owner_uid` | 待定 | 未实现 ⇒ 批 3 建编排（**先裁定 §7-3**） | — | 批 3 |
| **C2** | 上市 → 收保证金 | `POST /api/currency/:cid/list` | **未实现** | （设计：`listing_deposit` / `listing_fee`，**组合未裁**） | `cid`、`actor=owner_uid` | 待定 | 未实现 ⇒ 批 3（**先裁定 §7-3**）；状态迁移 `draft→listed` 必须**同事务写 `currency_status_log`** | `409` LD011/LD014 + `not_currency_owner`；`404` LD007 | 批 3 |
| **R1** | 邀请绑定（**终身绑定**） | `POST /api/referral/bind` | `referral_bind(child,parent)`（`0007:241`） | **无分录**（`DL99`/CR19 明令） | `child_uid`、`parent_uid`（`depth` **不得**作入参，`0007:187`） | 业务侧：`referral` PK(`child_uid`) ⇒ **一 child 一 parent 且不可变**（`0007:67` append-only 触发器） | 单语句；串行化 = `users` 两行 `FOR UPDATE`（uid 升序，`0007:205-206,255-256`） | 同 (C,P) ⇒ 200 重放；C 已绑他人 ⇒ `409` LD003 + `REFERRAL_ALREADY_BOUND`；自指 ⇒ `400` LD016 + `REFERRAL_SELF_BIND`；成环 ⇒ `400` LD016 + `REFERRAL_CYCLE_REJECTED` | 批 2 |
| **R2** | 打工酬金 → 平台费 → **10 级返佣按权重分发** | （由 J5 触发，无独立端点） | `job_settle_plan(...)`（`0013:250`）+ `job_post_event(op='settle')` | `job_payout` `job_fee` `commission` | `fee_rate_bp ∈ [100,500]`（**= 1%–5%**）、`levels ∈ [1,10]`、`weights_bp`（Σ ≤ 10000） | `biz:job:settle:<job_id>` | **最大余数法**：`Σx_L == P` **构造保证**（`D = P − Σq` 按 `(r_L DESC, L DESC)` 补 1）；**分配失败 = 500 defect**（`0013:342-360`） | 见 J5 | 批 3 |
| **R3** | 变更佣金政策（后台可设） | `POST /api/admin/commission_policy` | `insertCommissionPolicy`（`commission.ts:240`） | **无分录**（插一行政策） | `fee_rate_bp`、`levels`、`weights_bp`、`effective_from?`、`created_by` | 无（INSERT-only 表；`effective_from` **严格递增**） | 单语句 `INSERT ... WHERE NOT EXISTS(≥ now())`；失败 ⇒ 无行 ⇒ 400 | `400` LD016 + `FEE_RATE_OUT_OF_RANGE`/`POLICY_SHAPE_INVALID`/`WEIGHTS_SUM_EXCEEDS_10000`/`POLICY_WEIGHTS_ALL_ZERO`/`POLICY_EFFECTIVE_BACKDATED` | 批 2 |
| **A1** | 管理员调分（**保留但锁死**） | `POST /api/admin/points/adjust`（:1066） | `ledger_post_event(op='mint'\|'burn')` | `mint` / `burn`（**仅 `$` = cid 1**） | `target_uid`、`cid=1`、`amount`、**必填原因码** | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | 单语句；**禁止**直接 UPDATE `account`；`burn` 受 `R25` 限制 | `403` `AUTH_FORBIDDEN`；`400` LD022/LD016 + `points_adjust_amount_invalid`/`reason_code_missing`；`500` LD031 | 批 3 |

### 4.3 资金四栏（**谁出钱 / 谁收钱 / 平台费的来源 / 佣金的来源与分配**）

| 事件 | **谁出钱** | **谁收钱** | **平台费的来源** | **佣金的来源与分配** |
|---|---|---|---|---|
| **J1 发布托管** | 雇主（`employer_uid`）**可用余额** `−reward` | **无人**（转为雇主自己的**冻结** `+reward`） | — | — |
| **J5 结算（R2 核心）** | 雇主（从**冻结额**出）`−net`（`job_payout`）+ `−fee`（`job_fee`） | 打工人 `+net`（`job_payout`） | **`fee = (gross×fee_rate_bp + 5000)/10000`**（**全项目唯一取整点**，半进位；`fee_rate_bp ∈ [100,500]` ⇒ **1%–5%**，后台可设）。**有邀请人 ⇒ 全额入 `-2`（佣金池，`D6` 平台不抽成）**；**无邀请人 ⇒ 全额入 `-1`（平台收入）** | **来源 = 佣金池 `-2` 的全额 `fee`**（不是额外再收）；**分配** = 沿 `referral` 链上溯 `M = min(levels, chain_depth)` 层，按 `weights_bp[1..M]` **重归一化**（`W = Σ_{L≤M} w_L`，**不是 10000**）用**最大余数法**分配 ⇒ **`Σx_L == fee` 逐分不差**；`x_L = 0` 的层**不建分录** |
| **J6 退托管** | 雇主（从**冻结额**出 `−reward`） | 雇主自己（可用余额 `+reward`） | — | — |
| **P2 商品下单** | 买家（**可用余额** `−amount`，`amount = listing.price × quantity`） | 卖家 `+amount`（`sale`） | **无平台费**（`DL85` 钉死**恰好两条**：`purchase`+`sale`；商品柱不抽成） | — |
| **P4 退款** | 卖家（**可用余额** `−amount`） | 买家 `+amount`（`purchase_refund` ×2） | — | — |
| **M1 挂单** | 挂单人（买单：`$` 可用 → 冻结 `amount×price`；卖单：base 币 `amount`） | **无人**（冻结） | — | — |
| **M2 撤单** | 挂单人（冻结 → 可用） | 挂单人自己 | — | — |
| **M3 成交** | 买方 `−quote`、卖方 `−base`（**均从各自冻结额结算**；`trade` ×4） | 买方 `+base`、卖方 `+quote` | **`trade_fee` = `amount × 费率`**，**承担方 = taker**，**币种恒 `$`（cid=1）**，**是消耗不是冻结**（`撤单不退`，`DL87`）；**全额入 `-1`** | — |
| **R1 邀请绑定** | **无人出钱**（`DL99`/CR19 明令不得写分录） | — | — | — |
| **A1 调分** | 平台（`mint`）或目标用户（`burn`） | 目标用户（`mint`）或（`burn` ⇒ 无受款方，净减发） | — | — |
| **C2 上市保证金** | 币种 `owner_uid` | **未裁**：`listing_deposit` 是**冻结**（`HOLD_KINDS` 含它，`ledger.ts:174`）**还是消耗入 `-1`**（`-1` credit 白名单**不含** `listing_deposit`，`ledger.ts:541`）⇒ **未决 §7-3** | **同一未决** | — |

### 4.4 逐条补充判决（写死，实现方不得自选）

1. **J5 的 `fee = 0` 退化**：`fee = 0` ⇒ 事件**只有** `job_payout` ×2（**不写** `job_fee`、**不写** `commission`、**不报错**）；派生键集合 = `{K, K#2}`。依据：`commission.ts:20-22`（CR51）。
2. **J5 的 DB 侧后置断言（第二道防线）**：`migrations/0007_referral_and_commission_policy.sql:317` 的 `trg_ledger_entry_commission_conservation` 对同一 `event_root_key` 断言 `Σcommission 出 -2 == Σjob_fee 入 -2`，失败抛 **`LD032` ⇒ `LEDGER_RECONCILE_MISMATCH` ⇒ 500 defect + R108 告警**（`0021:37` 的诚实边界：**只**断言 `-2` 池进出守恒，**不**断言「受益人分对了人」）。
3. **归属闸（应用层，落账前）**：`assertReferralChainInvariants`（`commission.ts:360`）对邀请链做**结构断言硬拒**（`no_duplicate_uid` / `contiguous_levels` / `all_user_uids`），失败 ⇒ `500` + `reason=COMMISSION_CHAIN_ASSERTION_VIOLATED`（**环污染时 Σ 守恒仍成立**，DB 侧断言会**放行** ⇒ 必须在应用层拦，`commission.ts:340-359`）。
4. **锁序不依赖传序、但数组顺序必须确定性可复现**：R79 全序由 DB 内部 `SELECT DISTINCT uid,cid ORDER BY 1,2` 决定（「数组顺序不影响锁序」）；**但**数组顺序决定**派生键序号与错误优先级** ⇒ 分录数组必须由模块按 `idx` 重建（`commission.ts:28-32`）。
5. **`DL141` 加锁全序**：**业务行（主键升序）→ `currency`（cid 升序）→ `account`（uid 升序）**；编排函数**必须**在调 `ledger_post_event` **之前**持有业务行锁；**禁止**「先锁 account 再锁业务行」（`data-layer.spec.md:341` ①）。
6. **币种状态闸**：招工酬金 / 商品标价 / 交易所挂单**只允许 `listed` 单位**（`R28`）；`draft`⇒`409 LD008`、`frozen`⇒`423 LD009`、`delisted`⇒`409 LD010`；**平台/保留 uid 前置闸** ⇒ `400 LD022`。**这两道闸必须在路由层先跑**（`DL125`）。
7. **`-1` 只进不出（`R103`）**：任何把 `-1` 当付款方的动作**一律拒**（`LEDGER_RESERVED_UID` + `PLATFORM_DEBIT_FORBIDDEN`，`ledger.ts:548-558`）；`platform_withdraw` **未实现且未获批准**（`DL153`）。
8. **`platform` mint 授权**：`$` 的 `owner_uid=0`，只有平台受信任路径可铸（`R23`/`LD014`）。
9. **单笔金额上限** `1e15`（`MAX_SINGLE_AMOUNT`，`ledger.ts:143`）；金额一律**最小单位整数**（入参十进制字符串走 DB 换算，`R66`/`R70`）。
10. **`job_fee` 入 `-1` 的分支已在 DB 白名单**（`0008`）：无邀请人时 `job_fee` credit 到 `-1` 走的是 `0008` 加白的通道（`ledger.ts:538-541`），**不是**例外。

### 4.5 幂等键总表（创建键 vs 事件根键）

| 动作 | 创建键（调用方传，`cli:`） | 事件根键（**函数派生**） | 真源 |
|---|---|---|---|
| 招工发布 | `job.create_key` = `cli:<uuid-v4>` | `biz:job:escrow:<job_id>` | `0013:555` |
| 招工结算 | — | `biz:job:settle:<job_id>` | `0013:592` = `commission.ts:119` |
| 招工退款 | — | `biz:job:refund:<job_id>` | `0013:589` |
| 商品下单 | `listing_order.create_key` = `cli:<uuid-v4>` | `biz:listing:buy:<order_id>` | `0015:624` |
| 商品退款 | — | `biz:listing:refund:<order_id>` | `0015:667` |
| 交易所挂单 | `market_order.create_key` = `cli:<uuid>`（**即**事件根键） | 同左 | `0016:545` |
| 交易所撤单 | — | `biz:market:cancel:<order_id>` | `0016:625` |
| 交易所成交 | — | `biz:market:trade:<taker_order_id>:<fill_no>` | `0016:382` |
| 管理员调分 | — | `ops:<admin_uid>:points_adjust:<target_uid>:<cid>:<seq>` | §4.1 #54（`data-layer.spec.md:292`） |
| 后台设置写 | — | `ops:<admin_uid>:<action>:<key>` | `DL36`（`data-layer.spec.md:326`） |
| 邀请绑定 | 无账本键（业务侧 `referral` PK） | **无** | `DL99`/`0007:241` |
| 报名 / 提交 | 各表 `create_key` = `cli:<uuid>` | **无** | `DL99`/`0014:89,127` |

**规则**：键前缀**只允许** `biz:` `cm:` `cli:` `ops:`（`ledger.ts:404`）；键**不得**含 `#`（内部派生分隔符）与控制字符；校验顺序固定 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`（`ledger.ts:419-451`，与 DB 侧 `0005` **同序同码**）。

### 4.6 批 2 / 批 3 切分（**实现交付清单**）

| 批 | 交付内容（本册口径） | 理由 |
|---|---|---|
| **批 2** | ① J2/J3/J4（报名 / 选定 / 提交；**无分录**）；② P1（商品上架/编辑/下架；**无分录**）；③ R1 邀请绑定；④ R3 佣金政策插行；⑤ 后台与读口换源：`/api/admin/permissions*`→`admin_role*`、`/api/admin/settings*`→`app_config`（**撤 `settings/reset`**）、`/api/user/all|stats`、`/api/user/profile`、`/api/market/*/candles`（`candle_view`）、`/api/user/points|ledger`、`/api/referral/earnings`；⑥ `GET /api/task/:tID` miss ⇒ **404**；⑦ `DL155` 收口（`db.ts:252` 加 `public.`）；⑧ §5 弃用面落地 | **一切资金动作留批 3**（父单定案③）；批 2 的副作用面只有**业务行状态与引用列** |
| **批 3** | J1/J5/J6、P2/P4、M1/M2/M3、A1、C1/C2（含**上市保证金**，先裁定 §7-3）、`/api/tasklist/:jID/verify` 与 `/api/job/:jobId/review` 的 approve 分支；全部经 §4.2 的编排函数 | 涉及资金守恒、幂等、重放 ⇒ 必须端到端（含 P1/P2 套件回归） |
| **批 4** | 路径切换（§4.1 目标命名）+ 前端迁移 + 弃用面 410→删除 | 需前端先迁（§5.4） |
## §5 弃用面与前端同步（**最终处置 = 本册裁定**）

### 5.1 逐项最终处置表

| 面 | 端点（`index.ts:行号`） | 现状（实测） | **本册最终处置** | 前端消费点（`文件:行号`） | 前端改造要求 | 过期日 |
|---|---|---|---|---|---|---|
| 碎片读口 ① | `GET /api/shard`（:557） | `401`（无令牌）/ 令牌下 `200` 空数组 + 顶层 `deprecated:true` | **保留路径 + 保持空态 + `deprecated:true`**（读口不返回错）；语义由 `/api/user/points`（`account` 按 cid）取代 | `ProfilePage.jsx:92`、`RewardPage.jsx:58`、`ShardPage.jsx:301`、（文案提及）`admin/ShardsManagement.jsx:136` | 迁移到 `GET /api/user/points`（批 3 后端就绪后）；**禁止**新代码再调 `/api/shard` | **批 4 转 410 → 删除** |
| 碎片读口 ② | `GET /api/shard/transfer`（:572） | 同上 | **保留路径 + 空态 + `deprecated:true`**；语义由 `GET /api/user/ledger?kind=transfer` 取代 | `ShardPage.jsx:303` | 迁移到 `/api/user/ledger` | **批 4 转 410 → 删除** |
| 碎片写口 ① | `POST /api/shard/redeem`（:587） | 未测（写端点） | **批 2 起一律 `410` + `R107` 形状**（写动作**不得**用空态 200 冒充成功） | `RewardPage.jsx:196` | **删除该按钮/分支**（碎片兑换在 `cid` 模型里无对应语义；等值动作 = 交易所 `trade` 或 `transfer`） | 批 3 末删除路径 |
| 宝箱写口 | `POST /api/chest/:bID/open`（:605） | 未测（写端点） | **批 2 起一律 `410`**（「凭空调入余额」与 `DL5` 双分录正面冲突） | `RewardPage.jsx:217` | **删除该按钮/分支**；若未来要做 ⇒ 走 `mint`/`purchase` 且**单独裁定** | 批 3 末删除路径 |
| 商品持有读口 | `GET /api/prize-item`（:420） | `401`（无令牌）；令牌下读 `listing_order`（**真实语义**） | **保留且正式化：不删路径、不标 `deprecated`**（它已承载「我买过的商品」= `listing_order.status='paid'`）。理由：B1-c 已把它接到新 schema，硬删会丢真实读口且前端 3 处消费 | `ProfilePage.jsx:106`、`HomePage.jsx:119`、`RewardPage.jsx:56` | **无需迁移**（键集 6 键冻结）；批 4 可另开规范路径 `/api/listing/order/mine` 作别名 | 无（长期保留） |
| 登录别名 | `POST /api/auth/login`（:264） | 内部 `req.url` 改写 → `app._router.handle` 转发 `/api/auth/verify`（**隐藏双路径**） | **批 2 改为 `410`**：同一实现两条路径 = 两套指纹面 = 客户端重试语义分叉（§4.1 #10 逐字「**删除 `login`**，只留 `verify`」） | **0 处**（本册实测：`frontend/src` 内 `auth/login` **0 命中**） | 无（前端无消费） | 批 4 删路径 |
| 注册残件 | `POST /api/auth/register`（:228） | 固定发 `410`（形状未对齐 `R107`） | **批 2：保留 `410` 但把响应体改为 `R107` 形状**（`{error:{code:'LEDGER_REF_NOT_FOUND',message,i18n_key,details}}`，`DL35` 过渡条）；批 4 删路径 | **仅测试**：`frontend/src/test/unit/auth.test.js:75`（断言抛 `deprecated endpoint`） | **必须同步该测试**（否则单测必红）：保留断言 410，或随批 4 改断言 404 | 批 4 删路径 |
| 后台发布招工 | `POST /api/admin/task/{create,update,delete}`（:842/:855/:876） | 未测（写端点；底层仍引 `task` 旧表） | **批 2 起一律 `410`**（用户需求③：管理员不再在后台发布 task/reward） | `admin/TasksManagement.jsx:130`（update）、`:140`（create）、`:177`（delete） | **页面只读化**（删三个写按钮）；列表仍可用 `GET /api/task/all` | 批 4 删路径 |
| 后台发布商品 | `POST /api/admin/prize/{create,update,delete}`（:894/:907/:928） | 未测 | **批 2 起一律 `410`**（**C3 ① 终审「整体删除」**）；合规下架另立 P6 `/api/admin/listing/:id/takedown` | `admin/RewardsManagement.jsx:154`（update）、`:164`（create）、`:201`（delete） | **页面只读化**（删三个写按钮）；列表仍可用 `GET /api/prize/all` | 批 4 删路径 |
| 一键重置设置 | `POST /api/admin/settings/reset`（:750） | 未测 | **批 2 起一律 `410`**（**C3 ② 终审「删除」**：无审计的批量破坏写） | `admin/SystemSettings.jsx:123` | **删除该按钮**；逐项改走 `POST /api/admin/settings`（每条一键 + 一条留痕） | 批 4 删路径 |
| 资产初始化 | `POST /api/admin/assets/init`（:1056） | 未测（**无 `requireAdmin` 守卫**） | **批 2 起一律 `410`**（§4.1 #53 删除；账户由 DB 按需 0/0 开户，`R75`） | **0 处**（本册实测） | 无 | 批 4 删路径 |
| 权限面板弃用标 | `GET /api/admin/permissions`（:763） | B1-c 打了顶层 `deprecated:true` | **撤销 `deprecated`**（批 2 换数据源到 `admin_role*` 后即正式口） | `admin/PermissionsManagement.jsx:55` | 无需改（键集不变）；`:133/:176` 的 save/delete 继续用 | 无 |

**统一要求（对全部 13 个 `410` 面）**：`410` 响应体**必须**是 `R107` 形状（`{error:{code,message,i18n_key,details}}`），`code` = `LEDGER_REF_NOT_FOUND`；**禁止**回 HTML、禁止 200 空态、禁止裸文本。依据：`DL35`（`data-layer.spec.md:325`）逐字「若确需过渡，只能用 410 + `{error:{code:'LEDGER_REF_NOT_FOUND'}}` 且**登记过期日**」。

### 5.2 前端同步清单（按文件，**批 2 门禁**）

| 文件 | 必改点 | 触发原因 |
|---|---|---|
| `frontend/src/pages/RewardPage.jsx` | 删 `:196`（`/api/shard/redeem`）、`:217`（`/api/chest/:bID/open`）两条写调用与其 UI 分支 | §5.1（410） |
| `frontend/src/pages/admin/TasksManagement.jsx` | 删 `:130` / `:140` / `:177` 三条写调用（页面只读化） | §5.1（410） |
| `frontend/src/pages/admin/RewardsManagement.jsx` | 删 `:154` / `:164` / `:201` 三条写调用（页面只读化） | §5.1（410） |
| `frontend/src/pages/admin/SystemSettings.jsx` | 删 `:123`（reset）按钮 | §5.1（410） |
| `frontend/src/test/unit/auth.test.js` | `:75` 断言与 `410` 形状对齐（批 4 随路径删除改断言） | §2.3 登记 |
| `frontend/src/locales/{zh,en,hk,vn}.json` | **各加 2 键**：`auth.err.AUTH_UNAUTHORIZED` / `auth.err.AUTH_FORBIDDEN`（现 0 命中，实测） | §3.3-6（`data-layer.spec.md:769`） |
| `frontend/src/pages/ShardPage.jsx` | `:328-329` 的 `DELETE /api/order`（**带 body 的全撤**）必须在批 3 前改为**入参走 query** 的形态（后端将不再读 body） | §1 #27 + 未决 §7-5 |
| 全部 23 个文件 | **键集冻结**：批 2/批 3 期间不得依赖任何**新增**响应键（本册 §2 母约束 F1） | §2 |

### 5.3 `deprecated` 标记的**当前实况**（实测，防误读）

顶层 `deprecated:true` 现由 `sendSuccess` 的第 5 参下发（`index.ts:26`，B1-c 新增**可选**参数，**不改 `data` 形状**），当前仅 3 处传：`/api/shard`（:559）、`/api/shard/transfer`（:573）、`/api/admin/permissions`（:765）。依据：`p4-b1-get-triage.md:482-484,574`。⇒ **本册要求**：批 2 撤掉 `/api/admin/permissions` 的 `deprecated`（§5.1 末行）；`/api/shard` 与 `/api/shard/transfer` 的保留到批 4。

### 5.4 三阶段时序（**写死**）

1. **批 2**：13 个面转 `410`（形状对齐 `R107`）；前端按 §5.2 删除调用；`/api/auth/login` 拆掉转发；`/api/prize-item`、`/api/admin/permissions` 撤 `deprecated`。
2. **批 3**：后端上线规范读口（`/api/user/points|ledger`、`/api/referral/earnings`、`/api/market/:baseCid/candles`）⇒ 前端把 `/api/shard*` 的读调用迁过去。
3. **批 4**：前端迁移验收后，13 个 `410` 路径**删除**（走 §1.3 404 兜底）；`/api/shard`、`/api/shard/transfer` 同批删除；测试断言同步。**上线日需 Kevin 确认**（未决 §7-1）。

## §6 权限单一真源（`users.is_admin` × `admin_role*`）

### 6.1 单一真源（唯一口径，**禁止双源**）

```
can_access_admin(uid) := users.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = :uid)
```

- **真源位置**：`migrations/0017_platform_config.sql:88-90`（DL72 逐字）；该口径是**数据层可验证查询**，`0017` **不自创函数**（`:31-32`）。
- **`users.is_admin` = 总开关**：`boolean NOT NULL DEFAULT false`（`migrations/0002_user_identity.sql:15`）；`0017` **绝不 ALTER `users`**（`:29`），其自检**断言该列必须在场**（`:329-333`）。
- **旧 `permission_group` 已废弃**（DL72「不复用」，`:110`）；**旧 `isAdminAddress` 双源禁止**（`:33`）。

### 6.2 判定顺序（**写死**，实现方不得重排）

| 步 | 条件 | 结果 | 码 / `details.reason` |
|--:|---|---|---|
| 1 | `requireActor`：无 / 坏 token | **`401`** | `AUTH_UNAUTHORIZED` |
| 2 | 有 actor 但 `can_access_admin = false` | **`403`** | `AUTH_FORBIDDEN` + `reason=NOT_ADMIN` |
| 3 | `is_admin = true`（总开关命中） | **放行**（**不再查 `requiredPermission`**） | — |
| 4 | 否则必须命中 `requiredPermission`（数组 = **OR** 语义） | 命中 ⇒ 放行；未命中 ⇒ **`403`** | `AUTH_FORBIDDEN` + `reason=PERMISSION_NOT_GRANTED` |
| 附 | 「已参与但无该动作权限」（业务角色守卫） | **`403`** | `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`（**C6 裁定：不得借 `LEDGER_HOLD_NOT_ALLOWED`**） |

依据：`DL105`（`data-layer.spec.md:607`）+ `DL122`/`DL147`（`:754-755`）+ §11.3.2（`:771-778`）。

### 6.3 四张表的角色与守卫

| 表 | 主键 | 语义 | 守卫（`0017`） |
|---|---|---|---|
| `admin_role`（`:93`） | `role_key` | 角色定义（`name` 可空文本） | 可变引用表：**PK 列不可变**、**DELETE 允许**（撤销角色定义） |
| `admin_permission`（`:103`） | `permission_key` | 权限定义（`name` 可空文本） | 同上 |
| `admin_role_permission`（`:112`） | `(role_key, permission_key)` | 角色→权限（2 条 FK） | PK 对不可变；DELETE 允许（移除一项权限） |
| `admin_user_role`（`:123`） | `(uid, role_key)` | 用户→角色（`uid` **FK `users(uid)`**） | PK 对不可变；DELETE 允许（**撤销角色分配必须可删行**） |

**守卫函数（3 个，`0017` 的「守门函数」）**：`platform_config_key_immutable`（`:161`，PK/键列被 UPDATE ⇒ 原生 `P0001`）、`platform_config_touch_updated`（`:181`，`app_config.time_updated` 由触发器刷新，**不接受客户端传时间**）、`currency_status_log_append_only`（`:192`，`BEFORE UPDATE OR DELETE` 无条件 RAISE）。
**诚实边界**：`TRUNCATE` 不触发行触发器、超管 `DISABLE TRIGGER USER` 可旁路 ⇒ **不得**表述为「绝对不可变」（`:59-60`）。

### 6.4 `GET /api/admin/me` 的目标形状（§4.1 #34）

`{uid, evm, is_admin, permissions[]}`（`data-layer.spec.md:272`）；`permissions[]` = `admin_role_permission` ⋈ `admin_user_role`（**`is_admin = true` 时按「全权限」语义处理**，不得回空数组）。
**登记缺口**：`0017` **只建表、不插种子**（`admin_permission` 0 行）⇒ `requiredPermission` 的**权限键取值集合未落库** ⇒ 批 2 必须先裁定权限键清单（**未决 §7-8**）。

## §7 未决项（**需人类裁**，实现方不得自选）

| # | 未决项 | 本册倾向（裁定前按此实现，但必须留可切换点 `DL42`） | 依据 / 冲突点 | 阻塞什么 |
|--:|---|---|---|---|
| **7-1** | **旧路径 → `§4.1` 新命名的切换时点**（含 13 个 `410` 面的**过期日**与批 4 上线日） | 批 2/批 3 **保留既有路径**；批 4 在前端迁移验收后切换 | `data-layer.spec.md:249-293`（§4.1 目标命名）vs 父单「49 条前端路径必须保留」；`DL35`（410 必须登记过期日） | 批 4 全部；`410` 面的合规性（无过期日 = 违规） |
| **7-2** | **`GET /api/user` 的响应形状** | **批 2 保持现有键集**（§2 母约束 F1 优先）；新形状另开 `/api/user/points` | `DL24` 要求返回 `{cid,symbol,decimals,balance,frozen}` **集合**、**禁单个裸数字**（`data-layer.spec.md:253`）vs 前端 `auth.js:142`、`Header.jsx:71` 的既有键 | 批 2 的 `/api/user` 交付；`DL24` 的履约时点 |
| **7-3** | **自定义积分「上市 → 收保证金」的资金口径** | **未实现前不得接线**（批 3 先建编排函数 + 先裁此点） | `backend-ts/src/ledger.ts:174`（`HOLD_KINDS` **含** `listing_deposit` ⇒ 冻结语义）**vs** `ledger.ts:541`（`-1` credit 白名单**不含** `listing_deposit` ⇒ 无法「消耗入平台收入」）；`0003_kind_close_set_20.sql:5-6` 已删 `listing_deposit_refund`/`_forfeit`；用户需求 4「上市需消耗一定积分作为保证金」 | 批 3 的 C1/C2；用户需求 4 的**可交付性** |
| **7-4** | **撮合算法**（价格—时间优先 / 价差改善）**归谁、怎么定** | 批 3 **不得发明**：成交必须由撮合服务显式给出 5 个字段；**成交价 = 买单限价**（否则拒） | `DL68` 的 v0.6 加注：币对级串行化**未实现**、归属 **P5 路由层**（`data-layer.spec.md:455`）；`migrations/0016_market.sql:58-63`「登记式缺口」第 2 条 | 批 3 的 M3；走势图/盘口的业务正确性 |
| **7-5** | **`DELETE /api/order`（带 body 的全撤）最终形态** | **保留路径，入参改 query**（后端不再读 body）；前端 `ShardPage.jsx:328-329` 同步 | §4.1 #30 **驳回**该条目（理由 = DELETE 带 body 在 CDN/代理层不可靠，`data-layer.spec.md:268`）vs 前端**确实在消费**它 | 批 2/批 3 的撤单面；前端迁移 |
| **7-6** | **`/api/admin/task/*` 与 `/api/admin/prize/*` 的 `410` 生效时点 / 后台页面是否整页下线** | `410` 随批 2 生效；页面**只读化**（不整页删） | C3 ①（prize 整体删除）、§4.1 #42–#44（task 删除，管理员只留**仲裁** `/api/admin/arbitration/*`，P6）vs 前端 `TasksManagement.jsx`/`RewardsManagement.jsx` 仍有入口 | 后台运维面（P6 排期） |
| **7-7** | **退款是否回滚 `listing.stock`** | **不回滚**（不发明；`DL62` 明写「由 P4 spec 定 / 登记为未定」） | `migrations/0015_listing.sql:56`（文件头登记式缺口） | 批 3 的 P4 |
| **7-8** | **`requiredPermission` 的权限键取值集合**（`admin_permission` 种子） | 批 2 先落**最小集**（如 `review_tasks` / `manage_permissions` / `manage_settings` / `finance`），并**必须**与前端 `admin-utils.js` 现有权限位对齐 | `migrations/0017_platform_config.sql:103`（表存在、**0 行**、无种子）；`DL105④` 依赖 `requiredPermission` | 批 2 的 `/api/admin/*` 权限面；`/api/admin/me` 的 `permissions[]` |
| **7-9** | **`422` 的启停** | **本册已裁定：不启用**（§3.2）；如产品需要「语义非法」独立状态 ⇒ **新裁** | `ledger-errors.ts:28-70`（33 码无 422） | 无（已定；登记防复发） |
| **7-10** | **`time_claimed` / `points_claimed` 的「无对应列」语义**（现恒 `NULL` / `0`） | 保留现状到批 4；归还语义由 `/api/job/:jobId/review` 的结算事件承载 | B1-b 映射决策（`p4-b1-get-triage.md:386-387,403-404`）；`migrations/0013_job.sql` 无「领取时刻」列 | 批 3 的招工读口一致性 |
| **7-11** | **`GET /api/health` 的 `public.` 收口归属**（`DL155`） | **本册已划入批 2 门禁**（`db.ts:252` 改 `public.schema_migration` 并纳入裸表名扫描） | `DL155`（`data-layer.spec.md:928,1011`）：明写「由**下一接路由的单**一并处理」 | 批 2 验收判据 |
| **7-12** | **错误文案的四语化时点** | 批 2/批 3 只保证 **`i18n_key` 契约**（`R107` 四件套），文案暂按既有 zh-only | `ledger-errors.ts:22`「D4：本期只 zh，保留 i18n 框架」vs 用户需求 7「多语言四语（zh/en/hk/vn）」 | 前端呈现层（P7） |
| **7-13** | **`/api/task-progress/claim/:jID`（:505）的拆分落点与端点命名** | 拆为 `apply`（无分录）/ `accept`（无分录）/ `settle`（有分录，随 approve）；旧路径在批 4 前保留 | §4.1 #23「**语义拆分**」（`data-layer.spec.md:261`）；旧 `claim` = 「领取奖励」 | 批 2/批 3 的招工动词面 |

## §8 变更记录 v0.1 与自曝

### 8.1 v0.1 变更记录

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| **v0.1** | 2026-09-29 | **Jing（Specifier · 制度员）** | **首版**。八节：§0 元信息/口径/权威输入（六处）+「实测支撑读数」清单；§1 **51 端点逐条处置**（live 行号，处置词表 6 类）+ 18 条新增端点 + 命名张力排期 + 404 兜底；§2 **前端契约冻结**（逐端点 key 集来源 mapper + 23 文件消费清单 + 「后端没有的路径 = 0」）；§3 **detail-miss 统一 404** + `404` 三类 + 400/401/403/404/409/410/422/423/500/503 逐码适用条件 + `R107` 七条收尾规则；§4 **资金编排契约**（R1–R7 硬口径 + 7 个关闭集 + 18 个业务事件总表 + **资金四栏** + 10 条补充判决 + 幂等键总表 + 批 2/批 3 切分）；§5 **弃用面最终处置**（碎片四件套 / `prize-item` / `auth/*` / 后台 5 面，逐条给前端 `文件:行号` 与过期日）+ 三阶段时序；§6 **权限单一真源**（`can_access_admin` + 5 步判定顺序 + 四表守卫 + 3 个守门函数）；§7 **13 项未决**；§8 本表。 |

**本册作出的关键裁定（摘要，便于质检对拍）**：① detail-miss **一律 404**（撤销 B1-b 的 `/api/task/:tID` 200 空态）；② **`/api/prize-item` 保留且正式化**（撤 `deprecated`）**≠** 碎片四件套；碎片**读口**保持空态、**写口**（`shard/redeem`、`chest/open`）转 `410`；③ **「审核通过 → 发放」必须原子** ⇒ `approve` 面**整条归批 3**（批 2 不得半实现，防静默欠款）；④ `422` **不启用**；⑤ `DL155`（`db.ts:252`）划入批 2 门禁；⑥ 13 个弃用面**统一 `410` + `R107` 形状**并登记过期日。

### 8.2 NOT_MEASURED（**未测项，禁止当 0/空使用**）

| # | 项 | 原因 |
|--:|---|---|
| 1 | **26 个 POST/DELETE 端点的运行期 HTTP status** | 本单**零请求**（禁令：不跑服务、不发写请求）；只有**静态**（代码/关系）结论 |
| 2 | `users` 表真实列名 vs `database.ts` 期望字段（`uID/EVM/bio/is_admin`） | **字段级未核对**（沿用 `p4-route-inventory.md:277` 的 NOT_MEASURED 声明；本单只读 `0002:15`、`0006:25`、`0017:329-333` 的结构片段） |
| 3 | 前端 49 条**去重**路径的精确去重结果 | 本单实测口径 = 97 行命中 / 23 文件（**文件数与父单一致**）；去重计数沿用父单 |
| 4 | `docs/data-layer.spec.md` 的 md5 复算 | 只引用父单给定前缀 `7b86b811…`；本单实测 = **1011 行 / 265649 B** |
| 5 | 非空数据下的**值**语义（余额精度换算、`review_status='pending'` 谓词、撮合派生值、`base_cid` 与 `listing_id` 的同源错配） | 库为 **seed 基线**（业务表 0 行）；承接 `p4-b1-get-triage.md:221,402-404,689-691` |
| 6 | 编排函数的**运行时**行为（重放幂等、`ledger_event_keys` 不追加、守恒断言触发） | 属批 3 套件范围，本单禁跑（**本册只引用 migration 源码与既有交付读数**） |
| 7 | `migrations/0013_job.sql:520-555`（publish 落行段）与 `0016_market.sql:720-1201`（trade 分录段尾）逐行 | 本单未读该两段；§4 的对应结论以**已读区间**（`0013:555-705`、`0016:380-719`）+ 文件头白名单为依据（**已标注「推断」处仅 §4.3 的「均从各自冻结额结算」一句**） |
| 8 | 前端 23 个文件的**上下文**（只看 `/api/` 命中行） | 未读页面全文 ⇒ §5.2 的「删除按钮」是**按调用点**给出的最小改造要求，具体 UI 由前端实现方定 |

### 8.3 探针自曝（本册的口径缺陷与更正）

1. **行号口径切换（重要）**：`docs/audit/p4-route-inventory.md:32-84` 的 §1 行号是 **B1-a..B1-d 改动前**的基线；本册 §1 一律用**实测 live 行号**（例：`POST /api/auth/register` = **:228**，inventory 记 :223）。两处引用**必须注明口径**，否则会出现「同一端点两个行号」的伪矛盾。
2. **本册 §1 的「分布」计数**含一处口径妥协（1 条同时属「保留」与「改语义」按主处置计一次）⇒ **以逐行为准**，不得用该汇总数做质检判据。
3. **`R107`/`R108` 的正文出处**：本册引用的是 `backend-ts/src/ledger-errors.ts:2-13`（R104–R107 的落点声明）与 `:79-87,462-471`（R108 的 defect 类与诊断面）；`docs/ledger.spec.md` 内以「`R107`/`R108`」为检索词的命中**集中在文首版本记录**（本单实测 10 处），**未**在 §14 表内直接检索到该两号 ⇒ 本册**不**声称逐字抄读其 §14.1 原文。
4. **`§4.1 #9`（`/api/auth/register`）的裁定文字**未在本单读到的区间内（`data-layer.spec.md:248` 起为 #10）⇒ §1 #4 的处置依据标注为「#9–#10 口径 + `DL35`」，其中 #9 属**推断**（依据 #10 的同族理由 + `DL35`）。
5. **`/api/order` 的方法级消费**已实测（`:176/:302/:328` 的 `method` 字段），但**未**逐条读其请求体形状 ⇒ §1 #27 的「入参走 query」是**裁定**而非现状描述。
6. 本单**未**读 `frontend/src/locales/*.json` 本体，只引用 `data-layer.spec.md:769` 的实测声明（该声明写「现无任何 auth/error 类键」）⇒ 属**转引**，批 2 落地前应自行复验。

### 8.4 声明

本单**只写** `docs/route-layer.spec.md`（与可选快照 `docs/versions/route-layer.spec.v0.1.md`）。**未**改 `backend-ts/**`（含 `src`/`migrations`/`scripts`）、**未**改 `frontend/**`、**未**改 `docs/*.spec.md`（`data-layer.spec.md` / `ledger.spec.md` 只读）、**未**改 `docs/versions/**` 既有文件、**未**改 `docs/qa/**`、`docs/audit/**`、`docs/seafood.master-plan.md`；**未**做任何 SQL 写操作（本单对库**零写**，亦**零连接**）；**未**跑任何服务/套件；**未** `npm install`；**未**用 `execute_code`；**未**落盘连接串；**未** `git add/commit/push`；**未**用 `pkill -f`/`killall`。
