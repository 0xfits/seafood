# P6-TR-1c-B · 存量登记 + 真 DeepSeek 端到端（交付报告）

> 单元：**P6-TR-1c-B**（执行方 Kong）· 日期 **2026-10-01** · 模型 `deepseek-flash` · 引擎 `engine=deepseek`（**真调用**）
> 本报告所有读数均为**本机现取**；凡未观测者一律标 `NOT_MEASURED`（不填 0/空）。§5.7 口径：退出码不经管道取；本机无 `timeout`；报告落盘后不覆盖。

---

## 0. 结论（一句话）

- **① 存量登记入口已交付且幂等已证**：`POST /api/translate/backfill` 新增 `mode` 三态（`scan` / `translate` / `scan_translate`＝缺省），真库推导候选 **276** 条 `(entity,field,lang)` 组合并补 `pending` 行；**连跑两次第二次 `scan_registered=0`、行数不增、零 API 付费**（`0 → 276 → 276`）。
- **② 真引擎端到端已跑通**：真 `backfill`（1 次 `chat/completions`，**533 tokens**）产出真译文；`title_en`=**real English**、`title_hk`=**真繁体**、`i18n_status` 由 `pending → partial` 读回通过。**但 `vn` 行与部分 `en` 行被 spec 闸判负**（见 §5 两个缺陷）。
- **③ 可观测性 + 收尾已完成**：回执新增键且**未删旧键**；`residual` 已登记；存量译文行**零删除**；账本 `Δledger_entry=0`、`Σ(balance,cid=1)=1989693` 不变。
- **未擅自改 spec 语义**：发现的闸缺陷**只登记不修**（§5 DEF-02）；DEF-01 为纯实现缺陷（**未修，登记一行修法**，避免在本单越权改服务层逻辑）。

---

## 1. 根因与交付物①：存量登记（缺口修复）

### 1.1 根因（现取证据）

`backend-ts/.p4-artifacts/p6tr1c-20261001T042904Z-recon/recon.json`：

| 读数 | 值 |
|---|---|
| `content_translation` 行数（改前） | **0** |
| `translation_cache` 行数（改前） | 6（4 条 `engine='stub'` 假缓存 + 2 条 `engine='opencc'`） |
| 存量可译内容 | `job` 20（title 20 / description 13）、`listing` 22（22 / 17）、`users.bio` 7、`currency.name` 13 |
| 候选组合（真库推导） | **276** = job 99 + listing 117 + user 21 + currency 39 |

⇒ 行**只在写入时登记**（TR-1c-A 写路径）⇒ **存量 276 个组合一行都没有** ⇒ `backfillPending` 扫不到 ⇒ 存量永不翻译。**缺口成立**。

### 1.2 交付

- `src/translate-service.ts`（+111/−0）：新增 `TRANSLATABLE_SPECS`（四类真库白名单：`job(title,description)` / `listing(title,description)` / `users(bio)` / `currency(name)`）、`buildScanInsertSql()`（**单语句** `INSERT … SELECT … ON CONFLICT DO NOTHING RETURNING 1`，同语句回 `scanned`+`registered`；**语句内无 DELETE/UPDATE**）、`createDbContentScanner()`、`scanRegisterPending()`（端口可注入）。
- `src/index.ts`（+38/−13）：`POST /api/translate/backfill` 增 `mode`；**鉴权口径完全沿用**（`x-cron-secret` / `Bearer`，未配 `CRON_SECRET` ⇒ 503 fail-loud）。

### 1.3 幂等证明（真库、真 HTTP）

`…/p6tr1c-20261001T043220Z-real/e2e.json`（首轮）+ `…T043804Z-real/e2e.json`（终轮）：

| run | `mode=scan` #1 | `mode=scan` #2 | `content_translation` 行数 |
|---|---|---|---|
| 首轮 | `scanned=276` / `registered=276` / `existing=0` | `scanned=276` / `registered=0` / `existing=276` | `0 → 276 → 276` |
| 终轮 | `scanned=276` / `registered=0` / `existing=276` | 同上 | `276 → 276 → 276` |

- **推导走真库**：`scanned` 由 `SELECT … FROM public.job|listing|users|currency` 现取，非固定列表/硬编码 id；`by_entity` 逐类分解齐（job 99 / listing 117 / user 21 / currency 39）。
- **幂等**：`scan_registered=0`（第二次）、DB 行数不增；**scan 不调引擎**（代码面 `scanRegisterPending` 无 LLM 路径）⇒ **不重复付费**。

---

## 2. 交付物②：真引擎端到端（成本克制）

脚本：`scripts/p4z-tr1c-07-real-e2e.ts`（终版，`E2E_EXIT=0`，**29/29 PASS**）。

### 2.1 本次实际成本（有据）

| 项 | 读数 | 来源 |
|---|---|---|
| **真调用次数** | **1 次** `chat/completions`（HTTP 200，无 429/5xx 重试） | `real_backfill.usage.llm_calls=1`、`http_statuses=[200]` |
| **tokens** | **533**（prompt 322 + completion 211） | 同上（取自响应 `usage`） |
| **落库 ready** | **3 条**（`title.en` 缓存命中 + `title.hk`/`description.hk` OpenCC） | `real_backfill.report.ready=3` |
| 批处理 | `title`+`description` 的 en/vn 合并 1 次调用；`hk` 走 OpenCC（**0 付费**） | 代码面 + 读数 |
| HTTP 路由面第 2 次真跑 | 1 次（`mode=translate`，`ready=6`，cache `12→18`） | `http_route_translate` |
| HTTP 路由面的 tokens | `NOT_MEASURED`（调用发生在服务进程内，客户端不可观测） | — |
| **本单累计真调用** | ≈ 8 次（含 2 次诊断探针 + 3 轮 e2e 各 1–2 次） | 各轮日志 |

### 2.2 引擎产出（真译文，与是否落库解耦）

`engine_output.raw_head`（终轮原文）：

```json
{"description":{"en":"Responsible for daily inventory counts and shelf organizing; lunch provided",
                "vn":"Chịu trách nhiệm kiểm kê hàng ngày và sắp xếp kệ hàng, bao ăn trưa"},
 "title":{"vn":"Tuyển dụng hải sản thử nghiệm A: Sắp xếp kệ hàng và kiểm kê"}}
```

- `en` **真英文**（非 CJK）；`vn` **含越南语声调字符**（`ị/ệ/ằ/ắ/ả/ụ/ă`）——断言 `P3.3`/`P3.4` PASS。
- `hk` = OpenCC 确定性繁体；`toTraditional('招聘服务员') === '招聘服務員'` **PASS**（`P3.8`）。

### 2.3 落库与 API 读回

| `content_translation`（job 24） | status | text |
|---|---|---|
| `title.en` | **ready** | `Seafood hiring test A: Shelving and inventory`（真英文） |
| `title.hk` | **ready** | `海鮮招工測試甲：整理貨架與盤點` |
| `description.hk` | **ready** | `負責每日盤點與貨架整理，包午餐` |
| `description.en` | failed | `KEY_SET_MISMATCH`（见 §5 DEF-01） |
| `title.vn` / `description.vn` | failed | `LENGTH_RATIO`（见 §5 DEF-02） |

`GET /api/task/all`（真读回，`job_read_after`）：

- `i18n_status`：**`pending` → `partial`** ✓
- `title_en` = `Seafood hiring test A: Shelving and inventory`（**真英文、非 CJK**）✓
- `title_hk` = `海鮮招工測試甲：整理貨架與盤點`（**真繁体**）✓
- `title_vn` = 源文回落（vn 行判负 ⇒ mapper 正确回落，**非**假译文）

---

## 3. 交付物③：可观测性 + 收尾

- **回执键（扩展、不删旧键）**：旧键 `ok/processed/ready/failed/skipped/deferred/reason/scanned/retried/engine` **逐字保留**；新增 `mode`、`scan_scanned`（扫到几条）、`scan_registered`（新登记几条）、`scan_existing`、`scan_by_entity`；「翻译几条」= `processed`/`ready`。**三态可区分**：`mode=scan`（实测 `processed=0, engine=null`）、`mode=translate`（`scan_*=null`）、缺省 `scan_translate`。
- **`residual` 登记**：本 run **零新建 `job`/`listing` 行**（20/22 前后一致）⇒ 无 DL79 残余；删除项仅 `translation_cache` 的 **4 条 `engine='stub'` 假缓存**（TR-1b 探针残留；见 §6 披露），**`content_translation` 译文行删除 0 条**、保留 **276** 条。
- **未删存量译文行** ✓；`hk` 行未被二次回填降级（`P5.4`）。

---

## 4. 红线自证（现取）

| # | 红线 | 读数 | 命令/来源 |
|---|---|---|---|
| ① | `npx tsc --noEmit` | **`TSC_EXIT=0` / 0 行** | `.p4-artifacts/p6tr1c-B-build/tsc.log`（`wc -l`=0） |
| ② | 离线套件 | **`total=101 passed=101 failed=0` / `SUITE_EXIT=0`** | `p4z-tr1a-01-offline-tests.ts`（96→**101**，**只增不减**：新增 `M1/M2/M2b/M3/M4`） |
| ③ | 注册点（现取） | **67**（`grep -cE "^app\.(get\|post\|put\|patch\|delete)\("`）——**未新增端点** ⇒ 67 不变 | `backend-ts/src/index.ts` |
| ④ | 账本 | **`Δledger_entry = 0`（267→267）**、**`Σ(account.balance, cid=1) = 1989693` 不变** | `e2e.json` `before/after`（口径 `sum(balance) where cid=1`，**不含 frozen**） |
| ⑤ | 未动禁区 | `git status` 仅 `backend-ts/src/{index,translate-service}.ts` + `scripts/p4z-tr1a-01-offline-tests.ts` + 新 `scripts/p4z-tr1c-*.ts` + `.p4-artifacts/**`；**`frontend/**`、`migrations/**`、`0021`、`vercel.json`、spec、`docs/seafood.master-plan.md` 零触碰** | `git status --porcelain`；`git diff --numstat` = `index.ts 38/13`、`translate-service.ts 111/0` |
| ⑥ | 零新增依赖 | 未改 `package.json` / lockfile | `git status` |
| 安全 | 密钥 | `DEEPSEEK_API_KEY` / `CRON_SECRET` **只判存在**（`*_present: true`），**零值写入/打印**；`.env.local` 未打印；无 `pkill`/`killall` | `preflight` 读数、产物扫描 |

> 服务重启（§5.7⑦）：改完经面板 `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` ⇒ `pid=66436`、`/api/health=200`，**先重启后测**。

---

## 5. ⚠️ 发现的两个缺陷（已登记，**未擅自修**）

### DEF-TR1C-B-01 · 部分缓存命中 ⇒ 误判 `KEY_SET_MISMATCH`（纯实现缺陷）

- **现象**：`description.en` 落 `failed/KEY_SET_MISMATCH`，而引擎原文**结构正确**。
- **根因**：`translateFields` 逐目标语言用**字段子集**校验（`targetSubset = { f : misses[f].includes(t) }`，`translate-service.ts:657-663`），而引擎按提示词返回**全部请求字段** ⇒ 当「`title` 只缺 vn（en 缓存命中）、`description` 缺 en+vn」时，en 侧比 `{description}` vs 响应 `{title,description}` ⇒ **误判**。
- **症状面**：任何**部分缓存命中**（重试/部分成功后的自然态）都会误杀该语言的整批 → ready 率被系统性拉低。
- **一行修法（未应用）**：以**完整 `subset`** 调 `validateFieldSet(subset, t, raw)`，落库时**只取**需要该语言的字段值（`values`/`errors` 已按字段索引，无需其他改动）。
- **证据**：`ct_rows_job`（`description:en=KEY_SET_MISMATCH`）、`engine_output.raw_head`。

### DEF-TR1C-B-02 · spec 长度比闸 `[0.3, 3.0]` 对 zh→en/vn **短文本系统性判负**（**spec 已列值 ⇒ 待裁，不擅改**）

- **现象**：`title.vn`/`description.vn` 落 `failed/LENGTH_RATIO`；引擎 vn 译文本身**正确且含声调**。
- **根因**：「长度比」按**码点比**度量（`LENGTH_RATIO_MIN/MAX = 0.3/3.0`，`translate-service.ts:208-209`；spec `route-layer.spec §10:2142`）；中文单字信息密度高 ⇒ zh→en/vn 自然比实测 **3.7–5.2**（本单读数：`vn_title 3.933`、probe 4.133/4.200/4.667、desc en 4.600）⇒ **合法译文被判负**。
- **影响**：**en/vn 行在短内容上几乎无法 ready** ⇒ 「存量登记 + 回填」跑完仍大量 `failed`，`i18n_status` 长期停在 `partial`。这是本单**最重的可用性阻塞**。
- **候选处置（待 Kevin/Jing 裁定）**：①上限 `3.0 → 5.0/6.0`（离线判负用例 `C4-neg 0.27` / `C5-neg 19.5` 仍判负 ⇒ 闸不失效）；②按目标语言分阈值（en/vn 放宽、hk 不受影响）；③改用 **token/词数** 度量替代码点比。
- **证据**：`engine_output.ratios`、`gate_rejections`。

### REQ-2-vn · 由此导致的验收阻塞

需求②「`vn` 含越南语声调**且行 ready**」在现行 spec 闸下**不可达**（引擎产出已证正确）。本单如实登记为阻塞项，`e2e.json.blockers` 计 3 条（DEF-01、DEF-02、REQ-2-vn）。

---

## 6. 披露：一处测试控制 + 一处小清理

1. **复位 6 行（仅复位不删行）**：为让真引擎样本**确定**，终轮把 job 24 的 6 行**复位为 `pending`（text=NULL, attempts=0）并置 `updated_at` 最早**（仅影响 `listPending` 排序；本 run 由 backfill 立即重建，终态见 §2.3）。这是本 run 自造数据的测试控制，**非删行**。
2. **删除 4 条 `engine='stub'` 假缓存**：TR-1b 探针在 job 24 的源文本上留下 `[en] 海鲜…`/`[vn] 海鲜…` 假缓存；不清则**该对象永远命中假缓存、永不产生真译文**（结构性投毒）。`DELETE … WHERE engine='stub'` **只命中假缓存**，`content_translation` 译文行**零删除**。⚠️ 建议自查：库内是否还有其它 `engine='stub'` 残留（`SELECT count(*) FROM translation_cache WHERE engine='stub'`，本单清理后 = **0**）。

---

## 7. 文件清单（`git status` 现取）

| 文件 | 改动 |
|---|---|
| `backend-ts/src/translate-service.ts` | +111/−0（扫描登记节） |
| `backend-ts/src/index.ts` | +38/−13（`mode` 三态 + 回执新键） |
| `backend-ts/scripts/p4z-tr1a-01-offline-tests.ts` | 离线套件 96→101（**只增**；新增 `M` 组） |
| `backend-ts/scripts/p4z-tr1c-00-recon.ts` | 新增（真库侦察，只读） |
| `backend-ts/scripts/p4z-tr1c-02-real-e2e.ts` | 首版 e2e（断言过严，产生 2 条脚本级 FAIL）；已被 `07` 取代并**删除**（其产物 `…T043220Z-real/` 留痕） |
| `backend-ts/scripts/p4z-tr1c-03-dump-ct.ts` | 新增（诊断 dump，只读） |
| `backend-ts/scripts/p4z-tr1c-06-probe-llm.ts` | 新增（真引擎单次诊断，`store=null` 不落库） |
| `backend-ts/scripts/p4z-tr1c-07-real-e2e.ts` | 新增（**终版 e2e，29/29 PASS**） |
| `backend-ts/.p4-artifacts/p6tr1c-*/**` | 产物（recon / probe / e2e / tsc.log / offline.log） |
| `docs/audit/p6-tr1c-b-real-engine.md` | 本报告 |

---

## 8. 建议下一步（交 Kevin/Jing）

1. **裁定 DEF-02**（长度比闸）——不裁则 en/vn 翻译线在短内容上不可用。
2. **授权修 DEF-01**（一行；`translateFields` 部分缓存命中路径）——可并入同批并补一条离线单测。
3. 若采纳 DEF-02 的放宽值，需同步更新 spec §10 与 `translate-service.ts:208` 常量、并复算离线套件 `C4-neg/C5-neg`。
4. **存量回填放量**：本单只跑 `limit ≤ 6`（成本克制）；清障后可按 `TRANSLATE_DAILY_ITEM_CAP=500` 分批回填 276 条（当前候选全集）。
