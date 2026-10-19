# SPEC-NOTE · closure —— 数字商品拆分批次上线收口（`item-type/delivery` · §5.438 / design §26.12.8）

- **单号**：`JING-SPEC-ITEM-TYPE-DELIVERY-CLOSURE`（Jing · 制度员）
- **性质**：**收口登记**（只写 `docs/**` + 本文件）。**零代码 / 零迁移改动 / 零测试改动 / 零 HTTP 实测 / 零库写**；全部读数**现取自仓内已入库证据件**（`ops/item-type/delivery/prod-verify/**`、`ops/item-type/delivery/qa/**`、`git`），**不新造读数、不预填未测项**；**纯追加、删行 0**；`commit` 只 add 本单四件，**不 push**（由 Zang 统一推）。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = c972603`、**`origin/main = c972603`**（`git rev-list --count origin/main..HEAD` = **0**）⇒ 本批**已全部推送**，本笔落册后 **ahead 1**。
- **正典（本单只登记，不改契约）**：`docs/seafood.master-plan.md` **§5.438 + 版本行 v0.355** · `docs/design/design-system.spec.md` **§26.12.8 末追加「实测锁值」行**（不升版）· 前序契约 = §5.437 / v0.354 / data **§40.8.1** / route **§49.11.1** / `ops/item-type/delivery/SPEC-NOTE.md`。

## 1. 已上线事实（逐条带出处）

| 项 | 值 | 出处（现取） |
|---|---|---|
| push 面 | **`02b97fe..c972603`（六笔）**：`f5cdc26` 规范 → `df14c53` 后端 → `2688187` 前端 → `9bcf4be` 生产终验 → `2d119ad` 质检 → `c972603` 补门读数 | `git log --oneline 02b97fe..HEAD`；`git rev-list --count origin/main..HEAD` = 0 |
| 规范 | `f5cdc26`：data §40.8.1 / route §49.11.1 / design §26.12.8 / master §5.437 + v0.354 / 本目录 `SPEC-NOTE.md` | commit |
| 后端 | `df14c53`：`0054_item_type_delivery_split.sql`（只换 CHECK 集 · 零 DML · `DO $$` 四自检）+ `ITEM_TYPES` 四值 + s53 门同步 + `Digital`⇒400；该笔 `preflight PENDING=[0054]`、**未 apply 未 push** | commit + commit message |
| 前端 | `2688187`：级联三控件（`item-select-type` / `item-select-deliver` / `item-select-ship`）+ 卡面双标签 `.sf-reward-auto-tag` + i18n **+2 键** + 13 处计数断言前推 | commit |
| 生产终验 | `9bcf4be`：`prod-verify/` 3 件只读取证（**不改发布产物**） | `git show --stat` |
| 质检 | `2d119ad`：`qa/` 14 件（脚本 · `verdict.json` · `REPORT.md` · `logs` · `readings`）· **PASS 7/7** | `qa/verdict.json` `verdict = "PASS"`、`red = []` |
| 补门读数 | `c972603`：s53/s54 **污染首跑 + 干净复跑**各两笔 JSON | `git show --stat c972603` |
| schema | 两库 `schema_version = 0054`、`schema_migration` **53 行**、`listing` 列数 **14** | `qa/verdict.json` `batch.prod_schema` / AC6 |
| 约束 def | `CHECK (((item_type IS NULL) OR (item_type = ANY (ARRAY['DigitalAutoDeliver'::text, 'DigitalManualDeliver'::text, 'PhysicalFreeShip'::text, 'PhysicalBuyerShip'::text]))))` | `qa/verdict.json` `batch.constraint` |
| 生产存量 | `listing` **7 行**、`item_type` **全 `NULL`**（未分类） | `prod-verify/SUMMARY.txt` |
| 契约面 | feed **48** / 详情 **47** / 注册点 **110**（get 49 · post 57 · put 0 · delete 3 · patch 1）/ i18n top **130** · flat **1122** · 四语节点 **4488** / 行 **48** / 卡 **392** / 图 **240** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` = 110；`src/locales/*.json` 逐文件 top 130 / flat 1122（四语相等） |

## 2. 门套读数（AC5 · 现取 `qa/verdict.json` `acs[AC5].readings`）

| 门 | 读数 |
|---|---|
| `build` | `exit 0`，2.00s，`index-D1DS-jMh.js` / `index-D6DXS34q.css` |
| `test:unit` | **63 文件 / 634 例**（0 failed） |
| backend `tsc --noEmit` | **`exit 0`** |
| `p7b-03` 离线门 | **37/37**（0 red）· `registration_points=110` |
| `s54` item-type-delivery 门 | **45/45** |
| `s53` item-type 门 | **50/50** |

## 3. 双标签实测锁值（design §26.12.8 末行 · `prod-verify/prod-probe.json` × 三档）

| 面 | 黄标（`PhysicalFreeShip`） | 绿标（`DigitalAutoDeliver`） |
|---|---|---|
| 文案键 | `item.freeShipping`【包邮】 | `itemType.autoDeliver`【自动发货】（**一键两用**） |
| 底色（实测） | `rgb(255, 230, 15)` = `#FFE60F` = `var(--sf-btna-bg)` | **`rgb(74, 222, 128)`** = `#4ADE80` = `--sf-reward-tag-auto-bg`（`reward-card.css:28`） |
| 字色（实测） | `rgb(32, 32, 32)` | **`rgb(32, 32, 32)`**（同黑） |
| 类名 | `.sf-reward-ship-tag` | `.sf-reward-auto-tag`（`reward-card.css:172-185`） |
| 位置 | `.row1-wrap-title` **首子元素**（`first = true`） | 同（`first = true`） |
| 几何 | 12px / 700 / 16px 盒 / 2px / `0 4px` / 右距 4px / `baseline` | **逐项相同** |
| 档位 | 1536 日 / 1536 夜 / 390 日 **三档同值** | 同 |
| 行高 · 卡高 | 48 / 392 | 48 / 392 |

**无标三臂**：`DigitalManualDeliver` / `PhysicalBuyerShip` / `NULL` ⇒ 均无标签（三档一致），`overflow = 0`、`pageerrors`/`consoleErrors` 各 **0**。

## 4. 生产读数与同版 sha256（`prod-verify/SUMMARY.txt` / `prod-probe.json`）

| 项 | 值 |
|---|---|
| js | `9d9cacc2838fa3f3` · `index-D1DS-jMh.js` · **501,300 B**（= 本地 `HEAD` 构建逐字） |
| css | `4174c4a91b8a87f8` · `index-D6DXS34q.css` · **127,272 B**（含 `sf-reward-auto-tag` 与 `4ade80`） |
| 矩阵 | 5 卡夹具（四类型 + `NULL`）× 3 档 ⇒ `cards 5` / `yellow 1` / `green 1` / 无标 3 |
| 取证方式 | `context.route` **注入夹具**（**不往生产库造测试商品**）；夹具**未落库** |
| 非阻塞待办 | 生产无已分类商品 ⇒ 真卖家首件 `DigitalAutoDeliver` / `PhysicalFreeShip` 自然落库后**补一次自然流量复验** |

## 5. 质检 7 AC 摘要（`2d119ad` · `qa/verdict.json` · **PASS 7/7 · `red = []`**）

| AC | 关键读数 |
|---|---|
| AC1 写口（**14 臂** · 真钱包） | 四值各 **200 且库内逐字一致**；**裸 `Digital` ⇒ 400**（`LEDGER_AMOUNT_INVALID` / `NOT_IN_CLOSED_SET` / `allowed` 四值、**零行写入**）；`''` / `'   '` / `'digital'` / `'physicalfreeship'` / `'AutoDeliver'` **全 400**；缺省与显式 `null` ⇒ `NULL`；`PATCH` 带 `item_type` ⇒ 库值不变（纯 `item_type` ⇒ 400；带 `to_status` ⇒ 200 且按预期） |
| AC2 读口 | feed **48** / 详情 **47**；**15 行逐行对拍 mismatch = 0**；键差集仅 `wants`；详情抽检 6 行全等 |
| AC3 E2E（1536 真页） | **15 卡**：黄 1 / 绿 1，两枚均**首子元素**、几何逐条相同仅差底色；另两臂无标签；行 48 / 卡 392；`pageerror` 0 |
| AC4 发布页 | 三闸（`A_no_type` / `B_digital_no_deliver` / `C_physical_no_ship`）**各 `api_count = 0`** + `data-sf-miss` / `aria-invalid` / 组高亮 + 提示；互斥在场与切换清空成立；四组合真提交 **200 × 4**（`id 103–106`） |
| AC5 门套 | 见 §2 |
| AC6 回归 | `/api/currencies` **2 行** · `/api/media/999` **404** · 390×844 `overflow_x = 0` / 底栏 5 格 / 零 error · 存量 **26 行** 全 `NULL` |
| AC7 回收 | `listing` **26 → 40 → 26**；删自建 **20 件**（93–106 + 首跑中断 87–92）；`listing_order` / `conversation` / `message` / `ledger_entry` / `listing_favorite` / `listing_review_log` **前后 0 差**；`content_translation` **414 → 354**；触发器 `O→D→O` 复原、残留 **0 行** |

**首跑中断（披露）**：写口探针首跑遇 Neon HTTP `ECONNRESET` 中断一次，已加指数退避重试；中断留下的 6 行夹具（87–92）单独回收并留证。

## 6. 待查项结案：「390 档 19 卡 vs 桌面 15 卡」= **无 draft 泄漏**

| 判据 | 现取（`qa/feed-vs-status.cjs`） |
|---|---|
| dev `listing` 26 行构成 | **listed 9 / draft 15 / delisted 2** |
| `/api/prize/all` 分页取全 | **9 张** |
| 泄漏集 | **`LEAKED = []`** |
| 缺失集 | **`listedMissing = []`** |

**结论**：feed **恰 = listed 9**，既无 draft 混入、也无 listed 缺失 ⇒ **无泄漏**；19 vs 15 的差**成因 = 质检中途自建商品（后转 `listed`）造成的时序差**，**非 `item_type` 缺陷**。质检期 feed **15** 行与回收后 **9** 行的差同理（= 自建 6 件 listed 夹具），属**夹具口径**、不是产品回归。

## 7. 门套污染教训（★ 立规 · 本批唯一的制度性产出）

- **现象**：s53 / s54 **首跑各 2 红**（s53 `P3` / `Q4`；s54 `P3` / `D4`）；**回收后复跑 50/50 与 45/45 全绿**。两轮读数入库留档（`c972603` 四笔 JSON）。
- **归因**：质检自建夹具把库面变成 `listing 40 行` / `item_type` **非空 12 行** ⇒ ①「存量面」断言（期望存量全 `NULL`）被自家夹具顶红；②「退回 `0053` 三值」负控臂被自家夹具顶红。⇒ **不是产品缺陷、不是迁移缺陷** —— 门读到了测试自己写的数据。
- **规则（写死）**：**涉及「存量面 / 负控臂」的门，必须在库面干净时跑**（基线 = `listing` 回基线行数且 `item_type` 全 `NULL`）。顺序二选一：**(a) 先跑门套、后造夹具**；**(b) 先造夹具、回收后复跑门套**。**两轮读数都留**（污染首跑 + 干净复跑）；**污染红不得计为产品红，也不得只留干净那轮**（只留后者 = 掩盖门的环境敏感性）。

## 8. 挂账判定（本笔**不新增** `OPEN-ITEMS` 条目）

- **§7 的教训 = 已闭环的作业规则**，不是「未闭环项」⇒ 不入 `docs/OPEN-ITEMS.md`（该台账只登未闭环项），已写入 master **§5.438 G** 与本文件 §7。
- **`docs/OPEN-ITEMS.md` 本笔改动 = 0 行**；既有 **`B44`**（发布页未新增 `item.typeRequired` 专人文案键，现复用 `uiError.badRequest` + 组高亮）**仍开、字面未改**。
- 其余可选方向（按类型筛选/排序、改类写口）**本笔不登记**（承 §5.436 F 的「另立单」口径，需 Kevin 口径才立）。

## 9. 本笔四件与纪律

| # | 文件 | 动作 |
|---|---|---|
| 1 | `docs/seafood.master-plan.md` | 前插 **§5.438**（A–G）＋ 版本表前插 **v0.355**（倒序、`v0.354` 之上） |
| 2 | `docs/design/design-system.spec.md` | **§26.12.8 末追加一行**「实测锁值」（不升版、不改头注） |
| 3 | `docs/OPEN-ITEMS.md` | **不改**（判定见 §8） |
| 4 | `ops/item-type/delivery/SPEC-NOTE-closure.md` | 本文件（新建） |

- 纪律：**纯追加、删行 0**（`git diff --numstat` 删除列全 0）；提交前 `git reset -q` 清索引、只 add 上述路径、`git commit` 不带 pathspec；**不 push**、**不改代码 / 不改迁移 / 不 apply / 不写库**。
