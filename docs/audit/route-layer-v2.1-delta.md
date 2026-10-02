# `docs/route-layer.spec.md` v2.0 → v2.1 · delta 件

> 角色 = **Jing（Specifier · 制度员）** · 单 = **spec v2.1（R107 `message` 语义写死 + 存量偏离登记 + 批 7-C/7-D 成果回写）**
> 仓库 = `/Users/kevin/bistro/seafood` · 分支 = `main` · **开工 HEAD = `17f4a23`**（`docs: 批 7-D 我亲核盘面通过 + 两处回执失真登记 + 批 7-E 降级为规范澄清 + §5.171/v0.171`）
> 性质 = **纯规范写作**（**只追加**）：零代码 · 零迁移 · 零库连接 · 零 HTTP · **零套件**（不跑前后端套件 / 不跑门）· 无 `git add/commit/push` · 无 `npm install` · 未碰 `.env*` · 未用 `pkill -f`/`killall` · 未启停 5787/5788。
> 依据 = **Zang §5.171 C**（批 7-E 降级为规范澄清）+ 本单派单 ①②③ + 批 7-C / 批 7-D 成果 + `docs/audit/p7-a-ledger-read-fix2.md §5`。
> 读数一律「命令 → 读数」；**未测项写原因**（§D3），**禁填 0 / 空 / 占位**。

---

## §D0 读数（开工 → 完工 · 逐条现取）

| 项 | 开工（v2.0） | 完工（v2.1） | 命令 |
|---|---|---|---|
| `docs/route-layer.spec.md` 行数 | **3661** | **3840**（+179） | `wc -l` |
| 字节 | **787963** | **828530**（+40567） | `wc -c` |
| md5 | **`1448107be1a418fbc577db61cd98e84f`** | **`3f261af960e3dd4a15ba1b08c3a0eed0`** | `md5` |
| sha256 | `614220b6cdbca7c4cb98f62be035b0e07511940aec2ecf126e60cfa739249c2b` | `4638eb3115b5214b8eeca6f1007d43447139102e0c0aaab4dde21381e88a6cd8` | `shasum -a 256` |

**开工对锚（逐项相符才动手）**：

| # | 锚 | 要求 | 开工现取 | 判定 |
|--:|---|---|---|---|
| ① | `wc -l docs/route-layer.spec.md` | 3661 | **3661** | ✅ |
| ② | 字节 | 787963 | **787963** | ✅ |
| ③ | md5 | `1448107be1a418fbc577db61cd98e84f` | **相符** | ✅ |
| ④ | `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.0.md` | = 0 | **= 0（identical）** | ✅ |
| ⑤ | 旧快照 v0.1–v1.9 + v2.0 | 共 20 个均在 | **20 个均在**（`ls docs/versions/route-layer.spec.v*.md \| wc -l` = **20**） | ✅ |
| ⑥ | `docs/audit/route-layer-v2.0-delta.md` | 在位 | **在位**（13754 B / mtime `2026-10-02 19:01`） | ✅ |
| ⑦ | `docs/audit/p7-a-ledger-read-fix2.md`（本单证据件） | 在位 | **在位**（30205 B / mtime `2026-10-02 15:43`） | ✅ |
| ⑧ | 开工 `git status --porcelain` | 干净 | **空** | ✅ |

---

## §D1 只追加判据（机器 + 独立复核）

**① 机器判据（`git diff --numstat`）**：

```
$ git diff --numstat docs/route-layer.spec.md
179	0	docs/route-layer.spec.md
```
⇒ **删除列 = 0** ✅（新增 **179** 行 / 删除 **0** 行）。

**② 独立复核（`difflib.SequenceMatcher`，对 `git show HEAD:docs/route-layer.spec.md` 逐行比对）**：

```
opcodes: {'equal': 6, 'insert': 6}
NON-APPEND = []
equal lines total = 3662
inserted lines total = 179
```
⇒ **只见 `equal` + `insert`：`0 replace` / `0 delete`** ✅（**非追加改动 = 0 处**）。

---

## §D2 逐条 delta（依据锚点 → 落点 · 逐条带行号）

### §D2.0 落点总表（**原位锚（开工档）** → **最终行号**）

| 块 | 内容 | 原位锚 | 最终行号（v2.1 档） | 行数 |
|--:|---|---|---|---:|
| **A** | 顶部 **v2.1 状态块**（状态 / 修订入口 / 要点 ①–⑤） | after `:180` | **181–189** | 9 |
| **B** | **§3.3 v2.1 就地加注**（R107 `message` 语义写死 · 条款 9′ + 存量声明 + 正向约束） | after `:900` | **910–921**（加注首行 `:911`） | 12 |
| **C** | **§8.1 表 v2.1 行** | after `:1784` | **`:1806`** | 1 |
| **D** | **§8.23 v2.1 变更记录与自曝**（声明 / `NOT_MEASURED` / 自曝 / delta 对照 / 纪律自检） | after `:2545` | **2568–2607** | 41 |
| **E** | **§14.3 v2.1 就地加注**（文案链四跳 + 机读码判据 + 33 码已本地化） | after `:3619` | **3684–3697** | 14 |
| **F** | **§15.4 v2.1 就地加注 + §15.5〔新〕+ §15.6〔新〕+ §16〔新〕** | after `:3661`（EOF） | **3740–3818**（§15.5 `:3742` · §15.6 `:3763` · §16 `:3775` · §16.3 `:3806`） | 79 |
| **G** | **§16.3 v2.1 落盘更正与补证**（7-D 收口报告落盘 + 判负红读数 + 口径边界） | after `:3818`（完工档） | **3819–3826**（首行 `:3820`） | 8 |

（最终档定位复核：`### 3.4` = `:923` / `## §9` = `:2609` / `### 14.3` = `:3665` / `## §15` = `:3698` / `### 16.4` = `:3828` / `### 16.5` = `:3833` / EOF = `:3840`。）

### §D2.1 delta ① —— R107 `message` 字段语义写死（`code` 机读唯一真源 / `i18n_key` 本地化真源 / `message` 人类可读稳定英文句 · 严禁机读码）

- **依据** = **Zang §5.171 C**（`docs/seafood.master-plan.md:1436` 逐字：「批 7-C + 7-D 后**用户可见面已干净**（132 节点全本地化 + 机读码双面抑制）⇒ 服务端 `message` 把码当文案**不再是用户可见缺陷，而是契约卫生问题** ⇒ 降级为「规范澄清 + 存量登记、分批实现、非阻塞」，派 **Jing** 在 `route-layer.spec` 写死 R107 `message` 语义（**人类可读稳定英文句；码只进 `code`；`i18n_key` 为本地化真源**）」）+ 派单 ①。
- **落点** = **§3.3 v2.1 就地加注**（`:911` · 条款 **9′**）+ **§15.5**（`:3742`）+ 顶部状态块 ① + §8.23.4 ①。
- **写死的四条**：① `code` = **机读唯一真源**（`LEDGER_*` **33 码闭集** / `AUTH_*` 域；调用方**只按 `code` 分支**）；② `i18n_key` = **本地化真源**（`ledger.err.<CODE>` · 真源 `backend-ts/src/job-service.ts:30` 的 `` `${i18nDomain}.err.${code}` ``）；③ **`message` = 人类可读的稳定英文句**（供日志 / 调试 / 非本地化客户端）；④ **严禁把机读码填进 `message`** ⇒ 违反**判负**。
- **旧写法逐字留痕（引在加注内）**：现有实现的两处形态 —— `ledgerErrorBody(code, code, details, 'auth')`（`index.ts:262`）与 `message: message || code`（`currency-service.ts:48` 等 7 处）⇒ **原行一字未改**、只在加注内逐字引用。

### §D2.2 delta ② —— 存量偏离清单（登记 · 技术债 · 分批实现 · 非阻塞）

- **依据** = 派单 ② + 证据件 **`docs/audit/p7-a-ledger-read-fix2.md §5`**（30205 B · 在场）。
- **落点** = **§15.5〔新〕**（`:3742–3761` · A–F 六类表 + 证据 + 「为什么非阻塞」+ 未测项）+ **§15.4 v2.1 就地加注**（`:3740`）。
- **清单（本册现取锚点）**：
  - **A** `fail(status, code, details, message?)` 第 4 参缺省 ⇒ `message: message || code`：**回退位 7 处**（`currency-service.ts:48` / `job-funds-service.ts:46` / `listing-funds-service.ts:155` / `listing-service.ts:44` / `market-service.ts:113` / `job-service.ts:70` / `admin-service.ts:33`）；6 处 `fail` 定义（`currency-service.ts:39` / `job-funds-service.ts:37` / `listing-funds-service.ts:146` / `listing-service.ts:35` / `market-service.ts:104` / `job-service.ts:61`）。**只把「7」当回退位、不当偏离调用点数**。
  - **B** `fromLedgerError` 以 `message = mapped.code`（兜底支 `norm.code`）：**4 处**（`currency-service.ts:66` / `job-funds-service.ts:64` / `listing-funds-service.ts:169` / `market-service.ts:131`）× **2 支** = **8 赋值点** ⇒ **F-1 真体来源**。
  - **C** `sendAuthError` 以 `message = code`：`index.ts:256-263`（`ledgerErrorBody(code, code, details, 'auth')`）；调用点 `:274` / `:307` / `:313`（**3 处**）。
  - **D** `sendError` 同族旧形状（定义 `index.ts:116-120`）：**26 处实调用**（**转引** fix2 §5 逐条判定表；**本册复核** = `grep -n 'sendError(res,' backend-ts/src/index.ts` 命中 **50 行** − **24 行注释行** = **26**；时点 sha256 并列：转引 `c4db3627…` / 现取 `9b90bed4…`）。
  - **E** `sendVerbError`（`job-service.ts:76-77`）/ `ledgerErrorBody`（`:21-33`）= **正确通道 · 非偏离**。
  - **F** `LEDGER_ERROR_TABLE` 的 `message` 为**中文句**（`ledger-errors.ts:30-69` · 现取表内 **33** 条目）⇒ **语言面**偏离（非机读码 ⇒ 不属 F-1）⇒ **是否并入批次 = 待 Zang**（本册不自行裁定）。
- **「非阻塞」的理由（写死）** = 前端护栏已在用户可见面**结构性抑制**机读码（批 7-C `message` 面 + 批 7-D R1′ `reason` 面）⇒ **不是用户可见缺陷**。

### §D2.3 delta ③ —— 前端错误文案链四跳 + 机读码判据（把批 7-C / 7-D 成果写进契约）

- **依据** = 派单 ③ + `docs/audit/p7-c-errmsg-scope.md`（15182 B · 在场）+ `docs/qa/p7-c-errmsg-scope-review.md`（26027 B · **PASS（建议入库）**）+ `docs/audit/p7-d-errmsg-i18n.md`（37200 B · 完工时点落盘，见 §D2.7）+ Zang §5.171 A。
- **落点** = **§14.3 v2.1 就地加注**（`:3684–3697`）+ **§16.1 / §16.2**（`:3775` 起）。
- **契约化内容（写死）**：
  - **四跳候选链** = ① `t(i18n_key)` → ② 服务端原文 → ③ 四语通用兜底 `auth.err.REQUEST_FAILED` → ④ ASCII `Request failed (status)`（真源 `frontend/src/auth.js` **现取 `:256-279`**；准入闸 `isUsableText` = `:235-240`）。
  - **② 的 `message` 与 `details.reason` 命中「全大写下划线机读码」⇒ 视为不可用**：判据 `MACHINE_CODE_RE` / `MACHINE_CODE_TOKEN_RE`（`auth.js:155-156`）、谓词 `looksLikeMachineCode`（`:159-161`）/ `containsMachineCode`（`:164-166`）；落点 = `extractApiErrorMessage` 三处（`:179` / `:192` / `:193`，批 7-C）+ `:187` 的 `reason` 后缀（批 7-D · R1′）。
  - **F-1 真体**（改前 / 改后）逐字入册；**残余**（`stateConflict()` 业务状态机族）登记并注明 R1′ 已收口 `reason` 面。

### §D2.4 delta ④ —— 33 码闭集已逐码本地化（四语键集相等 · 每语 33 键 · `flat = 737`）

- **依据** = Zang §5.171 A（亲核）+ **本册现取复核**。
- **落点** = **§16.3**（`:3806`）+ §14.3 v2.1 加注 ③ + 顶部状态块 ③。
- **本册现取读数**：`frontend/src/locales/{zh,en,hk,vn}.json` **每语 `ledger.err.*` = 33 键**（四语各 33）；**每语递归拍平 `flat = 737`**（四语同值）；`backend-ts/src/ledger-errors.ts` 表内条目 = **33**（`grep -cE '^  LEDGER_[A-Z_]+: \{ status:'`）。
- **转引读数（§5.171 A / 批 7-D 报告 §0.4）**：`p7b-errfallback-gate` = 「D 节点=132 **需护栏 0 / 已本地化 132**」（改前 132 / 0）+ 「**G 键不可用=0/132**」；`p7a-03-errmessage-gate` = 「**命中 0 / 基线 0**」（改前基线 3 ⇒ 归零）；`p7c-errmsg-machinecode-gate` = 「D 0/16、F 0/16、**G 机读码出现次数=0/36 违例=0**」；`p6-tr2-i18n-locales` = 「`top=102 flat=737` · 键集相等 PASS（取值集合 = {737}）」。
- **★ 两口径必须分标（承 D-1 失真教训）**：**33 = 每语键数**；**132 = 33 码 × 4 语的「需护栏节点数」**（≠ 键数）⇒ 本册 §16.3 **显式分标**。

### §D2.5 delta ⑤ —— 正向约束（新增错误面不得把码塞进 `message`）+ 类级可判负门

- **依据** = Zang §5.171 C 逐字 + 派单 ③。
- **落点** = **§15.6〔新〕**（`:3763`）+ §3.3 v2.1 加注末条（`:921`）。
- **规则**：新增 / 改动的错误面**不得**把机读码填进 `message`；**性质 = 类级门**（与 §15.5 存量面**分层**：存量只登记、新增受约束）；**判据** = `MACHINE_CODE_TOKEN_RE`（`auth.js:156`）；**可判负门（在场）** = `frontend/scripts/p7c-errmsg-machinecode-gate.mjs`（G 段）+ `frontend/scripts/p7a-03-errmessage-gate.mjs`。

### §D2.6 delta ⑥ —— 变更记录 / 快照 / delta 件

- **§8.1 表 v2.1 行** = `:1806`（**1 行**，接在 v2.0 行 `:1805` 之后）。
- **§8.23** = `:2568–2607`（声明 / `NOT_MEASURED` **八项** / 自曝 **6 条** / delta 对照 **6 组** / 纪律自检 ⑬ 条）。
- **快照** = `docs/versions/route-layer.spec.v2.1.md`（**新版本号 + 改后正文**；`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.1.md` = **0**）。
- **delta 件** = 本件。

### §D2.7 完工时点更正 —— §16.3 的「7-D 报告未落盘」+ 一条口径边界

- **事实**：本单**开工时点**现取 `ls docs/audit/p7-d-errmsg-i18n.md` = **0**（该件当时不存在，与 §5.171 B · D-2 记载一致）；**完工时点**该件**已由并行「批 7-D 收口单」落盘**（**本册现取**：37200 B / **439 行** / mtime `2026-10-02 19:44`；交付 sha = **`f0bd336`**）。
- **处置** = **§16.3 v2.1 落盘更正与补证**（`:3819–3826`）——把「不引报告」更正为「可引该件」，并**转引**其：门读数（七门 `EXIT 0` / `test:unit` 30 files 268 passed）、**`p7b` G 段把 33 键从「登记」升为「类级判据」**（`不可用 = 0/132`）、两处**判负红读数**（删键 ⇒ `p7b EXIT=1` + 单测 4 红；`reason` 判据回退 ⇒ 真链类级单测 2 红），以及**口径边界**（纯 node 镜像门 `p7c` 对 R1′ 回退**不红** ⇒ 可判负落点 = 真链单测）。
- **★ 该件为并行单（Kong · 批 7-D 收口）交付物 —— 本册未触碰（零改动）**；`git status` 中 `?? docs/audit/p7-d-errmsg-i18n.md` **非本单产物**（见 §D6）。

---

## §D3 `NOT_MEASURED`（未测项，禁止当 0 / 空使用）

| # | 未测项 | 原因（逐字） |
|--:|---|---|
| ① | **门当日判负实跑**（`p7c` / `p7b` / `p7a-03` 的仓内本日读数） | 本单**不跑前端套件 / 不跑门**（只读源码 + 只读 locale 取真源行号）⇒ 门读数**转引** `docs/seafood.master-plan.md §5.171 A` 与 `docs/audit/p7-d-errmsg-i18n.md §0.4`（**不转引冒充实测**） |
| ② | **33 码 × 4 语文案的语言质量**（逐条） | 归**产品 / 文案**面；本册**只取键数（33 / 语）与键集相等（`flat` 737 × 4）**；语言面结论**转引** §5.171 A（Zang 亲审）+ 7-D 报告 §2 |
| ③ | **§15.5 A 类「省略第 4 参」的调用点逐点枚举** | 需逐调用点判读 / AST；本册只给**定义面 7 处回退位** ⇒ **不把「7」当偏离调用点计数** |
| ④ | **§15.5 D 类 26 处的逐条行号 / message** | **转引** `docs/audit/p7-a-ledger-read-fix2.md §5`；本册**不复算、不转抄** |
| ⑤ | **后端 `message` 面「新增违规点」的全量扫描** | 属**实现批**扫描面（本册不持该类级命令面） |
| ⑥ | **`frontend/src/**` 其余页面直拼错误串的现状** | 归 §14.1 的门（`p7a-03`）；本册**不重取其扫描面** |
| ⑦ | **服务端存量偏离的改写排期 / 分批切分** | **未定**（归**实现批**；本册**只登记为技术债 + 非阻塞**） |
| ⑧ | **§15.5 F 类（`LEDGER_ERROR_TABLE` 中文 `message`）是否并入本技术债批次** | **待 Zang**（本册**不自行裁定**；只登记现取读数 = 33 条 message 为中文句） |
| ⑨ | **§16.2 残留形态在 HTTP 面的现状**（业务状态机族 + 英文句内嵌大写 token） | 本册**零 HTTP**；P7-C 质检 §3.4/§5 已给「英文句内嵌大写带下划线 token」实例（**转引**），**本册未复跑** |
| ⑩ | **批 7-D 报告之外的 7-D 产物逐件复核** | 该件为并行单交付物（`f0bd336`）；本册**只读该报告**、**未核其 19 个被改件**（属并行单 + 质检面） |

---

## §D4 自曝（本册的口径缺陷与更正）

| # | 自曝项 | 处置 |
|--:|---|---|
| ① | **「就地加注」与「删除列 = 0」不可兼得（承 v1.8 §8.20.3-① / v1.9 §8.21.3-① / v2.0 §8.22.3-①）** | 派单说「就地加注」；硬口径判据 = **删除列 = 0** ⇒ **取机器判据优先**：**§3.3 / §14.3 / §15.4 的正文与表格 / 单元格一字未动**，加注与更新**全部**由**新增加注行 + 新小节**承载 + **旧写法逐字引在加注内 ⇒ 留痕成立**。 |
| ② | **§16.3 的「7-D 报告未落盘」在完工时点已被推翻** | 开工时点读数（`ls` = 0）属实；**完工时点该件由并行单落盘** ⇒ **不删原行**，改以 **§16.3 v2.1 落盘更正与补证**（`:3819–3826`，**只追加**）承载更正 ⇒ **两次读数并存、时点明确**。 |
| ③ | **`sendError` 计数在两时点不同（转引 27 / 本册 50 行命中）** | 差异源 = **注释行**（批 7-A 后新增多处「修前：本 catch 硬编码 `sendError(res, 500, …)`」注释）⇒ 本册给**同口径复核**（50 − 24 注释 = **26**，与 fix2 §5 的 26 处表一致）；**两时点 sha256 并列**（`c4db3627…` / `9b90bed4…`），**不掩盖**。 |
| ④ | **行号是移动靶（承 v1.8 / v1.9 / v2.0）** | `frontend/src/auth.js` 行号系 **v2.1 现取**（该件现 **373 行**；链 `:256-279`、判据 `:155-166`）；与 v1.9 §14.3 所引 `auth.js:177-187` **不同时点** ⇒ **两者并存、以现取为准**。`backend-ts/**` 行号均标时点 sha。 |
| ⑤ | **「本地化」两口径易混（33 键 vs 132 节点）** | **33 = 每语键数**；**132 = 33 码 × 4 语的「需护栏节点数」** ⇒ §16.3 **显式分标**（承 §5.171 B · D-1 的抄数失真教训）。 |
| ⑥ | **§15.5 的「7 处」是回退位、不是偏离调用点数** | 在 §15.5 A 行**显式写明**，避免被读成「偏离 7 处」。 |
| ⑦ | **本单未复核「批 7-D 交付面」的代码**（19 个被改件） | 本册只读 7-D 报告 / 7-C 报告 / 质检件（**只读**）；**未核被改件本身** ⇒ 登记 §D3-⑩（归并行单 + 质检面，非本单射程）。 |

---

## §D5 纪律自检（逐条对照硬口径与派单纪律）

① **身份表写 `users`** ✅（**本单零 SQL、零库连接**）｜② **SQL 显式 `public.`** ✅（**本单无 SQL**）｜③ **只追加 / 删除列 = 0** ✅（`git diff --numstat` = `179 0`；`difflib` = 只 `equal` + `insert`（**0 replace / 0 delete**），见 §D1）｜④ **快照惯例已先校验** ✅（开工前 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.0.md` = **0** ⇒ 惯例 = 「新版本号 + 改后正文」；改后 `cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.1.md` = **0**）｜⑤ **v0.1–v2.0 二十个快照未触碰** ✅（`git status` 未见任一快照变动）｜⑥ **变更记录** ✅（§8.1 追加 v2.1 行 `:1806` + §8.23 `:2568`）｜⑦ **不得改**：任何代码（`backend-ts/**` / `frontend/**`，**只读引用**）/ `migrations/**` / 其它 spec（`data-layer` / `ledger` / `commission`）/ `docs/design/**` / `docs/seafood.master-plan.md` / `docs/audit/**` 既有件 / `docs/qa/**` ✅（**全部零改动**）｜⑧ **无 `git add/commit/push` / 无 `npm install` / 未碰 `.env*` / 未用 `pkill -f`·`killall` / 未启停 5787·5788** ✅（本单只用 `grep` / `wc` / `md5` / `shasum` / `cmp` / `ls` / `cp` / `python3` / `sed`-读）｜⑨ **原始输出不用 `.log`** ✅（本单**无新原始输出**；脚本落 scratch `~/.hermes/profiles/zang/cache/scratch/jing_v21_insert*.py`）｜⑩ **未测项 = `NOT_MEASURED` + 原因** ✅（§D3 十项 ①–⑩；**无 0 / 无空 / 无占位**）｜⑪ **不确定处不二选一** ✅（§15.5 F 类是否并入批次 **交 Zang**；R1′ 镜像门覆盖缺口 **照录不新立收口项**）｜⑫ **报数带口径** ✅（§D0 行数 / 字节 / md5 / sha256；§D1 `numstat` + `difflib`；两时点 sha256 并列见 §D4-③）｜⑬ **未发明任何规格值** ✅（正则 / 键数 / `flat` / 门读数 / 行号逐字 = **转引或现取**，**无一处来自推断**）。

---

## §D6 快照与零污染凭据（`git status` 首尾）

**开工（逐字）**：
```
（空 —— 工作区干净）
HEAD = 17f4a23
```

**完工（逐字）**：
```
 M docs/route-layer.spec.md
?? docs/audit/p7-d-errmsg-i18n.md
?? docs/versions/route-layer.spec.v2.1.md
HEAD = 17f4a23   （未 commit / 未 push）
```

**逐条归属说明（诚实标注）**：

| 条目 | 归属 | 说明 |
|---|---|---|
| `M docs/route-layer.spec.md` | **本单** ✅ | 就地升 v2.1（**只追加 179 行 / 删除 0 行**） |
| `?? docs/versions/route-layer.spec.v2.1.md` | **本单** ✅ | 新快照（`cmp` 现档 = **0**） |
| `?? docs/audit/route-layer-v2.1-delta.md` | **本单** ✅ | 本 delta 件（本文件落盘后出现） |
| `?? docs/audit/p7-d-errmsg-i18n.md` | **非本单** ⚠️ | **并行单（Kong · 批 7-D 收口）** 交付物；mtime `2026-10-02 19:44`（**与本单同窗口**）；**本册未触碰（零改动）**，仅**只读**并**转引**其读数（§D2.7） |

⇒ **v0.1–v2.0 二十个旧快照零改动** ✅；**本单三个文件之外无任何 tracked 改动** ✅；**`docs/audit/**` 既有件零改动**（只新建本 delta 件）✅。

---

## §D7 一句话

`route-layer.spec` 就地升 **v2.0 → v2.1**：**只追加 179 行 / 删除 0 行**（`numstat` 删除列 = 0 · `difflib` 只 `equal`+`insert`），把 **R107 `message` 字段语义写死**（`code` 机读唯一真源 / `i18n_key` 本地化真源 / **`message` 人类可读稳定英文句、严禁机读码**）、把 **`fail` 第 4 参 / `fromLedgerError` / `sendAuthError` / `sendError` 同族**登记为**存量技术债（分批实现、非阻塞）**、把 **前端错误文案链四跳 + 机读码判据（批 7-C/7-D）+ 33 码已本地化（四语键集相等 · `flat = 737`）**写进契约、并立下 **「新增错误面不得把码塞进 `message`」的类级可判负门**；快照 `docs/versions/route-layer.spec.v2.1.md` 与现档**逐字节相同**；20 个旧快照一字未动。
