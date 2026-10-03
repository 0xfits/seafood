# 站点 favicon 安装片 · 终审质检报告（Neng 独立质检 · 钉 c004ce2）

- **被检提交**：`c004ce2` — `feat(favicon): 站点图标安装（R-9-46 忠实方案）…`（作者 Kevin · 2026-10-03 14:49:59 +0800）
- **被检面（恰 5 件）**：`frontend/index.html`（第 5–9 行）· `frontend/public/brand/favicon.svg` · `frontend/public/brand/favicon-32.png` · `frontend/public/brand/apple-touch-icon.png` · `docs/audit/favicon-install.md`
- **真源（唯一）**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/favicon_in/icon_77c2a5.svg` = **7,808 B** · sha256 `4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9` · `viewBox="0 0 128 128"` · 1 `<path>` + 1 `<rect>` · 两色（底 `#fde815` / 形 `#090401`）
- **作废旧件**：`icon_d94d02.svg`（336,432 B · `cc10313e…a93d3b` · 774 path · grunge）⇒ 全仓不得残留
- **质检口径**：不 commit / 不 push / 不 `git add`；不改 `frontend/index.html` · `frontend/public/**` · `backend-ts/src/**`（副本内变异除外）；不碰 `docs/*.spec.md` · `master-plan` · `docs/audit/**`；不 `npm install`；不碰/打印 `.env*`；禁 `pkill -f`/`killall`；不动 5787/5788（PID 30475/65096）；受控实例只用 **5796**；变异**只在仓外副本**（排除 `node_modules`/`dist`/`.env*`/`.git`）。全程守。
- **操作宿主**：macOS 15.7.4 · node v18.19.0 · npm 10.2.3 · vite 5.4.20 · ImageMagick（magick）· DB = 远端 Neon（`.env.local`，未打印）

---

## L0 现取对锚（HEAD / 恰 5 件 / 剩余项归因）

| 锚点 | 读数 | 判定 |
|---|---|---|
| `git log --oneline -1` | `c004ce2 feat(favicon): 站点图标安装（R-9-46 忠实方案）…` | ✅ HEAD = 被检钉 |
| `git show --stat c004ce2` | **5 files changed, 173 insertions(+), 1 deletion(-)**：`docs/audit/favicon-install.md +167` · `frontend/index.html ±6` · `frontend/public/brand/apple-touch-icon.png Bin 0->9171` · `frontend/public/brand/favicon-32.png Bin 0->1191` · `frontend/public/brand/favicon.svg +1` | ✅ **恰 5 件**，与交件面逐字一致 |
| `git status --porcelain`（**开工** HEAD=c004ce2） | 总 **191** 行 = 21 `M`（`backend-ts/.p4-artifacts/…/geometry.json` + `scripts/p8-s2..s8`(7) + `src/{database,index,ledger}.ts` + `BattCheckinPanel.jsx` + 四语 `{en,hk,vn,zh}.json` + 4 个 `i18n-*.test.jsx`）+ 170 `??` | ✅ 剩余项**全属他人 P9④ 在途件**，**未动** |
| `git status --porcelain`（**收尾** HEAD=3985437） | 总 **191** 行 = 1 `M`（`backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json`，既有件、非本单）+ 190 `??`（artifact + 本报告） | ✅ 兄弟 P9④ 改动已随 `eb29831` 入库、状态自然收敛；本单未 `git add` |

**被检 5 件文件状态**：`git status --porcelain -- <5 件>` ⇒ **空**（均已入库、工作树零改动）✅

**★ 质检途中锚点移动（如实登记）**：开工时 HEAD = `c004ce2`；质检过程中兄弟 agent 于 ~14:52–14:54 入库 `eb29831`（P9④ BTTC 实现）+ `3985437`（docs），HEAD 移至 `3985437`。现取复核：`git merge-base --is-ancestor c004ce2 HEAD` ⇒ **是**（c004ce2 是祖先）；`git diff --quiet c004ce2 HEAD -- <被检 5 件>` 逐件 ⇒ **UNCHANGED**（被检 5 件在 `c004ce2` 与 HEAD 间**字节恒等**；新提交只动 `backend-ts/**` 与 `frontend/src/**`）⇒ **被检面不因新提交而变，verdict 成立**。
**L0 归因（本单新增产物）**：`docs/qa/favicon-install-qa.md`（本报告）+ `backend-ts/.p4-artifacts/p6tr1a-20261003T065059Z/` + `.p8s1..p8s5` 各一次 run 目录 —— **全部为本单运行产物，未 `git add`**。

---

## L1 资产逐字（SVG 字节 / sha256 / cmp；两 PNG 尺寸 / 无 alpha）

### L1-a SVG（`frontend/public/brand/favicon.svg`）
| 断言 | 现取读数 | 判定 |
|---|---|---|
| 字节 | `7808` | ✅ = 7,808 |
| sha256 | `4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9` | ✅ = 真源口径 |
| `cmp` vs 真源 | `cmp: SAME`（exit 0） | ✅ **逐字一致（零重绘）** |
| 结构 | `viewBox="0 0 128 128"` · `<path`=1 · `<rect`=1 | ✅ 与真源同族 |
| 色值闭集 | `#090401` · `#fde815` | ✅ 两色（底黄 / 形近黑），无 grunge 三色 |

### L1-b PNG（`magick identify`）
| 文件 | Geometry | 尺寸目标 | Type / color_type | Alpha | 字节 | sha256 |
|---|---|---|---|---|---|---|
| `favicon-32.png` | `32x32+0+0` | ✅ 32×32 | `Palette` · `png:IHDR.color_type=2 (Truecolor)` | **`Undefined`（无 alpha）** | 1191 | `1448a817a27265537bf9d8dedd92fd4faf77604bd68babf066ef24bf8805d4b4` |
| `apple-touch-icon.png` | `180x180+0+0` | ✅ 180×180 | `TrueColor` · `png:IHDR.color_type=2 (Truecolor)` | **`Undefined`（无 alpha）** | 9171 | `610535734c67ad46559008180e369b5d4239da330f2485cbd46338bd73ca683e` |

- 两 PNG `Channels=3.0`、`color_type=2`（RGB，**无 alpha 通道**）⇒ **黄底不透明**成立 ✅
- 派生读数与 `docs/audit/favicon-install.md` §② 登记的两条 sha256 **逐字相符** ✅（独立复算）

---

## L2 接线逐字（index.html 三条 link；全仓 /vite.svg 与旧 sha256 命中）

### L2-a 三条 `<link>` 逐字（`frontend/index.html` 第 7–9 行）
| 行 | 逐字内容 | rel | type | sizes | href 前缀 |
|---|---|---|---|---|---|
| 7 | `<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />` | `icon` | `image/svg+xml` | —（省略） | `/brand/` ✅ |
| 8 | `<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />` | `icon` | `image/png` | `32x32` | `/brand/` ✅ |
| 9 | `<link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />` | `apple-touch-icon` | —（省略） | `180x180` | `/brand/` ✅ |

`git show c004ce2 -- frontend/index.html` 复核：旧第 5 行 `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` **被删**，替换为 2 行注释（第 5–6 行：真源路径 + sha256 + `R-9-46`）+ 3 条 `/brand/*` link（第 7–9 行）✅

### L2-b 全仓命中读数
| 探针 | 命令 | 命中 | 判定 |
|---|---|---|---|
| `/vite.svg` **可执行引用**（`href="/vite.svg"`） | `grep -rnE 'href="/vite.svg"' --exclude-dir=node_modules --exclude-dir=.git .` | **0**（仅 `docs/master-plan:1441`、`docs/audit/favicon-install.md:55,68` 三处**代码围栏内的历史/说明文字**，非 markup） | ✅ 仓内**零可执行引用** |
| `/vite.svg` **字面量** | 同上（含 `.svg`） | `frontend/index.html:6` + `frontend/dist/index.html:6`（均为「旧引用已清除」**说明性注释**）+ `docs/audit/favicon-install.md` + `docs/seafood.master-plan.md` | ✅ 无 `<link>`/`<script>` 形态；注释/文档不构成拉取 |
| 旧 sha256 `cc10313e…` | `grep -rn 'cc10313e' --exclude-dir=node_modules --exclude-dir=.git .` | 仅 `docs/seafood.master-plan.md:1423,1439,5348,5349` + `docs/audit/favicon-install.md:8,141` | ✅ 仅历史规范/报告文字（禁改件），**零资产命中** |
| 旧件 336,432 B 残留 | `find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -size 336432c -print` | **空**（无 336432 字节文件） | ✅ 旧件资产**零残留** |
| favicon 家族文件 | `find … -iname '*favicon*' -o -iname '*apple-touch*'` | `frontend/public/brand/{favicon.svg,favicon-32.png,apple-touch-icon.png}` + `frontend/dist/brand/…`（皆新件）+ `docs/audit/favicon-install.md` | ✅ 无 `vite.svg` 文件 |

---

## L3 构建 + 严格静态服务读口

### L3-a 构建（`npm run build` · vite v5.4.20）
- 退出码 **0** · `✓ 1795 modules transformed` · `✓ built in 1.72s`
- 产物：`dist/index.html 5.30 kB` · `dist/assets/index-CLouUL9E.js 399.50 kB`
- `dist/brand/` **三件在场**：`favicon.svg`(7808) · `favicon-32.png`(1191) · `apple-touch-icon.png`(9171)（另有 `logo.svg` 13414）
- `dist/brand/favicon.svg` 现取：`bytes=7808` · sha256 `4dc72e77…8bffb9` ✅ = 真源
- `dist/vite.svg` **不存在**（`ls` ⇒ No such file） ✅

### L3-b 严格静态服务读口（★ 方法学）
**服务**：`python3 -m http.server 5796 --bind 127.0.0.1 --directory frontend/dist`（对缺失路径**真 404**，`.svg→image/svg+xml`、`.png→image/png`）。
`lsof -nP -iTCP:5796 -sTCP:LISTEN` ⇒ `Python 4776 127.0.0.1:5796`（**独占监听**）。

| 路径 | `code` · `content_type` · `size_download` | 判定 |
|---|---|---|
| `/brand/favicon.svg` | `200` · `image/svg+xml` · `7808` | ✅ 200 · image/svg+xml · 7808 |
| `/brand/favicon-32.png` | `200` · `image/png` · `1191` | ✅ 200 |
| `/brand/apple-touch-icon.png` | `200` · `image/png` · `9171` | ✅ 200 |
| `/vite.svg` | `404` · `text/html;charset=utf-8` · `335` | ✅ **真 404** |

**下载物身份对拍**：`curl -o` `/brand/favicon.svg` ⇒ `bytes=7808` · sha256 `4dc72e7793a117b6a28bc92aaf2d9a66373e187eb2cc6109e07c1df3c08bffb9` · `cmp <真源>` = **SAME** ✅ **逐字一致**。
**★ 方法学守则**：`/vite.svg ⇒ 404` 的断言**全程由严格静态服务取证**；**未**用 `vite preview` 下结论（其内建 SPA 回退会把未知路径兜底成 `200 text/html`）。`vite preview` 本单**未复跑**（守「受控实例只用 5796」，无第二个口可占）—— 见未测项。

---

## L4 回归（tsc / build / test:unit / 离线 / s1..s9）

| 硬门 | 命令 / 口径 | 现取读数 | 判定 |
|---|---|---|---|
| `tsc` | `backend-ts`：`npx tsc -p . --noEmit` | 输出 0 行 · `TSC_EXIT=0` | ✅ 0 |
| `build` | `frontend`：`npm run build` | `BUILD_EXIT=0`（`index-CLouUL9E.js` 399.50 kB） | ✅ 0 |
| `test:unit` | `frontend`：`npm run test:unit` | **31 files / 276 passed** · `UNIT_EXIT=0`（≥276 ✓） | ✅ 276 |
| 离线套件 | `backend-ts`：`p4z-tr1a-01-offline-tests.ts` | `SUMMARY total=126 passed=126 failed=0` · `OFFLINE_EXIT=0` | ✅ 126/126 |
| `index.html` 相关断言（实跑） | `p4z-feperf.test.js`（:118 剥注释查 tailwind）+ `theme-shell-isomorphism.test.jsx`（:276 查 `<title>Seafood</title>`） | **Test Files 2 passed · Tests 26 passed** · EXIT=0（逐条用例 ✓） | ✅ 兼容、未红 |

### L4 门脚本（带受控实例）
**受控实例**：`backend-ts`：`PORT=5796 npx ts-node --transpile-only src/index.ts` ⇒ 日志 `TypeScript backend running on port 5796`；`lsof` 独占 `node … *:5796`。HTTP 探针：`GET /api/role-names ⇒ 200` · `GET /api/batt ⇒ 401`（无 token，符合设计）。

| 门 | 口径 | 读数 | 判定 |
|---|---|---|---|
| `p8-s1` | 离线（零 DB/网络/HTTP） | `total=24 passed=24 failed=0` EXIT=0 | ✅ |
| `p8-s2` | 离线 | `41/41/0` EXIT=0 | ✅ |
| `p8-s3` | 离线 | `45/45/0` EXIT=0 | ✅ |
| `p8-s3b` | 离线 | `38/38/0` EXIT=0 | ✅ |
| `p8-s4` | 离线 | `79/79/0` EXIT=0 | ✅ |
| `p8-s5` | 离线 | `117/117/0` EXIT=0 | ✅ |
| `p8-s6` | 离线 | `64/64/0` EXIT=0 | ✅ |
| `p8-s7` | **带实例** `P8S7_BASE=http://127.0.0.1:5796` | `total=58 passed=58 failed=0 pending_apply=0 db=7 http=9` EXIT=0 | ✅ |
| `p8-s8` | **带实例** `P8S8_BASE=http://127.0.0.1:5796` | `92/92/0 pending_apply=0 db=13 http=11` EXIT=0 | ✅（首跑 91/92，见下） |
| `p8-s9` | 只连库（零 HTTP） | `total=99 passed=99 failed=0 pending_apply=0 db=10 http=0` EXIT=0 | ✅ |

**离线双读数登记（R-9-26）**：把 base 指向**关闭口** `127.0.0.1:5799`（`lsof` 空，模拟无实例）⇒
- `p8-s7` 离线：`55/58 failed=3`，红 = **`G8`/`G9`/`G10`（全 `dbLive` HTTP 类）**
- `p8-s8` 离线：`89/92 failed=3`，红 = **`H5`/`H6`/`H7`（全 `httpLive` HTTP 类）**
该「工作树」= `c004ce2` + 兄弟 P9④ 的 `backend-ts/**` 改动，**其后已入库为 `eb29831`** ⇒ 门读数可归因为 `c004ce2` 之上叠加 `eb29831` 的后端树。

⇒ 与 `R-9-26` 先例一致（离线红全属 HTTP 类、环境差异，**未放宽判据、未标假绿**）✅

**★ 过程如实登记（首跑假红 → 已复跑）**：首跑 `p8-s7`/`p8-s8` 得 `55/58`/`89/92`（红皆 HTTP 类，且 `/api/role-names` 竟 404）。**根因 = 我自己的操作**：L3 的 `python3 -m http.server`(PID 4776) 仍占 `127.0.0.1:5796`，与后起的 node 实例（IPv6 `*:5796`）并存，curl 打到 **python**（404/501 = python 语义）。**精确 `kill -TERM 4776`** 后端口只剩 node，`GET /api/role-names⇒200` ⇒ **复跑即全绿**（`58/58`、`92/92`）。⇒ 已按「单监听者」纪律纠正，读数以复跑为准。

**★ `p8-s8` `H6` 瞬时 503**：复跑首现 `GET /api/rating/summary ⇒ 503`（`/api/timeliness⇒200`）。实例日志坐实 = `NeonDbError: Error connecting to database: fetch failed`（`code=LEDGER_TX_TIMEOUT http_status=503 reason=driver_connection_error`）⇒ **远端 DB 瞬时连接抖动（环境态，非代码缺陷）**；**再复跑 ⇒ 92/92 全绿**（与 `master-plan` v0.246「H6 首跑瞬时 503 属环境态」先例一致）✅

**★ L4 作用域如实声明**：上述门读数为**工作树**（`c004ce2` + 兄弟 agent P9④ **未入库**的 `backend-ts/src/{index,database,ledger}.ts` 修改：`git diff c004ce2 --stat` = `database.ts +426` · `index.ts +118`（新增 2 条 `/api/bttc/*`）· `ledger.ts ±13`）口径，**非**纯净 `c004ce2` 后端树（故 `p8-s7` 为 58 checks，先例纯净口径记 56）。**favicon 提交不动后端**，此段为旁证；纯净 `c004ce2` 后端树的复跑见未测项。

---

## L5 反向判负（仓外副本 + 主仓零写入）

**副本**：`rsync -a --exclude node_modules --exclude dist --exclude .git --exclude '.env*' /Users/kevin/bistro/seafood/ ⇒ $SCRATCH/favicon_qa_copy/`（125 MB，**仓外**）。
**基线**：副本 `favicon.svg` = 7808 · sha256 `4dc72e77…` · `cmp<真源>` = SAME；副本 wire 探针 = `/brand/favicon.svg` link **1** 命中 · `/vite.svg` 可执行 **0** 命中。

| 变异 | 点 | 变异读数（**必红**） | 复原读数（**回绿**） |
|---|---|---|---|
| **N1**（资产逐字） | 副本 svg `#fde815`→`#fde814`（1 字节色值） | `bytes=7808` 但 sha256 = `6a52b90d8db3ec56bb2732c2f264daebd26a5774466a0cdf930d01da782efe69` ≠ 真源；`cmp<真源>` = **DIFF**（char 127）⇒ **L1 门必红** | 从真源 cp 回 ⇒ sha256 `4dc72e77…`、`cmp SAME` ✅ |
| **N2**（接线） | 副本 `index.html` 第 7 行 `href="/brand/favicon.svg"` → `href="/vite.svg"` | `/brand/favicon.svg` link 命中 **1→0**；`href="/vite.svg"` 可执行 **0→1** ⇒ **L2 门必红** | 从主仓 cp 回 ⇒ 命中 `1`/`0` ✅ |
| **N3**（读口） | 副本 `public/brand/favicon.svg` 删除，副本静态服务（5796，`Python 13063`） | `/brand/favicon.svg` ⇒ **404 text/html 335** ⇒ **L3 读口必红** | 从真源 cp 回 ⇒ `200 image/svg+xml 7808` ✅ |

**主仓零写入**：三变异收尾后 `cmp` 主仓 `frontend/public/brand/favicon.svg <真源>` = **SAME**、`cmp` 主仓 `frontend/index.html <副本恢复件>` = **SAME**；`git status --porcelain -- <被检 5 件>` = **空** ⇒ **主仓未写一字** ✅

---

## 未测项（逐项原因 · 禁填 0/空）

| 未测项 | 原因 |
|---|---|
| 纯净 `c004ce2` 后端树（不掺兄弟在途件）上复跑 `p8-s7/s8/s9` | 工作树已含兄弟 P9④ **未入库**改动（`backend-ts/src/*` +118/+426 行），我无法在不 `git add`/`stash`/动他人工作树的前提下拿到纯净后端树；且受控实例仅限 5796、单实例纪律 ⇒ 未另起纯净树复跑。门读数已按「工作树」口径如实登记 |
| `vite preview` 下 `/vite.svg` 的 200 假 404 复现 | 该工具行为仅为**方法学反例**；`/vite.svg` 的 404 断言**必须且已**由严格静态服务取证（L3）。守「受控实例只用 5796」⇒ 未占第二口另跑 `vite preview` |
| 生产 / Vercel 线上 favicon 读口 | 本单不部署、不 push（用户可见面，验收后统一提）⇒ 未对线上域名取样 |
| 浏览器标签页 / iOS 主屏 **视觉**渲染 | 无浏览器渲染 / 真机 / 模拟器接入本单；已用「字节 + sha256 + HTTP 读口 + PNG `color_type` + 无 alpha + 170 抗锯齿色阶」作等价取证，未做像素级视觉比对 |
| svgo / 透明底 / PNG 主链方案 | Kevin 明选 `R-9-46` ① 忠实方案，**明确排除** ②PNG 主链、③svgo ⇒ 主动不测 |
| `frontend/src/test/**` 全量之外的其他套件（components / performance / accessibility / e2e） | 与 favicon 变更无关联、本单禁改 `frontend/src/**`；仅跑与 `index.html` 直接相关的 2 文件（26 用例全绿），其余未跑 |

---

## Verdict

**PASS**（`c004ce2` 的 favicon 安装片满足 `R-9-46` ① 忠实方案全部可判负要件）

- L0 对锚：HEAD 恰 `c004ce2` · 恰 5 件 · 剩余项全属他人 P9④ 在途件（未动）✅
- L1 资产：SVG **7808 B / sha256 `4dc72e77…8bffb9` / `cmp SAME`**；两 PNG **32×32 / 180×180 · 无 alpha（color_type=2）** ✅
- L2 接线：三条 `<link>` 属性逐字正确、前缀 `/brand/`；全仓 `/vite.svg` **零可执行引用**、旧 sha256 **零资产命中**、旧件**零残留** ✅
- L3 构建 + 严格静态服务：`dist/brand/*` 三件在场（svg=7808）；读口 `200·image/svg+xml·7808·下载物 sha256 逐字一致` · 两 PNG `200` · `/vite.svg` **真 404** ✅
- L4 回归：`tsc 0` · `build 0` · `test:unit 276` · `离线 126/126` · `s1..s6 = 24/41/45/38/79/117/64` · **`s7 58/58` / `s8 92/92` / `s9 99/99`（带实例/库）+ 离线双读数登记** ✅
- L5 反向判负：N1/N2/N3 三处**必红**并复原回绿；**主仓零写入**（`cmp` SAME）✅

**旁证**：`docs/audit/favicon-install.md` 的资产/派生/读口/残留登记，与我的**独立现取**逐条相符（含两 PNG sha256 `1448a817…`/`61053573…`、170 抗锯齿色阶、diff 第 5–9 行）✅
**遗留（非阻塞）**：① L4 门读数取自**工作树**（含兄弟在途改动），非纯净 `c004ce2` 后端树；② `p8-s8 H6` 首跑瞬时 503 属远端 DB 抖动，复跑全绿；③ `docs/audit/favicon-install.md` §⑥ 表与 §⑤ 正文存在 `5796` / `5797` 口号的轻微不一致（纯文字记录，无功能影响）。

---

## 自证

- 本报告：**187 行 / 18623 字节** · 占位符 = 0 · 字面双下划线命中 = 0（自证：`grep -c` 双下划线模式 ⇒ 0）
- 收尾 `lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` ⇒ **空**（本单实例全回收：python `4776`/`13063` + node `6672` 均精确 PID `kill -TERM`）
- `lsof -nP -iTCP:5787-5788 -sTCP:LISTEN` ⇒ `node 30475 [::1]:5787` · `node 65096 *:5788`（**他人进程，未动**）
- 收尾 `git status --porcelain` 总 **191** 行；被检 5 件 status **空**；主仓 `cmp <真源>` = **SAME**（零写入）
