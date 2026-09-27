# P1i · 收口验收报告（Kong 实现方）

> 状态：**恢复轮（P1j）取证 + F3 专项收尾（p1f-03）均已完成**；§2–§12 **全部已回填**（本轮补 §3 / §4 / §7 / §10 / §11）。
> **〔P1n 回退轮，Kong，2026-09-27〕** 新增 **§13**：**派单前提更正**（`cid <= 0` 在 DB 侧从来不是 400，
> 实测 `LD007`/404 ⇒ 上一轮把它改成 400 反而引入了原本不存在的 TS/DB 不一致）**+ `toCid` 逐字回退回 404**；
> 同轮修 **§7.3 误格**（`lock_timeout_lockwait_raw_55P03_when_no_handler` 按落盘 json 改 `false`，加更正行）
> 与 **§7.5**（chain 终局码两个合法值 + run-tagged 回读）。本轮**未改 DB 侧**、未新建迁移、未 commit。
> 仓库：`/Users/kevin/bistro/seafood`　分支：`main`（不 commit / 不 push，Zang 做）
> 上游单：P1f 修复轮 + F3 专项单。上一轮（R3-P1i-b）结束时库处于**撒谎态**（注册表记 `0004`、函数对象是首版 0005），
> 本轮第一件事即**重新应用修改后的 0005**，把注册表与文件 sha256 对齐（见 §2）。
> 本轮读数落盘于 `.p1f-artifacts/p1j-*`（`p1j-migrate-1/2.json`、`p1j01-f1-after.json`、
> `p1j02-f2-after.json`、`p1j-smoke-api.txt`、`p1j-smoke-db.txt`、`p1j-tsc.txt`、`p1j-read.json`）。
> **F3 专项（本轮）新增读数**：`.p1f-artifacts/p1f03-f3-readings.json`（六项超时/预算/基础设施实测）、
> `.p1f-artifacts/p1f03-ts-four-changes.diff`（TS 四处改动逐字 diff）、
> `.p1f-artifacts/p1f03-forget-gate.txt`（forget 工具三道闸的拒绝路径实测 + 拒绝后 `schema_migration` 逐行）。
> 提交定位更正：本单原述 `f1f0f0f` **在库中不存在**，实际为 `8677e65`（父 `9a26a2f`），详见 §3 抬头。

## 0. 本轮范围与交付物

| # | 项 | 状态 |
| - | - | - |
| 1 | `0005_ledger_event_root_key.sql` 应用 + 幂等（跑两次） | **✅ 已验（§2）** |
| 2 | `src/ledger.ts` `normalizeIdempotencyKey` 字符集收紧（`#` / 控制字符） | **✅ 见 §3①**（逐字 before→after + 归档 diff） |
| 3 | `src/ledger.ts` `RETRYABLE_SQLSTATES += 'LD027'` | **✅ 见 §3②**；行为读数见 §7.2（仪表抓到 1×LD027 ⇒ 重试后恰好一次生效） |
| 4 | `src/ledger.ts` `findByKey` 改 `event_root_key` 精确归属 | **✅ 见 §3③**（含修前前缀算术的逐字 before） |
| 5 | `src/ledger-errors.ts` 基础设施类 → `LEDGER_TX_TIMEOUT` 503 | **✅ 见 §3④**；DB↔TS 同集同码对拍见 §7.6 |
| 6 | 新发现 M31（`amount` 超 R66 上限）/ M43（`1e5` 指数形式） | **✅ 见 §4**（根因 + §D2 四条款逐条校对，含修前 `accepted_200` 基线） |
| 7 | F1 修后同场景对比（`p1f-01 --assert`） | **✅ 14/14（§5）** |
| 8 | F2 修后 52 例闭集自检（`p1f-02 --assert`） | **✅ 全绿（§6）** |
| 9 | F3 修后读数（预算钳位 / 55P03 / 40P01 / 基础设施 / 6 持锁链总等待） | **✅ 全部取到（§7）** |
| 13 | `p1i-forget-migration.ts` 加 `--force` 闸 + 头注释（裁定 D） | **✅ 见 §12 尾「闸门实测」块**（拒绝路径实测：三道闸 exit=3、零连接、零删行；原「见 §13」为悬空引用，§13 号位已被 P1n 回退轮占用） |
| 10 | 回归：`tsc --noEmit` / `ledger-smoke` 29 / `ledger-smoke-db` | **✅ 见 §8** |
| 11 | §11 判据 1/8 归零；R79 `lock_trace`；面板；基座 sha256 | **✅ 见 §9** |
| P1n-1 | **回退轮**：`cid <= 0` 的**派单前提更正**（DB 侧从来不是 400，实测 `LD007`/404）+ `toCid` 逐字回退回 404 | **✅ 见 §13.1–13.4**（三段读数 + TS/DB 对拍表） |
| P1n-2 | 本轮回归全部重跑（`tsc` / 两份冒烟 / F1 / F2）+ 取证脚本保留登记 | **✅ 见 §13.5 / §13.6**（F1 14/14、F2 三硬判据归零） |

## 1. 改动文件清单（逐字）

本轮（P1j）**新增/改动**：

| 文件 | 动作 | 说明 |
| - | - | - |
| `migrations/0005_ledger_event_root_key.sql` | **重新应用**（文本为上轮改后版，sha256 `4de12361cf7df2038438d79200fbca68de4f57821e324a2ce0681bae439f0231`） | §C 抬头纪律改为可机读：`input⇒400 / integrity⇒400\|404\|409 / retryable\|infra⇒503 / defect⇒500`；三条 23514 守卫（`account_bal_guard`/`account_frz_guard`/`ledger_after_guard`）标 `defect`，`currency_supply_guard` 标 `integrity`，其余 23514 与 `ledger_kind_enum` 标 `input` |
| `scripts/p1f-02-f2-malformed.ts` | 改（探针公式） | `bucketOk` 按冻结纪律重写 + 新增判据 `no_500_class_outside_defect_bucket`（见 §6） |
| `scripts/p1j-read.ts` | 新建（只读取证） | 取 checksum 对齐 / 行数与归属列 / 判据 1 与判据 8（两口径）/ R79 `lock_trace` / 平台账户读数 |
| `.p1f-artifacts/p1j-*` | 新建（读数落盘） | 见文件头 |

**未动**（逐字遵守硬约束）：`0001`–`0004` 三个基座与 `0004`；`qa-p1e-*.ts`/`qa-p1b-*.ts`/`p1c-*.ts`/`p1e-*.ts` 质检资产；
`docs/**`；`frontend/**`；`schema_migration`（本轮**零**删除/改写行）；未新建 `0006`；
`scripts/p1i-forget-migration.ts` 本轮**未执行**；未做 `user`→`users` 改名；未 commit/push。

上轮已落笔、本轮补逐字 before→after 并归档 diff（见 §3）：`src/ledger.ts`、`src/ledger-errors.ts`。

**F3 专项（本轮）新增/改动**：

| 文件 | 动作 | 说明 |
| - | - | - |
| `scripts/p1f-03-f3-timeouts.ts` | **新建**（本轮证据主体） | 六项超时/预算/基础设施分类的「实测生效」原始读数；含运行时仪表（包 `Pool.prototype.query`，抓被 TS 重试循环吞掉的 LD027）、`pg_stat_activity` 语句级观察器与 DB 侧等待采样器 |
| `scripts/p1i-forget-migration.ts` | 改（裁定 D） | 头注释加「**只用于尚未交付的迁移；已 push 的迁移一律不得使用**」；新增 `--force` 显式闸（不带即拒绝）；保留 `0001–0004` 硬拒；拒绝路径**不建池、不连库、不写行** |
| `.p1f-artifacts/p1f03-f3-readings.json` | **新建**（读数落盘） | 本轮 F3 全部原始读数 |
| `.p1f-artifacts/p1f03-ts-four-changes.diff` | **新建**（归档） | `git diff 9a26a2f 8677e65 -- backend-ts/src/{ledger,ledger-errors}.ts`，194 行，sha256 `5ef550a9…4563` |
| `.p1f-artifacts/p1f03-forget-gate.txt` | **新建**（读数落盘） | forget 工具三道闸的拒绝实测 + 拒绝后 `schema_migration` 逐行 + `tsc --noEmit` |
| `backend-ts/.p1f-artifacts/p1f-acceptance.md` | 改（回填） | 本轮补 §3/§4/§7（含 §7.1–7.7）/§10/§11，并补 §12 的 F3 数据与闸门实测块 |

**未动**（逐字遵守硬约束）：`0001`–`0004`；质检资产 `qa-p1e-*.ts`/`qa-p1b-*.ts`/`p1c-*.ts`/`p1e-*.ts`；
`docs/**`；`frontend/**`；**已存在的** `.p1f-artifacts/*` 原始读数文件（只新增，未覆盖）；
`schema_migration`（本轮**零**删除/改写行，见 §12 闸门实测块 / `.p1f-artifacts/p1f03-forget-gate.txt`，仅执行了拒绝路径）；未新建 `0006`；
未做 `user`→`users` 改名；未 commit/push；未重启任何面板托管服务。

## 2. 0005 应用与幂等

命令：`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts; echo $?`（退出码取自命令本身，非管道尾）

**第 1 次（恢复）** — `.p1f-artifacts/p1j-migrate-1.json`，`exit=0`：

| 版本 | action | 读数 |
| - | - | - |
| 0001 | `skipped` | already applied, checksum match |
| 0002 | `skipped` | already applied, checksum match |
| 0003 | `skipped` | already applied, checksum match |
| 0004 | `skipped` | already applied, checksum match |
| **0005** | **`applied`** | checksum `4de12361cf7d…`，`ms=3754` |

`schema_version = "0005"`；`public_base_table_count = 6`（account / currency / ledger_entry / ledger_owner / schema_migration / user）。

**第 2 次（幂等）** — `.p1f-artifacts/p1j-migrate-2.json`，`exit=0`：
`action=skipped` **5/5**（0001–0005 全 `already applied, checksum match`，含 0005），`schema_version = "0005"`。

**checksum ↔ 文件 sha256 对齐**（`.p1f-artifacts/p1j-read.json` → `checksum_alignment`，`all_checksums_match = true`）：

| 版本 | 文件 sha256（前 12） | `schema_migration.checksum` | match | applied_at |
| - | - | - | - | - |
| 0001 | `4f902d3c4750` | `4f902d3c4750…` | ✅ | 2026-09-27T03:48:15.617Z |
| 0002 | `688b1935f6bc` | `688b1935f6bc…` | ✅ | 2026-09-27T03:48:20.093Z |
| 0003 | `f268e03075eb` | `f268e03075eb…` | ✅ | 2026-09-27T04:57:40.944Z |
| 0004 | `55fd1ce8085b` | `55fd1ce8085b…` | ✅ | 2026-09-27T05:26:01.859Z |
| **0005** | **`4de12361cf7d`** | **`4de12361cf7d…`** | ✅ | 2026-09-27T06:34:21.897Z |

**`/health`（127.0.0.1:5788）**：`HTTP 200` → `{"ok":true,"schema_version":"0005",…}`
（迁移后 06:34:57 **一次**，全部实验跑完后 06:40:24 **再一次**，两次均为 `0005`）。
⇒ 「注册表 / 文件 / 对外健康端点」三者一致，上一轮的撒谎态**已消除**。

## 3. TS 侧四处改动（逐处 before → after，逐字）

**归档**：`.p1f-artifacts/p1f03-ts-four-changes.diff` —— 194 行，
sha256 `5ef550a91cb05e98144b5e9ed5feaa57b91ca1d7652c17e6a265822e85694563`。

**提交定位更正（重要，勿再引用错 hash）**：本单原述提交 `f1f0f0f` **在库中不存在** ——
`git cat-file -t f1f0f0f` → `fatal: Not a valid object name f1f0f0f`。
逐字定位（`git log -2 --format='%H %s'`）得到的实际链条是：

```
30ea111f682f2ed67dec61229f2489f50d3486b7 master-plan v0.16: 撒谎态消除 + §5.12 P1e 验收有条件通过（…唯一待闭合 D-03 超时实测）
8677e65b50841e92bfaf1fc1e556202e1bf593aa fix(P1i): 修 P1e 质检 3 缺陷 —— 0005 事件根键 + 错误面归类 + 预算钳位
9a26a2f   master-plan v0.15: §5.11 …
```

⇒ 本单说的「f1f0f0f」= **`8677e65`**（其父 `9a26a2f`），故存档命令为
`git diff 9a26a2f 8677e65 -- backend-ts/src/ledger.ts backend-ts/src/ledger-errors.ts`。
`--stat` 读数：`ledger-errors.ts` **+57**、`ledger.ts` **+71 / −6**，合计 **122 insertions, 6 deletions**。

**① `src/ledger.ts` · `normalizeIdempotencyKey` 字符集收紧**（diff hunk `@@ -326,6 +357,18 @@`）

before（修前 —— 前缀校验之后直接 `return key;`，再无任何字符集闸）：

```ts
  if (!IDEMPOTENCY_PREFIXES.some((p) => key.startsWith(p))) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', { reason: 'PREFIX_REQUIRED', provided: key.slice(0, 8) });
  }
  return key;
```

after（新增两道闸，顺序固定 `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`）：

```ts
  // ③ `#` = 内部派生键分隔符 ⇒ 调用方一律不许用（否则可构造出等于他人派生键的键）
  if (key.includes(DERIVED_KEY_SEPARATOR)) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', {
      reason: 'RESERVED_SEPARATOR',
      value: key.slice(0, 40),
      note: 'char # is reserved for internal derived entry keys (<key>#<i>)',
    });
  }
  // ④ 控制字符（C0/DEL）不得出现在键里
  if (CONTROL_CHAR_RE.test(key)) {
    throw new LedgerError('LEDGER_IDEMPOTENCY_KEY_INVALID', { reason: 'CONTROL_CHARACTER' });
  }
  return key;
```

同 hunk 另新增两处常量（`DERIVED_KEY_SEPARATOR = '#'` 导出、
`const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;`，注释逐字写明与 DB 侧 `v_key ~ '[[:cntrl:]]'` **同集**）。

**② `src/ledger.ts` · `RETRYABLE_SQLSTATES += 'LD027'`**（diff hunk `@@ -869,8 +922,14 @@`）

before（逐字）：

```ts
/** 可重试 SQLSTATE（R60：40001/40P01 同键重试；其余一律不重试） */
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']);
```

after（逐字）：

```ts
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01', 'LD027']);
```

（抬头注释逐字保留理由：「P1i：**必须**含 `'LD027'` …… 不同步这一项 = 死锁**不再被重试** = 行为回归（R60 形同失效）；
`'40001'` / `'40P01'` 保留：它们是**函数之外**（如只读路径、非账本语句）仍可能逃出的原始码。」）

**③ `src/ledger.ts` · `findByKey` 改 `event_root_key` 精确归属**（diff hunk `@@ -654,10 +697,20 @@`）

before（逐字 —— 字符串前缀算术，正是 F1 根因）：

```ts
const findByKey = async (key: string, tx?: TxClient): Promise<LedgerEntryRecord[]> => {
  const sql = `SELECT ${ENTRY_COLS} FROM ledger_entry
               WHERE idempotency_key = $1
                  OR left(idempotency_key, length($1) + 1) = $1 || '#'
               ORDER BY txid ASC`;
```

after（逐字）：

```ts
  const sql = `SELECT ${ENTRY_COLS} FROM ledger_entry
               WHERE event_root_key = $1
                  OR (event_root_key IS NULL AND idempotency_key = $1)
               ORDER BY txid ASC`;
```

（抬头注释逐字保留：「P1i（F1②）：改为按 `event_root_key` **精确归属** —— 删除了修前的
`left(idempotency_key, length($1)+1) = $1 || '#'` **字符串前缀算术**。那正是 F1 的根因：它会把他**人事件**的派生行
（`<别人根键>#<i>`）当成自己的重放结果返回。」；历史行仅按 `idempotency_key = $1` 精确等值兜底。）

**④ `src/ledger-errors.ts` · 基础设施类 → `LEDGER_TX_TIMEOUT`（503）**（两个 hunk：`@@ -183,6 +183,50 @@` 与 `@@ -267,6 +316,14 @@`）

before（修前：基础设施 SQLSTATE 全部落到文件末尾的 **500 类兜底** `LEDGER_TRANSACTION_REQUIRED`，
与「代码缺陷（R108 必须告警）」混为一谈；`08P01` 亦然）：

```ts
const isSqlstate = (code: string): boolean => /^[0-9A-Z]{5}$/.test(code);
// …（此处修前没有任何 infra 分类）
```

after（逐字，新增 infra 分类器 + 两处接线）：

```ts
export const infraSqlstateReason = (code: string): string | null => {
  if (INFRA_SQLSTATE_REASONS[code] !== undefined) return INFRA_SQLSTATE_REASONS[code];
  if (code === '08P01' || code === '57014') return null; // 见上方「两个排除项」
  return INFRA_CLASS_REASONS[code.slice(0, 2)] ?? null;
};
```

```ts
    case '08P01': // 启动协议参数错误：我方连接配置缺陷（**不是**瞬时故障）⇒ 500 类（R108 告警）
      return new LedgerError('LEDGER_TRANSACTION_REQUIRED', {
        cause: '08P01', reason: 'protocol_violation',
        error_name: 'ProtocolViolation', pg_code: '08P01',
      });
```

```ts
  // --- P1i（F3③）：基础设施类 ⇒ 503（可重试），**不得**落 500（见上方 INFRA_* 注释块）
  const infraReason = infraSqlstateReason(code);
  if (infraReason !== null) {
    return new LedgerError('LEDGER_TX_TIMEOUT', {
      reason: infraReason, pg_code: code, retryable: true, source: 'pg_infra_class',
    });
  }
```

`INFRA_SQLSTATE_REASONS` 九条逐字：`53300 too_many_connections` / `53200 out_of_memory` / `53100 disk_full` /
`57P01 admin_shutdown` / `57P02 crash_shutdown` / `57P03 cannot_connect_now` / `58030 io_error` /
`25006 read_only_transaction` / `3D000 database_unavailable`；
`INFRA_CLASS_REASONS` 五条：`53 insufficient_resources` / `57 operator_intervention` /
`58 system_error` / `08 connection_error` / `XX internal_error`。
**行为读数**（非仅代码）：见 §7.6 的 DB↔TS「同集同码」对拍与 `53300 / XX000` 直接读数。

## 4. 新发现 M31 / M43 处置（根因 + `0005` §D2 条文校对）

### 4.1 根因（修前读数，`.p1f-artifacts/p1f02-before.txt`）

`0004` 的 `ledger_payload_amount` 把 `amount_units` 放在**优先级首位**、命中即 `RETURN`
⇒ 同一 payload 里的 `amount` 字段**一个字都不校验**。因此：

| 用例 | 修前读数（逐字） |
| - | - |
| `M31_amount_over_cap`（`{amount_units:'1', amount:'1000000000000001'}`，超 R66/R71 单笔上限） | `"sqlstate": null, "ts_code": null, "status": null, "outcome": "accepted_200"` |
| `M43_amount_exponent`（`{amount_units:'1', amount:'1e5'}`，指数形式） | `"sqlstate": null, "ts_code": null, "status": null, "outcome": "accepted_200"` |

⇒ 两者都被**静默接受 200**（修前 `p1f02-before.txt` 摘要里正是 `M31_amount_over_cap  ✓ok`、`M43_amount_exponent  ✓ok`）。
这两个用例也是修前 `unmapped_escape: 7` / `status_500: 7` 之外**独立的一类**缺陷：不报错、但契约被绕过。

### 4.2 `0005` §D2 四条款逐条校对（条文 ↔ 实测）

`0005` §D2 抬头逐字主张四条修法，逐条对拍（读数来自 §6 的 `p1j02-f2-after.json` `results`）：

| §D2 条款（逐字） | 实测读数（逐字） | 判定 |
| - | - | - |
| ① 「两个字段**同时出现** ⇒ 400 `LEDGER_AMOUNT_INVALID` + reason=`AMBIGUOUS_AMOUNT`」 | `M31_amount_over_cap` → `sqlstate: LD016` / `db_message: LEDGER_AMOUNT_INVALID` / `status: 400` / `db_detail: {"note":"exactly one of amount (user decimal, R72) / amount_units (minimal unit, R66) is accepted","field":"amount","reason":"AMBIGUOUS_AMOUNT","provided":"amount,amount_units"}`；`M43_amount_exponent` 同码同 reason | **✅ 一致** |
| ② 「单给 `amount` ⇒ `ledger_parse_user_amount`（锚定白名单 + 指数形式显式拒绝）」 | `M43b_amount_only_exponent` → `LD016` / 400 / `{"field":"amount","value":"1e5","reason":"EXPONENT_NOT_ALLOWED"}` | **✅ 一致**（`EXPONENT_NOT_ALLOWED` 逐字命中 §D 新增 reason） |
| ③ 「单给 `amount_units` ⇒ `ledger_int_amount` + 真范围闸 + R71 单笔上限」 | `M01_amount_units_19x9` → 400 `OUT_OF_BIGINT_RANGE`（修前 22003/500）；`M08/M09` → 400 `NOT_DECIMAL_INTEGER`；`M39_amount_units_20_digits` → 400 `OVER_MAX_SINGLE_AMOUNT` | **✅ 一致** |
| ④ 「缺失 / 非字符串 ⇒ 400（MISSING / NOT_STRING，逐格保留 0004 口径）」 | F2 闭集 52 例中相关各例全部 400 且 `in_closed_set=true`（§6） | **✅ 一致** |

**§D2 抬头里一句「对外 API 零破坏」的旁证校对**（易被当成口号，故逐字核）：
§D2 称「TS 侧 `amountToPayload` 恒只发其中一个 ⇒ 对外 API 零破坏」。
逐字读源码 `src/ledger.ts:1099`：

```ts
const amountToPayload = (v: Amount, field = 'amount'): Record<string, string> =>
  (typeof v === 'string' ? { amount: v } : { amount_units: toAmount(v, field).toString() });
```

⇒ 是三元表达式，**恒只产生 `amount` 或 `amount_units` 之一**；调用点 `postEvent`（`src/ledger.ts:1076`）为
`if (input.amount !== undefined) Object.assign(payload, amountToPayload(input.amount));`。
**§D2 的这句主张成立**（`AMBIGUOUS_AMOUNT` 闸不会打到 TS 自己的写路径）。

**一处口径提示（不构成缺陷，供 spec 同步时留意）**：`M31b_amount_only_over_cap` 的 DETAIL `value` 是
`"100000000000000100"`（= 用户十进制 `1000000000000001` × 10²），即 R72 语义下换算后的**最小单位**；
报告与 spec 引用该值时勿误读成「入参原值」。

## 5. F1 修后同场景对比（`p1f-01 --assert`）

命令：`npx ts-node --transpile-only scripts/p1f-01-f1-collision.ts --assert; echo $?` → **`exit=0`**
读数：`.p1f-artifacts/p1j01-f1-after.json` → **`verdicts` 14 条全 `true`，`failures: []`，`pass: true`（14/14）**。

关键读数（同脚本、同场景）：

| 场景 | 读数 |
| - | - |
| 方向① B 用 A 的派生键（`…:coll:a#2`） | `B.ok=false`，`LD005 / LEDGER_IDEMPOTENCY_KEY_INVALID / reason=RESERVED_SEPARATOR`（**400 拒收**，不再静默丢弃却报成功） |
| 方向① A 事件完好 | A = 2 条分录 `txid 1896/1897`，`root=ops:p1h:MUJG2X9H:coll:a`；`A_rows_all_attributed=true` |
| 方向② 先 `…#2` 再落正常键 | `prefixed_event` = `LD005` 400；`legit_event` = `ok, replay=false, txid=1898, entries=2`，`legit_event_bogus_conflict_409=false` |
| legacy 撞键（历史 `#` 派生行，归属列为 NULL） | `LD024 / LEDGER_TRANSACTION_REQUIRED / reason=derived_key_collision`（**响亮缺陷**，非伪 409）：`bogus_409_LD003=false`、`loud_defect_LD024=true`、`root_row_written=0`（无半成品）、`legacy_row_still_present=1` |
| 对照：同键重放 | `ok/replay=true`，`same_txid_as_first=true`，2 条分录（`txid 1896`），对方余额重放前后均 `1001050`（不重复扣账） |
| 对照：同键异指纹 | `LD003 / LEDGER_IDEMPOTENCY_CONFLICT` |
| **7/7 种 op 形状的 `#` 键** | `hash_key_rejection_all_400=true`，`hash_key_rejection_ok_shapes=[]`（空 = 无一漏网）；形状含 `mint / transfer / hold / hold_release / settle / entries / entries(entry-level #)` 全部 `LD005` |
| 结构取证 | `root_column=true`、`guard_constraint=1`、`wrong_root_rows=0`、`A_rows_all_attributed=true` |

## 6. F2 修后 52 例闭集自检（`p1f-02 --assert`）

命令：`npx ts-node --transpile-only scripts/p1f-02-f2-malformed.ts --assert; echo $?` → **`exit=0`**
读数：`.p1f-artifacts/p1j02-f2-after.json` → `pass: true`、`failures: []`、**23 条 verdict 全 `true`**。

三条硬判据 **全零**：`unmapped_escape = 0`、`status_500 = 0`、`not_in_closed_set = 0`（`cases_total = 52`）。
其余：`unregistered_raised_codes = []`、`classifier_missing = false`、
`classifier_bucket_status_violations = []`、`classifier_500_outside_defect_bucket = []`；
唯一被接受的用例仍是**唯一豁免** `accepted_200_cases = ["M32_from_uid_spaces"]`（`only_allowed_case_is_uid_spaces = true`）。

M31/M43 四例：`amount_over_cap_rejected_400`、`amount_over_cap_amount_only_400`、
`amount_exponent_rejected_400`、`amount_exponent_amount_only_400` **全 `true`**。

**本轮对探针公式的修正（有裁定背书，不是把红改绿）**：
上一轮唯一的红 `classifier_bucket_status_consistent` 来自**探针自己公式过严** —— 它把 `integrity`
一律钉成 `400`，与 §14.1 冻结的 `404/409`（如 `LEDGER_IDEMPOTENCY_CONFLICT=409`）冲突。本轮按
`0005` §C 抬头**冻结的**纪律重写为可机读形式：

```
input        ⇒ 400 类
integrity    ⇒ 400 | 404 | 409
retryable    ⇒ 503
infra        ⇒ 503
defect       ⇒ 500
```

并**新增**判据 `no_500_class_outside_defect_bucket`（「500 类码只可能来自 `bucket='defect'`」），
对 40 个 SQLSTATE 抽样逐个对拍 ⇒ 违规列表为空。修正只改**判据公式**，未放宽任何一条对**产品行为**
的断言（`unmapped_escape/status_500/not_in_closed_set` 三条硬判据与 20 条逐例断言一字未动）。

## 7. F3 修后读数

**证据主体**：`scripts/p1f-03-f3-timeouts.ts`（新增）→ 原始读数 `.p1f-artifacts/p1f03-f3-readings.json`（1311 行，34,438 字节）；
闸门读数 `.p1f-artifacts/p1f03-forget-gate.txt`。运行时间窗 `2026-09-27T06:56:10Z → 06:57:56Z`。

**环境自证**（探针开头即取，防「测的不是 0005」）：`schema_version = 0005`；`schema_migration` 5 行
（`4f902d3c4750 / 688b1935f6bc / f268e03075eb / 55fd1ce8085b / 4de12361cf7d`）；
`statement_timeout=0`、`lock_timeout=0`、`deadlock_timeout=1s`（⇒ 后续所有超时**只能**来自函数内自证预算，不是会话 GUC）；
`ledger_stmt_budget_ms()=10000`、`ledger_lock_timeout_ms()=3000`、`ledger_budget_remaining_ms(NULL)=10000`。

### 7.1 `55P03` → `LD025`（伙伴持锁，直调 `ledger_post_event`）

| 项 | 读数（逐字） |
| - | - |
| 键 | `ops:p1k:GT4OR:lkt` |
| 最终 SQLSTATE | **`LD025`**（`final_sqlstate`） |
| MESSAGE | `LEDGER_LOCK_TIMEOUT` |
| DETAIL | `{"reason": "lock_timeout", "pg_code": "55P03", "retryable": true, "lock_timeout_ms": 3000}` |
| 原始 `55P03` 是否逃出 | **`raw_55P03_escaped = false`**（DETAIL 里保留了 `pg_code=55P03` 作溯源，但 SQLSTATE 已不在 5 位类） |
| 用时 | `elapsed_ms = 3208`（≈ 钳位后的 `lock_timeout 3000ms` + 开销） |
| 写入 | `rows_written_0 = true`；`entries_for_key_after_fail = {by_root_key:0, debits:0, credits:0, exact_key_rows:0}` |
| 余额逐字未变 | 源 `988000 → 988000`（`balance_unchanged=true`），对手 `1000` 不变 |
| 同键重试 | 成功：`elapsed_ms=264`、`txid=2083`、`entries=2`（debit 1 / credit 1） |
| 重试后归属 | `by_root_key=2`、`debits=1`、`credits=1`、`exact_key_rows=1` ⇒ **恰 2 条流水、debit 恰一次** |
| 终态余额 | 源 `987000`、对手 `2000`（`idempotent_replay=false`，是新落账非重放） |

### 7.2 `40P01` → `LD027`（真死锁；DB 直调 + 公开 API 双路径）

**(a) 函数直调路径**（探针构造真死锁环；`pg_stat_database.deadlocks` 取样）：

| 项 | 读数（逐字） |
| - | - |
| 死锁增量 | `deadlocks_before=26` → `deadlocks_after=27`，**`deadlocks_delta=1`**（⇒ 真触发了 PG 死锁检测器，非伪造） |
| 被选为受害者前观测到等锁 | `lock_wait_seen={seen:true, waited_ms:839}`（`pg_stat_activity` 命中 `wait_event_type=Lock`，语句逐字 `SELECT ledger_post_event($1::jsonb) AS r`） |
| 最终 SQLSTATE | **`LD027`** / `LEDGER_DEADLOCK_RETRY_EXHAUSTED` |
| DETAIL | `{"reason": "deadlock_detected", "pg_code": "40P01", "retryable": true, "retry_owner": "caller", "retries_performed": 0}` |
| `retries_performed=0` / `retry_owner=caller` | 两条判据均 `true`（⇒ 函数**不吞不重试**，重试主权显式交给调用方） |
| 原始 `40P01` 逃出 | `raw_40P01_escaped = false` |
| 写入 | `rows_written_0=true`；`entries_for_key` 全 0 |

**(b) 公开 API 路径**（`postEvent` → HTTP → pooler，证明 TS 侧 `RETRYABLE_SQLSTATES` 含 `'LD027'` 真的把行为救回来）：

| 项 | 读数（逐字） |
| - | - |
| 键 | `ops:p1k:GT4OR:dd2` |
| 死锁增量 | `deadlocks_delta = 1`（等锁 `waited_ms=921`） |
| 捕获到的**内部** DB 错误（服务端 instrumentation 抓取） | `code=LD027`、`LEDGER_DEADLOCK_RETRY_EXHAUSTED`、DETAIL 同 (a)、`at_ms_from_call_ms=1905` |
| `captured_first_error_is_LD027` | `true`（⇒ TS 面对的**确实是** `LD027`，不是别的码） |
| 重试是否真的重发 | `retry_actually_reissued = true`；`distinct_fn_statements_observed = 3`，`fn_statements` 逐字：`1867|06:56:37.485033` / `8426|06:56:37.498404` / `1867|06:56:39.483579`（第 3 条 = 同键重发） |
| 最终结果 | `api_ok=true`、`api_txid=2085`、`api_entries_count=2`、`api_error=null`、`api_idempotent_replay=false`、`api_elapsed_ms=4068` |
| **不双扣** | A `1000→900`、B `1000→1100`；`sum_delta_A=-100` / `sum_delta_B=+100`；`findByKey` 返回 2 行、debit 恰 1 ⇒ **`no_double_debit = true`** |
| 归属列 | `by_root_key=2`、`exact_key_rows=1`（`findByKey` 走 `event_root_key` 精确归属） |

> 关键对照：若 TS 未把 `'LD027'` 同步进 `RETRYABLE_SQLSTATES`，路径 (b) 会在第一次 `LD027` 时**直接抛 503**，
> 而不会出现第 3 条同键函数语句。`retry_actually_reissued=true` 就是「R60 未被这次错误面归类改动打断」的机读证据。

### 7.3 `57014` / 预算耗尽 → `LD026`

**主读数走预算路径**（原因：见下方逃逸矩阵——`set_config('statement_timeout',…,true)` 对**自己那条语句**完全无效）：

| 探测 | 读数（逐字） |
| - | - |
| `ledger_check_budget(逾期 deadline, 'unit_probe')` | `LD026` / `LEDGER_TX_TIMEOUT` / DETAIL `{"stage":"unit_probe","reason":"statement_budget_exhausted","budget_ms":10000,"retryable":true,"remaining_ms":-1001}` |
| `ledger_arm_lock_timeout(逾期 deadline, …)` | 同码同 reason（`elapsed_ms=1033`） |
| 充裕/空 deadline 不误报 | `null_deadline_no_error=true`、`future_deadline_no_error=true` |

**真拿到 `57014` 的旁证读数**（先在**独立语句** `SET statement_timeout='600ms'`，`SHOW` 回读确认为 `600ms`，再调函数）：

| 项 | 读数（逐字） |
| - | - |
| `final_sqlstate` | `57014` / `canceling statement due to statement timeout`（`elapsed_ms=869`） |
| 是否被 §E 单一 EXCEPTION 处理器接住并转码 | **否** —— `raw_57014_escaped = true`，`final_detail_raw = null` |
| 写入 | `rows_written_0 = true`（无半成品） |

**逃逸矩阵（新发现，登记为 0005 的边界事实，不是回归）** —— 探针逐条新连接构造 5 组对照
（`escape_isolation_57014`，`lock_holder_uid=944030`；DO 块捕获到 `WHEN OTHERS` 就改抛 `ZZ999`）：

| 组 | 场景 | 观测 SQLSTATE | 被 plpgsql 接住？ |
| - | - | - | - |
| A1 | `statement_timeout` + 有 handler，**无等锁** | `57014` | ❌ |
| A2 | `statement_timeout` + 无 handler，**无等锁** | `57014` | ❌ |
| B1 | `statement_timeout` + 有 handler，**等锁中** | `57014` | ❌ |
| B2 | `lock_timeout` + 有 handler，等锁中 | `ZZ999`（内层捕获 `55P03` 后改抛） | ✅ |
| B3 | `statement_timeout` + 无 handler，等锁中 | `57014` | ❌ |
| B4 | `lock_timeout` + 无 handler，等锁中 | `55P03` | ❌（本层无 handler，预期） |
| B5 | `lock_timeout` + 裸 `FOR UPDATE`（不经函数） | 无错误（636ms 取到锁） | — |

**判据**：`statement_timeout_bypasses_plpgsql_handler = true`、`stmt_timeout_catchable_by_plpgsql = false`、
`lock_timeout_catchable_by_plpgsql = true`、`stmt_timeout_lockwait_raw_57014_when_no_handler = true`、
`lock_timeout_lockwait_raw_55P03_when_no_handler = **false**`。

> **F-2 更正：以落盘 json 为准** —— 本行原先写成 `true`，与本节**已引用的**落盘读数文件
> `.p1f-artifacts/p1f03-f3-readings.json`（run `H262V`）里的判据值**不符**：该文件
> `escape_isolation_57014.verdicts.lock_timeout_lockwait_raw_55P03_when_no_handler = **false**`
> （对应 B4 组 `{ok:true, elapsed_ms:1523, caught:false, sqlstate_seen:null, message:null}`，
> 即「无 handler 时 B4 **未**观测到逃逸的 `55P03`」）。故按落盘 json 改为 **`false`**，
> 不静默改（此处保留更正轨迹）。
>
> **同判据的不确定性（另注，不藏）**：run-tagged 复跑 `.p1f-artifacts/p1f03-f3-readings-I5XPD.json`
> （schema `0006`）同一判据读回 **`true`**（B4 `{ok:false, elapsed_ms:1372, caught:false,
> sqlstate_seen:"55P03"}`）。⇒ 该子探针（「裸 `FOR UPDATE`/无 handler 时逃逸出的 SQLSTATE 是
> `55P03` 还是空」）**两次运行读数不一致**，属**子探针级不确定性**，不是修复回归。
> 与本报告结论相关的部分**不受影响**：`lock_timeout_catchable_by_plpgsql = true`（B2 `ZZ999`）在两次运行
> **都是 true**，`lock_timeout` 可被 plpgsql 接住这一点稳定；而 `statement_timeout` 逃逸
> （A1/A2/B1/B3 全组 `57014`）两次运行也一致。⇒ 断言口径应写成「`lock_timeout` **可**被 handler 接住、
> `statement_timeout` **不可**」，**不得**把 B4 行当作确定性判据。

⇒ 口径（供 spec 同步）：**`57014` 不可能由函数内 §E 处理器转成 `LD026`**；DB 侧对它只有 §C 分类器可机读归类
（`retryable` 桶 → `LEDGER_TX_TIMEOUT`），TS 侧把它归入 `LEDGER_TX_TIMEOUT`/503。函数内自证预算
（`ledger_check_budget` / `ledger_arm_lock_timeout`）才是 `LD026` 的**唯一**产生源，这正是 §B 的设计前提。

### 7.4 预算钳位实测（`min(3s, 剩余)` 真的生效）

调用 `ledger_arm_lock_timeout(<deadline>, <label>)` 后立刻 `SHOW lock_timeout`：

| deadline | `lock_timeout` 读数 | `ledger_budget_remaining_ms` | 期望 | 判定 |
| - | - | - | - | - |
| `clock_timestamp() + 1s` | **`999ms`** | 999 | 1000ms | ✅（含调用开销 1ms） |
| `clock_timestamp() + 1500ms` | **`1499ms`** | 1499 | 1500ms | ✅ |
| `clock_timestamp() + 60s` | **`3s`** | 59999 | 3000ms（被 3s 常量封顶） | ✅ |
| `NULL` | **`3s`** | 10000 | 3000ms | ✅ |
| `clock_timestamp() - 1s` | 抛 **`LD026`** | -1001 | LD026 | ✅ |

⇒ 充裕时钳到 **3000ms**、紧张时钳到**剩余毫秒**（逐 ms 派生）、逾期直接 `LD026`，三个分支均有独立读数。

### 7.5 6 持锁链总等待（累计等待是否被钳到 ≤~10s）

> **终局码有两个合法值（本节的断言纪律，先读这段再看表）**：chain 用例的**终局码有两个合法值** ——
> **`LD025`**（末次等锁先撞 3s `lock_timeout`）或 **`LD026`**（10s 自证预算先耗尽）。
> 两次运行各命中一个（见下表「终局码（回读）」行）⇒ **断言只针对「等待有界」，不得钉死某个码**。
> 机读判据用落盘字段 `terminal_code_legal_set = ["LD025","LD026"]` / `terminal_code_in_legal_set` /
> `wait_bounded` / `clamped_to_le_10s`，**不要**写 `terminal_sqlstate === 'LD025'` 这类硬钉断言
> —— 那会在下一次运行随机变红（本报告 §7.5 上一轮漏的正是这次 run-tagged 回读，本轮补上）。

构造：6 个持锁者按 `spacing_ms=2600` 依次占用同一账户行（持锁者栅同步），调用方串行重试同一键
（`ops:p1k:I5XPD:chain6` / `ops:p1k:H262V:chain6`），每次等锁前都重新 `ledger_arm_lock_timeout`。

**读数（两列并置；左列 = 上一轮新产出的 run-tagged 文件，本轮**回读**并写进本节）**：

| 项 | `p1f03-f3-readings-I5XPD.json`（run `I5XPD`，schema `0006`） | `p1f03-f3-readings.json`（run `H262V`，schema `0005`） |
| - | - | - |
| 键 | `ops:p1k:I5XPD:chain6` | `ops:p1k:H262V:chain6` |
| 持锁者 / 间距 | 6 / `2600ms` | 6 / `2600ms` |
| 若**不**钳位的理论总等待 | `naive_total_wait_if_unclamped_ms = 15600` | `15600` |
| **修前**同场景实测参照 | `pre_fix_reference_ms = 15583` | `15583` |
| 旧宣称最坏值 | `legacy_claim_worst_ms = 48000` | `48000` |
| **实测总等待（客户端）** | **`11853 ms`** | **`11283 ms`** |
| DB 侧采样（`pg_stat_activity`） | `max_db_elapsed_ms = 10153`（`samples = 36`，`distinct_stmts = 1`） | `10142`（`samples = 39`，`distinct_stmts = 1`） |
| 客户端额外开销 | `client_overhead_ms = 1700` | `1141` |
| **终局码（回读）** | **`LD025`** / `LEDGER_LOCK_TIMEOUT`（`terminal_sqlstate` / `terminal_message`），DETAIL `{"reason":"lock_timeout","pg_code":"55P03","retryable":true,"lock_timeout_ms":0}` | **`LD026`** / `LEDGER_TX_TIMEOUT`，DETAIL `{"stage":"lock:wakeup","reason":"statement_budget_exhausted","budget_ms":10000,"retryable":true,"remaining_ms":-1}` |
| 终局码合法集判据 | `terminal_code_legal_set = ["LD025","LD026"]`、`terminal_code_in_legal_set = true`、`wait_bounded = true` | 该轮脚本尚无此三格（⇒ 正是本轮要补的回读） |
| 写入 | `rows_written_0 = true` | `true` |
| 钳位判据 | `clamped_to_le_10s = true` | `true` |

**诚实口径**：DB 侧单语句被预算钳在 **10153ms**（`I5XPD`）/ **10142ms**（`H262V`）（皆 ≤10s + 0.2s 收尾），
客户端总耗时 **11853ms** / **11283ms**，超出 10s 的部分全部来自客户端/连接开销（1700ms / 1141ms）
—— 不是等待被累加。对照修前 `15583ms` 与旧宣称 `48000ms`，
**累计等待的乘法效应确已被预算钳住**，但「可机读上限 10s」应理解为**语句级**而非端到端级（列入 §10②）。

### 7.6 基础设施类 → 503（端到端）

**(a) DB 侧分类器**（`ledger_error_for_sqlstate(state, constraint)`，40 个 SQLSTATE 抽样；`never_null=true`）：

| SQLSTATE | `code` | `bucket` | `reason` | `retryable` |
| - | - | - | - | - |
| `53300` | `LEDGER_TX_TIMEOUT` | **`infra`** | `too_many_connections` | true |
| `XX000` | `LEDGER_TX_TIMEOUT` | **`infra`** | `internal_error` | true |
| `53100` / `53200` / `57P01` / `57P02` / `57P03` / `58030` / `3D000` / `25006` | `LEDGER_TX_TIMEOUT` | `infra` | `disk_full` / `out_of_memory` / `admin_shutdown` / `crash_shutdown` / `cannot_connect_now` / `io_error` / `database_unavailable` / `read_only_transaction` | true |
| `57014` | `LEDGER_TX_TIMEOUT` | `retryable` | `statement_timeout_or_cancel` | true |
| `55P03` | `LEDGER_LOCK_TIMEOUT` | `retryable` | `lock_timeout` | true |
| `40P01` / `40001` | `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | `retryable` | `deadlock_detected` / `serialization_failure` | true |
| `08P01` | `LEDGER_TRANSACTION_REQUIRED` | **`defect`** | `protocol_violation` | false |
| `28P01` | `LEDGER_TRANSACTION_REQUIRED` | `defect` | `unclassified_db_error` | false |
| `23505`(无约束名) / `23514`(无约束名) / `23503` | 见 §6 | `integrity` / `input` | `UNIQUE_KEY_FAMILY_COLLISION` / `CHECK_VIOLATION` / `FK_VIOLATION` | false |

**(b) TS 侧 `normalizeLedgerError` 直接 raw 读数**（真实错误对象 / 分类器输出喂入）：

| SQLSTATE | TS `code` | TS `status` | `details` 关键字段 |
| - | - | - | - |
| `53300` | `LEDGER_TX_TIMEOUT` | **503** | `{reason:"too_many_connections", pg_code:"53300", retryable:true, source:"pg_infra_class"}` |
| `XX000` | `LEDGER_TX_TIMEOUT` | **503** | `{reason:"internal_error", pg_code:"XX000", retryable:true, source:"pg_infra_class"}` |
| `25006` / `53100` / `53200` / `57P01` / `57P02` / `57P03` / `58030` / `3D000` / `XX001` | `LEDGER_TX_TIMEOUT` | **503** | 各带 `source:"pg_infra_class"` |
| `57014` | `LEDGER_TX_TIMEOUT` | 503 | `{}`（走 SQLSTATE 表分支，**不是** `infraSqlstateReason` —— 该函数显式返回 `null` 排除 `57014`） |
| `40P01` | `LEDGER_DEADLOCK_RETRY_EXHAUSTED` | 503 | `{}`（可重试桶路径） |
| `55P03` | `LEDGER_LOCK_TIMEOUT` | 503 | `{}` |
| `08P01` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `{cause:"08P01", reason:"protocol_violation", error_name:"ProtocolViolation", pg_code:"08P01"}` ⇒ **刻意排除在 infra 之外** |
| `28P01` | `LEDGER_TRANSACTION_REQUIRED` | **500** | `{cause:"28P01", reason:"unclassified_pg_error"}` |
| `23505`(带约束名 `ledger_idem_uniq`) | `LEDGER_IDEMPOTENCY_CONFLICT` | **409** | 与 DB 侧同日 |
| `23514`(带约束名 `currency_supply_guard` / `account_bal_guard` / `ledger_kind_enum`) | `LEDGER_SUPPLY_CAP_EXCEEDED` 409 / `LEDGER_NEGATIVE_BALANCE_GUARD` 500 / `LEDGER_UNKNOWN_KIND` 400 | 同名同码 | — |
| `23503`(带约束名 `fk_account_cid`) | `LEDGER_CURRENCY_NOT_FOUND` | **404** | — |

**(c) DB↔TS 对拍判据**（18 组配对，含 12 组带约束名）：`all_bucket_status_ok = true`，
`violations = []`（§C 的 bucket 纪律：`input⇒400` / `integrity⇒400|404|409` / `retryable|infra⇒503` / `defect⇒500`
全部满足）；`all_codes_match = false`，唯一不符项是 **探针自造的假约束名 `other_unique`**
（DB 只认已登记的 `ledger_idem_uniq`，故回落 400 `LEDGER_AMOUNT_INVALID`，而 TS 侧按 `constraint` 白名单
不给 409）—— 属**探针输入**，非产品缺陷。
**(d) 「500 类码只可能来自 defect 桶」**：`bucket_status_ok` 逐组 `true`，且 F2 侧独立判据
`classifier_500_outside_defect_bucket = []`（§6）⇒ 两侧同结论。
**(e) 面向用户的最终面**：`LEDGER_TX_TIMEOUT` → `status=503`、`message="系统繁忙，请稍后重试"`。

### 7.7 本轮 F3 新增测试数据（uid `944xxx` / symbol `P1K…` / 键 `ops:p1k:*`）

| 类型 | 值 |
| - | - |
| currency | `cid=92`、`symbol=P1KGT4OR`、`owner_uid=944001`、`decimals=2` |
| account | `944001`（源，seed 后 988000）、`944002`（对手）、`944011–944014`、`944021–944026`、`944030`（持锁者），frozen 全 0 |
| 幂等键 | `…:seed:mint`、`…:seed:fanout`、`…:lkt`、`…:lkt#2`（内部派生）、`…:dd1`、`…:dd2`、`…:stmt57014`、`…:chain6` |
| 落账 | `txid 2083/2084`（7.1 重试）、`2085`（7.2b API）；未触碰 `cid=1` 与平台账户（只读） |
| 收尾不变量 | `negatives=0`、`wrong_root_rows=0`、`ledger_entry` 总行 1566、`cid=1` 平台账户 `uid 0/-1/-2/-3` 全 `balance=0 frozen=0` |

## 8. 回归验收

| 项 | 命令 | 读数 |
| - | - | - |
| `tsc --noEmit` | `npx tsc --noEmit -p tsconfig.json; echo $?` | `exit=0`，输出 **0 行**（⇒ **0 error**）；`.p1f-artifacts/p1j-tsc.txt` |
| `ledger-smoke`（API 路径） | `npx ts-node --transpile-only scripts/ledger-smoke.ts` | `exit=0`；`{"passed":29,"failed":0}`，`checks` 29 条（`.p1f-artifacts/p1j-smoke-api.txt`） |
| `ledger-smoke-db`（DB 直调） | `npx ts-node --transpile-only scripts/ledger-smoke-db.ts` | `exit=0`；`summary {"passed":11,"failed":0}`，`checks` 11 条全 `pass:true`（`.p1f-artifacts/p1j-smoke-db.txt`） |

## 9. 不变量与基座

| 项 | 读数 | 出处 |
| - | - | - |
| **§11 判据 1**（账户级守恒差异行） | **0 行**（写完测试数据后复读仍 **0 行**） | `p1j-read.json` → `judgement1_rows: 0` / `post_write_judgement1_rows: 0` |
| **§11 判据 8 · 键族（口径①：归属列优先，历史行回退 `split_part(idempotency_key,'#',1)`）** | **0 行** | `judgement8_bykey_mixed_rows: 0` |
| **§11 判据 8 · 键族（口径②：纯键前缀算术，无视归属列 = 历史行口径）** | **0 行** | `judgement8_bykey_prefixonly_rows: 0` |
| **§11 判据 8 · ref 形状** | **0 行** | `judgement8_byref_rows: 0` |
| `ledger_entry` 行数 / 归属列 | 总数 **1462**（读取时点）＝ 历史行（`event_root_key IS NULL`）**1307** + 新协议行 **155** | `p1j-read.json` → `ledger_entry` |
| 归属列结构守卫反例 `wrong_root_rows` | **0** | `p1j-read.json` / F1 `structure` |
| **R79 `meta.lock_trace`** | `mint` = `["currency:84","account:943001:84"]`；多账户 `entries`（payload 里故意乱序 943003/943001/943002）= `["account:943001:84","account:943002:84","account:943003:84"]` ⇒ **currency(cid) → account(uid 升序)** 成立 | `p1j-read.json` → `lock_trace_mint` / `lock_trace_entries` |
| **面板** | **16/16 `state=running`**（无 `foreign`/`stopped`/`unhealthy`），实验跑完后再取一次仍 16/16 | `curl 127.0.0.1:5555/api/status` |
| 基座 sha256（0001–0005） | 与 `schema_migration.checksum` **5/5 逐字一致**（`all_checksums_match=true`）；0001–0004 与开工基线一致（`4f902d3c…`/`688b1935…`/`f268e030…`/`55fd1ce8…`） | `p1j-read.json` → `checksum_alignment` |
| **平台账户**（`cid=1`，只读） | `uid 0 / -1 / -2 / -3` 全部 **`balance=0 frozen=0`** | `p1j-read.json` → `platform_accounts_cid1` |

> 历史行数说明（诚实口径）：本轮开轮时历史行按上游单记为 **1305**；`p1j-read` 读取时点为 **1307**。
> 差 2 行均来自 `p1f-01` 的 legacy 撞键用例**按设计** raw 插入的「pre-0005 派生行」模拟行
> （`memo='legacy simulation (pre-0005 derived row)'`）：本轮运行 1 行 `txid 1902`
> （`ops:p1h:MUJG2X9H:coll:legacy#2`），另 1 行 `txid 1883`（`ops:p1h:MUJFVAU8:coll:legacy#2`）
> 属同一会话**早前一轮** F1 运行的同类模拟行。二者都是 `event_root_key IS NULL` 的历史口径行，
> 已被判据 8 的两种口径覆盖且均为 0 行。

## 10. 未验证面（逐条，不掩饰）

F3 五项（预算钳位 / 基础设施 503 / `55P03` / `40P01` / 累计等待）**本轮已取得真机读数**（§7）。
以下**仍未验证**（不得读作已验）：

① **`57014` 的 DB 内转码**：`statement_timeout` **不可能**被 plpgsql handler 接住（§7.3 逃逸矩阵 5/5 组证实），
   故「函数把 `57014` 转成 `LD026`」这条路径**不存在**；`LD026` 只能由 §B 预算助手产生。
   若 spec 曾以此为前提，须按 §11 同步。
② **端到端 10s 上限**：预算钳的是**单条语句**（DB 侧实测 10106ms），客户端总耗时实测 10897ms（+791ms 客户端开销）。
   「端到端 ≤10s」**未验证**，也未实现。
③ **持锁链只在单账户单键规模验证**：6 持锁者 / 1 键；更高并发、多账户交叉、跨 `currency` 的累计等待未取读数。
④ **池化路径的连接级超时**：pooler 端点拒绝 `options` 启动参数（`08P01`，上轮亲测），
   故连接级 `statement_timeout` 在池化路径**不可用**；本轮所有预算探测均走非池化/直连语义，池化下的等价性未验证。
⑤ **`xact` 级 `set_config(..., true)` 对自身语句无效**已在 §7.3 登记为坑，未探究其它 GUC 注入方式。
⑥ **0005 之外任何新迁移**：本轮明确不建，未验证。
⑦ **`p1i-forget-migration.ts` 的「删除路径」**：本轮只验证**拒绝路径**（`.p1f-artifacts/p1f03-forget-gate.txt` 读数 A/B/C：`db_connections_opened=0`、
   `rows_deleted=0`、exit 3）。真删除路径**未执行**（硬约束禁止）；其历史副作用只在本轮被「重新应用 0005」覆盖，
   未经独立负向验证（无法回头再验，如实登记）。
⑧ **死锁路径的 `pg_stat_database.deadlocks` 计数是全库口径**：`26→27`（直调）与 `+1`（API）均在本库无其它
   并发写负载时取样，未做长时窗漂移校正。
⑨ **`ledger_error_for_sqlstate` 的「never NULL」** 只在 **40 个 SQLSTATE 抽样**上验证，非全定义域穷举。

## 11. 需 spec 同步的行清单

逐条（行 = spec/迁移条文；读数出处 = 本报告 §）：

| # | 需同步的行 | 现状 | 应写成 | 出处 |
| - | - | - | - | - |
| S1 | `0005` §C 的 bucket 纪律表述 | 修前口径把 `integrity` 一律钉成 400，与 §14.1 冻结的 `404/409` 冲突 | `input⇒400 类` / `integrity⇒该约束对应的 400\|404\|409（绝不 500）` / `retryable\|infra⇒503` / `defect⇒500`；并追加可机读判据「**500 类码只可能来自 `defect` 桶**」 | §6、§7.6(c)(d) |
| S2 | `0005` §D2 新增 reason `AMBIGUOUS_AMOUNT` | 两字段同时出现修前被静默接受 200 | 400 `LEDGER_AMOUNT_INVALID` + `reason=AMBIGUOUS_AMOUNT`，逐字 | §4.2①、§6 |
| S3 | `0005` §D 新增 reason `EXPONENT_NOT_ALLOWED` | `amount:'1e5'` 修前静默接受 | 400 + `reason=EXPONENT_NOT_ALLOWED`（`ledger_parse_user_amount` 锚定白名单） | §4.2② |
| S4 | `event_root_key` 列 + `ledger_event_root_guard` 结构守卫 | spec 无此列、无守卫 | 列 + 守卫约束 + 「归属列优先、历史行 `idempotency_key` 精确等值兜底」的查询口径 | §3③、§5、§9 |
| S5 | `0005` §B 预算助手语义 | 未写明 `LD026` 的**唯一**产生源与「剩余≤0 ⇒ 直抛」 | `ledger_stmt_budget_ms()=10000` / `ledger_lock_timeout_ms()=3000` / `ledger_arm_lock_timeout` = `min(3s, 剩余)` / 逾期 ⇒ `LD026 reason=statement_budget_exhausted` | §7.3、§7.4 |
| S6 | **新增行**：`statement_timeout` 绕过 plpgsql 处理器 | spec 隐含「§E 单一处理器接住一切」 | 显式写明：`set_config('statement_timeout',…,true)` 对自身语句无效；`statement_timeout` **不被** plpgsql `EXCEPTION` 接住（`57014` 原样逃出）；只有 `lock_timeout` 可接（`55P03`） | §7.3 逃逸矩阵 |
| S7 | `§14.1` 已登记码表 | 缺 `LD025` / `LD026` / `LD027` 三条 | `LD025=LEDGER_LOCK_TIMEOUT(503)` / `LD026=LEDGER_TX_TIMEOUT(503)` / `LD027=LEDGER_DEADLOCK_RETRY_EXHAUSTED(503)` | §7.1–7.3、§7.6 |
| S8 | R60 重试口径 | 只写 `40001/40P01` | 追加 `LD027`（TS `RETRYABLE_SQLSTATES` 必须含 `'LD027'`，否则死锁不再重试 = R60 形同失效）；`40001/40P01` 保留为函数外原始码 | §3②、§7.2(b) |
| S9 | TS 键字符集闸 | 只写前缀要求 | 追加：禁 `#`（`RESERVED_SEPARATOR`，内部派生键分隔符）、禁 C0/DEL（`CONTROL_CHARACTER`），与 DB 侧 `v_key ~ '[[:cntrl:]]'` 同集 | §3①、§5 |
| S10 | 基础设施类归 503 | 修前 infra SQLSTATE 全落 500 兜底 | `53300/53200/53100/57P01/57P02/57P03/58030/25006/3D000` + 类前缀 `53/57/58/08/XX` ⇒ `LEDGER_TX_TIMEOUT` 503；**显式排除** `08P01`（⇒500 缺陷告警）与 `57014`（移交 SQLSTATE 表分支） | §3④、§7.6(b) |
| S11 | `M31b_amount_only_over_cap` DETAIL `value` 语义 | 易被读成「入参原值」 | 注明其为 R72 语义下换算后的**最小单位**（`1000000000000001` × 10² = `"100000000000000100"`） | §4.2 末注 |
| S12 | 「最坏等待」声明 | 旧宣称最坏 48000ms | 改为**语句级**预算上限 10000ms（实测 DB 侧 10106ms；端到端含客户端开销另计） | §7.5、§10② |

## 12. 本轮新建测试数据清单

分区纪律：uid **943xxx**、symbol 前缀 **`p1j`**、键前缀 **`ops:p1j:*`**；未触碰 `cid=1` 与平台账户（只读）。

**`scripts/p1j-read.ts`（run `MUJG7B26`）**

| 类型 | 值 |
| - | - |
| currency | `cid=84`，`symbol=P1JMUJG7B26`，`owner_uid=943001`，`decimals=2`，`status=listed`，`supply_cap=100000000000`，`total_supply=2000000` |
| account | `943001/84`（balance 999000）、`943002/84`（500400）、`943003/84`（500600），frozen 全 0 |
| 幂等键 | `ops:p1j:MUJG7B26:read:seed:mint`、`…:read:seed:xfer:943002`、`…:read:seed:xfer:943003`、`…:read:order:entries` |
| ledger_entry | 8 行（mint 1 + 两笔 transfer 各 2 + entries 3），**归属列非空** ⇒ 计入「新协议行」155 |

**`scripts/p1f-01-f1-collision.ts --assert`（本轮 run `MUJG2X9H`）**

| 类型 | 值 |
| - | - |
| currency | `cid=77`，`symbol=P1HMUJG2X9H`，owner `942001`，`total_supply=3000000` |
| account | `942001 / 942002 / 942003 / 77`；**+ 历史口径模拟行**：`941009/77`（balance 1） |
| 幂等键 | `ops:p1h:MUJG2X9H:coll:*`（seed:mint / seed:xfer:* / a / a#2 / p / p#2 / h / h:rel / 7 形状拒收键 / legacy / legacy#2…） |
| 特别登记 | **1 行 `event_root_key IS NULL`**：`txid 1902`，`ops:p1h:MUJG2X9H:coll:legacy#2`（legacy 撞键用例**故意** raw 插入，模拟 pre-0005 派生行） |

**`scripts/p1f-02-f2-malformed.ts --assert`（本轮 run `MUJG3WBO`）**

| 类型 | 值 |
| - | - |
| currency | `cid=78`，`symbol=P1HMUJG3WBO`，owner `942001`，`total_supply=1000000` |
| account | `942001 / 942002 / 78` |
| 幂等键 | `ops:p1h:MUJG3WBO:seed`、`…:seed2`、`…:mal:*`（52 例里成功落账的极小集合） |

**F3 专项（本轮 run `GT4OR`，`scripts/p1f-03-f3-timeouts.ts`）**

| 类型 | 值 |
| - | - |
| currency | `cid=92`，`symbol=P1KGT4OR`，`owner_uid=944001`，`decimals=2` |
| account | `944001`（988000 → 987000）、`944002`（1000 → 2000）、`944011–944014`、`944021–944026`、`944030`（持锁者），frozen 全 0 |
| 幂等键 | `ops:p1k:GT4OR:{seed:mint, seed:fanout, lkt, lkt#2, dd1, dd2, stmt57014, chain6}` |
| ledger_entry | `txid 2083/2084`（7.1 同键重试）、`2085`（7.2b API 路径）；失败尝试均 `rows_written_0=true` |
| 特别登记 | `…:lkt#2` 为**内部派生行**（`event_root_key=ops:p1k:GT4OR:lkt`），用于验证「恰 2 条流水、debit 恰一次」 |

**闸门实测（Zang 裁定 D，`scripts/p1i-forget-migration.ts` 加固后）**

| 场景 | 读数 |
| - | - |
| `0005` 不带 `--force` | `{ok:false, refused:true, reason:"FORCE_REQUIRED", db_connections_opened:0, rows_deleted:0}`，`EXIT_A=3` |
| `0004 --force` | `{refused:true, reason:"BASE_PROTECTED", protected_versions:[0001..0004]}`，`EXIT_B=3` |
| 无参 | `{refused:true, reason:"USAGE"}`，`EXIT_C=3` |
| 拒绝后 `schema_migration` 逐行 | **仍 5 行**（0001–0005 全在，`4de12361cf7d` 未动），`EXIT_D=0` |
| 收尾 | `TSC_EXIT=0`；面板 `health5788=200` |

**冒烟**：`ledger-smoke.ts`（run `ujg5ih4`，uid 900001/900002/900003 + `cid=1` 只读、`unit_cid=79` `smkujg5ih4`）、
`ledger-smoke-db.ts`（run `g6ahk`，uid 920021/920022、`cid 80–83` `p1eS/p1eT/p1eE/p1eK`）。
本轮**未**执行任何清理（`purge-test-data.ts` 未运行），上述数据全部留在库中，供 Zang 裁定后续清理。

## 13. P1n 回退轮：派单前提更正 + `toCid` 逐字回退（Kong，2026-09）

> 本节 = 本轮回退轮的完整登记与原始读数。**先读 13.1（前提更正），再看 13.2/13.3 的对拍表。**
> 开工 HEAD：`35d030d master-plan v0.19 …`；本轮**不 commit / 不 push**；**未改 DB 侧**（13.1 末条）。

### 13.1 派单前提更正（登记，不得静默）

| # | 项 | 内容 |
| - | - | - |
| ① | 原派单前提 | Zang 原裁定「形状非法 = 400；形状合法但不存在 = 404」——**但派单把 `cid <= 0` 错归为「形状非法」**，并据此写下「**DB 侧已是 400**」这句 |
| ② | 实测证伪 | DB 侧 `ledger_cid_arg('0')` / `ledger_cid_arg('-5')` **自 `0004` 起一直是** `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / **404** / DETAIL `{"cid":"0"}` / `{"cid":"-5"}`。出处：`.p1f-artifacts/p1n-tocid-shape-before.json`（run `I0AUQ`，B1/B2）+ 本轮复测 `.p1f-artifacts/p1n-tocid-shape-revert-IE4VH.json`（B1/B2/B10 同读） |
| ③ | 后果 | **改之前 TS 与 DB 两侧本来就一致（都是 404）**；上一轮把 `src/ledger.ts` 的 `toCid` 改成 `LEDGER_AMOUNT_NOT_POSITIVE/400`，**引入了一个原本不存在的不一致**（不是「修复偏差」） |
| ④ | 本轮回退 | `toCid` 逐字回到 **404 `LEDGER_CURRENCY_NOT_FOUND` + `{ cid }`**（见 13.4）；注释块与文件头 ⑤ 条整段重写，**删除**「DB 侧已是 400」这一被证伪的说法 |
| ⑤ | 重新裁定口径（本轮执行，不自行推导） | `cid`/`uid` 等**标识符**参数 —— **形状非法**（非十进制整数 / 空 / 超 bigint / 缺失）⇒ **400 `LEDGER_AMOUNT_INVALID`** + `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` + `details.field`（`LEDGER_AMOUNT_INVALID` 是历史码名，被兼用作「参数形状非法」码，靠 `details.field` 区分字段，**不新增错误码**）；**形状合法但该行不存在 ⇒ 404**，**`cid <= 0` 与负数属于这一类**（`currency.cid` 是正整数序列，构造上不存在） |
| ⑥ | 上一轮注释里的**错配**一并删除 | 旧注释把 `ledger_parse_user_amount` 的非正分支当作「对齐目标」——那是**用户输入金额**解析器，与 **cid 标识符**闸无关（其实测 `LD017` 读数仅作对照保留在取证文件 B5） |
| ⑦ | **DB 侧未改动、且无需改动** | `git status --porcelain backend-ts/migrations/` → **空输出**；`schema_migration` 仍 **6 行**（`0001`–`0006`，checksum 见 13.5）；`pg_proc` 函数体指纹：`ledger_cid_arg` = `md5(prosrc) 244789f42fcd035c6555faa7f3f9c1f7`（209 B）、`ledger_int_amount` = `840260502d07279f4cec6a7b1b771c1d`（963 B）、`ledger_post_event` = `0cf1bb98ee3a30da55b1620c309d5541`（42449 B）⇒ **它本来就是对的** |

### 13.2 三段读数（同一脚本、同一组用例；三份文件都在，互不覆盖）

| 段 | 文件 | run | TS 侧 `cid='0'` 读数（`getCurrency('0')` / `transfer` 同码） |
| - | - | - | - |
| ① **最初**（回退前的 before） | `.p1f-artifacts/p1n-tocid-shape-before.json` | `I0AUQ` | `LEDGER_CURRENCY_NOT_FOUND` / **404** / `{"cid":"0"}` |
| ② **中间被改错的 400**（上一轮 after） | `.p1f-artifacts/p1n-tocid-shape-after.json` | `I5JZU` | `LEDGER_AMOUNT_NOT_POSITIVE` / **400** / `{"field":"cid","value":"0"}` |
| ③ **回退后的 404**（本轮新文件，权威） | `.p1f-artifacts/p1n-tocid-shape-revert-IE4VH.json` | `IE4VH` | `LEDGER_CURRENCY_NOT_FOUND` / **404** / `{"cid":"0"}`（与 ① **逐字相同**） |

- 本轮**两个 phase 都重跑过**，文件名一律带 run tag：`p1n-tocid-shape-before-ID5Z7.json`（run `ID5Z7`）、
  `p1n-tocid-shape-after-IDNFQ.json`（run `IDNFQ`）—— 回退后**三个 phase 读数全部为 404**
  （回退把契约恢复成最初的 404 ⇒ 同轮复现与 ①/③ 一致；② 的 400 只存在于上一轮的 `I5JZU` 文件里）。
- 每份文件自带**不写账本自证**：`rows_touched = {ledger_entry_before:"92", ledger_entry_after:"92", wrote_nothing:true}`
  （三个 phase 一致）；`env.schema_version = 0006`（`schema_migration` 6 行 0001–0006）。
- 用例数：TS 14 例（A1–A14）、DB 直调 11 例（B1–B11）、DB 全路径 6 例（P1–P6），**三个 phase 同组同数**。
- 原始 stdout：`.p1f-artifacts/p1n2-shape-before.txt` / `p1n2-shape-after.txt` / `p1n2-shape-revert.txt`。

### 13.3 TS vs DB **逐字对拍**表（★ 验收对拍，第 1 组 = 5 个指定入参）

TS = `src/ledger.ts` 公开写接口 `transfer`（uid `947001`→`947002`，`amount:'1'`）；
DB = **全路径** `SELECT ledger_post_event($1::jsonb)`（同 op 形状 `transfer`，同 uid，键前缀 `ops:p1o:`）。
读数出处：`.p1f-artifacts/p1n-tocid-shape-revert-IE4VH.json`（`ts_cases` × `db_path_cases`）。

| `cid` 入参 | TS `transfer`（code / status / details） | DB `ledger_post_event`（SQLSTATE / MESSAGE / DETAIL） | HTTP | 判定 |
| - | - | - | - | - |
| `'0'` | `LEDGER_CURRENCY_NOT_FOUND` / **404** / `{"cid":"0"}` | `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `{"cid":"0"}` | 404 / 404 | ✅ **逐字一致** |
| `'-5'` | `LEDGER_CURRENCY_NOT_FOUND` / **404** / `{"cid":"-5"}` | `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `{"cid":"-5"}` | 404 / 404 | ✅ **逐字一致** |
| `'abc'` | `LEDGER_AMOUNT_INVALID` / **400** / `{"field":"cid","reason":"NOT_DECIMAL_INTEGER"}` | `LD016` / `LEDGER_AMOUNT_INVALID` / `{"field":"cid","value":"abc","reason":"NOT_DECIMAL_INTEGER"}` | 400 / 400 | ✅ 码 / status / `field` / `reason` 逐字一致；DB 侧多一个 `value` 键（**0004/0005 既有形态，非本轮引入**） |
| `''` | `LEDGER_AMOUNT_INVALID` / **400** / `{"field":"cid","reason":"NOT_DECIMAL_INTEGER"}` | `LD016` / `LEDGER_AMOUNT_INVALID` / `{"field":"cid","value":"","reason":"NOT_DECIMAL_INTEGER"}` | 400 / 400 | ✅ 同上（空串走形状分支，两侧都不是 404） |
| `'999999999999'` | `LEDGER_CURRENCY_NOT_FOUND` / **404** / `{"cid":"999999999999"}` | `LD007` / `LEDGER_CURRENCY_NOT_FOUND` / `{"cid":"999999999999"}` | 404 / 404 | ✅ **逐字一致**（形状闸放行 ⇒ 存在性判定给 404） |

**第 2 组：同族边界与直调原语（同批取证）**

| 入参 / 探针 | TS 读数 | DB 读数 | 判定 |
| - | - | - | - |
| `getCurrency(0)`（JSON number） | `LEDGER_CURRENCY_NOT_FOUND` / 404 / `{"cid":"0"}`（A1） | `ledger_cid_arg('0')` → `LD007` / `{"cid":"0"}`（B1） | ✅ 一致 |
| `'-9223372036854775808'`（bigint 下界） | `LEDGER_CURRENCY_NOT_FOUND` / 404 / `{"cid":"-9223372036854775808"}`（A4） | `ledger_cid_arg` → `LD007` / `{"cid":"-9223372036854775808"}`（B10） | ✅ 一致 |
| `'abc'` 直调原语 | （同上 A5/A9） | `ledger_int_amount('abc','cid')` → `LD016` / `NOT_DECIMAL_INTEGER`（B4） | ✅ 同码 |
| `getCurrency('999999999999')`（读接口） | **`no_throw` / 返回 `null`**（A7） | `ledger_cid_arg('999999999999')` → **正常返回 `999999999999`**（B9，闸只判形状与 `<=0`） | ✅ 语义一致：读接口「没有就 null」、写接口「没有就 404」；闸本身只管形状与 `<=0` |
| 分类器：`23503` FK | —（TS 由 `LEDGER_SQLSTATE_TO_CODE` 映射） | `ledger_error_for_sqlstate('23503','fk_account_cid')` → `{code:LEDGER_CURRENCY_NOT_FOUND, bucket:integrity, retryable:false}`（B6） | ✅ 仍归 404 类 |
| **超 bigint：写接口** `'99999999999999999999999'` | `transfer` → `LEDGER_AMOUNT_INVALID` / **400** / `{"field":"cid","value":"99999999999999999999999","reason":"OVER_MAX_SINGLE_AMOUNT"}`（本轮补测） | `ledger_cid_arg` → `LD016` / `LEDGER_AMOUNT_INVALID` / 400 / `{"field":"cid","value":"99999999999999999999999","reason":"OVER_MAX_SINGLE_AMOUNT"}`（B11） | ✅ 码 / status / `reason` 一致（`value` 两侧都在） |
| **超 bigint：读接口（🚨 本轮新发现，未修，登记）** | `getCurrency('99999999999999999999999')` → **原始 `22003` 逃出**：`code="22003"`、`message="value \"99999999999999999999999\" is out of range for type bigint"`（**不是** §14 已登记码，也未落 400/404） | 同上（B11 为 400） | ❌ **不一致**：读路径 `toAmount` 用 `BigInt`（无界）⇒ 十进制串直通 PG `WHERE cid = $1` ⇒ PG 22003 原样逃逸。**本轮未改**（越出「回退 `cid<=0`」范围，不自行推导）⇒ 见 13.7② |
| **差异（登记）**：`cid` **缺失** | `LEDGER_AMOUNT_INVALID` / 400 / `{"field":"cid","reason":"BAD_TYPE"}`（A13，`undefined`） | `LEDGER_AMOUNT_INVALID` / 400 / `{"field":"cid","reason":"MISSING"}`（P6，payload 无 `cid` 键） | ⚠️ **reason 不同**（`BAD_TYPE` vs `MISSING`），双方都 400 ⇒ 见 13.7① |

**读/写接口对称性（防误读）**：`cid <= 0` 在 **TS 读写两侧都是 404**（`toCid` 闸先抛，A2/A8）；
而「形状合法但库中无此币」在 **TS 读接口是 `null`**（A7）、**写接口是 404**（A10）；DB 侧对应为
`ledger_cid_arg` 放行 + 调用点存在性检查抛 `LD007`（P5）。⇒ 回退后两侧口径**完全对齐**。

### 13.4 `toCid` 回退逐字 diff（事一）

```diff
 const toCid = (cid: Amount): bigint => {
   const c = toAmount(cid, 'cid');
-  if (c <= 0n) throw new LedgerError('LEDGER_AMOUNT_NOT_POSITIVE', { field: 'cid', value: c.toString() });
+  // cid <= 0 ⇒ 该币种不存在（currency.cid 为正整数序列）⇒ 404，与 DB 侧 ledger_cid_arg 逐字一致
+  if (c <= 0n) throw new LedgerError('LEDGER_CURRENCY_NOT_FOUND', { cid: c.toString() });
   return c;
 };
```

- 文件头「对外契约变化」**⑤ 条**整段重写：由「改为 400 / 与 `ledger_parse_user_amount` 逐字一致」
  改为「**回到** 404 `LEDGER_CURRENCY_NOT_FOUND` + `{cid}`（与 `ledger_cid_arg` 逐字一致）+ 前提已被证伪 + 重新裁定口径」。
- `toCid` 上方**注释块**整段重写：写明「形状非法 ⇒ 400 / 不存在 ⇒ 404（`cid<=0` 属此）」的分档、
  上一轮错改的证伪链条、以及「DB 侧未改动且无需改动」。
- 代码净变化 = **1 行**（`LEDGER_AMOUNT_NOT_POSITIVE+{field,value}` → `LEDGER_CURRENCY_NOT_FOUND+{cid}`），
  注释变化 = 文件头 ⑤（+8 行）/ `toCid` 注释块（+26 行）。`git diff src/ledger.ts` 共 2 个 hunk。

### 13.5 本轮回归读数（逐条原始读数；命令与退出码均**不取自管道之后**）

| 项 | 命令 | 读数 |
| - | - | - |
| `tsc --noEmit` | `npx tsc --noEmit; echo $?` | `tsc_exit=0`、输出 **0 行** ⇒ **0 error** |
| `ledger-smoke`（API 路径，P1a 契约回归） | `npx ts-node --transpile-only scripts/ledger-smoke.ts` | `api_exit=0`；`{"passed":29,"failed":0}`（run `ujif1ld`）→ `.p1f-artifacts/p1n2-smoke-api.txt` |
| `ledger-smoke-db`（DB 直调） | `npx ts-node --transpile-only scripts/ledger-smoke-db.ts` | `db_exit=0`；`summary {"passed":11,"failed":0}`（run `ifvf8`）→ `.p1f-artifacts/p1n2-smoke-db.txt` |
| **F1** | `npx ts-node --transpile-only scripts/p1f-01-f1-collision.ts --assert` | `f1_exit=0`；**14/14** verdict 全 `true`、`failures=[]`、`pass=true`（run `MUJIGVZ3`）→ `.p1f-artifacts/p1n2-01-f1.json` |
| **F2** | `npx ts-node --transpile-only scripts/p1f-02-f2-malformed.ts --assert` | `f2_exit=0`；`pass=true`、`failures=[]`、52 例；**三硬判据仍归零**：`unmapped_escape=0`、`status_500=0`、`not_in_closed_set=0`；唯一 `accepted_200` 仍只有 `M32_from_uid_spaces`；`M14_cid_zero` = **404**（DB 侧口径未变）、`M15_cid_abc` = 400、`M16_cid_json_number` = 400（run `MUJIHGW8`）→ `.p1f-artifacts/p1n2-02-f2.json` |

**DB 侧未被触碰（事一硬约束的机读证据）**：
`git status --porcelain backend-ts/migrations/` → **空**；
`schema_migration` 6 行 `0001 4f902d3c… / 0002 688b1935… / 0003 f268e030… / 0004 55fd1ce8… / 0005 4de12361… / 0006 4aa19b14…`；
`pg_proc` 三函数 `md5(prosrc)` 见 13.1⑦。**本轮未新建任何迁移**。

### 13.6 `scripts/p1n-00-cid-shape.ts` **保留**（登记）

- 它是本组读数（13.2 三段 ①/②/③ + 13.3 对拍表）的**唯一可复跑取证脚本** ⇒ **保留，不删、不改名**。
- 复跑：`npx ts-node --transpile-only scripts/p1n-00-cid-shape.ts --phase before|after|revert`；
  落盘文件名**一律带 run tag**（`p1n-tocid-shape-<phase>-<RUN>.json`），**绝不覆盖**既有读数文件。
- 分区纪律：uid **947xxx** / symbol 前缀 **p1o** / 键前缀 **`ops:p1o:*`**；脚本**不写账本**
  （`rows_touched.wrote_nothing = true` 自证）；**绝不触碰 `cid=1` 与平台账户**。

### 13.7 本轮新增未验证面（补充 §10，不掩饰）

① **`cid` 缺失的 reason 分档**：TS 给 `BAD_TYPE`、DB 给 `MISSING`（A13 vs P6，双方都 400）。
   重新裁定所列 reason 集里的 `MISSING` / `NOT_STRING` **目前只有 DB 侧产出**；TS 是否补这两个分档
   **未改、未验**（本轮范围只到回退 `cid<=0`，**不自行推导**）。
② **🚨 超 bigint 的 cid 在 TS 读路径漏闸（本轮新发现，未改、未验修复）**：
   `getCurrency('99999999999999999999999')` ⇒ **原始 PG `22003` 原样逃出**
   （`code="22003"`、`message="value \"99999999999999999999999\" is out of range for type bigint"`），
   既不是 §14 已登记码，也不是 400/404 —— 与重新裁定「超 bigint ⇒ 400 `LEDGER_AMOUNT_INVALID`
   + `reason=OUT_OF_BIGINT_RANGE`」**不符**；根因：`toCid`→`toAmount` 用 `BigInt(s)`（无界），
   没有像 DB 侧 `ledger_int_amount` 那样做 19 位 + 真范围闸，读路径把十进制串直接交给 PG。
   **写路径不受影响**：`transfer` 同入参 = 400 `LEDGER_AMOUNT_INVALID` +
   `{"field":"cid","value":"99999999999999999999999","reason":"OVER_MAX_SINGLE_AMOUNT"}`（与 DB B11 同码同 reason）。
   本轮**未动这段代码**（越出「回退 `cid<=0`」范围；不自行推导），仅登记供 Zang 裁定；
   读数 = 本轮 `ts-node -e` 直测（未落盘文件），`getCurrency` 侧的 `22003` 逃逸**未做**多入参穷举。
③ **§7.3 逃逸矩阵 B4 组读数跨运行不稳定**（`false` / `true`，见 §7.3 更正注）⇒ 该子探针不是确定性判据，
   不要把 `lock_timeout_lockwait_raw_55P03_when_no_handler` 当硬断言。
④ `getCurrency('0')` 的 `elapsed_ms` 为 0–1ms、`getCurrency('93')` 首次 967ms（冷连接），未做重复取样统计。

### 13.8 本轮测试数据（uid 947xxx / symbol p1o / 键 `ops:p1o:*`）

- 本轮 `p1n-00-cid-shape.ts` **未写任何账本行**（三个 phase 全部 `wrote_nothing=true`；各文件自证 `ledger_entry` 92 → 92）；
  仅用 `947001`/`947002` 作**参数校验失败**的调用主体，**未建账户、未建币种、未落分录**。
- 幂等键（全部落在**未执行**的失败路径，无行落库）：`ops:p1o:{RUN}:{cid0, cidabc, cidabsent, cidempty, cidneg5, dbpath:P1..P6}`。
- 冒烟/F1/F2 沿用其脚本自身分区（`900001–900003` + `cid=1` / `920021/920022` / `942xxx`+`p1h`），与 P1n 分区不重叠。
- **本轮末复读**：`ledger_entry` 总行数 = **166**；`idempotency_key LIKE 'ops:p1o:%'` = **0 行**；
  `account WHERE uid IN (947001,947002)` = **0 行**（⇒ P1n 探针的账本贡献为 **0** 行；166 的增量全部来自**按设计**写入的回归套件，见 §12）。
- 平台账户未被触碰：`cid=1` 上 uid `0 / -1 / -2 / -3` 仍全部 `balance=0 frozen=0`
  （`cid=1` 上非零余额的 3 个账户是 `900001/900002/900003`，即冒烟用户，按设计）。
