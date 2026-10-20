# SPEC-NOTE · 发布列表行内动作（【降价】/【编辑】）

- **日期**：2026-10-20 · **作者**：Jing（制度员）· **编制起点**：`HEAD = 6f88cce`（= `origin/main`、工作区干净）
- **本笔范围**：**纯规范落册**（只写 `docs/**` + `ops/published-actions/**`）⇒ **零代码 / 零迁移 / 零测试改动 / 零 HTTP 实测 / 零库写 / 不 push**
- **契约面**：`docs/route-layer.spec.md` **§49.12** · `docs/design/design-system.spec.md` **§26.13** · `docs/seafood.master-plan.md` **§5.439 + 版本行 v0.356**

---

## 1. Kevin 定档（口径来源）

| # | 定档 |
|---|---|
| 1 | `/profile/trades/published` 行内加 **【降价】【编辑】** 两个动作 |
| 2 | 【编辑】⇒ 独立页 **`/item/:id/edit`**，**复用发布页表单并预填**，可改 **标题 / 描述 / 价格 / 库存 / 图片 / 分类（`item_type` 级联）**；保存后回该商品详情或发布列表 |
| 3 | 【降价】⇒ **行内弹窗**输入新价，**必须低于当前价**（原话 ≥0.01）；改完**当场刷新该行价格**（不跳页） |
| 4 | 按钮可见性：**仅 `draft` 与 `listed`**；`sold` / `delisted` **只读、无按钮** |

> 原始会话**未入仓**；以上为派单逐字转引。与 Kevin 原话若有出入，**以 Kevin 一句话为准**。

## 2. 后端形态（零新路由）= 一条 `PATCH` 双模式

| body | 模式 | 期望 |
|---|---|---|
| 含任一 `title` / `description` / `price` / `stock` / `media_urls` / `item_type` | 字段模式（更新路径） | **200** |
| 含 `to_status` / `status` | 状态模式（迁移路径，语义不变） | **200** |
| **两者同现** | — | **400** `LEDGER_AMOUNT_INVALID` `{field:'listing.request', reason:'BOTH_MODES'}` |
| **两者皆无** | — | **400** `LEDGER_AMOUNT_INVALID` `{field:'listing', reason:'NO_EDITABLE_FIELD'}` |

- **零新 API 路由**：注册点仍 **110**（get **49** / post **57** / put 0 / delete 3 / patch 1）· `p7b-03` 的 `registration_points` 仍 **110**
- **零新错误码**：全借既有码（矩阵 = route §49.12.5；`ledger-errors.ts` 33 码闭集不动）
- **零迁移**：`schema_version` 仍 **0054**
- **改价不写账本**：`ledger_entry` / `ledger_post_event` / `account` 全不动（判负 route #3）
- **翻译**：`title` / `description` **实际变化**才重置回 `pending`（改价/改库存**不得**触发 reset）

## 3. 读口加性键

`GET /api/listing/mine` 行键 **8 → 10**：新增 **`description`** / **`item_type`**（原样下发、不翻译、可为 `null`）。
**不变**：全状态行（`draft`/`sold`/`delisted` 全出，可见性由前端按 `status` 判）· `listing_id DESC` · `LIMIT/OFFSET` · `data` 为数组。

## 4. 前端形态（design §26.13）

- **行结构**：`整行 <Link>` ⇒ **链接区（`<a>`）+ 动作区（两按钮）**；`data-sf-m="trades-published-item"` **留在行容器**（存量断言只允许「从 Link 改到容器」这一层改锚）；**动作区不得嵌在 `<a>` 内**。
- **按钮**：沿用既有**次按钮 token**（`--sf-btnalt-bg/fg/border`）· **零新 token** · 不得出现第三色值 · `≤767` 触达 **≥44px**（承 `T77`，包在既有 767 块内）。
- **降价弹窗**（行内弹层 / modal 二选一）：现价只读 + 数字输入 + 确认/取消；**提交闸 = 整数且 `1 ≤ 新价 < 现价`**（**等值/加价不可提交**）；非法 ⇒ **置灰 + 内联提示**（缺一即判负）；成功 ⇒ **行内价格即时更新**（不跳页、不整表重取）；失败 ⇒ 弹层不关、错误落弹层内；**弹层只改价**。
- **编辑页**：与发布页**同源**表单（禁另写一套）；预填 **6 项不漏**（含 `item_type` 级联反推、`NULL` **禁猜补**）；保存**单次 `PATCH`**；`sold`/`delisted` 直达 ⇒ 只读提示 + 回列表。

## 5. 判负（质检必带 · 两册并存只增不改）

- **route §49.12.8 #1–#13**：双模式同现非 400 `BOTH_MODES` · 皆无非 400 `NO_EDITABLE_FIELD` · 改价写账本 · 改价未落地 · 非卖家非 403 · 改分类被静默丢（`updateListingRow` 未接 `item_type`）· 两写口校验不一致 · 改价/改库存误重置翻译 · 互斥闸位置留双写痕迹 · `BOTH_MODES` 回显字段值 · `mine` 键 ≠ 10 · `registration_points ≠ 110` · 编辑页保存发两次写请求。
- **design §26.13.7 #25–#35**：`sold`/`delisted` 出按钮 · 弹窗允许**等值或加价** · 非整数/≤0 可提交 · **保存后行内价格不刷新** · 编辑页预填漏字段 · `item_type` 级联未反推或猜补 · 点按钮触发整行跳转 · 钩子改名/错层 · 新 token 或第三色值 · 表单不同源或双写 · 只读行渲染可提交表单 / 弹层混装其它字段。

## 6. 现取读数（2026-10-20）

| 项 | 现值 | 锚点 |
|---|---|---|
| 注册点 | **110**（get 49 / post 57 / put 0 / delete 3 / patch 1） | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` |
| `PATCH` 现值 | **只读状态**（`to_status ?? status`） | `backend-ts/src/index.ts:2769-2780` |
| `mine` SELECT | **8 列** | `backend-ts/src/database.ts:2796-2804`（映射 `:1601`） |
| `updateListing` 字段 | **5 项**（无 `item_type`） | `backend-ts/src/listing-service.ts:273-283` |
| `updateListingRow` 入参 | **5 项**（无 `itemType`；`:3601` 注释：`item_type` 唯一写点 = `createListingRow`） | `backend-ts/src/database.ts:3642-3650` |
| 借码 | shape ⇒ 400 `LEDGER_AMOUNT_INVALID` / state ⇒ 409 `LEDGER_CURRENCY_INVALID_TRANSITION` | `listing-service.ts:55-56` 与 `:61-62` |
| 发布页表单钩子 | `item-form` · `item-input-title` · `item-input-price` · `item-input-stock` · `item-select-type` · `item-select-deliver` · `item-select-ship` · `item-input-note` · `item-images` | `frontend/src/pages/item/PublishItemPage.jsx` |
| 页面路由 | `item/new` · `item/:itemId` ⇒ 新增 `item/:itemId/edit`（**不计入注册点**） | `frontend/src/App.jsx:107-108` |
| 文案 | `common.edit` = 「编辑」（复用）；【降价】建议新增 `item.lowerPrice`（**键名不冻结**） | `frontend/src/locales/zh.json` |

## 7. 待裁 / 实现面必改点（不掩盖）

1. **`draft` 改库存（待裁 1 条）**：Kevin 口径 = 编辑页可改库存；现取服务层 `stock_requires_listed` ⇒ `draft` 改库存 **409**。本册倾向 **(a)** 放宽为 `status ∈ {draft, listed}`、**不冻结**；取 **(b)**（UI 在 `draft` 禁用库存输入）须**同版续登**。
2. **差额 D-1（承重）**：`updateListingRow` 现**不写 `item_type`** ⇒ 只改 `index.ts` 会**静默丢字段**；须同改 SQL + 解析层。
3. **差额 D-2**：`enqueueListingTranslation(view, true)` 现**无条件** reset ⇒ 须改「仅实际变化才 reset」。
4. **差额 D-3**：状态模式空 body 现为 400 `NOT_A_STRING` ⇒ 统一为 `NO_EDITABLE_FIELD`。
5. **最小价口径差**：Kevin 原话「≥0.01」，而 `listing.price` 现为**整数 bigint**（`cid=1` `decimals=0`）⇒ 本册读作「整数且 `1 ≤ 新价 < 现价`」；真要 `0.01` = 改列类型 + 小数计价 = **另立单**。
6. **取代关系（旧文留痕）**：route §49.11.1 ② 的「`PATCH` 不接受 `item_type`」由本批**取代为「`PATCH` 接受、`POST` 编辑口仍忽略」**。

## 8. 未做（明账）

- 双模式派发 / `item_type` 写入 / `mine` 两加性键 / 编辑页 `/item/:id/edit` / 降价弹层 —— **全部未实现**，零 HTTP 实测、零库写。
- route 13 条 + design 11 条判负**一条未跑**；行高、按钮实高、i18n 计数（top / flat / nodes）**均未取**（`NOT_MEASURED`，本册不预填）。

## 9. 本笔性质（可机械复核）

- `git diff --numstat` **删除列 = 0**（两册**文末纯追加** + 本册**倒序前插** + 版本表**前插**）。
- `commit` **只 add 四件**：`docs/route-layer.spec.md` · `docs/design/design-system.spec.md` · `docs/seafood.master-plan.md` · 本文件。**不 push**。

## 10. 并行实现披露（未提交 · 本册不背书）

- 编制期间工作区出现**他人未提交**改动 `backend-ts/src/{database.ts,index.ts,listing-service.ts}`（`git diff --stat` = **370 insertions / 4 deletions**，**未提交、未入库**）。
- 本册读数**一律以 `HEAD 6f88cce` 为准**；该未提交面**不背书、不计入**，本笔 `commit` **不 add 该三文件**（`git reset -q` 后只 add 四件）。
- 可见差异一处（**不冲突、记为加性**）：落盘 `NO_EDITABLE_FIELD` 的 `details` 额外带 `editable_fields` 数组 —— 本册**未冻结该键** ⇒ **不判负**；`BOTH_MODES` 面仍**禁回显字段值**。
