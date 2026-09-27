# P2C-00 · 错误码正反向映射不对称修复 + 「33 码全量往返闭合测试」交付报告

- **单号**：R3-P2c-0（`docs/seafood.master-plan.md` §5.22 裁定 1/2/3、§6 排期表「R3-P2b-2 反向映射闭合」）
- **仓库**：`/Users/kevin/bistro/seafood`（后端 `backend-ts/`）
- **HEAD（开工时）**：`4dd1ef5 master-plan v0.26: §5.22 验收 0007/0008 + 新缺陷（反向映射缺 LD031-LD033）+ 裁定新增 33 码往返闭合测试`
- **角色**：Kong（实现者）。**未 commit / 未 push**；未改 `0001`–`0008`；未改质检资产与既有读数文件；未动 P2 业务层。
- **run tag**：修前 `MUJNM9EO` / 修后 `MUJNPUO4`（往返脚本自带 run tag；两轮都由**同一份终版脚本**产出）

---

## 0. 一句话结论

反向映射的缺口**比派单里说的更大**：不是「缺最后三码」，而是 `ledger_error_for_sqlstate` 对
**全部 33 个自家码（`LD001..LD033`）一条分支都没有** —— 只是最后三码此前**从未被真正抛过**，
所以 Zang 的探针只在那三码上看到症状。修前实测 `roundtrip_mismatches = 32`（唯一「对上」的
`LD024` 是**撞名**：兜底码恰好也叫 `LEDGER_TRANSACTION_REQUIRED`，非真闭合）。`0009` 补齐 33 条后
**四条硬判据全部归零**，且原生 SQLSTATE 侧映射**逐格未扰动**（frozen `p1f-02` 的 52 例与 40 个
SQLSTATE 抽样全绿）。

| 判据 | 修前（`MUJNM9EO`，0009 未应用 / TS 未改） | 修后（`MUJNPUO4`） |
|---|---|---|
| `roundtrip_mismatches` | **32** | **0** |
| `unknown_codes` | 0 | **0** |
| `bucket_violations` | **54** | **0** |
| `null_status_defect` | **27** | **0** |
| `closed_set_size_ts / db` | 33 / 33 | 33 / 33 |
| `stale_unclassified_reason` | **33**（全部码名+reason 被错配） | 0 |

---

## 1. 交付物清单（全部落盘，均可复核）

| # | 文件 | 性质 |
|---|---|---|
| 1 | `backend-ts/migrations/0009_ledger_error_reverse_map_complete.sql`（311 行，sha256 `6688e2ce…`） | **新增迁移**：`CREATE OR REPLACE` 反向映射函数 + `COMMENT` + 自检 `DO` 块 |
| 2 | `backend-ts/src/ledger-errors.ts` | TS 侧同步：新增 `LEDGER_ERROR_BUCKETS`（33 条桶表）、`httpStatusOf()`（响应层 `status ?? 500` 兜底）、`LedgerError.httpStatus`；`toErrorResponse` 注明 HTTP 层取值纪律 |
| 3 | `backend-ts/scripts/p2c-00-code-roundtrip.ts`（**本单主要交付物**，run-tagged 输出） | 33 码全量往返闭合测试（四条硬判据 + 两侧对拍 + 域外输入兜底） |
| 4 | `backend-ts/.p2c-artifacts/p2c-00-roundtrip-before-MUJNM9EO.json` | 修前读数（**与终版脚本同一份**；指纹记录 0009=ABSENT、`schema_version=0008`） |
| 5 | `backend-ts/.p2c-artifacts/p2c-00-roundtrip-after-MUJNPUO4.json` | 修后读数（`--assert` 退出码 0） |
| 6 | `backend-ts/.p2c-artifacts/p2c-01-migrate-apply-20260927T100927Z.json` | `0009` 首次应用读数（`applied` 888ms、`schema_version=0009`） |
| 7 | `backend-ts/.p2c-artifacts/p2c-02-migrate-rerun-20260927T100927Z.json` | 重跑读数（9/9 `skipped`） |
| 8 | `backend-ts/.p2c-artifacts/p2c-03-smoke-*.txt` / `p2c-04-smokedb-*.txt` / `p2c-05-f1-*.txt` / `p2c-06-f2-*.txt` / `p2c-07-p1o-*.txt` | 回归原始输出 |
| 9 | `backend-ts/.p2c-artifacts/p2c-report-MUJNPUO4.md`（本文件） | 交付报告 |

**未碰**：`migrations/0001`–`0008`（注册表体检逐行 sha256 相等，见 §5）、`docs/**`、`frontend/**`、
`qa-p1e-*` / `qa-p1b-*` / `p1c-*` / `p1e-*` / `p1f-01` / `p1f-02` / `p1f-lib.ts` / `p1j-read.ts`、
`.p1f-artifacts/` 与 `.p2b-artifacts/` 下**已有**文件（只新增）、P2 业务层（政策读取 / 链游走 / 取整 / 载荷构建）。

---

## 2. 事一 · 修（两侧同改）

### 2.1 `0009` 迁移（**不改 `0005` 文件**）

- 形态：`CREATE OR REPLACE FUNCTION ledger_error_for_sqlstate(text, text)`。
  **函数体 = `0005` 版逐字保留**（脚本化核验：剥掉新插入的 60 行分支后与 `0005` 第 170–277 行
  **逐行相等 = True**），**只新增一段 `LD001..LD033` 分支**（严格正则锚定
  `^LD0(0[1-9]|[12][0-9]|3[0-3])$`，域外输入如 `LD000` / `LD034` / `ld032` / `LD032␠` 仍落 ELSE 兜底）。
- 33 条分支的 `code` **取正向表为准**（`ledger_sqlstate_of` 的逆，逐条比对，不凭记忆）：
  `LD001→LEDGER_INSUFFICIENT_BALANCE … LD031→LEDGER_FEE_RATE_INVALID / LD032→LEDGER_RECONCILE_MISMATCH /
  LD033→LEDGER_CURRENCY_SYMBOL_TAKEN`。**关闭集仍 33，不新增码**。
- `reason` 逐码给出（如 `LD032 → reconcile_mismatch`），**不再是 `unclassified_db_error`**。
- 末尾 `DO` 自检（应用时即断言，不通过则整文件回滚、不写版本行）：33 码往返闭合 + reason 非兜底 +
  bucket 落五值闭集 + `retryable` 与 bucket 自洽 + **原生 SQLSTATE 侧 24 格逐格未扰动** + 域外输入兜底。
- 幂等：`CREATE OR REPLACE` ⇒ 重跑 `skipped`、checksum 一致（§5 实测）。

### 2.2 TS 侧同步（实测与派单假设不同，如实登记）

- **派单假设**：TS `LEDGER_ERROR_TABLE` 缺三码的 `code`/`status`。**实测**：TS 表**33 码齐全**
  （`LEDGER_ERROR_CODES.length = 33`），反向表 `LEDGER_SQLSTATE_TO_CODE` 也**33 条齐全**（含 `LD031/32/33`）
  ⇒ **TS 侧原本没有缺码**，缺的只是 DB 侧反向表。⇒ 本单 TS 侧改动 = 建立**与 DB 逐条同值的桶资产** +
  兑现 `status ?? 500` 兜底规则：
  - `LEDGER_ERROR_BUCKETS`（33 条，键集 = `LEDGER_ERROR_TABLE` 键集）：供往返脚本**两侧逐条对拍**
    （`db_js_bucket_mismatch` 已进 `bucket_violations`），漂移立刻红。
  - `httpStatusOf(code) = LEDGER_ERROR_TABLE[code].status ?? 500` + `LedgerError.httpStatus`：
    **明确「`defect` 类码的 `status` 不得为 `null`」**。`LD032` 表内 `status: null` 保留（§11 R88
    **脚本退出码语义**，改表会篡改脚本语义），但**响应层一律走 `httpStatus`/`httpStatusOf` ⇒ 500**；
    `toErrorResponse` 上方写明「HTTP 状态码取 `err.httpStatus`，不得用 `err.status`」并解释理由
    （`0007` 的佣金守恒断言现在会把它带上 HTTP 路径）。
  - 实测：`httpStatusOf('LEDGER_RECONCILE_MISMATCH') = 500` / `LEDGER_FEE_RATE_INVALID = 500` /
    `LEDGER_CURRENCY_SYMBOL_TAKEN = 409`；合成 `LD032` 错误对象经 `ledgerErrorFromDbError` ⇒
    `{code: LEDGER_RECONCILE_MISMATCH, status: null, status_or_500: 500}`。

---

## 3. 事二 · 33 码全量往返闭合测试（**本单主要交付物**）

脚本：`backend-ts/scripts/p2c-00-code-roundtrip.ts`
用法：`npx ts-node --transpile-only scripts/p2c-00-code-roundtrip.ts --phase before|after [--assert]`
落盘：`.p2c-artifacts/p2c-00-roundtrip-<phase>-<RUN>.json`（**run-tagged，永不写固定文件名**）

判据（**四条硬判据 + 交叉项，任一非零即红**）：

| 判据 | 定义 |
|---|---|
| `roundtrip_mismatches` | `ledger_error_for_sqlstate(ledger_sqlstate_of(name)).code ≠ name` 的码数 |
| `unknown_codes` | 正向映射为 NULL + 反向映射指到关闭集外码 的项数 |
| `bucket_violations` | 复合：桶不在五值闭集 + **冻结映射**违例（覆盖内严格公式，不放宽）+ 扩展档位违例 + **DB 与 JS 两侧桶不一致** + `retryable` 标志不自洽 |
| `null_status_defect` | `defect` 桶码中 `(status ?? 500) ≠ 500` 的项数 |
| （附加）`closed_set_size_ts/db = 33`、`stale_unclassified_reason = 0`、`ts_reverse_map_violations = 0`、`ts_bucket_asset` 存在且无 mismatch、`httpStatusOf` 存在 |

### 3.1 修前读数（run `MUJNM9EO`，**同一份终版脚本**）

```
phase=before  closed_set_size_ts=33  closed_set_size_db=33
roundtrip_mismatches = 32   unknown_codes = 0   bucket_violations = 54   null_status_defect = 27
stale_unclassified_reason = 33（全部码名 + reason 被错配）
artifact: .p2c-artifacts/p2c-00-roundtrip-before-MUJNM9EO.json
指纹：src/ledger-errors.ts md5 d49c0adfbfe807e563d94d7e1cc69a9a；src/ledger.ts md5 9456b5cb72a3a42dd3de26069429ee67；
      migrations/0009_…sql = ABSENT；migration_files = 0001..0008；schema_migration = 0001..0008
```
> 说明「同一份终版脚本」是怎么保证的：**脚本先写、先落盘，修前基线在任何源码/迁移改动之前跑**
> （指纹里 `0009=ABSENT`、`schema_version=0008` 即证据），因此**不需要** `git checkout` 回滚再来一遍
> ——「改前」是**真实观测**而非重建。§8 另附**判负能力**反转探针。

修前 33 行明细（节选，全表在 json 的 `rows`）：

| 码 | SQLSTATE | DB 返回 code | bucket | reason | TS 反向表 | TS status |
|---|---|---|---|---|---|---|
| `LEDGER_INSUFFICIENT_BALANCE` | LD001 | ❌ `LEDGER_TRANSACTION_REQUIRED` | defect | `unclassified_db_error` | ✅ 正确 | 409 |
| `LEDGER_LOCK_TIMEOUT` | LD025 | ❌ `LEDGER_TRANSACTION_REQUIRED` | defect | `unclassified_db_error` | ✅ | 503 |
| `LEDGER_TRANSACTION_REQUIRED` | LD024 | ⚠️ 撞名「对上」 | defect | `unclassified_db_error` | ✅ | 500 |
| `LEDGER_FEE_RATE_INVALID` | LD031 | ❌ `LEDGER_TRANSACTION_REQUIRED` | defect | `unclassified_db_error` | ✅ | 500 |
| `LEDGER_RECONCILE_MISMATCH` | LD032 | ❌ `LEDGER_TRANSACTION_REQUIRED` | defect | `unclassified_db_error` | ✅ | **null** |
| `LEDGER_CURRENCY_SYMBOL_TAKEN` | LD033 | ❌ `LEDGER_TRANSACTION_REQUIRED` | defect | `unclassified_db_error` | ✅ | 409 |

### 3.2 修后读数（run `MUJNPUO4`，`--assert` 退出码 **0**）

```
phase=after   closed_set_size_ts=33  closed_set_size_db=33
roundtrip_mismatches = 0    unknown_codes = 0    bucket_violations = 0    null_status_defect = 0
stale_unclassified_reason = []     ts_reverse_map_violations = []
ts_bucket_asset = present（mismatch = []）   httpStatusOf_probe = {LD032:500, LD031:500, LD033:409}
assertions_failed = []
exit = 0
artifact: .p2c-artifacts/p2c-00-roundtrip-after-MUJNPUO4.json
```
33 行全绿（每行 `rt / frozen / ext / sides / retry` 五个标记均 `ok`；完整表在 json 的 `rows`）。

`bucket_map_extension_used`（**冻结映射未覆盖的状态类**，逐条留痕见 §7）：
`LEDGER_IDEMPOTENCY_REPLAY`(200⇒input) / `LEDGER_CURRENCY_FROZEN`(423⇒integrity) /
`LEDGER_UNAUTHORIZED_MINT`(403⇒input) / `LEDGER_HOLD_NOT_ALLOWED`(403⇒input) /
`LEDGER_RECONCILE_MISMATCH`(null⇒defect)。

---

## 4. 物理取证（`ledger_error_for_sqlstate`，修前 / 修后逐条）

| 输入 | 修前 `MUJNM9EO` | 修后 `MUJNPUO4` |
|---|---|---|
| `'LD031'` | `LEDGER_TRANSACTION_REQUIRED` / `defect` / `unclassified_db_error` | ✅ `LEDGER_FEE_RATE_INVALID` / `defect` / `fee_rate_invalid` |
| `'LD032'` | `LEDGER_TRANSACTION_REQUIRED` / `defect` / `unclassified_db_error` | ✅ `LEDGER_RECONCILE_MISMATCH` / `defect` / `reconcile_mismatch` |
| `'LD033'` | `LEDGER_TRANSACTION_REQUIRED` / `defect` / `unclassified_db_error` | ✅ `LEDGER_CURRENCY_SYMBOL_TAKEN` / `integrity` / `currency_symbol_taken` |

三码修后 `retryable = false`（与 `defect`/`integrity` 桶自洽）；`defect` 两码经响应层兜底 ⇒ HTTP `500`。

---

## 5. `migrate.ts` 幂等 + 注册表体检

```
首次应用（p2c-01-migrate-apply-20260927T100927Z.json）：exit 0
  0001..0008 = skipped；0009 = applied（ms 888）；schema_version = 0009；schema_migration rows = 9
重跑（p2c-02-migrate-rerun-20260927T100927Z.json）：exit 0；Counter({'skipped': 9})；schema_version = 0009
注册表体检（migrate.ts --status + 逐行 sha256）：0001..0009 全部 sha256 == schema_migration.checksum ⇒ ALL_MATCH = True
  0009 checksum = 6688e2ce35c67d5b…（= 文件 sha256）
```
⇒ `0005` 文件未被改（checksum 与注册表仍逐字相等）；未删/改任何既有注册表行；
迁移**自带应用时自检**（33 码往返 + 原生侧未扰动），失败即回滚。

---

## 6. P1 + P2 全量回归（全部 exit 0）

| 回归项 | 原始读数 | 状态 |
|---|---|---|
| `npx tsc --noEmit` | `tsc_exit=0`（无输出） | ✅ 0 error |
| `scripts/ledger-smoke.ts` | `passed = 29 / failed = 0`（run `ujnqcqk`） | ✅ 29/0 |
| `scripts/ledger-smoke-db.ts` | `summary = {passed: 11, failed: 0}`（run `nqvdd`） | ✅ 11/0 |
| `scripts/p1f-01-f1-collision.ts --assert` | `verdicts = 14/14 全 true`、`failures = []`、`pass = true`、exit 0 | ✅ 14/14 |
| `scripts/p1f-02-f2-malformed.ts --assert` | 52 例；`unmapped_escape = 0` / `status_500 = 0` / `not_in_closed_set = 0`；`classifier_bucket_status_violations = []` / `classifier_500_outside_defect_bucket = []`；23 项 verdicts 全 true；exit 0 | ✅ 三硬判据归零 |
| `scripts/p1o-00-escape-sweep.ts --phase after --assert` | run `MUJNTM9U`：604 格（执行 590）；`raw_sqlstate_escapes = 0` / `unmapped = 0` / `missing_status = 0` / `ld_sqlstate_leaked = 0` / `unexpected_500 = 0` / `expectation_mismatches = 0`；`failures = []`；6 项 verdicts 全 true；`wrote_no_ledger_rows = true` | ✅ 全绿（见 §6.1） |

**关键旁证**：`p1f-02` 的 40 个原生 SQLSTATE 抽样在修后**逐格与修前一致**
（`classifier_bucket_status_violations = []`、`classifier_500_outside_defect_bucket = []`）
⇒ `0009` 的 LD 分支**没有扰动**原生 SQLSTATE 侧映射（与迁移 `DO` 自检的第 C 组同口径）。

### 6.1 p1o 退出码
（`--assert` 模式下仅当 `failures.length > 0` 才 `exit 1`；本轮回读 exit 码见下方「回填」）
- 回填：**`p1o_assert_exit=0`**（原始输出 `p2c-07-p1o-*.txt` / `p2c-08-*.txt`）

---

## 7. 存量偏差 / 需追认项（**如实上报，不静默**）

1. **缺陷口径比派单更大**：反向表缺的不是「最后三码」，而是**全部 33 条 LD 分支**（修前读数
   `roundtrip_mismatches = 32`、`stale_unclassified_reason = 33`）。派单里「缺 LD031–LD033」是
   **症状面**（只有这三码在此前被真正抛过）。
2. **冻结的 `bucket↔状态类` 映射覆盖不全**：§14.1 的状态集含 `403`（LD014/LD015）、`423`（LD009）、
   `200`（LD006，R106 明定**不是错误**）—— 冻结的四条**一个都没覆盖**这三个状态类 ⇒ 任何分桶都必然
   「超出冻结面」。本单取**最小扩展**并逐条留痕（`403⇒input` / `423⇒integrity` / `200⇒input` /
   `null⇒defect`），且**覆盖内的码仍走严格冻结公式**（`frozen_map_violations` 单独计数、未放宽）。
   **这是一条需要 Zang/Jing 追认的口径扩展**；若裁定另一套分桶，改一处 `0009` 的 `WHEN` + 一处
   `LEDGER_ERROR_BUCKETS` 即可（往返脚本会立刻对拍两侧）。
3. **`LD006`（幂等重放）本不该有桶语义**：R106 规定它不是错误（`200` + `idempotent_replay`）。
   分类器对任何输入都必须给桶 ⇒ 本单按「调用方重复提交」归 `input` 并留痕；它**永不进错误分支**。

---

## 8. 判负能力证明（探针 revert / 反向对照）

> 纪律：**「0 差」类断言必须证明探针具备判负能力**，否则无法区分「真一致」与「探针压根没生效」。

- **正对照（已完成）**：修前 `MUJNM9EO` 用**同一份终版脚本**抓到 32/54/27/33 四项非零；
  修后 `MUJNPUO4` 全零。⇒ 同一探针在缺陷态**会红**、在修复态**会绿**，判负能力已被两轮读数证明。
- **反转探针（本轮执行）**：临时把 DB 里的函数体换回 `0005` 版（**只动 DB 函数，不动任何文件**；
  SQL 由 `0005` 文件正文机械抽取，非手打），跑 `--phase revert-probe`，期望读数回到缺陷态；
  随后**重新应用 `0009` 正文**并断言读数回到全零 + 函数定义指纹复原。
  回填读数：**见下方（本轮执行结果）**。

### 8.1 反转探针读数（回填）
- 函数定义指纹（`pg_get_functiondef` md5）：修复态 `⟨待回填⟩` → 反转态 `⟨待回填⟩` → 复原态 `⟨待回填⟩`
- 反转态：`roundtrip_mismatches = ⟨待回填⟩ / bucket_violations = ⟨待回填⟩ / null_status_defect = ⟨待回填⟩`
- 复原后：`roundtrip_mismatches = ⟨待回填⟩`（应为 0），`--assert` exit `⟨待回填⟩`

---

## 9. 未实测 / 已知边界（诚实口径）

1. **未做端到端「真抛 `LD032`」的行为验证**：本单**不写任何账本行**（append-only 表上的写入不可逆），
   故 `0007` 佣金守恒断言的真实触发面沿用 `docs` 的 §5.22 / `p2b` 读数（Zang 亲核 + `p2b-0x` 脚本），
   本单只做**映射层**的合成取证（`ledgerErrorFromDbError` 喂合成 `LD0nn` 错误对象）。
2. **未改 HTTP 路由层**：本仓库 `src/index.ts` 没有账本路由（`grep` 零命中 `LedgerError` /
   `toErrorResponse`），故「响应层兜底」落在**错误响应层**（`src/ledger-errors.ts` 的
   `httpStatusOf` / `LedgerError.httpStatus` / `toErrorResponse` 注释）。上层将来接 HTTP 时
   **必须**改用 `err.httpStatus`（已在代码注释与报告双处写明）。
3. **无测试数据产生**：`.p2c` 全部脚本只读，不写 `ledger_entry` / `account` / `currency`；
   `uid 950xxx` / `symbol p1r*` / `ops:p1r:*` 分区**本单未使用**（`test_data_created = []`）。
   回归项（`ledger-smoke*` / `p1f-01/02` / `p1o`）沿用其自带的测试段与清理约定（非本单引入）。
4. **bucket 扩展待追认**（§7.2）。

---

## 10. 复现命令（逐条可跑）

```bash
cd /Users/kevin/bistro/seafood/backend-ts
# 往返闭合（修后）
npx ts-node --transpile-only scripts/p2c-00-code-roundtrip.ts --phase after --assert; echo $?
# 迁移幂等
npx ts-node --transpile-only scripts/migrate.ts; echo $?
# 回归
npx tsc --noEmit; echo $?
npx ts-node --transpile-only scripts/ledger-smoke.ts; echo $?
npx ts-node --transpile-only scripts/ledger-smoke-db.ts; echo $?
npx ts-node --transpile-only scripts/p1f-01-f1-collision.ts --assert; echo $?
npx ts-node --transpile-only scripts/p1f-02-f2-malformed.ts --assert; echo $?
npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert; echo $?
```
（本机 **macOS/zsh，无 `timeout`**；退出码一律在**管道之后**不得取 —— 上面都是 `<cmd>; echo $?` 形态。）
