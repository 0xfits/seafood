# P3 套件口径修正（Unit F / P3-SUITE-CALIBER-FIX · 角色 Kong）

> **交付状态**：本文件按「先落盘骸架、逐段回填」交付。截至本行落盘时，**§0–§5 为骸架**，带 `（回填）` 的段落尚未取得读数。
> **未实测字段一律写 `NOT_MEASURED` / `null`，禁 0 / 空数组占位。** 交付人：Kong（实现）。裁定人：Zang。
> **依据（先读后写，不自行发明）**：`docs/audit/p3-baseline-rca.md`（= `docs/seafood.master-plan.md` §5.56）§1.1 五条 reds 的逐条定案 + §1.2 + §2 + §3 + §4；`docs/seafood.master-plan.md` §5.58 / §5.59。

## §0 元信息与口径

- 仓库/分支/HEAD：`/Users/kevin/bistro/seafood` · `main` · HEAD=`ade33769c101a0c89fb61902ddef944034e5c89e`（**未** `git add/commit/push`；工作区既有改动 `backend-ts/src/ledger-errors.ts`、`docs/seafood.master-plan.md` 非本单所为，未触碰）。
- 数据库：Neon PG 18.6；驱动 `@neondatabase/serverless` 0.6.1 + `ws`（**未装 `pg`**）；跨 schema 陷阱：库内另有 `neon_auth.account` ⇒ 本单所有 SQL **显式限定 `public.`**。
- 库侧现状（本单跑前实测，`p3u-00-counts-before-suite-*.json`）：`users 583 / account 387 / ledger_entry 3201 / referral 293 / currency 123 / commission_policy 25`；触发器 43（非 `O` **0**）；`cid=1` `total_supply 8400 == Σ(balance+frozen) 8400`；`schema_version 0017`。
- 套件运行命令（逐字，退出码**不取自管道之后**）：
  - A：`cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert [--mutate i|ii|iii]`
  - B：`cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p2w-00-p2fix-verify.ts --assert`
  - 计数：`… scripts/p3u-00-counts.ts --label before-suite|after-suite`
- 本单新增探针命名空间：uid 窗口 **9913xx**、幂等键前缀 **`cli:kong22-`**（`p3u-00` 为**只读**探针，只**读**该窗口占用态；**未**复用 `9903–9906`/`9908xx`–`9912xx`/`p3p:`/`p3q:`/`p3r`/`p3s`/`p3t`/`neng1x:`/`kong2[01]-`）。两套**既有**套件沿用其**内建**命名空间（p1o-00 = uid `948xxx`/symbol `p1p*`/键 `ops:p1p:*`；p2w-00 = `ns-alloc` 每跑新分配，本跑实测 `uid_base 959301`/`symbol p1yu5073s…`/`job_tag 610762257`/键 `ops:p1y:*`）—— **未改**其分区（改分区会改套件语义）。**本单在 9913xx/`cli:kong22-` 上零写入**（`my_namespace` 读数全 0 除外，见 §4）。
- 耗时实测（口径登记）：`p1o-00` 单跑 ≈ **5 分 48 秒**（`MULFRRL5`：`started 16:02:39Z → finished 16:08:27Z`）⇒ 单跑**超过**前台限时，故三段变异 + 恢复 + B 套件以**同一条后台脚本**串/并执行（脚本内逐条 `echo EXIT=$?`，**无**管道取码）。
- run tag / artifact：见 §6 清单（全部 run-tagged、**同名拒写**、不覆盖既有取证）。
- 写边界自查（**逐字对照任务硬边界**）：只写 `backend-ts/scripts/p1o-00-escape-sweep.ts`、`backend-ts/scripts/p2w-00-p2fix-verify.ts`、`backend-ts/scripts/p3u-00-counts.ts`、`backend-ts/.p3u-artifacts/**`、本文件、两套件自产的新 run-tagged artifact（已登记）；**未**碰 `src/**`、`migrations/**`、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、`docs/seafood.master-plan.md`、`docs/audit/p3-*.md`、任何**既有** artifact、`scripts/p3[qrt]-*.ts`；**无** `git add/commit/push`、**无** DDL/`DELETE/TRUNCATE/DROP`（套件**内部**在回滚事务里执行 `DISABLE TRIGGER` 属既有取证手段，末尾一律 `ROLLBACK`、零残留）、**无** `pkill -f`/`killall`（**只按精确 PID**，本单未 kill 任何进程）、**无**长驻 server、**无** `execute_code`、**无** `npm install`。

## §1 定案映射（B 单五条 reds ⇒ 落码动作）

| red | 定案（`p3-baseline-rca.md`） | 依据行号 | 本单落码 |
|---|---|---|---|
| D4 | (c) 探针口径错：判据落在闸**不可裁决**的落点 | `0011:111–142` 判负 / `0011:128–133` 未闭合豁免 / `p2w-00:455,464` 只 `DEFERRED` 不 flush | **加显式裁决点**：`d3` 腿改为 `SET CONSTRAINTS ALL DEFERRED` + 事后 `SET CONSTRAINTS ALL IMMEDIATE`（提交点等价），判据改落在 `flush_after_post`；**不再**把「post 无错」判红 |
| D5 | (c) 同上 | 同上 | 同 D4（`d4` 腿）；另加两路灵敏度自证 `D4s`（合法事件不报）/ `D5s`（摘掉该闸后同形篡改不再报） |
| D7 | (c) 且与同套件 D6 自相矛盾 | `p2w-00:474`（IMMEDIATE 钉在 badPost **之前**）/ `p2w-00:483–491`（D6 登记不判）/ `0011:96–99,128–133` | **与 D6 同口径 = 登记不判**：删去 `judge('D7 …')`，改 `rec('D7_immediate_escape_registered_not_judged', {judged:false, refs:[…]})`；两路中取登记的理由 = 该模式下**不存在闭合后的裁决点**（实测 flush 仍 `ok=true`） |
| E4 | (c) 输入错：`depth=0` 先撞 CHECK | `0011:252`（`NEW.depth := 1+COALESCE(…,0)` 在被摘的触发器内）/ `0007:60` `CHECK (depth>=1)` | **期望改为可对照形态**（字面 `depth=1` ⇒ 重绑 `23505/referral_pk`）并**保留两路读数**（原杆 `depth=0` ⇒ `23514/referral_depth_rng` 作登记性断言 `E4b`） |
| F3 | (c) 且**期望本身不可达**（对照手段 = 所测机制） | 同 E4 | **显式标为不可达**（`rec` 带 `unreachable:true`/`judged:false`，无 `judge`）+ 改为**手写等价继承式**的可达对照 `F3b`（父 50 ⇒ 子 51 可写入） |

## §2 A 修：`p1o-00` 加「既有 transient 档」

**改法（`backend-ts/scripts/p1o-00-escape-sweep.ts`，4 处 + 1 个夹具开关）**
1. **严格档判据**（唯一的不判负豁免，逐字对齐 `src/ledger-errors.ts:401 TRANSIENT_NON_PG_REASONS` + `LEDGER_TX_TIMEOUT` 的 503 通路）：
   `isExistingTransientInfra(r) := r.thrown ∧ code==='LEDGER_TX_TIMEOUT' ∧ status===503 ∧ reason∈{pool_connection_timeout, driver_connection_error}`。
2. **新单列**：`aggregates.env_jitter`（计数）+ `out.env_jitter_cells`（cells 级明细，字段与 `mismatch_cells` 同形）；`mismatch_cells` / `expectation_mismatches` 取**已剔除抖动**的口径，另加留痕字段 `expectation_mismatches_raw`（未剔除时的原始数）。
3. **新增 verdict**：`env_jitter_separately_counted := 被移出的格**全部**满足严格档 ∧ 非抖动格**无一**满足`。
4. **判负自证夹具开关**：`--mutate i|ii|iii|iv`（不注入 ⇒ 分支全不生效）；注入未落到目标格 ⇒ `failures` 追加 `mutation_injection_not_applied` 判红（防空转）。
5. **五项既有 verdict 语义未动**（逐字保留原判据）；本修**未**新增任何错误码、未动 SQL 语义。

**修前读数（现红，既有 artifact `.p1f-artifacts/p1o-00-escape-sweep-after-MULF8X80.json`，转引、非本单重跑）**
`aggregates.expectation_mismatches 1` / `env_jitter`（该字段当时不存在）/ `verdicts.all_cells_match_expectation false`，
红格 = `E-W4_unfreeze / amount / over_bigint_far`：`code LEDGER_TX_TIMEOUT`、`status 503`、`reason driver_connection_error`、`expected must_400/LEDGER_AMOUNT_INVALID/OUT_OF_BIGINT_RANGE|OVER_MAX_SINGLE_AMOUNT`
⇒ 与任务描述逐字一致（**同一抖动被记为 `expectation_mismatch`**；同 artifact 五项既定判据全 true、`unexpected_500 0`）。

**修后读数（run-tagged，全部本单实跑，退出码**未**取自管道之后）**

| # | 跑 | run tag | 命令 | EXIT | `env_jitter` | `expectation_mismatches`(raw) | `unexpected_500` | 五项判据 + 新档 | failures |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 修后基线 | `MULFRRL5` | `--phase after --assert` | `NOT_MEASURED`（shell 被 420s 前台上限中断，未取到码；读数为绿） | **0** | 0 (0) | 0 | 全 true / true | `[]` |
| 2 | **绿·恢复** | `MULG83F0` | 同上（三段变异之后） | **0** | **0** | 0 (0) | 0 | 全 true / true | `[]` |
| 3 | 变异 (i) | `MULG1Z0Y` | `--mutate i` | **1** | 0 | **1** (1) | 0 | `all_cells_match_expectation false`；余 true | `["all_cells_match_expectation"]` |
| 4 | 变异 (ii) | `MULG1Z0H` | `--mutate ii` | **1** | 0 | **1** (1) | **1** | `no_unexpected_500_from_caller_input false` + `all_cells_match_expectation false` | `["no_unexpected_500_from_caller_input","all_cells_match_expectation"]` |
| 5 | 变异 (iii) | `MULG1Z0V` | `--mutate iii` | **1** | 0 | **1** (1) | 0 | `all_cells_match_expectation false`；余 true | `["all_cells_match_expectation"]` |
| 6 | **新档正向** | `MULGHW3E` | `--mutate iv` | **0** | **1** | **0** (1) | 0 | 全 true / true | `[]` |

**三条变异判负结论（逐个证明「仍红」，逐段 run-tagged）**
- **(i) 期望改为 409 而实现给 400**（`MULG1Z0Y`）：`mutation.applied=true`，`effect={expected_status:409, observed:"LEDGER_AMOUNT_INVALID/400"}`；红格 `E-W1_transfer/cid/not_decimal_integer` 的 `expected` 变为 `must_400/…（status 409）`，实测 400 ⇒ `expectation_mismatches 1`、`EXIT=1`。**⇒ 状态类不符仍判负，未进 `env_jitter`。**
- **(ii) 注入非 transient 的 500**（`MULG1Z0H`）：注入 `{code LEDGER_TX_TIMEOUT, status 500, reason unclassified_non_pg_error}`（既有码 + **非** transient reason）⇒ `unexpected_500 1` ∧ `no_unexpected_500_from_caller_input false` ∧ `expectation_mismatches 1`、`env_jitter 0`、`EXIT=1`。**⇒ 5xx 判据不变（仍必须 0），且非 transient 的 5xx **不**被新档吞走。**
- **(iii) 期望 400 的 B 码、实现给 A 码**（`MULG1Z0V`）：期望 `LEDGER_AMOUNT_NOT_POSITIVE`（同 status 400、同 reason 集），实测 `LEDGER_AMOUNT_INVALID` ⇒ `expectation_mismatches 1`、`env_jitter 0`、`EXIT=1`。**⇒ 同类不同码仍判负。**
- **红→绿→恢复**：`MULG1Z0Y/1Z0H/1Z0V`（红，`EXIT=1`）→ `MULFRRL5`（绿）→ `MULG83F0`（**恢复跑，`EXIT=0`、全 verdict true**）。
- **新档的正向接收（补做）**（`MULGHW3E`，`EXIT=0`）：注入与 `MULF8X80` 那次真实抖动**同形**的观测（`LEDGER_TX_TIMEOUT/503/driver_connection_error`）⇒ **`env_jitter 1`**、`expectation_mismatches 0`（`raw 1`）、`mismatch_cells []`、`env_jitter_cells[0]` 明细在案、整跑**绿**。⇒ 新档「接得住且不掩盖五行既定判据」，与修前把同一形态记为 red 形成**同形对照**。
- **诚实边界**：本单 5 次跑（含基线/恢复）**真环境抖动均未复现**（`env_jitter 0`）⇒「真实抖动被新档接住」的**实测样本 = `NOT_MEASURED`**；上面 (6) 是**夹具注入**同形观测得到的档位验证（与 (ii) 成对，一个必须绿、一个必须红）。

## §3 B 修：`p2w-00` 五红逐条落码

**修前读数（现红，既有 artifact `.p2w-artifacts/p2w-00-verify-20260928T140357Zumiq.json`，转引、非本单重跑）**：`reds_count 5` = D4/D5/D7/E4/F3（原文见 §3 表「修前」列）。

| red | 修前读数（现红，原 artifact 逐字） | 修后读数（`20260928T162825Zn3c5`，run-tagged） | 判负自证（仍对真缺陷敏感） |
|---|---|---|---|
| **D4** | `d3_tamper_drop_pair {entries:22, ok:true, err:null}` ⇒ 旧判据（`posted.ok===false ∧ sqlstate LD032`）判红 | `{entries:22, ok:true, err:null, flush_after_post:{ok:false, err:{sqlstate:'LD032', reason:'COMMISSION_SPLIT_SUM_MISMATCH', pool_in '1000', commission_out '990', commission_rows 9, event_closed 'true'}}}` ⇒ 判据改落在裁决点，**绿** | `d_ctrl_legal_flush`（合法事件同一裁决点）= `{ok:true, flush_ok:true, flush_err:null}` ⇒ 闸**不是**「一律报」；若把裁决点去掉/挪错，抖动格重读 `ok=true` ⇒ 判据立刻红 |
| **D5** | `d4_pool_in_no_out {entries:4, ok:true, err:null}` ⇒ 判红 | `{entries:4, ok:true, flush_after_post:{ok:false, err:{sqlstate:'LD032', reason:'COMMISSION_SPLIT_SUM_MISMATCH', pool_in '1000', commission_out '0', commission_rows 0}}}` ⇒ **绿** | `d_gate_off_control`：**先摘闸再说**（见下「自证修正」）⇒ `{disable_ok:true, ok:true, flush_ok:true, flush_err:null}` = 摘掉该闸后同形篡改**不再报** ⇒ 上面 LD032 确出自这道闸（判据测的就是它） |
| **D7** | `d5_post_then_immediate {okPost_ok:true, badPost:{ok:true,err:null}, after_immediate2:{ok:true,err:null}}` + 旧 `judge('D7 非法事件仍报 LD032')` ⇒ 判红 | **登记不判**：`rec('D7_immediate_escape_registered_not_judged', {…, judged:false, refs:['0011:96–99','0011:112–133','p2w-00:483–491（D6 登记不判）','rca §1.2']})`；读数与修前**逐字相同**（现象未变） | 两路中取登记的**理由**：该模式下**不存在「事件闭合之后」的裁决点** —— `after_immediate2.ok=true` 实测（闸只挂 `ledger_entry` INSERT，账户写回=闭合在其后且不触发复核），故「独立裁决点」不可得；与同套件 D6（L483–491 逐字已写「边界登记（不判）」）**同口径**，并已由 `0011` 文件头 + rca §1.2 登记为设计边界（生产不可达：`src/**` 内 `SET CONSTRAINTS` 命中 0） |
| **E4** | `E_f6_pre_fix_control {tx_error:'new row for relation "referral" violates check constraint "referral_depth_rng"'}`，`result.err=null` ⇒ 判红 | **两路读数都保留**：`depth0_first {ok:false, err:{sqlstate:'23514', constraint:'referral_depth_rng'}}`（原杆）+ `depth1_first {ok:true}` → `depth1_rebind {ok:false, err:{sqlstate:'23505', constraint:'referral_pk'}}`（**可对照杆 = 修前形态**）⇒ 判据落在 (b)，**绿** | 判负灵敏度：守卫**开**时同形重绑 = `LD003/REFERRAL_ALREADY_BOUND`（E1/E2/E3 判据，本跑仍绿）；守卫**关**时 ⇒ `23505/referral_pk`。同一探针、两种守卫态两读数 ⇒ 判据对「守卫在不在」敏感。原杆 `23514` 作 `E4b` 登记性断言（**不据原杆判负**） |
| **F3** | `F_f2_pre_fix_control {tx_error:'…referral_depth_rng'}`，`result.inherited_depth=null` ⇒ 判红（期望「50⇒51」不可达） | **显式标为不可达**：`rec('F_f2_pre_fix_control', {…, judged:false, unreachable:true, why:'「继承」= 0011:252（就在被摘的触发器内）…', refs:['0011:252','0007:60','0007:274']})`，**无** `judge`；另 `rec('F3_original_expectation_unreachable_evidence', {sqlstate:'23514', constraint:'referral_depth_rng'})` | 取代它的**可达对照** `F3b`（判据）：`manual_equivalent_insert {ok:true}` + `manual_depth '51'` ⇒ 「父 50 ⇒ 子 51」的**数值形态**在摘杆后可写入（**手写等价继承式，非原机制**，故不冒充对 `0011:252` 的验证）。旁证：守卫开时父 depth 陈旧 ⇒ 拒（`LD016/REFERRAL_PARENT_DEPTH_INCONSISTENT`，F1 本跑仍绿） |

**自证过程中的一次「读数异常先怀疑自己的探针」（诚实登记，含修前/修后两次读数）**
- 第 1 次修后跑（`20260928T161940Zzkdd`）：`reds_count 1`，唯一红 = 我新加的 **D5s 闸侧控制**，`disable_err {sqlstate:'55006', message:'cannot ALTER TABLE "ledger_entry" because it has pending trigger events'}` —— 根因是**我的控制杆顺序错**（先 `f3Setup` 造夹具 ⇒ mint/hold 已排入延迟触发器事件 ⇒ PG 拒 DDL），**不是**实现缺陷、也**不是**闸的问题（同一跑 `d3/d4` 裁决点读数已正确 `LD032`）。
- 修正：该腿改为**先 `DISABLE TRIGGER`、后造夹具**（脚本内已写「顺序铁律」注释）；第 2 次跑（`20260928T162825Zn3c5`）⇒ `disable_ok:true` ∧ `flush_ok:true` ⇒ **`--assert` 退出码 `0`、`reds_count 0`**。
- **两跑读数都在**，未删未覆盖（`save()` 带 run tag；`.p2w-artifacts` 既有文件未被写入）。

**B 套件最终读数（`20260928T162825Zn3c5`，`EXIT=0`）**：`reds_count 0`；`trigger_enablement_after {total:43, enabled:43, anomalies:[]}`；`graph_invariants_after {cycles 0, bad_depth 0}`；`cid=1` 平台账户前后一致；夹具 `mint/hold×2` 全 `ok:true`；残留限定本跑窗口（`my_window_users 45 / referral 28 / currency 1 / key 5 / job 14`，`poison_uids_in_graph 0`）。本跑命名空间 = `uid_base 959001` / `symbol p1y3cvwr1` / `job_tag 367669994`。

## §4 真库行增量登记

**口径**：`public.<表>` 行数 + `cid=1` 守恒（`currency.total_supply` vs `Σ(balance+frozen)`）+ 触发器启用态；由 `scripts/p3u-00-counts.ts`（**只读**）在同一会话取。

| 时刻（UTC） | 事件 | users | account | ledger_entry | referral | currency | commission_policy | cid=1 | 触发器 非`O` |
|---|---|---|---|---|---|---|---|---|---|
| 16:02–16:08 | `p1o-00` 修后基线 `MULFRRL5`（自产币+账户） | — | — | — | — | — | — | — | — |
| **16:10** | `before-suite`（本单任何跑之前） | **583** | **387** | **3201** | **293** | **123** | **25** | `8400 == 8400` ✓ | 0/43 |
| 16:10:35–16:15:20 | `p1o-00` 变异 i/ii/iii（3 跑**并发**；每跑自产币+账户；`wrote_no_ledger_rows true`） | — | — | — | — | — | — | — | — |
| 16:15:21–16:19:39 | `p1o-00` 恢复跑 `MULG83F0`（同上） | — | — | — | — | — | — | — | — |
| 16:19:40–16:21:43 | `p2w-00` 修后第 1 跑 `zkdd`（**真落账**夹具：45 users + 币 + referral 链 + 账本行） | — | — | — | — | — | — | — | — |
| **16:21:43** | `after-suite` | **628** | **414** | **3220** | **321** | **130** | **25** | `8400 == 8400` ✓ | 0/43 |
| **区间净增量** | （4 次 `p1o` + 1 次 `p2w`） | **+45** | **+27** | **+19** | **+28** | **+7** | **0** | **未破** | 不变 |
| 16:22:58–16:27:55 | `p1o-00` 新档正向跑 `MULGHW3E`（`--mutate iv`） | **`NOT_MEASURED`** | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_MEASURED` | （该跑自报 `ledger_entry 3220→3220`、`wrote_no_ledger_rows true`） | — |
| 16:28:25 | `p2w-00` 修后第 2 跑 `n3c5`（`EXIT=0`） | **`NOT_MEASURED`** | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_MEASURED` | `NOT_MEASURED` | — | — |

- **未测项的替代证据（不填 0）**：最后两跑（`MULGHW3E` / `n3c5`）发生在最后一次计数**之后**，本单未再取计数 ⇒ 标 `NOT_MEASURED`；`n3c5` 自报窗口残留 `45 users / 28 referral / 1 currency / 5 键行 / 14 job 行`（= 该跑夹具规模，供 Zang 复核时包络）。
- **本单探针命名空间零写入**：`9913xx` 窗口 `users/account/referral = 0`、`cli:kong22-%` 键下 `ledger_entry = 0`（`after-suite` artifact `my_namespace`）。
- **归因**：增量全部来自**两套既有套件的内建命名空间**（`p1o-00`：uid `948xxx` + 每跑 1 币 + ~4 个 0/0 账户；`p2w-00`：`ns-alloc` 新窗口 45 users + 币 + referral 链 + 真落账）。二者皆为**既有行为**（本单未改其夹具），非本单新增写路径；`cid=1` 守恒两时点均未破，触发器 43/43 全启用。
- **零删除**声明：本单**未**执行任何 `DELETE/TRUNCATE/DROP`（也无从删：`ledger_entry`/`referral` 均 append-only，`account` 受 `trg_account_guard`）。

## §5 §5.7 硬口径遵守 + 未验证清单

| # | 硬口径 | 遵守情况（带证据） |
|---|---|---|
| ① | 保留字对象断言加引号 | 本单 SQL 全部显式限定 `public.`（含 `public.users`、`public.ledger_entry`、`public.referral`）；未对保留字命名对象做无引号断言 |
| ② | 退出码不得取自管道之后 | 全部用 `cmd > out 2> err; echo "EXIT=$?"`（后台链内亦逐条 `echo … EXIT=$?`）；**无** `\| tail` 后取码 |
| ③ | 本机无 `timeout`/`gtimeout` | 未使用任何限时命令；改用「后台 + 独立取码文件」（`/tmp/p1o_kong22_exits.txt`、`/tmp/p1o_kong22_mutiv_exit.txt`） |
| ④ | 含上述形态的读数作废重跑 | 第 1 次 `p2w-00` 修后跑（`zkdd`）因**控制杆自身未执行**（`55006`）判受污染 ⇒ **重跑**（`n3c5`）并两读数并列登记（§3）；`p1o` 基线 `MULFRRL5` 的**退出码**因前台 420s 上限中断而 `NOT_MEASURED`（读数为绿，且随后 `MULG83F0` 以 `EXIT=0` 复现） |
| ⑤ | 先落盘骸架再回填 | 本文件首次 `write_file` 落 **§0–§6 七节骨架（含 `（回填）` 占位）**，随后 5 次 `patch` 逐段回填/返修（§1 → §0 → §2+§3+§4+§5+§6） |
| ⑥ | 探针输出 run-tagged、同名拒写、不覆盖既有取证 | `p1o-00` 落盘名含 `<phase>[-mut<id>]-<RUN>` 且 `existsSync ⇒ throw REFUSE_TO_OVERWRITE`；`p3u-00` 同法（`-<label>-<RUN>`）；`p2w-00` 用 `p2w-lib.save()` 的 run tag；**既有** artifact（含 `MULC8WT7`/`MULF8X80`/`140357Zumiq` 等）**只读、未写入** |
| ⑦ | 读数异常先怀疑自己的探针 | `D5s` 红（`55006`）先按「我的控制杆顺序错」自证 ⇒ 改脚本 ⇒ 复跑转绿（§3 详载）；未把探针问题记成实现缺陷 |
| ⑧ | 强命题必当场举反例 | 「摘闸后同形篡改不再报」当场举反例：`d_gate_off_control.flush_ok=true`（反例支持该命题）；「新档不吞真错码」由变异 (i)(ii)(iii) 三反例支持；「F3 期望不可达」由 `23514` + 手写等价式 `51` 双向对照 |
| ⑨ | 样本量 1 不得推翻多次观测 | 真抖动**跨 5 跑零复现**，仍**不**据此宣称「抖动不存在」：正档验证只声明「档位定义与注入观测同形时被接住」，真实抖动实测标 `NOT_MEASURED` |

**未验证清单（`NOT_MEASURED` / `null`，禁 0 / 空数组占位）**
- **真实连接层抖动被新档接住的实测**：`NOT_MEASURED`（本单 5 跑 `env_jitter` 全 0；用夹具 `--mutate iv` 同形注入替代验证）。
- `p1o-00` 基线跑 `MULFRRL5` 的**退出码**：`NOT_MEASURED`（前台 420s 上限中断时未取到）。
- 最后两跑（`MULGHW3E` / `n3c5`）之后的**真库五表计数**：`NOT_MEASURED`。
- `p2w-00` **修前** 的 reds 快照：**转引**既有 artifact（`140357Zumiq`），本单未重跑修前版本（避免多写一次真落账夹具）。
- 连接层加固（rca §6 的 B/C 档）：本单**未实施**（超出写边界）。
- 端口/PID：本单未起任何常驻 server（只用前台/后台**短命**脚本进程）⇒ `null`；**未** kill 任何进程（无 `pkill -f`/`killall`）。

## §6 附录：artifact 清单 / 新增文件登记

**修改的既有文件（本单唯一两处代码改动）**
- `backend-ts/scripts/p1o-00-escape-sweep.ts`（`M`）：既有 transient 档 + `env_jitter` 单列 + `env_jitter_separately_counted` + `--mutate i|ii|iii|iv` 夹具开关 + 头部口径说明。
- `backend-ts/scripts/p2w-00-p2fix-verify.ts`（`M`）：D4/D5 显式裁决点、D7 转登记、E4 可对照形态（两路读数）、F3 不可达登记 + `F3b` 可达对照、`D4s/D5s` 两路灵敏度自证、头部 §D/§E/§F 口径更新。

**本单新增文件**
- `backend-ts/scripts/p3u-00-counts.ts`（只读五表/守恒/触发器计数探针）
- `backend-ts/.p3u-artifacts/p3u-00-counts-before-suite-<RUN>.json`、`…/p3u-00-counts-after-suite-20260928T162143Z9de7.json`

**两套件自产的新 artifact（run-tagged，全部登记）**
| 文件 | run | 说明 |
|---|---|---|
| `.p1f-artifacts/p1o-00-escape-sweep-after-MULFRRL5.json` | `MULFRRL5` | 修后基线（绿） |
| `.p1f-artifacts/p1o-00-escape-sweep-after-muti-MULG1Z0Y.json` | `MULG1Z0Y` | 变异 (i) 红 |
| `.p1f-artifacts/p1o-00-escape-sweep-after-mutii-MULG1Z0H.json` | `MULG1Z0H` | 变异 (ii) 红 |
| `.p1f-artifacts/p1o-00-escape-sweep-after-mutiii-MULG1Z0V.json` | `MULG1Z0V` | 变异 (iii) 红 |
| `.p1f-artifacts/p1o-00-escape-sweep-after-MULG83F0.json` | `MULG83F0` | **恢复跑**（绿，`EXIT=0`） |
| `.p1f-artifacts/p1o-00-escape-sweep-after-mutiv-MULGHW3E.json` | `MULGHW3E` | **新档正向**（`env_jitter 1`，绿，`EXIT=0`） |
| `.p2w-artifacts/p2w-00-verify-20260928T161940Zzkdd.{json,txt}` | `…Zzkdd` | 修后第 1 跑（1 红 = 我控制杆的顺序错，已修） |
| `.p2w-artifacts/p2w-00-verify-20260928T162825Zn3c5.{json,txt}` | `…Zn3c5` | 修后第 2 跑（`reds 0`，`EXIT=0`） |

**旁证/读取的既有文件（只读）**：`.p1f-artifacts/p1o-00-escape-sweep-after-MULF8X80.json`（修前 1 红）、`.p2w-artifacts/p2w-00-verify-20260928T140357Zumiq.json`（修前 5 红）、`docs/audit/p3-baseline-rca.md`、`migrations/0007,0011`、`src/ledger-errors.ts`。

**`git status --porcelain`（收尾实测，仅列本单元相关）**：` M backend-ts/scripts/p1o-00-escape-sweep.ts`、` M backend-ts/scripts/p2w-00-p2fix-verify.ts`、`?? backend-ts/scripts/p3u-00-counts.ts`、`?? backend-ts/.p3u-artifacts/`、`?? backend-ts/.p1f-artifacts/p1o-00-…-{MULFRRL5,MULG83F0,MULG1Z0Y,MULG1Z0H,MULG1Z0V,MULGHW3E}.json`、`?? backend-ts/.p2w-artifacts/p2w-00-verify-…{Zzkdd,Zn3c5}.{json,txt}`、`?? docs/audit/p3-suite-caliber-fix.md`。`src/**`、`migrations/**`、`docs/*.spec.md`、`docs/versions/**`、`docs/qa/**`、`docs/seafood.master-plan.md`、`docs/audit/p3-*.md`、`scripts/p3[qrt]-*.ts`、任何既有 artifact **均无本单改动**（工作区另有 `scripts/p3v-*`、`docs/qa/p3-errors-fold-fix-review.md` 等条目属**并行单**产出，非本单所写）。**未** `git add`/`commit`/`push`。
