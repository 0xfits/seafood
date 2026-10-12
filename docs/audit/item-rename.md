# 收尾单审计 · reward/listing → item 改名单与合并（Kong · 2026-10-11）

> 范围：`frontend/**` + 本文件（只新建，未改既有 `docs/**`）。HEAD 基线 `026b81a`（未 push）。
> 本单是**收尾**：改名/合并的源码上轮已写完，本轮只做 ① 修 2 个红测 ② 全仓扫通配路径注释坑 ③ 分阶段提交 ④ 门套转绿。

---

## ① 路由改动清单（`frontend/src/App.jsx` · LangShell 内层 `<Routes>`）

**硬删 4 条旧路由（不 301）**
| 旧路由 | 目标页（已删/已改名） |
|---|---|
| `reward` | `RewardPage`（页删除） |
| `listing` | `ListingsPage`（页删除） |
| `listing/new` | `PublishListingPage`（改名 `PublishItemPage`） |
| `listing/:listingId` | `ListingDetailPage`（改名 `ItemDetailPage`） |

**新增 3 条路由**
| 新路由 | 元素 | 口径 |
|---|---|---|
| `item/new` | `PublishItemPage` | 发布（原 `listing/new`） |
| `item/:itemId` | `ItemDetailPage` | 详情（原 `listing/:listingId`） |
| `item`（无段） | `ItemDetailPage` | **同路由 `?id=` 兼容** |

- **`?id=` 兼容**：`ItemDetailPage` 取 `id = useParams().itemId || new URLSearchParams(location.search).get('id') || ''`（`ItemDetailPage.jsx:44-46`）——同一组件两处挂载（`item/:itemId` 与 `item`）。
- **无 id 跳首页**：两处都无 id ⇒ 组件内 `<Navigate to={root('/')} replace/>`（`ItemDetailPage.jsx:61-64`，**带当前语言前缀**，Kevin 口径「一句话可改」）。
- **静态段优先**：`item/new` 优先于 `item/:itemId`（react-router v6 排名），`/item/new` 不会被 `:itemId` 吃掉。

---

## ② 重命名清单（`git mv` 逐条）

| 旧路径 | 新路径 | git 状态 |
|---|---|---|
| `src/pages/listings/ListingDetailPage.jsx` | `src/pages/item/ItemDetailPage.jsx` | `RM`（改名 + 内容改） |
| `src/pages/listings/PublishListingPage.jsx` | `src/pages/item/PublishItemPage.jsx` | `RM` |
| `src/pages/listings/listing-api.js` | `src/pages/item/item-api.js` | `R`（纯改名） |
| `src/pages/listings/listings.css` | `src/pages/item/item.css` | `RM` |
| —（新建） | `src/pages/item/MyOrdersPanel.jsx` | `??`（从 `ListingsPage` 侧栏三面板抽出，本单新增文件） |

**删除**：`src/pages/listings/ListingsPage.jsx`（列表并入首页）、`src/pages/RewardPage.jsx`（能力并入首页）。
后端面一字不动：`/api/prize/*`、`/api/listing*`、`/api/listing-orders/*` 路径名不变（本单只改前端路由与文件命名）。

---

## ③ 原 `ListingsPage` 能力 → 新落点 **零丢失**映射表

| 原 `ListingsPage` 能力 | 原控件钩子 | 新落点（HomePage 首页 = 唯一列表） | 判据 |
|---|---|---|---|
| 商品 feed 列表（`GET /api/prize/all`，卡片 + 缩略图 + 价格 + 状态标签 + 「翻译中」小标） | `listing-grid` / `listing-card` / `listing-thumb` | 首页 `home-items` 区 `RewardCard` 网格（`/api/prize/all?limit=8`，同源读口） | 同一读口 `/api/prize/all`；`listing-market.test` 已改锚断言首页取 `/api/prize/all` |
| 「发布」入口 | `listing-publish-link` → `/listing/new` | 首页 hero `home-publish-link` → `/item/new` | `fix-nav-langshell.test:119` 断言 `[data-sf-m="home-publish-link"]` 的 href 带语言前缀 |
| 「我的订单」整块（列表 + 退款 + 发货 + 收货 + 空态） | `listing-orders` / `listing-refund` / `listing-ship-btn` / `listing-receive-btn` / `listing-orders-empty` … | `src/pages/item/MyOrdersPanel.jsx`（首页 `home-my-orders`），**全部原钩子逐字保留** | `MyOrdersPanel` 内 `data-sf-m` 与原侧栏**逐条同名**（`listing-orders` 等） |
| 退款（`POST /api/listing-orders/:orderId/refund`，键服务端派生） | `listing-refund-btn` | `MyOrdersPanel` 同钩子 | 测试 `listing-market.test:120` 断言路径与「不传键」 |
| 发货 / 收货（`POST …/:id/ship` \| `/receive`） | `listing-ship-btn` / `listing-receive-btn` | `MyOrdersPanel` 同钩子 | 同上 |
| 订单行键 `gID`=order_id（`/api/prize-item` 买家轴） | `listing-order` | 首页「我的订单」`MyOrdersPanel`（`HomePage.jsx:337`） | 消费面一致 |
| 分类筛选（原 `RewardPage`：限量版/高价值/已兑换） | — | 首页 `home-item-filter`（role=tablist，四档：all/limited/highValue/claimed） | 见 ④ |
| 「我的积分」展示 | — | 首页 `home-my-points`（登录后渲染，`/api/user/asset/:uID`） | 并入自 `RewardPage` |

**形态 delta（登记，非能力丢失）**：
- 原 feed 顶部「手动刷新」按钮（`listing-refresh` → `loadFeed`）在首页**无独立按钮**；**数据获取路径等价**（`useEffect` 在 mount/路由变化时重取同一 `/api/prize/all`），重生入口 = 路由重载。能力面等价，控件形态有 delta。
- 卡片动作语义由「领取」改为「查看详情」（`item.viewDetail`）：原 `/reward` 已硬删，`RewardCard` 新增可选 `actionLabelKey`（不传则行为与旧版逐字不变，`r9-93`/`i18n-batch-b2` 裸渲染用例不受影响）。

---

## ④ 三档筛选的**实测判据**（**客户端侧筛**，依据已取回字段）

数据面（**现取** Live，backend `127.0.0.1:5788`）：

1. **`GET /api/prize/all?limit=N`** → wrapper `{success, message, data}`，`data` = 行数组（**现取实测 44 键/行**）。
   与本单筛选相关的字段：`bID`、`name`(+`name_en/hk/vn`)、`points`、`gift_limit`、`time_end`、`time_start`、`stores_count`、`claims_count`、`available_quantity`、`i18n_status`、`image_url`、`url_image`。
   **行内无 `status` 字段**（实测行键集不含 `status`）⇒ 列表缺省口径 = `listed`（列表状态标签缺省值）。
2. **`GET /api/prize-item`**（`index.ts:880` → `DatabaseService.listPrizeItemsByUser`，买家轴 `listing_order`）。
   未带鉴权**现取 = HTTP 401 `AUTH_UNAUTHORIZED`**（fail-loud）；鉴权后返回买家轴订单行，**消费面仅 `bID`**（`HomePage.jsx:127`：`claimed_prize_ids = rows.map(r => r.bID)`）。

**三档判据（客户端侧筛，依据已取回字段；`HomePage.jsx:187-198`）**：

| 档 | 判据 | 依据字段（来源） |
|---|---|---|
| 限量版 `limited` | `Boolean(row.gift_limit \|\| row.time_end)` | 均由 `/api/prize/all` 已取回 |
| 高价值 `highValue` | `row.rarity === 'epic'`，`rarity: points > 5000 ? 'epic' : points > 2000 ? 'rare' : 'common'`（阈值 >5000 承 `RewardPage`） | `row.points`（`/api/prize/all`） |
| 已兑换 `claimed` | `row.status === 'claimed'`；`status = isClaimed ? 'claimed' : …`，`isClaimed = claimed_prize_ids.has(row.bID)` | 集合来自 `/api/prize-item`（已取回） |

四档按钮计数随数据面**实时派生**（`FILTERS`），三档**均可筛**（非「永远筛不动」控件）。**筛在客户端**，不新增读口、不改后端。

---

## ⑤ i18n 删/改/留表 + 四语新基线

**新基线（四语一致，逐语同值）**：**顶层 127 / 拍平 1053 / 四语节点 1053 × 4 = 4212**（audit 脚本现取：`作用域命中节点数 = 4212（键 1053 × 语 4）`）。

| 分类 | 数量/语 | 内容 |
|---|---|---|
| **删** | 22 键 | `rewardPage.*` 非迁移键 22 个（`title`/`subtitle`/`progress`/`taskInfo`/`taskNumber`/`highValue`/`limitedEdition`/`noNote`/`pointsAvailable`/`redeemNotOpen`/`rewardOutOfStock`/`alreadyInGiftRecord`/`backToList`/`detailTitle`/`emptyAvailable(+Hint)`/`emptyClaimed(+Hint)`/`emptyHighValue(+Hint)`/`emptyLimited(+Hint)`） |
| **改（改名键）** | 42 键 | `listings.* → item.*`（41 键逐名迁移，含 `statusLabel.{draft,listed,delisted,frozen,unknown}`）+ `rewardPage.myPoints → item.myPoints`（1） |
| **新增** | 5 键 | `item.filterAll` / `item.filterLimited` / `item.filterHighValue` / `item.filterClaimed` / `item.viewDetail` |
| **留（值不变）** | 其余 | **含获准保留的 claim 键**：`common.claimReward`（领取奖励）、`claimRewardModal.*`（如 `claimRewardModal.lore`）、`rewardCard.claimNow`（立即领取）——三者仍被 `TaskPage.jsx:141` / `ClaimRewardModal.jsx:57,83` / `RewardCard.jsx:167` 消费，删则渲染裸键名，故保留（已批准口径①）。 |

顶层键集变化：删顶层 `listings`、`rewardPage` 两族；新增顶层 `item` ⇒ **顶层 128 ⇒ 127**。等量下移：拍平 1070 ⇒ 1053（−17/语）⇒ 节点 4280 ⇒ 4212。

---

## ⑥ 可达性入口清单与「差集 = 0」结论

**站内入口 → 目标路由**（全部带语言前缀或走唯一构造器 `buildLocalizedPath`）：

| 入口（文件） | 目标 | 已注册？ |
|---|---|---|
| `shell/nav.js` 底栏五项：home / shard / sell / messages / profile | `index` / `exchange` / `item/new` / `messages` / `profile` | ✔ 全部注册 |
| `shell/FloatingMenu.jsx`：sell / messages | `/item/new` / `/messages` | ✔ |
| `components/Header.jsx` menuItems：task / exchange / admin / profile | `task` / `exchange` / `admin/*` / `profile` | ✔（已删「社区奖励」`reward` 项） |
| `pages/HomePage.jsx`：hero 发布 / 任务 / 卡片动作 | `/item/new` / `/task` / `/item/:id`（navigate） | ✔ |
| `pages/market/MarketPage.jsx`：`item.line` / `item.publish` | `/` / `/item/new` | ✔（原 `/listing`、`/listing/new` 已改） |
| `pages/item/ItemDetailPage.jsx`：`item.list` / 无 id 兜底 | `/`（`root('/')`） | ✔ |
| `pages/item/PublishItemPage.jsx`：上架成功 / goto-feed | `/item/:id`（带前缀）/ `/` | ✔ |

**差集 = 0**：全仓 `src/**`（除 `test/`、`locales/`）内**再无**指向 `/reward` 或 `/listing*` 的站内路由引用；命中的 `App.jsx:288 path="rewards"`（管理后台 `RewardManagement`）、`App.jsx:300 path="listing-review"`（管理审核页）为**管理后台既有路由**，与旧用户面路由无关；`utils.js:63` 的 `'/reward'` 是 JSDoc 举例字面（非路由引用，未改）。

---

## ⑦ 两红真因与修法

**红① `src/test/unit/i18n-violation-closeout.test.jsx:86`（计数锚）**
- 真因：审计脚本 `scripts/p4z-i18nviol-global.mjs` 现取 `作用域命中节点数 = 4212`（顶层 127 / 拍平 1053 × 4），而断言的期望值仍是上单旧值 `4280`（拍平 1070 ⇒ 4×1070）。改名批删 22/加 5 键 ⇒ 等量下移 −17/语。
- 修法：**只改数**（`4280` → `4212`），**不动断言形状**；补一行留痕注释（顶层 128⇒127 / 拍平 1070⇒1053 / 节点 4280⇒4212）。
- 读数：修前 `作用域命中节点数 = 4280` 断言 ✗（实报 4212）；修后 ✗→✓。

**红② `src/test/unit/p7e-tails-beta.test.jsx:104`（unknown-status 兜底锚）**
- 真因：改名单把 locale 键族 `listings.statusLabel.*` 整体迁到 `item.statusLabel.*`，`en.listings` 顶层键**已删除** ⇒ `TABLES.en.listings.statusLabel.unknown` 求值为 `undefined` ⇒ `expect(noteText()).toContain(undefined)` 恒假。组件 `ItemDetailPage.jsx:92` 已正确用 `t('item.statusLabel.unknown')`（**组件侧无缺陷**）。
- 同类漏网：本文件第 92 行（known-status）已改锚 `item.statusLabel.draft`，**仅第 104 行**（unknown 兜底）遗漏。
- 修法：改锚 `TABLES.en.listings.statusLabel.unknown` → `TABLES.en.item.statusLabel.unknown`；**判负断言 `not.toContain('sunset-value')` 与 `title`/`data-sf-status` 原值断言逐条保留**（未放宽）。
- 读数：修前 `1 failed | 7 passed (8)`；修后 `8 passed`。

---

## ⑧ 通配路径注释坑 · 全仓扫描结果（可复用纪律）

**机制**：审计/测试脚本的块注释剥离器用 `raw.replace(/\/\*[\s\S]*?\*\//g, '')`（非贪婪、**不识别行注释**）。若一行 `//` 注释里出现 `/*` 子序列（如 `/api/x/*`、`pages/**`、`dist/*.css`、`/:lang?/*`），剥离器会把它当**块注释起点**，与本文件**后面最近的 `*/`** 就近配对 ⇒ **静默吞掉中间全部代码**。

**实测损害（修前）**：`src/App.jsx:16` 的 `（/api/job[/*]）` 与 `第 76 行 JSX 注释的 `*/` 配对 ⇒ **吞掉 `App.jsx:16–76`（≈2.8KB，含全部路由定义与 import）**；另有 5 个脚本脚本头注释同类误杀。

**扫描命中：18 个文件 / 27 处**（`grep` 现取 `/*` 位于 `//` 注释内；含 `src` + `scripts`）：

| 文件 | 行 | 处置 |
|---|---|---|
| `src/App.jsx` | 16（×2）, 54（×2）, 55 | 改 `/…`、`/<path>`、`/<id>` |
| `src/components/auth/WalletAuthPanel.jsx` | 10 | `locales/<lang>.json` |
| `src/test/unit/p4z-feperf.test.js` | 18, 29 | `dist/assets/<name>.css`、`src/…` |
| `src/test/unit/lang-path-redirect.test.jsx` | 184 | `/:lang?/<path>` |
| `src/test/unit/i18n-violation-closeout.test.jsx` | 151 | `locales/<lang>.json` |
| `scripts/p4z-b4c-geometry.mjs` | 4 | `http://sf.local/…` |
| `scripts/p4z-b4cii-geometry.mjs` | 5, 89 | `/…`、`/api/…` |
| `scripts/p4z-b4ciib-geometry.mjs` | 5, 121 | 同上 |
| `scripts/p4z-b4ciic-geometry.mjs` | 5, 123 | 同上 |
| `scripts/p4z-b4ciic-locales.mjs` | 3 | `locales/<lang>.json` |
| `scripts/p4z-i18nb{1,2,3,4a,4b,5}-cjk.mjs` | 36/37/39/42/58/72 | 状态机字面量改 `'/'+'*'（块注释起始）` |
| `scripts/p4z-i18nviol-global.mjs` | 210（×3） | `pages/…`、`components/…`、`shell/…` |

**修后复扫 = 0**（`/*` 位于 `//` 注释内 = 0；会「偷 `*/`」的块注释 = 0）。**只改注释写法，未改剥离逻辑**（超本单范围）。

**可复用纪律（写入本单）**：
> **注释里不得写以 `/*` 结尾的通配路径。** 任何 `//` 行注释中出现 `/*` 子序列（`/api/x/*`、`pages/**`、`dist/*.css`、`/:lang?/*`…）都会被块注释剥离器的 `/\*[\s\S]*?\*\//g` 当成块注释起点，与本文件后面最近的 `*/` 就近配对，**静默吞掉中间代码**。
> 写法：通配路径用 `/…` 或 `/<x>`（如 `/api/prize/…`、`/item/<id>`、`pages/…`）；需要写「块注释起始」字面时用 `'/'+'*'`。

---

## ⑨ 门套读数

| 项目 | 读数 |
|---|---|
| `npm run test:unit`（收尾前，含 2 红） | 51 files（2 failed）/ 488 tests（2 failed） |
| `npm run test:unit`（收尾后） | **51 files passed / 488 tests passed / 0 failed**（= 基线，未降低） |
| `npm run build` | **exit 0**（`vite build`，✓ built in 1.77s） |
| `tsc` | **N/A**（前端无 `tsconfig`） |

---

## ⑩ NOT_MEASURED

- **`/api/prize-item` 鉴权后行字段全集**：未带鉴权现取 = 401（fail-loud）；本单未持有有效 token，**未登录态实测**其行内字段（`claims_count`/`stores_count`/`status` 等）。消费面仅取 `bID`（已实测路径与字段名），字段全集 = `NOT_MEASURED`。
- **`/api/home` 聚合读口字段**：首页主路径走 `/api/home`（回落才逐口读）；本单只实测了回落路径的逐口读面（`/api/prize/all`、`/api/prize-item`），聚合读口字段 = `NOT_MEASURED`。
- **真机几何/渲染验收**（三档筛选的视觉结果、底栏/悬浮菜单桌面真机形态）：未跑 Playwright 几何探针 = `NOT_MEASURED`（服务只读、未启停）。
- **`utils.js:63` JSDoc 举例 `'/reward'`**：为文档举例字面（非路由引用），本单未改，登记为已知陈旧示例。

---

# 收尾单（第二轮）追写 · 三张清单 + 新基线 + 路由数 + 已裁口径（Kong · 2026-10-12）

> 范围：`frontend/**` + 本文件（只动本文件；未动其它 `docs/**`）。HEAD 基线 = `d2ad4ef`（上轮 `b675226`/`3633e07`/`d2ad4ef` 均已入库未 push）。
> 本轮四件：① 主题图标两处同源按 `T41` 统一 ② 补跑 `npm run build` ③ 追写本三张清单 + 新基线 + 路由数 ④ 登记 `/item/999999` 已裁口径。**未启停/未重启任何既有服务**（5787/5788/5800 全程只读）；几何对照用的一次性实例（父版 `69857c4`）按**精确 PID** kill + `git worktree remove`，用后 `git status` 回基线。

---

## ⑪ 11 个死键 · 逐个「非测试消费点 = 0」复核证据

口径：消费点 = `src/**` 内（**排除 `src/test/` 与 `src/locales/`**）对该键的**引用**（`t(...)` / i18n 取值）；同时核对四语 locale 中该键**已删（ABSENT）**。

| # | 死键 | 非测试消费点 | 四语 locale（zh/en/hk/vn） | 复核证据 |
|---|---|---|---|---|
| 1 | `reward`（顶层） | **0** | 四语均 ABSENT | 裸词 `reward` 在 `src/**`（非测试）现取 119 处命中，**逐条为**：变量名（`reward.status`/`reward.name`，`RewardsManagement.jsx`/`RewardCard.jsx`）、**别的键**（`jobs.reward`、`adminRewards.*`、`common.claimedUnit`）、注释与 JSDoc；**`t('reward')` = 0**（`grep -nE "\bt\(\s*['"\`]reward['"\`]"` = 空，exit 1） |
| 2 | `rewardsList` | **0** | 四语 ABSENT | `\brewardsList\b` 现取 = 0 |
| 3 | `tasksToClaimReward` | **0** | 四语 ABSENT | `\btasksToClaimReward\b` = 0 |
| 4 | `chooseReward` | **0** | 四语 ABSENT | `\bchooseReward\b` = 0 |
| 5 | `confirmChooseReward` | **0** | 四语 ABSENT | `\bconfirmChooseReward\b` = 0 |
| 6 | `successClaimReward` | **0** | 四语 ABSENT | `\bsuccessClaimReward\b` = 0 |
| 7 | `common.loadingRewards` | **0** | 四语 ABSENT | `\bloadingRewards\b` = 0 |
| 8 | `homePage.noRewards` | **0** | 四语 ABSENT | `\bnoRewards\b` = 0 |
| 9 | `homePage.rewardAlreadyClaimed` | **0** | 四语 ABSENT | `\brewardAlreadyClaimed\b` = 0 |
| 10 | `homePage.rewardOutOfStock` | **0** | 四语 ABSENT | `\brewardOutOfStock\b` = 0 |
| 11 | `claimRewardModal.loadProgressFailed` | **0** | 四语 ABSENT | `\bloadProgressFailed\b` = 0 |

**结论**：11 键**非测试消费点逐条 = 0** 且**四语 locale 逐条 ABSENT** ⇒ 删除**不改任何活体渲染**（无裸键名风险）。**保留**的 claim 键（`common.claimReward` / `claimRewardModal.*` / `rewardCard.claimNow`）另有活体消费点（`TaskPage.jsx` / `ClaimRewardModal.jsx` / `RewardCard.jsx`），**不属本清单**。

---

## ⑫ 标识改名映射（`F10`）+ 几何零变化对照读数

**改名映射（`sf-listings*` → `sf-item*`）**：

| 项 | 改前 | 改后（现取，HEAD `d2ad4ef`） |
|---|---|---|
| `sf-listings` / `sf-item` 出现 | — | `sf-item` 现取 **162** 处 = `src` **144**（含 `src/test` 13）+ `scripts` **18** |
| 唯一类（`sf-item*`） | 32 | **33**（含既有 `sf-item-orders`；33 类：`sf-item` `sf-item-actions` `sf-item-btn` `sf-item-card` `sf-item-card-title` `sf-item-empty` `sf-item-err` `sf-item-field` `sf-item-field-wide` `sf-item-form` `sf-item-grid` `sf-item-head` `sf-item-input` `sf-item-item` `sf-item-item-title` `sf-item-label` `sf-item-link` `sf-item-meta` `sf-item-note` `sf-item-ok` `sf-item-orders` `sf-item-panel` `sf-item-price` `sf-item-price-cur` `sf-item-price-num` `sf-item-price-unit` `sf-item-row` `sf-item-select` `sf-item-status` `sf-item-tag` `sf-item-textarea` `sf-item-thumb` `sf-item-title`） |
| 残留 `sf-listings` | — | **0**（`grep -rn "sf-listings" src/ scripts/` = 0） |

**改名映射（`data-sf-m="listing-*"` → `data-sf-m="item-*"`）**：

| 项 | 读数 |
|---|---|
| `data-sf-m="item-*"` 现取出现 | **100** 处 |
| 唯一钩子数 | **43** |
| 残留 `data-sf-m="listing-` | **0** |

**改名性质**：阶段2 提交 `3633e07` `--numstat` = **218 增 / 218 删**（逐 token 同名换前缀，**零新增语义**；`item.css` 选择器与 JSX class/钩子逐条 1:1）。

**几何零变化对照读数（`/item/1` · 8 关键词元素 × 390/1440 = 16 值）**：父版 = `git worktree add --detach 69857c4`（`node_modules` 软链 + 独立 `cacheDir` + 独立端口 5790）；改后 = 现 dev `5787`。同后端（5788）现取。读数（`[x, y, w, h]`，`getBoundingClientRect`，四舍五入 2 位）：

| # | 元素（改后选择器） | 改前选择器（`69857c4`） | 390 改前 = 改后 | 1440 改前 = 改后 |
|---|---|---|---|---|
| 1 | `[data-sf-m="item-detail-layout"]` | `listing-detail-layout` | `[10, 73, 370, 745.5]` | `[20, 65, 1400, 606]` |
| 2 | `[data-sf-m="item-detail-hero"]` | `listing-detail-hero` | `[10, 81, 306, 98]` | `[20, 73, 1062, 91.5]` |
| 3 | `[data-sf-m="item-detail-hero"] h1` | 同（hero h1） | `[10, 81, 306, 24]` | `[20, 73, 1062, 24]` |
| 4 | `.sf-item-actions` | `.sf-listings-actions` | `[10, 135, 306, 44]` | `[20, 127, 1062, 37.5]` |
| 5 | `[data-sf-m="item-detail"]` | `listing-detail` | `[10, 188, 306, 273.5]` | `[20, 173.5, 1062, 273.5]` |
| 6 | `[data-sf-m="item-detail-thumb"]` | `listing-detail-thumb` | `[25, 201, 276, 150]` | `[35, 186.5, 1032, 150]` |
| 7 | `[data-sf-m="item-buy-form"]` | `listing-buy-form` | `[10, 470.5, 306, 202]` | `[20, 456, 1062, 189]` |
| 8 | `.sf-item-row` | `.sf-listings-row` | `[25, 615.5, 276, 44]` | `[35, 594.5, 1032, 37.5]` |

**结论**：16 值**逐值改前 = 改后**（同一数据态 `/item/1` 渲染 `phase='ok'`）⇒ **几何零变化**成立。

---

## ⑬ catch-all 与主题图标 改前/改后

**（a）catch-all 提示页（`T91`）**

| 项 | 改前 | 改后 |
|---|---|---|
| 内层 `<Routes>` 末位 | 无 `<Route path="*">`（旧路径落外层 `/*` 兜底 ⇒ **空白 main**） | `<Route path="*" element={<NotFoundPage />} />`（`App.jsx:145`，内层末位；外层 `LangShell` 的 `/*` 机制**一字未动**） |
| 页面 | — | 新增 `src/pages/NotFoundPage.jsx`（`data-sf-m="not-found-page"` / `not-found-title` / `not-found-desc` / `not-found-home`；骨架沿用既有 `.sf-layout`/`.sf-panel-title`/`.sf-btn`） |
| i18n | — | 新增 `notFound.title` / `notFound.description` / `notFound.backHome`（**四语同集**；非 zh 登记「待复核」） |
| 实测命中（dev 5787） | — | `/reward`、`/listing`、`/listing/new` 均渲染「页面不存在…返回首页」；`/en/listing/9` 渲染英文「Page Not Found…Back to Home」（**语言前缀生效**）；**非重定向 / 仍不是 301** |

**（b）主题图标语义（`T41` / `T92`）**

| 项 | 改前 | 改后 |
|---|---|---|
| 字面（**两处同源逐字相同**） | `{isDark ? <Moon size={18} /> : <Sun size={18} />}`（语义 = **显示当前档位**：亮档→sun、夜档→moon） | `{isDark ? <Sun size={18} /> : <Moon size={18} />}`（语义 = **将要切到的档位**：亮档→moon、夜档→sun） |
| 落点 | 桌面 `Header.jsx:242` / 移动面板 `Header.jsx:452`（**同源 ⇒ 必须两处同改，不得只改一处**） | 同上两处**同改**；尺寸 `size={18}` / 包装 / `aria-label` / `aria-pressed` **均未动** |

**四组图标读数**（lucide-react 渲染 `svg` 的 class：`lucide-sun` / `lucide-moon`）：

| 面 / 档 | 亮档（light） | 夜档（dark） |
|---|---|---|
| 桌面钮（1440 · `button[aria-label="darkMode"]`） | **`lucide-moon`** | **`lucide-sun`** |
| 移动面板钮（390 · 汉堡面板内 `button[aria-label="darkMode"][aria-pressed]`） | **`lucide-moon`** | **`lucide-sun`** |

**真坐标点击翻档（两处各一次）**：桌面钮真坐标 `(1111, 32)` 点击 ⇒ `data-theme` `light → dark`，图标即 `lucide-moon → lucide-sun`；移动面板钮真坐标 `(195, 421)` 点击 ⇒ `data-theme` `light → dark`，图标即 `lucide-moon → lucide-sun`。**两处均与设计真源 `T41`（日档显月亮 / 夜档显太阳）一致**。

---

## ⑭ 新四语基线 + 路由数（现取）

**四语键集新基线（四语一致，逐语同值）**：**顶层 `122` / 拍平 `1045` / 四语节点 `4180`**（`scripts/p4z-i18nviol-global.mjs` 现取：`作用域命中节点数 = 4180（键 1045 × 语 4）`，总判 `PASS`；逐语 `JSON.parse` 现取顶层/拍平亦 = 122/1045）。
- 与上单（`⑤` 节）对比：`127/1053/4212` → 删 11 死键（`−11/语`）→ `121/1042/4168` → 补 3 新键 `notFound.*`（`+3/语`，顶层 `+1`）→ **终值 `122/1045/4180`**（真实读数，非推定）。

**路由数（现取 · `frontend/src/App.jsx` · 基线 `d2ad4ef`）**：

| 口径 | 现取 |
|---|---|
| `grep -cE '<Route'` | **38**（含 2 行注释散文里的字面 `<Routes>`：`App.jsx:27`/`:139`）⇒ **剔注释行 = 36** |
| 精确 `<Route` JSX 元素（`grep -oE '<Route[ >]'`） | **33**（改前 32） |
| 后端注册点（`grep -cE '^app\.(get\|post\|put\|delete\|patch)\('`） | **89 不变**（catch-all 是前端相对段，不触后端） |

（与 `docs/route-layer.spec.md` §39.2 的 v2.30 就地更正读数一致。）

---

## ⑮ 已知口径登记：`/item/999999`（Zang 已裁 · 保留现状）

- **裁定**：`/item/999999`（**不存在的 id**）**保留现状** —— 走**详情页内**的「关联单据不存在 + 返回列表」空态，**不并入 catch-all 提示页**。
- **理由**（Zang）：**更精确的上下文提示优于通用提示**（用户停在 `/item/:id` 上下文，应被告知「该单据不存在」而非「页面不存在」）；且该空态**非空白**（有独立文案 + 导航入口）。
- **实测口径**（dev 5787 · 1440）：`/item/999999` 现取渲染 `[data-sf-m="item-detail-empty"]`（`data-sf-phase="error"`，文案「关联单据不存在。」），**非** `[data-sf-m="not-found-page"]` ⇒ 与裁定逐字相符。
- 机制：`ItemDetailPage` 取 `id`（`item/:itemId` 段或 `?id=`）后 `fetchListingDetail` miss ⇒ `detail.phase='error'` ⇒ 渲染 `sf-item-empty` 空态分支；**该分支早于内层 catch-all**（路径已精确/动态命中 `item/:itemId`，不落 `*`）。
- 该口径为**已知既定行为**（非缺陷、非回归）；登记存档。

---

## ⑯ 门套读数（本轮 · 管道外捕获退出码）

| 项目 | 读数 |
|---|---|
| `npm run test:unit` | **`Test Files 51 passed (51)` / `Tests 488 passed (488)` / `0 failed`**，`TEST_EXIT=0`（= 基线，未降低） |
| `npm run build` | **`BUILD_EXIT=0`**（`vite v5.4.20`，`✓ 1799 modules transformed`，`✓ built in 2.12s`） |
| 产物名 | `dist/assets/index-CtGmtxm0.js`（主，410.05 kB / gzip 120.53 kB）· `dist/assets/index-BlJoO8F3.css`（112.97 kB / gzip 20.90 kB）· 分包 `vendor-*.js`（react/router/i18n/ui） |
| `tsc` | **N/A**（前端无 `tsconfig`） |

**本轮改动面**：仅 `frontend/src/components/Header.jsx`（两处图标分支互换）+ 本审计件。**断言影响 = 无**（`theme-shell-isomorphism.test.jsx` 的 DOM 形状签名本就显式排除 `button[aria-label="darkMode"]` 子树，两处分支互换仍恰 1 个 `svg` 元素 ⇒ 签名/子树计数不变；`51/488/0` 实测证实）。
