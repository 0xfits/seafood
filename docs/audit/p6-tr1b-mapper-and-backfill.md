# P6-TR-1b · 后端读侧回落 + backfill 端点 + cron（交付报告）

- 分支/Repo：`/Users/kevin/bistro/seafood`（后端 `backend-ts`，Vercel serverless）
- 迁移 `0021_content_translation.sql`：**未改动**（已 apply，按 §5.7-⑨ 一律不动；本单零 DDL）
- 前置（TR-1a 已 apply，本单只读复核）：基表 21→23（+2）；`schema_version=0021`；两表零触发器
- 生效引擎（实测环境）：`TRANSLATE_ENGINE=stub`（无 key 端到端；脚本内 `delete DEEPSEEK_API_KEY` 证明整链路不依赖 key）

---

## 0. 一句话结论

四项交付全部落地并**真库实测**：`createDbStore()` 真库实现已接到两张新表（TR-1a 留的接口，本单复核+补齐 hk 缺口）、
mapper 读侧合并/回落 + `i18n_status` 已接 4 个读点、`POST /api/translate/backfill` 带 `CRON_SECRET` 鉴权（fail-loud）、
`vercel.json` cron 已加。E2E **37/37 PASS（exit 0）**；`Δledger_entry=0`、`Σ(balance, cid=1)` 不变；`tsc --noEmit` **0 行**。

---

## 1. 交付物 ① `createDbStore()` 真库实现

**位置**：`backend-ts/src/translate-service.ts:735-809`（TR-1a 已落接口，本单**复核并保留**）。

- 只读写 `public.content_translation` / `public.translation_cache` 两张新表；**不碰账本、不碰任何既有表**。
- 幂等：`INSERT … ON CONFLICT (entity_type, entity_id, field, lang) DO UPDATE`（主键即幂等键）；
  `attempts = attempts + CASE WHEN EXCLUDED.status IN ('ready','failed') THEN 1 ELSE 0 END`
  ⇒ `deferred`（日限额/超长）**不烧** attempts。
- 读走 `readQuery`（pooler），写走 `withTransaction`（R55/R56 口径）——沿用本仓既有 `src/db.ts` 写法，零新增依赖。

### ★ 本单发现并修掉的真实缺口：`hk` 行此前根本不落库

TR-1a 的 `translateFields` 只遍历 `TRANSLATE_TARGETS = ['en','vn']` ⇒ **`hk` 从未写入**
（而契约要求 `hk` 行存在且为繁体）。本单补：

- `TARGET_LANGS = ['en','vn','hk']`（`translate-service.ts:213`）；
- `hk` 走 **OpenCC `toTraditional`**（确定性、不付费、不走 LLM），缓存按 `engine='opencc'` 记；
- `markAll` / 日限额投影（`fields.length * TARGET_LANGS.length`）/ 落库循环 / `TranslateFieldsOutput` 的
  `texts|statuses|errors` 类型（`TranslateLang` → `TargetLang`）全部随 `hk` 归位。

---

## 2. 交付物 ② mapper 合并 + 回落 + `i18n_status`

### 2.1 已改（逐点枚举，`文件:行号` = 改后现状）

| # | 位置 | 改动 |
|---|---|---|
| 1 | `src/database.ts:740-819` | 新增读侧合并基建：`I18N_SPECS`（可译字段规格 + `field` 候选）、`applyI18n()`（写 `*_<lang>` + `i18n_status`）、`loadI18nIndex()`（**一条批量 SQL** 读 `status='ready'`） |
| 2 | `src/database.ts:573` | `normalizeBrand` 尾：`applyI18n('listing', bID, record, i18nIndex)` —— 原 6 处 `toStringValue(getValue(row,'name_en'…))`（恒 `''` 的造键点）**删除** |
| 3 | `src/database.ts:608` | `normalizeTask` 尾：`applyI18n('job', tID, record, i18nIndex)` —— 原 6 处 `title_en/note_en…` 造键点**删除** |
| 4 | `src/database.ts:480-482` | `normalizeBrand(row, counts?, i18nIndex?)` 签名 |
| 5 | `src/database.ts:586` | `normalizeTask(row, participantsCount?, i18nIndex?)` 签名 |
| 6 | `src/database.ts:1119` | `listBrands`：批量载入 `listing` 译文索引后传入 |
| 7 | `src/database.ts:2463` | `getBrandById`：载入 `[String(bID)]` 索引后传入 |
| 8 | `src/database.ts:1223` | `listTasks`：批量载入 `job` 译文索引后传入 |
| 9 | `src/database.ts:1254` | `getTask`：载入 `[String(tID)]` 索引后传入 |
| 10 | `src/database.ts:301/338` | `BrandRecord` / `TaskRecord` 接口新增 `i18n_status` |

**被接的 API 读侧**（4 个 mapper ⇒ 5 个端点）：`listBrands→/api/prize/all`、`getBrandById→/api/prize/:bID`、
`listTasks→/api/task/all`、`getTask→/api/task/:tID`；`/api/home`（= `listTasks` + `listPrizes`）**顺带覆盖**
（`listPrizes`/`getPrizeById` 是 `listBrands`/`getBrandById` 的别名，见 `database.ts:2466/2470`，已复核 ✓）。

### 2.2 语义（逐字实现跨片契约）

- `*_<lang>`（`title_en/hk/vn`、`note_*`、`name_*`、`description_*`）**恒有值**：有 `status='ready'` 译文用译文，
  否则**回落源文本（中文）**，**永不空串**（除非原文本身为空）。
- `i18n_status`：`ready` = 该对象**所有可译字段** × `en/vn/hk` 全部 ready；`pending` = 一个都没有；否则 `partial`。
- `zh` 是源、**永不入表**（E2E 断言 `ct.no_zh_rows` = 0）；语言后缀仅 `en/hk/vn`。
- **读失败/读不到 ⇒ 全部回落原文，绝不 500**（`loadI18nIndex` 内 `try/catch` + `console.warn`）。
- `field` 命名用**源列名**（`job.title/description`、`listing.title/description`），与 `createDbSourceResolver()`
  的白名单一致；`I18N_SPECS.src` 给候选数组（`note←note|description`、`name←name|title`）兼容两口径。

### 2.3 未接清单（返回同类内容、本单**未**接的 mapper —— 如实列出）

| 位置 | 内容 | 为什么未接 |
|---|---|---|
| `src/database.ts:471-478` | `normalizeUser` → `bio` | `UserRecord` 无 `bio_<lang>` 键，前端四语契约未定；`entity_type='user'` 无读侧出口需要它 |
| `src/database.ts:642-643` | 币种映射（`name` / `description`） | 该对象的读侧出口在 `currency-service` / `POST /api/currency/:cid/list`，不在 EVM/API 卡片面；留待后续单 |
| `src/database.ts` 的 `createTask`/`updateTask` 返回值（`normalizeTask(row, …)` 无 index） | `normalizeTask(row, …)` 无 index | **刻意**：写路径回执走「回落原文 + `i18n_status='pending'`」，与契约一致（不查库、不加延迟） |
| `task_progress.info_input`、`system_settings`、`permission_group` | 非四类可译内容 | 不在 §5.111 的四类内容（job/listing/user/currency）内 |

---

## 3. 交付物 ③ `POST /api/translate/backfill`

**位置**：`src/index.ts:1657-1699`（注册在 404 catch-all 之前）；服务层 `backfillPending` `src/translate-service.ts:836+`。

- 鉴权：`Authorization: Bearer <CRON_SECRET>` **或** `x-cron-secret: <CRON_SECRET>`（二者取一）。
- **未配 `CRON_SECRET` ⇒ `503 fail-loud`，绝不默认放行**（安全红线，E2E 已断言）。
- 不回显、不日志密钥值（只做相等比较）。
- `limit`：默认 20、上限 100（`Math.min(100, …)`），来源 `body.limit` 或 `query.limit`。
- 回执（机读）：`{ ok, processed, ready, failed, skipped, deferred, reason, scanned, retried, engine }`；
  为满足契约新增 `BackfillReport.deferred`（`translate-service.ts:194`）——`deferred` 与 `failed` **分列**
  （原实现把两者混算进 `failed`，已拆）。
- 幂等：服务层 upsert + 缓存命中不重复付费；E2E 第 2 次调用 `scanned=0`、行数不变。

---

## 4. 交付物 ④ `vercel.json` cron

```json
"crons": [ { "path": "/api/translate/backfill", "schedule": "0 18 * * *" } ]
```

- UTC 18:00 = 北京 02:00 = **DeepSeek 低峰**（省钱）。
- ⚠️ **配额登记（已在报告登记，待运维知悉）**：Vercel **Hobby 套餐 cron 仅支持「每日 1 次」且时刻精度受限**；
  若后续需要更密（如每 6 小时兜底），须 **Pro 套餐**改密（`0 */6 * * *`）。当前 `0 18 * * *` 在 Hobby 语义下 = 每日 UTC 18 点一次，**本单不依赖多次**。

---

## 5. 端到端实测（stub 模式，无 key）

- 脚本：`backend-ts/scripts/p4z-tr1b-01-e2e-stub.ts`（+ `-02-sigma-probe.ts`、`-03-cleanup.ts`）
- 命令：`npx ts-node --transpile-only scripts/p4z-tr1b-01-e2e-stub.ts`
- 读数：**`E2E_EXIT=0`；`SUMMARY passed=37 failed=0`**
- 产物：`backend-ts/.p4-artifacts/p6tr1b-20261001T014117Z/e2e.json`；日志 `backend-ts/.p4-artifacts/p6tr1b-tsc/e2e.log`
- 造内容：2 行新内容（1 `job`=24 + 1 `listing`=19）+ 1 个**既有** job=23 作「未翻译对照」（不新增残留行）

### 逐条断言（硬读数，可 `grep`）

| 要求 | 断言 id | 读数 |
|---|---|---|
| ① `content_translation` 有行且 `ready` | `ct.job_rows` / `ct.job_all_ready` | 6 行，`title|description × en|hk|vn` **全 ready** |
| ① `hk` 行是**繁体** | `ct.hk_title_traditional` / `ct.hk_desc_traditional` | `海鲜招工测试甲：整理货架与盘点` ⇒ `海鮮招工測試甲：整理貨架與盤點`（OpenCC cn→tw） |
| ① `zh` 不入表 | `ct.no_zh_rows` | 0 |
| ② API 读回 `title_en` 非空且 stub 形态 | `api.job.title_en_stub` | `[en] 海鲜招工测试甲：整理货架与盘点` |
| ② `title_hk` 繁体 / `title_vn` | `api.job.title_hk_trad` / `api.job.title_vn_stub` | `海鮮招工測試甲：整理貨架與盤點` / `[vn] …` |
| ② listing 出口同口径 | `api.listing.name_en_stub` / `name_hk_trad` / `desc_vn_stub` | `[en] 海鲜礼盒测试丙：虾蟹双拼` / `海鮮禮盒測試丙：蝦蟹雙拼` / `[vn] …` |
| ② `i18n_status` 覆盖度 | `api.job.i18n_ready` / `api.listing.i18n_ready` | `ready` |
| ② 列表面也带 `i18n_status` | `api.prize_list_has_i18n` | 首条 prize 带该键（`pending`） |
| ③ 未翻译对象 | `api.untranslated.i18n_pending` | `pending` |
| ③ **逐字回落** | `api.untranslated.title_en_fallback_exact` | `title_en === 原文`（`b4cii job b4cii30134304`） |
| ③ 逐字回落（hk / 无 note 列） | `title_hk_fallback_exact` / `note_en_fallback_exact` | 均 **=== 原文** |
| ④ 账本 | `ledger.delta_ledger_entry_0` | `267 → 267` |
| ④ `Σ(cid=1)`（补测，见 §5.1） | `sigma_delta_zero` | `1989693 → 1989693` |
| ⑤ 幂等 | `idem.no_new_content_translation_rows` / `idem.no_new_cache_rows` / `idem.second_pass_scanned_0` | 12→12 / 12→12 / `scanned=0` |
| 鉴权 fail-loud | `auth.no_cron_secret_503` / `auth.missing_header_401` / `auth.wrong_bearer_401` | `503` / `401` / `401` |
| 机读回执键集 | `backfill.machine_keys` | `ok,processed,ready,failed,skipped,deferred,reason`（+ `scanned,retried,engine`） |

> 两条 E2E 内断言**口径无效，不计入证据**（如实标注，不冒充实测）：
> `ledger.delta_ledger_tx_0`（本库无 `public.ledger_tx` 关系）与 `ledger.sigma_cid1_unchanged`
> （E2E 里误用 `account.total`，真实列名是 `balance`）。`Σ` 已由 §5.1 的专用探针**重测**。

### 5.1 `Σtotal(cid=1)` 重测（`scripts/p4z-tr1b-02-sigma-probe.ts`，`SIGMA_EXIT=0`）

```
account_columns= uid,cid,balance,frozen,version,time_created,time_updated
BEFORE {"sigma_cid1":"1989693","ledger_entry":"267","sum_col":"balance"}
BACKFILL {"scanned":6,"retried":1,"ready":6,"failed":0,"skipped":0,"deferred":0,"engine":"stub"}
AFTER  {"sigma_cid1":"1989693","ledger_entry":"267"}
READY_ROWS_FOR_JOB 6
RESULT {"sigma_delta_zero":true,"ledger_entry_delta_zero":true,"ready_rows_written":"6"}
```

⇒ 一次**真实**译文写入（6 行 ready）前后，`Σ(balance, cid=1)` 与 `ledger_entry` **逐字不变**。

---

## 6. 红线自证（§5.7 硬口径）

| # | 红线 | 读数 |
|---|---|---|
| ① | `npx tsc --noEmit` | **`TSC_EXIT=0` / `TSC2_EXIT=0`**，日志 **0 行**（`> file 2>&1` **直接重定向，不经管道**，退出码非管道后取值） |
| ② | 注册点数 | `grep -cE '^app\.(get\|post\|patch\|delete\|put)\(' src/index.ts` ⇒ **`ROUTES=67`**（66 → **+1**） |
| ③ | 未动 `frontend/**` | 本单**零**触碰（写路径仅限授权清单） |
| ④ | 账本 | `Δledger_entry = 0`（267→267）；`Σ(balance, cid=1)` 不变（1989693→1989693） |
| ⑤ | 依赖 | **零新增**（`package.json` 未改；只用既有 `@neondatabase/serverless` / `opencc-js` / `ws`） |
| ⑥ | 迁移 | `0021` **未改**（无新 `0022` 需求）；本单零 DDL、零 `migrations/**` 写入 |
| ⑦ | `NOT_MEASURED` | 唯一一处（E2E 内 `account.total` 口径错）已如实标 `NOT_MEASURED` 并由 §5.1 **重测**，未填 0/空 |
| ⑧ | 代码推断 ≠ 实测 | 所有「实测」均附 `grep` 得到的日志读数（`e2e.log` / `sigma.log` / `cleanup.log`） |

---

## 7. 临时数据清理 / 残留登记

`scripts/p4z-tr1b-03-cleanup.ts`（`CLEANUP_EXIT=0`）：

```
CLEANUP {"content_translation_deleted":"0","translation_cache_deleted":"6",
         "remaining_content_translation_for_test_ids":"0","remaining_translation_cache_for_test_hashes":"0"}
CACHE_BY_ENGINE_LEFT []
```

- **译文面已清零**：测试实体在 `content_translation` 剩 0 行；测试文本在 `translation_cache` 剩 0 行；
  全库已无 `engine ∈ ('opencc','stub')` 的缓存行。
- **`residual`（触发器禁 DELETE，无法清除，逐行登记）**：迁移 0013/0015 的 DL79 触发器
  `trg_job_no_delete` / `trg_listing_no_delete` 对所有 `DELETE` 抛错 ⇒ 内容行残留：
  - `public.job`：**`job_id = 24`**（title=`海鲜招工测试甲：整理货架与盘点`，create_key=`tr1b-probe-<RUN>-job`，status=`open`）
  - `public.listing`：**`listing_id = 19`**（title=`海鲜礼盒测试丙：虾蟹双拼`，create_key=`tr1b-probe-<RUN>-listing`，status=`listed`）
  - job=23 为**复用既有行**，本单未新建。
- 安全红线遵守：**未读取/打印 `.env.local` 或任何密钥值**（脚本只 `delete`/覆写自造的 `CRON_SECRET` 测试值，不打印）；
  无 `pkill`/`killall`；无 `git add/commit/push`；无常驻服务（HTTP 监听为脚本内瞬时 `listen(0)`，收尾 `server.close()`）。

---

## 8. 变更文件清单（严格落在授权写路径内）

| 文件 | 性质 |
|---|---|
| `backend-ts/src/database.ts` | 读侧合并/回落 + `i18n_status`（§2.1 的 10 个点） |
| `backend-ts/src/translate-service.ts` | `hk` 落库补齐、`TARGET_LANGS`、`BackfillReport.deferred` |
| `backend-ts/src/index.ts` | `POST /api/translate/backfill` + import |
| `vercel.json` | `crons` 一条 |
| `backend-ts/scripts/p4z-tr1b-01-e2e-stub.ts` / `-02-sigma-probe.ts` / `-03-cleanup.ts` | 探针 |
| `backend-ts/.p4-artifacts/p6tr1b-*/**` | 读数产物 |
| `docs/audit/p6-tr1b-mapper-and-backfill.md` | 本报告 |

**未触碰**：`frontend/**`、`migrations/**`、`scripts/p3x-*`、其它 `src/**`、`docs/seafood.master-plan.md`、spec、`.env.local`。

---

## 9. 交给 TR-2（前端）的接口快照

- 每个 prize/task 对象新增 `i18n_status: "ready" | "partial" | "pending"`（同对象一个值）。
- `title_en|hk|vn`、`note_*`（task）、`name_*`、`description_*`（prize/listing）**恒有值**：有译文用译文，否则**逐字回落中文原文**。
- 「翻译中」小标判定建议：`i18n_status !== 'ready'`；字段缺省（未接入对象）⇒ 不显示小标。
- 语言后缀仅 `en`/`hk`/`vn`；`zh` 恒为源文。
