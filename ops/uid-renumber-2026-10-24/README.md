# uid 规范化迁移 · apply 手册（`0076_uid_renumber.sql`）

> **本文件不是可执行脚本，是操作员手册。**
> ★ **必须拿到 Kevin 的「口头授权」后才能 run**（本目录任何脚本 + `0076` 迁移文件同此一条）。
> ★ **apply 执行人 = 操作员**（Kevin 授权的那一位）。实现方（Zang/Neng）**不执行** apply。
> ★ apply 落地的是 `backend-ts/migrations/0076_uid_renumber.sql` **全文**；本目录只提供备份、
>   事务内 dry-run 自证、回滚入口。

契约：`docs/data-layer.spec.md` §40.17 / v0.47（`UR1..UR10`）。姊妹 `docs/seafood.master-plan.md` §5.468。

---

## 0. 一句话说明

194 行用户（1 个真实账号 `970213 → 100100` + 193 个 mock 按旧 uid 升序重编 `1000..1192`）
在 31 处 FK + `ledger_entry` / `account` / 6 处非 FK uid 面上**一次性换号**，序列 `RESTART WITH 100101`。
换号是**身份键**操作：期间任何 uid 写入都会打乱映射 ⇒ 维护窗口内**后端只读**。

---

## 1. 前置闸（跑之前必须全绿；任一红 = 停，不要「先跑再说」）

迁移文件头部 `UR-PRE-*` 全部为 `RAISE EXCEPTION` 的 fail-closed 闸，在**第一次写之前**执行：

| 闸 | 校验 |
|---|---|
| `UR-PRE-0` | `ur.direction ∈ {up, down}` |
| `UR-PRE-1` | 活的 `users` FK 集 **逐项等于**契约 31 项（现取 `pg_constraint`，不信任文档） |
| `UR-PRE-2` | 14 个 append-only 触发器在册且 `tgenabled='O'` |
| `UR-PRE-3` | `users` = 194 行；真实账号按 `lower(evm)=0x59f9…09b0` 唯一定位 |
| `UR-PRE-4` | 旧号段与新号段不相交（新段内不得已有行） |
| `UR-PRE-5` | **NM2 已核准并在步骤 2c 清理**：全表漂移必须**恰好**是授权的那 9 行；9 行之外漂移 = 0 ⇒ 删后漂移 = 0 |
| `UR-PRE-6` | 5 个额外写闸（`UR-BLOCK-6`）「**表 × 触发器名**」逐项在册且 `tgenabled='O'`（拼错名/挂错表 ⇒ 停） |
| `UR-PRE-7` | 31 个 `users` FK 迁移前**全部** `NOT DEFERRABLE`（`UR9-12` 的原始基线，必须在步骤 3 之前现取） |

---

## 2. 维护窗口（这是本迁移唯一「危险」的地方）

* **锁**：步骤 3 的 **31 条** `ALTER TABLE … ALTER CONSTRAINT … DEFERRABLE` 每条各取一次
  **`ACCESS EXCLUSIVE`**（在对应子表上）；步骤 12a 的 31 条复原**再来一轮**。
  另外 19 × `DISABLE`/`ENABLE TRIGGER`（每条也是 `ACCESS EXCLUSIVE`）、
  步骤 2c 在 `account` 上的 `DELETE`、步骤 12c 的 `ALTER TABLE users … RESTART WITH` 同为强锁。
* **写热点**：`ledger_entry` 是线上写热点。步骤 2 关掉 `trg_ledger_entry_append_only` 到步骤 12b
  重开之间，`ledger_entry` 的追加写**必须为零** —— 这就是「后端只读」的硬理由，不是建议。
* **窗口动作（按顺序，全部人工）**：
  1. 公告 window；确认无后台 job（结算 / 返佣 / 推荐 / 签到）在跑；
  2. 后端切**只读**（停写接口 / 停 worker；读接口可留）；
  3. `bash ops/uid-renumber-2026-10-24/backup.sh`（自证见下）；
  4. `psql --single-transaction` 跑迁移（或 `scripts/migrate.ts` 的逐文件事务）；建议同事务起始加
     `SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';` —— 拿不到锁就**放弃并另择窗口**，
     绝不死等（会堵住整个 `ledger_entry` 写入队列）。
  5. 收口（判负 17 条全绿）后 **COMMIT**；
  6. 走「静默窗」（§6），再恢复后端写。
* **耗时**：现盘 dry-run 单臂 ≈ **25 秒**（含 194 用户 + 928 账本行 + 31 表）。留 **10 分钟**窗口足够；
  但**锁等待**不受此估计约束 ⇒ 必须设 `lock_timeout`。
* **备份自证（缺一即视为没有备份）**：`backup.sh` 落 `dump/<table>.csv` + `manifest.txt`（行数/字节/sha256）
  + `preflight.json`。`dump/` 含 `evm`/`bio`/`tg_user_id`（个人数据）⇒ **不入 git**（本目录 `.gitignore` 已挡）。

---

## 3. 12 步时序（+ 3 个子步；顺序即契约）

| 步 | 动作 | 说明 |
|---|---|---|
| 0 | 预检 `UR-PRE-0..7` | 见 §1；全在第一次写之前 |
| 1 | `BEGIN` | 由执行器提供（本文件不写 `BEGIN/COMMIT`） |
| 2 | 关 **14** 个 append-only 触发器 | **逐个按名**；禁 `ALL`、禁 `session_replication_role` |
| 2b | 关 **5** 个额外写闸（`UR-BLOCK-6`） | 逐个按名；Kevin 2026-10-24 授权（见 §4） |
| 2b-2 | 断言 **19** 个守卫全部 `tgenabled='D'` | 防「名字对而挂错表 / 被别人改成 `'R'`」的静默失效 |
| 2c | **删除 9 行无账本 mock 余额** | 精确谓词；删前 9 / DELETE 命中 9 / 删后 0（见 §5） |
| 3 | 31 × FK `DEFERRABLE INITIALLY IMMEDIATE` | 唯一索引冲突不可延迟 ⇒ 必须两相 |
| 4 | `SET CONSTRAINTS ALL DEFERRED` | |
| 5 | `ur_map` / `ur_dir` / `ur_base` | `ur_map` 是**唯一**映射源（`TEMP · ON COMMIT DROP`） |
| 6 | `users` 相 1：`uid + 10^7`（回收区） | 避开新旧号段相交 |
| 7 | `users` 相 2：落终值 | |
| 8 | A 类 **31 列**逐列 `UPDATE … FROM ur_dir` | 每列一条，便于逐列对拍 `UR9-5` |
| 9 | `ledger_entry` **再** `account` | 顺序被 `trg_account_guard` 硬绑定，**不可换** |
| 10 | B 类其余（`batt_entry`/`batt_account`/`listing_edit_log`/`campaign_task_reward_pending`） | |
| 11 | `SET CONSTRAINTS ALL IMMEDIATE` | 主动引爆延迟校验 |
| 12 | 复原 31 FK → 19 触发器 `ENABLE` → 序列 `RESTART WITH 100101` | 序列用 `RESTART`，**不用 `setval`** |
| 12d | **17 条判负**（`UR9-1..17`） | 任一红 ⇒ 整体回滚，不存在「部分提交」 |

---

## 4. `UR-BLOCK-6`：5 个额外写闸（Kevin 2026-10-24 授权直接按名开关）

| 表 | 触发器 | 为什么拦 |
|---|---|---|
| `admin_user_role` | `trg_admin_user_role_key_immutable` | `uid` 是键列（`0017`） |
| `conversation` | `trg_conversation_read_mark_only` | 只放行读水位 + `time_updated`（`0045`） |
| `message` | `trg_message_no_update_or_delete` | 无条件 append-only（`0045`） |
| `listing_order` | `trg_listing_order_core_immutable_guard` | `buyer_uid`/`seller_uid` 是下单快照（`0015`） |
| `market_order` | `trg_market_order_core_immutable_guard` | `owner_uid` 是挂单快照（`0016`） |

实现：`UR-PRE-6` 断言「表 × 名」在册且 `'O'` → 步骤 2b 逐个 `DISABLE` → 2b-2 断言 19/19 `'D'`
→ 12b-2 逐个 `ENABLE` → `UR9-17` 断言 19/19 `'O'`。**不再有 `ur.allow_extra_guards` 开关**。

---

## 5. NM2：删除那 9 行 mock 余额（Kevin 2026-10-24 授权，逐字）

> 「直接删掉那 9 行 account（无账本、无余额支撑、纯 mock）……必须用精确谓词 + 删前断言命中 9 行、
> 删后 0 行；不得改成清零。」

```sql
-- 精确谓词（步骤 2c；**不得**放宽、不得改成 UPDATE … SET balance = 0）
DELETE FROM public.account
 WHERE uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399)
   AND cid = 399 AND balance = 40 AND frozen = 0;
```

步骤内证据链（全部现取，任一不满足 ⇒ 整体回滚）：

1. 删前：精确谓词命中 **9** 行（`v_target = 9`）；
2. 关联残留：这 9 个 uid 的 `ledger_entry` = **0** 行；`account` 的**入向 FK = 0** 条
   （`pg_constraint` 现取）⇒ **无关联残留需要清理**（结论写进 `RAISE NOTICE`）；
3. `GET DIAGNOSTICS ROW_COUNT = 9`；
4. 删后：`uid = ANY(9 uids)` = **0** 行；`trg_account_guard` 已复启（`tgenabled='O'`）；
5. NM2 收口：全表 users 行漂移 = **0**。

★ **守卫例外登记**：`account_guard()` 对 `TG_OP='DELETE'` 直接 `RAISE`（`0001_ledger_core.sql:129-131`）
⇒ 只有这一条 DELETE 前后 `DISABLE`/`ENABLE` `trg_account_guard`，三步紧邻。
步骤 9 的 `UPDATE account` 全程在守卫**开启**下执行（那才是它的本职）。
`trg_batt_account_user_fk` 全程**不碰**。

---

## 6. 提交之后：静默窗（和「回滚窗口」是同一个边界）

* **静默窗** = `COMMIT` 之后、**首笔 `uid ≥ 100101` 的写入之前**。
  这段时间里：不注册新用户、不产生新账本行、不写任何业务表 —— 目的是让回滚仍可逆（映射覆盖全库）。
* 恢复写入前，建议只读核对（跑一遍即可）：
  ```sql
  SELECT count(*) FROM users WHERE uid >= 100101;                 -- 必须 0
  SELECT count(*) FROM users WHERE uid BETWEEN 1000 AND 1192;      -- 必须 193
  SELECT uid FROM users WHERE lower(evm)='0x59f9f640d15ebb053c94a816232cf8ce91b209b0';  -- 必须 100100
  SELECT count(*) FROM account WHERE uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399); -- 必须 0
  SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O'
     AND tgname IN ('trg_ledger_entry_append_only','trg_referral_append_only','trg_market_trade_append_only',
       'trg_currency_status_log_append_only','trg_admin_ops_audit_log_append_only','trg_admin_refund_audit_log_append_only',
       'trg_currency_review_log_append_only','trg_listing_review_log_append_only','trg_checkin_log_append_only',
       'trg_checkin_makeup_log_append_only','trg_rating_append_only','trg_listing_order_event_append_only',
       'trg_listing_edit_log_append_only','trg_batt_entry_append_only','trg_admin_user_role_key_immutable',
       'trg_conversation_read_mark_only','trg_message_no_update_or_delete','trg_listing_order_core_immutable_guard',
       'trg_market_order_core_immutable_guard','trg_account_guard');  -- 必须 0
  ```
* **回滚窗口同样在此结束**：一旦出现 `uid ≥ 100101` 的新用户 / 新账本行 / 新业务行，
  反向映射不再覆盖全库 ⇒ **正确动作是前滚修复（补映射后前向跑），不是回滚**。
  `rollback.sh` 开跑前会自己检查该窗口；`--force-window` 只用于「明知后果的演练」，不得用于生产。

---

## 7. 回滚（`rollback.sh`，禁另写一套 SQL）

```bash
bash ops/uid-renumber-2026-10-24/rollback.sh --dry    # 演练：反向跑完 12 步 + 17 判负后 ROLLBACK（零残留）
bash ops/uid-renumber-2026-10-24/rollback.sh          # 真回滚（COMMIT）—— 同样需 Kevin 授权
```

铁律（§40.17.7 A）：回滚 = 把 `ur_map` 的 `old_uid` / `new_uid` **对调后重跑同一份迁移文件**
（`ur.direction='down'`）。脚本只做三件事：从 `dump/users.csv` + 现库按 `lower(evm)` 重建反向映射、
把它装进同形 `TEMP ur_map`、`psql --single-transaction` 执行同一文件。
★ **禁止**为回滚另写 SQL：两份实现必然分叉，回滚就会成为第二个事故源。

---

## 8. `SECRET_KEY` 轮换（会话全失效，六步；顺序不可换）

换号后所有会话里的 uid 都是旧号 ⇒ 旧 token 必须**主动作废**，不能靠过期。

1. **生成新键**（本地，别贴到聊天/工单）：
   `openssl rand -base64 48`（或 `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`）。
2. **替换生产变量**（Vercel）：
   `vercel env rm SECRET_KEY production` → `vercel env add SECRET_KEY production`（粘贴新键）。
   ★ 只改 `production`；`preview`/`development` 另议，别顺手同步。
3. **redeploy** 生产（`vercel --prod` 或控制台 redeploy）；确认新实例全部起来了（不是滚动中的混合态）。
4. **验证旧 token 失效**：拿一枚**旧**会话 token 打一个需鉴权的接口 ⇒ 期望 **401**（不是 200、不是 500）。
5. **重登**：真实账号（`uid=100100`，evm `0x59f9…09b0`）重新登录一次，确认拿到的 token 里 uid 是新号。
6. **登记轮换时刻**：把「轮换时间 / 执行人 / 401 验证结果」写进当次 apply 记录。
   ★ 该时刻**必须在迁移 COMMIT 之后**（先轮换再迁移 = 中间态全站掉线且映射未生效）。

---

## 9. dry-run（apply 前必须有一次全绿读数）

```bash
cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.scripts.json \
  ./node_modules/.bin/ts-node --transpile-only ../ops/uid-renumber-2026-10-24/dryrun.ts
```

* 两个臂（`faithful` / `repaired`）跑**同一份迁移文件**，各自 `BEGIN → 迁移 → ROLLBACK`（写死，且 `finally` 补发一次）；
* 起始 `SET LOCAL lock_timeout='5s'`、`statement_timeout='120s'`：拿不到锁 ⇒ 报 `lock_timeout_hit=true` 并算未通过，**不死等**；
* 通过标准：**每臂** `completed=true`（12 步 + 17 判负全绿）、`ROLLBACK` 后与迁移前读数 **13/13 逐项相等**、`lock_timeout_hit=false`；
* 读数落 `readings/dryrun-<ts>.json`；最近一次全绿：`readings/dryrun-20261024T050506Z-green.json`
  （`rollback_zero_residue=PASS | faithful_arm=completed | repaired_arm_12steps_17checks=PASS | lock_timeout_hit=false`）。
* ★ 该 dry-run **不写库**：全程事务内 + 无条件 ROLLBACK；它证明的是「机制」，不代替 §2 的备份。

---

## 10. 失败处置

| 现场 | 动作 |
|---|---|
| 任一 `UR-PRE-*` 红 | 已停（第一次写之前），照报错点名核数；**不要**改闸放宽 |
| 任一 `UR9-*` 红 | 整体回滚（脚本/执行器自动），无部分提交；先定位，再重跑 dry-run |
| `lock_timeout`（`55P03`） | 放弃本次窗口，另择；**不要**提高 `lock_timeout` 硬等 |
| COMMIT 后核对不过 | 在回滚窗口内 ⇒ `rollback.sh`；窗口已破 ⇒ 前滚修复（补映射），并登记 |
| 9 行 mock 已不存在 | `UR-PRE-5` / `UR-DEL9` 会红（命中 ≠ 9）⇒ 说明有人先动过数据，**停**并核对授权清单 |

---

## 11. 授权记录

* **2026-10-24 · Kevin（口头）**：① 直接删除那 9 行 account（无账本、无余额支撑、纯 mock），
  精确谓词 + 删前 9 / 删后 0 断言，**不得改成清零**；② 授权禁用 5 个额外写闸（`UR-BLOCK-6`），
  改为按名 `DISABLE`/`ENABLE` 并断言 `tgenabled='O'`。
* **apply 本身**：仍需 Kevin 在维护窗口前**再次口头授权**；本文件不构成授权。
