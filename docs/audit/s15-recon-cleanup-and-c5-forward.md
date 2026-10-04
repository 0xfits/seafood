# S15 · 残留探针清理 + `p3j-02-cases.ts` C5a/C5b 前推

- 仓库：`/Users/kevin/bistro/seafood`（开工 `git log --oneline -1` = `6ce91bc`）
- 角色：Kong（本单两件 · 均先现取后动 · 未 commit / 未 push）
- 允许面：`backend-ts/scripts/p3j-02-cases.ts` + `p8-s5-00-recon{,2,3}.ts`（移出）+ 本报告
- 硬口径遵守：不起服务 / 不占端口 / 未碰 5787/5788 / 未 `npm install` / 连库仅经主仓 `.env.local`（未复制未回显）

---

## 0. 结论摘要

| 件 | 现状（现取） | 处置 | 复跑读数 |
|---|---|---|---|
| ① 本批 3 个残留探针 | `p8-s5-00-recon{,2,3}.ts` 落 `scripts/`（★ 实为 **已跟踪/已提交**，非「未入库」） | **移出** `scripts/` → `backend-ts/.p9s15-archive/` | `scripts/*recon*` 由 10 → **7**；archive 3 件，`scripts/` 零命中 |
| ② `C5a`/`C5b` 失效期望 | 断言「`open→settled` 非法 ⇒ LD011 + `JOB_STATE_INVALID`」 | **按新口径前推**（注明依据，未静默删除） | `C5a` ✅ / `C5b` ✅（新读数见 §2） |
| 其余 7 个历史 recon | 落 `scripts/`（更早批次） | **只登记、不动** | 见 §1.3 |

复跑：`npx ts-node --transpile-only scripts/p3j-02-cases.ts` ⇒ `pass_count=10 / fail_count=1`，唯一失效 = `C4`；**`C4` 系预存数据漂移，与本单改动无因果**（已隔离证明，见 §3）。

---

## 1. 件① · 本批残留探针清理

### 1.1 先现取（引用扫描）

- `backend-ts/scripts/` 下现取 `*-recon*.ts` = **10 个**；本批相关 = `p8-s5-00-recon.ts` / `p8-s5-00-recon2.ts` / `p8-s5-00-recon3.ts`。
- 引用扫描（全仓，排除 `node_modules` / `.git`；`--include=*.ts,*.js,*.json,*.md`）：
  - **代码面零引用**：`package.json` 无对应 `scripts` 项（`build/start/dev/clean`）；无任何 `.ts/.js/.json` import / 调用这 3 个文件名。
  - 唯一命中 = `scripts/p8-s5-00-recon.ts:3` **自带的用法注释**（自身字符串），非外部引用。
  - `docs/**` 有多处**文字登记**（`seafood.master-plan.md`、`docs/qa/*`、`docs/audit/p9-s4-bttc.md`）把它们记为「临时侦察脚本 / 遗留探针」——属**文字记录，非代码引用**，不影响移出后的可运行性。
  ⇒ 三件均**无运行期依赖**，移出安全。

### 1.2 ★ 前提纠正（必须报告）

任务简报称这 3 件「**未入库、未跟踪**」。**现取与之不符**：

```
$ git ls-files backend-ts/scripts | grep recon     # 10 个全部在册
$ git status --porcelain scripts/p8-s5-00-recon{,2,3}.ts   # 空（= 干净，无未跟踪态）
$ git log --oneline -3 -- scripts/p8-s5-00-recon*.ts
17e5985 chore: seafood 同步 @2026-10-03 17:28（via ctrl 面板）
```

即：3 件（连同另 7 件）**已被 `17e5985` 提交入库**，工作区干净。故本单实际动作 = 「把**已跟踪**文件移出 `scripts/`」，`git status` 表现为 `D`（删除）+ 新目录 `??`，而非移动未跟踪文件。（`docs/seafood.master-plan.md` 等多处「留未跟踪」的登记与 git 事实不符，属文档面偏差，本单不改 —— 见 §4）

### 1.3 处置：移出（非删除）＋ 依据

**处置**：`mkdir -p backend-ts/.p9s15-archive/ && mv scripts/p8-s5-00-recon{,2,3}.ts .p9s15-archive/`

**为何移出而非直接删除（理由）**：
1. 三件**已入库**，删除会抹掉历史提交的对应字节；移出保留内容与可得性、可复核、可回滚，零信息损失。
2. 其为 `p8-s5` 侦察**读数来源**（`docs/audit/p8-s5-compliance-review.md` 等的佐证），删除会削弱审计链的可证伪性。
3. 移出与删除对硬口径**等价满足**：`scripts/` 扫面根不再有 `*-recon*` 命中即可。

**依据（硬口径）**：**探针不得放 `scripts/`** —— `scripts/` 是山门**扫面根**，探针留此会命中扫面根 ⇒ **离线误红**；且非交付脚本不应长期驻留。

**副作用核查**：`tsconfig.json` `rootDir=./src`、`include=["src/**/*"]` ⇒ `scripts/` 与 `.p9s15-archive/` **均不参与 `build`(tsc)**，移出**不影响** `npm run build`。

**读数**：
- `scripts/*recon*` = **7**（原 10 − 本批 3）；
- `ls scripts/p8-s5-00-recon*` ⇒ `confirmed: gone from scripts/`；
- `.p9s15-archive/` = 3 件（3579 / 1794 / 703 B，字节不变）。

### 1.4 其余 7 个历史 recon（**只登记、未动** —— 非本批，动之越界）

| # | 文件 | 归属批次（据文件名推断，**未核**） | 处置 |
|---|---|---|---|
| 1 | `scripts/p4z-a1cap-00-recon.ts` | P4z（a1cap） | 登记，未动 |
| 2 | `scripts/p4z-num1-00-recon.ts` | P4z（num1） | 登记，未动 |
| 3 | `scripts/p4z-tr1c-00-recon.ts` | P4z（tr1c） | 登记，未动 |
| 4 | `scripts/p7a-00-recon.ts` | P7a | 登记，未动 |
| 5 | `scripts/p7b-00-recon.ts` | P7b | 登记，未动 |
| 6 | `scripts/p7b-04-recon2.ts` | P7b-04 | 登记，未动 |
| 7 | `scripts/p7b-05-fixture-recon.ts` | P7b-05 | 登记，未动 |

> ★ 备注：这 7 件同样落在 `scripts/`（同一「扫面根」隐患），但属**更早批次**，本单不越界处置；建议后续合并一张「历史 recon 清理」单统一根治。

---

## 2. 件② · `p3j-02-cases.ts` C5a/C5b 前推

### 2.1 现状（改动前）与失效根因

- 原 `:97` `C5a`（编排函数层）：`jobPostEvent({op:'settle', job_id:job1, …})` ⇒ 断言 **`LD011` + `message=LEDGER_CURRENCY_INVALID_TRANSITION` + `reason=JOB_STATE_INVALID`**。
- 原 `:108` `C5b`（DB 触发器层）：`UPDATE public.job SET status='settled'` ⇒ 断言 **失败 + `LD011` + `reason=JOB_STATE_INVALID`**。
- **失效根因**：`0042`（`migrations/0042_job_settle_per_submission.sql:57-67`）`CREATE OR REPLACE` 了 `job_status_transition_ok`，`open` 出边**新增 `'settled'`**（`R-9-101` 逐笔发放「发满 `headcount` ⇒ 收口」必需；★ 枚举值域不动）。故 `open→settled` 由非法转合法。

### 2.2 依据（`0042` / `R-9-101` / 真库现取读数）

- **`0042` §①**（`:51-67`）：`open ⇒ {accepted, cancelled, settled}`；`0042` apply-time 自检（`:517-524`）**强制** `job_status_transition_ok('open','settled') = true`（否则整迁移回滚）。
- **真库现取读数**：
  ```
  job_status_transition_ok('open','settled') = true
  job_status_transition_ok('open','accepted') = true
  job_status_transition_ok('settled','open')  = false
  schema_migration: max version = 0042, applied_at = 2026-10-03 23:56:47Z
  public.job 触发器: trg_job_status_guard / trg_job_core_immutable_guard /
                     trg_job_ledger_ref_guard / trg_job_no_delete / trg_job_touch_time_updated
  ```
- `trg_job_status_guard`（`0013_job.sql:121-134`）以 `job_status_transition_ok` 为唯一真源 ⇒ `open→settled` 现**放行**。
- **现取行为探针**（回滚事务，净零写）：settle 一个 `open` 无 worker 的 job ⇒ 状态闸**放行**，改由 `job_settle_plan` 的 worker 锚点闸拦下（`0013_job.sql:285-289`，`reason=not_job_worker`）；raw `UPDATE open→settled` ⇒ **成功**。

### 2.3 处置（新断言 · 已注明依据）

**`C5a`（编排函数层）** —— 保留原操作（settle `job1`），前推期望值：
- 旧：`reason==='JOB_STATE_INVALID'`
- 新：`reason==='not_job_worker'` **且** `reason!=='JOB_STATE_INVALID'` **且** `detail` 不含 `job_state_transition_invalid`（其余 `ok=false`/`LD011`/`LEDGER_CURRENCY_INVALID_TRANSITION` 不变）。
- 语义：状态闸**已放行** `open→settled`；本夹具 `job1` 无 worker，故拦点下移到 `job_settle_plan` 的 worker 锚点闸。
- 代码内依据注释：`0042 §① / R-9-101；真库 job_status_transition_ok(open,settled)=true；worker 锚点闸 0013_job.sql:285`。

**`C5b`（DB 触发器层）** —— 由「判负」翻为「放行」：
- 旧：`ok===false && sqlstate==='LD011' && reason==='JOB_STATE_INVALID'`
- 新：`ok===true && jobRow.status==='settled'`（`trg_job_status_guard` 放行、UPDATE 成功）。
- 代码内依据注释：`0042 §① / R-9-101；真库 job_status_transition_ok(open,settled)=true`。

**未静默删除**：两条用例均**保留**（非删除），仅前推期望 + 就地注明依据；文件头 `⑤` 说明同步改写。

### 2.4 复跑读数

```
$ P3J_RUN=20261004T014036 npx ts-node --transpile-only scripts/p3j-02-cases.ts
pass_count = 10 / fail_count = 1 / failed = ["C4"]
C5a = pass ✅   C5b = pass ✅
```
- `C5a` 读数：`ok=false, sqlstate=LD011, message=LEDGER_CURRENCY_INVALID_TRANSITION,
  reason=not_job_worker, detail={field:"job.worker_uid", reason:"not_job_worker"}`（不再是 `JOB_STATE_INVALID`）。
- `C5b` 读数：`outcome={ok:true}`；`job_row_after.status='settled'`（`create_key=cli:p3j-20261004T014036-publish-1`）。
- 产物：`.p3j-artifacts/p3j-20261004T014036-cases.json`。

### 2.5 ⚠️ 需裁的风险：`DL77` 负向覆盖腾空

- 原 `C5a`/`C5b` 是 `DL77`「**非法状态迁移 ⇒ 判负用例两层各一**」的载体。前推后 `open→settled` 已合法 ⇒ **该负向覆盖随之腾空**（两层都不再断言「非法 ⇒ `JOB_STATE_INVALID`」）。
- 本单**未**另行补负向用例（越出「前推 C5a/C5b」的面）。**建议**：若需保留 `DL77` 的负向覆盖，可把两层**同点**到一条**仍非法**的边（现取仍在白名单外）——例如 `open→rejected`：编排层 `jobPostEvent({op:'refund', to_status:'rejected'})`、触发器层 `UPDATE … status='rejected'`，两者均应 `LD011 + JOB_STATE_INVALID`。**是否补，请裁。**
- 换言之：本条**非「整体作废」**（两用例仍承载「新口径下该迁移被放行」的实证），故按指示直接前推、未停下；仅就 `DL77` 覆盖去留请裁。

---

## 3. `C4` 预存失效的隔离证明（**非本单因果**）

- 复跑唯一红 = `C4`（结算链「**有链 ⇒ −2**」）。现取读数：`kinds=[job_payout,job_payout,job_fee,job_fee]`（无 `commission`）、`db_plan.M=0`、`fee_credit_uid=-1` ⇒ 所选 `chainWorker` 实测**无上行链**。
- **隔离证明**：取 `HEAD` 原版 `p3j-02-cases.ts`（仅改写 import 使 `./p3j-lib` 从归档目录可解析，置于 `scripts/` 之外）**原样复跑**：
  - 原版：`C5a=false, C5b=false, C4=false`；
  - 改后：`C5a=true,  C5b=true,  C4=false`。
  ⇒ **`C4` 在改动前后读数一致（皆红），与本单改动无因果**；`C5a`/`C5b` 由红转绿即本单前推之效。
- `C4` 根因 = **共享库（Neon）`referral` 链数据漂移**（`chainWorker` 由 `WHERE depth>=3 ORDER BY depth DESC LIMIT 1` 现取；历史 `p3j` 产物中 `C4` 亦曾红：`p3j-20260928051201` = `C4:false`）。修 `C4` 需 `referral` 夹具或换选链，**越出本单面**，未动。

---

## 4. 未测项 / 边界（诚实登记）

1. **未验证 `scripts/` 之外的「山门」扫描是否还扫别处**：本单仅据硬口径「扫面根 = `scripts/`」移出 3 件；其余 7 件与 `.p9s15-archive/` 是否命中其它扫描器**未测**（无对应扫描器可跑）。
2. **`docs/**` 中「此 3 件未入库/未跟踪」的登记与 git 事实不符**（实为 `17e5985` 已提交）：**未改文档**（`seafood.master-plan.md` 等非本单面），仅本报告登记该偏差，供后续合批订正。
3. **`DL77` 负向覆盖去留未决**：见 §2.5，待裁。
4. **`C4` 未修**：见 §3（越界）。
5. **未做整链 `migrate` / 全门回归**：本单只复跑目标脚本；`npm run build` 因 tsconfig 不含 `scripts/`，移出**理论不影响**，但**未实跑 `tsc`**（无必要且未在本单面）。

---

## 5. 本单触碰的文件清单

**改动（未 commit / 未 push）：**
- `M  backend-ts/scripts/p3j-02-cases.ts`（头 `⑤` 说明 + `C5a`/`C5b` 期望前推 + 依据注释）
- `D  backend-ts/scripts/p8-s5-00-recon.ts`（移出）
- `D  backend-ts/scripts/p8-s5-00-recon2.ts`（移出）
- `D  backend-ts/scripts/p8-s5-00-recon3.ts`（移出）
- `?? backend-ts/.p9s15-archive/`（3 件落此）
- `?? docs/audit/s15-recon-cleanup-and-c5-forward.md`（本报告）

**产物（未跟踪）：** `backend-ts/.p3j-artifacts/p3j-20261004T014036-cases.json`、`p3j-20261004T014118-cases.json`

**未触碰：** `backend-ts/src/**` · `frontend/**` · `migrations/**` · `docs/*.spec.md` · 其余 7 个历史 recon · 5787/5788 端口
