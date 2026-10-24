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
| `UR-PRE-5` | **NM2 已核准并在步骤 2c 清理**：全表漂移必须**恰好**是授权的那 9 行；9 行之外漂移 = 0 ⇒ 删后漂移 = 0。★ **仅 up 方向判定**（`v_up AND`）：down 时那 9 行已删，漂移 0 才是正确终态（见 §7.1） |
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
  4. **apply 通道唯一 = `backend-ts/scripts/migrate.ts`**（见 §2.1）。它会逐文件包事务、并在**同一事务内**
     `INSERT INTO schema_migration(version,name,checksum)` —— 这行是「已应用」的唯一凭据，不能被绕过：
     ```bash
     cd backend-ts
     npx ts-node --transpile-only scripts/migrate.ts --status   # 先看：只有 0076 待应用，无 checksum drift
     npx ts-node --transpile-only scripts/migrate.ts            # 再跑（只会在 0076 上动手）
     ```
     ★ **不要再并列 psql 通道**：`migrate.ts` 是唯一写入 `schema_migration` 的地方，手跑 psql 会留下
     「库已改、版本表没记」的静默分叉（下次 `migrate.ts` 会当成未应用**重放**）。
     若 `migrate.ts` 不可用、必须走 psql，则**必须**在同一事务内补版本行（§2.2），否则视为事故。
     ★ `migrate.ts` **不设** `lock_timeout` / `statement_timeout`（它只包事务）；因此在只读窗口内
     另开一个 `psql` 会话盯锁：`SELECT pid, wait_event_type, left(query,60) FROM pg_stat_activity WHERE datname=current_database() AND state<>'idle';`
  5. 收口（判负 17 条全绿）后 **COMMIT**；核对 `schema_migration` 已有 0076（§10）；
  6. 走「静默窗」（§6），再恢复后端写。
* **耗时**：现盘 dry-run 单臂 ≈ **25 秒**（含 194 用户 + 928 账本行 + 31 表）。留 **10 分钟**窗口足够；
  但**锁等待**不受此估计约束 ⇒ 必须盯着锁（见上）。
* **备份自证（缺一即视为没有备份）**：`backup.sh` 落 `dump/<table>.csv` + `manifest.txt`（行数/字节/sha256）
  + `preflight.json`。`dump/` 含 `evm`/`bio`/`tg_user_id`（个人数据）⇒ **不入 git**（本目录 `.gitignore` 已挡）。
* ★★ **`dump/` 必须异地留存（B6 登记）**：`dump/` 被 gitignore ⇒ **git 里没有它，机器挂了就没有了**。
  它是 `ur_map` 的**唯一重建来源**（`rollback.sh` 靠 `dump/users.csv` 的 `lower(evm)` 对位），也是那 9 行
  account 的**唯一复原来源**（`dump/account.csv`）。
  ⇒ 维护窗口关闭前**必须**把它拷到异地（加密后）：`tar czf ~/ur-dump-2026-10-24.tgz -C ops/uid-renumber-2026-10-24 dump preflight.json manifest.txt`
  （或用 `age`/`gpg` 加密后上传）。**丢失 `dump/` = 回滚能力归零**，只能前滚修复。

### 2.1 apply 通道（唯一）

| 通道 | 状态 | 说明 |
|---|---|---|
| `backend-ts/scripts/migrate.ts` | ✅ **唯一** | 逐文件事务 + 写 `schema_migration`（含 sha256 checksum）+ 已应用且 checksum 一致则 skip + checksum 漂移报错退出 3 |
| `psql -f` / `--single-transaction` | ⛔ 默认禁用 | 会绕过版本表；仅 §2.2 的紧急备用形态允许 |

★ 前置：`--status` 必须显示**只有 0076 待应用**。`migrate.ts` 会按版本序应用**所有**待应用文件，
若盘里还有别的未应用迁移，会在 0076 之后接着跑 —— 那不是本次窗口授权范围。

### 2.2 紧急备用通道（`migrate.ts` 不可用时；必须补齐版本行）

```bash
cd backend-ts
CK=$(shasum -a 256 migrations/0076_uid_renumber.sql | awk '{print $1}')
psql "$DATABASE_URL_UNPOOLED" -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';
\i migrations/0076_uid_renumber.sql
INSERT INTO schema_migration (version, name, checksum)
VALUES ('0076', '0076_uid_renumber.sql', '$CK');
COMMIT;
SQL
```
★ checksum 必须是**该文件此刻的 sha256**（与 `migrate.ts` 同算法），否则下次 `migrate.ts` 判 drift 退出 3。
★ 这条通道**手写版本行**，是最容易漏的一步：漏了 = 版本表与库面分叉，必须立刻补 `INSERT`（不要重跑迁移）。

---

## 3. 12 步时序（+ 3 个子步；顺序即契约）

| 步 | 动作 | 说明 |
|---|---|---|
| 0 | 预检 `UR-PRE-0..7` | 见 §1；全在第一次写之前 |
| 1 | `BEGIN` | 由执行器提供（本文件不写 `BEGIN/COMMIT`） |
| 2 | 关 **14** 个 append-only 触发器 | **逐个按名**；禁 `ALL`、禁 `session_replication_role` |
| 2b | 关 **5** 个额外写闸（`UR-BLOCK-6`） | 逐个按名；Kevin 2026-10-24 授权（见 §4） |
| 2b-2 | 断言 **19** 个守卫全部 `tgenabled='D'` | 防「名字对而挂错表 / 被别人改成 `'R'`」的静默失效 |
| 2c | **删除 9 行无账本 mock 余额** | 精确谓词；up：删前 9 / DELETE 命中 9 / 删后 0；down：命中 0（已删，方向门 `{0,9}`，见 §5 / §7.1） |
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

★ **方向门与不可逆性（2026-10-24 复核 B1/B2）**：上面 5 条证据链只是 **up 方向**的口径。
`ur.direction='down'`（回滚）时那 9 行已被删 ⇒ ①③ 的「命中 9」改为「命中 `{0,9}`」（`0` 合法），
`UR-PRE-5` 两条漂移判定加 `v_up AND` 短路；**up 方向仍 fail-closed 要求 =9**（判定点 2c 之前）。
★ 本步骤**不可逆**：全文无 `INSERT INTO public.*` ⇒ 回滚不重建这 9 行（`account` 永久 141 → 132）。
处置口径见 §7.1（**可前滚、不回滚此项**；`dump/account.csv` 只有 7 列，无法逐字回灌）。

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
  SELECT count(*) FROM account;                                    -- 必须 132（= 迁移前 141 − 9；见下）
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
* ★★ **回滚边界登记（B2）：回滚不复活那 9 行 account** —— 这是本轮复核要求写死的一条，别在事故现场才发现：
  * 步骤 2c 的 `DELETE` 是**有意的单向操作**，`0076` 全文**无任何** `INSERT INTO public.*` ⇒
    `ur.direction='down'` 时谓词命中 **0 行**，**不重建**。
  * 因此回滚后 `account` = **132 行**（迁移前 141），且**不会**自动回到 141；
    `rollback.sh` 已把 `132 = 141 − 9` 写成**硬断言**（复活反而 FAIL）。
  * 需要复原那 9 行时的**唯一来源** = 迁移前备份 `dump/account.csv`，人工回灌（§7.1）；`dump/` 必须异地留存（§2）。
  * 决策口径：**「删了 9 行 mock」与「uid 换号」是两件独立的事** —— 回滚只负责后者；
    前者的可逆性由 `dump/account.csv` 保证，不由回滚保证。

---

## 7. 回滚（`rollback.sh`，禁另写一套 SQL）

```bash
bash ops/uid-renumber-2026-10-24/rollback.sh          # 真回滚（COMMIT）—— 需 Kevin 授权
bash ops/uid-renumber-2026-10-24/rollback.sh --dry    # 只有**在 branch 库（已 apply 的副本）**上才有意义
```

★ **`--dry` 不是「现在就能演练」（B3 订正）**：`rollback.sh` 的状态闸第一条是
「真实账号 uid 仍等于备份值 ⇒ 迁移未 apply，exit 3」。现盘（HEAD，未 apply）跑 `--dry` 会**立刻 exit 3**，
今天实测就是这样。所以 dry 演练只有两种可行场合：

1. **branch 库** = 把生产 dump 恢复到一条独立 Neon branch、在 branch 上 apply 过 0076 ⇒ 在那里跑 `--dry`；
2. **apply 之前的事务内**：那是 `dryrun.ts` / `updown.ts` 的形态（`BEGIN → 迁移 → ROLLBACK`），不是 `rollback.sh`。

⇒ 上线前能自证的证据 = `readings/dryrun-*.json`（up 方向两臂）+ `readings/updown-*.json`
（同一事务内 up→down 两遍，**这就是回滚路径的机器证明**）；`rollback.sh --dry` **不算**已有演练。

铁律（§40.17.7 A）：回滚 = 把 `ur_map` 的 `old_uid` / `new_uid` **对调后重跑同一份迁移文件**
（`ur.direction='down'`）。脚本只做三件事：从 `dump/users.csv` + 现库按 `lower(evm)` 重建反向映射、
把它装进同形 `TEMP ur_map`、`psql` 一个事务执行同一文件。
★ **禁止**为回滚另写 SQL：两份实现必然分叉，回滚就会成为第二个事故源。

回滚后 `rollback.sh` §3 的**硬断言**（任一红 exit 5，均为断言不是打印）：

| 项 | 断言 |
|---|---|
| `users` | 行数 = `dump/users.csv`；真实账号回到 `dump` 值；mock 段 1000–1192 行数 = 备份 |
| `users_uid_seq` | `last_value/is_called` = `100101/false`（down 回卷到**回滚起点**值，不是迁移前的 48；`UR_EXPECT_SEQ` 可覆盖并登记） |
| `ledger_entry` | `Σdelta` / `Σfrozen_delta` / 按 `cid` 分解 逐项 = `preflight.json`（数值列被改过就红） |
| `account` | 行数 = 备份 **141 − 9 = 132**；那 9 个 uid **必须 0 行**；剩余行漂移 = 0 |
| 19 个守卫 | 逐名在册 19 个且全部 `tgenabled='O'`（旧版只查 `LIKE 'trg_%_append_only'`，只覆盖 14 个） |
| 31 个 users FK | 全部回到 `NOT DEFERRABLE`（`condeferrable OR condeferred` = 0） |

### 7.1 那 9 行 account：**回滚不复活，且无法逐字回灌**（B2 登记）

* `0076` 步骤 2c 是**单向删**（全文无 `INSERT INTO public.*`）⇒ 回滚后 `account` 永久 **132** 行（迁移前 141）。
* **为什么不给「回灌命令」（订正上一版手册的暗示）**：现盘 `dump/account.csv` 只有 **7 列**
  （`uid,cid,balance,frozen,version,time_created,time_updated`），而 `public.account` 是 **20 列**，
  其中 `accountId` / `providerId` / `userId` 均 `NOT NULL` 且**无默认值** ⇒ **缺少的值已不可重建**，
  `\copy` 回灌在结构上就做不到。再叠加 `trg_account_guard`：`INSERT` 要求 `balance/frozen = 0/0`，
  `UPDATE` 要求存在对应 `ledger_entry` 快照 —— 那 9 行**本来就没有账本**，正是被授权删除的原因。
* ⇒ **本项处置口径 = 「可前滚、不回滚此项」**：那 9 行视为**永久删除**（授权原话就是「直接删掉」，
  无账本兜底 = 无业务价值）。这才是诚实的说法，不要写成「能回灌」。
* 若日后确需**等价的 mock 行**，那是**新建数据**（要新 `id`/`userId`/`accountId`，还要临时禁
  `trg_account_guard`），须单独授权 + 登记，**不得在回滚里顺手做**。
* 保留 `dump/account.csv` 的意义：审计证据（删掉的到底是哪 9 行、值多少）。
  ★ 已知不一致：`backup.sh`（HEAD，13:06 提交）已改成 `SELECT *`（20 列），而现盘这份 dump 是
  12:42 早一版脚本产出（7 列）。若在窗口前**重跑** `backup.sh`，会得到 20 列的 `account.csv`
  （更能还原上下文，但**仍不含**被删行的完整可回灌形态）—— 重跑会覆盖 `dump/`，需先确认旧 dump 已异地留存。

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

## 9. dry-run 与双向自证（apply 前必须各有一次全绿读数）

```bash
cd backend-ts
# ① up 方向：两臂（faithful / repaired），各自 BEGIN → 迁移 → ROLLBACK
TS_NODE_PROJECT=$PWD/tsconfig.scripts.json \
  ./node_modules/.bin/ts-node --transpile-only ../ops/uid-renumber-2026-10-24/dryrun.ts
# ② 双向：同一事务内 up 全文 → down 全文（这就是「apply 之后回滚仍可用」的机器证明）
TS_NODE_PROJECT=$PWD/tsconfig.scripts.json \
  ./node_modules/.bin/ts-node --transpile-only ../ops/uid-renumber-2026-10-24/updown.ts
```

* 两个臂（`faithful` / `repaired`）跑**同一份迁移文件**，各自 `BEGIN → 迁移 → ROLLBACK`（写死，且 `finally` 补发一次）；
* 起始 `SET LOCAL lock_timeout='5s'`、`statement_timeout='120s'`（`updown.ts` 用 `300s`，因为它跑两遍）：
  拿不到锁 ⇒ 报 `lock_timeout_hit=true` 并算未通过，**不死等**；
* 通过标准：**每臂** `completed=true`（12 步 + 17 判负全绿）、`ROLLBACK` 后与迁移前读数 **13/13 逐项相等**、`lock_timeout_hit=false`；
  （`triggers` 读数自本轮起含 **22** 项：`trg_%_append_only` 15 个（契约 14 + `trg_commission_policy_append_only`）
  + `trg_batt_account_user_fk` + `trg_account_guard` + **5 个额外写闸** ⇒ 「13/13 相等」现在真能证明
  **19 个守卫**在回滚后复位，而不是只证明 14 个；此前那 5 个写闸根本不在读数里）；
  `updown.ts` 另加四条硬断言：`users=194`、`account=141`、`seq` 未漂、19 守卫全 `'O'`（读数键 14/14）；
* 读数落 `readings/dryrun-<ts>.json` / `readings/updown-<ts>-green.json`；
  最近一次全绿：`dryrun-20261024T052829Z.json`（`rollback_zero_residue=PASS | faithful_arm=completed |
  repaired_arm_12steps_17checks=PASS | lock_timeout_hit=false`）、`updown-20261024T052928Z-green.json`
  （`up_all_green=true | down_all_green=true | equality=PASS(14/14) | account_141=true | guards_19_all_O=true | PASS=true`）。
* ★ 该 dry-run **不写库**：全程事务内 + 无条件 ROLLBACK；它证明的是「机制」，不代替 §2 的备份。
* ★★ **但它不是「无锁的」（B5）**：虽不落库，两个臂/两遍都要对 **31 张子表 + `users` + `ledger_entry`**
  取 `ACCESS EXCLUSIVE`（`ALTER TABLE … ALTER CONSTRAINT` / `DISABLE|ENABLE TRIGGER` 各一次，共 ~70 条强锁 DDL），
  实测**每臂 ≈ 27 秒**（`updown` ≈ 2 × 27s + 收尾）。这期间读接口会被挡住、`ledger_entry` 的写会排队。
  ⇒ **必须在维护窗口内（或 branch 库）跑**；在生产库「营业中随手跑一次 dry-run」= 自己制造一次小事故。
  只读核对（`--arm` 之外）没有这个问题，但 dry-run 有。

---

## 10. 失败处置

| 现场 | 动作 |
|---|---|
| 任一 `UR-PRE-*` 红 | 已停（第一次写之前），照报错点名核数；**不要**改闸放宽 |
| 任一 `UR9-*` 红 | 整体回滚（脚本/执行器自动），无部分提交；先定位，再重跑 dry-run |
| `lock_timeout`（`55P03`） | 放弃本次窗口，另择；**不要**提高 `lock_timeout` 硬等 |
| COMMIT 后核对不过 | 在回滚窗口内 ⇒ `rollback.sh`；窗口已破 ⇒ 前滚修复（补映射），并登记 |
| 9 行 mock 已不存在 | `UR-PRE-5` / `UR-DEL9` 会红（up 方向命中 ≠ 9）⇒ 说明有人先动过数据，**停**并核对授权清单 |
| **apply 后核对（B4）** | `SELECT version,name,checksum FROM schema_migration WHERE version='0076';` **必须恰好 1 行**，且 checksum = `shasum -a 256 backend-ts/migrations/0076_uid_renumber.sql`。0 行 = 走了 psql 通道却漏写版本行（立刻补 `INSERT`，**不要重跑迁移**）；2 行 = 有人重放过 |
| `migrate.ts` 退出 3（checksum drift） | 文件在 apply 后被改过 ⇒ **停**。口径：先比 `git diff`；确认是「只改了注释/手册」也要走「补一条新迁移说明」而不是改历史文件（改动历史文件会让版本表与库面分叉） |
| 回滚后 `account` ≠ 132 | 少 = 有人删了别的东西；多 = 那 9 行被复活（回滚本身**不会**补回，见 §7.1）⇒ 先查 `ledger_entry`/写入方 |
| 回滚后跑 `rollback.sh --dry` 直接 exit 3 | **不是缺陷**：真实账号已等于备份值 ⇒ 状态闸判定「未 apply」。dry 演练只在 branch 库做（§7） |

---

## 11. 授权记录

* **2026-10-24 · Kevin（口头）**：① 直接删除那 9 行 account（无账本、无余额支撑、纯 mock），
  精确谓词 + 删前 9 / 删后 0 断言，**不得改成清零**；② 授权禁用 5 个额外写闸（`UR-BLOCK-6`），
  改为按名 `DISABLE`/`ENABLE` 并断言 `tgenabled='O'`。
* **apply 本身**：仍需 Kevin 在维护窗口前**再次口头授权**；本文件不构成授权。
