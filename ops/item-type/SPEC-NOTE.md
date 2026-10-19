# SPEC-NOTE · 商品分类枚举 + 「包邮」标签（`item-type`）

- **单号**：`JING-SPEC-ITEM-TYPE`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 实测、零库写、零测试改动、不 push**；实现另单并行（Kong），质检另单（Neng）。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = 336ae2a`（工作区干净）
- **正典**：`docs/data-layer.spec.md` **§40.8**（新 · 头注 v0.38）+ `docs/route-layer.spec.md` **§49.11 续登**（同 v2.43 加性续登 · 不升版）+ `docs/design/design-system.spec.md` **§26.12**（新 · 不升版）+ `docs/seafood.master-plan.md` **§5.435 / 版本行 v0.352**

## 1. Kevin 依据（两段 · 均为派单转引）

> **①** 商品分类枚举 `ItemType { Digital, PhysicalFreeShip, PhysicalBuyerShip }`；其中 `PhysicalFreeShip` 在卡片上显示中文标签【包邮】（黑字黄底，位置在**商品标题前面**，参考图：方角/近方角的黄底黑粗字）。

> **②（执行中追加更正）** 「商品分类」改为 **2 选 1：数字商品 / 实物商品**；**另有选项 2 选 1：包邮 / 不包邮**。映射到存储枚举（不变，仍 3 值）：数字商品 ⇒ `Digital`；实物 + 包邮 ⇒ `PhysicalFreeShip`；实物 + 不包邮 ⇒ `PhysicalBuyerShip`。数字商品时「包邮/不包邮」不适用 ⇒ 该控件隐藏、不参与载荷。校验：类型必选；选实物时运费项必选（前端闸，服务端仍以 `item_type` 为唯一真值）。

**出处披露（诚实）**：两段均**转引自本单派单**，**原始会话未入仓** ⇒ 本单**不伪造逐字引语**；与 Kevin 原话若有出入，以 Kevin 一句话为准。**落笔中间态曾按①的字面写成「发布页必选 3 选 1 单控件」草稿（未入库、`git diff` 无删行痕迹）**，②到后按更正版重写 —— 轨迹登记在 design §26.12.6「自我披露」。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.8 · 迁移 `0053_listing_item_type.sql`）

| 项 | 值 |
|---|---|
| 列 | `public.listing.item_type text`（**可空**、**零默认**、**零 DML**） |
| 约束 | **恰 1 条**具名 `listing_item_type_check` = `CHECK (item_type IS NULL OR item_type IN ('Digital','PhysicalFreeShip','PhysicalBuyerShip'))`（`NULL` 放行 · 大小写敏感 · **不归一、不别名**） |
| 存量 | **不回填**：全部落 `NULL`，语义 = **未分类**（≠ `Digital`；禁按标题/价格/图片猜补） |
| 索引 | **零索引**（不进任何 `WHERE` / `ORDER BY`） |
| 迁移纪律 | `ADD COLUMN IF NOT EXISTS` + 先 `DROP CONSTRAINT IF EXISTS` 再 `ADD`（幂等、库内恰 1 条）· 文件内零 `BEGIN`/`COMMIT` · 尾部 `DO $$` 四自检（列可空 / 三值全在 / `item_type IS NOT NULL` 行数 = **0** fail-loud / 列与约束各恰 1）· 失败整迁移回滚、不写版本行 · **先 apply 后 push** |
| 闭环 | `schema_version` 0052 → **0053**；`listing` 列数 **13 → 14** |

### 2.2 写口（route §49.11 ①②③⑦）

| 项 | 值 |
|---|---|
| 唯一写面 | `POST /api/listing`（`index.ts:2710` · `listing-service.ts:164` `createListing`）body **可选** `item_type` |
| 缺省 / `null` | 落 `NULL`（未分类，**不报错**） |
| 非法 | **空串 / 闭集外字符串 / 非字符串 / 大小写不符 ⇒ `400`**（借既有 shape 码 `LEDGER_AMOUNT_INVALID`，`details={field:'listing.item_type',reason:'NOT_IN_ENUM'}`）⇒ **零新错误码**（`ledger-errors.ts` 33 码闭集不动） |
| 一次性 | `PATCH /api/listing/:listingId`（状态迁移）与 `POST /api/listing/:listingId`（编辑）**均不接受**：出现即**静默忽略**；改类 = 无写口（另立单） |
| 幂等 | 指纹仍 **6 项**（`seller_uid,cid,price,title,description,media_urls`），**不纳入** `item_type` ⇒ 同键重投返回**首落行**、不 409（要 409 = 一句话可改） |
| 第二字段 | 服务端**不认** `shipping` / `free_ship` 等；出现即忽略。**唯一真值 = `item_type`** |

### 2.3 读口（route §49.11 ④⑤）

| 口 | 现取（改前） | 契约（改后） |
|---|---|---|
| `GET /api/prize/all` 行键 | **47**（键集含 `wants`） | **48**（加性 `item_type`） |
| `GET /api/prize/:bID` 的 `data` 键 | **46** | **47**（同源同值） |
| 值形态 | — | 三值字面 **或 `null`**，**原样下发、服务端不翻译**（「包邮」由前端 `t('item.freeShipping')` 渲染） |
| 路由注册点 | **110** | **110 不变**（get 49 / post 57 / put 0 / delete 3 / patch 1） |

- 零新路由 / 零新幂等键 / 零新错误码；`item_type` **不进排序公式、不进分页判据、不作过滤**（按类型筛 = 另立单）。

### 2.4 前端 · 卡面标签（design §26.12.1–.3）

| 项 | 值 |
|---|---|
| 显示条件 | **仅** `item_type === 'PhysicalFreeShip'`；`Digital` / `PhysicalBuyerShip` / `NULL` **不渲染** |
| 位置 | `row1-wrap-title` **内**、**标题文字之前**（行首第一个 inline 节点） |
| 文字 | `t('item.freeShipping')`（zh「包邮」） |
| 色 | 字 `#202020` = `var(--sf-btna-fg)` · 底 `#FFE60F` = `var(--sf-btna-bg)`（`theme-tokens.css:151-152` 日 / `:267-268` 夜，**两档同值** ⇒ 日夜同貌）⇒ **零新 token / 零新色值** |
| 字号 / 字重 | **12px**（= §13 / `T79` 下限）· **700** |
| 圆角 | **2px**（近方角；**不得**胶囊 999px / 按钮 8px） |
| 与标题间距 | **4px** |
| 盒 | `inline-block` · 高 **16px** · `line-height:16px` · `padding:0 4px` · `vertical-align:middle` · `nowrap` |
| 不破 | 标题行高 **恒 48**（`offsetHeight`）· 卡高 **恒 392** |

### 2.5 前端 · 发布页（design §26.12.4 · **2 + 2 两控件**）

| 控件 | 形态 | 值 → 载荷 |
|---|---|---|
| A 商品分类 | `<select required>` · `data-sf-m="item-select-type"` · **2 选 1**（`itemType.digital` / `itemType.physical`）· 初始空 | `digital` / `physical` |
| B 运费 | `<select required>` · `data-sf-m="item-select-ship"` · **2 选 1**（`itemType.freeShip` / `itemType.buyerShip`）· 初始空 · **仅 A = 实物时渲染** | `free` / `buyer` |

| A | B | → `item_type`（载荷逐字） |
|---|---|---|
| `digital` | 隐藏 / 不参与（值清空） | **`Digital`** |
| `physical` | `free` | **`PhysicalFreeShip`** |
| `physical` | `buyer` | **`PhysicalBuyerShip`** |
| 空 / `physical`+空 | — | **不可提交**（前端闸；**不得**把 `''` 发给后端） |

### 2.6 i18n（5 键 × 四语 · 数量口径固定 5）

| 键 | zh | en | hk | vn |
|---|---|---|---|---|
| `itemType.digital` | 数字商品 | Digital goods | 數字商品 | Hàng kỹ thuật số |
| `itemType.physical` | 实物商品 | Physical goods | 實物商品 | Hàng vật lý |
| `itemType.freeShip` | 包邮 | Free shipping | 包郵 | Miễn phí vận chuyển |
| `itemType.buyerShip` | 不包邮 | Buyer pays shipping | 不包郵 | Người mua trả phí vận chuyển |
| `item.freeShipping` | 包邮 | Free shipping | 包郵 | Miễn phí vận chuyển |

- 非 zh 三语 = **待复核**（承站内体例：本表只给可用值、不阻断实现）；键名可按现取微调，**数量口径固定 5**。

## 3. 契约数（现取自证 · 2026-10-20）

| 面 | 现取（改前） | 契约（改后） | 取法 |
|---|---|---|---|
| feed 行键 | **47** | **48** | `curl localhost:5788/api/prize/all?limit=1` → `len(row)` |
| 详情 `data` 键 | **46** | **47** | `curl localhost:5788/api/prize/76` → `len(data)` |
| i18n 顶层 | **129** | **130**（+1 = 新命名空间 `itemType`） | `python3 json.load` → `len(dict)`（四语相等） |
| i18n 拍平 | **1115** | **1120**（+5） | 递归叶计数（四语各 1115） |
| i18n 四语节点 | **4460** | **4480** | = 1120 × 4 |
| `item` 命名空间 | **53** | **54** | `len(zh['item'])` |
| 路由注册点 | **110** | **110 不变** | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts`（get 49 / post 57 / put 0 / delete 3 / patch 1） |
| 迁移 | 末位 `0052` | **`0053`（新文件）** | `ls backend-ts/migrations` |
| dev `schema_version` | **`0052`** | **`0053`（apply 后现取）** | `curl localhost:5788/api/health` |

- **计数前推家族**：**12 个测试文件**硬编 top / flat / nodes 三数（`grep -rl "4460\|1115" frontend/src/test` = 12）⇒ 归实现单，本单不改测试。

## 4. 判负（design §26.12.5 · #15–#19 · 与 §26.11.5 九条、§26.11.9 #10–#14 并存）

1. **#15** 非 `PhysicalFreeShip`（`Digital` / `PhysicalBuyerShip` / `NULL`）显示标签 ⇒ 判负（`PhysicalBuyerShip` 显示「包邮」= 误导，**零容忍**）。
2. **#16** 带标签卡 `row1-wrap-title` `offsetHeight` ≠ **48**（卡高须 392）⇒ 判负。
3. **#17** 色值未取自 `var(--sf-btna-bg)` / `var(--sf-btna-fg)`；**`TOKEN_KEYS` 或 `theme-tokens.css` 新增颜色项 / 出现两种既定色以外的颜色字面 ⇒ 判负**。
4. **#18** 标签不在**标题文字之前**（标题后 / 行 2 / 独立行 / 行外）⇒ 判负。
5. **#19** 发布页两控件联动：数字时运费控件仍可见或仍进载荷（含 stale 值）/ 实物未选运费可提交 / 分类未选可提交 / 载荷出现第二分类字段 ⇒ 判负。

读数登记项（**不判负**）：标签横向 padding 4px ±1 · 圆角 2px ±1 · 间距 4px ±1 · 字重 600–700。

## 5. 已知张力 / 边界（诚实 · 不掩盖）

- **标签占宽 vs 标题两行容量**：`row1` 现取 1440 档可用宽 **187px**（207 − 2×10 padding）⇒ 14px 两行约 24 汉字；标签宽 ≈ **32px** + 4px 间距 = **36px** ⇒ 首行降至 ≈ **151px**，两行容量可能不足以容纳 48 显示宽单位 ⇒ **末尾 `...` 有被行盒裁掉的风险**（由 §26.11.5 **#5** 判负兜底）。三种不改契约的缓解（标签 `padding:0 3px` / `row1` padding 10→8 / 接受少 2–3 汉字）**交实现单实测后定，本册不预选**。
- **未做（本笔零代码）**：卡面标签与发布页两控件**均未实现**；`0053` **编制时点未落盘**（收笔时点已由并行实现单落盘，见 5.1）、**两库均未 apply**；i18n 5 键未落盘；12 文件计数未前推；**任何探针 / 单测 / 浏览器实测一条未跑**；存量 `listing` 行数与 `item_type IS NULL` 计数**未取**（`NOT_MEASURED`）。
- **设计面副作用 = 零**：`TOKEN_KEYS` / `theme-tokens.css` / `STRUCT` 一字不动；卡高 392、四行 48·32·24·48、图 240、价格行（§26.11.9.1）全不涉及。

### 5.1 并行实现单差额登记（收笔时点现取 · 未提交 · 本单不背书）

并行实现单（Kong）已在工作区落 `backend-ts/migrations/0053_listing_item_type.sql`（82 行）+ 改 `listing-service.ts` / `database.ts` / `index.ts`（**均未提交，本单未 add**）。逐项比对：

| # | 项 | 本册契约 | 落盘现取 | 处置 |
|---|---|---|---|---|
| 1 | **空串口径** | 空串 ⇒ **400** | `normalizeItemType`：未传 / `null` / **空串** ⇒ `null` | **唯一实质差额 · 待 Zang/Kevin 一句话定**（取落盘「空串 = 未填」或取契约「严格 400」；本单不擅改契约） |
| 2 | reason 字面 | `NOT_IN_ENUM` | `NOT_IN_CLOSED_SET` + `allowed:[三值]` | **以落盘为准**（非冻结字面） |
| 3 | 幂等指纹 | 不纳入 `item_type` | 不纳入（`:247-251`） | **一致** |
| 4 | 迁移幂等写法 | `DROP … IF EXISTS` + `ADD` | `DO $$` + `pg_constraint` 查存在再加 | 终态等价，以落盘为准 |
| 5 | 迁移自检 ③ | 「非 NULL 行数 = 0」（拦存量回填） | 「非法值行数 = 0」 | **落盘松一档**（合法回填不红）；契约仍 = 存量不回填，登记不擅改 |
| 6 | 读侧透出 `item_type` | feed 48 / 详情 47 | `database.ts:1518` 已实现，但 dev 进程**未载入新码** ⇒ 现取仍 **47** / 无键 | 48 / 47 实测 **待重启后现取**（`NOT_MEASURED`） |
| 7 | apply 态 | 0053 | dev `schema_version` 仍 **`0052`** | **未 apply** |

## 6. 本笔改动清单（5 件）

| # | 文件 | 动作 |
|---|---|---|
| 1 | `docs/data-layer.spec.md` | 头注前插 **v0.38**（最新在上）+ 文末追加 **§40.8**（列契约 / 三值闭集 / 迁移 0053 / 存量 NULL / 冲击与未测） |
| 2 | `docs/route-layer.spec.md` | 文末追加 **§49.11 续登**（写口可选 `item_type` · 非法 400 · 一次性不可改 · 指纹不动 · 读口 47→48 / 46→47 · 发布页 2+2 合成单字段 · 注册点 110） |
| 3 | `docs/design/design-system.spec.md` | 文末追加 **§26.12**（26.12.0–26.12.6：位置/几何 · 零新 token · 显示矩阵 · 2+2 发布页与 i18n · 判负 #15–#19 · 张力/未做/自我披露） |
| 4 | `docs/seafood.master-plan.md` | **倒序前插 §5.435**（置于 §5.434 之前）+ 版本表 **v0.352**（置于 v0.351 之前） |
| 5 | `ops/item-type/SPEC-NOTE.md` | 本文件（新） |

- **自证**：`git diff --numstat` 四册 **删除列 = 0**（data `+70/−0` · route `+2/−0` · design `+102/−0` · master `+16/−0`；新建件为全文新增）；`commit` **只 add 上述五件**（**未 add** 并行实现单的 `0053*.sql` / `scripts/s53-*` / `backend-ts/src/*` 改动）；**未 push**；未启停任何服务、未连库、未改代码。
- **落笔轨迹（诚实登记）**：① 首次前插 `§5.435` 时**误把 §5.434 标题行顶掉**（单次 patch 的锚点写法缺陷）⇒ 当次即补回原行、`numstat` 复核删除列仍 **0**（该册最终 `+16/−0`）；② `§26.12.4` 与 `§5.435 A` 因 Kevin 追加更正**由「3 选 1」重写为「2 + 2」**（中间态未入库，无删行留痕）。
