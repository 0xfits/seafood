# S54 · 新库补齐（三步走搬 `account`）+ `total_supply` 订正 + 站名「海鲜市场」—— 含**现库仅两条窄写**（原值留痕/回退）与新库**终态六项验收**

- **单号**：S54（角色：**Kong**）· 模式：**新库可写；现库仅两条窄写；其余零写**
- **日期**：2026-10-07（CST）
- **runid**：`s54-20261007T111114Z`
- **产物目录**：`backend-ts/.s54-artifacts/s54-20261007T111114Z/`（`**/.*-artifacts/` 已忽略，`.gitignore:342`）
- **现库（生产，除两条窄写外只读）**：`.env.local` ⇒ host 前缀 `ep-holy-forest-b3fi7u3u` · `neondb` · PostgreSQL 18.6
- **新库（唯一写目标）**：`.env.newdb.local` ⇒ host 前缀 `ep-red-moon-b3xvoyjk` · `neondb` · PostgreSQL 18.6
- **结论先行（一句话）**：新库补齐**成功**（`ledger_entry 176` / `account 19 净新增` / `batt_account 18` / `batt_entry 20` / `checkin_log 4` / `checkin_makeup_log 5` 全落地；`total_supply=2,010,200`；站名两库均「海鲜市场」）；现库两条窄写完成（原值 `2210276` / `p4b2c:siteA` 留痕 + 回退 SQL）。**★ 但三步走暴露一条结构性发现（必须拍板）**：S52c-pre 给的 `ledger_entry 176` 是 **T1 文本夹具过滤后的子集**，**不是「按 uid 闭合」**——`176` 集里剔掉了真实用户与夹具账户之间的**真实分录**（共 **72 行**，落在 **13 个 uid**），因此 `account.balance = Σdelta` 在**新库对 12 个 uid 不成立**、`uid=6` 的真实余额（930）被 `trg_account_guard` **当场拒**（新库只认 990）。**按 uid 闭合的正确集 = `cid=1 ∧ uid<900000` 全部 = 248 行**；我已用「单事务真跑 + ROLLBACK」反事实证明**248 集能让全部 21 个账户 UPDATE **零拒绝**、不变量**零失配**、且与生产值**逐一相等**。⇒ **本单落在新库的是 Kevin 批准的 176 集（未擅自改数）；248 集是否改采，请 Kevin/Zang 拍板**（§1.5 / §6.2 / §7）。

---

## §0 对锚（开工 / 收尾）

| 项 | 开工 | 收尾 | 命令 |
|---|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | 同 | `pwd` |
| HEAD | `967cf21`（含 S53） | **`057415f`**（Zang 的 S54 派单提交，**外部提交、非本单**） | `git log --oneline -1` |
| HEAD 含锚点 | `967cf21` **是 HEAD 的祖先**（`git merge-base --is-ancestor 967cf21 HEAD` ⇒ 真） | 同 | `git merge-base --is-ancestor` |
| tracked 改动 | 0（`git status --porcelain` 空） | **0**（`git status --porcelain` 空） | `git status --porcelain` |
| `backend-ts/.env.local` sha256 | `0960bd1d…a453` | **同值（未变）** | `shasum -a 256` |
| `backend-ts/.env.newdb.local` sha256 | `b575627f…479b` | **同值（未变）** | `shasum -a 256` |
| 现库 host / db / 版本 | `ep-holy-forest-b3fi7u3u` / `neondb` / PG 18.6 | 同 | 进程内 dotenv + `version()` |
| 新库 host / db / 版本 | `ep-red-moon-b3xvoyjk` / `neondb` / PG 18.6 | 同 | 同上 |
| `host_different` | **true** | **true** | 两 DSN host 对比 |
| 只读自证（现库） | `BEGIN`+`SET TRANSACTION READ ONLY`；`transaction_read_only='on'` | 同 | `current_setting('transaction_read_only')` |

**开工现状（承 S52c-pre，本单现取复核）**：新库 `ledger_entry=0` · `batt_account=0` · `batt_entry=0` · `checkin_log=0` · `checkin_makeup_log=0` · `account=4`（uid `-3/-2/-1/0` × `cid=1`，全 `balance=0`）· `currency=1`（`total_supply=0`）· `users=26`。

**连库方式（硬口径）**：一律**进程内** `python3` + `psycopg2`，DSN 由 `dotenv.dotenv_values()` 读 **绝对路径** 的 `.env.local` / `.env.newdb.local`（**未 shell `source`/`export`，未进 argv/`ps`，未打印任何凭据值**）；现库全程 `SET TRANSACTION READ ONLY`（两条窄写除外，见 §5）。**未起实例、未打 HTTP、未碰 `5787/5788/5555/5191`；未 `pkill`/`killall`；未 `npm install`；未 commit/push。**

---

## §1 三步走实测（先实测路径）—— 逐步读数

**S52c-pre 结论的路径**：① 先搬 `ledger_entry`（真行，父 `cid` 指向真币）② `INSERT account(balance=0 ∧ frozen=0)` 过 `trg_account_guard` 的 INSERT 分支 ③ `UPDATE` 到「最新 `ledger_entry` 快照」（UPDATE 分支要求 `NEW.balance=最新 balance_after ∧ NEW.frozen=最新 frozen_after`）。

### §1.1 逐步读数（新库，单事务，`migrate.json`）

| 步 | 动作 | 读数 |
|---|---|---|
| 前置 | 新库 6 表快照 | `ledger_entry 0 · account 4 · batt_account 0 · batt_entry 0 · checkin_log 0 · checkin_makeup_log 0` |
| **① 搬账本** | `INSERT ledger_entry … OVERRIDING SYSTEM VALUE`（identity **ALWAYS**） | **176 行**；回读 `n=176 · Σdelta=104350 · Σfrozen_delta=−6552 · Σmint=200000 · Σburn=−200074 · txid∈[52,2651]` |
| **② INSERT 账户** | `INSERT account(uid,cid,balance=0,frozen=0,…)` | **尝试 19 · 插入 19 · 跳过已存在 0 · 被守卫拒 0** |
| **③ UPDATE 到快照** | 逐 uid `UPDATE account SET balance=最新 balance_after, frozen=最新 frozen_after`（每 uid 一个 `SAVEPOINT`） | **UPDATE 21 个 uid · 被守卫拒 0**；其中**与生产值相等 20 / 21** |
| 参照臂 3b | 对照：把 `uid=6` 强行 UPDATE 成**生产真值 930** | **★ 被 `trg_account_guard` 当场拒**：`P0001` · `account(930/0) != latest ledger snapshot(990/0) for uid=6 cid=1` |

**⇒ 三步走「机制」成立**（0/0 插入通过；UPDATE 到**新库最新分录快照**通过）。**但**它只能把账户 UPDATE 成**「新库 176 集的最新快照」**；一旦要求落**生产真值**，`uid=6` 就被守卫**结构性拒**。

### §1.2 `uid=6` 为何是分水岭（现取证据）

`uid=6` 的 7 笔 `cid=1` 分录里，**后 6 笔是「真实用户 → 夹具账户」的转出**（`kind=transfer`，`idempotency_key = ops:p7b:fund:collect1:900001 / ops:qa7b:fund:fix1:910001 …`）：

```
txid 77  bal_after=990  job_payout                       (真值锚点)
txid 335 bal_after=980  transfer  ops:p7b:fund:collect1:900001   ← 含 'p7b'
txid 337 bal_after=970  transfer  ops:p7b:fund:collect1:900003   ← 含 'p7b'
txid 339 bal_after=960  transfer  ops:p7b:fund:collect1:900008   ← 含 'p7b'
txid 347 bal_after=950  transfer  ops:qa7b:fund:fix1:910001      ← 含 'qa7b'
txid 349 bal_after=940  transfer  ops:qa7b:fund:fix1:910003      ← 含 'qa7b'
txid 351 bal_after=930  transfer  ops:qa7b:fund:fix1:910008      ← 含 'qa7b'  (= 生产 account.balance)
```

`T1` 文本口径把 **335–351 全数剔除**（`idempotency_key` 命中 `p7b`/`qa7b`）⇒ 新库 `uid=6` 的分录止于 `txid 77 (990)` ⇒ 守卫只认 **990**，**真值 930 落不进去**。

### §1.3 ★ 176 集**不是按 uid 闭合**（逐 uid 读数）

把 `cid=1 ∧ uid<900000` 的全部行与 176 集逐 uid 对比（`peruid.json`）。**13 个 uid** 的 176 子集 `Σdelta ≠ 生产 account.balance`：

| uid | 生产 account | 176 子集 n / Σdelta / 最新快照 | 248 闭合集 n / Σdelta / 最新快照 |
|--:|--|--|--|
| −1 | `168558,0` | 34 / **3356** / 168558 | 60 / 168558 / 168558 |
| 2 | `7400,0` | 22 / **−2600** / 7400 | 24 / 7400 / 7400 |
| **6** | `930,0` | **1 / 990 / 990** | **7 / 930 / 930** |
| 7 | `5100,0` | 1 / **−200** / 5100 | 4 / 5100 / 5100 |
| 8 | `4900,0` | 1 / **200** / 4900 | 4 / 4900 / 4900 |
| 11 | `29374,6370` | 15 / **944** / 29374 | 28 / 29374 / 29374 |
| 12 | `139417,0` | 21 / **101629** / 139417 | 34 / 139417 / 139417 |
| 19 / 21 | `100,0` | 3 / **−37** / 100 | 4 / 100 / 100 |
| 34 / 36 / 40 | `100,200` | 14 / **−1300** / 100 | 15 / 100 / 100 |
| 38 | `50,250` | 16 / **−1350** / 50 | 17 / 50 / 50 |

**关键区分**：
- **12 个 uid**：新库 `balance = 最新快照 ≠ Σdelta(176 集)` ⇒ `balance = Σdelta` **不成立**。
- **`uid=6`**：新库内恰自洽（`990=990=990`），**但与生产真值（930）差 60** ⇒ 三种「对」互相打架。

**根因（一句话）**：**T1 夹具过滤剔掉的是「真实用户/平台与夹具之间的真实分录」**（如真实用户向夹具账户转出、平台从夹具货币创建收 fee），这些行**不是夹具行**（`uid<900000`），剔除它们就让**按 uid 的分录集不闭合**。⇒ 「零夹具」与「`balance=Σdelta` 闭合」在**同一过滤口径下不可兼得**（§6.2 取舍）。

### §1.4 missing 行画像（72 行 = 248 − 176）

按 kind：`currency_create_fee 18 · hold 22 · transfer 16 · listing_deposit 8 · purchase 4 · sale 2 · mint 2`。按命中源：`idempotency_key` 命中 `p4b3(35)`/`p3j(10)`/`num1(9)`/`p7b(3)`/`qa7b(3)`/`b4cii(2)`…；`memo` 命中 `p4b3(24)`/`b3d(4)`/`b4cii/b4ciib(6)`…。**全部落在 uid<900000（无一行是夹具 uid）**。

### §1.5 ★ 反事实证明：**248 闭合集 ⇒ 全绿**（单事务真跑 + `ROLLBACK`，`counterfactual.json`）

在**单事务内**补 72 行（⇒ 新库账本 **248**）、逐 uid UPDATE 账户，**末尾 `ROLLBACK`**（回滚后复核新库仍 **176**，落盘态未变）：

| 判据 | 读数 |
|---|---|
| 事务内补入行数 | **72**（新库账本 **176→248**） |
| 21 个账户 UPDATE | **零拒绝** |
| 与生产值相等 | **21/21 true**（含 `uid=6 ⇒ 930`） |
| `account↔ledger` 不变量失配 | **0** |
| 回滚后新库账本行数 | **176**（落盘态未变，自证只读收尾） |

⇒ **「按 uid 闭合」是让 `balance = Σdelta = 最新快照` 成立的唯一形态**；`176` 不行，`248` 行。

> **本单落盘 = Kevin 批准的 176 集**（未擅自改数）。**248 集是否改采 = 需 Kevin/Zang 拍板**（代价：新库 `ledger_entry` 会出现 **72 行**含夹具文本的**真实用户行** ⇒ 按口径① 会被算作「夹具行」，与「零夹具逐表」相抵）。

---

## §2 成对搬与逐表行数

### §2.1 落盘行数（新库，提交后现取）

| 表 | 现库总 | 新库（终态） | 本单新增 |
|---|--:|--:|--:|
| `ledger_entry` | 504 | **176** | +176（全 `cid=1`） |
| `account` | 48 | **23** | +19（净新增；4 平台行原在） |
| `batt_account` | 56 | **18** | +18 |
| `batt_entry` | 60 | **20** | +20 |
| `checkin_log` | 6 | **4** | +4 |
| `checkin_makeup_log` | 5 | **5** | +5 |
| **6 表合计新增** | | | **242** ✓ |

### §2.2 成对关系（铁律复核）

- **`account ↔ ledger_entry`（硬）**：`account` 新增/更新 **21 个 uid**（19 净新增 + 平台 `-2/-1`）**全部有对应 `cid=1` 分录**；无「有账户无分录」的 UPDATE 尝试（`-3/0` 无分录 ⇒ 不 UPDATE，保持 0/0）。★ 但 `balance=Σdelta` 在 **12 个 uid 不成立**（§1.3）。
- **`batt_account ↔ batt_entry`（软，成对必要）**：`batt_account 18` 与 `batt_entry 20` **uid 集完全一致**（`{1..12,17..22}`）；逐行复核 **56→18 全匹配、0 失配**（§6.1）。
- **`checkin_log` / `checkin_makeup_log`**：`checkin_log 4` = `{log_id 121,124,255,259}`；`checkin_makeup_log 5` = `{59,60,99,102,105}`（逐行搬）。

### §2.3 ★ `checkin_makeup_log.txid` 逐行解析（新库）

| log_id | uid | txid | 新库 `ledger_entry` 解析 | 对应分录 |
|--:|--:|--:|:--:|---|
| 59 | 12 | **733** | ✅ 命中 | `uid=12 · kind=checkin_makeup_fee · delta=−100` |
| 60 | 2 | **735** | ✅ 命中 | `uid=2 · kind=checkin_makeup_fee · delta=−100` |
| 99 | 2 | `NULL` | —（无软引用） | — |
| 102 | 12 | `NULL` | —（无软引用） | — |
| 105 | 2 | **2650** | ✅ 命中 | `uid=2 · kind=checkin_makeup_fee · delta=−100` |

⇒ **3 行命中真账本 + 2 行 `txid=NULL`**，与 S52c-pre 预判一致；**无悬空**。

---

## §3 `total_supply` 选择依据与新值

### §3.1 选择依据（逐字登记）

**新库 `currency.cid=1.total_supply` ⇒ `2,010,200`**，依据 = **设计不变量 `total_supply == Σmint − Σburn`**（现库**全量**账本 413 行）：

| 量（现库 `cid=1`，全量 413 行） | 值 |
|---|--:|
| `Σmint`（`kind='mint'`） | **2,210,276** |
| `Σburn`（`kind='burn'`） | **−200,076** |
| **`Σmint − Σburn`（设计不变量，本单取用）** | **2,010,200** ✓ |
| 源计数器 `total_supply`（漂移值，**不搬**） | `2,210,276` |
| 源 `Σdelta`（B25 旧基线，漏冻结） | `1,993,455` |
| 源 `Σbalance + Σfrozen` | `1,993,455 + 16,745`（= 2,010,200 ✓） |

**为何不搬源计数器 2,210,276**：S53 定论 **H2 计数器漂移** —— 历史 6 笔 `burn` 走 `op='entries'` 旁路（不触发 `ledger_post_event §④` 双写），且全早于放行 `op='burn'` 的迁移 `0034` ⇒ 计数器**只加不减**，多计 **200,076 = Σburn**。⇒ 应取**账本派生值 2,010,200**。

### §3.2 ★ 新库内部的二次张力（必须登记）

新库**只搬了真用户子集（176 行）**，故 **新库自身的 `Σmint−Σburn = 200,000 − 200,074 = −74`**，`Σdelta = 104350`、`Σfrozen_delta = −6552`。⇒ **新库 `total_supply (2,010,200)` ≠ 新库自身账本净额**：

| 口径 | 值 | 说明 |
|---|--:|---|
| 新库 `total_supply`（**本单设定**） | **2,010,200** | = 现库**全量**账本的 `Σmint−Σburn`（设计不变量；Kevin 批准） |
| 新库**自身**账本 `Σmint−Σburn` | **−74** | 因只搬真用户子集（夹具 uid≥900000 承载的 ~1.89M 未搬） |
| 新库自身 `Σdelta+Σfrozen_delta` | 97,798 | 真用户子集净流通 |

**⇒ 「新库 `total_supply == 新库 Σmint−Σburn`」结构性不成立**（子集 vs 全量）。本单**按 Kevin 明确指令落 `2,010,200`**（"按账本值"），并把「新库计数器 ↔ 新库账本」的差登记为**需追认项**（§6.2-B）。**若 Kevin 要的是「新库自洽」，则应落 **−74**（或落真用户净流通 97,798）—— 二选一，请拍板。**

### §3.3 现库 `total_supply` 订正后逐 cid 对照（写后现取）

**cids 1/4/16/21/35/36 等 15 币种**：逐 cid `total_supply` vs `Σmint−Σburn` 的设计口径复核见 §6.3（**仅 `cid=1` 破**、已订正；其余 14 币种两口径恒等）。

---

## §4 站名两库前后（`app_config.system_settings.siteName`）

| 库 | 前 | 后 | 其它 8 键 | 命令 |
|---|---|---|---|---|
| **现库** | `p4b2c:siteA`（夹具串） | **`海鲜市场`** | 逐键不变（`unchanged_other_keys=true`） | §5-write2 |
| **新库** | `p4b2c:siteA`（S52b 搬入的夹具串） | **`海鲜市场`** | 逐键不变（`unchanged_other_keys=true`） | `jsonb_set(value,'{siteName}','"海鲜市场"')` |

- **只改该 key**：新库/现库的其余 8 键 `maintenance=false · maxDailyTasks=10 · pointsPerTask=100 · rewardCooldown=24 · defaultLanguage=zh · siteDescription=去中心化社区奖励平台 · allowRegistration=true · emailNotifications=true` **逐字未动**。
- **前后逐键读数**：见 §5（现库）/ `migrate.json → steps.s8_sitename`（新库）。

---

## §5 现库两条窄写（原值留痕 + 回退路径）—— **除这两条外现库零写**

### §5.1 窄写 ① `total_supply`

| 项 | 读数 |
|---|---|
| SQL | `UPDATE currency SET total_supply = 2010200 WHERE cid = 1` |
| 事务 | **单事务**（`BEGIN`…`COMMIT`，`rowcount=1`） |
| **前**（写前现取） | `cid=1 · symbol=$ · total_supply = 2210276` |
| **后**（提交后现取） | `cid=1 · symbol=$ · total_supply = 2010200` |
| **原值留痕** | **`2210276`**（`prod-writes.json → writes[0].original_value_trace`） |
| **回退路径** | `UPDATE currency SET total_supply = 2210276 WHERE cid = 1;` |

### §5.2 窄写 ② 站名

| 项 | 读数 |
|---|---|
| SQL | `UPDATE app_config SET value = jsonb_set(value,'{siteName}','"海鲜市场"'::jsonb) WHERE key='system_settings'` |
| 事务 | **单事务**（`rowcount=1`） |
| **前** | `siteName = "p4b2c:siteA"`（原值全量见 `prod-writes.json → original_value_trace_full`） |
| **后** | `siteName = "海鲜市场"`；其余 8 键逐字不变 |
| **原值留痕** | **`p4b2c:siteA`**（+ 整条 `value` 快照） |
| **回退路径** | `UPDATE app_config SET value = jsonb_set(value,'{siteName}','"p4b2c:siteA"'::jsonb) WHERE key='system_settings';` |

### §5.3 现库零写自证

- 本单**只发**上表两条 `UPDATE`（各 1 语句、各单事务、各 `rowcount=1`）；**其余现库会话全部 `SET TRANSACTION READ ONLY`**。
- 草拟/探查脚本里的写动词仅出现在**字符串常量**（SQL 文本）与**新库**目标；**未对现库发任何其它写**。
- `.env.local` / `.env.newdb.local` **sha256 前后同值**（§0）⇒ **未改任何 env 文件**（更未改其**值**）。

---

## §6 新库终态验收（六项；S55 切库输入）

### §6.1 ① 逐表行数表（现库 / 新库）

| 表 | 现库 | 新库 | | 表 | 现库 | 新库 |
|---|--:|--:|---|---|--:|--:|
| account | 48 | **23** | | ledger_entry | 504 | **176** |
| batt_account | 56 | **18** | | batt_entry | 60 | **20** |
| checkin_log | 6 | **4** | | checkin_makeup_log | 5 | **5** |
| users | 64 | 26 | | currency | 15 | 1 |
| app_config | 1 | 1 | | referral | 2 | 2 |
| commission_policy | 4 | 4 | | ledger_owner | 4 | 4 |
| admin_permission | 12 | 12 | | admin_role | 5 | 1 |
| admin_role_permission | 16 | 12 | | schema_migration | 43 | 43 |
| （其余 18 表）| — | — | | content_translation | 321 | 0 |
| job | 45 | 0 | | job_submission | 40 | 0 |
| market_order | 25 | 0 | | market_trade | 8 | 0 |
| translation_cache | 213 | 0 | | listing | 24 | 0 |

（全 34 表读数见 `verify.json → row_counts`；本单**新增 6 表 242 行**，与批准口径一致。）

### §6.2 ② 不变量逐条复核

**(a) `account ↔ ledger_entry`（新库，逐行）—— ★ 12/23 失配（`Σdelta` 项）**

| uid | balance | Σdelta(新库) | 最新 balance_after | `balance=Σdelta` | `balance=最新` | `frozen=Σfrozen_delta` |
|--:|--:|--:|--:|:--:|:--:|:--:|
| −1 | 168558 | 3356 | 168558 | **✗** | ✓ | ✓ |
| 2 | 7400 | −2600 | 7400 | **✗** | ✓ | ✓ |
| 6 | 990 | 990 | 990 | ✓ | ✓ | ✓（**但 ≠ 生产 930**） |
| 7 | 5100 | −200 | 5100 | **✗** | ✓ | ✓ |
| 8 | 4900 | 200 | 4900 | **✗** | ✓ | ✓ |
| 11 | 29374 | 944 | 29374 | **✗** | ✓ | **✗** |
| 12 | 139417 | 101629 | 139417 | **✗** | ✓ | **✗** |
| 19/21 | 100 | −37 | 100 | **✗** | ✓ | ✓ |
| 34/36/40 | 100 | −1300 | 100 | **✗** | ✓ | ✓ |
| 38 | 50 | −1350 | 50 | **✗** | ✓ | ✓ |
| （其余 10 行：−3,0,3,4,5,35,37,39,41 及…） | — | — | — | ✓ | ✓ | ✓ |

- **失配数 = 12**（`match_sum=false`；其中 11/12 亦 `match_frozen=false`）。
- **`balance = 最新 balance_after` = 23/23 ✓**（这是 `account_guard` 强制的那条）。
- **根因 = 176 集非按 uid 闭合**（§1.3/§1.5）。
- **对照（现库同口径）**：`现库 account↔ledger 失配 = 0`（48 行全绿）。

**(b) `batt_account ↔ batt_entry`（新库，逐行）—— ✅ 0 失配**

- 18 个 `batt_account` 全部满足 `batt = Σdelta = 最新 batt_after`（`inv_batt_newdb_mismatch = []`）。

**(c) `total_supply == Σmint − Σburn`**

- **现库（全 15 币种）**：**仅 `cid=1` 破**（订正前 `2210276` vs `2010200`，差 `200076=Σburn`）；**其余 14 币种设计口径全 0**。**订正后现库 `cid=1 = 2010200 = Σmint−Σburn` ✓**。
- **新库（1 币种）**：`total_supply=2010200` **vs** 新库自身账本 `Σmint−Σburn = −74` ⇒ **按新库自身口径失配**（结构性：子集 vs 全量；见 §3.2）。**★ 全 15 币种口径落在现库，新库仅 1 币种 ⇒ 该判据对「新库」的适用性请 Kevin 明确。**

### §6.3 ③ 零夹具逐表（新库）

| 表 | 行数 | 夹具(口径①) | 夹具(口径②) |
|---|--:|--:|--:|
| account | 23 | **0** | **0** |
| ledger_entry | 176 | **0** | **0** |
| batt_account / batt_entry | 18 / 20 | **0** | **0** |
| checkin_log / checkin_makeup_log | 4 / 5 | **0** | **0** |
| users / currency / app_config | 26 / 1 / 1 | **0** | **0** |
| referral / commission_policy / ledger_owner | 2 / 4 / 4 | **0** | **0** |
| admin_permission / admin_role / admin_role_permission | 12 / 1 / 12 | **0** | **0** |
| schema_migration | 43 | **0** | **0** |
| **合计** | | **0** | **0** |

⇒ **新库 16 张非空表全部零夹具（口径①② 均 0）** ✓。

### §6.4 ④ 外键悬空（新库）

- 现取 `public→public` FK **54 条**，逐条 `NOT EXISTS` 计数 ⇒ **悬空 = 0**（`fk_dangling_newdb = []`）✓。
- 覆盖：`account.cid · batt_account.uid · checkin_log.uid · checkin_makeup_log.uid/cid · referral.* · admin_role_permission.*` 等（`ledger_entry` **无 `uid` FK**、`batt_entry` **无任何 FK**，与 S52c-pre 一致）。

### §6.5 ⑤ 序列 `setval` 对齐（新库）

| 表.列 | 序列 | 表 max | `setval` 后 `last_value` | 对齐(=max+1) |
|---|---|--:|--:|:--:|
| `ledger_entry.txid` | `ledger_entry_txid_seq` | 2651 | **2652** | ✅ |
| `batt_entry.txid` | `batt_entry_txid_seq` | 660 | **661** | ✅ |
| `checkin_log.log_id` | `checkin_log_log_id_seq` | 259 | **260** | ✅ |
| `checkin_makeup_log.log_id` | `checkin_makeup_log_log_id_seq` | 105 | **106** | ✅ |
| `users.uid` | `users_uid_seq` | 41 | 42 | ✅（S52b） |
| `currency.cid` | `currency_cid_seq` | 1 | 3 | ✅（≥max+1） |
| `commission_policy.policy_id` | `commission_policy_policy_id_seq` | 5 | 6 | ✅（S52b） |
| `schema_migration.id` | `schema_migration_id_seq` | 43 | 43 | ⚠️ runner 自维护（未动） |

⇒ **本单新搬入的 4 张表序列全部 `= max+1`** ✓（`schema_migration` 属 runner 自维护，非本单搬入）。

### §6.6 ⑥ 结构指纹（新库 vs 现库，抽验）

| 面 | 现库 | 新库 | 相等 |
|---|--:|--:|:--:|
| `information_schema.columns` 行数 | 300 | 300 | ✅ `cols_equal=true` |
| 约束逐表 `(contype,count)` | — | — | ✅ `constraints_equal=true` |
| 触发器逐表计数（非 internal） | — | — | ✅ `triggers_equal=true` |
| `schema_migration` 逐行 `(version,name,checksum)` | 43 | 43 | ✅ `schema_migration_eq=true` |

---

## §7 未做 与 `NOT_MEASURED`

**未做（有意，附理由）**：

1. **未按 248 闭合集落盘** —— 本单严格落**Kevin 批准的 176 集**；248 集仅在**单事务内真跑并 `ROLLBACK`**（反事实证明），**未改数、未落盘**（§1.5）。
2. **未改 `.env.local` 的任何值**（只读其值，未改文件；sha256 前后同值）；**未改 `migrations/**` / `src/**` / 前端 / `docs/*.spec.md` / `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`**。
3. **未 commit / 未 push**；**未 `npm install`**；**未起实例、未打 HTTP、未碰 `5787/5788/5555/5191`**；**未 `pkill`/`killall`**。
4. **未对 `0043` 守卫做任何放宽**（未 `DISABLE TRIGGER`、未 `session_replication_role`），未绕过 `account_guard`，未直写 `balance/frozen`。
5. **未追 S53 的根因修复（`admin_points_adjust_post_event` 负向分支改 `op='burn'`）与守卫加装** —— 属 Kevin 另单。

**`NOT_MEASURED`**：

| 项 | 原因 |
|---|---|
| **新库运行时对「12 个 uid 的 `balance≠Σdelta`」的行为**（对账/上屏/脚本是否报警） | 需**起实例 + 打 HTTP** ⇒ 与本单「不起实例」冲突 ⇒ **未测**。 |
| **248 闭合集落盘后的「零夹具」判定** | 72 行按**口径①** 会被算作夹具（命中 `idem/memo` 的文本模式），但**行主是真实 uid**；「按 uid 判」vs「按文本判」是**口径分歧** ⇒ 未裁定，交 Kevin。 |
| **新库「自洽」`total_supply` 应为多少** | 本单按 Kevin 明确值落 `2,010,200`；若要求「新库计数器 == 新库账本」，应落 `−74`（或真用户净流通 `97,798`）—— **未裁定**，交 Kevin（§3.2）。 |
| **B25 所述 `account↔ledger 48/48` 与新库口径的等价性** | 现库实测**同值 0 失配**（同口径 48 行全绿）；但那是**全量账本**下的读数，**不构成** 176 子集的等价证据（本单已实测 176 子集 12 失配）。 |
| **`uid=-1`（平台手续费归集）在新库落 168558 是否符合 S55 切库语义** | 平台做市/费用账户是否应在「去夹具」新库保留 168558 —— **语义未裁定**，交 Kevin。 |

---

## §8 自曝

1. **★ 我推翻/细化了一条 S52c-pre 的前提（不是找茬，是读数不同）**：S52c-pre 把 `ledger_entry 176` 记为「真行（可搬）」。**现取：176 是 T1 文本过滤后的子集，剔掉了真实用户/平台与夹具之间的真实分录（72 行/13 uid），故它不满足 `balance=Σdelta` 闭合。** 该前提的隐含假设（「T1 过滤只去夹具行」）被证伪；正确集是 **248**（`cid=1 ∧ uid<900000`）。**已在 §1.3/§1.5/§6.2 逐条给出读数与反事实**。
2. **★ 我据 brief 的「若 UPDATE 被拒 ⇒ 停下报回」停止了「按生产真值落账户」这条路**：`uid=6` 的 UPDATE-to-930 被 `trg_account_guard` 拒（`P0001`，§1.1-3b）。故**账户落的是「新库 176 集最新快照」**（并非生产真值）—— 这在 20/21 个 uid 上与生产一致，**唯一例外 uid=6（990 vs 930）**。
3. **★ 本单落盘的新库是「Kevin 批准的 176 集」，带着 12 个 `Σdelta` 失配** —— 我**没有**擅自改数（改数会偏离批准口径）。**若 Kevin 采 248，可在同一新库上补 `INSERT` 72 行 + 逐 uid `UPDATE`（无需绕守卫、无需 DDL；账本 `INSERT` 不受 append-only 限制）**，反事实已证零拒绝、零失配（§1.5）。
4. **★ 我先把新库写落盘、后做验收**（口径 3b 的守卫拒绝是在 Step 3 之后另用 `SAVEPOINT` 探的，未污染已提交态）。**新库账本为 append-only（`no_truncate` + `_append_only`）** ⇒ 已落的 176 行**不可就地删改**；若改采 248 需**追加** 72 行（可行）或另行重建新库。
5. **★ 我的一次探针笔误（已修，如实登记）**：`s54-closure.py` 首版把局部字典命名为 `dump`，遮蔽了库函数 `dump()` ⇒ 尾行 `'dict' object is not callable`；改名 `dumpT` 后复跑（`closure.json` 为修正后读数）。**探针侧笔误，非库缺陷**。
6. **★ 我的一次 SQL 笔误（已修，如实登记）**：`s54-migrate.py` 首版查 `pg_sequences` 写了 `is_called` 列（该视图**无此列**）⇒ 首跑在 Step 6 报 `42703`；**因整迁移在单事务内、异常即 `ROLLBACK`，新库零残留**（复跑前复核 6 表仍为 0/4）。删列后复跑成功。
7. **口径与 S52c-pre 的差异**：本单闭包口径与 S52c-pre **逐表一致**（`closure_counts`：`account 23 · ledger_entry 176 · batt_account 18 · batt_entry 20 · checkin_log 4 · checkin_makeup_log 5` 逐值相同）⇒ 差异**不在过滤口径**，而在**「子集是否闭合」这一 S52c-pre 未标注的隐含假设**。
8. **端口/进程**：未起实例、未占端口、未 `pkill -f`/`killall`。
9. **运行环境**：`node v18.19.0`（本单未用）；DB 客户端 = **Python 3.9 + `psycopg2` + `dotenv`**（仓内/系统既有，**未 `npm install`**）。

---

## §9 产物清单（`backend-ts/.s54-artifacts/s54-20261007T111114Z/`）

| 文件 | 内容 |
|---|---|
| `s54lib.py` | 公共库（进程内 dotenv、connect、fetch 辅助） |
| `s54-recon.py` / `recon.json` | 两库侦察（版本/行数/currency/account/序列/FK/列/触发器） |
| `s54-closure.py` / `closure.json` | 复刻 S52c 口径：真行 + FK 闭包 + closure 聚合 |
| `s54-uid-snapshot.py` / `uid-snapshot.json` | 逐 uid 快照对比（全量 vs 闭包） |
| `s54-peruid.py` / `peruid.json` | 逐 uid「176 子集 vs 248 闭合集」 |
| `s54-migrate.py` / `migrate.json` | **三步走主流程 + 各步读数**（含 3b 守卫拒绝） |
| `s54-counterfactual.py` / `counterfactual.json` | **248 集反事实证明（事务内真跑 + ROLLBACK）** |
| `s54-verify.py` / `verify.json` | **新库终态六项验收全部读数** |
| `s54-prod-writes.py` / `prod-writes.json` | **现库两条窄写（原值留痕 + 回退 SQL）** |

**复现命令**（均在 `backend-ts/.s54-artifacts/s54-20261007T111114Z/`）：

```
python3 s54-recon.py        # 两库侦察
python3 s54-closure.py      # 闭包集
python3 s54-peruid.py       # 逐 uid 176 vs 248
python3 s54-verify.py       # 新库六项验收（只读）
# 写类（新库）：s54-migrate.py（已跑，落盘态=176 集）
# 反事实（事务内 ROLLBACK）：s54-counterfactual.py
# 现库两条窄写（已跑）：s54-prod-writes.py
```
