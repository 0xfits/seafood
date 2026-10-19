# SPEC-NOTE-price-prod · 价格行上线 ＋ 符号字号下限修正（`card-rows`）

- **单号**：`JING-SPEC-CARD-ROWS-PRICE-PROD`（Jing · 制度员）
- **性质**：**回写补登**（只写 `docs/**` + 本文件）。**零代码、零迁移、零 HTTP、不 push**。
- **编制时点**：2026-10-19 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main`
- **现取**：`HEAD = 376a1db` · 工作区干净（本笔之前）· 工具链未跑（本笔不触碰代码）
- **正典（本笔新增/追加）**：`docs/design/design-system.spec.md` **§26.11.9.1**（追加，**不升版**）· `docs/seafood.master-plan.md` **§5.434** + 版本行 **v0.351**

## 1. 一句话

参考图的「符号 ≈ 数字 0.5」被实现成 `0.6em`（= **10.2px**），**低于「可见文本 ≥12px」硬口径**；修正为 **`12px` 绝对值**（比例 **12/17 ≈ 0.71**）⇒ 比例让位于下限。生产终验 PASS，回退负控 8 红。

## 2. 冲突与解法

| 面 | 参考图 | 落值 | 说明 |
|---|---|---|---|
| 符号 : 数字 比例 | 0.5 | **0.71**（`12 / 17`） | 下限优先；差额**接受并登记** |
| 符号 `font-size` | 相对小号 | **`12px` 绝对值** | 不取 `0.71em`：`em` 随数字联动会**再破线**（数字回 16px ⇒ 11.36px） |
| 色 / 字重 / 基线 | 同色 · 加粗 | 未变（`#FF4D00` · `700` · baseline） | 本笔只动字号 |

- **不接受的解法**：① `0.6em` 回退（= 10.2px，判负）；② 缩数字到 12px（毁价格层级）；③ 放宽 §13 / `T79`（须 Kevin 级裁定）。
- **落点**：`frontend/src/components/reward/reward-card.css` `.sf-reward-price-cur` → `font-size: 12px`（`1c5d03d`），注释写明「不得回退到 0.6em=10.2px」。

## 3. 负控自证（证据 `ops/card-rows/price-ref/fix-symbol-12px.json`）

| 层 | 动作 | 观测 | 恢复 |
|---|---|---|---|
| 探针 `probe-price-row.mjs` | CSS 临时回退 `0.6em` | **`FAIL` · red 8/108**；四相（1440/1536 × 日/夜）**只红** `cur-font-size=12px`（实测 **10.2px** ×4）+ `cur-font-size≥12px-floor`（×4）；色 / 基线 0 / 行高 24 / gap 8 / 左对齐 12 **全绿** | 已恢复（108 checks 全绿） |
| 单测 `reward-card-resize.test.jsx` | 同上 | **`1 failed / 26 passed`** | 已恢复（**27 passed**） |

⇒ 判据**有分辨力**：只对「字号跌破 12px」变红，不误伤其它读数。

## 4. 生产读数（`376a1db` PASS · 证据 `ops/card-rows/price-ref/prod-verify/`）

- **同版证明**：js `13a6b63c9ddc53da`（`index-KeEbxjcR.js` · 497,255 B）/ css `8b9440a733acac38`（`index-CheJaC-a.css` · 126,147 B）= 与本地 `HEAD` 构建**逐字相等** ⇒ 本批**只动 CSS**（js 哈希与 §5.431 同值；css 126,007 → 126,147 B，**+140 B**）。
- **1440 日档 / 1536 夜档 × 7 卡**：数字 `17px / 700 / rgb(255,77,0)` · 符号 **`12px` / `rgb(255,77,0)`** · `wants` `12px / rgb(153,153,153)` · **基线差 0** · 行 `justify-content = flex-start` · 行高 **24** · 卡高 **392 ×7** · 图 **240 ×7** · `pageerrors` / `consoleErrors` **0**。

## 5. 判负（价格行合计 5 条）

| # | 判据 | 来源 |
|---|---|---|
| ① | 数字 `color` ≠ `rgb(255,77,0)` | design §26.11.9 #10 |
| ② | 数字 `font-weight` < 700 | #11 |
| ③ | `row3-wrap-price` `offsetHeight` ≠ 24 | #12 |
| ④ | `justify-content` ∈ {`space-between`, `flex-end`} / `wants` 靠右 | #13 |
| ⑤ | **符号 `font-size` < 12px** | **#14**（本笔新增） |

- 读数登记项（不与判负同权）：`gap` 8px ±1 · 三槽基线差 ≤ 1px。

## 6. 本笔性质

只写 `docs/seafood.master-plan.md`、`docs/design/design-system.spec.md`、本文件；`git diff --numstat` **删除列 0**（纯追加；本文件为新建、全文新增）；旧字面（`0.6em` / 10.2px / 「待裁」）**逐字保留可检索**，以新段「以本段为准」。**`commit` 只 add 三件、不 push。**
