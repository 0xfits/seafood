# P0 生产白屏（0xseafood.com）修复报告 — vendor ⇄ vendor-react 循环依赖

- 日期：2026-10-15 · 实现/验证：Zang · 基线 HEAD = `c7ba7d4`（与 origin/main 同步）
- 诊断读数：[`readings/zang-diagnosis/diagnosis.md`](readings/zang-diagnosis/diagnosis.md)（四面排查、浏览器层确定性复现、本地 HEAD 构建 = 线上产物 sha256 逐字同版证明）
- 修复读数：[`readings/zang-fix/`](readings/zang-fix/)（本报告各门证据）

## 根因（一句话）

`frontend/vite.config.js` 的 manualChunks 把 react-qr-code（b7733de 引入）与其 CJS 依赖
qrcode-generator、prop-types 落入通用 `vendor` chunk ⇒ CJS 互操作 helper 被提升进 vendor ⇒
**vendor ⇄ vendor-react 循环依赖**；index 先载 vendor-react ⇒ 引擎先执行 vendor ⇒ vendor 内的
react-qr-code 在**模块求值期**读 `React.forwardRef`，此刻 React 未初始化 ⇒
`Uncaught TypeError: Cannot read properties of undefined (reading 'forwardRef') @vendor-CaaXybtR.js:12`
⇒ 整条静态 import 链作废 ⇒ `#root` 空 = 全局白屏。

## 修复（唯一代码改动）

`frontend/vite.config.js` `VENDOR_GROUPS` 的 vendor-react 分组正则：

- 改前：`/^(react|react-dom|scheduler)$/`
- 改后：`/^(react|react-dom|scheduler|react-qr-code|qrcode-generator|prop-types)$/`

react-qr-code 三件与 React 同 chunk：通用 vendor 不再含「求值期读 React」的模块，反向边消失；环消。
仅此一处 + 证据目录，未动任何业务代码。

**登记不改**（本次非主因，留待后续单）：`vendor-router` 正则 `/^(react-router|react-router-dom|@remix-run)$/`
因 `pkgOf` 对 scoped 包返回 `@remix-run/router` 全名而匹配不上 ⇒ @remix-run/router 落入通用 vendor
（修后它成为通用 vendor 唯一住户，见 chunk-graph-new.txt，无出边、无害）。

## 验证门（全部通过）

| 门 | 读数 | 证据文件 |
|---|---|---|
| 判负自证（尺先红） | 旧产物静态载入：`#root` 空 + `forwardRef` TypeError（与生产同文件同行 vendor:12） | `readings/zang-fix/browser-probe.md` |
| 运行时（新产物） | 同尺转绿：`#root` 2 子节点、`header-orders` 锚在、`__errs` 空 | 同上 |
| build exit 0 | `build-exit=0`，✓ built in 1.77s | `readings/zang-fix/build-fixed.log` |
| chunk 依赖图无环 | 新产物 exit 0 `ACYCLIC`；**同一把尺对旧产物 exit 1** 报 `vendor-CaaXybtR -> vendor-react-DHpd0QMj -> vendor-CaaXybtR`（灵敏度自证） | `readings/zang-fix/chunk-graph-old.txt` / `chunk-graph-new.txt`（复放脚本 `sf-chunk-graph.mjs <distDir>`，exit 0=无环 / 1=有环） |
| 模块落位 | react-qr-code（marker `viewBoxSize`）、prop-types、qrcode-generator（marker `stringToBytes`）均在 `vendor-react-CZtNYldG.js`；通用 `vendor-AmHF8z37.js` 9.1 kB 仅余 @remix-run/router + 互操作 helper，无出边 | `chunk-graph-new.txt` markers 段 |
| test:unit | 改前基线 **54 files / 519 tests / 0 failed**；改后**同值**（≥519 不减 ✓） | `readings/zang-fix/unit-baseline.log` / `unit-postfix.log` |
| lint | N/A（本仓无 ESLint 配置，恒 exit 2，存量口径，非本批红点） | — |

**尺子事故披露（有效性自证）**：环检测脚本首版对「未访问态」判断有误（`color===WHITE` 不匹配
`undefined`），在**已知坏的旧产物**上误报 ACYCLIC —— 因按纪律「先对坏产物跑红」而当场抓获；
修复后先证旧产物 exit 1（红）再证新产物 exit 0（绿）。未据无效尺子下过任何结论。

## 产物对照

| | 改前（=线上坏产物） | 改后 |
|---|---|---|
| index | `index-Cl6qtH3z.js` = `84c596d5…` | `index-DJNSZl46.js` = `0193f82da11e66d9d7d3b267b77dddf960e7473307a5d44e65410a37c6d5eb44` |
| 通用 vendor | `vendor-CaaXybtR.js` = `d7bc661c…`（33.4 kB，含 QR 三件 + helper + router） | `vendor-AmHF8z37.js` = `495d48a8401d9d3cdecd460ac0003d7d0c9e173105fbad6081016995b14fa665`（9.1 kB，router + helper） |
| vendor-react | `vendor-react-DHpd0QMj.js`（142.2 kB） | `vendor-react-CZtNYldG.js` = `e16f933f6076fad6c8afc2a190691a2be82acedf5ba8bef79e1f3a62e386bd8c`（166.5 kB，+QR 三件） |
| css | `index-Bl6P2cg0.css` | 同名未变（CSS 零改动） |

全量 sha256 见 `old-build-chunk-evidence.txt`（改前）与 `build-fixed.log` 产物清单；改后逐文件哈希已用
`shasum -a 256 dist/assets/*.js` 现取（index/vendor-react/vendor 三件如上，router/ui/i18n 因引用 chunk
名变化而换哈希、字节量与改前一致）。

## 遗留与建议

1. **@remix-run/router 分组正则**：`@remix-run/router` 应归 vendor-router —— 需把该行正则改为
   匹配 scoped 全名（如 `^(react-router|react-router-dom|@remix-run(/.+)?$)`）后**另行验证**，本次按派单口径不改。
2. **通用 vendor 的结构风险**：任何「依赖 React」的包落入通用 vendor 都可能复现本形环。
   建议后续把「vendor 分组落位检查」加进门套（可复用本次 `sf-chunk-graph.mjs`：exit 0 即无环）。
3. push（=上线）待独立质检 + Kevin 验收后执行；纯前端改动，无迁移前置。
