# Neng 质检报告 · 首页商品卡片 UI 改造（§22 · design-system v1.20）

> **骨架先落盘**（防上限制停）—— 本文件随后按腿逐项补全；凡未取得读数的格子一律写 `待补` / `NOT_MEASURED`，**不预填 PASS**。

## 0. 元信息

| 项 | 值 |
|---|---|
| 被检 revision | **`4b388d0`**（`feat(seafood): 首页商品卡片 UI 改造（底色分层 · 价格块照参考图 · 整卡可点击）· design-system v1.20`） |
| 被检树 | `frontend/dist` 静态产物（`context.route` 映射到磁盘，**零 dev server / 零后端 / 零库写**）+ 源码只读核 |
| 父版基线 | `git worktree` @ `d8cb98e`（detached）→ `frontend/dist` |
| 规范真源 | `docs/design/design-system.spec.md` §22（`T109`–`T113` · AC-1–AC-9 · 清单 A/B） |
| 质检方 | Neng（质检员）· 自写自跑探针 · **不采信实现方读数**（`kong-*` 只作旁证） |
| 纪律 | 只读被检代码；不 `npm install`；不 commit / push / `git add -A`；不启停服务；参考图不触碰（sha256 收尾复核） |
| AC 来源 | §22.9 表（AC-1…AC-9，含 `AC-9 · v1.20c 勘误注`） |
| 冻结面 | §22.7 清单 B（**B1–B11**，11 条） |

## 1. 主判定总表（AC-1 … AC-9）

| AC | 判定 | 关键读数 | 读数文件 |
|---|---|---|---|
| AC-1 底色分层 | 待补 | 待补 | `qa/neng-readings-ac123.json` |
| AC-2 价格块版式 | 待补 | 待补 | `qa/neng-readings-ac123.json` |
| AC-3 整卡可点击 | 待补 | 待补 | `qa/neng-readings-ac123.json` |
| AC-4 无 Router 回落（两向判负） | 待补 | 待补 | 待补（本轮独立腿） |
| AC-5 归因式不动面 | 待补 | 待补 | `qa/neng-readings-ac5.json` + `qa/neng-ac5-stdout.txt` |
| AC-6 结构不变式 | 待补 | 待补 | `qa/neng-readings-static.json` |
| AC-7 门套（build + test:unit） | 待补 | 待补 | `qa/neng-build.log` / `qa/neng-testunit.log` |
| AC-8 范围边界 | 待补 | 待补 | `qa/neng-readings-static.json` |
| AC-9 夜档价格可读性 | 待补 | 待补 | `qa/neng-readings-ac9.json` |

## 2. 冻结面（§22.7 清单 B · 11 条）

| # | 断言 | 判定 | 读数 |
|---|---|---|---|
| B1 | `src/shell/**`+`src/theme/**` JS 无禁用宽度词 | 待补 | `qa/neng-readings-static.json` |
| B2 | `shell.css` 只有一个 767 断点块 + 宽屏无 `[data-theme` | 待补 | 同上 |
| B3 | 五 `data-sf-region` 恒等 + tabbar `href` 集 | 待补 | 同上 |
| B4 | 日/夜键集合与键序相同、≥100 键 | 待补 | 同上 |
| B5 | 键名黑名单 + 值形态白名单 | 待补 | 同上 |
| B6 | 两档差异键 > 90 且 `day.page-bg ≠ night.page-bg` | 待补 | 同上 |
| B7 | `STRUCT` ≥25 键 / 无 `#`、`rgba(` / PROV 齐备 / 不重名 | 待补 | 同上 |
| B8 | `STRUCT_PROV` 可回读 / `EXCLUDED_FROM_THEME` ≥8 | 待补 | 同上 |
| B9 | `p6-btn-impl2.test.js:104-131` | 待补 | 待补（本轮独立腿） |
| B10 | `r9-93-points-symbol.test.jsx:113-127` | 待补 | 待补（本轮独立腿） |
| B11 | `theme-shell-isomorphism.test.jsx:341 / :359` | 待补 | 待补（本轮独立腿） |

## 3. 缺陷 / 观察 / 建议（三分类）

待补。

## 4. 归因

待补。

## 5. 诚实清单（`NOT_MEASURED` / `ENV_LIMITED` · 原样保留）

待补。

## 6. 证据索引（AC → 读数文件）

待补。

## 7. 现场清理

待补。
