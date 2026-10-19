# 商品分类枚举 · 后端（迁移 0053 + 写口 + 读口）· 交付读数

- 仓：`/Users/kevin/bistro/seafood`（`backend-ts`）
- 范围：**仅后端**（迁移 + 写口 + 读口）。前端（发布页选择器 / 卡片标签）**另单**；规范归 Jing。
- 迁移**不由本单 apply**（Zang apply）；本单只出文件 + preflight + 干跑零残留读数。

## 1 冻结口径落地

| 项 | 口径 | 落地 |
|---|---|---|
| 枚举 | `Digital` / `PhysicalFreeShip` / `PhysicalBuyerShip` | 迁移 CHECK + 服务层 `ITEM_TYPES`（逐字一致，`B5` 判据比对） |
| 迁移 | `0053_listing_item_type.sql`（现取最大 0052 ⇒ 0053） | 新文件；**未改** 0050-0052（`A7` git 工作树判据） |
| 存量 | 保持 NULL（= 未分类，不回填） | 列可空、无 `DEFAULT`、无 `UPDATE`（`A6`）；`P3` 非空行数 = 0 |
| 写口 | `POST /api/listing` 可选 `item_type`；非法 ⇒ 400 | `index.ts` 透传 `body.item_type`；服务层 `normalizeItemType`（闸在 `currencyGate` 之前 ⇒ 非法值零 DB 调用，`U7`） |
| 编辑/状态迁移 | **不改类型** | `updateListingRow` SQL 无 `item_type`（`B3`）；`PATCH` 只收 `to_status`（`B4`） |
| 读口 | feed 行键 **47→48**、详情顶层 **46→47** | `normalizeBrand` 单点加 `item_type`（`R1`/`R3` 实读 48 / 47） |
| 路由 | **零新路由，注册点仍 110** | `p7b-03` AC10-2 `registration_points=110`（37/37 全绿） |

## 2 关键设计选择（含自曝）

1. **`item_type` 不进 createListing 幂等指纹**（`B6` 判据：`fingerprintOf` 仍 6 字段 `seller_uid,cid,price,title,description,media_urls`）。
   - 理由：指纹字段集是**创建幂等**的冻结口径（仓库面无指纹列，靠可重构不变子集），扩列会改宽「同键重放」的判定面 = 动既有语义，超出本单。
   - 后果（披露）：同 `create_key` 重投而 `item_type` 不同 ⇒ 落 `replay`（200），返回行带的是**库内**值 + `idempotent_replay: true`（`U8` 实测）；分类创建后不可变、不回写，故无静默写错。若要 409 判负须另单同批改 `fingerprintOf` 与其比对数组。
2. **约束幂等写法**：`DO` 块内先查 `pg_constraint`（`conname` + `conrelid='public.listing'::regclass`）再 `ADD CONSTRAINT`（PG 无 `ADD CONSTRAINT IF NOT EXISTS`；`A3`）。
3. **读口键恒在场**：`item_type` 不按「行是否带该列」选择性省略，恒发 `string | null`。好处 = 迁移 apply 前后前端形状不变（未迁移时值 `null`，前端不显示标签）；实测在**列尚不存在**的 dev 库上 feed 已是 48 键、值全 `null`（`R2` + `P2` 交叉印证）。
4. **不加 PG enum 类型**：闭集只由 CHECK 表达 —— 后续扩值改 CHECK 一次性，且本文件重跑安全（`Q1` 二次执行零报错）。

## 3 读数（证据）

| # | 判据 | 结果 |
|---|---|---|
| 1 | `backend-ts npx tsc --noEmit` | **exit 0**（零错） |
| 2 | `p7b-03-offline-gates` | **37/37 全绿**，`registration_points=110` |
| 3 | `s53-00-item-type-gate` | **44/44 全绿**（迁移面 A0-A7 · 写口面 B1-B6 · 单测 U1-U9 · 读口 R1-R4 · preflight P1-P3 · 干跑 Q1-Q4） |
| 4 | 迁移 preflight | `state=PRE_APPLY` · `max_applied=0052` · `PENDING=[0053]` · 列/约束**尚不存在** · 非空行 0 |
| 5 | 迁移干跑（`inRollbackTx`） | 首跑 + 重跑均 ok；列 `text`/`nullable=YES`；约束 `CHECK (((item_type IS NULL) OR (item_type = ANY (ARRAY['Digital','PhysicalFreeShip','PhysicalBuyerShip']))))`；三值 UPDATE 通过、`Bogus` ⇒ **23514**；**ROLLBACK 零残留**（`migrate --status` 复读仍 51 行、最大 0052） |
| 6 | 读口实读（dev，列未迁移） | `/api/prize/all` 源 `listBrands`：9 行，行键**恰 48**、每行 `item_type` 在场且全 `null`；详情 `getPrizeById` 归一器 **46** 键 + 路由层 `{ ...prize, seller }` ⇒ **47** 键（`item_type` 同键同值） |
| 7 | 单测桩（零真写） | 三值各写入一次（`U5`：写入口收到原值、view 回读同值）；未传 ⇒ `null`（`U6`）；`Digital2` / `physicalfreeship` / ` physical` ⇒ 400 `LEDGER_AMOUNT_INVALID` + `reason=NOT_IN_CLOSED_SET` + `allowed` 闭集、DB 调用 **0**（`U7`）；重放臂 `U8` |

读数文件：`ops/item-type/readings/s53-item-type-gate-<RUN>.json`（run-tagged，含全部 check + live + preflight + dry_run）。

## 4 改动清单

| 文件 | 改动 |
|---|---|
| `backend-ts/migrations/0053_listing_item_type.sql` | **新增**：`ADD COLUMN IF NOT EXISTS item_type text` + `DO` 幂等 `listing_item_type_check`（三值 + 允许 NULL）+ 尾部 7 项自检 |
| `backend-ts/src/database.ts` | `BrandRecord.item_type`；`normalizeBrand` 加 `item_type` 键；`createListingRow` 增 `itemType`（existing/INSERT/RETURNING/两臂 SELECT 共 5 处） |
| `backend-ts/src/listing-service.ts` | `ITEM_TYPES` / `normalizeItemType`；`createListing` 收 `itemType` 并落库（指纹不动，注释披露） |
| `backend-ts/src/index.ts` | `POST /api/listing` 透传 `body.item_type`（**零新路由**） |
| `backend-ts/scripts/s53-00-item-type-gate.ts` | **新增**门脚本（纯文本 + 纯函数 + 只读 SELECT + rollbackTx 干跑） |
| `ops/item-type/` | 本报告 + `readings/` |

## 5 待办 / 边界

- **部署顺序（硬）**：**先 apply `0053`，再上本单代码**。读口向后兼容（`l.*` + `item_type` 恒发，列缺 ⇒ `null`），
  但写口 `createListingRow` 的 INSERT **显式列名**含 `item_type` ⇒ 迁移未 apply 时创建商品会 `42703 column does not exist`。
  与 `0052` 同族的「迁移先行」纪律（历史 commit `133ed34` 前先 push 迁移）。
- **迁移由 Zang apply**：apply 后建议复跑 `npx ts-node --transpile-only scripts/s53-00-item-type-gate.ts` ⇒ `P` 段自动翻转为 `APPLIED` 并校验列 + 约束 + 存量 NULL。
- 前端（发布页选择器、卡片标签）与规范册登记**不在本单**。
- 分类**不可变**：若产品后续要「改分类」，需另立单（`POST /api/listing/:id` 或 `PATCH` 扩字段 + 状态闸）。
- `docs/*` 四处改动为**他人（规范线）工作树未提交内容**，本单未触碰、未纳入 commit。
