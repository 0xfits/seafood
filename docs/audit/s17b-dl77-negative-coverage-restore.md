# S17b · 补回 `DL77` 负向覆盖（`p3j-02-cases.ts` C5c/C5d）

- 仓库：`/Users/kevin/bistro/seafood`；开工 `git log --oneline -1` = **`9bd1df0`**（S16）✅ 与简报一致
- 角色：Kong（本单一件 · 先现取后动 · **未 commit / 未 push**）
- 允许面：`backend-ts/scripts/p3j-02-cases.ts` + 本报告（`docs/audit/`）；其余（`src/**` · `frontend/**` · `migrations/**` · `docs/*.spec.md` · 其它脚本）**未碰**
- 硬口径遵守：不起服务 / 未占 5787/5788 及 5793–5799 / 未 `pkill`·`killall` / 未 `npm install` / 连库仅经主仓 `.env.local`（**未复制、未回显**）
- ★ **现取探针的一切写入 = 单连接事务内 + `ROLLBACK`（净零写，已由读数 `"txn":"rolled_back"` 自证）**；唯一持久写来自**任务明令复跑**的 `p3j-02-cases.ts` 自身测试数据分区（`cli:p3j-*` 前缀，脚本设计行为）

---

## 0. 结论摘要

| 项 | 现取（真库） | 处置 | 复跑读数 |
|---|---|---|---|
| `job_status_transition_ok` 完整合法边集 | **仅 10 条**（见 §1） | 挑**仍非法**边 `open→rejected` | — |
| 编排函数层负向覆盖（C5a 前推后腾空） | `refund open→rejected` 实测 ⇒ 拒 `LD011`+`JOB_STATE_INVALID` | **补 `C5c`**（判负，注明依据） | ✅ pass |
| DB 触发器层负向覆盖（C5b 前推后腾空） | raw `UPDATE open→rejected` 实测 ⇒ 拒 `LD011`+`JOB_STATE_INVALID` | **补 `C5d`**（判负，注明依据） | ✅ pass |
| `C5a`/`C5b` 前推结果 | — | **未删 / 未弱化**（diff 仅新增 + 1 处注释改写） | ✅ pass |

复跑：`npx ts-node --transpile-only scripts/p3j-02-cases.ts` ⇒ **`pass_count=12 / fail_count=1`**，唯一红 = **`C4`**（**预存数据漂移，非本单因果**，隔离证明见 §4）。

---

## 1. 件① · 先现取（真库实测，逐条，非猜）

**探针**：单连接 `BEGIN … ROLLBACK`，落于 scratch（未入仓）。要点读数：

- **迁移版本**：`schema_migration` max = **`0042`**（applied_at `2026-10-03 23:56:47Z`）。
- **真库函数体**（`pg_proc.prosrc`，与 `migrations/0042_job_settle_per_submission.sql:57-67` 一致）：

  ```
  CASE p_from
    WHEN 'open'      THEN p_to IN ('accepted','cancelled','settled')
    WHEN 'accepted'  THEN p_to IN ('submitted','rejected')
    WHEN 'submitted' THEN p_to IN ('settled','rejected','disputed')
    WHEN 'disputed'  THEN p_to IN ('settled','cancelled')
    ELSE false                              -- settled/rejected/cancelled = 终态
  END
  ```

- **完整 7×7 边矩阵逐条 `select job_status_transition_ok($1,$2)`** ⇒ **合法边恰 10 条**：

  ```
  open→accepted   open→settled   open→cancelled
  accepted→submitted   accepted→rejected
  submitted→settled    submitted→rejected   submitted→disputed
  disputed→settled     disputed→cancelled
  ```

  其余 39 条**仍非法**（含 `open→rejected` / `open→disputed` / `open→submitted` / `settled→*` / `rejected→*` / `cancelled→*`）。
- **选定仍非法边 = `open→rejected`**：真库实测 `job_status_transition_ok('open','rejected') = false`。
- **两层现取行为**（夹具 = 事务内插入的 `status='open'` job）：

  | 层 | 操作 | 现取读数 |
  |---|---|---|
  | 编排函数层（服务层） | `job_post_event({op:refund,to_status:rejected})` | `ok=false` · `sqlstate=LD011` · `message=LEDGER_CURRENCY_INVALID_TRANSITION` · `detail={field:"job.status",from:"open",to:"rejected",reason:"JOB_STATE_INVALID"}` |
  | DB 触发器层 | raw `UPDATE public.job SET status='rejected'` | 同上（`LD011` / `LEDGER_CURRENCY_INVALID_TRANSITION` / `reason=JOB_STATE_INVALID`, from=open,to=rejected） |
  | 对照：编排层 `refund open→cancelled`（合法） | — | 越状态闸、改由 escrow 闸拦（`job_escrow_missing`）⇒ 证**同路径，仅目标边不同** |
  | 对照：raw `UPDATE open→accepted`（合法） | — | `ok=true`（触发器放行） |

- 依据（唯一真源与拦截点）：合法边集唯一真源 = `0042_job_settle_per_submission.sql:57-67`；编排函数状态闸 = 同上 `:322-326`（refund 分支）；DB 触发器 = `trg_job_status_guard`，`0013_job.sql:120-134`。

---

## 2. 件② · 处置（两层各补一条判负 · 就地在代码内注明依据）

在 `p3j-02-cases.ts` 的 `C5b` 之后、`case ③` 之前**新增**（未动任何既有断言）：

- **`C5c` 编排函数层判负**：另 publish 一个 `open` 夹具 `jobNeg`（reward=50；`job1` 在 C5b 已 settled 终态不可复用）⇒ `jobPostEvent({op:'refund',job_id:jobNeg,to_status:'rejected'})`，断言
  `ok=false && sqlstate==='LD011' && message==='LEDGER_CURRENCY_INVALID_TRANSITION' && reason==='JOB_STATE_INVALID'` 且 `detail_parsed.{field,from,to} = job.status/open/rejected` 且**业务行仍 `open`**（拒后未改）。
- **`C5d` DB 触发器层判负**：`UPDATE public.job SET status='rejected'`，断言同上四稳定量 + 业务行仍 `open`。
- **代码内依据注释**（就地）：`DL77 / R93 / CR79`；合法边集 `0042…sql:57-67`；编排函数拦截点 `0042…:322-326` / 触发器 `0013_job.sql:120-134`；**真库现取 `job_status_transition_ok('open','rejected')=false`**。
- 文件头 `⑤` 说明同步加注（标明前推腾空 + 本单补回），`C5b` 注释由「详见报告」改为「已由 ⑤c/⑤d 补回」。

> ★ `C5a`/`C5b` 的**前推断言逐字保留**；diff `git diff --numstat` = `54 + / 2 -`（2 删 = 仅 `C5b` 注释一行改写，**无断言改动**）。

---

## 3. 复跑读数（本单版本）

```
$ P3J_RUN=S17B20261004T094556 npx ts-node --transpile-only scripts/p3j-02-cases.ts
exit_code = 3   pass_count = 12   fail_count = 1   failed = ["C4"]
C5a ✅  C5b ✅  C5c ✅  C5d ✅   （C1,C2,C2b,C3,C6,C4b,C4c,C4d ✅）
产物：backend-ts/.p3j-artifacts/p3j-S17B20261004T094556-cases.json
```

新增用例现取读数（逐字）：

- `C5c`：`{ok:false, sqlstate:"LD011", message:"LEDGER_CURRENCY_INVALID_TRANSITION", detail:"{\"to\":\"rejected\",\"from\":\"open\",\"field\":\"job.status\",\"job_id\":\"246\",\"reason\":\"JOB_STATE_INVALID\"}"}`；`job_row_after.status = open`。
- `C5d`：同上（`job_id=246`, `from=open`, `to=rejected`, `reason=JOB_STATE_INVALID`）；`job_row_after.status = open`。
- `C5a`（未动）：`reason=not_job_worker`、`reason!=='JOB_STATE_INVALID'` ✅；`C5b`（未动）：`{ok:true}`、`status=settled` ✅。

---

## 4. `C4` 隔离证明（**非本单因果**）

取 **`HEAD` 原版** `git show HEAD:backend-ts/scripts/p3j-02-cases.ts`（= S15 前推后的版本，**不含本单 C5c/C5d**），改 import 使 `p3j-lib`/`commission` 可解析，置于 `backend-ts/.s17b-iso/`（**跑完已 `rm -rf`，未留仓**）原样复跑：

```
$ git show HEAD:.../p3j-02-cases.ts > .s17b-iso/p3j-02-cases-head.ts   # 仅改 import 路径
$ P3J_RUN=S17BHEAD20261004T094635 npx ts-node --transpile-only .s17b-iso/p3j-02-cases-head.ts
exit_code = 3   pass_count = 10   fail_count = 1   failed = ["C4"]
C5a ✅  C5b ✅（无 C5c/C5d）        C4 ❌
```

| 版本 | C5a | C5b | C5c | C5d | **C4** |
|---|---|---|---|---|---|
| `HEAD` 原版（无本单改动） | ✅ | ✅ | —（不存在） | —（不存在） | **❌** |
| 本单版本（+C5c/C5d） | ✅ | ✅ | ✅ | ✅ | **❌** |

⇒ **`C4` 在改动前后读数一致（皆红）**，与本单改动**无因果**。

**`C4` 根因（现取读数）**：`kinds=["job_payout","job_payout","job_fee","job_fee"]`（无 `commission`）、`db_plan={fee:"100",M:0,N:0,W:"0",fee_credit_uid:"-1",layers:[]}` ⇒ 所选 `chainWorker`（`WHERE depth>=3 ORDER BY depth DESC LIMIT 1` 现取）**实测无上行链** ⇒ 「有链 ⇒ −2」不成立。系共享库（Neon）`referral` 链**数据漂移**，修需动夹具/换选链，**越出本单面**（与 S15 报告 §3 同判）。

---

## 5. 未删 / 未弱化声明

- `C5a`、`C5b` 的**断言表达式**在 diff 中**零改动**（`git diff` 对二者仅有上下文行）。
- 唯一「减行」= `C5b` 上方注释 1 行改写（把「详见本单报告」→「已由 ⑤c/⑤d 补回」），**非断言、非删除**。
- 未为凑绿改任何期望：`C5c`/`C5d` 的期望值**逐条由 §1 真库现取读数回填**。

---

## 6. 文件清单

**改动（未 commit / 未 push）：**
- `M backend-ts/scripts/p3j-02-cases.ts`（头 `⑤` 加注 + `C5b` 注释改写 + 新增 `C5c`/`C5d`；`+54 / −2`）

**新增（本报告）：**
- `?? docs/audit/s17b-dl77-negative-coverage-restore.md`

**产物（未跟踪，脚本自身落盘）：** `backend-ts/.p3j-artifacts/p3j-S17B20261004T094556-cases.json`、`p3j-S17BHEAD20261004T094635-cases.json`

**临时（已删/在仓外）：** `backend-ts/.s17b-iso/`（隔离证明用，跑完 `rm -rf`）；scratch 探针 `s17b-probe.js`（仓外）

**未触碰：** `backend-ts/src/**` · `frontend/**`（S17a 并行面，工作区的 `JobReviewPage.jsx`/`listing-market.test.jsx` 改动**非本单**）· `migrations/**` · `docs/*.spec.md` · 其余脚本 · 5787/5788 及 5793–5799

---

## 7. 未测项 / 边界（诚实登记）

1. **`C4` 未修**：见 §4（越界，需 `referral` 夹具或换链）。
2. **仅复跑目标脚本**：未跑整链 `migrate` / `tsc`（`scripts/` 不入 tsconfig `include`，本改动不影响 `build`）。
3. **未做无关非法边的全枚举判负**：仅按任务补 `open→rejected` 一条「两层各一」；其余 38 条仍非法边未逐条建用例（`DL77`「每状态机至少一层各一」已满足）。
4. **未核 `frontend/**` 并行改动**（S17a 面，非本单）。
