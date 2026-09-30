# P5-B5 · FIX-LOGIN — 登录端点同族收口（`POST /api/auth/verify` 去 `asset` 写入）

> 单号 = **B5-FIX-LOGIN** · 角色 = **Kong（实现方）** · 裁定 = **Zang §5.104①（逐条落实）** · 日期 = 2026-09-30 CST
> run tag = **b5l-20260930T145112Z** · 产物 = `backend-ts/.p4-artifacts/b5l-20260930T145112Z/`
> 探针 = `backend-ts/scripts/p4z-b5l-01-login.ts`（**真 HTTP + 真库**；改前/改后**同脚本同口径**）
> 报告骨架先行落盘、逐段回写。取证前置 = `docs/audit/p5-missing-tables-triage.md`（P5-TRIAGE）。

## §0 结论摘要（一句话）

**`POST /api/auth/verify` 的取余额步骤由「读 `account` ∥ 写 `asset`」改为「只读 `account` + `emptyAsset` 空态」，零建表、零建户、零鉴权放宽；新 EVM 钱包（库内无 `account` 行）走完 verify 由改前的 `401` 变为 `200` 且 `points = 0`，`42P01` 归零，注册点 65 不变，账本 `Δledger_entry = 0`、`Σ(cid=1) 余额` 不变。**

**① 选边（Zang §5.104①-2 要求先现取判定）＝「先读、由账本首次入账建行」**（**不**在登录事务内建 `account` 行）。依据：
- 读源已是 `account`：`database.ts:861 getUserAsset` 纯读 `account WHERE uid AND cid=1`；
- **同族先例已在读端点落地且写法完全相同**：`src/index.ts:496-498`（P4-B1-a）逐字「纯读端点，禁止隐式写库（原 `|| upsertAsset(uID, 0)` 回退已移除）」+ `asset || DatabaseService.emptyAsset(uID)`；
- 登录响应只取 `asset.points` 展示（`src/index.ts:364` 起 `sendSuccess({...user, points: asset.points})`）⇒ 无 `account` 行的用户正确语义 = **空态 0**，无需存在行；
- 若反过来「必须建户」，则只能①直写 `account`（违 R1「零表写入」/ `ledger.spec:821` §13.1「不建第二套账」）或②调账本 —— 但**登录不是价值事件**：`mint` 会改供给、`entries` 需对腿语义 ⇒ 二者皆错。**故取「先读 + 空态」。**

## §1 真根因（`文件:行号`）

```
[UI] AuthPage.jsx:153 / LoginModal.jsx:64  <WalletAuthPanel/>
  ↓ POST /api/auth/challenge            frontend/src/auth.js:158 ← WalletAuthPanel.jsx:105
  ↓ POST /api/auth/verify               frontend/src/auth.js:169 ← WalletAuthPanel.jsx:111
      src/index.ts:354  app.post('/api/auth/verify')
        :356 consumeWalletAuthChallenge()        （auth.ts:174；**不校验签名内容**，见 §3-C7）
        :357 findOrCreateUserByEvm(evm)          （database.ts:831 ⇒ 新地址只建 users 行，:809 createUserByEvm）
        :358 【★真根因★】getOrCreateAsset
                = (await getUserAsset(uID)) || (await upsertAsset(uID, 0))
                  database.ts:861 getUserAsset → 读 account(cid=1)【读侧已迁，安全】
                  database.ts:889 upsertAsset → :895 UPDATE asset / :910 INSERT INTO asset
                                                 ⇒ 库内无此表 ⇒ SQLSTATE 42P01
        :373 catch ⇒ sendError(res, 401, error.message)   ⇒ 42P01 被**吞成 401**
```
**为何 100% 命中新用户**：`upsertAsset` 的**两个分支都指向 `asset`**（`database.ts:895` / `:910`）⇒ 只要被调到**必抛**；而 `findOrCreateUserByEvm` 只建 `users` 行 ⇒ 新 EVM 钱包**必然**无 `cid=1` `account` 行 ⇒ **必然**落进 `upsertAsset` ⇒ **必 401**。
**为何是老缺陷的「同族漏项」**：`src/index.ts:496` 的读端点早在 P4-B1-a 已把同一条 `|| upsertAsset(uID, 0)` 回退摘掉，**登录端点 `:358` 未同步收口**。
**爆前实测半径（本单现取）**：`users_total=24`、`account_rows_cid1=16`、**无 `cid=1` account 行的用户 = 12/24 = 50%** ⇒ 存量用户里一半人**登录即 401**。

## §2 改前 / 改后（逐条 · 精确 diff）

**唯一代码改动 = `backend-ts/src/index.ts` 一处 hunk（+7 / −1）**：

改前（`src/index.ts:358`，1 行）：
```ts
    const asset = (await DatabaseService.getUserAsset(user.uID)) || (await DatabaseService.upsertAsset(user.uID, 0));
```
改后（`src/index.ts:359-364`，注释 6 行 + 代码 1 行；下称 `:364`）：
```ts
    // P5-B5-FIX-LOGIN（Zang §5.104①）：登录端点与读端点**同族收口**（对照 `:496` 的
    // `GET /api/user/asset/:uID`，P4-B1-a 已修面）。原 `|| upsertAsset(uID, 0)` 回退会写 `asset` 表 ——
    // 该表**不存在**（`data-layer.spec:166`「不存在，且永不创建」）⇒ 无 `cid=1` account 行的用户**必抛 42P01**，
    // 被本函数 catch 吞成 **401** ⇒ **新 EVM 钱包 100% 登不进站**。
    // 现只读账本真源 `account`（`getUserAsset` ⇒ `database.ts:861`）；无行 ⇒ `emptyAsset` 空态（零值 + 完整键集）；
    // **零写库、零建表**：账户行由既有账本机制在首次入账时建立（登录事务内**不**建户）。
    const asset = (await DatabaseService.getUserAsset(user.uID)) || DatabaseService.emptyAsset(user.uID);
```
- **未删任何行**（回调 `upsertAsset` 被替换，函数本身保留 —— 规格 `route-layer.spec:1337`/§3#1 记其残余触达面待批 5.2 裁定，本单不越权删）。
- **未动** `src/database.ts`（`emptyAsset` 早已存在，`database.ts:879`，键集 `{index_id,uID,points,lucks,time_update}` 与 `normalizeAsset`（`:457`）一致）、**未动** `src/auth.ts`（鉴权语义一字未改）。
- **未建任何表**：`migrations/**` 零改动（`git status` 证）。

## §3 逐项验收读数（必测 ①–⑩ · 全部实测）

口径：本机 `127.0.0.1:5788`，`seafood-api`（面板 sid），Node v18.19.0；改前 = run1（旧码进程）、改后 = run2（面板重启后新码进程）。**两次读数为同一脚本、同一用例集**。

| # | 判据 | 改前（run1 22:53–22:55） | 改后（run2 23:07–23:08） | 判定 |
|---|---|---|---|---|
| ① | **新随机 EVM 地址（无 `account` 行）走完 verify** | **401**，响应体逐字 `{"success":false,"message":"relation \"asset\" does not exist","error":"relation \"asset\" does not exist"}` | **200**，`points=0`、`has_token=true`、`42P01_in_body=false` | **PASS** |
| ② | 存量用户（有 `cid=1` account 行） | 200，`points=7600` = 库内 `account.balance=7600`（`matches=true`） | 200，`points=7600`，`matches=true` | **PASS（不回退）** |
| ③ | 无 token / 伪造 token / 空签名 / 地址不匹配 | 401 / 401 / 401 / 401 | 401 / 401 / 401 / 401 | **PASS（鉴权未放宽）** |
| ④ | `42P01` 归零 | 命中（响应体含 `relation "asset" does not exist`；**服务端日志不含该错误**——`:373` catch 不 `console.error`，故**日志不是该判据的证道，响应体才是**） | 改后 run2 的 C1 响应体无 42P01；`server-log delta since restart` = **空**（无 `42P01`/`does not exist`/`ERR`/`进程退出`） | **PASS** |
| ⑤ | 零 `asset` 写入 | `grep -rnE "FROM asset\|INTO asset\|UPDATE asset" src/` = **2 行，均在 `upsertAsset` 体内**（`database.ts:895`/`:910`）；其登录链调用点已摘除 | 同 grep 不变；库内 `to_regclass('public.asset')` = **`ABSENT (reg=null)`** | **PASS（登录链零写 + 库面无表）** |
| ⑥ | `tsc --noEmit` | — | `node_modules/.bin/tsc --noEmit` ⇒ **`TSC_EXIT=0`**（在改后源码上跑） | **PASS** |
| ⑦ | 注册点 65 不变 | `grep -cE "^app\.(get\|post\|put\|delete\|patch\|all)\(" src/index.ts` = **65** | = **65** | **PASS** |
| ⑧ | 已落 410 面 6/6 | 6 面逐条在源：`src/index.ts:1025/1029/1033`（`admin/task/{create,update,delete}`）+ `:1037/1044/1051`（`admin/prize/{create,update,delete}`）⇒ 均 `sendGone` ⇒ `job-service.ts:37 res.status(410)` | 同上；**本单 diff 不含该面**（唯一 hunk 在 `:358`） | **PASS（6/6 且在册）** |
| ⑨ | 账本不变量 | Δ`ledger_entry` = **0**；`account_rows_cid1` 16→16；`Σ(cid=1) balance` 1989693→1989693（**Δ=0**）；Δ`users_total` = **+2**（见下） | 同上：Δ`ledger_entry` = **0**；`account_rows_cid1` 16→16；`Σ(cid=1)` 1989693→1989693（**Δ=0**）；Δ`users_total` = **+2** | **PASS** |
| ⑩ | 被删/被改代码面逐条 | 见 §2（改前 1 行 / 改后 7 行；无删除） | 同 | **PASS** |

**⑨ 的 `Δusers_total=+2` 说明（不是账本分录）**：每次 run 有 2 个**新地址**走登录 ⇒ `findOrCreateUserByEvm`（`database.ts:831`）建 `users` 行 —— 改前改后**同样发生**（`+2/run`，本单共 4 行：`uid` 970203 等）。这是**登录的既有侧效应**（不是本单引入、不是账本事件，`ledger_entry` 不动）。已登记的测试用户地址见 §6.3。

**回归旁证 C8**：`GET /api/user/asset/:uID`（P4-B1-a 已修面）带真 Bearer ⇒ 改前 200 / 改后 200。

## §4 同族收口登记表（`upsertAsset` 全部调用点 · 逐点判定）

`grep -rn "upsertAsset" src/` 现取（改后）：定义 `database.ts:889`，写 SQL `:895`/`:910`，调用点 **5 处**（`database.ts:929/3246/3336/3341/3427`）+ 改后 `index.ts` **2 处**（`:665`/`:676`）。

| # | 调用点 | 所在链 | 判定 | 依据 |
|--:|---|---|---|---|
| 1 | `src/index.ts:358` → 改后 `:364` | **EVM 登录主链** | **本单已修**（改成 `getUserAsset ∥ emptyAsset`） | §2；①实测 200 |
| 2 | `src/index.ts:665`（已领取分支 `getUserAsset ∥ upsertAsset`） | `POST /api/task-progress/claim/:jID`（`:641`） | **只登记，不改**（Zang 裁定「待 Kevin 一句话」） | 本单未发该端点任何请求（见 §5-N1） |
| 3 | `src/index.ts:676`（首领取 `upsertAsset(rewardPoints)`） | 同上，`:674` 首领取分支 | **只登记，不改** | 同上 |
| 4 | `database.ts:929`（`initializeAllAssets`） | 无 HTTP 路由 | **只登记**（且**实测无外部调用者**） | `grep -rn "DatabaseService.placeOrder\|…cancelOrder\|…matchMarketOrder\|initializeAllAssets" src/ \| grep -v src/database.ts` = **0** |
| 5 | `database.ts:3246` | `matchMarketOrder`（`:3223`） | **只登记** | 同上（0 外部调用者）→ HTTP 可达性 `NOT_MEASURED`（§5-N2） |
| 6 | `database.ts:3336`/`:3341` | `placeOrder`（`:3306`） | **只登记** | 同上 |
| 7 | `database.ts:3427` | `cancelOrder`（`:3398`） | **只登记** | 同上 |

**同族一起修判定**：登录事务内**其它步骤**（`:356` 消费 challenge、`:357` 找/建用户、`:359+` 铸 token）逐条自查：**均不触 `asset`**（`:357` 只碰 `users`）⇒ 登录链**无第二处同族写点**，故本单只需 1 处改动。**`/api/task-progress/claim` 按裁定只登记不改**（上表 #2/#3）。

## §5 `NOT_MEASURED`（禁填 0 / 空）

| 编号 | 未测项 | 为何未测 |
|---|---|---|
| N1 | `POST /api/task-progress/claim/:jID` 两条分支的 **HTTP 级**读数 | 裁定「待 Kevin 一句话 ⇒ 只登记不改」；且首领取分支需既有任务状态，本单不构造 |
| N2 | `database.ts:3246/3336/3341/3427/929` 五处在 **HTTP 级**的可达性 | 只实测「`src/` 内 `database.ts` **之外** 0 处调用者」；**未**枚举 `database.ts` 内部间接链（如 `market-service.ts` 是否走别的库函数 —— 该文件注释记 `/api/market/order` **未注册**、`:731 POST /api/order` 已改接） |
| N3 | 「新用户走完**前端全量**链（`GET /api/user` → `POST /api/user/profile`）」 | 只测到 `verify` 200 + `GET /api/user/asset/:uID` 200；`/api/user`（需 profile 完成度）未测 |
| N4 | 存量 **12 名**无 `cid=1 account` 行用户的**逐一**登录 | 抽测 1 个全新地址（该类用户的**充分**代表，必无 account 行）+ 1 个存量用户；未对 12 人逐个发请求 |
| N5 | `42P01` 在**服务端日志**中的痕迹 | 实测：`:373` catch 不 `console.error` ⇒ 日志**不含**该错误（改前 run 的 log delta 亦为空）⇒ **该判据的证道只能取响应体**，不是日志 |
| N6 | 服务对 Neon 抖动的稳定性 | 本单期间自退 3 次（§6.4），抖动期未做压测；未定位「驱动 `ErrorEvent` 未捕获」的修法（越权） |
| N7 | 签名**真实**有效性（ECDSA 恢复） | 服务端**根本不校验签名内容**（`auth.ts:209-213` 逐字「the deleted implementation temporarily bypassed signature verification」）⇒ 无法构造「签名错 ⇒ 401」；实测反证见 §3-C7 |

## §6 探针自曝 · 边界自证 · 写集自检

### §6.1 产物
| 类型 | 路径 |
|---|---|
| 报告 | `docs/audit/p5-fix-login.md`（本件） |
| 探针 | `backend-ts/scripts/p4z-b5l-01-login.ts`（v2） |
| **改前**读数 | `backend-ts/.p4-artifacts/b5l-20260930T145112Z/login-results.json`(4134B) · `steps.log`(1566B) · `pre_probe1_log_lines.txt` · `post_probe1_log_lines.txt` · `log_lines_before.txt` |
| **改后**读数 | 同目录 `post/login-results.json`(5603B) · `post/steps.log`(1944B) · `pre_probe2_log_lines.txt` |
| 夹具 | new1 = `0x7fc8107e56eb5eeb9e059e5abc6cf960b2947c64`（uid 970203，改前）· new2 = `0x5392a11a1a8691d0c545c90e6483a14b099e4405`（改后）；存量 = uid 2 `0xaf2102ef4ef7e285dbe7558b748f62f16fa67b1e`。**无任何密钥/ token 落盘**（`login-results.json` 里 C2/C8 的 token 已 `TOKEN_REDACTED`） |

**可复算命令**（退出码取自命令本身、非管道之后）：
```
# 改后（先经面板重启，见 §6.4）
node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
  scripts/p4z-b5l-01-login.ts "$PWD/.p4-artifacts/b5l-20260930T145112Z/post"   # PROBE_EXIT=0
```

### §6.2 探针自曝（**先怀疑自己的探针**）
1. **v1 自伤（首个读数即证）**：脚本把 `/health` 放在**第一位**，而 `/health` 触库 ⇒ 本机 Neon 抖动时驱动抛 `TypeError: Cannot set property message of #<ErrorEvent> which has only a getter` ⇒ **服务自退**，探针首 fetch 收 `FETCH_ERROR … ECONNREFUSED` ⇒ `PROBE_FATAL`。**v2 修法**：`/health` 挪到**最后**且非致命、全部 HTTP 取数包 try/catch（传输失败记 `status:-1` + `FETCH_ERROR:…`）⇒ 不再因环境抖动丢掉用例。**这是本单唯一一次探针自伤，读数已作废并作废重跑（改前读数取自 v2 run1）。**
2. **v1 口径 bug**：`asset_regclass` 字段把 `to_regclass` 的 **NULL（表不存在）** 经 `?? 'READ_FAILED'` 误标成「读失败」。（该 bug 也是 §2 报数的一处**假阴性风险**，v2 逐名重测 ⇒ §3-⑤ 的 `ABSENT (reg=null)` 是真读数。）
3. **v2 的 `account` 单点读失败已如实保留**：`TABLE_EXISTENCE.account = "READ_ERROR: Error connecting to database: fetch failed"`（**Neon 抖动瞬时**；同 run 的 `account_rows_total=25`、`account_rows_cid1=16` 均正常取到 ⇒ 非表缺失、非探针列名错）。
4. **列名自检**（§5.7③）：`account` 真列 = `uid,cid,balance,frozen,version,time_created,time_updated`（`information_schema` 现取）；`users` 保留字一律加引号 ⇒ 无自伤。
5. **hit_branch 打印**：`neon()` 命中 `sql(text,params)`（两次 run 一致）。
6. `invariants.asset_table_regclass` 字段是 v1 遗留（恒 `READ_FAILED`）⇒ **已被 `table_existence` 取代**，报告以 `table_existence` 为准（诚实标注，不删字段以免篡改读数文件）。

### §6.3 C7 与「签名不校验」——本单**未**改鉴权语义
- 改后 C7（新地址 + `0xde…` 垃圾签名）⇒ **200**；改前 C2（存量用户 + 探针随机签名）⇒ **200**。
  ⇒ 「签名内容不校验」是**既有行为**（`auth.ts:209-213` 逐字遗留注释），**不是本单引入**、本单**也不修**（修它=改登录语义，越权；且会与前端离线签名流程解耦）。
- 因此 ③ 的可测形态是「**无/伪/空/地址不匹配 ⇒ 401**」（实测 4/4 保持），而「签名错 ⇒ 401」在现码下**不存在该不变量**（§5-N7）。

### §6.4 已知风险当场命中（**登记，不掩盖**）
| 时刻（本地） | 事件 | 证据 | 处置 |
|---|---|---|---|
| 21:59:22 | 自退 code=1（**本单开工前**已存在） | `ctrl/logs/seafood-api.log:19951-19999` | 本单未触 |
| 22:51:22 | 自退 code=1：`TypeError: Cannot set property message of #<ErrorEvent>` `at _n._connectionCallback (…/serverless/index.js:1379)` ⇒ 探针首 fetch `ECONNREFUSED` | `log:20001-20015` 逐字「进程退出，code=1」 | **面板路由** `POST /api/restart {"sid":"seafood-api"}` ⇒ pid 18800，随后 `/health` 200 |
| 22:56:06 | 同上（我在 `/health` 轮询 25 次期间触发） | `log` 尾 6 行 + 「进程退出，code=1」 | 同上 ⇒ pid 23415；此后**改为单次** `/health` |
| 15:08:37Z | 改后 run2 末次 `/health` ⇒ **200** | `post/steps.log` 末段 | **服务留在「可启动 + 登录可用」态**（pid 41372，`state=running`） |

**未做**：`pkill -f` / `killall`（全单 0 次）；停/重启任何**非本单**服务（jinli pid 84595 全程未触）；`git add/commit/push`；删除型 SQL；`npm install`；`execute_code`；建表/建列；改 `.env.local`。

### §6.5 写集自检（硬边界）
`git -C /Users/kevin/bistro/seafood status --short` 现取：
```
 M backend-ts/src/index.ts              ← 唯一改动的既有文件（1 hunk，+7/−1）
?? backend-ts/scripts/p4z-b5l-01-login.ts    ← 探针
?? backend-ts/.p4-artifacts/b5l-20260930T145112Z/  ← 产物
?? backend-ts/.p4-artifacts/B5L_RUN_TAG.txt        ← run tag 落盘
?? docs/audit/p5-fix-login.md          ← 报告
```
**未写/未改**：`migrations/**`（→ **绝未建表**）、`src/ledger.ts`、`src/ledger-errors.ts`、`src/commission.ts`、`src/currency-service.ts`、任何 spec、`docs/seafood.master-plan.md`、`frontend/**`、既有 audit/qa 件、`.env.local`。
