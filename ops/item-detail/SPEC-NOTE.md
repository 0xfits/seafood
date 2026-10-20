# SPEC-NOTE · 详情页改版（浏览计数 `view_count` ＋ 成色 `item_condition` ＋ H5/Web 双布局 ＋ 底部固定操作栏）

- **单号**：`JING-SPEC-ITEM-DETAIL`（Jing · 制度员）
- **性质**：**契约登记**（只写 `docs/**` + 本文件）。**零代码、零迁移文件、零 HTTP 写、零库写、零测试改动、不 push**；后端实现另单（迁移 `0057` + 加性键 + 写口闸）、前端实现另单（双布局改造）、质检另单。
- **编制时点**：2026-10-20 · 仓 `/Users/kevin/bistro/seafood` · 分支 `main` · 起点 `HEAD = c3e500a`（工作区干净）
- **正典**：`docs/data-layer.spec.md` **§40.10**（新 · 以本节 `v0.40` 为现行版读数，头注不改写）+ `docs/route-layer.spec.md` **§49.14**（新 · 同 v2.43 加性续登不升版）+ `docs/design/design-system.spec.md` **§26.15**（新 · 不升版）+ `docs/seafood.master-plan.md` **§5.441 / 版本行 v0.358**

## 1. Kevin 依据（两段 · 均为派单转引）

> **① 详情页改版指令**：【H5（≤767）】①第一行卖家信息（头像 + 掩码地址 + 信用胶囊）②第二行价格 + **核心标签** ③第三行**次要标签**（【包邮】【自动发货】等 item_type 派生）+ `x人想要` + `x人浏览` ④然后商品 desc ⑤然后商品图片 ⑥**底部固定操作栏**：【留言】【收藏（五角星图标）】【立即购买（黑字灰底胶囊）】【聊一聊（聊天图标 + 黑字黄底胶囊）】，**后两者靠右对齐**。【Web（≥768，闲鱼式两栏）】顶部卖家信息通栏（头像 + 名字 + 元信息行）；主体两栏：左 = 缩略图列 + 主图（轮播箭头）；右 = 价格行（橙红大价 + 行右端 `x人想要 x人浏览`）→ 标题 → 次要标签 → desc → 操作区（拼接胶囊：聊一聊黄｜立即购买黑 + 独立收藏胶囊）。【配套后端】迁移 `0057`：`listing.view_count bigint NOT NULL DEFAULT 0`；`GET /api/prize/:id` 每次读 **+1**（不区分访问者，卖家自看也计；**去重策略挂账**）并透出 **`views`**；「想要」= 既有 `wants`（listing_favorite 计数，与底栏收藏同源）；【聊一聊】【留言】走既有会话五口（POST /api/messages/conversations 等），未登录 ⇒ 登录提示；【收藏】= 既有收藏口 toggle。

> **② 同日三点追加**：**1）次要标签收敛**：仅【包邮】（黄）与【自动发货】（绿）两种标签；`DigitalManualDeliver` / `PhysicalBuyerShip` **无标签**（不是灰字，是彻底不渲染）。**2）新增成色字段** `item_condition`（四值闭集：`BrandNewSealed` 全新未拆封 / `LikeNew` 几乎全新 / `MinorWear` 细微磕碰划痕 / `HeavyWear` 严重磨损；数字商品不适用 = NULL；发布页仅实物分支显示成色四选一且必选；编辑页可改；与 view_count 同迁移 0057；详情键 +condition ⇒ 详情 49 键）。**3）核心标签 = 成色派生卖点标签**：第二行（H5）/ 右栏价格下（Web）显示当前成色的中文名标签（如【全新未拆封】）；未填成色（数字商品或历史 NULL）⇒ 核心标签区显示【平台结算】+ 状态类标签兜底，不空置。判负补：次要标签出现「不包邮/手动发货」字样 / 成色非四值 / 数字商品出现成色标签。**成色四值中文名逐字登记（Kevin 原文）**：全新未拆封 / 几乎全新 / 细微磕碰划痕 / 严重磨损。

**出处披露（诚实）**：两段均**转引自本单派单**，**原始会话未入仓** ⇒ 本单**不伪造逐字引语**；与 Kevin 原话若有出入，以 Kevin 一句话为准。

## 2. 冻结口径（按面拆）

### 2.1 数据面（data §40.10 · 迁移 `0057_listing_view_count_condition.sql` 双列）

| 项 | 值 |
|---|---|
| 列 ①（计数） | `public.listing.view_count` `bigint NOT NULL DEFAULT 0`（Kevin 逐字）；零 CHECK / 零索引 / 零回填（计数基线 = 上线时刻） |
| 列 ②（成色） | `public.listing.item_condition` `text` **可空** + 具名 `listing_item_condition_check` 四值 CHECK（NULL 放行 · 大小写敏感 · 零归一 · 零别名，承 `listing_item_type_check`（0053）同族）；NULL = 未填（数字商品不适用 / 存量不回填），禁猜补 |
| 迁移 | 两条 `ADD COLUMN IF NOT EXISTS` + 尾部 `DO $$` 自检（view_count 类型/非空/默认 0/非 0 行=0；item_condition 可空/四值在 CHECK/闭集外行=0/IS NOT NULL 行=0；`listing` 列数 = **15**）· 零 `BEGIN`/`COMMIT` · apply 由 Zang · **先 apply 后 push** |
| 闭环 | `schema_version` 0056 → **0057**；`listing` 列数 **13 → 15** |

### 2.2 接口面（route §49.14 · 零新路由 / 零新错误码）

| 项 | 值 |
|---|---|
| 自增 | `GET /api/prize/:bID` **路由 handler 成功路径**每次到达 origin 的成功读 +1（**禁服务层**：`getBrandById`/`getPrizeById` 多消费点 ≥10 处现取）；不区分访问者、卖家自看也计；404 miss 不计；**fail-open**（计数写失败不得拖挂详情响应）；单语句 `UPDATE … SET view_count = view_count + 1`；响应 `views` = **计入后**值（首读 = 1） |
| 详情键 | **47 → 49**：+`views`（number）＋ +`condition`（四字面或 null，**响应键名 = `condition`**（Kevin 逐字）、列名 = `item_condition`） |
| feed | **48 不变**（两键均不加） |
| mine | **10 → 11**（+`condition`；编辑页预填唯一取数源 `PublishItemPage.jsx:268` 现取） |
| 写口 | `item_condition` 三口：`POST /api/listing` 可选（未传/null ⇒ NULL；`''`/闭集外/非字符串 ⇒ 400 借 `LEDGER_AMOUNT_INVALID` + `NOT_IN_CLOSED_SET`，闸在 `currencyGate` 前）· `PATCH /api/listing/:listingId` 字段模式（**第 6 可改字段**）· 旧编辑口 `POST /api/listing/:id` 同收同闸；**不进幂等指纹 / 不进翻译链** |
| 必选闸 | 发布页**实物分支**成色四选一必选 = **前端闸**（`onSubmit` 最前、零请求、组 `aria-invalid`）；服务端不强绑「实物 ⇒ 必填」（挂账、一句话可改） |
| 判负 | **#22–#28**（缺键 / 自增未生效 / feed 混入 / 注册点 ≠110 / fail-open 破 / 服务层计数或进指纹 / 写口闸缺失） |

### 2.3 设计面（design §26.15）

| 项 | 值 |
|---|---|
| H5 四段 | ①卖家信息行（头像 + 掩码地址 + 信用胶囊，承 `seller.*`）②价格 + **核心标签 = 成色卖点签**（四值 ⇒ 中文名标签；NULL ⇒ **【平台结算】+ 状态类兜底，不空置**）③次要标签（**收敛两枚**：包邮黄 `--sf-btna-bg` / 自动发货绿 `#4ADE80`；`DigitalManualDeliver`/`PhysicalBuyerShip`/NULL **彻底不渲染**）+ `x人想要`（**无承载不渲染**，挂账）+ `x人浏览`（`views`）④desc ⑤图片；行序冻结（判负 #43） |
| H5 底栏 | 四件 = 留言｜收藏★ ‖ **立即购买（黑字灰底）· 聊一聊（聊天图标 + 黑字黄底）**，**后两者靠右**；`position: fixed` 独占底部（既有 `.sf-item-actionbar` ≤767 机制）+ safe-area；黄底黑字 = `--sf-btna-bg/fg`、灰底 = `--sf-btnalt-*` 候选（零新 token）；**取代 §24 T120 三段形态**（旧条文保留、以本节为准） |
| 行为映射 | 聊一聊/留言 → 既有会话五口（本站无留言板载体 ⇒ 两钮同走 listing 会话口）；未登录 ⇒ 登录提示；收藏 → 既有 toggle（`fav-toggle` 语义保留）；立即购买 → 渲染契约本节冻结、业务面 = 既有 `/api/listing-orders` 家族（不新开写口）；卖家本人聊一聊不渲染 |
| Web 两栏 | 顶部卖家通栏（头像 + 名字 + 元信息行）；左 = 缩略图列 + 主图（轮播箭头）；右 = 价格行（橙红 `#FF4D00` + 行右端 `x人想要 x人浏览`）→ 核心签（价格下）→ 标题 → 次要签 → desc → 操作区（拼接胶囊聊一聊黄｜立即购买黑 + 独立收藏胶囊）；两档差异一律 CSS 767 断点、**禁 JS 宽度读数** |
| 判负 | **#40–#50**（Kevin 四条置前：浏览数不自增 / 底栏非固定 / 后两者未右对齐 / H5 缺四行顺序；另：标签混位 / 两栏缺失互换 / 无承载渲染 / 底栏缺件分组错 / 「不包邮·手动发货」字样 / 成色非四值 / 数字商品出现成色标签或兜底区空置） |

## 3. 现取读数（2026-10-20 · HEAD `c3e500a` · 工作区干净）

- 注册点 **110**（get 49 / post 57 / put 0 / delete 3 / patch 1）；迁移末位 **`0056`**；`listing` 列数 **13**；`listing.status` 闭集 = `draft/listed/delisted/frozen`（`0015:137`）；PATCH 可改字段现取 **5 项**；mine **10 键**。
- **详情口实测**：`GET /api/prize/1`（dev 5788 · 只读一次）= 200 · `data` **47 键** · 无 `views`/`wants`/`condition` · 有 `seller`；feed 行 **48 键**（逐键对拍差集恰 `wants`）。
- i18n 四语 top **130** / flat **1129** / nodes **4516**（四语键集逐文件相同）；`item.buy`/`item.chat`/`item.favorite`/`item.favorited`/`rewardCard.wants` 在册；**「留言」「x人浏览」「平台结算」与成色四值中文名均无键**（实现单同批四语同补 + 计数断言按现取复算前推；建议键名 = `item.message` / `item.views` / `item.platformSettled` / `itemCondition.brandNewSealed|likeNew|minorWear|heavyWear`，成色四词逐字入键值）。
- 详情页现役底栏 = T120 三段（聊一聊 58%｜立即购买 42% 组合条 + 收藏独立胶囊；钩子 `item-actionbar`/`item-chat-btn`/`item-buy-btn`/`fav-toggle`）；详情口缓存头 = `setPublicCache`（`public, s-maxage=30, swr=300`，`index.ts:202-204`）。

## 4. 挂账两条（本笔不定案）

1. **浏览去重策略**：本笔零去重（刷新即再计、爬虫也计）；per-visitor 去重方向已登记（data §40.10.3），须 Kevin 拍板后另立契约。
2. **「x人想要」详情承载**：详情响应无 `wants`（键面 49 不含）⇒ 该槽无承载不渲染；要渲染 = Kevin 一句话加键（⇒ 详情 50 键，推荐 feed 同法 LEFT JOIN + COALESCE）。

另登记两处**缓存/服务端**挂账：① 详情缓存头是否因计数改 `no-store`/`private`（CDN 命中不计 ⇒ 计数为下界；实现单禁顺手改）；② 服务端是否强绑「实物 ⇒ 成色必填」（现契约为前端闸）。

## 5. 本笔边界

- **零代码 / 零迁移 / 零测试改动 / 零 HTTP 写 / 零库写**（本笔唯一 HTTP = §3 两条只读 GET）；判负 route 7 条 + design 11 条**一条未跑**；门套未跑（零源码改动，`build`/`test:unit` 无涉）。
- **纯追加删行 0**：`git diff --numstat` 删除列 = 0（master-plan 两处前插均为整行插入、无删改行）。
- `commit` 只 add 五件：`docs/data-layer.spec.md` / `docs/route-layer.spec.md` / `docs/design/design-system.spec.md` / `docs/seafood.master-plan.md` / `ops/item-detail/SPEC-NOTE.md`；**不 push**（编制起点 `HEAD = c3e500a`）。
