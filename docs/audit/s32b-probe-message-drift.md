# S32b · `message` 契约改造的**下游探针漂移**收口（台账 B15）

- **单**：S32b（Kong/实现方）—— B15「`message` 值变更后的下游探针基线/值面前推」
- **上游**：S31（落点 `86e3a33`）把 `LEDGER_ERROR_TABLE` 33 条 `message` 中文句 ⇒ 稳定英文句，并新增 `AUTH_ERROR_MESSAGES` 两条（**不进** 33 码闭集）
- **runid**：`20261005T001043Z`　**产物**：`backend-ts/.s32b-artifacts/20261005T001043Z/`
- **硬口径遵守**：只改 `backend-ts/scripts/**` + 本报告 + 产物；**未动** `backend-ts/src/**` / `frontend/**` / `migrations/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`；无 `pkill/killall`；无 commit/push；无 `npm install`；未碰 `.env*`；原始输出用 `.txt`（非 `.log`）。

---

## §0 对锚

```
$ git log --oneline -4
fa7bce4 docs: §5.350/v0.350 —— S31/S31b 回执与核盘 … + 派 S32 ∥ S32b + 台账 B5 上半闭环与新增 B15
86e3a33 fix(errors): S31+B5 上半 —— message 契约在源头落实：LEDGER_ERROR_TABLE 33 条中文 ⇒ 稳定英文句 …
bbefbd9 docs: §5.349/v0.349 —— ★S31 截断并把仓库留在未复原判负态 ⇒ … 归位工作区 …
6b19af4 docs: §5.348/v0.348 —— … 派 S31（B5 上半 …
$ git rev-parse HEAD
fa7bce4c593d6a4824d9eb6b8e260cbbf9647f19
$ git status --porcelain | grep -v '^??'
（空 —— 开工时无 tracked 修改）
```

**锚差异说明（非阻断）**：派单文写「HEAD 应为 `86e3a33`」，实测 HEAD = **`fa7bce4`**。核实 `git show --stat fa7bce4` = **仅** `docs/OPEN-ITEMS.md`(+2) 与 `docs/seafood.master-plan.md`(+10)，即父代理派本单时刚落下的 **docs-only 子提交**（其提交信息本身即「派 S32 ∥ S32b」）。`86e3a33` = 其**父**提交（S31 落点）。⇒ 差 1 个 docs-only 提交，**预期**，不影响本单（且 `fa7bce4` 只碰我禁改的两个 docs 文件）。

**S31 落点核实**（确认「message 契约改造」的 diff 面）：

```
$ git diff 86e3a33^..86e3a33 -- backend-ts/src/ledger-errors.ts | grep -E '^[+-]' | grep -viE 'message:|^[+-]{3}'
（仅注释 + 新增 AUTH_ERROR_MESSAGES / isAuthErrorCode / errorMessageOf；**无** classify/分桶/状态映射改动）
$ git diff --stat 86e3a33^..86e3a33 -- backend-ts/src/ledger-errors.ts      # 33 条 message 行改动（见 S31 报告 §3）
$ python3 -c "…"  # 86e3a33^ 有 CJK message（如 '可用余额不足'）；86e3a33 全英文句
```
⇒ **S31 只改 `message` 文本（+AUTH 两句 + 派生出口），未动 33 码闭集/状态映射/分桶/分类逻辑**。这决定了本单的判据面：受影响者 = 把 `message` 文本写进基线/指纹/值面的探针；键集/状态/桶面**不变**。

**非本单的在途物（开工时已存在，未触碰）**：
- 并行单 **S32**：`backend-ts/.s32-artifacts/`、`backend-ts/scripts/s32-00-senderror-inventory.ts`、`docs/audit/s32-senderror-r107-migration.md`
- S31b 残留：`backend-ts/.p3v-artifacts/p3v-00-fold-fix-verify-20261005T000252Z.json`

---

## §1 现取复核（四支）+ 穷举清单逐支判定

### 1.1 四支「它到底读了什么」现取证据

| 探针 | 现取证据（读取面） | 判定 | 与 S31b 是否一致 |
|---|---|---|---|
| `scripts/p3v-00-fold-fix-verify.ts` | `:262` `tableFp = sha256(JSON.stringify({ table: M.LEDGER_ERROR_TABLE, buckets…, codes…, defect…, benign… }))` —— `require()` 两份实现副本后把**整张表（含 message）**纳入指纹，并 `:264/265` 对拍 `table_fingerprint_baseline` vs `_fixed` | **受影响（指纹面）** | ✅ 一致 |
| `scripts/p1f-03-f3-timeouts.ts` | `:42` `import { …, LEDGER_ERROR_TABLE }`；`:657` `ledger_tx_timeout_meta: LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT`（**整条对象**，含 `message`） | **受影响（值面）** | ✅ 一致 |
| `scripts/p1n-00-cid-shape.ts` | `:38` `import { LEDGER_ERROR_TABLE }`；`:137-140` `error_table = { LEDGER_AMOUNT_INVALID: LEDGER_ERROR_TABLE.… , ×4 }`（**4 条整对象**，含 `message`） | **受影响（值面）** | ✅ 一致 |
| `scripts/p2qa-10-baseline-migration.ts` | `:125-135` `require('../src/ledger-errors')` 仅用 `LEDGER_ERROR_CODES.length / .list / .includes`、`httpStatusOf`、`LEDGER_ERROR_BUCKETS`；`LEDGER_ERROR_TABLE` **只出现在 `:126` 的类型声明**，未读 `message`。另 `fsha('src/ledger-errors.ts')`（**:66**）为**运行期**当前文件 sha（无跨版本期望） | **不受影响** | ✅ 一致 |

**复核结论：四支与 S31b 静态判定**完全一致，**无出入**（故不触发「停下报回」）。

### 1.2 穷举清单（`grep -rn 'LEDGER_ERROR_TABLE\|LEDGER_ERROR_CODES\|ledger-errors' backend-ts/scripts/*.ts` = 42 支）

> 说明：第 42 支 `s32-00-senderror-inventory.ts` 为**并行单 S32 新增文件**，非本轮 base 面，不属 S32b 判定面（登记）。

| # | 探针 | 读了什么（决定性行） | 判定 | 依据 |
|---|---|---|---|---|
| 1 | p1c-02-pool-overload.ts | `normalizeLedgerError`/`isLedgerError`；`:40` 记**入参** `e.message` | 不受影响 | 只读 `code/status` 与入参 message（非表 message） |
| 2 | p1c-03-errcause-classify.ts | `normalizeLedgerError`/`classifyNonPgError`；message 仅作**封装入参**（`:8/13`） | 不受影响 | 无表 message 出入口 |
| 3 | p1c-04-kind-enum-verify.ts | `normalizeLedgerError`；`:59` 读**入参** `e.message` | 不受影响 | 同上 |
| 4 | p1c-06-post-verify.ts | `normalizeLedgerError`；`:15-23` catch 里记**入参** `anyE.message` | 不受影响 | 同上 |
| 5 | p1f-02-f2-malformed.ts | `:171` `(LEDGER_ERROR_TABLE)[j.code]?.status` **仅 status**；`:121/148` `includes` 于 CODES | 不受影响 | 不读 message（S31b 未判定，本单补齐） |
| 6 | **p1f-03-f3-timeouts.ts** | `:657` 整条 `LEDGER_TX_TIMEOUT` | **受影响·前推** | 见 §2 |
| 7 | **p1n-00-cid-shape.ts** | `:137-140` 4 整对象 | **受影响·前推** | 见 §2 |
| 8 | p1o-00-escape-sweep.ts | `:249` `new Set(LEDGER_ERROR_CODES)`；message 记**抛出/入参**文本 | 不受影响 | 闭集 + 入参 message |
| 9 | p1t-00-bind-protocol-guard.ts | `:258` `LEDGER_ERROR_CODES.length`；`:456` 入参 message | 不受影响 | 同上 |
| 10 | p2b-01-forensics.ts | `:162` CODES.length/includes；`:124` 记 pg 入参 message | 不受影响 | 同上 |
| 11 | p2c-00-code-roundtrip.ts | `:135/230/340` 仅 `TABLE[code]?.status`；`:447` `md5('src/ledger-errors.ts')` **运行期**文件指纹（无期望值，非跨版本锚） | 不受影响 | 状态面 + 运行期自指（S31b 未判定，本单补齐） |
| 12 | p2qa-01-sigma-conservation.ts | `normalizeLedgerError`/`httpStatusOf` | 不受影响 | 无表 message |
| 13 | p2qa-02-rounding-renorm.ts | `LedgerError`/`isLedgerError` | 不受影响 | 同上 |
| 14 | p2qa-03-chain-depth-guard.ts | `LedgerError`/`isLedgerError` | 不受影响 | 同上 |
| 15 | p2qa-04-idempotency-policy.ts | `LedgerError`/`isLedgerError` | 不受影响 | 同上 |
| 16 | p2qa-06-levels10-tail.ts | `LedgerError`/`isLedgerError` | 不受影响 | 同上 |
| 17 | p2qa-10-baseline-migration.ts | CODES/httpStatusOf/buckets；TABLE 仅类型声明 | 不受影响 | 见 §1.1（S31b 已判，本单实跑复核） |
| 18 | p2qa-11-f1-f7.ts | `LedgerError`/`isLedgerError`/`httpStatusOf` | 不受影响 | 无表 message |
| 19 | p2qa-13-assert-matrix.ts | `:51` CODES.length；`:55` `hasOwnProperty(TABLE,'LEDGER_RECONCILE_MISMATCH')`；BUCKETS/httpStatusOf | 不受影响 | 键集/桶/状态（S31b 未判定，本单补齐） |
| 20 | p2qa-14-replay-guard.ts | `isLedgerError`/`LedgerError`/`normalizeLedgerError` | 不受影响 | 无表 message |
| 21 | p3s-00-500-rca-probe.ts | `:377` 记**入参** `input_message_kept`；`:381` 判 `details` 是否含入参 message；**无** `le.message` | 不受影响 | 不记表 message |
| 22 | **p3s-03-fold-repro.ts** | `:88` `mapped_message: le.message`（= `LEDGER_ERROR_TABLE[code].message`）写入产物 | **受影响（值面·记录型）** | 见 §1.3 |
| 23 | p3t-00-fold-fix-verify.ts | `:306` `LE.LEDGER_ERROR_CODES.length`；message 仅**夹具入参** | 不受影响 | 闭集 + 入参 |
| 24 | **p3v-00-fold-fix-verify.ts** | `:262` 整表指纹 | **受影响·前推** | 见 §2 |
| 25 | p3w-00-fold-narrow-verify.ts | 加载 ledger-errors 副本对**分类行为**对拍；`sha256` 于**实现副本文件**（非表指纹） | 不受影响 | 无表 message/表指纹 |
| 26 | p3w-01-narrow2-verify.ts | 同上 | 不受影响 | 同上 |
| 27 | p4z-d1p-01-classifier-unit.ts | `:69` `Object.keys(TABLE).sort()`；`:72` `TABLE[c].status !== SNAPSHOT_STATUS[c]` | 不受影响 | 键集/状态（S31b 未判定，本单补齐） |
| 28 | **p4z-errfid-01-mech.ts** | `:85` `normalizeLedgerError: { …, message: norm.message }` 经 `:139` `rec.chain=outward(e)` ⇒ `:145` `writeFileSync` 落盘 | **受影响（值面·记录型）** | 见 §1.3 |
| 29 | p4z-qa-b3-04-ld-census.ts | `:21` `readFileSync('src/ledger-errors.ts')`；`:32` 正则**仅捕 `{ status: …`**（`:32` `^\s*([A-Z…]+):\s*\{\s*status:\s*(null|\d+)`） | 不受影响 | 只解析 status；行格式 `{ status:N, message:'…' }` 未变（S31b 未判定，本单补齐） |
| 30 | p4z-sec-01-verify.ts | `normalizeLedgerError`/`toErrorResponse`/`ledgerErrorDiagnostics`，取 `code/httpStatus/*_class` | 不受影响 | 不读表 message |
| 31 | p7b-03-offline-gates.ts | `:132` `LEDGER_ERROR_CODES.length === 33` | 不受影响 | 闭集 |
| 32 | p8-s10-invite-reward-gate.ts | `:292` CODES.length；`:401` 断言 `negOut.message === 'LEDGER_RESERVED_UID'` —— 系**事务内 DB 侧 RAISE 文本**（机器码），**非** TS 表 message | 不受影响 | 断言的是 DB 契约，S31 未动 |
| 33 | p8-s11-audit-console-gate.ts | `:300` CODES.length / includes；`:194` 只查 `err.message` 的 **typeof** | 不受影响 | 闭集 + 形状 |
| 34 | p8-s4-currency-review-gate.ts | `:231/233` CODES.includes / length===33 | 不受影响 | 闭集 |
| 35 | p8-s5-compliance-gate.ts | `:268/270` CODES.includes / length===33 | 不受影响 | 闭集 |
| 36 | p8-s6-site-text-gate.ts | `:360/373` CODES.length / includes | 不受影响 | 闭集 |
| 37 | p8-s7-batt-checkin-gate.ts | `:270/533/539` CODES.includes / length | 不受影响 | 闭集 |
| 38 | p8-s8-rating-timeliness-gate.ts | `:430/432` CODES.length / includes | 不受影响 | 闭集 |
| 39 | p8-s9-bttc-gate.ts | `:359/361` CODES.length / includes | 不受影响 | 闭集 |
| 40 | **qa-p1b-06-lock-deadlock.ts** | `:164` `normalized_to_s14: { code, status, message: norm.message }` 写入产物 | **受影响（值面·记录型）** | 见 §1.3 |
| 41 | qa-p1e-00-baseline.ts | `:31` `sha('src/ledger-errors.ts')`等**运行期**文件 sha（无期望值） | 不受影响 | 非跨版本锚 |
| 42 | s32-00-senderror-inventory.ts | 并行单 S32 新增文件 | **不在本单面** | 登记 |

**合计**：受影响 **6**（前推/改锚 3 + 值面记录型 3）；不受影响 **35**；不在本单面 1。

### 1.3 三支「值面·记录型」的判定依据（登记，不改）

`p3s-03` / `p4z-errfid-01` / `qa-p1b-06` 都把 `le.message`（= `LEDGER_ERROR_TABLE[code].message`，S31 后为英文句）写入自己的产物 JSON。判定 **受影响（值面）**，但**登记不改**，依据三条：

1. **非锚定**：写的是**运行期**当前 src 的派生值 —— 重跑即刷新，**无跨版本期望值**可比，不存在「旧中文句 vs 新英文句」的失配。
2. **无断言**：该字段不入任何 red/green 判据（三支的判据面均只用 `code/status/details/class`）。
3. **改结构会孤立 docs 引用**：其字段名被审计件引用（`docs/audit/p3-p1o-500-rca.md`、`docs/audit/p4-err-fidelity.md`、`docs/qa/p1-ledger-concurrency.md`），而本单**禁改 docs**；删改字段会制造**新的**漂移。

⇒ 属「受影响但无需前推」；如需彻底去 message，建议另单（连同 docs 引用）一并处理。

> 与 3 支被要求前推（p1f-03/p1n-00）的差别：那两支把**冻结契约对象 `LEDGER_ERROR_TABLE.CODE`（整条 = 契约面）**直接钉进产物，是「以本次无关的字段充当锚」的典型；本单按父代理指派将其改锚到稳定量。

---

## §2 前推/改锚逐处（旧值 / 新值 / 出处）

出处统一 = **S31 的 `message` 契约改造**（`86e3a33`：`src/ledger-errors.ts` 33 条 `LEDGER_ERROR_TABLE` message 中文句 ⇒ 稳定英文句；`AUTH_ERROR_MESSAGES` 两条同形句）。**原则**：把断言/对拍量从「整表指纹 / 整条 message 字面」收窄为**与本次无关的稳定量**（code 集合 / status 映射 / 键集），**非放宽**（见各条「为何不是放宽」）。

### 2.1 `scripts/p3v-00-fold-fix-verify.ts`
- **旧值**：`tableFp = sha256(JSON.stringify({ table: LEDGER_ERROR_TABLE, … }))` —— 整表**含 message**；`table_fingerprint_baseline/fixed` 用它。
- **新值**：`tableFp` 改为**与 message 无关的稳定投影**（键集 `codes` + 状态映射 `status` + `buckets/defect/benign`）；**保留留痕** `tableFpMessageInclusive` 于 `table_fingerprint_message_inclusive_baseline/fixed`。
- **附带前推**：`L6.expected_worktree_sha256` `9bc127e4…`（P3V 落点，早陈旧）⇒ `7c48d8c3…`（现盘 = S31 落点）。头注释加 S32b 段。
- **为何不是放宽**：本单元（P3V = 非 PG 事件族**分类修复**）该不变的量是「码表键集/状态/桶」，`message` 文本属 S31 独立契约（§3.3 条款 9′），**不属本单元对拍面**；判据面从「含 message 的整表」**收窄**到本单元真正应不变者，message 的稳定性由 S31 自己的类级探针/判负负责。

### 2.2 `scripts/p1f-03-f3-timeouts.ts`
- **旧值**：`:657` `ledger_tx_timeout_meta: LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT`（整条，含 `message`）。
- **新值**：`ledger_tx_timeout_meta: { code: 'LEDGER_TX_TIMEOUT', status: LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT.status }` + 出处注释。
- **为何不是放宽**：该读数的语义是「503 基础设施通路（LEDGER_TX_TIMEOUT）」—— `status` 即其判据；`message` 文本与该通路无关。**无断言**依赖旧整条对象（已现取核：§3 的 targeted 验证 new_value 不含 message、status=503 保持）。

### 2.3 `scripts/p1n-00-cid-shape.ts`
- **旧值**：`:137-140` `out.error_table = { <CODE>: LEDGER_ERROR_TABLE.<CODE> , ×4 }`（4 条整对象，含 `message`）；段原注释即「错误码表（**status 逐字**）」。
- **新值**：`out.error_table = { <CODE>: { status: LEDGER_ERROR_TABLE.<CODE>.status }, ×4 }` + `out.error_table_note`（出处）。
- **为何不是放宽**：该段**本就以 status 为对拍量**（注释原文），整条对象是过宽；收窄到 status 与其语义一致，message 文本与 cid 形状闸无关。**无断言**依赖 message。

---

## §3 逐支跑读数（能跑真跑 / 需库说明）

### 3.1 `p3v-00`（纯函数·零 DB）—— 真跑 before/after + 判负
```
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
```
| 轮次 | 产物（已归档 `.s32b-artifacts/<runid>/probe-artifacts/`） | `table_fingerprint`（baseline vs fixed） | `tableFpSame` |
|---|---|---|---|
| **before**（改前旧码） | `p3v-00-…-20261005T001048Z.json` | `77af0b20…` vs `f52643f6…` | **false** |
| **after**（改后·稳定投影） | `p3v-00-…-20261005T001315Z.json`（=`…T001409Z` 复原轮同值） | **`edbd6ca1…` vs `edbd6ca1…`** | **true** |
| message-inclusive 留痕 | 同上 | `77af0b20…` vs `f52643f6…` | false（**预期**，S31 所致） |

```
L4 closed_set baseline=33 fixed=33 tableFpSame=true (stable 投影；message-inclusive same=false)
```
> ⚠️ 同轮 `L6.verdicts.fixed_green=false`（RED 集 = `Y3_type_error_no_message`,`Y6_proto_getter_only_message`）。**与 `message` 无关，非本单**：`978ea4a`（Unit I 判据② 收窄，2026-09-29）后 `{type:'error'}` 无 message 应回 500，本探针 Y3/Y6 期望随之陈旧（对照 `20260928T160137Z` 旧件 `fixed_green=true`）。**不在 B15 面**，**未改**（改期望 = 动另一单元判据 = 凑绿，明禁）。

### 3.2 `p1n-00`（连库·**零写入**）—— 真跑
```
$ node_modules/.bin/ts-node --transpile-only scripts/p1n-00-cid-shape.ts --phase revert
```
- `WROTE …/p1n-tocid-shape-revert-I0434.json`；`rows_touched = { ledger_entry_before: "502", ledger_entry_after: "502", wrote_nothing: true }`（**零残留**自证）。
- `error_table`（新值面）= `{ LEDGER_AMOUNT_INVALID:{status:400}, LEDGER_AMOUNT_NOT_POSITIVE:{status:400}, LEDGER_CURRENCY_NOT_FOUND:{status:404}, LEDGER_RESERVED_UID:{status:400} }`（**不含 message**）。
- 用例行为核对（不受 message 影响）：`A1 getCurrency(0)` ⇒ `LEDGER_CURRENCY_NOT_FOUND/404`；`A12 transfer(cid='')` ⇒ `LEDGER_AMOUNT_INVALID/400`；`A14 transfer(cid='-5')` ⇒ `LEDGER_CURRENCY_NOT_FOUND/404`。

### 3.3 `p2qa-10`（连库·只读·"不受影响"实证）—— 真跑
```
$ node_modules/.bin/ts-node --transpile-only scripts/p2qa-10-baseline-migration.ts
```
- `error_code_count = 33`；`triggers_all_enabled_O = true`；`schema_version_max = 0043`；`head = fa7bce4`。
- `file_sha256['src/ledger-errors.ts'] = 7c48d8c3…`（= 运行期现盘读数，**无期望值**，随 S31 变化属预期）⇒ **绿**，印证「不读 message」。

### 3.4 `p1f-03`（连库·**写测试数据·重**）—— 全量运行 `NOT_MEASURED` + **受影面定向实测**
- **未跑**（原因见 §5）：其分区分 `uid 944xxx / symbol p1k*`，全量运行会向 `ledger_entry` **新增**行（append-only 触发器禁 DELETE）⇒ **无法满足「跑完无残留」**。
- **替代实证**（覆盖本单真正受影面 = `:657` 单行投影，纯函数）：`s32b-targeted-projection-verify.ts`（进程内 import `src/ledger-errors` 只读）读数：
```json
{ "p1f03": { "old_value": { "status": 503, "message": "The system is busy, please try again later" },
             "new_value": { "code": "LEDGER_TX_TIMEOUT", "status": 503 },
             "old_carries_message": true, "new_carries_message": false, "status_unchanged": true },
  "p1n00": { "old_carries_message": true, "new_carries_message": false },
  "verdict": { "p1f_new_is_message_free": true, "p1n_new_is_message_free": true, "p1f_status_503_preserved": true } }
```
- 语法检查：三支改后脚本 `ts.transpileModule` 诊断 **0**。

### 3.5 其余 35 支「不受影响」
- 逐支读面见 §1.2；引用面为 `LEDGER_ERROR_CODES`（闭集/长度）、`LEDGER_ERROR_TABLE[code].status`、`httpStatusOf`、`LEDGER_ERROR_BUCKETS`、或**入参/DB 侧** message —— 均**不随 S31 的 message 文本变化**。**未逐支运行**（多数需库/重）：见 §5。

---

## §4 判负（红 → 绿）

**主控（`p3v-00` 的集成对拍量 `tableFpSame`）**：把**旧值（含 message 的整表指纹）临时放回** `table_fingerprint_baseline/fixed`：

```
$ # 临时：table_fingerprint_{baseline,fixed} := tableFpMessageInclusive(...)
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
L4 closed_set baseline=33 fixed=33 tableFpSame=false (stable 投影；message-inclusive same=false)   # ← 必红 ✅
$ # 复原：table_fingerprint_{baseline,fixed} := tableFp(...)
$ node_modules/.bin/ts-node --transpile-only scripts/p3v-00-fold-fix-verify.ts
L4 closed_set baseline=33 fixed=33 tableFpSame=true  (stable 投影；message-inclusive same=false)   # ← 回绿 ✅
```
- 旧值读数 `77af0b20…` vs `f52643f6…`（改前/判负轮）**必红**；复原后 `edbd6ca1… vs edbd6ca1…` **回绿**。工件：`p3v-00-NC-red.stdout.txt` / `p3v-00-NC-restored.stdout.txt`（及对应 `.json`）。

**辅证（`p1n-00` 值面）**：把 `error_table` **临时复原为 4 条整对象** ⇒ 产物重新携带 message（`old_carries_message=true`，读数见 §3.3 工件 `p1n-00-NC-oldvalue.txt`）；复原为 `{status}` ⇒ `new_carries_message=false`（§3.2）。**已复原**。

> 复原核：`git diff` 显示三支脚本仅含 S32b 目标改动（无 NC 残迹）；`p3v-00`/`p1n-00` 末轮均跑通。

---

## §5 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 |
|---|---|---|
| `p1f-03` **全量运行** | `NOT_MEASURED` | 连库 + 写测试数据（`uid 944xxx/symbol p1k*`），`ledger_entry` append-only ⇒ 无法「跑完无残留」；其失败路径另写 `.p1f-artifacts/p1f03-f3-readings.partial.json`（未跟踪）。**受影面已用 §3.4 定向实测覆盖**（新值不含 message / status 503 保持 / 键集与状态映射不变）。 |
| `p1f-03` 其余 5 段（锁/死锁/预算/链） | 未跑 | 与本单（message）无关；重且有库副作用。 |
| §1.2 中多数「不受影响」支 | 未运行 | 多为需库/重探针；已**现取静态**判定读面（§1.2 逐行），与 S31 diff 面无交。 |
| 3 支「值面·记录型」(`p3s-03`/`p4z-errfid-01`/`qa-p1b-06`) 去 message | 未改 | 见 §1.3（非锚定/无断言/改结构会孤立 docs 引用且本单禁改 docs）。 |
| `p3v-00` 的 `Y3/Y6` 陈旧期望（`fixed_green=false`） | 未改 | 属 **Unit I 判据收窄**（`978ea4a`）的漂移，**非 `message` 面**；改期望 = 动另一单元判据。登记。 |

---

## §6 自曝（诚实面）

1. **锚差**：派单写 HEAD=`86e3a33`，实测 `fa7bce4`（docs-only 子提交，差 1）。已核为预期、不阻断（§0）。
2. **`p3v-00` 的 `fixed_green=false` 是**既有**漂移**（Unit I），**非本单**。本单给的「绿」= **S32b 面** `tableFpSame=true`（+ 判负红→绿）。若父代理要求该探针整体 `fixed_green=true`，那是**另一单元**的探针维护，不在 B15。
3. **`p3v-00` 的 `expected_worktree_sha256` 前推**仅同步到现盘（`7c48d8c3…`）；它**从不**参与 red/green（仅留痕），故非「验收门」（与 S31b §4.4 判定一致）。
4. **`p1n-00` 我跑了 3 次**（新值 / NC旧值 / 复原），均 `wrote_nothing=true`；运行产生的 `p1n-tocid-shape-revert-*.json` **已从 `.p1f-artifacts/` 迁入** `.s32b-artifacts/<runid>/probe-artifacts/`，工作树不留我的散件。
5. **穷举面 42 支中的 `s32-00-senderror-inventory.ts`** 系并行单 S32 新增，未判（登记）。
6. **最近似「误判风险」的一支** = `p8-s10`（`:401` 断言 `message === 'LEDGER_RESERVED_UID'`）：它断言的 message **看似**表 message，实为**事务内 DB 侧 RAISE 文本（机器码）**，与 S31 的 TS 表 message 是**两个契约** ⇒ 判「不受影响」。若 DB 侧 message 将来也改单，该支会受影响（**非 S31**）。
7. **未纳入穷举的其他同族**：`grep` 面外仍有引用 `src/ledger-errors` 的探针（如 `p3q/p3r/p4z-b2c/p4z-b3e/p4z-b5sv` 等 `grep -rln ledger-errors` 的**非 scripts/** 或本 grep 未捕获者）—— 本单按派单口径以 `LEDGER_ERROR_TABLE|LEDGER_ERROR_CODES|ledger-errors` 于 `backend-ts/scripts/*.ts` 穷举；如需更宽面，另单。

---

### 附：产物清单（`backend-ts/.s32b-artifacts/20261005T001043Z/`）
- `probe-artifacts/p3v-00-fold-fix-verify-20261005T001{048,315,402,409}Z.json`（before/after/NC-red/NC-green）
- `probe-artifacts/p1n-tocid-shape-revert-{HY1LA,HZDC9,I0434}.json`（after/NC-old/final）
- `probe-artifacts/p2qa-10-baseline-migration-20261005T001632Z7cmw.json`
- `s32b-targeted-projection-verify.{ts,json,stdout.txt}`、`p3v-00-{before,after,NC-red,NC-restored}.stdout.txt`、`p1n-00-{after,final,NC-oldvalue}.stdout.txt`、`p2qa-10-run.stdout.txt`
