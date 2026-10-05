# S32c · `sendError` 同族（偏离 D）R107 **迁移执行**收口报告（`s32c-senderror-migration-executed`）

> **角色**：Kong（实现方）｜**台账**：B5 下半 · `route-layer.spec §15.5 偏离 D`（`sendError` 同族旧形状 `{success:false,message,error}`）
> **本单 = 执行单**：按 Zang 三条终审（① 7 status 冲突 ⇒ 前推 404 `LEDGER_REF_NOT_FOUND` 入 `sendRefNotFound` 先例；② 2 shard IO catch ⇒ `sendInfraMapped`；③ `#21 /api/admin/points/adjust` `details.field` 三分派照同路由既有先例）迁移 **16 处**；剩 **9 处「无合适码」保留 `sendError` 旧形状 + 逐条登记**（不改码集、不硬造）。
> **硬口径自证**：只改 `backend-ts/**` + 报告/产物｜码闭集 **33 + AUTH_* 2 一字不动**｜未回退 S31（`errorMessageOf` 单一真源 + 英文句表）｜未改保留那 9 处｜**禁 `pkill -f`/`killall`**｜**不 `commit` / 不 `push`**｜无 `npm install`｜未碰 `.env*`｜原始输出**无 `.log` 后缀**。
> **语言**：中文 · 逐条给命令与读数

---

## §0 开工态与对锚

| 项 | 读数（逐字） |
|---|---|
| `git log --oneline -3` | `2f20f89 chore(scripts): S32b 扫清 message 契约改造的下游探针漂移 … + S32 交回 sendError 26 处（现取 25）码映射可行性表与探针（零产品改动）+ 报告` ／ `fa7bce4 docs: §5.350/v0.350 …` ／ `86e3a33 fix(errors): S31+B5 上半 …` |
| `git rev-parse HEAD` | `2f20f89…` = **含 S32b/S32 那笔** ✓（派单锚点） |
| `git status --porcelain`（**开工态**） | **tracked = 空**（仅 `??` untracked 历史 artifact 目录）⇒ 工作树干净 ✓ |
| 被检件 `backend-ts/src/index.ts` 开工 sha（`git hash-object`） | `2295618d24d594f6466114d8fa501174a3be38c8`（= S32 报告对锚值，**逐字相同**✓） |
| 码闭集真源 | `backend-ts/src/ledger-errors.ts:31-86`（`LEDGER_ERROR_TABLE` **33**）+ `:90-93`（`AUTH_ERROR_MESSAGES` **2**） |
| 输入表 | `docs/audit/s32-senderror-r107-migration.md §1`（25 处逐处表：7 可借码 / 2 借通路 / 7 status 冲突 / 9 无合适码） |
| 输入探针 | `backend-ts/scripts/s32-00-senderror-inventory.ts`（类级断言 C1–C5） |

**入口口径（现取，与 S32 §0 逐字一致）**：`sendError` 定义 = `src/index.ts:152-156`（旧形状）；`grep -c 'sendError('` = **50**（含注释）；剔注释 ⇒ **实调用 = 25 处**（探针判定）。

**★ 现取行号说明**：本报告「改前」行号 = S32 报告 §1 的现取行号（`src/index.ts` 开工 sha `2295618d…` 未变 ⇒ 逐字可比）；「改后」行号 = 本单执行后现取（见 §1 表；`#21` 因三分派拆成 3 支、其后各行号整体后移）。

---

## §1 ★ 16 处逐处前后对照（status + code + i18n_key + message 英文句 + details 键 · **逐字**）

**R107 通用形状**（`src/job-service.ts:22-34` `ledgerErrorBody`）：`{ error: { code, message, i18n_key, details } }`（**无顶层 `success` / `message` / `error` 三键**）。

### 1.A 「status 冲突」7 处 ⇒ **前推 404** `sendRefNotFound` 先例（终审①）

> 先例 = `src/index.ts:2302-2305` `sendRefNotFound(res,refType,refId,reason)` ⇒ `404` + `ledgerErrorBody('LEDGER_REF_NOT_FOUND','Referenced object not found',{ref_type,ref_id:refId||'null',reason})`。
> 依据 = `route-layer.spec §3.1 C1`（`:988` / `:3022`，**已冻结**）：非整数 / 缺 id ⇒ **`404 LEDGER_REF_NOT_FOUND` + `details.reason=<x>_not_found`**；批 3b 已在 `/api/tasklist/:jID/verify` 落地（`Zang §5.85 裁定②`）；前端 23 文件全量扫无旧 `400 Invalid xxx` 断言。★ **旧 `status` 一律 `400 → 404`**（派单 brief 原「status 不变」之保守口径已被本裁定取代）。

| # | 路由 | 改前（行·status·message） | 改后（行） | status | code | i18n_key | message（英文句） | details（**真实值，非占位**） |
|--:|---|---|--:|--:|---|---|---|---|
| 4 | `GET /api/task/:tID` | `:567` · **400** · `'Invalid tID'` | `:567` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'job', ref_id:<raw :tID>, reason:'tID_not_found'}` |
| 5 | `GET /api/prize/:bID` | `:596` · **400** · `'Invalid bID'` | `:596` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'prize', ref_id:<raw :bID>, reason:'bID_not_found'}` |
| 9 | `GET /api/user/asset/:uID` | `:661` · **400** · `'Invalid user ID'` | `:661` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'user', ref_id:<raw :uID>, reason:'uID_not_found'}` |
| 10 | `GET /api/task-progress/:jID` | `:926` · **400** · `'Invalid jID'` | `:926` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'job_submission', ref_id:<raw :jID>, reason:'jID_not_found'}` |
| 12 | `POST /api/task-progress/:identifier/submit` | `:961` · **400** · `'Invalid task or task progress id'` | `:961` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'job', ref_id:<raw :identifier>, reason:'job_not_found'}` |
| 16 | `GET /api/market/:bID/orderbook` | `:1168` · **400** · `'Invalid bID'` | `:1166` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'brand', ref_id:<raw :bID>, reason:'bID_not_found'}` |
| 17 | `GET /api/market/:bID/trades` | `:1185` · **400** · `'Invalid bID'` | `:1183` | **404** | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'brand', ref_id:<raw :bID>, reason:'bID_not_found'}` |

**★ status 变动逐处明写**：`#4/#5/#9/#10/#12/#16/#17` **400 ⇒ 404**（依据 `§3.1 C1` 冻结口径 + `Zang §5.85 裁定②`；码不变 `LEDGER_REF_NOT_FOUND`）。

**逐处 `ref_type` / `reason` 取值依据（真实值，非占位）**：
- `#4 :tID` → `ref_type='job'`（**同路由** detail-miss `:578` 逐字已用 `ref_type:'job'`；`/api/task/:tID` 底层对象 = `job`）；`reason='tID_not_found'`（对齐 `§3.1` 既有先例命名 `<param>_not_found`，arg = `:tID`）。
- `#5/#6 :bID` → `ref_type='prize'`（`/api/prize/*` 面业务对象 = prize；`getPrizeById`）；`reason='bID_not_found'` / `'prize_not_found'`。
- `#9 :uID` → `ref_type='user'`（`/api/user/asset/:uID`）；`reason='uID_not_found'`。
- `#10/#11 :jID` → `ref_type='job_submission'`（`:jID` 语义 = `submission_id`（S2 换轴）；**同参数名先例** = `job-funds-service.ts:382/390` `ref404('job_submission', identText, {reason:'jID_not_found'})` + `index.ts:2044` `ref_type:'job_submission'`）；`reason='jID_not_found'`。
- `#12 :identifier` → `ref_type='job'`（S3：`:identifier` 语义 = 目标 `job_id`；先例 = `index.ts:2451` `/api/job/:jobId/submit` 逐字 `sendRefNotFound(res,'job',…,'job_not_found')`）；`reason='job_not_found'`。
- `#16/#17 :bID` → `ref_type='brand'`（market 面 `bID` = brand id；存取器 `DatabaseService.getBrandById(bID)`；`listOrderBook`/`listTradesByBrand` 皆以 `base_cid = bID`）；`reason='bID_not_found'`。
- **`ref_id`** 一律取**原始路径参数字符串**（`String(req.params.<p> ?? '')`，经 `sendRefNotFound` 的 `refId || 'null'` 归口）⇒ 非数字入参原样可读（不静默成 `0`）。`#6/#8/#11` 取**已解析整数** `String(bID)` / `String(actor.user.uID)` / `String(jID)`。

### 1.B 「可借码」7 处

| # | 路由 / 面 | 改前（行·status·message） | 改后（行） | status | code | i18n_key | message（英文句） | details 键 |
|--:|---|---|--:|--:|---|---|---|---|
| 3 | `POST /api/auth/verify`（凭据段 catch） | `:484` · **401** · `error.message`（回显） | `:484` | 401 | `AUTH_UNAUTHORIZED` | `auth.err.AUTH_UNAUTHORIZED` | `Authentication is required` | `{}`（`sendAuthError(res,401)`；AUTH 域，不入 33 闭集） |
| 6 | `GET /api/prize/:bID`（miss） | `:601` · **404** · `'Prize not found'` | `:601` | 404 | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'prize', ref_id:String(bID), reason:'prize_not_found'}` |
| 8 | `POST /api/user/profile`（miss） | `:641` · **404** · `'User not found'` | `:641` | 404 | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'user', ref_id:String(actor.user.uID), reason:'user_not_found'}` |
| 11 | `GET /api/task-progress/:jID`（miss） | `:935` · **404** · `'Task progress not found'` | `:935` | 404 | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'job_submission', ref_id:String(jID), reason:'jID_not_found'}` |
| 21 | `POST /api/admin/points/adjust`（缺字段） | `:2116` · **400** · `'参数不完整'`（硬编码中文） | `:2114/:2122/:2130` | 400 | `LEDGER_AMOUNT_INVALID` | `ledger.err.LEDGER_AMOUNT_INVALID` | `Request shape is invalid` | 见 1.B.21（三分派） |
| 24 | `POST /api/translate/backfill`（cron secret 不符） | `:2981` · **401** · `'Unauthorized'` | `:2999` | 401 | `AUTH_UNAUTHORIZED` | `auth.err.AUTH_UNAUTHORIZED` | `Authentication is required` | `{}` |
| 25 | `app.use` 兜底（非注册路由） | `:3030` · **404** · `'Not found'` | `:3048` | 404 | `LEDGER_REF_NOT_FOUND` | `ledger.err.LEDGER_REF_NOT_FOUND` | `Referenced object not found` | `{ref_type:'endpoint', ref_id:req.path, reason:'route_not_found'}` |

**1.B.21 三分派（终审③：照**同路由**既有先例 `:2124/:2145/:2153` 逐字沿用，不新造取值）**：

| 分支（改后行） | 触发 | status | code | message | details |
|---|--:|--:|---|---|---|
| `:2114` | `!uID`（缺 / 非数 / 0） | 400 | `LEDGER_AMOUNT_INVALID` | `Request shape is invalid` | `{field:'uid', reason:'MISSING'}` |
| `:2122` | `Number.isNaN(amount)`（缺 / 非数） | 400 | `LEDGER_AMOUNT_INVALID` | `Request shape is invalid` | `{field:'amount', reason:'MISSING'}` |
| `:2130` | `!reason`（缺） | 400 | `LEDGER_AMOUNT_INVALID` | `Request shape is invalid` | `{field:'reason', reason:'MISSING'}` |

> **取值出处（逐字）**：`field:'uid'` ← 同路由 `:2138`（`{field:'uid', uid:String(uID)}`，`uID<0` 支）；`field:'amount'` ← 同路由 `:2148`/`:2156`；`field:'reason'` ← 同路由 `:2127`；`reason:'MISSING'` ← `route-layer.spec §5.16`（`:383` 逐字冻结词表 `{NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` 的**缺失**态）+ `§15.1②`（`:4052`）；调用形态逐字复刻 `:2124/:2145/:2153`（`res.status(400).json(ledgerErrorBody('LEDGER_AMOUNT_INVALID','Request shape is invalid',{…}))`，**同 message 串**以保证**同一端点内 400 类形状集合大小 = 1**（`§15.1①⑤`））。★ 本处**原为唯一**「同端点并存 `sendError` 旧形状 400 与 R107 400」的 L7④ 违例面 ⇒ 迁移后**归零**。

### 1.C 「借通路」2 处 ⇒ `sendInfraMapped`（终审②，D1' 同族收口）

> 先例 = `src/index.ts:2347-2351` `sendInfraMapped(res,scope,error)` ⇒ `normalizeLedgerError(unwrapInfraCause(error))` + `console.error` + `res.status(normalized.httpStatus).json(toErrorResponse(normalized))`；本仓同族 IO catch **30+ 处**已走（`:545/:559/:588/:610/:625/:653/:671/:805/:876/:892/:908/:943/:991/:1075/:1178/:1196/:1218/:1275/:1294/:1315/:1363/:1793/:1820/:3025`）。

| # | 路由 | 改前（行·status·message） | 改后（行） | status | code | i18n_key | message | details |
|--:|---|---|--:|---|---|---|---|---|
| 14 | `GET /api/shard`（IO catch） | `:1032` · **500** · `'Failed to load shard holdings'` | `:1031` | **由分类器定** | **由分类器定** | `ledger.err.<CLASSIFIED>` | `LEDGER_ERROR_TABLE` 句 | 分类器派生 |
| 15 | `GET /api/shard/transfer`（IO catch） | `:1047` · **500** · `'Failed to load shard transfers'` | `:1045` | **由分类器定** | **由分类器定** | `ledger.err.<CLASSIFIED>` | 同上 | 分类器派生 |

> **status 变动**：旧**固定 500** ⇒ 交 §14 分类器：**infra 类**（驱动/传输/连接池过载）⇒ **503 `LEDGER_TX_TIMEOUT`**（`reason` 机读，如 `pg_infra_class`/`pool_connection_timeout`）；**非 PG / 真缺陷** ⇒ **500 `LEDGER_TRANSACTION_REQUIRED`**（`details` 带 `cause/reason/error_name/error_code`）。依据 = `D1'` 同族已确立口径（IO catch 不得把库不可达伪装成 500「实现缺陷」）。同时**删去**原 `console.error('Error loading shard …')`（`sendInfraMapped` 内含 `console.error('[shard.holdings|shard.transfers] infra failure:', …)`，避免双日志）。

**message 契约（终审通用）自证**：16 处的 `message` **全部**为稳定英文句（`sendAuthError`/`sendRefNotFound`/`sendInfraMapped`/`ledgerErrorBody` 各出口既有的英文句；`#21` 显式 `'Request shape is invalid'`）⇒ **无一处把机读码塞进 `message`**（`§3.3 条款 9′`）。

---

## §2 保留 9 处「无合适码」逐条登记（**不改码集、不硬造**）

| # | 路由 | 现取行 | status | message（逐字） | **为何无码可借（逐条）** |
|--:|---|--:|--:|---|---|
| 1 | `POST /api/auth/register` | `:454` | 410 | `'Registration has moved to wallet sign-in plus profile completion'` | `AUTH_*` 域只有 401/403 **无 410**；借 `LEDGER_REF_NOT_FOUND`（410 先例 `:2405/:2427` 为**弃用面**专用）会把「已迁移到钱包登录」的弃用面标成「引用对象不存在」⇒ i18n 文案不符；`sendGone` 面须带 `sunset`（本面无过期日登记）⇒ 不动。|
| 2 | `POST /api/auth/challenge` | `:462` | 400 | `error instanceof Error ? error.message : 'Failed to create auth challenge'` | 非金额形状面（`evm_address` 格式）；33 闭集**无通用 400 码**（`LEDGER_AMOUNT_INVALID` 语义 = 金额/形状面，此处为钱包地址格式，语义不符）。**另**：回显 `error.message` 属旧形状违规面 ⇒ 登记待批（非本单 16 处）。|
| 7 | `POST /api/user/profile` | `:635` | 400 | `'bio is required'` | 缺失字段（非金额）⇒ 闭集无通用 400 码；`LEDGER_AMOUNT_INVALID` 语义 = 金额/交易形状，用在 `bio` 缺省上不符。|
| 13 | `POST /api/task-progress/:identifier/submit` | `:965` | 400 | `'info_input is required'` | 缺失字段（非金额）；同上。|
| 18 | `POST /api/admin/permissions/save` | `:1848` | 400 | `error instanceof Error ? error.message : 'Failed to save permission group'` | 非金额形状面（权限组字段）⇒ 闭集无通用 400 码。**另**：回显 `error.message` 违规 ⇒ 登记。|
| 19 | `POST /api/admin/permissions/delete` | `:1870` | 400 | `error instanceof Error ? error.message : 'Failed to delete permission group'` | 同上。**另**：回显 `error.message` 违规 ⇒ 登记。|
| 20 | `POST /api/admin/user/update` | `:1892` | 400 | `error instanceof Error ? error.message : 'Failed to update user'` | 同上。**另**：回显 `error.message` 违规 ⇒ 登记。|
| 22 | `POST /api/job/:jobId/submit` | `:2470` | 400 | `'info_input is required'` | 缺失字段（非金额）⇒ 同 #13（与 `:965` 逐字一致，别名面）。|
| 23 | `POST /api/translate/backfill` | `:2993` | 503 | `'CRON_SECRET not configured'` | 配置缺失面；`LEDGER_TX_TIMEOUT`（503）语义 =「系统繁忙」（不符）；`LEDGER_FEE_RATE_INVALID`（500）status 不符 ⇒ 闭集无适配码。|

> **保留面合计 = 9**（`#1/#2/#7/#13/#18/#19/#20/#22/#23`）⇒ 均维持 `sendError` 旧形状（`{success:false,message,error}`）**逐字不动**（终审命令「只登记不硬改」+ `§15.1④`「同族 `sendError` 面只登记不扩面」）。**未改码集、未硬造码。**

---

## §3 前端消费面逐处核查（**只读 grep；依赖者只登记不硬改前端**）

**参考实现（全站唯一出口）** `frontend/src/auth.js:347-369 fetchApiJson` = `if (!response.ok || !payload?.success) throw …`（R107 **无顶层 `success`** ⇒ `!undefined === true` ⇒ **仍判为错误**，**方向一致**）；`apiErrorMessage`（`:329-345`）**已双形态**处理 `payload.error`（`typeof === 'object'` 取 `message`/`code`/`i18n_key`；`typeof === 'string'` 取原文）⇒ **迁移后免改前端即可消费**。

| # | 对应路径 | 前端消费点（现取） | 是否依赖旧形状？ | 判定 |
|--:|---|---|---|---|
| 3 | `POST /api/auth/verify` | `auth.js:382` `verifyAuthChallenge`（fetchApiJson） | 否（走 `!success` 抛错 + 双形态 error） | **兼容** |
| 4 | `GET /api/task/:tID` | `pages/RewardPage.jsx:103`（fetchApiJson） | 否 | **兼容** |
| 5/6 | `GET /api/prize/:bID` | `pages/listings/listing-api.js:55` `fetchListingDetail`→`getJson`→fetchApiJson；`ListingDetailPage.jsx` | 否（`listing-api.js:18` 注释已写「miss ⇒ 404（R107）」） | **兼容** |
| 8 | `POST /api/user/profile` | `auth.js:422`（fetchApiJson） | 否 | **兼容** |
| 9 | `GET /api/user/asset/:uID` | `admin-utils.js:79`、`components/Header.jsx:70`（裸 `fetch`+`if(response.ok)`）、`pages/HomePage.jsx:107`、`pages/RewardPage.jsx:50,108` | 否（`response.ok` 真值判：400/404 皆 `!ok`，行为一致） | **兼容** |
| 10/11 | `GET /api/task-progress/:jID` | `components/ClaimRewardModal.jsx:24`（裸 `fetch` + `if(data && data.success)` else 分支走 `apiErrorMessage`）；`pages/RewardPage.jsx:100` | 否（R107 无 `success` ⇒ 落 else 错误分支，方向一致） | **兼容** |
| 12 | `POST /api/task-progress/:identifier/submit` | `pages/jobs/job-api.js:78` `postJson`→fetchApiJson；`JobDetailPage.jsx` | 否 | **兼容** |
| 14 | `GET /api/shard` | `pages/ShardPage.jsx`（**已删调用**，仅注释；`:5`） | 否（**无 live 调用**） | **兼容** |
| 15 | `GET /api/shard/transfer` | `pages/ShardPage.jsx`（**已删调用**，仅注释；`:8`） | 否（**无 live 调用**） | **兼容** |
| 16 | `GET /api/market/:bID/orderbook` | `pages/admin/ShardsManagement.jsx:62`（fetchApiJson；错误 ⇒ catch ⇒ 空表） | 否 | **兼容** |
| 17 | `GET /api/market/:bID/trades` | `pages/admin/ShardsManagement.jsx:76`（同上） | 否 | **兼容** |
| 21 | `POST /api/admin/points/adjust` | `pages/admin/PointsManagement.jsx:116`（fetchApiJson；成功面读 `result.new_points`/`result.timestamp`，**成功形状未变**） | 否（错误 ⇒ 抛错；`400 R107` 与旧 `400 旧形状` 皆 `!success`） | **兼容** |
| 24 | `POST /api/translate/backfill` | **前端 0 命中**（cron 专用） | 否 | **无消费面** |
| 25 | `app.use` 兜底 404 | 任意未注册路径 | 否（R107 404 与旧 404 皆 `!ok`） | **兼容** |

**旧形状断言全量扫（负面结论）**：`grep -rn "Invalid bID\|Invalid tID\|Invalid jID\|Invalid user ID\|Prize not found\|Task progress not found\|User not found\|参数不完整\|Failed to load shard" frontend/src` = **0 命中**；`grep -rn "success === false\|success===false" frontend/src` = **0 命中**；`frontend/src/test` 内 `success: false` 命中**均属他面**（`/submissions` 面板、wallet-signature 401、`apiErrorMessage` 泛用例、`JobDetailPage` 的 `sendVerbError` R107 mock），**无一针对本 16 处**。

⇒ **依赖旧形状者 = 0**（无硬改前端需求；未碰 `frontend/**`）。

---

## §4 类级断言（探针前后读数）

探针 = `backend-ts/scripts/s32-00-senderror-inventory.ts`（离线 · 零 DB · 零 HTTP）｜产物 `.s32c-artifacts/<runid>/s32-00-senderror-inventory-{before,after,neg,green}.json`

| 断言 | 口径 | **改前（before）** | **改后（after）** | 判定 |
|---|---|---|---|---|
| **C1 实调用数**（剔注释） | `grep -c` − 注释行 | **25**（`real_calls=25`，`S32_EXPECT_CALLS=25`） | **9**（`real_calls=9`，`S32_EXPECT_CALLS=9`） | ✓ 25 → 9 |
| **C2 新增码** | `LEDGER_*`==33 **且** `AUTH_*`==2 | **0 新增**（`ledger=33 auth=2`） | **0 新增**（`ledger=33 auth=2`） | ✓ 一字不动 |
| **C3 message 命中机读码** | 逐处 `sendError` message ∈ 全大写下划线码 | **0**（`hits=0 []`） | **0**（`hits=0 []`） | ✓ |
| **C4 注册点** | `grep -cE '^app\.(get\|post\|…)\('` | **89** | **89** | ✓ 不动路由 |
| **C5 计数完整性** | 命中行 == 实调用 + 注释行 | **50**（`calls=25 comments=25`） | **34**（`calls=9 comments=25`） | ✓（见下 ★） |
| **探针 SUMMARY** | — | `total=5 passed=5 failed=0`（EXIT 0） | `total=5 passed=5 failed=0`（EXIT 0） | ✓ |

**命令（逐字）**：
```
cd backend-ts
S32_EXPECT_CALLS=25 npx ts-node --transpile-only scripts/s32-00-senderror-inventory.ts            # before → EXIT 0
S32_EXPECT_CALLS=9 S32_EXPECT_HITS=34 npx ts-node --transpile-only scripts/s32-00-senderror-inventory.ts   # after → EXIT 0
npx ts-node --transpile-only scripts/s32-00-senderror-inventory.ts --selftest                     # SELFTEST PASS → EXIT 0
```

**★ 探针漂移修正（C5，本单唯一探针改动，登记于 §8）**：C5 原将命中行总数**硬编码 `=== 50`**（S32 零改动基线的快照常量）。本单迁移按设计令命中行 50 → 34 ⇒ 该常量过期。修正 = 抽出 `S32_EXPECT_HITS`（默认 `'50'`），**与既有 `S32_EXPECT_CALLS` 同法**（env 可覆盖）⇒ before 无 env 即绿（25+25=50），after 传 `S32_EXPECT_HITS=34` 即绿（9+25=34）。C1–C4 语义与读数**一字未改**。

**保留 9 处 `sendError` 现取清单（C1 明细 · 改后行号）**：`:454`(410) · `:462`(400) · `:635`(400) · `:965`(400) · `:1848`(400) · `:1870`(400) · `:1892`(400) · `:2470`(400) · `:2993`(503)。

---

## §5 全量门对照（**11 门 + `p7b-03`**，前后逐门对照，非只跑同名门）

**运行器**：`backend-ts/.s32c-artifacts/run_gates.sh <before|after>`（复刻 S31/S32 口径；`npx ts-node --transpile-only`）｜产物 `.s32c-artifacts/<runid>/{before,after}/`。
**实例口径**：两带实例 HTTP 腿目标（`P8S7_BASE`=5797 / `P8S10_BASE`=5796）**本机未运行**（未启停任何端口；**未用 `pkill -f`/`killall`**）⇒ HTTP 腿预期**环境性 `fetch failed`**。

| 门 | **before**（现取） | **after**（现取） | 对照 | 红点分流 |
|---|---|---|---|---|
| `p8-s1-app-config` | 24/24 EXIT 0 | 24/24 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s2-fee-rebate` | 44/44 EXIT 0 | 44/44 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s3-deposit` | 45/45 EXIT 0 | 45/45 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s3b-address` | 38/38 EXIT 0 | 38/38 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s4-currency-review` | 79/79 EXIT 0 | 79/79 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s5-compliance` | 117/117 EXIT 0 | 117/117 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s6-site-text` | 64/64 EXIT 0 | 64/64 EXIT 0 | 逐字一致 ✓ | — |
| `p8-s7-batt-checkin` | 56/59 EXIT 1（`db=7 http=1`） | 56/59 EXIT 1（`db=7 http=1`） | 逐字一致 ✓ | **3 红** = `G8/G9/G10`（`fetch failed` / `status:-1`）**环境性 HTTP 腿** ⇒ 非真回归 |
| `p8-s8-rating-timeliness` | 89/92 EXIT 1（`db=13 http=1`） | 89/92 EXIT 1（`db=13 http=1`） | 逐字一致 ✓ | **3 红** = `httpLive` 组（`fetch failed`）**环境性 HTTP 腿** ⇒ 非真回归 |
| `p8-s9-bttc` | 100/100 EXIT 0（`db=10`） | 100/100 EXIT 0（`db=10`） | 逐字一致 ✓ | — |
| `p8-s10-invite-reward` | 48/49 EXIT 1（`db=3`） | 48/49 EXIT 1（`db=3`） | 逐字一致 ✓ | **1 红** = `fetch failed` **环境性 HTTP 腿** ⇒ 非真回归 |
| `p8-s11-audit-console` | 86/87 EXIT 1（`db=6`） | 86/87 EXIT 1（`db=6`） | 逐字一致 ✓ | **1 红** = `fetch failed` **环境性 HTTP 腿** ⇒ 非真回归 |
| `p7b-03-offline-gates` | 37/37 EXIT 0（`red=[]`） | 37/37 EXIT 0（`red=[]`） | 逐字一致 ✓ | —（含 `AC10` 码闭集 33 / 注册点 89） |
| **合计** | 13 门全跑；红 = **8 条 HTTP 腿**（s7×3 / s8×3 / s10×1 / s11×1） | 同左（8 条） | **13/13 逐门逐字不变** ✓ | **8 红全为环境性 HTTP 腿 · 真回归 = 0** |

**★ 门读数与 S32「before」逐字对齐**（同一态未变代码）+ 本单 `after` 与 `before` **逐门逐字相等** ⇒ **零连带回归**。**未启用受控实例**（未触碰他单 5787/5788）。

**`tsc` 门**：`cd backend-ts && npx tsc --noEmit` ⇒ **EXIT 0**（`AC6` ✓）。
**脚本面 tsc（`tsconfig.scripts.probe.json`，额外自证）**：HEAD 版 96 错 / 现值 96 错 / **错误集 `diff` 逐字相同** ⇒ 本单脚本改动**新增错 = 0**（96 错全为**既有**他文件漂移，非本单引入）。

---

## §6 判负（红 → 绿）

**判据** = 类级断言 **C1（实调用数）**：把**某一处已迁移面改回旧形状** ⇒ 实调用数 9 → 10 ⇒ C1 必红。变异**只在仓外副本**（不碰 `src/index.ts`）。

- **副本**：`.s32c-artifacts/<runid>/negctl/index.NEG.ts`（`cp` 自 `src/index.ts`，**改 1 处**：`:601` `sendRefNotFound(res,'prize',String(bID),'prize_not_found')` → 旧 `sendError(res, 404, 'Prize not found')`）。
- **NEG（必红）**：`S32_TARGET=…/index.NEG.ts S32_EXPECT_CALLS=9 S32_EXPECT_HITS=35 npx ts-node …` ⇒
  `C1 pass=false real_calls=10` · `C5 total=35` ⇒ **SUMMARY failed=1 · EXIT=1** ✓
- **GREEN（复原回绿）**：`S32_EXPECT_CALLS=9 S32_EXPECT_HITS=34`（真 `src/index.ts`）⇒ `C1 pass=true real_calls=9` ⇒ **SUMMARY 5/5 · EXIT=0** ✓（`src/index.ts` **从未被变异**；`git status` 无残留）。
- **内存自判负** `--selftest` ⇒ `NEG1`(码入 message)=红 · `NEG2`(闭集 34)=红 · `GREEN`(英文句)=绿 ⇒ **`SELFTEST PASS`**（EXIT=0）。

---

## §7 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因（逐字） |
|---|---|---|
| 验证码面 `migrations/**` | **未碰** | 本单零迁移改动（硬口径只改 `backend-ts/**` + 报告/产物） |
| `frontend/**` | **未碰** | 依赖旧形状者 = 0（§3）⇒ 无硬改需求 |
| 带实例 HTTP 腿（s7 `G8/G9/G10` · s8 `httpLive` · s10/s11 `fetch failed`） | **环境性未覆盖** | 受控实例（5796/5797）未运行 ⇒ `fetch failed`；**非真回归**（§5） |
| 16 处迁移的**真 HTTP 响应体逐字取证** | **NOT_MEASURED** | 离线门 + 零实例 ⇒ 未对运行端点发真请求；形状由 `ledgerErrorBody`/`sendAuthError`/`sendRefNotFound`/`sendInfraMapped` 源码 + 已注册先例（批 3b 已实测同一 helper 落 404）推证 |
| `#21` 三分派的**真端点 HTTP 复现**（缺 `uID`/`amount`/`reason` 三支的 400 响应体） | **NOT_MEASURED** | 同上（无实例）；`details` 取值与调用形态**逐字**对齐同路由既有 `:2124/:2145/:2153` 先例 |
| `sendInfraMapped`（#14/#15）**运行期分类结果** | **NOT_MEASURED** | 分类器逐支逻辑已有 `p7b-03 AC14`（注入 `53300/XX000/58030` ⇒ 503）离线覆盖；**本两处的活体触发**未跑（需真库不可达注入） |
| 前端真渲染回归（Playwright e2e / 前端套件） | **未跑** | 本单不改前端；依赖面已 grep 取证（§3）⇒ 依硬门口径非本单面 |
| `tsconfig.scripts.json` 的 96 条既有错 | **既有基线** | 全为他文件漂移（`qa-p1e-*` 等），非本单引入（HEAD/现值错误集 `diff` 相同，§5） |

---

## §8 自曝

1. **★ 探针 C5 漂移修正（本单唯一非 `src/index.ts` 代码改动）**：`backend-ts/scripts/s32-00-senderror-inventory.ts` 的 C5 原硬编码 `=== 50`；迁移后命中行按设计 50 → 34 ⇒ 改为 `S32_EXPECT_HITS`（默认 `'50'`，**与既有 `S32_EXPECT_CALLS` 同法**）。**C1–C4 语义与读数一字未改**；**before 无 env 仍绿（50）**，故「改前读数」可复算。**自陈理由**：探针漂移随代码面同步是 S32b 已确立惯例（HEAD 笔名即「扫清 … 下游探针漂移」）；若强行不改，探针将因**过期常量**恒 `EXIT=1`，反而失去类级断言之力。
2. **`ref_type` 取值系本单按「该面语义」判定**（终审①要求「给真实值、不得占位」）：`job`(×2) / `prize`(×2) / `user`(×2) / `job_submission`(×2) / `brand`(×2) / `endpoint`。其中 `brand`（market 面）与 `prize`（prize 面）取值**源自本仓存取器/端点命名**（`getBrandById`；`/api/prize`），非 `ref_type` 关闭集成员（`§3.1` 明示 `ref_type` 为**开放取值域·业务对象名**）。若终审对 `#16/#17` 期望其它业务对象名（如 `listing`/`currency`），一句话可改（`sendRefNotFound` 第 2 参）。
3. **`#11`（`:935`）未采用 S32 表 `ref_type:'task_progress'` 的建议**，改用 `ref_type='job_submission'` + `reason='jID_not_found'`：依据 = 同一 `:jID` 参数名的**已落地先例**（`job-funds-service.ts:382/390` 对 `/api/tasklist/:jID/verify` 非数字 `:jID` 即用 `ref404('job_submission', …, {reason:'jID_not_found'})`）+ 本路由 `:jID` 语义 = `submission_id`（S2 换轴）、底层行在 `job_submission`。**此为对齐先例的现取判定，非新造码/新造值**。
4. **`#21` message = `'Request shape is invalid'`**（非 `errorMessageOf('LEDGER_AMOUNT_INVALID')` = `'The amount format is invalid'`）：**逐字复刻同路由既有 400 支** `:2124/:2145/:2153` 以保「同一端点内 400 类形状集合大小 = 1」（`§15.1①`）；`code`/`i18n_key` 不变。**若**终审要求端点内 `message` 取表句，则该三支既有 400 亦须同改（**越本单范围**，登记待裁）。
5. **`app.use` 兜底 `#25`**：`sendRefNotFound(res,'endpoint',req.path,'route_not_found')` ⇒ `ref_id = req.path`（可能含 query 之外的路径串；未去 query，`req.path` 语义即路径）⇒ 若期望 `req.originalUrl` 或去敏，一句话可改。
6. **`#14/#15` 双日志已去**：删原 `console.error('Error loading shard …')`（`sendInfraMapped` 内含 scope 日志）—— **行为变更仅日志前缀**（`[shard.holdings]`/`[shard.transfers]`），对外响应无关。
7. **未触碰**：`frontend/**` / `migrations/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`；**无 `npm install`** / **未碰 `.env*`** / **未用 `pkill -f`·`killall`** / **未 `commit`·`push`** / **未启停 5787·5788**。
8. **工作树 residue 管理**：探针产物默认落 `.s32-artifacts/`；本单将该目录的 run 文件以**符号链接**指到交付目录 `.s32c-artifacts/<runid>/`（避免双份），**收尾时恢复** `.s32-artifacts/CURRENT_RUNID` 原值并移除该符号链接 ⇒ `backend-ts/**` 仅 `src/index.ts` + `scripts/s32-00-*.ts` 两处 tracked 改动（`git status --porcelain | grep -v '^??'`）。

---

### 附 · 本单产物路径（原始输出**无 `.log` 后缀**）

- **交付报告**：`docs/audit/s32c-senderror-migration-executed.md`（本件）
- **代码改动（tracked，2 文件）**：`backend-ts/src/index.ts`（16 处）· `backend-ts/scripts/s32-00-senderror-inventory.ts`（C5 env 化）
- **产物目录**：`backend-ts/.s32c-artifacts/<runid>/`
  - `s32-00-senderror-inventory-before.json` / `-after.json` / `-neg.json` / `-green.json`
  - `probe-after.stdout.txt` / `probe-neg.stdout.txt` / `probe-green.stdout.txt`
  - `negctl/index.NEG.ts`（判负副本）
  - `before/<gate>.txt` + `before/_summary.txt` · `after/<gate>.txt` + `after/_summary.txt`
  - `run_gates.sh` · `CURRENT_RUNID`
