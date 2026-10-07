# S57 · 号段判据纠偏 + 漏搬真行清单 + Kevin 迁入提案（Kong · 严格只读）

> **单号**：S57（本册页为 **S57b 补誊写**：S57 同僚「分析全做完但因迭代上限未把主报告落盘」，本单**纯誊写 + 交叉核对**）。
> **角色**：Kong · **产物来源**：`backend-ts/.s57-artifacts/`（S57 探针原始产出，未改）。
> **硬口径（本单自证遵守）**：**两库严格只读**（本单**未连库**、未发任何 `INSERT/UPDATE/DELETE/DDL/nextval/setval`）· **未运行 `vercel env` 任何子命令** · **未部署** · **未起实例** · **未碰 `5787/5788/5555/5191`** · **未 `pkill -f`/`killall`** · **未 commit、未 push** · **未 `npm install`** · 原始输出不用 `.log` · 数不出来写 `NOT_MEASURED`。
> **脱敏**：全文**不含密钥值、不含连接串、不含完整 evm**（一律 `sha8` 或前 6 后 4；SQL 以 `:seed_evm` 占位）。
> **姿态前提（S55a 定格）**：新库（`ep-red-moon-b3xvoyjk`）**自 2026-10-07 13:10:49 起 = 生产库** ⇒ 任何写**须 Kevin 授权**；本单**只出提案不 apply**。

---

## §0 对锚（开工时现取）

| 项 | 读数 |
|---|---|
| `git log --oneline -3` | **`e2d7657`**（S57 + §5.396，本单的母提交）/ `c85fca5`（S56 + §5.395/B27）/ `a40793e`（S55a）— **HEAD 含 §5.396 那笔，对锚成立** |
| `git rev-parse HEAD` | `e2d7657c9ff9e25fba7a5ecf4d26f1be33e05b9e`（sha8 `e2d7657c`） |
| 分支 | `main`（`git worktree list` 单工作树 = `e2d7657 [main]`） |
| `git status --porcelain` | **空**（开工时；交工时复查仍空，本次新增仅本报告 1 个 untracked 文件） |
| 对锚现时 | **2026-10-07 21:00:48 CST**（UTC `2026-10-07 13:00:56`）— 实取 `date` / `date -u` |
| 上游读数现时 | S57 探针 `run_at_utc = 2026-10-07T12:52:50.627853+00:00`（早于本誊写约 8 分钟） |
| 旧库 host 指纹 | `ep-holy-forest-b3fi7u3u-pooler`（`.env.local`，`url_sha8 = b2462064`） |
| 新库 host 指纹 | `ep-red-moon-b3xvoyjk-pooler`（`.env.newdb.local`，`url_sha8 = 85312051`） |
| env 文件 `sha256` 前 8（**本单未改 env**） | `.env.local` = `0960bd1d` · `.env.newdb.local` = `b575627f`（现取值，见 §7 局限） |
| 零写自证 | S57 探针两库会话均报 `SHOW transaction_read_only = on`（`old_session.transaction_read_only="on"` · `new_session="on"`）；**本单自身未连库、未发任何写语句**。⇒ 零写 = 「只发读语句」+「会话只读护栏报 `on`」双重构造 |

> 说明：`e2d7657` 的提交信息即本册页骨架（「…真行仅 1…夹具 37…漏搬 44 行…修法 SQL 就绪…派 S57b 誊写报告」）；`§5.396` 全文见 `docs/seafood.master-plan.md` 第 1419–1434 行。

---

## §1 逐 uid 真伪判定（旧库 `uid ≥ 900000` 全集 = **38 个**，逐行，非抽样）

**判据四路**：(a) evm 是否为**已知真地址**（`0022 §④ DEFAULT_ADMIN_ADDRESS` / uid 1 / uid 2）；(b) `bio` 是否**直书夹具串**；(c) `account`/`ledger`/入向 FK 的**真业务足迹**；(d) `time_login_last` 是否**晚于 `time_reg`**（真实回归）。
**全集**：`900001-900008 · 910001-910010 · 910311 · 970001/970002 · 970101/970102 · 970201-970213 · 971100/971213`（8+10+1+2+2+13+2 = **38**）。

| # | uid | evm `sha8` | `bio` | `time_reg`（UTC） | `time_login_last`（UTC） | `is_admin` | account/ledger/batt 足迹 | 判定 | 判据 |
|--:|--:|---|---|---|---|:--:|---|---|---|
| 1 | 900001 | `d71be767` | `p7b fixture uid=900001` | 2026-10-02 08:07:24.024 | 同 reg | false | acct cid1 9/0 · ledger n2(净0) · batt 30 · FK 7 | **夹具** | (b) bio 夹具串；(d) 登录=注册 |
| 2 | 900002 | `8ebe6c62` | `p7b fixture uid=900002` | 2026-10-02 08:07:24.201 | 同 reg | false | acct cid1 3/0 · ledger n3(净0) · batt — · FK 9 | **夹具** | (b) bio 夹具串 |
| 3 | 900003 | `b90a3c87` | `p7b fixture uid=900003` | 2026-10-02 08:07:24.374 | 同 reg | false | acct cid1 9/0 · ledger n2(净0) · batt — · FK 4 | **夹具** | (b) bio 夹具串 |
| 4 | 900004 | `d2029fcc` | `p7b fixture uid=900004` | 2026-10-02 08:07:24.541 | 同 reg | false | acct — · ledger n0 · batt — · FK 3 | **夹具** | (b) bio 夹具串 |
| 5 | 900005 | `744d79be` | `p7b fixture uid=900005` | 2026-10-02 08:07:24.706 | 同 reg | false | acct — · ledger n0 · batt — · FK 3 | **夹具** | (b) bio 夹具串 |
| 6 | 900006 | `afc4b4f3` | `p7b fixture uid=900006` | 2026-10-02 08:07:24.878 | 同 reg | false | acct — · ledger n0 · batt — · FK 2 | **夹具** | (b) bio 夹具串 |
| 7 | 900007 | `7cb2a252` | `p7b fixture uid=900007` | 2026-10-02 08:07:25.049 | 同 reg | false | acct — · ledger n0 · batt — · FK 1 | **夹具** | (b) bio 夹具串 |
| 8 | 900008 | `af5f5842` | `p7b fixture uid=900008` | 2026-10-02 08:07:25.220 | 同 reg | false | acct cid1 9/0 · ledger n2(净0) · batt — · FK 4 | **夹具** | (b) bio 夹具串 |
| 9 | 910001 | `0d7f4809` | `qa7b fixture uid=910001` | 2026-10-02 11:05:09.971 | 同 reg | false | acct cid1 9/0 · ledger n2(净0) · batt — · FK 10 | **夹具** | (b) bio 夹具串 |
| 10 | 910002 | `316150fd` | `qa7b fixture uid=910002` | 2026-10-02 11:05:10.541 | 同 reg | false | acct cid1 3/0 · ledger n3(净0) · batt — · FK 11 | **夹具** | (b) bio 夹具串 |
| 11 | 910003 | `e4323661` | `qa7b fixture uid=910003` | 2026-10-02 11:05:10.701 | 同 reg | false | acct cid1 9/0 · ledger n2(净0) · batt — · FK 4 | **夹具** | (b) bio 夹具串 |
| 12 | 910004 | `7b661d34` | `qa7b fixture uid=910004` | 2026-10-02 11:05:10.870 | 同 reg | false | acct — · ledger n0 · batt — · FK 3 | **夹具** | (b) bio 夹具串 |
| 13 | 910005 | `42fff767` | `qa7b fixture uid=910005` | 2026-10-02 11:05:11.052 | 同 reg | false | acct — · ledger n0 · batt — · FK 3 | **夹具** | (b) bio 夹具串 |
| 14 | 910006 | `79339a90` | `qa7b fixture uid=910006` | 2026-10-02 11:05:11.235 | 同 reg | false | acct — · ledger n0 · batt — · FK 2 | **夹具** | (b) bio 夹具串 |
| 15 | 910007 | `4dcee5d8` | `qa7b fixture uid=910007` | 2026-10-02 11:05:11.411 | 同 reg | false | acct — · ledger n0 · batt — · FK 1 | **夹具** | (b) bio 夹具串 |
| 16 | 910008 | `fd7f1591` | `qa7b fixture uid=910008` | 2026-10-02 11:05:11.577 | 同 reg | false | acct cid1 9/0 · ledger n2(净0) · batt — · FK 4 | **夹具** | (b) bio 夹具串 |
| 17 | 910009 | `de6c13f9` | `qa7b fixture uid=910009` | 2026-10-02 11:05:11.747 | 同 reg | false | acct — · ledger n0 · batt — · FK 1 | **夹具** | (b) bio 夹具串 |
| 18 | 910010 | `f22e8b12` | `qa7b fixture uid=910010` | 2026-10-02 11:05:11.926 | 同 reg | false | acct — · ledger n0 · batt — · FK 1 | **夹具** | (b) bio 夹具串 |
| 19 | 910311 | `7d45754d` | `qa-p7a fixture` | 2026-10-02 07:09:40.343 | 同 reg | false | acct cid35 9976/0 + cid36 30/0 · ledger n28(净10030) · batt 30 · FK 1 | **夹具** | (b) bio 夹具串；cid 35/36 为夹具币种 |
| 20 | 970001 | `72c8bb38` | `p4b2:fixture user` | 2026-09-29 12:12:46.364 | 同 reg | false | acct cid1 1627271/3724 + cid16 9998 + cid21 97/1 + cid4 9994 · ledger n156(净 **2020100**) · batt 30 · FK 50 | **夹具** | (b) bio 夹具串；evm=`0x9700…0000` 构造地址；★其 `mint 2,000,000` = 差额主体 |
| 21 | 970002 | `e167521e` | `p4b2:fixture user` | 2026-09-29 12:12:46.879 | 同 reg | false | acct cid1 248/0 · ledger n1(净0) · batt — · FK 5 | **夹具** | (b) bio 夹具串；evm `0x9700…0000` 构造 |
| 22 | 970101 | `1032c776` | `p4b2c:fixture user` | 2026-09-29 14:04:58.315 | 同 reg | false | acct — · ledger n0 · batt — · FK 14 | **夹具** | (b) bio 夹具串；evm `0x9701…0000` 构造 |
| 23 | 970102 | `f98008ac` | `p4b2c:fixture user` | 2026-09-29 14:04:59.209 | 同 reg | false | acct — · ledger n0 · batt — · FK 4 | **夹具** | (b) bio 夹具串；evm 构造 |
| 24 | 970201 | `74539e6a` | `p4b2c:fixture uid=970201` | 2026-09-29 17:13:22.317 | 同 reg | **true** | acct — · ledger n0 · batt 30 · FK 1 | **夹具** | (b) bio 夹具串；`is_admin=true` 亦为夹具（S56 §1.2 已是此判） |
| 25 | 970202 | `0ef7b298` | `p4b2c:fixture uid=970202` | 2026-09-29 17:13:22.555 | 同 reg | false | acct — · ledger n0 · batt — · FK 1 | **夹具** | (b) bio 夹具串 |
| 26 | 970203 | `002103b0` | *(空)* | 2026-09-30 14:54:40.389 | 2026-09-30 14:54:42.030 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | (b 空但)**决定性反证 ②**：evm `0x7fc8…7c64` 在 `p5-fix-login.md §3⑨` + `b5l-*/steps.log` 逐字记为登录测试新建户；零业务足迹；登录=注册+1.6s |
| 27 | 970204 | `9d89d02b` | *(空)* | 2026-09-30 14:54:49.520 | 2026-09-30 14:54:49.817 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证②同批（b5l run 第二个新户）；零业务足迹 |
| 28 | 970205 | `81b09027` | *(空)* | 2026-09-30 15:08:18.663 | 2026-09-30 15:08:18.888 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证① evm 命中 p7b-06 建户清单 + ② p5-fix-login；零业务足迹 |
| 29 | 970206 | `82306612` | *(空)* | 2026-09-30 15:08:24.033 | 2026-09-30 15:08:24.981 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证①（p7b-06）+ ②（b5l）；零业务足迹 |
| 30 | 970207 | `cca89735` | *(空)* | 2026-09-30 15:10:41.511 | 2026-09-30 15:10:41.924 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | ★**反证③**：evm = `0x1234…5678` **占位构造地址**；反证① p7b-06；零业务足迹 |
| 31 | 970208 | `0c29f286` | *(空)* | 2026-09-30 15:14:57.548 | 2026-09-30 15:15:02.812 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证①（p7b-06）+ b5sv http 产物；零业务足迹 |
| 32 | 970209 | `ca0b9b12` | *(空)* | 2026-09-30 15:15:24.417 | 2026-09-30 15:15:27.086 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证①（p7b-06）+ b5sv http-post；零业务足迹 |
| 33 | 970210 | `e3440d45` | *(空)* | 2026-09-30 15:16:30.420 | 2026-09-30 15:16:31.536 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证① p7b-06；零业务足迹 |
| 34 | 970211 | `e34b7f8d` | *(空)* | 2026-09-30 15:19:24.096 | 2026-09-30 15:19:25.822 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证① p7b-06；零业务足迹 |
| 35 | 970212 | `f74c7d92` | *(空)* | 2026-10-01 00:23:36.574 | 2026-10-01 00:23:36.587 | false | acct — · ledger n0 · batt 30 · FK 1 | **夹具（测试建号）** | 反证① p7b-06；零业务足迹；登录=注册+0.013s |
| 36 | **970213** | **`c9f277f5`** | **`hellohello`** | 2026-10-01 00:34:03.736 | **2026-10-05 23:18:58.428** | false | acct cid1 **4292/5800** · ledger **n17(净10000)** · batt **90** · **FK 26** | **★真行（Kevin 本人）** | **(a)** evm = `0022 §④ DEFAULT_ADMIN_ADDRESS`（尾号 `09b0`，册面 §5.280/§5.296/§5.306 逐字）；**(b)** bio 非夹具串；**(c)** 真业务足迹（账户/17 分录/26 入向 FK）；**(d)** 登录晚于注册 **≈4.95 天** |
| 37 | 971100 | `713ddbd5` | `b6audit-live fixture (BE-AUDIT-LIVE)` | 2026-10-02 02:01:28.555 | 同 reg | false | acct cid1 0/0 · ledger n2(min1 burn-1 净0) · batt — · FK 3 | **夹具** | (b) bio 夹具串 |
| 38 | 971213 | `a718a2da` | `b6audit-live fixture (BE-AUDIT-LIVE)` | 2026-10-02 02:02:30.259 | 同 reg | false | acct cid1 0/0 · ledger n2(min1 burn-1 净0) · batt — · FK 3 | **夹具** | (b) bio 夹具串 |

**小计：真 1（`970213` 唯一）/ 夹具 37。**
**夹具分组**：**27 行 `bio` 直书夹具串**（`p7b/qa7b/p4b2/p4b2c/qa-p7a/b6audit`）+ **10 行 `bio` 空但决定性反证**（`970203-970212`）。见下图。

### §1.1 两个决定性反证（写清）

**反证 A —— 10/10 evm 命中 `p7b-06-fixture-setup` 的建户清单**（`backend-ts/.p7b-artifacts/p7b-06-fixture-setup-collect1.json`，脚本 `scripts/p7b-06-fixture-setup.ts`，`at=2026-10-02T08:10:47.973Z`）：
- 该产物的顶层 `users[]` 共 **28 条**（含 `970203`…`970212` 十行，逐条 `uid`+完整 `evm`）；本单**逐 uid 交叉核对**：`970203 002103b0`↔`0x7fc8…7c64` · `970204 9d89d02b`↔`0x058e…9ef8` · `970205 81b09027`↔`0x5392…4405` · `970206 82306612`↔`0xee21…09ac` · `970207 cca89735`↔`0x1234…5678` · `970208 0c29f286`↔`0x1cba…86e0` · `970209 ca0b9b12`↔`0x720c…b94b` · `970210 e3440d45`↔`0x6b1f…3d7f` · `970211 e34b7f8d`↔`0x94a1…fcf4` · `970212 f74c7d92`↔`0x7389…01ab` ⇒ **10/10 逐字命中**（含地址前后缀），父脚本即夹具建户脚本。
- 该产物 `residue_manifest` 另记 `users = [900001…900008]`（8 个 9e8 号）+ 角色/订单残留 ⇒ 同一产物把 `9702xx` 与 `9000xx` 视为**同一夹具批次**。**注**：原 §5.396 表述写作「`residue_manifest.users[28]`」，严格说是**顶层 `users[]`（28 条）**；`residue_manifest.users` 本身只有 8 条 —— 本单按产物**逐字订正**该引用（见 §7 交叉核对）。

**反证 B —— `970203`（及其同批）的建户逐字见登录测试记录**：
- `docs/audit/p5-fix-login.md` **§3 检查表第 ⑨ 行**：「账本不变量…Δ`users_total` = **+2**」+ 该行下方注：「每次 run 有 **2 个新地址**走登录 ⇒ `findOrCreateUserByEvm`（`database.ts:831`）建 `users` 行…本单共 4 行：`uid` **970203** 等…这是登录的既有侧效应」。产物目录 = `backend-ts/.p4-artifacts/b5l-20260930T145112Z/`。
- `b5l-20260930T145112Z/steps.log` **逐字**：`FIXTURE new=0x7fc8107e56eb5eeb9e059e5abc6cf960b2947c64 existing={"uid":"2",...}`（= `970203` 的 evm）· `DB_BEFORE users_total=24 → DB_AFTER users_total=26` · `INVARIANTS {"delta_users_total":2,…}`。时间 `2026-09-30T14:54:37–14:55:02Z` **与** `970203` 的 `time_reg 14:54:40` / `970204 14:54:49` **吻合**。
- ⇒ `970203` 是**登录端点夹具测试**由 `findOrCreateUserByEvm` 自动建的行，**非真人**。

> **判据纠偏结论（核心）**：号段 `uid ≥ 900000` **只能当提示、不能当判据**（Kevin 的真号 `970213` 恰落此段、曾被一刀切误剔）；**正确判据 = 逐行证据**（已知真地址 / `bio` 非夹具串 / 真业务足迹 / 注册后真实登录）。以上 38 行即按此逐行判定。

---

## §2 漏搬真行清单 + Kevin 26 处入向 FK 逐处

### §2.1 漏搬真行清单（Kevin 去重 **44 行**：可搬 **33** / 不可搬 **11**）

**成对铁律复核**：
- `account ↔ ledger_entry`（**硬**）：17 行 `sum_delta = 4292 = account.balance` · `sum_frozen_delta = 5800 = account.frozen` · 最新分录 `balance_after=4292 / frozen_after=5800` ⇒ **自洽 ✓**。
- `batt_account ↔ batt_entry`（**软**）：`batt = 90 = 30+30+30` · 最新 `batt_after = 90` ⇒ **自洽 ✓**。

**可搬 33 行（逐表）**：

| 表 | 行数 | 明细 |
|---|--:|---|
| `users` | 1 | `uid=970213`（evm=`0x59f9…09b0` · bio `hellohello` · `is_admin=false`） |
| `account` | 1 | `(uid=970213, cid=1, balance=4292, frozen=5800)` |
| `ledger_entry` | 17 | txid `1439/1440/1441/2355–2361/2363–2365/2367–2369/2372`（mint1 · job_escrow6 · job_payout7 · job_fee3；净 mint−burn=10000） |
| `batt_account` | 1 | `(uid=970213, batt=90)` |
| `batt_entry` | 3 | txid `326/574/605`（invite_signup +30 · checkin +30 · checkin +30） |
| `checkin_log` | 2 | log_id `218`(2026-10-03) / `227`(2026-10-04) |
| `admin_user_role` | 1 | `(970213, super_admin)` |
| `admin_ops_audit_log` | 1 | log_id `9`（`points_adjust` mint 10000 · key `…kevin-grant-10000-a` · txid 1439） |
| `job` | 3 | job_id `136 / 230 / 232`（雇主 `970213`，**父自身为真**） |
| `job_submission` | 3 | submission_id `236 / 237 / 238`（worker+reviewed_by 均 `970213`，**父 job 真**） |
| **合计** | **33** | |

**不可搬 11 行（父表是夹具/测试 ⇒ 只能丢）**：

| 表 | 行数 | 明细 | 为何不可搬 |
|---|--:|---|---|
| `job_submission` | 9 | sub `1/5/18/19/214/216/219/221/235` | 父 job 为**夹具/测试**：`3/4/2/214/215/216/217/20/23`（`p4b2`/`p4b2c`/`qa-neng`/`b4cii`）⇒ 挂不存在的父 |
| `job_application` | 2 | `970213` 申请的 job `2 / 24` | 父 job `2`=`p4b2:fixture:A`、`24`=测试招工 ⇒ 夹具/测试 |
| **合计** | **11** | | **「父表是夹具 ⇒ 只能丢」** |

> **排除项（非漏搬）**：`account.uid` / `ledger_entry.uid` / `batt_entry.uid` **并非 FK→`users`**（仅值引用）⇒ 上面 17+3 行**不计入**入向 FK；§2.2 的 26 处**不含**它们。

### §2.2 Kevin 的 **26 处入向 FK** 逐处（表.列 = 行数 ⇒ 父行真/夹具）

| # | 表`.`列 | 行数 | 父行真 / 夹具 |
|--:|---|--:|---|
| 1 | `job_submission.reviewed_by` | 12 | 父 job **真 3**（`136/230/232`）+ **夹具/测试 9**（`3/4/2/214/215/216/217/20/23`） |
| 2 | `job_submission.worker_uid` | 4 | 父 job **真 3** + **夹具 1** |
| 3 | `job.employer_uid` | 3 | = 他自持的 **3 个真 job**（`136/230/232`） |
| 4 | `checkin_log.uid` | 2 | **自持真行**（`218/227`） |
| 5 | `job_application.worker_uid` | 2 | 父 job **夹具/测试 2**（`2/24`） |
| 6 | `admin_ops_audit_log.target_uid` | 1 | **自持真行**（log_id 9） |
| 7 | `admin_user_role.uid` | 1 | **自持真行**（`super_admin`） |
| 8 | `batt_account.uid` | 1 | **自持真行**（batt 90） |
| | **合计** | **26** | |

> 口径：**26 = 列-引用点个数**（`job_submission` 同时以 `reviewed_by=12` 与 `worker_uid=4` 贡献 16 点；行去重后 `job_submission` 实际 ≤12 行）。其中 **可搬**（父真）= `job_submission`(真父 3+3) + `job.employer_uid` 3 + `checkin_log` 2 + `admin_ops_audit_log` 1 + `admin_user_role` 1 + `batt_account` 1 = **14 处**；**不可搬**（父夹具/测试）= `job_submission` 9(+1) + `job_application` 2 = **12 处**；14+12 = 26 ✓（与 §2.1 的 33/11 由**不同切分口径**导出：§2.1 按**行**去重、§2.2 按**FK 引用点**计数）。

---

## §3 不变量重算（旧库 `cid=1` 三口径 + 补搬后 + 订正注）

### §3.1 旧库 `cid=1` 三口径（全量 = 拆分之和）

| 口径 | n（行） | Σmint | Σburn | **Σmint−Σburn** |
|---|--:|--:|--:|--:|
| **全量**（旧库 `ledger_entry WHERE cid=1`） | **413** | 2,210,276 | −200,076 | **2,010,200** |
| **`uid < 900000`**（真号段） | **248** | 200,274 | −200,074 | **200** |
| **`uid ≥ 900000`**（高号段） | **165** | 2,010,002 | −2 | **2,010,000** |

⇒ `200 + 2,010,000 = 2,010,200` **恒等 ✓**（= 旧库 `currency.cid=1` 的 `total_supply`）。

### §3.2 补搬 Kevin 后（新库）

- 新库现量 `cid=1`：`Σmint−Σburn = 200`（n=248，与旧库 `uid<900000` 逐字相同）。
- 补搬 Kevin（`mint 10,000 − burn 0 = 10,000`，n=17）后：**`Σmint−Σburn` 由 `200` → `10,200`**。
- 逐 uid 不变量成立：`uid=100` 补搬后 `Σdelta = 4292 = 最新 balance_after` ✓ · `5800 = 最新 frozen_after` ✓。
- **币种级 `total_supply` 不变**：仍 `2,010,200`（`currency.cid=1`）—— 变的是「新库账本净额与它的差」的**归因**，不是 `total_supply` 自身。

### §3.3 ★ 订正注（订正 S54b / §5.391-F 的旧分解）

> **旧表述**（S54b / §5.391-F）：「差额 **2,010,000** = **未搬夹具行的 mint/burn 净额**（全为夹具）」。
> **订正**：**不正确** ⇒ 正确分解 = **纯夹具 2,000,000**（**几乎全部来自 `970001` 的 `mint 2,000,000`**；`971100/971213` 各 `mint 1 − burn 1` 净 0，余同）+ **Kevin 真行 10,000** = **2,010,000**。
> ⇒ **2,010,000 = 全 `uid ≥ 900000` 的净额，而非「全夹具」**；旧表述把「号段 = 夹具」这一被质疑的判据再度用作分解依据 ⇒ **订正为「全 `uid ≥ 900000`」**。

---

## §4 修法 SQL（**只写不进** · 与 `docs/audit/s56-admin-permission-parity.md` §6 对齐）

> ⚠️ **本单未执行下列任何语句**。下列为**授权者定档后**执行的建议稿。**对齐点**：同 `uid=100`（新库 `max_uid=41`、`uid=100` 空闲）· 同 `super_admin` 绑定（= `0022 §④` 的同义重建）· 同 `:seed_evm` 占位（值见 `migrations/0022_admin_permission_seed.sql §④`，**不在本报告打印**）。
> **总体**：S1–S11 **单事务**；**事务前须备份**（见 §4.4 回滚的硬事实）。

### §4.1 S0 前置只读核对（应得：全 0 / 无冲突）
```sql
-- 目标 evm 在新库必须不存在（否则 S1 会撞 users_evm_uniq）
SELECT uid, is_admin FROM public.users WHERE lower(evm)=lower(:'seed_evm');      -- 期望 0 行
-- 选号空闲（现取 max_uid=41 ⇒ 100 空闲）
SELECT count(*) FROM public.users WHERE uid=100;                                  -- 期望 0
-- Kevin 的 17 个 ledger idempotency_key 在新库冲突 0
SELECT count(*) FROM public.ledger_entry WHERE idempotency_key = ANY(:'kevin_keys'); -- 期望 0
-- job/submission create_key 冲突 0（kevin_job_keys / kevin_sub_keys）
```

### §4.2 S1–S11（单事务 · `OVERRIDING SYSTEM VALUE` 显式给号）
```sql
BEGIN;
-- S1 用户行（uid=100，is_admin=false ⇒ 忠于 0022 §④：权限完全依赖角色行）
INSERT INTO public.users (uid, evm, bio, is_admin)
VALUES (100, lower(:'seed_evm'), 'hellohello', false)
ON CONFLICT (evm) DO NOTHING;                                   -- users_evm_uniq 幂等兜底
-- S2 账户行须从 0/0 起步（过 account_guard 的 INSERT 分支；account_pk=(uid,cid)）
INSERT INTO public.account (uid, cid, balance, frozen, version)
VALUES (100, 1, 0, 0, 0)
ON CONFLICT (uid, cid) DO NOTHING;                              -- ★必为 0/0，否则 guard 报错
-- S3 账本 17 行（显式 txid；ALWAYS identity ⇒ 须 OVERRIDING SYSTEM VALUE）
INSERT INTO public.ledger_entry (txid, uid, cid, delta, frozen_delta, balance_after, frozen_after,
                                 kind, ref_type, ref_id, idempotency_key, event_root_key, memo, time_created)
OVERRIDING SYSTEM VALUE
SELECT * FROM (VALUES …17 行… ) AS v(…)                        -- 值取自 s57-kevin.json kevin_ledger[]
ON CONFLICT (txid) DO NOTHING;
-- S4 账户对账到最新分录快照（过 account_guard 的 UPDATE 分支：须已有 ledger_entry）
UPDATE public.account SET balance=4292, frozen=5800, version=version+1, time_updated=now()
 WHERE uid=100 AND cid=1;
-- S5 batt（账户 + 3 行分录；batt_entry offset 3 = 30/60/90）
INSERT INTO public.batt_account (uid, batt) VALUES (100, 90) ON CONFLICT (uid) DO NOTHING;
INSERT INTO public.batt_entry (txid, uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo, time_created)
OVERRIDING SYSTEM VALUE SELECT …3 行… ON CONFLICT (txid) DO NOTHING;
-- S6 签到 2 行
INSERT INTO public.checkin_log (log_id, uid, checkin_day, streak_day, reward_batt, time_created)
OVERRIDING SYSTEM VALUE SELECT …2 行… ON CONFLICT (log_id) DO NOTHING;
-- S7 角色绑定（= 0022 §④ 同义重建 · 按库内 evm 匹配，非硬编码）
INSERT INTO public.admin_user_role (uid, role_key)
SELECT u.uid, 'super_admin' FROM public.users u WHERE lower(u.evm)=lower(:'seed_evm')
ON CONFLICT (uid, role_key) DO NOTHING;
-- S8 审计 1 行（log_id 9 · action=points_adjust · target_uid=100 · txid 关联 S3 的 1439）
INSERT INTO public.admin_ops_audit_log (log_id, actor_uid, action, target_uid, cid, op, amount,
       balance_before, balance_after, request_fingerprint, idempotency_key, result, txid, memo, time_created)
OVERRIDING SYSTEM VALUE VALUES (9, 1, 'points_adjust', 100, 1, 'mint', 10000, 0, 10000,
       :'kevin_fp', 'ops:1:points_adjust:970213:1:kevin-grant-10000-a', 'applied', 1439, 'PROMOTION_BONUS', …)
ON CONFLICT (log_id) DO NOTHING;
-- S9 job 3 行（136/230/232；escrow_txid/settle_txid 指回 S3 的 txid；父自身为真）
INSERT INTO public.job (job_id, employer_uid, worker_uid, cid, reward, title, description, status,
       create_key, escrow_txid, settle_txid, ledger_event_keys, time_created, time_updated, headcount)
OVERRIDING SYSTEM VALUE SELECT …3 行… ON CONFLICT (job_id) DO NOTHING;
-- S10 job_submission 3 行（236/237/238；父 job 已在 S9）
INSERT INTO public.job_submission (submission_id, job_id, worker_uid, deliverable, review_status,
       reviewed_by, reviewed_at, review_memo, create_key, time_created)
OVERRIDING SYSTEM VALUE SELECT …3 行… ON CONFLICT (submission_id) DO NOTHING;
-- S11 序列推进（防后续建户撞号）
SELECT setval('public.users_uid_seq', 101, true);
-- 正读回（应得：uid=100 · is_admin=false · has_role=true · perms=12 键全量）
COMMIT;
```

### §4.3 判负（≥5 条，必须能令提案「红」）

| # | 构造 | 期望「红」 |
|--:|---|---|
| **N1** | S7 用一个**不在库的 evm** 跑 `INSERT…SELECT` | 命中 **0 行** ⇒ `admin_user_role` **不增行**（证明绑定**按 evm 匹配**，非无条件插） |
| **N2** | 把 S7 的 `uid` 换成**不存在的 uid**（如 999） | **违反 `admin_user_role_uid_fk`** ⇒ 事务回滚（不能给幽灵 uid 绑角色） |
| **N3** | **重复跑 S1+S2+S3+S7** | 全 `ON CONFLICT DO NOTHING` ⇒ **0 新行**（幂等） |
| **N4** | 跳过 S2/S4、**直插 `account` 带 4292/5800** | **`account_guard`** 报「账户须从 0/0 起步」⇒ 拒（证明必须先账本后账户） |
| **N5** | **先 S4 后 S3**（插账本前先 `UPDATE account`） | **`account_guard`** 报「update without any ledger_entry」⇒ 拒（证明 `account↔ledger` 顺序不可颠倒） |
| **N6** | 重建后对 **control uid 2**（`is_admin=false`、无角色行）跑 `resolveAdminAccess` | `can_access_admin=false`（权限**未外溢**）；对 uid 100 ⇒ `true` |

### §4.4 回滚（**含硬事实：账本/账户行不可逐行回滚**）

> ★★ **硬事实（新库约束现取）**：
> - **`account_guard`（`account_uid_fk` 之外）对 `DELETE` 直接 `RAISE`** ⇒ **账户行不可删**；
> - **`ledger_entry` append-only 触发器对 `UPDATE/DELETE` `RAISE`** ⇒ **账本行不可改/不可删**；
> ⇒ **一旦 S2/S3/S4 写入，`account` / `ledger_entry` 行即「不可逐行回滚」**。逐行删**仅**对 `job_submission / job / checkin_log / batt_account / batt_entry / admin_user_role / admin_ops_audit_log / users` 有效。
> ⇒ **任何此类写的前置兜底 = 事务前快照 / Neon 分支 / PITR**；次选 = 临时 `DISABLE TRIGGER`（须 owner，**高危，不推荐**）。

**可逆部分的回滚（如 S1–S11 后尚未发生下游写）**：
```sql
BEGIN;
-- 先删可删面（顺序：子→父；避开 account/ledger 的 DELETE 触发器）
DELETE FROM public.admin_ops_audit_log WHERE target_uid=100 AND log_id=9;
DELETE FROM public.admin_user_role WHERE role_key='super_admin'
  AND uid IN (SELECT uid FROM public.users WHERE lower(evm)=lower(:'seed_evm'));
DELETE FROM public.job_submission WHERE submission_id IN (236,237,238);
DELETE FROM public.job WHERE job_id IN (136,230,232);
DELETE FROM public.checkin_log WHERE uid=100;
DELETE FROM public.batt_entry WHERE uid=100;
DELETE FROM public.batt_account WHERE uid=100;
-- ★ users 行：仅当该行此后**未被** account/ledger 依赖（否则撞 FK）时才可删
DELETE FROM public.users WHERE lower(evm)=lower(:'seed_evm');
COMMIT;
-- ★ account / ledger_entry：**不可 DELETE**（触发器）⇒ 只能靠快照/PITR 回退整个事务
```

---

## §5 风险量化（时间敏感：Kevin 一旦登录，修法前提坍塌）

**机制**（`database.ts:2152-2164` `findOrCreateUserByEvm`）：若 Kevin 在**现状下**用钱包登录 ⇒ 新库 `users` 查无其人 ⇒ **未命中即建户**（新 `uid`、零资产、`is_admin=false`、**无 `admin_user_role`**）。
- **量化**：现库 `max_uid=41`；`users_uid_seq.last_value=42 / is_called=true`（序列已被消费到 42）⇒ 他登录将得 **`uid≈42–43`**（**注**：§5.396 原文写「=MAX+1=42」；序列读数显示下一 `nextval` 可能为 **43**，见 §7 交叉核对）。
- **后果链**：① 一旦建了 **uid=42/43 的新户**，S1 的 `INSERT … ON CONFLICT(evm) DO NOTHING` 会被**跳过**（evm 已存在）⇒ S2 起的资产/账本插入仍指向 **`uid=100`** ⇒ **因无此用户/父行而失败**（或写入错误 uid）⇒ **修法前提坍塌、须改做 uid 合并**（贵得多）。② 且新户与旧库 `4292/5800/17 行` **割裂**。
- ⇒ **抢在该登录发生前修**（本单不写库，仅登记该时间窗约束）。

---

## §6 未做与 `NOT_MEASURED`

| 项 | 状态 | 原因 |
|---|---|---|
| **任何写**（S0–S11、`setval`、建户、绑定） | **未做** | 硬口径：两库只读、生产写需 Kevin 授权 |
| 本单**连库复核读数** | **未做** | 本单为**纯誊写**；读数转写自 `.s57-artifacts/`（见 §7） |
| 生产 HTTP `/api/admin/me`、`/api/auth/verify` 实际响应 | **`NOT_MEASURED`** | 硬口径：**未带真凭证**，不得用真账号；§5 由代码推得 |
| `uid 1/10` 钱包归属 | **`NOT_MEASURED`** | 只读无法从库内证明持有人（承 S56 §7） |
| `970213` **为何拿 9e8 号** / 由哪段脚本写入 | **`NOT_MEASURED`** | 未做代码考古（承 S43/S48/S56） |
| 补搬后新库 `Σmint−Σburn=10,200` 的**线上实测** | **`NOT_MEASURED`** | 提案未执行 ⇒ 为**推演值** |
| 旧库 `prize/market` 等非账本面计数 | **`NOT_MEASURED`** | 不在本单射程 |
| 两库 `neon_auth` schema 行数 | **`NOT_MEASURED`** | 应用 0 引用（S55a 已证） |
| 会话级只读护栏是否「万无一失」 | **部分**：S57 探针两库 `SHOW transaction_read_only=on`，但**本单自身未连库** ⇒ 零写来自「未发写语句」构造 | 见 §0 / §7 |

---

## §7 自曝

1. **本单为「补誊写」**：S57 同僚**分析全做完但因迭代上限未把主报告落盘**（`§5.396` 记「PARTIAL/截断」）⇒ 本单**不重做分析**，把 `.s57-artifacts/` 的读数与 §5.396 的结论**誊写为报告**；**未连库、未发任何写语句**。
2. **哪些数字是「转写」而非我重取**：§0 的 host/`url_sha8`/会话 `read_only`、§1 全 38 行、§2 清单与 26 FK、§3 三口径与 `10,200` —— **全部转写自** `s57-probe.json` / `s57-probe2.json` / `s57-probe5.json` / `s57-probe6.json` / `s57-summary.json` / `s57-kevin.json` / `s57-kevin-full.json` 与 `§5.396`。**我亲取（新取）的**：`§0` 的 git 对锚 / 分支 / HEAD sha / `git status` / 现时；`env` 的 `sha256` 前 8；并对**两条决定性反证各做了一次只读回读**：`p7b-06-fixture-setup-collect1.json`（`users[]` 28 条逐 uid 命中）与 `p5-fix-login.md §3⑨` + `b5l-*/steps.log`（`0x7fc8…7c64` 建户逐字 + `Δusers_total=2`）。
3. **§1.1 反证 A 的引用订正**：§5.396 写「命中 `residue_manifest.users[28]`」；实为**顶层 `users[]`（28 条）**，而 `residue_manifest.users` 只有 8 条 ⇒ 本单按产物**逐字订正**（未顺原表述）。
4. **§5 风险量化的数字订正**：§5.396 写「建 `uid=MAX+1=42`」；`probe6` 现取 `users_uid_seq.last_value=42 / is_called=true` ⇒ 下一 `nextval` 可能为 **43**，如实并列、未抹平。
5. **脱敏**：全文不含密钥、连接串、完整 evm（`sha8`/前 6 后 4）；SQL 以 `:seed_evm`/`:kevin_keys`/`:kevin_fp` 占位。
6. **零写 / 零仓改动**：本单未起实例、未碰 `5787/5788/5555/5191`、未 `pkill/killall`、未 `npm install`、未 `vercel env`、未部署、**未 commit/未 push**；开工 `git status` 空，交工仅**新增本报告 1 个 untracked 文件**（`.s57-artifacts/` 已在 `.gitignore`）。
7. **env 附录的局限**：`env` 的 `sha256` 前 8（`.env.local 0960bd1d` / `.env.newdb.local b575627f`）是**现取值**，无对照基准 ⇒ 只能作「交工时值」登记，**不作「未变」的证明**（本单确未修改 env）。
8. **`§3.3 订正注` 是对我方既往归因的自纠**：把「2,010,000 = 全夹具」订正为「全 `uid ≥ 900000`（纯夹具 2,000,000 + Kevin 真行 10,000）」；`total_supply` 自身裁定不变（仍币种级 `2,010,200`）。

---

### 产物清单（本次可复用 · **未新建**）

| 文件（`backend-ts/.s57-artifacts/`） | 内容 |
|---|---|
| `s57-probe.json` | 两库会话/指纹 · 38 候选全量四路证据 · `old_cid1` 三口径 · `new_users` 26 |
| `s57-probe2.json` | evm 构造性启发 · batt 分型 · 入向 FK 各表行数 · 旧 `admin_user_role` 7 行 |
| `s57-probe5.json` | 逐候选 `cid=1` mint/burn/net · `job`/`ledger` 子表 FK 图 · 列清单 |
| `s57-probe6.json` | 新库约束/唯一索引/identity/序列 · `setval` 候选 · `super_admin`/12 键 · Kevin keys 冲突 0 |
| `s57-kevin.json` · `s57-kevin-full.json` | Kevin 足迹（FK 26 处 · 17 分录 · job/sub/audit/checkin/batt 全量） |
| `s57-summary.json` | 38 行判定结果 · 不变量 · 订正注 |

> 本源报告：`docs/audit/s56-admin-permission-parity.md` §6（修法 SQL 的 uid=100/`super_admin` 对齐）· `docs/audit/p5-fix-login.md` §3⑨（反证 B）。
