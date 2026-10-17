# 生产终验 · seafood 0xseafood.com（2026-10-17 · 首页卡片 UI §22/v1.20 + 顶栏实黄 §23/v1.21）

**执行 = Zang（Director · 终审）· 方式 = curl 绕本机 DNS 劫持（`--resolve 0xseafood.com:443:76.76.21.21`）+ 真浏览器 CDP 探针打生产域 · 无数据库迁移（纯前端，无需先 apply）**

## 0. 上线

| 项 | 值 |
|---|---|
| push | `d8cb98e..05f6612  main -> main`（PUSH_EXIT=0）|
| 本地 HEAD | `05f66123c4f33a867e1c2c4fb42234fb75226628` |
| origin/main | `05f66123c4f33a867e1c2c4fb42234fb75226628`（待推 = 0）|
| 推送前对账 | 4 笔（`4b388d0` 卡片改造 / `ad52533` 规范 v1.20d+§23 / `c412c7e` 顶栏实黄 / `05f6612` 证据入库），未被并发会话代推 |

## 1. 同版证明（比只核新串更硬）

| 项 | 线上 | 本地 | 判 |
|---|---|---|---|
| HTML 引用产物名 | `assets/index-UdAFWx1k.css` · `assets/index-_MHXbVv1.js` | 同名 | ✅ 逐字同名 |
| `index-UdAFWx1k.css` sha256 | `9bc5459a8863d43a6eac62697df4746fdfbb577db00ab51146412ccc8d03586d` | 同 | ✅ 逐字节相同 |
| `index-_MHXbVv1.js` sha256 | `9abb333758f65ca80c1af851d762e59bad42d0dfb31b58403f10c311d075e27d` | 同 | ✅ 逐字节相同 |

⇒ **线上跑的就是本地这一版**。prod HTML 于 push 后 ~75s 绕缓存（`Cache-Control: no-cache` + `Pragma: no-cache`）取得，`http=200 size=7908`；已落盘 `readings/prod-index-after.html`（改前基线 = `prod-index-before.html` / `prod-index-prepush.html`，产物名为 `index-C3dRJ_m4.js` / `index-D4sieLPp.css`）。

## 2. 新规则真的进了产物（线上 CSS 现取，先落盘再 grep）

| 串 | 命中 |
|---|---|
| `f5f7f9`（日档页底新值）| **1** |
| `101114`（夜档 `--sf-surface-bg`）| **1** |
| `sf-surface-bg` | **1** |
| `brand-fg`（顶栏前景 token）| **1** |

关键规则原文（压缩器已去引号/空格）：

```
:root:not([data-theme=dark]) #header .sf-topbar-brand,
:root:not([data-theme=dark]) #header .sf-topbar-hover-brand-fg:hover{color:var(--sf-brand-fg)}
```

```
.sf-reward-card.sf-reward-card{--sf-price-cur-fg: #030402;--sf-price-num-fg: #030402;--sf-price-unit-fg: #3A3A2A}
```

`backdrop-filter` 取值集合含 `none`（日档顶栏生效值）与 `blur(4px)`（夜档既有值）。

> ★ **取数教训（当场踩到）**：压缩器会把 hex **转小写**、把属性选择器的**引号去掉**（`[data-theme="dark"]` ⇒ `[data-theme=dark]`）⇒ 拿源码原文去 grep 产物会**假阴性**（本次 `F5F7F9` 与带引号的选择器首轮均命中 0）。判产物一律用**大小写不敏感**匹配。

## 3. 真浏览器探针（★ 必做腿：curl/sha256 看不到白屏）

CDP 注入 `error` / `unhandledrejection` 钩子（`Page.addScriptToEvaluateOnNewDocument`）后打开生产域：

| 判据 | 读数 | 判 |
|---|---|---|
| 页面身份 | `title = 🐴 Seafood 海鲜市场\|加密人自己的「闲鱼」` · `url = https://0xseafood.com/` | ✅ 真生产域 |
| **白屏判据** | `#root` `childElementCount = 2`、`innerHTML.length = 34817` | ✅ 非空 |
| **未捕获异常** | `window.__errs = []` | ✅ 零 |
| 引用产物 | `scripts = ['/assets/index-_MHXbVv1.js']` | ✅ 同版 |
| 顶栏实黄 | `#header` `backgroundColor = rgb(253,232,21)`；`borderBottom = rgb(3,4,2) / 1px` | ✅ |
| logo 前景 | `rgb(10, 10, 10)`（= `--sf-brand-fg` 日档） | ✅ |
| 底色分层 | `.sf-shell = rgb(245,247,249)` · `.sf-route-container = rgb(255,255,255)` | ✅ |
| 整卡可点击 | 卡根 `tagName = A` · `href = /item/1` · 卡内 `a,button,input,select,textarea` = **0** | ✅ |
| 价格块 | `text = "$1"` · `$` `18px`/`rgb(3,4,2)` · 数字 `24px`/`rgb(3,4,2)` · 高度比 **0.75** · `rect.bottom` 差 1.02px（= 字号差 × descender ⇒ **baseline 对齐的正常后果**，非堆叠） | ✅ |
| 线上卡片数 | `[data-sf-m="reward-card"]` = **4** | ✅ 与 `/api/prize/all` 4 行一致 |

## 4. 生产哨兵（回归面）

| 端点 | 读数 | 判 |
|---|---|---|
| `/api/health` | `ok:true` · `schema_version 0048` · `time 2026-10-17T01:33:31Z` | ✅ 与 push 前一致（本笔无迁移）|
| `/api/task/all` | `http=200 size=1284` · 行数 **3** | ✅ 与基线一致 |
| `/api/prize/all` | `http=200 size=4835` · 行数 **4** | ✅ 与基线一致（含 Kevin 指定测试商品 `bID 1 = VPN月卡`）|

## 5. 诚实清单

| # | 项 | 状态 |
|---|---|---|
| 1 | 真机（手机浏览器）观感 | `NOT_MEASURED`（本机 headless + 本地 H5 预览，未过真机）|
| 2 | 边缘缓存旧 HTML | 已绕缓存复取（`no-cache` + `Pragma`）；首次取数在 push 后 ~75s，产物名已为新版 ⇒ 无「旧 HTML」伪影 |
| 3 | 生产 `/messages` 直链落点 | 属首页 + 面板（`MessagesPage.jsx:15 = () => <HomePage/>`），本笔未另行探针 |
| 4 | 夜档生产观感 | 本笔夜档顶栏为**冻结现状**（`rgb(31,41,55)`，由 Neng 独立复检 20 格 + 反向臂证明）；生产域探针本次未切夜档复测 |
| 5 | 挂账 | 「夜档另议」（整卡配色 / 夜档顶栏是否改挂 token）/ 夜档小标题深浅对比 / 稀有度光斑↔价格重叠 / 回落态 CTA 键盘可达性 / 移动面板「登录」胶囊 2.77:1 —— 均另立单 |
