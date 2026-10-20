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
