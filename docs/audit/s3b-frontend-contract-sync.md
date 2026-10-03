# S3b-c 收尾报告 · 前端契约同步（招工线 J2/J3 下架 · 提交口换轴）

- **单号**：S3b-c（S3b 收尾补单 · 承前单迭代上限）
- **作者角色**：Kong（Implementer / 实现员）
- **基线**：`git log --oneline -1` = `f87d268`（开工现取）
- **仓库**：`/Users/kevin/bistro/seafood`（本单**不 commit / 不 push**）
- **本单允许改的文件面**：`frontend/src/test/unit/**`（修被改红的测试）+ 本报告。★ 未动任何产品源码、`backend-ts/**`、`docs/*.spec.md`、`migrations/**`、`frontend/src/locales/**`。

## 结论（先说）

| 项 | 读数 | 判 |
|---|---|---|
| ① 修 2 个新增失败（d1 ③/④） | 全量 vitest：**5 files / 9 tests failed → 4 files / 7 tests failed**（= 基线），零新增残留 | ✅ |
| ② `npm run build` | **退出码 0**，产物见 §(e) | ✅ |
| ③ 六类泄漏扫描 | **总判 PASS**：locale 裸命中 **0** / 源面裸命中 **0** / 类级残余 **0** | ✅ |
| ④ 报告 | 本文件 | ✅ |

---

## (a) 调用点全量清单（文件:行 · 旧值 → 新值 · 含「已不再调用」）

> 本单前序（S3b）已在**产品源码面**完成「删调用」。下表为**现取**清单（来源 = `git diff` + `grep`）；「旧值」= 删前形态，「新值」= 现取形态。**本收尾单未再改产品源码**。

### a-1 接线层 `frontend/src/pages/jobs/job-api.js`

| 位置（删前） | 旧值 | 新值 |
|---|---|---|
| 文件头 ②/③ 依据块 | `POST /api/job/:jobId/apply`（J2 服务端派生键）/ `POST /api/job/:jobId/accept`（J3 无键面）**登记为在用写面** | 两行改注为**已下架**（恒 `410` + `details.reason = APPLY_RETIRED / ACCEPT_RETIRED`）⇒ 本层**零接线** |
| `export const applyToJob = (jobId, user) => postJson(\`/api/job/${jobId}/apply\`, {}, user)` | 导出在用 | **已删除**（文件现取无此符号） |
| `export const acceptApplication = (jobId, applicationId, user) => postJson(\`/api/job/${jobId}/accept\`, { application_id: applicationId }, user)` | 导出在用 | **已删除**（文件现取无此符号） |

### a-2 `frontend/src/pages/jobs/JobDetailPage.jsx`

| 位置 | 旧值 | 新值 |
|---|---|---|
| 导入（现 `:8`） | `import { applyToJob, acceptApplication, fetchJobDetail, fetchMyApplications, submitDeliverable } from './job-api'` | `import { fetchJobDetail, fetchMyApplications, submitDeliverable } from './job-api'` |
| `onApply`（删前 ~`:343`） | `const onApply = async () => { … () => applyToJob(jobId, user) … }` | **已删除** |
| `onAccept`（删前 ~`:357`） | `const onAccept = async () => { … acceptApplication(jobId, applicationId, user) … }` | **已删除** |
| 报名按钮（删前 ~`:392-397`） | `<button … data-sf-m="jobs-apply" onClick={onApply} …>` + `data-sf-m="jobs-apply-status"` | **已删除**（面板整块下架） |
| 选定面板（删前 ~`:447-464`） | `data-sf-m="jobs-accept-panel"` / `jobs-accept` / `jobs-accept-status` / `jobs-input-accept` | **已删除** |
| 提交前置提示（删前） | `data-sf-m="jobs-submit-need-apply"`（无本人申请 ⇒ 给「先参与」提示） | **已删除**；现取改为**无报名前置直出**提交表单 `data-sf-m="jobs-submit-form"`（`:174`），提交 `identifier = jobId`（`:101`）、只读目标 `data-sf-m="jobs-submit-target"`（`:179`） |

### a-3 `frontend/src/components/ActiveTaskModal.jsx`

| 位置 | 旧值 | 新值 |
|---|---|---|
| 导入（现） | `import { applyToJob, submitDeliverable } from '../pages/jobs/job-api'` | `import { submitDeliverable } from '../pages/jobs/job-api'` |
| `handleApply`（删前 ~`:113`） | `const handleApply = async () => { … await applyToJob(task.tID, user) … }` | **已删除** |
| 「先参与」分支（删前 ~`:163`） | 无 `jID` ⇒ 不渲染提交表单，给「先参与」提示 + 参与按钮 `onClick={handleApply}` | 改为：**有任务号且 open ⇒ 直出提交表单**（`data-sf-m="active-task-submit-form"`）；参与面钩子 `active-task-need-apply` / `active-task-apply` / `active-task-apply-status` 全删 |

### a-4 其它 S3b 触碰文件（**非 apply/accept 调用**）

| 文件 | 变更性质 |
|---|---|
| `frontend/src/App.jsx` | **仅注释**（路由说明：`/api/job/:jobId/{apply,accept}` 已下架、`identifier = job_id`） |
| `frontend/src/pages/TaskPage.jsx` | **仅注释**（无 apply/accept 活体行） |
| `frontend/src/pages/RewardPage.jsx` | **仅注释** |
| `frontend/src/components/ClaimRewardModal.jsx` | **仅注释** |
| `frontend/src/pages/ProfilePage.jsx` | `jID` 语义换轴连带：`taskProgressItems` 按 `tID` 取 `jID` 最大者去重（`totalTasks = latestByTask.size`）—— **非 apply/accept 调用** |

### a-5 「已不再调用」的汇总（现取零活体）

`grep -rn "applyToJob|acceptApplication|handleApply|onApply|onAccept|jobs-apply|jobs-accept|/api/job/.*(apply|accept)" -- frontend/src` ⇒ **产品源码（非 test）命中的全部为「注释里的反面教材」**，**零活体调用**：

- `frontend/src/components/ActiveTaskModal.jsx:17`（注释）
- `frontend/src/pages/jobs/job-api.js:15 / :17 / :23 / :24`（注释）
- `frontend/src/pages/jobs/JobDetailPage.jsx:16`（注释）
- 其余命中均在 `frontend/src/test/unit/**`（测试的护栏/断言面，非产品调用）

---

## (b) locale 零增删证据（键数 / 值未变）

- **`git diff --name-only -- frontend/src/locales` = 空**（本单及 S3b 全程未动四语表）。
- **四语拍平键数**（现取，`node` 计数）：`zh / hk / en / vn` 均 = **1041**（顶层键 **119**、`jobs` 命名空间 **40**）。
  - 计数值集合 = `{1041}`（单值 ⇒ 四语键集齐平）。
- **工作树 sha256（现取）**：
  - `zh.json` = `75d47bf3c51dddb43315c9ea3a24f51fb5fc030022d461052ac64bb431443dde`
  - `hk.json` = `d0eb01010946789c123225a8a6c436810869d167b630517a2ddf29bc4997fc99`
  - `en.json` = `937641f107b2e37fc0e030895b173c40ac950e171451b0c84ab4083b4ec2e0bd`
  - `vn.json` = `dd49c5c1d9b6a3d979a3afdaf417e5afa1d0499f6a87c17ed52c97b8e47e4a40`
- 结论：**零增 / 零删 / 零改值**（与前序 S3b 口径一致；仅删 UI 引用，不留删键）。

---

## (c) 改写 / 新增的测试文件与用例数

> 本收尾单**只改** `d1-error-machineface.test.jsx`（修 ③/④）；其余三文件为**前序 S3b 已改写**，本单一并登记。

| 文件 | 本单动作 | 现取用例数 | 说明 |
|---|---|---|---|
| `frontend/src/test/unit/d1-error-machineface.test.jsx` | ★ **改写 ③/④** | **4** | ③/④ 原**点已删的 `jobs-apply` 按钮**驱动闭环 ⇒ 改为提交表单 `jobs-submit-form`（`fireEvent.submit`）+ 状态位 `jobs-submit-status`；`routedFetch` **先判 `/submit` 再回 `R107_BATT`**（否则提交被 `/api/task-progress` 分支吞成列表 `200`）；删除已下架的 `/api/job/…/apply` 分支 |
| `frontend/src/test/unit/r9-88-submit-surface.test.jsx` | （前序已改写） | 9 | 提交 identifier = `jobId`；J2/J3 面板不在场 |
| `frontend/src/test/unit/r9-90-participate-surface.test.jsx` | （前序已改写） | 30 | 取代 R-9-90「参与面」；弹窗直出提交面 |
| `frontend/src/test/unit/r9-batt-meter.test.jsx` | （前序已改写） | 15 | ③ 闭环改挂**提交面**（本单 ③ 的修法参照源） |

**d1 修法要点**（`routedFetch` 判别顺序，现取）：

```js
if (u.includes('/submit'))          return jsonResponse(409, submitBody)  // ★ 先判提交口
if (u.includes('/api/task-progress')) return jsonResponse(200, { success: true, data: [] })
if (u.includes('/api/task/'))         return jsonResponse(200, { success: true, data: {…} })
```

单文件验证：`npx vitest run src/test/unit/d1-error-machineface.test.jsx` ⇒ **4 passed (4)**。

---

## (d) 全量 vitest 前后对比

口径：`npx vitest run --reporter=basic`（**非** watch；`frontend/` 目录；本单加超时 ≤240s 约束）。

| 时点 | 状态 | Test Files | Tests |
|---|---|---|---|
| **改前**（S3b 产品源码改后、本收尾未修 d1） | 现取复跑 | **5 failed \| 40 passed (45)** | **9 failed \| 397 passed (406)** |
| **改后**（本单修 d1 ③/④） | 现取复跑 | **4 failed \| 41 passed (45)** | **7 failed \| 399 passed (406)** |
| 基线（S3b 前） | 交接口径 | 4 failed | 7 failed |

**「7 → 7」对照达成**：改后测试失败数 = **7** = 基线 **7**，**零新增残留**。改前多出的 `1 file / 2 tests` **恰为** `frontend/src/test/unit/d1-error-machineface.test.jsx`（其 ③/④）。

**改后仍失败的 4 文件 / 7 用例（= 基线既有、与本单无关）**：
- `src/test/accessibility/Accessibility.test.jsx`
- `src/test/components/Card.test.jsx`
- `src/test/e2e/basic.spec.js`
- `src/test/performance/VirtualList.test.jsx`

> 「改前」读数为**现取复跑**（临时 `git stash` 仅回退 `d1-error-machineface.test.jsx` 后跑，随即 `git stash pop` 复原；`git diff --stat` 确认复原为 12 insertions / 9 deletions）。

---

## (e) build 产物名

`cd frontend && npm run build`：

- **退出码 = `0`**；`vite v5.4.20`；`✓ 1797 modules transformed`；`✓ built in 1.83s`。
- 产物（`dist/assets/`）：
  - `index-Bsq4htRD.js`（413.84 kB / gzip 120.24 kB）
  - `index-BKka7fLt.css`（126.09 kB / gzip 23.44 kB）
  - `vendor-react-DQGfVle9.js`（142.17 kB）
  - `vendor-i18n-BHw4PwU-.js`（53.54 kB）
  - `vendor-ui-pQQV0X35.js`（38.13 kB）
  - `vendor-router-B3Ogmnj1.js`（12.64 kB）
  - `vendor-AmHF8z37.js`（9.11 kB）
  - `hk-DJjlsSdH.svg`（4.61 kB）、`us-BUggRluv.svg`（7.87 kB）
- 其它顶层：`dist/index.html`、`dist/brand`、`dist/images`。
- 构建告警（非失败）：`src/i18n.js` 被 `auth.js` 动态导入 + 被 `main.jsx` 静态导入 ⇒ 动态导入不另拆 chunk（既有告警）。

---

## (f) 六类泄漏读数

口径 = `node scripts/p4z-i18nviol-global.mjs`（全量面 · 四语 locale + `pages/components/shell` 源面 + 类级残余；只读，退出码 = 是否零违例）。

| 面 | 读数 |
|---|---|
| **总判** | **PASS** |
| ① locale 全量面：作用域命中节点数 | **4164**（键 1041 × 语 4） |
| ① locale 裸命中 | **0** |
| ① 键集读数（四语拍平键数取值集合） | `{1041}`（应单值 ✅） |
| ① en/vn 残留中文（豁免外） | **0** |
| ② 源面（`pages/components/shell`）：扫描文件数 | **73** |
| ② 源面裸命中 | **0** |
| ③ 类级残余（活体，必须 = 0） | **0** |
| 附：注释行登记（不计命中） | 274 条 |
| 附：代码位登记（真实接口调用，不计命中） | 80 条 |
| 附：子面③ 硬编码中文文案字面量 | 36 个；其中命中工程口径 **1** 个 —— `pages/jobs/JobDetailPage.jsx:224`（`）SELECT 列集**不含** `） |

> ★ 子面③ 那 1 处命中位于 `JobDetailPage.jsx` 的 **JSX 注释块 `{/* … */}` 内**（`SELECT` 出现在「说明该字段不随读口回包」的注释文字里）⇒ **非用户可见文案**，为扫描器对多行 JSX 注释的**代码位误报**，且与本单 locale 面**无关**（locale 裸命中 = 0）。本单未改该行、未扩张豁免、不静默放水。
> locale 面预期与基线同（本单 locale 零增删），**已取数坐实**（非推断）。

---

## (g) 交裁登记（存量键 · 因报名/选定下架或「可能变假话」· **未改值**，交 Zang 裁）

> 下列键**值一字未改**（四语齐备，本单 locale 零增删）。因 J2 报名 / J3 选定两写面下架，其**文案语义可能与现取产品行为不符** ⇒ **逐条列出，由 Zang 裁定**（改文案 / 改键 / 保留观察）。

| # | 键 | 现取值（zh，逐字） | 为何可能变假话 |
|---|---|---|---|
| 1 | `jobs.myApps` | 「我的报名」 | 现取读口 `GET /api/task-progress` 返回的是**本人提交**（`jID = submission_id`），非「报名」语义 |
| 2 | `jobs.myAppsEmpty` | 「暂无报名记录」 | 同上：空态实际指「无本人提交」，非「无报名」 |
| 3 | `jobs.participants` | 「已报名 {count} 人数」（带 `count` 插值） | 任务详情「已报名」计数语义随报名面下架而在望（`participants_count` 源义需核） |
| 4 | `common.joinNow` | 「立即参与」 | 列表卡/弹窗按钮文案，现取点开的是**提交面**，非「参与/报名」面 |
| 5 | `taskPage.continueTask` | 「继续任务」（逐字待回填） | 同上：入口语义随参与面下架而偏移 |
| 6 | `jobs.submitNote` | 「重复提交不会重复计酬」 | 需核：S2 口径为「同人可多次提交（每次落一条 `job_submission`）」⇒ 该提示与「不重复计酬」是否仍精确 |

> 说明：本表**只登记、不改值**。是否改写、如何改写，待 Zang 裁定；改则另单（须走 locale 面，本单禁动 locale）。

---

## (h) 范围外但现取命中、**未动**项

| 位置 | 现取事实 | 本单处置 |
|---|---|---|
| `frontend/src/pages/jobs/JobReviewPage.jsx:19`（注释）、`:130-131`（`t('jobs.itemTitle', { job: key, app: item.jID })`） | 走 **J5 审核面** `POST /api/job/:jobId/review`（**仍已注册**，非 apply/accept）；队列读口 = `GET /api/tasklist/pending-verification` | **未动**（范围外；非本单 apply/accept 下架面） |
| `frontend/src/pages/DashboardPage.jsx:207-225` | `handleVerifyTask` 走 `POST /api/tasklist/${jID}/verify`（**不同路由族**，非 `/api/task-progress`、非 apply/accept） | **未动**（范围外） |

> 上述两项在 `grep` 现取中命中（因含 `jID` / 审核动作），但**均非**本单下架的 J2/J3 面，故如实登记、**未改**。

---

## 硬口径守约自查

- ✅ 不 commit / 不 push；未 `npm install`；未碰/未打印 `.env*`。
- ✅ 未用 `pkill -f` / `killall`；未启停 5787/5788；未起服务/占端口。
- ✅ 仅用 `npx vitest run <文件…>` / 全量 `npx vitest run --reporter=basic`（**非**裸 `npm test`、**非** watch），带超时约束。
- ✅ 未测项：无（①–④ 全部取得读数）。原始输出以 `.txt` 存于 scratch（非 `.log`）。
- ✅ 文件面：仅改 `frontend/src/test/unit/d1-error-machineface.test.jsx` + 本报告；**未改产品源码 / backend-ts / docs/*.spec.md / migrations / locales**。
