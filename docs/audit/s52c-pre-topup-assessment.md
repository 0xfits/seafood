# S52c-pre · `B22` 分库决策材料 —— 逐表真行/夹具行**双口径**盘点 + 逐表「搬/不搬」判据 + 外键拓扑与估时 + 一致性风险成套对 + 上屏键逐键读数

- **单号**：S52c-pre（角色：**Kong**）· **模式：严格只读（两库均零写）**
- **日期**：2026-10-07（CST）
- **runid**：`s52c-20261007T070107Z`
- **产物目录**：`backend-ts/.s52c-artifacts/s52c-20261007T070107Z/`（`**/.*-artifacts/` 已忽略，`.gitignore:342`）
- **现库（源，**全程只读**）**：`.env.local` ⇒ host 前缀 `ep-holy-forest-b3fi7u3u` · `neondb` · PostgreSQL 18.6
- **新库（**本单亦只读**）**：`.env.newdb.local` ⇒ host 前缀 `ep-red-moon-b3xvoyjk` · `neondb` · PostgreSQL 18.6
- **结论先行（一句话）**：现库 34 张基表共 **1584 行**，口径① 夹具 **1088** / 真 **496**；口径②（补 jsonb 文本化）夹具 **1089** / 真 **495**（**全库仅 `app_config` 1 行被 jsonb 口径翻出**）。**「有真行的表」只有 20 张**。其中 **6 张共 242 行**（`account 19`·`ledger_entry 176`·`batt_account 18`·`batt_entry 20`·`checkin_log 4`·`checkin_makeup_log 5`，净新增）属**真用户可观测状态 ⇒ 建议搬**；**114 行**（`content_translation 63`·`translation_cache 51`）是**夹具的下游派生 ⇒ 不搬**；**30 行**（`job_submission 9`·`market_trade 7`·`account 6`·`ledger_entry 8`）是**真行挂夹具父 ⇒ FK 悬空，不可单独搬**。★ **两条硬约束**：① `trg_account_guard` 的 **INSERT 分支强制 `balance=0 ∧ frozen=0`** ⇒ **带真实余额的账户行在结构上插不进新库**（除非绕守卫/改守卫）；② **源库自身的 `currency.total_supply` 与账本总和不一致**（`cid=1`：`2210276` vs `Σdelta=1993455`，差 **216821**）⇒ 它**不是**账本派生量，新库留 `0` 是**第三种值**而非「自洽值」。

> 本单**未执行任何写**：两库连接均以 **`BEGIN READ ONLY`** 包裹（读数自证见 §7.1：`transaction_read_only = 'on'`）；无 `INSERT/UPDATE/DELETE/TRUNCATE/setval/nextval/DDL`；未起实例、未打 HTTP、未碰 `5787/5788/5555/5191`；未 `pkill`；未 `npm install`；未 commit/push。连库一律**进程内 `dotenv.parse` 读文件**（绝对路径），**未 shell source/export**，**未打印任何凭据值**（只打印 host 前缀/db 名/版本/表名/行数/值片段）。

---

## §0 对锚（开工前 / 收尾）

| 项 | 开工（现取） | 收尾（现取） | 命令 |
|---|---|---|---|
| 仓库 | `/Users/kevin/bistro/seafood` | 同 | `pwd` |
| HEAD | **`0cc198c`**（S52a） | **`285d336`**（S52b 已入库）★ 见 §7.3 | `git log --oneline -1` |
| tracked 改动 | **0**（`git status --porcelain` 仅 `?? docs/audit/s52b-newdb-data-seed.md`） | **0**（porcelain 空） | `git status --porcelain` |
| 未提交改动（diff 面） | 0 | **0**（`git diff --stat`、`git diff --cached --stat` 均 0 行） | `git diff --stat` |
| `backend-ts/.env.local` sha256 | `0960bd1d…a453` | **同值**（未变） | `shasum -a 256` |
| `backend-ts/.env.newdb.local` sha256 | `b575627f…479b` | **同值**（未变） | `shasum -a 256` |
| 现库 host / db / 版本 | `ep-holy-forest-b3fi7u3u…` / `neondb` / PG 18.6 | 同 | `dsnHost()` + `SELECT current_database()` |
| 新库 host / db / 版本 | `ep-red-moon-b3xvoyjk…` / `neondb` / PG 18.6 | 同 | 同上 |
| `host_different` | **true** | **true** | 两 DSN host 对比 |
| 只读自证 | 两库 `BEGIN READ ONLY`；`current_setting('transaction_read_only')` = **`on`**（两库） | 同 | `openReadOnly()` |
| 基线 34 表 / 54 条 `public→public` FK / 1 视图 | 34 / 54 / `candle_view` | 同 | `information_schema` + `pg_constraint` |

**开工现状（承 S52b，本单现取复核）**：新库 `ledger_entry = 0` · `batt_account = 0` · `batt_entry = 0` · `checkin_log = 0` · `checkin_makeup_log = 0` · `content_translation = 0` · `translation_cache = 0` · `job_submission = 0` · `market_trade = 0`；新库 `account = 4`（**uid 0/-1/-2/-3 × cid=1，全 `balance=0`**）· `currency = 1`（`cid=1`，`total_supply=0`）· `users = 26`（uid `1-12,17-22,34-41`）。⇒ **26 个真用户在新库「零资产 + 多数无账户行」**（19/26 在源库有账户行；新库 0/26；详见 §4.1）。

★ 纪律：本单**零写**；两库只发 `SELECT`；未 `setval`/`nextval`；未 `pkill`/`killall`；未 commit/push；未 `npm install`；**未改任何既有文件**（仅新增报告 + 产物）。

---

## §1 逐表真行/夹具行 双口径盘点（34 张 `public` 基表全扫）

### §1.1 口径定义（可枚举、可复现；本单**两口径并列**）

- **口径①（标准 = 派单口径）**：`T1 文本指纹` **∪** `T2 号段` **∪** `create_key LIKE 'cli:%'`
  - **T1 文本指纹**（承 S48 §1.1 精化口径）：文本列（`text/varchar/char`）任一 `ILIKE '%<p>%'`，`p ∈ {p4b2 p3j p4z p3l p3f p7a p7b qa7b fixture b6audit s1x- p8s p4a tr1b tr1c b3c b3d b4a b4cii b4ciib qab4 qa-neng aud-jk num1 n1a n1b p4b3 qap7 p2x p2qa probe}`；**排除 4 个纯哈希/地址列**（`evm · request_fingerprint · src_hash · event_root_key`）。
  - **T2 号段**：身份类数字列（主键 ∪ `/^(uid|.*_uid|cid|reviewed_by)$/`）任一 `≥ 900000`。
  - **`cli:` 单列**：`create_key` 列 `LIKE 'cli:%'`（注：S48 口径为「`cli:` 本身非夹具标记」，本单**按派单把它并入口径①**，同时**逐表单列 `cli:` 读数**便于 Kevin 自行剔除重算）。
- **口径②（严 = 补充口径）**：`口径①` **∪**（**`jsonb` 列文本化后扫 T1**）—— 专补 S52b 登记的 `app_config.value` 漏网。
- **另列（不计入任何口径，仅留痕）**：被排除 4 个哈希/地址列文本化后扫 T1 的命中数（S48 已登记为**误报方向**，如 `users.uid=34` 的 `evm` 含子串 `b4a`）。
- **真行** = 该表总行数 − 夹具行数（并集口径）。

### §1.2 逐表读数（现库为源；两口径各一列）

| 表 | 总行(现库) | 新库行 | T1 | T2 | cli: | **口径① 夹具** | **口径① 真** | 口径② 增量(jsonb) | **口径② 夹具** | **口径② 真** | hash 列T1(S48已知误报,不计) | 扫的文本列 | jsonb列 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|---|
| `account` | 48 | 4 | 0 | 19 | 0 | **19** | **29** | 0 | **19** | **29** | 0 | — | — |
| `admin_ops_audit_log` | 5 | 0 | 4 | 5 | 0 | **5** | **0** | 0 | **5** | **0** | 0 | action·op·idempotency_key·result·memo | — |
| `admin_permission` | 12 | 12 | 0 | 0 | 0 | **0** | **12** | 0 | **0** | **12** | 0 | permission_key·name | — |
| `admin_refund_audit_log` | 7 | 0 | 2 | 7 | 0 | **7** | **0** | 0 | **7** | **0** | 1 | result·idempotency_key·memo | — |
| `admin_role` | 5 | 1 | 4 | 0 | 0 | **4** | **1** | 0 | **4** | **1** | 0 | role_key·name | — |
| `admin_role_permission` | 16 | 12 | 4 | 0 | 0 | **4** | **12** | 0 | **4** | **12** | 0 | role_key·permission_key | — |
| `admin_user_role` | 7 | 0 | 6 | 7 | 0 | **7** | **0** | 0 | **7** | **0** | 0 | role_key | — |
| `app_config` | 1 | 1 | 0 | 0 | 0 | **0** | **1** | **1** | **1** | **0** | 0 | key | **value** |
| `batt_account` | 56 | 0 | 0 | 38 | 0 | **38** | **18** | 0 | **38** | **18** | 0 | — | — |
| `batt_entry` | 60 | 0 | 0 | 40 | 0 | **40** | **20** | 0 | **40** | **20** | 0 | reason·idempotency_key·ref_type·memo | — |
| `checkin_log` | 6 | 0 | 0 | 2 | 0 | **2** | **4** | 0 | **2** | **4** | 0 | — | — |
| `checkin_makeup_log` | 5 | 0 | 0 | 0 | 0 | **0** | **5** | 0 | **0** | **5** | 0 | result·idempotency_key·memo | — |
| `commission_policy` | 4 | 4 | 0 | 0 | 0 | **0** | **4** | 0 | **0** | **4** | 0 | — | — |
| `content_translation` | 321 | 0 | 258 | 0 | 0 | **258** | **63** | 0 | **258** | **63** | 0 | entity_type·entity_id·field·lang·text·status·last_error | — |
| `currency` | 15 | 1 | 13 | 14 | 0 | **14** | **1** | 0 | **14** | **1** | 0 | symbol·name·icon_url·status | — |
| `currency_review_log` | 0 | 0 | 0 | 0 | 0 | **0** | **0** | 0 | **0** | **0** | 0 | result·idempotency_key·memo | — |
| `currency_status_log` | 7 | 0 | 0 | 7 | 0 | **7** | **0** | 0 | **7** | **0** | 0 | from_status·to_status·memo | — |
| `job` | 45 | 0 | 42 | 15 | **44** | **45** | **0** | 0 | **45** | **0** | 0 | title·description·status·create_key | — |
| `job_application` | 19 | 0 | 19 | 5 | **19** | **19** | **0** | 0 | **19** | **0** | 0 | status·create_key | — |
| `job_arbitration_log` | 0 | 0 | 0 | 0 | 0 | **0** | **0** | 0 | **0** | **0** | 0 | result·idempotency_key·memo | — |
| `job_submission` | 40 | 0 | 28 | 19 | **31** | **31** | **9** | 0 | **31** | **9** | 0 | deliverable·review_status·review_memo·create_key | — |
| `ledger_entry` | 504 | 0 | 215 | 248 | 0 | **320** | **184** | 0 | **320** | **184** | **205** | kind·ref_type·idempotency_key·memo | — |
| `ledger_owner` | 4 | 4 | 0 | 0 | 0 | **0** | **4** | 0 | **0** | **4** | 0 | owner_type·name | — |
| `listing` | 24 | 0 | 24 | 17 | **23** | **24** | **0** | 0 | **24** | **0** | 0 | title·description·status·create_key | — |
| `listing_order` | 18 | 0 | 18 | 15 | **18** | **18** | **0** | 0 | **18** | **0** | 0 | status·create_key | — |
| `listing_order_event` | 0 | 0 | 0 | 0 | 0 | **0** | **0** | 0 | **0** | **0** | 0 | event_type·from_status·to_status·idempotency_key·ref_type·memo | — |
| `listing_review_log` | 0 | 0 | 0 | 0 | 0 | **0** | **0** | 0 | **0** | **0** | 0 | result·idempotency_key·memo | — |
| `market_order` | 25 | 0 | 23 | 14 | **25** | **25** | **0** | 0 | **25** | **0** | 0 | side·status·create_key | — |
| `market_trade` | 8 | 0 | 0 | 1 | 0 | **1** | **7** | 0 | **1** | **7** | 0 | — | — |
| `rating` | 0 | 0 | 0 | 0 | 0 | **0** | **0** | 0 | **0** | **0** | 0 | target_type·direction·idempotency_key·memo | — |
| `referral` | 2 | 2 | 0 | 0 | 0 | **0** | **2** | 0 | **0** | **2** | 0 | — | — |
| `schema_migration` | 43 | 43 | 0 | 0 | 0 | **0** | **43** | 0 | **0** | **43** | 0 | version·name·checksum | — |
| `translation_cache` | 213 | 0 | 162 | 0 | 0 | **162** | **51** | 0 | **162** | **51** | **6** | src_lang·tgt_lang·text_out·engine | — |
| `users` | 64 | 26 | 27 | 38 | 0 | **38** | **26** | 0 | **38** | **26** | **1** | bio | — |
| **合计** | **1584** | — | — | — | **160** | **1088** | **496** | **1** | **1089** | **495** | **213** | — | — |

**产物流：** `inventory.json`（逐表逐行判定 + 每表前 25 条命中样本 + 逐列名）· `tbl-s1.md`（本表机读版）。

### §1.3 与 S48 的差异（**逐条对账，不掩盖**）

| 差异项 | S48 读数（粗/精化） | 本单读数 | 归因（现取证据） |
|---|---|---|---|
| 现库总行数 | 1583 | **1584** | **逐表机读对拍（对 S48 §1.2 表格所载各表行数）**：`Σ 差 = +1`，**唯一差异表 = `schema_migration 42→43`**（`+1`）⇒ 与「`0044` 已应用」一致；其余 33 表**逐表零差** |
| `Σ 夹具（精化）` | 1085 | **1088（口径①）** | **+3 全部来自 `job_submission` 的 `cli:` 分量**（本单按派单把 `cli:` 并入口径①：`job_submission` `T1∪T2=28` → `∪cli:=31`） |
| `users` 真行 | 25（§3.3 表内）／26（§5.3 自纠） | **26** | 以号段判据 `uid<900000` 为准 = 26（与 S48 §5.3 自纠一致） |
| 表数 | 34 | **34** | 全等（另 1 视图 `candle_view` 不计入基表） |

**口径② 只增 1 行** ⇒ **全库 34 张基表中只有 `app_config` 有 `jsonb` 列**（1 列 `value`），这正是 S52b 登记的漏网点。

---

## §2 「有真行的表」逐表：搬 / 可选 / 不搬（判据 + 行数）

**判据（三段式，先判性质再判可行性）**：
1. **是不是「真用户的可观测状态」？**（余额/流水/电量/签到/提交/译文/配置/权限）
2. **它的外键父是否也搬（或已在新库）？** —— 真行若挂**夹具父**，单独搬 ⇒ **FK 悬空** ⇒ 只能「连夹具同搬（违反零夹具）」或「不搬」。
3. **是否结构上可插入？**（守卫/append-only/identity 策略）

**「有真行」= 20 张（口径① 真 > 0）**；口径② 下 `app_config` 翻为 0 真（其 `value.siteName` 是夹具串），其余 19 张两口径一致。

### §2.1 逐表判据表

| # | 表 | 真行(口径①/②) | 已在新库? | 性质 | **判定** | 判据与理由（现取证据） |
|--:|---|--:|:--:|---|---|---|
| 1 | `account` | 29 / 29 | 部分（4 平台行） | **真用户余额账户** | **必要（+19 净新增）** | 余额 = 真用户可观测状态；实测 48/48 行满足 `balance = Σledger.delta = 最新 ledger.balance_after`、`frozen = Σfrozen_delta`。★ 受 `trg_account_guard` INSERT **必须 0/0** 约束 ⇒ 须「先账本、后 0/0 插入、再 UPDATE 到快照」。**其中 6 行挂夹具币 ⇒ 不可搬（见 §4.7）** |
| 2 | `ledger_entry` | 184 / 184 | 否 | **真用户资金流水** | **必要（+176）** | 真用户的一切余额/手续费/签到费/佣金腿；append-only（`no_truncate` + `_append_only`）。**其中 8 行挂夹具币 ⇒ 不可搬** |
| 3 | `batt_account` | 18 / 18 | 否 | **真用户电量账户** | **必要（+18）** | 实测 56/56 行 `batt = Σbatt_entry.delta = 最新 batt_after`；父 `users` 已在新库（18/18 命中真号段） |
| 4 | `batt_entry` | 20 / 20 | 否 | **真用户电量流水** | **必要（+20）** | 与 #3 同一 18 个 uid；`txid` 为 `GENERATED ALWAYS AS IDENTITY` ⇒ 复制需 `OVERRIDING SYSTEM VALUE` |
| 5 | `checkin_log` | 4 / 4 | 否 | **真用户签到记录** | **必要（+4）** | 4 行 = uid 2（3 次）/12（1 次）；父 `users` 已在新库；append-only |
| 6 | `checkin_makeup_log` | 5 / 5 | 否 | **真用户补签记录** | **必要（+5）** | 5 行 = uid 2/12；`txid` 软引用 `ledger_entry`（3/5 命中真账本行 `733/735/2650`，2/5 为 `NULL`）⇒ 必须**后于** #2 |
| 7 | `content_translation` | 63 / 63 | 否 | **夹具的下游译文** | **不搬（0）** | 63 行全部是**夹具实体**的译文（`entity_type`：job 39·currency 15·listing 6·user 3；**`job_is_real = []`（0/10 指向真实体）**；`listing_id=19` 亦夹具）⇒ 非真用户状态，是夹具派生 |
| 8 | `translation_cache` | 51 / 51 | 否 | **纯派生缓存** | **不搬（0）** | `src_hash` 键的 `opencc/deepseek` 译文缓存，**可由源重算**；无 FK；属「可再生派生」，留空无害 |
| 9 | `job_submission` | 9 / 9 | 否 | 真提交，**但挂夹具 job** | **不搬（0）** | **9/9 行的 `job_id` 指向夹具 job（22/23/24）**；搬则 FK 悬空；连夹具 job 同搬违反「零夹具」⇒ 成对不搬（§4.6） |
| 10 | `market_trade` | 7 / 7 | 否 | 真成交，**但挂夹具挂单/币** | **不搬（0）** | **7/7 行 `buy_order_id/sell_order_id` 指向夹具 `market_order`（1/7/10/12/17/20）；`base_cid` 指向夹具币（4/16/21）**⇒ 同 9 |
| 11 | `users` | 26 / 26 | **是（26）** | 真身份 | **已搬（必要，S52b 完成）** | 真号段 `uid<900000` |
| 12 | `admin_permission` | 12 / 12 | **是（12）** | 权限种子 | **已搬（迁移自带，逐值同）** | 无夹具行 |
| 13 | `admin_role` | 1 / 1 | **是（1）** | 角色种子 | **已搬（迁移自带）** | `super_admin`；4 行夹具未搬 |
| 14 | `admin_role_permission` | 12 / 12 | **是（12）** | 角色-权限种子 | **已搬（迁移自带）** | 12 非夹具行逐值同 |
| 15 | `commission_policy` | 4 / 4 | **是（4）** | 返佣策略种子 | **已搬（S52b：2 历史 + `0007`/`0036`）** | 见 S52b §1 |
| 16 | `ledger_owner` | 4 / 4 | **是（4）** | 账本主体 | **已搬（迁移自带）** | `-3 罚没账户·-2 佣金池·-1 手续费归集账户·0 平台主体`（均正常中文） |
| 17 | `currency` | 1 / 1 | **是（1）** | 平台积分 | **已搬（迁移自带）** | `cid=1`（`$`／`平台积分`）；14 行夹具未搬 |
| 18 | `referral` | 2 / 2 | **是（2）** | 推荐关系 | **已搬（S52b）** | `5→4`、`6→5` |
| 19 | `app_config` | 1 / **0** | **是（1）** | 站点配置 | **已搬（S52b）** | ★ 但其 `value.siteName = "p4b2c:siteA"` 是**夹具串**（口径② 命中）⇒ 见 §5 |
| 20 | `schema_migration` | 43 / 43 | **是（43）** | 系统表 | **不搬（runner 自维护）** | 两库内容逐字同（S52b §6.2） |

### §2.2 「搬」的量（净新增行）

| 分类 | 表 : 行数 | Σ 行数 |
|---|---|--:|
| **必要（可搬，FK 闭包内）** | `ledger_entry 176` · `account 19` · `batt_account 18` · `batt_entry 20` · `checkin_log 4` · `checkin_makeup_log 5` | **242** |
| **不搬（派生/下游夹具）** | `content_translation 63` · `translation_cache 51` | **114** |
| **不搬（真行挂夹具父 ⇒ FK 悬空）** | `job_submission 9` · `market_trade 7` · `account 6` · `ledger_entry 8` | **30** |
| **已在新库（真行）** | `users 26` · `admin_permission 12` · `admin_role_permission 12` · `commission_policy 4` · `ledger_owner 4` · `referral 2` · `admin_role 1` · `currency 1` · `schema_migration 43` · `account 4`（平台） | **110** |
| **合计 = 口径① 真行** | | **496** ✓ |

---

## §3 依赖拓扑与估时

### §3.1 外键拓扑（现取 `pg_constraint`，54 条 `public→public` FK）

- **全库拓扑序**（DFS 先父后子，**无环** = 现取 `cycle = null`）：
  `currency → account → users → admin_ops_audit_log → admin_permission → admin_refund_audit_log → admin_role → admin_role_permission → admin_user_role → app_config → batt_account → batt_entry → checkin_log → checkin_makeup_log → commission_policy → content_translation → currency_review_log → currency_status_log → job → job_application → job_arbitration_log → job_submission → ledger_entry → ledger_owner → listing → listing_order → listing_order_event → listing_review_log → market_order → market_trade → rating → referral → schema_migration → translation_cache`
- **`batt_entry` / `ledger_entry` 的 FK 面**（现取，重要）：`batt_entry` **无任何 FK**（连 `batt_account` 都没有 FK）；`ledger_entry` 只有 **1 条 FK**（`cid → currency.cid`）——`uid → users` **靠语义/触发器约束，不在 `pg_constraint` 里**。

### §3.2 复制集「先父后子」顺序 + 前置是否已在新库（逐表）

| 序 | 表 | 行数 | 依赖的父（FK） | 父是否已在新库 | **缺的前置** | 备注 |
|--:|---|--:|---|---|---|---|
| 0 | （已搬）`users`(26) `currency`(1) `ledger_owner`(4) `admin_role`(1) `admin_permission`(12) `admin_role_permission`(12) `commission_policy`(4) `referral`(2) `app_config`(1) `schema_migration`(43) | 110 | — | ✅ | **无** | S52b 已完 |
| 1 | `ledger_entry` | 176 | `currency.cid` | ✅（`cid=1`） | **无** | 必须**第一**搬：`account` 的守卫/快照依赖它；`identity ALWAYS` ⇒ `OVERRIDING SYSTEM VALUE` |
| 2 | `account` | 19 | `currency.cid`（+ 语义依赖 `ledger_entry` 快照） | ✅（`cid=1`） | **无**（但需 §3.3 的守卫绕行） | ★ 不能在 #1 之前 |
| 3 | `batt_account` | 18 | `users.uid` | ✅（26 行） | **无** | 无插入守卫 |
| 4 | `batt_entry` | 20 | （无 FK；语义父 = `batt_account`） | ✅ | **无** | `identity ALWAYS` ⇒ `OVERRIDING SYSTEM VALUE`；append-only |
| 5 | `checkin_log` | 4 | `users.uid` | ✅ | **无** | append-only |
| 6 | `checkin_makeup_log` | 5 | `users.uid` · `currency.cid`（+ 软引用 `ledger_entry.txid`） | ✅ | **无** | 必须**后于** #1（3/5 行的 `txid` 指真账本行） |
| — | `job_submission` | 9 | `job.job_id` · `users.uid` | ❌ **`job` 新库 0 行** | **`job`（45 行，全夹具）** | ⇒ 阻塞，**不搬** |
| — | `market_trade` | 7 | `market_order.order_id` · `currency.cid` · `users.uid` | ❌ **`market_order` 0 行、夹具币不在库** | **`market_order`（25 行，全夹具）+ 夹具币** | ⇒ 阻塞，**不搬** |

### §3.3 ★ 结构性阻断（搬 `account` 的**前置条件**，非估时可解）

`trg_account_guard`（**BEFORE INSERT**，函数体本单现取）第一条分支：

```
IF TG_OP = 'INSERT' THEN
  IF NEW.balance <> 0 OR NEW.frozen <> 0 THEN
    RAISE EXCEPTION 'new account must start at 0/0 (uid=%, cid=%)', NEW.uid, NEW.cid;
```

⇒ **带真实余额的 `account` 行无法直接 INSERT**（如 `uid=12,cid=1,balance=139417`）。可搬的**唯一既有语义内路径**（不改守卫、不 DDL）：
1. 先搬 `ledger_entry`（含 `balance_after/frozen_after`）；
2. `INSERT INTO account (uid,cid,balance,frozen) VALUES (…,0,0)` —— 过 INSERT 分支；
3. `UPDATE account SET balance=<最新 ledger.balance_after>, frozen=<最新 frozen_after>` —— UPDATE 分支要求**等于最新分录快照**（实测源库 48/48 行满足 ⇒ 该路径成立）。
> 若选择 `ALTER TABLE … DISABLE TRIGGER` / `session_replication_role = replica` 强行带值插入，即**改库结构/绕守卫**，本单**不建议**（且会与 `0043` 的守卫设计相悖）。**未实测该路径**（需写库）⇒ 见 §6 `NOT_MEASURED`。

### §3.4 估时

| 项 | 读数 / 估算 | 依据 |
|---|---|---|
| **估计复制行数合计（必要集）** | **242 行 / 6 张表** | §2.2 |
| 含「可选」派生集（若 Kevin 决定一并搬） | +114 = **356 行 / 8 张表** | §2.2 |
| 全量非阻塞（含被挂夹具父的 30 行） | 386 行 / 10 张表 | 但 30 行需连夹具父 ⇒ 违反零夹具 |
| **按批 500 行 ⇒ 批数** | **1 批**（242/500 → 1；356/500 → 1） | `ceil()` |
| 单表事务 RTT 成本（1 源 SELECT + 3 新库语句） | **≈ 728 ms** | 实测 RTT：新库 **183.7 ms** · 源库 **176.7 ms**（各 20 次 `SELECT 1` 均值） |
| 6 表纯 RTT 合计 | **≈ 4.4 s** | `6 × 728 ms` |
| 8 表纯 RTT 合计 | **≈ 5.8 s** | `8 × 728 ms` |
| 逐行守卫/约束触发器（`account_guard` 每行、`ledger_entry` 3 触发器含 **DEFERRABLE CONSTRAINT** 佣金守恒、append-only 每行） | 242 行量级 ⇒ 服务端开销远小于 RTT | 现取触发器清单 |
| **估算总耗时（必要集 242 行，1 批）** | **≈ 1–3 分钟**（含 Neon serverless 连接建立/冷启 + 6 次事务 + 逐行守卫 + 验证查询） | 上列之和 + 保守余量 |
| **估算总耗时（必要 + 可选 356 行，1 批）** | **≈ 2–4 分钟** | 同上 |

> 估时**均为估算**（**未实跑任何复制**，本单零写）；唯一**实测**项是 RTT（`topology.json → rtt_ms_*`）。「按批 500 行」在本量级下**批数恒为 1**，故批大小不是瓶颈，**瓶颈是守卫语义（§3.3）与一致性（§4）**。

---

## §4 ★ 一致性风险 —— 「要么两者同搬、要么两者同不搬」的表对（逐条给不变量）

### §4.1 `(account, ledger_entry)` —— **硬不变量（触发器级）**

- **不变量**：`account.balance = Σ ledger_entry.delta(uid,cid)` **且** `= 最新 ledger_entry.balance_after`；`account.frozen = Σ frozen_delta = 最新 frozen_after`。
- **实测铁证**：现库 **48/48** 行**全部**满足（`invariants.json → inv_account_vs_ledger_mismatch = []`，0 例失配）。
- **只搬账本不搬账户 ⇒ 破坏**：新库 `ledger_entry` 有流水，但真用户 `account` 行**根本不存在**（新库现仅 `uid 0/-1/-2/-3`）⇒ 26 个真用户里 **19 个在源库有账户、新库 0 个**；界面读 `account.balance` = 零值/缺行（另 7 个真用户在源库亦无账户行）。
- **只搬账户不搬账本 ⇒ 破坏**：`INSERT` 被 `trg_account_guard` **硬拒**（`new account must start at 0/0`）；即便绕行，`UPDATE` 分支要求「等于最新分录快照」而新库**无分录** ⇒ `account update without any ledger_entry` 抛错。
- **⇒ 铁律**：**两者同搬**（顺序 `ledger_entry → account`，且按 §3.3 三步走），**或两者同不搬**（现状）。

### §4.2 `(batt_account, batt_entry)` —— **软不变量（无 FK，但数字自相矛盾）**

- **不变量**：`batt_account.batt = Σ batt_entry.delta(uid) = 最新 batt_after`。
- **实测铁证**：**56/56** 行全部满足（`inv_batt_mismatch = []`）。
- **只搬其一 ⇒ 破坏**：`batt_account` 无插入守卫 ⇒ **不会被拒**（静默污染：界面显示电量 X，流水求和为 0，或反之）。
- **⇒ 铁律**：**两者同搬**（`batt_account → batt_entry`），**或同不搬**。

### §4.3 `(currency.cid=1.total_supply, ledger_entry[cid=1])` —— ★ **源库本身已破的不变量**

- **实测**：`cid=1`：`total_supply = 2210276` 但 `Σ ledger_entry.delta = 1993455`（**差 216821**，413 行）；`cid=21`：`100` vs `99`（差 1）。⇒ **`total_supply` 不是账本派生量**，是一个**独立维护的计数器，且源库已与之漂移**。
- **对决策的含义**：S52b 曾把「新库 `total_supply=0`」定性为「派生的自洽值」；**本单订正**：它不是「账本求和应有的值」（账本求和应为 1993455，也不是 0）。⇒ **新库现值 `0` 是第三种值**。无论 Kevin 选哪条路（归零/扩复制集），**`total_supply` 都必须显式拍一个值**（搬源计数器 / 按账本重算 / 留 0），并将「源库该不变量已破」**登记为既有缺陷**（**非**本单造成）。
- **⇒ 铁律**：`currency`(1 行，已在新库) 与 `ledger_entry`(cid=1) **不可只搬一侧**却不处理 `total_supply`；**成对处置**。

### §4.4 `(checkin_makeup_log, ledger_entry)` —— 软引用（`txid`，无 FK）

- **实测**：5 个真行中 **3 行 `txid` 命中真账本行**（`733` uid12 `-100`、`735` uid2 `-100`、`2650` uid2 `-100`，`kind = checkin_makeup_fee`），**2 行 `txid = NULL`**。
- **只搬 makeup 不搬账本 ⇒ 破坏**：3 行 `txid` **静默悬空**（无 FK ⇒ 不报错，静默污染）。
- **⇒ 铁律**：**两者同搬**（账本先），**或同不搬**。

### §4.5 `(users, 其全部下游)`

- `users`(26) 已在库 ⇒ **所有下游的 `uid` 必须命中这 26 行**（现取：`batt_account` 18/18、`checkin_log` 4/4、`checkin_makeup_log` 5/5、`job_submission` 9/9 `worker_uid/reviewed_by`、`referral` 2/2 均命中真号段）。
- **⇒ 铁律**：`users` **必须**先于一切下游；`users` 不搬则下游一行都搬不动。

### §4.6 `(job_submission, job)` 与 `(market_trade, market_order + currency[夹具])` —— **成对「同不搬」**

- **实测**：`job_submission` **9/9** 真行的 `job_id ∈ {22,23,24}`（**全夹具**）；`market_trade` **7/7** 真行的 `buy_order_id/sell_order_id`**全指向夹具 `market_order`**（`1/7/10/12/17/20`）、`base_cid ∈ {4,16,21}`（**夹具币**）。
- **搬子 ⇒ FK 悬空**（6 条 FK：`job_submission.job_id`、`market_trade.buy_order_id/sell_order_id/base_cid`）；**连父同搬 ⇒ 45 行 `job`/25 行 `market_order` 夹具进新库**，直接违反「零夹具」。
- **⇒ 铁律**：**成对同不搬**（这 16 行真行**放弃**，理由是它们**只存在于夹具语境**）。

### §4.7 `(account[cid≠1] 6 行, ledger_entry[cid≠1] 8 行, currency[夹具 14 行])` —— **成对「同不搬」**

- **实测**：`account` 6 行（`uid 11/12 × cid 4/16/21`）与 `ledger_entry` 8 行属**夹具币**；`currency` 14 行夹具**未搬**（新库仅 `cid=1`）。
- **⇒ 铁律**：这 14 行真行**只能连夹具币同搬**（违反零夹具）⇒ **同不搬**（这就是 §2.2 里被「FK 闭包」剔除的 30 行中的 14 行）。

### §4.8 `(content_translation, 源夹具实体)` 与 `(translation_cache, 源文本)`

- **实测**：`content_translation` 63 真行的 `entity_type/entity_id` 指向 **`job`(39)`/currency`(15)`/listing`(6)`/user`(3)**，其中 `job` 全部为夹具（`job_is_real = []`），`listing 19` 亦夹具，`currency` 除 `cid=1` 外全夹具。⇒ 它是**夹具的下游**（同 S48 §3.3 已裁定）。
- **⇒ 铁律**：与源实体**同不搬**；`translation_cache`（`src_hash` 键）**可重算** ⇒ 亦不搬。

### §4.9 「站名」不变量（与 §5 联动）

`app_config`(1 行) **已搬进新库**且**逐字同**（含夹具串 `siteName = "p4b2c:siteA"`）⇒ **新库上屏站名仍是夹具串**。它不属于「账户/账本」，但同属「上屏可观测状态」：**若 Kevin 只清源库改站名而不管新库 ⇒ 新库继续上屏夹具串**（成对处置）。

---

## §5 站名与上屏键逐键读数（`app_config`，**只引值，不引凭据**）

### §5.1 `app_config` 全部行 / 全部键（现库 = 新库，**逐字相同**）

表内**只有 1 行**（`key = 'system_settings'`；`updated_by = '1'`；`time_updated = 2026-10-02T14:14:07.502Z`）。其 `value`（`jsonb`）逐键：

| # | 键 | 现值 | **上屏?** | **判定** | 口径① 是否命中 | 口径② 是否命中 |
|--:|---|---|:--:|---|:--:|:--:|
| 1 | **`siteName`** | **`p4b2c:siteA`** | **是（站点名/标题）** | ★ **夹具串**（命中 T1 模式 `p4b2c`） | **否**（`value` 是 jsonb，口径①只扫 text 列） | **是**（jsonb 文本化后命中） |
| 2 | `siteDescription` | `去中心化社区奖励平台` | 是（站点简介） | **正常**（业务文案，非批次标签） | 否 | 否 |
| 3 | `defaultLanguage` | `zh` | 是（默认语言） | **正常** | 否 | 否 |
| 4 | `maintenance` | `false` | 是（维护模式开关） | **正常** | 否 | 否 |
| 5 | `maxDailyTasks` | `10` | 是（每日任务上限） | **正常** | 否 | 否 |
| 6 | `pointsPerTask` | `100` | 是（每任务积分） | **正常** | 否 | 否 |
| 7 | `rewardCooldown` | `24` | 是（奖励冷却 h） | **正常** | 否 | 否 |
| 8 | `allowRegistration` | `true` | 是（开放注册开关） | **正常** | 否 | 否 |
| 9 | `emailNotifications` | `true` | 是（邮件通知开关） | **正常** | 否 | 否 |

- **凭据面**：`app_config` **无**任何凭据类键（逐键名无 `pass/secret/token/key/apiKey/dsn/url`）；本单**未打印任何凭据值**。
- **口径② 命中明细**：`{"value": 1 行}` —— 即仅 `siteName` 一处（`inventory.json → app_config.jsonb_hit_cols = {value:1}`）。
- **★ 两库同值**：`新库 app_config` 与 `现库 app_config` **逐字相同**（含 `siteName = "p4b2c:siteA"`）⇒ **夹具站名已在生产新库中生效**（S52b 搬的那 1 行）。

### §5.2 邻接上屏面（`app_config` 之外，一并给读数以备站名/文案决策）

| 来源 | 值 | 判定 |
|---|---|---|
| `currency cid=1` | `symbol = "$"` · `name = 平台积分` · `status = listed` · `total_supply = 2210276` | **正常**（名称/符号）；`total_supply` 见 §4.3（不一致） |
| `ledger_owner`(4) | `-3 罚没账户` · `-2 佣金池` · `-1 手续费归集账户` · `0 平台主体` | **正常**（全中文业务名，无批次标签） |
| `admin_role` 非夹具行 | `super_admin` / `超级管理员` | **正常** |
| `admin_role` 夹具行(4) | `p7b_fixture_admin` / `p7b_fixture_nopts` / `qa7b_admin` / `qa7b_nopts` | **夹具串**（未搬入新库，仅现库） |

---

## §6 未做 与 `NOT_MEASURED`（数不出来就写 `NOT_MEASURED`，不估）

**未做（有意，附理由）**：

1. **两库未执行任何写**：无 `INSERT/UPDATE/DELETE/TRUNCATE/setval/nextval/DDL`（本单只出**材料**，不动一行）。
2. **未实施复制**（§3 的顺序/估时**仅方案**）；**未实测** §3.3 的三步走（需写库）。
3. **未改任何既有文件**（`migrations/**`、`src/**`、`scripts/**`、`docs/*.spec.md` 零改动）；**未 commit/push**。
4. **未起实例、未打 HTTP、未碰 `5787/5788/5555/5191`**；未 `pkill`/`killall`；未 `npm install`。
5. **未对 `0043` 守卫做任何放宽**（含未 `DISABLE TRIGGER`）。

**`NOT_MEASURED`**：

| 项 | 原因 |
|---|---|
| **「三步走」搬 `account` 的实测可行性**（先账本 → 0/0 插入 → UPDATE 到快照） | 需写库 ⇒ **未实测**；结论仅由 `account_guard` 函数体（现取）+ 源库 48/48 不变量读数**结构性推断** |
| **新库运行时对「真用户无 `account` 行」的行为**（报错 / 视作 0 / 前端空态） | 需起实例 + 打 HTTP ⇒ 与本单「不起实例」冲突，**未测**（不起实例 ⇒ 不发明凭据/不碰端口） |
| **`total_supply` 的正确收敛值**（源计数器 2210276 / 账本和 1993455 / 0） | 源库两者本身不一致（§4.3）⇒ **无法判定哪个是「对」的**，写 `NOT_MEASURED`，交 Kevin 拍板 |
| **正确的站点名** | Kevin 未给目标站名 ⇒ 只报「现值为夹具串」，**不给应然值** |
| **各表复制的精确耗时** | 未实跑 ⇒ §3.4 为**估算**（唯一实测项 = RTT 183.7/176.7 ms；`自曝 §7.4`） |
| **`content_translation` / `translation_cache` 真行的逐串真伪** | 已判「挂夹具实体/可按源重算」；但**逐行**判定（63+51 行逐行来源）**未做代码考古** |
| **hash/地址列 213 行 T1 命中（`ledger_entry 205`·`translation_cache 6`·`users 1`·`admin_refund_audit_log 1`）的逐串真伪** | 这些列可同时承载批次标签与哈希样串（如 `users.uid=34.evm` 含 `b4a`）⇒ 逐串**无法机读区分**，**不计入口径②**，登记为残余歧义 |
| **对 S48 的逐表行数对拍** | **已做**（机读对拍 S48 §1.2 表格所载各表行数：唯一差异 = `schema_migration 42→43`）；**未做**的是「取 S48 时刻的**独立原始快照**（S48 产物未逐表留档行数）」，故基准为**文档表格值**而非二次实测 |
| **深分页/并发写入下各表行数的稳定性** | 本单为**只读快照**（单次），并发稳定性**未测** |

---

## §7 自曝

1. **★ 只读自证（两库）**：全部读数在 **`BEGIN READ ONLY`** 事务内执行；现取 `SELECT current_setting('transaction_read_only')` = **`on`**（**两库均 `on`**，见 `inventory.json → source_version.ro / newdb_version.ro`）。**零写语句**：对 6 个探针 grep 写动词（`insert|update|delete|truncate|setval|nextval|disable trigger`）**命中 3 处，逐条核为无害** —— ① `s52c-guards.ts:3` **注释**里提到 `BEFORE INSERT`；② `s52c-guards.ts:25` 是 `column_default LIKE 'nextval%'`（**读元数据**，只匹配字符串、**未调用** `nextval`）；③ `s52c-invariants.ts:83` 是 JS `Set.delete()`（**内存集合**，非 SQL `DELETE`）。⇒ **SQL 面零写**（探针内 SQL 仅 `SELECT` + 一次 `BEGIN READ ONLY`/`COMMIT`）。
2. **★ 凭据**：连库 = **进程内 `dotenv.parse` 读文件**（`.env.local` / `.env.newdb.local` 绝对路径），**未 shell source/export**、未把 DSN 进 argv/`ps`、**未打印任何凭据值**（只打印 host 前缀 / db 名 / PG 版本 / 表名 / 行数 / 值片段）。
3. **★ HEAD 在开工与收尾之间被外部移动（非本单所为）**：开工 `git log -1` = **`0cc198c`**（`git status` 曾有 `?? docs/audit/s52b-newdb-data-seed.md`）；收尾 = **`285d336`**（S52b 已入库）、`git status --porcelain` **空**。**本单 `git diff --stat` 与 `git diff --cached --stat` 均 0 行、未 commit/push** ⇒ 这是一次**外部（父单/S52b 收口）提交**，与本单无关，**如实登记**以便 Kevin 知道锚点漂移。
4. **★ 我的一次探针笔误（已修，如实登记）**：`s52c-invariants.ts` 首版用 `ledger_entry.amount`（该表实际列名为 **`delta`**）⇒ 首跑 `column "amount" does not exist`，**首跑零读数作废**；改 `delta`/`frozen_delta` 后复跑（`invariants.json` 为修正后读数）。**这是探针侧笔误，非库缺陷**。
5. **★ 我的一次探针笔误（已修，如实登记）**：`s52c-details.ts` 首版引用 `users.nickname`（该表实际列名 **`uid, evm, bio, is_admin, time_reg, time_login_last`**）⇒ 首跑 `column "nickname" does not exist`；改为 `bio/is_admin/time_reg/time_login_last` 后复跑。**同为探针侧笔误**。
6. **★ 口径与 S48 的**显式差异**（不掩盖、便于重算）**：本单按派单把 **`create_key LIKE 'cli:%'` 并入口径①**（S48 视其为「非夹具标记」）⇒ `Σ 夹具(口径①) = 1088`（S48 精化 = 1085），**+3 全在 `job_submission`**。逐表 **`T1`/`T2`/`cli:` 三分量均单列**于 §1.2 ⇒ 剔除 `cli:` 后即回 S48 口径（可自行重算）。
7. **★ 口径② 只增 1 行**：全库 34 张基表中**仅 `app_config` 有 `jsonb` 列**（`value`），故「jsonb 文本化」只翻出 `siteName = "p4b2c:siteA"` 一处 ⇒ `Σ 夹具(口径②) = 1089`、`Σ 真(口径②) = 495`。
8. **★ 我订正了 S52b 的一句定性（不是找茬，是读数不同）**：S52b 把 `currency.total_supply = 0` 定性为「账本派生的自洽值」。**现取：源库 `total_supply(2210276) ≠ Σ账本(1993455)`**（`cid=21` 同样差 1）⇒ 它是**独立计数器且源库已漂移**，新库 `0` 是**第三种值**。**登记源库既有缺陷**（`B22` 之后的新登记项，请 Kevin 决定是否入台账）。
9. **★ 「真行」不等于「该搬」**（本单最重要的方法论点）：20 张有真行的表里，**只有 6 张**（242 行）是「真用户可观测状态 + 父已在库」；**30 行真行挂夹具父**（`job_submission 9`·`market_trade 7`·`account 6`·`ledger_entry 8`）、**114 行是夹具的下游派生**。若不区分，会把「真号段数字」当成「真业务」而误搬，**直接造成 FK 悬空或把夹具带进新库**。
10. **端口/进程**：未起实例、未占端口、未 `pkill -f`/`killall`。
11. **运行环境**：`node v18.19.0`；DB 客户端 = 仓内既有 `@neondatabase/serverless` + `ws`（**未 `npm install`**）；探针以 `npx ts-node --transpile-only` 跑（仓内既有 `ts-node`）。

---

## §8 产物清单

- 报告：`docs/audit/s52c-pre-topup-assessment.md`（本文件）
- 产物目录：`backend-ts/.s52c-artifacts/s52c-20261007T070107Z/`
  - `inventory.json`（34 表逐表双口径 + 逐行判定 + 命中样本 + 逐列名；含 2 库行数 / 版本 / 只读自证 / `app_config` 两库对拍）
  - `topology.json`（54 FK 逐条「真行父引用」性质 + 阻塞 FK + 拓扑序 + 依赖状态 + RTT 实测）
  - `invariants.json`（FK 闭包包真集 + `account/ledger` 不变量逐行 + `batt` 不变量逐行 + `total_supply` 逐 cid + 触发器清单）
  - `guards.json`（`account_guard` 函数体 + identity/序列 + 待搬表列清单 + 币/账户/成交/提交 dump）
  - `details.json` / `details.stdout.txt`（`content_translation` 真行解析 + `checkin_*` 真行 + `makeup.txid` 解析 + 邻接上屏键）
  - `tbl-s1.md`（§1.2 表机读版）
  - 探针（**全部只读**，两库均 `BEGIN READ ONLY`）：`s52c-lib.ts` · `s52c-inventory.ts` · `s52c-topology.ts` · `s52c-invariants.ts` · `s52c-guards.ts` · `s52c-details.ts`

**复现命令**（均在 `backend-ts/`，`RUNID=s52c-20261007T070107Z`）：

```
npx ts-node --transpile-only .s52c-artifacts/$RUNID/s52c-inventory.ts   # §1 双口径逐表 + §5 app_config
npx ts-node --transpile-only .s52c-artifacts/$RUNID/s52c-topology.ts    # §3 拓扑/依赖/阻塞 + RTT
npx ts-node --transpile-only .s52c-artifacts/$RUNID/s52c-invariants.ts  # §4 FK 闭包 + 三条不变量
npx ts-node --transpile-only .s52c-artifacts/$RUNID/s52c-guards.ts      # §3.3 守卫体 + identity/序列
npx ts-node --transpile-only .s52c-artifacts/$RUNID/s52c-details.ts     # §2/§4 挂谁 + §5 邻接上屏键
```
