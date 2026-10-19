# REPORT · 招工页币种提示四语对齐（zh 去「悬赏」限定）

代码 + 门套读数 + 本件同一 commit 入库（不 push）。仓：`/Users/kevin/bistro/seafood` · 基点 HEAD `9adcfcc`。

## 1. 改动表

| 文件 | 改动 |
|---|---|
| `frontend/src/locales/zh.json` | **仅 1 行**：`jobs.cidNote`「请从下拉框选择悬赏币种」→「请从下拉框选择币种」（`git diff --numstat` = `1 1`，唯一改动文件） |

**未动**：`item.cidNote`（zh 仍为「请从下拉框选择计价币种」）、`jobs.cid`、en/hk/vn 三语全部值、键集/键数、组件与 CSS。对齐后 zh/hk 语义一致（hk 本就是「請從下拉框選擇幣種。」）。

## 2. 读数（`ops/item-cid-select/readings/`）

| 项 | 读数 | 件 |
|---|---|---|
| ① 四语对照 | 改前 zh=「请从下拉框选择悬赏币种」/ en=Select the currency from the dropdown. / hk=「請從下拉框選擇幣種。」/ vn=Chọn tiền tệ từ danh sách. → 改后 zh=「请从下拉框选择币种」、其余三语逐字未动；四语拍平键数 1106×4、两两差 0、键集逐文件相同 | `align-cidnote.json` |
| ② 黑名单 | 新值命中 **0**；四语全量值面扫描命中 **0**（与 `i18n-violation-closeout.test.jsx` BLACKLIST 同口径）；`test:unit` 全绿（含该门 ①③ 例） | `align-cidnote.json` + `align-gates.log` |
| ③ 门套 | build exit 0，新产物 `index-a3tEicdR.js`（改前基线 `index-BREoUqs6.js`；CSS `index-DnoMyxQu.css` 不变，本单不涉样式）；`test:unit` **59 files / 568 tests passed，0 failed**（改前基线同 59/568，只增不减达成） | `align-gates.log` |
| ④ 浏览器探针 | 390×844 手机视口走 5800 预览入口 `/task/new`（假会话同前批配方）：页头提示（`.sf-jobs-note`）= 「请从下拉框选择币种」逐字命中；币种下拉落定 2 选项；console/page 错误 **0**；业务写 **0**（POST /api/job 截获） | `align-probe.json` |

## 3. 边界 / 披露

- 探针脚本落 scratch（`probe-align.mjs`，配方照前批 `probe-job-form.mjs`），未入仓；读数件已入仓。
- 探针走 5800 → dev 5787/5788，读数来自 dev 环境（本单为纯值改动，不涉数据面）；零库写、零业务写。
- 未改 `docs/**`、未 push。
