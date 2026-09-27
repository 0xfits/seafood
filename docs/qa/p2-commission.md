# P2「十级返佣」· 独立质检报告（Neng · 不通过）

> **as-found 声明（必读）**：本报告描述的是 **HEAD = `f78714f219871ec6a0bec4e01fd0b8ebd8a2d61b`**
> （`f78714f feat(P2/0010): 绑定协议守卫 + 200=>benign 校验侧同步 + spec v0.10/v0.3`）
> **那一刻的代码与库状态**。**修复轮正在并行进行**（实现方 Kong 正在改 `src/commission.ts`、
> 新建 `migrations/0011_*`，本轮取证期间实测到 `M backend-ts/src/commission.ts`、
> `?? 0011_commission_assert_closure_and_referral_depth_guard.sql`）。
> **本报告不含任何「修复后」读数**；文中一切读数都是在 as-found 状态下由我自己取证得到的。
> 报告生成时刻：2026-09-27 19:4x（CST）。报告生成时的 HEAD 已是 `6f62954`
> （该提交只新增质检/探针资产，`git diff --stat f78714f..6f62954 -- backend-ts/src backend-ts/migrations docs`
> 为**空** ⇒ as-found 的 `src/**` 与 `migrations/**` 字节未变）。

| 项 | 值 |
|---|---|
| 被检对象 | `backend-ts/migrations/0007–0010`、`backend-ts/src/commission.ts`、错误码资产（`ledger-errors.ts` / `0009`） |
| 质检员 | Neng（独立质检员，不采信实现方自报读数） |
| as-found HEAD | `f78714f219871ec6a0bec4e01fd0b8ebd8a2d61b` |
| as-found `src/commission.ts` sha256 | `521cde8836b288b1b2e6fffb12e87c3ffc0795b33550a095d2328034c1c4bd76` |
| as-found `src/ledger.ts` sha256 | `cb7ef5c8b7c6166c3d4f2620a2b141b91dae8cf45f73ba301037be114d0377d7` |
| as-found `0007` / `0010` sha256 | `7044c6be33f7421a9659c4f7e684c887e1f90709e6a179c7f55aac253bd7b34a` / `73e7ac8b6fd426558faf2802876ab7b9be83db8cb73295944e66000c614551dc` |
| **结论** | **不通过**（1 项中等缺陷 + 若干登记项；核心机制主路径全绿，缺陷集中在「图坏时静默错付」与「返回值/账面语义」两处） |

---

## ① 结论与范围

**结论：不通过。**

- **主路径（单条闸全部生效时的正常业务）我一手确认为绿**：取整/最大余数法 1400 例与独立参考实现 0 不一致；
  重归一化、破平局、Σ 守恒不可绕过、幂等并发不双发、政策不追溯、守卫三/四道闸与检查顺序、
  触发器启用态与 append-only、平台余额未动 —— 逐条读数见 §④。
- **不通过的原因不是「算错了钱」，而是三条**：
  1. **F1（中等）**：佣金层算出的**链断言没人读** ⇒ 一旦图里出现环/重复受益人，会产出
     「Σ 平衡但**归属错**」的载荷并被 DB 静静接受（佣金付给重复 uid，含**打工人本人**）。
  2. **F7②（中）**：幂等**重放**时返回的 `plan` 是**本地重算值**（用当前政策），与账上已落版本不一致
     （实测 `fee 10000` vs 账上 `50000`）⇒ 调用方可能按错数字展示/记账。
  3. **F8（中，方法漏洞，打我自己）**：`tsconfig.json` 的 `include` 只有 `src/**/*`
     ⇒ `scripts/` 下 **71 个** `.ts` **从未**被类型检查；我此前引用的「tsc 0 error」不覆盖任何探针脚本。
- 另有 F2/F3/F4/F5/F6/F7① 六条**登记项**（行为边界与数据卫生），逐条见 §③。
- **范围**：0007–0010 迁移 + `src/commission.ts` 佣金层 + 良性码资产 + 全局触发器/append-only 状态。
  **不在范围**：前端、`api/` 层暴露面、性能压测、真实业务数据正确性（真库只有测试分区数据）。

---

## ② 被检对象与 HEAD

| 件 | 位置 | as-found 状态 |
|---|---|---|
| 邀请图 + 政策表 + 环守 + Σ 守恒触发器 | `backend-ts/migrations/0007_referral_and_commission_policy.sql` | 已应用（`schema_migration.0007`） |
| `-1` 平台白名单扩 `job_fee` | `0008_platform_revenue_job_fee.sql` | 已应用 |
| 错误码反向映射补齐（33 码） | `0009_ledger_error_reverse_map_complete.sql` | 已应用 |
| **绑定协议守卫**（已有下级者不得再绑上级） | `0010_referral_bind_protocol_guard.sql` | 已应用（`applied_at 10:45:22Z`） |
| 佣金层 | `backend-ts/src/commission.ts` | as-found sha256 见上表 |
| 取证脚本（我自己写的） | `backend-ts/scripts/p2qa-{lib,00..06}*.ts` | 与实现方 `p1t/p2d/p2c/p1o` 系完全隔离 |
| 一手读数 | `backend-ts/.p2qa-artifacts/*.json`（run-tagged） | 14 个文件，清单与 sha256 见附录 A |

**孤儿风险登记**：as-found 时真库中 `0011` **尚未存在**；取证期间（19:29:08）实现方落盘了
`0011_commission_assert_closure_and_referral_depth_guard.sql`，并在 **19:35:24** 应用
（`schema_migration.0011 applied_at 2026-09-27 11:35:24.353246+00`）。
⇒ 本报告的全部读数都取自 **0011 未应用**的窗口（我最后一条补证回归跑完于 19:33:57）。

---

## ③ 逐条缺陷 / 登记项（F1–F8）

> **编号口径**：F1 / F2 / F3 / F4 / F5 / F6 / F7① / F7② 沿用本轮**协调方 Zang 的登记编号**
> （其对实现方的派单逐字引用为：「F1 佣金层落账前必须校验链断言…；F7② replay 时返回的 plan…
> ；F7① 加 chain_truncated 字段区分恰好 cap 与超过 cap；F3+F6+F2 新建 0011 迁移…」，
> 且 `6f62954` 的提交信息逐条登记「F2 陈旧 depth 可继续传播 / F3 延迟约束被提前 IMMEDIATE 会假报 LD032 /
> F4 Σ 只保总量不保归属 / F5 验收脚本永久污染 commission_policy / F6 已绑同一事实两路两码 /
> F7① chain_depth 无法区分恰好 cap 与超过 cap」）。**F8 为本轮方法漏洞登记项**，同源于 `6f62954`
> 提交信息中「Kong 发现 tsconfig.json include 仅 src/**/*」一条。
> 每条的「原始输出片段」均为我自己探针的落盘读数（附录 A 可核）。

### F1（中等 · 必修 —— Zang 已亲核）链断言算出来**没人读** ⇒ 图坏时静默错付

- **现象**：`getReferralChain` 算出 `assertions.{no_duplicate_uid, contiguous_levels, all_user_uids, within_cap}`，
  但 `src/commission.ts` 全文件**从未 `if` 读它**；唯一被读的是 `event.assertions.sum_x_equals_pool`
  —— 那是**池子总量**，不是**归属**。
- **最小复现**（我的探针 `p2qa-03` Q3，读数 `p2qa-03-chain-depth-guard-p03b.json`）：
  事务内 `ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard` +
  `… trg_referral_append_only`（**同事务、末尾 ROLLBACK**），直插 2-环 `954721↔954722`，
  然后同事务内跑 `planJobSettlement` + `buildSettleEvent` + `ledger_post_event`，
  再 `SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE` 提前结算。
- **原始输出片段**：
  ```json
  "chain_nodes": [{"beneficiary_uid":"954722","level":1},{"beneficiary_uid":"954721","level":2},
                  {"beneficiary_uid":"954722","level":3}, … {"beneficiary_uid":"954721","level":10}],
  "chain_assertions": {"contiguous_levels":true,"within_cap":true,"all_user_uids":true,"no_duplicate_uid":false},
  "layer_uids": ["954722","954721","954722","954721","954722","954721","954722","954721"],
  "worker_self_paid": ["200","100","60","30","10"],
  "duplicate_beneficiaries": ["954722","954721","954722","954721","954722","954721","954722","954721"],
  "ev_assertions": {"entry_count":24,"account_count":4,"sum_delta_frozen":"0","commission_rows":20,
                    "sum_commission_credit":"1000","sum_x_equals_pool":true},
  "posted_ok": true, "posted_error": null,
  "forced_constraint_check_ok": true, "forced_constraint_error": null
  ```
  判负对照（同法、同一脚本）：故意 Σ 不平的载荷 → `posted_ok:true` 但
  `forced_constraint_error {"sqlstate":"LD032","reason":"COMMISSION_SPLIT_SUM_MISMATCH",
  "pool_in":"1000","commission_out":"999","commission_rows":"1"}` ⇒ **证明「上面那条无报错」不是方法空转**。
- **期望 vs 实际**：期望链断言被读并在落账前**响亮拒绝**（500 类借码 + 机读 reason）；
  实际**静默落账**：`Σ x == P` 成立（总量守恒断言放行），而**钱付给了重复的 uid，含打工人本人**。
- **严重度**：中（**需先有坏图**才可达：正常写入路径上 0010 守卫 + 环守会拦住；但本项目上一单
  **已实测**用管理员旁路 `DISABLE TRIGGER` 提交过 13 行 depth 修复 ⇒ 坏图不是纯假设）。
- **归哪方**：实现方（Kong）。已派单修（F1）。

### F2（登记 · 数据卫生）陈旧 `depth` 会被新行继承并**永久化**（守卫不校验父 depth 真实性）

- **现象**：`depth` 只是层级标签（0007/0010 注释自陈「不承担防环」）；`referral` INSERT-only
  ⇒ 坏 `depth` **不可就地修正**。0010 的 ④ 守卫只拦「被绑者自己已有下级」，
  **不校验新父 P 的 `depth` 是否为真值**（= P 的真实上行距离）。
- **最小复现**（`p2qa-03` Q1，读数 `…-p03c.json` / `…-p03d.json`）：事务内
  `ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only` → `UPDATE referral SET depth = depth + 97`（打工人）
  / `SET depth = 50`（祖先）→ 取「破坏前 / 破坏中 / 回滚后」三份行指纹 → 末尾 ROLLBACK。
- **原始输出片段**：
  ```json
  "row_fingerprint_pre": {"rows":"[{child_uid 954701→954711 depth 3},{954711→954712 depth 2},{954712→954713 depth 1}]",
                          "hash":"85e08fb5f050edcbd8ce98ea609523b96172160230af45e7b00f84fcf607a789"},
  "corrupted_rows":     {"depth":"100 / 50 / 1", "hash":"27f55ccc30bbd8c17b7b1cc4f9fbef6cc2acabbc6660928a2b5efb7300bf24f5"},
  "chain_mid_nodes":    [{"954711",1},{"954712",2},{"954713",3}],      // 与 chain_pre **逐元素相同**
  "row_fingerprint_post_rollback": {"hash":"85e08fb5f050edcbd8ce98ea609523b96172160230af45e7b00f84fcf607a789"},
  "restored": true
  ```
  正对照（`p2qa-03` Q4b）：`INSERT INTO referral (child_uid,parent_uid,depth) VALUES (954809,954803,5)`
  → `{"inserted":true,"returned_depth":"1","stored_depth":"1"}`（触发器覆写调用方入参 ✔）；本轮
  `p2qa-05` 又加固两条：父=根 ⇒ 覆写为 `1`；父 depth=1 ⇒ 覆写为 `2`。
- **期望 vs 实际**：期望守卫能识别「父行 depth 非真」；实际不能（合法协议下无从判断）。
  **但**：链游走**不读 `depth`**（Q1 实证 `chain_mid_nodes ≡ chain_pre`、`plan_mid ≡ plan_pre`）
  ⇒ **陈旧 depth 不影响钱包金额**，只污染不变式与审计。
- **严重度**：低–中（登记项；无金额影响，但不可修正）。
- **归哪方**：实现方（0011 的新守卫「校验父 depth 真实性」）。

### F3（登记 · 行为边界）延迟约束若被**提前 IMMEDIATE**，会在「事件未完」时假报 LD032

- **现象**：`trg_ledger_entry_commission_conservation` 是
  `CONSTRAINT TRIGGER … AFTER INSERT … DEFERRABLE INITIALLY DEFERRED`，**只对「相关行」触发**
  （`kind='commission' AND uid=-2` 或 `kind='job_fee' AND uid=-2 AND delta>0`），在**触发那一刻**
  对整个 `event_root_key` 求和。若该断言在任何时点被收紧为 `IMMEDIATE`（或事件分行写入、
  或有人跑 `SET CONSTRAINTS ALL IMMEDIATE`），它会在**佣金行尚未写全**时求和 ⇒ 对**合法**事件假红。
- **最小复现**（`p2qa-03` Q3 首跑，读数 `p2qa-03-chain-depth-guard-p03a.json`）：
  同一事务内**先** `SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE`，
  **再**提交（Σ 平衡的）结算载荷。
- **原始输出片段**：
  ```json
  "ev_assertions": {"entry_count":24,"commission_rows":20,"sum_commission_credit":"1000","sum_x_equals_pool":true},
  "posted_ok": false,
  "posted_error": {"sqlstate":"LD032","message":"LEDGER_RECONCILE_MISMATCH",
    "detail":"{\"reason\":\"COMMISSION_SPLIT_SUM_MISMATCH\",\"pool_in\":\"1000\",\"job_fee_rows\":\"1\",
               \"commission_out\":\"0\",\"commission_rows\":\"0\"}"}
  ```
  `commission_rows: "0"` 就是铁证：**断言是在佣金行还一条都没有时跑的**。
  同一载荷在 `p03b`/`p03c`（先插满 24 行、再 `IMMEDIATE`）读数相反：
  `"posted_ok": true, "forced_constraint_check_ok": true`。
  附：`LD032` 在 TS 错误表里 `status = null`（`p2c-00` 本轮重跑读数
  `{"LD032":{"code":"LEDGER_RECONCILE_MISMATCH","status":null,"status_or_500":500}}`）⇒ 断言失败**不落 400**。
- **期望 vs 实际**：期望该断言对「事件未完」的中间态免疫（或契约明确只允许 COMMIT 时判）；
  实际存在「提前结算即假红」的运行窗口。
- **严重度**：低（登记；默认语义下不可达）。
- **归哪方**：实现方（0011 按 Zang 派单：「延迟断言对『事件未完』签名免疫」；`LD032` 的 HTTP 语义见契约层）。

### F4（登记 · 契约边界）Σ 守恒**只保总量、不保归属**

- **现象**：0007 §D 的守恒断言只断言 `-2` 池的进出相等；`0007` 注释自陈「**不**断言『受益人分对了人』」。
- **最小复现**（`p2qa-01`，读数 `p2qa-01-sigma-conservation-p01b.json`）：手工构造两类
  **Σ 平衡但归属错**的 `op=entries` 载荷直接投 `ledger_post_event`：
  ① `attribution-swapped`（L1/L2 金额互换）② `duplicate-beneficiary`（同一 uid 占两层）。
- **原始输出片段**（被 DB **接受**的归属证据）：
  ```json
  "accepted_attribution_evidence": {
    "swapped_rows":   [{"uid":"954001","kind":"job_fee","delta":"0"},{"uid":"-2","kind":"job_fee","delta":"1000"},
                       {"uid":"-2","kind":"commission","delta":"-400"},{"uid":"954101","kind":"commission","delta":"400"},
                       {"uid":"-2","kind":"commission","delta":"-600"},{"uid":"954102","kind":"commission","delta":"600"}],
    "duplicate_rows": [… {"uid":"-2","kind":"commission","delta":"-461"},{"uid":"954111","kind":"commission","delta":"461"},
                       {"uid":"-2","kind":"commission","delta":"-308"},{"uid":"954111","kind":"commission","delta":"308"},
                       {"uid":"-2","kind":"commission","delta":"-231"},{"uid":"954112","kind":"commission","delta":"231"}]
  }
  ```
  （`954111` 在同一事件里拿到 **两笔**贷方。）
- **期望 vs 实际**：期望「Σ 平但受益人重复」在 DB 侧就被拦；实际放行（归属只能靠上层链断言 ⇒ **与 F1 同因**）。
- **严重度**：中（与 F1 合并看：F4 是「DB 不管归属」的契约事实，F1 是「上层算了却不读」的实现缺陷）。
- **归哪方**：契约层（CR80 原文只要求总量）+ 实现方（F1 的修法覆盖归属）。

### F5（登记 · 数据卫生）验收脚本**永久污染** `commission_policy`（append-only ⇒ 无法清理）

- **现象**：真库 `commission_policy` 已有 **19 行**（非纯种子态），且该表 **UPDATE/DELETE 皆禁**
  ⇒ 只能追加、不能清理；**当前生效政策**因此随测试轮次漂移（as-found 时是 `policy_id 37`）。
- **最小复现**：只读基线 + 收尾复核（`p2qa-00`；报告时刻快照）。
- **原始输出片段**：
  ```json
  "policies": 19 行, "policies_seed_only": false,
  POLICY_TAIL = [{"policy_id":"37","levels":"10","fee_rate_bp":"100","effective_from":"2026-09-27 10:56:46.580869+00"},
                 {"policy_id":"36","levels":"2","fee_rate_bp":"100","effective_from":"2026-09-27 10:56:43.995566+00"}]
  ```
  我自己也在这条路上留过痕：`p2qa-01` 的政策写入负例全部**回滚**（`rolled_back:true`），
  但合法边界例（`sum_9899_ok → policy 62`、`sum_9999_ok → policy 65`）同样回滚 ⇒ **政策表只能靠回滚不落痕**。
- **期望 vs 实际**：期望验收/探针在**可回滚事务**或**独立测试库**里造政策；实际真库被历轮追加污染
  ⇒ 任何依赖 `policy_id` / `effective_from` 的读数都会漂。
- **严重度**：低（登记；数据卫生）。
- **归哪方**：**双方**（实现方与质检方共用同一真库；建议：政策写入一律进回滚事务，或建 `qa_` 前缀库）。

### F6（登记 · 行为边界）同一事实**两路两码**（函数层与触发器层各有一套闸）

- **现象**：「child 已绑别的父」这一事实：走 `referral_bind()` 得 `LD003 / REFERRAL_ALREADY_BOUND`（409 语义）；
  走**裸 INSERT** 得裸 `23505 / referral_pk`（**无机读 reason**）。
  更微妙的同源现象：**「已有下级」**这一事实在 `referral_bind` 与裸 INSERT 两路报的**不是同一道闸**
  （前者先撞「已绑」的 ②，后者才到 ④）。
- **最小复现**（`p2qa-03` Q4 的 `o4`；本轮 `p2qa-05` 的 `c5c` 复现）。
- **原始输出片段**：
  ```json
  // o4_already_bound_child_other_parent
  "referral_bind": {"sqlstate":"LD003","reason":"REFERRAL_ALREADY_BOUND","message":"LEDGER_IDEMPOTENCY_CONFLICT"},
  "raw_insert":    {"sqlstate":"23505","reason":null,"constraint":"referral_pk",
                    "message":"duplicate key value violates unique constraint \"referral_pk\""},
  // p2qa-05-p05c c5c（child 已有下级且已绑）
  "referral_bind": {"sqlstate":"LD003","reason":"REFERRAL_ALREADY_BOUND"},
  "raw_insert":    {"sqlstate":"LD016","reason":"REFERRAL_BIND_WOULD_STALE_DEPTH"}
  ```
- **期望 vs 实际**：期望**同一事实在同一层（触发器）给出同一机读码**（调用方不该因为用了裸 INSERT 就丢 reason）；
  实际两路语义不同（不是错，但客户端契约会分叉）。
- **严重度**：低（登记）。
- **归哪方**：实现方（0011：already-bound 两路同码）。

### F7①（登记 · 行为边界）`chain_depth` 无法区分「**恰好** cap」与「**超过** cap」；第 11/12 级静默零得

- **现象**：链长 12、政策 `levels = 10` 时，`getReferralChain(uid, 10)` 返回 **10 个节点** +
  `within_cap: true`，`plan.chain_depth = 10`，**没有任何截断标记** ⇒ 上层无法区分
  「这条链正好 10 级」和「这条链被截掉了 2 级」。
- **最小复现**：`p2qa-03` Q2（`getReferralChain` cap 10 / cap 3 对同一条 12 级链）+ 本轮 `p2qa-06`（真结算账本级对账）。
- **原始输出片段**：
  ```json
  "full_chain_of_leaf": 12 个节点（954741…954752）,
  "chain_cap10": {"chain_depth":10,"assertions":{"within_cap":true,"no_duplicate_uid":true,…}},
  "chain_cap3":  [3 个节点],
  "plan_cap10":  {"chain_depth_reported":10,"M":10,"W":"10000",
                  "x":["3000","2000","1500","1000","800","600","500","300","200","100"]}
  ```
  本轮账本级（`p2qa-06-levels10-tail-p06a.json`，13 节点链真结算，见 §⑦）：
  距离 1..10 各 **1 行**佣金（`30000,20000,15000,10000,8000,6000,5000,3000,2000,1000`，Σ = `100000` = pool ✔），
  距离 **11/12**：`comm_rows=0`、`comm_delta=0`、`balance=null`（连 account 行都没有）。
- **期望 vs 实际**：期望有 `chain_truncated` / cap-touched 标记，让「第 11 级起零得」可被观测；
  实际静默（金额上不算错 —— cap 是政策上限；但「零得」这一**事实**对上层不可见）。
- **严重度**：低（登记；可观测性缺口）。
- **归哪方**：实现方（F7① 派单：加 `chain_truncated` 字段）。

### F7②（中 · 必修 —— Zang 已亲核）**replay 返回的 `plan` 是重算值**，与账上不一致

- **现象**：幂等重放（`replay: true`）时，返回的 `plan` 用**当前生效政策**重算，而账上金额是第一版政策落的
  ⇒ 返回值与账本**不一致**（账本没错，返回值误导）。
- **最小复现**（`p2qa-04` Q3，读数 `p2qa-04-idempotency-policy-p04d.json`）：
  同一 `job_id` 先按 `policy 20`（`fee 500bp, levels 9`）结算 → 再插 `policy 33`（`100bp, levels 2`）→ 原样重放同一事件。
- **原始输出片段**：
  ```json
  "policy_old": {"policy_id":"20","fee_rate_bp":500,"levels":9},
  "policy_new": {"policy_id":"33","fee_rate_bp":100,"levels":2},
  "first_call":  {"ok":true,"replay":false,"fee":"50000","x":["16666","16667","16667"],"policy_id":"20",
                  "fingerprint":"87e3576cccdcf04093fd1ddf2dfe28ee2054f160ab66e30dc9263ca1de963606"},
  "second_call": {"ok":true,"replay":true,"fee_planned":"10000","x_planned":["5000","5000"],
                  "policy_id_planned":"33","fingerprint":"87e3576c…（同指纹）"},
  "rows_hash_before_second": {"hash":"cf801efa…","rows":10},
  "rows_hash_after_second":  {"hash":"cf801efa…","rows":10}, "rows_unchanged": true,
  "facts": {"commission_rows":"6","minus2_net":"0","ev_net_sum":"0"}
  ```
  ⇒ 账上仍是 `fee 50000 / x [16666,16667,16667]`（`rows_unchanged:true`），而**返回给调用方的 plan 说 10000**。
- **期望 vs 实际**：期望 replay 的 `plan` 由账上事件导出（或带 `plan_source` 标记表明是重算）；
  实际直接给重算值。CR87「不追溯」在**账本**上是对的，在**返回值**上自相矛盾。
- **严重度**：中（账本无误，但调用方/前端/对账脚本会按错数字走）。
- **归哪方**：实现方（F7② 派单：replay 的 plan 由账上事件导出 + 加 `plan_source`）。

### F8（中 · 方法漏洞 —— **打我自己**）`scripts/` 下 71 个 TS **从未**被类型检查

- **现象**：`backend-ts/tsconfig.json` 的 `include` 只有 `["src/**/*"]` ⇒ `scripts/` 下全部探针
  **不在 `tsc -p tsconfig.json` 的检查范围**。我上一轮报告里引用的「tsc 0 error」因此
  **不覆盖任何探针脚本**（包括我自己的 `p2qa-*`）。
- **最小复现**（只读）：
  ```bash
  cat backend-ts/tsconfig.json          # "include": ["src/**/*"]
  ls backend-ts/scripts/*.ts | wc -l    # 71
  ```
- **原始输出片段**：
  ```json
  tsconfig.json: { "include": ["src/**/*"], "exclude": ["node_modules","dist"] }
  scripts/*.ts 计数 = 71
  我本轮改用**显式文件参数**才覆盖到自建探针：
  npx tsc --noEmit --esModuleInterop --skipLibCheck --target ES2020 --module commonjs --strict \
      scripts/p2qa-05-cycle3-and-order.ts scripts/p2qa-06-levels10-tail.ts   →  tsc_exit=0
  ```
- **期望 vs 实际**：期望回归入口同时检查 `src` + `scripts`（或至少把探针纳入）；
  实际只查 `src` ⇒ **「tsc 0 error」这句话在探针语境下是假绿**。
- **严重度**：中（它污染的是**证据链**而非产品代码）。
- **归哪方**：**双方**。Zang 已派单（新增 `tsconfig.scripts.json` 把 `scripts/` 纳入类型检查与回归）；
  我这一侧：此后引用 `tsc` 一律**显式列文件**或显式用 `-p tsconfig.scripts.json`。

---

## ④ 一手复现为绿的关键读数（不采信实现方自报）

1. **取整 / 最大余数法 1400 例网格对拍**（`p2qa-02-rounding-renorm-p02a.json`，与**独立参考实现**比对，
   参考实现不 import `src`）：
   `{"grid": {"cases": 1400, "bad": 0, "bad_detail": []}}`。
2. **重归一化**（同一文件 `real_cases`，与 spec §6.4 逐值一致）：
   `M=4 W=7500 → x=[4000,2667,2000,1333]`；`M=5 W=8300 → x=[3614,2410,1807,1205,964]`；
   `M=3 W=6500 → x=[4615,3077,2308]`（Σ=10000）；`fee=1` 时 `x=[1,0,0,…]`（池子小于权重和）。
3. **破平局（「给最深一层」= 同余数时的破平局规则）**：`P=1 M=2 w={2500,2500} → x=[0,1]`（越深者拿，
   `tied_levels_at_max_remainder=[1,2]`）；`P=1 M=3 → [0,0,1]`；`P=2 M=3 → [0,1,1]`（两个 +1 都给更深）；
   `P=1 M=10 w 全 1000 → 只有最深一层拿 1`。全部 `matches_reference=true, sum_equals_P=true`。
4. **大数与边界**：`gross=9223372036854775807 → fee=92233720368547758, net=9131138316486228049`（相加=gross ✔）；
   `gross=18446744073709551615` 与 `92233720368547758079999` → `400 LEDGER_AMOUNT_INVALID / OUT_OF_BIGINT_RANGE`；
   `mulDivHalfUp(den=0)` → `400 / NOT_POSITIVE`；`P=2^63−1, M=10` 仍 `sum_equals_P=true` 且与参考一致。
5. **Σ 守恒**：`p2qa-01` 五类 tamper 全被拒（`LD032 COMMISSION_SPLIT_SUM_MISMATCH`（带 `pool_in/commission_out/commission_rows` 机读 detail）
   或 `LD016 EVENT_NOT_BALANCED`）；判负对照（同法构造真不平载荷）确认闸门**有观测力**（见 F1 的 control 读数）。
6. **幂等并发**（`p2qa-04-p04d` Q1）：8 并发同键同内容 →
   `{"ok_count":8,"replay_count":7,"root_rows":"1","rows_total":"8","commission_rows":"4",
     "worker_got":"99000","ev_net_sum":"0","rows_not_doubled":true,"worker_paid_once":true}`（**恰一组分录、只付一次**）。
   Q2 同键改内容 → `409 LEDGER_IDEMPOTENCY_CONFLICT`（带 `actual/expected` 指纹），且
   `rows_hash_before == rows_hash_after`（账上原封不动）。Q4 不同键 → 两个独立事件（设计如此）。
7. **政策不追溯 + 版本选择**（`p2qa-04-p04d` Q3/Q5）：重放时 `rows_unchanged: true`（账上仍是首版金额）；
   选择按 `effective_from` 单调：`1969-12-31T00:00:00Z → 无政策（500 COMMISSION_POLICY_MISSING）`、
   `1970-01-01T00:00:01Z → policy 1`、`2026-09-27T10:25:43Z → 20`、`10:40:09Z → 33`、`10:56:44Z → 36`、
   `2030-01-01 → 37`（= now 生效）；回填被拒（`POLICY_EFFECTIVE_BACKDATED`）、
   排期生效**不影响当前**事件（`inserted:true, policy_id:73, visible_now:"37"`）。
8. **守卫闸门与**检查顺序（本轮补证 `p2qa-05-cycle3-and-order-p05c.json`，11/11 格全绿）：
   ① 自指 → `REFERRAL_SELF_BIND`；③ 3-环 / 4-环 / 2-环 → `REFERRAL_CYCLE_REJECTED`（**在 child 同时
   「已有下级」时仍报环 ⇒ ③ 先于 ④ 的顺序被钉住**）；④ 根且有下级的新绑定 →
   `REFERRAL_BIND_WOULD_STALE_DEPTH`；合法叶→根**放行**；⑤ `depth` 入参伪造成 7 被覆写为 `1` / `2`。
9. **链游走不读 `depth`**（`p2qa-03` Q1）：破坏 depth（`+97` / `50`）后
   `chain_mid_nodes` 与 `chain_pre` **逐元素相同**、`plan_mid ≡ plan_pre` ⇒ 钱包金额不受陈旧 depth 影响；
   同时 `readGraphInvariants` 报出 `bad_depth > 0` ⇒ 不变式**有观测力**（不是恒 0 的空判据）。
10. **政策写入 13 例双闸**（`p2qa-01-…-p01b.json`）：`levels_mismatch / sum_over_10000 / w1_zero / sum_zero /
    negative_weight / fee_rate_99 / fee_rate_501 / levels_11 / levels_0 / dup_effective_from / created_by_minus4`
    全部被 **DB 侧（23514 + 逐条中文 message / 23505 唯一键）与 TS 侧（400 + 机读 reason）双闸拒绝**；
    合法边界 `sum_9899_ok / sum_9999_ok / created_by_positive_user` 放行，且**全部 `rolled_back: true`**。
11. **触发器启用态 + append-only**（`p2qa-00-baseline-base00.json`、`p2qa-03-*-p03d.json` 的 `final`、
    本轮 `p2qa-05` 的 `pre/post`）：7 个 public 用户触发器
    `trg_account_guard / trg_commission_policy_append_only / trg_commission_policy_weights_guard /
     trg_ledger_entry_append_only / trg_ledger_entry_commission_conservation / trg_referral_append_only /
     trg_referral_cycle_guard` 全部 `tgenabled='O'`，`triggers_disabled: []`；
    `ledger_entry` 的 UPDATE/DELETE 与 `referral` 的 UPDATE/DELETE 均 `P0001` 拒绝；
    `commission_policy` **DELETE** 同样 `P0001`（其 **UPDATE** 用例见 §⑤ 第 3 条——我的探针列名写错，未真正验到）。
12. **平台账户只读未动**：`cid=1` 的 `uid=-1/-2` 的 `(uid,cid,balance,frozen)` 前后快照**逐字节相同**
    （`p2qa-06` 的 `platform_cid1_unchanged: true`）；基线 16 个平台/系统账户只读登记。
13. **两项回归重跑（本轮补做，退出码取自命令本身）**：
    `npx ts-node --transpile-only scripts/p2c-00-code-roundtrip.ts --phase after --assert` → **exit 0**，
    `assertions_failed = []`；`npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert`
    → **exit 0**，`failures: []`、`all_cells_match_expectation: true`、
    `rows_touched {ledger_entry_before: "1996", ledger_entry_after: "1996", wrote_no_ledger_rows: true}`
    （19 个入口点 × 输入形状，全部与期望一致：如 `E-W1_transfer cells=66 thrown=66` 全部落到 400/403/404/409）。

---

## ⑤ 未验证项（12 条）

> **诚实声明**：上一轮我在写报告前撞到工具调用上限，运行时把最终摘要**截断**了
> （`task-0.log` 末行尾部 `…(+90 chars)` 不可读）。因此本清单是按我**本轮可复核的现场证据**
> 对那 12 条的**重述**：**我不为任何一条补造读数**；未做过的，就是未验证。

1. **并发绑定**：同一 child 两个 parent 的真并发（② `users` 两行 `FOR UPDATE` 串行化）我只做了
   单会话顺序用例 + 代码级读出，**未做真并发**（`A→B` / `B→A` 同时发起）。
2. **延迟约束的跨语句语义**：同一 `event_root_key` 分多条语句、分批插入时的守恒判定（我只测了
   单语句整载荷 + `SET CONSTRAINTS IMMEDIATE` 两种时点）。
3. **`commission_policy` 的 UPDATE 方向 append-only**：我的探针 UPDATE 语句列名写错
   （实际报错 `42703 column "depth" does not exist`）⇒ **该判据本轮未真正验到**（DELETE 方向验到了）。
4. **链长与政策 `levels` 不匹配时的历史重算**：如「12 级链 × `levels=3`」的组合对账（我只测了
   `levels=10` × 12 级、以及 3/4/5 级链 × 对应政策）。
5. **无邀请人路径的账本级对账**：`0008` 让 `-1` 收 `job_fee` 的「无上级 ⇒ fee 入 `-1`」分支，我只看了
   静态读数与迁移声明，**未做真结算的账本行读数**。
6. **同一 `event_root_key` 的多轮结算**（一个键两次事件）未被构造。
7. **0010 生效前遗留的存量坏 `depth` 行**是否会影响新绑定的账本结果（我只有在事务内**伪造**的读数）。
8. **跨 `cid` 相同 `job_id`** 的幂等键冲突行为（我只在单一 cid 内验）。
9. **政策新版本插入与在飞结算的真竞态**（我只验了顺序上的版本选择与重放）。
10. **`membership`/`users` 侧的身份变更**（如删除用户、改 evm）对已绑链的影响 —— 未涉及。
11. **`api/`（HTTP 层）暴露面**：佣金事件经 `api` 出去时的字段/状态码（本单范围外）。
12. **全量回归的完整性**：我只重跑了 `p2c-00` / `p1o-00` 两项（本轮补做）；`p1t-*` / `p1v-*` / `p2b-*` /
    `p2d-*` 等其余脚本**未由我独立重跑**，其读数在本报告中**不作为我的结论依据**。

---

## ⑥ 取证方法与回滚复原证明

**隔离契约（逐条遵守）**：测试数据只用 uid **954xxx**（954001 / 9541xx / 9542xx / 9545xx / 9546xx / 9547xx /
9548xx / 9549xx 自有窗口）、symbol 前缀 **`p1u`**、幂等键前缀 **`ops:p1u:`**；cid 一律由
`ensureCurrency` 新建（161 / 162 / 163 / 167 / 172 / 本轮新 cid）；
**绝不触碰 `cid=1` 与平台账户既有余额**（只读快照证明，见 §④-12）；身份表名一律 `users`（无裸 `FROM user`）。

**破坏性动作**：任何 `UPDATE referral SET depth` / `ALTER TABLE … DISABLE TRIGGER` 都在
`inRollbackTx`（`BEGIN … ROLLBACK`）内执行，**末尾一律 `ROLLBACK`**；每个破坏性探针同文件取
「**破坏前 / 破坏中 / 回滚后**」三份读数。每条**会失败**的 SQL（含 `referral_bind` 抛错）都包在
`SAVEPOINT` 里（否则一次报错整事务 `aborted` ⇒ 后续格子全是假读数 —— 这是我上一轮踩过的坑，
`p2qa-05` 已修正）。
- **复原证明（定向指纹而非全表 hash）**，理由：本机同一 Neon 库**多会话并发写**
  （取证期间实测到实现方并发 `ALTER TABLE` 造成的锁争用 —— `p2qa-03` 的 `tx_retry_errors` 里明确记录
  `current transaction is aborted`，以及一次 `Client network socket disconnected`），
  ⇒ **全表 hash 会因别人的写入而变，不能作为「我已复原」的判据**。改用四类**定向指纹**：
  1. **行级指纹**：`referral` 按 uid 窗口取 `(child_uid,parent_uid,depth)` 三元组 JSON + `sha256`
     （如 `85e08fb5f050edcbd8ce98ea609523b96172160230af45e7b00f84fcf607a789` 前后逐字节相同）；
  2. **事件账指纹**：`event_root_key` → `(txid,uid,kind,delta,frozen_delta,idempotency_key)` 的 `sha256`
     （如 `dbe4dea6…` 在并发/replay 前后不变）；
  3. **触发器启用态全表快照**（7 行 `tbl,tgname,tgenabled` 排序后逐字节比对，`triggers_identical: true`）；
  4. **平台账户快照**（`(uid,cid,balance,frozen)`，`cid=1` 前后相同）。
- **零残留**：`p2qa-03-p03d.json` 的 `final`：`{cycles:"0", bad_depth:"0"}` +
  `my_partition_rows: 60`（我的 uid 窗口内 referral 行数回到基线）；
  `p2qa-05-p05c.json` 的 `post/restored`：`my_window_referral_rows: 0`、`my_window_users_rows: 0`、
  `my_window_account_rows: 0`、`invariants_identical: true`、`all_triggers_enabled: true`、`rolled_back: true`；
  `p2qa-01-…-p01b.json` 的 `no_residue`：tamper 键族全部**恰 1 行 root**（键族闭合，未双发）。
- **诚实缺口（我自己造成的真库留痕）**：我**提交**过的测试事件确实留在真库（append-only ⇒ 不可清）：
  ledger_entry 由基线 **1715** 行增至收尾 **1996** 行（含他方写入），`referral` 由基线 **28** 行增至 **100** 行
  （其中 **12 行**是我本轮补证的 13 级链夹具）。这些行全部落在本单分区（uid 954xxx / cid 161+）。

---

## ⑦ 本轮补证（事二三条，全部为 as-found 状态读数）

### ⑦-1 3 节点以上环的拒绝 reason 与 0010 检查顺序（`p2qa-05-cycle3-and-order.ts`）

- **做法**：事务内按合法协议造 `954851→954852→954853`（3-环候选，C 是根）、
  `954861→954862→954863→954864`（4-环候选）、`954871→954872`（2-环对照），
  再逐格尝试闭环/自指/仅触发 ④/合法对照；每条会失败的语句用 `SAVEPOINT` 隔离；末尾 `ROLLBACK`。
- **读数**（`p2qa-05-cycle3-and-order-p05c.json`，11/11 格全绿）：
  ```
  c1  self_bind（referral_bind）        → LD016 / REFERRAL_SELF_BIND
  c1b self_bind（裸 INSERT）            → LD016 / REFERRAL_SELF_BIND
  c2  3-环 C→A（referral_bind 与裸 INSERT 两路）→ LD016 / REFERRAL_CYCLE_REJECTED   ★③ 先于 ④
  c3  4-环 D2→A2（两路）                → LD016 / REFERRAL_CYCLE_REJECTED
  c4  2-环 Y→X（两路，既有判负不回归）  → LD016 / REFERRAL_CYCLE_REJECTED
  c5  根且有下级的新绑定（两路）        → LD016 / REFERRAL_BIND_WOULD_STALE_DEPTH
  c6  全新叶→根（正对照）               → 放行（depth=1）
  c7  depth 入参伪造 7，父=根           → 被覆写为 1
  c7b depth 入参伪造 7，父 depth=1      → 被覆写为 2
  ```
  **检查顺序结论**：0010 文件头声明的 `① 自指 → ② 串行化 → ③ 环 → ④ 已有下级 → ⑤ depth`
  **与实测一致**。最关键的钉子：`c2` 里 child `C` **同时**满足「成环」与「已有下级」，
  两路都报 `REFERRAL_CYCLE_REJECTED` ⇒ **③ 确实先于 ④**（环是更根本的理由）。
  另注 `c5c`（child 已绑且已有下级）：`referral_bind` 先撞 ② 报 `LD003/REFERRAL_ALREADY_BOUND`，
  裸 INSERT 才到 ④ 报 `REFERRAL_BIND_WOULD_STALE_DEPTH` ⇒ 见 F6 登记。
- **复原读数**：`restored {invariants_identical:true, triggers_identical:true, all_triggers_enabled:true,
  zero_residue_in_window:true, rolled_back:true}`；`post.triggers_disabled: []`；本脚本**未** ALTER/DISABLE 任何触发器。

### ⑦-2 `levels = 10` 时第 11/12 层一分未得的**账本级**证据（`p2qa-06-levels10-tail.ts`）

- **做法**（**提交**的真账读数，落在本单分区；policy 只读、**不新增** `commission_policy` 行）：
  建 13 节点链（打工人 `954901`，12 级祖先 `954902…954913`）→ `gross=10000000`、
  当前生效政策 `policy_id 37`（`fee_rate_bp=100, levels=10`，weights `3000,2000,1500,1000,800,600,500,300,200,100`）
  → `settleJobCommission` 提交 → 回 `ledger_entry` 逐 uid 数佣金贷方行。
- **读数**（`p2qa-06-levels10-tail-p06a.json`，9/9 判据全绿）：
  | 距离 | uid | 账上 `commission` 行 | 佣金额 | 该 cid 账户余额 |
  |---|---|---|---|---|
  | 1 | 954902 | **1** | 30000 | 30000 |
  | 2 | 954903 | **1** | 20000 | 20000 |
  | 3 | 954904 | **1** | 15000 | 15000 |
  | 4 | 954905 | **1** | 10000 | 10000 |
  | 5 | 954906 | **1** | 8000 | 8000 |
  | 6 | 954907 | **1** | 6000 | 6000 |
  | 7 | 954908 | **1** | 5000 | 5000 |
  | 8 | 954909 | **1** | 3000 | 3000 |
  | 9 | 954910 | **1** | 2000 | 2000 |
  | 10 | 954911 | **1** | 1000 | 1000 |
  | **11** | **954912** | **0** | **0** | **无 account 行（null）** |
  | **12** | **954913** | **0** | **0** | **无 account 行（null）** |

  `chain_above_worker_len = 12`（递归 CTE 证明 12 级祖先**真实存在**）、
  `plan_M = plan_chain_depth = 10`、`plan_sum_x = 100000 = plan_W`、`sum_x_equals_pool = true`、
  `posted {ok:true, replay:false, fee:"100000", pool:"100000"}`、
  `platform_cid1_unchanged = true`。
  ⇒ **「levels=10 时第 11/12 层一分未得」由 plan 读数升级为账本级事实**：这两级**在 `ledger_entry`
  里一行都没有、账户根本不存在**，且**没有任何字段告诉上层「这条链被截断了」**（= F7①）。

### ⑦-3 两项回归重跑（退出码取自命令本身）

| 命令 | 退出码 | 关键读数 | 落盘 |
|---|---|---|---|
| `npx ts-node --transpile-only scripts/p2c-00-code-roundtrip.ts --phase after --assert` | **0** | `assertions_failed = []`；33 码往返闭合；`LD032` 的 TS `status` 确为 `null`（`status_or_500=500`） | `.p2c-artifacts/p2c-00-roundtrip-after-MUJQLQ38.json`（19:30:30） |
| `npx ts-node --transpile-only scripts/p1o-00-escape-sweep.ts --phase after --assert` | **0** | `failures: []`、`all_cells_match_expectation: true`、`raw_sqlstate_escapes_zero/unmapped_zero/missing_status_zero/ld_sqlstate_no_leak/no_unexpected_500_from_caller_input` 全 `true`、`wrote_no_ledger_rows: true`（`ledger_entry` 1996→1996） | `.p1f-artifacts/p1o-00-escape-sweep-after-MUJQM252.json`（19:33:57） |

**环境指纹声明（重要）**：
- 两条命令都**不** `import ../src/commission`（`p2c-00` 只依赖 `src/ledger*`，`p1o-00` 依赖
  `src/db`、`src/ledger`、`src/ledger-errors`）⇒ **不受实现方并行修改 `src/commission.ts` 的影响**；
  运行窗口内 `src/ledger.ts` sha256 = `cb7ef5c8…`（与 as-found 一致，mtime 18:22）、
  `src/ledger-errors.ts` mtime 18:46 ⇒ 均在运行前。
- 两次运行**都在 `0011` 应用之前**（`schema_migration.0011.applied_at = 11:35:24Z` = 19:35:24 CST > 19:33:57）。
- 输出文件均为脚本自带的 **run-tagged** 文件名（`…-after-<RUN>.json`），**未覆盖**任何既有取证文件。

---

## 附录 A · 读数文件清单（run-tagged，sha256 可核）

| 文件（相对 `backend-ts/`） | sha256 |
|---|---|
| `.p2qa-artifacts/p2qa-00-baseline-base00.json` | `79562910f2c24b88f643d9669dfcfdc6d1deb5c92bff92d242af524f221adfee` |
| `.p2qa-artifacts/p2qa-01-sigma-conservation-p01a.json` | `68ce1b2a85e52fca8da4ab587f09c4d3552d3c18f58089e9804934a63c03b483` |
| `.p2qa-artifacts/p2qa-01-sigma-conservation-p01b.json` | `1186d56368372303840d3db231ae9e0b66c11a347b3be774c950d6cbb7866441` |
| `.p2qa-artifacts/p2qa-02-rounding-renorm-p02a.json` | `2eb50796e94facd19e72a1d9924a9f54a072185065cbc69016518d113a21412c` |
| `.p2qa-artifacts/p2qa-03-chain-depth-guard-p03a.json` | `af5f28d37e9a79a78ae0f7fa3ef18d2c92eddcf528025d31c66d0b025a040faa` |
| `.p2qa-artifacts/p2qa-03-chain-depth-guard-p03b.json` | `b2168a221b7952253d2ff9be5dd0f6a3d4c6293c0b6ab4519ee8a553231d48c9` |
| `.p2qa-artifacts/p2qa-03-chain-depth-guard-p03c.json` | `bb799f7d40610e8ec2e9243d5aa3d7e958ce1a264ff8590d5ecca9d78b5fa9c4` |
| `.p2qa-artifacts/p2qa-03-chain-depth-guard-p03d.json` | `440a48adf09393fc9627d0f9b5eabdf2b40fc142047bfa397637c6b27a8a8b91` |
| `.p2qa-artifacts/p2qa-04-idempotency-policy-p04a.json` | `1a847fe86e9a7f352bff6c0e969ead7151545f14af026c3e470c5993a28a91f8` |
| `.p2qa-artifacts/p2qa-04-idempotency-policy-p04d.json` | `7a05684e0de5f4fd39fe6c218c58a49eb77e7578d9fc42b3afce3c4187df461a` |
| `.p2qa-artifacts/p2qa-05-cycle3-and-order-p05a.json` | `bbe5adf46f648950814f71e57db6d3b440354986355ede08cdd0ad7187d39690` |
| `.p2qa-artifacts/p2qa-05-cycle3-and-order-p05b.json` | `e12dda29d9a9e84e32f008438c986d001fa35c47afb77025a2857f18002ee3fa` |
| `.p2qa-artifacts/p2qa-05-cycle3-and-order-p05c.json` | `e37a47f4c641cef69c05ff32e4c626983c0fea50ede6cf24a144c5722d15b14a` |
| `.p2qa-artifacts/p2qa-06-levels10-tail-p06a.json` | `bb8e61a15d46d8bced82b98c10261e7e83c98d82539548aa32afbb0408819fe8` |

探针脚本（`backend-ts/scripts/`）：`p2qa-lib.ts` `a7c4bee0af39c17bb1d811b74702d9ac6a7853f37b226823abbde93fa3022d76`、
`p2qa-00-baseline.ts` `a860fc67419c2b5ad790c9ec9c5978625edd38d5b2a3b6ac0ed3366609ee877e`、
`p2qa-01-sigma-conservation.ts` `b6ee44b1fe5872332798096d3e7d37384fc9ac554c8d7bde97568ed66becc8ae`、
`p2qa-02-rounding-renorm.ts` `c04f57a88e816672758cd676bc7cbfd5634c37f6795eaa785f07eb729e775802`、
`p2qa-03-chain-depth-guard.ts` `c16cac07023d84f07598a6543a6f534043fc28b67422f773d8eb44bb6e115e45`、
`p2qa-04-idempotency-policy.ts` `6e71d89fcf5561a02f3342acb5bb5e702a34208aa64d00d4968ff193bc50d726`、
`p2qa-05-cycle3-and-order.ts` `a2c9849483d8cbd49db3aa64fc983c0f8797b19d5e437af942b2c23a63919e9b`、
`p2qa-06-levels10-tail.ts` `b8af87de3c10939e248677d643a9043174a819198b672936eea5dab3c029aa7c`。

**落盘时刻的真实库快照（只读）**：`referral=100 行`、`ledger_entry=1996 行`、`commission_policy=19 行`、
`users=183 行`；7 个 public 用户触发器全部 `tgenabled='O'`；`schema_migration` 最高版本 = `0011`
（**在我的全部读数之后**于 19:35:24 应用）。
