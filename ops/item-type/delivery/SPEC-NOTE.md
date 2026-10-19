# SPEC-NOTE · 数字商品再分两类（自动发货 / 手动发货）· `Digital` 退役 · 四值闭集 ＋ 卡面两枚标签（`item-type/delivery`）

- **单号**：`JING-SPEC-ITEM-TYPE-DELIVERY`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件（`0054` 由实现单落盘）、零 HTTP 实测、零库写（仅两库只读 SELECT）、零测试改动、不 push**；实现另单并行（Kong），质检另单（Neng）。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = 02b97fe`（工作区另有并行实现单未提交改动，**非本单写面**）
- **正典**：`docs/data-layer.spec.md` **§40.8.1**（新 · 加性续登、**头注版本块不改写**）+ `docs/route-layer.spec.md` **§49.11.1**（同 v2.43 加性续登 · 不升版）+ `docs/design/design-system.spec.md` **§26.12.8**（新 · 不升版）+ `docs/seafood.master-plan.md` **§5.437 / 版本行 v0.354**

## 1. Kevin 依据（三段 · 均为派单转引）

> **①** 数字商品**再分两类** —— `AutoDeliver`（自动发货）/ `ManualDeliver`（手动发货）；枚举由**三值变四值**、**`Digital` 退役**。发布页形态 **2 + 2 + 2**：一级「数字商品 / 实物商品」必选；数字 ⇒ 二级「自动发货 / 手动发货」必选；实物 ⇒ 二级「包邮 / 不包邮」必选；**切换一级分支时二级值清空**。载荷仍单字段 `item_type`。

> **②（执行中追加）** 【自动发货】标签也要显示在卡面标题前，位置与【包邮】**完全一致**（`.row1-wrap-title` 内首子元素）。差异仅在配色：底色**绿 ≈ `#4ADE80`**、文字黑 `#202020`；字号 / 字重 / 圆角 / 内边距 / 间距 / `vertical-align: baseline` 全部沿用包邮口径（12px / 700 / 16px 盒 / 2px / `0 4px` / `margin-right 4px`）。落点 = `reward-card.css` 卡内局部常量 `--sf-reward-tag-auto-bg:#4ADE80`（**零新 token**，与价格 `#FF4D00` 同法）。文案**复用 `itemType.autoDeliver`**（不新增键）。判负补两条：绿标底色非 `rgb(74,222,128)` / 绿标非首子元素位置。

> **③（定名覆盖 ①②）** 枚举字面以 Kevin 最新定名为准：四值 = **`DigitalAutoDeliver`**（数字·自动发货）/ **`DigitalManualDeliver`**（数字·手动发货）/ `PhysicalFreeShip` / `PhysicalBuyerShip`。**裸值 `AutoDeliver` / `ManualDeliver` 一律不得入库。**

**出处披露（诚实）**：三段均**转引自本单派单**，**原始会话未入仓** ⇒ 本单**不伪造逐字引语**；与 Kevin 原话若有出入，以 Kevin 一句话为准。**落笔轨迹**：§40.8.1 / §49.11.1 / §26.12.8 / §5.437 首稿曾按「裸值 `AutoDeliver` / `ManualDeliver` + 仅【包邮】上卡面」写，①② 追加后按 ③ 的定名与②的绿标**整段重写（未入库、无删行痕迹）** ⇒ 现行读法只有一份。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.8.1 · 迁移 `0054_item_type_delivery_split.sql`）

| 项 | 值 |
|---|---|
| 列 | `public.listing.item_type text` —— **逐条不变**（可空 / 零默认 / 零索引 / 零触发器 / 零 DML），本节**不加列、不改类型** |
| 约束 | **恰 1 条**具名 `listing_item_type_check` = `CHECK (item_type IS NULL OR item_type IN ('DigitalAutoDeliver','DigitalManualDeliver','PhysicalFreeShip','PhysicalBuyerShip'))`（`NULL` 放行 · 大小写敏感 · **不归一、不别名**） |
| 退役 | **裸值 `Digital`** 从 CHECK 移除 ⇒ 库侧 `23514`、写口 `400`；**禁止**把旧客户端 `Digital` 或存量 `NULL` 静默归一成新值 |
| 存量 | **不回填**：两库 `item_type` **全 `NULL`**、`Digital` **0 行** ⇒ 换集**无数据搬迁** |
| 迁移纪律 | 先 `DROP CONSTRAINT IF EXISTS` 再 `ADD`（幂等、库内恰 1 条）· 零 `BEGIN`/`COMMIT` · 尾部 `DO $$` **四自检**（列可空 / 约束恰 1 且含四值全字面、不含**裸值** `'Digital'` / 存量未回填 / 退役值零残留 · 重跑不变）· 失败整迁移回滚、不写版本行 · **`0053` 一字不动**（改它 = checksum 漂移 = ABORT）· **先 apply 后 push** |
| 闭环 | `schema_version` **0053 → 0054**；`schema_migration` **52 → 53** 行；`listing` 列数仍 **14** |

### 2.2 写口（route §49.11.1 ①②③⑥）

| 项 | 值 |
|---|---|
| 唯一写面 | `POST /api/listing` body **可选** `item_type` |
| 闭集 | **四值**（大小写敏感、无归一）；**裸值 `Digital` ⇒ `400`**（借码 `LEDGER_AMOUNT_INVALID` / `reason = NOT_IN_CLOSED_SET` / `allowed` 四值）⇒ **零新错误码** |
| 缺省 / `null` | 落 `NULL`（未分类，**不报错**） |
| 非法 | 空串 / 空白 / 小写 / 闭集外（**含 `Digital`**）⇒ **`400`**（`trim` 后判闭集，承 design §26.12.7 第二处口径差） |
| 一次性 | `PATCH /api/listing/:listingId` 与 `POST /api/listing/:listingId`（编辑）**均不接受**：出现即**静默忽略**；改类（数字⇄实物 / 自动⇄手动）= 无写口（另立单） |
| 幂等 | 指纹仍 **6 项**，**不纳入** `item_type` ⇒ 同键重投返回**首落行**、不 409 |
| 第二字段 | 服务端**不认** `shipping` / `deliver` / `free_ship`；出现即忽略。**唯一真值 = `item_type`** |

### 2.3 读口（route §49.11.1 ④⑤）

| 口 | 现取（改前 / 改后） | 契约 |
|---|---|---|
| `GET /api/prize/all` 行键 | **48** | **48（不变）** —— 换值不换键 |
| `GET /api/prize/:bID` 的 `data` 键 | **47** | **47（不变）** |
| 值 | 四字面之一 或 `null` | **原样下发、服务端不翻译**；两枚标签均**前端**渲染（`item.freeShipping` / `itemType.autoDeliver`） |
| 判负 | — | 读口出现 `Digital` / 键数漂移 ⇒ 判负 |
| 路由面 | 注册点 **110**（get 49 / post 57 / put 0 / delete 3 / patch 1） | **零新路由、零新幂等键、零新错误码** |

### 2.4 发布页 2 + 2 + 2（design §26.12.8 A–B）

| 控件 | 钩子 | 选项 | 在场条件 | 必选 |
|---|---|---|---|---|
| A 一级 | `item-select-type` | `digital` / `physical`（**仅 UI 分组、非存储值**） | 恒在场 | **是** |
| B1 数字二级 | `item-select-deliver` | `auto` / `manual`（**前端本地值，不入库**） | 仅 A = `digital` | **是** |
| B2 实物二级 | `item-select-ship` | `free` / `buyer` | 仅 A = `physical` | **是** |

- **两二级控件互斥在场**（未选分支不渲染、不参与表单）；**切换一级 ⇒ 二级值清空**（含未渲染那个）；**载荷只发 `item_type`**。
- 映射：`digital+auto ⇒ DigitalAutoDeliver` / `digital+manual ⇒ DigitalManualDeliver` / `physical+free ⇒ PhysicalFreeShip` / `physical+buyer ⇒ PhysicalBuyerShip`。
- 提交闸在 `onSubmit` **最前**、**零网络调用**；提示复用 `uiError.badRequest`（**不新增文案键**，承 `OPEN-ITEMS B44`）。

### 2.5 卡面两枚标签（design §26.12.8 D）

| `item_type` | 标签 | 底色 | 字色 |
|---|---|---|---|
| `DigitalAutoDeliver` | **【自动发货】**（`t('itemType.autoDeliver')`） | **`#4ADE80`** = `var(--sf-reward-tag-auto-bg)` → `rgb(74,222,128)` | `#202020` |
| `DigitalManualDeliver` | 无 | — | — |
| `PhysicalFreeShip` | **【包邮】**（`t('item.freeShipping')`） | `#FFE60F` = `var(--sf-btna-bg)` → `rgb(255,230,15)` | `#202020` |
| `PhysicalBuyerShip` / `NULL` | 无 | — | — |

- **同位置**：`.row1-wrap-title` 内**标题文字之前**的**首子元素**；**同几何**：12px / 700 / 16px 盒 / 2px 圆角 / `padding:0 4px` / `margin-right:4px` / `white-space:nowrap` / **`vertical-align: baseline`**；**只差底色**。
- `row1-wrap-title` **高恒 48**、卡总高**恒 392**、零横向溢出。
- **零新 token**：绿底落 `frontend/src/components/reward/reward-card.css` **卡内局部常量** `--sf-reward-tag-auto-bg`（**不进** `tokens.js` `TOKEN_KEYS` / `theme-tokens.css` / PROV）；`design §26.12.5 #17`「只许 `#FFE60F` / `#202020`」**只对黄标成立**，绿标允许**且仅允许**这一个值（第三个色值仍判负）。
- **占宽张力（登记）**：【自动发货】≈ **60px**（4×12 + 8 + 4 间距）vs【包邮】≈ **36px** ⇒ 1440 档首行可用宽 187 → ≈ **127px**，两行容量吃紧；缓解四选一（`padding:0 3px` / `row1` padding 10→8 / 接受少 2–3 汉字 / **不得缩字号**），**实测归实现单**。

### 2.6 i18n（design §26.12.8 C）

| 项 | 值 |
|---|---|
| 新增键 | **2 个**：`itemType.autoDeliver` / `itemType.manualDeliver`（× 四语 zh / en / hk / vn） |
| 保留 | `itemType.digital` / `itemType.physical` ⇒ **一级组标签**（`digital` **不再是存储值**）；`item.freeShipping` 不变 |
| 绿标文案 | **复用 `itemType.autoDeliver`** ⇒ **不新增第三键** |
| 键名 ≠ 存储值 | 键名保持短名；存储字面带 `Digital` 前缀；UI local value = `auto` / `manual`（不入库）。要键名也带前缀 = 同名重命名、键数不变，**一句话可改** |
| 计数前推 | top **130 → 130** · flat **1120 → 1122** · 四语节点 **4480 → 4488** · `itemType` **4 → 6** · `item` **54 → 54** |
| 前推家族 | 现取 `grep -rlE 'toBe\(1120\)|toBe\(4480\)|flat=1120|flat: 1120' frontend/src/test frontend/scripts` = **13 文件**（归实现单） |

## 3. 判负（design §26.12.8 E · `#20`–`#24` · 与 #15–#19 并存、只增不改）

| # | 违反即判负 |
|---|---|
| **20** | 任一处出现**裸值 `Digital`**（发布页载荷 / `POST /api/listing` / 库内行 / 读口载荷；含「前端仍映射 `digital ⇒ Digital`」半改） |
| **21** | **两分支二级控件同时在场**（同时渲染，或 `display:none` 但仍参与表单/载荷） |
| **22** | **切换一级分支未清值**（切到 `digital` 后 `ship` 非空 / 切到 `physical` 后 `deliver` 非空 / 切换后载荷带上被切走分支的值） |
| **23** | **绿标底色 ≠ `rgb(74, 222, 128)`**（含被覆盖 / 沿用黄底 / 改透明度）；字色须 `rgb(32, 32, 32)` |
| **24** | **绿标不是 `.row1-wrap-title` 首子元素**（标题之后 / 行 2 / 独立行 / 行外 / 无标签）；且 `row1` 高仍 48、卡高仍 392 |

## 4. 现取读数（2026-10-20 编制时点）

| 项 | 读数 | 取法 |
|---|---|---|
| dev `listing` | **26 行** / `item_type IS NULL` **26** / `Digital` **0** / 四值各 **0** | 只读 SELECT · `neon.project_id = quiet-math-65207667` |
| 生产 `listing` | **7 行** / `IS NULL` **7** / `Digital` **0** / 四值各 **0** | 只读 SELECT · `neon.project_id = sweet-pond-28934105` |
| `schema_migration` | 顶 **`0053`** / **52 行**（两库同） | 同上 |
| 现约束 def | 旧三值集 + `NULL` 放行（`'Digital','PhysicalFreeShip','PhysicalBuyerShip'`） | `pg_get_constraintdef` |
| i18n | top **130** / flat **1120** / nodes **4480** / `itemType` **4** / `item` **54** | `python3` 逐文件复算四语 |
| 注册点 | **110**（get 49 / post 57 / put 0 / delete 3 / patch 1） | `grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` |
| 迁移末位 | **`0053`**（`0054` 已由实现单落盘、未 apply） | `ls backend-ts/migrations` |

- 探针纪律披露：dev 读 `backend-ts/.env.local`、生产读 `~/.config/seafood/prod-db.env`，**显式构造连接**（`dotenv.parse` 后 `neon(url)`，不吃 `process.env`）⇒ 不污染会话环境；**本笔零写库 / 零 DDL / 零 apply**。

## 5. 与并行实现单的关系（不背书）

- 落盘 `0054_item_type_delivery_split.sql`（**93 行 · 未提交**）：幂等写法、四值字面与顺序、零 DML、事务纪律**与本契约逐字一致**；**唯一实质差额 = 自检 ③**（落盘「闭集外行数 = 0」比契约「`IS NOT NULL` = 0」**松一档**，合法值回填不红）⇒ 已在 `data §40.8.1 F` 登记，**不擅改契约**。
- `listing-service.ts` 的 `ITEM_TYPES` 已换四值（未提交）；`backend-ts/scripts/s53-00-item-type-gate.ts` 有改动（未提交）—— **均属实现面，本单不背书、未 add**。

## 6. 未做（诚实边界）

- 三控件、四值、绿标 **均未实现**；两键**未落盘**、13 处计数断言**未前推**；`0054` **未 apply**（两库仍 `0053`）⇒ `23514` 兜底、四值往返、三控件必选/清值、两枚标签配色与位置**全部 `NOT_MEASURED`**。
- **生产不可自然取证**：两库存量 `item_type` **全 `NULL`** ⇒ 标签只能靠 `context.route` 注入夹具验证，**不得往生产库造测试商品**。
- 本笔**只写 `docs/**` 与 `ops/item-type/delivery/**`**，零代码 / 零迁移文件 / 零测试改动 / 零 HTTP，**纯追加删行 0**、`git reset -q` 后只 add 五件、`git commit` 不带 pathspec、**不 push**。
