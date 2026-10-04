# S17a · 前端放开 `/task/review` 的门（使 S16 后端放宽对普通发布者真正生效）

**单号**：S17a
**角色**：Kong
**开工基线**：`git log --oneline -1` = **`9bd1df0`**（S16 后端已入库）
**口径**：**只改前端**（`frontend/src/**`）+ 报告；**不 commit / push**；**不碰** `backend-ts/src/**`、`backend-ts/scripts/*.ts`（S17b 并行面）、`migrations/**`、`docs/*.spec.md`。

---

## 1. 缺陷（前端门未开，后端放宽对普通用户无效）

| # | 落点（改前） | 事实 |
|---|---|---|
| ① | `frontend/src/pages/jobs/JobReviewPage.jsx:51` | `canReview = hasAdminPermission(access,'review_tasks')` ⇒ 普通发布者整页收敛为 `jobs-review-denied`、**根本不发起队列读** |
| ② | 后果 | S16 后端已放宽读口准入为「admin ∨ 已登录」，但前端门没开 ⇒ **后端放宽对普通发布者无效**（普通发布者连请求都发不出） |

**修法**：`canReview` 改为「**已登录即可**」（唯一真源 = 后端过滤）；未登录仍渲染登录提示且**不发起读**；★ **不另写前端过滤**（后端 `resolveReviewQueueScope` 为唯一真源，避免两处各写一套）。

---

## 2. 改动逐处（仅 `frontend/src/**`）

### 2.1 `frontend/src/pages/jobs/JobReviewPage.jsx`

| 处 | 改动 |
|---|---|
| `:40` | `const canReview = isAuthenticated`（**改前** = `hasAdminPermission(access,'review_tasks')`） |
| `:42-44` `load()` | 未登录 ⇒ `if (!canReview) return`（**不发起队列读**；改前落 `phase:'denied'`） |
| `:9` | **删** `import { fetchAdminAccess, hasAdminPermission } from '../../admin-utils'`（该页不再取 admin 能力集） |
| `:35-40` | **删** `access` / `accessPhase` 状态 + `fetchAdminAccess` effect（整段 admin 闸机器）；改为 S17a 说明注释 |
| `:74-82` | **删** 「能力集加载态 `jobs-review-gate`」与「无权限空态 `jobs-review-denied`」两分支；**保留** `!isAuthenticated` 早返回（渲染 `pleaseLogin`、不发读） |
| `:11-16` | 文件头注释同步：读口 = `index.ts:1989`；★ S16 准入 + S17a 前端放开 |

**唯一门 = 登录态**；**页面无其它 admin 专用 UI**（侧栏 `jobs.review`/`jobs.reviewNote` 为静态文案，非按权限分叉）⇒ 只放开队列读的门，其余不动。

### 2.2 测试面

| 文件 | 改动 |
|---|---|
| `frontend/src/test/unit/s17a-review-page-access-gate.test.jsx`（**新增 · 3 例**） | ① 已登录普通发布者 ⇒ 不渲染 `jobs-review-denied`、队列读 **1 次**、请求路径**不带**发布者/雇主参数（前端零过滤）；② 已登录路径**不**请求 `/api/admin/me`（门 = 登录态非 admin）且无 `jobs-review-gate`；③ 未登录 ⇒ 渲染 `pleaseLogin`、队列读 **0 次** |
| `frontend/src/test/unit/listing-market.test.jsx`（**改 1 例 + describe 标题**） | 旧断言「非 admin ⇒ `jobs-review-denied` + 队列读 0」= **已作废** ⇒ 改为「已登录普通发布者 ⇒ 不 denied + 队列读 1 + 路径无过滤参数」。**PublishJobPage 两条用例原样保留**（该页未动） |

> 口径：真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 `s13-review-page-submission-id` 先例）；i18n 用真 zh 词典。

---

## 3. 文案（locale 零变更 · 交裁登记）

- `git diff --stat -- frontend/src/locales` = **空**（四语 locale **一字未改**）。
- **本单未改任何文案值**；按要求凡「语义变化致文案成假话」者**单列交裁、不自改**。
- **交裁登记结论 = 空（无因 S17a 语义变化而变假的文案）**：逐键核过本页 `t(...)` 的**值面**——
  - `jobs.review` =「审核入口」/「Review queue」/「審核入口」/「Hàng chờ duyệt」——**均未出现「管理员」字样**，对「发布者自审」不构成假话；
  - `jobs.reviewNote` / `jobs.approve` / `jobs.reject` / `jobs.queueEmpty` 等同理，均为「审核」通称，无 admin 专属表述。
- **另列·既有观察（非 S17a 引入、本单未改）**：`jobs.itemTitle` = zh「招工 #{{job}} · **申请** #{{app}}」——`app` 实为 `submission_id`（提交号），标签「申请」是 **S4a 换轴遗留**（改前即如此，与 S17a 的「admin→发布者」语义变化**无关**）⇒ 交父单裁（供并批，不在本单范围）。

---

## 4. 测试与构建读数

| 项 | 读数 |
|---|---|
| 基线（改前全量） | `Test Files 4 failed \| 46 passed (50)`；`Tests 7 failed \| 444 passed (451)` |
| 改后全量 | `Test Files 4 failed \| 47 passed (51)`；`Tests 7 failed \| 447 passed (454)` |
| **Δ** | **failed 7 → 7（零新增）**；**+1 文件 / +3 用例全绿**；失败集**逐条不变**（既有 `Card`×6 + `VirtualList`×1 + `Accessibility`/`e2e` 收集失败） |
| 定向（新 + 受影响） | `s17a…` + `listing-market` + `s13…` = **26 passed (26)** |
| **负对照** | 临时把 `canReview` 钉死为 `false`（模拟门未开）⇒ `s17a` 文件 **2 failed \| 1 passed (3)**（两条「已登录」断言全红；未登录断言不受影响）⇒ 门已放开是**可判负**的（非假门） |
| `npm run build` | **exit 0**；产物 `dist/assets/index-vqP1mQZz.js`（**419.64 kB**）+ `dist/assets/index-BKka7fLt.css`（126.09 kB）（JS 由 S13 的 `index-TQYNpynj.js` 420.23 kB 减小 ⇒ 移除 admin 闸代码生效） |

---

## 5. 真 HTTP 端到端（受控实例 **5796** · 真库 `schema_version=0042`）

**口径说明**：受控实例 = **API 后端** `PORT=5796 npx ts-node --transpile-only src/index.ts`（`--strictPort` 为 Vite 参数，后端不适用 ⇒ 以 `PORT=5796` 硬钉 + `lsof` 空读数代替）；三臂 = 对 S16 入库版后端的复跑（S17a 只改前端，后端逐字不变）。
**前端「不再渲染 denied」口径** = **组件级测试**（`s17a-review-page-access-gate.test.jsx` ①；真 job-api + 真 fetchApiJson + stubbed fetch）——即「普通发布者下页面不再渲染 `jobs-review-denied` 且发起队列读」的直接判定。
探针：`~/…/scratch/s17a/arms.ts`（产物 `arms-out.json`）。fixture（`worker=12` 非 admin）：

| fixture | 提交号 | 落在 job（雇主） | 发布者 3 应否可见 |
|---|---|---|---|
| FX-OWN | **245** | job 22（雇主 **3** 非 admin） | **应见** |
| FX-OTHER | **246** | job 23（雇主 **11** 非 admin） | 不应见 |
| FX-ADMINJOB | **247** | job 24（雇主 **1** admin） | 不应见 |

| 臂 | 请求 | 读数 |
|---|---|---|
| **(a) 普通发布者 uid 3** | `GET …/pending-verification` + `/count`，Bearer(3) | **200**；`item_ids=[245]`、`job_ids=[22]`、`count_field=1`；item 键 11 个 |
| **(b) admin uid 1** | 同上，Bearer(1) | **200**；`item_ids=[245,246,247]` **== 全局口径（零回归）**；`count_field=3` |
| **(c) 未登录** | 两口无 token | **401 `AUTH_UNAUTHORIZED`**（list/count 双口） |

**判负 3 条**（全绿）：① 发布者集 `[245]` **严格真子集**于全局 `[245,246,247]`（隐藏 `[246,247]`）；② 跨发布者隔离：uid 11 ⇒ `ids=[246]`、`jobs=[23]`；③ 未登录 **401**（非 200/非 403）。
**净写 0**：`req_sum = {d_le:0, d_jobs:0, d_subs:0}`（对照窗口同 0）。
**清理**：`245/246/247` → **`rejected`**（`reviewed_by=1`）；**可见 pending 复原为 `[]`**（探针 `all_pass=true`，17/17 检查通过）。
★ 探针全程 PASS；`failures=[]`。

---

## 6. 六类泄漏 = 0

口径（承 route-layer §19.5(c)/§26.6(c)）：用户可见文案（`t(...)` 值面）不得出现 ①章节号/条号 ②HTTP 状态码 ③接口路径/方法 ④内部批次名/单号 ⑤机读码/裸 i18n 键 ⑥表名/列名/函数名。
扫描器：`~/…/scratch/s17a/leakscan.mjs`（四语 locale 值面全量）。

| 类 | 命中 |
|---|---|
| ①章节号/条号 · ②HTTP码 · ③路径 · ④单号 · ⑤机读码 · ⑥表名列名 | **0 / 0 / 0 / 0 / 0 / 0** |

节点数 = 四语各 `1059` 拍平键；**六类泄漏总命中 = 0**（且 `git diff` 证明 locale 零变更 ⇒ 沿承基线 0）。

---

## 7. 实例收尾

| 项 | 读数 |
|---|---|
| 精确 `kill -TERM` | PID **`44523`**（LISTEN · `ts-node --transpile-only src/index.ts`）+ 父 **`44144`**（`npm exec ts-node`）|
| `lsof -nP -iTCP:5796 -sTCP:LISTEN` | **空读数**（`PORT_5796_FREE`）|
| `lsof -nP -iTCP:5793-5799 -sTCP:LISTEN` | **空**（未占 5796 以外端口；未启停 5787/5788）|
| 残留 `ts-node src/index.ts` 进程 | 无 |

---

## 8. 改动清单 / 边界

| 文件 | 类型 |
|---|---|
| `frontend/src/pages/jobs/JobReviewPage.jsx` | 改（放门 + 删 admin 闸机器） |
| `frontend/src/test/unit/s17a-review-page-access-gate.test.jsx` | **新增** |
| `frontend/src/test/unit/listing-market.test.jsx` | 改（1 例 + describe 标题） |
| `docs/audit/s17a-review-page-gate-open.md` | 本报告 |
| `docs/audit/s16-review-queue-scope.md` | S16 报告**补写**（本单第 ④ 项） |

- ✅ 只改 `frontend/src/**` + `docs/audit/**`；**未碰** `backend-ts/src/**`、`migrations/**`、`docs/*.spec.md`、`frontend/src/locales/**`。
- ✅ 未碰 S17b 并行面（`backend-ts/scripts/*.ts` 的既有改动 `p3j-02-cases.ts` / `s17b-*.md` 与本单无关，**原样未动**）。
- ✅ 不 commit / push；不 `npm install`；探针在 `~/…/scratch/s17a/`（**非**仓库 `scripts/`）；未复制/回显 `.env*` / 令牌。
- ✅ 未使用 `pkill -f` / `killall`；实例按精确 PID 收尾。

### 未测项（如实标注）

- **真浏览器视觉**：未起前端 dev/preview 服务走真浏览器（前端 `不再 denied` 用**组件级测试**口径代替，已注明）。
- **后端单测套件**：S17a 未跑 `backend-ts` 套件（本单未改后端；后端三臂用真 HTTP 覆盖）。
- **`--strictPort`**：为 Vite 参数，后端实例不适用 ⇒ 以 `PORT=5796` 硬钉 + `lsof` 空读数替代（已在 §5 注明）。
- **文案「假话」**：`jobs.itemTitle`「申请 #」为 S4a 换轴遗留（非本单引入），已登记供父单裁，本单未改。
