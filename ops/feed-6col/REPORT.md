# REPORT · JING-SPEC-FEED-6COL 实现（容器 `1536px` · `≥1280` ⇒ 6 列 · 夜档列数统一）

- **日期** = 2026-10-19 · **仓** = `/Users/kevin/bistro/seafood`
- **基线 HEAD** = `db9c258`（契约册 `ops/feed-6col/SPEC-NOTE.md` 上一笔已提交）
- **裁定来源** = Zang（商品网格回 CSS 断点驱动；不走 JS 宽度分支；`shell.css` 不得新增断点块）
- **后端** = 零改动（本单只动前端 + 真源 + 生成物）

## 1. 改了什么（5 个文件）

| 文件 | 改动 |
|---|---|
| `frontend/src/pages/HomePage.jsx` | 首页商品网格 `ResponsiveGrid sm=1 md=2 lg=4 gap=6` ⇒ `<div className="sf-grid sf-feed" data-sf-m="feed-grid">`（钩子保留、卡数判据不变；`ResponsiveGrid` 与首页**任务区**网格本单未动，B39 另立单） |
| `frontend/src/styles.css` | **顶层**新增 `@media (min-width: 1280px) { .sf-feed { grid-template-columns: repeat(6, minmax(0, 1fr)); } }`（只覆盖列数，不动 gap/padding，不硬编码容器宽） |
| `frontend/src/theme/tokens.js` | `STRUCT['shell-max-w']` `1440px → 1536px`；`STRUCT_PROV['shell-max-w']` d/n 重指 `:1180`；`STRUCT_PROV['feed-cols'].n` 由 `:291`(3 列) 重指 `:1182`(4 列) |
| `frontend/src/theme/theme-tokens.css` | 生成物重生成（`gen-theme-css.mjs`，先跑零漂移自证）：仅 `--sf-st-shell-max-w: 1440px → 1536px` 一行变 |
| `docs/design/style-preview.html` | 尾部**纯追加** `<section id="layout-width-ref-v124">`（14 行、删除列 0）：`max-width:1536px` / `.feed{…repeat(4,minmax(0,1fr))}` / `@media (min-width:1280px){.sf-feed{…repeat(6,…)}}` |

**命名说明（须披露）**：裁定文字写「回到 token 驱动的 `.sf-feed`（shell.css:60 已为 `repeat(var(--sf-st-feed-cols), minmax(0,1fr))`）」，但现取仓内**没有** `.sf-feed` —— `shell.css:58-62` 那条 token 驱动规则的选择器是 **`.sf-grid`**。故实现为「`.sf-grid` 提供基础 4 列 + 767 块 2 列（token），`.sf-feed` 作为 ≥1280 的 6 列修饰类」，HomePage 节点 `class="sf-grid sf-feed"`。好处：`ThemePreviewPage` 的 `.sf-grid`（窄容器演示）不被 6 列规则波及，作用域恰好只在首页商品网格。

**未新增 `feed-cols-xl` token**：裁定明确「≥1280 的 6 列由 `styles.css` 顶层规则统一覆盖」，故 6 列是**断点层字面值**、不是 token；因此 `STRUCT`/生成物无新键（与 SPEC-NOTE §4 表里的 `feed-cols-xl` 方案有差，按裁定文字执行）。

## 2. 真浏览器读数（`ops/feed-6col/readings/probe-feed-6col.json`）

栈：真 vite dev `5787`（`/api` 反代 `5788`）+ 真 dev 后端 `5788`，零拦截；日/夜两档各五档。`cards=9`（dev listed 实况）。

| 档 | 列数（日/夜） | 单卡宽 | 网格宽 | `.sf-route-container` maxW / 实宽 | 横向溢出 |
|---|---|---|---|---|---|
| 390 | **2 / 2** | 164.50 | 338 | 1536px / **390**（满宽） | 0 |
| 1024 | **4 / 4** | 218.00 | 920 | 1536px / 1024 | 0 |
| 1440 | **6 / 6** | 209.33 | 1336 | 1536px / 1440 | 0 |
| 1536 | **6 / 6** | 225.33 | 1432 | 1536px / **1536** | 0 |
| 1920 | **6 / 6** | 225.33 | 1432 | 1536px / **1536**（止于上限） | 0 |

- 卡内标题 / 价格：前 12 卡逐卡 `scrollWidth - clientWidth = 0`；`title line-height` 恒 `18px`（高度只有 18 / 36 两值 ⇒ 1 行或 2 行换行，无截断、无跳行）。
- `pageerror = 0` / `console error = 0`（十次加载全零）。
- 单卡宽与预期「≈200 / 227 / 243」的差 = 两处**既有**内缩：`.sf-route-container` 20px × 2 + 首页 `ResponsiveContainer` 的 `lg:px-8` 32px × 2 ⇒ 1536 档可用 1432px、6 列 16px 间距 ⇒ 225.33。间距取结构常量 `--sf-st-feed-gap` = 16px（旧 `gap-6` = 24px），故比派单估值略窄。

## 3. 门套

| 门 | 结果 |
|---|---|
| `npm run build` | **exit 0**（`build.log`，产物 CSS 含 `@media(min-width:1280px){.sf-feed{grid-template-columns:repeat(6,minmax(0,1fr))}` 与 `--sf-st-shell-max-w:1536px`） |
| `npx vitest run src/test/unit` | **61 文件 / 583 例全绿**（= 基线，未少）`test-unit.log` |
| `theme-tokens.test.js` + `theme-shell-isomorphism.test.jsx` | **2 文件 / 33 例绿**（PROV 行号回读 + CSS↔JS 逐键互校）`gates-theme.log` |
| `grep -c '@media' shell.css` | **1**（`shell.css` 一字未改） |
| 生成器零漂移自证 | 改前 `cmp` = 0 ⇒ 改后生成物 diff 恰 1 行 |

## 4. 边界 / 遗留

- 任务区 `ResponsiveGrid`（`HomePage.jsx:401`）本单**未动**（B39 另立单）。
- `.sf-grid` 基础 4 列、767 块 2 列两处**未动**；`feed-cols-m` 夜档 1 列与日档 2 列的历史差异仍在（`B38`）。
- 1280–1536 区间每行 6 条的观感（卡宽 209px 档）已读数但**未做像素级设计验收**。
