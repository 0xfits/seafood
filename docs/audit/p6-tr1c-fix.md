# P6-TR-1c-FIX · 假译文/假缓存清洗 + stub 写库守卫 + DEF-01/DEF-02 阈值修复（交付报告）

> **⚠️ 报告来源声明**：本报告的**代码与清洗**部分由上一单（TR-1c-FIX）完成并经 Zang **亲核**；该单在**收尾阶段撞迭代上限被截断**，报告未落盘。
> 本文件由**截断后的收尾单 TR-1c-FIX-FIN** 补写：亲核事实**照录**（不重测、不改已改代码），收尾单**新增**部分在 §9 明确标注为「收尾单实测」。

- 分支/Repo：`/Users/kevin/bistro/seafood`（后端 `backend-ts`）
- 迁移 `0021_content_translation.sql`：**未改动**（零 DDL）
- 生效引擎：清洗与守卫为**离线/静态**面；真引擎复验用 `TRANSLATE_ENGINE=deepseek`（key 存在 ⇒ 判定为「存在」，**值不入本报告**）

---

## 0. 一句话结论

`content_translation` 里由 stub 引擎产生的 **14 行假译文已复位为 `pending`**（不删行）、`translation_cache` 里 **14 条假缓存已删除**；
stub 写库路径改为**真会中断**的守卫（默认拒绝写库、只返回内存态并给机读 `reason`）；
DEF-01（校验字段集口径）与 DEF-02（长度比阈值）已修，阈值收敛为 `en [0.3,6.0]` / `vn [0.3,6.0]` / `hk [0.5,2.5]`。
清洗后读回面 `GET /api/task/all` 的 **`^\[(en|vn)\] ` 前缀命中 = 0**；真引擎小批复验 `{processed:6, ready:6, failed:0, engine:"deepseek"}`。
`tsc --noEmit` **0 行**、离线套件 **121/121**、注册点 **67**、账本零位移。

---

## 1. 清洗前后计数（读数源：`.p4-artifacts/p6tr1cfix-20261001T044632Z/clean.json`）

脚本：`backend-ts/scripts/p4z-tr1c-fix-01-clean.ts`；假译文判定模式 `stub_pattern = "^\[(en|vn)\] "`。

| 计数项 | before | after | Δ |
|---|---|---|---|
| `content_translation` 总行数 | 270 | **270** | **0**（**不删行**，逐行复位） |
| 其中 文本命中 stub 模式 | 14 | **0** | −14 |
| 其中 `status='ready'` | 39 | **25** | −14 |
| 其中 `status='pending'` | 231 | **245** | +14 |
| 其中 `status='failed'` | 0 | 0 | 0 |
| 其中 `status='deferred'` | 0 | 0 | 0 |
| `translation_cache` 总行数 | 39 | **25** | −14 |
| 其中 文本命中 stub 模式 | 14 | **0** | −14 |
| 其中 `engine='stub'` | 14 | **0** | −14 |
| 其中 `engine='opencc'` | 14 | 14 | 0（确定性转繁，**不是**假译文） |
| 其中 `engine='deepseek'` | 11 | 11 | 0（真译文） |

DML 面：`dml.reset = 14`（`UPDATE … SET status='pending', text_out=NULL`）、`dml.deleted = 14`（`translation_cache` 删除）。

**口径与理由**
- 复位=「不删行」：`content_translation` 的主键就是幂等键，行数不变 ⇒ 后续 backfill 会**重新选中并真翻译**这些格子；删行会让「待译」变成「未登记」。
- 假缓存**必须删**：缓存命中即跳过付费调用，留着等于**永久固化假译文**。
- `engine='opencc'`（14）与 `deepseek`（11）**不在清洗范围**：前者是确定性转换、后者是真译文（`^\[(en|vn)\] ` 前缀为 stub 特征，二者都不可能命中）。

---

## 2. 守卫设计：为什么写成「真会中断」而不是「事后告警」

**落点**：`src/translate-service.ts` —— `stubWritesAllowed()` / `TRANSLATE_ALLOW_STUB_WRITES` / `STUB_WRITE_BLOCKED`。

**设计**：`engine='stub'` 时**默认拒绝写库**：不 `INSERT/UPDATE` 两张表，只在内存里返回 `texts/statuses`，并回一个**机读 reason**（`STUB_WRITE_BLOCKED`）；只有显式设了 `TRANSLATE_ALLOW_STUB_WRITES` 才放行。

**为什么必须是「真会中断」**（本单的根因教训）：
1. 上一轮 TR-1c 的端到端测试**用 stub 跑通**并写入真表 ⇒ 库面出现 `[en] 海鲜招工…` 这类假译文，且被 `i18n_status` 计入 `ready`，前端会**当成真译文渲染**；
2. 若守卫只「打日志/告警」，测试脚本照样写库 ⇒ **污染可再现**，等于没修；
3. 因此守卫必须在**唯一的写库落点上直接短路**（拒绝 + 机读 reason），使「stub 场景误写」成为**结构性不可能**，而不是「靠人记得加开关」；
4. 开关**默认关**（fail-closed）：默认值即安全值 ⇒ 线上/离线路径都不会意外开启；需要造假的测试必须**显式**声明意图。

离线断言（`p4z-tr1a-01-offline-tests.ts`，G8–G10 组，`stub-guard`）：默认路径下 `store.rows.size === 0 && store.cache.size === 0`（0 行 / 0 缓存），且返回机读 reason。

---

## 3. DEF-01（校验口径）修法

**缺陷**：原实现按「只带该语言单字段」去调 `validateFieldSet` ⇒ 字段集不完备，校验形同虚设（漏判/误判）。

**修法（现盘现状，已验收）**：**以完整字段集**调用 `validateFieldSet`，**再只取回该语言字段**。即：判定「这一批译文整体是否合规」用全字段集，写库只落单语言字段。

---

## 4. DEF-02（长度比幻觉闸）修法与最终阈值表

`LENGTH_RATIO_BOUNDS`（`src/translate-service.ts`）：

| lang | 下界 | 上界 | 语义 |
|---|---|---|---|
| `en` | **0.3** | **6.0** | 英译相对源中文字符数的合理带宽；上限抑制「模型复读/灌水」 |
| `vn` | **0.3** | **6.0** | 越南语同口径（含变音符号，字符数天然偏长） |
| `hk` | **0.5** | **2.5** | **繁体**是**同文转换**（OpenCC），字符数几乎等同源文 ⇒ 带宽必须收紧，防止「转繁顺带改写」 |

超界 ⇒ `reason='LENGTH_RATIO'`（判负、不写 ready）。
离线断言（`def02` 组）Q7 / Q9：中文 2 字源 + `'x'.repeat(40)`（比 20×）⇒ 必须 `LENGTH_RATIO`。

---

## 5. 真引擎复验读数（上一单已跑，读数源：`.p4-artifacts/p6tr1cfix-20261001T044825Z/real-e2e.json`）

### 5.1 路径 A：端点小批（`POST /api/translate/backfill {"mode":"translate","limit":6}`）

```
HTTP 200
response = {ok:true, mode:"translate", processed:6, ready:6, failed:0, skipped:0, deferred:0,
            reason:null, scanned:6, retried:2, engine:"deepseek"}
batch_entities = ["job:11","job:12"]   （job × title × en|vn|hk）
```

- **tokens 口径**：`NOT_MEASURED（端点跑在独立服务进程，本进程无法观测 usage）` —— **不是 0，也非空**。
- `llm_calls = 2`（本进程**可**观测的调用次数口径；端点内调用不可见）。

### 5.2 路径 B：定向真译（listing 19，CJK 源）

| 项 | 读数 |
|---|---|
| engine / model | `deepseek` / `deepseek-flash` |
| `api_key_present` | `true`（**只判存在，不打印值**） |
| `llm_calls` | **1**（实测） |
| `prompt_tokens` / `completion_tokens` | **327 / 581**（实测；`elapsed_ms=14588`） |
| `title` en / vn / hk | `Seafood Gift Box Test C: Shrimp and Crab Duo` / `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` / `海鮮禮盒測試丙：蝦蟹雙拼` |
| `description` en / vn / hk | `SF Express free shipping, contains 2 jin each of shrimp and crab, shipped via cold chain` / `Miễn phí vận chuyển SF Express, gồm 2 jin tôm và 2 jin cua, giao hàng bằng chuỗi lạnh` / `順豐包郵，含蝦蟹各兩斤，冷鏈發貨` |
| 断言 | `vn_title_status_ready` / `vn_desc_status_ready` / `en_majority_non_cjk` / `vn_has_diacritics` / `hk_is_traditional` / `hk_no_latin_only` / `no_stub_prefix` **全 true** |
| `stub_rows_in_listing_ct` | **0** |

> **tokens 口径总表**：`327 / 581`（路径 B）= **实测**；路径 A 端点内 usage = **`NOT_MEASURED`**（独立服务进程，观测不到）。
> 不做「路径 A 按路径 B 反推」的估算 —— 那是**推断**，不是实测。

### 5.3 清洗后读回面（`GET /api/task/all`，两次取样）

| 项 | 第 1 次 `…044728Z`（清洗后、真译前） | 第 2 次 `…044930Z`（真译后，主读数） |
|---|---|---|
| HTTP | 200 | 200 |
| 对象数 | 20 | 20 |
| **`^\[(en|vn)\] ` 前缀命中** | **0** | **0** |
| `i18n_status` 分布 | `{ready:3, partial:5, pending:12}` | **`{ready:3, partial:7, pending:10}`** |
| RB5（job 5/8/9/10/22 非 ready） | 全 `partial` | 全 `partial` |

> 两次分布差异来自**中间插入了一次真译**（job 11/12 的 title 由 `pending` → ready 使对应对象升为 `partial`），非清洗回退。

---

## 6. 红线自证（§5.7 硬口径）

| # | 红线 | 读数 |
|---|---|---|
| ① | `npx tsc --noEmit` ⇒ **0 行** | **`TSC_EXIT=0` / `TSC_LINES=0`**（收尾单现取，`> file 2>&1` 直接重定向，退出码非管道后取值；日志 `.p4-artifacts/p6tr1cfix-fin/tsc.log`）——详见 §9.3 |
| ② | 离线套件 ≥121 全绿 | **`OFFLINE_EXIT=0` / `total=121 passed=121 failed=0`**（收尾单现取；日志 `.p4-artifacts/p6tr1cfix-fin/offline.log`） |
| ③ | 注册点数 = 67 | **`ROUTES=67`**（收尾单现取，`grep -cE '^app\.(get\|post\|patch\|delete\|put)\(' src/index.ts`） |
| ④ | 账本零位移 | `Σ(account.balance, cid=1) = 1989693`、`ledger_entry = 267`（**口径 = Zang 亲核照录**；清洗与真译前后均不变。收尾单零 DML ⇒ 未重测） |
| ⑤ | 未动 `frontend/**` / `migrations/**` / `0021` / `vercel.json` | 本单零触碰；`vercel.json` 的 cron 只引用端点路径，**与 handler 内 `limit` 默认值无耦合** |
| ⑥ | 零新依赖 | `package.json` **未改** |
| ⑦ | 守恒/幂等 | 清洗**不删 `content_translation` 行**（270→270）；真译后 `stub_rows_in_listing_ct=0` |
| ⑧ | `NOT_MEASURED` 禁填 0/空 | 唯一处：路径 A 端点内 tokens（§5.1）标 `NOT_MEASURED` |
| ⑨ | 代码推断 ≠ 实测 | 「实测」均附 `grep`/`cat` 读数；未跑的一律写 `NOT_MEASURED` |

---

## 7. 残留与未测项（如实登记）

| # | 项 | 状态 |
|---|---|---|
| 1 | `llm_calls` 的 **usage/tokens** 在端点在独立进程时**无法观测** | **`NOT_MEASURED`**（§5.1）；非 0、非空 |
| 2 | 清洗留下的 245 条 `pending` 格子尚未全部真译（存量 276 行量级） | **未完成**（属运维节奏问题，见 §9 的 `limit` 默认值调整） |
| 3 | 路径 A 的 `retried=2` 是否含一次真实重试（429/5xx） | **未测定**（回执只给计数，不区分原因） |
| 4 | `docs/route-layer.spec.md:84 / :2174` 与 `docs/audit/route-layer-v1.2-delta.md:91`、`p6-tr1b-mapper-and-backfill.md:89`、`route-layer.spec.v1.2.md:84/2174` 仍记「`limit` 默认 20」 | **文档漂移**（spec 本单**禁写** ⇒ 只登记不修；现盘真值 = 100，见 §9） |
| 5 | `vercel.json` cron 每日 1 次 ⇒ 单日吞吐受 `limit` 与 `TRANSLATE_DAILY_ITEM_CAP` 双重约束 | 已登记（Vercel Hobby 每日 1 次的既有限制，TR-1b 报告已记） |

---

## 8. 变更文件清单（严格落在授权写路径内）

| 文件 | 性质 | 来源单 |
|---|---|---|
| `backend-ts/src/translate-service.ts` | stub 写库守卫 + `LENGTH_RATIO_BOUNDS` + DEF-01 字段集口径 | TR-1c-FIX（已验收） |
| `backend-ts/scripts/p4z-tr1c-fix-01-clean.ts` | 清洗脚本（复位 14 / 删 14） | TR-1c-FIX |
| `backend-ts/scripts/p4z-tr1c-fix-02-readback.ts` / `-03-real-e2e.ts` / `-00-probe.ts` | 读回与真引擎复验探针 | TR-1c-FIX |
| `backend-ts/.p4-artifacts/p6tr1cfix-*/**` | 读数产物 | TR-1c-FIX |
| `backend-ts/src/index.ts` | `limit` 默认值 20 ⇒ 100（**仅此一处**） | TR-1c-FIX-FIN（收尾单） |
| `backend-ts/scripts/p4z-tr1a-01-offline-tests.ts` | 同步断言值（**不删断言**；本单结论见 §9） | TR-1c-FIX-FIN（收尾单） |
| `docs/audit/p6-tr1c-fix.md` | 本报告 | TR-1c-FIX-FIN |

**未触碰**：`frontend/**`、`migrations/**`、`0021`、`vercel.json`、spec、master-plan、`.env*`、`package.json`。

---

## 9. 收尾单 TR-1c-FIX-FIN：`limit` 默认 20 ⇒ 100 + 亲测红线

> 本节内容**全部为本收尾单现取实测**（与 §1–§5 的「照录亲核事实」区分）。


### 9.1 改动：`limit` 默认值 20 ⇒ 100（上限**不变**）

- 落点：`backend-ts/src/index.ts:1747`（handler 内唯一的默认值取值点）：

```ts
const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, Math.floor(parsedLimit)) : 100;
```

- **上限 `Math.min(100, …)` 逐字未动**（显式 `limit=100` 与显式 `limit=500` 的行为与改前完全一致）。
- **理由**：存量 276 行量级 + cron 每日 1 次（`vercel.json` `0 18 * * *`）⇒ 默认 20 需**两周**才能清完；真正的成本闸是 `TRANSLATE_DAILY_ITEM_CAP=500`（每日条目上限），不是单次 `limit`。
- **与 `vercel.json` 无关联已核实**：`vercel.json` 的 `crons` 只引用端点**路径**（`/api/translate/backfill`），不含任何 `limit` 字段 ⇒ 本单**未改** `vercel.json`（`cat ../vercel.json` 现取核对）。

### 9.2 断言同步（**未删任何断言**）

| 检查 | 结论 | 证据（现取） |
|---|---|---|
| 离线套件是否有「默认 limit」断言 | **无** | `grep -nE "limit\|20\|100\|backfill" scripts/p4z-tr1a-01-offline-tests.ts` 全部命中行均非默认值断言：`:431/:434/:441/:448` 是**显式** `backfillPending(10, …)`；`:326/:330` 的 `20` 是 DEF-02 的**比值**（比 20× 幻觉）；`:147/:458` 的 `2000` 是 `max_chars_per_item`；`:260/:442/:457/:458` 为字符上限/`daily_item_cap` 默认闸 |
| 其它脚本的 `limit: 20` | **不动**（非默认值断言） | `p4z-tr1c-01-e2e-stub.ts:224/226` 是**显式传参** `body:{limit:20}` ⇒ 语义与改前一致，按最小改动保留 |
| 是否有脚本省略 `limit` 依赖默认值 | **无** | `grep -rnA2 "translate/backfill'" scripts/*.ts` ⇒ 全部调用点均显式带 `limit`（`20` 或 `6`） |

⇒ 本单对 `p4z-tr1a-01-offline-tests.ts` **零改动**（无值可同步），套件行数保持 121。

### 9.3 本单取到的红线读数（现取实测）

| # | 红线 | 读数（口径） |
|---|---|---|
| ① | `npx tsc --noEmit` | **`TSC_EXIT=0` / `TSC_LINES=0`**（`> .p4-artifacts/p6tr1cfix-fin/tsc.log 2>&1` **直接重定向**，退出码紧随其后取，**非管道后取值**） |
| ② | 离线套件 | **`OFFLINE_EXIT=0` / `SUMMARY total=121 passed=121 failed=0`**（日志 `…/p6tr1cfix-fin/offline.log`，产物 `.p4-artifacts/p6tr1a-20261001T045145Z/offline-tests.json`；**≥121 且 0 失败**） |
| ③ | 注册点数 | `grep -cE '^app\.(get\|post\|patch\|delete\|put)\(' src/index.ts` ⇒ **`ROUTES=67`**（改后不变） |
| ④ | 重启后读回 | `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` ⇒ `{"ok":true,"state":"running","pid":96867}`；随后 `GET http://127.0.0.1:5788/api/task/all?limit=500` ⇒ **HTTP 200 / 20 对象 / `^\[(en\|vn)\] ` 前缀命中 = 0**（改完**先重启再测**） |
| ⑤ | 账本 | 口径=**Zang 亲核照录**（`Σ(account.balance,cid=1)=1989693`、`ledger_entry=267`）；本单**零 DML**（只改 JS 默认值 + 写报告）⇒ 位移不可能，**未重测**（不冒充实测） |
| ⑥ | 授权写路径 | 仅 `src/index.ts`（§9.1 一处）+ 本报告；`frontend/**`、`migrations/**`、`vercel.json`、spec、master-plan、`.env*` **未触碰** |

### 9.4 ⚠️ 取样期间发现的外部真译进程（登记，非本单启动）

`ps` 现取：**另有一路 curl 正在循环调用真译端点**

```
curl -s -m 300 -X POST -H "Authorization: Bearer <值不入报告>" -H content-type: application/json
     -d '{"mode":"translate","limit":12}' http://127.0.0.1:5788/api/translate/backfill
```

- 影响：`i18n_status` 分布在本单取样窗口内**持续变化** —— `{ready:3, partial:7, pending:10}`（04:49:31，上一单读数）
  ⇒ **`{ready:8, partial:10, pending:2}`**（收尾单现取，**仍在增长**）。此为**外部进程**造成，与清洗/守卫无关。
- **未被清洗回退的证据**：`^\[(en|vn)\] ` 前缀命中在两次取样中**恒为 0**；分布变化方向是 `pending → ready/partial`（真译推进），非 `ready → pending`。
- 本单**未**干预该进程（红线禁 `pkill`/`killall`）；它同时意味着**账本/行数读数均为时点值**。

### 9.5 本单 `NOT_MEASURED` 登记（禁填 0/空）

| 项 | 状态 | 原因 |
|---|---|---|
| `limit` 默认分支的**运行时效果**（省略 `limit` ⇒ 真跑 100 行） | **`NOT_MEASURED`（受 DML 预算约束）** | 本单硬边界只放行「≤6 行复验」，而默认分支恰好是 **100 行**批量；且外部真译进程正在并发写同一批格子 ⇒ 实测既越界又不干净。本单只做**静态确认**（`src/index.ts:1747` 现取代码行），**不折算成实测** |
| 本单 `Σ/ledger_entry` 重测 | **未重测**（照录亲核值） | 本单零 DML，重测无信息增量；按 §5.7-⑥ 不把「代码推断」写成「实测」 |

