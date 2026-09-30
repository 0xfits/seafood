# P5 · MISSING-TABLES-TRIAGE — 「缺表族」影响面取证 + 批 5 清单

> 单号 = **P5-TRIAGE** · 角色 = **Kong（实现方 · 本单只取证不裁决）** · 日期 = 2026-09-30 CST
> run tag = **p5triage-20260930T144143Z** · 产物 = `backend-ts/.p4-artifacts/p5triage-20260930T144143Z/`
> 脚本 = `backend-ts/scripts/p4z-p5t-01-probe.ts` · `backend-ts/scripts/p4z-p5t-02-d1p.ts`
> **性质 = 只取证 / 只列选项**：不选边、不推荐落法、不改码、不写 `src/**` `migrations/**` spec `frontend/**`。
> 报告骨架**先行落盘**（200 字节骸架），随后逐段回填；每节自带上行 `文件:行号` 支撑读数。

## §0 待判 / 结论摘要

**★ 首个问题（产品关键）的答案 = 「**两条活路由**都还有人在用**」**

1. **`POST /api/auth/verify` **在 EVM 登录主链上**** —— 唯一前端调用点 `frontend/src/auth.js:169`，由 `frontend/src/components/auth/WalletAuthPanel.jsx:111` 调用，而 `WalletAuthPanel` 被**两个在册登录面**挂载：`frontend/src/components/LoginModal.jsx:64` 与 `frontend/src/pages/AuthPage.jsx:153`。⇒ **影响是产品级的**。
2. **爆炸半径已实测**：`src/index.ts:358` 的 `getUserAsset(uID) || upsertAsset(uID, 0)` 短路点，**库内 24 个用户中 12 个没有 `cid=1` 的 `account` 行**（`results.json:users_total=24` / `users_without_cid1_account=12`）⇒ 这 12 人的登录必然落进 `upsertAsset` ⇒ **`42P01` ⇒ 吞成 `401`**。**且 `upsertAsset` 两个分支（`database.ts:895 UPDATE asset` / `:910 INSERT INTO asset`）都指向缺表** ⇒ 只要被调到**必抛**。
3. **`POST /api/task-progress/claim/:jID` **也在活链上**** —— 两个前端调用点均在在册路由内：`frontend/src/components/ClaimRewardModal.jsx:49`（由 `frontend/src/pages/TaskPage.jsx:390` 渲染，路由 `frontend/src/App.jsx:73` `/task`）与 `frontend/src/pages/RewardPage.jsx:154`（路由 `frontend/src/App.jsx:71` `/reward`）。**首次领取（`:670`）无条件调 `upsertAsset` ⇒ 恒 42P01**；已领取分支（`:659`）同 §0-2 口径。
4. **前置复核（本单现取）**：`route-layer.spec:1155` 已登记「两条活路由均有前端消费」——**结论方向一致，但其行号已漂移**（册记 `auth.js:123` vs 现取 `:169`；册记 `RewardPage.jsx:152` vs 现取 `:154`；册记 `ClaimRewardModal.jsx:49` ✓ 一致）。
5. **`42P01` 已当场复现**（本单探针自伤即证）：探针直查 `public.task_progress` ⇒ `NeonDbError ... code: '42P01'`、`message = relation "public.task_progress" does not exist`（`steps.log`/`PROBE_EXIT=1` 首轮）。7 张缺表逐个 `to_regclass` = `NULL (NOT EXISTS)`。
6. **D1' 本轮已从「未触发」改为「受控实测」**：非 400 传输类错误在驱动下抛 `NeonDbError{ code: null, message:'Error connecting to database: fetch failed', sourceError: TypeError }`（`d1p-transport.json`）⇒ **无码可 map ⇒ 落路由层硬编码状态**：`/api/auth/verify` ⇒ **401**（`src/index.ts:373`）、`/api/task-progress/claim/:jID` ⇒ **500**（`src/index.ts:683`）。规格期望 = **503**（`route-layer.spec:1158`）。

**待 Kevin 一句话（本单不选边）**：**旧积分体系（`asset` + `task_progress` 奖励回路）是否复活**——这一句决定批 5 走「退役」还是「改接账本」；Zang 给的默认值 = 不复活 / 按 sunset 处置（`route-layer.spec:1154`）。

## §1 前端调用扫描（双口径 · `frontend/**`）

### §1.1 口径与命令

| 口径 | 命令 | 说明 |
|---|---|---|
| ① 裸名边界 | `grep -rnE "auth/verify" src/ *.html \| grep -v src/test` | 不带引号/路径前缀的裸名 |
| ② 带引号（字面路径） | `grep -rnE "['\"\`]/api/auth/verify" src/ *.html \| grep -v src/test` | 必须带引号的字面量 |
| ③ 构建产物旁证 | `grep -rlo "api/auth/verify" dist/assets/*.js` | 已发布 bundle |

### §1.2 双口径结果表（现取）

| 目标路径 | ① 裸名计数 | ② 带引号计数 | ③ dist 旁证 | 判定 |
|---|--:|--:|---|---|
| `/api/auth/verify` | **2** | **2** | 命中 `dist/assets/index-BrtrZgpv.js` | **在册调用（活）** |
| `/api/task-progress/claim/:jID` | **2** | **2** | `dist/assets/index-BrtrZgpv.js` 命中 2 处 | **在册调用（活）** |

> 两口径计数一致（无人为引号漂移）；`admin.html:642` 的 `GET /api/auth/verify?token=` 计入 ① 的 2 行之一，属**方法不符**的旧管理面板调用（后端只注册 `POST`，`src/index.ts:354`）⇒ 记为旁证，不记为登录链。

### §1.3 逐条 `文件:行号`（活调用点）

| 表族 | 端点 | `文件:行号` | 是否在册路由 | 备注 |
|---|---|---|---|---|
| `asset` | `POST /api/auth/verify` | `frontend/src/auth.js:169`（`verifyAuthChallenge`） | **是**（登录面） | 调用方 = `WalletAuthPanel.jsx:111` |
| `task_progress` | `POST /api/task-progress/claim/${jID}` | `frontend/src/components/ClaimRewardModal.jsx:49` | **是**（`TaskPage.jsx:390` ← `App.jsx:73`） | 另有读 `:24` `GET /api/task-progress/${jID}` |
| `task_progress` | `POST /api/task-progress/claim/${...}` | `frontend/src/pages/RewardPage.jsx:154` | **是**（`App.jsx:71` `/reward`） | 另有读 `:111` |
| `task_progress` | `POST /api/task-progress/:id/submit` | `frontend/src/pages/jobs/job-api.js:70`、`components/ActiveTaskModal.jsx:50` | **是** | 走 `job-service.ts`，**不触 `task_progress` 表** |
| — | `GET /api/task-progress` | `TaskPage.jsx:109`、`jobs/job-api.js:44`、`ProfilePage.jsx:104` | **是** | 经 `getTaskProgress`（`database.ts:1178`），本单未回溯其读源（`NOT_MEASURED`，同 p4 单 N2） |

### §1.4 已删除 / 不再发起的旧调用点（4c-ii 成果 · 逐条旁证）

| 端点 | 状态 | 证据（`文件:行号`） |
|---|---|---|
| `/api/shard` | **已删调用** | `ShardPage.jsx:5-8`（逐字「⇒ **删除**」）；`RewardPage.jsx:57-58`（逐字「**移除调用**」）；`ProfilePage.jsx:92`（逐字「已 sunset…禁止新代码再调」） |
| `/api/shard/transfer` | **已删调用** | `ShardPage.jsx:8` |
| `POST /api/shard/redeem` | **已删写口** | `RewardPage.jsx:197`（逐字「两**写口**」已移除） |
| `POST /api/chest/:bID/open` | **已删写口** | `RewardPage.jsx:197`（同上） |
| `POST /api/admin/task/create\|update\|delete` | **已删入口** | `TasksManagement.jsx:123`/`:151`/`:244`（逐字「已 410 ⇒ 新增/编辑/保存入口删除」） |
| `POST /api/admin/prize/create\|update\|delete` | **已删入口** | `RewardsManagement.jsx:184`/`:213`/`:251`/`:440`（逐字「已删除 / 已 410」） |
| `GET /api/prize/all` | **保留（非缺表面）** | `listing-api.js:52`、`HomePage.jsx:106`、`RewardPage.jsx:48`、`DashboardPage.jsx:123`、`RewardsManagement.jsx:56` ⇒ 读侧已换源 `listing` |
| `GET /api/prize-item` | **保留（非缺表面）** | `listing-api.js:58`、`HomePage.jsx:119`、`RewardPage.jsx:55` ⇒ 读侧已换源 `listing_order`（`route-layer.spec:1151` 归类更正：**非 sunset 面**） |
| `POST /api/admin/points/adjust` | **保留（A1 · 已接账本）** | `PointsManagement.jsx:114` |

## §2 EVM 登录主路径调用链（现取）

### §2.1 调用链（逐跳 `文件:行号`）

```
[UI]  AuthPage.jsx:153  <WalletAuthPanel/>        （另一挂载点 = LoginModal.jsx:64）
  ↓   用户点「连接钱包」 WalletAuthPanel.jsx:67 connectWallet
  ↓
[1]  POST /api/auth/challenge
       frontend: auth.js:158 requestAuthChallenge   ← 调用 WalletAuthPanel.jsx:105
       backend : src/index.ts:345  →  startWalletAuthChallenge(...)  → 200 {challenge_token,...}
  ↓   （钱包签名，离线）
[2]  POST /api/auth/verify
       frontend: auth.js:168/169 verifyAuthChallenge ← 调用 WalletAuthPanel.jsx:111
       backend : src/index.ts:354  app.post('/api/auth/verify')
                 :356  consumeWalletAuthChallenge(req.body)
                 :357  findOrCreateUserByEvm(evm)     → database.ts:831（`users` 表）
                 :358  getOrCreateAsset  ★短路点★
                         = (await getUserAsset(uID)) || (await upsertAsset(uID, 0))
                           database.ts:860  getUserAsset  → 读 `account`（cid=1）【读侧已迁，安全】
                           database.ts:889  upsertAsset   → :895 UPDATE asset / :910 INSERT INTO asset
                                                          ⇒ 缺表 ⇒ SQLSTATE 42P01
                 :373  catch ⇒ sendError(res, 401, …)   ★吞码★
  ↓
[3]  GET /api/user            auth.js:181 fetchCurrentUser（带 Bearer）
[4]  POST /api/user/profile   auth.js:189 updateMyProfile（requires_profile_completion 时）
```

### §2.2 判定：`/api/auth/verify` **在链上**（第 2 跳，不可绕过）

- **唯一前端入口** = `auth.js:169`；**唯一调用方** = `WalletAuthPanel.jsx:111`（`grep -rn "verifyAuthChallenge" src/` 现取 = 2 行，均为定义 + 该调用）。
- `WalletAuthPanel` 被 **2 处在册登录面**挂载（`LoginModal.jsx:64`、`AuthPage.jsx:153`）⇒ 无法用「某页未挂载」解释为死面。
- 后端 `:358` 的 `||` 短路是**登录事务内的取余额步骤**（返回值直接进 `:366 points: asset.points`），**不是可选装饰**。

### §2.3 触发条件与爆炸半径（实测）

| 项 | 现取读数（run = `p5triage-20260930T144143Z`） |
|---|---|
| `users` 行数 | **24** |
| `account` 行总数 | **25** |
| 其中 `cid = 1` 的行 | **16** |
| **无 `cid=1` account 行的用户数** | **12**（= 会落进 `upsertAsset` ⇒ 42P01 ⇒ 401 的人数） |
| 逐用户样本（前 10） | `uid=1 → cid1_rows=0`；`uid=2..8 → 1`；`uid=9,10 → 0`（`results.json:per_user_sample`） |

> ⇒ **触发条件** = 「该 `uID` 在 `public.account` 无 `cid=1` 行」。**12/24 = 50%** 的存量用户在**登录时**即触发；**新注册 EVM 钱包**（`findOrCreateUserByEvm` 只建 `users` 行，`database.ts:831`）必然无 `account` 行 ⇒ **新用户 100% 触发**。
> **注意**：`src/index.ts:496` 注释逐字「原 `|| upsertAsset(uID, 0)` 回退已移除」⇒ **读端点**（`GET /api/user/asset/:uID`）已修，**但登录端点 `:358` 同族回退仍在**（同类缺陷未同步收口）。

### §2.4 `POST /api/task-progress/claim/:jID` 同族链（现取）

| 分支 | `文件:行号` | 行为 |
|---|---|---|
| 已领取（`time_claimed` 真） | `src/index.ts:659` | `getUserAsset \|\| upsertAsset` ⇒ 无 `cid=1` 行 ⇒ 42P01 |
| 首次领取 | `src/index.ts:668` → `:670` | `claimTaskProgress`（`database.ts:1264` **`UPDATE task_progress`** ⇒ 42P01 先抛）→ `upsertAsset`（**无条件**，⇒ 42P01） |
| catch | `src/index.ts:681` → `:683` | `sendError(res, 500, 'Failed to claim reward')` |

## §3 七张缺表逐表处置选项（**只列选项 + 前置/风险，不选边**）

> 三个选项族（并列，不排序、不推荐）：
> **R = 退役**（删路由 / 改 `410` / 保持恒空态）· **L = 改接账本**（`ledger_post_event` + `mint/burn`）· **K = 保留空态**（路径保留、`200` 空 + `deprecated:true`）。
> 「册内约束」列 = 现存 spec 的**既有立场**（供裁决者看冲突面），**非本单推荐**。

| # | 缺表 | 现触达路由（现取 `src/index.ts:行号`） | 选项 R 退役 | 选项 L 改接账本 | 选项 K 保留空态 | 册内约束 / 前置 / 风险 |
|--:|---|---|---|---|---|---|
| 1 | **`asset`** | ① `POST /api/auth/verify` **:354**（写点 `:358`）；② `POST /api/task-progress/claim/:jID` **:635**（`:659`/`:670`）；③ `POST /api/market` 家族（`database.ts:3246`/`:3336`/`:3341`/`:3427` ⇒ 可达性 **`NOT_MEASURED`**） | **删写侧调用**：`:358` 改 `emptyAsset`（已存在，`database.ts:878`）或 `getUserAsset` 单读；`:659`/`:670` 同法 | 登录不需要账本（余额读 `account` 即足）；**若**「奖励发放」复活 ⇒ 改 `ledger_post_event(op='mint')` | 无「空态」语义可用（`asset` 是余额载体，空态已由 `emptyAsset` 表达） | `data-layer.spec:166` 逐字「**不存在，且永不创建**」·`:217` DL26「旧表名…**不得**出现在任何新迁移、新代码、新路由里（**含只读引用**）」·`ledger.spec:821` §13.1「用保留 uid，不建第二套账」⇒ **删写侧与册内一致**；**R 的缺口** = 必须同时决定「奖励发放」去哪（否则 `claim` 变成纯状态机、`user_points_total` 字段口径悬空） |
| 2 | **`task_progress`** | ① `POST /api/task-progress/claim/:jID` **:635**（`:668` 写 `database.ts:1264`）；② `GET/POST /api/task-progress*` **:560**/`:574`/`:593`（经 `getTaskProgress` `database.ts:1178`，**读源未回溯** ⇒ `NOT_MEASURED`）；③ `POST /api/task-progress/:id/submit`（走 `job-service.ts`，**零命中**） | **删 claim 路由**或改为只读（`route-layer.spec:158` 记「**保留·改语义**：拆 apply/accept/settle」）·`route-layer.spec:1337` 7-13 = 拆分**已定**，旧路径批 4 前保留 | 换源到 `job_application` / `job_submission`（`route-layer.spec:1141` 第 3 行）⇒ 奖励发放改 `ledger_post_event` | **无空态意义**（该端点是写面，不是读口） | `data-layer.spec:217` DL26 **点名** `task_progress`；`route-layer.spec:1141` 已给换源目标 ⇒ **R/L 均有册内依据**；**风险** = 前端 3 个活调用点（§1.3）必须同批改，否则 404/500 |
| 3 | **`task`** | `POST /api/admin/task/create\|update\|delete` **:1019/:1023/:1027** = **已 410 死写**；`GET /api/task/all` **:394** / `GET /api/task/:tID` **:406** **零命中**（不触表） | **已实质退役**；可删注册点（或保留 `410`） | 不适用（`task` 是旧商品/任务目录，`route-layer.spec:146` 记读口已换源 `job`/`listing`） | 不适用 | `data-layer.spec:217` DL26 点名；**删了不会造成新缺口**（三个 GET 零命中、写口已 410）⇒ **R 风险最低** |
| 4 | **`prize`** | `POST /api/admin/prize/*` **:1031/:1038/:1045** = **已 410 死写**；`GET /api/prize/all` **:382** 零命中（已换源 `listing`） | **已实质退役**；可删注册点 | 不适用 | 不适用 | `data-layer.spec:343` C3①「`/api/admin/prize/*` **删除**」+ `:217` DL26 点名 ⇒ **册内已裁定删除**；**删了不会造成新缺口** |
| 5 | **`prize_item`** | `syncPrizeInventory`（`:2649`，调用方未回溯 ⇒ `NOT_MEASURED`）·`deleteBrand`（`:2828`，410 面）·`redeemPrizeItemFromShards`（`:3525`）← `POST /api/shard/redeem` **:717** = **410**；`GET /api/prize-item` **:546** 零命中（已换源 `listing_order`） | **已实质退役**（写侧全在 410 / 未回溯面） | 不适用 | 不适用 | `data-layer.spec:217` DL26 点名；`route-layer.spec:1151` 明记 `/api/prize-item` **非 sunset 面** ⇒ **删表 ≠ 删路由**（该 GET 已不依赖此表）⇒ **R 无新缺口，但须同批清 `syncPrizeInventory` 的孤儿调用方** |
| 6 | **`shard`** | 读 `GET /api/shard` **:687** = **`200` 空态 + `deprecated:true`**（已是 K）；写 `POST /api/shard/redeem` **:717** = 410、`POST /api/chest/:bID/open` **:723** = 410；**写函数的 in-code 调用点** = `database.ts:3207/3220`(matchMarketOrder)、`:3309/3310`(placeOrder)、`:3393/3394`(cancelOrder)、`:3498/3499`(openFreeShardChest)、`:3546/3547`(redeemPrizeItemFromShards) ⇒ **market 家族可达性 `NOT_MEASURED`** | **删调用点**（把 market 家族的 `createShardLedgerEntry`/`recordShardTransfer` 调用摘掉） | 不适用（持仓 = `account`，转让由 `ledger_entry` 派生 — `route-layer.spec:1151`） | **已是 K（现状）**：读口保留恒空 + `deprecated:true`，`route-layer.spec:5.1` 记「保留路径 + 空态」 | `migrations/0016_market.sql:49` 注释逐字「**不建** `shard`/`shard_transfer`/持仓表」；`data-layer.spec:217` DL26 点名；**风险** = 若 market 家族在活路由上可触 `:3207` 等，则**写侧仍会 42P01**（未实测，见 §6-N3）；**缺口** = 若删 `shard` 写函数，需确认 market 家族不依赖其返回值 |
| 7 | **`shard_transfer`** | 写 `:3016`（`recordShardTransfer`）；读 `GET /api/shard/transfer` **:702** = `200` 空态 + `deprecated:true`；写点同 #6 五处 | 同 #6 R | 不适用（同 #6：由 `ledger_entry` 派生） | **已是 K（现状）** | 同 #6 全部；**缺口** = 同 #6 的 market 家族依赖面 |

**跨表共性（四类前置，逐条已给真源）**：
1. **删路由 ≠ 删表**：`prize`/`prize_item`/`task` 的**读口**早已换源（`listing`/`listing_order`/`job`），仅有**写侧**残留缺表引用 ⇒ 删写侧调用即可，无新缺口。
2. **R 的公共前置** = 前端同批改（§1.3 三个活调用点 + §1.4 已删点已闭合）。
3. **R 的共同风险** = 「奖励发放」语义去哪（`asset` + `task_progress` 是同一回路的两半，拆一半会留悬空字段 `user_points_total`）。
4. **Zang 默认值（可一句话改）**：不复活、按 sunset 处置（`route-layer.spec:1154`）。

## §4 批 5 最小可执行清单（**逐项带 `文件:行号` + 验收方式**）

> 「★」= **必须先等 Kevin 一句话**（旧积分体系是否复活）才能开工；其余项在默认处置（不复活）下可直接排。

| # | 项 | 落点（`文件:行号`） | 验收方式 | 阻塞 |
|--:|---|---|---|---|
| B5-1 | **清登录链的 `asset` 回退**（去 42P01 ⇒ 401） | `backend-ts/src/index.ts:358`：`getUserAsset(uID) \|\| upsertAsset(uID, 0)` ⇒ 改单读 + `DatabaseService.emptyAsset(uID)`（`database.ts:878` 已存在） | 新建 EVM 钱包 ⇒ `POST /api/auth/verify` ⇒ **200** 且 `points: 0`；回归 `grep -n "upsertAsset" src/index.ts` = 仅剩 `:670` | **★ 需 Kevin 一句话**（若复活则改走 L 而非删） |
| B5-2 | **清 claim 链的 `asset`/`task_progress` 写** | `src/index.ts:659`（`upsertAsset` 回退）· `:668`（`claimTaskProgress` ⇒ `database.ts:1264 UPDATE task_progress`）· `:670`（`upsertAsset(rewardPoints)`） | 已领取分支 ⇒ **200** 且 `user_points_total` 来自 `account`；首次领取 ⇒ 按 §3#2 的裁定面返回（R ⇒ 410/404；L ⇒ 200 + `ledger_entry` 新分录） | **★ 需 Kevin 一句话** |
| B5-3 | **删 3 个旧表族的死写注册点**（已 410，纯清理） | `src/index.ts:1019/:1023/:1027`（`admin/task/*`）· `:1031/:1038/:1045`（`admin/prize/*`） | `grep -n "'/api/admin/task/\|'/api/admin/prize/" src/index.ts` = **0 行**；前端已无调用（§1.4 ✓） | 否（册内已裁定删除：`data-layer.spec:343` C3①） |
| B5-4 | **清 `shard`/`shard_transfer` 写侧孤调用点** | `database.ts:3207/:3220/:3309/:3310/:3393/:3394/:3498/:3499/:3546/:3547` | `grep -n "createShardLedgerEntry\|recordShardTransfer" src/database.ts` = 仅剩 `:3000`/`:3016` 定义体（或 0）；market 回归 15/15 不回归 | 否 — **但先补 §6-N3 的可达性取证** |
| B5-5 | **`GET /api/shard` / `/api/shard/transfer` 保持 K 现状**（不改） | `src/index.ts:687` / `:702`（已是 `200` 空 + `deprecated:true`） | `curl -H "Authorization: Bearer <token>" /api/shard` ⇒ `200 {data:[], deprecated:true}` | 否 |
| B5-6 | **`GET /api/prize-item` 归类冻结**（**不得**当 sunset 删） | `src/index.ts:546`（读 `listing_order`） | 该路由在批 5 后仍 `200`；本项**只是防误删登记** | 否 |
| B5-7 | **批 5 收口复算**（禁自指） | 命令：`grep -rn "upsertAsset" backend-ts/src/index.ts` ⇒ 期望 **1 行（:670）或 0 行**；`grep -rn "FROM task_progress\|INTO asset\|UPDATE asset\|FROM shard\|FROM prize" backend-ts/src/` ⇒ 期望 **0 行** | 两命令读数贴进批 5 报告 | 依赖 B5-1/2/4 |
| B5-8 | **规格同步（Jing 单，非本批实现）** | `docs/route-layer.spec.md:144`（`auth/verify` 记 `:241` 漂移）·`:158`（claim 记 `:505` 漂移）·`:1151`/`:1155`（行号漂移，见 §0-4） | 漂移项逐条改为现取行号 | 否（登记项） |

**批 5 的边界（写死）**：`route-layer.spec:1172` 逐字「批 6 的 `503` 归一 + 审计留痕 ⇒ **本批不得实现、不得建表**」⇒ **批 5 不含 D1'、不含 `admin_audit_log`**。

## §5 D1' 补充取证：**非 400 驱动错误 ⇒ 当前归什么状态**

### §5.1 结构位置（真源 = 驱动源码 + 路由层 catch）

| 层 | `文件:行号` | 事实 |
|---|---|---|
| 驱动 | `node_modules/@neondatabase/serverless/index.js:1544` | 逐字 `throw new Ee(\`Server error (HTTP status ${oe}): ${$}\`)` ⇒ **非 400 分支只带 HTTP 状态、不带 `code`** |
| 驱动（自有键） | 同上（实测） | 抛出的 `NeonDbError` **own keys = `["name","code","sourceError"]`**，`code` = **`null`** |
| 路由层（无分类器） | `src/index.ts:76` `sendError(res, statusCode, message)` | 状态码 = **调用方硬编码**，无 code→status 映射表 |
| 分类器（**不在**这两条链上） | `src/index.ts:155` `unwrapInfraCause` + `:241` | 只用于 `resolveActor`（及 `:770`/`:794`）；**auth/verify 与 claim 的 catch 不走它** |

### §5.2 当前归类（现取）

| 路由 | catch 行 | 现状状态码 | 规格期望 | 判负 |
|---|---|---|---|---|
| `POST /api/auth/verify` | `src/index.ts:373` | **`401`** 逐字 `sendError(res, 401, …)` | `503`（`route-layer.spec:1158`） | 传输故障被报成「凭据无效 ⇒ 重试无用」——**方向性误导** |
| `POST /api/task-progress/claim/:jID` | `src/index.ts:681` → `:683` | **`500`** 逐字 `sendError(res, 500, 'Failed to claim reward')` | `503` | `route-layer.spec:656` 的 `503` 语义（重试类）不含此面；`500` 只允许「不变式被破坏」（`DL126`/`R108`） |

### §5.3 本轮**受控实测**（替代 `NOT_MEASURED`）

**构造方式**（安全、无副作用）：**不启服务、不改 `.env.local`、不连真库** —— 脚本 `p4z-p5t-02-d1p.ts` 在进程内用 `neon()` 指向**拒连地址**，观测错误对象形状。读数 = `d1p-transport.json`：

| 用例 | 目标 | `outcome` | `error_ctor` | `message` | `code` | `sourceError` | `own_keys` |
|---|---|---|---|---|---|---|---|
| `REFUSED_LOCAL_PORT` | `127.0.0.1:1` | `THREW` | `NeonDbError` | `Error connecting to database: fetch failed` | **`null`** | `TypeError: fetch failed` | `[name,code,sourceError]` |
| `UNRESOLVABLE_HOST` | `*.invalid` | `THREW` | `NeonDbError` | `Error connecting to database: fetch failed` | **`null`** | `TypeError: fetch failed` | `[name,code,sourceError]` |

> ⇒ **`code === null` 已实测** ⇒ 路由层**无码可 map** ⇒ 落硬编码 `401`/`500`。**这是「非 400 驱动错误 ⇒ 当前归 401/500、应归 503」的端到端证据链的驱动侧一环**。
> **诚实边界**：本轮实测的是**驱动侧错误形状**（两次拒连）；**未**把该错误注入运行中的 `/api/auth/verify`（需要启受控实例或改 `.env.local` ⇒ 均触本单红线）⇒ **HTTP 级端到端 = `NOT_MEASURED`**。

## §6 探针与产物 · `NOT_MEASURED` · 自曝

### §6.1 产物（本单写集内）

| 类型 | 路径 |
|---|---|
| 报告 | `docs/audit/p5-missing-tables-triage.md`（本件 · 骨架先落盘后回填） |
| 探针 1（缺表 + 登录半径） | `backend-ts/scripts/p4z-p5t-01-probe.ts`（只读 · 走 `neon()` HTTP） |
| 探针 2（D1' 传输面） | `backend-ts/scripts/p4z-p5t-02-d1p.ts`（只读 · 进程内拒连构造） |
| 读数 | `backend-ts/.p4-artifacts/p5triage-20260930T144143Z/results.json`（4136 B） |
| 读数 | 同目录 `steps.log`（1378 B）· `d1p-transport.json` |

**可复算命令**（退出码取自命令本身、非管道之后）：
```
# 探针 1（只读）
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-p5t-01-probe.ts "$PWD/.p4-artifacts/p5triage-20260930T144143Z"   # EXIT=0
# 探针 2（D1'）
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-p5t-02-d1p.ts "$PWD/.p4-artifacts/p5triage-20260930T144143Z"     # EXIT=0
# 双口径前端扫描
grep -rnE "auth/verify" frontend/src frontend/*.html | grep -v src/test | wc -l          # = 2
grep -rnE "['\"\`]/api/auth/verify" frontend/src frontend/*.html | grep -v src/test | wc -l  # = 2
grep -rnE "task-progress/claim" frontend/src frontend/*.html | grep -v src/test | wc -l   # = 2
```

### §6.2 探针自曝（口径瑕疵 / 假阳性 / 未测项）

① **首轮探针自伤（§5.7 ③「先怀疑自己的探针」）**：我按 p4 单惯例写 `u."uID"` ⇒ `42703 column u.uID does not exist`（`PROBE_EXIT=1`）。**库内真列名 = `uid`**（`results.json:columns.users = uid:bigint, evm:text, bio:text, is_admin:boolean, time_reg, time_login_last`）。修正为 `u."uid"` 后通过。⇒ **「`uID` 是代码层命名、`uid` 是 DB 列名」这一层映射若不复现就会误报。**
② **二轮探针自伤**：`SELECT CASE WHEN to_regclass(...) IS NULL THEN 'TABLE_ABSENT' ELSE (SELECT count(*) FROM public.task_progress) END` **仍在解析期失败**（`42P01`）—— Postgres 对 `CASE` 内子查询做**解析期**关系检查，`CASE` 不构成保护。改为 **JS 侧分支**（`tpExists ? query : 'TABLE_ABSENT'`）后通过。⇒ **该 42P01 本身即「缺表族」的当场复现证据。**
③ **口径已打印**：`neon()` 实际命中分支 = **`sql(text,params)`**（`results.json:hit_branch`，退出前打印）⇒ 补齐 p4 单 §4.2-**N4** 的未测项。
④ **`users` 保留字**：全部查询按 §5.7 ③ 加引号（`public."users"`）⇒ 无裸 `user` 自伤。
⑤ **本单未发任何写请求**（`/api/auth/verify`、`/api/task-progress/claim` 的 HTTP 级结果均为**静态推定**，见 N1）；**未执行 DDL/DML**、`npm install`、`git add/commit/push`、`pkill`/`killall`、**未启停任何服务**；探针只走 `SELECT` / `information_schema` / `to_regclass` / `pg_proc`。
⑥ **D1' 的构造副作用**：探针 2 产生**两次注定失败的出站 TCP 连接**（`127.0.0.1:1` 与 `.invalid`）—— **非**「启服务 / 停服务」，**未**改 `.env.local`（URL 为脚本内字面量）。
⑦ **`42P01` 立案标签已自复现**（§5.7 ⑧）：见 ②。

### §6.3 `NOT_MEASURED`（**禁填 0 / 空**）

| 编号 | 未测项 | 为何未测 |
|---|---|---|
| N1 | `POST /api/auth/verify` 与 `POST /api/task-progress/claim/:jID` 的 **HTTP 级**读数（真 `401`/`500` 状态码 + 响应体） | 本单红线禁发写请求；构造有效 `challenge_token` + 钱包签名需要真实私钥签名 ⇒ 无法安全构造 |
| N2 | `GET/POST /api/task-progress*`（`:560`/`:574`/`:593`）经 `getTaskProgress`（`database.ts:1178`）的**实际读源** | 未回溯该函数体（只做调用面扫描） |
| N3 | `shard`/`shard_transfer` 写函数在**活 market 路由**上的可达性（`database.ts:3207/3220/3309/3310/3393/3394/3498/3499/3546/3547`） | 未逐调用链回溯；`NOT_MEASURED`（承 p4 单 N3） |
| N4 | `syncPrizeInventory`（`database.ts:2649`）的**调用方是否存在** | 未回溯（承 p4 单 N2） |
| N5 | `POST /api/market` 家族是否在册活路由（决定 `upsertAsset` 的第三组触达面） | 未回溯路由注册表 |
| N6 | 「新注册 EVM 钱包 100% 触发」中的**新用户**面 | 未造新用户（禁写）；该结论由 `findOrCreateUserByEvm`（`database.ts:831`）**只建 `users` 行**的代码事实推定 |
| N7 | D1' 的 **HTTP 级端到端**（把 `code:null` 传输错误注入运行中的路由） | 需受控实例/改 `.env.local` ⇒ 触红线；**驱动侧形状已实测**（§5.3） |
| N8 | `frontend/dist/**` 是否与 `frontend/src/**` 同步（构建时间戳） | 只做命中旁证，未核构建新鲜度 |

### §6.4 写集自检（硬边界）

**本单只写 4 处**：本报告 · `backend-ts/.p4-artifacts/p5triage-20260930T144143Z/**` · `backend-ts/scripts/p4z-p5t-01-probe.ts` · `backend-ts/scripts/p4z-p5t-02-d1p.ts`。
**未写/未改**：`src/**`、`migrations/**`、任何 spec、`docs/seafood.master-plan.md`、`frontend/**`、既有 audit/qa 件、`.env.local`。
**与 p4 单的差异复核（现取，必报）**：`p4-a1ledger-design.md` 记 A1 路由经 `database.ts:954 upsertAsset`；**现取 `database.ts:940 adjustPoints` 已改接 `ledger_post_event`**（逐字注释「P4-A1-LEDGER-IMPL（Zang §5.99 裁定）：后台调分**改接账本**…**零表写入**」）⇒ **A1 的 `asset` 触达面已闭合**，`asset` 的活触达面**只剩 `auth/verify` + `claim` + market 家族（N5）**。该漂移**不等同于批 5 已做**（登录/领取链未动）。
