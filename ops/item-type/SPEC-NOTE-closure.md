# SPEC-NOTE · closure —— 商品分类批次上线收口（`item-type` · §5.436 / design §26.12.7 / `B44`）

- **单号**：`JING-SPEC-ITEM-TYPE-CLOSURE`（Jing · 制度员）
- **性质**：**收口登记**（只写 `docs/**` + 本文件）。**零代码 / 零迁移 / 零测试改动 / 零 HTTP 实测 / 零库写**；**纯追加、删行 0**；`commit` 只 add 本单四件，**不 push**（Zang 统一推）。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · `HEAD = 776ae34`（生产终验证据笔）· **收笔时点 `origin/main = 776ae34`**（该笔在本笔编制期间由 Zang 推上）· **本笔 commit 后 ahead 1**
- **正典（本单只登记，不改契约）**：`docs/seafood.master-plan.md` **§5.436 + 版本行 v0.353** · `docs/design/design-system.spec.md` **§26.12.7**（追加于 §26.12 末）· `docs/OPEN-ITEMS.md` **`B44`** · 前序契约 = `§5.435` / `v0.352` / design `§26.12` / route `§49.11` / data `§40.8` / `ops/item-type/SPEC-NOTE.md`

## 1. 已上线事实（逐条带出处）

| 项 | 值 | 出处（现取） |
|---|---|---|
| push 面 | `336ae2a..776ae34`（**五笔**：`acfaa0b` → `8f05866` → `1eecbb7` → `26576d3` → `776ae34`） | `git log --oneline 336ae2a..776ae34`；`git ls-remote origin main` = `776ae34` |
| 后端 | `acfaa0b`（迁移 `0053` + `POST /api/listing` 可选 `item_type` + 读口透出） | commit |
| 规范 | `8f05866`（data §40.8 / route §49.11 / design §26.12 / master §5.435 + v0.352） | commit |
| 前端 | `1eecbb7`（发布页 2 + 2 两控件 + `.sf-reward-ship-tag`） | commit |
| 质检 | `26576d3`（独立质检 **PASS**；13 件读数/脚本/报告，`+2,025 −0`） | `git show --stat 26576d3` |
| 生产终验 | `776ae34`（**本地证据笔、未 push**；`ops/item-type/prod-verify/`） | `git show --stat 776ae34` |
| 同版 sha256 | js `ed2ec85d4c787250` `index-DKwYoDGj.js` **499,953 B** / css `9f88507f3c3568b7` `index-DNTm1wEg.css` **126,966 B** | `prod-verify/SUMMARY.txt:4` |
| 生产读口 | feed **48 键**（`item_type` 在场、**现全 `null`**）/ 详情 **47 键** | `SUMMARY.txt:6` |
| 生产浏览器 | 1536 日/夜双档 × 注入 3 卡：**仅 `PhysicalFreeShip`** 有标签、为 `.row1-wrap-title` **首子元素**、bg `rgb(255,230,15)` / fg `rgb(32,32,32)` / `12px` / 圆角 `2px`、行 **48** / 卡 **392**、溢出 **0**、`pageerrors`·`consoleErrors` 各 **0** | `prod-verify/prod-probe.json` |

**注**：`776ae34` 是 push 之后的**只读取证笔**（3 文件 `+109 −0`，内含 `ops/item-type/prod-verify/`），**不改发布产物** —— 生产运行面仍是 `26576d3` 的构建产物，其 sha256 与本地 `HEAD` 构建**逐字相等**（`SUMMARY.txt:5`）。该笔**现已推送**（`origin/main = 776ae34`），故 push 面按**五笔**读。

## 2. 质检摘要（`26576d3` · `qa/verdict.json` · 6 AC + 回收 **全 PASS / 0 failed**）

| AC | 关键读数 |
|---|---|
| AC1 写口 12 例 | 三值各 **200 且落库逐字**；四非法（`""` / `"   "` / `"digital"` / `"Bogus"`）**全 400**（`LEDGER_AMOUNT_INVALID` / `NOT_IN_CLOSED_SET` / 零行写入）；缺省与显式 `null` ⇒ 200 + `NULL`；`PATCH` 带 `item_type` **不改值**；`PATCH` 仅 `item_type` **400**；编辑口 `POST` 带 `item_type` **忽略** |
| AC2 读口 | feed **48** / 详情 **47**（`detail_id 82`）；**DB↔API 逐行对拍 15 行 mismatch = 0**；探针时值分布 `Digital 2 / PhysicalFreeShip 1 / PhysicalBuyerShip 1 / NULL 11` |
| AC3 E2E | 1536 四臂 **15/15**；`tag_rect` 27×16；`is_first_element_of_row1 = true`；另三臂无标签且行 48 / 卡 392 |
| AC4 发布页 | A 未选分类 **0 请求** + 组高亮 + `aria-invalid`；B 实物未选运费 **0 请求** + 组高亮；数字隐藏运费、切回清空 stale；正控 **2 请求**（`POST` + `PATCH`，`listing 86`） |
| AC5 门套 | build `exit 0`（`index-DKwYoDGj.js` / `index-DNTm1wEg.css`）；`test:unit` **63 文件 / 631 例 / 0 failed**；`tsc --noEmit` `exit 0`；`p7b-03` **37/37 / registration_points 110** |
| AC6 回归 | `currencies` **2 行**（`1 $` / `399 BTTC`）；`/api/media/999` **404** `LEDGER_REF_NOT_FOUND`；`/api/prize/1` 200 零 error；390×844 首页 `scrollWidth−clientWidth = 0` |
| R 回收 | 自建 **10 件**（77–86）全删：`listing 36→26`、`content_translation 402→354`（−48 夹具翻译行），其余六表**前后同值**；`trg_listing_no_delete` 事务内 `D` → 事务后 `O`；逐 id 引用面全 0、`leftover_rows 0` |

## 3. 两处口径差裁定（本单核心交付）

### 3.1 标签 `vertical-align`：文本 `middle` vs 落盘 `baseline` ⇒ **以落盘为准**

| 面 | 字面 | 出处 |
|---|---|---|
| 文本（契约） | `vertical-align: middle` | design **§26.12.1** 表「盒」行 |
| 落盘（实现） | `vertical-align: baseline` | `frontend/src/components/reward/reward-card.css:159`（HEAD `776ae34`） |

- **裁定 = 保持 `baseline`**（不改代码、不改落盘）：16px 盒夹在 24px 行盒内 ⇒ `baseline` 与 `middle` **都不抬行**；实测 `row1-wrap-title` `offsetHeight` **48**、卡高 **392**，**日/夜双档同值**，横向溢出 0；标签与标题**同基线**贴齐、观感与参考图一致（**目视结论，非机读项**）。
- **不升判负**：`vertical-align` 的具体取值在 design **§26.12.5 读数登记项**中本就「只要求不抬行」⇒ **不作判负项**，`#15–#19` 一字不改。
- **落点**：design **§26.12.7**（追加于 §26.12 末 · 不升版）以**块引用「以本段为准」**声明 `baseline`；**§26.12.1 表内 `middle` 字面逐字保留、一字未删**（承全仓「旧字面不删、以新段为准」体例）。
- **披露**：质检已把该差登记为 `non_blocking_notes[0]`（「非判负项、非读数登记项」）—— 本单据此裁为「以落盘为准」，**未替质检加判负**。

### 3.2 空串口径已反转为 **400** ⇒ 差额**结案**

- **旧记（逐字保留）**：`ops/item-type/SPEC-NOTE.md` **§5.1 第 1 项** —— 「契约：空串 ⇒ **400** / 落盘：`normalizeItemType` 未传·`null`·**空串** ⇒ `null`」= 「**唯一实质差额 · 待 Zang/Kevin 一句话定**」。
- **现行事实（质检 AC1 实测）**：`normalizeItemType` **先 `trim` 再闭集判定** ⇒ `""` 与 `"   "` **均 `400`**（`reason=NOT_IN_CLOSED_SET` + `allowed` 三值 + **零行写入**）⇒ **与契约一致**。
- **结论 = 结案**（`verdict.json` `non_blocking_notes[1]` 逐字：「已在现盘实现中反转为 400 —— 与本次 AC1 契约一致，登记结案」）。**`SPEC-NOTE §5.1` 旧表不动**（登记时点字面），结案口径以 master **§5.436 D ②** / design **§26.12.7** 为准。

## 4. 存量 `NULL` 语义（唯一读法 · 禁猜补）

`NULL` = **未分类**，**≠ `Digital`**；迁移 `0053` **不回填**、**禁**按标题/价格/图片猜补；**生产现取：存量 `item_type` 全 `NULL` ⇒ 生产当前无已分类商品**；读侧**原样下发**（三值字面或 `null`，服务端不翻译）；前端 `NULL` 与 `Digital` **可见结果相同**（均不渲染标签）；**改类无写口**（`PATCH` / 编辑口出现 `item_type` **静默忽略**）⇒ 存量转已分类**当前无路径**。

## 5. 待办 / 边界（明账）

1. **标签验证本轮只能靠注入**（生产无已分类商品）：1536 日/夜双档 × 注入 3 卡为证；真实卖家首件 `PhysicalFreeShip` 落库后**补一次自然流量复验**（**非阻塞**）。
2. **`B44`（本单新挂账）**：发布页未新增 `item.typeRequired` 错误键 —— 现复用 `uiError.badRequest`（AC4 `inline_hint = "请求参数错误"`）+ 组高亮（`aria-invalid` + `type-group-miss`）；**专人文案另单**。
3. **按类型筛选 / 排序**（`item_type` 进 `WHERE` / `ORDER BY`）= 另立单，本轮明确不做。
4. **改类写口**（已发布行改 `item_type`）= 另立单（现无路径）。

## 6. 本笔改动清单（4 件 · 全追加）

| # | 文件 | 动作 | 位置 |
|---|---|---|---|
| 1 | `docs/seafood.master-plan.md` | **倒序前插 §5.436**（A 链路五笔 / B 生产读数与同版 sha256 / C 质检摘要 / D 两处口径差裁定 / E 存量 `NULL` 语义 / F 待办 / G 连带）＋ 版本行 **v0.353** 前插 | §5.435 之前 / 表内 v0.352 之前 |
| 2 | `docs/design/design-system.spec.md` | 文末追加 **§26.12.7**（`vertical-align: baseline` 「以本段为准」＋ 空串差额结案 ＋ 连带） | §26.12 末 |
| 3 | `docs/OPEN-ITEMS.md` | 新挂账 **`B44`**（发布页未新增 `item.typeRequired` 错误键） | `B43 ❗ 状态改写` 行之后 |
| 4 | `ops/item-type/SPEC-NOTE-closure.md` | 本文件（新） | — |

- **编号现取（编制时点）**：本节 = **§5.436**（现取最大 = `§5.435`）· 版本行 = **v0.353**（真表顶 = `v0.352`）· design 子节 = **§26.12.7**（现取末子节 = `§26.12.6`）· 挂账 = **`B44`**（现取最大 = `B43`）。零跳号、零复用。
- **自证**：`git diff --numstat` 三册**删除列 = 0**（新建件为全文新增）；`commit` **只 add 上述四件**；**未 push**；未启停服务、未连库、未跑测试、未改代码。

## 7. 披露（诚实登记）

1. **派单数字勘误**：派单转述「门套 **63/6631**」与质检读数 `Test Files 63 passed (63) / Tests 631 passed (631)` 不符 ⇒ **以读数为准 = 63 文件 / 631 例**（差一位）。已在 master §5.436 C 与版本行 v0.353 就地标注「★ 勘误（披露）」。
2. **「视觉与参考图一致」是目视结论、非机读项**：机读只认 `offsetHeight` 48 / 卡高 392 / 溢出 0；本单**不把目视写成读数**。
3. **生产终验笔「先本地、后推送」**：编制起点 `origin/main = 26576d3`、收笔时点 `origin/main = 776ae34`（该笔由 Zang 在本笔编制期间推上）⇒ 期间任何「`776ae34` 未推」的中间读数均为**时点字面**，现行 push 面 = `336ae2a..776ae34` 五笔。
4. **`B43`/`B42` 等旧行未动**：`OPEN-ITEMS` 本次只在表尾**追加** `B44` 一行，`B42`/`B43` 状态改写行逐字保留。
