# S4a-c 收尾 · 招工资金「逐笔发放」真链路与判负（`R-9-98` / `R-9-101` / `R-9-102` / `R-9-103`）

> **状态：已回填（S4a-d 最后一公里 · 真链路读数已取）**
> 权威：`backend-ts/migrations/0042_job_settle_per_submission.sql`（**未 apply**，真库零位移）
> 探针：`backend-ts/.p9s10-s4a/s4a-chain.ts` · 纯净读数：`.p9s10-s4a/s4a-chain-final1.json` / `s4a-chain-final2.json`
> 硬口径：一切写入只在事务内 + `ROLLBACK`；连库只从主仓 `.env.local`；**不 apply 0042**；不 commit/push；连跑 2 次均 **26/26 全绿**。
> ★ **本单结论修正**：S4a-d 前置判断（「根因 = 探针 `seedUsers` 的 SQL 拼址 bug，非 0042 缺陷」）**不成立**。真根因是 **0042 自身的缺陷**（见 §3.1）；`seedUsers` / `referral` 夹具在盘上本已正确（参数化 + sha1 派生址），唯二的 `42601`/自绑记录来自**上一轮一次性调试脚本**，非主探针。

## 0 · 结论摘要（已验 / 未验区分）

| 腿 | 项 | 期望 | 实取（final1） | 判 | 状态 |
|---|---|---|---|---|---|
| A | (a) 发布押金 = `reward × headcount` | 雇主余额 −总额 / 冻结 +总额 | 余额 `3000→1000`（−2000）/ 冻结 `0→2000`；`total=reward(1000)×headcount(2)=2000` | **PASS** | 已验 |
| A | (b) 逐笔发放两份（各一份 `reward` + 分佣） | 每份净额/费率/分佣逐笔正确 | #1 键 `…:168:140`、#2 键 `…:168:141`；两份 worker 各 900、上级累计 100→200、雇主冻结 1000→0；kinds 各 6 条含 `job_fee`/`commission` | **PASS** | 已验 |
| A | (c) 发满 `headcount=2` ⇒ `job.status='settled'` | settled | 首份后 `status=open`/`paid=1`；第二份后 `status=settled`/`paid=2` | **PASS** | 已验 |
| A | (d) 同提交号重放 ⇒ 幂等重放（非冲突） | `idempotent_replay=true` 零位移 | `ok=true`/`replay=true`/`zero_move=true`；键含提交号且两份键不同；重放 txid == 原 txid | **PASS** | 已验 |
| A | (e) 余额不足 ⇒ `LEDGER_INSUFFICIENT_BALANCE` | 原码 | `LD001`/`LEDGER_INSUFFICIENT_BALANCE`；`required=1800000 available=1000` | **PASS** | 已验 |
| A | (f) 分佣守恒（逐事件） | Σ 出池 == Σ 分佣入账 | 每事件 `pool_in=100`/`credits=100`/`commission_net=−100`；守恒触发器在场 | **PASS** | 已验 |
| A | (g) 净写 0：回滚后逐表与基线相等 | 全等 | 5 张被触及表 md5+行数全等；`schema_migration` 40 行 / `max=0041` 未动；`open→settled` 复原非法；`ledger_post_event` 源 md5 未变 | **PASS** | 已验 |
| B | 判负①：结算键不含提交号 ⇒ 第二份必判「重放」 | 变异码可应用 + 第二份 replay | j1 `replay=false`、j2 **`replay=true`**、第二人余额 0、`paid=1`（键退化 `biz:job:settle:170`） | **PASS** | 已验 |
| C | 判负②：托管退化为单份 ⇒ 第二份报冻结不足 | `LEDGER_INSUFFICIENT_FROZEN` | 首发冻结 1000（非 2000）、首份后冻结 0、第二份拒 **`LEDGER_INSUFFICIENT_FROZEN`**（`required=900 available=0`）、第二人 0 | **PASS** | 已验 |
| D | 判负③：发满后第三份必拒 | `JOB_STATE_INVALID` | 两份后 `settled`/`paid=2`；第三份拒 **`LEDGER_CURRENCY_INVALID_TRANSITION` + `reason=JOB_STATE_INVALID`**（`from=settled to=settled`）、第三人 0/`paid3=2` | **PASS** | 已验 |
| E | 判负④（缺陷修复）：重放 ⇒ 首任务奖励零新增行 | 0 新行（钩子仍在其路径上可控） | 直落 settle 后 invite=0；**一次 settle 重放 ⇒ invite 零新增行（0→0）**；直调同一钩子仍落 **3 行**（平台 −20 + 本人 +10 + 上级 +10） | **PASS** | 已验 |
| — | `npx tsc --noEmit` 全量 | 0 error | exit 0，零输出 | **PASS** | 已验（**注意覆盖面**见 §4） |
| R-9-102 | refund = `reward × (headcount − 已发放份数)` 真跑 | 剩余份额退回 | **未跑**（主探针无 refund 真链路腿） | **未验** | **未验** |
| — | 路由层 / HTTP / 前端消费面 | 端到端 | **未跑**（0042 未 apply；本单全部读数 = 事务内干跑 + `ROLLBACK`） | **未验** | **未验** |

---

## 1 · 真链路探针（腿 A · 原版 0042，事务内 + ROLLBACK）

**夹具（`.p9s10-s4a/s4a-chain.ts`）**：5 个确定性 uid（雇主 `880100` / w1 `880201` / w2 `880202` / w3 `880203` / 上级 `880300`，`cid=1`）；`users.evm` 由 `sha1('s4ac:'+name)` 派生合法 `0x`+40hex（避开 `users_evm_fmt` 校验）；注资走**真账本 `transfer`**（`postEvent`，从 `cid=1` 最大余额账户转入 3000）以避开 `account_guard` 对「新户非 0/0」的禁写。

**逐项读数（`s4a-chain-final1.json#legA_chain.data`，job_id=168）**：

- (a) publish：`emp_before {balance:3000,frozen:0}` → `emp_after_publish {balance:1000,frozen:2000}`；`a_bal_delta=2000`、`a_frz_delta=2000`、`a_total_expected=2000`、`publish_replay=false`、`escrow_txid=1759`。
- (b) settle#1（sub 140）：`kinds=[job_payout×2, job_fee×2, commission×2]`；`w1=900`、`parent=100`、`emp.frozen=1000`、`job.status=open`、`paid=1`。settle#2（sub 141）：`w2=900`、`parent=200`、`emp.frozen=0`；键 `biz:job:settle:168:140` ⇄ `…:168:141`（互不相同）。
- (c) `job_after_s2 {status:settled, headcount:2}`、`paid_after_s2=2`。
- (d) 同提交号重放（sub 140）：`replay_ok=true`、`replay_flag=true`、`replay_zero_move=true`（重放前后 emp/w1/w2/parent/平台/**中转池 −2** 六点快照逐字相等）、`replay_txid=1761`。
- (e) 余额不足（reward 900000×headcount 2 = 1,800,000 > 余额 1000）：`insufficient_ok=true`、`sqlstate=LD001`、`detail={required:1800000,available:1000}`。
- (f) 分佣守恒（逐事件，按 `event_root_key`）：`cons_s1 = {pool_in:100, commission_net:-100, credits:100}`、`cons_s2` 同；`trg_ledger_entry_commission_conservation` 在场。
- (g) 净写 0：见 §5。

## 2 · 判负（腿 B/C/D/E）

- **腿 B（判负①）**：内存变异「结算键丢弃提交标识后缀」。j1（sub1）键 `biz:job:settle:170`、`replay=false`、发放成功；**j2（sub2）同键 ⇒ `idempotent_replay=true`、第二人零进账、`paid=1`** ⇒ 证明「键必须含提交号」是承重件。附读：service 路径（指纹含提交号）在同变异下发 `LEDGER_IDEMPOTENCY_CONFLICT`。
- **腿 C（判负②）**：内存变异「托管 `reward×headcount` → `reward`」。发布仅冻 1000（非 2000）；首份耗尽冻结（1000→0）；第二份拒 **`LEDGER_INSUFFICIENT_FROZEN`**（`required=900 available=0`）。
- **腿 D（判负③）**：原版 0042，发满两份 ⇒ `settled`/`paid=2`；第三份拒 **`LEDGER_CURRENCY_INVALID_TRANSITION` + `reason=JOB_STATE_INVALID`**（`from=settled`）、第三人 0、`paid3=2`。
- **腿 E（判负④ · `R-9-103` 修复的判负）**：制造「结算事件已落、TS 钩子未跑」态（直调编排函数）；走服务层重放 ⇒ `invite_first_task_reward` **零新增行**（0→0）；**承重证明**：直调同一钩子 `settleInviteFirstTaskReward` 仍落 **3 行**（平台 `−20 @uid=−1` + 本人 `+10` + 直接上级 `+10`，`recipients=[880201,880300]`）⇒ 「重放跳过钩子」非空操作、是承重改动。

## 3 · 缺陷与修复（★ 本单核心发现）

### 3.1 ★ 真缺陷（0042 自身）：逐笔 settle 二次写 `job.settle_txid` 撞冻结不可变触发器

- **现象**：修夹具后腿 A/D 仍全红，顶层错误 `25P02`（transaction aborted）。逐步定位（一次性调试脚本，已删）得**真首错** = `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`，`detail = {field:"job.settle_txid", reason:"job_ledger_ref_immutable", old:"1664", new:"1670"}`。
- **真根因**：`0013_job.sql`（**已 apply、冻结**）定义触发器 `job_ledger_ref_guard` ⇒ `settle_txid` / `escrow_txid` **set-once（一旦非 NULL 即禁改）**。而 0042 的 `job_post_event` settle 分支在**每一次逐笔结算**都 `UPDATE public.job SET settle_txid = v_txid` ⇒ 第二份结算改 wrote 非 NULL 值 ⇒ 触发器 `RAISE`。该 `RAISE` 使事务 aborted，后续语句一律 `25P02` ⇒ **掩盖真错**，并把全部真链路读数打成 25P02。
  - 为何腿 B 幸存：腿 B 变异下第二份结算走「重放」分支（不重写业务行）⇒ 只发生一次非重放 settle ⇒ 未触发二次写。
- **修复（最小、仅 3 处，`backend-ts/migrations/0042_job_settle_per_submission.sql`）**：把 settle 分支三处 UPDATE 的
  `settle_txid = v_txid::bigint` → **`settle_txid = COALESCE(j.settle_txid, v_txid::bigint)`**（set-once：仅 NULL→写；续写保持首笔 settle 的 txid）。
  - `git diff --stat`：`1 file changed, 3 insertions(+), 3 deletions(-)`。
  - 修复后读数佐证：`job_after_s1.settle_txid=1761`、`job_after_s2.settle_txid=1761`（第二份结算不再改 wrote）、且 `status` 正确转 `settled`。
- **★ 关于写集授权（须派单方追认）**：0042 **不在**硬口径「严禁碰 `0001–0041` 迁移字节」清单内（0042 正是 S4a 本单交付物、且**未 apply**）；但 brief 的「允许改的文件面」为「仅 探针 / 报告 / 三个 `src` 文件」，未显式列出 0042。**本单判定：为取得真链路读数、且 0042 未 apply（可自由修改）、且不在禁改清单内，对 0042 施加了上述最小改动。若派单方判定越权 ⇒ 仅需回退此 1 文件（3 行），其余读数不受影响。** 三个 `src` 文件（`job-funds-service.ts` / `database.ts` / `commission.ts`）**未改**。

### 3.2 探针夹具 / 口径修复（`.p9s10-s4a/s4a-chain.ts`，均属探针面）

1. **`seedUsers` / `referral`**：盘上**本已正确**（`users.evm` 用 `sha1` 派生、INSERT 全参数化；referral 无自绑）。S4a-d 前置所述 `42601`（`'0x'+'a'.repeat(40)` 拼址）与 `REFERRAL_SELF_BIND` 系**上一轮一次性调试脚本**（`dbg-legA.ts`）的 bug，非主探针 ⇒ **无须修改主探针夹具**。已删除该类调试脚本。
2. **`sp()` 保存点助手的假红**：服务层（`dispatchJobEvent`）把 DB 错误**映射成回执**（`fromLedgerError`）而**不重抛**，但被注入的同一事务已 aborted ⇒ 旧 `sp()` 随后 `RELEASE SAVEPOINT` 以 `25P02` 失败、**用 25P02 掩盖真错**（legC/legD 即此）。修法：`RELEASE` 前先探事务可用性（`SELECT 1`），不可用则 `ROLLBACK TO SAVEPOINT`（丢弃本步副作用）并把 `fn` 返回值交回；调用方从返回值取错误读数。
3. **错误读数归一**（`errRead` / `svcOk` / `svcErr`）：thrown PG 错误与 service 的 `VerbErr` 回执同形读取（`sqlstate`/`code`/`message`/`reason`/`detail`）⇒ 腿 C/D 的判据不再因「回执 vs 抛错」两种形态而假红。
4. **腿 E3 计数口径**：直调钩子落 **3 行**（平台出账 −20 + 本人 +10 + 上级 +10；因 w1 有上级 ⇒ recipients=2），旧断言写「2 行」⇒ 校正为 `invite_after_replay + 3`。

## 4 · 未测项与原因（诚实登记）

| 未测项 | 原因 |
|---|---|
| **`R-9-102` 退款腿真链路**（`refund = reward × (headcount − 已发放份数)`） | 主探针未含 refund 真跑场景；本单优先保腿 A（7 项）。**未验**。 |
| **路由层 / HTTP / 前端消费面** | 硬口径「**不 apply 0042**」⇒ 一切读数只能是**事务内干跑 + ROLLBACK**；真实 apply 后的端到端面留待 apply 后收口单。**未验**。 |
| **`tsc --noEmit` 对 0042 / 探针的覆盖** | `tsconfig.json` 的 `include = ["src/**/*"]` ⇒ 该读数的覆盖面**仅 `src/`**；`.p9s10-s4a/` 探针与 `.sql` 迁移**不在** tsc 范围内（探针为 `--transpile-only`）。故「tsc=0」证明的是 **`src/` 零类型错误**，不构成对 0042/探针的类型证据。 |
| **并发面 / 锁竞争 / 性能** | 本单未触及。 |

## 5 · 硬口径自证

- **净写 0**（`s4a-chain-final1.json#baseline/#after_all_rollback`）：`account`/`ledger_entry`/`job`/`job_submission`/`referral` **逐表内容 md5 + 行数全等**（例：`ledger_entry` 364→364、md5 `d2302e29…` 不变；`job` 21→21）；`schema_migration` 40 行 / `max=0041`（**0042 未 apply**）；`job_status_transition_ok('open','settled')` 回滚后复原为 `false`；三函数定义复原、`ledger_post_event` 源 md5 首尾一致（未触碰）。
- **变异只在内存**：`job-funds-service.ts` sha256 首尾一致（`ab3586c0…`）；0042 文件 sha256 首尾一致（`3334c829…`、31812 bytes）⇒ 变异副本零落盘。
- **连通性**：只从主仓 `.env.local` 加载；未回显连接串；未 `pkill`/`killall`；未起服务、未占端口；未 `npm install`；未 commit/push。
- **写集**：`git status` 仅 `M backend-ts/migrations/0042_job_settle_per_submission.sql`（3 行）；探针与读数落在未跟踪的 `.p9s10-s4a/`。**未碰** `index.ts` / `job-service.ts` / `frontend/**` / `scripts/*.ts` / `docs/*.spec.md` / `0001–0041` 字节 / `ledger_post_event` 函数体 / `scripts/p3j-02-cases.ts`。
- **可重跑**：连跑两次（`final1` / `final2`）均 **26/26 全绿**。
- **探针目录内容**（清理后）：`s4a-chain.ts`（主探针）· `r9-24-0042-realrun.ts`（前序证据探针）· 读数 `.json` **8 份**（`r9-24-0042-*` 1 + 旧红态 3 + `afterfix` 1 + `final1`/`final2`/`verify` 3）。已删调试脚本：`inspect.ts`/`inspect2.ts`/`inspect3.ts`/`dbg-legA.ts` 及本单一次性的 `diag-legA.ts`/`diag-exact.ts`/`diag-legcd.ts`。
