# 批 7-A 独立质检（终轮）· `GET /api/user/ledger` 账本读口

- **被检对象**：最终修订 **`ae46297`**（本地未推；含收口四 `238bc01`、收口五本尊 + `spec v1.8`）
- **质检方**：Neng（独立质检，与交付方 Kong 分离）
- **固定副本**：`.../cache/scratch/qa-p7a-final`（`git worktree add --detach qa-p7a-final ae46297`）
- **历史副本**：`.../cache/scratch/qa-p7a-09362ad`（`09362ad`，前两轮的证据源，保留）
- **我方实例**：后端 **5796**（真测态）/ **5797**（判负变异态，已收）
- **本报告状态**：终轮落盘。凡读数据标注来源：**取自 `09362ad` 副本** 者逐处标明；标 **[R5]** 者 = 本单在 `ae46297` 副本上的**重测**。

> 前两轮因迭代上限截断，报告未落盘 ⇒ 本单最高优先 = 本文件。所有读数凡引用历史副本者均标注其 revision。

---

## §0 对锚与固定副本证据

### 0.1 修订对锚

| 项 | 读数 | 命令 |
|---|---|---|
| 副本 HEAD | `ae462973918f815b6edc3f53e1e5de116e68854e` | `git rev-parse HEAD`（副本内） |
| 主工作区 HEAD | `ae46297` `[main]` | `git worktree list` |
| 历史副本 HEAD | `09362ad351be86e0e4ce0d3c9b526218b38e0b73` | 保留作历史证据 |
| 注册行 / 注册点 | `src/index.ts:633` / **68** | spec v1.8 §1.14 |
| `index.ts` 副本态 sha256 | `c4db36276accbf9677b3087a79e4eb3701e556b1f4b5d19b90b1655901a7940f` | `shasum -a 256`（== spec v1.8 记的 `RESTORE_OK`） |

- 副本创建：`git worktree add --detach <scratch>/qa-p7a-final ae46297` ⇒ `HEAD is now at ae46297 …`
- `node_modules` 软链：`frontend/node_modules`、`backend-ts/node_modules` ⇒ 指向主仓（只读复用，未 `npm install`）
- **`backend-ts/.env.local` 软链**（P4-SEC fail-fast 闸要求 `SECRET_KEY`；**只链不打印**）
- 夹具（两轮共用，append-only 不可复位）：uid `A=910311` / `B=910312`；cid `X=35` / `Y=36`；A 降序流水 **28 行**（cid 35 ⇒ 25 行，cid 36 ⇒ 3 行；kind: transfer 24 / mint 4）

### 0.2 与上一轮（`09362ad`）的差异面（本单重测范围）

```
backend-ts/src/index.ts                                | 收口五：cid/before_txid 非法面统一 R107 + parseLedgerReadInt
frontend/src/ledger-api.js                             | 收口四：错误分支复用 apiErrorMessage + getAuthToken 前置
frontend/src/auth.js                                   | noCredentialError 提升为具名导出
frontend/src/pages/ProfilePage.jsx                     | 收口四：登录闸（未登录不发请求）
frontend/scripts/p7a-03-errmessage-gate.mjs            | 新门（类级断言）
frontend/src/test/unit/p7a-ledger-error-i18n.test.js   | 新例（6 例，判负单测）
frontend/src/test/unit/ledger-flow-behavior.test.jsx   | 增量（第 ⑦ 例：登录闸零请求）
frontend/src/test/unit/listing-market.test.jsx         | 增量
```

### 0.3 硬口径合规

- 身份表一律 `public.users`；只读探针 SQL 显式 `public.`。
- 未 `pkill -f` / `killall`；实例只用 5796（真测）/ 5797（判负），**按精确 PID 关闭**（§5 收尾）；未启停 5787/5788；5793–5795 归 Kong 未触碰。
- 未改被检代码（副本内只放我自己的 QA 脚本与产物；判负变异**已复原**且逐字核 sha256）。
- 未 `git add/commit/push`；未 `npm install`；未打印 `.env*` 内容 / token / 密钥。
- 只写 `docs/qa/**`（本文件）与 `backend-ts/.p7aqa-artifacts/**`。

---

## §1 判定表（逐项 PASS · FAIL · NOT_MEASURED）

| # | 腿 | 判定 | 证据 |
|---|---|---|---|
| L1 | 端点注册 / 鉴权 401 R107（无 token / 坏 token / 无主体 / 真 token） | **PASS** | §2.1 |
| L2 | keyset 翻页（3 页取尽 / 无重 / 无漏 / 逐字=DB / 末页 null / 满页边界）**[R5]** | **PASS** | §2.2 |
| L3 | 过滤 kind/cid/before_txid 逐字 = DB **[R5]** | **PASS** | §2.2 |
| L4 | 隔离（只看自己，B 流水 0 混入）**[R5]** | **PASS** | §2.2 |
| L5(a) | limit 语义（默认/夹取/回落/下限/小数截断）**[R5]** | **PASS** | §2.3 |
| L5(b) | 零写副作用（24 次调用前后读数逐字不变 + 表25/索引65）**[R5]** | **PASS** | §2.4 |
| L5(c) | 收口五参数解析**无回归**（合法 `cid`/`before_txid` 不受影响）**[R5]** | **PASS** | §2.2 / §2.5 |
| L5(d) | 前端行为（真渲染/分页/空态/恒带 kind/兜底/四语文案/零请求）**[R5]** | **PASS** | §4 |
| L6 | 锚核（`i18n-violation-closeout.test.jsx` 单独跑）**[R5]** | **PASS** | §4.4 |
| L7 | 非法入参 R107 形状（五例逐例完整响应体，独立重取）**[R5]** | **PASS** | §2.5 |
| L8 | 前端类级门 `p7a-03-errmessage-gate.mjs`（PASS + 判负）**[R5]** | **PASS** | §4.5 |
| L9 | 主工作区零污染（关键文件 sha256 = blob）+ 实例收尾 **[R5]** | **PASS（见 §5 备注）** | §5 |

> 本单 HTTP 探针 `qa-p7a-http.ts` 的**唯一 FAIL** 为**我方旧判据**（`cid=0/-1 ⇒ 400`），非缺陷 —— 详见 **§6**。

---

## §2 keyset 与零写逐格读数

> **来源标注**：§2.1–§2.4 历史读数**取自 `09362ad` 副本**（`P7AQA-HTTP-003`/`004`、`P7AQA-NEGA-001`、P7AQA-ZW）；标 **[R5]** 者为在 `ae46297` 副本上的本单重测（run `P7AQAF5-*`）。

### 2.1 鉴权（R107 / 401）— 历史 `09362ad` + [R5] 复核

| 探针 | 读数 |
|---|---|
| 无 token | 401，`error` 键集 `{code,details,i18n_key,message}`，`code=AUTH_UNAUTHORIZED` |
| 坏 token | 401 `AUTH_UNAUTHORIZED` |
| 签名正确但 `users` 无此行 | 401（鉴权语义：无对应主体） |
| 真 token | 200；顶层含 `next_before_txid`；`data` 为数组 |
| 行键集 | 13 键 `{balance_after,cid,delta,frozen_after,frozen_delta,kind,memo,ref_id,ref_type,reversal_of_txid,time_created,txid,uid}`（无内部机械列） |

**[R5]**：`ae46297` 上四条鉴权判据全 PASS（`P7AQAF5-HTTP` 42 项中鉴权 6 项全绿）。

### 2.2 keyset 翻页 / 过滤 / 隔离 **[R5]（`ae46297`）**

| 判据 | 读数（`P7AQAF5-HTTP`） | 结论 |
|---|---|---|
| 翻页（limit=10） | 页1 `n=10 next=314`、页2 `n=10 next=294`、页3 `n=8 next=null`（键在） | 3 页取尽 |
| 逐字一致 | `keyset_flat` **逐字 == DB 降序 28 txid**（`[330…279]`） | 无跳无漏 |
| 满页边界 | `limit=28` ⇒ 首页 `n=28 next=279`（末条 txid，非 NULL）；再来一页 ⇒ `n=0 next=null`（键在） | PASS |
| before_txid 过滤 | `>max` ⇒ 28；`=min(279)` ⇒ 0（严格小于）；`=dbTxids[9]` ⇒ 18、首条 `312` | PASS |
| kind 过滤 | `transfer` 24/24 逐字=DB；`mint` 4/4 逐字=DB；`burn` ⇒ 200 + 0 | PASS |
| **cid 过滤（收口五无回归）** | `cid=35` **25/25 逐字=DB**；`cid=36` **3/3 逐字=DB**；`kind=mint&cid=36` = 3 | PASS |
| 隔离 | A token 全行 `uid=A`；B 流水混入 A 响应 = **0**（B 在 DB 24 行） | PASS |

**★ 收口五参数解析无回归（L5c）**：合法 `cid`（35/36）过滤结果与 `09362ad` **逐字相同**；合法 `before_txid` 游标链（314→294→null）与 `09362ad` **逐字相同** ⇒ 新增 `parseLedgerReadInt` 未触及合法值路径。

### 2.3 limit 语义 **[R5]（`ae46297`，与 `09362ad` 逐字一致）**

| 入参 | 读数 |
|---|---|
| 缺省 | 200，n=28，next=null |
| `500` / `1000` | 200，n=28 |
| `abc` / 空串 | 200，n=28（回落默认） |
| `0` / `-5` | 200，n=1（夹到 1） |
| `2.7` | 200，n=2（截断） |
| `1` | 200，n=1，next=330 |

### 2.4 零写副作用（DL23）**[R5]**

- **独立重测（`qa-p7a-zw.ts`，24 次，基线取在首调之前）**：`verdict=GREEN`、`violations=[]`、`before_tables=25` → `after_tables=25`、`after_cleanup={tables:25,indexes:65,zw_probe_exists:0}`、`cleanup_ok=true`。
- **HTTP 探针内嵌 48 次调用**（24 真 token + 24 无 token）：`zero_write.diff_keys=[]`（**0 项变化**）；快照 `ledger_rows=323` / `Σdelta=2019822` / `account_rows=30` / `users_rows=38` / `currency_rows=15` / `public_tables=25` / `public_indexes=65` **全部逐字不变**。
- 与 `09362ad` 历史基线**逐字一致**（唯 `ledger_rows` 因夹具 append-only 同值 323）。

### 2.5 非法入参 R107 形状（五例逐例完整响应体）**[R5]**

> ★ 硬口径：**不采信交付方 AC① 的响应体**。以下为本方探针 `qa-p7a-r107.ts` 在 `ae46297`（5796）上独立取得的**完整响应体**。

| 例 | 状态 | 完整响应体（逐字） |
|---|---|---|
| `cid=abc` | **400** | `{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"cid shape is invalid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"cid","reason":"NOT_DECIMAL_INTEGER"}}}` |
| `cid=0` | **404** | `{"error":{"code":"LEDGER_CURRENCY_NOT_FOUND","message":"currency not found","i18n_key":"ledger.err.LEDGER_CURRENCY_NOT_FOUND","details":{"cid":"0"}}}` |
| `before_txid=xyz` | **400** | `{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"before_txid shape is invalid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"before_txid","reason":"NOT_DECIMAL_INTEGER"}}}` |
| `before_txid=-9` | **400** | `{"error":{"code":"LEDGER_AMOUNT_INVALID","message":"before_txid must be a positive txid","i18n_key":"ledger.err.LEDGER_AMOUNT_INVALID","details":{"field":"before_txid","reason":"NOT_POSITIVE","value":"-9"}}}` |
| `kind=__nope__` | **400** | `{"error":{"code":"LEDGER_UNKNOWN_KIND","message":"unsupported ledger kind","i18n_key":"ledger.err.LEDGER_UNKNOWN_KIND","details":{"kind":"__nope__"}}}` |

- **五例 `error` 键集逐字 = `["code","details","i18n_key","message"]`**；**顶层键逐字 = `["error"]`**；**旧形状键（`success`/`message`）泄漏 = 0**；`content-type: application/json; charset=utf-8`；`none_500=true`。
- 与 spec v1.8 §15「同端点只许一种形状 = R107」**逐条相符**；`cid<=0 ⇒ 404 LEDGER_CURRENCY_NOT_FOUND`、游标非正 ⇒ `400 + reason=NOT_POSITIVE` 与冻结裁定 §5.16 一致。
- **A 与 B 的历史读数不同之处仅此一点**：`09362ad` 上 `cid=0/-1` 为旧形状 400（`sendError`）；`ae46297` 上统一为 R107（404）。此为**收口五的意图变更**，非回归。

---

## §3 判负自证

### 3.1 [R5] 服务器侧判负（R107 形状，5797 变异态）

- 在副本内把 `cid` 分支**改回旧写法** `return sendError(res, 400, 'Invalid cid');`
  - `PRISTINE_sha = c4db36276accbf…` → `MUTATED_sha = e0d0b43bd5af75…`
  - ★ 该变异 sha **逐字 == spec v1.8 §5.163 记载的收口五事故态 `e0d0b43b…`** ⇒ 我方复现的正是那次事故的变异布局（强证据）。
- 以 **5797** 起变异实例，跑 `qa-p7a-r107.ts` ⇒ **`EXIT=1`**：`cid=abc`/`cid=0` 回**旧形状** `top_level_keys=["success","message","error"]`、`error` 为**字符串**（`error_object_keys=null`）⇒ `all_r107=false`、`no_legacy_shape=false`。
  - 旧响应体逐字：`{"success":false,"message":"Invalid cid","error":"Invalid cid"}`
  - 未变异的 3 例（`before_txid=xyz/-9`、`kind`）仍 R107 ⇒ **探针按形状可判负、且定位精确到 `cid` 分支**。
- **复原**：`git checkout -- src/index.ts` ⇒ sha 回 `c4db36276accbf…`，**与 `git rev-parse ae46297:backend-ts/src/index.ts` 的 blob sha 逐字相等**；`git status --porcelain src/index.ts` 空。

### 3.2 [R5] 前端门判负（`p7a-03-errmessage-gate.mjs`，仓外镜像）

- 建仓外镜像 `…/P7AQAF5-NEG/gatemirror/src`，把 `ledger-api.js` 错误分支改回旧写法 `throw new Error(String(payload?.error?.message || payload?.message || \`HTTP ${response.status}\`))`。
- 以镜像为 `srcRoot` 跑门 ⇒ **`EXIT=1`**：`! ledger-api.js:49 [未登记] "…旧写法…"`，`总判：FAIL（未登记命中 1 …）`；对照组（真源码）`总判：PASS（未登记命中 0）`。
- ⇒ 类级门**非空转**，且直接命中本单要消灭的那行（扫描 77 文件 / 受体 6 / 命中 3 全登记 / 未登记 0）。

### 3.3 历史负控（`09362ad`）

`P7AQA-NEGA-001`：33 PASS / 9 FAIL —— 在副本内注入「游标失效（忽略 `before_txid`）」变异 ⇒ 翻页腿立即变红（每页重复同 10 条、`flat_len=110`/`uniq=10`、非严格递减），**证明翻页断言非空转**；变异复原并逐字核 sha。

---

## §4 前端接线审查 + 待 Zang 终审条目

### 4.1 `ledger-api.js`（收口四 R-1）

- 新增 `getAuthToken(user)` 前置：无 token ⇒ `throw await noCredentialError()`（本地化 `auth.err.NO_CREDENTIAL`，**零请求**）。
- 错误分支由 `String(payload?.error?.message || payload?.message || 'HTTP '+status)` 改为 `await apiErrorMessage(payload, response.status)`（全站唯一错误文案出口）。
- 登记：`fetchApiJson` / `ledger-api` **两套取数入口并存**（待 P6/P7 统一时合并；本层只对齐错误面与登录面，不改共用件 `fetchApiJson`）。

### 4.2 `auth.js`

- `noCredentialError` 由模块私有**提升为具名导出**（零行为改动、零新增分支），供 `ledger-api` 与 `fetchCurrentUser`/`updateMyProfile` **逐字同源**。

### 4.3 `ProfilePage.jsx`

- `loadLedger` 新增登录闸：`if (!isAuthenticated)` ⇒ 置空态 + `t('pleaseLogin')`，**不发请求**（与 `MarketPage.loadLedger` 对齐）。

### 4.4 L6 锚核独立评价 **[R5]**

- **单独跑** `src/test/unit/i18n-violation-closeout.test.jsx` ⇒ **`EXIT=0`、5/5 PASS**。作用域读数：locale `2816` 节点（键 704 × 语 4）、命中 0；源面裸命中 0；改写集 34 键 × 4 语 = 136 节点、问题 0；四语拍平键数 `{704}` 单值、顶层键 102。
- **`ledger.flowEmpty` 值**（同锚）：zh `暂无账本流水。交易完成后，记录会显示在这里。`（hk/en/vn 齐备且无中文残留）。
- **★ 对 `.not.toMatch(/暂未开放|暫未開放/)` 的独立评价（假红问）**：
  - 该断言位于 §④「保真底线」，同条另有 `toMatch(/暂无账本流水|交易后/)`。当前 zh 值**同时**满足正/负两条 ⇒ **不构成假红**。
  - 语义评价：`/api/user/ledger` **已注册**（收口已落地）⇒ 旧占位文案「暂未开放」是**错误陈述**；负断言正是防它回退，**语义正确**（与 spec v1.8 / §5.161 的「等义下移」一致）。
  - **一处弱化（登记，非假红）**：负断言里的繁体分支 `暫未開放` 只对 **zh（简体）** 表求值，`暂未开放` 的繁体形只可能出现在 `hk` 表 ⇒ 该分支在 zh 上**恒不命中（惰性）**。它不是假红来源，但也**不提供额外保护**；若要覆盖繁体回退，应改为对 `flatTables.hk['ledger.flowEmpty']` 另断。**登记，不改**（属判据精度，非缺陷）。

### 4.5 L5(d) 前端行为独立重跑 **[R5]**

- **交付方三套件在 `ae46297` 副本上重跑**：`vitest run p7a-ledger-error-i18n.test.js ledger-flow-behavior.test.jsx i18n-violation-closeout.test.jsx` ⇒ **`EXIT=0`，17/17 PASS**（3 files）。
  - `ledger-flow-behavior`（6 例）：① ProfilePage 真 token 渲 **3 真流水行**、标签 = zh 真文案（`转让/任务报酬/冻结`）、无键名泄漏、无 `[object Object]`；② 「加载更多」第二请求带 `before_txid=247`、行数 3→5、不重复、到底后按钮消失；④ **真·零流水**（`data:[]` + `next:null` ⇒ 空态 = `ledger.flowEmpty` 真文案）；⑤ **MarketPage 每次请求都带 `kind=transfer`**；⑥ 取数失败 ⇒ 兜底为字符串（无 `[object Object]`）；⑦ **未登录 ⇒ 零请求 + `pleaseLogin`（无 `AUTH_UNAUTHORIZED`）**。
  - `p7a-ledger-error-i18n`（6 例）：401 R107 ⇒ zh 四语文案非 `AUTH_UNAUTHORIZED` 原文；401 B14 旧串 ⇒ 走原文映射键；503 + reason ⇒ 同链产出保留 `(reason)`；**无 token ⇒ 零请求**；`json()` 抛 ⇒ `REQUEST_FAILED` 兜底（非 `HTTP 500`）；200 成功路径回归锚。
- **★ 本方独立探针**（自写，不复用交付方断言）`qa-p7a-fe-independent.test.js` ⇒ **`EXIT=0`，4/4 PASS**：
  - **A**：401 R107 ⇒ **zh/hk/en/vn 四语逐语**均得**本语文案**（交付方只测 zh）⇒ 独立证明「真四语」；且 `== await apiErrorMessage(payload,401)`、不含 `[object Object]`。
  - **B**：503 + `details.reason` ⇒ 四语逐语同链产出且保留 `(STATEMENT_TIMEOUT)`。
  - **C**：无 token ⇒ **`fetch` 未被调用（零请求）** + 四语逐语 `auth.err.NO_CREDENTIAL`。
  - **D**：`ledger.err.*` 键缺失面（见 §4.6）。

### 4.6 ★ 本单独立发现（登记，非收口五/四引入）

- **R107 的 `i18n_key` 指向的 `ledger.err.*` 键在四语 locale 里全部不存在**（`src/locales/{zh,hk,en,vn}.json` 的 `ledger.err` = `{}`；`i18n.exists('ledger.err.LEDGER_AMOUNT_INVALID')=false`）。
  - 后果（本方探针 D 实测）：`apiErrorMessage` 对 `i18n_key` 走 `i18n.exists` 失败 ⇒ 回落 `extractApiErrorMessage` = **服务端英文原文** `cid shape is invalid (NOT_DECIMAL_INTEGER)`，**并非四语文案**。
  - 影响面：`LEDGER_AMOUNT_INVALID`（收口五新增面）、`LEDGER_CURRENCY_NOT_FOUND`（收口五新增面）、`LEDGER_UNKNOWN_KIND`（既有），以及**全部账本域码**（`ledger-errors.ts:219` 的 `ledger.err.${code}` 约定）。
  - 性质：**跨批既有缺口**（`09362ad` 的 `kind` 面已同形；非收口四/五引入）；**前端不发送非法入参**（`ledger-api` 只发合法 `limit/kind/cid/beforeTxid`）⇒ **用户可达性低**。
  - 形状安全：回落到**字符串**、无 `[object Object]`、无空白 ⇒ 不违反「绝不 `[object Object]`」底线。

### 4.7 待 Zang 终审条目

1. **两套取数入口并存**（`fetchApiJson` vs `ledger-api`）：已终审 = **路径②**（保留 `ledger-api` 直读原始响应以取顶层游标，仅对齐错误/登录面）；本单**复核落地正确**（§4.1–4.3 与终审逐条一致）。**无需二选一**。
2. **【新登记】`ledger.err.*` 四语键缺失 ⇒ 账本域非法入参对用户显示服务端英文原文**（§4.6）。两变体：
   - **V-① 补 `ledger.err.*` 四语键**（至少覆盖本单 3 码，或一次性枚举全部账本码）：用户见四语文案；**代价** = 四语各 +N 键（键集 704→704+N，需同步 `i18n-violation-closeout` / `i18n-batch-b5` 的「704 单值」锚），且若只补本单 3 码会留「不完整第二套」。
   - **V-② 维持现状**（`i18n_key` 仅作机读提示、前端回落服务端 message）：零改动；**代价** = 账本域非法入参用户面为英文原文（当前可达性低）。
   - 依硬口径**由 Zang 裁**，本方不自行二选一。

---

## §5 未验证清单（逐项原因）

> 硬口径：**逐项写原因，禁填 0 或空**。

1. **浏览器真渲染（真 DOM / 真网络栈）**：未跑 —— 前端腿全部走 `vitest` + `vi.stubGlobal('fetch')`（真契约形状替身）；未起浏览器静态服务。原因：本单聚焦收口四新增面，浏览器 E2E 属 P7-B 面。
2. **「后端真 401/503 → 前端 UI 逐字」整链（跨进程）**：未跑 —— 后端真 401 由 §2.1 独立取、前端对 401/503 的四语解析由 §4.5 独立取，但**两者未在浏览器里串成一条真链**。原因：需浏览器 + 真后端同栈；替身已按真契约回包。
3. **`cid` 超 `bigint` 边界（`OUT_OF_BIGINT_RANGE` / `OVER_MAX_SINGLE_AMOUNT`）的 R107**：未测 —— 本单五例不含该 reason；`cid=999999`（19 位内）取到 200+0 行。原因：`spec v1.8`/交付方登记 TS `toAmount` **不复制** DB 侧 >19 位的 `OVER_MAX_SINGLE_AMOUNT` 预算，该分支未纳入本单五例。
4. **深分页（>2 页 / 20+ 页）与并发读写一致性**：未测 —— 夹具 A 仅 28 行（3 页取尽已覆盖游标链 `314→294→null`）。原因：夹具 append-only 不可增补；并发一致性非只读快照面。
5. **前端 `MarketPage` 侧游标翻页**：未单独测 —— ⑤ 只证「每次请求带 `kind=transfer`」；`MarketPage` 的「加载更多」游标链未覆盖（`ProfilePage` 侧已覆盖）。原因：交付方 ⑤ 的判据范围所限。
6. **全量离线套件 `28 files 250 passed` 的独立复算**：**部分验证** —— 本方 `vitest run src/test/unit` = **`1 failed | 27 passed (28)`、`238 passed (238)`**；唯一 failed 为 `p4z-feperf.test.js`，因**缺构建产物** `dist/assets/*.css`（文件内 `throw` 前置判）。原因：本方**未 `npm run build`**（`p4z-feperf` 属性能门、不在本单面）。⇒ **238 = 250 − 12**（`p4z-feperf` 未加载的 12 例）。
7. **`tsc --noEmit` / `tsconfig.scripts.json` / `build`**：未独立重跑 —— 本单聚焦 keyset/零写/R107/前端新增面；全量硬门属交付方（我未重复）。原因：与 §4/§2 无交叉依赖。
8. **`ledger.err.*` 缺失在浏览器 UI 的肉眼确认**：未跑 —— 已由 `i18n.exists=false` + `apiErrorMessage` 逻辑链（探针 D）验证「回落到英文原文」。原因：与上「浏览器」同。
9. **`src/index.ts` 之外同族 `sendError` 26 处**：未逐条复跑 —— 属既有面（spec v1.8 转引 `fix2` 登记）。原因：不在本单写集。
10. **`i18n-batch-b2.test.jsx` 的 `getAuthToken` mock 缺口**：未深查 —— 全量跑时该文件 `stderr` 打印 `No "getAuthToken" export is defined on the "../../auth" mock`（被页面 catch ⇒ 非致命、文件 PASS）。原因：属存量 mock 缺口（同交付方注释预警的「假红」机理），非本单面（**登记，见 §6.3**）。

### 5.1 主工作区零污染终检 **[R5]**

- `git status --porcelain`（主工作区）= **恰好两行**，均为 **docs 报告**（零代码改动）：
  - `?? docs/qa/p7-a-ledger-read-review.md` ← **本单交付物（我方）**
  - `?? docs/audit/p7-a-ledger-read-fix2.md` ← **非我方产物**：并发写者（Kong 收口六报告，mtime 15:43，出现在**我开工时 porcelain 为空之后**）。**我方未触碰、不删**。
- **关键文件 sha256 vs `git rev-parse ae46297:<path>` 对拍（6/6 MATCH）**：
  ```
  MATCH backend-ts/src/index.ts                 c4db36276acc
  MATCH frontend/src/ledger-api.js              c83573a04691
  MATCH frontend/src/auth.js                    6200e64d72da
  MATCH frontend/src/pages/ProfilePage.jsx      884e03d8f23c
  MATCH frontend/scripts/p7a-03-errmessage-gate 3e4e6bd0ef19
  MATCH frontend/.../p7a-ledger-error-i18n.test 0ec9954b1160
  ```
- **实例收尾**：5797 已按**精确 PID 52720** `kill` ⇒ `lsof :5797` **空**；5796 按**精确 PID 47921** `kill` ⇒ `lsof :5796` **空**（见 §8 收尾）；未 `pkill -f` / `killall`。

---

## §6 我方判据的错误与修正

1. **`qa-p7a-http.ts` 判据 `④ 非法 cid（abc/0/-1）⇒ 400` = 我方旧判据，已被 spec v1.8 取代。**
   - 现象：`ae46297` 上该条 FAIL（`P7AQAF5-HTTP` 42 中唯一 FAIL）。实测：`cid=abc ⇒ 400`、**`cid=0 ⇒ 404`**、**`cid=-1 ⇒ 404`**。
   - 修正：spec v1.8 §15 / §5.16 裁定「`cid` 形状合法但 `<= 0` ⇒ **404 `LEDGER_CURRENCY_NOT_FOUND`**（该行不存在）」⇒ **404 为正确期望**，我方脚本未同步 ⇒ **改判据为「形状非法 ⇒ 400；`cid<=0` ⇒ 404」**（本文件 §2.5 已重取并判 PASS）。**非缺陷、非回归。**
2. **`i18n-violation-closeout.test.jsx` §④ 的 `/暫未開放/` 分支对 zh 表惰性**（§4.4）—— 属**判据精度**问题，非假红；**登记，不改**（它不动被检代码）。
3. **`i18n-batch-b2.test.jsx` 的 `../../auth` mock 缺 `getAuthToken`** ⇒ 全量跑时打印一行 mock 错误（被页面 catch）—— 存量 mock 缺口（同交付方注释预警的假红机理）；**登记，不改**（非本单面）。
4. **`p4z-feperf.test.js` 前置依赖 `dist/`** ⇒ 无构建产物时整文件 FAIL —— **环境前置**，非缺陷；本方未构建，**登记为 NOT_MEASURED 原因**（§5-6）。

> 说明：本单在 `ae46297` 上未发现**新的实现缺陷**；上述 1–4 均为**判据/环境**层面的更正与登记。

---

## §7 run-tagged 产物清单

**探针脚本**（新副本 `qa-p7a-final`，`backend-ts/.p7aqa-artifacts/scripts/`）：
- `qa-p7a-http.ts`（沿用上轮；keyset/过滤/隔离/limit/零写，42 判据）
- `qa-p7a-zw.ts`（沿用上轮；零写强探针，基线取在首调前）
- `qa-p7a-fixture.ts`（沿用上轮；夹具，本轮仅读其读数，未重造）
- `qa-p7a-r107.ts`（**本单新写**；五例非法入参完整响应体 + R107 形状判据）
- `frontend/qa-p7a-tmp/qa-p7a-fe-independent.test.js`（**本单新写**；四语逐语 + 零请求 + `ledger.err.*` 缺键面）

**产物**（`backend-ts/.p7aqa-artifacts/`，无 `.log` 后缀）：
| run tag | 文件 | 内容 |
|---|---|---|
| `P7AQAF5-HTTP` | `qa-http-P7AQAF5-HTTP.json` / `stdout.txt` / `stderr.txt` | keyset/过滤/隔离/limit/零写（41/42 PASS；唯一 FAIL = ±§6.1 旧判据） |
| `P7AQAF5-ZW` | `qa-zw-P7AQAF5-ZW.json` / `P7AQAF5-ZW.stdout.txt` | 零写 24 次（GREEN；表 25→25、索引 65） |
| `P7AQAF5-R107` | `qa-r107-P7AQAF5-R107.json` / `stdout.txt` | 五例 R107 完整响应体（全 PASS，exit 0） |
| `P7AQAF5-NEG` | `gatemirror/`、`gate-negctl.txt`、`serve-5797-mutated.txt` | 门判负（FAIL）+ 变异实例日志 |
| `P7AQAF5-NEG-R107` | `qa-r107-P7AQAF5-NEG-R107.json`、`r107-negctl.txt` | 变异实例 R107 判负（exit 1；旧形状） |
| `P7AQAF5-FE` | `vitest.txt`、`independent.txt`、`l6-alone.txt`、`gate-errmessage.txt`、`full-unit.txt` | 前端三套件 17/17、独立探针 4/4、L6 5/5、门 PASS、全量 238/238（见 §5-6） |
| `P7AQAF5-SERVE` | `serve-5796.txt` / `serve-5796b.txt` | 5796 实例启动日志（`TypeScript backend running on port 5796`） |

**残留登记（append-only，本单新增）**：
- 夹具（`P7AQA001`，两轮沿用，**不可复位**）：uid `910311/910312`；cid `35/36`；`users` 行 2、`currency` 行 2、`account` 行 3、`ledger_entry` 行（A=28 / B=24）。
- 本单**未**新建 DB 夹具（仅读上轮夹具）；零写探针自建表 `public.p7aqa_zw_probe` **未出现**（`zw_probe_exists=0`）。
- 副本 `qa-p7a-final` 保留；历史副本 `qa-p7a-09362ad` 保留。
- `frontend/qa-p7a-tmp/`（独立探针所在临时目录，位于**副本内**，副本整体保留 ⇒ 不清理）。

---

## §8 结论与 verdict

### 8.1 结论

1. **收口五（`ae46297`）在 keyset/零写/R107 三条重测腿上全绿**：keyset 翻页/过滤/隔离与 `09362ad` **逐字一致**（合法 `cid`/`before_txid` **无回归**）；零写 24 次 GREEN（表 25/索引 65）；五例非法入参**全部 R107**（键集逐字 4 键、顶层 `["error"]`、无旧形状泄漏、无 500），**独立重取、未采信交付方 AC①**。
2. **收口四在最终前端态独立验证通过**：401/503 文案**四语逐语**为真本语文案而非 `AUTH_UNAUTHORIZED` 原文；无 token **零请求** + 本地化 `NO_CREDENTIAL`；真流水渲行 / 分页游标 / 真·零流水空态 / MarketPage 恒带 `kind=transfer` / 失败兜底无 `[object Object]` 全部成立。
3. **L6 锚核 5/5 PASS**；负断言不构成假红（一处惰性分支已登记）。
4. **判负自证成立**：服务器侧 R107 判负（变异 sha 逐字 == 事故态 `e0d0b43b…`、exit 1、旧形状）+ 前端门判负（未登记命中 1、FAIL）。
5. **无回归、无新实现缺陷**；唯一 HTTP FAIL 系我方旧判据（§6.1）。两条登记（`ledger.err.*` 缺键 = 跨批既有、用户可达性低；`p4z-feperf`/`i18n-batch-b2` mock = 环境/存量）**均非阻断**。
6. **主工作区零污染**：代码文件 sha256 **6/6 == blob**；`porcelain` 仅两份 docs 报告（其一本单交付物、另一为并发写者产物，非我方）。
7. **收尾**：5796/5797 按精确 PID 关闭，`lsof` 空读数；副本保留。

### 8.2 verdict

> **PASS（可用）· 批 7-A 在 `ae46297` 上质检通过。**
> 附：① 一条待 Zang 终审（`ledger.err.*` 四语键缺失，§4.7-2，两变体已列）；② **收尾已完成** —— 5796（PID 47921）/ 5797（PID 52720）均按**精确 PID** 关闭，`lsof :5796`/`:5797` **空读数**，`ps` 双 PID 均亡。

---

*（本报告由 Neng 独立撰写；所有 [R5] 读数均在固定副本 `qa-p7a-final`（`ae46297`）与我方实例 5796/5797 上取得；历史读数取自 `09362ad` 副本并逐处标注。）*
