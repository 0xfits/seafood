# 独立质检 REPORT · 发布任务页（/task/new）币种下拉（qa-job）

- **对象**：`1d9b415`（实现）+ `9041097`（实现方探针）；规范锚 `9087c51`（route v2.38 §47.8 / master-plan §5.419 / design §15.2 勘误）
- **质检时点 HEAD**：`9087c51abbf31bb418a689bb2324a2403b2bf3d3`（主仓工作树干净，仅两处未跟踪 ops/ QA 目录）
- **判定：8/8 AC 全 PASS（verdict = PASS）**。逐条读数独立现取，判负对照齐备。
- **纪律**：零真发任务/商品（写口全部在 `context.route` 内就地截获；本批探针累计 POST /api/job 截获 8 次、全部本地回包）；dev 库只执行 SELECT；不 commit、不 push；门套全部在干净 worktree 跑，用毕移除。

## 环境

| 件 | 值 |
|---|---|
| 前端 dev | localhost:5787（vite dev，主仓 @9087c51） |
| 后端 dev | localhost:5788（真后端） |
| 生产臂 | 干净 worktree `dist`（本质检自建 build）经 `vite preview` 提供 |
| dev 库 | Neon Postgres `public.currency`（只 SELECT） |
| worktree | `<scratch>/qa-job-9087c51` @9087c51 + node_modules 软链（frontend、backend-ts）+ 独立 cacheDir（`vitest.qa.config.js`，未跟踪、随 worktree 删除） |

## 逐 AC 读数（详值见 verdict.json）

| AC | 判定 | 关键现取读数 | 读数件（readings/） |
|---|---|---|---|
| 1 形态 | **PASS** | `select[data-sf-m=jobs-select-cid]` = 1、`input[data-sf-m=jobs-input-cid]` = 0（任意标签 = 0）、tagName SELECT、required=true；**负控**：注入同钩子诱饵 input ⇒ 0→1→0（尺子不盲） | ac1-ac2-ac4-browser-probe.json |
| 2 选项真实 | **PASS** | 页面选项 11 = 接口 11 行，**逐项有序相等**（value=cid、文本=`symbol · name`）；DB listed 11 行与接口行三元组逐字相等；**draft 负控**：DB draft 5 行（cid 9/15/22/27/28）全不在选项；bareNumericPrefix = []（dev 与生产臂双验）；默认选中 `1` = `$ · 平台积分` | ac1-ac2-ac4-browser-probe.json、ac2-db-currency.json、ac2-negative-control.json、ac2-prod-preview-requests.json |
| 3 公开读口未变形 | **PASS** | 无 Authorization（显式清空）⇒ 200；伪造 Bearer ⇒ 200；行键集恰 {cid,symbol,name}（11/11）；cid JSON 类型 = string；按 cid 升序；`git diff 1d9b415^..9087c51 -- backend-ts/` = 空（7b597ec..9087c51 亦空）、backend-ts 工作树干净、注册行 `index.ts:2341` 未动 | ac3-curl-summary.txt、ac3-currencies.body.json、ac3-currencies.headers.txt、ac3-backend-unchanged-git.log |
| 4 提交语义 | **PASS** | 换选两币种 ⇒ 两次截获载荷 `cid` = 1 与 4，**均 typeof number**；键集 {cid,create_key,description,headcount,reward,title} 不变、幂等键前缀 `cli:`；`publishJob` 函数体与 `1d9b415^` **逐字节相同**（457B）；job-api.js 全文件 diff = +8/−0（仅 fetchCurrencies 包装） | ac4-publishjob-verbatim.txt、ac1-ac2-ac4-browser-probe.json |
| 5 回退三态 | **PASS** | 500 / abort / `success:true data:[]` 三臂均：选项恰 1（value `1`、文本恰 `$`）、`jobs-primary` 不 disabled、pageerror 0、且提交仍发 POST /api/job（cid=1 number）；**正控臂**：真后端 11 选项 | ac5-fallback-arms.json |
| 6 i18n | **PASS** | 四语 `jobs.cid`/`jobs.cidNote` 均已改（值见 verdict）；拍平键数四语相同且与改前不变（128 顶 / 1106 拍平 / 4424 节点）；`item.*` 零改动；`jobs.*` 其余键零改动；黑名单（读口/服务端/未注册//api//状态码/status=）命中 0；手填语义（填1/enter 1/nhập 1…）命中 0；`jobs.cid` 无「编号/id」核心词 | ac6-i18n.json |
| 7 门套 | **PASS** | 干净 worktree：`p7b-03` **37/37**（exit 0、red=[]）、**AC10-2 registration_points=108**（未变 109）；行首锚定 `^app\.(get\|post\|put\|delete\|patch)\(` = 108（get 48 / post 56 / put 0 / delete 3 / patch 1）；**非锚定对照 = 109**（多 1 条 = `index.ts:896` 注释行，不当作注册点）；`test:unit` **59 files / 568 tests 全过**（exit 0，≥ 59/568）；附带 worktree build exit 0 且产物 `index-BREoUqs6.js` 与实现方读数逐字相同（独立复证） | ac7-p7b03-clean-worktree.log、ac7-registration-regex.log、ac7-test-unit-clean-worktree.log、ac7-build-clean-worktree.log |
| 8 回归面 | **PASS** | `/`、`/task`、`/task/new`（已登录假会话，下拉在场）三页 `#root` 非空、pageerror 0、unhandledrejection 0；`GET /api/task/all`、`GET /api/home` 各 200；全程零业务写 | ac8-pages.json、ac8-api-status.txt、ac8_api_task_all.body.json、ac8_api_home.body.json |

## 观察项（登记，不进判负）

1. **zh `jobs.cidNote` 含「悬赏」限定**（「请从下拉框选择悬赏币种」），en/hk/vn 无对应词 —— 任务书已知观察项。
2. **StrictMode 双跑**：dev server（`main.jsx` 包 `<React.StrictMode>`）下挂载发 2 条相同 GET /api/currencies；**生产构建实测恰 1 条**（worktree dist @9087c51 经 vite preview，bundle `index-BREoUqs6.js`，`exactly_one_get_currencies=true`）。代码侧 `useEffect` deps=[] 单发；§47.8.5 #18「恰 1 条」以生产面为准成立。
3. **回退臂 console 噪声**：500/abort 臂各 2 条浏览器 resource 错误日志 = 注入失败本身，非未捕获异常（pageerror=0）。

## 环境性 FAIL 原样保留（已归因，均已复原复跑）

- **test:unit 首跑**（干净 worktree 未 build）：58/59 files、556 tests，`p4z-feperf` 判红「缺少构建产物 dist/assets/*.css」——gitignore 的 dist 不随 worktree 检出，属环境缺口。worktree 内补 `npm run build`（exit 0）后复跑全绿。→ `ac7-first-run-env-fail-note.log`
- **AC8 首跑**（GET 全透传真后端）：假会话 token 被真后端 401 ⇒ auth-expiry 拦截器清会话 ⇒ 页面转登录过期态。属探针环境噪声（假凭据触发真闸），非本批缺陷；改既定配方（仅 /api/currencies 真后端、其余桩 200）复跑全绿。→ `ac8-first-run-passthrough-note.log`

## 边界（显式登记）

- 未真发任务/商品；写口全部就地截获（POST /api/job 共截获 8 次全为本地回包；DB 只 SELECT）。
- 假会话为结构合法假 JWT（exp 2100、非真凭据），仅让受保护页渲染。
- 未改产品代码 / docs / 实方读数；未 commit、未 push；worktree 已移除（`git worktree list` 仅剩主仓与另一质检员 7b597ec worktree；`git status` 仅新增 `ops/item-cid-select/qa-job/**`）。
- 本质检读数独立现取，不照抄 brief/实现方数字；与实现方一致处（11 选项、`index-BREoUqs6.js`、108 注册点）均为二次取证。
