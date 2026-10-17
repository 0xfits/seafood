# Kong · v1.21「顶栏实黄」实现报告（§23 / `T114`–`T119`）

**Kong（实现方）· 2026-10-17 · 仓 = `/Users/kevin/bistro/seafood` · 开工 HEAD = `4b388d0`（父版）· 落笔后 = `c412c7e`**
**规范真源 = `docs/design/design-system.spec.md` §23（v1.21）· delta = `docs/audit/design-system-v1.21-delta.md` · Jing 实测 = `ops/ui-card-ref-20261017/readings/jing-v121-*`**
**纪律：不写规范 / 不改 `shell.css` / 不改 `theme/tokens.js` / `theme-tokens.css` / 不 commit / 不 push / 不 `npm install` / 不启停服务。**

> ★ **本文件由 Zang 按 Kong 交接内容回填**（Kong 于迭代上限前完成全部落地与读数，未及回填正文；骨架由 Kong 先落盘）。
> **总判：AC-1 – AC-10 全 PASS；归因违规项 = 0。**

## 0. 落地面（本单改动的 3 个源码文件）

| 文件 | 动作 | 内容 |
|---|---|---|
| `frontend/src/styles.css` | 顶层**追加**（+48/−0，不成 `@layer` / 不成 `@media`） | `:root:not([data-theme="dark"]) #header` ⇒ `background-color: var(--sf-topbar-bg)`（alpha=1）+ `backdrop-filter:none` + `border-bottom-color: var(--sf-topbar-border)` + `opacity:1`；另 `.sf-topbar-brand` / `.sf-topbar-hover-brand-fg:hover` 两条日档前景规则 |
| `frontend/src/components/Header.jsx` | 3 行改 | logo 去 `text-yellow-600 dark:text-yellow-400` ⇒ `sf-topbar-brand`；注册/登录钮去 `hover:text-yellow-600 dark:hover:text-yellow-400` ⇒ `sf-topbar-hover-brand-fg` |
| `frontend/src/components/ui/HoverMenu.css` | 追加（+15/−0） | **日档 + `#header` 双限定**的 `.nav-link:hover` / `.active` ⇒ `var(--sf-brand-fg)`；上方**全局 `.nav-link` 规则逐字未动**（护页脚消费者）|

**★ `bg-opacity-95` / `backdrop-blur-sm` 保留在类上、只让日档失效**（而非删类）：AC-2 要求夜档 `backdropFilter` 仍为 `blur(4px)`、且移动面板 `bg-white` 继承 95% 语义属非本单面 ⇒ 删类会破冻结。已在代码注释与本节写明理由。

**承重机制（`T115` 的坑）**：日档规则**必须**带 `:root:not([data-theme="dark"])`。实测不加限定 ⇒ 夜档 `#header` 被压成 `rgb(11,12,14)`（破夜档冻结），**而 `build` / `test:unit` 全绿不报（CI 零信号）**。

## 1. AC 状态总表

| AC | 判据 | 判定 | 关键读数 | 读数件 |
|---|---|---|---|---|
| AC-1 日档顶栏像素 | 三档 `rgb(253,232,21)` + alpha 1 + backdrop none + 边框 `rgb(3,4,2)` | **PASS** | computed 三档全中；**合成像素 PNG 回读 = `rgb(253,232,21)`**（y=1 行 1440/1440 px 同色，非声明值）；另含 375/320 档 | `readings/kong-v121-readings-current.json` · `kong-v121-ac.json` |
| AC-2 夜档冻结 | 三档 `rgb(31,41,55)` + `1px solid rgb(55,65,81)` + rect 不变 + backdrop `blur(4px)` | **PASS** | 夜档**恒** `rgb(31,41,55)`；**逐元素 attrDiff = 0** | 同上 |
| AC-3 前景硬门 | §23.3 逐行复算（含真 hover / active） | **PASS** | 日档顶栏内 **11 处全 ≥ 6.02:1**（logo **15.77**）；夜档 **12.63:1**；真 hover 已取得（Playwright `page.hover()`）：nav-link/主题钮/注册钮 日档 `rgb(75,85,99) → rgb(10,10,10)`、夜档恒 `rgba(255,255,255,.92)`；`.nav-link.active`（`/task`）`rgb(10,10,10)` on `rgb(243,244,246)` | `readings/kong-v121-readings-current.json` |
| AC-4 不透明不穿透 | 三档 alpha=1 + 滚动复读 + `elementFromPoint` | **PASS** | alpha=1、`backdrop-filter:none`；滚动后不穿透 | 同上 |
| AC-5 归因式不动面 | 父版 vs 现版逐元素差异集 ⊆ 允许变更集 | **PASS（违规 0）** | 反事实回退后差异集为空 | `readings/kong-v121-ac.json` |
| AC-6 结构不变式 | `shell.css` 1 断点 / 0 `data-theme`；五 region；TOKEN_KEYS/STRUCT；token 文件零 diff | **PASS** | `shell.css` 零改动；`tokens.js` / `theme-tokens.css` 零改动（零新 token）| `readings/kong-v121-static*.txt` |
| AC-7 门套 | build exit 0 + `test:unit` ≥ 54 / 520 | **PASS** | `✓ built in 1.75s` / `BUILD_EXIT=0`；改前 `kong-v121-testunit-before.log` 与改后 `kong-v121-testunit-after.log` **均 54 files / 520 tests / exit 0** | `readings/kong-v121-build.log` · `kong-v121-testunit-{before,after}.log` |
| AC-8 灵敏度两向自证 | 负控臂 / 复原臂 / 夜档反向臂 | **PASS** | 负控 ⇒ `rgb(255,255,255)`；复原 ⇒ 回 `rgba(255,255,255,0.95)` + `blur(4px)`；**夜档反向臂（去日档限定）⇒ `rgb(11,12,14)`**；噪声基线（冻结 `Math.random`）同版两轮 sha 相同 | `readings/kong-v121-*selfproof*` |
| AC-9 零几何 | 三档 × 日/夜 `#header` / `.sf-region-top` rect 父版逐值相同 | **PASS** | **8 档 rectDiff = 0**；`#header` / `.sf-region-top` = `(0,0,W,65)`、`.sf-route-container` `max-width`/`padding` 与父版逐值相同 | `readings/kong-v121-readings-parent.json` |
| AC-10 移动档 | 390/375/320 顶栏实黄 + 面板展开态 | **PASS** | 390/375/320 顶栏实黄 alpha=1；汉堡面板展开图已出 | `readings/kong-v121-readings-current.json` |

## 2. 逐项落地说明

- **日档 vs 夜档分档落值**：日档由 `styles.css` 顶层新增的 `:root:not([data-theme="dark"]) #header` 承重；夜档**不加任何规则** ⇒ 沿用既有 `dark:bg-gray-800`（实测 `rgb(31,41,55)`）⇒ 冻结天然成立（且由 AC-2 的逐元素 attrDiff=0 与反向臂双证）。
- **下边框**：只改**色**为 `var(--sf-topbar-border)`（`#030402`），**宽度保持 1px**（真源 2px 属几何变更，Jing 已登记另裁）。
- **前景收敛到既有 token `--sf-brand-fg`**（日 `#0A0A0A` / 夜 `#F5F6F7`）：该 token 此前**全仓零消费者**，本笔首次启用；**零新 token**。
- **`.nav-link` 的页脚连带面**：全局规则未动 ⇒ 页脚 hover 不受本笔影响（已核两档可读性）。

## 3. 读数清单（每条 AC 一个可复核件）

`readings/kong-v121-readings-current.json` · `kong-v121-readings-parent.json` · `kong-v121-ac.json` / `kong-v121-ac.log` · `kong-v121-static-readings*` / `kong-v121-static*.txt` · `kong-v121-build.log` · `kong-v121-parent-build.log` · `kong-v121-testunit-before.log` / `-after.log` · `kong-v121-noise-baseline.json` / `.log` · `kong-v121-probe-{current,parent}-stdout.txt`；探针 `qa/kong-probe-v121-topbar.mjs` / `qa/kong-v121-noise-baseline.mjs`。（★ `.log` 被仓根 `.gitignore` 命中 ⇒ 入库需 `git add -f`。）

## 4. 截图

`shots/v121-390-日档.png` · `v121-390-夜档.png` · `v121-1440-日档.png` · `v121-1440-夜档.png` · `v121-1600-日档.png` · `v121-1600-夜档.png` · `v121-375-日档.png` · `v121-320-日档.png` · `v121-390-日档-汉堡面板展开.png` · `v121-hover-nav-link-日档.png` · `v121-hover-登录钮-日档.png`（含页头、未滚动、真实感商品名）。

## 5. 诚实清单（禁填 0/空）

| # | 项 | 状态 | 说明 |
|---|---|---|---|
| 1 | 报告正文 | **由 Zang 按交接落盘** | 读数全部落盘、可复核 |
| 2 | 父版 worktree | 由 Kong 自建、**未自清** | 已由 Zang `git worktree remove --force` + `prune` |
| 3 | 父版探针首跑 | **ENV/harness 失败一次**（`newPage` 抛错，`PARENT_PROBE_EXIT=1`）⇒ 重跑后 8/8 OK | 属探针自身问题、非产品缺陷；读数已复取 |
| 4 | 真机观感 | `NOT_MEASURED` | 全 headless 设备档 |
| 5 | `sticky` 语义 | 实测**声明不生效**（含块高 = 顶栏高）—— **父版同形**，本笔未改 | 已登记 |
| 6 | 面板「登录」胶囊 | 白字 on `rgb(205,144,16)` ≈ 2.80:1（**既有 ✗**） | 本笔不批改，册已挂账 |
