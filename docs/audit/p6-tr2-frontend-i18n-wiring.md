# P6 · TR-2 / 前端四语接线 + 「翻译中」小标（Kong）

- **单号**：P6-TR-2（本单 = **消费面**；`*_<lang>` 列与 `i18n_status` 由后端 **TR-1b 产出**）
- **仓库**：`/Users/kevin/bistro/seafood`（前端 `frontend`，Vite + React 18 + vitest 0.34）
- **口径**：所有读数 = **本机现取实测**（时间戳见 §5/§6）；`NOT_MEASURED` 处一律显式标注，**不填 0/空**
- **结论**：用户内容（`title/note/name/description/info_input/bio`）在**新接 6 个文件**里按当前语言读取，
  对**空串与缺字段都安全**（一律 `||` + 回落原文，**禁 `??`**）；`i18n_status ∈ {pending, partial}` ⇒ 渲染「翻译中」小标
  （四语文案齐、小尺寸、`pointer-events:none` 非阻挡）；`ready` / **字段缺省** ⇒ 渲染 `null`。
  `npm run build` 退出 0；`src/test/unit` **123 passed（基线 112 ⇒ +11 新增、0 掉）**。

---

## 1. 取证（先取证，后接线）

### 1.1 现有 i18n 机制（照抄，不发明新范式）

| 面 | 真源（现取） | 读数 |
|---|---|---|
| i18n 初始化 | `frontend/src/i18n.js` | `i18next + initReactI18next`；`lng = getLanguageFromUrl(window.location.pathname)`；`fallbackLng='zh'`；四语资源 `zh/en/hk/vn` |
| 语言白名单（**唯一**） | `frontend/src/utils.js:51` | `SUPPORTED_LANGS = ['zh','en','hk','vn']`；`getLanguageFromUrl()` 只认**首位**语言段，非白名单 ⇒ `zh` |
| 路由语言前缀 | `utils.buildLangPath` | 与上面同一白名单（i18n 初始化亦复用之） |
| locale 键集 | `frontend/src/locales/{zh,en,hk,vn}.json` | 接线前：顶层 **74**（实测，四文件相等）；接线后：顶层 **75** / 拍平 **177**（脚本实测）。改前**拍平**数 **176** 由 `177 − 1`（本单只新增 1 条叶键）**推得**，未单独实测 ⇒ 口径已标注 |
| 既有用户内容接线（**已接 ⇒ 只核不改**） | `pages/HomePage.jsx`、`pages/TaskPage.jsx`、`pages/RewardPage.jsx` | 三目链 `lang === 'en' ? (task.title_en ?? task.title) : …`；行级计数：HomePage **12 行**（4 字段 × 3 语种分支：`title`/`note`/`name`/`description`）、TaskPage **6 行**（2 字段：`title`/`note`）、RewardPage **6 行**（2 字段：`name`/`description`）。★ 三页用 `??` ⇒ **空串会穿透**（登记为存量，本单不改，见 §7） |

### 1.2 取值形态与「空串穿透」的实测反例

`??` 只在 `null/undefined` 时回落 ⇒ 若后端给出 `title_en: ''`，`'' ?? title` = `''`（**渲染空白**）。
契约说「未翻译时 `*_<lang>` **等于原文**、不会为空串」，但**不做防御就等于把契约当强保证**；故本单统一取
`obj['<key>_<lang>'] || obj[key]`（`||` 对空串回落原文）。反例已固化为断言（`i18n-content-wiring.test.jsx`）：
`row.title_vn ?? row.title === ''` 而 `pickLocalized(row,'title','vn') === '中文'`。

---

## 2. 接线逐文件（已接 N 处 / 未接原因）

「处」= **内容读取点**（当前语言取值）＋**小标点**（`i18n_status` 条件渲染），分开计。

| 文件 | 内容读取点 | 小标点 | 说明 / 未接原因 |
|---|---|---|---|
| `pages/listings/ListingsPage.jsx` | **1**（卡片标题：`name`→`title` 回落链，读侧 `name`=listing.title） | **1** | 同页「我的订单」行（`/api/prize-item`：`gID`/`bID`）**无文本** ⇒ 未接；`row.status` = 服务端枚举（`listing_status`）⇒ 未接（登记） |
| `pages/listings/ListingDetailPage.jsx` | **2**（`title`（回落 `name`）、`description`） | **1** | 价格/库存 = 数值；`row.status` = 服务端枚举 ⇒ 未接（登记） |
| `pages/listings/PublishListingPage.jsx` | **0** | **0** | **未接原因**：纯上架**表单页**，零渲染用户内容；`title`/`description` 是**待提交原文**（输入框值），**不得**本地化 |
| `pages/jobs/JobDetailPage.jsx` | **2**（`title`、`note`） | **1** | 同页「我的申请」的 `job_status \|\| status` = 服务端枚举 ⇒ 未接（登记） |
| `pages/jobs/JobReviewPage.jsx` | **1**（`info_input` = 申请者提交的交付物文本） | **1** | 队列项 `tID`/`jID` 为 ID；标题走 `t('jobs.itemTitle', …)` 静态文案 ⇒ 未接（登记） |
| `pages/jobs/PublishJobPage.jsx` | **0** | **0** | **未接原因**：纯发布**表单页**（同 `PublishListingPage`） |
| `pages/market/MarketPage.jsx` | **0**（用户录入文本）＋**4 个本地化读口**（`name`/`title`/`side`/`status`，仅「我的挂单」行） | **1**（我的挂单行） | **未接内容字段的原因 = 行内**结构上**没有用户录入文本**（逐键取证见 §3）；`side`/`status` 是枚举文本，本页对它们接的是**本地化读口**：载荷带 `*_<lang>` 即生效，载荷无该后缀列（现取 TR-1b 未合并）⇒ **零行为变化**，`zh` 档行原样直返 |
| `pages/ProfilePage.jsx` | **1**（`bio`，用户简介） | **1** | ★ **编辑态口径**：`bio`/`tempBio` 一律持**原文**（种子 = `user.bio`），只有**展示**走 `pickLocalized(user,'bio',lang)` —— 否则 `updateMyProfile({bio: tempBio})` 会把**译文当原文写回**。`shardHoldings` 恒空（`/api/shard` 已 sunset）⇒ 未接 |
| `pages/HomePage.jsx` / `TaskPage.jsx` / `RewardPage.jsx` | 存量 **12/6/6 行**（4/2/2 字段 × 3 语种分支） | **0** | 本单「**只核不改**」：写法与基线一致，`git status` 未变（§5.4）⇒ 未加小标（登记为下单单点收口项） |

**新增共用面**（本单新增，勿重复造）：

| 文件 | 职责 |
|---|---|
| `frontend/src/i18n-content.js` | `pickLocalized(obj,key,lang)`（`*_<lang> \|\| 原文`，`zh` 直取无后缀）、`localizeFields()`、`contentStatus()` / `isTranslating()` / `needsTranslatingBadge()`；语言码归一复用 `utils.SUPPORTED_LANGS` |
| `frontend/src/components/i18n/TranslatingBadge.jsx` | 小标组件；`ready`/缺省 ⇒ `null`；`data-sf-m="i18n-translating"` + `data-i18n-status` |
| `frontend/src/styles.css` | `.sf-i18n-badge`：`font-size:.6875rem`、`line-height:1.25rem`、`pointer-events:none`（**非阻挡**卡片点击）、`white-space:nowrap` |

---

## 3. market 行键取证（「未接内容字段」的依据，非推断）

本页三个读面（`frontend/src/pages/market/market-api.js` 现取）与后端响应构造（`backend-ts/src/index.ts`）：

| 读面 | 路径（现取） | 行构造（现取） | 行内文本键 | 用户录入文本？ |
|---|---|---|---|---|
| 盘口 | `GET /api/market/:bID/orderbook`（`index.ts:844`） | `DatabaseService.listOrderBook(bID)` → `SELECT o.* FROM market_order`（`database.ts:3288`） | `side`(枚举)/`price`/`volume` | **无** |
| 成交流水 | `GET /api/market/:bID/trades`（`index.ts:858`） | `listTradesByBrand` → `market_trade`（`database.ts:3496`） | `trade_id`/`price`/`amount`/`buyer_uID`/`seller_uID` | **无** |
| 我的挂单 | `GET /api/order`（`index.ts:744`） | `listOrdersByUser`（`database.ts:3478`） | `order_id`/`side`/`price`/`amount`/`amount_filled`/`status` | **无** |

⇒ 交易所线页面渲染的是**数值 / ID / 服务端枚举**，没有「用户录入内容」⇒ 内容读取点计 0（**不是漏接**）。
本页仍接：① 我的挂单行的本地化读口（4 键，载荷无后缀列 ⇒ 零行为变化）；② 小标 1 处。

---

## 4. 「翻译中」小标

- **判据（逐字照交接面）**：`i18n_status === 'pending' | 'partial'` ⇒ 渲染；`'ready'` ⇒ 不渲染；**字段缺省** ⇒ 不渲染（`contentStatus()` 对非字符串返回 `null`）。
- **文案走 i18n**：键 `i18n.translating`，四语**逐文件同名**（保持「四语键集逐文件相同」不变量）：`zh=翻译中` / `en=Translating` / `hk=翻譯中` / `vn=Đang dịch`。
- **尺寸/阻挡**：`.sf-i18n-badge` 小尺寸 + `pointer-events:none` ⇒ 商品卡片（`<Link>`）点击**不被遮挡**；`role="status"`、`title` 附全文（可读性）。
- **位置**：接在**被翻译的对象**旁（卡片标题 / 详情标题 / 帖子标题 / 交付物文本 / 简介标题 / 挂单行标题）。

---

## 5. AC 读数（本机现取）

### 5.1 构建

```
$ cd frontend && npm run build > <scratch>/tr2-build.log 2>&1; echo "BUILD_EXIT=$?"
BUILD_EXIT=0                      # ★ 退出码**直接取自 npm/$?**，不经管道（§5.7 ①）
✓ 1780 modules transformed.       # 与基线同（基线亦 1780）
dist/assets/index-CrRf8rdv.js    480.52 kB │ gzip: 142.62 kB
dist/assets/index-GkPYQpWR.css    70.82 kB │ gzip:  14.87 kB
dist/index.html                    4.64 kB │ gzip:   2.31 kB
dist/assets/hk-DjlsSdH.svg         4.61 kB │ gzip:   2.01 kB
dist/assets/us-BUggRluv.svg        7.87 kB │ gzip:   1.24 kB
✓ built in 1.71s
```

### 5.2 单测

| 口径（命令） | 基线（**改前**现取） | 改后（现取） | 判据 |
|---|---|---|---|
| `npm run test:unit`（= `vitest run src/test/unit`，**验收口径**） | **112 passed / 12 files** | **123 passed / 13 files** | 既有 112 **0 掉**；**+11 新增全绿** |
| `npx vitest run`（**全仓**，含 components/performance/accessibility/e2e） | 124 passed / 7 failed（4 failed files） | 135 passed / 7 failed（4 failed files） | 失败**同名同数**（`Card.test.jsx` ×6 + `VirtualList` ×1；另 2 个文件 collect 失败：`Accessibility.test.jsx`、`e2e/basic.spec.js`（Playwright 规格被 vitest 收集））—— **均为存量**，与改前逐项一致 |

新增用例（`frontend/src/test/unit/i18n-content-wiring.test.jsx`，**11 例**）：

1. `pickLocalized`：空串 ⇒ 回落原文（并断言 `??` 反例确实穿透）；缺字段 / `null` 行安全
2. `zh` 档 = 无后缀字段（译文不进中文档）；非白名单语言码归一到 `zh`；`localizeFields(...,'zh')` 原行直返
3. `localizeFields`：返回新对象、不改原行、缺键不新增
4. `i18n_status` 判据：`pending/partial ⇒ true`；`ready/缺省/未知 ⇒ false`
5. 组件：`ready` / 缺省 ⇒ 渲染 `null`；`pending`/`partial` ⇒ 可见且带 `data-sf-m="i18n-translating"`
6. **AC 用例**（商品列表页，`/en/listing`）：`{name:'中文', name_en:'English', i18n_status:'ready'}` ⇒ 渲染 `English`、**不**渲染 `中文`、**小标不可见**
7. **AC 用例**：`i18n_status:'pending'` 且 `name_en` **等于原文** ⇒ 渲染**原文**（非空白）**且小标可见**
8. `i18n_status` **缺省**（旧载荷）⇒ 回落原文且**无小标**
9. `zh` 档（无前缀路由）⇒ 只认无后缀字段（`English` 不出现）
10. 四语 locale 键数 / 键集相等 + `i18n.translating` 四语齐备、非空、四语互异
11. 静态不变量：**新接 6 文件零 `_(en|hk|vn) ??` 命中**且均经 `i18n-content`；存量三页登记读数

### 5.3 四语键数读数（脚本现取，`node frontend/scripts/p6-tr2-i18n-locales.mjs`，退出码 **0**）

```
[TR-2] 四语 locale 键数（口径：顶层键 / 拍平键路径）
  zh: top=75 flat=177
  en: top=75 flat=177
  hk: top=75 flat=177
  vn: top=75 flat=177
[TR-2] 键集相等：PASS（四文件拍平键数取值集合 = {177}）
[TR-2] 新键 i18n.translating 四语读数
  zh: "翻译中"   en: "Translating"   hk: "翻譯中"   vn: "Đang dịch"
[TR-2] 四语齐备=PASS；四语互异取值数=4/4
[TR-2] 新接文件守卫=PASS（6 文件 `??` 命中全为 0、均经 i18n-content）
[TR-2] 存量登记：HomePage.jsx ??=12 / TaskPage.jsx ??=6 / RewardPage.jsx ??=6
[TR-2] 总判：PASS
```

### 5.4 `git status`（写入面证明）

```
 M frontend/src/locales/{zh,en,hk,vn}.json      （各 +3 行：i18n.translating）
 M frontend/src/pages/ProfilePage.jsx
 M frontend/src/pages/jobs/JobDetailPage.jsx
 M frontend/src/pages/jobs/JobReviewPage.jsx
 M frontend/src/pages/listings/ListingDetailPage.jsx
 M frontend/src/pages/listings/ListingsPage.jsx
 M frontend/src/pages/market/MarketPage.jsx
 M frontend/src/styles.css                        （+21 行：.sf-i18n-badge）
?? frontend/src/i18n-content.js
?? frontend/src/components/i18n/TranslatingBadge.jsx
?? frontend/src/test/unit/i18n-content-wiring.test.jsx
?? frontend/scripts/p6-tr2-i18n-locales.mjs
(+ 本报告 docs/audit/p6-tr2-frontend-i18n-wiring.md)
```

**未接的三页原生基线**：`HomePage.jsx` / `TaskPage.jsx` / `RewardPage.jsx` 在 `git status` 里**不出现** ⇒ 确实「只核不改」。

### 5.5 `backend-ts/**` 未碰（口径说明，逐字）

`git status` **同时**显示 `backend-ts/src/{database.ts,index.ts,translate-service.ts}` 与 `vercel.json` 为已修改 ——
**这不是本单写入**：本单 `terminal` 调用逐条无一条写 `backend-ts/**`（写入面仅上表 `frontend/**` + `docs/audit/**`）。
证据（mtime，`stat -f`，现取）：

```
NOW=2026-10-01 09:40:13 CST
backend-ts/src/database.ts        2026-10-01 09:38:40   ← 并行 TR-1b（同 worktree）
backend-ts/src/index.ts           2026-10-01 09:39:05
backend-ts/src/translate-service.ts 2026-10-01 09:40:11 ← 与本单写入交错发生
vercel.json                       2026-10-01 09:39:06
frontend/src/i18n-content.js      2026-10-01 09:37:50   ← 本单
frontend/src/pages/listings/ListingsPage.jsx 2026-10-01 09:38:10
```

会话开始时 `git status --short` 为**空**（工作树干净）；`backend-ts/**` 的改动在本单执行期间由**并行单（TR-1b）**引入
（同一 worktree、无 unit 级 git 隔离）。**本单对 `backend-ts/**` 只读**（§3 的行键取证 = grep/sed 只读）。

---

## 6. 硬边界 / 红线合规

- 写入面：仅 `frontend/src/**`、`frontend/test`→本单落在既有 `frontend/src/test/unit/**`（新增用例）、`frontend/scripts/p6-tr2-i18n-locales.mjs`、`docs/audit/p6-tr2-frontend-i18n-wiring.md`。**未写**：`backend-ts/**`、`docs/seafood.master-plan.md`、spec、`vercel.json`、任何 `.env*`。
- **未用**：`git add/commit/push`（`git status` 全为未暂存）；`npm install`；`vercel`；`pkill`/`killall`（一次未用）；**本单未启动任何常驻 dev server**（只用 build + vitest）。
  ★ 现取读数：`localhost:5787` 有一个 **监听的 vite 进程 PID 25331，启动时间 `Thu Oct 1 08:50:42 2026`** —— **早于本单会话开始（约 09:36）**，由**其它会话/单**启动，**非本单**；按红线**未做任何 kill**（本单既未起、也未停）。
- **未读取/打印任何密钥或 `.env*` 值**；页面/测试/脚本均不接触密钥。
- §5.7：① 退出码直取（`BUILD_EXIT=0`，不经 `tail`）；② 未用 `timeout`；③ 先骨架（`i18n-content.js` + `TranslatingBadge` + CSS + 四语键）后回填（逐页）；④ 报数均带口径；⑤ 无 `NOT_MEASURED` 填 0/空；⑥ 本报告的「实测」仅标注于有命令读数的条目（构建/单测/脚本/git/stat），其余（如行键取证）标注为**现取源码只读**；⑦ 端到端（真库回读）**不在本单**，本单用 mock 载荷；⑧ 主题同构不变量：`theme-shell-isomorphism.test.jsx` **14 tests 全绿**（含 rect 相等/元素序列断言，改后复跑，见 §5.2）。

---

## 7. 未做 / 交下一单（登记，非本单范围）

1. **端到端（真库回读）不在本单**：本单只用 mock 载荷（AC 明示）；真库 `*_<lang>`/`i18n_status` 回读验收 = 下一单（依赖 TR-1b 合并）。
2. **存量三页 `??` 收口**：`HomePage.jsx`(12) / `TaskPage.jsx`(6) / `RewardPage.jsx`(6) 仍是三目链 + `??`（空串会穿透）；本单「只核不改」⇒ 下单单点收口到 `i18n-content`。**已加静态断言登记**（守卫测试把三页单列，防误扩范围）。
3. **`zh` 档小标口径待裁**：现按交接面**字面**实现（只看 `i18n_status`，不按语言门禁）⇒ 中文档若 `i18n_status='partial'` 也会显示「翻译中」。若产品口径应为「仅在非 `zh` 档显示」，属**一行改动**（`needsTranslatingBadge` 加语言判定），请 Zang 裁定。
4. **静态 UI 文案未迁 i18n**：`ProfilePage.jsx` 等仍有硬编码中文（`个人中心`/`基本信息`/`这个人很懒…`），与本单「用户内容」面无关，未动（超范围）。
5. **`ProfilePage` 的 `bio_*` 列**：交接面字段清单未列 `bio_*`，本页按**同一 `pickLocalized` 语义**接（载荷无 `bio_<lang>` ⇒ 回落原文、零行为变化）；若 TR-1b 未为 `bio` 建列，则该处**恒回落原文**（无副作用）。

## 8. 交接面消费声明（TR-2）

- 消费 `*_<lang>`（`en`/`hk`/`vn`；`zh` 无后缀）与 `i18n_status`（`ready`/`partial`/`pending`；**缺省 ⇒ 无小标**）。
- 归属不变：后端 TR-1b **产出**，本单**消费**；本单未改任何后端文件、未新增/改路径、未改 `vercel.json`。
- 新接页面对**空串**与**缺字段**双安全；`ready`/缺省不显示小标；四语键集保持逐文件相同（177/177/177/177）。
