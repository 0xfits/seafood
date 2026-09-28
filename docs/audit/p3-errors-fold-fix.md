# P3-ERRORS-FOLD-FIX（Unit E · Kong）· 非 PG 事件对象族分类缺口 → 修复交付报告

- 仓库：`/Users/kevin/bistro/seafood`（branch `main`，HEAD `0367935`）
- 角色：**Kong（实现）**；单号 **Unit E / P3-ERRORS-FOLD-FIX**
- 被测系统：Neon PG 18.6 / 驱动 `@neondatabase/serverless` 0.6.1 + `ws` 8.22.0 / Node v18.19.0
- 唯一改动文件：`backend-ts/src/ledger-errors.ts`（`+134 / -0`，`git diff --numstat`）
- baseline sha256 `721156cbf296b19c7c4a480264f88b49878d99104b8f87453bafce564745df8b`
  （= `git show HEAD:backend-ts/src/ledger-errors.ts` 同值 ⇒ 修前工作树与 HEAD 逐字节一致）
- 修复后 sha256 `9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d`
- 本报告所有读数均 **run-tagged**；探针 artifact 落在 `backend-ts/.p3t-artifacts/`（同名拒写）

---

## 0. 结论摘要（先给判据，再给证据）

| 判据 | 读数 | 判定 |
|---|---|---|
| 事件对象族（8 例，含**真实 `ws.ErrorEvent`**）修后对外 `code/status` | `LEDGER_TX_TIMEOUT` / **503**（`reason=driver_connection_error`；E8 为既有 `pool_connection_timeout`） | **绿** |
| 事件对象族修后 `RED` 集合 | `RED_set(0) = []` | **空** |
| 对照（PG / 既有可识别形态，13 例）逐字段 | 前后**逐字节相同**（`controls_byte_identical=true`，`control_mismatches=[]`） | **不变** |
| 对外 `details` 原始信息泄漏（R107） | `r107_detail_leaks = []`（无一例含原始 `message`/`stack`/栈帧文本） | **无泄漏** |
| 服务端面可取原始真因（②） | `ledgerErrorDiagnostics()` 返回原始 `message`（截断）/`stack_head`/`constructor_name`/`cause_chain`；`E3` 实时读数 `ctor=ErrorEvent`、`msg="connection reset by peer while opening ws"` | **可取**（代码位置见 §4.4） |
| 端到端 `unexpected_500`（三次） | **0 / 0 / 0** | **AC 达标** |
| 端到端 `expectation_mismatches`（三次） | 0 / 0 / **1**（第 3 次） | ⚠️ **第 3 次不得宣称绿**，明细见 §6.3 |
| `npx tsc --noEmit` | 前 0 error / 后 0 error（`exit 0`，输出 0 行） | **零新增** |
| DB 侧（本单不应动） | **29** 个 `%ledger%` 函数 + 4 个触发器 md5 指纹**逐字节不变**；`migrate` = **17 skipped** | **未动** |
| `§14` 闭集 / 状态映射表 | `closed_set_size=33` 不变；未新增/改码（§3.2 逐条） | **未动** |

**一句话**：连接建立期故障（事件对象族）不再冒充 `500` 实现缺陷——它走**既有** `driver_connection_error` → **既有 503 通路**；`unexpected_500` 归零。残余非零项是**连接层抖动本身**（第 3 次套件运行命中 1 格，历史对照见 §6.3），**如实报出、不宣称绿**。

---

## 1. 缺陷与机理（对照基线，非本单证据）

> 下列为**已定案的对照基线**（只读引用，不作为本单证据）：
> - `docs/audit/p3-p1o-500-rca.md`（307 行）
> - `backend-ts/.p3s-artifacts/p3s-03-fold-repro-20260928T152422Z.json` 的 `three_state.RED_info_lost_500 = 9` 项

机理：连接建立期故障以 **`ws` 的 `ErrorEvent`**（事件对象）形态冒到 `classifyNonPgError`——`message` 是**原型上的 getter**（实例**无 own `message`**）、**无 `name`、无 `code`**。原判据只有「`code` ∈ 瞬时集」与「`message` 命中正则」两条，事件对象两条都不占 ⇒

```
classifyNonPgError ⇒ 'unclassified_non_pg_error'
  ⇒ 不在 TRANSIENT_NON_PG_REASONS (['pool_connection_timeout','driver_connection_error'])
  ⇒ 跳过既有 503 通路（ledger-errors.ts 的 P1c 前置分支）
  ⇒ 兜底折叠成 LEDGER_TRANSACTION_REQUIRED（LD024，status 500）
```

缺陷性：① 违 `DL126`（500 类码只允许由不变式被破坏触发且必须告警）；② 把**基础设施故障记成实现缺陷**，污染 R108 告警面、掩盖真因。

**本单独立取证到的同源事实**（探针现场读数，非转述）：
- `ws` 的 `ErrorEvent` 真实形状（`require` 绝对路径 `node_modules/ws/lib/event-target.js`；`ws` 的 `exports` 未导出该 subpath）：
  `constructor.name = 'ErrorEvent'`、`type = 'error'`、`Object.getOwnPropertyDescriptor(ee,'message') === undefined`（**只有原型上有 `get message()`、无 setter**）、`ee.message` 可读为字符串、**`ee instanceof Event === false`**（`ws` 用的是自带 `Event`，不是全局 `Event`）。
  ⇒ 判据若只依赖 `instanceof Event` 会漏；本单判据 ②`type==='error'`/③「非 own `message`」正好覆盖。

---

## 2. 修前红态（run-tagged 读数）

探针：`backend-ts/scripts/p3t-00-fold-fix-verify.ts`（**纯函数 · 零 DB/网络 I/O**，唯一写落盘是它自己的 run-tagged artifact；**未覆写** Unit D 的 `p3s-03-fold-repro.ts` 与任何既有 artifact）。

命令（§5.7⑥ run-tagged；§5.7② 退出码**不取自管道之后**）：

```
cd backend-ts && NODE_PATH=$PWD/node_modules \
  npx ts-node --transpile-only scripts/p3t-00-fold-fix-verify.ts --phase before
```

| 项 | 值 |
|---|---|
| RUN | `20260928T153437Z`（**恢复段**重跑，见 §5） |
| artifact | `.p3t-artifacts/p3t-00-fold-fix-verify-before-20260928T153437Z.json` + `p3t-00-stdout-before-20260928T153437Z.txt` |
| 退出码 | `0`（读数已落盘；探针不把红态当失败退出） |
| `RED_set(5)` | `E1_dom_errorevent_fake`、`E3_ws_ErrorEvent_real`、`E4_type_error_only`、`E5_frozen_event_object`、`E7_event_with_inner_driver_code` |
| `control_mismatches` | `[]` |
| `r107_detail_leaks` | `[]` |

### 2.1 事件对象族逐例（修前）

| # | 例 | 输入形状 | `classifyNonPgError` | 对外 `code` | `status` | `details.reason` | 判定 |
|---|---|---|---|---|---|---|---|
| E1 | DOM 形 `ErrorEvent` 仿体 | `type=error` + 原型 getter-only `message` + 无 `name`/`code` | `unclassified_non_pg_error` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `unclassified_non_pg_error` | **红** |
| E2 | 仅原型 getter-only `message`（无 `type`） | 原型 getter、无 own `message` | `driver_connection_error` | `LEDGER_TX_TIMEOUT` | 503 | `driver_connection_error` | 已绿（`message` 命中既有正则）|
| E3 | **真实 `ws.ErrorEvent`** | `extends Event`+原型 `get message()`（无 setter） | `unclassified_non_pg_error` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `unclassified_non_pg_error` | **红** |
| E4 | `{type:'error'}` | 事件判别位，**连 `message` 都没有** | `unclassified_non_pg_error` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `unclassified_non_pg_error` | **红** |
| E5 | **缓 Frozen** 事件对象 | `Object.freeze({type:'error',message:'…'})` | `unclassified_non_pg_error` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `unclassified_non_pg_error` | **红** |
| E6 | 自有 getter-only `message` | own accessor（无 setter） | `driver_connection_error` | `LEDGER_TX_TIMEOUT` | 503 | `driver_connection_error` | 已绿（`message` 命中既有正则）|
| E7 | 事件对象**内层**才带驱动码 | 外层无 `code`，`e.error.code='ECONNRESET'` | `unclassified_non_pg_error` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `unclassified_non_pg_error` | **红** |
| E8 | 事件对象 **且** message 命中池超时正则 | 原型 getter 返回 `timeout exceeded…` | `pool_connection_timeout` | `LEDGER_TX_TIMEOUT` | 503 | `pool_connection_timeout` | 已绿（既有更精确 reason）|

> 诚实记录：E2/E6/E8 修前**就已经是 503** —— 它们的 `message` 恰好命中既有正则（`connection closed` / `socket hang up` / 池超时）。缺口的**真实边界**正是「判据覆盖不足」：`message` 不命中正则、或**没有 message** 的事件对象（E1/E3/E4/E5/E7）全线落 500。

### 2.2 对照（修前冻结值 = 双 phase 的断言基线）

| # | 例 | `code` | `status` | `details`（排序后 JSON） | 分类器 |
|---|---|---|---|---|---|
| C1 | PG `22003`（Error 实例 + code） | `LEDGER_TRANSACTION_REQUIRED` | 500 | `{"cause":"22003","error_name":"Error","pg_code":"22003","reason":"unclassified_pg_error"}` | `null` |
| C2 | PG `22003`（**裸对象**形态） | 同上 | 500 | 同上 | `null` |
| C3 | DB 命名码 `LD016` | `LEDGER_TRANSACTION_REQUIRED` | 500 | `{"cause":"LD016","error_name":"Error","pg_code":"LD016","reason":"unclassified_pg_error"}` | `null` |
| C4 | `ECONNRESET` | `LEDGER_TX_TIMEOUT` | 503 | `{"error_code":"ECONNRESET","reason":"driver_connection_error"}` | `driver_connection_error` |
| C5 | 池「拿连接」超时 | `LEDGER_TX_TIMEOUT` | 503 | `{"reason":"pool_connection_timeout","source":"connection_pool"}` | `pool_connection_timeout` |
| C6 | `Error('socket hang up')` | `LEDGER_TX_TIMEOUT` | 503 | `{"error_code":"none","reason":"driver_connection_error"}` | `driver_connection_error` |
| C7 | `08P01`（**排除项**，500 类 + `protocol_violation`） | `LEDGER_TRANSACTION_REQUIRED` | 500 | `{"cause":"08P01","error_name":"ProtocolViolation","pg_code":"08P01","reason":"protocol_violation"}` | `null` |
| C8 | `23514` + `account_bal_guard` | `LEDGER_NEGATIVE_BALANCE_GUARD` | 500 | `{"constraint":"account_bal_guard"}` | `null` |
| C9 | `23505` + `ledger_idem_uniq` | `LEDGER_IDEMPOTENCY_CONFLICT` | 409 | `{"constraint":"ledger_idem_uniq"}` | `null` |
| C10 | `57014` 语句超时 | `LEDGER_TX_TIMEOUT` | 503 | `{}`（switch 优先于 infra 类别） | `null` |
| C11 | `53000`（53 类 infra） | `LEDGER_TX_TIMEOUT` | 503 | `{"reason":"insufficient_resources","pg_code":"53000","retryable":true,"source":"pg_infra_class"}` | `null` |
| C12 | `LEDGER_TX_TIMEOUT` 命名码直通 | `LEDGER_TX_TIMEOUT` | 503 | `{}` | `null` |
| C13 | 无 `name` 裸对象（`constructor=Object`） | `LEDGER_TRANSACTION_REQUIRED` | 500 | `{"cause":"non_pg_error","error_code":"none","error_name":"Error","reason":"unclassified_non_pg_error"}` | `unclassified_non_pg_error` |

### 2.3 服务端诊断面（修前）

修前 `ledgerErrorDiagnostics` **不存在**（`server_side_diagnostics_available=false`）⇒ 该面在修前读数记 `NOT_MEASURED`。这正是缺陷的第二半：**真因根本无处可取**（`src/ledger.ts:98` 登记「R108 告警通道：仅提供 `isDefectError()` 判定，未接日志/指标」）。

---

## 3. 修复（最小改动）

### 3.1 diff 摘要（唯一文件 `backend-ts/src/ledger-errors.ts`，`+134 / -0`）

| 段 | 位置（修后行号） | 内容 | 行数 |
|---|---|---|---|
| ① 判据 + 分支 | `:350-396`（新增块 `:350-374`；`isEventObjectFamily` 定义 `:369`；分支 `:392`） | 新增 `isEventObjectFamily()`（三条判据）+ `classifyNonPgError` 中插入一行 `if (isEventObjectFamily(e)) return 'driver_connection_error';` | +28 |
| ② 服务端诊断面 | `:403-502`（`interface LedgerErrorDiagnostics` `:414`；`ledgerErrorDiagnostics` `:473`） | 新增 R108 服务端诊断载荷构造器（`constructor_name` / 原始 `message` 截断 / `stack_head` / `cause_chain`） | +100 |
| 合计 | — | — | **+134 / -0**（`git diff --numstat`） |

判据（任一成立即「事件对象族」，措辞与代码逐字一致）：
1. `e instanceof Event`（标准事件对象；Node/DOM 视运行时）；
2. `e.type === 'error'`（事件判别位）；
3. 读得到的 `message` 是字符串，但**不是 own 数据属性** —— 原型 getter / 自有 getter-only 访问器。
   ⚠️ **只读不写**：`Object.freeze` 的事件对象同样命中（E5 取证）。

### 3.2 逐条对照「禁项」（未越界）

| 禁项 | 是否触碰 | 取证 |
|---|---|---|
| 新增错误码 | **否** | `LEDGER_ERROR_TABLE` 未改；`closed_set_size=33`（探针读数） |
| 改 §14 的 33 码闭集 | **否** | 同上；`git diff` 中 `LEDGER_ERROR_TABLE`/`LEDGER_ERROR_BUCKETS` 无改动行 |
| 改状态映射表 | **否** | 无一例状态值变化：事件对象族 500→**503** 是**既有**码 `LEDGER_TX_TIMEOUT` 的既有 `status`；对照 13 例逐字节不变 |
| 改其它对外码/状态语义 | **否** | 13 例对照表（§4.3）逐字段相同 |
| 把原始 `message`/`stack` 写进对外 `details`（R107） | **否** | `r107_detail_leaks=[]`（所有 21 例）；事件对象族 `details` 仅 `{reason, error_code}` / `{reason, source}` |
| 改 `src/db.ts` 日志面 | **否**（未改） | `git diff --name-only` 仅 `backend-ts/src/ledger-errors.ts` |

### 3.3 `npx tsc --noEmit`

| 阶段 | 命令（§5.7② 退出码直接取，**不取自管道之后**） | 读数 |
|---|---|---|
| 修前（baseline sha `721156cb…`） | `npx tsc --noEmit > file 2>&1; echo $?` | **`TSC_BEFORE_EXIT=0`，日志 0 行 ⇒ 0 error** |
| 修后（fixed sha `9bc127e4…`） | `npx tsc --noEmit > file 2>&1; echo $?` | `exit 0`，输出 **0 行** ⇒ **0 error** |

---

## 4. 修后绿态对拍（同一探针、同形输入）

命令与红态同形，仅 `--phase after`：

| 项 | 值 |
|---|---|
| RUN（正式绿态） | `20260928T153429Z` |
| artifact | `.p3t-artifacts/p3t-00-fold-fix-verify-after-20260928T153429Z.json` |
| RUN（重装修复后复核） | `20260928T153437Z`（§5 恢复段之后重放，读数一致） |
| 退出码 | `0` |
| `RED_set` | `[]`（**空**） |
| `control_mismatches` | `[]` |
| `r107_detail_leaks` | `[]` |
| `verdicts` | `after_phase_red_empty=true`、`controls_byte_identical=true`、`r107_no_raw_leak_in_details=true`、`d126_no_event_family_500=true` |

### 4.1 事件对象族逐例对拍表（修前 → 修后）

| # | 例 | 修前 `code/status/reason` | 修后 `code/status/reason` | 修后 `details`（排序 JSON） | 判定 |
|---|---|---|---|---|---|
| E1 | DOM 形 `ErrorEvent` 仿体 | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | **`LEDGER_TX_TIMEOUT/503/driver_connection_error`** | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E2 | 原型 getter-only（无 `type`） | `LEDGER_TX_TIMEOUT/503/driver_connection_error` | 同左（**不变**） | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E3 | **真实 `ws.ErrorEvent`** | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | **`LEDGER_TX_TIMEOUT/503/driver_connection_error`** | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E4 | `{type:'error'}`（无 message） | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | **`LEDGER_TX_TIMEOUT/503/driver_connection_error`** | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E5 | **Frozen** 事件对象 | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | **`LEDGER_TX_TIMEOUT/503/driver_connection_error`** | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E6 | 自有 getter-only `message` | `LEDGER_TX_TIMEOUT/503/driver_connection_error` | 同左（**不变**） | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E7 | 事件对象内层带 `ECONNRESET` | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | **`LEDGER_TX_TIMEOUT/503/driver_connection_error`** | `{"error_code":"none","reason":"driver_connection_error"}` | 绿 |
| E8 | 事件对象 + message 命中池超时正则 | `LEDGER_TX_TIMEOUT/503/pool_connection_timeout` | 同左（**不变**，更精确的既有 reason 优先） | `{"reason":"pool_connection_timeout","source":"connection_pool"}` | 绿 |

判据：**503 且 `reason` ∈ 既有可机读集** `{driver_connection_error, pool_connection_timeout}`（`TRANSIENT_NON_PG_REASONS` 原文两值，**未扩集**）。

### 4.2 事件对象族修后「对外 details」R107 正面对答

**答：不含。** 8/8 例的对外 `details` 只含 `reason` / `error_code` / `source` 三个非敏感标量；探针逐例断言：

- `hasOwnProperty(details,'message') === false`（全部 E/C 例）；
- `hasOwnProperty(details,'stack') === false`（全部）；
- `JSON.stringify(details)` **不含**输入原始 `message` 文本（探针用醒目文本 `connection reset by peer while opening ws` 做子串检测，E1/E3/E5/E7 均为该文本）；
- `JSON.stringify(details)` 无栈帧形态（正则 `\.ts:\d+|at \w+ \(`）。

⇒ `r107_detail_leaks = []`（21 例全绿）。此即 `src/ledger-errors.ts:447` 注释「非账本错误**不外泄原始信息（R107）**」的机器可验证形式。

### 4.3 对照逐字段对拍表（修前 vs 修后）

`controls_byte_identical = true`，`control_mismatches = []`。逐字段（`code` / `httpStatus` / `details` 排序 JSON）**13/13 例两 phase 完全相同**（取值见 §2.2 表；此处只给对拍结论）：

| # | 例 | `code` 前后 | `status` 前后 | `details` 前后 | 判定 |
|---|---|---|---|---|---|
| C1 | PG `22003`（Error 实例） | 同 | 同（500） | 同 | 逐字节相同 |
| C2 | PG `22003`（裸对象） | 同 | 同（500） | 同 | 逐字节相同 |
| C3 | `LD016` | 同 | 同（500） | 同 | 逐字节相同 |
| C4 | `ECONNRESET` | 同 | 同（503） | 同 | 逐字节相同 |
| C5 | 池超时 | 同 | 同（503） | 同 | 逐字节相同 |
| C6 | `Error('socket hang up')` | 同 | 同（503） | 同 | 逐字节相同 |
| C7 | `08P01` 排除项 | 同 | 同（500） | 同 | 逐字节相同 |
| C8 | `23514`+`account_bal_guard` | 同 | 同（500） | 同 | 逐字节相同 |
| C9 | `23505`+`ledger_idem_uniq` | 同 | 同（409） | 同 | 逐字节相同 |
| C10 | `57014` | 同 | 同（503） | 同（`{}`） | 逐字节相同 |
| C11 | `53000` infra 类 | 同 | 同（503） | 同 | 逐字节相同 |
| C12 | 命名码 `LEDGER_TX_TIMEOUT` | 同 | 同（503） | 同（`{}`） | 逐字节相同 |
| C13 | 无 `name` 裸对象（`constructor=Object`） | 同 | 同（500） | 同（`error_name:"Error"`） | 逐字节相同 |

⇒ ③「保留 `unclassified_non_pg_error ⇒ 500` 残余未知类现状」也已在 C1/C2/C3/C13 上**实证未变**。

### 4.4 服务端面取证（②：原始信息只进服务端）

**代码位置**（修后行号，`backend-ts/src/ledger-errors.ts`）：

| 位置 | 内容 |
|---|---|
| `:403-433` | 裁定注释块（逐字记录「允许进服务端日志/告警、严禁进对外 `details`」） |
| `:414-433` | `export interface LedgerErrorDiagnostics`（载荷**形态**定义） |
| `:436-439` | 截断/帧数常量：`DIAG_MESSAGE_MAX=200`、`DIAG_STACK_FRAMES=5`、`DIAG_CAUSE_DEPTH=5`、`DIAG_LINE_MAX=300` |
| `:473-502` | `export const ledgerErrorDiagnostics = (e: unknown): LedgerErrorDiagnostics`（**只读、无副作用、不落 sink**） |

**探针实测读数**（修后 RUN `20260928T153429Z`，`diagnostics_face` 段）：

| 例 | `constructor_name` | 原始 `message`（服务端面） | 栈前几帧 | 对外 `details` |
|---|---|---|---|---|
| E1 DOM 仿体 | `DomErrorEventLike` | `"connection reset by peer while opening ws"` | `null`（该仿体无 `stack`） | `{"error_code":"none","reason":"driver_connection_error"}` |
| **E3 真实 `ws.ErrorEvent`** | **`ErrorEvent`** | `"connection reset by peer while opening ws"` | `null` | 同上 |
| E4 `{type:'error'}` | `Object` | `null`（无 message 属性） | `null` | 同上 |
| E5 Frozen 对象 | `Object` | `"connection reset by peer while opening ws"` | `null` | 同上 |
| E7 内层驱动码 | `DomErrorEventLike` | `"connection reset by peer while opening ws"` | `null` | 同上 |
| E8 池超时文本 | `DomErrorEventLike` | `"timeout exceeded when trying to connect"` | `null` | `{"reason":"pool_connection_timeout","source":"connection_pool"}` |
| C1 PG `22003` | `Error` | `"numeric_value_out_of_range"` | **5 frames** | `{"cause":"22003",…}` |

`cause_chain`：E7 的链首为内层 `{constructor_name:'Error', message:'connection reset by peer while opening ws', code:'ECONNRESET'}` —— **外层无 `code` 的真因（驱动码）只在服务端面可见**，对外 `details.error_code` 仍是 `none`。这正是 ② 的意图：真因留服务端，R107 面不膨胀。

> 关于 ② 中「`errName` 改用 `constructor.name`」的**实现取舍（须仲裁确认）**：`errName`（`:266`）只喂**对外** `details.error_name`，本身就是 R107 面；直接改它会改变对外取值（对 C13 这类无 `name` 裸对象会从 `"Error"` 变成 `"Object"`），与「**不得改变对外 `details` 的既有字段形态**」及本单「对照逐字节不变」的验收相冲突。故本单**不动 `errName`**，而把 `constructor.name` 落在**新建的服务端诊断载荷** `ledgerErrorDiagnostics().constructor_name`（E3 实测 `ErrorEvent`；修前该面不存在 ⇒ `NOT_MEASURED`）。**这一读法与「改动 errName」的替代读法并列在此，供仲裁/Zang 裁定。**

---

## 5. 判负自证三段

| 段 | 状态 | 命令 | 文件 sha256 | RUN / artifact | 读数 | 判定 |
|---|---|---|---|---|---|---|
| 红态 | baseline（`cp` 还原） | `--phase before` | `721156cb…df8b` | `20260928T153437Z` / `p3t-00-fold-fix-verify-before-…` | `RED_set(5)=[E1,E3,E4,E5,E7]`；`control_mismatches=[]` | **非空 ⇒ 红** |
| 绿态 | fixed | `--phase after` | `9bc127e4…983d` | `20260928T153429Z` / `p3t-00-fold-fix-verify-after-…` | `RED_set(0)=[]`；8/8 例 503 | **空 ⇒ 绿** |
| 恢复 | `cp` 逐字符还原 baseline | `--phase before` | `721156cb…df8b`（与 baseline **逐字节相等**） | `20260928T153437Z` | 回到 `RED_set(5)` 同集合 | **回到红** |
| 再装（复核） | `cp` 重装 fixed | `--phase after` | `9bc127e4…983d` | `20260928T153437Z` | `RED_set(0)=[]`、`after_phase_red_empty=true` | 再次绿 |

- 「逐字符还原」用**副本 `cp`**（baseline 副本取自工作树、并与 `git show HEAD:…` sha256 互证）；未用 `git add/commit/push`、未用任何破坏性 SQL、未 `pkill`/`killall`。
- 恢复段 sha256 与 baseline **完全一致** ⇒ 红态**不是**「改了别处」造成的。

---

## 6. 端到端影响面（`p1o-00-escape-sweep --phase after --assert` ×3）

命令（原脚本**未改**、其既有 artifact **未改/未删**）：

```
cd backend-ts && NODE_PATH=$PWD/node_modules \
  npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert
```

### 6.1 三次读数（每次登记：退出码 / 两计数 / 六项 verdicts / artifact）

| 次序 | artifact（`.p1f-artifacts/`，**新增**） | run | 退出码 | `unexpected_500` | `expectation_mismatches` | 六项 verdicts | cells |
|---|---|---|---|---|---|---|---|
| 1 | `p1o-00-escape-sweep-after-MULESN5H.json` | `MULESN5H` | **0** | **0** | 0 | 六项全 `true` | total 604 / executed 590 / skipped 14 / thrown 518 / no_throw 86 |
| 2 | `p1o-00-escape-sweep-after-MULEYYXQ.json` | `MULEYYXQ` | `NOT_MEASURED`（读数丢失，见 §8） | **0** | 0 | 六项全 `true` | 同上 |
| 3 | `p1o-00-escape-sweep-after-MULF8X80.json` | `MULF8X80` | **1** | **0** | **1** | 五项 `true`；`all_cells_match_expectation=false` | 同上 |

六项 verdicts = `raw_sqlstate_escapes_zero` / `unmapped_zero` / `missing_status_zero` / `ld_sqlstate_no_leak` / `no_unexpected_500_from_caller_input` / `all_cells_match_expectation`。
`failures`：run1 `[]`、run2 `[]`、run3 `["all_cells_match_expectation"]`。

### 6.2 AC 判定

- **`unexpected_500` = 0 / 0 / 0 ⇒ AC 达标（3/3）**；`raw_sqlstate_escapes`/`unmapped`/`missing_status`/`ld_sqlstate_leaked`/`valid_shape_false_reject` 三次均为 0。
- **`expectation_mismatches` 第 3 次非 0 ⇒ 本单不宣称「套件全绿」**，逐格读数如下。

### 6.3 第 3 次那 1 格（逐格 `code/status`）

| entry | field | shape | input | 抛出 | 修后读数 | 期望 |
|---|---|---|---|---|---|---|
| `E-W4_unfreeze` | `amount` | `over_bigint_far` | `99999999999999999999999` | `true` | **`code=LEDGER_TX_TIMEOUT` / `status=503` / `reason=driver_connection_error`**（`note`「系统繁忙，请稍后重试」） | `must_400/LEDGER_AMOUNT_INVALID/OUT_OF_BIGINT_RANGE\|OVER_MAX_SINGLE_AMOUNT` |

**这是「抖动下期望 400 却得 503」 —— 如实报出。** 它**不是**本次分类修复引入的新码/新状态：`LEDGER_TX_TIMEOUT/503` 是 §14 既有码的既有状态，`driver_connection_error` 是既有 reason。判据如下（同一套件的**历史 artifact** 交叉证据，本单未改这些文件）：

| 历史 artifact（**修前**，非本单产出） | `unexpected_500` | `expectation_mismatches` | 命中格读数 |
|---|---|---|---|
| `…-after-MULCZVYR.json` | **13** | 3 | `E-W1_transfer/bigint_max_plus_1` ⇒ `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` |
| `…-after-MULCT7CG.json` | **4** | 2 | `E-W3_freeze/over_bigint_far` ⇒ `…/500/unclassified_non_pg_error` |
| `…-after-MULDMPGC.json` | **1** | 1 | `E-W4_unfreeze/undefined` ⇒ `…/500/unclassified_non_pg_error` |
| `…-after-MUJJ2PHX / MUJN9W9C / MUJNTM9U / MUJNXSI6 / MUJOLUQJ / MUJPEOEO / MUJQM252 / MULC8WT7 / MULE72UL.json` | 0 | 0 | —（未命中抖动） |

⇒ 三点结论（每一句都有上表支撑）：
1. **同一抖动修前就存在**，且**修前**以 `500 + unclassified_non_pg_error` 呈现 —— 与已定案缺陷机理**完全同形**（无 `code`、`message` 不命中任何正则 ⇒ 旧判据落 `unclassified_non_pg_error` ⇒ 500）。
2. **修后同一抖动呈现为 503 + `driver_connection_error`** —— 基础设施故障不再冒充「实现缺陷」，`unexpected_500` 由历史最高 **13** 降为 **0**（本单三次 0/0/0）。
3. 残余的 `expectation_mismatches=1` 是**连接层抖动本身**（该格在无抖动时应得确定性 400；抖动时该套件对「非确定性故障」没有 503 期望档），不是分类修复的语义错误。**该格判定交由质检/仲裁**：若要把它变绿，需要改套件期望表（**本单禁改该套件**）。

---

## 7. 真库增量 + 反回归

### 7.1 行数（同口径：显式 `schema.table` 限定；`count(*)::text`，只读）

命令：`NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3t-01-db-fingerprint.ts <label>`

| label / RUN | `neon_auth.account` | `public.users` | `public.account` | `public.ledger_entry` | `public.currency` | `public.referral` |
|---|---|---|---|---|---|---|
| `pre-sweep` / `20260928T153458Z`（run1 前） | 0 | 583 | 375 | **3201** | 119 | 293 |
| run1 后 | — `NOT_MEASURED`（漏登记，见 §8） | | | | | |
| run2 前 | 同上 `NOT_MEASURED` | | | | | |
| `run2-post` / `20260928T154535Z`（run2 后） | 0 | 583 | 383 | **3201** | 121 | 293 |
| `run3-post` / `20260928T155353Z`（run3 后） | 0 | 583 | 387 | **3201** | 123 | 293 |

- 库内**另有 `neon_auth.account`**（同名不同 schema，实测 0 行）⇒ 所有计数一律显式限定 schema，避免串味。
- `public.ledger_entry` **三次读数恒为 3201**：本单的修复路径**不写账本行**（事件对象族在 `toAmount`/连接层就被拦下或失败，从不进账本写入）；`users`/`referral` 恒定；`account`/`currency` 的增量是该套件**自身既有夹具**（每轮 +4 账户 / +2 单位，p1p 前缀自建单位），非本单新增夹具。
- **夹具窗口**：本单**未使用** `9912xx` / `cli:kong21-`（探针零 I/O、指纹脚本只读 ⇒ 本单无新增夹具、无新增幂等键；未触碰 `9903–9906`/`9908xx`/`9909xx`/`9910xx`/`9911xx`/`p3p:`/`neng1x:`/`p3q:`/`kong18:`/`p3r`/`p3s` 任一既有分区）。

### 7.2 DB 侧指纹（本单**不应**动 DB ⇒ 必须不变）

| 项 | pre-sweep | run2-post | run3-post |
|---|---|---|---|
| `public` 下 `%ledger%` 函数数 | 29 | 29 | 29 |
| 4 个 `%ledger%` 触发器 | 4 | 4 | 4 |
| `md5(pg_get_functiondef(oid))` 全集合 | — | **与 pre 逐字节相同**（`true`） | **与 pre 逐字节相同**（`true`） |

关键函数指纹（pre = run2 = run3）：`ledger_post_event` `e784a58681ae971bcd97f3043f293002`、`ledger_error_for_sqlstate` `fc8330a039afa6255d226c7bca5baf81`、`ledger_raise` `6cb815387f24a65c8a9caac62981b26a`、`ledger_check_budget` `aca4376617c1a20b816f2ee7ce846669`；触发器 `trg_ledger_entry_append_only` `7bc22ddc2081b6a89e8f95ba9190a2ff`、`trg_ledger_entry_commission_conservation` `84589204d2cef4937c6b2bf98e960c1a`。

### 7.3 迁移

`NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/migrate.ts` ⇒ `exit 0`，日志中 `"action": "skipped"`（`reason="already applied, checksum match"`）出现 **17** 次 ⇒ **17 skipped**（与要求一致）。

> 注：`p3t-01` 里 `schema_migrations_rows` 读数为 `null`（该探针查的是复数表名；实际表名是 `public.schema_migration`）—— 属探针自身的口径缺口，记 `NOT_MEASURED`，**不据此下结论**（迁移状态以 §7.3 的 `17 skipped` 为准）。

---

## 8. 未验证清单（`NOT_MEASURED` / `null`，禁填 0 / 空数组占位）

| 项 | 状态 | 原因 / 口径 |
|---|---|---|
| 第 2 次套件运行的**退出码** | `NOT_MEASURED` | 该次工具调用在 420s 时限被杀，stdout 读数丢失；套件**本身已完成**并落盘 artifact（`MULEYYXQ`，六项 verdicts 全 true）。未重跑伪造该值。 |
| run1 后 / run2 前的行数对 | `NOT_MEASURED` | 漏登记一次读数（只登记了 pre-sweep、run2-post、run3-post）。run3 的「前/后」完整（run2-post → run3-post）。 |
| 修前「服务端诊断面」读数 | `NOT_MEASURED` | 修前 `ledgerErrorDiagnostics` 不存在（探针记 `server_side_diagnostics_available=false`，逐例 `read_out="NOT_MEASURED…"`）——**不填 0**。 |
| 驱动 `ErrorEvent` 的**在线**端到端复现（把连接层逼到事件对象形态并穿过路由层，观察 HTTP 503） | `NOT_MEASURED` | 本单只做纯函数对拍 + 既有套件端到端；不做在线故障注入（会与「不写库/不长驻 server/不改套件」的边界冲突）。RCA 的离线合成复现属 Unit D 证据，**未当本单证据**。本单 e2e 侧的实际观察点是「套件抖动命中 1 格 ⇒ 503」（§6.3）。 |
| 真实 `ErrorEvent` 带**内层 `error.stack`** 时 `stack_head` 的内容 | `NOT_MEASURED` | E 族实测 `stack_head=null`（事件对象自身无 `stack`）；只有 C1（`Error` 实例）测到 5 帧。`cause_chain` 已能取到内层 `error` 的 `constructor_name/message/code`（E7 实测）。 |
| 判据③（非 own / getter-only `message`）在**其它**依赖中的**非基础设施**误捕概率 | `NOT_MEASURED` | 未做全依赖扫描（`node_modules` 内所有"getter-message 错误对象"的产生点）。已知 8/8 实测命中例全是连接层对象；该风险已列入 §9.3。 |
| `errName` 是否改为 `constructor.name` | **未执行**（待仲裁） | 读法分歧见 §4.4：若改，C13 的对外 `error_name` 会由 `"Error"` 变 `"Object"`，与「对照逐字节不变」的验收口径冲突，需仲裁明确以哪条为准。 |
| 超长 `message`（>200 字符）截断与 `DIAG_LINE_MAX=300` 的实际裁剪行为 | `NOT_MEASURED` | 探针未构造超长 message 用例（截断分支代码在 `:441-442`、`:458-459`，逻辑存在但**未实测**）。 |
| `docs/seafood.master-plan.md` 的既有工作树改动 | 非本单所为 | 本单未触碰该文件（§10）；其改动状态在开工前即存在。 |

---

## 9. 探针缺陷自曝（§5.7⑦：读数异常先怀疑自己的探针）

1. **E3 首版是探针缺陷（已修正，作废两次读数）**：首版把「真实 `ws.ErrorEvent`」写成 `require('ws').ErrorEvent ?? require('ws').WebSocket.ErrorEvent` —— 二者**都不存在**（`ws` 只导出 `WebSocket/Server/Receiver/Sender/…`；`ErrorEvent` 定义在 `ws/lib/event-target.js:105`，且被 `package.json#exports` 挡住、不能按 subpath `require`）。于是首版 E3 实际传入 `{NOT_AVAILABLE:'ws.ErrorEvent'}` 这个**普通对象**，**修前修后都红**，属于「用假物冒充真物」。修正后改用**绝对路径** `node_modules/ws/lib/event-target.js`（E3 才落到 `constructor.name='ErrorEvent'` 的真物上）。
   ⇒ 作废读数（**已保留在 `.p3t-artifacts/`，未删，可回溯；但不进入本报告任何判定**）：
   - `p3t-00-fold-fix-verify-before-20260928T153205Z.{json,txt}`
   - `p3t-00-fold-fix-verify-after-20260928T153322Z.{json,txt}`
   - 另有一次中间产物 `…after-20260928T153414Z.{json,txt}`（E3 仍为 `NOT_MEASURED`）。
2. **探针初版对「NOT_MEASURED 路径」缺字段**，连续两次 `TypeError`（`r.r107_detail_leaks`、`r.details.reason`）—— 已修；这两次崩溃也证明 `NOT_MEASURED` 分支被**真实执行过**（不是摆设）。
3. **判据双份实现（有意）与漂移风险**：探针自带 `isEventFamily()` 自证输入形状，`src` 里是独立实现 —— 故意不共用，以避免「用实现验证实现」；代价是**两处可能漂移**。本单人工核对一致（①`instanceof Event` ②`type==='error'` ③非 own 数据属性 / 自有 getter-only + 可读字符串 message）。若后续改判据，两处必须同步。
4. **「纯函数 · 零 I/O」的口径声明**：探针**不做任何 DB / 网络 I/O**、不 import `src/db.ts`、不建连接池；唯一写落盘是**它自己的** run-tagged artifact（交付要求）。若把「零 I/O」读到「连 artifact 都不能写」，则与「run-tagged 读数必须落盘」自相矛盾 ⇒ 本单取前者，明示于此。
5. **§5.7②自曝**：本单**早先**一次 `npx tsc --noEmit 2>&1 | tail -5; echo $?` 的退出码取自**管道之后**（实际为 `tail` 的状态），该读数**作废**；§3.3 的修前/修后读数均为 `> file 2>&1; echo $?`（直接取）重测所得。
6. **`kill`/进程纪律自曝**：第 2+3 次套件连跑的那次工具调用被 420s 时限中止，`sweep3` 起步即被杀；**未使用** `pkill -f` / `killall`，事后 `pgrep -fl p1o-00-escape-sweep` 为空（无残留进程）。
7. **样本量诚实声明**：套件只有 **3** 次本单读数（其中 1 次抖动）；抖动格的历史对照共 12 份 artifact。**不得**用「单次全绿」推翻「历史多次观测到抖动」——本报告据此不宣称套件全绿。

---

## 10. 边界合规与 artifact 清单

**本单写过的文件（全部在硬边界内）**

| 文件 | 性质 |
|---|---|
| `backend-ts/src/ledger-errors.ts` | 唯一 src 改动（`+134/-0`；sha256 `9bc127e4…`） |
| `backend-ts/scripts/p3t-00-fold-fix-verify.ts` | 新建探针（纯函数、零 DB/网络 I/O） |
| `backend-ts/scripts/p3t-01-db-fingerprint.ts` | 新建只读指纹/行数脚本 |
| `docs/audit/p3-errors-fold-fix.md` | 本报告 |
| `backend-ts/.p3t-artifacts/**`（14 个文件） | 本单读数（run-tagged、同名拒写） |
| `backend-ts/.p1f-artifacts/p1o-00-escape-sweep-after-{MULESN5H,MULEYYXQ,MULF8X80}.json` | 套件**自产的新** artifact（只新增，未覆盖/未删既有） |

`.p3t-artifacts/` 全清单：`p3t-00-fold-fix-verify-{before-20260928T153205Z, before-20260928T153437Z, after-20260928T153322Z, after-20260928T153414Z, after-20260928T153429Z, after-20260928T153437Z}.json` + 同名 `p3t-00-stdout-*.txt`（6+6）+ `p3t-01-db-fingerprint-{pre-sweep-20260928T153458Z, run2-post-20260928T154535Z, run3-post-20260928T155353Z}.json`。
（其中 `…before-20260928T153205Z` / `…after-20260928T153322Z` / `…after-20260928T153414Z` 三组为 §9.1/§9.2 的**作废读数**，保留可回溯、不参与判定。）

**未触碰（逐字核对）**：`migrations/**`、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、`docs/seafood.master-plan.md`、`docs/audit/p3-p1o-500-rca.md`、`scripts/p3s-*.ts`、任何**既有** artifact 文件、`scripts/p1o-00-escape-sweep.ts`、其余 `src/**`。`git status --porcelain backend-ts/src/` 仅 `M backend-ts/src/ledger-errors.ts`。

**禁令遵守**：未 `git add`/`commit`/`push`；未 `DELETE`/`TRUNCATE`/`DROP`/`ALTER`；未 `pkill -f`/`killall`（只按精确 PID 的纪律内本单无需 kill；套件是前台进程）；未起长驻 server；未用 `execute_code`；未 `npm install`；未改 `src/db.ts`（无需，故未「先停手报你」）。

**报告章节**：0–10 共 **11** 节（`## ` 级标题）。

