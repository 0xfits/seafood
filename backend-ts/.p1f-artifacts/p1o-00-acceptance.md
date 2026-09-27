# P1o 验收报告 · 读路径「超 `bigint`」逃逸回归的**按类修** + 逃逸扫描取证

- **HEAD（开工时 = 收工时）**：`e54fa86 fix(ledger): 回退 toCid 错改（404 恢复，与 DB 侧逐字一致）+ spec v0.5 枚举 cid/uid 分类边界`
- **规格依据**：`docs/ledger.spec.md` §14.3 **v0.6 增补块 (A) ③④ / (B)** + §19.10.D（`docs/**` 本单**未改动**）
- **改动文件**：`backend-ts/src/ledger.ts`（131 插入 / 32 删除）、`backend-ts/scripts/p1o-00-escape-sweep.ts`（**新增**）
- **未新建迁移、未改 `migrations/**` / `schema_migration` / `docs/**` / `frontend/**` / 质检资产；未 commit**

---

## 1. 结论（三条硬判据的修前 / 修后原始读数）

| 判据 | 修前 | 修后 |
|---|---|---|
| `raw_sqlstate_escapes` | **33**（`22003` ×30 + `22P02` ×2 + `23503` ×1） | **0** |
| `unmapped`（code ∉ 33 码关闭集） | **33** | **0** |
| `missing_status` | 0 | 0 |
| 逐格期望不符（`expectation_mismatches`） | 154 | **0** |
| `unexpected_500` / `ld_sqlstate_leaked` / `valid_shape_false_reject` | 0 / 0 / 0 | 0 / 0 / 0 |
| `ledger_entry` 前后行数（不写账本行自证） | 240 → 240 | 166 → 166 |

**母缺陷复现（同一入口点、同一入参）**——`getCurrency('99999999999999999999999')`：

| | code | status | mapped | reason | field | message |
|---|---|---|---|---|---|---|
| 修前 | `22003` | `null`（undefined） | `false` | — | — | `value "99999999999999999999999" is out of range for type bigint` |
| 修后 | `LEDGER_AMOUNT_INVALID` | **400** | `true` | `OUT_OF_BIGINT_RANGE` | `cid` | `金额格式不正确` |

**真源（run-tagged，均在 `backend-ts/.p1f-artifacts/`）**
- 修前：`p1o-00-escape-sweep-before-MUJJBPT2.json`（终版脚本复跑；首轮 `p1o-00-escape-sweep-before-MUJIUD5J.json` 读数同：33/33/0）
- 修后：`p1o-00-escape-sweep-after-MUJJ2PHX.json`
- 两次读数由**同一份脚本**（`scripts/p1o-00-escape-sweep.ts`，同一组用例）产出；修前一轮是 `git checkout -- src/ledger.ts` 临时还原到 HEAD 后跑的，跑完已还原修复版并核对 md5（`9456b5cb72a3a42dd3de26069429ee67`）。

---

## 2. 事一 · 入口点清单（所有接收外部 `cid` / `uid` / 金额的导出入口点）+ 闸位

闸 = **`toAmount`（唯一共用形状闸）** ⇒ `toCid` / `toUid` / `assertUserUid` / `entryToPayload` / `normalizeRef` / `amountToPayload` 全部经它；脚本矩阵按此逐格跑（604 格，590 实跑 + 14 纪律跳过）。

| # | 入口点 | 路径 | 外部入参 | 碰 PG 前的闸 | 修前 | 修后 |
|---|---|---|---|---|---|---|
| E-R1 | `getCurrency(cid, tx?)` | 读 | cid | `toCid→toAmount` | **22003 ×3 格** | 400 `OUT_OF_BIGINT_RANGE` |
| E-R2 | `getAccount(uid, cid, tx?)` | 读 | uid, cid | `toUid`+`toCid` | **22003 ×6** | 同上 |
| E-R3 | `listEntriesByAccount(uid, cid, beforeTxid, limit, tx?)` | 读 | uid, cid, beforeTxid,（limit 另见 §7） | `toUid`+`toCid`+`toAmount` | **22003 ×9** | 同上（`limit` 另修，见 §7） |
| E-R4 | `getCurrencyBySymbol(symbol, tx?)` | 读 | symbol（文本列谓词） | 无（**对照组**，无数字转型） | 0 | 0 |
| E-R5 | `findEntriesByIdempotencyKey(key, tx?)` | 读 | key | `normalizeIdempotencyKey` | 0 | 0 |
| E-R6 | `findAccountDrift()` / `sumAccountTotals()` / `getSystemCurrency()` | 读 | —（无外部入参） | n/a（登记为对照，不扫描） | — | — |
| E-W1 | `transfer(input)` | 写 | fromUid, toUid, cid, amount | `assertUserUid`+`toCid`+`toAmount` | 0（写路径本已由 DB 闸兜住） | 0（现在**先于 PG** 拒绝） |
| E-W2 | `mint(input)` | 写 | uid, cid, amount | `toUid`+`toCid`+`toAmount` | 0 | 0 |
| E-W3 | `freeze(input)` | 写 | uid, cid, amount, businessFrozenCap | `assertUserUid`+`toCid`+`toAmount` | 0 | 0 |
| E-W4 | `unfreeze(input)` | 写 | uid, cid, amount | 同 freeze | 0 | 0 |
| E-W5 | `settleFrozen(input)` | 写 | fromUid, toUid, cid, amount | `toCid`+`assertUserUid`+`toAmount` | 0 | 0 |
| E-W6 | `postEvent(payload)` | 写 | fromUid, toUid, cid, amount | 同族（写路径公共底层） | 0 | 0 |
| E-W7 | `getOrCreateAccount(uid, cid, tx?)` | 写 | uid, cid | `toUid`+`toCid` | **22003 ×6 + 23503 ×1** | 400 / **404** |
| E-W8 | `ensurePlatformAccounts(cid, tx?)` | 写 | cid | `toCid` | **22003 ×3** | 400 |
| E-W9 | `lockAccounts(tx, targets)` | 写 | uid, cid | `toUid`+`toCid` | **22003 ×3** | 400 |
| E-W10 | `parseUserAmount(v, decimals, field, cid?)` | 原语 | amount | 自身（R72；1e15 上限 < bigint ⇒ 本已无 22003 面） | 0 | 0 |
| E-W11 | `toAmount(v, field)` / `assertUserUid(uid, field?)` | 原语 | cid, uid, 金额 | **自身 = 唯一共用闸** | 22003 面源头 | 400 |

> `E-W8` / `E-W9` 的**形状合法格**（会为平台 uid 建账户 / 会开户）按测试数据纪律**跳过**（14 格，读数里标 `SKIPPED`）；其余各格全部实跑。`E-W7` 的形状合法格按 R75 语义会建 `0/0` 账户行（**不写账本行**），已登记见 §6。

---

## 3. 事二 · 逃逸扫描脚本

`backend-ts/scripts/p1o-00-escape-sweep.ts`
用法 `npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase before|after [--assert]`；
**落盘文件名一律带 phase + run tag**（`p1o-00-escape-sweep-<phase>-<RUN>.json`），并在写盘前 `existsSync` 拒写，**永不写固定文件名**。

- 矩阵 = **入口点 × 输入形状**：形状集 = 正常值 / 非十进制 / 空串 / 非字符串（对象·布尔）/ `undefined` / `0` / 负数 / `bigint` 下限 / `bigint` 上限 / **`bigint` 上限 +1** / **超 `bigint` 一大截（23 位）** / **`bigint` 类型本身越界（`BigInt('9'×25)`）** / 科学计数法 `1e5` / 前后空格 / JSON number 0 / 非安全整数 `1e23`。
- 每格机读字段：`{entry, path, field, input_shape, input_value, input_type, thrown, outcome, code, status, mapped, in_closed_set, raw_sqlstate, ld_sqlstate_leaked, reason, details_field, details, message, returned, expected, verdict, elapsed_ms}`。
- 汇总判据：`raw_sqlstate_escapes` / `unmapped` / `missing_status`（+ `ld_sqlstate_leaked` / `unexpected_500` / `expectation_mismatches` / `valid_shape_false_reject`）；`--assert` 下任一非 0 即退出码 1（修后 `--assert` 退出码 **0**）。
- 修前 33 格逃逸的**分型**（`escape_cells`）：`22003` 全部落在 3 种形状 × 标识符字段（cid / uid / beforeTxid）上；`22P02` 2 格 = `limit` 为 `NaN`/`'abc'`；`23503` 1 格 = `getOrCreateAccount(cid=9223372036854775807)` 的 `account_cid_fkey`。
- DB 侧对拍（同脚本内 `db_side`）：`ledger_int_amount` / `ledger_cid_arg` 同形状读数（见 §5）。

---

## 4. 事三 · `reason` 名对齐（实测）

| 场景 | TS 修前 | TS 修后 | DB 侧（同场景） |
|---|---|---|---|
| `cid` 缺失（`undefined`） | 400 / `BAD_TYPE` | **400 / `MISSING`** | `LD016` / 400 / `MISSING` ✅ 逐字一致 |
| `cid` 非字符串（对象 / 布尔） | 400 / `BAD_TYPE` | **400 / `NOT_STRING`**（+`provided_type`） | `LD016` / 400 / `NOT_STRING` ✅ |
| 超 `bigint`（19 位以上） | **`22003` / status undefined** | **400 / `OUT_OF_BIGINT_RANGE`** | `LD016` / 400 / `OUT_OF_BIGINT_RANGE`（`BIGINT_MAX+1`）/ `OVER_MAX_SINGLE_AMOUNT`（23 位，见 §8） |

- 状态类**未变**（全部 400 `LEDGER_AMOUNT_INVALID`）；`reason` 取值仍在四值集 `{NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` 内，**未新增/删除 reason、未新增错误码**。
- `ledger_parse_user_amount` 同族对齐：`undefined` ⇒ `MISSING`、其余非字符串 ⇒ `NOT_STRING`。
- **登记项**：`cid = 0`（JSON **number**）修前修后均为 `404 LEDGER_CURRENCY_NOT_FOUND`（与 `§19.9.F` 对拍表的 ✅ 行一致）⇒ TS 的 `number` 分支**未**改成 `NOT_STRING`（`Amount = bigint｜number｜string` 是既有契约，且实测走的是存在性判定）。规格 (B) 括号里的「数字」在本实现中不落 `NOT_STRING`，请 Zang 裁定是否要改（改则 `cid = 0`（number）会由 404 变 400）。

---

## 5. 代码变更（`backend-ts/src/ledger.ts`，逐条）

1. **`toAmount` 加真 `bigint` 范围闸**（`bigint` 分支 + 十进制字符串分支都查）：越界 ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason=OUT_OF_BIGINT_RANGE` + `{field, value(≤40 字符)}`（与 DB `ledger_int_amount` 同码同形）。**这是按类修的关键**：`toCid`/`toUid`/`assertUserUid`/`entryToPayload`/`normalizeRef`/`amountToPayload` 全部经此闸 ⇒ 读 + 写 11 个入口点一次收敛。
2. **`toAmount` / `parseUserAmount` 的 `reason` 名对齐**（件 ③）：缺失 ⇒ `MISSING`；其余非字符串类型 ⇒ `NOT_STRING`（+`provided_type`）。
3. **账户自建路径错误收敛**（`lockAccounts` / `getOrCreateAccount` / `ensurePlatformAccounts`，新增 `withLedgerErrorMapping`）：`cid` 形状合法但不存在时 `account.cid→currency(cid)` 外键炸出的裸 `23503` 原先直接逃到调用方 ⇒ 现交 `normalizeLedgerError` 归 `LEDGER_CURRENCY_NOT_FOUND` **404**（§14.3 枚举块 ②）。
4. **`listEntriesByAccount` 的 `limit` 闸**（附带发现）：`NaN` / 非数值原先被发成 `LIMIT "NaN"` ⇒ 裸 `22P02`；现非有限值取默认 50，仍钳 `[1,200]`。
5. 文件头增「P1o 收口」变更登记块（逐条对外契约变化）。

---

## 6. 验收回归读数（原始退出码/读数）

| 项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `./node_modules/.bin/tsc --noEmit` | **exit 0 / 0 error**（`.p1f-artifacts/p1o-tsc.txt`，0 字节） |
| 冒烟（公开 API） | `scripts/ledger-smoke.ts` | **exit 0 / passed 29, failed 0**（run `ujj741s`，`p1o-smoke-api.log`） |
| 冒烟（DB 层） | `scripts/ledger-smoke-db.ts` | **exit 0 / passed 11, failed 0**（`p1o-smoke-db.log`） |
| F1 回归 | `scripts/p1f-01-f1-collision.ts --assert` | **exit 0 / verdicts 14/14 true, failures []**（run `MUJJ8XY2`，`p1o-f1-after.log`） |
| F2 回归 | `scripts/p1f-02-f2-malformed.ts --assert` | **exit 0 / 52 例：`unmapped_escape=0`、`status_500=0`、`not_in_closed_set=0`、`accepted_200=[M32_from_uid_spaces]`、`pass=true`**（`p1o-f2-after.log`） |
| 逃逸扫描（修后 + 断言） | `p1o-00-escape-sweep.ts --phase after --assert` | **exit 0 / 0 / 0 / 0** |

## 7. 测试数据（本单新增，可查可核；**未删任何既有数据**）

- `currency`：`P1PMUJIUD5J`(cid **114**，首轮修前) / `P1PMUJJ2PHX`(cid **115**，修后) / `P1PMUJJBPT2`(cid **123**，终版修前) —— owner `948001`、decimals 2、listed、`total_supply=0`。
- `account`：上述 3 个币上各 4 行 `0/0`（uid `-5` / `0` / `948001` / `9223372036854775807`）—— 来自 `E-W7 getOrCreateAccount` 的**形状合法格**（R75「不存在就开户」语义，**这条路径必然写账户行**）与写路径的边界 uid 单元格。**登记项：其中 uid `0` 属预留平台主体**，但它只在这 3 个一次性测试币上（`0/0`、无价值、非 cid=1）。
- **`ledger_entry`：本单 0 行**（`P1P%` 币上账本行 = 0；两次扫描各自 `ledger_entry` 前后行数相等）。
- **`cid=1` 与平台账户未被触碰**：`currency#1` = `$` / `total_supply=3600` / listed（未变）；`account` 中 uid `0/-1/-2/-3` × `cid=1` 四行均 `0/0`（未变）。
- 原始读数：`.p1f-artifacts/p1o-00-testdata.json`。

## 8. 残留 / 未核对（如实登记）

1. **DB 侧「23 位」的 `reason` 名残差**：`ledger_int_amount('99999999999999999999999','cid')` = `LD016` / 400 / **`OVER_MAX_SINGLE_AMOUNT`**（0005 先查「长度 > 19」再查真范围 ⇒ 19 位的 `BIGINT_MAX+1` 才给 `OUT_OF_BIGINT_RANGE`）；TS 侧现按 §14.3 v0.6 (A)③ 的**范围**定义一律给 `OUT_OF_BIGINT_RANGE`。⇒ **同码同 status（400 `LEDGER_AMOUNT_INVALID`），仅 `reason` 名不同**；`migrations/**` 本单禁改，故登记为残差待裁定（若要两侧逐字一致，需改 0005 的判定顺序，属另单）。
2. **金额字符串（`amount`）的超界 reason 由 DB 决定**：`amount='99999999999999999999999'` ⇒ `OVER_MAX_SINGLE_AMOUNT`（TS 不解析 `amount` 字符串，换算权在 DB/decimals）⇒ 扫描里对 `amount` 字段同时接受二者。
3. **`parseUserAmount('1e5')` 的 reason 名两侧不同**（TS `NOT_DECIMAL_STRING` ↔ DB `EXPONENT_NOT_ALLOWED`）：同码同 status，且该函数不在写路径上（写路径的 `amount` 字符串直交 DB）⇒ 本单未改、未纳入件 ③。
4. **未做「读路径 blanket 错误归一化」**：本单把防线放在**形状闸**（碰 PG 之前）+ 账户自建路径的归类；`getCurrency`/`getAccount`/`listEntriesByAccount` 等纯读入口点**未**再套 `normalizeLedgerError`（避免扩大改动面与既有读数）。⇒ 若将来出现新的、闸未覆盖的入参形状，仍可能原样逃出 —— 由本扫描脚本作回归闸门。
5. `E-R3_limit` 与 `getOrCreateAccount` 的 `23503` 是**扫描顺带发现**（不在「cid/uid/金额」声明类内 / 属存在性类），已一并修并登记。
6. `E-W8`/`E-W9` 的 14 格按纪律**跳过未跑**（形状合法格会写平台/账户行）。
