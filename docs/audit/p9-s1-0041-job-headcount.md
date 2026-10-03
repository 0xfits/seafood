# S1 迁移 · `0041_job_headcount.sql`（Kong 实现单 · 自证报告）

- **角色**：Kong（实现）· **本单**：S1 迁移（仅新增 1 个迁移文件 + 自证）
- **仓库**：`/Users/kevin/bistro/seafood` · **HEAD**：`ef279d1`（开工时 `git log --oneline -1` 已核）
- **裁定锚**：`R-9-97`（task 无报名逻辑；悬赏家发布须说明总人数；每个合格都发奖；发布押 `reward × 人数`）· `R-9-24`（迁移真跑自证）
- **硬口径遵守**：**不 commit / 不 push**；**未 apply 到真库**（迁移只在「事务内 + `ROLLBACK`」里跑）；连库只读主仓 `backend-ts/.env.local`（未复制 env / 未回显密钥）；未 `npm install`；未 `pkill`/`killall`；未启停 5787/5788；未碰 `src/**`、`frontend/**`、其它 `docs/`、`0001`–`0040` 任何字节。

---

## ① `0013_job.sql` 现有列清单（现取 · `information_schema.columns`）

`public.job` — **14 列**（与 `0013` 自身 apply-time 断言「恰 14 列」一致）；`headcount` 基线**不存在**。

| # | 列名 | 类型 | 可空 | 默认 |
|---|---|---|---|---|
| 1 | job_id | bigint | NO | （identity BY DEFAULT） |
| 2 | employer_uid | bigint | NO | — |
| 3 | worker_uid | bigint | YES | — |
| 4 | cid | bigint | NO | — |
| 5 | reward | bigint | NO | — |
| 6 | title | text | NO | `''::text` |
| 7 | description | text | NO | `''::text` |
| 8 | status | text | NO | `'open'::text` |
| 9 | create_key | text | NO | — |
| 10 | escrow_txid | bigint | YES | — |
| 11 | settle_txid | bigint | YES | — |
| 12 | ledger_event_keys | text[] | NO | `'{}'::text[]` |
| 13 | time_created | timestamptz | NO | `now()` |
| 14 | time_updated | timestamptz | NO | `now()` |

现有 CHECK（2 个）：`job_reward_positive`（`reward > 0`）、`job_status_enum`（7 态白名单）。
真库现取：`public.job` **21 行**（非空）· `users` 56 行 · `currency` cid=1（`$`/listed）在场。

---

## ② `0041_job_headcount.sql` 全文

- 路径：`backend-ts/migrations/0041_job_headcount.sql`
- `sha256 = b6e506c307a16a7ec71b6fd6ce247379d4e5d43dc820e810102230c7d002b177` · `bytes = 5736`

```sql
-- ============================================================================
-- 0041_job_headcount.sql · P9 · `public.job` 新增「招募名额」列 `headcount`
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · 需求 **`R-9-97`**（Kevin 定档）：task（招工）**无「申请报名」逻辑**；悬赏家发布 task
--     时**须说明总人数**（= 招募名额上限）；**每个合格提交都发奖**（合格即发，不按名额截断）；
--     发布时**押全款 = `reward × 人数`**。⇒ `public.job` 需新增**名额列**（本迁移）。
--   · 本列语义（逐字兑现 `R-9-97`）：
--       `headcount` = 悬赏家发布时**必填**的**招募人数上限**（`>= 1`）；
--       存量行（`R-9-97` 之前发布、无此字段）**backfill = 1**。
--   · 名额最小口径：`headcount >= 1`（CHECK 约束名 `job_headcount_min`）；
--     发布押金 `reward × headcount` 的**派生/校验不属本迁移**（属路由/编排后续单）。
--
-- 本迁移做什么
--   ① `ALTER TABLE public.job ADD COLUMN IF NOT EXISTS headcount bigint NOT NULL DEFAULT 1`
--   ② 存量 backfill：`UPDATE public.job SET headcount = 1 WHERE headcount IS NULL`
--      （`DEFAULT 1` 在 `ADD COLUMN` 时已填充存量行；此句为**显式兜底**，幂等无害）
--   ③ CHECK 约束 `job_headcount_min`：`headcount >= 1`
--      （幂等手法：先 `DROP CONSTRAINT IF EXISTS` 再 `ADD CONSTRAINT`；删/加 CHECK **不丢数据**）
--   ④ `COMMENT ON COLUMN` 记录语义（便于库面自释）
--   ⑤ 末尾 apply-time `DO` 自检（结构断言：列在场 + 类型/可空 + 约束在场 + 无 NULL；
--      不通过 ⇒ RAISE ⇒ 整迁移回滚、**不写版本行**）
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0040` 任何文件字节**（checksum 冻结；`migrate.ts` 会整链 ABORT/exit 3）
--   · 不改任何既有列 / 约束 / 索引 / 触发器 / 函数；不新增 kind；不新增错误码
--   · 不写任何业务数据（**纯 DDL + 存量 backfill**）；不 `DELETE` / `TRUNCATE` / `DROP` 列
--   · 不接路由（`src/**` 本单不改）
--
-- 幂等（DL48）：`ADD COLUMN IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`；
--   末尾 apply-time `DO` 自检；任一失败 ⇒ 整迁移回滚、不写版本行。
-- 备注：`0013_job.sql` 的 apply-time 断言「public.job 恰 14 列（DL50）」只在其**自身**事务内生效
--   （`0013` 已 apply，`migrate.ts` 按 checksum 跳过、不重跑其自检）⇒ 本迁移把列数显式扩为 **15**，
--   **不动 `0013` 字节**，二者不冲突。
-- ============================================================================

-- ---------------------------------------------------------------- ① 新增列
ALTER TABLE public.job
  ADD COLUMN IF NOT EXISTS headcount bigint NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------- ② 存量 backfill
--   （`ADD COLUMN ... DEFAULT 1` 已填充存量行 ⇒ 本句通常 0 行；显式写出以兜底「若曾以可空形态存在」）
UPDATE public.job SET headcount = 1 WHERE headcount IS NULL;

-- ---------------------------------------------------------------- ③ CHECK 约束（幂等：先 DROP 再 ADD；不丢数据）
ALTER TABLE public.job DROP CONSTRAINT IF EXISTS job_headcount_min;
ALTER TABLE public.job ADD CONSTRAINT job_headcount_min CHECK (headcount >= 1);

-- ---------------------------------------------------------------- ④ 列注释（库面自释）
COMMENT ON COLUMN public.job.headcount IS
  'R-9-97：招募名额上限（悬赏家发布 task 时必填，>= 1）；发布押金 = reward × headcount。存量行 backfill = 1。';

-- ============================================================================
-- ⑤ apply-time 自检（DL48：不通过 ⇒ 整迁移回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_n      int;
  v_type   text;
  v_null   text;
  v_def    text;
  v_isnull int;
  v_rows   int;
BEGIN
  -- 5.1 列在场（恰 1 列）
  SELECT count(*)::int INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'job' AND column_name = 'headcount';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0041 self-check FAILED: public.job.headcount column not found (n=%)', v_n;
  END IF;

  -- 5.2 列型/可空：bigint NOT NULL
  SELECT c.data_type, c.is_nullable INTO v_type, v_null
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'job' AND c.column_name = 'headcount';
  IF v_type <> 'bigint' OR v_null <> 'NO' THEN
    RAISE EXCEPTION '0041 self-check FAILED: headcount type/nullable wrong (type=%, nullable=%)', v_type, v_null;
  END IF;

  -- 5.3 约束在场（CHECK）
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.job'::regclass AND conname = 'job_headcount_min' AND contype = 'c';
  IF v_def IS NULL THEN
    RAISE EXCEPTION '0041 self-check FAILED: constraint job_headcount_min missing';
  END IF;

  -- 5.4 存量无 NULL（backfill 完备性）
  SELECT count(*)::int INTO v_isnull FROM public.job WHERE headcount IS NULL;
  IF v_isnull <> 0 THEN
    RAISE EXCEPTION '0041 self-check FAILED: % rows with headcount IS NULL', v_isnull;
  END IF;

  SELECT count(*)::int INTO v_rows FROM public.job;
  RAISE NOTICE '0041 self-check OK: public.job.headcount bigint NOT NULL DEFAULT 1; job_headcount_min=%; rows=% (headcount IS NULL = 0)',
    v_def, v_rows;
END $$;
```

---

## ③ `R-9-24` 迁移真跑自证（单事务 `BEGIN; <0041 全文>; ROLLBACK;`）

- 探针：`backend-ts/.p9s7-impl/r9-24-dryrun.ts` · 读数：`backend-ts/.p9s7-impl/r9-24-0041-20261003T140427Zamv1.json`
- **21/21 全绿**（`failed = 0`）。腿 1 = 整份 0041 于回滚事务内执行（**含 §⑤ 自检**，通过）。**全程无 `COMMIT`**。

### 四项读数（逐项）

**① 事务内：列已存在 + CHECK 已存在** ✅
- `headcount`：`{column_name: headcount, data_type: bigint, is_nullable: NO, column_default: 1}`
- CHECK 在场，定义现取：`job_headcount_min: CHECK ((headcount >= 1))`（另 2 个既有 CHECK 原样在场）

**② 回滚后：`information_schema.columns` 里 `headcount` 不存在（回到基线）** ✅
- `after_rollback.headcount_cols = []`

**③ `schema_migration` 行数 / max 未动** ✅
- 事务内 `{rows: 39, max: "0040"}` · 回滚后 `{rows: 39, max: "0040"}`（与基线逐字相等）

**④ 逐字复原（表定义摘要同基线）** ✅
- 表定义摘要 `md5`：before `6ad554dce1ef5c3aadd9dd8556c182aac91700fdf3d95f54243d12f1063816a2` = after（逐字相等）
- 列清单逐字相等（14 列，`headcount` 不在场）；CHECK 清单逐字相等（`['job_reward_positive','job_status_enum']`）；`job` 行数 21 → 21（零位移）

### 正向对照（防「写入路径本身坏 ⇒ 误判成 CHECK 拒」）

- 同事务内 `UPDATE public.job SET headcount = 2` **成功** ⇒ 写入腿本身可用，被拒确因值 = 0。

---

## ④ 判负（≥2）

写入腿统一形态：`UPDATE public.job SET headcount = 0 WHERE job_id = 2`（真库既有行）；`INSERT ... (job_id=900000136, employer_uid=1, cid=1, reward=1, create_key='cli:p9s7-leg-*', headcount=0)`（**显式 job_id，不消耗 identity 序列**）。

**(a) 真 schema（含 CHECK）下 `headcount = 0` 必被拒** ✅
- UPDATE 被拒：`sqlstate = 23514`，`message = new row for relation "job" violates check constraint "job_headcount_min"`，`constraint = job_headcount_min`
- INSERT 被拒：`sqlstate = 23514`，同样的 `violates check constraint "job_headcount_min"`

**(b) 去掉 CHECK 的副本 ⇒ 同一写入不拒** ✅（两种「副本」口径都给读数）
- **(b-DROP)**：先应用 0041，再于**同事务** `ALTER TABLE public.job DROP CONSTRAINT job_headcount_min`（副本内约束 `['job_reward_positive','job_status_enum']`，无 `job_headcount_min`）
  - `headcount = 0` 的 **UPDATE 不拒**（`ok=true`）· **INSERT 不拒**（`ok=true`）
- **(c-文件副本)**：内存改坏 0041（① `ADD CONSTRAINT job_headcount_min CHECK ...` 行改为注释；② 中和自检的「约束在场」断言行），**不改仓库文件**（`mutant.sql_sha256 = b6bef3ce…`，`bytes = 5684`）
  - 副本可应用且无 `job_headcount_min` · `headcount = 0` 的 **UPDATE 不拒** · **INSERT 不拒**

> 判负 (a) 与 (b)/(c) 的**唯一变量 = CHECK 是否在场** ⇒ 反证「被拒者是 CHECK `job_headcount_min`」成立。

---

## ⑤ 版本连续性 & 文件面

- **连续性**：迁移目录最新 = `0040_backfill_signup_batt.sql`（已 apply，真库 `schema_migration` 39 行 / max `0040`）⇒ 本单新增 `0041` **严格接续 `0040`，无跳号**。
  - 旁注（既有事实，非本单引入）：全目录历史上缺 `0018`（`0017` → `0019`），属冻结链既有状态；`0040 → 0041` 段连续。
- **新增文件**：
  - `backend-ts/migrations/0041_job_headcount.sql`（交付物 · 仅新增）
  - `backend-ts/.p9s7-impl/ro-facts.ts`、`backend-ts/.p9s7-impl/r9-24-dryrun.ts`（探针）
  - `backend-ts/.p9s7-impl/r9-24-0041-20261003T140427Zamv1.json`（run-tagged 读数）
  - `docs/audit/p9-s1-0041-job-headcount.md`（本报告）
- **未改动**：`0001`–`0040` 任何字节 · `src/**` · `frontend/**` · 其它 `docs/` · 未 apply 真库 · 未 commit/push。

---

## 未测项（如实）

- **未 apply 到真库**（按派单：入库与 apply 由 Zang 验收后执行）。因此本报告**不含**「真库 apply 后」读数，仅含「事务内 + 回滚」读数。
- **未做 HTTP 面 / 路由面**验证（`reward × headcount` 押金派生、发布必填校验）—— 明确属后续单（路由/编排），不属本迁移。
