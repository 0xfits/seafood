# route-layer.spec **v1.1 → v1.2** 折入 delta（Jing · Specifier · 制度员）

> 单元：**Unit JING-TR / 「多语言用户内容（UGC）翻译线」立规格**｜日期：2026-10-01（CST, UTC+08:00）｜前身 = **v1.1**
> 本件 = **逐条 delta → 依据锚点 → 改动点**（派单要求的交付面之一）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准** —— 本单**逐处标依据**（P6-TR 已落地报告 + 派单 JING-TR），**无一处与之冲突**（**无 `待 Zang 复核` 项**）。
> **只追加式**：**非追加改动 = 0 处**；**全部为追加**（顶部 v1.2 状态块 + 新 §10 + 新 §8.14）。**§1–§9 既有条文一字未动**。

---

## §D0 指纹自证（交付时现取 · 三口径 + `cmp`）

| 项 | 文件 | 行数 | 字节 | md5 |
|---|---|---:|---:|---|
| **改前（v1.1）** | `docs/route-layer.spec.md` | **2037** | **448834** | **`3f0aef0e49aa6c2fff0380045888209a`** |
| **改后（v1.2）** | `docs/route-layer.spec.md` | **2194** | **474712** | **`1f8d35a32d75778f985b662c69c5044d`** |
| **快照** | `docs/versions/route-layer.spec.v1.2.md` | **2194** | **474712** | **`1f8d35a32d75778f985b662c69c5044d`** |

**自证命令（逐字 · 退出码一律管道外取；本机无 `timeout`）**：

```
cp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.2.md && cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.2.md; echo "CMP_EXIT=$?"
md5 -q docs/route-layer.spec.md; md5 -q docs/versions/route-layer.spec.v1.2.md; wc -l -c docs/route-layer.spec.md
wc -l docs/versions/route-layer.spec.v1.1.md
```

**读数**：`CMP_EXIT=0`（**快照与本册逐字节相同**）；两 md5 逐位相同 = `1f8d35a32d75778f985b662c69c5044d`；`2194 474712`；**v1.1 快照仍 `2037` 行 / md5 `3f0aef0e49aa6c2fff0380045888209a`（未动）**。
**新节落点（`grep -n` 现取）**：`### 8.14` = `:1961`；**`## §10` = `:2098`**；`### 10.1` = `:2103` / `10.2` = `:2115` / `10.3` = `:2122` / `10.4` = `:2135` / `10.5` = `:2144` / `10.6` = `:2161` / `10.7` = `:2169` / `10.8` = `:2179` / `10.9` = `:2184`。
**★ 关于快照命名的显式判定（重要 · 防误读）**：**route-layer 系列的既有约定 = 快照命名取「新版本号」、内容 = 改后正文**（历版 delta §D0 均以「快照与本体 `cmp` 相同」自证；`docs/seafood.master-plan.md:1809` 逐字指出「`data-layer` 该册 DL134 要求留『**改前快照**』⇒ **命名取改前版本**，与我 route-layer 的命名习惯**不同**」）。⇒ 本册 `docs/versions/route-layer.spec.v1.2.md` = **改后正文的副本（`cmp`=0）**；**改前（v1.1）内容已冻结于 `docs/versions/route-layer.spec.v1.1.md`**（未动）。**本册按「快照先行」执行**：先 `cp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.2.md`（保存改前基线 2037 行）⇒ 改主文件 ⇒ 交付时再 `cp` 同步为改后正文（上表 `cmp`=0 即此步读数）。
**★ 纪律**：本册**不内嵌自身 md5**（防自指），指纹**只在本件**；**v0.1–v1.1 快照未动**。

---

## §D1 delta ① —— 载荷契约（`*_<lang>` 恒有值 + 回落原文 + `i18n_status`）

| 项 | 内容 |
|---|---|
| **依据** | 派单事实 ①；P6-TR-0（`p6-i18n-content-triage.md`）、P6-TR-1b（`p6-tr1b-mapper-and-backfill.md`） |
| **规则（写死 · 逐字入册）** | 内容面 `*_en` / `*_hk` / `*_vn` **恒有值**：有 `status='ready'` 译文用译文、否则**回落源文（zh）**、**永不空串**（唯一例外 = 源文本身为空）；并新增 **`i18n_status: "ready" | "partial" | "pending"`**；**字段缺省 ⇒ 前端不显示小标** |
| **旧行为 = 缺陷（必须写明）** | 改动前 `*_en`/`*_hk`/`*_vn` **列在库与迁移面均不存在**（P6-TR-0 勘误逐字：**API 载荷出现三语键 ≠ 库有列**；真库 `trilingual_cols: []`；`job`/`listing` 内容列 = **单语** `title`/`description`）⇒ 前端按 `name_<lang>` 取值**必然拿到空串**。**根因 = 缺口在 mapper 层**（无造键点）⇒ **本线在 mapper 层新增造键点把空串缺陷消除** |
| **本册现取锚点**（`backend-ts/src/database.ts`） | `I18N_SPECS` `:746`（job/listing 两族）｜**`applyI18n()` = 造键点 `:762`**（恒有值赋值 `:784`）｜`loadI18nIndex()` `:798`（SQL `:803-810`）｜`i18n_status` 定义注释 `:737-739`｜`BrandRecord.i18n_status` `:301` / 另一记录 `:337`｜listing 注释 `:572` / job 注释 `:607`｜读失败兜底 `:816-820` |

## §D2 delta ② —— 内容面（4 字段 + 非内容面 + 两条编辑态口径）

| 项 | 内容 |
|---|---|
| **规则** | 内容对象 = `job(title, description)` / `listing(title, description)` / `users.bio` / `currency.name`；**`market_order` / `market_trade` 无用户文本**（非「用户录入的自然语言内容」）；**发布表单不本地化（输入即原文）**；**`bio` 编辑态持原文**（防译文写回原文） |
| **现取锚点** | `database.ts:746-756`（`I18N_SPECS`，仅 job/listing）；`backend-ts/migrations/0016_market.sql:112,159`（`market_*` 用途/注释）；`frontend/src/pages/ProfilePage.jsx:47`（编辑态持原文口径逐字） |
| **边界（诚实标注）** | 「`market_*` 无用户文本」**转引** `p6-i18n-content-triage.md`，沿其自曝的 `NOT_MEASURED`（`market_trade` 逐列列名未现取）⇒ **本册不下「已逐列取证」断言**（§8.14.3-68） |

## §D3 delta ③ —— 两张新表（迁移 `0021`，**已 apply**）

| 项 | 内容 |
|---|---|
| **表 1 `public.content_translation`**（`0021:71`） | 列 = `entity_type, entity_id, field, lang, text, status, attempts, last_error, updated_at`；**PK = 前四列 = 幂等键**（`:83-84`）；`status ∈ pending|ready|failed|deferred`（`:87-88`）；`lang ∈ en|vn|hk`（`:91-92`）；`attempts >= 0`（`:95-96`）；**★ 结构级兜底 `content_translation_ready_has_text`：`status='ready'` ⇒ `"text"` 非空**（`:101-102`） |
| **表 2 `public.translation_cache`**（`0021:122`） | 列 = `src_hash, src_lang, tgt_lang, text_out, engine, created_at`；**PK = 前三列**（`:131-132`）；`translation_cache_text_out_nonempty`（`:135`）；**命中即不付费**；**不自动过期** |
| **零触发器** | `0021` 只新增两表 + 索引 ⇒ `p3x` 的 `triggers.non_internal = 43` 期望**不变**（`p6-tr1a-translate-service.md` §2.4） |
| **落点 / 规模** | `backend-ts/migrations/0021_content_translation.sql` = **164 行**（本册 `wc -l` 现取） |

## §D4 delta ④ —— 引擎口径（DeepSeek + OpenCC + stub 仅显式 + 缺 key 不翻 + 三重校验）

| 项 | 内容 |
|---|---|
| **en/vn = DeepSeek** | OpenAI 兼容 `POST {base}/chat/completions`；`response_format={"type":"json_object"}` 落点 `translate-service.ts:472` ⇒ **提示词须自带 JSON 要求**（该参数不保证结构） |
| **hk = OpenCC** | `opencc-js` `toTraditional()`；缓存 `engine='opencc'`（`:692`）；**不付费、不走 LLM**；`TRANSLATE_TARGETS=['en','vn']` `:218` / `TARGET_LANGS=['en','vn','hk']` `:220` |
| **`stub` 仅显式** | `TRANSLATE_ENGINE=stub`（`:291-293`）；测试替身、跳过三重校验（`:279`） |
| **缺 key ⇒ 一律不翻** | 未显式启用且缺 `DEEPSEEK_API_KEY` ⇒ `fallbackReason='NO_API_KEY…'`（`:294-307`）；标 `pending` + `reason='NO_API_KEY'`、**不写译文 / 不写缓存**（`:588-589`）——**因 stub 假译文会污染 `translation_cache`** |
| **口径留痕** | P6-TR-1a 曾写「缺 key 自动回落 `engine='stub'`」（`p6-tr1a-translate-service.md:136`）⇒ **已被 TR-FIX / TR-1c-A 反转、作废**（§10.4 内逐字留痕） |
| **三重校验** | ① JSON 结构 ② 长度比 ∈ `[0.3, 3.0]`（`:208-209`）③ 字符集特征（en 非 ASCII > `0.3` 判负，`:211`）；**豁免**：源无 CJK 或单字源（`:366-374`） |

## §D5 delta ⑤ —— 写入形态 B1（前台 pending + 后台 `waitUntil`）

| 项 | 内容 |
|---|---|
| **规则** | **前台只登记 `pending`（`text=NULL`）、批量 1 次 DB 往返、`ON CONFLICT`**（`translate-service.ts:758`）；**后台** `waitUntil` / fire-and-forget（`index.ts:61-62`） |
| **5 条写路径（6 个登记点 · 现取）** | `POST /api/user/profile` `:520` ⇒ 登记 `:536`；`POST /api/currency` `:1339` ⇒ `:1356`；`POST /api/job` `:1425` ⇒ `:1443`；`POST /api/listing` `:1571` ⇒ `:1588`；`POST /api/listing/:listingId`（edit）`:1598` ⇒ `:1617`；`PATCH /api/listing/:listingId`（status）`:1626` ⇒ `:1641` |
| **硬规则（响应不因翻译变慢）** | 实测 `p6-tr1c-a §3.2`（引擎**挂起 15s**）：`POST /api/listing` **200 @ 1995ms** / `POST /api/user/profile` **200 @ 1287ms**（`stub` 对照 1969 / 1276ms） |
| **硬规则（失败不影响写响应）** | `index.ts:61` 注释逐字；`enqueueTranslation` 双 `try/catch` |

## §D6 delta ⑥ —— 失败与成本策略

| 项 | 内容 |
|---|---|
| **规则** | 绝不阻塞提交；失败留空 + `status` + 后台重试；**`pending`/`deferred` 不烧 attempts**（`MAX_ATTEMPTS=5`，`translate-service.ts:213`）；日限额/超长 ⇒ **整批 `deferred`**（`ITEM_TOO_LONG` `:600-606` / `DAILY_CAP_REACHED` `:609-616`） |
| **限额** | 单条 **2000** 字（`TRANSLATE_MAX_CHARS_PER_ITEM`）/ 日 **500** 条（`TRANSLATE_DAILY_ITEM_CAP`）（`:298-299`）；日用量**派生**自当日行数（**不新建计数表**，`:140`/`:610`）；超时 `REQUEST_TIMEOUT_MS=15000`（`:215`）；`429`/`5xx` 可重试（`:541`） |

## §D7 delta ⑦ —— 端点与运维（`backfill` / cron / 注册点 67）

| 项 | 内容 |
|---|---|
| **端点** | `POST /api/translate/backfill`（`src/index.ts:1722`，404 catch-all 之前） |
| **鉴权** | `Authorization: Bearer <CRON_SECRET>` **或** `x-cron-secret`（`:1729-1731`）；**未配 ⇒ `503` fail-loud**（`:1723-1726`，绝不默认放行）；错/缺 ⇒ `401` |
| **入参 / 回执** | `limit` 默认 **20** / 上限 **100**（`:1735`）；回执 `{ok,processed,ready,failed,skipped,deferred,reason}`（+`scanned,retried,engine`，`:1740-1750`） |
| **cron** | `vercel.json:34-37` = `{"path":"/api/translate/backfill","schedule":"0 18 * * *"}` ⇒ **UTC18 = 北京 02:00 = DeepSeek 低峰**；Hobby 套餐 cron = 每日 1 次（`p6-tr1b §4`） |
| **注册点** | `grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` **现取 = 67**（本线 +1）；**v1.1 曾记 65**、派单口径 **66→67** ⇒ **本册只证 67**（§8.14.2-65） |

## §D8 delta ⑧ —— 与账本无关

| 项 | 内容 |
|---|---|
| **规则** | 翻译属**内容更新** ⇒ **`Δledger_entry` 恒 `0`**；迁移（`0021`）与写回**均不碰账本** |
| **实测（转引）** | `p6-tr1c-a §5` / `p6-tr1b §5`：`ledger_entry` **267→267**、`Σ(balance,cid=1)` 不变（本册**零库连接**） |

## §D9 数据面同步（`docs/data-layer.spec.md` · **需要**）

| 项 | 内容 |
|---|---|
| **判定** | **需要**：v1.2 折入的**两张新表**（`content_translation` / `translation_cache`，迁移 `0021`）**是数据层对象** ⇒ 数据面必须同步 |
| **动作** | `docs/data-layer.spec.md` **v0.7 → v0.8**（**追加式加注 §19**，正文 `DL*` 条文**一字未改**）+ **改前快照** `docs/versions/data-layer.spec.v0.7.md`（**该册自有约定 = 「改前快照」命名取旧版本号**；见 `docs/seafood.master-plan.md:1809`） |
| **契约级差异** | 本次为「**新表入册**」（新表 = 数据层新对象）⇒ **非追加改动 = 0 处**（`DL*` 正文零改动）；`DL` 编号**不新增**（两表由 §19 加注登记，不改 `DL1..DL157` 正文） |
| **指纹（交付时现取）** | **改前（v0.7）** = **1023 行 / 268959 B / md5 `ad657c0a5068e91cb57d935bb34fd86b`**；**改后（v0.8）** = **1046 行 / 274767 B / md5 `bdee0a8f6f5871fbc4512e1dab39f523`**；**改前快照** `docs/versions/data-layer.spec.v0.7.md` = **1023 行 / 268959 B / md5 `ad657c0a…`**（**== 改前**；该册「改前快照」命名取旧版本号） |
| **新节落点（现取）** | `## §19` = `:1029`；`AN4` = `:1035` / `AN5` = `:1036` / `AN6` = `:1037` / `### 19.1` = `:1041` |

## §D10 写盘范围与红线自证（逐字）

- **只写五个文件**：`docs/route-layer.spec.md`（就地升 **v1.2**）、`docs/versions/route-layer.spec.v1.2.md`（快照 · `cmp`=0）、本件、**`docs/data-layer.spec.md`**（就地升 **v0.8**）、**`docs/versions/data-layer.spec.v0.7.md`**（改前快照）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.1.md`（**十一个既有快照一字未动**）、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/seafood.master-plan.md`、其余 `docs/audit/*`（含 `p6-*.md`，**只读**）、`docs/qa/*`、**`backend-ts/**`（只读：`grep`/`sed -n`/`wc`）**、**`frontend/**`（只读检索）**、`migrations/**`、`vercel.json`、`.env*`。
- **未做**：任何代码 / 迁移 / `vercel.json` 改动；连库（零 DDL/DML）；`npm install`；`vercel`；启停进程（**未** `pkill -f` / `killall`）；`git add/commit/push`；`timeout`（本机无）。
- **★ 安全红线自证**：本册**未读取 / 未打印任何密钥或 `.env*` 值**；`ref` 中出现的占位符一律为 `<CRON_SECRET>` 形式（**非真值**）。

## §D11 未测项（`NOT_MEASURED`，禁当 0/空）

见正文 **§8.14.2 #60–#65**（真 DeepSeek 调用 / `0021` apply 后库面 / Vercel 真运行时 `waitUntil` / 前端小标运行展示面 / 读侧 payload 实读 / 注册点 65→66 中间步）。

## §D12 纪律自检

① 带引号断言加引号 ✅｜② 退出码不取管道后 ✅｜③ 本机无 `timeout` ✅｜④ 读数异常先怀疑自己 ✅（注册点 65/66/67 三口径差已登记）｜⑤ **先骸架后回填** ✅（§10/§8.14 一次成文、无占位）｜⑥ 报数带口径 ✅（行数/字节/md5 + 非追加 0 处）｜⑦ 凡「实测」可 `grep` 到 ✅（未测项显式 `NOT_MEASURED`）｜⑧ 立案 / 标签前必须自己复现一次 ✅（注册点 67 / `MAX_ATTEMPTS=5` / `0 18 * * *` / 两表 PK+CHECK / `0021`=164 行 —— 均现取）｜⑨ 只追加 ✅（非追加 0 处）｜⑩ 不改代码 / 不启停 / 不写库 / 无 `git` 写 ✅。
