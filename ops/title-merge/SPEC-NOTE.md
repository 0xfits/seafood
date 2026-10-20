# SPEC-NOTE · 去标题（`listing.title` 退役 · 正文并入 `description`）

- **单号**：`TITLE-MERGE`（Jing 落册 · 规范面）
- **日期**：2026-10-20
- **编制起点**：`HEAD = 421b7c9`（`origin/main` = **`6f88cce`** ⇒ 本地 **ahead 2 笔**：`c3dd5fc` 规范 / `421b7c9` 实现，**均未 push**；工作区干净）。落笔期间并行实现单开始改 `backend-ts/src/{listing-service.ts,database.ts}` 并落盘 `0055` / `0056`，本件**不背书**其未提交内容
- **范围**：只写 `docs/**` + `ops/title-merge/**`。**零代码 / 零迁移文件 / 零库写 / 零 HTTP / 零测试改动**；`git diff --numstat` 删除列 **0**。
- **口径来源**：Kevin 2026-10-20 指令（**原始会话未入仓**，逐字转引自派单）：
  > 取消商品标题字段，并入 `description`。标题 = 描述首个 `\n` 之前；无回车则整段作标题；显示层按 **48 显示宽单位**截断并追加 `...`；**存储不截**。

---

## 1. 一句话结论

**列亡、键在、真源唯一**：`listing.title` **列**在 `0056` 后从库里消失；读口 `title` **键仍在下发**（前端零破），值 = **描述首行派生**；写口**不再接受** `title`（带非空值 ⇒ 400），`description` 升为**必填正文**。

---

## 2. 真源索引（四册 + 交付件）

| 面 | 册 / 节 | 一句话 |
|---|---|---|
| 数据 | `docs/data-layer.spec.md` **§40.9**（`v0.39` · 文末追加） | 回填规则 B1–B6 · `0055` / `0056` 契约与自检 · **S1→S2→S3** 三阶段 · 派生不落库 · 两库读数 |
| 路由 | `docs/route-layer.spec.md` **§49.13**（不升版 · 文末追加） | 三口同口径拒 `title` · `description` 必填 · 读口键集零变化 · 指纹 6→5 · 判负 **#14–#21** |
| 设计 | `docs/design/design-system.spec.md` **§26.14**（不升版 · 文末追加）+ **§26.13 补登一行** | 单描述框 · 框下常驻提示 · 派生显示链 · 编辑页字段集 / 草稿库存只读 · 判负 **#36–#39** |
| 台账 | `docs/seafood.master-plan.md` **§5.440** + 版本行 **v0.357** | 链路 / 现取读数 / 未测 |
| 交付 | 本文件 | 实现清单与坑位 |

---

## 3. 契约要点（逐条可勾）

### 3.1 写口（route §49.13.2 / §49.13.3）

- [x] `POST /api/listing`：`title` **非空字符串（`btrim` 后）** ⇒ **400** `LEDGER_AMOUNT_INVALID` `{field:'listing.title', reason:'NOT_SUPPORTED'}` —— **与 `PATCH` 同码同字面**。
- [x] `title: ''` / `null` / **缺省** ⇒ **忽略**（不 400）—— 旧前端空串不得爆（判负 #21）。
- [x] `title` 非字符串（数字/数组/对象/布尔）⇒ 同码 `NOT_SUPPORTED`（不细分 `NOT_A_STRING`）。
- [x] `description` **必填**：缺省 / `null` / `''` / 全空白 ⇒ **400** `{field:'listing.description', reason:'REQUIRED'}`；非字符串 ⇒ `NOT_A_STRING`。
- [x] 旧编辑口 `POST /api/listing/:listingId` **同口径**（`description` 可选但**不可置空**）。
- [x] `PATCH`：`title` 任意值 ⇒ `NOT_SUPPORTED`（从 `NO_EDITABLE_FIELD` 里摘出；空 body 仍 `NO_EDITABLE_FIELD`）。
- [x] 形状闸在**服务层解析段、`currencyGate` 之前**（非法值 **零 DB 调用**）；失败分支**零写入**。

### 3.2 读口（route §49.13.4）

- [x] **键集零变化**：feed **48** / 详情 **47** / `GET /api/listing/mine` **10**；`title` 键**必须在**。
- [x] `title = firstLine(description)`：首个 `\n` 前、剥行尾 `\r`、两端 `trim`、空 ⇒ `''`（**不编造占位**）。
- [x] `name` 兼容键与 `title` **逐字相同**（`database.ts:2231` 的 `name ← name | title` 只剩 `title` 一路）。
- [x] **不截断**：API / 存储层出现字面 `...` 即判负 #19；48 单位截断只在显示层。

### 3.3 幂等（route §49.13.5）

- [x] 指纹 **6 → 5** 项：`seller_uid, cid, price, description, media_urls`（去 `title`；`stock` 本就不在集内）。
- [x] `create_key` 派生载荷 `['create', seller_uid, cid, price, stock, title]` → **4** 个业务元素（去 `title`）。
- [x] 行为放宽（登记）：原先因 `title` 不同而 409 的用例 ⇒ 现在 **200 `replay`**。
- [x] **不得**把派生 `title` 塞回指纹（会随描述漂移）。

### 3.4 显示（design §26.14）

- [x] 发布页 / 编辑页**恰一个正文字段**：`<textarea data-sf-m="item-input-note">`；`item-input-title` **DOM 0 命中**。
- [x] 描述框**正下方常驻提示**「第一行将作为标题」（**不得**用 `placeholder` 顶替；字号 **≥12px**；零新 token；键名 `item.descFirstLineHint` 仅为建议）。
- [x] 显示链 `firstLine → truncateByWidth(v, 48) → 字面 ...`；卡面 `.row1-wrap-title` **48** / 卡高 **392** 不变；**不得渲染第二行**。
- [x] 列表行标题与卡面**同口径**；详情页**不截**（可换行）；编辑页预填**全文**（不得塞回首行）。
- [x] 编辑页可改字段 = `description / price / stock / media_urls / item_type`（**无 `title`**）。
- [x] **草稿（`draft`）行库存只读** —— 库侧 `DL60`「库存变更只允许 `listed`」⇒ §26.13.6 未决项**结案 = 取 (b) UI 侧只读**（不放宽后端闸）。

---

## 4. 迁移链与顺序（顺序反了就是全站 500）

```
S1  0055_listing_title_merge.sql      ← 回填 description、列暂留、零 DDL
      │   （旧码仍读 title 列 ⇒ 零破窗；dev 先行）
S2  代码上线（push）                   ← 写口拒 title / 读口派生 / 编辑口去 title；0056 不 apply
      │   （列仍在 ⇒ 回滚 = 回退代码，秒级；此窗 title 为「只读遗留列」）
S3  0056_listing_title_drop.sql        ← DROP COLUMN IF EXISTS title；前置 = S2 已验收
```

**禁止顺序（三条）**：① 先 DROP 后上线（旧码 `SELECT l.title` ⇒ `42P01` ⇒ 列表/详情/编辑/`mine` 全挂）；② `0055` 与 `0056` 同批 apply（观察窗归零）；③ `0056` 与 S2 同一 push 且未取生产终验。

**弱可逆（诚实声明）**：S3 之后要退回，只能 `ADD COLUMN title text NOT NULL DEFAULT ''` + `split_part(description, E'\n', 1)` 重建 —— `title` 原文若含换行或首尾空白，**不保证逐字相同**。

---

## 5. 回填规则（`0055` 的 DML 语义）

```sql
UPDATE public.listing
   SET description = CASE
         WHEN btrim(coalesce(title, '')) = '' THEN coalesce(description, '')
         WHEN btrim(coalesce(description, '')) = '' THEN title
         ELSE title || E'\n' || description
       END
 WHERE btrim(coalesce(title, '')) <> ''
   AND description IS DISTINCT FROM (CASE
         WHEN btrim(coalesce(description, '')) = '' THEN title
         ELSE title || E'\n' || description
       END);
```

| # | 规则 | 违反后果 |
|---|---|---|
| B1 | 标题在前、正文在后，分隔 = **单个 `E'\n'`** | 多一个换行 ⇒ 派生标题后出现空首行 |
| B2 | **空描述不加尾换行** | 落库得 `title` + 尾随换行（派生值同、字节脏 ⇒ 判负） |
| B3 | **全空白 `title` ⇒ 不动** | 写成「换行 + 正文」⇒ 派生标题变空串 |
| B4 | **幂等守卫**：已等于 `title` 或以「`title` + 换行」起首 ⇒ 跳过 | 人工重跑 / 分支重放 ⇒ 标题拼两遍 |
| B5 | **不做全局换行归一** | 改写过用户正文；`\r\n` 归一属显示层 |
| B6 | 只写 `description` 列 | `time_updated` 由 `trg_listing_touch_time_updated` 自动刷新（**已知副作用**，排序吃 `time_created` ⇒ 不动） |

**自检（`0055` 尾部 `DO $$` 四项）**：① 零漏行（有标题 ∧ 空描述 = **0**）；② 零二次拼接（`description LIKE title || E'\n' || title || E'\n' || '%'` = 0）；③ **列仍在**（回填不得顺手 DROP）；④ 行数 = 迁移头注登记的预检值（**不得**写成「恒 > 0」这种无分辨力断言）。

**自检（`0056` 尾部 `DO $$` 三项）**：① `title` 列 **0 命中**；② `description` 仍 `NOT NULL`；③ `listing` 列数 = **13**。

---

## 6. 现取读数（2026-10-20 · HEAD `421b7c9`）

| 项 | 读数 |
|---|---|
| 两库 `schema_version` / `schema_migration` 行数 | **`0054` / 53**（dev `quiet-math-65207667` / 生产 `sweet-pond-28934105`，逐库 `current_setting('neon.project_id')` 自证） |
| `listing` 总行 | dev **26** · 生产 **8** |
| `title` 空行 | dev **0** · 生产 **0** |
| `description` 空行 | dev **7** · 生产 **0** |
| **回填命中行**（空描述 ∧ 有标题） | dev **7** · 生产 **0** |
| `listing` 列数 | **14** |
| 列属性 | `title text NOT NULL DEFAULT ''`（`0015:121`）· `description text NOT NULL DEFAULT ''`（`0015:122`） |
| 注册点 | **110**（get 49 / post 57 / put 0 / delete 3 / patch 1） |
| 迁移文件末位 | **`0054_item_type_delivery_split.sql`**（`0055` / `0056` 本笔时点**未落盘**） |
| 前端截断工具 | `frontend/src/components/reward/truncate.js`：`truncateByWidth(text, 48)` / `displayWidthUnits` / `charWidthUnits`，超宽才加字面 `...` |
| 发布页两控件（现取） | `item-input-title`（`<input required>`，`PublishItemPage.jsx:368`）+ `item-input-note`（`<textarea rows=3>`，`:474`）；载荷 `:296` 现含 `title` |
| 幂等指纹 | **6 项**含 `title`（`listing-service.ts:198/:267`）；`create_key` 派生 **5 元素**含 `title`（`:241`） |

> **★ 读数分辨力**：生产 `description` 空行**改前即 0** ⇒ 「回填后归零」在生产**无分辨力**。生产侧回填生效只能靠「S1 前落盘 `listing_id / title / description` 快照 → apply 后逐行比对首行」；dev 的 `desc_empty 7 → 0` 才是有效闭环读数。

---

## 7. 判负索引（质检照抄，不用回翻册子）

| 面 | 编号 | 一句话 |
|---|---|---|
| route | **#14** | `POST /api/listing` 带 `title:'x'` 非 400 `NOT_SUPPORTED` ⇒ 负（含 200 / 静默忽略 / 409 / 500） |
| route | **#15** | `description` 缺失 / `''` / `'   '` 非 400 `REQUIRED` ⇒ 负（含建出空正文行） |
| route | **#16** | 旧 `POST /api/listing/:id` 带 `title` 非 400，或与 `PATCH` 的 code / details 不逐字相同 ⇒ 负 |
| route | **#17** | 读口键数 ≠ 48 / 47 / 10，或 **`title` 键缺失** ⇒ 负 |
| route | **#18** | 派生值 ≠ 描述首行（未 trim / 整段塞入 / 空描述编造 / `\r` 未剥）⇒ 负 |
| route | **#19** | 响应体出现截断或字面 `...` ⇒ 负 |
| route | **#20** | 同 `create_key` 仅 `title` 不同 ⇒ 回 409（期望 200 replay），或指纹仍含 `title` ⇒ 负 |
| route | **#21** | `title:''` / `null` / 缺省 任一被 400 ⇒ 负（旧前端不得爆） |
| design | **#36** | 发布页 / 编辑页出现独立标题输入框（含 `display:none` 但 DOM 在场）⇒ 负 |
| design | **#37** | 标题非描述首行，或编辑页描述框被填成首行 ⇒ 负 |
| design | **#38** | 多行描述在卡面：行高 ≠ 48 / 卡高 ≠ 392 / 渲染第二行 / 横向溢出 ⇒ 负 |
| design | **#39** | 框下提示缺失 / 仅 placeholder / 字号 < 12px ⇒ 负 |

---

## 8. 实现清单（给实现单，按顺序）

1. **服务层**：`createListing` 去 `title` 解析与 `create_key` 派生位；加 `description` 必填闸（`REQUIRED`）；`title` 出现 ⇒ `NOT_SUPPORTED`（空串/`null`/缺省放过）。
2. **服务层**：`updateListing`（旧编辑口）同口径；`PATCH` 侧把 `title` 从 `NO_EDITABLE_FIELD` 里摘出判 `NOT_SUPPORTED`。
3. **指纹**：`fingerprintOf` 与比对数组去 `title`（6 → 5）；`create_key` 派生去 `title`。
4. **读口**：`normalizeBrand` / `normalizeListingMineRow` 的 `title` 改派生（首行）；`name` 同源。
5. **迁移**：`0055`（回填 + 四自检）→ 提交 → Zang apply dev → 代码 push → 验收 → `0056`（DROP + 三自检）apply。
6. **前端**：删 `item-input-title` 控件与 `title` 载荷；描述框下加提示；卡面 / 列表标题吃服务端 `title` 键（已是 48 单位截断，若直接吃 `description` 必须先取首行）；编辑页字段集去 `title`、`draft` 库存输入只读。
7. **i18n**：新增提示键四语齐备（计数**现取**，别照抄册内数）；`item.title` 若失去全部消费点 ⇒ **留痕不删**。

---

## 9. 未测（`NOT_MEASURED` · 禁填 0 / 空）

- `0055` / `0056` **未落盘**；两库 **未 apply**（`schema_version` 仍 `0054`）；`42P01` 未复现、`23514` 一类库侧兜底未实测。
- 三口闸（`title` / `description`）**未实现**（`createListing` 现取仍收 `title`、`description` 仍可选）；读口派生**未实现**（现取 `title ← 列`）。
- 单描述框 / 提示行 / 派生显示链**未实现**；多行描述在卡面的几何（行高 / 卡高 / 溢出）**未取**；四语计数**未取**。
- route **#14–#21**、design **#36–#39** 共 **12 条判负一条未跑**；**零 HTTP / 零库写 / 零截图 / 零门套**。

---

## 10. 与既有条文的关系（不删旧字，只标取代）

| 旧条文 | 本批处置 |
|---|---|
| `data §40.8.1` / `§40.8`（`item_type`） | **不受影响**（列集只少 `title`；`item_type` 四值闭集不动） |
| `route §49.12.2`（字段模式含 `title`） | **`title` 项退役**；其余五字段口径不变 → 本批 §49.13.3 明写 |
| `route §49.12.4`（两者皆无 ⇒ `NO_EDITABLE_FIELD`） | **对空 body 仍有效**；含 `title` 键的形态摘出判 `NOT_SUPPORTED` |
| `route §49.12.6`（`mine` 行键 10） | **不变**（`title` 在、`description` 在） |
| `design §26.13.6`（编辑页预填 6 项含 `title`） | **6 项 → 5 项**（`description / price / stock / media_urls / item_type`）→ §26.13 补登行 |
| `design §26.13.6`/`route §49.12.2` 的 `draft` 改 `stock` 待裁项 | **结案 = 取 (b) UI 只读**（`DL60`），**不放宽后端** |
| `data §40.9 F`（派生不落库） | 与 `§40.8.1` 的「不猜补」同纪律：**不得**用 generated column / 触发器把显示口径冻进库面 |

---

**本笔**：只写 `docs/**` + `ops/title-merge/**`，`git diff --numstat` **删除列 = 0**，只 `add` 五件，**不 push**。

---

## 11. 并行实现单差额（只登记、不背书；逐条见 data §40.9 K）

| # | 差额 | 影响 | 处置 |
|---|---|---|---|
| 1 | 落盘文件名 = `0055_title_merge_into_description.sql` / `0056_drop_listing_title.sql`（册内只给约定名） | 无 | **以落盘为准** |
| 2 | **`0055` 无幂等守卫**（契约 B4）：`UPDATE … WHERE btrim(title) <> ''`，靠版本表「只 apply 一次」 | **★ 承重**：人工重放会**二次拼接**，且落盘自检臂**不会红**（并入判据与行数均仍成立） | **apply 前**可改文件加守卫（`AND NOT (description = title OR description LIKE title + 换行 + 任意)`）；**apply 后禁改**，只能 `0057` 补救 |
| 3 | `0055` 自检 ④ = 「行数 = PK 唯一行数」 | 近乎恒真、**无分辨力**（契约要求与预检值比对） | 登记；不改落盘 |
| 4 | `0056` 缺「`description` 仍 `NOT NULL`」断言（契约 E②） | 低（该迁移只 `DROP` 一列） | 登记；不改落盘 |
| 5 | `0055` 新增 `v_merged_ok` 逐行并入判据（契约未要求） | **更严** | 采纳 |
