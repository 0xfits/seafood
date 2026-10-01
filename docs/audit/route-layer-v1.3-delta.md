# route-layer.spec **v1.2 → v1.3** 折入 delta（Jing · Specifier · 制度员）

> 单元：**Unit JING-TR-3 / 「翻译线已落地变更回写规格」**｜日期：2026-10-01（CST, UTC+08:00）｜前身 = **v1.2**
> 本件 = **逐条 delta → 依据锚点 → 改动点**（交付面之一）。**凡与 Zang 裁定冲突处，一律以 Zang 裁定为准** —— 本单逐处标依据（`docs/audit/p6-tr1c-b-real-engine.md` / `docs/audit/p6-tr1c-fix.md` + 派单 JING-TR-3 + **Zang 追加口径**），**无一处与之冲突**（**无 `待 Zang 复核` 项**）。
> **追加为主 + 3 处就地订正**：**非追加改动 = 3 处**（§10.4 ② 阈值口径 / §10.7 端点行号 / §10.7 `limit`，**逐处保留旧写法留痕**；另加 §10.4 两条同族「指针」批注 + §10.1 一条「追加口径指针」）；**新增 = §10.10–§10.15（§10.x 追加节）+ §8.15 + 顶部 v1.3 状态块**。**§1–§9 既有条文一字未动**。

---

## §D0 指纹自证（交付时现取 · 三口径 + `cmp`）

| 项 | 文件 | 行数 | 字节 | md5 |
|---|---|---:|---:|---|
| **改前（v1.2）** | `docs/route-layer.spec.md`（= `docs/versions/route-layer.spec.v1.2.md`，**已冻结**） | **2194** | **474712** | **`1f8d35a32d75778f985b662c69c5044d`** |
| **改后（v1.3）** | `docs/route-layer.spec.md` | **2353** | **503209** | **`ed0835a352b0560f2adb2602af5a7471`** |
| **快照** | `docs/versions/route-layer.spec.v1.3.md` | **2353** | **503209** | **`ed0835a352b0560f2adb2602af5a7471`** |

**自证命令（逐字 · 退出码一律管道外取；本机无 `timeout`）**：

```
cp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.3.md && cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.3.md; echo "CMP_EXIT=$?"
md5 -q docs/route-layer.spec.md; md5 -q docs/versions/route-layer.spec.v1.3.md; wc -l -c docs/route-layer.spec.md
```

**读数**：**`CMP_EXIT=0`**（快照与本册**逐字节相同**）；两 md5 逐位相同 = `ed0835a352b0560f2adb2602af5a7471`；`2353 / 503209`；**v1.2 快照仍 `2194` 行 / md5 `1f8d35a32d75778f985b662c69c5044d`（一字未动）**。
**新节落点（本册现取 · `grep -n`）**：`### 8.15` = **`:2019`**；`## §9` = `:2059`；`§10` 标题 = **`:2152`**；**`## §10.x` 追加节 = `:2254`**；`### 10.10` = **`:2256`** / `10.11` = **`:2272`** / `10.12` = **`:2289`** / `10.13` = **`:2309`** / `10.14` = **`:2317`** / **`10.15` = `:2338`**；**就地订正 / 追加指针行** = §10.1（`i18n_status` 定义行）、§10.4（`:2190` stub / `:2191` 缺 key / `:2193` ② 阈值）、§10.7（`:2222` 端点 / `:2225` `limit`）—— **行号以本册现取为准**。
**★ 快照命名（本仓惯例 · 复述）**：**快照命名取「新版本号」、内容 = 改后正文、与本册 `cmp` 退出 0**（先例 = `route-layer.spec.v1.2.md`，见 `docs/audit/route-layer-v1.2-delta.md §D0/§D13.1`）。⇒ `docs/versions/route-layer.spec.v1.3.md` = **改后正文的逐字节副本**；**改前（v1.2）内容已冻结于 `docs/versions/route-layer.spec.v1.2.md`（未动）**。
**★ 纪律**：本册**不内嵌自身 md5**（防自指），指纹**只在本件**；**v0.1–v1.2 快照未动**。

---

## §D1 delta ① —— DEF-02 长度比阈值表（**按目标语言分表**；替换原「`[0.3, 3.0]`」口径）

| 项 | 内容 |
|---|---|
| **依据** | 派单事实 ①；`docs/audit/p6-tr1c-fix.md §4`（最终阈值表）；缺陷登记 = `docs/audit/p6-tr1c-b-real-engine.md §5 · DEF-TR1C-B-02` |
| **规则（写死）** | `LENGTH_RATIO_BOUNDS` = **`en [0.3, 6.0]` / `vn [0.3, 6.0]` / `hk [0.5, 2.5]`**；分母 = **源文本码点数**；越界 ⇒ `reason='LENGTH_RATIO'`（判负、不落 `ready`） |
| **为何改（写死理由）** | zh→en/vn **短文本**实测比 **3.7–5.2**（`p6-tr1c-b §5`：`vn_title 3.933`、probe `4.133/4.200/4.667`、desc en `4.600`）⇒ 旧上限 **3.0 系统性误杀**、**`vn` 永远无法 `ready`**；**hk 是 1:1 级确定性简繁转换**（OpenCC，实测比 ≈1.05）⇒ **反而收紧**到 `[0.5, 2.5]`（防「转繁顺带改写」） |
| **旧导出名保留** | `LENGTH_RATIO_MIN = LENGTH_RATIO_BOUNDS.en.min` / `LENGTH_RATIO_MAX = LENGTH_RATIO_BOUNDS.en.max` ⇒ **= en 口径**（非独立阈值） |
| **本册现取锚点**（`backend-ts/src/translate-service.ts`） | `LENGTH_RATIO_BOUNDS` `:220-224`（`en :221` / `vn :222` / `hk :223`）｜注释（含 3.7–5.2 与 1:1 级理由）`:216-219`｜旧导出名 `:226-227`｜消费点 `validateValue` `:416-434`（`bounds :424` / 判负 `:425-430`） |
| **就地订正（留痕）** | §10.4 ② `:2193`：原「长度比 ∈ `[0.3, 3.0]`（`LENGTH_RATIO_MIN/MAX = 0.3/3.0`，`:208-209`）」⇒ 改后**保留旧写法逐字**并指向 §10.10 |

## §D2 delta ② —— `POST /api/translate/backfill` 三 mode + `limit` 默认 100 + 存量扫描

| 项 | 内容 |
|---|---|
| **依据** | 派单事实 ②；`docs/audit/p6-tr1c-b-real-engine.md §1/§3`（三态 + 幂等实证）；`docs/audit/p6-tr1c-fix.md §9.1`（`limit` 20 ⇒ 100） |
| **规则（写死）** | `mode` **三态**：**`scan_translate`（缺省）= 先扫存量补 `pending` 再翻译（cron 自愈）** / `scan` = **只登记、零 API 付费** / `translate` = 旧行为；`scan=1` ⇒ 与 `translate` 合并为 `scan_translate`；非法 `mode` ⇒ 回落缺省 |
| **`limit`** | **默认 100 / 上限 100**（旧默认 **20**）；**真闸 = `TRANSLATE_DAILY_ITEM_CAP=500`**（每日条目上限） |
| **回执** | **旧键逐字保留**（`ok/processed/ready/failed/skipped/deferred/reason/scanned/retried/engine`）+ **新增 `mode / scan_scanned / scan_registered / scan_existing / scan_by_entity`** |
| **幂等实证（真库 + 真 HTTP）** | 候选 **276** 条（job 99 / listing 117 / user 21 / currency 39）⇒ 首轮 `scanned=276 / registered=276 / existing=0`；**二轮 `registered=0 / existing=276`、行数不增、零付费**（`0 → 276 → 276`） |
| **存量扫描 = 真库推导** | `TRANSLATABLE_SPECS`（四类白名单）+ **单语句** `INSERT … SELECT … ON CONFLICT DO NOTHING RETURNING 1`（**语句内无 DELETE/UPDATE**） |
| **本册现取锚点** | `src/index.ts:1730`（注册点）/`:1731-1740`（503 fail-loud + 401）/`:1747`（`limit` 取值行）/`:1749-1755`（`mode` 解析）/`:1760-1778`（回执）；`translate-service.ts:1134-1139`（`TRANSLATABLE_SPECS`）/`:1149-1173`（`buildScanInsertSql`）/`:1192`（`createDbContentScanner`）/`:1219-1222`（`scanRegisterPending`） |
| **就地订正（留痕 ×2）** | §10.7：注册点原 `:1722` ⇒ 现 `:1730`（**旧读数留痕** + 挂 `mode` 指针）；§10.7：`limit` 原「默认 20（`:1735`）」⇒ 现「默认 100（`:1747`）」（**旧写法留痕**）；§10.7 回执行**追加**五个新键（旧行文不删） |

## §D3 delta ③ —— ★★ **stub 写库守卫（结构性拒绝）**（本节重点）

| 项 | 内容 |
|---|---|
| **依据** | 派单事实 ③；`docs/audit/p6-tr1c-fix.md §2`（守卫设计与根因教训）、`§1`（清洗读数） |
| **规则（写死）** | `stub` 引擎**默认拒绝写库**；**仅 `TRANSLATE_ALLOW_STUB_WRITES=1`（或 `opts.allowStubWrites=true`）显式放行**；未放行 ⇒ `store = null`（**不读缓存 / 不写 `pending` / 不落译文 / 不写缓存**）+ 机读 **`store_write_blocked = true`** / **`store_block_reason = 'STUB_WRITE_BLOCKED'`** |
| **为何必须（写死理由）** | 假译文（`^\[(en\|vn)\] `）**曾落真库并被当 `ready` 对外提供**，且**污染 `translation_cache`**（命中即跳过付费调用 ⇒ **一次污染长期生效**）；只告警不中断 ⇒ 污染可再现 ⇒ **必须在唯一写库落点直接短路**；开关**默认关（fail-closed）** |
| **立法目的（写死）** | 把「测试用假翻译不得进真库」从**调用方纪律**升级为**结构性拒绝** |
| **清洗实证（读数）** | `content_translation` **270 → 270 行**（**不删行**：stub 模式命中 **14 → 0**、`ready` **39 → 25**、`pending` **231 → 245**）；`translation_cache` **39 → 25 行**（`engine='stub'` **14 → 0**；`opencc` 14 / `deepseek` 11 不在清洗范围） |
| **本册现取锚点** | `REASON.STUB_WRITE_BLOCKED` `:89`；`stubWritesAllowed()` `:342-344`（注释 `:339-341`）；出参字段 `:191-195`；**守卫 `:602-614`**（`store=null :611` / `store_write_blocked :612` / `store_block_reason :613`）；`opts.allowStubWrites :177-178` |
| **正文落点** | **§10.12**（新 · 重点）+ §10.4 stub 行指针 |

## §D4 delta ④ —— DEF-01 校验字段集口径

| 项 | 内容 |
|---|---|
| **依据** | 派单事实 ④；`docs/audit/p6-tr1c-b-real-engine.md §5 · DEF-TR1C-B-01`；`docs/audit/p6-tr1c-fix.md §3` |
| **规则（写死）** | `translateFields` 必须以**本次请求的完整字段集**（`subset`）调 `validateFieldSet`，**再只取该语言需要的字段**合流 ⇒ **部分缓存命中不得误判 `KEY_SET_MISMATCH`** |
| **旧实现缺陷（作废）** | 逐目标语言用**字段子集**校验（`targetSubset = { f : misses[f].includes(t) }`，该件旧行号 `:657-663`）而引擎返回**全部请求字段** ⇒ 部分缓存命中（重试 / 部分成功）时**误杀 `description.en`** |
| **本册现取锚点** | `validateFieldSet(subset, t, raw)` `:710`（定义 `:437`）；合流 `:707-719`；注释 `:704-706` |
| **正文落点** | **§10.13**（新） |

## §D5 delta ⑤ —— 缺 key 口径（**确认不漂移**）+ 模型 id 实证 + 真引擎实测读数

| 项 | 内容 |
|---|---|
| **缺 key 口径（复核 = 不漂移）** | 非显式 stub 且无 `DEEPSEEK_API_KEY` ⇒ **一律不翻译**：`status='pending'` + `reason='NO_API_KEY'`（**不烧 `attempts`**）、**不写译文（`text` NULL）· 不写缓存**；**「缺 key 自动回落 stub」仍属作废** |
| **锚点** | `getTranslateConfig` 派生 `fallback_reason` `:319-326`；**闸 ⓪** `:634-644`（`markAll('pending', REASON.NO_API_KEY)` `:642` / `return` `:643`） |
| **模型 id 实证** | `DEFAULT_MODEL = 'deepseek-flash'`（`:239`）**已由真调用实证可用**（`p6-tr1c-fix.md §5.2`：`engine=deepseek` / `model=deepseek-flash` / `api_key_present=true`（**只判存在，不打印值**）/ `llm_calls=1`）；**`deepseek-v4-flash` 不存在** —— 本册现取 `grep`：`backend-ts/src` + `scripts` **2 处**、`docs/route-layer.spec.md` **1 处**，**全部为注释 / 自曝文本**（`translate-service.ts:238` 注释逐字已标「存疑」）⇒ **§8.14.3-67 由「存疑」更新为「已实证」（状态更新、留痕）** |
| **真引擎实测读数（可引用）** | CJK 源 listing ⇒ `en` = `Seafood Gift Box Test C: Shrimp and Crab Duo`、`vn` = `Hộp quà hải sản thử nghiệm C: Combo tôm và cua`、`hk` = `海鮮禮盒測試丙：蝦蟹雙拼`；**单次调用 prompt 327 / completion 581 tokens**（`elapsed_ms=14588`、`llm_calls=1`）；断言 `vn_title_status_ready` / `hk_is_traditional` / `no_stub_prefix` 等**全 true**、`stub_rows_in_listing_ct=0` |
| **正文落点** | **§10.14① ② ③ ④**（新） |

## §D6 文档漂移修正（**派单额外项**）

| 项 | 内容 |
|---|---|
| **漂移 ①** | `docs/audit/route-layer-v1.2-delta.md` 的 **§D7** 与本册 v1.2 正文 §10.7 均记「`limit` 默认 **20**」—— **现盘真值 = 100**（`src/index.ts:1747` 现取；`p6-tr1c-fix.md §9.1`） |
| **本单动作** | ① 在该 v1.2 delta **件末尾追加** **§D14**（**不改旧内容**，只追加修正条）；② 本册 §10.7 **就地订正并留痕**（§D2）；③ 新增 §10.11 写全口径；④ 本件 **§D6** 与正文 **§8.15.3-72** 双处登记 |
| **同族残留（登记、不动）** | `docs/audit/p6-tr1b-mapper-and-backfill.md:89` 亦记「20」⇒ 属**该件面**，**本册不动**，仅登记（§8.15.3-72） |
| **口径差说明** | v1.2 记 20 是**当时真值**（P6-TR-1c-FIX-FIN 之前）；**非笔误**，属**版本时点差** ⇒ 故**保留旧写法留痕**而不删 |

## §D7 delta ⑥（**Zang 追加口径**）—— `i18n_status` 的**分母定义**

| 项 | 内容 |
|---|---|
| **依据** | **Zang 追加口径（本单执行中下达 · 优先级高）** + Zang **实测读数**（本册**转引**）；相邻既有条文 = §10.1（v1.2） |
| **规则（写死）** | **① 空源格不进分母**：`total` **只计「源文本非空非空白」的字段格** ⇒ **源文本为空 / 空白的字段（该语言格）不得计入 `total`**；**② 全空源对象 ⇒ `i18n_status = 'ready'`**（vacuous ready） |
| **二选一的抉择（必须写明）** | 派单给两选项（**不输出该键** / **置 `ready`**）⇒ **本册选「置 `ready`」**：因 **§10.1 已写死「`job` / `listing` 记录**恒带**此键」** ⇒ 取 `ready` **不破例**，且**前端同样不显示「翻译中」小标**（前端只在 `partial` / `pending` 挂标）。**行为差 = 键在 / 键缺** |
| **为何（写死理由）** | **空源字段无内容可翻**；计入分母 ⇒ 对象**永远凑不满 ready 格** ⇒ **永久判 `partial`** ⇒ **「翻译中」小标永挂** = **永不消失的假信号** |
| **依据读数（Zang 实测 · 本册转引）** | `content_translation` 字段覆盖 = `job` title **60** / description **39** 行、`listing` title **66** / description **51** 行 ⇒ **7 个招工 + 5 个商品**的描述为空；`I18N_SPECS` 对 `job` **固定出 `title` + `note` × 3 语言 = 6 格** ⇒ 空源仍进分母；**生产分布 = `{ready: 41, partial: 14, pending: 1}`** |
| **修法（并行派单；本册只写口径）** | `applyI18n` **剔除空源格**（不入 `total`）；`total === 0` ⇒ **取 `ready`**（本节 ②） |
| **锚点** | 口径消费面**转引 §10.1 / v1.2 时点读数**（`database.ts:762/784`、`:737-739`、`:798`、SQL `:803-810`）—— **本册未复读、零代码读取**（§8.15.2-71） |
| **正文落点** | **§10.15**（新）+ **§10.1 追加口径指针**（就地追加、不删旧文） |

## §D8 delta ⑦ —— 与账本 / 数据面无关（判定 = **不需要**动别的册）

| 项 | 内容 |
|---|---|
| **账本面** | 本版全部内容 = **内容面（翻译）规格**：阈值 / 校验口径 / 端点 mode / 写库守卫 / `i18n_status` 分母 ⇒ **`Δledger_entry` 语义恒 `0`**（承 §10.8）；本册**零库连接**（不重测，不冒充实测） |
| **数据层面（判定）** | **不需要**：本版**未新增 / 未改动任何数据层对象**（表 / 列 / 约束 / 索引**零变更**；迁移 `0021` **未动** —— `p6-tr1c-fix.md §0`「迁移 `0021` 未改动（零 DDL）」）⇒ **`docs/data-layer.spec.md` 与其快照本单一字不写** |
| **路由注册点** | 本册现取 = **67**（`grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts`）⇒ **与 v1.2 一致（未增删端点）**；`src/index.ts` 现 **1796 行** |

## §D9 写盘范围与红线自证（逐字）

- **只写四个文件**：`docs/route-layer.spec.md`（就地升 **v1.3**）、`docs/versions/route-layer.spec.v1.3.md`（快照 · `cmp`=0）、本件 `docs/audit/route-layer-v1.3-delta.md`、`docs/audit/route-layer-v1.2-delta.md`（**仅末尾追加 §D14**）。
- **未触碰**：`docs/versions/route-layer.spec.v0.1–v1.2.md`（**十二个冻结快照一字未动**）、`docs/versions/data-layer.*` / `ledger.*` / `commission.*`、`docs/data-layer.spec.md` / `docs/ledger.spec.md` / `docs/commission.spec.md`、`docs/seafood.master-plan.md`、其余 `docs/audit/*`（含 `p6-*.md`，**只读**）、`docs/qa/*`、**任何 `src/**` / `migrations/**` / `frontend/**` / `backend-ts/**` / `vercel.json` / `.env*`**（**只读：`grep` / `sed -n` / `wc`**）。
- **未做**：任何代码 / 迁移 / `vercel.json` 改动；连库（**零 DDL/DML**）；`npm`；`vercel`；启停进程（**未** `pkill -f` / `killall`）；`git add/commit/push`；`timeout`（本机无）。
- **★ 安全红线自证**：本册**未读取 / 未打印任何密钥或 `.env*` 值**；`api_key_present` 一类读数**只判存在**。

## §D10 未测项（`NOT_MEASURED`，禁当 0/空）

见正文 **§8.15.2 #66–#71**（`limit` 默认分支运行时效果 / 真 DeepSeek 调用的本册复读 / 清洗与守卫的库面复读 / 存量回填推进末期读数 / `mode=scan_translate` 缺省分支的端点级实测 / **`i18n_status` 分母缺陷的库面复核**）。

## §D11 纪律自检

① 带引号断言加引号 ✅（码名 / 键名 / 路径 / 命令 / 常量 / 英文与越南语读数一律反引号）｜② 退出码不取管道后 ✅｜③ 本机无 `timeout` ✅｜④ 读数异常先怀疑自己 ✅（注册点 67 复核 = 与 v1.2 一致；`limit` 20/100 口径差已登记 §D6 / §8.15.3-72）｜⑤ **先骸架后回填** ✅（§10.10–§10.15 与 §8.15 一次成文、无占位）｜⑥ 报数带口径 ✅（行数 / 字节 / md5 + 非追加 3 处 / 追加 6 节）｜⑦ 凡「实测」可 `grep` 到 ✅（未测项显式 `NOT_MEASURED`；**Zang 读数标「转引」**）｜⑧ **立案 / 标签前必须自己复现一次** ✅（阈值三元组 / `stubWritesAllowed` 仅 `=== '1'` / `limit` 默认 100 / 回执五新键 / `validateFieldSet(subset,…)` / `TRANSLATABLE_SPECS` 四类 / 注册点 67 —— **均本册现取**）｜⑨ 只追加 + 就地订正留痕 ✅（**非追加 = 3 处**）｜⑩ 不改代码 / 不启停 / 不写库 / 无 `git` 写 ✅。
