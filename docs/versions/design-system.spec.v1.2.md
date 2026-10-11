# 海鲜市场 · 主题体系设计规范与 Design Token 契约

> 版本 **v1.2** · 作者 **Jing（制度员）** · 状态：**口径冻结（T1..T79 逐条）**（v1.1 新增 `T75..T79` = 手机竖屏 H5 加固口径 P0–P4，见 §13；**v1.2 收窄 `T77` 实施范围 + 升 `T75` 配对项为硬判据**，见 §12 / §13.1）
> 交付物路径：`docs/design/design-system.spec.md`
> 冻结依据：Kevin 口径 D9（2026-09-27 更正）+ Zang 连带裁决 `docs/seafood.master-plan.md` §5.3（八条）
> **v1.1 冻结依据（追加）**：Kevin 2026-10-11 定档「seafood 前端**桌面档不动**，把**手机竖屏（H5）档**做扎实，P0~P4 全上」；依据 = 设备档实测报告（Neng 采集 / Zang 复核 40/40 零横向溢出；判负实验 `baseline==rerun==restored`；tabbar 真实点击跳转 PASS；1440 档 tabbar `display:none`）
> **v1.2 冻结依据（追加 · Zang 2026-10-11 两条裁定）**：① **`T77`（P2）实施范围一律限在 `@media (max-width: 767px)` 内** —— **复用同一个断点值 767**、**不得新增断点类型**（如 `pointer: coarse`），`frontend/src/shell/shell.css` 仍必须**只有一个 767 断点块**；**桌面档几何零变化为硬判据**。理由：v1.1 原方案（直接抬 `.btn` 家族 / `--sf-*-ctl-h` 34→44）会**连带抬高桌面控件**，与 Kevin 2026-10-11「桌面档不动」定档冲突。② **`T75`（P0）配对项升为硬判据** —— `frontend/index.html` 的 `<meta name="viewport">` **必须**含 `viewport-fit=cover`（缺则 T75 不成立）。
> 真源：`docs/design/style-preview.html`。**v1.0 冻结时读数**（该册彼时未改一字）：sha256 `b61ad55d36211958b65d086d09fb79f57d0494b01c8cf6bc79dd84c622982deb`，72,809 B，936 行。
> **★ v1.1 就地更正（P4 · 本册已执行 · 留痕）**：`style-preview.html` 已被 v1.1 改 **1 行**（L170 `.tabbar .tab` 的 `font-size:10.5px` → `12px`；见 §13.2）。**改前** sha256 `9ddebde7fae6b3e7ecf62a3767c0ccfa418a23aa6d915cabe7e9effeba9b5bcd`（80,291 B / 982 行）⇒ **改后** sha256 `cd09248fb19a99f9598cd18362cd4c2a1fdee1d537409252f4c32b946d6f7da6`（80,289 B / 982 行）：**字节 −2、行数 ±0、`git diff --numstat` = `1 1`**。⇒ 自此本册不再主张「真源一字未改」，改动仅此一处并已全量留痕。
> **改前快照**：`docs/versions/design-system.spec.v1.0.md`（本册 v1.0 正文逐字节副本，`cmp=0`）。
> **v1.2 改前快照**：`docs/versions/design-system.spec.v1.1.md`（本册 v1.1 正文逐字节副本，`cmp=0`）。

**一句话**：一整套主题体系、两个外观档 —— **日间档 = 变体 A「码头大牌」**，**夜间档 = 变体 B「夜市行情板」**；两档共用同一套 DOM、同一套组件、同一套 token 语法，差异全部收敛到 token 值层。

**阅读约定**
- 每条规则编号 `T1..Tn`（与 `docs/ledger.spec.md` 的 `R1..R108` 错开，两者可同时引用）。
- 规则格式：**编号 | 口径 | 落点 | 连带影响**。
- 所有色值与形状值均标注提取出处：`SP:行号 选择器`（SP = `docs/design/style-preview.html`）。
- 【已冻结口径】= 来自 D9 或 §5.3，不得自行变更；【本册裁定】= 本册为落地而做的一致性裁定，改需走 Zang 裁决；【本册建议·一句话可改】= 一改即生效、无连带影响。
- 本册**不含** React/TSX 实现代码；只出现 `:root{...}` / `.dark{...}` 的 CSS token 声明与 Tailwind `@theme` 片段。

---

## §0 本册定位与冻结口径来源

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T1** | 【已冻结口径】只做**一整套主题体系、两个外观档**：日间档表现为变体 A，夜间档表现为变体 B。**不是两套设计**，也不是在两个变体里各挑零件拼装。 | 全文；`--sea-*` 全 token 组 | 任何组件不得出现「A 款/B 款」两套分支；只允许 `:root` / `:root.dark` 两组值 |
| **T2** | 【已冻结口径】同构优先：两档共用 **DOM 结构、元素顺序、信息层级、列数、间距栅格、交互**；差异只允许收敛到 **token 值层**。 | 全站组件 | 变体 B 中所有**结构级**差异一律废弃（清单见 T26、T35、T46） |
| **T3** | 【已冻结口径】形状也进 token 层：圆角/描边/投影随主题切换（日＝A 的 `13px 圆角 + 1.5px 描边 + 3px 硬投影`；夜＝B 的 `2px 圆角 + 零投影`），且**同一主题内全站形状语言必须一致**。 | `--sea-radius-*`、`--sea-border-w-*`、`--sea-shadow-*` | 形状 token 与色 token 一样必须给 **Light/Dark 两列值**（§3） |
| **T4** | 【已冻结口径】数字排版统一取 B（`tabular-nums` + 等宽），**两档共用**（D9/§5.3.3）。 | `--sea-font-num`、`--sea-num-tabular` | 交易所站点数字不对齐不可接受；等宽栈两档不得分叉 |
| **T5** | 【已冻结口径】必须有语义化 design token 层，**禁止组件里散落色值/圆角/阴影值**；主题切换 = 换一组 token（§5.3.4）。 | `frontend/src/styles/tokens.css`（建议路径） | 组件只允许 `var(--sea-*)` 或 Tailwind 的 `*-sea-*` 工具类 |
| **T6** | 【已冻结口径】Tailwind 4 暗色用 **class 策略** `@custom-variant dark (&:where(.dark, .dark *))`，**不用** `prefers-color-scheme` 媒体查询策略（§5.3.5）。 | `theme.css` | 用媒体查询策略 ⇒ 用户手动切换无法覆盖 ⇒ 直接判负 |
| **T7** | 【已冻结口径】主题是**用户可见功能**：切换入口 + 持久化（localStorage）+ 首次访问跟随系统（§5.3.6）。 | `ThemeToggle` 组件、`theme.js` | 见 §6 契约 |
| **T8** | 【已冻结口径】商品图在深底下的可见性：**图片位必须有描边或底衬**（§5.3.8）。 | `--sea-border-media`、`--sea-surface-media` | 非文本对比 ≥3:1（T67） |
| **T9** | 【本册裁定】本册的**真源只有 `style-preview.html` 的 A/B 两段 CSS**。变体 C（`SP:357-427`）**已弃用**，其色值不得进入任何 token。 | 全文 | 任何 token 值无法指到 `SP` 行号 ⇒ 视为发明，判负 |
| **T10** | 【本册裁定】本册把 token 分成两类，**这条是全部可判负 AC 的地基**：<br>① **几何 token**（影响 `getBoundingClientRect`）：间距、栅格列数、字号/行高、元素固定尺寸、内边距、图标尺寸 → **两档必须同值**，不属于「主题可切换值」。<br>② **观感 token**（不进 rect）：颜色、圆角、描边宽度、投影、焦点环 → 允许 Light/Dark 两值。 | 全文；§3 与 §4 的分界 | 违反 ⇒ T69（几何恒等 AC）必挂；本条同时解释了为什么 §4 的字号只能给一列值 |

---

## §1 提取方法与证据链

**方法**（可复现）：`re.findall(r'([^{}]+)\{([^{}]*)\}')` 解析 `SP` 的 `<style>` 块 → 按 `.vstage-a` / `.vstage-b` 前缀归集 69 / 79 条选择器 → 每条 token 记录 `值 / 出处选择器 / SP 行号` → 对比度用 WCAG 2.x 相对亮度公式逐对计算（sRGB→线性化→`0.2126R+0.7152G+0.0722B`→`(L1+.05)/(L2+.05)`），`rgba()` 先与底衬做 alpha 合成再算。

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T11** | 变体 A 段 = `SP:196-267`（标题「变体 A · 高饱和黄主导『码头大牌』」），共 **69** 条 `.vstage-a` 选择器；本册所有 Light 列色值只从这段取。 | §2 / §3 Light 列 | — |
| **T12** | 变体 B 段 = `SP:269-351`（标题「变体 B · 黄黑高对比硬朗『夜市行情板』」），共 **79** 条 `.vstage-b` 选择器；本册所有 Dark 列色值只从这段取。 | §2 / §3 Dark 列 | — |
| **T13** | 两档**共用**的结构骨架在 `SP:79-194`（「变体共用的语义结构」，只定版式与骨架，配色全部走变量）。**凡在此段出现的值（字号、间距、列数、尺寸）即为两档同值**，与 T10① 自洽。 | §4 / §5 | 基类 `.feed` 4 列（`SP:115`）、`.feed-m` 2 列（`SP:116`）等即出自此段 |
| **T14** | 品牌黄 `#FDE815` 与品牌黑 `#030402` 由 A、B 两档共同使用（`SP:200/204/206/210…` 与 `SP:274/279/290/292…`），**两档同值**，不是可切换 token。涨跌基色 `#12A150 / #E5484D` 见 `SP:104` 与图例 `SP:476-477`。 | `--sea-accent`、`--sea-accent-fg` | 两档共用同一品牌色 ⇒ 主题差异只体现在「黄占多少面积」，不是「换成另一个黄」 |
| **T15** | 【本册裁定】当某状态在 A/B 稿中**都没有定义**（如「悬停」「禁用」桌面态、「错误态」「骨架屏」），本册**不新造色值**，而是从稿件中**已存在的色值**里指派一个用途，并在表中标 `【本册指派】`+ 出处行号。**凡本册表中标 `【本册指派】` 的格子，都是「值已提取、用途为本册指定」，可一句话改。** | §2 标注列 | 若 Kevin 不认某条指派，改一格值即可，不动结构 |
| **T16** | 【本册裁定】A 稿的 `.thumb.t1..t10`（`SP:258-267`）与 B 稿的 `.thumb.t1..t10`（`SP:342-351`）是**商品图占位渐变**，属「内容占位」而非主题 token；但**图片位的描边/底衬**是 token（`--sea-border-media`，T8）。 | `--sea-border-media` | 渐变两档不同（淡彩 vs 暗彩）是允许的，因为它是图片内容的占位面 |

---

## §2 色 Token 全表（Light=日=A / Dark=夜=B）

**表例**：`出处` 列写作 `SP:行号 选择器`。`【本册指派】` 含义见 T15。

### 2.1 页面底与层级底

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-surface-page` | `#FDE815` | `SP:200 .page{background}` | `#0B0C0E` | `SP:273 .page{background}` |
| `--sea-surface-elevated`（卡/面板/白卡） | `#FFFFFF` | `SP:219 .card{background}`、`SP:239 .panel` | `#141619` | `SP:292 .card`、`SP:314 .panel` |
| `--sea-surface-sunken`（行情条/层深底/深色底衬） | `#030402` | `SP:210 .tickwrap{background}` | `#111317` | `SP:283 .tickwrap{background}` |
| `--sea-surface-input` | `#FFFFFF` | `SP:204 .search{background}` | `#15171B` | `SP:277 .search`、`SP:280 .me`、`SP:289 .cat` |
| `--sea-surface-subtle`（次级底：头像/标签底） | `#FFF7B8` | `SP:230 .tags span{background}` | `#22262B` | `SP:302 .card .meta .avatar{background}` |

### 2.2 前景与强调

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-fg`（正文/标题） | `#0A0A0A` | `SP:200 .page{color}` | `#E8EAED` | `SP:273 .page{color}` |
| `--sea-fg-strong`（卡内标题） | `#0A0A0A` | `SP:223 .card .title{color}` | `#EDEFF2` | `SP:296 .card .title`、`SP:315 .panel-hd h4` |
| `--sea-fg-secondary`（次要前景） | `#3D3D3D` | `SP:228 .card .meta{color}` | `#C4C9D0` | `SP:318 .prow{color}`、`SP:322 .jrow` |
| `--sea-fg-muted`（弱前景，**硬约束 ≥4.5:1**） | `#6B6B5A` | `SP:253 .tabbar .tab{color}`【本册指派】 | `#A9AFB7` | `SP:310 .job-list li{color}` |
| `--sea-fg-muted-on-accent`（黄底上的弱字） | `#4A4A2E` | `SP:256 .empty-note{color}` | `rgba(11,12,14,.72)` | 【本册建议·一句话可改】B 稿无「黄底弱字」场景；值 = `--sea-accent-fg` 加 alpha |
| `--sea-accent`（强调色） | `#FDE815` | `SP:200/206 品牌黄` | `#FDE815` | `SP:274/279/290 品牌黄（同值）` |
| `--sea-accent-fg`（强调前景＝黄底上的字） | `#030402` | `SP:206 .btn-pub{color:#FDE815}` 的反向使用，A 的 `.cat.on` `SP:217` | `#0B0C0E` | `SP:279 .btn-pub{color}`、`SP:290 .cat.on`、`SP:295 .badge` |
| `--sea-accent-hover` | `#FFC44D` | `SP:258 .thumb.t1` 渐变深端【本册指派】 | `#FFC44D` | 同上【本册指派】 |
| `--sea-fg-disabled`（禁用前景；WCAG 1.4.3 豁免非活跃组件） | `#9A9A88` | `SP:238 .job-pub{color}`【本册指派】 | `#5C6169` | `SP:340 .empty-note{color}`【本册指派】 |
| `--sea-surface-disabled` | `#E8E8C8` | `SP:234 .job-pay .unit{color}`【本册指派】 | `#17191D` | `SP:518` B 变体图例色块【本册指派】 |
| `--sea-surface-hover`（悬停底） | `#FFF7B8` | `SP:230 .tags span{background}`【本册指派】 | `#22262B` | `SP:302 .avatar{background}`【本册指派】 |
| `--sea-surface-skeleton`（骨架屏） | `rgba(253,232,21,.35)` | `SP:200` 品牌黄 + alpha；B 稿自有 rgba 用法 `SP:294 .glyph` | `rgba(253,232,21,.16)` | `SP:294 .glyph{color:rgba(253,232,21,.20)}` 同族【本册指派】 |

### 2.3 描边、分隔、投影

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-border`（普通描边，装饰/分组） | `#030402` | `SP:219 .card{border:1.5px solid}`、`SP:204 .search`、`SP:239 .panel` | `#262A30` | `SP:292 .card{border:1px solid}`、`SP:317 .hr{background}` |
| `--sea-border-strong`（**必需的 UI 边界，硬约束 ≥3:1**） | `#030402` | 同上（A 只有一档描边，天然 ≥16:1） | `#8A9099` | `SP:277 .search{color}` 同值【本册指派】；备选 `#FDE815`（B 已有用法 `SP:274/304/326`） |
| `--sea-border-media`（图片位描边，T8） | `#030402` | `SP:220 .thumb{border-bottom:1.5px solid}` | `#8A9099` | 【本册指派】；备选 `#FDE815`（`SP:304 .job-card{border:1px solid #FDE815}`） |
| `--sea-border-tag`（标签描边） | `#030402` | `SP:230 .tags span{border:1px solid}` | `#2A2D33` | `SP:303 .tags span{border:1px solid}` |
| `--sea-divider`（分隔线） | `#030402` + `opacity:.18` | `SP:242 .hr{background:#030402;opacity:.18}` | `#262A30` + `opacity:1` | `SP:317 .hr{background:#262A30;opacity:1}` |
| `--sea-shadow-color`（硬投影色） | `#030402` | `SP:219 .card{box-shadow:3px 3px 0 #030402}` | `transparent` | B 稿全部零投影（`SP:292 .card` 未声明 box-shadow） |
| `--sea-shadow-color-soft`（软投影色/带 alpha） | `rgba(3,4,2,.35)` | `SP:206 .btn-pub{box-shadow:2px 2px 0 rgba(3,4,2,.35)}`；`SP:231` 用 `.4`；`SP:255` 用 `.28` | `transparent` | 同上 |
| `--sea-surface-media`（图片位底衬） | `#FFFFFF` | `SP:219 .card{background:#fff}` 下的图片位 | `#141619` | `SP:292 .card` |
| `--sea-focus-ring` | `#030402` | 【本册指派】取 `--sea-border`（A 的描边色，天然高对比） | `#FDE815` | 【本册指派】；B 已用黄做强调边线 `SP:274` |
| `--sea-focus-ring-invert`（深底/黄底按钮上的焦点环） | `#FDE815` | `SP:217 .cat.on{color:#FDE815}`（黑底黄字） | `#0B0C0E` | `SP:279 .btn-pub{color}`（黄底黑字） |

### 2.4 价格、涨跌与招工

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-price-fg`（价格数字） | `#030402` | `SP:226 .price .num{color}` | `#FDE815` | `SP:299 .price .num{color}` |
| `--sea-price-cur`（`$` 符号） | `#030402` | `SP:225 .price .cur{color}` | `#FDE815` | `SP:298 .price .cur{color}` |
| `--sea-price-bg`（价格底衬） | `#FDE815` | `SP:224 .price{background:#FDE815}` | `transparent` | B 价格无底衬，只有下边线（`SP:297`） |
| `--sea-price-border`（价格底衬描边） | `#030402` | `SP:224 .price{border:1.5px solid}` | `#22262B` | `SP:297 .price{border-bottom:1px solid}` |
| `--sea-price-unit`（单位 `/ 8只装`） | `#3A3A2A` | `SP:227 .price .unit{color:#3A3A2A;opacity:1}` | `#8A9099` | `SP:300 .price .unit{color}` |
| `--sea-up`（涨，**深色底衬上**） | `#3DDC84` | `SP:214 .up{color:#3DDC84}` | `#3DDC84` | `SP:286 .up{color:#3DDC84}` |
| `--sea-down`（跌，**深色底衬上**） | `#FF7A7A` | `SP:214 .down{color:#FF7A7A}` | `#FF6B6B` | `SP:286 .down{color:#FF6B6B}` |
| `--sea-up-on-light`（浅底衬上的涨，见 T63） | `#12A150` | `SP:104 .up{color:#12A150}` + 图例 `SP:476` | 不需要（夜档无浅底衬） | — |
| `--sea-down-on-light`（浅底衬上的跌，见 T63） | `#E5484D` | `SP:104 .down{color:#E5484D}` + 图例 `SP:477` | 不需要 | — |
| `--sea-up-bg`（涨跌文本的底衬） | `#030402` | `SP:210 .tickwrap{background:#030402}` | `#141619` | `SP:292 .card{background}` |
| `--sea-jobcard-bg` | `#030402` | `SP:231 .job-card{background:#030402}` | `#141619` | `SP:304 .job-card{background:#141619}` |
| `--sea-jobcard-fg` | `#FFFFFF` | `SP:231 .job-card{color:#fff}`、`SP:235 .job-title` | `#EDEFF2` | `SP:306 .job-title{color}` |
| `--sea-jobcard-fg-muted` | `#C9C9B8` | `SP:236 .job-list li{color}` | `#A9AFB7` | `SP:310 .job-list li{color}` |
| `--sea-jobcard-fg-faint`（发布方/信用） | `#9A9A88` | `SP:238 .job-pub{color}` | `#8A9099` | 由 `#6B7079`（`SP:313`）**升级**而来，见 T65 |
| `--sea-jobcard-bullet`（列表圆点） | `currentColor` + `opacity:.45` | `SP:144 .job-list li::before{background:currentColor;opacity:.45}` | `#FDE815` + `opacity:.7` | `SP:311 .job-list li::before{background:#FDE815;opacity:.7}` |
| `--sea-jobcard-accent-bar`（夜档左强调条） | `0`（A 无） | `SP:231` A 用整块黑底表达 | `4px solid #FDE815` | `SP:304 .job-card{border-left:4px solid #FDE815}` |

### 2.5 徽标、标签、底栏、状态

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-badge-bg` / `--sea-badge-fg` | `#030402` / `#FDE815` | `SP:222 .badge{background:#030402;color:#FDE815}` | `#FDE815` / `#0B0C0E` | `SP:295 .badge{background:#FDE815;color:#0B0C0E}` |
| `--sea-tag-bg` / `--sea-tag-fg` | `#FFF7B8` / `#0A0A0A` | `SP:230 .tags span` | `transparent` / `#A9AFB7` | `SP:303 .tags span{background:transparent;color:#A9AFB7}` |
| `--sea-tabbar-bg` | `#FFFFFF` | `SP:252 .tabbar{background:#fff}` | `#0B0C0E` | `SP:336 .tabbar{background:#0B0C0E}` |
| `--sea-tabbar-border` | `#030402`（2px） | `SP:252 .tabbar{border-top:2px solid #030402}` | `#262A30`（1px） | `SP:336 .tabbar{border-top:1px solid #262A30}` |
| `--sea-tab-fg` | `#6B6B5A` | `SP:253 .tabbar .tab{color}` | `#8A9099` | 由 `#6E747C`（`SP:337`）**升级**而来，见 T65 |
| `--sea-tab-fg-active` | `#030402` | `SP:254 .tab.active{color:#030402}` | `#FDE815` | `SP:338 .tab.active{color:#FDE815}` |
| `--sea-ticker-bg` / `--sea-ticker-fg` | `#030402` / `#FFFFFF` | `SP:210 .tickwrap`、`SP:213 .tk-price{color:#fff}` | `#111317` / `#FDE815` | `SP:283 .tickwrap`、`SP:285 .tk-price{color:#FDE815}` |
| `--sea-ticker-pair` | `#FDE815` | `SP:212 .tk-pair{color:#FDE815}` | `#9AA0A8` | `SP:284 .tk-pair{color}` |
| `--sea-ticker-note` | `#FFFFFF` + `opacity:.7` | `SP:105 .tk-note{opacity:.7}`（A 未覆色，继承 `SP:210` 的 `#fff`） | `#8A9099` | 由 `#6B7079`（`SP:287`）**升级**而来，见 T65 |
| `--sea-topbar-bg` | `#FDE815` | `SP:201 .topbar{background:#FDE815}`、`SP:247 .m-head` | `#0B0C0E` | `SP:274 .topbar{background:#0B0C0E}`、`SP:324 .m-head` |
| `--sea-topbar-line` | `#030402`（2px） | `SP:201 .topbar{border-bottom:2px solid}`、`SP:249 .tb-m` | `#FDE815`（1px） | `SP:274 .topbar{border-bottom:1px solid #FDE815}`、`SP:326 .tb-m` |
| `--sea-statusbar-fg` | `#0A0A0A` | `SP:248 .statusbar{color}` | `#C9CED6` | `SP:325 .statusbar{color}` |
| `--sea-foot-fg` | `#0A0A0A` | `SP:257 .foot{color:#0A0A0A}` | `#6B7079` → 用 `#8A9099` | `SP:341 .foot{color:#6B7079}`，见 T65 |
| `--sea-glyph`（图片占位字） | `rgba(3,4,2,.30)` | `SP:221 .glyph{color:rgba(3,4,2,.30)}` | `rgba(253,232,21,.20)` | `SP:294 .glyph{color:rgba(253,232,21,.20)}` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T17** | token 命名前缀统一 `--sea-*`；语义分层为 `surface-*`（底）/`fg-*`（前景）/`border-*`（描边）/`accent-*`（强调）/`price-*`/`up`·`down`/`shadow-*`/`focus-ring-*`。**禁止出现以颜色或变体命名的 token**（如 `--yellow-500`、`--a-card-bg`、`--dark-mode-gray`）。 | 全 token 表 | 组件改主题时不需要知道「这是哪一档」 |
| **T18** | 【本册裁定】`--sea-accent`（`#FDE815`）与 `#030402` 是**两档同值**的品牌常量（T14）；两档差异靠**使用面积与承载方式**表达 —— 日档黄铺满页面底（`SP:200`），夜档黄只出现在价格/主按钮/边线/徽标（`SP:279/290/292/299/304`）。**禁止在夜间档把黄改成「暗黄/深黄」以求对比**。 | `--sea-accent` | 任何「夜间用另一个黄」的提案 = 破坏品牌一致性，判负 |
| **T19** | 【本册裁定】`--sea-fg-muted` 是**硬约束 token**：无论主题如何，它必须 ≥4.5:1（对照其实际底衬）。因此 **B 稿的三处弱灰不得原样进入 token**：`#6B7079`（`SP:287/313/341`，实测 3.64:1 on `#141619`）、`#6E747C`（`SP:337`，4.15:1 on `#0B0C0E`）、`#5C6169`（`SP:340`，3.14:1 on `#0B0C0E`）—— 表内已统一改为 B 稿**自身已有的** `#8A9099`（5.58–6.08:1 ✅）。 | `--sea-fg-muted`、`--sea-tab-fg`、`--sea-ticker-note`、`--sea-foot-fg`、`--sea-jobcard-fg-faint` | 这是本册对 B 稿的**唯一一类强制取值改动**；理由与实测见 §8 |
| **T20** | 【本册裁定】`--sea-surface-hover` / `--sea-surface-disabled` / `--sea-surface-skeleton` / `--sea-focus-ring` / `--sea-border-strong` / `--sea-border-media` 这 6 个 token 在 A/B 稿中**无直接对应选择器**，本册按 T15 从已提取值中指派。**每格均已标 `【本册指派】` 与出处行号，属「一句话可改」。** | §2 表 | 若 Kevin/Zang 另定，只改这 6 格值 |
| **T21** | 【本册裁定】悬停态在两档的语义**不同构、但视觉同构**：日档悬停 = 浅黄底（`#FFF7B8`），夜档悬停 = 提亮一级（`#22262B`）。二者都必须是**比自身底衬更「显」的一级**，不得使用反转色（黑/白反转属状态语义，不属主题值）。 | `--sea-surface-hover` | 悬停不得改变元素尺寸/位置（不得用 `transform`/`border`），只能用 `background`/`box-shadow` 颜色 |
| **T22** | 【本册裁定】`--sea-border`（装饰性分组边界）**不强制 3:1** —— 它只做「成组」的视觉提示，分组语义由间距与层级（`surface-elevated` vs `surface-page`）承担；而 **`--sea-border-strong` 必须 ≥3:1**，用于任何「边界是识别该 UI 组件所必需」的场合（输入框、可点击卡的轮廓、选中态指示器）。 | `--sea-border` / `--sea-border-strong` | 实测：夜档 `#262A30` 对卡底仅 1.26:1、对页底 1.08–1.11:1 ⇒ **夜档卡片边界靠底差无法辨识**，因此夜档**可点卡片**必须带 `--sea-border-strong` 或 `--sea-accent` 边线（B 稿 `.job-card` 的 `1px solid #FDE815` 正是此用法，`SP:304`） |

---

## §3 形状 Token 全表（Light=日=A / Dark=夜=B）

### 3.1 圆角档位

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 | 用途 |
|---|---|---|---|---|---|
| `--sea-radius-xs` | `5px` | `SP:131 .tags span{border-radius:5px}`、`SP:136 .job-tag`、`SP:246 .jrow .jp` | `2px` | `SP:303 .tags span{border-radius:2px}`、`SP:305 .job-tag` | 标签 / 招工标记 / 行情小胶囊 |
| `--sea-radius-badge` | `6px` | `SP:120 .badge{border-radius:6px}` | `2px` | `SP:295 .badge{border-radius:2px}` | 商品图角标 |
| `--sea-radius-sm` | `8px` | `SP:224 .price{border-radius:8px}` | **`0`（实测）** | `SP:297` `.vstage-b .price` 未声明圆角 ⇒ 实测 `border-radius: 0px`。本册取 `0`（忠于原稿）；因夜档价格底为 `transparent` 且无描边，`0` 与 `2px` 视觉无差异 | 价格底衬 / 小控件 |
| `--sea-radius-md` | `11px` | `SP:204 .search{border-radius:11px}`、`SP:206 .btn-pub`、`SP:202 .logo-w` | `2px` | `SP:277 .search{border-radius:2px}`、`SP:279 .btn-pub`、`SP:275 .logo-w` | 输入框 / 主按钮 / Logo 容器 / 小按钮 `--sea-radius-btn-sm` `9px`（`SP:237`）→ 夜档 `2px`（`SP:312`） |
| `--sea-radius-lg` | `13px` | `SP:219 .card{border-radius:13px}`、`SP:239 .panel` | `2px` | `SP:292 .card{border-radius:2px}`、`SP:314 .panel` | 商品卡 / 面板 / 招工卡 |
| `--sea-radius-fab` | `14px` | `SP:173 .tabbar .fab{border-radius:14px}`（基类，A 未覆盖） | `2px` | `SP:339 .tabbar .fab{border-radius:2px}` | 底栏中央发布键 |
| `--sea-radius-pill` | `999px` | `SP:207 .me`、`SP:216 .cat`、`SP:30 .h-nav a` | `2px` | `SP:280 .me{border-radius:2px}`、`SP:289 .cat{border-radius:2px}` | 分类胶囊 / 账户胶囊 / chip |
| `--sea-radius-avatar` | `50%` | `SP:93 .avatar{border-radius:50%}`（基类，A 未覆盖） | `2px` | `SP:281 .me .avatar{border-radius:2px}`、`SP:302 .card .meta .avatar{border-radius:2px}` | 头像（30px / 19px 两档同尺寸，仅形状变） |

### 3.2 描边宽度

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-border-w`（组件通用描边） | `1.5px` | `SP:204 .search`、`SP:207 .me`、`SP:216 .cat`、`SP:219 .card`、`SP:220 .thumb`、`SP:224 .price`、`SP:239 .panel` | `1px` | `SP:277 .search`、`SP:280 .me`、`SP:289 .cat`、`SP:292 .card`、`SP:293 .thumb`、`SP:314 .panel` |
| `--sea-border-w-tag` | `1px` | `SP:230 .tags span{border:1px solid}` | `1px` | `SP:303 .tags span{border:1px solid}`（两档同值） |
| `--sea-border-w-frame`（顶栏/底栏/行情条分隔线） | `2px` | `SP:201 .topbar{border-bottom:2px}`、`SP:249 .tb-m`、`SP:252 .tabbar{border-top:2px}` | `1px` | `SP:274 .topbar{border-bottom:1px}`、`SP:326 .tb-m`、`SP:336 .tabbar{border-top:1px}` |
| `--sea-border-w-accent-bar`（夜档招工卡左条） | `0` | A 无此元素（`SP:231` 靠整块黑底） | `4px` | `SP:304 .job-card{border-left:4px solid #FDE815}` |
| `--sea-focus-w`（焦点环宽度） | `2px` | 【本册指派】 | `2px` | 【本册指派】（两档同值，保证观感一致） |
| `--sea-focus-offset` | `2px` | 【本册指派】 | `2px` | 【本册指派】 |

### 3.3 投影档位

| Token | Light（日=A） | Light 出处 | Dark（夜=B） | Dark 出处 |
|---|---|---|---|---|
| `--sea-shadow-control`（输入框/小控件） | `2px 2px 0 var(--sea-shadow-color)` | `SP:204 .search{box-shadow:2px 2px 0 #030402}` | `none` | B 稿 `.search`（`SP:277`）未声明 box-shadow |
| `--sea-shadow-btn`（主按钮） | `2px 2px 0 var(--sea-shadow-color-soft)` | `SP:206 .btn-pub{box-shadow:2px 2px 0 rgba(3,4,2,.35)}` | `none` | `SP:279 .btn-pub` 未声明 |
| `--sea-shadow-card`（卡/面板） | `3px 3px 0 var(--sea-shadow-color)` | `SP:219 .card`、`SP:239 .panel` | `none` | `SP:292 .card`、`SP:314 .panel` 未声明 |
| `--sea-shadow-card-soft`（招工卡/深底卡） | `3px 3px 0 rgba(3,4,2,.4)` | `SP:231 .job-card{box-shadow:3px 3px 0 rgba(3,4,2,.4)}` | `none` | `SP:304 .job-card` 未声明 |
| `--sea-shadow-fab`（底栏发布键） | `0 3px 0 rgba(3,4,2,.28)` | `SP:255 .tabbar .fab{box-shadow:0 3px 0 rgba(3,4,2,.28)}` | `none` | `SP:339 .tabbar .fab` 未声明 |
| `--sea-shadow-color` | `#030402` | 见 §2.3 | `transparent` | 见 §2.3 |

### 3.4 描边零占位（本册最重要的工程裁定）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T23** | 【本册裁定】**全站所有描边一律零布局占位**：组件不得使用 `border`（`border:0`），描边改由 `box-shadow` 实现 —— 外描边 `0 0 0 <w> <color>`、内描边 `inset 0 0 0 <w> <color>`；边线（仅一侧）用 `inset 0 -<w> 0 0 <color>` 等方向形式。**理由**：A 的 `1.5px`/`2px` 与 B 的 `1px` 若走 `border`，在 `box-sizing:border-box` 下**外框尺寸不变但内容盒被吃掉 0.5–1px**，导致文字换行点变化、行盒高度变化、下游元素整体位移 —— `§5.3.7` 的「尺寸不变」不足以保证**内容**不重排，故本册把约束前移到「描边不占位」。 | 全部组件；`--sea-border-w*` 仅作 `box-shadow` 的 spread 参数 | 这是 T69（`getBoundingClientRect` 逐值相等）能通过的前提；违反 ⇒ AC 必挂 |
| **T24** | 【本册裁定】形状 token 的合成规则：每个组件的 `box-shadow` 是**一条有序列表**，按「内描边 → 外描边 → 高度投影 → 焦点环」拼接：<br>`box-shadow: inset 0 0 0 var(--sea-border-w) var(--sea-border), var(--sea-shadow-card), 0 0 0 var(--sea-focus-w) var(--sea-focus-ring);`<br>焦点环仅在有 `:focus-visible` 时追加，且必须带 `--sea-focus-offset` 的间隙（用第二层 `0 0 0 calc(var(--sea-focus-w) + var(--sea-focus-offset)) <底衬色>` 实现）。 | 全部组件 | 禁止在组件里手写 `box-shadow` 字面量（T5） |
| **T25** | 【本册裁定】夜档零投影（`none`）时，**投影 token 不得被 `border` 顶替**：B 稿靠「卡底 `#141619` + 描边 + 间距」表达层级，本册保持该形状语言；禁止「夜间补一个柔和投影」以求层次（会破坏 B 的硬朗观感）。 | `--sea-shadow-*` | 夜档层级完全由 `--sea-surface-elevated` 与间距承担 |
| **T26** | 【本册裁定】同一主题内**全站形状语言必须一致**（§5.3.2）：日档全站 `1.5px` 描边 + `13px/11px/8px` 圆角 + 硬投影；夜档全站 `1px` 描边 + `2px` 圆角 + 零投影。**禁止在夜档给某类卡留圆角、给另一类卡切直角**，也禁止在日档给某个按钮去投影。 | §3 全表 | 唯一被允许的例外是**承载语义差异**的形状：`--sea-radius-pill`（胶囊）、`--sea-radius-avatar`（圆头像）、`--sea-border-w-accent-bar`（左强调条）—— 它们在两档都有对应值，不是「混用」，而是「同一档位在两档取不同值」 |
| **T27** | 【本册裁定】`--sea-radius-avatar` 在夜档由 `50%` 变 `2px`（`SP:281/302`）是 B 稿的**显式形状语言**，必须保留；头像尺寸（30px / 19px）两档不变，故不影响 T69。 | `--sea-radius-avatar` | 禁止「头像保持圆形因为更好看」——那是放弃 B 的形状语言 |

---

## §4 字阶、字重与等宽数字

### 4.1 字体栈（两档同值）

| Token | 值 | 出处 |
|---|---|---|
| `--sea-font-sans` | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", "Microsoft YaHei", Arial, sans-serif` | `SP:16 body{font}`（基类，A/B 均未覆盖） |
| `--sea-font-num` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | `SP:285 .tk-price`、`SP:299 .price .num`、`SP:307 .job-pay`、`SP:319 .prow .rt`、`SP:323 .jrow .jp` |
| `--sea-font-weight-sans` | `400`（正文）/ 字重按档位显式给（见 4.3） | `SP:16`、各选择器 |
| `--sea-num-tabular` | `font-variant-numeric: tabular-nums` | `SP:102 .tk-price`、`SP:125 .price .num`、`SP:140 .job-pay .num`、`SP:156 .prow .rt`、`SP:179 .jrow .jp` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T28** | 【已冻结口径】**等宽数字规则**：凡「价格 / 汇率 / 余额 / 成交额 / 涨跌幅 / 佣金 / 酬金 / 信用分」等一切数字，必须**同时**具备 ① `font-variant-numeric: tabular-nums` ② `font-family: var(--sea-font-num)`（等宽栈）。两档共用，不得分叉（§5.3.3 / T4）。 | `--sea-font-num`、`--sea-num-tabular` | 未加等宽的「汇率对齐」类缺陷直接判负；判负方法见 T71（脚本断言 `getComputedStyle(el).fontVariantNumeric === 'tabular-nums'`） |
| **T29** | 【本册裁定】**字号与字重属「几何 token」**（T10①）：字号变化 ⇒ 行盒高度变化 ⇒ 卡片高度变化 ⇒ 全站位移。因此 **§4 全部字号只给一列值，两档共用**；B 稿中比 A 更大的数字字号**不得进入主题值**。 | §4.2 全表 | 这直接决定 T69 能否通过；「夜间把价格调大」= 破坏 AC |

### 4.2 字号 / 行高 / 字重全表（**单列 = 两档同值**）

| Token | 字号 / 行高 / 字重 | 出处（基类 = 两档共用段 `SP:79-194`） |
|---|---|---|
| `--sea-fs-body` | `14px / 1.55 / 400` | `SP:16 body{font:14px/1.55}` |
| `--sea-fs-card-title` | `13.5px / 1.45 / 600` | `SP:122 .card .title` |
| `--sea-fs-panel-title` | `13.5px / ~1.5 / 800` | `SP:152 .panel-hd h4` |
| `--sea-fs-job-title` | `13.5px / 1.4 / 800` | `SP:137 .job-title` |
| `--sea-fs-job-list` | `12px / 1.5 / 400` | `SP:143 .job-list li` |
| `--sea-fs-price-num` | `21px / 1 / 900` + `letter-spacing:-.01em`（基类 20px、A 覆为 21px、B 覆为 26px ⇒ 取 A，见 T30） | `SP:226 .vstage-a .price .num{font-size:21px}` + `SP:125` |
| `--sea-fs-price-cur` | `14px / 1 / 900` | `SP:124 .price .cur` |
| `--sea-fs-price-unit` | `11.5px / 1 / 500` | `SP:126 .price .unit` |
| `--sea-fs-job-pay-num` | `24px / 1 / 900`（B 覆为 30px ⇒ 取基类 24px，见 T30） | `SP:140 .job-pay .num` |
| `--sea-fs-ticker-pair` | `12.5px / 1 / 700` + `letter-spacing:.02em` | `SP:101 .tk-pair` |
| `--sea-fs-ticker-price` | `13px / 1 / 800` | `SP:102 .tk-price` |
| `--sea-fs-ticker-chg` | `12px / 1 / 700` | `SP:103 .tk-chg` |
| `--sea-fs-ticker-note` | `11.5px / 1 / 400` | `SP:105 .tk-note` |
| `--sea-fs-meta` | `11.5px / 1.5 / 400` | `SP:127 .card .meta` |
| `--sea-fs-badge` | `11px / 1.2 / 700` | `SP:120 .badge` |
| `--sea-fs-tag` | `11px / 1.2 / 400` | `SP:131 .tags span` |
| `--sea-fs-job-tag` | `11px / 1.2 / 900` | `SP:136 .job-tag` |
| `--sea-fs-btn` | `13.5px / 1 / 800` | `SP:91 .btn-pub` |
| `--sea-fs-btn-sm` | `12px / 1 / 800` | `SP:147 .btn-sm` |
| `--sea-fs-search` | PC `13.5px`；手机 `12.5px`（`SP:166`） | `SP:89 .search`、`SP:166 .tb-m .search` |
| `--sea-fs-cat` | `12.5px / 1 / 400`（选中 `800`） | `SP:109 .cat`、`SP:217 .cat.on` |
| `--sea-fs-brand` | `17px / 1 / 900` + `letter-spacing:.02em` | `SP:88 .brand-txt` |
| `--sea-fs-prow` | `12.5px / 1.5 / 400`（名称 `700`） | `SP:154-155 .prow` |
| `--sea-fs-rule` | `12px / 1.65 / 400` | `SP:157 .rule` |
| `--sea-fs-jrow` | `12.5px / 1.5 / 600`（价格 `900`） | `SP:177-179 .jrow` |
| `--sea-fs-glyph` | PC `46px / 1 / 900`（基类；B 覆为 52px ⇒ 取 46px，见 T30）；手机 `34px` | `SP:193 .glyph{font-size:46px}`、`SP:194 .feed-m .glyph{font-size:34px}` |
| `--sea-fs-tab` | `10.5px / 1 / 600`（选中 `800`） | `SP:170`、`SP:254` |
| `--sea-fs-statusbar` | `12px / 1 / 700` | `SP:162 .statusbar` |
| `--sea-fs-empty` | `11.5px / 1.5 / 400` | `SP:182 .empty-note` |
| `--sea-fs-foot` | `11.5px / 1.5 / 400` | `SP:181 .foot` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T30** | 【本册裁定】**字号冲突一律取 A / 基类**，B 的三个放大字号（`.glyph 52px` `SP:294`、`.price .num 26px` `SP:299`、`.job-pay .num 30px` `SP:308`）与 B 的缩小字号（`.card .title 13px` `SP:296`、手机 `.title 12.5px`/`.price .num 22px` `SP:332-333`）**全部不采纳**。<br>**推理链（可判负）**：列数取 A 的 **4 列**（T31）⇒ 单卡宽度取 A ⇒ 单卡可用宽度比 B 的 3 列窄 ≈ 25% ⇒ B 为 3 列设计的 26px/30px/52px 在 4 列下会挤压标题与单位 ⇒ 字号必须与列数同源。**列数与字号只能同取一端，不允许「列数取 A、字号取 B」这种零件拼装**（那是 T1 明确禁止的）。 | `--sea-fs-price-num`、`--sea-fs-job-pay-num`、`--sea-fs-glyph`、`--sea-fs-card-title` | 若 Kevin 想要 B 的大数字，唯一自洽方案是**列数一起回到 3 列** —— 但那样违反 §5.3.1「列数一致」在两档间的解释（会与「夜间可用更少列」混为一谈），故本册不建议。**此条为本册最重要的一处「选边」，请 Zang 复核。** |
| **T31** | 【本册裁定】夜间档通过**字号不变 + 等宽字形 + 黄色 + `tabular-nums`** 来呈现 B 的「行情板」观感（`SP:299` 的观感来源是**黄色 + 等宽 + 数字大间距**，不必然是更大的 px）。因此夜档价格视觉主角地位由 `--sea-price-fg`（`#FDE815`）与 `--sea-font-num` 承担。 | `--sea-price-fg`、`--sea-font-num` | 与 T30 配套 |
| **T32** | 【本册裁定】字重是**两档同值**的（不随主题变）。禁止「夜间加粗以求对比」—— 那会改变行盒高度 ⇒ 位移。夜档对比靠 `--sea-fg`/`--sea-fg-strong` 的色值差，不靠字重（§8 实测夜档前景均 ≥10:1，无需加粗）。 | §4.2 字重列 | 违反 ⇒ T69 判负 |
| **T33** | 【本册裁定】字距 `letter-spacing` 也是几何属性（影响文本宽度 ⇒ 可能改变换行）：`--sea-fs-brand` 的 `.02em`（`SP:88`）、`--sea-fs-price-num` 的 `-.01em`（`SP:125`）、`--sea-fs-ticker-pair` 的 `.02em`（`SP:101`）**两档同值**；B 稿上的 `.brand-txt{letter-spacing:.04em}`（`SP:276`）与 `.price .num{letter-spacing:-.02em}`（`SP:299`）**不采纳**。 | `--sea-fs-*` 的 letter-spacing | 同上 |

---

## §5 间距、栅格与断点

### 5.1 间距档位（4px 基线的派生序，**两档同值**）

| Token | 值 | 出处（基类段或 A 段；A/B 的间距冲突取 A，见 T36） |
|---|---|---|
| `--sea-space-0` | `0` | — |
| `--sea-space-hair` | `1px` | `SP:224 .price{padding:1px 8px 3px}` |
| `--sea-space-2` | `2px` | `SP:120 .badge{padding:2px 7px}`、`SP:136 .job-tag` |
| `--sea-space-3` | `3px` | `SP:170 .tabbar .tab{gap:3px}`、`SP:224 .price{gap:3px}` |
| `--sea-space-4` | `4px` | `SP:123 .price{gap:4px}`、`SP:138 .job-pay`、`SP:252 .tabbar{padding-top:4px}` |
| `--sea-space-5` | `5px` | `SP:130 .tags{gap:5px}` |
| `--sea-space-6` | `6px` | `SP:120 .badge` 上下文、`SP:127 .card .meta{gap:6px}`、`SP:91 .btn-pub{gap:6px}` |
| `--sea-space-7` | `7px` | `SP:121 .card .body{gap:7px}`、`SP:52 .v-swatch`（外壳） |
| `--sea-space-8` | `8px` | `SP:108 .cats{gap:8px}`、`SP:120 .badge{left:8px;top:8px}`、`SP:224 .price{padding … 8px}` |
| `--sea-space-9` | `9px` | `SP:89 .search{gap:8px}`→ 手机 `.tb-m .search`；`SP:134 .job{gap:9px}`、`SP:86 .brand{gap:9px}`、**手机栅格 gap**（见 5.2） |
| `--sea-space-10` | `10px` | `SP:85 .tb-inner{gap:14px}` 上下文、`SP:121 .card .body{padding:10px 11px 12px}`、`SP:154 .prow{gap:10px}`、`SP:150 .panel{gap:10px}` |
| `--sea-space-11` | `11px` | `SP:121 .card .body{padding:10px 11px}` |
| `--sea-space-12` | `12px` | `SP:108 .cats{padding:12px 20px 4px}`、`SP:75 .device` 相关、`SP:170 .tabbar .tab{padding:8px 0 12px}` |
| `--sea-space-13` | `13px` | `SP:134 .job{padding:13px 14px}`、`SP:150 .panel{padding:13px 14px}`、`SP:109 .cat{padding:6px 13px}` |
| `--sea-space-14` | `14px` | `SP:85 .tb-inner{gap:14px}`、`SP:121 .card .body{padding … 12px}` 对应的 `14px` 出现在 `.panel`/`.job` 横向 |
| `--sea-space-16` | `16px` | `SP:218 .vstage-a .feed{gap:16px}` |
| `--sea-space-18` | `18px` | `SP:112 .layout{gap:18px}` |
| `--sea-space-20` | `20px` | `SP:85 .tb-inner{padding:10px 20px}`、`SP:112 .layout{padding:8px 20px 26px}` |
| `--sea-space-22` | `22px` | `SP:98 .ticker{gap:22px}`（基类；A 覆为 26px，见 T36） |
| `--sea-space-26` | `26px` | `SP:211 .vstage-a .ticker{gap:26px}`、`SP:112 .layout{padding:… 26px}`、`SP:181 .foot{padding:16px 20px 26px}` |

### 5.2 栅格与布局尺寸（**两档同值**）

| Token | 值 | 出处 | 备注 |
|---|---|---|---|
| `--sea-shell-max` | `1520px` | `SP:21 .shell{max-width:1520px}` | 比选页外壳；产品页用 `--sea-content-max` |
| `--sea-content-max` | `1440px` | `SP:85 .tb-inner{max-width:1440px}`、`SP:112 .layout{max-width:1440px}` | 与比选稿的 1440px PC 演示宽度一致 |
| `--sea-grid-cols-pc` | `4` | `SP:115 .feed{grid-template-columns:repeat(4,minmax(0,1fr))}` | **取自 A**；B 的 3 列（`SP:291`）废弃，见 T35 |
| `--sea-grid-cols-mobile` | `2` | `SP:116 .feed-m{grid-template-columns:repeat(2,minmax(0,1fr))}` | **取自 A/基类**；B 的 1 列（`SP:328`）废弃，见 T35 |
| `--sea-grid-gap-pc` | `16px` | `SP:218 .vstage-a .feed{gap:16px}` | B 的 13px（`SP:291`）、基类 14px（`SP:115`）不采纳（几何一致性优先，见 T36） |
| `--sea-grid-gap-mobile` | `9px` | `SP:116 .feed-m{gap:9px}` | B 的 8px（`SP:328`）不采纳 |
| `--sea-side-w` | `320px` | `SP:114 .side{flex:0 0 320px}` | PC 右侧栏；`--sea-side-gap` `18px`（`SP:112`） |
| `--sea-card-thumb-h` | PC `150px` / 手机 `118px` | `SP:189 .page .thumb{height:150px}`、`SP:190 .feed-m .card .thumb{height:118px}` | 两档同值；B 的「手机行式缩略图 116px 宽」废弃（T35） |
| `--sea-tabbar-cols` | `5` | `SP:169 .tabbar{grid-template-columns:repeat(5,1fr)}` | 两档同值；**夜间档不得增减格**（切换入口不得塞进底栏，见 T46） |
| `--sea-fab-size` | `46px × 46px`，`margin-top:-16px` | `SP:173 .tabbar .fab{width:46px;height:46px;…margin-top:-16px}` | 两档同值 |
| `--sea-avatar-size` | `30px` / `--sea-avatar-sm-size` `19px` | `SP:93 .avatar{width:30px;height:30px}`、`SP:128 .avatar.sm{width:19px;height:19px}` | 两档同值（形状可变，尺寸不可变，T27） |
| `--sea-logo-size` | PC `46px` / 手机 `36px` | `SP:562`（`width="46" height="46"`）、`SP:734`（`36`） | 来自 HTML 模板，属几何 |

### 5.3 断点

| Token | 值 | 说明 |
|---|---|---|
| `--sea-bp-mobile-max` | **`767px`** | 手机竖向上界。**★ v1.1 原位更正**（原记 `639px`，本册自身裁定 **639 作废**）：**实现真源 = `frontend/src/shell/breakpoints.js:11` `phonePortraitMax: 767`**（可复跑判据 `grep -n phonePortraitMax frontend/src/shell/breakpoints.js` ⇒ `767`）。实测：390/375/320 档 `matchMedia('(max-width:767px)')=true`、tabbar `display:grid`；1440 档 tabbar `display:none` ⇒ 切档行为落在 767，非 639。**639 之误的理由链**：① 实现真源实测可复跑 = 767（上）；② **639 源自比选稿 375px 演示框的缩放显示**（`SP:868-880` 用 `transform:scale()` 缩放，本册 §11 `N12` 已登记「那不是真机视口」）；③ 640–767 为常见机型/折叠屏区间，取 639 会令其**落回 PC 档**；④ Kevin 2026-10-11 裁定。⇒ 手机档 = 2 列 + 底栏 Tab + 无侧栏。 |
| `--sea-bp-tablet-min/max` | **`768px / 1023px`** | 【本册建议·一句话可改】**★ v1.1 连带更正**（原记 `640px / 1023px`，系旧 `639px` 的 +1 邻档）：中间档：仍 2 列（或 3 列，需与两档一致），保留侧栏折叠，允许横向滚动的行情条。实现侧 768–1023 走「宽屏同一套 DOM、栅格降为 2 列」的过渡，**不新增骨架**（`frontend/src/shell/breakpoints.js:8`）。 |
| `--sea-bp-pc-min` | `1024px` | PC 横屏（比选稿实测 **1440px**，`SP:501`）：**4 列** + 右侧栏 320px |
| `--sea-bp-pc-side-min` | `1280px` | 【本册建议·一句话可改】≥1280 才显示 320px 侧栏，否则主区满宽（4 列宽度更有余量） |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T34** | 【本册裁定】断点值本身**不是可切换 token**（两档同值）；`@media` 查询里不得出现主题相关分支（主题只走 `.dark` 类，T6）。 | `tokens.css` / `theme.css` | 「夜间用更少列」= 违反 T2 / T35 |
| **T35** | 【本册裁定】**废弃 B 的两处结构级差异**：① `SP:291 .vstage-b .feed{grid-template-columns:repeat(3,…)}` 的 3 列；② `SP:328-334` 手机端「1 列 + `flex-direction:row` 卡内横排 + 116px 缩略图」的整体版式。两者均为**结构差异**，按 §5.3.1 必须废弃。手机端一律为 **2 列竖排卡**（A/基类，`SP:116`）。 | `--sea-grid-cols-pc` / `--sea-grid-cols-mobile` | 这是「综合 A 和 B」最容易搞错的地方：**列数不参与综合**，只取 A |
| **T36** | 【本册裁定】两档在**间距/栅格/gap** 上的取值冲突（A `feed gap 16px`、`ticker gap 26px`、`cats padding-top 14px` vs B `13px`/基类 `22px`）一律**取 A**；基类段（`SP:79-194`）已有的值（如 `.feed-m gap 9px`）直接采用。理由：间距栅格属 T10① 的几何 token，两档必须同值，而既然列数取 A，间距节奏也必须同源。 | §5.1 / §5.2 | 禁止「PC 用 A 的 16px、手机用 B 的 8px」这类混搭 |
| **T37** | 【本册裁定】`--sea-space-*` 使用 4px 基线的**离散档位**（见 5.1），不在组件里写任意 px 值。表中 `5px/7px/9px/11px/13px` 等奇数档来自稿件原值，**允许保留**，但**不得新增表外的档位**（如 `15px`）。 | §5.1 | 新增档位需回到本册 |

---

## §6 主题实现契约

### 6.1 token 声明位置与结构（`frontend/src/styles/tokens.css`，建议路径）

```css
/* 1) 观感 token：两档两值 —— 只有这一层随主题切换 */
:root {
  --sea-surface-page:#FDE815;      /* SP:200 */
  --sea-surface-elevated:#FFFFFF;  /* SP:219 */
  --sea-fg:#0A0A0A;                /* SP:200 */
  --sea-border:#030402;            /* SP:219 */
  --sea-radius-lg:13px;            /* SP:219 */
  --sea-border-w:1.5px;            /* SP:204/219 */
  --sea-shadow-card:3px 3px 0 var(--sea-shadow-color); /* SP:219 */
  --sea-shadow-color:#030402;
  --sea-focus-ring:#030402;
  --sea-focus-ring-invert:#FDE815;
  /* …其余观感 token 见 §2 / §3 */
}
:root.dark {
  --sea-surface-page:#0B0C0E;      /* SP:273 */
  --sea-surface-elevated:#141619;  /* SP:292 */
  --sea-fg:#E8EAED;                /* SP:273 */
  --sea-border:#262A30;            /* SP:292 */
  --sea-border-strong:#8A9099;     /* 见 T19/T22 */
  --sea-radius-lg:2px;             /* SP:292 */
  --sea-border-w:1px;              /* SP:292 */
  --sea-shadow-card:none;          /* SP:292 未声明投影 */
  --sea-shadow-color:transparent;
  --sea-focus-ring:#FDE815;
  --sea-focus-ring-invert:#0B0C0E;
}

/* 2) 几何 token：两档同值，只声明一次（T10① / T29 / T34）—— 放在 :root，不在 .dark 覆盖 */
:root {
  --sea-space-16:16px;             /* SP:218 */
  --sea-grid-cols-pc:4;            /* SP:115 */
  --sea-grid-gap-pc:16px;          /* SP:218 */
  --sea-fs-price-num:21px;         /* SP:226 */
  --sea-card-thumb-h:150px;        /* SP:189 */
  --sea-font-sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Helvetica Neue","Microsoft YaHei",Arial,sans-serif; /* SP:16 */
  --sea-font-num:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;      /* SP:285 */
  --sea-num-tabular:tabular-nums;  /* SP:102/125/140/156/179 */
}

/* 3) 主题切换同时驱动 color-scheme（原生控件/滚动条随之变色） */
:root { color-scheme: light; }
:root.dark { color-scheme: dark; }
```

Tailwind 4 侧（`frontend/src/styles/theme.css`，建议路径）：

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));   /* T6：class 策略，禁用 prefers-color-scheme */

@theme inline {
  /* 只做「注册」，真实值仍走 var() ⇒ .dark 覆盖自动生效 */
  --color-sea-page:     var(--sea-surface-page);
  --color-sea-elevated: var(--sea-surface-elevated);
  --color-sea-fg:       var(--sea-fg);
  --color-sea-accent:   var(--sea-accent);
  --color-sea-border:   var(--sea-border);
  --radius-sea-lg:      var(--sea-radius-lg);
  --spacing-sea-16:     var(--sea-space-16);
  --font-sea-num:       var(--sea-font-num);
}
```

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T38** | 【已冻结口径】主题态挂在 **`<html>` 元素**上，使用 **`.dark` 类**（T6 的 class 策略必需），同时镜像到 `data-theme` 供 CSS/测试选择与调试：`<html class="dark" data-theme="dark">`。**`light` 档不挂 `.light` 类**，只挂 `data-theme="light"`（`:root` 即日档默认值）；禁止给 `<body>` 或某个 App 容器挂主题类（会导致 `position:fixed` 元素/Portal 逃逸）。 | `index.html`、`ThemeProvider` | Tailwind 的 `dark:` 变体、`@custom-variant` 均以 `<html>.dark` 为基准 |
| **T39** | 【已冻结口径】token 声明位置：**只允许** `tokens.css`（上表 1、2、3 三段）与 `theme.css` 的 `@theme` 注册块。**组件内不得声明 `--sea-*` 值**（可读不可写）。 | `tokens.css` / `theme.css` | grep 判负：除这两个文件外，`frontend/src/**` 内出现 `--sea-.*:` 赋值即判负（T70） |
| **T40** | 【本册裁定】观感 token 与几何 token 必须**分行分段集中声明**（上表 1 段 vs 2 段）。凡「几何 token」出现在 `:root.dark` 块里 ⇒ 判负（说明它被当成了可切换值，T10① / T29）。 | `tokens.css` | 这是 T69 的最直接静态守卫 |
| **T41** | 【已冻结口径】切换入口位置：**PC 顶栏** `.tb-inner` 内、`.me` 账号胶囊的**右侧**（图标按钮，`aria-label="切换日间/夜间模式"`，`aria-pressed` 反映当前态，**不使用 emoji**：日/夜两态用同一个内联 SVG 的 `currentColor`，日档显示「月亮（切到夜间）」、夜档显示「太阳（切到日间）」）；**手机端**入口在「我的」页设置区（见 T46：底栏保持 5 格不动）。 | `ThemeToggle.jsx` | 入口必须永远可见（PC 顶栏在日/夜两档都是可见区域）；不得只在「我的」页里藏一个开关 |
| **T42** | 【已冻结口径】持久化：`localStorage["sea.theme"]`，取值仅 `"light"` \| `"dark"` 两个字面量。**不存 `"system"`** ——「跟随系统」的表达方式就是**没有这个键**。切换时同步写 `class`/`data-theme`/`color-scheme`/`localStorage` 四件套（同一次同步调用内完成，避免中间态被渲染）。 | `theme.js` | 键名与取值双写死，禁止 `theme`/`mode`/`sea-theme` 等变体命名（多版本共存会导致「切换后刷新又变回去」） |
| **T43** | 【已冻结口径】首次访问跟随系统：无 `localStorage["sea.theme"]` 时读 `matchMedia('(prefers-color-scheme: dark)').matches` 决定初始档；并在**未显式选择过**的前提下监听该媒体查询的 `change` 事件，跟随系统实时切换；一旦用户点击过切换入口（键已写入），**停止跟随**（移除监听或忽略事件）。 | `theme.js` | 禁止把 `change` 监听写成「永远跟随」（会覆盖用户选择） |
| **T44** | 【已冻结口径 / 防 FOUC】内联脚本放在 `index.html` 的 **`<head>` 内、且位于主 CSS `<link>`/样式入口之后、`<body>` 之前**，必须是**同步**脚本（不得 `defer`/`async`/`type="module"`），内容为：读 `localStorage` → 兜底 `matchMedia` → 立刻写 `<html>.classList` + `dataset.theme` + `style.colorScheme`。**任何主题判定都不得等到 React 挂载后才发生**（否则首帧会出现黄底闪一下再变黑，或反之）。 | `index.html` | 判负方法：T72（在 `DOMContentLoaded` 之前读取 `documentElement.className`，必须已是正确档位） |
| **T45** | 【本册裁定】切换时**不得触发重新挂载**：主题只改 `<html>` 上的类与 CSS 变量，**禁止**把 `theme` 作为 React `key`、禁止条件渲染两套组件树、禁止整页 reload。 | `ThemeProvider` | 违反会中断用户操作（搜索框失焦、列表滚动位置丢失） |
| **T46** | 【本册裁定】底栏 Tab 恒为 **5 格**（`--sea-tabbar-cols`，`SP:169`），两档一致；**主题切换入口不得占用底栏格位**（§5.3.1 要求交互同构 + T35 的列数一致性）。 | `TabBar` | 若产品坚持手机端「快捷切换」，只能加在顶栏搜索框左侧的图标位（该位置两档都有），不得改底栏 |
| **T47** | 【本册裁定】`prefers-reduced-motion` 语义也走同一套 class 策略之外的媒体查询（允许），但**主题相关的一切不得用媒体查询**（T6）。 | `tokens.css` | 不要把两件事混在一个 `@media` 块里 |
| **T48** | 【本册裁定】主题切换**不得改变 `document.documentElement.scrollWidth`**（§5.3.7 结尾「不得造成任何元素位移或横向溢出」）：因为 §3 已把所有描边改为零占位、投影不影响布局、圆角不改变几何，故 `scrollWidth` 两档必须逐值相等。 | 全站 | 判负方法：T73（两档 `scrollWidth`/`scrollHeight` 必相等） |

---

## §7 组件级规格（每组件日/夜两套）

> 通用约束（每条都已在前面独立编号，此处复述以免组件实现遗漏）：**结构两档完全相同**（T2）；**描边一律零占位 `box-shadow`**（T23）；**只允许 `var(--sea-*)`**（T5/T39）；**几何量（尺寸/内边距/字号/间距）两档同值**（T10①/T29/T36）；**数字一律等宽 + `tabular-nums`**（T28）；**状态不得仅靠颜色**（T61）；**焦点环必须可见**（T64）。

### 7.1 顶栏 `.topbar` / `.tb-inner`（`SP:84-86`、`SP:201-209`、`SP:274-282` / 模板 `SP:560-567`）

| 部位 | 日间档（A） | 夜间档（B） | 所用 token |
|---|---|---|---|
| 顶栏底 | 品牌黄铺满 | 深底 + **黄色 1px 下边线** | `--sea-topbar-bg`（`#FDE815` / `#0B0C0E`）、`--sea-topbar-line`（`#030402` / `#FDE815`）、`--sea-border-w-frame`（`2px` / `1px`） |
| 结构/尺寸 | `.tb-inner` `display:flex; gap:14px; padding:10px 20px; max-width:1440px`；品牌 Logo 46px + 文字 17px/900；搜索框 `flex:1`；发布按钮；账号胶囊 | **完全相同** | `--sea-space-14`、`--sea-space-20`、`--sea-content-max`、`--sea-logo-size`、`--sea-fs-brand` |
| 品牌字 | `#0A0A0A` / 900 / `letter-spacing:.02em` | `#F5F6F7` / 900 / **`.02em`（不取 B 的 `.04em`，T33）** | `--sea-fg`（夜档用 `--sea-fg-strong` 更亮：`#F5F6F7`，`SP:276`） |
| Logo 容器圆角 | `11px`（`SP:202`） | `2px`（`SP:275`） | `--sea-radius-md` |
| 下边线实现 | **必须 `box-shadow: inset 0 calc(-1 * var(--sea-border-w-frame)) 0 0 var(--sea-topbar-line)`**，不得用 `border-bottom` | 同 | T23（否则 2px vs 1px 会让整个页面下移 1px） |

### 7.2 搜索框 `.search`（`SP:89-90`、`SP:204-205`、`SP:277-278`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 字 | `#FFFFFF` 底、`#0A0A0A` 字 | `#15171B` 底、`#8A9099` 提示字 | `--sea-surface-input`、`--sea-fg` / `--sea-fg-muted` |
| 描边 | `1.5px #030402` | **`1px #8A9099`（原稿 `#33373D` 实测仅 1.50:1，见 T19/T22 升级）** | `--sea-border-strong`（这是「必需的 UI 边界」，T22） |
| 投影 | `2px 2px 0 #030402` 硬投影 | `none` | `--sea-shadow-control` |
| 圆角 | `11px` | `2px` | `--sea-radius-md` |
| 图标 | `color:#030402` | `color:#FDE815`（B 的强调用法） | `--sea-fg` / `--sea-accent` |
| 几何 | `display:flex; gap:8px; padding:9px 14px; font-size:13.5px`；手机 `padding:7px 11px; font-size:12.5px`（`SP:166`） | 同 | `--sea-space-8/9/14`、`--sea-fs-search` |
| 提示文案 | 占位文本用 `--sea-fg-muted`（**不得**用 `--sea-fg`，否则与已输入值不可区分） | 同 | 占位文字对比 ≥4.5:1（§8） |

### 7.3 发布按钮 `.btn-pub`（主按钮）（`SP:91`、`SP:206`、`SP:279`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 字 | `#030402` 底、`#FDE815` 字 | `#FDE815` 底、`#0B0C0E` 字 | `--sea-fg`（黑）/`--sea-accent` 与 `--sea-accent`/`--sea-accent-fg` |
| 圆角 | `11px` | `2px` | `--sea-radius-md` |
| 投影 | `2px 2px 0 rgba(3,4,2,.35)` | `none` | `--sea-shadow-btn` |
| 字重/字距 | `800` / 无 | `900` / **`.02em`（不取 B 的 `.04em`，T33）** | `--sea-fs-btn` 的 800（两档同值，T32） |
| 几何 | `padding:9px 16px; font-size:13.5px`；手机 `padding:8px 12px`（`SP:250`）/ B 手机 `8px 11px`（`SP:327`）⇒ **取 A 的 `8px 12px`** | 同 | `--sea-fs-btn`、T36 |
| 悬停 | 底 `--sea-accent-hover`（`#FFC44D`），字不变 | 同 | `--sea-accent-hover` |
| 禁用 | `--sea-surface-disabled` 底 + `--sea-fg-disabled` 字 + `cursor:not-allowed` + `aria-disabled` | 同 | T58 |

### 7.4 商品卡 `.card`（`SP:117-131`、`SP:219-230`、`SP:292-303`）

| 部位 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 卡 | 白底 + `1.5px #030402` + `13px` 圆角 + `3px 3px 0 #030402` | `#141619` 底 + `1px #262A30` + `2px` 圆角 + 零投影 | `--sea-surface-elevated`、`--sea-border`、`--sea-radius-lg`、`--sea-shadow-card`（夜 `none`） |
| 图片位 | `150px` 高（手机 `118px`），**下边线 1.5px 黑**（`SP:220`） | 同高，**下边线 1px `#262A30`**（`SP:293`） | `--sea-card-thumb-h`、`--sea-border-media`（T8：图片位必须带描边/底衬） |
| 图片占位字 | `rgba(3,4,2,.30)` / 46px / 900 | `rgba(253,232,21,.20)` / **46px（不取 B 的 52px，T30）** | `--sea-glyph`、`--sea-fs-glyph` |
| 角标 `.badge` | `#030402` 底 / `#FDE815` 字 / `6px`：如「死蟹包赔」 | `#FDE815` 底 / `#0B0C0E` 字 / `2px` | `--sea-badge-bg`/`--sea-badge-fg`、`--sea-radius-badge` |
| 标题 | `#0A0A0A` / 13.5px / 600 / 2 行截断 | `#EDEFF2` / **13.5px（不取 B 的 13px，T30）** / 600 | `--sea-fg-strong`、`--sea-fs-card-title` |
| 价格 | **黄底胶囊**：`#FDE815` 底 + `1.5px #030402` + `8px` 圆角；`$` 与数字 `#030402`，数字 21px/900 | **无底衬**，数字与 `$` 为 `#FDE815`，21px/900 **等宽**，下方 1px `#22262B` 分隔 | `--sea-price-bg`（夜 `transparent`）、`--sea-price-fg`、`--sea-price-cur`、`--sea-price-border`、`--sea-price-unit`、`--sea-fs-price-num`、`--sea-font-num` |
| 单位 `/8只装` | `#3A3A2A` | `#8A9099` | `--sea-price-unit` |
| 卖家行 `.meta` | `#3D3D3D`，头像 `#030402` 圆底黄字 | `#8A9099`，头像 `#22262B` 底 `#D7DBE0` 字 **2px 方角** | `--sea-fg-secondary`、`--sea-surface-subtle`、`--sea-radius-avatar` |
| 标签 `.tags span` | `#FFF7B8` 底 + `1px #030402` + `5px` + `#0A0A0A` | 透明底 + `1px #2A2D33` + `2px` + `#A9AFB7` | `--sea-tag-bg`/`--sea-tag-fg`/`--sea-border-tag`/`--sea-radius-xs` |
| 悬停 | 卡底 `--sea-surface-hover` + 描边转 `--sea-accent`（不移动、不缩放） | 同机制 | T21 |

### 7.5 招工卡 `.job-card`（`SP:133-147`、`SP:231-238`、`SP:304-313`）

| 部位 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 卡 | **整块黑底** `#030402` + 白字 + `1.5px #030402` + `13px` + `3px 3px 0 rgba(3,4,2,.4)` | `#141619` 底 + **`1px #FDE815` 全描边 + `4px #FDE815` 左强调条** + `2px` + 零投影 | `--sea-jobcard-bg`、`--sea-jobcard-fg`、`--sea-jobcard-accent-bar`（日 `0` / 夜 `4px`，**用 `inset 4px 0 0 0 #FDE815` 实现，T23**） |
| 标记 `.job-tag` | `#FDE815` 底 / `#030402` 字 / `5px` / 11px / 900 | 同色，`2px` 圆角 | `--sea-radius-xs`、`--sea-fs-job-tag` |
| 酬金 | `$` + 数字 `#FDE815`，24px/900；单位 `#E8E8C8` | 同色 `#FDE815`，**24px（不取 B 的 30px，T30）**，**等宽**（T28） | `--sea-fs-job-pay-num`、`--sea-font-num`、`--sea-jobcard-fg` |
| 说明列表 | 文字 `#C9C9B8`，圆点 `currentColor + .45` | 文字 `#A9AFB7`，圆点 `#FDE815 + .7` | `--sea-jobcard-fg-muted`、`--sea-jobcard-bullet` |
| 发布方 | `#9A9A88` | `#8A9099`（原稿 `#6B7079` 升级，T19） | `--sea-jobcard-fg-faint` |
| 报名按钮 `.btn-sm` | `#FDE815` 底 / `#030402` 字 / `9px` | `#FDE815` 底 / `#0B0C0E` 字 / `2px` | `--sea-radius-btn-sm`、`--sea-fs-btn-sm` |
| 布局 | `flex-direction:column; gap:9px; padding:13px 14px`；PC 占 1 列 | **完全相同**（B 的手机端行式卡已废弃，T35） | `--sea-space-9/13/14` |

### 7.6 行情条 `.tickwrap` / `.ticker`（`SP:97-105`、`SP:210-214`、`SP:283-287`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 字 | **深色条** `#030402` + 白字（黄只打币对） | `#111317` 底 + `1px #24272C` 下边线 | `--sea-ticker-bg`、`--sea-ticker-fg` |
| 币对 `KONG / $` | `#FDE815`，12.5px/700 | `#9AA0A8`，12.5px/700 | `--sea-ticker-pair` |
| 价 | `#FFFFFF`，13px/800，**等宽 + tabular-nums** | `#FDE815`，13px/800，**等宽 + tabular-nums** | `--sea-ticker-fg`、`--sea-font-num`、T28 |
| 涨跌 | `▲ 2.31%` / `#3DDC84`；`▼ 0.74%` / `#FF7A7A`（**底衬已是深色 `#030402`，故 11.51:1 / 8.14:1 ✅**） | `#3DDC84` / `#FF6B6B`（10.97:1 / 7.05:1 ✅） | `--sea-up`、`--sea-down`、**符号 ◀ 必须存在（T61）** |
| 备注 `.tk-note` | 白字 `opacity:.7`（`SP:105`） | `#8A9099`（原稿 `#6B7079` 升级，T19） | `--sea-ticker-note` |
| 几何 | `gap:26px`（A 值，T36）；`padding:8px 20px`；手机可横滑 + 右缘 mask 渐隐（`SP:188`） | **完全相同** | `--sea-space-26`、`--sea-space-8/20` |

### 7.7 底部 Tab 栏 `.tabbar`（`SP:168-174`、`SP:252-255`、`SP:336-339`）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 / 上边线 | `#FFFFFF` + `2px #030402` 上边线 | `#0B0C0E` + `1px #262A30` | `--sea-tabbar-bg`、`--sea-tabbar-border`、`--sea-border-w-frame` |
| 普通格 | `#6B6B5A`，10.5px/600 | `#8A9099`（原稿 `#6E747C` 4.15:1 ⇒ 升级，T19），10.5px/600 | `--sea-tab-fg` |
| 选中格 | `#030402`，800 + `aria-current="page"` | `#FDE815`，800 + `aria-current="page"` | `--sea-tab-fg-active`、**不得仅靠颜色（T61）：选中态必须同时改字重** |
| 中央 FAB | `#030402` 底 / `#FDE815` 图标 / `14px` / `0 3px 0 rgba(3,4,2,.28)` | `#FDE815` 底 / `#0B0C0E` 图标 / `2px` / 零投影 | `--sea-radius-fab`、`--sea-shadow-fab` |
| 几何 | `grid-template-columns:repeat(5,1fr)`；FAB `46×46`、`margin-top:-16px` | **完全相同**（含格数，T46） | `--sea-tabbar-cols`、`--sea-fab-size` |
| 图标尺寸 | 22px（`SP:171/174`） | 同 | 几何 token |

### 7.8 按钮三态（主 / 次 / 幽灵）

| 类型 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| **主按钮**（发布/报名/提交） | `#030402` 底 + `#FDE815` 字（如 `.btn-pub`）或 `#FDE815` 底 + `#030402` 字（如 `.btn-sm`，`SP:237`） | 反向：`#FDE815` 底 + `#0B0C0E` 字 | `--sea-accent`、`--sea-accent-fg`、`--sea-fg` |
| **次按钮**（取消/查看全部） | 透明底 + `1.5px #030402` 描边 + `#0A0A0A` 字 + `11px` 圆角（沿用 A 的「白底黑描边」控件语言 `SP:204/207/216`） | 透明底 + `1px #8A9099` 描边 + `#C4C9D0` 字 + `2px` 圆角 | `--sea-border-strong`、`--sea-fg-secondary`、`--sea-radius-md` |
| **幽灵按钮**（面板「去交易 →」类链接） | `#0A0A0A` 字 + **下划线**（`SP:241`） | `#FDE815` 字 + **无下划线**（`SP:316`）⇒ 统一为 **黄/黑强调色 + 下划线**（T61：形态两档一致） | `--sea-accent-fg`（日）/`--sea-accent`（夜） |
| 共同 | 高度由 `padding + 字号` 决定（两档同值）；悬停只改 **颜色/描边色**；`:focus-visible` 出焦点环（T64）；`<button>` 且 `type="button"` | 同 | T21 / T23 / T64 |

### 7.9 徽标 / 标签（`.badge` / `.tags span` / `.chip`）

| 类型 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 商品图角标 `.badge` | `#030402` 底 / `#FDE815` 字 / `6px` / 11px/700 | `#FDE815` 底 / `#0B0C0E` 字 / `2px` / 11px/700 | `--sea-badge-*`、`--sea-radius-badge`、`--sea-fs-badge` |
| 属性标签 `.tags span` | `#FFF7B8` 底 / `1px #030402` / `#0A0A0A` / `5px` | 透明底 / `1px #2A2D33` / `#A9AFB7` / `2px` | `--sea-tag-*`、`--sea-border-w-tag`（两档同 1px） |
| 招工标记 `.job-tag` | `#FDE815` 底 / `#030402` 字 / 11px/**900** | 同色 / `2px` 圆角 | `--sea-radius-xs`、`--sea-fs-job-tag` |
| 选中态（分类 `.cat.on`） | `#030402` 底 / `#FDE815` 字 / `999px` / 800 | `#FDE815` 底 / `#0B0C0E` 字 / `2px` / 900 ⇒ **字重取 800**（T32） | `--sea-radius-pill`、`--sea-fg`+`--sea-accent` |

### 7.10 输入框（表单，区别于顶栏搜索框）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 底 | `#FFFFFF` | `#15171B` | `--sea-surface-input` |
| 描边 | `1.5px #030402`（A 的控件语言） | `1px`，**必须 `--sea-border-strong`（`#8A9099`，5.58:1 ✅）；禁用 B 原稿的 `#33373D`（1.50:1 ❌）** | `--sea-border-strong`、`--sea-border-w` |
| 圆角 | `11px` | `2px` | `--sea-radius-md` |
| 投影 | `2px 2px 0 #030402`（沿用 A 的控件投影） | `none` | `--sea-shadow-control` |
| 内文 / 占位 | `#0A0A0A` / 占位 `--sea-fg-muted`（`#6B6B5A`，5.42:1 ✅） | `#E8EAED` / 占位 `#8A9099`（5.58:1 ✅） | `--sea-fg`、`--sea-fg-muted` |
| 聚焦 | 描边转 `--sea-focus-ring`（`#030402`）+ 2px 焦点环 + 2px 间隙 | 描边转 `--sea-focus-ring`（`#FDE815`）+ 同规格环 | `--sea-focus-ring`、`--sea-focus-w`、`--sea-focus-offset` |
| 错误 | 描边 `--sea-down-on-light`（`#E5484D`）+ **必配文字/图标**（T61） | 描边 `--sea-down`（`#FF6B6B`）+ 文字/图标 | `--sea-up` / `--sea-down` 系 |
| 禁用 | `--sea-surface-disabled` 底 + `--sea-fg-disabled` 字 + `aria-disabled` | 同机制 | T58 |

### 7.11 空态 / 加载 / 错误三态

| 态 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| **空态** | 居中说明文字 `#4A4A2E`（`SP:256 .empty-note`，7.24:1 ✅）+ 一个幽灵按钮（「去看看」）+ 无插画（稿件无插画资产） | `#8A9099`（原稿 `#5C6169` 3.14:1 ⇒ 升级，T19） | `--sea-fg-muted-on-accent`（日）/`--sea-fg-muted`（夜） |
| **加载态** | 骨架屏：`rgba(253,232,21,.35)` 块 + 卡内文字行骨架；`role="status" aria-busy="true"`；**骨架必须与真实卡片几何逐值相同**（同 padding、同 thumb 高、同行数） | `rgba(253,232,21,.16)` | `--sea-surface-skeleton`、`--sea-card-thumb-h` |
| **加载态（列表尾部）** | 稿件原文案：`— 正在加载更多 · 已按 $ 价格排序 —`（`SP:831`），11.5px | 同文案，颜色 `--sea-fg-muted` | `--sea-fs-empty` |
| **错误态** | 稿件**未定义**：本册指派 = `--sea-down-on-light`（`#E5484D`）图标 + 文字 + 「重试」次按钮；**必须有图标与文字，不得只靠红色**（T61） | `--sea-down`（`#FF6B6B`）+ 文字 + 「重试」 | 【本册指派】 |
| 三态共同 | 三态都必须**撑满与内容态相同的容器高度**（否则切换态时列表跳动 ⇒ 影响 T69/T73 的判定语义）；均带 `role` + `aria-live` 语义 | 同 | T50 |

### 7.12 侧栏面板 `.panel`（PC）

| 项 | 日间档（A） | 夜间档（B） | token |
|---|---|---|---|
| 面板 | 白底 + `1.5px #030402` + `13px` + `3px 3px 0 #030402` | `#141619` + `1px #262A30` + `2px` + 零投影 | 同卡片 |
| 面板内分隔 `.hr` | `#030402` + `opacity:.18`（1.51:1，**装饰性，T22**） | `#262A30` + `opacity:1` | `--sea-divider` |
| 行情行 `.prow .rt` | `#0A0A0A` + **等宽** | `#C4C9D0` + **等宽** | `--sea-font-num`（T28） |
| 招工行 `.jrow .jp` | `#030402` 字 + `#FDE815` 底 + `5px` | `#FDE815` 字 + 透明底 + **等宽** | `--sea-accent`、`--sea-radius-xs` |
| 社区规则 `.rule b` | `#2C2C2C`（13.97:1） | `#FDE815`（`SP:321`） | `--sea-fg`/`--sea-accent` |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T49** | 上文 7.1–7.12 中每一个「日间档」列与「夜间档」列的**差异项**，必须能映射到 §2/§3 的某个 `--sea-*` token。**组件规格里出现任何字面色值/圆角/阴影 ⇒ 判负**（T5）。 | 全部组件 | 这是「规范可落地」的最直接判据 |
| **T50** | 【本册裁定】三态（空/加载/错误）与内容态**几何必须同构**：同一列表容器在三态下的 `getBoundingClientRect()` 尺寸一致（骨架卡占位与真卡同尺寸、同 gap）。 | `*State` 组件 | 否则「三态切换」会连带违反 T48/T73 的精神（页面跳动） |
| **T51** | 【本册裁定】商品的**状态类**语义（在售/已售/已下架/争议中）**不得只用一个色相区分**：必须「颜色 + 文字/图标」成对（例：已售 = 角标文字「已售」+ 灰度化图片 `filter:grayscale(1)` + 75% 不透明）。灰度化不改变几何，允许。 | `CardStatus` | 与 T61 同源 |
| **T52** | 【本册裁定】`.thumb` 的渐变占位（`t1..t10`）在两档**是两套渐变**（`SP:258-267` 淡彩 / `SP:342-351` 暗彩），这是允许的（T16），但**必须同时具备 `.thumb` 的 `--sea-border-media` 描边**（T8）：B 的暗彩渐变在深底上若不加描边会与卡底糊成一片（实测 `#3E3520` 对 `#141619` 仅约 1.9:1）。 | `--sea-border-media` | 见 §8 实测（`#8A9099` 3.76:1 ✅ / `#FDE815` 9.64:1 ✅） |

---

## §8 可访问性硬指标（含实测对比度表）

**测量口径**：WCAG 2.x 相对亮度；`rgba()` 先与底衬 alpha 合成；"底衬"取该前景**实际所在的**底色（不是页面底）。全部数值为本册**实际计算**所得（脚本见 §11 的复现说明），非估计。

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T53** | 【已冻结口径】**正文与背景对比度 ≥4.5:1**，两档都要。适用对象：卡标题、正文、列表项、按钮文字、标签文字、底栏 Tab 文字、占位符、行情数字、招工卡全部文字。 | §8.1 全表 | 任一对 <4.5 ⇒ 判负 |
| **T54** | 【本册裁定】**不使用「大文本 3:1」豁免**：本册中唯一符合 WCAG 大文本定义的是价格数字（21px / 900，`SP:226`）与酬金数字（24px / 900），它们实测已 ≥14:1，故本册统一按 **4.5:1** 验收，避免「靠字号换阈值」的争议。 | 价格/酬金数字 | 更严无害 |
| **T55** | 【本册裁定】对比度**必须按「前景 × 实际底衬」逐对验收**，禁止只测「前景 × 页面底」：两档都有「同一前景坐在多个底衬上」的情况（如 `--sea-fg-muted` 同时坐在 `--sea-surface-elevated`、`--sea-surface-input`、`--sea-surface-page` 上）。 | §8.1 表 | 这是 B 稿三处弱灰被漏掉的原因（只测卡底会漏掉页底场景） |

### 8.1 文本对比实测（阈值 4.5:1）

**日间档（A）**

| 前景 | 底衬 | 实测 | 判定 |
|---|---|---|---|
| `#0A0A0A` 正文 | `#FDE815` 页底 | **15.77:1** | ✅ |
| `#0A0A0A` 正文 | `#FFFFFF` 卡底 | **19.80:1** | ✅ |
| `#3D3D3D` 次要 | `#FFFFFF` 卡底 | **10.86:1** | ✅ |
| `#6B6B5A` 弱（Tab） | `#FFFFFF` 底栏底 | **5.42:1** | ✅ |
| `#4A4A2E` 弱（黄底） | `#FDE815` 页底 | **7.24:1** | ✅ |
| `#3A3A2A` 价格单位 | `#FDE815` 价格底 | **9.20:1** | ✅ |
| `#030402` 价格数字/`$` | `#FDE815` 价格底 | **16.37:1** | ✅ |
| `#FDE815` 币对 | `#030402` 行情底 | **16.37:1** | ✅ |
| `#FFFFFF` 行情价 | `#030402` 行情底 | **20.55:1** | ✅ |
| `#3DDC84` 涨 | `#030402` 行情底 | **11.51:1** | ✅ |
| `#FF7A7A` 跌 | `#030402` 行情底 | **8.14:1** | ✅ |
| `#FFFFFF` 招工卡正文 | `#030402` 招工卡底 | **20.55:1** | ✅ |
| `#C9C9B8` 招工说明 | `#030402` | **12.26:1** | ✅ |
| `#9A9A88` 招工发布方 | `#030402` | **7.19:1** | ✅ |
| `#E8E8C8` 酬金单位 | `#030402` | **16.44:1** | ✅ |
| `#0A0A0A` 标签字 | `#FFF7B8` 标签底 | **18.15:1** | ✅ |
| `#FDE815` 角标/按钮字 | `#030402` | **16.37:1** | ✅ |
| `#2C2C2C` 社区规则 | `#FFFFFF` | **13.97:1** | ✅ |
| ❌ `#3DDC84` 涨（若放白底） | `#FFFFFF` | **1.78:1** | ❌ **禁用**（见 T63） |
| ❌ `#FF7A7A` 跌（若放白底） | `#FFFFFF` | **2.52:1** | ❌ **禁用**（见 T63） |
| ❌ `#12A150` 涨（若放白底） | `#FFFFFF` | **3.37:1** | ❌ **不足 4.5**（见 T63） |
| ❌ `#E5484D` 跌（若放白底） | `#FFFFFF` | **3.91:1** | ❌ **不足 4.5**（见 T63） |

**夜间档（B）**

| 前景 | 底衬 | 实测 | 判定 |
|---|---|---|---|
| `#E8EAED` 正文 | `#0B0C0E` 页底 | **16.24:1** | ✅ |
| `#EDEFF2` 卡标题 | `#141619` 卡底 | **15.73:1** | ✅ |
| `#C4C9D0` 次要 | `#0B0C0E` / `#141619` | **11.75 / 10.89:1** | ✅ |
| `#A9AFB7` 弱（列表） | `#141619` | **8.20:1** | ✅ |
| `#8A9099` 弱（本册升级值） | `#141619` / `#15171B` | **5.64 / 5.58:1** | ✅ |
| `#8A9099` 弱 | `#0B0C0E` 页底 | **6.08:1** | ✅ |
| `#FDE815` 强调 | `#0B0C0E` / `#141619` | **15.59 / 14.44:1** | ✅ |
| `#0B0C0E` 按钮字 | `#FDE815` 按钮底 | **15.59:1** | ✅ |
| `#3DDC84` 涨 | `#0B0C0E` / `#141619` | **10.97 / 10.16:1** | ✅ |
| `#FF6B6B` 跌 | `#0B0C0E` / `#141619` | **7.05 / 6.53:1** | ✅ |
| `#9AA0A8` 币对 | `#111317` 行情底 | **7.06:1** | ✅ |
| `#D7DBE0` 头像字 | `#22262B` 头像底 | **10.94:1** | ✅ |
| ❌ `#6B7079` 原稿弱灰 | `#141619` 卡底 | **3.64:1** | ❌ **不得用于文本** → 升级为 `#8A9099`（T65） |
| ❌ `#6B7079` 原稿弱灰 | `#111317` 行情底 | **3.74:1** | ❌ 同上 |
| ❌ `#6E747C` 原稿 Tab 灰 | `#0B0C0E` 底栏底 | **4.15:1** | ❌ 同上（差 0.35） |
| ❌ `#5C6169` 原稿空态灰 | `#0B0C0E` 页底 | **3.14:1** | ❌ 同上 |

### 8.2 非文本元素对比实测（阈值 3:1）

| 元素 | 日间档（A） | 夜间档（B） | 判定 |
|---|---|---|---|
| 卡/面板描边 | `#030402` / `#FFFFFF` = **20.55:1** | `#262A30` / `#141619` = **1.26:1** | 日✅；夜 **仅作装饰**（T22），可点卡片须用 `--sea-border-strong`/`--sea-accent` |
| 页底 vs 卡底（层级可辨） | `#FDE815` vs `#FFFFFF` = **1.26:1** | `#0B0C0E` vs `#141619` = **1.08:1**；vs `#15171B` = **1.09:1**；vs `#17191D` = **1.11:1** | ❌ **两档都不能靠底差辨识卡片** ⇒ 卡片边界必须由描边（日）或 `--sea-border-strong`/`--sea-accent`（夜）承担 |
| 输入框/搜索框描边 | `#030402` / `#FFFFFF` = **20.55:1** | 原稿 `#33373D` / `#15171B` = **1.50:1** ❌ → 本册 `#8A9099` = **5.58:1** ✅ | 夜档必须升级（T19/T22） |
| 标签描边 | `#030402` / `#FFF7B8` = 高 ✅ | `#2A2D33` / `#141619` = **1.31:1** | 夜档标签描边为装饰；标签**文字** 8.20:1 ✅（可读性不被描边影响） |
| 图片位描边（T8） | `#030402` / 缩略图 t1 首色 `#FFE8A3` = **16.95:1** ✅ | `#8A9099` / t1 首色 `#3E3520` = **3.76:1** ✅；`#FDE815` = **9.64:1** ✅；原稿 `#262A30` = **1.19:1** ❌ | 夜档必须用 `--sea-border-media`（`#8A9099` 或 `#FDE815`） |
| 焦点环 | `#030402` / `#FFFFFF` = **20.55:1**；`#030402` / `#FDE815` = **16.37:1** | `#FDE815` / `#0B0C0E` = **15.59:1**；`/ #141619` = **14.44:1**；`/ #15171B` = **14.30:1** | ✅ 但**需反色**（T64） |
| 分隔线 | `#030402` @ `.18` / `#FFFFFF` = **1.51:1**（装饰） | `#262A30` / `#141619` = **1.26:1**（装饰） | 装饰性（T22）；**不得作为唯一分组手段** |
| 骨架屏块 | `rgba(253,232,21,.35)` / `#FFFFFF` | `rgba(253,232,21,.16)` / `#141619`（原稿 `#22262B` / `#141619` = **1.19:1**） | 骨架为装饰，**不适用 3:1**；但必须带 `aria-busy` 与文字（T59） |
| 涨跌指示器 | 见 8.1（深底衬上 ≥8:1） | 见 8.1（≥6.5:1） | ✅ 且必须带箭头符号（T61） |

### 8.3 不达标项汇总与处置（本册对两稿的全部强制改动）

| # | 不达标项 | 实测 | 处置 | 依据 |
|---|---|---|---|---|
| 1 | B 稿 `#6B7079`（`.tk-note` `SP:287`、`.job-pub` `SP:313`、`.foot` `SP:341`） | 3.64–3.74:1 | 升级为 `#8A9099`（B 稿自身已有值） | T19 / T65 |
| 2 | B 稿 `#6E747C`（`.tabbar .tab` `SP:337`） | 4.15:1 | 升级为 `#8A9099` | T19 / T65 |
| 3 | B 稿 `#5C6169`（`.empty-note` `SP:340`） | 3.14:1 | 升级为 `#8A9099` | T19 / T65 |
| 4 | B 稿 `#33373D`（`.search` / `.me` 描边 `SP:277/280`，同类推及表单输入框） | 1.50:1 | **必需的 UI 边界**改用 `--sea-border-strong` = `#8A9099`（5.58:1） | T22 |
| 5 | B 稿 `.thumb` 描边 `#262A30` 对暗彩渐变 | 1.19:1 | 图片位改用 `--sea-border-media` = `#8A9099`（3.76:1）或 `#FDE815`（9.64:1） | T8 / T52 |
| 6 | A 稿 `.up`/`.down`（`#3DDC84`/`#FF7A7A`）若坐在浅底衬上 | 1.78 / 2.52:1 | 日档涨跌**只允许坐在深色底衬上看**；白底场景必须套深色底衬或用 `--sea-up-on-light`/`--sea-down-on-light` 且仍需底衬（见 T63） | T63 |
| 7 | A 稿 `#12A150`/`#E5484D` 坐在白底 | 3.37 / 3.91:1 | 同上：**不得直接用于白/黄底上的涨跌文本**（除非底衬为深色） | T63 |
| 8 | A 稿 `.hr` 分隔线 `.18` 透明 | 1.51:1 | 保持装饰定位；**若某处分组必须依赖该线**，改用实色 `#030402`（20.55:1）或 `@.40`（≥3:1） | T22 |
| 9 | B 稿卡底 vs 页底 | 1.08:1 | 夜档**可点卡片**必须带 `--sea-border-strong`/`--sea-accent`（B 的 `.job-card` 已是此做法 `SP:304`） | T22 |

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T56** | 【本册裁定】8.3 的 9 条是**本册对两稿的全部强制改动**；除此以外，任何 token 值必须与 A/B 原稿逐字一致（含字号、色值、圆角、间距）。**新增第 10 条强制改动需 Zang 裁决。** | §8.3 | 保证「不是自行造一套颜色」 |
| **T57** | 【本册裁定】对比度验收必须在 **CI 可执行**：把 8.1 / 8.2 的配对表固化为机器可读清单（`fg, bg, kind, min`），由脚本重算 —— 见 T74。 | §10 T74 | 「可脚本校验」是 AC 要求 |
| **T58** | 【本册裁定】**非活跃组件豁免**（WCAG 1.4.3 例外）只适用于 `disabled`/`aria-disabled="true"` 的元素；因此 `--sea-fg-disabled`（日 `#9A9A88` 2.28:1、夜 `#5C6169` 3.14:1）**合法**，但**必须同时具备非颜色的禁用指示**（`cursor:not-allowed` + `aria-disabled` + 文本说明），不得让用户分不清「禁用」与「弱化」。 | `--sea-fg-disabled`、`--sea-surface-disabled` | 若把 `--sea-fg-disabled` 用在**活跃**元素上 ⇒ 直接判负 |
| **T59** | 【本册裁定】骨架屏不适用 3:1，但**必须**：① `aria-busy="true"` + `role="status"`；② 有可视的加载文字（稿件已有：`— 正在加载更多 · 已按 $ 价格排序 —`，`SP:831`）；③ 骨架块与真内容的**几何一致**（T50）。禁止只用动画条而无文字。 | `Skeleton` | — |
| **T60** | 【本册裁定】行情/汇率等**「图表 + 数值」**场景：数值必须同时给「颜色 + 箭头符号 + 正负号」，且 ±0 必须显式显示为「— 0.00%」而不是绿色。 | `--sea-up` / `--sea-down` | 稿件已合规（`SP:570-573` 有 ▲▼），本条要求不得在实现中丢掉符号 |
| **T61** | 【已冻结口径】**不得仅靠颜色传达状态**（§5.3 / §10 反例）。强制配对：涨 = `#3DDC84`/`#12A150` + `▲` + 正数；跌 = `#FF7A7A`/`#E5484D` + `▼` + 负数；选中 = 颜色 + **字重 800** + `aria-current`/`aria-selected`；错误 = 颜色 + **图标 + 文字**；必填 = 颜色 + **`*` 或「必填」文字**。 | 全站状态 | 判负方法：脚本断言 `.up/.down` 元素的 `textContent` 必须匹配 `/[▲▼]/`（T71 同批脚本） |
| **T62** | 【本册裁定】主题切换与状态语义的可访问性标记：主题按钮 `aria-label` + `aria-pressed`；Tab `aria-current="page"`；三态容器 `aria-live="polite"`；图片位 `alt`；装饰 SVG `aria-hidden="true"`（稿件已是如此，`SP:435/562`）。 | 全站 | — |
| **T63** | 【已冻结口径 / 本册裁定】**涨跌色的底衬规则**（由 §8.1 实测推出）：<br>① 日档：涨跌文本**必须坐在 `--sea-up-bg`（`#030402`）这类深色底衬上**（实测 11.51 / 8.14:1 ✅），例如行情条、深色胶囊。直接放在 `#FDE815` 黄色页底或 `#FFFFFF` 卡底上 ⇒ 判负。<br>② 夜档：`#3DDC84` / `#FF6B6B` 在 `#0B0C0E`/`#141619` 上均 ≥6.5:1 ✅，**无底衬要求**。<br>③ 若确需在浅底衬上显示涨跌，**必须套一个深色底衬**（同 A 的价格胶囊做法：深底 + 圆角 + 描边）；本册**不建议**改用压暗色值（如需，`#12A150`→`#0F8844`、`#E5484D`→`#D34247` 可勉强达 4.5:1，但**这两个值不来自稿件，属发明**，须 Zang 批准）。 | `--sea-up`、`--sea-down`、`--sea-up-on-light`、`--sea-down-on-light`、`--sea-up-bg` | 本册给出的是「零新色值」的合规路径 |
| **T64** | 【本册裁定】**焦点环必须在两档的三种底衬上都 ≥3:1**，因此使用**双色环 + 反色**：<br>① 日档：外环 `--sea-focus-ring` = `#030402`（对 `#FFFFFF` 20.55:1、对 `#FDE815` 16.37:1 ✅）；当元素自身为**深底**（`#030402`）时改用 `--sea-focus-ring-invert` = `#FDE815`（16.37:1 ✅）。<br>② 夜档：外环 `--sea-focus-ring` = `#FDE815`（对 `#0B0C0E` 15.59:1、对 `#141619` 14.44:1、对 `#15171B` 14.30:1 ✅）；当元素自身为**黄底**（`#FDE815`）时改用 `--sea-focus-ring-invert` = `#0B0C0E`（15.59:1 ✅）。<br>③ 单色环在「黄底按钮（夜）」与「黑底按钮（日）」上实测 **1.00:1**，属不可见 —— 故反色不是可选项。<br>④ 焦点环必须带 `--sea-focus-offset`（`2px`）露出底衬色，且**不得因出现而改变元素 rect**（用 `box-shadow` 出环，T23/T24）。 | `--sea-focus-ring`、`--sea-focus-ring-invert`、`--sea-focus-w`、`--sea-focus-offset` | 判负方法：T74 把 `#030402`/`#FDE815` 的四种组合写进配对表；`#FDE815` vs `#FDE815` 若出现在表里即说明实现用了单色环 |
| **T65** | 【本册裁定】B 稿三处弱灰（`#6B7079` / `#6E747C` / `#5C6169`）的升级值是 **`#8A9099`**（B 稿 `SP:277/301/309` 已有），**不是新造色**。若 Zang 偏好更亮的弱字，备选 `#A9AFB7`（8.20:1，B 稿 `SP:310` 已有）。**禁止在夜间档用低于 `#8A9099` 的灰做文本。** | `--sea-fg-muted`、`--sea-tab-fg`、`--sea-ticker-note`、`--sea-foot-fg`、`--sea-jobcard-fg-faint` | 这是 §8.3 的 #1/#2/#3 |
| **T66** | 【本册裁定】占位符（placeholder）必须 ≥4.5:1 且**与已输入值可区分**：日档占位 `#6B6B5A`（5.42:1）、夜档 `#8A9099`（5.58:1）；实际输入值用 `--sea-fg`。禁止让 placeholder 与 value 同色。 | `--sea-fg-muted` | — |
| **T67** | 【已冻结口径】**非文本元素对比 ≥3:1**（图表、涨跌指示、描边、图标、状态点、图片位边界），两档都要。详见 8.2 实测表；不达标项处置见 8.3。 | §8.2 全表 | 判负方法：T74 |
| **T68** | 【本册裁定】键盘可达性（主题是用户可见功能的一部分）：① 主题切换按钮必须可 `Tab` 聚焦并有 `:focus-visible` 环；② 不使用只有 `hover` 才出现的关键操作；③ 底栏 Tab 为真实链接/按钮（稿件为 `<a>`，`SP:836-840`）。 | `ThemeToggle`、`TabBar` | — |

---

## §9 反例清单（禁止事项）

> 编号 `X1..X16`：反例是规则的否定面，每条标注它违反的 `T` 号。**反例清单与 T 规则同等强制**，质检发现任一条即判负（除非有 Zang 裁决豁免）。

| # | 禁止事项 | 违反 | 为什么（后果） |
|---|---|---|---|
| **X1** | 组件里写死色值（`#FDE815`、`bg-yellow-400`、`rgba(0,0,0,.4)`） | T5 / T39 / T49 | 主题切换时该处不变 ⇒ 出现「黄底黑字卡里有一块白」，且无法审计 |
| **X2** | 组件里写死圆角/描边/阴影（`rounded-xl`、`border`、`shadow-lg`、`border-b-2`） | T5 / T23 / T26 | 描边走 `border` ⇒ 两档 1.5px vs 1px 造成内容盒位移 ⇒ T69 必挂 |
| **X3** | 同一主题内混用两种形状语言（日档某卡 `2px` 直角、夜档某卡 `13px` 圆角；日档某按钮去投影） | T26 | 主题不再「一整套」，退化为零件拼装 |
| **X4** | 跨用途复用同一 token（用 `--sea-accent` 当正文色、用 `--sea-border` 当价格色、用 `--sea-up` 当主按钮底） | T17 | 语义层失效，改一处炸一片 |
| **X5** | 仅靠颜色传达状态（涨跌无 ▲▼、选中只换颜色、错误只变红、必填只变红） | T61 / T51 / T60 | 色盲/强光下不可辨；也是 AC 明列项 |
| **X6** | 夜间档把品牌黄改成暗黄/深黄以提高对比 | T18 | 破坏品牌一致性；黄在两档是同一常量 |
| **X7** | 夜间档对 B 稿的弱灰原样照抄（`#6B7079` / `#6E747C` / `#5C6169`） | T19 / T65 | 实测 3.14–4.15:1，低于 4.5:1 文本阈值 |
| **X8** | 夜间档用 B 稿原描边色 `#33373D` 做输入框/搜索框边界 | T22 | 实测 1.50:1，UI 边界不可辨 |
| **X9** | 把字号/字重/间距/列数做成 `:root.dark` 里的可切换 token（「夜间价格调大到 26px」「夜间列表改 3 列」） | T10① / T29 / T34 / T35 | 直接违反 T69（rect 逐值相等） |
| **X10** | 导入变体 C 的任何色值 | T9 | C 已弃用；引入即口径分叉 |
| **X11** | 用 `prefers-color-scheme` 媒体查询实现主题（含 `@media (prefers-color-scheme: dark){ … }` 覆盖 token） | T6 | 用户手动切换无法覆盖系统偏好 ⇒ 主题功能失效 |
| **X12** | 主题切换时重挂载组件树 / 换 React `key` / `location.reload()` | T45 | 丢失滚动位置、输入焦点、播放中状态 |
| **X13** | 用 `transform`/`scale`/`padding` 变化做悬停、聚焦、选中效果 | T21 | 改变 rect ⇒ 违反 T69 |
| **X14** | 主题判定放到 React 挂载之后（`useEffect` 里写 `documentElement.classList`） | T44 | 首帧闪烁（FOUC）：夜间用户先看到一屏黄 |
| **X15** | 把主题切换入口塞进底栏 Tab（改成 6 格）或只在「我的」页提供一个入口 | T41 / T46 | 两档交互不同构；PC 端入口不可达 |
| **X16** | 图片位不加描边/底衬（尤其夜档暗彩渐变直接贴深底） | T8 / T52 | 实测 `#262A30` 对 `#3E3520` 仅 1.19:1，浅色商品图会糊成一片 |

---

## §10 可判负 AC

> **判负能力（falsifiability）**是本节的核心要求：每条 AC 都必须给出「**如何证明这条断言真的会失败**」。若某条断言在任何实现下都通过 ⇒ 该断言无判别力，视为无效 AC。

| 编号 | AC（可判负） | 判定方法（可执行） | 判负能力验证（必做一次） |
|---|---|---|---|
| **T69** | **【核心 · 已冻结口径】**切换主题前后，对同一批元素取 `getBoundingClientRect()`，**x / y / width / height 必须逐值相等**（要求严格相等，或 `Math.abs(d) < 0.01`；本册取**严格字符串相等**，即 `JSON.stringify` 两份读数一致）。允许变化的是 `border-radius` / `box-shadow` / 颜色 / `outline` 颜色。 | ```js
const SEL = '[data-ac-geom]';                // 见下方「取样面」
const snap = () => JSON.stringify(
  [...document.querySelectorAll(SEL)].map(e=>{
    const r=e.getBoundingClientRect();
    return [r.x,r.y,r.width,r.height];
  }));
// 日间档读数
document.documentElement.classList.remove('dark');
const A = snap();
// 夜间档读数
document.documentElement.classList.add('dark');
const B = snap();
__ASSERT__(A === B, 'T69 几何恒等');
```
取样面（最小集，覆盖两类形状）：`.topbar`、`.search`、`.btn-pub`、`.me`、`.tickwrap`、`.cats`、`.feed`、前 4 张 `.card`、1 张 `.job-card`、每张卡的 `.thumb`/`.title`/`.price`、`.panel`×3、`.hr`、`.tabbar`、`.tabbar .fab`（若该页存在）。全部元素加 `data-ac-geom` 属性。 | ① 把 `--sea-border-w` 的夜间值改成 `1px` 并让它走**真实 `border`**（去掉 T23 的 `box-shadow` 模拟）⇒ 断言**必须失败**。<br>② 在 `:root.dark` 里加 `--sea-fs-price-num:26px` ⇒ 价格胶囊宽度变化 ⇒ 断言**必须失败**。<br>③ 把夜档 `.topbar` 的 `box-shadow` 换成 `border-bottom:1px`（日档仍 `2px`）⇒ 整页 y 偏移 1px ⇒ 断言**必须失败**。<br>三条测试用例必须先在 CI 里跑出 **FAIL**（证明判负能力），再对真实实现跑出 PASS。 |
| **T70** | **无硬编码**：`frontend/src/**` 内除 `styles/tokens.css`、`styles/theme.css` 外，**不得出现** `#hex` 颜色、`rgb(`/`rgba(` 颜色、`border-radius:`、`box-shadow:` 的字面量（允许：`transparent`/`currentColor`/`none`、SVG 内联 `fill`/`stroke` 的品牌路径、`aria` 文本）。 | ```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|border-radius\s*:|box-shadow\s*:' \
  frontend/src --include='*.jsx' --include='*.js' --include='*.tsx' --include='*.ts' \
  | grep -v 'styles/tokens.css' | grep -v 'styles/theme.css'
# 期望：0 行（白名单见上）
```
另加 `grep -rnE '\-\-sea-[a-z-]+\s*:' frontend/src --include='*.jsx'` 期望 0 行（T39）。 | 在任一组件里加 `style={{background:'#FDE815'}}` ⇒ grep **必须**命中 ⇒ 判负。验收记录须附「注入后命中」与「还原后 0 命中」两份输出。 |
| **T71** | **对比度阈值可脚本校验**：把 §8.1 / §8.2 的配对清单固化为 `docs/design/contrast-pairs.json`（`[{fg,bg,kind:'text'|'nontext',min}]`），脚本重算全部比值并断言 `ratio >= min`；**同时**脚本断言实现侧 token 的实际解析值与该清单一致（从 `:root` / `:root.dark` 读出的值必须能匹配清单里的每一对）。 | Python 脚本：解析 `tokens.css` 的 `:root` 与 `:root.dark` 块 → 取 `--sea-*` 值 → 对 `contrast-pairs.json` 逐对算 WCAG 对比度 → 全部 `>= min` 则 PASS。另加：`kind:'text'` 的 `min` 必须 ≥4.5，`kind:'nontext'` 的 `min` 必须 ≥3.0（防止有人把阈值改小来「通过」）。 | ① 把 `:root.dark` 的 `--sea-fg-muted` 改回 `#6B7079` ⇒ 3.64 < 4.5 ⇒ **必须 FAIL**（并且与 8.3 #1 的判定一致）。<br>② 把 `--sea-border-strong`（夜）改回 `#33373D` ⇒ 1.50 < 3.0 ⇒ **必须 FAIL**。<br>③ 断言脚本必须**先**在清单里对 `#FDE815` vs `#FDE815`（1.00:1）报错 —— 用来证明「脚本不是恒真」。 |
| **T72** | **防 FOUC / 首帧正确**：`document.readyState === 'loading'` 时（即 `DOMContentLoaded` 之前）读取 `document.documentElement`，其 `classList.contains('dark')` 与 `dataset.theme` **必须已反映** localStorage/系统偏好。 | 用 CDP `Page.addScriptToEvaluateOnNewDocument` 注入探针记录 `documentElement.className` 的首次赋值时机；或在 E2E 里 `page.goto(url, {waitUntil:'commit'})` 后立刻 `evaluate` 读 class，与预期的 `--sea-*` 计算值比对（`getComputedStyle(document.documentElement).getPropertyValue('--sea-surface-page')` 必须已是 `#0B0C0E`）。 | 把内联脚本从 `<head>` 移到 `ReactDOM.createRoot` 之后 ⇒ 首帧必为日档 ⇒ 探针读到 `--sea-surface-page: #FDE815` 而预期 `#0B0C0E` ⇒ **必须 FAIL**。 |
| **T73** | **无横向溢出 + 尺寸恒定**：两档下 `document.documentElement.scrollWidth` / `scrollHeight` **逐值相等**（§5.3.7 尾句）；且在 375px 与 1440px 两个视口下 `scrollWidth <= innerWidth`（无横向溢出）。 | `innerWidth` 分别设为 375 / 1440，两档各取一次 `{scrollWidth, scrollHeight, innerWidth}`，断言 `A.scrollWidth===B.scrollWidth && A.scrollHeight===B.scrollHeight && A.scrollWidth<=375(或1440)`。 | 给夜档任意元素加 `border: 1px solid` 且宽度 100% + `box-sizing: content-box` ⇒ 溢出 ⇒ **必须 FAIL**。 |
| **T74** | **非文本 3:1 + 焦点环反色**：① §8.2 的每一对 ≥3:1 通过；② 焦点环在 4 种组合下（日/夜 × 浅底/深底）均 ≥3:1，且**反向组合（黄环对黄底、黑环对黑底）必须出现在「禁止清单」里并被脚本拒绝**；③ 三态容器与非文本边界（`--sea-border-strong`、`--sea-border-media`）在实现中确实被使用（脚本断言至少 1 处引用）。 | 与 T71 共用脚本；额外对 ② 建立一个 `forbidden-pairs` 列表并断言实现中**不出现**（例：`--sea-focus-ring` 与 `--sea-accent` 同时用于同一元素的 `background` 与环色 ⇒ 命中 `#FDE815` vs `#FDE815`）。 | 把夜档 `.btn-pub` 的焦点环写成 `--sea-focus-ring`（黄）而非 `--sea-focus-ring-invert` ⇒ 命中 1.00:1 禁止对 ⇒ **必须 FAIL**。 |

**AC 通过的最低证据包（Kong 交付时必须附）**
1. T69 的 A/B 两份 `rect` JSON 快照（含元素数）+ 三条判负用例的 FAIL 输出。
2. T70 的 grep 输出：注入后命中 / 还原后 0 行。
3. T71+T74 的脚本输出：全部配对 PASS + 三条判负用例 FAIL + 阈值合法性断言（`min>=4.5` / `>=3.0`）。
4. T72 的首帧探针读数（两档各一份）。
5. T73 的两档 `scrollWidth/scrollHeight`（375 与 1440 两视口）。

---

## §11 我未能核实 / 未实测（诚实清单）

> 本节是**负面证据清单**：凡未实测、未复核、或存在不确定的结论，一律在此列出，不藏在正文里。

### A. 已实测的部分（供对照，说明本册不是纯推理）

| 已实测 | 方法 | 读数 |
|---|---|---|
| 比选稿文件摘要 | `sha256sum` | `b61ad55d36211958b65d086d09fb79f57d0494b01c8cf6bc79dd84c622982deb`，72,809 B，936 行 |
| 变体 A / B 段选择器数 | 正则解析 `<style>` 块 | 69 / 79 条 |
| §8 中**每一对**对比度 | WCAG 2.x 公式脚本逐对计算（`rgba` 先 alpha 合成） | 见 8.1 / 8.2 表（全部为脚本输出，非估计） |
| token 值是否与渲染一致 | 真实 Chromium 打开 `file://…/style-preview.html`，`getComputedStyle` 抽样 **30 项 × 2 档** | **全部一致**：A `.card` `13px/1.5px声明/3px 3px 0 #030402`、B `.card` `2px/1px/none`、A `.price` `#FDE815`+`8px`、A 价格数字 `21px`+`tabular-nums`、B 价格数字 `26px`+`ui-monospace`、A `.feed` `4 cols`/`16px`、B `.feed` `3 cols`/`13px`、A `.feed-m` `2 cols`、B `.feed-m` `1 col`、A 头像 `50%`、B 头像 `2px`、B `.job-card` `border-left 4px #FDE815`、A `.fab` `14px`+`0 3px 0 rgba(3,4,2,.28)`、B `.fab` `2px`/`none`、A `.hr` `#030402`/.18、B `.hr` `#262A30`/1 等 |
| 比选稿自身的自检读数 | `window.__selfcheck` | `viewport 1280x633`、`overflow:false`、`variantRoots:3`、`renderedCards:66`、`brandLogo:true`、`errors:0` |
| 本册未修改受限文件 | 未对 `docs/design/style-preview.html`、`docs/seafood.master-plan.md`、`docs/ledger.spec.md`、`frontend/src/**`、`backend-ts/**` 执行任何写操作 | — |

### B. 未能核实 / 未实测（诚实清单）

| # | 未核实项 | 影响 | 需要的验证动作 |
|---|---|---|---|
| N1 | **`1.5px` 描边在浏览器里被取整**：实测 DPR=1 的 Chromium 把 `border-width:1.5px` 解析为**使用值 `1px`**（合成元素测试：`1px` 与 `1.5px` 的 `clientWidth` 同为 `98`；`2px` 为 `96`）。⇒ A 的 `1.5px` 与 B 的 `1px` **在当前桌面浏览器上渲染结果相同**。 | ① 本册仍按原稿写 `1.5px`（忠于提取）；② 但「1.5 vs 1px 造成位移」的风险是 **DPR 相关**的（DPR≥2 时 1.5px 可精确渲染为 3 设备像素 ⇒ 差异才真实存在）⇒ 风险**非确定性**，T23 的必要性因此**更强**，不是更弱。 | 在 DPR=2 / DPR=3 的设备（真机或 CDP `Emulation.setDeviceMetricsOverride`）复测 A/B 两档同元素的 `clientWidth` 差异 |
| N2 | **T69 断言本身未经运行时验证**：我未在真实实现上跑过 `getBoundingClientRect` 的 A/B 双快照（该实现尚不存在，P7 才产出）。 | T69 是**设计断言**，不是已验证事实 | P7 由 Kong 实现后，Neng 必须按其第 1 条证据包实测；本册同时给出 3 条「应当 FAIL」的注入用例来证明其判负能力 |
| N3 | **未实测 `box-shadow` 内/外描边对 `getBoundingClientRect` 的零影响**（T23 的理论依据是 CSS 规范中 `box-shadow` 不参与布局；我**没有**跑过实测）。 | 若某浏览器有反例，T69 的路线需重估 | 在 Chrome / Safari / Firefox 三端各跑一次：`border:0` + `box-shadow` 元素与 `border:2px` 元素的 rect 对比 |
| N4 | **字体栈回落未实测**：`ui-monospace` 与 `SFMono-Regular` 的具体解析结果，我**未**在 Chrome/Firefox/Windows/Linux 上核对；本册只保证「两档同值」而非「跨平台一致」。 | 等宽栈若在某平台回落到非等宽字体 ⇒ 数字对齐失效（T28 的**目的**落空，但**规则**仍满足） | 在目标平台列表上 `document.fonts.check()` + 实测数字列宽是否相等 |
| N5 | **Tailwind 4 的 `@theme inline` + `:root.dark` 覆盖组合未实测生效**：我未读 `frontend/package.json` 的 `tailwindcss` 实际版本，也未跑一次构建。（受任务边界限制：本册不得碰 `frontend/src/**`。） | §6 的 `@theme` 片段是**语法级建议**，可能需按实际版本微调（例如是否必须 `inline`） | 读 `frontend/package.json` 确认版本 → 用一个空组件验证「`.dark` 下 `bg-sea-elevated` 真的变色」 |
| N6 | **`#3E3520` 只是 B 稿 t1 渐变的起点**：8.2 中「图片位描边对暗彩缩略图 3.76:1」是按渐变**第一个色标**算的；真实缩略图是渐变，**局部对比会随位置变化**，亮端可能更低。 | 图片位描边的 3:1 结论是**保守估计**，不是全渐变面的最小值 | 对 t1..t10 两条色标各算一遍，取较不利者 |
| N7 | **`--sea-surface-disabled`（夜 `#17191D`）的出处是 HTML 内联色块**（`SP:518` 的 B 变体图例 `<i style="background:#17191D">`），**不是 CSS 规则**。 | 它是「稿件里存在但未被 CSS 使用」的值；严格说它是 B 的**色彩标注**而非 B 的**样式** | 如 Zang 认为不可接受，改取 `#15171B`（`SP:277`，B 的 CSS 实际使用值） |
| N8 | **6 个 `【本册指派】` token（T20）没有 A/B 的对应选择器**：hover / disabled（桌面态）/ skeleton / focus-ring / border-strong / border-media。它们的值都**来自稿件已有色值**，但「这个值用在这个状态上」是**我的设计判断**，不是稿件事实。 | 若 Kevin 不认，改这 6 格即可（一句话可改） | 需 Kevin / Zang 点一次头 |
| N9 | **T30（字号取 A）是本册最大的一处「选边」**：列数取 A（4 列）⇒ 字号必须同源 ⇒ 放弃 B 的 26px/30px/52px 数字。这是**我的裁定**，不是 D9 或 §5.3 明文。§5.3 只说「数字排版统一取 B（tabular-nums + 等宽）」，**没有说字号也取 B**；且 §5.3 同时要求列数一致 ⇒ 我判定「列数与字号同源」是唯一自洽解。 | 若 Kevin 想要 B 的大数字，则列数须一并回到 3 列 ⇒ 需 Zang 重新裁决 | **请 Zang 明确复核这一条** |
| N10 | **A 稿的行情价原本不是等宽字形**：实测 A `.tk-price` 的 `font-family` 是**系统无衬线栈**（只有 `SP:102` 的 `tabular-nums`），等宽栈 `ui-monospace` 只出现在 B（`SP:285`）。本册按 §5.3.3「数字排版统一取 B，两档共用」⇒ **日间档的行情价/价格数字也改用等宽字体**。 | 这是相对 A 的一处**已授权偏离**（依据 §5.3.3），但会轻微改变 A 的数字观感 | 若 Kevin 只想保留 A 的原观感，可把 `--sea-font-num` 降级为「仅 `tabular-nums` + 数字专用字距」⇒ 但那会违反 §5.3.3 字面 |
| N11 | **`--sea-fg-muted` 的日档取值（`#6B6B5A`）原本是底栏 Tab 的非选中色**（`SP:253`），本册把它提升为「通用弱前景」。 | 在白色卡内做辅助文字时 5.42:1 合格，但**观感偏橄榄绿**（它是黄底系调过的灰绿），可能与 A 的纯黑系不符 | 若要更「中性」，备选 `#3D3D3D`（10.86:1，`SP:228`）——但那样它与「次要前景」无法区分 |
| N12 | **移动端未在真机实测**：比选稿的 375px 是**桌面浏览器把 1440/375 演示框用 `transform:scale()` 缩放**显示的（`SP:868-880`），**不是真机视口**。 | 手机端的 `100vh`、地址栏收起、`position:sticky` 顶栏、横滑行情条的 mask 渐隐均**未在真机验证** | 真机或 DevTools 手机模拟下按 T73 复测 375px 两档 |
| N13 | **375px 下「2 列 + 价格胶囊 + 价格数字 21px」是否真的放得下**：我未做文本溢出实测。（B 的 1 列布局正是为这个宽度设计的，本册按 T35 废弃了它。） | 若放不下 ⇒ 会出现换行/截断，而这是**几何**问题，可能连带影响 T69 | 在 375px 下实测 `.price` 的 `scrollWidth <= clientWidth` |
| N14 | **「深色底衬上的涨跌」在日档的实际布局位置未确定**：T63 只规定了「必须坐深底衬」，但日档首页除行情条外，**哪里还有深底衬**（如卡片内是否需要涨跌）属产品问题。 | 若产品在日档白卡上要显示涨跌，需按 T63③ 套深色胶囊（新增 UI 元素 ⇒ 需重新过 T69） | 产品确认日档涨跌的出现位置 |
| N15 | **对比度未按「真实渐变/半透明叠加后的最终像素」实测**：所有计算都基于**纯色对值**，未对渐变缩略图、`opacity` 叠加后的实际渲染色取样。 | 8.2 中与渐变相关的结论（N6）是估算 | 用 CDP `Page.captureScreenshot` + 取色器对关键像素复核 |
| N16 | **`--sea-glyph` 的 `rgba(3,4,2,.30)`（日）/`rgba(253,232,21,.20)`（夜）与底衬的对比度未列入 8.1/8.2 的硬阈值**：它是**装饰性占位字**（会被真实商品图替换），本册按装饰处理。 | 若 Kevin 要求它也 ≥3:1，需重新取值 | 明确一次：占位字算内容还是装饰 |
| N17 | **未核实「400+ 组件」类的全站覆盖面**：本册 §7 只覆盖了比选稿中出现过的 12 类组件。P7 全量页面（详情/发布/我的/交易所）中的**新组件**（表格、图表、对话框、表单长列表）**没有**在本册给出组件级规格。 | 新组件可能引入未 token 化的形状/色值 | P7 开工前需按本册的「token 语法 + X 反例清单」对新组件补一份附录 |

### C. 一句话结论

本册的**色值与形状值是实测提取**（源码 + 渲染双重复核，30 项抽样全中）；**对比度是实测计算**（每一对都有具体比值）；**未核实的是**：T69 断言本身的运行验证（实现尚不存在）、跨浏览器/跨 DPR 的描边取整与字体回落、真机移动端、以及 2 处需要 Zang/Kevin 点头的裁定（**N9 的字号选边**、**N8 的 6 个指派 token**）。

---

## §12 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-09-27 | 首版。依据 D9（Kevin 2026-09-27 更正）+ `docs/seafood.master-plan.md` §5.3 八条逐一落地。产出：13 个章节（§0–§12）；**74 条规则** `T1..T74`；**16 条反例** `X1..X16`；**17 条未核实项** `N1..N17`；色 token 全表 5 组 × Light/Dark 两列（含出处行号）；形状 token 全表 4 组 × 两列；字阶 30 项（单列 = 两档同值）；间距 21 档；断点 4 档；组件级规格 12 类；可判负 AC 6 条（`T69..T74`，每条附判负能力验证方法）。<br>对两稿的**全部强制改动仅 9 条**（§8.3）。 |
| v1.1 | 2026-10-11 | **手机竖屏（H5）加固口径 P0–P4（Kevin 定档）→ 新增 §13 + 规则 `T75..T79`**。**T75** 底部安全区：移动档 `.sf-tabbar` 必声明 `padding-bottom: env(safe-area-inset-bottom)`（结构层，**不得新增 `@media`**；配对硬要求 `index.html` 的 `<meta name=viewport>` 加 `viewport-fit=cover`）· **T76** 移动端导航去重：移动汉堡面板**不得含底部 tab 已有目标**（去 `/reward`/`/task`/`/exchange`），桌面档一字不动 · **T77** 主要操作路径触控目标 **≥44×44**（结构常量 `min-height`/`min-width` + padding；**不得改主题 token 色值/形状值**；**不得改 `STRUCT.h-btna`**）· **T78** 断点收口实现值 **767px**（§5.3 表原位更正 `639→767`、`640→768`，逐处留痕；`100vh` 本轮不动、登记待真机）· **T79** 最小字号 **≥12px**（真源 `SP:170` 就地更正 `10.5px→12px`）。附「§13.3 断言影响」16 行逐条点名 + 「§13.4 Kong 实现清单」+「§13.5 Neng 判负清单」+「§13.6 未核实 N18..N22」。**真源改动**：`docs/design/style-preview.html` L170 就地改 1 行（`10.5px→12px`；**−2 B、行数不变、numstat `1 1`**）。**改前快照**：`docs/versions/design-system.spec.v1.0.md`（`cmp=0`）。 |
| **v1.2** | 2026-10-11 | **Zang 两条裁定落册（口径收窄 + 硬判据升级）**。① **`T77`（P2）收窄**：触控目标 ≥44×44 的**实施范围一律限在 `@media (max-width: 767px)` 内**（复用同一断点值 767、**不得新增断点类型**、`shell.css` 仍只有一个 767 断点块；**桌面档几何零变化 = 硬判据**）。**理由/代价**：v1.1 原方案会**连带抬高桌面控件**（`.btn` 家族 40/34→44、`--sf-*-ctl-h` 34→44），与 Kevin 2026-10-11「桌面档不动」冲突；收窄后**桌面几何回到零变化**，代价 = 各页须把 44px 追加/改值**包进 767 媒体块**（实现面略增、判据面更严）。同步更正 **§13.3 第 14 行**（由「**必须改锚**」改「**若红则最小改锚**」——取值入 767 块后**可能仍绿**）+ **§13.3 尾「一句话」** + **§13.4 P2 逐项加「限 ≤767」** + **§13.4 尾「桌面连带声明」标 v1.2 作废（原文保留）**。② **`T75`（P0）升级**：`frontend/index.html` 的 `<meta name="viewport">` 追加 `viewport-fit=cover` 由「配对项」**升为 P0 硬判据**（缺则 T75 不成立）。附 **§13.6 N24**。**本册改动**：§13.1 T75/T77 行 + §13.3 + §13.4 + §13.5 + §13.6 + 顶部版本行 + §12。**改前快照**：`docs/versions/design-system.spec.v1.1.md`（`cmp=0`）。**未动 `frontend/**`、未动 `ctrl/**`、未启停服务**。 |

### 与上游文件的关系（只读，本册未改一字）

| 文件 | 关系 |
|---|---|
| `docs/design/style-preview.html` | **唯一真源**；本册所有色值/形状值的提取目标（sha256 `b61ad55d…82deb`） |
| `docs/seafood.master-plan.md` §5.3 | 八条裁决逐条落地为 T1–T8、T23–T27、T35、T46、T63、T69 |
| `docs/seafood.master-plan.md` §5 D9 | 「一整套主题体系、两个外观档」→ T1；「形状也进 token 层」→ T3 / §3 |
| `docs/ledger.spec.md` | 编号体系错开（它用 `R1..R108`，本册用 `T1..T74`），互不冲突；本册不涉及账本口径 |
| `frontend/public/brand/logo.svg` | 品牌黄 `#FDE815` / 品牌黑 `#030402` 与比选稿一致（`SP:444` 内联副本 `.cls-1{fill:#fde815}.cls-2{fill:#030402}`）；本册 `--sea-accent`/`--sea-accent-fg` 即此二值 |

### 交付后待 Zang 裁决的两点

1. **N9 / T30**：列数取 A（4 列）⇒ 字号同源取 A ⇒ 放弃 B 的 `26px/30px/52px` 数字。若要求「保留 B 的大数字」，必须一并把列数改回 3 列 —— 二者不可拆分。
2. **N8 / T20**：6 个 `【本册指派】` token（hover / disabled / skeleton / focus-ring / border-strong / border-media）的用途指派是否接受；值本身均已标出处，改用途不动值。


---

## §13 手机竖屏（H5）加固口径 · P0–P4（v1.1 · Kevin 2026-10-11 定档）

**定档**：`seafood` 前端**桌面档不动**，把**手机竖屏（H5）档**做扎实，**P0–P4 全上**。

**依据（可复核，只读）**
- 设备档实测报告：`~/.hermes/profiles/zang/cache/scratch/seafood-mobile-measure/REPORT.md`（Neng 采集 / Zang 复核：40/40 样本零横向溢出；判负实验哈希 `baseline==rerun==restored`；tabbar 真实点击跳转 PASS；1440 档 tabbar `display:none`；console/JS error = 0）。
- 原始读数：同目录 `raw/page_readings.jsonl`（10 页 × {375,390,320,1440}）· `raw/experiments.json`（100vh 消费点）· `raw/experiments2.json`（导航重复的链接集）· `raw/negative_control.json`。

**口径三条**
1. 本册只冻结**口径/判据**，不写实现；数值一律 `文件:行号 + 现取值`（现取命令见各条）。
2. 「**设备档读数 ≠ 真机读数**」：凡只有真机可观测者，一律登记 `NOT_MEASURED`，并在 §13.5 逐条写明「本档只能证到哪一步」。
3. 判据一律**数值读数 + 可复跑命令**，不拄单一计数派单（例：报告 163 个 `<44px` 实例**含 `a` 内嵌 `button` 的成对计数** ⇒ 本册按「控件家族」去重后派单，见 §13.4 前注）。

### 13.1 规则条文（T75–T79）

| 编号 | 口径 | 落点 | 连带影响 |
|---|---|---|---|
| **T75** | 【本册裁定·P0】移动档 `.sf-tabbar` **必须声明 `padding-bottom: env(safe-area-inset-bottom)`**；属**结构层**（非 token：不进主题差集、不进 `STRUCT`）。**不得新增 `@media` 断点**（`shell.css` 必须保持「只有一个 767px 断点块」）。**配对硬要求**（v1.1 原文：真机生效需 `frontend/index.html` 的 `<meta name="viewport">` 含 `viewport-fit=cover`，现状见 §13.4）。**★ v1.2 升级（Zang 裁定）= P0 硬判据**：该 meta **必须**含 `viewport-fit=cover`（缺则 `T75` 不成立）；判据落点见 §13.4 第 2 行 / §13.5。 | `frontend/src/shell/shell.css` 的 `.sf-tabbar` 规则块（L63–69） | 新增 `@media` ⇒ 挂 `theme-shell-isomorphism.test.jsx` L215–229；改主题 token 驱动几何 ⇒ 挂 T69 几何恒等 |
| **T76** | 【本册裁定·P1】移动档顶部**汉堡面板不得包含底部 tab 已有的目标**（底部 tab = `/`、`/reward`、`/task`、`/exchange`；其中 `home` 由 Logo 承担）。即：面板内去 **`/reward`（社区奖励）、`/task`（社区任务）、`/exchange`（碎片市场）** 三项。**桌面档一字不动**（桌面无 tabbar，左侧 nav 保留三项）。 | `frontend/src/components/Header.jsx` 移动面板块（L338–478；菜单项渲染 L341–356）；**不得动** `menuItems`（L118–123）与桌面 `<nav>`（L171–183） | 改共享 `menuItems` ⇒ 连带桌面 nav ⇒ 挂 `theme-shell-isomorphism.test.jsx` L91–103；只改移动面板渲染 ⇒ 桌面断言全绿 |
| **T77** | 【本册裁定·P2 · **v1.2 收窄（Zang 裁定）**】触控目标 **≥44×44**，**只覆盖「主要操作路径」**（覆盖面四项**不变**，原文见下方「T77 留痕」）：① 顶栏全部控件；② 底部 tab 单元（已达标，仅登记）；③ 表单提交与危险操作按钮；④ 页脚语言链接。**★ v1.2 硬约束**：**实施范围一律限在 `@media (max-width: 767px)` 内** —— 所有 `min-height`/`min-width:44px` 追加与 `--sf-*-ctl-h` 改值**必须包在 767 断点块内**（**复用同一个断点值 767**；**不得新增断点类型**如 `pointer: coarse`；`frontend/src/shell/shell.css` 仍必须**只有一个 767 断点块**）。**桌面档几何零变化 = 硬判据**（1440 档逐控件 `getBoundingClientRect()` 与现状逐值相等；`.btn` 家族与 `--sf-*-ctl-h` 的**桌面使用值**仍 34/40）。手段**仅限**结构常量 `min-height`/`min-width` + `padding`；**不得改主题 token 色值/形状值**；**不得改 `STRUCT.h-btna`（桌面 A 口径 34px 冻结）**。 | 见 §13.4 逐项落点表（**每项均「限 ≤767」**）；断点块落点 = `frontend/src/shell/shell.css`（复用唯一 767 块）+ 各页 `*.css` 内 767 媒体块 | 用主题 token 驱动几何 ⇒ 挂 T69 与 `p6-btn-impl2.test.js` L112–136；抬高页内 `--sf-*-ctl-h` **若未包 767 块** ⇒ 桌面几何变 ⇒ **违「桌面档不动」**；**若已包 767 块** ⇒ `p6-btn-impl2.test.js` L138–155 **可能仍绿**（若红则最小改锚，见 §13.3 第 14 行） |
| **T78** | 【本册裁定·P3】断点**以实现值 767px 为准**（`frontend/src/shell/breakpoints.js:11` `phonePortraitMax: 767`）；§5.3 表 `--sea-bp-mobile-max` **原位更正 `639px→767px`**、邻档 `--sea-bp-tablet-min/max` 连带更正 `640px→768px`，**逐处留痕**（见 §5.3 表内留痕语）。`100vh`（`frontend/src/styles.css:342 .app-container`、`frontend/src/shell/shell.css:15 .sf-shell`）**本轮不动**，登记为「待真机读数后定」（真机读数将由新的 LAN 预览服务提供）。 | §5.3 断点表（`--sea-bp-mobile-max` / `--sea-bp-tablet-min/max` 两行；v1.1 版 = L308–309）；登记者 `docs/OPEN-ITEMS.md` | 改实现值 ⇒ 挂 `theme-shell-isomorphism.test.jsx` L215–229（它读 `BREAKPOINTS.phonePortraitMax`；实现不动即仍真） |
| **T79** | 【本册裁定·P4】**产品页可见文本最小字号 ≥12px**。真源 `docs/design/style-preview.html:170` **就地更正** `font-size:10.5px→12px`（**不改行号、不增删行**）；实现侧 `frontend/src/theme/tokens.js` 的 `STRUCT['tab-font-size']`（L397）与 `STRUCT_PROV['tab-font-size']`（L441，needle）同步为 `12px` / `'font-size:12px'`，生成物 `frontend/src/theme/theme-tokens.css:35` 同步；`frontend/src/pages/listings/listings.css:130`、`:140` 的 `11px→12px`。 | `tokens.js:397,441` · `theme-tokens.css:35` · `listings.css:130,140` · `style-preview.html:170` | 值变必须**真源同步**（PROV 硬门：`theme-tokens.test.js` L131–143 逐键回读 `SP` 行号）；只改 JS/CSS 不同步真源 ⇒ 该断言必红 |

> **T77 留痕（v1.1 原文 · 一字未改 · 已被 v1.2 取代）**：
> | **T77** | 【本册裁定·P2】触控目标 **≥44×44**，**只覆盖「主要操作路径」**（不追求全站 44px，不得大面积重排）：① 顶栏全部控件；② 底部 tab 单元（已达标，仅登记）；③ 表单提交与危险操作按钮；④ 页脚语言链接。手段**仅限**结构常量 `min-height`/`min-width` + `padding`；**不得改主题 token 色值/形状值**；**不得改 `STRUCT.h-btna`（桌面 A 口径 34px 冻结）**。 | 见 §13.4 逐项落点表 | 用主题 token 驱动几何 ⇒ 挂 T69 与 `p6-btn-impl2.test.js` L112–136；抬高页内 `--sf-*-ctl-h` ⇒ 挂 `p6-btn-impl2.test.js` L138–155（**须改锚**，见 §13.3 第 14 行） |
> **取代理由（v1.2）**：上列口径**未限定媒体档** ⇒ 直接抬 `.btn` 家族 / `--sf-*-ctl-h`（34→44）会**连带抬高桌面控件**，与 Kevin 2026-10-11「桌面档不动」定档冲突。v1.2 以「**限 ≤767 档**」收窄范围，**覆盖面四项一字不变**。

### 13.2 P4 真源就地更正自证（本册已执行）

- **命令与读数**：`git diff --numstat docs/design/style-preview.html` ⇒ `1\t1`（仅 1 行改、0 行删）。
- **改前**：sha256 `9ddebde7fae6b3e7ecf62a3767c0ccfa418a23aa6d915cabe7e9effeba9b5bcd`，`80,291 B`，`982 行`；L170 = `.tabbar .tab{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 12px;font-size:10.5px;font-weight:600}`。
- **改后**：sha256 `cd09248fb19a99f9598cd18362cd4c2a1fdee1d537409252f4c32b946d6f7da6`，`80,289 B`，`982 行`；L170 = `.tabbar .tab{…gap:3px;padding:8px 0 12px;font-size:12px;font-weight:600}`。
- **自证三读数**：**字节 −2** · **行数 ±0** · **改动行全部落在 L170（`.tabbar .tab` 区块内）**。因**未新增块**，不触发「纯追加到文件尾（`open(path,'ab')`）」分支，故无需 `md5(after[:N])==md5(before)` 三读数。
- **旁证（未改）**：L128 `.avatar.sm{width:19px;height:19px;font-size:10.5px}` **仍在场** —— 该值**不被任何产品 token 消费**（`STRUCT`/`TOKEN_KEYS` 无 `avatar-sm` 字号键），属比选稿**演示框内的值**，登记见 §13.6 / `docs/OPEN-ITEMS.md`，**本轮不动**。

### 13.3 断言影响（逐条点名：哪条一字不动 / 哪条需改锚）

| # | 测试 `文件:行号` | 断言语义 | 影响 | 处置与理由 |
|---|---|---|---|---|
| 1 | `theme-shell-isomorphism.test.jsx:215-229` | `shell.css` 只有一个断点块（767px），底栏可见性只在这里翻转 | **一字不动** | P0 只加 `padding-bottom`（结构层），**不加 `@media`**；`.sf-tabbar` 宽屏 `display:none` / 竖屏 `display:grid` 不变 |
| 2 | `theme-shell-isomorphism.test.jsx:231-236` | `shell.css` 无 `[data-theme]` 选择器 | **一字不动** | P0/P2 不引主题选择器 |
| 3 | `theme-shell-isomorphism.test.jsx:91-103` | `.nav-link[href]` = `[/reward,/task,/exchange]`（顶栏=底栏去 home 子序列） | **一字不动** | **前提**：P1 只改**移动面板渲染**（该面板 `Link` 无 `nav-link` 类、且默认收起），**不改** `menuItems` 与桌面 `<nav>`。若误改 `menuItems` ⇒ 桌面 `topHrefs` 变 ⇒ 该断言必红 |
| 4 | `theme-shell-isomorphism.test.jsx:83-89` | 底部 tab 始终在 DOM、与 `visibleNavItems` 同序 | **一字不动** | P1 不动 `shell/nav.js` / `BottomTabBar.jsx` |
| 5 | `theme-shell-isomorphism.test.jsx:205-213` | shell/theme 的 JS 无 `matchMedia/innerWidth` | **一字不动** | P0 走 CSS `env()`，不引入 JS 判定 |
| 6 | `theme-tokens.test.js:131-143` | 结构常量提取证据逐条可回读 | **一字不动**（Kong 须同步） | P4 改 `STRUCT['tab-font-size']='12px'` 时，`STRUCT_PROV['tab-font-size']` 的 needle 必须同步为 `'font-size:12px'`（`tokens.js:441`，d/n 各一）。本册已把真源 L170 同步为 `font-size:12px` ⇒ 回读成立 |
| 7 | `theme-tokens.test.js:119-129` | `STRUCT` 两档同值 / 含 PROV / 不含颜色 | **一字不动** | `tab-font-size` 仍是字符串、无颜色 |
| 8 | `theme-tokens.test.js:167-179` | 生成物 CSS ↔ JS 逐键互校 | **一字不动**（Kong 须同步） | `theme-tokens.css:35` 必须同步为 `--sf-st-tab-font-size: 12px` |
| 9 | `r9-84-profile-entry.test.jsx:205-213` | 左侧 nav 仅 奖励/任务/碎片 | **一字不动** | 该处 `document.querySelector('nav')` 命中的是**桌面 nav**（`Header.jsx:171`）；P1 不动桌面 nav ⇒ 仍 `[reward,task,shard]` |
| 10 | `r9-84-profile-entry.test.jsx:215-232` | 移动面板含 个人资料 / 电量与签到 / 退出登录 | **一字不动** | P1 只删 nav 三项，用户菜单块（`Header.jsx:444-476`）保留 ⇒ 三个 `data-sf-m` 钩子仍在 |
| 11 | `r9-93-points-symbol.test.jsx:101-109` | `Header.jsx` 的 `>$</span>` 计数 = 1、且无 `DashJ` | **一字不动**（Kong 须守） | P1 删移动 `menuItems` 渲染块不得触及 `Header.jsx:267` 的 `$` span、不得引入 `DashJ` |
| 12 | `p6-btn-impl.test.js:140` | `parseFloat(STRUCT['h-btna']) === 34` | **一字不动**（P2 约束） | P2 **不得改 `h-btna`**（桌面 A 口径冻结）；触控下限用**独立 `min-height:44px`** 实现 |
| 13 | `p6-btn-impl.test.js:170-179` | `.btn.btn-a` 含 `height:var(--sf-st-h-btna)` | **一字不动** | P2 只**追加** `min-height:44px`（`min-height` > `height` ⇒ 使用值 44），不改 `height` 声明 |
| 14 | `p6-btn-impl2.test.js:138-155` | 各页 micro 类 `min-height = 页内 ctl-h = STRUCT.h-btna（34px）` | **改锚预期变化（v1.2）**：**若红则最小改锚**〔v1.1 原文 = 无条件「**必须改锚**」，已被本行取代〕 | **v1.2 更正**：`--sf-j/k/l-ctl-h` 抬到 44 **包在 `@media (max-width:767px)` 块内** ⇒ 文件**顶层**仍 `34px`（= `STRUCT.h-btna`）⇒ L155 `expect(parseFloat(m[1])).toBe(h)` **可能仍绿**（取决于该测试解析面是否含媒体块）。**若红则最小改锚（新判据）**：`expect(parseFloat(m[1])).toBeGreaterThanOrEqual(44)`；且用例名/注释（L138）由「= STRUCT.h-btna（34px）」改为「= 触控下限 ≥44px」。理由：手机档触控下限 44 **覆盖**桌面派生 34，且**桌面档几何零变化**为 v1.2 硬判据 |
| 15 | `p6-btn-impl2.test.js:112-125` | `.sf-btn` 基类无 hex/rgba、var() 白名单 | **一字不动** | 追加 `min-height: 44px`（px 字面量、无 var）不触该断言；若改走 var，须为 `--sf-st-*` 前缀 |
| 16 | `fix-nav-langshell.test.jsx`（整体） | 语言前缀登录路由 / 链接构造器 | **一字不动** | 全程 `vi.mock('../../components/Header')`，与 P1 无关 |

> **一句话**：P0/P1/P3 **不动任何测试**（前提是 P0 不加 `@media`、P1 只改移动面板渲染）；P4 **不动测试**但须同步 `tokens.js` PROV needle（否则第 6 行断言必红）；**唯一须改锚者 = `p6-btn-impl2.test.js:138-155`**（第 14 行）。 〔**v1.2 更正（Zang 裁定）**：第 14 行已改「**若红则最小改锚**」—— `--sf-*-ctl-h` 抬 44 包在 767 块内后，顶层仍 34 ⇒ L155 **可能仍绿**；上句「唯一须改锚者 = `p6-btn-impl2.test.js:138-155`」据此作废，改为「**若红则最小改锚**」〕

### 13.4 Kong 实现清单（逐项 `文件:行号` + 现状值 + 目标值 + 依据条文）

> **前注（去重口径，防拄 163 派单）**：报告 390 档 `<44px` 实例 = **163 个**（含 `a` 与其内嵌 `button` 的**成对计数**），去重 selector = **31 个**；本册按「**控件家族**」收敛为下表 **20 类**。逐类「现状值」均由 `raw/page_readings.jsonl`（390 档）现取；「现取」命令 = 复跑 Neng 脚本 `document.querySelectorAll('a,button,input,select,textarea,[role=button]')` 过滤可见后读 `getBoundingClientRect()`。

**P0 · 底部安全区**

| # | 文件:行号 | 现状值（现取） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 1 | `frontend/src/shell/shell.css:63-69`（`.sf-tabbar` 基块） | 无 `padding-bottom`；计算值 `0px`（375/390/320 三档）；`grep -rn 'env(safe-area-inset' frontend/src` = **0 命中** | 声明 `padding-bottom: env(safe-area-inset-bottom);` | 结构层声明（**不加 `@media`**） | T75 |
| 2 | `frontend/index.html:10` | `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`（**无 `viewport-fit`**） | 追加 `viewport-fit=cover` | meta 属性（真机生效的必要配对） | T75 |

**P1 · 移动端导航去重**

| # | 文件:行号 | 现状值（现取，`raw/experiments2.json`） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 3 | `frontend/src/components/Header.jsx:341-356`（移动面板 `menuItems.map`） | 面板 `a[href]` 含 `/reward`(社区奖励)、`/task`(社区任务)、`/exchange`(碎片市场) —— 与底部 tab 同目标 | 移动面板**不渲染**这三项（`admin`（若有）/注册/登录/语言/主题/用户菜单保留） | **局部过滤**（不得动 `menuItems` L118–123 与桌面 nav L171–183） | T76 |

**P2 · 主要路径触控目标 ≥44×44**（**v1.2 硬约束：下列全部改动一律限在 `@media (max-width: 767px)` 内；桌面档几何零变化为硬判据**）

| # | 文件:行号 | 现状值（现取，390 档） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 4 | `Header.jsx:163`（Logo `a.text-xl.font-bold.text-yellow-600`） | **163.09 × 28** | ≥44 高 | `min-height:44px`（+`inline-flex;align-items:center`） · **限 ≤767** | T77 |
| 5 | `Header.jsx:322-332`（汉堡 `button.p-2.rounded-md`） | **40 × 40** | ≥44 × 44 | `min-height`/`min-width:44px` · **限 ≤767** | T77 |
| 6 | `Header.jsx:188-197`（桌面语言触发器）/`:230-237`（主题）/`:245-254`（用户菜单），共享 `.nav-link` | **派单口径 40×40**（未逐项落 report 表，见 N19） | ≥44 × 44 | 共享 `.nav-link`/按钮 `min-height:44px`（+`min-width`） · **限 ≤767** | T77 |
| 7 | `Header.jsx:387-426`（移动面板语言按钮网格）/`:432-441`（移动主题按钮） | **折叠态未测**（面板收起 ⇒ 不在 report 采样面，见 N19） | ≥44 高 | `min-height:44px` · **限 ≤767** | T77 |
| 8 | `frontend/src/shell/shell.css:71-86`（`.sf-tab` 底部 tab 单元） | **75 / 78 / 64 × 60.75**（**已达标**） | 登记，**不改** | — | T77 |
| 9 | `frontend/src/styles.css:139-159`（`.btn` 默认档） | 高 **40**（首页 96×40 / 登录 240×40） | ≥44 | **追加** `min-height:44px`（使 `.btn.btn-a` 的 `height:34px` 由 `min-height` 抬到 44；**不改** `height` 声明） · **限 ≤767**（桌面档仍 40/34） | T77 |
| 10 | `styles.css:281-298`（`.btn.btn-a` / `.btn.btn-a-alt`） | 高 **34**（首页 82×34、登录 240×34） | ≥44（由 #9 生效） | —（受 #9 覆盖 · **限 ≤767**） | T77 |
| 11 | `styles.css:170-178`（`.btn-md` / `.btn-lg`） | `btn-md` 82×**34**、`btn-lg` 86×**34** | ≥44（由 #9 生效） | —（受 #9 覆盖 · **限 ≤767**） | T77 |
| 12 | `styles.css:189-195`（`.btn-inactive`） | 96 × **40**（「积分不足」） | ≥44（由 #9 生效） | — · **限 ≤767** | T77 |
| 13 | `styles.css:201-208`（`.btn-proceed`） | 96/240 × **40**（「查看全部」/「签名登录」） | ≥44（由 #9 生效） | — · **限 ≤767** | T77 |
| 14 | `frontend/src/pages/jobs/jobs.css:21`（`--sf-j-ctl-h: 34px`） | `34px` | `44px` | 结构常量改值（页内 `--sf-j-*`） · **限 ≤767**（改值包在 767 块内；顶层仍 34） | T77 |
| 15 | `jobs.css:106-113`（`.sf-jobs-btn`：发布招工/审核入口） | **78 × 37.5** | ≥44（由 #14 生效） | — · **限 ≤767** | T77 |
| 16 | `frontend/src/pages/market/market.css:12`（`--sf-k-ctl-h: 34px`） | `34px` | `44px` | 结构常量改值 · **限 ≤767**（改值包在 767 块内；顶层仍 34） | T77 |
| 17 | `market.css:167-180`（`.sf-mkt-input` / `.sf-mkt-select`） | **340 × 37.5 / 340 × 35** | ≥44（由 #16 生效） | — · **限 ≤767** | T77 |
| 18 | `market.css:182-188`（`.sf-mkt-btn`：挂单/全体撤单/刷新） | **52 / 78 × 37.5** | ≥44（由 #16 生效） | — · **限 ≤767** | T77 |
| 19 | `frontend/src/pages/listings/listings.css:18`（`--sf-l-ctl-h: 34px`） | `34px` | `44px` | 结构常量改值 · **限 ≤767**（改值包在 767 块内；顶层仍 34） | T77 |
| 20 | `listings.css:171-185`（`.sf-listings-input`）+ `:192-198`（`.sf-listings-btn`：退款/发货/收货/立即购买） | **276 × 37.5** / **52 / 78 × 37.5** | ≥44（由 #19 生效） | — · **限 ≤767** | T77 |
| 21 | `frontend/src/components/Footer.jsx:80-86`（语言链接 `a.text-sm`） | **28 / 48.03 / 56 / 65.63 × 20**（简体中文/English/粤语/Tiếng Việt） | ≥44 高 | `min-height:44px`（+`inline-flex;align-items:center`） · **限 ≤767** | T77 |

**P3 · 断点**：**无代码改动**（实现值 767 已就位，`breakpoints.js:11`）；本册只更正设计真源 §5.3。依据 T78。
**P4 · 最小字号**

| # | 文件:行号 | 现状值（现取） | 目标值 | 手段 | 依据 |
|---|---|---|---|---|---|
| 22 | `frontend/src/theme/tokens.js:397` | `'tab-font-size': '10.5px'` | `'12px'` | **就地改值**（行号不变） | T79 |
| 23 | `frontend/src/theme/tokens.js:441` | `'tab-font-size': { d:[170,'font-size:10.5px'], n:[170,'font-size:10.5px'] }` | needle 均改 `'font-size:12px'` | 就地改 needle（真源已同步为 `12px`） | T79 |
| 24 | `frontend/src/theme/theme-tokens.css:35` | `--sf-st-tab-font-size: 10.5px;` | `12px` | 就地改值（生成物 ↔ JS 互校） | T79 |
| 25 | `frontend/src/pages/listings/listings.css:130` | `.sf-listings-price-unit { font-size: 11px; }` | `12px` | 就地改值 | T79 |
| 26 | `frontend/src/pages/listings/listings.css:140` | `.sf-listings-tag { font-size: 11px; }` | `12px` | 就地改值 | T79 |

> **桌面连带声明（需 Kevin 认账）**：`.btn` 家族、`--sf-*-ctl-h` 属**共享结构层**（两档同值）⇒ 抬升 44 会**同时**抬高桌面档同族控件高度。此属**几何**变更（非桌面版式重排、非骨架/列数/顺序变更），与 T69「切档几何恒等」不冲突（两档同值）；「桌面档不动」在此解释为**不动桌面版式/骨架**。
> **★ v1.2 作废（Zang 裁定，原文保留为 v1.1 决策留痕）**：上条已作废 —— v1.2 把 T77 全部改动**收窄在 `@media (max-width: 767px)` 内** ⇒ **桌面档几何零变化**（不再抬高桌面 `.btn` 家族 / `--sf-*-ctl-h` 的桌面使用值），**无需 Kevin 认账桌面几何变更**。

### 13.5 Neng 判负清单（每项：怎么判负 + 本档能证到哪一步）

| 项 | 正向判据 | 判负方法（可执行命令/读数） | 本档证据边界 |
|---|---|---|---|
| **P0 安全区（已声明）** | `grep -rn 'env(safe-area-inset' frontend/src` ≥ 1 命中 | 现取 = **0 命中**（`exit 1`）⇒ 改后须 ≥1；含 `padding-bottom` 关键字 | 设备档可判 |
| **P0 未新增断点** | `grep -c '@media' frontend/src/shell/shell.css` 仍 = **1** | 现取 = 1；改后须仍 = 1（新增 ⇒ `theme-shell-isomorphism` L215–229 必红） | 设备档可判 |
| **P0 真机重叠像素** | —— | **不可判**：设备档 `env(safe-area-inset-bottom)` 恒为 `0px`（`raw/experiments.json` `env.pb=0px`、`tabbarPB=0px`）⇒ `.sf-tabbar` 计算 `padding-bottom` **恒 0**，**不能**用「计算值从 0 变非 0」判负 | **`NOT_MEASURED`**：真机（带 Home 指示条 + `viewport-fit=cover`）量重叠量。**本档只能证「源码已声明」+「未新增断点」** |
| **P1 去重** | 展开汉堡面板后，面板 `a[href]` 集合 ∩ 底部 tab `a[href]` 集合 = ∅ | ① 展开后取面板 `a[href]`（现取含 `/reward`,`/task`,`/exchange`）；② 与 `[data-sf-region="tabbar"] a[data-sf-nav]` 的 `href` 求交；交集非空 ⇒ 判负。③ 反向（桌面 1440）：`document.querySelector('nav') a` 文案仍 = [奖励, 任务, 碎片] | 设备档可判 |
| **P2 触控** | 下列控件 `getBoundingClientRect()` 宽高均 ≥44（**v1.2：判据在 ≤767 档复跑**） | 复跑同款脚本：过滤可见后逐类判 `w≥44 && h≥44`；**「主要路径」<44 计数必降**（现取 390 档 = 163 实例 / 31 去重 selector）。**★ v1.2 硬判据**：1440 档同批控件 rect 须**逐值等于现状**（桌面档几何零变化） | 设备档可判（含 320/375/390 三档 + 1440 档零变化复核） |
| **P3 断点** | `grep -n phonePortraitMax frontend/src/shell/breakpoints.js` ⇒ `767` | ① 源码读数 = 767（可复跑）；② 767 视口 `matchMedia('(max-width:767px)')===true` 且 tabbar `display:grid`，768 视口 `display:none`；③ **真源侧**：`grep -n '767px' docs/design/design-system.spec.md` 命中 §5.3 行 | 设备档可判 |
| **P4 字号** | 产品页可见文本 `font-size` ≥12px | TreeWalker 遍历文本节点读父 `font-size`；现取 390 档 `<12px` = **90 节点**（`.sf-tab-label` 10.5px × 36 + `/listing` 等 11px × 54）⇒ 改后必须 = **0**。真源侧 `grep -n '10.5px' docs/design/style-preview.html` 现取 = L128(未消费) + L170(已改 12px) ⇒ 应只剩 L128 | **显式留白**：L128 `.avatar.sm` 10.5px 不在产品页被测集内（不被 token 消费）⇒ 全站扫 `<12px` 若命中它，按 §13.6/N20 口径排除 |
| **100vh** | —— | **本轮不判**：设备档 `100vh == visualViewport.height`（`raw/experiments.json` `vh=844`、`vvh=844`）⇒ 陷阱不可观测 | **`NOT_MEASURED`**：待真机（地址栏收起） |

### 13.6 未核实 / 登记（诚实清单，承接 §11 的 N 序列）

- **N18**：`.sf-tabbar` 安全区**真机重叠像素**未测（设备档 `env()` 恒 0）⇒ P0 判据止步「源码已声明 + 未新增断点」。
- **N19**：顶栏「语言 / 主题 / 用户菜单」的**桌面控件**与**移动面板控件**逐项 rect **未落 report 表**（report 只把汉堡记为 40×40）⇒ §13.4 第 6/7 行标「派单口径 / 折叠态未测」者，Kong 实现后须由 Neng 现取补录。
- **N20**：`style-preview.html:128` `.avatar.sm` `font-size:10.5px` —— 比选稿**演示框内值**、**不被任何产品 token 消费**（`STRUCT`/`TOKEN_KEYS` 无 `avatar-sm` 字号键）⇒ 不属 P4「产品页可见文本」面，本轮**登记不改**（与 §5.3「演示框尺寸非产品 token」同族）。
- **N21**：`100vh` 真机（Safari/Chrome 地址栏）溢出行为 —— `NOT_MEASURED`，待新 LAN 预览服务的真机读数。
- **N22**：非中文档（`/en`、`/hk`、`/vn`）四语版式差异、登录态（`/profile` 正文、tabbar 第 5 格「我的」）未测 ⇒ 与 §11-N 同源登记。
- **N23**：本册 P0–P4 的**设备档**判据可复跑；**真机（实体手机）整体读数**仍为 `NOT_MEASURED`（无实体设备）——P2 的「≥44×44」在真机上的实际命中，须待真机复测。
- **N24**：**`T77` 收窄为「限 ≤767 档」后，各页 `*.css` 新增/包入的 767 媒体块数量未清点**（v1.2 硬约束只锁 `shell.css` 唯一 767 块；`styles.css`/`jobs.css`/`market.css`/`listings.css` 内新增 767 块属实现面）⇒ Kong 实现后须现取 `grep -c '@media (max-width: *767' frontend/src` 并登记；`p6-btn-impl2.test.js:138-155` 是否因「顶层 ctl-h 仍 34」而仍绿，亦待实现后现取（见 §13.3 第 14 行）。
