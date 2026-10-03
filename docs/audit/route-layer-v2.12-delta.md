# route-layer.spec v2.12 delta —— 批 9 第 1 片（P9①）**追补落册**：术语更正（`R-9-12`）+ 三待裁项裁定（`R-9-13`）+ 更正块 + 术语统一待办 + 待办收口

> **角色**：Jing（Specifier · 制度员）· **单号** = **JING-SPEC-P9-1R** · **同批姊妹册** = `docs/audit/data-layer-v0.19-delta.md`（正文 = `data-layer.spec` v0.19 §30）。
> **口径**：**只追加 · 零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**。
> **依据**：Zang `§5.222`（`docs/seafood.master-plan.md:1419-1443`）—— **B. `R-9-12`** + **C. `R-9-13`** + **D. 已派 Jing 追补落册单**。
> **前置**：本单**直接接在 v2.11（P9① 契约冻结）之后**；v2.11 的 `+212/-0` 与本单的 `+124/-0` 均**未提交**（工作树），故 `git diff --numstat`（HEAD → 工作树）= **`336\t0`**；**本单增量**（v2.11 快照 → v2.12 正文）= **`124\t0`**（两口径**删除列均 = 0**）。

## §D0 指纹（改前 / 改后 · 现取）

| 项 | 改前（v2.11） | 改后（v2.12） |
|---|---|---|
| 文件 | `docs/route-layer.spec.md` | 同 |
| 行数（`wc -l` = 换行符数） | **6205** | **6329** |
| 逻辑行（`wc -l` + 1；末行 `---` 无换行） | 6206 | **6330** |
| 字节 | 1273466 | **1290661** |
| md5 | `bda1cf40db2a66e0f4950cc4c730b214` | **`bdaec983d1bb06e955890a9b27e22afc`** |
| sha256 | `5b2f31b1ee9e21b461872920f36bf5930784f9ce24c621f14d1e10e8bfff1027` | **`832ed047c56fd36207e66b6f4ec9934bfef8191746e86e4dd189205261e6a1cb`** |
| 改前快照 | `docs/versions/route-layer.spec.v2.11.md`（`cmp` = 0 · **未动**） | — |
| 改后快照 | — | **`docs/versions/route-layer.spec.v2.12.md`**（`cmp` = 0 · sha256 同上） |

**只追加自证**：`git diff --no-index --numstat docs/versions/route-layer.spec.v2.11.md docs/route-layer.spec.md` = **`124\t0`**（**删除列 = 0**）；`git diff --numstat docs/route-layer.spec.md`（HEAD → 工作树）= **`336\t0`**（含上单 v2.11 的 `212\t0`）；`difflib.SequenceMatcher` 独立复核（v2.11 → v2.12）= **0 replace / 0 delete / 124 insert**；**旧快照 `v0.1`–`v2.11` 三十一件一字未动**（`git status --porcelain docs/versions/` = 仅 `v2.11`（上单）/ `v2.12`（本单）两件 untracked 与 data-layer 侧同类；**无任何 tracked 快照 modified**）✅。

## §D1 改动点（逐条）

| # | 落点 | 内容 |
|--:|---|---|
| 1 | **顶部状态块区**（`v2.11 本单要点` 之后、`v1.1 一页纸` 锚行之前） | **新增 v2.12 块 3 行 + 空行**（⇒ 其后全部行号 +4） |
| 2 | **§27〔新〕**（插在本册末行 `---` 之前） | P9① 追补落册：§27.0 性质与硬约束 / **§27.1 `R-9-12` 术语更正（逐字照录 `§5.222` B + 四语初值定稿 v2 表 + route 侧落位）** / **§27.2 `R-9-13` 三项裁定（逐字照录 `§5.222` C + route 侧落位 · **读口 `GET /api/role-names` 无鉴权 · 注册点 75 → 76 逐字登记**）** / **§27.3 更正块（覆盖 §26.12 / §26.2 / §26.6 / §26.7 的旧读法 · 旧行一字不改）** / **§27.4 待办收口** / **§27.5 术语统一待办登记（逐键现值 + `文件:行`）** / §27.6 `NOT_MEASURED`（3 项）/ §27.7 指纹自证 / §27.8 引用关系 |
| 3 | **§27 标题之后（仅 1 行注 · insert）** | **★ 标题口径（诚实登记）**：§26 / §26.2 标题「（中/越）」= `R-9-8` 原口径 · 经更正 = **四语** · **不改 §26 标题文本**（守「只追加 · 删除列 = 0」） |

**非追加改动 = 0 处**；`§1`–`§26` 正文一字未动。

## §D2 与 Zang 裁定的对应（诚实登记）

- **派单履约（`§5.222` D）**：**①** `R-9-12`（术语更正）逐字入册（§27.1）；**②** `R-9-13`（三项裁定）逐字入册（§27.2）；**③** **更正块**（覆盖 §26.12 的 en/vn 两列与「读口路径 · 待裁」字样 · 旧行一字不改，§27.3）；**④** **四语初值定稿 v2 表**（§27.1(a)）；**⑤** **术语统一待办登记**（§27.5）；**⑥** **待办收口**（读口路径 → 已裁；§27.4）；**⑦** 两册只追加 + 快照 + delta ✓。
- **逐字照录**：`R-9-12` / `R-9-13` 正文**逐字照录** `§5.222` B/C（`:1423-1439`），**未改写**（§27.1(a) / §27.2(c)）。
- **注册点逐字登记**：现取 `75`（`get 31 / post 41 / put 0 / patch 1 / delete 2` · 锚定口径排除注释行）⇒ 本读口新增后 **`get 31 → 32` ⇒ `75 → 76`**（§27.2(d)）。
- **未发明**：路径（`GET /api/role-names` = **裁准值**）、状态码、权限键、数值（`4`/`60`）、文案值（`siteSlogan` / `siteTitle` 四语 = `§5.222` C-3 逐字）。

## §D3 `NOT_MEASURED`（逐项 · 禁填 0 / 空）

| # | 未测项 | 原因 |
|--:|---|---|
| 1 | `R-9-12` / `R-9-13` 的 HTTP 实跑（含 `GET /api/role-names` 注册点生效 · 读数 `75 → 76`） | 规范单零代码；读口未实现 ⇒ HTTP `NOT_MEASURED` |
| 2 | 覆盖层（`role_names` + `site_text_overrides`）写入后响应体 / 前端实时生效两读数（含 `Vendor`/`Customer`） | 未实现 ⇒ 无读数 |
| 3 | 术语统一待办六键的批量改 | 另单、不阻塞 ⇒ 本单未改 |

## §D4 只追加自证（命令 + 读数）

```
git diff --numstat docs/route-layer.spec.md                                  →  336	0	docs/route-layer.spec.md
git diff --no-index --numstat docs/versions/route-layer.spec.v2.11.md docs/route-layer.spec.md  →  124	0
cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.12.md         →  (exit 0)
git status --porcelain docs/versions/                                         →  ?? v2.11.md / ?? v2.12.md（untracked；无 tracked modified）
```

- **注册点现取** = `75`（§D2）；**`siteTitle` 四语现存值**（`frontend/src/locales/{zh,en,hk,vn}.json:2`）= zh `Seafood 海鲜市场｜加密人自己的「闲鱼」` / en `Seafood｜The crypto crowd's own flea market` / hk `Seafood 海鮮市場｜幣圈人的跳蚤市場` / vn `Seafood｜Chợ đồ cũ của dân crypto`。
- **本单未写库 / 未 apply / 未启停服务 / 未打印 `.env`**（纯规范追补单）。
