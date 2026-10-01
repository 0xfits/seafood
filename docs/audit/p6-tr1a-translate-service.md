# P6-TR-1a 验收报告 · 翻译服务层 + 迁移 0021

- **单号**：TR-1a（Kong）｜**日期**：2026-10-01｜**分支**：`main`（**未 commit / 未 push**）
- **范围**：迁移 `0021` + `src/translate-service.ts` + 重置脚本同步 + 离线单测。**不含**：路由挂载 /
  `waitUntil` / vercel cron / mapper 合并（全属 TR-1b）。
- **一句话结论**：两个新文件 + 迁移落盘、**80/80 离线单测全绿**、`npx tsc --noEmit` = **0 行（exit 0）**、
  **未 apply 迁移**、**未触库**（Δledger_entry = 0）、**未触碰 `frontend/**`**、新增依赖仅 `opencc-js`。

---

## 1. 交付物与指纹（sha256 全值，`shasum -a 256` 现取）

| 文件 | 行数 | sha256 | 变更 |
|---|---|---|---|
| `backend-ts/migrations/0021_content_translation.sql` | 164 | `223125d15b3b96416c1a4ea1bc6314c785499cd8184cde70b7e92c93c5382f20` | 新增 |
| `backend-ts/src/translate-service.ts` | 879 | `783378523cf51fe5b1a3b82e41e38c2f371ad18f6059cade96141cdb0416e87d` | 新增 |
| `backend-ts/scripts/p4z-tr1a-01-offline-tests.ts` | 415 | `93c88398be8373ade3c74a7a99d4f7eb632afa2ffb98c95601a5faf755c80ea1` | 新增 |
| `backend-ts/scripts/p3x-00-rebuild-replay.ts` | 985 | `1d28fb127bd80e674c3c9147681fcac999ceba2db7bbc2a6218663bd9bbff176` | **+2/−1** |
| `backend-ts/package.json` | — | `12b399024a6dde2f2a33683d54758399cf2da8e58e3175a04ae1e9c727fc9b1b` | **+1**（`opencc-js ^1.4.2`） |
| `backend-ts/package-lock.json` | — | `d05ca1acd7668af009e22a855d94da2ffba5d88c02f6c3990708cdb21710eb71` | lock 同步 |
| `docs/audit/p6-tr1a-translate-service.md` | 本文件 | — | 新增 |

产物：**末轮（全部改动落盘后重跑）** `backend-ts/.p4-artifacts/p6tr1a-20261001T013421Z/offline-tests.json`
= **80/80**；首次全绿轮 `…T013244Z/offline-tests.json` = 80/80。
另有**两轮失败留痕**（`…T013119Z` 58/80、`…T013226Z` 79/80）—— 按自曝纪律**保留不删**，见 §6.1。
四轮 artifact 目录均在 `.p4-artifacts/p6tr1a-*/`（白名单内）。

---

## 2. 迁移 `0021_content_translation.sql`

### 2.1 两张表（**纯新增**，不改任何既有表）

**`public.content_translation`** —— 译文真源 + 状态位

| 列 | 类型 | 语义 |
|---|---|---|
| `entity_type` | text NOT NULL | 内容对象类型（job / listing / user / currency） |
| `entity_id` | text NOT NULL | 业务主键字符串化（`job_id` / `listing_id` / `uid` / `cid`） |
| `field` | text NOT NULL | 字段名（title / description / bio / name） |
| `lang` | text NOT NULL | 目标语言（en / vn / hk）；**zh 是源语言，永不入表** |
| `text` | text NULL | 译文正文；非 ready ⇒ 允许 NULL（**失败留空**） |
| `status` | text NOT NULL DEFAULT 'pending' | `pending\|ready\|failed\|deferred` |
| `attempts` | int NOT NULL DEFAULT 0 | 已尝试次数（`attempts < N` 才再试） |
| `last_error` | text NULL | 机读 reason + 摘要（**不含用户全文**） |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | 写入/重试时刻；**日限额计数分母** |

- **幂等键** = `PRIMARY KEY (entity_type, entity_id, field, lang)` ⇒ 一行一字段一语言，upsert 幂等。
- 具名 CHECK（**不用枚举类型**，新增态免 `ALTER TYPE`）：`content_translation_status_enum`、
  `content_translation_lang_enum`（en/vn/hk）、`content_translation_attempts_nonneg`、
  `content_translation_ready_has_text`（**status='ready' ⇒ "text" 必须非空** = 红线「不写脏数据」的结构级兜底）。

**`public.translation_cache`** —— 按源文本去重

`src_hash`(sha256 hex) / `src_lang`(默认 'zh') / `tgt_lang` / `text_out` / `engine`(deepseek|stub|opencc) / `created_at`；
**幂等键** = `PRIMARY KEY (src_hash, src_lang, tgt_lang)`；CHECK：`text_out` 非空、`tgt_lang <> src_lang`。

### 2.2 索引（3 个，均 `IF NOT EXISTS`）

1. `content_translation_pending_idx (status, updated_at) WHERE status IN ('pending','failed')` —— `backfillPending` 扫描。
2. `content_translation_updated_at_idx (updated_at)` —— 日限额计数（`date_trunc('day', now())` 过滤）。
3. `translation_cache_tgt_lang_idx (tgt_lang, created_at)` —— 运维按语言统计。

### 2.3 两项**有意不加约束**的决定（登记）

- **`entity_type` / `field` 故意不加 CHECK**：依据 master-plan §5.111 G ——「四类内容一套表统一，
  将来新增内容类型**免 ALTER**」。加 CHECK 会把「免 ALTER」直接作废。
- **`lang` 加 CHECK（en/vn/hk）**：四个 UI 语言是产品固定集（zh 为源），加闸的收益 > 将来新增语言时
  一次 `ALTER TABLE … DROP/ADD CONSTRAINT` 的成本。**这是一处判断，不是 spec 原文**，单列登记。

### 2.4 本迁移不做（自证读数）

- **不建任何触发器** ⇒ 重置脚本 `p3x:626 triggers.non_internal` **仍 = 43，未改**（见 §3）。
- **无 BEGIN/COMMIT**（`scripts/migrate.ts` 对每文件单事务包裹；文件内自开事务会嵌套）。
- **无 `DO $$` / 无动态 DDL**：`p3x` 的期望对象由 `stripSql()` 词法剥离注释后抽取（`p3x:116/:179/:281`），
  动态建对象会被漏 ⇒ 一律静态 DDL。
- 实测 grep（去注释后）：`^CREATE TABLE` = **2**、`^CREATE INDEX` = **3**、全文 ASCII `TRIGGER` = **0**。
- 保留字**双口径**：列名 `text` 与类型名同名 ⇒ CHECK 表达式**显式加引号**（`"text"`）。
  读数：未加引号的列定义 = 1 处、加引号的表达式引用 = 3 处（`"text" IS NOT NULL` / `btrim("text")` / 注释）。

### 2.5 apply 步骤（**本单不执行**，移交 TR-1c / 集成单）

```bash
cd backend-ts
npx ts-node --transpile-only scripts/migrate.ts --status    # 应用前：确认 schema_version = 0020、19 行
npx ts-node --transpile-only scripts/migrate.ts             # 应用未执行迁移（单文件单事务；失败整文件回滚）
npx ts-node --transpile-only scripts/migrate.ts --status    # 应用后：schema_version = 0021、20 行
```

应用后**必须**复核（`0021` 只新增两表三索引、零触发器）：
`public_base_tables` +2、`content_translation`/`translation_cache` 行数 = 0、`triggers.non_internal` **仍 43**、
`schema_migration` = **20**。任何一项不符 ⇒ 用 `0021` 之前的快照回退并立案。

---

## 3. 重置脚本同步 `p3x-00-rebuild-replay.ts`（**只改脚本，未跑 apply**）

| # | 位置 | 改前 | 改后 | 依据 |
|---|---|---|---|---|
| 1 | `:57-61 VERSION_ORDER` | 19 项（…`'0020'`） | **+ `'0021'`（20 项）** | `:842 version_order_ok` 用 `files.map(version)` 对拍目录内 `.sql` |
| 2 | `:625 schema_migration.row_count` | `'19'` | **`'20'`** | 现库 19 行（0001–0017 + 0019 + 0020）→ 应用 0021 后 20 行 |
| 3 | `:626 triggers.non_internal` | `'43'` | **不变** | **本迁移零触发器** ⇒ 期望值不受影响（已在上方 §2.4 给出零触发器读数） |

- git 现取：`p3x-00-rebuild-replay.ts` **+2/−1**（两个 hunk，逐字见 `git diff`）；其余 983 行零改动。
- **未改** `:842 version_order_ok` 与 `:784-792 gate.ok/canCommit`：二者是**派生逻辑**，无硬编码常量。
- **未跑** `--apply` / `--dry-run`（本单禁 apply；dry-run 亦需库连接，交 TR-1c 端到端时执行）。

### 3.1 过期副本 `p3y-01-post-apply-verify.ts:37` —— **只登记，未改**

- 该文件 `:37` 另有一份 `VERSION_ORDER`，**只到 `'0017'`**，与 `p3x` 不一致。
- **「是否仍被活引用」grep 读数**（`grep -rn "p3y-01-post-apply-verify" --include=*.ts --include=*.js --include=*.json --include=*.sh .` 排除其自身文件后）：
  **0 命中** ⇒ 没有任何代码/脚本/配置 import、spawn 或引用它；现存命中**全是文档叙述**
  （`docs/seafood.master-plan.md`、`docs/audit/p3-d20-rebuild-apply.md`、`docs/audit/p6-i18n-content-triage.md`）。
- ⇒ **裁定建议**：它是一次性事后对拍脚本（D20 重建那一轮用），**当前无活执行路径**；`0021` 的连带同步
  **不需要**改它。若 TR-1c 仍要复用它，必须先刷新该 `VERSION_ORDER` 到 20 项，否则它会拿 17 项期望对拍 20 项现状。
  **本单按派单要求只登记、不改。**

---

## 4. `src/translate-service.ts` 设计要点

### 4.1 引擎分工

- `en` / `vn` → **DeepSeek**（OpenAI 兼容 `POST {base}/chat/completions`）。
- `hk` → **OpenCC 简繁转换**（`toTraditional()`，**确定性转换、不是翻译**）。
  转换器为**模块级单例**（`getTraditionalConverter()`，首次调用建一次并复用，**不每次重建**）。

### 4.2 环境变量（**只读变量名；`.env.local` 不读、不打印**）

`DEEPSEEK_API_KEY`（必填）· `DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）·
`DEEPSEEK_MODEL`（默认 `deepseek-flash`）· `TRANSLATE_ENGINE`（`deepseek|stub`，默认 `deepseek`）·
`TRANSLATE_MAX_CHARS_PER_ITEM`（默认 2000）· `TRANSLATE_DAILY_ITEM_CAP`（默认 500）。

- **key 值零暴露**：`TranslateServiceConfig` **只有 `api_key_present: boolean`，没有 `api_key` 字段**
  （单测 J6/J9 断言）；key 仅在 `callDeepSeek()` 内即时从 env 取用。
- **无 key 自动回落**：`requested_engine='deepseek'` 但 key 缺失 ⇒ 生效 `engine='stub'` +
  `fallback_reason='NO_API_KEY: …'`，并**告警一次**（模块级一次性闸）。
- **模型名不可用**：DeepSeek 返 400 且正文含 model-not-exist 特征 ⇒ 抛
  `TranslationError(reason='MODEL_NOT_AVAILABLE')`（**机读 reason**，便于一句 `DEEPSEEK_MODEL=` 修复）。

### 4.3 三重校验（逐条实现、逐条可单测）

| # | 规则 | 判负机读 reason | 判负单测 |
|---|---|---|---|
| ① | JSON 可解析 + 顶层键集 == 输入字段集 + 每值非空 | `JSON_PARSE` / `KEY_SET_MISMATCH` / `EMPTY_VALUE` | C1 / C2 / C3、H4 |
| ② | 长度比例 ∈ **[0.3, 3.0]**（分母 = 源文本码点数） | `LENGTH_RATIO` | C4（过短）/ C5（过长） |
| ③ | `vn` 须含越南语拉丁扩展（声调）；`en` 非 ASCII 占比 > 0.30 判负 | `CHARSET` | C6（en 中文污染）/ C7（vn 丢声调）/ C10 |

**豁免（有意为之，均有正例单测）**：`vn` 在**源无 CJK**（C8）或**源为单字**（C9）时豁免字符集闸——
避免把「¥100」「Nike」「店」这类本就无需翻译的源误判；`en` 在**译文本身不含 CJK** 时豁免——
币符号/品牌名/URL 允许非 ASCII。
任一不过 ⇒ 该字段 `failed` + `last_error`，**不落库、不写缓存**（H4/H5/H6 断言 `text IS NULL` 且缓存为 0）。

### 4.4 成本闸（两道，均**不烧 attempts**）

- **闸 ① 单条字符上限**：整批源文本码点总数 > `TRANSLATE_MAX_CHARS_PER_ITEM` ⇒ 整批 `deferred` +
  `ITEM_TOO_LONG`（F1/F2 断言**不调用引擎**）。
- **闸 ② 日条数上限**：`countToday()`（由 `content_translation` **当日 `updated_at` 行数派生**，
  **不新建计数表**）+ 本批投影条数 > 日上限 ⇒ 整批 `deferred` + `DAILY_CAP_REACHED`（E1–E3）；
  **边界**：`used + projected == cap` **放行**（E5）。deferred 写入**不增 `attempts`**（E4），
  避免限流把重试次数烧光。

### 4.5 缓存与幂等

写前按**源文本 sha256 + tgt_lang** 查 `translation_cache` ⇒ 命中直接用（**不再付费**，D1/D2 断言
`fetch.calls=0`）；未命中才调引擎，成功则 upsert 回缓存（D8）。**部分命中**只请求缺失语言
（D5/D6/D7：请求体 `targets` 仅含 `vn`、`fields` 仅含 `title`）。

### 4.6 网络与安全

- `AbortController` **15s 超时**（`REQUEST_TIMEOUT_MS`）+ **仅 429/5xx 重试一次**（H9/H10 断言
  `calls=2`；H8 断言 400 不重试；H11 429→200 重试成功；H12 429×2 收 `RATE_LIMITED`）。
- **不记录任何请求/响应全文**：响应体只用于 `res.ok` 判定与「模型不存在」正则匹配，随即丢弃；
  错误消息只带 HTTP 状态与机读 reason。K2 断言产物中不含 `Bearer <8+ 字符>` 形态令牌。

### 4.7 `stub` 模式与 `backfillPending`（本单只落函数，不接路由）

- `stub` 输出 `[en] `+原文（确定性）；**刻意跳过三重校验**（它是测试替身，G6 专门断言
  stub 输出**本身过不了**真校验 ⇒ 证明三重校验是真闸而非恒真）。
- `backfillPending(limit, opts)`：扫 `status IN ('pending','failed') AND attempts < 5`，**按实体分组**后
  走同一 `translateFields` 路径；源文本由 `SourceResolver` 提供（生产实现 `createDbSourceResolver()`
  用**白名单表/列 + 参数化 id**，覆盖 job/listing/users/currency）；`countToday` 等 PB 走只读池，
  写走 `withTransaction`。
- **存储端口化**：DB 访问全部藏在 `TranslateStore` 端口后（`createDbStore()` 是生产实现），
  离线单测注入内存实现 ⇒ **import 本模块零 IO 副作用**（`require('./db')` 只在 `loadDb()` 内惰性发生）。

---

## 5. 离线单测 / 探针

**命令**：`cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts`
**结果**：`SUMMARY total=80 passed=80 failed=0`，**exit 0**（末轮 `…T013421Z` 于**全部改动落盘后**重跑取得，
见 §1 产物）。
**口径**：无需 key（仅注入测试哨兵到进程 env）、**不连库**（0 次 DB 连接）、不读 `.env.local`。

| 组 | 条数 | 覆盖 |
|---|---|---|
| `opencc` | 5 | 人民币⇒人民幣、繁体化测试⇒繁體化測試、确定性、非中文原样、整句 |
| `prompt` | 7 | 只输出 JSON / 禁 markdown 围栏 / 保留数字价格币符号 / URLs / 键集与目标语言 |
| `validate` | 15 | 三重校验**逐条判负** + 两条豁免 + 正例 + 围栏剥离 |
| `cache` | 8 | 全命中不付费 / 部分命中只请求缺的语言 / 混合来源合流 / 写回 |
| `cap` | 7 | 日限额超限 + **边界放行** + attempts 不烧 / 单条字符上限 |
| `stub` | 7 | end-to-end + 幂等 + **stub 输出判负（证明校验非恒真）** |
| `deepseek` | 15 | 正常 / 键缺不写脏数据 / **MODEL_NOT_AVAILABLE** / 5xx 重试 / 429 重试成功 / 429×2 / 无 key |
| `backfill` | 5 | 重试成功 + attempts 递增 / 达上限不扫 / 源解析失败跳过 / 二次幂等 |
| `config` | 9 | 无 key 回落 / 有 key / 显式 stub / 自定义 + 尾斜杠剥离 / **key 零泄漏** |
| `secure` | 2 | 产物不含任何 key 值 / 不含 Bearer 令牌 |

---

## 6. 红线自证

### 6.1 退出码与自曝

① **`npx tsc --noEmit`**：`> /tmp/tsc_final.txt 2>&1; echo $?` ⇒ **`TSC_EXIT=0`**，**0 行**（直接重定向取值，不经管道）。
② **`npx tsc -p tsconfig.scripts.json --noEmit`** ⇒ exit 2 / **184 行**，但 `grep "p4z-tr1a\|p3x-00"` = **0 命中**
⇒ 184 条**全部是其它既有脚本的存量错误**，与本单两个文件**无关**（本单文件 0 错误）。
③ **两轮失败留痕（自曝）**：首轮 `…T013119Z` **58/80**（18 失败）、次轮 `…T013226Z` **79/80**（1 失败）。
根因两条，**均在测试侧**：**(a)** deepseek 分支需 key，测试未注入 ⇒ 全部收 `NO_API_KEY`（修：加 `apiKey` 注入点 +
测试哨兵）；**(b)** D6 用「原始体含 `"vn"`」的子串断言，而请求体里的用户内容是被 JSON **转义**的
（`\"vn\"`），子串根本不匹配 ⇒ 改为**解析后**断言 `messages[1].content` 的 `targets`，比原断言更强。
两轮产物**保留未删**。

### 6.2 未触库 / Δledger_entry = 0

- 本单**没有发起任何 DB 连接**：离线脚本全程注入内存 `TranslateStore`（0 次连接）；
  `src/translate-service.ts` 中 `postgres://` / `DATABASE_URL` / `.env.local` **命中 = 0**；
  `require('./db')` 仅出现在 `loadDb()` 内（惰性，未被触发）。
- 产物自述字段：`offline: true`、`db_connections: 0`、`api_calls: 0`。
- ⇒ **`Δledger_entry` = 0**；**未运行**任何 DDL/DML（本单唯一写库路径 = 未执行的迁移文件本身）。

### 6.3 未触碰 `frontend/**` / 其它禁区

`git status --porcelain` 现取（**未 commit**）：

```
 M backend-ts/package-lock.json
 M backend-ts/package.json
 M backend-ts/scripts/p3x-00-rebuild-replay.ts
?? backend-ts/.p4-artifacts/p6tr1a-20261001T013244Z/
?? backend-ts/.p4-artifacts/p6tr1a-20261001T013226Z/
?? backend-ts/.p4-artifacts/p6tr1a-20261001T013119Z/
?? backend-ts/migrations/0021_content_translation.sql
?? backend-ts/scripts/p4z-tr1a-01-offline-tests.ts
?? backend-ts/src/translate-service.ts
```

- `frontend/**` 命中 **0** ⇒ **前端 112 例单测未跑**，理由是**未被触碰**（本单不产生前端影响面；
  跑它只会验证与 0021 无关的既有行为）。若家长要求，可一次 `cd frontend && npx vitest run src/test/unit` 复跑。
- **未触碰**：`src/index.ts`、其它 `src/**`（除新文件）、`vercel.json`、`docs/seafood.master-plan.md`、
  任何 spec、`.env.local`、`p3y-01-post-apply-verify.ts`。
- 另有 3 项 untracked 是**本单之前就存在的他人/前序产物**（我在开工第一次 `git status` 已见）：
  `.p4-artifacts/p6i18n-probe/`、`scripts/p4z-p6i18n-00-schema.ts`、`docs/audit/p6-i18n-content-triage.md` —— **非本单产出，未动**。

### 6.4 依赖与禁令

- 新增依赖**仅 `opencc-js@^1.4.2`**（`package.json:20`；`npm install` 输出 `added 1 package`）。
- **未** `git add/commit/push`；**未** `vercel`；**未** 起常驻服务；**未** `pkill`/`killall`；
  **未** 对库执行任何 DDL/DML；**未** apply 迁移。

---

## 7. 未验证 / `NOT_MEASURED`（**不填 0、不填空**）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 真 DeepSeek 调用（网络 + 真 key + 真模型名） | **NOT_MEASURED** | 本机与 Vercel **目前无任何 `DEEPSEEK_*` 环境变量**（master-plan §5.111 J 已登记 Blocker）。`deepseek-flash` 是官方枚举默认值，**未经真调用验证**；第三方站写的 `deepseek-v4-flash` 存疑。 |
| 2 | `0021` apply 后的真实库读数（表/索引/行数/触发器 43） | **NOT_MEASURED** | 本单**禁 apply**。§2.5 给了 apply 步骤与三项必核读数。 |
| 3 | `triggers.non_internal = 43` 的**现库**值 | **转引，非本单实测** | 本单零库连接；该值是 `p3x:626` 的既有期望常量（D20 重建轮读得）。本单只主张「0021 不新增触发器 ⇒ 期望不变」。 |
| 4 | `p3x --dry-run` / `--apply` 实跑 | **NOT_MEASURED** | 需库连接，交 TR-1c 端到端。 |
| 5 | `createDbStore()` / `createDbSourceResolver()` 的真实 SQL 行为 | **NOT_MEASURED** | 端口与 SQL 已落盘，但离线单测注入内存实现 ⇒ 生产实现在**真库上未跑过**（首个真实使用点是 TR-1b 写路径）。 |
| 6 | 路由 / `waitUntil` / cron / mapper 合并 | **本单不含**（设计如此） | TR-1b。 |
| 7 | 前端「待翻译」状态位渲染 | **本单不含** | TR-2。 |

---

## 8. 给 TR-1b 的接口交接（不在本单范围，仅登记）

- 写路径调用：`translateFields(payload, { entityType, entityId, store: createDbStore() })`；
  生产无需传 `config`（默认 `getTranslateConfig()`）、无需传 `apiKey`（默认读 env）。
- 定时兜底：`backfillPending(limit)`（默认 store / resolver 均已生产化；`CRON_SECRET` 鉴权与
  `vercel.json` cron 属 TR-1b）。
- mapper 侧口径：**只认 `content_translation.status='ready'` 的 `text`**；读不到 ⇒ **回落中文原文**
  （顺带修掉 `?? ` 遇 `''` 不回落造成的空白卡片隐患）。
- 失效策略：引擎/提示词升级后按 `translation_cache.engine` 维度判断（本表**不自动过期**）。
