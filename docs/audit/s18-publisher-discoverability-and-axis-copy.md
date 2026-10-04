# S18 · 发布者可发现性入口 + 换轴遗留文案（四语值）

**单号**：S18
**角色**：Kong
**开工基线**：`git log --oneline -1` = **`8781640`**（S17a/S17b 已入库）
**口径**：只改 `frontend/src/**`（页面/组件/`locales/**`/测试）+ 本报告；**不 commit / push**；**不碰** `backend-ts/**`、`docs/*.spec.md`、`migrations/**`。

> 本单 = 父单 C 项「S17a 另报两条真缺口」的落地：① 发布者可发现性（`PublishJobPage` 审核入口链接 + `DashboardPage` 队列面板）；② 换轴遗留文案（`jobs.itemTitle` 及同族键，改值不改键）。

---

## 1. 现取（改前）

| # | 落点（改前，现取） | 事实 |
|---|---|---|
| ① | `frontend/src/pages/jobs/PublishJobPage.jsx:34` | `const canReview = hasAdminPermission(access, 'review_tasks')`（能力集取自 `fetchAdminAccess` effect）⇒ 入口 `Link[data-sf-m=jobs-review-link]` 仅 admin 渲染 ⇒ **普通发布者发完任务后无「去评判」入口** |
| ② | `frontend/src/pages/DashboardPage.jsx:120,259` | `canReviewTasks = hasAdminPermission(access(Info),'review_tasks')`：既**控队列读口**（`/api/tasklist/pending-verification[/count]` 是否发请求），又**控面板渲染**（`!canReviewTasks ? noReviewPermission : 队列`）|
| ③ | `/task/review` 门 | 已由 S17a 放开为 `isAuthenticated`（`JobReviewPage.jsx:43`）；后端 S16 已把读口准入放宽为「admin（持 `review_tasks`）∨ 已登录」⇒ **①②应与③同口径** |
| ④ | 文案 `jobs.itemTitle`（四语） | zh「招工 #{{job}} · **申请** #{{app}}」—— `{{app}}` 实参 = `item.jID` = **`submission_id`**（`JobReviewPage.jsx:115`）⇒ 标签「申请」**实指提交** ⇒ 随 `R-9-100` 换轴已成假话 |

---

## 2. 改动逐处（仅 `frontend/src/**`）

### 2.1 `PublishJobPage.jsx` —— 审核入口「已登录即可见」

| 处 | 改动 |
|---|---|
| `:34` | `const canReview = isAuthenticated`（**改前** = `hasAdminPermission(access,'review_tasks')`）|
| `:105` | `// ★ S18：审核入口 = 已登录即可见（与 /task/review 同口径）；未登录 ⇒ 上方早返回、此处不渲染` |
| 删 | 整段 admin 闸机器：`const [access, setAccess]` + `fetchAdminAccess` effect + `import { fetchAdminAccess, hasAdminPermission }`（该页不再取 admin 能力集）|
| 删 | `useEffect` 从 react import 移除（effect 删后成死 import）|
| 保留 | `!isAuthenticated` 早返回（渲染 `pleaseLogin`、不渲染入口）——**未登录仍不显示/提示登录** |

★ **不另写过滤**：入口只负责「已登录就展示」，内容/准入唯一真源 = 后端 `resolveReviewQueueScope`。

### 2.2 `DashboardPage.jsx` —— 队列面板门「已登录即可见」

| 处 | 改动 |
|---|---|
| `:120`（`loadDashboardData`）| `const canReviewTasks = isAuthenticated`（**改前** = `hasAdminPermission(accessInfo,'review_tasks')`）⇒ 已登录即**发**队列读（`/pending-verification` + `/count`）|
| `:259-260` | 删 render 作用域 `canReviewTasks`；**角色徽标**改回按既有权限口径 `hasAdminPermission(access,'review_tasks')`（语义不变，不随门漂移）|
| `:419-516` | 删 `!canReviewTasks ? (「无审核权限」空态) : (队列)` 三分支 ⇒ 队列直达（门放开后该空态在现门面下**不可达** ⇒ 按本仓「禁死代码」删除；四语键 `dashPage.noReviewPermission*` **保留**）|

★ **不另写过滤**（内容由后端定）；未登录 ⇒ 路由 `ProtectedRoute` 导登录 + 组件 effect 清空（不发读）。

### 2.3 文案（**只改值、不动键**）—— 4 键 × 4 语

| 键 | zh | hk | en | vn |
|---|---|---|---|---|
| `jobs.itemTitle`（点名单） | 招工 #{{job}} · **提交** #{{app}} | 招工 #{{job}} · **提交** #{{app}} | Job #{{job}} - **submission** #{{app}} | Việc #{{job}} - **bài nộp** #{{app}} |
| `jobs.myApps` | 我的**提交** | 我的**提交** | My **submissions** | **Bài nộp** của tôi |
| `jobs.myAppsEmpty` | 暂无**提交**记录 | 暫無**提交**記錄 | No **submissions** yet | Chưa có **bài nộp** |
| `jobs.submitNotApplicant` | 这份**提交**不属于你，只有**提交人**本人才能提交交付物。 | 呢份**提交**唔屬於你，只有**提交人**本人先可以提交交付物。 | This **submission** is not yours; only the **submitter** can submit a deliverable. | **Bài nộp** này không thuộc về bạn; chỉ **người nộp** mới có thể nộp sản phẩm. |

- 术语对齐既有四语真源（`jobs.submissionItemTitle`/`submissions`）：「提交」/"Submission"/"Bài nộp"。
- `jobs.itemTitle`/`jobs.myApps` 的 zh≡hk（「提交」「我的提交」在繁简下同形），与既有 `submissions`/`submissionItemTitle` 的 zh≡hk 同族，非缺陷。

**同族键处置（★ 不止点名单一个；全量扫面 = 四语 locale 值面，`报名|申請|申请|application|applicant|ứng tuyển` 全命中，逐处给判）**：

| 键 | 处置 | 依据 |
|---|---|---|
| `jobs.itemTitle` | **改值** | 实参 = `submission_id`（点名单）|
| `jobs.myApps` | **改值** | LIVE：`JobDetailPage.jsx:324` 侧栏标题，列表项 `#{item.jID}` = `submission_id` |
| `jobs.myAppsEmpty` | **改值** | LIVE：同上列表空态（`:73/:328`）|
| `jobs.submitNotApplicant` | **改值** | LIVE：`JobDetailPage.jsx:47`/`ActiveTaskModal.jsx:28` 错误文案；「这份申请」= 提交实体 |
| `jobs.participants` | **登记（不改值）** | LIVE（`JobDetailPage.jsx:215`）但 `participants_count` **源 = 后端 `COUNT(*) FROM job_application`**（`database.ts:2534/:2563`，`R-9-100` 已停写该表）⇒ 非 `submission_id`；只改标签=**新假话** ⇒ 须连同字段源一并裁 |
| `jobs.apply`/`applyOk`/`accept`/`acceptNote`/`acceptOk`/`applicationId`/`submitNeedApply`/`applyPrompt`/`applyWaiting`/`pick` | **登记（不改值）** | **死键**：J2 报名/J3 选定两写面已下架（恒 `410 APPLY_RETIRED`/`ACCEPT_RETIRED`），前端**零引用**；且 `r9-90 ⑥` 要求四语齐备保留、`i18n-violation-closeout ④` 钉字 `jobs.acceptNote` 含「只有雇主」⇒ 本单不改，随死键退役另单处置 |
| `common.joinNow`/`taskPage.continueTask`/`jobs.submitNote` | 交叉引用（**非**「申请/报名」命名）| 已由 `s3b-frontend-contract-sync.md` 登记表在册，本单未动 |

---

## 3. 测试

| 文件 | 改动 |
|---|---|
| `test/unit/listing-market.test.jsx` | describe 标题改「S17a 队列页已登录即可；S18 发布页入口链接同口径」；**改 2 例 + 删 1 例**：① 新增「S18 已登录普通发布者（无 review_tasks）⇒ 发布页**渲染** `jobs-review-link`（href=`/task/review`）+ **不**请求 `/api/admin/me`」（内建负对照：`hasAdminPermission` 恒 false）；② 新增「S18 未登录 ⇒ 渲染 `pleaseLogin`、无入口链接」；③ 原「admin：发布页才显示链接」改为「admin：审核页取队列（零回归）」 |
| `test/unit/dashboard-page.test.jsx` | **新增 1 例**：「S18 已登录用户（无 review_tasks）⇒ 队列面板按登录态放开」——`fetchAdminAccess.can_access_admin=true` 且 `hasAdminPermission` 恒 false ⇒ 断言 `/pending-verification?limit=50` 取数 1 次、无「当前账号没有审核权限」、队列项渲染（内建负对照）|

★ **负对照（实测）**：把两处门临时钉死 `false`（模拟回退 admin-only）⇒ `listing-market` 的「S18 发布页渲染入口」**红** + `dashboard-page` 3 例全 **红**（含 S18 例）= **`4 failed | 18 passed (22)`** ⇒ 门已放开是**可判负**的（非假门）。已复原。

---

## 4. 读数（自证）

| 项 | 改前（基线） | 改后 | Δ |
|---|---|---|---|
| 四语拍平键数 / 顶层键 | `1059 / 119`（四语各）| `1059 / 119`（四语各）| **0**（只改值、键不动）✅ |
| `npx vitest run` 全量 | `Test Files 4 failed \| 47 passed (51)`；`Tests 7 failed \| 447 passed (454)` | `Test Files 4 failed \| 47 passed (51)`；`Tests 7 failed \| **449 passed (456)**` | **failed 7 → 7（零新增）**；+2 用例全绿 ✅ |
| 失败集（逐条不变）| `Accessibility.test.jsx`（收集）、`e2e/basic.spec.js`（Playwright）、`Card.test.jsx` ×6、`VirtualList.test.jsx` ×1 | **逐条相同** | 无因果 |
| 定向（本单 + 受影响）| — | `listing-market` + `dashboard-page` + `s17a` + `r9-90` + `r9-88` + `s7-submissions-panel` = **6 files / 78 passed**；`i18n-violation-closeout` + `i18n-batch-b4a` = **2 files / 10 passed** | 全绿 |
| `npm run build` | （S17a 基线产物 `index-vqP1mQZz.js` 419.64 kB）| **exit 0**；`dist/assets/index-BmxJHl7t.js`（**419.14 kB**）+ `dist/assets/index-BKka7fLt.css`（126.09 kB）| 0 ✅ |

**改动面**（`git diff --stat`，8 文件 / +82 −58，**全在 `frontend/src/**`**）：`locales/{zh,hk,en,vn}.json`（各 8 行=4 值）、`pages/jobs/PublishJobPage.jsx`、`pages/DashboardPage.jsx`、`test/unit/dashboard-page.test.jsx`、`test/unit/listing-market.test.jsx`。**未碰** `backend-ts/**`、`docs/*.spec.md`、`migrations/**`。

---

## 5. 六类泄漏 = 0

口径（承 route-layer §19.5(c)）：①章节号/条号 ②HTTP 状态码 ③接口路径/方法 ④内部批次名/单号 ⑤机读码/裸 i18n 键 ⑥表名/列名/函数名。

| 扫描器 | 读数 |
|---|---|
| 本仓 canonical `frontend/scripts/p4z-i18nviol-global.mjs` | **总判 PASS**：locale 裸命中 **0** + 源面裸命中 **0**；作用域节点 = 4236（键 1059 × 语 4）/ source 48 |
| 本单独立六类扫描（四语 locale 值面全量 4236 节点）| ①/②/③/④/⑤ = **0 / 0 / 0 / 0 / 0** |
| 附：⑥ 严格扫面 | **4 命中，全为 `adminPermissions.permissionsPlaceholder`（四语）**——`admin` 设置面**占位示例文案**（示例权限名 `review_tasks, publish_prizes`），**本单未改动、非本单引入** ⇒ 如实登记（交裁：admin 占位面是否纳入 ⑥）|
| 本单**改动面**（4 键 × 4 语）六类 | **0**（改后值仅含「提交/submission/bài nộp」等白话，无任何工程口径字面量）|
| en/vn 零 CJK（改动的 4 键 × en/vn = 8 值）| **0**（`bài nộp` 为越南语带附加符、非 CJK）|

---

## 6. 边界与交裁登记

1. **★ `DashboardPage` 可达性边界（如实纠正父单前提）**：`DashboardPage` 的队列面板门**已**放开为登录态；但该页**仍**受两层 admin 闸约束——路由 `App.jsx:268-275`（`ProtectedRoute adminOnly`）+ 组件 `if (!isAdmin) return noPermission`（`:288`）。⇒ 该面板**实际可达者 = `can_access_admin` 用户**（此前被 `review_tasks` 二次挡；现已放行）；**普通非 admin 发布者仍到不了 `/dashboard`**。故：**普通发布者的真正可发现性修复 = §2.1 的 `PublishJobPage` 审核入口链接**（发完任务即见「审核入口」）；`DashboardPage` 门放开为**同族对齐**。若父单要求「普通发布者亦直达 dashboard 队列面」，须另裁「是否放开路由/页面 admin 闸」（会牵连 `totalUsers/adminUsers/totalPoints` 等**平台级统计**曝光）⇒ **登记待裁**。
2. `jobs.participants`：标签假话根因在**后端字段源**（`participants_count` = `job_application` 遗留行数，`R-9-100` 停写）⇒ 须「标签 + 字段源」一并裁，本单**不改值**（只改标签=新假话）。
3. 死键 10 个（§2.3 表）：J2/J3 下架遗留，前端零引用；本单**不改值**（改死字符串无用户效果，且 `acceptNote` 被既有测试钉字）⇒ 交裁为「随死键退役另单」。
4. `dashPage.noReviewPermission*` 两键：JSX 使用点已删（不可达分支），**locale 键保留**（未删，计数不变）。

---

## 7. 硬口径守约自查

- ✅ 不 commit / 不 push；未 `npm install`；未碰/未打印 `.env*`。
- ✅ 未用 `pkill -f` / `killall`；未启停 5787/5788；**未起服务/占端口**（全程只 `npx vitest run <文件…>` / `npm run build` / 只读 `node` 扫描）。
- ✅ 只改 `frontend/src/**` + `docs/audit/`；未碰 `backend-ts/**`、`docs/*.spec.md`、`migrations/**`。
- ✅ 未新增 locale 键（四语键集不变，计数 1059/119 前后一致）；未改键名。
- ✅ 原始输出未落 `.log` 后缀文件。

### 未测项（如实标注）

- **真浏览器视觉 / 真 HTTP 端到端**：本单为**前端入口 + locale 值**改动，未起服务、未占端口（硬口径禁）；前端门放开用**组件级测试**口径（真组件 + mock `useAuth`/`fetch`）判定，未走真浏览器。
- **后端单测/真库**：未跑 `backend-ts` 套件（本单未改后端；队列过滤真源不在本单面）。
- **`vitest` 全量 `--coverage`**：未跑（非本单口径）。
