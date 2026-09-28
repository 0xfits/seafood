# P3 · Unit H / P3-ERRORS-NARROW · 事件对象族判据「收窄」+ 分类路径守卫（Kong 交付报告）

- 角色：**Kong（实现）**；单号 **Unit H / P3-ERRORS-NARROW**；上游：`docs/audit/p3-errors-fold-fix.md`（Unit E）+ `docs/qa/p3-errors-fold-fix-review.md`（Unit G / Neng，verdict `部分可用`，判据过捕）
- 交付件：`backend-ts/src/ledger-errors.ts`（**收窄判据 + 分类路径守卫**），工作树 sha256 = `7895390ea5616339322043f3cd825a44e550ca836f006b34761fb71c0c3b96f9`（**实测**）
- 三态基准（**全部用内容 sha 自证，不用 `HEAD` 符号自证**，`sha_selfcheck` 两个 `*_sha_match` 均 `true`）：
  - baseline（修前）= `721156cbf296b19c7c4a480264f88b49878d99104b8f87453bafce564745df8b`（取自 `git show 88783a2:backend-ts/src/ledger-errors.ts`）
  - fixed（上一单 Unit E 修复后）= `9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d`（取自 `git show HEAD:…`；`HEAD` 实测 = `ade33769c101a0c89fb61902ddef944034e5c89e`，**与交接所述 `ade3376` 一致**，无符号错位）
  - narrowed（本单）= `7895390e…3b96f9`
  - mutated（判负副本，探针自建）= `d6bcf5c8f7d11d1c35d55cc55e32e96e210ee48108e8bb2a4c20a4b58622fbec`
- 有效 run：`20260928T163708Z`（`PROBE_EXIT=0`，退出码**直接取、未经管道**）；复现 run：`20260928T163654Z`、`20260928T163629Z`（见 §5.4）
- 环境：Node v18.19.0 · `ws` 8.22.0 · `@neondatabase/serverless` 0.6.1 · macOS
- **本单 DB 零写**：探针纯函数、零 DB/零网络 I/O；未建任何库对象、未跑任何写库套件、未起长驻 server。

---

## 0. 结论

**收窄与守卫在其申报范围内全部成立**；两项必须上报：**(a) AC 文本的 B 组清单与【裁决】自相矛盾**（`new Event('error')` / `{type:'error',payload}` 带标准判别位 `type==='error'`，按裁决判据②不动 ⇒ 仍 503，本报告 §6 显式登记并按裁决执行）；**(b) 我自己的探针第 1 次 run 因 print 段 bug 以 exit 1 收尾**（数据已落盘，按 §5.4 作废该次 run）。

| leg | 读数（run `20260928T163708Z`） | 判定 |
|---|---|---|
| **A 组**（真 `ws.ErrorEvent` / `Object.freeze({type:'error',message})` / 自有 getter-only `message` / `{type:'error'}`） | 4/4 `LEDGER_TX_TIMEOUT`/**503**，且 `narrowed_eq_fixed=true`（含 `details` 逐字节） | **绿** |
| **B 组**（B1–B7 过捕面） | B1–B5 **== baseline 逐字节**（回到 `LEDGER_TRANSACTION_REQUIRED`/**500**）；B6/B7 **仍 503**（裁决残余，§6） | **绿（含 1 项冲突登记）** |
| **C 组**（既有 13 例对照） | `three_state_byte_identical = 13/13`（`C_mismatch=[]`） | **绿** |
| **R 组**（显式登记的「已释放」形态） | 2/2 回到 baseline（500），`narrowed_eq_baseline=true` | **绿 · 已登记** |
| **G 组**（毒 getter 5 形态） | narrowed **5/5 不抛**（`G_threw=[]`），三形态（`message`/`code`/`type` 抛）读数恒定 = `LEDGER_TRANSACTION_REQUIRED`/**500**/`unclassified_non_pg_error` | **绿** |
| **判负（RED）** | baseline `[]`（绿）→ fixed `[B1…B7,R1,R2]`（红）→ **narrowed `[B6,B7]`**（只剩裁决残余）→ mutated_clause3b `[B1…B4,R1,R2,B6,B7]`（红）；full-revert 列 = `fixed` 列 | **绿（判负成立）** |
| **回归** | `npx tsc --noEmit` **exit 0 / 日志 0 行**；§14 闭集 33 码 / `LEDGER_ERROR_TABLE` / `LEDGER_ERROR_BUCKETS` **未被任何 hunk 触及**（§9） | **绿** |

**一句话**：把「`message` 不是 own 数据属性」这条等价关系删掉、并给判据①加 `type==='error'`、给分类路径所有属性读取加守卫后，**过捕面按 baseline 逐字节归位**，事件对象族与 13 例对照**一格未动**，且分类路径不再可能因 getter 抛而整体崩。

---

## 1. 交付物与 sha 自证

| # | 项 | 读数 | 来源口径 |
|---|---|---|---|
| 1 | `backend-ts/src/ledger-errors.ts`（narrowed） | `7895390ea5616339322043f3cd825a44e550ca836f006b34761fb71c0c3b96f9` | `shasum -a 256`（工作树） |
| 2 | baseline 副本内容 sha | `721156cb…df8b` = 交接所载 baseline | 副本文件 `shasum -a 256`（**内容自证**） |
| 3 | fixed 副本内容 sha | `9bc127e4…983d` = 被检件 sha | 同上 |
| 4 | `HEAD` 符号 | `ade33769c101a0c89fb61902ddef944034e5c89e` | `git rev-parse HEAD`（**仅作旁证，不作自证**） |
| 5 | 探针 sha | `69e25a8f033e4000a41c20651757bf966daeeaac842e10836c3326dd20efe16c` | `backend-ts/scripts/p3w-00-fold-narrow-verify.ts` |
| 6 | 三 run 归一化 payload sha（剔 `run` 字段） | `466fc31795c917df367d5f93801d9a291a612b969b829fb22bb6631953b15630`（**三份 artifact 全等**） | `node -e` 逐份重算 |

> §5.7①：`baseline` / `fixed` 的 sha 由**副本文件内容**算出，**未用 `HEAD` 符号**（Unit G §11.1 的作废原因不复现）；`HEAD` 读数只用于确认「交接所述提交号与现场一致」。

---

## 2. 改动 diff 摘要（行号 + 行数）

`git diff --numstat -- src/ledger-errors.ts` = **48 / 11**；文件 **599 → 636 行**。`git diff -U0` 共 **5 个 hunk**：

| hunk（旧→新行号） | 形状 | 内容 |
|---|---|---|
| `@@ -263,3 +263,21 @@` | −3 / **+18** | `pgCode` / `pgConstraint` / `pgMessage` 三行改为守卫读取；新增 `safeRead()` 实现 + 其裁定注释块；`errName` 原行**保留不动**（仅在其上方加一行「按单不动」注记） |
| `@@ -370,0 +389,2 @@` | **+2** | `isEventObjectFamily` 内新增判据① 的注释（说明为何要加 `type`） |
| `@@ -372,6 +392,23 @@` | **−6 / +17** | 判据① 加 `type === 'error'` 且在 `try` 内判 `instanceof`（抛 ⇒ 不匹配）；判据② 改用守卫读且**逐字不变**；**删除判据③ 第二子句** `desc === undefined && typeof o.message === 'string'`；判据③ 第一子句保留，`message` 改守卫读；`getOwnPropertyDescriptor` 抛 ⇒ 返回 `false` |
| `@@ -478 +515 @@` | 1 行改 | `ledgerErrorDiagnostics` 的 `e.cause ?? e.error` 改守卫读 |
| `@@ -486 +523 @@` | 1 行改 | 诊断 cause 链的 `cur.cause ?? cur.error` 改守卫读 |

**逐字执行的裁决映射**（可逐条对照代码）：

```ts
事件对象族 ≜ (e instanceof Event ∧ e.type === 'error')   // ① 已加 type 闸门
          ∨ (e.type === 'error')                          // ② 不变
          ∨ (own desc.get !== undefined ∧ desc.set === undefined ∧ typeof message === 'string')  // ③ 仅第一子句
```

**未动项（禁项自检）**：`errName` 函数体未改；无新增错误码；§14 的 33 码闭集与状态映射表未改；`LEDGER_ERROR_TABLE` / `LEDGER_ERROR_BUCKETS` 未改；对外 `details` 未新增 `message` / `stack` 键（A 组 `details` 实测仍为 `{"error_code":"none","reason":"driver_connection_error"}`）；未改其它 `src/**`（`git status` 中仅本文件为 `M`）。

---

## 3. 三态逐形态对拍表（baseline / fixed / narrowed）

口径：`code/status/classify`（`classify` = `classifyNonPgError()` 返回值；`null` = 走 PG/命名码分支）；对拍键 = `{classify, code, status, details(键排序后 JSON)}`。

### 3.1 A 组：预期内（== fixed，事件对象族 ⇒ 503）

| # | 形态（逐字构造） | baseline | fixed | narrowed | narrowed 判定 |
|---|---|---|---|---|---|
| A1 | 真 `ws.ErrorEvent`（`node_modules/ws/lib/event-target.js` **绝对路径**，`ctor.name='ErrorEvent'` 自证） | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | `LEDGER_TX_TIMEOUT/503/driver_connection_error` | **同 fixed** | 503 且 `narrowed_eq_fixed=true` |
| A2 | `Object.freeze({type:'error',message})` | 同上 500 | 503 | **同 fixed** | 503 且 `narrowed_eq_fixed=true` |
| A3 | 自有 **getter-only** `message`（无 setter、无 `type`） | 同上 500 | 503 | **同 fixed** | 503 且 `narrowed_eq_fixed=true` |
| A4 | `{type:'error'}`（无 `message`） | 同上 500 | 503 | **同 fixed** | 503 且 `narrowed_eq_fixed=true` |

`A_fail = []`；A 组 `narrowed_details` 四例均为 `{"error_code":"none","reason":"driver_connection_error"}`（逐字取自 artifact）。

### 3.2 B 组：预期外过捕面（必须 == baseline）

| # | 形态（逐字构造） | baseline | fixed（过捕） | narrowed | `narrowed_eq_baseline` |
|---|---|---|---|---|---|
| B1 | `new Error()` | `LEDGER_TRANSACTION_REQUIRED`/**500** | `LEDGER_TX_TIMEOUT`/503 | `LEDGER_TRANSACTION_REQUIRED`/**500** | ✅ true |
| B2 | `new TypeError()` | 500 | 503 | **500** | ✅ true |
| B3 | `Object.create(Error.prototype)` | 500 | 503 | **500** | ✅ true |
| B4 | `Object.create({message:'x'})` | 500 | 503 | **500** | ✅ true |
| B5 | `new Event('open')` | 500 | 503 | **500** | ✅ true |
| B6 | `new Event('error')` | 500 | 503 | **503** | ❌ false（**裁决残余，§6**） |
| B7 | `{type:'error',payload:{a:1}}` | 500 | 503 | **503** | ❌ false（**裁决残余，§6**） |

`B_mismatch = ["B6_globalEvent_error","B7_business_envelope_type_error"]`；`released_from_503 = true` 者 = **B1–B5**（5/7 归位）。三态 `details`（B1–B5 narrowed 与 baseline 逐字节相同）= `{"cause":"non_pg_error","error_code":"none","error_name":"Error","reason":"unclassified_non_pg_error"}`。

### 3.3 R 组：显式登记的「已释放」形态（窄化后回 500）

| # | 形态（逐字构造） | baseline | fixed | narrowed | `narrowed_eq_baseline` |
|---|---|---|---|---|---|
| R1 | `message` **仅由原型 getter** 提供、且**无 `type`**（`Object.create(defineProperty({},'message',{get}))`） | 500 | 503 | **500** | ✅ true |
| R2 | 类实例，`message` 挂在**原型**（数据属性）、无 `type` | 500 | 503 | **500** | ✅ true |

⇒ 该释放**已登记**，可接受性实证见 §8。

### 3.4 C 组：既有 13 例对照（**三态逐字节不变**）

| # | 形态 | 三态统一读数（`code/status`；`classify`=`null` 指走 PG/命名码分支） | 逐字节 |
|---|---|---|---|
| C1 | PG `22003`（Error 实例 + code） | `LEDGER_TRANSACTION_REQUIRED`/500（`details` 含 `cause=22003,pg_code=22003,reason=unclassified_pg_error`） | ✅ |
| C2 | PG `22003`（裸对象） | 同 C1 | ✅ |
| C3 | DB 命名码 `LD016` | `LEDGER_TRANSACTION_REQUIRED`/500（`cause=LD016,pg_code=LD016`） | ✅ |
| C4 | `ECONNRESET` | `LEDGER_TX_TIMEOUT`/503/`driver_connection_error`（`error_code=ECONNRESET`） | ✅ |
| C5 | 池「拿连接」超时 `timeout exceeded when trying to connect` | `LEDGER_TX_TIMEOUT`/503/`pool_connection_timeout` | ✅ |
| C6 | `socket hang up` | `LEDGER_TX_TIMEOUT`/503/`driver_connection_error` | ✅ |
| C7 | `08P01`（排除项） | `LEDGER_TRANSACTION_REQUIRED`/500/`protocol_violation` | ✅ |
| C8 | `23514` + `account_bal_guard` | `LEDGER_NEGATIVE_BALANCE_GUARD`/500 | ✅ |
| C9 | `23505` + `ledger_idem_uniq` | `LEDGER_IDEMPOTENCY_CONFLICT`/**409** | ✅ |
| C10 | `57014` | `LEDGER_TX_TIMEOUT`/503 | ✅ |
| C11 | `53000` | `LEDGER_TX_TIMEOUT`/503 | ✅ |
| C12 | 命名码直通 `LEDGER_TX_TIMEOUT` | `LEDGER_TX_TIMEOUT`/503 | ✅ |
| C13 | 无 `name` 裸对象（own 数据 `message`、无 `code`） | `LEDGER_TRANSACTION_REQUIRED`/500/`unclassified_non_pg_error` | ✅ |

`C_mismatch = []`；**13/13 三态（baseline/fixed/narrowed）逐字节相同**（含 `details`）⇒ 收窄**未**触碰任何既有分类结果。

---

## 4. 守卫（毒 getter）读数 —— 不抛 + 确定性

AC：毒 getter 三形态（`message` 抛 / `code` 抛 / `type` 抛）**均不抛异常**，读数确定。

| # | 形态（逐字构造） | baseline | fixed | **narrowed** | narrowed `details` |
|---|---|---|---|---|---|
| G1 | `message` getter 抛（own accessor，`get` 抛、无 `set`） | `THREW/THREW/THREW` | `THREW/THREW/THREW` | **`LEDGER_TRANSACTION_REQUIRED` / 500 / `unclassified_non_pg_error`** | `{"cause":"non_pg_error","error_code":"none","error_name":"Error","reason":"unclassified_non_pg_error"}` |
| G2 | `code` getter 抛 | `THREW/…` | `THREW/…` | **`LEDGER_TRANSACTION_REQUIRED` / 500 / `unclassified_non_pg_error`** | 同上 |
| G3 | `type` getter 抛 | `LEDGER_TRANSACTION_REQUIRED`/500 | **`THREW/…`**（fixed 在此崩） | **`LEDGER_TRANSACTION_REQUIRED` / 500 / `unclassified_non_pg_error`** | 同上 |
| G4 | `e.error` getter 抛（诊断 cause 链） | 500 | 500 | **`LEDGER_TRANSACTION_REQUIRED` / 500 / `unclassified_non_pg_error`** | 同上 |
| G5 | `message` 与 `code` 同时抛 | `THREW/…` | `THREW/…` | **`LEDGER_TRANSACTION_REQUIRED` / 500 / `unclassified_non_pg_error`** | 同上 |

- `G_threw = []`（narrowed 侧 **5/5 不抛**）；`classifyNonPgError()` 与 `normalizeLedgerError()` **各一次都没有抛**（`observe()` 在同一 `try` 内分别调用两者）。
- 读数**确定性**：5 例 narrowed 全部落在**同一** `§14` 码 `LEDGER_TRANSACTION_REQUIRED`/500 + `reason=unclassified_non_pg_error`（`code==''` 走兜底分支，本文件所有分支都覆盖空码）。
- 诊断面在毒 getter 下也**不抛**（`ledgerErrorDiagnostics()`：`threw=null`，5/5）：`message` 取不到时落 `null`（G1/G5），`cause_chain_len=0`（`error` 抛 ⇒ 链断在这里）。
- ⚠️ 实测补记：**fixed 在 G3（`type` getter 抛）下整体抛** —— 因为 fixed 的判据① 用 `o.type` 直读且 `instanceof` 判定在 `type` 之前…（实测：fixed 的 `o.type === 'error'` 行会读毒 `type`）⇒ 守卫把这一格从 `THREW` 收敛成**确定性 500**，**这是本单元新增的健壮性收益，非回归**（baseline 在 G3 上本就是 500）。

---

## 5. 判负三段（§5.7 判负自证）

RED 谓词（探针内）：**B 组 ∪ R 组任一形态的 `{classify,code,status,details}` 与 baseline 不一致 ⇒ 记红**（即发生过捕回流）。

### 5.1 三段读数

| 段 | 副本 | sha256 | `RED_set` | 判定 |
|---|---|---|---|---|
| ① 修前 | baseline | `721156cb…df8b` | `[]` | **绿**（基线本身无过捕） |
| ② 修复后（上一单） | fixed | `9bc127e4…983d` | `["B1","B2","B3","B4","B5","B6","B7","R1","R2"]`（9 项） | **红**（过捕复现） |
| ③ **收窄后（本单）** | narrowed | `7895390e…3b96f9` | `["B6_globalEvent_error","B7_business_envelope_type_error"]` | **绿**（仅剩裁决残余） |
| ④ 窄化回退（判负变异） | mutated_clause3b | `d6bcf5c8…fbec` | `["B1","B2","B3","B4","B6","B7","R1","R2"]`（8 项） | **红**（B1–B4 与 R 组回流 503） |

### 5.2 「把窄化回退 ⇒ 探针必须红」成立

- 变异体 = **仅复原被删的第二子句** `if (desc === undefined && typeof safeRead(e,'message') === 'string') return true;`（`mutation_diff_line_count = 1`，锚点命中数校验 = 1，命中数 ≠ 1 则探针拒绝生成）。
- 回退后 `RED_set(mutated) = [B1,B2,B3,B4,B6,B7,R1,R2]` ⇒ **B1–B4（`new Error()` / `new TypeError()` / `Object.create(Error.prototype)` / `Object.create({message:'x'})`）与 R 组全部回流 503**，探针**红**（`verdicts.mutated_clause3b_red=true`）。
- **B5 例外（口径诚实）**：`new Event('open')` 的回流**不只**依赖第二子句 —— 它还依赖判据① 的 `type` 闸门。**完整回退（恢复原判据①）** 的读数 = artifact 的 **`fixed` 列**：`RED_set(fixed) = [B1…B7,R1,R2]`（**B1–B7 全回流 503**，正是 AC 要求的「B1–B7 回流」形态）。故 `RED_set_full_revert_equals_fixed_column = [B1…B7,R1,R2]`。

### 5.3 「逐字节还原后回绿」

- mutated 是**副本**（`.p3w-artifacts/_impl/mutated-clause3b-ledger-errors.ts`），工作树**全程未被写过**：`worktree_sha_before_run = worktree_sha_after_run = 7895390e…`，`worktree_unchanged_by_run = true`。
- 三态 sha256（baseline / fixed / narrowed）= `721156cb…df8b` / `9bc127e4…983d` / `7895390e…3b96f9`，**互异且各自与前述内容 sha 一致** ⇒ 红/绿/红之间的差异**只可能**来自本单那 +48/−11 行（`HEAD^→HEAD` 与 `HEAD→工作树` 的差异面已在 `git diff -U0` 的 5 个 hunk 内闭合）。

### 5.4 run 稳定性（§5.7⑨）与 1 次作废 run

| run | 副本来源 | 读数 | 状态 |
|---|---|---|---|
| `20260928T163629Z` | 同 | 同（payload sha 相同），但 **`PROBE_EXIT=1`**：探针末尾 `[G] …` 打印行误用不存在的 `r.per_impl`（G 行结构无 `per_impl`）抛 `TypeError` —— **artifact 在打印段之前已落盘** | **作废**（不进入任何判定；见 §11.1） |
| `20260928T163654Z` | 同 | 同（payload sha 相同）；退出码取自 `PIPESTATUS[0]`（**违反 §5.7② 口径**） | 读数有效、**退出码不作证据** |
| **`20260928T163708Z`** | 同 | 同；`PROBE_EXIT=0`（**直接取，未经管道**） | **有效 run** |

三次 artifact 剔除 `run` 字段后的 **payload sha 全等** = `466fc31795c917df367d5f93801d9a291a612b969b829fb22bb6631953b15630` ⇒ 读数在 3 次独立 run 间**逐字节确定**（单次绿不足以推翻多次观测的顾虑由此被覆盖）。

---

## 6. AC 冲突登记：B6 / B7（**必须上报，未自行扩大裁决**）

- **冲突内容**：AC 文本要求 `B6 new Event('error')`、`B7 {type:'error',payload}` 二形态「必须回到 `500/LEDGER_TRANSACTION_REQUIRED`，且与 baseline 副本逐字节相同」；而【裁决】同时规定 **「判据② 不变」**，【接受残余】又规定 **「`{type:'error', payload}` 业务信封仍落 503」**。二形态都带 `type === 'error'`，按裁决必然命中判据②。
- **执行选择**：按【裁决】逐字执行（**不得自行扩大**）⇒ B6/B7 **仍 503**，并在本段显式登记。**我没有**为了凑 AC 而给判据② 加 `payload` 之类的新排除条件（那属于自行扩大）。
- **实测读数**：`narrowed = LEDGER_TX_TIMEOUT/503/driver_connection_error`（与 fixed 同）；`narrowed_eq_baseline = false`；`ids_remaining_503 = ["B6_globalEvent_error","B7_business_envelope_type_error"]`。
- **性质判定**：B6 `new Event('error')` 是**真事件对象**（同时满足判据①∧②）—— 归事件族**不是过捕**；B7 是**标准事件判别位**（`type==='error'`）上的**业务信封残余**，已由【接受残余】条款兜住。⇒ 二者在语义上均非「过捕回流」，与 §0 的「B 组绿」不矛盾。
- **交给 Zang/仲裁的一问**：AC 的 B 组清单是否应改为「B1–B5 ⇒ 必须 == baseline；B6/B7 ⇒ 登记为裁决残余、不要求 == baseline」。

---

## 7. 接受残余登记（登记、不修）

- **形态**：`{type:'error', payload}`（业务信封，非事件对象）。
- **窄化后读数**：`LEDGER_TX_TIMEOUT`/503（`details = {"error_code":"none","reason":"driver_connection_error"}`）。
- **理由（逐字接受）**：① `type === 'error'` 是**标准事件判别位**，判据② 保留它才有「不看 `instanceof` 也能认出事件对象」的兜底（真 `ws.ErrorEvent` 的 `instanceof globalThis.Event === false`，只靠判据① 必漏）；② `LedgerError` 实例在 `isLedgerError()` 处**先被排除**、业务响应**不经** `normalizeLedgerError` ⇒ 真实业务信封不会走到这里（本单未构造业务路径端到端验证，见 §10）。

---

## 8. 「已释放」登记项 + 可接受性实证（**AC 要求显式登记**）

| 项 | 内容 |
|---|---|
| **释放形态** | `message` **仅由原型 getter** 提供、且**无 `type`** 的对象（如 `Object.create(defineProperty({},'message',{get:{…}}))`）；同类还有「`message` 挂原型数据属性、无 `type` 的类实例」 ⇒ 窄化后由 fixed 的 503 **回到 500**（R1/R2；`narrowed_eq_baseline=true`） |
| **为何可接受（实测支撑）** | ① 真 `ws.ErrorEvent` **恒带标准判别位**：现场读数 `wsEE.type = "error"`、`wsEE.type === 'error'` ⇒ **`true`**、`wsEE_has_own_type = false`（`type` 不在实例上、经原型 getter 取到 —— 守卫读沿原型链，仍取得到）；② 因此真物**不再依赖**被删的那条子句：它由判据② 命中（A1 实测 503，`narrowed_eq_fixed=true`）；③ `own_message_descriptor = null`（实例无 own `message`）、`proto_message_getter_is_fn = true`、`proto_message_setter_present = false` —— 与 Unit G 的 `ws` 形状三条事实**独立复现一致** |
| **残余风险（如实标注）** | 若某个**非 `ws`** 的事件实现「只用原型 getter 提供 `message`、且不带 `type`」，窄化后会重新落 500 ⇒ 属**未观测形态**（本单未做 `node_modules` 全依赖扫描，见 §10）。该风险的**反向代价**（保留旧子句）是「任何没有 own `message` 的 `Error`（含 `new Error()`）被静默降级成 503」，实测面更宽、更现实 |

---

## 9. `tsc` 与禁项自检

| 项 | 命令 / 口径 | 读数 |
|---|---|---|
| `tsc` | `npx tsc --noEmit > .p3w-artifacts/p3w-tsc-narrow.log 2>&1; echo $?`（**退出码直接取，未经管道**，§5.7②） | **`TSC_EXIT=0`**，日志 **0 行** |
| §14 闭集 | 本单未新增码；`git diff -U0` 的 5 个 hunk **全部**落在 `:263-283` / `:389-415` / `:515` / `:523` 四处，**均不在** `LEDGER_ERROR_TABLE`(`:28-72`) / `LEDGER_ERROR_BUCKETS`(`:112-…`) / 状态映射区 | 未触及（口径：**按 diff 面的包含关系**判定，未重算指纹） |
| `errName` | 函数体行**逐字未改**（仅上方加注释）；C 组 13 例 `details.error_name` 三态逐字节相同（实测 `"Error"` / `"ProtocolViolation"`） | 未变 |
| 对外 `details` | A 组 `details = {"error_code":"none","reason":"driver_connection_error"}`；B/G/R 组 = `{"cause","error_code","error_name","reason"}` 四键，**无 `message`、无 `stack` 键** | R107 未破坏（口径：键名白名单） |
| 写落盘 | 仅 `backend-ts/src/ledger-errors.ts`、`backend-ts/scripts/p3w-00-fold-narrow-verify.ts`、`backend-ts/.p3w-artifacts/**`、`docs/audit/p3-errors-fold-narrow.md` | 合边界 |
| 禁项 | 未 `git add/commit/push`；未跑写库套件；未建库对象；未 `pkill -f` / `killall`（本单未 kill 任何进程）；未起长驻 server；未 `execute_code`；未 `npm install`；未删/改任何既有文件 | 合规 |
| 并行单痕迹 | `git status` 中 `backend-ts/scripts/p1o-00-escape-sweep.ts`、`p2w-00-p2fix-verify.ts` 的 `M` 及 `docs/seafood.master-plan.md` 的 `M` **在本单开始前即存在**（我未触碰、未回退） | 已声明 |

---

## 10. 未验证清单（`NOT_MEASURED` / `null`，禁填 0/空数组占位）

| # | 项 | 状态 | 原因 / 口径 |
|---|---|---|---|
| 1 | **端到端**（连接层逼出事件对象 ⇒ 穿路由层 ⇒ 观察 HTTP 503/500 变化） | `NOT_MEASURED` | 本单 DB 零写、禁跑写库套件、不做在线故障注入；只在**纯函数层**（`classifyNonPgError` / `normalizeLedgerError` / `ledgerErrorDiagnostics`）取证 |
| 2 | 真实业务路径上「业务响应不经 `normalizeLedgerError`」这一命题 | `NOT_MEASURED` | 未起 server、未跑路由层；§7 的第②条理由来自既有代码结构与上一单结论，**非本单实测** |
| 3 | 自有 getter **+ setter** 的 `message`（Unit G 的 P13/M1）在 narrowed 下的读数 | `NOT_MEASURED` | 本单未构造该形态（判据③ 第一子句**逐字保留**、未改 ⇒ 按构造行为不变；前单已测为 500） |
| 4 | `isEventObjectFamily` 对 `node_modules` **其它依赖**（非 `ws`）的误捕/漏捕面 | `NOT_MEASURED` | 未做全依赖扫描；只覆盖 `ws` 的 5 个事件类 + 手写形态 |
| 5 | 生产路径上「原型 getter-only `message` 且无 `type`」形态的**出现频率** | `NOT_MEASURED` | 无生产流量数据；本单只证「形态存在且窄化后回到 500」 |
| 6 | 毒 getter 在**路由/进程层**的表现（是否被上层兜住、是否留痕） | `NOT_MEASURED` | 无 http 层实证；只证分类路径**不抛** |
| 7 | 毒 `name` getter（`errName` 仍直读） | `NOT_MEASURED`（**登记残余**） | `errName` 按禁项**不动** ⇒ 若 `name` 的 getter 抛，`normalizeLedgerError` 兜底分支仍会抛；本单未构造该形态（AC 只要求 `message`/`code`/`type`） |
| 8 | §14 码闭集**指纹**（`LEDGER_ERROR_TABLE`/`BUCKETS` sha）在 narrowed 下的重算 | `NOT_MEASURED`（口径替代） | 改用「diff hunk 包含关系」判定未触及；未在本单重算指纹 |
| 9 | `details` 全键白名单的**穷举**（只有 4 例 A 组 + 5 例 G 组被逐字打印） | `NOT_MEASURED`（部分） | 完整键集见 artifact 的 `all_cases`；报告只逐字引用了代表性读数 |
| 10 | 先前 Unit G 报的 DB 指纹 / 迁移读数 | `NOT_MEASURED` | 本单 DB 零写、不连库 ⇒ 不读取、不比对 |

---

## 11. 探针缺陷自曝（§5.7④：读数异常先怀疑自己的探针/口径）

1. **1 次 run 作废**：`20260928T163629Z` 的 print 段 `[G] …` 误用 `r.per_impl`（G 行的结构里只有 `per_impl` 的派生 brief，无 `per_impl` 本体）⇒ 抛 `TypeError`、`PROBE_EXIT=1`。**artifact 已在打印段之前落盘**，内容与后续 run 逐字节相同，但按「出口非 0 即不采信」的口径**判该次 run 作废**（artifact 保留以便回溯）。修正后 run = `20260928T163708Z`（`PROBE_EXIT=0`）。
2. **退出码口径违规 1 次**：`20260928T163654Z` 用 `| tee` 后取 `PIPESTATUS[0]` —— 属 §5.7② 明令禁止的「退出码取自管道之后」。已改用**直接重定向 + `echo $?`** 重跑（run 3），**其读数仍有效、退出码不作证据**。
3. **「独立判据」的独立性有限（必须声明）**：我为对拍复算的那套判据（①/②/③）是**实现逻辑的同构重写**，只能校验接线、**不能证伪判据形状**。本单真正的独立性来自：跨**四副本**（baseline/fixed/narrowed/mutated）观测 + 手工构造的边界形态（B1–B7、R1/R2、G1–G5）+ 与本单 AC 的**冲突主动追查**（§6 即由此而来）。
4. **B5 回流原因的两义性**：AC 把「恢复 `desc === undefined` 子句」当作唯一回退路径，但 B5（`new Event('open')`）的回流还依赖判据① 的 `type` 闸门 ⇒ 单点变异**不足以**让 B1–B7 全回流。已按 §5.2 明确区分「单点变异（B1–B4 + R 组回流）」与「完整回退（= `fixed` 列，B1–B7 全回流）」两种口径，**不合并陈述**。
5. **尺寸/样本诚实声明**：全部判定基于**同一套夹具**的 3 次 run（payload sha 全等）；未做在线故障注入、未做随机化、未做全依赖扫描；「修复在生产上有效」**超出本单可测范围**。
6. **未被本单覆盖但我顺手实测到的意外格**：`fixed` 在 G3（`type` getter 抛）下整体抛异常（`THREW`）——该格**不是**本单引入的回归（baseline 在该格为 500），但说明**上一单**在 `type` 上的读取同样裸奔；本单守卫把它收敛为确定性 500。已记入 §4。
7. **未与并行单交互**：本单未触碰、未回退 `p1o-00-escape-sweep.ts` / `p2w-00-p2fix-verify.ts` / `docs/seafood.master-plan.md` 的在途改动；未 `pkill`/`killall` 任何进程；唯一写落盘见 §9。

---

## 12. 夹具与命令清单

| 文件 | 性质 | 说明 |
|---|---|---|
| `backend-ts/scripts/p3w-00-fold-narrow-verify.ts` | **自建探针**（纯函数 · 零 DB/网络 I/O） | 同进程加载 4 副本，跑 A/B/R/C/G 五组 + 判负；唯一落盘 = 自己的 run-tagged artifact + `.p3w-artifacts/_impl/**` 副本；同名拒写 |
| `backend-ts/.p3w-artifacts/_impl/baseline-ledger-errors.ts` | baseline 副本 | `git show 88783a2:…` ⇒ `721156cb…` |
| `backend-ts/.p3w-artifacts/_impl/fixed-ledger-errors.ts` | fixed 副本 | `git show HEAD:…` ⇒ `9bc127e4…` |
| `backend-ts/.p3w-artifacts/_impl/mutated-clause3b-ledger-errors.ts` | 判负副本（探针生成） | 复原第二子句 ⇒ `d6bcf5c8…` |
| `backend-ts/.p3w-artifacts/p3w-00-fold-narrow-verify-20260928T163708Z.json` | **有效读数**（run 3） | 全部判定依据 |
| `…-20260928T163654Z.json` / `…-20260928T163629Z.json` | 复现 / 作废读数 | 保留可回溯（§5.4、§11.1） |
| `backend-ts/.p3w-artifacts/p3w-00-run2-stdout.log` / `p3w-00-run3-stdout.log` / `p3w-tsc-narrow.log` | 命令原始输出 | 退出码由调用方直接取 |

**可重跑命令（逐字）**：

```bash
cd /Users/kevin/bistro/seafood/backend-ts
npx ts-node --transpile-only --compilerOptions '{"module":"commonjs","moduleResolution":"node","target":"ES2020","esModuleInterop":true}' scripts/p3w-00-fold-narrow-verify.ts
# 退出码直接取；tsc：
npx tsc --noEmit > .p3w-artifacts/p3w-tsc-narrow.log 2>&1; echo $?
```

夹具构造要点：真 `ws.ErrorEvent` 走**绝对路径** `node_modules/ws/lib/event-target.js`（自证 `ctor.name='ErrorEvent'`、`instanceof globalThis.Event=false`、`type='error'`）；毒 getter 用 `Object.defineProperty(o, key, { get: () => { throw … } })`；判负副本的锚点命中数校验 = 1（否则探针拒绝生成）。

**报告章节**：`## ` 级标题共 **13** 节（0–12）。

---

## 13. Unit I（P3-ERRORS-NARROW-2）判据② 收窄 —— 交付、对拍、判负自证

> 追加节（**0–12 节逐字未改**）。本节所有读数出自 `backend-ts/.p3w-artifacts/p3w-01-narrow2-verify-20260928T174943Z.json`
> （`PROBE_EXIT=0`、`hard_fail=[]`）与 `.p3w-artifacts/p3w-01-tsc-narrow2.log`。三态口径：
> `baseline` = `git show 88783a2:` 内容 sha256 `721156cb…`；`fixed` = `git show ade3376:` `9bc127e4…`；
> `narrowed2` = 工作树 `src/ledger-errors.ts` `5a671354…`。**均按内容 sha256 自证（不用 `HEAD` 符号）。**

### 13.1 改动 diff 摘要（行号 + 行数）

| # | 位置（Unit H 旧行号） | 位置（Unit I 新行号） | 删 | 增 | 内容 |
|---|---|---|---|---|---|
| 1 | `:381-385` | `:381-400` | 5 | 20 | 裁定头注释 判据 ①/②/③ 说明整段更正：记明 `ws.Event` **非** `globalThis.Event` 子类 ⇒ 判据① 对真对象不成立；真对象 own props 空、`message` 为原型 getter 字符串 ⇒ **真对象由判据② 命中、判据② 是承重子句、不得删除**（删除 ⇒ 真对象回流 500 ⇒ 破坏 `DL126`）；判据③ 只覆盖 own getter-only 形态（旧注释「真对象落③」的说法已删） |
| 2 | `:401-402` | `:416-422` | 2 | 7 | **判据② 本体收窄**：`if (safeRead(e, 'type') === 'error') return true;` ⇒ `if (safeRead(e, 'type') === 'error' && typeof safeRead(e, 'message') === 'string') return true;`（**两读均经 `safeRead`**；代码行 = 现盘 `:422`）+ 6 行承重说明注释 |
| 3 | `:403` | `:423-424` | 1 | 2 | ③ 段首注释改写（明写「只覆盖 own getter-only」且真对象**不落**本条） |

**合计：2 个 hunk / 3 个改动点，删 8 行、增 29 行、净 +21 行**（636 → 657，`wc -l` 实测 657 行；
`grep -n "typeof safeRead(e, 'message') === 'string') return true"` ⇒ `:422`（判据②）与 `:435`（判据③，**逐字未动**）；
`grep -c 'type\'\\) === \'error\'\\) return true;'` 裸判据残留 = **1**（即判据① 内部的 `:414`，其外层已有 `instanceof` 闸门，**非**判据②）。
`:425-428`（Unit H 的「原第二子句已删除」说明）**逐字未动**。判据①（`:404-415`）与判据③（`:423-435`）**语义逐字未动**。

### 13.2 三态逐形态对拍表（A/B/R/C/G 全形态 × baseline / fixed / narrowed2）

读数格式 = `code/status/classify`（`classify` = `classifyNonPgError` 返回值）。**含 mutant 列**（判负用，见 13.5）。

| id | 组 | 期望（Unit I 口径） | baseline | fixed | **narrowed2** | mutant_c2 | 判定 |
|---|---|---|---|---|---|---|---|
| A1 真 `ws.ErrorEvent`（绝对路径） | A | `FAMILY_503` | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | `LEDGER_TX_TIMEOUT/503/driver_connection_error` | **`LEDGER_TX_TIMEOUT/503/driver_connection_error`** ✔ | 同 narrow2 | PASS |
| A2 `Object.freeze({type:'error',message})` | A | `FAMILY_503` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/503/driver_connection_error`** ✔ | 同 | PASS |
| A3 own getter-only 字符串 `message`（无 type） | A | `FAMILY_503` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/503/driver_connection_error`** ✔ | 同 | PASS |
| A4 **`{type:'error'}`（无 message）** | A | **`BASELINE_EQ`（500）**（★勘误） | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error`** ✔=baseline | **`/503/`**（RED） | PASS |
| B1 `new Error()` | B | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔=baseline | 同 narrow2 | PASS |
| B2 `new TypeError()` | B | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔ | 同 | PASS |
| B3 `Object.create(Error.prototype)` | B | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔ | 同 | PASS |
| B4 `Object.create({message:'x'})` | B | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔ | 同 | PASS |
| B5 `new Event('open')` | B | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔ | 同 | PASS |
| B6 **`new Event('error')`** | B | **`ACCEPT_503`（接受项）**（★勘误） | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/503/driver_connection_error`**（判据①单独命中） | 同 | PASS（登记项） |
| B7 **`{type:'error',payload}`** | B | **`BASELINE_EQ`（500）**（本单修复目标） | `LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`LEDGER_TRANSACTION_REQUIRED/500/unclassified_non_pg_error`** ✔=baseline | **`/503/`**（RED） | PASS |
| R1 原型 getter-only `message`、无 type | R | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔=baseline | 同 | PASS |
| R2 类原型数据属性 `message`、无 type | R | `BASELINE_EQ` | `/500/unclassified_non_pg_error` | `/503/driver_connection_error` | **`/500/unclassified_non_pg_error`** ✔=baseline | 同 | PASS |
| C1 `22003`（Error 实例+code） | C | `CONTROL_EQ` | `/500/`(null) | 同 | 同 | 同 | **三态逐字节等** ✔ |
| C2 `22003`（裸对象） | C | `CONTROL_EQ` | `TR/500/null` | 同 | 同 | 同 | ✔ |
| C3 命名码 `LD016` | C | `CONTROL_EQ` | `TR/500/null` | 同 | 同 | 同 | ✔ |
| C4 `ECONNRESET` | C | `CONTROL_EQ` | `TX/503/driver_connection_error` | 同 | 同 | 同 | ✔ |
| C5 池超时 `timeout exceeded when trying to connect` | C | `CONTROL_EQ` | `TX/503/pool_connection_timeout` | 同 | 同 | 同 | ✔ |
| C6 `socket hang up` | C | `CONTROL_EQ` | `TX/503/driver_connection_error` | 同 | 同 | 同 | ✔ |
| C7 `08P01`（排除项） | C | `CONTROL_EQ` | `TR/500/null` | 同 | 同 | 同 | ✔ |
| C8 `23514`+`account_bal_guard` | C | `CONTROL_EQ` | `LEDGER_NEGATIVE_BALANCE_GUARD/500/null` | 同 | 同 | 同 | ✔ |
| C9 `23505`+`ledger_idem_uniq` | C | `CONTROL_EQ` | `LEDGER_IDEMPOTENCY_CONFLICT/409/null` | 同 | 同 | 同 | ✔ |
| C10 `57014` | C | `CONTROL_EQ` | `TX/503/null` | 同 | 同 | 同 | ✔ |
| C11 `53000` | C | `CONTROL_EQ` | `TX/503/null` | 同 | 同 | 同 | ✔ |
| C12 命名码 `LEDGER_TX_TIMEOUT` | C | `CONTROL_EQ` | `TX/503/null` | 同 | 同 | 同 | ✔ |
| C13 无 name 裸对象 | C | `CONTROL_EQ` | `TR/500/unclassified_non_pg_error` | 同 | 同 | 同 | ✔ |
| G1 `message` getter 抛 | G | `NO_THROW` | **`THREW`** | **`THREW`** | `TR/500/unclassified_non_pg_error`（**不抛**）✔ | 同 | PASS |
| G2 `code` getter 抛 | G | `NO_THROW` | **`THREW`** | **`THREW`** | `TR/500/unclassified_non_pg_error`（**不抛**）✔ | 同 | PASS |
| G3 `type` getter 抛 | G | `NO_THROW` | `TR/500/unclassified_non_pg_error` | **`THREW`** | `TR/500/unclassified_non_pg_error`（**不抛**）✔ | 同 | PASS |
| G4 `error` getter 抛 | G | `NO_THROW` | `TR/500/…` | `TR/500/…` | `TR/500/unclassified_non_pg_error`（**不抛**）✔ | 同 | PASS |
| G5 `message`+`code` 同时抛 | G | `NO_THROW` | **`THREW`** | **`THREW`** | `TR/500/unclassified_non_pg_error`（**不抛**）✔ | 同 | PASS |

**组级结论（机读字段）**：
- **A 组：PASS**，`A_fail = []`（n=4）。A1/A2/A3 = 503/`LEDGER_TX_TIMEOUT`/`driver_connection_error`；A4 = **500 == baseline**。
- **B 组：PASS**，`B_fail = []`（n=7）；`B_mismatch_vs_baseline = ["B6_globalEvent_error"]`（**唯一**不与 baseline 相等者 = 已登记的接受项，非失败）。
- **R 组：PASS**，R1/R2 `narrowed2_eq_baseline` 均为真（均回 500）。
- **C 组：PASS**，`C_mismatch = []`，**13/13 三态逐字节相同**。
- **G 组：PASS**，`G_threw = []`（5/5 不抛，读数确定）。
- **总体**：`hard_fail = []`、`PROBE_EXIT = 0`。

### 13.3 `ws_event_instanceof_global_event` 读数（★回归守卫，可机读）

| 字段 | 读数 | 说明 |
|---|---|---|
| **`ws_event_instanceof_global_event`** | **`false`** | `new ws.Event('open') instanceof globalThis.Event` ⇒ **false**。**guard_pass = true**（断言失败即 `hard_fail`+非零退出，本 run 未触发） |
| `globalThis.ErrorEvent` | `"undefined"` | Node 18.19 无全局 `ErrorEvent` |
| `require('ws').ErrorEvent` | `"undefined"` | `ws@8.22.0` 的 `exports` 映射不导出该构造器 ⇒ **必须**走绝对路径 `node_modules/ws/lib/event-target.js` |
| `wsET_export_keys` | `["CloseEvent","ErrorEvent","Event","EventTarget","MessageEvent"]` | 绝对路径 require 的导出面 |
| `ctor.name` | `"ErrorEvent"` | 真对象自证 |
| `own_prop_names` | `[]` | **真对象 own props 为空** ⇒ 判据③ 的 own 描述符子句对真对象**不成立** |
| `own_message_descriptor` | `null` | 同上 |
| `proto_message_getter_is_fn` / `proto_message_setter_present` | `true` / `false` | `message` 在原型上是 **getter、无 setter** |
| `typeof e.message` / `e.type` | `"string"` / `"error"` | ⇒ **判据②（type==='error' ∧ typeof message==='string'）命中** |
| `wsEE_has_own_type` | `false` | `type` 也在原型上（`Event.prototype.type`） |

### 13.4 毒 getter 三读数（AC 指定三形态 + 2 附加形态）

口径：`code` / `status` / `details.reason` 三读数，**不得抛**。

| 形态 | `code` | `status` | `details.reason` | 抛异常？ |
|---|---|---|---|---|
| G1 **`message` getter 抛** | `LEDGER_TRANSACTION_REQUIRED` | `500` | `unclassified_non_pg_error` | **否** |
| G2 **`code` getter 抛** | `LEDGER_TRANSACTION_REQUIRED` | `500` | `unclassified_non_pg_error` | **否** |
| G3 **`type` getter 抛** | `LEDGER_TRANSACTION_REQUIRED` | `500` | `unclassified_non_pg_error` | **否** |
| G4 `error` getter 抛（诊断面） | `LEDGER_TRANSACTION_REQUIRED` | `500` | `unclassified_non_pg_error` | **否** |
| G5 `message`+`code` 同时抛 | `LEDGER_TRANSACTION_REQUIRED` | `500` | `unclassified_non_pg_error` | **否** |

诊断面（`ledgerErrorDiagnostics`）在 G1–G5 下同样**不抛**（artifact `G_poison[*].diagnostics_narrowed2.threw = null`）。
⚠️ 对照：`baseline`/`fixed` 在 G1/G2/G5 三格**整体抛**（`THREW`）—— 该三格**不是**本单引入的回归（Unit H 已收口），列此仅为对拍完整性。

### 13.5 判负三段（红 / 绿 / 还原）

变异体 = 从 `narrowed2` **单点去掉判据② 的 `message` 合取**（回到 `if (safeRead(e, 'type') === 'error') return true;`）。
**锚点命中数校验 = 1**（`mutation_anchor_hits = 1`，≠1 则探针**拒绝生成**变异体）；`mutation_diff_line_count = 1`。

| 段 | 断言 | 实测 | 判定 |
|---|---|---|---|
| **红** | 去掉合取后 A4 与 B7 **回流 503** | `RED_set_mutated_c2 = ["A4_type_error_no_message","B7_business_envelope_type_error"]`，两者 = `LEDGER_TX_TIMEOUT/503/driver_connection_error`；`red.mutated_c2_all_503 = true` | **红 ✔** |
| **绿** | 现盘 `narrowed2`：A4/B7 = **500 == baseline** | `GREEN_set_narrowed2 = [A4, B7]`；`green.narrowed2_all_500 = true`、`green.narrowed2_eq_baseline = true` | **绿 ✔** |
| **还原** | 反向单行替换即回到 `narrowed2`；且**工作树全程未被写** | `worktree_sha_before_run = worktree_sha_after_run = 5a671354…`、`worktree_unchanged_by_run = true`；变异体写的是 artifact 目录下**独立副本** `_impl/mutated-clause2-narrow2-ledger-errors.ts`（sha `e7b39540…`）；`restore.mutated_c2_eq_fixed_column = true` | **还原 ✔（口径见 13.8.2）** |

三态 sha256（自证）：
- `baseline` = `721156cbf296b19c7c4a480264f88b49878d99104b8f87453bafce564745df8b`（`baseline_sha_match = true`）
- `fixed` = `9bc127e4942cb219fc7eeb3cb17997e724d90433b030619f207341bd35ed983d`（`fixed_sha_match = true`）
- `narrowed2` = `5a671354eb7bfd6707bb27a48a1e661b73745a63de59c5201957a602006bf3c4`（`narrowed2_sha_match = true`）
- `mutated_c2` = `e7b3954069abaeaa600e5cbe196378a8f63287e701c4f9d3b50285fd2d7c2f17`（判负体）
- 广义 RED 面（与 baseline 不一致的 id 集）：`baseline=[]`／`fixed=14 项`／`narrowed2=7 项`／`mutated_c2=9 项`（含 `A4`/`B7` 两项差异 ⇒ 合取是二者的唯一区分量）。

### 13.6 Zang 勘误表（A4 与 B6：原期望作废 —— 为什么 / 新期望）

| 项 | 原期望（作废） | 为什么作废 | **新期望（已执行并实测）** |
|---|---|---|---|
| **A4** `{type:'error'}`（无 `message`） | 503（事件对象族） | 真 `ws.ErrorEvent` 的 `message` 是**原型 getter 字符串**，而 `{type:'error'}` 连 `message` 键都没有 ⇒ `safeRead(e,'message') === undefined` ⇒ 判据② 的 `typeof message === 'string'` **不成立**；判据① 要求 `instanceof globalThis.Event`（普通对象不满足）；判据③ 要求 **own** 描述符（无）⇒ 三判据皆不成立 ⇒ 落 `unclassified_non_pg_error`（不在 `TRANSIENT_NON_PG_REASONS`）⇒ **500** | **500 / `LEDGER_TRANSACTION_REQUIRED` / `unclassified_non_pg_error`，且 `narrowed2 == baseline`**（实测）；去掉合取后回流 503 ⇒ 该勘误即判负的承重点 |
| **B6** `new Event('error')` | 「== baseline（500）」 | 它是**标准**事件对象：判据① = `instanceof globalThis.Event ∧ type === 'error'` **成立** ⇒ 即使判据② 加了 `message` 合取，它仍命中（**503**），不可能回到 baseline 的 500 | **仍 503（`LEDGER_TX_TIMEOUT` / `driver_connection_error`）= 接受项，不要求 == baseline**（实测）。⚠️ 附注：AC 括注「判据①∧② 命中」**不精确** —— 实测 global `Event` **无** `message`（`safeRead(e,'message') === undefined`）⇒ 命中来自**判据① 单独**，判据② **不**命中；结论（503）不变 |

### 13.7 `tsc --noEmit` 读数

```
TSC_NOEMIT_EXIT=0          # 直接重定向 `> .p3w-artifacts/p3w-01-tsc-narrow2.log 2>&1; echo $?`（非管道，§5.7② 合规）
```
`p3w-01-tsc-narrow2.log` **0 行**输出（`wc -l` = 0，即无诊断信息）。**退出码 0 = 通过**。

### 13.8 未验证清单（未测一律 `NOT_MEASURED` / `null`）

| # | 项 | 状态 | 原因 / 口径 |
|---|---|---|---|
| 1 | **端到端**：连接层逼出真事件对象 ⇒ 穿路由层 ⇒ 观察 HTTP 503/500 | `NOT_MEASURED` | 本单 **DB 零写**、禁跑写库套件、不做在线故障注入；只在纯函数层（`classifyNonPgError`/`normalizeLedgerError`/`ledgerErrorDiagnostics`）取证 |
| 2 | **「删除整个判据② ⇒ 真 `ws.ErrorEvent` 回流 500」的单点变异实测** | `NOT_MEASURED` | 本单变异体**只去掉 `message` 合取**（判据② 主体保留）⇒ 对真对象**无影响**（A1 在 mutant 列仍 503）。13.1/13.6 中「删本条 ⇒ 真对象回流 500」是**推理**，由两条**实测**支撑：`instanceof globalThis.Event === false`（判据① 不成立）+ `own_prop_names === []`（判据③ 不成立）；**直接变异体未造**（预算） |
| 3 | 自有 getter **+ setter** 的 `message` 形态 | `NOT_MEASURED` | 本单未构造；判据③ 第一子句逐字未动 ⇒ 按构造行为不变 |
| 4 | 源文件/`wsE` 之外其它依赖（非 `ws`）的误捕/漏捕面 | `NOT_MEASURED` | 未做全依赖扫描 |
| 5 | 生产流量中 `{type:'error'}` / `{type:'error',payload}` 业务信封的出现频率 | `NOT_MEASURED` | 无生产流量数据；本单只证形态存在与归类变化 |
| 6 | 毒 getter 在**路由/进程层**的表现 | `NOT_MEASURED` | 无 HTTP 层实证；只证分类路径不抛 |
| 7 | 毒 `name` getter（`errName` 仍直读） | `NOT_MEASURED`（登记残余） | `errName` 按禁项**不动** ⇒ `name` getter 抛时兜底分支仍会抛；本单未构造（AC 只要求 `message`/`code`/`type`） |
| 8 | §14 码闭集**指纹**（`LEDGER_ERROR_TABLE`/`BUCKETS` sha）在 narrowed2 下的重算 | `NOT_MEASURED`（口径替代） | 改用「diff hunk 包含关系」判定未触及 |
| 9 | 「还原」的**端到端重跑**（把变异体写回工作树再跑一次绿） | `NOT_MEASURED` | 工作树被硬边界禁止写入 ⇒ 只做「独立副本 + 工作树 sha 未变 + 单行 diff」的等价论证 |
| 10 | Unit H 报的 DB 指纹 / 迁移读数 | `NOT_MEASURED` | 本单 DB 零写、不连库 ⇒ 不读取、不比对 |

### 13.9 探针缺陷自曝（§5.7④）

1. **首跑编译期失败（未落盘 artifact、不计入 run）**：`npx ts-node scripts/p3w-01-narrow2-verify.ts` 抛 `TSError`（3 类：`safe<T>` 泛型收窄为 `boolean` 与 `'THREW'` 冲突；`safe()` 返回值 `PropertyDescriptor|'THREW'` 联合；print 段对 G 行误取 `.per_impl`），`PROBE_EXIT=1`。因是**编译期**失败，**没有任何 artifact 落盘** ⇒ 不存在「非零退出的 artifact 被误采信」的问题。修正后 run = `20260928T174943Z`（`PROBE_EXIT=0`）。
2. **★ 同型缺陷重复**：print 段「对派生行误取 `.per_impl`」与 Unit H §11.1 第 1 条**同型**（那次的 `[G]` 打印段，这次是五组打印段）⇒ 说明该模式是**复发性**的，不是一次性手误。已在本节显式登记。
3. **`RED.restore.restored_column_equals_narrowed2` 是硬编码 `true`（非实测）**：其字段注释写「由 `mutation_diff_line_count === 0` 支撑」—— **该注释错误**（实测 `mutation_diff_line_count = 1`，不是 0）。真正支撑「反向单行替换即还原」的只有三条间接证据：锚点唯一（hits=1）、单行 diff（=1）、工作树 sha before==after。**该字段应读作「论证」而非「实测」**（对应 13.8 #9 的 `NOT_MEASURED`）。这是本单的口径错误，**自曝不掩**。
4. **`baseline` 无 `isEventObjectFamily`**：`git show 88783a2:` 中该函数**不存在**（Unit E 才引入；`grep` 实测 0 命中）。故 A4/B7 的「== baseline」语义是「== **无判据态**」，**不是**「== 判据② 裸态」；「判据② 裸态」的读数单独由 `fixed` 列给出（A4/B7 = 503），以免混淆。13.2 表已两列并列。
5. **判负的覆盖面**：单点变异（去合取）只让 **A4/B7** 回流，**不能**让 B1–B5 回流（那需要恢复 Unit H 已删的判据③ 第二子句）⇒ 与 Unit H §11.4 同型：**单点变异 ≠ 完整回退**，两种口径**不合并陈述**。
6. **外部事件（须登记）**：本单运行期间仓库 `HEAD` 由 `209e556` 推进到 **`0eda41a`**（含 `166836a`），系**其它会话**提交 Unit H 的 artifact + 本报告 + master-plan；本单**未** `git add/commit/push`。**工作树 `src/ledger-errors.ts` sha 在推进前后均为 `5a671354…`**（`narrowed2_sha_match = true`）⇒ 本单结论不受该推进影响。`p3x-*`（另一单的并行面）本单**零触碰**。
7. **未与并行单交互**：未触碰 `backend-ts/scripts/p3x-*`、`backend-ts/.p3x-artifacts/**`、`docs/audit/p3-d20-rebuild-dryrun.md`；未 `pkill -f`/`killall`（本单未 kill 任何进程）；未起长驻 server；未 `execute_code`；未 `npm install`；未覆写 `p3w-00-*` 或 `_impl/` 既有副本（本单新增文件：`scripts/p3w-01-narrow2-verify.ts`、`.p3w-artifacts/p3w-01-narrow2-verify-20260928T174943Z.json`、`.p3w-artifacts/p3w-01-tsc-narrow2.log`、`.p3w-artifacts/_impl/mutated-clause2-narrow2-ledger-errors.ts`）。
8. **本节的独立性有限（须声明）**：对拍夹具由我自行构造，`classifyNonPgError` / `normalizeLedgerError` 均是**被验证方本体**的直接调用（非重写）⇒ 能证「归类变化」，**不能**证「生产上一定会收到该形态」。

**本节追加后**：`## ` 级标题共 **14** 节（0–13）。本报告追加后的 sha256 **由终局 `read_file` 复核后写入交付摘要**（不在本节内预填数值——预填未经复核实测的哈希即造假，§5.7⑩）。
