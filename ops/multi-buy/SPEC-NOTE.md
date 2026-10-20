# SPEC-NOTE · 多件购买授权（卖家开关 ＋ 购买时询问）

- **单号**：`JING-SPEC-MULTI-BUY`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 写、零库写、零测试改动、不 push**；前后端实现由后续实现单承接。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = bde5a4c`（**工作区非干净**：`M backend-ts/src/{database,index,listing-service}.ts` + `?? backend-ts/migrations/0060_item_code_snowflake.sql` + `?? backend-ts/src/item-id.ts` + `?? ops/item-id/.probe*`，属**并行 item-id 单**，与本单无关）
- **正典**：`docs/data-layer.spec.md` **§40.13**（v0.43 · 加性一列，头注不改写）+ `docs/route-layer.spec.md` **§49.17**（v2.44 · **加性续登、不升版**）+ `docs/design/design-system.spec.md` **§26.18**（加性续登、不升版）+ `docs/seafood.master-plan.md` **§5.445 / 版本行 v0.362**

## 1. Kevin 依据（三条）

> ① **发布商品时，如果商品数量（stock）> 1，用户需填写一个选项「是否支持一次购买多个」**。
> ② **若开启，购买者点【立即购买】后弹确认购买数量的提示**：数量**默认 1**，上限 = `min(stock, 单次上限)`。
> ③ **未开启 ⇒ 恒买 1 件、零提示**。

**出处披露（诚实）**：三条转引自本单派单，**原始会话未入仓** ⇒ 不伪造逐字引语。**背景** = 同日详情页已删「数量输入框」（design §26.17）⇒ 购买恒 `quantity=1`；本单把「多件购买」从**常显表单**改为**卖家授权 + 购买时询问**。**实现口径**（`0061` 列名/类型、读口键数 52→53 / 13→14、购买 400 语义）由派单给定，本单**照抄不发明**；派单未定、由本单裁的四条见 §3。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.13 · `MB-1`…`MB-5`）

| 项 | 值 |
|---|---|
| 列 | `listing.allow_multi_buy` **`boolean NOT NULL DEFAULT false`**（禁 `smallint` / 禁 `text '0'/'1'` / **禁三态 `NULL`**） |
| 语义 | `true` = 卖家授权一次购买多件（`1..min(stock, 单次上限)`）；`false` = 恒 1 件 |
| 存量 | **全 `false`**（靠 DEFAULT，**迁移里零 `UPDATE`**）—— 回填 `true` = 替卖家做决定 |
| 索引 / CHECK | **零索引**；**零 CHECK —— 且这是核心裁定**：`stock` 随购买递减（`0015:770`），「`true` ⇒ `stock ≥ 2`」写成表约束会让**正常购买**撞 `23514` |
| 列数 | **17 → 18**（承 §40.12） |
| 幂等 | **不进** `resolveListingCreateKey` 的 4 元素 ⇒ 同键重投 **200 replay** 回库内真值 |
| 迁移 | **`0061_listing_allow_multi_buy.sql`**：单条 `ADD COLUMN IF NOT EXISTS` + 五项 `DO $$` 形状自检（列存在 / `boolean` / `NOT NULL` / `DEFAULT false` / 列数 18）；**不并入 `0060`**（合并 = 两个独立变更绑成一个失败域）；`schema_version` **0060 → 0061**；**先 apply 后 push**（新码先上线 ⇒ 读口 `42703` 5xx） |

### 2.2 接口面（route §49.17 · **零新注册点** · **零新错误码**）

| 项 | 值 |
|---|---|
| 写口 | `POST /api/listing` 收可选布尔；`PATCH /api/listing/:listingId` 字段支成为**第 7 个可改字段**（`LISTING_EDIT_FIELDS` 6 → 7，与 `editable_when_creating` 6 → 7 **必须同批**） |
| 归一/400（W1–W7） | 未传（创建）⇒ `false`；`true` ∧ 生效 `stock ≥ 2` ⇒ `true`；**`true` ∧ 生效 `stock ≤ 1` ⇒ 400 `MULTI_BUY_NOT_APPLICABLE`**；`false` 恒合法；**`PATCH` 未传 ∧ 改后 `stock ≤ 1` ⇒ 归一 `false`（不 400）**；`'true'`/`1`/`'1'`/`null` ⇒ **400 `NOT_A_BOOLEAN`** |
| 生效 `stock` | **请求值（若带）∨ 行内现值** —— 漏这条，最易漏的臂是「行内已是 1、只传 `true`」 |
| 购买闸 | `allow=false ∧ qty>1` ⇒ **400 `LEDGER_AMOUNT_INVALID` + `reason:'multi_buy_not_allowed'`**，**零 DB 调用**；`qty > stock` ⇒ **既有 `409 LEDGER_INSUFFICIENT_BALANCE` + `listing_stock_insufficient`**；`status` 闸既有 409；闸序 **`allow` 先于 `stock`** |
| 闸位置 | **服务层 `buyListing` 前置只读**（体例照 `refundListingOrder` 的「只读做闸」）—— **不改 `listing_post_event` 函数体**（资金链核心，另一量级）；已知竞态原样登记 |
| 购买不回写 | 买到最后 1 件后 `allow_multi_buy` **保持 `true`**（回写要在资金链语句里多一个写动作，收益仅「列值好看」） |
| 读口键数 | 详情 **52 → 53** · mine **13 → 14** · **edit 13 → 14**（§49.16.3「与 mine 键面恒等」的派生要求 —— 漏它 = 编辑页预填断链而门套零信号）· feed **50 不变**；类型 **真布尔**、恒在场、追加末位 |
| 注册点 / 错误码 | **111 不变**（get 50 / post 57 / put 0 / delete 3 / patch 1）· **33 码闭集不动**（新增的只是 `details.reason` 字符串） |

### 2.3 界面面（design §26.18）

| 项 | 值 |
|---|---|
| 开关可见性 | **仅 `Number(form.stock) > 1`**（**禁字符串比较**：`'10' > '9'` 为 `false`）；`stock ≤ 1` / 空 / 非法 ⇒ **整块不渲染 + state 强制 `false`** |
| 默认 | **关**（不得因库存填 >1 自动勾选） |
| 编辑预填 | 取 `edit` 读口 `allow_multi_buy`；行内 `true` ∧ `stock = 1`（正常终态）⇒ 不渲染 + state `false` + 保存不带该键 |
| 降量 | `stock` 改 ≤1 ⇒ **单向自动关**；改回 ≥2 **不自动恢复**（回涨 = 替卖家决定 + 与 `W5` 归一后的库值分叉） |
| 形态 | **`checkbox` + `<label>`**（`data-sf-m="item-input-multi-buy"`），**不新造 switch**；触控 ≥44、字号 ≥12px；落点 = 库存框之后、分类级联之前 |
| 弹层触发 | **`row.allow_multi_buy === true` ∧ `cap = min(stock, 10) ≥ 2`** ⇒ 点【立即购买】**先弹层、本次零请求**；否则 **零提示直买 1 件**（既有路径逐字不变） |
| 弹层内容 | 标题 `item.buyQtyTitle` · 提示 `item.buyQtyHint`（`{{n}}` = `cap`，**必须显示**）· 数字输入 `min=1 / max=cap / step=1` / **默认 1** · 取消（复用 `cancel`）· 确认（复用 `item.buy`） |
| 弹层纪律 | **取消 / 背板 / Esc ⇒ 零请求** · **禁静默 clamp**（买家以为 10 件实际 3 件）· `fixed` 覆盖层（不进 `scrollWidth`、不触碰 #51/#52 锚、**不新增 `data-sf-region`**）· `item-buy-btn` 保持 `type="submit"`（拦截在 `onSubmit`） |
| 上限常量 | `MULTI_BUY_MAX_QUANTITY = 10` = **前端局部常量**；服务端**不设第三道闸**（`qty ≤ stock` 已由 DB 硬闸兜住）⇒ 登记 + 一句话可改 |
| i18n | **+3 键**（`item.multiBuyLabel` / `item.buyQtyTitle` / `item.buyQtyHint`），复用顶层 `cancel` 与 `item.buy`；计数 top **131 不变** / flat **1137 → 1140** / nodes **4548 → 4560** / `item` **65 → 68** |

## 3. 本单裁的四条（派单未定项 · 都可一句话改）

1. **归一只在写口、库面不设跨列约束** —— 库面约束会被正常购买（库存递减到 1）打成 `23514`，报的却是约束码，排查会指向买家的 `quantity`。
2. **显式矛盾 400、隐式冲突归一，两条不许合并** —— 同请求显式 `true` + `stock ≤ 1` = 调用方缺陷（静默归一 ⇒ 前端以为开了）；`PATCH` 只把 `stock` 降为 1 = 合法编辑（不归一 ⇒ 留下「已授权但只剩 1 件」的脏值）。
3. **购买闸放服务层前置只读，不进资金链函数体** —— `0061` 只加列；函数体内加闸 = 另一量级（独立单 `0062`）；竞态（毫秒级、单向、无资金敞口）原样登记不隐匿。
4. **购买路径不回写该列** —— 读面已自愈（`cap = min(stock, 上限)`），回写只换来「列值好看」，代价落在钱上。

## 4. 跨册冲突收窄（**旧字面逐字保留**）

| 册 / 条 | 旧字面 | 现行（以本单为准） |
|---|---|---|
| data §40.12.9 `ID-N3` | 「`LISTING_EDIT_FIELDS` 出现第 7 项 ⇒ 同判」 | 收窄：判负对象是「`item_code` / `snowflake_id` 混进可改字段」；现役 = **恰 7 项且不含两码列**；第 8 项或两码任一进场仍判负 |
| design §26.17.5 **#63** | 「…或 `quantity ≠ '1'`… ⇒ 判负」 | **该分句作废**：改为「请求体必含 `quantity` + `create_key`；`quantity` 恒正整数；未走弹层时恒 `'1'`；**授权态与件数必须匹配**」 |
| design §26.17.5 **#59** | 「详情页出现可编辑数量控件 ⇒ 判负」 | **尺度不变**：弹层层内 `input` 不算；页面正文常显块才算（两条线索已并列，防把目标态判成回潮） |
| design §26.17.1 | 「库存 > 1 的单品单次只买 1 件」 | 仅在 `allow_multi_buy = false` 时成立 |

## 5. 判负清单（17 条，交接给质检）

- **data `MB-N1`–`MB-N5`**：库面跨列约束（负控 = 2 → 1 件购买必须 200）/ 400 与归一分不清（三臂）/ 键数不足或类型错 / 进了幂等指纹 / 购买路径回写该列（负控 = 买到最后 1 件仍 `true`）。
- **route #48–#53**：前端闸代替服务端闸（**绕过前端**打真 API）/ 拒绝码不合矩 / 键数不足或 feed 多键 / 写口矩阵错（W3、W5、W7 三臂）/ 既有单件链路被连坐（**改前改后同请求对拍**）/ 注册点或错误码被顺手改。
- **design #64–#69**：开关常显 / 默认开 / 降量残留（含回涨反臂）/ 弹层触发错（**两臂都测**）/ 弹层参数错（默认值、`cap` 显示、取消零请求）/ 件数没落到载荷。

## 6. 现取读数与未做（明账）

- **现取**（HEAD `bde5a4c`）：注册点 **111**（get 50 / post 57 / put 0 / delete 3 / patch 1）· 迁移末位盘上 **`0060_item_code_snowflake.sql`**（untracked / 未提交 / 两库未 apply）、`ls migrations | grep -c 0061` = **0** · `LISTING_EDIT_FIELDS` **6 项**（`listing-service.ts:545`）· `editable_when_creating` **6 项**（`:328`）· `buyListing` 起 `listing-funds-service.ts:273` · `toPosIntText` `:226-231` · 指纹含 `quantity` `:310` · 库存闸 `0015_listing.sql:583-588` · `LEDGER_INSUFFICIENT_BALANCE` = 409（`ledger-errors.ts:33`）· 读口 详情 **52** / mine **13** / edit **13** / feed **50** · i18n top **131** / flat **1137** / nodes **4548** / `item` **65**（四语逐字相等）。
- **DB 面 = `NOT_MEASURED`（诚实登记）**：本环境连不上 Neon —— `migration-preflight.cjs` 连打 **3 次**均 `PREFLIGHT=STOP reason= Error connecting to database: fetch failed`（`neon.project_id` 首次可读到 `quiet-math-65207667`，属网络/传输层、非凭据问题）⇒ **列数 18 / `schema_version` / `stock > 1` 行数均未实测**，按 §40.12 的 17 推算，**不冒充实测**。
- **未做**：迁移 `0061` 未落盘、两库未 apply；写口两处、购买闸、三读口加键、开关 / 降量自动关 / 弹层、i18n 三键 —— **全部为零**；判负 **17 条一条未跑**；**零 HTTP 实测 / 零库写 / 零截图 / 零代码**。
- **挂账两条**：① 购买闸函数级原子化（`0062`，消除前置读竞态）；② 单次上限若需服务端强制（一行常量 + 一条 400，借码不新码）。
- **本笔**：只写 `docs/**` 四件 + 本文件；`git reset -q` 后按路径逐个 `add`、`git diff --numstat` **删除列 = 0**、**不 push**。
