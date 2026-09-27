# P1i · 收口验收报告（Kong 实现方）

> 状态：**恢复轮（P1j）已完成取证**；§2 / §5 / §6 / §8 / §9 / §12 已回填，其余节标「待 F3 专项单」。
> 仓库：`/Users/kevin/bistro/seafood`　分支：`main`（不 commit / 不 push，Zang 做）
> 上游单：P1f 修复轮。上一轮（R3-P1i-b）结束时库处于**撒谎态**（注册表记 `0004`、函数对象是首版 0005），
> 本轮第一件事即**重新应用修改后的 0005**，把注册表与文件 sha256 对齐（见 §2）。
> 本轮读数落盘于 `.p1f-artifacts/p1j-*`（`p1j-migrate-1/2.json`、`p1j01-f1-after.json`、
> `p1j02-f2-after.json`、`p1j-smoke-api.txt`、`p1j-smoke-db.txt`、`p1j-tsc.txt`、`p1j-read.json`）。

## 0. 本轮范围与交付物

| # | 项 | 状态 |
| - | - | - |
| 1 | `0005_ledger_event_root_key.sql` 应用 + 幂等（跑两次） | **✅ 已验（§2）** |
| 2 | `src/ledger.ts` `normalizeIdempotencyKey` 字符集收紧（`#` / 控制字符） | 上轮已落笔 + `tsc 0 error`；逐字 before→after 见 §3（待 F3 专项单） |
| 3 | `src/ledger.ts` `RETRYABLE_SQLSTATES += 'LD027'` | 同上 |
| 4 | `src/ledger.ts` `findByKey` 改 `event_root_key` 精确归属 | 同上 |
| 5 | `src/ledger-errors.ts` 基础设施类 → `LEDGER_TX_TIMEOUT` 503 | 同上 |
| 6 | 新发现 M31（`amount` 超 R66 上限）/ M43（`1e5` 指数形式） | 修法已落 0005 §D/§D2；四例断言在 F2 中全绿（§6）；根因叙述见 §4（待 F3 专项单） |
| 7 | F1 修后同场景对比（`p1f-01 --assert`） | **✅ 14/14（§5）** |
| 8 | F2 修后 52 例闭集自检（`p1f-02 --assert`） | **✅ 全绿（§6）** |
| 9 | F3 修后读数（预算钳位 / 55P03 / 40P01 / 基础设施） | 待 F3 专项单（§7） |
| 10 | 回归：`tsc --noEmit` / `ledger-smoke` 29 / `ledger-smoke-db` | **✅ 见 §8** |
| 11 | §11 判据 1/8 归零；R79 `lock_trace`；面板；基座 sha256 | **✅ 见 §9** |

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

上轮已落笔、本轮仅回归验证（逐字 before→after 留待 §3 专项单）：`src/ledger.ts`、`src/ledger-errors.ts`。

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

## 3. TS 侧四处改动（逐处 before → after）

**待 F3 专项单**（上轮已落笔并 `tsc 0 error`；本轮只做回归取证，未改这三处所在文件）。

## 4. 新发现 M31 / M43 处置

**待 F3 专项单**（根因已在 `0005` §D2 抬头逐字记录：0004 的 `ledger_payload_amount` 以 `amount_units`
优先 ⇒ `amount` 被静默忽略；修法 = 二选一 + `AMBIGUOUS_AMOUNT` + 指数形式显式 `EXPONENT_NOT_ALLOWED`。
本轮改后**行为读数**在 §6 的 `amount_*` 四条断言里全绿）。

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

**待 F3 专项单**（6 持锁链总等待 / `55P03→LD025` / `40P01→LD027` / 基础设施 503 / 预算钳位）。

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

**待 F3 专项单**（另行列出：F3 预算钳位 / 基础设施 503 的真机读数、TS 四处改动的逐字 before→after、
M31/M43 根因叙述）。本轮**未验证**（本轮范围外，不得读作已验）：
① 0005 之外任何新迁移（本轮明确不建）；
② `p1i-forget-migration.ts` 已禁用、未再执行，但其历史副作用只在本轮被「重新应用 0005」覆盖，
   未经独立负向验证（无法回头再验，如实登记）。

## 11. 需 spec 同步的行清单

**待 F3 专项单**。（已知需同步项：`0005` §C 的 bucket 纪律表述、§D2 `AMBIGUOUS_AMOUNT`、
§D 的 `EXPONENT_NOT_ALLOWED`、`event_root_key` 列与 `ledger_event_root_guard`。）

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

**冒烟**：`ledger-smoke.ts`（run `ujg5ih4`，uid 900001/900002/900003 + `cid=1` 只读、`unit_cid=79` `smkujg5ih4`）、
`ledger-smoke-db.ts`（run `g6ahk`，uid 920021/920022、`cid 80–83` `p1eS/p1eT/p1eE/p1eK`）。
本轮**未**执行任何清理（`purge-test-data.ts` 未运行），上述数据全部留在库中，供 Zang 裁定后续清理。
