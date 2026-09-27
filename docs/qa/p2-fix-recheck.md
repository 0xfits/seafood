# P2「十级返佣」· 修复轮**独立复检**报告（Neng · 结论：**可通过**）

> **范围声明（必读）**：本文件是**新的复检文件**，覆盖对象是**修复轮**（HEAD = `647851f`）交付的
> `backend-ts/migrations/0011_commission_assert_closure_and_referral_depth_guard.sql`（已应用）
> 与 `backend-ts/src/commission.ts`（改动）。**as-found 报告 `docs/qa/p2-commission.md` 一字未改**
> （本轮复算 sha256 = `8030c1b1f467eef0844b28cdda93c9048e04840b4221202efc0fc65bbba7ab25`，与交接值一致）。
> **我不采信实现方自报**（Kong 本轮报告全空），本文件一切读数由我自己的探针现场落盘（附录 A 可核）。

| 项 | 值 |
|---|---|
| 开工时 `git log --oneline -1` | **`647851f fix(P2): 质检六项缺陷修复轮（0011 + 佣金层）+ 质检报告落盘`** |
| `647851f` 的父提交 | `6f62954 test(P2): 独立质检（不通过）+ 探针可重跑性修复 + 触发器启用态常态判据` |
| 被检 `src/commission.ts` sha256 | `7b5ff9b36bfd7a34899145e7c1c5e61fe9522a8c446c82ae522b9efa5bf48d02` |
| 被检 `0011_*.sql` sha256（盘上 = 库内 checksum） | `238f96ae42298f85c03ffe08973eccb01bc560b9751ac752af769154f2583dfe` |
| `schema_version` | `0011` |
| 复检时刻 | 2026-09-27 19:4x–19:5x CST（UTC 11:41–11:49） |
| 结论 | **F1 / F2 / F3 / F6 / F7① / F7② / 迁移底线 七条全部「真生效」⇒ P2 验收可通过**（附 §⑨ 残余风险与未验证项） |

---

## ① 复检方法、隔离契约与"我做了什么"

**夹具全新（硬约束）**：uid 一律 **958xxx**（开工基线读数：`referral` 内 958xxx 行 = **0**、
`users` 内 958xxx 行 = **0**、`currency` 内 `p1x%` 币 = **0** ⇒ 我拿到的是**干净窗口**）；
symbol 前缀 **`p1x`**；辅助幂等键前缀 **`ops:p1x:`**；业务键 `biz:job:settle:<job>`，
job_id 由 `958300000000000 + sha256(RUN)` 派生（每 RUN 全新事件，不落回幂等重放）。
**唯一会提交**的用例是 F7②（需要真账读数），其 uid 由 `sha256('f7b'+RUN) % 700` 派生 ⇒
**每个 RUN 独占新命名空间**（避免重演 `p1t-00` / `p2w-00` 的「夹具不可复位」）。

**破坏性动作纪律**：`ALTER TABLE … DISABLE TRIGGER` / 直插环 / `UPDATE referral SET depth`
**全部在事务内**（`BEGIN … ROLLBACK`）；每条**会失败**的 SQL 都包在 `SAVEPOINT` 里
（一次报错整事务 `aborted` ⇒ 后续格子全是假读数，这是我上一轮的坑）。末尾逐次复检
**7 个用户触发器启用态**与**我的分区指纹**（**不用全表 hash**：本轮实测到其他会话并发写同一库，
`ledger_entry` 总行数在我取证窗口内由 **1996 → 2028**，全表 hash 不可能是复原判据）。

**工具注意（诚实登记）**：本机 **没有** `timeout` / `gtimeout`（`which timeout gtimeout` 皆空）
⇒ 我用各自命令自身的退出码判绿（`<cmd>; echo $?`），**退出码一律取自命令本身、不取自管道之后**
（唯一例外：两处为压缩输出用了 `| head`，故显式改用 `${PIPESTATUS[0]}`）。

**F8 纪律（上一轮打我自己那条）**：本轮所有探针的类型检查**显式列文件**，不依赖 `tsconfig.json`
的 `include`：
`npx tsc --noEmit --strict --esModuleInterop --skipLibCheck --target ES2020 --module commonjs --moduleResolution node --resolveJsonModule scripts/p2qa-lib.ts scripts/p2qa-1*.ts` → **exit 0**；
`npx tsc --noEmit -p tsconfig.json`（src）→ **exit 0**。
（过程中确实抓到我自己 2 个类型错——`p2qa-10:58` 索引签名、`p2qa-14:49` 的 `bigint + number`——已修好并复跑到 0。）

**未做的**：未改任何 `src/**`、`migrations/**`、`docs/**`、`frontend/**`；未 commit/push；未启停服务。
（**提醒**：取证期间工作树里 `backend-ts/scripts/p2w-00-p2fix-verify.ts` 处于 `M` 状态 ——
**不是我改的**，我一次都没碰它；按提交信息该脚本第二跑会 FATAL ⇒ 它的读数我不引用。）

---

## ② F1（最重）链断言**落账前**拒结 —— ✅ **真生效**

**最小复现**（`scripts/p2qa-11-f1-f7.ts`，事务内、末尾 ROLLBACK）：
`BEGIN` → 建 `users`/`currency` → `ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`
→ 直插 2-环 `958501↔958502`（`depth=1`；**注**：DISABLE 该触发器会同时关掉它的 depth 计算，
故直插必须自带通过 CK `referral_depth_rng` 的 depth）→ 调**结算入口** `settleJobCommission()`
（`workerUid = 958501`，`ex` = 本事务客户端）→ 末尾整事务 `ROLLBACK`。

**链真的坏了**（原始读数）：
```json
"chain_nodes": [{"958502",1},{"958501",2},{"958502",3},{"958501",4},{"958502",5},{"958501",6},
                {"958502",7},{"958501",8},{"958502",9},{"958501",10}],
"chain_assertions": {"contiguous_levels":true,"within_cap":true,"all_user_uids":true,"no_duplicate_uid":false},
"worker_self_on_chain": true, "triggers_during": [{"trg_referral_cycle_guard","D"}]
```

**结算入口的原始读数**（`p2qa-11-f1-f7-20260927T114432Zlesf.json`）：
```json
"settle_entry_call": { "threw": true,
  "err": { "ts_code": "LEDGER_RECONCILE_MISMATCH", "http": 500, "status_field": null,
           "httpStatusOf_code": 500,
           "details": { "reason": "COMMISSION_CHAIN_ASSERTION_VIOLATED",
                        "failed_assertions": "no_duplicate_uid", "failed_count": 1,
                        "chain_depth": 10, "chain_truncated": true, "within_cap": true,
                        "worker_uid": "958501", "job_id": "958300338027167",
                        "chain_nodes": "1:958502,2:958501,…,10:958501" } } }
```

| 必验项 | 读数 | 判 |
|---|---|---|
| 500 类（`httpStatusOf` 得出 500） | `http: 500`、`httpStatusOf('LEDGER_RECONCILE_MISMATCH') = 500`、`status_field = null`（靠 defect 兜底，非 4xx） | ✅ |
| 码是**既有闭集**内的 `LEDGER_RECONCILE_MISMATCH` | `LEDGER_ERROR_CODES.length = 33`；`httpStatusOf_LD032 = 500`、`bucket = defect`、DB 侧 `ledger_error_for_sqlstate('LD032')->>'bucket' = 'defect'` | ✅ |
| **不得新增码** | `has_chain_assertion_violated_as_code = false`、`has_replay_inconsistent_as_code = false`（两个新常量都只是 `details.reason`，不是 `LEDGER_ERROR_TABLE` 的键） | ✅ |
| `details.reason = COMMISSION_CHAIN_ASSERTION_VIOLATED` | 见上 | ✅ |
| `details.failed_assertions` 能指出**哪一个**失败 | 上例 = `no_duplicate_uid`；矩阵（`p2qa-13`）逐格点名：`contiguous_levels` / `all_user_uids` / 两两 / 三者全列 + `failed_count=3` | ✅ |
| **真的没有落账** | `ledger_entry_before = 2021`、`ledger_entry_after = 2021`、`rows_for_settle_key = 0`、`unchanged = true` | ✅ |
| `within_cap === false` **不**硬拒 | `assertReferralChainInvariants` 传 `{within_cap:false}`（其余 true）⇒ **不抛**；`{within_cap:false + no_duplicate_uid:false}` ⇒ 抛且 `failed_assertions` 只列那三条（不列 within_cap） | ✅ |
| 真链超 cap 不硬拒（设计内） | policy 37 `levels=10` × **12 级真链**：`planJobSettlement` **正常出计划**（`chain_truncated=true`，不抛） | ✅ |

**判负对照（证明闸是承重的，不是"没测到"）**：同事务内用 2-环链（重复受益人，含打工人本人）
手工拼出 `Σ x == P` 的载荷直投 `ledger_post_event` ⇒
```json
"db_control_duplicate_beneficiary_accepted": { "posted_ok": true, "error": null,
  "duplicate_beneficiary_uids": ["958502","958501","958502","958501",…×10] }
```
⇒ **DB 侧只保总量不保归属（F4 的契约事实）仍然成立**，所以 F1 的应用层闸是**唯一**拦住静默错付的东西，
且它现在**真的会拦**（上表）。这条同时说明：as-found 的 F1 复现路径已从「静默 `posted_ok:true`」变成
「落账前 500」。

**残余（登记，不扣分）**：闸只有**一处**（`planJobSettlement`）。任何绕过该函数、直接构造 payload
调 `ledger_post_event` 的路径（例如自写脚本）仍会被 DB 接受 —— 上面那条对照就是证据。
⇒ 归属不变式**不是 DB 层强制**的，这是契约层（F4）范围，本单未改契约。

---

## ③ F7② replay 的 `plan` 由**账上事件**导出 —— ✅ **真生效**

**最小复现**（`scripts/p2qa-11-f1-f7.ts` 的 `F7_replay`；**真提交**，本分区）：
policy 表有多个版本，`T_ALT = 2026-09-27 10:56:39.93+00` 落在 **policy 35（500bp / levels 9）** 的生效窗口，
而 `now` 生效的是 **policy 37（100bp / levels 10）**。同一 job、同一幂等键、**同一指纹**
（`settleJobFingerprint` 只含 job/employer/worker/cid/gross ⇒ 传不同 `at` 不退化成 409）：

1. `call1`：`at = T_ALT` ⇒ 按 policy **35**（500bp）**首写提交**；
2. `call2`：`at = null`（= policy **37**，100bp）⇒ 同一事件重放；
3. `call3`：`at = T_ALT` ⇒ 完全同参重放（"正常 replay 不误报"的最强形态）。

**原始读数**：
```json
"call1": {"fee":"50000","net":"950000","plan_source":"computed","plan_policy_id":"35","replay":false},
"call2": {"fee":"50000","net":"950000","plan_source":"replayed_from_ledger","replay":true,
          "plan_policy_id":"ledger_replay","plan_policy_reported":false,
          "layers":[{"level":1,"uid":"958638","x":"25000"},{"level":2,"uid":"958639","x":"25000"}]},
"call3": {"fee":"50000","plan_source":"replayed_from_ledger","replay":true},
"ledger_rows_after_call1": ["958636:job_payout:0","958637:job_payout:950000","958636:job_fee:0",
                            "-2:job_fee:50000","-2:commission:-25000","958638:commission:25000",
                            "-2:commission:-25000","958639:commission:25000"],
"now_policy_recompute_fee": "10000",     // 若按当前政策重算 ⇒ 10000（= as-found 的旧错值）
"ledger_entry_total_after_call1": 2018, "ledger_entry_total_after_call2": 2018, "rows_not_doubled": true
```
| 必验项 | 读数 | 判 |
|---|---|---|
| `plan_source` 能分辨 `computed` / `replayed_from_ledger` | call1 = `computed`；call2/call3 = `replayed_from_ledger` | ✅ |
| **现在必须两者一致**（旧行为：返回 10000 而账上 50000） | 返回 `fee = 50000` = 账上 `pool_in/commission_out = 50000`；`plan_fee_eq_ledger_commission_out = true`；**不再是 10000** | ✅ |
| 层与账**逐行同源** | `call2.plan_layers` = `[1:958638:25000, 2:958639:25000]` ≡ 账上两条 `commission` 增方（`call2_layers_match_ledger_credits = true`，层号由 `memo` 解析 `level_source='memo'`） | ✅ |
| 政策占位**不撒谎** | `policy_id = 'ledger_replay'`、`policy_reported = false`（账本不落政策 ⇒ 显式标不可得，而不是拿当前政策冒充） | ✅ |
| `COMMISSION_LEDGER_REPLAY_INCONSISTENT` **不误报** | call1/call2/call3 **全部 `ok:true`、零异常**（`no_false_replay_inconsistent = true`） | ✅ |
| 该守卫**不是死分支**（额外加固） | `p2qa-14`：对同一真实事件传**错 worker** ⇒ 必抛 `LEDGER_RECONCILE_MISMATCH`(http 500) + `reason = COMMISSION_LEDGER_REPLAY_INCONSISTENT`（`net:0 / fee:50000 / employer_frozen_out:1000000`）；传对 worker ⇒ 不抛 | ✅ |
| 重放不重复落账 | 账上总行数 2018 → 2018、`rows_not_doubled = true` | ✅ |

---

## ④ F7① `chain_truncated` 能分辨「恰好 cap」与「≥ cap」 —— ✅ **真生效**

**最小复现**（`p2qa-11` 的 `F7_truncation`，事务内 ROLLBACK）：
按合法协议（先绑父、再绑子）在事务内建两条真链 ——
**12 级链**（叶 `958511`，祖先 `958512…958523`）与**恰好 10 级链**（叶 `958524`，祖先 `958525…958534`，
最上级是根）。
```json
"w1_12deep_cap10": {"nodes_len":10,"chain_depth":10,"truncated":true ,"last_node":"958521"},
"w2_10deep_cap10": {"nodes_len":10,"chain_depth":10,"truncated":false,"last_node":"958534"},
"w1_12deep_cap12": {"nodes_len":12,"chain_depth":12,"truncated":false,"last_node":"958523"},
"w2_10deep_cap11": {"nodes_len":10,"chain_depth":10,"truncated":false},
"w1_12deep_cap3":  {"nodes_len":3 ,"chain_depth":3 ,"truncated":true },
"plan_w1_chain_truncated": true, "plan_w2_chain_truncated": false,
"binds_failed": []
```
| 必验项 | 读数 | 判 |
|---|---|---|
| 12 层真链 + cap=10 ⇒ 可分辨为「被截断」 | `truncated = true`（`chain_depth` 仍是 10 —— **旧字段语义未动**，纯新增字段） | ✅ |
| 恰好 10 层链 + cap=10 ⇒ 「恰好 cap」 | `truncated = false`（**两者 `chain_depth` 都是 10** ⇒ 只有新字段能分辨，正是 F7① 的诉求） | ✅ |
| cap = 链长（12） ⇒ 不误报截断 | `truncated = false` | ✅ |
| plan 级也带上该字段 | `plan.chain_truncated`：12 级链 = true、10 级链 = false | ✅ |
| 边界（cap 3 / cap 11） | `cap3 → truncated=true`（截断）、`cap11 → truncated=false`（链短于 cap，且不做多余往返） | ✅ |

---

## ⑤ F3 延迟 Σ 断言：IMMEDIATE **不再假报**，真 Σ 不符**仍必须** LD032 —— ✅ **真生效**

**最小复现**（`scripts/p2qa-12-f3-f6-f2.ts`，全事务内 ROLLBACK）：
① **免疫**：`SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE` **先于**落账，
再投一份**合法平衡**的真结算载荷（policy 37、gross 10000 ⇒ fee 100 / net 9900 / M=2 / x=[60,40]）。
② **真缺陷（总量形态）**：`E job_fee frozen −1000` + `-2 job_fee +1000`（事件 Σ=0、有入无出）。
③ **真缺陷（保平衡形态）**：`E job_fee frozen −1000` + `-2 job_fee +1000` + `-2 commission −900`
+ `A1 commission +900`（整事件 Σ(delta+frozen)=0，但佣金少分 100）。
②③ 均先按**默认 DEFERRED** 落账，再 `SET CONSTRAINTS … IMMEDIATE`（= 事件**已闭合**后强制结算）。

```json
"f3a_immediate_before_post_balanced": {"posted_ok": true, "error": null,
   "as_found_old_reading": "LD032 COMMISSION_SPLIT_SUM_MISMATCH（pool_in=1000 / commission_out=0 / commission_rows=0）"},
"f3b_total_shape_pool_in_no_out": {"posted_ok": true, "posted_err": null,
   "forced_check_error": {"sqlstate":"LD032","message":"LEDGER_RECONCILE_MISMATCH",
     "detail":{"reason":"COMMISSION_SPLIT_SUM_MISMATCH","pool_in":"1000","commission_out":"0",
               "commission_rows":"0","job_fee_rows":"1","event_closed":"true",
               "trigger_account_uid":"-2","trigger_account_cid":"191"}}},
"f3c_balanced_shape_short_split": {"posted_ok": true, "posted_err": null,
   "forced_check_error": {"sqlstate":"LD032","detail":{"reason":"COMMISSION_SPLIT_SUM_MISMATCH",
     "pool_in":"1000","commission_out":"900","commission_rows":"1","event_closed":"true"}}},
"plan_good": {"fee":"100","net":"9900","M":2,"layers":["958603:60","958604:40"],
              "assertions":{"entry_count":8,"sum_delta_frozen":"0","commission_rows":4,"sum_x_equals_pool":true}}
```
| 必验项 | 读数 | 判 |
|---|---|---|
| 旧读数是 `pool_in=1000 / commission_out=0`（假报） | 同一构造现在 `posted_ok = true`、**无 LD032** | ✅ 假报已消 |
| 判负对照**必须仍有观测力**：总量形态 | `LD032` + `COMMISSION_SPLIT_SUM_MISMATCH` + `commission_out=0 / commission_rows=0`，且 `event_closed='true'` | ✅ |
| 判负对照：保平衡形态（Σ 平衡但少分） | `LD032` + `pool_in=1000 / commission_out=900`（`reason_is_split_sum_mismatch = true`） | ✅ |

> **这两条对照很关键**：`f3b` 的读数签名（`pool_in=1000 / commission_out=0 / commission_rows=0`）
> **与 F3 的中途假报逐字段相同** —— 唯一区别是 0011 新增的 `event_closed` 判据把它们分开了。
> 也就是说：修法不是「把断言放宽」，而是「只在事件闭合时判」，**对真缺陷的判定力逐字保留**。

---

## ⑥ F6 `already-bound` 两路**同码同 reason** —— ✅ **真生效**

**最小复现**：事务内先合法绑 `958611 → 958612`，再分别用 ① 裸 `INSERT` ② `referral_bind()`
把同一个 child 改绑到 `958613`（每条失败语句包 `SAVEPOINT`）。
```json
"raw_insert_rebind":  {"sqlstate":"LD003","message":"LEDGER_IDEMPOTENCY_CONFLICT",
                        "detail":{"path":"trg_referral_cycle_guard","reason":"REFERRAL_ALREADY_BOUND",
                                  "child_uid":"958611","bound_parent_uid":"958612","requested_parent_uid":"958613"}},
"referral_bind_rebind": {"sqlstate":"LD003","reason":"REFERRAL_ALREADY_BOUND", "(同上，无 path 字段)"},
"same_code_and_reason": {"same_code": true, "same_reason": true,
   "as_found_old": "LD003/REFERRAL_ALREADY_BOUND（bind） vs 23505/referral_pk、reason=null（裸 INSERT）"},
"fresh_child_raw_insert_allowed": {"ok": true, "depth": "1"}     // 对照：闸不是「恒拒」
```
| 必验项 | 读数 | 判 |
|---|---|---|
| 两路同一 code | 裸 INSERT = `LD003`、`referral_bind` = `LD003` | ✅ |
| 两路同一 reason（裸 INSERT 也有机读 reason） | 皆 `REFERRAL_ALREADY_BOUND`（旧状裸 INSERT 是 `23505 / constraint=referral_pk / reason=null`） | ✅ |
| 不回归（闸不是恒拒） | 全新 child 的裸 INSERT 正常放行（`depth=1`） | ✅ |
| 检查顺序纪律（③ 在 ④ 之前、与 `referral_bind` 同序） | 见下面 F2 的守卫读数与 `0011` 文件头声明一致；本单未重造 2-环全序列（上一轮 as-found 已钉，**本轮未复跑**，登记于 §⑨） | ⚠️ 未复跑（非本轮修复项） |

---

## ⑦ F2 父 `depth` 与真实跳数不符 ⇒ 绑定被拒 —— ✅ **真生效**

**最小复现**（事务内）：合法建 `958622 → 958621`（G2 是根 ⇒ P2 真实跳数 1、存储 depth 1）→
`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only` + `UPDATE referral SET depth = 50
WHERE child_uid = 958622` + `ENABLE` → 绑新子 `958623 → 958622`。
```json
"parent_p2": {"ok": true, "stored_depth": "1"}, "true_depth_of_p2": {"d":"1"}, "corrupted": {"d":"50"},
"bind_to_stale_parent": {"ok": false, "err": {"sqlstate":"LD016","message":"LEDGER_AMOUNT_INVALID",
   "detail":{"reason":"REFERRAL_PARENT_DEPTH_INCONSISTENT","child_uid":"958623","parent_uid":"958622",
             "parent_stored_depth":"50","parent_true_depth":"1",
             "note":"parent stored depth must equal its true hop count; a stale depth would be inherited by the new edge"}}},
"rejected_as_expected": true,
"child_row_not_written": {"n":"0"},                       // 真的没写进去
"positive_control_after_restore": {"ok": true, "stored_depth": "2"},   // depth 复原 ⇒ 放行且新子 = 2
"invariants_in_tx": {"cycles": "0"}
```
| 必验项 | 读数 | 判 |
|---|---|---|
| 父 depth 与真实跳数不符 ⇒ 绑定被拒 | `LD016` + `REFERRAL_PARENT_DEPTH_INCONSISTENT`（借既有闭集码 ⇒ **400 类**，不新增码） | ✅ |
| 拒绝是"真拒"（不落痕） | `referral` 内 child `958623` 行数 = **0** | ✅ |
| 守卫有观测力、不误伤 | depth 复原为真值后同一绑定**放行**且新子 `depth = 2`（正确计算） | ✅ |
| 不变式不被探针自证其罪 | 子事务内 `cycles = 0` | ✅ |

---

## ⑧ 迁移底线（幂等 / 版本 / `0001–0010` 未动 / 触发器启用态） —— ✅ **真生效**

**(a) `0011` 幂等 + checksum 一致**（`npx ts-node --transpile-only scripts/migrate.ts` 重跑，
落盘 `.p2qa-artifacts/p2qa-10-migrate-idempotency-p2qa-mig-20260927T114715Zt3ag.txt`）：
`"action": "skipped"` 行数 = **11**（0001…0011 全 skipped，`reason: "already applied, checksum match"`）、
`"schema_version": "0011"`、**`MIGRATE_EXIT=0`**、`--status` 也 **`STATUS_EXIT=0`**。
库内 `0011` 的 checksum = `238f96ae42298f85c03ffe08973eccb01bc560b9751ac752af769154f2583dfe`
= **盘上文件的 sha256**（迁移文件事后未被改动）；`0007 = 7044c6be…`、`0010 = 73e7ac8b…`
与 as-found 报告登记的 sha256 **逐字节相同** ⇒ 这两个文件应用后未被动过。

**(b) `0001–0010` 一字未动**（不只比 diff，逐文件比 blob）：
```
git diff --stat HEAD~1..HEAD -- backend-ts/migrations/  ⇒ 只有 0011 新增（1 file changed, 596 insertions）
per_file_same_as_head1: 0001..0010 全 = true（HEAD 与 HEAD~1 的 blob 相同）
per_file_same_as_head1: {"0001":true,…,"0007":true,…,"0010":true}
```

**(c) 触发器**：7 个用户触发器**全部 `tgenabled='O'`**
（`trg_account_guard / trg_commission_policy_append_only / trg_commission_policy_weights_guard /
trg_ledger_entry_append_only / trg_ledger_entry_commission_conservation / trg_referral_append_only /
trg_referral_cycle_guard`），`triggers_disabled_or_absent = []`；
Σ 断言触发器**仍是** `DEFERRABLE INITIALLY DEFERRED` 的约束触发器
（`{tgdeferrable:true, tginitdeferred:true, has_constraint:true}`）—— 这是 0011 闭合判据的前提；
`p2qa-12` 的 `triggers_identical_pre_post = true`、收尾 `triggers_disabled_now = []`。

**(d) 只读旁证**：全局 `readGraphInvariants = {cycles:0, bad_depth:0}`；`cid=1` 的
`0/-1/-2/-3` 四个平台账户在全部取证前后快照**逐字节相同**（`platform_cid1_unchanged = true`，
四个 `(balance,frozen)` 全 = `0/0`）；`docs/{ledger,commission}.spec.md`、`seafood.master-plan.md`、
`docs/qa/p2-commission.md` 的 sha256 已记录（后者 = `8030c1b1…`，未被回改）。

---

## ⑨ 残余风险 / 未验证项（**诚实清单，逐条不补读数**）

**残余风险（其中 1–3 我认为不阻塞验收，但必须登记）**

1. **F3 的诚实边界**（`0011` 自己在文件头登记了，我实测确认）：在**强制 `SET CONSTRAINTS … IMMEDIATE`**
   的会话里，Σ 断言只在「事件闭合」时判负 ⇒ 事件**进行中**的真缺陷不会被当场抓住（会在闭合那一刻被抓，
   `f3b/f3c` 实测如此）。⇒ 若将来有人把 `SET CONSTRAINTS ALL IMMEDIATE` 常开在生产路径，
   Σ 断言的**实时性**会下降（不是漏账，是判定时点后移）。**`api/` 层是否存在这种设置我未验证。**
2. **闭合判据依赖 `0004` 的实现细节**（R74「先分录、后账户」）。若 `0004` 将来改成边插分录边写账户，
   判据会退化为「几乎总是跳过」⇒ 真缺陷静默。`0011` 用 §D 的**行为探针**（闭合 ⇒ 必报 LD032）钉住了
   这一点（改坏则迁移失败），但那是一次性自检，**不是持续回归**。
3. **F1 的闸只有一处**（`planJobSettlement`，fail-closed）。绕过该函数直接投
   `ledger_post_event` 的路径仍被 DB 接受（我的判负对照 `posted_ok:true` 就是证据）
   ⇒ **归属不变式不是 DB 强制的**。属契约层（F4）范围。
4. **`within_cap` 在真链游走上恒为 `true`**：`getReferralChain` 的 CTE 有硬闸 `level <= cap`
   ⇒ `nodes.length <= cap` 恒真。所以「`within_cap === false` 不硬拒」这条**不可能由真链触发**，
   只能由纯函数矩阵（`p2qa-13`）验证（我两条都做了，并显式登记了 `within_cap_reachable_via_real_walk = false`）。
   请勿把它当作独立的安全闸。
5. **F7② 夹具的"每 RUN 一次性"**：我用 `sha256('f7b'+RUN) % 700` 派生 uid、symbol 带 RUN 后缀 ⇒
   每个 RUN 独占新命名空间；但**同一 RUN 重跑**会撞已提交的 `referral` 绑定（实测第二跑 `referral_bind`
   返回 already-bound）。我把 `p1t-00`/`p2w-00` 那种「永久不可重跑」降级为「每 RUN 一次」。
6. **并发写环境**：本机同一库有**其他会话在写**（我窗口内 `ledger_entry` 1996→2028、`users` 228→289）。
   ⇒ 我用**定向指纹**（我的 uid 窗口 + 事件键 + 触发器快照 + 平台账户快照）而非全表 hash 作为复原判据。
   我的分区残留 = 见下。
7. **`0011` §D 自检的 NOTICE 不被 `migrate.ts` 消费**（`0011` 自己在文件头诚实登记），
   行为探针的原始读数只能由外部脚本提供 —— 我**没有**跑 `p2w-00-p2fix-verify.ts`
   （它在本轮取证期间处于 `M` 状态、**不是我改的**，且按提交信息第二跑会 FATAL）⇒ 我改用**自己的**探针
   （`p2qa-12`）覆盖同批判据。

**未验证项**
1. `api/`（HTTP 层）暴露面：佣金事件经 api 出去的状态码/字段（本单范围外）。
2. 真并发绑定（同一 child 两个 parent 并发）—— 只做了单会话顺序用例。
3. 跨 `cid` 相同 `job_id` 的幂等键行为。
4. `membership`/`users` 侧身份变更（删用户、改 evm）对已绑链的影响。
5. **检查顺序的全序列复跑**：`0011` 把 ③ 已绑 插在 ② 之后、④ 之前（并声明与 `referral_bind` 同优先级、
   且不回归 `p1t-00` 的 2-环/自指/已有下级 三条）。我本轮**只**独立验了 ①②③④⑥⑦ 的单点行为
   （F6 的 ③、F2 的 ⑥），**未**重跑「2-环 + child 同时已绑」这类**多条件同真**的排序用例
   ⇒ 「③ 先于 ④」这条**本轮未由我独立复现**（上一轮 as-found 已钉住的是 0010 的 ③/④，0011 插入了新的 ③）。
6. `p1t-*` / `p1v-*` / `p2b-*` / `p2d-*` / `p2w-*` 等**其他方**脚本：本报告**不引用**其读数，也未由我重跑。
7. 未做：`frontend/**`、性能压测、真实业务数据正确性（真库只有测试分区数据）。

**我的分区残留（诚实清点，append-only ⇒ 不可清）**
- 提交的只有 **2 个 F7② 用例**（每个 RUN 一套）：
  `uid 958541–958544 / cid 183 / symbol p1x2ZXPKQ`（RUN `…114232Zxpkq`）与
  `uid 958636–958639 / cid 186 / symbol p1x2ZXQFD`（RUN `…114331Zxqfd`）；
  合计 `referral` 4 行、`users` 8 行、`currency` 2 行、`ledger_entry` 22 行（2 个 `job ref_id`）。
- **F1 / F7①(全部) / F3 / F6 / F2 全部事务内 ROLLBACK，零残留**（硬证据：
  958xxx 的 `users` 只有上表 8 个 uid，`958501–958534`、`958600–958635` 全空；
  `rolled_back_case_uids_present = []`、`rolled_back_case_referral_present = []`）。
- `cid=1` 平台账户未被触碰（只读快照逐字节相同）。

---

## ⑩ 总意见：**P2 验收可以通过**

- 上一轮判「不通过」的三条**必修**（F1 / F7② / F8）与三条登记项（F7① / F3 / F6 / F2 —— 共 6 条功能项）
  **我逐条一手复检，全部「真生效」**：F1 落账前 500 类拒结且**真的没落账**（含"DB 自己会放行"的判负对照）；
  F7② 重放 `plan` 与账**逐值一致**、`plan_source` 可分辨、政策占位不撒谎、新码不误报且不是死分支；
  F7① 用 12 级真链与恰好 10 级链对拍可分；F3 旧假报消失而**真缺陷仍必报 LD032**（两种形态都验）；
  F6 两路同码同 reason；F2 父 depth 守卫真拒且不误伤。
- 迁移底线**全部满足**：`0011` 重跑全 `skipped` + checksum 一致、`schema_version=0011`、
  `0001–0010` 逐 blob 未动（`git diff` 只有 0011 新增）、7 个用户触发器全 `O`、
  Σ 断言触发器仍是 `DEFERRABLE INITIALLY DEFERRED`、`cycles=0 / bad_depth=0`、平台账户未动。
- **可通过，但带 §⑨ 的登记**：其中唯一"应当在后续单收口"的是 **§⑨-5（检查顺序多条件同真的排序复跑）**
  与 **§⑨-1/2（IMMEDIATE 常开 & 闭合判据对 `0004` 实现细节的依赖）**；
  前者是**验证缺口**（不是已知缺陷），后者是 `0011` 自己已诚实登记的设计边界。
  这三条都不构成"账错了"或"归属错了"，故**不阻塞 P2 验收**。

---

## 附录 A · 本轮读数文件（run-tagged，sha256 可核）

| 文件（相对 `backend-ts/`） | sha256 |
|---|---|
| `.p2qa-artifacts/p2qa-10-baseline-migration-20260927T114136Zey7j.json` | `915463e02981189b3c7de49b0715e1b0e6be9cd34d506a4b6a089fffc3b9bb56` |
| `.p2qa-artifacts/p2qa-10-baseline-migration-20260927T114736Z8bk6.json` | `acf1f1c04fc9eea3a7ffa35441febf12ef5f7a83ef6af440e0f99b3365d429cf` |
| `.p2qa-artifacts/p2qa-10-migrate-idempotency-p2qa-mig-20260927T114715Zt3ag.txt` | `a4935d7aa900583d1d5cfa8e6b1c48748e44ca1a8a740299bb0c423ebae4d61f` |
| `.p2qa-artifacts/p2qa-11-f1-f7-20260927T114232Zxpkq.json`（F1 首跑：`referral_depth_rng` 夹具错，已修） | `7470e238dba8e0f1892a5d211cc5f855e13cf4fd4eb843e4c968dacb02b9a712` |
| `.p2qa-artifacts/p2qa-11-f1-f7-20260927T114331Zxqfd.json`（**F7① + F7② 主读数**） | `7baef608ae1216e38ff3bae6677aacd43d6b24124a7d898333a8a1a3917c393c` |
| `.p2qa-artifacts/p2qa-11-f1-f7-20260927T114432Zlesf.json`（**F1 主读数**，`P2QA_ONLY=f1`，不再落新事件） | `d17cdeb3a7b5b8a8198ef80f3a864b7d9d0d4e8cda6fbf746d671226658ddf1d` |
| `.p2qa-artifacts/p2qa-12-f3-f6-f2-20260927T114602Zexvq.json`（**F3 / F6 / F2 主读数**） | `2c372cbb108c4712aaad7988fcde41f52a72b3523f9ced4569a238c67d818ec4` |
| `.p2qa-artifacts/p2qa-13-assert-matrix-20260927T114709Zo1mz.json`（F1 判据矩阵 + 码闭集） | `29f01d5dead88005691dd3d3067ddf814bc41e489f025b7c9c5ef3fa3f56b103` |
| `.p2qa-artifacts/p2qa-14-replay-guard-20260927T114839Z4dve.json`（F7② 误报/漏报双向） | `96802393abeb876884ede2f2a4d9044a3e8098c15994492549d09e4410fe45d8` |
| `.p2qa-artifacts/p2qa-15-final-state-20260927T114919Zvesq.json`（收尾：触发器/不变式/残留/平台） | `b1a5cfc3ae872296b3394e6aa5fba15cae13455853af66865453244b06864c86` |

探针脚本（`backend-ts/scripts/`，全部 `tsc --strict` 显式文件 ⇒ exit 0）：
`p2qa-10-baseline-migration.ts` `462f5461bcc8f4a9a46d04d6aec31df0a7a5958a3cb5d2bfdc6aec3d28e371ef`、
`p2qa-11-f1-f7.ts` `30906d7ac41faedfc94eb9f231d0dc3dff194782cdd8926396a1ccd7981e5e57`、
`p2qa-12-f3-f6-f2.ts` `81e547a1660d72768828ec30a8a5a7fa127696a86e29c836214d13ac3bda580f`、
`p2qa-13-assert-matrix.ts` `c2473ba92e03ef6360d54702f7a7fbd1adee2419f58b1b2c81649df756391bef`、
`p2qa-14-replay-guard.ts` `ca73ec4cc4ec26fddb97a8c71cc752520cf7d6e9bf0c58ebf016e528c800277e`、
`p2qa-15-final-state.ts` `b3ae26aeccbda9a80b401f550ea916e8478f6033b473362b7fa40a6801209fb8`；沿用 `p2qa-lib.ts`（未改，as-found 侧登记值 `a7c4bee0…`）。

**落盘时刻真实库快照（只读）**：`schema_version=0011`、`referral=160`、`ledger_entry=2028`、
`commission_policy=19`、`users=289`、`currency=84`；`readGraphInvariants={cycles:0,bad_depth:0}`；
7 个用户触发器全 `tgenabled='O'`；`cid=1` 平台账户 `0/-1/-2/-3` 全 `balance=0/frozen=0`（前后一致）。
