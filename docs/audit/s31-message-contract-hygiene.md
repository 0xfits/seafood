# S31 · `message` 契约净化（R107 / §3.3 条款 9′）—— 收口报告

- **单号**：S31b（S31 的**纯收口单**；上一单撞迭代上限截断，代码已落但未收口）
- **角色**：Kong（实现方） · 派单/裁定：Zang
- **锚 commit**：`6b19af4`（`docs: §5.348/v0.348 —— … + 派 S31`）
- **开工对锚**：`git log --oneline -3` = `6b19af4 / df6d660 / 00ecbbf`；`git status --porcelain` = 产品代码改动仅上单那批 `backend-ts/src/*.ts`（11 文件），无新增
- **本单 run id**：`s31b-20261004T235631Z`
- **after 侧产物**：`backend-ts/.s31-artifacts/s31b-20261004T235631Z/after/`
- **before 侧读数（上单已存，本单只读对照）**：`backend-ts/.s31-artifacts/s31-20261004T234645Z/before/`

---

## §0 对锚（Zang 已复原 + 现盘 sha256）

### 0.1 上单判负态与复原

| 项 | 事实 | 证据 |
|---|---|---|
| 上单遗留 | 仓库留在**未复原的判负态**：`ledger-errors.ts` 的 `LEDGER_AMOUNT_INVALID.message` 被改回**机读码** `'LEDGER_AMOUNT_INVALID'`（探针判据①/④ 红） | 上单 after 产物 `s31-20261004T234645Z/after/negctl-red-machinecode.json`（`machine_code_message_hits=1` / `verdict=FAIL`） |
| Zang 已复原 | **本单开工前已由 Zang 复原**，本单未重做、未改回 | 开工 `shasum -a 256 backend-ts/src/ledger-errors.ts` |

### 0.2 现盘 sha256（本单收口必须逐字节等于此值）

```
$ shasum -a 256 backend-ts/src/ledger-errors.ts
7c48d8c3a656eb407ed2005691dcafac1d3cb436ddfabcbd68d3b5770174a62a  backend-ts/src/ledger-errors.ts
```

- 与上单判负态（`0b31f2e7b0da36c9…`，本单 CJK 变异态另见 §5）**不同** ⇒ 判负态确已复原。
- 本单**末尾复核**（见 §5.3）：`7c48d8c3a656eb407ed2005691dcafac1d3cb436ddfabcbd68d3b5770174a62a` **逐字节一致**。

### 0.3 开工三项预检（Zang 亲跑读数，本单复核一致）

| 预检 | 命令 | 读数 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | exit 0 |
| 类级探针 | `npx ts-node --transpile-only .s31-artifacts/s31-00-message-contract-probe.ts` | `verdict=PASS` / `fails=[]` |
| 禁形 grep | 三条（`message: message \|\| code` / `message = code` / `message = mapped.code`） | 均 = 0 |
| 表内 CJK | 探针 `table_cjk_hits` + `auth_table_cjk_hits` | 0 + 0 |

---

## §1 逐条对照表（`code` / `status` / 旧 `message` / 新英文句）

- **旧 `message` 真源**：`git show HEAD:backend-ts/src/ledger-errors.ts`（= 上单开工时的盘面，中文句 + 2 条空串）。
- **新 `message` 真源**：现盘 `backend-ts/src/ledger-errors.ts`（sha256 `7c48d8c3…`）。
- **`status`（HTTP 状态）逐条未动**（探针 `status_drifts=0`，对拍冻结快照 `FROZEN_STATUS`）。

### 1.1 `LEDGER_ERROR_TABLE` 全量 33 条

| # | code | status（不变） | 旧 message（HEAD） | 新 message（现盘） |
|---|---|---|---|---|
| 1 | `LEDGER_INSUFFICIENT_BALANCE` | 409 | 可用余额不足 | Available balance is insufficient |
| 2 | `LEDGER_INSUFFICIENT_FROZEN` | 409 | 冻结余额不足 | Frozen balance is insufficient |
| 3 | `LEDGER_IDEMPOTENCY_REPLAY` | 200 | （空串 `''`） | Request was replayed idempotently |
| 4 | `LEDGER_IDEMPOTENCY_CONFLICT` | 409 | 该请求与先前的请求内容不一致 | Request conflicts with a previous request under the same idempotency key |
| 5 | `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | 400 | 请求缺少幂等标识 | An idempotency key is required |
| 6 | `LEDGER_IDEMPOTENCY_KEY_INVALID` | 400 | 请求标识格式不合法 | The idempotency key format is invalid |
| 7 | `LEDGER_CURRENCY_NOT_FOUND` | 404 | 该单位不存在 | The requested currency does not exist |
| 8 | `LEDGER_CURRENCY_NOT_LISTED` | 409 | 该单位尚未上市，暂不可交易 | The currency is not listed and cannot be traded yet |
| 9 | `LEDGER_CURRENCY_FROZEN` | 423 | 该单位已暂停交易 | The currency is suspended from trading |
| 10 | `LEDGER_CURRENCY_DELISTED` | 409 | 该单位已下架 | The currency has been delisted |
| 11 | `LEDGER_CURRENCY_INVALID_TRANSITION` | 409 | 状态不允许此变更 | The current state does not allow this transition |
| 12 | `LEDGER_CURRENCY_SYMBOL_TAKEN` | 409 | 该符号已被占用 | The currency symbol is already taken |
| 13 | `LEDGER_CURRENCY_MISMATCH` | 400 | 币种不一致 | The currencies do not match |
| 14 | `LEDGER_SUPPLY_CAP_EXCEEDED` | 409 | 已达该单位发行上限 | The currency supply cap has been reached |
| 15 | `LEDGER_UNAUTHORIZED_MINT` | 403 | 你没有发行该单位的权限 | You are not allowed to mint this currency |
| 16 | `LEDGER_HOLD_NOT_ALLOWED` | 403 | 不支持手动冻结 | Manual holds are not allowed |
| 17 | `LEDGER_AMOUNT_INVALID` | 400 | 金额格式不正确 | The amount format is invalid |
| 18 | `LEDGER_AMOUNT_NOT_POSITIVE` | 400 | 金额必须大于 0 | The amount must be greater than zero |
| 19 | `LEDGER_DECIMALS_OVERFLOW` | 400 | 该单位支持的小数位数不足 | The currency does not support this many decimal places |
| 20 | `LEDGER_SELF_TRANSFER` | 400 | 不能转给自己 | You cannot transfer to yourself |
| 21 | `LEDGER_ACCOUNT_NOT_FOUND` | 404 | 账户不存在 | The account does not exist |
| 22 | `LEDGER_RESERVED_UID` | 400 | 目标账户无效 | The target account is invalid |
| 23 | `LEDGER_REF_NOT_FOUND` | 404 | 关联单据不存在 | The referenced object does not exist |
| 24 | `LEDGER_UNKNOWN_KIND` | 400 | 不支持的账务类型 | The ledger entry kind is not supported |
| 25 | `LEDGER_TRANSACTION_REQUIRED` | 500 | 服务暂不可用，请稍后重试 | The service is temporarily unavailable, please try again later |
| 26 | `LEDGER_LOCK_TIMEOUT` | 503 | 系统繁忙，请稍后重试 | The system is busy, please try again later |
| 27 | `LEDGER_TX_TIMEOUT` | 503 | 系统繁忙，请稍后重试 | The system is busy, please try again later |
| 28 | `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | 503 | 系统繁忙，请稍后重试 | The system is busy, please try again later |
| 29 | `LEDGER_NEGATIVE_BALANCE_GUARD` | 500 | 服务异常，请联系客服 | The service encountered an error, please contact support |
| 30 | `LEDGER_APPEND_ONLY_VIOLATION` | 500 | 服务异常，请联系客服 | The service encountered an error, please contact support |
| 31 | `LEDGER_ACCOUNT_GUARD_VIOLATION` | 500 | 服务异常，请联系客服 | The service encountered an error, please contact support |
| 32 | `LEDGER_FEE_RATE_INVALID` | 500 | 服务配置异常 | The service configuration is invalid |
| 33 | `LEDGER_RECONCILE_MISMATCH` | null | （空串 `''`） | Ledger reconciliation mismatch detected |

### 1.2 新增 `AUTH_ERROR_MESSAGES`（2 条 · 不进 33 码闭集）

`AUTH_*` **不进** §14.1 的 33 码关闭集（i18n 域 = `auth.err.*`）。旧口径下 `sendAuthError` 直接把**域码**当文案（`ledgerErrorBody(code, code, …)`）⇒ 对外 `message` = 机读码；现改为查 `AUTH_ERROR_MESSAGES`。

| code | status（不变） | 旧 message（HEAD） | 新 message（现盘） |
|---|---|---|---|
| `AUTH_UNAUTHORIZED` | 401 | `AUTH_UNAUTHORIZED`（旧：`ledgerErrorBody(code, code, details, 'auth')`，第 2 参 = 域码） | Authentication is required |
| `AUTH_FORBIDDEN` | 403 | `AUTH_FORBIDDEN`（同上） | You do not have permission to perform this action |

**核对**：33 + 2 = 35 条 ⇒ `codes_with_english_message=35`（探针 §3）；33 条中文/空串**逐条**换为稳定英文句；`i18n_key`（`ledger.err.<CODE>` / `auth.err.<CODE>`）**形状不变**（`i18n_key_covered=33/33`）。

---

## §2 单一真源改造

### 2.1 唯一派生出口 `errorMessageOf`

落点：`backend-ts/src/ledger-errors.ts:108`

```ts
export const errorMessageOf = (code: string): string => {
  if (isLedgerErrorCode(code)) return LEDGER_ERROR_TABLE[code].message;  // LEDGER_* 33 码关闭集
  if (isAuthErrorCode(code)) return AUTH_ERROR_MESSAGES[code];            // AUTH_*（不进关闭集）
  return 'Request failed';                                                // 未登记码 ⇒ 通用英文兜底（**绝不**回退成码本身）
};
```

`isAuthErrorCode` 落点：`ledger-errors.ts:98`（`AUTH_ERROR_MESSAGES` 的 `hasOwnProperty` 判别，与 `isLedgerErrorCode` 同形）。**不新造第二套「码 ⇒ 句」映射**：`AUTH_*` 与 `LEDGER_*` 共用**同一出口**。

### 2.2 调用面（4 个落点）

| 落点 | 文件:行 | 形态 |
|---|---|---|
| `fail` 第 4 参缺省（8 处 `const fail`） | 见 §2.3 表 A | `message: message ?? errorMessageOf(code)` |
| `adminVerbError` 第 4 参缺省 | `src/admin-service.ts:25`（体 `:34`） | `message: message ?? errorMessageOf(code)` |
| `fromLedgerError` 兜底支 | 6 文件（见 §2.3 表 A 说明） | 回退 `fail(...)` ⇒ 由 `fail` 派生（**不再传 `mapped.code`/`norm.code` 当文案**） |
| `sendAuthError` 的 `message` | `src/index.ts:292`（`:300`） | `ledgerErrorBody(code, errorMessageOf(code), details, 'auth')` |

### 2.3 A 类「省略第 4 参」调用点枚举（本单补 `not_measured`）

> 口径：`fail(status, code, details, message?)` 与 `adminVerbError(status, code, details, message?)` 均为 **4 参**函数，第 4 参 = 可选 `message`；省略时由 §2.1 派生。

**表 A —— 定义面回退位 = 9 处**（= 8 × `const fail` + 1 × `adminVerbError`；与 Zang 更正的 9 一致，§6①）

```
$ grep -rnE "^\s*(export )?const (fail|adminVerbError) = \(" src/
src/listing-funds-service.ts:147:const fail = (
src/currency-service.ts:40:const fail = (
src/admin-service.ts:25:export const adminVerbError = (
src/market-service.ts:105:const fail = (
src/job-funds-service.ts:39:const fail = (
src/job-service.ts:62:const fail = (
src/compliance-review-service.ts:60:const fail = (
src/listing-service.ts:36:const fail = (
src/currency-review-service.ts:41:const fail = (
```

**表 B —— 实际省略第 4 参的调用点 = 15 处**（`fail`/`adminVerbError` 调用点总 133：省略 **15** + 显式第 4 参 **118**；无花括号法，逐点平衡括号切分列出）

| # | 文件:行 | 被调 | 省略形态 |
|---|---|---|---|
| 1 | `src/admin-service.ts:75` | `adminVerbError` | `(400,'LEDGER_IDEMPOTENCY_KEY_INVALID',{…})` |
| 2 | `src/admin-service.ts:78` | `adminVerbError` | 同上 |
| 3 | `src/admin-service.ts:81` | `adminVerbError` | 同上 |
| 4 | `src/admin-service.ts:84` | `adminVerbError` | 同上 |
| 5 | `src/currency-service.ts:264` | `fail` | `(…,{…})` 3 参 |
| 6 | `src/currency-service.ts:445` | `fail` | 3 参 |
| 7 | `src/job-funds-service.ts:170` | `fail` | 3 参 |
| 8 | `src/job-service.ts:207` | `fail` | 3 参 |
| 9 | `src/job-service.ts:239` | `fail` | 3 参 |
| 10 | `src/listing-funds-service.ts:138` | `fail` | 3 参 |
| 11 | `src/listing-funds-service.ts:403` | `fail` | 3 参 |
| 12 | `src/listing-service.ts:274` | `fail` | 3 参 |
| 13 | `src/listing-service.ts:303` | `fail` | 3 参 |
| 14 | `src/market-service.ts:342` | `fail` | 3 参 |
| 15 | `src/market-service.ts:489` | `fail` | 3 参 |

**附 —— `fromLedgerError` 的「位置传参 `code`」调用点**（B 项口径更正见 §6②）：6 文件 × **2 支** = 12 处，两支均**只传 3 参**、第 4 参由 `fail` 从码派生：

- 支①（`mapped`）：`listing-funds-service.ts:173` · `currency-service.ts:71-73` · `market-service.ts:135` · `job-funds-service.ts:70` · `compliance-review-service.ts:99` · `currency-review-service.ts:72`
- 支②（`norm`）：`listing-funds-service.ts:176` · `currency-service.ts:77` · `market-service.ts:138` · `job-funds-service.ts:73` · `compliance-review-service.ts:101` · `currency-review-service.ts:74`

（注：`mapped.code`/`norm.code` 是**位置传参给 `code` 形参**，**不是** `message` 实参 —— 字面 `message = mapped.code` 计数 = 0，见 §6②。）

### 2.4 禁碰面（本单未动）

`sendError` 同族（偏离 D，26 处）**一字未动**（另单串行）。

---

## §3 类级断言读数（探针 `s31-00-message-contract-probe.ts`）

**命令**：`cd backend-ts && npx ts-node --transpile-only .s31-artifacts/s31-00-message-contract-probe.ts`
**产物**：`after/message-contract-probe.json`（绿 #1）· `after/message-contract-probe-restored.json`（绿 #2）· `after/message-contract-probe-final.json`（绿 #3）

### 3.1 关键字段全文（绿 #1，与绿 #2/#3 逐字段一致）

```json
{
  "probe": "S31 · R107 message 契约类级断言",
  "src_files_scanned": 19,
  "message_literals_scanned": 106,
  "machine_code_message_hits": 0,
  "cjk_message_hits": 0,
  "table_cjk_hits": 0,
  "auth_table_cjk_hits": 0,
  "closed_set_size": 33,
  "i18n_key_covered": "33/33",
  "status_drifts": 0,
  "errorMessageOf_unusable": 0,
  "unknown_code_fallback": "Request failed",
  "codes_with_english_message": 35,
  "machine_code_re": "/^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/",
  "table_fingerprint_sha256": "2686194fcfbdb2f5561f5429acd5f689f2b98b4219e041b543ad585a2d719c75",
  "http_status_of_sample": { "LEDGER_INSUFFICIENT_BALANCE": 409, "LEDGER_RECONCILE_MISMATCH": 500 },
  "isLedgerErrorCode_33": true,
  "verdict": "PASS",
  "fails": []
}
```

### 3.2 判据逐项

| 判据 | 含义 | 读数 | 结论 |
|---|---|---|---|
| ① | 源码 `message` 值面（`fail`/`adminVerbError` 末位字面量 + `ledgerErrorBody` 第 2 参 + 表内值）不命中机读码 / 不含 CJK | `machine_code_message_hits=0` · `cjk_message_hits=0`（`message_literals_scanned=106`） | 绿 |
| ② | 表内 `message` 不含 CJK | `table_cjk_hits=0` · `auth_table_cjk_hits=0` | 绿 |
| ③ | 不变量：码闭集 = 33 · `i18n_key` 覆盖 33/33 · 状态逐条不漂 | `closed_set_size=33` · `i18n_key_covered=33/33` · `status_drifts=0` | 绿 |
| ④ | 派生出口：35 码逐条回非空英文句、不含机读码/CJK、**绝不**回退成码 | `errorMessageOf_unusable=0` · `codes_with_english_message=35` · `unknown_code_fallback="Request failed"` | 绿 |
| ⑤ | 禁用形态：`message: message \|\| code` / `message = code` / `message = mapped.code` = 0 | grep 三条均 0 | 绿 |

**`table_fingerprint_sha256`（表指纹）**：`2686194fcfbdb2f5561f5429acd5f689f2b98b4219e041b543ad585a2d719c75`（= `sha256(JSON.stringify(CODEX[code,status,message]))`）。该指纹**随 `message` 值变化**，是判负可检的载体（判负①②时分别变为 `0c308589…` / `27fd3caa…`，见 §5）。

---

## §4 全量门与前端前后对照表

> **before** = `s31-20261004T234645Z/before/`（上单已存读数，本单**只读**）·
> **after** = `s31b-20261004T235631Z/after/`（本单现跑）·
> 门集 = 12 × `p8-s*-gate` + `p7b-03-offline-gates`。

### 4.1 12 门 + `p7b-03` 逐门对照

| 门 | before 退出码 | before total/passed/failed | after 退出码 | after total/passed/failed | 判 |
|---|---|---|---|---|---|
| `p8-s1-app-config-gate` | 0 | 24 / 24 / 0 | 0 | 24 / 24 / 0 | 同 |
| `p8-s2-fee-rebate-gate` | 0 | 44 / 44 / 0 | 0 | 44 / 44 / 0 | 同 |
| `p8-s3-deposit-gate` | 0 | 45 / 45 / 0 | 0 | 45 / 45 / 0 | 同 |
| `p8-s3b-address-gate` | 0 | 38 / 38 / 0 | 0 | 38 / 38 / 0 | 同 |
| `p8-s4-currency-review-gate` | 0 | 79 / 79 / 0 | 0 | 79 / 79 / 0 | 同 |
| `p8-s5-compliance-gate` | 0 | 117 / 117 / 0 | 0 | 117 / 117 / 0 | 同 |
| `p8-s6-site-text-gate` | 0 | 64 / 64 / 0 | 0 | 64 / 64 / 0 | 同 |
| `p8-s7-batt-checkin-gate` | **1** | 59 / 56 / 3 | **1** | 59 / 56 / 3 | 同（红点见 4.2） |
| `p8-s8-rating-timeliness-gate` | **1** | 92 / 89 / 3 | **1** | 92 / 89 / 3 | 同（红点见 4.2） |
| `p8-s9-bttc-gate` | 0 | 100 / 100 / 0 | 0 | 100 / 100 / 0 | 同 |
| `p8-s10-invite-reward-gate` | **1** | 49 / 48 / 1 | **1** | 49 / 48 / 1 | 同（红点见 4.2） |
| `p8-s11-audit-console-gate` | **1** | 87 / 86 / 1 | **1** | 87 / 86 / 1 | 同（红点见 4.2） |
| `p7b-03-offline-gates` | 0 | passed 37 / failed 0 | 0 | passed 37 / failed 0 | 同 |

**逐门相同** ⇒ after 侧与 before 侧**逐门一致**；`message` 值变化**未命中任何门断言**。`total/passed/failed` 逐门一致，唯一差异为 run-tagged 产物路径（`.p8s*-artifacts/p8s*-20261004T2356xxZ/`）。

### 4.2 红点逐条分流（环境性 vs 真回归）

逐条对拍 before/after `gate.json` 的失败节点（`pass=false`），**id / group / actual 逐字节相同**：

| 门 | 红点 id | group | 受控实例腿 | after actual | before actual | 分流 |
|---|---|---|---|---|---|---|
| s7 | `G8` | dbLive | 真 HTTP（4 新口无 token） | `{"no_token":{},"err":"fetch failed"}` | 同 | **环境性**（无受控实例 ⇒ `fetch failed`） |
| s7 | `G9` | dbLive | 真 HTTP（4 新口有 token） | `{"with_token":{},"err":"fetch failed"}` | 同 | **环境性** |
| s7 | `G10` | dbLive | 真 HTTP（`GET /api/role-names`） | `{"status":-1}` | 同 | **环境性**（连不通 ⇒ -1） |
| s8 | `H5` | httpLive | 真 HTTP（5 新口无 token ⇒ 401） | `{"no_token":{},"err":"fetch failed"}` | 同 | **环境性** |
| s8 | `H6` | httpLive | 真 HTTP（两读口带 token ⇒ 200） | `{"read_200":{}}` | 同 | **环境性** |
| s8 | `H7` | httpLive | 真 HTTP（三写口非法入参 ⇒ 400/404） | `{"write_bad":{}}` | 同 | **环境性** |
| s10 | `K8` | dbLive | 真 HTTP（`/api/role-names` / `/api/batt`） | `{"pub":-1,"no_tok_batt":-1,"tok_batt":-1,"err":"fetch failed"}` | 同 | **环境性** |
| s11 | `K10` | dbLive | 真 HTTP（无 token 401 / 持 `manage_audit` 200 / …） | `{"no_tok":-1,"ok_page":-1,…,"err":"fetch failed"}` | 同 | **环境性** |

**真回归 = 0 条**：全部 8 个红点均在 `httpLive`/`dbLive` 的**真 HTTP 腿**，`fetch failed` / `-1` 即「无受控实例」的环境性信号；这些腿在 before 侧**已红**，after 侧**逐字相同**，与本次 `message` 值变化无因果关系。

### 4.3 前端四项（after 侧，本单现跑）

| 项 | 命令 | before | after | 判 |
|---|---|---|---|---|
| vitest | `cd frontend && npx vitest run` | 4 文件失败 / 7 测试失败 \| 471 passed (478) | 4 文件失败 / 7 测试失败 \| 471 passed (478) | 同 |
| build | `npm run build` | （本单未测 before） | **exit 0**（`✓ built in 1.73s`） | 绿 |
| `p6-tr2-i18n-locales` | `node scripts/p6-tr2-i18n-locales.mjs` | 总判：PASS | 总判：PASS（exit 0） | 同 |
| `p4z-i18nviol-global` | `node scripts/p4z-i18nviol-global.mjs` | 总判：PASS | 总判：PASS（exit 0） | 同 |
| `p4z-feperf-safelist` | `node scripts/p4z-feperf-safelist.mjs` | VERDICT=PASS | VERDICT=PASS（exit 0） | 同 |
| `p4z-miscfix-links` | `node scripts/p4z-miscfix-links.mjs` | 总判：PASS | 总判：PASS（exit 0） | 同 |

**vitest 失败集逐条同基线**（`grep '^ FAIL '` 两面逐字节相同）：

```
FAIL  src/test/accessibility/Accessibility.test.jsx            （文件级）
FAIL  src/test/e2e/basic.spec.js                               （文件级）
FAIL  src/test/components/Card.test.jsx  × 6                    （renders Card with default props / different variants / CardHeader / CardTitle / CardContent / applies hover effect）
FAIL  src/test/performance/VirtualList.test.jsx > updates visible items on scroll  × 1
```

= **Accessibility 文件级 / Card×6 / basic.spec 文件级 / VirtualList×1** —— 与基线**完全一致**，无新增/消失。

### 4.4 受本次 `message` 值变化影响的探针逐处判定（本单补 `not_measured`）

> 口径：判定探针是否把 `LEDGER_ERROR_TABLE`（含 `message`）写入基线产物 ⇒ 本次 `message` 由中文换英文会否改变其读数。

| 探针 | 是否写 `message` | 证据（文件:行） | 判定 | 处置 |
|---|---|---|---|---|
| `p3v-00-fold-fix-verify` | **是** | `p3v-00…….ts:260` `tableFp = sha256(JSON.stringify({table: LEDGER_ERROR_TABLE, …}))` | **受影响（读数面）** —— **已实跑**：`impls.fixed.sha256=7c48d8c3…`、`L4.tableFpSame=false`（指纹随 message 变）；`closed_set_*=33/33` 不变 | `verdicts` 由分类 RED 集驱动（与 `message` 无关），**判据面不受影响**；且 `L6.expected_worktree_sha256='9bc127e4…'` **早已陈旧**（现盘=`7c48d8c3…`），不属本单门集 ⇒ **登记交裁**（陈旧锚，非本单验收门） |
| `p1f-03-f3-timeouts` | **是** | `p1f-03…….ts:657` `ledger_tx_timeout_meta: LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT` | **受影响（值面）** —— 该字段 `message` 由「系统繁忙，请稍后重试」→「The system is busy, please try again later」（status=503 不变） | DB 依赖（`Pool`/`mkPool`）+ 写测试数据（uid 944xxx）⇒ **未跑**（见 §7）；**静态判定**：产物值面变化、**无断言**该字面量 ⇒ 不阻断，登记 |
| `p1n-00-cid-shape` | **是** | `p1n-00…….ts:137-140` `out.error_table = { LEDGER_AMOUNT_INVALID: LEDGER_ERROR_TABLE.…, … }`（4 条整对象） | **受影响（值面）** —— 4 条 `message` 全变 | DB 依赖 ⇒ **未跑**；**静态判定**：`error_table.<CODE>.message` 值变，无断言 ⇒ 登记 |
| `p2qa-10-baseline-migration` | **否** | `p2qa-10…….ts:131-145` 仅用 `LEDGER_ERROR_CODES.length/.includes` · `httpStatusOf` · `LEDGER_ERROR_BUCKETS`（`LEDGER_ERROR_TABLE` 仅出现在**类型声明** `:126`，未读 `message`） | **不受影响** | 无需处置 |

**另**：`scripts/` 内全量引用 `LEDGER_ERROR_TABLE` 的文件 = `p2c-00` / `p2qa-10` / `p2qa-13` / `p1f-03` / `p1n-00` / `p3v-00` / `p1f-02` / `p4z-d1p-01` / `p4z-qa-b3-04`（`grep -rln`）。上列 4 处为本单点名判定；其余 5 处未在本单范围（见 §7 `NOT_MEASURED`）。

---

## §5 判负①・②两读数（红/绿四读数齐）

**探针**：`backend-ts/.s31-artifacts/s31-00-message-contract-probe.ts`（类级断言 · 纯函数 · 零 DB/网络/HTTP）
**变异流程**：先把干净件另存 `~/.hermes/profiles/zang/cache/scratch/s31b-ledger-errors.clean.ts`（sha256 `7c48d8c3…`）⇒ 在主仓改 `LEDGER_AMOUNT_INVALID.message` ⇒ 跑探针 ⇒ **立即 `cp` 复原 + `cmp` 逐字节 + `shasum` 复核**。

### 5.1 判负①（机读码 · 改回 `'LEDGER_AMOUNT_INVALID'`）

| 项 | 读数 |
|---|---|
| 变异态 sha256 | （本单 5.1 与 5.2 均以 `LEDGER_AMOUNT_INVALID` 为靶；机读码变异后探针即红） |
| 探针退出码 | **1** |
| `machine_code_message_hits` | **1** |
| `table_fingerprint_sha256` | `0c3085897b046d07fe7c63cf3d7ef2fb45868a8089ff331ac388a4f99611b67a` |
| `verdict` | **FAIL** |
| `fails` | `① 源码 message 命中机读码：LEDGER_ERROR_TABLE.LEDGER_AMOUNT_INVALID.message ⇒ "LEDGER_AMOUNT_INVALID"` / `④ errorMessageOf(LEDGER_AMOUNT_INVALID) = "LEDGER_AMOUNT_INVALID" 不可用` |
| 产物 | `after/negctl-red-machinecode.json` |

### 5.2 判负②（中文句 · 改回 `'金额格式不正确'`）

| 项 | 读数 |
|---|---|
| 变异态 sha256 | `0b31f2e7b0da36c9833fb2c35e627ea323a545c5652ea987c64b8dc7ad9198c5` |
| 探针退出码 | **1** |
| `table_cjk_hits` | **1**（`auth_table_cjk_hits=0`） |
| `table_fingerprint_sha256` | `27fd3caa7aeedd7f522a63364996f1c24944fed3b56ee978fa7a9b812ffb1f46` |
| `verdict` | **FAIL** |
| `fails` | `② LEDGER_ERROR_TABLE.LEDGER_AMOUNT_INVALID.message 含 CJK` / `④ errorMessageOf(LEDGER_AMOUNT_INVALID) = "金额格式不正确" 不可用` |
| 产物 | `after/negctl-red-cjk.json` |

### 5.3 绿（复原后回绿）与 sha256 复核

| 项 | 读数 |
|---|---|
| 复原 `cmp` | `CMP=IDENTICAL(byte-for-byte)` |
| 复原后退出码（绿 #2） | **0**（`verdict=PASS` / `fails=[]` / `table_cjk_hits=0` / `machine_code_message_hits=0`） |
| 绿 #3（机读码判负后二次复原） | **0**（`verdict=PASS` / `fails=[]`） |
| 产物 | `after/message-contract-probe-restored.json` · `after/message-contract-probe-final.json` |
| **§5.3 收口 sha256** | **`7c48d8c3a656eb407ed2005691dcafac1d3cb436ddfabcbd68d3b5770174a62a`**（= §0.2 干净态，**逐字节一致**） |

**四读数**：判负① 红(exit1/FAIL) · 判负① 绿(exit0/PASS) · 判负② 红(exit1/FAIL) · 判负② 绿(exit0/PASS)。

---

## §6 ★ 三处派单前提更正（Zang 认账，逐条现取证据）

### ① A 项计数：7 处 → **9 处**

- **派单原文**：「A 项 = 7 处回退位」。
- **现取**：**9 处** = 8 × `const fail` + 1 × `adminVerbError`。
- **证据**：§2.3 表 A `grep -rnE "^\s*(export )?const (fail|adminVerbError) = \(" src/` 输出 9 行（`admin-service.ts:25` + 8 个 `const fail`）。

### ② B 项口径：现取 = 0 处 → **字面 0，但位置传参在场（口径太窄）**

- **派单原文**：「B 项现取 = 0 处」（grep `fromLedgerError` 计数）。
- **真确**：字面 `message = mapped.code` = **0**（禁形 grep 均 0）；但 **`mapped.code` / `norm.code` 以「位置传参」形态在场 = 6 文件 × 2 支 = 12 处**（§2.3 附；`fromLedgerError` 两支均 `fail(mapped.httpStatus|norm.httpStatus, mapped.code|norm.code, details)` ——第 2 参是 `code`、**不是** `message`）。
- **结论**：字面口径（`message = mapped.code`）**太窄**，漏掉了「位置传参 `code`」这一真实调用面；旧实现里该位置在部分路径**曾充当** `message`，故必须按调用面而非字面计数。

### ③ F 项读数：33 条中文 → **31 中文 + 2 空串**

- **派单原文**：「33 条 `message` 逐条为中文句」（**转引 spec §15.5 的读数**）。
- **现取**（`git show HEAD:backend-ts/src/ledger-errors.ts` 逐条统计）：**31 条中文 + 2 条空串**（空串 = `LEDGER_IDEMPOTENCY_REPLAY` · `LEDGER_RECONCILE_MISMATCH`）；非中文非空 = 0。
- **结论**：**spec §15.5 那一行需规范侧更正（Jing）**；本单**只登记、不改 spec**（硬口径：禁改 `docs/*.spec.md`）。

---

## §7 未做与 `NOT_MEASURED`（逐项给原因，禁填 0/空）

### 7.1 已跑（实测）

- 类级探针：绿 #1/#2/#3 + 判负①机读码红 + 判负②中文红（§3/§5）。
- 12 门 + `p7b-03`：after 侧**全量现跑**（§4.1）。
- 前端：`vitest run` · `npm run build` · 四脚本（§4.3）。
- `p3v-00-fold-fix-verify`：**纯函数，已实跑**（§4.4）。

### 7.2 `NOT_MEASURED`（逐项原因）

| 项 | 原因 |
|---|---|
| `p1f-03-f3-timeouts` 运行 | DB 依赖（`@neondatabase/serverless` `Pool` + `p1f-lib` `mkPool`），且**写测试数据**（uid 944xxx / 符号 `p1k*` / 键 `ops:p1k:*`）。本单为**收口单**、定位为**静态判定**受 `message` 影响面；实跑会向 DB 写测试数据，超出收口单最小面 ⇒ **未跑**（`message` 影响面已静态判定，见 §4.4） |
| `p1n-00-cid-shape` 运行 | 同上（DB 依赖 + 写测试数据）⇒ **未跑**，静态判定见 §4.4 |
| `p2qa-10-baseline-migration` 运行 | DB 依赖（`raw(p, …)`）⇒ **未跑**；已静态判定**不受 `message` 影响**（不读 `message`，见 §4.4） |
| `p2c-00` / `p2qa-13` / `p1f-02` / `p4z-d1p-01` / `p4z-qa-b3-04` | 亦引用 `LEDGER_ERROR_TABLE`，但**不在本单点名判定清单**（派单点为 `p1f-03 / p1n-00 / p2qa-10 / p3v-00 等`）；未逐个判定其 `message` 暴露面 ⇒ **`NOT_MEASURED`**（登记，建议规范侧并入后续收口） |
| `sendError` 同族（偏离 D，26 处） | 硬口径**禁碰**（另单串行）⇒ 未测其 `message` 面 ⇒ `NOT_MEASURED` |
| 受控实例真 HTTP 腿（`httpLive`/`dbLive`） | 本环境**无受控实例**（`fetch failed` / `-1`）⇒ §4.2 全部 8 红点为**环境性**，其**断言真值不可判**（`NOT_MEASURED`，非「0 回归」的肯定断） |
| `npm run build` 的 **before** 侧 | 上单未跑 build ⇒ 无 before 读数可比；仅**本单 after = exit 0**（§4.3） |
| `p7b-03` 内部 37 项逐条 before/after | 仅取总判（`passed=37 / failed=0`）+ 尾部 `ac14` 段逐字节一致；未逐条 diff 全 37 项 ⇒ 逐项对照 `NOT_MEASURED` |

### 7.3 未做（本单范围外）

- **未改产品语义**：`code` 闭集 33 / `i18n_key` 形状 / HTTP 状态 / `details.reason` 一字未动；`frontend/**` / `migrations/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md` 未动。
- **未 commit / 未 push**；**未 `npm install`**；**未碰 `.env*`**；**未用 `pkill -f` / `killall`**。
- 未发现**真回归**（§4.2 真回归 = 0）。

---

## 附 A · 本单产物清单

- 报告：`docs/audit/s31-message-contract-hygiene.md`（本文件）
- after 产物：`backend-ts/.s31-artifacts/s31b-20261004T235631Z/after/`
  - `message-contract-probe.json`（绿 #1）· `message-contract-probe-restored.json`（绿 #2）· `message-contract-probe-final.json`（绿 #3）
  - `negctl-red-machinecode.json`（判负① 红）· `negctl-red-cjk.json`（判负② 红）
  - `_summary.txt`（13 门退出码）· 13 × `<gate>.txt`
  - `vitest.txt` · `p6-tr2-i18n-locales.txt` · `p4z-i18nviol-global.txt` · `p4z-feperf-safelist.txt` · `p4z-miscfix-links.txt`
- 干净件备份（仓外）：`~/.hermes/profiles/zang/cache/scratch/s31b-ledger-errors.clean.ts`

## 附 B · 收口硬校验

| 校验 | 读数 |
|---|---|
| `src/ledger-errors.ts` sha256 | `7c48d8c3a656eb407ed2005691dcafac1d3cb436ddfabcbd68d3b5770174a62a` |
| `cmp`（干净件 vs 现盘） | IDENTICAL（byte-for-byte） |
| 类级探针 | PASS（`fails=[]`） |
| 真回归 | 0 |
