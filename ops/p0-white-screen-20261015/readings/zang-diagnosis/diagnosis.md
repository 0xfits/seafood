# P0 白屏诊断读数（Zang，2026-10-15 15:1x–15:3x CST）

症状：用户报「0xseafood.com 打不开」。实况 = **生产全局白屏**（HTML/JS 均 200，React 不挂载），与网络无关。

## 四面读数（站点 vs 本机，全部站点侧无病）

| 面 | 命令 | 读数 |
|---|---|---|
| ① 本机 DNS | `dig +short A 0xseafood.com` | `198.18.17.188`（fake-ip 保留段 ⇒ 本机代理接管，非真实解析） |
| ① 公网真实解析 | DoH `dns.google/resolve` | `216.198.79.1`（Vercel anycast，TTL 1800，解析正常） |
| ② 强指边缘 | `curl --resolve 0xseafood.com:443:76.76.21.21 …/api/health` | **200**，`{"ok":true,…,"schema_version":"0048"}` |
| ② 首页 | 同上 `/` | **200**，7908B，引用 `assets/index-Cl6qtH3z.js` / `index-Bl6P2cg0.css` |
| ③ 外部 vantage | check-host.net 5 节点（in/nl/pl/pt/se） | **5/5 全 200**（216.198.79.1），永久链接 check-report/5117ad8fk7ed |
| ③ 服务端取页 | r.jina.ai | 取到 `Title: Seafood` |
| ④ 本机直连 | curl（经代理） | 200（网络层通） |

## 浏览器层（关键层）

- 真实浏览器打开 `https://0xseafood.com/`：`title=🐴 Seafood`，**`#root` innerHTML=0**（React 未挂载）。
- 注入 error 钩子（`Page.addScriptToEvaluateOnNewDocument`）后 reload：
  **`Uncaught TypeError: Cannot read properties of undefined (reading 'forwardRef') @https://0xseafood.com/assets/vendor-CaaXybtR.js:12`**（确定性复现）。
- 全部资源 transferSize 正常（125KB 入口 + 各 vendor chunk 均加载成功）⇒ 非网络/非缓存，是执行期崩溃。

## 根因链（chunk 反汇编实证）

1. `index-Cl6qtH3z.js` 首个 import = `./vendor-react-DHpd0QMj.js`。
2. `vendor-react` 头部：`import{g as tf}from"./vendor-CaaXybtR.js"` —— **反向依赖通用 vendor chunk**（g = `vt` = CJS/ESM 互操作 helper `getDefaultExportFromNamespaceIfNotNamed`，见 vendor chunk 头部 `function vt(t){…__esModule…}`，尾部 `export{…vt as g…}`）。
   - helper 落在 vendor chunk 的原因：vendor 里有 CJS 包用户（react-qr-code 的依赖 `qrcode-generator` ^2.0.4 + `prop-types`，均未被任何分组正则命中）。
   - vendor-react 需要它：react 18 CJS 出口求值期解包 `const wf=tf(br)`（`br=Hi.exports`）。
3. 循环：index → vendor-react → vendor →（import 回）vendor-react。引擎先执行 vendor chunk 体 ⇒ 其中的 **react-qr-code**（v2.2.0，b7733de 引入）在模块求值期执行 `Q.forwardRef(...)`（`Q` = 从 vendor-react 导入的 React，**尚未初始化**）⇒ TypeError ⇒ 整条静态 import 链作废 ⇒ 白屏。
4. vendor chunk 第 12 行即 qrcode-generator/react-qr-code 代码段（本目录 sf_vendor.js 可复核）。

## 影响面 / 同版证明

- 本地 HEAD（c7ba7d4）`vite build` 产物资产名与线上**逐字同名**，sha256 逐字相同：
  - `index-Cl6qtH3z.js` = `84c596d54be237c44d38f2713f3066d69a5de733b2559694fdbb6f0e385ca00a`（与 §5.411-G 台账哈希一致）
  - `vendor-CaaXybtR.js` = `d7bc661c6cef3fe1068df4e24d6b6bf1495891ec8084f13f8ab007186798beb5`（本地构建 = 线上下载，同值）
- ⇒ 线上跑的就是仓内 HEAD 这版；缺陷确定性，**全体用户 100% 白屏**；dev（无 manualChunks 的 ESM 管线）不受影响。
- 引入提交：**b7733de**（2026-10-14 14:43:35 +0800，tg-bind-v2 扫码主路径，新增 react-qr-code）。
- 附带隐患：`@remix-run/router` 因正则 `/^@remix-run$/` 匹配不上 scoped 包名而落入通用 vendor（本次事故非主因，登记待修）。

## 处置

- 派单 Kong：vendor-react 正则扩 `|react-qr-code|qrcode-generator|prop-types`（与 React 同 chunk + helper 用户同收，消环）；验证门 = 判负自证 + build exit 0 + chunk 依赖图无环 + test:unit ≥519 例不减 + commit（不 push）。
- push（=上线）待独立质检 + Kevin 验收后执行；纯前端改动，无迁移前置。
