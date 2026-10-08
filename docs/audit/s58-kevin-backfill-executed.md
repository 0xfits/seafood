# S58 · Kevin 账号与资产迁入新库（Kong · **已授权写新库**）

> **单号**：S58 · **runid**：`s58-20261008T111203Z` · **角色**：Kong
> **授权**：★ **Kevin 已明确答「可以」** ⇒ 本单**允许写新库**（新库 = 生产库，S55a 定格自 2026-10-07 13:10:49）。
> **产物目录**：`backend-ts/.s58-artifacts/s58-20261008T111203Z/`（`**/.*-artifacts/` 已在 `.gitignore`）。
> **硬口径（本单自证）**：写面**仅新库**；**旧库严格只读**（仅 `SELECT`，未写旧库任何行）· 未 `vercel env` · 未部署 · 未起实例 · 未碰 `5787/5788/5555/5191` · 未 `pkill -f`/`killall` · 未 `npm install` · 原始输出不用 `.log` · **未 commit / 未 push**。
> **脱敏**：全文不含密钥值 / 连接串 / 完整 evm（一律 `sha8` 或前 6 后 4）。
> **依据**：`docs/audit/s57-fixture-band-correction.md`（§4 S0–S11 修法 + 判负 N1–N6 + 回滚）· `docs/audit/s56-admin-permission-parity.md`（§6 权限面，同 `uid=100` / 同 `super_admin`）。产物 `backend-ts/.s57-artifacts/s57-kevin-full.json`。

---

## §0 对锚（开工现取）

| 项 | 读数 |
|---|---|
| `git log --oneline -3` | **`edd913e`**（S57b 誊写落盘）/ `e2d7657`（S57）/ `c85fca5`（S56）— **HEAD 含 `edd913e`，对锚成立** |
| `git status --porcelain` | **空**（开工时） |
| 分支 | `main` |
| 开工现时 | **2026-10-08 19:12:03 CST**（UTC `2026-10-08T11:12:03Z`） |
| 旧库 host 指纹 | `ep-holy-forest-b3fi7u3u`（`.env.local`；**只读**） |
| 新库 host 指纹 | `ep-red-moon-b3xvoyjk`（`.env.newdb.local`；`DATABASE_URL_UNPOOLED` sha8 `78a8fe5f`；**写面**） |
| 写前新库基线 | `users`=26 · `ledger_entry`=248 · `account`=23 · `job`=0 · `job_submission`=0 · `cid=1` `Σmint−Σburn=200` · `total_supply=2,010,200` |

---

## §1 阶段 0 —— 回滚点能力探测（不写库）

**命令与读数（键名只报有无，绝不打印值）：**

| 探测 | 读数 |
|---|---|
| `which neonctl` | **NOT_FOUND**（无 CLI） |
| `.env.local` 键名 | `CRON_SECRET` · `DATABASE_URL` · `DATABASE_URL_UNPOOLED` · `DEEPSEEK_API_KEY` · `PGDATABASE` · `PGHOST` · `PGPASSWORD` · `PGUSER` · `POSTGRES_URL` · `POSTGRES_URL_NON_POOLING` · `SECRET_KEY` |
| `.env.newdb.local` 键名 | `DATABASE_URL` · `DATABASE_URL_UNPOOLED` |
| `NEON_API_KEY` 类凭据（`^NEON` 键名匹配） | **两文件均 0 命中** ⇒ **无 Neon API 凭据** |

### ★ 结论：**无分支 / 无 PITR 能力**

- 无 `neonctl`、无 `NEON_API_KEY` ⇒ **本次无法为新库创建分支快照、无法调用 PITR**。
- ⇒ **回滚兜底只剩「事务本身」**：阶段 1 预演即**回滚点**（`BEGIN … ROLLBACK`，单事务保证写前状态可复现）。
- ★★ **风险明写（不可消除）**：新库现约束 **`account_guard`（`account` 行 `DELETE` 直接 `RAISE`）** + **`ledger_entry` / `batt_entry` / `checkin_log` / `admin_ops_audit_log` append-only 触发器对 `UPDATE/DELETE` `RAISE`** ⇒ **一旦阶段 2 提交，`account` 与 `ledger_entry` 的行级写不可逆**；而**无 PITR 凭据** ⇒ **提交后若需整体回退，本工作站做不到**（须 Kevin 在 Neon 控制台按分支/PITR 操作）。本单在**授权范围内**执行提交，该风险**如实登记**（见 §8-1）。

---

## §2 阶段 1 —— ★事务内预演 + `ROLLBACK`（不可省）

**方式**：`psycopg2` 直连 `DATABASE_URL_UNPOOLED`（非 autocommit）⇒ **单事务**跑 S0 前置 ⇒ S1–S11 ⇒ 逐项读回 ⇒ 判负 N1–N6 ⇒ **`ROLLBACK`**。脚本 `s58-exec.py <art> dryrun`，产物 `s58-exec-dryrun.json`。

### §2.1 S0 前置核对（事务内现取；应得 全 0）

| 项 | 期望 | 读数 |
|---|--:|--:|
| 目标 evm 在新库存在数 | 0 | **0** ✓ |
| `uid=100` 占用数 | 0 | **0** ✓ |
| 17 个 ledger `idempotency_key` 冲突 | 0 | **0** ✓ |
| 17 个 ledger `txid` 冲突 | 0 | **0** ✓ |
| 3 个 job `create_key` / `job_id` 冲突 | 0 | **0 / 0** ✓ |
| 3 个 submission `create_key` / `submission_id` 冲突 | 0 | **0 / 0** ✓ |
| 3 个 batt `idempotency_key` / `txid` 冲突 | 0 | **0 / 0** ✓ |
| `checkin_log` `log_id 218/227` 占用 | 0 | **0** ✓ |
| `admin_ops_audit_log` `log_id 9` 占用 | 0 | **0** ✓ |
| `admin_user_role(uid=100)` / `batt_account(100)` / `batt_entry(100)` | 0 | **0 / 0 / 0** ✓ |

### §2.2 S1–S11 行数（事务内 `rowcount`）

| 步 | 语句 | 行数 |
|---|---|--:|
| S1 | `users` 插 `uid=100`（含 `time_reg/time_login_last` 保真） | **1** |
| S2 | `account(100,1)` 起步 **0/0** | **1** |
| S3 | `ledger_entry` 17 行（`OVERRIDING SYSTEM VALUE`，显式 txid） | **17** |
| S4 | `account` 对账到最新分录快照（`4292/5800 · version=8`） | **1** |
| S5a/b | `batt_account(100)=90` + `batt_entry` 3 行 | **1 / 3** |
| S6 | `checkin_log` 2 行（218/227） | **2** |
| S7 | `admin_user_role` 按库内 evm 命中绑 `super_admin` | **1** |
| S8 | `admin_ops_audit_log` log_id 9（target=100 · txid=1439） | **1** |
| S9 | `job` 3 行（136/230/232） | **3** |
| S10 | `job_submission` 3 行（236/237/238） | **3** |
| S11 | `setval('users_uid_seq',101,true)` | **1** |

**合计 33 真实数据行**（§2.1 清单「可搬 33」逐表吻合）。

### §2.3 逐项读回（事务内，全绿）

| 项 | 期望 | 读数 |
|---|---|---|
| `users(100)` | 在场 | `uid=100 · evm sha8=c9f277f5 · bio='hellohello' · is_admin=false · time_reg 2026-10-01T00:34:03Z · time_login_last 2026-10-05T23:18:58Z` ✓ |
| `account(100,1)` | `4292/5800` | `balance=4292 · frozen=5800 · version=8` ✓ |
| `ledger_entry` 17 行 | n=17 | **n=17 · Σdelta=4292 · Σfrozen_delta=5800** ✓ |
| 最新快照一致 | 2372 → 4292/5800 | `txid=2372 · balance_after=4292 · frozen_after=5800` ✓ |
| `batt_account` = `batt_entry` 3 行之和 | 90 | `batt=90 · 3 行 Σ=90 · max_after=90` ✓ |
| `checkin_log` | 2 行 | **2** ✓ |
| `admin_user_role(100)` | `super_admin` | **`super_admin`** ✓ |
| `job` 3 行 | 3 | **3** ✓ |
| `job` 值引用 txid 存在 | 6/6 | `escrow/settle` 引用的 `1440/2367/2355/2363/2357/2359` **全在**（6/6） ✓ |
| `job.ledger_event_keys` 根存在 | 6/6 | 6 个 event root **全在**（6/6） ✓ |
| `job_submission` 3 行 | 3 | **3** ✓ |
| 序列 | 推进 | `users_uid_seq last_value=101 · is_called=true` ✓ |
| `cid=1` `Σmint−Σburn` | 200 → **10,200** | **n=265 · mint=210,274 · burn=−200,074 · net=10,200** ✓ |
| `account↔ledger` 不变量 | 相等 | `acct_eq_latest_ledger=true` ✓ |
| `is_admin=true` 全集 | 恒 `{1,10}` | **2 行（{1,10}）** ✓（未误伤） |

### §2.4 ★ 判负 N1–N6 逐条实测（全部应「红」）

| # | 构造 | 实测读数（逐字） | 红? |
|--:|---|---|:--:|
| **N1** | S7 用**不在库的 evm** 跑 `INSERT…SELECT` | `rowcount=0` ⇒ `admin_user_role` **不增行**（证绑定按 evm 匹配） | **红** ✓ |
| **N2** | S7 用**幽灵 uid**（999）绑角色 | `ERROR: … violates foreign key constraint "admin_user_role_uid_fk"` ⇒ 事务回滚 | **红** ✓ |
| **N3** | 重跑 `S1` + `S7` | 两次均 `rowcount=0`（`ON CONFLICT DO NOTHING` 幂等） | **红** ✓ |
| **N4** | **跳过 S2/S4、直插 `account` 带 `4292/5800`** | `ERROR: new account must start at 0/0 (uid=999999, cid=1)`（`account_guard`） | **红** ✓ |
| **N5** | **先 `UPDATE account`（无 ledger）** | `ERROR: account update without any ledger_entry (uid=999998, cid=1)`（`account_guard`） | **红** ✓ |
| **N6** | 准入语义（control `uid 2` vs `uid 100`） | `uid2 → {is_admin:false, has_role:false, perms:0, can_access_admin:false}`；`uid100 → {is_admin:false, has_role:true, perms:12, can_access_admin:true}` | **红** ✓ |

⇒ **N1–N6 逐条实测应红（权未外溢、顺序不可颠倒、绑定按 evm）**。

### §2.5 ★ `ROLLBACK` 后复核（回到写前计数）

| 项 | 写前 | 写后(事务内) | **ROLLBACK 后** |
|---|--:|--:|--:|
| `ledger_entry` 总行 | 248 | 265 | **248** ✓ |
| `account` 总行 | 23 | 24 | **23** ✓ |
| `users` 总行 | 26 | 27 | **26** ✓ |
| `users(100)` 存在 | 0 | 1 | **0** ✓ |
| `cid=1 Σmint−Σburn` | 200 | 10,200 | **200** ✓ |
| `account(100)` | — | 4292/5800 | **NULL**（不存在） ✓ |
| `job_submission(100)` / `job(100)` / `admin_user_role(100)` | 0 | 3/3/1 | **0 / 0 / 0** ✓ |

**★★ 唯一未回退项（如实登记）**：`users_uid_seq` 由 `last_value=42` → **`101`**。**原因**：PostgreSQL `setval()` **非事务性**（文档明载不回滚）⇒ ROLLBACK 后序列值仍为 101。**后果**：无害且安全（后续自动建户从 `102` 起，**正好避开**手动 `uid=100` 撞号；阶段 2 的 S11 再跑一次幂等）。**已登记为已知偏差**（见 §8-2）。

---

## §3 阶段 2 —— 正式单事务提交

**方式**：同脚本 `s58-exec.py <art> commit`（去 `ROLLBACK`、单事务 `COMMIT`），产物 `s58-exec-commit.json`。

| 项 | 读数 |
|---|---|
| `tx_outcome` | **`COMMIT`** |
| rowcount | `S1=1 · S2=1 · S3=17 · S4=1 · S5a=1 · S5b=3 · S6=2 · S7=1 · S8=1 · S9=3 · S10=3 · S11=1` |

**提交后现取（新连接）**：

| 项 | 写前 | **提交后** |
|---|--:|--:|
| `ledger_entry` 总行 | 248 | **265**（+17） |
| `account` 总行 | 23 | **24**（+1） |
| `users` 总行 | 26 | **27**（+1） |
| `users(100)` 存在 | 0 | **1** |
| `account(100)` | — | **[4292, 5800]** |
| `ledger(100)` | 0 | **n=17 · Σ=4292** |
| `job(100)` / `job_submission(100)` / `admin_user_role(100)` | 0 | **3 / 3 / 1** |
| `cid=1 Σmint−Σburn` | 200 | **10,200** |

---

## §4 阶段 3 —— 事后现取验收（只读，独立脚本 `s58-verify.py`，产物 `s58-verify.json`）

| 验收项 | 读数 |
|---|---|
| `cid=1 Σmint−Σburn` | `n=265 · mint=210,274 · burn=−200,074 · **net=10,200**`（**200 → 10,200** ✓） |
| `currency.cid=1 total_supply` | **2,010,200**（币种级总额**不变** ✓） |
| `ledger(100)` 不变量 | `Σdelta=4292 · Σfrozen_delta=5800 · latest_bal=4292 · latest_frz=5800` ✓ |
| **全局** `account↔ledger` 不变量 | 不匹配数 **0** ✓ |
| `admin_user_role(100)` | `super_admin · 12 键`（`perm_count=12`） ✓ |
| `admin_role` 全集 | `['super_admin']`（唯一，未增角色） ✓ |
| `admin_ops_audit_log` 全集 | **仅 log_id=9**（target=100 · actor=1 · txid=1439） ✓ |
| `job(100)` 3 行值引用 | escrow/settle txid **6/6 在库** · `ledger_event_keys` 根 **6/6 在库**（missing=[]） ✓ |
| 序列 | `users_uid_seq=101 · ledger_entry_txid_seq=2652 · batt_entry_txid_seq=661 · checkin_log_log_id_seq=260` |
| 与新库既有行**零冲突** | `uid≠100` 的 ledger 行 = **248**（未动）· `checkin_log` 6 行 = 旧 4（121/124/255/259）+ 新 2（218/227）· `job_submission` 仅 3（236/237/238）· `dup_evm=0` ✓ |
| `is_admin=true` 全集 | **`{1, 10}`**（未误伤、未新增） ✓ |
| 计数 | ledger 265 · account 24 · users 27 · job 3 · submission 3 · `admin_user_role` 1 · `checkin_log` 6 |
| `users` 全集 | `1–12,17–22,34–41,100`（27 行；`100` 为新增 Kevin 行） |

---

## §5 阶段 4 —— ★生产端到端哨兵（逐字）

**命令**：`curl -s -m 30 -w "\n[HTTP %{http_code} | %{time_total}s]\n" https://ssseafood.vercel.app/api/user/asset/100`

**逐字响应**：
```
{"success":true,"message":"OK","data":{"index_id":0,"uID":100,"points":4292,"lucks":0,"time_update":1791075784}}
[HTTP 200 | 1.133533s]
```
⇒ **`points=4292`** ✓ —— 修法 + 生产读路径**端到端自洽**（新库 `account(100,1).balance=4292` 经线上接口原样返回）。

**旁证（`/api/task/all`，证明未切回旧库）**：
```
{"success":true,"message":"OK","data":[{"tID":136,…},{"tID":230,…},{"tID":232,…}]}
[HTTP 200]
```
⇒ 返回**恰 3 个 job（136/230/232）**= 本单迁入的 Kevin 真 job，**等于新库 `job` 总数 3**。
**★ 口径订正**：任务书预期「`/api/task/all` 应仍 0 行」，是**迁移前**状态（新库 `job=0`）。**本单已把 Kevin 的 3 个真 job 迁入** ⇒ 现返 3 行**正是**「读路径 = 新库（含本次新增行）、**非**旧库」的证明（旧库 `job` 远多于 3 且多为夹具）。**故此读数由 0 → 3 属预期，非异常。**
**⚠ 对 S58b 的直接影响（请 Zang 注意）**：S58b 预案登记「哨兵 **task/all 仍 0 行**」—— 该前提**已被本单改变**：新库 `job=3` 且 `/api/task/all` **现返 3 行**（136/230/232）。S58b 的判别基线应改为 **`task/all = 3 行（tID 136/230/232）`**，否则会误判。

---

## §6 ★丢弃清单（逐行 —— 父表为夹具/测试 ⇒ 只能丢，共 11 行）

> 口径：不搬（父 job 为夹具/测试 ⇒ 挂不存在/夹具的父）。本单**未写这 11 行**（新库对应表零冲突）。

### §6.1 `job_submission` 9 行（`uid=970213` 曾 `reviewed_by`）

| # | submission_id | 父 job_id | 时间(UTC) | 父 job 标题（夹具/测试） | 丢弃理由 |
|--:|--:|--:|---|---|---|
| 1 | 1 | 3 | 2026-09-29 13:42:37 | `p4b2:fixture:B` | 父夹具 |
| 2 | 5 | 4 | 2026-09-29 14:07:59 | `p4b2c:fixture job` | 父夹具 |
| 3 | 18 | 20 | 2026-09-30 13:41:33 | `b4cii job b4cii30134035` | 父测试（b4cii） |
| 4 | 19 | 23 | 2026-09-30 13:58:08 | `b4cii job b4cii30134304` | 父测试（b4cii） |
| 5 | 214 | 214 | 2026-10-03 23:59:37 | `QA-Neng-A` | 父夹具（qa-neng） |
| 6 | 216 | 215 | 2026-10-03 23:59:48 | `QA-Neng-B` | 父夹具（qa-neng） |
| 7 | 219 | 216 | 2026-10-04 00:00:04 | `QA-Neng-A` | 父夹具（qa-neng） |
| 8 | 221 | 217 | 2026-10-04 00:00:14 | `QA-Neng-B` | 父夹具（qa-neng） |
| 9 | 235 | 2 | 2026-10-04 00:34:21 | `p4b2:fixture:A` | 父夹具 |

### §6.2 `job_application` 2 行（`uid=970213` 作 `worker_uid`）

| # | 父 job_id | 状态 | 父 job 标题（夹具/测试） | 丢弃理由 |
|--:|--:|---|---|---|
| 10 | 2 | applied | `p4b2:fixture:A` | 父夹具 |
| 11 | 24 | applied | 海鲜招工测试甲：整理货架与盘点（测试招工） | 父测试 |

**合计 11 行**（`job_submission 9` + `job_application 2`）。**去向**：不迁（新库无此 11 行；新库 `job_submission` 仅 3 行 = `236/237/238`）。

---

## §7 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 |
|---|---|---|
| 旧库任何写 | **未做** | 硬口径：旧库严格只读（全程仅 `SELECT`） |
| Neon 分支快照 / PITR | **未做** | 无 `neonctl`、无 Neon API 凭据（§1）⇒ **能力不存在** |
| `admin_ops_audit_log_log_id_seq` 推进 | **未做** | 不在 attested S0–S11 射程；★ 见 §8-3（残留风险） |
| 弃行 11 的**新库零痕迹** | **已验**（新库对应表无该 11 行） | 现取 |
| `job` `escrow_txid/settle_txid` 的**触发器强制** | **无**（`job_ledger_ref_guard` 为 `BEFORE UPDATE`，INSERT 不校验） | 本次**按语义**逐条查证 6/6 在库（非触发器强制） |
| 生产 `/api/admin/me` 对 uid=100 实测 | **`NOT_MEASURED`** | 硬口径：**未带真 admin 凭证**（不得用真账号）；准入结论由 `admin_user_role(100)=super_admin·12 键` + 代码推得 |
| `uid 1/10` 钱包归属 | **`NOT_MEASURED`** | 只读无法从库内证明持有人（承 S56 §4） |
| 提交后**整体回退**演练 | **`NOT_MEASURED`**（且**做不到**） | 无 PITR 凭据 + `account/ledger` 行不可删改（§1） |
| 两库 `neon_auth` schema | **`NOT_MEASURED`** | 不在射程（应用 0 引用，S55a 已证） |

---

## §8 自曝

1. **★ 回滚点能力 = 无（风险明写）**：无 `neonctl` / 无 `NEON_API_KEY` ⇒ 本单**只能**以「阶段 1 单事务 + ROLLBACK」当回滚点；**阶段 2 一经提交，`account`/`ledger_entry` 行不可逆**（`account_guard` 禁 `DELETE`、append-only 禁 `UPDATE/DELETE`）。**这不是疏忽，是环境能力缺失**，已如实登记并要求 Kevin 知悉：**若需回退须走 Neon 控制台分支/PITR**。
2. **★ `setval()` 非事务性（唯一未回退偏差）**：阶段 1 `ROLLBACK` 后 `users_uid_seq` 仍 `42→101`（PG 文档明载 `setval` 不回滚）。**无害且安全**（后续自动建户从 `102` 起，避开 `uid=100`）；阶段 2 的 S11 幂等再置 101。**未掩盖**。
3. **★ 残留风险（登记，未修）**：`admin_ops_audit_log_log_id_seq` 现仍为 `NULL`（未推进）——本单显式写入 `log_id=9`，而序列下一次 `nextval` 将为 `1` ⇒ **未来第 9 次自动审计写入会撞 `log_id=9` 唯一键**。**未修理由**：不在 attested S0–S11 射程（S11 仅 `users_uid_seq`），**不擅自扩写**；**建议后续单补 `setval('admin_ops_audit_log_log_id_seq',9,true)`**。
4. **保真度微增强（已声明）**：S1 在 attested 四列外**多带 `time_reg/time_login_last`**、S4 把 `version` 保真为旧值 `8`（原稿为 `version+1`）。二者均**不违反任何 guard**，且**更忠于源行**。
5. **`job.escrow_txid/settle_txid` 非触发器强制**：`job_ledger_ref_guard` 为 `BEFORE UPDATE`（INSERT 不触发）⇒ 该引用完整性**由本单逐条查证**（6/6 在库）而**非**数据库强制。**未把它写成「触发器保证了」**。
6. **判负 N4/N5 用独立 uid**（999999/999998）：因 `account_pk=(uid,cid)`，若复用 `(100,1)` 会先撞主键而非命中 guard ⇒ 选未占 `(uid,1)` 才能**定向触发 `account_guard`**。**未混淆「主键冲突」与「护栏拒绝」**。
7. **零写旧库 / 零仓改动**：旧库全程仅 `SELECT`；`git status` 开工空，交工**仅新增 1 个报告**（`.s58-artifacts/` 已在 `.gitignore`）。**未 commit / 未 push**。
8. **脱敏**：全文无密钥值 / 无连接串 / 无完整 evm（`sha8` 或前 6 后 4）；报告内 txid 为**整数**（非密钥）。
9. **多 agent 并发**：开工对锚 HEAD=`edd913e`；**作业期间 HEAD 前移至 `56bd0b7`（他 agent 的 S58 派单提交）**—— 经 `git merge-base --is-ancestor` 复核 **`edd913e` 仍是 `56bd0b7` 的祖先**，对锚仍成立；本单**未 commit / 未 push**；`git status --porcelain` 交工仅 `?? docs/audit/s58-kevin-backfill-executed.md` 一行。
10. **★ 哨兵口径订正（承 §5）**：`/api/task/all` 由 0 → **3 行**，是**本单迁入 Kevin 3 个真 job 的直接结果**；**S58b 预案的「task/all 仍 0 行」前提已失效**，本单已显式提示（S58b 基线应改为「3 行 = 136/230/232」）。

---

### 产物清单（`backend-ts/.s58-artifacts/s58-20261008T111203Z/`）

| 文件 | 内容 |
|---|---|
| `s58-probe.py` · `s58-probe.json` | 新库列定义/identity/触发器/FK + S0 全项 + 序列（只读） |
| `s58-source.py` · `s58-source-rows.json` | 旧库 Kevin 全表逐行精确值（含 `event_root_key` 等）+ 新库触发器事件定义 |
| `s58-exec.py` · `s58-exec-dryrun.json` · `s58-exec-commit.json` | 阶段 1 预演(ROLLBACK) / 阶段 2 提交，含 rowcount + 逐项读回 + N1–N6 |
| `s58-verify.py` · `s58-verify.json` | 阶段 3 事后现取（全局不变量 / 零冲突 / 序列 / 计数） |
