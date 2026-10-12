# v1.15 §19 · `/item/:id` 详情页 UI 改造（变体 A）· 独立质检报告（Neng）

- **被检 revision**：`2aee62f`（本地 HEAD，**未 push**；ahead origin/main = 3）
- **改前基线（父版 worktree）**：`a111b45`（★ 与 `fa6a953` 前端代码面逐字相同 —— 两者之间只差 `docs/**`）
- **质检方**：Neng（独立质检 · 只读源码；写入面仅 `docs/qa/**` + 仓外 scratch 副本）
- **时间**：2026-10-12 13:42 CST
- **verdict**：**✅ 通过（PASS）** —— 4 条硬门全绿 + §19.8 六条 AC 独立重取全过 + `R-A`..`R-F` 逐条成立 + 独立判负 7 条（6 条按预期触发）；**登记 5 条口径漂移 / 1 条判据冗余（均非实现缺陷，交回 Zang）**
- **R-E 独立建议**：**✅ 接受**（独立重取得 Kon 新判据的 29→0 / true→false 完全成立，且 `>767` 恒 0px 不误命中；Kong 对旧量 `footCoveredPx` 的证伪我也独立复现）
- **★ 本报告不采信 Kong 任何自报读数**：下列每个数都是我在自建实例（AFTER 5796 / BEFORE 5794，独立 `cacheDir`）上现取的。

---

## §0 结论速览

| 层 | 项 | 结果 |
|---|---|---|
| L1 | `npm run build` | **exit 0**；产物 `assets/index-DX7K7ysY.js` / `index-B_l3ZkRj.css` |
| L1 | `npm run test:unit` | **51 files / 494 tests / 0 failed / exit 0**；自取基线（a111b45 worktree 先 build）**51 / 494 / 0** ⇒ **差 = 0，零改锚** |
| L1 | 四语键集 | 顶层 **122** / 拍平 **1045** / 四语节点 **4180 = 1045×4**（zh/en/hk/vn 逐文件相同，我逐文件现取） |
| L1 | `src/locales/` 是否被 `2aee62f` 改动 | **零改动**（`git show --name-only HEAD` 无 `src/locales`；`git diff a111b45..HEAD -- frontend/src/locales/` 空） |
| L2 | AC-1 渲染面 | **差集 = 0**（3 个无 class 结构元素全部可归因）；排除项 12 串命中 **0**、禁用 class 命中 **0** |
| L2 | AC-2 入口不丢失 | 返回入口**恰 1**（7 种路径形态 × 320/1440）+ 可见可点 + 点后 pathname 归位 + 底栏 `none→grid` + **可达目标差集 = 0（5/5）** |
| L2 | AC-3 只改详情页 | 非详情页 **27/27 组合差异集 = 0**；噪声基线同版两跑 sha256 相同；详情页差异集 **⊆ {(i),(ii),(iii)}**；反事实回退 **恰消去 27 条 (ii) 类条目** |
| L2 | AC-4 触控与字号 | ≤767：返回 **44×44**、CTA **min-height 44**、全页最小可见字号 **12px**（无 <12）；>767：`--sf-l-ctl-h` **仍 34px**、CTA `min-height 34px` |
| L2 | AC-5 桌面档 | 1024 / 1440 `.sf-item-actionbar` **`position: static`**、底栏 `display:none` |
| L2 | AC-6 主题同构 | 320/390/1440 日/夜可见元素签名 **sha256 逐值相同**；新增 CSS **无 `[data-theme` 选择器**（命中的两处都在注释里） |
| L3 | `R-A` / `R-B` / `R-C` / `R-D` / `R-F` | **全部成立**（逐条读数见 §4） |
| L3 | `R-E` | **成立**（独立重取，见 §7） |
| L4 | 独立判负 | 7 条设计，**6 条按预期触发**；1 条（R-D 单独中和 ⇒ 遮挡出现）**未触发，如实登记**（见 §5） |

---

## §1 L0 基线与实例（自取）

| 项 | 读数 |
|---|---|
| node | **v18.19.0** |
| npm | **10.2.3** |
| playwright | 仓内 `frontend/node_modules/playwright`（**非 package.json 直依赖**，随其它包带入）；浏览器用**本机系统 Chrome** `executablePath=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`（**未下载浏览器**） |
| 父版 worktree | `git worktree add --detach /Users/kevin/.hermes/profiles/zang/cache/scratch/neng-before-a111b45 a111b45`；`ln -s` 主仓 `frontend/node_modules` → **`<worktree>/frontend/node_modules`**（monorepo：软链挂**子目录**，**未 npm install**） |
| 受控实例 | AFTER = `5796`（root = 主仓 `frontend/`）· BEFORE = `5794`（root = worktree `frontend/`）；各自独立 `cacheDir`（`scratch/neng/vite-cache-{after,before}`），不与被主 dev 实例（5787/5788）抢写 |
| 起实例自证 | 两实例 `GET /item/1` 均 **200**；日志 `VITE v5.4.20 ready`；端口只听 `[::1]`（用 `localhost`） |
| 端口纪律 | 只用 **5794 / 5796**（∈ 5792–5799）；**未碰** 5787/5788/5800/5555/5191 |
| 采数口径 | `reducedMotion:'reduce'` + 注入 `animation/transition:none` + 只采可见元素（`getClientRects().length>0` 且 `display≠none`/`visibility≠hidden`）+ 结构键（`tag|class|attrs|text`，坐标只作值不作键）+ 同版两跑噪声基线 |

> ★ **父版第一跑红过**：`vitest run --root <worktree>` 由**主仓** node_modules 起、glob 到主仓 `src` ⇒ 51 文件全 `Failed to load url`（探针口径错，非父版缺陷）。改成 **在 `<worktree>/frontend/` 内跑** `./node_modules/.bin/vitest run src/test/unit` 后：首跑 **1 failed / 482 tests**，红点 = `p4z-feperf.test.js`「缺少构建产物 dist/assets/*.css —— 先跑 `npm run build`」（**环境性**，缺 `dist`）；补跑 `npm run build`（exit 0）后 = **51 / 494 / 0 / exit 0**。

---

## §2 L1 硬门（逐项自取）

- **build**：`cd frontend && npm run build` ⇒ **exit 0**（1799 modules；`dist/assets/index-DX7K7ysY.js` 410.08 kB）。父版 worktree 同跑 exit 0（`index-CvLdgvTg.js`）。
- **单测**：AFTER **51 files / 494 tests / 0 failed**，exit 0；BEFORE（`a111b45`，先 build）**51 / 494 / 0**，exit 0 ⇒ **逐项相同，零改锚**（无「具名登记失败集」需要）。
- **四语键集**（我逐文件现取，非引述）：zh/en/hk/vn 四文件均 `top=122 / leaves=1045`；四语节点 **4180 = 1045 × 4**；审计脚本 `p4z-i18nviol-global.mjs` 自报 `locale=4180 / source=44`、总判 **PASS**。
- **locale 零改动**：`git show --name-only HEAD` 不含任何 `src/locales/*`（命中 0）；`git diff a111b45..HEAD -- frontend/src/locales/` 输出为空。
- `1` **`frontend/tsc` 不适用**（前端无 `tsconfig`），按 `N/A` 登记，不假称跑过。

---

## §3 §19.8 六条 AC（独立重取）

### AC-1（详情页渲染面 = 白名单，差集 = 0）
- 作用域 = `.sf-route-container`（详情页内容区）；320/390/1440 三档。
- **未归因元素 = 3 个，全部可归因**：`svg.lucide.lucide-chevron-left` + `path`（= 白名单⑤ 返回箭头的图标子树）、`FORM`（= 白名单④ 操作栏的表单壳，无 class，持既有钩子 `data-sf-m="item-buy-form"`）⇒ **有效差集 = 0**。
- **排除项串扫描命中 = 0**（`刷新/返回列表/卖家/品牌/成色/包邮/想要/浏览/留言/收藏/聊一聊/比市场价`，320/390/1440 一致）。
- **禁用 class 命中 = 0**（`sf-item-seller / sf-item-attr / sf-item-promo / sf-item-stats / sf-item-price-orig / sf-layout-side / sf-item-detail-side`）。
- 白名单六项齐备：价格行（`$` / `42` / `单价`）· 大标题 · 详情面板（thumb + 描述 + `库存 6` + 数量输入）· 操作栏（**仅** `立即购买` 一个 CTA）· 返回箭头 · **`.sf-item-note` 在**（`物品编号 #1 · 已上架`）。
- `R-A` 三键 + `R-F` 一键**都在**同一 `.sf-item-meta-group` 内（`闲置物品` / `购买金额由平台统一结算…` / `购买金额以平台结算为准；重复点击不会重复扣款。` / `退款只退还款项…`）⇒ AC-1 的**文字面**含 4 条 meta（见 §6⑤ 的判据漂移登记）。
- **空态面另验**（§19.6 #9 / F15）：`/item/999999`（API 404）⇒ `.sf-item-empty[data-sf-m=item-detail-empty][data-sf-phase=error]`，文案 `关联单据不存在`；API 200+`data:null` ⇒ `data-sf-phase=empty`，文案 **`暂无闲置物品`（`t('item.empty')`）**；两种空态下返回箭头都在（1 个）、底栏均 `display:none`。

### AC-2（入口不丢失 · 归因式）
- **返回入口恰 1 个**：7 种路径形态（`/item/1`、`/zh/item/1`、`/en/item/1`、`/hk/item/1`、`/vn/item/1`、`/item?id=1`、`/en/item?id=1`）× 320/1440 ⇒ `.sf-item-back` 计数 **1**（无第二处）。
- **href**：`/` · `/en` · `/hk` · `/vn` · `/` · `/en`（随语言前缀，zh 无前缀）—— ★ **字面无尾斜杠**（见 §6⑤「AC-2 字面与实现差一个 `/`」）。
- **可见可点**：≤767 `44×44`（`.sf-tap-sq`），>767 `22×22`（不受 44 约束，符合 `T96`）；`display≠none`。
- **点击后行为**（5 种入口全测）：`/item/1`→`/`；`/en/item/1`→`/en`；`/hk/item/1`→`/hk`；`/vn/item/1`→`/vn`；`/item?id=1`→`/`；且每次落地后 `.sf-tabbar` **`none → grid`**、`is-detail` 已摘、`a[data-sf-nav]` **= 5**。
- **可达路由差集 = 0**：以「详情页**可见**锚点 ∪ 点返回后落地页**可见**锚点」为可达集 ⇒ `/`、`/exchange`、`/item/new`、`/messages`、`/profile` **5/5 全可达**，差集 **0**。

### AC-3（「只改详情页」归因式判据）
- **噪声基线**：同版（AFTER）两跑 `/item/1@390`（n=71）与 `/@390`（n=137）⇒ 归一化 JSON **sha256 相同**（`same=true`）。探针有分辨力（见 §5 NC5）。
- **非详情页 27 组合 = 9 路径 × 320/390/1440**（`/`、`/item/new`、`/exchange`、`/messages`、`/profile`、`/en/`、`/en/item/new`、`/hk/exchange`、`/vn/profile`）：**27/27 组合 `diffN = 0`**（BEFORE vs AFTER，结构键 + rect）。
- **详情页差异集**：320 = 145 · 390 = 145 · 1440 = 118 条，**全部 ⊆ 具名类**：
  - **(i) 详情页渲染面变更**：新增（`.sf-item-topbar`/`.sf-item-back`+chevron/`.sf-item-price-l`/`.sf-item-title-l`/`.sf-item-meta-group`/`.sf-item-actionbar`/`.sf-item-cta`）；删除（`.sf-item-actions`+`[data-sf-m=item-back-link]`+`[data-sf-m=item-detail-refresh]`、`.sf-layout-side`+`[data-sf-m=item-detail-side]`、旧 `H2 立即购买`、`.sf-item-form`、`.sf-item-row`）。
  - **(ii) 底栏 `display:none`**：`.sf-tabbar` 子树（NAV + 5 `a.sf-tab` + 图标 + 标签 = **27 条**）+ 5 个祖先容器（HTML/BODY/`DIV`/`app-container`/`sf-shell`）高度值。
  - **(iii) 页面局部结构常量**：`sf-item-price-num` 25.2×31.5 → 38.4×48（字号 28→32 的几何后果）、`sf-item-head` 高 98→111、`sf-item-title-l` 高 24→27，以及其**下游 y 位移**（页脚子树 26–28 条，320 档页脚 y 870.5→792 = **−78.5px**，其中 **+60px 是 `R-E` 给页脚的等量内边距**，其余 −138.5px 来自详情内容变矮）。
- **反事实归因实验**（只在测量期注入 `.sf-tabbar{display:grid!important}`，**不动仓库**）：320/390 两档 diff **145 → 118（恰 −27）**，且**消去的 27 条逐条都是底栏子树** ⇒ **(ii) 类确实只归因于底栏隐藏**；残余 118 条不含任何 (ii) 类，仅 (i)+(iii)。1440 档底栏本就恒 `none` ⇒ (ii) 类条目 **= 0**（1440 差异 118 条全为 (i)+(iii)），与「桌面档无额外后果」一致。

### AC-4（触控与字号）
- ≤767（320/390）：返回 **44×44**；CTA `min-height` 计算值 **44px**、实测高 **44px**；**全页可见文本最小字号 = 12px**（`SPAN.sf-item-price-cur` 是页内最小者，仍 =12 ⇒ 无 <12px 文本）。
- \>767（1024/1440）：`--sf-l-ctl-h` **= 34px**（未被连带抬高）、CTA `min-height` **= 34px**（= `STRUCT['h-btna']` 冻结值）。

### AC-5（桌面档行为）
- 1024 / 1440：`.sf-item-actionbar` `position: **static**`（在内容流内；rect x=20 / w=984、1400 / h=60）；`.sf-tabbar` `display:none`（既有）。**判负条件（fixed）未出现**。

### AC-6（主题同构不破）
- 320（n=71）/ 390（n=71）/ 1440（n=113）三档日 vs 夜可见元素签名 **sha256 逐值相同**（`same=true`，排除既有主题图标子树）。探针有分辨力（NC5）。
- 新增 CSS **无 `[data-theme` 选择器**：`git diff a111b45..HEAD -- frontend/src` 里 `[data-theme` 只出现在 2 处**注释文本**内（item.css / item.css 注释），**无选择器、无 per-theme 颜色字面量**（新规则只用 `var(--sf-*)`）。

---

## §4 L3 `R-A`..`R-F` 逐条验

| 裁定 | 独立读数 | 判 |
|---|---|---|
| **`R-A`** `item.line`/`priceServerNote`/`refundStockNote` 三键保留 + 从侧栏折进 `.sf-item-meta-group` | 三键文案在 320/390/1440 全部可见且**同处** `.sf-item-meta-group`（组内 = 1 个 `h2` + 3 条 `.sf-item-meta`）；`.sf-layout-side` / `[data-sf-m=item-detail-side]` 在 AFTER **全仓源码 0 命中**、渲染面 0 命中 | ✅ |
| **`R-B`** CTA 胶囊 999px，落 `.sf-btn.sf-item-cta` | 计算值 `border-radius = 999px`（320/390/1440 一致）；bg `rgb(255,230,15)` / fg `rgb(32,32,32)` = 既有 `--sf-btna-bg/#FFE60F`、`--sf-btna-fg/#202020`；class = `sf-btn sf-item-btn sf-item-cta`。**跨文件同具体性覆盖的实证**：逐 stylesheet 顺序枚举所有命中该元素的 `border-radius` 规则 ⇒ `.sf-btn.sf-item-cta`（order **73**）＜ `.sf-btn`（order **216** 与 **1292**）＜ UA `button{0}`（order 245）⇒ **页面 CSS 确实先落地**，靠 **(0,2,0) 具体性取胜**；打包产物同证（`.sf-btn.sf-item-cta` 字节位 **4836** ＜ `.sf-btn{` 的 **17558 / 95567**）。**判负**：注入同具体性后置 `.sf-btn.sf-item-cta{border-radius:8px}` ⇒ 读 **8px**（规则确在被测量） | ✅ |
| **`R-C`** 大号价格 32px + 320 档零横向溢出 | `--sf-l-detail-price-size` = 32px，`.sf-item-price-num` 计算 `font-size=32px`；**320 档 `documentElement.scrollWidth == clientWidth == 320`**（`overflowX=false`）。**极端串压测**：`price='123456789.99'` + `description` 120×长串 + `title` 10×超长标题 ⇒ 320/390 **全部零横向溢出** | ✅ |
| **`R-D`** ≤767 详情页等量底部内边距 | `.sf-item-detail` 计算 `padding-bottom`：≤767 = **60px**、>767 = **0px**；中和（inline 0）后文档高**恰减 60px**（320 1277→1217 · 390 1165→1105 · 767 1145→1085）；>767 中和无效（1009 不变） | ✅（但见 §5 NC3 与 §6⑤） |
| **`R-F`** `item.buyNote` 保留渲染 | 320/390/1440 三档可见，文案 `购买金额以平台结算为准；重复点击不会重复扣款。`；meta 组行数 = 3 条 `.sf-item-meta` + 1 个 `h2`（三档一致）；locale 四语键与计数 **一字未动**（122/1045/4180） | ✅ |

---

## §5 L4 独立判负（7 条）

| # | 注入（测量期，不动仓库） | 预期 | 实测 | 判 |
|---|---|---|---|---|
| NC1 | 运行时摘掉 `.sf-tabbar` 的 `is-detail` | 底栏由隐藏变可见 | `none → grid`，`visibleAfter=true` | ✅ 触发 |
| NC1b | 运行时**删除** stylesheets 里的 `.sf-tabbar.is-detail` 规则（removed=1） | 底栏变可见 | `none → grid` | ✅ 触发 |
| NC2 | 追加同具体性后置 `.sf-btn.sf-item-cta{border-radius:8px}` | 圆角变 8px | `999px → 8px`（320/390/1440） | ✅ 触发 |
| NC4 | 中和 `R-E`（页脚 inline `padding-bottom:0`） | 页脚内容被遮回来 | `lastLeafOverlapPx 0 → 29`、`lastLeafCovered false → true`（320/390/767 一致） | ✅ 触发 |
| NC5 | AC-6 度量灵敏度：注入 `.sf-item-panel{padding-top:13px}` | 日/夜签名必变 | `same=false`（n=71） | ✅ 触发（度量有分辨力） |
| NC6 | AC-1 度量灵敏度：注入 `.sf-item-seller` + 文案「卖家」 | 白名单扫必命中 | `forbiddenClassHit=true` / `forbiddenTextHit=true` | ✅ 触发 |
| NC7 | AC-2 可达性灵敏度：隐藏返回箭头 | 可达目标差集 > 0 | 5 目标里 **4 个（`/exchange`/`/item/new`/`/messages`/`/profile`）不可达**（`/` 仍可由顶栏 Logo 到达） | ✅ 触发 |
| **NC3** | 中和 **`R-D` 单独**（`.sf-item-detail` inline `padding-bottom:0`，R-E 保持） | 详情内容被操作栏遮挡 | **`occluded=false` 不变、`detailLeavesCoveredByBar=0` 不变** ⇒ **未触发** | ⚠️ **如实登记（未按预期触发）** |

> **NC3 未触发的诚实归因**：`R-D` 单独中和后文档高确减 60px，但**遮挡没有出现** —— 因为在 ≤767 档，被固定操作栏压住的是**页脚**（文档末元素），而不是详情内容；详情内容（含表单最后一行）在滚动到底时仍在 `barTop` 之上 **450px** 以外。**真正把遮挡从 29px 压到 0 的是 `R-E`**（NC4 已证）。⇒ `R-D` 的「遮挡保护」在「页脚恒在」的现状下**不可独立复现**，其可判负的效应只剩「文档高 −60px」这一条机械量（已通过）。

---

## §6 L5 口径挑刺

### ① `data-sf-m` 钩子变更 —— 被引用的地方全查（**我没有改任何 docs**，逐行交回）
钩子变更：**新增** `item-back` / `item-actionbar`；**消失** `item-back-link` / `item-detail-refresh` / `item-detail-side`。

- **是否被测试引用**：`grep` 全仓 ⇒ 上述消失钩子在 `frontend/src/test/**` **0 命中**（**不存在被静默弱化的断言**；`p7e-tails-beta` 锚的是 `.sf-item-note`，仍保留）。
- **过期行（逐行逐值，交回 Zang 处置）**：

| 文件:行 | 现字面（过期值） | 现状 |
|---|---|---|
| `docs/OPEN-ITEMS.md:166`（`F15` 行） | 「返回列表」`data-sf-m="item-back-link"`；`ItemDetailPage.jsx:**116**` | 钩子已改 `item-back`；空态行号已漂到 **:125**；且空态现在**没有**「返回列表」文字入口（只有 `.sf-item-back` 箭头，`aria-label=t('item.list')`） |
| `docs/route-layer.spec.md:8042`（§40.1 附入口） | 「返回列表」= 现取钩子 `data-sf-m="item-back-link"` | 同上，已过期 |
| `docs/design/design-system.spec.md:1617`（§17.4 口径行） | 现取钩子 `data-sf-m="item-back-link"`（+ 快照 `docs/versions/design-system.spec.v1.15.md:1617`） | 同上，已过期 |
| `docs/OPEN-ITEMS.md:162`（`F10` 行） | `data-sf-m="item-*"` 唯一钩子 **`39`** | **现取 = 38**（−`item-back-link`/`item-detail-refresh`/`item-detail-side`、+`item-back`/`item-actionbar` ⇒ 净 −1）。基线 `a111b45` 亦实测 **39** |
| `frontend/scripts/p4z-b4ciib-geometry.mjs:60,66` · `p4z-b4ciic-geometry.mjs:60,66` | 选择器清单含 `[data-sf-m="item-detail-side"]` | 该钩子已不存在（`item-detail-hero` 仍在）。**这两个脚本未被任何 test 调用**（`grep frontend/src/test` = 0），属审计脚本面残留 |
| `docs/audit/item-rename.md:240-241` | 引用 `[data-sf-m="item-detail-hero"]` 的旧几何读数 | 钩子仍在，但该表读数是 v1.10 改名期的历史值（**历史留痕，不算错**） |

### ② `R-E` 的 `:has()` 规则
- **是否撞文本解析断言**：**否**。对 `styles.css` 做文本解析的断言只有 `s22-decor-cleanup.test.js`（切角/位移阴影/零偏移环计数），新增规则只加 `.sf-tabbar.is-detail{display:none}` 一行，**不产生** `clip-path:polygon` / 位移 `box-shadow` / `0 0 0 Npx`；新注释内也无「以 `/*` 收尾的路径字面」⇒ 该文件 9 例全绿。`:has()` 规则落在 **`item.css`**（页面文件），**无任何测试对它做文本解析**；`p6-btn-impl2` 只校验 `.sf-item-btn` 规则本体与家族清单（未动）。
- **`has()` 支持面与降级后果**：本机 Chrome `CSS.supports('selector(:has(*))')` = **true**；主流面（caniuse）Chrome **105+** / Safari（含 iOS）**15.4+** / Firefox **121+**。
- **降级后果（量已取）**：不支持 `:has()` 时整条规则被丢弃 ⇒ 页脚无等量内边距 ⇒ **页脚内最后可见叶子被固定操作栏压住 29px**（bar 高 61 − 32 基础留白）。**风险定级 = 低**（只影响 2022 年前的老浏览器；用户群为移动端主流 + 桌面 Chrome）。⇒ **登记为已知降级，不立项**；若要零风险，备选是给页脚补一个不依赖 `:has()` 的等价规则（需另裁，本单不动）。

### ③ `item.refresh` / `item.buyNote` 两键的消费点口径
- `item.refresh`：**现消费点 = 0**（`grep frontend/src` 命中 0；原唯一消费 `ItemDetailPage.jsx:111` 已随刷新按钮删除）。规范 §19.7 已**就地把该键登记为「保留、非死键清理对象」** ⇒ 口径自洽；`item.refresh` 在 zh/en/hk/vn 四语**都仍在**。
- `item.buyNote`：**现消费点 = 1**（`.sf-item-meta-group` 内一行），四语都在。与 §19.7「零新增/零删除」自洽。
- ⇒ **两键口径自洽**，无「有键无消费」或「有消费无键」的错配。

### ④ `N39` 纪律与四语节点自查
- 新增注释里「以 `/*` 收尾的路径字面」扫描：`git diff a111b45..HEAD -- frontend/src` 命中 **0**（新增注释用的是 `/…`、`/api/prize/…` 形态）。
- 审计脚本 `p4z-i18nviol-global.mjs` 自跑：总判 **PASS**，`locale=4180 / source=44`，`4180 = 1045 × 4` **对得上**（即无吞码）⇒ `N39` 自查通过。

### ⑤ 我发现的规范/判据漂移（**均属「待回写」，不是实现缺陷**）
1. **§19.5 白名单（六项）与 §19.8 AC-1 的字面判据不含 `R-A`/`R-F` 的内容**：`item.line`/`priceServerNote`/`refundStockNote`/`buyNote` 四行 meta 都不是六项之一。⇒ **AC-1 按规范字面（六项并集、差集=0）判会误判为负**；本报告按 Zang 派单给的**扩展白名单（六项 + `R-A` 三键 + `R-F` 的 `item.buyNote`）**判定（= 通过）。
2. **§19.4 末表仍写 `--sf-l-detail-price-size = 28px`（32px 为备值）**，实现已按 `R-C` 落 **32px** ⇒ 表值过期（`OPEN-ITEMS.md:98` 已记「Q3 已裁 = 32px，待回写」）。
3. **§19.11 `Q2`/`Q3` 仍为「待裁」**，而 `OPEN-ITEMS.md:98` 已记 Zang 2026-10-12 终审裁定 ⇒ 待 Jing/Zang 就地回写。
4. **`R-A`/`R-D`/`R-F`（Zang 终审追加）尚未进入 `design-system.spec` §19**（`OPEN-ITEMS.md:98` 明确记「待回写」）；§19 里没有 `R-E`/`R-F` 这两条已实现的裁定 ⇒ 实现已越过规范文本，规范侧需补 §19 的 `R-*` 小节。
5. **AC-2 的 href 字面集带尾斜杠**（`{'/','/zh/','/en/','/hk/','/vn/'}`），实现产出**无尾斜杠**（`/`、`/en`、`/hk`、`/vn`，`buildLocalizedPath(lang,'/')` 的既有行为）。语义等价（react-router 归一），但**判据若按字符串严格比对会假红** ⇒ 建议规范把该集合改为无尾斜杠形态或注明「忽略尾斜杠」。
6. **`R-D` 的判据与 `R-E` 混淆**：派单里 `R-D` = 「详情页等量底部内边距（内容不被操作栏遮挡）」，但**挡住的内容是页脚**，而页脚保护是 `R-E` 的职责（NC3/NC4 已证）。`R-D` 可独立复现的只有「≤767 文档高 +60px」。⇒ 建议规范把两条的判据写清（`R-D` = 机械量 +60px；`R-E` = 内容级遮挡 29→0），否则后人复现 `R-D` 会复现不出来（我这次就复现不出）。

---

## §7 `R-E` 独立裁定建议（**不采信 Kong 读数**）

| 量 | 320 / 390 / 767（≤767） | >767（768 / 1024 / 1440） |
|---|---|---|
| `computedFootPadBottom`（`.sf-region-foot`） | **60px**（R-E 生效） | **0px**（R-E 正确地**不**命中） |
| `lastLeafOverlapPx`（页脚最后可见叶子 ∩ 操作栏带） | 在 = **0** / 去 = **29** | 在 = 去（无 R-E 概念；操作栏 `static`） |
| `lastLeafCovered` | 在 = **false** / 去 = **true** | 在 = 去（度量在此档无意义，见下注） |
| `footCoveredPx`（页脚盒 ∩ 操作栏盒） | 在 = **61** / 去 = **61**（**恒等**） | 0 / 0 |
| `.sf-item-actionbar` `position` | `fixed` | `static` |

- **Kong 的证伪我独立复现**：`footCoveredPx` **在/去 `R-E` 都 ≡ 61**（= 操作栏高），因为页脚是文档末元素、滚到底时盒底恒落视口底 ⇒ **该量对 `padding` 不敏感，不是遮挡量**，不能作 `R-E` 的判据。**结论：Kong 改判据是对的。**
- **Kong 的新判据我独立取到同样的读数**：`lastLeafOverlapPx` **29 → 0**、`lastLeafCovered` **true → false**，且 **320/390/767 三档完全一致**；`>767` 档 `computedFootPadBottom` **恒 0px**、操作栏 `static`（不误命中）。
- **★ 我加的两条独立证据（Kong 未报）**：① `R-E` 的**降级量**已定档 = 29px（= 61 − 32 基础留白），可用于 `:has()` 不支持时的风险量化；② `R-E` 的**余量** = 60 − 29 = **31px**（真机 `env(safe-area-inset-bottom)` 下操作栏与页脚同步抬高，余量不变 ⇒ 真机不会翻车）。
- **我的独立建议**：**接受 `R-E`**。判据建议固化为：**「≤767 三档：`lastLeafOverlapPx` = 0 且 `lastLeafCovered` = false；去 `R-E` 必须回 29 / true；>767 档 `computedFootPadBottom` ≡ 0px 且操作栏 `static`」** —— 该判据**可判负**（NC4 已证）。

> ⚠️ **度量作用域提醒（我给后人留的坑标记）**：`lastLeafCovered` 只在 **`position:fixed` 的操作栏档（≤767）** 成立；在 `>767` 档操作栏在内容流内（`static`，y 408–468），`lastLeafBottom(767.5) > barTop(408.5)` 会**恒真** ⇒ 该量在 >767 无意义，判据必须限档（我上面已限档）。

---

## §8 `NOT_MEASURED`（诚实清单）

1. **真机**：`env(safe-area-inset-bottom)` 在设备档恒 0 ⇒ 底部安全区的真机表现 **NOT_MEASURED**（真机入口 `http://<LAN-IP>:5800/...`，由 Kevin/Kong 验）。
2. **未 push ⇒ 生产仍是旧版**：本轮**不拿生产当验收面**。只读哨兵登记（未执行写操作）：被检码**不在生产**。
3. **`Safari` / `Firefox` 的 `:has()` 实际渲染**：只在 **Chrome**（+ 本机 Chromium）上实测；Safari/Firefox 的降级行为是**推理 + caniuse 版本表**，非本机实测。
4. **服务端数据面**：本报告所有页面读数都在 **API mock**（`/api/prize/:id` 单行夹具）下取得 ⇒ **真库数据形态下的几何未测**（本仓 dev 库与生产不同源，已知口径）。
5. **`/item/new` 的「不隐藏底栏」**只在 AC-3 的非详情页零差异里间接证明（tabbar 在两侧都可见），未单列一条「点进发布页底栏在」的独立读数（**已由 27/27 零差异覆盖**）。
6. **登录态切换（未登录 vs 登录）下的详情页**：AC-2 用登录态取的主读数；未登录态只在一次探针里顺带看到 `a[data-sf-nav]` 少 `/profile`（**既有行为，非本单**），未做双态全量对拍。
7. **`p4z-b4ciib/c-geometry.mjs` 脚本能否仍跑通**：未执行（它们要另起实例/需要旧钩子），只做静态引用核查（§6①）。

---

## §9 证据落点与收尾自证

- **本报告**：`docs/qa/v115-item-detail-qa.md`（本文件）
- **机器可读读数附录**：`docs/qa/v115-item-detail-qa.readings.json`（我全部探针的原始 JSON 摘录：AC-1/2/4/5/6 · R-B 胜出规则序 · R-C · R-D/R-E 洁净四变体 · 噪声基线 · 27 组合差异汇总 · 14 条 NC）
- **仓内既有证据（Kong 入库，我未改）**：`frontend/.v115-item-detail-artifacts/`（38 件）
- **仓外 scratch（会被清理，仅过程留痕）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/neng/`（`neng-after.mjs` · `neng-after2.mjs` · `neng-diff.mjs` · `neng-empty.mjs` · `ac2loc.mjs` · `ac2click.mjs` · `nc2b.mjs` · `*.json` · `*.out/.err.txt`）+ 父版 worktree 副本 `scratch/neng-before-a111b45/`
- **回收**：vite 实例按**精确 PID** kill；`git worktree remove` 后 `git worktree list` 只剩主仓；`git status --porcelain` 只剩 `docs/qa/**` 新增；`HEAD` 与开工同为 **`2aee62f`**。

### 收尾 `git status --porcelain` 逐条归因
| 条目 | 归因 |
|---|---|
| `?? docs/qa/v115-item-detail-qa.md` | 本报告（允许写入面） |
| `?? docs/qa/v115-item-detail-qa.readings.json` | 本报告读数附录（允许写入面） |

> **未改**：`frontend/**` 源码 · 任何断言 · `docs/design|route-layer|seafood.master-plan|OPEN-ITEMS` · 任何库/生产数据。**未 push**。

---

## §10 一句话给 Zang
实现侧**可以过**（硬门全绿、六条 AC 全过、`R-A`..`R-F` 全成立、判负可触发）；**需要你回写的是规范侧 6 条漂移**（§6⑤）与 **docs 里 4 处过期钩子/计数（§6①）+ 2 个审计脚本残留选择器**；`R-E` 我建议**接受**并按我给的固定判据入册（含「只在 `fixed` 档判定 `lastLeafCovered`」这条限档规则）。
