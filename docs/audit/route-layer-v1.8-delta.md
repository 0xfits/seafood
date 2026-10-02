# route-layer.spec **v1.8** delta 件（批 7-A 四条事实 / 纪律回写）

> **作者角色** = **Jing（Specifier · 制度员）** ｜ **日期** = 2026-10-02（CST / UTC+08:00）
> **性质** = **只追加单 · 零代码 · 零迁移 · 库面只读 · 零 HTTP**
> **依据** = **Zang §5.162 C / D**（`docs/seafood.master-plan.md:1439` / `:1443`）+ A · R-1 / R-3① / R-4（`:1422` / `:1424` / `:1425-1426`）+ L7①/②/④（`:1435` / `:1436`）
> **交付物** = `docs/route-layer.spec.md`（就地升 **v1.8**）+ `docs/versions/route-layer.spec.v1.8.md`（快照）+ 本件

---

## §D0 读数（口径逐字 · 退出码一律不取管道之后）

### D0.1 开工前锚（**先对锚、后动手**）

| 项 | 命令 | 读数 | 判定 |
|---|---|---|---|
| HEAD | `git log --oneline -1` | `238bc01 fix(fe): 批 7-A 收口四 —— ledger-api 错误分支复用 apiErrorMessage …（250 例）` | 含 `238bc01` ✅ |
| 工作树 | `git status --porcelain` | **空** | 干净 ✅ |
| 本册行数 | `wc -l docs/route-layer.spec.md` | **3252** | 与派单相符 ✅ |
| 本册字节 | `wc -c docs/route-layer.spec.md` | **698890** | 与派单相符 ✅ |
| 本册 md5 | `md5 docs/route-layer.spec.md` | **`f4cc100419e5fa238300c99cbcfb0aa0`** | 与派单相符 ✅ |
| 快照惯例 | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.7.md` | **0（identical）** | 惯例 = 「**新版本号 + 改后正文**」⇒ 本单照做 ✅ |

### D0.2 改后读数

| 项 | 读数 |
|---|---|
| 本册行数 | **3467**（`wc -l docs/route-layer.spec.md`） |
| 本册字节 | **739146**（`wc -c`） |
| 本册 md5 | **`3d44a3b242f3823ee3f6a4dfb0935933`** |
| 快照 | `docs/versions/route-layer.spec.v1.8.md` —— `wc -l` = **3467** / `wc -c` = **739146** / md5 = **`3d44a3b242f3823ee3f6a4dfb0935933`**；`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v1.8.md` = **0（identical）** |
| **只追加判据** | `git diff --numstat docs/route-layer.spec.md` = **`215` / `0`** ⇒ **删除列 = 0** ✅ |
| 独立复核（更强） | `difflib.SequenceMatcher`（**非** `git`）：**v1.7 全部 3253 个 `\n` 分片逐字相等**（`equal` 全覆盖）、**非 `insert` 的 opcode = 0 条**（**无 `replace`、无 `delete`**）、**纯插入 = 215 行** ⇒ **v1.7 正文一字未删、一字未改** ✅ |
| 旧快照 | `docs/versions/route-layer.spec.v1.7.md` md5 仍 = **`f4cc100419e5fa238300c99cbcfb0aa0`**（**未触碰** ✅）；**v0.1–v1.7 十七个快照一字未动**（`ls docs/versions/route-layer.spec.v*.md` = **18 个文件** = 17 旧 + 1 新） |
| 写盘范围 | `git status --porcelain` ⇒ **本单 3 项**：` M docs/route-layer.spec.md`、`?? docs/versions/route-layer.spec.v1.8.md`、`?? docs/audit/route-layer-v1.8-delta.md`；**另 3 项 = 并发单元（Kong · 收口五）产物、非本单**：` M backend-ts/src/index.ts`、`?? backend-ts/.p7a-artifacts/P7A-FIX5-001/`、`?? backend-ts/scripts/p7a-05-ledger-shape.ts` |

### D0.3 新增 / 改动落点行号（**改后 · 现取**）

| 节 | 行号 |
|---|---|
| 顶部 **v1.8 状态块** | **:153–160**（状态行 `:153` / 修订入口 `:154` / 要点标题 `:155` / 要点 ①–⑤ `:156–160`） |
| **§1.14**（新） | **:641–689**（依据 + 只追加口径 `:643–644` / 计数真源表 `:646–656` / **并发写者两次现取后注 `:658`** / 「68 的取得口径」+「未测项」`:660–661` / 九处复核表 `:663–674` / 三条消费点 `:677–683` / 行号声明 `:685–689`） |
| **§7 v1.8 追加表 + 补注块 ㉘–㉚** | **:1731–1740**（7-59 `:1735` / 7-60 `:1736` / 7-61 `:1737`） |
| **§8.1 表 v1.8 行** | **:1762** |
| **§8.20**（新） | **:2411–2449**（8.20.1 `:2413` / 8.20.2 `:2415` / 8.20.3 `:2425` / 8.20.4 `:2436` / 8.20.5 `:2449`） |
| **§13**（新） | **:3367–3404**（13.1 `:3371` / 13.2 `:3379` / 13.3 `:3390` / 13.4 `:3401`） |
| **§14**（新） | **:3406–3440**（14.1 `:3408` / 14.2 `:3429`） |
| **§15**（新） | **:3442–3467**（15.1 `:3444` / 15.2 `:3456` / 15.3 `:3462`） |

---

## §D1 delta ① —— **注册点 65 → 68 全量回写**（正文 = 新 **§1.14**）

### D1.1 真源 = 运行时现取（**本单亲跑；不转抄质检读数**）

| 项 | 命令（逐字） | **本册 T1 现取** | **本册 T2 复取**（`2026-10-02T15:34:31+0800`） | 独立质检亲数（L7① · 转引） |
|---|---|---|---|---|
| 注册点合计 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **68** | **68** | 68 ✓ |
| get / post / put / patch / delete | 同模式逐 verb `grep -cE` | **27 / 38 / 0 / 1 / 2** | **27 / 38 / 0 / 1 / 2** | 27 / 38 / 0 / 1 / 2 ✓ |
| `wc -l` | `wc -l backend-ts/src/index.ts` | **1981** | **2047** | — |
| 路径表行数 | `grep -nE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts \| wc -l` | **68**（与 `grep -cE` **同口径**） | — | — |
| `/api/user/ledger` 注册点 | `grep -n "app.get('/api/user/ledger'" backend-ts/src/index.ts` | **`:633`** | **`:656`** | —（派单 / Zang §5.160 B 亲核 = `:633`） |

> **★★ 并发写者（关键口径）**：`backend-ts/src/index.ts` **正被并发单元（Kong · 收口五）改写**（本册开工时工作树已含其未提交改动：`git diff --numstat backend-ts/src/index.ts` = **`75 / 9`**）⇒ 本册做**两次**现取。**★ 材料事实 = 「注册点 = 68」+「`/api/user/ledger` 已注册」，两次读数一致 ⇒ 稳定**；**行号锚点随写者漂移 ⇒ 一律以现盘为准**（§0.2-9 不变）。**两值都留、不择一埋掉**（正文 = §1.14 `:658`）。

### D1.2 九处应改行号 · **逐处现取复核**（v1.7 时点 → v1.8 现取）

| # | v1.7 行号 | v1.7 原文（**逐字节选 · 留痕**） | v1.8 读数 | v1.8 行号 | 偏移 |
|--:|---|---|---|---|--:|
| 1 | `:419` | `已注册路径表：grep -nE '^app\.(get\|post\|put\|delete\|patch)\(' src/index.ts ⇒ `**`65 行`**`（★ v0.9 现取复核 = 65；旧写法（留痕）：「53 行」）` | **68 行** | **`:428`** | +9 |
| 2 | `:483` | `- 注册点 53 → 65（+12）：grep -cE … **本册现取 = `**`65`**`**；既有 53 条零删除` | **65 → 68** | **`:492`** | +9 |
| 3 | `:524` | `\| **Q1** \| **注册面** \| 注册点 **53 → 65**（+12）；src/index.ts **1254 → 1575 行**；…= `**`65`**`、`wc -l` = `**`1575`**` \|` | **注册点 68** / `wc -l` = **1981**（T1） | **`:533`** | +9 |
| 4 | `:539` | `… ⇒ `**`65`**`；wc -l backend-ts/src/index.ts ⇒ `**`1645`**`（本册现取）。` | **68** / `wc -l` = **1981** | **`:548`** | +9 |
| 5 | `:544` | `\| 注册点 \| 53 → 65（批 4a） \| `**`65`**`（grep -cE 现取） \| **不变 ✓** \|` | **68**（**v1.8：批 7-A 已注册 ⇒ 65→68**） | **`:553`** | +9 |
| 6 | `:593` | `\| 注册点 \| 65 \| `**`65`**`（grep -cE 现取） \| **不变 ✓** \|` | **68**（**v1.8：批 7-A 已注册 ⇒ 65→68**） | **`:602`** | +9 |
| 7 | `:623` | `\| **注册点** \| `**`65`**` \| grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts \|` | **68**（**命令不变** ⇒ 同一命令现取 = 68） | **`:632`** | +9 |
| 8 | `:765` | `\| profile（账本流水） \| /api/user/ledger \| `**`未注册`**`（65 行路径表内 0 命中） \| ProfilePage.jsx:341-350 \| 空态 + 登记、不自造（归批 6/7） \|` | **已注册（`src/index.ts:633`；T2 = `:656`）** | **`:824`** | +59 |
| 9 | `:770` | `① 上表每一条路径必须在「已注册 `**`65`**` 行路径表」内（§1.12）… 现值 = 仅 /api/user/ledger 与 /api/user/points 两条，… 零请求空态` | **68 行路径表**；ledger **已注册 ⇒ 非缺口**；**残余 = 仅 `/api/user/points`**（`grep -c 'user/points' backend-ts/src/index.ts` = **0**） | **`:829`** | +59 |

> **偏移成因（写死）**：顶部 v1.8 状态块插入 **+9 行** ⇒ `:419`–`:623` 一律 **+9**；§1.14 再插 **+50 行** ⇒ `:765` / `:770` **+59**（= 9 + 50）。**故 v1.7 行号不得当 v1.8 现盘使用**（§8.20.3-②）。
> **所在节（逐条）**：1 = §1.8「扫描口径」；2 = §1.8 v0.9 追加块；3 = §1.10 · Q1；4 = §1.12；5 = §1.12 复核表；6 = §1.12 v1.1 追加块（v1.0 → v1.1 对照表 · 首行「注册点」）；7 = 「不变项复核（四项 · v1.1 现取）」表 · 注册点行（v1.1 追加；引名见 §8.13.4 ⑦）；8 = §4 面表；9 = §4 判据块。

### D1.3 三条消费点行（新 §1.14 · C1 / C2 / C3）

| # | 消费点 | 路径 | 现取锚点 |
|--:|---|---|---|
| **C1** | `ProfilePage.jsx`（**全流水**） | `GET /api/user/ledger`（**不带 `kind`**） | `frontend/src/pages/ProfilePage.jsx:19`（import `fetchMyLedger`）/ `:113`（`loadLedger`）/ `:376`（界面注） |
| **C2** | `market/MarketPage.jsx`「账本流水」面板 | `GET /api/user/ledger?kind=transfer` | `frontend/src/pages/market/MarketPage.jsx:369`（`data-sf-m="mkt-ledger"`）/ `:123-125`（`kind: 'transfer'`） |
| **C3** | 碎片口径 `?kind=transfer` | 同 C2（**每请求都带**） | `frontend/src/pages/market/MarketPage.jsx:125`；语义来源 = §5.1「碎片读口 ②」；**取代** sunset 面 `GET /api/shard/transfer` |

### D1.4 「`ShardPage.jsx:303` 已不存在」（**旧行号 = 转抄错误**）

- **现取**：`wc -l frontend/src/pages/ShardPage.jsx` = **19**；**`:17` = `import MarketPage from './market/MarketPage'`、`:19` = `export default MarketPage`** ⇒ **17–19 行 = 薄壳**。
- ⇒ **凡引用 `ShardPage.jsx:303` 的读数一律作废**（转抄错误）；`ProfilePage.jsx:341-350`（§4 表旧锚点）**亦已漂移** ⇒ v1.8 现取 = **`:376`**（**旧锚点留痕、不删**）。
- **行号口径由「六分」升为「七分」**（v0.1 live / 批 2 末态 / 批 3a 末态 / 批 3b 末态 / v1.0 现取 / v1.1 现取 / **v1.8 现取**）。

### D1.5 承载方式（**九处一律不改字**）

派单给了九处「应改行号」并说「旧写法就地留痕」；但硬口径 ② 的**机器判据 = `git diff --numstat` 删除列 = 0** ⇒ **两条在同一行内结构冲突** ⇒ **本单取机器判据优先**（**先例** = v1.5 补注块 ⑳「§7-32 行未改」、v1.7 补注块 ㉓「未就地加注任何单元格」）。**旧写法逐字引在 §1.14 表第二列 ⇒ 留痕成立、正文一字未删**；**读那九行时以 §1.14 第三列（v1.8 读数）为准**。

---

## §D2 delta ② —— **脚本类硬门口径**（正文 = 新 **§13**）

### D2.1 缺口成因（**本册现取**）

| # | 事实 | 现取 |
|--:|---|---|
| ① | **`npx tsc --noEmit` 不覆盖 `scripts/**`** | `backend-ts/tsconfig.json` 的 `"include"` = **`["src/**/*"]`**（**只有 `src`**） |
| ② | ⇒ 脚本类型错误**对既有硬门结构上不可见** | 由 ① 推出 |
| ③ | 必须新增第二条命令 | `backend-ts/tsconfig.scripts.json` **在场**（`extends ./tsconfig.json` + `include: ["scripts/**/*"]` + `noEmit: true`） |

### D2.2 口径（写死）

- **判据 = 「新增零错」**（**不是**「全量零错」）：`npx tsc -p tsconfig.scripts.json --noEmit` 的报错集 vs 改前基线，**sorted diff 的新增行必须 = 0**。
- **存量债 = 基线、本批不修**；**任何脚本改动不得把基线推高**（推高 ⇒ 判负）。
- **★ 旧读数作废声明（逐字 · 必写）**：**「此前所有『`tsc` 0』读数对脚本改动无效」** —— 那些读数测的命令面结构上不含 `scripts/**` ⇒ 对脚本改动**零覆盖**。
- **命令（逐字 · 退出码不取管道之后）**：`cd backend-ts && npx tsc -p tsconfig.scripts.json --noEmit`；计数 = 同输出 `2>&1 | grep -cE 'error TS'`；文件数 = 同输出 `grep -oE '^[^(]+\.ts' | sort -u | wc -l`。
- **适用范围**：新增脚本 / 改动既有脚本 / 改动 `tsconfig.scripts.json` **一律触发**；纯 `src/**` 改动仍走 `tsc --noEmit`。

### D2.3 存量债现取（**本册亲跑**）

| 项 | **本册现取** | 转引（收口四 R-3① · `master-plan:1424`） |
|---|---|---|
| 报错条数（`error TS`） | **77** | 77 ✓（改前 86） |
| 涉及文件数 | **22** | 22 ✓ |
| 样本（**非全量清单**） | `scripts/qa-p1e-01-concurrency.ts(97,47)` **TS2322**（`bigint` → `string \| number`，×4）/ `scripts/qa-p1e-05-neon-ab.ts(15,10)` **TS2724**（`'./qa-p1e-lib'` 无导出 `accountOf`） | — |
| 已收口面（**不得加回**） | — | `scripts/p7a-01-http.ts` 的 **TS18046 9→0** ⇒ **不在 77 条内** |

---

## §D3 delta ③ —— **两条前端纪律 / 登记**（正文 = 新 **§14**）

### D3.1 (a) **错误文案必须过全站统一链路 `apiErrorMessage`**（→ **§14.1**）

| 项 | 现取读数 |
|---|---|
| 链路真源 | `frontend/src/auth.js:177-187`（`export const apiErrorMessage = async (payload, status) => { … }`） |
| 优先级（源码注释逐字） | ① `error.i18n_key`（`R107` 契约键）② 服务端原文映射表 ③ `extractApiErrorMessage` 兜底 ⇒ 连文案都无 ⇒ **`auth.err.REQUEST_FAILED` 四语兜底**（i18n 不可用 = ASCII `Request failed (status)`） |
| 两处消费 | `frontend/src/auth.js:190`（`fetchApiJson`）/ `frontend/src/ledger-api.js:49`（`fetchMyLedger`，**收口四 R-1 并入同链**） |
| **★ 可判负的门** | `frontend/scripts/p7a-03-errmessage-gate.mjs`（**144 行**，本册现取）：**类级扫描**（扫 `frontend/src/**` 的 `.js/.jsx`，排除 `test/`；受体 = `await …json()`，命中 = 读 `.error.message` / `.message`）+ **唯一出口豁免逐条列名**（`auth.js`）+ **基线 = 3 条存量登记**（`components/ActiveTaskModal.jsx` / `components/ClaimRewardModal.jsx` / `pages/TaskPage.jsx`，逐条带理由；**未登记命中 ⇒ `VERDICT=FAIL` / 退出码 1**）+ **仓外镜像判负**（首参当扫描根 ⇒ `SRC`）+ **作用域读数**（扫描文件 / 受体 / 命中 / 基线项；**命中 0 或受体 0 ⇒ 断言无效**） |
| 判负单测 | `frontend/src/test/unit/p7a-ledger-error-i18n.test.js`（真 auth 链 + 真 i18n + 真 zh 查表；「6 例」**转引** R-4） |

### D3.2 (b) **两套取数入口并存** ⇒ **P6/P7 统一时合并**的待办（→ **§14.2** + **§7-59**）

| # | 入口 | 形态 | 关键差异 |
|--:|---|---|---|
| ① | `frontend/src/auth.js:190` **`fetchApiJson`** | `fetch` → `response.json()` → `!ok \|\| !success` ⇒ 抛 `apiErrorMessage`；**返回 `payload.data`** | **契约一字未动**（R-1 逐字）⇒ **丢弃顶层 `next_before_txid`** |
| ② | `frontend/src/ledger-api.js:32` **`fetchMyLedger`**（**55 行**） | `fetch('/api/user/ledger?…')` → 原始响应 ⇒ **取 `data` + 顶层游标**（`:53` `payload.next_before_txid`） | **另立**；错误分支**复用同链**（`:49`）；**`getAuthToken` 前置**（无 token ⇒ 抛本地化 `auth.err.NO_CREDENTIAL`、**零请求**） |

- **终审（不二选一）**：**路径②已终审选定**（另立 `ledger-api.js`）；**路径①（改全站共用件）被否决** —— 依据 = `docs/seafood.master-plan.md:1422` 逐字「`fetchApiJson` 契约**一字未动**（**路径②**）」。
- **登记（待办）**：**并入时机 = P6/P7 取数入口统一**（**本单不合并、不扩面**）⇒ **§7-59**。**判据**：合并前新读口若需顶层游标 ⇒ **照 ② 的形态另立**（不得改 ① 的契约）；合并后此条作废。

---

## §D4 delta ④ —— **错误形状口径（R107）**（正文 = 新 **§15**）

| # | 条款（**逐字**） | 依据 |
|--:|---|---|
| ① | **同一端点内 400 类必须只有一种形状（`R107`）** | Zang §5.162 C（`master-plan:1439`）；L7④ 真发现（`:1436`） |
| ② | **形状非法 ⇒ `400` + 既有码 + `details.field` / `details.reason`**（**不新增码**） | Zang §5.162 C（`:1439`）+ **§5.16 裁定**（`:383` 逐字：形状非法 ⇒ `400` `LEDGER_AMOUNT_INVALID` + `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE, MISSING}` + `details.field`；**关闭集不变**） |
| ③ | **旧 `sendError` 形态 `{success:false,message,error}` 判为非 `R107`** ⇒ 同端点内出现即判负 | L7④（`:1436`：`kind` 非法走 `sendVerbError` ⇒ **R107**；`cid` / `before_txid` 非法走 `sendError` ⇒ **旧形状**）+ 本册 §3.3-1（统一错误体，`:816`） |
| ④ | **同族 `sendError` 面「只登记不扩面」**（本单只修本端点） | Zang §5.162 C（`:1439`）逐字 |
| ⑤ | **判负可得**：同端点 400 类形状集合大小必须 = **1** | 由 ①③ 给出；**实测归实现批 / 质检批** |

- **同族面清单（转引 · 本单不复算）**：真源 = 同批 Kong 收口五报告 **`docs/audit/p7-a-ledger-read-fix2.md`（同批）**；**开工时该件尚未落盘**（`find docs -name 'p7-a-ledger-read-fix2*'` = **0**）⇒ **清单 = `NOT_MEASURED`**（§15.2 / §8.20.2-②）；**本册未自编清单、未留占位**。
- **实现面登记**：**I-19**（`GET /api/user/ledger` 的 400 类统一为 `R107`）/ **I-20**（同族面清单入册）⇒ §15.3。

---

## §D5 声明（写盘范围 · 逐条）

- **只写四个文件**：`docs/route-layer.spec.md`（就地升 v1.8）、`docs/versions/route-layer.spec.v1.8.md`（快照）、`docs/audit/route-layer-v1.8-delta.md`（本件）、若有原始输出则用 `.json` / `.txt`（**本单无**）。
- **未改**：任何代码（`backend-ts/**` **正被 Kong 收口五并发改写**、`frontend/**`）、`migrations/**`、`docs/data-layer.spec.md`、`docs/ledger.spec.md`、`docs/commission.spec.md`、`docs/design/**`、`docs/seafood.master-plan.md`、`docs/audit/**` 既有件、`docs/qa/**`、`docs/versions/route-layer.spec.v0.1…v1.7`（十七个快照）。
- **未做**：`git add/commit/push`、`npm install`、任何 SQL / 库连接、任何 HTTP、任何进程启停（5787 / 5788 未触碰）、`pkill -f` / `killall`、触碰 `.env*`。

---

## §D6 `NOT_MEASURED`（未测项 · 禁止当 0 / 空使用）

| # | 未测项 | 原因 |
|--:|---|---|
| ① | 批 7-A `67 → 68` 那一步的**注册点路径名** | 派单未给锚点；本册不做 `git log -p` 归因（越射程）⇒ **不得自编路径名** |
| ② | **「同一端点内 400 类形状不齐」的同族面清单** | 真源 = `docs/audit/p7-a-ledger-read-fix2.md`（同批），**开工时未落盘** ⇒ **不得自编清单、不得留占位** |
| ③ | 68 条注册点的 **HTTP 响应码面** | 本册**零 HTTP**；只复核计数与路径存在性（口径同 §1.12「复核面声明」） |
| ④ | `apiErrorMessage` 门当日的**判负实跑读数** | 本册不跑前端套件（只读源码取真源行号）⇒ 三件判负 **转引** `master-plan:1425-1426` |
| ⑤ | **22 文件 / 77 条的逐条文件名 × 行号完整枚举** | 计数已实测（77 / 22）；**完整枚举未贴全**（贴全会与报告重复）⇒ **不写 0、不写空** |
| ⑥ | **`/api/user/ledger` 在 `index.ts` 的「终值」行号** | 该文件**正被并发写者改写**（T1 `:633` → T2 `:656`，且仍在动）⇒ **任何静态行号都不是终值** ⇒ 以**现盘**为准（§1.14 `:658` 后注） |

---

## §D7 自曝（本册的口径缺陷与更正）

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得** | 取机器判据优先；九处**不改字**；旧写法**逐字引在 §1.14 表** ⇒ 留痕成立 |
| ② | **九处行号是「v1.7 时点」** | 本册插入 ⇒ 行号整体下移（**+9 / +59**）；本册**同时给引文**（v1.8 下仍可 `grep`），**不把 v1.7 行号当现盘** |
| ③ | **`ShardPage.jsx:303` 是转抄错误** | 现取 = **19 行**、**17–19 = 薄壳** ⇒ 凡引用 `:303` 者作废 |
| ④ | **`ProfilePage.jsx:341-350`（§4 表旧锚点）已漂移** | v1.8 现取 = **`:376`**；旧锚点留痕不删 |
| ⑤ | **编号冲突（本册自纠）** | 初次落笔用了 `§1.13`，与 **v1.1 的 §1.13「运行依赖登记」（现 `:579`）冲突** ⇒ **本册已改名为 §1.14**（**v1.1 的 §1.13 一字未动**；改的是本册自己新增的行） |
| ⑥ | **并发写者 ⇒ 行号锚点是移动靶** | `backend-ts/src/index.ts` 正被 Kong 收口五改写（`git diff --numstat` = **`75 / 9`**）⇒ 本册**两次现取**（T1 / T2，见 §D1.1）；**计数稳定、行号漂移** ⇒ **两值都留**，并立为 §D6-⑥ 未测项 |

---

## §D8 纪律自检（逐条对照硬口径与派单纪律）

① **身份表一律 `users`** ✅（**本单零 SQL、零库连接**；新增文本无表名引用）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**）｜③ **只追加 / `git diff --numstat` 删除列 = 0** ✅（**`215 / 0`**；**difflib 独立复核：v1.7 全部 3253 分片相等、非 `insert` opcode = 0**）｜④ **快照惯例先校验再照做** ✅（开工前 `cmp` v1.7 = **0**；改后 `cmp` v1.8 = **0**）｜⑤ **v0.1–v1.7 十七个快照未触碰** ✅（v1.7 md5 仍 `f4cc1004…`）｜⑥ **变更记录表加 v1.8 行 + delta 件** ✅（§8.1 `:1762` + 本件）｜⑦ **不得改清单** ✅（代码 / `migrations` / 四册 spec / `master-plan` / `design` / `audit` 既有件 / `qa` **全部零改动**）｜⑧ **无 git 写 / 无 `npm install` / 无 `.env*` / 无 `pkill -f`·`killall` / 未启停 5787·5788** ✅｜⑨ **原始输出不用 `.log`** ✅（本单无原始输出产物）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§D6 六项；**无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（**本单无二选一型未决**；③(b) 的路径①/②**已终审** ⇒ **故无「待 Zang 确认」条目**）｜⑫ **报数带口径** ✅（行数 / 字节 / md5 / `numstat` 见 §D0；注册点逐 verb + 两次现取见 §D1.1）｜⑬ **未发明任何规格值** ✅（68 与逐 verb 计数 / 22·77 / `auth.js:177-187` / `data-sf-m="mkt-ledger"` / `src/index.ts:633` **全部本册现取或带裁定出处**）

---

## §D9 待 Zang 确认

**无。** 本单为**派单四条的回写**：**无先例的细节 = 无**，**需二选一而未定 = 无**（§5.162 D③ 的路径①/②**已终审**）。**唯一「未取证」项 = §D6-①（`67 → 68` 的路径名）** ⇒ **属未测、非未决**（**本册不自编、不二选一**）。
