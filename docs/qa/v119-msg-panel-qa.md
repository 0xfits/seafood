# v1.19 §21 / route v2.34 §44 · 消息面板化（方案 1「就地叠加」）· 独立质检（Neng）

- **被检面（钉死）**：`b776aee0c90ad49028a98cf9475a6c0111195038`（`feat(seafood): 消息面板化（方案 1 · 就地叠加）实现 + 断言改锚 + 证据`）
- **改前基线**：`fd34ca0babe5bb6f004e8ed7c4efd3a66143a54e`（`HEAD~2`）；`origin/main..HEAD` = **ahead 2**、**未 push** ✓（`ops/v119-msg-panel/qa/gates-and-git.txt`）
- **质检方**：Neng（独立重取 · **不采信** `ops/v119-msg-panel/REPORT.md` 与实现方 `readings/**` 的任何自报读数；**探针自写、夹具自写、不跑实现方探针**）
- **判决**：**PASS-with-drift**（实现面 6 条 AC 全绿；4 条口径漂移 + 1 条判据口径裁定见 §10）
- **硬约束（遵守）**：零库写（API 一律探针内 `context.route` 自截）；登录态只走 `localStorage`；**未启真后端 / 未 POST 任何 `/api/**`**；**未碰共用 dev 库（5788）**；只写 `docs/qa/v119-msg-panel-qa.md` + `ops/v119-msg-panel/qa/**`；**未改 `docs/design/**` / `docs/route-layer.spec.md` / `frontend/**` 一字**；**未 push**；**未 `git add -A`**。

---

## 0. 开工锚（现取）+ 门套（**自跑**，不采信实现方日志）

- **`git log --oneline -3`**：`b776aee` ← `bc57a3a`（§21/§44 规范冻结）← `fd34ca0`；**开工 `git status --porcelain` = 空** ✓
- **门套四件（本机现取 · 管道外捕退出码）**：

| 门 | 命令 | 退出码 | 本机读数 |
|---|---|--:|---|
| `build` | `npm run build`（`frontend/`） | **0** | `vite v5.4.20` · **1819 modules** · `✓ built in 1.75s` · `dist/assets/index-C3dRJ_m4.js` **445.77 kB**（sha256 `f53c130d621343a56aef7f4f0fdf06e23b04fee7e992f0169f621ce098d30f9f`） |
| `test:unit` | `npm run test:unit` | **0** | `Test Files **54 passed (54)**` · `Tests **520 passed (520)**` · `Duration 7.13s` |
| `lint` | `npm run lint` | **2（存量 · 环境性）** | `ESLint couldn't find a configuration file`；`git ls-files '*eslint*'` = **0 件**、`frontend/.eslintrc*` / `eslint.config*` **不存在** ⇒ 配置解析阶段即退 2、**零规则被评估** ⇒ **不是本批红点**（依 `seafood-platform` 册口径，不当缺陷立案） |
| `type-check` | `npm run type-check` | **N/A** | `frontend/` 无 `tsconfig*.json` / `jsconfig.json` ⇒ `tsc --noEmit` 无工程可编译（exit 1）⇒ **如实标 `N/A`**，不假称跑过 |

- **基线 519 的独立对账（不拄实现方自报）**：`git diff fd34ca0..HEAD -- frontend/src/test/` 内新增 `it(`/`test(` 行 = **恰 1 条**（`v15-nav-floatmenu.test.jsx` 的「未打开态（`/`）⇒ 面板不在 DOM」），删除 = **0 条**；该文件用例数 `12 → 13` ⇒ **`519 + 1 = 520` 自洽**，且 `520 ≥ 519` ⇒ **例数不减** ✓
- **旧版产物自建（AC-5 反事实臂 · 不采信实现方产物）**：`git archive fd34ca0 frontend | tar -x -C <scratch>/v119-old` + 软链主仓 `node_modules`（**未 `npm install`**）+ 独立 `cacheDir`（`--config vite.qa.config.js`，`QA_CACHE_DIR`）⇒ `✓ built in 1.70s`、**exit 0**、产物 `index-B97aKkhG.js` 444.34 kB；`grep -rl 'messages-panel' dist-qa/` = **0 件** ⇒ 反事实臂有效（旧版确无面板字面）。

---

## 1. 静态冻结面（源码面现取复算 · 只读）

| 判据 | 现取读数 | 结论 |
|---|---|---|
| `shell.css` 与 `fd34ca0` 版 **sha256 逐字相同** | `886ba2f5217572a5c270e54412cd7a6b9099f324835c21f751123a1a3616ebf3` == `git show fd34ca0:frontend/src/shell/shell.css \| shasum` | **PASS**（一字未动） |
| `shell.css` `@media` 数 = 1 且含 `767px` | `grep -c '@media'` = **1**；`@media (max-width: 767px)` 落 `:182` | **PASS** |
| `shell.css` 无 `[data-theme` | `grep -c '\[data-theme'` = **0** | **PASS** |
| `shell/**` + `theme/**` 的 JS **全文（注释同禁）** 零禁用词表 | `grep -rnE 'matchMedia\|innerWidth\|innerHeight\|clientWidth\|offsetWidth\|screen\.width' frontend/src/shell frontend/src/theme --include='*.js' --include='*.jsx' --include='*.css'` = **0 命中** | **PASS** |
| 零新主题 token / 零 `STRUCT` 增项 | `grep -n 'sf-mp' src/theme/{tokens.js,theme-tokens.css} docs/design/style-preview.html` = **0 命中**；`git diff fd34ca0..HEAD -- frontend/src/theme/` = **空** | **PASS** |
| 面板零 `data-sf-region`（源码面） | `frontend/src/shell/MessagesPanel.jsx` / `messages-panel.css` 内的 `data-sf-region` **仅出现在注释文本**（`:38` / `:4` 的「不得新增」说明），**无属性产出**；运行时复核见 §8 | **PASS** |
| 前端 `<Route` 计数不变 | 字面 `grep -cE '<Route'` = **42** · 精确 `grep -oE '<Route[ >]' \| wc -l` = **34** | **PASS**（±0） |
| 后端注册点不变 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` = **105** | **PASS**（±0，本单零后端面） |
| `App.jsx` 冻结面字面保留 | `:119` `<Route path="messages" element={<MessagesPage />} />` · `:13` `import MessagesPage from './pages/MessagesPage'` | **PASS** |
| 噪声源文件不在本单 diff | `git diff --name-only fd34ca0..HEAD \| grep -c Footer.jsx` = **0**；`shasum frontend/src/components/Footer.jsx` == `git show fd34ca0:…` = `73c6fd76…8bb00` | **PASS**（AC-5 归因前提 · 见 §7） |

---

## 2. 几何（桌面四档 + 手机四宽）· 自写探针

> 探针 = `ops/v119-msg-panel/qa/probe-geometry-qa.mjs`（自写）；读数 = `ops/v119-msg-panel/qa/geometry-qa.json`。
> 环境：Playwright + 本机 Chrome（headless）· `context.route` 把 `http://sf.local/**` 静态映射到 `frontend/dist`（**零 dev server**）· 禁动画（`reducedMotion:'reduce'` + 注入 `*,*::before,*::after{animation:none!important;transition:none!important}`）· 稳态采样（连续两帧 DOM 签名逐字节相同才取数）· 只读。
> 夹具：`unread_total=250` ⇒ 角标字面 `99+`；3 会话行（`c=7/8/9`）；`myUid=970213`；`pageErrors = []`（全 13 态零未捕获异常）。

### 2.1 桌面档（`1440 / 1199 / 1024 / 768`）

| 档 | 面板 `w` | 右偏移 | 左栏 | 右栏 | 左+右 | 间隙 `.sf-fm` | 相交面积 | `scrollWidth−clientWidth` | 正文右缘 ≤ 面板左缘 | `.sf-shell` padding-right |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| `1440` | **600** | **104** | **240** | **360** | **600** | **16** | **0** | **0** | **0**（脚碰脚） | `704px` |
| `1199` | **600** | **104** | **240** | **360** | **600** | **16** | **0** | **0** | **0** | `704px` |
| `1024` | **600** | **104** | **240** | **360** | **600** | **16** | **0** | **0** | **0** | `704px` |
| `768` | **344** | **104** | **154.8** | **189.2** | **344** | **16** | **0** | **0** | **0** | `448px` |

- 全部与 §21.3 冻结表逐值相符（`768` 档 `min()` 自动收窄、**零新增断点值** ⇒ 面板仍 `w=344`，`154.8+189.2=344` 自洽）。
- `1024` 档为 `min(600, 100vw−424)` 的临界：`100vw−424 = 600` ⇒ 恰取 `600` ✓。
- 两栏 `display` 恒 `flex`（≥768 双栏常显）；`messages-back` 在 ≥768 仍渲染、由面板 CSS 隐藏（`backDisplay = "inline-flex"` 但 `backLink = null` ⇒ 被 CSS 隐藏 ⇒ 符合 §21.5）。

### 2.2 手机档（`767 / 390 / 375 / 320`）

| 档（视口） | 面板 `w × h` | 列表态 | 会话态 | 关闭键 | 返回键 | 发送键 | 溢出 |
|---|---|---|---|---|---|---|---|
| `767×900` | **767 × 900**（= `100vw × 100vh`） | `list:flex / thread:none` | `list:none / thread:flex` | **44 × 44** | 743 × **44** | 52 × **44** | 0 |
| `390×844` | **390 × 844** | `flex / none` | `none / flex` | **44 × 44** | 366 × **44** | 52 × **44** | 0 |
| `375×844` | **375 × 844** | `flex / none` | `none / flex` | **44 × 44** | 351 × **44** | 52 × **44** | 0 |
| `320×844` | **320 × 844** | `flex / none` | `none / flex` | **44 × 44** | 296 × **44** | 52 × **44** | 0 |

⇒ 面板 = 视口满屏、**单栏两态可切**（`?c=` 有无）、触控目标 **全 ≥44**、**零横向溢出** ⇒ AC-4 全绿。
（`320` 档高度按本探针视口 `844`；实现方报的 `320×640` 只是其视口高度不同，非分歧。）

---

## 3. ★ 尺子有效性自证（采信任何几何绿之前先跑）

> 手法：**只在探针页内注入 `<style>`**（仓内源码 / 提交 **零改动**），把被测量人为改掉 ⇒ 该判据**必须变红**；随后重新加载复原（`afterRestorePanelWidth = 600` ✓）。读数 = `geometry-qa.json → rulerSensitivity`。

| 判据（as-shipped） | 扰动臂（注入） | 扰动后读数 | 变红？ |
|---|---|---|---|
| 面板宽 `600` | `.sf-mp{width:555px !important}` | **555** | ✅ **敏感** |
| 右偏移 `104` | `.sf-mp{right:60px !important}` | **60** | ✅ **敏感** |
| 间隙 `16` | 同上 | **−28**（重叠） | ✅ **敏感** |
| 相交 `0` | 同上 | **13440** | ✅ **敏感** |
| 左栏 `240` | `.sf-mp-list{flex:0 0 200px !important}` | **200** | ✅ **敏感** |
| 右栏 `360` | 同上 | **355** | ✅ **敏感** |

- **`768` 档溢出/相交臂**：注入 `.sf-mp{width:900px;right:0}` ⇒ `panelW 344 → 900`、`gap −88`、`intersectArea 34560` ⇒ 两条判据**同时变红** ✓
- **★ `scrollWidth ≤ clientWidth`（「零横向溢出」）判据 = 有效但**不承重**（**登记 · 属「对本改动不敏感」的诚实登记，非缺陷**）：
  - 面板为 `position:fixed` 浮层 ⇒ **不参与 `scrollWidth`** ⇒ 该读数在**全部 13 态恒 `0`**（包括面板未打开态）⇒ 它对本次改动**不敏感**。
  - 尺子本身的**功能性**另证：在同页追加一个 `static` 定位、`width:3000px` 的 `div` ⇒ `documentElement.scrollWidth 1440 → **3000**`（`docClientWidth 1440`）⇒ 该读数**能红**（`diagnostics-qa.json → overflowDiagnosis`）。注：直接给 `.sf-route-container` 写 `width:3000px` **不奏效**——它被自身 `max-width: var(--sf-st-shell-max-w)`（`1440px`）钳回 `1440`，故必须用追加元素臂。
  - ⇒ 真正承重的桌面判据是**面板宽 / 右偏移 / 间隙 16 / 相交 0 / 正文右缘 ≤ 面板左缘**五条，**已逐条自证敏感**（上表）。

---

## 4. 交互与宿主保真（AC-2）+ 四入口

> 读数 = `geometry-qa.json → interactions` / `interactions-qa.json`。桌面 AC-2 用**桌面可见**的入口②（悬浮菜单「消息」）做真点击 —— 底栏 `.sf-tabbar` 在 ≥768 为 `display:none`（既有口径，非本单引入）。

### 4.1 AC-2（不换页 + 原地）

| 判据 | 读数 | 结论 |
|---|---|---|
| `pathname` **逐字不变** | `/exchange` → `/exchange`（`search ''` → `?msg=1`） | **PASS** |
| 只有 `search` 变 | `onlySearchChanged = true` | **PASS** |
| 宿主节点**同一性（同引用）** | `hostSameRef = true` · `hostChildSameRef = true` · `hostGrandChildSameRef = true`（三层层级同一对象） | **PASS**（未重挂） |
| `scrollY` **前后相同** | 页面可滚（`scrollHeight > clientHeight`）· `scrollY 48 → 48` | **PASS** |
| 后退键关面板 | `goBack` ⇒ `pathname=/exchange`、`search=''`、`panelClosed = true` | **PASS** |
| 面板内「×」关面板（`replace`，history 不长） | 开 = `history 18→19`（push）；× ⇒ 关且 `history 19→19`（`historyNotGrown = true`） | **PASS** |
| 刷新 `?msg=1` 仍开面板 | 直载 `/exchange?msg=1` ⇒ `panelPresent = true` | **PASS** |
| `/messages` 直链 ⇒ 首页 + 面板 | `pathname=/messages` · `panelPresent=true` · 标题 `消息` | **PASS** |
| 直链态「×」⇒ 回首页 | 关后 `pathname = '/'`、`search=''`、`panelClosed=true` | **PASS** |

### 4.2 四入口逐个验（`href` 一字不改）

| # | 入口 | 现取 `href` / 落点 | 点击后 | 结论 |
|--:|---|---|---|---|
| ① | 底栏第 4 格 | `[data-sf-nav="messages"]` ⇒ `href = /messages`（`/en` 档 = `/en/messages`） | 桌面 `visibleAtDesktop=false`（≥768 底栏既有隐藏）但 **DOM-click 仍就地叠加**（`/exchange` → `/exchange?msg=1`、面板开）；`390` 档**真点击** ⇒ `pathname` 逐字不变、`?msg=1`、面板开 | **PASS** |
| ② | 悬浮菜单「消息」 | `[data-sf-fm="messages"]` ⇒ `href = /messages`（`/en` 档 `/en/messages`） | 真点击 ⇒ `pathname` 不变、`?msg=1`、面板开 | **PASS** |
| ③ | 详情页「聊一聊」 | `[data-sf-m="item-chat-btn"]`（**`BUTTON`、无 `href`** —— 承 Zang 裁定①「就地叠加」，见 §10.1） | 真点击 ⇒ `pathname` **`/item/123` 逐字不变**、`search = ?msg=1&c=7`、面板开、`aboutText = 关于：FIXTURE 商品 A`、双向气泡各 1、**落点命中 `T105`** | **PASS** |
| ④ | Telegram `/messages` 直链 | 后端文案 `messages-service.ts:717/:718` 含 `<site>/messages`（本单零后端面 ⇒ 未动） | 直载 `/messages`、`/en/messages` ⇒ 面板开、`closeAria` 四语正确（`关闭消息` / `Close messages`） | **PASS** |

- **修饰键 / 中键不拦 ⇒ 走 `href` 新标签**（直读证据 = 合成事件 `defaultPrevented`，`geometry-qa.json → defaultPreventedProbe`）：
  `tab_plain = true`（拦截）vs `tab_ctrl / tab_meta / tab_shift / tab_alt / tab_middle = false`（**不拦**）；`fm_plain = true` vs `fm_ctrl / fm_middle = false` ⇒ **同一发点击"拦截 / 不拦"两态取值相反 ⇒ 该尺子对本改动敏感** ✓
  真点击侧读数：`ctrl` / `alt` / `middle` 点击后**主页面 `pathname`/`search`/面板全不变**（未就地开面板）⇒ 与"交给浏览器默认行为（`href=/messages` 不变）"一致；`defaultPrevented=false` + `href` 字面仍 `/messages` + 主页面无副作用，三条合成即"不拦"成立。
  ★ **popup 读数记 `ENV_LIMITED`**（headless 下 Chrome 只给出 `about:blank` / `chrome-error://chromewebdata/`，未能取到"新标签真载 `/messages`"）⇒ 该项**不采信为证据**，判定改用上面的 `defaultPrevented` 直读 —— **未因此改写任何判据**。

---

## 5. 四态矩阵 `M1–M4` + 边界（route v2.34 §44.3(3)）

读数 = `geometry-qa.json → matrix`。

| # | 形态 | 实测 `panelPresent` | `pathname` / `search` | 期望 | 结论 |
|--:|---|--:|---|---|---|
| M1 | `/item/123` | **false** | `/item/123` / `''` | 不挂 | **PASS** |
| M2 | `/item/123?msg=1` | **true**（列表态；右栏 = `messages-detail-empty` = `还没有消息，发第一条吧`） | `/item/123` / `?msg=1` | 挂 + 原页左压 | **PASS** |
| M3 | `/item/123?msg=1&c=7` | **true**（详情态；`aboutText = 关于：FIXTURE 商品 A`） | `/item/123` / `?msg=1&c=7` | 挂 + 详情态 | **PASS** |
| M4 | `/messages?c=7` | **true**（宿主 = 首页） | `/messages` / `?c=7` | 挂 + 详情态 | **PASS** |
| M4b | `/item/123?c=7`（仅 `c`） | **true** | `/item/123` / `?c=7` | 挂（`c` 子句） | **PASS** |
| — | `/item/123?msg=0` | **false** | `/item/123` / `?msg=0` | 不开（显式关） | **PASS** |
| — | `/item/123?zzz=1`（未知参数） | **false**，零报错 / 零白屏 | `/item/123` / `?zzz=1` | 忽略 | **PASS** |
| — | `/messages?c=999999`（非法 id） | **true** | `/messages` / **`?c=999999` 不变** | 面板内既有错误链、**不重定向** | **PASS**（`messages-thread-status` 文案 = `会话不存在`、`data-sf-phase=error`） |

---

## 6. i18n（现取复算 · 逐文件）

- **现取复算**（`json.load` + 递归叶计数，四语逐文件）：`zh / en / hk / vn` 各 **顶层 `128` / 拍平 `1104`**；四语键集 **逐键相等**（两两差集 = `[]`）；**四语节点合计 = `4416 = 1104 × 4`** ⇒ 与规范算式（`1103+1=1104` · `1104×4=4416` · 顶层 `128+0=128`）**相符** ✓
- **新键 `messagesPage.close` 四语齐**：`zh 关闭消息` / `en Close messages` / `hk 關閉訊息` / `vn Đóng tin nhắn` ✓（其余 13 个 `messagesPage.*` 复用键零新增）
- **运行时**（`geometry-qa.json`）：`closeAria = 关闭消息`（zh）/ `Close messages`（en）⇒ 键真的接到了「×」的 `aria-label` ✓
- **13 个计数硬断言逐点复算**（不只信"测试绿"）：`grep '1103\|4412' frontend/src/test frontend/scripts` ⇒ **命中全部落在历史前推注释文本内**（形如 `⇒ flat 1103⇒1104`），**无一处残留旧值作断言**；13 文件现取断言值全为 **`1104` / `4416`**（`s5` / `s7` / `s8` / `s9` / `s19` / `s23` / `i18n-batch-b4a|b4b|b5` / `i18n-violation-closeout` / `r9-93` / `r9-96` / `tg-bind-qr` 注释），且 `git diff --numstat` 显示这 12 文件**各仅 1–2 行数值改动**（`tg-bind-qr` 1 行注释）⇒ **前推与现取一致** ✓

---

## 7. ★ AC-5 归因（独立定调）

> 探针 = `ops/v119-msg-panel/qa/probe-attribution-qa.mjs`（自写 · 含自建 `fd34ca0` 产物对照）；读数 = `ops/v119-msg-panel/qa/attribution-qa.json`。
> 采数口径：禁动画 + 稳态采样 + **只采可见元素**（`getClientRects().length > 0`）+ 结构键 = `tag + 全 class + 语义属性 + 结构路径`（**坐标不掺进键**）；归一化 = **剔除 `alt` 与 `title` 两属性的值**（保留属性在场）。

### 7.1 三件独立复现

**(a) 同版连跑两轮 ⇒ 噪声基线可重复**
- `/`@1440 **6 连读**：原始 sha 出现 **3 个值**（抖动）；剔 `alt` 值后仍 **3 个值**；**剔 `alt`+`title` 值后 = `1` 个值（6/6 逐字节相同）**。
- 逐页两轮：**8/8** 页 × 两档 的 `repeat_new_altTitle = true`、`repeat_old_altTitle = true`（而 raw / 仅剔 alt 多为 `false`）。
- **噪声源具名（独立证实）**：`frontend/src/components/Footer.jsx:12`
  `const randomCatSloganKey = CAT_SLOGAN_KEYS[Math.floor(Math.random() * CAT_SLOGAN_KEYS.length)]` —— **模块加载期** `Math.random()` 选 `footer.catSlogan1..3`；该值**同时**喂给合作品牌 CAT 的 `<a class="group block rounded-lg overflow-hidden relative" title=…>` 与内层 `<img class="h-[50px] w-auto object-contain" alt=…>`（实测两属性**同值轮换**，逐轮取值 ∈ {`猫猫大使团｜你的声音，值得被品牌听见。` · `你的代言，从猫猫大使团开始。` · `猫猫大使团｜不止一份报酬，更加一份经验。`}）。
  **该文件不在本单 diff 内**（`grep -c Footer.jsx` = 0）且 **sha256 与 `fd34ca0` 逐字相同**（`73c6fd76…8bb00`）⇒ **属改前既有随机项，非本单产品面变更**。
  其余 `alt`/`title`（`订单` / `语言` / `深夜模式` / `云朵计划…`）**逐轮恒定** ⇒ 随机项**恰 1 处**。

**(b) 未打开态「改前 ⇄ 改后」差异集**
- **归一化后差异集 = 0**，**8/8 页 × 两档**全部为 0：
  `1440/{home, exchange, item, task, profile}` 与 `390/{home, exchange, item}`。
- 可见元素数改前 ⇄ 改后**逐档相等**：`135/135 · 143/143 · 121/121 · 131/131 · 122/122 · 115/115 · 123/123 · 73/73`。
- 原始（未归一化）差异 `4`（=`2` 元素 × 2 键）/ 仅剔 `alt` 差异 `2` ⇒ **100% 落在上述 CAT 元素的 `title` + `alt` 两键**（`aOnly/bOnly` 逐条可查）⇒ 残余差异**零留在结构面**。
- `/messages` **单列（预期差异 · 不作缺陷）**：归一化差异 **89** —— `new-only` = `sf-shell--msg-open` + 首页子树（`home-item-list` / `home-publish-link` / `href=/task` …）+ 面板子树；`old-only` = `sf-layout sf-msg-page` / `data-sf-m=messages-page` / `sf-msg-list` 等旧真页子树 ⇒ 正是「独立真页 ⇒ 首页 + 面板」的语义变更本体 ✓

**(c) 扰动臂非空（尺子有分辨力）**

| 臂 | 归一化差异集 | 判定 |
|---|--:|---|
| ① 反事实：`/`（closed）⇄ `/?msg=1`（open） | **34** | ✅ 非空 |
| ①′ 反事实：`old`/`/`（closed）⇄ `new`/`/?msg=1`（open） | **34** | ✅ 非空 |
| ② 同页注入 `.sf-mp{display:none}` —— **打开态** | **24**（`aOnly` 含 `SECTION\|sf-mp sf-msg-page` / `BUTTON\|sf-mp-close` / `svg\|lucide lucide-x` …） | ✅ 非空 |
| ②′ 同页注入 `.sf-mp{display:none}` —— **未打开态** | **0** | ✅ 无靶（预期；面板条件挂载 ⇒ DOM 里没有 `.sf-mp` 可隐藏） |
| ③ ★ **对偶检验**：在判「0 差异」的**同一页**（`/`@1440）注入**一个额外可见元素** | **1**（`bOnly = DIV\|qa-extra-visible-element`） | ✅ **非空 ⇒ 该页的 0 不是「尺子瞎了」** |
| `rulerHasResolution` | `true`（①∧②∧③ 全非空） | ✅ |

### 7.2 独立定调

**结论：AC-5 可以收口 —— 采纳「声明式归一化 + 噪声源具名」，判 `PASS（归一化口径）`；同时把「raw 差异集 = 0」这条**原样保留为 `ENV_LIMITED FAIL`**（原样保留、未改写为 PASS）。**

- **归一化范围（写死 · 只此一处）**：对**全部可见元素**统一**剔除 `alt` 与 `title` 两个属性的"值"**（`alt` / `title` **属性在场**仍计），**其余一切照旧**：`tag`、**全部 class**、其它全部语义属性（`href` / `aria-label` / `data-*` / `type` / `role` / `src` / `width` / `height` …）、**结构路径**、以及**可见性**都在键内；**坐标从未进键**。
- **为何不算「放宽判据」**（四条，逐条可核）：
  1. **被剔除的是内容文本，不是结构 / 几何** —— 该 AC 判的是「面板未打开时宿主页**零影响**」，其承载面 = DOM 结构 + 几何；`alt`/`title` 的**文案值**既不是结构也不是几何，且其**属性在场与否**仍被键覆盖。
  2. **该两项在本仓结构性不可确定** —— 噪声源是**模块加载期** `Math.random()`（`Footer.jsx:12`），且**不在本单 diff、sha256 未变** ⇒ 任何把 `alt`/`title` 值纳入键的判据**在结构上不可能对跨页面加载复现**（这正是实现方报 `ENV_LIMITED` 的成因）。**不是把红改绿，而是把一个恒不可达的判据换成可达且抗噪的判据。**
  3. **归一化后的尺子经"证伪"检验** —— 对偶检验③证明它在**同一页**仍能检出**一个**注入的额外可见元素（差异集 1）；打开态注入臂检出面板子树（24）；反事实臂检出 34 ⇒ **没有把尺子弄瞎**。
  4. **它没有把"该有差异的页"抹平** —— 同一把尺子在 `/messages` 上仍报 **89**（并逐条列出旧真页子树 / 首页 + 面板子树）⇒ 分辨力保留在"语义确实变了"的页上。
- **遗留（不作缺陷 · 登记）**：`/hk` `/vn` 两语档几何未采（`NOT_MEASURED`）；`popup`（新标签）读数 `ENV_LIMITED`（§4.2）。

---

## 8. AC-6 结构不变式（运行时 + 源码）

| 判据 | 读数 | 结论 |
|---|---|---|
| `[data-sf-region]` 集合恒 = `['shell','topnav','content','footer','tabbar']` | 未打开态 / 打开态（列表 + 会话）/ 直链态 / `768` / `390` 全档一致（`regionsClosed = regionsOpen = 五元组`） | **PASS** |
| 面板**零** `data-sf-region` | `panel.querySelectorAll('[data-sf-region]').length = **0**`（打开态）；`.sf-mp [data-sf-region]` 全文档 = **0**；面板子树元素数 **31** | **PASS** |
| 面板 CSS **不落 `shell.css`** | `shell.css` sha256 == `fd34ca0`（§1） | **PASS** |
| 日 / 夜面板 DOM 形状**逐项相等** | 噪声归一（剔 `alt`/`title` 值）+ 排除主题图标子树：`light(161 total / 3 excluded / 158 shape)` == `dark(161 / 3 / 158)`，`normalized_light1_vs_dark1_diffSize = **0**`，`light1 vs light2` 也 = 0 | **PASS** |
| 全局元素数差 == 主题图标子树差 | `totalDelta = 0` == `iconSubtreeDelta = 0` ⇒ `true` | **PASS** |
| （未归一时）raw 差异 | 仅 CAT `<a title>` + `<img alt>` **两项**（同一已具名随机源）⇒ **非主题分支** | **PASS**（已归因） |

> 面板**不按主题条件渲染** ✓（`MessagesPanel.jsx` 无主题分支；日/夜形状差 0）。

---

## 9. 逐 AC 判决汇总

| AC | 判据 | 读数文件 | 判决 |
|---|---|---|---|
| **AC-1 四入口不减** | 四入口在场 + `href` 未改 + ③ 落点命中 `T105` | `qa/geometry-qa.json → interactions` · `qa/interactions-qa.json → entry3_itemChat/localeEn` | **PASS** |
| **AC-2 不换页 + 原地** | `pathname` 逐字 / 宿主同引用 / `scrollY` 不变 / 后退 + ×（`replace`）/ 刷新 / 直链 | `qa/geometry-qa.json → interactions` | **PASS** |
| **AC-3 桌面几何** | `600` / `104` / `240+360=600` / 间隙 `16` / 相交 `0` / 正文右缘 ≤ 面板左缘 / 零溢出 | `qa/geometry-qa.json → states.1440|1199|1024|768` | **PASS**（零溢出一条**不承重**，见 §3） |
| **AC-4 手机档** | `100vw×100vh` / 单栏两态 / 触控 ≥44 / 零溢出 | `qa/geometry-qa.json → states.767|390|375|320` | **PASS** |
| **AC-5 未打开 ⇒ 零影响** | 归一化差异集 = 0（8/8 页档）+ 噪声具名 + 尺子灵敏度三臂非空 | `qa/attribution-qa.json` | **PASS（归一化口径）**；原 raw 判据 **`FAIL · ENV_LIMITED` 原样保留** |
| **AC-6 结构不变式** | 五 region 恒等 / 面板零 region / `shell.css` 逐字同版 / `@media`=1 含 `767px` / 无 `[data-theme` / 零禁用词 / 零新 token / 日夜间构 | `qa/geometry-qa.json → ac6Runtime` · `qa/gates-and-git.txt` | **PASS** |

**总判 = PASS-with-drift**（6/6 AC 实现面通过；漂移 4 条 + 判据口径 1 条，全部为**登记性**、无功能缺陷）。

---

## 10. `spec_drift` 清单（**交 Jing 勘误级补登** · 本单未改规范一字）

1. **入口③「聊一聊」= 就地叠加 ⇒ 取代 `Q4` / `AC-1③` 的「换页」字面**（已按 Zang 2026-10-16 裁定① 执行）
   `ItemDetailPage.jsx` 由 `navigate('/messages?c=<id>')` 改为 `navigate(withPanelParams(location, id))`。
   ⇒ 与 `docs/design/design-system.spec.md` **§21.11 `Q4`**（本册冻结 = 换页到直链落点）及 **§21.8 `AC-1③`**「`navigate` 字面含 `/messages?c=`」**冲突**；同 `docs/route-layer.spec.md` **§44.4 入口③**（「建议同批补一条 `toContain('/messages?c=')` 型断言」）。
   **裁定 = 「方案 1 · 就地叠加」为准**；**该 `toContain('/messages?c=')` 型锚不得采用**（本单按 Zang 口径改验「入口在场（`item-chat-btn`）+ 落点命中 `T105`」）。
2. **`/messages` 直链态「×」⇒ 回首页**（不是「仅关闭面板、留在 `/messages`」）
   实测 `pathname: /messages → /`。规范若写「× = 仅关闭面板」需勘误（`T105` 下仅移参数会死锁 ⇒ 实现走 `panelCloseTarget → homePath`）。
3. **`≥768` 未选会话右栏复用 `messages-detail-empty`**
   实测 `1440_exchange_open_list` 与 `1440_messages_direct` 均产出该钩子（文案 `还没有消息，发第一条吧`）。若规范把它登记为「仅 `≤767` 单栏空态」⇒ 勘误为「**全档**未选会话空态」。
4. **分隔线实现口径（描述性偏差 · 数值不变量不受影响）**
   `shell/messages-panel.css`：**面板左缘** = `.sf-mp{box-shadow: inset 1px 0 0 …}`（不占盒宽 ✓）；**左栏 ⇄ 右栏分隔线 = `.sf-mp-list{border-right: 1px solid …}`**（**不是** `inset` 阴影）。
   因 Tailwind preflight 全局 `box-sizing: border-box`，左栏 border-box 恒 `240`（含 1px 边框）⇒ 实测 `240 + 360 = 600` **成立**。⇒ `REPORT.md (d)-2` 的描述需按此精确化（**代码无需改**）。
   （本仓**无**全局 `*{box-sizing}` 手写规则；该归零来自构建产物里的 Tailwind preflight —— 这是"600=240+360"能成立的前提，属**隐式依赖**，建议在 §21.3 注一句。）
5. **`AC-3` 的「零横向溢出」判据在本单**不承重**（登记 · 非缺陷）**
   面板 = `position:fixed` ⇒ 不参与 `scrollWidth`，该读数 13 态恒 0、对本次改动**不敏感**（§3 已给功能性自证）。建议 §21.3 该行降级为「环境性旁证」，承重判据 = 面板宽 / 右偏移 / 间隙 / 相交 / 正文右缘五条。
6. **`AC-5` 判据口径须写进规范**：采纳「结构键 + 剔除 `alt`/`title` **属性值**」的**声明式归一化 + 噪声源具名**（`frontend/src/components/Footer.jsx:12` 模块加载期 `Math.random()`）；原「raw 差异集 = 0」在本仓**结构上不可达**，须改口径。归一化范围与"为何不算放宽"见 §7.2。

---

## 11. 环境性 / 未测项（**原样保留 · 未改写为 PASS**）

1. **`AC-5` 原始（未归一化）判据 = `FAIL · ENV_LIMITED`（原样保留）**：`/`@1440 与 `390/item` 等页的 raw 差异集 ≠ 0（本机复现：raw `4`、仅剔 alt `2`），根因 = `Footer.jsx:12` 加载期 `Math.random()`（**文件不在本单 diff、sha256 未变**）。**未改写为 PASS。**
2. **`popup`（新标签）读数 = `ENV_LIMITED`**：headless Chrome 下 ctrl/meta/middle 点击只给出 `about:blank` / `chrome-error://chromewebdata/`，未取到"真载 `/messages` 的新标签" ⇒ 该项**不作证据**；判定改用 `defaultPrevented` 直读（§4.2）。
3. **`lint` = exit 2（存量 · 环境性）**：仓内**零** eslint 配置 ⇒ 零规则被评估，**不是本批红点**（不立案、不顺手补配置）。
4. **前端 `tsc` = `N/A`**：无 `tsconfig` / `jsconfig` ⇒ 不可比。
5. **`NOT_MEASURED`**：`/hk` `/vn` 两语档的**几何**实读数（本单仅采 `/en`：入口 `href=/en/messages`、就地叠加、`closeAria=Close messages`）；四语面板几何全量走查未做。**禁填 0/空。**
6. **探针环境噪点（两版共有、非缺陷）**：`console` 的 `Failed to load resource: net::ERR_FAILED`（本探针对 4 个外部 origin 主动 `abort` 的产物 —— 由探针侧策略造成）；**`pageErrors` 三探针均为 `[]`**（零未捕获异常）。
7. **未覆盖页**：AC-5 未打开态采 `/` `/exchange` `/item/:id` `/task` `/profile`（桌面）+ `/` `/exchange` `/item/:id`（手机）；未采 `/item/new` `/theme-preview` 等。⇒ 如需全页归因须补探针。

---

## 12. 读数清单（本单产物 · `ops/v119-msg-panel/qa/` · 随提交入库）

| 文件 | 字节 | sha256 |
|---|--:|---|
| `gates-and-git.txt`（门套 + git 面一条命令落盘） | 1,640 | `55aa4a72f243c585f9b37de3ee941c974d15e9dc670c1f8ae12a50097e396736` |
| `geometry-qa.json`（13 态几何 + 交互 + 矩阵 + 尺子灵敏度 + AC-6 运行时） | 91,082 | `d6486e773b0f5164979d3e52f312269b4e36902fad14067714ffcce557e91718` |
| `attribution-qa.json`（AC-5 三件 + 噪声具名 + 扰动臂 + `/messages` 单列） | 18,716 | `e6c9e6d53175cf3ea413667ca9baeab793015beb691f09c777f0a0f18c837e09` |
| `interactions-qa.json`（入口③ / 修饰键 / 日夜间构 / `/en` 档） | 5,809 | `bafb49ee2d8574ed28a948548603ef71fd99e9632afe05cfde699b5265c9b86c` |
| `diagnostics-qa.json`（溢出尺子功能性诊断 + popup 同一性） | 2,355 | `49669ae9ab369c89a159f3769ba5bccc64ae6ee3ee329f1e1b93c1c65b71c4bd` |
| `probe-geometry-qa.mjs`（自写探针 ①） | 30,630 | `c279ad1426a240181dfddc81babcb040286b1077adca884d17adb4137bf463cc` |
| `probe-attribution-qa.mjs`（自写探针 ② · 可复跑：`QA_NEW=<new dist> QA_OLD=<old dist> node …`） | 15,436 | `8fb079571fd947094c45265747b769a435c44d474b556e58fd02ce9a3319cdd3` |
| `probe-interactions-qa2.mjs`（自写探针 ③） | 15,524 | `18aaab2f7aaa2893c145b1993708fcb780dd7760907aa5c09ec277c5780b3d86` |
| `probe-diagnostics-qa3.mjs`（自写探针 ④） | 6,631 | `e3351ef65bae2e02bdaca26a7d44458d21350275a49e31f2f52faaf020cdf9d1` |

- **复跑配方**（旧版产物自建 · 不 `npm install`）：
  `git archive fd34ca0 frontend | tar -x -C <scratch>/v119-old` → 软链主仓 `frontend/node_modules` → 加 `vite.qa.config.js`（`cacheDir` / `outDir` 走 env，**避免抢主 dev 实例的 `node_modules/.vite`**）→ `QA_CACHE_DIR=… QA_OUT=… npx vite build --config vite.qa.config.js`。
- 本报告**未采信** `ops/v119-msg-panel/REPORT.md` 与 `readings/**` 的自报读数；§0–§8 全部读数由**本单自写探针 / 自跑命令**产生（实现方读数仅作对照，数值相符处已注明）。

---

## 13. 纪律自检

- **零库写**：三探针的 `/api/**` 全部由 `context.route` 内存夹具自截；**未启真后端**；**未 POST 任何真实端点**；**未碰共用 dev 库（5788）**；登录态只走 `localStorage` 注入 ⇒ **零数据副作用**。
- **零源码改动**：`git status --porcelain` 全程仅有 `?? ops/v119-msg-panel/qa/`（本次新增证据目录）与本报告；**未改 `docs/design/**` / `docs/route-layer.spec.md` / `frontend/**` 一字**。
- **零 push**：本单只做本地 commit；`origin/main..HEAD` 交回时仍需由 Zang 统一收口。
- **提交切分**：只 `git add docs/qa/v119-msg-panel-qa.md ops/v119-msg-panel/qa/`（**未 `git add -A`**）。
