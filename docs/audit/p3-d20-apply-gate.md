# P3-D20-APPLY-GATE（Unit J1 / Kong）· 给 p3x-00-rebuild-replay.ts 装真正的 COMMIT 前置闸

> 状态：**进行中（骨架已落盘，逐段回填）**。每完成一段即追加，终局统一 `read_file` 复核。
> 命名空间：本单全部产物写 `backend-ts/.p3y-artifacts/**`（**禁改禁删** `backend-ts/.p3x-artifacts/**`，只读）。
> 连接口径：单连接 `new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED })`；**无 Pool / 无 pooler**。
> 本单**未发生任何真实 COMMIT**（唯一例外 §5(c) 的 apply 判负演练，也必须 ROLLBACK 收尾）。

## 0. 结论摘要（TL;DR）
- **闸已装好且判负实测有效**：对拍从「COMMIT 之后」移到**事务内、COMMIT 之前**；`COMMIT` 条件收窄为
  `mode==='apply' && confirmIrreversible && gate.ok===true`，其余一律 `ROLLBACK`。全文件**唯一** COMMIT 语句在
  `p3x-00-rebuild-replay.ts:794` 的 `canCommit` 分支内（`grep -n COMMIT` 只剩 1 条可执行 COMMIT + 1 条 fatal-catch 里的 ROLLBACK）。
- **三段判负全部实测通过，本单零 COMMIT**：
  | run | 命令 | `tx_final` | `gate.ok` | A_hash==F_hash |
  |---|---|---|---|---|
  | (b) 干跑判负 | `--dry-run --expect-corrupt` | **ROLLBACK** | **false** | 是（`699ac94d…`） |
  | (正路) 干跑 | `--dry-run` | ROLLBACK | true | 是（`699ac94d…`） |
  | (c) apply 判负 | `--apply --confirm-irreversible --expect-corrupt` | **ROLLBACK** | **false** | 是（`699ac94d…`） |
  | （附加）注入 | `--dry-run --inject-fail-after=0010` | ROLLBACK | false（注入原因） | 是（`699ac94d…`） |
- 回归：与上一版 `.p3x-artifacts/p3x-00-dry-20260928174808.-plain` 逐字段对拍，**内容/判据文件全 0 差**
  （`C-replay-log` 0、`D-comparison` 0、`D-expectations-from-files` 0），77 条残留差异**逐条可归因**（时间戳 21 / 每连接 pid 2 / 他人会话观测 54）——**无行为回归**。
- `tsc --noEmit` 退出码 **0**（直接重定向取值，非管道之后）。
- 事务外零写库：4 次运行 A_hash 与上一单终态 `699ac94d…` 逐字节相同，且每次 A_hash==F_hash。

## 1. 修前缺陷：静态证据（行号逐行）
取现版：`git show HEAD:backend-ts/scripts/p3x-00-rebuild-replay.ts`（blob sha256
`505b6ba605cf0020c3bee024ad7acd53fd3de82cdaa1a13efbb3ed3257e4c2c7`，与工作区文件 sha256 **完全相同** ⇒ 我读到的就是 HEAD 版，且**本单未用该版本跑 `--apply`**）。
（scratch：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3y-j1-static-20260929085102/p3x-00-rebuild-replay.HEAD.ts`）

逐行证据（`grep -n`，行号取自 HEAD 版）：
```
713:  if (!replayError && !injected) {            ← 仅在「重放无错且无注入」时才取事务内快照
719:  if (mode === 'apply' && confirmIrreversible) { await c.query('COMMIT'); final = 'COMMIT'; }   ← 无条件 COMMIT
721:  log.tx_final = final;
829:    const exp = deriveExpectations(files);
834:      const cmp = compareExpectations(exp, inTxSnapshot);   ← 对拍
```
⇒ **`tx_final` 赋值（`:721`）与 `compareExpectations` 调用（`:834`）都在 COMMIT（`:719`）之后**；
`--apply` 路径上「对拍不等」（`:851` 才算 `D_pass`）与「重放报错」（`:679` break）**都不可能影响 `:719` 的 COMMIT 决策**。
干跑无害（`:720` else 恒 ROLLBACK），但对不可逆动作**等于没有闸**——与派单方定位一致，已复核。
`grep -n COMMIT` 在 HEAD 版仅命中 `:719`（可执行 COMMIT）+ 注释；`:898` 是 fatal-catch 的 ROLLBACK。

## 2. 装闸设计
在 `replayRun()` 内、`ROLLBACK/COMMIT` 决策**之前**构造 `gate` 对象（事务内对拍，期望仍由**迁移文件自身**派生：复用的是既有 `deriveExpectations()` / `compareExpectations()` / `expectedTerminalChecks()`，无新口径）：
| 字段 | 含义 | 取值来源 |
|---|---|---|
| `expect_corrupt` | 是否判负模式 | `argv` |
| `replay_ok` | 17 文件全部重放成功且 checksum 落库成功 | `!replayError` |
| `injected` | 是否触发了注入演练（触发即不得 COMMIT） | `!!injected` |
| `checksums_all_byte_equal` | 17/17 文件 sha256 与 `schema_migration.checksum` 逐字节相等（**并要求 file_steps 数==17**，半途 break 即 false） | `log.steps[].checksum_byte_equal` |
| `snapshot_taken` | 事务内快照是否取到 | `!!inTxSnapshot` |
| `comparison_inside_tx` | 对拍是否真发生在事务内 | 固定 true（此块只在 tx 内执行） |
| `object_diffs_empty` | 对象集对拍无差（TABLE 20/VIEW 1/FUNCTION 74/TRIGGER 43/SEQUENCE 13） | `compareExpectations().diffs.length===0` |
| `terminal_failed_empty` | 逐值终态无失败项 | `expectedTerminalChecks().filter(ok===false).length===0` |
| `ok` | **上述全真的逻辑与**（`replay_ok && !injected && checksums_all_byte_equal && snapshot_taken && object_diffs_empty && terminal_failed_empty`） | 逻辑与 |
| `reason` | 机读原因串（未过项 + 前 3 条明细） | 各失败项拼装 |
| `commit_allowed` / `tx_final` | 决策与结局落盘 | `canCommit` |
COMMIT 条件：`const canCommit = mode === 'apply' && confirmIrreversible && gate.ok === true;`
落盘：`E-gate.json`（run dir 内）+ stdout 一行 `gate.ok=… reason=…`。
`--expect-corrupt`：只改 `deriveExpectations()` 返回的**内存对象**（追加一个不存在的 TABLE 期望 + 把 `currency.total_supply` 期望改成 `999`），**不碰任何文件、不写库**，并在 `D-expectations-from-files.json` 记 `corruption_injected`。

## 3. 最小 diff（old/new 行号）
`git diff --stat`：`1 file changed, 92 insertions(+), 13 deletions(-)`（只有 `p3x-00` 一个文件）。
hunk 映射（old→new，`git diff -U0`）：
| old | new | 内容 |
|---|---|---|
| 15,0 | 16 | doc 用法行加 `--expect-corrupt` |
| 19,3 | 20,4 | doc 铁律 2/3 改写（COMMIT 条件 + 闸位置） |
| 42 | 44,4 | `ART_ROOT` 支持 `P3_ART_ROOT` 覆盖（**默认值不变**，仍 `.p3x-artifacts`） |
| 61,0 | 67,2 | 新增 `CORRUPT_EXPECT_TABLE` 常量 |
| 66,0 | 74 | 新增 `EXPECT_CORRUPT`（argv） |
| 266 | 274 | `deriveExpectations(files, corrupt=false)` 签名 |
| 339 | 347 | `return {` → `const result: any = {` |
| 364,0 | 373,19 | corruption 注入块 + `return result` |
| 613 | 640 | `replayRun(..., exp)` 签名 |
| **717,0** | **745,48** | **gate 块（新增 48 行）** |
| **719** | **794** | **`if (mode==='apply'&&confirmIrreversible)` → `if (canCommit)`** |
| 720,0 | 796,2 | `gate.commit_allowed` / `gate.tx_final` |
| 723 | 800 | `return { log, inTxSnapshot, gate }` |
| 737 | 814 | `--help` 文案加 `--expect-corrupt` |
| 747 | 824 | runTag 后缀 `plain` → `corrupt`（判负 run 可辨识） |
| 813 | 890,4 | main：`exp` 提前派生 + 传入 `replayRun` + 写 `E-gate.json` + 打印 `gate.ok=` 行 |
| 829 | 908,0 | 删除原先这里的 `const exp`（避免重复声明） |
最小 diff 全文见 `git diff -- backend-ts/scripts/p3x-00-rebuild-replay.ts`（未提交，工作区可见）。

## 4. 判负三段实测
**(a) 修前静态证据**：见 §1（`COMMIT :719 < compareExpectations :834`）。**未用现版跑 `--apply`**（它没有闸）。
**(b) 修后干跑判负** `--dry-run --expect-corrupt` → artifact `p3x-00-dry-20260929005114.-corrupt`：
- stdout：`gate.ok=false reason=object_diffs=1: TABLE 缺失（文件声明但库内无）: __p3y_corrupt_expectation__ ; terminal_failed=1: currency.cid1(逐值)` ← **reason 精确指到我埋的两项**
- `tx_final=ROLLBACK`，`replay_ok=true`，`checksum_all_byte_equal=true`，`D_pass=false`，exit=3
- 事务外：`F_net_zero.identical=true`，A_hash==F_hash==`699ac94d8fa048f8de99f0a20b1951b4c5fed2f1ec98f4c2003d33136d3cdb41`
**(c) apply 分支判负（本单唯一一次 `--apply`，放最后跑）** `--apply --confirm-irreversible --expect-corrupt` → artifact `p3x-00-apply-20260929005447.-corrupt`：
- stdout：`gate.ok=false reason=object_diffs=1: TABLE 缺失… __p3y_corrupt_expectation__ ; terminal_failed=1: currency.cid1(逐值)`
- **`tx_final=ROLLBACK`**（`E-gate.json`：`"commit_allowed": false, "tx_final": "ROLLBACK"`）⇒ **未出现 COMMIT，闸有效**
- 事务外：`F_net_zero.identical=true`，A_hash==F_hash==`699ac94d…`，exit=3

## 5. 修后正路仍绿
`--dry-run`（不带 `--expect-corrupt`）→ artifact `p3x-00-dry-20260929005222.-plain`，exit=**0**：
- stdout：`gate.ok=true reason=all gates green（replay_ok & 无注入 & checksums 全字节相等 & 对象集无差 & 逐值终态无失败 & 事务内快照已取）`
- `tx_final=ROLLBACK`、`D_pass=true`、`terminal_total=32 / terminal_ok=31`（1 项为既有 `currency.supply_cap=NULL` 的 NOT_MEASURED 项，与上一版口径一致）
- 事务外：`F_net_zero.identical=true`，A_hash==F_hash==`699ac94d…`
- 附加：`--dry-run --inject-fail-after=0010` → exit=0，`tx_final=ROLLBACK`，注入异常 `code=P0001 / severity=ERROR`，
  注入后事务状态 `REJECTED code=25P02 msg=current transaction is aborted…`（**与上一版一致的 25P02**），且 gate 现在**也**会挡住它：
  `gate.ok=false reason=injection_drill_triggered（注入演练 ⇒ 不得 COMMIT） ; checksums_not_all_byte_equal（file_steps=10/17） ; …`

## 6. 回归对拍：与上一版（.p3x-artifacts/…174808）逐字段比较
**口径（逐字）**：文件集 = 两目录 `*.json` 并集；逐文件递归扁平化为 dotted path（数组按下标）逐键比较；
先剔除 `run` / `run_tag` / `started_at` / `finished_at` + 耗时类键（`^ms$` / `*_ms` / `*ms` / `duration*` / `elapsed` / `took*`）；
剩余差异按 TIMESTAMP / IDENTITY / OTHER 三类登记。旧目录**只读，未改未删**。
结果（`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3y-j1-cmp-20260929085300.out`，脚本
`…/scratch/p3y-j1-cmp-20260929085300.py`，同名拒写）：
- `files_only_old = []`（旧版 7 个文件全部有对应物）；`files_only_new = ['E-gate.json']`（**新增件**，旧版无对应物，属加性）
- 逐文件：`C-replay-log.json` keys=206 **diffs=0**；`D-comparison.json` keys=403 **diffs=0**；`D-expectations-from-files.json` keys=277 **diffs=0**；
  `A-pre-state.json` keys=1423 diffs=1；`F-post-state.json` keys=1423 diffs=1；`D-in-tx-state.json` keys=351 diffs=19；
  `B-connections.json` keys=37 diffs=34；`SUMMARY.json` keys=461 diffs=22。合计 77。
- **77 条差异逐条归因（无一条是行为/判据差异）**：
  | 类别 | 条数 | 明细 |
  |---|---|---|
  | 时间戳类 | 21 | `at` ×3（A/F/D-in-tx）、`schema_migration[].applied_at` ×17、`commission_policy_default.row.time_created` ×1 |
  | 每连接固有标识 | 2 | `B-connections.self.pid` 948→1651、`SUMMARY.B_connections.self_pid` 948→1651 |
  | 他人会话的环境观测 | 54 | `B-connections.others[0..3].*` ×32 + `SUMMARY.B_connections.others[0..3].*` ×20 + `others_count` ×2（旧 run 0 → 本次 4） |
- 口径缺陷（见 §10）：`time_created`（嵌套 JSON 串）与 `SUMMARY.B_connections.self_pid` 被脚本归到 OTHER，**人读后已归因**；
  除这 2 条外 OTHER 类全部是「他人会话」字段。
- 关键判据字段全部相等：对象集/期望/对拍/终态 checks/deep 逐键 0 差；`SUMMARY.A_hash`、`F_hash`、`schema_migration` 17 行 checksum 全等。
- 环境事实（据实登记，未干预）：本次运行时有 **4 个他人会话**，`application_name=pgbouncer`、`state=idle`（旧 run 为 0 个）；
  两者 `idle_in_transaction_count` 均为 **0**（否则脚本会按铁律 exit 6 拦下）——我**未碰**任何会话与服务，也未执行任何 kill。

## 7. 既有行为不回归
| 检查 | 期望 | 实测 | 结论 |
|---|---|---|---|
| `--apply`（不带 `--confirm-irreversible`） | `refused` + exit 2 | `{"ok": false, "refused": "--apply 需要 --confirm-irreversible…"}`，exit=**2** | ✅ |
| `--help` | exit 0 | 输出行含 `--expect-corrupt`，exit=**0** | ✅ |
| `--dry-run` 默认路径 | `ROLLBACK` 且对拍全绿 | exit=0，`gate.ok=true`，`tx_final=ROLLBACK` | ✅ |
| `--inject-fail-after=0010`（干跑） | `ROLLBACK` + `25P02` | exit=0，`tx_final=ROLLBACK`，`REJECTED code=25P02` | ✅ |
| 事务外零写库 | 4 次运行均净零 | 4 次 `identical=true` 且 A_hash==F_hash==`699ac94d…`（与上一单终态一致） | ✅ |
| 连接口径 | 单连接 Client + `DATABASE_URL_UNPOOLED`、无 Pool/pooler | `SUMMARY.connection = {driver: '@neondatabase/serverless Client（单连接，非 Pool）', url_source: 'DATABASE_URL_UNPOOLED', pooler_used: false, url: '[REDACTED]'}` | ✅（残余不确定见 §9） |
| 产物命名空间 | 只写 `.p3y-artifacts/**`，`.p3x-artifacts/**` 只读 | 4 个新 run dir 全在 `.p3y-artifacts/`；`.p3x-artifacts/` mtime/sha 未变（仅 `cat/read` 与 `python3 -c` 只读读取） | ✅ |

## 8. tsc --noEmit
`cd backend-ts && npx tsc --noEmit > <abs>/p3y-j1-tsc.out 2>&1; echo "tsc_exit=$?"` → **tsc_exit=0**，输出文件 **0 行**（退出码直接重定向后 `$?` 取值，未取自管道之后）。
（另有 LSP 在 patch 过程中报过一次 `Cannot redeclare 'exp'`，是我那一轮错改所致，已在下一步修掉；最终 `tsc` 0 错。）

## 9. 未验证清单（NOT_MEASURED）
- **`gate.ok===true` 时真正 COMMIT 的分支未实测**：本单禁止真 COMMIT ⇒ 「闸放行 → COMMIT」这条路径 `NOT_MEASURED`；
  我只证明了「`gate.ok=false`（含 apply 分支）⇒ ROLLBACK」，以及「全文件唯一可执行 COMMIT 位于 `:794` 的 `canCommit` 分支内」这一**静态**事实。
- 「事务内快照取不到（`snapshot()` 抛错）⇒ `gate.snapshot_taken=false ⇒ ok=false ⇒ ROLLBACK`」这条组合 `NOT_MEASURED`（未构造快照失败）。
- `--expect-corrupt` 与 `--inject-fail-after` 同时给的组合 `NOT_MEASURED`。
- **端点是否真为非 pooler**：只测到 URL 子串不含 `-pooler` + `url_source=DATABASE_URL_UNPOOLED`；host 未落盘（redact 设计）⇒ 更强证据 `NOT_MEASURED`。
- 我的连接自己的 `application_name` `NOT_MEASURED`（探针 `self` 只取 `pid/db/usr` 三列，未取 `application_name`）。
- 重建期间与在线服务（seafood-api）的真实并发锁竞争 `NOT_MEASURED`（仅登记 B 段会话快照，4 个他人会话均 idle）。
- 闸对「文件派生期望本身有系统性偏差」的防御 `NOT_MEASURED`（闸只校验 `库 vs 文件派生期望`，二者同错则闸看不见——本次靠上一单的独立对拍背书）。
- 应用层端到端可用性、Neon 平台侧 PITR/分支能力 `NOT_MEASURED`（超出本机工具面）。

## 10. 探针/口径缺陷自曝
1. **我有一轮 patch 写反了**：本要删除重复的 `const exp = deriveExpectations(files);`，却把该行又插了一遍；
   LSP 立刻报 `Cannot redeclare block-scoped variable 'exp'`，下一轮已修回。最终 diff 无残留（92+/13-），但过程确有此错改。
2. corruption 块我最初多写了一个无意义字段 `table_expected_count_was`（表达式恒为 0），已删除——若留下会污染 `D-expectations-from-files.json`。
3. 对拍脚本的分类器只看**键尾名**：`commission_policy_default.row.time_created`（整行 JSON 串）与 `SUMMARY.B_connections.self_pid`
   被误归 OTHER。**机器分类计数不可直接引用**，报告里的归因是我逐条人读后的结果（原始 77 条明细在 cmp `.out` 里可 grep）。
4. 早期 run 输出文件名**未带时间戳**（`p3y-j1-run-dryrun-corrupt.out` 等），违反「探针输出必须 run-tagged」；
   后两次补为 `p3y-j1-run-<stamp>-….out`。脚本产物目录本身始终 run-tagged（`.p3y-artifacts/p3x-00-…-<stamp>-<plain|corrupt|injectNNNN>`）。
5. 「逐字段对拍」在**他人会话字段**上天然不可能相等（旧 run 观测到 0 个他人会话、本次 4 个）——这不是回归，但必须显式登记，否则会被误读为差异。
6. `A_hash==F_hash` 只证明**快照探针覆盖面内**（对象/行数/关键函数 md5/序列态等 `snapshot()` 字段集）未变，**不等于**「库内一切字节未变」。
7. `runTag` 的 `stamp` 由 `toISOString().slice(0,15)` 生成，落在 **UTC**（`20260929005114` = 本地 08:51:14 CST），且切片会留下 `.-` 这种怪异分隔——沿用既有命名风格未改。

## 11. artifact 索引（run-tagged）+ 复现命令
绝对路径：
- `backend-ts/.p3y-artifacts/p3x-00-dry-20260929005114.-corrupt/`（(b) 干跑判负；含 `E-gate.json`）
- `backend-ts/.p3y-artifacts/p3x-00-dry-20260929005222.-plain/`（正路干跑，回归基线）
- `backend-ts/.p3y-artifacts/p3x-00-dry-20260929005322.-inject0010/`（注入回归）
- `backend-ts/.p3y-artifacts/p3x-00-apply-20260929005447.-corrupt/`（(c) apply 判负；**`tx_final=ROLLBACK`**）
- scratch（非交付物）：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3y-j1-{static-20260929085102/,cmp-20260929085300.py,cmp-20260929085300.out,run-*.out,tsc.out,help.out}`
复现（每条都会新建 run-tagged 目录，同名拒写）：
```bash
cd /Users/kevin/bistro/seafood/backend-ts
P3_ART_ROOT=.p3y-artifacts npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run --expect-corrupt
P3_ART_ROOT=.p3y-artifacts npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run
P3_ART_ROOT=.p3y-artifacts npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run --inject-fail-after=0010
P3_ART_ROOT=.p3y-artifacts npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --apply --confirm-irreversible --expect-corrupt
```
（`P3_ART_ROOT` 只是把产物根切到本单命名空间；**不设该变量时脚本行为与默认产物根 `.p3x-artifacts` 完全不变**。）
**本单只改了一个脚本文件（`backend-ts/scripts/p3x-00-rebuild-replay.ts`），新增本报告一份；未提交、未 push、未 DELETE/TRUNCATE/UPDATE 任何真实行、未 kill 任何进程、未重启任何服务。**
