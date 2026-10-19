# SPEC-NOTE · 首页商品分页契约登记（FEED-PAGING v1 · 36/页 + 「只列 `listed`」）

- **单号** = `JING-SPEC-FEED-PAGING` · **角色** = Jing（Specifier · 制度员）
- **日期** = 2026-10-19 · **仓** = `/Users/kevin/bistro/seafood` · **基线 HEAD** = `0fe454a`
- **交付性质** = **只登记契约**（`docs/**` + 本件）；**零代码、零迁移、零 DB 连接、零 HTTP**
- **状态** = 契约冻结（v1）· **实现中**（Kong 同轮在跑）· 质检归 Neng · 本笔**不 push**
- **正典位置** = `docs/route-layer.spec.md` **v2.43 §49.8** · `docs/seafood.master-plan.md` **§5.426（B 段）+ 版本行 v0.343** · `docs/OPEN-ITEMS.md`（**`B37`**，顶部 v2.44 块）

---

## 1. Kevin 指令（逐字）

> 「**web 版 UI 要保证每行 6 条商品（目前 4 条），首批加载 6×6=36 条商品，随着窗口滚动，不断加载剩余商品，直至把全部商品（可显示的部分）显示完毕。**」

拆解成**两条独立契约**（本件只管第 1 条）：

| 面 | 契约 | 正典 |
|---|---|---|
| **数据面（本件）** | `PAGE_SIZE = 36` · 首屏 `skip=0` · 续拉 36/页 · 终止 = `< 36` 或空 · `bID` 去重 · 失败可重试 | `route-layer.spec` **v2.43 §49.8** |
| **视觉面（另一单）** | 每行 **6 条** ⇒ 容器 `1536px` + `≥1280` ⇒ 6 列 + 夜档列数统一 | `design-system.spec` **v1.24 §25（`T121`）** + `ops/feed-6col/SPEC-NOTE.md` |

**为什么必须分开**：`36` 是**页大小**，不是「一屏」。4 列档下 36 条 = 9 行整（`36 % 4 = 0`）、6 列档下 = 6 行整（`36 % 6 = 0`）⇒ **页大小与列数解耦**，改列数不需要改 `PAGE_SIZE`。

## 2. 冻结契约（v1）

| # | 项 | 冻结值 | 现取落点（编制时点） |
|---|---|---|---|
| 1 | 读口 | **`GET /api/prize/all?skip=<n>&limit=36`**（唯一分页口） | `index.ts:605` → `listPrizes`（`database.ts:4523`）→ `listBrands`（`:2590`） |
| 2 | 页大小 | **`FEED_PAGE_SIZE = 36`** | `frontend/src/pages/HomePage.jsx:41`（工作区 `M`） |
| 3 | 首屏 | `skip = 0` · `limit = 36`（**一次请求**） | 同上首屏 effect |
| 4 | 续拉 | 滚到底 ⇒ `skip += 36` · `limit = 36` · **串行**（无并发双发） | 同上（游标**成功后**前推） |
| 5 | 终止 | 某页 `rows.length < 36` **或** `= 0` ⇒ `hasMore = false`、停发 | 同上 |
| 6 | 去重 | 按 **`bID`**（回退 `listing_id`）· **首见保留** | `mergeRewardPage`（`Set`） |
| 7 | 失败 | 保留已加载行 + 「重试」；**不自动重试**；**游标不前推** | 同上注释 ④ |
| 8 | `/api/home` | **形状不动**；首页只再用 `tasks` / `user_points` / `claimed_prize_ids` | `index.ts:913`（`prize_limit` 缺省 8 / 上限 16 参数保留） |
| 9 | 行集合 | **`WHERE l.status = 'listed'`**（见 §3） | `listBrands`（工作区 `M`） |
| 10 | 排序 | **不变** = §49.2 `score DESC, time_created DESC, listing_id DESC` | 同 SQL |
| 11 | 不改的形状面 | **零新路由（注册点 110）· 零迁移 · 零新错误码 · 零新幂等键 · 零资金腿 · 行键集 45 键（`score` 不下发）** | 现取 |

**禁令**：不得为首页另开第二条商品读口（`?feed=1` / `/api/prize/home36` 一类）—— 一份数据面、一个口。

## 3. ★ 行为变更：「只列 `listed`」（不是纯前端改动）

- `listBrands` 的 `FROM listing AS l` **追加 `WHERE l.status = 'listed'`**。
- **修前不过滤 `status`** ⇒ `draft` / `delisted` 会漏进列表（实现单注释现取：「dev 库 26 行里 15 行 `draft` + 2 行 `delisted`」—— **该三项为 Kong 注释转引，本笔未连库复算**）。
- **影响面 = 两个列表读口**：`/api/home`（其 `prizes` 面）与 `/api/prize/all` **同批生效**。
- **详情口不动**：`getBrandById` **不过滤** ⇒ 下架商品详情仍可打开（`/item/999999` 空态口径不受影响）。
- **判负**：任一列表读口返回行里出现 `status !== 'listed'`（含 `delisted`）⇒ 判负。

## 4. 排序与分页的稳定性（**v1 主动接受漂移**）

- **机制**：位置分页（`LIMIT/OFFSET`）+ 动态排序键（`score` 含 `now()` 驱动的 `recency`，且 `rating` 随评分变化）⇒ 相邻页之间可能**重复**或**漏**。
- **§49.3 仍成立**：同库态、连续两次同 `skip/limit` 请求**逐位同序**；它**不保证**跨页无重叠（那是位置分页的固有性质，旧口径同样存在）。
- **v1 处置**：客户端按 `bID` 去重消「重复」；**「漏」不兜底**（下一页 / 下次刷新补回）。
- **彻底解（另立单）**：keyset（游标 = `(score, time_created, listing_id)`）/ 快照（`skip` 绑固定时间窗）⇒ 挂 `OPEN-ITEMS` **`B37`**。
- **不得据此判负**：跨页漂移**不是缺陷**（例外：出现**同页内重复** = 去重失效，属真缺陷）。

## 5. 判负（5 条 · 质检必带）

| # | 探针 | 期望 | 判负 |
|---|---|---|---|
| 1 | `GET /api/prize/all?skip=0&limit=36`，**库内 `listed ≥ 36`** | `data.length === 36` | **首个响应非 36 条** ⇒ 判负（库内不足 36 时改判 `#1′`：`length === listed 总数`） |
| 2 | 首屏 + 滚到底（≥1 页） | 卡片数**严格增加** | **滑动后卡数不增** ⇒ 判负 |
| 3 | 合并后全量 `bID` | 无重复（`Set.size === length`） | 出现**重复 `bID`** ⇒ 判负 |
| 4 | 任一列表读口返回行 | 全部 `status = 'listed'` | **`draft`（含 `delisted`）出现在列表** ⇒ 判负 |
| 5 | `GET /api/home` 响应键集 | 与改前**逐键相同** | **`/api/home` 形状变更** ⇒ 判负 |

## 6. 现取自证（编制时点 2026-10-19 · HEAD `0fe454a`）

| 项 | 读数 |
|---|---|
| 页大小常量 | `FEED_PAGE_SIZE = 36`（`HomePage.jsx:41` · 工作区 `M`） |
| 排序 / 过滤落点 | `listBrands`（`database.ts:2590`）· `WHERE l.status = 'listed'` + `ORDER BY f.score DESC, f.time_created DESC, f.listing_id DESC`（工作区 `M`） |
| 工作区未提交面（**随实现单漂移 · 编制时点现取**） | `M backend-ts/src/database.ts`（`+8/−0`）· `M frontend/src/pages/HomePage.jsx`（`+192/−26`）· `M frontend/src/components/ui/Responsive.jsx`（`+3/−1`，`ResponsiveGrid` 补 `...rest`）· `M frontend/src/test/unit/home-page.test.jsx`（`+3/−3`）· 未跟踪 `frontend/src/test/unit/home-feed-paging.test.jsx`（266 行）· 未跟踪 `ops/feed-ranking/qa/` |
| 注册点 | **110**（get 49 / post 57 / put 0 / delete 3 / patch 1） |
| 迁移 | **0** |
| 本笔改动 | 只写 `docs/**` + 本件；`docs/route-layer.spec.md` / `docs/seafood.master-plan.md` / `docs/OPEN-ITEMS.md` 的 `numstat` **删除列 = 0** |

## 7. 未做（诚实边界）

- **未实现完**：编制时点 `database.ts` / `HomePage.jsx` 均 `M` 未提交（Kong 在跑）；本节只冻结契约。
- **未质检、未上线**：判负 5 条**一条未跑**；滚动续拉的浏览器级读数**未采**。
- **库内行数未复算**：`listed` / `draft` / `delisted` 三个数字来自实现单注释，**本笔零 DB 连接**（不冒充实测）。
- **`/api/home` 的 `prizes` 字段**仍下发（形状不动），只保证**首页不再消费** —— 其它消费方是否存在本笔未全量排查（归实现单 / 质检单）。
