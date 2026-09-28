# P3 基线回归 RCA（Unit B / P3-RCA · 角色 Kong）

> **交付状态**：本文件按「先落盘骸架、逐段回填」交付，**9 节（§0–§9）已全部回填完毕、无 `（回填）` 占位**（终局 `wc -l -c` + `read_file` 复核：**198 行 / 30481 B / 10 个 `## §` 章节，0 个真实占位**）。**未实测字段写 `NOT_MEASURED` / `NOT_REPRODUCED` / `null`，禁 0 / 空数组占位。**
> 交付人：Kong（实现）。裁定人：Zang。上一单（被退回）：`deleg_34949e33` → `docs/audit/p3-baseline-regression.md`（其 D4/D5 =「旧套件漂移」、D7 =「疑似真缺陷」的拆分**已被 Zang 退回**，本单从头重判）。

## §0 元信息与口径

- 仓库/分支/HEAD：`/Users/kevin/bistro/seafood` · `main` · `3b8e379`（工作区新增：`docs/audit/p3-baseline-rca.md`、`backend-ts/scripts/p3r-*.ts`、`backend-ts/.p3r-artifacts/**`、`.p1f-artifacts/p1o-00-escape-sweep-after-MULC8WT7.json`；**未** `git add/commit/push`）。
- 数据库：Neon PG 18.6；驱动 `@neondatabase/serverless` + `ws`（**未装 `pg`**）；跨 schema 陷阱：库内另有 `neon_auth.account` ⇒ 本单所有 SQL **显式限定 `public.`**。
- 本单 run 命名空间：uid 窗口 `9909xx`，幂等键前缀 `cli:kong18-`。
- 套件运行命令口径（逐字）：`cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/<file>.ts <args>`。
- 本报告引用的 artifact（全部 run-tagged，文件名含 UTC 时间戳）：
  - `backend-ts/.p3r-artifacts/`（本单自产，**同名拒写**）：
    - `p3r-01-facts-20260928T141920Zvokg.json`（库侧结构事实：触发器定义/派生属性/约束定义/函数指纹/两个函数体全文）
    - `p3r-02-sigma-gate-point-20260928T142252Zmr4a.json`（**决定性实验**，全部 leg 结论有效；同目录另有 `…142037Zct08.json`、`…142134Z6ogu.json` 两次**中途失败**的跑，失败原因 `NOT_DECIMAL_INTEGER`/`LEDGER_INSUFFICIENT_FROZEN`，只在 §4 作对照登记）
    - `p3r-00-counts-before-session-20260928T141942Zw72k.json` / `p3r-00-counts-after-session-20260928T142856Zi91f.json`（真库行增量口径）
    - `p3r-03-attribution-20260928T142935Z0hwq.json`（增量归因）
  - 复核读取的**既有**文件（**只读，未手改、未删**）：
    - `backend-ts/.p2w-artifacts/p2w-00-verify-20260928T140357Zumiq.json`（= 上一单 reds 原始取证；同类 `…135958Z1buc.json`、`…p2w-rr-1.json`）
    - `backend-ts/scripts/p2w-00-p2fix-verify.ts`、`scripts/p2w-lib.ts`、`migrations/0007…`、`migrations/0011…`
  - 套件自产**新**文件（本单跑出来的，登记在案）：`backend-ts/.p1f-artifacts/p1o-00-escape-sweep-after-MULC8WT7.json` + stdout 捕获 `/tmp/p1o_try1.out`（3658 B；`/tmp` 非仓库路径）。

## §1 五条 reds 的统一根因定案

**统一根因（一句话）**：五条 reds **都不是「实现拦不住非法事件」，而是「探针把判据放在了守卫不可能裁决的落点上」**——Σ 闸的唯一裁决点是**延迟约束的提交/flush 点**（且必须在事件把 `account` 写回、即「事件闭合」之后）；D4/D5 **从不 flush**，D7 把约束**钉在 IMMEDIATE**（该模式下 `0011` 明确设计为对「未闭合」事件豁免）；E4/F3 的对照杆 `DISABLE TRIGGER trg_referral_cycle_guard` 与 `depth` 计算**是同一个触发器**（`0011:252`），摘杆即摘掉所测机制。观测到的 `null`/`ok=true` 是**观测点没触发守卫**，不是非法事件被合法化。

### §1.1 逐条：期望 → 依据（行号）→ 实测（run-tagged）→ 分类

| red | 期望（`scripts/p2w-00-p2fix-verify.ts` 行号） | 依据（源码/迁移 + 库侧现取） | 实测（run-tagged） | 分类 |
|---|---|---|---|---|
| **D4** | L498–500：`d3.posted.ok===false` ∧ `error.sqlstate==='LD032'` ∧ `reason==='COMMISSION_SPLIT_SUM_MISMATCH'` | 闸 = `public.trg_ledger_entry_commission_conservation`（现取：`CONSTRAINT TRIGGER … AFTER INSERT … DEFERRABLE INITIALLY DEFERRED`，`tgenabled='O'`）→ 函数 `ledger_assert_commission_conservation()`（`0011:111–142` 判负、`0011:128–133` 未闭合则豁免）。L455 的 `SET CONSTRAINTS … DEFERRED` 对 INITIALLY DEFERRED **是 no-op**，脚本**从不 flush**，且整体跑在回滚事务里 | 既有：`.p2w-artifacts/p2w-00-verify-20260928T140357Zumiq.json` → `d3_tamper_drop_pair {entries:22, ok:true, err:null}`；本单：`p3r-02-…mr4a.json` `leg_R` → 同形载荷 `post.ok=true`，**加一次 `SET CONSTRAINTS ALL IMMEDIATE` ⇒ `LD032 / COMMISSION_SPLIT_SUM_MISMATCH`** | **(c) 探针口径错**（判据落在闸不可裁决的落点）。附带的 (a) 成分：期望与 `0011` 的落点设计（提交点裁决）漂移 |
| **D5** | L501–503：`d4.posted.ok===false` ∧ 同码同 reason | 同 D4。`d4` = 删掉**全部** commission 行（只入不出）；L464 同样只 DEFERRED、不 flush | 既有：`d4_pool_in_no_out {entries:4, ok:true, err:null}`；本单 `leg_R4` → `post.ok=true`，**flush ⇒ `LD032 / COMMISSION_SPLIT_SUM_MISMATCH`** | **(c)** 同上 |
| **D7** | L505–507：`d5.badPost.ok===false` ∧ `after_immediate2.err.sqlstate==='LD032'` | L474 在 post **之前** `SET CONSTRAINTS ALL IMMEDIATE` ⇒ 行级闸在事件中途触发，而 `0011:128–133` 对「未闭合」事件 `RAISE NOTICE … skip` 豁免；闸只挂在 `ledger_entry` INSERT 上，**账户写回（= 闭合）发生在其后且不触发复核** ⇒ 闭合后再无裁决机会 | 既有：`badPost {ok:true,err:null}`、`after_immediate2 {ok:true,err:null}`；本单 `leg_D7` 逐项复现：`immediate_before ok` → `post_legal ok=true` → `post_tampered_while_immediate ok=true`（逃逸）→ `flush_after ok=true` | **(c) 探针口径错**，且**与同套件 D6 自相矛盾**：L484–491 的 D6 明写「强制 IMMEDIATE 期间，Σ 断言不再判负（本修法的设计代价）」并**明示不判**，D7 却去判它 |
| **E4** | L539–541：摘 `trg_referral_cycle_guard` 后裸 `INSERT` 退回 `23505` / `referral_pk` | `0011:252` `NEW.depth := 1 + COALESCE(v_parent_stored_depth, 0)` **就在该触发器内**（现取 `referral_cycle_guard()` 全文，`len=6075/md5=7bd5874f…`）；`0007:60` `CHECK (depth >= 1)`（现取 `contype='c'`，**不可延迟**）⇒ L533 摘杆后 L534 的字面量 `depth=0` **先撞 CHECK**，事务即 abort，第二次 INSERT 根本没执行 | 既有：`E_f6_pre_fix_control.tx_error = 'new row for relation "referral" violates check constraint "referral_depth_rng"'`；本单 `leg_C_guardless`：`depth=0` ⇒ **`23514`/`referral_depth_rng`**；**同杆改用 `depth=1` ⇒ 首插成功、重绑 ⇒ `23505`/`referral_pk`**（= 期望的修前形态**可达**） | **(c) 探针口径错**（对照手段可用，输入 `depth=0` 错） |
| **F3** | L574：摘守卫后陈旧 `depth` 被继承 `50 ⇒ 51` | 「继承」本身就是 `0011:252`（摘杆 ⇒ 无计算可言，只能写入字面量）；L565 摘杆 + L568 `UPDATE depth=50` + L569 插入，仍先撞 `referral_depth_rng` | 既有：`F_f2_pre_fix_control.tx_error` = 同一 `referral_depth_rng` 违例；本单 `leg_C_guardless` 同一崩因 | **(c) 探针口径错，且期望本身不可达**（对照手段与所测机制是同一个东西 —— 与 E4 的「输入错」不同） |

**共同点（Zang 的判据成立）**：D4/D5/D7 三条 `judge` 的**期望式同形**（`posted.ok===false ∧ sqlstate==='LD032'`），观测一律 `err=null` ⇒ **三条是同一现象**；E4/F3 两条期望「修前形态复现」，观测同一 `tx_error`（`referral_depth_rng`）⇒ **两条是同一现象**。上一单把它拆成「(a) 旧套件漂移 / (b) 疑似真缺陷」**不成立**：本单的统一解释覆盖五条，且**没有任何一条落在 (b)**。

### §1.2 为什么不是 (b) 真缺陷 / 不是「(d) 已登记未落码」的未修项

- **不是 (b)**：本单在**同一库、同一 schema（`schema_version=0017`）、同一函数指纹**下，把 D4/D5/D7 的同形载荷**往前推一个落点**（加一次 `SET CONSTRAINTS ALL IMMEDIATE`）即得 `LD032 + COMMISSION_SPLIT_SUM_MISMATCH`（`leg_R`/`leg_R4`）；合法事件在同一落点**不报**（`leg_G`）。闸是真在的、真会判负的（见 §4 三段自证）。
- **不是 (d)**：历史台账把 D4/D5/D7/E4/F3 记为「未落码」，但**漂移/未落码都不是本单观测的解释**——三条既有 artifact（含 `2026-09-27` 的 `p2w-00-verify-p2w-rr-1.json`）与上一单两跑**逐字节同形**（reds 相同、`D_f3` 读数相同）⇒ 现象**跨 P2/P3 稳定复现**，与 P3 迁移无关 ⇒ 它从来不是「等实现落码」，而是**这套探针的判据从写下那天起就放在错的落点上**。
- **诚实登记（唯一一条「实现侧收窄」，非本单新发现）**：`0011` 的免疫情形使「事务被钉在 IMMEDIATE」时，闭合后的 Σ 不再被复核（`leg_D7` 复现）。这条边界**由同套件 D6 与 `0011` 文件头自行登记为设计代价**，且 **`src/**` 内 `SET CONSTRAINTS` 命中数 = 0**（`grep` 全 `backend-ts/src` 0 命中）⇒ 应用路径不会把约束钉在 IMMEDIATE 后再落账 ⇒ 该逃逸**在本仓生产调用形态下不可达**（只由探针自己构造）。**结论：不立案为真缺陷，登记为已核准的设计边界。**

## §2 Q1 — D4/D5/D7 构造的「非法事件」今天还算非法吗？

**答：三条构造的事件**在业务/不变式层面**今天仍然是非法**（`Σ` 不守恒），拒绝它的那段逻辑**P3 之后仍在且已现取**；但**能否被拦下**取决于裁决落点，而不是取决于合法性。

| 构造 | 是否仍非法（判据） | 应当由哪段逻辑拒绝 | 该逻辑在 P3 之后是否仍在（证据） |
|---|---|---|---|
| `d3` 删最后两行 commission（`Σ出池 900 ≠ 入池 1000`） | **是**（`Σcommission(-2) != Σjob_fee(-2)`，正是 `commission.ts:36` 记的业务语义） | 触发器 `public.trg_ledger_entry_commission_conservation` → 函数 `public.ledger_assert_commission_conservation()` 的 `IF v_pool_in <> v_paid_out THEN … ledger_raise('LEDGER_RECONCILE_MISMATCH', {reason:'COMMISSION_SPLIT_SUM_MISMATCH'})`（`0011:111–141`） | **在**：现取 `pg_trigger.tgenabled='O'`、`tgdeferrable=true`、`tginitdeferred=true`、`pg_get_triggerdef='CREATE CONSTRAINT TRIGGER … AFTER INSERT ON public.ledger_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_assert_commission_conservation()'`；函数现取 `octet_length(prosrc)=2967` / `md5=27ddc76b842594cb6ee8673c171e6526`，函数体内含上述 `ledger_raise`（`p3r-01-facts-…vokg.json` 的 `conservation_fn_src`）。**实证**：`leg_R` flush ⇒ `LD032 / COMMISSION_SPLIT_SUM_MISMATCH` |
| `d4` 只入不出（删掉**全部** commission 行） | **是**（池子只入不出，`Σ出=0 ≠ Σ入=1000`） | 同一条闸（触发范围 `0011:96–99`：`commission&uid=-2` 或 `job_fee&uid=-2&delta>0`；本事件的 `job_fee(-2,+1000)` 命中） | **在**：同一触发器/函数。**实证**：`leg_R4` flush ⇒ `LD032 / COMMISSION_SPLIT_SUM_MISMATCH` |
| `d5` 的 `badPost`（同 `d3` 形态，但 post 时约束已 IMMEDIATE） | **是**（同一 Σ 判据） | 仍是同一条闸；但 `0011:112–133` 明确：**事件未闭合 ⇒ `RAISE NOTICE … skip` 豁免**，而「闭合」的写回发生在分录之后、且**不触发**该闸（闸只挂 `ledger_entry` INSERT）⇒ **在该事务的约束模式下没有任何一次裁决发生在闭合之后** | **逻辑在**（同上，函数体已现取）；**但在该模式下不落裁决**。**实证**：`leg_D7` 精确复现（`post_tampered_while_immediate ok=true` + 之后再 flush 仍 `ok=true`）⇒ 这与同套件 D6（L484–491「强制 IMMEDIATE 期间，Σ 断言不再判负（本修法的设计代价）」，**明示不判**）**逐字一致**，不是新缺陷 |

补充「仍在」的机器证据：**四个编排函数指纹本单现取与冻结值逐字相同**（`ledger_post_event 51429/d94dd902…`、`market_post_event 30194/74841611…`、`listing_post_event 17858/0e187c20…`、`job_post_event 13594/0cedbb9e…`），`schema_version=0017`。

## §3 Q2 — E4/F3 的判负对照路径为何观测到 `null`？

**判定：对照分支执行了（不是「压根没执行」）；崩因是它的前置自相矛盾**——「摘掉守卫」这个动作同时摘掉了它要用到的 `depth` 计算。

依据链（逐条可复核）：
1. **分支执行过的证据**：既有 artifact 里 `E_f6_pre_fix_control` / `F_f2_pre_fix_control` 的 `tx_error` **非空**（`new row for relation "referral" violates check constraint "referral_depth_rng"`）。若分支压根没执行，`inRollbackTx` 的 `error` 会是 `null`、`result` 非 `null`（`p2w-lib.ts:78–92`）。`null` 只是 `judge` 读的 `Ectrl.result?.err`（`result` 为 `null` 时的默认值），**不等于「没跑」**。
2. **崩点定位**：`p2w-00…ts:533` `ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard` → `:534` 首插 `(child, parentB, 0)`。本单现取：`disable=true`（`ALTER` 在事务内**可用**）→ 首插即抛 **`23514` / `referral_depth_rng`** ⇒ `:535` 的第二次 INSERT（期望撞 `23505`）**在结构上不可达**。
3. **为什么 `depth=0` 会炸**：`0007:60` `CHECK (depth >= 1)`（现取 `contype='c'`、不可延迟）；而 `depth` 的补齐**就在被摘掉的那个触发器里**——`0011:252` `NEW.depth := 1 + COALESCE(v_parent_stored_depth, 0)`（函数是 `referral_cycle_guard()`，现取 `md5=7bd5874f7145989a43567003048a9f04`）。`0007:274` 的注释**预先写明了这个后果**：「depth 占位 0：由 `trg_referral_cycle_guard` 覆写；若守卫被摘掉 ⇒ CHECK(depth>=1) 立刻炸（响亮的失败）」。
4. **不是「手段在事务内不可用」**：同一事务内 `DISABLE TRIGGER` / `ENABLE TRIGGER` 都成功（`leg_C_guardless` 记录 `disable=true`、`enable=true`）；也不是 `trg_*` 名字不存在（若 `ALTER` 报错，后续应是 `25P02`，而实测是 `23514`）。
5. **反例（§5.7 ⑧ 要求，撞「不可达」命题）**：**E4 的期望其实可达**——同一对照杆改用 `depth=1` 字面量，首插成功、重绑确实撞 **`23505` / `referral_pk`**（`leg_C_guardless.insert_depth1_guard_off_rebind`）。⇒ E4 = **输入错（口径错）**；而 **F3 的期望不可达**（「继承 50⇒51」这件事本身 = 被摘掉的那段代码），⇒ F3 = **对照手段与所测机制同一**。二者同归 (c)，但错法不同（本表已在 §1.1 区分）。

## §4 Q3 — `LD032` 拦不拦得住（判负自证三段）

**答：拦得住。** 在**唯一有意义的裁决落点**（延迟约束的提交 / `SET CONSTRAINTS ALL IMMEDIATE` flush）上，两种篡改形态都抛 `LD032`；合法事件不抛。**不存在需要修复的真缺陷**（Q3 的「若确有一条真缺陷」条件不成立）。

**最小复现（单事务、零残留）**
```
BEGIN;                                                   -- 夹具：本单独占币 cid、雇主 uid 990901、铸 + 冻结
SELECT public.ledger_post_event($1::jsonb);              -- ① 未篡改事件 → ok=true
SELECT public.ledger_post_event($2::jsonb);              -- ② 篡改事件：删掉最后 2 条 commission 分录 → ok=true（探针的观测点）
SET CONSTRAINTS ALL IMMEDIATE;                           -- ③ = 提交点结算（唯一裁决点）
-- 红态：ERROR  sqlstate=LD032  message=LEDGER_RECONCILE_MISMATCH
--       detail={"reason":"COMMISSION_SPLIT_SUM_MISMATCH", ...}
ROLLBACK;                                                -- 零残留
```
- **① 红态（篡改 ⇒ 必报）**：`leg_R` → `flush_after_post {ok:false, sqlstate:'LD032', reason:'COMMISSION_SPLIT_SUM_MISMATCH', message:'LEDGER_RECONCILE_MISMATCH'}`；`leg_R4`（只入不出形）同码同 reason。
- **② 绿态（合法 ⇒ 不报）**：`leg_G` → `post.ok=true` ∧ `flush_after_post.ok=true`（无错）。⇒ 闸不是「一律报」，它就是判 Σ。
- **③ 恢复（零残留 + 守恒不破）**：所有 leg 跑在回滚事务内；跑后复核 `public.ledger_entry` **3175→3175**、本单 uid 窗口 `9909xx` 的 `public.users/public.account/public.referral` **0 行**、`cli:kong18-%` 键下 `public.ledger_entry` **0 行**（`p3r-03-…0hwq.json`）；`cid=1` 守恒 `total_supply 8400 == Σ(balance+frozen) 8400`（`p3r-00-counts-…`before/after 两侧）。
- **诚实登记（两次中途失败的跑，不隐藏）**：`…142037Zct08.json` 因 `ref_id` 用了非十进制串 ⇒ 夹具 hold 报 `NOT_DECIMAL_INTEGER`，该次 R/R4/G/D7 leg **全部无效**（其 C leg 有效）；`…142134Z6ogu.json` 的 `leg_D7` 因第二个 job 未补冻结 ⇒ 篡改 post 得到 `LD002 LEDGER_INSUFFICIENT_FROZEN`（与 Σ 无关），故补 `fund_job5` 后重跑到 `…142252Zmr4a.json` 才收全结论。

## §5 `p1o-00` 重跑取证

**命令（逐字，退出码未取自管道之后）**
```
cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert > /tmp/p1o_try1.out 2>/tmp/p1o_try1.err; echo "EXIT=$?"
```
**结果：`EXIT=0`（PASS，`--assert` 未收红）；stdout 3658 B / stderr 0 B（上一次的三次崩是 stdout 0 B）。**
> 复核方法说明：本机**无** `timeout` / `gtimeout`（§5.7 ③），故未使用任何限时命令；未加任何包装、未改套件断言、未改 SQL 语义；未起任何常驻 server（故无端口/PID 需登记）。

**读数（`backend-ts/.p1f-artifacts/p1o-00-escape-sweep-after-MULC8WT7.json`，run `MULC8WT7`，`phase=after`）**

| 项 | 读数 |
|---|---|
| cells | `cells_total 604` / `executed 590` / `skipped 14` / `thrown 518` / `no_throw 86` |
| 逃逸类（**关键词命中 = 0**，故「无逃逸」有支撑） | `raw_sqlstate_escapes 0`、`unmapped 0`、`missing_status 0`、`ld_sqlstate_leaked 0`、`unexpected_500 0`、`expectation_mismatches 0`、`valid_shape_false_reject 0` |
| verdicts | `raw_sqlstate_escapes_zero / unmapped_zero / missing_status_zero / ld_sqlstate_no_leak / no_unexpected_500_from_caller_input / all_cells_match_expectation` **全 true** |
| failures / escape_cells / mismatch_cells | 均为 `[]`（空数组 = 套件自报的**结论**，非我填的占位） |
| 写库 | `rows_touched: ledger_entry_before 3175 → after 3175`、`wrote_no_ledger_rows true` |
| 自身残留（诚实登记，**非本单命名空间**） | 该跑自产 `public.currency` 1 行（`cid 271 / symbol P1PMULC8WT7 / owner 948001 / supply 0`）＋ `public.account` 4 行（`cid 271` 上 `uid -5 / 0 / 9223372036854775807 / 948001`，余额全 0）⇒ 见 §7 |

**持续故障判定：不成立（本单 1 次尝试即拿到读数，未复现上一单的 3/3 崩）。**
- 上一单三次崩（**转引**，本单不是实测）：① `Client network socket disconnected before secure TLS connection was established`；②③ `TypeError: Cannot set property message of #<ErrorEvent> which has only a getter at _n._connectionCallback (@neondatabase/serverless/index.js:1379)`。⇒ 崩点在**驱动连接回调的 WebSocket 错误路径**，与 SQL 无关，stdout 0 B、无 artifact。
- 本单诚实边界：**样本量 1**，不足以推翻上一单的 3/3；且本单未能构造稳定复现（`NOT_REPRODUCED`）。⇒ 「持续故障」按本单读数**判否**，但按合并证据判**非确定性连接层缺陷**，故仍给加固方案（§6）。

## §6 连接层加固评估

**结论：未实施，只出方案（交 Zang 裁定）。** 三条理由（都是可复核的事实，不是推脱）：

1. **崩溃点不在 `src/db.ts` 那一层**。上一单崩在驱动内的 `_n._connectionCallback`（`@neondatabase/serverless/index.js:1379`，对 `ErrorEvent` 设 `.message`）；而跑套件用的是**各探针自建的 Pool**（`scripts/p2w-lib.ts:26 mkPool()`、p1o-00 自带池），**不经过** `src/db.ts` 的 `getTransactionPool/getReadPool`。⇒ 只改 `src/db.ts` **不能**让「崩了也不丢 artifact」这条要求成立。
2. **本单无法做修前/修后对拍**：故障 `NOT_REPRODUCED`（§5），没有可复现的红态就写不出可信的对拍读数；按纪律，**宁可只出方案，不编读数**。
3. **`src/db.ts` ≤20 行挡不住这个 TypeError**：`pool.on('error', …)` 只能改变**事件**的处置，挡不住驱动**回调内部同步抛出**的 `TypeError`；`pool.connect()` 的重试只能覆盖「promise 拒绝」那条路径。⇒ 条件（限 `db.ts` 且 ≤20 行）**不满足「必须能证明有效」**，故不实施。

**方案（三档，供裁定；A/C 超出本单写边界，B 在边界内但需你点头「有效」）**

- **A. 驱动/端点层（首选，改动最小）**
  1. 升级 `@neondatabase/serverless`（现用 `0.6.1`，见 `src/db.ts:12` 的实测注释）到已修该 `ErrorEvent` 写法的版本；
  2. 或固定走**直连 WebSocket**（`DATABASE_URL_UNPOOLED`）并显式关掉 pooler（pooler 另有一条已知陷阱：**拒 `options` 参数 `08P01`**）；
  3. 不用 `WEB`/`HTTP` 短连接路径跑长事务。
- **B. 应用层（限 `src/db.ts`，约 12–16 行，形状如下；未落码）**
```ts
// 1) 池级错误不冒泡成 uncaught（idle client 的 socket error 只登记不崩）
const attach = (pl: Pool) => { pl.on('error', (e) => { console.error('[db] pool error', e?.message ?? e); }); return pl; };
// 2) connect() 也重试（现有 while 循环从 connect() 之后才开始 try，connect 拒绝既不重试也不映射）
const connectWithRetry = async (pl: Pool, tries = 3) => {
  for (let i = 0; ; i += 1) {
    try { return await pl.connect(); }
    catch (e) { if (i >= tries - 1) throw new DbTxError('LEDGER_TX_CONNECT_FAILED', String((e as Error)?.message ?? e), null); await new Promise((r) => setTimeout(r, [50, 200, 800][Math.min(i, 2)])); }
  }
};
// 3) 两处池构造后 attach()；withTransaction 里 `const client = await connectWithRetry(pool)`
```
  读前须知（诚实）：这一档在本单**没有对拍证据**能证明挡住 `_connectionCallback` 的 TypeError；它的价值是「连接失败可重试、池错误不崩」，不是「消灭该驱动 bug」。
- **C. 探针层（真正满足「崩也不丢 artifact」的那一档；超出本单写边界**：需改 `scripts/*-lib.ts`，故仅出方案）
  1. 每个套件**第一件事**先落盘骨架 artifact（`{run, phase, status:'STARTED', stage:'connect'}`，run-tagged、同名拒写），随每阶段回写 `stage` ⇒ 崩在半途也留证；
  2. `mkPool` 包一层 `connectWithRetry`（同上），并给池挂 `pool.on('error')`；
  3. 顶层装 `process.on('unhandledRejection'|'uncaughtException')` 守卫：**只**把错误写进 artifact + `exit 2`，不吞不静默；
  4. 保留「退出码不取自管道」与「run-tagged 同名拒写」两条不变。

**与 tsc 的相容性（本单现取）**：`cd backend-ts && npx tsc --noEmit` ⇒ **`EXIT=0` / 0 行**（PASS；本单未改 `src/**`，不可能新增）；`npx tsc -p tsconfig.scripts.json` ⇒ `EXIT=2` / **10 条基线错**（与上一单登记的 10 条同量），其中 `p3r-` 命中数 = **0** ⇒ 本单新增的 3 个 `p3r-*.ts` **未新增任何类型错**，10 条基线错**本单不修**（保留待清单化）。

## §7 真库行增量登记（每跑一次旧套件同口径登记）

**口径**：`SELECT count(*) FROM public.<表>`，`cid=1` 守恒 = `currency.total_supply` vs `SUM(balance+frozen) WHERE cid=1`。区间 = 本单会话（跑前/跑后各一次）。

| 时刻（UTC） | 事件 | users | account | ledger_entry | referral | currency | commission_policy | cid=1 守恒 |
|---|---|---|---|---|---|---|---|---|
| 14:19:42 | `before-session`（本单任何跑之前，含上一单遗留） | 573 | 341 | 3175 | 287 | 106 | 25 | `8400 == 8400` ✓ |
| 14:19:20–14:22:52 | p3r-01（只读）＋ p3r-02 ×3（**leg 全在回滚事务内**；仅顶层夹具币泄漏） | 0 | 0 | 0 | 0 | **+3** | 0 | 不变 |
| ~14:2x | `p1o-00 --phase after --assert`（套件自报 `wrote_no_ledger_rows=true`；自产币+账户） | 0 | **+4** | 0 | 0 | **+1** | 0 | 不变 |
| 14:28:56 | `after-session` | **573** | **345** | **3175** | **287** | **110** | **25** | `8400 == 8400` ✓ |
| **本单净增量** | | **0** | **+4** | **0** | **0** | **+4** | **0** | **未破** |

**归因（`p3r-03-attribution-20260928T142935Z0hwq.json`，逐条现取）**
- **本单自造残留 = currency 3 行**：`cid 268/269/270`，`symbol p3rk18ct08 / p3rk186ogu / p3rk18mr4a`，`owner_uid 990901`（本单 uid 窗口），`total_supply 0`；**无** account/users/referral/ledger_entry 伴随行（`9909xx` 窗口 3 张表 0 行；`cli:kong18-%` 的 `public.ledger_entry` 0 行）。
  **根因（诚实自证）**：`scripts/p3r-02-sigma-gate-point.ts` 顶层 `ensureCurrency(p, SYM, U.EMP, 8)` 跑在**事务外**（夹具币创建在事务内才是零残留）⇒ 三次跑各建 1 行。**未删除**（零删除红线）：该 3 行 `supply=0`、无账户、不参与 `cid=1` 守恒。
- **p1o-00 自产残留 = currency 1 行 + account 4 行**（`cid 271 / P1PMULC8WT7 / owner 948001`；`cid 271` 上 `uid -5 / 0 / 9223372036854775807 / 948001`，余额全 0）——属该套件自身命名空间，非本单命名空间。
- 上一单「一次套件批跑 = users +108 / ledger +229 / referral +64 / account +14 / currency +5 / commission_policy +3」**不在本单区间内**（本单只跑 `p1o-00` 一个既有套件）。

## §8 §5.7 硬口径遵守情况 + 未验证清单

| # | 硬口径 | 本单遵守情况（带证据） |
|---|---|---|
| ① | 保留字对象断言必须加引号 | 本库 `users` 已改名、无该保留字对象；本单**全部** SQL 显式限定 `public.`（含 `public.ledger_post_event`、`public.account`），未对保留字命名对象做断言 |
| ② | 退出码不得取自管道之后 | `p1o-00` 用 `> /tmp/out 2>/tmp/err; echo "EXIT=$?"`（`EXIT=0`）；tsc 两条同法（`EXIT=0` / `EXIT=2`）。**无**任何 `\| tail` 后的退码 |
| ③ | 本机无 `timeout`/`gtimeout` | 未使用任何限时命令 |
| ④ | 含上述形态的读数作废重跑 | `p3r-02` 第 1 跑（`NOT_DECIMAL_INTEGER`）、第 2 跑（`leg_D7` 遇 `LD002`）**判无效并重跑**，已在 §4 登记；最终结论只取 `…142252Zmr4a.json` |
| ⑤ | 先落盘骸架再逐段回填 | 本文件首次 `write_file` 落 **9 节骨架（§0–§9）**，随后 **9 次 patch** 逐段回填/返修（§0 → §1 → §2/§3/§4 → §5/§6 → §7/§8/§9；另有 4 次文字返修，其中 1 次修正了 §1.1 表格列数） |
| ⑥ | 探针输出 run-tagged、同名拒写、不覆盖被验证方原始件 | 3 个 `p3r-*.ts` 全部 `p3r-01/02/03` 自建 `save()` 带 `if (fs.existsSync(file)) throw`；`.p2w/.p1t/.p2c/.p2d` 内既有文件**未写、未删、未手改**；套件自产**新**文件（`.p1f-artifacts/…MULC8WT7.json`）已登记 |
| ⑦ | 读数异常先怀疑自己的探针 | `NOT_DECIMAL_INTEGER` 先按「我传了非十进制 `ref_id`」自证并修（`JID()`）；`LD002` 先按「夹具未给第二个 job 补冻结」自证并修（`fund_job5`）；全程未把探针问题记成实现缺陷 |
| ⑧ | 强命题必举反例 | 对「E4 期望不可达」当场举反例：同杆 `depth=1` ⇒ 首插成功、重绑 **`23505`/`referral_pk`**（§3 第 5 条） |

**未验证清单（`NOT_MEASURED` / `NOT_REPRODUCED`，禁填 0/空占位）**
- 上一单三次连接层崩的**实测复现**：`NOT_REPRODUCED`（本单 1 次尝试即绿，无红态 ⇒ **无修前/修后对拍**）。
- 连接层加固 B/C 档的**有效性证据**：`NOT_MEASURED`（未落码，只出方案）。
- `p2w-00 --assert` **本单未重跑**：reds 直接复核上一单两跑的原始 artifact（逐字一致），未新起对照跑。
- `.p2w/.p1t/.p2c/.p2d` 既有文件：未逐一 `sha256` 比对（它们是 untracked，本单只读且未写入其目录；`git status` 未见本单对其产生变更）。
- 端口/PID：本单**未起任何常驻 server** ⇒ `null`（无端口、无 PID）。

## §9 附录：库侧现取事实（`p3r-01-facts-20260928T141920Zvokg.json`）

- `schema_version = 0017`；`public.candle_view` 视图 1 个。
- **`public` 非 internal 触发器（5 个，全部 `tgenabled='O'`）**
  | 表 | 触发器 | deferrable / initdeferred | 定义 |
  |---|---|---|---|
  | `account` | `trg_account_guard` | false / false | `BEFORE INSERT OR DELETE OR UPDATE … account_guard()` |
  | `ledger_entry` | `trg_ledger_entry_append_only` | false / false | `BEFORE DELETE OR UPDATE … ledger_entry_append_only()` |
  | `ledger_entry` | `trg_ledger_entry_commission_conservation` | **true / true** | `CREATE CONSTRAINT TRIGGER … AFTER INSERT … DEFERRABLE INITIALLY DEFERRED … ledger_assert_commission_conservation()` |
  | `referral` | `trg_referral_append_only` | false / false | `BEFORE DELETE OR UPDATE … referral_append_only()` |
  | `referral` | `trg_referral_cycle_guard` | false / false | `BEFORE INSERT … referral_cycle_guard()`（内含 `NEW.depth := 1 + COALESCE(v_parent_stored_depth,0)` → `0011:252`） |
- **`public.referral` 约束（现取）**：`referral_pk` PRIMARY KEY (child_uid)、`referral_depth_rng` CHECK (depth >= 1)、`referral_no_self` CHECK (child_uid <> parent_uid)、`referral_child_fk`/`referral_parent_fk` FK→`users(uid)`、3 个 NOT NULL。
- **`public.ledger_entry` 约束（要点）**：`ledger_entry_pkey` PK(txid)、`ledger_idem_uniq` UNIQUE(idempotency_key)、`ledger_kind_enum`（20 个 kind）、`ledger_event_root_guard`、`ledger_move_guard`、`ledger_reversal_guard`、`ledger_after_guard`、`trg_ledger_entry_commission_conservation` `contype='t'` / `def='TRIGGER DEFERRABLE INITIALLY DEFERRED'`。
- **函数指纹（本单现取）**：`ledger_post_event 51429 / d94dd902697dfe60aba409d808c6d63a`、`market_post_event 30194 / 74841611252726e1cc0f57cb46ea6c6d`、`listing_post_event 17858 / 0e187c20b56d45202d83978c8a02b31d`、`job_post_event 13594 / 0cedbb9ea60dcbda28e3ef3dafdd119b` —— **与冻结值逐字相同（未改动）**；另有 `ledger_assert_commission_conservation 2967 / 27ddc76b842594cb6ee8673c171e6526`、`referral_cycle_guard 6075 / 7bd5874f7145989a43567003048a9f04`、`referral_bind 1726 / fe598897e38c0a369a80d8f501caab04`。
