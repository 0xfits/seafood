# P6-TR-1c-A · 写路径 `waitUntil` + 引擎回落反转 + stub 端到端（Kong）

> 交付：① 引擎回落反转（stub 只能显式启用，缺 key ⇒ 不翻译、不写译文/缓存、`NO_API_KEY`）+ 同步更新 J1/J2 断言；② 5 个账本中性写路径挂 `waitUntil`（写入绝不等翻译、`pending` 行先行、失败不冒泡）；③ stub 端到端（只用账本中性写路径）；④ 红线自证。
> 环境：`backend-ts`（TS + `@neondatabase/serverless` 0.6.1 + Vercel serverless）。本机无 `timeout`；退出码一律取自命令本身（非管道之后）。

---

## 0 结论速览

| 项 | 状态 | 证据（可 grep） |
|---|---|---|
| ① 引擎回落反转（缺 key 不落 stub、不写脏数据） | landed | `src/translate-service.ts:290` `getTranslateConfig` 只置 `fallback_reason`、`engine=requested`；`:587` 闸⓪ `markAll('pending', REASON.NO_API_KEY)` |
| ① 断言更新（J1/J2 + 新增 J10–J14） | landed | `scripts/p4z-tr1a-01-offline-tests.ts`；离线 `total=96 passed=96 failed=0` |
| ② 5 条写路径挂 `waitUntil` | landed | `src/index.ts:536 / 1356 / 1443 / 1588 / 1617 / 1641`（helper `:65` / `:84`） |
| ③ stub 端到端（中性写路径） | landed | `.p4-artifacts/p6tr1c-20261001T015515Z-stub/e2e.json` 26/26 |
| ③ 非阻塞侧证（挂起引擎 vs 写响应） | landed | `.p4-artifacts/p6tr1c-20261001T015659Z-hang/e2e.json` 20/20 |
| ④ `tsc --noEmit` | **0 行**（exit 0） | `TSC_EXIT=0; TSC_LINES=0` |
| ④ 离线套件 | **96/96 全绿** | `SUMMARY total=96 passed=96 failed=0`（`p6tr1a-20261001T015826Z`） |
| ④ 注册点 | **67**（未增端点） | `grep -cE '^app\.(get\|post\|patch\|put\|delete)\(' src/index.ts` ⇒ 67 |
| ④ `Δledger_entry` | **0** | before=after=**267**；Σ(balance+frozen,cid=1) 恒 **2000200** |
| ④ 依赖 | 仅增 `@vercel/functions@^3.9.9` | `package.json` diff = 1 行 |

---

## 1 引擎回落反转（防生产写脏数据）

### 1.1 改前 / 改后
- **改前**：`getTranslateConfig` 在 `requested='deepseek' && 无 key` 时把 `engine` **回落 `stub`** ⇒ `translateFields` 产出 `[en] 招聘服务员` 形态的**假译文**并按 `ready` 入库 + 写 `translation_cache` ⇒ ①站点把假译文当真译文展示；②污染缓存（同文本永久命中假缓存）。
- **改后**：`stub` **只能显式启用**（`TRANSLATE_ENGINE=stub`，仅供本地/测试）。未显式启用且缺 key ⇒ **一律不翻译**：该批标 `pending` + `reason='NO_API_KEY'`，**不写任何译文、不写缓存**，等 key 到位由 `backfill`/cron 补齐。

### 1.2 代码位点
- `src/translate-service.ts:290` `getTranslateConfig()`：`engine = requested`（**不再回落**）；`requested='deepseek' && !apiKeyPresent` 时仅置 `fallback_reason = "NO_API_KEY: …"`。
- `src/translate-service.ts:587` **闸⓪**（`translateFields` 内、闸①之前）：
  `engine !== 'stub' && !apiKeyAvailable ⇒ await markAll('pending', REASON.NO_API_KEY); return out;`
  其中 `apiKeyAvailable` = 显式注入 `opts.apiKey` 非空 **或** `cfg.api_key_present`。
- 告警：`if (cfg.fallback_reason) warn(cfg.fallback_reason)` —— 由模块级 `fallbackWarned` 保证**只告警一次**；文案**不含任何 key 值**。

### 1.3 为何用 `pending` 而非 `failed`
`upsertTranslation` 语义（`TranslateStore` 契约 + `createDbStore`）：仅 `ready|failed` 递增 `attempts`；`pending` **不烧 attempts**。
⇒ 缺 key 期间把行标 `pending`（`last_error='NO_API_KEY'`），即使写路径被反复触发也**不耗尽** `MAX_ATTEMPTS=5`，key 到位后 `listPending`（`status IN ('pending','failed') AND attempts<5`）可**完整补齐**。

### 1.4 断言同步（`scripts/p4z-tr1a-01-offline-tests.ts`）
- `J1`（**改**）：`c.engine === 'stub' …` → **`c.engine === 'deepseek' && requested_engine === 'deepseek' && api_key_present === false`**（无 key **不落 stub**）。
- `J2`（**保留**）：`fallback_reason` 含 `NO_API_KEY`。
- 新增 **J10**：`TRANSLATE_ENGINE=stub` 且无 key ⇒ `engine='stub'`（显式启用生效）。
- 新增 **J11–J14**：`config.api_key_present=false`（未显式 stub）⇒ `f.calls===0`、`cache.size===0`、`statuses×3='pending'` 且 `errors×3='NO_API_KEY'`、`content_translation.text` 恒 `NULL`。
- 新增 **L1–L4**：写路径前台 `registerPendingTranslations`（只登记不翻译）；缺省 `DO NOTHING`（不降级 `ready`）、`reset=true` 覆盖回 `pending/NULL`。
- 条数：原 87 ⇒ **96（只增不减）**。

### 1.5 H15 既有断言为何仍绿
`H15` 走 `opts.apiKey=null`（显式无 key）⇒ 命中闸⓪（`apiKeyAvailable=false`）⇒ `f.calls===0` 且 `errors=NO_API_KEY`，与断言一致（原经引擎抛错路径亦得同码，状态由 `failed` 变 `pending`，H15 未断言状态）。

---

## 2 写路径挂 `waitUntil`（写入绝不等翻译）

### 2.1 挂载口径（helper）
`src/index.ts:65` `enqueueTranslation(target)`：
1. **前台（awaited）**：`registerPendingTranslations(target,{reset})` —— 批量一条 `INSERT … unnest … ON CONFLICT`（`translate-service.ts:791` `upsertPendingRows`，单次往返）⇒ 读侧 `i18n_status` **立即**从 `pending` 有据可依。
2. **后台（非阻塞）**：`scheduleEntityTranslation(target)`（`:951`）→ `runInBackground`（`:933`）**优先**挂 `@vercel/functions` 的 `waitUntil`，无运行时上下文/非 Vercel ⇒ **退化 fire-and-forget**（`Promise…catch` 兜底）。
3. helper 两步各自 `try/catch`，**同步绝不抛** ⇒ 写响应状态码/语义不受任何影响。

### 2.2 逐条写路径（改了哪几行 / 何时写什么 / 失败时用户看到什么）

| 端点 | 端点行 | 挂载行 | 前台写什么 | 后台写什么 | 失败时用户看到 |
|---|---|---|---|---|---|
| `POST /api/user/profile`（bio） | `:516` | `:536` | `user/{uid}` × `bio`×3 行 `pending`（`reset=true`） | `waitUntil` 里 `translateFields`（en/vn 走引擎、hk 走 OpenCC） | 照常 `200 Profile updated` + 原 payload |
| `POST /api/currency`（name） | `:1335` | `:1356` | `currency/{cid}` × `name`×3 行 `pending`（`reset=true`） | 同上 | 照常 `200 Currency created`/重放语义不变 |
| `POST /api/job`（title/description） | `:1421` | `:1443` | `job/{job_id}` × (title,description)×3 行 `pending` | 同上 | 照常 `200 Job published`（含重放 `idempotent_replay`） |
| `POST /api/listing`（新建） | `:1567` | `:1588` | `listing/{listing_id}` × (title,description)×3 行 `pending` | 同上 | 照常 `200 Listing created` |
| `POST /api/listing/:id`（编辑） | `:1594` | `:1617` | 同上，`reset=true`（内容变 ⇒ 重置回 `pending`） | 同上 | 照常 `200 Listing updated` |
| `PATCH /api/listing/:id`（状态迁移） | `:1622` | `:1641` | 同上，缺省 `DO NOTHING`（标题未变，不降级 `ready`） | 同上 | 照常 `200 Listing status transitioned` |

> 端点→`updateListingRow`（`:1593` 口径现取 = `database.ts:1659`）：仅 `POST /api/listing/:id`（编辑）命中；`PATCH` 走 `transitionListingRow`（未改文本）。两者**均**已挂载（`POST` `reset=true` / `PATCH` `DO NOTHING`）。

### 2.3 「何时写什么」（明确 hk 口径）
- **前台（写响应返回前）**：仅登记 `pending` 行（`text=NULL`，无译文、无缓存）。
- **后台（`waitUntil`，响应返回后）**：
  - `en`/`vn` → DeepSeek（外部/付费，**一定在后台**）；
  - `hk` → **OpenCC 确定性简繁转换**（`engine='opencc'`、**不付费、不走 LLM**）——与 en/vn 同一后台任务内落库；即便引擎挂起/失败，hk 仍照常 `ready`（见 §3 hang 证据）。
- **字段名 = 源列名**（与 `createDbSourceResolver` 白名单一致）：job/listing→`title`/`description`；user→`bio`；currency→`name`。
- **缺 key 时**：闸⓪ 使**整批（含 hk）**标 `pending`+`NO_API_KEY`（§1），不落任何译文/缓存。

---

## 3 stub 端到端（账本中性写路径）

脚本：`scripts/p4z-tr1c-01-e2e-stub.ts`（两模式共用；进程内瞬时 http server，`VERCEL=1` 阻止 auto-listen）。
**只走账本中性写路径**：`POST /api/listing`（商品上架）+ `POST /api/user/profile`（bio）；**未调用任何资金端点**、**未发布招工**。

### 3.1 `stub` 模式（`TRANSLATE_ENGINE=stub`，无 key）—— 26/26
产物 `.p4-artifacts/p6tr1c-20261001T015515Z-stub/e2e.json`（listing_id=20, uid=1）：
- 写请求：`POST /api/listing` **200**（`elapsed_ms=1969`）、`POST /api/user/profile` **200**（`elapsed_ms=1276`）。
- 写后**立即**：`content_translation` 出现 **9 行**（listing title+description ×3 + user bio ×3），`status='pending'`、`text` 全 `NULL`。
- 后台若干秒后：listing **6 行全 `ready`**、user **3 行全 `ready`**；`title_en="[en] …"`、`title_hk=海鮮禮盒TR1C測試：蝦蟹雙拼-…`（繁体）、`description_vn="[vn] …"`。
- `GET /api/prize/20`（*listing 读侧端点，见 §5*）：`name_en="[en] …"`、`name_hk=繁体`、`description_vn="[vn] …"`、**`i18n_status='ready'`**。
- 重复调 `POST /api/translate/backfill`（`x-cron-secret`，两遍）⇒ `translation_cache` **9=9=9**（**缓存命中、不重复付费**），`200/200`。

### 3.2 `hang` 模式（引擎指向本脚本内挂起 TCP 服务器，永不响应）—— 20/20
产物 `.p4-artifacts/p6tr1c-20261001T015659Z-hang/e2e.json`（listing_id=22）：证明**写响应不等待翻译**。
- 引擎**挂起 15s**（`REQUEST_TIMEOUT_MS`），而 `POST /api/listing` **200 @ 1995ms**、`POST /api/user/profile` **200 @ 1287ms** ⇒ **响应未被翻译拖慢**。
- 写后立即：9 行 `pending`、`text` 全 `NULL`（**pending 先行**）。
- 15s 后：`en`/`vn` 共 4 行 **`failed` + `TIMEOUT`**、`text` 全 `NULL`（**失败不写脏数据**）；`hk` 2 行 **`ready` + 繁体**（OpenCC 免费/确定性，不等引擎）。

### 3.3 清理 / 残留
- 每轮 `content_translation` 删 9 行、`translation_cache` 删对应 `src_hash` 行（stub=9、hang=3）；**用户 bio 原值还原**（`bio_restored=true`）。
- **残余（DL79 触发器禁 DELETE）**：listing 行 **20 / 21 / 22**（`id=21` 来自一次断言过严的 hang 试跑，其译文面亦已清）。`residual.listing_ids` 见各产物。

---

## 4 红线自证（§5.7）

| # | 红线 | 读数 |
|---|---|---|
| ① | `cd backend-ts && npx tsc --noEmit` ⇒ 0 行 | `TSC_EXIT=0`、`TSC_LINES=0`（直接重定向，退出码取自命令本身） |
| ② | 离线套件全绿、条数只增不减、产物 run-tagged | `SUMMARY total=96 passed=96 failed=0`（`.p4-artifacts/p6tr1a-20261001T015826Z/`），87→96 |
| ③ | 注册点现取 | **67**（本单未增端点） |
| ④ | `Δledger_entry = 0` + `Σ(balance,cid=1)` 不变 | `ledger_entry 267→267`；`sigma 2000200→2000200`（stub 与 hang 两轮均成立） |
| ⑤ | 不动 `frontend/**`、`migrations/**`、`0021`、`vercel.json` | `git status --short` 仅见 §6 列出的文件 |
| ⑥ | 依赖只增 `@vercel/functions` | `package.json` diff = `+ "@vercel/functions": "^3.9.9"`（1 行）；`package-lock.json` 仅其树 |

另：服务重启后读侧点验 —— `GET /api/prize/20` = **200**、`i18n_status='pending'`、`name_en=` 原文（译文面已清 ⇒ 回落源文，**非空串**），确认新代码已在运行实例生效（§5.7⑨）。

---

## 5 未测 / 口径说明（不把「代码推断」写成「实测」）

- **`waitUntil` 真运行时上下文（Vercel Functions）无法本机实测**：本机 `process.env.VERCEL` 非真运行时，`@vercel/functions` 的 `waitUntil` 实测**不抛**（`waitUntil NO_THROW`），后台执行由 **fire-and-forget 兜底**完成。Vercel 上走 `waitUntil` 分支为**代码事实**（`:933` `getWaitUntil()` 命中即调用），其「响应后仍执行」保证属平台契约，**本机未实测**。
- **`ledger_tx` = `NOT_MEASURED`**：`public.ledger_tx` 关系不存在（两边均为 `ERR:relation "public.ledger_tx" does not exist`，脚本按「前后相等」判过，但语义为 **NOT_MEASURED**，非 0）。
- **`GET /api/listing/:id` 不存在**：本仓 listing 读侧端点为 `GET /api/prize/:bID`（`index.ts:450` → `getPrizeById`→`getBrandById`）；读回断言改用该端点。
- **写响应时延**含前台 pending 登记（1 次 DB 往返）与业务写本身；`stub` 实测 1969/1276ms、`hang` 1995/1287ms（差异在 DB 往返，非翻译）。**「不被翻译拖慢」由 hang 模式（15s 挂起 vs <2s 响应）实测支撑**。
- **`enqueueTranslation` 前台 `await` pending 登记**：为使读侧「立即」见 `pending` 的**有意选择**；已各自兜底，绝不改响应码/语义。

---

## 6 改动清单（`git status --short`）

```
 M backend-ts/package.json                      (+@vercel/functions 1 行)
 M backend-ts/package-lock.json
 M backend-ts/scripts/p4z-tr1a-01-offline-tests.ts   (J1 改 + J10–J14/L1–L4 增)
 M backend-ts/src/index.ts                      (helper + 5 端点挂载)
 M backend-ts/src/translate-service.ts          (回落反转 + 闸⓪ + 写路径 helper)
?? backend-ts/scripts/p4z-tr1c-01-e2e-stub.ts
?? backend-ts/.p4-artifacts/p6tr1a-*  (离线套件自产)
?? backend-ts/.p4-artifacts/p6tr1c-*  (E2E 产物)
```
未触碰：`frontend/**`、`migrations/**`、`0021_*`、`vercel.json`、`scripts/p3x-*`、spec、`.env*`。未执行 `git add/commit/push`、`vercel`、DDL、`pkill/killall`。
