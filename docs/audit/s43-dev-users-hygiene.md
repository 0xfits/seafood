# S43 · dev 库 `users` 数据卫生（只读取证 + 经取证才执行的零风险清理）

- **单号**：S43（角色：Kong）
- **runid**：`s43-20261005T123842Z`
- **产物目录**：`backend-ts/.s43-artifacts/s43-20261005T123842Z/`（gitignore 覆盖，见 §0）
- **结论先行**：**A 类（可删夹具残差）= 0 行 ⇒ 本单执行阶段零写**。38 行 `uid≥900000` 全部有外键引用 ⇒ 全部落 B 类、禁删。停手依据：前置「任一行有引用」成立。**序列面未实施**（只给三方案）。

---

## §0 对锚（开工前现取）

| 项 | 现取读数 | 命令 |
|---|---|---|
| HEAD | `7178126` chore(gate): S41b … | `git log --oneline -3` |
| 分支 | `main` | `git rev-parse --abbrev-ref HEAD` |
| tracked 改动（T0） | **0**（仅 `?? ` 未跟踪产物目录） | `git status --porcelain` |
| 站点端口（开工前） | 5191 / 5787 / 5788 / 5555 均由**他人 LISTEN** | `lsof -nP -iTCP -sTCP:LISTEN` |
| 连库口径 | 进程内 dotenv，`path:'/Users/kevin/bistro/seafood/backend-ts/.env.local'`，**不 shell source、不打印密钥** | s43 探针 `loadEnvInline()` |
| DB 现取 | `db=neondb` · `pg 18.6` · `user=neondb_owner` · `addr=169.254.254.254/32`（neon 代理） | `SELECT current_database(),current_setting('server_version')` |

★ 纪律：写面仅限 `users` 表 A 类行；本单**未执行任何写**；未 `setval`/`nextval`；未启 5792–5799 实例；未 `pkill`；未 commit/push。

---

## §1 外键与触发器（只读现取）

### §1.1 所有指向 `users(uid)` 的外键（`pg_constraint`）

**计数：28 条，全部 `ON DELETE = NO ACTION`，全部 `NOT DEFERRABLE`、`convalidated=true`**（即：删 `users` 行时若有引用会被硬阻塞，不会级联、不会置空）。

| # | 外键列 | 约束名 | 引用 | ON DELETE | deferrable | validated |
|---|---|---|---|---|---|---|
| 1 | `admin_ops_audit_log.actor_uid` | `admin_ops_audit_log_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 2 | `admin_ops_audit_log.target_uid` | `admin_ops_audit_log_target_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 3 | `admin_refund_audit_log.actor_uid` | `admin_refund_audit_log_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 4 | `admin_refund_audit_log.buyer_uid` | `admin_refund_audit_log_buyer_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 5 | `admin_refund_audit_log.seller_uid` | `admin_refund_audit_log_seller_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 6 | `admin_user_role.uid` | `admin_user_role_uid_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 7 | `batt_account.uid` | `batt_account_uid_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 8 | `checkin_log.uid` | `checkin_log_uid_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 9 | `checkin_makeup_log.uid` | `checkin_makeup_log_uid_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 10 | `currency_review_log.actor_uid` | `currency_review_log_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 11 | `currency_status_log.actor_uid` | `currency_status_log_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 12 | `job.employer_uid` | `job_employer_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 13 | `job.worker_uid` | `job_worker_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 14 | `job_application.worker_uid` | `job_application_worker_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 15 | `job_arbitration_log.actor_uid` | `job_arbitration_log_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 16 | `job_submission.reviewed_by` | `job_submission_reviewed_by_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 17 | `job_submission.worker_uid` | `job_submission_worker_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 18 | `listing.seller_uid` | `listing_seller_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 19 | `listing_order.buyer_uid` | `listing_order_buyer_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 20 | `listing_order.seller_uid` | `listing_order_seller_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 21 | `listing_order_event.actor_uid` | `listing_order_event_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 22 | `listing_review_log.actor_uid` | `listing_review_log_actor_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 23 | `market_order.owner_uid` | `market_order_owner_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 24 | `market_trade.taker_uid` | `market_trade_taker_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 25 | `rating.ratee_uid` | `rating_ratee_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 26 | `rating.rater_uid` | `rating_rater_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 27 | `referral.child_uid` | `referral_child_fk` | `public.users.uid` | **NO ACTION** | false | true |
| 28 | `referral.parent_uid` | `referral_parent_fk` | `public.users.uid` | **NO ACTION** | false | true |

查询：
```sql
SELECT con.conname, cl.relname AS table_name, att.attname AS column_name,
       rf.relname AS ref_table, ratt.attname AS ref_column,
       con.confdeltype, con.condeferrable, con.convalidated
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_class rf ON rf.oid=con.confrelid
  JOIN pg_namespace rns ON rns.oid=rf.relnamespace
  JOIN pg_attribute att  ON att.attrelid=con.conrelid  AND att.attnum = ANY(con.conkey)
  JOIN pg_attribute ratt ON ratt.attrelid=con.confrelid AND ratt.attnum = ANY(con.confkey)
 WHERE con.contype='f' AND rns.nspname='public' AND rf.relname='users';
-- ALL_ON_DELETE = ['NO ACTION']
```

### §1.2 `users` 表全部触发器（`pg_trigger`）

**计数：56 个，全部为 `tgisinternal=true` 的 RI 约束触发器**（由上述 28 条 FK 自动生成，`AFTER DELETE`/`AFTER UPDATE`，函数 `RI_FKey_noaction_del/upd`）。**无任何用户自定义触发器**；无 `BEFORE DELETE`/append-only 守卫。

- 示例（2 条，全 56 条见 `forensics.json → users_triggers`）：
  - `RI_ConstraintTrigger_a_172246`：`AFTER DELETE ON public.users FROM referral … EXECUTE FUNCTION RI_FKey_noaction_del()`（enabled=`O` 即启用）
  - `RI_ConstraintTrigger_a_286955`：`AFTER DELETE ON public.users FROM batt_account … RI_FKey_noaction_del()`
- 其余守卫面：
  - `pg_rewrite` 用户规则（`users`）：**0**
  - RLS：`relrowsecurity=false`、`relforcerowsecurity=false`、`pg_policy` 策略数 **0**

### §1.3 `users` 是否 append-only —— **现取结论：否**

无 `BEFORE/AFTER DELETE` 用户触发器、无禁删 RULE、无 RLS 删除策略 ⇒ **表本身不是 append-only，无禁删守卫**。
唯一的「删除阻力」来自 28 条 FK 的 `NO ACTION` 语义：只要任一行仍被引用，`DELETE` 会被 FK 触发器阻塞。这是**安全网**（非 append-only 机制），本单正是靠它兜底。

### §1.4 `users` 列结构（现取）

| 列 | 类型 | 可空 | 默认 |
|---|---|---|---|
| `uid` | bigint | NO | **无 `column_default`**（`GENERATED BY DEFAULT AS IDENTITY`，start=1/inc=1，owns `users_uid_seq`） |
| `evm` | text | NO | —（钱包地址，身份位） |
| `bio` | text | NO | `''::text` |
| `is_admin` | boolean | NO | `false` |
| `time_reg` | timestamptz | NO | `now()` |
| `time_login_last` | timestamptz | NO | `now()` |

> 关键：`uid` 是 **identity(BY DEFAULT)** 列 —— 因此存在 owned 序列 `users_uid_seq`（`is_identity=YES`，门基线亦如此登记），但 `column_default` 为 NULL。`BY DEFAULT` 允许**显式插值**，产品正是显式插 `uid`（见 §5），故序列**从不前进**。

---

## §2 `uid ≥ 900000` 逐行（38 行，含逐行引用计数）

- 逐行引用计数 = 步骤 §1.1 的 28 条 FK 在该 `uid` 上的行数之和（对每张 FK 表 `GROUP BY 引用列`，一次批量查询，非逐格往返）。
- **行数：38**；引用计数区间 **[1, 50]**；**全部 ≥1**（最低 1，来源 `batt_account.uid`——每个用户各有一行余额账户）。
- 高号段 = 夹具式号段；`bio` 含 `fixture` 标记的 27 行，`bio` 为空的 10 行（`970203–970212`），另 `970213` bio=`hellohello`。

| uid | 分级 | 总引用 | bio | 建行时间 `time_reg` | 引用明细 |
|---|---|---|---|---|---|
| 900001 | B | 7 | `p7b fixture uid=900001` | 2026-10-02T08:07:24 | seller_uid=3; actor_uid=1; seller_uid=1; uid=1; seller_uid=1 |
| 900002 | B | 9 | `p7b fixture uid=900002` | 2026-10-02T08:07:24 | buyer_uid=5; buyer_uid=3; uid=1 |
| 900003 | B | 4 | `p7b fixture uid=900003` | 2026-10-02T08:07:24 | seller_uid=2; seller_uid=1; uid=1 |
| 900004 | B | 3 | `p7b fixture uid=900004` | 2026-10-02T08:07:24 | uid=1; uid=1; buyer_uid=1 |
| 900005 | B | 3 | `p7b fixture uid=900005` | 2026-10-02T08:07:24 | actor_uid=1; uid=1; uid=1 |
| 900006 | B | 2 | `p7b fixture uid=900006` | 2026-10-02T08:07:24 | uid=1; uid=1 |
| 900007 | B | 1 | `p7b fixture uid=900007` | 2026-10-02T08:07:25 | uid=1 |
| 900008 | B | 4 | `p7b fixture uid=900008` | 2026-10-02T08:07:25 | actor_uid=1; seller_uid=1; uid=1; seller_uid=1 |
| 910001 | B | 10 | `qa7b fixture uid=910001` | 2026-10-02T11:05:09 | seller_uid=4; actor_uid=2; seller_uid=2; uid=1; seller_uid=1 |
| 910002 | B | 11 | `qa7b fixture uid=910002` | 2026-10-02T11:05:10 | buyer_uid=6; buyer_uid=4; uid=1 |
| 910003 | B | 4 | `qa7b fixture uid=910003` | 2026-10-02T11:05:10 | seller_uid=2; seller_uid=1; uid=1 |
| 910004 | B | 3 | `qa7b fixture uid=910004` | 2026-10-02T11:05:10 | uid=1; uid=1; buyer_uid=1 |
| 910005 | B | 3 | `qa7b fixture uid=910005` | 2026-10-02T11:05:11 | actor_uid=1; uid=1; uid=1 |
| 910006 | B | 2 | `qa7b fixture uid=910006` | 2026-10-02T11:05:11 | uid=1; uid=1 |
| 910007 | B | 1 | `qa7b fixture uid=910007` | 2026-10-02T11:05:11 | uid=1 |
| 910008 | B | 4 | `qa7b fixture uid=910008` | 2026-10-02T11:05:11 | actor_uid=1; seller_uid=1; uid=1; seller_uid=1 |
| 910009 | B | 1 | `qa7b fixture uid=910009` | 2026-10-02T11:05:11 | uid=1 |
| 910010 | B | 1 | `qa7b fixture uid=910010` | 2026-10-02T11:05:11 | uid=1 |
| 910311 | B | 1 | `qa-p7a fixture` | 2026-10-02T07:09:40 | uid=1 |
| 970001 | B | 50 | `p4b2:fixture user` | 2026-09-29T12:12:46 | owner_uid=14; employer_uid=11; actor_uid=7; reviewed_by=7; worker_uid=4; seller_uid=3; seller_uid=2; uid=1; taker_uid=1 |
| 970002 | B | 5 | `p4b2:fixture user` | 2026-09-29T12:12:46 | worker_uid=2; uid=1; worker_uid=1; worker_uid=1 |
| 970101 | B | 14 | `p4b2c:fixture user` | 2026-09-29T14:04:58 | seller_uid=12; uid=1; employer_uid=1 |
| 970102 | B | 4 | `p4b2c:fixture user` | 2026-09-29T14:04:59 | uid=1; worker_uid=1; worker_uid=1; worker_uid=1 |
| 970201 | B | 1 | `p4b2c:fixture uid=970201` | 2026-09-29T17:13:22 | uid=1 |
| 970202 | B | 1 | `p4b2c:fixture uid=970202` | 2026-09-29T17:13:22 | uid=1 |
| 970203 | B | 1 | — | 2026-09-30T14:54:40 | uid=1 |
| 970204 | B | 1 | — | 2026-09-30T14:54:49 | uid=1 |
| 970205 | B | 1 | — | 2026-09-30T15:08:18 | uid=1 |
| 970206 | B | 1 | — | 2026-09-30T15:08:24 | uid=1 |
| 970207 | B | 1 | — | 2026-09-30T15:10:41 | uid=1 |
| 970208 | B | 1 | — | 2026-09-30T15:14:57 | uid=1 |
| 970209 | B | 1 | — | 2026-09-30T15:15:24 | uid=1 |
| 970210 | B | 1 | — | 2026-09-30T15:16:30 | uid=1 |
| 970211 | B | 1 | — | 2026-09-30T15:19:24 | uid=1 |
| 970212 | B | 1 | — | 2026-10-01T00:23:36 | uid=1 |
| 970213 | B | 26 | `hellohello` | 2026-10-01T00:34:03 | reviewed_by=12; worker_uid=4; employer_uid=3; uid=2; worker_uid=2; target_uid=1; uid=1; uid=1 |
| 971100 | B | 3 | `b6audit-live fixture (BE-AUDIT-LIVE)` | 2026-10-02T02:01:28 | target_uid=2; uid=1 |
| 971213 | B | 3 | `b6audit-live fixture (BE-AUDIT-LIVE)` | 2026-10-02T02:02:30 | target_uid=2; uid=1 |

> 完整字段（含 evm/is_admin/time_login_last）见 `candidate-set-uidGE900000.json`。

---

## §3 三级分级（每行必落一级，无「待定」）

判定域：`uid ≥ 900000` 的 38 行。判据取自任务口径：**A=夹具残差（号段＋时间＋身份位缺失＋零引用，四条共证）**；**B=有引用（即使疑似夹具也不得删，只登记）**；**C=疑似真用户（有身份位等）⇒不得删**。

| 级 | 定义（判据） | 本次计数 | 处置 |
|---|---|---|---|
| **A** 夹具残差（可删） | 夹具号段 ∧ 夹具批次时间 ∧ 身份位缺失 ∧ **零引用** —— 四条共证 | **0** | 无可删行 |
| **B** 有引用（禁删） | 引用计数 ≥1（无论是否疑似夹具） | **38** | **登记不删** |
| **C** 疑似真用户（禁删） | 有身份位等 | **0**（高号段内无「零引用但有身份位」者） | — |

**逐条共证（38 行）**：
- 号段：38/38 命中夹具式高号段（9000xx / 9100xx / 9103xx / 9700xx / 9701xx / 9702xx / 9711xx / 97121x）✅
- 时间：38/38 建行于夹具批次窗（2026-09-29 / 09-30 / 10-01 / 10-02）✅
- 身份位：27 行 `bio` 直书 `fixture`（如 `p7b fixture uid=900001`、`qa7b fixture uid=910001`、`b6audit-live fixture`）；`970001/970002/970101/970102` 的 `evm` 为**明显构造**值（`0x9700010000…`、`0x9701010000…`）；`970201/970202` evm 全零尾巴 ✅（夹具特征）
- **零引用：38/38 均 ✗（全部 ≥1）** ⇒ **A 的四条共证中「零引用」一条不成立 ⇒ A=∅**

**为什么 38 行都判 B 而非 C**：三级为**互斥优先级**——先看「有引用」⇒ 落 B；否则才看身份位判 C、再看四证判 A。38 行既有引用（B 判据），即使其中 `970203–970212` 的 `evm` 为随机值、`bio` 为空、`time_login_last > time_reg`（更像真实登录痕迹，C 倾向），也**因有引用而落 B、一律禁删**。

### §3.2 低号段（`uid ≤ 41`，26 行）—— 真号段，非候选

- 号段 `1–12 / 17–22 / 34–41`（26 行）；全部 `bio` 为空、`evm` 为非构造随机地址；`is_admin` 者仅 `uid=1`、`uid=10`。
- **引用计数：26/26 均 ≥1**（见 `forensics2.json → low_band`）⇒ 同样禁删。
- 属「真号段」（与序列/取号空间同域），**不在 A 类判定域内**，仅按纪律登记「禁删」。

---

## §4 执行记录（删前/删后 + 快照 + 可回溯路径）

**本单执行阶段：零写。未 `BEGIN` 任何事务，未 `DELETE` 任何行。**

- **停手认定**：任务前置②列出的四类停手条件中，**「任一行有引用」成立**（38/38 高号段行引用 ≥1；低号段 26/26 亦 ≥1）。A 类因此为空，**无任何行可删**。
- 其余停手条件**均不成立**（供记录）：无 `BEFORE/AFTER DELETE` 用户触发器 ✅（仅内部 FK 触发器）；表非 append-only ✅；无身份位判 C 的零引用行 ✅。
- **快照（可回溯）**：
  - A 类原行快照：`A-class-snapshot.json`（`count: 0`，附「A=∅」理由）——即**无可删原行**。
  - 夹具候选全量快照（38 行含参数）：`candidate-set-uidGE900000.json`
  - 全表 64 行原行快照：`all-users-rows.json`
  - 事务边界：**未开启**（`tx_opened=false`，无 `DELETE`/`COMMIT`/`ROLLBACK` 语句执行）
- **引用数读数（写前/写后）**：见 §6；两读**完全一致**（191 = 191），行数一致，佐证零写。

---

## §5 序列面：三方案与建议（**不实施**，待 Zang 终裁）

### §5.1 现取读数

| 读数 | 值 | 来源 |
|---|---|---|
| `users_uid_seq.last_value` | `41` | `SELECT last_value,is_called FROM public.users_uid_seq`（只读，不耗 nextval） |
| `users_uid_seq.is_called` | `true` | 同上 ⇒ **`nextval = 41+1 = 42`** |
| `uid=42` 是否占用 | **否（空位）** | `uid_list`（1–12/17–22/34–41/9000xx/…） |
| gap（nextval → 下一已占位） | `900001 − 42 = **899959**` | `min(uid) WHERE uid>42` |
| 谁在用该序列 | **无** | `information_schema.columns.column_default LIKE '%users_uid_seq%'` → **0 行**；`pg_proc` 函数体引用 → **0** |
| 产品取号路径 | `getNextUserId = COALESCE(MAX(uid),0)+1`（`backend-ts/src/database.ts:2074`，`createUserByEvm` 显式插 `uid`） | 源码现取 |
| **当前 `MAX(uid)`** | **`971213`** ⇒ **下一个真用户将拿到 `971214`** | `users_agg.max` |
| 序列归属 | owned by `users.uid`（identity BY DEFAULT） | `pg_depend` |

**关键事实**：产品**不读该序列**（`uid` 显式插值 + 走 `MAX+1`）；该序列**恒停在 41**（last_value=41 且无人拉动）。因此**序列本身与「真号被夹具抬到 971213」无关** —— 真正的污染源是 `MAX+1`。

### §5.2 三方案

| 方案 | 内容 | 代价 | 风险 | 评价 |
|---|---|---|---|---|
| **① 保持不动** | 不碰序列；靠 `s41-00` 巡检盯「nextval 是否落入已占用集合」 | **0**（零写） | 序列无风险（现 nextval=42 为空位，需再走 899959 次才逼近 900001）。**但 `MAX+1` 污染仍在**：下一个真用户 = 971214（落夹具带） | 安全、可立即维持 |
| **② `setval` 到 9e8 带**（如 `setval('users_uid_seq', 900000000)`） | 把序列抬到已占集合之上 | 1 次 DDL 写（本单不做） | 因**无人用该序列**，setval 对产品取号**零效果**；若某个 `autocommit` 型夹具改走 `nextval` 才会占 `9e8+` 号（现取无此类调用，逐条评估=空）。**且不抬 `max(uid)` ⇒ 治标不治本** | 近乎空操作，不推荐（除非未来改回用序列取号） |
| **③（更优）釜底抽薪：让取号离开 `MAX+1`** | ①把 `getNextUserId` 改为 `nextval('users_uid_seq')`（序列在**干净 1..41 带**）并把序列 `setval` 到真号段 max+1（=42）；或②把取号钳到「真号带」并**排除 `≥900000` 夹具带** | 需改产品代码（本单只读，不实施） | 改代码有回归面，须过门；但**根治**「真号被夹具抬高」 | **推荐**（交 Zang 终裁） |

### §5.3 建议

**当前采纳 ①（保持不动，本单零写）**，并把 **③ 作为战略修复登记交 Zang**。理由：
1. 序列现位于干净空位（nextval=42），**无即时撞号风险**，`s41-00` 已能持续为它保航；
2. `setval`（②）在「无人用序列」的现况下**无收益、且有把未来 `nextval` 调用者推入 9e8 带的副作用**，不划算；
3. 真正的缺陷是 **`getNextUserId=MAX+1` 被夹具高号段抬到 971213 ⇒ 下一个真用户拿到 971214**；此缺陷**只能用 ③ 修**，且须改产品代码 ⇒ 超出本单（只读）范围，交 Zang 定夺。

---

## §6 `s41-00` 复验与行数对照

### §6.1 `s41-00-identity-seq-collision-gate.ts` 复跑（只读）

命令：`cd backend-ts && npx ts-node -P tsconfig.scripts.json --transpile-only scripts/s41-00-identity-seq-collision-gate.ts --json .s43-artifacts/s43-20261005T123842Z/s41-00-rerun.json`

| 读数 | 本次（S43） | 基线 | 差异 |
|---|---|---|---|
| verdict | **GREEN** | GREEN | 无 |
| exit_code | **0** | 0 | 无 |
| 受体数 recipients | **23** | 23 | 无 |
| 读数数 readings_ok | **23** | 23 | 无 |
| fail / warn / unknown | **0 / 0 / 0** | 0 / 0 / 0 | 无 |
| 基线列数 / 基线违例 | 23 / 0 | 23 / 0 | 无 |
| 新增违例 | **0** | 0 | 无 |
| `users.uid` 读数 | nextval=`42` · next_occupied=`900001` · gap=`899959` · **OK** | 同 | **无差异** |

**差异解释**：本次与基线**逐字一致**（`users.uid` 三读数、态均同）。因本单零写、序列与 `users` 均未被触碰，**预期即应无差异**；无差异本身即「未污染」的正向证据。

### §6.2 行数 / 引用面对照（写前 vs 写后）

| 指标 | 写前（forensics） | 写后（post-read） | 差 |
|---|---|---|---|
| `users` 行数 | 64 | 64 | **0** |
| `uid≥900000` 行数 | 38 | 38 | **0** |
| `min/max(uid)` | 1 / 971213 | 1 / 971213 | 0 |
| FK 面 `uid≥900000` 引用行总数 | **191** | **191** | **0** |
| `users_uid_seq` | `41 / is_called=true` | `41 / is_called=true` | 0 |

（逐表 before==after 无失配；见 `post-read.json` 与 `forensics.json → fk_grouped`。）

### §6.3 站点端口（收工现取）

`5191 / 5787 / 5788 / 5555` **仍由原进程 LISTEN，全程未被本单触碰**（未重启/未停）。本单未启任何实例端口；未做长事务、未锁表（零写 ⇒ 无锁）。

---

## §7 未做与 `NOT_MEASURED`

**未做（有意）**：
- **未执行任何写**（无 `DELETE`/`INSERT`/`UPDATE`/`setval`/`nextval`）—— A 类为空且前置「有引用」成立。
- **未实施序列三方案**（只出方案与建议，交 Zang）。
- 未新增/改 `users` 触发器、约束、FK（本单无 DDL）。

**`NOT_MEASURED`（数不出来，不估）**：

| 项 | 原因 |
|---|---|
| 夹具行的**插入来源脚本**（哪段 `p7b`/`qa7b`/`b4b2` 代码写入这些行） | 本单范围仅「库内取证」，未做代码考古；若要，另单 grep `900001`/`910001`/`970001` 字面量 |
| 各 FK 表**未加索引**时的 `count(*)` 精确耗时画像 | 未做 `EXPLAIN ANALYZE`（属性能面，非本单） |
| 低号段 26 行的 **A/B/C 夹具级判定** | 超出「`uid≥900000`」判定域；仅按纪律登记「引用≥1 ⇒ 禁删」 |

---

## §8 自曝

1. **外部并发 tracked 改动（非本单）**：`T0` 时 `git status` 仅 `??`、tracked 改动=0；`20:40:03` 出现 ` M .gitignore`（内容自述「**S42**：run-tagged 证据链产物目录」，新增 `**/.*-artifacts/` 等 3 条）。**非本单所写**（本单从未写 `.gitignore`）。按纪律**不回退**（属他人在飞工作），在此暴露以求对账。⇒ 除该外部改动外，**本单 tracked 改动 = 0**；本单产物全部落在 gitignore 覆盖的 `.s43-artifacts/` 与新增报告。
2. **一次误探针（已弃）**：首版 forensics 用「逐 uid × 逐 FK」串行查询（28×38≈1064 次往返）超时；已改「每 FK 表一条 `GROUP BY`」，落盘脚本为 `s43-forensics.ts`（最终版）。次生探针 `s43-connprobe/fkprobe/probe2/probe3/allrows/postread` 一并留档于产物目录（部分为排障中间件，非交付物）。
3. **`probe2` 两处报错（已修）**：`users_uid_seq` 关系无 `increment_by` 列（改只 `SELECT last_value,is_called`）；`pg_get_functiondef` 对聚合函数报 `42809`（加 `prokind='f'` 过滤）。均只读、无副作用。
4. **口径存疑点**：任务登记「`900001` 疑为夹具残差行」——现取该行 `bio='p7b fixture uid=900001'` **确属夹具**，但**有 7 处引用** ⇒ 判 B、禁删。**夹具残差 ≠ 可删**；「零引用」是 A 类的硬门槛。
5. **零写即结论**：本单**没有**产生任何删除证据，因为**无 A 类行**。若期望「必有删」，那是口径误设——dev 库 38 行高号段夹具**全部被引用**，按纪律**一行都不能删**。
