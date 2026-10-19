# SPEC-NOTE · 三笔收口回写（综合排序 / 首页分页 36 / `≥1280` 六列 + 容器 1536）

- **日期** = 2026-10-19 · **仓** = `/Users/kevin/bistro/seafood`
- **角色** = Jing（Specifier · 制度员）· **单号** = `JING-SPEC-FEED-CLOSURE`
- **性质** = **收口回写 + 裁定记录**，**零代码 / 零迁移 / 零新路由**（注册点仍 **110**）
- **基线 HEAD（编制时点现取）** = `0d8d15f`（生产终验证据笔）；`origin/main` = **`f97252d`**；`origin/main..HEAD` = **1**
- **本笔写面** = `docs/seafood.master-plan.md` · `docs/route-layer.spec.md` · `docs/design/design-system.spec.md` · `docs/OPEN-ITEMS.md` · 本文件

## 1. 三笔的既成事实（均已验 · 本笔只登记，不重做）

| 段 | 三笔 | 读数 |
|---|---|---|
| **实现** | `0fe454a` 综合排序 v1 · `82e465e` 首页分页（`PAGE_SIZE = 36` · 只列 `listed`）· `10ef6b1` 六列 + 容器 1536（`T121`） | `git show --stat` 现取，见 master §5.427 A |
| **质检** | 排序 6/6 PASS（`ops/feed-ranking/qa/verdict.json`）· 分页 + 6 列 6/6 PASS（`ops/batch-1019-3/qa/verdict.json`） | 两 verdict 均 `summary.PASS=6 / FAIL=0 / NOT_MEASURED=0` |
| **上线** | push `b10f3d6..f97252d`（**7 提交**） | 本批**零迁移**（生产 `schema_version` 仍 `0051`）· 零新路由（110） |
| **生产终验** | `0d8d15f`（push 后证据笔，不触发部署） | 证据 = `ops/batch-1019-3/prod-verify/` |

### 1.1 生产终验关键读数（现取复核）

- **同版 sha256 逐字**：js `e18004923837fed75fb9bfde8e887b4068cdb4834918258f1a0cf8124f874bff`（`index-BdkQSoB8.js` **496,937 B**）/ css `ab4520e87a630616d121e5f7054b5d8d80486c0d08de126aeec5a445a1d7b5db`（`index-bzxNYmoV.css` **124,262 B**）—— 本笔对 `ops/batch-1019-3/prod-verify/` 内两件副本重跑 `shasum -a 256`，与 `SUMMARY.txt` 记录逐字相同。
- **CSS marker 3/3** = `min-width:1280px` · `repeat(6,minmax(0,1fr))`（压缩后 ×2）· `--sf-st-shell-max-w:1536px`。
- **JS marker 4/4** = `feed-sentinel` / `feed-grid` / `prize/all?skip=` / `feed-end` 各 1。
- **五档真浏览器**（1024 / 1280 / 1440 / 1536 / 1920）列数 **4 / 6 / 6 / 6 / 6**；容器实宽 **1024 / 1280 / 1440 / 1536 / 1536**（1920 档 `left=192` ⇒ 居中）；横向溢出 **0**；`pageerror` / console error **0**；首卡 `/item/4`。
- **诚实边界**：生产 `listed` **仅 4 件** ⇒ 首屏即到底（`feed-end` 在场），**多页续拉 / 跨页去重 / 失败重试三臂在生产不可见**，只在 dev 同版本代码 + `context.route` 夹具取证。

## 2. 两条 Zang 裁定（§5.426 H 的「待裁」→ 现裁死）

| # | 项 | 裁定 | 否定项 / 后果 |
|---|---|---|---|
| ① | 6 列实现路径 | **A（CSS 断点驱动）**：首页网格回 `.sf-grid sf-feed`，6 列落 `frontend/src/styles.css:23-27` 顶层 `@media (min-width:1280px)` | **否决 B**（`ResponsiveGrid` + `xl={6}`）：该组件走 `useBreakpoint()` 的 `window.innerWidth` + `resize` 监听（`Responsive.jsx:4-22`）⇒ 列数由 JS 宽度读数驱动，违「断点只在 CSS」；且会与 `STRUCT_PROV` 溯源链脱钩 |
| ② | `ResponsiveGrid` 组件 | **本批不动 ⇒ `OPEN-ITEMS` `B39` 另立单**（「断点回 CSS」） | 现取 **9 处**调用点（`HomePage.jsx:401` 任务区 · `TaskPage.jsx` 4 · `DashboardPage.jsx` 2 · `ProfilePage.jsx` 2）；首页商品网格**已零调用** |

## 3. 两处口径更正（写进台账 · 旧字面不删、以新段为准）

| # | 旧字面 | 现行口径 | 现取依据 |
|---|---|---|---|
| ① | 详情行「**45 键**」（§5.425 C · 版本表 v0.342 行） | **46 键**（45 + 既有 `seller` 嵌套） | `/api/prize/76`、`/api/prize/1` 均 46 键；**父版同样 46 ⇒ 非回归**（`ops/batch-1019-3/qa/readings/api-db.json` + 排序质检 `ruler_notes`） |
| ② | 分页重叠「**36→72→80 且第 2 页重叠 2 行**」（§5.426 B 判负口径） | **重叠算术 = 36 + 36 − 2 = 70**；「36→72→80」只在重叠落**第 2↔3 页边界**时成立 | 两套夹具：paged-a（重叠 `71,72`）36→72→80；paged-b（重叠 `35,36`）**36→70→80**（82 交付 → 80 distinct） |

## 4. 本笔改了哪些文件（逐册 · 纯追加自证）

| 文件 | 落点 | `git diff --numstat`（现取 · 新增/删除） |
|---|---|---|
| `docs/seafood.master-plan.md` | **§5.427**（倒序前插于 §5.426 之前）+ **版本表新行 v0.344**（插于 v0.343 之上 = 表内最新块首行） | **29 / 0** |
| `docs/route-layer.spec.md` | 文件末尾 **§49.9 实现回写与生产终验**（4 小节：实现落点 / 质检读数 / 生产终验 / 未做）；**§49.1–§49.8 一字未改**，**不升版** | **46 / 0** |
| `docs/design/design-system.spec.md` | 文件末尾 **§25.11 裁定与落地**（5 小节：两条裁定 / 落地读数 / 落地差 / `T121` 逐款回写 / 未做）；**§25.0–§25.10 一字未改**，**不升版** | **53 / 0** |
| `docs/OPEN-ITEMS.md` | ① 顶部 **v2.45 块**（纯追加于 v2.44 块之后）② B 段 **`B37 ❗ 状态核对` / `B38 ❗ 状态核对` / `B39`（新）** 三行（追加于 `B38` 原行之后） | **5 / 0** |
| `ops/batch-1019-3/SPEC-NOTE-closure.md` | 本文件（新） | 新文件（未跟踪） |

## 5. 纪律自证（`git diff --numstat` 现取）

- **四册删除列 = 0**（纯追加 / 倒序前插），命令：`git diff --numstat -- docs/` ⇒ 逐册 `<新增>\t0\t<path>`。
- **commit 只 add 本笔改的文件**（`docs/seafood.master-plan.md` / `docs/route-layer.spec.md` / `docs/design/design-system.spec.md` / `docs/OPEN-ITEMS.md` / 本文件），**不用 `git add -A`**。
- **不 push**：生产已在 `f97252d` 且终验通过；本笔是文档收口，**推送即上线** ⇒ 留待 Zang 合并批次统一 push。
- **零代码**：`frontend/**` / `backend-ts/**` / `migrations/**` 一行未动（`git status --short` 现取仅 5 个文档项）。

## 6. 未做 / 仍挂账（不把非缺口写成缺口）

- **`B37` 分页偏移漂移** —— 仍挂账（v1 明确接受漂移；「重复」已被 `bID` 去重消除，「漏」未兜底；彻底解 = keyset / 快照，另立单）。
- **`B38` 手机档列数 `2/2`** —— 仍挂账、**待 Kevin 一句话**；`T121` 明确不动手机档（`feed-cols-m` 仍 `2`，PROV `n:[328]` 仍 1 列）。
- **`B39` `ResponsiveGrid` 断点回 CSS** —— **本笔只登记、不实现**（9 处调用点，涉任务区 / 工作台 / 个人页三处布局）。
- **`feed-cols-xl` 未入 token**（设计 §25.5 原表列了该新键，裁定后 6 列 = 断点层字面）⇒ 已在 design §25.11.3 披露；若日后要求「列数可回读 / 可配置」，**另一单**，不并入 `B39`。
- **生产手机档（390）读数未取**（生产探针五档 = 1024/1280/1440/1536/1920）⇒ 手机档只有 dev 读数（2 列）。
