# S55a · 生产切库法证 + 终验（Kong · 严格只读）

> 本单硬口径：**零写库 · 零 env 变更 · 零部署 · 零仓改动**。产出 = 本报告 + `backend-ts/.s55a-artifacts/s55a-20261007T114716Z/`。
> 全文**不含任何密钥值**（只出现键名 / host 前缀 / sha8 指纹 / 计数 / 状态码）。

---

## §0 对锚（开工时现取）

| 项 | 读数 |
|---|---|
| `git log --oneline -3` | `aa5aa5d` / `582f4d6` / `6e0266f`（`582f4d6` 仍在祖先链上，对锚成立） |
| `git status --porcelain` | **空**（开工时） |
| 分支 | `main` |
| `git rev-parse --short origin/main` | `aa5aa5d`（= 本地 HEAD，已推） |
| 现时 | 2026-10-07 19:44–19:51 CST |

> 说明：开工时 HEAD = `582f4d6`；本单执行途中，**兄弟 agent 于 19:44:18 追加提交 `aa5aa5d`**（`chore(incident): §5.392/B26 …`）。故复取时 HEAD 前推一位。两提交**均未由本单产生**，本单**未 commit、未 push**。

---

## §1 生效链定位：**哪一族在生效**

### 结论（三件不可丢之①）

> **生效的是「无前缀（规范名）族」**。它在 `2026-10-07 13:00:28` 写入 Vercel（Production+Preview），按 `src/env.ts` 的「先到先得」规则**压过** `2026-09-27 10:36:25` 的 `SF_*` 族（后者仅在规范名缺失时作回退）。
> **且该族指向新库 `ep-red-moon-b3xvoyjk`** ⇒ 生产读的是**新库**。
> **静默切库时刻 = 生产部署 `ddeb500a`（2026-10-07 13:10:49）**——而非 S54/S54b 那几次推送。

### 证据①：两族 env 的名单与创建时间（`vercel env ls production` + API `createdAt`；**只列名不取值**）

`SF_*` 族（**18 键**，全部 `created 2026-09-27 10:36:25` = **10 天前**）：
`SF_POSTGRES_HOST` · `SF_PGPASSWORD` · `SF_POSTGRES_USER` · `SF_PGHOST` · `SF_NEON_PROJECT_ID` · `SF_DATABASE_URL` · `SF_POSTGRES_DATABASE` · `SF_POSTGRES_PASSWORD` · `SF_VITE_NEON_AUTH_URL` · `SF_DATABASE_URL_UNPOOLED` · `SF_POSTGRES_URL_NON_POOLING` · `SF_NEON_AUTH_BASE_URL` · `SF_PGHOST_UNPOOLED` · `SF_POSTGRES_URL_NO_SSL` · `SF_POSTGRES_PRISMA_URL` · `SF_POSTGRES_URL` · `SF_PGUSER` · `SF_PGDATABASE`

无前缀族（**18 键**，全部 `created 2026-10-07 13:00:28` = **今天**；`environments = Preview, Production`）：
`PGPASSWORD` · `POSTGRES_HOST` · **`DATABASE_URL`** · `POSTGRES_URL_NO_SSL` · `VITE_NEON_AUTH_URL` · `POSTGRES_PRISMA_URL` · `NEON_AUTH_BASE_URL` · **`POSTGRES_URL`** · `POSTGRES_PASSWORD` · `POSTGRES_DATABASE` · `POSTGRES_USER` · `PGHOST_UNPOOLED` · `NEON_PROJECT_ID` · **`POSTGRES_URL_NON_POOLING`** · `PGUSER` · `PGHOST` · **`DATABASE_URL_UNPOOLED`** · `PGDATABASE`

其它：`SECRET_KEY`（Production，`2026-10-01 07:56:39`；另有 Preview 一份 `07:58:27`）· `DEEPSEEK_API_KEY` / `CRON_SECRET`（Production `2026-10-01 12:26`）。

> 两族**各自 18 键、逐键同名**（只差 `SF_` 前缀）⇒ 典型「同一 Neon 集成的两份前缀配置」，不是两套独立配置。

### 证据②：`src/env.ts:51-62` 优先级**原文**（先到先得 = 规范名优先）

```ts
const VERCEL_PREFIX_FALLBACKS: ReadonlyArray<readonly [string, string]> = [
  ['DATABASE_URL', 'SF_DATABASE_URL'],
  ['DATABASE_URL_UNPOOLED', 'SF_DATABASE_URL_UNPOOLED'],
  ['POSTGRES_URL', 'SF_POSTGRES_URL'],
  ['POSTGRES_URL_NON_POOLING', 'SF_POSTGRES_URL_NON_POOLING'],
];
for (const [canonical, vercelName] of VERCEL_PREFIX_FALLBACKS) {
  if (!process.env[canonical] && process.env[vercelName]) {
    process.env[canonical] = process.env[vercelName];
  }
}
```
判据：`!process.env[canonical]` ⇒ **规范名存在时本循环是 no-op**；`SF_*` 只在规范名**缺失**时回填。
现实：规范名 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` **均存在**（今天 13:00:28 写入）⇒ **无前缀族为事实真源，`SF_*` 全程不参与**。
（serverless 无 `.env.local` 兜底 ⇒ 云端 `process.env` 只来自 Vercel 注入。）

### 证据③：生产部署的 commit（git 联动，`source:"git"`，ref `main`）

| 部署（~时） | commit | 状态 |
|---|---|---|
| 19:44:23 | `aa5aa5d` | READY（**当前别名指向它**） |
| 19:30:37 | `582f4d6` | READY |
| 19:23:34 | `6e0266f` | READY |
| 19:11:00 | `057415f` | READY |
| 15:15:11 | `967cf21` | READY |
| 15:08:25 | `c9b60e1` | READY |
| 15:00:41 | `285d336` | READY |
| 14:50:12 | `0cc198c` | READY |
| **13:10:49** | **`ddeb500`** | READY（**切库边界**） |
| 12:57:56 | `ec3e1aa` | READY（**边界前最后一发**） |
| 12:57:59 | `1f2fac7` | READY |

`vercel inspect` 的 Aliases = `ssseafood.vercel.app` / `seafood-alwaysfit.vercel.app` / `seafood-git-main-alwaysfit.vercel.app`（均指向最新部署）；Builds = `λ backend-ts/src/index.ts (2.21MB) [sin1]`。**git 联动成立 ⇒ 每次 push 到 `main` 即触发一次生产部署。**

### 证据④（判定性）：切库边界 = 13:10:49，**不是本批推送**

Vercel env 变更对**既有部署不生效**（部署环境在创建时快照）。**实测反证**：用 `vercel curl`（绕 Vercel Auth）直取**边界前**那一发部署 `ec3e1aa`（12:57:56，建于 env 写入之前）：

| 部署（commit） | 建于 | `/api/task/all` 实测 |
|---|---|---|
| `ec3e1aa`（边界前） | 12:57:56 | **`data` 非空**（旧库有任务；首行 `tID:2` `p4b2:fixture:A`） |
| `ddeb500`（边界后） | 13:10:49 | `data: []`（新库） |
| `582f4d6`（19:30） | 19:30:37 | `data: []`（新库） |

- 若 env 是「运行期活注入」，则**所有**部署（含 `ec3e1aa`）今天都应读新库 = `[]`；实测 `ec3e1aa` **今天仍返非空** ⇒ env 确为**部署时快照**。
- ⇒ env（13:00:28 写入）之后**第一发**生产部署就是切库点 = **`ddeb500` @ 13:10:49**。
- ⇒ **边界前那发（只用 `SF_*`）读旧库**、**边界后（用无前缀族）读新库** ⇒ 顺带**证死 `SF_*` → 旧库、无前缀 → 新库**。

> **对前提的订正（见 §7）**：B26 记「我的 push 触发部署并激活新 env ⇒ 切库」。法证显示切库发生在 `13:10:49`，**早于 S54/S54b 推送约 6 小时**；那几次推送只是「又一次落在已切过的库上」，不是切库因。

---

## §2 强化判别：逐端点期望 / 实测读数表

两库基线（本单**只读** `SELECT`/`SHOW` 现取，`db-readonly-probe.json`）：

| 事实 | 旧库 `ep-holy-forest-b3fi7u3u` | 新库 `ep-red-moon-b3xvoyjk` |
|---|---|---|
| host 指纹（sha8 of `.env.local` / `.env.newdb.local` 的 `DATABASE_URL`） | `7e2652d3` | `b8783cd3` |
| `job` | **45** | **0** |
| `listing` | **24** | **0** |
| `users`（均带 evm） | **64** | **26** |
| `account` cid=1 | 36 | 23 |
| `ledger_entry` cid=1 | 413 | 248 |
| `admin_user_role` / `admin_role` | 7 / 5 | 0 / 1 |
| `users.is_admin=true` | uid 1,10,**970201** | uid 1,10 |
| `schema_version` | 0044 | 0044 |

| # | method | 端点 | gating（`src/index.ts`） | 期望·旧库 | 期望·新库 | **实测（生产）** | 判 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/health` | 公开（`:440` 共用 `sendHealthReport`） | ok/0044 | ok/0044 | **200** `ok:true` `schema_version:"0044"` | 不判别 |
| 2 | GET | `/api/task/all` | 公开（`:549`） | **45 行** | **0 行** | **200 `data:[]`** | **⇒ 新库** |
| 3 | GET | `/api/task/45` | 公开（`:563`，纯读） | 200 行 | 404 | **404** `LEDGER_REF_NOT_FOUND` `{ref_type:"job",ref_id:"45"}` | **⇒ 新库** |
| 4 | GET | `/api/prize/24` | 公开（`:592`） | 200 行 | 404 | **404** `LEDGER_REF_NOT_FOUND` `{ref_type:"prize",ref_id:"24"}` | **⇒ 新库** |
| 5 | GET | `/api/prize/all` | 公开（`:535`） | 非空? | 空 | **200 `data:[]`** | 弱（旧库 prize 表未单独取证） |
| 6 | GET | `/api/home` | 公开（`:837`） | tasks 非空 | tasks 空 | **200 `{tasks:[],prizes:[],…}`** | ⇒ 新库 |
| 7 | GET | `/api/market/1/orderbook` | 公开（`:1163`） | 25 挂单 | 0 | **200 `data:[]`** | 弱（两库 orderbook 可能皆空） |
| 8 | GET | `/api/role-names` | **公开**（`:1210`，无 actor） | overlay | overlay | **200 `{role_names:null,site_text_overrides:null,updated_at:null}`** | 不判别（两库皆无 overlay） |
| 9 | GET | `/api/user/asset/6` | 公开（`:657`，纯读） | 930 | 930 | **200 `points:930,time_update:1790939114`** | 弱（S54b 已令两库 account 全等） |
| 10 | GET | `/api/batt` | `requireActor`（`:1246`） | — | — | **401** `AUTH_UNAUTHORIZED` | 凭据口（未带 token） |
| 11 | GET | `/api/checkin` | `requireActor`（`:1278`） | — | — | **401** `AUTH_UNAUTHORIZED` | 凭据口 |
| 12 | GET | `/api/rating/summary` | `requireActor`（`:1408`） | — | — | **401** `AUTH_UNAUTHORIZED` | 凭据口 |
| 13 | GET | `/api/timeliness` | `requireActor`（`:1437`） | — | — | **401** `AUTH_UNAUTHORIZED` | 凭据口 |
| 14 | GET | `/api/user/all` | `requireAdmin`（`:1941`） | — | — | **401** `AUTH_UNAUTHORIZED` | 凭据口（未带 token） |

> 第 10–14 行：**未带任何凭证**打受保护口 ⇒ **401 `AUTH_UNAUTHORIZED`**（R107 形状 `{error:{code,message,i18n_key,details}}`）。**这是"读数"**（@1914/K5：失败形态本身是正向对照），但**不判别库**——它在 `resolveActor` 的**无 token 短路**处返回，**未触库**（`src/index.ts:303-311`：`!authHeader.startsWith('Bearer ')` ⇒ 立即 `unauthorized`）。
> 端点 2/3/4/6 四口**同时指向新库**，交叉独立 ⇒ 「生产 = 新库」判定闭合（连同背景的 schema 0044 ∧ job 0 行排除法）。

---

## §3 ★认证链路判定（本单最关键）

### (a) 身份真源 = **本库 `public.users` 表**，**不是** Neon Auth 托管

**读码事实（`src/auth.ts` 全文 255 行 + `src/index.ts:453-523`）：**

1. 会话 = **自签 HMAC-SHA256 JWT**：`signToken` / `verifySignedToken`（`auth.ts:62-104`）用 `process.env.SECRET_KEY`（`auth.ts:9-32`，缺失即 `process.exit(1)` fail-fast，**拒绝**公开占位常量）。
2. `/api/auth/challenge`（`:457`）⇒ `startWalletAuthChallenge`（`auth.ts:135`）：**纯计算**（EVM 正则 + `crypto.randomBytes(16)` nonce + 组原文消息 + 签 challenge_token），**无 IO、无网络、不触库**。
3. `/api/auth/verify`（`:466`）⇒ `consumeWalletAuthChallenge`（`auth.ts:176`）：**纯计算**（HMAC 校验 + `ethers.verifyMessage` EIP-191 恢复地址 + 大小写不敏感比对）。**凭据面失败 ⇒ 401**（`:484 sendAuthError(res,401)`），**此段不触库**。
4. 仅当签名验过 ⇒ 落库面 `DatabaseService.findOrCreateUserByEvm(challenge.evm)`（`:489`）⇒ 读/写 **`public.users`**（`database.ts:2175`：`getUserByEvm` 未命中则 `createUserByEvm`）⇒ `getUserAsset`（读 `public.account`）⇒ `createSessionToken`。落库面异常 ⇒ §14 分类器（`LEDGER_TX_TIMEOUT` **503**），**不吞成 401**。
5. `/api/auth/login`（`:520`）= 内部改写 `req.url` 复用 `/api/auth/verify`。

**grep 跨仓硬证据（`*.ts/tsx/js/json/html`，排除 `node_modules/dist`）：**
- **`NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL` / `NEON_AUTH_*` 在应用代码中出现 0 次**（`src/`、`frontend/src/` 皆无）。
- `frontend/src/auth.js:372/382`：前端登录 = 依次调 `/api/auth/challenge` → `/api/auth/verify`，把返回的 `access_token` 存本地（`auth.js:18-22`），后续请求带 `Authorization: Bearer <token>`（`auth.js:51-58`）。**前端从不读 `VITE_NEON_AUTH_URL`**。
- 唯一命中 `neon_auth` 的是**库内 schema**（两库都有 9 张表：`account/invitation/jwks/member/organization/project_config/session/user/verification`）与**诊断脚本**；`migrations/0006_user_to_users.sql:30-32` 明写「本库有 4 条 FK 指向它，**全部在 `neon_auth` schema**」。本单只读取证：指向 `neon_auth` 的 FK **6 条，全部是 `neon_auth.*` 内部表**（`session.userId`/`account.userId`/`member.*`/`invitation.*`），**`public` schema 无一条**。

> **判定：** 身份真源 = **本库 `public.users`**（每个用户的 `evm` 列 + `is_admin`/`admin_user_role`）。`NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL` 是**未被任何代码读取的死 env**（Neon Auth 集成残留）；`neon_auth` schema 亦然（**应用从不读写它**）。**没有"托管认证"在生效。**

### (b) 「env 切了库、auth 端点未切」会咋样 —— 逐条风险

**先厘清**：本仓 auth **不是**独立于库的托管服务，它**随 `DATABASE_URL` 一起切**——切库 = 认证真源同时换库。因此风险不是「auth 没切」，而是「**auth 跟着切了，但身份/资产/权限在另一库**」。逐条：

| # | 风险 | 机理（逐字引码） | 现盘读数 |
|---|---|---|---|
| **R1** | **死 env 造成"托管认证"错觉** | `NEON_AUTH_BASE_URL`/`VITE_NEON_AUTH_URL`（+ `SF_` 版）在 Vercel 上有值但**代码 0 引用** ⇒ 误以为有托管身份层，排障时找错方向 | 已证：全仓 grep 0 命中 |
| **R2** | **登录是写路径** | `findOrCreateUserByEvm`（`database.ts:2179-2180`）：`getUserByEvm` 未命中即 **`createUserByEvm`**（INSERT `public.users`），随后 `touchUserLogin` 也写库；新户还发 `+signupBatt`（`grantSignupInviteBatt`） | **生产 `/api/auth/verify` 破凭据门即落库写**（本单**未执行**，标 `NOT_MEASURED`） |
| **R3** | **旧库独有身份 → 登录即"另起一户"** | 旧库 64 用户 vs 新库 26；旧库独有 38 个 uid（`900001-900008`/`910001-910010`/`910311`/`970001-970213`/`971100`/`971213` **全是夹具号段 ≥900000**）。其钱包在新库 `getUserByEvm` 未命中 ⇒ **新建一个全新 uid** | 旧库独有 uid = 38（**均夹具**）；**真实用户 26 个 uid 两库全等**（见 R5） |
| **R4** | **老 JWT 跨库解析** | `SECRET_KEY` 未变（Production `2026-10-01`，切库时**未动**）⇒ 切库前签发的 token **仍验签通过**；`resolveActor`（`:441-470`）先 `getUserById(sub)` 再回落 `getUserByEvm(evm)` ⇒ token 里的 uid 到**新库**解析 | 现盘 26 个真实 uid 两库**同人**（R5）⇒ **真实用户无冒充**；风险仅限**号段碰撞**（新库无 ≥900000 用户）与 30 min TTL 窗口（`ACCESS_TOKEN_EXPIRE_MINUTES`，已过） |
| **R5** | **uid↔evm 映射**（本单只读实测） | 26 个共有 uid 的 `evm` sha8 **逐个相等，失配 0** | `uid_evm_common:26  mismatch:0`（`admin-identity-probe.json`）⇒ 新库是旧库真实用户的**同人拷贝** |
| **R6** | **管理员集合缩水 / 绑定丢失** | 权限真源 = `users.is_admin` **OR** `EXISTS(admin_user_role)`（`auth.ts:35-40` 明写）。新库 `admin_user_role` = **0 行**、`admin_role` = 1 行 | 旧库 `is_admin` = uid **1,10,970201**；新库 = uid **1,10**（少 `970201`）。**种子管理员地址 `0x59f9…09b0` 在旧库 = uid `970213`（绑 `super_admin`），在新库查无此人 ⇒ 该 `super_admin` 绑定在新库不存在**（新库仅靠 `is_admin` 标志） |
| **R7** | **业务面数据空洞（同类"未切"错觉）** | 新库 `job 0`/`listing 0`/`content_translation 0`/`translation_cache 0`；旧库 45/24/321/213 | 生产 `/api/task/all`=[]、`/api/user/asset` 仅 19 个 uid 非零余额 ⇒ 站点"看着能用、业务全空" |
| **R8** | **回滚会造成反向跨库 token** | 若执行 §5 回滚（切回旧库），回滚前用新库签发的 token（同 SECRET_KEY）在旧库 `getUserById` 解析——真实 uid 仍同人（R5），故同 R4，风险低 | — |

**风险判定一句话**：**认证链本身健康（自洽自签、无托管依赖）**；真正的风险是「**身份/权限/业务真源已随库静默切换**」——尤其 **R6（管理员绑定丢失）** 与 **R2/R3（登录是写路径 + 旧库独有身份会另起户）**。

### (c) 实测（不带任何凭证/参数；**未用真账号/真钱包**）

**`POST /api/auth/challenge`，body `{}`（空）——逐字响应：**
```
HTTP/1.1 400
{"success":false,"message":"Invalid EVM address","error":"Invalid EVM address"}
```
（空 body 同响应。命中 `startWalletAuthChallenge` 的 EVM 正则失败 ⇒ `:462 sendError(res,400,…)`。**不触库**。）

**`POST /api/auth/verify`，body `{}`（空）——逐字响应：**
```
HTTP/1.1 401
{"error":{"code":"AUTH_UNAUTHORIZED","message":"Authentication is required","i18n_key":"auth.err.AUTH_UNAUTHORIZED","details":{}}}
```
（= 期望的 **401 `AUTH_UNAUTHORIZED`**；命中 `consumeWalletAuthChallenge` 的 `evm_address, signature and challenge_token required` 抛错 ⇒ `:484 sendAuthError(res,401)`。**在凭据面短路，未触库**。）

**`POST /api/auth/login`，body `{}`：** 同上 **401 `AUTH_UNAUTHORIZED`**（内部复用 `/api/auth/verify`）。

> 三个 auth 端点**均未带 token、未用真账号/真钱包**；`challenge` 不触库；`verify/login` 在**凭据面 401 短路**（其后的**落库面未被执行**）。

---

## §4 真数据可见性逐条读数

**新库 26 个真实用户（uid `1-12,17-22,34-41`，`evm` 齐全，与旧库同人）能否经公开端点被看到？**

| 面 | 端点（gating） | 能否看到 | 实测读数 |
|---|---|---|---|
| **uID → 余额/时间戳** | `GET /api/user/asset/:uID`（**公开·纯读**，`:657`） | **能看到** | uid 2=7400、3=1385、4=4、5=6、6=930、7=5100、8=4900、11=29374、12=139417、19=100、21=100、34=100、35=990、36=100、37=990、38=50、39=990、40=100、41=990（`points`+`time_update` 明文，**无需任何凭证**） |
| **uID → 是否开户** | 同上 | **能看到** | uid `1,9,10,13-18,20,22-33,42-70` 均 `{points:0,time_update:0}`（空态）⇒ 可判"哪些 uid 有余额" |
| **uID → EVM 地址** | — | **看不到** | 唯一出 `evm` 的口 `GET /api/user`（`requireActor`）与 `GET /api/user/all`（`requireAdmin`）均 **401**；其余公开口不回 evm |
| **用户总数/名册** | `GET /api/user/all`、`/api/user/stats`（`requireAdmin`，`:1941/:1957`） | **看不到** | **401 `AUTH_UNAUTHORIZED`**（`NOT_MEASURED`：未带 admin 凭证，真值须凭证；本单不取） |
| **我的账本流水** | `GET /api/user/ledger`（`requireActor`，`:696`） | **看不到** | **`NOT_MEASURED`**（未带 token；未执行） |
| **任务/商品行** | `/api/task/all`·`/api/task/:tID`·`/api/prize/all`·`/api/prize/:bID`（公开） | **看不到（新库为空）** | `task/all`=[]；`task/45`=404；`prize/all`=[]；`prize/24`=404 |
| **行情/挂单** | `/api/market/:bID/orderbook`·`/trades`（公开） | **看不到（新库为空）** | `/api/market/1/orderbook`=[] |
| **站点文案覆盖** | `GET /api/role-names`（公开） | 无内容 | `{role_names:null,site_text_overrides:null,updated_at:null}` |
| **受保护用户面** | `/api/batt`·`/api/checkin`·`/api/rating/summary`·`/api/timeliness` | **看不到** | 均 **401**（`NOT_MEASURED` 为真值，未带 token） |

> **推断**：真实用户**以"uID→余额+时间戳"的匿名形式公开可见**（`/api/user/asset/:uID` 无鉴权），**EVM 与名册不可见**（须 actor/admin）。按 `route-layer` 契约 `user/asset` 属公开读口，**非缺陷**；但意味着「**哪些 uid 有钱、有多少**」在生产是公开面。

---

## §5 ★回滚预案（只写文档、**不执行**）

**目标**：把生效的**规范名族**改回旧库（`ep-holy-forest-b3fi7u3u`），使生产 `/api/task/all` 回到 **45 行**。
**原理依据**：§1 已**证死** `SF_*` 族 → 旧库（边界前部署 `ec3e1aa` 只读得到旧库 45 行）。
**硬口径**：命令文本**绝不出现值**；本单**不执行**下列任何命令。

### 方案 A（**首选**：只删规范名族 ⇒ 自动回退 `SF_*`，**零值处理**）

> 因 `src/env.ts` 的先到先得，**删掉规范名**即让回退链启用 `SF_*`（旧库）。**不必写任何连接串**，最安全。

```bash
cd /Users/kevin/bistro/seafood

# A1 删生产作用域的规范名族（Preview 不动；--yes 跳过确认）
vercel env rm DATABASE_URL              production --yes
vercel env rm DATABASE_URL_UNPOOLED     production --yes
vercel env rm POSTGRES_URL              production --yes
vercel env rm POSTGRES_URL_NON_POOLING  production --yes

# A2 触发一次新部署（不带新代码）——下列二选一
#   A2a：对当前生产部署做 redeploy（会用【当前】env）
vercel redeploy seafood-vpnwvccn9-alwaysfit.vercel.app
#   A2b（备选，git 联动触发）：空提交推 main
#   git commit --allow-empty -m "ops: rollback 生产切回旧库（rm 规范名族⇒回退 SF_*）" && git push origin main

# A3 哨兵（等 Ready 后；--resolve 绕本机 DNS）
curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 \
  https://ssseafood.vercel.app/api/task/all \
  | python3 -c 'import sys,json;print("task/all rows =", len(json.load(sys.stdin)["data"]))'
# 期望：task/all rows = 45
```

### 方案 B（**显式改回旧库值**：覆盖规范名族，值取自 `.env.local` 同名键）

> 若不愿依赖回退链，或 `SF_*` 亦被改动过，用 B：把规范名族逐键**覆盖**为 `.env.local` 的值。**值只在 shell 内展开、经 stdin 传给 CLI，命令文本与日志均不出现值。**

```bash
cd /Users/kevin/bistro/seafood/backend-ts
set -u
for K in DATABASE_URL DATABASE_URL_UNPOOLED POSTGRES_URL POSTGRES_URL_NON_POOLING; do
  V="$(grep -E "^${K}=" .env.local | head -1 | cut -d= -f2-)"
  [ -n "$V" ] || { echo "MISSING $K in .env.local"; exit 1; }   # 缺键即停，不写半套
  TMP="$(mktemp)"; printf '%s' "$V" > "$TMP"                    # 值落临时文件
  ( cd .. && vercel env add "$K" production --sensitive --force < "$TMP" )
  rm -f "$TMP"; unset V
  echo "set $K  <- sha8=$(printf '%s' "$K" | shasum -a 256 | cut -c1-8)"   # 只打键名/占位指纹，不打值
done
# 触发部署与哨兵同 A2 / A3
```

> **注**：`PG*` / `NEON_*` / `POSTGRES_*`（非上述四键）**应用代码不读**（仅 `db.ts` 读四键规范名）⇒ 回滚**不必**动它们。`SECRET_KEY` **不动**（回滚不换签名密钥，token 语义随之切库，见 R4/R8）。

### 哨兵与验收（回滚生效后）

| 哨兵 | 期望 | 命令 |
|---|---|---|
| **主哨兵** | `/api/task/all` = **45 行** | 见 A3 |
| 辅 1 | `/api/task/45` = **200**（旧库有 job 45） | `curl -sS --resolve ssseafood.vercel.app:443:76.76.21.21 -o /dev/null -w '%{http_code}\n' https://ssseafood.vercel.app/api/task/45` |
| 辅 2 | `/api/health` = `ok:true` `schema_version:"0044"` | `curl -sS … https://ssseafood.vercel.app/api/health` |
| 辅 3 | 生效族 = 无前缀**已删** ⇒ `vercel env ls production` 里 `DATABASE_URL` 等 4 键**仅剩 `SF_*` 行** | `vercel env ls production`（只列名不取值） |

### 逐条顺序与耗时估算

| 步 | 动作 | 估时 |
|---|---|---|
| 1 | A1 删 4 键（`vercel env rm … --yes`） | 4 × ~2–3 s ≈ **10 s** |
| 2 | A2a `vercel redeploy`（构建 2.21MB 函数，sin1） | **30–45 s**（至 Ready） |
| 3 | 边缘传播（别名切换） | **10–60 s** |
| 4 | A3 哨兵确认 `45 行` | 即时 |
| — | **合计（口径 A）** | **≈ 1–2 分钟**（含传播余量 ≤3 分钟） |
| 备 | 若走 A2b（空提交 push） | +push→构建触发 ≈ +15 s ⇒ ≈ 1.5–2.5 分钟 |

**回滚前置检查（执行前逐条确认）**：① `vercel env ls production` 里 `SF_DATABASE_URL` 等 4 键仍在（回退链依赖它们）；② `git status` 干净或已知；③ 抄下当前生产部署 id（`vercel ls` 首行）作**反向回滚点**；④ 回滚本身会切库 ⇒ 回滚前先想清"这是否是 Kevin 要的方向"（切库属上线动作）。

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 / 端点 |
|---|---|---|
| **写路径冒烟**（`POST /api/auth/verify` 真签、`POST /api/checkin`、`/api/rating`、`/api/user/profile` 等） | **`NOT_MEASURED`** | **生产写需 Kevin 批**（硬口径）；本单**未执行任何写** |
| 受保护口**真值**（`/api/batt`·`/api/checkin`·`/api/rating/summary`·`/api/timeliness`·`/api/user/all`·`/api/user/stats`·`/api/user/ledger`） | **`NOT_MEASURED`** | 未带 actor/admin token（不得用真账号）；仅取到 **401 形态** |
| **Vercel env 的"值"**（两族各自指向哪个 host） | **未拉值**（硬口径「只列名单与创建时间，不得拉值」） | 指向结论由**行为反证**得出（§1 证据④），非读值 |
| `SF_*` 族是否**曾**指向与今日不同的库 | **`NOT_MEASURED`** | 无边界前部署的历史读数可比（只能证"边界前=旧库"） |
| 旧库 `prize` 表计数 | **`NOT_MEASURED`** | 旧库无独立 `prize` 计数（`/api/prize/all` 两库皆空，不判别） |
| `role-names` 是否判别 | 已测为**不判别** | 两库皆 `null` |
| 两库 `session`/`neon_auth` 表的行数 | `NOT_MEASURED` | 与应用无关（应用 0 引用），未取值 |
| 生产域名 `seafood-opal.vercel.app`（历史文档提及） | **未测** | 别名面只列到 `ssseafood` / `seafood-alwaysfit` / `seafood-git-main` 三条 |

---

## §7 自曝

1. **对前提的订正（重要）**：B26 归因「我的 push 触发部署 ⇒ 激活新 env ⇒ 切库」。本单**行为反证**：切库边界 = **`ddeb500` @ 2026-10-07 13:10:49**，比 S54/S54b 推送**早约 6 小时**（那几次推送只是"又落在已切过的库上"）。**归因应改为**「env 于 13:00:28 写入 + env 部署时快照 ⇒ 13:10:49 那发部署（`ddeb500`）起，生产即切库」。切库**与本次批量推送无关**，而是**该日凌晨即已发生、近 6.5 小时未被察觉**。
2. **本单未 commit / 未 push**：`docs/audit/` 下本报告与本单产物**未入库**（硬口径⑤）。执行途中兄弟 agent 追加的 `aa5aa5d` 与本单无关。
3. **只读探针的边界**：两库探针（`dbprobe.mjs` / `probe2.mjs`）**只发 `SELECT` / `SHOW`**（无 INSERT/UPDATE/DELETE/DDL/nextval）；但**未显式 `SET default_transaction_read_only=on`**（`SHOW transaction_read_only` 回报 `off`）。这一点如实登记：**零写来自"只发读语句"这一构造，而非会话级护栏**。建议后续只读单在连接后补 `SET TRANSACTION READ ONLY`。
4. **判别口径的诚实度**：真正的**判别端点**只有 `/api/task/all`·`/api/task/45`·`/api/prize/24`·`/api/home` 四口（皆指向新库）；`role-names`·`market/orderbook`·`user/asset`（S54b 已令两库 account 全等）**皆不判别**——本报告如实标注为"弱"或"不判别"，**未拿它们凑数**。
5. **`/api/prize/all` 的旧库期望未硬取**：旧库无独立 `prize` 计数，标"弱"。
6. **凭据面未越界**：全程**未使用任何真账号/真钱包/token**；未触发 `/api/auth/verify` 的落库面（未越过凭据门）。
7. **多 agent 并发**：执行窗口内生产部署列表至少新增一发（`aa5aa5d`，19:44:23）⇒ 读数为**动态时点**，以本报告各表标注的时间为准。

---

### 产物清单（`backend-ts/.s55a-artifacts/s55a-20261007T114716Z/`）

| 文件 | 内容 |
|---|---|
| `local-env-fingerprints.json` | `.env.local` / `.env.newdb.local` 各键 host 前缀 + sha8（**无值**） |
| `db-readonly-probe.json` | 两库只读：counts / uids / user_cols / neon_auth 表与 FK |
| `admin-identity-probe.json` | 两库 `is_admin` / `admin_user_role` / uid↔evm 失配（0） |
| `vercel-env-and-deploys.json` | 42 条 env（名/目标/创建时间）+ 30 发生产部署（commit/状态/时间） |
| `vercel-env-ls-production.txt` | `vercel env ls production` 原文（只列名） |
| `prod-endpoint-probe.json` | 17 个生产端点 method/path/http/响应体 |
| `auth-endpoints-raw.txt` | `challenge`/`verify` 逐字原始响应 |
| `dbprobe.mjs` / `probe2.mjs` / `collect.sh` | 只读探针脚本 |
