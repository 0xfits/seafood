# P1a 账本内核 · 独立并发质检报告（Neng）

- 被验提交：`66995d3`（HEAD）
- 质检人：Neng（独立第三方质检，未参与本模块实现）
- 质检时间：2026-09-27（CST）
- 质检对象：`/Users/kevin/bistro/seafood`（后端 `backend-ts`）
- 冻结指纹（开工前复算，**与派单一致**）：
  - `backend-ts/src/ledger.ts` = `5b5163b85388e7bff043dd3d3be87e69e1e91d321d13b01a0119777ddf6e8fbb`
  - `backend-ts/src/ledger-errors.ts` = `b296c7f050c6c3aa2f18d68bf36b3265d9caa66d7fdbfdc0d2487c4c1c564d46`
- 证据纪律：**全部读数由质检方自写探针产出**；**未运行、未引用**实现方自测脚本 `backend-ts/scripts/ledger-smoke.ts` 的任何读数（该文件仅在下列两条只读证据中被提及：① 它是派单点名的禁引用对象；② 它留下的历史数据行在「测试数据清单」中被区分标注）。
- 硬红线遵守：未使用任何按名字/模式杀进程（无 `pkill -f` / `killall`）；未停/未重启任何面板托管服务；未改 `docs/**`（除本文件）、`backend-ts/migrations/**`、`src/db.ts`、`src/ledger.ts`、`frontend/**`；未连旧 jinli 库；未 `git add -A`；未 commit/push/reset/checkout/stash/clean。

---

## 0. 环境、冻结指纹与基线

### 0.1 指纹与运行时

命令：

```
cd /Users/kevin/bistro/seafood && git rev-parse HEAD && git log --oneline -3
shasum -a 256 backend-ts/src/ledger.ts backend-ts/src/ledger-errors.ts
```

原始输出：

```
66995d3524c2a87beedb0bfe25f00a9c76e8fcf0
66995d3 feat(P1a): 多币种账本服务层 — 原子分录写入器 + mint/transfer/freeze/unfreeze/settleFrozen + 幂等全链路 + 负余额禁令
6323b0e master-plan v0.7: P0 全收口（收口单入库 + 面板注册 16/16 + 依赖补装）+ R3-P1a/P1b 派单记录
5b5163b85388e7bff043dd3d3be87e69e1e91d321d13b01a0119777ddf6e8fbb  backend-ts/src/ledger.ts
b296c7f050c6c3aa2f18d68bf36b3265d9caa66d7fdbfdc0d2487c4c1c564d46  backend-ts/src/ledger-errors.ts
```

### 0.2 服务端与基础设施读数

探针：`backend-ts/scripts/qa-p1b-00-env.ts`
命令：`cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-00-env.ts`

原始输出（节选，完整文件见探针输出）：

```
{"runtime":{"node":"v18.19.0","tx_pool_max_env":"(unset -> 默认 4)","read_pool_max_env":"(unset -> 默认 4)"},
 "server_settings":[{"name":"deadlock_timeout","setting":"1000","unit":"ms"},
   {"name":"default_transaction_isolation","setting":"read committed","unit":null},
   {"name":"lock_timeout","setting":"3000","unit":"ms"},
   {"name":"max_connections","setting":"112","unit":null},
   {"name":"server_version","setting":"18.6 (6569466)","unit":null},
   {"name":"statement_timeout","setting":"10000","unit":"ms"}],
 "triggers":[{"tbl":"account","tgname":"trg_account_guard","tgenabled":"O"},
             {"tbl":"ledger_entry","tgname":"trg_ledger_entry_append_only","tgenabled":"O"}],
 "row_counts":[{"t":"account","n":"9"},{"t":"currency","n":"3"},{"t":"ledger_entry","n":"90"},
               {"t":"ledger_owner","n":"4"},{"t":"schema_migration","n":"2"},{"t":"user","n":"0"}],
 "latency_readQuery_select1":{"n":30,"total_ms":5688,"avg_ms":189.6},
 "latency_withTransaction_begin_commit":{"n":10,"total_ms":11789,"avg_ms":1178.9},
 "drift_before":[], "qa1b_entries":{"n":"0"}}
```

事务内超时设置取证（探针 `qa-p1b-06-lock-deadlock.ts`，`QA_MODE=settings`）：

```
{"case":"5-settings","outside_tx_defaults":{"lock_timeout":"0","statement_timeout":"0"},
 "inside_tx":{"lock_timeout":"3s","statement_timeout":"10s","isolation":"read committed",
             "deadlock_timeout":"1s","backend_pid":9898,"xid":"2410"}}
```

**结论（0.2）**：R82 声明的 `SET LOCAL lock_timeout = 3s` / `statement_timeout = 10s` 与隔离级别 `read committed` **在真实事务内确实生效**（`current_setting` 实测）；两个守卫触发器 `tgenabled='O'`（启用状态，未被人为关闭）。

### 0.3 单事务延迟基线（**本次质检最关键的环境事实**）

探针 `qa-p1b-01-setup.ts` 原始输出：

```
{"latency":{"transfer_uncontended_ms":[3873,3322,4363],
            "mint_uncontended_ms":[2464,2120,3104],
            "tx_begin_commit_ms":[2250,1377,1478]}}
```

- `transfer`（无任何并发争抢）单笔 **3.3–4.4 秒**；`mint` 单笔 **2.1–3.1 秒**；连 `BEGIN…COMMIT` 都要 **1.4–2.3 秒**。
- 根因：客户端↔Neon 端点每轮往返 ≈ **190–290 ms**，而一笔 `transfer` 需要 ~10–14 条语句（`BEGIN` + 2×`SET LOCAL` + 读币种 + 2×加锁 + 2×(INSERT+UPDATE) + `COMMIT`）。
- **直接后果**：`lock_timeout = 3s` 只能容纳「再等 1 个持有者」。即**同一行上的有效并发上限 ≈ 2**，第 3 个及以后的同账户请求会在锁等待 3s 后以 `503 LEDGER_LOCK_TIMEOUT` 失败；若并发请求数超过事务池 `max`（默认 4），更多请求会在**拿连接**阶段就 10s 超时（见 §1/§2）。

这条事实决定了 §10 R85 用例 ①③④ 的「100 并发」字面口径在本环境下**不可能全部成功**——它是环境/参数匹配问题，不是账本逻辑缺陷；但它必须被显式裁定（详见 §8）。

---

## 1. 用例①：同一账户 100 并发转账后总额守恒（R85①）

- 目的：同一账户被 100 笔并发转账争抢时，**全局总额必须逐字不变**，且账户级不变式 `balance = Σdelta` / `frozen = Σfrozen_delta` 必须成立、余额不得为负。
- 探针：`backend-ts/scripts/qa-p1b-02-conserve-hot.ts`（+ 公共库 `qa-p1b-lib.ts`）
- 模式：N 笔并发 `transfer(910001 → 910003/910004, amount=1, 各自独立幂等键)`；并发期间用独立只读连接采样 `pg_stat_activity`。

### 1.1 运行 A：100 并发，事务池 32（真正 100 笔同时在飞）

命令：

```
cd backend-ts && QA_N=100 QA_TAG=hot100p32 SEAFOOD_TX_POOL_MAX=32 \
  npx ts-node --transpile-only scripts/qa-p1b-02-conserve-hot.ts
```

原始输出：

```
{"case":"1-hot","config":{"N":100,"TAG":"hot100p32","cid":"4","SRC":"910001","receivers":["910003","910004"],"pool_max":"32"},
 "wall_ms":17934,"latency_ms":{"min":5636,"p50":10003,"max":17918},
 "outcome":{"success":5,"idempotent_replay_values":[false],"failure":95,
            "failure_codes":{"LEDGER_LOCK_TIMEOUT":58,"LEDGER_TRANSACTION_REQUIRED":37}},
 "ledger_entries_written_for_run":10,"entries_by_uid":{"910001":5,"910003":2,"910004":3},
 "accounts_before":[{"uid":"910001","cid":"4","balance":"999982","frozen":"0","version":"21"},
                    {"uid":"910003","cid":"4","balance":"5","frozen":"0","version":"5"},
                    {"uid":"910004","cid":"4","balance":"2","frozen":"0","version":"2"}],
 "accounts_after":[{"uid":"910001","cid":"4","balance":"999977","frozen":"0","version":"26"},
                   {"uid":"910003","cid":"4","balance":"7","frozen":"0","version":"7"},
                   {"uid":"910004","cid":"4","balance":"5","frozen":"0","version":"5"}],
 "deadlocks":{"before":"0","after":"0"},
 "concurrency_evidence":{"samples":34,"sampler_errors":0,"distinct_pids_observed":32,
   "max_simultaneous_active":31,"max_simultaneous_lock_waiters":31,
   "max_simultaneous_ledger_stmts":1,"max_simultaneous_tx":32,"ledger_statement_pids":2},
 "assertions":{"A_conservation_total_net_equal":true,"B_drift_impl_zero":true,"B_drift_qa_zero":true,
   "C_drift_qa_cid_zero":true,"C_per_account_invariant_ok":true,"D_min_non_negative":true,
   "E_success_amount_matches_source_debit":true,"F_no_new_deadlocks":true},
 "metric_net":{"before":"1000003","after":"1000003"},"all_pass":true}
```

读数解读（全部来自上面这一行）：

| 断言 | 读数 | 判定 |
|---|---|---|
| A 总额守恒 | `Σ(balance+frozen)` cid=4：`1000003 → 1000003` | **PASS** |
| B 并发后无漂移（两套独立 SQL） | `findAccountDrift()=0` 且 质检方自写漂移 SQL `=0` | **PASS** |
| C 账户级不变式 | cid=4 漂移行 = 0 | **PASS** |
| D 无负余额 | 全库 `min(balance)>=0`、`min(frozen)>=0` | **PASS** |
| E 成功笔数 == 源账户被扣 | 5 笔成功，`999982 − 999977 = 5` | **PASS** |
| F 无死锁 | `deadlocks` 计数 0 → 0 | **PASS** |
| 并发真实性 | 同时观测到 **32 个不同后端 pid**、**同一瞬间最多 32 个事务**、**31 个锁等待者** | 真并发 |

**用例①的账务安全断言：PASS。** 但字面口径的「100 笔并发转账」只有 **5 笔成功**（58 笔 `LEDGER_LOCK_TIMEOUT`、37 笔 `LEDGER_TRANSACTION_REQUIRED`）——这不是守恒被破坏，而是 §0.3 的延迟事实 + 池上限所致（详见 §8 裁定建议）。

### 1.2 运行 B：100 并发，事务池 4（= `db.ts` 默认，即当前真实部署形态）

命令：`QA_N=100 QA_TAG=hot100p4 npx ts-node --transpile-only scripts/qa-p1b-02-conserve-hot.ts`（不带 `SEAFOOD_TX_POOL_MAX`）

原始输出（关键字段）：

```
{"case":"1-hot","config":{"N":100,"TAG":"hot100p4","pool_max":"4"},
 "wall_ms":19426,
 "outcome":{"success":7,"idempotent_replay_values":[false],"failure":93,
            "failure_codes":{"LEDGER_TRANSACTION_REQUIRED":93}},
 "concurrency_evidence":{"distinct_pids_observed":4,"max_simultaneous_active":3,
   "max_simultaneous_lock_waiters":3,"max_simultaneous_tx":4},
 "assertions":{...8 项全部 true...},"metric_net":{"before":"1000003","after":"1000003"},"all_pass":true}
```

**PASS**（守恒/漂移/非负/扣款一致全部为真）；但 93 笔失败**全部**是 `LEDGER_TRANSACTION_REQUIRED`（连接池耗尽后的连接建立超时，见 §2.3），并发上限被池 `max=4` 钉死。

### 1.3 运行 C：中等并发（4 笔）——同一账户上的真并发全成功

命令：`QA_N=4 QA_TAG=smoke4 SEAFOOD_TX_POOL_MAX=8 npx ts-node --transpile-only scripts/qa-p1b-02-conserve-hot.ts`

原始输出（关键字段）：

```
{"case":"1-hot","config":{"N":4,"pool_max":"8"},"wall_ms":11334,
 "latency_ms":{"min":4204,"p50":9009,"max":11334},
 "outcome":{"success":4,"failure":0},
 "ledger_entries_written_for_run":8,
 "concurrency_evidence":{"distinct_pids_observed":4,"max_simultaneous_lock_waiters":3,"max_simultaneous_tx":4},
 "assertions":{...8 项全部 true...},"metric_net":{"before":"1000003","after":"1000003"},"all_pass":true}
```

**PASS**：4 笔同一账户并发转账全部成功、逐笔串行（wall 11.3s ≈ 4×单笔），总额守恒。

---

## 2. 用例②：同一幂等键 100 并发只生效一次（R85② / R51 / R52 / R106）

- 目的：同一业务键被 100 次并发提交，**只允许生效一次**；其余必须是「重放」（`idempotent_replay=true`，不是错误）或明确的过载码，**绝不能双扣**。
- 探针：`backend-ts/scripts/qa-p1b-03-idem.ts`（键 `ops:qa1b:c2:<TAG>`，金额 3，`910001 → 910005`）；对照实验同探针 `QA_CONTROL=1`。

### 2.1 运行 A：100 并发（池 32）

命令：

```
cd backend-ts && QA_N=100 QA_TAG=idem100p32 SEAFOOD_TX_POOL_MAX=32 \
  npx ts-node --transpile-only scripts/qa-p1b-03-idem.ts
```

原始输出：

```
{"case":"2-idem","config":{"N":100,"TAG":"idem100p32","KEY":"ops:qa1b:c2:idem100p32","AMOUNT":"3","pool_max":"32"},
 "wall_ms":15945,
 "balances":{"src_before":"999977","src_after":"999974","dst_before":"6","dst_after":"9"},
 "outcome":{"success":9,"replay_false":1,"replay_true":8,"failure":91,
            "failure_codes":{"LEDGER_LOCK_TIMEOUT":54,"LEDGER_TRANSACTION_REQUIRED":37},
            "distinct_txids_returned":["184"]},
 "ledger_rows_for_key":[
   {"txid":"184","uid":"910001","delta":"-3","frozen_delta":"0","balance_after":"999974","idempotency_key":"ops:qa1b:c2:idem100p32"},
   {"txid":"185","uid":"910005","delta":"3","frozen_delta":"0","balance_after":"9","idempotency_key":"ops:qa1b:c2:idem100p32#2"}],
 "concurrency_evidence":{"distinct_pids_observed":32,"max_simultaneous_lock_waiters":31,"max_simultaneous_tx":32},
 "assertions":{"A_exactly_one_business_event":true,"A_entries_for_key":true,"B_source_debited_once":true,
   "B_dest_credited_once":true,"C_at_most_one_first_effect":true,"D_single_txid":true,
   "E_drift_zero":true,"E_conservation":true},"all_pass":true}
```

读数解读：

| 断言 | 读数 | 判定 |
|---|---|---|
| 恰好一次业务事件 | 该键流水 **恰好 2 条**（键本身 + 派生键 `#2`），无 `#3` 及以上 | **PASS** |
| 余额只被扣一次 | 源 999977→999974（**−3**，恰一次）；收款 6→9（**+3**，恰一次） | **PASS** |
| 只有一次「首次生效」 | `replay_false=1`，其余成功响应 `replay_true=8` | **PASS** |
| 返回值同源 | 全部成功响应 `txid` 均为 `184`（同一条事件首分录） | **PASS** |
| 并发后守恒/无漂移 | 漂移 0、总额不变 | **PASS** |
| 并发真实性 | 32 个后端 pid、同时最多 32 事务、31 个锁等待者 | 真并发 |

**用例②的幂等安全断言：PASS（100 并发下只生效一次，绝无双扣）。**

### 2.2 运行 B：100 并发（池 8）——同一结论复现

命令：`QA_N=100 QA_TAG=idem100 SEAFOOD_TX_POOL_MAX=8 npx ts-node --transpile-only scripts/qa-p1b-03-idem.ts`

原始输出（关键字段）：

```
{"case":"2-idem","config":{"N":100,"pool_max":"8"},"wall_ms":15321,
 "balances":{"src_before":"999993","src_after":"999990","dst_before":"3","dst_after":"6"},
 "outcome":{"success":10,"replay_false":1,"replay_true":9,"failure":90,
            "failure_codes":{"LEDGER_LOCK_TIMEOUT":6,"LEDGER_TRANSACTION_REQUIRED":84},
            "distinct_txids_returned":["141"]},
 "ledger_rows_for_key":[{"txid":"141",...},{"txid":"142","idempotency_key":"ops:qa1b:c2:idem100#2"}],
 "assertions":{...8 项全部 true...},"all_pass":true}
```

### 2.3 运行 C：低并发（3 笔）——100% 达到 R52 理想形态

命令：`QA_N=3 QA_TAG=idem3 SEAFOOD_TX_POOL_MAX=8 npx ts-node --transpile-only scripts/qa-p1b-03-idem.ts`

原始输出：

```
{"case":"2-idem","config":{"N":3,"KEY":"ops:qa1b:c2:idem3"},
 "outcome":{"success":3,"replay_false":1,"replay_true":2,"failure":0,
            "failure_codes":{},"distinct_txids_returned":["135"]},
 "ledger_rows_for_key":[{"txid":"135",...delta":"-3"...},{"txid":"136",...delta":"3","idempotency_key":"ops:qa1b:c2:idem3#2"}],
 "concurrency_evidence":{"max_simultaneous_lock_waiters":2,"max_simultaneous_tx":3},
 "assertions":{...8 项全部 true...},"all_pass":true}
```

**读数**：3 笔并发 → **1 笔首次生效 + 2 笔 `idempotent_replay=true`**，`failure=0`。这正是 R52/R106 规定的理想形态（同键并发全部按成功返回、只有一次入账），证明重放路径在真并发下可达；100 并发下剩余的失败**不是幂等逻辑失败**，而是 §2.4 的池/锁过载。

### 2.4 失败归因（`LEDGER_TRANSACTION_REQUIRED` 到底是什么）

100 并发下主导失败码是 `LEDGER_TRANSACTION_REQUIRED`（`details.cause='non_pg_error'`）。探针 `qa-p1b-10-errcause.ts` 原始输出：

```
{"case":"10-errcause","config":{"N":100,"pool":"8","tag":"errcause1"},"summary":{"ok":6,"fail":94},
 "distinct_failure_signatures":[
  {"count":89,"signature":"[\"LEDGER_TRANSACTION_REQUIRED\",{\"cause\":\"non_pg_error\"},null,\"服务暂不可用，请稍后重试\"]"},
  {"count":3,"signature":"[\"LEDGER_TX_TIMEOUT\",{},null,\"系统繁忙，请稍后重试\"]"},
  {"count":2,"signature":"[\"LEDGER_LOCK_TIMEOUT\",{},null,\"系统繁忙，请稍后重试\"]"}]}
```

用**同一个** `withTransaction`（`db.ts`，未改动）绕开账本层跑最小事务，取原始错误（探针 `qa-p1b-11-rawerr.ts`）：

```
# QA_N=100 SEAFOOD_TX_POOL_MAX=4
{"case":"11-rawerr","config":{"N":100,"pool":"4"},"wall_ms":10846,"outcome":{"ok":31,"fail":69},
 "distinct_raw_error_signatures":[{"n":69,"sample":{"ok":false,"ms":10002,"name":"Error",
   "message":"timeout exceeded when trying to connect"}}]}
# QA_N=100 SEAFOOD_TX_POOL_MAX=8
{"case":"11-rawerr","config":{"N":100,"pool":"8"},"wall_ms":10970,"outcome":{"ok":63,"fail":37},
 "distinct_raw_error_signatures":[{"n":37,"sample":{"ok":false,"ms":10000,"name":"Error",
   "message":"timeout exceeded when trying to connect"}}]}
# QA_N=100 SEAFOOD_TX_POOL_MAX=32
{"case":"11-rawerr","config":{"N":100,"pool":"32"},"wall_ms":5524,"outcome":{"ok":100,"fail":0},
 "distinct_raw_error_signatures":[]}
```

**根因**：`@neondatabase/serverless` WS 连接池的 `connectionTimeoutMillis: 10000`（`src/db.ts:105-106`）——并发请求数超过池 `max`（默认 4）时，多余请求排队 10s 后以**普通 `Error`（无 `code`）**「`timeout exceeded when trying to connect`」失败；该错误经 `src/ledger-errors.ts:197` 的兜底分支被**统一改写成 `LEDGER_TRANSACTION_REQUIRED`（500 / `details.cause='non_pg_error'`）**，真实原因被吞掉。

> 这是本轮质检**唯一一条落在 P1a 交付物（`ledger-errors.ts`）上的实现级缺陷**：连接池过载（应为 503 类「暂时不可用」）被报成 500 类「实现缺陷」语义码，并被 R108 的 500 报警规则污染；排查时无法区分。详见 §8。

### 2.5 判负对照（R93）：把「唯一约束探针」换成「先查后插」就会双扣

命令：`QA_CONTROL=1 QA_TAG=idem3 npx ts-node --transpile-only scripts/qa-p1b-03-idem.ts`

原始输出：

```
{"case":"2-control","what":"模拟缺陷实现「先查后插」（R51 禁止形态）：两条并发事务持同一业务键",
 "controlKey":"ops:qa1b:c2:ctl:idem3",
 "observed":[{"i":0,"saw_existing_rows":"0","decision":"PROCEED(当作首次)","inserted":true,"error":"Error:QA_CTL_ROLLBACK"},
             {"i":1,"saw_existing_rows":"0","decision":"PROCEED(当作首次)","inserted":true,"error":"Error:QA_CTL_ROLLBACK"}],
 "both_proceeded":true,
 "conclusion":"两条并发都读到 0 行并各自 INSERT ⇒ 该形态在同键并发下双扣（这正是 R51 用唯一约束替代先查后插的理由）",
 "entries_left_for_key_after_rollback":"0"}
```

**对照实验成立**：两条并发事务对同一业务键都读到 `0` 行并各自落账（**双扣先决条件**），而 §2.1 的正式实现（`INSERT … ON CONFLICT (idempotency_key) DO NOTHING` + 唯一约束）在同键 100 并发下只有 1 次生效。两次取证均在事务内 `ROLLBACK`，`entries_left_for_key_after_rollback = 0`（**不留痕**，已取证）。

---

## 3. 用例③：并发扣款不产生负余额（R85③ / R80）

- 目的：并发扣款**绝不允许**出现负余额；余额不足必须走业务码 `LEDGER_INSUFFICIENT_BALANCE`（R80：不允许把 DB CHECK 报错当正常流程）。
- 探针：`backend-ts/scripts/qa-p1b-04-negative.ts`（两种模式：`literal` 字面 100 并发；`rounds` 语义口径逐轮 2 笔并发）

### 3.1 运行 A：字面口径——余额 50、100 并发各扣 1（池 32）

命令：

```
cd backend-ts && QA_MODE=literal QA_N=100 SEAFOOD_TX_POOL_MAX=32 \
  npx ts-node --transpile-only scripts/qa-p1b-04-negative.ts
```

原始输出：

```
{"case":"3-negative-literal","config":{"MODE":"literal","N":100,"cid":"4","SRC":"910010","DST":"910011","seeded":50,"pool_max":"32","seed_replay":false},
 "wall_ms":19415,
 "balances":{"src_before":"50","src_after":"43","dst_after":"7"},
 "outcome":{"success":7,"failure":93,
            "failure_codes":{"LEDGER_TX_TIMEOUT":27,"LEDGER_LOCK_TIMEOUT":1,"LEDGER_TRANSACTION_REQUIRED":65}},
 "concurrency_evidence":{"distinct_pids_observed":32,"max_simultaneous_active":31,
   "max_simultaneous_lock_waiters":31,"max_simultaneous_tx":32},
 "assertions":{"A_min_non_negative":true,"A_source_never_negative":true,"A_success_le_seeded_balance":true,
   "B_drift_zero":true,"C_success_matches_debit":true,"D_failure_codes_all_known":true},"all_pass":true}
```

**PASS（安全断言全部成立）**：源账户 `50 → 43`（**从未出现负值**）、全库 `min(balance) >= 0`、成功 7 笔与扣减 7 恰好对上、并发后漂移 = 0。字面口径「100 笔全部成功」在本环境**不可达**（7 成功 / 93 失败：27 `LEDGER_TX_TIMEOUT`、1 `LEDGER_LOCK_TIMEOUT`、65 池连接超时），原因同 §0.3，非账务缺陷（详见 §8）。

### 3.2 运行 B：语义口径——「余额恰好只够一半请求」的逐轮并发（池 8）

命令：`QA_MODE=rounds QA_ROUNDS=2 SEAFOOD_TX_POOL_MAX=8 npx ts-node --transpile-only scripts/qa-p1b-04-negative.ts`

原始输出：

```
{"case":"3-negative-rounds","config":{"MODE":"rounds","ROUNDS":2,"cid":"4","pool_max":"8"},
 "seeded_accounts":[{"uid":"910020","balance":"1"},{"uid":"910021","balance":"1"}],
 "rounds":[
  {"round":1,"src":"910020","before":"1","after":"0",
   "results":[{"k":0,"ok":true,"replay":false},{"k":1,"ok":false,"code":"LEDGER_INSUFFICIENT_BALANCE"}],
   "success":1,"failure_codes":{"LEDGER_INSUFFICIENT_BALANCE":1},"min_balance_ok":true,"concurrent_tx_observed":2},
  {"round":2,"src":"910021","before":"1","after":"0",
   "results":[{"k":0,"ok":true,"replay":false},{"k":1,"ok":false,"code":"LEDGER_INSUFFICIENT_BALANCE"}],
   "success":1,"failure_codes":{"LEDGER_INSUFFICIENT_BALANCE":1},"min_balance_ok":true,"concurrent_tx_observed":2}],
 "assertions":{"A_all_rounds_non_negative":true,"B_exactly_one_success_per_round":true,
   "B_one_insufficient_per_round":true,"C_min_non_negative_global":true,"D_drift_zero":true},
 "all_pass":true}
```

第二轮独立复跑（`QA_ROUNDS=5`，其中第 3–5 轮为本轮新增的干净账户；第 1–2 轮因**探针重跑**余额已耗尽，属质检方探针可重入性缺陷，非被测缺陷）：

```
{"case":"3-negative-rounds","config":{"MODE":"rounds","ROUNDS":5,"pool_max":"8"},
 "rounds":[
  {"r":1,"before":"0","after":"0","succ":0,"codes":{"LEDGER_INSUFFICIENT_BALANCE":2},"tx":2},
  {"r":2,"before":"0","after":"0","succ":0,"codes":{"LEDGER_INSUFFICIENT_BALANCE":2},"tx":2},
  {"r":3,"before":"1","after":"0","succ":1,"codes":{"LEDGER_INSUFFICIENT_BALANCE":1},"tx":2},
  {"r":4,"before":"1","after":"0","succ":1,"codes":{"LEDGER_INSUFFICIENT_BALANCE":1},"tx":2},
  {"r":5,"before":"1","after":"0","succ":1,"codes":{"LEDGER_INSUFFICIENT_BALANCE":1},"tx":2}],
 "assert":{"A_all_rounds_non_negative":true,"C_min_non_negative_global":true,"D_drift_zero":true}}
```

**结论**：在 7 个「余额恰好等于请求数」的独立回合里（2 + 5 轮），每一回合都是 **恰好 1 笔成功 + 1 笔 `LEDGER_INSUFFICIENT_BALANCE`（业务码 409，非 500）**，余额归 0 且 `>= 0`，并发后零漂移。**用例③：PASS**（安全断言成立；字面 100 并发全成功的排期问题见 §8）。

---

## 4. 用例④：并发 mint 不超 supply_cap（R85④ / R24 / R83）

- 目的：并发 `mint` 绝不能突破 `supply_cap`；且 `total_supply` 的增量必须**恰好等于成功笔数**（双写原子性）。
- 探针：`backend-ts/scripts/qa-p1b-05-supplycap.ts`

### 4.1 运行 A：字面口径——`supply_cap = 1`，100 并发各铸 1（池 32）

命令：

```
cd backend-ts && QA_MODE=literal QA_N=100 SEAFOOD_TX_POOL_MAX=32 \
  npx ts-node --transpile-only scripts/qa-p1b-05-supplycap.ts
```

原始输出：

```
{"case":"4-supplycap-literal","config":{"MODE":"literal","N":100,"cid":"5","cap":"1","owner":"910002","pool_max":"32"},
 "wall_ms":12951,
 "supply":{"before":"0","after":"1","cap":"1"},
 "outcome":{"success":1,"failure":99,
            "failure_codes":{"LEDGER_LOCK_TIMEOUT":34,"LEDGER_SUPPLY_CAP_EXCEEDED":42,"LEDGER_TRANSACTION_REQUIRED":23}},
 "concurrency_evidence":{"distinct_pids_observed":32,"max_simultaneous_lock_waiters":31,"max_simultaneous_tx":32},
 "assertions":{"A_never_exceeds_cap":true,"B_supply_equals_successes":true,
   "B_supply_after_values_consistent":true,"C_failures_are_business_or_overload":true,
   "D_drift_zero":true,"D_min_non_negative":true},"all_pass":true}
```

**PASS**：`cap = 1` 时 100 并发铸造**恰好 1 笔成功**，`total_supply = 1 = cap`（**未超发**）；42 笔被业务码 `LEDGER_SUPPLY_CAP_EXCEEDED` 正确拦下，其余为锁/池过载码；`total_supply 增量 == 成功笔数`（0→1，1 笔）成立；并发后零漂移。

### 4.2 运行 B：逐轮语义口径——每轮全新 `cap = 1` 币种 + 3 笔并发

命令：`QA_MODE=rounds QA_ROUNDS=2 SEAFOOD_TX_POOL_MAX=8 npx ts-node --transpile-only scripts/qa-p1b-05-supplycap.ts`

原始输出：

```
{"case":"4-supplycap-rounds","config":{"MODE":"rounds","ROUNDS":2,"pool_max":"8"},
 "rounds":[
  {"round":1,"cid":"7","symbol":"qa1bCP1","cap":"1","supply_before":"0","supply_after":"1","success":1,
   "results":[{"k":0,"ok":true,"replay":false},{"k":1,"ok":false,"code":"LEDGER_SUPPLY_CAP_EXCEEDED"},
              {"k":2,"ok":false,"code":"LEDGER_SUPPLY_CAP_EXCEEDED"}],
   "failure_codes":{"LEDGER_SUPPLY_CAP_EXCEEDED":2},"never_exceeds_cap":true},
  {"round":2,"cid":"8","symbol":"qa1bCP2","cap":"1","supply_before":"0","supply_after":"1","success":1,
   "results":[{"k":0,"ok":true,"replay":false},{"k":1,"ok":false,"code":"LEDGER_SUPPLY_CAP_EXCEEDED"},
              {"k":2,"ok":false,"code":"LEDGER_SUPPLY_CAP_EXCEEDED"}],
   "failure_codes":{"LEDGER_SUPPLY_CAP_EXCEEDED":2},"never_exceeds_cap":true}],
 "assertions":{"A_all_rounds_within_cap":true,"B_exactly_one_success_per_round":true,
   "B_supply_equals_one":true,"D_drift_zero":true},"all_pass":true}
```

第二轮独立复跑（`QA_ROUNDS=3`；第 3 轮为全新币种 `qa1bCP3`，第 1–2 轮因探针重跑，`cap` 已在上一轮被占满 —— **这本身是一条有价值的补充证据：cap 用尽后再铸必然被拒，`total_supply` 保持在 1 不回退**）：

```
{"rounds":[{"round":1,"cap":"1","sup":"1","succ":0,"codes":{"LEDGER_SUPPLY_CAP_EXCEEDED":3}},
           {"round":2,"cap":"1","sup":"1","succ":0,"codes":{"LEDGER_SUPPLY_CAP_EXCEEDED":3}},
           {"round":3,"cap":"1","sup":"1","succ":1,"codes":{"LEDGER_SUPPLY_CAP_EXCEEDED":2}}],
 "assert":{"A_all_rounds_within_cap":true,"B_supply_equals_one":true,"D_drift_zero":true}}
```

**结论**：`supply_cap` 在并发下**从未被突破**；`total_supply` 严格等于成功铸造额。**用例④：PASS。**

---

## 5. 用例⑤：死锁 / 串行化失败重试（R85⑤ / R60 / R79 / R83）

- 目的：① 证明加锁语义真的串行化（`FOR UPDATE` 有效）；② 制造**真实** `40P01` 并观察重试行为；③ 验证重试不会双扣/双铸；④ 诚实报告「能否用公开账本动作构造反向加锁」。
- 探针：`backend-ts/scripts/qa-p1b-06-lock-deadlock.ts`（`QA_MODE=settings|locksem|deadlock|exhaust|apiorder|rawreverse|hybrid`）

### 5.1 加锁语义对照实验（`QA_MODE=locksem`）

命令：`QA_MODE=locksem npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts`

原始输出：

```
{"case":"5-locksem",
 "plain_select_pair":{"first_tx":{"first_read":"11","released_at_ms":3737},
   "second_tx":{"request_at_ms":3609,"done_at_ms":3899,"waited_ms":290,"read":"11"},
   "serialized":false,"same_preimage_read":true},
 "for_update_pair":{"first_tx":{"released_at_ms":2507},
   "second_tx":{"request_at_ms":1765,"acquired_at_ms":2703,"waited_ms":938},
   "serialized":false},
 "conclusion":"plain SELECT 两笔并发读到同一前像（不串行化）；FOR UPDATE 第二笔被阻塞到第一笔释放（串行化）"}
```

**读数**：`plain SELECT` 两笔并发读到**同一前像 `11`**（第二笔只等 290ms = 纯 RTT，无阻塞）；`SELECT … FOR UPDATE` 第二笔在 `1765ms` 发起、直到持有方 `2507ms` **释放之后**的 `2703ms` 才拿到锁（等待 938ms）⇒ **`FOR UPDATE` 真的串行化**。（注：探针自带的 `serialized: waited_ms > 1000` 阈值写得太紧，938ms 被标成 false；判据应以「获得时刻晚于持有方释放时刻」为准 —— 该口径已满足。这是我方探针的阈值瑕疵，不是实现问题。）

### 5.2 真实死锁：两笔**反向加锁**事务（`QA_MODE=deadlock`）

命令：`QA_MODE=deadlock npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts`

原始输出：

```
{"case":"5-deadlock","note":"两笔事务故意反向加锁；握手指令保证「A 先持 910001、B 先持 910003」",
 "deadlocks_before":"0","deadlocks_after":"1",
 "A":{"label":"A: 先 910001 → 后 910003","outcome":"ok","attempts":2,
   "log":[{"attempt":1,"step":"begin","at_ms":1751},
          {"attempt":1,"step":"locked 910001","at_ms":1977},
          {"attempt":1,"step":"lock 910003 FAILED","at_ms":5095,"name":"error","code":"40P01",
           "message":"deadlock detected"},
          {"attempt":2,"step":"begin","at_ms":6105},
          {"attempt":2,"step":"locked 910001","at_ms":6856},
          {"attempt":2,"step":"locked 910003","at_ms":7228}],
   "result":{"attempt":2}},
 "B":{"label":"B: 先 910003 → 后 910001","outcome":"ok","attempts":1,
   "log":[{"attempt":1,"step":"begin","at_ms":3506},{"attempt":1,"step":"locked 910003","at_ms":3676},
          {"attempt":1,"step":"locked 910001","at_ms":5095}],"result":{"attempt":1}},
 "wall_ms":7749}
```

**读数（真实死锁取证）**：
- 事务 A 第 1 次尝试在 `5095ms` 收到 **原始 `code: "40P01"` / `message: "deadlock detected"`**；
- 数据库级 `pg_stat_database.deadlocks` 计数 **0 → 1**（硬证据，非自报）；
- **`db.ts` 的 R60 重试自动生效**：A 第 2 次尝试（`6105ms` 开始）成功，最终 `outcome: ok`，调用方**看不到**死锁（这正是期望行为）。

### 5.3 反向加锁复跑 20 轮（真实死锁的可复现性，`QA_MODE=rawreverse`）

命令：`QA_MODE=rawreverse npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts`

原始输出：

```
{"case":"5-rawreverse","what":"探针直接发逆序 FOR UPDATE × 20 轮（仅在 DB 层配对同一行）",
 "deadlocks_before":"1","deadlocks_after":"15","codes":{},"samples":[]}
```

**读数**：20 轮里数据库累计新增 **14 次真实死锁**（1→15），而 `codes: {}`（**没有任何错误冒到调用方**）⇒ 全部被重试吸收。**死锁可稳定复现、重试稳定兜住。**

### 5.4 重试次数 / 退避 / 耗尽后的错误码（`QA_MODE=exhaust`）

命令：`QA_MODE=exhaust npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts`

原始输出：

```
{"case":"5-exhaust","synthetic_code":"40P01","attempts":4,
 "attempt_start_offsets_ms":[1768,3392,4329,5998],"backoff_gaps_ms":[1624,937,1669],
 "backoff_expected_ms":[50,200,800],
 "final_error":{"name":"DbTxError","code":"LEDGER_DEADLOCK_RETRY_EXHAUSTED","pgCode":"40P01","status":null,
                "message":"死锁/序列化失败重试已耗尽"},
 "normalized_to_s14":{"code":"LEDGER_DEADLOCK_RETRY_EXHAUSTED","status":503,"message":"系统繁忙，请稍后重试"}}
```

**读数**：R60 落地为**共 4 次尝试**（首次 + 3 次重试），相邻尝试间隔 `1624/937/1669ms` = 期望退避 `50/200/800ms` + 单次事务 RTT（~0.9–1.6s）；耗尽后抛 `LEDGER_DEADLOCK_RETRY_EXHAUSTED`，经 §14 归一化后是 **`503`**（正确的「暂时不可用」语义，而非 500）。

### 5.5 ⚠️ 诚实报告：**无法用五个公开账本动作构造反向加锁**（`QA_MODE=apiorder`）

我按派单要求试过以下构造方法，全部**未能**通过公开动作触发 `40P01`：

| 尝试方法 | 原始读数 |
|---|---|
| 同一对账户的**反向** `transfer` 并发 × 20 轮 | `deadlocks_before":"1","deadlocks_after":"1"`（**0 次新增**）；`codes":{"LEDGER_LOCK_TIMEOUT":1}` |
| 同 uid / 同币种并发 `mint` × 10 轮 | 同上（0 次新增死锁） |

命令：`QA_MODE=apiorder npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts`

原始输出：

```
{"case":"5-apiorder","what":"公开动作并发（反向 transfer 20 轮 + 同 uid/同币种 mint 10 轮）",
 "deadlocks_before":"1","deadlocks_after":"1","codes":{"LEDGER_LOCK_TIMEOUT":1},
 "note":"公开动作内部固定按 uid 升序加锁（ledger.ts lockAccounts 排序 / mint 先锁 currency），因此无法制造逆序"}
```

**原因（代码级，非猜测）**：`ledger.ts` 里所有跨账户动作都走 `lockAccounts()`，而它**强制按 uid 升序排序后才逐个加锁**（`ledger.ts:518-526`）；`mint`/`burn` 类动作由 `lockCurrency()`（`ledger.ts:427-433`）**先锁 `currency` 行再动 `account`**（R83）。因此不存在「A 先持 X 后要 Y、B 先持 Y 后要 X」的路径 —— **这正是 R79/R83 全序设计要钉死的效果**。
**结论**：用例⑤的「人为制造反向加锁顺序」这一条，**通过公开动作不可构造 → 如实记为「未能构造」**；但「死锁重试生效」这一实质要求已由 §5.2/§5.3（真实 40P01 + 自动重试 + 计数 0→15）与 §5.4（重试次数/退避/耗尽错误码）**充分验证**。

### 5.6 真实 `mint()` 参与死锁：重试后仍**恰好一次入账**（`QA_MODE=hybrid`）

构造：伙伴事务**逆序**（先锁 `account(910002, 6)`，再要 `currency(6)`），与一笔**真实 `mint()`**（正序：先 `currency(6)` 再 `account(910002,6)`）对冲；§5.5 已证明公开动作自身不会逆序，故这里由探针扮演「错误顺序的调用方」来逼真实 API 撞死锁。

命令：`QA_MODE=hybrid npx ts-node --transpile-only scripts/qa-p1b-06-lock-deadlock.ts`

原始输出（节选）：

```
{"case":"5-hybrid","deadlocks_before":"15","deadlocks_after":"17",
 "supply_before":"21","supply_after":"24","expected_supply_delta":3,"actual_supply_delta":"3",
 "ledger_rows":[{"txid":"338","uid":"910002","delta":"1","idempotency_key":"ops:qa1b:c5:hybrid:1"},
                {"txid":"339","uid":"910002","delta":"1","idempotency_key":"ops:qa1b:c5:hybrid:2"},
                {"txid":"340","uid":"910002","delta":"1","idempotency_key":"ops:qa1b:c5:hybrid:3"}],
 "rounds":[{"round":1,"mint_result":{"ok":true,"replay":false,"txid":"338","supply_after":"22","ms":4541},
            "partner_attempts":1,
            "partner_log":[{"step":"locked account(910002,6)","at_ms":1368},{"step":"locked currency(6)","at_ms":3160}]},
           {"round":2,"mint_result":{"ok":true,"replay":false,"txid":"339","supply_after":"23","ms":6008}, ...},
           {"round":3,"mint_result":{"ok":true,"replay":false,"txid":"340","supply_after":"24","ms":6249}, ...}]}
```

**读数**：3 轮里数据库死锁计数 **15 → 17**（**真实死锁确实落在真实 `mint()` 调用路径上**：mint 被检测为牺牲者→`db.ts` 用**同一幂等键**重试→成功），而：
- `total_supply` 增益 = **+3**（不是 +5/+6）⇒ **重试没有双铸**；
- 该键流水**恰好 3 条**（每轮 1 条，无重复键）⇒ **重试没有双写分录**；
- 三轮 `mint_result.ok` 全为 true（调用方无感知，符合 R60 设计意图）。

这是 R60「重试必须复用同一幂等键，否则会双扣」在**真实公开 API** 上的正面取证。**用例⑤实质要求：PASS。**

---

## 6. 判负能力（对抗实验）——证明我的探针**能发现错**

- 目的（R89/R93）：**不能只报「全部通过」**；必须证明探针在人为注入偏差时会变红，且回滚后必须回绿、指纹回到基线。
- 探针：`backend-ts/scripts/qa-p1b-07-falsify.ts`
- 注入纪律：全部注入都在**事务内**完成并强制 `ROLLBACK`（抛哨兵）——因为 `ledger_entry` 是 append-only（`trg_ledger_entry_append_only` 拦 UPDATE/DELETE），提交即永久留痕。**未使用任何 `ALTER TABLE … DISABLE TRIGGER`**（R90 首选路线）。

命令：`cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-07-falsify.ts`

原始输出（逐条，含原始报错文本）：

```
INJ-1 | before_green True | inject_err None
     during {'drift': 1, 'pairing': 0, 'supply': 0} | caught True | after_green True
     drift_rows: [{"uid":"910001","cid":"4","balance":"999915","frozen":"0","sum_delta":"999916","sum_frozen_delta":"0"}]
INJ-2 | before_green True | inject_err P0001 | account(999916/0) != latest ledger snapshot(999915/0) for uid=910001 cid=4
     during {'drift': 0, 'pairing': 0, 'supply': 0} | caught False | after_green True
INJ-2b| before_green True | inject_err P0001 | account update without any ledger_entry (uid=910009, cid=4)
     during {'drift': 0, 'pairing': 0, 'supply': 0} | caught False | after_green True
INJ-3 | before_green True | inject_err None
     during {'drift': 1, 'pairing': 1, 'supply': 0} | caught True | after_green True
     drift_rows:   [{"uid":"910003","cid":"4","balance":"10","frozen":"0","sum_delta":"9","sum_frozen_delta":"0"}]
     pairing_rows: [{"ref_type":"system","ref_id":"991001","sum_delta":"-1","sum_frozen":"0","net":"-1",...}]
INJ-4 | before_green True | inject_err None
     during {'drift': 0, 'pairing': 0, 'supply': 1} | caught True | after_green True
INJ-5 | before_green True | inject_err P0001 | account(-1/0) != latest ledger snapshot(999915/0) for uid=910001 cid=4
     during {'drift': 0, 'pairing': 0, 'supply': 0} | caught False | after_green True
SUMMARY {"injections": 6, "caught": 3, "inject_errors": {"none": 3, "P0001": 3}}
FINAL   {"entry_count":"292","entry_max_txid":"340","drift_impl":0,"drift_qa":0,"pairing":0,"supply_mismatch":0}
```

| 注入用例 | 注入方式 | 事务内读数（必须红） | 回滚后 | 判定 |
|---|---|---|---|---|
| INJ-1 | 插**孤儿分录**（`delta=+1`，不更 `account`） | 账户级守恒判据命中 1 行：`balance=999915 ≠ Σdelta=999916` | 全绿 | **探针抓住（红）** |
| INJ-2 | 直接 `UPDATE account.balance + 1`（派单建议路线） | 注入即被 `trg_account_guard` 拒绝：`P0001 account(999916/0) != latest ledger snapshot(999915/0)` | 全绿 | **DB 守卫拦下**（无脏数据可注入） |
| INJ-2b | 对「无任何流水」的新账户 `UPDATE account` | 被拒：`P0001 account update without any ledger_entry (uid=910009, cid=4)` | 全绿 | **DB 守卫拦下** |
| INJ-3 | 插**单边分录**（带 `ref_type/ref_id`，无对手方） | 判据 1 命中 1 行 + 判据 8（事件配对）命中 1 组：`net=-1` | 全绿 | **探针抓住（双判据同时变红）** |
| INJ-4 | `UPDATE currency SET total_supply = total_supply + 1` | 判据 4（发行量）命中 1 行 | 全绿 | **探针抓住（红）** |
| INJ-5 | 把 `account.balance` 改成 `-1` | 被 `trg_account_guard` 拒绝（未到 CHECK） | 全绿 | **负余额不可能构造** |

**判负能力结论**：
1. **探针具备判负能力**：3 个可落地的注入（孤儿分录 / 单边分录 / 篡改 `total_supply`）**全部被我的守恒、漂移、事件配对、发行量判据当场判红**；回滚后 **6/6 全部回绿**，最终指纹与基线一致（`drift=0`、`pairing=0`、`supply_mismatch=0`、流水总数 292、max txid 340 —— **无任何残留**）。
2. **派单建议的 `UPDATE account` 注入路线在本库不可用**（`trg_account_guard` 两次都拒），我改用 R90 首选的「插孤儿分录」路线 —— 这一点如实记录，不是绕过。
3. 附带取证：**`account` 的写路径被 DB 层双保险钉死**（guard + CHECK），「改了余额但没落流水」在 DB 层就被拦；这与 R65/R74/R80 的口径一致。

---

## 7. 并发真实性论证（真的跑在独立事务上，不是同一连接串行）

- 目的：证明上述「并发用例」不是「同一连接上的串行调用」被误当并发。
- 证据一（真实账本并发期间的独立采样，`pg_stat_activity`）：见 §1.1/§2.1 的 `concurrency_evidence`：
  - 用例①池=32：`distinct_pids_observed=32`、`max_simultaneous_tx=32`、`max_simultaneous_lock_waiters=31`；
  - 用例②池=32：`distinct_pids_observed=32`、`max_simultaneous_tx=32`、`max_simultaneous_lock_waiters=31`；
  - 即：**同一瞬间有 32 个不同后端连接各自开着事务**，其中 31 个正卡在锁等待上 —— 串行执行不可能出现这种快照。
- 证据二（探针自报 pid/txid，含 pool=1 负例对照）：探针 `backend-ts/scripts/qa-p1b-08-txproof.ts`

命令与原始输出：

```
QA_N=40 SEAFOOD_TX_POOL_MAX=16 npx ts-node --transpile-only scripts/qa-p1b-08-txproof.ts
{"case":"7-txproof","config":{"N":40,"hold_ms":800,"pool_max":"16"},"wall_ms":6474,
 "metrics":{"requests":40,"succeeded_tx":40,"failed":0,"distinct_backend_pids":16,"distinct_txids":40,
            "max_simultaneous_overlapping_tx":40,"span_ms":6233},
 "sample_intervals":[{"i":0,"pid":11261,"xid":"2566","start_ms":0,"end_ms":2755},
                     {"i":1,"pid":11275,"xid":"2575","start_ms":1,"end_ms":2575},
                     {"i":2,"pid":11271,"xid":"2578","start_ms":2,"end_ms":2959},
                     {"i":3,"pid":11262,"xid":"2567","start_ms":2,"end_ms":2284}, ...],
 "concurrency_evidence":{"distinct_pids_observed":16,"max_simultaneous_tx":16},
 "verdict":{"is_genuinely_concurrent":true,"pool_of_one_would_be_serial":false}}

QA_N=40 SEAFOOD_TX_POOL_MAX=1 npx ts-node --transpile-only scripts/qa-p1b-08-txproof.ts   # 负例
{"case":"7-txproof","config":{"N":40,"pool_max":"1"},"wall_ms":12007,
 "metrics":{"requests":40,"succeeded_tx":6,"failed":34,
            "failure_samples":["ERR:timeout exceeded when trying to connect",...],
            "distinct_backend_pids":1,"distinct_txids":6,"max_simultaneous_overlapping_tx":40},
 "sample_intervals":[{"i":0,"pid":11312,"xid":"2605","start_ms":0,"end_ms":2309},
                     {"i":1,"pid":11312,"xid":"2606","start_ms":1,"end_ms":4018}, ...],
 "concurrency_evidence":{"distinct_pids_observed":1,"max_simultaneous_tx":1}}
```

**读数**：
- 池=16：**16 个不同 backend pid、40 个不同 txid**，且第 0–3 号请求（`pid 11261/11275/11271/11262`、`xid 2566/2575/2578/2567`）在 **0–2ms 内同时开始、区间相互重叠** ⇒ **真并发**；
- 池=1（负例）：**只有 1 个 backend pid**、`max_simultaneous_tx = 1`，40 个请求退化为**同一条连接上的串行执行**（其中 34 个连连接都拿不到，10s 超时）。
- **指标可判负**：同一探针在两种配置下给出 `16 vs 1` 的 pg_backend_pid / 同时事务数差异 ⇒ 该指标确实能区分「真并发」与「单连接串行」。
- 瑕疵自曝：`max_simultaneous_overlapping_tx` 用的是**请求发起时刻**（含排队期），在池=1 时仍显示 40（误导），故该字段不作为结论依据；结论只依据 `distinct_backend_pids` 与 `max_simultaneous_tx`（DB 侧快照）。

**§7 结论：并发用例确实运行在相互独立的并发事务上（32 个后端/32 个同时事务的现场快照 + 16 vs 1 的负例对照）。**

---

## 8. 未能构造 / 未能验证（诚实清单）

| # | 项目 | 状态 | 我试过什么 / 观察到什么 |
|---|---|---|---|
| 1 | 用**公开账本动作**构造反向加锁顺序以触发 `40P01`（R85⑤ 字面要求） | **未能构造** | 试了「同一对账户反向 `transfer` 并发 ×20 轮」与「同 uid/同币种并发 `mint` ×10 轮」：`deadlocks` 计数 **1→1（0 次新增）**，仅 1 次 `LEDGER_LOCK_TIMEOUT`。根因是 `lockAccounts()` 强制 uid 升序（`ledger.ts:518-526`）、`mint` 先锁 `currency`（`ledger.ts:427-433`）——**设计上就没有逆序路径**。已用探针直接发逆序语句（`rawreverse`，真实新增 14 次死锁）与「真实 `mint()` + 逆序伙伴」（`hybrid`，真实新增 2 次死锁）作为替代取证，但这两种构造**不是**「两笔公开动作之间的死锁」。 |
| 2 | 字面口径「100 并发**全部成功**」的用例 ①③（以及 ② 全部返回 `idempotent_replay`） | **未能达成** | 环境事实：单笔 `transfer` 4.2–5.6s vs `lock_timeout = 3s`（§0.3）；实测 100 并发成功 5–7 笔，其余为锁超时/池连接超时。**安全断言（守恒/无负余额/不超发/只生效一次）全部成立**，失败均在失败侧回滚，未污染账务。此条需口径裁定（见 §8.1），不是「验证通过」也不是「实现缺陷」。 |
| 3 | 用 `UPDATE account` 直接注入脏余额（派单建议路线） | **未能构造** | 被 `trg_account_guard` 拒绝两次（`P0001`，原始报错见 §6）；改用 R90 首选的「插孤儿分录」路线完成判负实验。 |
| 4 | `freeze` / `unfreeze` / `settleFrozen` 的并发用例 | **本轮未覆盖** | R85 五条并发用例未要求这三条路径；且它们需要业务单（`ref_type/ref_id`）配合，属 P3/P4 兑换场景。**不构成本轮结论**，建议 P1b 补测冻结族（尤其 `frozen` 并发扣减与 `-3` 罚没账户的跨账户顺序）。 |
| 5 | 平台保留账户（`0/-1/-2/-3`）的写路径白名单（R101/R103/R38 冲突） | **未验证（派单范围外，且只读纪律）** | 我只读取了平台账户（余额全为 0，见 §9），**未执行任何写**。Zang 已裁定 R101/R38 口径，本轮不重复质检。 |
| 6 | `burn` / `reversal` 的并发行为 | **未验证** | `ledger.ts` 文件头明示 P1a 未实现这两个服务函数（只读白名单已就绪），无可并发调用点。 |
| 7 | 探针自身瑕疵（如实披露） | — | ① `04-negative.ts` 的 `rounds` 模式**不可重入**（账户余额/币种 cap 会被前一次运行消耗），导致复跑时前 2 轮出现 `succ=0`；② `06` 的 `locksem` 阈值 `waited_ms>1000` 过紧（实测 938ms，被标 false）；③ `08` 的 `max_simultaneous_overlapping_tx` 计入排队时间，池=1 时失真。以上均为**质检方探针**缺陷，已在本报告内改用原始读数解释，未影响任何结论方向。 |
| 8 | 服务/进程纪律 | **无事故** | 全程未使用 `pkill -f` / `killall`；未停/重启面板托管服务；收尾时 `GET http://127.0.0.1:5555/api/status` = **16/16 running & portOpen**；`lsof -nP -iTCP:5788` 仍为面板托管的那个 node（PID 65578 ← 父 65564 `seafood-api`）；我自己启动的 `ts-node` 探针全部自行退出（`ps` 已确认无残留）。 |

### 8.1 需要 Zang/Kevin 裁定的两条（**本轮最重要的可执行结论**）

1. **`lock_timeout = 3s` 与真实单事务时延（4.2–5.6s）结构性不匹配**：`src/db.ts:85-89` 的默认值（R82 建议）在本 Neon 端点（RTT ≈ 190–290ms）下等价于「同一行最多 1–2 个并发写者」。**R85①③ 的 100 并发同账户口径在默认配置下不可能达成**。可选处置：① 放宽 `lock_timeout`（例如 30s）并为过载单独限流；② 把 AC 口径改为「小并发 + 守恒断言」；③ 把热点账户的并发改为排队模型（应用层串行队列）。**在裁定前，P1 AC 的 ①③「100 笔全部成功」不应判为实现方缺陷。**
2. **连接池过载错误码被吞成 500（`LEDGER_TRANSACTION_REQUIRED`）** —— 落在 P1a 交付物 `src/ledger-errors.ts` 上的实现级缺陷（证据见 §2.4）：真实原因 `timeout exceeded when trying to connect`（WS 池 `max` 默认 4 + `connectionTimeoutMillis: 10s`）被 `normalizeLedgerError` 的 `default` 分支改写为 `LEDGER_TRANSACTION_REQUIRED`（`status 500`，文案「服务暂不可用，请稍后重试」），并只保留 `details.cause='non_pg_error'`。后果：**过载（应 503）被报成实现缺陷（500），R108 的「500 必须告警」规则被污染，线上排查无法区分**。建议：为连接获取超时新增/复用 503 类码（如 `LEDGER_LOCK_TIMEOUT` 或新码），或在 `normalizeLedgerError` 中对无 `code` 的驱动级错误单独归类；`details` 至少带上 `reason` 而非 `cause='non_pg_error'`。

---

## 9. 测试数据清单（uid / symbol / 条数）——供后续清理

- 生成命令：`cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-12-inventory.ts`（只读）
- **纪律核对**：全部测试账户 uid ∈ `91xxxx`（≥ 900000）；全部自建币 `symbol` 以 `qa1b` 开头；**未碰** uid < 900000 的既有账户（前后读数见下）。

### 9.1 新建币种（6 个，`cid` 4–9）

| cid | symbol | owner_uid | total_supply | supply_cap | status |
|---|---|---|---|---|---|
| 4 | `qa1bGLD` | 910001 | 1000003 | NULL | listed |
| 5 | `qa1bCAP` | 910002 | 1 | 1 | listed |
| 6 | `qa1bDLK` | 910002 | 24 | 1000 | listed |
| 7 | `qa1bCP1` | 910002 | 1 | 1 | listed |
| 8 | `qa1bCP2` | 910002 | 1 | 1 | listed |
| 9 | `qa1bCP3` | 910002 | 1 | 1 | listed |

### 9.2 新建账户（22 行）

`(uid, cid) = (910001,4) (910002,5) (910002,6) (910002,7) (910002,8) (910002,9) (910003,4) (910004,4) (910005,4) (910006,4) (910010,4) (910011,4) (910020,4) (910021,4) (910022,4) (910023,4) (910024,4) (910030,4) (910031,4) (910032,4) (910033,4) (910034,4)`

余额（终态，供核对）：`910001/4=999915`、`910002/5=1`、`910002/6=24`、`910002/7=1`、`910002/8=1`、`910002/9=1`、`910003/4=10`、`910004/4=8`、`910005/4=9`、`910006/4=6`、`910010/4=43`、`910011/4=7`、`910020..910024/4=0`、`910030..910034/4=1`（全部 `frozen=0`）。

### 9.3 新建流水分录（**202 条，`txid` 116–340**）

| kind | 条数 | Σdelta | Σfrozen_delta |
|---|---|---|---|
| `mint` | 32 | 1000031 | 0 |
| `transfer` | 170 | 0 | 0 |
| **合计** | **202** | — | — |

- 键族（可用 `idempotency_key LIKE 'ops:qa1b:%'` 一次定位）：`ops:qa1b:seed:mint:gld`、`ops:qa1b:seed:mint:dlk`、`ops:qa1b:seed:t3:*`、`ops:qa1b:lat:*`、`ops:qa1b:c1:*`、`ops:qa1b:c2:*`、`ops:qa1b:c3:*`、`ops:qa1b:c4:*`、`ops:qa1b:c5:*`、`ops:qa1b:c10:*`（含 `#2` 派生键）。
- **不可清理说明**：`ledger_entry` 是 append-only（表级触发器拒绝 UPDATE/DELETE），因此以上 202 条流水**无法删除**；`account` 行同样不可删除（`trg_account_guard` 拒 DELETE）；`currency` 行因被 `account`/`ledger_entry` 外键引用也不宜删除。**清理动作只能由 Zang/Kevin 决策（例如整库重置或保留为 P1 验收档案）**——本清单即为其决策依据。

### 9.4 我**没有**动过的既有数据（前后对照取证）

| 对象 | 开工前读数（§0.2） | 收工后读数（§9 探针） | 是否变化 |
|---|---|---|---|
| `account` 总行数 | 9 | 9 + 22（新增）= 31 | 仅新增 |
| `ledger_entry` 总行数 | 90 | 292 | 仅新增 202 |
| `(0,1) (-1,1) (-2,1) (-3,1)` | 全部 `0/0` | 全部 `0/0` | **未变** |
| `(900001,1)` | 3353 | 3353 | **未变** |
| `(900001,2) (900001,3)` | 40000 / 40000 | 40000 / 40000 | **未变** |
| `(900002,1) (900003,1)` | 1750 / 497 | 1750 / 497 | **未变** |
| 非 qa1b 币种流水（cid 1/2/3） | 90 条（`$`=88、cid2=1、cid3=1） | 同 90 条（88+1+1，本次未新增） | **未变** |
| 全库漂移 / 事件配对 / 发行量判据 | 0 / 0 / 0 | 0 / 0 / 0 | **未变** |

> 注：`cid 2`/`cid 3` 各 1 条流水是**实现方自测（smoke）留下的历史数据**，不是本次质检产生；本次质检新增的 202 条已在上表单独列明。

---

## 10. 总结（一览）

| 用例 | 断言（安全侧） | 结论 | 备注 |
|---|---|---|---|
| ① 100 并发转账总额守恒 | 守恒 ✓、漂移 0 ✓、账户级不变式 ✓、无负余额 ✓ | **PASS（安全侧）** | 100 并发仅 5–7 笔成功（锁/池过载），字面「100 笔全成功」不可达 → §8.1-1 |
| ② 同键 100 并发只生效一次 | 恰好 1 次业务事件 ✓、只扣一次 ✓、txid 唯一 ✓、重放语义 ✓ | **PASS** | 3 并发时 1 首次 + 2 重放、0 失败（R52 理想形态复现） |
| ③ 并发不产生负余额 | 余额 ≥ 0 ✓、业务码 409 ✓、成功数==扣减数 ✓、漂移 0 ✓ | **PASS（安全侧）** | 7 个回合「余额恰好=请求数」皆为 1 成功 + 1 业务码 |
| ④ 并发 mint 不超 supply_cap | 未超发 ✓、`total_supply`==成功笔数 ✓、业务码 409 ✓ | **PASS** | `cap=1` 下 100 并发恰好 1 次成功 |
| ⑤ 死锁重试 | 真实 `40P01` 可复现（计数 0→15）✓、重试后成功 ✓、重试不双铸/双扣 ✓、耗尽=503 ✓ | **PASS（重试机制）** / **未能构造（公开动作逆序）** | 逆序构造不可行本身是 R79/R83 生效的证据；如实单列 |
| ⑥ 判负能力 | 3 个可落地注入**全部判红** ✓、回滚后全绿 ✓、无残留 ✓ | **PASS** | `UPDATE account` 注入被 DB 守卫拦（原始 P0001 已贴） |
| ⑦ 并发真实性 | 32 个后端/32 个同时事务现场快照 ✓、16 vs 1 负例对照 ✓ | **PASS** | — |
| 交付缺陷 | 池过载被吞成 `500 LEDGER_TRANSACTION_REQUIRED` | **1 条中危缺陷**（`ledger-errors.ts`） | 详见 §2.4 / §8.1-2 |

**质检结论**：P1a 账本内核在**并发安全语义上全部成立**（守恒、无负余额、幂等唯一、不超发、死锁可重试且不双记）；**未发现任何账务数据损坏**。两条需要处置的问题是**参数/口径匹配**（`lock_timeout` 3s vs 单事务 4–5s）与**一条错误码失真缺陷**（池过载 → 500），均已在 §8 给出证据与建议。


