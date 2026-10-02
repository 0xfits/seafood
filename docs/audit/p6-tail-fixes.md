# P6 · FE-TAIL 前端小尾巴批（四项收口）· Kong

- **仓库**：`/Users/kevin/bistro/seafood`（前端 `frontend`，Vite + React 18 + vitest）
- **口径**：读数 = **本机现取实测**；退出码**直接取自命令自身**（`cmd > log 2>&1; echo EXIT=$?`，不经管道，§5.7 ①）；
  「实测」= 真浏览器（CDP）或真跑命令；「现取」= 当场读源码。**本报告 0 处把代码推断写成实测**。
- **硬边界**：写集 = `frontend/src/**`（四项涉及面）、`frontend/src/test/unit/**`、本文件。
  **未写**：`backend-ts/**`、`migrations/**`、`vercel.json`、`index.html`、`vite.config.js`、`frontend/src/locales/*.json`、
  `frontend/src/theme/tokens.js`、spec、`docs/seafood.master-plan.md`、`.env*`。
  **未用**：`git add/commit/push`、`npm install`、`vercel`、`pkill -f`、`killall`；未动 5787（自起 5791，收工按精确 PID 关）。

---

## ① 乙族残留：硬编码绝对站内链接丢语言前缀（10 处 / 6 文件）

### 1.1 唯一入口（现取，不另造第二套）

| 项 | 值（现取） |
|---|---|
| helper | `buildLocalizedPath` @ `frontend/src/utils.js:115` |
| 签名 | `buildLocalizedPath(lang, path = '/')` → `string` |
| 契约 | `zh` ⇒ 原样返回站内路径；`en/hk/vn` ⇒ `/<lang><path>`；语言非法/缺失 ⇒ 等同 `zh`（**输出不含 `undefined`**） |
| 取 lang 口径 | `getLanguageFromUrl(window.location.pathname)`（`utils.js:54`，白名单 `SUPPORTED_LANGS`，与既有 19 处改法同源）；**不新增 hook**（不引 `useLocation`，避免牵入路由上下文） |

现取清单尺子 = `node scripts/p4z-miscfix-links.mjs`（既有唯一扫描器，口径：去注释后的 `to="/…"` / `navigate('/…'` 字面量；`/api/…` 不计）。
**改前**：`残留 = 10`（`/api` 0、协议相对 0）；**改后**：`残留 = 0`、`未登记残留 = 0`、**总判 PASS**（`EXIT=0`）。

### 1.2 逐点判定（现取行号 + 用途）

| # | 文件:行 | 原写法 | 用途（现取上下文） | 判定 |
|---|---|---|---|---|
| 1 | `components/ActiveTaskModal.jsx:31` | `navigate('/login')` | 提交前 token 缺失 ⇒ 跳登录 | **本次改** |
| 2 | `components/ActiveTaskModal.jsx:40` | `navigate('/login')` | JWT 非三段（格式非法）⇒ 清会话跳登录 | **本次改** |
| 3 | `components/ActiveTaskModal.jsx:61` | `navigate('/login')` | 提交返回 401（会话失效）⇒ 跳登录 | **本次改** |
| 4 | `pages/DashboardPage.jsx:211` | `navigate('/login')` | 后台会话失效 ⇒ 跳登录 | **本次改** |
| 5 | `pages/DashboardPage.jsx:296` | `to="/"`（`<Button as={Link}>`） | 「返回首页」按钮 | **本次改** |
| 6 | `pages/admin/PermissionsManagement.jsx:115` | `navigate('/login')` | 保存前无 `Authorization` ⇒ 跳登录 | **本次改** |
| 7 | `pages/admin/PermissionsManagement.jsx:174` | `navigate('/login')` | 删除前无 `Authorization` ⇒ 跳登录 | **本次改** |
| 8 | `pages/admin/PointsManagement.jsx:110` | `navigate('/login')` | 后台会话失效 ⇒ 跳登录 | **本次改** |
| 9 | `pages/admin/SystemSettings.jsx:84`（改后 85） | `navigate('/login')` | 后台会话失效 ⇒ 跳登录 | **本次改** |
| 10 | `pages/admin/UsersManagement.jsx:91` | `navigate('/login')` | 后台会话失效 ⇒ 跳登录 | **本次改** |

**额外发现（扫描器口径外，本单一并收口）**：`components/ActiveTaskModal.jsx:74` 原为模板字面量 `navigate(\`/task#pending-verification\`)` —— 同族缺陷（丢语言前缀），但**既有扫描器正则只认单/双引号**，故从未登记。已改为
`navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/task') + '#pending-verification')`（`/task` 在 LangShell 前缀路由内 ⇒ 加前缀正确）。

**登记不改（不适用，非遗漏）**：`pages/admin/UsersManagement.jsx:303` `navigate(\`/dashboard/points?q=…\`)` —— 管理面路由
`/dashboard/*` 在 `App.jsx:228-244` **刻意不带语言前缀**；若加前缀会产出**不存在**的 `/en/dashboard/points`（`/en/*` 由 LangShell 承接）。
⇒ 该链接**不应**走前缀构造，登记为「不适用」。同理可解释：admin 页 `pathname` 恒为 `/dashboard/…` ⇒ `getLanguageFromUrl` 恒 `zh` ⇒ 上述 9 处 admin/login 跳转**零行为变化**（仅消除硬编码字面量、统一入口）。

### 1.3 admin 守卫未被绕过（证明，实测读数）

守卫链（现取，**本单未改**）：`getStoredUser()` → `fetchAdminAccess()` → `accessInfo.can_access_admin` → `hasAdminPermission(access,'manage_permissions')`（页内）；
路由级 `ProtectedRoute adminOnly`（`App.jsx:228-244`）**本单未碰**。本单对该 4 文件只改「import 一行 + 跳转目标一处」。
行为证明（新用例 `src/test/unit/p6-tail.test.jsx`，`npx vitest run` ⇒ **EXIT=0 / 7 passed**）：

| 态 | 读数（断言实测） |
|---|---|
| 未登录（`getStoredUser→null`） | `toast.error` 被调用 ✓；`fetchApiJson` **零调用** ✓；`fetchAdminAccess` **零调用** ✓ |
| 非 admin（`can_access_admin:false`） | `toast.error` 被调用 ✓；`fetchApiJson` 未以 `/api/admin/permissions` 调用 ✓ |
| admin（正对照） | `fetchApiJson('/api/admin/permissions', …)` 被调用 ✓（证明守卫只拦非法态、未误伤合法态） |

---

## ② 共享件加固：`components/ui/Tabs.jsx`（同族复发风险）

现取共享件路径 = `frontend/src/components/ui/Tabs.jsx`（`TabsList` @:19-30、`TabsTrigger` @:32-53）。
本单**先改共享件**，再复核全部使用点。

**加固内容**：`TabsList` 类名增 `max-w-full overflow-x-auto`（长标签超宽时**在列表内横向容纳**，不再把文档撑宽）；
`TabsTrigger` 增 `min-w-0`（grid/flex item 最小宽度守卫）。

### 2.1 改前 / 改后读数（真浏览器 390×844，`Emulation.setDeviceMetricsOverride`）

在 `/en/task` 上**把页面级修复（`grid-cols-2 sm:grid-cols-4`）临时还原为历史破配置 `grid-cols-4`**，逐档切换共享件加固项，测文档级溢出：

| 配置 | `documentElement.scrollWidth` / `clientWidth` | 文档溢出 | TabsList `scrollWidth` / `clientWidth` | TabsTrigger 最大内容溢出 |
|---|---|---|---|---|
| **A 历史破配置，无加固** | **397 / 390** | **+7px**（复现登记缺陷精确值） | 371 / 338 | 36 |
| B + `TabsTrigger.min-w-0` | 397 / 390 | +7px（**单独无效**） | 371 / 338 | 36 |
| **C + `TabsList.max-w-full.overflow-x-auto`** | **390 / 390** | **0** ✅ | 371 / 338 | 36 |
| D C + `TabsTrigger.overflow-hidden` | 390 / 390 | 0 | 338 / 338 | 36 |
| E 现状（页面 2/4 列 + 本单加固） | 390 / 390 | 0 | 338 / 338 | — |

⇒ **有效项 = `TabsList` 的 `max-w-full` + `overflow-x-auto`**；`min-w-0` 单独**无效**（B≡A，如实记录；作为 item 守卫保留）。
D 证明「容器级容纳」已足够，**不需要**给触发按钮加 `overflow-hidden`（会裁掉 `focus-visible` ring，损 a11y ⇒ 未采用）。

### 2.2 使用点逐点复核（`grep TabsList` 现取，3 处）

| 使用点 | 页面类名 | 390 档实测 | 判定 |
|---|---|---|---|
| `pages/TaskPage.jsx:266` | `grid w-full grid-cols-2 sm:grid-cols-4` | 390/390，列表 338/338 | 上批已修 + 共享件双保 |
| `pages/RewardPage.jsx:311` | `grid w-full grid-cols-4`（**未修**） | 390/390，列表 338/338，触发最大溢出 18px（`Limited edition (0)` 101>83） | 共享件加固后**文档无溢出**（以前会溢出）；触发内文字溢出为**视觉溢出**，不改 |
| `pages/admin/ShardsManagement.jsx:128` | `grid w-full grid-cols-3` | 未单测（admin 需登录）⇒ **NOT_MEASURED** | 由共享件兜底 |

---

## ③ `<a class="sf-btn">` 锚点按钮渲染核查

**方法**：真浏览器，`document.body` 注入同 `className="sf-btn sf-jobs-btn"` 的 `<a>` 与 `<button>`，读 `getBoundingClientRect()` + `getComputedStyle`（同 CSS 同上下文，唯元素类型不同）；同时读页面真实锚点。

| 项 | `<a class="sf-btn sf-jobs-btn">` | `<button class="sf-btn sf-jobs-btn">` | 差 |
|---|---|---|---|
| `width` | 53.78 | 53.78 | **0** |
| `height` | 37.5 | 37.5 | **0** |
| `top` | 0 | 0 | **0** |
| `padding` | `8px 12px` | `8px 12px` | **0** |
| `display` | `block` | `block` | **0** |
| `align-items` / `justify-content` | `normal` / `normal` | `normal` / `normal` | **0** |
| `font-size` / `line-height` | `13px` / `19.5px` | `13px` / `19.5px` | **0** |

页面真实锚点（`/en/task`，`a.sf-btn sf-jobs-btn`）：`Post a job` 87.91×37.5、`Review queue` 109.16×37.5 —— 高度与注入探针一致。
**夜档（`data-theme=dark`）复测**：`a` / `button` 探针仍逐值相等（53.78 / 37.5 / `8px 12px` / top 0 / display block）。
截图：`/Users/kevin/.config/browser-harness/tmp/shot.png`（390×844，`/en/reward`）。

**结论**：**高 / 内边距 / 对齐 / display 逐值相等，与 `<button>` 同类一致 ⇒ 正常，只登记不动**（未加 `inline-flex`，避免无谓 rect 变更）。
`display:block` 的**具体来源规则**未定位 ⇒ 见 §7 `NOT_MEASURED`。

---

## ④ 死 token 清理：`--sf-btn-*` / `--sf-btnsm-*`

**两个读数（均本单现取自扫，未转抄）**：

| 读数 | 命令/尺子 | 值 |
|---|---|---|
| **定义处** | `theme-tokens.css` 声明行 | **14 行**：日块 `:60-63`（`--sf-btn-{bg,fg,radius,shadow}`）+ `:118-120`（`--sf-btnsm-{bg,fg,radius}`）；夜块 `:177-180` + `:235-237`（同 7 键） |
| **引用数（全 src，消费者）** | `search_files` 正则 `var\(\s*--sf-btns?m?-(bg|fg|radius|shadow)`（`btna/btnalt` 因 `-` 边界天然排除） | **0 处** |

**结论：不删，只登记（并报回 Zang）**。理由 = **硬边界阻断**，非「有引用」：

1. `theme-tokens.test.js:185` 断言 `dayVars.length === TOKEN_KEYS.length`（CSS 声明数 ≡ 登记 token 数）；
   `theme-shell-isomorphism.test.jsx:238-248` 断言 `theme-tokens.css` 里每个 `--sf-*` 变量都必须 ∈ `TOKEN_KEYS`。
2. `TOKEN_KEYS = Object.keys(DAY)`（`tokens.js:267`），且 `btn-bg/fg/radius/shadow`（`:40-43`）、`btnsm-bg/fg/radius`（`:98-100`）
   **已在册**，并带 `PROV` 回读条目（`:340-342`，逐键回读 `docs/design/style-preview.html`）。
3. ⇒ 删 CSS 定义**必须同步删 `frontend/src/theme/tokens.js` 的 token 键与 PROV 条目** —— 而 `tokens.js` 属**禁写**（任务书：「若真需改 ⇒ 停下报回」）。

按硬边界**停下报回**：**请 Zang 裁决**是否授权（a）保留现状（登记为「已登记死 token，含 PROV 溯源」）；（b）授权一次 `tokens.js` 改动以删除这 7 键（CSS 14 行 + DAY/NIGHT/PROV 各 7 处），并更新 `theme-tokens.test.js` 的 `TOKEN_KEYS.length ≥ N` 基线。
本单**未删任何一行**，`theme-tokens.css` / `tokens.js` 均未写。

---

## ⑤ AC 读数（全部自跑）

| # | AC | 命令 | 退出码 | 读数 |
|---|---|---|---|---|
| ① | 构建 | `npm run build` | **0** | `✓ built in 1.85s`（加测试文件后复跑；源代码面 1.87s）|
| ② | 单测（改后） | `npm run test:unit` | **0** | **26 files / 238 passed**（基线 **25 / 231** ⇒ **+7 新增，0 掉**，≥231 ✅）|
| ③ | 三脚本 | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | **总判 PASS** |
| ③ | | `node scripts/p4z-i18nviol-global.mjs` | **0** | **总判 PASS**（locale 裸命中 0 / source 裸命中 0；作用域节点 locale **2732** / source **37**）|
| ③ | | `node scripts/p4z-feperf-safelist.mjs` | **0** | **`VERDICT=PASS`** |
| — | 附带 | `node scripts/p4z-miscfix-links.mjs` | **0** | 残留 **0**（改前 10）、未登记残留 0、**PASS** |
| — | 附带 | `node scripts/p4z-btnimpl2-sf-btn-a.mjs` | **0** | **总判 PASS**（0 FAIL / 9 文件 / 用法 22 处；死 token 消费者 = 0 一致）|
| ④ | 主题同构 | CDP：`data-theme=light`↔`dark` 同批元素 rect | — | **同一批 31 个元素 rect 逐值相等 = True**（1280×900）；切档有效性用差异 token 佐证：`--sf-page-bg` `#FDE815`→`#0B0C0E`、`--sf-page-fg` `#0A0A0A`→`#E8EAED`、`--sf-me-radius` `999px`→`2px`（切回 day 复原）|
| ⑤ | 两档宽度 | CDP `setDeviceMetricsOverride` | — | **390×844**：`innerWidth=390`（断言 ✓）、`documentElement` **390/390** ⇒ 溢出 **0**；**1280×900**：`innerWidth=1280`（断言 ✓）、**1280/1280** ⇒ 溢出 **0** |

主题同构未掉：本单新增 CSS 仅 `Tabs.jsx` 的两处**类名**（`max-w-full` / `overflow-x-auto` / `min-w-0`）——纯几何/裁剪，**不含 token**；`shell.css` / `theme-tokens.css` / `tokens.js` 均未改 ⇒ 颜色轴不变，rect 轴同步未变（上表 AC④ 实测已确认）。

---

## ⑥ 改动文件（`git status --short` 现取）

```
 M frontend/src/components/ActiveTaskModal.jsx      （+1 import；4 处跳转走唯一构造器）
 M frontend/src/components/ui/Tabs.jsx              （TabsList/Trigger 类名加固）
 M frontend/src/pages/DashboardPage.jsx             （+utils import；navigate + to= 各 1 处）
 M frontend/src/pages/admin/PermissionsManagement.jsx （+utils import；2 处）
 M frontend/src/pages/admin/PointsManagement.jsx    （+utils import；1 处）
 M frontend/src/pages/admin/SystemSettings.jsx      （+utils import 行；1 处）
 M frontend/src/pages/admin/UsersManagement.jsx     （+utils import；1 处）
 M frontend/src/test/unit/p6-miscfix.test.jsx       （不变量重定基：见下）
?? frontend/src/test/unit/p6-tail.test.jsx          （新，7 例）
?? docs/audit/p6-tail-fixes.md                      （本文件）
```

**测试基线改动口径（不削弱）**：`p6-miscfix.test.jsx` 原无效性闸 `expect(hits.length).toBeGreaterThan(0)`（要求**残留非 0**）在残留归零后必然翻红 ⇒ 重定为
`expect(hits).toEqual([])`（残留 = 0，更强）+ **有效性闸下移到构造器侧** `expect(ctor).toBeGreaterThanOrEqual(10)`。
即：把「残留 ⊆ 登记待办」升级为「残留 = 0 且构造器仍在使用」，**未放宽任何断言**。

---

## ⑦ NOT_MEASURED（逐项，禁填 0/空）

1. `a.sf-btn` 计算值 `display:block` 的**具体来源规则**（哪条 CSS/UA 规则给出）：**NOT_MEASURED**（本单只核渲染是否一致，未做规则溯源）。
2. `pages/admin/ShardsManagement.jsx` 的 Tabs 在 **390 档实测**：**NOT_MEASURED**（admin 面需登录凭据，红线禁止登录 ⇒ 未做端到端；由共享件兜底）。
3. **真实登录态**下 admin「会话失效 ⇒ 跳登录」的端到端浏览器复现：**NOT_MEASURED**（不登录；改用 mock 化单测证明守卫，见 §1.3）。
4. **真机**（实体手机）两档：**NOT_MEASURED**（用 CDP `Emulation.setDeviceMetricsOverride` 模拟，`innerWidth` 已断言）。
5. **prod 构建产物**的视觉核对：**NOT_MEASURED**（本单只跑 `vite build` 退出码，未部署、未用 `vercel`）。
6. 死 token 删除后的 build/单测/同构读数：**NOT_APPLICABLE**（未删；因 §④ 硬边界阻断，不存在「删除后」状态）。

---

## ⑧ 未做 / 交下一单

1. **死 token 去留待裁**：见 §④，需授权 `tokens.js`（禁写）才能真删。
2. `pages/admin/UsersManagement.jsx:303` `/dashboard/points` 模板字面量链接：管理面**刻意无前缀** ⇒ 登记为「不适用」（§1.2）。
3. `pages/RewardPage.jsx:311` 仍是 `grid-cols-4`（390 档触发内文字视觉溢出 18px，文档级已由共享件兜住）：如需彻底消除，另单改页面列档（本单不改基线）。
4. 既有扫描器 `p4z-miscfix-links.mjs` 的字面量正则**不覆盖模板字面量**（本单 §1.2 额外发现据此漏检 1 处）；本单**未改**该脚本（写集只含 `scripts/p4z-tail-*.mjs`）⇒ 建议另单扩口径。


---

# ⑨ P6-TAIL-2 · 三条裁定收尾（本文件**追加**，上方内容一字未改）

口径（§5.7）：所有读数**本单自跑现取**；退出码一律取自命令本身（未置于管道之后）；「代码推断」与「实测」分列。

## 9.1 裁定① 死 token `--sf-btn-*` / `--sf-btnsm-*` 清退

**前置（全树引用数现取，必做项）**

| 读数 | 尺子（现取） | 值 |
|---|---|---|
| **消费者（真实 `var()` 引用）** | 全仓正则 `var\(--sf-btn[sm]?-`（作用域 = `frontend/src/**` 的 .js/.jsx/.css + `frontend/index.html` + `frontend/scripts/**` + `docs/**`） | **命中 3 行，逐行判定 = 0 个消费者**：`frontend/scripts/p4z-btnimpl2-sf-btn-a.mjs:12`（脚本注释）、`docs/audit/p6-btn-a-recon.md:58`（文档）、`docs/audit/p6-btn-impl2.md:149`（文档） |
| **定义处** | `theme-tokens.css` 声明行 | **14 行**（日块 `--sf-btn-{bg,fg,radius,shadow}` + `--sf-btnsm-{bg,fg,radius}`；夜块同 7 键）—— 与上单实测一致 |
| **`tokens.js` 在册键** | `TOKEN_KEYS`（= `Object.keys(DAY)`） | 7 键（`btn-*` 4 + `btnsm-*` 3），并带 7 条 `PROV` 回读 |

⇒ **前置成立（0 消费者）**，按裁定①授权执行删除（同批：CSS 14 行 + JS 7 键 + 7 条 PROV）。

**删除读数（删后即时现取）**

| 项 | 读数 |
|---|---|
| `theme-tokens.css` | 删 **14 行**（逐行打印见执行日志，7 键 × 日/夜） |
| `tokens.js` | 删 **21 行** = 14 行键（DAY 7 + NIGHT 7）+ **7 行 PROV**；其余键/值/PROV **一动未动** |
| `TOKEN_KEYS.length` | **113 → 106**（现取：node 读模块实测，与逐行删除数一致） |
| 「日/夜值不等」键数 | **106 → 100**（现取） |
| 删后 `frontend/src/**/*.css` 里 `var(--sf-btn[sm]-` 计数 | **0** |
| 删后 `tokens.js` 里 `btn/btnsm-*` 键计数 | **0** |
| 真浏览器 `getComputedStyle(documentElement)` 读这 7 个变量 | 全为 **空串**（未定义 ⇒ 无消费者 ⇒ 不产生任何渲染影响） |

**测试不变量同步（同批，未削弱）**：`theme-tokens.test.js:185` 断言 `dayVars.length === TOKEN_KEYS.length`、`:238-248` 断言每个 `--sf-*` ∈ `TOKEN_KEYS` —— 因两侧同批增删 ⇒ 仍全绿（见 §9.4）。
另有两处**本批必须等量下移**的既有闸门（均属 `frontend/src/test/**`，授权写集内；口径 = 只随「授权删 7 键」精确等量下移，其余键一个不许少）：

| 位置 | 改前 | 改后 | 理由 |
|---|---|---|---|
| `p6-btn-impl.test.js:85` | `TOKEN_KEYS.length >= 113` | `>= 106` | 原为「本单未删任何键」地板（113 = 当时实测值）⇒ 授权删 7 键后等量下移 |
| `p6-btn-impl.test.js:221` | `changedKeys.length >= 103` | `>= 100` | 106→100（删的 7 键里 6 键参与差集）|

## 9.2 裁定② `RewardPage.jsx:311` 响应式列式

**参照现取（先取后改，不另造断点）**：`pages/TaskPage.jsx:266` = `grid w-full grid-cols-2 sm:grid-cols-4`（同为 4 个 trigger 的 TabsList）⇒ 采用**同一写法**。

改前 → 改后（真浏览器 CDP，`/en/reward`，`Emulation.setDeviceMetricsOverride`）：

| 档位 | 项 | 改前 | 改后 |
|---|---|---|---|
| **390×844**（`innerWidth` 断言 = **390** ✓） | TabsList `grid-template-columns` | `82.5px ×4`（1 行 4 列） | `165px 165px`（**2 列 2 行**，页面尾与 `sm:` 一致） |
| | TabsList `scrollWidth / clientWidth` | 338 / 338 | 338 / 338 |
| | **触发内文字溢出量（每个 trigger 的 `scrollWidth - clientWidth`）** | **9 / 18 / 4 / 3 px（max = 18px）** | **0 / 0 / 0 / 0（max = 0px）** |
| | `documentElement` `scrollWidth / clientWidth` | 390 / 390 | 390 / 390 |
| **1280×900**（`innerWidth` 断言 = **1280** ✓） | `grid-template-columns` | —（未在改前取 1280 档同元素读数：`NOT_MEASURED`，见 §9.5-②） | `292px ×4`（1 行 4 列） |
| | 触发内文字溢出量 | — | 0 / 0 / 0 / 0 |
| | `documentElement` `scrollWidth / clientWidth` | 1280 / 1280 | 1280 / 1280 |

⇒ **18px 内文字视觉溢出在 390 档归零**；1280 档仍保持单行 4 列（断点与仓内一致）。

## 9.3 裁定③ 扫描器扩口径（模板字面量）

**扩前口径现取**：`frontend/scripts/p4z-miscfix-links.mjs` 的 `PATTERNS` 只有引号形态 `to="…"` / `navigate("…")` ⇒ 模板字面量（反引号）**完全不覆盖**（上单漏检根因）。

**扩法（只扩不改松）**：`PATTERNS` 追加两个**同位置**形态，引号判据一字未动：
`['to=', /\bto=\{\s*`(\/[^`]*)`/g]`（JSX 属性）与 `['navigate', /\bnavigate\(\s*`(\/[^`]*)`/g]`（导航调用）；`/api/`、`//` 仍在同一处排除。
**另一次尝试的记录（诚实留痕）**：先试过「任意反引号 `/(\/[^`]*)`/」的全量口径，全树重扫一次命中 11 处，**其中 10 处是构造器自身的 `/${var}` 前缀拼接**（`utils.js` / `shell/nav.js` / `Header.jsx` / `RewardPage.jsx:37`）⇒ 判为噪声、**已收窄回「导航位置两形态」**（不是漏检，是判据设计：构造器内部拼接不是链接）。

**全树重扫读数（现取，作用域 = `frontend/src` 去注释后 .js/.jsx，排除 `test/`）**

| 读数 | 值 |
|---|---|
| 扫描源文件数 | **76** |
| 命中行数 | **1**（= 新口径扫出的模板字面量站内路径） |
| 命中明细 | `src/pages/admin/UsersManagement.jsx:303` → ``navigate(`/dashboard/points?q=${encodeURIComponent(user.EVM || String(user.uID))}`)`` |
| 逐条判定 | **登记（不改）**：admin 守卫链为 zh 单语、站内路径刻意不带语言前缀（同一理由见上方 §1.2 既有登记）⇒ 写入 `REGISTERED_TODO` |
| 已登记待办 | 7 → **8 条** |
| **未登记残留** | **0** ⇒ 总判 **PASS**（`EXIT=0`）|

## 9.4 AC 读数（全部自跑；退出码取自命令本身）

| # | AC | 命令 | 退出码 | 读数 |
|---|---|---|---|---|
| ① | 构建 | `npm run build` | **0** | `✓ built in 1.62s` |
| ② | 单测 | `npm run test:unit` | **0** | **26 files / 238 passed**（基线 238 ⇒ **0 掉，≥238 ✓**） |
| ③ | 脚本 | `node scripts/p6-tr2-i18n-locales.mjs` | **0** | `[TR-2] 总判：PASS` |
| ③ | 脚本 | `node scripts/p4z-i18nviol-global.mjs` | **0** | `[I18N-VIOL] 总判：PASS`（locale 裸命中 0 / source 裸命中 0；作用域 locale **2732** / source **37**） |
| ③ | 脚本 | `node scripts/p4z-feperf-safelist.mjs` | **0** | `VERDICT=PASS` |
| ③附 | 脚本 | `node scripts/p4z-miscfix-links.mjs`（本单扩口径后） | **0** | 命中 1 / 已登记 8 / **未登记残留 0** ⇒ PASS |
| ③附 | 脚本 | `node scripts/p4z-btnimpl2-sf-btn-a.mjs` | **0** | `总判 PASS（0 FAIL / 9 文件 / 用法 22 处）`（其⑥项「死 token 消费者 = 0」删后仍成立） |
| ④ | 主题同构 | CDP 1280×900，`data-theme` light↔dark 同批元素 `getBoundingClientRect` | — | **同一批 138 个元素：rect 逐值相等 = True（差异 0）**；切回 day 复原 = True；切档有效性佐证：`--sf-page-bg` `#FDE815`→`#0B0C0E`、`--sf-page-fg` `#0A0A0A`→`#E8EAED`、`--sf-card-radius` `13px`→`2px`；结构常量两档同值（`--sf-st-h-btna` `34px`、`--sf-btna-bg` `#FFE60F`）|
| ⑤ | 两档宽度 | CDP `Emulation.setDeviceMetricsOverride` | — | **390×844：`innerWidth` 断言 = True（390）**，`documentElement` 390/390 ⇒ 溢出 0；**1280×900：断言 = True（1280）**，1280/1280 ⇒ 溢出 0 |
| ⑥ | 死 token 引用 = 0 | 见 §9.1（全树现取 + 删后复扫） | — | 消费者 **0**；删后 7 变量 computed 值 = 空串 |
| ⑦ | 本报告 | 本文件（**追加**） | — | ✔ |

**基线不回退核查**：单测 26/238（= 已验收基线）；四语键集 `top=102 / flat=683`（`p6-tr2` 脚本 PASS，键集未变）；`styles.css:32` 起 5 个 palette safelist **未动**（`p4z-feperf-safelist` PASS）；主题双档同构未掉（§9.4-④）。

## 9.5 NOT_MEASURED（逐项；禁填 0/空）

1. **改前 1280×900 档**的 `RewardPage` TabsList `grid-template-columns` / 触发文字溢出量：**NOT_MEASURED**（改前只取了 390 档读数；1280 档改后读数已给）。理由：改前首轮量测脚本的 TabsList 选择器用了 `[role="tablist"]`，而仓内 `TabsList` 是无 role 的 `div` ⇒ 首轮 `NO_TABLIST`，只补测了 390 档后即进入改动。
2. **真机（实体手机）**两档渲染：**NOT_MEASURED**（用 CDP `Emulation.setDeviceMetricsOverride` 模拟，`innerWidth` 已断言）。
3. **prod 构建产物**（`dist/`）的视觉核对：**NOT_MEASURED**（只跑 `vite build` 退出码；未部署、未用 `vercel`）。
4. **admin 面** `/dashboard/points` 在真实登录态下的端到端复现：**NOT_MEASURED**（红线禁止登录/表单操作；本单对该命中只做登记）。
5. **模板字面量口径对「构造器内部 `/${var}` 拼接」的覆盖**：**NOT_MEASURED（且判据上刻意不覆盖）** —— 已收窄回导航位置两形态（§9.3），不把构造器噪声计入链接面。
6. `p4z-btnimpl2-sf-btn-a.mjs:12` 的注释文案仍写「token 仍由 `theme-tokens.css` 定义」= **陈旧文案**（描述已过期）；本单**未改**该脚本 ⇒ 登记为待办。非 AC 脚本，不影响任何判据。

## 9.6 改动文件（本单，7 个；**未执行任何 git 写操作**）

```
 M frontend/src/theme/theme-tokens.css                 （删 14 行死 token 定义）
 M frontend/src/theme/tokens.js                        （删 7 键 + 7 条 PROV = 21 行）
 M frontend/src/pages/RewardPage.jsx                   （:311 grid-cols-4 → grid-cols-2 sm:grid-cols-4）
 M frontend/src/test/unit/p6-btn-impl.test.js          （闸门等量下移 113→106 / 103→100）
 M frontend/src/test/unit/p6-btn-impl2.test.js         （用例名与现状对齐，断言未动）
 M frontend/scripts/p4z-miscfix-links.mjs              （PATTERNS 扩模板字面量两形态 + 登记 1 条）
 M docs/audit/p6-tail-fixes.md                         （本文件，追加）
```

**未写**：`backend-ts/**`、`migrations/**`、`vercel.json`、`index.html`、`vite.config.js`、`frontend/src/locales/*.json`、spec、`docs/seafood.master-plan.md`、`.env*` —— 全部一字未动（locale 键集未变，`p6-tr2` 现取 PASS 佐证）。
**环境**：自起 `vite --port 5791 --strictPort`（PID 98354 → node 98732，仅监听 `[::1]:5791`）；**未触碰 5787**、未 `pkill`/`killall`、未用 `git add/commit/push`。
