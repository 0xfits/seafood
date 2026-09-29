# P4-B2a-HTTP · 鉴权面解锁 + 批 2a 写分支 HTTP 闭合（Kong）

**run tag**：`b2ahttp-20260929T133731`
**artifact**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b2ahttp-20260929T133731/`
`pre/probe.json`（schema 真值/夹具/索引）· `pre/patch-log.json`（补丁逐条命中数）· `pre/database.ts.orig`（改前原文）· `post/key-probe.json` · `post/final-snapshot.json` · `post/transcript.md`（★ 终端实测逐字转录）
**服务**：`seafood-api` @ `127.0.0.1:5788`，经面板 `POST http://127.0.0.1:5555/api/restart {sid:"seafood-api"}` 重启（`ok:true, pid 89702`），`GET /health` = **200**（`schema_version 0017`, PG 18.6）后开测。
**口径**：所有读数为**实测**（HTTP status + 库侧 `COUNT(*)`/`SUM`），带引号表名断言（§5.7①：真表名 `users`，未用裸 `user`）；退出码不取自管道之后；`':'` 用 `chr(58)` 拼接以避开 node `-e` 引号陷阱。

---

## §1 修 `users` 列名映射（`src/database.ts`）

**先取真值（不是凭记忆）**：`information_schema.columns WHERE table_schema='public' AND table_name='users'` ⇒ `uid:bigint! , evm:text! , bio:text! , is_admin:boolean! , time_reg:timestamptz! , time_login_last:timestamptz!`；`to_regclass('public.users')='users'`；`column_name='uID'` / `'EVM'` ⇒ **均 null（不存在）**（`pre/probe.json:assert_users_table`）。索引侧：`users_pk(uid)` / `users_evm_uniq(evm)` / `idx_users_evm_lower(lower(evm))`。

**改动 7 处（6 条补丁规则，逐条断言命中数，命中数不符即中止不写文件；全部 `ok:true`）**，`grep -c` 残留旧列 = **0**：

| # | 位置 | 改前 | 改后 |
|---|---|---|---|
| 1 | `normalizeUser` | `getValue(row,'uID','id')` / `getValue(row,'EVM')` | 追加新列回退键 → `'uID','uid','id'` / `'EVM','evm'` |
| 2 | `getNextUserId` | `MAX(NULLIF(BTRIM("uID"),'')::int)` FROM `"users"` | `MAX(uid)` FROM `public."users"` |
| 3 | `getAllUsers` | `ORDER BY COALESCE(NULLIF(BTRIM(u."uID"),'')::int,0)` | `ORDER BY u.uid` |
| 4 | `uID` 谓词 ×3（`getUserById` / `touchUserLogin` / `updateUserProfile`） | `WHERE COALESCE(NULLIF(BTRIM(u."uID"),'')::int,0) = ${uID}` | `WHERE u.uid = ${uID}` |
| 5 | `getUserByEvm` | `WHERE LOWER(COALESCE(u."EVM",'')) = ${addr}` | `WHERE lower(u.evm) = ${addr}`（走 `idx_users_evm_lower`） |
| 6 | `createUserByEvm` | `INSERT INTO "users" ("uID","EVM",...)` | `INSERT INTO public."users" (uid, evm, bio, is_admin, time_reg, time_login_last)` |

**响应键集不变（硬要求 1 的验收）**：`UserRecord` 仍是 `{uID, EVM, bio, is_admin, time_reg, time_login_last}`（大写键由 mapper 产出，新列名只作 `getValue` 回退键追加在旧键之后）；`GET /api/user` 实测 `data_keys = [uID, EVM, bio, is_admin, time_reg, time_login_last, points, requires_profile_completion]`（8 键，`buildUserPayload` 形状），`uID=970001`、`EVM=0x9700…0000` 非零非空 ⇒ mapper 真的取到了新列（若键集错位会退化成 `uID:0 / EVM:""`）。
`resolveAdminAccess`/`buildAdminAccess` 无 SQL 直查（经 `getPermissionsForUser → listPersistedPermissionGroups` 恒空组），故无需改列名。

**编译/注册面**：`tsc --noEmit` ⇒ **exit 0**；`grep -cE "^app\.(get|post|put|patch|delete)\(" src/index.ts` ⇒ **51**（未新增对外路径）。

---

## §2 铸 token 与鉴权面（实测，非假设）

**服务端生效密钥取证**（两候选各铸一枚真 token 打 `GET /api/user`，命 200 者为准）：

| 候选 | key_len | token_fp(sha256前12) | status |
|---|---|---|---|
| `dotenv` 读到的 `SECRET_KEY`（`.env.local`/`.env`） | 64 | `06b5d831dbd7` | **401** |
| `auth.ts:3` 硬编码兑底常量 | 20 | `7cf048af86a5` | **200** |

**结论（实测）**：服务端实际生效的是 `auth.ts:3` 的**兑底常量**；用 `.env.local` 的 `SECRET_KEY` 铸的 token 被服务端判 `Invalid token signature`——**服务端日志逐字坐实**：`[ERR] Failed to resolve actor: Error: Invalid token signature at verifySignedToken (src/auth.ts:68:11) ← verifySessionToken (auth.ts:200) ← resolveActor (src/index.ts:110)`（`post/transcript.md` 日志段）。机制 = `index.ts` 先 `import './auth'`（第 4 行）后 `import './database'`（第 11 行），而 `dotenv.config()` 只在 `database.ts` 顶部执行 ⇒ `auth.ts:3` 取值时 `.env` 尚未加载。

**鉴权面读数（bearer = 生效密钥铸的 token；输出不含 token 本体，产物内 JWT 三段式首段前缀即 `e`,`y`,`J` 三连字符计数 = 0）**：

| 端点 | 无 token | 有 token | 备注 |
|---|---|---|---|
| `GET /api/user` | **401** | **200**（8 键，`uID=970001`） | 401 仍保留 |
| `GET /api/task-progress` | — | **200** | 走 `listTaskProgressByUser(970001)` |
| `GET /api/admin/me` | — | **200** | 返回 `adminAccess`（`is_admin=false, can_access_admin=false, permissions=[]`）⇒ 200 而非 403（该端点只做 `requireActor`，不判 admin） |
| `GET /api/user`（错签名 token） | — | **401** | 负对照，证明上面 200 不是「无脑放行」 |

**旧病已消**：重启后服务端日志中**不再出现** `Failed to resolve actor: NeonDbError: column u.uID does not exist`（`post/transcript.md` 日志段为重启后全文尾部，仅 2 条 `Invalid token signature`，均来自上述负对照探针）。上一片「写端点全 401」的真因（`resolveActor` 在 DB 层抛错被 catch 吞成 401）**已闭合**。

> §5.7⑪ 附注：本单随后一次重测（`post/key-probe.json`）出现**两候选都 401** —— 同批日志/异常显示为 **Neon HTTP 连通性抖动**（`NeonDbError: Error connecting to database: fetch failed / cause: ConnectTimeoutError UND_ERR_CONNECT_TIMEOUT`）。即：**401 不等于密钥错**，本仓把 DB 异常也吞成 401，故任何 401 判读必须同时看服务端日志（已按此口径执行）。

---

## §3 批 2a HTTP 写分支闭合（上一片 `NOT_MEASURED` 的主体）

**J4 提交交付物 —— `POST /api/task-progress/:identifier/submit`（真 token 端到端，夹具 job 3 / application 4，worker 970002）**

| id | 请求 | 期望 | **实测** | 幂等读数 |
|---|---|---|---|---|
| B3 | worker 970002 + `create_key=cli:p4b2:submit:J3A` | 200 | **200**（`success:true`，`data` = TaskProgressRecord 9 键） | 首次落行：`job_submission` **0 → 1**，`review_status='pending'` |
| B4 | 同人**同键重投**（同指纹） | 200 replay | **200 + `idempotent_replay:true`** | `job_submission` **仍是 1 行**（未产生第二行）；`job_submission.job_id=3` 恒 1 行 |
| B5 | 他人（970001）对 970002 的申请 | 403 | **403** | 零写 |
| B6 | 不存在 identifier `999999` | 404 | **404** | 零写 |
| B7 | 对 **`status='applied'`** 的申请（app 1/job 2）提交 | 409 | **409**（借码 `LEDGER_CURRENCY_INVALID_TRANSITION` + `reason=JOB_APPLICATION_STATE_INVALID`） | 零写；`job 2` 仍 `open` |

**同键重投的库侧佐证（`post/final-snapshot.json`）**：`job_submission` = **1 行**：`{submission_id:1, job_id:3, worker_uid:970002, review_status:'pending', create_key:'cli:p4b2:submit:J3A'}`；`job 3` = `{status:'submitted', worker_uid:'970002'}`（J4 的状态机半边生效）。

**J2/J3（apply/accept）—— HTTP 层：路径未注册**
`POST /api/job/2/apply` ⇒ **404**、`POST /api/job/2/accept` ⇒ **404**（真 token，payload 按 §4.2 J2/J3 字段给全）。与 `docs/route-layer.spec.md §1`（125–126 行，批 2 目标路径）对照 ⇒ **本片未注册**（`route-layer.spec.md` 硬边界禁改；端点计数须恒 51，增路径即越界）。其 service 半边 `applyToJob` / `acceptApplication`（`src/job-service.ts:175/208`）已由上一片 `p4-b2a-job-write.md` 以脚本级证据交付；**HTTP 层仍为 `NOT_MEASURED`**（见 §5）。

**非资金边界（逐字遵守）**：本单**未触碰** `claim`（：505，唯一既有语义 = 发放奖励 + 直写 `account`）、`approve`/`settle`、托管、`escrow`/`settle_txid`、任何带分录动作；测试 `info_input`/`create_key` 只用 `cli:p4b2:*` 前缀。

---

## §4 台账与非资金不变量

**命名台账（表 × 前缀 × 行数，exact `COUNT(*)`，带引号表名）**

| 表 | 前缀 | 行数 | 口径 |
|---|---|---|---|
| `job_submission` | `cli:p4b2:%` | **1** | 实测（= B3 那一行；`cli:p4b2a:%` 派生键 = **0**） |
| `job_application` | `cli:p4b2:%` | **2** | 来自 `pre/probe.json`（`cli:p4b2:app:A2` / `:B2`，本片零新增） |
| `job` | `cli:p4b2:%` | `NOT_MEASURED` | 计数探针请求在两轮里被连通性/引号故障打断，**未取到**（禁填 0） |
| `ledger_entry` | 任意 | **0** | 实测：全表 0 行 ⇒ 增量 **0** |

**before/after 逐表计数差（同一口径，表名带引号）**

| 表 | before（`pre/probe.json`，13:38Z） | after（`post/final-snapshot.json`，13:5xZ） | Δ |
|---|---|---|---|
| `job_submission` | 0（`fixtures.job_submission = []`） | **1** | **+1**（且同键重投**未**再加行） |
| `job` | 2（job 2/3） | 2 | **0** |
| `job_application` | 2（app 1/4） | 2 | **0** |
| `account` | 4 行 | 4 行 | **0** |
| `ledger_entry` | 0 | 0 | **0** ★ |
| `users` | 计数未取（仅逐行列夹具 970001/970002） | 2 | `NOT_MEASURED` |

**非资金不变量（硬要求 4）**
* `ledger_entry` 行数 = **0 → 0**，**增量 = 0** ★（实测；且本单全程无任何分录动作）。
* `account`：行数 **4 → 4**；`SUM(balance)` = **0 → 0**；`SUM(frozen)` = **0 → 0**（实测字符串 `"0"`）。
* `account` 全行 dump hash（`md5(string_agg(uid:cid:balance:frozen:version, ',' ORDER BY uid,cid))`）**post = `7516d8c6a9a30f96eb95417652e07dbd`**。**pre 值未取到 ⇒ 「dump hash 不变」未证 = `NOT_MEASURED`**（不拿 post 单值冒充前后一致的证据）。
* 未执行任何 `DELETE`/`TRUNCATE`/`DROP`；`job_application` 4 行夹具与 `account` 4 行零删改。

---

## §5 `NOT_MEASURED`（禁填 0/空）

1. **`POST /api/job/:jobId/apply`（J2）、`POST /api/job/:jobId/accept`（J3）的 HTTP 业务分支**：路径**未注册** ⇒ 只能实测到 **404**；其 200/403/409/幂等分支在 HTTP 层**未实测**（登记为 `NOT_MEASURED`）。
2. **`users` 行数的 before 值**、**`job` 表 `cli:p4b2:%` 命名台账**、**`account` dump hash 的 before 值**：探针请求（两轮）分别被 Neon 连通性抖动与我的 `node -e` 引号缺陷打断 ⇒ **未取到**（不填 0）。
3. **`claim`（：505）拆分后的 `settle` 分支**：资金面，按 §4.6 留批 3，本片**不测**（`NOT_MEASURED`）。
4. **`account`/`ledger_entry` 的并发面**（同键并发重投的竞态）：本片为串行实测，并发**未测**。
5. **`applyToJob`/`acceptApplication` 的端到端 HTTP 幂等行数**：路径未注册 ⇒ 未测（service 级证据见上一片）。

---

## §6 待办 / 不安全面（**登记，本单不修**）

1. **`auth.ts:3` 硬编码兑底密钥 + `dotenv` 加载顺序缺陷**（★ 上线前必修）：`auth.ts` 在 `dotenv.config()`（只在 `database.ts` 顶部）**之前**求值 ⇒ 实际生效的是源码里的兑底常量，`.env`/`.env.local` 的 `SECRET_KEY` **形同虚设**。后果：① 密钥轮换/环境隔离失效；② 任何知道源码的人都可**伪造任意 `uID` 的会话 token**（本单正是这样在无钱包签名的情况下拿到 200）。修法建议（不在本片落地）：`auth.ts` 顶部自行加载 env，或把 `SECRET_KEY` 改为**运行时读取 + 生产环境缺失即启动失败**（不得静默兑底）。
2. **401 语义被 DB 异常污染**（`index.ts:125-128`）：`resolveActor` 把 DB 错误 catch 成 `return null` ⇒ 401。实测已见「Neon 连通性抖动 ⇒ 合法 token 也 401」，运维面无法与真鉴权失败区分。建议：DB 异常映射 503/500，仅签名/用户不存在映射 401。
3. **Neon HTTP 连通性抖动**：本轮出现 `ConnectTimeoutError`（DB 侧 `fetch failed`），导致 `POST /submit` 首次实测**超时 15s 未响应**（服务端随之挂住）。判读纪律：**先看服务端日志再判 401/500**（§5.7⑪）。
4. `create_key` 幂等键由**客户端**提供（`cli:` 前缀约束），同键异指纹只在本层判 409；跨端（钱包签名/前端）键的生成策略未审。

---

## §7 探针自曝（§5.7④ 读数异常先怀疑自己的口径）

* **首次 `B7` 报 15s 超时，我一度怀疑 service 有 retry 死循环** ⇒ 读 `job-service.ts:136-172` 证否（无循环），并在复测中拿到 **409**（正确语义）⇒ **原判是探针把「Neon 抖动导致服务端挂起」误读成「业务分支有 bug」**；结论已改为环境/连通性面（§6.3）。
* **`node -e` 两次自伤**：① 用 `CAST(${","} AS text)` 传分隔符 ⇒ `NeonDbError: column ":" does not exist`（参数被当成标识符）；② 改用 `":"` 双引号当 SQL 字符串字面量 ⇒ 同错。修法 = `chr(58)`/`chr(44)` 拼接。**两次都是探针缺陷，非服务端缺陷**，且都发生在写产物之前（未污染任何读数）。
* **产物泄漏自检**：`post/`、`pre/` 下 JWT 三段式首段前缀（`e`,`y`,`J` 三连字符）`grep -c` = **0**（token 只以 `sha256…slice(12)` 指纹入盘，`key_len` 入盘，密钥本体/连接串均未落盘）。
* 未使用 `pkill`/`killall`；未 kill 任何 PID；重启仅走面板 `{sid}` 单服务路由。

---

## §8 声明（逐字）

* **未改** `backend-ts/migrations/**`（零改动）。
* **未改** `src/ledger-errors.ts`（冻结）、`src/ledger.ts`、`src/commission.ts`。
* **未改** `frontend/**`。
* **未改** `docs/route-layer.spec.md`、`docs/seafood.master-plan.md`、其它 spec/versions/qa/audit 既有件。
* **未改** `backend-ts/.env.local`、既有脚本与既有 artifact；`p4z-01-probe.ts` 未动。
* 本单**写入**仅：`backend-ts/src/database.ts`（7 处列名映射）、本文件、`backend-ts/.p4-artifacts/b2ahttp-20260929T133731/**`、`backend-ts/scripts/p4z-b2ahttp-01-probe.ts` / `-02-patch-users-cols.ts` / `-03-e2e.ts`。
* 未使用 `git add/commit/push`、未 `npm install`、未用 `execute_code`、未跑写库套件、未执行删除型 SQL、未触碰资金动作。

*落盘：2026-09-29（run `b2ahttp-20260929T133731`）。*
