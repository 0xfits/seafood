# P4-SEC · 安全与配置闸（硬编码兜底签名密钥 + `resolveActor` 异常同形化）

- **Run tag**：`p4sec-20260930T012048+0800`
- **产物根**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/sec-20260930T012048+0800/`
- **服务**：`seafood-api`（面板 sid，端口 5788）；**收尾重启后 pid = 76603**（`state=running`）
- **本单**：先取证 → 改码 → 面板路由重启 → 实测读数。**未写任何业务数据**（`ledger_entry` 仍 0）。

---

## §0 口径与硬边界（自证）

- 允许写：`backend-ts/src/**`（含新件 `src/env.ts`）、`docs/audit/p4-sec-auth-gate.md`、`backend-ts/.p4-artifacts/**`、`backend-ts/scripts/p4z-sec-0{1,3}-*.ts`（本单新建）。
- 未触碰：`.env.local`（环境配置由 Kevin 管）、`migrations/**`、`src/ledger-errors.ts`（冻结）、`src/ledger.ts`、`src/commission.ts`、`frontend/**`、既有脚本/artifact、既有 spec/versions/qa/audit、`p4z-01-probe.ts`。
- 未使用：`git add/commit/push`、删除型 SQL、资金动作、写库套件、`npm install`、`execute_code`、`pkill -f` / `killall`。重启**只**走面板 `POST /api/restart {sid}`。
- 本单**没有**新增错误码，也**没有**改动 §14 分类器（`ledger-errors.ts` 冻结，仅调用）。

---

## §1 取证：服务进程的 cwd 与环境变量来源（先取证后改码）

| 取证项 | 命令 / 来源 | 读数 |
| --- | --- | --- |
| 监听者 pid | `lsof -nP -iTCP:5788 -sTCP:LISTEN` | `node PID 60109`（改前） |
| **cwd** | `lsof -a -p 60109 -d cwd` | `/Users/kevin/bistro/seafood/backend-ts` |
| 启动命令 / 父进程 | `ps -o pid,ppid,command -p 60109`；父 60095 | `node /Users/kevin/bistro/seafood/backend-ts/node_modules/.bin/ts-node src/index.ts` ← `npm run dev` |
| 面板登记 | `GET :5555/api/status` → `seafood-api` | `cwd=/Users/kevin/bistro/seafood/backend-ts`、`port=5788`、`pid=60095`、`state=running` |
| 配置真源 | `ls .env` / `grep -c -E '^SECRET_KEY=' .env.local` | **无 `.env`**（`No such file or directory`）；`.env.local` 存在，`SECRET_KEY=` 命中 1 行（值不落盘、不打印），另有 `DATABASE_URL=` |
| 模块加载顺序 | `src/index.ts` L1→L4 `import './auth'` 早于 L11-16 `import './database'`（dotenv 在该文件顶部） | ⇒ `auth.ts` 模块期读 `process.env.SECRET_KEY` 时 **env 还没装** |

**结论（实测，非假设）**：服务 cwd **就是** `backend-ts`。但改法仍按**模块位置**（`__dirname`）解析配置，不依赖 cwd —— 面板/脚本/子进程以任何 cwd 拉起都成立。故新建 `src/env.ts`，并在 `src/index.ts` **第一行** `import './env';`。

---

## §2 缺陷 A：硬编码兜底签名密钥 + 加载顺序（**已在活服务上复现**）

改前 `src/auth.ts:3`：

```ts
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-here';
```

**改前基线（对活服务 5788，`verify-pre.json`，旧代码）**

| 用例 | 期望 | 实测 | 判 |
| --- | --- | --- | --- |
| `.env.local` 的 `SECRET_KEY` 铸 token → `GET /api/user` | 200 | **401 `AUTH_UNAUTHORIZED`** | FAIL（合法凭据被拒） |
| 公开常量 `your-secret-key-here` 铸 token → `GET /api/user` | 401 | **200** | FAIL（**任何人可伪造任意 uID 的会话**） |
| 无 token | 401 | 401 | PASS |
| `/api/home`、`/api/prize/all`、`/health` | 200 | 200 / 200 / 200 | PASS |

⇒ 与派单所述**逐字一致**：服务端实际生效的密钥是那个**公开兜底常量**（`.env.local` 的密钥长度 64、指纹 `b1ec01afb2eb`，且**不等于**该常量）。

---

## §3 缺陷 B：`resolveActor` 把一切异常吞成 401

改前（`src/index.ts` 原 `:106-137`）单个 `try/catch` 把 `verifySessionToken` 与两次 DB 查询包在一起，`catch` 里 `console.warn('Failed to resolve actor:', error); return null;` ⇒ **鉴权面**与**基础设施面**同形：

- 无 token / 签名错 / 格式错 / 过期 / 用户不存在 / **DB 列错** / **DB 连不上（Neon `ConnectTimeoutError` 抖动）** —— 全部 → `requireActor` → **401**。
- 后果：合法用户在 DB 抖动时被当成「未授权」；且 **401 掩盖真实故障**（面板日志里 8 条旧措辞 `Failed to resolve actor: Error: Invalid token signature` 就是这条路径留下的）。

---

## §4 改动（最小 diff）

| 文件 | 改动 | 说明 |
| --- | --- | --- |
| `src/env.ts` | **新建**（38 行） | 进程级 env 装载唯一入口；按 `__dirname` 解析 `<repo>/.env.local` → `<repo>/.env` → `cwd/.env`（dotenv 不覆盖已有变量 ⇒ 外部注入 > .env.local > .env） |
| `src/index.ts` | **+`import './env';` 置于第一行** | 保证 `./auth` 求值前 env 已就位（修 A 的**根因**是顺序，不只是常量） |
| `src/auth.ts` | 删掉 `|| 'your-secret-key-here'`，改为 `resolveSecretKey()`：**缺失 ⇒ 打印 `[FATAL]` 并以退出码 1 终止**；**额外拒绝**把 `SECRET_KEY` 设成那个公开常量 | 硬编码兜底**移除** + 回归打死 |
| `src/index.ts` | `resolveActor` 返回类型改为 `ActorContext \| ActorFailure`（`{kind:'unauthorized'}` / `{kind:'infra',error}`）：① `verifySessionToken` 单独 try（纯计算，失败只能 401）② DB 读单独 try（抛 ⇒ `infra`） | 缺陷 B 的分类修正 |
| `src/index.ts` | `requireActor`：`unauthorized` ⇒ 既有 `sendAuthError(401)`；`infra` ⇒ `normalizeLedgerError` + `toErrorResponse`（**既有** §14 分类器 / R107 错误体，取分类器自己的 `httpStatus`）+ 诊断只进 `console.error`（R108） | 基础设施异常 ⇒ 503，**绝不当鉴权失败** |
| `src/index.ts` | 新增 `unwrapInfraCause`（局部，不改冻结文件） | Neon 抛 `NeonDbError('Error connecting to database: fetch failed')`，真因在 `sourceError`→`cause`；分类器只看单层 ⇒ 下沉到**有码**的那层再喂给它 |
| `src/index.ts` | `/api/home`（唯一直接调用 `resolveActor` 的**公开面**）：显式收敛 `infra` 为 `null`（保持原「降级为匿名」语义） | 公开面不因鉴权子系统故障变 503 |

新增验读脚本（只读）：`scripts/p4z-sec-01-verify.ts`（HTTP 探针 + 分类器对拍 + fail-fast + 503 E2E）、`scripts/p4z-sec-03-invariants.ts`（非资金不变量）。

---

## §5 实测读数（全部本机实跑；读数落在产物里，可 `grep`）

### 5.1 双密钥对照（口径照派单重做；`verify-post.json` → `http`）

| 用例（`GET /api/user`） | 期望 | 实测 | 判 |
| --- | --- | --- | --- |
| `.env.local` 的 `SECRET_KEY` 铸 | **200** | **200** | PASS |
| **旧兑底常量 `your-secret-key-here` 铸** | **401** | **401 `AUTH_UNAUTHORIZED`** | PASS（不再是 200） |
| 无 token | 401 | 401 | PASS |
| 错签名（另一随机密钥） | 401 | 401 | PASS |
| 篡改签名末 4 字符 | 401 | 401 | PASS |
| 畸形 token（`Bearer not-a-jwt`） | 401 | 401 | PASS |

⇒ HTTP 状态序列（16 项）：`200 401 401 401 401 401 200 200 200 200 410 410 410 410 410 200`，**16/16 PASS**。

### 5.2 fail-fast 实证（`verify-post.json` → `fail_fast`）

- 环境：把 `src/` + `tsconfig.json` 拷到 `<run>/failfast/`，`node_modules` 用软链；**未改 `.env.local`**（拷贝内 `has_env_local=false`、`has_env=false`，`grep` 可证）。
- 不注入 `SECRET_KEY` 启动 ⇒ **退出码 `1`**（`signal=None`），stderr：
  `[FATAL] SECRET_KEY is not set. Refusing to start: … letting anyone forge a session token for any uID. …`
- **对照组**（同拷贝 + 注入 `SECRET_KEY`）⇒ 无 `[FATAL]`，正常打印 `TypeScript backend running on port 5798`（证明失败是「缺密钥」所致，不是拷贝坏了）。
- `missing_exit_nonzero=true`、`missing_is_fatal_error=true`、`control_has_no_fatal=true`。

### 5.3 503 vs 401 分类实证（内存合成，**未真断开生产库**）

分类器对拍（`verify-post.json` → `classifier`，**5/5 PASS**）：

| 合成错误 | 期望 | 实测码（HTTP） | 分类器 reason |
| --- | --- | --- | --- |
| `ConnectTimeoutError`（按驱动同形状合成） | 503 | `LEDGER_TX_TIMEOUT` (**503**) | `pool_connection_timeout` |
| `NeonDbError(53300 too_many_connections)` | 503 | `LEDGER_TX_TIMEOUT` (**503**) | `too_many_connections`（pg_infra_class） |
| `NeonDbError(08006 connection_failure)` | 503 | `LEDGER_TX_TIMEOUT` (**503**) | `connection_error` |
| `ECONNREFUSED`（驱动码） | 503 | `LEDGER_TX_TIMEOUT` (**503**) | `driver_connection_error` |
| `NeonDbError(08P01 protocol_violation)`（**反例**） | 500 | `LEDGER_TRANSACTION_REQUIRED` (**500**) | 连接配置缺陷，按 §14 排除项留在 500 供 R108 告警 |

> 口径自曝：`@neondatabase/serverless@0.6.1` **未导出** `ConnectTimeoutError` 类（`real_connect_timeout_class_available=false`），故第一条用「同形状合成」（name/message 与驱动一致：`timeout exceeded when trying to connect`）。分类器命中 `POOL_CONNECTION_TIMEOUT_RE` ⇒ 503。

**HTTP 层 E2E（分类修正的真实端到端面）**：另起一个受控实例（`PORT=5799`，进程内注入 `SECRET_KEY`=真密钥、`DATABASE_URL` 指向本机必然拒连端口，**生产 `.env.local` 未动**），用**真 token** 打 `GET /api/user`：

- `legal-token-with-unreachable-DB` ⇒ **503 `LEDGER_TX_TIMEOUT`**（改前同形路径是 **401**；本次中间态一度为 500 —— 正是那时发现 `sourceError` 未被下沉，遂加 `unwrapInfraCause` 后复测为 503）
- `public-placeholder-token-with-unreachable-DB` ⇒ **401 `AUTH_UNAUTHORIZED`**（凭据先判，正确）

### 5.4 回归（`verify-post.json` → `http`）

`/api/user` 200（真 token）、`/api/admin/me` 200、`/api/home` 200、`/api/prize/all` 200、`/health` 200；**5 个已落 `410` 面仍 410**：`/api/shard/redeem`、`/api/chest/x/open`、`/api/admin/settings/reset`、`/api/admin/task/create`、`/api/admin/prize/create`（均 `LEDGER_REF_NOT_FOUND`）。

### 5.5 静态与规模读数

- `npx tsc --noEmit` ⇒ **exit 0，输出 0 行**（`tsc-noemit.log`）。
- 端点注册点（口径：`grep -cE 'app\.(get|post|put|delete|patch)\(' src/index.ts`）⇒ **51**（与改前一致，本单未增删路由）。

### 5.6 非资金不变量（`invariants.json`，只读 SELECT）

- `ledger_entry` 计数 = **0**（`INVARIANT_ledger_entry_is_zero=true`）。
- `account` = 4 行（uid -3/-2/-1/0，cid 1）：`balance=0`、`frozen=0`、`version=0`，`time_updated` 仍 `2026-09-29T01:15:27.684Z`（本单未写）。
- `currency` = 1 行：`total_supply=0`、`supply_cap=null`、`status=listed`；`users` = 6。
- ⇒ 本单**零业务写**。

### 5.7 产物 `grep -c 'e[y]J'` = **0**

`grep -r --exclude-dir=node_modules -l -E 'e[y]J' <run>/ | wc -l` ⇒ **0**（无 token/密钥本体落盘；产物只落 sha256 前 12 位指纹）。

### 5.8 §5.7⑩：401 逐条归因（服务端日志 `GET :5555/api/logs/seafood-api`）

- 改动后措辞 = `Failed to verify session token: …`；计数 **6 条 `Invalid token signature` + 2 条 `Invalid token format`** = **2 轮 post 验读 ×（3 签名错 + 1 畸形）**，**逐条对上**，无一条 401 来自基础设施异常。
- **`[auth.infra]` 计数 = 0** ⇒ 生产链路本轮没有基础设施异常被触发（503 只在受控 5799 实例上实证，其 stderr 在该实例日志里）。
- 日志内另有 9 条**旧措辞** `Failed to resolve actor: …`（8 签名错 + 1 格式错），时间戳 **22:07:20（Kevin 自测）、01:13:28、01:14:31（改前）、01:23:2x** —— 其中 01:23:2x 属**第一次重启后**仍在缓冲区内回放的**本单 pre 轮**记录；改后两轮**再无**该措辞出现。
- 「无 token」的 401 走 `!authHeader.startsWith('Bearer ')` 快路径，**不打印日志**（既有行为，非本单引入）。

---

## §6 收尾：面板单服务路由重启 + 交单自证

- 重启（**未 kill 任何进程**）：`POST http://127.0.0.1:5555/api/restart`，payload `{"sid":"seafood-api"}` ⇒
  `{"sid":"seafood-api","ok":true,"state":"running","pid":76603,"msg":"已启动"}`（HTTP 200）。
- `GET /health` ⇒ **200**；`GET /api/status` ⇒ `seafood-api: state=running, portOpen=true, occupier=null, error=null, pid=76603, cwd=/Users/kevin/bistro/seafood/backend-ts`；**全站 16/16 服务 running**（未误停他人服务）。
- 新真 token 打 `GET /api/user` ⇒ **200**（收尾后复跑 `verify-post` 全绿）。
- 监听者：`lsof -nP -iTCP:5788 -sTCP:LISTEN` ⇒ `node 75042`（restart#1）→ 收尾轮 `76603` 包装进程，`cwd` 仍为 `backend-ts`。

---

## §7 自曝与残余（未做 / 边界）

1. **分类器的 500 边界仍在**：冻结分类器对「无法识别真因的裸错误」判 `unclassified_non_pg_error`（500 类）。本单用 `unwrapInfraCause` 把 Neon 的 `sourceError`/`cause` 真因喂进去（实证 503），但**没有**、也不应改判据或新增错误码；若某类驱动错误既无码也无码化子链，仍会落 500 —— 那是分类器契约，不是 401。
2. **`/api/home` 保持匿名降级**（公开面），未改为 503；若 Kevin 要求公开面也 fail-closed，需另立单。
3. `unwrapInfraCause` 只下钻 **3 层**且**只采信「有码」的后代**（防环、防误吞真正 500 缺陷）。
4. 未覆盖（超出本单范围，仅登记）：token 无撤销/无轮换；`ADMIN_EVM_ADDRESSES` 有一个**硬编码默认管理员地址**（`0x59f9…09b0`）；`ACCESS_TOKEN_EXPIRE_MINUTES` 默认 30 分钟。
5. 密钥本身：本单**未**读取/打印 `.env.local` 的值（只取长度 64 与 sha256 前 12 位指纹 `b1ec01afb2eb` 供对账），**未改**该文件。
6. 面板 `/api/logs/seafood-api` 是**跨重启累积**的缓冲区（含 22:07 Kevin 自测的旧记录），故计数按**措辞+时间戳+轮次**归因，而非按「重启后应只剩 N 条」推断。
7. **并发写者披露（非本单）**：收尾 `git status --short` 显示 `M docs/route-layer.spec.md` 与未跟踪 `docs/audit/route-layer-v0.2-delta.md`、`docs/versions/route-layer.spec.v0.2.md` —— **这些不是本单产生的**（本单未写任何既有 spec/versions/audit 件，仅在 `docs/audit/` 下新建 `p4-sec-auth-gate.md`）。同一工作树上有第二个写者，故本单对 `src/**` 的所有断言都以**本单改动后的文件内容**为准。
8. 本单 `src/**` 改动仅 3 个文件：`src/auth.ts`（M）、`src/index.ts`（M）、`src/env.ts`（新）；`git status` 可证其它 `src/**`（`ledger-errors.ts`、`ledger.ts`、`commission.ts` 等）**未被触碰**。
