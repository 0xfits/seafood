# SPEC-NOTE · 商品统一 Id（雪花 ＋ itemCode ＋ 地址用码）＋ 详情页精简

- **单号**：`JING-SPEC-ITEM-ID`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 写、零库写、零测试改动、不 push**；后端实现单（迁移 `0060` + 两列生成 + 四读口加键 + `:ref` 双形态）与前端实现单（详情页三项删除 + 编号换码 + 链接改码）**并行在跑**。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = e48c567`（**工作区非干净**：`frontend/**` 15 `M` + 3 `??`，属并行前端单；`backend-ts/**` 干净）
- **正典**：`docs/data-layer.spec.md` **§40.12**（v0.42 · 新迁移 + 新列 ⇒ 升版，头注不改写）+ `docs/route-layer.spec.md` **§49.16**（v2.44 · **加性续登、不升版**）+ `docs/design/design-system.spec.md` **§26.17**（加性续登、不升版）+ `docs/seafood.master-plan.md` **§5.444 / 版本行 v0.361**

## 1. Kevin 依据（三条）

> ① **商品详情页删除「数量」输入框**。
> ② **删除文案「闲置物品」与三段说明**：「购买金额由平台统一结算，无需填写价格或收款方。」/「购买金额以平台结算为准；重复点击不会重复扣款。」/「退款只退还款项，商品库存不会恢复。」
> ③ **商品 Id 统一**：**Snowflake 格式** + **`itemCode` 字母数字混合 7 位** + **页面地址用 `itemCode` 而非数字 id**。

**出处披露（诚实）**：三条转引自本单派单，**原始会话未入仓** ⇒ 不伪造逐字引语；与 Kevin 原话若有出入，以 Kevin 一句话为准。**实现口径**（迁移号 / 位划分 / 字母表 / 回填 / 键数 / 路由）亦由派单给定，本单**照抄不发明**。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.12 · `ID-1`…`ID-6`）

| 项 | 值 |
|---|---|
| 列 1 | `snowflake_id bigint NOT NULL` · `UNIQUE (listing_snowflake_id_key)` · **不是 PK**（PK 仍 `listing_id`） |
| 位划分 | **41 时间戳 + 10 实例 + 12 序列**（+1 符号位恒 0 ⇒ `bigint` 内恒正）；纪元常量 `SNOWFLAKE_EPOCH_MS` **提议 `1704067200000`**（2024-01-01Z）；`2^41` ms ≈ **69.68 年** ⇒ 可用至 **2093-09-06** |
| 实例位 | `SF_WORKER_ID`（env，`0..1023`，越界即启动失败）**优先**；**缺省进程随机一次**（serverless 无稳定主机号）；12 位序列亦随机起点 |
| 时钟回拨 | `≤5ms` 自旋；`>5ms` 抛错 ⇒ 5xx。**禁**「钉住上次时间戳」 |
| 唯一性 | **两层**：位划分（构造性）+ `UNIQUE` 与 **插入冲突重试 ≤5**（只有前者 = 靠概率） |
| 序列化 | `snowflake_id` **一律 string 出 JSON**（`2^53−1` 之下末位会静默失真） |
| 列 2 | `item_code char(7) NOT NULL` · `UNIQUE (listing_item_code_key)` · `CHECK listing_item_code_shape_ck` |
| 字母表 | **62 字符置乱序（冻结）**：`QdBCgP0GJhHeMYpI1kyjbvL6OSac8sN7AxrmiXEZzRF4tWu295Vow3UDKqflTn` |
| 形状（四条） | 恰 7 · **第 1 位 `[A-Za-z]`** · 第 2–7 位 `[A-Za-z0-9]` · **至少 1 位数字** |
| CHECK | `item_code ~ '^[A-Za-z][A-Za-z0-9]{6}$' AND item_code ~ '[0-9]'` |
| 码空间 | `52 × (62^6 − 52^6)` = **`1,925,540,547,840`**；生日碰撞：1e4 ≈ `2.6e-5` / 1e5 ≈ `2.6e-3` / 1e6 ≈ `0.26` |
| 回填 | 雪花：由 `time_created` 反推（**禁 `listing_id` 充数**，且须 ≤ 当前发号水位）；码：随机 + 查重 + **重试上限 5**，超限 `RAISE` ⇒ 整迁移回滚 |
| 幂等 | 迁移可重放（`ADD COLUMN IF NOT EXISTS` + `WHERE item_code IS NULL`）⇒ **码一旦下发不再变**（判负 `ID-N2`） |
| 写面 | 两列**客户端不可写**；`LISTING_EDIT_FIELDS` **仍 6 项**（加第 7 项即判负 `ID-N3`） |
| 迁移 | `0060_listing_item_id.sql`：加列（可空）→ 回填 → `SET NOT NULL` ×2 → 2 UNIQUE + 1 CHECK；**六项 `DO $$` 自检**；`schema_version` **0059 → 0060**；`listing` 列数 **15 → 17** |
| 顺序 | **先 apply 后 push**（读口先上线必 `42703` 500）；**无回滚路径**（`DROP COLUMN` 会让已发码全部失效 ⇒ 明账接受） |

### 2.2 接口面（route §49.16 · **零新注册点** · **零新错误码**）

| 项 | 值 |
|---|---|
| `:ref` 形态 A | `^[0-9]+$` ⇒ 按 `listing_id` 查（旧链接 / 内部调用） |
| `:ref` 形态 B | 其余一切 ⇒ 按 `item_code` **精确**查（大小写敏感，禁 `lower()` / `ILIKE`） |
| 判别子 | **首字符**（库级 CHECK 保证码首字符是字母 ⇒ 两形态互斥）；**一次判定、不查两遍** |
| 不合形 | **仍 404** + `details.reason = bID_not_found`（**零新 reason**）；**禁 400**；`ref_id` **原样回显** |
| 参数名 | `:bID` → `:ref`（**同一注册点**）；函数体内 `req.params.bID` 必须全改，漏一处 ⇒ 全表 404 |
| 副作用 | 仍走 `getPrizeDetailRecordingView`（每次成功读 +1；miss 不计；卖家自看也计）—— 语义逐字不变 |
| 写口 | **一律不收码**：`PATCH /api/listing/:listingId` · `POST …/buy` · 收藏 / 留言 · `GET /api/listing/:listingId/edit` 仍只认数字 id |
| 键数 | feed **48 → 50** · 详情 **50 → 52** · mine **11 → 13** · edit **11 → 13**；新键 = `item_code` + `snowflake_id`，**皆 string、恒在场、追加末位（零重排）**；`bID` 保留 |
| 页面路由 | `/item/<itemCode>` 规范形 · `/item/<数字>` 与 `/item?id=<数字>` **零重定向兼容** · 不合形走 miss 空态；链接 `item_code` 缺失 ⇒ 不可点、**禁回落数字 id** |
| canonical | 只出码形；**同一商品两个可达 URL 是有意的兼容代价**，本单**不做 canonical 合并**（另单） |
| 注册点 | **111 = 111**（get 50 / post 57 / put 0 / delete 3 / patch 1）；`p7b-03` `AC10-2` **不动** |
| 错误码 | **33 码闭集不动**；`AUTH_REASONS` 三值不动 |

### 2.3 界面面（design §26.17 · 三项删除 + 编号换码）

| # | 删什么 | 现取落点 |
|---|---|---|
| ① | **数量输入框** | `ItemDetailPage.jsx:496-506`（`item-input-qty` / `sf-item-qty-field` / `item.quantity`）；**库存行 `:495` 保留** |
| ② | **「闲置物品」标题** | `:510`（`h2.sf-item-title` + `t('item.line')`） |
| ③ | **三段说明** | `:511` `priceServerNote` · `:512` `buyNote` · `:513` `refundStockNote` ⇒ **连空壳 `.sf-item-meta-group`（`:508-514`）一起移除** |

- **购买语义**：`quantity` 恒 **`'1'`**（保留 state 位与 `listingBuyFingerprint` 入参位）⇒ 载荷 `{ quantity: '1', create_key }` **零变化**；同商品重复点击 = **同一 `create_key`** = 重复扣款被既有幂等吃掉 ⇒ **三段说明由行为替掉，不是顺手删文案**；**库存 >1 单次只买 1 件**（口径变更，登记）。
- **保留面**：库存行 / 描述 / 编号行（换码）/ 状态签 / 标签两级 / 计数 / 卖家行 / 底栏四件 / Web 两栏；**位置不重排**；**不碰 #51/#52 几何锚**（页面变短 ≠ 锚点变位）。
- **编号**：`物品编号 <itemCode>`，**去 `#`**；缺失显 `-`，**禁回落数字 id**；复用 `item.listingId` 标签 ⇒ **零新文案键**。
- **i18n**：**+0 / −0**；转死键 **3** = `item.quantity` / `item.priceServerNote` / `item.buyNote`（**不删键**，承 §26.8 体例）；`item.line`（`PublishItemPage:910` / `MarketPage:221`）与 `item.refundStockNote`（`MyOrdersPanel:132`）**仍活、禁删** ⇒ **top / flat / nodes 三项零变化，下游计数测试不动**。

## 3. 判负汇总（三册互不替代，质检各跑一遍）

| 册 | 编号 | 内容 |
|---|---|---|
| data | `ID-N1` | 双形态双命中（首字符非字母的码混进表） |
| data | `ID-N2` | 已下发码被重抽（`/item/<old>` 失效） |
| data | `ID-N3` | 客户端可写两列 / `LISTING_EDIT_FIELDS` 出现第 7 项 |
| data | `ID-N4` | 唯一性只靠概率（缺 UNIQUE 或缺重试 / 重试 >5 静默 200） |
| data | `ID-N5` | `snowflake_id` 出 `number` / 前端 `Number()` 回传 |
| route | **#42** | 双查（先 id 后 code）或双命中，或前后端各判一次形态 |
| route | **#43** | 旧形态被破（`GET /api/prize/<数字>` 200 → 404/400，或 `bID` 变） |
| route | **#44** | 键数不足 / 类型错 / 注册点 ≠ 111 |
| route | **#45** | 副作用走样（按码读不计数 / miss 计数 / 卖家自看不计） |
| route | **#46** | 页面地址仍用数字（或 `item_code` 缺失回落数字 id） |
| route | **#47** | 旧链接失效（`/item/<数字>` / `?id=` 空态）或对旧形态 301/302 |
| design | **#59** | 数量框回潮（含钩子 / 类名残留） |
| design | **#60** | 三段文案回潮（**含换皮**：tooltip / placeholder / 折叠 / 「限购 1 件」替代说明） |
| design | **#61** | 「闲置物品」标题回潮 / `.sf-item-meta-group` 复活 |
| design | **#62** | 编号仍数字（`#<listing_id>` / 与码不一致 / 回落 id） |
| design | **#63** | 购买载荷被连带改（缺 `quantity`/`create_key`、`quantity ≠ '1'`、指纹入参位被删） |

## 4. 现取读数（2026-10-20 · HEAD `e48c567`）

- 注册点 **111**（get 50 / post 57 / put 0 / delete 3 / patch 1）· 迁移末位 **0059**、**`0060` 不存在** · `grep -rn "item_code\|itemCode\|snowflake" backend-ts/src backend-ts/migrations frontend/src` = **0 命中** · `listing` 列数 **15** · feed **48** / 详情 **50** / mine **11** / edit **11** · 详情页现取仍有 `item-input-qty` 与 `.sf-item-meta-group`、编号行渲染 `#<listing_id>` · 前端路由 `item/:itemId`（`App.jsx:112`）。
- **工作区非干净（披露）**：`frontend/**` 15 `M` + 3 `??`（并行前端单）；`backend-ts/**` 干净 ⇒ 数字取自 HEAD 后端代码。

## 5. 未做 / 挂账

- **未做**：`0060` 未落盘、两库未 apply；两列 / 两约束 / CHECK / 自检未实测；回填与重试分支未跑；四读口未加键；`:ref` 双形态未实现；详情页三项删除未做；**判负一条未跑**；零 HTTP / 零库写 / 零代码。
- **挂账**：① 编辑页仍走数字 id（走码 ⇒ `GET /api/listing/:ref/edit` 需同步接受码，另单）；② canonical 合并（码形 ⇄ 数字形）另单；③ 雪花跨实例严格单调**不保证**（可见序以 `time_created` 为准）；④ 字母表若取「剔除易混字符」读法（`0/O/1/I/l` ⇒ 57 字符、码空间 ~`1.1e12`），只改字母表 + CHECK 字符类，`:ref` 判定不受影响。

## 6. 自证（本笔）

```
$ git diff --numstat -- docs/
110  0  docs/data-layer.spec.md
67   0  docs/design/design-system.spec.md
93   0  docs/route-layer.spec.md
21   0  docs/seafood.master-plan.md
# 删除列恒 0；master-plan 两处为「前插 §5.444」与「前插版本行 v0.361」，均为纯插入
```

- 只 add 五件（`docs/data-layer.spec.md` · `docs/route-layer.spec.md` · `docs/design/design-system.spec.md` · `docs/seafood.master-plan.md` · `ops/item-id/SPEC-NOTE.md`）；**不 push**；工作区其它改动（`frontend/**` 等）**一律未纳入**。

## 7. 同树现状披露（编制期后段现取 · 并行后端单已落盘、未提交）

> `git status` 现取 = `M backend-ts/src/database.ts`（+60/−7）· `?? backend-ts/migrations/0060_item_code_snowflake.sql`（269 行）· `?? backend-ts/src/item-id.ts`（174 行）· `ops/item-id/.probe*.ts` ×3（**该单探针，非本单产物**）。**两库未 apply · 未提交。**

| 契约（本单冻结） | 盘上 | 处置 |
|---|---|---|
| 字母表 base62 62 字符置乱 | **base56**（剔 `0/O/1/l/I`）：`23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz` | **本册收敛**：取「剔易混字形」读法（用户面主流义）；码空间 `56^7 ≈ 1.72e12`；迁移 `c_alphabet` 与 `ITEM_CODE_ALPHABET` 两处逐字同源 |
| 首字符字母 + 至少一位数字 | CHECK `^[0-9A-Za-z]{7}$`；纯数字码由生成侧 `+1` + 自检反断言禁止 | **收敛**：判别子改为「**码恒非纯数字**」，与 `^[0-9]+$` ⇒ id **等价互斥**；**但仅生成侧约定** ⇒ **待补**：CHECK 加 `AND item_code !~ '^[0-9]{7}$'` |
| 码 = 随机 | 确定性 `snowflake % 56^7 → ×1000003 % mod`，撞则 `+1`（上限 1000） | **收敛**：可复现、相邻不连号；**弱防枚举**（可逆，登记） |
| 唯一约束 ×2（`pg_constraint`） | **唯一索引** ×2（`listing_*_uidx`） | **收敛**：自检改读 `pg_indexes`（`indisunique = true`） |
| 冲突重试 ≤5 | 新建 **3**（`ITEM_ID_CREATE_ATTEMPTS`）/ 回填 **1000** | **收敛盘上值** |
| 实例位缺省随机 | `SNOWFLAKE_MACHINE_ID` 默认 **0** | **保留 + 建议**：部署每实例必配（serverless 建议随机），当前量级无风险 |
| （未覆盖）回填保 `time_updated` | 事务内 DISABLE → 回填 → ENABLE + 自检断言 `tgenabled='O'` | **盘上优于契约**，登记为补强 |
| 四读口 +2 键（feed 50 / 详情 52 / mine 13 / edit 13） | 四处 SELECT + 两处归一器已加；键类型 **`string \| null`** | **已落盘**（键恒在场、值允许 null）⇒ `#44` 判据收窄为「键在场 ∧ 非 `number`」 |
| `:ref` 双形态 | **未落**（仍 `:bID` + `parseInteger`） | **未闭环** —— 契约核心变更未实现 |

- **不受差额影响**：41+10+12 与纪元 `1704067200000`（逐字一致）· `snowflake_id` 字符串出 JSON · 两列 `NOT NULL` · 回填幂等 · 先 apply 后 push · `LISTING_EDIT_FIELDS` 6 项 · 零客户端写。
- **本文件与三册均不代该单声明上线**；行为验收只看判负清单。
