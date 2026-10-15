# Neng 独立质检读数（2026-10-15 16:0x CST，对象 = commit e0906dd）

质检人：Neng（独立质检；不采信 Kong/Zang 自报读数，全部本机现取复验）。
方法：四面独立复验 —— commit 面 / 构建面（含改前反事实重建）/ chunk 图面（双尺互证）/ 运行时面（CDP 探针），外加自跑门套。

## 0. 对象核验

- `git log --oneline -5`：HEAD = `e0906dd fix(frontend): manualChunks 扩 vendor-react 正则…`；`git log origin/main..HEAD` 仅此一笔 = **未 push**（ahead 1）。
- `git show --stat e0906dd`：16 files +2469/−1 = `frontend/vite.config.js`（+6/−1：正则一行 + 注释五行）＋ `ops/p0-white-screen-20261015/**` 证据包；**无 src/ 改动**。diff 与派单口径逐字一致（vendor-react 组由 `^(react|react-dom|scheduler)$` 扩为 `^(react|react-dom|scheduler|react-qr-code|qrcode-generator|prop-types)$` ＋ 注释）。

## 1. 反事实重建（改前形态，独立 worktree，质检方自建）

- `git worktree add --detach <scratch>/neng-p0qc/wt c7ba7d4`（= e0906dd~1，旧正则现场核对：第 20 行仍为 `/^(react|react-dom|scheduler)$/`）＋ symlink 主仓 `frontend/node_modules`（未 npm install）。
- 旧配置 `vite build` **exit 0**（缺陷在运行时不在构建期，与诊断一致），产物名与旧证据/生产**逐字同名**：`index-Cl6qtH3z.js` / `vendor-CaaXybtR.js` / `vendor-react-DHpd0QMj.js`。
- sha256 逐字复现 `old-build-chunk-evidence.txt`：
  - `index-Cl6qtH3z.js` = `84c596d54be2…`（与 §5.411-G 台账、线上同版哈希一致）
  - `vendor-CaaXybtR.js` = `d7bc661c6cef…`、`vendor-react-DHpd0QMj.js` = `3152655c92ce…`
- ⇒ 我的旧重建 = 线上坏产物**同版**（构建确定性同时得证）。

## 2. chunk 图面（双尺互证）

- **尺 A**（仓内 `readings/zang-fix/sf-chunk-graph.mjs`，对本单自建两份产物现跑）：
  - 旧产物 **exit 1**：`CYCLE: vendor-CaaXybtR -> vendor-react-DHpd0QMj -> vendor-CaaXybtR`；
  - 新产物 **exit 0**：`ACYCLIC`。尺子灵敏度（红在已知坏产物）由质检方独立复证，非仅引用 Zang 读数。
- **尺 B**（本单自写 Python 边抽取 `from"…"/import"…"` ＋ 独立 DFS，与尺 A 无共享实现）：同读数 —— 旧 = 环，新 = 无环。
- 模块落位（新产物，本单现 grep）：`react-qr-code`（marker `viewBoxSize`）/ `qrcode-generator`（marker `stringToBytes`）/ `prop-types` 三 marker **均在 `vendor-react-CZtNYldG.js`**；通用 `vendor-AmHF8z37.js`（9.1 kB）＝ 互操作 helper ＋ @remix-run/router，**零出边**；唯一跨 chunk 边 `vendor-react -> vendor-AmHF8z37` 为**单向** ⇒ 求值序安全。
- 旧产物落位：三 marker ＋ helper **全在通用 `vendor-CaaXybtR.js`** ＝ 根因面复现（报告所述机制成立）。

## 3. 运行时面（CDP 探针，两态同尺同法）

- 方法：`Page.addScriptToEvaluateOnNewDocument` 注入 `window.__errs` ＋ error/rejection 钩子 → `python3 http.server` 静态服（旧 :5811 / 新 :5812，端口为独立指派非禁区段）→ 读 `#root` 与 `__errs`。
- **旧产物（判负自证，尺必须红）**：`rootChildren=0, rootLen=0, headerAnchor=false`，
  `errs=["Uncaught TypeError: Cannot read properties of undefined (reading 'forwardRef') @ …/vendor-CaaXybtR.js:12"]` —— 与生产白屏**同文件同行同型**。**红 ✓**
- **新产物（同尺转绿）**：`rootChildren=2, rootLen=17313, header-orders 锚在, errs=[]`。**绿 ✓**
  （「加载首页失败: 请求失败 (404)」＝ 静态服无 `/api` 后端的预期应用层降级，非本缺陷；对照旧态是整页零渲染。）
- 探针服务已按精确 PID（9621/9622）收掉，:5811/:5812 复核无监听；worktree 已移除，`git status --porcelain` 回开工前基线。

## 4. 门套（质检方自跑，非转引）

- `npm run build`（HEAD e0906dd）：**exit 0**；产物 `index-DJNSZl46.js` = `0193f82da11e…` / `vendor-react-CZtNYldG.js` = `e16f933f6076…` / `vendor-AmHF8z37.js` = `495d48a8401d…`，与 REPORT.md 所载**逐字相同**。
- `npm run test:unit`：**exit 0，54 files / 519 tests / 0 failed** —— 与基线（2026-10-14 = 54/519）持平，「只增不减」✓。
- lint：N/A（本仓无 ESLint 配置恒 exit 2，存量口径非本批红点）—— 按册登记，未跑。

## 5. 证据包充分性评定

- 链路完整：REPORT.md ＋ diagnosis.md（四面排查、浏览器层确定性复现、同版 sha256 证明）＋ zang-fix/（判负自证、双 chunk 图、build/单元日志、图脚本）＋ zang-verify.md（Zang 复验）。内部一致，无互相矛盾读数。
- 尺子事故披露（环检测首版 `WHITE` 判断 bug，靠「先对坏产物跑红」当场抓获）已入 REPORT；现行脚本 `color[v] ?? WHITE` 已核，且与尺 B 同读数 ⇒ 尺有效。
- 细节勘误（不影响结论）：REPORT.md「模块落位」行称 qrcode-generator marker「见 chunk-graph-new.txt markers 段」—— 该文件 markers 段实际无 `stringToBytes` 字段（应为另行 grep 取证）；marker 本身为真（本单已独立复核在 vendor-react 内）。

## 结论

四面全绿 ＋ 判负自证（尺先红）由质检方独立复现 ＋ 门套持平基线 ⇒ **PASS**。
push（=上线）由上游执行，本单未 push、未动任何业务代码；commit 仅本读数文件。
