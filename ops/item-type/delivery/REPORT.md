# 数字商品拆分 · 后端 + 迁移（0054）交付件

**单**：数字商品拆分后端 —— 迁移 `0054`（`item_type` CHECK 四值、裸值 `Digital` 退役、零 `Digital` 行自检）+ `ITEM_TYPES` 闭集换四值 + 门读同步与 `Digital ⇒ 400` 负控
**落点**：`backend-ts/migrations/0054_item_type_delivery_split.sql` · `backend-ts/src/listing-service.ts` · `backend-ts/scripts/s53-00-item-type-gate.ts`（同步）· 本目录（新门 + 读数）
**不做**：push、apply（Zang）、`frontend/**`、`docs/**`

## 一、闭集（唯一真源 = 0054 的 CHECK，与 `ITEM_TYPES` 逐字含顺序）

| 值 | 语义 |
|---|---|
| `DigitalAutoDeliver` | 数字商品 · 自动发货 |
| `DigitalManualDeliver` | 数字商品 · 手动发货 |
| `PhysicalFreeShip` | 实物 · 包邮 |
| `PhysicalBuyerShip` | 实物 · 买家付运费 |

- **裸值 `Digital` 退役**：不属闭集 ⇒ 写口 400（`LEDGER_AMOUNT_INVALID` + `reason='NOT_IN_CLOSED_SET'`）、DB CHECK 拒（`23514`）。
- `NULL` 语义不变 = 未分类；**存量不回填**、零 DML。

## 二、迁移 0054 内容契约

1. `ALTER TABLE public.listing DROP CONSTRAINT IF EXISTS listing_item_type_check;` ⇒ 先删后加，反复 apply 落**同一终态**、库内**恰 1 条**。
2. `ALTER TABLE public.listing ADD CONSTRAINT listing_item_type_check CHECK (item_type IS NULL OR item_type IN ('DigitalAutoDeliver','DigitalManualDeliver','PhysicalFreeShip','PhysicalBuyerShip'));` —— **不动列定义**（仍 `text` 可空）。
3. 尾部 `DO $$` 自检 4 面（任一不成立 ⇒ `RAISE` ⇒ 整文件事务回滚、不写 `schema_migration` 行）：
   - ① 约束在场且**恰 1 条** item_type CHECK；定义含四值、**不含裸 `Digital`**、含 `IS NULL`；
   - ② `item_type = 'Digital'`（裸值）行数 = **0**；
   - ③ 闭集外/大小写不符行数 = **0**；
   - ④ 列仍 `text` 且 `is_nullable='YES'`。
4. **无 DML**（无 `UPDATE/INSERT/DELETE/TRUNCATE/DEFAULT`）、**无 `BEGIN/COMMIT`**、**不改 0050–0053**（`git diff HEAD` 逐字相同，见 A7）。
5. ★ 裸值判定用正则 `'''Digital''(::text)?([,)\]]|$)'` —— 「整字面 + 终止符」，**不会**把 `DigitalAutoDeliver` / `DigitalManualDeliver` 误判成退役值（首版漏了数组收尾 `]`，被灵敏度臂当场抓红后修正，见 D4）。

## 三、门读数（现取 · 落盘件）

| 门 | 命令 | 读数 |
|---|---|---|
| 类型 | `cd backend-ts && npx tsc --noEmit` | **exit 0** |
| 离线门套 | `npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` | **37/37** · `registration_points=110`（**注册点未动**） |
| item_type 门（已同步四值） | `npx ts-node --transpile-only scripts/s53-00-item-type-gate.ts` | **50/50** · 读数 `ops/item-type/readings/s53-item-type-gate-*.json` |
| 本单新门 | `cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/item-type/delivery/s54-00-item-type-delivery-gate.ts` | **45/45** · 读数 `ops/item-type/delivery/readings/s54-item-type-delivery-gate-*.json` |
| preflight（dev，只读） | `node migration-preflight.cjs backend-ts/.env.local backend-ts/migrations 0054 listing` | `NEON=quiet-math-65207667` · `MIG_TOP=0053` · **`PENDING=["0054"] EXTRA=[]`** · `PREFLIGHT=SAFE` |
| preflight（生产，只读） | 同上，env 文件 = `~/.config/seafood/prod-db.env` | `NEON=sweet-pond-28934105` · **`PENDING=["0054"] EXTRA=[]`** · `PREFLIGHT=SAFE` |

### 负控 1 · 写口「`Digital` ⇒ 400」（退役生效）
- `normalizeItemType('Digital')` ⇒ 400、`code=LEDGER_AMOUNT_INVALID`、`details.field='listing.item_type'`、`reason='NOT_IN_CLOSED_SET'`、`provided='Digital'`、`allowed=` 四值（s53 `U10-Digital` / s54 `U3-Digital`）。
- `createListing({itemType:'Digital'})` ⇒ 400 且 **`getCurrencyStatus` / `createListingRow` 调用 0 次**（闸仍在 `currencyGate` 之前，s54 `U7-Digital`）。

### 负控 2 · DB 层「`Digital` 被 CHECK 拒」（干跑事务内，零残留）
- 四值 + `NULL` 共 5 次写入 OK；裸 `Digital` / `Bogus` / `digitalautodeliver` 三次 **SQLSTATE 23514**（s54 `D3`；s53 `Q3` 同形）。

### 自检器灵敏度（证明 0054 尾部 `DO` 不是恒绿）
- 装「四值 + 裸 `Digital`」约束 ⇒ 自检 RAISE `retired value Digital (bare) still accepted`；
- 退回 0053 三值 ⇒ 自检 RAISE `lacks 4-value closed set`（s54 `D4` / s53 `Q4`，两臂均 `raised:true`）。

## 四、存量读数（apply 前 · 只读现取）

| 库 | `schema_migration` 顶 | `item_type` 总行 | 非空行 | 裸 `Digital` 行 | 闭集外行 | 约束定义 |
|---|---|---|---|---|---|---|
| dev `quiet-math-65207667` | `0053`（52 行） | 26 | **0** | **0** | **0** | 三值（含裸 `Digital`）= 待 apply 前态 |
| 生产 `sweet-pond-28934105` | `0053`（52 行） | 7 | **0** | **0** | **0** | 同上 |

⇒ **零 `Digital` 行、零已分类行**：换集无数据冲突，`DROP`+`ADD` 结构上必然成功（干跑已在 dev 事务内实证）。

## 五、读口 / 写口「零改动」核对

- 读口：feed 行键 **48** / 详情顶层 **47**（`item_type` 恒在场，值 ∈ 四值 ∪ `{null}`，服务端不翻译）—— 门 `C1/C3` 现取。
- 写口接线：`index.ts` 仍 `itemType: body.item_type`、`createListingRow` 仍 5 处 `item_type`、`PATCH`/编辑口仍不收该字段、幂等指纹仍 6 字段（s53 `B1–B6` / s54 `B3`）。
- 错误码闭集未动（仍借 `LEDGER_AMOUNT_INVALID`），闸位置未动（早于 `currencyGate`）。

## 六、边界 / 明账

1. **apply 由 Zang 执行**，本单**未 apply**；两库 `PENDING=["0054"]` 为现取终态。
2. ★★ **前端仍发旧值 `Digital`**（`frontend/src/pages/item/item-api.js` 的 digital 臂 + i18n/design §26.12 的映射表）⇒ **0054 apply 之后、前端跟上之前，数字商品发布会 400**。⇒ **上线顺序必须是「前端改 `Digital` ⇒ 两个新值 + 发布页拆自动/手动发货」与 0054 同批或先于 0054**，或在窗口内接受「数字商品暂不可发」。本单按派单只做后端 + 迁移，此依赖在此明记（前端单另派）。
3. `backend-ts/src/index.ts:2724` 与 `database.ts:1135` 的注释仍写「闭集三值」= **文本残留**（行为零影响）；按本单范围未改（不在「迁移 + listing-service + 门 + ops」路径内），留给前端/规范同批顺带订正。
4. 档案 `docs/**`（data §40.8 / route §49.11 / design §26.12 / master §5.x）**未动** —— 口径变更登记属规范单。
