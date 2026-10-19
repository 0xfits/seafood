# SPEC-NOTE · 宽度与列数契约登记（容器 `1536px` · `≥1280` ⇒ 6 列 · 夜档列数统一）

- **单号** = `JING-SPEC-FEED-6COL` · **角色** = Jing（Specifier · 制度员）
- **日期** = 2026-10-19 · **仓** = `/Users/kevin/bistro/seafood` · **基线 HEAD** = `0fe454a`
- **交付性质** = **只登记契约**（`docs/**` + 本件）；**零代码、零真源改动、零生成物重生成、零服务启停**
- **状态** = 契约冻结 · **实现未派单（笔 2 待发）** · 本笔**不 push**
- **正典位置** = `docs/design/design-system.spec.md` **v1.24 §25（规则 `T121`）** · `docs/seafood.master-plan.md` **§5.426（C/D 段）+ 版本行 v0.343** · `docs/OPEN-ITEMS.md`（**`B38`**，顶部 v2.44 块）
- **★ 编号勘误（必须披露）**：派单写「新增记 **`T104`**」，但 **`T104` 已被 v1.19 §21（消息面板化 `T104`–`T108`）占用** ⇒ 按「数字现取」**顺延为 `T121`**（现取最大 `T120` = §24）。

---

## 1. Kevin 口径（逐字 + 问答结论）

> ① 「**web 版 UI 要保证每行 6 条商品（目前 4 条）。**」
> ② 「**容器最大宽 1536px**。」

**问答结论（留痕 · 防反复）**：Kevin 曾以「约 **1500** 像素」描述容器宽（§22.11 `Q1` 原话）。本日**当面说明「1500 不是标准宽度」** ⇒ **`1500` 退出候选**；取 **`1536px`**（标准宽度序列 `1024 / 1280 / 1536 / 1920` 的上沿）。**§22.11 `Q8`「已裁 = 不动 1440」字面逐字保留**，其后已追加 `Q8 ❗ 指针（v1.24）` 行 ⇒ 现行 = `1536`。

## 2. 冻结契约（`T121` 三款）

| 款 | 契约 | 落点 |
|---|---|---|
| **a** | 容器最大宽 **`--sf-st-shell-max-w` = `1536px`**（日/夜同值、结构常量） | `tokens.js` `STRUCT['shell-max-w']`（现 `'1440px'` `:410`）；生成物 `theme-tokens.css:17` |
| **b** | **`≥1280px` ⇒ `.sf-grid` 6 列** · **`768–1279px` ⇒ 4 列**（不变） · **`<768px` 手机档不变** | **6 列落 `frontend/src/styles.css` 顶层 `@media (min-width:1280px)`**；4 列 = `shell.css:60`（不动）；手机档 = `shell.css:200`（不动） |
| **c** | **夜档 `feed-cols` `3 ⇒ 4`**（与日档一致） | 真源夜档行改 4 列 + `STRUCT_PROV['feed-cols'].n` 重指新行；`STRUCT['feed-cols']` 值仍 `'4'` |

**列数断点表**

| 视口 | 列数 | 现取状态 |
|---|---|---|
| `≥1280px` | **6** | **待实现**（现 = 4 列） |
| `768–1279px` | **4** | 已符合、一字不动 |
| `<768px` | 不变（现 d `2` / n `1`） | 不变；是否调 `2/2` ⇒ `B38` 待 Kevin |

**整除校验（非新约束）**：`36 % 6 = 0`（6 行整）、`36 % 4 = 0`（9 行整）⇒ 首屏 36 条两档均无半行空洞（与 `route-layer.spec` §49.8 的 `PAGE_SIZE` 自洽）。

## 3. 落点约束（**硬理由，不是偏好**）

1. **`shell.css` 只允许唯一 `767` 断点块**（现取 `grep -c '@media' shell.css = 1`，唯一块 = `:185` `@media (max-width: 767px)`）⇒ **6 列规则只能落 `src/styles.css`**。
   **依据**：`theme-shell-isomorphism.test.jsx:216-230` 断言 `shell.css` 的 `@media` **恰 1 个**且必须含 `767px`，并断言宽屏块含 `repeat(var(--sf-st-feed-cols), minmax(0, 1fr))`、手机块含 `repeat(var(--sf-st-feed-cols-m), minmax(0, 1fr))`。塞第二个块 ⇒ 断言必红；改断言 = 动冻结面（判负）。
   **先例**：§14 桌面 gutter（裁定⑨/⑩，v1.9 已撤销）即裁「断点规则落 `styles.css`、`shell.css` 一字不动」⇒ 本版同法。
2. **`styles.css` 的 1280 块只许覆盖 `.sf-grid` 的 `grid-template-columns`**（不得改 `gap` / `padding`，也不得在此硬编码 `1536px` —— 容器宽走 token）。
3. **不得手改 `theme-tokens.css`**（生成物）：用既有生成器 `backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs`，**先跑一次零漂移自证 `cmp = 0`** 再生成。

**顺带现取**：`styles.css:69` 的 `@source inline("… md:grid-cols-6 … xl:grid-cols-6 …")` **已含 `grid-cols-6` 安全列白名单** ⇒ 走工具类路线**无需补 safelist**；但口径仍以 `var(--sf-st-feed-cols-xl)` 为准（直接写 `repeat(6, …)` 会与 `STRUCT_PROV` 溯源门脱钩）。

## 4. token / PROV / 生成物 三件链（缺一即判负）

| 键 | 现值 | 目标 | `STRUCT_PROV` 现指 | 目标指针 |
|---|---|---|---|---|
| `shell-max-w` | `'1440px'`（`:410`） | **`'1536px'`** | `d/n [85,'max-width:1440px']`（`:454`） | `d/n [<新行>,'max-width:1536px']` |
| `feed-cols` | `'4'`（`:411`） | `'4'`（不变） | `d [115,…4]` / **`n [291,…3]`**（`:455`） | `d` 不变 / **`n [<新行>,'grid-template-columns:repeat(4,minmax(0,1fr))']`** |
| **`feed-cols-xl`** | （无） | **`'6'`（新键）** | — | `d/n [<新行>,'grid-template-columns:repeat(6,minmax(0,1fr))']` |
| `feed-cols-m` | `'2'`（`:412`） | `'2'`（不变） | `d [116,…]` / `n [328,'…minmax(0,1fr)']`（`:456`） | 不动（`B38`） |

**真源追加块（`docs/design/style-preview.html`）**（现取 **1172 行 / 102,653 B / md5 `a17919a495f4bd03bdf2434df8013753`**）：

- **尾部纯追加** `<section id="layout-width-ref-v124">`，必须含**三行可回读字面**（`theme-tokens.test.js:132-140` 的机制 = 按行号取原文 + 断言含 needle）：
  1. `max-width:1536px`
  2. `grid-template-columns:repeat(6,minmax(0,1fr))`（注释可说明 `@media (min-width:1280px)` 语境，**needle 必须逐字出现**）
  3. `.vstage-b .feed{grid-template-columns:repeat(4,minmax(0,1fr))}`
- **旧行不删**：`:85` `.tb-inner{…1440px…}` / `:112` `.layout{…1440px…}` / `:291` `.vstage-b .feed{…repeat(3,…)}` **逐字保留**（历史 + `feed-gap.n` 仍指 `:291`）⇒ 真源 `numstat` 删除列 = 0。
- **生成物预期差异** = `:17` 值改 + **新增 `--sf-st-feed-cols-xl: 6;`**（`STRUCT` +1 键 ⇒ 生成物 +1 行）。

## 5. 夜档列数 `3 ⇒ 4` —— 现状是一处真矛盾

- `STRUCT['feed-cols'] = '4'` 是**单值**、生成物 `theme-tokens.css:18` 只有一份 ⇒ **应用层日夜都 4 列**。
- 但 `STRUCT_PROV['feed-cols'].n` 指 `style-preview.html:291` 的 **`repeat(3,…)`** ⇒ **真源夜档 3 列 ≠ 值表 / 应用 4 列**。
- `EXCLUDED_FROM_THEME` 该行 `why` 早已写「栅格列数属断点层（横竖屏也不得按主题变）」⇒ 现盘留着一条**反例**。本版即修（§25.3），`feed-cols-m` 的同类差异并入 `B38`。

## 6. 判负 / AC（8 条 · 质检必带）

| # | 探针 | 期望 |
|---|---|---|
| 1 | 1280 / 1440 / 1600 / 1920 四档 `.sf-grid` 计算列数 | **6**（任一档 ≠ 6 ⇒ 判负） |
| 2 | 768 / 1024 | **4** |
| 3 | 390 / 375 / 320（日档） | **2** |
| 4 | 夜档同档位 vs 日档 | **逐档相等**（含 `≥1280` 的 6；不等 ⇒ 判负） |
| 5 | `.sf-route-container` 计算 `max-width` | **`1536px`**（`≤767` 仍满宽） |
| 6 | `grep -c '@media' shell.css` | **`1`**（出现第 2 块 ⇒ 判负） |
| 7 | 六档（768…1920）× 三页（`/`、`/item`、`/exchange`） | `scrollWidth == clientWidth`（`T85` 不降级） |
| 8 | `theme-tokens.test.js` PROV 回读 + 生成物一致 | 全绿；`--sf-st-shell-max-w: 1536px` 与 `--sf-st-feed-cols-xl: 6` 均在生成物 |

## 7. 现取自证（2026-10-19 · HEAD `0fe454a`）

| 项 | 读数 |
|---|---|
| `STRUCT` | `shell-max-w` `'1440px'`（`:410`）· `feed-cols` `'4'`（`:411`）· `feed-cols-m` `'2'`（`:412`） |
| `STRUCT_PROV` | `shell-max-w` `d/n [85,…1440px]` · `feed-cols` `d [115,…4]` / `n [291,…3]` · `feed-cols-m` `d [116,…2]` / `n [328,…1]`（`:454-456`） |
| 生成物 | `theme-tokens.css:17-19` = `1440px` / `4` / `2`（日/夜同值、单份） |
| `shell.css` | `@media` **1** 块（`:185` 767px）· 宽屏 `.sf-grid` = `:60` · 手机档 = `:200` · `max-width` 仅 `:29` 一处 |
| `styles.css` | **无** `min-width:1280` 块（本版新增）；`:69` 已含 `grid-cols-6` 安全列 |
| 真源 | `style-preview.html` **1172 行 / md5 `a17919a4…013753`**；`1440px` 命中 `:85` / `:112`；夜档 3 列 = `:291` |
| 本册改动 | 只写 `docs/**` + 本件；**未动 `frontend/**` / `docs/design/style-preview.html`** |

## 8. 未做（诚实边界）

- **实现未派单**：`tokens.js` / `theme-tokens.css` / `style-preview.html` / `styles.css` **零改动**；8 条 AC **一条未跑**（无浏览器几何读数）。
- **手机档列数未定**（`B38`）：现 d `2` / n `1`，本版**明确不动**。
- **观测项**：`≥1280` 档 6 列卡宽 ≈ `(min(视口,1536) − 2×20 − 间距) / 6`；**1280–1536 区间的观感是否偏窄未验**（属观感，读数归实现单 / 质检单）。
- **作用域** = `.sf-route-container`（全站唯一 `max-width` 声明）；若将来出现第二个容器（后台台面单独定宽）**须另立单**。

## 9. ★ 实现面冲突（登记 · 待 Zang 裁定 · 本笔不改契约）

**现取**（工作区未提交面 = 笔 1 在跑）：首页商品网格已改为 **`<ResponsiveGrid sm={1} md={2} lg={4} gap={6} data-sf-m="feed-grid">`**（`HomePage.jsx:446`），档位走 **Tailwind 类名**（`xl:` = **≥1280**）；`.sf-grid` 现只余 `ThemePreviewPage.jsx:147` 一个消费者 ⇒ **§2 的「6 列落 `styles.css` 覆盖 `.sf-grid`」对首页不生效**。

**两条对齐路径（须 Zang 裁定，不得由实现方自选）**：

| 路径 | 做法 | 代价 |
|---|---|---|
| **(A) token 路径**（本件原文） | 首页网格回 `.sf-grid`（或 1280 块同时命中 `[data-sf-m="feed-grid"]`）+ `var(--sf-st-feed-cols-xl)` | 与笔 1 已落改造同批回退网格节点 ⇒ 重跑首页用例；但 `STRUCT_PROV` 溯源完整 |
| **(B) `ResponsiveGrid` + `xl={6}`** | 改一行 prop（`gridClasses` 已含 `6` · `styles.css:69` 已含 `xl:grid-cols-6` ⇒ 无需补 safelist） | 与 token 层脱钩 ⇒ `feed-cols-xl` **不必新增**，「三件链」缩为 `shell-max-w` 两件 + 夜档 `feed-cols.n` 重指；本册须出勘误追补 |

**质检口径**：列数判据以**首页信息流网格实际节点的计算列数**为准（`.sf-grid` 或 `[data-sf-m="feed-grid"]`），**不以选择器名判负**。
