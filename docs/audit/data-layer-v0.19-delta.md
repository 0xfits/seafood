# data-layer.spec v0.19 delta —— 批 9 第 1 片（P9①）**追补落册**：术语更正（`R-9-12`）+ 三待裁项裁定（`R-9-13`）+ 更正块 + 术语统一待办 + 待办收口

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-1R** · **同批姊妹册** = `docs/audit/route-layer-v2.12-delta.md`（正文 = `route-layer.spec` v2.12 §27）。
> **口径**：**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**。
> **依据**：Zang `§5.222`（`docs/seafood.master-plan.md:1419-1443`）—— **B. `R-9-12`（术语更正）** + **C. `R-9-13`（P9① 三个待裁项裁定）** + **D. 已派 Jing 追补落册单**。
> **前置**：本单**直接接在 v0.18（P9① 契约冻结）之后**；v0.18 的 `+253/-0` 与本单的 `+121/-0` 均**未提交**（工作树），故 `git diff --numstat`（HEAD → 工作树）= **`374\t0`**；**本单增量**（v0.18 快照 → v0.19 正文）= **`121\t0`**（两口径**删除列均 = 0**）。

## §D0 指纹（改前 / 改后 · 现取）

| 项 | 改前（v0.18） | 改后（v0.19） |
|---|---|---|
| 文件 | `docs/data-layer.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **2750** | **2871** |
| 逻辑行 | **2750**（末行带换行） | **2871** |
| 字节 | 567651 | **585357** |
| md5 | `2f84b22abaeb0c7041e73a24875a5f6a` | **`fa698c0c8cd8ca45ac9f54272217bf81`** |
| sha256 | `d3dfa1de92ac2b44007d66f2c92eaaf7550918a24444975aa8dbef1100d8de8a` | **`e420e5012e0348b0bd32d1ca3d73eb60c43a6a07bc4ed0fcaf1f6d437e7341d3`** |
| 改前快照 | `docs/versions/data-layer.spec.v0.18.md`（`cmp` = 0 · **未动**） | — |
| 改后快照 | — | **`docs/versions/data-layer.spec.v0.19.md`**（`cmp` = 0 · sha256 同上） |

**只追加自证**：`git diff --no-index --numstat docs/versions/data-layer.spec.v0.18.md docs/data-layer.spec.md` = **`121\t0`**（**删除列 = 0**）；`git diff --numstat docs/data-layer.spec.md`（HEAD → 工作树）= **`374\t0`**（含上单 v0.18 的 `253\t0`）；`difflib.SequenceMatcher` 独立复核（v0.18 → v0.19）= **0 replace / 0 delete / 121 insert**；**旧快照 `v0.1`–`v0.18` 一十八件一字未动**（`git status --porcelain docs/versions/` = 仅 `v0.18`（上单）/ `v0.19`（本单）两件 untracked 与 route 侧同类；**无任何 tracked 快照 modified**）✅。

## §D1 改动点（逐条）

| # | 落点 | 内容 |
|--:|---|---|
| 1 | **顶部状态块区**（`# 标题` 与 `v0.18 状态行` 之间） | **新增 v0.19 状态行 1 行**（⇒ 其后全部行号 +1） |
| 2 | **§30〔新〕**（追加于本册末行之后） | P9① 追补落册：§30.0 性质与硬约束 / **§30.1 `R-9-12` 术语更正（逐字照录 `§5.222` B + 四语初值定稿 v2 表 + 数据层侧落位）** / **§30.2 `R-9-13` 三项裁定（逐字照录 `§5.222` C + 数据层侧落位）** / **§30.3 更正块（覆盖 §29.13 / §29.2(B7) / §29.3 / §29.7 的旧读法 · 旧行一字不改）** / **§30.4 待办收口（`storageDecimals`=4 / `streakDay7RewardBatt`=60 / `siteSlogan` / `siteTitle`）** / **§30.5 术语统一待办登记（逐键现值 + `文件:行`；`adminShards.thSeller`/`thBuyer` · `adminListingReview.colOwner` · `listings.priceRoleNote`/`ordersNote`/`refundNote`）** / §30.6 `NOT_MEASURED`（3 项）/ §30.7 指纹自证 / §30.8 引用关系 |
| 3 | **§30 标题之后（仅 1 行注 · insert）** | **★ 标题口径（诚实登记）**：「追补落册」= 对 §29 的追补 · **不改 §29 标题文本**（守「只追加 · 删除列 = 0」） |

**非追加改动 = 0 处**；`§21`–`§29` 与 `DL*` 条文一字未动。

## §D2 与 Zang 裁定的对应（诚实登记）

- **派单履约（`§5.222` D）**：**①** `R-9-12`（术语更正：`Seller`/`Buyer` → `Vendor`/`Customer`；`vn` 两列同改）逐字入册（§30.1）；**②** `R-9-13`（三项裁定 + 四项默认值）逐字入册（§30.2）；**③** **更正块**（覆盖 §29.13 的 en/vn 两列与「载体 / 读口待裁」字样 · 旧行一字不改，§30.3）；**④** **四语初值定稿 v2 表**（§30.1(a)）；**⑤** **术语统一待办登记**（逐键现值 + `文件:行`，§30.5）；**⑥** **待办收口**（`TODO: Kevin 定值` → 定案值，§30.4）；**⑦** 两册只追加 + 快照 + delta ✓。
- **逐字照录**：`R-9-12` / `R-9-13` 正文**逐字照录** `§5.222` B/C（`:1423-1439`），**未改写**（§30.1(a) / §30.2(c)）。
- **旧快照现取**：**旧快照 18 件一字未动**（本单新建 = `v0.19.md`）。
- **未发明**：路径（读口 = `GET /api/role-names`，**裁准值** · 非本单发明）、数值（`4` / `60` = `R-9-13` 裁准值）、文案值（`siteSlogan` / `siteTitle` 四语 = `§5.222` C-3 逐字）—— 一律照 `§5.222`。

## §D3 `NOT_MEASURED`（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因 |
|--:|---|---|
| 1 | `R-9-12` / `R-9-13` 的 HTTP / 前端实跑（含 `GET /api/role-names` 注册点生效） | 规范单零代码；读口未实现 ⇒ HTTP `NOT_MEASURED` |
| 2 | `role_names` / `site_text_overrides` 写入后库内落值（含 `Vendor`/`Customer`） | 候选键未入册（`APP_CONFIG_LEGAL_KEYS` = 2 键）⇒ 入册前写入必被 `AV1` 拒 |
| 3 | 术语统一待办六键的批量改 | 另单、不阻塞 ⇒ 本单未改 |

## §D4 现取读数（本单亲读 · 只读）

- **注册点（锚定口径 · 排除注释行）** = **75**：`get 31 / post 41 / put 0 / patch 1 / delete 2`（裸字面 76，差 1 = `:790` 块注释行）⇒ 本读口新增后 **`75 → 76`**。
- **`APP_CONFIG_LEGAL_KEYS`**（`backend-ts/src/database.ts:60`）= `['system_settings','listing_deposit_policy']` ⇒ **恰 2 键**（`R-9-13`-1 的白名单 `2 → 9` 基线）。
- **术语统一待办六键现值**（`frontend/src/locales/en.json` · `json.load` + 行号）：见 §30.5（T1–T6）；**四语齐**（`zh`/`en`/`hk`/`vn`）。
- **`siteTitle` / `slogan` 四语现值**：`siteTitle` = zh `Seafood 海鲜市场｜加密人自己的「闲鱼」` / en `Seafood｜The crypto crowd's own flea market` / hk `Seafood 海鮮市場｜幣圈人的跳蚤市場` / vn `Seafood｜Chợ đồ cũ của dân crypto`（`frontend/src/locales/{zh,en,hk,vn}.json:2`）。
- **本单未写库 / 未 apply / 未启停服务 / 未打印 `.env`**（本单为纯规范追补单，库面仅沿用上单只读读数）。
