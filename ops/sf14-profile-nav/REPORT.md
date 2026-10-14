# sf14「/profile 侧栏导航 + 账户设置」质检报告（续单）

- 仓：`/Users/kevin/bistro/seafood`（分支 `main`，工作树对 `ops/` 以外零改动：`git status --porcelain` 仅 `?? ops/`）
- 日期：2026-10-14（CST）｜角色：Neng（质检）｜性质：续单——上一任撞 60 次上限，本单**只补剩余项**（AC-6 / AC-8 / AC-9 / AC-10 + 收藏零残留 + 进程收尾），并引用已落盘 AC-1..5 / AC-7 读数
- 本单**未做**：未跑门套（AC-7 已绿，避免与并行门改微单抢同一棵树）、未改产品代码（`frontend/**` 只读，`backend-ts/**` 与 `docs/**` 未触碰）、未 commit、未 push
- 证据根目录：`ops/sf14-profile-nav/`（`readings/` + `shots/`）

---

## §1 总表（AC-1 … AC-10）

| AC | verdict | 读数文件 | 读数要点（引用原 verdict，不改写） |
|---|---|---|---|
| AC-1 | **PASS** | `readings/ac1.json` | 桌面未登录 header「订单」入口在场（974,13.5 68×37，命中自身）→ 点击落 `/login`；登录后点击落 `/profile/trades/bought`（profileNav + boughtPane）；手机档汉堡菜单内「订单」项在场 |
| AC-2 | **PASS** | `readings/ac2.json` | 侧栏 6 项（交易组 + published/sold/bought/favorites/settings）；点击切换到 `/profile/favorites`；三条深链 `/profile/settings`、`/profile/trades/sold`、`/profile/favorites` 各自 marker 渲染 |
| AC-3 | **PASS** | `readings/ac3.json` | published 终态含夹具 listing 71；sold 空态 + `GET /api/...` 200 `data: []`；bought 空态 + MyOrdersPanel 在场；非法子页 xxx 回落 bought。**文件内备注**：首跑在 loading 相位早读判 FAIL，归因为探针伪影（b)/(c) 类，终态重取版已覆盖 |
| AC-4 | **PASS** | `readings/ac4.json` | 收藏全栈往返：详情页 toggle 收藏→已收藏、`GET /api/favorites` 出现 listing 71 行、收藏页行含移除键；列表移除后空态 + `rows: []`；重复 POST 幂等仍 1 行；负例 401 / 404 / 400 齐备；基线行含 listing 71 |
| AC-5 | **PASS** | `readings/ac5.json` | 活动页 + 锚点 + 面板在场、hash 滚动 nearTop、手机档 Header 入口 `/activities#batt-checkin`、`/profile` 无签到面板。**两处 DOM 未读到（已具名归因，见 §5）** |
| AC-6 | **PASS**（本单新增） | `readings/ac6.json` | 账户设置视图 7 个板块逐项 present 全真（基本信息 / 用户资产 / 账本读数 / 任务统计与成就 / 碎片持仓 / Telegram 卡 / 评分时效）+ bio 编辑保存往返（写后刷新复读 + 产品读口复核） |
| AC-7 | **PASS** | `readings/ac7.json` | `frontend npm run build` exit 0；`vitest run src/test/unit` 53 files / 514 tests 全绿；`backend-ts npm run build` exit 0（日志在 `logs/`） |
| AC-8 | **PASS**（本单新增；含 2 次探针错归因） | `readings/ac8.json` | 首页核心区块在场；「我的订单」区块**内容区零命中**（三路读数）且迁址 `/profile/trades/bought` 正读数；`/item/71` actionbar + 购买 CTA + 收藏 toggle 在场；`/messages`、`/exchange` 各一个渲染读数 |
| AC-9 | **PASS**（本单新增；含 1 次探针错归因） | `readings/ac9.json` | `/en|/hk|/vn/profile` 侧栏标签逐语与 `locales/<lang>.json` **逐字相等**，无裸键名 `profileNav.*`（未登录档受 ProtectedRoute 重定向 `/…/login`，已按单目改用登录态读） |
| AC-10 | **PASS**（本单新增） | `readings/ac10.json` | 390×844 移动档：侧栏 `flex-direction: row` 且宽>高（横向页签）；底栏恒 5 格（`grid-template-columns: 78px ×5`）；触控目标 ≥44px（导航页签 44px、底栏格 63px） |
| 收尾 | **PASS** | `readings/residue.json` | `GET /api/favorites` 终态 `data: []`（零残留，无需清理路径）；headless Chrome 按精确 PID 73830 收尾，9341 端口 0 监听 / 连接拒绝 |

新增读数 4 份 + 收尾 1 份，全部落在 `ops/sf14-profile-nav/readings/`。

---

## §2 新增读数详解

### AC-6 账户设置视图（`readings/ac6.json`，截图 `shots/ac6_settings_v2.png`）
- 去参判据 = **复合终态**（非固定睡眠）：`[data-sf-m=settings-view]` + `rating-period` + `tg-bind-card` + (`jobs-flow-list`|`jobs-flow-empty`) + 中文「基本信息」文案同时在场后才取样。
- `view_presence` 逐项 present：

| 板块 | 判据 | 读数 |
|---|---|---|
| 基本信息卡 | `profilePage.basicInfo` 文案 + bio 块 | true |
| 用户资产 | `profilePage.myAssets` 文案 | true |
| 账本读数 | `jobs-balance` / `jobs-flow` marker + `jobs-balance-amount` | true（余额读数字面 `0`） |
| 任务统计 / 成就 | `taskAchievements` + `achievements` 文案 | true |
| 碎片持仓 | `shardHoldings` 或 `noHoldings` 文案 | true |
| Telegram 卡 | `[data-sf-m=tg-bind-card]` | true（`data-sf-tg-state=loading` 初读，取值为该卡自身三态机） |
| 评分时效 | `rating-period` + `rating-stars` + `timeliness-durations` | true |
| 六节标题齐备 | 6 个 `profilePage.*` 节标题同时在场 | true |

- **bio 编辑保存往返**（真实写入，写的是本测试账户）：真实输入事件（点击 textarea → `moveToEndOfLine` → `Input.insertText` 追加后缀）→ 点击「保存」→ 编辑态关闭 → **刷新页面**（`c.nav` 重新载入）DOM 复读含新 bio → 产品读口 `GET /api/user` 的 `bio` 与写入值逐字相等（`bioEqualsExpected: true`）。

### AC-8 归因冒烟（`readings/ac8.json`，截图 `shots/ac8_home_v3.png`）
- 首页核心区块：`home-item-list` / `home-items` / `home-item-filter` / `home-publish-link` / `home-my-points` 在场；内容区 marker 清单（19 项）落盘。
- **「我的订单」区块确已消失（三路正读数，全零命中）**：
  1. 四语文案扫描（zh/en/hk/vn 的 `item.myOrders`）：`textHits: 0`；
  2. `data-sf-m` `*order*` 标记按内容区过滤：`orderMarkersInContentArea: []`（唯一命中 `header-orders` 归入外壳 chrome 区 `data-sf-region="topnav"`，系 AC-1 目标物「订单」入口，非 D7 目标块）；
  3. `elementFromPoint` 5 点探针（视口下半 55%/70%/85% + 左右 25%/75%）：`orderAncestor` 全为 `null`。
- **迁址正读数（互补一侧）**：`/profile/trades/bought` 内 `item-orders-section` 在场 + 标题「我的订单」在场，order 标记族（`item-orders-section` / `item-input-order` / `item-order-actions` / `item-input-order-action` / `item-order-action-status`）随之可见。
- `/item/71`：`item-actionbar` 在场，购买 CTA「立即购买」在场（704×38，未禁用）、收藏 toggle「收藏」在场（678×38）——既有 CTA 无回归。
- `/messages`：`rendered: true`（正文「消息 | 暂无数据」）；`/exchange`：`rendered: true`（正文含「积分交易所」行情说明 + 闲置物品区）。

### AC-9 四语（`readings/ac9.json`，截图 `shots/ac9_en|hk|vn_profile_v2.png`）
- 未登录档先试读：`/en|/hk|/vn/profile` 均被 ProtectedRoute 挡下并重定向 `/…/login`（语言前缀保留，`h1` 各语译文），故按单目「若受登录重定向阻挡则以登录态会话各访一次」执行。
- 登录态逐语（`profileNav` 键族抽样 published / sold / bought / favorites / settings）：

| 键 | en | hk | vn | 判据 |
|---|---|---|---|---|
| published | My Listings | 我發佈的 | Tin đăng của tôi | 与 `locales/<lang>.json` 逐字相等 ✅ |
| sold | Sold | 我賣出的 | Đã bán | ✅ |
| bought | Purchases | 我買到的 | Đã mua | ✅ |
| favorites | Favorites | 我的收藏 | Yêu thích | ✅（hk 与 zh 同形 = locale 真源即此，非缺译） |
| settings | Account Settings | 賬戶設置 | Cài đặt tài khoản | ✅ |

- 裸键名扫描：侧栏文本无 `profileNav`、正文无 `profileNav.` ⇒ 无 key 泄漏。

### AC-10 移动档（`readings/ac10.json`，截图 `shots/ac10_mobile_390.png`）
- 视口 390×844（`mobile: true`）：**实测 `innerWidth = 530`**（Chrome 移动仿真下布局视口被放大，仍 ≤767 断点；`tabbar` 与页签宽度按 390 CSS px 计算——两项读数均已落盘，不做美化）。
- 侧栏形态：`flex-direction: row`，`overflow-x: auto`，导航 504×60（宽>高）⇒ 横向页签可达形态；页签 5 枚。
- 底栏：`grid-template-columns: 78px 78px 78px 78px 78px`，`[data-sf-region=tabbar]` 5 格（home / shard / sell / messages / profile），`display: grid`、高 64、格子高 63 ⇒ 恒 5 格。
- 触控目标：导航页签最小高 **44px**（`--sf-l-prof-link-h-m`），底栏格子最小高 **63px**；字号 14px / 12px（均 ≥12px）。

---

## §3 已交项（AC-1..5 / AC-7）引用

原 verdict 一律照抄，未重判、未改写成更好听的结论；文件内既有的备注/归因原样保留：

- AC-1 PASS、AC-2 PASS、AC-4 PASS、AC-7 PASS —— 无附加备注。
- AC-3 **PASS**，`ac3.json.notes` 原文保留：首跑在 loading 相位早读判 FAIL，归因探针伪影 (b)/(c) 类，终态重取版覆盖；另有「sold/bought 带数据的形态需资金动作 = 未跑，空态为唯一取得形态」。
- AC-5 **PASS**，两处 DOM 未读到已具名归因（见 §5）。

---

## §4 夹具与真实写入披露

- 测试账户：`0x374876Ef8123D9718Bd15592133619073f4f6Eb9`（uid 971214）；会话文件在 scratch `sf14qa/session.json`（0600，未入库、未打印密钥）。私钥只存 `~/.config/seafood/sf14qa-test-account.env`（0600），全程未读取、未打印。
- 夹具 listing：**id 71**，标题「sf14qa 测试商品（质检夹具·勿购）」，$4 / 库存 1，属本测试账户自售（**未购买**）。
- 本单产生的**真实写入**：
  1. `POST /api/auth/challenge` + `POST /api/auth/verify`（钱包登录；上一任会话 token 于 11:35 过期，本单以夹具脚本对**同一账户**重新登录刷新会话，未新建账户、未新建 listing）；
  2. `POST /api/user/profile`（AC-6 bio 往返回合，写入本测试账户 bio，终值为追加式可辨识串 `| sf14qa bio round-trip <ts> | sf14qa v2 <ts>`，属夹具标注、非随机污染；两段后缀分别来自 v1 与 v2 两次往返）；
  3. 收藏写入：AC-4 已交读数含 `POST/DELETE /api/favorites`（幂等双 POST + 清理），本单**未新增**收藏写入，仅做终态零残留复核。
- 未做：未购买、未签到（`POST /api/signin` 类）、未发布新闲置、未改任何既有数据以外的记录。

---

## §5 环境性与未取得通道项（单列，原样保留）

| 项 | 状态 | 归因 / 依据 |
|---|---|---|
| AC-5 ①：jobs「电量不足提示」态 DOM 读数 | **NOT_MEASURED** | `ac5.json`：hint 仅在电量不足被拒时渲染，当前测试账户未触发该态（未跑资金链）；以源码 href `frontend/src/pages/jobs/JobDetailPage.jsx:222` + Header 双入口实测为据。原文件 verdict 仍为 PASS，本表不改写。 |
| AC-5 ②：桌面档 Header 的活动/签到入口 | **未读到（null）** | `ac5.json.header_entries.desktop = null`：该入口只在手机档渲染（`mobile = /activities#batt-checkin`）；桌面档以 `/activities` 直达页 + 锚点读数覆盖。 |
| AC-3：sold / bought **带数据**形态 | **未取得通道** | 需真实资金动作（成交）才能造出；本单遵守「未购」约束，空态为空态唯一取得形态（`ac3.json.notes` 原文）。 |
| AC-8：「聊一聊」运行时读数（非自售详情页） | **NOT_MEASURED** | `/item/71` 属本账户自售，按源门 `!isSellerSelf`（`frontend/src/pages/item/ItemDetailPage.jsx:283-296`）不渲染 `item-chat-btn`；库内闲置 listing 仅夹具 71，未造第二账户/第二条 listing。**同页购买 CTA 与收藏 toggle 均已实测在场**（`ac8.json.item_detail_71`），故本项不构成功能缺失判据，只作通道缺省记录。 |
| AC-6：Telegram 卡初读态 | 读数记录态 | `data-sf-tg-state=loading`（该卡三态机自身相位，非探针缺陷）；卡片 DOM 在场为 AC-6 判据。 |
| AC-10：仿真 `innerWidth = 530` vs 设定 390 | 读数并存 | Chrome 移动仿真布局视口放大所致；断点（≤767）已生效，页签 44px / 底栏 5 格读数成立。 |

**环境性 FAIL 处理原则**：AC-3 首跑 FAIL 属环境性/探针性，原样保留在 `ac3.json.notes` 内并归因；本单 AC-6/8/9 的首跑 FAIL 同法保留在各自文件 `first_run` / `verdict_attempts` 字段并归因，**未手改成 PASS**，终态重取版另记（见 §6）。

---

## §6 判负灵敏度自证（探针不是恒真）

本单四条新读数**先跑出过真实 FAIL**，且两处 FAIL 由探针自身缺陷造成、第三处由产品门控造成——这本身证明读数对差异敏感：

1. **AC-6 v1 = FAIL**：bio 判据用未 `strip` 的后缀比对，而产品保存路径 `tempBio.trim()` 去掉前导空格 ⇒ `endsWith` 假。同一轮读数里 `GET /api/user` 的 `bioLen = 34` = 去空格后后缀长度 ⇒ **产品侧写入成功**、探针比对错。归因与 v1 读数存 `ac6.json.first_run`；v2（终态重取）判据改为「与产品写入值逐字相等」后 PASS。
2. **AC-8 v1 / v2 = FAIL**：v1 的 `*order*` 标记判据未排除外壳既有「订单」入口（`header-orders`）；v2 过滤选择器写成不存在的 `data-sf-region="header"`（实际为 `topnav`）。两轮都因**探针预期式缺陷**判负；v3 修正后首页内容区 order 标记零命中 ⇒ PASS。归因链存 `ac8.json.verdict_attempts`。
3. **AC-9 v1 = FAIL**：`notZhLabels` 判据要求各语标签字形必须 ≠ zh，而 hk 的 `profileNav.favorites` 在 locale 真源里本就写作「我的收藏」（与 zh 同形、属合法译文）⇒ 判据本身错。v2 改为「与 `locales/<lang>.json` 逐字相等」后 PASS。归因存 `ac9.json.first_run`。
4. **读数对有无均敏感**：`GET /api/favorites` 在 AC-4 基线返回 1 行（listing 71）、清理后返回 `[]`、重复 POST 后仍 1 行 ⇒ 同一读口可输出非空与空两态；本单收尾复核为 `[]`。若该读口对残留不敏感，AC-4 的零残留判据不可能成立。
5. AC-7 的 vitest 门限为「不少于 53 files / 514 tests」真实计数，非恒真断言；AC-10 的 44px 是**实测几何**（导航页签 44、底栏格 63），并同时落盘未达标的另一族数值。

> 说明：本单 FAIL→PASS 均属「探针缺陷」而非产品的环境性 FAIL；按纪律，环境性 FAIL 一律原样保留 + 归因，本单未出现需要保留为 FAIL 的环境性项（AC-5 的两处未读到属未取得通道，已在 §5 单列，`ac5.json` 原 verdict 未改）。

---

## §7 进程 / 端口收尾读数（`readings/residue.json`）

| 项 | 读数 |
|---|---|
| 收藏终态 | `GET /api/favorites` → 200，`data: []`，`zeroResidue: true`（无残留，无需 DELETE 路径） |
| headless Chrome | 精确 PID **73830**（`lsof -nP -iTCP:9341 -sTCP:LISTEN`）→ `kill 73830`；**未用** `pkill -f` |
| 收尾后 9341 | 监听数 `0`；HTTP 探测 `000 / conn_refused` |
| 派单方服务 | 5787 = 200、5788 = 200（未动） |

---

## §8 截图清单（共 **17** 张，`ops/sf14-profile-nav/shots/`）

已交（7）：`ac1_mobile_orders.png`、`ac2_sidebar_desktop.png`、`ac3_published.png`、`ac3_bought.png`、`ac3_sold_empty.png`、`ac4_detail_faved.png`、`ac4_fav_row.png`
本单新增（10）：`ac6_settings_desktop.png`、`ac6_settings_reloaded.png`、`ac6_settings_v2.png`、`ac8_home_v2.png`、`ac8_home_v3.png`、`ac9_vn_profile.png`、`ac9_en_profile_v2.png`、`ac9_hk_profile_v2.png`、`ac9_vn_profile_v2.png`、`ac10_mobile_390.png`

## §9 已知代价与遗留

- 上一任撞 60 次单位余量，本单对 AC-6/8/9 各多跑了一轮终态重取（3 次脚本运行 + 1 次会话刷新），属探针缺陷返工；工具与夹具已在 scratch 复用（`sf14qa/{cdp.py,rest.py,fix.py,ac8b.py}`），后续同类单可免重写。
- 会话 token 有效期约 1 小时，跨小时续跑需先跑 `fixture.mjs login` 刷新（否则受保护页全部渲染成登录引导——本单首跑即撞此坑，已列为排查经验）。
- 未取得通道：AC-5 两处 DOM、AC-3 sold/bought 带数据形态、AC-8 非自售档「聊一聊」（见 §5）。
- 本单产出未入库：证据由派单方收口统一 commit。

## §10 复现

```bash
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/sf14qa/rest.py   # AC-6/8/9/10 + 零残留
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/sf14qa/fix.py    # AC-6/8/9 终态重取
/usr/bin/python3 /Users/kevin/.hermes/profiles/zang/cache/scratch/sf14qa/ac8b.py   # AC-8 chrome 区过滤修正
```
（探针 = CDP 真实输入事件 + `waitForSelector`/复合终态轮询；未使用固定时长睡眠作门控。）
