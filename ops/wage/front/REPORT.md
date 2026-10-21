# /wage 页面 + 悬浮菜单改版 · 交付报告

## 改动
- `frontend/src/shell/FloatingMenu.jsx`：移除【反馈】项及其弹窗模板位（源码 `feedback` 命中 0）；第二位插入【领工资】（`icon: Banknote`、`labelKey: wage.menuLabel`、`path: wage`）⇒ 新顺序 = 卖闲置 → 领工资 → 消息 → APP → 客服。〔**历史形态 · 已作废**：现役顺序 = **领工资 → 卖闲置 → 消息 → APP → 客服**（wage 首位），以文末「增量修复」节与 `probe-result.json` 的 `assertions.menu.order` 为准〕
- `frontend/src/pages/wage/{WagePage.jsx, wage-api.js, wage.css}`：项目列表（招募中/已截止、已招 X/Y、`工资：batt N/次（间隔 M 小时）` + 次币固定额）、【加入】/【领工资】按钮态（间隔未到置灰 + `m:ss` 倒计时）、领薪成功卡内到账提示并重拉、失败按 `details.reason` 内联提示、未登录提示、390 触控 ≥44。
- `frontend/src/App.jsx`：`/wage` 路由（四语前缀）。
- i18n：新顶层命名空间 `wage` 29 键 × 四语（vn 待复核）；top 131→132 / flat 1140→1169 / nodes 4560→4676；13 个计数断言测试同步。

## 验证
- `npm run build`：exit 0（`index-Cevw_Kkq.js` / `index-_mLH5ONy.css`）
- `test:unit`：**67 文件 / 688 例全绿**（基线 66/678）
  - `v15-nav-floatmenu.test.jsx` 21/21（新五项序 + 无反馈负断言 + `/en/wage`）
  - `wage-page.test.jsx` 10/10〔历史；现为 **12/12**，见文末节〕
- 探针 `ops/wage/front/probe-wage.mjs`（route 拦截，零后端）：**verdict.pass = true**
  - 菜单 5 项 / 无反馈 / 第二位 wage〔**历史读数**：现役首位 = wage，见文末节〕
  - 10 卡：招募中 8 / 已截止 2、`已招 2/3`、`工资：batt 30/次（间隔 4 小时）`、`＋50 BTTC/次`
  - 领薪成功 ⇒ `POST /api/project/101/claim` ×1 + 卡内到账 + 置灰倒计时；失败 ⇒ 内联 err + 倒计时接管
  - 390/1536 零横向溢出、390 触控 ≥44、pageerror 0

## 边界（不臆造）
- `wage_cid` 无 symbol 时不渲染次币段。
- 间隔与工资同处一条 `wageLine` 文案（未单独立键）。

## 增量修复（2026-10-20）：未登录也公开浏览项目列表（写口仍需登录）

**根因（生产实测）**：未登录访问 `/wage` 时 `/api/project` **零请求**，页面只有「同时只能在一个项目打工 /
登录后即可领工资 / 去登录」。成因在**前端**：取数 effect 在 `!isAuthenticated` 时直接
`setList({ phase: 'guest' })` 并 `return`（零请求），渲染层又把客态**整页替换**成登录块。而后端
`GET /api/project/all` 本来就是**公开无闸**（`backend-ts/src/index.ts:4029`，handler 不取 actor），
设计意图是「用户可先浏览招工中的项目」⇒ 前端把公开面误做成了登录面。

### 改动（纯前端：零后端改动、零新路由、零 i18n 键数变化）

- `frontend/src/pages/wage/WagePage.jsx`
  - 取数 effect 去掉客态短路 ⇒ **客态也 `GET /api/project/all`** 并渲染项目卡（项目名 / 简述 / 招工状态 / 已招 X/Y / 工资行 / 次币定额）。
  - 币种符号 effect 去掉 `isAuthenticated` 闸（`GET /api/currencies` 是公开读口）⇒ 客态也显示「＋50 BTTC/次」。
  - 客态提示从「整页替换」改为**页顶一条轻提示**（`data-sf-m="wage-login"`，提示文案 + `wage-login-cta` 登录入口），**列表照常在其下方**。
  - 写口登录闸：`onJoin` / `onClaim` 首行判 `!isAuthenticated` ⇒ 卡内 `data-sf-kind="login"` 提示（文案复用既有 `wage.loginRequired`，并附卡内登录链接 `wage-card-login-link`），**零请求**；按钮**可点**（`disabled=false`）且带 `data-sf-need-login="1"`。
  - `hiredKey` 客态恒空（不拿行内 `my_role` 去置灰【加入】）；**登录态行为逐条与改前一致**（在职 / 已招满 / 已截止态不变）。
- `frontend/src/pages/wage/wage.css`：`.sf-wage-login` 改横排提示条（`margin-bottom` + 行内 + `p{min-width:0;overflow-wrap:anywhere}`，390 档零溢出）；新增 `.sf-wage-notice.is-login` 与 `.sf-wage-notice-link`（取既有 token `--sf-panel-link-fg`，**零新 token、零 `TOKEN_KEYS` 变更**）。
- `frontend/src/locales/{zh,en,hk,vn}.json`：`wage.loginRequired` **只改值**（zh「登录后即可加入项目、领工资」/ en「Sign in to join a project and claim your pay」/ hk「登入後即可加入項目、領工資」/ vn「Đăng nhập để tham gia dự án và nhận lương」）⇒ 键集不变、**零计数前推**。

### 验证读数（均已落盘 `readings/`）

- `npm run build`：**exit 0**，产物 `assets/index-CnbdqZr9.js` / `assets/index-Bxr_e8iC.css`（`readings/build-after.txt`）。
- `npm run test:unit`：**68 文件 / 706 例全绿**（改前基线 **68 / 704** ⇒ **+2 例，例数不减**；`readings/unit-after.txt`）。
  - `wage-page.test.jsx` **12/12**：原「未登录 ⇒ 零请求、无列表」这一条**按新口径改正**为「未登录也渲染列表 + 页顶轻提示与列表并存」，并新增「客态点【加入】⇒ 卡内登录提示 + 零写请求」「客态点【领工资】⇒ 登录提示 + 零 claim」两臂 —— **没有为保旧断言而保留缺陷**。
- 探针 `node ops/wage/front/probe-wage.mjs ops/wage/front/readings/probe-result.json`：**verdict.pass = true（43/43 必过项）**，其中新增**客态臂 16 项**（独立 context、`addInitScript` 只种主题不种登录态）全绿：
  - `cardsVisible`（10 卡）/ `listRendered` / `bannerWithList`（页顶提示与列表**并存**）/ `titleVisible`（`冷库分拣`）/ `wageVisible`（`batt 30`）/ `currencyExtraVisible`（`BTTC`）/ `joinEnabled`（`data-sf-need-login=1` 且不置灰）
  - `joinClickLoginPrompt`（`data-sf-kind=login` + 文案 + 卡内登录链接）/ `claimClickLoginPrompt` / `zeroWriteRequests`（`/apply`、`/claim` **各 0 条**）/ `cardsStableAfterClicks` / `zeroOverflowGuest`
  - 客态 390 档（`states['390_guest']`）：`zeroOverflow390`（溢出 **0**）/ `cards390`（10 卡）/ `touchTarget44On390`（动作高 **44**）/ `bannerAndList390`；`cardRightMax = 380 ≤ 390`
  - 菜单读数复跑仍为 **`['wage','sell','messages','app','support']`、首位 = wage、分隔 4 条**（无回归；与「菜单新顺序 wage 首位」口径一致）
- **判据修正披露（非产品改动）**：客态提示断言用 `includes` 而非全等 —— 提示 `<p>` 内还含登录链接文字（`…领工资去登录`），全等会假红。

### 边界（不臆造）

- 未登录不显示「打工中」的**写能力**：真实服务端给客态返回的 `my_role` 为 `none`；即便行内带了 `hired`（探针防御臂），【领工资】点击也只弹登录提示、零请求。
- 未登录点【加入】不做任何乐观状态变更（不显示「已加入」假象），刷新后仍是【加入】。
- 短信/Toast 类文案零新增键；`loginRequired` 四语值改动已在上面逐字登记。

## 增量（2026-10-20）：电量卡 + 签到区自 `/activities` 并入本页顶部，旧页与路由硬删

**指令（Kevin）**：`/activities#batt-checkin` 的**电量显示与签到内容移到 `/wage` 页面**，`/activities` 页面**直接删掉**。

### 改动

- `frontend/src/pages/wage/WagePage.jsx`：页标题之下、项目列表**之上**新增 `<BattCheckinPanel />`（包裹层
  `data-sf-m="wage-checkin"`）。组件本体**一字未改** ⇒ 锚点 `id="batt-checkin"`（常量
  `BATT_CHECKIN_ANCHOR_ID`）与 `hash === '#batt-checkin'` ⇒ `scrollIntoView` 的机制随组件一起搬入本页。
  未登录 ⇒ 组件自身 `return null`（既有策略，不白屏），本页原有客态轻提示 + 公开项目列表不受影响。
- `frontend/src/pages/wage/wage.css`：新增 `.sf-wage-checkin { margin-bottom: var(--sf-st-feed-gap-m) }`
  （只做与列表的留白；卡内几何/配色仍由组件自带 ⇒ 零新 token、零新断点）。
- **硬删**：`frontend/src/pages/ActivitiesPage.jsx`、`frontend/src/pages/activities.css`（grep 确认无其他引用）；
  `frontend/src/App.jsx` 去掉其 import 与 `<Route path="activities">` ⇒ 旧段与四语前缀档落末位
  catch-all 提示页（同 `/reward` 一族处置、**无 301**）。
- **引用重指向**（全仓生产代码已无 `/activities` 命中，`dist` 产物 `grep -o '/activities'` = **0**）：
  - `components/Header.jsx`：桌面下拉 `header-batt-checkin`、手机面板 `header-batt-checkin-mobile`
    ⇒ `buildPath('wage') + '#batt-checkin'`；
  - `pages/jobs/JobDetailPage.jsx`：`jobs-batt-hint` ⇒ `buildLocalizedPath(lang, '/wage') + '#batt-checkin'`；
  - 注释同步改指（`ProfilePage.jsx` 两处、`App.jsx` 路由块）。
- **i18n**：`activitiesPage.title` 等键**只留不删**（避免键数连锁）⇒ top 133 / flat 1236 计数断言**一字不动**；
  文案层面不再有任何指向已删页面的指引（Header 项与电量提示的 href 已改指 `/wage`）。

### 验证读数（均已落盘 `readings/`）

- `npm run build`：**exit 0**，产物 `assets/index-vV3FFfA2.js` / `assets/index-Diow7irq.css`（`readings/build-checkin-move.log`）。
- `npm run test:unit`：**68 文件 / 708 例全绿**（改前基线当场自取 = **68 / 706** ⇒ +2 例，例数不减；
  `readings/unit-checkin-move.log`）。改动的前推：
  - `sf14-routes-header.test.jsx` 5→6 例：③a `/wage` 渲染领工资页；③b/③c `/activities`（登录/未登录）都落
    catch-all 提示页（不再是签到页、也不再经 ProtectedRoute 出登录引导）。
  - `sf14-profile-views.test.jsx` ③ 由「ActivitiesPage 页根钩子 + 标题」前推为「WagePage 顶部签到卡
    （`#batt-checkin` + `batt-meter` + 签到按钮）+ 列表在其下方（`compareDocumentPosition`）」，
    并补「未登录 ⇒ 签到区不渲染、列表照常」1 例。
  - `r9-batt-meter` / `r9-84-profile-entry` / `d1-error-machineface`：`/activities#batt-checkin` ⇒ `/wage#batt-checkin`（逐处）。
- 探针 `node ops/wage/front/probe-wage.mjs ops/wage/front/readings/probe-result-wage-checkin.json`：
  **verdict.pass = true、failed = []**（必过项 43→**62**，+19 = 签到 10 + 深链 3 + 旧页已删 4 + 两档几何 2；
  `pageErrors = 0`）。新增臂：
  - ① 登录态（localStorage 会话 + 内存 `/api/batt`、`/api/checkin` 读口）：`checkin.cardPresent`（`#batt-checkin`）、
    `meterPresent`（`batt-meter`，读数 `70%电量`）、`checkinButtonPresent`（签到）、`mintAreaPresent`（铸造/分解）、
    `readsWired`（`/api/batt` + `/api/checkin` 各 1 条调用，非本地假数据）。
  - ② 列表在签到区**下方**：`listBelowCheckin`（卡底 481 ≤ 列表顶 490、间距 9px）+ `cardsStillListed`（10 卡）。
  - ③ 旧页已删：`/activities` ⇒ `activitiesPageHooks = 0`、`notFoundHooks = 1`（catch-all 提示页）、
    未重定向到 `/wage`（`wage-page` 钩子 0）。
  - ④ 两档几何：390 / 1536 `overflowPx = 0`，签到卡 `cardRight = 380 ≤ 390`、在列表之上，
    `pageErrors = 0`（**全部臂跑完后**再复核一次累计量）。
  - 旧深链替代落点 `/wage#batt-checkin`：`cardPresent` + `cardInViewport` + `listStillBelow` 全绿。

### 边界与已披露项

- **未登录深链** `/wage#batt-checkin`：签到区不渲染（组件既有策略）⇒ 无锚点可滚，页面正常显示轻提示 + 列表，不白屏。
- **`docs/` 未改**（本单口径 = 不碰后端/docs）⇒ `docs/route-layer.spec.md` 等处仍记着 `/activities` 为现役路由，
  与实现已不一致，需另立规范勘误单（旧条文保留 + 「作废 · 以新段为准」）。
- **历史证据未改写**：`ops/bttc-mint-shortfall/**` 里的 `/activities` 属上一批（当时页面尚在）的探针与读数，
  按「历史读数不改写」保留；其探针若重跑会落 catch-all 提示页，属预期。

## 卡片按钮重构 + 已加入卡配色（2026-10-20 · 第二单）

**目标**：① 已加入项目**只显【领工资】**（含 `next_claim_at` 倒计时、到点自动可点），不再与【加入】同屏；
② 其他项目【加入】的置灰逻辑收口到「同时只能在一个项目打工」；③ 已加入的卡换一套配色，与其他卡一眼可辨。

### 改动（纯前端；零新路由、零后端改动、零新主题 token）

- `frontend/src/pages/wage/WagePage.jsx`
  - **键存在性判别**：新增 `hasKey`（`Object.prototype.hasOwnProperty`）与 `myRoleOf(row)`
    ⇒ `'hired' | 'none' | null`。匿名时后端对 `my_role` / `my_hired_at` / `next_claim_at` **整键缺省**
    ⇒ `null` = 不参与在职判定（**不用 falsy 判别**，否则 `null` / 缺键 / `'none'` 会被混成一类）。
    `my_role` 键在场时逐字采用（闭集外按 `none`），只带非空 `my_hired_at` 也认作在职。
  - **按钮态只认 `my_role`**：`hired` ⇒ 卡内**只**渲染【领工资】（`[data-sf-action="join"]` 数量 0）；
    `none` ⇒ 【加入】；键缺省（匿名）⇒ 照常渲染【加入】、点击只给登录提示、**零写请求**。
  - **领取间隔以行内 `next_claim_at` 为准**：键在场且为未来时刻 ⇒ 置灰 + 1s tick 倒计时（`m:ss` / `h:mm:ss`）；
    键在场且已过 / `null` ⇒ 立即可领；**键缺席** ⇒ 不动本地倒计时（不把「没透出」读成「现在可领」），
    交给服务端 400 兜底。定时器改为按 `pendingClaim` 开关（到点那一 tick 后自动停，不每秒重建 interval）。
  - **成功 ⇒ 刷新拿服务端新时间**：`POST /api/project/:id/claim` 成功后 `await load({silent:true})`，
    下次可领时间优先取 `响应.next_claim_at` → 次取**刷新后该行**的 `next_claim_at` → 最后才是
    `wage_interval_hours` 兜底；卡内提示显示到账 batt + 次币（`claimedWithCurrency`）。
  - **已加入卡的区分度**：`data-sf-joined="1"` + `is-joined` 类 + 标题行【已加入】徽标
    （`data-sf-m="wage-card-joined"`，文案 `wage.joinedBadge`）；未加入的卡 `data-sf-joined="0"`、无徽标、配色一字不动。
  - 新增 `data-sf-role="hired|none|anonymous"`（探针判别用，不影响渲染）。
- `frontend/src/pages/wage/wage.css`：`.sf-wage-card.is-joined` = 左侧 **4px** 强调边（`--sf-btna-bg`）+
  `::before` **12% 淡黄叠加层**（同一 token、`pointer-events:none`、子元素 `position:relative;z-index:1`）+
  `.sf-wage-joined-badge`（12px/700/圆角 2px/`--sf-btna-bg` 底 `--sf-btna-fg` 字，与详情页标签同族）。
  **零新 token、无 `[data-theme]` 选择器、无 `matchMedia`**；叠加层不走 `background-color` ⇒ 不改 `.sf-card`
  的底色槽位，夜档卡面仍是 `rgb(20,22,25)`（实测：夜档 title `rgb(237,239,242)` 可读）。
- i18n：新增 `wage.joinedBadge`（zh 已加入 / en Joined / hk 已加入 / **vn Đã tham gia 待复核**）⇒
  四语对称 +1 键：**top 133 不变 / flat 1236→1237 / 四语节点 4944→4948**；14 个硬编计数测试文件按现取复算等值替换
  （`toBe(1236)→1237`、`toBe(4944)→4948`、`flat: 1236→1237`、`'zh: top=133 flat=1236'→1237`、命中节点数 4944→4948）。

### 验证读数（均已落盘 `readings/`）

- `npm run build`：**exit 0**（`assets/index-B2X6D2ZE.js`；`readings/build-joined-card.log`）。
- `npm run test:unit`：**68 文件 / 711 例全绿**（改前基线当场自取 = **68 / 708** ⇒ +3 例，例数不减；
  `readings/unit-joined-card.log`）。新增 3 例：`hired` 卡无【加入】、倒计时到点自动可点、匿名三键缺省全【加入】+零写请求；
  另在既有例内补「已加入卡 `data-sf-joined=1` + 徽标 / 未加入卡 0 且无徽标」。
- 探针 `node ops/wage/front/probe-wage.mjs`：**verdict.pass = true、failed = []**，必过项 **90**、`pageErrors = 0`
  （`readings/probe-result-wage-joined.json`、`readings/summary-joined-card.json`）。本单三条新臂：
  - **① 已加入行只有【领工资】**：项目 101 `action=claim`、`claimCount=1`、`joinCount=0`；全列表无一张卡同时有
    join+claim；其余招募中卡 `joinCount=1 / claimCount=0`。已加入卡 `data-sf-joined=1`、徽标「已加入」、全表仅 1 张；
    普通卡 `0` + 无徽标。
  - **② 配色可辨（computed 对拍）**：joined vs plain = 左描边 `4px rgb(255,230,15)` vs `1px rgb(3,4,2)`；
    叠加层 `rgb(255,230,15)/0.12` vs `rgba(0,0,0,0)/1`；390 / 1536 两档同判据全绿且零横向溢出。
  - **③ 倒计时臂（真实时间，不 mock 时钟）**：`next_claim_at = now+6s` ⇒ 置灰 + `0:0x 后可领`、置灰期间点击
    **零 claim 请求**；到点（`waitForFunction claimable=1`）自动可点；领薪成功卡内「已领到 batt 30 与 20 BTTC」，
    重拉后按**服务端新 `next_claim_at`（3h25m=12294s）**重新置灰 —— 与本地间隔兜底（4h=14400s）**不同值**，
    证明「刷新拿新时间」这条链真的走通（而非本地猜）。
  - 客态臂改为**匿名真载荷**（三键整键缺省）：10 张卡全 `role=anonymous`、`joined=0`、无【领工资】；
    8 张招募中全【加入】、2 张已截止无按钮；点【加入】⇒ 卡内登录提示、`writeCalls = []`。

### 边界与待接项（如实披露）

- **后端契约已在同树落库**（`563f816` `feat(project): 列表读口登录态加性 my_role / my_hired_at / next_claim_at`，
  文件面与本单不重叠）：逐字核对 `ProjectListRow` = `my_role('hired'|'none')` + `my_hired_at(string|null)` +
  `next_claim_at(ISO|null)`；**非在职行三键在场**（后两键 `null`）、**匿名行三键缺省** ⇒ 与前端
  `hasKey` / `myRoleOf` 判据一致（`'none'` 不置灰别人的卡，缺键不当 hired）。
  `next_claim_at = max(hired_at, 上次 claim) + wage_interval_hours`（与 claim 结算窗口同一算式）。
  ★ **`POST /api/project/:id/claim` 的响应不含 `next_claim_at`**（现取 `grep -n next_claim_at backend-ts/src`
  只在读口出现）⇒「成功 ⇒ 重拉列表拿新时间」是唯一正确路径，探针 ③ 正按此设计（响应不带、刷新带）。
  前端「优先取 `响应.next_claim_at`」那一支属**契约之外的防御分支**，不影响现行为。
- `docs/**` 未改（本单口径 = 不碰后端/docs）⇒ `docs/route-layer.spec.md` 的 `/api/project/all` 行键集仍是旧口径
  （未记 `my_role` / `my_hired_at` / `next_claim_at` 三键与 `wage.joinedBadge`），需另立规范勘误单。
- 未加入的卡：`data-sf-joined="0"` 且**无任何新增 class / 样式命中**（`.is-joined` 只在 joined 时挂）。

## 项目卡【编辑】收口：单测 5 红定性修复 + 探针编辑三臂（2026-10-21）

### 5 红定性（修前 5 红 → 修后 0 红，逐例归因）

- **`wage-page` ④ 例 —— 测试 bug（缓存跨例污染 + 异步竞态），产品无罪**：
  根因 = `item/item-edit-access.js` 的 `/api/user` 三键缓存是**模块级、按 uID**（产品语义：单页面生命周期内
  零重复请求、换号即重取），而测试全组共用 uID 7 且从不调 `resetListingEditAdminCache()`（该导出即为此设）。
  ①② 组用例（无 token ⇒ `fetchCurrentUser` 前置抛错）缓存保持空 ⇒ ⑤ 组首例（admin 臂）真发 `/api/user`
  并把 ADMIN_OK 写进缓存，但 `setAdminFlags` 异步落定**晚于同步断言** ⇒ 0 钮（首红）；其后各例**继承毒缓存**
  ⇒ 非管理员臂反而出钮（manage_rewards 臂 / 无三键臂 / owner-他人卡臂全中招；ended 臂因 ended 闸在前而幸免）。
  产品侧复核：`canEditCard` = 已登录 ∧ 非 ended ∧（`String(owner_uid)` === `String(uID)` ∨ 三键判 manage_tasks），
  与 route R7 `requireAdmin('manage_tasks')` 同式，**零改动**。
  修法（全为加等待/加证据，断言语义零放宽）：`beforeEach` 复位缓存；admin 臂 `waitFor`【编辑】钮落定（恰 2）；
  负向臂先等 `/api/user` 请求真实发起（载荷无 manage_tasks ⇒ 任何时刻出不了钮）再断「无钮」；四处 admin 依赖
  用例点击前等钮。
- **`i18n-violation-closeout` ② —— 期望常数过期（预期订正，非放宽）**：wage-edit +18 键/语 ⇒ 拍平
  1253→1271；脚本口径「作用域命中节点数 = 拍平键数 × 4」现取 = `node frontend/scripts/p4z-i18nviol-global.mjs`
  输出 **`作用域命中节点数 = 5084（键 1271 × 语 4）`**；旧值 5012 = 1253 × 4。算式：1271 × 4 = **5084**。
  按体例订正该断言并在注释链补 `[i18n-bump wage-edit +18 键 ⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）]`
  留痕（同文件 ⑤ 的 1271 已前推，仅 ② 漏更一处）。

### 门套读数（改前基线当场自取 = 70 文件 / 749 例）

- `npm run build`：**exit 0**（`readings/build-wage-edit.log`）。
- `npm run test:unit`：**70 文件 / 749 例全绿**（例数不减；修后 `readings/unit-wage-edit.log`；
  修前 5 红留痕 `readings/unit-wage-edit-before.log`）。lint 无配置（恒 exit 2，存量口径，不拦交付）。

### 探针（`ops/wage/front/probe-wage.mjs`）：必过判据 90 → **116**，`verdict.pass = true`、pageErrors = 0

（`readings/probe-result-wage-edit.json`；判据只增不减，其中 3 键订正见下。）

- **E1 owner 臂**：恰 103 卡有【编辑】（文案 = `common.edit`），他人卡（101/102/104/108）零钮；
  表单展开预填（title「文案校对」/ headcount `5` / cid+amount `4`+`50` / interval `8` 全对）；
  只改标题保存 ⇒ **PATCH 载荷恰 `{title:"文案校对·周末班"}` 一键**（只含变化字段）、表单收起、
  卡内 `editSaved` 提示、重拉后卡标题更新。
- **E2 manage_tasks 管理员臂**：10/10 卡全有【编辑】（含 hired 101 与 closed 108；仅 ended 封板）；
  可展开**他人卡**表单（预填对）、零 PATCH。
- **E3 普通用户臂**：全零【编辑】、`/api/user` 恰 1 发（三键路径真实跑过、载荷无 admin ⇒ fail-safe 归 owner 判）、
  零 PATCH。
- 探针工程加固：`/api/user` 与 `PATCH /api/project/:id` 进 `context.route` 自截（载荷留痕 + 合并进夹具行，
  保存后重拉读新值）；rows 补 `owner_uid` 契约键（缺省 900001 = 他人）；`STATE.patches` 入库前深拷贝
  （防后续臂 `length=0` 复位清掉已存证据）；adminFlags 异步落定 ⇒ 各臂先 `waitForSelector`【编辑】钮再取快照
  （防冷启动伪影把「未到」读成「没有」）。

### ★ 既有 3 判据订正（非本单引入 · 父版对照定案）

`checkin.checkinButtonPresent` / `checkin.mintAreaPresent` / `checkin.readsWired` 在 **HEAD 探针对拍同红**
（`readings/probe-result-head-checkin-attribution.json`，HEAD 版跑同 dist 同样 3 键红）——契约源 =
`c5fb450`「签到 UI 下线 + BTTC 铸/解迁 /profile/assets」（Kevin 2026-10-20 需求③），当时 /wage 探针漏更。
按新契约 **1:1 更名订正**（90 键计数不减）：`checkinUiRetired`（卡面按钮全零 + 电量表在场）、
`mintAreaRetired`（按钮全零）、`battReadWired`（`/api/batt` 在用 ∧ `/api/checkin` 零调用）——
三条都是「下线不得回归」的反向断言，比旧正向断言更严。

### 边界（如实披露）

- 产品实现面（`WagePage.canEditCard` / `item-edit-access.isWageProjectEditAdmin` / `wage-api.patchWageProject` /
  `wage.css` 编辑表单 / 四语 +18 键）为本批已实现代码，本单做定性修复 + 判据订正 + 探针三臂 + 读数入库；
  23 文件一批提交（含计数前推的 14 个测试文件，逐文件核对均属本单键数链）。
- `docs/**` 未改（本单口径 = 不碰后端/docs）⇒ `route-layer.spec` 未记 `owner_uid` 行键与编辑写口口径，需另立规范勘误单。
