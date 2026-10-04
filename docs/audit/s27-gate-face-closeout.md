# S27 · `0043` apply 后的门面/库面收口（三件）

> 角色：**Kong（实现方）** · 日期：**2026-10-04** · 仓库：`/Users/kevin/bistro/seafood`
> 本单 = ① `p8-s3 D5` / `p8-s3b F4` 改锚（**加严**）② 库面前推 `41/0042 ⇒ 42/0043` ③ 修被 `0043` 打断的旧探针 `p4z-b6audit-02-idemkey.ts` ④ 全量门前后对照复跑。
> 产物：`backend-ts/.s27-artifacts/s27-20261004T132113Z/{before,after}/`（原始 stdout，非 `.log` 后缀）。
> 硬口径遵守：**未改产品代码**（`backend-ts/src/**`、`frontend/**`）· **未 apply / 未跑** `scripts/migrate.ts` · 未改 `migrations/**` / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md` · 未 `pkill -f`/`killall` · 未 commit/push · 未 `npm install` · 未 `source` `.env*`（只读连库一律**进程内** `dotenv.config({ path: '<主仓绝对路径>/backend-ts/.env.local' })`）。

---

## §0 对锚

**版本锚**

| 项 | 值 |
|---|---|
| 开工 `git log --oneline -3` HEAD | `6d2ca98`（docs: §5.343 —— S25/S26 回执 + 派 S27） |
| 开工 `git status --porcelain`（tracked） | **干净**（仅 `??` 既有产物） |
| 收工 HEAD | `2feded4`（**并发 = Zang 自己的 §5.344 提交**：apply `0043` 回执 + 派 S27∥S28；**非本单所为**，见 §6.3） |
| 本单 tracked 改动 | `backend-ts/scripts/` 下 **7 个**文件（见 §6.3 `git status`） |

**库面已 apply 读数（我现取 · 只读 · 进程内 dotenv）**

```bash
cd backend-ts && npx ts-node --transpile-only -e "… SELECT count(*),max(version) FROM public.schema_migration …"
```

| 读 | 值 |
|---|---|
| `schema_migration` 行数 | **42** |
| `max(version)` | **`0043`** |
| `public` 非内部触发器（`NOT tgisinternal`） | **69** |
| 其中 `TRUNCATE` 位启用（`(tgtype & 32) ≠ 0`） | **15** |
| 末 3 行（version/name） | `0043_truncate_guard.sql` / `0042_job_settle_per_submission.sql` / `0041_job_headcount.sql` |

与 Zang 定稿（触发器 **54→69**、TRUNCATE **15 枚全启用**、`TRUNCATE public.rating ⇒ P0001`）逐条一致。`0043` 文件 checksum 锚由 Zang 已取（`60bcd0c2…`），本单**未重算、未 apply**。

---

## §1 `p8-s3 D5` / `p8-s3b F4` 改锚（前后逐字对照）

**出处**：`CURRENCY_LIST_DEPOSIT_FLOOR` = **50000** 由 **Kevin 2026-10-04 定值**（批 8③：`AK2` 为主导真源、本常量降为 fail-closed 兜底，`currency-service.ts:142/147-148`）；S23 按 A1 定档把该文件内旧标记 `TODO: Kevin 定值` **改写**为「`Kevin 2026-10-04 定值 50000`」。旧判据「要求旧 TODO 标记在场」因此**滞后恒红**。

### §1.1 `p8-s3-deposit-gate.ts` `D5`（2 行）

改前（`/TODO: Kevin 定值/.test(CURRENCY_TS)`）：

```ts
  t('D5', 'failClosed', /TODO: Kevin 定值/.test(CURRENCY_TS),
    '兜底常量标 `TODO: Kevin 定值`（**不得发明数值**）', /TODO: Kevin 定值/.test(CURRENCY_TS));
```

现取判负：`currency-service.ts` 内 `TODO: Kevin 定值` **零命中** ⇒ `false` ⇒ **`p8-s3 44/45`（红 D5）**。

改后（两件同时成立 · 加严）：

```ts
  // 出处：`CURRENCY_LIST_DEPOSIT_FLOOR` = 50000 由 **Kevin 2026-10-04 定值**（批 8③ `AK2` 为主导真源、
  //   本常量降为 fail-closed 兜底）；S23 按 A1 定档把 `currency-service.ts` 内旧标记 `TODO: Kevin 定值`
  //   改写为「`Kevin 2026-10-04 定值 50000`」⇒ 旧判据（要求旧 TODO 标记在场）**滞后恒红**。
  //   本判据**加严**为两件同时成立：常量现取真值 == 50000 **且** 已定值标记在场；仍**不得发明数值**。
  const d5FloorIs50000 = CURRENCY_LIST_DEPOSIT_FLOOR === 50000;
  const d5MarkerPresent = /Kevin 2026-10-04 定值/.test(CURRENCY_TS);
  t('D5', 'failClosed', d5FloorIs50000 && d5MarkerPresent, …);
```

现取：`{"constant":50000,"marker_present":true}` ⇒ `true` ⇒ **`p8-s3 45/45`**。

### §1.2 `p8-s3b-address-gate.ts` `F4`（2 行）

同款改法（文案「不得发明**保证金**数值」）。现取：`{"constant":50000,"marker_present":true}` ⇒ `true` ⇒ **`p8-s3b 38/38`**（改前 `37/38`）。

### §1.3 不是放宽

- 判据**由 1 件（旧标记在场）⇒ 2 件同时成立**（常量真值 == 50000 **且** 已定值标记在场）——**合取只增不减**。
- 保留「**不得发明数值**」语义：值须等于**现取真值** `50000`（非门自造），标记须为 **Kevin 定档文案**（非任意串）。
- 未删该行、未改成恒真、未去语义。

---

## §2 库面前推 `41/0042 ⇒ 42/0043`（穷举逐处判定）

**穷举命令（我重跑，与 Zang 同一口径）**

```bash
grep -rn "41\b\|0042" backend-ts/scripts/*.ts | grep -iE "migra|schema|applied"
```

**改前命中 11 处**，逐处判定：

| # | 处 | 形态 | 判定 | 依据 |
|---|---|---|---|---|
| 1 | `p8-s9-bttc-gate.ts:516` `K5` | `Number(sm[0].n) === 41 && String(sm[0].mx) === '0042'` | **属（前推）** | 读**库面已 apply 行数 + 版本串**（活体只读）⇒ 现库 42/`0043` ⇒ 已前推 |
| 2 | `p8-s10-invite-reward-gate.ts:329` `K2` | `Number(sm.n) === 41 && String(sm.mx) === '0042'` | **属（前推）** | 同上 |
| 3 | `p8-s11-audit-console-gate.ts:469` `K1` | `Number(sm.n) === 41 && String(sm.mx) === '0042'` | **属（前推）** | 同上 |
| 4 | `p8-s9-bttc-gate.ts:11`（头注释） | `schema_version = 0042 · schema_migration 41 行` | **属（前推）** | 库面现状描述（改后 → `0043` / 42 行） |
| 5 | `p8-s9-bttc-gate.ts:29`（头注释） | `schema_migration 41·0042` | **属（前推）** | 同上 |
| 6 | `p8-s9-bttc-gate.ts:356`（注释） | `schema_version = 0042 · schema_migration 41 行` | **属（前推）** | 同上 |
| 7 | `p8-s9-bttc-gate.ts:405`（注释） | `schema_version = 0042 · schema_migration 41 行` | **属（前推）** | 同上 |
| 8 | `p8-s9-bttc-gate.ts:761`（artifact `note`） | `schema_version 0042 · schema_migration 41 行` | **属（前推）** | 同上 |
| 9 | `p8-s10-invite-reward-gate.ts:12`（头注释） | `schema_migration 41·0042` | **属（前推）** | 同上 |
| 10 | `p8-s11-audit-console-gate.ts:11`（头注释） | `schema_migration 41·0042` | **属（前推）** | 同上 |
| 11 | `p3j-02-cases.ts:101`（注释） | 引用 `migrations/0042…sql:57-67` | **不属** | **语义 / 文件行段引用**（行为参照，非库面 apply 行数或版本串）；与迁移条数无关 ⇒ **不改** |

**改后判定结果**：属者 **10 处全前推**（3 门 `K` 判据 + 7 处注释/note），不属者 **1 处不动**。**穷举外无其它「库面版本串」命中**——但见 **§2b**：另有一类**库面红与版本串无关**（触发器计数），由 `0043` 诱导，**不在本 grep 射程**，已一并收口。

每处前推均带出处注释（示例，`p8-s9 K5`）：

```ts
    // ★ S27 库面前推（出处 = 本批 apply `0043_truncate_guard.sql`；S26 建、Zang apply）：
    //   库面 `schema_migration` 41 行/`0042` ⇒ **42 行/`0043`**（15 张 append-only 表各补 1 枚 `BEFORE TRUNCATE` 守卫）。
    t('K5', 'dbStructureLive', Number(sm[0].n) === 42 && String(sm[0].mx) === '0043', …);
```

> **未碰** `MIGRATIONS_FROZEN`（S26 已前推至 `42`，持于 4 门：`p8-s3:84` / `p8-s3b:73` / `p8-s4:71` / `p8-s5:80`）——本单**只碰库面读法**。

---

## §2b 穷举外发现（grep 不命中）—— `p8-s8` `L5`/`L6`

`grep "41\b\|0042"` **不命中**，故不在 ② 命名范围；但它们是**确定性、非环境性的 `0043` 诱导红**（读的是库面**触发器计数**，非版本串）：

| 门 · 判据 | 改前现取 | 成因 | 处置 |
|---|---|---|---|
| `p8-s8-rating-timeliness-gate.ts:513` `L5` | `trg=["trg_rating_append_only","trg_rating_no_truncate"]` ⇒ `rTrg.length === 1` **false** | `0043` 在 `rating` 上新增 `BEFORE TRUNCATE` 守卫（`tgtype=34`），原查询 `WHERE NOT tgisinternal AND tgrelid=…` **无 tgtype 过滤** ⇒ 误计第 2 枚 | **加严修复** |
| `p8-s8:532` `L6` | `trg=["trg_listing_order_event_append_only","trg_listing_order_event_no_truncate"]` ⇒ 同 | 同上 | **加严修复** |

**修法（加严，非放宽）**：判据由「恰 **1** 枚触发器 + 行级 append-only」改为「恰 **2** 枚 + **同时**存在 1 枚行级 append-only（`BEFORE UPDATE OR DELETE`）**且** 1 枚 `BEFORE TRUNCATE` 守卫」：

```ts
        && rTrg.length === 2
        && rTrg.some((x) => /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/.test(x.def))
        && rTrg.some((x) => /BEFORE TRUNCATE/.test(x.def)),
```

- **只增判据、不减**：把 `0043` 的合法新增对象**纳入**断言（并断言它确实是 `BEFORE TRUNCATE` 守卫）。
- 旁证：仓内 `p8-s11 K5` 早已用 `(tgtype & 27) = 27` 惯用法；`L5/L6` 原查询缺此过滤才是「过宽」。
- 效果：`p8-s8` **68/74 → 70/74**，回到 Zang §5.343 基线（余 4 红 = `V1` + `H5/H6/H7`，均非本单）。

> **范围说明**：此项**超出 ② 的 grep 命名集**。我据「收口 = 消除 `0043` 诱导的确定性非环境红」+ AC2「无新增非环境红」+ 派单「我可能漏」而一并修复，并在 §6.1 自曝。若判定越界，revert 该 2 处判据即可（但 `p8-s8` 将留 2 枚确定性非环境红）。

---

## §3 旧探针 `p4z-b6audit-02-idemkey.ts`（前后读数）

### §3.1 改前 = 被拦（`P0001`）

单独复现「无 `DISABLE/ENABLE` 旁路、在已建 `0043` 守卫生效的 schema 上」：产物 `after/probe-variant-no-disable-trigger.{ts,out.txt}`

```
fatal: admin_ops_audit_log is append-only: TRUNCATE forbidden
fatal_code: P0001
EXIT=4   （已完成 6/6 早期判据，止步于 TRUNCATE）
```

⇒ **`0043` 的 `BEFORE TRUNCATE` 守卫确拦该探针的裸 `TRUNCATE`**（与 Zang 读数同形：`P0001`）。

### §3.2 改后 = 能跑完

```
EXIT=0   total=13 passed=13 failed=0 ok=true
net_zero(I1)=true   （真库 ledger_entry / Σ(account.balance,cid=1) / account 行数逐字不变）
skipped_files = [ '0036_commission_policy_p9_5.sql' ]（见 §3.3 · 与 0043 无关）
```

### §3.3 该项**不止** `DISABLE/ENABLE` 一处（Kevin ③ 前提不完整）

原样探针**并非**先死在 TRUNCATE，而是**更早**死在重放：

| 阶段 | 现象 | 根因 |
|---|---|---|
| 原样运行（未改） | `fatal: replay failed at 0024_admin_refund_audit.sql` · `0024 self-check FAILED: upstream migration rows 0022/0023 = 0 (expect 2)` | 探针只在事务内 `CREATE TABLE schema_migration`，**从不登记行**；而 `0024`–`0027`/`0036`/`0043` 的 apply-time 自检会 `SELECT count(*) FROM public.schema_migration WHERE version IN (…)` ⇒ 自 `0024` 落地（`9805876`，2026-10-02）起重放必败。探针末次全绿 artifact 在 `0024` 之前（`p6b6audit-idemkey-20261002015709`，13/13）。 |

**因此为使 AC3「能跑完」成立，除 `DISABLE/ENABLE` 外另需三处最小必要改动**（均**加严/如实重放**，非放宽）：

1. **逐文件登记 `schema_migration` 行**（同 `migrate.ts`：version + name + sha256）—— 重放如实走迁移链的前置。
2. **逐文件 `SAVEPOINT` 容错**：单文件 apply-time 自检失败（如 `0036` 期望 3 行历史 `commission_policy`，而该种子数据**非迁移来源** ⇒ 干净 scratch schema 天然不满足）只回滚该文件、**不连带整链**（跳过的文件在 `replay_log` 登记）。被测面（`0023` 审计表幂等键）对象全部 ≤ `0023` ⇒ 不受跳过影响。
3. **`J1` 冻结计数前推 `67 → 89`**（注册点现取 89 = 门套件 `REG_POINTS_FROZEN`；探针冻结于 `P6-B6-AUDIT` 时代 67，S11 等多批合法新增路由 ⇒ 旧值恒红，**与 `0043` 无关**）。

改动均为**门/探针脚本面**（未碰 `src/**`）；`TRUNCATE` 旁路形态沿本仓先例 `purge-test-data.ts:220/257`（`ALTER TABLE … DISABLE TRIGGER USER` → 操作 → `ENABLE TRIGGER USER`）。探针全程单事务 ⇒ 上述 DDL 随末尾 `ROLLBACK` 消失，**真库零位移**（`I1 = net_zero` 为证）。

---

## §4 全量门前后对照表（11 门 + `p7b-03`）

> 「前」= 收口前（`0043` 已 apply、门/探针未改）；「后」= 改动后。退出码 + `total/passed/failed` + 红点。
> 运行：`cd backend-ts && npx ts-node --transpile-only scripts/<gate>.ts`（退出码管道外捕获）。

| 门 | 前 | 后 | 红点（前） | 红点（后） | 定性 |
|---|---|---|---|---|---|
| `p8-s1-app-config-gate` | `0` · 24/24 | `0` · 24/24 | — | — | 逐条不变 ✓ |
| `p8-s2-fee-rebate-gate` | `0` · 44/44 | `0` · 44/44 | — | — | 逐条不变 ✓ |
| **`p8-s3-deposit-gate`** | `1` · **44/45** | `0` · **45/45** | **`D5`** | — | **① 改锚 ⇒ 转绿** ✓ |
| **`p8-s3b-address-gate`** | `1` · **37/38** | `0` · **38/38** | **`F4`** | — | **① 改锚 ⇒ 转绿** ✓ |
| `p8-s4-currency-review-gate` | `0` · 79/79 | `0` · 79/79 | — | — | 逐条不变 ✓ |
| `p8-s5-compliance-gate` | `0` · 117/117 | `0` · 117/117 | — | — | 逐条不变 ✓ |
| `p8-s6-site-text-gate` | `0` · 64/64 | `0` · 64/64 | — | — | 逐条不变 ✓ |
| `p8-s7-batt-checkin-gate` | `1` · 56/59 | `1` · 56/59 | `G8`,`G9`,`G10` | `G8`,`G9`,`G10` | **环境性**（无受控实例 · `fetch failed`）逐条同 ✓ |
| **`p8-s8-rating-timeliness-gate`** | `1` · **68/74** | `1` · **70/74** | `L5`,`L6`,`V1`,`H5`,`H6`,`H7` | `V1`,`H5`,`H6`,`H7` | **②b `L5/L6` 收口 ⇒ 回到基线 70/74**；余 `V1`（预存库态）+ `H5/H6/H7`（环境性）✓ |
| **`p8-s9-bttc-gate`** | `1` · **99/100** | `0` · **100/100** | **`K5`** | — | **② 库面腿 ⇒ 转绿** ✓ |
| **`p8-s10-invite-reward-gate`** | `1` · **47/49** | `1` · **48/49** | **`K2`**,`K8` | `K8` | **② `K2` 转绿**；余 `K8`（环境性 · `fetch failed`）✓ |
| **`p8-s11-audit-console-gate`** | `1` · **85/87** | `1` · **86/87** | **`K1`**,`K10` | `K10` | **② `K1` 转绿**；余 `K10`（环境性 · `fetch failed`）✓ |
| `p7b-03-offline-gates` | `0` · 37/37 | `0` · 37/37 | — | — | 逐条不变 ✓ |

**红点分流（后）**：仅 **4 类**，**无一是本单改动引入**：
1. **环境性（无受控实例真 HTTP）**：`p8-s7 G8/G9/G10`、`p8-s8 H5/H6/H7`、`p8-s10 K8`、`p8-s11 K10` ⇒ 全部 `fetch failed` / status `-1`，与改前**逐条相同**。
2. **预存库态（非 `0043`、非本单）**：`p8-s8 V1`（`duplicate key … job_submission_pk`，事务内夹具与既有库态碰撞；改前改后同红）。
3. 无第 3 类。

**结构证明（改动面 ∩ 三门读取面 = ∅ 之外的每处红）**：本单三项改动的读取面 = `D5/F4`（读 `currency-service.ts` 文本 + 常量）、`K5/K2/K1`（读 `schema_migration` 行数/版本）、`L5/L6`（读 `rating`/`listing_order_event` 触发器集合）、探针（读自带 schema）。上表任一**残余红**的读取面均**不含**上述任一；且残余红在前/后两跑逐条相同 ⇒ 与改动面交集为 ∅。

---

## §5 未做与 NOT_MEASURED

| 项 | 状态 | 说明 |
|---|---|---|
| `0043` apply / `scripts/migrate.ts` | **未做（硬口径：禁）** | 库面已由 Zang 于 §5.344 定稿；本单未跑迁移 |
| `p8-s7/s8/s10/s11` 的**受控实例真 HTTP 腿** | **NOT_MEASURED** | 未起受控实例（端口内保持空）；对应红点分类为**环境性**（`fetch failed`），与改前逐条相同 |
| `p8-s8 V1`（`job_submission_pk` 夹具碰撞）根因 | **NOT_MEASURED（预存 · 越界）** | 改前即红、与 `0043` 及本单改动无关；未深挖 identity 序列漂移根因（属既有库态/夹具面） |
| 旧探针中 `0036` 因**非迁移来源种子数据**被跳过 | **记录（非缺陷）** | 干净 scratch schema 天然无该种子 ⇒ 单文件跳过、不连带整链；被测面（`0023`）不受影响 |
| `0043` 文件 checksum 重算 | **未做** | 沿用 Zang 已取锚 `60bcd0c2…`；本单未重复计算 |
| 其它 `p3j-02-cases.ts:101` 等**语义引用** `0042` | **不属（不改）** | 见 §2 第 11 行 |

---

## §6 自曝

1. **③ 的派单前提不完整（我据实扩修）**：Zang 判断旧探针「`apply 0043` 后必失败（`P0001`）」，实况是**更早**即死于重放（`0024` 起 apply-time 自检依赖 `schema_migration` 登记行）。⇒ 除 `DISABLE/ENABLE` 外，我另加「`schema_migration` 登记 + 单文件 `SAVEPOINT` 容错 + `J1` 前推」三处最小必要改动，方使 AC3「能跑完」成立。**若 Kevin 只要最小 diff**，可仅保留 `DISABLE/ENABLE`，但探针将**无法跑完**（重放即败）。
2. **§2b 越出 ② 命名范围（我据实扩修）**：`p8-s8 L5/L6` 是 `0043` 诱导的**确定性非环境红**（触发器计数），`grep "41\b\|0042"` 不命中。我按「收口 + AC2 无新增非环境红 + 派单『我可能漏』」一并**加严**修复（不是放宽）。**登记为可能越界项**，revert 成本 = 2 处判据。
3. **并发写者（非本单）**：本单收工 `git status` 见 `frontend/src/test/unit/i18n-violation-closeout.test.jsx`、`frontend/src/test/unit/r9-90-participate-surface.test.jsx`（`M`）与 `docs/audit/s28-retired-key-guards.md`、`frontend/.s28-artifacts/`（`??`）——均属**并行 S28 会话**（派单 §5.344 E：S27∥S28，面不相交）。**本单未触碰 `frontend/**`**。HEAD 的 `6d2ca98 → 2feded4` 亦为 Zang 自己的提交。
4. **`V1` 未修**：`p8-s8 V1` 改前即红（预存库态），我未修（越界、且与 `0043`/本单无关），仅登记。
5. **本单未起受控实例**：故 `p8-s7/s8/s10/s11` 的 HTTP 腿读数沿用「改前 = 改后」的环境性红，未做真 HTTP 复测。
6. **`p8-s9/s10/s11` 的库面腿已转真绿**（`100/100`、`K2` 绿、`K1` 绿），其**真 HTTP 腿**面（`s10 K8`/`s11 K10`）本单维持 `NOT_MEASURED`（无实例）。

---

### 附：本单 tracked 改动清单

```
 M backend-ts/scripts/p4z-b6audit-02-idemkey.ts       （③：DISABLE/ENABLE + 登记 + SAVEPOINT + J1 前推）
 M backend-ts/scripts/p8-s3-deposit-gate.ts           （① D5 改锚）
 M backend-ts/scripts/p8-s3b-address-gate.ts          （① F4 改锚）
 M backend-ts/scripts/p8-s9-bttc-gate.ts              （② K5 前推 + 5 处注释）
 M backend-ts/scripts/p8-s10-invite-reward-gate.ts    （② K2 前推 + 1 处注释）
 M backend-ts/scripts/p8-s11-audit-console-gate.ts    （② K1 前推 + 1 处注释）
 M backend-ts/scripts/p8-s8-rating-timeliness-gate.ts （②b L5/L6 加严收口）
```

> `npx tsc --noEmit` = **exit 0**（AC4 ✓）。`git status` 中除本 7 文件外的 `M`/`??` 均属并行 S28 会话或既有产物（见 §6.3）。
