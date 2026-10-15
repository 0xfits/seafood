# Zang 独立复验读数（2026-10-15 15:5x CST，Kong 交付后）

不采信自报、全部亲测：

1. commit 面核验：e0906dd 仅 `frontend/vite.config.js`（+6/-1+注释）与 `ops/p0-white-screen-20261015/**`；`git log origin/main..HEAD` 仅此一笔（未 push）；工作区干净。
2. 独立重建：HEAD 构建至 /tmp/sf-verify-build，exit 0；资产名全新一代（index-DJNSZl46.js / vendor-react-CZtNYldG.js / vendor-AmHF8z37.js…，旧坏名 Cl6qtH3z 不复现）。
3. 图判据（复放 zang-fix/sf-chunk-graph.mjs 对自建产物）：**ACYCLIC（exit 0）**；关键 marker：react-qr-code（viewBoxSize）/ prop-types 已入 vendor-react；通用 vendor-AmHF8z37（9.1kB）无出边、无求值期 React 读；vendor-react→vendor-AmHF8z37 单向（helper 仍在通用 vendor 但无环 ⇒ 求值序安全）。
4. 真浏览器探针（自建产物，:5792 静态服，CDP error 钩子）：`rootChildren=2 / rootLen=17289 / errs=[] / header-orders 锚在`，全文渲染；/api 404 = 静态服无后端的预期降级（对照旧态 = 整页零渲染）。
5. 探针服务已按精确 PID（95166）收掉，:5792 无监听。

结论：修复在「commit 面 / 构建 / chunk 图 / 浏览器运行时」四面独立成立，转 Neng 独立质检。
