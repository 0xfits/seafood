# v1.19 §21 消息面板化（方案 1「就地叠加」）· 收尾报告（第三轮）

- 仓 = `/Users/kevin/bistro/seafood` · 改前基线 = `HEAD fd34ca0` · 改后 = 工作区（未 commit 前的末轮）
- 本报告由 **Zang** 于 2026-10-16（CST）第三轮收尾落笔：**只跑探针 + 落报告 + 零 push 提交**，未改实现、未改探针脚本逻辑、未改 `docs/**`。
- 全部读数落盘于 `ops/v119-msg-panel/readings/**`（`geometry.json` / `attribution.json` / `attribution.normalized.json` / `ac-1.*` / `ac-6.*`）与 `ops/v119-msg-panel/logs/**`（门套与探针 stdout）。

---

## (a) 改动文件清单 + `git diff --numstat`

### (a-1) 已跟踪文件（`git diff --numstat` 现取）

| 文件（相对仓根） | + | − |
|---|--:|--:|
| `docs/design/design-system.spec.md` | 210 | 0 |
| `docs/route-layer.spec.md` | 142 | 1 |
| `docs/OPEN-ITEMS.md` | 9 | 0 |
| `frontend/src/pages/MessagesPage.jsx` | 11 | 288 |
| `frontend/src/pages/item/ItemDetailPage.jsx` | 10 | 4 |
| `frontend/src/shell/AppShell.jsx` | 33 | 16 |
| `frontend/src/shell/BottomTabBar.jsx` | 21 | 1 |
| `frontend/src/shell/FloatingMenu.jsx` | 16 | 1 |
| `frontend/src/locales/zh.json` / `en.json` / `hk.json` / `vn.json` | 2 各 | 1 各 |
| `frontend/src/test/unit/v15-nav-floatmenu.test.jsx` | 34 | 11 |
| `frontend/src/test/unit/i18n-batch-b4a.test.jsx` | 1 | 1 |
| `frontend/src/test/unit/i18n-batch-b4b.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/i18n-batch-b5.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/i18n-violation-closeout.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/r9-93-points-symbol.test.jsx` | 1 | 1 |
| `frontend/src/test/unit/r9-96-dashj-copy.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/s19-participants-truth-source.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/s23-participants-headcount.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/s5-publish-headcount.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/s7-submissions-panel.test.jsx` | 2 | 2 |
| `frontend/src/test/unit/s8-locale-key-coverage.test.js` | 2 | 2 |
| `frontend/src/test/unit/s9-ledger-kind-closure.test.js` | 2 | 2 |
| `frontend/src/test/unit/tg-bind-qr.test.jsx` | 1 | 1 |
| **小计（26 文件）** | **517** | **349** |

### (a-2) 新增文件（`git ls-files --others`，行数 = 新增行）

| 文件（相对仓根） | 行 | 字节 |
|---|--:|--:|
| `frontend/src/shell/MessagesPanel.jsx` | 330 | 15,662 |
| `frontend/src/shell/messages-panel-routing.js` | 67 | 3,705 |
| `frontend/src/shell/messages-panel.css` | 160 | 5,955 |
| `docs/versions/design-system.spec.v1.19.md` | 2,310 | 506,871 |
| `docs/versions/route-layer.spec.v2.34.md` | 8,499 | 1,661,215 |
| `docs/audit/design-system-v1.19-delta.md` | 40 | 5,841 |
| `docs/audit/route-layer-v2.34-delta.md` | 38 | 4,962 |
| `ops/v119-msg-panel/readings/geometry.json` | 2,919 | 75,364 |
| `ops/v119-msg-panel/readings/attribution.json` | 974 | 41,749 |
| `ops/v119-msg-panel/readings/attribution.normalized.json` | 9,847 | 429,115 |
| `ops/v119-msg-panel/readings/ac-1.json` / `ac-1.txt` | 68 / 55 | 3,270 / 3,591 |
| `ops/v119-msg-panel/readings/ac-6.json` / `ac-6.txt` | 145 / 48 | 3,559 / 2,010 |
| `ops/v119-msg-panel/readings/probe-geometry.mjs` | 473 | 29,173 |
| `ops/v119-msg-panel/readings/probe-attribution.mjs` | 286 | 17,738 |
| `ops/v119-msg-panel/readings/collect-ac-source.sh` | 158 | 13,351 |
| `ops/v119-msg-panel/logs/*.log`（7 件：`build` / `test-unit-1` / `test-unit-2` / `probe-geometry` / `probe-attribution` / `lint` / `type-check`） | 2,920 | 308 KB |
| **小计（17 件）** | **26,417** | — |

> **未入库项（如实披露）**：`ops/v119-msg-panel/logs/*.log`（门套与探针原始 stdout，共 2,920 行 / 308 KB）**不进 commit** —— 被仓根 `.gitignore:243`（`logs`）规则忽略，且**本单不绕过 gitignore**（是否入库由 Kevin 定）。仓内证据以 `readings/**` 为准；原始 stdout 留在本机 `ops/v119-msg-panel/logs/`。

> 提交切分：`docs/**` 7 件进 **commit ①**；`frontend/**`（含 3 个新文件）+ `ops/v119-msg-panel/**` 进 **commit ②**。**零 `git add -A`、零 push。**

---

## (b) AC-1 … AC-6 逐条读数（读数文件路径 = 相对仓根）

| AC | 判据（§21.8） | 读数文件 | 一句话结论 |
|---|---|---|---|
| **AC-1 四入口不减** | 四条入口在场且 `href` 字面未改 | `ops/v119-msg-panel/readings/ac-1.json`（+ `ac-1.txt` 原始 `grep -n` 字面）；运行时 href 见 `readings/geometry.json → entryWiring` | **PASS**：① 底栏 `nav.js:23` 产出 `/messages`（运行时 `entryWiring.tabBefore.href=/messages`）② 悬浮菜单 `FloatingMenu.jsx:24` 同源（`floatMenuBefore.href=/messages`，角标 `99+`）③ 详情页「聊一聊」仍调 `openConversation`（`ItemDetailPage.jsx:161`）④ Telegram 文案 `messages-service.ts:717/:718` 含 `<site>/messages` 一字未改；`T105` 判据单一真源 = `shell/messages-panel-routing.js:24`、外壳零宽度词表（`matchMedia`/`innerWidth`/…）**0 命中**。③ 的落点形态属**口径漂移**（见 (d)-1）。 |
| **AC-2 不换页 + 原地** | `pathname` 逐字相同 / 宿主未重挂 / `scrollY` 不变 | `readings/geometry.json → ac2` | **PASS**：`before.pathname` = `after.pathname` = `/`（仅 `search` `''`→`?msg=1`）；`hostSameNode=true`（挂载计数 1，`hostCount 46` 前后相同）；`scrollY 384 → 384`（`beforeScrollAfterFrame 384`）；关闭后回到 `/` 且 `panelPresent=false`、`historyLength 13→14→14`（开 = push、关 = replace）。 |
| **AC-3 桌面几何** | `1440` 面板 `w=600` / 右偏移 `104` / 与 `.sf-fm` 间隙 `16` 且相交 `0` / 正文右缘 ≤ 面板左缘 / 零横向溢出 | `readings/geometry.json → states.*.assertions`、`→ verdict["AC-3 …"]` | **PASS（四档）**：`1440/1199/1024` 面板 `w=600`、右偏移 `104`、左栏 `240` + 右栏 `360` = `600`、`scrollWidth-clientWidth=0`、`gapToFloatMenu=16`、`intersectArea=0`、`contentRightVsPanelLeft=0`；`768` 档 `w=344`、左栏 `154.8` + 右栏 `189.2` = `344`，其余同上。 |
| **AC-4 手机档（≤767）** | 面板 `100vw×100vh` / 单栏两态 / 触控 ≥44 / 零溢出 | `readings/geometry.json → states.767|390|375|320`、`→ touchTargets`、`→ verdict["AC-4 …"]` | **PASS（四宽）**：`767=767×900`、`390=390×844`、`375=375×812`、`320=320×640`（逐档 = 视口 ⇒ 全屏）；单栏两态 = 列表态 `listCol:flex / threadCol:none`、会话态 `listCol:none / threadCol:flex`；触控 8 项全 ≥44（`close` 44×44、`back` 366×44 / 296×44、`send` 52×44）；`overflowPx=0`。 |
| **AC-5 未打开 ⇒ 零影响（归因式）** | 未打开态差异集 = 0；噪声基线可重复；尺子灵敏度自证非空 | `readings/attribution.json`（+ `attribution.normalized.json`） | **(a) FAIL · ENV_LIMITED** —— 未打开态差异集 ≠ 0：`/`@1440 = 2、`/exchange`@390 = 2（其余未打开页 = 0）；**(b) FAIL · ENV_LIMITED** —— 噪声基线 6/8 页不可重复；**(c) PASS** —— 反事实臂 44、同页注入 `.sf-mp{display:none}` 臂 60，两者均非空 ⇒ 尺子有分辨力。**两条 FAIL 原样保留，未改写为 PASS**，根因见 (e)-3。 |
| **AC-6 结构不变式** | 五 region 恒等 / `shell.css` `@media` 恒 1 且含 `767px` / 无 `[data-theme` / 外壳 JS 零禁用词 | `readings/ac-6.json`（+ `ac-6.txt`）；日夜间构见 `readings/geometry.json → themeShape` | **PASS**：13 态 `[data-sf-region]` 严格 = `['shell','topnav','content','footer','tabbar']`；`MessagesPanel.jsx`/`messages-panel.css` 的 `data-sf-region=` **属性命中 0**；`shell.css` 工作区与 `HEAD` sha256 相同（`886ba2f5…6ebf3`）、`@media` 数 = 1（含 `767px`）、`[data-theme` = 0；`themeShape`：`light`/`dark` 两档 `dayCount=nightCount=20`、`shapeEqual=true`（`shapeLen=533`）。 |

### (b-附) 内容面逐值读数（`geometry.json → states`）

- 桌面面板态（`1440_exchange_msg_open_list`）：面板 `x=736 w=600 h=900`（右缘 1336 = 1440−104）；`listCol 240×849` / `threadCol 360×849`（列宽 `215` 的会话行矩形 `215×97`）；`closeBtn 34×34`（`aria-label=关闭消息`）；`panelTitleText=消息`。
- 会话行 **3 行**（`convRowCount=3`，peer `#970301/#970302/#970303`，href `…&c=7/8/9`）；`unread_count=250` ⇒ 角标字面 **`99+`**（`aria="250 条未读"`）+ 第二行 `3`（`aria="3 条未读"`）。
- 气泡两向在场：`mineCount=1`（`FIXTURE 我的消息一`）/ `theirsCount=1`（`FIXTURE 对方消息一`）；`aboutText="关于：FIXTURE 商品 A"`；`inputPlaceholder="输入消息…"`；`sendBtnText=发送`（`disabled=true`，空输入）。
- 钩子面：`placeholderHooks=0`、`legacyPageHook=0`（旧占位钩子与旧宿主钩子 `messages-page` 全仓零产出）；面板态 `hookSet` 13 项（列表态）/ 13 项（会话态）；未打开态 `hookSet=0`。
- `pageErrors = []`（新/旧两版均空）。
- **`四语态`：`NOT_MEASURED`** —— 几何探针 `probe-geometry.mjs` 内**零 locale 代码**（无 `/en` `/hk` `/vn` 路径遍历）⇒ 如实登记为未跑项，不得当 0；四语键面读数见 `ac-1.json`（AC-1）+ 13 个 i18n 单测文件。

---

## (c) 断言改锚清单（`文件:行` → 旧 → 新）

### (c-1) 宿主钩子改名引致的改锚（`v15-nav-floatmenu.test.jsx`，11 删 / 34 增）

| 文件:行 | 旧 | 新 |
|---|---|---|
| `frontend/src/test/unit/v15-nav-floatmenu.test.jsx:245` | 用例名 `'%s 档 MessagesPage 渲染**真页**（占位钩子 = 0 + 真页钩子在场）'` | `'%s 档 消息面板（/messages 直链落点 = 首页 + 面板）：面板钩子在场 + 占位钩子 = 0'` |
| `…:261` | `renderIn(<MessagesPage />, '/messages')` | `renderIn(<AppShell><MessagesPage /></AppShell>, '/messages')` |
| `…:262` | `container.querySelector('[data-sf-m="messages-page"]')` | `container.querySelector('[data-sf-m="messages-panel"]')` |
| `…:265`（**新增反断言**） | — | `expect(container.querySelector('[data-sf-m="messages-page"]')).toBeNull()` |
| `…:267-268`（**新增**） | — | `messages-panel-list` / `messages-panel-thread` 两栏包裹层 `not.toBeNull()` |
| `…:270-271`（**新增**） | — | `messages-panel-close` 的 `aria-label === TABLES[lang].messagesPage.close` |
| `…:291-301`（**新增整例**） | — | 用例「未打开态（`/`）⇒ 面板**不在 DOM**（条件挂载）」+ 反事实：同判据下 `/messages` 必须出场（`messages-panel` 非空 + `sf-shell--msg-open`） |

> 保留面：16 条既有 `messages-*` 钩子**逐字未改**、四语标题 / 空态文案 / 占位钩子 = 0 / 两键已删 逐字保留 ⇒ 真改锚仅「用例名 + 根容器钩子」2 处（承 `N45`）。

### (c-2) i18n 计数硬断言（**13 文件** ⇒ 必然红面，`1103⇒1104` / `4412⇒4416`）

| 文件:行 | 旧 | 新 |
|---|---|---|
| `frontend/src/test/unit/i18n-batch-b4a.test.jsx:148` | `{ top: 128, flat: 1103 }` | `{ top: 128, flat: 1104 }` |
| `frontend/src/test/unit/i18n-batch-b4b.test.jsx:260` | `{ top: 128, flat: 1103 }` | `{ top: 128, flat: 1104 }` |
| `frontend/src/test/unit/i18n-batch-b4b.test.jsx:326` | `'zh: top=128 flat=1103'` | `'zh: top=128 flat=1104'` |
| `frontend/src/test/unit/i18n-batch-b5.test.jsx:217` | `'zh: top=128 flat=1103'` | `'zh: top=128 flat=1104'` |
| `frontend/src/test/unit/i18n-batch-b5.test.jsx:261` | `{ top: 128, flat: 1103 }` | `{ top: 128, flat: 1104 }` |
| `frontend/src/test/unit/i18n-violation-closeout.test.jsx:88` | `'作用域命中节点数 = 4412'` | `'作用域命中节点数 = 4416'` |
| `frontend/src/test/unit/i18n-violation-closeout.test.jsx:136` | `toBe(1103)` | `toBe(1104)` |
| `frontend/src/test/unit/r9-93-points-symbol.test.jsx:195` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/r9-96-dashj-copy.test.jsx:129` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/r9-96-dashj-copy.test.jsx:133` | `四语节点合计 .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/s19-participants-truth-source.test.jsx:108` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/s19-participants-truth-source.test.jsx:111` | `× LANGS.length .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/s23-participants-headcount.test.jsx:121` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/s23-participants-headcount.test.jsx:124` | `× LANGS.length .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/s5-publish-headcount.test.jsx:88` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/s5-publish-headcount.test.jsx:91` | `× LANGS.length .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/s7-submissions-panel.test.jsx:303` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/s7-submissions-panel.test.jsx:306` | `× LANGS.length .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/s8-locale-key-coverage.test.js:188` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/s8-locale-key-coverage.test.js:191` | `× LANGS.length .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/s9-ledger-kind-closure.test.js:128` | `.toBe(1103)` | `.toBe(1104)` |
| `frontend/src/test/unit/s9-ledger-kind-closure.test.js:131` | `× LANGS.length .toBe(4412)` | `.toBe(4416)` |
| `frontend/src/test/unit/tg-bind-qr.test.jsx:14`（文件头计数注释） | `拍平 1095⇒1103 / 四语节点 4380⇒4412` | `拍平 1095⇒1104 / 四语节点 4380⇒4416`（+ 追加本单 `+1` 键说明） |

> 单一改动源 = 四语各 `+1` 键 `messagesPage.close`（`frontend/src/locales/{zh,en,hk,vn}.json` 各 2 增 1 删）⇒ `flat 1103⇒1104`、四语节点 `4412 = 1103×4 ⇒ 4416 = 1104×4`。既有计数点 `grep` 已穷尽为 13 文件（三数并存：顶层 `128` 不变 / 拍平 / 四语节点）。

---

## (d) 规范漂移 / 口径外延清单（**待 Jing 勘误级补登**）

1. **「聊一聊」入口 3 = 就地叠加，取代「换页」字面**：`frontend/src/pages/item/ItemDetailPage.jsx` 由 `navigate('/messages?c=<id>')` 改为 `navigate(withPanelParams(location, String(view?.conversation_id ?? '')))`（`:157` → `:163`，走 `shell/messages-panel-routing.js`）。⇒ 与 `docs/design/design-system.spec.md §21.11 Q4`（本册冻结 = 换页到直链落点）及 `§21.8 AC-1③`「`navigate` 字面含 `/messages?c=`」**冲突**。**裁定**：以「方案 1 · 就地叠加」为准；**旧锚 `toContain('/messages?c=')` 型断言不得采用**（质检方勿按旧字面判负）。
2. **左栏分隔线走 `inset` 阴影**（`shell/messages-panel.css`），**不是 `border`**。⇒ 几何面「左栏 `w=240`（`768` 档 `154.8`）」不含 1px 边框预算；规范若按 `border` 描述需改为 `box-shadow: inset`。
3. **`≥768` 未选会话右栏复用 `messages-detail-empty`**：`1440_messages_direct` 实测 `detailEmptyText="还没有消息，发第一条吧"`（同一钩子在 `≤767` 会话态之外亦产出）。⇒ 若规范把该钩子登记为「仅 `≤767` 单栏空态」需勘误为「全档未选会话空态」。
4. **`/messages` 直链态「×」回首页**：`geometry.json → entryWiring.directClose = { pathname: '/', search: '', panelPresent: false }` ⇒ 直链落点的关闭键**回首页**（不是「关闭面板留在 `/messages`」）。⇒ 规范若写「× = 仅关闭面板」需勘误。

---

## (e) 门套读数 + 探针环境 + 测得的已知偏差

### (e-1) 门套（本机现取 · 提交前实跑）

| 门 | 命令 | 退出码 | 读数 | 日志 |
|---|---|--:|---|---|
| `build` | `npm run build`（`frontend/`） | **0** | `vite v5.4.20` / 1819 modules / **built in 1.83s**（wall ≈ 2.3s）；产物 `dist/assets/index-C3dRJ_m4.js` 445.77 kB（gzip 131.35 kB）；**两次构建同 hash**（`sha256 f53c130d…`）⇒ 可复现 | `ops/v119-msg-panel/logs/build.log` |
| `test:unit` | `npm run test:unit` | **0** | `Test Files 54 passed (54)` / `Tests **520** passed (520)` / Duration 7.49s（首跑 `test-unit-1.log` 同为 54/520） | `logs/test-unit-2.log`（+ `test-unit-1.log`） |
| `lint` | `npm run lint` | **2（存量 · 环境性）** | ESLint 8.57.1 `couldn't find a configuration file`——**仓内无 eslint 配置**（`frontend/.eslintrc*` / `eslint.config*` / `.eslintignore` 全不存在，根目录亦无）⇒ 脚本从未真正执行，非本单引入 | `logs/lint.log` |
| `tsconfig` | `npm run type-check` | **N/A** | `frontend/` **无** `tsconfig*.json` / `jsconfig.json` ⇒ `tsc --noEmit` 无工程可编译（exit 1，`Version 5.9.2`）⇒ 判据 **N/A**（不可比） | `logs/type-check.log` |

### (e-2) 探针环境披露（两探针）

- **Playwright**（`createRequire` 锚到 `frontend/node_modules` 解析）+ **本机 Chrome**（`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）。
- **零 dev server / 零静态服务**：`page.route` 把 `http://sf.local/**` **静态映射到 `frontend/dist`** 磁盘文件（HTML/JS/CSS/SVG/PNG/WOFF2 逐扩展名给 MIME）。
- **零真后端 / 零库写**：`/api/messages/**` 全部由**探针内夹具**（`page.route` 内存 JSON）自截，登录态只走 `localStorage` 种子（`addInitScript`）⇒ 不启 5788、不 POST、不写任何表。
- **外部资源全阻断**（4 origin）：`cdnjs.cloudflare.com` / `fonts.googleapis.com` / `cdn.jsdelivr.net` / `raw.githubusercontent.com`。
- **禁动画**：`reducedMotion:'reduce'` + 注入 `*,*::before,*::after{animation:none!important;transition:none!important}`；稳态采样（连续 ≥3 帧逐字节相同，不用固定 ms 等待）。
- **旧版对照产物** = `~/.hermes/profiles/zang/cache/scratch/v119-old/frontend/dist`（`git archive fd34ca0` 产物）；实测 **零 `messages-panel` 字面**（`grep -rl` 0 命中）⇒ 反事实臂有效。

### (e-3) 测得的已知偏差（**逐条保留实测值，未改写判据**）

1. **AC-5(a) 未打开态差异集 ≠ 0 —— `FAIL · ENV_LIMITED`**：`1440/` = 2（1 对）、`390/exchange` = 2（1 对）；`1440/exchange`、`1440/item/123`、`390/`、`390/item/123` 均 = 0。差异**逐条**为同一 DOM 节点（结构路径 `#root/1/0/2/0/0/0/1/0/0/0`、`class=h-[50px] w-auto object-contain` 逐字相同）的 `alt` 两值互换：`猫猫大使团｜你的声音，值得被品牌听见。` ⇄ `猫猫大使团｜不止一份报酬，更加一份经验。`。
   **根因（本轮已证）** = `frontend/src/components/Footer.jsx:12` **模块加载期** `Math.random()` 选 `CAT_SLOGAN_KEYS`（`footer.catSlogan1..3`）⇒ CAT 合作品牌 `<img alt={t(...)}>` **每次页面加载随机**。**该文件不在本单 diff 内**（`git status` 无 `Footer.jsx`）⇒ **改前既有**随机项，非本单产品面变更。
   **探针外补充诊断**（临时件 `~/.hermes/profiles/zang/cache/scratch/v119-diag/diag-math-random-attribution.mjs`，**未入库**；调用 `node diag-math-random-attribution.mjs <distNew> <distOld> 8`，输出 `…/v119-diag/diag2.log`；同食谱禁动画 + 稳态采样，`/` @1440×900，N=8）：`D1` 同版 8 连读 raw sha256 出现 **3 个值**抖动（`af8ca577…` / `877bcd35…` / `c2b65ede…`）；把 **`alt=<值>` 归一化**后 **8/8 逐字节相同**（`strippedAllEqual=true`）且 **改后 ⇄ 改前同 sha**（`d3837b1d…`）⇒ `D2_crossVersionStrippedEqual=**true**`；实测 alt 取值集合 = {`catSlogan1`,`catSlogan2`,`catSlogan3`,`cloudSlogan`,`语言`}（前 3 项逐轮换、后 2 项恒定）。**结论 = 未打开态残余差异 100% 归因该加载期随机项；面板未打开时结构面（去该随机项）改前⇄改后逐字节相等。**
2. **AC-5(b) 噪声基线不可重复 —— `FAIL · ENV_LIMITED`**：`attribution.json → pages.*.rulerRepeatable`：同版同页「连跑两轮」归一化 `sha256` 相同仅 **2/8** 页（`1440/exchange` 的 new=true、`1440/messages` 的 old=true），其余 **6/8 = false**（`geometricallyRepeatable` 全 false）。同一根因（`Math.random()`）。**未改写为 PASS。**
3. **`/messages` 差异集非空 = 预期差异（单列 · 不作缺陷 · 不隐去）**：`1440/messages` = **111**（old-only 24 / new-only 87）、`390/messages` = **109**（23 / 86）。语义由「独立真页」变为「首页 + 面板」：`old` 侧 `sf-msg-page` / `messages-page` 整棵列表子树消失，`new` 侧出现 `messages-panel`/`-list`/`-thread`/`-close` 与 `?msg=1&c=` 型 href、以及首页既有元素（`href=/task`、`home-publish-link`）⇒ 属**本单设计意图**，按 AC-5 口径单列说明。
4. **上一版探针的环境性 FAIL（已解，留痕）**：上一轮 `probe-attribution.log` = `PROBE_FAILED / unstable signature: /`，根因 = `/` 上一个**未受 `prefers-reduced-motion` 保护**的 CSS 动画元素（`class=go1858758034`，`15.8×15.8`，`x≈1159`）rect 逐帧抖动。本轮探针在测量期注入禁动画（`FREEZE`）后**不再复现**（`unstable signature` 0 次）⇒ **该 FAIL 属环境性且已消解**，**与 (e)-3.1/3.2 的残余是两个独立根因**。
5. **console 噪点（探针环境产物）**：`Failed to load resource: net::ERR_FAILED`（外部 CDN 主动 abort）+ `Load data error: Error: 请求失败 (200)`（非 `/api/messages/**` 的其它接口未被夹具覆盖，返回空 200）——两版均出现；**`pageErrors` 两版均 `[]`**（零未捕获异常）。
6. **≤767 档 `contentRightVsPanelLeft` 不适用**：面板全屏覆盖、让位量 0 ⇒ 探针就地 `note` 改用 `fullScreen` + `singleColumn` 判据（`states.767|390|375|320.note`）。
7. **未覆盖项（不得当 0 差异）**：归因探针仅采 `/`、`/exchange`、`/item/123`、`/messages` 四页 —— **`/item/new`、`/profile` 未采**；`四语态` 未采（见 (b-附)）。两项均记 `NOT_MEASURED`，如需 AC-5 全页归因须补探针（本报告不改探针逻辑）。
8. `AC-1③` 与 `AC-6` 的日夜间构（`themeShape`）为**探针实读**；`AC-6` 其余四条为**源码面 `grep` 实读**（`ac-6.json`），与 §21.12 中「`NOT_MEASURED`」清单相比，本单已补齐 `768/1024/1199` 三档几何、`≤767` 全屏 + 单栏两态触控 `≥44`、AC-2 两读数、AC-5 归因三件（含灵敏度自证）、面板打开态真实 `scrollWidth`（零溢出）。

---

## 附：读数文件 SHA256（收尾快照）

```
geometry.json                   2,919 行 / 75,364 B   sha256 91c3eae59248527819810ce88b477d4ba6961b2c4627ba975168871ec27e61e9
                                startedAt 2026-10-16T13:22:03Z  finishedAt 13:22:09Z（本轮重生成 · 干净落盘）
attribution.json                  974 行 / 41,749 B   sha256 a912934f8bcd4969397f7c287b8fe05f6144eba1681ef72def3eab6ddf0bfbae
attribution.normalized.json     9,847 行 / 429,115 B   sha256 a71b7564159bbaa0e0aa92adc473b4317a1bbd6bb09e87ceb9d4625a20fa9f3a
                                （= attribution.json 内记录的 normalizedSha256 ⇒ 文件与自述哈希一致，自证）
日志                              ops/v119-msg-panel/logs/{build,test-unit-1,test-unit-2,probe-geometry,probe-attribution,lint,type-check}.log
```
