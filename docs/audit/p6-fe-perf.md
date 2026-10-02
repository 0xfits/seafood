# P6-FE-PERF · Tailwind 运行期 CDN → 构建期编译（收尾单 FE-PERF-2）

- 仓：`/Users/kevin/bistro/seafood`，前端 `frontend/`；执行：Kong
- 本单口径：**视觉等价对照（生产改前 vs 本地改后）+ CDN 拦截判负 + 单测判负 + Node 原生绑定治理**
- 产物指纹（本单实测，`npm run build`）：`dist/assets/index-Agz5bsuy.js` (306.01 kB / gzip 86.38)、
  `dist/assets/index-C0Rsh61M.css` (125.40 kB / gzip 23.57)
- 受测本地实例：`vite preview` @ `http://localhost:5791`（新构建）；基线：`https://seafood-opal.vercel.app`（**改前** CDN 构建，实测引用 `assets/index-BhUTen4K.js` + `cdn.tailwindcss.com`）
- **未做任何 git 写操作**（本仓推送即上线）；未触碰 `5787`（面板常驻实例，实测仅 `5788` 在听，见 §9）

---

## 1. 验收读数（AC 自跑，退出码直接取自命令本身）

| # | 命令 | 读数 | 退出码 |
|---|---|---|---|
| ① | `npm run build` | `✓ built in 1.57s`；`>500 kB` 告警 = 0 | **0** |
| ② | `npm run test:unit` | `Test Files 25 passed (25)` / `Tests 231 passed (231)`（含本单新增 `p4z-feperf.test.js`） | **0** |
| ③ | `node scripts/p6-tr2-i18n-locales.mjs` | `[TR-2] 总判：PASS` | **0** |
| ③ | `node scripts/p4z-i18nviol-global.mjs` | `[I18N-VIOL] 总判：PASS（locale 裸命中 0 + 源面裸命中 0；作用域节点 locale=2732 / source=37）` | **0** |
| ④ | `node scripts/p4z-feperf-safelist.mjs` | `safelist_count=29`、`dynamic_count=24`、`dynamic_missing_from_safelist=[]`、`safelist_missing_in_dist=[]`、`dynamic_missing_in_dist=[]`、`micro_legacy_literal_in_css=false`、`VERDICT=PASS` | **0** |
| ⑤ | 视觉等价 / 拦截实验 | 见 §5、§6 | — |

单测下限对照：改前 24 files / 219 passed → 本单 **25 files / 231 passed**（+12 条，均来自新增文件）。

---

## 2. CDN 三处盘点表（迁出物 + 现状）

| # | 位置 | 改前形态 | 现状 / 证据 |
|---|---|---|---|
| ① | `index.html` `<script src="https://cdn.tailwindcss.com">` | 运行期 JIT 全量生成工具类 | **已删**。`index.html` 可执行引用中该域名 = 0（`p4z-feperf.test.js`"index.html 不再引入 tailwind CDN"）；文件内仅在**注释**里留迁出说明（`index.html:9-10`）。改前基线实测该 `<script>` 存在（见 §6） |
| ② | `index.html` 运行期 `tailwind.config.theme.extend.colors` 六项 | `primary/secondary/accent/success/warning/error` 运行期注入 | **已迁到构建期**：`src/styles.css:18-25` 的 `@theme`（v4 CSS-first）；`p4z-feperf-verify.mjs` 口径下 6 色全部落产 |
| ③ | 运行期拼接类（CDN 能看到 DOM 里长出来的类，构建期静态扫描看不到） | 运行期 JIT 自动补 | **改为 `@source inline(...)` safelist**：`src/styles.css:32`（29 条）+ 动态类名清单（§4） |

保留不动（非 Tailwind）：FontAwesome(cdnjs)、jsDelivr/Google Fonts 字体链。

---

## 3. 分包（改前 → 改后）

| chunk | 改前 | 改后 |
|---|---|---|
| 入口 `index-*.js` | **555.08 kB** | **306.01 kB**（gzip 86.38） |
| `vendor-react` | — | 142.17 kB（gzip 45.58） |
| `vendor-i18n` | — | 53.54 kB（gzip 16.61） |
| `vendor-ui` | — | 32.62 kB（gzip 9.50） |
| `vendor-router` | — | 12.64 kB（gzip 4.64） |
| `vendor` | — | 9.11 kB（gzip 4.01） |
| CSS | 运行期 CDN（无产物） | 125.40 kB（gzip 23.57） |

`>500 kB` 告警：改前有 → 改后 `grep -c` = **0**。

---

## 4. 动态（运行期拼接）类名清单（`p4z-feperf-safelist.mjs` 现取，24 条）

| 来源 file:line | 表达式 | 可达取值（受守卫约束） |
|---|---|---|
| `src/components/ui/Responsive.jsx:54` | `` `md:${gridClasses[md]}` ``（守卫 `md >= 2`） | `md:grid-cols-2/3/4/6` |
| `src/components/ui/Responsive.jsx:55` | `` `lg:${gridClasses[lg]}` ``（守卫 `lg >= 3`） | `lg:grid-cols-3/4/6` |
| `src/components/ui/Responsive.jsx:56` | `` `xl:${gridClasses[xl]}` ``（守卫 `xl >= 4`） | `xl:grid-cols-4/6` |
| `src/components/ui/Responsive.jsx:105` | `` `md:${sizeClasses[md]}` ``（`md !== sm`） | `md:text-xs/sm/base/lg/xl/2xl/3xl` |
| `src/components/ui/Responsive.jsx:106` | `` `lg:${sizeClasses[lg]}` ``（`lg !== md`） | `lg:text-xs/sm/base/lg/xl/2xl/3xl` |
| `src/components/ui/MicroInteractions.jsx:14` | `'scale-[1.05]'`（本单已从 `` `scale-${scale}` `` 改为任意值形态） | `scale-[1.05]` |

- 24 条全部 ∈ safelist，且全部在产物 CSS 里能按转义形态找到（`dynamic_missing_in_dist=[]`）。
- safelist 29 条 = 上表 24 条的可达值去重后 + 保守超集（`lg:grid-cols-1/2` 等守卫不可达项仍保留，只多不少）。

### safelist 承重证据（`xl:grid-cols-4`）

- 该字面量在 **`src/**` 里出现 0 次**（单测 `literal === []` 断言，逐文件读内容过滤；`src/test` 已排除）；
- 产物 `dist/assets/index-C0Rsh61M.css` 里 **存在** `.xl\:grid-cols-4`（单测 `cssHasToken(css,'xl:grid-cols-4') === true`）；
- ⇒ 产物里那条**只可能来自 `@source inline` safelist**（同口径：`md:grid-cols-2`→2、`md:grid-cols-6`→1、`lg:grid-cols-4`→1、`md:text-2xl`→1、`lg:text-3xl`→1；`xl:text-2xl`→0，正确——safelist 本无 `xl:` 文本类）；
- 更强一档（本单新证）：**运行时探针**里 `xl:grid-cols-2`（同样只存在于 safelist）在 1280 视口下确实生效（`grid-template-columns` = `588px 588px`）⇒ safelist 不只是"落产"，是**真的承重**。

---

## 5. 视觉等价对照（改前生产站 vs 改后本地构建）

**口径（可复现）**：CDP `Emulation.setDeviceMetricsOverride(1280×900, dsf=1)`；每路由取 `body *` 中 `rect.w≥4 && rect.h≥4` 的元素，**前 250 个 DOM 序**；元素签名 = `tag:nth-child 链`；逐元素比 `getComputedStyle` 26 个关键属性 + `getBoundingClientRect`（0.5px 舍入）。
**噪声基线**：同一本地页面在同一 URL（`?blk=1`）连测两次 ⇒ `diff_elems=18, rect_changed=5`（全部来自入场动画 `animate-fade-in/…-slide-up` 与异步内容块）。差异数 ≤18 即落在噪声内。

| 路由 | 可见元素（改前/改后） | 匹配元素 | 有差异元素 | 仅改前 / 仅改后 | class 串不一致 |
|---|---|---|---|---|---|
| `/` | 476 / 476 | 250 | 250 | 0 / 0 | **0** |
| `/login` | 105 / 105 | 105 | 105 | 0 / 0 | **0** |
| `/task` | 608 / 608 | 250 | 250 | 0 / 0 | **0** |
| `/listing` | 254 / 254 | 250 | 153 | 0 / 0 | **0** |
| `/shard` | 109 / 109 | 109 | 89 | 0 / 0 | **0** |

DOM 结构/可见元素数/`class` 串 **100% 同构**（5 路由 class 串不一致数全为 0）⇒ 差异全部来自 CSS 解析结果，不是内容差异。逐条归因：

| # | 差异面 | 命中元素数 | 归因 | 视觉影响 |
|---|---|---|---|---|
| A | `borderTopColor` | **791** | v3 preflight `*,::before,::after{border-color:gray-200}` → v4 改为 `currentColor`（v4 破坏性变更） | **0**：其中 `border-width>0` 的仅 **5** 个，其余 786 个边框宽度为 0（不渲染） |
| B | 响应式网格列数（`grid-template-columns`） | **2**（`/`） | **本单真 OPEN 缺陷，见 §7** | **可感**：`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` 改前 4 列(276px×4) → 改后 **3 列**(376px×3)；`… lg:grid-cols-4 xl:grid-cols-4` 改前 4 列 → 改后 **2 列**(576px×2) |
| C | 由上派生：`width`/`height`/`x` | `width` 78+82、`height` 23+20、`x` 11/组 | B 的派生（卡片变宽、换行变多 ⇒ 页面变高，如 `/` 根容器 2092px → 2952px）；含少量异步内容块噪声 | 同 B |
| D | `boxShadow` 槽数与 `shadow-md` 取值 | 8+2+2 | ① 序列化：v3 三槽（`--tw-ring-offset-shadow/--tw-ring-shadow/--tw-shadow`）→ v4 单槽（空槽不渲染，等效）② `shadow-md` 取值改由 `src/styles/tailwind-compat.css:496` 的手写值决定（改前被 CDN 的 v3 值盖住）⇒ 扩散差 1–2px | 极小（1–2px 阴影扩散） |
| E | `backgroundColor` | 6 | v3 hex → v4 oklch 序列化，**同色**（例：`green-400` 改前 `rgb(74,222,128)` vs 改后 `oklch(0.792 0.209 151.711)`） | 0（同色不同写法） |
| F | 5 个"有可见边框"元素中的颜色 | 5 | 3 例 = 同色序列化（如 `amber-200`：`rgb(253,230,138)` ↔ `oklch(0.924 0.12 95.746)`）；1 例**确实不同色**（`/login` 同 class 串：改前 `#F3F4F6`(gray-100) vs 改后 `#BFDBFE`(blue-200)）⇒ 归因为**同一元素上冲突工具类的胜者随样式表次序改变**（改前 CDN 注入的 `<style>` 在 bundle 之后 ⇒ 由 CDN 胜；改后由 bundle 内次序决定）；1 例 ΔRGB=(1,10,0) **未判定**（见 §8 NOT_MEASURED） | 3 例 0；1 例可感（浅灰→浅蓝描边）；1 例待判 |
| G | `opacity`/`transform` | 9 / 4 | 入场动画采样时刻不同 ⇒ **测量噪声**（噪声基线内） | 0 |

---

## 6. CDN 拦截判负实验（改后必须有 0）

**机制**：CDP `Network.setBlockedURLs(urls=['*cdn.tailwindcss.com*'])`（**未改**系统 DNS/hosts；结束时已清空）。请求计数 = `Network` 域事件里 URL 命中该域名的事件数（`drain_events`）。

| 侧 | 路由 | 该域名请求事件数 | `script[src*="tailwind"]` | resource-timing 该域名条目 | 拦截前后元素差异 |
|---|---|---|---|---|---|
| **改后本地** | `/` `/login` `/task` `/listing` `/shard` | **0 / 0 / 0 / 0 / 0**（不拦截时同样 0/0/0/0/0） | **false** | **0** | **diff_elems = 0、rect_changed = 0**（同 URL `?blk=1` 同口径；噪声基线 18/5） |
| **改前生产站** | `/` `/login` `/task` `/listing` `/shard` | **1 / 1 / 1 / 1 / 1**（被拦，`transferSize=0`） | true | 2 | **diff_elems = 964/964、rect_changed = 959**；首轮拦截时页面塌到 **20** 个可见元素 |

- 改后 ①该域名请求数 **= 0** ②拦截与不拦截 **逐值等价（0 差异）** ③与改前对照：改前 964/964 → 改后 **0/0** ✓
- 说明：改前单记的 `/login` 151/151 与本单口径（105/105，元素过滤器+视口不同）不可直接相减；本单以自口径重测，结论方向一致（全量不一致）。

---

## 7. 真 OPEN 缺陷 #1：`tailwind-compat.css` 的**无层**手写工具类压过构建期产物

- 现象（实测）：`ResponsiveGrid`/网格容器上 `lg:`/`xl:` 断点在改后**不生效**，胜出的是 `md:`/`lg:grid-cols-3` 这一小撮（§5-B）。
- 证据链：
  1. `src/styles/tailwind-compat.css` 手写了 `.md\:grid-cols-2/3/4`（699–701 行）、`.lg\:grid-cols-3`（716 行）等规则，**没有** `lg:grid-cols-4`，**没有任何 `xl:`** 网格/文本规则（全量 grep）；
  2. 隔离探针（同一页面、新建元素、逐个类）：`lg:grid-cols-4`→4 列 ✓、`xl:grid-cols-4`→4 列 ✓、`xl:grid-cols-2`→2 列 ✓、`lg:text-3xl`→30px ✓、`md:text-2xl`→24px ✓ ⇒ safelist 生成的类**本身没问题**；
  3. 组合探针（页面真实 class 串）：`… md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` → 3 列；`… md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4` → 2 列 ⇒ 胜者恰好是 compat 手写的那一小撮。
  ⇒ 结论：compat 的手写规则（`@import "tailwindcss"` 之外、**未被 `@layer utilities` 收纳**）在同特异性下优先于分层生成的工具类；改前 CDN 注入的 `<style>` 位于 bundle 之后，把它**掩盖**了，所以迁移到构建期后暴露。
- 修复方向（未做，越界）：把 compat 层的响应式类删除，或整体包进 `@layer utilities`，或改用 `@source inline` 覆盖缺失值。**本单硬边界不允许改该文件** ⇒ 登记为 OPEN，归 Kong/后续单。

## 8. 真 OPEN 缺陷 #2：`scale-${scale}`（已在本单修复）

- `MicroInteractions.jsx:14` 原为 `` isHovered && `scale-${scale}` ``（默认 1.05）⇒ 运行期拼出 `scale-1.05`：**v3 CDN 与 v4 都不产出该条**（`scale-<number>` 只吃整数）⇒ 改前改后该 hover 缩放**都不存在**（真缺陷，不是迁移引入）。
- 本单改法：`'scale-[1.05]'`（任意值形态），并同步 safelist（去 `scale-1.05`、加 `scale-[1.05]`）；`HoverCard` 的 `scale` prop 已无引用（全仓 grep：无调用方）故一并移除，避免 `no-unused-vars`。
- 证据：① 产物含 `.scale-\[1\.05\]`（`grep` + 单测断言）② 运行时探针 `class="grid scale-[1.05]"` → `scale: 1.05` ✓（改前生产站同探针 `scale: none`）③ 产物含 `.scale-1.05` = **0**。

---

## 9. 坑与治理（含 Node 原生绑定）

### 9.1 Node 18 ⇒ `@tailwindcss/oxide` 原生绑定被跳过（**fresh clone 在本机必失败**）

- 取证：`node -v` = **v18.19.0**；`node_modules/@tailwindcss/oxide/package.json` → `version 4.3.3`、`engines {"node": ">= 20"}`；`node_modules/@tailwindcss/` 下有 `node/ oxide/ oxide-darwin-arm64/ vite/`（`oxide-darwin-arm64` 是**上一单手工 `curl | tar` 补入**的，manifest/lockfile 未改）。
- 后果：npm 静默按 `engines` 跳过原生绑定（EBADENGINE）⇒ `vite build` 报 `Cannot find native binding`。
- 治理（本单落地的最小无害项）：`frontend/package.json` 增加 `"engines": {"node": ">=20"}`（声明式，不改系统 node、不改全局 npm 配置、不动 lockfile）。
- **写在报告里的操作事实**：本机构建需 **node ≥ 20**，或按上一单方式手工补 `node_modules/@tailwindcss/oxide-darwin-arm64`；Vercel 侧构建镜像为 Node 24，无此问题。

### 9.2 扫描污染：Tailwind v4 的自动内容探测会扫 `src/**`（含 `src/test`）

- 实测复现：把判负清单写成字面量（`md:grid-cols-8` / `xl:grid-cols-8` / `md:text-9xl`）放进 `src/test/unit/p4z-feperf.test.js` 后，产物 CSS 里各出现 **1** 次（判负用例**自己**把类构建进了产物，判负自毁）；改为字符串拼接（`'grid-cols-' + '8'`）并重建后 = **0**。
- 同理，承重探针 `xl:grid-cols-4` 一旦在测试文件里写成字面量，"源码里无该字面量"的前提就被自己破坏 ⇒ 也必须拼接书写。
- 既有防护：`src/styles.css:38-40` 的 `@source not "../scripts" / "../dist" / "../../docs"`（上一单已加，本单实测有效）。
- 单测/脚本里已固化这条纪律（`p4z-feperf.test.js` 顶部注释 + 拼接常量）。

### 9.3 级联次序变化（改前 CDN 在 bundle 之后）

- CDN 注入的 `<style>` 位于 bundle `<link>` 之后 ⇒ 同特异性下 CDN 胜，掩盖了 `tailwind-compat.css` 与 bundel 内自定义 CSS 的缺口（§7、§5-F、§5-D）。迁移后任何"同特异性双定义"的地方胜者都可能翻转 ⇒ 后续如遇样式"莫名变了"，先查是否双定义。

---

## 10. 新增/修改文件

| 文件 | 动作 |
|---|---|
| `frontend/src/components/ui/MicroInteractions.jsx` | 改 `:14` → `'scale-[1.05]'`；移除已无引用的 `scale` prop |
| `frontend/src/styles.css` | **仅** safelist 那一行（`:32`）：去 `scale-1.05`、加 `scale-[1.05]` |
| `frontend/package.json` | **仅**新增 `engines.node`（§9.1） |
| `frontend/src/test/unit/p4z-feperf.test.js` | 新增（12 条：safelist 覆盖 / 落产 / 承重 / 动态清单闭环 / 3 组判负 / CDN 硬约束 / 微观交互） |
| `frontend/scripts/p4z-feperf-safelist.mjs` | 新增（safelist 与动态类名**单一真源**；被单测 import） |
| `frontend/scripts/p4z-feperf-cssorder.mjs` | 新增（产物 CSS 的 @layer/@media 归属扫描器；**已知漏检**：块内首个选择器，见 §11） |
| `docs/audit/p6-fe-perf.md` | 本文件 |

> `src/styles.css:31` 的注释仍写着"`scale-${scale}` … v4 均不产出该条"（现在该写法已不存在）——属**注释过期**，因硬边界"仅 safelist 那一行"未改，登记为待办。

---

## 11. NOT_MEASURED（禁填 0/空）

| 项 | 原因 |
|---|---|
| 像素级对照（截图 diff / SSIM） | 本单口径为 DOM + computedStyle + rect，无像素回归基线，未做 |
| 采样截断部分 | `/`(476)、`/task`(608)、`/listing`(254) 只比对了 DOM 序前 250 个可见元素，尾部未逐元素比对 |
| §5-F 中 ΔRGB=(1,10,0) 那一例的具体来源 | 未判定（时间/预算） |
| 移动端断点（375/768）与暗色档 | 未测（只测 1280×900 日档） |
| CSSOM 字符序位 / `@layer` 归属的机器读数 | `p4z-feperf-cssorder.mjs` 扫描器漏检"块内首个选择器"，未取到确证读数；§7 的判定依据是 compat 定义集 grep + 隔离/组合探针实测 |
| 生产站是否已部署改后构建 | 未测（`seafood-opal.vercel.app` 仍为 `index-BhUTen4K.js`，即改前基线本身） |
| LCP/TBT/CLS 等运行时性能指标 | 未测（本单只做体积与样式等价） |
| `frontend/package.json` 加 `engines` 后 Vercel 构建行为 | 未测（本机不触发；未执行 `vercel` 命令） |

---

## 12. 复现命令

```bash
cd frontend
npm run build                                   # 0；产物 dist/assets/index-*.{js,css}
npm run test:unit                               # 231 passed
node scripts/p6-tr2-i18n-locales.mjs            # PASS
node scripts/p4z-i18nviol-global.mjs            # PASS
node scripts/p4z-feperf-safelist.mjs            # safelist/dynamic 清单 + VERDICT
node scripts/p4z-feperf-cssorder.mjs            # 产物 CSS 的 @layer/@media 归属（漏检见 §11）
npx vite preview --port 5791 --strictPort       # 本地改后实例（勿用 5787）
```
视觉/拦截取数：CDP（`Emulation.setDeviceMetricsOverride` + `Network.setBlockedURLs` + `Network` 事件），
两侧分别是 `http://localhost:5791`（改后）与 `https://seafood-opal.vercel.app`（改前）。

---

## 13. P6-FE-PERF-3 · 把构建期化暴露的 2 处真视觉差异减到 0（Kong，追加单）

**口径**：`Emulation.setDeviceMetricsOverride(1280×900 / 1600×900, dsf=1)`；每路由取 `body *` 中 `rect.w≥4 && rect.h≥4` 的 **前 250 个 DOM 序**元素；签名 = `tag:nth-child 链`；逐元素比 `getComputedStyle` **30 个属性** + `getBoundingClientRect`（0.5px 舍入）。基线 = 生产 `https://seafood-opal.vercel.app`（改前，v3 CDN），受测 = 自起 `vite preview` @ `http://localhost:5791`（改后；5787 未碰）。
**本单新增的渲染稳定判据（必须）**：取数前轮询 `document.querySelectorAll('body *').length` 至**连续两次相同**（≤6s）再读；否则 1280 下会取到未渲染完的页面（实测：只等 1.2s 时 `/` `/task` `/listing` 出现 onlyProd≈176–210 / onlyLocal≈4–22 的**假 DOM 差异**，稳定后 5 路由 × 2 宽度 onlyProd/onlyLocal **全为 0/0**）。

### 13.1 修复①：响应式网格列数（真因 = 无层规则压过 `@layer utilities`）

复现读数（合成探针元素 `class="grid grid-cols-1 <探针>"`，1280 视口；"真实容器"= `/` 上两个网格容器的实测列数）：

| 探针 class | 改前(生产) | 改后未修 | 改后已修 |
|---|---|---|---|
| `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`（=`/` 真实容器串） | **4** | **3** | **4** |
| `lg:grid-cols-4 xl:grid-cols-4`（=`/` 真实容器串） | **4** | **2** | **4** |
| `lg:grid-cols-3` | 3 | 3 | 3 |
| `lg:grid-cols-4` | 4 | 1 | **4** |
| `xl:grid-cols-2` | NOT_MEASURED（v3 play CDN 不产出源码未出现的类 ⇒ 回退 1 列） | 1 | **2** |
| `xl:grid-cols-4` | 4 | 1 | **4** |
| `xl:grid-cols-6` | NOT_MEASURED（同上） | 1 | **6** |
| `md:grid-cols-2` | 2 | 2 | 2 |
| 窄宽度 @900（仅 md 档生效） | 未测（生产侧无 900 读数） | — | 2 / 2 / 1 / 1 / 1 / 1 / 1 / 2（按档位回退正确，未"修好一个撞坏另一个"） |
| 真实容器 @1280 / @1600 | 4 + 4 / 4 + 4 | 3 + 2 / 3 + 2 | **4 + 4 / 4 + 4** |

修法（`src/styles/tailwind-compat.css`）：把 `.grid-cols-1/2/4`、`.md\:grid-cols-2/3/4`、`.lg\:grid-cols-3` 从**无层规则**搬进 Tailwind 已声明、位于 `utilities` **之前**的 `@layer components`（文件末尾统一成块）。语义 = 改前 CDN 时代（后注入的 CDN 规则胜），兜底规则保留、变体工具类可正常胜出；**未删除任何类**（避免 Tailwind 未产出该条时兜底丢失）。
产物落位实测（minified）：`…@layer base{…}@layer components{.grid-cols-1{…}.grid-cols-2{…}.grid-cols-4{…}@media (min-width:768px){.md\:grid-cols-2…}}@layer utilities{…` ⇒ components 在 utilities 之前 ✓。

### 13.2 修复②：v4 边框默认色破坏性变更

- **改前真值（现取）**：生产站所有元素的 `borderTopColor` = `rgb(229, 231, 235)` = `#e5e7eb`（v3 preflight `*,::before,::after{border-color:gray-200}`）；改后未修 = `currentColor`（如 `rgb(10,10,10)`）。
- 修法：`@layer base { *, ::before, ::after, ::backdrop { border-color: #e5e7eb } }`（**必须分层**：写成无层会连 `border-*` 工具类一起盖掉）。产物落位实测：该规则落在 base 层 preflight **之后**（`…[hidden]:where(:not([hidden=until-found])){display:none!important}*,:before,:after,::backdrop{border-color:#e5e7eb}}`）。
- **§5-A 那 5 个"宽>0"元素逐条对照**（改前 / 改后未修 / 改后已修；这三者都是**显式 `border-*` 色类**，不受默认值影响）：

| 路由:元素 | class | 边框宽 | 改前 | 改后未修 | 改后已修 | 判定 |
|---|---|---|---|---|---|---|
| `/`:…`section:1>div:1` | `rounded-xl border-2 p-6 transition-all …`（黄色档） | 2px | `rgb(254,240,138)` | `rgb(253,230,138)` | `rgb(253,230,138)` | 旧·**未判定**（= §5-F 的 ΔRGB(1,10,0)，非本单引入） |
| `/task`:…`div:4>div:1` | 同上 | 2px | `rgb(254,240,138)` | `rgb(253,230,138)` | `rgb(253,230,138)` | 同上 |
| `/login`:…`div:2` | `rounded-2xl border border-blue-100 …` | 1px | `rgb(219,234,254)` | `oklch(0.932 0.032 255.585)` | `oklch(…)` | 旧·**同色序列化**（§5-E/F） |
| `/login`:…`div:3` | `rounded-2xl border border-amber-200 …` | 1px | `rgb(253,230,138)` | `oklch(0.924 0.12 95.746)` | `oklch(…)` | 旧·**同色序列化** |
| `/login`:`main:2>…div:2` | `rounded-xl border-2 p-6 …`（显式灰/蓝冲突类） | 2px | `rgb(243,244,246)` | `rgb(191,219,254)` | `rgb(191,219,254)` | 旧·**冲突工具类次序**（§5-F） |

- **"减到 0"量化**：宽>0 的边框元素对**改前基线 354 组**；改后已修与改前仅剩 **10 处**记录（= 上表 5 个元素 × 2 宽度，全部为显式色类）；其余 **344 组逐值相等**（含 23/9/27/98/21 组/路由）。**默认色**类差异（§5-A 的 791 例，含 786 个宽=0）→ 终测 `borderTopColor` 差异集里**再无一例默认色** ⇒ 默认色差异 **791 → 0**。

### 13.3 本单顺带发现并修复的同源第 3 处：`.container`（只在 1600 暴露）

改前生产站 header 内容宽 **1536px**（v3/v4 的 `.container` 在 ≥1536 视口都是 1536px）↔ 改后 **1280px**（compat 无层 `.container{max-width:1280px}` 压过 Tailwind 的 `.container`）。同 §13.1 手法并入 `@layer components`。
修后实测：`@1600 div:1>div:2>div:1>div:1>header:1>div:1` rect 改前 `[32,0,1536,64]` = 改后 `[32,0,1536,64]` ✓；`@1280` 两侧本来就都是 `[0,0,1280,64]`（故上一单 1280 口径看不到）。

### 13.4 全量视觉等价复跑（5 路由 × 2 宽度；逐条归因）

| 路由@宽度 | 匹配 / 仅改前 / 仅改后 | `gridTemplateColumns` | `borderTopColor` | `rect` | `boxShadow` | 其他属性 |
|---|---|---|---|---|---|---|
| `/` @1280 / @1600 | 239 / 0 / 0（两宽度同） | **0 / 0** | 1 / 1 | 222 / 222 | 8 / 8 | height 5、width 4、marginRight 6、paddingTop/Bottom 1/1、marginBottom 2、backgroundColor 6 |
| `/login` @1280 / @1600 | 105 / 0 / 0 | **0 / 0** | 3 / 3 | 88 / 88 | 6 / 6 | height 26、width 18、lineHeight 6、marginRight 7、backgroundColor 3、color 2… |
| `/task` @1280 / @1600 | 250 / 0 / 0 | **0 / 0** | 1 / 1 | 231 / 231 | 10 / 10 | height 11、width 4、marginRight 6、backgroundColor 7… |
| `/listing` @1280 / @1600 | 250 / 0 / 0 | **0 / 0** | 0 / 0 | 14 / 14 | 2 / 2 | width 4、marginRight 6 |
| `/shard` @1280 / @1600 | 109 / 0 / 0 | **0 / 0** | 0 / 0 | 14 / 14 | 2 / 2 | width 4、marginRight 6 |

⇒ **本单负责的 3 处（2 必修 + 1 发现）真视觉差异 = 0**：`gridTemplateColumns` 全 5×2 = 0（改前未修：`/` 上 2 列/3 列错档 + 派生宽度）；默认色 = 0；`.container` = 0。**DOM 同构**：5 路由 × 2 宽度 onlyProd/onlyLocal **全 0/0**（差异全部来自 CSS 解析，不是内容）。
**残余差异逐条归因（全部为改前既存、本单未引入）**：
1. **已归因（旧）**：`boxShadow` 槽位（v3 三槽 ↔ v4 单槽，空槽不渲染；56 处）｜`backgroundColor`/`color` 的 oklch/oklab **同色序列化**（32 + 4 处）｜入场动画采样（`animate-fade-in/slide-up` 派生 rect，噪声基线 18/5 内）｜webfont/度量类（语言按钮 `96↔104px`、`nav` `248↔256px`、`hidden md:flex` `566↔614px`、`marginRight 0↔4px`）——改前 FontAwesome/jsdelivr 字体保留，v3/v4 宽度计算与字体回退不同。
2. **未归因（旧，另单收口；本单未动这些规则）**：① `paddingTop/Bottom` `16↔32px`（元素 `w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:…`：compat **无层** `.py-4` 压过 `sm:py-8`，与 §13.1 **同根因家族**，实测该元素高度差 32px 并派生全页 y 位移）；② `marginRight 0↔4px`（compat 手写 `space-x-*` 用 margin-right，v3 用 `--tw-space-x-reverse` 归 0）；③ 上表 ΔRGB=(1,10,0) 那一例（上一单即 `NOT_MEASURED`）。三条都可按 §13.1 同一手法（无层 → `@layer components`）收口，但**本单未做**（预算/未验证不写结论）。

### 13.5 AC 自跑读数

| 项 | 读数 |
|---|---|
| `npm run build` | **exit 0**；产物 `dist/assets/index-BGBdnGHZ.js`(306.01 kB) + `dist/assets/index-bA7RGj51.css`(125,507 B) |
| `npm run test:unit` | **exit 0；25 files / 231 passed**（≥231 ✓） |
| `node scripts/p6-tr2-i18n-locales.mjs` | **PASS**（新接文件守卫 PASS；旧三目链/`??` 页面数 = 0） |
| `node scripts/p4z-i18nviol-global.mjs` | **PASS**（locale 裸命中 0 + 源面裸命中 0） |
| `node scripts/p4z-feperf-safelist.mjs` | **VERDICT=PASS** |
| 本地实例 | 自起 `npx vite preview --port 5791 --strictPort`（结束自停；**5787 未碰**） |
| 全量视觉等价 | 5 路由 × 2 宽度：`gridTemplateColumns` 差异 **0**、默认边框色差异 **0**、DOM 同构 **0/0** |

### 13.6 本单改动文件（未做任何 git 写操作）

| 文件 | 动作 |
|---|---|
| `frontend/src/styles/tailwind-compat.css` | ① `.grid-cols-*`/`.md\:grid-cols-*`/`.lg\:grid-cols-3` 由无层 → `@layer components`（末尾成块）② 新增 `@layer base{*,::before,::after,::backdrop{border-color:#e5e7eb}}` ③ `.container` 由无层 → `@layer components` |
| `frontend/src/styles.css` | **仅** `:31` 过期注释（`scale-1.05` → 说明实际已是字面量 `scale-[1.05]`）；§10 那行"注释过期"待办**本单关闭** |
| `docs/audit/p6-fe-perf.md` | 本 §13（追加，未改已有内容） |

> 全程未执行 `git add/commit/push`、未改 `index.html`/`vite.config.js`/`vercel.json`/locales/theme/backend/migrations/spec/`.env*`；未 `npm install`；未停/杀/占 5787；未用 `pkill -f`/`killall`（只按精确 PID 结束自起的 5791）。
