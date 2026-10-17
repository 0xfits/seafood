# Kong · 首页商品卡片 UI 改造 实现报告（§22 / v1.20 · 第一笔）

**Kong（实现方）· 2026-10-17 · 仓 = `/Users/kevin/bistro/seafood` · 开工 HEAD = `d8cb98e` · 落笔后 = `4b388d0`**
**规范真源 = `docs/design/design-system.spec.md` §22（v1.20 · `T109`–`T113`）· delta = `docs/audit/design-system-v1.20-delta.md`**
**纪律：不写规范 / 不跑质检 / 不 commit / 不 push / 不 `npm install` / 不启停服务。**

> ★ **本文件由 Zang 按 Kong 交接内容落盘**（Kong 于迭代上限前完成全部落地、门套与 AC 读数，唯独未及写本报告；素材全部在盘）。
> **总判：AC-1 / AC-2 / AC-3 / AC-4 / AC-6 PASS，归因面由 Neng 独立复检（AC-5）实质 PASS。**

## 0. 落地面

| 文件 | 改动 | `git numstat` |
|---|---|---|
| `frontend/src/theme/tokens.js` | DAY `page-bg` ⇒ `#F5F7F9`；两档同位置（键序一致）新增 `surface-bg`（`#FFFFFF` / `#101114`）；`PROV['page-bg'].d` ⇒ `[1069,'background:#F5F7F9']`；新增 `surface-bg: {d:[1071,'background:#FFFFFF'], n:[1073,'background:#101114']}` | 9 / 2 |
| `frontend/src/theme/theme-tokens.css` | 用生成器 `backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs` 重生成（**先证改前 `cmp=0` 零漂移**，改后再跑一次仍 `cmp=0`）| 3 / 1 |
| `frontend/src/shell/shell.css` | `.sf-route-container` 新增 `background: var(--sf-surface-bg)`（无新 `@media`、无 `[data-theme`、无 `data-sf-region`）| 3 / 0 |
| `frontend/src/pages/item/item.css` | **只 1 行**：`.sf-item-actionbar` 的 `background` 由 `--sf-page-bg` 改挂 `--sf-surface-bg` | 1 / 1 |
| `frontend/src/components/reward/RewardCard.jsx` | 整卡单一链接（`Link`/`a`/`div` 三态回落）+ `data-sf-m="reward-card"`；CTA 由 `Button` 降级为 `<span>` 胶囊（保留 `reward-card-view` + `item.viewDetail`）；价格块同行 flex + baseline、`$`→数字、`$`=0.75em、数字 `text-2xl`+700、去框去底去内边距；`variant='default'`、`hover='none'`+`hover:shadow-lg`；稀有度**渐变底去掉**、描边/图标/光斑保留 | 152 / 120 |
| `frontend/src/components/reward/reward-card.css` | **新增**（价格块版式 + `.sf-reward-card.sf-reward-card` 卡内局部重绑价格三色为日档值）| 新文件 |
| `frontend/src/pages/HomePage.jsx` | 新增 `rewardPath()`（同一 id 口径 + 唯一构造器），给 `RewardCard` 传 `to` | 8 / 0 |

## 1. 门套（改前基线 54 / 520 已由 Zang 于开工前采集）

| 项 | 读数 |
|---|---|
| `npm run build` | **exit 0**，`✓ built in 1.79s`，产物 `index-Dh7Gdrie.js` / `index-B0eM_JXL.css` |
| `npm run test:unit` | **exit 0**，`54 passed (54)` / `520 passed (520)`（与基线持平，未减少）|

## 2. AC 判定（读数落 `readings/`）

| AC | 判定 | 关键读数 |
|---|---|---|
| **AC-1** 底色分层 | **PASS** | 日档 `.sf-shell`=`rgb(245,247,249)`、`.sf-route-container`=`rgb(255,255,255)`、`.sf-region-top`=`rgb(253,232,21)`；夜档 `rgb(11,12,14)` / `rgb(16,17,20)` / `rgb(11,12,14)`；`var(--sf-page-bg)` 消费者**恰 1 行** |
| **AC-2** 价格块版式 | **PASS**（4 档全绿）| 同父 flex + baseline、基线差 **0**、高度比 **0.75**（18px/24px）、`font-weight 700`、`0px/0px/0px/0px` + `rgba(0,0,0,0)` + padding 0、顺序 `["cur","num"]`、色 = `rgb(3,4,2)`（两档同貌）|
| **AC-3** 整卡可点击 | **PASS** | 根 `A`、href `/item/1`（en `/en/item/1`）、卡内交互元素 **0**、CTA=`SPAN`+`reward-card-view`、**真点空白区**（严格空白点）⇒ zh `/item/1`、en `/en/item/1` |
| **AC-4** 无 Router 回落 | **PASS**（两向）| 临时 vitest 探针：无 Router 不抛错、`a` 计数 0、根 `DIV.sf-reward-card.block`、无 href；**对照臂非空**（有 Router ⇒ `A` + `/item/1`）。探针跑完已删（现取不存在）|
| **AC-6** 结构不变式 | **PASS** | `@media` 计数 1、`shell.css` 零 `[data-theme`、`TOKEN_KEYS`(110) 含 `surface-bg`（序号 1）、日/夜逐键 = `tokens.js`（不一致 `[]`）、`STRUCT` 37 / `EXCLUDED_FROM_THEME` 10 不变、五 region 恒等、横向溢出 0 |
| **AC-5** 归因式不动面 | **由 Neng 独立复检 · 实质 PASS** | 非首页路由归一化差异 100% 归因、几何 0、结构 0；反事实回退后 8/8 档为空（见 `neng-REPORT.md` / `qa/neng-readings-ac5.json`）|

**尺子灵敏度自证**：注入 `align-items:flex-start` ⇒ 基线差 0→15；`font-size:0.4em` ⇒ 比值 0.75→0.4（判据非恒绿）。

## 3. 两条实测反证（推翻派单方前提，已入册）

1. **「`dark:` 类是死码」不成立**。三臂实测：臂 A（站点夜档 + 设备 light，父页 `mqDark=false`，但 `html` 计算值 `color-scheme=dark`）⇒ `dark:text-yellow-400` / `dark:bg-gray-800` **生效**；臂 C（同设备偏好 + `data-theme=light`）⇒ 失效。机制 = 浏览器按**根元素 used `color-scheme`** 解析 `prefers-color-scheme`（本仓已声明）。⇒ 全站 Tailwind `dark:` 工具类在夜档**是活的**（另由 Zang、Neng 两次独立复现确认）。
2. **改前夜档价格更糟**：数字 `text-yellow-600` `#CA8A04` on 奶黄卡 `#FEFCE8` = **2.84:1**；符号 `dark:text-yellow-400` `#FACC15` = **1.48:1**（同一价格块两色不一致）；**改后** `#030402` on `#FFFFFF` = **20.55:1**（AA 达标）。色值经浏览器 canvas 回读 + Node oklch 双路，最大通道差 ≤ 6/255。

## 4. 截图

`shots/after-390-日档.png` · `after-390-夜档.png` · `after-1440-日档.png` · `after-1440-夜档.png`（含首页商品列表区）。
**登记**：本批截图为**探针夹具文案**且第 1/2 张为**滚动后**取样（非缺陷）；Kevin 目视确认用的是 Zang 另出的**真数据** `shots/preview-cards-*.png` / `final-*.png`。

## 5. 诚实清单（禁填 0/空）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 报告正文 | **由 Zang 按交接落盘** | 读数全部落盘、可复核 |
| 2 | 临时探针 | 已删（`frontend/src/test/unit/zz-kong-ac4-tmp.test.jsx` 现取不存在）| 已由 Jing v120c 收口 |
| 3 | 真机观感 | `NOT_MEASURED` | 全 headless 设备档 |
| 4 | `lint` / 前端 `tsc` | 未跑 / `N/A` | 无 eslint 配置 / 无 tsconfig（存量口径）|
| 5 | 截图夹具与滚动位置 | 已登记 | 见 §4 |
