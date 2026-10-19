# SPEC-NOTE-decisions · 商品卡三条待定项裁定（`card-rows`）

- **单号**：`JING-SPEC-CARD-ROWS-DECISIONS`（Jing · 制度员）
- **性质**：**裁定落册**（只写 `docs/**` + 本文件）。**零代码、零迁移、零 HTTP、不 push**。
- **编制时点**：2026-10-19 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main`
- **现取**：`origin/main = HEAD = bb7c5ab` · **ahead 0** · 工作区干净（本笔之前）
- **正典（本笔新增/追加）**：`docs/seafood.master-plan.md` **§5.432** + 版本行 **v0.349** · `docs/design/design-system.spec.md` **§26.11.8**（追加，不升版）· `docs/OPEN-ITEMS.md` **`B42` / `B43`** 状态改写（关闭）

## 1. Kevin 逐字与对位

> 「1、可以 2、暂时不改 3、暂时不改」

| # | 三问 | 裁定 | 结论 |
|---|---|---|---|
| ① | 标题 **14px**（实卡内宽 207 / 修后 209.33 下装 24 汉字 + `...`） | **可以** | **保留 14px** —— 升为已确认字号，非临时取舍 |
| ② | 卡高 **392** vs 保 **412**（保 412 需图 240 → **260**） | **暂时不改** | **保持 392 + 图 240**；412 / 260 路线**关闭** |
| ③ | 稀有度**彩色环**（`legendary` 黄 / `epic` 紫，F1 后浅灰 `outline`） | **暂时不改** | **不加回**；统一浅灰 `#e5e7eb` inset outline 定稿 |

## 2. 三条现状确认（现取 · HEAD `bb7c5ab`）

| # | 文件:行 | 现值 | 与裁定 |
|---|---|---|---|
| ① | `frontend/src/components/reward/reward-card.css:126-127` | `font-size: 14px` · `line-height: 24px`（2×24 = 48 = 盒高） | 一致 |
| ② | 同文件 `:68` / `:91-92` | `height: 392px` · 图 `flex: 0 0 240px` + `height: 240px` | 一致 |
| ③ | 同文件 `:83-84` · `RewardCard.jsx:84-85` | 统一 `outline: 1px solid #e5e7eb` + `outline-offset: -1px`；`border-yellow-400` / `border-purple-400` 类在但无承载体；**无按类 `outline-color` 分支** | 一致 |

- **② 生产补证（夜档）**：`ops/card-rows/prod-verify/prod-probe-dark.json`（提交 `bb7c5ab`）= 生产 `data-theme=dark` × 1440 / 1536 × 7 卡：卡高 **392 ×7** · 图 **240 ×7** · 行高 **48/32/24/48 ×7** · `pageerrors` / `consoleErrors` **0** ⇒ 与日档并读，日/夜 × 两档恒 392。
- **① 判负口径不变**：只盯盒高 48 + 48 显示宽单位 + 字面 `...`，不以字号判负。

## 3. 影响 = 零代码改动

三条裁定全部是**对现状的确认** ⇒ 常量 / CSS / 渲染**一处不动**。

| 面 | 现值 | 本笔 |
|---|---|---|
| `schema_version` | `0052` | 不动 |
| 注册点 | **110**（get 49 / post 57 / put 0 / delete 3 / patch 1） | 不动 |
| i18n 四语 | top **129** / flat **1115** / nodes **4460** | 不动 |
| 探针判据集 | design §26.11.7 第 8 条两条实现约束 | 不动 |

## 4. 挂账收口

| 项 | 处置 |
|---|---|
| `B42`（392 vs 412） | 紧随原行追加「✅ 已裁（Kevin 2026-10-19）：保持现状（392 + 图 240）⇒ 本项关闭」；原行逐字保留 |
| `B43`（稀有度彩环） | 紧随原行追加「✅ 已裁（Kevin 2026-10-19）：保持现状（不加彩环）⇒ 本项关闭」；原行逐字保留 |
| `B40`（死键清理） | **不变**（`rewardCard.timeLimited` 仍为死键候选，届时同批复核） |

## 5. 本笔边界

- **纯追加 / 前插**：`git diff --numstat` 删除列 = **0**（倒序前插 + 纯追加）。
- **旧字面保留**：§5.430 / §5.431 C / design §26.11.4 #5 / §26.11.7 第 5 条的「待定 / 待 Kevin」句一字未删，只在 §5.432 与 §26.11.8 声明「**以本段为准**」。
- **`commit` 只 add 四件、不 push**；未启停服务、未碰真库、未跑迁移。
