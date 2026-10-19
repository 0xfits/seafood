# SPEC-NOTE · 发布任务页（悬赏）「币种」改下拉选择器（同一读口的第二个前端消费点）

- **单号**：JING-JOB-CID-SELECT（seafood 仓 · Jing 角色 · **只写 `docs/**` + `ops/**`**）
- **Kevin 指令原文（逐字两条）**：「① 发布任务页（悬赏）同样的修改。② 下拉文本不带编号」
- **性质**：**只改前端 + 四语值，后端零改动**（**零新路由 ⇒ 注册点 `108 → 108`**）；实现方 = Kong（同批，commit `1d9b415`），质检 = Neng。
- **本单零代码**：不碰 `backend-ts/**`、`frontend/**`；不跑前后端门套；**不 push**。

---

## 1. 改了哪几处（节号 / 版本号 / numstat 现取）

| # | 文件 | 位置（节号 / 版本号） | 改动性质 | numstat |
|--:|---|---|---|---|
| 1 | `docs/route-layer.spec.md` | **顶部版本块 v2.38**（紧随 v2.37 块 ⑥ 行之后） | 前插新版本块（状态行 + 修订入口 + 本单要点 ①–⑥） | **`137 0`** |
| 2 | `docs/route-layer.spec.md` | **§47.8 续节**（§47.8.0–§47.8.7，接在 §47.7 文末；**未新开 §48**） | 新增续节（依据逐字 / 两页共用读口 / 注册点 108→108 逐 verb / `/task/new` 契约 / locale / 判负 #16–#25 / 既有登记处置 / 自证） | 同上行合计 |
| 3 | `docs/seafood.master-plan.md` | **新 §5.419**（前插在 §5.418 标题之上；**§5.418 标题与正文原样保留**） | 新增节（A 指令原文 / B 契约 / C 注册点不变 / D 无迁移 / E 两页一致 / F 分工 / G 既有登记） | **`17 0`** |
| 4 | `docs/seafood.master-plan.md` | **版本表新行 `v0.337`**（前插在 `v0.336` 之上） | 新增行 | 同上行合计 |
| 5 | `docs/design/design-system.spec.md` | **版本头勘误块（2026-10-19 · 第二单）**（紧随第一单勘误块之后） | 前插勘误块 | **`3 0`** |
| 6 | `docs/design/design-system.spec.md` | **§15.2 A 表后「追加勘误」段** | 追加勘误段（**表体与旁证行一字未动**；旧句逐字保留 + 「作废 · 以本段为准」） | 同上行合计 |
| 7 | `ops/item-cid-select/SPEC-NOTE-job.md` | 本文件 | 交付说明 | 新增文件 |

**纯追加自证（`git diff --numstat docs/`，删除列全部 = 0）**

```
3	0	docs/design/design-system.spec.md
137	0	docs/route-layer.spec.md
17	0	docs/seafood.master-plan.md
```

**`difflib` 独立复核（对 HEAD 三册逐 opcode，`autojunk=False`）**：三册均只有 `equal` + `insert`，**`replace` = 0 / `delete` = 0**。design 册的「旧句作废」采用**状态改写式**（旧行逐字保留 + 紧随其后追加勘误段），非删除、非替换。

**锚点自证（现取）**

| 检查 | 命令 | 结果 |
|---|---|---|
| 版本块唯一 | `grep -c '^> \*\*状态：v2.38' docs/route-layer.spec.md` | **1** |
| 续节唯一 | `grep -c '^### 47\.8 ' docs/route-layer.spec.md` | **1**（前值最大子节 = §47.7 ⇒ 无跳号；**未开 §48**，本批零新路由） |
| 台账新节唯一 | `grep -c '^### 5\.419 ' docs/seafood.master-plan.md` | **1**（前值最大 = §5.418） |
| 台账版本行唯一 | `grep -c '^\| v0\.337 ' docs/seafood.master-plan.md` | **1** |
| 注册点现取 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **108**（get 48 / post 56 / put 0 / delete 3 / patch 1） |

---

## 2. 与实现的对照清单（契约 ⇄ 现盘 · 只读现取）

| # | 冻结契约 | 现盘（只读现取，实现 commit `1d9b415`） | 结论 |
|--:|---|---|---|
| 1 | 页面 = `/task/new` | `frontend/src/App.jsx:99` `<Route path="task/new" element={<PublishJobPage />} />` | ✅ 相符（旧稿里的 `/jobs/publish` 是口语称呼，`grep -rn "jobs/publish" frontend/src` = 0） |
| 2 | 币种字段 = `select[data-sf-m="jobs-select-cid"]` | `PublishJobPage.jsx:159` = `<select className="sf-jobs-input" data-sf-m="jobs-select-cid" …>` | ✅ 相符 |
| 3 | 旧钩子 `jobs-input-cid` 不得存在 | 同文件 `grep -n 'jobs-input-cid'` = **0 命中**（旧 `<input>` 已删；仅测试文件以「计数必须 0」引用该串） | ✅ 相符 |
| 4 | 选项来自**既有** `GET /api/currencies`，**不得**新增第二读口 | `job-api.js:58` = `export const fetchCurrencies = (user) => getJson('/api/currencies', user)`；后端注册行仍 `index.ts:2341`，**本批 `backend-ts/**` diff = 0** | ✅ 相符（两页共用同一读口） |
| 5 | 文本 = `symbol · name`、**不带编号** | `currencyLabel`（`:22`）= `` `${symbol}${name ? ' · '+name : ''}` ``；`<option value={String(row.cid)}>` 只把 cid 放进 `value` | ✅ 相符 |
| 6 | 默认 `$`（cid 1） | `DEFAULT_CID = '1'`（`:16`）+ `useState({ cid: DEFAULT_CID, … })`（`:32`） | ✅ 相符 |
| 7 | cid 1 不在列表 ⇒ 选首项 | `:52-55` `list.some(… ? prev : { …prev, cid: String(list[0].cid) })` | ✅ 相符 |
| 8 | 失败 / 空列表 ⇒ 回退仅 `$`、表单仍可提交 | `FALLBACK_CURRENCIES`（`:19`）在空列表（`:46-48`）与 `catch`（`:58-59`）两条路径都落到；**未触碰 `jobs-primary` 的 disabled 逻辑**（该逻辑只由 `state.phase === 'loading'` 决定） | ✅ 相符（判负见 §47.8.5 #21） |
| 9 | 提交 `cid` 仍为数字、`POST /api/job` 形状不变 | `:101` `cid: Number(form.cid)`；后端 `app.post('/api/job', …)` 零改动 | ✅ 相符 |
| 10 | 注册点 **108 → 108（+0）** | 现取 108（get 48 / post 56 / put 0 / delete 3 / patch 1）；实现 commit 只含 `frontend/**` + `ops/**` | ✅ 相符（**109 = 判负**） |
| 11 | `jobs.cid` / `jobs.cidNote` 四语只改值、键数不变；`item.cid*` 不动 | zh `币种` / `请从下拉框选择悬赏币种`；en `Currency` / `Select the currency from the dropdown.`；hk `幣種` / `請從下拉框選擇幣種。`；vn `Tiền tệ` / `Chọn tiền tệ từ danh sách.` —— **手填语义清零**；四语键集 **128 / 1106 / 4424** 不变；`item.cid*` 本轮未触碰 | ✅ 相符 |
| 12 | **观察项（非判负）** | zh `jobs.cidNote` 含「**悬赏**」限定，en / hk / vn 无对应限定（`悬赏` / `bounty` 未出现）⇒ **四语语义不完全对称**（不违本节任何条文：文案精确字面归实现单）；如需统一，属**一句话可改** | ⚠️ 观察（不判负） |

---

## 3. 未做项与边界（显式登记，不冒充已做）

- **未建快照**：`docs/versions/route-layer.spec.v2.38.md` / `design-system` 快照均**未建**（快照重制归版本收口单）。
- **未跑门套**：`/task/new` 的 DOM / 网络层判据**不由本单实跑**（Jing 只写规范；实测归 Kong 的 `publish-job-cid-select.test.jsx` 与 Neng 的独立质检）。
- **未改代码**：`backend-ts/**` / `frontend/**` **零改动**；本单 commit 只含 3 个 docs 文件 + 本文件。
- **未 push**：只做本地 commit。
- **口径边界**：本单**未新开 §48**（零新路由，不构成新「路由族」）；**§47.0 / §47.3 / §47.5 的旧句一字未动**，「唯一消费点」「`/jobs/publish` 本单不动」两处旧口径由 §47.8.6 以「作废 · 以本段为准」承接。
