# P3-P1O-500-RCA · `p1o-00` 500 族红项的定位报告（Kong · 单元 D）

- 仓库：`/Users/kevin/bistro/seafood`（branch `main`）
- 定位对象：`backend-ts/scripts/p1o-00-escape-sweep.ts`（**本单不改该套件**）的 500 族红项（verdict `no_unexpected_500_from_caller_input` / `all_cells_match_expectation`）
- 本单**只定位与取证**，**未改** `backend-ts/src/**`（含 `db.ts`、`ledger-errors.ts`）、`migrations/**`；未 `git add/commit/push`
- 角色：Kong（实现/定位）；夹具：uid 窗口 `9911xx`、幂等键前缀 `cli:kong20-`、测试 symbol 前缀 `P3S`
- 环境：Neon PG 18.6 · `@neondatabase/serverless` **0.6.1** + `ws` · 无 `pg` 包 · pooler 走 `DATABASE_URL`、直连走 `DATABASE_URL_UNPOOLED`（连接串仅在已 gitignore 的 `backend-ts/.env.local`）

---

## §0 摘要与定案表

**一句话定案：五个成员的输入**不是**「输入校验缺口」；同输入在稳定连接下 **10/10 命中期望的 400**。stored artifact 里的 18 个 500 格全部落在「必须走活连接才能拒绝」的格子上，且**逐格集合逐轮不同**（非确定性）；其错误形态与非 PG 兜底折叠分支（`src/ledger-errors.ts:363-364 → 450-456`）**逐字节吻合**，落在 `LEDGER_TRANSACTION_REQUIRED`（`LD024`，status 500）而不是金额闸的 `LEDGER_AMOUNT_INVALID`。⇒ 判为**连接层非确定性 + 映射器把非 PG 错误折叠成 500 并丢弃原始信息（可修缺陷）**，不是套件调用形态问题、也不是金额校验缺口。

### 定案表（每成员一行）

| # | 成员（输入） | 输入值 | 稳定率（N=10，形态 (i) 套件形态） | 两分法 (ii) 契约形态（同语句同 payload，事务内/直连） | 两分法 (iii) 传输重放（同语句，`readQuery`/pooler） | 原始错误形态 | 判定 |
|---|---|---|---|---|---|---|---|
| 1 | `E-W1_transfer/amount/over_bigint_far` | `"99999999999999999999999"` | **10/10 → 400 `LEDGER_AMOUNT_INVALID`**（0/10 为 500） | 10/10 → 裸 `LD016`（⇒ `LEDGER_AMOUNT_INVALID`，status 由映射器补 400） | 10/10 → 裸 `LD016`（`name='error'`，`code='LD016'`） | 稳定流：无原始错误（DB 侧 LD016 正常拒绝） | **非输入校验缺口**；stored artifact 的红来自连接层折叠 |
| 2 | `E-W1_transfer/amount/bigint_max_plus_1` | `"9223372036854775808"` | **10/10 → 400**（0/10 为 500） | 10/10 → `LD016` | 10/10 → `LD016` | 同上 | 同上 |
| 3 | `E-W3_freeze/amount/over_bigint_far` | `"99999999999999999999999"` | **10/10 → 400**（0/10 为 500） | 10/10 → `LD016` | 10/10 → `LD016` | 同上 | 同上 |
| 4 | `E-W4_unfreeze/amount/scientific_1e5` | `"1e5"` | **10/10 → 400**（0/10 为 500） | 10/10 → `LD016` | 10/10 → `LD016` | 同上 | 同上 |
| 5 | `E-W5_settleFrozen/amount/undefined` | `<undefined>`（payload 无 `amount` 键） | **10/10 → 400**（0/10 为 500） | 10/10 → `LD016` | 10/10 → `LD016` | 同上 | 同上 |

补充形态（TS 最小单位闸，纯 TS 无 I/O，N=3）：#1/#2/#3 均 **3/3 → 400 `LEDGER_AMOUNT_INVALID`**（`reason=OUT_OF_BIGINT_RANGE`）。
控制格（合法 `amount="1"` 转账）：**1/1 → 409 `LEDGER_INSUFFICIENT_BALANCE`**（证明账户链与写路径正常）。

### 我的套件自测（同会话 3 次 `--phase after --assert`）

| 次 | 产物 | `unexpected_500` | `expectation_mismatches` | 六项 verdicts | 退出码 | 备注 |
|---|---|---|---|---|---|---|
| #1 | **无 artifact** | NOT_MEASURED | NOT_MEASURED | NOT_MEASURED | **1** | 崩在 `_connectionCallback`（原始 TypeError 见 §4），崩点早于 artifact 落盘 |
| #2 | `p1o-00-escape-sweep-after-MULDMPGC.json` | **1** | **1** | 4 true / 2 false | **1** | 604 格跑完并落盘，**收尾 `pool.end()` 时崩**（同 TypeError） |
| #3 | `p1o-00-escape-sweep-after-MULE72UL.json` | **0** | **0** | **6/6 true** | **0** | 干净通过（`wrote_no_ledger_rows=true`） |

⇒ 同一套件同会话内：**0 红 → 1 红 → 0 红**；唯一红格 `E-W4_unfreeze/amount/undefined`（**不在**五成员名单内、且与 stored artifact 的红集不相交）。
对照（**他人/既有读数，非本单证据**）：`MULC8WT7` 0/0、`MULCT7CG` 4/2、`MULCZVYR` 13/3。

---

## §1 资产与跑法（run-tagged）

| 文件 | 内容 | 跑法 |
|---|---|---|
| `backend-ts/scripts/p3s-00-500-rca-probe.ts` | 外部探针：驱动层插桩 + 同输入 ×N 稳定率 + 两分法 | `cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3s-00-500-rca-probe.ts --n 10` |
| `backend-ts/scripts/p3s-01-inventory.ts` | 只读清点：五表行数 + 17 条触发器计数口径 + 名单 | `… scripts/p3s-01-inventory.ts --tag <TAG>` |
| `backend-ts/scripts/p3s-02-trigger-variants.ts` | 32 条计数变体搜捕「44 从哪来」+ 分布分解 | `… scripts/p3s-02-trigger-variants.ts` |
| `backend-ts/scripts/p3s-03-fold-repro.ts` | 折叠路径**离线合成复现**（纯函数、零 I/O、零库写） | `… scripts/p3s-03-fold-repro.ts` |
| `backend-ts/.p3s-artifacts/p3s-00-500-rca-20260928T150937Z.json` | 探针 N=3（预跑） | run-tagged，同名拒写 |
| `backend-ts/.p3s-artifacts/p3s-00-500-rca-20260928T151206Z.json` | **探针 N=10（主证据）** | 同上 |
| `backend-ts/.p3s-artifacts/p3s-01-inventory-{pre-suite,post-crash,post-suite,post-suite-a3,post-probe-final}.json` | 行增量 + 触发器口径读数 | 同上 |
| `backend-ts/.p3s-artifacts/p3s-02-trigger-variants-20260928T150207Z.json` | 32 变体读数 | 同上 |
| `backend-ts/.p3s-artifacts/p3s-03-fold-repro-20260928T152422Z.json` | 折叠复现读数 | 同上 |
| `backend-ts/.p3s-artifacts/p3s-03-suite-p1o00-after-20260928T145800Z.log` | 套件自测 #1 原始 stderr（崩溃原文） | 同 §0 |
| `backend-ts/.p3s-artifacts/p3s-03-suite-p1o00-after-20260928T150243Z.log` / `…-attempt3-*.log` | 套件自测 #2 / #3 落盘日志 | 同 §0 |
| `backend-ts/.p1f-artifacts/p1o-00-escape-sweep-after-{MULDMPGC,MULE72UL}.json` | 套件自测 #2 / #3 自产 artifact（**新文件，已登记**） | 套件自身落盘 |

探针**不 import 套件内部实现**（`expectationOf`/`cell`/`SHAPES` 一律不复用）：仅 import 被测的 `src/ledger.ts`、`src/db.ts`、`src/ledger-errors.ts` 与驱动包。语句与参数由驱动层（`Pool.prototype.query`）截获后**原样重放**，不重写 payload。

---

## §2 同输入 ×≥10 次稳定率（确定性 vs 非确定性）

探针主证据：`.p3s-artifacts/p3s-00-500-rca-20260928T151206Z.json`（RUN `20260928T151206Z`，`CID=279`，`SYM=P3S150937`）

| 成员 | 形态 (i) 套件形态 `thrown/code/status/reason`（N=10 逐次一致） | N/N |
|---|---|---|
| #1 over_bigint_far | 10/10 `true·LEDGER_AMOUNT_INVALID·400·**OVER_MAX_SINGLE_AMOUNT**`（`details={field:'amount', value:'99999999999999999999999', reason:'OVER_MAX_SINGLE_AMOUNT'}`） | **10/10 期望命中，0/10 500** |
| #2 bigint_max_plus_1 | 10/10 `true·LEDGER_AMOUNT_INVALID·400·**OVER_MAX_SINGLE_AMOUNT**` | **10/10，0/10 500** |
| #3 E-W3 over_bigint_far | 10/10 `true·LEDGER_AMOUNT_INVALID·400·**OVER_MAX_SINGLE_AMOUNT**` | **10/10，0/10 500** |
| #4 scientific_1e5 | 10/10 `true·LEDGER_AMOUNT_INVALID·400·**EXPONENT_NOT_ALLOWED**`（`details.value='1e5'`） | **10/10，0/10 500** |
| #5 undefined | 10/10 `true·LEDGER_AMOUNT_INVALID·400·**MISSING**`（`details={field:'amount', reason:'MISSING'}`） | **10/10，0/10 500** |

> 修正记录（同轮自查）：`reason` 名以 artifact `attempts[].details` 的**实测值**为准；其中 #1/#2/#3 的金额闸实测归 **`OVER_MAX_SINGLE_AMOUNT`**（DB 侧换算闸），**`OUT_OF_BIGINT_RANGE` 只在形态 (ii-b)「TS 最小单位」时出现**（见下方 3/3 行）。套件期望 `OUT_OF_BIGINT_RANGE|OVER_MAX_SINGLE_AMOUNT` 二选一，故两者皆判 `ok`。

- 逐次尝试读数（`thrown/code/status/reason/elapsed_ms/raw_errors`）全量在 artifact 的 `attempts[]` 里，未做任何滤波。
- 驱动层拦截计数：`raw_errors=101`，类型分布 `{LD001(控制):1, LD016:100}` ⇒ **本次运行 101 次驱动级失败中没有 1 次非 PG 错误**（⇒ 本次连接层未抖动）。
- 结论：**同输入稳定率 = 10/10 绿（100%）** ⇒ 就这五个成员而言，**不存在确定性 500**。stored artifact 的 500 属**时红时绿**（同一输入在 `MULC8WT7`/`MULE72UL` 绿、在 `MULCT7CG`/`MULCZVYR`/`MULDMPGC` 红）。
- **样本量口径**：本单结论建立在「1×10（探针）+ 3（我的套件跑）+ 3（对照 artifact）」的**多次观测互相矛盾**上，不靠单次观测反推。

---

## §3 两分法（决定性）与「谁先拦」的顺序

### 3.1 结果

| 形态 | 定义 | #1 | #2 | #3 | #4 | #5 |
|---|---|---|---|---|---|---|
| (i) 套件形态 | 复刻套件入参（无 tx、`amount` 原样） | 10/10 **400** | 10/10 **400** | 10/10 **400** | 10/10 **400** | 10/10 **400** |
| (ii) 契约形态 | **同语句 + 同 payload**（驱动层截获）在 `withTransaction()` 内、直连端点 | 10/10 裸 `LD016` | 10/10 裸 `LD016` | 10/10 裸 `LD016` | 10/10 裸 `LD016` | 10/10 裸 `LD016` |
| (iii) 传输重放 | 同语句同 payload 走 `readQuery`（pooler 只读池）**绕过 ledger 代码** | 10/10 裸 `LD016` | 10/10 | 10/10 | 10/10 | 10/10 |
| (ii-b) 类型正确形态 | `amount` 传 `bigint` 最小单位（走 TS 形状闸） | 3/3 **400** | 3/3 **400** | 3/3 **400** | n/a（字符串型无 TS 闸） | n/a（缺参由 DB 判） |

**读法（两分法的判据是「期望码是否得到」，不是「是否抛错」）**：

- 形态 (ii) 与 (iii) 抛的是**裸 DB 错误** `code='LD016'`、`status=undefined`（`name='error'`），因为这两条路径**故意绕过 `postEvent`→`ledgerErrorFromDbError` 映射**（本单不改 src，无法在映射器里插桩）。`LD016` 在 `src/ledger.ts:1036` 的 `LEDGER_SQLSTATE_TO_CODE` 里映射为 `LEDGER_AMOUNT_INVALID`（§14 表 status 400）⇒ **(ii)/(iii) 得到的就是套件期望的码与状态类**，且 10/10 无一次例外、两种传输（直连 vs pooler）一致。
- ⇒ 若按题面判据：「(ii) 也 500 ⇒ 实现侧输入校验缺口」——**(ii) 不是 500，也不是错误码；是期望的 400 类拒绝** ⇒ **不是实现侧输入校验缺口**。
- ⇒ 也不是「套件调用形态/期望口径问题」：套件形态 (i) 与契约形态取到**同一个拒绝**（`LD016` → `LEDGER_AMOUNT_INVALID`/400），套件期望口径正确；差别只在「传输是否抖动」。

### 3.2 「谁先拦」——调用形态 → 命中分支对应表（引行号）

| 调用形态（`p1o-00` 的 W 格） | 命中的首个分支 | 是否早于网络 I/O | 期望/实际 |
|---|---|---|---|
| `cid` 形状非法（`ID_SHAPES` 的 invalid） | `toCid`（`src/ledger.ts:521`）→ `toAmount`（`:334-357`）；`cid<=0` ⇒ `LEDGER_CURRENCY_NOT_FOUND` 404（`:525-526`，DB 侧 `ledger_cid_arg` 同口径） | **是**（纯 TS，碰 PG 前） | 400/404 ✅ |
| `uid` 形状非法 | `assertUserUid`（`:483-488`）/`toUid`（`:490-494`）→ `toAmount` | **是** | 400 ✅ |
| `beforeTxid` 形状非法 | `toAmount`（经 `E-R3` 入口） | **是** | 400 ✅ |
| **`amount` 是字符串**（含 `"99999999999999999999999"`、`"9223372036854775808"`、`"1e5"`、`" 1 "`、`"-1"`、`"0"`） | **TS 侧无闸**：`postEvent`（`:1211`）→ `amountToPayload`（`:1234-1235`）`typeof v === 'string' ⇒ { amount: v }` 原样入 payload → `runLedgerFn`（`:1134`）→ `callLedgerFnOnce`（`:1001-1015`，默认 `pool` 分支走 `readQuery`，`:1013`）→ `db.ts readQuery`（`:226-235`）→ pooler(WS) → PG `ledger_post_event` → DB 侧 `ledger_parse_user_amount` ⇒ `LD016` | **否**（必须先拿到活连接并跑完语句） | 400 ✅（连接正常时） |
| **`amount = undefined`** | `postEvent:1211` 的 `if (input.amount !== undefined)` ⇒ payload **完全不含** `amount`/`amount_units` 键 ⇒ **TS 闸同样不执行** ⇒ DB 侧 MISSING 分支 ⇒ `LD016` | **否** | 400 ✅ |
| `amount` 是 `bigint`/`number`（含超界） | `amountToPayload` 非字符串分支 → `toAmount`（`:334`）→ `throwOutOfBigintRange`（`:307-312`） | **是** | 400 `OUT_OF_BIGINT_RANGE` ✅ |
| **传输/连接层失败**（WS 握手、TLS、驱动内部） | `db.ts readQuery:233` 抛出**无 `code`** 的对象 → `runLedgerFn` catch（`:1177-1179`）→ `ledgerErrorFromDbError` 返回 `null` → `normalizeLedgerError`（`ledger-errors.ts:376`）→ 非 PG 分支（`:363-364` 分类 + `:450-456` 折叠）⇒ `LD024`/500 | —— 就是这一层 | **500（=红项形态）** |

**正面回答「`code=LEDGER_TRANSACTION_REQUIRED` 而期望 `LEDGER_AMOUNT_INVALID` ⇒ 谁先拦」**：

1. **不是「事务缺失」先拦。** 本实现的钱包写路径**根本不走 `withTransaction`**（`src/ledger.ts:23` 注释明示：「写路径（P1e / D10 变体 B）**不再走 `withTransaction`**，改由单条 `SELECT ledger_post_event($1::jsonb)`」）；`assertInTransaction`（`src/db.ts:211-215`）在全仓**只被 `scripts/verify-db-layer.ts:227` 使用**，**写路径无调用点**（`grep -rn assertInTransaction src/ scripts/` 读数）。⇒ 该 500 **不可能**是「不在事务内」断言触发。
2. **`LD024` 是被「非 PG 错误折叠」造出来的**：`normalizeLedgerError` 的兜底（`ledger-errors.ts:450-457`）把「无 SQLSTATE、无命名码」的错误统一改写成 `LEDGER_TRANSACTION_REQUIRED`（§14 表 status 500，`message='服务暂不可用，请稍后重试'`，与 artifact 的 `note` 逐字一致）。
3. ⇒ **对 `amount` 原样字符串这一族，真正的先后是：连接层（pool checkout → WS/TLS → PG 鉴权 → 语句执行）→ DB 金额闸（`ledger_parse_user_amount` → `LD016`）→ 400。**「超大金额」这条闸**结构上排在连接层之后**，因此连接层一抖动就必然抢在它前面吐 500。若把 `amount` 传成 `bigint`（(ii-b)），闸被提到**碰 PG 之前**，红项即消失（3/3 稳定 400）。

---

## §4 原始错误取证（观测缺口）与一条可修缺陷

### 4.1 我捕获到的原始错误对象（run-tagged）

**(A) 套件自测 #1 的原始崩溃（未处理异常，退出码 1，无 artifact）** —— `.p3s-artifacts/p3s-03-suite-p1o00-after-20260928T145800Z.log`（原始文本，未加工）：

```
TypeError: Cannot set property message of #<ErrorEvent> which has only a getter
    at _n._connectionCallback (.../@neondatabase/serverless/index.js:1379:72)
    at _n._handleErrorWhileConnecting (…/index.js:1285:38)
    at _n._handleErrorEvent (…/index.js:1286:33)
    at cn.emit (…/index.js:395:63)
    at x.reportStreamError (…/index.js:1196:46)
    at x.emit (…/index.js:395:63)
    at WebSocket.<anonymous> (…/index.js:983:42)
    at callListener (…/node_modules/ws/lib/event-target.js:290:14)
    at WebSocket.onError (…/node_modules/ws/lib/event-target.js:232:9)
```
`name='TypeError'` / `message` 如上 / `code` 无 / `stack` 见上 / `cause` 无（截图级原文；同一形态在 #2 的收尾阶段复现，见 §0）。

驱动源码链（只读引用）：`index.js:1281-1285` `_handleErrorWhileConnecting(e){… this._connectionCallback(e)}` → `newClient` 里 `t.connect(o=>{… o&&(… s&&(o.message="Connection terminated due to connection timeout"))})`（`index.js:1377-1380`）——**当连接超时标志位成立且 `o` 是 `ws` 的 `ErrorEvent`（`message` 只有 getter，`ws/lib/event-target.js:132`）时，赋值抛 TypeError**。

**(B) 稳定连接下的原始错误（探针 101 次驱动级失败）**：全部是 PG 协议错误对象，`name='error'`（小写，驱动构造）、`code='LD016'`、`has_own_code=true`、`status=undefined`、`stack` 落在 `index.js:1340`（驱动 `query` 内）——**没有任何一次是无 `code` 的非 PG 错误** ⇒ 稳定连接下 500 不会出现。

### 4.2 折叠路径的**离线合成复现**（`p3s-03-fold-repro-20260928T152422Z.json`，纯函数、零 I/O）

| 合成输入（形态族） | `code` | `status` | 折叠后 `details` | 原始信息是否留存 |
|---|---|---|---|---|
|`Error('WebSocket was closed before the connection was established')`| `LEDGER_TRANSACTION_REQUIRED` | **500** | `{cause:"non_pg_error",reason:"unclassified_non_pg_error",error_name:"Error",error_code:"none"}` | **丢** |
|`Error('WebSocket was closed abnormally (code 1006)')`| 同上 | **500** | 同上 | **丢** |
|`Error('fetch failed')`| 同上 | **500** | 同上 | **丢** |
|`new Error()`（空 message）| 同上 | **500** | 同上 | **丢** |
|`TypeError('Cannot set property message of #<ErrorEvent> …')`| 同上 | **500** | 同上（`error_name:"TypeError"`） | **丢** |
|`{message:'TLS handshake failed', type:'error'}`（无 `name`/`code`）| 同上 | **500** | 同上 | **丢** |
|**`ErrorEvent` 仿体**（`name`/`code` 均 undefined，`message` getter-only）| 同上 | **500** | **`error_name:"Error"` / `error_code:"none"`** | **丢** |
|`Object.freeze({type:'error'})`| 同上 | **500** | 同上 | **丢** |
|对照组 `Error('timeout exceeded when trying to connect')`| `LEDGER_TX_TIMEOUT` | 503 | `{reason:"pool_connection_timeout",source:"connection_pool"}` | 丢（但状态类正确） |
|对照组 `ECONNRESET` | `LEDGER_TX_TIMEOUT` | 503 | `{reason:"driver_connection_error",error_code:"ECONNRESET"}` | 丢 |
|对照组 `code='22003'`（PG SQLSTATE）| `LEDGER_TRANSACTION_REQUIRED` | 500 | `{cause:"22003",reason:"unclassified_pg_error",error_name:"Error",pg_code:"22003"}` | 丢 |

**逐字节吻合**：stored artifact 与我的套件自测 #2 的 18 个 500 格 `details` **全部**是
`{"cause":"non_pg_error","reason":"unclassified_non_pg_error","error_name":"Error","error_code":"none"}`，
与 4.2 中 **`ErrorEvent` 仿体 / 无 `name` 无 `code` 对象** 一行的输出**完全一致**（`error_name` 取 `'Error'` 是因为 `ledger-errors.ts:266` 的 `String(e?.name ?? 'Error')` 对**没有 `name` 属性**的 `ErrorEvent` 走默认值）。而 PG 错误（22003/LD0xx）会得到 `reason='unclassified_pg_error'` **带 `pg_code`/`cause`** —— **artifact 里一次都没出现过** ⇒ 红项**不是** DB 侧错误。

### 4.3 ⇒ 一条**可修缺陷**（本单不改 `src/**`，请另批单）

1. **最小复现**（零依赖、零网络）：`p3s-03-fold-repro.ts` 的 `error_event_like_getter_only_message` 一例 —— 把一个「无 `name`、无 `code`、`message` getter-only」的对象交给 `normalizeLedgerError`，即得 `500 / LD024 / details={cause:'non_pg_error',reason:'unclassified_non_pg_error',error_name:'Error',error_code:'none'}`（命令与落盘见 §1）。
2. **缺陷陈述（两处，均在映射器）**：
   - `src/ledger-errors.ts:450-457`：非 PG 兜底**只**记 `cause/reason/error_name/error_code`，**不保留原始 `message`/`stack`**（`error_name` 还会因 `:266` 的 `?? 'Error'` 把 `ErrorEvent` 记成 `Error` ⇒ 形态失真）。
   - `src/db.ts:226-235 readQuery` 不包装错误，`src/ledger.ts:1177-1179` 直接 `throw normalizeLedgerError(e)` ⇒ 原始对象在**进入日志之前**就被丢弃，且 `LD024`（500 类）**违反 `DL126`「500 类码只允许由不变式被破坏触发且必须告警」** ——连接抖动被记成「实现缺陷」。
3. **修复方案（最小、不新增错误码、不改 33 码关闭集）**：
   - 在 `normalizeLedgerError` 的非 PG 兜底分支补可机读诊断字段（仅 `details`，非敏感标量）：
     `error_message`（截断 200）、`error_stack_head`（前 3 帧，截断 400）、`error_name_node`（`e.constructor?.name`，区分 `ErrorEvent`/`Error`）、`cause_chain`（`e.cause`/`e.error` 递归一层）；
   - 把 `ErrorEvent` 一类**事件对象**显式识别出来（`typeof e.message === 'string'` 但无 `own` `message` 属性、或 `e instanceof Event`），归入 `driver_connection_error`（**503**），与现有 `TRANSIENT_NON_PG_REASONS` 一致；
   - 500 分支接告警（`DL126`），告警负载带上述诊断字段。
4. **判负自证设计（红/绿/恢复，脚本可直接判）**：
   - **红态**：`normalizeLedgerError(evt)` 的 `details` 里查不到原始 `message`（也不含 `stack` 帧）且 `status===500`；
   - **绿态**：同一输入下 `details.error_message` 命中原文，或状态类降到 503；
   - **恢复**：`p3s-03-fold-repro.ts` 复跑后 `RED_info_lost_500` 集合为空（当前读数为 **9 项**：见 artifact 的 `three_state.RED_info_lost_500`）。
   - 该脚本对「修前/修后」同形可比（无 I/O、无库写、无副作用）。

---

## §5 决定性判别量（排他区分三假设）

| 判别量 | 量法（可复算） | 结果 | 排除了什么 |
|---|---|---|---|
| **D1 红格是否落在「TS 形状闸可先拦」的格子** | 对 3 份对照 artifact + 我 2 份自测 artifact 的**全部 500 格**（18 + 1 格）逐格判「`field∈{cid,uid,before_txid}` 且 `input_shape∈SHAPE_INVALID`」 | **18/18 与 1/1 全部是「必须走活连接」的格；可用 TS 闸先拦的格子 = 0** | 排除「输入校验缺口」：`amount` 字符串、`" -1 "`、`" 0 "`、`uid/valid`、`cid/padded_spaces`、`E-W7_getOrCreateAccount/cid/valid` 这些形态彼此无关，**没有共同的输入学特征**，只有「需要活连接」这一共同点 |
| **D2 同输入同形态稳定率分布** | 探针 N=10 × 5 成员（形态 (i)） | **10/10 期望 400、0/10 500**（另 N=3 预跑同形） | 排除「确定性实现缺陷」：若为确定性缺口，应 10/10 红 |
| **D3 两分法（同语句同 payload 换传输/换事务）** | (ii) 事务内直连 10/10、(iii) `readQuery` 重放 10/10 | 两形态**都**得到 `LD016`（⇒ 400 类），无一次非 PG 错误 | 排除「套件调用形态/期望口径」：调用形态不是决定量；也排除「实现侧闸位错」：两种传输下闸位一致 |
| **D4 原始错误对象类型分布** | 探针 101 次驱动失败：`{LD001:1, LD016:100}`；折叠复现 12 例（§4.2） | 稳定连接下 **0 次**非 PG 错误；红项形态只可能由「无 `name`/无 `code` 的事件/裸对象」产生，且与 `ErrorEvent` 仿体逐字节吻合 | 排除「DB 侧 22003/LD0xx 逃逸」：那会留下 `pg_code`/`cause=SQLSTATE` 与 `reason='unclassified_pg_error'`，artifact 中 0 例 |
| **D5 是否与「新连接建立」相关** | 套件自测 #1/#2 **崩在连接路径**（`_handleErrorWhileConnecting` ← `WebSocket.onError` ← `ws` ErrorEvent），#3 正常；同会话 3 跑得 `0红 → 1红 → 0红` | 红项与连接建立期故障**同层同源**；驱动对 `ErrorEvent` 的处理路径本身有缺陷（4.1） | 排除「与连接层无关的纯逻辑红」；也说明「红项 = 连接层抖动」是**当前唯一与全部读数相容**的假设 |
| **D6 是否只在 `thrown` 计数边缘出现** | artifact 里 500 格的 `thrown` 均为 `true`，但 `cells_thrown` 三轮恒定 518-519、`cells_total` 恒 604、`cells_no_throw` 86 | 红项**不改变** thrown 计数（它们本就是「抛错」格） | 排除「红项是分类器/计数口径产物」：红项是真抛出的错误对象，只是**类型**是连接层对象 |

**排他结论**：D1（无共同输入特征）+ D2（同输入 10/10 绿）+ D6（红集逐轮漂移）已足够排除「输入校验缺口」；D3 排除「套件调用形态/期望口径」；D4+D5+D1 共同指向「连接层非确定性（`ws` ErrorEvent → 驱动 `_connectionCallback` 抛 TypeError / 无 code 对象 → 映射器折叠成 LD024/500）」，并**附带**一条确定性可修缺陷（§4.3：原始信息丢弃 + 连接抖动被记成 500 类，违反 `DL126`）。

---

## §6 「`public` 非 internal 触发器」43 vs 44 结算

### 6.1 我的 SQL 与读数（`p3s-01-inventory-post-probe-final.json`，同一批 SQL 在 5 个时点复跑，读数恒定）

```sql
-- T1（我用的口径）
SELECT count(*) FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND NOT t.tgisinternal;                    -- ⇒ 43
```
| 口径 | SQL 要点 | 读数 |
|---|---|---|
| T1 | `pg_trigger`+`pg_class`+`pg_namespace`，`nspname='public' AND NOT tgisinternal` | **43** |
| T2 | 同 T1 去掉 `NOT tgisinternal` | 175 |
| T3 | T1 `GROUP BY tgenabled` | `{O:43}`（**0 禁用**，与双方一致） |
| T4 | T2 `GROUP BY tgenabled` | `{O:175}` |
| T5/T6 | 按 schema 分组（全部 / 非 internal） | `public:175 / neon_auth:24`；非 internal 全库**只有 public = 43**（其它 schema 非 internal = 0） |
| T7/T8 | 按 `relkind` 分组 | **非 internal 全部 `relkind='r'`（普通表）**：视图/外部表/分区克隆 = **0** |
| T9 | `GROUP BY tgisinternal` | `false:43 / true:132`（132 = FK/PK 的 `RI_ConstraintTrigger_*`） |
| T10 | 非 internal `GROUP BY (tgparentid=0)` | `parent=0:43`，**分区克隆 0** |
| T11 | `public` 且 `tgenabled <> 'O'` | 0 |
| T12/T13/T14 | `information_schema.triggers`：public 行数 / 全库行数 / public 去重 `(table,name)` | **51 / 51 / 43** |
| T15 | 不显式 join `pg_namespace`，改用 `::regnamespace` | 43 |
| T16 | `pg_event_trigger` | 0 |
| T17 | 同 T1 且 `tgparentid=0` | 43 |

`information_schema.triggers` 的 **51 − 43 = 8** 已解释清楚（不是新增触发器，是**一行一事件**）：多事件触发器共 7 个 → 展开多出 8 行：
`account.trg_account_guard`(3 行)、`commission_policy.trg_commission_policy_append_only`(2)、`commission_policy.trg_commission_policy_weights_guard`(2)、`currency_status_log.trg_currency_status_log_append_only`(2)、`ledger_entry.trg_ledger_entry_append_only`(2)、`market_trade.trg_market_trade_append_only`(2)、`referral.trg_referral_append_only`(2) ⇒ 3+2×6=15 行覆盖 7 个触发器，`43 + 8 = 51` ✅。

### 6.2 「44 从哪来」——32 条变体搜捕（`p3s-02-trigger-variants-20260928T150207Z.json`）

把能想到的口径全算了一遍（含 `tgisinternal IS NOT TRUE`、`tgenabled` 四值、`tgname NOT LIKE 'RI_%'`、按**函数** schema、`tgparentid`、`relkind`、`tgtype` 位掩码、约束数、`information_schema` 行/去重/事件/时序、`pg_event_trigger`、全库/按 schema 等）：

- **等于 44 的变体：`[]`（一条都没有）**；
- 44 的「邻居」：`43`（T1/V01/V03/V04/V06/V08/V10/V12/V14/V16/V17/V19/V26/V30）、`42`（V07 非约束触发器、V27 BEFORE 位）、`51`（information_schema 行数）、`175`（含 internal）、`199`（全库）、`33`（FK 约束）、`264`（全部约束）、`17`（有触发器的表数）、`0`（分区克隆 / 视图 / 外部表 / event trigger / `INSTEAD OF`）、`1`（`AFTER` timing 行数）。

**判定：口径差，不是数据差。** 依据：
1. 我用**三条互相独立**的方法（`pg_catalog` 计数 / `information_schema` 去重 / 43 个名字逐条枚举）都得到 **43**，且 5 个时点（含套件跑前跑后）恒定；
2. 32 条变体中**没有任何一条**能产出 44；44 不是一个自然口径的读数（`tgisinternal` 二值化的读数是 `43` 或 `175`；按事件展开是 `51`；按约束/前缀/时序都是 42/33/17/1/0）；
3. 双方在「零禁用」（`tgenabled<>'O'` = 0）上一致 —— 分歧**只在计数口径**，不在数据状态。

⇒ 结论：**43 为真**；「44」需 Neng 补**原样 SQL + `run`/时点**才能归因，最可能是：(a) 计数时点不同（另一时点/分支上的快照，如 0017 前后或 Neon 分支），(b) 口径混用（例如 `tgisinternal` 过滤与 `tgenabled`/`relkind`/`tgname` 过滤叠加，或对 `information_schema` 做 `count(*) FILTER`），(c) 统计对象弄错（视图/外部表在 `information_schema` 里也会出现 —— 本库为 0，可排除）。

---

## §7 真库行增量登记（同口径：`p3s-01-inventory` 五表 `count(*)`）

| 时点 | users | account | ledger_entry | currency | referral | 该步增量 |
|---|---|---|---|---|---|---|
| `pre-suite`（本单开工前） | 583 | 365 | 3201 | 114 | 293 | — |
| 套件自测 #1（崩，无 artifact） | 583 | 365 | 3201 | **115** | 293 | currency +1 |
| 套件自测 #2（`MULDMPGC`，收尾崩） | 583 | **369** | 3201 | **116** | 293 | account +4 / currency +1 |
| 探针预跑 N=3（`CID 278`） | 583 | 370 | 3201 | 117 | 293 | account +1 / currency +1 |
| 探针主跑 N=10（`CID 279`） | 583 | 371 | 3201 | 118 | 293 | account +1 / currency +1 |
| 套件自测 #3（`MULE72UL`，通过） | 583 | **375** | 3201 | **119** | 293 | account +4 / currency +1 |
| `post-probe-final`（本报告收尾时） | 583 | 375 | 3201 | 119 | 293 | 0（p3s-02/p3s-03 纯只读/零 I/O） |

- **`ledger_entry` 全程 +0**（3201 → 3201）；`users` +0；`referral` +0。
- `account` 增量来自夹具（`getOrCreateAccount(U2)`，每次 1 行）+ 套件自身的账户自建路径（每次 4 行）；`currency` 每次运行 +1（探针自建 `P3S*` 测试币 / 套件自建 `P1P*` 测试币）。
- **与既有登记的口径差异（必须点名）**：本次三次套件运行**均为 `users +0 / ledger_entry +0`**，与已登记的「套件批跑 = `users +108 / ledger_entry +229` 量级」**不一致**。可能原因（未验证，列入 §8）：本次三次运行都**没有跑到会建账户/写账本行的后半段**（#1 崩在早期、#2 崩在收尾、#3 通过但套件自身 `rows_touched.wrote_no_ledger_rows=true`），或历史登记的 +108/+229 来自**另一次运行方式/另一份夹具**。**本单不以任何一行推断他人读数**。
- 探针自身纪律读数：`db_rows_delta = {users:0, account:1, ledger_entry:0, currency:1, referral:0}`（N=3 与 N=10 两次一致）；每次 attempt 都是**拒绝路径**（未写账本行）。

---

## §8 未验证清单（**未实测一律写 `NOT_MEASURED`/`null`，禁填 0/空数组占位**）

| 项 | 状态 | 说明 |
|---|---|---|
| WebSocket 层事件（`open`/`close`/`unexpected-response`/`error`） | **NOT_MEASURED** | 探针的 `webSocketConstructor` 包装**未生效**（artifact `ws_constructs=0`、`ws_events` 为空数组 ⇒ 该读数不可用）；连接层证据仅来自 `Pool.prototype.connect/query` 拦截 |
| 故障瞬间的连接池活动（in-use/idle/waiting 计数、是否新连接建立） | **NOT_MEASURED** | 探针未采样 `pg_stat_activity`/池内部计数；D5 的「同层同源」是**崩溃栈 + 频率**证据，不是连接池读数 |
| 套件自测 #1 的 604 格读数 | **NOT_MEASURED** | 崩点早于 artifact 落盘（无文件） |
| 折叠后的原始 `stack` 是否曾进过服务端日志 | **NOT_MEASURED** | 本单只跑脚本，未启长驻 server、未读服务日志（边界禁止长驻 server） |
| `ErrorEvent` 在**真实**驱动路径上被交给 `normalizeLedgerError` 的一手抓取 | **null** | 稳定连接下未复现抖动（101 次驱动失败全为 LD016）；该形态由**离线合成复现 + artifact 逐字节吻合 + 驱动源码链**三方合证，**不是**一次真实抓取 |
| 「44」的确切来源 | **NOT_MEASURED** | 32 变体均非 44；需对方原样 SQL + 时点 |
| 历史「`users +108 / ledger_entry +229`」的 runtag 与夹具 | **NOT_MEASURED** | 未找到该登记的 runtag；本单三次运行读数与之不一致（已点名） |
| 套件三份既有 artifact 的**环境/时点**（是否同一本机、同一连接条件） | **NOT_MEASURED** | 只能读到文件内字段 |
| 驱动版本升级 / 换 `pg` 驱动后的表现 | **NOT_MEASURED** | 本单禁 `npm install` |

---

## §9 探针缺陷自曝

1. **形态 (ii)/(iii) 故意绕过映射器** ⇒ 它们抛的是**裸 DB 错误**（`code='LD016'`、`status=undefined`），**不是** `LEDGER_AMOUNT_INVALID/400`。判据必须按「`LD016` → `LEDGER_SQLSTATE_TO_CODE`（`src/ledger.ts:1036`）→ `LEDGER_AMOUNT_INVALID` → §14 status 400」换算，**不可**把 `status=undefined` 读成「没得到期望」。
2. **WebSocket 包装未生效**（`ws_constructs=0`）：`neonConfig.webSocketConstructor = TracedWS` 在 `@neondatabase/serverless@0.6.1` 上未见生效（可能模块求值时已固化解构）。我一直**没有**在 WS 上挂 `error` 监听（避免把「未处理的 error 事件」变成静默、掩盖被追查的故障）——因此 WS 级读数空缺，同时保证了探针未改变 WS 行为（保真）。
3. **`foldRepro` 曾未进入输出**：探针首版把该变量算出来但**没放进 `out` 对象**（第一次 N=10 的 artifact 里无此键）。已改用独立脚本 `p3s-03-fold-repro.ts` 重取，读数见 §4.2（**首版 artifact 里的缺失键按 `NOT_MEASURED` 处理，未回填**）。
4. **`--n 3` 预跑与 `--n 10` 主跑各建了一个测试币**（`CID 278/279`），`account` 各 +1 —— 已计入 §7 增量。
5. **控制格只有 1 次**（合法 `amount='1'` ⇒ 409）：它不是稳定性样本，只用于证明账户链可用（不做统计外推）。
6. **§5-D1 的 19 格判定依赖 artifact 自带字段**（`field`/`input_shape`）；`input_shape` 名字集硬编码自套件的 `SHAPE_INVALID_NAMES`（只读引用，未 import）。
7. **「同输入」的口径**：形态 (i) 每次复用同一幂等键（`cli:kong20-…`），因为所有 attempt 都在**拒绝路径**上（未写账本行 ⇒ 无 replay 干扰）；这一点由每次运行后 `ledger_entry` 增量 0 自证。
8. **§6 的 43 不依赖任何污染源**：T1 及全部变体都是只读 `SELECT`，5 个时点读数一致（含套件跑前后）。
9. 探针**未**验证「连接层抖动的根因」（TLS 扫描/网络/池er），只做定位：抖动**存在**（驱动崩溃栈、套件自测 0红→1红→0红）且**形态**与红项一致。

---

## §10 结论与建议（边界声明）

1. **五成员定案**：全部为**非确定性 500**（连接层），**非**输入校验缺口、**非**套件调用形态/期望口径问题。稳定性读数：探针 N=10 × 5 成员 **10/10 命中期望 400**；契约形态与传输重放各 10/10 命中 `LD016`（⇒ `LEDGER_AMOUNT_INVALID`/400）。
2. **红项机制（当前唯一与全部读数相容）**：`amount`（字符串 / 缺参）**没有 TS 侧闸**，其拒绝必须在**活连接**上由 DB 闸完成 ⇒ 连接建立期故障（`ws` `ErrorEvent` 等无 `name`/无 `code` 对象，含驱动 `_connectionCallback` 抛 `TypeError` 这一形态）**必然抢在金额闸之前**；`normalizeLedgerError` 的非 PG 兜底把这种对象**折叠成 `LD024`/500 且丢弃原始 message/stack** ⇒ 表现为「期望 400 却 500」。
3. **建议（均需另批单，本单不改 `src/**`）**：
   - **P0 映射器**：非 PG 兜底保留原始 `message`/`stack` 头/`constructor.name`/`cause` 链；把事件对象（`ErrorEvent`）归类为 `driver_connection_error` ⇒ **503**（可重试），恢复 `DL126`「500 只能由不变式破坏触发」的语义。判负三态见 §4.3.4。
   - **P1 观测**：`db.ts readQuery` 的失败路径带 `reason/source` 与耗时（区分「池等待」与「握手失败」）；套件侧只做**读**的对拍，不改套件。
   - **P2 可选口径**：`amount` 字符串路径的前置形状闸（如位数/字符集）可把「明显超 bigint」的拒绝提到碰 PG 之前（与 §3.2 的 (ii-b) 行为一致），使该类输入不受连接抖动影响 —— 属**加固**，不是本单判定的缺陷修复项。
4. **套件本身（`p1o-00`）**：本单三次自测得 **0红 → 1红 → 0红**（#3 六项 verdicts 全 true、退出码 0）⇒ **该套件当前不可复现红项**；其 500 族判据在**抖动环境**下会给出非确定性红（同一输入逐轮漂移），建议把「500 族红项」的取证口径改为**先看 `details.error_name`/`error_code` 是否为空形态**（§4.2 的红态判据），以区分「实现缺陷」与「连接层抖动」。
5. **未改动的边界**：`backend-ts/src/**`、`migrations/**`、既有 artifacts 目录内既有文件、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、`docs/seafood.master-plan.md` 全部未触碰；未 `git add/commit/push`；未 `DELETE/TRUNCATE/DROP/ALTER`；未 `pkill -f`/`killall`；未装包；未起长驻 server；未用 `execute_code`。

---

### 附：本报告章节数（终局 `read_file` 复核用）
§0 摘要与定案表 · §1 资产与跑法 · §2 稳定率 · §3 两分法与「谁先拦」 · §4 原始错误取证与可修缺陷 · §5 决定性判别量 · §6 43 vs 44 结算 · §7 真库行增量 · §8 未验证清单 · §9 探针缺陷自曝 · §10 结论与建议 ⇒ **共 11 个编号章节（§0–§10）+ 1 个附表**。
