# p3-baseline-rca.md 独立质检复核（Neng · 角色：独立质检/验证）

> **交付状态**：本文件按「先落盘骸架、逐段回写」交付（首次 `write_file` 落 10 节骨架、全部判定项 `NOT_MEASURED`；随后逐段回填）。**未实测字段写 `NOT_MEASURED`，禁 0 / 空数组占位。**
> 被检对象：`docs/audit/p3-baseline-rca.md`（Kong 交付，Unit B，已入库 `HEAD`）。
> **终局 verdict：`部分可用`**（详见 §9）。

## §0 元信息与口径

- 仓库/分支/HEAD：`/Users/kevin/bistro/seafood` · `main` · `a2b68e0`（我接手时 HEAD；全程未 `git add/commit/push`）。
- 被检文件指纹（我现测）：**198 行 / 30542 B / sha256 `c109a095c68cd17ef3fb24c47d51ef183f87497b8899b7a30c717f547e29c1aa`** ⇒ 与任务书给出的 `c109a095c68cd17ef3fb24c4…` 一致 ⇒ **被检件在质检期间未被改动**。
- 被检件声称的库侧事实我已逐条现取（§7），**四编排函数指纹、守恒触发器 `tgenabled`、registry 行数、`schema_version`、`cid=1` 守恒** 均与 RCA 引用的冻结值逐字相同。
- 数据库：Neon PG 18.6；驱动 `@neondatabase/serverless` + `ws`（未装 `pg`）；全部 SQL 显式限定 `public.`。
- **本单 run 命名空间**：uid 窗口 `9910xx`（本次实际用到 `991025–991029` / `991035–991037` / `991037–991041`）· 幂等键前缀 `cli:neng19-` · 夹具币 symbol `p3n19*`（`p3n196zl7ik` / `p3n196zzjhp`）。
- **独立性声明（硬）**：本单**全部读数由自建探测脚本现跑产出**——`backend-ts/scripts/p3n-01-rca-legs.ts`（自建池/自建夹具/自建篡改逻辑/自建闭合判据 SQL）与 `backend-ts/scripts/p3n-02-counts.ts`（只读计数）。**未复用** `backend-ts/.p3r-artifacts/**` 的任何读数作为证据；**未 import** 任何质检方脚本或库（`p2w-lib.ts` / `.p2w` / `.p3r` / `.p1f` 一律不 import）。唯一产品侧 import 是 `src/commission.ts`（事件计划器：`planJobSettlement` / `buildSettleEvent` / `toPayloadEntry` / `settleJobFingerprint`），用作**被检对象下游的载荷契约**，非复用他方读数。既有 artifact 目录**只读**（`.p1f-artifacts/p1o-00-escape-sweep-after-MULC8WT7.json` 仅作对照阅读）。
- 运行口径（逐字）：`cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/<f>.ts <args>`。
- 本单自产 artifact（全部 run-tagged、同名拒写）：
  - `backend-ts/.p3n-artifacts/p3n-01-rca-legs-20260928T143826Zzjhp.json`（**决定性主跑**，status=DONE，T1–T5 + T8 全腿收全）
  - `backend-ts/.p3n-artifacts/p3n-01-rca-legs-20260928T143647Zknrf.json`（第 1 跑，`CRASHED/CRASH-main`，崩因=**我的探针缺陷**，见 §9 自曝）
  - `backend-ts/.p3n-artifacts/p3n-01-rca-legs-20260928T143726Zl7ik.json`（第 2 跑，`HALTED_TAMPER_COMMITTED`，**误停**=我的探针缺陷 #2，见 §9 自曝）
  - `backend-ts/.p3n-artifacts/p3n-02-counts-20260928T145121Zckl5.json`（只读计数快照/归因）
- 套件自产**新**文件（我跑出来的，登记在案）：`.p1f-artifacts/p1o-00-escape-sweep-after-MULCT7CG.json`、`.p1f-artifacts/p1o-00-escape-sweep-after-MULCZVYR.json`（既有同名文件**未写、未删、未手改**）。stdout 捕获在 `/tmp`（`/tmp/p3n01_t*.out|err`、`/tmp/p1o_neng*.out|err`），非仓库路径。

## §1 逐项判定表（T1–T8）

| 项 | 期望（任务书） | 实测（run-tagged） | 判定 |
|---|---|---|---|
| **T1** 生产形态（默认 DEFERRED + 真 `COMMIT`） | 对照臂合法事件提交 ⇒ `ok=true`；篡改臂（① 丢最后一对 commission / ② 只入不出）⇒ **COMMIT 时抛 `LD032`/`COMMISSION_SPLIT_SUM_MISMATCH`、零残留** | 对照臂 `committed=true`（readback 1 行）；① COMMIT 抛 `LD032`+`COMMISSION_SPLIT_SUM_MISMATCH`（`pool_in=100/commission_out=77`）、事后该事件 0 行；② 同码同 reason（`commission_rows=0/pool_in=100`）、0 行 ⇒ `zjhp.json` | **复现 ✓** |
| **T2** 已闭合后 `SET CONSTRAINTS ALL IMMEDIATE` | 必须抛 `LD032`（证明是「未闭合豁免」而非「IMMEDIATE 一律不判」） | 我先用自建闭合判据 SQL 量到 `closed_uid_minus2=true`（`bal 23 == 快照 23`）⇒ flush 抛 `LD032`/`COMMISSION_SPLIT_SUM_MISMATCH`（`event_closed:true`） | **复现 ✓** |
| **T3** 未闭合窗口逃逸（D7 形态） | post **之前**钉 IMMEDIATE ⇒ 不报；随后 flush ⇒ 仍不报 | 两种篡改形态各一腿：`immediate_before ok` → `post_while_immediate ok=true` → `flush_after ok=true`（**逃逸**）；flush 时 `-2` 账户已 `100==100`（闭合）仍不报 ⇒ 逃逸**只在未闭合窗口内**（与 T2 对照） | **复现 ✓** |
| **T4** D4/D5 的 `null` 含义 | 篡改 + 仅 `DEFERRED`（no-op）+ 回滚 ⇒ 不报（`null` = 闸无裁决机会） | `set_deferred_noop ok` → `post ok=true`（无任何 flush、随即 ROLLBACK）⇒ 全程无错 | **复现 ✓** |
| **T5** E4 反例 | 摘守卫后 `depth=0` ⇒ `23514`/`referral_depth_rng`；同杆 `depth=1` ⇒ 首插成功、重绑 `23505`/`referral_pk` | `depth=0` ⇒ **`23514` / `referral_depth_rng`**；`depth=1` ⇒ 首插 `ok=true`、重绑 **`23505` / `referral_pk`** | **复现 ✓**（ENABLE 半项未验证，见 §9） |
| **T6** 文本/代码核 | L455/L464/L474/L483 + D6 只登记不判；`0011` L54–56 与 L126–133；`grep -rn 'SET CONSTRAINTS' src` = 0 命中 | 逐字核对**全部命中**；`src` 命中数 **0**；D6 分支只有 `rec`、无 `judge`（详见 §5） | **复现 ✓**（含 1 处行号小节瑕疵） |
| **T7** `p1o-00` 复跑 | `--phase after --assert` ⇒ **exit 0** + 逃逸类计数 0 + `wrote_no_ledger_rows` | 我跑 **2 次，两次都 `EXIT=1`（RED）**；逃逸类计数**两次都全 0**；`wrote_no_ledger_rows=true`；红在 `unexpected_500`（4 与 13，成员两次不同） | **不复现 ✗**（RCA 的 `EXIT=0`/PASS 未复现） |
| **T8** 指纹不变量 | 跑前/跑后逐位相同 | `fn_fingerprints_identical / schema_reads_identical / registry_rows_identical / triggers_identical / cid1_conservation_identical` **全 `true`**；四编排函数 `51429/d94dd902…`、`30194/74841611…`、`17858/0e187c20…`、`13594/0cedbb9e…` 逐字同冻结值 | **复现 ✓** |

## §2 T1 详录（生产形态：真 `COMMIT`，非回滚）

**路径前置（任务书要求「先跑对照臂确认该路径能正常提交」）** —— 对照臂已先跑并**真提交**：

| 腿 | 动作 | 读数（`p3n-01-rca-legs-20260928T143826Zzjhp.json`） |
|---|---|---|
| **对照臂** | 真 `COMMIT`：事务内建夹具币 `cid 273`（`p3n196zzjhp`，supply 0）＋ 5 用户（`991025–991029`）＋ 邀请链 3 行 ＋ `mint`/`hold` ＋ 合法结算事件（10 分录 / 6 commission 行，`fee=100`、`M=3`、policy `fee_bp=100/levels=10`） | `commit_error=null`、`committed=true`、提交后 readback `biz:job:settle:991240001` = 1 行 ⇒ **该路径能正常提交** |
| **篡改臂 ①**（丢最后一对 commission） | 同构造，`entries 10→8`（丢掉的 2 条实测 `kind=commission`）、`tamper_valid=true`，事件级 `Σdelta` **不变**（`10000 → 10000`，= RCA 说的「Σ-中性」）⇒ `post.ok=true` ⇒ **`COMMIT`** | **`COMMIT` 抛** `sqlstate=LD032` / `message=LEDGER_RECONCILE_MISMATCH` / `reason=COMMISSION_SPLIT_SUM_MISMATCH`，detail：`pool_in=100, commission_out=77, commission_rows=2, event_closed=true, trigger_account_uid=-2, cid=273`；事后该事件键 **0 行**（零残留） |
| **篡改臂 ②**（只入不出） | 同构造保留前 4 条（`entries 10→4`，`tamper_valid=true`）⇒ `post.ok=true` ⇒ **`COMMIT`** | **`COMMIT` 抛** 同码同 reason（detail：`pool_in=100, commission_out=0, commission_rows=0, event_closed=true`）；事后 **0 行** |

- **纪律遵守（任务书 §T1 风险条款）**：① 独立夹具币（`cid 273` 自有 symbol）+ 独立 uid 窗口 `9910xx` ✓；② 对照臂先行 ✓；③ 两臂**均未**意外提交 ⇒ 未触发停手条款、无需登记残留坐标 ✓；④ 本单真库行增量全文登记于 §8。
- **附带独立证据（非 RCA 转抄）**：`event_closed:true` 出现在两臂的 detail 里 ⇒ 闸的判负确实发生在**事件闭合之后**，与 `0011` L54–56 的设计相符。

## §3 T2 / T3 / T4 详录（裁决落点对照：逃逸只在「未闭合窗口」内）

| 项 | 腿构造 | 实测读数 | 判定 |
|---|---|---|---|
| **T2** | 篡改①（8 分录）→ `post.ok=true` → **自建闭合判据 SQL** 量 `-2` 账户：`bal=23 / frozen=0` vs 同账户最新分录快照 `23 / 0` ⇒ `closed_uid_minus2=true` → `SET CONSTRAINTS ALL IMMEDIATE` | flush ⇒ `LD032` / `COMMISSION_SPLIT_SUM_MISMATCH`（`event_closed:true`） | **复现 ✓** ⇒ 规则是「**未闭合⇒豁免**」，不是「IMMEDIATE 一律不判」 |
| **T3** | post **之前** `SET CONSTRAINTS ALL IMMEDIATE` → 篡改②（4 分录）→ `post_while_immediate ok=true`（无错）→ 再 flush | `flush_after ok=true`（**仍无错**）；且 flush 前我量到 `-2` 账户已 `100==100`（`closed_uid_minus2=true`）⇒ **闭合之后也没有裁决机会** = 逃逸 | **复现 ✓** |
| **T3b** | 同 T3，改篡改①（8 分录）形态 | `post_while_immediate ok=true` → `flush_after ok=true`（**仍无错**） | **复现 ✓** |
| **T4** | 篡改① → **仅** `SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED`（对 INITIALLY DEFERRED = no-op）→ `post ok=true` → 无 flush → `ROLLBACK` | 全程无错、`rolled_back=true` | **复现 ✓** ⇒ `null` = 「闸没有裁决机会」，不是「事件被合法化」 |

**对照结论（T1 vs T2 vs T3）**：同一篡改载荷，**默认 DEFERRED + 提交/flush ⇒ 必判负（T1、T2）**；**提前钉 IMMEDIATE ⇒ 逃逸（T3/T3b）**，且逃逸窗口正好是「事件尚未闭合」的那一段。RCA 对 D7 的解释（探针把约束钉在 IMMEDIATE）**被独立复现**。

## §4 T5 详录（E4 反例：期望可达）

- `t5_e4_counterexample.depth0_leg`：`ALTER TABLE public.referral DISABLE TRIGGER trg_referral_cycle_guard` → `ok=true`；随后 `INSERT … (depth=0)` ⇒ **`23514`** / `constraint=referral_depth_rng` / `message="new row for relation \"referral\" violates check constraint \"referral_depth_rng\""` ⇒ **RCA 的「E4 输入错」成立**。
- `t5_e4_counterexample.depth1_leg`：同杆（守卫仍摘除）`depth=1` ⇒ 首插 **`ok=true`**，重绑同 child ⇒ **`23505`** / `constraint=referral_pk` / `"Key (child_uid)=(991035) already exists."` ⇒ **E4 的期望「修前形态」确实可达**，RCA 的反例成立。
- 两腿均在回滚事务内（零残留：`referral_my_window` 跑后 = 3，全是**对照臂已提交的邀请链**，T5 三腿贡献 0 行）。
- **诚实边界**：同事务内 `DISABLE TRIGGER` 我实测 `ok=true`；但 `ENABLE TRIGGER` 那一半我**未单独验证**（我的腿把 `ENABLE` 排在已失败语句之后 ⇒ 读到 `25P02`「current transaction is aborted」，这是**我的腿序**产物，不是对 RCA「ENABLE 也成功」的反证）⇒ 见 §9 未验证清单。

## §5 T6 详录（文本/代码核，逐字）

| 引用点 | RCA 的说法 | 我现读原文 | 判定 |
|---|---|---|---|
| `scripts/p2w-00-p2fix-verify.ts:455` | d3 只 `SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED` | `await tx.query(\`SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED\`);` | **一致** |
| `:464` | d4 同形（同为 DEFERRED、不 flush） | 同上逐字（d4 分支） | **一致** |
| `:474` | d5 在篡改 post **之前** `SET CONSTRAINTS ALL IMMEDIATE` | `const afterImmediate = await spQ(tx, \`SET CONSTRAINTS ALL IMMEDIATE\`);`（合法 post 之后、篡改 post 之前生效） | **一致** |
| `:483` | D6 分支「边界登记（**不判**）」 | 原文：`// ④ 边界登记（**不判**，如实登记）：强制 IMMEDIATE 期间，Σ 断言不再判负（本修法的设计代价）`；该分支只有 `rec('D6_boundary_immediate_tamper')`（`:491`）、**无 `judge`** ⇒ 只登记不判**成立** | **一致**（RCA 正文写「L484–491 的 D6」，而该**句子**在 `:483`、`:484–491` 是分支代码 —— **行号小节瑕疵**，实体结论不变） |
| `migrations/0011…sql:54–56` | 「强制 IMMEDIATE 的会话里…收尾之前不再判负…**默认 DEFERRED 路径的判负能力逐字不变**」 | `:54–55` 逐字即上述引文，`:56` 续「（COMMIT 时事件必已闭合 ⇒ 判据恒成立 ⇒ 与 `0007` 行为一致…）」 | **一致** |
| `0011:111 / :126 / :128–133 / :135` | `:126` 算「是否已闭合」；`:128–133` 未闭合 `RAISE NOTICE … skip`；`:135` 才 `ledger_raise` | `:111 IF v_pool_in <> v_paid_out THEN` · `:126 v_closed := COALESCE(v_acct_bal = v_new_bal AND v_acct_frz = v_new_frz, false);` · `:128 IF NOT v_closed THEN` `:130 RAISE NOTICE '…event not closed, skip Σ check…'` `:132 RETURN NULL;` · `:135 PERFORM ledger_raise('LEDGER_RECONCILE_MISMATCH', jsonb_build_object(` | **一致** |
| `grep -rn 'SET CONSTRAINTS' backend-ts/src` | 0 命中 ⇒ 应用路径把约束钉 IMMEDIATE 的形态**不可达** | 我现跑：**0 命中**（grep 退出码 1） | **一致** |
| 判定行号 L498/L501/L505/L539/L574 | D4/D5/D7/E4/F3 的 `judge` 位置 | 逐条命中（`:498` D4、`:501` D5、`:505` D7、`:539` E4、`:574` F3） | **一致** |

## §6 T7 详录（`p1o-00` 复跑 —— 本单唯一**不复现**项）

命令（逐字，退出码**未取自管道之后**）：
```
cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert > /tmp/p1o_neng.out 2>/tmp/p1o_neng.err; echo "EXIT=$?"
```

| 次 | exit | stdout/stderr | artifact | aggregates（实测） | verdicts |
|---|---|---|---|---|---|
| **我-1** | **`EXIT=1`** | 4607 B / 0 B | `.p1f-artifacts/p1o-00-escape-sweep-after-MULCT7CG.json` | `cells_total 604 / executed 590 / skipped 14 / thrown 519 / no_throw 85`；**逃逸类**：`raw_sqlstate_escapes 0`、`unmapped 0`、`missing_status 0`、`ld_sqlstate_leaked 0`、`valid_shape_false_reject 0`；**`unexpected_500 4`、`expectation_mismatches 2`** | `…_zero` 四项 **true**；`no_unexpected_500_from_caller_input` **false**、`all_cells_match_expectation` **false**；`escape_cells []` |
| **我-2** | **`EXIT=1`** | 4958 B / 0 B | `.p1f-artifacts/p1o-00-escape-sweep-after-MULCZVYR.json` | `604/590/14/518/86`；逃逸类**同全 0**；**`unexpected_500 13`、`expectation_mismatches 3`** | 同形：四项 true，两项 **false**；`escape_cells []` |
| 对照（**只读** Kong 的既有件） | RCA 称 0 | — | `.p1f-artifacts/p1o-00-escape-sweep-after-MULC8WT7.json` | `604/590/14/518/86`；`unexpected_500 0`、`expectation_mismatches 0` | 六项 **全 true** |

- **两次红的成员（实测，且两次不相同）**：
  - 我-1：`E-W3_freeze/amount/over_bigint_far` 与 `E-W5_settleFrozen/amount/undefined` ⇒ 均 `LEDGER_TRANSACTION_REQUIRED / status 500 / reason=unclassified_non_pg_error`（期望 `must_400/LEDGER_AMOUNT_INVALID`）。
  - 我-2：`E-W1_transfer/amount/bigint_max_plus_1`、`E-W1_transfer/amount/over_bigint_far`、`E-W4_unfreeze/amount/scientific_1e5` ⇒ 同一族（`unclassified_non_pg_error` / 500）。
  - ⇒ **红在 500 族且成员逐次漂移**（非确定性），**逃逸类 4 项两次都干净**。这与本机已登记的连接层非确定性缺陷（非 PG 异常 ⇒ 非 PG 错误分类）**同形**，但我**不能**就此断定成因（未取证到驱动栈）⇒ 登记为未定位。
- **复现结论**：RCA 的 T7 读数（`EXIT=0` + `expectation_mismatches 0` + 「PASS 可复现」）**在我 2/2 次运行中不复现**；但其「**逃逸类计数 0**」与「**`wrote_no_ledger_rows=true`**」两项**复现**（两次 `ledger_entry 3201 → 3201`）。按 §5.7 ⑨（样本量 1 不得推翻多次观测、反之亦然）：我报 **2/2 红 vs 其 1/1 绿**，不断言其那次绿态为伪造，但断言**其「PASS 可复现」不成立**。

## §7 T8 详录（指纹不变量：跑前/跑后逐位相同）

`p3n-01-rca-legs-…zjhp.json` 的 `t8_invariants` **五项全 `true`**：

| 不变量 | 跑前 = 跑后（实测值） |
|---|---|
| 四编排函数 `octet_length`+`md5` | `ledger_post_event 51429 / d94dd902697dfe60aba409d808c6d63a`、`market_post_event 30194 / 74841611252726e1cc0f57cb46ea6c6d`、`listing_post_event 17858 / 0e187c20b56d45202d83978c8a02b31d`、`job_post_event 13594 / 0cedbb9ea60dcbda28e3ef3dafdd119b` —— **与任务书/RCA 冻结值逐字相同** |
| 守恒断言函数 | `ledger_assert_commission_conservation 2967 / 27ddc76b842594cb6ee8673c171e6526`、`referral_cycle_guard 6075 / 7bd5874f7145989a43567003048a9f04`（同值） |
| 守恒触发器 | `trg_ledger_entry_commission_conservation`：`tgenabled='O'`、`deferrable=true`、`initdeferred=true`、约束侧 `contype='t'` / `TRIGGER DEFERRABLE INITIALLY DEFERRED`；`public` 非 internal 触发器 **44/44 全 `tgenabled='O'`**（跑前跑后同） |
| `schema_version` / registry | **库内不存在 `schema_version` 键值表**（现取 `public` 内匹配 `%schema%/%version%/%meta%` 的表只有 `schema_migration`）⇒ 我改口径为 registry：行数 **17**、`max(version)='0017'`（跑前跑后同）⇒ RCA 的「`schema_version=0017`、registry 17 行」**等价成立** |
| `cid=1` 守恒 | `symbol=$`、`total_supply 8400 == SUM(balance+frozen) 8400`（跑前跑后同；末次复核 §8 仍 `8400 == 8400`） |

## §8 真库行增量登记（本单真跑，口径 `SELECT count(*) FROM public."<表>"`）

| 阶段 | users | account | ledger_entry | referral | currency | commission_policy | registry | `cid=1` 守恒 |
|---|---|---|---|---|---|---|---|---|
| 跑前（zjhp 开跑，含我两跑之前的一切） | 578 | 351 | 3188 | 290 | 111 | 25 | 17 | `8400 == 8400` ✓ |
| **我跑 ①对照臂（真 COMMIT）** | +5 | +6 | +13 | +3 | +1 | 0 | 0 | 未破 |
| **我跑 ①篡改臂 ①②（真 COMMIT，被拒）** | 0 | 0 | **0** | 0 | 0 | 0 | 0 | 未破 |
| zzjhp 收尾实测 | 583 | 357 | 3201 | 293 | 112 | 25 | 17 | `8400 == 8400` ✓ |
| **我跑 ②`p1o-00` ×2**（套件自产币/账户；`wrote_no_ledger_rows=true`） | 0 | **+8** | **0** | 0 | **+2** | 0 | 0 | 未破 |
| 末次只读快照（`p3n-02-counts…ckl5.json`，14:51:21Z） | 583 | 365 | 3201 | 293 | 114 | 25 | 17 | `8400 == 8400` ✓ |
| **本单净增量** | **+10** | **+20** | **+26** | **+6** | **+4** | **0** | **0** | **未破** |

**逐项归因（自产残留坐标，全部现取）**
- 我自己的两个对照臂提交残留（**唯一**由我的探针写库的部分）：
  - `currency cid 272 / symbol p3n196zl7ik / supply 1000000`（第 2 跑 l7ik 的对照臂）＋ `currency cid 273 / symbol p3n196zzjhp / supply 1000000`（zjhp 对照臂）；
  - `users 991037–991041`（第 1）＋ `991025–991029`（第 2）＝ **10 行**；`referral` 邀请链 3+3 = **6 行**；`ledger_entry` 13+13 = **26 行**（各跑 10 条结算事件 + 3 条 mint/hold），现取 `my_keys_ledger = 26` ✓；
  - `account` 各 6 行（`cid 272/273`）＝ **12 行**。
- **篡改臂零残留（关键）**：两臂 `COMMIT` 被拒后，`biz:job:settle:991240002` / `…991240003` 现取 **0 行**；`mint`/`hold` 同事务回滚 ⇒ 无任何半成品行。**`ledger_entry` 无不可删的脏行**。
- `p1o-00` 两次跑：`ledger_entry` 0 行（两次都 `3201 → 3201`）；自产 `currency cid 274 / P1PMULCT7CG`、`cid 275 / P1PMULCZVYR`（`owner 948001`、`supply 0`）＋ `cid 274/275` 上各 4 账户由快照归因（`P1P%` 币合计 48 账户 —— 含他单/他跑的累计，非我独有）。
- `1909xx`/他单命名空间：**未触碰**（旧窗口 `9903–9906/9908xx/9909xx`、前缀 `p3p:/neng17:/p3q:/kong18:/p3r` 我一律未用；未读作证据）。
- **零删除**：全程无 `DELETE/TRUNCATE/DROP/ALTER` 既有表（仅事务内、回滚的 `ALTER TABLE referral DISABLE/ENABLE TRIGGER`，属 T5 腿设计）。

## §9 §5.7 硬口径遵守 + verdict + 未验证清单 + 探针缺陷自曝

### 9.1 硬口径遵守

| # | 硬口径 | 遵守情况（带证据） |
|---|---|---|
| ① | 保留字对象断言加引号 | 全部 SQL 显式限定 `public.` 且表名加引号（`public."users"` 等）；本库 `users` 非保留字对象，未对保留字命名对象断言 |
| ② | 退出码不得取自管道之后 | `p1o-00` 两次、`p3n-01/02` 均用 `> file 2>file; echo "EXIT=$?"`；**无** `\| tail` 后退码 |
| ③ | 本机无 `timeout`/`gtimeout` | 未使用任何限时命令 |
| ④ | 含违规形态的读数作废重跑 | 我第 1 跑（`CRASHED`，探针缺陷 #1）、第 2 跑（`HALTED`，探针缺陷 #2）读数**判无效并重跑**，只以 `…143826Zzjhp.json` 收结论（§9.3） |
| ⑤ | 先落盘骸架、逐段回写 | 报告首次 `write_file` 落 10 节骨架（判定项全 `NOT_MEASURED`），随后逐段回填；探针侧 `checkpoint()` 每腿回写同一 run 文件（首写 `flag:'wx'` 同名拒写） |
| ⑥ | run-tagged、同名拒写、不覆盖被验证方原始件 | 3 个 `.p3n-artifacts/*` 全 run-tagged；`.p2w/.p3r/.p3q/.p1f` 既有文件**只读**；套件自产**新**件（`MULCT7CG`/`MULCZVYR`）已登记 |
| ⑦ | 读数异常先怀疑自己的探针 | 第 1 跑崩 ⇒ 判定为**我的表名假设错**；第 2 跑误停 ⇒ 判定为**我的 drop 过滤签名错 + 停手判据过宽**；`p1o-00` 红**未**归因给实现（见 §6，成因未定位即写未定位） |
| ⑧ | 强命题必举反例 | 对「E4 期望可达」当场举反例（同杆 `depth=1` ⇒ 首插成功、重绑 `23505/referral_pk`，§4）；对「闸会判负」给出 4 条正例 + 1 条对照绿例（§2/§3） |
| ⑨ | 样本量 1 不推翻多次观测 | T7：我 2/2 红 vs RCA 1/1 绿 ⇒ 我**只**否定「PASS 可复现」，**不**断言其绿态不存在；连接层非确定性登记在案 |

### 9.2 未验证清单（枚举到边界；未实测写 `NOT_MEASURED`，禁 0/空数组占位）

- `ENABLE TRIGGER` 同事务内可用性（RCA §3 第 4 条那一半）：`NOT_MEASURED`（我的腿序使其读到 `25P02`；`DISABLE` 已实测 `ok=true`）。
- `p1o-00` 两次红的**成因**（是否=已登记连接层非确定性缺陷）：`NOT_MEASURED`（未取到驱动侧栈；我只记录读数与漂移特征，不填成因）。
- 我原计划捕获的 `RAISE NOTICE … skip Σ check` 文本（T3 逃逸的内部通知）：`notices = []` —— 驱动未回调通知（我挂了 `pool.on('notice')` 但**零条到达**）⇒ 该证据链**缺失**，我改用「自建闭合判据 SQL」替代（§3）。
- `p2w-00-p2fix-verify.ts` 全套跑（D1–D7/E/F/G 判据）：`NOT_MEASURED`（我只核文本行号 + 自行复现其载荷形态，未跑该套件）。
- D1/D2/D3 与 E1/E2/E3/F1/F2/G1–G3 等其余判据：`NOT_MEASURED`（不在八项决定性 leg 内）。
- 端口/PID：本单**未起任何常驻 server** ⇒ `null`（无端口、无 PID；`p1o-00` 与我的探针均为一次性进程，已自行退出）。
- 其他单元/其他跑的残留归因（`.p2w/.p1t/.p2c/.p2d` 既有件、`9909xx` 窗口等）：`NOT_MEASURED`（只读且未逐一 `sha256` 比对；`git status` 未见我对它们产生变更）。
- RCA 正文的「24 条分录 / 20 条 commission」具体条数：`NOT_MEASURED`（我复现的是**同形态**：我 10 分录 / 6 commission，因 policy `levels=10`、链深 3 ⇒ 结论同形但条数不同）。

### 9.3 探针缺陷自曝（有 ⇒ 登记并重跑）

1. **缺陷 #1（我的表名假设错）**：首跑用 `SELECT … FROM public.schema_version WHERE key='schema_version'` ⇒ `relation "public.schema_version" does not exist` ⇒ 脚本崩在 T8-before（产出 `CRASHED/CRASH-main` 骸架，未丢证）。**改正**：改为**发现式**读取（按 `%schema%/%version%/%meta%` 枚举真表 + `to_regclass` 容错）。**重跑**：✅（骸架纪律生效，崩在半途仍留证）。
2. **缺陷 #2（我的 drop 过滤签名错 + 停手判据过宽）**：`entries.filter((_e,i,n) => i < n-2)` 里的 `n` 是**数组本身**而非长度 ⇒ 篡改载荷变成**空数组** ⇒ post 被 `LD016/NOT_A_NON_EMPTY_ARRAY` 拒（不是 Σ 闸），而我的停手判据只看「COMMIT 未抛」⇒ **误报 HALTED_TAMPER_COMMITTED**（`…l7ik.json`）。**改正**：`arr.length`；停手判据加「`post.ok===true` ∧ 提交后该事件键行数 > 0」的**库侧复核**；并新增 `tamper_valid` 自证字段（丢出的必为 commission、剩余非空、事件级 `Σdelta` 不变）。**重跑**：✅（`…zjhp.json`，`tamper_valid=true`，两臂均被 `LD032` 拒）。**该次误停的对照臂已真提交 ⇒ 其 13 行已并入 §8 增量，未隐藏。**
3. 探针缺陷 #3（记录，未致读错）：通知捕获 `pool.on('notice')` 挂上了但**零条到达** ⇒ T3 的 `NOTICE` 证据缺失，已用替代证据补齐（§3、§9.2）。

### 9.4 终局 verdict

**`部分可用`**

- **可用面（6/8 决定性 leg 独立复现）**：T1（真 `COMMIT` 下两形态**必被 `LD032`/`COMMISSION_SPLIT_SUM_MISMATCH` 拒、零残留**）、T2、T3、T4、T5、T8 —— RCA 的**核心定案**（五条 reds 是探针口径错、**零真缺陷**；闸真在、真会判负、且判负点是唯一的「延迟约束结算点」；逃逸只在未闭合窗口且应用路径（`src` 0 命中 `SET CONSTRAINTS`）不可达）**由我自建夹具/探针独立复现**，其 §1–§4 的根因解释成立；其引用的行号与文本（T6）逐字核对**全部命中**。
- **不可用面（1/8 决定性 leg 不复现）**：**T7** —— RCA §5 断言 `p1o-00 --phase after --assert` 为 `EXIT=0`/PASS 且可复现；我 **2/2 次都是 `EXIT=1`（RED）**（`unexpected_500` 4 与 13、`expectation_mismatches` 2 与 3，成员逐次漂移），故 `--assert` **收红**。其「逃逸类计数 0」「`wrote_no_ledger_rows`」两项复现，**但它据此写下的「PASS 可复现」这一条不成立**（成因未定位，登记为未验证边界）。
- ⇒ 判定其交付物**部分可用**：可直接采信其 Σ 闸/探针口径的根因定案与 T1–T5/T8 事实；**但其 §5 的 `p1o-00` PASS 结论必须撤回或重测**（该套件当前在我方环境下 `--assert` 不稳定收红，红在 500 族而非逃逸类）。
- 一行提醒：`部分可用` 的天平完全落在 **T7 这一条**上；若裁定人认为 `p1o-00` 的 500 族红与本机已登记连接层缺陷同源（我未取证，故不代裁），则本 report 的 verdict 可上调为 `可用`；反之若要求「逃逸类 0」以外的全绿，则该 RCA 的 PASS 结论应判 `不可用`。
