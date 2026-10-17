# `/item/:id` 底部操作栏 · goofish 形态实现（Kong · 实现单）

> **比例勘误：58:42→实测 50:50，64%→72.8%**（留白 12.5%→4.6%、收藏 23.5%→22.6%）。派单原给的三组比例为目测错值，
> 经参考图 `ref/goofish-ref.png` **列主类逐像素实测**校正后回改；本报告内所有比例读数已按实测值更新。
> 同期规范侧（Jing · 16:40）已在 `design-system.spec.md` §24 原位勘误（不升版，仍 v1.22）冻结同一组数值
> （`T120`-b = 50:50、`T120`-i = 72.8 / 4.6 / 22.6，±1pp 判负 · 见 `readings/spec-correction-v122.md`）⇒ **实现 / 参考图 / spec 三者一致**。
> 单号：`KONG-IMPL-ITEM-ACTIONBAR` ｜ 日期：2026-10-17（CST） ｜ 基线 `HEAD = 2324584`
> 实现角色（Kong）· **未 commit · 未 push · 未 `git add -A`** · 未改规范真源 · 未改 `shell.css` · 未启停任何服务
> 设计真源（上一单 Jing 已冻）：`docs/design/design-system.spec.md` **`T120` / §24** + `theme-tokens.css` 的
> `--sf-cta-solid-bg` / `--sf-cta-solid-fg`（日 `#202020`/`#FFFFFF`、夜 `#EDEFF2`/`#0A0A0A`）
> 参考图：`ops/item-actionbar-20261017/ref/goofish-ref.png`（1128×170 · sha256 `308e2b62…65485cd`）

## 0. 结论一览（比例勘误后）

| 判据 | 结果 | 证据 |
|---|---|---|
| **A** 几何（无缝拼接 / 留白 / 胶囊 / **占比 72.8 · 50:50 · 22.6 · 4.6** / 两档同构） | **PASS**（四主态比例门 + 8 态全绿） | `readings/probe-post.json` → `ratioGate` |
| **A′** 尺子灵敏度（扰动必红 + 复原回绿，三条） | **PASS** | `probe-post.json.rulerSensitivity` · `readings/selfproof-E-ratio.txt` §3 |
| **B** `npm run test:unit` | **PASS** `56 files / 544 tests / 0 failed`（基线同为 56/544） | `readings/gate-B-testunit-post.log` |
| **C** `npm run build` | **PASS** `EXIT=0` · `✓ built in 1.75s` · `index-DnoMyxQu.css` / `index-DSKdz5I6.js` | `readings/gate-C-build-post.log` |
| **D** 本报告 + 改前/改后读数 + 截图（重拍） | **PASS** | 本文件 §2–§5 · `readings/` · `shots/post-*` |
| 冻结面自证（`.sf-item-btn` 本体 / `[data-theme` / hex / `shell.css` / 60px） | **PASS** | `readings/selfproof-constraints.txt` · `selfproof-E-ratio.txt` §5 |

**一句话**：三段结构落地（组合条 **72.8%** 内 **50:50** 无缝 + 留白 **4.6%** + 独立收藏 **22.6%**，全部为参考图逐像素实测值），
颜色全 token、几何两档同构、44px 触控达标、6 个既有钩子全保留、未登录 `disabled` 与登录引导语义逐条实测未变；
**比例口径已与参考图对齐（原 3 处偏差全部消解，见 §5）。**

## 1. 改了什么

### 1.1 本单（比例勘误 · 唯一源码改动 = `item.css` 三个数字）

| 行 | 选择器 | 改前 | 改后 |
|---|---|---|---|
| `.sf-item-cta-group` | 组合条（相对按钮行可用宽） | `flex: 0 0 64%` | **`flex: 0 0 72.8%`** |
| `.sf-btn.sf-item-cta-chat` | 聊一聊 | `flex: 0 0 58%` | **`flex: 0 0 50%`** |
| `.sf-btn.sf-item-cta-fav` | 收藏 | `flex: 0 0 23.5%` | **`flex: 0 0 22.6%`** |
| — | 立即购买 | `flex: 1 1 auto`（不变 ⇒ 自动 50%） | 不变 |
| — | 留白 | `justify-content: space-between` 自然让出 | 不变（**未写任何固定 px**） |

同步只改了 4 处**注释文字**（`--sf-l-cta-h` 常量块与三个段规则上方的比例描述），颜色 / 高度 / 圆角 / 图标 / 字重 /
状态行 / 钩子 / 留白机制一律未动。`git diff --numstat item.css` 仍为 `122 6`（行数不变）。

### 1.2 上一单（结构与配色，本轮未再改）

| 文件 | numstat | 内容 |
|---|---|---|
| `frontend/src/pages/item/ItemDetailPage.jsx` | `47 25` | 操作栏 DOM 重排：`.sf-item-actionbar-row` > 〔`.sf-item-cta-group` > 聊一聊 / 立即购买〕+ `.sf-item-cta-fav`；状态文字移到按钮行下方；`MessageCircle` / `Star`（lucide，size 18）；`aria-pressed` + 既有 `data-sf-fav` |
| `frontend/src/pages/item/item.css` | `122 6` | 新增 `--sf-l-cta-h|icon-size|icon-gap` + 行/组合条/两段/收藏/标签/状态行规则；`.sf-item-actionbar` 改列向；≤767 块加 12px 横向内边距；**删除已无消费者的旧规则 `.sf-btn.sf-item-cta`** |

## 2. 验收 A · 几何（改后读数逐条）

探针 `probe/probe-actionbar.mjs`（`context.route` 映射 `frontend/dist` · API 内存自截 · 零 dev server / 零后端 / 零库写）·
8 个状态 × 2 档视口 × 日/夜。下表取 `1440_light` / `390_light`（dark 与 light 几何逐值相等，见 §2.2）：

| # | 判据（区间 = 派单 A 口径） | 1440×900（行内宽 1400） | 390×844（行内宽 366） | 判 |
|---|---|---|---|---|
| A1 | 两段拼接无缝（`buy.left − chat.right`） | **0.00px** | **0.00px** | ✅ `seamDelta === 0` |
| A2 | 组合条总宽 > 收藏宽 ×2 | 1019.19 / 316.39×2 ⇒ **161.07%** | 266.44 / 82.7×2 ⇒ **161.10%** | ✅ |
| A3 | 组合条 ↔ 收藏 留白（4.1–5.1%） | **64.42px（4.60%）** | **16.86px（4.61%）** | ✅ |
| A4 | 聊一聊 : 立即购买 = 50 : 50（±0.5pp） | **50.00 : 50.00** | **50.00 : 50.00** | ✅ |
| A5 | 两端半圆（容器 pill ≥ 高一半 99%） | 容器 `border-radius: 999px` ≥ 22px×0.99 | 同 | ✅ |
| A6 | 中缝直角（4 角 = 0） | chat `TR/BR = 0px`、buy `TL/BL = 0px` | 同 | ✅ |
| A7 | 收藏独立胶囊（≥ 高一半） | `999px` | `999px` | ✅ |
| A8 | 收藏占行宽 22.6%（22.1–23.1%） | **22.60%**（316.39px） | **22.60%**（82.7px） | ✅ |
| A9 | 组合条占行宽 72.8%（72.3–73.3%） | **72.80%**（1019.19px） | **72.80%**（266.44px） | ✅ |
| A10 | 触控目标 ≥44 | 44.0 | 44.0 | ✅ |
| A11 | 图标存在（`lucide-message-circle` / `lucide-star`） | 1 / 1 | 1 / 1 | ✅ |
| A12 | 颜色映射（token 回读） | 聊一聊 `rgb(255,230,15)`/`rgb(32,32,32)`；立即购买 `rgb(32,32,32)`/`rgb(255,255,255)`；收藏 `rgb(255,255,255)`/`rgb(32,32,32)` | 同（day） | ✅ |
| A13 | 状态文字在按钮下方一行 | 无文案 ⇒ `:empty` 不占高（bar 61px）；有文案 ⇒ 见 §3 ⑤（+9px，在按钮下方） | 同 | ✅ |
| A14 | 零横向溢出 | 0px | 0px | ✅ |

`ratioGate.allPass = true`：四主态（`1440_light` / `1440_dark` / `390_light` / `390_dark`）的五条比例判据 + `seamDelta === 0`
逐态全绿，且两档 `themeGeoEqual` 均为 true。

### 2.1 四个附属态
| 状态 | 读数要点 | 判 |
|---|---|---|
| `1440_dark` / `390_dark` | 立即购买 `rgb(237,239,242)`/`rgb(10,10,10)`、收藏 `rgb(20,22,25)`/`rgb(255,255,255)`；**几何与 day 逐值相等**（含新比例） | ✅ |
| `*_seller_onlybuy`（卖家本人） | 组合条内 `buy` 占 **100%**（1440 1019.19px / 390 266.44px），自身圆角 `999px`（整条全圆、不留半圆开口）；`item-chat-btn` 计数 **0**（条件渲染未变）。注：`a_buyShare_50_0` 在此态为 `false` 属**定义使然**（该态无 chat，"组内 50:50"不适用），故比例门只覆盖四主态 | ✅ |
| `favored_1440_light` | `data-sf-fav="1"` · `aria-pressed="true"` · 文案「已收藏」 · 星标 `fill="currentColor"` | ✅ |
| `*_anon`（未登录） | `item-buy-btn.disabled = true` · 状态行显示 `pleaseLogin`（按钮下方 +9px）· 聊一聊/收藏渲染且未 disabled | ✅ |

### 2.2 日/夜几何同构（`T120`-f）
`themeGeoEqual`：**1440 = true**、**390 = true** —— 比较面 = bar / row / group / chat / buy / fav 的 `x,w,h` + 容器圆角 + 留白 + 中缝差，逐值相等；差异只在颜色。

### 2.3 尺子灵敏度自证（不采信恒绿 · 红绿两条均落盘）
只做**页内注入**（`<style id="qa-perturb">…!important</style>`，量完 remove 再量"复原"），**源码零改动**：

| 注入 | 判据 | 出厂 | 扰动 | 复原 | 结论 |
|---|---|---|---|---|---|
| `.sf-item-cta-group{flex:0 0 60%}` | `a_groupShare_72_8` | 72.8 ✅ | **60.0 ❌** | 72.8 ✅ | 派单 B 指定项：**必红已红** |
| 同上 | `a_gapShare_4_6` | 4.60 ✅ | **17.40 ❌** | 4.60 ✅ | 留白判据同步翻红（证明它真的在量留白） |
| `.sf-btn.sf-item-cta-chat{flex:0 0 58%}` | `a_chatShare_50_0` / `a_buyShare_50_0` | 50/50 ✅ | **58/42 ❌** | 50/50 ✅ | 组内比例尺子有分辨力 |
| `.sf-btn.sf-item-cta-fav{flex:0 0 30%}` | `a_favShare_22_6` | 22.6 ✅ | **30.0 ❌** | 22.6 ✅ | 收藏尺子有分辨力 |

`rulerSensitivity.mustRedSensitive = true` · `restoredAllGreen = true` · `shippedAllGreen = true` · `sensitive = true`。
> 注意：组合条基数的扰动**不会**翻转 `chatShareOfGroup`（组内两段等比缩放，占比恒 50:50）—— 这正是我另做 chat/fav 两条注入的原因；
> 只用单条扰动却要求所有比例判据一起红，是把两把不同的尺子当成一把。

## 3. 交互语义（`readings/probe-interaction.json` · 与比例无关，未因本单变化）

| # | 态 | 读数 | 判 |
|---|---|---|---|
| ① | 未登录点「立即购买」 | `disabled = true`；点击后 path 不变 `/item/888`，**零** `/buy` 请求 | ✅ 语义未动 |
| ② | 未登录点「聊一聊」 | → `/login`（既有登录引导，零新弹层） | ✅ |
| ③ | 未登录点「收藏」 | → `/login` | ✅ |
| ④ | 登录点「收藏」（两连击） | `POST /api/favorites` → `data-sf-fav 0→1`、`aria-pressed false→true`、星标 `fill none→currentColor`、文案「收藏→已收藏」；再点 `DELETE /api/favorites/888` → 全部回落 | ✅ |
| ⑤ | 登录 + 聊一聊失败 | `item-chat-status` **仍渲染**，y=680 > 按钮 bottom 671 ⇒ **在按钮行下方** | ✅ 钩子保留 |
| ⑥ | 登录点「聊一聊」成功 | `POST /api/messages/conversations` ⇒ `pathname` 不变、`search` 变 `?msg=1&c=7`、面板 `.sf-mp` 已挂载 | ✅ |

> ⚠️ `verdict.*.hooksComplete` 在 `seller_onlybuy` 两态为 `false`：该字段按「6 个钩子各恰好 1 个」写死，而 `item-chat-status`
> 是**错误态条件渲染**（改前 `probe-pre.json` 同值为 `false`，非回归）。真实计数见 `states.*.hookCounts`。

## 4. 改前 / 改后读数对比（同一探针、同一夹具）

改前读数 `readings/probe-pre.json` 由 `git stash` 掉本单两文件后 `npm run build -- --outDir dist-pre` 现建（非旧产物），跑完即删。

### 4.1 `1440_light`
| 项 | 改前 | 改后（比例勘误后） |
|---|---|---|
| 操作栏 | `x20 w1400 h60` · `flex row` · `static` | `x20 w1400 h61` · `flex column` · `static` |
| 组合条 | **不存在** | `x20 w1019.19 h44` · pill · `overflow:hidden` |
| 聊一聊 | `x953.33 w457.67 h37.5` · 底黄 · 圆角 999 · **无图标** | `x20 w509.59 h44` · 底 `#FFE60F` · 圆角 **0** · 图标 1 |
| 立即购买 | `x20 w470.66 h37.5` · 底黄 · 圆角 999 | `x529.59 w509.59 h44` · 底 `#202020` · 圆角 **0** |
| 收藏 | `x499.66 w444.67 h37.5` · 底黄 | `x1103.61 w316.39 h44` · 底 `#FFFFFF` · 独立胶囊 |
| 内部占比 | —（三等分） | **50 : 50** |
| 组合条 / 收藏 / 留白 | — | **72.80% / 22.60% / 4.60%**（留白 64.42px） |
| 顺序 | 立即购买 → 收藏 → 聊一聊 | **聊一聊 → 立即购买 → 收藏** |
| 状态文字 | 行内（`top` 比按钮高 35.75px） | 按钮行下方独立行（无文案不占高） |
| 横向溢出 | 0 | 0 |

### 4.2 `390_light`
| 项 | 改前 | 改后（比例勘误后） |
|---|---|---|
| 操作栏 | `x0 w390 h61` · `fixed` | `x0 w390 h61` · `fixed` · 左右 12px 内边距（行内宽 366） |
| 组合条 | 不存在 | `x12 w266.44 h44`（72.80%） |
| 聊一聊 | `x260 w121 h44` | `x12 w133.22 h44`（占组合条 50.00%） |
| 立即购买 | `x0 w134 h44` | `x145.22 w133.22 h44`（占组合条 50.00%） |
| 收藏 | `x143 w108 h44` | `x295.3 w82.7 h44`（22.60%） |
| 留白 | 9px（等分缝隙） | **16.86px（4.61%）** |
| 中缝 | 9px 缝、各自全圆 | **0px 缝、中缝直角** |

### 4.3 卖家本人 / 未登录
- 卖家本人：改前 `buy w704 + fav w678`（各占一半）；改后 `buy w266.44（= 组合条 100%，1440 档 1019.19）+ fav w82.7`，`buy` 自身 `999px` 圆角。
- 未登录：改前 `buy.disabled=true`（37.5px 高）→ 改后仍 `true`（44px 高），状态行移到按钮下方（+9px）。

## 5. ★ 参考图实测 vs 本单实现（勘误闭环）

参考图 `ref/goofish-ref.png`（1128×170）**列主类逐像素**分析（避开文字噪声；取样列中心行）：

| 项 | 参考图实测 | 本单实现（回改后） | 差 |
|---|---|---|---|
| 组合条总宽 | `x32..806` = **775px / 1064 = 72.8%** | **72.80%** | **0.0pp** ✅ |
| 聊一聊 : 立即购买 | `388 : 387` = **50.1 : 49.9** | **50.00 : 50.00** | 0.1pp ✅ |
| 组合条 ↔ 收藏 留白 | **49px = 4.6%** | **4.60%（64.42px / 1400）** | **0.0pp** ✅ |
| 收藏 | `x856..1095` = **240px = 22.6%** | **22.60%** | **0.0pp** ✅ |
| 中缝 | 0px 直角 ✅ | 0px 直角（`seamDelta = 0`） | 一致 |
| 两端 / 收藏 圆角 | 半圆 ✅ | 容器 pill + 独立 pill | 一致 |
| 颜色回读 | 黄 `rgb(255,233,44)` / 墨 `rgb(59,59,59)` / 收藏底 `rgb(246,246,246)` | 黄 `#FFE60F` / 墨 `#202020`(日)、`#EDEFF2`(夜) / 收藏 `#FFFFFF`(日)、`#141619`(夜) | 见下 |

**偏差状态：三条比例偏差全部消解，且已升格为「规范口径」。**

**同期规范侧对齐（16:40 · Jing）**：`docs/design/design-system.spec.md` 以**原位勘误（不升版，仍 v1.22）**把旧 `58:42`
标记为「目测值、已作废」，并把 **`T120`-b 内部占比 = 50:50**、**`T120`-i 三段占比 = 组合条 72.8% / 留白 4.6% / 收藏 22.6%**
（相对按钮行可用宽，**禁固定 px**，±1pp 判负）写进真源（`§24.1-b` / `§24.3` / `§24.7` / `§24.8`）。
⇒ 本单实现与**参考图实测**、**校正后 spec** 三者一致；本单探针容差取 **±0.5pp（严于 spec 的 ±1pp）**。

1. ~~组合条内部占比 58:42~~ → **50:50**（实测 50.1:49.9）。`flex-basis 50%` + 立即购买 `flex:1 1 auto` 自然得 50:50。
2. ~~留白 12.5% / 组合条 64%~~ → **4.6% / 72.8%**。留白仍由 `space-between` 让出，**未写死任何 px**。
3. **立即购买底色 `#3B3B3B` vs token `#202020`**：这不是偏差而是 `§24.2` 的**裁定**（日档沿用站点 ink 家族 `--sf-btna-fg`，
   夜档必须成对反相，否则深底在夜档页底上消失）⇒ 保持 spec 值，不回改。
4. 参考图黄 `#FFE92C` 与 token `#FFE60F` 属同族（截图色域/压缩差），不另开色槽。

> 两份独立扫描的互校（诚实登记）：我上一单用中心行扫描得 `73.2% / 3.1% / 23.7%`，本轮派单给了 `72.8% / 4.6% / 22.6%`；
> 差因是**行内起点/边距归零方式不同**（我按 `x25` 起算，派单按左右各 32px 边距的 `1064px` 可用宽起算）。
> 落码采用派单口径（`72.8 / 22.6`，两者之和 95.4% ⇒ 留白 4.6% 与之自洽），探针实测与落码值**逐位相等**，不存在"写 72.8 量出 73.2"的缝。

## 6. 未动面自证（`readings/selfproof-constraints.txt` · `selfproof-E-ratio.txt` §5）

| 项 | 读数 |
|---|---|
| `.sf-item-btn` 规则本体（`p6-btn-impl2:146-161` 冻结） | **`cmp` 逐字节相同**（HEAD vs 工作区，各 225 B；本单 diff 无该 hunk） |
| `item.css` 内 `[data-theme` 行 | **2 行 = 改前既有的两条注释**（本单新增 0；新增规则零 `[data-theme` 选择器） |
| `item.css` 新增行 hex/rgba 字面量 | **0** |
| `shell.css` | **0 行变更** |
| 新增 `data-sf-region` | **0** |
| `--sf-l-actionbar-h` | **仍 `60px`**（第 26 行） |
| 本单改动面 | **仅 `frontend/src/pages/item/item.css` 三个 flex-basis + 4 处注释**（numstat `122 6` 与本单前一致） |
| `tokens.js` / `theme-tokens.css` / `design-system.spec.md` / `ItemDetailPage.jsx` | numstat `12 4` / `4 0` / `154 1` / `47 25`。**本单对这四个文件零改动**：`12 4` / `4 0` / `47 25` 与上一单自证 `selfproof-D.txt` 逐值相同；`design-system.spec.md` 由 `152 1` 变 `154 1` 是**同期另一单（Jing · `T120` 口径勘误，16:40 落盘 `readings/spec-correction-v122.md`）**所致 —— 该单把 `50:50 / 72.8% / 4.6% / 22.6%` 就地写入 `§24.1-b` / `T120-i` / `§24.7`（±1pp 判负），**不是本单改的**，本单 `git diff` 对 spec 的贡献 = 0 行 |

## 7. 已知后果 / 未闭环（如实登记，不当作成绩）

1. **操作栏渲染高 60 → 61px（仅桌面档）**：`--sf-l-actionbar-h` 仍 60px，但 44px 按钮 + 上下 8px 内边距正好用满 60px 内容盒，再加 1px 上边框 ⇒ border-box 实测 61px。390 档改前即为 61px，非新增。
2. **右侧悬浮菜单（`.sf-fm`）覆盖操作栏右端 68px**：改前同样 68px（改前最后一个控件是"聊一聊"，`right = 1420`），不是本单引入；本单只是把"收藏"放到该位置。
3. **390 档「★ 已收藏」余量 0px**（本单新增风险）：收藏 22.6% ⇒ 390 档可用宽 **82.7px**，实测 `scrollWidth 81 = clientWidth 81`、单行不换行、无溢出
   （内宽 65 = 图标 18 + 间距 8 + 三字 39，正好用尽）。**若字号从 13px 放大到 14px 会立刻换行**，需同批复核（提高 basis 或去掉图标间距）。
4. **「收藏」后端承载**：复用既有 `trades-api`；**未在 dev/生产实测真库往返**（本单按纪律零库写）。真机验证归上线终验。
5. **字号 13px**：按派单"本单不放大字号"沿用 `.sf-item-btn` 的 13px（44 × 0.295，略低于参考图 0.31–0.33 带）。
6. 390 档操作栏 12px 横向内边距（参考图外边距 32/1128 ≈ 2.8%）：本单为"胶囊不贴屏幕边缘"做的实现选择，不属于冻结口径，可一句话回退。

## 8. 证据清单

```
ops/item-actionbar-20261017/
├── REPORT.md                              ← 本文件（比例勘误后重写读数）
├── REPORT-spec-freeze-v122.md             ← 上一单 Jing 的冻结证据（本单**未覆盖**）
├── ref/goofish-ref.png                    ← 参考图（1128×170）
├── probe/probe-actionbar.mjs              ← 几何探针（本次把比例判据改为实测口径 + 三条扰动自证）
├── probe/probe-interaction.mjs            ← 交互语义探针
├── readings/probe-pre.json                ← 改前读数（对 dist-pre 现建产物）
├── readings/probe-post.json               ← 改后读数（8 态 + ratioGate + rulerSensitivity）
├── readings/probe-interaction.json        ← 交互读数（6 态）
├── readings/gate-B-testunit-post.log      ← 56 / 544 / 0 failed · EXIT=0
├── readings/gate-C-build-post.log         ← ✓ built in 1.75s · EXIT=0
├── readings/selfproof-constraints.txt     ← 冻结面自证（上一单）
├── readings/selfproof-E-ratio.txt         ← 本单：三个数字 + 探针读数 + 红/绿自证 + 冻结面复核 + 390 窄测
└── shots/post-{1440,390}_{light,dark}.png + post-390_seller_onlybuy.png   ← 改后截图（本单重拍）
```

截图（改后，两档视口各日/夜一张，均滚到底后取景）：`shots/post-1440_light.png` · `shots/post-1440_dark.png` ·
`shots/post-390_light.png` · `shots/post-390_dark.png`（另有 `post-390_seller_onlybuy.png` 证「单段全圆」）。
