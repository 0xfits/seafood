# data-layer.spec v0.13 → v0.14 delta（8④ 契约冻结：自建单位审核闸 —— 状态 / 载体 / 留痕三面）

**单号**：JING-SPEC-B8-4（同批姊妹册 delta = `docs/audit/route-layer-v2.7-delta.md`）
**角色**：Jing（Specifier · 制度员） · **裁定来源**：派单 8④（批 8 第 4 片）+ 已裁 `R-8-3` / `R-8-8`（`docs/seafood.master-plan.md:1803` / `:1825`）+ 侦察件 `docs/audit/p8-p6-recon.md`（84–93 行）
**日期**：2026-10-03 · **只追加**（**未 `git add` / `commit` / `push`**）

---

## §D0 声明、行数口径与指纹自证（**现取**）

**D0.1 写盘范围**：本单只写 **3 个文件** = `docs/data-layer.spec.md`（**就地升 v0.14**：顶部状态块**新增 1 行** + **§25〔新〕**）+ `docs/versions/data-layer.spec.v0.14.md`（**新建** · `cmp` = 0）+ 本 delta 件（**新建**）。**未碰**：`backend-ts/**` / `frontend/**` / `migrations/**` / `docs/seafood.master-plan.md` / `docs/qa/**`（**本刻有质检单 `docs/qa/p8-s3b-write-path-review.md` 在读 · 未触碰**）/ `docs/audit/**` 既有件 / `docs/design/**` / 其它 spec。**未** `git add/commit/push`；**未** `npm install`；**未**碰 / 打印 `.env*`；**未** `pkill -f` / `killall`；**未**启停 5787 / 5788。

**D0.2 ★ 行数口径（承 §24.9 · 写死）**：本册末行**带换行符**（`tail -c 1 | od` 现取 = `0a`）⇒ **`wc -l` = 逻辑行数**（两口径同值）⇒ **§25 直接追加于末行之后**（0 删除行）。姊妹册（route-layer）末行**不带换行符**（末字节 = `2d` = `-`）⇒ 其**一切追加插在末行 `---` 之前**。

**D0.3 指纹与只追加自证（现取）**：

| 项 | 改前（v0.13） | 改后（v0.14） |
|---|---|---|
| `wc -l` | **1621** | **1814** |
| `wc -c` | **403715** | **429600** |
| `md5 -q` | **`fa6822fcddb22a6c29f4026206a99702`** | **`6379d1dda5591965981edad769504d24`** |

- `git diff --numstat docs/data-layer.spec.md` ⇒ **`193	0`**（**删除列 = 0** ✅）
- `difflib.SequenceMatcher` 独立复核（对照 `docs/versions/data-layer.spec.v0.13.md`，`autojunk=False`）⇒ **0 replace / 0 delete**；**新增 193 行**
- **快照**：`docs/versions/data-layer.spec.v0.14.md`（**新建**）与正文**逐字节相同** ⇒ `cmp` **退出码 0** ✅
- **旧快照零改动**：`ls docs/versions | grep -c '^data-layer.spec.v'` 改前 = **13** ⇒ 改后 = **14**（**+1 = 新快照**）；**旧 13 件一字未动**（`git status --porcelain docs/versions/` = 仅两条 `??` 新件）✅
- **姊妹册（同批）**：`wc -l` 5095 → **5304** / `wc -c` 1095779 → **1124763** / md5 `91c66773…` → **`70dfa43bacd96f0bc5f46e1372ef2b55`** / `numstat` **`209	0`**

---

## §D1 变更点逐条（**依据锚点 → 改动点**）

| # | 变更点 | 落点 | 依据（现取） |
|--:|---|---|---|
| 1 | **顶部状态块新增 v0.14 行**（1 行） | `docs/data-layer.spec.md`（状态块区之首） | 本册历版惯例（§21/§22/§23/§24 头注） |
| 2 | **§25.0 开工锚**（现取逐项） | 新 §25.0 | 本单现取 |
| 3 | **§25.1 `currency.status` 闭合集**（4 值 · 逐字引 + 硬口径「不得发明状态值」） | 新 §25.1 | `0001_ledger_core.sql:35` / `:37`；`ledger.ts:170`；`ledger.spec:227`（R10）/ `:257-284`（§3.2）/ `:284`（R27）/ `:285`（R28） |
| 4 | **§25.2 `currency_status_log` 真实列（7 列逐字）+ 零写入现取核对（冲突登记）** | 新 §25.2 | `0017:139-152` / `:236-239`；`database.ts:197-263` / `:222-227` / `:2205`；`currency-service.ts:363`；`index.ts:1713`；`git log -S` = `1abea4c`；`p8-p6-recon.md:87/219`；`master-plan:1817/1843` |
| 5 | **§25.3 审核闸三变体（Ⅰ/Ⅱ/Ⅲ）+ 每案代价**（**不择一**） | 新 §25.3 | 派单 ①；`p8-p6-recon.md:93`（「须 Zang 裁定，不得自选」） |
| 6 | **§25.4 四段判据的数据侧（② / ③ 段）** | 新 §25.4 | P6 的 AC 原文；`ledger.ts:644-650` / `:630`；`0016_market.sql:951` / `:977`；`DL157②` |
| 7 | **§25.5 后台页数据契约 + 四语命名空间 + 六类泄漏禁项** | 新 §25.5 | `frontend/src/locales/{zh,en,hk,vn}.json`（顶层键数现取 = 105）；`frontend/src/pages/admin/**` = 9 页；承 `route-layer.spec` §19.5(c) |
| 8 | **§25.6 `NOT_MEASURED`（6 项）+ §25.7 指纹自证 + §25.8 引用关系** | 新 §25.6–§25.8 | 本单 |

**★ 编号纪律**：`DL1`–`DL157` **一字未动、未重排**（本册**不新增 `DL` 条** —— §25 以 **`CX*` / `CY*`** 承载）；**章节编号未重排**（新内容向后追加为 **§25**）。**`DL*` 条文与 §21 / §22 / §23 / §24 一字未动**。

---

## §D2 与派单 / 既有件不符项登记（**现取为准 · 不改他人行**）

| # | 项 | 派单 / 既有件所述 | **本单现取** | 处置 |
|--:|---|---|---|---|
| 1 | **`currency_status_log` 写入现状** | 「**表零写入**」（派单；`p8-p6-recon.md:87/219`；`master-plan:1817/1843`） | `grep -rn 'currency_status_log' backend-ts/src/` = **2 命中**（`database.ts:223` 写 + `:2189` 注释）⇒ **单边写入（恰 `draft → listed`）** | **现取为准**；他人行**一字未改**；准确表述改写 = §25.2(d)；冲突收口交 Zang（姊妹册 `route-layer.spec` §22.6 `I-6`） |
| 2 | **`currency_status_log` 现库行数** | —（未给） | **`NOT_MEASURED`**（零库连接） | 禁填 0（§25.6-1） |
| 3 | **`p8-p6-recon.md` 上报的代码行锚**（如 C1 `index.ts:1593` / C2 `:1621`） | 侦察时点值 | 本单现取 = C1 **`index.ts:1685`** / C2 **`index.ts:1713`**（**已漂**） | **以本单现取为准**（§22.1；侦察件行不改） |

---

## §D3 `NOT_MEASURED`（**逐项 · 禁填 0 / 空**）

| # | 未测项 | 原因 |
|--:|---|---|
| 1 | `currency_status_log` 现库行数 / `currency` 各 `status` 分布 | **零库连接**（红线）⇒ 无读数 |
| 2 | 审核动作（三变体任一）实跑两态 | **未实现**（规范单、零代码 / 零库 / 零 HTTP） |
| 3 | 变体选型（Ⅰ / Ⅱ / Ⅲ） | **待 Zang** |
| 4 | 新增状态值名 / 新表名 / 新列名 | **待 Zang / 实现单**（本册不发明） |
| 5 | 前端页字段级实现面 | **页面尚未存在**（现取 9 页，无审核页） |

---

## §D4 只追加自证 / 纪律自检

**D4.1 只追加自证（机器判据 · 见 §D0.3）**：`numstat` 删除列 = **0** ✅；`difflib` **0 replace / 0 delete** ✅；快照 `cmp` = 0 ✅；旧快照零改动 ✅。

**D4.2 纪律自检（逐条对照硬口径）**：① **只碰 spec + 新快照/delta** ✅（未碰代码 / `migrations/**` / `master-plan` / `docs/qa/**` / `docs/audit/**` 既有件 / `docs/design/**` / 其它 spec）｜② **未 `git add/commit/push`** ✅｜③ **未 `npm install`** ✅｜④ **未碰 / 打印 `.env*`** ✅｜⑤ **未 `pkill -f` / `killall`** ✅｜⑥ **未启停 5787 / 5788** ✅｜⑦ **未发明状态值 / 数值 / 日期** ✅（状态值名 / 新表列名全标「待 Zang」；仅现取读数入册）｜⑧ **未测项 = `NOT_MEASURED` + 原因** ✅（§D3 · 无 0 / 无空 / 无占位）｜⑨ **不确定处不二选一** ✅（三变体只登记、不择一）｜⑩ **报数带口径** ✅（行数 / 字节 / md5 / numstat 见 §D0）。**未测项**：本册**零库连接 / 零 HTTP / 零套件**。
