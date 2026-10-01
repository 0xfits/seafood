# P6 验收报告 · 生产站「用户内容自动四语」真浏览器验收

- **单元**：NENG-ACCEPT-PROD（质检 / 只验收，**未改任何代码**）
- **目标站**：`https://seafood-opal.vercel.app`（海鲜市场，四语站）
- **vantage**：**生产域名**（平台自带浏览器直访）——**非**本地栈，未使用 `127.0.0.1:5787` 回落
- **run tag**：`p6accept-20261001-192350`
- **取证目录**：`backend-ts/.p4-artifacts/p6accept-20261001-192350/shots/`（24 张 PNG，见 §6）
- **窗口**：1440×900（deviceScaleFactor=1, mobile=false）与 390×844（DSF=2, mobile=true），经 CDP `Emulation.setDeviceMetricsOverride` 设定
- **被测面**：`/listing`（商品=读面 `GET /api/prize/all`）、`/task` + `/task/24`（招工）、`/reward`（积分/奖励）、`/shard`、`/`，每面 × 四语（zh=无前缀 / `/en` / `/hk` / `/vn`）
- **总体结论**：**核心功能（四语内容切换）实测通过**；发现 3 项范围外但真实存在的问题（见 §7）。

---

## 0. 环境障碍与可达性证据（生产域名）

**结论：本机浏览器路径可达生产域名，无需退本地。** DNS 劫持**确实存在**，但本次未阻断浏览器路径。

`curl` 双口径（一次取证，非管道取值 ⇒ 退出码来自 curl 自身）：

| 口径 | 命令要点 | HTTP 码 | remote_ip | 判读 |
|---|---|---|---|---|
| 不打洞（默认 DNS） | `curl --max-time 8 https://seafood-opal.vercel.app/` | **200** | **198.18.16.176** | IP 落在 `198.18.0.0/15`（代理 fake-IP 段）⇒ **DNS 劫持坐实**；但本机代理隧道仍转发，故得 200 |
| 打洞 | `curl --max-time 12 --resolve seafood-opal.vercel.app:443:76.76.21.21 …` | **200** | **76.76.21.21** | 直击 Vercel 边缘节点，200 |

⇒ 两种口径都 200，但**默认口径的 remote_ip 不是 Vercel 网段**——即「本机 DNS 被劫持」这一前提成立，只是**代理兜住了**。**本报告全部读数取自浏览器路径（生产域名）**。

---

## 1. 四语切换 · 文本对照表（核心）

### 1.1 商品名 / 积分名（同一对象：`/api/prize/all` id=19，渲染于 `/listing` 卡片）

| 语言 | 实测看到的卡片正文（逐字） | 是否=预期真译文 |
|---|---|---|
| **zh** | `海鲜礼盒测试丙：虾蟹双拼` | ✅ 中文原文 |
| **hk** | `海鮮禮盒測試丙：蝦蟹雙拼` | ✅ 与题目给定值逐字一致 |
| **en** | `Seafood Gift Box Test C: Shrimp and Crab Duo` | ✅ 与题目给定值逐字一致 |
| **vn** | `Hộp quà hải sản thử nghiệm C: Combo tôm và cua` | ✅ 与题目给定值逐字一致 |

同页另外 3 条 TR1C 变体也随语言变化（如 en `Seafood Gift Box TR1C Test: Shrimp and Crab Combo-tr1c01015515`），说明**不是个例**。读数：`/listing` 卡片 29 个（四语恒定），标题/描述**空串 0 个**。

### 1.2 招工（对象：`/api/task/all` id=24，渲染于 `/task/24` 详情页）

| 语言 | 标题（实测） | 备注正文（实测） |
|---|---|---|
| **zh** | `海鲜招工测试甲：整理货架与盘点` | `负责每日盘点与货架整理，包午餐` |
| **hk** | `海鮮招工測試甲：整理貨架與盤點` | `負責每日盤點與貨架整理，包午餐` |
| **en** | `Seafood hiring test A: Shelving and inventory` | `Responsible for daily inventory and shelf organizing, lunch provided` |
| **vn** | `Bài kiểm tra tuyển dụng hải sản A: Sắp xếp kệ hàng và kiểm kê` | `Chịu trách nhiệm kiểm kê và sắp xếp kệ hàng hằng ngày, bao ăn trưa` |

✅ **标题 4/4 随语言切换，备注 4/4 亦为真译文**（en 备注首轮因我的关键词过滤词不匹配而漏判，已用全文 dump 复核：确为英译，非中文残留）。

### 1.3 积分名（`/reward` 卡片面）
⚠️ **该面未能呈现已翻译对象**：`/reward` 实测 `可兑换 (0) / 限量版 (0) / 高价值 (1)`，三个 Tab 中唯一有卡片的「高价值」渲染出的是 `b3d pricey`（英文原文，无需翻译；vn 档标题显示 `b3d đắt`，副标题仍 `b3d pricey`）。**已翻译的 22 个奖品名没有出现在 `/reward` 卡片上**（`库存不足` ⇒ 不进可兑换/高价值列举？实测「高价值」只列 `b3d pricey`）。
⇒ 积分名的四语渲染**改由 `/listing` 面举证**（该页自述读面即 `GET /api/prize/all`，与 `/reward` 同源），见 §1.1。**`/reward` 卡片路径本身**对已翻译奖品的渲染 = **NOT_MEASURED**（无可用数据行可渲染）。

### 1.4 数据面复核（只读 GET，浏览器内同源 fetch）
| 接口 | HTTP | 行数 | `i18n_status` 分布 |
|---|---|---|---|
| `GET /api/task/all` | 200 | **20** | `ready` × 20 |
| `GET /api/prize/all` | 200 | **22** | `ready` × 22 |

⇒ **20 + 22 = 42/42 全部 `ready`**，与交接背景一致；**`pending` / `partial` 计数 = 0** —— 这直接解释了 §3 为何观察不到小标。

---

## 2. 无空白卡片（原始 bug 回归）

| 面 | zh 卡片数/空串 | en | hk | vn |
|---|---|---|---|---|
| `/listing` | 29 / **0** | 29 / **0** | 29 / **0** | 29 / **0** |
| `/task` | 26 / **0** | 26 / **0** | 26 / **0** | 26 / **0** |
| `/reward` | 4 / **0** | 4 / **0** | 4 / **0** | 4 / **0** |

- 判据：卡片锚点/按钮 `innerText.trim()` 为空 ⇒ 计空串。**12 次渲染（4 语 × 3 面）合计空串 0**。
- 目标卡片叶节点文本四语均非空（§1.1/§1.2 逐字文本即证据）。
- 移动档（390）同样有卡片可见（listing 7 / task 6 / reward 4 个视口内可点卡片），**被遮挡卡片 0**（`elementFromPoint(卡片中心)` 命中的仍是该卡片）。
⇒ **原始「空白卡片」未复现**。

---

## 3. 「翻译中」小标行为

**观察结果：未能观察（0 次出现）——如实记录，未伪造。**

| 检查项 | 读数 |
|---|---|
| `[data-sf-m="i18n-translating"]` / `[data-i18n-status]` 元素数 | **0**（四语 × `/listing` `/task` `/task/24` `/reward` `/shard` `/`，全部 0） |
| **中文档（zh）下出现次数** | **0** ✅（符合「中文档不得出现」） |
| 非中文档（en/hk/vn）出现次数 | **0** —— 因库内 42/42 全 `ready`（§1.4），`isTranslating('ready')===false`，**当前数据下不可能出现** |

**代码路径存在性（静态阅读，标注为「代码阅读」而非实测）：**
- `frontend/src/components/i18n/TranslatingBadge.jsx`：`normalizeLang(...)==='zh' ⇒ return null`（**中文档硬不渲染**）；`!isTranslating(status) ⇒ return null`；渲染 `span.sf-i18n-badge[data-sf-m="i18n-translating"]`，CSS `pointer-events:none`（不阻挡卡片点击）。
- `frontend/src/i18n-content.js`：`TRANSLATING_STATUSES=['pending','partial']`；`contentStatus()` 对**缺字段/非字符串 ⇒ null**（⇒ 不显示）；`pickLocalized` 用 `||` 而非 `??`（空串安全回落原文）。
- **接线覆盖（代码阅读）**：`TranslatingBadge` 被 6 处 import —— `ListingsPage` / `ListingDetailPage` / `JobDetailPage` / `JobReviewPage` / `MarketPage` / `ProfilePage`。
  ⚠️ **未接线**：`TaskPage.jsx`、`RewardPage.jsx`（含 `TaskCard` / `RewardCard`）走旧三目链（`task.title_en ?? task.title` 风格），**无小标渲染点** ⇒ 招工列表/奖励列表卡片即便出现未译内容也不会显示小标（**范围外发现，见 §7-2**）。
- 「能出现小标」这一点**未实测**（需造 `pending/partial` 数据 = 写库，**被硬边界禁止**）。故本条只能给：**数据面 0 例 + 代码路径存在 + 中文档硬屏蔽已由代码保证**。

---

## 4. 两档布局

### 4.1 横屏 1440×900（CDP override 实测）
| 语言 | `/listing` scrollWidth/clientWidth | `/task` | `/reward` | 横向溢出 |
|---|---|---|---|---|
| zh | 1440 / 1440 | 1440 / 1440 | 1440 / 1440 | **无** |
| en | 1440 / 1440 | 1440 / 1440 | 1440 / 1440 | **无** |
| hk | 1440 / 1440 | 1440 / 1440 | 1440 / 1440 | **无** |
| vn | 1440 / 1440 | 1440 / 1440 | 1440 / 1440 | **无** |

`document.documentElement.scrollWidth <= clientWidth` 在 **12/12** 组合成立。

### 4.2 竖屏 390×844
| 语言 | `/listing` | `/task` | `/reward` | 溢出元素（右边界越界） |
|---|---|---|---|---|
| zh | 390/390 | 390/390 | 390/390 | 0 |
| en | 390/390 | 390/390 | 390/390 | 0 |
| hk | 390/390 | 390/390 | 390/390 | 0 |
| vn | 390/390 | 390/390 | 390/390 | 0 |

`document.body.scrollWidth` 亦等于 390（非仅 html 层面）⇒ **12/12 无横向溢出**。

**底部 Tab 栏**：**存在且可用** —— `.sf-tabbar`（`position:sticky`，rect **top=782 / bottom=844**，即贴住 844 视口底，高 62px，内含 **4 个 `.sf-tab`**：首页/社区奖励/社区任务/碎片市场；en/hk/vn 分别渲染 Home·Rewards·Tasks·Shard Market / 首頁·社區獎勵·社區任務·碎片市場 / Trang chủ·Phần thưởng·Nhiệm vụ·Chợ mảnh）。
- **真实点击测试**：`elementFromPoint(社区奖励中心点)` 命中 `A.sf-tab`（**未被任何层遮挡**）→ `click()` → `location.pathname` 由 `/` 变为 **`/reward`**，页面正常渲染 ⇒ **可用** ✅
- 桌面版顶部导航在 390 档被隐藏（`w=0,h=0`）⇒ 无重复导航遮挡。
- 页面存在一个 `z-index:9999` 的全屏 `DIV`（空、无子节点、`pointer-events:none`）⇒ **不拦截点击**（与「被遮挡卡片 0」互证）。
- 卡片未被遮挡：`blockedCards = 0`（4 语 × 3 面，共 12 次）。

---

## 5. 控制台错误 / 网络失败分类

**JS 错误：0**（四语每种面均 0）——采集口径：`Page.addScriptToEvaluateOnNewDocument` 注入钩子，捕获 `window.onerror` + `unhandledrejection` + `console.error` 包装；`/listing` `/task` `/reward` `/shard` `/` 各语言累计均为 `[]`。

| 类别 | 计数 | 逐条内容 | 计负？ |
|---|---|---|---|
| **A. Tailwind CDN 生产告警**（已知债务） | **1/页** | `cdn.tailwindcss.com should not be used in production…` | **不计负**（单列） |
| **B. Console warn · Font Awesome CDN 失败** | **1/页** | 站内自带中文告警 `Font Awesome CDN加载失败，尝试使用本地版本`（已回落本地版本；直连复核该 CSS = **HTTP 200**）⇒ 疑似**间歇性/首帧**失败，非持续故障 | 轻微 |
| **C. HTTP 4xx** | **2 条**（仅 hk 档一次） | `cdn.jsdelivr.net/gh/atelier-anchor/smiley-sans@main/webfont…` = **404**；`raw.githubusercontent.com/atelier-anchor/smiley-sans/main/webfont…` = **404**（微笑字体），仅影响字形，**不影响文案/布局**（非全语言稳定复现） | 低 |
| **D. 其它 JS/资源错误** | **0** | — | — |
| **E. API 失败** | **0** | 同源 `/api/*` 无 ≥400；`/api/task/all` `/api/prize/all` 均 200 | — |

- **Tailwind 生效性**：`cdn.tailwindcss.com` 脚本已挂载，且注入探针（`class="hidden"` ⇒ `display:none`）判定 **Tailwind 样式确实生效**（`effective=true`）。
- ⚠️ **口径提示**：`responseStatus` 一类指标把 CDN 缓存命中写成 `duration=0/transferSize=0`，**不等价于失败**——故上表把「ZERO_DUR」全部剔除，只保留**真 4xx** 与**站内自身告警**。HTTP 200 直连复核：Font Awesome CSS 200、smiley-sans CSS 200。

---

## 6. 截图取证

目录：`backend-ts/.p4-artifacts/p6accept-20261001-192350/shots/`（**24 张**；`Page.captureScreenshot` 全页 `captureBeyondViewport=true`）

- **1440×900（12 张）**：`1440-{zh,en,hk,vn}-listing-full.png`（全页）、`1440-{…}-listing-card.png`（目标礼盒卡片视口特写）、`1440-{…}-task24-full.png`（招工详情全页）
- **390×844（12 张）**：`390-{…}-listing-full.png`、`390-{…}-listing-card.png`、`390-{…}-task-full.png`
  例：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/p6accept-20261001-192350/shots/1440-en-listing-card.png`

---

## 7. 范围外但实测发现（建议转单，本次未修）

1. **UI 文案硬编码中文，不随语言切换**（非用户内容，属 UI chrome）：实测 en/hk/vn 档下仍显示简体中文 `任务中心 / 参与任务，赚取积分，解锁精彩奖励 / 可参与 / 待领取 / 已参与`（`/task`）与 `奖励中心 / 用积分兑换精彩礼品和特权 / 可兑换 / 限量版 / 高价值 / 库存不足 / 暂无可兑换奖励`（`/reward`）。定位：`TaskPage.jsx:230,143,254,277`、`RewardPage.jsx:99,293,317,335,344,346,367` 等**字面量直写**（**代码阅读**定位）。⇒ 四语的「完整度」在列表页/奖励页有缺口，验收口径上**与用户内容翻译无关**，但用户观感上就是中文未切。
2. **「翻译中」小标接线不完整**：`TaskPage.jsx` / `RewardPage.jsx`（及其 `TaskCard` / `RewardCard`）未接 `TranslatingBadge`，走旧三目链；若将来出现 `pending/partial` 的招工/奖励对象，**这两处不会提示**。
3. **微笑字体 404**（`smiley-sans` via jsDelivr GH + raw.githubusercontent，各 1 次，见 §5-C）。
4. **Font Awesome CDN 告警**（站内自带兜底），直连复核 200 ⇒ 间歇性。

---

## 8. NOT_MEASURED 清单（禁填 0/空）

| # | 项 | 原因 | 边界 |
|---|---|---|---|
| NM-1 | `/reward` 卡片面渲染**已翻译**奖品名 | 该面可兑换/高价值列举实际只渲染 `b3d pricey`，22 个已翻译奖品无一进入渲染集（库内可用性/库存门控） | 无可用数据行，非我方可控；**已用 `/listing` 面（同 `GET /api/prize/all` 读面）替代举证** |
| NM-2 | `pending` / `partial` 状态下小标的**实际渲染** | 需写库造未翻译数据 ⇒ 违反**硬边界（禁 DML）** | 仅给「数据面 0 例 + 代码路径阅读」 |
| NM-3 | 登录后页面（`/profile` 个人简介四语、`/dashboard/*` 管理面、`/task/review`） | 未登入（**禁止**在站点提交任何表单/凭据） | 个人简介的四语读取（`ProfilePage` 已接 `pickLocalized`+小标）**未实测**，仅代码可见 |
| NM-4 | 移动档真机触控手势/滚动惯性 | 仅 CDP 视口仿真，非真机 | 已覆盖溢出/遮挡/可点性三项 |
| NM-5 | 1440 档全页像素级视觉回归（对齐/断行） | 本次以文本 + 几何读数为主，截图留档人工复核 | 截图已存 §6 |

---

## 9. 口径与硬约束遵从

- ✅ 只写：本报告 + `backend-ts/.p4-artifacts/p6accept-20261001-192350/**`；**未触碰** `src/**`、`frontend/**`、`migrations/**`、`vercel.json`、spec、`docs/seafood.master-plan.md`、`.env*`。
- ✅ **未**执行 `git add/commit/push`、`npm install`、`vercel`、DDL/DML、`pkill`/`killall`；**未启停任何服务**。
- ✅ 纯只读浏览：**未提交任何表单、未发布任何内容、未发起任何资金/挂单操作**；未读取或打印任何密钥/`.env*`。
- ✅ 退出码取自 curl 自身（非管道之后）；未使用 `timeout`（本机无）。
- ✅ 「代码阅读」与「实测」在正文中逐项区分；`NOT_MEASURED` 未填 0/空。
