# route-layer.spec v2.27 delta（JING-SPEC-UI-A · 2026-10-11）

> **性质**：只追加单（`git diff --numstat docs/route-layer.spec.md` ⇒ **删除列 = 0**）。**零代码 · 零迁移 · 库面只读 · 零 HTTP · 零套件**。姊妹册 = `docs/design/design-system.spec.md` v1.5 §14。

## D0 元信息（开工 / 完工现取）

- **开工版本 = v2.26**：`cmp docs/route-layer.spec.md docs/versions/route-layer.spec.v2.26.md` = **0**；行 `7854` / 字节 `1,536,180` / md5 `ec7df08915d10ae22a647d9affdc238a`。
- **完工版本 = v2.27**：行 `7893` / 字节 `1,542,496` / md5 `5b6f797c8301de39cf7a0c8da1bd6b8d`；末行 `---` **仍不带换行符**（`tail -c 8` = `e380 820a 0a2d 2d2d`）。
- `git diff --numstat`：**`39  0`**（新增 39 行 / 删除 0 行）。
- 快照：`docs/versions/route-layer.spec.v2.26.md`（改前，`cmp=0`，**未动**）+ `docs/versions/route-layer.spec.v2.27.md`（**本单新建**，`cmp` 与现行 = 0）。

## D1 逐条 delta（输入 → 落点）

| # | 输入（依据锚点） | 改动点 |
|--:|---|---|
| ① | Kevin 2026-10-11 定档 ③「消息模块后续接驳 X 私信，本轮占位留空」 | **§37.1 #1**（`/messages` 新占位页登记） |
| ② | Kevin 连锁更正 (A)（Zang 转达）「底栏第二项 = 市场 → `/exchange`」 | **§37.1 #3**（`/exchange` 复用登记） |
| ③ | Kevin 定档（姊妹册 `T80`）「卖闲置 → `/listing/new` 复用既有发布页」 | **§37.1 #2** |
| ④ | ★ 留痕「原写 附近/`/nearby`」 | **§37.2**（不登记 `/nearby`） |
| ⑤ | 后端现取 = 89；前端 `<Route>` 现取 = 35 | **§37.3** |

## D2 承载位置（四处 · 均插/追加，零删除）

- 顶部 v2.27 状态块：**插在 §36 状态块之后**（锚 = 「（**未跑前端套件 · 未改代码 · 未 commit/push**）。」）。
- **§37（新）**：**插在本册末行 `---` 之前**（承 §36.4 追加手法）。
- 快照 v2.27 + 本 delta 件 + 台账 F″（`docs/OPEN-ITEMS.md`）。

## D3 纪律自检

① 只追加 / 删除列 = 0 ✅｜② 零代码 / 零迁移 / 库面只读 / 零 HTTP / 零套件 ✅｜③ 未发明项 ✅｜④ 未 `git add -A` / 未 commit / 未 push · 未启停 5787/5788 ✅｜⑤ 引用现取且逐字 ✅。
