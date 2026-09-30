# P4-B4c-ii-a · 招工线 + 我的：接线与 UX（Kong）

> **单元** = P4-B4c-ii-a（招工线 + 我的：接线与 UX）；**角色** = Kong（实现方）；**后端零改动**（`backend-ts/src/**` 本单**只读**）。
> **产物目录（唯一 run tag）** = `backend-ts/.p4-artifacts/b4cii-a-20260930T134304/`
> （另有中途中止的 `b4cii-a-20260930T134035/`：只建了 `post/` 空目录，无产物；tag 文件 `.p4-artifacts/B4CII_RUN_TAG.txt` 现取 = `b4cii-a-20260930T134304`）。
> **脚本** = `backend-ts/scripts/p4z-b4cii-a-01-http.ts`（HTTP 全链 · 含库侧核对）、`backend-ts/scripts/p4z-b4cii-a-02-http-nodb.ts`（HTTP · 无 DB 依赖版）、`frontend/scripts/p4z-b4cii-geometry.mjs`（几何同构探针，复制自 4c-i 尺子并改目标页）。
> **口径纪律**：本报告所有「实测」= 可在上列产物 JSON / 脚本 stdout 里 `grep` 到的读数；凡未取到读数者一律写 `NOT_MEASURED` + 原因，**不以 0 / 空代替**。

---

## §1 竣工清单（逐条 `文件:行号`）

### 1.1 新增前端文件（全部在 `frontend/src/**` 允许面内）

| # | 文件 | 内容 | 行号锚点 |
|--:|---|---|---|
| 1 | `frontend/src/pages/jobs/job-api.js` | 接线层：11 条**已注册**路径的读写封装 + 幂等键口径声明 | 文件头 `:1-40`（逐面键口径）；读面 `:44-50`；写面 `:53-80`；tracker `:83-92` |
| 2 | `frontend/src/pages/jobs/PublishJobPage.jsx` | 发布招工（J1）：表单 + 加载/成功/失败三态；`POST /api/job` | `:12` tracker；`:21-45` 提交 + R107 文案；`:59-101` 表单与状态位 |
| 3 | `frontend/src/pages/jobs/JobDetailPage.jsx` | 详情 + 申请（J2）/ 接受（J3）/ 提交（J4）+ 我的报名侧栏 | `:29-47` 详情读；`:50-58` 我的报名读；`:70-88` 三动作；`:96-175` 渲染（含 `data-sf-m` 量测点） |
| 4 | `frontend/src/pages/jobs/JobReviewPage.jsx` | 审核入口（J5/J6）：待审核队列 + 通过/驳回 + 刷新 | `:20-33` 队列读；`:35-47` 审核动作；`:60-118` 渲染 |
| 5 | `frontend/src/pages/jobs/jobs.css` | token + 栅格层（**只吃 token 与结构常量**；无 `[data-theme]` 分支、无 `matchMedia`） | `:12-18` `--sf-j-*` 结构常量；`:78-92` 单断点 767/1024 栅格；全文件无主题选择器 |

### 1.2 既有文件改动（最小入侵）

| # | 文件 | 改动 | 行号锚点 |
|--:|---|---|---|
| 6 | `frontend/src/App.jsx` | 新增 3 条路由（挂在既有 `task` 路由族下）+ import | import `:14-19`；路由 `:70-81`（`task/new` / `task/review` / `task/:jobId`） |
| 7 | `frontend/src/pages/TaskPage.jsx` | 列表页顶部「招工线入口条」（发布 / 审核 / 列表） | import `:3`；入口条 `:231-241` |
| 8 | `frontend/src/pages/ProfilePage.jsx` | 「我的」新增 余额 + 流水 两栏（余额走已注册读口；流水空态 + 登记） | import `:11-14`；`const { t }` `:20`；新栏位 `:333-351` |
| 9 | `frontend/src/locales/{zh,en,hk,vn}.json` | 四语各 +40 键（`jobs.*` 36 键 + `ledger.*` 4 键），**四文件键集逐字一致** | 各文件 `:76-118` |
| 10 | `frontend/src/pages/jobs/jobs.css` | （自查修复）补 `--sf-j-ctl-h` / `--sf-j-textarea-h` 结构常量定义 | `:12-18` |

### 1.3 页面挂载与「页面名不得自造」的自证

- 路由名**全部由已注册 API 路径 + 既有路由族派生**：列表 = 既有 `task`（`App.jsx:70`，消费 `GET /api/task/all` = §1 #9【保留·改接】`task→job`）；发布 = `task/new`（=`POST /api/job`）；审核 = `task/review`（=`GET /api/tasklist/pending-verification` + `POST /api/job/:jobId/review`）；详情 = `task/:jobId`（=`GET /api/task/:tID` + `/apply` + `/accept`）。**未新造任何页面名 / 域名 / API 路径**。
- 静态段优先（react-router-dom `^6.22.0`，`frontend/package.json:38`）：`/task/new`、`/task/review` 不会被 `/task/:jobId` 吃掉（v6 排名机制）。

### 1.4 UX（横竖屏同时交付）

- **宽屏**：页面骨架用 4c-i 的 `.sf-layout`（main + 侧栏 `--sf-st-side-w` 320px），表单在 ≥1024px 落**双列**栅格（`jobs.css:78-88`）。
- **窄屏**：同一套 DOM，≤767px 走 `.sf-layout` 单列 + 侧栏下移 + 底部 tab（`shell.css:101-121`，本单未改 shell，仅复用）；列表/卡片间距落 `--sf-st-feed-gap(-m)`。
- **四态反馈（必有）**：每动作位都有 `加载 / 成功 / 失败 / 空态` 四态文案位（`data-sf-phase` 可机读）；空态类 `.sf-jobs-empty`（`jobs.css:139-146`）。
- **失败必走 R107 链**：全部错误文案来自 `fetchApiJson` → `apiErrorMessage`（`frontend/src/auth.js:112-156`，4b-i 已入库），页面侧 `String(error?.message || t('error'))` 兜底 ⇒ **结构化错误体不会渲染成 `[object Object]`**；探针 `contains_object_object` 两页均 `false`（见 §5）。

---

## §2 幂等键**逐面声明**（硬口径 · 依据 `文件:行号`）

> 判据（§4.5 v0.6 追加块「契约 1/2/3」）：**有自然标识 ⇒ 服务端派生**；**无自然键 ⇒ 服务端 fail-loud**。
> 「服务端已确定性派生键的面，前端**不得**自造键」（自造键 = 重试/重投变第二行）。

| # | 面（前端入口） | 判定 | 依据（`文件:行号`） | 前端行为 |
|--:|---|---|---|---|
| 1 | 发布招工 `POST /api/job`（`PublishJobPage.jsx:21-45`） | **前端提供** `cli:` 键 | `backend-ts/src/job-funds-service.ts:84`（`resolveJobCreateKeyRequired`，缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）；路由侧三载体归一 `backend-ts/src/index.ts:1303-1311` | 用 `newIdempotencyKey('cli')` 同形键（`frontend/src/idempotency.js:28-33`）+ `createIdempotencyKeyTracker`（`:50-69`）⇒**同一次操作重试复用同一个键**，成功后 `reset()`；指纹 = `cid|reward|title|description`（`job-api.js:88-90`） |
| 2 | 申请 `POST /api/job/:jobId/apply`（`JobDetailPage.jsx:70-74`） | **服务端派生** | `backend-ts/src/job-service.ts:180`（`resolveJobCreateKey(params.createKeyRaw, ['apply', jobId, workerUid])`）⇒ 键 = 实体自然标识的单射 | **不传键**（`job-api.js:63-64`，body 为 `{}`）；实测派生键 `cli:p4b2a:apply:23:12:a596caa2fd2d3385` |
| 3 | 接受 `POST /api/job/:jobId/accept`（`JobDetailPage.jsx:76-80`） | **无键面** | §4.2 J3：直 DML + 业务状态机 + 部分唯一索引 `uniq_job_application_accepted`（`backend-ts/migrations/0014_job_flow.sql:102`） | **不传键** |
| 4 | 提交 `POST /api/task-progress/:identifier/submit`（`JobDetailPage.jsx:82-87`，既有已注册面） | **服务端派生** | `backend-ts/src/job-service.ts:133`（`['submit', identifier, workerUid]`） | **不传键**（body 仅 `{info_input}`）；§2.4 **S10** 条件触发面：若将来要「同实体 + 改内容」须补 `create_key`（本单**不需要**该能力，故不动） |
| 5 | 提交（别名面）`POST /api/job/:jobId/submit` | 同 #4（同 service verb） | `backend-ts/src/index.ts:1377-1400`（`:jobId` 语义 = `identifier`） | 本单 UI 主用既有面；别名面仅由探针验证 |
| 6 | 审核 `POST /api/job/:jobId/review`（`JobReviewPage.jsx:35-47`） | **服务端派生**（事件根键） | 事件根键 = `biz:job:settle:<job_id>`（`backend-ts/migrations/0013_job.sql:592` = `commission.ts:119`）；refund = `biz:job:refund:<job_id>`（`:589`） | **不传键** |
| 7 | 我的 · 余额 `GET /api/user/asset/:uID`（`job-api.js:50`） | **纯读面（无键）** | `backend-ts/src/index.ts:487` | 只读 |
| 8 | 我的 · 流水 | **不适用** —— 读口**未注册** | 已注册 65 行路径表内**无** `/api/user/ledger`（`grep -nE "^app\.(get\|post\|put\|delete\|patch)\(" backend-ts/src/index.ts` 现取）；实测 `GET /api/user/ledger` ⇒ **`404`**（产物 `b4cii-a-http.json` → `M_probe_unregistered_ledger_endpoints`） | **留空态 + 登记**，不自造接口（`ProfilePage.jsx:341-350`） |

> **前端零自造键的自证**：新增代码内 `create_key` 只出现在 1 处（发布面），其余写面 body 均为 `{}` / `{info_input}` / `{application_id}` / `{approved}` —— 见 `job-api.js:61-79`。

---

## §3 真实链路 HTTP 读数（后端 `127.0.0.1:5788`；token 现铸自 `.env.local` 的 `SECRET_KEY`，**密钥/token 本体不落盘**，仅记 12 位指纹）

**夹具（现取，见产物 `fixtures`）**：`employer_uid=11` / `worker_uid=12` / `listed_cid=1` / `admin_uid=null`（本 run 未发现 `can_access_admin=true` 的夹具 ⇒ 审核成功面未测，见 §6）；夹具键形 = `cli:b4cii:<TAG>:*`，`TAG=b4cii30134304`。

| # | 面 | 方法/路径 | HTTP | `error.code` | 备注 / 键集 |
|--:|---|---|--:|---|---|
| 1 | 发布（缺幂等键，负例） | `POST /api/job` | **400** | `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | fail-loud 生效 |
| 2 | 发布（无 token，负例） | `POST /api/job` | **401** | `AUTH_UNAUTHORIZED` | R107 形状 |
| 3 | 发布（成功） | `POST /api/job` | **200** | — | `job_id=23`；data **17 键** = `job_id…reward`（与 spec §2 追加块 A1 = 17 键一致）；库侧 `job_escrow` **2 腿全在 uid 11**（`(-12,0)` / `(0,+12)`） |
| 4 | 发布（同键重投） | `POST /api/job` | **200** | — | 顶层 `idempotent_replay`；库侧同 `create_key` **行数 = 1**（`job_rows_for_key=1`） |
| 5 | **列表可见** | `GET /api/task/all?limit=200` | **200** | — | `job_in_list=true`，`list_len=19` |
| 6 | 详情 | `GET /api/task/23` | **200** | — | 21 键 `TaskRecord` |
| 7 | 详情 miss（负例） | `GET /api/task/999999999` | **404** | `LEDGER_REF_NOT_FOUND` | §3.1 detail-miss |
| 8 | 申请（未知 job，负例） | `POST /api/job/999999999/apply` | **404** | `LEDGER_REF_NOT_FOUND` | |
| 9 | 申请（成功） | `POST /api/job/23/apply` | **200** | — | `application_id=24`；**服务端派生键** `cli:p4b2a:apply:23:12:a596caa2fd2d3385`（`key_derived_by_server=true`）；请求体为空 |
| 10 | 申请（雇主自投，负例） | `POST /api/job/23/apply`（employer token） | **409** | `LEDGER_CURRENCY_INVALID_TRANSITION` + `reason=self_application_not_allowed` | |
| 11 | **接受（非雇主，负例 · 硬要求）** | `POST /api/job/23/accept`（worker token） | **403** | `AUTH_FORBIDDEN` | `ledger_delta=0`（零分录） |
| 12 | 接受（雇主，成功） | `POST /api/job/23/accept` | **200** | — | 库侧 `job_application.status='accepted'`、`worker_uid=12` |
| 13 | **提交（成功面）** | `POST /api/task-progress/24/submit` `{info_input}` | **200** | — | data **9 键**（`jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed`）—— 既有冻结键集 |
| 14 | 非打工人提交（负例） | 同上（employer token） | **403** | `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED` | |
| 15 | **同实体 + 异内容（**永久回归项 §4.5 契约 2**）** | `POST /api/job/24/submit`（deliverable ≠ 库内已存内容） | **409** | `LEDGER_IDEMPOTENCY_CONFLICT` | 别名面同 service verb；**没有**退化为静默 replay |
| 16 | 审核（非管理员，负例） | `POST /api/job/23/review`（worker token） | **403** | `AUTH_FORBIDDEN` | `ledger_delta=0` |
| 17 | 我的 · 余额 | `GET /api/user/asset/12` | **200** | — | **5 键** `index_id/uID/points/lucks/time_update` |
| 18 | 我的 · 流水（未注册事实） | `GET /api/user/ledger` | **404** | （裸 404 兜底，无 R107 形状 —— §9.E E4 待收口） | 前端留空态 + 登记 |
| 19 | 我的 · 积分集合（未注册事实） | `GET /api/user/points` | **404** | 同上 | §5.4 第 3 阶段 |

**库侧不变量（本 run）**：`ledger_entry` 245 → 251（Δ+6；其中可归因 = 本 run 发布面 `job_escrow`×2 = 2 腿（uid 11）、以及 13:40 中止那次 run 的 `job_escrow`×2；**其余增量未逐笔归因** ⇒ 不为「Δ全部由本片产生」背书）；`job` #23 终态 `status='submitted'`、`escrow_txid=257`、`settle_txid=null`（未结算，因审核成功面未测）。

**中途环境故障（如实登记）**：本 run 的 `S_ok` 首次调用返回 **503 `LEDGER_TX_TIMEOUT` / `reason=driver_connection_error`**（后端 DB 驱动连接失败），随即重试的下一笔才 200 ⇒ 表内 #13 的 200 即那笔重试。另有两笔 503（`A_replay_same_entity`）与 `02` 版探针的整段 503（`b4cii-a-nodb.json`：`AC_*`/`S_*`/`R_*` 多笔 503）**不是接线缺陷**，是环境级 DB 抖动；这些「以 503 记下的负例」**不作数**，已在 §6 标明。

---

## §4 红线退出码（一律在管道外捕获）

| 判据 | 命令 | 读数 |
|---|---|---|
| `npm run build` exit 0 | `npm run build > log 2>&1; echo $?` | **`BUILD_EXIT=0`**（末次构建：`✓ built in`，`dist/assets/index-*.js` 产出） |
| `npx vitest run src/test/unit` exit 0 且 **≥90 例** | `npx vitest run src/test/unit > log 2>&1; echo $?` | **`VITEST_EXIT=0`**；`Test Files 11 passed (11)` / **`Tests 90 passed (90)`** —— 与本单基线（11 文件 90 例）**逐数一致、未减少** |
| 探针退出码 | `ts-node … ; echo $?` / `node … ; echo $?` | `b4cii-a-01`：**0**（末次 run）；`b4cii-a-02`：0/1（环境 503 与 NETERR 已分别登记）；`p4z-b4cii-geometry.mjs`：**0** |

> 基线采于本单开工前同一命令：`BUILD_EXIT=0` / `VITEST_EXIT=0` / `11 files · 90 tests`（同读数）⇒ **红线 B 无回退**。

---

## §5 同构回归（主题不变量）· 探针与读数

**探针**：`frontend/scripts/p4z-b4cii-geometry.mjs`（复制 4c-i 尺子，目标页改为本单新增页 `/task/new`、`/task/review`）；产物 = `…/b4cii-a-20260930T134304/post/b4cii-geometry.json`（**末次构建后重跑**，即 §1.2 #10 的 CSS 修复已含在量测版本内）。

| 读数 | `/task/new` | `/task/review` |
|---|---|---|
| 量测选择器命中 | 12 / 14（未命中 = 无 `jobs-queue`/`jobs-refresh`，属该页无此元素） | 9 / 14（未命中 = 表单族 5 个，属该页无表单） |
| **`geometry_diff_count`（日 vs 夜 rect 逐值）** | **0** | **0** |
| `skin_changed`（真换肤证据） | `true`（`page_bg` `rgb(253,232,21)` → `rgb(11,12,14)`） | `true`（同上） |
| `same_dom_signature_day_vs_night` | `true` | `true` |
| `element_count` 日 / 夜 | 151 / 151 | 135 / 135 |
| 可重复性（同档两次逐字节） | `true` | `true` |
| 切回日档逐字节回基线 | `true` | `true` |
| 尺子灵敏度（1px 刻意错位必被判出） | **`true`**（目标 `[data-sf-m="jobs-form"]`；复原后逐字节回基线 `true`） | `false` —— **构造性 vacuous**（该页无 `jobs-form`，扰动落空）⇒ 灵敏度由 `/task/new` 臂证明 |
| 横竖屏结构签名（1440 vs 390） | `true`（底栏 `none` → `grid`，元素数不变） | `true`（同） |
| `[object Object]` 出现在页面文本 | `false` | `false` |
| 页面异常 | `ReferenceError: tailwind is not defined` ×2 | 同 |

**探针自曝（必读）**：
1. **`tailwind is not defined`（×2）** 是**既有**产物在「CDN 全 abort」环境下的产物（`dist/index.html` 引 Tailwind CDN，探针按口径 abort 外部源）⇒ 与新增页面无关；本单页面**不引用** `tailwind`。本 run 未做「不 abort CDN」的对照臂 ⇒ 该异常在真实 CDN 环境下是否消失 = **`NOT_MEASURED`**。
2. **主题切换手法**：直接改 `<html data-theme>`（`[data-theme="dark"]` 真源 `frontend/src/theme/theme-tokens.css:155`），**不经** ThemeProvider；因此本探针证明的是「**token 层**换肤不改几何」，而非「ThemeProvider 组件路径」——后者已由 4c-i 的 `/theme-preview` 臂（`window.__sfThemePreview.setTheme`）覆盖。
3. 探针经 `context.addInitScript` 注入 `localStorage['user']`（带假 token）以量测「已登录形态」；该 token 仅在本机内存、**不落盘**，且探针全程不联网（同源 `/api/**` 落 dist 兜底 `index.html` ⇒ 页面进**确定性失败态**，失败态几何也被一并量测）。

---

## §6 `NOT_MEASURED`（禁当 0/空使用）

| 项 | 状态 | 原因 / 依据 |
|---|---|---|
| **审核成功面（approve ⇒ settle / reject ⇒ refund）** | **`NOT_MEASURED`** | 本 run 夹具面未发现 `can_access_admin=true` 的用户（`fixtures.admin_uid=null`，扫 uid 1..40 + 历史夹具 uid 的 `/api/admin/me`）；负例（非管理员 `403`，`ledger_delta=0`）**已测**。⇒ 结算资金形态读数**不在本单**（真源另见 4a/QA-B4 的 A5 面） |
| `/api/tasklist/pending-verification` 队列读（管理员） | **`NOT_MEASURED`**（同上夹具缺口）；`02` 版探针曾取到 `200`，但该轮夹具 worker 误选为管理员 uid ⇒ **该读数作废**（自曝见下） | |
| 「同实体 + 同内容 ⇒ 200 replay」（提交面） | **`NOT_MEASURED`** | 首笔提交落到 503（环境），使后续「异内容」那笔变成了**首次**成功提交 ⇒ 该 run 未出现「同内容重投」；**同实体 + 异内容 ⇒ 409 已测**（#15），即契约 2 的判负侧已落证 |
| `GET /api/task-progress/:jID` 详情读（前端未消费） | `NOT_MEASURED`（本单未接） | 接线范围只到「我的报名」列表（`GET /api/task-progress`） |
| 按招工列申请者的读口 | **不存在**（不是 Not Measured，而是**未注册**） | 已注册表内无该路径 ⇒ 接受面 UI 改为**手填 application_id** + 四语文案说明（`JobDetailPage.jsx:151-153`、locale `jobs.acceptNote`）+ 本表登记 |
| 币种列表/详情读口 | **未注册**（`GET /api/currency*` 不在 65 行路径表内）⇒ 发布面 `cid` 手填（默认 `1` = 平台 `$`）+ 文案说明 | 同上，登记 |
| 审核面的**雇主视角** | `NOT_MEASURED`（口径问题） | 队列读口的权限闸 = `requireAdmin(review_tasks)`（`backend-ts/src/index.ts:1094`）⇒ 雇主侧队列**当前不可达**；与 `data-layer.spec` C7「队列归雇主视角」存在张力 ⇒ **登记待裁定**（本单不改后端、不自造读口） |
| 真实 CDN 环境下的页面异常 | `NOT_MEASURED` | 见 §5 探针自曝 1 |
| 库侧逐笔归因（`ledger_entry` Δ+6） | 部分 `NOT_MEASURED` | 仅 `job_escrow`×2（本 run）+ 中止 run 的 ×2 可归因，其余未逐笔归因 |

---

## §7 边界自证（本单**没做**什么）

1. **后端零改动**：`backend-ts/src/**` 未写（本单新增文件只在 `backend-ts/scripts/` 与 `.p4-artifacts/`）；`migrations/**`、任何 spec、`docs/seafood.master-plan.md`、`.env.local`、既有 audit/qa 件、`docs/design/style-preview.html`、**token 值本身**均未改。
2. **未注册面不接**：`/api/user/ledger`、`/api/user/points`、`GET /api/currency*`、按招工列申请者的读口 —— 前端**不调用**、**不自造**，一律空态 + 登记（§6）。
3. **未引入主题分支结构**：新增 CSS/JSX 内 **无** `matchMedia` / `innerWidth` / `[data-theme]` 选择器（可用 `grep -rn "matchMedia\|innerWidth\|data-theme" frontend/src/pages/jobs` 现取 = 0）；几何量一律走 `--sf-st-*` / `--sf-j-*` 结构常量。
4. **幂等键不自造**：见 §2 —— 服务端派生面一律不传键（代码级自证 = `job-api.js:61-79`）。
5. **未用删除型 SQL**、未 `git add/commit/push`、未 `npm install`、未下载浏览器（探针复用本机 Chrome，`executablePath` 直指 `/Applications/Google Chrome.app/...`）、未起常驻 dev server（探针用 `page.route` 映射 `dist`）。
6. **未停/未启任何项目服务**（后端 5788 与面板未动；本单只读 `curl`/HTTP 调用）。
7. **`git status` 边界自证（现取）**：本单写面无越界 —— 新增/改动 = `frontend/src/{App.jsx,locales/*.json,pages/{TaskPage,ProfilePage}.jsx,pages/jobs/**}`、`frontend/scripts/p4z-b4cii-geometry.mjs`、`docs/audit/p4-b4c-ii-a-jobs-profile.md`、`backend-ts/scripts/p4z-b4cii-a-0{1,2}-*.ts`、`backend-ts/.p4-artifacts/b4cii-a-*/**`。
   **两处必须点名的边界事实**：① `git status` 里 `M backend-ts/src/{index.ts,database.ts}` **不是本单所为**（本单对 `backend-ts/src/**` 只读；同机另有并发单元 `p4z-a1li-01-e2e.ts` / `.p4-artifacts/a1li-*` 在写该面）——**不得**把这两处改动记在本单名下；② run tag 落在 `backend-ts/.p4-artifacts/B4CII_RUN_TAG.txt`（该目录根、非 `b4cii-a-*/` 内）：这是该目录既有惯例（`RUN_TAG` / `B4B_RUN_TAG.txt` / `QA_B4_RUN_TAG.txt` 均如此），**如实登记**。

---

## §8 自曝（本单的口径缺陷与踩坑）

1. **`01` 探针首跑在「提交」步崩于我自己写的核对 SQL**：`SELECT … FROM public.job_submission WHERE application_id = …` —— 真列名是 `job_id` / `worker_uid`（真源 `backend-ts/migrations/0014_job_flow.sql:115-133`），**不是** `application_id`（那是 `job_application` 的列）。⇒ 已修（`p4z-b4cii-a-01-http.ts` 提交步核对改为 `job_id + worker_uid`）。**教训**：核对 SQL 的列名必须现取 schema，不得由同名概念推断。
2. **`02` 探针的 worker 夹具误选管理员**：首版 `worker = alive.find(u => u !== employer)` 会选中 uid 1（管理员）⇒ 出现 `Q_neg_non_admin_403` 实为 `200`、`R_neg_non_admin` 实为 `409` 这类**假读数**。已修（排除 `admins`）；但**这些作废读数仅存在于 `b4cii-a-nodb.json` 的早期轮次**，本报告 §3 的表格**只取 `01` 探针末次 run**（该 run 的 worker=12、admin=null，未受影响）。
3. **环境级 DB 抖动**：`@neondatabase/serverless` 直连与本机后端均出现 `fetch failed` / `driver_connection_error` / `LEDGER_TX_TIMEOUT`（多轮）⇒ 本单有 3 次重跑。**读数异常先怀疑自己**这一条在本单双向成立：既查到自己的 SQL 列名错（#1），也确证了环境抖动（`/health` 正常而 API 面 503）。
4. **几何证据的时间戳**：首轮几何量测发生在我修 `--sf-j-*` 常量**之前** ⇒ 已在末次构建后**重跑**探针（本报告 §5 读数即重跑结果），并保留该口径说明，避免「旧构建证据套新代码」。
5. **`02` 探针保留在库**（`p4z-b4cii-a-02-http-nodb.ts`）：它是 DB 不可用时的降级取证工具，已按纪律标 `db_used:false` 与 `not_measured: db_legs`，**不得**被读成「完整链路带库侧证据」。
