# R3-P2b 交付报告 · P2 两条迁移（`0007` + `0008`）与真库取证

> 单号：R3-P2b（Kong · 落库实现）｜权威口径：`docs/commission.spec.md` **v0.2** + `docs/seafood.master-plan.md` §5.19/§5.20/**§5.21**
> 开工 HEAD：`55d560776c10cb848924f384fc553f8abbf6acab`（`55d5607 spec 收口：… commission.spec v0.2 … P2 改为 0007+0008`）
> 落盘读数目录：`backend-ts/.p2b-artifacts/`（run-tagged，**只新增**）｜质检资产 / `0001`–`0006` / `docs/**` / `frontend/**` **零改动**（`git status` 只有新增文件）
> 未 commit / 未 push。

---

## 1 交付物

| 文件 | 内容 |
|---|---|
| `backend-ts/migrations/0007_referral_and_commission_policy.sql` | `referral` + `commission_policy` + 4 个触发器 + 权重守卫 + 默认政策种子 + 防环（自指禁令/祖先检查/串行化）+ `referral_bind()` + **CR80 只读后置断言触发器** + 迁移自检（CR55） |
| `backend-ts/migrations/0008_platform_revenue_job_fee.sql` | `CREATE OR REPLACE` 扩 `-1` 的 credit 白名单加 `job_fee`（**不改 `0004`**）+ 双向自检（正向 3 格不丢 / 负向 5 格仍拒） |
| `backend-ts/scripts/p2b-00-probe-schema.ts` | 写库前 schema 侦察 + **CR80 相容性对拍** |
| `backend-ts/scripts/p2b-01-forensics.ts` | 物理取证 + INSERT-only + 政策守卫负例 + 白名单函数级正/负 + 关闭集 + **`码⇒SQLSTATE⇒落桶` 探针** |
| `backend-ts/scripts/p2b-02-cases.ts` | 2-环判负 + 串行化取证 + M9 对照 + −1 端到端 ± + Σ 正/负 |
| `backend-ts/scripts/p2b-03-summary.ts` | 汇总清点（只读） |
| `.p2b-artifacts/p2b-01..p2b-11-*.json` / `-*stdout*.txt` | 全部原始读数（run tag 见文件名） |

## 2 迁移幂等（`npx ts-node --transpile-only scripts/migrate.ts`）

| 次 | action（0007 / 0008） | checksum(12) | schema_version | exit |
|---|---|---|---|---|
| 第 1 次 | `applied` / `applied`（917ms / 741ms） | `7044c6be33f7` / `e98ac1a0470e` | **0008** | 0 |
| 第 2 次 | `skipped` / `skipped`（`already applied, checksum match`） | 同上（一致） | **0008** | 0 |

`schema_migration` = 0001…0008（**既有 6 行未被删改**，`0006` 仍是 `4aa19b148700`）。
物理取证：8 张 public 基表（新增 `referral` / `commission_policy`）；`referral` 2 触发器、`commission_policy` 2、`ledger_entry` 2；
`trg_ledger_entry_commission_conservation` = **deferrable=true / initdeferred=true / enabled=O**；
种子政策 **恰 1 行**：`fee_rate_bp=100 / levels=10 / weights_bp={3000,2000,1500,1000,800,600,500,300,200,100} / effective_from=1970-01-01Z / created_by=0`。
INSERT-only 实测（UPDATE/DELETE 各 1 次）：`referral` P0001 `referral is append-only: UPDATE|DELETE forbidden` ✓；`commission_policy` P0001 ✓；`ledger_entry` P0001 ✓（**三张全拦**）。

## 3 判负用例（本单核心）

**① 2-环判负（裁定 #1 强制）** `p2b-04-cases-*.json`
- `A→B`（949001→949002）成功（`depth=1`，DB 侧算）
- `B→A` 两条路径**均被拒**：`referral_bind()` → `LD016 / LEDGER_AMOUNT_INVALID / 400 / reason=REFERRAL_CYCLE_REJECTED`；**裸 `INSERT`** → 同码同 reason（触发器是任何 INSERT 路径都绕不过的闸）
- 自指 `A→A` ⇒ `REFERRAL_SELF_BIND`；同 (C,P) 重提 ⇒ `idempotent_replay=true`；`A→949016` ⇒ `LD003 / 409 / REFERRAL_ALREADY_BOUND`
- **M9 对照**：`BEGIN; ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard; INSERT 两行;` ⇒ `cycles=100（步行上界）/ bad_depth=2`（红）→ `ROLLBACK` 后复测 `cycles=0 / bad_depth=0`（复原，零脏数据）

**② 绑定串行化（并发反向绑定）**
conn1 `BEGIN; referral_bind(949003,949004)`（未提交）⟷ conn2 `BEGIN; referral_bind(949004,949003)`：
- 1500ms 后 conn2 **仍在等待**（`conn2_still_pending_after_1500ms=true`）
- `pg_stat_activity` 抓到等待行：`wait_event_type=Lock / wait_event=transactionid / query=SELECT referral_bind(...)`
- conn1 `COMMIT` 后 **203ms** 内 conn2 得到 `LD016 / REFERRAL_CYCLE_REJECTED`（**串行化点确实关死了并发窗口**）

**③ 政策守卫负例**（全部 `23514` ⇒ `bucket=input` ⇒ **400** `LEDGER_AMOUNT_INVALID`；**全部在事务内跑并 ROLLBACK，政策表仍恰 1 行种子**）
`fee_rate_bp=99` ✓ / `=501` ✓ / `levels=11` ✓ / `Σweights=10001` ✓ / `Σweights=0` ✓ / **`w_1=0`** ✓ / `len≠levels` ✓ / 含负权重 ✓ / `created_by=-5` ✓ —— **9/9 被拒，无一条落 500，无新增错误码**（TS `LEDGER_ERROR_CODES.length=33`、DB `ledger_sqlstate_of` 覆盖 33 码，均未变）

**④ `-1` 白名单（正/负向）**
- 正向：`ledger_assert_platform_mutation(-1,'job_fee','credit')` 放行 + **端到端事件**（`job_payout` 解冻 40 → `-1` 收 `job_fee` 40）**入账成功**（`txid=2476`，`minus1_fee_in=40`、`minus2_net=0`、`commission_rows=0` = M3-C 形状）
- 负向（**证明没顺带松别的**）：`-1` credit `commission` ⇒ `LD021 / PLATFORM_CREDIT_KIND_FORBIDDEN`（端到端事件 0 行落库）；`-1` **任何 debit** ⇒ `PLATFORM_DEBIT_FORBIDDEN`；`-2` debit `job_fee`、`-2` credit `trade_fee` 仍拒；既有 3 格（`trade_fee`/`listing_fee`/`currency_create_fee`）未丢

**⑤ Σ 断言（CR80）**
- 正向：8 分录合法事件**通过**（`txid=2458`），回读 `pool_in=40 == paid_out=40`、`minus2_net=0`、`commission_rows=4`
- 负向 A（人为 Σ 不等）：`commission_out=30 ≠ pool_in=40` ⇒ **`LD032` / `LEDGER_RECONCILE_MISMATCH`**（`reason=COMMISSION_SPLIT_SUM_MISMATCH`），`rows_written_0=true`、该键 0 行
- 负向 B（**漏发全部佣金**：只有 `job_fee` 入 `-2`）⇒ 同样被拦（`commission_out=0 ≠ 20`）
- **码 ⇒ SQLSTATE ⇒ 落桶探针**：`ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH')='LD032'`；`ledger_error_for_sqlstate('LD032')` ⇒ `bucket=**defect**`（**500 类**）、未落 `input/400`；对照 `23514` ⇒ `input`（故**不得**裸抛 `23514`，本实现用 `ledger_raise` 走唯一投影表）
- ⚠️ 诚实附加读数：TS 侧该码 `status=null`（§14 #33「对账脚本退出码语义，不映射 HTTP」，`p1o` 显式豁免它）⇒ 若走 HTTP 层需响应层兜底 `status ?? 500`（**TS 单的第一件事**，本单未碰 TS）

## 4 P1 全量回归（动了平台守卫 ⇒ 强制）

| 套件 | 读数 |
|---|---|
| `npx tsc --noEmit` | **0 error**（输出 0 行，exit 0） |
| `scripts/ledger-smoke.ts` | `passed=29 / failed=0`（exit 0） |
| `scripts/ledger-smoke-db.ts` | `passed=11 / failed=0`（exit 0） |
| `scripts/p1f-01-f1-collision.ts --assert` | `pass=true`、`failures=[]`、verdicts **14/14 全 True** |
| `scripts/p1f-02-f2-malformed.ts --assert` | `pass=true`、`failures=[]`、verdicts **23/23 全 True**（`no_500_class_outside_defect_bucket` 仍 True） |
| `scripts/p1o-00-escape-sweep.ts --phase after --assert` | **全绿**：`raw_sqlstate_escapes=0 / unmapped=0 / missing_status=0 / ld_sqlstate_no_leak=0 / unexpected_500=0 / expectation_mismatches=0`；604 格 |

## 5 相容性对拍（§5.21 #4）

写库前（`p2b-00`，全表 240 行）：`kind='job_fee'` 行 **0 条**、`kind='commission'` 行 **0 条** ⇒
**不存在**「有 `job_fee` 入 `-2` 而无 `commission`」的历史 / 回归行；`scripts/*.ts` 亦**零引用** `job_fee`
⇒ **无需收窄到「含 commission 行的事件」**。但本实现仍以「**相关行**」为触发条件
（`commission∧uid=-2` 或 `job_fee∧uid=-2∧delta>0`）——它同时满足 CR80 原文与「不让历史形状被判死」；
代价（已认）：事件内**既无** `job_fee` 入 `-2` **又无** `commission` 时断言不触发（正常 P2 四形状里只有零额/无邀请人属于此类，且它们本就无池子）。
现库复核（`p2b-11`）：除本单测试键 `ops:p1q:*` 外，该形状仍 **0 行**；P1 六套回归全绿 ⇒ 新断言**未**判死任何旧用例。

## 6 测试数据（分区 uid 949xxx / symbol `p1q` / 键 `ops:p1q:*`；**未触碰 cid=1 与平台账户真实余额**）

- `users`：949001-949004、949010-949016（11 行）
- `currency`：**cid=124 `p1qP2B`**（owner 949010 / decimals 0 / listed）——唯一测试币，仅此一枚
- `referral`：2 行（949001→949002、949003→949004，均 depth=1）
- `commission_policy`：1 行（`0007` 种子）
- `ledger_entry`：cid=124 上 20 行（mint×2 / hold×8 / Σ正向事件 8 / −1 正向事件 2）；负例事件**0 行落库**
- 全库 `ledger_entry` 334 行（起始 240+）：增量含 P1 回归套件自身写入（既有行为）
- **未跑 `purge-test-data.ts`**（避免误删证据）；已核其 DELETE 目标仅 `ledger_entry`/`account`/`currency`/`ledger_owner`
  ⇒ **不会**清掉 `referral` / `commission_policy`（spec §15 #3 的担忧不成立，可登记）

## 7 未做 / 未验（诚实清单）

1. **TS 侧 `PLATFORM_KIND_WHITELIST['-1']` 未改**（本单明令不碰 TS 业务层）⇒ `0008` 的 DB 侧已放行、TS 侧前置校验尚未同步（CR85 ④ 要求两侧同改）＝下一单第一件事。
2. `0006`/`0001`–`0005` 未动，但 `0007` 引用了 `users(uid)` 的 FK —— **`users` 当前 0 行**（本单测试用户除外），FK 行为在真实用户写入路径上未测。
3. 「不可变」只到**护栏**强度：`TRUNCATE` 不触发行触发器；管理员 `DISABLE TRIGGER USER` 可旁路（M9 对照正是这么造出来的）——不得读作「绝对不可变」。
4. Σ 断言在**提交点**生效；未测「显式长事务里跨多语句增量补齐」的形态（P2 单语句契约下不可达）。
5. `-2` 的 TS 侧白名单/HTTP 响应层对该断言失败码的 status 兜底未定（见 §3 ⑤ ⚠️）。
6. `0007`/`0008` 未在**空库**从零跑过（本库已有 0001–0006）⇒ spec §15 #1 的「空库建库」未消除。
7. 未 commit / 未 push；未改 `docs/**`（spec 的 §14.2 #3/#4 回填由 Zang/Jing 决定）。
