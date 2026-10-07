# S48 · `B22` 决策材料：夹具残差盘点 + 引用面 + 三级分级 + 用户可见面量化 + 分库草案（另附 `R7` 定性）

- **单号**：S48（角色：Kong）· **模式：严格只读（零写）**
- **runid**：`s48-20261007T004948Z`
- **产物目录**：`backend-ts/.s48-artifacts/s48-20261007T004948Z/`（`**/.*-artifacts/` 已在 `.gitignore`，见 §0）
- **结论先行**：**生产与本地 dev 是同一个库**（前证 `B22`）；本单现取：该库 `public` 34 张基表共 **1583 行**，其中可枚举夹具口径命中 **1085 行**（≈70%），而**用户在公开端点上看得到的业务表全部是夹具**（`job` 45/45 · `listing` 24/24 · `job_application` 19/19 · `listing_order` 18/18 · `market_order` 25/25）。三级分级：**A 零引用可清 = 989** · **B 有引用需级联 = 96** · **C 疑似真数据不可动 = 498**。**「清夹具」不等于可删**（`users` 38 行全有引用，`batt_account.uid` 一条就给每行 ≥1）。**根治路径 = 分库（b）**：草案见 §5。

> 本单**未执行任何写**：无 `INSERT/UPDATE/DELETE/TRUNCATE/setval/nextval/DDL`；未对 prod 发任何写请求（§4 全为公开 `GET`）；未起实例；未改任何既有文件（仅新增报告与产物）。连库一律**进程内 dotenv**（`backend-ts/.env.local`，绝对路径），**未 shell source/export**，**未打印任何密钥值**（探针只打印 sanitized host/db/user + `password:***`）。

---

## §0 对锚（开工前现取）

| 项 | 现取读数 | 命令 |
|---|---|---|
| HEAD | `672d328` fix(scripts): S47 路线图 R3b … | `git log --oneline -3` |
| 分支 | `main` | `git rev-parse --abbrev-ref HEAD` |
| tracked 改动（T0） | **0**（`git status --porcelain` 空） | `git status --porcelain` |
| 站点端口 | 未触碰（本单**不起任何实例**、不碰 `5787/5788/5555/5191`） | — |
| 连库口径 | 进程内 dotenv，`path='/Users/kevin/bistro/seafood/backend-ts/.env.local'`；**不 source、不打印密钥** | 探针 `p1-schema.cjs` |
| DB 现取 | `db=neondb` · `pg 18.6` · `user=neondb_owner` · host=`ep-holy-forest-b3fi7u3u-pooler...aws.neon.tech` · `schema_version=0043` · `schema_migration 42 行` | `SELECT current_database(), current_user` + `schema_migration` |

**与 prod 同库的交叉印证**：prod `/api/health`（`ssseafood.vercel.app`）回 `schema_version=0043` 且 `db_version` 与本地逐字相同（§4）。

★ 纪律：本单**零写**；未 `setval`/`nextval`；未 `pkill`；未 commit/push；未 `npm install`；未改任何文件。

---

## §1 夹具指纹与逐表盘点（含口径与命中数）

### §1.1 口径定义（可枚举、可复现）

- **T1 文本指纹**：一张表的**文本列**（`text/varchar/char`）中任一出现下列**可枚举批次/夹具前缀**（`ILIKE '%<p>%'`）：
  `p4b2 p3j p4z p3l p3f p7a p7b qa7b fixture b6audit s1x- p8s p4a tr1b tr1c b3c b3d b4a b4cii b4ciib qab4 qa-neng aud-jk num1 n1a n1b p4b3 qap7 p2x p2qa probe`
- **T2 号段**：**身份类数字列**（主键 或 `uid/*_uid/cid/reviewed_by`）出现 `>= 900000`（沿用 S43「夹具高号段 ≥900000」口径）。
- **并集 = 夹具行**（T1 **OR** T2）。
- **`cli:*` create_key 的特殊性（重要）**：本仓 `create_key` 在**调用方未显式提供**时由服务端生成 `cli:<uuid>`（现取：`job 136 = cli:f0070d73-...`）⇒ **`cli:` 本身不是夹具标记**（真 UI 创建也会带），故本单**不**以 `cli:` 单列命中，只在**能追溯到夹具号段/批次**时计入（见 §4 的 3 行分析）。
- **反污染（口径精化）**：开跑初版的扫描把**纯哈希/地址列**也纳入 T1，导致**短十六进制前缀**（`b3c/b3d/b4a` 三个字符全在 `[0-9a-f]` 内）在哈希串/地址串里**误命中**。实测：`users.uid=34` 的 `evm=0xd173521a639bbb4a31779eb889c65a5964e2ed2b` 里含子串 `b4a` ⇒ 被误判为夹具。**精化口径 = T1 排除 4 个纯哈希/地址列**：`evm · request_fingerprint · src_hash · event_root_key`。本节全部计数为**精化后**读数（粗口径读数留痕于 §7）。

### §1.2 逐表盘点（34 张 `public` 基表全扫）

| 表 | 表行数 | T1 文本命中 | T2 号段命中 | 并集(夹具) | 扫的文本列 | 未扫(EXCL) |
|---|--:|--:|--:|--:|---|---|
| `account` | 48 | 0 | 19 | **19** | —(无文本列) | — |
| `admin_ops_audit_log` | 5 | 4 | 5 | **5** | `action`, `op`, `idempotency_key`, `result`, `memo` | `request_fingerprint` |
| `admin_permission` | 12 | 0 | 0 | **0** | `permission_key`, `name` | — |
| `admin_refund_audit_log` | 7 | 2 | 7 | **7** | `result`, `idempotency_key`, `memo` | `request_fingerprint` |
| `admin_role` | 5 | 4 | 0 | **4** | `role_key`, `name` | — |
| `admin_role_permission` | 16 | 4 | 0 | **4** | `role_key`, `permission_key` | — |
| `admin_user_role` | 7 | 6 | 7 | **7** | `role_key` | — |
| `app_config` | 1 | 0 | 0 | **0** | `key` | — |
| `batt_account` | 56 | 0 | 38 | **38** | —(无文本列) | — |
| `batt_entry` | 60 | 0 | 40 | **40** | `reason`, `idempotency_key`, `ref_type`, `memo` | — |
| `checkin_log` | 6 | 0 | 2 | **2** | —(无文本列) | — |
| `checkin_makeup_log` | 5 | 0 | 0 | **0** | `result`, `idempotency_key`, `memo` | `request_fingerprint` |
| `commission_policy` | 4 | 0 | 0 | **0** | —(无文本列) | — |
| `content_translation` | 321 | 258 | 0 | **258** | `entity_type`, `entity_id`, `field`, `lang`, `text`, `status`, `last_error` | — |
| `currency` | 15 | 13 | 14 | **14** | `symbol`, `name`, `icon_url`, `status` | — |
| `currency_review_log` | 0 | 0 | 0 | **0** | `result`, `idempotency_key`, `memo` | `request_fingerprint` |
| `currency_status_log` | 7 | 0 | 7 | **7** | `from_status`, `to_status`, `memo` | — |
| `job` | 45 | 42 | 15 | **45** | `title`, `description`, `status`, `create_key` | — |
| `job_application` | 19 | 19 | 5 | **19** | `status`, `create_key` | — |
| `job_arbitration_log` | 0 | 0 | 0 | **0** | `result`, `idempotency_key`, `memo` | `request_fingerprint` |
| `job_submission` | 40 | 28 | 19 | **28** | `deliverable`, `review_status`, `review_memo`, `create_key` | — |
| `ledger_entry` | 504 | 215 | 248 | **320** | `kind`, `ref_type`, `idempotency_key`, `memo` | `request_fingerprint`, `event_root_key` |
| `ledger_owner` | 4 | 0 | 0 | **0** | `owner_type`, `name` | — |
| `listing` | 24 | 24 | 17 | **24** | `title`, `description`, `status`, `create_key` | — |
| `listing_order` | 18 | 18 | 15 | **18** | `status`, `create_key` | — |
| `listing_order_event` | 0 | 0 | 0 | **0** | `event_type`, `from_status`, `to_status`, `idempotency_key`, `ref_type`, `memo` | `request_fingerprint` |
| `listing_review_log` | 0 | 0 | 0 | **0** | `result`, `idempotency_key`, `memo` | `request_fingerprint` |
| `market_order` | 25 | 23 | 14 | **25** | `side`, `status`, `create_key` | — |
| `market_trade` | 8 | 0 | 1 | **1** | —(无文本列) | — |
| `rating` | 0 | 0 | 0 | **0** | `target_type`, `direction`, `idempotency_key`, `memo` | `request_fingerprint` |
| `referral` | 2 | 0 | 0 | **0** | —(无文本列) | — |
| `schema_migration` | 42 | 0 | 0 | **0** | `version`, `name`, `checksum` | — |
| `translation_cache` | 213 | 162 | 0 | **162** | `src_lang`, `tgt_lang`, `text_out`, `engine` | `src_hash` |
| `users` | 64 | 27 | 38 | **38** | `bio` | `evm` |

**合计：`Σrows=1583` · `Σfixture=1085`**（`≈68.5%`）。产物：`fixtures.json`（粗口径逐模式明细）· `refined.json`（精化口径逐表）。

**`NOT_MEASURED`（本表内，不得估）**：
- `admin_permission` / `app_config` / `commission_policy` / `referral` / `ledger_owner` 等**无文本列或文本列无夹具标记**的表，其「夹具 vs 真」**仅凭文本+号段口径无法判定**（例：`commission_policy` 4 行、`ledger_owner` 4 行、`referral` 2 行**均判 0 夹具**，但**不排除**其为夹具种子）——**写 `NOT_MEASURED`**，处置一律落 §3 的 C（不可动）。
- 逐行「插入来源脚本」（哪段代码写了它）**未做代码考古**（同 S43）⇒ `NOT_MEASURED`。

---

## §2 引用面汇总（复用 S43 的 FK 方法）

**方法**：以 `pg_constraint` 现取 **54 条 `public→public` 外键**（`schema.json → fks`）；对每张**被引用父表**，把它的**夹具行主键集合**代入每条 FK 的子列，统计引用行数（`child.col IN (SELECT pk FROM parent WHERE 夹具谓词)`），**每条 FK 一条聚合查询**（非逐行往返）。

### §2.1 三数（本单硬读数）

| 指标 | 行数 |
|---|--:|
| **总夹具行** | **1085** |
| **零引用夹具行（无任何其它行引用它）** | **989** |
| **有引用夹具行（≥1 处入向 FK）** | **96** |

（`989 + 96 = 1085` ✓）

### §2.2 8 张「被引用父表」的逐表引用分布

| 父表 | 夹具行 | 零引用 | 有引用 | 引用行数区间 |
|---|--:|--:|--:|--:|
| `users` | 38 | 0 | **38** | [5, 26] |
| `admin_role` | 4 | 0 | **4** | [2, 3] |
| `job` | 45 | 19 | **26** | [0, 7] |
| `listing` | 24 | 19 | **5** | [0, 7] |
| `market_order` | 25 | 11 | **14** | [0, 2] |
| `currency` | 14 | 5 | **9** | [0, 51] |
| `ledger_entry` | 320 | **320** | 0 | [0, 0]（仅自引用 `reversal_of_txid`，现为 0） |
| `listing_order` | 18 | **18** | 0 | [0, 0]（子表 `listing_order_event` 0 行） |

> `users` 的 38 行**全部**有引用（与 S43 逐字一致：38/38 有引用）；**最小引用 5**（远高于 S43 时的 1）——说明每行至少被 5 处引用。**`users` 一行都删不得**。

### §2.3 「其余表 = 叶子」（无任何入向 FK ⇒ 其夹具行必为 0 引用）

现取无入向 FK 的表（其夹具行自动落零引用）：`account`(19) · `admin_ops_audit_log`(5) · `admin_refund_audit_log`(7) · `admin_role_permission`(4) · `admin_user_role`(7) · `batt_account`(38) · `batt_entry`(40) · `checkin_log`(2) · `content_translation`(258) · `currency_status_log`(7) · `job_application`(19) · `job_submission`(28) · `market_trade`(1) · `translation_cache`(162) = **597**。

---

## §3 三级分级（每行必落一级，无「待定」）

**分级域 = 全部 `public` 业务表的 1583 行**（含系统表 `schema_migration` 42 行归 C）。

| 级 | 定义 | 计数 | 处置 |
|---|---|--:|---|
| **A** 零引用纯夹具（可清） | 夹具口径命中 **∧** 零入向引用 | **989** | 可删（无级联阻力） |
| **B** 有引用（清理需级联） | 夹具口径命中 **∧** ≥1 入向引用 | **96** | **禁直接删**；须按 §3.2 链自叶向根逐层清 |
| **C** 疑似真数据（不可动） | 未命中夹具口径（或属派生/种子/真号段） | **498** | **不可动** |

### §3.1 A 级明细（989 = 597 叶子 + 394 父表零引用）

- **叶子表夹具行（全 A）= 597**：`account 19 · admin_ops_audit_log 5 · admin_refund_audit_log 7 · admin_role_permission 4 · admin_user_role 7 · batt_account 38 · batt_entry 40 · checkin_log 2 · content_translation 258 · currency_status_log 7 · job_application 19 · job_submission 28 · market_trade 1 · translation_cache 162`。
- **被引用父表内的零引用夹具行 = 394**：`ledger_entry 320 · job 19（job_id 253/10/236/237/238/18/239…）· listing 19（listing_id 1–6/7–12/14/15/17/19/20/21/22）· listing_order 18 · market_order 11（14/3/4/18/8/24/13/23/21/25/26）· currency 5（cid 9/15/22/27/28）`。

### §3.2 B 级明细（96）——**逐条给级联链**

| 父表 | 有引用夹具行 | 级联链（子表.列 : 引用行数） |
|---|--:|---|
| `users` | 38 | `admin_ops_audit_log.target_uid(5)` · `admin_refund_audit_log.actor_uid(7).buyer_uid(7).seller_uid(7)` · `admin_user_role.uid(7)` · `batt_account.uid(38)` · `checkin_log.uid(2)` · `currency_status_log.actor_uid(7)` · `job.employer_uid(19).worker_uid(2)` · `job_application.worker_uid(5)` · `job_submission.reviewed_by(19).worker_uid(10)` · `listing.seller_uid(17)` · `listing_order.buyer_uid(13).seller_uid(15)` · `market_order.owner_uid(14)` · `market_trade.taker_uid(1)` |
| `admin_role` | 4 | `admin_role_permission.role_key(4)` · `admin_user_role.role_key(6)` |
| `job` | 26 | `job_application.job_id(19)` · `job_submission.job_id(40)` |
| `listing` | 5 | `listing_order.listing_id(18)` |
| `market_order` | 14 | `market_trade.buy_order_id(8)` · `market_trade.sell_order_id(8)` |
| `currency` | 9 | `account.cid(12)` · `currency_status_log.cid(7)` · `ledger_entry.cid(91)` · `market_order.base_cid(25)` · `market_trade.base_cid(8)` |

**B 的处置含义**：96 行**都删不得**（直接删会被 FK `NO ACTION` 硬阻塞——本仓 `users` 的 28 条 FK **全 `NO ACTION`**，S43 已证）。要清它们必须**自叶向根**逐层删（先删引用者，再删被引用者），且 `users` 是否可删须先拥有「零引用」才成立——**现为 0**。

### §3.3 C 级明细（498 = 业务表 456 + `schema_migration` 42）

| 表 | C 行数 | 构成（现取） |
|---|--:|---|
| `ledger_entry` | 182 | 未命中夹具口径的分录（含真号段用户 1–41 的资金腿、种子资金） |
| `content_translation` | 63 | 未命中批次的译文行 |
| `translation_cache` | 51 | 未命中批次的缓存行 |
| `account` | 29 | 真号段用户的余额账户 |
| `users` | 25 | **真号段 uid 1–41 的身份行**（S43 已裁「真号段、禁删」） |
| `batt_entry` | 20 | 真号段电量分录 |
| `batt_account` | 18 | 真号段电量账户 |
| `admin_permission` | 12 | 权限种子 |
| `admin_role_permission` | 12 | 非夹具角色-权限种子 |
| `job_submission` | 12 | 未命中批次 |
| `market_trade` | 7 | 未命中批次（1 行命中号段） |
| `checkin_makeup_log` | 5 | 补签日志 |
| `checkin_log` | 4 | 真号段签到 |
| `commission_policy` | 4 | 返佣策略种子 |
| `ledger_owner` | 4 | 账本主体（平台/系统账户） |
| `referral` | 2 | 推荐关系 |
| `app_config` | 1 | 站点配置（`system_settings`） |
| `admin_role` | 1 | 非夹具角色 |
| `currency` | 1 | **`cid=1` 平台积分（`$`／`平台积分`／`owner=0`）** |
| `schema_migration` | 42 | 迁移版本表（系统，禁删） |

> **C 的判据是「不可动」**：真号段身份位（`users` 1–41）、种子/配置、系统表、派生缓存一律不动。**注意**：C 里的派生表（`content_translation`/`translation_cache`）**其内容派生自夹具**（译文行 258/162 已命中夹具）⇒ 它们是「夹具的下游」而非真数据，若走 (a) 清库，应随源行一并处置（登记为派生依赖，非独立真数据）。

---

## §4 用户可见面量化读数（prod 只读 GET）

- **prod 基址**：`https://ssseafood.vercel.app`（本机 DNS 把该域解析到保留段 ⇒ 必须 `--resolve ssseafood.vercel.app:443:76.76.21.21`）。
- **全部为 `GET`（只读）**，未发任何写请求。

### §4.1 逐端点量化

| 端点 | HTTP | 总条目 | 夹具条目 | 占比 | 口径 |
|---|--:|--:|--:|--:|---|
| `/api/task/all` | 200 | **45** | **45** | **100%** | 42 行标题/`create_key` 显式批次命中 + 3 行 `cli:<uuid>`（服务端键）**其 `employer_uid=970213`（夹具号段用户 ⇒ 夹具来源）** |
| `/api/prize/all` | 200 | **24** | **24** | **100%** | 每条 `bID` 回溯 `listing.create_key` 均命中批次（`cli:p4b2c:listing:*` 等） |
| `/api/home` | 200 | 含 `tasks` 列表 | 同 `/api/task/all` | **100%** | 首页任务列表即 `job` 表（全夹具），标题含 `p4b2:fixture:*` |
| `/api/task/:tID`（抽样 `2`） | 200 | 1 | 1 | 100% | `tID=2` = `p4b2:fixture:A` |
| `/api/prize/:bID`（抽样 `1`） | 200 | 1 | 1 | 100% | `bID=1` = `p4b2c:listing A` |
| `/api/market/4/orderbook` | 200 | 1 | 1 | 100% | `{side:buy, price:1234, volume:5}`（`market_order` cid4 夹具单） |
| `/api/market/4/trades` | 200 | 若干 | 夹具 | 100% | 撮合记录 |
| `/api/role-names` | 200 | — | — | — | 空壳（`role_names:null`），无数据面 |
| `/api/rating/summary` | **401** | — | — | — | 需登录（不在公开面） |
| `/api/timeliness` · `/api/user/all` · `/api/checkin` · `/api/batt` · `/api/job/:id/submissions` | **401** | — | — | — | 需登录（不在公开面） |

### §4.2 关键订正（vs 派单口径的「20/45」）

派单口径写「prod `/api/task/all` 45 行里 **20 例**标题是夹具（`p4b2:fixture:A` / `p4b2c:fixture job` / `p3j job 1` …）」。**现取：靠肉眼可辨的批次标签标题命中 42/45**；余 3 行（`32312312` · `来 10 个人` · `再来 50 个人`）标题**看似人类内容**，但其 `create_key=cli:<uuid>`（服务端生成键）、`employer_uid=970213`（**夹具高号段用户**）⇒ **同为夹具来源**；再叠加 `p4b2c:siteA`（`app_config` 的 `siteName`）等**站点文案本身也是夹具**。⇒ **可见面夹具占比是 45/45（100%），比「20/45」的肉眼口径更差**（肉眼只数了「自带批次标签」的那一类）。

> 判据：本文「夹具」= ①标题/`create_key` 命中可枚举批次 **或** ②`create_key=cli:<uuid>` 且创造者 `uid≥900000`（夹具号段）**或** ③整表即夹具（`job`/`listing` 现取 100%）。三口径并列，均指向 100%。

---

## §5 「分库」方案工作草案（**只出草案，不实施**）

### §5.1 现状：生产连接串从哪来（现取，未打印密钥）

| 面 | 现取 | 证据 |
|---|---|---|
| **生产（Vercel）** | Vercel 项目 `seafood`（`orgId team_AURp3cDJIwgJT5MM4FjRb4vJ`，本地 `.vercel/project.json`）；**库连接串全部带 `SF_` 前缀** —— `SF_DATABASE_URL` / `SF_DATABASE_URL_UNPOOLED` / `SF_POSTGRES_URL` / `SF_POSTGRES_URL_NON_POOLING` | `src/env.ts` 头注（现取来源：`vercel env` 面）+ `VERCEL_PREFIX_FALLBACKS` 映射表 |
| **注入点（唯一）** | `src/env.ts`（`src/index.ts` 首 import）：把 `SF_*` → 规范名 `DATABASE_URL*`（仅当规范名缺失时赋值，**不覆盖**已存在值）。业务面只读规范名（`database.ts:60-66` / `db.ts:34-48` / `ledger.ts:988,1014`） | 现取源码 |
| **本地 dev** | `backend-ts/.env.local`（`DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`） | 探针进程内 dotenv |
| **是否自动迁移** | **否**：`vercel.json` 无 `buildCommand`/`postinstall`；全仓 `migrate` 调用点 0；CI 只跑 lint/type-check/test/build，**无 migrate** | S45 `pipeline-evidence.txt`（现取复引） |
| **两侧指向** | **同一个 Neon 库**：`neondb @ ep-holy-forest-b3fi7u3u-pooler.c-4.ap-southeast-1.aws.neon.tech` | S45 三证据链 + 本单 prod `/api/health` `schema_version=0043` 与本地逐字一致 |

⇒ **分库 = 只需把生产那份 `SF_*` 指向另一个库**（改 Vercel env），**本地 `.env.local` 不动**。因为注入点是 `src/env.ts` 的**单点映射**，无第二处读连接串的旁路。

### §5.2 步骤草案

1. **开新库**：为 prod 新建一个 Neon 项目/分支（或同项目新 database），命名如 `seafood_prod`；**与 dev 库物理隔离**。
2. **建 schema**：对新库跑**全部迁移**（`npx ts-node --transpile-only scripts/migrate.ts`，以其自身 `.env` 指向新库；这是**唯一的 schema 真源**——`migrations/*.sql`）。
3. **一次性数据复制**（口径见 §5.3）：只搬**真数据**（`users` 真号段、`currency cid=1`、种子/配置、`schema_migration`），**不搬夹具**。
4. **切换生产连接串**：把 Vercel `seafood` 的 `SF_DATABASE_URL(_UNPOOLED)` 重指新库（`vercel env`）；`SF_*` 其余两个同改。
5. **本地隔离加固**：dev 库保持现状；可选加一条**部署期守卫**（构建时若 `SF_*` 指向 dev 库则失败）防回退。
6. **终验**：prod `/api/health` 的 `db_version`+`schema_version`、`/api/task/all` 行数应为 **0 或仅真数据**（不再是 45 夹具）。

### §5.3 一次性数据复制口径

- **复制集（白名单）**：`schema_migration`（全表，保版本连续性）；`users` 仅 `uid < 900000`（真号段 25 行…**注意**：现取真号段实为 26 行，其中 `uid=34` 因 evm 含 `b4a` 被**粗口径**误命中、精化后为真；以**号段判据** `uid<900000` 为准）；`currency` 仅 `cid=1`；种子/配置（`commission_policy`/`ledger_owner`/`app_config`/`admin_permission`/`admin_role` 非夹具行/`referral`）。
- **不复制**：全部 T1/T2 命中的 1085 夹具行及其下游派生（`content_translation`/`translation_cache`）。
- **顺序**：先 `schema_migration` → 再根实体（`users`/`currency`/种子）→ 再业务（空，若真数据为空则业务表**留空**）。**空库 + schema = 最干净的生产起点**。
- **可复现**：复制脚本按**白名单判据**（`uid<900000` 等）生成 `INSERT ... SELECT`，**禁按夹具黑名单**（黑名单会漏），并**跑完断言**：新库 T1/T2 命中 = 0。

### §5.4 风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| **一次性切换丢真数据** | 现库若混有真用户，切换即丢 | 先按 §5.3 白名单清点真数据行数（现取：真身份仅 ~25 行）并与用户确认 |
| **迁移链不可重放** | 新库跑迁移须**逐版本 skipped/applied** 正常（checksum 锚） | 用 `migrate.ts --status` 先只读核对；迁移是**纯 SQL + 版本表**，无外部依赖 |
| **回退点** | 切换后本地 `.env.local` 仍指旧库 ⇒ 本地探针**不会再污染新 prod**，但旧库仍是「混库」 | 保留旧库只读快照一段时间 |
| **`SF_*` 覆盖语义** | `src/env.ts` 只「补缺不覆盖」⇒ 若某处**显式注入**了规范名会压过 `SF_*` | 现取无此类注入（本地靠 `.env.local`，Vercel 靠 `SF_*`） |

### §5.5 工作量量级

**M（≈0.5–1 人日，且属运维/配置为主，几乎零代码改动）**：开库 + 跑迁移 + 一次性复制脚本 + 改 2 个 Vercel env + 终验。**代码面零改动**（`src/env.ts` 的单点映射已支持；不存在第二连接串读点）。

### §5.6 为何「分库」是根治（vs (a) 清夹具 / (c) 读取面过滤）

- **(a) 逐表清夹具 = 治标且会复发**：本轮 1085 夹具行里 **96 行有引用**、**`users` 38 行全有引用**（最小 5 处）⇒ 直接删被 FK `NO ACTION` 硬阻塞；要清必须**自叶向根逐层删**，代价大且**下一个本地探针一跑又写回来**（同库 ⇒ 探针=生产写）。
- **(c) 读取面过滤 = 只遮不治**：过滤只改「用户看见什么」，库内仍是混库；任何**未过滤的读口 / 运维查询 / 报表**照旧暴露夹具，且新加端点默认又漏。
- **(b) 分库 = 结构性根治**：把「本地探针/夹具」与「生产」放到**两个物理库**后，**本地任何写（探针、夹具、调试）在构造上不可能到达生产**——污染源被物理切断，而不是靠纪律/过滤去挡。`src/env.ts` 单点注入 + 无自动迁移 ⇒ 切换面小、可逆（改回 env 即回退），风险与工作量都可控。**这正是 `B22`（同库）的直接对症解**。

---

## §6 `R7` 定性（两个子探针独立跑 `exit 1`）

**对象**：`backend-ts/scripts/p8-s3-01-effective.ts` · `backend-ts/scripts/p8-s5-01-real-chains.ts`。

### §6.1 是不是「子探针、预期由父门带参数调用」？——**现取否定**

- `grep -rn` 全仓（`*.ts/*.sh/*.json/*.cjs`）：**没有任何文件 import / 以参数调用**这两个脚本；命中的只有文档与旧产物。
- 它们是**自带 `RUN`/产物/`process.exit(failed?1:0)` 的顶层门**（各含 `()=>{…}.catch(()=>exit(2))` 的顶层 IIFE）。
- 其**同名「父门」**（`p8-s5-compliance-gate.ts`）在产物里**明写**：本门零 DB/零 HTTP，库面读数「**由 DB 探针 `p8-s5-01-real-chains.ts` 实测（另册）**」⇒ 是**并列的独立 DB 探针**，**不是子探针**。
- ⇒ **R7 假设「疑为子探针、预期由父门以特定夹具/参数调用」不成立**。
- **正确调用方式（现取，即两文件头注写的）**：`cd backend-ts && npx ts-node --transpile-only scripts/<file>.ts`（S47 已按此跑，无参数）。

### §6.2 `exit 1` 的**真因**（读 S47 已录制的原始产物，本单**未重跑**、零写）

**（甲）`p8-s5-01-real-chains.ts`：`exit 1`，**67/69**，2 条红：**
- 红点：`S1.listing_review_log.append_only` · `S1.job_arbitration_log.append_only`
- 原始读数：`expect=["trg_listing_review_log_append_only:27"]` ⇄ `actual=["…_append_only:27","…_no_truncate:34"]`（两表同形）。
- **真因 = 探针的「期望触发器集合」已过期（冻结面滞后），非产品缺陷**：探针断言这两张 append-only 表的**确切口径触发器集**；此后**已应用迁移 `0043_truncate_guard.sql`**（S26，`d579124`）为该族 15 张表补了 **`BEFORE TRUNCATE` 守卫**（`trg_*_no_truncate`）⇒ 现盘多了 1 枚触发器，探针「期望 = 旧集合」**必然红**。
- **定性**：**探针侧「期望前推」缺失**（把 `*_no_truncate` 纳入期望集 = **加严**，与「TRUNCATE 缺口已补」一致），**不触产品代码**。

**（乙）`p8-s3-01-effective.ts`：`exit 1`，**23/34**，11 条红，**全部**在 `behavior` 组（④「行为随之」段）：**
- 红点：`S4-before/after-{applied-1, owner-decrease, pool-increase, deposit-legs}` · `S4-two-readings-{differ,computable}` · `S4-fail-closed-behavior`。
- 原始读数：`applied: 0 (期望 1)` · `owner_decrease: 0 (期望 60000/133456)` · `deposit-legs: [] (期望 ["-1:50000","970001:-50000"])`——即**行为段整段 no-op**（同路径 DB verb 未推进 `draft→listed`、零分录、零余额变动）。
- **真因 = 行为段的**前置未满足**（环境/夹具）**：该段调用**同路径真实 verb**（`DatabaseService.listCurrencyWithDeposit`）来演示「改键前/后消耗额随之」，其成立依赖**一个满足 `account_guard` 的已出资账户 + `draft` 币**（派单方早前已查清：`account_guard` 要求 `account` 的 INSERT 必 `0/0`、UPDATE 必等于最新分录快照 ⇒ 出资账户只能取**现库已出资者**）。现库该夹具状态不满足 ⇒ verb `applied=0` ⇒ 11 条行为判据全红。
- **反证它不是产品缺陷**：同批**同族路径**的门 **全绿** —— `p8-s4-01-effective` 31/31 · `p8-s4-currency-review-gate` 79/79（均走上市/保证金同族面），且 `p8-s3-01` 自身的 ①②③（写键/落值/读口）段 **23 项全绿**。⇒ 产品路径正常，红点在**该探针的行为段前置**。

### §6.3 `R7` 汇总定性

| 脚本 | exit | 红数 | 定性 | 是否「真缺陷」 | 正确调用 / 处置 |
|---|--:|--:|---|---|---|
| `p8-s5-01-real-chains` | 1 | 2/69 | **探针期望过期（冻结面滞后）** | **否** | `npx ts-node --transpile-only scripts/p8-s5-01-real-chains.ts`；须**前推期望**纳入 `*_no_truncate` |
| `p8-s3-01-effective` | 1 | 11/34 | **行为段前置缺失（环境/夹具）** | **否** | `npx ts-node --transpile-only scripts/p8-s3-01-effective.ts`；须补**满足 `account_guard` 的已出资账户+draft 币**，或把④行为段降级为 `NOT_MEASURED` |

⇒ **`R7` 既非「子探针缺父门参数」，也非「真缺陷」**：一处是**探针期望冻结面过期**、一处是**环境/夹具前置缺失**。两者**均属探针/环境侧**，**不得据此改产品代码**；`R7` 可结为「**两个独立门中各一处的探针侧修正**」。（本单**未改这两文件**。）

---

## §7 未做与 `NOT_MEASURED`（数不出来就写 `NOT_MEASURED`，不估）

**未做（有意）**：
- **未执行任何写**（无 `DELETE/INSERT/UPDATE/TRUNCATE/setval/nextval/DDL`）——本单**只读**。
- **未对 prod 发任何写请求**（§4 全为公开 `GET`；`/api/admin/*` 等留空未碰）。
- **未起实例、未跑 `p8-s3-01`/`p8-s5-01`**（其读数取自 S47 已录制的只读产物）——因两者含**事务内写**，与本单「严格只读」冲突。
- **未实施分库**（§5 仅草案）。

**`NOT_MEASURED`**：

| 项 | 原因 |
|---|---|
| 无文本列且无号段命中的表（`commission_policy`/`app_config`/`referral`/`ledger_owner`/`admin_permission`）的**逐行夹具级判定** | 文本+号段口径**不覆盖**这些表 ⇒ 无法判定，统一落 C |
| 夹具行的**插入来源脚本**（哪段代码写入） | 未做代码考古（同 S43） |
| `translation_cache.text_out` / 各表 `idempotency_key` 内**短十六进制批次串**（`b3c/b3d/b4a`）的**逐串真伪** | 这些列可同时承载批次标签与哈希样串，**逐串无法机读区分** ⇒ 该表计数含**残余歧义**（登记，不估） |
| **未登录可见面之外**（`/api/rating/summary` 等 `401` 端点）的夹具占比 | 需登录，本单**不发明凭据** ⇒ 不测 |
| 各 FK 表的**精确扫描耗时/性能画像** | 属性能面，非本单 |

---

## §8 自曝

1. **本单严格只读**：`git status --porcelain` 仅新增**未跟踪产物目录**（`.s48-artifacts/`，已被 `**/.*-artifacts/` 覆盖）+ 本报告（§9）。**无 tracked 改动**；未 commit/push。
2. **探针自身 bug（已修，如实登记）**：`p4-refs.cjs` 首版把 `ANY($B)` 误写为字面量占位符（应为 `$1`）⇒ 首跑 `syntax error at or near "$"`，T1 全 0；改用 `$1` 后复跑正常。**首跑的零读数作废**，本文全部 T1 取修正后读数。
3. **口径精化自曝**：开跑初版**未排除哈希/地址列** ⇒ `users.uid=34`（`evm` 含子串 `b4a`）被**误判夹具**，粗口径 `users T1=28`。精化（排除 `evm/request_fingerprint/src_hash/event_root_key`）后 `users T1=27`、`Σfixture 1088→1085`（粗口径三数 = A 991 / B 97 / C 495，留痕备查；**本报告以精化口径 989/96/498 为准**）。这是**我自己的探针误报**，非库缺陷。
4. **去重判据的边界**：`Σfixture` 是**并集口径**（T1 ∨ T2），非各模式之和；同表的 T1 与 T2 有重叠（如 `job` T1=42 ∧ T2=15，并集 45）。
5. **「可见面 100% 夹具」的判据分层**：42/45 靠批次标签，3/45 靠「服务端键 + 夹具号段创造者」，`/api/prize/all` 24/24 靠 `create_key` 回溯；三口径**并列**给出，任一单列都不足以覆盖全部。
6. **`R7` 未独立复跑**：定性基于 S47 已录制的原始产物（`.s47-artifacts/.../gates/after/{s3-01,s5-01}.artifact.json`）与 `0043` 迁移现取，**未在本单重跑两脚本**（会写库，与只读冲突）——如实登记为「读二手产物定性」。
7. **端口**：本单未起任何实例、未占端口、未 `pkill`。

---

## §9 产物清单

- 报告：`docs/audit/s48-b22-fixture-audit.md`（本文件）
- 产物目录：`backend-ts/.s48-artifacts/s48-20261007T004948Z/`
  - `schema.json`（全表结构 + 行数 + 54 FK）
  - `fixtures.json`（逐表逐模式粗口径）
  - `refined.json`（逐表精化口径 + 被引用父表引用分布）
  - `refs.json` / `zeroref.json`（引用面 + 逐行零引用/有引用）
  - `rows-dump.json`（关键表逐行 dump）
  - `visible-face.json`（prod 可见面逐条判定）
  - `prod-health.json` / `prod-task_all.json` / `prod-prize_all.json` / `pg-*.json`（prod 公开 GET 原始响应）
  - 探针：`p1-schema.cjs` · `p2-fixtures.cjs` · `p3-rows.cjs` · `p4-refs.cjs` · `p5-zeroref.cjs` · `p6-visible.cjs` · `p7-refined.cjs`（全部**只读**，源码内含只读自证注释）
