# P6-TR0 · 多语言内容与翻译管线取证（Kong｜只取证不裁决）

- 日期：2026-10-01（CST）｜仓库：`/Users/kevin/bistro/seafood`
- 本单边界：**只取证**。未改 `src/**`、`migrations/**`、`frontend/**`、spec、`.env.local`、`vercel.json`、既有 audit；未跑任何 DDL/DML；未用 `git`/`vercel`/`npm install`/`execute_code`/`pkill`。
- 本单新增文件（仅三处）：`docs/audit/p6-i18n-content-triage.md`（本件）、`backend-ts/scripts/p4z-p6i18n-00-schema.ts`（只读探针）、`backend-ts/.p4-artifacts/p6i18n-probe/schema.json` + `schema.err`（原始读数）。

---

## §0 结论速览（含 ★ 关键反证）

**★ 需求前提被证伪**：任务书假设「库里三语列本来就存在但永远是空串」。**实测不成立**——
1. **迁移面 0 条三语列**：`grep -rn -E "_(en|hk|vn)\b" backend-ts/migrations/*.sql` → **零匹配**（唯一含 `_en` 的命中是 `0014_job_flow.sql:93 job_application_status_enum` 之类的假阳性）。19 个迁移文件（0001–0017、0019、0020）**没有任何 `*_en/_hk/_vn` 列声明**。
2. **库侧也没有这些列**：只读探针（`information_schema.columns`）→ `trilingual_cols: []`。`public` schema 真实基表 **21 张**（`account, admin_permission, admin_role, admin_role_permission, admin_user_role, app_config, commission_policy, currency, currency_status_log, job, job_application, job_submission, ledger_entry, ledger_owner, listing, listing_order, market_order, market_trade, referral, schema_migration, users`）；`job` / `listing` 的内容列就是 **`title` / `description`（text, NOT NULL DEFAULT '')**，没有三语兄弟列。
3. **生产返回的空串是「取值回落」，不是「列空」**：`database.ts:106 toStringValue` 在 `value === undefined` 时 **return `''``**；而 mapper 读的键（`database.ts:604-609` `title_en/hk/vn`、`note_en/hk/vn`；`566-571` `name_en/hk/vn`、`description_en/hk/vn`）在查询结果里**根本不存在** ⇒ 恒为 `''`。
4. **生产端已复现**（浏览器路径，绕开本机 `*.vercel.app` DNS 劫持）：`GET https://seafood-opal.vercel.app/api/task/all` 首行 `"title":"p4b2:fixture:A"` 而 `"title_en":"" ,"title_hk":"" ,"title_vn":"", "note_en":"",…`；`GET …/api/prize/all` 同类（`name` 有值、`name_*`/`description_*` 全空）。夹具 `tID:2..5` / `bID:1,2` 与本地 `.env.local` 所连库**同源**（同一 Neon 库）⇒ 探针的 information_schema 读数对生产同样成立。

⇒ **真正缺的是「列 + 写入 + 取值」三件，不只是「写入」。** 「写入时没人填」这一诊断**不完整**；若按原假设只做写入侧，落库会直接 42703（column does not exist）。

---

## §1 用户录入内容 × 三语列清单（以迁移面 + 库侧实测为准）

口径：表清单来自只读探针 `information_schema.tables`（`relkind='r'`，`public`）；三语列按正则 `(_en|_hk|_vn)$` 全表扫描。**全库命中 = 0**。

| 表名 | 用户录入内容列 | 对应三语列真名 | 是否用户录入 | 写入口 |
|---|---|---|---|---|
| `job`（读侧对外仍是 `/api/task/*`） | `title`, `description` | **不存在**（mapper 读 `title_en/title_hk/title_vn`、`note_en/note_hk/note_vn` — `database.ts:604-609`） | **是**（雇主招工） | `POST /api/job`（§2-①） |
| `listing`（读侧对外是 `/api/prize/*` 与 `/api/listing*`） | `title`, `description`, `media_urls` | **不存在**（mapper 读 `name_en/hk/vn`、`description_en/hk/vn` — `database.ts:566-571`） | **是**（卖家发布商品） | `POST /api/listing`、`POST|PATCH /api/listing/:id`（§2-②③） |
| `users` | `bio` | **不存在**（`UserRecord` 无 `bio_*`；`INSERT INTO public."users" (uid, evm, bio, …)` `database.ts:814`） | **是**（个人资料） | `POST /api/user/profile`（§2-④） |
| `currency` | `name` | **不存在** | **是**（建币种） | `POST /api/currency`（§2-⑤） |
| `job_submission` | `deliverable`（交付物正文） | **不存在** | 是（worker 提交） | `POST /api/job/:jobId/submit`（index.ts:1437） |
| `job_application` / `job_submission` / `market_*` / `listing_order` / `ledger_*` / `account` / `referral` / `commission_policy` / `app_config` / `admin_*` / `currency_status_log` / `schema_migration` | 非「用户录入的自然语言内容」（账本分录、状态机、金额、权限键、配置值） | **不存在** | **否** | — |

**NOT_MEASURED**：`app_config` / `admin_role` / `market_trade` / `listing_order` 的**逐列列名**本单未现取（预算内未跑列清单探针）；上表对其「是否用户录入」的判断依据 = 迁移 0016/0017 DDL 的表用途与注释（`0016_market.sql:112,159`、`0017_platform_config.sql:69,93`），**未逐列核对**。判 0 冒充空集。

**历史残留线索**：`database.ts` 里仍有针对 `prize` / `task` / `prize_item` / `asset` / `task_progress` / `shard` / `shard_transfer` 的 SQL（`FROM prize`、`UPDATE task`、`INTO task_progress`、`UPDATE asset` …），但**这些表在 live 库不存在**（探针 `legacy_tables_exist` 只命中 `users`）⇒ 相关代码为死路径，或运行时 42P01。本单仅登记，不裁决。（参照 `docs/audit/p5-missing-tables-triage.md`。）

---

## §2 写路径清单（真源 = `backend-ts/src/index.ts` 路由 → service）

| # | 端点（`index.ts`） | 调用链（含 `文件:行号`） | 落库方式（决定 `waitUntil` 挂点） |
|---|---|---|---|
| ① | `POST /api/job` — `index.ts:1374` | `publishJob`（`job-funds-service.ts:149`）→ `DatabaseService.jobPostEvent(payload)`（`job-funds-service.ts:195`）→ DB 函数 `job_post_event`（0013/0020） | **单一 DB 函数单次调用**：`title`/`description` 在函数体内的 job INSERT 里成对出现 ⇒ **天然单点**，`waitUntil` 只需挂在 `publishJob` 返回处（`job-funds-service.ts:197-200` 拿到 `row` 之后） |
| ② | `POST /api/listing` — `index.ts:1507` | `createListing`（`listing-service.ts:164`）→ `DatabaseService.createListingRow`（`listing-service.ts:196`；实现 `database.ts:1526`，`INSERT INTO public.listing (seller_uid,cid,price,stock,title,description,media_urls,status,create_key)` — `database.ts:1544`） | **单条 `INSERT … RETURNING`**（一次 `sql`` 模板调用）⇒ 返回值即含新 `listing_id`，可单点挂 `waitUntil` |
| ③ | `POST /api/listing/:listingId` — `index.ts:1533`；`PATCH /api/listing/:listingId` — `index.ts:1560` | `updateListing`（`listing-service.ts:222`）→ `DatabaseService.updateListingRow`（`listing-service.ts:259`；实现 `database.ts:1565`，`UPDATE public.listing AS l …` — `database.ts:1593`） | **单条 `UPDATE … RETURNING`**（内含 `guarded` 状态闸 CTE）⇒ 仅当 `outcome='ok'` 才真改内容，`waitUntil` 需以「实际变更」为条件 |
| ④ | `POST /api/user/profile` — `index.ts:481` | `DatabaseService.updateUserProfile(uID,{bio})`（`index.ts:492`） | 单语句 UPDATE（`users.bio`；该表无 `bio_*` 列） |
| ⑤ | `POST /api/currency` — `index.ts:1297` | currency-service → `database.ts:1370` `INSERT INTO public.currency (symbol, name, owner_uid, decimals, status, deposit_cid)` | 单条 CTE INSERT（`name` 为唯一自由文本） |
| ⑥ | **已下线，非写入口**：`POST /api/admin/task/create|update|delete`（`index.ts:1034/1038/1042`）、`POST /api/admin/prize/create|update|delete`（`index.ts:1046/1053/1060`） | 一律 `sendGone`（`ADMIN_TASK_SUNSET` / `ADMIN_PRIZE_SUNSET`） | 恒 410，**不得**作为翻译挂点 |

**「当前没有任何写入口」的三语列 = 全集（12 个键名）**：
`job.title_en/title_hk/title_vn/note_en/note_hk/note_vn`、`listing.name_en/name_hk/name_vn/description_en/description_hk/description_vn`；外加 `users.bio_*`、`currency.name_*`（后者连 mapper 都没读）。
**原因不是「有列但没人写」，而是这些列在库与迁移面都不存在**（§0 反证）⇒ 这一问的答案是空集，且**任何写入代码在加列之前都会 42703**。

---

## §3 前端读点清单（`frontend/src/**`）

扫描口径：`grep -rn -E "_(en|hk|vn)\b" frontend/src`（全量命中见下）。**只有 3 个文件读三语列**。

| 文件:行号 | 是否读三语列 | 状态 | 依据 |
|---|---|---|---|
| `pages/HomePage.jsx:40,42,44,47,49,51,69,71,73,76,78,80` | 是（12 处：`task.title_*`×3、`task.note_*`×3、`prize.name_*`×3、`prize.description_*`×3） | **已接**（`?? 中文回落`） | `grep` 命中 12 行 |
| `pages/TaskPage.jsx:52,54,56,59,61,63` | 是（6 处：`task.title_*`、`task.note_*`；`enrichTask`） | **已接** | `TaskPage.jsx:50-66` |
| `pages/RewardPage.jsx:79,81,83,86,88,90` | 是（6 处：`reward.name_*`、`reward.description_*`） | **已接** | `grep` 命中 6 行 |
| `pages/jobs/JobDetailPage.jsx:114` | 否（`job.title`） | **未接** | 单语直读 |
| `pages/jobs/PublishJobPage.jsx:49-50,90,102` | 否（录入 `title`/`description` 单语提交） | **未接**（写侧） | `title: form.title.trim()` |
| `pages/jobs/JobReviewPage.jsx` | 否（全文无三语读；仅 `:15` 注释提到 `0013`） | **未接**（本页不渲染标题正文） | `grep` 无命中 |
| `pages/listings/ListingDetailPage.jsx:67,88` | 否（`row.title ?? row.name`、`row.description`） | **未接** | 单语直读 |
| `pages/listings/ListingsPage.jsx:108` | 否（`row.name ?? row.title`） | **未接** | 单语直读 |
| `pages/listings/PublishListingPage.jsx:45-46,102,118` | 否 | **未接**（写侧） | 单语提交 |
| `pages/market/MarketPage.jsx` | 否（`:167` 仅栏目标题 `t('market.title')`） | **未接**（本页无用户正文渲染） | `grep` 无内容命中 |
| `pages/ProfilePage.jsx:59-60,154-155` | 否（`bio` 单语；且库无 `bio_*` 列） | **未接** | `grep` 无 `_en/_hk/_vn` |
| `pages/ShardPage.jsx` / `DashboardPage.jsx` / `AuthPage.jsx` / `ThemePreviewPage.jsx` / `pages/admin/**` / `components/**` | 否（0 命中） | **未接** | 全量 `grep` 仅上述 3 文件命中 |

> 注：`frontend/dist/assets/index-BO_DL_Oe.js` 亦命中（构建产物；与 master-plan v0.110 记录的生产 bundle 同哈希）⇒ 生产前端**含** `HomePage` 的三语回落逻辑，但库里无列 ⇒ 语言切换时「卡片仍是简体中文」的现象与 §0 的机制一致。

---

## §4 新增 `0021_*.sql` 对「一键重置键」的连带影响

**重置键本体**（master-plan `docs/seafood.master-plan.md:1919` 裁定）：
`npx ts-node --transpile-only backend-ts/scripts/p3x-00-rebuild-replay.ts --apply --confirm-irreversible`
（**「重置」只许 Zang 执行并留痕，子代理不得触发** ⇒ 本单未跑 apply，也未跑 dry-run。）

### 4.1 现取写死点（`grep` 实测）

| 位置 | 内容（现取） |
|---|---|
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:57-60` | `const VERSION_ORDER = ['0001'…'0017','0019','0020']` —— **19 项，0018 缺** |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:625` | `add('schema_migration.row_count', '19', …)` —— **预期行数写死 19** |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:8` | 注释「按序重放 `migrations/0001..0020`（**0018 缺**）」 |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:62-65` | `TABLES_ZERO_EXPECTED = ['users','referral','ledger_entry','job','job_application','job_submission','listing','listing_order','market_order','market_trade']`（**业务表行数期望全 0**）；`M0017_TABLES` 6 张全 0 |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:626` | `add('triggers.non_internal', '43', …)` —— **触发器数写死 43** |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:540-545` | 表差集对拍：库内基表 vs 文件声明（`extraTables` / 缺表都会进 diffs） |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:842` | `summary.version_order_ok = JSON.stringify(files.map(f=>f.version)) === JSON.stringify(VERSION_ORDER)` |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts:784-792` | `gate.ok = replay_ok===true && injected===false && …`；`canCommit = mode==='apply' && confirmIrreversible && gate.ok===true` |
| `backend-ts/scripts/p3y-01-post-apply-verify.ts:37` | **另一份** `VERSION_ORDER`，只到 `'0017'`（**已过期**，与 p3x 不一致） |

### 4.2 若新增 `0021_*.sql` —— 必须同步修改的精确清单

1. **`p3x-00-rebuild-replay.ts:57-60`** `VERSION_ORDER` 追加 `'0021'`（否则 `:842 version_order_ok` 立即 false，`gate.ok` 判负、COMMIT 被闸）。
2. **`p3x-00-rebuild-replay.ts:625`** `schema_migration.row_count` 期望 `'19'` → **`'20'`**（现有迁移数 = 19：0001–0017 + 0019 + 0020，**0018 不存在**）。
3. **`p3x-00-rebuild-replay.ts:8`** 头注释版本区间同步（文档口径，避免下一个人按 0018 找文件）。
4. **表差集期望**（`:540-545`）：若 0021 新建表 → 文件已声明，无需再改；若 0021 **未在文件里 CREATE 而只是在库里存在**则该表会进 `extraTables` 判负 —— **新增列（ALTER TABLE ADD COLUMN）不受表差集影响**。
5. **`TABLES_ZERO_EXPECTED` / `M0017_TABLES`（`:62-65`）**：仅当 0021 触碰这 16 张表**行数语义**时才需改；**加列不改行数期望**（job/listing 仍期望 0 行）。
6. **触发器等其它写死计数**（`:626 triggers.non_internal='43'`）：0021 若 `CREATE TRIGGER`，须同步该期望。
7. **`p3y-01-post-apply-verify.ts:37`** 的独立 `VERSION_ORDER`（停在 0017）：本单**未核**其是否仍有活的执行引用 ⇒ 与 0021 的连带关系 **NOT_MEASURED**。
8. ⚠️ **重建基线 ≠ 当前库**：`TABLES_ZERO_EXPECTED` 期望 `job`/`listing` **0 行**，而 live 库实测 `job=19 行（title 非空 19）`、`listing=18 行（title 非空 18）`（探针 `job_counts`/`listing_counts`）⇒ 重置键重建回的是 **seed 基线（业务表全 0）**，会**清掉现有 19+18 条内容行**。若 0021 只是加三语列，重建后这些列自然为空 —— 但**存量内容也随之消失**，需先想清「存量回填」与「重置」的先后。

### 4.3 验证方式（**本单未执行** ⇒ 实跑读数 NOT_MEASURED）

```
npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run
```
- 判据：stdout 出现 `gate.ok=true`（来源：`p3x-00-rebuild-replay.ts:893` `console.log(\`gate.ok=${gate.ok} reason=${gate.reason}\`)`，判定逻辑 `:784-791`）**且** summary 内 `version_order_ok: true`（`:842`）。
- dry-run 语义：MODE 非 apply ⇒ 事务收尾一律 ROLLBACK（`:791-792`），不写库、不改文件。
- **NOT_MEASURED**：本单预算内未跑该命令 ⇒ **没有** `gate.ok` / `version_order_ok` 的实测读数。**不填 0/空。**

---

## §5 附加：DeepSeek 官方接口契约核对（联网实测）

本机 `web_extract` 对 `api-docs.deepseek.com` 被拦（返回 “Blocked: URL targets a private or internal network address”，与已知本机 DNS 劫持一致）；改用**浏览器驱动**路径成功取到官方文档原文。

| 项 | 实测读数（官方文档原文） | 结论 |
|---|---|---|
| 端点 | `POST https://api.deepseek.com/chat/completions` | ✅ OpenAI 兼容形态成立 |
| `model` | **REQUIRED**；`Possible values: [deepseek-flash, deepseek-v4-pro]` | ⚠️ **文档枚举里没有 `deepseek-v4-flash`** ⇒ 决策里写的默认模型名**需以 `GET /models` 现取复核**，否则可能 400/422 |
| `messages` | **REQUIRED**，`object[]`，`>=1`；role ∈ `[system, user, assistant, tool]` | ✅ |
| `response_format` | `{"type":"json_object"}` 支持 JSON Output；**警告**：须自行在 system/user 消息里要求输出 JSON，否则可能产出无限空白直至 token 上限；`finish_reason="length"` 时内容可能被截断 | ✅ 可用，但**必须配合提示词**，且要处理截断 |
| 其它相关参数 | `max_tokens`（1…384K；不设默认 8K 非思考 / 64K 思考）、`thinking{type:enabled|disabled}`、`reasoning_effort(none|low|high|max)`、`stop` | 供成本闸参考 |
| 错误码 | `400` Invalid Format / `401` Authentication Fails / `402` Insufficient Balance / `422` Invalid Parameters / `429` Rate Limit Reached / `500` Server Error / `503` Server Overloaded | ✅ 已现取；**失败不阻塞提交**的兜底应覆盖 402/429/5xx |
| `GET https://api.deepseek.com/models` | 返回 `{object:"list", data:[{id, object:"model", owned_by, name, context_window, max_output_tokens, input_modalities, …}]}` | 可用于运行时校验 `model` 合法性 |
| **限流具体额度（RPM/TPM 数值）** | **NOT_MEASURED** —— 只确认存在 “Rate Limit & Isolation” 文档页与 `429` 语义，**未取具体数值** | 不填数 |

---

## §6 探针自曝 / NOT_MEASURED / 边界自证

**探针自曝**
- 探针脚本：`backend-ts/scripts/p4z-p6i18n-00-schema.ts`，连库方式复用仓库既有 `readQuery`（`src/db.ts:226`，pooler 只读单语句；dotenv 在 `src/db.ts:22-24` 内部加载 `.env.local`，**脚本与我都未打印任何连接串/密钥值**）。
- 退出码口径：权威一次运行 `npx ts-node --transpile-only scripts/p4z-p6i18n-00-schema.ts > schema.json 2> schema.err`（**无管道**）→ `EXIT=0`，`schema.json` 4855 字节、`schema.err` 0 字节。首轮曾用 `| head -140` 查看，**该轮退出码不采纳**（管道后读数不作判据）。
- 口径自证：表集合 = `pg_class.relkind='r'` ∩ `nspname='public'`（21 张）；三语列 = `information_schema.columns` 且 `column_name ~ '(_en|_hk|_vn)$' OR ~ '^(en|hk|vn)$'`（命中 0）。行数读数：`job` 19 行 / `listing` 18 行，均为 `count(*)` 全表。
- 生产复现口径：`GET https://seafood-opal.vercel.app/api/task/all`、`/api/prize/all`（浏览器路径取 `document.body.innerText`，只读；未带任何 token）。

**NOT_MEASURED（禁填 0/空）**
1. `p3x-00-rebuild-replay.ts --dry-run` 的 `gate.ok` / `version_order_ok` **实跑读数**。
2. `p3y-01-post-apply-verify.ts:37` 过期 `VERSION_ORDER` 是否仍被活引用（及其对 0021 的影响面）。
3. `app_config` / `admin_role` / `market_trade` / `listing_order` 等的**逐列列名**与「是否用户录入」的逐列判定。
4. DeepSeek **限流具体额度**（RPM/TPM）。
5. 本单**未**调用 `GET /models` 现取 → `deepseek-v4-flash` 是否为合法 model id **未裁定**（仅记录：chat-completions 文档的 `model` 枚举只列 `deepseek-flash` / `deepseek-v4-pro`）。

**边界自证（本单写过的路径，仅此三类）**
- `docs/audit/p6-i18n-content-triage.md`（本报告）
- `backend-ts/scripts/p4z-p6i18n-00-schema.ts`（只读探针）
- `backend-ts/.p4-artifacts/p6i18n-probe/schema.json`、`schema.err`
- 未执行：`git add/commit/push`、任何 DDL/DML、`vercel` 子命令、`npm install`、`execute_code`、常驻 server、`pkill`/`killall`、`--apply`。未读取/未打印 `.env.local` 的值（仅确认变量名存在：`DATABASE_URL`/`DATABASE_URL_UNPOOLED`/`POSTGRES_URL`/`POSTGRES_URL_NON_POOLING`/`PG*`/`SECRET_KEY`；**无 `DEEPSEEK_*` 变量名**——此为变量名清单，值未读）。
