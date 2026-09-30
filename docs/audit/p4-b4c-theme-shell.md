# P4-B4c-i-FIN · 主题层 + 骨架层 同构审计（日/夜 · 横/竖屏）

- 单元：P4-B4c-i / FIN（几何量测 + 报告落盘）
- 仓：`/Users/kevin/bistro/seafood`，纳入面：`frontend/**`（已解冻）
- 交付物：几何探针读数（`frontend/scripts/p4z-b4c-geometry.mjs`）+ 本报告
- 口径声明：本报告所有"实测"字样均可由文末 §6 给出的命令在本机复现；`NOT_MEASURED` 一律不填 0/空（见 §5）。

---

## §0 结论

1. **主题层**：`frontend/src/theme/tokens.js` 为单一真源，主题 token **107 键**，日/夜**键集合完全相同**，其中 **103 键异值、4 键同值**（`up-fg`、`jobtag-bg`、`jobpay-fg`、`btnsm-bg`）；另有 **32 条结构常量（STRUCT）两档同值**，**10 条档间差异被显式排除并登记理由**（`EXCLUDED_FROM_THEME`）。所有 token 值均带 `PROV` 溯源（`docs/design/style-preview.html` 行号 + 该行原文片段），由 `src/test/unit/theme-tokens.test.js` 逐键回读该行断言。
2. **骨架层**：`AppShell` 只渲染一套 DOM（`shell → topnav → route-container → footer → tabbar`），屏型差异全部落在 `shell.css` 的断点（栅格列数 / 导航形态），主题差异全部落在 token 值。
3. **同构判据**：主题/屏型切换前后，同一批元素的 `getBoundingClientRect` 逐值相等 —— 实测读数见 §3。
4. **红线**：`npm run build` 与 `npx vitest run src/test/unit` 由本单自己重跑，退出码见 §4（不引用他人读数）。

---

## §1 token 提取表（逐项带 `docs/design/style-preview.html` 行号）

- 提取范围：变体 A（日档「码头大牌」）**200–267 行**；变体 B（夜档「夜市行情板」）**273–351 行**。
- 自证计数（可 grep）：`TOKEN_KEYS=107 identical=4 differing=103`。
- 图例：A行 = 日档取值所在行；B行 = 夜档取值所在行。`同值` = 两档同键同值（仍在键集合内，逐键断言覆盖）。

| # | token | 日档值 | A行 | 夜档值 | B行 | 档间 |
|---|---|---|---|---|---|---|
| 1 | page-bg | `#FDE815` | 200 | `#0B0C0E` | 273 | 异值 |
| 2 | page-fg | `#0A0A0A` | 200 | `#E8EAED` | 273 | 异值 |
| 3 | topbar-bg | `#FDE815` | 201 | `#0B0C0E` | 274 | 异值 |
| 4 | topbar-border | `#030402` | 201 | `#FDE815` | 274 | 异值 |
| 5 | brand-fg | `#0A0A0A` | 203 | `#F5F6F7` | 276 | 异值 |
| 6 | search-bg | `#fff` | 204 | `#15171B` | 277 | 异值 |
| 7 | search-border | `#030402` | 204 | `#33373D` | 277 | 异值 |
| 8 | search-fg | `#0A0A0A` | 204 | `#8A9099` | 277 | 异值 |
| 9 | search-radius | `11px` | 204 | `2px` | 277 | 异值 |
| 10 | search-shadow | `2px 2px 0 #030402` | 204 | `none` | 277 | 异值 |
| 11 | btn-bg | `#030402` | 206 | `#FDE815` | 279 | 异值 |
| 12 | btn-fg | `#FDE815` | 206 | `#0B0C0E` | 279 | 异值 |
| 13 | btn-radius | `11px` | 206 | `2px` | 279 | 异值 |
| 14 | btn-shadow | `2px 2px 0 rgba(3,4,2,.35)` | 206 | `none` | 279 | 异值 |
| 15 | me-bg | `#fff` | 207 | `#15171B` | 280 | 异值 |
| 16 | me-border | `#030402` | 207 | `#33373D` | 280 | 异值 |
| 17 | me-radius | `999px` | 207 | `2px` | 280 | 异值 |
| 18 | avatar-bg | `#030402` | 208 | `#FDE815` | 281 | 异值 |
| 19 | avatar-fg | `#FDE815` | 208 | `#0B0C0E` | 281 | 异值 |
| 20 | me-name-fg | `#0A0A0A` | 209 | `#D7DBE0` | 282 | 异值 |
| 21 | ticker-bg | `#030402` | 210 | `#111317` | 283 | 异值 |
| 22 | ticker-border | `none` | 210 | `#24272C` | 283 | 异值 |
| 23 | ticker-fg | `#fff` | 210 | `inherit` | 283 | 异值 |
| 24 | tk-pair-fg | `#FDE815` | 212 | `#9AA0A8` | 284 | 异值 |
| 25 | tk-price-fg | `#fff` | 213 | `#FDE815` | 285 | 异值 |
| 26 | up-fg | `#3DDC84` | 214 | `#3DDC84` | 286 | 同值 |
| 27 | down-fg | `#FF7A7A` | 214 | `#FF6B6B` | 286 | 异值 |
| 28 | cat-bg | `#fff` | 216 | `#15171B` | 289 | 异值 |
| 29 | cat-border | `#030402` | 216 | `#2A2D33` | 289 | 异值 |
| 30 | cat-fg | `#0A0A0A` | 216 | `#C4C9D0` | 289 | 异值 |
| 31 | cat-radius | `999px` | 216 | `2px` | 289 | 异值 |
| 32 | cat-on-bg | `#030402` | 217 | `#FDE815` | 290 | 异值 |
| 33 | cat-on-fg | `#FDE815` | 217 | `#0B0C0E` | 290 | 异值 |
| 34 | card-bg | `#fff` | 219 | `#141619` | 292 | 异值 |
| 35 | card-border | `#030402` | 219 | `#262A30` | 292 | 异值 |
| 36 | card-radius | `13px` | 219 | `2px` | 292 | 异值 |
| 37 | card-shadow | `3px 3px 0 #030402` | 219 | `none` | 292 | 异值 |
| 38 | thumb-border | `#030402` | 220 | `#262A30` | 293 | 异值 |
| 39 | glyph-fg | `rgba(3,4,2,.30)` | 221 | `rgba(253,232,21,.20)` | 294 | 异值 |
| 40 | badge-bg | `#030402` | 222 | `#FDE815` | 295 | 异值 |
| 41 | badge-fg | `#FDE815` | 222 | `#0B0C0E` | 295 | 异值 |
| 42 | badge-radius | `6px` | 120 | `2px` | 295 | 异值 |
| 43 | title-fg | `#0A0A0A` | 223 | `#EDEFF2` | 296 | 异值 |
| 44 | price-bg | `#FDE815` | 224 | `transparent` | 297 | 异值 |
| 45 | price-border | `#030402` | 224 | `#22262B` | 297 | 异值 |
| 46 | price-radius | `8px` | 224 | `0px` | 297 | 异值 |
| 47 | price-cur-fg | `#030402` | 225 | `#FDE815` | 298 | 异值 |
| 48 | price-num-fg | `#030402` | 226 | `#FDE815` | 299 | 异值 |
| 49 | price-unit-fg | `#3A3A2A` | 227 | `#8A9099` | 300 | 异值 |
| 50 | meta-fg | `#3D3D3D` | 228 | `#8A9099` | 301 | 异值 |
| 51 | meta-avatar-bg | `#030402` | 229 | `#22262B` | 302 | 异值 |
| 52 | meta-avatar-fg | `#FDE815` | 229 | `#D7DBE0` | 302 | 异值 |
| 53 | tag-bg | `#FFF7B8` | 230 | `transparent` | 303 | 异值 |
| 54 | tag-border | `#030402` | 230 | `#2A2D33` | 303 | 异值 |
| 55 | tag-fg | `#0A0A0A` | 230 | `#A9AFB7` | 303 | 异值 |
| 56 | tag-radius | `5px` | 131 | `2px` | 303 | 异值 |
| 57 | jobcard-bg | `#030402` | 231 | `#141619` | 304 | 异值 |
| 58 | jobcard-border | `#030402` | 231 | `#FDE815` | 304 | 异值 |
| 59 | jobcard-radius | `13px` | 219 | `2px` | 304 | 异值 |
| 60 | jobcard-shadow | `3px 3px 0 rgba(3,4,2,.4)` | 231 | `none` | 304 | 异值 |
| 61 | jobtag-bg | `#FDE815` | 232 | `#FDE815` | 305 | 同值 |
| 62 | jobtag-fg | `#030402` | 232 | `#0B0C0E` | 305 | 异值 |
| 63 | jobtag-radius | `5px` | 136 | `2px` | 305 | 异值 |
| 64 | jobpay-fg | `#FDE815` | 233 | `#FDE815` | 307 | 同值 |
| 65 | jobpay-unit-fg | `#E8E8C8` | 234 | `#8A9099` | 309 | 异值 |
| 66 | jobtitle-fg | `#fff` | 235 | `#EDEFF2` | 306 | 异值 |
| 67 | joblist-fg | `#C9C9B8` | 236 | `#A9AFB7` | 310 | 异值 |
| 68 | joblist-dot-bg | `currentColor` | 144 | `#FDE815` | 311 | 异值 |
| 69 | btnsm-bg | `#FDE815` | 237 | `#FDE815` | 312 | 同值 |
| 70 | btnsm-fg | `#030402` | 237 | `#0B0C0E` | 312 | 异值 |
| 71 | btnsm-radius | `9px` | 237 | `2px` | 312 | 异值 |
| 72 | jobpub-fg | `#9A9A88` | 238 | `#6B7079` | 313 | 异值 |
| 73 | panel-bg | `#fff` | 239 | `#141619` | 314 | 异值 |
| 74 | panel-border | `#030402` | 239 | `#262A30` | 314 | 异值 |
| 75 | panel-radius | `13px` | 239 | `2px` | 314 | 异值 |
| 76 | panel-shadow | `3px 3px 0 #030402` | 239 | `none` | 314 | 异值 |
| 77 | panel-h4-fg | `#0A0A0A` | 240 | `#EDEFF2` | 315 | 异值 |
| 78 | panel-link-fg | `#0A0A0A` | 241 | `#FDE815` | 316 | 异值 |
| 79 | hr-bg | `#030402` | 242 | `#262A30` | 317 | 异值 |
| 80 | prow-fg | `#0A0A0A` | 243 | `#C4C9D0` | 318 | 异值 |
| 81 | rule-fg | `#2C2C2C` | 244 | `#9AA0A8` | 320 | 异值 |
| 82 | rule-b-fg | `inherit` | 244 | `#FDE815` | 321 | 异值 |
| 83 | jrow-fg | `#0A0A0A` | 245 | `#C4C9D0` | 322 | 异值 |
| 84 | jrow-jp-fg | `#030402` | 246 | `#FDE815` | 323 | 异值 |
| 85 | jrow-jp-bg | `#FDE815` | 246 | `transparent` | 323 | 异值 |
| 86 | jrow-jp-radius | `5px` | 246 | `0px` | 323 | 异值 |
| 87 | head-bg | `#FDE815` | 247 | `#0B0C0E` | 324 | 异值 |
| 88 | statusbar-fg | `#0A0A0A` | 248 | `#C9CED6` | 325 | 异值 |
| 89 | tabbar-bg | `#fff` | 252 | `#0B0C0E` | 336 | 异值 |
| 90 | tabbar-border | `#030402` | 252 | `#262A30` | 336 | 异值 |
| 91 | tab-fg | `#6B6B5A` | 253 | `#6E747C` | 337 | 异值 |
| 92 | tab-active-fg | `#030402` | 254 | `#FDE815` | 338 | 异值 |
| 93 | fab-bg | `#030402` | 255 | `#FDE815` | 339 | 异值 |
| 94 | fab-fg | `#FDE815` | 255 | `#0B0C0E` | 339 | 异值 |
| 95 | fab-radius | `14px` | 173 | `2px` | 339 | 异值 |
| 96 | empty-fg | `#4A4A2E` | 256 | `#5C6169` | 340 | 异值 |
| 97 | foot-fg | `#0A0A0A` | 257 | `#6B7079` | 341 | 异值 |
| 98 | thumb-1 | `linear-gradient(140deg,#FFE8A3,#FFC44D)` | 258 | `linear-gradient(150deg,#3E3520,#6B5620)` | 342 | 异值 |
| 99 | thumb-2 | `linear-gradient(140deg,#FFD3A5,#FD9E5B)` | 259 | `linear-gradient(150deg,#4A2E1C,#7A4A22)` | 343 | 异值 |
| 100 | thumb-3 | `linear-gradient(140deg,#BFE9FF,#6FC3F7)` | 260 | `linear-gradient(150deg,#1B2E3E,#24455C)` | 344 | 异值 |
| 101 | thumb-4 | `linear-gradient(140deg,#C9F4E4,#5BD7B4)` | 261 | `linear-gradient(150deg,#12302B,#1B4A40)` | 345 | 异值 |
| 102 | thumb-5 | `linear-gradient(140deg,#E4D9FF,#A98CF7)` | 262 | `linear-gradient(150deg,#282040,#3B2F5E)` | 346 | 异值 |
| 103 | thumb-6 | `linear-gradient(140deg,#D7F0C0,#8BD05A)` | 263 | `linear-gradient(150deg,#20301A,#33502A)` | 347 | 异值 |
| 104 | thumb-7 | `linear-gradient(140deg,#FFD9E0,#FF8FA8)` | 264 | `linear-gradient(150deg,#3A1F28,#5E2F3E)` | 348 | 异值 |
| 105 | thumb-8 | `linear-gradient(140deg,#FFE9C4,#FFB85C)` | 265 | `linear-gradient(150deg,#42341B,#6E4F1D)` | 349 | 异值 |
| 106 | thumb-9 | `linear-gradient(140deg,#CDE7FF,#7FA8FF)` | 266 | `linear-gradient(150deg,#1B2A3E,#284A73)` | 350 | 异值 |
| 107 | thumb-10 | `linear-gradient(140deg,#F0E3C8,#D9BC86)` | 267 | `linear-gradient(150deg,#382F22,#5A4A33)` | 351 | 异值 |

### §1.1 结构常量（STRUCT，32 条，两档同值，**不进主题差集**）

`stroke-w=1.5px` `stroke-w-strong=2px` `stroke-w-thin=1px` `radius-pill=999px` `radius-card=13px` `radius-ctl=11px` `radius-badge=6px` `radius-tag=5px` `radius-fab=14px` `shell-max-w=1440px` `feed-cols=4` `feed-cols-m=2` `feed-gap=16px` `feed-gap-m=9px` `card-thumb-h=150px` `card-thumb-h-m=118px` `tabbar-cols=5` `tabbar-fab=46px` `tabbar-fab-overlap=-16px` `statusbar-pad=7px 16px 3px` `topbar-pad-x=20px` `price-num-size=21px` `jobpay-num-size=24px` `glyph-size=46px` `num-font=inherit` `tab-pad=8px 0 12px` `tab-gap=3px` `tab-font-size=10.5px` `tab-ic-size=22px` `grid-pad-m=8px 10px 16px` `layout-gap=18px` `side-w=320px`

每条同样带 `STRUCT_PROV`（`style-preview.html` 行号 + 片段），夜档另有取值者在 PROV 里同时登记（用于说明"该档间差异已被吸收为常量"），例：`feed-cols` d=[115,`grid-template-columns:repeat(4,minmax(0,1fr))`] / n=[291,`grid-template-columns:repeat(3,minmax(0,1fr))`]；`stroke-w` d=[204,`border:1.5px solid #030402`] / n=[277,`border:1px solid #33373D`]。

### §1.2 被排除出主题层的 10 条档间差异（`EXCLUDED_FROM_THEME`，带行号 + 理由）

| # | 内容 | 日档出处 | 夜档出处 | 排除理由（摘要） |
|---|---|---|---|---|
| 1 | 等宽数字 font-family | :193（继承 body） | :285,299,307,319,323 | 字体度量改文本推进宽度 ⇒ 改 rect，与同构硬判据冲突；收敛 `STRUCT.num-font=inherit` |
| 2 | brand-txt letter-spacing | :88（.02em） | :276（.04em） | 字距改文本宽度 ⇒ 收敛基础层 .02em |
| 3 | 数字字号（21/26、24/30、46/52） | :226,140,193 | :299,308,294 | font-size 改高宽 ⇒ 收敛 STRUCT 常量（取日档值） |
| 4 | 描边宽度（1.5/2px vs 1px）、border-left 4px | :201,204,219,220 | :274,277,292,293,304 | border-width 计入 border-box 尺寸 ⇒ 收敛 `STRUCT.stroke-w*` |
| 5 | 价牌 padding / 手机发布按钮 padding | :224,250 | :297（无）,327 | padding 改盒尺寸 ⇒ 收敛基础层常量 |
| 6 | 信息流列数与间距（4列/16px vs 3列/13px；手机 2列/9px vs 1列/8px） | :115,218,116 | :291,328 | 栅格属断点层（本单要求横竖屏也不得按主题变）⇒ 收敛 `STRUCT.feed-cols*` |
| 7 | 手机卡 flex-direction:row | :329 仅夜档 | :329 | 改盒子排布 ⇒ 同构约束下不得按主题分支；登记延期项 |
| 8 | `.price` align-self:flex-start | :224 | — | 改对齐与盒宽 ⇒ 收敛基础层同一对齐 |
| 9 | opacity 差（如 meta .72 ⇒ 1） | :228,234,238 | :301,309,313 | opacity 不改几何（可入主题层），但统一用显式色值，避免与既有 opacity 叠乘 |
| 10 | 手机壳宽度 377px / 演示框缩放 | :74 | :74 | 比选页自带展示量具，非产品 token |

---

## §2 断点与栅格表

真源：`frontend/src/shell/breakpoints.js`（19 行）+ `frontend/src/theme/tokens.js` 的 `STRUCT`。

| 档位 | 判据 | 栅格 / 导航形态 | 出处 |
|---|---|---|---|
| 手机竖屏 | `max-width: 767px` | 信息流 `feed-cols-m=2` 列、`feed-gap-m=9px`；`.device{width:377px}` 落在该档内 | `style-preview.html:74` |
| 过渡（不新增骨架） | 768–1023px | 沿用宽屏同一套 DOM，栅格降为 2 列 | 口径自定义，见 `breakpoints.js:8` |
| 宽屏 | `min-width: 1024px` | `feed-cols=4`、`feed-gap=16px`、`shell-max-w=1440px`、`side-w=320px`、`layout-gap=18px` | `style-preview.html:85,112,114,115,116` |
| 底部 tab（两档共用骨架） | — | `tabbar-cols=5`、`tabbar-fab=46px`、`tabbar-fab-overlap=-16px`、`tab-pad=8px 0 12px`、`tab-gap=3px`、`tab-font-size=10.5px` | `style-preview.html:169–173` |

- 导航项单一真源：`frontend/src/shell/nav.js`（5 项：home/reward/task/shard/profile；`profile` 带 `requiresAuth`）。顶栏与底栏**共用同一份可见性规则**（`visibleNavItems`），故两处元素顺序恒等。
- 元素顺序恒定：`shell → topnav(Header) → route-container → footer(Footer) → tabbar`（`frontend/src/shell/AppShell.jsx:12–23`），主题与屏型都不改这套结构。

## §3 同构证据（真实浏览器 rect 读数）

**读数文件**：`backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json`（`npm run build` 产物 `frontend/dist` 经 `page.route` 映射到 `http://sf.local`；浏览器 = 本机 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，`browserVersion=154.0.8037.58`；运行窗口 `2026-09-30T13:30:23.327Z → 13:30:29.541Z`；探针 `PROBE_EXIT=0`）。
**稳定帧协议**：每个臂都采到「连续两次读数逐字节相同」才采信，实测每臂 `*_stable_reads=2`（11 个臂全部 =2，无臂走到 40 轮上限）。

### §3.1 日档 vs 夜档：同批元素 rect 逐值相等（14/14）

`verdict.measured_elements=14`、`verdict.geometry_diff_count=0`、`verdict.geometry_diffs=[]`。逐元素（单位 CSS px，保留 3 位）：

| # | 选择器 | 日档 x / y / w / h | 夜档 x / y / w / h | 逐值相等 |
|---|---|---|---|---|
| 1 | `[data-sf-m="hero"]` | 28 / 91 / 1424 / 24 | 28 / 91 / 1424 / 24 | ✅ |
| 2 | `[data-sf-m="search"]` | 28 / 215.875 / 1424 / 21 | 28 / 215.875 / 1424 / 21 | ✅ |
| 3 | `[data-sf-m="chips"]` | 28 / 250.875 / 1424 / 29 | 28 / 250.875 / 1424 / 29 | ✅ |
| 4 | `[data-sf-m="layout"]` | 28 / 293.875 / 1424 / 323.953 | 28 / 293.875 / 1424 / 323.953 | ✅ |
| 5 | `[data-sf-m="grid"]` | 28 / 301.875 / 1086 / 220.781 | 28 / 301.875 / 1086 / 220.781 | ✅ |
| 6 | `[data-sf-m="card-1"]` | 28 / 301.875 / 259.5 / 102.391 | 28 / 301.875 / 259.5 / 102.391 | ✅ |
| 7 | `[data-sf-m="card-4"]` | 854.5 / 301.875 / 259.5 / 102.391 | 854.5 / 301.875 / 259.5 / 102.391 | ✅ |
| 8 | `[data-sf-m="side"]` | 1132 / 301.875 / 320 / 289.953 | 1132 / 301.875 / 320 / 289.953 | ✅ |
| 9 | `[data-sf-m="price-1"]` | 40 / 335.875 / 91.141 / 30 | 40 / 335.875 / 91.141 / 30 | ✅ |
| 10 | `[data-sf-m="toggle-day"]` | 28 / 164.875 / 125 / 37 | 28 / 164.875 / 125 / 37 | ✅ |
| 11 | `[data-sf-m="toggle-night"]` | 163 / 164.875 / 138.5 / 37 | 163 / 164.875 / 138.5 / 37 | ✅ |
| 12 | `[data-sf-region="tabbar"]` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | ✅（**该值是实测读数而非缺测**：1440 宽屏下底栏 `display:none`，计算样式佐证见 §3.5「底栏 tabbar display」行；竖屏档同元素量到 8/785/374/59） |
| 13 | `[data-sf-region="topnav"]` | 8 / 8 / 1424 / 65 | 8 / 8 / 1424 / 65 | ✅ |
| 14 | `#sf-route-container` | 8 / 73 / 1464 / 3600.734 | 8 / 73 / 1464 / 3600.734 | ✅ |

**相等的元素数 = 14，不等的元素数 = 0，差异明细 = 空数组**（`geometry_diffs=[]`）。

同时证明「主题确实变了、但只变外观」：`skin_changed=true`，同一张卡片的计算样式
日档 `{bg:rgb(255,255,255), border:rgb(3,4,2), radius:13px, shadow:rgb(3,4,2) 3px 3px 0px 0px}` →
夜档 `{bg:rgb(20,22,25), border:rgb(38,42,48), radius:2px, shadow:none}`；
外壳底色 `rgb(253,232,21)` → `rgb(11,12,14)`（= `#FDE815` / `#0B0C0E`，与 §1 表 1 号 token 取值一致）；
`<html data-theme>` 由 `light` → `dark`，页面主题标志 `day` → `night`。

### §3.2 可重复性（重跑同档位逐值相等）

- `arms.day_repeat_byte_identical=true`：日档第二次整份读数（14 条 rect + DOM 签名 + 计算样式 + token 探针）与第一次 **逐字节相同**。
- 其余七次切换后的读数同样各采到稳定帧：`after_set_day/after_set_night/perturbed/restored/wide_1440/portrait_390/wide_back` 的 `*_stable_reads` 均为 2。

### §3.3 1px 扰动灵敏度（证明这把尺子不是恒真）

对 `[data-sf-m="chips"]` 注入 `padding-top: 1px`：

- 前：`{x:28, y:250.875, w:1424, h:29}` → 后：`{x:28, y:250.875, w:1424, h:30}`；`perturbation.detected=true`（**h 由 29 → 30，差 1px 被判出**；`y` 不变、`h` 变，说明是盒子高度而非位置误判）。
- 复原后 `{x:28, y:250.875, w:1424, h:29}`，且整份 rect 集合 `perturbation_restored_byte_identical=true` ⇒ 该臂不存在状态残留。
- 结论：本探针的分辨率为 1px 且非恒真（正对照通过），故 §3.1 的「0 差异」是真实相等而非度量失效。

### §3.4 日 → 夜 → 日 回基线

- `arms.day_return_byte_identical=true`：切到 night 再切回 day，整份读数与日档基线**逐字节相同**（无状态残留、无布局漂移）。
- 结构签名三态一致：`SIG_DAY == SIG_NIGHT`，`same_dom_signature_day_vs_night=true`，签名串为
  `DIV[shell]>DIV[topnav]>MAIN[content]>DIV[footer]>NAV[tabbar]>A[nav=home]>A[nav=reward]>A[nav=task]>A[nav=shard]`
  （= 区域序列 + 底栏 tab 顺序，均不含 class/文本；`profile` 项因未登录按 `visibleNavItems` 规则不渲染，两档同规则）。
- DOM 节点总数：日档 `772` = 夜档 `772` ⇒ 主题切换不增删任何节点。

### §3.5 1440 横屏 / 390 竖屏 两档签名对照

| 指标 | 1440×900（横屏） | 390×844（竖屏） | 判读 |
|---|---|---|---|
| DOM 结构签名 | `DIV[shell]>DIV[topnav]>MAIN[content]>DIV[footer]>NAV[tabbar]>A[nav=home]>A[nav=reward]>A[nav=task]>A[nav=shard]` | **同一串** | `signature_equal_wide_vs_portrait=true`（结构/元素顺序一致） |
| `*` 元素总数 | 772 | 772 | 两档同节点数 |
| 底栏 tabbar display | `none`（rect 0/0/0/0） | `grid`（rect 8/785/374/59） | 差异只在**导航形态** |
| 顶栏 topnav rect | 8 / 8 / 1424 / 65 | 8 / 8 / 374 / 65 | 宽度随视口 |
| 底栏 tab 链接 rect | 4 项均 0/0/0/0（隐藏） | 4 项各 74.797 宽、y=786、h=58，x 依次 8 / 82.797 / 157.594 / 232.391（等分 5 列栅格） | 差异只在**栅格/导航形态** |
| 信息流 grid rect | 28 / 301.875 / 1086 / 220.781 | 18 / 470.5 / 374 / 510.125 | 同上（移动端单/双列、更高） |
| 回到 1440 后 | `wide_back` 与 `wide_1440` 签名相等（`signature_equal_wide_vs_wideBack=true`） | — | 视口切换无残留 |

**量测环境自曝（必须随读数一起读）**：本跑 `blocked_external_requests = [cdn.tailwindcss.com, cdnjs.cloudflare.com, fonts.googleapis.com, cdn.jsdelivr.net, raw.githubusercontent.com]`，`page_errors = ["ReferenceError: tailwind is not defined"]` —— 即 **Tailwind CDN 与 Google Fonts 在探针环境被刻意阻断**，该环境下生效的是仓内 CSS（`theme-tokens.css` + `shell.css` + `styles.css`）与本机回退字体。因此本节读数证明的是「**token 层 + 骨架层在离线确定性环境中的主题/屏型同构**」；线上 Tailwind 生效环境下的 rect 未量测（见 §5）。

---

## §4 红线退出码（本单自己现跑，不引用他人读数）

命令与日志（日志落在 `backend-ts/.p4-artifacts/b4c-20260930T210239/`）：

| 命令 | 退出码捕获方式 | 读数 | 日志 |
|---|---|---|---|
| `cd frontend && npm run build` | `npm run build > build-fin.log 2>&1; echo "BUILD_EXIT=$?"` | `BUILD_EXIT=0`；`✓ 1765 modules transformed.` / `✓ built in 1.53s` | `build-fin.log`（2408B） |
| `cd frontend && npx vitest run src/test/unit` | `npx vitest run src/test/unit > vitest-fin.log 2>&1; echo "VITEST_EXIT=$?"` | `VITEST_EXIT=0`；`Test Files 11 passed (11)` / `Tests 90 passed (90)` / `Duration 1.67s` | `vitest-fin.log` |
| `cd frontend && node scripts/p4z-b4c-geometry.mjs` | `node scripts/p4z-b4c-geometry.mjs; echo "PROBE_EXIT=$?"` | `PROBE_EXIT=0`；`geometry_diff_count=0` | `geometry.json` / 首跑失败件 `geometry-probe.stdout.json` |

口径：退出码一律在**管道之外**捕获（`; echo "X_EXIT=$?"` 紧跟原命令），未使用 `timeout/gtimeout`（本机无此命令）；上述三条命令均可原样重放。

---

## §5 `NOT_MEASURED` 逐项（禁填 0/空）

本单探针**已在实机跑通**（§3 为真实读数），但下列维度**本次确实没有量测**，如实登记（每项写明未测原因与现有替代证据；一律不以 0 或空代替）：

1. **Tailwind CDN 生效环境（线上真实形态）下的 rect** —— `NOT_MEASURED`。原因：探针按边界**刻意 abort 全部外部 CDN**（换取确定性与离线可复现），该跑 `page_errors` 明确报 `tailwind is not defined`；线上环境 rect 需另立一次允许外网的量测。替代证据：§3 的 14 元素在仓内 CSS 下逐值相等。
2. **Google Fonts 生效时的文本度量** —— `NOT_MEASURED`。原因：`fonts.googleapis.com` 被 abort，`document.fonts.ready` 只等到本机回退字体；真实字体下的行高/文本推进宽度未测。替代证据：`EXCLUDED_FROM_THEME` 第 1–3 条已把 font-family / letter-spacing / font-size 收敛为两档同值常量，从设计上消除该维度对同构的影响。
3. **768–1023px 过渡档** —— `NOT_MEASURED`。原因：本单臂集只覆盖 1440×900 与 390×844 两档（按任务口径）。现有证据：过渡档沿用宽屏同一套 DOM（`breakpoints.js:8` 口径），结构不新增骨架。
4. **其他宽屏取值（1024 / 1280 / 1920）** —— `NOT_MEASURED`。原因：同上，臂集未覆盖。现有证据：x/y 全部以 28/8 偏移与 1440 上限栅格表达（`shell-max-w=1440px`）。
5. **deviceScaleFactor ≠ 1（Retina 2x）** —— `NOT_MEASURED`。原因：探针固定 `deviceScaleFactor: 1`（换 2x 会让 rect 出现 .5 亚像素，属另一量测口径）。
6. **日/夜过渡态（CSS transition 中间帧）的 rect** —— `NOT_MEASURED`。原因：稳定帧协议**刻意排除**过渡态（连读两次相同才采信）。这是设计选择：同构判据只对稳定态成立。本单未记录过渡期任何读数。
7. **四语前缀（`/zh|/en|/hk|/vn/theme-preview`）下的 DOM 差异** —— `NOT_MEASURED`。原因：探针只访问默认无前缀路径 `/theme-preview`。现有证据：locale 只改文本不改结构（`nav.js` 的 `labelKey` 取自四语 69 键同集）。
8. **Safari / Firefox 引擎** —— `NOT_MEASURED`。原因：本机仅测 Chrome `154.0.8037.58`（且**单次观测**，§5.7 第 8 条：单次绿不得推翻多次观测，故本报告不把单跑当跨引擎结论）。
9. **登录态（`profile` 导航项渲染）时的 rect** —— `NOT_MEASURED`。原因：探针未登录，`visibleNavItems` 过滤掉 `profile`；签名里因此只有 4 个 tab。
10. **触摸/真机移动浏览器** —— `NOT_MEASURED`。原因：探针为桌面 Chrome 的视口模拟，非真实移动设备。

**未测即未测**：以上 10 项均不填数值；报告正文任何其余「实测」字样均可在 §3/§4 找到支撑读数，或可由 §6 给出的命令复现。

---

## §6 探针自曝与失败路径

**探针设计（`frontend/scripts/p4z-b4c-geometry.mjs`，246 行）**

- **无服务、无端口**：不开 dev/preview server；`page.route('**/*')` 把 `http://sf.local/**` 映射到 `frontend/dist` 磁盘文件（MIME 按扩展名给定，目录/缺失路径回落 `index.html`）。
- **外部资源一律 abort**：非 `sf.local` 源（Google Fonts / Tailwind CDN / jsDelivr 等）全部 `route.abort()`，并在产物里登记被拦来源，量测环境完全本地化、确定性。
- **稳定帧协议**：每次读数连续两次 `getBoundingClientRect` 逐字节相同才采信（最多 40 轮 × 250ms），避免采到过渡态；稳定轮数写进 `arms.*_stable_reads`。
- **臂设计**：日档 A1（基线）→ 日档 A2（可重复性）→ 1px 扰动（`[data-sf-m="chips"]` 注入 `padding-top:1px`）→ 复原 → 夜档 → 回日档（回基线）→ 1440 横屏 → 390 竖屏 → 回 1440。
- **浏览器**：首跑失败事实（`b4c-20260930T210239/geometry-probe.stdout.json`）：`Executable doesn't exist at .../chromium_headless_shell-1208/...`（本机 Playwright 缓存为 1228；**按边界禁止 `npx playwright install`**）。修法：`chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })` —— 用本机真实 Chrome，Playwright 起**独立临时 profile**，不触碰用户自己的 Chrome profile，探针结束即 `browser.close()`。
- **失败模式清单**：① `__sfThemePreview` 未挂载 ⇒ 30s 超时；② 读数不稳定 ⇒ `unstable: <label>`；③ 任一路由/资源 404 ⇒ `page_errors` 数组登记；④ 探针只写 `backend-ts/.p4-artifacts/b4c-*/geometry.json`，失败时 `process.exitCode=1` 且不留半个 JSON。
- **口径自律（§5.7）**：退出码不取自管道之后（`cmd; echo EXIT=$?`）；本机无 `timeout/gtimeout`，故不在外部限时；读数异常先怀疑探针自身（已按此把首跑失败定位到浏览器路径而非页面）。

---

## §7 可交互预览件打开方式

- 路由：`/theme-preview`（`frontend/src/App.jsx` 已注册；页面 = `frontend/src/pages/ThemePreviewPage.jsx` + `theme-preview.css`）。
- 四语前缀（沿用既有 `buildLangPath`/`SUPPORTED_LANGS` 机制，不另造一套）：`/theme-preview`（zh 默认无前缀）、`/zh/theme-preview`、`/en/theme-preview`、`/hk/theme-preview`、`/vn/theme-preview`。
- 日/夜切换：页面内切换项走 `ThemeProvider` 口径（`localStorage['theme']` + `<html data-theme>`），刷新后保持；不产额外 DOM。
- 本地起服：本单**不得**启停常驻 server，故未起服；需要看时由面板 `{sid}` 路由启 `frontend` 的 dev/preview 服后再访问上述路径。

---

## §8 边界自证

- **本单只写**：`frontend/scripts/p4z-b4c-geometry.mjs`（探针，本单新建，仅在被证明必需时才动）、`docs/audit/p4-b4c-theme-shell.md`（本文件）、`backend-ts/.p4-artifacts/b4c-20260930T210239/**`（读数与日志）。`frontend/src/**` 仅在探针需要极小修正时动（如有，见 §6 记录）。
- **未碰**：`backend-ts/src/**`（含正被另一单修改的 `index.ts`）、`migrations/**`、任何 spec、`docs/seafood.master-plan.md`、`.env.local`、既有 audit/qa 件、`docs/design/style-preview.html`（只读，仅被 `grep`/回读）、**token 值本身**（107 键值与 STRUCT 常量未改）。
- **未做 git 写**：无 `git add/commit/push`。
- **未启停任何服务**：无 `npm run dev/preview`、无端口占用、无 `pkill/killall`。
- **未下载浏览器**：无 `npx playwright install`、无 `npm install`。
