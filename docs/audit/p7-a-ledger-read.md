# 批 7-A · `GET /api/user/ledger` 读口交付报告（`p7-a-ledger-read`）

> 角色 = **Kong**（Builder） · 轮次 = **批 7-A 第三轮（收口单二）**
> 仓库 = `/Users/kevin/bistro/seafood` · 分支 = `main` · 基线 HEAD = `2766bc009a6cee21bc5abc16297da5c8d53ee648`
> 本报告**分段落盘**（先骨架，后逐节回填），不以一次性写入收尾。
> 硬口径：身份表一律 `users`；SQL 表引用显式 `public.`；未做项写原因、禁填 0/空；转引不得冒充实测。

---

## §0 开工态与未回退声明

**上一轮（批 7-A 第二轮）已达成、本轮不得回退项**（开工现取 sha 存证）：

| 件 | 开工 sha256 | 状态 |
|---|---|---|
| `backend-ts/src/database.ts` | `c10bfc18115c9c8a0c452973fe348dd1a5544233182eb875bef768943abf2cc7` | 保留（本轮前后逐字相等，见 §4 d） |
| `backend-ts/src/index.ts` | `9aa68157b2e463450ea5ac2a17f7fcd133a01ac2311a947ef0bb01cb9f63d2ec` | 保留 |
| `frontend/src/locales/zh.json` | `31ca0d2778306827a06f10a4dffc1ddb75f314ab5416bb852970bd2307c3e42b` | 本轮改 1 值（§6 留痕） |
| `frontend/src/locales/en.json` | `4a5686ee92090737825b4232a251884bd28f1ce6fa349c5776bb48d925722e09` | 本轮改 1 值 |
| `frontend/src/locales/hk.json` | `ea4f8d91221f8cbf7008cef4be54d517c3e7f013006b60346a4eba324fc934da` | 本轮改 1 值 |
| `frontend/src/locales/vn.json` | `36c3a2bcb083fd324aa46562e92ebe31f79362bed60943cb720f00bc43bbc325` | 本轮改 1 值 |
| `frontend/src/test/unit/i18n-violation-closeout.test.jsx` | `9d80b7b19d10eec458063bdc358d1a5092f212ae4300f93c84f3780cd1233dbb` | 本轮改 1 锚（§6 留痕） |
| `frontend/scripts/p4z-feperf-safelist.mjs` | `9fd45a8501997afcb909b776c824a8a0d5c894dfa83fd41ae7696398755c3134` | 保留（`exitCode` 改动） |
| `frontend/scripts/p4z-i18nviol-global.mjs` | `bd9ccef573f5e05ba17acd26d97fe9d593a5e7d222b3e4905884bdb66ff1058a` | 保留 |
| `frontend/scripts/p4z-miscfix-links.mjs` | `5183d7b8db201f8ec5fa794abb1952ef5fed2a6b060e78ee45deb938ca5026af` | 保留 |
| `frontend/scripts/p6-tr2-i18n-locales.mjs` | `ed6151f763133d28a48aaa528b44bf97a2e68d9e5fac1308084091d8dd14c579` | 保留 |

**未回退声明（逐字）**：上一轮的 ① 四语 locale 键（**+21，flat 683 → 704，四语严格相等**）、② 陈旧断言改写、③ 新增行为测试 5 例、④ 四条硬门 + 四脚本全绿（`tsc` 0 / 离线 **126/126** / `build` 0 / `test:unit` **27 files 243 passed** / 四脚本 PASS）、⑤ 四个门脚本的 `process.exit(x)` → `process.exitCode = x` —— **均未回退、未重写**。（本轮唯一动 locale/测试的动作 = §3 的 `ledger.flowEmpty` 文案与 1 处等义改锚，逐处留痕于 §6。）

**本轮只做**：① AC8 判负自证执行（变异已落盘，本轮**实跑探针**）；② 本报告；③ `ledger.flowEmpty` 四语文案落位 + 1 锚等义下移；④ 四脚本判负自证；⑤ 硬门重跑；⑥ 自起实例按**精确 PID** 收尾。

---

## §1 现取契约与消费点

**注册点 = 68**（现取：`grep -nE "^\s*app\.(get|post|put|patch|delete)\(" backend-ts/src/index.ts | wc -l` → **68**；verb 分解 = get 27 / post 38 / put 0 / patch 1 / delete 2）。
**本单端点**：`backend-ts/src/index.ts:633` = `app.get('/api/user/ledger', async (req, res) => {`。
**鉴权**：路由体内 `const actor = await requireActor(req, res); if (!actor) return;`（无 token / 坏 token ⇒ 401，走既有 R107 信封）。
**过滤**：`LEDGER_KINDS` **关闭集 = 20 个**（`backend-ts/src/ledger.ts:153-160`：mint/burn/transfer/hold/hold_release/hold_forfeit/job_escrow/job_escrow_refund/job_payout/job_fee/commission/purchase/sale/purchase_refund/trade/trade_fee/listing_fee/listing_deposit/currency_create_fee/reversal）；非法 `kind` ⇒ 400 `LEDGER_UNKNOWN_KIND`；`limit` 默认 100 / 上限 500；`before_txid` = keyset 游标。

### §1.1 ★ 运行时真源冲突（逐字登记，上一轮报回）

- **spec 记 65 行注册表 vs 运行时真源 67 → 68**：`docs/route-layer.spec.md`（正被另一子代理并发改写，本单**绝不触碰**）记录注册点 **65**（v1.1/v1.2 段），而**运行时真源** `backend-ts/src/index.ts` 现取 **68**（P6-TR-2 线 65 → 67，批 7-A 本单 +1 = `/api/user/ledger` ⇒ 68）。spec 落后 3 个注册点。
- **`ShardPage.jsx:303` 不存在**：`frontend/src/pages/ShardPage.jsx` 现取仅 **19 行**（桩文件，行 9 注释写明「本读口语义已由已注册路径 `GET /api/user/ledger?kind=transfer` 取代」）⇒ 该文件不存在 `:303` 行。
- **真实消费点 = `market/MarketPage.jsx` 的 `data-sf-m="mkt-ledger"` 面板**：`frontend/src/pages/market/MarketPage.jsx:369` = `<div className="sf-mkt-panel" data-sf-m="mkt-ledger">`；空态渲染 `:372` = `{ledger.message || t('ledger.flowEmpty')}`；列表 `:374`（`mkt-ledger-list`）/ 条目 `:376`（`mkt-ledger-item`）/ 更多 `:389`（`mkt-ledger-more`）。**⇒ `/api/user/ledger` 的用户可见消费面 = 市场页账本面板 + 其 `ledger.flowEmpty` 空态文案**。

## §2 改动清单（`git diff --numstat` 逐文件 · 现取终态）

**A. 已跟踪文件（`git diff --numstat`，制表 = 增/删/路径）**：

```
106  0   backend-ts/src/database.ts
93   0   backend-ts/src/index.ts
199  0   docs/route-layer.spec.md          ← 另一子代理并发改写（本单绝不触碰）
2    1   frontend/scripts/p4z-feperf-safelist.mjs   ← exitCode 改（上轮）
3    1   frontend/scripts/p4z-i18nviol-global.mjs   ← exitCode 改（上轮）
2    1   frontend/scripts/p4z-miscfix-links.mjs     ← exitCode 改（上轮）
2    1   frontend/scripts/p6-tr2-i18n-locales.mjs   ← exitCode 改（上轮）
24   1   frontend/src/locales/en.json
24   1   frontend/src/locales/hk.json
24   1   frontend/src/locales/vn.json
24   1   frontend/src/locales/zh.json
53   2   frontend/src/pages/ProfilePage.jsx
5    3   frontend/src/pages/ShardPage.jsx
64   5   frontend/src/pages/market/MarketPage.jsx
1    1   frontend/src/test/unit/i18n-batch-b4a.test.jsx
3    3   frontend/src/test/unit/i18n-batch-b4b.test.jsx
3    3   frontend/src/test/unit/i18n-batch-b5.test.jsx
7    4   frontend/src/test/unit/i18n-violation-closeout.test.jsx
39   4   frontend/src/test/unit/listing-market.test.jsx
```

**B. 未跟踪新增件（本批 · `git status`）**：`backend-ts/scripts/p7a-00-recon.ts`、`p7a-00b-users.ts`、`p7a-01-http.ts`、`p7a-02-negctl.ts`（**本轮新增**）、`backend-ts/.p7a-artifacts/`（产物）、`frontend/src/ledger-api.js`、`frontend/src/test/unit/ledger-flow-behavior.test.jsx`、`docs/audit/p7-a-ledger-read.md`（**本轮新增**）。另 `docs/audit/route-layer-v1.7-delta.md` / `docs/versions/route-layer.spec.v1.7.md` = **另一子代理**产物，非本单。

**C. 本轮（第三轮）自有 delta（逐行）**：

1. `frontend/src/locales/{zh,en,hk,vn}.json` —— 各 **1 行值** 改动（`ledger.flowEmpty`，见 §6 留痕）；numstat 的 `24/1` 中 **23 增 1 删 = 前两轮已达成**，本轮仅再改这 1 值（删 1 行 + 增 1 行，仍显 `24/1`）。
2. `frontend/test/unit/i18n-violation-closeout.test.jsx` —— `7/4`（前轮 `4/3`）：本轮在该件 105 行区**删 1 行 + 加 3 行**（原因注释 1 行 + 新断言 2 行）。
3. 新增 `backend-ts/scripts/p7a-02-negctl.ts`（判负探针）、`docs/audit/p7-a-ledger-read.md`（本报告）。

**D. 非追加改动 / 回退声明**：**回退已完成部分 = 0 处**。本单未触碰 `migrations/**`、任何 `docs/*.spec.md`（含正被并发改写的 `route-layer.spec.md`）、`docs/seafood.master-plan.md`、`docs/audit/**` 既有件；未 `git add/commit/push`；未 `npm install`；未碰 `.env*`。

## §3 AC 逐格读数

> 读数来源标注：`[E2E-002]` = 上一轮真实 HTTP 实测（`backend-ts/.p7a-artifacts/P7A-E2E-002/`，**逐字保留**）；`[E2E-003]` = 本轮复原后主工作区真实例（`P7A-E2E-003/`）；`[NEGA]` / `[NEGB]` = 本轮判负实例；`[GATES]` = 本轮硬门。**判据均由探针脚本自身给出，退出码在管道外捕获。**

| AC | 判据 | 读数 | 来源 |
|---|---|---|---|
| **注册** | 路径已注册（非 404） | `status=200, not_404=true` | `[E2E-003]` / `[E2E-002]` |
| **鉴权** | 无 token ⇒ 401 + R107 形状 | `status=401`；`error_keys=[code,message,i18n_key,details]`；`code=AUTH_UNAUTHORIZED`；`error_shape_ok=true` | `[E2E-002]` |
| | 坏 token ⇒ 401 | `status=401, code=AUTH_UNAUTHORIZED` | `[E2E-002]` |
| | 真 token ⇒ 200 | `status=200`；顶层键 `[success,message,data,next_before_txid]` | `[E2E-002]` |
| **keyset** | 3 页无重 / 严格递减 / 逐字=DB 降序前 N | `flat=[270,269,268,267,265,264,247,245,243,241,239,237,235,233,231,229,227,225,224,223,221]`；`strictly_decreasing=true`；`no_duplicate=true`；`matches_db_head_prefix=true` | `[E2E-002]`（`[E2E-003]` 逐字相同） |
| | 到尾页 ⇒ `next_before_txid=null` | `count=120, next_before_txid=null` | `[E2E-002]` |
| **过滤** | `kind=transfer` 逐字=DB | `count=6/db=6, only_transfer=true, txids_match_db=true` | `[E2E-002]` |
| | `cid` 逐字=DB | `cid=1, count=89/db=89, all_same_cid=true` | `[E2E-002]` |
| | `limit` 默认 100 / 上限 500 / 非法不 500 | `default count=100`；`cap count=120(=min(500,120))`；`limit=abc ⇒ 200` | `[E2E-002]` |
| | `cid`/`before_txid`/`kind` 非法 ⇒ 400 | `cid=abc⇒400`；`before_txid=xyz⇒400`；`kind=__nope__⇒400 code=LEDGER_UNKNOWN_KIND` | `[E2E-002]`（`[E2E-003]` 同） |
| | 只看自己（不串号） | `only_self=true` | `[E2E-002]` |
| **零写副作用** | ≥20 次调用前后四表计数/Σ/public 表数·索引数逐字不变 | `calls=24`；`identical=true`；`public_tables 25→25`；`public_indexes 65→65` | `[E2E-002]`（`[E2E-003]` 同） |
| | **强探针**（基线取在首个调用前） | `[NEGCTL-MAIN-001]`：`verdict=GREEN, violations=[], cleanup_ok=true, public_tables 25→25` | 本轮 |
| **账本零位移** | Σbalance cid=1 / ledger_entry 行数不变 | `271→271`；`Σ(cid=1) 1989693→1989693` | `[E2E-002]` |
| **前端行为** | 新增行为测试 5 例 + `flowEmpty` 空态语义 | `ledger-flow-behavior.test.jsx` 5 例（上轮）；本轮 `flowEmpty` 四语由「功能未开放」→「暂无记录 + 交易后显示」（§6 留痕） | 上轮 / 本轮 |
| **硬门** | 见 §3.1 | — | `[GATES]` |

**§3.1 硬门读数（`[GATES]` = `.p7a-artifacts/P7A-GATES-001/`）**：

| 门 | 命令 | 退出码 | 读数 |
|---|---|---|---|
| tsc | `npx tsc --noEmit`（backend-ts） | **0** | 无诊断输出 |
| 离线 | `npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | **0** | `SUMMARY total=126 passed=126 failed=0` |
| build | `npm run build`（frontend） | **0** | `✓ built in 1.68s` |
| test:unit | `npm run test:unit` | **0** | `Test Files 27 passed (27)` / `Tests 243 passed (243)`（**≥243 不掉**） |
| 脚本① | `node scripts/p4z-i18nviol-global.mjs` | **0** | `总判：PASS`（locale 2816 / source 37） |
| 脚本② | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `总判：PASS` |
| 脚本③ | `node scripts/p4z-miscfix-links.mjs` | **0** | `总判：PASS（残留全部已登记）` |
| 脚本④ | `node scripts/p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS` |

## §4 判负自证（本轮实跑）

### §4.1 ① AC8 判负自证（上轮唯一硬缺口 · 本轮补齐）

变异件落仓外副本 `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7a-neg/{A,B}`（`src/` 全树副本 + `node_modules`/`.env.local` 符号链接；`src/index.ts` 与主工作区逐字相同）。端口只用 **5793–5799**，未改主工作区。

**(a) NEG/A（删 keyset 游标谓词）** —— `database.ts:1084` 的 `AND (${beforeTxid}::bigint IS NULL OR le.txid < ${beforeTxid}::bigint)` 被删。
- 实例：`PORT=5793`，`lsof` 报 **精确 PID = 92502**。
- 探针：`ts-node scripts/p7a-01-http.ts $ART/P7A-NEGA-001 http://127.0.0.1:5793` ⇒ **`EXIT=1`，`VERDICT FAIL failures=3`**。
- **红读数**：`strictly_decreasing=false` / `no_duplicate=false` / `matches_db_head_prefix=false`；`flat=[270,269,268,267,265,264,247,` ×3 重复 `]`（第 2/3 页与第 1 页**逐字相同**，因游标谓词失效忽略 `before_txid`），`db_head=[270,269,268,267,265,264,247,245,243,…,221]`（21 项）⇒ 三页合计 21 项中 14 项为**重复**、且缺失 7 个真 txid。

**(b) NEG/B（只读路径注入写副作用）** —— `database.ts` 读路径内注入 `CREATE TABLE IF NOT EXISTS public.p7a_neg_probe (x int)` + `INSERT INTO public.p7a_neg_probe VALUES (1)`。
- 实例：`PORT=5794`，`lsof` 报 **精确 PID = 94059**。
- 探针：`ts-node scripts/p7a-02-negctl.ts $ART/P7A-NEGB-001 http://127.0.0.1:5794` ⇒ **`EXIT=1`，`verdict=RED`**。
- **红读数**：基线（首调用前）`public_tables=25, public_indexes=65, probe_exists=false`；24 次只读调用后 `public_tables=26, public_indexes=65, probe_exists=true, probe_rows=24`；`violations=["public.p7a_neg_probe 出现（只读面建表）","public 表数 25 → 26"]`。
- **测后收尾**：探针脚本 `DROP TABLE IF EXISTS public.p7a_neg_probe` ⇒ `after_cleanup={public_tables:25, public_indexes:65, probe_exists:false}`、`cleanup_ok=true`；**独立复核**（另起一条只读查询）`POST_B_DROP public_tables=25 probe_exists=false` ⇒ **回 25**。

**(c) 复原清度 + 回绿** ——
- 复原：`cp` 主工作区 `database.ts` 覆盖 A、B。逐字节校：A `fe28670d…` / B `2ae7b258…` ⇒ 复原后**两者均 = `c10bfc18115c9c8a0c452973fe348dd1a5544233182eb875bef768943abf2cc7`**；`cmp A B vs main` 均 → `A_IDENTICAL` / `B_IDENTICAL`（无差异）。
- 回绿：主工作区真实例 `PORT=5795`（PID **95290**），`ts-node scripts/p7a-01-http.ts $ART/P7A-E2E-003 …` ⇒ **`EXIT=0`，`VERDICT PASS failures=0`**。
- **同器判正**：把 (b) 的**同一**判负探针跑在主工作区真实例上 ⇒ `verdict=GREEN, violations=[]`（同一仪器：变异体判红、真代码判绿）。

**(d) 主工作区零污染** —— `backend-ts/src/database.ts` sha256 本轮前后**逐字相等** = `c10bfc18115c9c8a0c452973fe348dd1a5544233182eb875bef768943abf2cc7`。

**(e) 收尾（精确 PID · 禁 `pkill -f`/`killall`）** —— `kill -TERM 92502 / 94059 / 95290`；`ps -p <PID>` 三者均 `GONE`；`lsof -nP -iTCP:{5793..5799} -sTCP:LISTEN` **七端口全空**。未启停 5787/5788（5788 为**既有** dev 进程 PID 65096，属他单，未触碰）。

### §4.2 ④ 四脚本判负自证（`process.exit → process.exitCode` 改了「门本体」，故须自证门仍会响）

方法：**仓外镜像** `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7a-r3/`（复制脚本 + `src` 全树 / `dist`），注入**一处真违规** ⇒ 跑门 ⇒ **非零退出**；复原 ⇒ **回 0**。

| 门脚本 | 注入的真违规 | 判负退出码 | 判负读数 | 复原退出码 |
|---|---|---|---|---|
| `p4z-i18nviol-global.mjs` | `zh.locales` 值塞工程口径串 `余额（GET /api/user/ledger 未注册）` | **1** | `locale 裸命中 3 → 总判 FAIL` | **0** |
| `p6-tr2-i18n-locales.mjs` | 删 `vn.i18n.translating` 键 | **1** | `键集相等 FAIL（{704,703}）+ 四语齐备 FAIL → 总判 FAIL` | **0** |
| `p4z-miscfix-links.mjs` | 新增 `src/pages/__p7a_neg_link.jsx` 内含未登记 `navigate('/login')`（真脚本 + `srcRoot` 参数，零仓内污染） | **1** | `未登记残留 = 1 → 总判 FAIL` | **0** |
| `p4z-feperf-safelist.mjs` | 从镜像 `src/styles.css` 的 `@source inline(...)` 摘掉 `scale-[1.05]`（`dist` 已在） | **1** | `dynamic_missing_from_safelist 非空 → VERDICT=FAIL` | **0** |

**四门全部自证「仍会响」**（判负 ≠ 0 / 判正 = 0），无一为「凑数」：四处注入都与各门自述判据同轴。注：前三门为**必做**，第四门（`feperf-safelist`）在原计划中属「其余两脚本」的允许登记项 —— 因 ⑤ 的 `npm run build` 已产出 `dist`，其判负**可轻易真构造**，遂一并完成，不留「未做」。

## §5 未做与 `NOT_MEASURED`（逐项给原因 · 禁填 0/空）

| 项 | 状态 | 原因（逐字） |
|---|---|---|
| 前端浏览器级 E2E（Playwright `test:e2e`） | `NOT_MEASURED` | 本单硬门口径不含 e2e（需起 dev server + 浏览器 + 登录态）；本轮**未跑**，故**不给读数**（不填 0）。 |
| `docs/route-layer.spec.md` 注册点 **65 → 68** 回写 | **未做** | 该件正被**另一子代理并发改写**（`git diff` 在数分钟内由 `259/0` 漂移到 `199/0`）；硬口径 #3 **绝对禁碰**。冲突已逐字登记于 §1.1。 |
| `ShardPage` 旧 `:791` 桩 ↔ `?kind=transfer` 新读口的**浏览器级**等价对照 | **未做** | 需真实登录态 + 具 `transfer` 流水用户 + 浏览器；本单只做静态核（`ShardPage.jsx` 现为 19 行桩）+ `ledger-flow-behavior.test.jsx` unit。 |
| 前端 `npm run type-check`（`tsc --noEmit`） | `N-A`（不可测） | 现取 `frontend/` **无 `tsconfig.json`**（`ls tsconfig*.json` → `NO tsconfig`）⇒ 该脚本**无 tsconfig 可依**。非「跑失败」，是「**无可测对象**」。 |
| `market/MarketPage.jsx` `mkt-ledger` 面板在**真浏览器**的空态渲染实测（`t('ledger.flowEmpty')` 真显字） | `NOT_MEASURED` | 同浏览器面限制；本轮只保证键值语义（§6 留痕）+ 静态消费点（`:372`）+ `i18n-violation-closeout` / `ledger-flow-behavior` unit 断言。 |
| NEG/B 探针表 `public.p7a_neg_probe` 的**行级内容**审计 | **未取** | 判负以「表存在 + public 表数变化」为判据，`probe_rows=24` 为辅助读数；表已按判负收尾 `DROP`，内容**不可再取** ⇒ 逐行审计**未做**（原因 = 已收尾销毁）。 |
| 真库既有行完整性 | **已声明（非未做）** | 本轮未改任何既有行；唯一库侧写 = 变异 B 建/写/删**本单自建**探针表，已 DROP 复核（§4.1 b）。 |
| `.p4-artifacts/p6tr1a-<RUN>/`（本轮离线跑副产物） | **登记** | 由 ⑤ 离线门自动产出（`p6tr1a-20261002T070207Z`），非本单手写；与既有同类产物同口径。 |

## §6 自曝

### §6.1 上一轮两处探针 bug（诚实自曝 · 均已现取修正）

1. **`ORDER BY` 别名陷阱 ⇒ 字符串排序**：早期 `p7a-01-http.ts` 的 DB 对拍查询写成 `SELECT txid::text AS txid … ORDER BY txid DESC`。PostgreSQL 把 `ORDER BY` 的 `txid` 解析到 SELECT **输出别名**（`::text`）⇒ 按**字符串**排序（`'9' > '10'`），而 HTTP 侧按**数字**序 —— 二者对拍会**假红/假绿**。**修法**：`ORDER BY public.ledger_entry.txid DESC` **显式限定基表列**（现取 `:128 / :171 / :186 / :239` 均为此形）。
2. **`??` 把真 `null` 塔成「缺键」**：早期用 `j.next_before_txid ?? undefined` 判「到底」。真 `null`（尾页「到底」的**语义值**）与「键根本没回」被 `??` 合并 ⇒ 无法区分「尾页 `null`」与「键缺失」。**修法**：先 `Object.prototype.hasOwnProperty.call(j, 'next_before_txid')` 判**键在否**，再取值（现取 `:71 / :80-81`），并据此判 `AC3 不足页 ⇒ next_before_txid=null`。

### §6.2 本轮新发现（二次自曝 · 既有探针的口径局限）

**`p7a-01-http.ts` 的 AC5「调用前后快照」对「在快照之前就已存在的表」是盲的**。变异 B 在**首个库访问**即建表；随后 AC5 取 `before`/`after` 两份快照时该表**已存在**，两份都读到 `public_tables=26` ⇒ `identical=true`（若 NEG/B 只跑 `p7a-01`，**会误判 PASS**）。⇒ 本轮另写 `p7a-02-negctl.ts`，把基线取在**首个 HTTP 调用之前**；同一仪器在真代码上判 GREEN、在变异 B 上判 RED（§4.1）。**登记为既有探针口径局限，不掩盖。**

### §6.3 ③ 文案裁定落位的 **5 处**改动（逐处留痕）

| # | 位置 | 旧值 | 新值 | 为什么 |
|---|---|---|---|---|
| 1 | `frontend/src/locales/zh.json:198` `ledger.flowEmpty` | `账本流水暂未开放，敬请期待。` | `暂无账本流水。交易完成后，记录会显示在这里。` | 读口本单**已注册上线** ⇒ 旧值「功能未开放」是**对用户说假话**。 |
| 2 | `frontend/src/locales/en.json:198` | `The statement is not available yet - coming soon.` | `No statement entries yet. Your transactions will appear here.` | 同上（en 无中文）。 |
| 3 | `frontend/src/locales/hk.json:198` | `賬本流水暫未開放，敬請期待。` | `暫無賬本流水。完成交易後，記錄會顯示在這裡。` | 同上（hk 用繁體）。 |
| 4 | `frontend/src/locales/vn.json:198` | `Sổ cái giao dịch chưa mở, vui lòng chờ.` | `Chưa có giao dịch nào. Giao dịch của bạn sẽ hiển thị ở đây sau khi hoàn tất.` | 同上（vn 无中文）。 |
| 5 | `frontend/src/test/unit/i18n-violation-closeout.test.jsx:105` | `expect(flatTables.zh['ledger.flowEmpty']).toMatch(/暂未开放|暫時|暫未/)` | `// 批 7-A：`/api/user/ledger` 已注册 ⇒ 原「暂未开放」变成错误陈述 ⇒ 保真底线的锚随之**等义下移**` + `expect(…).toMatch(/暂无账本流水|交易后/)` + `expect(…).not.toMatch(/暂未开放|暫未開放/)` | 锚随语义**等义下移**；新增 `not.toMatch` 为**同轴守回归**（禁旧假话回流），属该锚区改动，逐字留痕于此。 |

**边界声明**：**未触碰**其它带「暂未开放/暫未開放」的键 —— `jobs.acceptNote`（现取仍含「申请列表暂未开放」，因其描述的功能**确未开放**）、`rewards.redeemNotOpen` 等**一字未动**。四语 `flowEmpty` 语义与页面实际行为（空态 = 无记录，交易后显示，`MarketPage.jsx:372`）一致。

### §6.4 「首轮 ⑤ 键数守卫常量随**授权**新增同步」逐行说明

`i18n-violation-closeout.test.jsx` 两处**期望常量**随批 7-A **授权键集**同步（**非放宽判据**）：

- **③ 段**：`expect(out).toContain('作用域命中节点数 = 2732')` → `'… = 2816'`。理由：作用域节点数 = 拍平键数 × 语数 = `683×4=2732` → 授权 `+21` 键后 `704×4=2816`（`+84`）。
- **⑤ 段**：`expect([...counts][0]).toBe(683)` → `toBe(704)`。理由：683 + 21 = 704。
- **注释 ③ 段**：补写来源 = 「批 7-A 授权新增 21 键 = `ledger.flowMore` + `ledger.kind.*`（`LEDGER_KINDS` 20 个全覆盖）683⇒704」。
- **不变判据（一字未动）**：`expect(counts.size).toBe(1)`（四语拍平键数**单值**）、四语键集严格相等、以及 ③ 的 `expect(problems).toEqual([])`。⇒ 同步的是**期望值**，守卫**强度不变**。

---

### 附：本轮产物路径（`run-tagged`，原始输出无 `.log` 后缀）

- `backend-ts/.p7a-artifacts/P7A-NEGA-001/`（判负 A：`p7a-01-http-P7A-NEGA-001.json` + `-stdout.txt`）
- `backend-ts/.p7a-artifacts/P7A-NEGB-001/`（判负 B：`p7a-02-negctl-P7A-NEGB-001.json` + `-stdout.txt`）
- `backend-ts/.p7a-artifacts/P7A-E2E-003/`（复原后主工作区真实例）
- `backend-ts/.p7a-artifacts/P7A-NEGCTL-MAIN-001/`（同器判正）
- `backend-ts/.p7a-artifacts/P7A-GATES-001/`（硬门：`tsc-backend.txt` / `offline.txt` / `build.txt` / `test-unit.txt` / `gate-*.txt`）
- `/Users/kevin/.hermes/profiles/zang/cache/scratch/p7a-r3/`（④ 四脚本判负镜像与读数 `A/B/C/D` `.txt`）

