# P2 `0012`「幂等重放前置闸」· 独立质检报告（Neng · **结论：可验收 PASS**）

> **范围声明**：本文件是**独立质检报告**（不是交付方自述）。被检对象是**已应用**的
> `backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql` 与它换装的
> `public.ledger_post_event(payload jsonb)`（`schema_version = 0012`）。
> 质检方 = Neng；一切读数由**我自己的探针**现场落盘（`backend-ts/.p2qa2-artifacts/`），
> **不复用交付方的 uid / 幂等键 / 夹具**（交付方分区 `960xxx` / `ops:p2x:`，我用 `961xxx` / `ops:p2qa2:`）。
> 本文件**只写报告**：未改任何代码，未改 `migrations/**`、`scripts/**`、`src/**`、`frontend/**`、
> `docs/ledger.spec.md`、`docs/seafood.master-plan.md`；未 commit / push；未启停面板托管服务（5787 / 5788）。
> 本机**无** `timeout` / `gtimeout`；所有退出码取自命令本身（用管道处显式取 `${PIPESTATUS[0]}`）。
> 身份表名是 **`users`**（不是 `user`；`0006_user_to_users.sql` 已改名，库里 `user` 表不存在）。

| 项 | 值 |
|---|---|
| run tag | **`20260927T131927Z`**（所有读数文件后缀一致） |
| 被检文件 | `backend-ts/migrations/0012_replay_pre_gate_before_balance_gate.sql`（**71238 B**，md5 `5b97c96b3e6279799b8781e2222d01e3`） |
| 盘/库指纹 | utf8-sha256 = bytes-sha256 = `schema_migration.checksum` = `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe` |
| 质检时 HEAD | `e7c253e feat(P2/0012): 幂等重放前置闸【已应用 · schema_version=0012】…` |
| 写报告时 HEAD | `c8163c8 master-plan v0.30…`（其后提交未触碰 `migrations/0012`，见 I10） |
| 原始读数目录 | `backend-ts/.p2qa2-artifacts/`（见 §⑦ 索引） |
| **结论** | **可验收（PASS）** —— I1–I10 **全部 PASS**，无 FAIL；残余项见 §⑤ / §⑥ |

---

## ① 方法与隔离契约（我做了什么 / 我怎么保证读数可信）

**独立重取，不采信交付方自报**：三向指纹（盘 utf8 / 盘 raw bytes / `schema_migration.checksum`）
由我自己的 `p2qa2-01-fingerprints.ts` 现取；`migrate.ts` 我自己跑两遍；闸位置由我**直接从
`pg_proc.prosrc` 文本定位**（不是读交付方的报告数字）。

**夹具自造（硬约束）**：
- 行为单 `p2qa2-03`：uid 窗口 `961981–961990`（自动扫描后取空窗，`occupied_recheck: []`），
  symbol `p2qa22sj889`，键前缀 `ops:p2qa2:2sj889:`，job tag `711714865`。
- 并发单 `p2qa2-04`：uid `961825–961832`，symbol `p2qa21lue89`，cid `238`，键前缀 `ops:p2qa2:cc:1lue89:`。
- 分区上限 `961001–961999`，与交付方 `960xxx` 及平台账户 `0/-1/-2/-3`、`cid=1` **完全不相交**。

**破坏性动作纪律**：`CREATE OR REPLACE FUNCTION`（§C 判负变体）与行为用例**全部在事务内**，
末尾整事务 `ROLLBACK`；每次变体后复检函数体 md5 是否复原（`fn_restored_md5_ok` / `fn_restored_to_original`）。

**本轮我不做的**：不重跑任何已落盘探针（读数在盘上直接引用）；不修任何代码。

---

## ② 逐项判据总表（I1–I10）

| # | 判据 | 判据来源 | 结果 |
|---|---|---|---|
| I1 | 盘 == 库 **三向指纹**一致；12 个迁移文件全部 MATCH；`migrate.ts` 幂等 | 自取 | ✅ PASS |
| I2 | 闸**位置**正确（C4 加锁之后、C5/R80 之前、R51 探针之前）+ 闸体**只读** | 自取 `prosrc` | ✅ PASS |
| I3a | 与 `0005` 的函数体差分**只有两处纯插入**（字节级 A/B 的一半） | 自取 | ✅ PASS |
| I3b | 修前 ⇒ 缺陷复现（同键重试被余额闸挡住）／`0012` 下 ⇒ 200 重放 | 见 §⑥（未在我这侧落盘） | ⚠️ 未验证（旁证 PASS） |
| I4 | **头号用例**：托管恰花光后同键重试 ⇒ `200 + idempotent_replay:true` + 同 txid + 零新增 | 自取 18/18 | ✅ PASS |
| I5 | **反向用例**：异指纹 ⇒ `LD003` 零写入；新键冻结/余额不足 ⇒ 仍 `LD002`/`LD001` | 自取 | ✅ PASS |
| I6 | **真并发**：胜者先提交、败者阻塞后 200 重放，恰一次落账不双扣 | 自取 14/14 | ✅ PASS |
| I7 | §C 自检**判负能力**：7 个破坏变体全部真 RAISE，V0 无假阳性 | 自取（3 跑） | ✅ PASS |
| I8 | 报错**不再被 22P02 掩盖** | 自取（40 条变体读数） | ✅ PASS |
| I9 | 交付方两条断言（`extra` 早于 `0012`；`p2x-00` 用例 5 的 red 与 `0012` 无关） | 自取 + 读盘 | ✅ 均**证实为真** |
| I10 | 未碰别人钱（`cid=1` / 平台账户）；`0001`–`0012` 一字未改 | 自取 | ✅ PASS |

---

## ③ 逐项读数（原始值）

### I1 · 三向指纹与 migrate 幂等 —— ✅ PASS

读数：`p2qa2-01-fingerprints-20260927T131927Z.json`（12 条 `three_way` 记录，`all_disk_db_match: true`）

- `0012`：`disk_size = 71238`，`disk_sha256_utf8 == disk_sha256_bytes ==` `db_checksum`
  = `2a64483f944f16e3364be822e5ff61e0b95afa0168f937ce5aac6671b561dcbe`（`disk_md5 = 5b97c96b3e6279799b8781e2222d01e3`）。
- 12 个文件（`0001`–`0012`）**全部 MATCH**（例：`0005` = `4de12361cf7df2038438d79200fbca68de4f57821e324a2ce0681bae439f0231`，7977 B／`0006` = `4aa19b1487000d44…`／`0011` = `238f96ae42298f85…`）。
- 库侧结构：`schema_version = 0012`；`schema_migration` 12 行（`0001`–`0012`）；`public` 基表 8 张
  `[account, commission_policy, currency, ledger_entry, ledger_owner, referral, schema_migration, users]`
  ⇒ **身份表名确为 `users`**。
- 函数身份（`pg_proc_identity`）：`ledger_post_event(payload jsonb) returns jsonb`，`plpgsql`，`provolatile='v'`，`secdef=false`。
- 索引：`ledger_idem_uniq`（`UNIQUE … (idempotency_key)`）在位。
- `migrate.ts` **两跑**：`p2qa2-migrate-run1-…Z.out` 与 `-run2-…Z.out` **逐字同形**，均 `ok: true`、
  `applied_now` 12 条 `action: "skipped" / reason: "already applied, checksum match"`、`schema_version: "0012"`、
  `.err` 空（0 B）⇒ 无 checksum drift、无重复应用。

### I2 · 闸位置与只读性 —— ✅ PASS

读数：`p2qa2-01-fingerprints-…json` 的 `fn` 块（`prosrc_len = 45598`，`prosrc_md5 = d94dd902697dfe60aba409d808c6d63a`）：

```
pos_c4_account_lock      = 26917   ('account:for-update')
pos_pre_gate (BEGIN 标记) = 27698   ('0012-REPLAY-PRE-GATE-BEGIN')
pos_c5_balance_section   = 30721
pos_r80_balance_gate     = 32617
pos_on_conflict_probe    = 34625   ('ON CONFLICT (idempotency_key) DO NOTHING')
order_ok_gate_after_lock_before_balance = true
on_conflict_still_after_gate            = true
gate_body_bytes = 2901 ; gate_body_stripped_bytes = 1535 ; gate_body_write_tokens = []
```

⇒ `26917 < 27698 < 30721 < 32617 < 34625`：**闸在 C4 账户加锁之后、C5 余额段与 R80 余额闸之前、
R51 的 `ON CONFLICT` 探针之前**（R51 权威性未受损、R63 未被绕过）。闸体剥注释 1535 B 的
**写/加锁 token 扫描 = `[]`** ⇒ 闸只读（不含 `INSERT/UPDATE/DELETE/FOR UPDATE/DO NOTHING` 类写语义）。

独立复核（`p2qa2-07-v3-debug-…json`，我自己注入偏移验证 win_len）：`injected_at = 27805` 落点
`db.b = 27751 / db.e = 30678 / win_len = 2927 / pos_update = 27696 / readonly_violation = false`。

### I3a · 字节级修前/修后 A/B（**文件体侧**）—— ✅ PASS

读数（来源：上一轮质检会话日志 `~/.hermes/profiles/zang/cache/delegation/live/deleg_3d51bc47/task-0.log`
21:29:37 与 21:30:17 两条 `result` 行；该读数为 stdout 形态，**未单独落 JSON**）：

```
C7 REGION: 0005 idx 58511–61383 / 0012 idx 40922–43794，长度均 2872 B
C7 REGION IDENTICAL: True      sha256(0005 C7) == sha256(0012 C7) == 453a2e7781743866…
diff(0005 函数体, 0012 函数体) = 恰好 2 处 hunk，两侧都是纯插入：
  hunk1  0005[66:66]  → 0012[66:69]   （+ `-- 0012：重放前置闸…` + `v_gate_txid bigint;` + `v_gate_fp text;`）
  hunk2  0005[582:582] → 0012[585:653]（+ C4.5 闸整块，含两标记）
函数体长度：0005 = 42448 B，0012 = 45597 B
sha256(0005 函数体) = 9da1fe3cc135…   ← 把上述两处插入从 0012 删除，得到的字节序列与 git 内 0005 逐字相等
```

⇒ 「修前/修后」在**字节层面**是**纯插入**关系：删掉两处插入即回到 `0005` 的字节；
C5–C8（含 C7 重放返回形状）**一字未动**。这同时是 I9① 的独立证据。

### I3b · 行为侧 A/B（修前 ⇒ 缺陷复现 / 0012 ⇒ 200 重放）—— ⚠️ 未验证（旁证 PASS）

**诚实登记**：为跑该项而写的探针 `p2qa2-08-before-state.ts`（13348 B）**只写出、未执行**，
盘上**没有**对应 JSON 读数 ⇒ 我这侧**没有**可核的「装载 `0005` 体 ⇒ `LD002`」读数。
可引用的**旁证**（交付方相位读数，我**读过未重跑**）：
`backend-ts/.p2x-artifacts/p2x-00-replay-order-P2XBEF01.json`
（`phase: before`，`schema_version: 0011`，`prosrc_len: 42449`，`pre_gate_present: false`，
`red_cases: ["1","2","3","4","5","5b"]`，其中「托管花光后同键同载荷再发 ⇒ 200 + `idempotent_replay:true`」= **false**）
与 `…-P2XFIN01.json`（`phase: after`，`prosrc_len: 45598`，`pre_gate_present: true`，`red_cases: ["5"]`，
案例 1/2/3/4 全绿，含 `LD003`/`LD002`/`LD001` 三码与「零写入」判据）。
⇒ 缺陷方向与修复方向一致，但**该缺口属于「我不是亲自跑出来的」**，照登 §⑥。

### I4 · 头号用例（托管恰花光后同键重试）—— ✅ PASS **18 / 18 GREEN**，`reds: []`

读数：`p2qa2-03-behavior-20260927T131927Z.json`（`tx_ms = 13418`，`tx_rolled_back = true`，
`residual_note`：A* 全部在已回滚事务内 ⇒ `users`/`currency`/`ledger_entry` 零残留）

| 检查 | 读数 |
|---|---|
| A0 夹具 | `uid 961981 / cid 237 / balance 376544 / frozen 123456` |
| A1 首写 | `ok: true`，`idempotent_replay: false`，`entries_n: 2`，`txid 5283` |
| A2 托管恰花光 | `frozen = 0`（balance 376544） |
| A3 **同键同指纹重试** | `ok: true` + **`idempotent_replay: true`**（`sqlstate: null`） |
| A4 **同 txid** | `first 5283 / replay 5283` |
| A5 **零新增** | 键下分录行数 `after_first 2 / after_replay 2 / after_third 2` |
| A6 **逐字相同** | `entries_sha256` = `a18d87fffbcbcb11fc0c2c8d48fc3f57cef0c1c0e36f31301b8583768211e0ad`（首写 == 重放）；`accounts_sha256` = `bb3314886f5efc7bc24cef76229f671331c2284cacf5f57a1a87ff629ec6c736`（首写 == 重放） |
| A7 不双扣 | 首写后 == 重放后：`balance 376544 / frozen 0` |
| A8 重放自身幂等 | 第三次调用逐字等于第二次 |
| A9 `extra` 事实登记 | 首写 `extra = {symbol: p2qa22sj889, entries: "2"}` vs 重放 `extra = {}`（**与修复无关**，见 I9①） |
| M0 未碰别人钱 | `cid=1` 与平台账户哈希前后一致 |

### I5 · 反向用例 —— ✅ PASS

| 检查 | 读数 |
|---|---|
| B1 同键**异指纹** | `sqlstate: "LD003"`，`msg: LEDGER_IDEMPOTENCY_CONFLICT`（409 语义，R52②） |
| B2 冲突**零写入** | 键下仍 `rows: 2`，账户 `balance 376544 / frozen 0` 未变 |
| B3 冲突后同键同指纹 | 仍是 200 重放（状态未被污染） |
| B4 **全新键** + 冻结不足 | 仍 `LD002`（`LEDGER_INSUFFICIENT_FROZEN`）⇒ 闸未拆掉、R63 仍成立 |
| B5 **全新键** + 余额不足 | 仍 `LD001`（`LEDGER_INSUFFICIENT_BALANCE`） |
| B6 被拒新事件零残留 | 两新键下 `0` 行 + 账户未变 |
| B7 错误可机读 | `e.detail` 是 JSON：`{"actual":"qa-evt-fp-2","expected":"qa-evt-fp-1","idempotency_key":…}`，`code/sqlstate = LD003` |

### I6 · 真并发（我自己写的探针，胜者一 resolve 立刻 COMMIT、**不等败者**）—— ✅ PASS **14 / 14**，`reds: []`

读数：`p2qa2-04-concurrency-20260927T131927Z.json`（夹具 `uid 961825 / cid 238 / balance 500000 / frozen 500000`）

| 检查 | 读数 |
|---|---|
| 5A1 齐发同键 ⇒ 恰一个落账 | `landed: 1`（winner A） |
| 5A2 另一个必须 200 重放 | `replay: 1`，`errs: []` |
| 5A3 重放方 txid == 落账方 | 双方 `txid 5290` |
| 5A4 **胜者不等败者即提交成功** | `winner_commit_error: null`，`winner_commit_ms: 200`，`total_race_ms: 624` |
| 5A5/5A6 不双扣 | 键下恒 2 行；`E5 balance 500000 / frozen 300000`（恰扣一次 200000）、`W5 balance 200000` |
| 5B1/5B2 分阶段竞态 | A 首写提交（`txid 5292`）；B **确实阻塞** `blocked_ms: 1024` |
| 5B3/5B4 | A 提交后 B 同键重试 ⇒ `200 + idempotent_replay: true`、同 `txid 5292`（不是 `LD002`/`LD025`） |
| 5B5 不双扣 | 键下 2 行，`E5 500000/0`、`W5 500000/0` |
| T0 全部键行数 | `5a=2 / 5b=2 / mint=1 / hold200=2 / hold300=2` |
| M0 | `cid=1` 与平台账户哈希前后一致 |

**这条是本次质检最关键的行为证据**：败者并没有因为「托管已被胜者花光」而拿到 `LD002`，
而是拿到与胜者**同一 txid** 的 200 重放 ⇒ 前置闸在**真并发**下同样成立。

### I7 · §C 自检判负能力 —— ✅ PASS（以最后一跑为准）

读数：`p2qa2-06-negative-control-…Z-2.json`（`all_as_expected: true`，`fn_restored_to_original: true`，
`do_block_bytes: 9228`，`.b.out` 末行 **`EXIT=0`**），并对照 `…Z-1.json` 与 `…Z.json`（早期两跑，用于说明我自己修过探针判据）。

| 变体 | 变体含义 | `bhv` 段 | `struc` 段 |
|---|---|---|---|
| V0 | 原样（对照） | `PASS`（`raised=false`）⇒ **无假阳性** | `PASS`（`raised=false`） |
| V1 | 抹掉闸 `BEGIN/END` 标记 | `raised=true` `P0001`（自检明细含「标记缺失或错位 / 不在 C4 之后 / 缺 R52② / 缺 R52① / 未按 `event_root_key` 归属 / …」共 5 条） | 同左 |
| V2 | 整段闸挪到函数末尾（= 余额闸之后） | `raised=true` `LD002` | `raised=true` `P0001`（「不在 C5 段之前 / 不在 R80 余额闸之前 / `ON CONFLICT` 探针被挪到闸之前」） |
| V3 | 闸体塞写关键字 | `raised=true` `P0001`（「闸体出现写/加锁关键字（必须只读）」） | 同左 |
| V4 | `ON CONFLICT … DO NOTHING` 探针文本改写成等价换行 | `raised=true` `P0001`（「R51 的 ON CONFLICT (idempotency_key) DO NOTHING 首条分录探针**消失了**」） | 同左 |
| V5 | 闸体不再按 `event_root_key = v_key` 归属（+行为探针） | `raised=true` `LD006`（`LEDGER_IDEMPOTENCY_REPLAY`） | **`raised=false`（逃逸）** ← 见 §⑤② |
| V6 | 闸体未标注既有索引用途 `idx_ledger_event_root_key` | `raised=true` `P0001` | 同左 |
| V7 | ⑤ 四支全缺 + 行为探针① | `raised=true` `LD002` | `raised=true` `P0001` |

`summary`：`behavioral_pass_all_raised: true`；`behavioral_pass_selfcheck_msg_ids = [V1,V3,V4,V6]`；
`behavioral_pass_other_msg_ids = [V2:LD002, V5:LD006, V7:LD002]`；`any_malformed_array_literal: false`。
⇒ **7 个破坏变体全部真的 RAISE**（`P0001` 自检消息或契约码），迁移期会**整文件回滚**；
唯一「未 RAISE」的是 `struc V5`（结构性文本断言的固有盲区，行为侧仍抓住，登记 §⑤②）。

**V7 修正版重跑：未执行**（本单硬约束：禁改 `backend-ts/**`，而修正 V7 形意须改探针
`p2qa2-06-negative-control.ts`）⇒ **以现有读数为准**：
`p2qa2-07b-v3-dump-…json`（`bm_in_def = 27811`，`gs = 27805`，dump 上下文显示 `0012-REPLAY-PRE-GATE-BEGIN`
标记后紧跟空闸体 ⇒ V7 形状 = **闸体清空但保留两标记**）与上表 V7 行（`struc` 判负成功、`bhv` `LD002`）。

### I8 · 报错不再被 22P02 掩盖 —— ✅ PASS（按现有读数）

三次运行的变体读数里**没有任何一条**出现 `22P02` / malformed array literal：
`…Z.json`（8 条，字段 `msg_has_22P02 = false` × 8）、`…Z-1.json`（16 条）、`…Z-2.json`（16 条，
`msg_has_array_literal = false`，`any_malformed_array_literal = false`）⇒ 合计 **40 条读数零 22P02**。
（登记：该结论是**变体实验口径**，不是端到端 HTTP 口径，见 §⑥。）

### I9 · 交付方两条断言复核 —— ✅ 两条**均证实为真**

**① `extra` 早于 `0012`** —— ✅ 真
- 字节层：`0005` 与 `0012` 的 C7 段 **byte-identical**（长度均 2872 B，sha256 同为 `453a2e7781743866…`，见 I3a）；
- 状态层：`p2qa2-02-intel-…json` 记 `null_event_root_key_rows = 7`（遗留键 `ops:p1h:…:coll:legacy#2` 的 `request_fingerprint` 为 `null`）
  ⇒ 老数据里**本来就存在**「非闸重放路径」的事件；
- 形状层：`0005` 的 C7 分支写死的正是 `'extra', '{}'::jsonb`，与我 I4-A9 观测到的 `replay_extra = {}` 同形。
⇒ 「重放 `extra` 为空」**不是 `0012` 引入的回归**，而是 `0005` 起就有的既有行为。

**② `p2x-00` 用例 5 的 red 与 `0012` 无关** —— ✅ 真
- `.p2x-artifacts/p2x-00-replay-order-P2XBEF01/02/03.json`（**before 三份**）与 `…P2XFIN01.json`（after）
  同样报 `LD025`（`LD025` x3 / x1），即**修前就有**；
- 根因是该探针 `await Promise.all` 之后**才提交**胜者 ⇒ 双方互等（自造互等），不是账本缺陷；
- 我自己的真并发探针（胜者一 resolve **立刻** COMMIT）在同一库里拿到 `landed 1 / replay 1 / error 0`（I6）
  ⇒ 反证该 red 属于探针写法，不属于 `0012`。

### I10 · 钱未被碰 / 迁移链未被改 —— ✅ PASS

- `cid=1`：`hash 2abde15ad1ae7e2d301a982493cbf925`，`rows 7`，`balance_sum 8400`，`frozen_sum 0`
  —— 在 `p2qa2-01`（质检开始）与 `p2qa2-03` / `p2qa2-04`（结束）**前后逐字相同**；
- 平台账户 `cid 0/-1/-2/-3`：`hash 332fffe6b61ce717f8774301d6fd67d4`，`rows 29`，`sum 46` —— 同样前后相同；
- `git diff --numstat HEAD~1` 对 `backend-ts/migrations/0001`–`0012` **全部 `0` 行**（`git status` 对 `migrations/` 干净）
  ⇒ `0012` 的落盘内容与提交内容一致，质检期间无人改动迁移链。

---

## ④ 「可否验收」意见 —— **可验收（PASS）**

**意见：`0012` 幂等重放前置闸可以验收。**

理由（按权重）：
1. **契约级行为已被独立证实**（这是权重最高的一条）：托管恰花光后同键重试 ⇒ `200 + idempotent_replay:true`
   + **同 txid** + 键下行数 2/2/2 零新增 + `entries`/`accounts` sha256 与首写逐字相同（I4，18/18）；
   **真并发**下败者阻塞后同样拿到胜者 txid 的 200 重放（I6，14/14）⇒ 修复的确把「幂等短路」提到了余额/冻结闸之前。
2. **没有把别的契约拆掉**：异指纹仍 `LD003`（零写入、不污染后续重放）、全新键的冻结/余额不足仍 `LD002`/`LD001`
   且零残留 ⇒ R51 / R52② / R63 全部仍在（I5）。
3. **改动面可控**：与 `0005` 只有两处**纯插入**，C5–C8 一字未动（I3a）；闸体只读（I2）。
4. **可复现、可回归**：盘/库三向一致 + `migrate.ts` 两跑 12/12 skipped `EXIT=0`（I1）；
   §C 自检对 7 种破坏**全部真 RAISE**（I7）⇒ 以后误改会被迁移期拦下。
5. **无副作用**：`cid=1` / 平台账户未被动、`0001`–`0012` 未改（I10）。

**验收前提（照登）**：本结论的行为证据是**函数直调**口径（`ledger_post_event`），
HTTP 200/409 端到端路径未观测（见 §⑥）；I3b 的「修前 ⇒ `LD002`」这一半未由我亲自落盘（旁证 PASS）。

---

## ⑤ 已知盲区与非阻塞建议（**Zang 已裁定：不为这两条开 `0013`**）

> 两条都是 **§C 迁移期自检的纵深防御**问题，不是契约缺陷；`0012` 已应用且被 `schema_migration.checksum` 锁住，
> 为「改善报错信息」抬一次 `schema_version` 无契约价值 ⇒ **留待下次真正需要 `CREATE OR REPLACE ledger_post_event` 时顺带修**。
> 我照单登记，**不修代码**。

**① §C 行为探针里 `v_r2 := ledger_post_event(v_evt)` 未受保护 ⇒ 最需要诊断时丢诊断明细。**
§C 累积自检明细用的是 `v_bad` 数组（`0012 self-check failed: …` 的 5 条），但行为探针那一次调用
**没有被单独的 `BEGIN … EXCEPTION` 包住**：一旦闸被破坏，它会**先抛裸 `LD002`/`LD006`**
（实测 V5 ⇒ `LD006`、V2/V7 ⇒ `LD002`），把已经攒好的 `v_bad` 明细**顶掉**。
后果：**fail-closed 仍然成立**（迁移整文件回滚、exit 4），但**恰好在「闸被破坏」这个最需要读懂的场景**，
现场只留下一个契约码，结构性诊断丢失。建议：把该调用单独包进 `BEGIN … EXCEPTION WHEN OTHERS THEN`
（只登记异常码、继续跑完其余变体），与 V1/V3/V4/V6 的 `P0001` 明细同级输出。

**② §C 的结构性位置/只读断言是「子串匹配」⇒ 语义改坏但逐字保留关键子串的改写会逃逸。**
结构断言靠 `position()` 找标记/字面量（如 `'ON CONFLICT (idempotency_key) DO NOTHING'`、
`idx_ledger_event_root_key`、写关键字黑名单）。把 `t.event_root_key = v_key` 这类条件**语义改坏但逐字保留**
（实测 **V5**：`struc` 段 `raised=false` = **逃逸**）不会被结构性断言拦住，只靠**行为探针**兜底（`bhv V5` 判负成功）。
建议：把位置断言从「子串存在」升级为「**归一化 SQL 片段的结构比较**」（例如对 C4/闸/R80/探针四处
取锚点区间做归一化后比对或 AST 级断言），并在 `struc` 段也为 V5 类补一条**语义等价性**断言。

---

## ⑥ 未验证清单（照登，不做替代性推断）

1. **报告未落盘** —— 本单补写（即本文件）；上一轮质检因工具步数耗尽未写出。
2. **HTTP 200/409 端到端未观测** —— `backend-ts/src/index.ts` 不 import `./ledger`，**没有暴露路由**；
   我的「200 重放 / 409 `LD003`」全部是函数直调语义（`ok:true`/`sqlstate:LD003`），不是真实 HTTP 状态码。
3. **I3b 的「修前 ⇒ `LD002` 缺陷复现」这半未由我落盘** —— `p2qa2-08-before-state.ts` 只写出未执行；
   仅有交付方相位读数（`.p2x-artifacts/…P2XBEF01.json`，before/0011）作旁证，我读过未重跑。
   我这侧**可核**的是字节层等价（删两处插入 == `0005` 字节，sha256 `9da1fe3cc135…`）。
4. **22P02「不再掩盖」只用 7 变体实验证明** —— 未做端到端（HTTP/TS 层）的 22P02 观测。
5. **断言 9b 未重跑 `p2x-00`** —— 我用 `.p2x-artifacts` 的 before/after 五份读数 + 自己的真并发探针反证，未重跑该脚本。
6. **结构断言子串盲区只举了 V5 一例** —— 未做变体空间的系统扫描。
7. **交付方其余读数未逐项重跑** —— 我只重取/复核了本报告 I1–I10 覆盖的项。
8. **§19.6「未传指纹」分支未单独出探针** —— 该分支（调用方不传 `request_fingerprint`）未单独构造用例，
   仅在 `p2qa2-02-intel` 里以「库里 7 行历史 null 指纹」的事实登记。
9. **V7 修正版重跑未取回** —— 本单禁改 `backend-ts/**`（探针文件在 `backend-ts/.p2qa2-artifacts/` 内），
   故以现有 `p2qa2-07b-v3-dump-…json` 与 `-2` 跑的 V7 行为/结构读数为准。

---

## ⑦ 附录 · 读数索引（全部为 `20260927T131927Z`）

| 文件 | 用途 |
|---|---|
| `.p2qa2-artifacts/.run-tag` | `20260927T131927Z` |
| `p2qa2-01-fingerprints-…Z.json` | I1 三向指纹 / I2 闸位置与只读 |
| `p2qa2-02-intel-…Z.json` | `ops_in_source`、`kind` 白名单矩阵、`null_event_root_key_rows = 7` |
| `p2qa2-03-behavior-…Z.json` | I4/I5 头号 + 反向（18 项全绿，`reds: []`） |
| `p2qa2-04-concurrency-…Z.json` | I6 真并发（14 项全绿，`reds: []`） |
| `p2qa2-05-timeouts-…Z.json` | `ledger_lock_timeout_ms() = 3000`、`pg_settings`（`lock_timeout=0 / statement_timeout=0` 默认） |
| `p2qa2-06-negative-control-…Z.json` / `…Z-1.json` / `…Z-2.json` | I7/I8 判负变体（以 `-2` 为最终：`all_as_expected: true`） |
| `p2qa2-06-negcontrol-…Z.b.out` | 最终跑 stdout（末行 `EXIT=0`） |
| `p2qa2-07-v3-debug-…Z.json` / `p2qa2-07b-v3-dump-…Z.json` | 闸窗口注入校验 / V7 形状 dump |
| `p2qa2-08-before-state.ts` | **只写出未执行**（见 §⑥ 3） |
| `p2qa2-migrate-run1-…Z.out` / `-run2-…Z.out`（`.err` 均 0 B） | I1 migrate 幂等两跑 |
| `.p2x-artifacts/p2x-00-replay-order-P2XBEF01/02/03.json`、`…P2XFIN01.json` | I9②/I3b 旁证（交付方相位读数，读盘未重跑） |
| `~/.hermes/profiles/zang/cache/delegation/live/deleg_3d51bc47/task-0.log` | I3a 字节级 A/B 读数的来源行（21:29:37 / 21:30:17） |

**报告落盘时刻**：2026-09-27 CST（run tag 当晚）；写本文件**未重跑任何探针**（仅补 V7 说明），未改任何代码。
